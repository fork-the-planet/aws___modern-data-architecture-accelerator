"""Tests for generate_starter_kit_jobs.py — the CI child-pipeline generator.

Tests the pure generate() rendering only (not the subprocess kit discovery).
"""

from __future__ import annotations

import yaml

from generate_starter_kit_jobs import generate


def _load(yaml_text: str) -> dict:
    return yaml.safe_load(yaml_text)


class TestGenerate:
    def test_emits_one_job_per_kit(self):
        doc = _load(generate(["basic_datalake", "smus_data_mesh"]))
        jobs = [k for k in doc if not k.startswith(".") and k not in ("image", "before_script")]
        assert jobs == ["sk_basic_datalake", "sk_smus_data_mesh"]

    def test_job_invokes_runner_scoped_to_its_kit(self):
        doc = _load(generate(["basic_datalake"]))
        script = "\n".join(doc["sk_basic_datalake"]["script"])
        assert "--kit basic_datalake" in script
        # Bootstraps like bin/mdaa: npm install + build only CLI and the harness;
        # the CLI builds other modules on demand at synth.
        assert "npm install" in script
        assert "@aws-mdaa/cli" in script
        assert "@aws-mdaa/testing" in script

    def test_jobs_extend_shared_base(self):
        doc = _load(generate(["basic_datalake"]))
        assert ".starter_kit_test_base" in doc
        assert doc["sk_basic_datalake"]["extends"] == ".starter_kit_test_base"

    def test_base_runs_in_child_pipeline_regardless_of_source(self):
        # Child-pipeline jobs must opt out of the default branches/tags filter,
        # otherwise an MR-triggered child pipeline is empty and fails to create.
        doc = _load(generate(["basic_datalake"]))
        assert doc[".starter_kit_test_base"]["rules"] == [{"when": "always"}]

    def test_base_retries_on_infra_failure_only(self):
        doc = _load(generate(["basic_datalake"]))
        retry = doc[".starter_kit_test_base"]["retry"]
        assert retry["max"] == 2
        assert set(retry["when"]) == {
            "runner_system_failure",
            "stuck_or_timeout_failure",
            "api_failure",
            "scheduler_failure",
        }
        # script_failure must NOT be retried — a real failure fails loudly.
        assert "script_failure" not in retry["when"]

    def test_noop_runs_regardless_of_source(self):
        doc = _load(generate([]))
        assert doc["sk_no_kits"]["rules"] == [{"when": "always"}]

    def test_base_pulls_build_cache(self):
        doc = _load(generate(["basic_datalake"]))
        cache = doc[".starter_kit_test_base"]["cache"]
        assert cache["policy"] == "pull"
        assert cache["key"] == "feature-merge-build-$CI_COMMIT_REF_SLUG"

    def test_no_kits_emits_valid_noop_pipeline(self):
        doc = _load(generate([]))
        jobs = [k for k in doc if not k.startswith(".") and k not in ("image", "before_script")]
        # Exactly one no-op job so the child pipeline is non-empty (GitLab requires it).
        assert jobs == ["sk_no_kits"]

    def test_output_is_valid_yaml_for_many_kits(self):
        kits = [f"kit_{i}" for i in range(12)]
        doc = _load(generate(kits))
        jobs = [k for k in doc if k.startswith("sk_")]
        assert len(jobs) == 12
