"""Hazard-log rules of `tools/hms safety check`, each exercised by one adversarial change to the real log."""

from __future__ import annotations

import unittest
from typing import Any, Callable

from hmstools.common import CheckResult
from hmstools.safety.check import EnvironmentProblem, SafetyPaths, run_check
from hmstools.safety.plan import parse_plan
from hmstools.safety.tests.harness import REPO, Sandbox, SandboxCase, control, hazard


class RealFilesTest(unittest.TestCase):
    def test_real_repository_passes(self) -> None:
        result = run_check(SafetyPaths.for_root(REPO))
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertEqual(result.counts["seeded_hazards"], 15)
        self.assertEqual(result.counts["sis_covered"], 21)
        self.assertEqual(result.counts["hazards"], 29)  # 27 seeded in WP-0.1; HAZ-0028 and HAZ-0029 from WP-0.2
        self.assertEqual(result.counts["sensitivity_label_entries"], 6)
        self.assertEqual(result.counts["controls"], result.counts["controls_planned"])
        self.assertEqual(result.counts["controls_verified"], 0)
        self.assertEqual(result.counts["approval_fields_filled"], 0)

    def test_sandbox_copy_of_the_real_log_passes(self) -> None:
        box = Sandbox()
        self.addCleanup(box.close)
        result = box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))
        box.mutate(lambda d: None)  # the YAML round trip that every mutation test relies on
        result = box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))


class SchemaTest(SandboxCase):
    def test_unknown_control_type(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3").update(type="magic"))
        self.assertFailsWith(result, "schema:", "'magic' is not one of")

    def test_unknown_control_state(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3").update(state="done"))
        self.assertFailsWith(result, "schema:", "'done' is not one of")

    def test_malformed_hazard_id(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002").update(id="HAZ-2"))
        self.assertFailsWith(result, "schema:", "'HAZ-2' does not match")

    def test_unknown_status(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002").update(status="closed"))
        self.assertFailsWith(result, "schema:", "'closed' is not one of")

    def test_unknown_sac(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002")["sac"].append("SAC-54"))
        self.assertFailsWith(result, "schema:", "'SAC-54' does not match")

    def test_unknown_field_rejected(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002").update(approved=True))
        self.assertFailsWith(result, "schema:", "Additional properties are not allowed")

    def test_semantic_checks_skipped_when_schema_fails(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002").update(status="closed"))
        self.assertIn("semantic checks skipped", "\n".join(result.warnings))

    def test_verified_by_needs_kind_prefix(self) -> None:
        def change(d: dict[str, Any]) -> None:
            control(d, "CTRL-0002-3").update(state="verified", implemented_in=["x"], verified_by=["some test"])

        self.assertFailsWith(self.run_with(change), "schema:", "verified_by")


class IdentifierTest(SandboxCase):
    def test_duplicate_hazard_id(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0027").update(id="HAZ-0026"))
        self.assertFailsWith(result, "hazard id HAZ-0026 is used more than once")

    def test_duplicate_control_id(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-4").update(id="CTRL-0002-3"))
        self.assertFailsWith(result, "control id CTRL-0002-3 is used more than once")

    def test_control_number_must_match_its_hazard(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-7").update(id="CTRL-0003-99"))
        self.assertFailsWith(result, "control CTRL-0003-99 belongs to HAZ-0002")

    def test_missing_seeded_hazard(self) -> None:
        result = self.run_with(lambda d: d.update(seeded_hazards=[h for h in d["seeded_hazards"] if h["id"] != "H7"]))
        self.assertFailsWith(result, "seeded hazards missing: H7")

    def test_duplicate_seeded_hazard(self) -> None:
        result = self.run_with(lambda d: d["seeded_hazards"].append(dict(d["seeded_hazards"][0])))
        self.assertFailsWith(result, "seeded hazard H1 is defined more than once")

    def test_seeded_hazard_wording_must_match_plan(self) -> None:
        result = self.run_with(lambda d: d["seeded_hazards"][1].update(description="wrong drug"))
        self.assertFailsWith(result, "seeded hazard H2 description", "§2.4")

    def test_unknown_seeded_hazard_reference(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0022").update(seeded_hazard="H99"))
        self.assertFailsWith(result, "HAZ-0022 refers to seeded hazard H99")


class InvariantCoverageTest(SandboxCase):
    def test_missing_si(self) -> None:
        result = self.run_with(lambda d: d.update(hazards=[h for h in d["hazards"] if h["id"] != "HAZ-0007"]))
        self.assertFailsWith(result, "SI-07 is not covered by any hazard entry", "no hazard entry quotes SI-07")

    def test_si_listed_but_not_quoted(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0009")
            del entry["invariant_text"], entry["invariant_clauses"]
            for item in entry["controls"]:
                item["covers"] = ["preamble"]

        self.assertFailsWith(self.run_with(change), "no hazard entry quotes SI-09")

    def test_si_quoted_twice(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0022")
            source = hazard(d, "HAZ-0021")
            entry.update(invariant_text=source["invariant_text"], invariant_clauses=source["invariant_clauses"])
            entry["controls"][0]["covers"] = ["a", "b", "c", "d", "preamble"]

        self.assertFailsWith(self.run_with(change), "SI-21 is quoted by more than one entry")

    def test_weakened_invariant_text(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0002")
            entry["invariant_text"] = entry["invariant_text"].replace("never defaulted", "rarely defaulted")
            entry["invariant_clauses"][1]["text"] = "Override reasons are rarely defaulted,"

        self.assertFailsWith(self.run_with(change), "HAZ-0002 invariant_text is not the verbatim SI-02 text")

    def test_dropped_clause(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0002")
            entry["invariant_clauses"] = entry["invariant_clauses"][:2]
            for item in entry["controls"]:
                item["covers"] = [c for c in item["covers"] if c != "c"] or ["a"]

        self.assertFailsWith(self.run_with(change), "HAZ-0002 invariant_clauses do not rebuild invariant_text")

    def test_clause_without_control(self) -> None:
        def change(d: dict[str, Any]) -> None:
            for item in hazard(d, "HAZ-0002")["controls"]:
                item["covers"] = [c for c in item["covers"] if c != "b"] or ["a"]

        self.assertFailsWith(self.run_with(change), "HAZ-0002 (SI-02) clauses not covered by any control: b")

    def test_covers_unknown_clause(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3")["covers"].append("z"))
        self.assertFailsWith(result, "CTRL-0002-3 covers unknown clause 'z'")

    def test_preamble_control_required(self) -> None:
        def change(d: dict[str, Any]) -> None:
            for item in hazard(d, "HAZ-0013")["controls"]:
                item["covers"] = [c for c in item["covers"] if c != "preamble"] or ["a"]

        self.assertFailsWith(self.run_with(change), "HAZ-0013 (SI-13) has no control covering the §2.1 preamble")

    def test_enforced_in_must_match_plan(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002").update(enforced_in="UI"))
        self.assertFailsWith(result, "HAZ-0002 enforced_in 'UI' differs from BUILD-PROMPT §2.1")

    def test_seeded_mapping_must_match_plan(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0012").update(seeded_hazard="H4"))
        self.assertFailsWith(result, "HAZ-0012 seeded_hazard ['H4'] differs from the §2.1 mapping for SI-12: H2, H4")

    def test_si18_keeps_no_seeded_hazard(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0018").update(seeded_hazard="H2"))
        self.assertFailsWith(result, "differs from the §2.1 mapping for SI-18: none")

    def test_null_seeded_hazard_needs_a_note(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0018").pop("seeded_hazard_note"))
        self.assertFailsWith(result, "schema:", "'seeded_hazard_note' is a required property")

    def test_sac_mapped_to_the_si_must_be_listed(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002")["sac"].remove("SAC-21"))
        self.assertFailsWith(result, "HAZ-0002 (SI-02) does not list SAC-21")

    def test_quoting_entry_lists_exactly_one_invariant(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002")["invariants"].append("SI-13"))
        self.assertFailsWith(result, "HAZ-0002 quotes an invariant but lists 2 invariants")

    def test_each_si21_label_has_its_own_entry(self) -> None:
        result = self.run_with(lambda d: d.update(hazards=[h for h in d["hazards"] if h["id"] != "HAZ-0025"]))
        self.assertFailsWith(result, "SI-21 label 'gender-based-violence' has no hazard entry of its own")

    def test_sensitivity_label_needs_si21(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0022").update(invariants=["SI-20"]))
        self.assertFailsWith(result, "HAZ-0022 has a sensitivity_label but does not list SI-21")


class ReferenceTest(SandboxCase):
    def test_unknown_feature_id_with_appendix_a_fallback(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002")["features"].append("XYZ-NOPE-01"))
        self.assertFailsWith(result, "HAZ-0002 lists unknown feature ID XYZ-NOPE-01")
        self.assertEqual(result.counts["feature_source_backlog_yaml"], 0)
        self.assertIn("Appendix A", "\n".join(result.warnings))

    def test_backlog_yaml_is_the_source_when_present(self) -> None:
        self.box.copy_fixture("backlog/backlog.yaml", self.box.root / "docs" / "program")
        result = self.box.run()
        self.assertEqual(result.counts["feature_source_backlog_yaml"], 1)
        self.assertEqual(result.counts["feature_ids_known"], 3)
        self.assertFailsWith(result, "lists unknown feature ID MED-DOSE-01")
        self.assertNotIn("Appendix A", "\n".join(result.warnings))

    def test_complete_backlog_yaml_passes(self) -> None:
        plan = parse_plan(REPO / "BUILD-PROMPT.md")
        self.box.write_backlog({"features": [{"id": f} for f in sorted(plan.appendix_a_features)]})
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertEqual(result.counts["feature_source_backlog_yaml"], 1)

    def test_backlog_without_ids_fails(self) -> None:
        self.box.write_backlog({"features": []})
        self.assertFailsWith(self.box.run(), "backlog.yaml: no feature ids found")

    def test_owner_must_be_a_module_squad(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002").update(owner="nurses-squad"))
        self.assertFailsWith(result, "HAZ-0002 owner 'nurses-squad' is not '<module>-squad'")

    def test_module_must_be_in_the_module_map(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002")["modules"].append("pharmacy"))
        self.assertFailsWith(result, "HAZ-0002 lists module 'pharmacy'")


class StateTest(SandboxCase):
    def test_implemented_needs_implemented_in(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3").update(state="implemented"))
        self.assertFailsWith(result, "CTRL-0002-3 is 'implemented' but implemented_in is empty")

    def test_verified_with_empty_verified_by(self) -> None:
        def change(d: dict[str, Any]) -> None:
            control(d, "CTRL-0002-3").update(state="verified", implemented_in=["backend/modules/medications"])

        self.assertFailsWith(self.run_with(change), "CTRL-0002-3 is 'verified' but verified_by is empty")

    def test_verified_with_empty_implemented_in(self) -> None:
        def change(d: dict[str, Any]) -> None:
            control(d, "CTRL-0002-3").update(state="verified", verified_by=["PropertyTest:SI-02-x"])

        self.assertFailsWith(self.run_with(change), "CTRL-0002-3 is 'verified' but implemented_in is empty")

    def test_complete_verified_control_passes(self) -> None:
        def change(d: dict[str, Any]) -> None:
            control(d, "CTRL-0002-3").update(
                state="verified", implemented_in=["backend/modules/medications"], verified_by=["PropertyTest:SI-02-x"]
            )

        result = self.run_with(change)
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertEqual(result.counts["controls_verified"], 1)

    def test_planned_control_with_evidence_warns(self) -> None:
        result = self.run_with(lambda d: control(d, "CTRL-0002-3").update(implemented_in=["backend/x"]))
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertIn("CTRL-0002-3 is 'planned' but lists implemented_in", "\n".join(result.warnings))

    def test_status_controls_implemented_needs_every_control_implemented(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0009")
            entry["status"] = "controls-implemented"
            for item in entry["controls"][1:]:
                item.update(state="implemented", implemented_in=["backend/x"])

        self.assertFailsWith(self.run_with(change), "HAZ-0009 has status 'controls-implemented' but not every control")

    def test_status_controls_verified_needs_every_control_verified(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0009")
            entry["status"] = "controls-verified"
            for item in entry["controls"]:
                item.update(state="implemented", implemented_in=["backend/x"])

        self.assertFailsWith(self.run_with(change), "HAZ-0009 has status 'controls-verified' but not every control")

    def test_fully_implemented_hazard_status_passes(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0009")
            entry["status"] = "controls-implemented"
            for item in entry["controls"]:
                item.update(state="implemented", implemented_in=["backend/x"])

        result = self.run_with(change)
        self.assertTrue(result.ok, "\n".join(result.errors))


class RiskTest(SandboxCase):
    def test_initial_risk_level_must_match_matrix(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0002")["initial_risk"].update(level="low"))
        self.assertFailsWith(result, "HAZ-0002 initial_risk: level 'low' disagrees with the risk matrix")

    def test_proposed_residual_risk_level_must_match_matrix(self) -> None:
        def change(d: dict[str, Any]) -> None:
            hazard(d, "HAZ-0002")["residual_risk"]["proposed"] = {
                "severity": "catastrophic", "likelihood": "remote", "level": "low", "basis": "test"
            }

        self.assertFailsWith(self.run_with(change), "HAZ-0002 residual_risk.proposed: level 'low' disagrees")

    def test_vocabulary_must_equal_schema_enumeration(self) -> None:
        result = self.run_with(lambda d: d["risk_vocabulary"]["severity"].reverse())
        self.assertFailsWith(result, "risk_vocabulary.severity", "differs from the schema enumeration")


class FileTest(SandboxCase):
    def test_duplicate_yaml_key_rejected(self) -> None:
        self.box.copy_fixture("yaml/duplicate-key.yaml", self.box.safety, "hazard-log.yaml")
        self.assertFailsWith(self.box.run(), "does not parse as YAML", "duplicate key 'schema_version'")

    def test_malformed_yaml(self) -> None:
        self.box.copy_fixture("yaml/malformed.yaml", self.box.safety, "hazard-log.yaml")
        self.assertFailsWith(self.box.run(), "does not parse as YAML")

    def test_missing_hazard_log(self) -> None:
        (self.box.safety / "hazard-log.yaml").unlink()
        self.assertFailsWith(self.box.run(), "hazard-log.yaml: missing")

    def test_missing_schema(self) -> None:
        (self.box.safety / "hazard-log.schema.json").unlink()
        self.assertFailsWith(self.box.run(), "hazard-log.schema.json: missing")

    def test_schema_that_is_not_json(self) -> None:
        (self.box.safety / "hazard-log.schema.json").write_text("{not json", encoding="utf-8")
        self.assertFailsWith(self.box.run(), "hazard-log.schema.json: cannot be read as JSON")

    def test_schema_that_is_not_a_valid_schema(self) -> None:
        (self.box.safety / "hazard-log.schema.json").write_text('{"type": 12}', encoding="utf-8")
        self.assertFailsWith(self.box.run(), "hazard-log.schema.json: is not a valid JSON Schema")

    def test_counts_keep_their_shape_when_rules_cannot_run(self) -> None:
        (self.box.safety / "hazard-log.yaml").unlink()
        result = self.box.run()
        self.assertEqual(result.counts["hazards"], 0)
        self.assertIn("approval_fields_filled", result.counts)
        self.assertIn("sis_covered", result.counts)

    def test_missing_plan_is_an_environment_error(self) -> None:
        paths = self.box.paths
        paths.build_prompt = self.box.root / "BUILD-PROMPT.md"
        with self.assertRaises(EnvironmentProblem):
            run_check(paths)


if __name__ == "__main__":
    unittest.main()
