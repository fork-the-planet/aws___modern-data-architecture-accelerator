/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { CfnResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface CreateAgentCoreResourcePolicyProps {
  readonly resourceArn: string;
  readonly vpcId: string;
  readonly actions?: string[];
}

const DEFAULT_ACTIONS = ['bedrock-agentcore:InvokeAgentRuntime', 'bedrock-agentcore:InvokeAgentRuntimeForUser'];

/**
 * Creates a resource-based policy on an AgentCore resource restricting
 * invocations to VPC-only traffic. Uses the native
 * `AWS::BedrockAgentCore::ResourcePolicy` CloudFormation resource so the
 * policy lifecycle is managed by CloudFormation.
 *
 * Works for any AgentCore resource type that supports the resource policy
 * (Runtime, Gateway).
 */
export function createAgentCoreResourcePolicy(
  scope: Construct,
  id: string,
  props: CreateAgentCoreResourcePolicyProps,
): CfnResource {
  const actions = props.actions ?? DEFAULT_ACTIONS;

  const policyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowVpcOnly',
        Effect: 'Allow',
        Principal: '*',
        Action: actions,
        Resource: props.resourceArn,
        Condition: {
          StringEquals: {
            'aws:SourceVpc': props.vpcId,
          },
        },
      },
    ],
  };

  return new CfnResource(scope, id, {
    type: 'AWS::BedrockAgentCore::ResourcePolicy',
    properties: {
      ResourceArn: props.resourceArn,
      Policy: JSON.stringify(policyDocument),
    },
  });
}
