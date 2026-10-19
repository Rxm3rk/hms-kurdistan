"""The CLI contract (hmstools.common: the last stdout line is one CheckResult JSON object) and the reading rules."""

from __future__ import annotations

import contextlib
import io
import json
import unittest

from hmstools.statemachines.__main__ import SUBCOMMANDS, main
from hmstools.statemachines.loader import SpecLoadError, load_spec_text
from hmstools.statemachines.tests.harness import SandboxCase


class Cli(SandboxCase):
    def run_main(self, *argv: str) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            try:
                code = main(list(argv), paths=self.box.paths)
            except SystemExit as exc:  # argparse usage errors
                code = int(exc.code or 0)
        return code, out.getvalue(), err.getvalue()

    def last_json(self, stdout: str) -> dict:
        return json.loads(stdout.strip().splitlines()[-1])

    def test_check_json_passes(self) -> None:
        self.box.clean_set()
        code, out, _ = self.run_main("check", "--json")
        self.assertEqual(code, 0)
        result = self.last_json(out)
        self.assertEqual(result["check"], "state-machines")
        self.assertTrue(result["ok"])
        self.assertEqual(result["counts"]["specs"], 3)
        self.assertEqual(result["counts"]["approval_fields_filled"], 0)

    def test_check_json_fails_with_exit_1(self) -> None:
        self.box.add("violations/rule-08-proposed")
        code, out, _ = self.run_main("check", "--json", "--machine", "toy-light")
        self.assertEqual(code, 1)
        result = self.last_json(out)
        self.assertFalse(result["ok"])
        self.assertTrue(any("rule 8" in e for e in result["errors"]))

    def test_generate_and_generate_check(self) -> None:
        self.box.add("clean", "toy-light.yaml", "toy-light.md")
        code, out, _ = self.run_main("generate", "--check", "--json")
        self.assertEqual(code, 1)
        self.assertIn("is missing", out)
        code, out, _ = self.run_main("generate", "--json")
        self.assertEqual(code, 0)
        self.assertEqual(self.last_json(out)["counts"]["generated_files_written"], 2)
        code, out, _ = self.run_main("generate", "--check", "--json")
        self.assertEqual(code, 0)
        self.assertEqual(self.last_json(out)["check"], "state-machines-generate")

    def test_environment_problem_exits_2(self) -> None:
        (self.box.specs / "state-machine.schema.json").unlink()
        code, out, _ = self.run_main("check", "--json")
        self.assertEqual(code, 2)
        self.assertIn("environment:", self.last_json(out)["errors"][0])

    def test_usage_errors_exit_2(self) -> None:
        self.assertEqual(self.run_main()[0], 2)
        self.assertEqual(self.run_main("si-statuz", "--json")[0], 2)
        self.assertEqual(self.run_main("si-status", "--machine", "x")[0], 2)
        # si-status is the subcommand of the nightly step si-domain-layer (spec §7; test_si_status.py).
        self.assertEqual(sorted(SUBCOMMANDS), ["check", "generate", "si-status"])


class ReadingRules(unittest.TestCase):
    def test_on_off_yes_no_stay_strings(self) -> None:
        self.assertEqual(
            load_spec_text("transitions: [{from: off, on: SwitchOn, to: on}]\nother: [yes, no, y, n, true, false]\n"),
            {"transitions": [{"from": "off", "on": "SwitchOn", "to": "on"}], "other": ["yes", "no", "y", "n", True, False]},
        )

    def test_other_yaml_1_1_booleans_fail(self) -> None:
        for value in ("True", "FALSE", "Yes", "NO", "On", "OFF", "Y", "N"):
            with self.subTest(value=value), self.assertRaisesRegex(SpecLoadError, "reads as a boolean"):
                load_spec_text(f"a: {value}\n")
        self.assertEqual(load_spec_text('a: "On"\n'), {"a": "On"})

    def test_dates_stay_strings(self) -> None:
        self.assertEqual(load_spec_text("a: 2026-10-19\n"), {"a": "2026-10-19"})

    def test_duplicate_merge_and_non_string_keys_fail(self) -> None:
        for text, message in (("a: 1\na: 2\n", "duplicate key 'a'"), ("b: &x {a: 1}\nc: {<<: *x}\n", "merge keys"),
                              ("1: a\n", "not a string")):
            with self.subTest(text=text), self.assertRaisesRegex(SpecLoadError, message):
                load_spec_text(text)


if __name__ == "__main__":
    unittest.main()
