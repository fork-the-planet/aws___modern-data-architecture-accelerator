/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaTestApp } from '@aws-mdaa/testing';
import { MdaaResourceType } from '@aws-mdaa/naming';
import { Size } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { MdaaKmsKey } from '@aws-mdaa/kms-constructs';
import { MdaaEC2Volume, MdaaEC2VolumeProps } from '../lib/volume';

describe('MDAA Construct Compliance Tests', () => {
  const testApp = new MdaaTestApp();

  const testKey = MdaaKmsKey.fromKeyArn(
    testApp.testStack,
    'test-key',
    'arn:test-partition:kms:test-region:test-account:key/test-key',
  );
  const testContstructProps: MdaaEC2VolumeProps = {
    naming: testApp.naming,
    availabilityZone: 'az1',
    encryptionKey: testKey,
    size: Size.gibibytes(10),
  };

  new MdaaEC2Volume(testApp.testStack, 'test-construct', testContstructProps);

  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('CreatesEncryptedVolume', () => {
    template.hasResourceProperties('AWS::EC2::Volume', {
      Encrypted: true,
      KmsKeyId: 'arn:test-partition:kms:test-region:test-account:key/test-key',
    });
    template.hasResource('AWS::EC2::Volume', {
      DeletionPolicy: 'Retain',
    });
  });

  test('Volume Name tag uses EC2_VOLUME resource type', () => {
    const expectedName = testApp.naming.withResourceType(MdaaResourceType.EC2_VOLUME).resourceName(undefined);
    template.hasResourceProperties('AWS::EC2::Volume', {
      Tags: Match.arrayWith([{ Key: 'Name', Value: expectedName }]),
    });
  });
});
