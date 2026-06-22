# Usage

## Deployed Resources

Once deployed, you should see the following across your AWS accounts:

### Enterprise Account

**Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

**SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| SMUS Domain | `<org>-dev-ent-data-smus-dom-domain1`<br>`/<org>/ent-data/smus-dom/domain/domain1/name` | `domains.domain1` in [`enterprise/smus-domains.yaml`](enterprise/smus-domains.yaml) |
| S3 Bucket | `<org>-dev-ent-data-lake-raw`<br>`/<org>/ent-data/lake/bucket/raw/name` | `buckets.raw` in [`enterprise/datalake.yaml`](enterprise/datalake.yaml) |
| S3 Bucket | `<org>-dev-ent-data-lake-transformed`<br>`/<org>/ent-data/lake/bucket/transformed/name` | `buckets.transformed` in [`enterprise/datalake.yaml`](enterprise/datalake.yaml) |
| S3 Bucket | `<org>-dev-ent-data-lake-curated`<br>`/<org>/ent-data/lake/bucket/curated/name` | `buckets.curated` in [`enterprise/datalake.yaml`](enterprise/datalake.yaml) |
| Glue Database | `<org>-dev-ent-data-proj1-lake-db1`<br>`/<org>/ent-data/proj1/database/name` | `databases.lake-db1` in [`enterprise/dataops-project1.yaml`](enterprise/dataops-project1.yaml) |
| IAM Role | `<org>-dev-ent-com-roles-data-admin`<br>`/<org>/ent-com/generated-role/data-admin/id` | `generateRoles.data-admin` in [`common/roles.yaml`](common/roles.yaml) |
| IAM Role | `<org>-dev-ent-com-roles-data-engineer`<br>`/<org>/ent-com/generated-role/data-engineer/id` | `generateRoles.data-engineer` in [`common/roles.yaml`](common/roles.yaml) |

### Team1 Account

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| Glue Database | `<org>-dev-team1-data-proj1-db1`<br>`/<org>/team1-data/proj1/database/name` | `databases.db1` in [`team1/dataops-project1.yaml`](team1/dataops-project1.yaml) |
| S3 Bucket | `<org>-dev-team1-data-proj1`<br>`/<org>/team1-data/proj1/bucket/name` | configured in [`team1/dataops-project1.yaml`](team1/dataops-project1.yaml) |
| IAM Role | `<org>-dev-team1-com-roles-data-admin`<br>`/<org>/team1-com/generated-role/data-admin/id` | `generateRoles.data-admin` in [`common/roles.yaml`](common/roles.yaml) |

### Team2 Account

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| SMUS Project | `<org>-dev-team2-data-proj1-team2`<br>`/<org>/team2-data/proj1/project/proj1/name` | `projects.team2` in [`team2/smus-project.yaml`](team2/smus-project.yaml) |
| IAM Role | `<org>-dev-team2-com-roles-data-admin`<br>`/<org>/team2-com/generated-role/data-admin/id` | `generateRoles.data-admin` in [`common/roles.yaml`](common/roles.yaml) |

## Post-Deployment Steps

### 1. Access the SMUS Portal

1. Navigate to **SageMaker Unified Studio** in the enterprise account console.
2. Select the deployed domain and click **Open portal**.
3. SSO users in the enterprise, team1, and team2 groups should be able to log in.

### 2. Verify Domain Associations

1. In the SageMaker Unified Studio console, confirm that the team1 and team2 accounts appear as associated accounts.
2. If associations are pending, they may need manual approval in the target accounts.

### 3. Upload Data to the Enterprise Lake

1. Assume the `<org>-dev-ent-com-roles-data-admin` role in the enterprise account.
2. Upload data to the raw bucket:
   ```bash
   aws s3 cp ./data/ s3://<org>-dev-ent-data-lake-raw/data/ --recursive
   ```

### 4. Catalog Data

1. Navigate to AWS Glue Console in the enterprise account.
2. Run the deployed crawler to catalog uploaded data.
3. Verify tables appear in the Glue database.

### 5. Publish Data Products

1. In the SMUS portal, navigate to the enterprise project.
2. Publish cataloged tables as data products for cross-account consumption.
3. Team1 and team2 users can discover and subscribe to these products from their SMUS projects.

## Roles

| Role | Account | Use For |
|------|---------|---------|
| `data-admin` | All accounts | Full access to data lake, Glue, LakeFormation |
| `data-engineer` | All accounts | Building ETL pipelines, managing crawlers |
| `glue-etl` | All accounts | Service role for Glue job execution |
