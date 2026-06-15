# Project Instructions

## Coding Standards and Conventions

Refer to the steering files in `.kiro/steering/` for project-wide standards:
- `coding-standards.md` — TypeScript/CDK patterns, generated file rules, schema documentation
- `module-creation.md` — Creating new app modules and L3/L2 constructs (directory structure, skeletons, build order)
- `testing-standards.md` — Test patterns and requirements
- `config-authoring.md` — Config interface and sample config conventions; **read this before creating or editing MDAA YAML configs** (includes minimal test config pitfalls)
- `iterative-development.md` — Build/test cycle for modifying existing packages, common pitfalls, dependency ordering

## Commits

Keep commit messages short: a single-line subject (a short half-sentence, e.g. `feat(agentcore): migrate VPC-only resource policy to native CFN resource`). Do not add a body. Detailed explanation belongs in the MR description, not the commit.

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

## General writing style
When generating text that is supposed to represent what a human wrote, such as a response from a developer to a thread or a developer's message on Slack, avoid using em dashes and other signs that a human would have trouble writing with a keyboard. This makes the text less distracting for another human to read.