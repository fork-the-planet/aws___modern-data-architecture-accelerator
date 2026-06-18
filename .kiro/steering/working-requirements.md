---
inclusion: auto
description: General working instructions
---

# General Working Instructions - Steering Requirements

Non-optional requirements to be applied to all Kiro tasks.

#[[file:CONTRIBUTING.md]] #[[file:TESTING.md]]

## Working Requirements

- All temporary working kiro files and outputs should written be under .kiro/working/<task identifier>
- Run formatter and linting on any modified file.
- Use functional/immutable pattern whenever possible.
- Use repo-level and package-level npm scripts for all test and build tasks when available. Do not directly invoke build/test commands such as tsc, jsii, or jest.
