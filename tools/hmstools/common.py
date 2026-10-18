"""Shared helpers for the HMS programme tools.

Contract for every ``check`` command (used by tools/ci/run):
- exit code 0 means the check passed, 1 means it failed, 2 means a usage or environment error;
- with ``--json`` the command prints exactly one JSON object as its last stdout line:
  {"check": str, "ok": bool, "counts": {str: int}, "errors": [str], "warnings": [str]}.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    """Return the repository root (the directory holding BUILD-PROMPT.md and .git)."""
    here = Path(__file__).resolve()
    for candidate in [here, *here.parents]:
        if (candidate / "BUILD-PROMPT.md").is_file() and (candidate / ".git").exists():
            return candidate
    raise RuntimeError("repository root not found above " + str(here))


def load_yaml(path: Path) -> Any:
    import yaml  # PyYAML, pinned in tools/requirements.txt

    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def write_text_lf(path: Path, text: str) -> None:
    """Write UTF-8 text with LF line endings on every platform."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


@dataclass
class CheckResult:
    check: str
    counts: dict[str, int] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def to_dict(self) -> dict[str, Any]:
        return {
            "check": self.check,
            "ok": self.ok,
            "counts": self.counts,
            "errors": self.errors,
            "warnings": self.warnings,
        }

    def emit(self, as_json: bool) -> int:
        """Print the result (human-readable, then JSON if asked) and return the exit code."""
        for message in self.errors:
            print(f"ERROR  {message}")
        for message in self.warnings:
            print(f"WARN   {message}")
        counts = ", ".join(f"{k}={v}" for k, v in self.counts.items())
        print(f"{self.check}: {'PASS' if self.ok else 'FAIL'}" + (f" ({counts})" if counts else ""))
        if as_json:
            sys.stdout.flush()
            print(json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True))
        return 0 if self.ok else 1
