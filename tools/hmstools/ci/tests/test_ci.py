"""Unit tests for tools/ci/run with fake steps (the real backend and frontend builds are never run here)."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import time
import unittest
from pathlib import Path

from hmstools.ci import counts, runner, tiers
from hmstools.ci.runner import (
    FAIL,
    NOT_BUILT,
    PASS,
    CommandStep,
    Context,
    FunctionStep,
    NotBuiltStep,
    Outcome,
    RunConfig,
    evaluate_check,
    run_tier,
)

GIT = ["git", "-c", "core.autocrlf=false", "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid",
       "-c", "commit.gpgsign=false"]
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$")
HOST = {"os": "Linux", "os_version": "fixture", "arch": "x86_64", "cpu_count": 8, "ram_gb": 32.0,
        "python": "3.12.3", "java": None, "java_runtime": None, "java_identity": None, "node": None}


def py(code: str) -> list[str]:
    return [sys.executable, "-I", "-c", textwrap.dedent(code)]


def check_json(ok: bool, code: int, **counts_) -> list[str]:
    payload = json.dumps({"check": "fake", "ok": ok, "counts": counts_, "errors": [] if ok else ["broken"], "warnings": []})
    return py(f"import sys; print('human text'); print({payload!r}); sys.exit({code})")


class Fixture(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.root = base / "repo"
        self.root.mkdir()
        self.evidence = base / "evidence"
        tmpl = base / "git-template"
        tmpl.mkdir()
        self.git("init", "-q", "-b", "wp/0.1-fixture", f"--template={tmpl}")
        (self.root / ".gitignore").write_text("build/\n", encoding="utf-8")
        (self.root / "README.md").write_text("fixture\n", encoding="utf-8")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "fixture")
        self.lines: list[str] = []

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def git(self, *args: str) -> str:
        return subprocess.run([*GIT, "-C", str(self.root), *args], capture_output=True, check=True).stdout.decode()

    def run_steps(self, steps, tier="fast", **kwargs):
        config = RunConfig(root=self.root, tier=tier, steps=steps, env=dict(__import__("os").environ),
                           evidence_dir=self.evidence, echo=self.lines.append, host=HOST, **kwargs)
        return run_tier(config)


class RunnerBehaviour(Fixture):
    def test_all_pass_gives_pass_and_exit_0(self) -> None:
        report = self.run_steps([CommandStep("a", check_json(True, 0, items=2), check_json=True),
                                 CommandStep("b", py("print('ok')"))])
        self.assertEqual(report.exit_code, 0)
        self.assertEqual(report.record["result"], PASS)
        self.assertEqual(report.record["totals"]["passed"], 2)

    def test_keeps_going_after_a_failure_and_exits_1(self) -> None:
        marker = self.root / "build" / "third-ran"
        steps = [
            CommandStep("first", py("import sys; print('boom'); sys.exit(3)")),
            NotBuiltStep("second", "Something later", "WP-9.9"),
            CommandStep("third", py(f"import pathlib; p = pathlib.Path({str(marker)!r}); p.parent.mkdir(parents=True, exist_ok=True); p.write_text('x')")),
        ]
        report = self.run_steps(steps)
        self.assertEqual(report.exit_code, 1)
        self.assertEqual([s["result"] for s in report.record["steps"]], [FAIL, NOT_BUILT, PASS])
        self.assertTrue(marker.exists())
        self.assertEqual(report.record["steps"][0]["exit_code"], 3)
        self.assertIn("boom", report.record["steps"][0]["log_tail"])
        self.assertEqual(report.record["steps"][1]["work_package"], "WP-9.9")
        self.assertIn("WP-9.9 builds it", report.record["steps"][1]["message"])
        self.assertNotIn("log_tail", report.record["steps"][2])
        self.assertEqual(report.record["totals"]["not_built"], 1)

    def test_not_built_alone_fails_the_tier(self) -> None:
        report = self.run_steps([NotBuiltStep("later", "A later thing", "WP-0.5")], tier="merge")
        self.assertEqual(report.exit_code, 1)
        self.assertEqual(report.record["result"], FAIL)

    def test_only_gives_partial_never_pass(self) -> None:
        steps = [CommandStep("a", py("print(1)")), CommandStep("b", py("import sys; sys.exit(1)"))]
        report = self.run_steps(steps, only=["a"])
        self.assertEqual(report.record["result"], "PARTIAL")
        self.assertEqual(report.exit_code, 3)
        self.assertEqual([s["name"] for s in report.record["steps"]], ["a"])
        self.assertTrue(report.evidence_path.name.endswith("-partial.json"))
        report = self.run_steps(steps, only=["b"])
        self.assertEqual(report.record["result"], "PARTIAL")
        self.assertEqual(report.exit_code, 1)

    def test_no_evidence(self) -> None:
        report = self.run_steps([CommandStep("a", py("print(1)"))], write_evidence=False)
        self.assertIsNone(report.evidence_path)
        self.assertFalse(self.evidence.exists())

    def test_timeout_kills_the_step(self) -> None:
        started = time.monotonic()
        report = self.run_steps([CommandStep("slow", py("import time; time.sleep(30)"), timeout=1)])
        self.assertLess(time.monotonic() - started, 20)
        self.assertEqual(report.record["steps"][0]["result"], FAIL)
        self.assertIn("timed out", report.record["steps"][0]["message"])

    def test_missing_program_fails_cleanly(self) -> None:
        report = self.run_steps([CommandStep("ghost", ["definitely-not-a-program-hms"])])
        self.assertEqual(report.record["steps"][0]["result"], FAIL)
        self.assertIsNone(report.record["steps"][0]["exit_code"])

    def test_crashing_function_step_fails_not_crashes(self) -> None:
        def broken(ctx: Context) -> Outcome:
            raise RuntimeError("bug")

        report = self.run_steps([FunctionStep("broken", broken, "broken")])
        self.assertEqual(report.record["steps"][0]["result"], FAIL)
        self.assertIn("RuntimeError", report.record["steps"][0]["message"])

    def test_logs_are_written_per_step(self) -> None:
        report = self.run_steps([CommandStep("talk", py("import sys; print('to stdout'); print('to stderr', file=sys.stderr)"))])
        log = self.root / report.record["steps"][0]["log"]
        text = log.read_text(encoding="utf-8")
        self.assertIn("to stdout", text)
        self.assertIn("to stderr", text)
        self.assertTrue(report.record["logs"].startswith("build/ci-logs/"))
        self.assertTrue((self.root / report.record["logs"] / "run.json").is_file())


class Evidence(Fixture):
    def test_record_has_every_contract_field(self) -> None:
        report = self.run_steps([CommandStep("a", check_json(True, 0, items=1), check_json=True)])
        record = json.loads(report.evidence_path.read_text(encoding="utf-8"))
        for key in ["schema_version", "run_id", "tier", "started_at", "finished_at", "duration_s", "git", "host", "cell",
                    "steps", "totals", "result"]:
            self.assertIn(key, record)
        self.assertRegex(record["started_at"], ISO)
        self.assertRegex(record["finished_at"], ISO)
        for key in ["sha", "short_sha", "branch", "dirty", "dirty_files"]:
            self.assertIn(key, record["git"])
        for key in ["os", "os_version", "arch", "cpu_count", "ram_gb", "python", "java", "node"]:
            self.assertIn(key, record["host"])
        step = record["steps"][0]
        for key in ["name", "command", "cwd", "started_at", "duration_s", "exit_code", "result", "counts"]:
            self.assertIn(key, step)
        self.assertRegex(step["started_at"], ISO)
        self.assertEqual(record["cell"], "none")
        self.assertEqual(record["git"]["branch"], "wp/0.1-fixture")
        self.assertEqual(len(record["git"]["sha"]), 40)

    def test_file_name_clean_and_dirty(self) -> None:
        report = self.run_steps([CommandStep("a", py("print(1)"))])
        short = self.git("rev-parse", "--short", "HEAD").strip()
        today = report.record["started_at"][:10]
        self.assertEqual(report.evidence_path.name, f"{today}-fast-{short}.json")
        self.assertFalse(report.record["git"]["dirty"])
        (self.root / "new.txt").write_text("x\n", encoding="utf-8")
        report = self.run_steps([CommandStep("a", py("print(1)"))], tier="merge")
        self.assertEqual(report.evidence_path.name, f"{today}-merge-{short}-dirty.json")
        self.assertIn("new.txt", report.record["git"]["dirty_files"])

    def test_evidence_is_lf_utf8_json(self) -> None:
        report = self.run_steps([CommandStep("a", py("print('§ Sorani کوردی')"))])
        data = report.evidence_path.read_bytes()
        self.assertNotIn(b"\r\n", data)
        json.loads(data.decode("utf-8"))

    def test_totals_sum_test_counts(self) -> None:
        def fake(ctx: Context) -> Outcome:
            return Outcome(PASS, 0, {"tests": 5, "failures": 0, "errors": 0, "skipped": 1})

        report = self.run_steps([FunctionStep("x", fake, "x"), FunctionStep("y", fake, "y")])
        totals = report.record["totals"]
        self.assertEqual((totals["tests"], totals["skipped"]), (10, 2))


# 'java -version' (stderr) of the pinned release and of another vendor's build of the same version.
TEMURIN_PINNED = (
    'openjdk version "25.0.4.1" 2026-08-18 LTS\n'
    "OpenJDK Runtime Environment Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS)\n"
    "OpenJDK 64-Bit Server VM Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS, mixed mode, sharing)\n"
)
UBUNTU_SAME_VERSION = (
    'openjdk version "25.0.4.1" 2026-08-18\n'
    "OpenJDK Runtime Environment (build 25.0.4.1+1-Ubuntu-1ubuntu124.04)\n"
)


class HostJava(unittest.TestCase):
    """The record's host block names the JDK's vendor build, not only its version (review finding R-14)."""

    ENV = {"JAVA_HOME": "/fixture/jdk"}

    def info(self, printed: str | None) -> dict:
        calls: list[list[str]] = []

        def output(argv: list[str], env: dict[str, str]) -> str | None:
            calls.append(argv)
            return None if printed is None else printed.strip()

        info = runner.java_info(self.ENV, output)
        if calls:
            self.assertEqual(Path(calls[0][0]).parent, Path("/fixture/jdk/bin"))
            self.assertEqual(calls[0][1:], ["-XX:-UsePerfData", "-version"])
        return info

    def test_the_pinned_release_is_recorded_with_its_vendor_and_build(self) -> None:
        info = self.info(TEMURIN_PINNED)
        self.assertEqual(info["java"], 'openjdk version "25.0.4.1" 2026-08-18 LTS')
        self.assertEqual(info["java_runtime"], "OpenJDK Runtime Environment Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS)")
        self.assertEqual(info["java_identity"], {
            "version": "25.0.4.1", "runtime_version": "25.0.4.1+1-LTS", "vendor_version": "Temurin-25.0.4.1+1", "pinned": True,
        })

    def test_another_build_of_the_same_version_is_told_apart(self) -> None:
        info = self.info(UBUNTU_SAME_VERSION)
        self.assertEqual(info["java"], 'openjdk version "25.0.4.1" 2026-08-18')
        self.assertEqual(info["java_runtime"], "OpenJDK Runtime Environment (build 25.0.4.1+1-Ubuntu-1ubuntu124.04)")
        self.assertEqual(info["java_identity"], {
            "version": "25.0.4.1", "runtime_version": "25.0.4.1+1-Ubuntu-1ubuntu124.04", "vendor_version": None, "pinned": False,
        })

    def test_a_line_before_the_version_does_not_hide_it(self) -> None:
        info = self.info("Picked up JAVA_TOOL_OPTIONS: -Dfixture=1\n" + TEMURIN_PINNED)
        self.assertEqual(info["java"], 'openjdk version "25.0.4.1" 2026-08-18 LTS')
        self.assertTrue(info["java_identity"]["pinned"])

    def test_no_java_gives_no_identity(self) -> None:
        empty = {"java": None, "java_runtime": None, "java_identity": None}
        self.assertEqual(self.info(None), empty)
        self.assertEqual(runner.java_info({}, lambda argv, env: self.fail("java must not run without JAVA_HOME")), empty)

    def test_the_real_host_block_has_the_java_fields(self) -> None:
        host = runner.host_info({"PATH": ""})
        for key in ["os", "os_version", "arch", "cpu_count", "ram_gb", "python", "java", "java_runtime", "java_identity", "node"]:
            self.assertIn(key, host)
        self.assertEqual((host["java"], host["java_runtime"], host["java_identity"]), (None, None, None))


class CheckContract(unittest.TestCase):
    def test_pass(self) -> None:
        out = 'text\n{"check": "x", "ok": true, "counts": {"n": 3}, "errors": [], "warnings": ["w"]}\n'
        outcome = evaluate_check(0, out, out)
        self.assertEqual(outcome.result, PASS)
        self.assertEqual(outcome.counts, {"n": 3, "errors_reported": 0, "warnings_reported": 1})

    def test_missing_json_fails(self) -> None:
        self.assertEqual(evaluate_check(0, "all good\n", "").result, FAIL)

    def test_exit_0_with_ok_false_fails(self) -> None:
        out = '{"check": "x", "ok": false, "counts": {}, "errors": ["e"], "warnings": []}'
        self.assertEqual(evaluate_check(0, out, out).result, FAIL)

    def test_exit_2_is_reported_as_environment_error(self) -> None:
        out = '{"check": "x", "ok": false, "counts": {}, "errors": ["no venv"], "warnings": []}'
        outcome = evaluate_check(2, out, out)
        self.assertEqual(outcome.result, FAIL)
        self.assertIn("environment error", outcome.message)


class Counts(unittest.TestCase):
    def test_unittest_summaries(self) -> None:
        ok = "....\n----------------------------------------------------------------------\nRan 4 tests in 0.010s\n\nOK (skipped=1)\n"
        self.assertEqual(counts.unittest_counts(ok), {"tests": 4, "failures": 0, "errors": 0, "skipped": 1, "ok": 1})
        bad = "Ran 7 tests in 1.5s\n\nFAILED (failures=2, errors=1, skipped=3)\n"
        self.assertEqual(counts.unittest_counts(bad), {"tests": 7, "failures": 2, "errors": 1, "skipped": 3, "ok": 0})
        self.assertIsNone(counts.unittest_counts("ImportError: nothing ran"))
        self.assertEqual(counts.unittest_counts("Ran 3 tests in 0.1s\r\n\r\nOK\r\n")["tests"], 3)

    def test_junit_counts_testcases(self) -> None:
        gradle = """<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="hms.kernel.ids.UuidV7Test" tests="4" skipped="1" failures="1" errors="1">
  <testcase name="a" classname="X"/>
  <testcase name="b" classname="X"><failure message="boom"/></testcase>
  <testcase name="c" classname="X"><error message="bad"/></testcase>
  <testcase name="d" classname="X"><skipped/></testcase>
</testsuite>"""
        vitest = """<testsuites name="vitest" tests="2"><testsuite name="banner.test.ts" tests="2">
  <testcase name="renders" classname="banner"/><testcase name="rtl" classname="banner"/></testsuite></testsuites>"""
        with tempfile.TemporaryDirectory() as tmp:
            a, b, c = Path(tmp) / "a.xml", Path(tmp) / "b.xml", Path(tmp) / "c.xml"
            a.write_text(gradle, encoding="utf-8")
            b.write_text(vitest, encoding="utf-8")
            c.write_text("<testsuite><broken", encoding="utf-8")
            totals = counts.junit_counts([a, b, c])
        self.assertEqual(
            totals, {"tests": 6, "failures": 1, "errors": 1, "skipped": 1, "files": 3, "unparseable_files": 1}
        )

    def test_last_json_line(self) -> None:
        self.assertIsNone(counts.last_json_line("no json"))
        self.assertIsNone(counts.last_json_line('{"not": "a check"}'))
        self.assertEqual(counts.last_json_line('x\n{"check": "c", "ok": true}\n\n')["check"], "c")


class JunitSteps(Fixture):
    def junit_step(self, write_xml: bool, code: int = 0, failures: int = 0) -> CommandStep:
        patterns = [("backend", "**/build/test-results/**/*.xml")]
        target = self.root / "backend" / "app" / "build" / "test-results" / "test" / "TEST-new.xml"
        cases = "<testcase name='t'/>" + "<testcase name='f'><failure/></testcase>" * failures
        writer = (
            f"import pathlib; p = pathlib.Path({str(target)!r}); p.parent.mkdir(parents=True, exist_ok=True); "
            f"p.write_text(\"<testsuite>{cases}</testsuite>\")"
        ) if write_xml else "pass"
        return CommandStep(
            "backend-fast", py(writer + f"\nimport sys; sys.exit({code})"),
            prepare=tiers.clear_junit(patterns), evaluate=tiers.evaluate_junit(patterns, "fake gradle"),
        )

    def stale(self) -> Path:
        stale = self.root / "backend" / "old" / "build" / "test-results" / "test" / "TEST-old.xml"
        stale.parent.mkdir(parents=True)
        stale.write_text("<testsuite>" + "<testcase name='x'/>" * 50 + "</testsuite>", encoding="utf-8")
        return stale

    def test_stale_xml_is_removed_and_counts_come_from_this_run(self) -> None:
        stale = self.stale()
        report = self.run_steps([self.junit_step(write_xml=True)])
        step = report.record["steps"][0]
        self.assertEqual(step["result"], PASS)
        self.assertEqual(step["counts"]["tests"], 1)
        self.assertFalse(stale.exists())

    def test_no_xml_from_this_run_fails(self) -> None:
        self.stale()
        report = self.run_steps([self.junit_step(write_xml=False)])
        step = report.record["steps"][0]
        self.assertEqual(step["result"], FAIL)
        self.assertIn("no JUnit XML written by this run", step["message"])

    def test_failures_in_xml_fail_even_with_exit_0(self) -> None:
        report = self.run_steps([self.junit_step(write_xml=True, failures=2)])
        self.assertEqual(report.record["steps"][0]["result"], FAIL)
        self.assertEqual(report.record["steps"][0]["counts"]["failures"], 2)

    def test_nonzero_exit_fails_with_counts(self) -> None:
        report = self.run_steps([self.junit_step(write_xml=True, code=1)])
        self.assertEqual(report.record["steps"][0]["result"], FAIL)
        self.assertEqual(report.record["steps"][0]["counts"]["tests"], 1)

    def test_backend_globs_include_the_tests_projects(self) -> None:
        # tests/invariants and tests/scenarios build outside backend/ (state-machines-and-invariants.md §7).
        stale = self.root / "tests" / "scenarios" / "build" / "test-results" / "test" / "TEST-old.xml"
        stale.parent.mkdir(parents=True)
        stale.write_text("<testsuite>" + "<testcase name='x'/>" * 50 + "</testsuite>", encoding="utf-8")
        target = self.root / "tests" / "invariants" / "build" / "test-results" / "propertyTest" / "TEST-si.xml"
        writer = (
            f"import pathlib; p = pathlib.Path({str(target)!r}); p.parent.mkdir(parents=True, exist_ok=True); "
            "p.write_text(\"<testsuite><testcase name='a'/><testcase name='b'/></testsuite>\")"
        )
        step = CommandStep(
            "backend-fast", py(writer), prepare=tiers.clear_junit(tiers.BACKEND_JUNIT),
            evaluate=tiers.evaluate_junit(tiers.BACKEND_JUNIT, "fake gradle"),
        )
        outcome = self.run_steps([step]).record["steps"][0]
        self.assertEqual(outcome["result"], PASS)
        self.assertEqual(outcome["counts"]["tests"], 2)
        self.assertFalse(stale.exists())


    def test_backend_fast_records_the_sequence_and_si_counts(self) -> None:
        # state-machines-and-invariants.md §7: the backend-fast record adds pbt_sequences, si_spec_layer_holds and
        # si_domain_not_built, read from this run's counts and SI status files (stale ones are deleted first).
        stale = self.root / "backend" / "modules" / "adt" / "build" / "pbt-counts" / "propertyTest" / "old.json"
        stale.parent.mkdir(parents=True)
        stale.write_text(json.dumps({"name": "old", "sequences": 999}), encoding="utf-8")
        writer = f"""
            import json, pathlib
            root = pathlib.Path({str(self.root)!r})
            def put(rel, data):
                p = root / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(data, encoding="utf-8")
            put("backend/x/build/test-results/test/TEST-a.xml", "<testsuite><testcase name='a'/></testsuite>")
            put("backend/modules/adt/build/pbt-counts/propertyTest/encounter.json", json.dumps({{"name": "encounter", "sequences": 1000, "steps": 9000, "result": "pass"}}))
            put("tests/invariants/build/pbt-counts/propertyTest/SI-02.json", json.dumps({{"name": "SI-02", "sequences": 1000, "steps": 7000, "result": "pass"}}))
            put("tests/invariants/build/si-status/SI-01.json", json.dumps({{"si": "SI-01", "spec_layer": "NONE", "domain_layer": "NOT-BUILT"}}))
            put("tests/invariants/build/si-status/SI-02.json", json.dumps({{"si": "SI-02", "spec_layer": "HOLDS", "domain_layer": "NOT-BUILT"}}))
        """
        step = CommandStep(
            "backend-fast", py(writer), prepare=tiers.clear_junit(tiers.BACKEND_JUNIT + tiers.PBT_COUNTS + tiers.SI_STATUS),
            evaluate=tiers.with_backend_counts(tiers.evaluate_junit(tiers.BACKEND_JUNIT, "fake gradle")),
        )
        report = self.run_steps([step])
        outcome = report.record["steps"][0]
        self.assertEqual(outcome["result"], PASS)
        self.assertFalse(stale.exists())
        self.assertEqual({k: outcome["counts"][k] for k in ("tests", "pbt_runs", "pbt_sequences", "pbt_steps", "si_status_files",
                                                            "si_spec_layer_holds", "si_domain_not_built")},
                         {"tests": 1, "pbt_runs": 2, "pbt_sequences": 2000, "pbt_steps": 16000, "si_status_files": 2,
                          "si_spec_layer_holds": 1, "si_domain_not_built": 2})
        saved = json.loads(report.evidence_path.read_text(encoding="utf-8"))
        self.assertEqual(saved["steps"][0]["counts"]["pbt_sequences"], 2000)

    def test_si_domain_layer_runs_the_real_si_status(self) -> None:
        repo = Path(__file__).resolve().parents[4]
        step = CommandStep("si-domain-layer", [sys.executable, "-I", str(repo / "tools" / "hms.py"), "statemachines", "si-status",
                                               "--require-domain", "--json"], check_json=True)
        outcome = self.run_steps([step]).record["steps"][0]
        self.assertEqual(outcome["counts"]["entries"], 21)
        if outcome["counts"]["domain_not_built"]:
            self.assertEqual(outcome["result"], FAIL)
            self.assertIn(f"{outcome['counts']['domain_not_built']} SI domain layer(s) NOT-BUILT", outcome["message"])
        else:
            self.assertEqual(outcome["result"], PASS)


class Wp05Evaluators(unittest.TestCase):
    """The nightly steps of state-machines-and-invariants.md §7, evaluated on files written here (no build runs)."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.ctx = Context(root=self.root, run_dir=self.root / "logs", env={})
        tiers.clear_junit(tiers.BACKEND_JUNIT + tiers.PBT_COUNTS + tiers.SI_STATUS)(self.ctx)

    def put(self, rel: str, data: object) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data if isinstance(data, str) else json.dumps(data), encoding="utf-8")
        return path

    def counts_file(self, name: str, sequences: object = 1_000_000, result: str = "pass", where: str = "backend/modules/adt") -> Path:
        return self.put(f"{where}/build/pbt-counts/propertyTest/{name}.json",
                        {"name": name, "machine": name, "budget": sequences, "sequences": sequences, "steps": 10, "result": result})

    def junit(self, failures: int = 0) -> None:
        cases = "<testcase name='a'/>" + "<testcase name='b'><failure/></testcase>" * failures
        self.put("backend/modules/adt/build/test-results/propertyTest/TEST-p.xml", f"<testsuite>{cases}</testsuite>")

    def property_1e6(self, code: int = 0):  # noqa: ANN201
        return tiers.evaluate_property_1e6(self.ctx, code, "", "")

    def test_property_1e6_passes_and_records_each_count(self) -> None:
        self.junit()
        self.counts_file("encounter")
        self.counts_file("SI-02", where="tests/invariants")
        outcome = self.property_1e6()
        self.assertEqual(outcome.result, PASS, outcome.message)
        self.assertEqual((outcome.counts["pbt_runs"], outcome.counts["pbt_sequences"]), (2, 2_000_000))
        self.assertEqual(sorted((r["name"], r["sequences"], r["file"]) for r in outcome.counts["pbt_sequences_per_test"]),
                         [("SI-02", 1_000_000, "tests/invariants/build/pbt-counts/propertyTest/SI-02.json"),
                          ("encounter", 1_000_000, "backend/modules/adt/build/pbt-counts/propertyTest/encounter.json")])
        self.assertIn("These are specification-layer models and SI properties", outcome.message)
        self.assertIn("KA-062", outcome.message)

    def test_property_1e6_fails_closed(self) -> None:
        for arrange, code, fragment in (
            (lambda: self.counts_file("bed", sequences=1000), 0, "1 run(s) below 1,000,000 sequences: bed (1000)"),
            (lambda: self.counts_file("bed", sequences="many"), 0, "below 1,000,000 sequences: bed (many)"),
            (lambda: self.counts_file("bed", result="fail"), 0, "1 run(s) did not pass: bed"),
            (lambda: None, 0, "no sequence counts file (build/pbt-counts) written by this run"),
            (lambda: self.put("backend/b/build/pbt-counts/propertyTest/x.json", "{"), 0, "1 counts file(s) cannot be read"),
            (lambda: self.counts_file("bed"), 1, "exited with code 1"),
        ):
            with self.subTest(fragment=fragment):
                tiers.clear_junit(tiers.BACKEND_JUNIT + tiers.PBT_COUNTS)(self.ctx)
                self.junit()
                arrange()
                outcome = self.property_1e6(code)
                self.assertEqual(outcome.result, FAIL)
                self.assertIn(fragment, outcome.message)
                self.assertIn("specification-layer models", outcome.message)
        tiers.clear_junit(tiers.BACKEND_JUNIT + tiers.PBT_COUNTS)(self.ctx)
        self.counts_file("bed")
        self.junit(failures=1)
        self.assertIn("JUnit XML reports failures", self.property_1e6().message)

    def test_stale_counts_are_ignored(self) -> None:
        self.junit()
        old = self.counts_file("old")
        os.utime(old, (time.time() - 3600, time.time() - 3600))
        outcome = self.property_1e6()
        self.assertEqual(outcome.result, FAIL)
        self.assertEqual(outcome.counts["pbt_counts_stale_ignored"], 1)
        self.assertIn("no sequence counts file", outcome.message)

    def matrix(self, results: list[str], result: str | None = None, mock_kb: tuple[str, ...] = ()) -> None:
        suites = [{"id": f"SCN-SYN-{n}", "result": r, "mock_kb": f"SCN-SYN-{n}" in mock_kb} for n, r in enumerate(results, start=1)]
        overall = result or ("PASS" if all(r == "PASS" for r in results) else "FAIL")
        self.put(tiers.PASS_MATRIX, {"result": overall, "counts": {"suites": len(suites),
                                                                   "suites_not_built": results.count("NOT-BUILT")}, "suites": suites})

    def test_scenario_suites_fail_while_any_suite_is_not_built(self) -> None:
        self.matrix(["NOT-BUILT"] * 10)
        outcome = tiers.evaluate_scenario_suites(self.ctx, 1, "", "")
        self.assertEqual(outcome.result, FAIL)
        self.assertIn("scenarioSuites exited with code 1", outcome.message)
        self.assertIn("10 suite(s) NOT-BUILT (no domain binding yet; KA-064): SCN-SYN-1, SCN-SYN-2", outcome.message)
        self.assertEqual((outcome.counts["suites"], outcome.counts["suites_not_built"], outcome.counts["suites_listed"]), (10, 10, 10))

    def test_scenario_suites_pass_only_when_every_suite_passes(self) -> None:
        self.matrix(["PASS", "PASS"], mock_kb=("SCN-SYN-1",))
        outcome = tiers.evaluate_scenario_suites(self.ctx, 0, "", "")
        self.assertEqual(outcome.result, PASS, outcome.message)
        self.assertIn("Mock-KB run, not clinical evidence: SCN-SYN-1", outcome.message)
        for results, result, code, fragment in (
            (["PASS", "FAIL"], None, 0, "1 suite(s) failing: SCN-SYN-2"),
            (["PASS", "NOT-BUILT"], None, 0, "1 suite(s) NOT-BUILT"),
            (["PASS"], "PASS", 1, "scenarioSuites exited with code 1"),
            (["PASS"], "FAIL", 0, "the matrix says 'FAIL'"),
            ([], "PASS", 0, "the matrix lists no suite"),
            (["SKIPPED"], None, 0, "suites with an unknown result: SKIPPED"),
        ):
            with self.subTest(fragment=fragment):
                self.matrix(results, result)
                outcome = tiers.evaluate_scenario_suites(self.ctx, code, "", "")
                self.assertEqual(outcome.result, FAIL)
                self.assertIn(fragment, outcome.message)

    def test_scenario_suites_need_a_matrix_from_this_run(self) -> None:
        self.assertIn("no pass matrix written by this run", tiers.evaluate_scenario_suites(self.ctx, 1, "", "").message)
        self.matrix(["PASS"])
        path = self.root / tiers.PASS_MATRIX
        os.utime(path, (time.time() - 3600, time.time() - 3600))
        self.assertIn("no pass matrix written by this run", tiers.evaluate_scenario_suites(self.ctx, 0, "", "").message)
        path.write_text("{", encoding="utf-8")
        self.assertIn("cannot be read", tiers.evaluate_scenario_suites(self.ctx, 0, "", "").message)

    def test_the_scenario_step_clears_the_old_matrix(self) -> None:
        self.matrix(["PASS"])
        step = {s.name: s for s in tiers.nightly_built()}["scenario-suites"]
        step.prepare(self.ctx)
        self.assertFalse((self.root / tiers.PASS_MATRIX).exists())


class UnittestStep(Fixture):
    def test_zero_tests_fail(self) -> None:
        step = CommandStep("py", py("import sys; print('Ran 0 tests in 0.000s\\n\\nOK', file=sys.stderr)"),
                           evaluate=tiers.evaluate_unittest)
        outcome = self.run_steps([step]).record["steps"][0]
        self.assertEqual(outcome["result"], FAIL)
        self.assertEqual(outcome["message"], "no tests ran")

    def test_counts_are_parsed(self) -> None:
        step = CommandStep("py", py("import sys; print('Ran 12 tests in 0.5s\\n\\nOK (skipped=2)', file=sys.stderr)"),
                           evaluate=tiers.evaluate_unittest)
        outcome = self.run_steps([step]).record["steps"][0]
        self.assertEqual(outcome["result"], PASS)
        self.assertEqual(outcome["counts"], {"tests": 12, "failures": 0, "errors": 0, "skipped": 2})


class Tiers(unittest.TestCase):
    ROOT = Path(__file__).resolve().parents[4]

    def test_fast_tier_steps_in_order(self) -> None:
        names = [s.name for s in tiers.tier_steps("fast", self.ROOT)]
        self.assertEqual(names, ["doctor-fast", "repo-check", "python-unit-tests", "safety-check", "state-machines-check",
                                 "backlog-check", "backend-fast", "frontend-fast", "secret-scan"])
        self.assertFalse(any(isinstance(s, NotBuiltStep) for s in tiers.tier_steps("fast", self.ROOT)))

    def test_fast_commands_match_the_contract(self) -> None:
        steps = {s.name: s for s in tiers.tier_steps("fast", self.ROOT)}
        self.assertEqual(steps["backend-fast"].argv[:5], ["sh", "backend/gradlew", "-p", "backend", "fastTier"])
        self.assertIn("-Phms.pbt.sequences=1000", steps["backend-fast"].argv)
        self.assertEqual(steps["frontend-fast"].argv[1:], ["pnpm", "run", "fast"])
        self.assertEqual(steps["frontend-fast"].cwd, "frontend")
        self.assertEqual(steps["python-unit-tests"].argv[1:],
                         ["-I", "-m", "unittest", "discover", "-s", "tools", "-t", "tools", "-p", "test_*.py"])
        self.assertEqual(steps["state-machines-check"].argv, ["sh", "tools/hms", "statemachines", "check", "--json"])
        for name in ["doctor-fast", "repo-check", "safety-check", "state-machines-check", "backlog-check"]:
            self.assertIn("--json", steps[name].argv)
            self.assertTrue(steps[name].check_json)

    def test_other_tiers_start_with_fast_and_fail_closed(self) -> None:
        fast = [s.name for s in tiers.tier_steps("fast", self.ROOT)]
        built_nightly = {"property-1e6", "si-domain-layer", "scenario-suites"}  # WP-0.5, spec §7
        for tier in ["merge", "nightly", "release"]:
            steps = tiers.tier_steps(tier, self.ROOT)
            self.assertEqual([s.name for s in steps[: len(fast)]], fast)
            later = steps[len(fast):]
            self.assertTrue(later)
            for step in later:
                if tier == "nightly" and step.name in built_nightly:
                    self.assertIsInstance(step, CommandStep)
                    continue
                self.assertIsInstance(step, NotBuiltStep)
                if step.name == "property-channels":
                    self.assertEqual(step.work_package, "each channel adapter's work package (UI command layer, API, mobile sync, "
                                                        "HL7 inbound, migration loader, plugin effects)")
                else:
                    self.assertRegex(step.work_package, r"^WP-\d+\.\d+[a-z]?\b")
            names = [s.name for s in steps]
            self.assertEqual(len(names), len(set(names)), tier)

    def test_nightly_wp05_steps_in_section_19_1_order(self) -> None:
        fast = len(tiers.tier_steps("fast", self.ROOT))
        steps = tiers.tier_steps("nightly", self.ROOT)[fast:]
        self.assertEqual([s.name for s in steps][:5], ["cell-check", "property-1e6", "si-domain-layer", "property-channels", "scenario-suites"])
        by_name = {s.name: s for s in steps}
        self.assertEqual(by_name["property-1e6"].argv, ["sh", "backend/gradlew", "-p", "backend", "propertyTest",
                                                        "-Phms.pbt.sequences=1000000", "--no-build-cache", "--console=plain"])
        self.assertGreaterEqual(by_name["property-1e6"].timeout, 4 * 3600)
        self.assertEqual(by_name["si-domain-layer"].argv, ["sh", "tools/hms", "statemachines", "si-status", "--require-domain", "--json"])
        self.assertTrue(by_name["si-domain-layer"].check_json)
        self.assertEqual(by_name["scenario-suites"].argv, ["sh", "backend/gradlew", "-p", "backend", ":tests:scenarios:scenarioSuites",
                                                           "--console=plain"])
        self.assertNotIn("WP-0.5", {s.work_package for s in steps if isinstance(s, NotBuiltStep)})  # the replaced rows are gone
        self.assertEqual(tiers.PASS_MATRIX, "tests/scenarios/build/reports/scenarios/pass-matrix.json")

    def test_section_19_1_contents_are_listed(self) -> None:
        merge = {s.name for s in tiers.tier_steps("merge", self.ROOT)}
        for name in ["integration-tests", "contract-openapi", "contract-asyncapi", "contract-hl7v2", "contract-fhir",
                     "migration-n-1", "e2e-smoke", "axe", "rtl-visual-diffs", "licence-scan-ort", "vulnerability-scan",
                     "container-scan", "sbom", "coverage-gates", "mutation-tests"]:
            self.assertIn(name, merge)
        nightly = {s.name for s in tiers.tier_steps("nightly", self.ROOT)}
        for name in ["property-1e6", "si-domain-layer", "property-channels", "scenario-suites", "e2e-full", "golden-image-print",
                     "scaled-day-dev-cell", "day-300-bed", "day-1000-bed", "chaos", "restore-test", "parser-fuzzing"]:
            self.assertIn(name, nightly)
        release = {s.name for s in tiers.tier_steps("release", self.ROOT)}
        for name in ["signed-images", "helm-charts", "tier2-sidecars", "desktop-shell", "mobile-builds", "sbom-vex",
                     "slsa-provenance", "cosign-signatures", "release-evidence-pack", "release-notes", "offline-media"]:
            self.assertIn(name, release)
        self.assertTrue(merge < release)


if __name__ == "__main__":
    unittest.main()
