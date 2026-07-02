/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from '@jest/globals';
import {
  isStubbedBuildCommand,
  createMockCode,
  patchLambdaCode,
  stubbedExecSyncResult,
  stubbedSpawnSyncResult,
  type PatchableLambdaModule,
} from '../lib/starter-kit-synth-stubs';

type MockCode = Record<string, unknown>;

/** Invoke a patched factory (typed as unknown after a Record index) and return its mock code. */
function invokeFactory(factory: unknown): MockCode {
  expect(typeof factory).toBe('function');
  return (factory as () => MockCode)();
}

/** Resolve the deterministic S3 location a mock Code's bind() produces. */
function boundS3Location(code: MockCode): { bucketName: string; objectKey: string } {
  return (code.bind as () => { s3Location: { bucketName: string; objectKey: string } })().s3Location;
}

/** Resolve the deterministic image uri a mock image code's bind() produces. */
function boundImageUri(imageCode: MockCode): string {
  return (imageCode.bind as () => { image: { imageUri: string } })().image.imageUri;
}

describe('isStubbedBuildCommand — docker/finch positive matches', () => {
  test.each([
    'docker build .',
    'finch build .',
    '/usr/bin/docker build .',
    '/opt/homebrew/bin/finch run img',
    'cd /tmp && docker build .',
    'echo hi | docker build .',
    'set -e; docker build .',
    '(docker build .)',
  ])('matches %p', command => {
    expect(isStubbedBuildCommand(command)).toBe(true);
  });
});

describe('isStubbedBuildCommand — pip install positive matches', () => {
  test.each([
    'pip install requests',
    'pip3 install -r requirements.txt',
    '/usr/bin/pip install boto3',
    'cd /src && pip install .',
    'python -m venv .v && pip3 install wheel',
  ])('matches %p', command => {
    expect(isStubbedBuildCommand(command)).toBe(true);
  });
});

describe('isStubbedBuildCommand — false-positive guards', () => {
  test.each([
    // Substring inside a path / filename, not an invoked command.
    'cdk synth -o /build/docker-assets/out',
    'npx cdk synth --context bucket=my-docker-bucket',
    'cat /etc/finch-notes.txt',
    'cdk synth -c image=finchimage',
    // "pip" as a substring, and pip without the install subcommand.
    'cdk synth -c name=pipeline',
    'pip list',
    'pip3 --version',
    'echo "install pip later"',
    // Plain synth with no build tooling at all.
    "cd '/repo' && npx cdk synth --all",
  ])('does not match %p', command => {
    expect(isStubbedBuildCommand(command)).toBe(false);
  });

  test('does not match an empty command', () => {
    expect(isStubbedBuildCommand('')).toBe(false);
  });
});

describe('createMockCode', () => {
  test('bind returns the deterministic mock S3 location', () => {
    expect(boundS3Location(createMockCode())).toEqual({ bucketName: 'mock-bucket', objectKey: 'mock-key' });
  });

  test('_bind returns the deterministic mock image code', () => {
    const imageCode = (createMockCode()._bind as () => MockCode)();
    expect(boundImageUri(imageCode)).toBe('mock-image-uri');
  });

  test('bindToResource is a no-op on both the code and its image code', () => {
    const code = createMockCode();
    expect((code.bindToResource as () => void)()).toBeUndefined();
    const imageCode = (code._bind as () => MockCode)();
    expect((imageCode.bindToResource as () => void)()).toBeUndefined();
  });
});

describe('patchLambdaCode', () => {
  const codeMethods = [
    'fromAsset',
    'fromAssetImage',
    'fromDockerBuild',
    'fromCustomCommand',
    'fromEcrImage',
    'fromBucket',
    'fromBucketV2',
    'fromInline',
    'fromCfnParameters',
  ];

  test('replaces every Code factory method with a deterministic mock', () => {
    const lambdaModule: PatchableLambdaModule = { Code: {} };
    patchLambdaCode(lambdaModule);

    for (const method of codeMethods) {
      const code = invokeFactory(lambdaModule.Code[method]);
      expect(boundS3Location(code)).toEqual({ bucketName: 'mock-bucket', objectKey: 'mock-key' });
    }
  });

  test('patches DockerImageCode factories when present', () => {
    const lambdaModule: PatchableLambdaModule = { Code: {}, DockerImageCode: {} };
    patchLambdaCode(lambdaModule);
    const dockerImageCode = lambdaModule.DockerImageCode ?? {};

    for (const method of ['fromEcr', 'fromImageAsset']) {
      const code = invokeFactory(dockerImageCode[method]);
      const imageCode = (code._bind as () => MockCode)();
      expect(boundImageUri(imageCode)).toBe('mock-image-uri');
    }
  });

  test('leaves DockerImageCode untouched when the module has none', () => {
    const lambdaModule: PatchableLambdaModule = { Code: {} };
    expect(() => patchLambdaCode(lambdaModule)).not.toThrow();
    expect(lambdaModule.DockerImageCode).toBeUndefined();
  });
});

describe('stubbed subprocess results', () => {
  test('stubbedExecSyncResult is an empty buffer', () => {
    const result = stubbedExecSyncResult();
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  test('stubbedSpawnSyncResult reports success with empty output buffers', () => {
    const result = stubbedSpawnSyncResult();
    expect(result.status).toBe(0);
    expect(result.stdout.length).toBe(0);
    expect(result.stderr.length).toBe(0);
    expect(result.output[0]).toBeNull();
    expect(Buffer.isBuffer(result.output[1])).toBe(true);
    expect(Buffer.isBuffer(result.output[2])).toBe(true);
  });
});
