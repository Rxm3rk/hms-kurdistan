"""The CLI follows the CheckResult contract: exit 0/1/2 and, with --json, one JSON object as the last line."""

from __future__ import annotations

import contextlib
import io
import json
import subprocess
import sys
import unittest

from hmstools.safety.__main__ import main
from hmstools.safety.tests.harness import REPO, SandboxCase, hazard


def run_cli(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-I", str(REPO / "tools" / "hms.py"), "safety", *args],
        cwd=REPO,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


class CliProcessTest(unittest.TestCase):
    def test_check_json_on_the_real_repository(self) -> None:
        completed = run_cli("check", "--json")
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        last = completed.stdout.strip().splitlines()[-1]
        payload = json.loads(last)
        self.assertEqual(payload["check"], "safety")
        self.assertTrue(payload["ok"])
        self.assertEqual(sorted(payload), ["check", "counts", "errors", "ok", "warnings"])
        self.assertEqual(payload["counts"]["sis_covered"], 21)

    def test_missing_subcommand_is_a_usage_error(self) -> None:
        self.assertEqual(run_cli().returncode, 2)

    def test_unknown_option_is_a_usage_error(self) -> None:
        self.assertEqual(run_cli("check", "--bogus").returncode, 2)


class CliInProcessTest(SandboxCase):
    def test_failing_check_exits_1_with_json_last_line(self) -> None:
        self.box.mutate(lambda d: hazard(d, "HAZ-0001")["residual_risk"].update(accepted_by="SYN-TEST-SIGNER-A"))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["check", "--json"], paths=self.box.paths)
        self.assertEqual(code, 1)
        payload = json.loads(out.getvalue().strip().splitlines()[-1])
        self.assertFalse(payload["ok"])
        self.assertTrue(any("no sign-off record" in e for e in payload["errors"]))

    def test_environment_error_exits_2_with_json(self) -> None:
        paths = self.box.paths
        paths.build_prompt = self.box.root / "BUILD-PROMPT.md"
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["check", "--json"], paths=paths)
        self.assertEqual(code, 2)
        payload = json.loads(out.getvalue().strip().splitlines()[-1])
        self.assertFalse(payload["ok"])
        self.assertTrue(payload["errors"][0].startswith("environment:"))


if __name__ == "__main__":
    unittest.main()
