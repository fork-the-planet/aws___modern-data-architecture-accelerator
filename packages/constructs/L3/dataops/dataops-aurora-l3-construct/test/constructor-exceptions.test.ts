/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { Template } from 'aws-cdk-lib/assertions';
import { DataopsAuroraL3Construct, DataopsAuroraL3ConstructProps } from '../lib';

describe('DataOps Aurora Constructor Edge Cases', () => {
  test('Handles undefined postgresqlClusters gracefully', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      kmsArn: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    const construct = new DataopsAuroraL3Construct(stack, 'test-empty', constructProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::RDS::DBCluster', 0);
    expect(Object.keys(construct.postgresqlClusters)).toHaveLength(0);
  });

  test('Handles empty postgresqlClusters map gracefully', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      postgresqlClusters: {},
      kmsArn: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    const construct = new DataopsAuroraL3Construct(stack, 'test-empty-map', constructProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::RDS::DBCluster', 0);
    expect(Object.keys(construct.postgresqlClusters)).toHaveLength(0);
  });

  test('No managed policy created when no access roles specified', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: DataopsAuroraL3ConstructProps = {
      postgresqlClusters: {
        'no-roles-cluster': {
          engineVersion: '16.13',
          vpcId: 'vpc-12345',
          subnets: [
            { subnetId: 'subnet-1a2b3c4d', availabilityZone: 'test-regiona' },
            { subnetId: 'subnet-5e6f7g8h', availabilityZone: 'test-regionb' },
          ],
          securityGroupIngress: { ipv4: ['10.0.0.0/16'] },
          port: 15432,
        },
      },
      kmsArn: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    };

    new DataopsAuroraL3Construct(stack, 'test-no-roles', constructProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::RDS::DBCluster', 1);
    // No managed policy when no roles are specified
    template.resourceCountIs('AWS::IAM::ManagedPolicy', 0);
  });
});
