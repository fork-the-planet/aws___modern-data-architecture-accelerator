#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Computes the SonarQube project key for the current pipeline context.
#
# This file is SOURCED (not executed) by sonarqube.sh and
# sonarqube-target-baseline.sh so both derive an identical project key.
# Keeping the derivation in one place prevents the baseline scan and the
# MR scan from drifting onto different keys.
#
# SonarQube Community Build supports a single branch per project, so MR
# pipelines use a dedicated project key to avoid clobbering the main-branch
# baseline. The key embeds:
#   - the MR source branch  -> isolates each MR
#   - the MR target branch  -> retargeting an MR rebaselines
#   - the target branch HEAD SHA -> the target MOVING rebaselines
#
# Without the target SHA, the key is stable for the lifetime of the MR.
# Because the baseline scan only runs once per key (it exits early when the
# project already exists), commits landing on the target branch after the
# first baseline would never be re-baselined, leaving the "existing code"
# snapshot stale and misclassifying new code. Including the target HEAD SHA
# forces a fresh key — and thus a fresh baseline — whenever the target moves.
#
# Sets the following variables for the caller:
#   SONAR_BASE_PROJECT_KEY - base key (project path slug or override)
#   SONAR_IS_MR            - "true" in an MR pipeline, otherwise "false"
#   SONAR_TARGET_REF       - target branch ref, e.g. origin/main (MR only)
#   SONAR_TARGET_SHA       - resolved target branch HEAD SHA (MR only)
#   SONAR_PROJECT_KEY      - the project key to pass to sonar-scanner
#
# Environment variables (provided by GitLab CI):
#   SONAR_PROJECT_KEY                   - (optional) base key override
#   CI_PROJECT_PATH_SLUG                - default base key
#   CI_PIPELINE_SOURCE                  - pipeline trigger type
#   CI_MERGE_REQUEST_IID                - MR identifier
#   CI_MERGE_REQUEST_SOURCE_BRANCH_NAME - MR source branch
#   CI_MERGE_REQUEST_TARGET_BRANCH_NAME - MR target branch (defaults to main)

# Number of leading hex characters of the target HEAD SHA folded into the
# MR project key. Long enough to be collision-free in practice, short
# enough to keep the key readable.
SONAR_TARGET_SHA_LEN=12

# Default target branch when CI does not provide one (e.g. local runs).
SONAR_DEFAULT_TARGET_BRANCH=main

# Sanitize an arbitrary string for use inside a SonarQube project key.
# SonarQube keys allow alphanumerics, hyphens, underscores, periods, and
# colons; everything else is replaced with an underscore.
_sonar_sanitize() {
  echo "$1" | sed 's/[^a-zA-Z0-9._:-]/_/g'
}

SONAR_BASE_PROJECT_KEY=${SONAR_PROJECT_KEY:-${CI_PROJECT_PATH_SLUG}}

if [ "${CI_PIPELINE_SOURCE}" = "merge_request_event" ] || [ -n "${CI_MERGE_REQUEST_IID}" ]; then
  SONAR_IS_MR=true

  SONAR_TARGET_REF="origin/${CI_MERGE_REQUEST_TARGET_BRANCH_NAME:-${SONAR_DEFAULT_TARGET_BRANCH}}"

  # Resolve the current target branch HEAD. CI_MERGE_REQUEST_TARGET_BRANCH_SHA
  # is empty in detached MR pipelines, so resolve via the remote ref instead.
  SONAR_TARGET_SHA=$(git rev-parse "${SONAR_TARGET_REF}")
  _sonar_target_sha_short=${SONAR_TARGET_SHA:0:${SONAR_TARGET_SHA_LEN}}

  _sonar_sanitized_branch=$(_sonar_sanitize "${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME}")
  _sonar_sanitized_target=$(_sonar_sanitize "${CI_MERGE_REQUEST_TARGET_BRANCH_NAME:-${SONAR_DEFAULT_TARGET_BRANCH}}")

  SONAR_PROJECT_KEY="${SONAR_BASE_PROJECT_KEY}-mr-${_sonar_sanitized_branch}-to-${_sonar_sanitized_target}-${_sonar_target_sha_short}"
else
  SONAR_IS_MR=false
  SONAR_TARGET_REF=""
  SONAR_TARGET_SHA=""
  SONAR_PROJECT_KEY="${SONAR_BASE_PROJECT_KEY}"
fi
