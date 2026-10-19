"""Command line of the document renderer (docs/specs/modules/platform-docs.md §7.5). No network listener.

    python -I -m hms_docrender render --out out.pdf [--request req.json | --request -] [--font-dir DIR]
    python -I -m hms_docrender identity [--font-dir DIR]
    python -I -m hms_docrender doctor [--font-dir DIR]

Run with the runtime's own interpreter (``<runtime>/Scripts/python.exe`` on Windows, ``<runtime>/bin/python``
elsewhere). ``render`` reads one JSON request (contract/render-request.schema.json) from standard input, or from
``--request``, writes the PDF to ``--out`` and one JSON result (contract/render-result.schema.json) to standard
output. Exit codes: 0 rendered, 1 failed, 2 usage error, 3 invalid request, 4 refused. The PDF file appears only
on success (written to a temporary name beside it, then renamed).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from . import CONTRACT_VERSION

EXIT_OK, EXIT_FAILED, EXIT_USAGE, EXIT_INVALID, EXIT_REFUSED = 0, 1, 2, 3, 4


def _emit(result: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(result, ensure_ascii=False, sort_keys=True) + "\n")
    sys.stdout.flush()


def _result(status: str, **fields: Any) -> dict[str, Any]:
    return {"contractVersion": CONTRACT_VERSION, "status": status, **fields}


def cmd_render(args: argparse.Namespace) -> int:
    from .contract import InvalidRequest, RenderRequest
    from .render import RenderFailed, RenderRefused, render

    try:
        if args.request in (None, "-"):
            text = sys.stdin.buffer.read().decode("utf-8")
        else:
            text = Path(args.request).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        _emit(_result("invalid", errors=[f"$: cannot read the request as UTF-8 ({type(exc).__name__})"]))
        return EXIT_INVALID
    try:
        request = RenderRequest.from_text(text)
    except InvalidRequest as exc:
        _emit(_result("invalid", errors=exc.errors))
        return EXIT_INVALID
    out = Path(args.out)
    try:
        result = render(request, font_dir=Path(args.font_dir) if args.font_dir else None)
    except RenderRefused as exc:
        _emit(_result("refused", code=exc.code, detail=exc.detail))
        return EXIT_REFUSED
    except RenderFailed as exc:
        _emit(_result("failed", code=exc.code, detail=exc.detail))
        return EXIT_FAILED
    temporary = out.with_name(out.name + ".partial")
    try:
        temporary.write_bytes(result.pdf)
        os.replace(temporary, out)
    except OSError as exc:
        temporary.unlink(missing_ok=True)
        _emit(_result("failed", code="runtime-error", detail=f"cannot write {out}: {exc}"))
        return EXIT_FAILED
    _emit(_result(
        "rendered", out=str(out), bytes=len(result.pdf), sha256=result.sha256, pageCount=result.page_count,
        rendererIdentity=result.renderer_identity, identityHash=result.identity_hash,
    ))
    return EXIT_OK


def cmd_identity(args: argparse.Namespace) -> int:
    from .env import EnvironmentRefused, RuntimeMissing, load_runtime
    from .fonts import FontIntegrityError, FontSet
    from .identity import compute

    try:
        identity = compute(load_runtime(), FontSet.load(Path(args.font_dir) if args.font_dir else None))
    except (RuntimeMissing, EnvironmentRefused, FontIntegrityError) as exc:
        _emit({"status": "failed", "detail": str(exc)})
        return EXIT_FAILED
    _emit({"status": "ok", **identity.as_json()})
    return EXIT_OK


def cmd_doctor(args: argparse.Namespace) -> int:
    """The runtime's state without rendering: native library versions (bootstrap.py records them) and the fonts."""
    from .env import EnvironmentRefused, RuntimeMissing, load_runtime
    from .fonts import FontIntegrityError, FontSet
    from .identity import native_versions, python_versions

    report: dict[str, Any] = {"status": "ok"}
    try:
        runtime = load_runtime()
        report["runtime"] = str(runtime.dir)
        report["native"] = native_versions(runtime)
        report["python"] = python_versions()
    except (RuntimeMissing, EnvironmentRefused) as exc:
        _emit({"status": "failed", "detail": str(exc)})
        return EXIT_FAILED
    try:
        fonts = FontSet.load(Path(args.font_dir) if args.font_dir else None)
        report["fonts"] = {"dir": str(fonts.dir), "status": "verified", "sha256": fonts.sha256s()}
    except FontIntegrityError as exc:
        report["fonts"] = {"status": "unavailable", "detail": str(exc)}
    _emit(report)
    return EXIT_OK


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # usage errors exit 2 with a JSON line, like every other outcome
        _emit({"contractVersion": CONTRACT_VERSION, "status": "failed", "code": "runtime-error", "detail": f"usage: {message}"})
        sys.exit(EXIT_USAGE)


def main(argv: list[str] | None = None) -> int:
    parser = _Parser(prog="python -m hms_docrender", description="HMS document renderer (HTML to PDF/A-2b, offline).")
    sub = parser.add_subparsers(dest="command", required=True)
    render = sub.add_parser("render", help="render one JSON request to a PDF")
    render.add_argument("--request", help="request JSON file, or - for standard input (the default)")
    render.add_argument("--out", required=True, help="the PDF file to write")
    render.add_argument("--font-dir", help="the print-font directory (default: HMS_DOCRENDER_FONT_DIR or the module's)")
    for name, text in (("identity", "print the renderer identity"), ("doctor", "check the runtime and the fonts")):
        command = sub.add_parser(name, help=text)
        command.add_argument("--font-dir", help="the print-font directory")
    args = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")  # JSON and messages are UTF-8 whatever the console code page
    return {"render": cmd_render, "identity": cmd_identity, "doctor": cmd_doctor}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
