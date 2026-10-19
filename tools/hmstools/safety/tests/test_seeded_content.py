"""Guards on the seeded hazard-log content that review findings R-04 and R-19 of WP-0.1 corrected
(docs/program/reviews/WP-0.1.md). They read the real hazard log, docs/safety/README.md and BUILD-PROMPT.md,
so an edit that brings back a narrowing, an overclaim, a missing §18.3 count or an unrecorded tightening
fails here.
"""

from __future__ import annotations

import re
import unittest
from typing import Any

from hmstools.safety.plan import parse_plan
from hmstools.safety.tests.harness import REAL_SAFETY, REPO, control, hazard, real_log

TIGHTENING_NOTE = "tightening [p] (§3.4 item 1)"
# The one tightening the plan itself adds (§13.1 AZ-3); its control records it in its description.
PLAN_TIGHTENING = "CTRL-0021-5"


def text(item: dict[str, Any], key: str = "description") -> str:
    """A folded YAML scalar with its whitespace normalised."""
    return " ".join(str(item.get(key, "")).split())


def readme_section(readme: str, heading: str) -> str:
    """The body of one "## " or "### " section of docs/safety/README.md, up to the next heading."""
    match = re.search(rf"^#{{2,3}} {re.escape(heading)}\n(.*?)(?=^#{{2,3}} |\Z)", readme, re.M | re.S)
    if match is None:
        raise AssertionError(f'docs/safety/README.md has no section "{heading}"')
    return match.group(1)


class SeededContentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.log = real_log()
        cls.plan = parse_plan(REPO / "BUILD-PROMPT.md")
        cls.readme = (REAL_SAFETY / "README.md").read_text(encoding="utf-8")

    def test_si14_registry_gate_keeps_all_four_requirements(self) -> None:
        clause_b = next(c["text"] for c in hazard(self.log, "HAZ-0014")["invariant_clauses"] if c["id"] == "b")
        self.assertIn(clause_b, self.plan.si_text["SI-14"])
        self.assertIn("a measured PPV", clause_b)
        gate = control(self.log, "CTRL-0014-4")
        self.assertIn("b", gate["covers"])
        self.assertIn(f'"{clause_b}"', text(gate), "the gate quotes SI-14 clause b verbatim")
        self.assertIn("a rule without a measured PPV is not interruptive", text(gate))
        self.assertIn("DN-014", text(gate))

    def test_si14_day0_baseline_needs_a_measured_ppv_or_a_human_approved_exception(self) -> None:
        baseline = control(self.log, "CTRL-0014-5")
        self.assertIn("c", baseline["covers"])
        self.assertIn("human-approved exception (DN-014)", text(baseline))
        self.assertIn("Promotion of a go-live bundle is blocked", text(baseline))

    def test_every_entry_has_a_nightly_property_control_with_both_section_18_3_counts(self) -> None:
        # §18.3: 10⁶ sequences at the application-command layer plus at least 10⁴ through each real channel adapter.
        with_count = set()
        for entry in self.log["hazards"]:
            for item in entry["controls"]:
                if "10⁶" in text(item):
                    self.assertIn("at least 10⁴", text(item), f"{item['id']} omits the §18.3 per-adapter count")
                    with_count.add(entry["id"])
        self.assertEqual(with_count, {entry["id"] for entry in self.log["hazards"]})

    def test_a_cited_section_18_5_suite_is_not_called_missing(self) -> None:
        for entry in self.log["hazards"]:
            for item in entry["controls"]:
                if any(source.startswith("§18.5 #") for source in item.get("sources", [])):
                    self.assertNotIn("names none", text(item), f"{item['id']} cites a §18.5 suite and says there is none")

    def test_dose_check_overclaim_stays_corrected(self) -> None:
        hard_stop = text(control(self.log, "CTRL-0005-7"))
        self.assertNotIn("also stops any 100", hard_stop)
        self.assertNotIn("the hard stop for a 10× or 100× deviation is the KB", hard_stop)
        self.assertIn('"dose check unavailable"', hard_stop)

    def test_dose_check_gap_before_the_dose_engine_is_stated_and_left_to_the_cso(self) -> None:
        # §2.1 SI-05 and §10.3 A.2: the fallback rule fires on a KB result ≥10× the *maximum* dose, so it
        # cannot stop every tenfold error, nor an underdose; the log says so and does not count them as covered.
        item = control(self.log, "CTRL-0005-7")
        self.assertIn("d", item["covers"])
        self.assertIn("does not stop every 10× or 100× deviation", text(item))
        self.assertIn("the dose is at least 10× the KB maximum dose", text(item))
        self.assertIn("tenfold or hundredfold underdose", text(item))
        self.assertTrue(text(item, "notes").startswith("Remaining gap of control set A, open for the CSO [HUMAN]"))
        self.assertIn("does not count clause d as covered", text(item, "notes"))
        self.assertIn("open question 9", text(item, "notes"))
        self.assertIn("open question 9", text(control(self.log, "CTRL-0005-16")))
        self.assertRegex(self.readme, r"\n9\. \*\*SI-05 clause d before the Dose Engine\*\*")
        # The same gap is kept open in the programme's open questions (OQ-120).
        self.assertIn("OPEN-QUESTIONS.md, OQ-120", text(item, "notes"))
        self.assertIn("OPEN-QUESTIONS.md, OQ-120", text(control(self.log, "CTRL-0005-16")))
        self.assertIn("OQ-120", readme_section(self.readme, "Open questions for CSO triage [HUMAN]"))
        questions = (REPO / "docs" / "program" / "OPEN-QUESTIONS.md").read_text(encoding="utf-8")
        self.assertIn("\n### OQ-120: SI-05 clause d before the Dose Engine\n", questions)

    def test_every_open_question_the_log_cites_exists(self) -> None:
        questions = readme_section(self.readme, "Open questions for CSO triage [HUMAN]")
        cited = {
            (item["id"], number)
            for entry in self.log["hazards"]
            for item in entry["controls"]
            for key in ("description", "notes")
            for number in re.findall(r"open question (\d+)", text(item, key))
        }
        self.assertTrue(cited)
        for control_id, number in sorted(cited):
            message = f"{control_id} cites a missing open question {number}"
            self.assertRegex(questions, rf"(?m)^{number}\. \*\*", message)

    def test_transfusion_fallback_makes_no_automated_comparison(self) -> None:
        witness = text(control(self.log, "CTRL-0011-9"))
        self.assertIn("With T2 active", witness)
        self.assertIn("compares nothing and gives no automated pass/fail", witness)

    def test_unsourced_mechanisms_are_recorded_as_tightenings(self) -> None:
        for control_id in ("CTRL-0001-5", "CTRL-0001-6", "CTRL-0014-5", "CTRL-0016-5", "CTRL-0016-6"):
            self.assertTrue(text(control(self.log, control_id), "notes").startswith("Tightening [P] (§3.4 item 1)"), control_id)
        self.assertIn("recorded as a tightening [P] (§3.4 item 1)", text(control(self.log, "CTRL-0014-4"), "notes"))
        # The human-approved exception for a day-0 baseline rule is DN-014's option 1, the CSO's reading of clause b
        # against clause c, not a tightening of this build (review of the R-04 fix).
        self.assertIn("The exception path is not part of the tightening", text(control(self.log, "CTRL-0014-4"), "notes"))
        self.assertIn("is not part of this tightening: it is DN-014's option 1", readme_section(self.readme, "Tightenings"))

    def test_readme_tightenings_table_lists_exactly_the_recorded_tightenings(self) -> None:
        section = readme_section(self.readme, "Tightenings")
        rows = dict(re.findall(r"(?m)^\| (CTRL-\d{4}-\d+) \|(.*)$", section))
        recorded = {
            item["id"]
            for entry in self.log["hazards"]
            for item in entry["controls"]
            if TIGHTENING_NOTE in text(item, "notes").lower()
        }
        self.assertEqual(set(rows), recorded | {PLAN_TIGHTENING})
        self.assertIn("as a tightening", text(control(self.log, PLAN_TIGHTENING)))
        # Only the AZ-3 row comes from the plan; the section must not call every row a proposal of this build.
        self.assertIn("not a proposal of this build", rows[PLAN_TIGHTENING])
        self.assertIn("§13.1 AZ-3", rows[PLAN_TIGHTENING])
        self.assertNotIn("Each one below is a proposal of this build", section)
        for control_id in recorded:
            self.assertNotIn("not a proposal of this build", rows[control_id], control_id)


if __name__ == "__main__":
    unittest.main()
