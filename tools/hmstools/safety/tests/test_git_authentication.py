"""The git authenticator for sign-off records, with git replaced by a scripted runner (no real commits)."""

from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from hmstools.safety import signoffs as so

SHA = "0123456789abcdef0123456789abcdef01234567"


def scripted(status: str = "", log: str | None = None, status_code: int = 0) -> so.GitRunner:
    def run(*args: str) -> subprocess.CompletedProcess[str]:
        if args[0] == "status":
            return subprocess.CompletedProcess(args, status_code, status, "fatal: not a git repository" if status_code else "")
        return subprocess.CompletedProcess(args, 0, log or "", "")

    return run


def commit(sig: str, body: str = "docs(safety): add sign-off record\n") -> str:
    return f"{SHA}\x1f{sig}\x1f{body}\x1e"


class GitAuthenticatorTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.record = self.root / "docs" / "safety" / "signoffs" / "SO-2099-0001.yaml"
        self.record.parent.mkdir(parents=True)
        self.record.write_text("id: SO-2099-0001\n", encoding="utf-8")

    def check(self, runner: so.GitRunner) -> list[str]:
        return so.git_authenticator(self.root, runner)(self.record)

    def test_good_signature_passes(self) -> None:
        self.assertEqual(self.check(scripted(log=commit("G"))), [])

    def test_good_signature_of_unknown_validity_passes(self) -> None:
        self.assertEqual(self.check(scripted(log=commit("U"))), [])

    def test_unsigned_commit_fails(self) -> None:
        errors = self.check(scripted(log=commit("N")))
        self.assertTrue(errors and "no valid signature (git %G? = N)" in errors[0], errors)

    def test_bad_signature_fails(self) -> None:
        self.assertTrue(self.check(scripted(log=commit("B"))))

    def test_every_commit_touching_the_record_must_be_signed(self) -> None:
        errors = self.check(scripted(log=commit("G") + commit("N", "edit\n")))
        self.assertEqual(len(errors), 1)

    def test_ai_co_author_trailer_fails(self) -> None:
        body = "docs(safety): add record\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n"
        errors = self.check(scripted(log=commit("G", body)))
        self.assertTrue(any("AI co-author trailer" in e for e in errors), errors)

    def test_human_co_author_is_fine(self) -> None:
        body = "docs(safety): add record\n\nCo-Authored-By: Jane Talbot <jane@example.org>\n"
        self.assertEqual(self.check(scripted(log=commit("G", body))), [])

    def test_uncommitted_changes_fail(self) -> None:
        errors = self.check(scripted(status=" M docs/safety/signoffs/SO-2099-0001.yaml\n", log=commit("G")))
        self.assertTrue(errors and "uncommitted changes" in errors[0], errors)

    def test_never_committed_fails(self) -> None:
        errors = self.check(scripted(log=""))
        self.assertTrue(errors and "not in any commit" in errors[0], errors)

    def test_not_a_repository_fails(self) -> None:
        errors = self.check(scripted(status_code=128))
        self.assertTrue(errors and "git cannot inspect the record" in errors[0], errors)

    def test_record_outside_the_repository_fails(self) -> None:
        with tempfile.TemporaryDirectory() as other:
            outside = Path(other) / "SO-2099-0001.yaml"
            outside.write_text("id: SO-2099-0001\n", encoding="utf-8")
            errors = so.git_authenticator(self.root, scripted(log=commit("G")))(outside)
        self.assertTrue(errors and "outside the repository" in errors[0], errors)

    def test_git_missing_fails(self) -> None:
        def missing(*_args: str) -> subprocess.CompletedProcess[str]:
            raise FileNotFoundError("git")

        errors = self.check(missing)
        self.assertTrue(errors and "git is not available" in errors[0], errors)


if __name__ == "__main__":
    unittest.main()
