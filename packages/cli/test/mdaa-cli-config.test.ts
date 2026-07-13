/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaCliConfig, MdaaConfigContents } from '../lib/mdaa-cli-config-parser';

test('ConfigParseTest', () => {
  expect(() => new MdaaCliConfig({ filename: 'test/resources/mdaa.yaml' })).not.toThrow();
});

test('BadOrgNameTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test_bad_org',
    domains: {},
  };

  expect(() => new MdaaCliConfig({ configContents: configContents })).toThrow();
});

test('GoodOrgNameTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {},
  };

  expect(() => new MdaaCliConfig({ configContents: configContents })).not.toThrow();
});

test('BadDomainNameTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {
      test_bad_domain: {
        environments: {},
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents: configContents })).toThrow();
});

test('GoodDomainNameTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {
      'test-good-domain': {
        environments: {},
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents: configContents })).not.toThrow();
});

test('BadEnvNameTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {
      'test-good-domain': {
        environments: {
          test_bad_env: {
            modules: {},
          },
        },
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents: configContents })).toThrow();
});

test('GoodEnvNameTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {
      'test-good-domain': {
        environments: {
          'test-good-env': {
            modules: {},
          },
        },
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents: configContents })).not.toThrow();
});

test('BadModuleNameTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {
      'test-good-domain': {
        environments: {
          'test-good-env': {
            modules: {
              test_bad_module: {
                module_path: 'test',
              },
            },
          },
        },
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents: configContents })).toThrow();
});

test('GoodModuleNameTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {
      'test-good-domain': {
        environments: {
          'test-good-env': {
            modules: {
              'test-good-module': {
                module_path: 'test',
              },
            },
          },
        },
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents: configContents })).not.toThrow();
});

test('TerraformModuleTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {
      'test-good-domain': {
        environments: {
          'test-good-env': {
            modules: {
              'test-tf-mdaa-module': {
                module_type: 'tf',
                module_path: 'aws-mdaa/test',
              },
              'test-tf-3p-mdaa-module': {
                module_type: 'tf',
                mdaa_compliant: true,
              },
              'test-tf-3p-module': {
                module_type: 'tf',
                mdaa_compliant: false,
              },
            },
          },
        },
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents: configContents })).not.toThrow();
});

const configWithEnvTarget = (target: { region?: string; account?: string }): MdaaConfigContents => ({
  organization: 'test-good-org',
  domains: {
    'test-good-domain': {
      environments: {
        'test-good-env': {
          ...target,
          modules: {},
        },
      },
    },
  },
});

test('BadRegionValueTest', () => {
  expect(() => new MdaaCliConfig({ configContents: configWithEnvTarget({ region: 'us-east-1$(id)' }) })).toThrow(
    /Invalid region/,
  );
});

test('BadAccountValueTest', () => {
  expect(() => new MdaaCliConfig({ configContents: configWithEnvTarget({ account: 'not-an-account' }) })).toThrow(
    /Invalid account/,
  );
});

test('BadGlobalRegionValueTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    region: 'us-east-1;curl evil',
    domains: {},
  };
  expect(() => new MdaaCliConfig({ configContents })).toThrow(/Invalid region/);
});

test('BadDomainAccountValueTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {
      'test-good-domain': {
        account: 'not-an-account',
        environments: {},
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents })).toThrow(/Invalid account.*domain test-good-domain/);
});

test('BadEnvTemplateRegionValueTest', () => {
  const configContents: MdaaConfigContents = {
    organization: 'test-good-org',
    domains: {},
    env_templates: {
      'test-template': {
        region: 'us-east-1$(id)',
        modules: {},
      },
    },
  };
  expect(() => new MdaaCliConfig({ configContents })).toThrow(/Invalid region.*env_template test-template/);
});

test('GoodRegionAccountValueTest', () => {
  expect(
    () => new MdaaCliConfig({ configContents: configWithEnvTarget({ region: 'us-east-1', account: '123456789012' }) }),
  ).not.toThrow();
});

test('ReferenceRegionAccountDeferredAtParseTest', () => {
  // Dynamic references are not resolvable at parse time; they must pass parsing
  // and be validated later once resolved.
  expect(
    () =>
      new MdaaCliConfig({
        configContents: configWithEnvTarget({ region: '{{env_var:PROD_REGION}}', account: '{{context:team_account}}' }),
      }),
  ).not.toThrow();
});

test('DefaultRegionAccountValueTest', () => {
  expect(
    () => new MdaaCliConfig({ configContents: configWithEnvTarget({ region: 'default', account: 'default' }) }),
  ).not.toThrow();
});
