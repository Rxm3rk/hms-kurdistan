"""Rendering: determinism, PDF/A-2b markers, metadata from the request, the command line and the identity.

docs/specs/modules/platform-docs.md §7.5 (UnitTest:pdf-deterministic, PDF/A-2b with embedded fonts and an sRGB
output intent; veraPDF validation is the golden step's PdfaCheck:veraPDF-2b, not this test) and §10 (identity).
"""

from __future__ import annotations

import hashlib
import json
import re
import tempfile
import unittest
from pathlib import Path

from hms_docrender.contract import result_errors
from hms_docrender.env import load_runtime
from hms_docrender.fonts import FontSet
from hms_docrender import identity as identity_module
from hms_docrender.render import render
from tests.support import CREATED, FAMILIES, FIXTURES, html_document, make_request, pdf_objects, requires_fonts, run_cli


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
class RendererIdentityTest(unittest.TestCase):
    """The renderer identity of §10: library versions as loaded and the four font hashes."""

    def test_identity_names_every_component(self) -> None:
        runtime = load_runtime()
        fonts = FontSet.load()
        identity = identity_module.compute(runtime, fonts)
        components = dict(identity.components)
        for key in ("hms_docrender", "weasyprint", "pydyf", "fonttools", "pillow", "pango", "harfbuzz", "freetype",
                    "fontconfig", "pypdfium2", "pdfium"):
            self.assertIn(key, components)
        self.assertEqual(components["weasyprint"], "70.0")
        self.assertEqual(components["pypdfium2"], "5.14.0")
        for file, digest in fonts.sha256s().items():
            self.assertEqual(components[f"font:{file}"], digest)
        self.assertEqual(components["pango"], runtime.info["native"]["pango"])
        self.assertRegex(identity.hash, r"^[0-9a-f]{16}$")
        self.assertEqual(render(make_request()).renderer_identity, identity.text)


if __name__ == "__main__":
    unittest.main()
