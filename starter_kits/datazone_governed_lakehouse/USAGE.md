# Usage

## Deployed Resources

Once deployed, you should see the following in your AWS account:

**Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

**SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| Audit S3 Bucket | `<org>-dev-govern1-audit-audit`<br>`/<org>/govern1/audit/bucket/name` | deployed by [`common/governance/audit.yaml`](common/governance/audit.yaml) |
| Audit KMS Key | `<org>-dev-govern1-audit-audit`<br>`/<org>/govern1/audit/kms/arn` | deployed by [`common/governance/audit.yaml`](common/governance/audit.yaml) |
| CloudTrail Trail | `<org>-dev-govern1-audit-trail-s3-audit` | `trails.s3-audit` in [`common/governance/audit-trail.yaml`](common/governance/audit-trail.yaml) |
| DataZone Domain | `<org>-dev-govern1-datazone-domain1`<br>`/<org>/govern1/datazone/domain/domain1/name` | `domains.domain1` in [`domain1/governance/datazone.yaml`](domain1/governance/datazone.yaml) |
| S3 Bucket | `<org>-dev-data1-datalake-raw`<br>`/<org>/data1/datalake/bucket/raw/name` | `buckets.raw` in [`domain1/data/datalake.yaml`](domain1/data/datalake.yaml) |
| S3 Bucket | `<org>-dev-data1-datalake-transformed`<br>`/<org>/data1/datalake/bucket/transformed/name` | `buckets.transformed` in [`domain1/data/datalake.yaml`](domain1/data/datalake.yaml) |
| S3 Bucket | `<org>-dev-data1-datalake-curated`<br>`/<org>/data1/datalake/bucket/curated/name` | `buckets.curated` in [`domain1/data/datalake.yaml`](domain1/data/datalake.yaml) |
| Glue Database | `<org>-dev-dataops1-project1-sample-database1`<br>`/<org>/dataops1/project1/database/name` | `databases.sample-database1` in [`domain1/dataops/project1.yaml`](domain1/dataops/project1.yaml) |
| Glue Crawler | `<org>-dev-dataops1-crawler1-crawler1`<br>`/<org>/dataops1/crawler1/crawler/crawler1/name` | `crawlers.crawler1` in [`domain1/dataops/crawler1.yaml`](domain1/dataops/crawler1.yaml) |
| IAM Role | `<org>-dev-govern1-roles-data-admin`<br>`/<org>/govern1/generated-role/data-admin/id` | `generateRoles.data-admin` in [`common/governance/roles.yaml`](common/governance/roles.yaml) |
| IAM Role | `<org>-dev-govern1-roles-data-engineer`<br>`/<org>/govern1/generated-role/data-engineer/id` | `generateRoles.data-engineer` in [`common/governance/roles.yaml`](common/governance/roles.yaml) |
| IAM Role | `<org>-dev-govern1-roles-data-user1`<br>`/<org>/govern1/generated-role/data-user1/id` | `generateRoles.data-user1` in [`common/governance/roles.yaml`](common/governance/roles.yaml) |
| IAM Role | `<org>-dev-govern1-roles-data-user2`<br>`/<org>/govern1/generated-role/data-user2/id` | `generateRoles.data-user2` in [`common/governance/roles.yaml`](common/governance/roles.yaml) |
| IAM Role | `<org>-dev-govern1-roles-data-user3`<br>`/<org>/govern1/generated-role/data-user3/id` | `generateRoles.data-user3` in [`common/governance/roles.yaml`](common/governance/roles.yaml) |

## Post-Deployment Steps

### Upload Data

Only the `<org>-dev-govern1-roles-data-admin` role has write access to data lake buckets. All other roles are denied write operations.

1. Assume the data-admin role:
   ```bash
   aws sts assume-role --role-arn arn:aws:iam::<account>:role/<org>-dev-govern1-roles-data-admin --role-session-name admin-session
   ```

2. Upload data to the appropriate zone bucket. Bucket naming pattern: `<org>-dev-data1-datalake-<zone>`

   | Zone | Bucket Pattern | Purpose |
   |------|---------------|---------|
   | Raw | `<org>-dev-data1-datalake-raw` | Unprocessed source data |
   | Transformed | `<org>-dev-data1-datalake-transformed` | Cleaned and normalized data |
   | Curated | `<org>-dev-data1-datalake-curated` | Business-ready analytical data |

3. Upload with KMS encryption:
   ```bash
   aws s3 cp ./sample_data s3://<org>-dev-data1-datalake-transformed/data/sample_database1/ \
     --recursive --sse aws:kms --sse-kms-key-id <kms-key-id>
   ```

   Find the KMS key ARN via SSM Parameter Store: `/<org>/data1/datalake/kms/arn`

### Catalog Data

1. Assume the `<org>-dev-govern1-roles-data-admin` role and navigate to **AWS Glue Console** > **Crawlers** > select `<org>-dev-dataops1-crawler1-crawler1`.
2. Trigger the crawler and monitor CloudWatch Logs to confirm tables were created.
3. Verify tables appear under the `<org>-dev-dataops1-project1-sample-database1` Glue database.

### Access Data via DataZone

1. Assume a data-user role (e.g., `<org>-dev-govern1-roles-data-user1`, `<org>-dev-govern1-roles-data-user2`, `<org>-dev-govern1-roles-data-user3`).
2. Navigate to **Amazon DataZone Console** > **Domains** > select your domain > **Open data portal**.
3. Discover published data products, create subscriptions, and consume data.

## Troubleshooting

1. **Access Denied when uploading**: Ensure you are using the `<org>-dev-govern1-roles-data-admin` role. Other roles do not have write permissions to the data lake buckets.

2. **DataZone domain not accessible**: Verify the IAM Identity Center users or groups listed in the DataZone configuration match your SSO identity. Check that the domain deployment completed successfully in CloudFormation.

3. **Glue Crawler failures**: Check CloudWatch Logs for the crawler execution. Common causes include missing LakeFormation permissions on the target S3 location or KMS key access issues.
