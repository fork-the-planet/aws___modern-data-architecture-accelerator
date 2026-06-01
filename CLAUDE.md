# Project Instructions

## Coding Standards and Conventions

Refer to the steering files in `.kiro/steering/` for project-wide standards:
- `coding-standards.md` — TypeScript/CDK patterns, generated file rules, schema documentation
- `module-creation.md` — Creating new app modules and L3/L2 constructs (directory structure, skeletons, build order)
- `testing-standards.md` — Test patterns and requirements
- `config-authoring.md` — Config interface and sample config conventions
- `iterative-development.md` — Build/test cycle for modifying existing packages, common pitfalls, dependency ordering

## Issues

When creating or writing down issues/tickets:
- **Bugs**: use the template at `.gitlab/issue_templates/bug_report.md`
- **Features / everything else**: use the template at `.gitlab/issue_templates/default.md`
- Save the resulting file in `.gitlab/issues/<kebab-case-name>.md`

## Merge Requests

When creating MRs/PRs:
- Use the template at `.gitlab/merge_request_templates/default.md` for the body
- Save the resulting file in `.gitlab/merge_requests/<kebab-case-name>.md`

## Reviews

When asked to review changes against a story or assess branch alignment, follow the process in `.claude/agents/story-review.md`.