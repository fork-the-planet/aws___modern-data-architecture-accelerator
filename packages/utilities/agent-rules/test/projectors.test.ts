/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Rule } from '../lib/types';
import { projectKiro } from '../lib/projectors/kiro';
import { projectClaude } from '../lib/projectors/claude';
import { projectCopilot } from '../lib/projectors/copilot';
import { projectCursor } from '../lib/projectors/cursor';
import { projectWindsurf } from '../lib/projectors/windsurf';

const fixtures: Rule[] = [
  {
    entry: { name: 'always-rule', scope: 'always' },
    body: '# Always Rule\n\nApplies everywhere.\n',
  },
  {
    entry: { name: 'auto-rule', scope: 'auto', description: 'Auto rule desc' },
    body: '# Auto Rule\n\nWith #[[file:CONTRIBUTING.md]] reference.\n',
  },
  {
    entry: { name: 'manual-rule', scope: 'manual' },
    body: '# Manual Rule\n',
  },
  {
    entry: { name: 'glob-rule', scope: 'fileMatch', globs: ['**/*.ts', '**/*.tsx'] },
    body: '# Glob Rule\n',
  },
  {
    entry: { name: 'kiro-only', scope: 'manual', tools: ['kiro'] },
    body: '# Kiro Only\n',
  },
];

describe('projectKiro', () => {
  const result = projectKiro(fixtures);

  it('emits one file per rule under .kiro/steering/', () => {
    expect(result.tool).toBe('kiro');
    expect(result.files).toHaveLength(fixtures.length);
    for (const f of result.files) {
      expect(f.path).toMatch(/^\.kiro\/steering\/.+\.md$/);
    }
  });

  it('references canonical source via #[[file:...]] directive', () => {
    const auto = result.files.find(f => f.path.endsWith('auto-rule.md'))!;
    expect(auto.contents).toContain('#[[file:agent_rules/auto-rule.md]]');
  });

  it('emits inclusion: scope and fileMatchPattern', () => {
    const glob = result.files.find(f => f.path.endsWith('glob-rule.md'))!;
    expect(glob.contents).toContain('inclusion: fileMatch');
    expect(glob.contents).toContain("fileMatchPattern: '**/*.ts,**/*.tsx'");
  });

  it('emits description for auto rules', () => {
    const auto = result.files.find(f => f.path.endsWith('auto-rule.md'))!;
    expect(auto.contents).toContain('description: Auto rule desc');
  });

  it('begins each file with the YAML frontmatter delimiter', () => {
    for (const f of result.files) {
      expect(f.contents.startsWith('---\n')).toBe(true);
    }
  });
});

describe('projectClaude', () => {
  const result = projectClaude(fixtures);

  it('skips kiro-only rules', () => {
    const paths = result.files.map(f => f.path);
    expect(paths.some(p => p.includes('kiro-only'))).toBe(false);
  });

  it('writes always rules into CLAUDE.md', () => {
    const root = result.files.find(f => f.path === 'CLAUDE.md');
    expect(root).toBeDefined();
    expect(root!.contents).toContain('always-rule');
  });

  it('writes other rules under .claude/rules/', () => {
    const auto = result.files.find(f => f.path === '.claude/rules/auto-rule.md');
    expect(auto).toBeDefined();
    expect(auto!.contents).toContain('description: Auto rule desc');
  });

  it('references canonical source without inlining content', () => {
    const auto = result.files.find(f => f.path === '.claude/rules/auto-rule.md')!;
    expect(auto.contents).not.toContain('#[[file:');
    expect(auto.contents).toContain('auto-rule');
    // .claude/rules/ is two levels deep, so the canonical link must traverse
    // up two directories. Assert the exact prefix so the depth correction is
    // guarded (a plain 'agent_rules/...' check passes for the wrong '../' too).
    expect(auto.contents).toContain('../../agent_rules/auto-rule.md');
  });
});

describe('projectCopilot', () => {
  const result = projectCopilot(fixtures);

  it('writes always rules into copilot-instructions.md', () => {
    const root = result.files.find(f => f.path === '.github/copilot-instructions.md');
    expect(root).toBeDefined();
    expect(root!.contents).toContain('always-rule');
  });

  it('emits applyTo for fileMatch rules', () => {
    const glob = result.files.find(f => f.path === '.github/instructions/glob-rule.instructions.md');
    expect(glob).toBeDefined();
    expect(glob!.contents).toContain("applyTo: '**/*.ts,**/*.tsx'");
  });

  it('omits applyTo for manual rules', () => {
    const manual = result.files.find(f => f.path === '.github/instructions/manual-rule.instructions.md');
    expect(manual).toBeDefined();
    expect(manual!.contents).not.toContain('applyTo:');
  });

  it('references the canonical source from the per-rule instructions file', () => {
    // .github/instructions/ is two levels deep, so the canonical link must
    // traverse up two directories. Guards the CANONICAL_DIR ('agent_rules') value.
    const auto = result.files.find(f => f.path === '.github/instructions/auto-rule.instructions.md')!;
    expect(auto.contents).toContain('../../agent_rules/auto-rule.md');
  });

  it('references the canonical source from copilot-instructions.md', () => {
    const root = result.files.find(f => f.path === '.github/copilot-instructions.md')!;
    expect(root.contents).toContain('../agent_rules/always-rule.md');
  });

  it('starts every per-rule file with the frontmatter delimiter on line 1', () => {
    // Copilot only recognizes a YAML frontmatter block when `---` is the
    // very first line — anything before it (e.g. an HTML comment) breaks
    // the parser and the `applyTo` directive is silently ignored.
    const perRule = result.files.filter(f => f.path.startsWith('.github/instructions/'));
    expect(perRule.length).toBeGreaterThan(0);
    for (const f of perRule) {
      expect(f.contents.startsWith('---\n')).toBe(true);
    }
  });
});

describe('projectCursor', () => {
  const result = projectCursor(fixtures);

  it('writes one .mdc per rule with alwaysApply set correctly', () => {
    const always = result.files.find(f => f.path === '.cursor/rules/always-rule.mdc')!;
    expect(always.contents).toContain('alwaysApply: true');
    const manual = result.files.find(f => f.path === '.cursor/rules/manual-rule.mdc')!;
    expect(manual.contents).toContain('alwaysApply: false');
  });

  it('references canonical source with @-mention syntax', () => {
    const auto = result.files.find(f => f.path === '.cursor/rules/auto-rule.mdc')!;
    expect(auto.contents).toContain('@agent_rules/auto-rule.md');
  });

  it('starts every .mdc file with the frontmatter delimiter on line 1', () => {
    // Cursor's `.mdc` parser requires `---` on line 1; any preceding text
    // disables the frontmatter and `alwaysApply` / `globs` stop working.
    for (const f of result.files) {
      expect(f.contents.startsWith('---\n')).toBe(true);
    }
  });
});

describe('projectWindsurf', () => {
  const result = projectWindsurf(fixtures);

  it('maps scopes to the correct trigger value', () => {
    const map: Record<string, string> = {
      'always-rule': 'always_on',
      'auto-rule': 'model_decision',
      'glob-rule': 'glob',
      'manual-rule': 'manual',
    };
    for (const [name, trigger] of Object.entries(map)) {
      const f = result.files.find(file => file.path.endsWith(`${name}.md`))!;
      expect(f.contents).toContain(`trigger: ${trigger}`);
    }
  });

  it('emits globs for fileMatch rules', () => {
    const glob = result.files.find(f => f.path === '.windsurf/rules/glob-rule.md')!;
    expect(glob.contents).toContain('globs: **/*.ts,**/*.tsx');
  });

  it('references the canonical source with @-mention syntax', () => {
    // Guards the CANONICAL_DIR ('agent_rules') value for the windsurf projector.
    const auto = result.files.find(f => f.path === '.windsurf/rules/auto-rule.md')!;
    expect(auto.contents).toContain('@agent_rules/auto-rule.md');
  });

  it('starts every rule file with the frontmatter delimiter on line 1', () => {
    // Windsurf reads the `trigger:` field from YAML frontmatter; if `---`
    // is not on line 1 the rule silently degrades to the manual default.
    for (const f of result.files) {
      expect(f.contents.startsWith('---\n')).toBe(true);
    }
  });
});
