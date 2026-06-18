---
inclusion: fileMatch
fileMatchPattern: "starter_kits/**"
---

# Starter Kit Standards

Standards for all MDAA starter kit configurations and documentation. Starter kits should be deployable in as few steps
as possible. Customers should be able to read the README, understand what they are getting, and deploy it in a few minutes.

## README Structure

Every starter kit README must follow this structure in order. No additional top-level sections unless justified by operational necessity (e.g., Troubleshooting for complex kits).

1. **Title** — H1 with the kit name
2. **Description** — 1-2 sentences explaining what the kit deploys
3. **Shortcut link** — `> **[Deployment Instructions](#deployment)**`
4. **Use Cases** — bullet list of when to use this kit
5. **Capabilities** — bullet list of what gets deployed/configured
6. **Architecture** — image reference (`![Name](docs/image.png)`)
7. **Deployment** — single section with three subsections:
   - `### Prerequisites and Predeployment` — authenticate, bootstrap CDK, VPC/account/org provisioning
   - `### Configure MDAA` — address TODOs in mdaa.yaml, review CDK Nag suppressions
   - `### Deploy MDAA` — npm install, mdaa ls/synth/deploy
8. **Next Steps** — link to USAGE.md for post-deployment instructions
9. **Modules Deployed** — table with Module and Purpose columns
10. **Troubleshooting** — kit-specific deployment issues

### What NOT to include in the README

- Directory structure listings (the filesystem is self-documenting)
- Configuration file descriptions (the yaml files have inline comments)
- Component/architecture deep-dives (belongs in docs/ if needed)
- Customization suggestions (obvious and generic)
- Full API references or frontend integration guides (move to docs/)
- Security best practices (generic advice belongs elsewhere)
- Design principles or implementation philosophy (move to docs/ or inline comments)

## Deployment Section

```markdown
## Deployment

### Prerequisites and Predeployment

1. Authenticate to your target AWS account and region. Ensure the authenticated role has permissions to deploy resources via CDK.
2. [Bootstrap CDK](../../PREDEPLOYMENT.md#single-account-bootstrap) in your target account and region.
3. <Kit-specific prerequisites: VPC provisioning, IAM Identity Center setup, etc.>

Additional info: [PREDEPLOYMENT](../../PREDEPLOYMENT.md)

### Configure MDAA

1. Address all TODOs in [`mdaa.yaml`](mdaa.yaml), specifically:
   - Set `organization` to a globally unique name
   - Set `context` values: <list each required value>

2. Address all TODOs in module configs, specifically:
   - CDK Nag suppressions in [`<roles-file>`](<roles-file>). Uncomment each suppression only after reviewing the associated permissions and confirming they are acceptable for your environment.

### Deploy MDAA

Run the following from the starter kit directory (containing `mdaa.yaml`):

1. Optionally, run `npx @aws-mdaa/cli ls` to understand what stacks will be deployed.
2. Optionally, run `npx @aws-mdaa/cli synth` and review the produced templates.
3. Run `npx @aws-mdaa/cli deploy` to deploy all modules.

Additional info: [DEPLOYMENT](../../DEPLOYMENT.md)
```

## CDK Nag Suppressions

### Placement

Suppressions must be the first property immediately under their parent object name (before `policyDocument` or `trustedPrincipal`).

### TODO Comment

- For policies: `# TODO: Review the below policyDocument permissions and suppression. Uncomment the suppression prior to deployment.`
- For roles: `# TODO: Review the below awsManagedPolicies and suppression. Uncomment the suppression prior to deployment.`

### Suppression Reasons

Reasons must be specific and explain:
- Which actions or resources require the wildcard/managed policy
- Why the wildcard or managed policy is necessary (API limitation, dynamic names, etc.)
- Link to AWS documentation where applicable

Bad: `"AWSGlueServiceRole approved for usage"`
Good: `"AWSGlueServiceRole is required for Glue ETL jobs to access S3, CloudWatch Logs, and EC2 networking for job execution. See https://docs.aws.amazon.com/glue/latest/dg/create-an-iam-role.html"`

## MDAA CLI Usage

- All CLI commands use `npx @aws-mdaa/cli`
- Commands are run from the directory containing `mdaa.yaml`

## Resource Naming and References

MDAA applies a naming convention to all deployed resources. Understanding the three levels of resource identity prevents confusion in configs and docs.

### Three Levels of Resource Identity

| Level | Where Used | Example |
|-------|-----------|---------|
| **Config name** | Module YAML config (the resource creator) | `raw` (bucket key in datalake.yaml) |
| **Deployed name** | AWS Console, CLI output, CloudFormation | `<org>-<env>-<domain>-datalake-raw` |
| **SSM path** | Cross-module references, programmatic lookup | `ssm-org:/<domain>/datalake/bucket/raw/name` |

The naming convention automatically prefixes config names with `<org>-<env>-<domain>-<module>-` at deployment time. Customers never need to construct the full name manually.

### Rules for Module Configs

- **Creating a resource**: Use the short config name only. The naming convention adds the prefix.
  ```yaml
  # datalake.yaml — creating a bucket
  buckets:
    raw:            # ← config name only, deploys as <org>-<env>-<domain>-datalake-raw
      accessPolicies: [...]
  ```

- **Referencing a resource from another module**: Always use SSM references (`ssm-org:` or `ssm-domain:`). Never hardcode the deployed name — it breaks if org/env/domain changes.
  ```yaml
  # crawler.yaml — referencing a bucket from the datalake module
  targets:
    - path: s3://{{resolve:ssm-org:/shared/datalake/bucket/transformed/name}}/data/
  ```

- **Referencing a role from the roles module**: Use `generated-role-id:<role-name>` (same domain) or `ssm-org:/<domain>/generated-role/<role-name>/id` (cross-domain).

### Rules for Documentation (USAGE.md, README)

When mentioning deployed resources in customer-facing docs, show the full deployed name pattern so customers can find it in the console, and include the config name in parentheses so they can trace it back to their config:

```markdown
| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| S3 Bucket | `<org>-<env>-shared-datalake-raw`<br>`/<org>/shared/datalake/bucket/raw/name` | `buckets.raw` in [`datalake/datalake.yaml`](datalake/datalake.yaml) |
```

### Anti-patterns

- **Hardcoded deployed name in a module config**: `bucketName: myorg-dev-shared-datalake-raw` — will break in any other environment. Use SSM.
- **Full deployed name as the config key**: `<org>-<env>-shared-datalake-raw:` as a bucket key — the naming convention will double-prefix it. Use the short name.
- **SSM reference to a resource in the same module**: Use direct config references or `{{ref:/ConstructPath:Attribute}}` instead of SSM for intra-module wiring.

## Schema Validation

- Every starter kit YAML config file must have a `# yaml-language-server: $schema=<path>` directive on line 1. No exceptions — if a YAML file exists in the kit, it must reference its schema.
- Schema paths in the repo must be valid relative paths from the file to the repo's `schemas/` directory (e.g. `../../schemas/@aws-mdaa/cli.json`)
- The `create-mdaa-config` build process adjusts these paths when copying templates (where schemas are at `./schemas/` relative to the kit root)
- Schema file names match module names: `@aws-mdaa/roles` → `schemas/@aws-mdaa/roles.json`
- If a config file does not have a corresponding schema in `schemas/`, flag it — either the schema is missing from the repo or the file is using the wrong module name

## Inline Documentation in Config Files

Every **customer-decision property** in starter kit YAML config files must have a preceding comment explaining what it does. Customers should never need to look up a schema or read source code to understand a configuration choice they need to make.

### What requires a comment

- Properties where the customer must choose a value (resource names, ARNs, IDs, sizing, feature toggles)
- Properties that control deployment behavior the customer should be aware of
- Properties whose purpose is not obvious from the key name alone
- The first occurrence of a pattern (e.g., first role definition needs a comment; subsequent roles following the same pattern don't)

### What does NOT require a comment

- Standard MDAA structural keys that appear in every config (`trustedPrincipal`, `generatedPolicies`, `awsManagedPolicies`, `module_path`, `module_configs`, `policyDocument`, `Statement`, `Effect`, `Action`, `Resource`, `Sid`) — these are framework boilerplate, not customer decisions
- Repeated instances of a pattern already documented (if the first bucket has comments, the second bucket with identical structure doesn't need them repeated verbatim)
- Properties whose meaning is completely obvious from the key name in context (e.g., `description: "..."` on a Lambda function)
- YAML structural nesting that serves only as a container (e.g., the `domains:` key in mdaa.yaml when it already has a preceding section comment)

### Rules

- Comments should explain **what the property controls and why a customer would change it**, not just restate the key name.
- For optional properties, prefix with `# (Optional)`.
- For properties with a fixed set of valid values, append the values: `(enum: value1, value2, value3)`.
- For properties with defaults, append: `(default: value)`.
- Wrap long comments at 100 characters across multiple `#` lines.

### Examples

Good:
```yaml
# Maximum number of concurrent Glue crawlers that can run simultaneously.
# Increase for large data lakes with many tables. (default: 5)
maxConcurrentCrawlers: 5

# S3 lifecycle rule to transition objects to Glacier after this many days.
# (Optional) Set to 0 to disable lifecycle transitions.
glacierTransitionDays: 90
```

Bad (missing comment on a customer-decision property):
```yaml
maxConcurrentCrawlers: 5
glacierTransitionDays: 90
```

Not required (structural/framework key):
```yaml
generateRoles:
  my-role:
    trustedPrincipal: this_account    # ← no comment needed, standard MDAA key
    generatedPolicies:                # ← no comment needed, standard MDAA key
      - MyPolicy
```

### Exceptions

- The `# yaml-language-server` schema directive on line 1 does not need an additional comment.
- CDK Nag suppression blocks already have their own TODO comment format (see CDK Nag Suppressions section).

## Config Files (mdaa.yaml)

- Must include a TODO comment for setting `organization`
- All placeholder values that require customer input must use the `<YOUR_...>` pattern (uppercase, underscores). This enables `create-mdaa-config` to discover and prompt for them automatically.
- Every placeholder line must have a `# TODO:` comment on the line immediately above it describing what the customer needs to provide. This description is used as the prompt label in `create-mdaa-config`.
- Examples:
  ```yaml
  # TODO: Set a globally unique organization name (used in S3 bucket names and resource prefixes)
  organization: <YOUR_ORG_NAME>
  # TODO: Set your VPC ID
  vpc_id: <YOUR_VPC_ID>
  ```

## Placeholder Resolution in Tests

The diff-test harness fills every `<YOUR_...>` placeholder before synth using two steps:

1. **Global map** — if the placeholder token is in the harness's global map, it resolves to a deterministic, **shape-correct** value (a 12-digit account, a valid CIDR, an ARN, a cron hour, etc.).
2. **Auto-generate** — otherwise it falls back to `<YOUR_FOO_BAR>` -> `test-foo-bar`.

Most placeholders are format-insensitive and the auto-generated `test-*` value synthesizes fine — those need **no** standardization and no map entry. The global map exists only for the minority of placeholders where a `test-*` string would break synth because CDK parses or validates the value (account IDs in cross-account ARNs, CIDRs in WAF rules, ARNs, cron hours/rates interpolated into `cron(0 H * * ? *)`).

### Remediation loop (how the map grows)

Do **not** pre-emptively standardize placeholders. Let synth failures drive it:

- A kit's synth fails because the auto-generated `test-*` value is the wrong shape (e.g. `cron(0 test-...-hour * * ? *)` is invalid) ->
- the remediation is to **add that placeholder type to the global map** (with a shape-correct generator) and rename the kit's token(s) to the standard name for that type.

Only placeholders that use the global map need a standardized token name. Everything else keeps whatever descriptive `<YOUR_...>` name reads best for the customer.

### Global map (current entries)

| Standard token | Shape | Resolves to |
|----------------|-------|-------------|
| `<YOUR_ACCOUNT_ID>` (`_2`, `_3`, ...) | 12 digits, distinct per index | `111111111111`, `222222222222`, ... |
| `<YOUR_CIDR_1>` (`_2`, ...) | IPv4 CIDR, distinct per index | `10.<n>.0.0/16` |
| `<YOUR_KMS_ARN>` (`_2`, ...) | KMS key ARN | `arn:test-partition:kms:test-region:111111111111:key/test-key-<n>` |
| `<YOUR_SECRET_ARN>` (`_2`, ...) | Secrets Manager ARN | `arn:test-partition:secretsmanager:test-region:111111111111:secret:test-secret-<n>` |
| `<YOUR_HOUR>` (`_2`, ...) | hour of day (0-23) | `0`, `1`, ... |
| `<YOUR_INT>` (`_2`, ...) | integer | `1`, `2`, ... |
| `<YOUR_BEDROCK_MODEL_ID>` (`_2`, `_3`, ...) | Bedrock foundation model id | `anthropic.claude-3-5-sonnet-20240620-v1:0`, ... |

A numeric suffix denotes a **distinct instance of the same type**; the harness hands out distinct values per index. Reuse the same token in two places when both must resolve to the **same** value. The semantic role of a value (which team/account) lives in the YAML key and `# TODO:` comment, not the token.

### Rules

- A placeholder whose auto-generated `test-*` value synthesizes correctly needs no change — leave its descriptive name as-is.
- A placeholder that requires a shape must use the standard token for its type from the global map. If no entry exists for that shape, add one to the harness rather than inventing a one-off.
- The Starter Kit Quality review flags a placeholder only when it is a **known shape type used with a non-standard token** (e.g. a value interpolated into an ARN/CIDR/cron that isn't using the mapped token), not every non-standard `<YOUR_...>`.

## Environment-Specific Values as Top-Level Context

All environment-specific configuration values (account IDs, VPC IDs, subnet IDs, domain names, region overrides, etc.) must be exposed as top-level `context` entries in `mdaa.yaml` and referenced from module configs via `{{context:<key>}}` template variables. Customers should only need to edit `mdaa.yaml` (plus reviewing CDK Nag suppressions) before their first deployment.

### Rationale

A customer's first deployment should require touching exactly one file for environment setup: `mdaa.yaml`. Scattering environment-specific values across multiple module config files forces customers to understand the kit's internal structure before they can deploy — that's unnecessary friction.

### Rules

- **Every environment-specific value** (AWS account IDs, VPC IDs, subnet IDs, security group IDs, domain names, hosted zone IDs, certificate ARNs, SSO instance ARNs, external resource ARNs) must be a `context` entry in `mdaa.yaml` with a `<YOUR_...>` placeholder and a `# TODO:` comment.
- **Module config files** must reference these values via `'{{context:<key>}}'` rather than containing their own placeholders. Module configs should be deployable as-is once `mdaa.yaml` context is filled in.
- **The only reason a customer should open a module config file** before first deployment is to review and uncomment CDK Nag suppressions. All other customization is optional and post-deployment.
- **Context key naming**: use `snake_case`, descriptive names that make sense without reading the module config. Examples: `vpc_id`, `deployment_account`, `data_account`, `subnet_ids`, `domain_name`.
- **Group related context values** with comments in `mdaa.yaml`:
  ```yaml
  context:
    # TODO: Set the 12-digit AWS account ID where this kit will be deployed
    deployment_account: <YOUR_ACCOUNT_ID>
    # TODO: Set the AWS region for deployment (e.g., us-east-1)
    deployment_region: <YOUR_REGION>
    # TODO: Set your VPC ID (must exist in the deployment account/region)
    vpc_id: <YOUR_VPC_ID>
  ```

### What belongs in context vs. module configs

| Belongs in `mdaa.yaml` context | Stays in module config |
|---|---|
| AWS account IDs | Module-specific feature toggles |
| VPC/subnet/security group IDs | Resource sizing (instance types, storage) |
| Domain names, hosted zone IDs | Naming patterns and prefixes |
| Certificate ARNs | Access control lists (team names, roles) |
| SSO/IdC instance ARNs | Data pipeline definitions |
| External resource ARNs (existing buckets, KMS keys) | Module-internal wiring |
| Region overrides | CDK Nag suppressions |

### Anti-patterns

- **Placeholder in a module config file**: If a customer must edit `datalake/buckets.yaml` to set a VPC ID before deploying, that's a bug. Move it to context.
- **Duplicated values across configs**: If the same account ID appears in three module configs, it should be a single context entry referenced three times via `{{context:account_id}}`.
- **Undocumented context dependencies**: If a module config uses `{{context:foo}}` but `mdaa.yaml` doesn't define `foo` with a TODO, the deployment will fail with a cryptic error.

## Troubleshooting Section

Every starter kit README must end with a Troubleshooting section containing kit-specific deployment issues:

```markdown
## Troubleshooting

1. **Issue description**: Explanation and solution.
```

## USAGE.md Standards

Every starter kit must have a `USAGE.md` (at the kit root or in `docs/`) that prepares and orients the customer to use the deployed system. The README links to USAGE.md from the "Next Steps" section.

### Required Structure

1. **Title** — `# Usage`
2. **Deployed Resources** — "Once deployed, you should see the following in your AWS account(s):" followed by a brief note about the naming conventions, then a table of key resources:

   Convention notes (include above the table):
   ```
   **Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

   **SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`
   ```

   Table format:

   | Resource | Deployed Name / SSM Path | Config Reference |
   |----------|--------------------------|------------------|
   | S3 Bucket | `<org>-<env>-<domain>-datalake-raw`<br>`/<org>/<domain>/datalake/bucket/raw/name` | `buckets.raw` in [`datalake/datalake.yaml`](datalake/datalake.yaml) |
   | IAM Role | `<org>-<env>-<domain>-roles-data-admin`<br>`/<org>/<domain>/generated-role/data-admin/id` | `generateRoles.data-admin` in [`roles.yaml`](roles.yaml) |

   Only list key resources that the customer will directly use to achieve the kit's intended capabilities. Do not list every CloudFormation resource — focus on what the customer interacts with.

   Format notes:
   - Deployed Name and SSM Path share a column, separated by `<br>`
   - Config Reference uses `section.key` dot notation and links to the file
   - SSM paths use the format `/<org>/<domain>/<module>/<resource-type>/<config-name>/<attribute>`
   - For resources automatically created by a module (not directly configurable), use "deployed by [`<file>`](<file>)"<br>"*(not configurable)*" as the Config Reference

3. **Post-Deployment Steps** — Actionable steps to start using the system (upload data, trigger a pipeline, open a console, assume a role). Each step should be specific enough that a first-time user can follow without guessing.

4. **Additional sections as needed** — Troubleshooting (if kit-specific runtime issues exist), Testing/Verification (how to confirm the deployment is working), Customization (how to extend beyond the default deployment).

### Quality Bar

- A customer who just ran `npx @aws-mdaa/cli deploy` should be able to read USAGE.md and immediately know: what got deployed, where to find it, and what to do next.
- Include naming patterns or SSM parameter paths so customers can locate their resources without searching the console.
- If the kit deploys IAM roles that customers assume, explain which role to use for which activity.
- If the kit depends on manual triggers (start a crawler, start a replication task, upload documents), say that explicitly with the service and console path.

### What does NOT belong in USAGE.md

- Deployment instructions (that's README.md)
- Config file documentation (that's inline comments + schema)
- Architecture deep-dives (that's docs/ or the README Capabilities section)
- Generic AWS service tutorials

## Link and Reference Validation

**Note:** Grammar, spelling, and general link validity in markdown prose are handled by the Documentation Quality agent. This agent checks only structural file references that would cause deployment failures or dead ends for customers.

### Config File References

- `mdaa.yaml` module config paths (e.g., `config_path: ./datalake/buckets.yaml`) must point to files that exist within the kit directory
- Schema directive paths (`# yaml-language-server: $schema=../../schemas/...`) must reference schema files that exist in the repo
- Any file path in YAML configs that the CLI will attempt to load must be valid

### Cross-File Consistency

- If `mdaa.yaml` references module config files, those files must exist in the kit
- If a USAGE.md is referenced in Next Steps, it must exist in the kit directory
- README references to config files (e.g., "Address TODOs in [`roles.yaml`](roles.yaml)") must point to files that exist — these are structural references that guide the deployment workflow

### SSM Cross-Module Reference Integrity

Module configs frequently consume values produced by other modules via SSM references (`ssm-org:`, `ssm-domain:`, `{{resolve:ssm:...}}`, `domainConfigSSMParam`, `generated-role-id:`). See the SSM cross-module reference integrity rules in [config-authoring.md](config-authoring.md) for the full standard.

For each such reference in a kit's module configs, verify a producer exists:

- The `<domain>/<module>` segments of an `ssm-org:` path (e.g. `/<org>/ent-data/smus-dom/...`) must map to a module actually deployed in that domain in this kit's `mdaa.yaml`.
- `ssm-domain:` and `generated-role-id:` references must resolve to a module/role produced within the same domain.
- Cross-account ARN-form references must name an account where the producing module is deployed (via `additional_accounts`/`additional_stacks` or a separate domain/env).

A dangling SSM reference passes config schema validation but fails at synth (missing context) or deploy (parameter not found) — a customer dead end. Best-effort: flag references whose producer cannot be located among the kit's modules. When the producer mapping is ambiguous from the YAML alone, do not flag — the synth-time diff baseline tests are the authoritative gate.

## Customer Experience Standards

Starter kits are the first thing a customer touches. Every friction point — a confusing instruction, a missing file, an unclear error — erodes trust. Review with the mindset: "Could a data engineer who has never seen MDAA before deploy this in under 30 minutes by following the README alone?"

### Zero Ambiguity

- Every step in the deployment section must be actionable without external context. If a step says "configure your VPC", it must say where and how (which file, which property, what format).
- TODOs in config files must tell the customer exactly what to provide, not just that something needs to change. Bad: `# TODO: Set account`. Good: `# TODO: Set the 12-digit AWS account ID where this kit will be deployed`.
- If a prerequisite requires another AWS service to be set up first (e.g., IAM Identity Center, a VPC), state that explicitly with a link to relevant AWS documentation or MDAA docs.

### No Dead Ends

- Every config file referenced in the README must exist. A customer following the README should never encounter "file not found".
- Every module referenced in `mdaa.yaml` must have its config file present in the kit. A customer should never get a deployment error because a referenced config is missing.
- If the kit depends on outputs from another kit or external infrastructure, document what those outputs are and how to obtain them.

### Minimal Steps to Deploy

- The deployment path should be: authenticate → address TODOs → deploy. No hidden steps.
- If a kit requires more than 5 TODOs to be addressed, consider whether defaults can reduce that number.
- Config files should work out of the box for a demo/test deployment with only the organization name and account-specific values changed. Customers should not need to understand the full config schema to get a first deployment running.

### Clear Error Recovery

- The Troubleshooting section must cover the most common deployment failures for this specific kit (not generic CDK errors).
- If a module has known prerequisites that cause cryptic errors when missing (e.g., VPC not found, KMS key not accessible), document the symptom and fix.

## Test Harness and Affected Detection

All starter kits live in a single npm/nx package, `@aws-mdaa/starter-kits`, rooted at `starter_kits/`. Individual kits are **not** separate packages — each kit is just a directory of configuration (`mdaa.yaml` + module config files). This avoids having to mirror each kit's `mdaa.yaml` module list into a per-kit `package.json` (a sync burden and a silent-coverage-gap risk).

### How tests are triggered

The runner (`scripts/test/test_starter_kit.py`) iterates kits (or one kit, via `--kit`) and self-filters to only the modules affected by the change:

1. Developer changes `@aws-mdaa/roles` (or any transitive dependency).
2. **CI**: a generator job (`feature_merge_starter_kit_generate`) runs `scripts/ci/generate_starter_kit_jobs.py`, which discovers the kits (via `--list-kits`) and emits a child pipeline with one job per kit (`sk_<kit>`). The `feature_merge_starter_kit_test` job triggers that child pipeline (`strategy: depend`), so each kit runs as an independent, parallel, isolated CI job. **Locally**: `test_repo.sh` routes kits through `test_starter_kits_repo.sh` (all kits in one process), never `nx affected`.
3. Each kit job runs the runner scoped to that kit (`--kit <name>`). The runner computes the affected package set **once** via `nx show projects --affected`, then intersects it with the kit's `mdaa.yaml` `module_path` values.
4. Only the affected modules' synth baselines run, scoped to that kit's diff test file. Unaffected kits self-skip in a second or two.

Because the affected set comes from the live nx package graph (not a hand-maintained list), transitive upstream changes are detected automatically and there is no per-kit dependency list to keep in sync. Because the per-kit CI job list is **generated** from the kit directories (not hand-written), adding or removing a kit needs no CI edit — and there is no drift between "kits that exist" and "kits with a CI job".

### Rules

- A kit is a subdirectory of `starter_kits/` containing an `mdaa.yaml`. No per-kit `package.json` or `jest.config.js`.
- Each kit's diff test file lives at `starter_kits/test/<kit>/<kit>.diff.test.ts`; its baselines live at `starter_kits/test/<kit>/baselines/`.
- Every module declared in a kit's `mdaa.yaml` must have a corresponding `baselineModuleSynth('<kit>', '<domain>', '<module>', ...)` call in that kit's diff test file. The harness fails the build if a changed module has no test (it would otherwise pass green via `--passWithNoTests`).
- The single `starter_kits/package.json` declares only fixed dev dependencies (`@aws-mdaa/cli`, `@aws-mdaa/testing`, and the jest/ts toolchain) — never per-module deps. `@aws-mdaa/cli` and `@aws-mdaa/testing` are required so nx builds the CLI entrypoint and the compiled harness before the kit tests run.
- After modifying `starter_kits/package.json`, run `npm install --package-lock-only` from the repo root and commit the lockfile update.
- The per-kit CI jobs are generated, not hand-written. Do not add static `sk_<kit>` jobs to `.gitlab-ci.yml`; the generator derives them from the kit directories.

## CI Agent Usage

This section is used by the automated Starter Kit Quality CI agent. When invoked by the agent,
Kiro receives the README, mdaa.yaml, roles config, and all YAML files for a single starter kit,
and must produce structured JSON findings.

### JSON Output Schema

Write findings to `{output_file}` as a JSON object. No preamble, no markdown fences, no explanation
outside the JSON. The file must contain ONLY valid JSON.

```json
{
  "overall_risk": "HIGH | MEDIUM | LOW",
  "summary": "One paragraph summarizing the starter kit's quality posture.",
  "findings": [
    {
      "risk": "HIGH | MEDIUM | LOW",
      "category": "readme_structure | deployment_section | cdk_nag | schema_validation | config_placeholders | context_exposure | config_comments | usage_quality | troubleshooting | cli_usage | broken_references | ssm_reference_integrity | customer_friction",
      "file": "path/to/file",
      "detail": "What's wrong and what should be done."
    }
  ]
}
```

### Severity Classification

- **HIGH:** Missing README sections (Title, Description, Deployment, Modules Deployed), YAML config file missing `# yaml-language-server: $schema=` directive on line 1, schema directive referencing a schema file that does not exist in the repo, CDK Nag suppressions with generic/empty reasons, missing TODO for organization in mdaa.yaml, placeholder values without `<YOUR_...>` pattern, config files referenced in mdaa.yaml that don't exist in the kit, environment-specific values (account IDs, VPC IDs, subnet IDs) hardcoded or placed as placeholders in module config files instead of mdaa.yaml context, CDK Nag suppressions that should be commented out for customer review but are uncommented, missing USAGE.md entirely (no post-deployment guidance for customers), SSM cross-module reference (`ssm-org:`, `ssm-domain:`, `domainConfigSSMParam`, `{{resolve:ssm:...}}`, `generated-role-id:`) whose producing module/path cannot be located among the kit's deployed modules (dangling reference — passes schema validation but fails at synth/deploy)
- **MEDIUM:** README sections out of order, deployment section missing subsections, CDK Nag suppressions not placed first under parent, missing Troubleshooting section, CLI commands not using `npx @aws-mdaa/cli`, README contains prohibited content (directory listings, config descriptions, deep-dives), ambiguous TODOs that don't tell the customer what to provide, deployment steps that require undocumented prerequisites, context values used in module configs via `{{context:key}}` but not defined in mdaa.yaml, duplicated environment values across multiple config files that should be a single context entry, README content that contradicts the actual config (e.g., claims a resource exists that isn't configured), CDK Nag suppression reasons that are factually incorrect (reference policies not attached), customer-decision properties with no preceding comment where the purpose is non-obvious, USAGE.md exists but is a stub (no deployed resources orientation or only generic instructions like "launch the console")
- **LOW:** Minor formatting issues, missing shortcut link, missing architecture image, Troubleshooting section empty but present, opportunities to reduce customer friction (e.g., too many TODOs, steps that could have defaults), context key naming that is unclear without reading module docs

### Rules for CI Agent Findings

- One finding per quality concern. Group related issues (e.g., multiple missing README sections) into one finding.
- Every finding must include `file` pointing to the file with the issue.
- Only flag issues related to files that were CHANGED in this MR. Do not flag pre-existing quality gaps in unchanged files.
- Do NOT create findings that conclude "no action required" or "acceptable for this kit". If analysis determines the standard doesn't apply to this kit, there is no finding — skip it entirely.
- Only flag a gap if it would actually cause customer confusion or deployment failure. If the kit legitimately doesn't need a particular element (e.g., no context values means no context section needed), that is not a finding.
- Do NOT flag formatting issues (blank lines, trailing newlines, extra whitespace). These are linter concerns, not quality concerns.
- Do NOT flag standard MDAA structural keys (trustedPrincipal, generatedPolicies, awsManagedPolicies, module_path, module_configs, policyDocument, Statement, Effect, Action, Resource) for missing comments. These are framework boilerplate understood by the schema.
- Missing comments are only HIGH if the property represents a customer decision that cannot be understood without documentation. Standard patterns repeated from earlier in the same file do not need re-documenting.
- Order findings: HIGH first, then MEDIUM, then LOW.
- Use only ASCII characters in all string values.
