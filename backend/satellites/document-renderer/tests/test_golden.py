"""Self-test of the PDF golden-image harness (docs/specs/modules/platform-docs.md §6.2, §10).

In temporary directories: a missing approved set fails closed and writes candidates (never into the goldens); approve
then check passes; a one-pixel change fails with a difference image; a hand-edited golden fails its manifest hash; a
barcode that does not decode to its declared payload fails and cannot be approved.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from hms_docrender.golden.harness import HarnessError, approve, check, load_fixture, load_png, parse_payloads
from tests.support import FIXTURES, requires_fonts

FIXTURE = "selftest-wristband-datamatrix"
PAYLOAD = "datamatrix:HMS1|M:SYN-000123-7|E:SYN-E-000045|B:SYN-J-000001"


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


@requires_fonts
class GoldenHarnessSelfTest(unittest.TestCase):
    """GoldenImage harness self-test: fail closed, approve, pass, one pixel fails, tamper fails, barcode mismatch fails."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.fixtures, self.goldens, self.candidates = root / "fixtures", root / "goldens", root / "candidates"
        self.fixtures.mkdir()
        self.goldens.mkdir()
        shutil.copyfile(FIXTURES / f"{FIXTURE}.html", self.fixtures / f"{FIXTURE}.html")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def run_check(self) -> dict:
        return check(self.fixtures, self.goldens, self.candidates)

    def test_fail_closed_then_approve_then_pass_then_one_pixel_fails(self) -> None:
        # 1. No approved set for this identity: fails closed, writes candidates, leaves the goldens untouched.
        first = self.run_check()
        self.assertEqual(first["status"], "fail")
        self.assertTrue(any(r.startswith("no approved golden images for ") for r in first["reasons"]), first["reasons"])
        self.assertEqual(list(self.goldens.iterdir()), [], "the check wrote into the goldens directory")
        candidate_dir = Path(first["candidates"])
        manifest = json.loads((candidate_dir / "manifest.json").read_text(encoding="utf-8"))
        self.assertIn(f"{FIXTURE}-p1.png", manifest["fixtures"][FIXTURE]["files"])
        self.assertEqual(manifest["fixtures"][FIXTURE]["barcodes"]["decoded"], [PAYLOAD])
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
        golden_manifest["fixtures"][FIXTURE]["files"][golden.name] = hashlib.sha256(golden.read_bytes()).hexdigest()
        (set_dir / "manifest.json").write_text(json.dumps(golden_manifest), encoding="utf-8")
        third = self.run_check()
        self.assertEqual(third["status"], "fail")
        page = third["fixtures"][FIXTURE]["pages"][0]
        self.assertEqual((page["status"], page["differing_pixels"]), ("differs", 1))
        self.assertTrue((Path(third["candidates"]) / f"{FIXTURE}-p1.diff.png").is_file())
        self.assertEqual(hashlib.sha256(golden.read_bytes()).hexdigest(), golden_manifest["fixtures"][FIXTURE]["files"][golden.name],
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
