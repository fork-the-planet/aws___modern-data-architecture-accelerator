/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generic starter kit diff test driver.
 *
 * Replaces per-kit .diff.test.ts files. The Python orchestrator sets
 * environment variables before invoking jest:
 *   STARTER_KIT_NAME     — the kit directory name (e.g. "basic_datalake")
 *   STARTER_KIT_MODULES  — JSON array of {domain, module} pairs from mdaa.yaml
 *
 * This file registers one baselineCliCommands test + one baselineModuleSynth
 * test per module, using those env vars. jest --testNamePattern then filters
 * to only the affected ones.
 *
 * Per-kit overrides (cdkContext for SSM seeding, _cdk_default_account) live in
 * an optional test/<kit>/kit-config.json alongside the baselines.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe } from '@jest/globals';
import { baselineCliCommands, baselineModuleSynth, StarterKitTestContext } from '@aws-mdaa/testing';

interface KitModule {
  domain: string;
  module: string;
}

interface KitConfig {
  /** Override for CDK_DEFAULT_ACCOUNT (defaults to the global map's first account). */
  _cdk_default_account?: string;
  /** Per-module cdkContext overrides keyed by "domain/module". */
  cdkContext?: Record<string, Record<string, string>>;
}

const kitName = process.env.STARTER_KIT_NAME;
const modulesJson = process.env.STARTER_KIT_MODULES;

if (!kitName || !modulesJson) {
  // When jest discovers this file without the env vars (e.g. running all tests
  // without the orchestrator), skip gracefully rather than failing.
  describe('Starter Kit Diff Tests (skipped — no STARTER_KIT_NAME/MODULES env)', () => {
    // No tests registered; --passWithNoTests lets this pass.
  });
} else {
  const modules: KitModule[] = JSON.parse(modulesJson);

  // Load optional per-kit config (cdkContext overrides, _cdk_default_account).
  const configPath = path.join(__dirname, kitName, 'kit-config.json');
  const kitConfig: KitConfig = fs.existsSync(configPath)
    ? (JSON.parse(fs.readFileSync(configPath, 'utf-8')) as KitConfig)
    : {};

  const context: StarterKitTestContext = {};
  if (kitConfig._cdk_default_account) {
    context._cdk_default_account = kitConfig._cdk_default_account;
  }

  describe(`${kitName} Starter Kit`, () => {
    // Test 1: CLI command baseline
    baselineCliCommands(kitName, context);

    // Test 2: Per-module synth baselines (one per module from mdaa.yaml)
    for (const { domain, module } of modules) {
      const moduleKey = `${domain}/${module}`;
      const cdkContext = kitConfig.cdkContext?.[moduleKey];
      if (cdkContext) {
        baselineModuleSynth(kitName, domain, module, context, { cdkContext });
      } else {
        baselineModuleSynth(kitName, domain, module, context);
      }
    }
  });
}
