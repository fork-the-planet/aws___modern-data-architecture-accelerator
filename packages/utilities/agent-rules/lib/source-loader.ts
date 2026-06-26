/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, FrontmatterValidationError } from './manifest';
import { Rule, RuleManifestEntry } from './types';

/** Default location of the canonical rule sources within the package. */
export const DEFAULT_PACKAGE_ROOT = path.resolve(__dirname, '..');

export interface SourceLoadOptions {
  /**
   * Directory containing the `rules/` folder with rule body Markdown files.
   * Defaults to the package root.
   */
  readonly packageRoot?: string;
}

export interface LoadedSources {
  readonly rules: readonly Rule[];
  /** Absolute path to the rules directory used for resolution. */
  readonly rulesDir: string;
}

/**
 * Auto-discover all `.md` files under `<packageRoot>/rules/`, parse their
 * YAML frontmatter for metadata (scope, globs, description, tools), and
 * return the loaded rules sorted by name.
 *
 * Each rule file must have YAML frontmatter delimited by `---` lines at the
 * top of the file. Required fields: `scope`. Optional: `description`, `globs`,
 * `tools`.
 */
export function loadSources(options: SourceLoadOptions = {}): LoadedSources {
  const packageRoot = options.packageRoot ?? DEFAULT_PACKAGE_ROOT;
  const rulesDir = path.join(packageRoot, 'rules');

  if (!fs.existsSync(rulesDir) || !fs.statSync(rulesDir).isDirectory()) {
    throw new FrontmatterValidationError(`rules directory not found at ${rulesDir}`);
  }

  const files = fs
    .readdirSync(rulesDir)
    .filter(f => f.endsWith('.md'))
    .sort();

  const seen = new Set<string>();
  const rules: Rule[] = files.map(file => {
    const name = file.replace(/\.md$/, '');
    if (seen.has(name)) {
      throw new FrontmatterValidationError(`duplicate rule name: '${name}'`);
    }
    seen.add(name);

    const raw = fs.readFileSync(path.join(rulesDir, file), 'utf8');
    const { entry, body } = parseRuleFile(name, raw);
    return { entry, body };
  });

  return { rules, rulesDir };
}

/**
 * Parse a rule file's frontmatter and body. The file must start with `---`
 * followed by YAML metadata, closed by another `---`.
 */
function parseRuleFile(name: string, content: string): { entry: RuleManifestEntry; body: string } {
  const { metadata, body } = splitFrontmatter(name, content);
  const entry = parseFrontmatter(name, metadata);
  return { entry, body };
}

/**
 * Split YAML frontmatter from the body of a rule file.
 */
function splitFrontmatter(name: string, content: string): { metadata: Record<string, unknown>; body: string } {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    throw new FrontmatterValidationError(`rule '${name}' is missing YAML frontmatter (must start with ---)`);
  }

  const closeIdx = lines.indexOf('---', 1);
  if (closeIdx === -1) {
    throw new FrontmatterValidationError(`rule '${name}' has unclosed frontmatter (missing closing ---)`);
  }

  const yamlStr = lines.slice(1, closeIdx).join('\n');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yaml = require('js-yaml');
  const parsed = yaml.load(yamlStr);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new FrontmatterValidationError(`rule '${name}' frontmatter must be a YAML mapping`);
  }

  const body = lines.slice(closeIdx + 1).join('\n');
  return { metadata: parsed as Record<string, unknown>, body };
}
