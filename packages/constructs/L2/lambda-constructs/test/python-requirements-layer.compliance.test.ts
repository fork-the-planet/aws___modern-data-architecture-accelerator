/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaTestApp } from '@aws-mdaa/testing';
import { MdaaResourceType } from '@aws-mdaa/naming';
import { Template } from 'aws-cdk-lib/assertions';
import {
  MdaaPythonRequirementsLayerVersion,
  MdaaPythonRequirementsLayerVersionProps,
} from '../lib/python-requirements-layer';

// MdaaPythonCodeAsset shells out to Docker / a custom command to materialize
// the layer asset; mock it so this stays a pure synth/compliance test.
jest.mock('../lib/code-asset', () => ({
  MdaaPythonCodeAsset: jest.fn().mockImplementation(() => ({
    code: {
      bind: () => ({ s3Location: { bucketName: 'mock-bucket', objectKey: 'mock-key' } }),
      bindToResource: () => undefined,
    },
  })),
  PythonVersion: { '3.12': '3.12' },
}));

describe('MDAA Construct Compliance Tests', () => {
  const testApp = new MdaaTestApp();

  const props: MdaaPythonRequirementsLayerVersionProps = {
    naming: testApp.naming,
    pythonRequirementsPath: '/fake/requirements.txt',
    layerVersionName: 'requirements',
  };

  new MdaaPythonRequirementsLayerVersion(testApp.testStack, 'test-construct', props);

  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('LayerName uses LAMBDA_LAYER resource type', () => {
    template.hasResourceProperties('AWS::Lambda::LayerVersion', {
      LayerName: testApp.naming.withResourceType(MdaaResourceType.LAMBDA_LAYER).resourceName('requirements'),
    });
  });
});
