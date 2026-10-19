"""Rendering: determinism, PDF/A-2b markers, metadata from the request, the command line and the identity, with the
regression tests of the WP-0.8 renderer reviews (correctness 2, 5, 6, 8, 9, 12; safety 5).

docs/specs/modules/platform-docs.md §7.5 (UnitTest:pdf-deterministic, PDF/A-2b with embedded fonts and an sRGB
output intent; veraPDF validation is the golden step's PdfaCheck:veraPDF-2b, not this test) and §10 (identity).
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock

from hms_docrender.contract import result_errors
from hms_docrender.env import EnvironmentRefused, check_loader_environment, load_runtime, subprocess_env
from hms_docrender.fonts import FontSet
from hms_docrender import identity as identity_module
from hms_docrender.render import RenderFailed, RenderRefused, render
from tests.support import (
    CREATED, FAMILIES, FIXTURES, SATELLITE, html_document, make_request, pdf_objects, requires_fonts, run_cli,
)


@requires_fonts
class PdfDeterministicTest(unittest.TestCase):
    """UnitTest:pdf-deterministic: the same request on the same renderer identity gives the same bytes."""

    def test_two_renders_in_one_process_are_identical(self) -> None:
        first, second = render(make_request()), render(make_request())
        self.assertEqual(first.pdf, second.pdf)
        self.assertEqual(first.sha256, hashlib.sha256(first.pdf).hexdigest())

    def test_renders_in_separate_processes_are_identical_to_the_library_render(self) -> None:
        request = make_request(FIXTURES.joinpath("selftest-a4-trilingual.html").read_text(encoding="utf-8"), language="ckb")
        library = render(request)
        with tempfile.TemporaryDirectory() as tmp:
            hashes = []
            for run in (1, 2):
                out = Path(tmp) / f"run{run}.pdf"
                code, result = run_cli(["render", "--out", str(out)], json.dumps(request.to_json()))
                self.assertEqual(code, 0, result)
                self.assertEqual(out.read_bytes(), library.pdf)
                hashes.append(result["sha256"])
        self.assertEqual(hashes, [library.sha256, library.sha256])

    def test_the_creation_time_changes_only_with_the_request(self) -> None:
        later = render(make_request(created_at="2026-02-03T04:05:06+03:00"))
        self.assertNotEqual(later.pdf, render(make_request()).pdf)
        self.assertIn(b"D:20260203040506+03'00", pdf_objects(later.pdf))


@requires_fonts
class PdfIsPdfA2bTest(unittest.TestCase):
    """UnitTest:pdf-is-pdfa-2b-declared: XMP pdfaid part 2 conformance B, an sRGB output intent, every font embedded."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.result = render(make_request())
        cls.objects = pdf_objects(cls.result.pdf)

    def test_header_and_xmp_identification(self) -> None:
        self.assertTrue(self.result.pdf.startswith(b"%PDF-1.7"))
        xmp = re.search(rb"<x:xmpmeta.*?</x:xmpmeta>", self.objects, re.S)
        self.assertIsNotNone(xmp, "no XMP metadata stream")
        self.assertIn(b'pdfaid:part="2"', xmp.group(0))
        self.assertIn(b'pdfaid:conformance="B"', xmp.group(0))

    def test_srgb_output_intent(self) -> None:
        self.assertEqual(self.objects.count(b"/OutputIntents"), 1)
        self.assertIn(b"/GTS_PDFA1", self.objects)
        self.assertIn(b"/DestOutputProfile", self.objects)

    def test_every_font_is_embedded_and_is_a_print_font(self) -> None:
        descriptors = len(re.findall(rb"/Type\s*/FontDescriptor", self.objects))
        embedded = len(re.findall(rb"/FontFile2\s+\d+\s+0\s+R", self.objects))
        self.assertGreater(descriptors, 0)
        self.assertEqual(descriptors, embedded, "a font descriptor without an embedded TrueType font program")
        self.assertNotIn(b"/FontFile3", self.objects)
        names = {name.split(b"+", 1)[-1].decode() for name in re.findall(rb"/BaseFont\s*/([A-Za-z0-9+_-]+)", self.objects)}
        self.assertTrue(names, "no fonts")
        self.assertLessEqual(names, FAMILIES, f"a font that is not a print font: {names - FAMILIES}")

    def test_metadata_comes_from_the_request(self) -> None:
        self.assertIn(b"/Title (SYN renderer test)", self.objects)
        self.assertIn(b"/CreationDate (D:20260101000000Z)", self.objects)
        self.assertIn(b"/ModDate (D:20260101000000Z)", self.objects)
        self.assertIn(b"<xmp:CreateDate>" + CREATED.encode() + b"</xmp:CreateDate>", self.objects)
        self.assertIn(b"/Lang (en)", self.objects)
        self.assertIn(b"hms-template-id:SYN-TEST-DOC, hms-template-version:1, hms-template-sha256:" + b"a" * 64 + b", hms-provenance:synthetic", self.objects)
        self.assertEqual(self.result.page_count, 1)

    def test_html_dates_never_reach_the_pdf(self) -> None:
        head = '<meta name="dcterms.created" content="1999-09-09T09:09:09Z"><meta name="dcterms.modified" content="1999-09-09T09:09:09Z">'
        objects = pdf_objects(render(make_request(html_document("<p>SYN</p>", head=head))).pdf)
        self.assertNotIn(b"D:1999", objects)
        self.assertNotIn(b"1999-09-09", objects)
        self.assertIn(b"/CreationDate (D:20260101000000Z)", objects)

    def test_page_count(self) -> None:
        body = "".join('<p style="break-after: page">SYN page</p>' for _ in range(3))
        self.assertEqual(render(make_request(html_document(body))).page_count, 3)


@requires_fonts
class CommandLineTest(unittest.TestCase):
    """The command line of §7.5: request on stdin or from a file, PDF to --out, JSON result, exit codes."""

    def test_render_from_stdin_and_from_a_file(self) -> None:
        request = json.dumps(make_request().to_json())
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "out.pdf"
            code, result = run_cli(["render", "--out", str(out)], request)
            self.assertEqual((code, result["status"]), (0, "rendered"), result)
            self.assertEqual(result_errors(result), [])
            self.assertEqual(result["sha256"], hashlib.sha256(out.read_bytes()).hexdigest())
            self.assertEqual(result["pageCount"], 1)
            request_file = Path(tmp) / "req.json"
            request_file.write_text(request, encoding="utf-8")
            out2 = Path(tmp) / "out2.pdf"
            code, result2 = run_cli(["render", "--request", str(request_file), "--out", str(out2)])
            self.assertEqual(code, 0, result2)
            self.assertEqual(out2.read_bytes(), out.read_bytes())

    def test_invalid_refused_and_usage_exit_codes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "out.pdf"
            code, result = run_cli(["render", "--out", str(out)], json.dumps({"contractVersion": 1}))
            self.assertEqual((code, result["status"]), (3, "invalid"))
            self.assertEqual(result_errors(result), [])
            bad = make_request(html_document('<img src="https://example.invalid/x.png">')).to_json()
            code, result = run_cli(["render", "--out", str(out)], json.dumps(bad))
            self.assertEqual((code, result["status"], result["code"]), (4, "refused", "resource-refused"))
            self.assertEqual(result_errors(result), [])
            self.assertFalse(out.exists(), "no PDF is left behind on a refusal")
            self.assertFalse(Path(str(out) + ".partial").exists())
            code, result = run_cli(["render"])
            self.assertEqual(code, 2)


@requires_fonts
class CommandLineRobustnessTest(unittest.TestCase):
    """Review correctness 8 and 9: a stale --out never survives, and every outcome ends with one JSON line."""

    def test_a_stale_pdf_at_out_is_removed_on_refusal_invalid_and_failure(self) -> None:
        bad = json.dumps(make_request(html_document('<img src="https://example.invalid/x.png">')).to_json())
        for label, stdin in (("refused", bad), ("invalid", json.dumps({"contractVersion": 1})), ("not json", "{")):
            with self.subTest(case=label), tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp) / "out.pdf"
                out.write_bytes(b"%PDF-1.7 stale")
                Path(str(out) + ".partial").write_bytes(b"stale")
                code, result = run_cli(["render", "--out", str(out)], stdin)
                self.assertIn(code, (3, 4))
                self.assertEqual(result_errors(result), [])
                self.assertFalse(out.exists(), "a stale PDF was left at --out")
                self.assertFalse(Path(str(out) + ".partial").exists())

    def test_a_broken_runtime_json_gives_a_json_failure_not_a_traceback(self) -> None:
        runtime = load_runtime()
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "runtime"
            (fake / "pango" / "bin").mkdir(parents=True)
            (fake / "runtime.json").write_text("{not json", encoding="utf-8")
            env = subprocess_env(runtime)
            env["HMS_DOCRENDER_RUNTIME"] = str(fake)
            proc = subprocess.run([sys.executable, "-I", "-m", "hms_docrender", "render", "--out", str(Path(tmp) / "o.pdf")],
                                  input=json.dumps(make_request().to_json()).encode(), capture_output=True, env=env,
                                  cwd=str(SATELLITE))
            result = json.loads(proc.stdout.decode("utf-8").strip().splitlines()[-1])
            self.assertEqual((proc.returncode, result["status"], result["code"]), (1, "failed", "runtime-error"), result)
            self.assertEqual(result_errors(result), [])

    def test_an_unexpected_exception_gives_a_json_failure(self) -> None:
        from hms_docrender import __main__ as cli

        def explode(*args, **kwargs):
            raise RuntimeError("SYN-SECRET")

        class Escaping(BaseException):
            pass

        def escape(*args, **kwargs):
            raise Escaping("SYN-SECRET")

        for label, replacement in (("Exception", explode), ("BaseException", escape)):
            with self.subTest(case=label), tempfile.TemporaryDirectory() as tmp, \
                    mock.patch("hms_docrender.render.render", replacement), \
                    mock.patch.object(sys, "stdin", io.TextIOWrapper(io.BytesIO(json.dumps(make_request().to_json()).encode()))), \
                    mock.patch.object(sys, "stdout", io.TextIOWrapper(io.BytesIO(), encoding="utf-8")) as stdout:
                code = cli.main(["render", "--out", str(Path(tmp) / "o.pdf")])
                stdout.seek(0)
                result = json.loads(stdout.read().strip().splitlines()[-1])
                self.assertEqual((code, result["status"], result["code"]), (1, "failed", "runtime-error"))
                self.assertNotIn("SYN-SECRET", result["detail"])


@requires_fonts
class NoAttachmentTest(unittest.TestCase):
    """Review correctness 2: no attachment reaches the PDF (determinism, PDF/A-2b)."""

    PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGP4DwABAQEAG7buVgAAAABJRU5ErkJggg=="

    def test_an_attachment_link_is_refused(self) -> None:
        for body in (f'<p><a rel="attachment" href="{self.PNG}">SYN</a></p>',
                     f'<p><a rel="nofollow ATTACHMENT" href="{self.PNG}">SYN</a></p>',
                     f'<link rel="attachment" href="{self.PNG}"><p>SYN</p>'):
            with self.subTest(body=body[:40]), self.assertRaises(RenderRefused) as caught:
                render(make_request(html_document(body)))
            self.assertEqual((caught.exception.code, caught.exception.detail), ("resource-refused", "attachment-link=1"))

    def test_a_pdf_with_an_attachment_marker_is_refused_after_writing(self) -> None:
        """Even if an attachment got past the lint, the written PDF is scanned and refused."""
        from hms_docrender import checks

        with mock.patch.object(checks, "lint_document", lambda html, root: (Counter(), Counter())):
            with self.assertRaises(RenderFailed) as caught:
                render(make_request(html_document(f'<p><a rel="attachment" href="{self.PNG}">SYN</a></p>')))
        self.assertEqual(caught.exception.code, "render-error")
        self.assertIn("pdf-has-attachment", caught.exception.detail)
        self.assertEqual(checks.pdf_attachment_markers(render(make_request()).pdf), [])


@requires_fonts
class TitleTest(unittest.TestCase):
    """Review correctness 5: the PDF title follows R7, so the XMP packet stays well-formed (PDF/A-2b)."""

    def test_bad_titles_are_invalid_requests(self) -> None:
        for title in ("SYN\x01 title", "SYN ‮7-321000-NYS", "SYN \ud800", "SYN ￿", "SYN é"):
            with self.subTest(title=ascii(title)), tempfile.TemporaryDirectory() as tmp:
                data = make_request().to_json()
                data["title"] = title
                code, result = run_cli(["render", "--out", str(Path(tmp) / "o.pdf")], json.dumps(data))
                self.assertEqual((code, result["status"]), (3, "invalid"), result)
                self.assertTrue(all(error.startswith("$.title:") for error in result["errors"]), result["errors"])
                self.assertNotIn("SYN", " ".join(result["errors"]))

    def test_a_sorani_title_with_zwnj_renders_and_its_xmp_parses(self) -> None:
        from xml.etree import ElementTree

        objects = pdf_objects(render(make_request(title="SYN پ‌چ")).pdf)
        xmp = re.search(rb"<x:xmpmeta.*?</x:xmpmeta>", objects, re.S).group(0)
        ElementTree.fromstring(xmp)


@requires_fonts
class RendererIdentityTest(unittest.TestCase):
    """The renderer identity of §10: library versions as loaded, the configuration, the source and the font hashes."""

    def test_identity_names_every_component(self) -> None:
        runtime = load_runtime()
        fonts = FontSet.load()
        identity = identity_module.compute(runtime, fonts)
        components = dict(identity.components)
        # Review safety 5: tinycss2, cssselect2, tinyhtml5, pyphen, fribidi, the fontconfig file, zxing-cpp and a
        # hash of the source and requirements.txt are part of the identity too.
        for key in ("hms_docrender", "weasyprint", "pydyf", "fonttools", "pillow", "tinycss2", "cssselect2", "tinyhtml5",
                    "pyphen", "pango", "harfbuzz", "freetype", "fontconfig", "fribidi", "pypdfium2", "pdfium", "zxing-cpp",
                    "fontconfig-xml", "source"):
            self.assertIn(key, components)
        self.assertEqual(components["weasyprint"], "70.0")
        self.assertEqual(components["pypdfium2"], "5.14.0")
        self.assertEqual(components["zxing-cpp"], "3.1.1")
        self.assertEqual(components["fontconfig-xml"], runtime.info["fontconfig_sha256"])
        self.assertEqual(components["source"], identity_module.source_sha256())
        for file, digest in fonts.sha256s().items():
            self.assertEqual(components[f"font:{file}"], digest)
        for name in ("pango", "harfbuzz", "freetype", "fontconfig", "fribidi"):
            self.assertEqual(components[name], runtime.info["native"][name])
        self.assertRegex(identity.hash, r"^[0-9a-f]{16}$")
        self.assertEqual(render(make_request()).renderer_identity, identity.text)

    def test_the_source_hash_changes_with_any_source_file_and_ignores_line_endings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            package = Path(tmp) / "hms_docrender"
            shutil.copytree(identity_module.PACKAGE_DIR, package, ignore=shutil.ignore_patterns("__pycache__"))
            shutil.copyfile(identity_module.REQUIREMENTS_TXT, Path(tmp) / "requirements.txt")
            with mock.patch.object(identity_module, "PACKAGE_DIR", package), \
                    mock.patch.object(identity_module, "REQUIREMENTS_TXT", Path(tmp) / "requirements.txt"):
                original = identity_module.source_sha256()
                checks_file = package / "checks.py"
                text = checks_file.read_bytes()
                checks_file.write_bytes(text.replace(b"\n", b"\r\n"))
                self.assertEqual(identity_module.source_sha256(), original, "line endings are not part of the identity")
                checks_file.write_bytes(text + b"\n# changed\n")
                self.assertNotEqual(identity_module.source_sha256(), original)
                checks_file.write_bytes(text)
                (Path(tmp) / "requirements.txt").write_text("changed\n", encoding="utf-8")
                self.assertNotEqual(identity_module.source_sha256(), original)


class LoaderEnvironmentTest(unittest.TestCase):
    """Review correctness 12: on Linux a process started with LD_PRELOAD or LD_LIBRARY_PATH is refused, not scrubbed."""

    def test_loader_variables_refuse_on_posix_and_are_ignored_on_windows(self) -> None:
        for name in ("LD_PRELOAD", "LD_LIBRARY_PATH", "LD_AUDIT", "DYLD_INSERT_LIBRARIES"):
            with self.subTest(name=name), self.assertRaises(EnvironmentRefused) as caught:
                check_loader_environment({name: "/tmp/x.so", "PATH": "/usr/bin"}, windows=False)
            self.assertIn(name, str(caught.exception))
        check_loader_environment({"PATH": "/usr/bin", "LANG": "C.UTF-8"}, windows=False)
        check_loader_environment({"LD_PRELOAD": "x"}, windows=True)

    def test_the_child_environment_keeps_the_font_directory(self) -> None:
        """Review correctness 6: a child render uses the same font directory as its parent."""
        with mock.patch.dict(os.environ, {"HMS_DOCRENDER_FONT_DIR": "SYN-fonts", "LD_PRELOAD": "x"}):
            env = subprocess_env(load_runtime())
        self.assertEqual(env["HMS_DOCRENDER_FONT_DIR"], "SYN-fonts")
        self.assertNotIn("LD_PRELOAD", env)


if __name__ == "__main__":
    unittest.main()
