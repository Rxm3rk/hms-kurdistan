"""File locations for the backlog tools, and the environment error they raise."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


class EnvironmentProblem(RuntimeError):
    """A usage or environment error (exit code 2): a missing plan file or a missing library."""


@dataclass(frozen=True)
class BacklogPaths:
    root: Path
    source: Path  # BUILD-PROMPT.md
    backlog: Path  # docs/program/backlog.yaml
    markdown: Path  # docs/program/BACKLOG.md

    @classmethod
    def for_root(cls, root: Path) -> "BacklogPaths":
        return cls(
            root=root,
            source=root / "BUILD-PROMPT.md",
            backlog=root / "docs" / "program" / "backlog.yaml",
            markdown=root / "docs" / "program" / "BACKLOG.md",
        )

    def show(self, path: Path) -> str:
        try:
            return path.relative_to(self.root).as_posix()
        except ValueError:
            return str(path)
