# DataOps Aurora Module

Deploys compliant Aurora Serverless v2 clusters with enterprise security controls, automatic scaling, and DataOps project integration. Currently supports Aurora PostgreSQL, with Aurora MySQL support planned. Use this module for relational database workloads that need serverless scaling, high availability, and centralized access management.

## Deployed Resources (per cluster)

**Aurora Serverless v2 Cluster** - Writer instance with configurable reader instances and automatic capacity scaling

**KMS CMK (or project key)** - Customer-managed encryption key shared across all clusters in the module

**VPC Security Group** - Network access control with configurable ingress rules (or imported from DataOps project)

**IAM Role** - Enhanced Monitoring role for RDS performance insights at 60-second intervals

**Secrets Manager Secret** - Admin credentials with automatic password rotation on a configurable schedule

**DB Subnet Group** - Multi-AZ subnet placement for high availability and fault tolerance

**IAM Managed Policy** - Per-cluster access policy granting rds-db:connect, rds:DescribeDBClusters, and Secrets Manager access

**SSM Parameters** - Cluster endpoints published for project integration and cross-module references

![DataOps Aurora Architecture](../../../constructs/L3/dataops/dataops-aurora-l3-construct/docs/dataops-aurora.png)

## Related Modules

- [**DataOps Project**](../dataops-project-app/README.md) — Provides shared KMS key and security groups via `projectName` auto-wiring
- [**Roles**](../../governance/roles-app/README.md) — Creates IAM roles referenced by `dataAdminRoles` and `clusterAccessRoles`

## Security/Compliance Details

This module is designed in alignment with MDAA security/compliance principles and CDK Nag rulesets (AwsSolutions, NIST 800-53 R5, HIPAA Security, PCI DSS 3.2.1).

- **Encryption at Rest**: KMS CMK encryption enforced on all cluster storage. Single shared key for all clusters (project key or dedicated).
- **Encryption in Transit**: SSL-only connections enforced via Aurora cluster configuration.
- **Network Isolation**: VPC-bound deployment with security group controls. No public access. Non-default port required (port obfuscation).
- **Least Privilege**: Per-cluster IAM managed policy scoped to specific cluster ARN and secret ARN. rds-db:connect wildcards database user name only within the cluster resource ID.
- **Credential Management**: Automatic admin password rotation via Secrets Manager on a configurable schedule (default 30 days).
- **Monitoring**: Enhanced Monitoring at 60-second intervals. PostgreSQL log export to CloudWatch Logs enabled by default.
- **IAM Authentication**: Token-based database access via IAM enabled by default, eliminating long-lived database passwords for application access.
- **Data Protection**: Backup retention enforced (default 7 days). Removal policy set to RETAIN with snapshot on delete.

## Configuration

### MDAA Config

```yaml
domains:
  shared:
    environments:
      dev:
        modules:
          aurora:
            module_path: '@aws-mdaa/dataops-aurora'
            module_configs:
              - ./aurora.yaml
```

### Module Config Samples and Variants

#### Minimal Configuration

Deploys a single Aurora PostgreSQL cluster using the project KMS key with secure defaults. Use this as a starting point for simple workloads.

[sample-config-minimal.yaml](sample_configs/sample-config-minimal.yaml)

```yaml
--8<-- "target/docs/packages/apps/dataops/dataops-aurora-app/sample_configs/sample-config-minimal.yaml"
```

#### Comprehensive Configuration

Deploys multiple Aurora PostgreSQL clusters with custom scaling, multi-reader setup, extended backup retention, Data API access, imported security group from project, and role-based access control.

[sample-config-comprehensive.yaml](sample_configs/sample-config-comprehensive.yaml)

```yaml
--8<-- "target/docs/packages/apps/dataops/dataops-aurora-app/sample_configs/sample-config-comprehensive.yaml"
```

#### No-Project Configuration

Deploys an Aurora PostgreSQL cluster without DataOps project integration, using a directly specified KMS key ARN. Use this when deploying Aurora clusters independently of a DataOps project.

[sample-config-noproject.yaml](sample_configs/sample-config-noproject.yaml)

```yaml
--8<-- "target/docs/packages/apps/dataops/dataops-aurora-app/sample_configs/sample-config-noproject.yaml"
```
