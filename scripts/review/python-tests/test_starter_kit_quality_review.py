"""Tests for Starter Kit Quality Review agent thread posting."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from review.starter_kit_quality.post_starter_kit_quality_threads import (
    SUMMARY_MARKER,
    format_summary_body,
    _highest_finding_risk,
)


class TestHighestFindingRisk:
    def test_picks_highest(self):
        entry = {"findings": [{"risk": "LOW"}, {"risk": "HIGH"}, {"risk": "MEDIUM"}]}
        assert _highest_finding_risk(entry) == "HIGH"

    def test_defaults_low_when_empty(self):
        assert _highest_finding_risk({"findings": []}) == "LOW"


class TestFormatSummaryBody:
    def test_includes_marker(self):
        entries = [{"kit_name": "minimal", "risk_summary": "", "findings": [
            {"risk": "HIGH", "category": "readme_structure"},
        ]}]
        body = format_summary_body(entries)
        assert SUMMARY_MARKER in body
        assert "Starter Kit Quality Review Summary" in body
        assert "1 HIGH" in body

    def test_no_findings(self):
        entries = [{"kit_name": "minimal", "risk_summary": "", "findings": []}]
        body = format_summary_body(entries)
        assert "All starter kits meet quality standards" in body

    def test_empty_entries(self):
        body = format_summary_body([])
        assert "Kits reviewed:** 0" in body
        assert "All starter kits meet quality standards" in body

    def test_breakdown_counts_threads_not_findings(self):
        """One kit = one thread headed at the kit's highest finding risk; the
        breakdown counts the thread, not each individual finding."""
        entries = [{"kit_name": "minimal", "risk_summary": "", "findings": [
            {"risk": "HIGH", "category": "readme_structure"},
            {"risk": "LOW", "category": "cli_usage"},
        ]}]
        body = format_summary_body(entries)
        assert "**Review threads:** 1" in body
        assert "**Total concerns:** 2" in body
        assert "1 HIGH" in body
        assert "1 LOW" not in body
