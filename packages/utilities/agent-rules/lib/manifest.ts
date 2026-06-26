/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ALL_TOOLS, Rule, RuleManifestEntry, RuleScope, ToolName } from './types';

const VALID_SCOPES: ReadonlySet<RuleScope> = new Set<RuleScope>(['always', 'auto', 'manual', 'fileMatch']);
const VALID_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>(ALL_TOOLS);

/**
 * Thrown when frontmatter metadata is malformed. Carries a human-readable
 * message pointing to the rule at fault.
 */
export class FrontmatterValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'FrontmatterValidationError';
  }
}

// Keep the old name as an alias for backwards compatibility in tests
export { FrontmatterValidationError as ManifestValidationError };

/**
 * Parse the frontmatter metadata object for a single rule into a typed entry.
 * Validates required fields, scope enum, glob requirements, and tool names.
 */
export function parseFrontmatter(name: string, raw: Record<string, unknown>): RuleManifestEntry {
  const scope = raw.scope;
  if (typeof scope !== 'string' || !VALID_SCOPES.has(scope as RuleScope)) {
    throw new FrontmatterValidationError(
      `rule '${name}': scope '${String(scope)}' must be one of: ${[...VALID_SCOPES].join(', ')}`,
    );
  }

  const description = raw.description;
  if (description !== undefined && typeof description !== 'string') {
    throw new FrontmatterValidationError(`rule '${name}': description must be a string when set`);
  }

  const globs = raw.globs;
  let normalizedGlobs: readonly string[] | undefined;
  if (globs !== undefined) {
    if (!Array.isArray(globs) || !globs.every(g => typeof g === 'string')) {
      throw new FrontmatterValidationError(`rule '${name}': globs must be an array of strings`);
    }
    normalizedGlobs = globs as readonly string[];
  }
  if (scope === 'fileMatch' && (!normalizedGlobs || normalizedGlobs.length === 0)) {
    throw new FrontmatterValidationError(`rule '${name}': globs must be set when scope is 'fileMatch'`);
  }

  const tools = raw.tools;
  let normalizedTools: readonly ToolName[] | undefined;
  if (tools !== undefined) {
    if (!Array.isArray(tools) || !tools.every(t => typeof t === 'string')) {
      throw new FrontmatterValidationError(`rule '${name}': tools must be an array of strings`);
    }
    for (const t of tools) {
      if (!VALID_TOOLS.has(t as ToolName)) {
        throw new FrontmatterValidationError(
          `rule '${name}': tools contains unsupported tool '${t}'. Supported: ${[...VALID_TOOLS].join(', ')}`,
        );
      }
    }
    normalizedTools = tools as readonly ToolName[];
  }

  return {
    name,
    scope: scope as RuleScope,
    description,
    globs: normalizedGlobs,
    tools: normalizedTools,
  };
}

/** Returns the entries that target the given tool, honoring per-rule `tools` overrides. */
export function rulesForTool(rules: readonly Rule[], tool: ToolName): readonly Rule[] {
  return rules.filter(r => {
    const allowed = r.entry.tools ?? ALL_TOOLS;
    return allowed.includes(tool);
  });
}
