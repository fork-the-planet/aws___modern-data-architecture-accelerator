/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadSources } from '../lib/source-loader';
import { projectKiro } from '../lib/projectors/kiro';

/**
 * Critical regression guard: the Kiro projection must produce a byte-identical
 * .kiro/steering/<name>.md for every manifest entry. The MDAA review-agent
 * infrastructure (scripts/review/lib/kiro_integration.py and the agents that
 * pipe `#[[file:...]]` directives through kiro-cli) reads these files
 * directly. Any drift here breaks CI.
 */
describe('byte equivalence with checked-in .kiro/steering', () => {
  const PACKAGE_ROOT = path.resolve(__dirname, '..');
  const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..', '..');
  const STEERING_DIR = path.join(REPO_ROOT, '.kiro', 'steering');

  it('Kiro projection equals every checked-in .kiro/steering file', () => {
    const sources = loadSources({ packageRoot: PACKAGE_ROOT });
    const projection = projectKiro(sources.rules);

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

  it('every on-disk .kiro/steering file is owned by the projector', () => {
    const sources = loadSources({ packageRoot: PACKAGE_ROOT });
    const projected = new Set(projectKiro(sources.rules).files.map(f => path.basename(f.path)));
    const onDisk = fs.readdirSync(STEERING_DIR).filter(f => f.endsWith('.md'));

    for (const file of onDisk) {
      expect(projected.has(file)).toBe(true);
    }
  });
});
