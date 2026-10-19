"""tools/hms cell <command>: dev-cell and compose-stack tooling (BUILD-PROMPT.md WP-0.2).

  worm --endpoint URL --label NAME [--cell compose|lite|dev|reference] [--state FILE] [--evidence] [--json]
      Run the object-store WORM test. Credentials come from HMS_S3_ACCESS_KEY and HMS_S3_SECRET_KEY.
      --state FILE keeps the locked object's bucket, version and SHA-256 for a later re-check.
  worm --recheck FILE --endpoint URL --label NAME ...
      After restarting the server: the same locked version still refuses deletion and is unchanged.
  lint [--file F] [--json]
      Check deploy/site-cell/cell.yaml, the single source of pins (fast tier; pure Python).
  keys init [--generate-passphrase]
      The cell's cosign key pair in HMS_CELL_HOME (default ~/.local/share/hms-cell), passphrase from
      HMS_COSIGN_PASSWORD; --generate-passphrase writes a random one to HMS_CELL_HOME (mode 600) if it is unset.
  registry up
      The local registry (CNCF Distribution, pinned by digest) and its two networks.
  images mirror|sign|verify [--profile lite|dev] [--only NAME ...] [--evidence | --evidence-dir DIR] [--json]
      Copy each pinned image into the local registry by digest; sign it offline; verify it offline. verify
      --evidence writes cell/<date>-images-<shortsha>[-dirty].json; --evidence-dir writes the same record elsewhere.
  charts fetch|verify [--json]
      Download each pinned chart and manifest into HMS_CELL_HOME, keeping it only at its pinned SHA-256; verify
      that each is there at that checksum and packages no chart, and names no image, of the excluded vendor.
  up --only substrate [--profile lite|dev] [--json]
      The k3d cluster of three k3s servers from deploy/site-cell/k3d/<profile>.k3d.yaml: refuses below the memory
      and disk lines, verifies every substrate image's signature offline (k3s first), starts from the local
      registry's digests, fixes every address on the cell network and checks them against the nodes and etcd.
      Idempotent; an existing cluster is started and checked, never recreated.
  start | stop | status [--profile lite|dev] [--json]
      Start the stopped nodes and wait for them; stop them (the registry keeps running); report the state.
  chaos cell-restart [--profile lite|dev] [--evidence | --evidence-dir DIR] [--json]
      R1 (tests/chaos/scenarios/cell-restart.yaml): kill all three nodes, start them in reverse order; PASS only
      if the API is ready within the bound, the addresses are unchanged and etcd has all its members.
      --evidence writes chaos/<date>-cell-restart-<shortsha>[-dirty].json; --evidence-dir writes it elsewhere.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from ..common import repo_root
from . import evidence
from .config import CELL_YAML, POLICY, REGISTER, ConfigError, cell_home, lint, load
from .s3 import S3Client
from .worm import recheck_worm, run_worm


def cmd_worm(args: argparse.Namespace) -> int:
    access, secret = os.environ.get("HMS_S3_ACCESS_KEY"), os.environ.get("HMS_S3_SECRET_KEY")
    if not access or not secret:
        print("cell worm: set HMS_S3_ACCESS_KEY and HMS_S3_SECRET_KEY", file=sys.stderr)
        return 2
    started = evidence.now_iso()
    client = S3Client(args.endpoint, access, secret, region=args.region)
    if args.recheck:
        with open(args.recheck, encoding="utf-8") as handle:
            state = json.load(handle)
        report = recheck_worm(client, state["bucket"], state["key"], state["version"], state["sha256"])
        test = "worm-recheck"
    else:
        report = run_worm(client)
        test = "worm"
        if args.state and report.version:
            with open(args.state, "w", encoding="utf-8", newline="\n") as handle:
                json.dump({"bucket": report.bucket, "key": report.key, "version": report.version,
                           "sha256": report.sha256}, handle)
    for c in report.cases:
        d = c.to_dict()
        print(f"{d['result']:4}  {c.id}  {c.title}: expected {c.expected}; observed {c.observed}")
    if report.error:
        print(f"ERROR  {report.error}")
    verdict = "PASS" if report.passed else "FAIL"
    print(f"{test} [{args.label}, cell {args.cell}]: {verdict}")
    if args.evidence:
        path = evidence.write(repo_root(), test, args.label, args.cell, started, verdict, report.to_dict())
        print(f"evidence: {path.relative_to(repo_root()).as_posix()}")
    if args.json:
        print(json.dumps({"check": test, "ok": report.passed, "label": args.label, "cell": args.cell,
                          "report": report.to_dict()}, ensure_ascii=False))
    return 0 if report.passed else 1


def cmd_lint(args: argparse.Namespace) -> int:
    root = repo_root()
    path = Path(args.file) if args.file else root / CELL_YAML
    return lint(path, root / POLICY, root / REGISTER).emit(args.json)


def context(args: argparse.Namespace):
    from .images import Ctx

    root = repo_root()
    cfg = load(Path(args.file) if getattr(args, "file", None) else root / CELL_YAML)
    return Ctx(cfg=cfg, home=cell_home(), env=dict(os.environ))


def cmd_keys(args: argparse.Namespace) -> int:
    from .images import CellError, keys_init
    from .signing import SigningError

    try:
        ctx = context(args)
        for line in keys_init(ctx, generate_passphrase=args.generate_passphrase):
            print(line)
    except (CellError, SigningError, ConfigError, OSError) as exc:
        print(f"cell keys init: {exc}", file=sys.stderr)
        return 1
    return 0


def cmd_registry(args: argparse.Namespace) -> int:
    from .images import CellError, registry_up
    from .proc import GuardError

    try:
        for line in registry_up(context(args)):
            print(line)
    except (CellError, GuardError, ConfigError, OSError) as exc:
        print(f"cell registry up: {exc}", file=sys.stderr)
        return 1
    return 0


def cmd_images(args: argparse.Namespace) -> int:
    from . import images
    from .proc import GuardError
    from .signing import SigningError

    started = evidence.now_iso()
    try:
        ctx = context(args)
        selected = ctx.cfg.profile_images(args.profile)
        if args.only:
            unknown = set(args.only) - {i.name for i in selected}
            if unknown:
                raise ConfigError(f"not images of profile {args.profile}: {sorted(unknown)}")
            selected = [i for i in selected if i.name in args.only]
        action = {"mirror": images.mirror, "sign": images.sign, "verify": images.verify}[args.action]
        outcomes = action(ctx, selected)
    except (images.CellError, GuardError, SigningError, ConfigError, OSError) as exc:
        print(f"cell images {args.action}: {exc}", file=sys.stderr)
        return 1
    for o in outcomes:
        state = "OK  " if o.ok else "FAIL"
        print(f"{state}  {o.name:28} {o.action or '-':15} {o.detail}".rstrip())
    passed = all(o.ok for o in outcomes)
    verdict = "PASS" if passed else "FAIL"
    print(f"images {args.action} [{args.profile}, {len(outcomes)} images]: {verdict}")
    if args.evidence or args.evidence_dir:
        if args.action != "verify" or args.only:
            print("cell images: a record is written only by 'verify' over the whole profile", file=sys.stderr)
            return 2
        free = None
        try:
            free = ctx.disk_guard("record")
        except GuardError:
            pass
        details = images.record_details(ctx, args.profile, outcomes, free)
        root = repo_root()
        path = evidence.write(root, "images", "", args.profile, started, verdict, details,
                              directory=Path(args.evidence_dir) if args.evidence_dir else None)
        shown = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
        print(f"evidence: {shown}")
    if args.json:
        print(json.dumps({"check": f"images-{args.action}", "ok": passed, "profile": args.profile,
                          "images": [o.to_dict() for o in outcomes]}, ensure_ascii=False))
    return 0 if passed else 1


def cmd_charts(args: argparse.Namespace) -> int:
    from . import charts
    from .proc import GuardError

    try:
        ctx = context(args)
        outcomes = (charts.fetch if args.action == "fetch" else charts.verify)(ctx)
    except (GuardError, ConfigError, OSError) as exc:
        print(f"cell charts {args.action}: {exc}", file=sys.stderr)
        return 1
    for o in outcomes:
        state = "OK  " if o.ok else "FAIL"
        print(f"{state}  {o.kind:8} {o.file:60} {o.action or '-':10} {o.detail}".rstrip())
    passed = all(o.ok for o in outcomes)
    verdict = "PASS" if passed else "FAIL"
    noted = sum(o.notes for o in outcomes)
    print(f"charts {args.action} [{len(outcomes)} files; {noted} other mentions of the excluded vendor, not failed]: "
          f"{verdict}")
    if args.json:
        print(json.dumps({"check": f"charts-{args.action}", "ok": passed,
                          "files": [o.to_dict() for o in outcomes]}, ensure_ascii=False))
    return 0 if passed else 1


def substrate(args: argparse.Namespace):
    from .k3d import Substrate, load_profile

    return Substrate(ctx=context(args), profile=load_profile(repo_root(), args.profile))


def _substrate_errors():
    from .docker import DockerError
    from .images import CellError
    from .k3d import SubstrateError
    from .kube import KubeError
    from .proc import GuardError
    from .signing import SigningError

    return (SubstrateError, DockerError, KubeError, CellError, GuardError, SigningError, ConfigError, OSError)


def _print_checks(checks) -> bool:
    for c in checks:
        print(f"{'OK  ' if c.ok else 'FAIL'}  {c.name:24} {c.detail}".rstrip())
    return all(c.ok for c in checks)


def cmd_substrate(args: argparse.Namespace) -> int:
    """cell up --only substrate | start | stop | status."""
    action = args.command
    try:
        sub = substrate(args)
        if action == "up":
            steps, checks = sub.up()
        elif action == "start":
            steps, checks = sub.start()
        elif action == "stop":
            steps, checks = sub.stop(), []
        else:
            state, checks, details = sub.status()
            steps = [f"cluster {details['cluster']} on {details['network']} ({details['subnet']}): {state}"]
            for c in details["containers"]:
                where = c["networks"].get(details["network"]) or {}
                print(f"      {c['name']:34} {'running' if c['running'] else c['status']:10} "
                      f"address={where.get('address')} fixed={where.get('fixed')} restart={c['restart_policy']}")
    except _substrate_errors() as exc:
        print(f"cell {action}: {exc}", file=sys.stderr)
        if args.json:
            print(json.dumps({"check": f"cell-{action}", "ok": False, "profile": args.profile, "error": str(exc)},
                             ensure_ascii=False))
        return 1
    for line in steps:
        print(line)
    passed = _print_checks(checks)
    if action == "status":
        passed = passed and state in ("running", "stopped")
        label = f"{state}, {'healthy' if passed else 'NOT healthy'}"
    else:
        label = "PASS" if passed else "FAIL"
    print(f"{action} [{args.profile}, substrate]: {label}")
    if args.json:
        out = {"check": f"cell-{action}", "ok": passed, "profile": args.profile,
               "checks": [c.to_dict() for c in checks]}
        if action == "status":
            out.update({"state": state, "details": details})
        print(json.dumps(out, ensure_ascii=False))
    return 0 if passed else 1


def cmd_chaos(args: argparse.Namespace) -> int:
    from .k3d import load_scenario, restart_test

    started = evidence.now_iso()
    try:
        sub = substrate(args)
        scenario = load_scenario(repo_root(), args.scenario)
        report = restart_test(sub, scenario)
    except _substrate_errors() as exc:
        print(f"cell chaos {args.scenario}: {exc}", file=sys.stderr)
        return 1
    for event in report.timeline:
        extra = {k: v for k, v in event.items() if k not in ("t_s", "event")}
        print(f"t+{event['t_s']:6.1f} s  {event['event']}" + (f"  {json.dumps(extra)}" if extra else ""))
    _print_checks(report.checks)
    if report.error:
        print(f"ERROR  {report.error}")
    print(f"{scenario['test']} ({scenario['id']}) [{args.profile}]: {report.result}")
    if args.evidence or args.evidence_dir:
        root = repo_root()
        directory = Path(args.evidence_dir) if args.evidence_dir else root / "docs" / "program" / "evidence" / "chaos"
        details = {**report.to_dict(), "pin_set_sha256": sub.ctx.cfg.pin_set_sha256,
                   "k3d_config": sub.profile.path.relative_to(root).as_posix()}
        path = evidence.write(root, scenario["test"], "", args.profile, started, report.result, details,
                              directory=directory)
        shown = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
        print(f"evidence: {shown}")
    if args.json:
        print(json.dumps({"check": f"chaos-{scenario['test']}", "ok": report.passed, "profile": args.profile,
                          "report": report.to_dict()}, ensure_ascii=False))
    return 0 if report.passed else 1


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(prog="tools/hms cell", description="Dev-cell and compose-stack tooling (WP-0.2).")
    sub = parser.add_subparsers(dest="command", required=True)
    worm = sub.add_parser("worm", help="object-store WORM test (Object Lock, COMPLIANCE mode)")
    worm.add_argument("--endpoint", required=True, help="S3 endpoint, for example http://127.0.0.1:7070")
    worm.add_argument("--label", required=True, help="what is tested, for example versitygw-v1.4.1")
    worm.add_argument("--cell", choices=evidence.CELLS, default="compose")
    worm.add_argument("--region", default="us-east-1")
    worm.add_argument("--state", help="write the locked object's bucket, version and SHA-256 here")
    worm.add_argument("--recheck", help="re-check a locked object recorded by --state (after a restart)")
    worm.add_argument("--evidence", action="store_true", help="write an evidence record")
    worm.add_argument("--json", action="store_true")
    worm.set_defaults(func=cmd_worm)

    lint_p = sub.add_parser("lint", help="check deploy/site-cell/cell.yaml (fast tier)")
    lint_p.add_argument("--file", help="the cell.yaml to check (default deploy/site-cell/cell.yaml)")
    lint_p.add_argument("--json", action="store_true", help="print one JSON object as the last line")
    lint_p.set_defaults(func=cmd_lint)

    keys = sub.add_parser("keys", help="the cell's cosign key pair in HMS_CELL_HOME")
    keys_sub = keys.add_subparsers(dest="keys_command", required=True)
    keys_init = keys_sub.add_parser("init", help="generate the key pair once (idempotent)")
    keys_init.add_argument("--generate-passphrase", action="store_true",
                           help="if HMS_COSIGN_PASSWORD is unset, write a random passphrase to HMS_CELL_HOME (mode 600)")
    keys_init.set_defaults(func=cmd_keys)

    registry = sub.add_parser("registry", help="the local registry")
    registry_sub = registry.add_subparsers(dest="registry_command", required=True)
    registry_sub.add_parser("up", help="create or start the registry and its networks (idempotent)").set_defaults(
        func=cmd_registry)

    imgs = sub.add_parser("images", help="mirror, sign and verify the pinned images")
    imgs.add_argument("action", choices=("mirror", "sign", "verify"))
    imgs.add_argument("--profile", default="lite", choices=("lite", "dev"))
    imgs.add_argument("--only", action="append", help="only this image (repeatable)")
    imgs.add_argument("--evidence", action="store_true", help="verify only: write the evidence record")
    imgs.add_argument("--evidence-dir", help="verify only: write the record into this directory instead")
    imgs.add_argument("--json", action="store_true")
    imgs.set_defaults(func=cmd_images)

    charts_p = sub.add_parser("charts", help="fetch and verify the pinned charts and manifests in HMS_CELL_HOME")
    charts_p.add_argument("action", choices=("fetch", "verify"))
    charts_p.add_argument("--json", action="store_true")
    charts_p.set_defaults(func=cmd_charts)

    up = sub.add_parser("up", help="bring the cell up (S2 builds the substrate phase only)")
    up.add_argument("--only", required=True, choices=("substrate",),
                    help="the phase to run; the full 'cell up' comes in slice S7")
    start = sub.add_parser("start", help="start the stopped substrate and wait for it")
    stop = sub.add_parser("stop", help="stop the substrate's nodes and load balancer (the registry keeps running)")
    status = sub.add_parser("status", help="report the substrate's state without changing it")
    for p in (up, start, stop, status):
        p.add_argument("--profile", default="lite", choices=("lite", "dev"))
        p.add_argument("--json", action="store_true", help="print one JSON object as the last line")
        p.set_defaults(func=cmd_substrate)

    chaos = sub.add_parser("chaos", help="chaos scenarios on the cell (tests/chaos/scenarios)")
    chaos.add_argument("scenario", choices=("cell-restart",))
    chaos.add_argument("--profile", default="lite", choices=("lite", "dev"))
    chaos.add_argument("--evidence", action="store_true", help="write chaos/<date>-<test>-<shortsha>[-dirty].json")
    chaos.add_argument("--evidence-dir", help="write the record into this directory instead")
    chaos.add_argument("--json", action="store_true")
    chaos.set_defaults(func=cmd_chaos)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
