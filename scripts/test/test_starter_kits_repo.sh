#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."
cd "$PROJECT_ROOT"

echo "Running starter kit tests."

# All starter kits live in the single @aws-mdaa/starter-kits package. Its test
# target invokes scripts/test/test_starter_kit.py, which iterates every kit and
# self-filters to the modules affected by the change (via nx affected + each
# kit's mdaa.yaml). There is no per-kit nx project to select, so we always run
# the one project's test target and let the harness do the gating.
#
# The harness runs each affected kit's synth serially. Kits share app module
# working directories (e.g. @aws-mdaa/glue-catalog is used by most kits), and
# mdaa synthesizes each local module from its shared workspace directory; two
# concurrent synths of the same module would collide there. Sequential execution
# inside the harness removes that contention.
npx nx run @aws-mdaa/starter-kits:test
