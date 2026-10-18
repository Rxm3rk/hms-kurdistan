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
    """git_info, except that untracked evidence outputs do not make the tree "dirty".

    A run that writes a record leaves it untracked; without this, every later run in the same checkout would
    be labelled dirty although the code under test is unchanged. Untracked files elsewhere and any change to
    a tracked file (evidence included) still count.
    """
    import subprocess

    from ..ci.runner import git_info

    git = git_info(root)
    proc = subprocess.run(["git", "-C", str(root), "status", "--porcelain=v1", "--untracked-files=all"],
                          capture_output=True, check=False)
    lines = proc.stdout.decode("utf-8", "replace").splitlines() if proc.returncode == 0 else []
    outputs = [line[3:] for line in lines if line.startswith("?? ") and line[3:].startswith(EVIDENCE_PREFIX)]
    remaining = [line[3:] for line in lines if len(line) > 3 and line[3:] not in outputs]
    git.update({"dirty": bool(remaining), "dirty_files": remaining[:500], "dirty_files_total": len(remaining),
                "untracked_evidence_outputs_ignored": len(outputs)})
    return git


def write(root: Path, test: str, label: str, cell: str, started_at: str, result: str, details: dict[str, Any]) -> Path:
    from ..ci.runner import host_info

    if cell not in CELLS:
        raise ValueError(f"unknown cell {cell!r}; one of {CELLS}")
    git = code_git_info(root)
    stamp = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
    name = f"{stamp}-{slug(test)}-{slug(label)}-{git['short_sha']}{'-dirty' if git['dirty'] else ''}.json"
    path = root / "docs" / "program" / "evidence" / "cell" / name
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
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(record, handle, ensure_ascii=False, indent=2, sort_keys=False)
        handle.write("\n")
    return path
