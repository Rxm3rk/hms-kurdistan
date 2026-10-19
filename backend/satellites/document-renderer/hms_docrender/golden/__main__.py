"""Command line of the PDF golden-image harness (docs/specs/modules/platform-docs.md §10).

    python -I -m hms_docrender.golden check --fixtures DIR --goldens DIR --candidates DIR
                                            [--font-dir DIR] [--pdf-out DIR] [--decode-dpi N] [--report FILE]
    python -I -m hms_docrender.golden approve --candidates DIR --goldens DIR --approver NAME
                                              [--identity-hash H] [--replace-existing]

Run with the renderer runtime's interpreter. ``check`` exits 0 when every page of every fixture matches its approved
golden pixel for pixel and every barcode decodes to its declared payload; 1 when anything differs, is missing or
fails (candidates, difference images and a manifest are then in ``<candidates>/<identity-hash>/``); 2 on a usage
error; 3 when the renderer runtime is missing. ``approve`` is for a human or the integrator only.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..env import RuntimeMissing
from .harness import DPI, HarnessError, approve, check


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m hms_docrender.golden", description="PDF golden-image harness.")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("check", help="render, rasterise and compare every fixture")
    run.add_argument("--fixtures", required=True, type=Path)
    run.add_argument("--goldens", required=True, type=Path)
    run.add_argument("--candidates", required=True, type=Path)
    run.add_argument("--font-dir", type=Path)
    run.add_argument("--pdf-out", type=Path, help="also write every rendered PDF here (for the veraPDF step)")
    run.add_argument("--decode-dpi", type=int, default=DPI, help=f"raster resolution for the barcode decode (default {DPI}, the golden raster)")
    run.add_argument("--report", type=Path, help="also write the JSON summary to this file")
    ok = sub.add_parser("approve", help="copy a candidate set into the goldens directory (human or integrator only)")
    ok.add_argument("--candidates", required=True, type=Path)
    ok.add_argument("--goldens", required=True, type=Path)
    ok.add_argument("--approver", required=True)
    ok.add_argument("--identity-hash")
    ok.add_argument("--replace-existing", action="store_true")
    args = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")  # JSON and messages are UTF-8 whatever the console code page
    try:
        if args.command == "check":
            summary = check(args.fixtures, args.goldens, args.candidates, font_dir=args.font_dir,
                            pdf_out=args.pdf_out, decode_dpi=args.decode_dpi)
        else:
            summary = approve(args.candidates, args.goldens, args.approver, identity_hash=args.identity_hash,
                              replace_existing=args.replace_existing)
    except RuntimeMissing as exc:
        summary = {"status": "fail", "reasons": [str(exc)]}
        print(json.dumps(summary, ensure_ascii=False))
        return 3
    except HarnessError as exc:
        summary = {"status": "fail", "reasons": [str(exc)]}
        print(json.dumps(summary, ensure_ascii=False))
        return exc.exit_code
    text = json.dumps(summary, indent=2, ensure_ascii=False)
    if getattr(args, "report", None):
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text + "\n", encoding="utf-8", newline="\n")
    print(text)
    fixtures = summary.get("fixtures")
    for stem, entry in (fixtures.items() if isinstance(fixtures, dict) else ()):
        line = f"{entry['status'].upper():4} {stem}" + (f": {'; '.join(entry['reasons'])}" if entry["reasons"] else "")
        print(line, file=sys.stderr)
    for reason in summary.get("reasons") or []:
        print(f"FAIL {reason}", file=sys.stderr)
    return 0 if summary["status"] in ("pass", "approved") else 1


if __name__ == "__main__":
    sys.exit(main())
