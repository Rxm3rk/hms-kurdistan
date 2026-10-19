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
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
