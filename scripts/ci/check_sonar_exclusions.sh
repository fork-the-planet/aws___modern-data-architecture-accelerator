#!/bin/bash
set -e

# Fails the build when a specific-file entry in sonar.exclusions or
# sonar.coverage.exclusions no longer matches any tracked file, so exclusions
# for renamed or deleted files are removed alongside the file they targeted
# rather than lingering as stale, misleading config.
#
# Scope: only literal single-file globs of the form **/<name>.ts or
# **/<name>.js are validated. Directory globs (**/test/**) and wildcard file
# globs (**/*.preload.ts) are skipped — they do not name a single file.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "${SCRIPT_DIR}/../.." && pwd )"
PROPS="${REPO_ROOT}/sonar-project.properties"

if [ ! -f "${PROPS}" ]; then
  echo "ERROR: ${PROPS} not found." >&2
  exit 1
fi

echo "Checking sonar-project.properties for dead file exclusions..."

# Flatten the file: join backslash-continued lines so each sonar.* property is
# a single logical line, then keep only the two exclusion properties. awk is
# used (not GNU-only sed label loops) so the join behaves identically under the
# BSD awk on developer macs and the GNU awk in CI.
FLATTENED=$(awk '
  { line = line $0 }
  /\\[[:space:]]*$/ { sub(/\\[[:space:]]*$/, "", line); next }
  { print line; line = "" }
  END { if (line != "") print line }
' "${PROPS}" | grep -E '^[[:space:]]*sonar\.(coverage\.)?exclusions[[:space:]]*=')

DEAD=()

while IFS= read -r line; do
  [ -z "${line}" ] && continue
  # Strip "sonar.<...>exclusions =" and split the value on commas.
  values="${line#*=}"
  IFS=',' read -ra entries <<< "${values}"
  for raw in "${entries[@]}"; do
    # Trim surrounding whitespace.
    entry="$(echo "${raw}" | xargs)"
    [ -z "${entry}" ] && continue
    # Only validate literal single-file globs: **/<name>.ts|js with no other
    # wildcard in the filename. Skip anything containing '*' after the leading
    # '**/' (e.g. **/*.preload.ts) and anything that isn't a .ts/.js file.
    case "${entry}" in
      *'/**'|*'/**/'*) continue ;;            # directory glob
    esac
    if [[ "${entry}" =~ ^\*\*/[^*]+\.(ts|js)$ ]]; then
      name="${entry#**/}"
      # Match the file at any depth: path ends with /<name> or equals <name>.
      escaped="$(printf '%s' "${name}" | sed 's/[.[\*^$]/\\&/g')"
      if ! git -C "${REPO_ROOT}" ls-files | grep -Eq "(^|/)${escaped}$"; then
        DEAD+=("${entry}")
      fi
    fi
  done
done <<< "${FLATTENED}"

if [ ${#DEAD[@]} -gt 0 ]; then
  echo ""
  echo "=========================================="
  echo "ERROR: Dead sonar exclusion entries found"
  echo "=========================================="
  echo ""
  echo "These specific-file entries in sonar-project.properties match no"
  echo "tracked file (the file was renamed or deleted):"
  echo ""
  for d in "${DEAD[@]}"; do
    echo "  ${d}"
  done
  echo ""
  echo "Remove them from sonar.exclusions / sonar.coverage.exclusions, or fix"
  echo "the path if the file was renamed."
  exit 1
fi

echo "No dead sonar exclusion entries detected."
