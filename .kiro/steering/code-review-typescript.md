---
inclusion: fileMatch
fileMatchPattern: '**/*.ts,**/*.tsx,**/tsconfig*.json'
---

# Code Review — TypeScript

## Non-null Assertions

- Flag any use of `!` to force a value out of an optional. Prefer explicit null checks, optional chaining (`?.`), or narrowing guards instead.

## Type Safety

- Avoid `any` — use `unknown` with type guards if the type is truly dynamic
- Avoid type assertions (`as Foo`) when a type guard or generic would work
- `@ts-ignore` / `@ts-expect-error` must have a comment explaining why

## Error Handling

- Avoid empty catch blocks. At minimum, log the error or re-throw
- Avoid catching `Error` broadly when a specific error type is available (e.g., CDK errors, SDK errors)

## Async Patterns

- Avoid floating promises (async function called without `await` or `.catch()`)
- Avoid `async` on functions that don't use `await` — it adds unnecessary wrapping

## Interface Design

- Prefer `readonly` on interface properties for config/props types
- Avoid optional properties (`?`) when a default value would be more ergonomic for consumers
- Discriminated unions over boolean flags when behavior branches significantly

## SonarQube-Style Analysis

Although TypeScript is scanned by SonarQube in the pipeline, the reviewer should catch these issues before code is pushed to avoid pipeline failures and review round-trips:

- **Scope**: Only flag issues on lines that appear in the diff (added or modified). Pre-existing code is out of scope even if it has issues.
- **Bug rules**: Unreachable code (S1763), identical expressions on both sides of binary operator (S1764), null/undefined dereferences, collection size misuse (S3981), unnecessary type assertions that don't change the expression type (S4325)
- **Security hotspot rules**: Log injection (S5131), hardcoded credentials (S2068), insecure crypto, overly permissive IAM/CORS, command injection via string concatenation (S2631)
- **Code smell rules**: Cognitive complexity > 15 (S3776), duplicated string literals > 3 occurrences (S1192), unused variables (S1481), commented-out code (S1135), functions with too many parameters > 7 (S107)
- **Reliability rules**: Functions that swallow exceptions and return empty defaults instead of propagating errors to callers, promises without error handling

When reporting findings, cite the SonarQube rule ID and clearly indicate which diff line triggers it.