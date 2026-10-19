"""Rule 13 of spec §2.1 (KA-013) in throwaway git repositories, rule 9's deferral to the safety gate, and the
canonical content of §2.2.

Each test starts from a scratch repository in a temporary directory; nothing touches the real repository or the
user's git configuration (GIT_CONFIG_NOSYSTEM and GIT_CONFIG_GLOBAL point at an empty file while the tests run,
and the identity is set in the scratch repository). The starting repositories (no commit yet, the spec committed,
the spec and its record committed) are built once per class and copied for each test, which spares each test the
git processes that build them. The sign-off records are synthetic (SYN- names) and are only test data: no record
is ever written to docs/safety/signoffs of the repository.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from hmstools.safety import signoffs as so
from hmstools.statemachines import approval
from hmstools.statemachines.loader import canonical_sha256, canonical_text, load_spec, load_spec_text
from hmstools.statemachines.tests.harness import FIXTURES, REPO, SandboxCase, _writable_then_retry

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

SPEC = "docs/specs/state-machines/toy-light.yaml"
FRESH, SPEC_COMMITTED, SPEC_AND_RECORD = "no commit", "spec committed", "spec and record committed"


def _git(root: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise AssertionError(f"git {' '.join(args)}: {done.stderr}")
    return done.stdout


def _empty_directory(root: Path) -> None:
    for child in root.iterdir():
        if child.is_dir():
            shutil.rmtree(child, onexc=_writable_then_retry)
        else:
            child.unlink()


class Rule13(SandboxCase):
    templates: Path

    @classmethod
    def setUpClass(cls) -> None:
        if shutil.which("git") is None:
            raise unittest.SkipTest("git is not on PATH on this host")
        super().setUpClass()
        cls._templates_dir = tempfile.TemporaryDirectory(prefix="hms-statemachines-rule13-")
        cls.templates = Path(cls._templates_dir.name)
        empty = cls.templates / "gitconfig"
        empty.write_text("", encoding="utf-8")
        cls._environment = mock.patch.dict(os.environ, {"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": str(empty)})
        cls._environment.start()
        hooks = cls.templates / "git-template"  # no sample hooks: less to copy per test
        hooks.mkdir()
        box = cls.box
        box.reset()
        _git(box.root, "init", "-q", f"--template={hooks}")
        for key, value in (("user.name", "SYN-TEST-SIGNER"), ("user.email", "syn-test-signer@example.invalid"),
                           ("commit.gpgsign", "false"), ("core.autocrlf", "false")):
            _git(box.root, "config", key, value)
        box.add("clean", "toy-light.yaml", "toy-light.md")
        shutil.copytree(box.root, cls.templates / FRESH)
        _git(box.root, "add", "-A")
        _git(box.root, "commit", "-q", "-m", "spec")
        shutil.copytree(box.root, cls.templates / SPEC_COMMITTED)
        cls._restore(FRESH)
        box.write("docs/safety/signoffs/SO-2026-0901.yaml", RECORD.format(id="SO-2026-0901", subject="toy-light", version=1))
        _git(box.root, "add", "-A")
        _git(box.root, "commit", "-q", "-m", "spec and record")
        shutil.copytree(box.root, cls.templates / SPEC_AND_RECORD)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._environment.stop()
        shutil.rmtree(cls.templates, onexc=_writable_then_retry)
        super().tearDownClass()

    @classmethod
    def _restore(cls, template: str) -> None:
        _empty_directory(cls.box.root)
        shutil.copytree(cls.templates / template, cls.box.root, dirs_exist_ok=True)

    def setUp(self) -> None:
        super().setUp()
        self.spec = self.box.specs / "toy-light.yaml"

    def start(self, template: str) -> None:
        """Begin from one of the repositories built once for the class."""
        self._restore(template)

    def git(self, *args: str) -> str:
        return _git(self.box.root, *args)

    def commit(self, message: str) -> None:
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)

    def record(self, record_id: str = "SO-2026-0901", subject: str = "toy-light", version: object = 1) -> None:
        self.box.write(f"docs/safety/signoffs/{record_id}.yaml", RECORD.format(id=record_id, subject=subject, version=version))

    def edit(self, old: str, new: str) -> None:
        text = self.spec.read_text(encoding="utf-8")
        self.assertIn(old, text)
        self.spec.write_text(text.replace(old, new), encoding="utf-8", newline="\n")

    def rule_13(self, result=None) -> list[str]:  # noqa: ANN001 - a CheckResult
        result = result or self.box.check(only="toy-light")
        return [e for e in result.errors if "rule 13" in e]

    def test_the_templates_are_the_states_they_name(self) -> None:
        self.start(SPEC_AND_RECORD)
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.assertEqual(self.git("log", "--format=%s").split(), ["spec", "and", "record"])
        self.assertEqual(self.git("ls-files").split(), ["docs/safety/signoffs/SO-2026-0901.yaml", "docs/specs/state-machines/state-machine.schema.json",
                                                         "docs/specs/state-machines/toy-light.md", SPEC])
        self.start(SPEC_COMMITTED)
        self.assertEqual(self.git("log", "--format=%s").split(), ["spec"])
        self.assertFalse((self.box.root / "docs/safety/signoffs/SO-2026-0901.yaml").exists())
        self.start(FRESH)
        self.assertNotEqual(subprocess.run(["git", "-C", str(self.box.root), "rev-parse", "HEAD"], capture_output=True).returncode, 0)

    def test_unchanged_spec_keeps_its_record(self) -> None:
        self.start(SPEC_AND_RECORD)
        result = self.box.check(only="toy-light")
        self.assertEqual(self.rule_13(result), [])
        self.assertEqual(result.counts["approval_records"], 1)

    def test_a_content_change_without_a_version_bump_fails(self) -> None:
        self.start(SPEC_AND_RECORD)
        self.edit("mains or generator power is present", "mains power is present")
        errors = self.rule_13()
        self.assertEqual(len(errors), 1)
        self.assertIn("rule 13: content changed since approval record SO-2026-0901 without a version bump", errors[0])

    def test_a_later_record_is_compared_with_the_spec_when_it_was_added(self) -> None:
        self.start(SPEC_COMMITTED)
        self.edit("mains or generator power is present", "mains power is present")
        self.record()
        self.commit("changed spec and its record")
        self.assertEqual(self.rule_13(), [])

    def test_a_version_bump_releases_the_old_record(self) -> None:
        self.start(SPEC_AND_RECORD)
        self.edit("mains or generator power is present", "mains power is present")
        self.edit("version: 1", "version: 2")
        result = self.box.check(only="toy-light")
        self.assertEqual(self.rule_13(result), [])
        self.assertEqual(result.counts["approval_records"], 0)

    def test_comments_layout_and_human_fields_do_not_count(self) -> None:
        self.start(SPEC_AND_RECORD)
        self.edit("states: [off, on, retired]", "# a comment\nstates:\n  - off\n  - on\n  - retired")
        self.edit("approved_by: [], record: null", "approved_by: [SYN-TEST-SIGNER], record: SO-2026-0901")
        self.edit("status: requested", "status: approved")
        self.assertEqual(self.rule_13(), [])

    def test_the_required_roles_count(self) -> None:
        self.start(SPEC_AND_RECORD)
        self.edit("required: [cso]", "required: [cso, nurse-panel]")
        self.assertIn("content changed since approval record SO-2026-0901", "\n".join(self.rule_13()))

    def test_record_not_committed(self) -> None:
        self.start(SPEC_COMMITTED)
        self.record()
        self.assertIn("approval record SO-2026-0901 (docs/safety/signoffs/SO-2026-0901.yaml) for toy-light version 1: record not committed",
                      "\n".join(self.rule_13()))

    def test_record_added_before_the_spec(self) -> None:
        self.start(FRESH)
        self.record()
        self.git("add", "docs/safety/signoffs")
        self.git("commit", "-q", "-m", "record first")
        self.commit("spec later")
        self.assertIn("docs/specs/state-machines/toy-light.yaml did not exist at commit", "\n".join(self.rule_13()))

    def test_a_record_removed_and_added_again_is_checked_at_every_addition(self) -> None:
        self.start(SPEC_AND_RECORD)
        (self.box.root / "docs/safety/signoffs/SO-2026-0901.yaml").unlink()
        self.commit("record removed")
        self.edit("mains or generator power is present", "mains power is present")
        self.record()
        self.commit("changed spec, record again")
        self.assertIn("content changed since approval record SO-2026-0901", "\n".join(self.rule_13()))

    def test_records_of_other_subjects_or_versions_do_not_apply(self) -> None:
        self.start(FRESH)
        self.record("SO-2026-0902", subject="bed")
        self.record("SO-2026-0903", version=2)
        self.record("SO-2026-0904", version='"sha256:' + "0" * 64 + '"')
        self.commit("spec and records")
        self.edit("mains or generator power is present", "mains power is present")
        self.assertEqual(self.rule_13(), [])

    def test_an_unreadable_record_fails_closed(self) -> None:
        self.start(FRESH)
        self.box.write("docs/safety/signoffs/SO-2026-0905.yaml", "id: [")
        self.commit("broken record")
        self.assertIn("rule 13: docs/safety/signoffs/SO-2026-0905.yaml cannot be read", "\n".join(self.box.check().errors))

    def test_no_history_fails_closed(self) -> None:
        self.start(FRESH)
        self.record()  # a repository without commits: git log fails
        self.assertIn("the git history cannot be read", "\n".join(self.rule_13()))

    def test_a_shallow_clone_fails_when_a_record_applies(self) -> None:
        # py-03: in a shallow clone the boundary commit looks as if it added every file, so the record would be
        # compared with today's spec and a content change would pass.
        self.start(SPEC_AND_RECORD)
        self.edit("mains or generator power is present", "mains power is present")
        self.commit("changed spec, no bump")
        self.assertIn("content changed since approval record SO-2026-0901", "\n".join(self.rule_13()))
        clone = self.templates / f"shallow-{self.id().rsplit('.', 1)[-1]}"
        subprocess.run(["git", "clone", "-q", "--depth", "1", self.box.root.as_uri(), str(clone)], check=True, capture_output=True)
        self.addCleanup(shutil.rmtree, clone, onexc=_writable_then_retry)
        paths = self.box.paths
        paths.root, paths.specs_dir, paths.signoffs_dir = clone, clone / "docs/specs/state-machines", clone / "docs/safety/signoffs"
        paths.schema = paths.specs_dir / "state-machine.schema.json"
        from hmstools.statemachines.check import run_check

        errors = [e for e in run_check(paths, only="toy-light").errors if "rule 13" in e]
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("rule 13: shallow clone: the content each approval record approved cannot be read (SO-2026-0901 for toy-light "
                      "version 1); fetch the full history", errors[0])


class Rule13Git(unittest.TestCase):
    """Rule 13 against a scripted git (no repository): the shallow probe and the hardened git settings."""

    def setUp(self) -> None:
        text = (FIXTURES / "clean" / "toy-light.yaml").read_text(encoding="utf-8")
        self.canonical = canonical_text(load_spec_text(text))
        self.text = text
        self.records = [approval.Record(Path("SO-2026-0901.yaml"), "docs/safety/signoffs/SO-2026-0901.yaml",
                                        {"id": "SO-2026-0901", "subject": "toy-light", "subject_version": 1})]
        self.calls: list[list[str]] = []

    def git(self, shallow: str, rev_parse_code: int = 0):  # noqa: ANN201 - a GitRunner
        def run(_root: Path, args: list[str]) -> tuple[int, str, str]:
            self.calls.append(args)
            if args[0] == "rev-parse":
                return rev_parse_code, shallow, "fatal: not a git repository" if rev_parse_code else ""
            if args[0] == "log":
                return 0, "a" * 40 + "\n", ""
            return 0, self.text, ""  # show: the spec as it was is the spec as it is
        return run

    def test_a_shallow_repository_fails(self) -> None:
        errors, applying = approval.rule_13("toy-light", 1, SPEC, self.canonical, self.records, Path("."), self.git("true\n"))
        self.assertEqual(applying, 1)
        self.assertEqual(errors, ["rule 13: shallow clone: the content each approval record approved cannot be read (SO-2026-0901 "
                                  "for toy-light version 1); fetch the full history"])
        self.assertEqual(self.calls, [["rev-parse", "--is-shallow-repository"]])

    def test_an_unknown_answer_fails_closed_and_a_full_clone_passes(self) -> None:
        errors, _ = approval.rule_13("toy-light", 1, SPEC, self.canonical, self.records, Path("."), self.git("--is-shallow-repository\n"))
        self.assertIn("shallow clone", errors[0])
        errors, _ = approval.rule_13("toy-light", 1, SPEC, self.canonical, self.records, Path("."), self.git("false\n"))
        self.assertEqual(errors, [])

    def test_a_failing_probe_fails(self) -> None:
        errors, _ = approval.rule_13("toy-light", 1, SPEC, self.canonical, self.records, Path("."), self.git("", 128))
        self.assertEqual(errors, ["rule 13: 1 approval record(s) apply to toy-light version 1, but the git history cannot be read: "
                                  "fatal: not a git repository"])

    def test_no_applying_record_asks_git_nothing(self) -> None:
        errors, applying = approval.rule_13("toy-light", 2, SPEC, self.canonical, self.records, Path("."), self.git("true\n"))
        self.assertEqual((errors, applying, self.calls), ([], 0, []))

    def test_git_runs_with_the_safety_gate_settings(self) -> None:
        done = subprocess.CompletedProcess([], 0, b"false\n", b"")
        with mock.patch("hmstools.statemachines.approval.subprocess.run", return_value=done) as run:
            self.assertEqual(approval.run_git(Path("repo"), ["rev-parse", "--is-shallow-repository"]), (0, "false\n", ""))
        argv, env = run.call_args.args[0], run.call_args.kwargs["env"]
        self.assertEqual(argv[:6], ["git", "--no-replace-objects", "-c", "core.commitGraph=false", "-c", "core.quotepath=off"])
        self.assertEqual(argv[6:], ["-C", "repo", "rev-parse", "--is-shallow-repository"])
        self.assertEqual((env["GIT_GRAFT_FILE"], env["GIT_NO_REPLACE_OBJECTS"]), (os.devnull, "1"))


class Rule9Gate(SandboxCase):
    """py-06: rule 9 reads the approval block as requested, [] and null until the safety gate accepts a sign-off
    record for each filled field (spec §2.1 rule 9, §1.1); the gate's own matching and authentication decide."""

    FILLED = (("approved_by: [], record: null", "approved_by: [SYN-TEST-SIGNER], record: SO-2026-0901"),
              ("status: requested", "status: approved"))

    def setUp(self) -> None:
        super().setUp()
        self.box.add("clean", "toy-light.yaml", "toy-light.md")
        shutil.copy2(REPO / "docs/safety/signoffs/signoff.schema.json", self.box.root / "docs/safety/signoffs/signoff.schema.json")
        spec = self.box.specs / "toy-light.yaml"
        text = spec.read_text(encoding="utf-8")
        for old, new in self.FILLED:
            self.assertIn(old, text)
            text = text.replace(old, new)
        spec.write_text(text, encoding="utf-8", newline="\n")

    def rule_9(self, authenticate=None) -> list[str]:  # noqa: ANN001
        paths = self.box.paths
        paths.authenticate = authenticate
        from hmstools.statemachines.check import run_check

        return [e for e in run_check(paths, only="toy-light").errors if "rule 9" in e]

    def add_record(self, **changes: object) -> None:
        values = {"id": "SO-2026-0901", "subject": "toy-light", "version": 1, **changes}
        self.box.write(f"docs/safety/signoffs/{values['id']}.yaml", RECORD.format(**values))

    def test_filled_fields_without_a_record_fail(self) -> None:
        errors = "\n".join(self.rule_9(lambda record: []))
        self.assertIn("rule 9: approval.status is 'approved'", errors)
        self.assertIn("rule 9: approval.approved_by is ['SYN-TEST-SIGNER']", errors)
        self.assertIn("rule 9: approval.record is 'SO-2026-0901'", errors)
        self.assertIn("rule 9: the safety gate backs no filled approval field with a sign-off record: docs/specs/state-machines/"
                      "toy-light.yaml: toy-light approval.approved_by is filled", errors)

    def test_a_record_the_gate_accepts_releases_the_human_fields(self) -> None:
        self.add_record()
        self.assertEqual(self.rule_9(lambda record: []), [])

    def test_a_record_the_gate_does_not_authenticate_keeps_them_failing(self) -> None:
        self.add_record()
        errors = "\n".join(self.rule_9(lambda record: [f"{record.id}: no good signature (synthetic test)"]))
        self.assertIn("rule 9: approval.status is 'approved'", errors)
        self.assertIn("SO-2026-0901: no good signature (synthetic test)", errors)

    def test_a_record_for_another_version_keeps_them_failing(self) -> None:
        self.add_record(version=2)
        self.assertIn("are for another version of toy-light, whose current version is '1'", "\n".join(self.rule_9(lambda record: [])))

    def test_the_gate_authentication_fails_closed_here(self) -> None:
        # The default is the gate's git authentication: no repository and no allowed signer, so no record counts.
        self.add_record()
        errors = self.rule_9()
        self.assertTrue(any("rule 9: approval.status is 'approved'" in e for e in errors), errors)

    def test_no_filled_field_never_reads_the_records(self) -> None:
        self.box.add("clean", "toy-light.yaml")
        with mock.patch.object(approval, "gate_verdict", side_effect=AssertionError("read")):
            self.assertEqual(self.rule_9(), [])


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

    def test_crlf_and_bom_give_the_same_content(self) -> None:
        text = (FIXTURES / "clean" / "toy-light.yaml").read_text(encoding="utf-8")
        crlf = text.replace("\n", "\r\n")
        self.assertEqual(canonical_text(load_spec_text(crlf)), canonical_text(load_spec_text(text)))
        self.assertEqual(canonical_text(load_spec_text("﻿" + crlf)), canonical_text(load_spec_text(text)))


if __name__ == "__main__":
    unittest.main()
