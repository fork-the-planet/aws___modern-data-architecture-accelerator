/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  isConfigReference,
  validateDeployAccountResolved,
  validateDeployAccountValueOrRef,
  validateDeployRegionResolved,
  validateDeployRegionValueOrRef,
  validateDeployments,
} from '../lib/deployment-target-validator';
import { Deployment } from '../lib/deployment-types';

describe('validateDeployRegionResolved', () => {
  it.each(['us-east-1', 'eu-west-2', 'ap-southeast-1', 'us-gov-west-1', 'cn-north-1'])(
    'accepts valid region %s',
    region => {
      expect(validateDeployRegionResolved(region, 'test')).toBe(region);
    },
  );

  it.each([
    'us-east-1$(id)',
    'us-east-1$(id > /tmp/pwned)',
    'us-east-1;id',
    'us-east-1 && id',
    'us-east-1|id',
    'us-east-1`id`',
    'us-east-1\nid',
    '$(curl evil)',
    'us-east-1 ',
    'US-EAST-1',
    'us_east_1',
  ])('rejects invalid region %j', region => {
    expect(() => validateDeployRegionResolved(region, 'test')).toThrow(/Invalid region/);
  });

  it('includes the context in the error message', () => {
    expect(() => validateDeployRegionResolved('bad;region', 'module test-domain/test-env/test-module')).toThrow(
      /module test-domain\/test-env\/test-module/,
    );
  });
});

describe('validateDeployAccountResolved', () => {
  it.each(['123456789012', '999999999999'])('accepts valid 12-digit account %s', account => {
    expect(validateDeployAccountResolved(account, 'test')).toBe(account);
  });

  it.each([
    '123456789012$(id)',
    '123456789012;id',
    '12345',
    '1234567890123',
    'default',
    'account-id',
    '$(id)',
    '123456789012 ',
  ])('rejects invalid account %j', account => {
    expect(() => validateDeployAccountResolved(account, 'test')).toThrow(/Invalid account/);
  });

  it('includes the context in the error message', () => {
    expect(() => validateDeployAccountResolved('nope', 'additional_stacks[0].account')).toThrow(
      /additional_stacks\[0\]\.account/,
    );
  });
});

describe('validateDeployments', () => {
  it('accepts deployments with valid account/region', () => {
    const deployments: Deployment[] = [
      { account: '123456789012', region: 'us-east-1' },
      { account: '999999999999' },
      { region: 'eu-west-1' },
    ];
    expect(() => validateDeployments(deployments)).not.toThrow();
  });

  it('skips the default sentinel for account and region', () => {
    const deployments: Deployment[] = [{ account: 'default', region: 'default' }];
    expect(() => validateDeployments(deployments)).not.toThrow();
  });

  it('accepts an empty deployment list', () => {
    expect(() => validateDeployments([])).not.toThrow();
  });

  it('rejects an invalid account in additional_stacks', () => {
    const deployments: Deployment[] = [{ account: '123456789012' }, { account: '$(id)' }];
    expect(() => validateDeployments(deployments)).toThrow(/additional_stacks\[1\]\.account/);
  });

  it('rejects an invalid region in additional_stacks', () => {
    const deployments: Deployment[] = [{ region: 'us-east-1;curl evil' }];
    expect(() => validateDeployments(deployments)).toThrow(/additional_stacks\[0\]\.region/);
  });
});

describe('isConfigReference', () => {
  it.each(['{{context:team_account}}', '{{env_var:PROD_REGION}}', '{{account}}', 'prefix-{{region}}-suffix'])(
    'detects a reference in %j',
    value => {
      expect(isConfigReference(value)).toBe(true);
    },
  );

  it.each(['us-east-1', '123456789012', 'default', 'us-east-1$(id)', '{{unterminated', 'no braces'])(
    'does not treat %j as a reference',
    value => {
      expect(isConfigReference(value)).toBe(false);
    },
  );
});

describe('validateDeployRegionValueOrRef', () => {
  it.each(['{{context:region}}', '{{region}}', 'default', 'DEFAULT', 'us-east-1'])(
    'passes through reference/sentinel/valid value %j',
    value => {
      expect(validateDeployRegionValueOrRef(value, 'test')).toBe(value);
    },
  );

  it.each(['us-east-1$(id)', 'us-east-1;id', 'US-EAST-1'])('rejects concrete invalid region %j', value => {
    expect(() => validateDeployRegionValueOrRef(value, 'test')).toThrow(/Invalid region/);
  });

  // A payload mixing a reference with metacharacters is deferred here but must
  // still be caught by the resolved-value validator downstream.
  it('defers a mixed reference/metacharacter value at parse time', () => {
    expect(validateDeployRegionValueOrRef('{{region}}$(id)', 'test')).toBe('{{region}}$(id)');
    expect(() => validateDeployRegionResolved('{{region}}$(id)', 'test')).toThrow(/Invalid region/);
  });
});

describe('validateDeployAccountValueOrRef', () => {
  it.each(['{{context:account}}', '{{account}}', 'default', '123456789012'])(
    'passes through reference/sentinel/valid value %j',
    value => {
      expect(validateDeployAccountValueOrRef(value, 'test')).toBe(value);
    },
  );

  it.each(['123456789012$(id)', 'not-an-account', '12345'])('rejects concrete invalid account %j', value => {
    expect(() => validateDeployAccountValueOrRef(value, 'test')).toThrow(/Invalid account/);
  });
});
