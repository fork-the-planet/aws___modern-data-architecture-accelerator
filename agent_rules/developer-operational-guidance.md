---
scope: always
description: Operational guidance for commits, issues, MRs, reviews, and repo workflows
---

# Operational Guidance

## Regenerating starter-kit baselines

When regenerating starter-kit diff baselines (`UPDATE_BASELINES=true ... test_starter_kit.py`), you MUST neutralize local AWS credential resolution first. Otherwise `cdk synth` resolves the stack account from your ambient AWS credentials (an `~/.aws` `[default]` profile, `AWS_PROFILE`, a `credential_process` such as ada, env keys, or SSO) and bakes that real account number into the baselines. CI has no such credentials and falls back to the kit's placeholder account, so locally-generated baselines would not match CI and would fail the `sk_<kit>` job.

Run the regeneration with credential resolution disabled:

```bash
cd starter_kits
env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE -u CDK_DEFAULT_ACCOUNT -u CDK_DEPLOY_ACCOUNT \
  AWS_SDK_LOAD_CONFIG=0 AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null \
  UPDATE_BASELINES=true python3 ../scripts/test/test_starter_kit.py --kit <kit_name>
```

Then verify before committing — this MUST return nothing:

```bash
git grep -l '<your-aws-account-id>'   # or scan for any 12-digit account that is not the placeholder
```

The kit's placeholder account lives in `starter_kits/test/<kit>/kit-config.json` (`_cdk_default_account`); a clean regen produces that value, never a real account.

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

## GitLab access

`code.aws.dev` is a GitLab site. To read or act on anything there (MRs, issues, discussions, files, pipelines), use ONLY the GitLab MCP tools (`mcp__gitlab__*`). Never use the builder-mcp `ReadInternalWebsites` tool (or any web-fetch tool) on a `code.aws.dev` URL. If a GitLab MCP tool fails (e.g. auth/posture errors), stop and tell the user rather than falling back to another tool.

## Reviews

When asked to review changes against a story or assess branch alignment, follow the process in `.claude/agents/story-review.md`.

## General writing style

When generating text that is supposed to represent what a human wrote, such as a response from a developer to a thread or a developer's message on Slack, avoid using em dashes and other signs that a human would have trouble writing with a keyboard. This makes the text less distracting for another human to read.
