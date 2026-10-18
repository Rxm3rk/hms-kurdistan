"""check: passes on a consistent backlog and fails on a missing ID, a duplicate ID, a stale BACKLOG.md and more."""

from __future__ import annotations

import contextlib
import io
import json
import unittest

from hmstools.backlog.__main__ import main
from hmstools.backlog.check import run_check
from hmstools.backlog.commands import generate, render
from hmstools.backlog.records import dump_records, load_records
from hmstools.backlog.tests.synthetic import EXPECTED_IDS, PLAN, SyntheticRepo


class CheckTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = SyntheticRepo()
        self.paths = self.repo.paths
        generate(self.paths)
        render(self.paths)

    def tearDown(self) -> None:
        self.repo.cleanup()

    def check(self):
        return run_check(self.paths, expected_ids=EXPECTED_IDS)

    def rewrite(self, records: list[dict], rerender: bool = True) -> None:
        self.paths.backlog.write_text(dump_records(records), encoding="utf-8", newline="\n")
        if rerender:
            render(self.paths)

    def assertError(self, result, fragment: str) -> None:
        self.assertFalse(result.ok, "check passed but should have failed")
        self.assertTrue(any(fragment in e for e in result.errors), f"no error contains {fragment!r}: {result.errors}")

    def test_consistent_backlog_passes(self) -> None:
        result = self.check()
        self.assertEqual(result.errors, [])
        self.assertTrue(result.ok)
        counts = result.counts
        self.assertEqual((counts["features"], counts["rows"], counts["part_rows"]), (15, 16, 1))
        self.assertEqual((counts["phase_R1"], counts["phase_P2"], counts["phase_DROPPED-K"]), (7, 6, 1))
        self.assertEqual(counts["status_todo"], 15)
        self.assertEqual(counts["features_without_work_package"], 1)
        self.assertEqual(counts["features_without_work_package_not_dropped"], 0)
        self.assertEqual(counts["wp_references_not_mapped"], 1)
        self.assertTrue(any("RCM-*" in w for w in result.warnings))

    def test_crlf_plan_of_record_gives_the_same_result(self) -> None:
        # The working-tree BUILD-PROMPT.md may carry CRLF line endings; the parse must not depend on them.
        self.paths.source.write_bytes(PLAN.replace("\n", "\r\n").encode("utf-8"))
        self.assertEqual(self.check().errors, [])

    def test_missing_id_fails(self) -> None:
        records = [r for r in load_records(self.paths.backlog) if r["id"] != "ERP-HTM-01"]
        self.rewrite(records)
        result = self.check()
        self.assertError(result, "ERP-HTM-01 (BUILD-PROMPT.md line")
        self.assertError(result, f"14 unique feature IDs; expected exactly {EXPECTED_IDS}")

    def test_id_not_in_appendix_a_fails(self) -> None:
        records = load_records(self.paths.backlog)
        extra = dict(records[0], id="PLT-CORE-77")
        self.rewrite(records + [extra])
        self.assertError(self.check(), "PLT-CORE-77 is in backlog.yaml but not in BUILD-PROMPT.md Appendix A")

    def test_duplicate_id_fails(self) -> None:
        records = load_records(self.paths.backlog)
        self.rewrite(records + [dict(records[2])])
        self.assertError(self.check(), f"backlog.yaml lists {records[2]['id']} 2 times")

    def test_stale_backlog_md_fails(self) -> None:
        records = load_records(self.paths.backlog)
        records[0]["status"] = "spec"
        self.rewrite(records, rerender=False)
        self.assertError(self.check(), "is not up to date with backlog.yaml")

    def test_hand_edited_backlog_md_fails(self) -> None:
        text = self.paths.markdown.read_text(encoding="utf-8")
        self.paths.markdown.write_text(text.replace("| todo |", "| verified |", 1), encoding="utf-8", newline="\n")
        self.assertError(self.check(), "is not up to date with backlog.yaml")

    def test_crlf_backlog_md_fails(self) -> None:
        data = self.paths.markdown.read_bytes()
        self.paths.markdown.write_bytes(data.replace(b"\n", b"\r\n"))
        self.assertError(self.check(), "is not up to date with backlog.yaml")

    def test_missing_backlog_md_fails(self) -> None:
        self.paths.markdown.unlink()
        self.assertError(self.check(), "not found; run 'tools/hms backlog render'")

    def test_invalid_status_fails(self) -> None:
        records = load_records(self.paths.backlog)
        records[0]["status"] = "done"
        self.rewrite(records)
        self.assertError(self.check(), "status 'done' is not one of todo, spec, in-progress, built, verified")

    def test_built_without_tests_fails(self) -> None:
        records = load_records(self.paths.backlog)
        records[0]["status"] = "built"
        self.rewrite(records)
        self.assertError(self.check(), "status 'built' needs at least one test")

    def test_edited_parsed_field_fails(self) -> None:
        records = load_records(self.paths.backlog)
        records[0]["size"] = "S"
        self.rewrite(records)
        result = self.check()
        self.assertError(result, "'size' is 'S' in backlog.yaml but 'XL' in Appendix A")

    def test_removed_derived_work_package_fails_and_extra_one_warns(self) -> None:
        records = load_records(self.paths.backlog)
        for record in records:
            if record["id"] == "PLT-CORE-02":
                record["work_packages"] = ["WP-0.3", "WP-4.4 (by hand)"]
        self.rewrite(records)
        result = self.check()
        self.assertError(result, "work package 'WP-1.1 (full)' from §21 is missing")
        self.assertTrue(any("'WP-4.4 (by hand)' is not derived from §21" in w for w in result.warnings))

    def test_unparseable_backlog_yaml_fails(self) -> None:
        self.paths.backlog.write_text("- id: [unclosed\n", encoding="utf-8")
        self.assertError(self.check(), "does not parse as YAML")

    def test_missing_backlog_yaml_fails(self) -> None:
        self.paths.backlog.unlink()
        self.assertError(self.check(), "backlog.yaml not found")


class A18ComparisonTest(unittest.TestCase):
    def run_with(self, plan: str):
        repo = SyntheticRepo(plan)
        try:
            generate(repo.paths)
            render(repo.paths)
            return run_check(repo.paths, expected_ids=EXPECTED_IDS)
        finally:
            repo.cleanup()

    def test_count_mismatch_is_an_error(self) -> None:
        plan = PLAN.replace("| R2b | 1 | 8 |", "| R2b | 2 | 8 |")
        self.assertTrue(any("A.18 R2b: 2 feature IDs in A.18, 1 in backlog.yaml" in e for e in self.run_with(plan).errors))

    def test_unexplained_engineer_week_difference_is_an_error(self) -> None:
        plan = PLAN.replace("| R1 | 7 | 143 |", "| R1 | 7 | 133 |")
        result = self.run_with(plan)
        self.assertTrue(any("A.18 R1: 133 engineer-weeks in A.18, 143 in backlog.yaml (difference +10)" in e for e in result.errors))

    def test_difference_explained_by_the_a18_note_is_a_warning(self) -> None:
        # A.18 at K's figure for the AI gateway and control plane: 20 ew lower in P2 and in All.
        plan = PLAN.replace("| P2 | 6 | 99 |", "| P2 | 6 | 79 |").replace("| **All** | **15** | 300 |", "| **All** | **15** | 280 |")
        result = self.run_with(plan)
        self.assertEqual(result.errors, [])
        explained = [w for w in result.warnings if "explained by A.18's note" in w]
        self.assertEqual(len(explained), 2, result.warnings)

    def test_expected_count_comes_from_the_caller(self) -> None:
        repo = SyntheticRepo()
        try:
            generate(repo.paths)
            render(repo.paths)
            result = run_check(repo.paths, expected_ids=234)
        finally:
            repo.cleanup()
        self.assertTrue(any("expected exactly 234" in e for e in result.errors))


class CliTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = SyntheticRepo()

    def tearDown(self) -> None:
        self.repo.cleanup()

    def run_main(self, argv: list[str]) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = main(argv, paths=self.repo.paths)
        return code, out.getvalue()

    def test_json_result_is_the_last_line_and_exit_code_follows_ok(self) -> None:
        # The CLI expects the real 234 IDs, so the 15-ID synthetic plan fails: exit 1 with a JSON verdict.
        self.assertEqual(self.run_main(["generate"])[0], 0)
        self.assertEqual(self.run_main(["render"])[0], 0)
        code, out = self.run_main(["check", "--json"])
        verdict = json.loads(out.strip().split("\n")[-1])
        self.assertEqual(code, 1)
        self.assertEqual((verdict["check"], verdict["ok"]), ("backlog", False))
        self.assertEqual(set(verdict), {"check", "ok", "counts", "errors", "warnings"})

    def test_missing_source_is_an_environment_error(self) -> None:
        self.repo.paths.source.unlink()
        code, out = self.run_main(["check", "--json"])
        self.assertEqual(code, 2)
        self.assertFalse(json.loads(out.strip().split("\n")[-1])["ok"])
        self.assertEqual(self.run_main(["generate"])[0], 2)

    def test_no_subcommand_is_a_usage_error(self) -> None:
        self.assertEqual(self.run_main([])[0], 2)

    def test_generate_reports_overwritten_parsed_fields_and_refuses_unknown_fields(self) -> None:
        self.assertEqual(self.run_main(["generate"])[0], 0)
        path = self.repo.paths.backlog
        text = path.read_text(encoding="utf-8")
        self.assertIn("  title: Clinical journal\n", text)
        path.write_text(text.replace("  title: Clinical journal\n", "  title: Edited by hand\n", 1), encoding="utf-8", newline="\n")
        code, out = self.run_main(["generate"])
        self.assertEqual(code, 0)
        self.assertIn("refreshed PLT-CORE-01: title now as in BUILD-PROMPT.md", out)
        self.assertIn("  title: Clinical journal\n", path.read_text(encoding="utf-8"))
        path.write_text(text.replace("- id: PLT-CORE-01\n", "- id: PLT-CORE-01\n  owner: someone\n", 1), encoding="utf-8", newline="\n")
        self.assertEqual(self.run_main(["generate"])[0], 1)
        self.assertIn("owner: someone", path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
