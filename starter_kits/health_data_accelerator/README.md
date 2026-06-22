# Health Data Accelerator (HDA)

This starter kit deploys a healthcare-focused data lake with automated data ingestion pipelines using AWS Database Migration Service (DMS), Glue ETL, Lambda, and Step Functions. It provides end-to-end data processing from source relational databases through staging, transformation, and curation layers.

> **[Deployment Instructions](#deployment)**

## Use Cases

- Healthcare data lake for clinical, operational, and research data
- Automated CDC (Change Data Capture) ingestion from relational databases via DMS
- Multi-stage data transformation pipelines (raw → transformed → curated)
- Batch file processing with configurable scheduling
- Data quality validation and monitoring for healthcare compliance

## Capabilities

- DMS replication from source databases with table-level mapping control
- Three-zone S3 data lake (raw, transformed, curated) with KMS encryption
- Glue ETL jobs for data transformation (file processing, surveys, vitals)
- Lambda-based file management and batch generation
- Step Functions orchestration for multi-step processing workflows
- DynamoDB tables for pipeline state and configuration management
- EventBridge-scheduled triggers for automated pipeline execution
- Athena workgroup for ad-hoc querying of curated data
- CloudTrail audit trail for compliance

## Architecture

![HDA](docs/hda.png)

## Deployment

### Prerequisites and Predeployment

1. Authenticate to your target AWS account and region. Ensure the authenticated role has permissions to deploy resources via CDK.
2. [Bootstrap CDK](../../PREDEPLOYMENT.md#single-account-bootstrap) in your target account and region.
3. Provision a VPC with at least 2 private subnets (required for DMS replication instances). Subnets must have connectivity to:
   - The source database (network path from DMS replication instance to source DB)
   - AWS service endpoints, either via NAT Gateway or VPC Endpoints for:
     - S3
     - Glue
     - DynamoDB
     - Lambda
     - Step Functions
     - Secrets Manager
     - CloudWatch Logs

4. Prepare the source database:
   - Create an AWS Secrets Manager secret containing the source database credentials
   - Note the KMS key ARN used to encrypt the secret

Additional info: [PREDEPLOYMENT](../../PREDEPLOYMENT.md)

### Configure MDAA

1. Address all TODOs in [`mdaa.yaml`](mdaa.yaml), specifically:
   - Set `organization` to a globally unique name
   - Set `context` values:
     - `dms-source-db` — source relational database name
     - `dms-rds-secrets-arn` — ARN of the Secrets Manager secret with DB credentials
     - `dms-rds-secrets-kms-arn` — ARN of the KMS key encrypting the secret
     - `vpc_id` — VPC ID with connectivity to the source database
     - `subnet_id1`, `subnet_id2` — private subnet IDs for DMS instances
     - `file_processor_event_bridge_trigger_hour` — hour for file processor schedule
     - `file_processor_event_bridge_trigger_rate` — days between file processing runs
     - `transformation_event_bridge_trigger_hour` — hour for transformation schedule
     - `transformation_event_bridge_trigger_rate` — days between transformation runs
   - Update `dataops/dms.yaml` if you need to change the DMS instance class for your workload (default: `dms.c5.large`)

2. Review and update [`dataops/scripts/table_config.json`](dataops/scripts/table_config.json) with your source database table definitions. This file is loaded into DynamoDB automatically during deploy (predeploy hook on `dms-shared`) and controls DMS task table mappings.

3. Address all TODOs in module configs, specifically:
   - CDK Nag suppressions in [`roles.yaml`](roles.yaml) and [`dataops/roles.yaml`](dataops/roles.yaml). Uncomment each suppression only after reviewing the associated permissions and confirming they are acceptable for your environment.

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
| `@aws-mdaa/roles` | IAM roles for data lake and dataops personas |
| `@aws-mdaa/datalake` | KMS keys, S3 buckets, and bucket policies |
| `@aws-mdaa/lakeformation-settings` | Lake Formation settings (account-level) |
| `@aws-mdaa/athena-workgroup` | Athena workgroup for querying |
| `@aws-mdaa/audit` | S3 audit bucket for CloudTrail |
| `@aws-mdaa/audit-trail` | CloudTrail audit trail |
| `@aws-mdaa/glue-catalog` | Glue Catalog KMS encryption (account-level) |
| `@aws-mdaa/dataops-project` | Glue databases with access control |
| `@aws-mdaa/dataops-dynamodb` | DynamoDB tables for pipeline state |
| `@aws-mdaa/dataops-job` | Glue ETL jobs |
| `@aws-mdaa/dataops-lambda` | Lambda functions (file manager, batch generator) |
| `@aws-mdaa/dataops-stepfunction` | Step Functions workflows |
| `@aws-mdaa/dataops-dms` | DMS replication instances and tasks |

## Troubleshooting

### Common Issues

1. **Invalid ReplicationInstance class error during DMS deployment**:
   - The DMS instance class may not be available in your region
   - Check available classes: `aws dms describe-orderable-replication-instances --region <region> --query "OrderableReplicationInstances[].ReplicationInstanceClass" --output text`
   - Update `instanceClass` in [`dataops/dms.yaml`](dataops/dms.yaml) (`dms.c5.large` is widely available)

2. **DMS source endpoint connection failure**:
   - Verify the source database allows connections from the DMS VPC/subnets
   - Check that the Secrets Manager secret ARN and KMS key ARN are correct
   - Ensure the DMS role has permissions to access the secret

3. **Step function execution failures**:
   - Check CloudWatch logs for the specific Lambda or Glue job that failed
   - Verify DynamoDB tables are populated (see `dataops/scripts/`)
   - Ensure IAM roles have necessary permissions
