/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import { project } from './projector';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const results = project({ consumerRoot: repoRoot });

for (const r of results) {
  console.log(`[${r.tool}] wrote=${r.written} unchanged=${r.unchanged}`);
}
