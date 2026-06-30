/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { project } from '../lib/projector';
import { loadSources, DEFAULT_RULES_DIR, discoverDefaultRulesDir } from '../lib/source-loader';

// Canonical rules live at the repo root (agent_rules/), four levels up from
// this package's test directory.
const RULES_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'agent_rules');

function makeConsumerRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-rules-installer-'));
}

describe('project', () => {
  it('writes Kiro projection idempotently', () => {
    const root = makeConsumerRoot();
    try {
      const first = project({
        consumerRoot: root,
        rulesDir: RULES_DIR,
      });
      expect(first[0].written).toBeGreaterThan(0);
      expect(first[0].unchanged).toBe(0);

      const second = project({
        consumerRoot: root,
        rulesDir: RULES_DIR,
      });
      expect(second[0].written).toBe(0);
      expect(second[0].unchanged).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('default rules directory resolution', () => {
  // Every other test injects an explicit rulesDir/fixture, so the production
  // default-resolution path (used when callers omit rulesDir) would otherwise
  // be unexercised. These guard the repo-root discovery.
  it('resolves DEFAULT_RULES_DIR to the repo-root agent_rules directory', () => {
    expect(DEFAULT_RULES_DIR).toBe(RULES_DIR);
    expect(fs.existsSync(DEFAULT_RULES_DIR)).toBe(true);
    expect(fs.statSync(DEFAULT_RULES_DIR).isDirectory()).toBe(true);
  });

  it('loadSources() with no rulesDir loads rules from the repo-root directory', () => {
    const loaded = loadSources();
    expect(loaded.rulesDir).toBe(RULES_DIR);
    expect(loaded.rules.length).toBeGreaterThan(0);
  });

  it('falls back to the four-levels-up path when no agent_rules ancestor exists', () => {
    // Synthetic start directory under tmp whose ancestry contains no
    // agent_rules/ folder, so the upward walk reaches the filesystem root and
    // returns the documented historical fallback.
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'no-agent-rules-'));
    try {
      const start = path.join(isolated, 'a', 'b', 'c', 'd', 'e');
      fs.mkdirSync(start, { recursive: true });
      const resolved = discoverDefaultRulesDir(start);
      expect(resolved).toBe(path.resolve(start, '..', '..', '..', '..', 'agent_rules'));
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });
});

describe('source-loader errors', () => {
  it('throws when rules directory is missing', () => {
    const root = makeConsumerRoot();
    try {
      expect(() => project({ consumerRoot: root, rulesDir: path.join(root, 'missing') })).toThrow(
        /rules directory not found/,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when a rule file has no frontmatter', () => {
    const root = makeConsumerRoot();
    try {
      const rulesDir = path.join(root, 'rules');
      fs.mkdirSync(rulesDir);
      fs.writeFileSync(path.join(rulesDir, 'bad-rule.md'), '# No frontmatter\nJust body content.\n');
      expect(() => project({ consumerRoot: root, rulesDir })).toThrow(/missing YAML frontmatter/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when frontmatter has invalid scope', () => {
    const root = makeConsumerRoot();
    try {
      const rulesDir = path.join(root, 'rules');
      fs.mkdirSync(rulesDir);
      fs.writeFileSync(path.join(rulesDir, 'bad-scope.md'), '---\nscope: bogus\n---\n\n# Body\n');
      expect(() => project({ consumerRoot: root, rulesDir })).toThrow(/scope/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
