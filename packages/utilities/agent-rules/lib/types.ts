/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Activation scope for a rule across supported tools.
 *
 * - `always`: rule is loaded into every agent session unconditionally.
 * - `auto`: rule is loaded automatically by tools that support
 *   description-based activation; otherwise behaves like `manual`.
 * - `manual`: rule is loaded only when explicitly referenced by the user
 *   or another rule.
 * - `fileMatch`: rule is loaded only when the agent is operating on files
 *   matching the configured globs.
 */
export type RuleScope = 'always' | 'auto' | 'manual' | 'fileMatch';

/** Tools the projector knows how to render to. */
export type ToolName = 'kiro' | 'claude' | 'copilot' | 'cursor' | 'windsurf';

export const ALL_TOOLS: readonly ToolName[] = ['kiro', 'claude', 'copilot', 'cursor', 'windsurf'];

/** Per-rule entry parsed from rule file frontmatter. */
export interface RuleManifestEntry {
  /** Stem of the rule body file under `rules/` (without `.md`). */
  readonly name: string;

  /** Activation scope across tools. */
  readonly scope: RuleScope;

  /**
   * One-line description. Used by `auto`-scope projections that expose
   * a `description` field (e.g. Kiro) so the host can decide when to
   * activate the rule.
   */
  readonly description?: string;

  /**
   * Glob patterns that trigger activation when `scope` is `fileMatch`.
   * Patterns follow standard glob syntax (e.g. `**\/*.test.ts`).
   */
  readonly globs?: readonly string[];

  /**
   * Tools that should receive this rule. Defaults to all supported tools.
   * Useful when a rule only makes sense in one host (e.g. a Kiro-only
   * preamble that ships with the review agent infrastructure).
   */
  readonly tools?: readonly ToolName[];
}

/** A parsed rule combining its frontmatter metadata with its body. */
export interface Rule {
  readonly entry: RuleManifestEntry;
  /** Raw rule body Markdown, with no frontmatter and unmodified `#[[file:...]]` directives. */
  readonly body: string;
}

/** A single file the projector will write. */
export interface ProjectionFile {
  /** Path relative to the consumer repo root. */
  readonly path: string;
  /** Full file contents to write. */
  readonly contents: string;
}

/** Result of projecting all rules to a single tool. */
export interface ProjectionResult {
  readonly tool: ToolName;
  readonly files: readonly ProjectionFile[];
}
