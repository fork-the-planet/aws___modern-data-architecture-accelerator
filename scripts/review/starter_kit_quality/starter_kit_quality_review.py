#!/usr/bin/env python3
"""
Starter Kit Quality Review — reviews changed starter kits for standards compliance.

1. Detects starter kits with changed files under starter_kits/
2. For each kit, collects README, mdaa.yaml, roles config, and all YAML files
3. Pipes context through Kiro headless for quality assessment against starter-kit-standards.md
4. Produces a JSON report and Code Quality report for GitLab MR

Outputs:
  starter-kit-quality-review/report.json              - Full structured report with findings
  starter-kit-quality-review/codequality-report.json  - Code Quality report for GitLab

Environment:
  KIRO_API_KEY                     - Required for assessment
  KIRO_MODEL                       - Optional, default claude-opus-4.8
  KIRO_EFFORT                      - Optional, default high
  KIRO_TIMEOUT                     - Optional, default 600s
  KIRO_MAX_THREADS                 - Optional, default 5

Usage:
  python3 scripts/review/starter_kit_quality/starter_kit_quality_review.py [--output-dir starter-kit-quality-review]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from review.lib.nx_graph import PROJECT_ROOT, _target_ref
from review.lib.kiro_integration import (
    run_kiro_assessment,
    KiroError,
    _parse_risk_json,
    _parse_risk_level,
)
from review.lib.report import to_codequality_json
from review.lib.thread_lifecycle import compute_source_hash


KIRO_PROMPT = """\
You are reviewing starter kit quality for starter kit '{kit_name}'.

Read the steering file #[[file:agent_rules/review-starter-kit-standards.md]] for the complete
starter kit standards and the CI Agent Usage section for output format.

Starter kit: {kit_name}
Kit path: starter_kits/{kit_name}/

README.md:
```
{readme}
```

USAGE.md:
```
{usage_md}
```

mdaa.yaml:
```yaml
{mdaa_yaml}
```

Roles config ({roles_file}):
```yaml
{roles_config}
```

All YAML files in the kit:
```
{all_yaml_files}
```

Files present in the kit directory:
{kit_file_listing}

Files present at repo root (for relative link validation):
{repo_root_files}

Code diff (changes in this MR):
```diff
{code_diff}
```

IMPORTANT — Review with a customer-first mindset:
1. Check README structure against the required section order in the steering file.
2. Validate that every config file path referenced in mdaa.yaml exists in the kit directory.
3. Validate that schema directive paths in YAML files point to schema files that exist.
4. Check that environment-specific values are centralized in mdaa.yaml context, not scattered
   across module configs.
5. Ensure TODOs clearly explain what the customer needs to provide and why.
6. Verify every config property has a preceding comment explaining what it controls.
7. Check that a first-time customer could deploy this kit by following the README alone —
   no ambiguous steps, no undocumented prerequisites, no dead ends.
8. Verify SSM cross-module reference integrity: for each ssm-org:, ssm-domain:,
   domainConfigSSMParam, {{resolve:ssm:...}}, or generated-role-id: reference in the module
   configs, confirm a module deployed in this kit's mdaa.yaml produces that path (match the
   <domain>/<module> segments to a real domain/module pair). Flag references whose producer
   cannot be located. When the producer mapping is genuinely ambiguous from the YAML alone,
   do not flag — the synth-time diff tests are the authoritative gate. See the SSM cross-module
   reference integrity rules in the config-authoring steering file.

DO NOT flag these concerns (they are handled by other agents):
- Spelling, grammar, or prose quality in documentation → Documentation Quality agent
- General markdown link validity (links to repo-root docs, anchor links) → Documentation Quality agent
- Broken image references in markdown → Documentation Quality agent
- Module-level documentation gaps → Module Quality agent
- Code architecture or dependency issues → Architecture agent

Write your assessment to the file {output_file} as a JSON object following the schema
in the CI Agent Usage section of the steering file. No preamble, no markdown fences,
no explanation outside the JSON. The file must contain ONLY valid JSON.
"""


def get_changed_starter_kits() -> list[dict]:
    """Detect starter kits with changed files under starter_kits/.

    Returns a list of dicts with 'name' and 'root' keys for each affected kit.
    """
    result = subprocess.run(
        ["git", "diff", "--name-only", _target_ref(), "--", "starter_kits/"],
        capture_output=True, text=True, cwd=str(PROJECT_ROOT),
    )
    changed_files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]

    if not changed_files:
        return []

    # Extract unique kit names from changed file paths
    kit_names: set[str] = set()
    for f in changed_files:
        parts = f.split("/")
        if len(parts) >= 2 and parts[0] == "starter_kits":
            kit_names.add(parts[1])

    kits = []
    for name in sorted(kit_names):
        kit_root = f"starter_kits/{name}"
        # Only include kits that still exist (not deleted)
        if (PROJECT_ROOT / kit_root).is_dir():
            kits.append({"name": name, "root": kit_root})

    return kits


def collect_readme(kit_root: str, max_chars: int = 10000) -> str:
    """Read the README.md for the starter kit."""
    readme_path = PROJECT_ROOT / kit_root / "README.md"
    if not readme_path.is_file():
        return "(no README.md)"
    content = readme_path.read_text()
    if len(content) > max_chars:
        content = content[:max_chars] + f"\n\n... (truncated, {len(content)} total chars)"
    return content


def collect_usage_md(kit_root: str, max_chars: int = 10000) -> str:
    """Read the USAGE.md for the starter kit (checks root and docs/)."""
    kit_path = PROJECT_ROOT / kit_root
    for location in [kit_path / "USAGE.md", kit_path / "docs" / "USAGE.md"]:
        if location.is_file():
            content = location.read_text()
            if len(content) > max_chars:
                content = content[:max_chars] + f"\n\n... (truncated, {len(content)} total chars)"
            return content
    return "(no USAGE.md)"


def collect_mdaa_yaml(kit_root: str, max_chars: int = 10000) -> str:
    """Read the mdaa.yaml for the starter kit."""
    mdaa_path = PROJECT_ROOT / kit_root / "mdaa.yaml"
    if not mdaa_path.is_file():
        return "(no mdaa.yaml)"
    content = mdaa_path.read_text()
    if len(content) > max_chars:
        content = content[:max_chars] + f"\n\n... (truncated, {len(content)} total chars)"
    return content


def collect_roles_config(kit_root: str, max_chars: int = 10000) -> tuple[str, str]:
    """Read the roles config file for the starter kit.

    Returns a tuple of (filename, content).
    """
    kit_path = PROJECT_ROOT / kit_root
    # Look for common roles file names
    for name in ["roles.yaml", "roles.yml"]:
        roles_path = kit_path / name
        if roles_path.is_file():
            content = roles_path.read_text()
            if len(content) > max_chars:
                content = content[:max_chars] + f"\n\n... (truncated, {len(content)} total chars)"
            return name, content

    # Search subdirectories for roles files
    for roles_path in sorted(kit_path.rglob("*roles*.yaml")):
        content = roles_path.read_text()
        rel_name = str(roles_path.relative_to(kit_path))
        if len(content) > max_chars:
            content = content[:max_chars] + f"\n\n... (truncated, {len(content)} total chars)"
        return rel_name, content

    return "roles.yaml", "(no roles config found)"


def collect_all_yaml_files(kit_root: str, max_chars: int = 15000) -> str:
    """Read all YAML files in the starter kit directory."""
    kit_path = PROJECT_ROOT / kit_root
    if not kit_path.is_dir():
        return "(kit directory not found)"

    yaml_files = sorted(kit_path.rglob("*.yaml")) + sorted(kit_path.rglob("*.yml"))
    if not yaml_files:
        return "(no YAML files found)"

    parts: list[str] = []
    total = 0
    for f in yaml_files:
        rel = f.relative_to(PROJECT_ROOT)
        content = f.read_text()
        section = f"--- {rel} ---\n{content}\n"
        if total + len(section) > max_chars:
            parts.append(f"\n... (truncated, {len(yaml_files)} total YAML files)")
            break
        parts.append(section)
        total += len(section)

    return "\n".join(parts)


def collect_code_diff(kit_root: str, max_chars: int = 15000) -> str:
    """Get the git diff for a starter kit directory."""
    result = subprocess.run(
        ["git", "diff", _target_ref(), "--", f"{kit_root}/"],
        capture_output=True, text=True, cwd=str(PROJECT_ROOT),
    )
    diff = result.stdout.strip()
    if not diff:
        return "(no changes)"
    if len(diff) > max_chars:
        diff = diff[:max_chars] + f"\n\n... (truncated, {len(diff)} total chars)"
    return diff


def collect_kit_file_listing(kit_root: str) -> str:
    """List all files in the starter kit directory for link validation."""
    kit_path = PROJECT_ROOT / kit_root
    if not kit_path.is_dir():
        return "(kit directory not found)"

    files: list[str] = []
    for f in sorted(kit_path.rglob("*")):
        if f.is_file():
            files.append(str(f.relative_to(kit_path)))

    if not files:
        return "(empty directory)"
    return "\n".join(f"  - {f}" for f in files)


def collect_repo_root_files() -> str:
    """List key files at the repo root that starter kit READMEs commonly link to."""
    key_files = [
        "PREDEPLOYMENT.md", "DEPLOYMENT.md", "USAGE.md", "CONTRIBUTING.md",
        "README.md", "CONFIGURATION.md", "CHANGELOG.md",
    ]
    found = []
    for name in key_files:
        if (PROJECT_ROOT / name).is_file():
            found.append(name)

    # Also check schemas/ directory
    schemas_dir = PROJECT_ROOT / "schemas"
    if schemas_dir.is_dir():
        schema_files = sorted(schemas_dir.rglob("*.json"))
        found.append(f"schemas/ ({len(schema_files)} JSON schema files)")

    return "\n".join(f"  - {f}" for f in found)


def assess_kit(kit: dict) -> dict:
    """Run Kiro starter kit quality assessment for a single kit."""
    name = kit["name"]
    root = kit["root"]

    print(f"  [start] {name}")

    roles_file, roles_content = collect_roles_config(root)

    prompt = KIRO_PROMPT.format(
        kit_name=name,
        readme=collect_readme(root),
        usage_md=collect_usage_md(root),
        mdaa_yaml=collect_mdaa_yaml(root),
        roles_file=roles_file,
        roles_config=roles_content,
        all_yaml_files=collect_all_yaml_files(root),
        kit_file_listing=collect_kit_file_listing(root),
        repo_root_files=collect_repo_root_files(),
        code_diff=collect_code_diff(root),
        output_file="{output_file}",
    )

    assessment = run_kiro_assessment(prompt, validate_json=True)
    parsed = _parse_risk_json(assessment)
    findings = parsed.get("findings", []) if parsed else []
    summary = parsed.get("summary", "") if parsed else ""
    risk_level = _parse_risk_level(assessment)

    print(f"  [done]  {name} — {risk_level} ({len(findings)} findings)")

    return {
        "kit_name": name,
        "root": root,
        "risk_level": risk_level,
        "risk_summary": summary,
        "findings": findings,
        "risk_assessment": assessment,
        "source_hash": compute_source_hash(str(PROJECT_ROOT / root)),
    }


def build_report(kits: list[dict]) -> list[dict]:
    """Run starter kit quality assessments in parallel."""
    max_threads = int(os.environ.get("KIRO_MAX_THREADS", "5"))
    entries = []

    if not kits:
        return entries

    print(f"\n  Running {len(kits)} assessment(s) with {max_threads} thread(s)...")

    with ThreadPoolExecutor(max_workers=max_threads) as executor:
        futures = {executor.submit(assess_kit, kit): kit for kit in kits}
        for future in as_completed(futures):
            kit = futures[future]
            try:
                entries.append(future.result())
            except KiroError as e:
                print(f"  [error] {kit['name']} — {e}", file=sys.stderr)
                entries.append({
                    "kit_name": kit["name"],
                    "root": kit["root"],
                    "risk_level": "UNKNOWN",
                    "risk_summary": f"Assessment failed: {e}",
                    "findings": [],
                    "risk_assessment": "",
                    "source_hash": "",
                })

    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description="Starter kit quality review report generator")
    parser.add_argument(
        "--output-dir",
        default="starter-kit-quality-review",
        help="Output directory for reports",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Detecting changed starter kits...")
    kits = get_changed_starter_kits()

    if not kits:
        print("No starter kit changes detected.")
        report_path = output_dir / "report.json"
        report_path.write_text("[]")
        (output_dir / "codequality-report.json").write_text("[]")
        print("Empty reports written. Thread posting will confirm agent ran.")
        return

    print(f"Found {len(kits)} changed starter kit(s):")
    for kit in kits:
        print(f"  - {kit['name']}")

    entries = build_report(kits)

    report_path = output_dir / "report.json"
    report_path.write_text(json.dumps(entries, indent=2))
    print(f"\nReport written to {report_path}")

    # Code Quality report
    cq_path = output_dir / "codequality-report.json"
    cq_path.write_text(to_codequality_json(entries, agent_name="starter-kit-quality"))
    print(f"Code Quality report written to {cq_path}")

    risk_counts: dict[str, int] = {}
    for e in entries:
        risk_counts[e["risk_level"]] = risk_counts.get(e["risk_level"], 0) + 1
    print(f"\nSummary: {', '.join(f'{v} {k}' for k, v in sorted(risk_counts.items()))}")


if __name__ == "__main__":
    main()
