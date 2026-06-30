#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Establishes the SonarQube "existing code" baseline for an MR project.
#
# Runs a full unscoped scan of the MR's *fork point* (the commit where the
# branch diverged from the target) with SCM (git blame) enabled, stamped with
# that commit's date via sonar.projectDate. This creates the MR project on
# first analysis and anchors the "new code" period to the branch point.
# Subsequent MR scans then classify every line committed after the fork point
# — i.e. exactly the MR's own changes — as new code.
#
# Why the fork point and not the target HEAD / git merge-base:
#   New code is determined by blame date vs. the period-start date. If the
#   baseline is dated at pipeline time (the old behavior), MR commits — which
#   were authored earlier — sort BEFORE the period start and are misclassified
#   as existing code, so the gate never sees them. Anchoring the period to the
#   fork-point date makes all MR-authored lines (committed after it) new.
#
#   `git merge-base` is the most-recent common ancestor, which drifts forward
#   when the target is merged back into the branch. The fork point (parent of
#   the oldest branch-unique commit) is stable across target movement and
#   back-merges, so it is used instead.
#
# The baseline only runs once per MR project lifetime. If the project
# already exists on the SonarQube server, this script exits immediately.
# The analysis cache from the baseline carries over to the first MR scan,
# so unchanged files get cache hits and skip re-analysis.
#
# Environment variables (provided by GitLab CI):
#   SONAR_SERVER   - SonarQube server URL
#   SONAR_LOGIN    - SonarQube authentication token
#   SONAR_PROJECT_KEY - (optional) base project key, defaults to CI_PROJECT_PATH_SLUG
#   CI_MERGE_REQUEST_SOURCE_BRANCH_NAME - MR source branch
#   CI_MERGE_REQUEST_IID - MR identifier
#   CI_PIPELINE_SOURCE - pipeline trigger type
set -e

# Only run in MR pipelines
if [ "${CI_PIPELINE_SOURCE}" != "merge_request_event" ] && [ -z "${CI_MERGE_REQUEST_IID}" ]; then
  echo "Not an MR pipeline — skipping target baseline."
  exit 0
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/sonar-project-key.sh"
PROJECT_KEY="${SONAR_PROJECT_KEY}"

echo "=== SonarQube Target Baseline ==="
echo "Project key:   ${PROJECT_KEY}"
echo "MR branch:     ${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME}"
echo "Target branch: ${SONAR_TARGET_REF} (${SONAR_TARGET_SHA})"

# Skip if the MR project already exists — baseline only needs to run once
# per (source, target, target-HEAD) key. When the target branch moves, the
# key changes, this lookup misses, and a fresh baseline is established.
echo "Checking if project already exists on SonarQube server..."
PROJECT_EXISTS=$(python3 "${SCRIPT_DIR}/sonar_project_exists.py" "${PROJECT_KEY}")

if [ "${PROJECT_EXISTS}" = "true" ]; then
  # Project exists — check for UI-suppressed issues before skipping.
  # Fail fast so the pipeline doesn't waste time on build/test if
  # someone has suppressed issues via the SonarQube UI.
  echo "Project exists — checking for UI-suppressed issues..."
  python3 "${SCRIPT_DIR}/sonar_check_suppressions.py" "${PROJECT_KEY}"

  echo "Project '${PROJECT_KEY}' already exists — skipping baseline."
  echo "=== Target baseline: SKIPPED (project exists) ==="
  exit 0
fi

echo "Project does not exist — running baseline scan."

# Target ref already resolved by sonar-project-key.sh. (The target HEAD SHA
# is used only in the log line above and to derive the project key; the
# baseline scans the fork point, not the target HEAD.)
TARGET_REF="${SONAR_TARGET_REF}"

# Find the ORIGINAL fork point: the parent of the oldest commit unique to
# this branch. Commits reachable from the target (including any target
# commits merged back into this branch) are excluded by "${TARGET_REF}..HEAD",
# so the oldest remaining commit is the branch's first commit and its parent
# is the true divergence point. This is stable across target movement and
# back-merges, unlike `git merge-base`.
MR_HEAD=$(git rev-parse HEAD)
FIRST_MR_COMMIT=$(git rev-list --topo-order --reverse "${TARGET_REF}..${MR_HEAD}" | head -1)

if [ -z "${FIRST_MR_COMMIT}" ]; then
  echo "No commits unique to this branch vs ${TARGET_REF} — nothing to gate."
  echo "=== Target baseline: SKIPPED (no unique commits) ==="
  exit 0
fi

if ! BRANCH_POINT=$(git rev-parse --verify --quiet "${FIRST_MR_COMMIT}^"); then
  # The oldest branch-unique commit is a root commit (orphan branch /
  # unrelated-history MR) with no parent to anchor the baseline to. Skip
  # cleanly instead of crashing the job under `set -e`.
  echo "Oldest branch-unique commit ${FIRST_MR_COMMIT} is a root commit — no fork-point parent to anchor the baseline to."
  echo "=== Target baseline: SKIPPED (root commit, no parent) ==="
  exit 0
fi
# Committer date (not author date): rebases rewrite committer dates to the
# rebase time, so every MR commit sorts strictly after this anchor.
# Format as yyyy-MM-dd'T'HH:mm:ssZ with a numeric offset and NO colon (e.g.
# 2026-06-26T18:54:51+0000) — sonar.projectDate rejects the ISO-8601 colon
# offset (+00:00) that `%cI` produces.
BASELINE_DATE=$(git show -s --date=format:'%Y-%m-%dT%H:%M:%S%z' --format=%cd "${BRANCH_POINT}")
echo "Fork point:   ${BRANCH_POINT}"
echo "Baseline date: ${BASELINE_DATE}"

# Check if the MR contains any TypeScript changes since the fork point. If
# not, skip both the baseline and MR scan — there's nothing to gate on.
TS_CHANGES=$(git diff --name-only "${BRANCH_POINT}" "${MR_HEAD}" -- '*.ts' | grep -v '\.d\.ts$' | grep -v '/test/' | head -1)

if [ -z "${TS_CHANGES}" ]; then
  echo "No TypeScript source changes detected between fork point and MR HEAD — skipping baseline."
  echo "=== Target baseline: SKIPPED (no TS changes) ==="
  exit 0
fi

# Check out the fork point for the baseline scan. The reference snapshot and
# its date both describe the branch point, so the MR scan's new code is
# exactly the diff the MR introduces on top of where it branched.
ORIGINAL_HEAD=$(git rev-parse HEAD)
echo "Checking out fork point ${BRANCH_POINT} for baseline scan..."
git checkout "${BRANCH_POINT}" --quiet

# Install dependencies so the TypeScript analyzer can resolve types.
echo "Installing dependencies at fork point..."
./scripts/build/npm_install_repo.sh

# Build all packages so .d.ts files exist for type resolution. Without
# compiled output, type-aware rules may produce different results than
# the MR scan (which runs after a full build). This ensures both scans
# have identical type resolution context.
echo "Building all packages for type resolution..."
export MDAA_BUILD_CODE_ONLY=true
npx nx run-many --target=build --all
unset MDAA_BUILD_CODE_ONLY

echo "Running baseline SonarQube scan at fork point ${BRANCH_POINT} (dated ${BASELINE_DATE})..."
export SONAR_SCANNER_JAVA_OPTS="-Xmx1024m"
unset NODE_OPTIONS

# Full unscoped scan with SCM enabled, dated at the fork point via
# sonar.projectDate. With no projectVersion, the "Previous Version" new code
# definition anchors to this first analysis, so its date becomes the new code
# period start. The MR scan (dated "now") then classifies everything committed
# after the fork point as new code.
sonar-scanner \
  -Dsonar.projectKey="${PROJECT_KEY}" \
  -Dsonar.projectDate="${BASELINE_DATE}" \
  -Dsonar.javascript.node.maxspace=${SONAR_NODE_MAXSPACE:-8192} \
  -Dsonar.host.url="${SONAR_SERVER}" \
  -Dsonar.token="${SONAR_LOGIN}" \
  -Dsonar.sourceEncoding=utf-8 \
  -Dsonar.qualitygate.wait=false

echo "Baseline scan complete."

# Restore the original MR commit
echo "Restoring original HEAD: ${ORIGINAL_HEAD}"
git checkout "${ORIGINAL_HEAD}" --quiet

echo "=== Target baseline: DONE ==="
