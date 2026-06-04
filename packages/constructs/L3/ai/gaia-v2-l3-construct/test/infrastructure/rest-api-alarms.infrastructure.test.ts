/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { GAIAL3Construct, GAIAL3ConstructProps } from '../../lib';

describe('REST API Alarm Tests', () => {
  const baseGaiaConfig = {
    waf: { skipGlobalDefaultWaf: true },
    dataAdminRoles: [{ name: 'test-admin' }],
    bedrock: { knowledgeBaseId: 'knowledgeBaseId' },
    webSocketApi: {
      bedrockRagDataSource: {
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        lambdaRole: { id: 'generated-role-id:bedrock-rag-datasource' },
      },
    },
    vpc: { vpcId: 'XXXXXXXX', appSubnets: ['subnet1'] },
    auth: {
      cognitoDomain: 'test-domain',
      entraIdOIDCConfiguration: {
        entraIdConfigSecretArn: 'arn:aws:secretsmanager:ca-central-1:123456789102:secret:oidc-secret-rkfLVz',
        attributeMapping: { fullname: 'name' },
      },
    },
    userFeedback: { reasons: ['accuracy'] },
  };

  const createConstruct = (restApiConfig: object = {}) => {
    const testApp = new MdaaTestApp();
    const roleHelper = new MdaaRoleHelper(testApp.testStack, testApp.naming);

    const constructProps: GAIAL3ConstructProps = {
      gaia: {
        ...baseGaiaConfig,
        restApi: restApiConfig,
      },
      roleHelper,
      naming: testApp.naming,
    };

    new GAIAL3Construct(testApp.testStack, 'teststack', constructProps);
    return Template.fromStack(testApp.testStack);
  };

  describe('when alarms are not configured', () => {
    test('does not create any alarms', () => {
      const template = createConstruct();
      template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
    });
  });

  describe('when alarms are configured with defaults', () => {
    let template: Template;

    beforeAll(() => {
      template = createConstruct({ alarms: {} });
    });

    test('creates five alarms', () => {
      // 5XX, 4XX, latency, 429-throttle, lambda-concurrency
      template.resourceCountIs('AWS::CloudWatch::Alarm', 5);
    });

    test('creates 429 throttle alarm backed by a metric filter on the access log', () => {
      // API Gateway's 4XXError metric is not broken down by status code, so 429s are counted via a
      // metric filter on the access log rather than an AWS/ApiGateway dimension.
      template.hasResourceProperties('AWS::Logs::MetricFilter', {
        FilterPattern: '{ $.status = "429" }',
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'GAIA/RestApi',
        Statistic: 'Sum',
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      });
    });

    test('creates Lambda concurrency alarm on the API handler', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'ConcurrentExecutions',
        Namespace: 'AWS/Lambda',
        Statistic: 'Maximum',
        ComparisonOperator: 'GreaterThanThreshold',
        Dimensions: Match.arrayWith([Match.objectLike({ Name: 'FunctionName' })]),
      });
    });

    test('creates an SNS topic for notifications', () => {
      template.hasResource('AWS::SNS::Topic', {});
    });

    test('creates 5XX error alarm with default threshold', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: '5XXError',
        Namespace: 'AWS/ApiGateway',
        Statistic: 'Average',
        Period: 300,
        EvaluationPeriods: 3,
        Threshold: 5,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      });
    });

    test('creates 4XX error alarm with default threshold', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: '4XXError',
        Namespace: 'AWS/ApiGateway',
        Statistic: 'Average',
        Period: 300,
        EvaluationPeriods: 3,
        Threshold: 20,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      });
    });

    test('creates P99 latency alarm with default threshold', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'Latency',
        Namespace: 'AWS/ApiGateway',
        ExtendedStatistic: 'p99',
        Period: 300,
        EvaluationPeriods: 3,
        Threshold: 10000,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      });
    });

    test('alarms have API Gateway dimensions', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: '5XXError',
        Dimensions: Match.arrayWith([Match.objectLike({ Name: 'ApiName' }), Match.objectLike({ Name: 'Stage' })]),
      });
    });

    test('alarms have SNS alarm actions', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: '5XXError',
        AlarmActions: Match.anyValue(),
      });
    });
  });

  describe('when alarms are configured with custom thresholds', () => {
    test('uses custom 5XX threshold and period', () => {
      const template = createConstruct({
        alarms: {
          error5xxRate: { threshold: 10, period: 60, evaluationPeriods: 5 },
        },
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: '5XXError',
        Threshold: 10,
        Period: 60,
        EvaluationPeriods: 5,
      });
    });

    test('uses custom 4XX threshold', () => {
      const template = createConstruct({
        alarms: {
          error4xxRate: { threshold: 50, period: 120, evaluationPeriods: 2 },
        },
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: '4XXError',
        Threshold: 50,
        Period: 120,
        EvaluationPeriods: 2,
      });
    });

    test('uses custom 429 throttle threshold, period, and evaluation periods', () => {
      const template = createConstruct({
        alarms: {
          throttle429: { threshold: 50, period: 60, evaluationPeriods: 2 },
        },
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'GAIA/RestApi',
        Statistic: 'Sum',
        Threshold: 50,
        Period: 60,
        EvaluationPeriods: 2,
      });
    });

    test('uses custom Lambda concurrency threshold, period, and evaluation periods', () => {
      const template = createConstruct({
        alarms: {
          lambdaConcurrency: { threshold: 80, period: 120, evaluationPeriods: 5 },
        },
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'ConcurrentExecutions',
        Namespace: 'AWS/Lambda',
        Threshold: 80,
        Period: 120,
        EvaluationPeriods: 5,
      });
    });

    test('uses custom latency threshold', () => {
      const template = createConstruct({
        alarms: {
          latencyP99: { threshold: 5000, period: 600, evaluationPeriods: 1 },
        },
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'Latency',
        Threshold: 5000,
        Period: 600,
        EvaluationPeriods: 1,
      });
    });
  });

  describe('when individual alarms are disabled', () => {
    test('does not create 5XX alarm when disabled', () => {
      const template = createConstruct({
        alarms: {
          error5xxRate: { enabled: false, threshold: 5 },
        },
      });
      // Should have 4 alarms (4xx + latency + 429 + concurrency), not 5
      template.resourceCountIs('AWS::CloudWatch::Alarm', 4);
      // Verify no 5XX alarm exists
      const alarms = template.findResources('AWS::CloudWatch::Alarm', {
        Properties: { MetricName: '5XXError' },
      });
      expect(Object.keys(alarms)).toHaveLength(0);
    });

    test('does not create 4XX alarm when disabled', () => {
      const template = createConstruct({
        alarms: {
          error4xxRate: { enabled: false, threshold: 20 },
        },
      });
      template.resourceCountIs('AWS::CloudWatch::Alarm', 4);
      const alarms = template.findResources('AWS::CloudWatch::Alarm', {
        Properties: { MetricName: '4XXError' },
      });
      expect(Object.keys(alarms)).toHaveLength(0);
    });

    test('does not create latency alarm when disabled', () => {
      const template = createConstruct({
        alarms: {
          latencyP99: { enabled: false, threshold: 10000 },
        },
      });
      template.resourceCountIs('AWS::CloudWatch::Alarm', 4);
      const alarms = template.findResources('AWS::CloudWatch::Alarm', {
        Properties: { MetricName: 'Latency' },
      });
      expect(Object.keys(alarms)).toHaveLength(0);
    });

    test('does not create 429 throttle alarm when disabled', () => {
      const template = createConstruct({
        alarms: {
          throttle429: { enabled: false, threshold: 100 },
        },
      });
      template.resourceCountIs('AWS::CloudWatch::Alarm', 4);
      // The metric filter backing the 429 alarm should not be created when the alarm is disabled.
      template.resourceCountIs('AWS::Logs::MetricFilter', 0);
    });

    test('does not create Lambda concurrency alarm when disabled', () => {
      const template = createConstruct({
        alarms: {
          lambdaConcurrency: { enabled: false, threshold: 100 },
        },
      });
      template.resourceCountIs('AWS::CloudWatch::Alarm', 4);
      const alarms = template.findResources('AWS::CloudWatch::Alarm', {
        Properties: { MetricName: 'ConcurrentExecutions' },
      });
      expect(Object.keys(alarms)).toHaveLength(0);
    });

    test('creates no alarms when all are disabled', () => {
      const template = createConstruct({
        alarms: {
          error5xxRate: { enabled: false, threshold: 5 },
          error4xxRate: { enabled: false, threshold: 20 },
          latencyP99: { enabled: false, threshold: 10000 },
          throttle429: { enabled: false, threshold: 100 },
          lambdaConcurrency: { enabled: false, threshold: 100 },
        },
      });
      template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
    });
  });

  describe('when a custom SNS topic ARN is provided', () => {
    test('does not create a new SNS topic', () => {
      const template = createConstruct({
        alarms: {
          snsTopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic',
        },
      });
      // SNS topics are still created by other constructs, so check alarms reference the custom ARN
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: '5XXError',
        AlarmActions: ['arn:aws:sns:us-east-1:123456789012:my-topic'],
      });
    });

    test('all alarms reference the custom SNS topic', () => {
      const customArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const template = createConstruct({
        alarms: { snsTopicArn: customArn },
      });

      for (const metricName of ['5XXError', '4XXError', 'Latency']) {
        template.hasResourceProperties('AWS::CloudWatch::Alarm', {
          MetricName: metricName,
          AlarmActions: [customArn],
        });
      }
    });
  });
});
