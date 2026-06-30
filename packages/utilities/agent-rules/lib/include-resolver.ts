/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Matches a Kiro file-include directive: `#[[file:RELATIVE_PATH]]`.
 * Captures the path so projectors can either rewrite or inline it.
 */
export const KIRO_INCLUDE_REGEX = /#\[\[file:([^\]]+)\]\]/g;

export interface IncludeOccurrence {
  /** Raw matched directive (`#[[file:CONTRIBUTING.md]]`). */
  readonly directive: string;
  /** Path captured from the directive. */
  readonly target: string;
}

/** Find every `#[[file:...]]` directive in the supplied content. */
export function findIncludes(content: string): IncludeOccurrence[] {
  const out: IncludeOccurrence[] = [];
  for (const match of content.matchAll(KIRO_INCLUDE_REGEX)) {
    out.push({ directive: match[0], target: match[1] });
  }
  return out;
}

/**
 * Inline the contents of every `#[[file:...]]` directive, resolving paths
 * relative to `consumerRoot`. Missing files are replaced with a comment so
 * the projection is never silently broken.
 */
export function inlineIncludes(content: string, consumerRoot: string): string {
  return content.replace(KIRO_INCLUDE_REGEX, (_match, target: string) => {
    const resolved = path.resolve(consumerRoot, target);
    if (!resolved.startsWith(path.resolve(consumerRoot))) {
      return `<!-- mdaa-agent-rules: refusing to include '${target}' (escapes repo root) -->`;
    }
    if (!fs.existsSync(resolved)) {
      return `<!-- mdaa-agent-rules: include '${target}' not found -->`;
    }
    const body = fs.readFileSync(resolved, 'utf8');
    return body.trim();
  });
}

/**
 * Replace `#[[file:...]]` directives with the supplied formatter. Used by
 * tool projectors that translate Kiro syntax into a different host's
 * include/reference convention.
 */
export function rewriteIncludes(content: string, formatter: (target: string) => string): string {
  return content.replace(KIRO_INCLUDE_REGEX, (_match, target: string) => formatter(target));
}
