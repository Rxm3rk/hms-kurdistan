"""The plan-of-record parser reads the BUILD-PROMPT.md sections the safety check relies on."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from hmstools.safety.plan import PlanParseError, parse_plan
from hmstools.safety.tests.harness import REPO


class ParsePlanTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.plan = parse_plan(REPO / "BUILD-PROMPT.md")

    def test_all_21_invariants_with_enforcement_and_hazard_mapping(self) -> None:
        self.assertEqual(sorted(self.plan.si_text), [f"SI-{n:02d}" for n in range(1, 22)])
        self.assertTrue(self.plan.si_text["SI-09"].startswith("Medication reconciliation cannot complete"))
        self.assertEqual(self.plan.si_enforced_in["SI-02"], "MAR aggregate")
        self.assertEqual(self.plan.si_seeded["SI-12"], ["H4", "H2"])
        self.assertEqual(self.plan.si_seeded["SI-15"], ["H2", "H6"])
        self.assertEqual(self.plan.si_seeded["SI-18"], [])

    def test_seeded_hazards_h1_to_h15(self) -> None:
        self.assertEqual(len(self.plan.seeded_hazards), 15)
        self.assertEqual(self.plan.seeded_hazards["H1"], "wrong patient")
        self.assertTrue(self.plan.seeded_hazards["H15"].endswith("across our system and a legacy one)"))

    def test_sac_mapping(self) -> None:
        self.assertEqual(len(self.plan.sac_to_si), 53)
        self.assertEqual(self.plan.sac_to_si["SAC-11"], ["SI-05", "SI-16"])
        self.assertEqual(self.plan.sac_to_si["SAC-03"], [])

    def test_modules_and_features(self) -> None:
        for module in ("medications", "reg-dose", "ed", "maternity", "safety-registry", "platform-tasks"):
            self.assertIn(module, self.plan.modules)
        self.assertGreaterEqual(len(self.plan.appendix_a_features), 234)
        self.assertIn("MED-DOSE-01", self.plan.appendix_a_features)
        self.assertIn("AI-DAT-02a", self.plan.appendix_a_features)

    def test_truncated_plan_is_a_parse_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "BUILD-PROMPT.md"
            path.write_text("# plan\n\n### 2.1 The 21 safety invariants\n\n| 01 | text | x | H1 |\n", encoding="utf-8")
            with self.assertRaises(PlanParseError):
                parse_plan(path)


if __name__ == "__main__":
    unittest.main()
