/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSources } from '../lib/source-loader';
import { projectKiro } from '../lib/projectors/kiro';
import { projectClaude } from '../lib/projectors/claude';
import { projectCopilot } from '../lib/projectors/copilot';
import { projectCursor } from '../lib/projectors/cursor';
import { projectWindsurf } from '../lib/projectors/windsurf';
import { ProjectionResult, Rule } from '../lib/types';

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..', '..');
const STEERING_DIR = path.join(REPO_ROOT, '.kiro', 'steering');
const RULES_DIR = path.join(REPO_ROOT, 'agent_rules');

/**
 * Critical regression guard: every projector must produce output that is
 * byte-identical to the checked-in per-tool files. The MDAA review-agent
 * infrastructure and consumer projects read these files directly, so any drift
 * — including the canonical-directory references (`agent_rules/`), the relative
 * link depth (e.g. `../../agent_rules/` for two-level-deep layouts like
 * `.claude/rules/`), and the auto-generated preamble — breaks them.
 */
const PROJECTORS: { tool: string; project: (rules: readonly Rule[]) => ProjectionResult }[] = [
  { tool: 'kiro', project: projectKiro },
  { tool: 'claude', project: projectClaude },
  { tool: 'copilot', project: projectCopilot },
  { tool: 'cursor', project: projectCursor },
  { tool: 'windsurf', project: projectWindsurf },
];

describe.each(PROJECTORS)('byte equivalence with checked-in $tool projection', ({ project }) => {
  it('projection equals every checked-in file', () => {
    const sources = loadSources({ rulesDir: RULES_DIR });
    const projection = project(sources.rules);

    expect(projection.files.length).toBeGreaterThan(0);
    for (const file of projection.files) {
      const onDisk = path.join(REPO_ROOT, file.path);
      expect(fs.existsSync(onDisk)).toBe(true);
      const actual = fs.readFileSync(onDisk, 'utf8');
      expect({ path: file.path, contents: actual }).toEqual({
        path: file.path,
        contents: file.contents,
      });
    }
  });
});

describe('Kiro projection ownership', () => {
  it('every on-disk .kiro/steering file is owned by the projector', () => {
    const sources = loadSources({ rulesDir: RULES_DIR });
    const projected = new Set(projectKiro(sources.rules).files.map(f => path.basename(f.path)));
    const onDisk = fs.readdirSync(STEERING_DIR).filter(f => f.endsWith('.md'));

    for (const file of onDisk) {
      expect(projected.has(file)).toBe(true);
    }
  });
});
