/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaTestApp } from '@aws-mdaa/testing';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { createAgentCoreResourcePolicy } from '../lib';

const TEST_RESOURCE_ARN = `arn:aws:bedrock-agentcore:test-region:test-account:runtime/my-runtime`;
const TEST_VPC_ID = 'vpc-0123456789abcdef0';

describe('createAgentCoreResourcePolicy', () => {
  let testApp: MdaaTestApp;

  beforeEach(() => {
    testApp = new MdaaTestApp();
  });

  test('should create native AWS::BedrockAgentCore::ResourcePolicy resource', () => {
    createAgentCoreResourcePolicy(testApp.testStack, 'TestPolicy', {
      resourceArn: TEST_RESOURCE_ARN,
      vpcId: TEST_VPC_ID,
    });

    const template = Template.fromStack(testApp.testStack);
    template.resourceCountIs('AWS::BedrockAgentCore::ResourcePolicy', 1);
  });

  test('should not create a Lambda-backed custom resource, Lambda, or role', () => {
    createAgentCoreResourcePolicy(testApp.testStack, 'TestPolicy', {
      resourceArn: TEST_RESOURCE_ARN,
      vpcId: TEST_VPC_ID,
    });

    const template = Template.fromStack(testApp.testStack);
    template.resourceCountIs('Custom::AgentCoreResourcePolicy', 0);
    template.resourceCountIs('AWS::Lambda::Function', 0);
    template.resourceCountIs('AWS::IAM::Role', 0);
  });

  test('should pass policy document with VPC-only restriction', () => {
    createAgentCoreResourcePolicy(testApp.testStack, 'TestPolicy', {
      resourceArn: TEST_RESOURCE_ARN,
      vpcId: TEST_VPC_ID,
    });

    const template = Template.fromStack(testApp.testStack);
    template.hasResourceProperties('AWS::BedrockAgentCore::ResourcePolicy', {
      ResourceArn: TEST_RESOURCE_ARN,
      Policy: Match.serializedJson(
        Match.objectLike({
          Version: '2012-10-17',
          Statement: [
            Match.objectLike({
              Sid: 'AllowVpcOnly',
              Effect: 'Allow',
              Principal: '*',
              Action: ['bedrock-agentcore:InvokeAgentRuntime', 'bedrock-agentcore:InvokeAgentRuntimeForUser'],
              Resource: TEST_RESOURCE_ARN,
              Condition: {
                StringEquals: {
                  'aws:SourceVpc': TEST_VPC_ID,
                },
              },
            }),
          ],
        }),
      ),
    });
  });

  test('should use custom actions in policy document when specified', () => {
    const gatewayArn = 'arn:aws:bedrock-agentcore:test-region:test-account:gateway/my-gateway';
    createAgentCoreResourcePolicy(testApp.testStack, 'TestPolicy', {
      resourceArn: gatewayArn,
      vpcId: TEST_VPC_ID,
      actions: ['bedrock-agentcore:InvokeGateway'],
    });

    const template = Template.fromStack(testApp.testStack);
    template.resourceCountIs('AWS::BedrockAgentCore::ResourcePolicy', 1);
    template.hasResourceProperties('AWS::BedrockAgentCore::ResourcePolicy', {
      ResourceArn: gatewayArn,
      Policy: Match.serializedJson(
        Match.objectLike({
          Statement: [
            Match.objectLike({
              Action: ['bedrock-agentcore:InvokeGateway'],
              Resource: gatewayArn,
            }),
          ],
        }),
      ),
    });
  });
});
