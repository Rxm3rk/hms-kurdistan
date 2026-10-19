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
        (set_dir / f"{FIXTURE}-p1.png").write_bytes(b"png")
        manifest = {"schema": SET_SCHEMA, "identity": "SYN-identity",
                    "fixtures": {FIXTURE: {"pages": 1, "files": {f"{FIXTURE}-p1.png": sha256(set_dir / f"{FIXTURE}-p1.png")}}}}
        (set_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        self.assertEqual(load_set(set_dir, "SYN-identity")[1], [])
        (set_dir / f"{FIXTURE}.pdf").write_bytes(b"%PDF")
        (set_dir / "sub").mkdir()
        problems = load_set(set_dir, "SYN-identity")[1]
        self.assertTrue(any(f"{FIXTURE}.pdf is not in the manifest" in p for p in problems), problems)
        self.assertTrue(any("sub in the golden set is not a file" in p for p in problems), problems)

    def candidate_set(self, files: dict[str, bytes], *, pages: int | None = None, stem: str = FIXTURE) -> Path:
        directory = self.candidates / "1234567890abcdef"
        directory.mkdir(parents=True, exist_ok=True)
        digests = {}
        for name, data in files.items():
            path = directory / name
            if path.resolve().is_relative_to(directory.resolve()):
                path.write_bytes(data)
            digests[name] = hashlib.sha256(data).hexdigest()
        manifest = {"schema": CANDIDATE_SCHEMA, "identity": "SYN-identity", "identity_hash": directory.name, "raster": {},
                    "reasons": [], "previous_set": None,
                    "fixtures": {stem: {"status": "no-golden", "reasons": [], "html_sha256": "0" * 64, "template": {},
                                        "pages": len(files) if pages is None else pages, "files": digests,
                                        "barcodes": {"expected": None, "decoded": []}}}}
        (directory / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        return directory

    def test_approve_refuses_unsafe_or_inconsistent_names(self) -> None:
        outside = self.root / "escaped.png"
        cases = {
            "parent traversal": ({f"..\\..\\escaped.png": b"x"}, None, FIXTURE),
            "posix traversal": ({"../../escaped.png": b"x"}, None, FIXTURE),
            "absolute": ({str(outside): b"x"}, None, FIXTURE),
            "another fixture's page": ({"other-p1.png": b"x"}, None, FIXTURE),
            "not a page file": ({f"{FIXTURE}.pdf": b"x"}, None, FIXTURE),
            "page count mismatch": ({f"{FIXTURE}-p1.png": b"x"}, 2, FIXTURE),
            "numbering gap": ({f"{FIXTURE}-p1.png": b"x", f"{FIXTURE}-p3.png": b"y"}, None, FIXTURE),
            "bad stem": ({"..-p1.png": b"x"}, None, ".."),
        }
        for label, (files, pages, stem) in cases.items():
            with self.subTest(case=label):
                shutil.rmtree(self.candidates, ignore_errors=True)
                self.candidate_set(files, pages=pages, stem=stem)
                with self.assertRaises(HarnessError) as caught:
                    approve(self.candidates, self.goldens, "SYN approver (test)")
                self.assertEqual(caught.exception.exit_code, 1, str(caught.exception))
                self.assertEqual(list(self.goldens.iterdir()), [])
                self.assertFalse(outside.exists())

    def test_a_valid_hand_made_candidate_set_approves(self) -> None:
        self.candidate_set({f"{FIXTURE}-p1.png": b"x", f"{FIXTURE}-p2.png": b"y"})
        result = approve(self.candidates, self.goldens, "SYN approver (test)")
        self.assertEqual(sorted(p.name for p in Path(result["goldenSet"]).iterdir()),
                         ["manifest.json", f"{FIXTURE}-p1.png", f"{FIXTURE}-p2.png"])
        self.assertIsNone(result["identityChange"])


@requires_fonts
class GoldenHarnessSelfTest(unittest.TestCase):
    """GoldenImage harness self-test: fail closed, approve, pass, one pixel fails, tamper fails, barcode mismatch fails."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.fixtures, self.goldens, self.candidates = root / "fixtures", root / "goldens", root / "candidates"
        self.pdf_out = root / "pdf"
        self.fixtures.mkdir()
        self.goldens.mkdir()
        shutil.copyfile(FIXTURES / f"{FIXTURE}.html", self.fixtures / f"{FIXTURE}.html")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def run_check(self) -> dict:
        return check(self.fixtures, self.goldens, self.candidates, pdf_out=self.pdf_out)

    def test_fail_closed_then_approve_then_pass_then_one_pixel_fails(self) -> None:
        # 1. No approved set for this identity: fails closed, writes candidates, leaves the goldens untouched.
        first = self.run_check()
        self.assertEqual(first["status"], "fail")
        self.assertTrue(any(r.startswith("no approved golden images for ") for r in first["reasons"]), first["reasons"])
        self.assertIsNone(first["previousSet"])
        self.assertEqual(list(self.goldens.iterdir()), [], "the check wrote into the goldens directory")
        self.assertTrue((self.pdf_out / f"{FIXTURE}.pdf").is_file())
        candidate_dir = Path(first["candidates"])
        manifest = json.loads((candidate_dir / "manifest.json").read_text(encoding="utf-8"))
        self.assertIn(f"{FIXTURE}-p1.png", manifest["fixtures"][FIXTURE]["files"])
        self.assertEqual(manifest["fixtures"][FIXTURE]["barcodes"]["decoded"], [PAYLOAD])
        self.assertEqual(manifest["fixtures"][FIXTURE]["reasons"], [], "the square ECC 200 self-test symbol has no problem")
        self.assertEqual(load_png(candidate_dir / f"{FIXTURE}-p1.png").mode, "L")

        # 2. Approve (a human or the integrator), then the same check passes.
        approved = approve(self.candidates, self.goldens, "SYN approver (test)")
        self.assertEqual(approved["human_script_review"], "requested")
        set_dir = Path(approved["goldenSet"])
        golden_manifest = json.loads((set_dir / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(golden_manifest["human_script_review"], "requested")
        self.assertEqual(golden_manifest["identity"], first["identity"])
        self.assertEqual(golden_manifest["fixtures"][FIXTURE]["template"]["id"], "SYN-SELFTEST-WRISTBAND")
        shutil.rmtree(self.candidates)
        second = self.run_check()
        self.assertEqual(second["status"], "pass", second)
        self.assertEqual(second["fixtures"][FIXTURE]["pages"][0]["status"], "match")
        self.assertIsNone(second["candidates"])

        # 3. One pixel differs in an approved golden (manifest updated to match): fails, with a difference image.
        golden = set_dir / f"{FIXTURE}-p1.png"
        image = load_png(golden)
        x, y = image.size[0] // 2, image.size[1] - 2
        image.putpixel((x, y), 255 - image.getpixel((x, y)))
        image.save(golden, format="PNG")
        golden_manifest["fixtures"][FIXTURE]["files"][golden.name] = sha256(golden)
        (set_dir / "manifest.json").write_text(json.dumps(golden_manifest), encoding="utf-8")
        third = self.run_check()
        self.assertEqual(third["status"], "fail")
        page = third["fixtures"][FIXTURE]["pages"][0]
        self.assertEqual((page["status"], page["differing_pixels"]), ("differs", 1))
        self.assertTrue((Path(third["candidates"]) / f"{FIXTURE}-p1.diff.png").is_file())
        self.assertEqual(sha256(golden), golden_manifest["fixtures"][FIXTURE]["files"][golden.name],
                         "the check never rewrites an approved golden")

        # 4. A golden edited without its manifest: the set fails its integrity check.
        image.putpixel((x, y), image.getpixel((x, y)) ^ 0x10)
        image.save(golden, format="PNG")
        fourth = self.run_check()
        self.assertEqual(fourth["status"], "fail")
        self.assertTrue(any("does not match the SHA-256 in its manifest" in r for r in fourth["reasons"]), fourth["reasons"])

        # 5. Replacing an approved set needs --replace-existing.
        with self.assertRaises(HarnessError):
            approve(self.candidates, self.goldens, "SYN approver (test)")

    def test_a_renderer_identity_change_is_compared_and_needs_an_explicit_flag(self) -> None:
        """Review safety 2: an upgrade's new identity is diffed against the last approved set, never approved blind."""
        first = self.run_check()
        approve(self.candidates, self.goldens, "SYN approver (test)")
        shutil.rmtree(self.candidates)
        # Make the approved set look like an older identity's set, with one pixel that the new renderer draws differently.
        old = self.goldens / OLD_HASH
        (self.goldens / first["identityHash"]).rename(old)
        manifest = json.loads((old / "manifest.json").read_text(encoding="utf-8"))
        manifest.update(identity="hms-docrender-identity/1;SYN-older-renderer", identity_hash=OLD_HASH,
                        approved_at="2026-01-01T00:00:00Z")
        golden = old / f"{FIXTURE}-p1.png"
        image = load_png(golden)
        image.putpixel((3, 3), 255 - image.getpixel((3, 3)))
        image.save(golden, format="PNG")
        manifest["fixtures"][FIXTURE]["files"][golden.name] = sha256(golden)
        (old / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

        second = self.run_check()
        self.assertEqual(second["status"], "fail")
        previous = second["previousSet"]
        self.assertEqual((previous["identity_hash"], previous["integrity"]), (OLD_HASH, "ok"))
        self.assertEqual((previous["pages_differing"], previous["pages_matching"], previous["pages_new"]), (1, 0, 0))
        self.assertTrue(any(r.startswith(f"renderer identity changed from {OLD_HASH}") for r in second["reasons"]), second["reasons"])
        page = second["fixtures"][FIXTURE]["pages"][0]
        self.assertEqual(page["previous"], {"status": "differs", "differing_pixels": 1})
        candidate_dir = Path(second["candidates"])
        self.assertTrue((candidate_dir / f"{FIXTURE}-p1.previous-diff.png").is_file())
        self.assertEqual(json.loads((candidate_dir / "manifest.json").read_text(encoding="utf-8"))["previous_set"]["pages_differing"], 1)

        # Without the flag: refused, and nothing is written into the goldens.
        with self.assertRaises(HarnessError) as caught:
            approve(self.candidates, self.goldens, "SYN approver (test)")
        self.assertEqual(caught.exception.exit_code, 1)
        self.assertIn("--accept-identity-change", str(caught.exception))
        self.assertEqual(sorted(p.name for p in self.goldens.iterdir()), [OLD_HASH])

        # A set approved after the check (a newer "last approved set") means the candidates were not compared with it.
        newer = self.goldens / "1111111111111111"
        shutil.copytree(old, newer)
        newer_manifest = dict(manifest, identity_hash=newer.name, approved_at="2099-01-01T00:00:00Z")
        (newer / "manifest.json").write_text(json.dumps(newer_manifest), encoding="utf-8")
        with self.assertRaises(HarnessError) as caught:
            approve(self.candidates, self.goldens, "SYN approver (test)", accept_identity_change=True)
        self.assertIn("not compared", str(caught.exception))
        shutil.rmtree(newer)

        # With the flag (after a human compared the difference images): approved, and the change is recorded.
        result = approve(self.candidates, self.goldens, "SYN approver (test)", accept_identity_change=True)
        self.assertEqual(result["identityChange"]["from_identity_hash"], OLD_HASH)
        recorded = json.loads((Path(result["goldenSet"]) / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual((recorded["identity_change"]["pages_differing"], recorded["human_script_review"]), (1, "requested"))
        shutil.rmtree(self.candidates)
        self.assertEqual(self.run_check()["status"], "pass")

    def test_a_barcode_that_does_not_decode_to_its_payload_fails_and_cannot_be_approved(self) -> None:
        path = self.fixtures / f"{FIXTURE}.html"
        path.write_text(path.read_text(encoding="utf-8").replace("B:SYN-J-000001\"", "B:SYN-J-000002\""), encoding="utf-8")
        result = self.run_check()
        self.assertEqual(result["status"], "fail")
        self.assertTrue(any(r.startswith("barcode decode mismatch") for r in result["fixtures"][FIXTURE]["reasons"]))
        with self.assertRaises(HarnessError):
            approve(self.candidates, self.goldens, "SYN approver (test)")
        self.assertEqual(list(self.goldens.iterdir()), [])

    def test_an_undeclared_barcode_fails(self) -> None:
        path = self.fixtures / f"{FIXTURE}.html"
        text = path.read_text(encoding="utf-8")
        start = text.index('<meta name="hms.barcode.payloads"')
        path.write_text(text[:start] + text[text.index(">", start) + 1:], encoding="utf-8")
        result = self.run_check()
        self.assertTrue(any(r.startswith("barcodes found but the fixture declares none") for r in result["fixtures"][FIXTURE]["reasons"]))

    def test_candidates_inside_the_goldens_are_refused(self) -> None:
        with self.assertRaises(HarnessError):
            check(self.fixtures, self.goldens, self.goldens / "candidates")


if __name__ == "__main__":
    unittest.main()
