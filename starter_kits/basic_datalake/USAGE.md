# Usage

## Deployed Resources

Once deployed, you should see the following in your AWS account:

**Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

**SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| S3 Bucket | `<org>-dev-shared-datalake-raw`<br>`/<org>/shared/datalake/bucket/raw/name` | `buckets.raw` in [`datalake/datalake.yaml`](datalake/datalake.yaml) |
| S3 Bucket | `<org>-dev-shared-datalake-transformed`<br>`/<org>/shared/datalake/bucket/transformed/name` | `buckets.transformed` in [`datalake/datalake.yaml`](datalake/datalake.yaml) |
| Glue Crawler | `<org>-dev-dataops-example-crawler-crawler1`<br>`/<org>/dataops/dataops-crawler/crawler/example-crawler/name` | `crawlers.crawler1` in [`dataops/crawler.yaml`](dataops/crawler.yaml) |
| Glue Database | `<org>-dev-dataops-example-project-sample-database`<br>`/<org>/dataops/dataops-project/database/name` | `projectName` in [`dataops/project.yaml`](dataops/project.yaml) |
| Athena Workgroup | `<org>-dev-shared-athena`<br>`/<org>/shared/athena/workgroup/name` | configured in [`datalake/athena.yaml`](datalake/athena.yaml) |
| IAM Role | `<org>-dev-shared-roles-data-admin`<br>`/<org>/shared/generated-role/data-admin/id` | `generateRoles.data-admin` in [`roles.yaml`](roles.yaml) |
| IAM Role | `<org>-dev-shared-roles-data-user`<br>`/<org>/shared/generated-role/data-user/id` | `generateRoles.data-user` in [`roles.yaml`](roles.yaml) |
| IAM Role | `<org>-dev-shared-roles-glue-etl`<br>`/<org>/shared/generated-role/glue-etl/id` | `generateRoles.glue-etl` in [`roles.yaml`](roles.yaml) |

## Post-Deployment Steps

### Upload Data

1. Assume the `<org>-dev-shared-roles-data-admin` role (via AWS CLI `sts assume-role` or console role switching).
2. Upload data files to the raw data bucket.
   - Use SSM Parameter Store to find exact bucket names: `/<org>/shared/datalake/bucket/<bucket-name>/name`
3. See [DATASETS.md](DATASETS.md) for sample data you can use for testing.

### Catalog Data

1. Open the AWS Glue Console and run the deployed Glue Crawler to catalog uploaded data.
2. After the crawler completes, tables will appear in the Glue Data Catalog.

### Query Data

1. Assume the `<org>-dev-shared-roles-data-user` role.
2. Open the Amazon Athena Console and select the deployed workgroup.
3. Query the cataloged tables using standard SQL.
