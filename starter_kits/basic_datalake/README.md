# Basic Data Lake

This starter kit deploys a secure, encrypted S3-based data lake on AWS with coarse-grained access control, data cataloging, query capabilities, and audit logging. It provides a foundational data platform suitable for teams that need a governed storage layer without fine-grained column or row-level security.

> **[Deployment Instructions](#deployment)**

## Use Cases

- Centralized data storage for unstructured or semi-structured data (logs, documents, media)
- Data lake foundation for analytics pipelines that don't require fine-grained access control
- Secure landing zone for ingested data with encryption at rest and in transit
- Self-service data exploration via Athena for authorized users
- Audit and compliance tracking via CloudTrail integration

## Capabilities

- KMS-encrypted S3 buckets with enforced SSL-only access and public access blocking
- IAM-based access control with dedicated admin and user roles
- Glue Data Catalog with encrypted metadata store
- Athena workgroup for secure, isolated SQL queries
- Glue crawlers for automated schema discovery
- Data quality rules for validation
- CloudTrail audit trail with dedicated audit bucket
- Lake Formation settings for IAM-delegated access control

## Architecture

![Basic Datalake](docs/basic_datalake.png)

## Deployment

### Prerequisites and Predeployment

1. Authenticate to your target AWS account and region. Ensure the authenticated role has permissions to deploy resources via CDK.
2. [Bootstrap CDK](../../PREDEPLOYMENT.md#single-account-bootstrap) in your target account and region.

Additional info: [PREDEPLOYMENT](../../PREDEPLOYMENT.md)

### Configure MDAA

1. Address all TODOs in [`mdaa.yaml`](mdaa.yaml), specifically:
   - Set `organization` to a globally unique name (used in S3 bucket names and all resource prefixes)

2. Address all TODOs in module configs, specifically:
   - CDK Nag suppressions in [`roles.yaml`](roles.yaml). Uncomment each suppression only after reviewing the associated permissions and confirming they are acceptable for your environment.

### Deploy MDAA

Run the following from the starter kit directory (containing `mdaa.yaml`):

1. Optionally, run `npx @aws-mdaa/cli ls` to understand what stacks will be deployed.

2. Optionally, run `npx @aws-mdaa/cli synth` and review the produced templates.

3. Run `npx @aws-mdaa/cli deploy` to deploy all modules.

Additional info: [DEPLOYMENT](../../DEPLOYMENT.md)


## Next Steps

See [USAGE](USAGE.md) for post-deployment instructions.

## Modules Deployed

| Module | Purpose |
|--------|---------|
| `@aws-mdaa/roles` | IAM roles and policies (data-admin, data-user, glue-etl) |
| `@aws-mdaa/datalake` | KMS keys, S3 buckets, and bucket policies |
| `@aws-mdaa/glue-catalog` | Glue Catalog KMS encryption (account-level) |
| `@aws-mdaa/lakeformation-settings` | Lake Formation IAM delegation settings (account-level) |
| `@aws-mdaa/athena-workgroup` | Athena workgroup with KMS encryption |
| `@aws-mdaa/audit` | S3 audit bucket for CloudTrail/Inventory |
| `@aws-mdaa/audit-trail` | CloudTrail audit trail |
| `@aws-mdaa/dataops-project` | Glue databases with access control |
| `@aws-mdaa/dataops-crawler` | Glue crawlers for schema discovery |
| `@aws-mdaa/dataops-data-quality` | Data quality validation rules |

## Troubleshooting

1. **S3 bucket name conflict**: If deployment fails with `BucketAlreadyExists`, your `organization` value is not globally unique. Change it in `mdaa.yaml` and redeploy.

2. **Glue Crawler finds no tables**: Ensure data has been uploaded to the correct S3 prefix before running the crawler. Check CloudWatch logs for the crawler's execution details.

3. **Athena query returns Access Denied**: Verify you are using the correct IAM role (data-admin for write, data-user for read). Lake Formation permissions govern data access even if S3 bucket policy allows it.
