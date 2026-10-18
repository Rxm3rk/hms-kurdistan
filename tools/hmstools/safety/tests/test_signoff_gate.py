"""The approval-field gate (BUILD-PROMPT §3.5): filled approval fields need a matching, authenticated sign-off record."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from hmstools.safety import signoffs as so
from hmstools.safety.tests.harness import SandboxCase, hazard


def accept_hazard_0001(d: dict[str, Any], accepted_by: str = "SYN-TEST-SIGNER-A") -> None:
    hazard(d, "HAZ-0001")["residual_risk"]["accepted_by"] = accepted_by


class HazardLogGateTest(SandboxCase):
    def test_filled_accepted_by_without_record(self) -> None:
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "HAZ-0001 residual_risk.accepted_by is filled", "no sign-off record")
        self.assertEqual(result.counts["approval_fields_filled"], 1)

    def test_record_for_a_different_subject_does_not_count(self) -> None:
        self.box.add_signoff("signoffs/other-subject/SO-2099-0002.yaml")
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "HAZ-0001 residual_risk.accepted_by is filled", "no sign-off record")

    def test_record_for_a_different_field_does_not_count(self) -> None:
        self.box.add_signoff("signoffs/other-field/SO-2099-0003.yaml")
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "HAZ-0001 residual_risk.accepted_by is filled", "no sign-off record")

    def test_matching_record_passes(self) -> None:
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        result = self.run_with(accept_hazard_0001)
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertEqual(result.counts["signoff_records"], 1)

    def test_value_must_match_the_record(self) -> None:
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        result = self.run_with(lambda d: accept_hazard_0001(d, "SYN-TEST-SOMEONE-ELSE"))
        self.assertFailsWith(result, "does not match the sign-off record(s) SO-2099-0001")

    def test_rejected_record_authorises_nothing(self) -> None:
        self.box.add_signoff("signoffs/rejected/SO-2099-0005.yaml")
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "no sign-off record")

    def test_unauthenticated_record_does_not_count(self) -> None:
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        self.box.mutate(accept_hazard_0001)
        result = self.box.run(authenticate=lambda path: [f"{path.name}: not signed (test authenticator)"])
        self.assertFailsWith(result, "SO-2099-0001.yaml: not signed", "no sign-off record")

    def test_git_authenticator_rejects_a_record_outside_git(self) -> None:
        # The sandbox is not a git repository, so the real authenticator cannot find a signed commit.
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        self.box.mutate(accept_hazard_0001)
        result = self.box.run(authenticate=None)
        self.assertFalse(result.ok)
        self.assertTrue(any("SO-2099-0001" in e and ("git" in e or "commit" in e) for e in result.errors), result.errors)
        self.assertIn("no sign-off record", "\n".join(result.errors))

    def test_accepted_status_without_signoff(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0009")
            entry["status"] = "accepted"
            for item in entry["controls"]:
                item.update(state="verified", implemented_in=["backend/x"], verified_by=["PropertyTest:SI-09-x"])

        result = self.run_with(change)
        self.assertFailsWith(
            result,
            "HAZ-0009 status is filled ('accepted') but no sign-off record",
            "HAZ-0009 is 'accepted' but residual_risk.proposed is empty",
            "HAZ-0009 is 'accepted' but residual_risk.accepted_by is empty",
        )

    def test_accepted_status_with_signoff_passes(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0001")
            entry["status"] = "accepted"
            for item in entry["controls"]:
                item.update(state="verified", implemented_in=["backend/x"], verified_by=["PropertyTest:SI-01-x"])
            entry["residual_risk"] = {
                "proposed": {"severity": "catastrophic", "likelihood": "improbable", "level": "medium", "basis": "test"},
                "accepted_by": "SYN-TEST-SIGNER-A",
            }

        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        result = self.run_with(change)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_cso_triage_without_record(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0003").update(cso_triage={"by": "SYN-TEST-SIGNER-B", "date": "2099-01-02"}))
        self.assertFailsWith(result, "HAZ-0003 cso_triage.by is filled", "HAZ-0003 cso_triage.date is filled")

    def test_cso_triage_partly_filled(self) -> None:
        self.box.add_signoff("signoffs/triage/SO-2099-0008.yaml")
        result = self.run_with(lambda d: hazard(d, "HAZ-0003").update(cso_triage={"by": "SYN-TEST-SIGNER-B", "date": None}))
        self.assertFailsWith(result, "HAZ-0003 cso_triage is partly filled")

    def test_cso_triage_with_record_passes(self) -> None:
        self.box.add_signoff("signoffs/triage/SO-2099-0008.yaml")
        result = self.run_with(lambda d: hazard(d, "HAZ-0003").update(cso_triage={"by": "SYN-TEST-SIGNER-B", "date": "2099-01-02"}))
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_cso_triage_date_must_match_record(self) -> None:
        self.box.add_signoff("signoffs/triage/SO-2099-0008.yaml")
        result = self.run_with(lambda d: hazard(d, "HAZ-0003").update(cso_triage={"by": "SYN-TEST-SIGNER-B", "date": "2099-03-03"}))
        self.assertFailsWith(result, "HAZ-0003 cso_triage.date is filled", "does not match")

    def test_generic_approval_key_anywhere_in_the_log(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0004")["controls"][2].update(signed_by="SYN-TEST-SIGNER-A"))
        # signed_by is not a control field, so the schema fails too; the gate still reports the field.
        self.assertFailsWith(result, "CTRL-0004-3 signed_by is filled", "no sign-off record")

    def test_risk_vocabulary_confirmed_needs_a_signoff(self) -> None:
        result = self.run_with(lambda d: d["risk_vocabulary"].update(status="confirmed"))
        self.assertFailsWith(result, "risk-vocabulary status is filled ('confirmed') but no sign-off record")

    def test_risk_vocabulary_approved_by_needs_a_signoff(self) -> None:
        result = self.run_with(lambda d: d["risk_vocabulary"]["approval"].update(approved_by=["SYN-TEST-SIGNER-A"]))
        self.assertFailsWith(result, "risk-vocabulary approval.approved_by is filled")


class StateMachineGateTest(SandboxCase):
    def test_filled_approval_without_record(self) -> None:
        self.box.add_state_machine("state-machines/filled/medication-administration.yaml")
        result = self.box.run()
        self.assertFailsWith(
            result,
            "medication-administration approval.approved_by is filled",
            "medication-administration approval.status is filled ('approved')",
        )
        self.assertEqual(result.counts["state_machine_specs"], 1)

    def test_clean_spec_passes(self) -> None:
        self.box.add_state_machine("state-machines/clean/medication-administration.yaml")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertEqual(result.counts["state_machine_specs"], 1)

    def test_approval_with_matching_record_passes(self) -> None:
        self.box.add_state_machine("state-machines/filled-with-record/medication-administration.yaml")
        self.box.add_signoff("signoffs/state-machine/SO-2099-0007.yaml")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_approval_record_must_name_an_existing_record(self) -> None:
        self.box.add_state_machine("state-machines/bad-record/medication-administration.yaml")
        self.box.add_signoff("signoffs/state-machine/SO-2099-0007.yaml")
        result = self.box.run()
        self.assertFailsWith(result, "medication-administration approval.record is filled", "'SO-2099-0099' does not match")

    def test_record_for_hazard_does_not_approve_a_state_machine(self) -> None:
        self.box.add_state_machine("state-machines/filled-with-record/medication-administration.yaml")
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        self.assertFailsWith(self.box.run(), "medication-administration approval.approved_by is filled", "no sign-off record")


class OtherArtefactGateTest(SandboxCase):
    def test_signed_by_in_a_later_safety_artefact(self) -> None:
        self.box.copy_fixture("boundary-register/signed.yaml", self.box.safety / "boundary-register")
        self.assertFailsWith(self.box.run(), "boundary-register/signed.yaml: BR-0001 signed_by is filled")


class SignoffRecordTest(SandboxCase):
    def test_invalid_record_fails_schema(self) -> None:
        self.box.add_signoff("signoffs/invalid/SO-2099-0004.yaml")
        self.assertFailsWith(self.box.run(), "SO-2099-0004.yaml: schema:", "'statement' is a required property")

    def test_file_name_must_equal_id(self) -> None:
        self.box.add_signoff("signoffs/misnamed/SO-2099-9999.yaml")
        self.assertFailsWith(self.box.run(), "SO-2099-9999.yaml: file name must be SO-2099-0006.yaml")

    def test_duplicate_record_id(self) -> None:
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml", name="SO-2099-0001.yml")
        self.assertFailsWith(self.box.run(), "sign-off id SO-2099-0001 is also used by")

    def test_record_without_filled_field_warns(self) -> None:
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertIn("present but that field is not filled yet", "\n".join(result.warnings))


class ScanUnitTest(SandboxCase):
    def test_empty_values_are_not_filled(self) -> None:
        document = {"id": "X-1", "approval": {"status": "requested", "approved_by": [], "record": None},
                    "cso_triage": {"by": None, "date": None}, "accepted_by": ""}
        self.assertEqual(so.scan_gate_fields(document, "f", "x").fields, [])

    def test_subject_is_the_nearest_object_with_an_id(self) -> None:
        document = {"items": [{"id": "A-1", "child": {"triaged_by": "SYN"}}]}
        fields = so.scan_gate_fields(document, "f", "file").fields
        self.assertEqual([(g.subject, g.path) for g in fields], [("A-1", "child.triaged_by")])

    def test_ai_trailer_pattern(self) -> None:
        self.assertTrue(so._AI_TRAILER.search("msg\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n"))
        self.assertTrue(so._AI_TRAILER.search("msg\n\nCo-authored-by: dependabot[bot] <x@example.org>\n"))
        self.assertFalse(so._AI_TRAILER.search("msg\n\nCo-Authored-By: A Person <a@example.org>\n"))
        self.assertFalse(so._AI_TRAILER.search("msg\n\nCo-Authored-By: Ai Talbot <ai@example.org>\n"))

    def test_missing_signoff_schema_means_no_record_counts(self) -> None:
        self.box.add_signoff("signoffs/match/SO-2099-0001.yaml")
        (self.box.safety / "signoffs" / "signoff.schema.json").unlink()
        self.box.mutate(accept_hazard_0001)
        self.assertFailsWith(self.box.run(), "signoff.schema.json: missing", "no sign-off record")

    def test_iter_record_files_ignores_other_files(self) -> None:
        names = [p.name for p in so.iter_record_files(self.box.safety / "signoffs")]
        self.assertEqual(names, [])
        self.assertTrue((self.box.safety / "signoffs" / "signoff.schema.json").is_file())
        self.assertEqual(list(so.iter_record_files(Path(self.box.root / "nope"))), [])
