# `@aws-mdaa/agent-rules`

Tool-agnostic AI agent steering rules for MDAA. Author each rule once under
the repo-root `agent_rules/<name>.md` directory and project a thin,
tool-specific wrapper into every supported assistant's expected layout.

## Why

MDAA contributors and downstream consumers use a mix of AI coding assistants:
Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf. Each tool reads rules
from a different path with a different frontmatter dialect. Maintaining a full
copy of every rule per tool causes drift. This package keeps the canonical
content in one place and emits per-tool projections deterministically.

Projections contain **only** tool-specific frontmatter plus a reference back
to the canonical source — no rule body is duplicated. Editing a rule's content
does not change any projection; only changing its scope, globs, description, or
tool list does.

## Layout

The canonical rules live at the **repo root** (`agent_rules/`), so they can be
copied wholesale into consumer projects (e.g. by `mdaa init`) with their
repo-root-relative references intact. The tooling that projects them lives in
this package.

```
agent_rules/                   # canonical rules at repo root: frontmatter + body
├── review-compliance.md
├── developer-coding-standards.md
├── user-config-authoring.md
└── ...

packages/utilities/agent-rules/
├── lib/                   # TypeScript source
│   ├── types.ts
│   ├── manifest.ts        # frontmatter parser + validator, rulesForTool()
│   ├── source-loader.ts   # auto-discovers agent_rules/*.md, parses frontmatter
│   ├── include-resolver.ts
│   ├── projectors/        # one file per supported tool
│   ├── projector.ts       # writes projections, prunes stale files
│   └── run-projections.ts # build entry point
├── test/                  # jest unit + integration tests
└── README.md
```

There is no `manifest.yaml` and no CLI. Rules are auto-discovered from the
repo-root `agent_rules/` directory and metadata is read from each file's
frontmatter.

## Naming convention

Rule file stems are prefixed by audience:

| Prefix       | Audience                                            |
| ------------ | --------------------------------------------------- |
| `review-`    | Consumed by the CI review agents                    |
| `developer-` | Guidance for developers working in the repo         |
| `user-`      | Guidance for end-users configuring/deploying MDAA   |

## Canonical rule format

Each rule is a Markdown file under `agent_rules/<name>.md` with tool-agnostic
YAML frontmatter followed by the body:

```markdown
---
scope: fileMatch # always | auto | manual | fileMatch
description: ... # optional; one-line summary surfaced by auto-loaders
globs: # required when scope: fileMatch
  - 'packages/**/*.ts'
tools: # optional; defaults to all supported tools
  - kiro
---

# Rule Title

Body content...
```

The frontmatter is tool-agnostic. The projector translates it into each tool's
native dialect (`scope: manual` → Kiro `inclusion: manual`, Cursor
`alwaysApply: false`, Windsurf `trigger: manual`, etc.).

Rule bodies may use the Kiro `#[[file:RELATIVE_PATH]]` directive to reference
sibling repo files (e.g. `CONTRIBUTING.md`); Kiro resolves these at runtime.

### Scopes

| Scope       | Behavior                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `always`    | Loaded into every agent session unconditionally                                                         |
| `auto`      | Loaded automatically by tools that support description-based activation; degrades to `manual` elsewhere |
| `manual`    | Loaded only when explicitly referenced                                                                  |
| `fileMatch` | Loaded when the agent operates on files matching `globs`                                                |

### Per-tool overrides

Set `tools: [kiro]` on a rule that only makes sense in one host. For example,
`review-preamble.md` is restricted to Kiro because the MDAA review-agent
infrastructure (`scripts/review/lib/kiro_integration.py`) consumes it directly.

## Supported tools

| Tool           | Output path                                                                               | Reference style                          |
| -------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| Kiro           | `.kiro/steering/<name>.md`                                                                | `#[[file:...]]` include directive        |
| Claude Code    | `CLAUDE.md` (always rules), `.claude/rules/<name>.md` (others)                            | Markdown link to canonical source        |
| GitHub Copilot | `.github/copilot-instructions.md` (always), `.github/instructions/<name>.instructions.md` | Markdown link; `applyTo` for `fileMatch` |
| Cursor         | `.cursor/rules/<name>.mdc`                                                                | `@`-mention; `alwaysApply` + `globs`     |
| Windsurf       | `.windsurf/rules/<name>.md`                                                               | `@`-mention; `trigger:` frontmatter      |

Each projected file references the canonical body at
`agent_rules/<name>.md` rather than inlining it.

## Building projections

```bash
# From this package directory
npm run build        # tsc + regenerate all projections

# From the repo root
npx nx build @aws-mdaa/agent-rules
```

`run-projections.ts` is invoked automatically as part of `npm run build`. It is
idempotent: files whose contents already match are not rewritten, and stale
files in each tool's output directory (e.g. a rule that was renamed or removed)
are pruned automatically.

## Programmatic API

```ts
import { loadSources, projectKiro, projectClaude, project } from '@aws-mdaa/agent-rules';

const sources = loadSources(); // auto-discovers agent_rules/*.md
const kiro = projectKiro(sources.rules); // ProjectionResult
const claude = projectClaude(sources.rules);

project({ consumerRoot: process.cwd() }); // write all projections
```

The full type surface lives in `lib/index.ts`.

## Editing rules

1. Edit the canonical file under `agent_rules/<name>.md` (frontmatter and/or body).
2. Run `npm run build` to regenerate projections.
3. Commit the canonical rule and the regenerated projections together.

Because content changes don't alter the thin projections, most content-only
edits regenerate nothing — only scope/glob/description/tool changes do.

> **Never edit the projected files directly** (`.kiro/steering/`,
> `.claude/rules/`, `.cursor/rules/`, `.github/instructions/`,
> `.windsurf/rules/`, `CLAUDE.md`). They are generated and carry an
> auto-generated banner. Edits will be overwritten on the next build.

## Why are projections checked in?

A developer must be fully set up immediately after checkout, with no extra
build step. Committing the projections means every tool works on clone. The
projections are marked `linguist-generated` in `.gitattributes` so they
auto-collapse in MR diffs.

The MDAA review-agent infrastructure additionally has hard dependencies on the
canonical sources:

- `scripts/review/lib/kiro_integration.py` reads `review-preamble.md` directly
  (it does not resolve Kiro includes, so it reads the canonical source, not the
  `.kiro/steering/` wrapper).
- Each review agent prompt embeds a
  `#[[file:agent_rules/<rule>.md]]` directive resolved
  at runtime.
- `_steering_link()` in `scripts/review/lib/thread_lifecycle.py` builds GitLab
  URLs to the canonical sources for MR review threads.

## Guardrails

- `test/byte-equivalence.test.ts` asserts that every checked-in projection
  matches what the projector produces and that no stale/unprojected files
  remain in `.kiro/steering/`.
- The projector prunes stale files in each output directory on every run.

## License

Apache-2.0 — see the repository [LICENSE](../../../LICENSE.txt).
