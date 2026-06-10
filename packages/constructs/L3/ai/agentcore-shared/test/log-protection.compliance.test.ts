/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaTestApp } from '@aws-mdaa/testing';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as kms from 'aws-cdk-lib/aws-kms';
import { createAgentCoreLogProtection } from '../lib';

jest.spyOn(lambda.Code, 'fromAsset').mockReturnValue(lambda.Code.fromInline('# mock') as unknown as lambda.AssetCode);

const TEST_RUNTIME_ID = 'my_org_dev__749d67db-QQHgbo7Noj';

describe('createAgentCoreLogProtection Compliance', () => {
  const testApp = new MdaaTestApp();

  const kmsKey = kms.Key.fromKeyArn(
    testApp.testStack,
    'TestKey',
    'arn:aws:kms:test-region:test-account:key/test-key-id',
  );

  createAgentCoreLogProtection(testApp.testStack, 'TestLogProtection', {
    runtimeId: TEST_RUNTIME_ID,
    kmsKey: kmsKey,
    retentionDays: 90,
    dataProtectionPolicy: {
      Name: 'test',
      Version: '2021-06-01',
      Statement: [],
    },
    naming: testApp.naming,
  });

  testApp.checkCdkNagCompliance(testApp.testStack);
});
