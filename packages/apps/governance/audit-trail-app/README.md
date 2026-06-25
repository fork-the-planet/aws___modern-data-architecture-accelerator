# CloudTrail Trails

> **Note:** This documentation is also available in a rendered format [here](https://aws.github.io/modern-data-architecture-accelerator/packages/apps/governance/audit-trail-app/index.html).

Deploys CloudTrail trails for S3 data events with KMS-encrypted log delivery to an existing audit bucket. Optionally includes management events. Use this module when you need to track who accessed or modified objects in your S3 buckets for security auditing and compliance requirements.

---

## Deployed Resources

This module deploys and integrates the following resources:

**CloudTrail Audit Trail** - CloudTrail containing S3 Data Events configured to write to an audit bucket.

![AuditTrail](../../../constructs/L3/governance/audit-trail-l3-construct/docs/AuditTrail.png)

---

## Related Modules

- [Audit](../audit-app/README.md) — Deploy the audit S3 bucket and KMS key that this trail writes to
- [Data Lake](../../datalake/datalake-app/README.md) — Enable S3 data event logging for data lake bucket access auditing
- [Lake Formation Settings](../lakeformation-settings-app/README.md) — Configure Lake Formation admin roles whose actions are captured by CloudTrail

---

## Security/Compliance Details

This module is designed in alignment with MDAA security/compliance principles and CDK nag rulesets. Additional review is recommended prior to production deployment, ensuring organization-specific compliance requirements are met.

- **Encryption at Rest**:
  - Trail logs encrypted with existing audit KMS key referenced via SSM parameter

---

## Configuration

### MDAA Config

Add the following snippet to your mdaa.yaml under the `modules:` section of a domain/env in order to use this module:

```yaml
audit-trail: # Module Name can be customized
  module_path: '@aws-mdaa/audit-trail' # Must match module NPM package name
  module_configs:
    - ./audit-trail.yaml # Filename/path can be customized
```

### Module Config Samples and Variants

Copy the contents of the relevant sample config below into the `./audit-trail.yaml` file referenced in the MDAA config snippet above.

#### Minimal Configuration

Required properties only — a CloudTrail trail with audit bucket and KMS key references. Start here for a basic S3 data event trail writing to an existing audit bucket.

[sample-config-minimal.yaml](sample_configs/sample-config-minimal.yaml)

```yaml
# Contents available via above link
--8<-- "target/docs/packages/apps/governance/audit-trail-app/sample_configs/sample-config-minimal.yaml"
```

#### Comprehensive Configuration

Covers all available options including management events, scoped event selectors targeting specific buckets and prefixes, and multiple named trails via the `trails` property. Demonstrates both the legacy single `trail` and additional named `trails` coexisting in one config.

[sample-config-comprehensive.yaml](sample_configs/sample-config-comprehensive.yaml)

```yaml
# Contents available via above link
--8<-- "target/docs/packages/apps/governance/audit-trail-app/sample_configs/sample-config-comprehensive.yaml"
```

#### Trails Only

Uses only the `trails` property without the legacy `trail` — for deployments that exclusively use named trails without needing the default `s3-audit` trail.

[sample-config-trails-only.yaml](sample_configs/sample-config-trails-only.yaml)

```yaml
# Contents available via above link
--8<-- "target/docs/packages/apps/governance/audit-trail-app/sample_configs/sample-config-trails-only.yaml"
```

---

[Config Schema Docs](SCHEMA.md)
