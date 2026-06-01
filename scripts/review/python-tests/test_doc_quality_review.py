"""Tests for Documentation Quality Review agent."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from review.doc_quality.doc_quality_review import (
    has_code_changes,
    get_changed_markdown_files,
    validate_cross_references,
    classify_change_types,
    get_changed_packages_summary,
)
from review.doc_quality.post_doc_quality_threads import (
    SUMMARY_MARKER, build_file_groups, format_summary_body,
    format_file_thread,
)
from review.lib.thread_lifecycle import find_thread_by_marker, find_summary_note

# Wrap shared functions for test compatibility
FILE_PATTERN = __import__("re").compile(r"<!-- docs-quality-file:(.+?) -->")


def find_existing_thread(discussions, file_path):
    d, h, n, c = find_thread_by_marker(discussions, FILE_PATTERN, file_path)
    return d, h, n


class TestHasCodeChanges:
    def test_ts_file_in_lib(self):
        assert has_code_changes(["packages/constructs/L2/s3/lib/index.ts"]) is True

    def test_py_file_in_lib(self):
        assert has_code_changes(["packages/constructs/L3/datalake/lib/handler.py"]) is True

    def test_md_only(self):
        assert has_code_changes(["README.md", "CHANGELOG.md"]) is False

    def test_scripts(self):
        assert has_code_changes(["scripts/review/compliance/compliance_review.py"]) is False

    def test_empty(self):
        assert has_code_changes([]) is False

    def test_test_files_not_code(self):
        assert has_code_changes(["packages/apps/datalake/test/datalake.test.ts"]) is False


class TestGetChangedMarkdownFiles:
    def test_filters_md(self):
        files = ["README.md", "lib/index.ts", "CHANGELOG.md", "docs/guide.md"]
        result = get_changed_markdown_files(files)
        assert result == ["README.md", "CHANGELOG.md", "docs/guide.md"]

    def test_no_md(self):
        assert get_changed_markdown_files(["lib/index.ts", "package.json"]) == []

    def test_empty(self):
        assert get_changed_markdown_files([]) == []

    def test_excludes_kiro_steering(self):
        files = [".kiro/steering/documentation-review.md", ".kiro/steering/module-quality.md", "README.md"]
        result = get_changed_markdown_files(files)
        assert result == ["README.md"]

    def test_excludes_kiro_specs(self):
        files = [".kiro/specs/feature/tasks.md", "CHANGELOG.md"]
        result = get_changed_markdown_files(files)
        assert result == ["CHANGELOG.md"]

    def test_excludes_all_dotfolders(self):
        files = [".github/workflows/docs.md", ".gitlab/issue_templates/bug_report.md", "docs/guide.md"]
        result = get_changed_markdown_files(files)
        assert result == ["docs/guide.md"]


class TestValidateCrossReferences:
    def test_existing_file(self, tmp_path):
        # Create a markdown file with a link to another file that exists
        target = tmp_path / "other.md"
        target.write_text("# Other")
        md_file = tmp_path / "test.md"
        md_file.write_text("[link](other.md)")

        with patch("review.doc_quality.doc_quality_review.PROJECT_ROOT", tmp_path):
            result = validate_cross_references(str(md_file))
        assert "[OK]" in result
        assert "0 broken" in result

    def test_broken_link(self, tmp_path):
        md_file = tmp_path / "test.md"
        md_file.write_text("[link](nonexistent.md)")

        with patch("review.doc_quality.doc_quality_review.PROJECT_ROOT", tmp_path):
            result = validate_cross_references(str(md_file))
        assert "[BROKEN]" in result
        assert "1 broken" in result

    def test_skips_urls(self, tmp_path):
        md_file = tmp_path / "test.md"
        md_file.write_text("[link](https://example.com)")

        with patch("review.doc_quality.doc_quality_review.PROJECT_ROOT", tmp_path):
            result = validate_cross_references(str(md_file))
        assert "no relative links" in result

    def test_skips_anchors(self, tmp_path):
        md_file = tmp_path / "test.md"
        md_file.write_text("[link](#section)")

        with patch("review.doc_quality.doc_quality_review.PROJECT_ROOT", tmp_path):
            result = validate_cross_references(str(md_file))
        assert "no relative links" in result

    def test_missing_file(self):
        result = validate_cross_references("/nonexistent/path/file.md")
        assert "does not exist" in result


class TestClassifyChangeTypes:
    def test_app_code(self):
        result = classify_change_types(["packages/apps/datalake/datalake-app/lib/index.ts"])
        assert "app module code changes" in result

    def test_construct_code(self):
        result = classify_change_types(["packages/constructs/L2/s3/lib/bucket.ts"])
        assert "construct code changes" in result

    def test_schema_changes(self):
        result = classify_change_types(["packages/apps/datalake/datalake-app/lib/config-schema.json"])
        assert "config schema changes" in result

    def test_ci_changes(self):
        result = classify_change_types(["scripts/ci/deploy.sh", ".gitlab-ci.yml"])
        assert "CI/infrastructure changes" in result

    def test_doc_changes(self):
        result = classify_change_types(["README.md"])
        assert "documentation changes" in result

    def test_empty(self):
        result = classify_change_types([])
        assert "unable to classify" in result


class TestGetChangedPackagesSummary:
    def test_packages(self):
        files = [
            "packages/apps/datalake/datalake-app/lib/index.ts",
            "packages/apps/datalake/datalake-app/lib/config.ts",
            "packages/constructs/L2/s3/lib/bucket.ts",
        ]
        result = get_changed_packages_summary(files)
        assert "packages/apps/datalake/datalake-app" in result
        assert "packages/constructs/L2/s3" in result

    def test_no_packages(self):
        result = get_changed_packages_summary(["README.md", "scripts/build.sh"])
        assert "no package changes" in result


class TestBuildFileGroups:
    def test_groups_from_per_file_entries(self):
        entries = [
            {
                "file": "CHANGELOG.md",
                "risk_level": "HIGH",
                "findings": [
                    {"file": "CHANGELOG.md", "risk": "HIGH", "category": "changelog", "detail": "Not updated"},
                ],
                "source_hash": "abc123",
            }
        ]
        groups = build_file_groups(entries)
        assert "CHANGELOG.md" in groups
        assert len(groups["CHANGELOG.md"]["findings"]) == 1
        assert groups["CHANGELOG.md"]["source_hash"] == "abc123"

    def test_empty_findings(self):
        entries = [{"file": "README.md", "risk_level": "LOW", "findings": [], "source_hash": "x"}]
        assert build_file_groups(entries) == {}

    def test_merges_multiple_entries_same_file(self):
        entries = [
            {"file": "README.md", "risk_level": "LOW", "findings": [
                {"risk": "LOW", "category": "spelling_grammar", "detail": "Typo"},
            ], "source_hash": "x"},
            {"file": "README.md", "risk_level": "HIGH", "findings": [
                {"risk": "HIGH", "category": "cross_reference", "detail": "Broken link"},
            ], "source_hash": "x"},
        ]
        groups = build_file_groups(entries)
        assert "README.md" in groups
        assert len(groups["README.md"]["findings"]) == 2
        assert groups["README.md"]["risk_level"] == "HIGH"


class TestFormatSummaryBody:
    def test_with_findings(self):
        entries = [{"findings": [{"risk": "HIGH", "category": "changelog"}]}]
        body = format_summary_body(entries)
        assert SUMMARY_MARKER in body
        assert "Documentation Quality Review Summary" in body
        assert "1 HIGH" in body

    def test_no_findings(self):
        body = format_summary_body([{"findings": []}])
        assert "No documentation gaps found" in body

    def test_files_reviewed_count(self):
        entries = [{"findings": []}, {"findings": [{"risk": "LOW", "category": "spelling_grammar"}]}]
        body = format_summary_body(entries)
        assert "**Files reviewed:** 2" in body


class TestFormatFileThread:
    def test_markers(self):
        group = {"file": "CHANGELOG.md", "risk_level": "HIGH", "findings": [
            {"risk": "HIGH", "category": "changelog", "detail": "Not updated"},
        ]}
        body = format_file_thread("CHANGELOG.md", group, "abc123")
        assert "<!-- docs-quality-file:CHANGELOG.md -->" in body
        assert "Documentation Review" in body
        assert "Documentation Gap: HIGH" in body
        assert "Contributor: fix the issue" in body

    def test_update(self):
        group = {"file": "f.md", "risk_level": "LOW", "findings": [
            {"risk": "LOW", "category": "cross_reference", "detail": "Stale link"},
        ]}
        body = format_file_thread("f.md", group, "x", is_update=True)
        assert "re-acknowledge" in body


class TestFindExistingThread:
    def test_finds(self):
        discussions = [{"id": "d1", "notes": [
            {"id": "n1", "body": "<!-- docs-quality-file:CHANGELOG.md -->\n<!-- docs-quality-hash:abc -->"}
        ]}]
        d, h, n = find_existing_thread(discussions, "CHANGELOG.md")
        assert d is not None
        assert h == "abc"

    def test_not_found(self):
        d, _, _ = find_existing_thread([{"id": "d1", "notes": [{"id": "n1", "body": "other"}]}], "CHANGELOG.md")
        assert d is None


class TestFindSummaryNote:
    def test_finds(self):
        assert find_summary_note([{"id": "n1", "body": SUMMARY_MARKER}], SUMMARY_MARKER) is not None

    def test_not_found(self):
        assert find_summary_note([{"id": "n1", "body": "nope"}], SUMMARY_MARKER) is None
