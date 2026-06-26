/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findIncludes, inlineIncludes, rewriteIncludes } from '../lib/include-resolver';

describe('include-resolver', () => {
  it('finds every include directive', () => {
    const text = 'preface\n#[[file:CONTRIBUTING.md]]\nmiddle\n#[[file:TESTING.md]] tail';
    const found = findIncludes(text);
    expect(found.map(f => f.target)).toEqual(['CONTRIBUTING.md', 'TESTING.md']);
  });

  it('rewrites includes via the supplied formatter', () => {
    const text = '#[[file:CONTRIBUTING.md]]';
    const out = rewriteIncludes(text, target => `@${target}`);
    expect(out).toBe('@CONTRIBUTING.md');
  });

  it('inlines an include from disk', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-rules-include-'));
    try {
      const file = path.join(tmp, 'A.md');
      fs.writeFileSync(file, 'aaa');
      const out = inlineIncludes('before\n#[[file:A.md]]\nafter', tmp);
      expect(out).toContain('aaa');
      expect(out).not.toContain('#[[file:');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('emits a placeholder comment when an include is missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-rules-include-'));
    try {
      const out = inlineIncludes('#[[file:does-not-exist.md]]', tmp);
      expect(out).toContain('not found');
      expect(out).not.toContain('#[[file:');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('refuses to escape the consumer root', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-rules-include-'));
    try {
      const out = inlineIncludes('#[[file:../../etc/passwd]]', tmp);
      expect(out).toContain('escapes repo root');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
