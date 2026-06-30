---
scope: always
description: Non-optional working requirements for all tasks
---

# General Working Instructions - Steering Requirements

Non-optional requirements to be applied to all Kiro tasks.

#[[file:CONTRIBUTING.md]] #[[file:TESTING.md]]

## Working Requirements

- All temporary working kiro files and outputs should be written under .kiro/working/<task identifier>
- Run formatter and linting on any modified file.
- Use functional/immutable pattern whenever possible.
- Always use `npm run <script>` for build, test, lint, and other package operations. Never bypass the build system with direct `npx tsc`, `npx jest`, or similar calls — the npm scripts include necessary setup (venv activation, schema generation, environment variables) that raw commands skip.
