---
inclusion: manual
---

# Documentation Quality Review - Steering Guide

Review documentation quality across the entire repository — prose quality, spelling/grammar, cross-reference validity, content accuracy relative to code changes, CHANGELOG updates, SCHEMA.md regeneration, and MkDocs nav consistency.

#[[file:CONTRIBUTING.md]]

## Scope

**In scope** (this agent reviews these):
- **All changed markdown files in the repository** — including those under `packages/`
- **README.md files** — structure, content quality, spelling, grammar
- **CHANGELOG.md** — must be updated when user-impacting code changes are present
- **SCHEMA.md** — must be regenerated when `config-schema.json` changes
- **MkDocs nav** — `mkdocs.yml` must include entries for new modules
- **Cross-references** — links in changed markdown files must point to files that exist
- **Doc-code alignment** — documentation must reflect related code changes in the same MR

**Out of scope** (handled by other agents — do NOT review these):
- Config schema design, sample config coverage, type safety → Module Quality agent
- Code architecture, dependency direction, construct hierarchy → Architecture agent
- Compliance controls, encryption, IAM policies → Compliance agent
- Test coverage, baseline gaps, test standards → Test Standards agent

**Shared scope with Starter Kit Quality agent** (review only grammar, spelling, and links — NOT structure):
- `starter_kits/**/README.md` — the Starter Kit Quality agent checks section structure and ordering; this agent checks spelling, grammar, link validity, and cross-references

## What to Review

### Spelling and Grammar
- All prose in changed documentation files must be free of spelling mistakes (technical terms, AWS service names, code identifiers, and CLI commands are excluded)
- Check for common grammatical errors: subject-verb disagreement, incorrect articles (a/an/the), missing articles, incorrect pluralization, dangling modifiers, and awkward repetition (e.g., "follow the following" → "follow these")
- AWS product names must use correct capitalization (e.g., "SageMaker" not "Sagemaker", "CloudFormation" not "Cloudformation")
- Do not flag code blocks, YAML snippets, file paths, or command examples

### Content Accuracy
- If the markdown file documents a package that also has code changes in this MR, verify the documentation still accurately reflects the code
- For README files: do Deployed Resources, Security/Compliance sections, and configuration examples match the current code?
- For SCHEMA.md: is it in sync with the current config-schema.json?

### Cross-References
- Links in changed markdown files should point to files that exist
- Relative paths should be valid from the linking file's location
- Pre-validated cross-reference results are provided in the prompt — confirm or dismiss them

### CHANGELOG
- CHANGELOG.md should be updated only for user-impacting changes: new app modules, new or changed configuration properties, bug fixes affecting deployed behavior, breaking changes, deprecations
- New or changed L2/L3 constructs do NOT require CHANGELOG entries unless they surface as new app modules or config properties
- Internal changes (CI/CD, test infrastructure, refactoring, documentation tooling) do NOT require CHANGELOG entries
- The new entry should match the MR's changes (not stale or copy-pasted)
- Entry follows the existing format (version header, categorized bullets)

### SCHEMA.md
- If `lib/config-schema.json` changed in any app module, the corresponding `SCHEMA.md` should also be updated
- SCHEMA.md is auto-generated — if the schema changed but SCHEMA.md didn't, it wasn't regenerated

### MkDocs Navigation
- If new app modules were added, `mkdocs.yml` should have corresponding nav entries
- If modules were renamed or removed, stale nav entries should be cleaned up

### README Structure (for package READMEs)
- Module READMEs should follow the structure defined in CONTRIBUTING.md
- Title + description, Deployed Resources, Architecture diagram, Related Modules, Security/Compliance, Configuration sections
- Compliance language belongs in Security/Compliance, not Deployed Resources
- Never refer to modules as "CDK applications" — they are configurable modules

## CI Agent Usage

This section is used by the automated Documentation Quality CI agent. The agent runs
**one Kiro invocation per changed markdown file** with pre-collected context (file content,
diff, related code changes, cross-reference validation). A separate invocation assesses
CHANGELOG adequacy.

### JSON Output Schema

Write findings to `{output_file}` as a JSON object. No preamble, no markdown fences, no explanation
outside the JSON. The file must contain ONLY valid JSON.

```json
{
  "overall_risk": "HIGH | MEDIUM | LOW",
  "summary": "One paragraph summarizing documentation quality for this file.",
  "findings": [
    {
      "risk": "HIGH | MEDIUM | LOW",
      "category": "spelling_grammar | content_accuracy | cross_reference | changelog | schema_md | mkdocs_nav | readme_structure",
      "file": "path/to/file",
      "detail": "What's missing or wrong."
    }
  ]
}
```

### Severity Classification

- **HIGH:** CHANGELOG not updated for user-impacting changes (new app modules, config property changes, bug fixes, breaking changes), SCHEMA.md out of sync with config-schema.json, broken cross-references in changed docs, documentation contradicts code changes
- **MEDIUM:** README section missing or non-conforming, MkDocs nav missing new module, CHANGELOG entry doesn't match MR changes, spelling mistakes in user-facing documentation, grammatical errors that affect clarity, documentation doesn't mention significant new functionality
- **LOW:** Minor formatting issues, style preferences, minor grammatical style (e.g., Oxford comma), documentation could be improved but isn't wrong

### Rules

- Only flag documentation gaps related to changes in THIS MR
- Do not flag pre-existing documentation issues in unchanged content
- The file content and diff are provided — review what is in front of you
- Cross-reference validation results are pre-computed — confirm broken links are genuine issues (the target may have been deleted in this MR intentionally)
- Do not flag whitespace inconsistencies (trailing spaces, blank line counts, indentation style) unless they affect readability or rendered output
- Order findings: HIGH first, then MEDIUM, then LOW
- Use only ASCII characters in all string values
- Be EXHAUSTIVE within the file you are reviewing — report every issue you find in a single pass
