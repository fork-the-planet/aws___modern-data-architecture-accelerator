/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectionFile, ProjectionResult, Rule, RuleScope } from '../types';
import { rulesForTool } from '../manifest';

/** Kiro stores rules at this path. */
export const KIRO_OUTPUT_DIR = '.kiro/steering';
const CANONICAL_DIR = 'packages/utilities/agent-rules/rules';

function kiroInclusion(scope: RuleScope): string {
  return scope;
}

/**
 * Project rules to Kiro's `.kiro/steering/<name>.md` layout.
 * Each file contains only Kiro-specific frontmatter and a `#[[file:...]]`
 * directive pointing to the canonical source. No content is inlined.
 */
export function projectKiro(rules: readonly Rule[]): ProjectionResult {
  const targets = rulesForTool(rules, 'kiro');
  const files: ProjectionFile[] = targets.map(rule => {
    const lines: string[] = ['---'];
    lines.push(`inclusion: ${kiroInclusion(rule.entry.scope)}`);
    if (rule.entry.description) {
      lines.push(`description: ${rule.entry.description}`);
    }
    if (rule.entry.scope === 'fileMatch' && rule.entry.globs) {
      lines.push(`fileMatchPattern: '${rule.entry.globs.join(',')}'`);
    }
    lines.push('---');
    lines.push('');
    lines.push(`#[[file:${CANONICAL_DIR}/${rule.entry.name}.md]]`);
    lines.push('');

    return {
      path: `${KIRO_OUTPUT_DIR}/${rule.entry.name}.md`,
      contents: lines.join('\n'),
    };
  });
  return { tool: 'kiro', files };
}
