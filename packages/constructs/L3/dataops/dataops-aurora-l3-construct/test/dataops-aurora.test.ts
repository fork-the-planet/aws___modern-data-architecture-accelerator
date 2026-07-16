/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { Template } from 'aws-cdk-lib/assertions';
import { DataopsAuroraL3Construct, DataopsAuroraL3ConstructProps } from '../lib';

describe('DataOps Aurora L3 Construct Tests', () => {
  test('Creates single PostgreSQL cluster with project KMS key', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      postgresqlClusters: {
        'test-cluster': {
          engineVersion: '16.13',
          vpcId: 'vpc-12345',
          subnets: [
            { subnetId: 'subnet-1a2b3c4d', availabilityZone: 'test-regiona' },
            { subnetId: 'subnet-5e6f7g8h', availabilityZone: 'test-regionb' },
          ],
          securityGroupIngress: {
            ipv4: ['10.0.0.0/16'],
          },
          port: 15432,
        },
      },
      projectName: 'test-project',
      kmsArn: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
      dataAdminRoles: [{ arn: 'arn:test-partition:iam::test-account:role/admin-role' }],
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    const construct = new DataopsAuroraL3Construct(stack, 'test-aurora', constructProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::RDS::DBCluster', 1);
    // Managed policy for cluster access
    template.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
    // Project SSM parameter published for cluster endpoint
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/test-org/test-domain/test-project/aurora/endpoint/test-cluster',
    });
    expect(construct.postgresqlClusters['test-cluster']).toBeDefined();
  });

  test('Creates cluster with security group ingress source', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      postgresqlClusters: {
        'sg-ingress-cluster': {
          engineVersion: '16.13',
          vpcId: 'vpc-12345',
          subnets: [
            { subnetId: 'subnet-1a2b3c4d', availabilityZone: 'test-regiona' },
            { subnetId: 'subnet-5e6f7g8h', availabilityZone: 'test-regionb' },
          ],
          securityGroupIngress: {
            sg: ['sg-0abc1234def56789a'],
          },
          port: 15432,
        },
      },
      kmsArn: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    new DataopsAuroraL3Construct(stack, 'test-aurora-sg', constructProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::RDS::DBCluster', 1);
    template.resourceCountIs('AWS::EC2::SecurityGroup', 2);
  });

  test('Creates multiple PostgreSQL clusters', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      postgresqlClusters: {
        'primary-db': {
          engineVersion: '16.13',
          vpcId: 'vpc-12345',
          subnets: [
            { subnetId: 'subnet-1a2b3c4d', availabilityZone: 'test-regiona' },
            { subnetId: 'subnet-5e6f7g8h', availabilityZone: 'test-regionb' },
          ],
          securityGroupIngress: { ipv4: ['10.0.0.0/16'] },
          port: 15432,
          minCapacity: 2,
          maxCapacity: 16,
          numberOfReaders: 2,
          backupRetentionDays: 14,
          adminPasswordRotationDays: 60,
          defaultDatabaseName: 'analytics',
          enableDataApi: true,
          enableCloudwatchLogsExports: true,
          enableIamAuthentication: true,
          clusterAccessRoles: [{ arn: 'arn:test-partition:iam::test-account:role/app-role' }],
        },
        'secondary-db': {
          engineVersion: '16.13',
          vpcId: 'vpc-12345',
          subnets: [
            { subnetId: 'subnet-1a2b3c4d', availabilityZone: 'test-regiona' },
            { subnetId: 'subnet-5e6f7g8h', availabilityZone: 'test-regionb' },
          ],
          securityGroupIngress: { ipv4: ['10.0.0.0/16'] },
          port: 15433,
          numberOfReaders: 0,
        },
      },
      kmsArn: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    const construct = new DataopsAuroraL3Construct(stack, 'test-aurora-multi', constructProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::RDS::DBCluster', 2);
    // Verify Data API is enabled on the primary cluster
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      EnableHttpEndpoint: true,
    });
    expect(construct.postgresqlClusters['primary-db']).toBeDefined();
    expect(construct.postgresqlClusters['secondary-db']).toBeDefined();
  });

  test('Creates cluster with dedicated KMS key when no project', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      postgresqlClusters: {
        'standalone-db': {
          engineVersion: '16.13',
          vpcId: 'vpc-12345',
          subnets: [
            { subnetId: 'subnet-1a2b3c4d', availabilityZone: 'test-regiona' },
            { subnetId: 'subnet-5e6f7g8h', availabilityZone: 'test-regionb' },
          ],
          securityGroupIngress: { ipv4: ['10.0.0.0/16'] },
          port: 15432,
          dataAdminRoles: [{ arn: 'arn:test-partition:iam::test-account:role/admin-role' }],
        },
      },
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    new DataopsAuroraL3Construct(stack, 'test-aurora-standalone', constructProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::RDS::DBCluster', 1);
    // Dedicated KMS key created
    template.resourceCountIs('AWS::KMS::Key', 1);
  });

  test('Imports existing security group and adds ingress rules', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      postgresqlClusters: {
        'imported-sg-cluster': {
          engineVersion: '16.13',
          vpcId: 'vpc-12345',
          subnets: [
            { subnetId: 'subnet-1a2b3c4d', availabilityZone: 'test-regiona' },
            { subnetId: 'subnet-5e6f7g8h', availabilityZone: 'test-regionb' },
          ],
          securityGroupId: 'sg-0existing12345678a',
          securityGroupIngress: {
            ipv4: ['10.0.0.0/16'],
            sg: ['sg-0abc1234def56789a'],
          },
          port: 15432,
        },
      },
      kmsArn: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    new DataopsAuroraL3Construct(stack, 'test-aurora-imported-sg', constructProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::RDS::DBCluster', 1);
    // No new security group created — imported one is used
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    // Ingress rules added to the imported SG (2 from config + 1 from rotation Lambda)
    template.resourceCountIs('AWS::EC2::SecurityGroupIngress', 3);
  });
});
