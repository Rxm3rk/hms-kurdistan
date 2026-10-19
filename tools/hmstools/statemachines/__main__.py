"""CLI: ``sh tools/hms statemachines check|generate|si-status [options]`` (CheckResult contract in hmstools.common).

- ``check [--json] [--machine NAME]``: every rule of spec §2.1 (1 to 13), for every spec or for one machine;
- ``generate [--check] [--json] [--machine NAME]``: write the generated Kotlin (§2.3); with ``--check``, write
  nothing and run rule 11 only (the generated files are current);
- ``si-status [--require-domain] [--json]``: how each SI test reports, from tests/invariants/si-register.json and
  the SI tests' status files (spec §4, §7; sistatus.py). With ``--require-domain`` (the nightly step
  ``si-domain-layer``) it fails while any SI's domain layer is NOT-BUILT.

Exit 0 when every rule passes, 1 when any fails, 2 for a usage or environment error.

Extension point: a subcommand is one entry in SUBCOMMANDS (its parser setup and its runner).
"""

from __future__ import annotations

import argparse
import sys
from typing import Callable

from hmstools.common import CheckResult, repo_root
from hmstools.statemachines import sistatus
from hmstools.statemachines.check import CHECK_NAME, GENERATE_NAME, EnvironmentProblem, Paths, run_check, run_generate


def _utf8_stdout() -> None:
    # Isolated mode (-I) ignores PYTHONIOENCODING; messages quote edges such as "a→b".
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="backslashreplace")


def _common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--json", action="store_true", help="print one JSON result object as the last line")
    parser.add_argument("--machine", metavar="NAME", help="only the spec docs/specs/state-machines/NAME.yaml")


def _setup_check(parser: argparse.ArgumentParser) -> None:
    _common(parser)


def _setup_generate(parser: argparse.ArgumentParser) -> None:
    _common(parser)
    parser.add_argument("--check", action="store_true", help="write nothing; fail if a generated file is not current (rule 11)")


def _run_check(args: argparse.Namespace, paths: Paths) -> CheckResult:
    return run_check(paths, only=args.machine)


def _run_generate(args: argparse.Namespace, paths: Paths) -> CheckResult:
    if args.check:
        return run_check(paths, only=args.machine, rules_11_only=True)
    return run_generate(paths, only=args.machine)


def _setup_si_status(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--json", action="store_true", help="print one JSON result object as the last line")
    parser.add_argument("--require-domain", action="store_true", help="fail while any SI's domain layer is NOT-BUILT (nightly)")


def _run_si_status(args: argparse.Namespace, paths: Paths) -> CheckResult:
    result, lines = sistatus.run_si_status(paths.root, require_domain=args.require_domain)
    for line in lines:
        print(line)
    return result


# name -> (help, parser setup, runner, check name for an environment failure)
SUBCOMMANDS: dict[str, tuple[str, Callable[[argparse.ArgumentParser], None], Callable[[argparse.Namespace, Paths], CheckResult], str]] = {
    "check": ("validate every state-machine spec (spec §2.1 rules 1-13)", _setup_check, _run_check, CHECK_NAME),
    "generate": ("write the generated Kotlin models (spec §2.3)", _setup_generate, _run_generate, GENERATE_NAME),
    "si-status": ("report each SI test's layers (spec §4, §7)", _setup_si_status, _run_si_status, sistatus.CHECK_NAME),
}


def main(argv: list[str] | None = None, paths: Paths | None = None) -> int:
    _utf8_stdout()
    parser = argparse.ArgumentParser(
        prog="tools/hms statemachines",
        description="State-machine specs: checks and the Kotlin generator (docs/specs/modules/state-machines-and-invariants.md §2).",
    )
    sub = pa