/**
 * Starter kit synth setup — injected into the CDK child processes spawned during
 * starter kit baseline/diff tests via NODE_OPTIONS=--require.
 *
 * Replicates the mocks from jest.setup.js for subprocess execution:
 * 1. command-exists → sync returns false (no Docker/finch detected)
 * 2. Fact.register → maps 'test-region' to partition 'test-partition'
 * 3. Code.fromDockerBuild → returns deterministic mock code
 * 4. Code.fromCustomCommand → returns deterministic mock code
 * 5. child_process intercepts for docker/pip commands
 */

'use strict';

const Module = require('module');

// --- Mock command-exists ---
// Pre-populate require cache so it never hits disk
const commandExistsMock = { sync: () => false };
commandExistsMock.default = commandExistsMock;

try {
  const resolved = require.resolve('command-exists');
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: commandExistsMock,
  };
} catch (_) {
  // command-exists not installed
}

// --- Register test-region partition fact ---
// CDK's Stack.partition uses Fact.find when enablePartitionLiterals is true
// (set by MDAA app). Without this, partition is a token and cross-account
// ARN construction fails with 'stringParameterArn cannot be an unresolved token'.
try {
  const { Fact } = require('aws-cdk-lib/region-info');
  Fact.register({ region: 'test-region', name: 'partition', value: 'test-partition' }, true);
} catch (_) {
  // aws-cdk-lib not available
}

// --- Mock Code.fromDockerBuild and Code.fromCustomCommand ---
// Intercept aws-cdk-lib/aws-lambda to stub Code factory methods that
// trigger Docker/pip builds and produce non-deterministic output.
const originalLoad = Module._load;
let lambdaModulePatched = false;

Module._load = function (request, parent, isMain) {
  const result = originalLoad.call(this, request, parent, isMain);

  // Patch the Lambda module's Code/DockerImageCode factory methods after the
  // module is first loaded. This mirrors mockCodeFactoryMethods() in
  // @aws-mdaa/testing/lib/diff.ts exactly, so starter kit synth output matches
  // module-level diff test output (deterministic 'mock-key' S3Key, no real
  // asset bundling / Docker / filesystem hashing).
  if (!lambdaModulePatched && result && result.Code && request.includes('aws-cdk-lib') && request.includes('lambda')) {
    patchLambdaCode(result);
    lambdaModulePatched = true;
  }

  return result;
};

// mockImageCode + mockCode replicate the objects returned by the module-level
// mocks. mockCode._bind returns mockImageCode for DockerImageFunction paths.
function patchLambdaCode(lambdaModule) {
  const mockImageCode = {
    bind: () => ({ image: { imageUri: 'mock-image-uri' } }),
    bindToResource: () => {},
  };
  const mockCode = {
    bind: () => ({ s3Location: { bucketName: 'mock-bucket', objectKey: 'mock-key' } }),
    bindToResource: () => {},
    _bind: () => mockImageCode,
  };

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
  for (const method of codeMethods) {
    lambdaModule.Code[method] = () => mockCode;
  }

  if (lambdaModule.DockerImageCode) {
    lambdaModule.DockerImageCode.fromEcr = () => mockCode;
    lambdaModule.DockerImageCode.fromImageAsset = () => mockCode;
  }
}

// --- Intercept child_process for docker/pip commands ---
const childProcess = require('child_process');
const originalExecSync = childProcess.execSync;
const originalSpawnSync = childProcess.spawnSync;

// Match docker/finch only when invoked as a command (start of string or
// immediately after a shell separator like &&, ||, ;, |, or a leading path),
// and pip only as `pip[3] install`. Anchoring on the executable token avoids
// false positives where these substrings appear inside an argument, path, or
// context value (which would otherwise silently stub a real `cdk synth`).
const DOCKER_FINCH_COMMAND = /(?:^|[\s;&|()])(?:[^\s;&|()]*\/)?(?:docker|finch)(?:\s|$)/;
const PIP_INSTALL_COMMAND = /(?:^|[\s;&|()])(?:[^\s;&|()]*\/)?pip3?\s+install(?:\s|$)/;

function isStubbedBuildCommand(commandString) {
  return DOCKER_FINCH_COMMAND.test(commandString) || PIP_INSTALL_COMMAND.test(commandString);
}

childProcess.execSync = function (command, options) {
  if (isStubbedBuildCommand(String(command))) {
    return Buffer.from('');
  }
  return originalExecSync.call(this, command, options);
};

childProcess.spawnSync = function (command, args, options) {
  const fullCommand = [String(command), ...(args || [])].join(' ');
  if (isStubbedBuildCommand(fullCommand)) {
    return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), output: [null, Buffer.from(''), Buffer.from('')] };
  }
  return originalSpawnSync.call(this, command, args, options);
};
