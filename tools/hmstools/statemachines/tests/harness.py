"""Test helpers: a scratch repository root for tools/hms statemachines.

The sandbox holds docs/specs/state-machines (with the real schema), an empty docs/safety/signoffs and whatever
a test adds; it reads the real, read-only BUILD-PROMPT.md (the §5.2 module list) and the real hazard log. The
toy machines of the fixtures get generation targets in the sandbox only. Nothing here writes to the repository.
"""

from __future__ import annotations

import os
import shutil
import stat
import tempfile
import unittest
from pathlib import Path

from hmstools.common import CheckResult, write_text_lf
from hmstools.statemachines import approval
from hmstools.statemachines.check import Paths, run_check, run_generate
from hmstools.statemachines.loader import load_spec
from hmstools.statemachines.targets import TARGETS, Target

REPO = Path(__file__).resolve().parents[4]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
REAL_SPECS = REPO / "docs" / "specs" / "state-machines"

TOY_TARGETS = {
    "toy-light": Target("toy-light", "adt", "backend/modules/adt", "hms.adt.domain.toylight"),
    "toy-wrapping-demonstration": Target(
        "toy-wrapping-demonstration", "medications", "backend/modules/medications", "hms.medications.domain.toywrappingdemonstration"
    ),
}


def _writable_then_retry(function, path, _error) -> None:  # noqa: ANN001 - shutil.rmtree's onexc
    """git writes its objects read-only, which Windows will not delete until the flag is cleared."""
    os.chmod(path, stat.S_IWRITE)
    function(path)


class Sandbox:
    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="hms-statemachines-test-")
        self.root = Path(self._tmp.name)
        self.toy_targets = True
        self.reset()

    def reset(self) -> None:
        for child in self.root.iterdir():
            if child.is_dir():
                shutil.rmtree(child, onexc=_writable_then_retry)
            else:
                child.unlink()
        self.specs.mkdir(parents=True)
        shutil.copy2(REAL_SPECS / "state-machine.schema.json", self.specs / "state-machine.schema.json")
        (self.root / "docs" / "safety" / "signoffs").mkdir(parents=True)
        self.toy_targets = True

    def close(self) -> None:
        self._tmp.cleanup()

    @property
    def specs(self) -> Path:
        return self.root / "docs" / "specs" / "state-machines"

    @property
    def paths(self) -> Paths:
        paths = Paths.for_root(self.root)
        paths.build_prompt = REPO / "BUILD-PROMPT.md"
        paths.hazard_log = REPO / "docs" / "safety" / "hazard-log.yaml"
        if self.toy_targets:
            paths.targets = {**TARGETS, **TOY_TARGETS}
        return paths

    def add(self, directory: str, *names: str) -> None:
        """Copy fixture files (all of a fixture directory if no names are given) into the specs directory."""
        source = FIXTURES / directory
        for path in sorted(source.iterdir()) if not names else [source / n for n in names]:
            if path.suffix in (".yaml", ".md"):
                shutil.copy2(path, self.specs / path.name)

    def write(self, rel: str, text: str) -> Path:
        path = self.root / rel
        write_text_lf(path, text)
        return path

    def install_kotlin(self, machine: str) -> None:
        """The hand-written Kotlin rule 12 looks for: the toy-light fixture files, or for another toy a generated
        Guards object and a GuardsTest naming every predicate."""
        target = TOY_TARGETS[machine]
        main = f"{target.project}/src/main/kotlin/{target.package_path}/{target.prefix}Guards.kt"
        test = f"{target.project}/src/test/kotlin/{target.package_path}/{target.prefix}GuardsTest.kt"
        if machine == "toy-light":
            self.write(main, (FIXTURES / "kotlin" / "ToyLightGuards.kt.txt").read_text(encoding="utf-8"))
            self.write(test, (FIXTURES / "kotlin" / "ToyLightGuardsTest.kt.txt").read_text(encoding="utf-8"))
            return
        predicates = list(load_spec(self.specs / f"{machine}.yaml")["predicates"])
        p = target.prefix
        body = "\n".join(f"    override fun {n}(facts: {p}Facts): Boolean = true" for n in predicates)
        self.write(main, f"package {target.package}\n\nobject {p}Guards : {p}Predicates {{\n{body}\n}}\n")
        tests = "\n".join(f'        test("{n} holds") {{ }}' for n in predicates)
        self.write(test, f"package {target.package}\n\nclass {p}GuardsTest :\n    FunSpec({{\n{tests}\n    }})\n")

    def clean_set(self) -> None:
        """Both toys, their Kotlin and their generated files, and the foreign patient-context spec."""
        self.add("clean")
        self.add("foreign")
        for machine in TOY_TARGETS:
            self.install_kotlin(machine)
        generated = run_generate(self.paths)
        assert generated.ok, generated.errors

    def check(self, only: str | None = None, rule_11_only: bool = False, git: approval.GitRunner = approval.run_git) -> CheckResult:
        return run_check(self.paths, only=only, rules_11_only=rule_11_only, git=git)

    def generate(self, only: str | None = None) -> CheckResult:
        return run_generate(self.paths, only=only)


class SandboxCase(unittest.TestCase):
    """One sandbox per test class, emptied before every test."""

    box: Sandbox

    @classmethod
    def setUpClass(cls) -> None:
        cls.box = Sandbox()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.box.close()

    def setUp(self) -> None:
        self.box.reset()

    def assertFailsWith(self, result: CheckResult, *fragments: str) -> None:
        self.assertFalse(result.ok, "expected the check to fail")
        joined = "\n".join(result.errors)
        for fragment in fragments:
            self.assertIn(fragment, joined)

    def assertPasses(self, result: CheckResult) -> None:
        self.assertTrue(result.ok, "\n".join(result.errors))
