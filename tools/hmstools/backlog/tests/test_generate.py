"""generate: the YAML file, and preservation of hand-edited fields on regeneration."""

from __future__ import annotations

import unittest

from hmstools.backlog.commands import CommandFailed, generate
from hmstools.backlog.records import dump_records, load_records
from hmstools.backlog.tests.synthetic import PLAN, SyntheticRepo


class GenerateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = SyntheticRepo()
        self.paths = self.repo.paths

    def tearDown(self) -> None:
        self.repo.cleanup()

    def records(self) -> dict[str, dict]:
        out = {}
        for record in load_records(self.paths.backlog):
            key = record["id"] if "part" not in record else f"{record['id']} · part: {record['part']}"
            out[key] = record
        return out

    def test_first_generation(self) -> None:
        report = generate(self.paths)
        self.assertEqual((report.rows, report.features, report.kept), (16, 15, 0))
        text = self.paths.backlog.read_bytes()
        self.assertNotIn(b"\r", text)
        header = text.decode("utf-8").split("\n- id:")[0]
        self.assertIn("GENERATED from BUILD-PROMPT.md Appendix A", header)
        self.assertIn("'tools/hms backlog generate'", header)
        self.assertIn("Only these fields are edited, by hand or by tools: status, work_packages, tests, hazards, notes.", header)
        records = self.records()
        core = records["PLT-CORE-02"]
        self.assertEqual(
            list(core),
            ["id", "group", "section", "title", "size", "phase", "stance", "domain_level", "scope", "kurdistan_note",
             "placement_marked", "status", "work_packages", "tests", "hazards", "notes"],
        )
        self.assertEqual(core["status"], "todo")
        self.assertEqual((core["tests"], core["hazards"], core["notes"]), ([], [], []))
        self.assertEqual(core["work_packages"], ["WP-0.3", "WP-1.1 (full)"])
        self.assertEqual(records["RCM-SCH-01 · part: scheme"]["part"], "scheme")
        self.assertEqual(records["RCM-US-01"]["work_packages"], [])

    def test_regeneration_keeps_hand_edited_fields_and_refreshes_parsed_ones(self) -> None:
        generate(self.paths)
        records = load_records(self.paths.backlog)
        for record in records:
            if record["id"] == "PLT-CORE-02":
                record.update(
                    status="in-progress",
                    tests=["PropertyTest:EnterpriseLocks"],
                    hazards=["HAZ-0001"],
                    notes=["Lock semantics agreed in WP-0.3"],
                    title="Edited by mistake",
                    phase="P3",
                )
                record["work_packages"] = ["WP-0.3", "WP-9.9 (added by a tool)"]
            if record.get("part") == "scheme":
                record["status"] = "spec"
        self.paths.backlog.write_text(dump_records(records), encoding="utf-8", newline="\n")

        report = generate(self.paths)
        self.assertEqual(report.kept, 16)
        self.assertEqual(report.extra_work_packages, {"PLT-CORE-02": ["WP-9.9 (added by a tool)"]})
        self.assertEqual(report.refreshed, {"PLT-CORE-02": ["title", "phase"]})
        records = self.records()
        core = records["PLT-CORE-02"]
        self.assertEqual(core["status"], "in-progress")
        self.assertEqual(core["tests"], ["PropertyTest:EnterpriseLocks"])
        self.assertEqual(core["hazards"], ["HAZ-0001"])
        self.assertEqual(core["notes"], ["Lock semantics agreed in WP-0.3"])
        self.assertEqual(core["title"], "Enterprise | hierarchy")
        self.assertEqual(core["phase"], "R1")
        self.assertEqual(core["work_packages"], ["WP-0.3", "WP-1.1 (full)", "WP-9.9 (added by a tool)"])
        self.assertEqual(records["RCM-SCH-01 · part: scheme"]["status"], "spec")
        self.assertEqual(records["RCM-SCH-01"]["status"], "todo")

    def test_regeneration_without_edits_changes_nothing(self) -> None:
        generate(self.paths)
        before = self.paths.backlog.read_bytes()
        report = generate(self.paths)
        self.assertEqual((report.kept, report.added, report.refreshed, report.extra_work_packages), (16, [], {}, {}))
        self.assertEqual(self.paths.backlog.read_bytes(), before)

    def test_an_unknown_field_stops_generation_instead_of_being_dropped(self) -> None:
        generate(self.paths)
        text = self.paths.backlog.read_text(encoding="utf-8")
        self.assertIn("- id: PLT-CORE-01\n", text)
        text = text.replace("- id: PLT-CORE-01\n", "- id: PLT-CORE-01\n  owner: someone\n", 1)
        self.paths.backlog.write_text(text, encoding="utf-8", newline="\n")
        self.assertEqual(load_records(self.paths.backlog)[0]["owner"], "someone")
        before = self.paths.backlog.read_bytes()
        with self.assertRaises(CommandFailed) as caught:
            generate(self.paths)
        self.assertIn("PLT-CORE-01 (owner)", str(caught.exception))
        self.assertIn("not overwritten", str(caught.exception))
        self.assertEqual(self.paths.backlog.read_bytes(), before)

    def test_a_feature_that_disappears_from_the_source_fails_loudly(self) -> None:
        generate(self.paths)
        before = self.paths.backlog.read_bytes()
        row = "| `RCM-US-01` | US RCM | XL (BP L→XL) | DROPPED-K | B+I | X12 · *Dropped: US-only* |\n"
        self.assertIn(row, PLAN)
        self.repo.write_plan(PLAN.replace(row, ""))
        with self.assertRaises(CommandFailed) as caught:
            generate(self.paths)
        self.assertIn("RCM-US-01", str(caught.exception))
        self.assertIn("no longer in BUILD-PROMPT.md Appendix A", str(caught.exception))
        self.assertEqual(self.paths.backlog.read_bytes(), before)

    def test_a_disappeared_feature_still_named_in_section_21_also_fails_loudly(self) -> None:
        generate(self.paths)
        before = self.paths.backlog.read_bytes()
        row = "| `ERP-HTM-01` | CMMS | M | P2 | B | Asset register |\n"
        self.assertIn(row, PLAN)
        self.repo.write_plan(PLAN.replace(row, ""))
        with self.assertRaises(CommandFailed) as caught:
            generate(self.paths)
        self.assertIn("ERP-HTM-01", str(caught.exception))
        self.assertIn("no longer in BUILD-PROMPT.md Appendix A", str(caught.exception))
        self.assertEqual(self.paths.backlog.read_bytes(), before)

    def test_a_new_feature_is_added_with_defaults(self) -> None:
        generate(self.paths)
        row = "| `ERP-HTM-01` | CMMS | M | P2 | B | Asset register |\n"
        self.repo.write_plan(PLAN.replace(row, row + "| `ERP-SVC-01` | Support services | M | P2 | B | CSSD |\n"))
        report = generate(self.paths)
        self.assertEqual(report.added, ["ERP-SVC-01"])
        self.assertEqual(self.records()["ERP-SVC-01"]["status"], "todo")

    def test_duplicate_rows_in_the_existing_file_stop_generation(self) -> None:
        generate(self.paths)
        records = load_records(self.paths.backlog)
        self.paths.backlog.write_text(dump_records(records + [records[0]]), encoding="utf-8", newline="\n")
        before = self.paths.backlog.read_bytes()
        with self.assertRaises(CommandFailed) as caught:
            generate(self.paths)
        self.assertIn("more than once", str(caught.exception))
        self.assertEqual(self.paths.backlog.read_bytes(), before)

    def test_unparseable_existing_file_is_not_overwritten(self) -> None:
        self.paths.backlog.parent.mkdir(parents=True, exist_ok=True)
        self.paths.backlog.write_text("- id: [unclosed\n", encoding="utf-8")
        with self.assertRaises(CommandFailed):
            generate(self.paths)
        self.assertEqual(self.paths.backlog.read_text(encoding="utf-8"), "- id: [unclosed\n")

    def test_unknown_feature_in_section_21_stops_generation(self) -> None:
        self.repo.write_plan(PLAN.replace("`KRI-ID-01`, control sets", "`KRI-ID-99`, control sets"))
        with self.assertRaises(CommandFailed) as caught:
            generate(self.paths)
        self.assertIn("KRI-ID-99", str(caught.exception))
        self.assertFalse(self.paths.backlog.exists())


if __name__ == "__main__":
    unittest.main()
