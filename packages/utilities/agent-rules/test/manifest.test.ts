/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { FrontmatterValidationError, parseFrontmatter, rulesForTool } from '../lib/manifest';
import { Rule } from '../lib/types';

describe('parseFrontmatter', () => {
  it('parses minimal frontmatter (scope only)', () => {
    const entry = parseFrontmatter('test-rule', { scope: 'always' });
    expect(entry.name).toBe('test-rule');
    expect(entry.scope).toBe('always');
    expect(entry.description).toBeUndefined();
    expect(entry.globs).toBeUndefined();
    expect(entry.tools).toBeUndefined();
  });

  it('parses all fields', () => {
    const entry = parseFrontmatter('bar', {
      scope: 'fileMatch',
      description: 'Test rule',
      globs: ['**/*.ts'],
      tools: ['kiro', 'claude'],
    });
    expect(entry.description).toBe('Test rule');
    expect(entry.globs).toEqual(['**/*.ts']);
    expect(entry.tools).toEqual(['kiro', 'claude']);
  });

  it('throws on invalid scope', () => {
    expect(() => parseFrontmatter('foo', { scope: 'bogus' })).toThrow(FrontmatterValidationError);
  });

  it('throws on fileMatch without globs', () => {
    expect(() => parseFrontmatter('foo', { scope: 'fileMatch' })).toThrow(FrontmatterValidationError);
  });

  it('throws on unsupported tool', () => {
    expect(() => parseFrontmatter('foo', { scope: 'always', tools: ['bogus'] })).toThrow(FrontmatterValidationError);
  });

  it('throws on non-string description', () => {
    expect(() => parseFrontmatter('foo', { scope: 'always', description: 123 })).toThrow(FrontmatterValidationError);
  });
});

describe('rulesForTool', () => {
  const rules: Rule[] = [
    { entry: { name: 'a', scope: 'always' }, body: '' },
    { entry: { name: 'b', scope: 'always', tools: ['kiro'] }, body: '' },
    { entry: { name: 'c', scope: 'manual', tools: ['claude', 'cursor'] }, body: '' },
  ];

  it('includes rules without an explicit tool list', () => {
    expect(rulesForTool(rules, 'kiro').map(r => r.entry.name)).toContain('a');
    expect(rulesForTool(rules, 'cursor').map(r => r.entry.name)).toContain('a');
  });

  it('respects tool-list overrides', () => {
    expect(rulesForTool(rules, 'kiro').map(r => r.entry.name)).toEqual(['a', 'b']);
    expect(rulesForTool(rules, 'claude').map(r => r.entry.name)).toEqual(['a', 'c']);
    expect(rulesForTool(rules, 'cursor').map(r => r.entry.name)).toEqual(['a', 'c']);
    expect(rulesForTool(rules, 'windsurf').map(r => r.entry.name)).toEqual(['a']);
  });
});
