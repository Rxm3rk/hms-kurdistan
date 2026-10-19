"""Self-test of the PDF golden-image harness (docs/specs/modules/platform-docs.md §6.1, §6.2, §10).

In temporary directories: a missing approved set fails closed and writes candidates (never into the goldens); approve
then check passes; a one-pixel change fails with a difference image; a hand-edited golden fails its manifest hash; a
barcode that does not decode to its declared payload fails and cannot be approved; a renderer identity change is
compared with the last approved set and needs an explicit flag to approve.

With the regression tests of the WP-0.8 renderer reviews: safety 2 (identity change), 6 (raw barcode content, square
ECC 200), 7 and 8 (self-test fixtures) and correctness 10 (check never writes into the goldens) and 11 (approve
validates the candidate manifest's names).
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from hms_docrender.golden import __main__ as golden_cli
from hms_docrender.golden.harness import (
    CANDIDATE_SCHEMA, SET_SCHEMA, HarnessError, approve, check, decode_barcodes, load_fixture, load_png, load_set,
    parse_payloads,
)
from tests.support import FIXTURES, requires_fonts

FIXTURE = "selftest-wristband-datamatrix"
PAYLOAD = "datamatrix:HMS1|M:SYN-000123-7|E:SYN-E-000045|B:SYN-J-000001"
OLD_HASH = "0000000000000000"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class PayloadConventionTest(unittest.TestCase):
    def test_the_meta_convention(self) -> None:
        self.assertEqual(parse_payloads(f"{PAYLOAD}  code128:SYN-S-000077"),
                         [("code128", "SYN-S-000077"), ("datamatrix", PAYLOAD.split(":", 1)[1])])
        self.assertEqual(parse_payloads(""), [])
        for bad in ("SYN-S-000077", "ean13:123", "code128:", "code128:SYNé"):
            with self.subTest(token=bad), self.assertRaises(HarnessError):
                parse_payloads(bad)

    def test_fixture_metadata_becomes_the_request(self) -> None:
        fixture = load_fixture(FIXTURES / f"{FIXTURE}.html")
        self.assertEqual(fixture.request.template_id, "SYN-SELFTEST-WRISTBAND")
        self.assertEqual(fixture.request.created_at, "2026-01-01T00:00:00Z")
        self.assertEqual(fixture.payloads, parse_payloads(PAYLOAD))
        self.assertEqual(fixture.defaulted, [])


class SelfTestFixturesTest(unittest.TestCase):
    """Review safety 7 and 8: the fixtures print what the module prints (square ECC 200, R5 dates of birth)."""

    def test_the_wristband_datamatrix_is_square(self) -> None:
        text = (FIXTURES / f"{FIXTURE}.html").read_text(encoding="utf-8")
        view_box = re.search(r'<div class="barcode"><svg [^>]*viewBox="0 0 (\d+) (\d+)"', text)
        self.assertIsNotNone(view_box)
        self.assertEqual(view_box.group(1), view_box.group(2), "a DMRE rectangle, not a square ECC 200 symbol")

    def test_every_date_of_birth_is_the_same_approximate_year_with_the_marker(self) -> None:
        for path in sorted(FIXTURES.glob("*.html")):
            body = path.read_text(encoding="utf-8").split("<body>", 1)[1]
            with self.subTest(fixture=path.name):
                self.assertNotIn("1990-01-01", body, "a placeholder day and month (R5)")
                self.assertNotIn("approx. 1990", body)
                self.assertEqual(re.findall(r"(?<![~\d-])1990(?![\d-])", body), [], "a year without the ~ marker (R5)")
        a4 = (FIXTURES / "selftest-a4-trilingual.html").read_text(encoding="utf-8")
        self.assertEqual(a4.split("<body>", 1)[1].count("~1990"), 2, "the Sorani and the Arabic row")
        self.assertIn("~1990", (FIXTURES / f"{FIXTURE}.html").read_text(encoding="utf-8"))


class BarcodeDecodeTest(unittest.TestCase):
    """Review safety 6: raw content (plain text mode), symbology identifier and square ECC 200 are checked."""

    @staticmethod
    def image(content: str, symbology: str, **options):
        import zxingcpp
        from PIL import Image

        raw = zxingcpp.create_barcode(content, getattr(zxingcpp.BarcodeFormat, symbology), **options).to_image(scale=6)
        symbol = Image.frombuffer("L", (raw.shape[1], raw.shape[0]), bytes(raw), "raw", "L", 0, 1)
        page = Image.new("L", (symbol.width + 80, symbol.height + 80), 255)
        page.paste(symbol, (40, 40))
        return page

    def test_square_ecc200_and_plain_code128_pass(self) -> None:
        payload = PAYLOAD.split(":", 1)[1]
        self.assertEqual(decode_barcodes(self.image(payload, "DataMatrix", forceSquare=True)), ([("datamatrix", payload)], []))
        self.assertEqual(decode_barcodes(self.image("SYN-S-000077", "Code128")), ([("code128", "SYN-S-000077")], []))

    def test_a_dmre_rectangle_is_a_problem(self) -> None:
        decoded, problems = decode_barcodes(self.image(PAYLOAD.split(":", 1)[1], "DataMatrix"))
        self.assertEqual(len(decoded), 1)
        self.assertTrue(any("not a square ECC 200 symbol" in problem for problem in problems), problems)

    def test_gs1_content_is_a_problem_and_compared_raw(self) -> None:
        decoded, problems = decode_barcodes(self.image("(01)09501101530003", "DataMatrix", gs1=True, forceSquare=True))
        self.assertEqual(decoded, [("datamatrix", "0109501101530003")], "the raw content, not the GS1 human-readable form")
        self.assertTrue(any("]d2" in problem for problem in problems), problems)
        _, problems = decode_barcodes(self.image("(01)09501101530003", "Code128", gs1=True))
        self.assertTrue(any("]C1" in problem for problem in problems), problems)


class GoldenDirectoryIntegrityTest(unittest.TestCase):
    """Review correctness 10 and 11, without rendering: the goldens are never written by check, approve validates."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.fixtures, self.goldens, self.candidates = self.root / "fixtures", self.root / "goldens", self.root / "candidates"
        for directory in (self.fixtures, self.goldens):
            directory.mkdir()
        shutil.copyfile(FIXTURES / f"{FIXTURE}.html", self.fixtures / f"{FIXTURE}.html")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_pdf_out_and_report_inside_the_goldens_are_refused(self) -> None:
        with self.assertRaises(HarnessError):
            check(self.fixtures, self.goldens, self.candidates, pdf_out=self.goldens / "pdf")
        with self.assertRaises(HarnessError):
            check(self.fixtures, self.goldens, self.candidates, pdf_out=self.goldens)
        output = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")
        with redirect_stdout(output):
            code = golden_cli.main(["check", "--fixtures", str(self.fixtures), "--goldens", str(self.goldens),
                                    "--candidates", str(self.candidates), "--report", str(self.goldens / "abc" / "report.json")])
        self.assertEqual(code, 2)
        self.assertEqual(list(self.goldens.iterdir()), [])
        self.assertFalse(self.candidates.exists())

    def test_a_stray_file_in_a_golden_set_fails_its_integrity_check(self) -> None:
        set_dir = self.goldens / "1234567890abcdef"
        set_dir.mkdir()
  