/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaCustomResource, MdaaCustomResourceProps } from '@aws-mdaa/custom-constructs';
import { MdaaConstructProps } from '@aws-mdaa/construct';
import { BundlingOutput, Duration } from 'aws-cdk-lib';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface CreateAgentCoreResourcePolicyProps {
  readonly resourceArn: string;
  readonly vpcId: string;
  readonly naming: MdaaConstructProps['naming'];
  readonly actions?: string[];
}

const DEFAULT_ACTIONS = ['bedrock-agentcore:InvokeAgentRuntime', 'bedrock-agentcore:InvokeAgentRuntimeForUser'];

/**
 * Creates a resource-based policy on an AgentCore resource restricting
 * invocations to VPC-only traffic. Uses a Custom Resource backed by a Lambda
 * that calls the PutResourcePolicy / DeleteResourcePolicy APIs.
 *
 * Works for any AgentCore resource type that supports the PutResourcePolicy API
 * (Runtime, Gateway).
 */
export function createAgentCoreResourcePolicy(
  scope: Construct,
  id: string,
  props: CreateAgentCoreResourcePolicyProps,
): MdaaCustomResource {
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

  const handlerStatements = [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'bedrock-agentcore:PutResourcePolicy',
        'bedrock-agentcore:DeleteResourcePolicy',
        'bedrock-agentcore:GetResourcePolicy',
      ],
      resources: [props.resourceArn],
    }),
  ];

  const crProps: MdaaCustomResourceProps = {
    resourceType: 'AgentCoreResourcePolicy',
    code: Code.fromAsset(`${__dirname}/../src/lambda/resource_policy`, {
      bundling: {
        image: Runtime.PYTHON_3_13.bundlingImage,
        command: ['bash', '-c', 'pip install -r requirements.txt -t /asset-output && cp -r . /asset-output'],
        outputType: BundlingOutput.NOT_ARCHIVED,
      },
    }),
    runtime: Runtime.PYTHON_3_13,
    handler: 'resource_policy.lambda_handler',
    handlerRolePolicyStatements: handlerStatements,
    handlerProps: {
      resourceArn: props.resourceArn,
      policy: JSON.stringify(policyDocument),
    },
    naming: props.naming,
    pascalCaseProperties: false,
    handlerTimeout: Duration.seconds(30),
  };

  return new MdaaCustomResource(scope, id, crProps);
}
