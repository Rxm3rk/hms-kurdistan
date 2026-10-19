"""The approval-field gate (BUILD-PROMPT §3.5): filled approval fields need a matching, authenticated sign-off record.

These tests use the stand-in authenticator of the harness (every record counts as committed and signed by
a listed key), so they test the matching rules: subject, field, decision, subject version and role. The
git side is in test_git_authentication.py (a scripted git) and test_signed_commits.py (real signatures).
"""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from typing import Any

import yaml

from hmstools.safety import signoffs as so
from hmstools.safety.check import _signers_reader
from hmstools.safety.tests.harness import REAL_SAFETY, REPO, SandboxCase, control, hazard

SIGNER_A = "SYN-TEST-SIGNER-A"
SIGNER_B = "SYN-TEST-SIGNER-B"
STATEMENT = "Synthetic test statement; authorises nothing outside the tests."
# A GPG v4 fingerprint that no real key has, derived at import time so that no hex literal here reads as a
# secret to the secret scan.
GPG_A = hashlib.sha1(b"hms synthetic test key A").hexdigest().upper()


def accept_hazard_0001(d: dict[str, Any], accepted_by: str = SIGNER_A) -> None:
    hazard(d, "HAZ-0001")["residual_risk"]["accepted_by"] = accepted_by


def triage_hazard_0003(d: dict[str, Any], by: str = SIGNER_B, date: Any = "2099-01-02") -> None:
    hazard(d, "HAZ-0003")["cso_triage"] = {"by": by, "date": date}


def verify_all_controls(d: dict[str, Any], hazard_id: str) -> None:
    for item in hazard(d, hazard_id)["controls"]:
        item.update(state="verified", implemented_in=["backend/x"], verified_by=[f"PropertyTest:{hazard_id}-x"])


class RecordCase(SandboxCase):
    """Writes synthetic records into the sandbox, versioned against the sandbox's hazard log as it is now."""

    def subject_node(self, subject: str) -> Any:
        with open(self.box.safety / "hazard-log.yaml", encoding="utf-8") as handle:
            doc = yaml.safe_load(handle)
        if subject == "risk-vocabulary":
            return doc["risk_vocabulary"]
        if subject.startswith("CTRL-"):
            return control(doc, subject)
        return hazard(doc, subject)

    def version(self, subject: str, decision: str) -> str:
        return so.subject_version(self.subject_node(subject), decision)

    def record(self, record_id: str, **fields: Any) -> Path:
        data: dict[str, Any] = {
            "id": record_id,
            "subject": "HAZ-0001",
            "field": "residual_risk.accepted_by",
            "role": "cso",
            "name": SIGNER_A,
            "date": "2099-01-01",
            "statement": STATEMENT,
            "decision": "accepted",
            "authentication": {"method": "signed-git-commit"},
        }
        data.update(fields)
        if "subject_version" not in data:
            data["subject_version"] = self.version(data["subject"], data["decision"])
        data = {k: v for k, v in data.items() if v is not None}
        target = self.box.safety / "signoffs" / f"{record_id}.yaml"
        header = "# Synthetic test record written by the tools/hmstools/safety tests (provenance: synthetic).\n"
        target.write_text(header + yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8", newline="\n")
        return target


class HazardLogGateTest(RecordCase):
    def test_filled_accepted_by_without_record(self) -> None:
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "HAZ-0001 residual_risk.accepted_by is filled", "no sign-off record")
        self.assertEqual(result.counts["approval_fields_filled"], 1)
        # The message names what a record would need, so the signer need not compute the version.
        self.assertFailsWith(result, f"with decision 'accepted' and subject_version '{self.version('HAZ-0001', 'accepted')}'")

    def test_record_for_a_different_subject_does_not_count(self) -> None:
        self.record("SO-2099-0002", subject="HAZ-0002")
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "HAZ-0001 residual_risk.accepted_by is filled", "no sign-off record")

    def test_record_for_a_different_field_does_not_count(self) -> None:
        self.record("SO-2099-0003", field="cso_triage", decision="triaged")
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "HAZ-0001 residual_risk.accepted_by is filled", "no sign-off record")

    def test_matching_record_passes(self) -> None:
        # Versioned before the field is filled: the human fields are not part of the version.
        self.record("SO-2099-0001")
        result = self.run_with(accept_hazard_0001)
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertEqual(result.counts["signoff_records"], 1)

    def test_value_must_match_the_record(self) -> None:
        self.record("SO-2099-0001")
        result = self.run_with(lambda d: accept_hazard_0001(d, "SYN-TEST-SOMEONE-ELSE"))
        self.assertFailsWith(result, "does not match the sign-off record(s) SO-2099-0001")

    def test_rejected_record_authorises_nothing(self) -> None:
        self.record("SO-2099-0005", decision="rejected")
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "no sign-off record with decision 'accepted'", "SO-2099-0005 (rejected)")

    def test_returned_record_authorises_nothing(self) -> None:
        self.record("SO-2099-0005", decision="returned")
        self.assertFailsWith(self.run_with(accept_hazard_0001), "no sign-off record with decision 'accepted'")

    def test_unauthenticated_record_does_not_count(self) -> None:
        self.record("SO-2099-0001")
        self.box.mutate(accept_hazard_0001)
        result = self.box.run(authenticate=lambda record: [f"{record.path.name}: not signed (test authenticator)"])
        self.assertFailsWith(result, "SO-2099-0001.yaml: not signed", "no sign-off record")

    def test_git_authenticator_rejects_a_record_outside_git(self) -> None:
        # The sandbox is not a git repository, so the real authenticator cannot find a signed commit.
        self.record("SO-2099-0001")
        self.box.mutate(accept_hazard_0001)
        result = self.box.run(authenticate=None)
        self.assertFalse(result.ok)
        self.assertTrue(any("SO-2099-0001" in e and ("git" in e or "commit" in e) for e in result.errors), result.errors)
        self.assertIn("no sign-off record", "\n".join(result.errors))
        self.assertIn("no signer is trusted", "\n".join(result.warnings))

    def test_accepted_status_without_signoff(self) -> None:
        def change(d: dict[str, Any]) -> None:
            hazard(d, "HAZ-0009")["status"] = "accepted"
            verify_all_controls(d, "HAZ-0009")

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
            verify_all_controls(d, "HAZ-0001")
            entry["residual_risk"] = {
                "proposed": {"severity": "catastrophic", "likelihood": "improbable", "level": "medium", "basis": "test"},
                "accepted_by": SIGNER_A,
            }

        self.box.mutate(change)
        self.record("SO-2099-0001")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_cso_triage_without_record(self) -> None:
        result = self.run_with(triage_hazard_0003)
        self.assertFailsWith(result, "HAZ-0003 cso_triage.by is filled", "HAZ-0003 cso_triage.date is filled")

    def test_cso_triage_partly_filled(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="triaged", name=SIGNER_B, date="2099-01-02")
        result = self.run_with(lambda d: triage_hazard_0003(d, date=None))
        self.assertFailsWith(result, "HAZ-0003 cso_triage is partly filled")

    def test_cso_triage_with_record_passes(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="triaged", name=SIGNER_B, date="2099-01-02")
        result = self.run_with(triage_hazard_0003)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_cso_triage_date_must_match_record(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="triaged", name=SIGNER_B, date="2099-01-02")
        result = self.run_with(lambda d: triage_hazard_0003(d, date="2099-03-03"))
        self.assertFailsWith(result, "HAZ-0003 cso_triage.date is filled", "does not match")

    def test_generic_approval_key_anywhere_in_the_log(self) -> None:
        result = self.run_with(lambda d: hazard(d, "HAZ-0004")["controls"][2].update(signed_by=SIGNER_A))
        # signed_by is not a control field, so the schema fails too; the gate still reports the field.
        self.assertFailsWith(result, "CTRL-0004-3 signed_by is filled", "no sign-off record")

    def test_risk_vocabulary_confirmed_needs_a_signoff(self) -> None:
        result = self.run_with(lambda d: d["risk_vocabulary"].update(status="confirmed"))
        self.assertFailsWith(result, "risk-vocabulary status is filled ('confirmed') but no sign-off record")

    def test_risk_vocabulary_approved_by_needs_a_signoff(self) -> None:
        result = self.run_with(lambda d: d["risk_vocabulary"]["approval"].update(approved_by=[SIGNER_A]))
        self.assertFailsWith(result, "risk-vocabulary approval.approved_by is filled")

    def test_risk_vocabulary_confirmed_with_a_cso_record_passes(self) -> None:
        def change(d: dict[str, Any]) -> None:
            d["risk_vocabulary"]["status"] = "confirmed"
            d["risk_vocabulary"]["approval"].update(status="approved", approved_by=[SIGNER_A], record="SO-2099-0011")

        self.box.mutate(change)
        self.record("SO-2099-0011", subject="risk-vocabulary", field="approval.approved_by", decision="approved")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))


class DecisionKindTest(RecordCase):
    """R-20: each decision authorises only its own kind of field, and every record states one."""

    def test_record_without_a_decision_is_invalid_and_authorises_nothing(self) -> None:
        self.record("SO-2099-0001", decision=None, subject_version=self.version("HAZ-0001", "accepted"))
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "SO-2099-0001.yaml: schema:", "'decision' is a required property", "no sign-off record")

    def test_triaged_record_does_not_authorise_an_acceptance(self) -> None:
        self.record("SO-2099-0001", decision="triaged")
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "no sign-off record with decision 'accepted'", "SO-2099-0001 (triaged)")

    def test_approved_record_does_not_authorise_an_acceptance(self) -> None:
        self.record("SO-2099-0001", decision="approved")
        self.assertFailsWith(self.run_with(accept_hazard_0001), "no sign-off record with decision 'accepted'")

    def test_triaged_record_does_not_authorise_an_accepted_status(self) -> None:
        def change(d: dict[str, Any]) -> None:
            entry = hazard(d, "HAZ-0001")
            entry["status"] = "accepted"
            verify_all_controls(d, "HAZ-0001")
            entry["residual_risk"] = {
                "proposed": {"severity": "catastrophic", "likelihood": "improbable", "level": "medium", "basis": "test"},
                "accepted_by": SIGNER_A,
            }

        self.box.mutate(change)
        self.record("SO-2099-0001", decision="triaged")
        self.assertFailsWith(self.box.run(), "HAZ-0001 status is filled ('accepted') but no sign-off record with decision 'accepted'")

    def test_accepted_record_does_not_authorise_a_triage(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="accepted", name=SIGNER_B, date="2099-01-02")
        self.assertFailsWith(self.run_with(triage_hazard_0003), "HAZ-0003 cso_triage.by is filled", "decision 'triaged'")

    def test_approved_record_does_not_authorise_a_triage(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="approved", name=SIGNER_B, date="2099-01-02")
        self.assertFailsWith(self.run_with(triage_hazard_0003), "decision 'triaged'")

    def test_accepted_record_does_not_authorise_an_approval(self) -> None:
        self.box.mutate(lambda d: d["risk_vocabulary"]["approval"].update(approved_by=[SIGNER_A]))
        self.record("SO-2099-0011", subject="risk-vocabulary", field="approval.approved_by", decision="accepted")
        self.assertFailsWith(self.box.run(), "risk-vocabulary approval.approved_by is filled", "decision 'approved'")

    def test_decision_for_each_field(self) -> None:
        self.assertEqual(so.decision_for("residual_risk.accepted_by"), "accepted")
        self.assertEqual(so.decision_for("cso_triage.by"), "triaged")
        self.assertEqual(so.decision_for("cso_triage.date"), "triaged")
        self.assertEqual(so.decision_for("triaged_by"), "triaged")
        self.assertEqual(so.decision_for("approval.approved_by"), "approved")
        self.assertEqual(so.decision_for("approval.record"), "approved")
        self.assertEqual(so.decision_for("signed_by"), "approved")


class SubjectVersionTest(RecordCase):
    """R-20: a record authorises only the version of the subject it names."""

    def test_record_without_a_subject_version_is_invalid(self) -> None:
        self.record("SO-2099-0001", subject_version=None)
        text =(self.box.safety / "signoffs" / "SO-2099-0001.yaml").read_text(encoding="utf-8")
        self.assertNotIn("subject_version", text)
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "'subject_version' is a required property", "no sign-off record")

    def test_acceptance_of_an_older_version_does_not_count(self) -> None:
        self.record("SO-2099-0001")
        result = self.run_with(lambda d: (accept_hazard_0001(d), control(d, "CTRL-0001-3").update(description="Changed after the sign-off.")))
        self.assertFailsWith(result, "are for another version of HAZ-0001, whose current version is 'sha256:", "SO-2099-0001 (sha256:")

    def test_acceptance_is_void_when_control_evidence_changes(self) -> None:
        self.record("SO-2099-0001")

        def change(d: dict[str, Any]) -> None:
            accept_hazard_0001(d)
            control(d, "CTRL-0001-3").update(state="implemented", implemented_in=["backend/x"])

        self.assertFailsWith(self.run_with(change), "another version of HAZ-0001")

    def test_triage_survives_control_progress(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="triaged", name=SIGNER_B, date="2099-01-02")

        def change(d: dict[str, Any]) -> None:
            triage_hazard_0003(d)
            control(d, "CTRL-0003-1").update(state="implemented", implemented_in=["backend/x"])

        result = self.run_with(change)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_triage_is_void_when_a_control_is_reworded(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="triaged", name=SIGNER_B, date="2099-01-02")

        def change(d: dict[str, Any]) -> None:
            triage_hazard_0003(d)
            control(d, "CTRL-0003-1").update(description="Reworded after the triage.")

        self.assertFailsWith(self.run_with(change), "HAZ-0003 cso_triage.by is filled", "another version of HAZ-0003")

    def test_triage_is_void_when_the_initial_risk_is_rerated(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="triaged", name=SIGNER_B, date="2099-01-02")

        def change(d: dict[str, Any]) -> None:
            triage_hazard_0003(d)
            hazard(d, "HAZ-0003")["initial_risk"]["basis"] = "Re-rated after the triage."

        self.assertFailsWith(self.run_with(change), "another version of HAZ-0003")

    def test_content_version_ignores_key_order_and_human_fields(self) -> None:
        node = {"id": "HAZ-0099", "title": "t", "status": "open", "controls": [{"id": "CTRL-0099-1", "state": "planned"}],
                "residual_risk": {"proposed": None, "accepted_by": None}, "cso_triage": {"by": None, "date": None}}
        filled = {"cso_triage": {"by": "x", "date": "2099-01-01"}, "status": "accepted", "title": "t",
                  "residual_risk": {"accepted_by": "x", "proposed": None}, "controls": [{"state": "planned", "id": "CTRL-0099-1"}],
                  "id": "HAZ-0099"}
        version = so.content_version(node, "accepted")
        self.assertRegex(version, r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(version, so.content_version(filled, "accepted"))
        self.assertNotEqual(version, so.content_version({**node, "title": "u"}, "accepted"))
        progressed = {**node, "controls": [{"id": "CTRL-0099-1", "state": "verified"}]}
        self.assertNotEqual(version, so.content_version(progressed, "accepted"))
        self.assertEqual(so.content_version(node, "triaged"), so.content_version(progressed, "triaged"))

    def test_a_declared_version_is_used_as_it_is(self) -> None:
        self.assertEqual(so.subject_version({"machine": "m", "version": 3}, "approved"), "3")
        self.assertTrue(so.subject_version({"machine": "m", "version": True}, "approved").startswith("sha256:"))


class StateMachineGateTest(RecordCase):
    MACHINE = "medication-administration"

    def panel_records(self, *roles: str, version: Any = 1) -> None:
        names = {"pharmacist-panel": "SYN-TEST-PANEL-A", "nurse-panel": "SYN-TEST-PANEL-B", "cso": SIGNER_A}
        for number, role in enumerate(roles, start=7):
            self.record(
                f"SO-2099-{number:04d}", subject=self.MACHINE, field="approval.approved_by", decision="approved",
                role=role, name=names.get(role, "SYN-TEST-PANEL-X"), subject_version=version,
            )

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

    def test_approval_with_a_record_for_every_required_role_passes(self) -> None:
        self.box.add_state_machine("state-machines/filled-with-record/medication-administration.yaml")
        self.panel_records("pharmacist-panel", "nurse-panel", "cso")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_approval_needs_a_record_for_every_required_role(self) -> None:
        self.box.add_state_machine("state-machines/filled-with-record/medication-administration.yaml")
        self.panel_records("pharmacist-panel")
        result = self.box.run()
        self.assertFailsWith(
            result,
            "medication-administration approval.status is filled ('approved') but no sign-off record signs as nurse-panel, cso",
            "'SYN-TEST-PANEL-B' does not match",
        )

    def test_record_role_outside_approval_required_does_not_count(self) -> None:
        self.box.add_state_machine("state-machines/filled-with-record/medication-administration.yaml")
        self.panel_records("him", "nurse-panel", "cso")
        self.assertFailsWith(self.box.run(), "approval.record is filled ('SO-2099-0007') but the value 'SO-2099-0007' does not match")

    def test_approval_without_required_roles_cannot_be_authorised(self) -> None:
        self.box.add_state_machine("state-machines/no-required/medication-administration.yaml")
        self.panel_records("pharmacist-panel", "nurse-panel", "cso")
        self.assertFailsWith(self.box.run(), "its approval block lists no required roles")

    def test_approval_of_an_earlier_spec_version_does_not_count(self) -> None:
        self.box.add_state_machine("state-machines/filled-version-2/medication-administration.yaml")
        self.panel_records("pharmacist-panel", "nurse-panel", "cso", version=1)
        self.assertFailsWith(self.box.run(), "another version of medication-administration, whose current version is '2'")

    def test_approval_record_must_name_an_existing_record(self) -> None:
        self.box.add_state_machine("state-machines/bad-record/medication-administration.yaml")
        self.panel_records("pharmacist-panel", "nurse-panel", "cso")
        result = self.box.run()
        self.assertFailsWith(result, "medication-administration approval.record is filled", "'SO-2099-0099' does not match")

    def test_record_for_hazard_does_not_approve_a_state_machine(self) -> None:
        self.box.add_state_machine("state-machines/filled-with-record/medication-administration.yaml")
        self.record("SO-2099-0001")
        self.assertFailsWith(self.box.run(), "medication-administration approval.approved_by is filled", "no sign-off record")


class RoleTest(RecordCase):
    """R-20: the record's role must be one the field accepts (the signer's listed roles: test_signed_commits.py)."""

    def test_acceptance_needs_the_cso_role(self) -> None:
        self.record("SO-2099-0001", role="nurse-panel")
        self.assertFailsWith(self.run_with(accept_hazard_0001), "SO-2099-0001 (nurse-panel) do not sign as cso")

    def test_triage_needs_the_cso_role(self) -> None:
        self.record("SO-2099-0008", subject="HAZ-0003", field="cso_triage", decision="triaged", name=SIGNER_B,
                    date="2099-01-02", role="lab-cso")
        self.assertFailsWith(self.run_with(triage_hazard_0003), "do not sign as cso")

    def test_role_is_a_role_id(self) -> None:
        self.record("SO-2099-0001", role="Clinical Safety Officer")
        self.assertFailsWith(self.run_with(accept_hazard_0001), "SO-2099-0001.yaml: schema: role:")

    def test_generic_field_without_roles_accepts_any_listed_role(self) -> None:
        self.box.copy_fixture("boundary-register/signed.yaml", self.box.safety / "boundary-register")
        document = yaml.safe_load((self.box.safety / "boundary-register" / "signed.yaml").read_text(encoding="utf-8"))
        version = so.subject_version(document["entries"][0], "approved")
        self.record("SO-2099-0012", subject="BR-0001", field="signed_by", decision="approved", role="lab-cso",
                    subject_version=version)
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))


class WithdrawalTest(RecordCase):
    """A record named in a later record's supersedes, or met by a rejection or a return of the same subject
    version and field, authorises nothing (review: a later record did not revoke an earlier one)."""

    MACHINE = StateMachineGateTest.MACHINE
    panel_records = StateMachineGateTest.panel_records

    def test_a_rejection_withdraws_an_acceptance_of_the_same_version(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", date="2099-02-01")
        self.assertFailsWith(
            self.run_with(accept_hazard_0001),
            "SO-2099-0001 (withdrawn by SO-2099-0002 (rejected) at the same subject version) are withdrawn",
        )

    def test_a_rejection_that_supersedes_the_acceptance_withdraws_it(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", supersedes="SO-2099-0001", date="2099-02-01")
        self.assertFailsWith(self.run_with(accept_hazard_0001), "SO-2099-0001 (superseded by SO-2099-0002) are withdrawn")

    def test_a_return_withdraws_an_approval(self) -> None:
        def change(d: dict[str, Any]) -> None:
            d["risk_vocabulary"]["status"] = "confirmed"
            d["risk_vocabulary"]["approval"].update(status="approved", approved_by=[SIGNER_A], record="SO-2099-0011")

        self.box.mutate(change)
        self.record("SO-2099-0011", subject="risk-vocabulary", field="approval.approved_by", decision="approved")
        self.record("SO-2099-0012", subject="risk-vocabulary", field="approval", decision="returned", date="2099-02-01")
        self.assertFailsWith(self.box.run(), "risk-vocabulary status is filled ('confirmed')", "withdrawn by SO-2099-0012 (returned)")

    def test_a_record_that_supersedes_the_rejection_authorises_again(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", date="2099-02-01")
        self.record("SO-2099-0003", supersedes="SO-2099-0002", date="2099-03-01")
        result = self.run_with(accept_hazard_0001)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_a_superseded_record_stays_withdrawn_when_its_replacement_is_replaced(self) -> None:
        self.record("SO-2099-0001", name=SIGNER_B)
        self.record("SO-2099-0002", decision="rejected", supersedes="SO-2099-0001", date="2099-02-01")
        self.record("SO-2099-0003", supersedes="SO-2099-0002", date="2099-03-01")
        self.assertTrue(self.run_with(accept_hazard_0001).ok)  # SIGNER_A, the name in SO-2099-0003
        self.assertFailsWith(
            self.run_with(lambda d: accept_hazard_0001(d, SIGNER_B)),
            "the value 'SYN-TEST-SIGNER-B' does not match the sign-off record(s) SO-2099-0003",
            "SO-2099-0001 (superseded by SO-2099-0002) withdrawn",
        )

    def test_a_superseded_record_no_longer_backs_its_value(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", name=SIGNER_B, supersedes="SO-2099-0001", date="2099-02-01")
        self.assertFailsWith(
            self.run_with(accept_hazard_0001),
            "the value 'SYN-TEST-SIGNER-A' does not match the sign-off record(s) SO-2099-0002",
        )
        self.assertTrue(self.run_with(lambda d: accept_hazard_0001(d, SIGNER_B)).ok)

    def test_a_rejection_of_another_version_withdraws_nothing(self) -> None:
        self.record("SO-2099-0001", decision="rejected", subject_version="sha256:" + "0" * 64)
        self.record("SO-2099-0002", date="2099-02-01")
        result = self.run_with(accept_hazard_0001)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_a_rejection_of_another_field_withdraws_nothing(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", field="cso_triage", subject_version=self.version("HAZ-0001", "accepted"))
        result = self.run_with(accept_hazard_0001)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_a_rejection_of_a_parent_field_withdraws_the_field(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", field="residual_risk", subject_version=self.version("HAZ-0001", "accepted"))
        self.assertFailsWith(self.run_with(accept_hazard_0001), "withdrawn by SO-2099-0002 (rejected)")

    def test_a_return_by_one_panel_withdraws_the_approval_at_that_version(self) -> None:
        self.box.add_state_machine("state-machines/filled-with-record/medication-administration.yaml")
        self.panel_records("pharmacist-panel", "nurse-panel", "cso")
        self.record("SO-2099-0010", subject="medication-administration", field="approval.approved_by", decision="returned",
                    role="nurse-panel", name="SYN-TEST-PANEL-B", subject_version=1)
        self.assertFailsWith(self.box.run(), "medication-administration approval.status is filled ('approved')", "withdrawn by SO-2099-0010 (returned)")

    def test_a_record_for_another_subject_cannot_end_a_rejection(self) -> None:
        # W11: a nurse-panel signer's record about another subject named the CSO's rejection in supersedes, and the
        # acceptance the rejection withdrew authorised again.
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", date="2099-02-01")
        self.record("SO-2099-0003", subject="HAZ-0002", field="signed_by", decision="approved", role="nurse-panel",
                    name=SIGNER_B, supersedes="SO-2099-0002", date="2099-03-01")
        self.assertFailsWith(
            self.run_with(accept_hazard_0001),
            "SO-2099-0003.yaml: supersedes SO-2099-0002, a record for HAZ-0001 residual_risk.accepted_by, but is itself for "
            "HAZ-0002 signed_by; a record supersedes only a record for the same subject and field",
            "SO-2099-0001 (withdrawn by SO-2099-0002 (rejected) at the same subject version) are withdrawn",
        )

    def test_another_role_cannot_end_a_rejection(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", date="2099-02-01")
        self.record("SO-2099-0003", role="nurse-panel", name=SIGNER_B, supersedes="SO-2099-0002", date="2099-03-01")
        self.assertFailsWith(
            self.run_with(accept_hazard_0001),
            f"SO-2099-0003.yaml: supersedes SO-2099-0002, which {SIGNER_A} signed as cso (rejected), but is signed as nurse-panel "
            f"by {SIGNER_B}; only the person who rejected or returned, or a record in the same role, ends a rejection or a return",
            "withdrawn by SO-2099-0002 (rejected)",
        )

    def test_another_person_in_the_same_role_ends_a_rejection(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", date="2099-02-01")
        self.record("SO-2099-0003", name=SIGNER_B, supersedes="SO-2099-0002", date="2099-03-01")
        result = self.run_with(lambda d: accept_hazard_0001(d, SIGNER_B))
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_a_return_by_one_panel_is_not_ended_by_another_role(self) -> None:
        self.box.add_state_machine("state-machines/filled-with-record/medication-administration.yaml")
        self.panel_records("pharmacist-panel", "nurse-panel", "cso")
        self.record("SO-2099-0010", subject=self.MACHINE, field="approval.approved_by", decision="returned",
                    role="nurse-panel", name="SYN-TEST-PANEL-B", subject_version=1)
        self.record("SO-2099-0011", subject=self.MACHINE, field="approval.approved_by", decision="approved",
                    role="cso", supersedes="SO-2099-0010", subject_version=1)
        self.assertFailsWith(self.box.run(), "SO-2099-0011.yaml: supersedes SO-2099-0010", "withdrawn by SO-2099-0010 (returned)")

    def test_superseding_a_record_of_another_subject_is_an_error_until_superseded(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", subject="HAZ-0002", field="signed_by", decision="approved", supersedes="SO-2099-0001")
        result = self.run_with(accept_hazard_0001)
        self.assertFailsWith(result, "SO-2099-0002.yaml: supersedes SO-2099-0001, a record for HAZ-0001")
        self.assertFalse(any("HAZ-0001 residual_risk.accepted_by is filled" in e for e in result.errors), result.errors)  # SO-2099-0001 stands
        self.record("SO-2099-0003", subject="HAZ-0002", field="signed_by", decision="approved", supersedes="SO-2099-0002")
        result = self.run_with(accept_hazard_0001)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_withdrawals_check_supersedes_against_every_record_with_the_id(self) -> None:
        def rec(record_id: str, **fields: Any) -> so.SignoffRecord:
            data = {"id": record_id, "subject": "S", "field": "f", "subject_version": "1", "decision": "approved",
                    "role": "cso", "name": "N1", **fields}
            return so.SignoffRecord(Path(f"{record_id}.yaml"), data)

        # A removed record's two versions share an id: a record that may supersede one but not the other withdraws nothing.
        withdrawn, errors = so.withdrawals([
            rec("SO-1"), rec("SO-1", decision="rejected"), rec("SO-2", role="nurse-panel", name="N2", supersedes="SO-1"),
        ])
        self.assertNotIn("SO-1", {k for k, v in withdrawn.items() if v.startswith("superseded")})
        self.assertTrue(errors and "only the person who rejected or returned" in errors[0], errors)

    def test_supersedes_must_name_a_record_that_is_here(self) -> None:
        self.record("SO-2099-0001", supersedes="SO-2099-0099")
        self.assertFailsWith(self.run_with(accept_hazard_0001), "SO-2099-0001.yaml: supersedes SO-2099-0099, but no valid sign-off record has that id")

    def test_a_record_cannot_supersede_itself(self) -> None:
        self.record("SO-2099-0001", supersedes="SO-2099-0001")
        self.assertFailsWith(self.run_with(accept_hazard_0001), "SO-2099-0001.yaml: supersedes itself")

    def test_a_dangling_supersedes_ends_when_a_later_record_supersedes_it(self) -> None:
        self.record("SO-2099-0001", supersedes="SO-2099-0099")
        self.record("SO-2099-0002", supersedes="SO-2099-0001", date="2099-02-01")
        result = self.run_with(accept_hazard_0001)
        self.assertTrue(result.ok, "\n".join(result.errors))

    def test_an_unauthenticated_record_withdraws_nothing(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", supersedes="SO-2099-0001", date="2099-02-01")
        self.box.mutate(accept_hazard_0001)
        result = self.box.run(authenticate=lambda record: ["not signed (test authenticator)"] if record.id == "SO-2099-0002" else [])
        self.assertEqual(result.errors, ["not signed (test authenticator)"])

    def test_a_withdrawn_record_raises_no_unfilled_warning(self) -> None:
        self.record("SO-2099-0001")
        self.record("SO-2099-0002", decision="rejected", supersedes="SO-2099-0001", date="2099-02-01")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertNotIn("present but that field is not filled yet", "\n".join(result.warnings))

    def test_withdrawals_unit(self) -> None:
        def rec(record_id: str, **fields: Any) -> so.SignoffRecord:
            data = {"id": record_id, "subject": "S", "field": "approval.approved_by", "subject_version": "1", "decision": "approved", **fields}
            return so.SignoffRecord(Path(f"{record_id}.yaml"), data)

        withdrawn, errors = so.withdrawals([
            rec("SO-1"), rec("SO-2", decision="returned", field="approval"), rec("SO-3", subject_version="2"),
            rec("SO-4", subject="T"), rec("SO-5", subject="T", supersedes="SO-4"), rec("SO-6", subject="U", supersedes="SO-9"),
        ])
        self.assertEqual(set(withdrawn), {"SO-1", "SO-4"})
        self.assertEqual(withdrawn["SO-4"], "superseded by SO-5")
        self.assertEqual(errors, ["SO-6.yaml: supersedes SO-9, but no valid sign-off record has that id, so nothing is withdrawn; "
                                  "a later record that supersedes this one ends the error"])


class RiskVocabularyRoleTest(RecordCase):
    """Risk-vocabulary is a CSO decision whatever approval.required lists, and the required roles are part of
    a subject's content version (review: the roles came from a list the agent can edit outside the version)."""

    def confirm(self, d: dict[str, Any], required: list[str] | None = None) -> None:
        d["risk_vocabulary"]["status"] = "confirmed"
        d["risk_vocabulary"]["approval"].update(status="approved", approved_by=["SYN-TEST-PANEL-B"], record="SO-2099-0011")
        if required is not None:
            d["risk_vocabulary"]["approval"]["required"] = required

    def test_a_required_list_without_the_cso_still_needs_the_cso(self) -> None:
        self.box.mutate(lambda d: self.confirm(d, ["nurse-panel"]))
        self.record("SO-2099-0011", subject="risk-vocabulary", field="approval.approved_by", decision="approved",
                    role="nurse-panel", name="SYN-TEST-PANEL-B")
        self.assertFailsWith(self.box.run(), "risk-vocabulary status is filled ('confirmed') but no sign-off record signs as cso",
                             "every required role (cso, nurse-panel)")

    def test_risk_vocabulary_roles_always_start_with_the_cso(self) -> None:
        document = {"risk_vocabulary": {"id": "risk-vocabulary", "status": "confirmed",
                                        "approval": {"status": "approved", "required": ["lab-cso"], "approved_by": ["x"]}}}
        fields = {g.path: g.roles for g in so.scan_gate_fields(document, "f", "file", hazard_log=True).fields}
        self.assertEqual(fields, {"status": ("cso", "lab-cso"), "approval.status": ("cso", "lab-cso"), "approval.approved_by": ("cso", "lab-cso")})

    def test_required_roles_are_part_of_the_content_version(self) -> None:
        node = {"id": "risk-vocabulary", "status": "proposed", "approval": {"status": "requested", "required": ["cso"], "approved_by": [], "record": None}}
        filled = {**node, "status": "confirmed", "approval": {"status": "approved", "required": ["cso"], "approved_by": ["x"], "record": "SO-2099-0001"}}
        narrowed = {**node, "approval": {**node["approval"], "required": ["nurse-panel"]}}
        self.assertEqual(so.content_version(node, "approved"), so.content_version(filled, "approved"))
        self.assertNotEqual(so.content_version(node, "approved"), so.content_version(narrowed, "approved"))

    def test_changing_the_required_roles_voids_the_record(self) -> None:
        self.record("SO-2099-0011", subject="risk-vocabulary", field="approval.approved_by", decision="approved")
        self.assertFailsWith(self.run_with(lambda d: self.confirm(d, ["cso", "nurse-panel"])), "another version of risk-vocabulary")

    def test_a_record_for_the_approval_block_authorises_the_status(self) -> None:
        def change(d: dict[str, Any]) -> None:
            self.confirm(d)
            d["risk_vocabulary"]["approval"]["approved_by"] = [SIGNER_A]

        self.box.mutate(change)
        self.record("SO-2099-0011", subject="risk-vocabulary", field="approval", decision="approved")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))


class MalformedBlockAndLocationTest(RecordCase):
    """An approval or a triage written as text fails closed, and a spec in a subdirectory is scanned
    (review: both passed with approval_fields_filled=0)."""

    SPEC = (
        "# Synthetic test fixture (provenance: synthetic).\nmachine: order\nversion: 1\n"
        "states: [draft, active]\napproval: {approval}\n"
    )

    def write_spec(self, relative: str, approval: str) -> None:
        target = self.box.root / "docs" / "specs" / "state-machines" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(self.SPEC.replace("{approval}", approval), encoding="utf-8", newline="\n")

    def test_a_text_approval_in_a_spec_fails(self) -> None:
        self.write_spec("order.yaml", "approved by the CSO on 2099-01-01")
        result = self.box.run()
        self.assertFailsWith(result, "order approval is filled ('approved by the CSO on 2099-01-01') but it is not a block")
        self.assertEqual(result.counts["approval_fields_filled"], 1)

    def test_a_list_approval_fails(self) -> None:
        self.write_spec("order.yaml", "[SYN-TEST-SIGNER-A]")
        self.assertFailsWith(self.box.run(), "order approval is filled (['SYN-TEST-SIGNER-A']) but it is not a block")

    def test_an_empty_approval_is_not_filled(self) -> None:
        for empty in ("null", "''", "[]", "{}"):
            with self.subTest(approval=empty):
                self.write_spec("order.yaml", empty)
                result = self.box.run()
                self.assertTrue(result.ok, "\n".join(result.errors))
                self.assertEqual(result.counts["approval_fields_filled"], 0)

    def test_a_text_triage_fails_even_where_no_schema_applies(self) -> None:
        document = {"entries": [{"id": "BR-0001", "cso_triage": "triaged by the CSO"}]}
        fields = so.scan_gate_fields(document, "f", "file").fields
        self.assertEqual([(g.subject, g.path, g.kind, g.decision) for g in fields], [("BR-0001", "cso_triage", "block", "triaged")])
        self.assertIn("is not a block with its own fields (by and date", so.match_gate_field(fields[0], []) or "")

    def test_a_spec_in_a_subdirectory_is_scanned(self) -> None:
        self.box.copy_fixture("state-machines/filled/medication-administration.yaml",
                              self.box.root / "docs" / "specs" / "state-machines" / "medications")
        result = self.box.run()
        self.assertFailsWith(result, "state-machines/medications/medication-administration.yaml: medication-administration approval.approved_by is filled")
        self.assertEqual(result.counts["state_machine_specs"], 1)


class OtherArtefactGateTest(SandboxCase):
    def test_signed_by_in_a_later_safety_artefact(self) -> None:
        self.box.copy_fixture("boundary-register/signed.yaml", self.box.safety / "boundary-register")
        self.assertFailsWith(self.box.run(), "boundary-register/signed.yaml: BR-0001 signed_by is filled")


class SignoffRecordTest(RecordCase):
    def test_invalid_record_fails_schema(self) -> None:
        self.box.add_signoff("signoffs/invalid/SO-2099-0004.yaml")
        self.assertFailsWith(self.box.run(), "SO-2099-0004.yaml: schema:", "'statement' is a required property")

    def test_file_name_must_equal_id(self) -> None:
        self.box.add_signoff("signoffs/misnamed/SO-2099-9999.yaml")
        self.assertFailsWith(self.box.run(), "SO-2099-9999.yaml: file name must be SO-2099-0006.yaml")

    def test_duplicate_record_id(self) -> None:
        path = self.record("SO-2099-0001")
        shutil.copy2(path, path.with_suffix(".yml"))
        self.assertFailsWith(self.box.run(), "sign-off id SO-2099-0001 is also used by")

    def test_record_without_filled_field_warns(self) -> None:
        self.record("SO-2099-0001")
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertIn("present but that field is not filled yet", "\n".join(result.warnings))


class AllowedSignersFileTest(SandboxCase):
    """docs/safety/signoffs/allowed-signers.yaml: its schema, and the real file as shipped."""

    def setUp(self) -> None:
        super().setUp()
        shutil.copy2(REAL_SAFETY / "signoffs" / "allowed-signers.schema.json", self.box.safety / "signoffs")

    def write_signers(self, *entries: dict[str, Any]) -> None:
        document = {"schema_version": 1, "signers": list(entries)}
        (self.box.safety / "signoffs" / so.ALLOWED_SIGNERS_FILE).write_text(yaml.safe_dump(document, sort_keys=False), encoding="utf-8")

    def entry(self, **fields: Any) -> dict[str, Any]:
        return {"name": SIGNER_A, "roles": ["cso"], "key_type": "gpg", "fingerprint": GPG_A, "added": "2099-01-01", **fields}

    def test_the_shipped_file_lists_no_signer(self) -> None:
        signers, errors = _signers_reader(self.box.paths)((REAL_SAFETY / "signoffs" / so.ALLOWED_SIGNERS_FILE).read_text(encoding="utf-8"), "real")
        self.assertEqual((signers, errors), ([], []))
        header = (REAL_SAFETY / "signoffs" / so.ALLOWED_SIGNERS_FILE).read_text(encoding="utf-8")
        self.assertIn("ONLY A HUMAN ADDS, CHANGES OR REMOVES AN ENTRY IN THIS FILE. THE BUILD AGENT NEVER DOES", header)

    def test_a_valid_list_passes_and_is_counted(self) -> None:
        self.write_signers(self.entry(), self.entry(key_type="ssh", fingerprint="SHA256:" + "A" * 43))
        result = self.box.run()
        self.assertTrue(result.ok, "\n".join(result.errors))
        self.assertEqual(result.counts["allowed_signers"], 2)

    def test_the_list_is_not_a_record(self) -> None:
        self.write_signers(self.entry())
        self.assertEqual([p.name for p in so.iter_record_files(self.box.safety / "signoffs")], [])
        self.assertEqual(self.box.run().counts["signoff_records"], 0)

    def test_short_or_lower_case_gpg_fingerprint_fails(self) -> None:
        for fingerprint in (GPG_A[-16:], GPG_A.lower(), "SHA256:" + "A" * 43):
            with self.subTest(fingerprint=fingerprint):
                self.write_signers(self.entry(fingerprint=fingerprint))
                self.assertFailsWith(self.box.run(), "allowed-signers.yaml: schema: signers/0/fingerprint:")

    def test_malformed_ssh_fingerprint_fails(self) -> None:
        self.write_signers(self.entry(key_type="ssh", fingerprint="MD5:00:11"))
        self.assertFailsWith(self.box.run(), "allowed-signers.yaml: schema: signers/0/fingerprint:")

    def test_an_entry_needs_a_role(self) -> None:
        self.write_signers(self.entry(roles=[]))
        self.assertFailsWith(self.box.run(), "allowed-signers.yaml: schema: signers/0/roles:")

    def test_a_key_is_listed_once(self) -> None:
        self.write_signers(self.entry(), self.entry(name=SIGNER_B))
        self.assertFailsWith(self.box.run(), f"key {GPG_A} is listed more than once")

    def test_missing_schema_means_no_signer_is_trusted(self) -> None:
        self.write_signers(self.entry())
        (self.box.safety / "signoffs" / "allowed-signers.schema.json").unlink()
        self.assertFailsWith(self.box.run(), "allowed-signers.schema.json: missing", "no signer is trusted")


class ScanUnitTest(SandboxCase):
    def test_empty_values_are_not_filled(self) -> None:
        document = {"id": "X-1", "approval": {"status": "requested", "approved_by": [], "record": None},
                    "cso_triage": {"by": None, "date": None}, "accepted_by": ""}
        self.assertEqual(so.scan_gate_fields(document, "f", "x").fields, [])

    def test_subject_is_the_nearest_object_with_an_id(self) -> None:
        document = {"items": [{"id": "A-1", "child": {"triaged_by": "SYN"}}]}
        fields = so.scan_gate_fields(document, "f", "file").fields
        self.assertEqual([(g.subject, g.path, g.decision, g.roles) for g in fields], [("A-1", "child.triaged_by", "triaged", None)])

    def test_roles_come_from_the_field(self) -> None:
        document = {"hazards": [{"id": "HAZ-0099", "residual_risk": {"accepted_by": "x"}, "cso_triage": {"by": "x", "date": None}}],
                    "spec": {"machine": "m", "version": 1, "approval": {"status": "approved", "required": ["a", "b"], "approved_by": ["x"]}}}
        fields = {(g.subject, g.path): g.roles for g in so.scan_gate_fields(document, "f", "file", hazard_log=True).fields}
        self.assertEqual(fields[("HAZ-0099", "residual_risk.accepted_by")], ("cso",))
        self.assertEqual(fields[("HAZ-0099", "cso_triage.by")], ("cso",))
        self.assertEqual(fields[("m", "approval.status")], ("a", "b"))
        self.assertEqual(fields[("m", "approval.approved_by")], ("a", "b"))

    def test_ai_trailer_pattern(self) -> None:
        self.assertTrue(so._AI_TRAILER.search("msg\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n"))
        self.assertTrue(so._AI_TRAILER.search("msg\n\nCo-authored-by: dependabot[bot] <x@example.org>\n"))
        self.assertFalse(so._AI_TRAILER.search("msg\n\nCo-Authored-By: A Person <a@example.org>\n"))
        self.assertFalse(so._AI_TRAILER.search("msg\n\nCo-Authored-By: Ai Talbot <ai@example.org>\n"))

    def test_missing_signoff_schema_means_no_record_counts(self) -> None:
        self.box.add_signoff("signoffs/misnamed/SO-2099-9999.yaml", name="SO-2099-0006.yaml")
        (self.box.safety / "signoffs" / "signoff.schema.json").unlink()
        self.box.mutate(accept_hazard_0001)
        self.assertFailsWith(self.box.run(), "signoff.schema.json: missing", "no sign-off record")

    def test_iter_record_files_ignores_other_files(self) -> None:
        names = [p.name for p in so.iter_record_files(self.box.safety / "signoffs")]
        self.assertEqual(names, [])
        self.assertTrue((self.box.safety / "signoffs" / "signoff.schema.json").is_file())
        self.assertEqual(list(so.iter_record_files(Path(self.box.root / "nope"))), [])

    def test_the_real_signoff_directory_holds_no_record(self) -> None:
        self.assertEqual(list(so.iter_record_files(REPO / "docs" / "safety" / "signoffs")), [])
