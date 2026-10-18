"""CLI: ``sh tools/hms backlog <generate | render | check [--json] | spot-check --seed N [--count 10]>``.

Exit codes: 0 success or pass, 1 failure, 2 usage or environment error (CheckResult contract in hmstools.common).
"""

from __future__ import annotations

import argparse
import sys

from hmstools.backlog.check import CHECK_NAME, run_check
from hmstools.backlog.commands import CommandFailed, generate, render, spot_check
from hmstools.backlog.paths import BacklogPaths, EnvironmentProblem
from hmstools.common import CheckResult, repo_root


def _utf8_stdout() -> None:
    # Isolated mode (-I) ignores PYTHONIOENCODING; Windows consoles and pipes default to a legacy code page,
    # and the plan text holds characters such as "·", "†" and "≈".
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="backslashreplace")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tools/hms backlog",
        description="Backlog of record from BUILD-PROMPT.md Appendix A and §21 (BUILD-PROMPT.md §3.1, WP-0.1).",
    )
    sub = parser.add_subparsers(dest="command", metavar="{generate,render,check,spot-check}")
    sub.add_parser("generate", help="write docs/program/backlog.yaml from Appendix A, keeping hand-edited fields")
    sub.add_parser("render", help="write docs/program/BACKLOG.md from backlog.yaml")
    check = sub.add_parser("check", help="verify backlog.yaml and BACKLOG.md against the plan")
    check.add_argument("--json", action="store_true", help="print one JSON result object as the last line")
    spot = sub.add_parser("spot-check", help="print seeded random Appendix A rows beside their parsed records")
    spot.add_argument("--seed", type=int, required=True, help="random seed (record it with the result)")
    spot.add_argument("--count", type=int, default=10, help="rows to print (default 10)")
    return parser


def main(argv: list[str] | None = None, paths: BacklogPaths | None = None) -> int:
    _utf8_stdout()
    parser = _parser()
    args = parser.parse_args(argv)
    if args.command is None:
        parser.print_usage(sys.stderr)
        print("tools/hms backlog: a subcommand is required", file=sys.stderr)
        return 2
    try:
        paths = paths or BacklogPaths.for_root(repo_root())
    except RuntimeError as exc:
        print(f"tools/hms backlog: {exc}", file=sys.stderr)
        return 2

    if args.command == "check":
        try:
            return run_check(paths).emit(args.json)
        except EnvironmentProblem as exc:
            CheckResult(CHECK_NAME, errors=[f"environment: {exc}"]).emit(args.json)
            return 2

    try:
        if args.command == "generate":
            report = generate(paths)
            print(
                f"{paths.show(paths.backlog)}: {report.rows} rows ({report.features} feature IDs, "
                f"{report.rows - report.features} part rows); hand-edited fields kept for {report.kept} rows"
            )
            for key in report.added:
                print(f"added    {key}")
            for key, names in report.refreshed.items():
                print(f"refreshed {key}: {', '.join(names)} now as in BUILD-PROMPT.md (parsed fields are not hand-edited)")
            for key, extras in report.extra_work_packages.items():
                print(f"kept     {key}: work packages not derived from §21: {', '.join(extras)}")
            for wildcard in report.wildcards:
                print(f"WARN     §21 {wildcard}: a wildcard, not attached to any feature")
            print("next: run 'tools/hms backlog render' to refresh docs/program/BACKLOG.md")
        elif args.command == "render":
            rows = render(paths)
            print(f"{paths.show(paths.markdown)}: rendered {rows} rows from {paths.show(paths.backlog)}")
        elif args.command == "spot-check":
            sys.stdout.write(spot_check(paths, args.seed, args.count))
        return 0
    except EnvironmentProblem as exc:
        print(f"tools/hms backlog {args.command}: {exc}", file=sys.stderr)
        return 2
    except CommandFailed as exc:
        print(f"ERROR  tools/hms backlog {args.command}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
