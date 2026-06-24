/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaAppConfigParserProps } from '@aws-mdaa/app';
import { MdaaDataOpsConfigContents, MdaaDataOpsConfigParser } from '@aws-mdaa/dataops-shared';
import { AuroraPostgresqlClusterMap } from '@aws-mdaa/dataops-aurora-l3-construct';
import { MdaaRoleRef } from '@aws-mdaa/iam-role-helper';
import { Schema } from 'ajv';
import { Stack } from 'aws-cdk-lib';
import * as configSchema from './config-schema.json';

export interface DataopsAuroraConfigContents extends MdaaDataOpsConfigContents {
  /**
   * Map of named Aurora PostgreSQL Serverless v2 cluster configurations.
   * Each key is the cluster name (used as the cluster identifier after MDAA naming).
   * Deploys KMS-encrypted, VPC-bound clusters with enhanced monitoring,
   * IAM authentication, and automatic admin password rotation.
   *
   * Use cases: Relational database provisioning; PostgreSQL workloads; Multi-cluster deployment
   *
   * AWS: Aurora PostgreSQL Serverless v2 clusters
   *
   * Validation: Optional; map of cluster names to valid AuroraPostgresqlClusterProps
   */
  readonly postgresql?: AuroraPostgresqlClusterMap;
  /**
   * Data admin roles granted the cluster access managed policy for ALL Aurora clusters.
   * These roles receive rds-db:connect (IAM auth), rds:DescribeDBClusters, and
   * Secrets Manager access to every cluster's admin secret.
   *
   * Use cases: Platform admin access; Cross-cluster administration; Security management
   *
   * AWS: IAM roles with cluster access managed policies attached for all clusters
   *
   * Validation: Optional; array of valid MdaaRoleRef
   */
  readonly dataAdminRoles?: MdaaRoleRef[];
}

export class DataopsAuroraConfigParser extends MdaaDataOpsConfigParser<DataopsAuroraConfigContents> {
  public readonly postgresqlClusters?: AuroraPostgresqlClusterMap;
  public readonly dataAdminRoles?: MdaaRoleRef[];

  constructor(stack: Stack, props: MdaaAppConfigParserProps) {
    super(stack, props, configSchema as Schema);

    this.postgresqlClusters = this.configContents.postgresql;
    this.dataAdminRoles = this.configContents.dataAdminRoles;
  }
}
