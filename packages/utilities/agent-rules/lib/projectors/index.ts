/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectionResult, Rule, ToolName } from '../types';
import { projectKiro } from './kiro';
import { projectClaude } from './claude';
import { projectCopilot } from './copilot';
import { projectCursor } from './cursor';
import { projectWindsurf } from './windsurf';

export { projectKiro } from './kiro';
export { projectClaude } from './claude';
export { projectCopilot } from './copilot';
export { projectCursor } from './cursor';
export { projectWindsurf } from './windsurf';

const PROJECTORS: Record<ToolName, (rules: readonly Rule[]) => ProjectionResult> = {
  kiro: projectKiro,
  claude: projectClaude,
  copilot: projectCopilot,
  cursor: projectCursor,
  windsurf: projectWindsurf,
};

/** Returns the projection function for a given tool. */
export function projectorFor(tool: ToolName): (rules: readonly Rule[]) => ProjectionResult {
  return PROJECTORS[tool];
}
