"""Evidence records for cell tests (BUILD-PROMPT.md §3.5 "name the cell behind every number", §19.1).

Each record names its cell: "compose" (the docker compose dev stack), "lite" (the lite cell),
"dev" (the three-node dev cell) or "reference" (the reference cell). Only reference-cell numbers
count as evidence for C7, C9, the SLOs and release gates; dev-cell numbers are "indicative" and
lite-cell numbers "lite".
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CELLS = ("compose", "lite", "dev", "reference")
STANDING = {"compose": "indicative (compose stack, not a cell)", "lite": "lite", "dev": "indicative",
            "reference": "evidence"}


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", text).strip("-").lower() or "x"


EVIDENCE_PREFIX = "docs/program/evidence/"


def code_git_info(root: Path) -> dict[str, Any]:
    """The runner's git_info, except that untracked evidence outputs do not make the tree "dirty".

    A run that writes a record leaves it untracked; without this, every later run in the same checkout would
    be labelled dirty although the code under test is unchanged. Untracked files elsewhere and any change to
    a tracked file (evidence included) still count. The CI runner's own records still count every untracked
    file (KA-024).
    """
    from ..ci.runner import git_info

    return git_info(root, ignore_untracked_under=EVIDENCE_PREFIX)


def write(root: Path, test: str, label: str, cell: str, started_at: str, result: str, details: dict[str, Any],
          directory: Path | None = None) -> Path:
    """Write a record named <date>-<test>[-<label>]-<shortsha>[-dirty].json (an empty label is left out) into
    docs/program/evidence/cell/, or into `directory` for a scratch record outside the repository."""
    from ..ci.runner import host_info

    if cell not in CELLS:
        raise ValueError(f"unknown cell {cell!r}; one of {CELLS}")
    git = code_git_info(root)
    stamp = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
    middle = f"{slug(test)}-{slug(label)}" if label else slug(test)
    stem = f"{stamp}-{middle}-{git['short_sha']}{'-dirty' if git['dirty'] else ''}"
    directory = directory if directory is not None else root / "docs" / "program" / "evidence" / "cell"
    record = {
        "schema_version": 1,
        "test": test,
        "label": label,
        "cell": cell,
        "standing": STANDING[cell],
        "started_at": started_at,
        "finished_at": now_iso(),
        "git": git,
        "host": host_info(dict(os.environ)),
        "result": result,
        "details": details,
    }
    directory.mkdir(parents=True, exist_ok=True)
    # A rerun with the same name never overwrites an earlier record: it adds -2, -3, ... (OQ-129).
    number = 1
    while True:
        path = directory / (f"{stem}.json" if number == 1 else f"{stem}-{number}.json")
        try:
            handle = open(path, "x", encoding="utf-8", newline="\n")
        except FileExistsError:
            number += 1
            continue
        with handle:
            json.dump(record, handle, ensure_ascii=False, indent=2, sort_keys=False)
            handle.write("\n")
        return path
