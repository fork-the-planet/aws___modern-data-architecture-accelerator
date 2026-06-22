/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe } from '@jest/globals';
import { baselineCliCommands, baselineModuleSynth } from '@aws-mdaa/testing';

const CONTEXT = {};

describe('Datazone Governed Lakehouse Starter Kit', () => {
  // Test 1: CLI command baseline (validates config parsing, module resolution, ordering)
  baselineCliCommands('datazone_governed_lakehouse', CONTEXT);

  // Test 2: Per-module synth baselines (validates synthesized CloudFormation)
  baselineModuleSynth('datazone_governed_lakehouse', 'data1', 'datalake', CONTEXT);
  baselineModuleSynth('datazone_governed_lakehouse', 'dataops1', 'crawler1', CONTEXT);
  baselineModuleSynth('datazone_governed_lakehouse', 'dataops1', 'project1', CONTEXT);
  baselineModuleSynth('datazone_governed_lakehouse', 'dataops1', 'project2', CONTEXT);
  baselineModuleSynth('datazone_governed_lakehouse', 'dataops1', 'project3', CONTEXT);
  baselineModuleSynth('datazone_governed_lakehouse', 'govern1', 'datazone', CONTEXT);
  baselineModuleSynth('datazone_governed_lakehouse', 'govern1', 'glue-catalog', CONTEXT);
  baselineModuleSynth('datazone_governed_lakehouse', 'govern1', 'lakeformation-settings', CONTEXT);
  baselineModuleSynth('datazone_governed_lakehouse', 'govern1', 'roles', CONTEXT);
});
