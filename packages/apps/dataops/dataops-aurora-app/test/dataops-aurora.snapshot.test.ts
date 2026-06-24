/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test, expect } from '@jest/globals';
import { Create } from '@aws-mdaa/testing';
import { DataopsAuroraApp } from '../lib/dataops-aurora';
import * as path from 'path';

describe('DataOps Aurora Snapshot Tests', () => {
  test('DataOps Aurora Comprehensive App Snapshot Test', () => {
    const appProvider = Create.appProvider(
      context => {
        const moduleApp = new DataopsAuroraApp({
          context: {
            ...context,
            module_configs: path.join(__dirname, '..', 'sample_configs', 'sample-config-comprehensive.yaml'),
          },
        });
        moduleApp.generateStack();
        return moduleApp;
      },
      {
        module_name: 'test-aurora-main',
        org: 'test-org',
        env: 'test-env',
        domain: 'test-domain',
      },
    );

    const app = appProvider();
    expect(app).toBeDefined();
    const assembly = app.synth();
    expect(assembly.stacks.length).toBeGreaterThan(0);
  });

  test('DataOps Aurora Minimal App Snapshot Test', () => {
    const appProvider = Create.appProvider(
      context => {
        const moduleApp = new DataopsAuroraApp({
          context: {
            ...context,
            module_configs: path.join(__dirname, '..', 'sample_configs', 'sample-config-minimal.yaml'),
          },
        });
        moduleApp.generateStack();
        return moduleApp;
      },
      {
        module_name: 'test-aurora-minimal',
        org: 'test-org',
        env: 'test-env',
        domain: 'test-domain',
      },
    );

    const app = appProvider();
    expect(app).toBeDefined();
    const assembly = app.synth();
    expect(assembly.stacks.length).toBeGreaterThan(0);
  });

  test('DataOps Aurora NoProject App Snapshot Test', () => {
    const appProvider = Create.appProvider(
      context => {
        const moduleApp = new DataopsAuroraApp({
          context: {
            ...context,
            module_configs: path.join(__dirname, '..', 'sample_configs', 'sample-config-noproject.yaml'),
          },
        });
        moduleApp.generateStack();
        return moduleApp;
      },
      {
        module_name: 'test-aurora-noproject',
        org: 'test-org',
        env: 'test-env',
        domain: 'test-domain',
      },
    );

    const app = appProvider();
    expect(app).toBeDefined();
    const assembly = app.synth();
    expect(assembly.stacks.length).toBeGreaterThan(0);
  });
});
