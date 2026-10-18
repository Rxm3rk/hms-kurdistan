"""CLI: ``sh tools/hms safety check [--json]`` (CheckResult contract in hmstools.common).

Exit 0 when every rule passes, 1 when any rule fails, 2 for a usage or environment error.
"""

from __future__ import annotations

import argparse
import sys

from hmstools.common import CheckResult, repo_root
from hmstools.safety.check import CHECK_NAME, EnvironmentProblem, SafetyPaths, run_check


def _utf8_stdout() -> None:
    # Isolated mode (-I) ignores PYTHONIOENCODING; Windows consoles and pipes default to a legacy code
    # page, and messages quote plan text with characters such as "≥" and "↔".
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="backslashreplace")


def main(argv: list[str] | None = None, paths: SafetyPaths | None = None) -> int:
    _utf8_stdout()
    parser = argparse.ArgumentParser(
        prog="tools/hms safety",
        description="Hazard-log check and approval-field gate (BUILD-PROMPT.md §3.5, §10.1).",
    )
    sub = parser.add_subparsers(dest="command", metavar="check")
    check = sub.add_parser("check", help="validate docs/safety/hazard-log.yaml and the sign-off gate")
    check.add_argument("--json", action="store_true", help="print one JSON result object as the last line")
    args = parser.parse_args(argv)
    if args.command != "check":
        parser.print_usage(sys.stderr)
        print("tools/hms safety: a subcommand is required: check", file=sys.stderr)
        return 2

    try:
        result = run_check(paths or SafetyPaths.for_root(repo_root()))
    except EnvironmentProblem as exc:
        failed = CheckResult(CHECK_NAME, errors=[f"environment: {exc}"])
        failed.emit(args.json)
        return 2
    return result.emit(args.json)


if __name__ == "__main__":
    sys.exit(main())
