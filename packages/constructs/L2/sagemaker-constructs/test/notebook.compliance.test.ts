/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaTestApp } from '@aws-mdaa/testing';
import { MdaaResourceType } from '@aws-mdaa/naming';
import { Template } from 'aws-cdk-lib/assertions';
import { MdaaNoteBook, MdaaNoteBookProps } from '../lib';
import { MAX_NOTEBOOK_NAME_LENGTH, sanitizeNotebookName } from '../lib/utils';

describe('MDAA Construct Compliance Tests', () => {
  const testApp = new MdaaTestApp();

  const testContstructProps: MdaaNoteBookProps = {
    notebookInstanceId: 'test-id',
    naming: testApp.naming,
    instanceType: 'ml.t3.medium',
    subnetId: 'test-subnet-id',
    kmsKeyId: 'arn:test-partition:kms:test-region:test-account:key/test-key',
    roleArn: 'arn:test-partition:iam:test-region:test-account:role/test-role',
    securityGroupIds: ['test-security-group'],
    notebookInstanceName: 'test-notebook',
  };

  new MdaaNoteBook(testApp.testStack, 'test-construct', testContstructProps);

  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('NotebookInstanceName', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      NotebookInstanceName: 'test-org-test-env-test-domain-test-module-test-notebook',
    });
  });

  test('NotebookInstanceName uses SAGEMAKER_NOTEBOOK resource type', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      NotebookInstanceName: testApp.naming
        .withResourceType(MdaaResourceType.SAGEMAKER_NOTEBOOK)
        .resourceName('test-notebook', MAX_NOTEBOOK_NAME_LENGTH),
    });
  });

  test('InstanceType', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      InstanceType: 'ml.t3.medium',
    });
  });

  test('RoleArn', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      RoleArn: 'arn:test-partition:iam:test-region:test-account:role/test-role',
    });
  });

  test('KmsKeyId', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      KmsKeyId: 'arn:test-partition:kms:test-region:test-account:key/test-key',
    });
  });

  test('SubnetId', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      SubnetId: 'test-subnet-id',
    });
  });

  test('SecurityGroupIds', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      SecurityGroupIds: ['test-security-group'],
    });
  });

  test('RootAccess', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      RootAccess: 'Disabled',
    });
  });

  test('DirectInternetAccess', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      DirectInternetAccess: 'Disabled',
    });
  });
});
describe('MDAA Notebook Name Tests', () => {
  const testApp = new MdaaTestApp();

  const testContstructProps: MdaaNoteBookProps = {
    notebookInstanceId: 'test-id',
    naming: testApp.naming,
    instanceType: 'ml.t3.medium',
    subnetId: 'test-subnet-id',
    kmsKeyId: 'arn:test-partition:kms:test-region:test-account:key/test-key',
    roleArn: 'arn:test-partition:iam:test-region:test-account:role/test-role',
    securityGroupIds: ['test-security-group'],
    notebookInstanceName: 'test-notebook'.repeat(5),
  };

  new MdaaNoteBook(testApp.testStack, 'test-construct', testContstructProps);

  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  const expectedInstanceName = 'test-org-test-env-test-domain-test-module-test-notebo-334f45b5';
  test('NotebookInstanceName', () => {
    expect(expectedInstanceName.length).toBeLessThan(64);
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      NotebookInstanceName: expectedInstanceName,
    });
  });

  test('NotebookInstanceName uses SAGEMAKER_NOTEBOOK resource type when truncated', () => {
    template.hasResourceProperties('AWS::SageMaker::NotebookInstance', {
      NotebookInstanceName: sanitizeNotebookName(
        testApp.naming
          .withResourceType(MdaaResourceType.SAGEMAKER_NOTEBOOK)
          .resourceName('test-notebook'.repeat(5), MAX_NOTEBOOK_NAME_LENGTH),
      ),
    });
  });
});
