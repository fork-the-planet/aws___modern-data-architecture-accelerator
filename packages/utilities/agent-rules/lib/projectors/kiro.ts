/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectionFile, ProjectionResult, Rule, RuleScope } from '../types';
import { rulesForTool } from '../manifest';

/** Kiro stores rules at this path. */
export const KIRO_OUTPUT_DIR = '.kiro/steering';
const CANONICAL_DIR = 'agent_rules';

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
    const lines = [
      '---',
      `inclusion: ${kiroInclusion(rule.entry.scope)}`,
      ...(rule.entry.description ? [`description: ${rule.entry.description}`] : []),
      ...(rule.entry.scope === 'fileMatch' && rule.entry.globs
        ? [`fileMatchPattern: '${rule.entry.globs.join(',')}'`]
        : []),
      '---',
      '',
      `#[[file:${CANONICAL_DIR}/${rule.entry.name}.md]]`,
      '',
    ];

    return {
      path: `${KIRO_OUTPUT_DIR}/${rule.entry.name}.md`,
      contents: lines.join('\n'),
    };
  });
  return { tool: 'kiro', files };
}
