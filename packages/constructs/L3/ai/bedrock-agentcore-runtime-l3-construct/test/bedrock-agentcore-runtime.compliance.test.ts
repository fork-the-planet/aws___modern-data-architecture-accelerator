/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { Aspects, CustomResource } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { BedrockAgentcoreRuntimeL3Construct, BedrockAgentcoreRuntimeL3ConstructProps } from '../lib';

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@aws-mdaa/agentcore-shared', () => {
  const original = jest.requireActual('@aws-mdaa/agentcore-shared');
  return {
    ...original,
    createAgentCoreResourcePolicy: (scope: any, id: string, props: any) => {
      return new CustomResource(scope, id, {
        serviceToken: 'arn:aws:lambda:us-east-1:123456789012:function:mock',
        resourceType: 'Custom::AgentCoreResourcePolicy',
        properties: {
          resourceArn: props.resourceArn,
          policy: JSON.stringify({ mock: true }),
        },
      });
    },
  };
});
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('BedrockAgentcoreRuntimeL3Construct Compliance Tests', () => {
  let testApp: MdaaTestApp;
  let roleHelper: MdaaRoleHelper;

  beforeEach(() => {
    testApp = new MdaaTestApp();
    roleHelper = new MdaaRoleHelper(testApp.testStack, testApp.naming);
  });

  test('should pass cdk-nag checks for basic runtime with VPC', () => {
    const constructProps: BedrockAgentcoreRuntimeL3ConstructProps = {
      agentRuntimeName: 'compliant-runtime',
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-runtime:latest',
        },
      },
      networkConfiguration: {
        securityGroups: ['sg-12345678'],
        subnets: ['subnet-12345678'],
      },
      naming: testApp.naming,
      roleHelper,
    };

    new BedrockAgentcoreRuntimeL3Construct(testApp.testStack, 'compliant-runtime-construct', constructProps);

    Aspects.of(testApp.testStack).add(new AwsSolutionsChecks({ verbose: true }));

    const errors = Annotations.fromStack(testApp.testStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));

    expect(errors).toHaveLength(0);
  });

  test('should pass cdk-nag checks for runtime with VPC configuration', () => {
    const constructProps: BedrockAgentcoreRuntimeL3ConstructProps = {
      agentRuntimeName: 'vpc-compliant-runtime',
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-runtime:latest',
        },
      },
      networkConfiguration: {
        securityGroups: ['sg-12345678'],
        subnets: ['subnet-12345678', 'subnet-87654321'],
      },
      naming: testApp.naming,
      roleHelper,
    };

    new BedrockAgentcoreRuntimeL3Construct(testApp.testStack, 'vpc-compliant-runtime-construct', constructProps);

    Aspects.of(testApp.testStack).add(new AwsSolutionsChecks({ verbose: true }));

    const errors = Annotations.fromStack(testApp.testStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));

    expect(errors).toHaveLength(0);
  });

  test('should pass cdk-nag checks for runtime with JWT authorizer', () => {
    const constructProps: BedrockAgentcoreRuntimeL3ConstructProps = {
      agentRuntimeName: 'jwt-compliant-runtime',
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-runtime:latest',
        },
      },
      networkConfiguration: {
        securityGroups: ['sg-12345678'],
        subnets: ['subnet-12345678'],
      },
      authorizerConfiguration: {
        customJwtAuthorizer: {
          discoveryUrl: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test/.well-known/openid-configuration',
          allowedAudience: ['client-id'],
        },
      },
      naming: testApp.naming,
      roleHelper,
    };

    new BedrockAgentcoreRuntimeL3Construct(testApp.testStack, 'jwt-compliant-runtime-construct', constructProps);

    Aspects.of(testApp.testStack).add(new AwsSolutionsChecks({ verbose: true }));

    const errors = Annotations.fromStack(testApp.testStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));

    expect(errors).toHaveLength(0);
  });

  test('should pass cdk-nag checks for runtime with allowedModelArns', () => {
    const constructProps: BedrockAgentcoreRuntimeL3ConstructProps = {
      agentRuntimeName: 'model-scoped-compliant-runtime',
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-runtime:latest',
        },
      },
      networkConfiguration: {
        securityGroups: ['sg-12345678'],
        subnets: ['subnet-12345678'],
      },
      allowedModelArns: [
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6-20250514-v1:0',
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
      ],
      naming: testApp.naming,
      roleHelper,
    };

    new BedrockAgentcoreRuntimeL3Construct(
      testApp.testStack,
      'model-scoped-compliant-runtime-construct',
      constructProps,
    );

    Aspects.of(testApp.testStack).add(new AwsSolutionsChecks({ verbose: true }));

    const errors = Annotations.fromStack(testApp.testStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));

    expect(errors).toHaveLength(0);
  });

  test('should pass cdk-nag checks for runtime with enforceVpcOnly', () => {
    const constructProps: BedrockAgentcoreRuntimeL3ConstructProps = {
      agentRuntimeName: 'vpc-enforced-compliant-runtime',
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-runtime:latest',
        },
      },
      networkConfiguration: {
        vpcId: 'vpc-0123456789abcdef0',
        securityGroups: ['sg-12345678'],
        subnets: ['subnet-12345678'],
      },
      enforceVpcOnly: true,
      naming: testApp.naming,
      roleHelper,
    };

    new BedrockAgentcoreRuntimeL3Construct(
      testApp.testStack,
      'vpc-enforced-compliant-runtime-construct',
      constructProps,
    );

    Aspects.of(testApp.testStack).add(new AwsSolutionsChecks({ verbose: true }));

    const errors = Annotations.fromStack(testApp.testStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));

    expect(errors).toHaveLength(0);
  });

  test('should pass cdk-nag checks for runtime with additional data protection identifiers', () => {
    const constructProps: BedrockAgentcoreRuntimeL3ConstructProps = {
      agentRuntimeName: 'encrypted-log-compliant-runtime',
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-runtime:latest',
        },
      },
      networkConfiguration: {
        securityGroups: ['sg-12345678'],
        subnets: ['subnet-12345678'],
      },
      logRetentionDays: 90,
      dataProtection: {
        additionalIdentifiers: ['DriversLicense-US', 'PassportNumber-US'],
      },
      naming: testApp.naming,
      roleHelper,
    };

    new BedrockAgentcoreRuntimeL3Construct(
      testApp.testStack,
      'encrypted-log-compliant-runtime-construct',
      constructProps,
    );

    Aspects.of(testApp.testStack).add(new AwsSolutionsChecks({ verbose: true }));

    const errors = Annotations.fromStack(testApp.testStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));

    expect(errors).toHaveLength(0);
  });

  test('should pass cdk-nag checks for runtime with managed policies', () => {
    const constructProps: BedrockAgentcoreRuntimeL3ConstructProps = {
      agentRuntimeName: 'policy-compliant-runtime',
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-runtime:latest',
        },
      },
      networkConfiguration: {
        securityGroups: ['sg-12345678'],
        subnets: ['subnet-12345678'],
      },
      policies: [
        {
          policyArn: 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess',
        },
      ],
      naming: testApp.naming,
      roleHelper,
    };

    new BedrockAgentcoreRuntimeL3Construct(testApp.testStack, 'policy-compliant-runtime-construct', constructProps);

    Aspects.of(testApp.testStack).add(new AwsSolutionsChecks({ verbose: true }));

    const errors = Annotations.fromStack(testApp.testStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));

    expect(errors).toHaveLength(0);
  });
});
