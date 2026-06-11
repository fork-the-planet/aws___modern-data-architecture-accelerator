/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper, MdaaRoleRef } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataOpsProjectL3Construct, DataOpsProjectL3ConstructProps, NamedDatabaseGrantProps } from '../lib';
// nosemgrep

// Regression test for #1192: createCrossAccountResourceLinkAccounts with multiple
// accounts must create one resource link per account (previously Object.fromEntries
// collapsed all accounts onto a single key, so only the last account got a link).
describe('Cross Account Resource Link - multiple accounts (#1192)', () => {
  const testApp = new MdaaTestApp();

  const consumerAccountA = '111111111111';
  const consumerAccountB = '222222222222';
  const resourceLinkName = 'repro-silver_rl';

  const testGlueRoleRef: MdaaRoleRef = { id: 'test-glue-role-id' };
  const testAdminRoleRef: MdaaRoleRef = { id: 'test-admin-role-id' };
  const testEngRoleRef: MdaaRoleRef = { id: 'test-eng-super-role-id' };

  // One grant per consumer account; determinePrincipalAccount parses the ARN account,
  // which is how each resource link's DESCRIBE principal is routed to its account.
  const testGrants: NamedDatabaseGrantProps = {
    'consumer-a-read': {
      principalArns: {
        a: `arn:test-partition:iam::${consumerAccountA}:role/consumer-a-role`,
      },
    },
    'consumer-b-read': {
      principalArns: {
        b: `arn:test-partition:iam::${consumerAccountB}:role/consumer-b-role`,
      },
    },
  };

  const crossAccountStackA = new Stack(testApp, 'test-cross-account-stack-a');
  const crossAccountStackB = new Stack(testApp, 'test-cross-account-stack-b');

  const constructProps: DataOpsProjectL3ConstructProps = {
    naming: testApp.naming,
    roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
    crossAccountStacks: {
      [consumerAccountA]: { 'test-region': crossAccountStackA },
      [consumerAccountB]: { 'test-region': crossAccountStackB },
    },
    s3OutputKmsKeyArn: 'arn:test-partition:kms:test-region:test-account:key/s3-output-key-id',
    glueCatalogKmsKeyArn: 'arn:test-partition:kms:test-region:test-account:key/glue-catalog-key-id',
    projectExecutionRoleRefs: [testGlueRoleRef],
    databases: {
      silver: {
        description: 'Silver DB shared to two consumer accounts',
        locationBucketName: 'test-bucket-name',
        locationPrefix: 'test-prefix',
        lakeFormation: {
          createCrossAccountResourceLinkAccounts: [consumerAccountA, consumerAccountB],
          createCrossAccountResourceLinkName: resourceLinkName,
          grants: testGrants,
        },
      },
    },
    dataEngineerRoleRefs: [testEngRoleRef],
    dataAdminRoleRefs: [testAdminRoleRef],
  };

  new DataOpsProjectL3Construct(testApp.testStack, 'test-stack', constructProps);

  const templateA = Template.fromStack(crossAccountStackA);
  const templateB = Template.fromStack(crossAccountStackB);

  const expectedResourceLink = (catalogId: string) => ({
    CatalogId: catalogId,
    DatabaseInput: {
      Name: resourceLinkName,
      TargetDatabase: {
        CatalogId: 'test-account',
        DatabaseName: 'test-org-test-env-test-domain-test-module-silver',
      },
    },
  });

  test('Account A receives its own resource link', () => {
    templateA.hasResourceProperties('AWS::Glue::Database', expectedResourceLink(consumerAccountA));
  });

  test('Account B receives its own resource link', () => {
    templateB.hasResourceProperties('AWS::Glue::Database', expectedResourceLink(consumerAccountB));
  });

  test('Each account stack has exactly one resource-link database', () => {
    // Each cross-account stack should contain a single Glue::Database (the resource link).
    templateA.resourceCountIs('AWS::Glue::Database', 1);
    templateB.resourceCountIs('AWS::Glue::Database', 1);
  });

  test('Each account receives its own DESCRIBE grant on the resource link', () => {
    templateA.hasResourceProperties('AWS::LakeFormation::PrincipalPermissions', {
      Permissions: ['DESCRIBE'],
      Resource: {
        Database: {
          CatalogId: consumerAccountA,
          Name: resourceLinkName,
        },
      },
    });
    templateB.hasResourceProperties('AWS::LakeFormation::PrincipalPermissions', {
      Permissions: ['DESCRIBE'],
      Resource: {
        Database: {
          CatalogId: consumerAccountB,
          Name: resourceLinkName,
        },
      },
    });
  });
});
