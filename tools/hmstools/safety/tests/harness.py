"""Test helpers: a sandbox repository holding a copy (or a mutation) of the real hazard log.

The sandbox reads the real, read-only BUILD-PROMPT.md as its plan of record, and copies the real
schemas, so every adversarial test starts from the real seeded log and changes one thing.
"""

from __future__ import annotations

import copy
import shutil
import tempfile
import unittest
from pathlib import Path
from typing import Any, Callable

import yaml

from hmstools.common import CheckResult
from hmstools.safety import signoffs as so
from hmstools.safety.check import SafetyPaths, run_check

REPO = Path(__file__).resolve().parents[4]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
REAL_SAFETY = REPO / "docs" / "safety"

_LOADER = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
_DUMPER = getattr(yaml, "CSafeDumper", yaml.SafeDumper)
_REAL_LOG: dict[str, Any] | None = None


def real_log() -> dict[str, Any]:
    """A deep copy of the real hazard log, as loaded data."""
    global _REAL_LOG
    if _REAL_LOG is None:
        with open(REAL_SAFETY / "hazard-log.yaml", encoding="utf-8") as handle:
            _REAL_LOG = yaml.load(handle, Loader=_LOADER)  # noqa: S506 - safe loader
    return copy.deepcopy(_REAL_LOG)


def accept_all(_record: so.SignoffRecord) -> list[str]:
    """Stand-in authenticator: treats every record as committed and signed (the git check is tested separately)."""
    return []


def hazard(doc: dict[str, Any], hazard_id: str) -> dict[str, Any]:
    return next(h for h in doc["hazards"] if h["id"] == hazard_id)


def control(doc: dict[str, Any], control_id: str) -> dict[str, Any]:
    return next(c for h in doc["hazards"] for c in h["controls"] if c["id"] == control_id)


class Sandbox:
    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="hms-safety-test-")
        self.root = Path(self._tmp.name)
        self.safety = self.root / "docs" / "safety"
        self.reset()

    def reset(self) -> None:
        """Start again from the real files: the real hazard log, the two schemas, nothing else."""
        for path in (self.root / "docs" / "specs", self.root / "docs" / "program", self.safety):
            if path.exists():
                shutil.rmtree(path)
        (self.safety / "signoffs").mkdir(parents=True)
        shutil.copy2(REAL_SAFETY / "hazard-log.yaml", self.safety / "hazard-log.yaml")
        shutil.copy2(REAL_SAFETY / "hazard-log.schema.json", self.safety / "hazard-log.schema.json")
        shutil.copy2(REAL_SAFETY / "signoffs" / "signoff.schema.json", self.safety / "signoffs" / "signoff.schema.json")

    def close(self) -> None:
        self._tmp.cleanup()

    @property
    def paths(self) -> SafetyPaths:
        paths = SafetyPaths.for_root(self.root)
        paths.build_prompt = REPO / "BUILD-PROMPT.md"
        return paths

    def write_log(self, doc: dict[str, Any]) -> None:
        text = yaml.dump(doc, Dumper=_DUMPER, allow_unicode=True, sort_keys=False, width=1000)
        with open(self.safety / "hazard-log.yaml", "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)

    def mutate(self, change: Callable[[dict[str, Any]], None]) -> None:
        doc = real_log()
        change(doc)
        self.write_log(doc)

    def copy_fixture(self, fixture: str, target_dir: Path, name: str | None = None) -> Path:
        source = FIXTURES / fixture
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / (name or source.name)
        shutil.copy2(source, target)
        return target

    def add_signoff(self, fixture: str, name: str | None = None) -> Path:
        return self.copy_fixture(fixture, self.safety / "signoffs", name)

    def add_state_machine(self, fixture: str) -> Path:
        return self.copy_fixture(fixture, self.root / "docs" / "specs" / "state-machines")

    def write_backlog(self, doc: Any) -> None:
        target = self.root / "docs" / "program" / "backlog.yaml"
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(yaml.dump(doc, Dumper=_DUMPER, sort_keys=False))

    def run(self, authenticate: so.Authenticator | None = accept_all) -> CheckResult:
        return run_check(self.paths, authenticate=authenticate)


class SandboxCase(unittest.TestCase):
    """One sandbox per test class, reset to the real files before every test."""

    box: Sandbox

    @classmethod
    def setUpClass(cls) -> None:
        cls.box = Sandbox()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.box.close()

    def setUp(self) -> None:
        self.box.reset()

    def run_with(self, change: Callable[[dict[str, Any]], None] | None = None) -> CheckResult:
        if change is not None:
            self.box.mutate(change)
        return self.box.run()

    def assertFailsWith(self, result: CheckResult, *fragments: str) -> None:
        self.assertFalse(result.ok, "expected the check to fail")
        joined = "\n".join(result.errors)
        for fragment in fragments:
            self.assertIn(fragment, joined)
