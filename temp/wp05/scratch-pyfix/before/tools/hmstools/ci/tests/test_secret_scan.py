"""Self-test of the secret-scan step with the project's gitleaks and .gitleaks.toml on scratch repositories.

The fake credentials are generated at run time, so no secret-shaped string is ever committed to this
repository. Skipped (and reported as skipped) only when gitleaks is not installed; the fast tier's
secret-scan step then fails on its own, so nothing is hidden.
"""

from __future__ import annotations

import os
import secrets
import shutil
import string
import subprocess
import tempfile
import unittest
from pathlib import Path

from hmstools.ci.runner import FAIL, PASS, Context
from hmstools.ci.tiers import gitleaks_exe, secret_scan

ROOT = Path(__file__).resolve().parents[4]
GITLEAKS = gitleaks_exe(ROOT)
GIT = ["git", "-c", "core.autocrlf=false", "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid",
       "-c", "commit.gpgsign=false"]


def fake_aws_credentials() -> tuple[str, str]:
    key_id = "AKIA" + "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567") for _ in range(16))
    secret = "".join(secrets.choice(string.ascii_letters + string.digits + "/+") for _ in range(40))
    return key_id, secret


@unittest.skipUnless(GITLEAKS.is_file(), "gitleaks is not installed: run sh tools/bootstrap gitleaks")
class SecretScan(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.root = base / "repo"
        self.root.mkdir()
        template = base / "git-template"
        template.mkdir()
        self.git("init", "-q", "-b", "main", f"--template={template}")
        shutil.copy(ROOT / ".gitleaks.toml", self.root / ".gitleaks.toml")
        (self.root / ".gitignore").write_text(".env\nbuild/\n", encoding="utf-8")
        (self.root / "README.md").write_text("scratch repository\n", encoding="utf-8")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "init")
        self.run_dir = base / "run"
        self.run_dir.mkdir()
        self.key_id, self.secret = fake_aws_credentials()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def git(self, *args: str) -> None:
        subprocess.run([*GIT, "-C", str(self.root), *args], capture_output=True, check=True)

    def write_credentials(self, rel: str) -> None:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"aws_access_key_id = {self.key_id}\naws_secret_access_key = {self.secret}\n", encoding="utf-8")

    def scan(self, exe: Path = GITLEAKS):
        env = {**os.environ, "HMS_CI_GITLEAKS": str(exe)}
        return secret_scan(Context(root=self.root, run_dir=self.run_dir, env=env, index=1))

    def assert_redacted(self, outcome) -> None:
        for text in [outcome.message, outcome.output]:
            self.assertNotIn(self.key_id, text)
            self.assertNotIn(self.secret, text)
        for report in self.run_dir.glob("*.json"):
            content = report.read_text(encoding="utf-8")
            self.assertNotIn(self.secret, content)

    def test_clean_repository_passes(self) -> None:
        outcome = self.scan()
        self.assertEqual(outcome.result, PASS, outcome.message)
        self.assertEqual(outcome.counts["history_findings"], 0)
        self.assertEqual(outcome.counts["working_tree_findings"], 0)
        self.assertFalse((self.run_dir / "secret-scan-tree").exists())

    def test_secret_in_history_is_found_even_after_deletion(self) -> None:
        self.write_credentials("config/creds.txt")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "oops")
        self.git("rm", "-q", "config/creds.txt")
        self.git("commit", "-q", "-m", "remove")
        outcome = self.scan()
        self.assertEqual(outcome.result, FAIL)
        self.assertGreaterEqual(outcome.counts["history_findings"], 1)
        self.assertEqual(outcome.counts["working_tree_findings"], 0)
        self.assertIn("config/creds.txt", outcome.message)
        self.assert_redacted(outcome)

    def test_untracked_secret_in_working_tree_is_found(self) -> None:
        self.write_credentials("backend/app/application.properties")
        outcome = self.scan()
        self.assertEqual(outcome.result, FAIL)
        self.assertEqual(outcome.counts["history_findings"], 0)
        self.assertGreaterEqual(outcome.counts["working_tree_findings"], 1)
        self.assertIn("backend/app/application.properties", outcome.message)
        self.assert_redacted(outcome)

    def test_git_ignored_files_are_not_part_of_the_working_tree_scan(self) -> None:
        self.write_credentials(".env")
        self.assertEqual(self.scan().result, PASS)

    def test_only_the_explicit_synthetic_fixture_path_is_allowlisted(self) -> None:
        self.write_credentials("tools/hmstools/ci/tests/fixtures/synthetic-secrets/generated.txt")
        self.assertEqual(self.scan().result, PASS)
        self.write_credentials("tools/hmstools/ci/tests/other/generated.txt")
        self.assertEqual(self.scan().result, FAIL)

    def test_missing_gitleaks_fails_with_the_bootstrap_command(self) -> None:
        outcome = self.scan(exe=self.root / "no-such-gitleaks")
        self.assertEqual(outcome.result, FAIL)
        self.assertIn("sh tools/bootstrap gitleaks", outcome.message)


if __name__ == "__main__":
    unittest.main()
