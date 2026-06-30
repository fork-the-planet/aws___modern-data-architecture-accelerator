---
scope: manual
---

# Iterative Development - Steering Guide

Operational guidance for the build/test cycle when modifying existing MDAA packages. Covers dependency ordering, common pitfalls, and the workflow for getting changes from TypeScript source into passing tests.

## Build Order Matters

L3 constructs and app packages have a compile-time dependency chain. When modifying both:

1. **Compile L3 construct first** (`npx tsc` in the construct directory)
2. **Then build the app** (`npm run build` in the app directory — this also regenerates `config-schema.json` and `SCHEMA.md`)
3. **Then run tests** (`npx jest`)

If you skip step 1, tests will run against stale compiled JS and may pass incorrectly or fail with misleading errors.

## Tests Run Against Compiled JS

Jest executes the compiled `.js` files, not TypeScript source directly. Common symptoms of stale compilation:

- `"X is not a function"` — the function was added to `.ts` but not yet compiled to `.js`
- Tests pass but don't cover new code — the `.js` still reflects the old version
- Type errors don't surface as test failures — TypeScript checking happens at compile time, not test time

**Fix:** Run `npx tsc` (or `npm run build`) before running tests after any source change.

**Tip:** Use `npx tsc --noEmit` for a fast type-check without writing files — useful for catching errors before a full build.

## typescript-json-schema Pitfalls

Config schemas are auto-generated from TypeScript interfaces via `typescript-json-schema`. Known limitations:

- **Raw `Record<K, V>` types** generate broken schemas (`{ additionalProperties: false }` which rejects all properties). **Fix:** Use a named interface with an index signature instead:

  ```typescript
  // Bad — produces broken schema
  readonly conditions?: Record<string, Record<string, string | string[]>>;

  // Good — produces correct schema with additionalProperties
  export interface MyConditions {
    [operator: string]: { [key: string]: string | string[] };
  }
  readonly conditions?: MyConditions;
  ```

- **Union types with complex generics** may not serialize correctly. When in doubt, extract a named interface and verify the generated schema with a sample config test.

## Iterative Modification Workflow

When adding a feature to an existing L3 construct + app pair:

1. **Edit L3 construct** — interfaces, implementation, utils
2. **Compile L3** — `npx tsc` in the construct directory
3. **Run L3 tests** — `npx jest --no-coverage` to verify construct behavior
4. **Edit app** — config parser, sample configs
5. **Build app** — `npm run build` (compiles + regenerates schema)
6. **Add diff test entry** — every new sample config needs a corresponding `baselineDiffTestApp` call
7. **Update baselines** — `npm run test:update-baselines`
8. **Run all tests** — `npx jest --no-coverage` to verify everything passes

If baseline update fails with schema validation errors, check the generated `config-schema.json` for incorrect type definitions (see typescript-json-schema pitfalls above).

## Quick Reference

| Symptom | Likely cause | Fix |
|---|---|---|
| `X is not a function` in tests | Stale compiled JS | Recompile: `npx tsc` |
| Schema validation rejects valid YAML | `Record<>` type in interface | Use named interface with index signature |
| Baseline diff test fails unexpectedly | Schema changed or new sample config | `npm run test:update-baselines` |
| Type error not caught by tests | Tests use JS, not TS | Run `npx tsc --noEmit` to type-check |
| New exports not found by app | L3 not recompiled after change | Recompile L3 first, then build app |
