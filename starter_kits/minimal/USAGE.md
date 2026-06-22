# Usage

## Deployed Resources

Once deployed, you should see the following in your AWS account:

**Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

**SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| IAM Role | `<org>-dev-govern-roles-data-admin`<br>`/<org>/govern/generated-role/data-admin/id` | `generateRoles.data-admin` in [`govern/roles.yaml`](govern/roles.yaml) |
| Glue Catalog Encryption | Account-level setting | deployed by [`glue-catalog`](mdaa.yaml) module<br>*(not configurable)* |
| LakeFormation Data Lake Settings | Account-level setting | deployed by [`govern/lakeformation-settings.yaml`](govern/lakeformation-settings.yaml)<br>*(not configurable)* |

## Post-Deployment Verification

1. Navigate to **IAM Console** > Roles and confirm the data-admin role exists.
2. Navigate to **AWS Glue Console** > Settings and verify encryption is enabled.
3. Navigate to **AWS Lake Formation Console** > Data lake administrators and verify the data-admin role is listed.

## Next Steps

This minimal kit provides the governance foundation. Extend it by adding modules:

- Add `@aws-mdaa/datalake` for S3 buckets with Lake Formation integration
- Add `@aws-mdaa/athena-workgroup` for SQL query capabilities
- Add `@aws-mdaa/dataops-project` for Glue ETL pipelines

See the [Basic DataLake](../basic_datalake/) starter kit for a working example with data storage and querying.
