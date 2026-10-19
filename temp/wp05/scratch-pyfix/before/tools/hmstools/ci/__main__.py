"""tools/ci/run <fast|merge|nightly|release> [--no-evidence] [--only STEP] [--cell NAME] [--list]"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ..bootstrap.steps import apply_toolchain_env
from ..common import repo_root
from .runner import NotBuiltStep, RunConfig, run_tier
from .tiers import TIERS, tier_steps

DESCRIPTION = """\
The local CI runner (BUILD-PROMPT.md §19.1). Runs every step of the tier in order, keeps going after
a failure and exits 1 if any step failed. A step that a later work package builds is NOT-BUILT,
names that work package and counts as a failure, so merge, nightly and release fail until they are
complete (fail closed). Each run writes one evidence record to
docs/program/evidence/ci/<yyyy-mm-dd>-<tier>-<shortsha>[-dirty].json and full step logs to
build/ci-logs/<run_id>/.

exit codes: 0 PASS; 1 FAIL; 2 usage or environment error; 3 PARTIAL (an --only run whose
selected steps passed; never a gate result).
"""


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(
        prog="tools/ci/run", description=DESCRIPTION, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("tier", choices=TIERS)
    parser.add_argument("--no-evidence", action="store_true", help="do not write the evidence record")
    parser.add_argument(
        "--only",
        action="append",
        metavar="STEP",
        help="run only this step (repeatable, or comma-separated); the run is PARTIAL, never PASS",
    )
    parser.add_argument(
        "--cell",
        choices=["none", "dev", "lite", "reference"],
        default="none",
        help="the cell this run uses (merge, nightly, release); the fast tier always records 'none'",
    )
    parser.add_argument("--list", action="store_true", help="list the tier's steps and exit")
    args = parser.parse_args(argv)

    root = repo_root()
    steps = tier_steps(args.tier, root)
    names = [step.name for step in steps]
    if args.list:
        for step in steps:
            state = f"NOT-BUILT ({step.work_package})" if isinstance(step, NotBuiltStep) else "built"
            print(f"{step.name:24} {state:44} {step.command()}")
        return 0
    only = None
    if args.only:
        only = [name.strip() for value in args.only for name in value.split(",") if name.strip()]
        unknown = [name for name in only if name not in names]
        if unknown:
            print(f"tools/ci/run: unknown step(s) for tier {args.tier}: {', '.join(unknown)}", file=sys.stderr)
            print(f"steps: {', '.join(names)}", file=sys.stderr)
            return 2
    if args.tier == "fast" and args.cell != "none":
        print("tools/ci/run: the fast tier uses no cell (--cell none)", file=sys.stderr)
        return 2
    env = apply_toolchain_env(root)
    env["COREPACK_ENABLE_DOWNLOAD_PROMPT"] = "0"
    config = RunConfig(
        root=root,
        tier=args.tier,
        steps=steps,
        env=env,
        cell=args.cell,
        only=only,
        write_evidence=not args.no_evidence,
    )
    try:
        report = run_tier(config)
    except KeyboardInterrupt:
        print("tools/ci/run: interrupted", file=sys.stderr)
        return 130
    return report.exit_code


if __name__ == "__main__":
    sys.exit(main())
