"""Rule 13 of spec §2.1 (KA-013) in throwaway git repositories, and the canonical content of §2.2.

Each test builds a scratch repository in a temporary directory; nothing touches the real repository or the
user's git configuration (GIT_CONFIG_NOSYSTEM and GIT_CONFIG_GLOBAL point at an empty file while a test runs,
and the identity is set in the scratch repository). The sign-off records are synthetic (SYN- names) and are
only test data: no record is ever written to docs/safety/signoffs of the repository.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import unittest
from unittest import mock

from hmstools.safety import signoffs as so
from hmstools.statemachines.loader import canonical_sha256, canonical_text, load_spec, load_spec_text
from hmstools.statemachines.tests.harness import FIXTURES, SandboxCase

RECORD = """id: {id}
subject: {subject}
subject_version: {version}
field: approval.approved_by
role: cso
name: SYN-TEST-SIGNER
date: 2026-10-19
statement: synthetic test record of the state-machine tests, NOT FOR CLINICAL USE
decision: approved
authentication:
  method: signed-git-commit
"""


class Rule13(SandboxCase):
    @classmethod
    def setUpClass(cls) -> None:
        if shutil.which("git") is None:
            raise unittest.SkipTest("git is not on PATH on this host")
        super().setUpClass()

    def setUp(self) -> None:
        super().setUp()
        empty = self.box.root.parent / f"{self.box.root.name}-gitconfig"
        empty.write_text("", encoding="utf-8")
        self.addCleanup(empty.unlink)
        patcher = mock.patch.dict(os.environ, {"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": str(empty)})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.git("init", "-q")
        for key, value in (("user.name", "SYN-TEST-SIGNER"), ("user.email", "syn-test-signer@example.invalid"),
                           ("commit.gpgsign", "false"), ("core.autocrlf", "false")):
            self.git("config", key, value)
        self.box.add("clean", "toy-light.yaml", "toy-light.md")
        self.spec = self.box.specs / "toy-light.yaml"

    def git(self, *args: str) -> str:
        done = subprocess.run(["git", "-C", str(self.box.root), *args], capture_output=True, text=True, check=False)
        if done.returncode != 0:
            raise AssertionError(f"git {' '.join(args)}: {done.stderr}")
        return done.stdout

    def commit(self, message: str) -> None:
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)

    def record(self, record_id: str = "SO-2026-0901", subject: str = "toy-light", version: object = 1) -> None:
        self.box.write(f"docs/safety/signoffs/{record_id}.yaml", RECORD.format(id=record_id, subject=subject, version=version))

    def edit(self, old: str, new: str) -> None:
        text = self.spec.read_text(encoding="utf-8")
        self.assertIn(old, text)
        self.spec.write_text(text.replace(old, new), encoding="utf-8", newline="\n")

    def rule_13(self) -> list[str]:
        result = self.box.check(only="toy-light")
        return [e for e in result.errors if "rule 13" in e]

    def test_unchanged_spec_keeps_its_record(self) -> None:
        self.record()
        self.commit("spec and record")
        self.assertEqual(self.rule_13(), [])
        self.assertEqual(self.box.check(only="toy-light").counts["approval_records"], 1)

    def test_a_content_change_without_a_version_bump_fails(self) -> None:
        self.record()
        self.commit("spec and record")
        self.edit("mains or generator power is present", "mains power is present")
        errors = self.rule_13()
        self.assertEqual(len(errors), 1)
        self.assertIn("rule 13: content changed since approval record SO-2026-0901 without a version bump", errors[0])

    def test_a_later_record_is_compared_with_the_spec_when_it_was_added(self) -> None:
        self.commit("spec")
        self.edit("mains or generator power is present", "mains power is present")
        self.record()
        self.commit("changed spec and its record")
        self.assertEqual(self.rule_13(), [])

    def test_a_version_bump_releases_the_old_record(self) -> None:
        self.record()
        self.commit("spec and record")
        self.edit("mains or generator power is present", "mains power is present")
        self.edit("version: 1", "version: 2")
        self.assertEqual(self.rule_13(), [])
        self.assertEqual(self.box.check(only="toy-light").counts["approval_records"], 0)

    def test_comments_layout_and_human_fields_do_not_count(self) -> None:
        self.record()
        self.commit("spec and record")
        self.edit("states: [off, on, retired]", "# a comment\nstates:\n  - off\n  - on\n  - retired")
        self.edit("approved_by: [], record: null", "approved_by: [SYN-TEST-SIGNER], record: SO-2026-0901")
        self.edit("status: requested", "status: approved")
        self.assertEqual(self.rule_13(), [])

    def test_the_required_roles_count(self) -> None:
        self.record()
        self.commit("spec and record")
        self.edit("required: [cso]", "required: [cso, nurse-panel]")
        self.assertIn("content changed since approval record SO-2026-0901", "\n".join(self.rule_13()))

    def test_record_not_committed(self) -> None:
        self.commit("spec")
        self.record()
        self.assertIn("approval record SO-2026-0901 (docs/safety/signoffs/SO-2026-0901.yaml) for toy-light version 1: record not committed",
                      "\n".join(self.rule_13()))

    def test_record_added_before_the_spec(self) -> None:
        self.record()
        self.git("add", "docs/safety/signoffs")
        self.git("commit", "-q", "-m", "record first")
        self.commit("spec later")
        self.assertIn("docs/specs/state-machines/toy-light.yaml did not exist at commit", "\n".join(self.rule_13()))

    def test_a_record_removed_and_added_again_is_checked_at_every_addition(self) -> None:
        self.record()
        self.commit("spec and record")
        (self.box.root / "docs/safety/signoffs/SO-2026-0901.yaml").unlink()
        self.commit("record removed")
        self.edit("mains or generator power is present", "mains power is present")
        self.record()
        self.commit("changed spec, record again")
        self.assertIn("content changed since approval record SO-2026-0901", "\n".join(self.rule_13()))

    def test_records_of_other_subjects_or_versions_do_not_apply(self) -> None:
        self.record("SO-2026-0902", subject="bed")
        self.record("SO-2026-0903", version=2)
        self.record("SO-2026-0904", version='"sha256:' + "0" * 64 + '"')
        self.commit("spec and records")
        self.edit("mains or generator power is present", "mains power is present")
        self.assertEqual(self.rule_13(), [])

    def test_an_unreadable_record_fails_closed(self) -> None:
        self.box.write("docs/safety/signoffs/SO-2026-0905.yaml", "id: [")
        self.commit("broken record")
        self.assertIn("rule 13: docs/safety/signoffs/SO-2026-0905.yaml cannot be read", "\n".join(self.box.check().errors))

    def test_no_history_fails_closed(self) -> None:
        self.record()  # a repository without commits: git log fails
        self.assertIn("the git history cannot be read", "\n".join(self.rule_13()))


class CanonicalContent(unittest.TestCase):
    def test_it_is_the_sign_off_gate_reduction(self) -> None:
        document = load_spec(FIXTURES / "foreign" / "patient-context.yaml")
        self.assertEqual("sha256:" + canonical_sha256(document), so.content_version(document, "approved"))

    def test_keys_are_read_as_written(self) -> None:
        text = canonical_text(load_spec(FIXTURES / "clean" / "toy-light.yaml"))
        self.assertIn('"on":"SwitchOn"', text)
        self.assertIn('"states":["off","on","retired"]', text)
        self.assertNotIn("true:", text)

    def test_sorted_compact_utf8_without_human_fields(self) -> None:
        document = load_spec_text("b: 1\na: {x: →}\napproval: {status: approved, required: [cso], approved_by: [SYN-X], record: SO-1}\n")
        self.assertEqual(canonical_text(document), '{"a":{"x":"→"},"approval":{"required":["cso"]},"b":1}')


if __name__ == "__main__":
    unittest.main()
