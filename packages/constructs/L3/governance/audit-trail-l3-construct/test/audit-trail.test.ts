/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuditTrailL3Construct, AuditTrailL3ConstructProps } from '../lib';

describe('Event Selector Resolution', () => {
  const testApp = new MdaaTestApp();
  const stack = testApp.testStack;

  const constructProps: AuditTrailL3ConstructProps = {
    trail: {
      cloudTrailAuditBucketName: 'some-bucket-name',
      cloudTrailAuditKmsKeyArn: 'arn:test-partition:kms:test-region:test-account:key/some-key-id',
      includeManagementEvents: false,
      eventSelectors: [{ bucketName: 'data-bucket-1', objectPrefix: 'raw/' }, { bucketName: 'data-bucket-2' }],
    },

    roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    naming: testApp.naming,
  };

  new AuditTrailL3Construct(stack, 'teststack', constructProps);
  const template = Template.fromStack(testApp.testStack);

  test('Trail has scoped S3 event selectors with prefix', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      EventSelectors: Match.arrayWith([
        Match.objectLike({
          DataResources: [
            {
              Type: 'AWS::S3::Object',
              Values: ['arn:test-partition:s3:::data-bucket-1/raw/'],
            },
          ],
        }),
      ]),
    });
  });

  test('Trail has event selector for bucket without prefix', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      EventSelectors: Match.arrayWith([
        Match.objectLike({
          DataResources: [
            {
              Type: 'AWS::S3::Object',
              Values: ['arn:test-partition:s3:::data-bucket-2/'],
            },
          ],
        }),
      ]),
    });
  });

  test('Event selectors have ReadWriteType ALL', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      EventSelectors: Match.arrayWith([
        Match.objectLike({
          ReadWriteType: 'All',
        }),
      ]),
    });
  });

  test('Event selectors do not include management events when false', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      EventSelectors: Match.arrayWith([
        Match.objectLike({
          IncludeManagementEvents: false,
        }),
      ]),
    });
  });
});

describe('Multiple Named Trails', () => {
  const testApp = new MdaaTestApp();
  const stack = testApp.testStack;

  const constructProps: AuditTrailL3ConstructProps = {
    trails: {
      'datalake-audit': {
        cloudTrailAuditBucketName: 'datalake-audit-bucket',
        cloudTrailAuditKmsKeyArn: 'arn:test-partition:kms:test-region:test-account:key/datalake-key-id',
        includeManagementEvents: false,
        eventSelectors: [{ bucketName: 'raw-data-bucket', objectPrefix: 'sensitive/' }],
      },
      'analytics-audit': {
        cloudTrailAuditBucketName: 'analytics-audit-bucket',
        cloudTrailAuditKmsKeyArn: 'arn:test-partition:kms:test-region:test-account:key/analytics-key-id',
        includeManagementEvents: true,
      },
    },

    roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    naming: testApp.naming,
  };

  new AuditTrailL3Construct(stack, 'teststack', constructProps);
  const template = Template.fromStack(testApp.testStack);

  test('Creates multiple trails', () => {
    template.resourceCountIs('AWS::CloudTrail::Trail', 2);
  });

  test('Datalake trail has correct name', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-datalake-audit',
    });
  });

  test('Analytics trail has correct name', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-analytics-audit',
    });
  });

  test('Datalake trail has scoped event selectors', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-datalake-audit',
      EventSelectors: Match.arrayWith([
        Match.objectLike({
          DataResources: [
            {
              Type: 'AWS::S3::Object',
              Values: ['arn:test-partition:s3:::raw-data-bucket/sensitive/'],
            },
          ],
        }),
      ]),
    });
  });

  test('Analytics trail logs all S3 data events', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-analytics-audit',
      EventSelectors: Match.arrayWith([
        Match.objectLike({
          IncludeManagementEvents: true,
        }),
      ]),
    });
  });

  test('Each trail uses its own S3 bucket', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-datalake-audit',
      S3BucketName: 'datalake-audit-bucket',
    });
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-analytics-audit',
      S3BucketName: 'analytics-audit-bucket',
    });
  });

  test('Each trail uses its own KMS key', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-datalake-audit',
      KMSKeyId: 'arn:test-partition:kms:test-region:test-account:key/datalake-key-id',
    });
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-analytics-audit',
      KMSKeyId: 'arn:test-partition:kms:test-region:test-account:key/analytics-key-id',
    });
  });
});

describe('Combined trail and trails', () => {
  const testApp = new MdaaTestApp();
  const stack = testApp.testStack;

  const constructProps: AuditTrailL3ConstructProps = {
    trail: {
      cloudTrailAuditBucketName: 'legacy-bucket',
      cloudTrailAuditKmsKeyArn: 'arn:test-partition:kms:test-region:test-account:key/legacy-key-id',
      includeManagementEvents: true,
    },
    trails: {
      'extra-trail': {
        cloudTrailAuditBucketName: 'extra-bucket',
        cloudTrailAuditKmsKeyArn: 'arn:test-partition:kms:test-region:test-account:key/extra-key-id',
        includeManagementEvents: false,
      },
    },

    roleHelper: new MdaaRoleHelper(stack, testApp.naming),
    naming: testApp.naming,
  };

  new AuditTrailL3Construct(stack, 'teststack', constructProps);
  const template = Template.fromStack(testApp.testStack);

  test('Creates trails from both trail and trails config', () => {
    template.resourceCountIs('AWS::CloudTrail::Trail', 2);
  });

  test('Legacy trail preserves s3-audit name', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-s3-audit',
      S3BucketName: 'legacy-bucket',
    });
  });

  test('Extra trail uses its configured name', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'test-org-test-env-test-domain-test-module-extra-trail',
      S3BucketName: 'extra-bucket',
    });
  });
});
