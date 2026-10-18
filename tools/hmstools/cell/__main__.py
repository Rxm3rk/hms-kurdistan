"""tools/hms cell <command>: dev-cell and compose-stack tooling (BUILD-PROMPT.md WP-0.2).

  worm --endpoint URL --label NAME [--cell compose|lite|dev|reference] [--state FILE] [--evidence] [--json]
      Run the object-store WORM test. Credentials come from HMS_S3_ACCESS_KEY and HMS_S3_SECRET_KEY.
      --state FILE keeps the locked object's bucket, version and SHA-256 for a later re-check.
  worm --recheck FILE --endpoint URL --label NAME ...
      After restarting the server: the same locked version still refuses deletion and is unchanged.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from ..common import repo_root
from . import evidence
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
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
