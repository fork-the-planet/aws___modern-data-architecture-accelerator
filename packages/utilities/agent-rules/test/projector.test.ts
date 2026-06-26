/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { project } from '../lib/projector';

const PACKAGE_ROOT = path.resolve(__dirname, '..');

function makeConsumerRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-rules-installer-'));
}

describe('project', () => {
  it('writes Kiro projection idempotently', () => {
    const root = makeConsumerRoot();
    try {
      const first = project({
        consumerRoot: root,
        packageRoot: PACKAGE_ROOT,
      });
      expect(first[0].written).toBeGreaterThan(0);
      expect(first[0].unchanged).toBe(0);

      const second = project({
        consumerRoot: root,
        packageRoot: PACKAGE_ROOT,
      });
      expect(second[0].written).toBe(0);
      expect(second[0].unchanged).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('source-loader errors', () => {
  it('throws when rules directory is missing', () => {
    const root = makeConsumerRoot();
    try {
      expect(() => project({ consumerRoot: root, packageRoot: root })).toThrow(/rules directory not found/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when a rule file has no frontmatter', () => {
    const root = makeConsumerRoot();
    try {
      fs.mkdirSync(path.join(root, 'rules'));
      fs.writeFileSync(path.join(root, 'rules', 'bad-rule.md'), '# No frontmatter\nJust body content.\n');
      expect(() => project({ consumerRoot: root, packageRoot: root })).toThrow(/missing YAML frontmatter/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when frontmatter has invalid scope', () => {
    const root = makeConsumerRoot();
    try {
      fs.mkdirSync(path.join(root, 'rules'));
      fs.writeFileSync(path.join(root, 'rules', 'bad-scope.md'), '---\nscope: bogus\n---\n\n# Body\n');
      expect(() => project({ consumerRoot: root, packageRoot: root })).toThrow(/scope/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
