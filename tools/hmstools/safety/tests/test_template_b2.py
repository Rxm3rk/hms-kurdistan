"""Appendix B.2 against the hazard-log schema (docs/safety/README.md, "The hazard log").

The schema is stricter than the B.2 example in exactly four required fields. These tests read the example
from the plan of record, show that it fails on those four fields and nothing else, and that with them added
it passes the whole check; then they remove each field from a real entry, or fill it with whitespace.
"""

from __future__ import annotations

import copy
import unittest
from typing import Any

import yaml

from hmstools.safety.tests.harness import REPO, SandboxCase, control, hazard, real_log

# (where inside the entry, property): the fields the schema requires beyond the B.2 example.
MANDATORY_BEYOND_B2 = [
    ("", "description"),
    ("/initial_risk", "basis"),
    ("/controls/0", "planned_verification"),
    ("/controls/0", "risk_control_option"),
]


def b2_example() -> dict[str, Any]:
    """The YAML block under "### B.2" in BUILD-PROMPT.md: one hazard-log entry (the file has CRLF lines)."""
    lines = (REPO / "BUILD-PROMPT.md").read_text(encoding="utf-8").splitlines()
    start = fence = end = None
    for index, line in enumerate(lines):
        if start is None:
            if line.startswith("### B.2 "):
                start = index
        elif fence is None:
            if line.strip() == "```yaml":
                fence = index
        elif line.strip() == "```":
            end = index
            break
    if end is None:
        raise AssertionError("BUILD-PROMPT.md Appendix B.2: the YAML block was not found")
    entries = yaml.safe_load("\n".join(lines[fence + 1 : end]))
    if not (isinstance(entries, list) and len(entries) == 1 and isinstance(entries[0], dict)):
        raise AssertionError("BUILD-PROMPT.md Appendix B.2 no longer holds one YAML list entry")
    return entries[0]


def completed(entry: dict[str, Any]) -> dict[str, Any]:
    """The B.2 example with the four fields the schema adds, filled the way the seeded entries fill them."""
    entry = copy.deepcopy(entry)
    entry["description"] = "Test fixture: the Appendix B.2 example with the fields the schema requires beyond it."
    entry["initial_risk"]["basis"] = "Test fixture, not an agent proposal and not an acceptance."
    for item in entry["controls"]:
        item["risk_control_option"] = "design"
        item["planned_verification"] = ["PropertyTest:OfflineBcmaRevalidation"]
    return entry


class AppendixB2Test(SandboxCase):
    def test_example_is_read_from_the_plan(self) -> None:
        entry = b2_example()
        self.assertEqual(entry["id"], "HAZ-0042")
        self.assertEqual([item["id"] for item in entry["controls"]], ["CTRL-0042-1"])
        self.assertEqual(entry["controls"][0]["type"], "design")
        # If B.2 ever carries one of these, docs/safety/README.md and MANDATORY_BEYOND_B2 change with it.
        self.assertNotIn("description", entry)
        self.assertNotIn("basis", entry["initial_risk"])
        self.assertNotIn("planned_verification", entry["controls"][0])
        self.assertNotIn("risk_control_option", entry["controls"][0])

    def test_example_as_written_fails_on_exactly_the_four_added_fields(self) -> None:
        index = len(real_log()["hazards"])
        result = self.run_with(lambda d: d["hazards"].append(b2_example()))
        self.assertFalse(result.ok)
        prefix = f"docs/safety/hazard-log.yaml: schema: hazards/{index}"
        expected = sorted(f"{prefix}{where}: '{name}' is a required property" for where, name in MANDATORY_BEYOND_B2)
        self.assertEqual(sorted(result.errors), expected)

    def test_example_with_the_four_fields_passes_the_whole_check(self) -> None:
        result = self.run_with(lambda d: d["hazards"].append(completed(b2_example())))
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertEqual(result.counts["hazards"], len(real_log()["hazards"]) + 1)


class MandatoryFieldsTest(SandboxCase):
    def test_hazard_description_is_required(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002").pop("description"))
        self.assertFailsWith(result, "schema: hazards/1: 'description' is a required property")

    def test_initial_risk_basis_is_required(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002")["initial_risk"].pop("basis"))
        self.assertFailsWith(result, "schema: hazards/1/initial_risk: 'basis' is a required property")

    def test_proposed_residual_risk_needs_a_basis(self) -> None:
        def change(d: dict[str, Any]) -> None:
            hazard(d, "HAZ-0002")["residual_risk"]["proposed"] = {
                "severity": "catastrophic", "likelihood": "remote", "level": "high"
            }

        # proposed is null or a risk (oneOf), so the schema reports that it matches neither.
        self.assertFailsWith(
            self.run_with(change), "schema: hazards/1/residual_risk/proposed:", "is not valid under any of the given schemas"
        )

        def with_basis(d: dict[str, Any]) -> None:
            change(d)
            hazard(d, "HAZ-0002")["residual_risk"]["proposed"]["basis"] = "Test fixture."

        self.box.reset()
        result = self.run_with(with_basis)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_risk_control_option_is_required(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3").pop("risk_control_option"))
        self.assertFailsWith(result, "schema: hazards/1/controls/2: 'risk_control_option' is a required property")

    def test_risk_control_option_takes_only_the_section_10_1_options(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3").update(risk_control_option="test"))
        self.assertFailsWith(result, "schema: hazards/1/controls/2/risk_control_option: 'test' is not one of")

    def test_planned_verification_is_required(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3").pop("planned_verification"))
        self.assertFailsWith(result, "schema: hazards/1/controls/2: 'planned_verification' is a required property")

    def test_planned_verification_cannot_be_empty(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3").update(planned_verification=[]))
        self.assertFailsWith(result, "schema: hazards/1/controls/2/planned_verification:")

    def test_a_mandatory_text_field_cannot_be_blank(self) -> None:
        # $defs/text needs one non-whitespace character, so whitespace does not fill a required field.
        cases = {
            "hazards/1/description": lambda d: hazard(d, "HAZ-0002").update(description="   "),
            "hazards/1/initial_risk/basis": lambda d: hazard(d, "HAZ-0002")["initial_risk"].update(basis="\n\t "),
            "hazards/1/controls/2/description": lambda d: control(d, "CTRL-0002-3").update(description=" "),
            "hazards/1/controls/2/planned_verification/0": lambda d: control(d, "CTRL-0002-3").update(
                planned_verification=["  "]
            ),
        }
        for where, change in cases.items():
            with self.subTest(where=where):
                self.box.reset()
                self.assertFailsWith(self.run_with(change), f"schema: {where}:", "does not match")

    def test_text_with_surrounding_whitespace_still_passes(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002").update(description=" A real description. "))
        self.assertTrue(result.ok, "\n".join(result.errors))


if __name__ == "__main__":
    unittest.main()
