/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DataopsAuroraL3Construct, DataopsAuroraL3ConstructProps } from '../lib';

describe('DataOps Aurora Compliance Tests', () => {
  const testApp = new MdaaTestApp();
  const stack = testApp.testStack;

  const constructProps: DataopsAuroraL3ConstructProps = {
    postgresqlClusters: {
      'compliance-cluster': {
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
        dataAdminRoles: [{ arn: 'arn:test-partition:iam::test-account:role/admin-role' }],
        enableCloudwatchLogsExports: true,
        enableIamAuthentication: true,
      },
    },
    naming: testApp.naming,
    roleHelper: new MdaaRoleHelper(stack, testApp.naming),
  };

  new DataopsAuroraL3Construct(stack, 'compliance-test', constructProps);
  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('KMS encryption is enforced', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      StorageEncrypted: true,
    });
  });

  test('Non-default port is configured', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      Port: 15432,
    });
  });

  test('IAM database authentication is enabled', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      EnableIAMDatabaseAuthentication: true,
    });
  });

  test('CloudWatch log exports are enabled for PostgreSQL', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      EnableCloudwatchLogsExports: ['postgresql'],
    });
  });

  test('Enhanced monitoring role is created', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'monitoring.rds.amazonaws.com',
            },
          },
        ],
      },
    });
  });

  test('Backup retention is configured', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      BackupRetentionPeriod: 7,
    });
  });

  test('Admin password rotation is configured', () => {
    template.hasResourceProperties('AWS::SecretsManager::RotationSchedule', {
      RotationRules: {
        ScheduleExpression: 'rate(30 days)',
      },
    });
  });

  test('KMS key policy grants CloudWatch Logs encryption access', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      KeyPolicy: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'AllowAuroraLogEncryption',
            Effect: 'Allow',
            Principal: {
              Service: 'logs.test-region.amazonaws.com',
            },
            Condition: {
              ArnLike: {
                'kms:EncryptionContext:aws:logs:arn': 'arn:test-partition:logs:test-region:test-account:*',
              },
            },
          }),
        ]),
      },
    });
  });
});

describe('DataOps Aurora Access Policy Tests', () => {
  test('Cluster access managed policy grants least-privilege permissions', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      postgresqlClusters: {
        'policy-cluster': {
          engineVersion: '16.13',
          vpcId: 'vpc-12345',
          subnets: [
            { subnetId: 'subnet-1a2b3c4d', availabilityZone: 'test-regiona' },
            { subnetId: 'subnet-5e6f7g8h', availabilityZone: 'test-regionb' },
          ],
          securityGroupIngress: { ipv4: ['10.0.0.0/16'] },
          port: 15432,
          clusterAccessRoles: [{ arn: 'arn:test-partition:iam::test-account:role/app-role' }],
        },
      },
      dataAdminRoles: [{ arn: 'arn:test-partition:iam::test-account:role/admin-role' }],
      kmsArn: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    new DataopsAuroraL3Construct(stack, 'policy-test', constructProps);
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'rds-db:connect',
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: 'rds:DescribeDBClusters',
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });
});
