"""tools/doctor [--tier full|fast] [--json]: check the build host; exit 1 if a required item is missing."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from .checks import (
    DEV_CELL_CORES,
    DEV_CELL_RAM_GIB,
    DISK_FREE_GIB,
    LITE_CELL_CORES,
    LITE_CELL_RAM_GIB,
    WINDOWS_RESERVE_GIB,
    Report,
    run_checks,
)
from .fixes import UBUNTU
from .host import Host


def render(report: Report) -> str:
    lines = [
        f"HMS Kurdistan host doctor (tier: {report.tier})  {datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"repository: {report.host.get('root')}",
        "",
    ]
    width_name = max(len(item.name) for item in report.items)
    lines.append(f"{'ITEM'.ljust(width_name)}  {'STATUS':7}  FOUND")
    for item in report.items:
        lines.append(f"{item.name.ljust(width_name)}  {item.status:7}  {item.found}")
        if not item.ok:
            lines.append(f"{''.ljust(width_name)}           need: {item.need}")
        if item.note:
            lines.append(f"{''.ljust(width_name)}           note: {item.note}")
    if report.profile is not None:
        lines += [
            "",
            f"Cell profile this host supports: {report.profile}",
            f"  thresholds [P]: dev cell RAM >= 32 GB (measured >= {DEV_CELL_RAM_GIB:.0f} GiB) and >= {DEV_CELL_CORES}"
            f" cores; lite cell RAM >= 16 GB (>= {LITE_CELL_RAM_GIB:.0f} GiB) and >= {LITE_CELL_CORES} cores;"
            f" free disk >= {DISK_FREE_GIB:.0f} GiB",
        ]
        if report.windows_host:
            lines.append(
                f"  on Windows the cells run in the WSL2 VM, sized here as host RAM minus {WINDOWS_RESERVE_GIB:.0f} GiB"
                " for Windows [P]; re-run tools/doctor inside WSL2 for the VM's own figures"
            )
    missing = [item for item in report.items if not item.ok]
    if missing:
        lines += ["", "To fix (tools/doctor never installs anything; run these yourself):"]
        for item in missing:
            commands = UBUNTU.get(item.fix_key or item.id, [])
            lines.append(f"- {item.name} [{item.status}]  Ubuntu 24.04 (WSL2):")
            lines += [f"    {command}" for command in commands]
        if report.windows_host and report.windows_steps:
            lines += ["", "Windows host steps (the build runs in WSL2 Ubuntu 24.04):"]
            lines += [f"  {step}" for step in report.windows_steps]
    required_missing = [item for item in missing if item.required]
    lines += [
        "",
        f"doctor: {'PASS' if report.ok else 'FAIL'} ({len(report.items) - len(missing)} ok,"
        f" {len(required_missing)} required missing, {len(missing) - len(required_missing)} warnings)",
    ]
    return "\n".join(lines)


def to_json(report: Report) -> dict:
    missing = [item for item in report.items if not item.ok and item.required]
    warnings = [item for item in report.items if not item.ok and not item.required]
    return {
        "check": "doctor",
        "ok": report.ok,
        "counts": {
            "items": len(report.items),
            "ok": sum(1 for item in report.items if item.ok),
            "missing": len(missing),
            "warnings": len(warnings),
        },
        "errors": [f"{item.name}: {item.found} (need {item.need})" for item in missing],
        "warnings": [f"{item.name}: {item.found} (need {item.need})" for item in warnings]
        + [f"{item.name}: {item.note}" for item in report.items if item.ok and item.note],
        "tier": report.tier,
        "profile": report.profile,
        "host": report.host,
        "items": [item.to_dict(report.windows_host) for item in report.items],
        "windows_steps": report.windows_steps,
        "thresholds": {
            "dev_cell_ram_gib": DEV_CELL_RAM_GIB,
            "lite_cell_ram_gib": LITE_CELL_RAM_GIB,
            "dev_cell_cores": DEV_CELL_CORES,
            "lite_cell_cores": LITE_CELL_CORES,
            "disk_free_gib": DISK_FREE_GIB,
            "windows_reserve_gib": WINDOWS_RESERVE_GIB,
            "marked": "[P]",
        },
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(
        prog="tools/doctor",
        description=(
            "Check the build host against BUILD-PROMPT.md 'Before the first session'. Prints what is missing "
            "with the exact install commands; never installs anything. Exit 1 if a required item is missing."
        ),
    )
    parser.add_argument(
        "--tier",
        choices=["full", "fast"],
        default="full",
        help="'fast' checks only what the fast CI tier needs: the pinned JDK 25 (ADR-002), Node 24, "
        "pnpm via Corepack, the project venv and gitleaks in .tools/bin (default: full)",
    )
    parser.add_argument("--json", action="store_true", help="also print one JSON object as the last line (evidence)")
    parser.add_argument("--root", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    root = (args.root or Path(__file__).resolve().parents[3]).resolve()
    try:
        report = run_checks(Host(root), args.tier)
    except Exception as exc:  # noqa: BLE001 - an environment error must still produce a clear message
        print(f"tools/doctor: environment error: {exc}", file=sys.stderr)
        return 2
    print(render(report))
    if args.json:
        sys.stdout.flush()
        print(json.dumps(to_json(report), ensure_ascii=False, sort_keys=True))
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
