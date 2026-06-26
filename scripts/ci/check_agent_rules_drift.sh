#!/bin/bash
set -e

# Detects uncommitted agent rule projection changes after build.
# If the build produces different projections than what's committed, the
# developer forgot to run 'npm run build' in agent-rules before pushing.

echo "Checking for agent rules drift..."

CHANGED=$(git diff --name-only -- '.kiro/steering/' '.claude/rules/' '.cursor/rules/' '.windsurf/rules/' '.github/instructions/' '.github/copilot-instructions.md' 'CLAUDE.md')

if [ -n "$CHANGED" ]; then
    echo ""
    echo "=========================================="
    echo "ERROR: Agent rule projections changed after build"
    echo "=========================================="
    echo ""
    echo "The following files differ from what was committed:"
    echo "$CHANGED"
    echo ""
    git diff --stat -- '.kiro/steering/' '.claude/rules/' '.cursor/rules/' '.windsurf/rules/' '.github/instructions/' '.github/copilot-instructions.md' 'CLAUDE.md'
    echo ""
    echo "Fix: run 'npm run build' in packages/utilities/agent-rules/ and commit the updated projections."
    exit 1
fi

echo "No agent rules drift detected."
