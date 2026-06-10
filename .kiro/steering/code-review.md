---
inclusion: always
---

# Code Review — Generic Rules

These rules apply to all languages and file types during code review.


## Magic Numbers and Constants

- Numeric or string literals that control behavior (budgets, caps, thresholds, timeouts) should be named constants at module/file scope
- Exception: trivially obvious values (0, 1, empty string, boolean) or values only used once in a self-documenting context

## Debug Artifacts

- Print/log statements with "DEBUG", "TODO", or "HACK" prefixes that are not gated behind a verbose flag or env var should be flagged before merge
- Temporary test skips (`skip`, `xfail`, `.only`) must have an associated issue or comment explaining why

## Cognitive Complexity

- Functions with deeply nested loops/conditionals combined with arithmetic or state management should be extracted into smaller, testable helpers
- A function doing parse → transform → filter → assemble is a sign it should be split

## Sync Gaps

- When two data structures must stay in sync (e.g., a category list and a priority list, an enum and a switch statement), flag if one was updated without the other
- Look for parallel arrays, maps, and lists that share keys/values

## Resilience

- When a function processes external/dynamic input and uses a fixed lookup (dict, list, enum), check what happens when the input doesn't match any entry — is there a fallback or does it silently drop?