# Usage

## Deployed Resources

Once deployed, you should see the following in your AWS account:

**Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

**SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| S3 Bucket | `<org>-dev-shared-datalake-raw`<br>`/<org>/shared/datalake/bucket/raw/name` | `buckets.raw` in [`datalake/datalake.yaml`](datalake/datalake.yaml) |
| S3 Bucket | `<org>-dev-shared-datalake-transformed`<br>`/<org>/shared/datalake/bucket/transformed/name` | `buckets.transformed` in [`datalake/datalake.yaml`](datalake/datalake.yaml) |
| SageMaker Studio Domain | `<org>-dev-datascience-example-team`<br>`/<org>/datascience/example-team/domain/example-team/name` | `example-team` in [`datascience/datascience-team.yaml`](datascience/datascience-team.yaml) |
| Athena Workgroup | `<org>-dev-shared-athena`<br>`/<org>/shared/athena/workgroup/name` | configured in [`datalake/athena.yaml`](datalake/athena.yaml) |
| Glue Crawler | `<org>-dev-dataops-example-crawler-crawler1`<br>`/<org>/dataops/example-crawler/crawler/example-crawler/name` | `crawlers.crawler1` in [`dataops/crawler.yaml`](dataops/crawler.yaml) |
| Glue Database | `<org>-dev-dataops-example-project-sample-database`<br>`/<org>/dataops/example-project/database/name` | `databases.sample-database` in [`dataops/project.yaml`](dataops/project.yaml) |
| IAM Role | `<org>-dev-shared-roles-data-admin`<br>`/<org>/shared/generated-role/data-admin/id` | `generateRoles.data-admin` in [`roles.yaml`](roles.yaml) |
| IAM Role | `<org>-dev-shared-roles-data-user`<br>`/<org>/shared/generated-role/data-user/id` | `generateRoles.data-user` in [`roles.yaml`](roles.yaml) |
| IAM Role | `<org>-dev-shared-roles-data-scientist`<br>`/<org>/shared/generated-role/data-scientist/id` | `generateRoles.data-scientist` in [`roles.yaml`](roles.yaml) |
| IAM Role | `<org>-dev-shared-roles-glue-etl`<br>`/<org>/shared/generated-role/glue-etl/id` | `generateRoles.glue-etl` in [`roles.yaml`](roles.yaml) |
| IAM Role | `<org>-dev-datascience-roles-team-execution`<br>`/<org>/datascience/generated-role/team-execution/id` | `generateRoles.team-execution` in [`roles.yaml`](roles.yaml) (datascience domain) |

## Post-Deployment Steps

### Upload Sample Data

1. Check [DATASETS.md](DATASETS.md) to create a `sample_data` folder with test CSV files.
2. Assume the `<org>-dev-shared-roles-data-admin` role (only this role has write access to data lake buckets).
3. Upload sample data to the transformed bucket:
   ```bash
   aws s3 cp ./sample_data s3://<org>-dev-shared-datalake-transformed/data/sample_data --recursive
   ```

### Catalog Data

1. Navigate to the AWS Glue Console and trigger the deployed Glue Crawler.
2. Monitor CloudWatch Logs to confirm tables were created successfully.

### Query Data via Athena

1. Assume the `<org>-dev-shared-roles-data-user` role.
2. Open the Amazon Athena Query Editor.
3. Select the MDAA-deployed Workgroup from the workgroup dropdown.
4. Query tables under the MDAA-created Database.

### Launch SageMaker Studio

1. Assume the `<org>-dev-shared-roles-data-scientist` role.
2. Navigate to the SageMaker AI Domain console.
3. Launch the user profile matching your role session name or userid.
4. SageMaker Studio will open with notebooks and kernels ready to use.
