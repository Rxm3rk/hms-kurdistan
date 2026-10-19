"""§21 parsing: which work packages name which features, with their qualifiers."""

from __future__ import annotations

import unittest

from hmstools.backlog.plan import map_references, parse_plan
from hmstools.backlog.tests.synthetic import PLAN
from hmstools.backlog.workpackages import item_references, items, parse_section_21, sentences, text_references


class HelpersTest(unittest.TestCase):
    def test_items_split_on_semicolons_when_present(self) -> None:
        self.assertEqual(items("a, b; c (d; e), f"), ["a, b", " c (d; e), f"])

    def test_items_split_on_commas_outside_brackets(self) -> None:
        self.assertEqual(items("a (b, c), d"), ["a (b, c)", " d"])

    def test_sentences_end_at_full_stops_before_capitals(self) -> None:
        self.assertEqual(sentences("One (x. Y) here. Two 1.5 s. three"), ["One (x. Y) here", "Two 1.5 s. three"])

    def test_chained_ids_share_the_tail(self) -> None:
        self.assertEqual(
            item_references("`DEV-GW-01` and `DEV-VAL-01` the validated ICU monitor feed"),
            [("DEV-GW-01", "the validated ICU monitor feed"), ("DEV-VAL-01", "the validated ICU monitor feed")],
        )

    def test_bracket_qualifier_before_a_colon(self) -> None:
        self.assertEqual(item_references("`INT-ENG-01` (base): MLLP over TLS"), [("INT-ENG-01", "base")])

    def test_bracket_followed_by_more_words_is_kept_whole(self) -> None:
        self.assertEqual(
            item_references("`CLN-CDS-05` (`reg-ews`) and its fallback"),
            [("CLN-CDS-05", "(`reg-ews`) and its fallback")],
        )

    def test_lowercase_code_spans_are_not_features(self) -> None:
        self.assertEqual(text_references("the `reg-screening` sidecar, `tools/doctor`, `TaskOrphaned`"), [])

    def test_label_prefix_is_removed(self) -> None:
        self.assertEqual(text_references("Then the rest of P2: `PLT-CFG-04`, `TRU-AUD-02`."), [("PLT-CFG-04", ""), ("TRU-AUD-02", "")])


class SectionTwentyOneTest(unittest.TestCase):
    def setUp(self) -> None:
        self.refs = parse_section_21(PLAN)
        self.plan = parse_plan(PLAN)
        self.mapping = map_references(self.plan)

    def labels(self, target: str) -> list[str]:
        return [r.label for r in self.refs if r.target == target]

    def test_phase_0_reads_the_wp_column(self) -> None:
        self.assertEqual(self.labels("PLT-CORE-01"), ["WP-0.3"])
        self.assertEqual(self.labels("PLT-UX-03"), ["WP-0.3 (base)"])

    def test_exit_evidence_and_intro_paragraphs_are_not_read(self) -> None:
        self.assertEqual([r for r in self.refs if r.wp == "WP-0.1"], [])
        self.assertEqual(self.labels("RCM-US-01"), [])

    def test_table_qualifiers(self) -> None:
        self.assertEqual(self.labels("PLT-CORE-02"), ["WP-0.3", "WP-1.1 (full)"])
        self.assertEqual(self.labels("PLT-CORE-06"), ["WP-1.1 (non-device rules)"])
        self.assertEqual(self.labels("CLN-CDS-05"), ["WP-2.5 (`reg-ews`) and its fallback"])

    def test_wp_ids_with_letters(self) -> None:
        self.assertEqual(self.labels("INT-ENG-01")[0], "WP-1.1b (base)")

    def test_wildcard(self) -> None:
        wildcards = [r for r in self.refs if r.is_wildcard]
        self.assertEqual([(r.wp, r.target, r.qualifier) for r in wildcards], [("WP-2.2", "RCM-*", "inpatient scope (§9.20–§9.21)")])
        self.assertEqual(self.mapping.wildcards, wildcards)

    def test_paragraph_phases(self) -> None:
        self.assertEqual(self.labels("MED-DOSE-01"), ["Phase 5 (the Dose Engine first; shadow mode, C2 activation)"])
        self.assertEqual(self.labels("ERP-FIN-02"), ["Phase 5 (lite GL)"])
        self.assertEqual(self.labels("ERP-HTM-01"), ["Phase 5 (CMMS)"])
        self.assertEqual(self.labels("PLT-CFG-04"), ["Phase 5"])
        self.assertEqual(self.labels("AI-GOV-01"), ["Phase 5 (the AI platform; none before G3)"])
        self.assertEqual(
            self.labels("INT-ENG-01")[1], "Phase 1.1 (LIS rules in `reg-lis-rules`, activated only where allowed)"
        )

    def test_mapping_gives_every_wp_in_order(self) -> None:
        derived = self.mapping.derived
        self.assertEqual(derived["PLT-CORE-02"], ["WP-0.3", "WP-1.1 (full)"])
        self.assertEqual(derived["RCM-SCH-01"], ["WP-1.9", "Phase 1.1 (document-pack automation)"])
        self.assertEqual(derived["RCM-US-01"], [])

    def test_a_qualifier_naming_a_part_goes_to_the_part_row(self) -> None:
        self.assertEqual(self.mapping.derived["RCM-SCH-01 · part: scheme"], ["Phase 5 (the scheme part)"])

    def test_unknown_feature_id_is_reported(self) -> None:
        plan = parse_plan(PLAN.replace("`PLT-CORE-06` (non-device rules)", "`PLT-CORE-99` (non-device rules)"))
        self.assertEqual([r.target for r in map_references(plan).unknown], ["PLT-CORE-99"])


if __name__ == "__main__":
    unittest.main()
