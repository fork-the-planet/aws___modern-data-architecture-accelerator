/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure, side-effect-free helpers backing starter-kit-synth-setup.ts.
 *
 * starter-kit-synth-setup.ts patches Node internals (Module._load and
 * child_process) at require time, so it cannot be imported into a unit test
 * without polluting the test runner's own process. The decision logic and the
 * deterministic mock shapes are therefore factored out here, where they can be
 * imported and asserted in isolation. The setup module is a thin wiring layer
 * over these functions.
 */

/**
 * Matches docker/finch only when invoked as a command: at the start of the
 * string or immediately after a shell separator (whitespace, `;`, `&`, `|`,
 * parentheses), optionally prefixed by a path. Anchoring on the executable
 * token avoids false positives where `docker`/`finch` appear inside an
 * argument, path, or context value — which would otherwise silently stub a
 * real `cdk synth`.
 */
export const DOCKER_FINCH_COMMAND = /(?:^|[\s;&|()])(?:[^\s;&|()]*\/)?(?:docker|finch)(?:\s|$)/;

/**
 * Matches `pip install` / `pip3 install` only when `pip` is invoked as a
 * command (same anchoring rationale as {@link DOCKER_FINCH_COMMAND}). The
 * `install` subcommand is required so that unrelated mentions of `pip` do not
 * match.
 */
export const PIP_INSTALL_COMMAND = /(?:^|[\s;&|()])(?:[^\s;&|()]*\/)?pip3?\s+install(?:\s|$)/;

/**
 * True when the command should be stubbed (Docker/finch build or pip install)
 * rather than executed, so synth output stays deterministic and offline.
 */
export function isStubbedBuildCommand(commandString: string): boolean {
  return DOCKER_FINCH_COMMAND.test(commandString) || PIP_INSTALL_COMMAND.test(commandString);
}

/** Deterministic result returned by the intercepted `execSync`. */
export function stubbedExecSyncResult(): Buffer {
  return Buffer.from('');
}

/** Deterministic result returned by the intercepted `spawnSync`. */
export function stubbedSpawnSyncResult(): {
  status: number;
  stdout: Buffer;
  stderr: Buffer;
  output: (Buffer | null)[];
} {
  return {
    status: 0,
    stdout: Buffer.from(''),
    stderr: Buffer.from(''),
    output: [null, Buffer.from(''), Buffer.from('')],
  };
}

/** Shape of the Lambda module whose Code factories are patched. */
export interface PatchableLambdaModule {
  Code: Record<string, unknown>;
  DockerImageCode?: Record<string, unknown>;
}

/**
 * The deterministic mock returned by every patched Code factory method.
 * `_bind` returns the image mock so DockerImageFunction code paths resolve.
 */
export function createMockCode(): Record<string, unknown> {
  const mockImageCode = {
    bind: () => ({ image: { imageUri: 'mock-image-uri' } }),
    bindToResource: () => {},
  };
  return {
    bind: () => ({ s3Location: { bucketName: 'mock-bucket', objectKey: 'mock-key' } }),
    bindToResource: () => {},
    _bind: () => mockImageCode,
  };
}

/**
 * Replaces the Lambda module's Code / DockerImageCode factory methods with
 * deterministic mocks. Mirrors mockCodeFactoryMethods() in
 * @aws-mdaa/testing/lib/diff.ts so starter kit synth output matches
 * module-level diff test output (no real asset bundling / Docker / filesystem
 * hashing).
 */
export function patchLambdaCode(lambdaModule: PatchableLambdaModule): void {
  const mockCode = createMockCode();

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
