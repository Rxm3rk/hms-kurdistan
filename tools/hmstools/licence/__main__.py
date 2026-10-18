"""tools/hms licence check (--sbom FILE | --pnpm FILE)... [--scope shipped|build-only] [--json]"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ..common import CheckResult, load_yaml, repo_root
from .policy import ALLOWED, CONDITIONAL, DENIED, UNMAPPED, Evaluator, Policy, read_cyclonedx, read_pnpm

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
            "'pnpm licenses list --json' (--pnpm). Denied, excluded and unmapped licences fail; conditional "
            "ones warn until tools/licence/register.yaml records them."
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
        register = (load_yaml(register_path) or {}).get("entries") or [] if register_path.is_file() else []
        components = []
        for path in args.sbom:
            components += read_cyclonedx(path, args.scope)
        for path in args.pnpm:
            components += read_pnpm(path, args.scope)
    except (OSError, ValueError, KeyError) as exc:
        print(f"tools/hms licence check: {exc}", file=sys.stderr)
        return 2
    evaluator = Evaluator(policy, register)
    tally = {"components": len(components), "allowed": 0, "conditional": 0, "conditional_registered": 0,
             "denied": 0, "unmapped": 0}
    for component in components:
        verdict = evaluator.evaluate(component)
        scope = component.scope or policy.default_scope
        where = f"{component.label} [{scope}, {component.source}]"
        if verdict.level == ALLOWED:
            tally["allowed"] += 1
        elif verdict.level == CONDITIONAL:
            if evaluator.registered(component):
                tally["conditional_registered"] += 1
            else:
                tally["conditional"] += 1
                result.warnings.append(
                    f"conditional: {where}: {verdict.reason}; needs a licence-register entry ({verdict.condition})"
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
