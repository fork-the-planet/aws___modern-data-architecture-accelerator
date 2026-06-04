/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { GAIAL3Construct, GAIAL3ConstructProps } from '../../lib';

describe('WAF Infrastructure Tests', () => {
  const createConstruct = (allowedCidrs?: string[], wafRules?: { [key: string]: { priority: number } }) => {
    const testApp = new MdaaTestApp();
    const roleHelper = new MdaaRoleHelper(testApp.testStack, testApp.naming);

    const constructProps: GAIAL3ConstructProps = {
      gaia: {
        waf: {
          skipGlobalDefaultWaf: true,
          allowedCidrs,
          wafRules,
        },
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
        userFeedback: {
          reasons: ['accuracy', 'unhelpful'],
        },
      },
      roleHelper,
      naming: testApp.naming,
    };

    new GAIAL3Construct(testApp.testStack, 'teststack', constructProps);
    return Template.fromStack(testApp.testStack);
  };

  describe('IP Set Configuration', () => {
    test('creates IPv4 IP Set when only IPv4 CIDRs provided', () => {
      const template = createConstruct(['10.0.0.0/8', '192.168.0.0/16']);
      template.hasResourceProperties('AWS::WAFv2::IPSet', {
        IPAddressVersion: 'IPV4',
        Addresses: ['10.0.0.0/8', '192.168.0.0/16'],
      });
    });

    test('creates IPv6 IP Set when only IPv6 CIDRs provided', () => {
      const template = createConstruct(['2001:db8::/32', 'fe80::/10']);
      template.hasResourceProperties('AWS::WAFv2::IPSet', {
        IPAddressVersion: 'IPV6',
        Addresses: ['2001:db8::/32', 'fe80::/10'],
      });
    });

    test('creates both IPv4 and IPv6 IP Sets when mixed CIDRs provided', () => {
      const template = createConstruct(['10.0.0.0/8', '2001:db8::/32']);
      template.hasResourceProperties('AWS::WAFv2::IPSet', {
        IPAddressVersion: 'IPV4',
        Addresses: ['10.0.0.0/8'],
      });
      template.hasResourceProperties('AWS::WAFv2::IPSet', {
        IPAddressVersion: 'IPV6',
        Addresses: ['2001:db8::/32'],
      });
    });

    test('creates empty IP Set when no CIDRs provided', () => {
      const template = createConstruct([]);
      template.hasResourceProperties('AWS::WAFv2::IPSet', {
        Addresses: [],
        IPAddressVersion: 'IPV4',
      });
    });
  });

  describe('WAF Rules', () => {
    test('creates managed rule groups when wafRules configured', () => {
      const template = createConstruct(['10.0.0.0/8'], {
        AWSManagedRulesCommonRuleSet: { priority: 10 },
        AWSManagedRulesSQLiRuleSet: { priority: 20 },
      });
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesCommonRuleSet',
            Priority: 10,
          }),
        ]),
      });
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesSQLiRuleSet',
            Priority: 20,
          }),
        ]),
      });
    });
  });

  describe('Rate Limiting', () => {
    // Builds the REGIONAL WAF (skipGlobalDefaultWaf) with an arbitrary waf config so rate-limit
    // behavior can be exercised directly.
    const createWithWaf = (wafConfig: object) => {
      const testApp = new MdaaTestApp();
      const roleHelper = new MdaaRoleHelper(testApp.testStack, testApp.naming);
      const constructProps: GAIAL3ConstructProps = {
        gaia: {
          waf: { skipGlobalDefaultWaf: true, ...wafConfig },
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
        },
        roleHelper,
        naming: testApp.naming,
      };
      new GAIAL3Construct(testApp.testStack, 'teststack', constructProps);
      return Template.fromStack(testApp.testStack);
    };

    test('creates a per-IP rate-based rule by default (secure-by-default)', () => {
      const template = createWithWaf({ allowedCidrs: ['10.0.0.0/8'] });
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Priority: 0,
            Action: { Block: {} },
            Statement: Match.objectLike({
              RateBasedStatement: Match.objectLike({ AggregateKeyType: 'IP', Limit: 2000 }),
            }),
          }),
        ]),
      });
    });

    test('creates a per-user (Authorization header) rate rule by default on REGIONAL scope', () => {
      const template = createWithWaf({ allowedCidrs: ['10.0.0.0/8'] });
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitPerAuthorizationToken',
            Priority: 1,
            Action: { Block: {} },
            Statement: Match.objectLike({
              RateBasedStatement: Match.objectLike({
                AggregateKeyType: 'CUSTOM_KEYS',
                Limit: 600,
                CustomKeys: Match.arrayWith([
                  Match.objectLike({ Header: Match.objectLike({ Name: 'authorization' }) }),
                ]),
              }),
            }),
          }),
        ]),
      });
    });

    test('evaluates rate rules before the terminating IP allowlist rule', () => {
      // ipAllow must move to priority 2 so the priority-0/1 rate rules are reached for allowlisted
      // traffic; otherwise the allow action short-circuits evaluation (the NetSPI bypass).
      const template = createWithWaf({ allowedCidrs: ['10.0.0.0/8'] });
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([Match.objectLike({ Name: 'ipAllow', Priority: 2, Action: { Allow: {} } })]),
      });
    });

    test('respects custom per-IP and per-user limits', () => {
      const template = createWithWaf({
        allowedCidrs: ['10.0.0.0/8'],
        rateLimit: { limit: 500, evaluationWindowSec: 120, perUser: { limit: 60, evaluationWindowSec: 300 } },
      });
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Statement: Match.objectLike({
              RateBasedStatement: Match.objectLike({ Limit: 500, EvaluationWindowSec: 120 }),
            }),
          }),
        ]),
      });
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitPerAuthorizationToken',
            Statement: Match.objectLike({
              RateBasedStatement: Match.objectLike({ Limit: 60, EvaluationWindowSec: 300 }),
            }),
          }),
        ]),
      });
    });

    test('opts out of all rate limiting when rateLimit.enabled is false', () => {
      const template = createWithWaf({ allowedCidrs: ['10.0.0.0/8'], rateLimit: { enabled: false } });
      const webAcls = template.findResources('AWS::WAFv2::WebACL');
      const allRules = Object.values(webAcls).flatMap(
        acl => (acl as { Properties: { Rules: { Name: string }[] } }).Properties.Rules,
      );
      const rateRuleNames = allRules.map(r => r.Name);
      expect(rateRuleNames).not.toContain('RateLimitRule');
      expect(rateRuleNames).not.toContain('RateLimitPerAuthorizationToken');
      // With rate rules gone, ipAllow reverts to the front of evaluation.
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([Match.objectLike({ Name: 'ipAllow', Priority: 2 })]),
      });
    });

    test('omits only the per-user rule when perUser.enabled is false', () => {
      const template = createWithWaf({
        allowedCidrs: ['10.0.0.0/8'],
        rateLimit: { perUser: { enabled: false } },
      });
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([Match.objectLike({ Name: 'RateLimitRule' })]),
      });
      const webAcls = template.findResources('AWS::WAFv2::WebACL');
      const allRules = Object.values(webAcls).flatMap(
        acl => (acl as { Properties: { Rules: { Name: string }[] } }).Properties.Rules,
      );
      expect(allRules.map(r => r.Name)).not.toContain('RateLimitPerAuthorizationToken');
    });

    test('throws a descriptive error when a wafRule collides with a reserved priority', () => {
      expect(() =>
        createWithWaf({
          allowedCidrs: ['10.0.0.0/8'],
          wafRules: { AWSManagedRulesCommonRuleSet: { priority: 1 } },
        }),
      ).toThrow(/priority collision/i);
    });
  });
});
