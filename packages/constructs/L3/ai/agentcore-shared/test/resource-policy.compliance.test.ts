/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaTestApp } from '@aws-mdaa/testing';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { createAgentCoreResourcePolicy } from '../lib';

jest.spyOn(lambda.Code, 'fromAsset').mockReturnValue(lambda.Code.fromInline('# mock') as unknown as lambda.AssetCode);

const TEST_RESOURCE_ARN = 'arn:aws:bedrock-agentcore:test-region:test-account:runtime/my-runtime';
const TEST_VPC_ID = 'vpc-0123456789abcdef0';

describe('createAgentCoreResourcePolicy Compliance', () => {
  const testApp = new MdaaTestApp();

  createAgentCoreResourcePolicy(testApp.testStack, 'TestPolicy', {
    resourceArn: TEST_RESOURCE_ARN,
    vpcId: TEST_VPC_ID,
    naming: testApp.naming,
  });

  testApp.checkCdkNagCompliance(testApp.testStack);
});
