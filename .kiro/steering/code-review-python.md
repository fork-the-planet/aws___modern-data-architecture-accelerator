---
inclusion: fileMatch
fileMatchPattern: '**/*.py,**/requirements*.txt,**/pyproject.toml'
---

# Code Review — Python

## Imports

- All imports at module top level. Late imports inside function bodies are a code smell unless avoiding a circular dependency (which should be documented with a comment)
- Unused imports must be removed

## Logging

- Use the `logging` module, not `print()`, for any output that is diagnostic/operational
- `print()` is acceptable only for CLI primary output (argparse-based scripts writing to stdout for the user)
- Format strings in log calls should use `%s` style (lazy evaluation), not f-strings

## Security Hotspots

- `hashlib.sha1()` or `hashlib.md5()` — flag unless the usage is non-cryptographic and documented (e.g., matching an external system's format)
- `subprocess.run(..., shell=True)` — flag; prefer passing args as a list
- `eval()`, `exec()`, `pickle.loads()` on untrusted input — always flag

## Type Hints

- New functions should have type annotations on parameters and return type
- `Any` should be avoided when a more specific type is feasible

## Exception Handling

- Bare `except:` or `except Exception:` that silently swallows errors — flag unless there's a re-raise, logging, or explicit justification
- Catching too broadly (e.g., `Exception` when only `ValueError` is expected) should be narrowed

## SonarQube-Style Analysis

Python files are excluded from the project's actual SonarQube scan (`sonar-project.properties` excludes `**.py`), but even for languages that are scanned in the pipeline, the reviewer should catch these issues before code is pushed to avoid pipeline failures and review round-trips. Apply SonarQube-equivalent rules to changed Python code:

- **Scope**: Only flag issues on lines that appear in the diff (added or modified). Pre-existing code is out of scope even if it has issues.
- **Bug rules**: Broad exception catches (S5765), unreachable code, null/None dereferences, type mismatches
- **Security hotspot rules**: Log injection (S5131), hardcoded credentials, insecure crypto, overly permissive CORS/IAM
- **Code smell rules**: Cognitive complexity > 15 (S3776), duplicated string literals > 3 occurrences (S1192), unused variables (S1481), mutable global state (S3010), commented-out code (S1135)
- **Reliability rules**: Functions that swallow exceptions and return empty defaults instead of propagating errors to callers

When reporting findings, cite the SonarQube rule ID and clearly indicate which diff line triggers it.

## Test Coverage

Minimal coverage requirements are not set for python files. So for now, review the test code and code changes to ensure the following.

- New functions containing non-trivial logic (branching, loops, algorithms) must have corresponding unit tests
- When a function signature is updated (new parameters, changed return type), existing tests must exercise the new behavior — not just update call sites to compile
- Updated code without test coverage must be flagged, especially when the surrounding file already has a test suite
