"""Appendix A parsing: table rows, escaped pipes, the stance dagger, the italic note split, sizes and A.18."""

from __future__ import annotations

import unittest

from hmstools.backlog.source import (
    SourceError,
    parse_a18,
    parse_features,
    record_key,
    size_reading,
    split_note,
    split_row,
)
from hmstools.backlog.tests.synthetic import PLAN


class SplitRowTest(unittest.TestCase):
    def test_plain_row(self) -> None:
        self.assertEqual(split_row("| `A-01` | Title | M | R1 | B | Scope |"), ["`A-01`", "Title", "M", "R1", "B", "Scope"])

    def test_escaped_pipe_stays_inside_the_cell(self) -> None:
        self.assertEqual(split_row(r"| a \| b | c |"), ["a | b", "c"])

    def test_escaped_pipe_at_the_end_of_a_cell(self) -> None:
        self.assertEqual(split_row(r"| a \| | c |"), ["a |", "c"])

    def test_row_without_trailing_pipe(self) -> None:
        self.assertEqual(split_row("| a | b"), ["a", "b"])

    def test_empty_cells_are_kept(self) -> None:
        self.assertEqual(split_row("| a |  | c |"), ["a", "", "c"])

    def test_not_a_row(self) -> None:
        with self.assertRaises(SourceError):
            split_row("no pipes here")


class SplitNoteTest(unittest.TestCase):
    def test_scope_and_note(self) -> None:
        self.assertEqual(split_note("Bitemporal journal · *SI-01..21 kept*"), ("Bitemporal journal", "SI-01..21 kept"))

    def test_no_note(self) -> None:
        self.assertEqual(split_note("Orderables catalogue; versioned order sets"), ("Orderables catalogue; versioned order sets", None))

    def test_middle_dots_inside_the_note_are_kept(self) -> None:
        cell = "Mobile framework · *One app: nurse mode · Placed R2b: needed for BCMA*"
        self.assertEqual(split_note(cell), ("Mobile framework", "One app: nurse mode · Placed R2b: needed for BCMA"))

    def test_scope_with_colons_and_brackets(self) -> None:
        cell = "Templated result explanations only (K §11.2): AI may suggest a template · *Not in K §4.3*"
        self.assertEqual(split_note(cell)[1], "Not in K §4.3")

    def test_unclosed_italic_note_fails(self) -> None:
        with self.assertRaises(SourceError):
            split_note("Scope · *note without a closing asterisk")


class SizeReadingTest(unittest.TestCase):
    def test_codes(self) -> None:
        for code, ew in {"S": 3, "M": 8, "L": 20, "XL": 50}.items():
            reading = size_reading(code)
            self.assertEqual((reading.ew, reading.face_value, reading.plain), (ew, ew, True))

    def test_combined_code_sums(self) -> None:
        self.assertEqual(size_reading("L+M").ew, 28)
        self.assertFalse(size_reading("L+M").plain)

    def test_bp_history_does_not_change_the_count(self) -> None:
        self.assertEqual(size_reading("XL (BP L→XL)").ew, 50)
        self.assertEqual(size_reading("M (BP L; K M)").ew, 8)

    def test_minus_annotation_subtracts(self) -> None:
        reading = size_reading("M (−3)")
        self.assertEqual((reading.ew, reading.face_value), (5, 8))
        self.assertEqual(size_reading("M (-3)").ew, 5)

    def test_net_annotation_counts_the_net_addition(self) -> None:
        reading = size_reading("L (+12 net)")
        self.assertEqual((reading.ew, reading.face_value), (12, 20))

    def test_approximate_engineer_weeks(self) -> None:
        self.assertEqual(size_reading("≈3 ew").ew, 3)

    def test_unknown_sizes_fail_closed(self) -> None:
        for size in ("XXL", "M (K L)", "L (+12)", "", "3"):
            with self.subTest(size=size), self.assertRaises(SourceError):
                size_reading(size)


class ParseFeaturesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.features, self.sections = parse_features(PLAN)
        self.by_key = {f.key: f for f in self.features}

    def test_rows_and_sections(self) -> None:
        self.assertEqual(len(self.features), 16)
        self.assertEqual([s.section for s in self.sections], [f"A.{n}" for n in range(1, 9)])
        self.assertEqual(self.sections[0].name, "Platform/NFR")
        self.assertEqual(len({f.id for f in self.features if f.part is None}), 15)

    def test_escaped_pipes_in_title_and_scope(self) -> None:
        feature = self.by_key["PLT-CORE-02"]
        self.assertEqual(feature.title, "Enterprise | hierarchy")
        self.assertEqual(feature.scope, "Tenant>facility; a | b choice")

    def test_italic_note_and_placement_mark(self) -> None:
        feature = self.by_key["PLT-CORE-02"]
        self.assertEqual(feature.kurdistan_note, "Kept (K §5.1) · Placed R1: [P] pulled forward")
        self.assertTrue(feature.placement_marked)
        self.assertFalse(self.by_key["PLT-CORE-06"].placement_marked)
        self.assertIsNone(self.by_key["PLT-CORE-01"].kurdistan_note)

    def test_stance_dagger_becomes_a_flag(self) -> None:
        self.assertEqual((self.by_key["PLT-CORE-06"].stance, self.by_key["PLT-CORE-06"].domain_level), ("B", True))
        self.assertEqual((self.by_key["KRI-ID-01"].stance, self.by_key["KRI-ID-01"].domain_level), ("B+I", True))
        self.assertEqual((self.by_key["INT-ENG-01"].stance, self.by_key["INT-ENG-01"].domain_level), ("B+I", False))

    def test_part_row(self) -> None:
        key = record_key("RCM-SCH-01", "scheme")
        self.assertEqual(key, "RCM-SCH-01 · part: scheme")
        part = self.by_key[key]
        self.assertEqual((part.id, part.part, part.size, part.phase), ("RCM-SCH-01", "scheme", "≈3 ew", "P2"))

    def test_group_section_and_line(self) -> None:
        feature = self.by_key["KRI-ID-01"]
        self.assertEqual((feature.group, feature.section), ("KRI", "A.3"))
        self.assertEqual(PLAN.split("\n")[feature.row.line - 1], feature.row.text)

    def _broken(self, old: str, new: str) -> None:
        self.assertIn(old, PLAN)
        with self.assertRaises(SourceError):
            parse_features(PLAN.replace(old, new))

    def test_unknown_phase_fails(self) -> None:
        self._broken("| CMMS | M | P2 |", "| CMMS | M | P9 |")

    def test_unknown_stance_fails(self) -> None:
        self._broken("| CMMS | M | P2 | B |", "| CMMS | M | P2 | Q |")

    def test_id_outside_its_group_fails(self) -> None:
        self._broken("| `ERP-HTM-01` |", "| `OPS-HTM-01` |")

    def test_wrong_cell_count_fails(self) -> None:
        self._broken("| `ERP-HTM-01` | CMMS | M | P2 | B | Asset register |", "| `ERP-HTM-01` | CMMS | M | P2 | B |")

    def test_id_cell_without_code_span_fails(self) -> None:
        self._broken("| `ERP-HTM-01` |", "| ERP-HTM-01 |")


class LineEndingTest(unittest.TestCase):
    def test_crlf_text_parses_the_same(self) -> None:
        from hmstools.backlog.plan import build_records, parse_plan

        lf, crlf = parse_plan(PLAN), parse_plan(PLAN.replace("\n", "\r\n"))
        self.assertEqual(build_records(lf), build_records(crlf))
        self.assertEqual([f.row for f in lf.features], [f.row for f in crlf.features])
        self.assertEqual(lf.references, crlf.references)


class ParseA18Test(unittest.TestCase):
    def test_totals_and_note(self) -> None:
        a18 = parse_a18(PLAN)
        self.assertEqual(a18.phases["R1"], (7, 143))
        self.assertEqual(a18.phases["P2"], (6, 99))
        self.assertEqual(a18.mvp_label, "MVP (R1 to R2.1)")
        self.assertEqual(a18.mvp_phases, ("R1", "R1.1", "R2a", "R2b", "R2.1"))
        self.assertEqual((a18.mvp, a18.all), ((8, 151), (15, 300)))
        self.assertEqual(a18.ai_gateway_ew, (20, 40))
        self.assertTrue(PLAN.split("\n")[a18.note_line - 1].startswith("These per-feature sums"))

    def test_missing_phase_row_fails(self) -> None:
        with self.assertRaises(SourceError):
            parse_a18(PLAN.replace("| P3 | 0 | 0 |\n", ""))


if __name__ == "__main__":
    unittest.main()
