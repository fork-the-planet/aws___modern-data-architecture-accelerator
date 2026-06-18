# Placeholder Standardization — Rename Map

Resolution rule (see `.kiro/steering/starter-kit-standards.md` ->
"Placeholder Resolution in Tests"):

1. Global shape map -> deterministic, shape-correct value.
2. Otherwise auto-generate `<YOUR_FOO>` -> `test-foo`.

Only placeholders whose auto-generated `test-*` value is the wrong **shape**
(breaks synth, or bakes a malformed value into the baseline) need a global-map
entry and a standardized token. Everything else keeps its descriptive name and
auto-generates. The map grows via the remediation loop: a synth failure under
the `test-*` default justifies adding a map entry, not pre-emptive renaming.

## Global map entries (in the harness: PLACEHOLDER_SHAPE_MAP)

| Standard token | Why shape is required |
|----------------|-----------------------|
| `<YOUR_ACCOUNT_ID>` (`_2`, `_3`, ...) | 12 digits; used in cross-account ARNs/stacks |
| `<YOUR_CIDR_1>` (`_2`, ...) | WAF IPSet requires a valid CIDR |
| `<YOUR_KMS_ARN>` (`_2`, ...) | parsed as a KMS key ARN |
| `<YOUR_SECRET_ARN>` (`_2`, ...) | Secret.fromSecretCompleteArn requires a complete ARN (6-char suffix) |
| `<YOUR_HOUR>` (`_2`, ...) | interpolated into `cron(0 H * * ? *)` |
| `<YOUR_INT>` (`_2`, ...) | numeric cadence/rate |
| `<YOUR_BEDROCK_MODEL_ID>` (`_2`, `_3`, ...) | validated into an AWS::Bedrock model ARN |

A numeric suffix = a distinct instance of the same type (distinct value per
index). Reuse the same token where two keys must resolve to the same value.

## Renames applied (kits present on this branch)

### health_data_accelerator (mdaa.yaml)
- `<YOUR_DMS_SECRETS_ARN>` -> `<YOUR_SECRET_ARN>`
- `<YOUR_DMS_SECRETS_KMS_ARN>` -> `<YOUR_KMS_ARN>`
- `<YOUR_FILE_PROCESSOR_TRIGGER_HOUR>` -> `<YOUR_HOUR>`
- `<YOUR_TRANSFORMATION_TRIGGER_HOUR>` -> `<YOUR_HOUR_2>`
- `<YOUR_FILE_PROCESSOR_TRIGGER_RATE>` -> `<YOUR_INT>`
- `<YOUR_TRANSFORMATION_TRIGGER_RATE>` -> `<YOUR_INT_2>`

### smus_data_mesh (mdaa.yaml)
- `<YOUR_ENTERPRISE_ACCOUNT_ID>` -> `<YOUR_ACCOUNT_ID>`
- `<YOUR_TEAM1_ACCOUNT_ID>` -> `<YOUR_ACCOUNT_ID_2>`
- `<YOUR_TEAM2_ACCOUNT_ID>` -> `<YOUR_ACCOUNT_ID_3>`

### genai_accelerator (mdaa.yaml)
- `<YOUR_LLM_MODEL>` -> `<YOUR_BEDROCK_MODEL_ID>`
- `<YOUR_KB_EMBEDDING_MODEL>` -> `<YOUR_BEDROCK_MODEL_ID_2>`
- `<YOUR_KB_PARSING_MODEL>` -> `<YOUR_BEDROCK_MODEL_ID_3>`

## Pending — kits not on this branch (apply when merged to chore)

### genai_gaia_chatbot (mdaa.yaml)
- `<YOUR_VPC_OWNER_ACCOUNT_ID>` -> `<YOUR_ACCOUNT_ID_2>`  (distinct from `<YOUR_ACCOUNT_ID>`)
- `<YOUR_WAF_CIDR_1>` -> `<YOUR_CIDR_1>`
- `<YOUR_WAF_CIDR_2>` -> `<YOUR_CIDR_2>`
- `<YOUR_WAF_CIDR_3>` -> `<YOUR_CIDR_3>`

## Left as-is (auto-generate `test-*`; no shape requirement found)

`<YOUR_ORG_NAME>`, `<YOUR_VPC_ID>`, `<YOUR_SUBNET_ID*>`, `<YOUR_SECURITY_GROUP_ID>`,
all `<YOUR_*_SSO_*>`, `<YOUR_*_NAME>`, `<YOUR_PROJECT_NAME>`, `<YOUR_DMS_SOURCE_DB>`.
These synthesize correctly under the auto-generated `test-*` value. If any later
fails synth, add it to the global map (remediation loop) rather than pre-emptively.

## Per-kit test CONTEXT objects

All placeholder overrides removed from kit `*.diff.test.ts` CONTEXT objects; the
global map + auto-generate now supply every `<YOUR_...>` value. The only remaining
CONTEXT key is `_cdk_default_account` (a synth deployment-account setting, not a
placeholder) where a kit needs it to match a specific account.
