"""tools/hms repo check [--json] [--rule NAME ...]"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ..common import repo_root
from .rules import RULES, run


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(prog="tools/hms repo", description="Repository rules (WP-0.1).")
    sub = parser.add_subparsers(dest="command", required=True)
    check = sub.add_parser(
        "check",
        help="run the repository rules",
        description=(
            "crlf: no CRLF in text files; required: programme control files and ADR-001..028 (template B.1); "
            "tenants: no registered tenant identifier in backend/, frontend/, content/, deploy/; "
            "branches: branch naming and the branch-per-tenant detector; "
            "limits: 'Blocking now' <= 10 items, STATUS.md <= 150 lines."
        ),
    )
    check.add_argument("--json", action="store_true", help="print one JSON object as the last line")
    check.add_argument("--rule", action="append", choices=RULES, help="run only this rule (repeatable)")
    check.add_argument("--root", type=Path, help="repository root (default: this repository)")
    args = parser.parse_args(argv)
    root = (args.root or repo_root()).resolve()
    result = run(root, set(args.rule) if args.rule else None)
    if args.rule:
        result.warnings.append(f"partial run: only {', '.join(sorted(args.rule))}")
    code = result.emit(args.json)
    return 2 if result.counts.get("environment_error") else code


if __name__ == "__main__":
    sys.exit(main())
