# Usage

Once deployed, you should see the following in your AWS account. MDAA applies a consistent naming convention to every resource, so you can locate them in the console or by SSM parameter without searching.

**Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

**SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`

## Deployed Resources

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| Raw S3 bucket | `<org>-<env>-data-datalake-raw`<br>`/<org>/data/datalake/bucket/raw/name` | `buckets.raw` in [`data/datalake.yaml`](data/datalake.yaml) |
| Transformed S3 bucket | `<org>-<env>-data-datalake-transformed`<br>`/<org>/data/datalake/bucket/transformed/name` | `buckets.transformed` in [`data/datalake.yaml`](data/datalake.yaml) |
| Athena workgroup | `<org>-<env>-data-athena`<br>`/<org>/data/athena/bucket/name` (results bucket) | deployed by [`data/athena.yaml`](data/athena.yaml) |
| Redshift cluster | `<org>-<env>-data-redshift`<br>`/<org>/data/redshift/cluster/endpoint` | deployed by [`data/redshift.yaml`](data/redshift.yaml) |
| `data-admin` IAM role | `<org>-<env>-governance-roles-data-admin`<br>`/<org>/governance/generated-role/data-admin/id` | `generateRoles.data-admin` in [`governance/roles.yaml`](governance/roles.yaml) |
| `data-user` IAM role | `<org>-<env>-governance-roles-data-user`<br>`/<org>/governance/generated-role/data-user/id` | `generateRoles.data-user` in [`governance/roles.yaml`](governance/roles.yaml) |
| `glue-etl` IAM role | `<org>-<env>-governance-roles-glue-etl`<br>`/<org>/governance/generated-role/glue-etl/id` | `generateRoles.glue-etl` in [`governance/roles.yaml`](governance/roles.yaml) |
| Glue database | `sample-database`<br>deployed within `example-project` | `databases.sample-database` in [`dataops/project.yaml`](dataops/project.yaml) |
| Glue crawler | `<org>-<env>-dataops-example-crawler-crawler1` | `crawlers.crawler1` in [`dataops/crawler.yaml`](dataops/crawler.yaml) |
| QuickSight Athena data source | created in QuickSight (identity region) | deployed by [`consumption/quicksight-athena.yaml`](consumption/quicksight-athena.yaml) |
| QuickSight Redshift data source | created in QuickSight (identity region) | deployed by [`consumption/quicksight-redshift.yaml`](consumption/quicksight-redshift.yaml) |

## Which role to use

- **`data-admin`** — the only role with write access to the data lake. Assume it to upload data. All other roles (including existing account administrators) are denied write access.
- **`data-user`** — read access for querying via Athena. Assume it to run queries.
- **`glue-etl`** — service role assumed by Glue jobs and the crawler. You do not assume this directly.

## Post-Deployment Steps

### 1. Add your QuickSight users to a group

The deploy creates the `readers` and `authors` QuickSight groups and grants them access to the data sources and folders, but does not add any members — so the data sources stay invisible until you join a group. Add each BI user (including yourself) to `readers` (read-only) or `authors` (read/write):

```bash
aws quicksight create-group-membership \
  --aws-account-id <account-id> --namespace default \
  --group-name authors --member-name "<your-quicksight-username>" \
  --region <identity-region>
```

Resolve your QuickSight username with `aws quicksight list-users --aws-account-id <account-id> --namespace default --region <identity-region>`. The data sources then appear under **Datasets → New dataset → FROM EXISTING DATA SOURCES**.

### 2. Load sample data and run the pipeline

1. Follow [`DATASETS.md`](DATASETS.md) to create a `sample_data` folder with sample CSVs.
2. Assume the `data-admin` role (it has AssumeRole trust to the local account by default, and is the only role with data lake write access).
3. Upload the `sample_data` folder to `<transformed_bucket>/data/sample_data` (resolve the bucket name from `/<org>/data/datalake/bucket/transformed/name`).
4. In the Glue console, run the crawler (`<org>-<env>-dataops-example-crawler-crawler1`). On success, its CloudWatch logs show the tables that were created. (The `create_table.sh` postdeploy hook also performs this on first deploy.)

### 3. Query the data

1. Assume the `data-user` role (AssumeRole trust to the local account by default).
2. In the Athena Query Editor, select the MDAA-deployed workgroup from the dropdown.
3. The tables created by the crawler are available for query under the MDAA-created database.

## Troubleshooting

For QuickSight visibility, identity-region, and Redshift/Secrets Manager issues, see the [Troubleshooting section in the README](README.md#troubleshooting).
