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


def write(root: Path, test: str, label: str, cell: str, started_at: str, result: str, details: dict[str, Any]) -> Path:
    from ..ci.runner import git_info, host_info

    if cell not in CELLS:
        raise ValueError(f"unknown cell {cell!r}; one of {CELLS}")
    git = git_info(root)
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
