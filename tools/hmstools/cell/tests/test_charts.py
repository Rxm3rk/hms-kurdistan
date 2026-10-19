"""`tools/hms cell charts fetch|verify`: checksums and the excluded vendor inside chart archives (no network)."""

import hashlib
import io
import tarfile
import tempfile
import unittest
from pathlib import Path

from hmstools.cell import charts, config, images
from hmstools.cell.proc import GuardError
from hmstools.cell.tests.test_config import GOOD, SHA

VENDOR = "bit" + "nami"  # spelled apart so that no single line of this file names it


def archive(files: dict[str, str | bytes]) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for name, content in files.items():
            data = content.encode("utf-8") if isinstance(content, str) else content
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


CLEAN = archive({
    "c/Chart.yaml": "apiVersion: v2\nname: c\nversion: 1.0.1\n",
    "c/values.yaml": "image:\n  repository: ghcr.io/example/db\n",
    "c/templates/_helpers.tpl": f"{{{{/* Based on {VENDOR.capitalize()} charts method */}}}}\n",
    "c/README.md": f"See https://github.com/{VENDOR}-labs/sealed-secrets\n",
})
MANIFEST = b"apiVersion: v1\nkind: Namespace\nmetadata:\n  name: m\n"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Base(unittest.TestCase):
    chart_bytes = CLEAN

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name) / "cell-home"
        text = GOOD.replace(f"sha256: {SHA}, published", f"sha256: {sha(self.chart_bytes)}, published")
        text = text.replace(f"sha256: {SHA}}}", f"sha256: {sha(MANIFEST)}}}")
        cfg, errors = config.parse(text)
        self.assertEqual(errors, [])
        self.served = {"https://example.invalid/c-1.0.1.tgz": self.chart_bytes,
                       f"https://example.invalid/{'b' * 40}/m.yml": MANIFEST}
        self.downloads: list[str] = []
        self.free = 30.0
        self.ctx = images.Ctx(cfg=cfg, home=self.home, env={}, runner=None, say=lambda line: None,
                              free_gib=lambda: self.free, download=self.download)

    def download(self, url):
        self.downloads.append(url)
        return self.served[url]

    def tearDown(self):
        self.tmp.cleanup()


class FetchVerifyTest(Base):
    def test_fetch_keeps_files_at_their_pinned_checksum_then_is_idempotent(self):
        outcomes = charts.fetch(self.ctx)
        self.assertTrue(all(o.ok and o.action == "downloaded" for o in outcomes), [o.to_dict() for o in outcomes])
        self.assertEqual((self.home / "charts" / "c-1.0.1.tgz").read_bytes(), CLEAN)
        self.assertEqual((self.home / "manifests" / "m-1.0.1" / "m.yml").read_bytes(), MANIFEST)
        self.assertEqual(len(self.downloads), 2)
        again = charts.fetch(self.ctx)
        self.assertTrue(all(o.ok and o.action == "present" for o in again))
        self.assertEqual(len(self.downloads), 2)
        verified = charts.verify(self.ctx)
        self.assertTrue(all(o.ok for o in verified))
        chart = next(o for o in verified if o.kind == "chart")
        self.assertEqual(chart.notes, 2)  # the README link and the template comment: counted, not failed

    def test_a_download_with_another_checksum_is_not_kept(self):
        self.served["https://example.invalid/c-1.0.1.tgz"] = CLEAN + b"x"
        outcomes = {o.kind: o for o in charts.fetch(self.ctx)}
        self.assertFalse(outcomes["chart"].ok)
        self.assertIn("not the pinned", outcomes["chart"].detail)
        self.assertEqual(list(self.home.rglob("c-1.0.1.tgz*")), [])  # neither the file nor a partial one

    def test_a_file_already_there_with_another_checksum_is_never_overwritten(self):
        target = self.home / "charts" / "c-1.0.1.tgz"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"other")
        outcomes = {o.kind: o for o in charts.fetch(self.ctx)}
        self.assertIn("not overwritten", outcomes["chart"].detail)
        self.assertEqual(target.read_bytes(), b"other")
        self.assertNotIn("https://example.invalid/c-1.0.1.tgz", self.downloads)
        self.assertFalse({o.kind: o for o in charts.verify(self.ctx)}["chart"].ok)

    def test_verify_fails_on_a_missing_file(self):
        outcomes = charts.verify(self.ctx)
        self.assertTrue(all(not o.ok and "charts fetch" in o.detail for o in outcomes))

    def test_the_disk_guard_stops_before_any_download(self):
        self.free = 14.9
        with self.assertRaises(GuardError):
            charts.fetch(self.ctx)
        self.assertEqual(self.downloads, [])

    def test_only_https_is_downloaded(self):
        with self.assertRaises(ValueError):
            charts.download("http://example.invalid/c-1.0.1.tgz")


class PlantedVendorChartTest(Base):
    """The Kyverno 3.9.1 case: a subchart packages the vendor's chart, disabled by default."""

    chart_bytes = archive({
        "c/Chart.yaml": "apiVersion: v2\nname: c\nversion: 1.0.1\ndependencies:\n- name: reports-server\n",
        "c/charts/reports-server/Chart.yaml": "apiVersion: v2\nname: reports-server\ndependencies:\n- name: postgresql\n"
                                              "  condition: postgresql.enabled\n",
        "c/charts/reports-server/charts/postgresql/Chart.yaml":
            f"name: postgresql\nversion: 13.4.1\nsources:\n- https://github.com/{VENDOR}/charts\n",
    })

    def test_fetch_keeps_it_but_fails_and_verify_fails(self):
        outcome = next(o for o in charts.fetch(self.ctx) if o.kind == "chart")
        self.assertFalse(outcome.ok)
        self.assertIn("charts/postgresql/Chart.yaml: packages a chart of the vendor", outcome.detail)
        self.assertFalse(next(o for o in charts.verify(self.ctx) if o.kind == "chart").ok)


class ScanTest(unittest.TestCase):
    def test_a_nested_archive_is_scanned(self):
        inner = archive({"common/Chart.yaml": f"name: common\nhome: https://{VENDOR}.com\n"})
        errors, _ = charts.scan_chart(archive({"c/Chart.yaml": "name: c\n", "c/charts/common-2.13.3.tgz": inner}))
        self.assertEqual(len(errors), 1)
        self.assertIn("c/charts/common-2.13.3.tgz!/common/Chart.yaml", errors[0])

    def test_a_dependency_from_the_vendors_repository_fails(self):
        errors, _ = charts.scan_chart(archive({
            "c/Chart.lock": f"dependencies:\n- name: mysql\n  repository: https://charts.{VENDOR}.com/{VENDOR}\n"}))
        self.assertEqual(len(errors), 1)

    def test_an_image_of_the_vendor_in_values_or_templates_fails(self):
        for name, text in (("c/values.yaml", f"image:\n  repository: {VENDOR}/os-shell\n"),
                           ("c/templates/job.yaml", f"image: docker.io/{VENDOR}/kubectl:1.33\n"),
                           ("c/values-lite.yaml", f'image: "{VENDOR}/postgresql:16"\n')):
            errors, _ = charts.scan_chart(archive({name: text}))
            self.assertEqual(len(errors), 1, name)
            self.assertIn("names an image of the vendor", errors[0])

    def test_other_mentions_are_notes(self):
        errors, notes = charts.scan_chart(CLEAN)
        self.assertEqual((errors, notes), ([], 2))

    def test_not_an_archive(self):
        errors, _ = charts.scan_chart(b"not a tar file")
        self.assertIn("not a chart archive", errors[0])

    def test_a_manifest_naming_an_image_of_the_vendor_fails(self):
        self.assertEqual(charts.scan_manifest(MANIFEST, "m.yml"), ([], 0))
        errors, _ = charts.scan_manifest(f"image: docker.io/{VENDOR}/kubectl@sha256:{'1' * 64}\n".encode(), "m.yml")
        self.assertIn("m.yml: names an image", errors[0])
        self.assertEqual(charts.scan_manifest(f"# see {VENDOR}.com\n".encode(), "m.yml"), ([], 1))


class RealPinsTest(unittest.TestCase):
    def test_every_artefact_has_a_place_in_cell_home(self):
        cfg = config.load(Path(__file__).resolve().parents[4] / config.CELL_YAML)
        found = charts.artefacts(cfg, Path("/home/x/.local/share/hms-cell"))
        paths = [a.path.as_posix() for a in found]
        self.assertEqual(len(paths), len(set(paths)))
        self.assertIn("/home/x/.local/share/hms-cell/manifests/kyverno-v1.19.1/install.yaml", paths)
        self.assertTrue(all(a.url.startswith("https://") for a in found))


if __name__ == "__main__":
    unittest.main()
