"""tools/hms licence check (--sbom FILE | --pnpm FILE)... [--scope shipped|build-only] [--json]"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ..common import CheckResult, repo_root
from .policy import (
    ALLOWED,
    CONDITIONAL,
    DENIED,
    UNMAPPED,
    Evaluator,
    Policy,
    load_register,
    read_cyclonedx,
    read_pnpm,
)

POLICY = Path("tools/licence/policy.yaml")
REGISTER = Path("tools/licence/register.yaml")


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(prog="tools/hms licence", description="Licence policy checks (§4.3).")
    sub = parser.add_subparsers(dest="command", required=True)
    check = sub.add_parser(
        "check",
        help="apply tools/licence/policy.yaml",
        description=(
            "Apply tools/licence/policy.yaml to a CycloneDX JSON SBOM (--sbom) or to the output of "
            "'pnpm licenses list --json' (--pnpm). Denied, excluded and unmapped licences fail, and so does a "
            "conditional one (BUILD-PROMPT.md §4.3: allowed only unmodified and recorded in the licence register) "
            "until tools/licence/register.yaml has an entry that matches the component, records the rule and the "
            "licence the policy applies to it, and records it as unmodified. A register entry that does not "
            "follow the schema in the register's header fails too."
        ),
    )
    check.add_argument("--sbom", action="append", type=Path, default=[], help="CycloneDX JSON file (repeatable)")
    check.add_argument("--pnpm", action="append", type=Path, default=[], help="pnpm licenses list --json output")
    check.add_argument(
        "--scope",
        choices=["shipped", "build-only"],
        help="treat every component as this scope (default: CycloneDX scope 'excluded' is build-only, "
        "everything else shipped)",
    )
    check.add_argument("--policy", type=Path, help="policy file (default tools/licence/policy.yaml)")
    check.add_argument("--register", type=Path, help="licence register (default tools/licence/register.yaml)")
    check.add_argument("--json", action="store_true", help="print one JSON object as the last line")
    args = parser.parse_args(argv)

    result = CheckResult(check="licence")
    if not args.sbom and not args.pnpm:
        print("tools/hms licence check: give at least one --sbom or --pnpm file", file=sys.stderr)
        return 2
    root = repo_root()
    try:
        policy = Policy.load(args.policy or root / POLICY)
        register_path = args.register or root / REGISTER
        register, register_problems = load_register(register_path, policy)
        components = []
        for path in args.sbom:
            components += read_cyclonedx(path, args.scope)
        for path in args.pnpm:
            components += read_pnpm(path, args.scope)
    except (OSError, ValueError, KeyError) as exc:
        print(f"tools/hms licence check: {exc}", file=sys.stderr)
        return 2
    try:
        shown = register_path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        shown = str(register_path)
    # A malformed entry is reported and not used, so it can never count as the record §4.3 asks for.
    result.errors += [f"register: {shown}: {problem}" for problem in register_problems]
    evaluator = Evaluator(policy, register)
    tally = {"components": len(components), "allowed": 0, "conditional": 0, "conditional_registered": 0,
             "denied": 0, "unmapped": 0, "register_entries": len(register)}
    for component in components:
        verdict = evaluator.evaluate(component)
        scope = component.scope or policy.default_scope
        where = f"{component.label} [{scope}, {component.source}]"
        if verdict.level == ALLOWED:
            tally["allowed"] += 1
        elif verdict.level == CONDITIONAL:
            # §4.3 allows a conditional licence only "unmodified and recorded in the licence register", so a
            # conditional component fails the check until an entry records it. An entry records it only if it
            # also records the rule the policy applies and the licence that rule applies to, so one broad entry
            # cannot stand for components under other rules or licences.
            matching = evaluator.register_entries(component)
            recording = [entry for entry in matching if evaluator.records(entry, verdict)]
            needed = f"rule {verdict.rule!r}, licence {verdict.licence!r}"
            if evaluator.registered(component, verdict):
                tally["conditional_registered"] += 1
            elif recording:
                tally["conditional"] += 1
                modified = next(entry for entry in recording if entry.get("unmodified") is not True)
                result.errors.append(
                    f"conditional: {where}: {verdict.reason}; its licence-register entry "
                    f"({modified.get('component')!r}) does not record 'unmodified: true', and §4.3 allows it only "
                    f"unmodified ({verdict.condition})"
                )
            elif matching:
                tally["conditional"] += 1
                recorded = "; ".join(
                    f"{entry.get('component')!r} records rule {entry.get('rule')!r}, licence {entry.get('licence')!r}"
                    for entry in matching
                )
                result.errors.append(
                    f"conditional: {where}: {verdict.reason}; the policy applies {needed}, and no entry in {shown} "
                    f"records that ({recorded}) ({verdict.condition})"
                )
            else:
                tally["conditional"] += 1
                result.errors.append(
                    f"conditional: {where}: {verdict.reason}; allowed only with an entry in {shown} ({needed}), "
                    f"which has none for it ({verdict.condition})"
                )
        elif verdict.level == DENIED:
            tally["denied"] += 1
            result.errors.append(f"denied: {where}: {verdict.reason}")
        elif verdict.level == UNMAPPED:
            tally["unmapped"] += 1
            result.errors.append(f"unmapped: {where}: {verdict.reason}")
    result.counts.update(tally)
    return result.emit(args.json)


if __name__ == "__main__":
    sys.exit(main())
