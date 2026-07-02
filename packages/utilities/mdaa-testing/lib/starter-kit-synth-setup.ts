/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Starter kit synth setup — compiled by the standard tsc build to a sibling
 * .js (see getSynthSetupPath in starter-kit-diff.ts) and injected into the CDK
 * child processes spawned during starter kit baseline/diff tests via
 * NODE_OPTIONS=--require.
 *
 * Authored in TypeScript so it is type-checked, linted, and license-header
 * managed like the rest of the package; Node's --require loads the compiled
 * .js because it cannot load .ts directly.
 *
 * Replicates the mocks from jest.setup.js for subprocess execution:
 * 1. command-exists → sync returns false (no Docker/finch detected)
 * 2. Fact.register → maps 'test-region' to partition 'test-partition'
 * 3. Code.fromDockerBuild → returns deterministic mock code
 * 4. Code.fromCustomCommand → returns deterministic mock code
 * 5. child_process intercepts for docker/pip commands
 */

'use strict';

// Pure decision logic and deterministic mock shapes live in a sibling module
// so they can be unit-tested without triggering the Node-internals patching
// performed below (which would pollute a test runner's own process).
import {
  isStubbedBuildCommand,
  patchLambdaCode,
  stubbedExecSyncResult,
  stubbedSpawnSyncResult,
  type PatchableLambdaModule,
} from './starter-kit-synth-stubs';

// `require` is used throughout (rather than `import`) because this module is
// compiled to CommonJS and intentionally reaches into Node internals
// (Module._load) that are not part of the public typings.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('node:module');

// --- Mock command-exists ---
// Pre-populate require cache so it never hits disk
const commandExistsMock: { sync: () => boolean; default?: unknown } = { sync: () => false };
commandExistsMock.default = commandExistsMock;

try {
  const resolved = require.resolve('command-exists');
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: commandExistsMock,
  } as unknown as (typeof require.cache)[string];
} catch {
  // command-exists not installed
}

// --- Register test-region partition fact ---
// CDK's Stack.partition uses Fact.find when enablePartitionLiterals is true
// (set by MDAA app). Without this, partition is a token and cross-account
// ARN construction fails with 'stringParameterArn cannot be an unresolved token'.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Fact } = require('aws-cdk-lib/region-info');
  Fact.register({ region: 'test-region', name: 'partition', value: 'test-partition' }, true);
} catch {
  // aws-cdk-lib not available
}

// --- Mock Code.fromDockerBuild and Code.fromCustomCommand ---
// Intercept aws-cdk-lib/aws-lambda to stub Code factory methods that
// trigger Docker/pip builds and produce non-deterministic output.
const originalLoad = Module._load;
let lambdaModulePatched = false;

Module._load = function (this: unknown, request: string, parent: unknown, isMain?: boolean) {
  const result = originalLoad.call(this, request, parent, isMain);

  // Patch the Lambda module's Code/DockerImageCode factory methods after the
  // module is first loaded. This mirrors mockCodeFactoryMethods() in
  // @aws-mdaa/testing/lib/diff.ts exactly, so starter kit synth output matches
  // module-level diff test output (deterministic 'mock-key' S3Key, no real
  // asset bundling / Docker / filesystem hashing).
  if (!lambdaModulePatched && result?.Code && request.includes('aws-cdk-lib') && request.includes('lambda')) {
    patchLambdaCode(result as PatchableLambdaModule);
    lambdaModulePatched = true;
  }

  return result;
};

// --- Intercept child_process for docker/pip commands ---
// eslint-disable-next-line @typescript-eslint/no-require-imports
const childProcess = require('node:child_process');
const originalExecSync = childProcess.execSync;
const originalSpawnSync = childProcess.spawnSync;

childProcess.execSync = function (this: unknown, command: string, options?: unknown) {
  if (isStubbedBuildCommand(String(command))) {
    return stubbedExecSyncResult();
  }
  return originalExecSync.call(this, command, options);
};

childProcess.spawnSync = function (this: unknown, command: string, args?: string[], options?: unknown) {
  const fullCommand = [command, ...(args ?? [])].join(' ');
  if (isStubbedBuildCommand(fullCommand)) {
    return stubbedSpawnSyncResult();
  }
  return originalSpawnSync.call(this, command, args, options);
};
