"""Shared helpers for the renderer tests (docs/specs/modules/platform-docs.md §7.5, §10).

Run the suite with the runtime's interpreter:
    <runtime>/Scripts/python.exe -I -m unittest discover -s backend/satellites/document-renderer/tests -t backend/satellites/document-renderer
Tests that need the print fonts skip, naming the missing file, until the font directory is complete; every other
test needs the renderer runtime and fails (never skips) without it.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import unittest
import zlib
from pathlib import Path
from typing import Any

from hms_docrender.contract import RenderRequest
from hms_docrender.env import load_runtime, subprocess_env
from hms_docrender.fonts import FONT_FILES, FONTS_JSON, font_dir_default

SATELLITE = Path(__file__).resolve().parents[1]
FIXTURES = SATELLITE / "hms_docrender" / "golden" / "selftest-fixtures"
CREATED = "2026-01-01T00:00:00Z"

FONT_FACES = """
@font-face { font-family: "HMS Arabic"; font-weight: 400; src: url(hms-font:noto-sans-arabic-regular); }
@font-face { font-family: "HMS Arabic"; font-weight: 700; src: url(hms-font:noto-sans-arabic-bold); }
@font-face { font-family: "HMS Latin"; font-weight: 400; src: url(hms-font:noto-sans-regular); }
@font-face { font-family: "HMS Latin"; font-weight: 700; src: url(hms-font:noto-sans-bold); }
"""
FAMILIES = {"HMS-Arabic", "HMS-Arabic-Bold", "HMS-Latin", "HMS-Latin-Bold"}


def missing_fonts() -> str | None:
    """None when the font directory is complete, else a reason that names the first missing file."""
    directory = font_dir_default()
    for name in (FONTS_JSON, *FONT_FILES.values()):
        if not (directory / name).is_file():
            return f"print font file missing: {directory / name}"
    return None


requires_fonts = unittest.skipIf(missing_fonts() is not None, missing_fonts() or "")


def html_document(body: str, *, lang: str = "en", direction: str = "ltr", head: str = "") -> str:
    return (
        f'<!DOCTYPE html><html lang="{lang}" dir="{direction}"><head><meta charset="utf-8"><title>SYN test</title>'
        f"<style>{FONT_FACES}@page {{ size: A6; margin: 8mm; }} body {{ font-family: \"HMS Latin\", \"HMS Arabic\"; font-size: 11pt; }}</style>"
        f"{head}</head><body>{body}</body></html>"
    )


SAMPLE_BODY = (
    '<p>SYN-000123-7 · Shilan Ahmed Karim · SYNTHETIC – NOT FOR CLINICAL USE</p>'
    '<p dir="rtl" lang="ckb" style="font-family: \'HMS Arabic\'">شیلان ئەحمەد کەریم — پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە</p>'
    '<p dir="rtl" lang="ar" style="font-family: \'HMS Arabic\'; font-weight: 700">شيلان أحمد كريم</p>'
)


def make_request(html: str | None = None, **overrides: Any) -> RenderRequest:
    fields = {
        "html": html if html is not None else html_document(SAMPLE_BODY),
        "title": "SYN renderer test",
        "template_id": "SYN-TEST-DOC",
        "template_version": 1,
        "template_content_hash": "a" * 64,
        "provenance": "synthetic",
        "language": "en",
        "created_at": CREATED,
    }
    fields.update(overrides)
    return RenderRequest(**fields)


def run_cli(args: list[str], stdin: str = "") -> tuple[int, dict[str, Any]]:
    """Run ``python -I -m hms_docrender`` in a fresh hermetic process; (exit code, the JSON result)."""
    proc = subprocess.run(
        [sys.executable, "-I", "-m", "hms_docrender", *args],
        input=stdin.encode("utf-8"), capture_output=True, env=subprocess_env(load_runtime()), cwd=str(SATELLITE),
    )
    lines = proc.stdout.decode("utf-8").strip().splitlines()
    if not lines:
        raise AssertionError(f"no JSON result (exit {proc.returncode}): {proc.stderr.decode('utf-8', 'replace')[-2000:]}")
    return proc.returncode, json.loads(lines[-1])


def pdf_objects(pdf: bytes) -> bytes:
    """The PDF's bytes plus every stream decompressed (object streams hold most dictionaries)."""
    parts = [pdf]
    for match in re.finditer(rb"stream\r?\n", pdf):
        start = match.end()
        end = pdf.find(b"endstream", start)
        chunk = pdf[start:end]
        try:
            parts.append(zlib.decompress(chunk))
        except zlib.error:
            parts.append(chunk)
    return b"\n".join(parts)
