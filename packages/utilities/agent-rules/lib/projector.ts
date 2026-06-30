/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSources } from './source-loader';
import { projectorFor } from './projectors';
import { ALL_TOOLS, ProjectionResult, ToolName } from './types';

export interface ProjectOptions {
  /** Directory where projections should be written. Defaults to CWD. */
  readonly consumerRoot?: string;
  /**
   * Override the canonical rules directory used for source loading. Tests pass
   * a fixture directory; production callers leave this unset.
   */
  readonly rulesDir?: string;
}

export interface ProjectSummary {
  readonly tool: ToolName;
  readonly written: number;
  readonly unchanged: number;
}

/**
 * Project rules for all registered tools and write the resulting files.
 * Idempotent: files whose contents already match are not rewritten so
 * filesystem mtimes stay stable for incremental tooling.
 */
export function project(options: ProjectOptions = {}): ProjectSummary[] {
  const consumerRoot = options.consumerRoot ?? process.cwd();
  const sources = loadSources({ rulesDir: options.rulesDir });

  const summaries: ProjectSummary[] = [];
  for (const tool of ALL_TOOLS) {
    const result = projectorFor(tool)(sources.rules);
    const summary = writeProjection(result, consumerRoot);
    summaries.push(summary);
  }
  return summaries;
}

function writeProjection(result: ProjectionResult, consumerRoot: string): ProjectSummary {
  const dirFiles = collectOutputDirs(result.files, consumerRoot);
  removeStaleFiles(dirFiles);
  const { written, unchanged } = writeFiles(result.files, consumerRoot);
  return { tool: result.tool, written, unchanged };
}

/** Map each output directory to the set of filenames the projector expects to own. */
function collectOutputDirs(files: readonly { path: string }[], consumerRoot: string): Map<string, Set<string>> {
  const dirFiles = new Map<string, Set<string>>();
  for (const file of files) {
    const abs = path.join(consumerRoot, file.path);
    const dir = path.dirname(abs);
    if (dir === consumerRoot) continue;
    if (!dirFiles.has(dir)) dirFiles.set(dir, new Set());
    dirFiles.get(dir)?.add(path.basename(abs));
  }
  return dirFiles;
}

/** Delete files in output directories that are not in the expected set. */
function removeStaleFiles(dirFiles: Map<string, Set<string>>): void {
  for (const [dir, expected] of dirFiles) {
    if (!fs.existsSync(dir)) continue;
    for (const existing of fs.readdirSync(dir)) {
      if (expected.has(existing)) continue;
      const full = path.join(dir, existing);
      if (fs.statSync(full).isFile()) fs.unlinkSync(full);
    }
  }
}

/** Write projected files, skipping those whose content already matches. */
function writeFiles(
  files: readonly { path: string; contents: string }[],
  consumerRoot: string,
): { written: number; unchanged: number } {
  let written = 0;
  let unchanged = 0;
  for (const file of files) {
    const abs = path.join(consumerRoot, file.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === file.contents) {
      unchanged += 1;
    } else {
      fs.writeFileSync(abs, file.contents);
      written += 1;
    }
  }
  return { written, unchanged };
}
