"""`tools/hms cell lint`: the pins in deploy/site-cell/cell.yaml (WP-0.2 plan S1)."""

import tempfile
import unittest
from pathlib import Path

from hmstools.cell import config

ROOT = Path(__file__).resolve().parents[4]
POLICY = ROOT / "tools/licence/policy.yaml"
D1 = "sha256:" + "1" * 64
D2 = "sha256:" + "2" * 64
D3 = "sha256:" + "3" * 64
SHA = "a" * 64

GOOD = f"""
schema_version: 1
resolved_on: "2026-10-19"
platform: linux/amd64
kubernetes: {{distribution: k3s, version: v1.35.9+k3s1, image: k3s}}
registry: {{k3d_name: r.localhost, container: k3d-r.localhost, host: "k3d-r.localhost:5000", host_port: "127.0.0.1:5000",
  image: registry, storage: registry, network: {{name: n, subnet: 10.213.0.0/24}},
  offline_network: {{name: o, subnet: 10.213.1.0/24}}}}
guards: {{disk_path: /mnt/c, disk_min_free_gib: 15, cell_min_available_gib: 6.5}}
signing: {{tool: cosign, key_dir: keys, signing_config: signing-config.json, passphrase_env: HMS_COSIGN_PASSWORD,
  passphrase_file: cosign.password, format: cosign-3-bundle}}
profiles:
  lite:
    budget_mib: 1000
    components:
      substrate: {{count: 1, limit_mib: 600, expected_mib: 500}}
      db: {{count: 1, limit_mib: 600, expected_mib: 400}}
charts:
  - {{name: c, repository: "https://example.invalid/charts", version: 1.0.1, app_version: 1.0.1,
     url: "https://example.invalid/c-1.0.1.tgz", sha256: {SHA}, published: "2026-01-01", profiles: [lite], images: [db]}}
manifests:
  - name: m
    commit: {"b" * 40}
    profiles: [lite]
    images: [db]
    files:
      - {{url: "https://example.invalid/{"b" * 40}/m.yml", sha256: {SHA}}}
images:
  - {{name: k3s, upstream: "docker.io/rancher/k3s:v1.35.9-k3s1", digest: {D1}, index_digest: {D2}, local: rancher/k3s,
     licence: Apache-2.0, role: substrate, component: substrate, profiles: [lite], ships: true}}
  - {{name: registry, upstream: "docker.io/distribution/distribution:3.1.2", digest: {D2}, index_digest: {D3},
     local: distribution/distribution, licence: Apache-2.0, role: registry, component: substrate, profiles: [lite],
     ships: false}}
  - {{name: db, upstream: "ghcr.io/example/db:1.2.3", digest: {D3}, index_digest: {D1}, local: example/db,
     licence: MIT, role: database, component: db, profiles: [lite], ships: true}}
tools:
  - {{name: crane, upstream: "gcr.io/go-containerregistry/crane:v0.22.1", digest: {D1}, index_digest: {D2},
     licence: Apache-2.0, purpose: copy}}
  - {{name: cosign, upstream: "ghcr.io/sigstore/cosign/cosign:v3.1.3", digest: {D2}, index_digest: {D3},
     licence: Apache-2.0, purpose: sign}}
"""


class LintTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.register = self.dir / "register.yaml"
        self.register.write_text("schema_version: 1\nentries: []\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def lint(self, text):
        path = self.dir / "cell.yaml"
        path.write_text(text, encoding="utf-8")
        return config.lint(path, POLICY, self.register)

    def assert_error(self, text, fragment):
        result = self.lint(text)
        self.assertFalse(result.ok, f"expected an error containing {fragment!r}")
        self.assertTrue(any(fragment in e for e in result.errors), result.errors)

    def test_the_fixture_passes(self):
        result = self.lint(GOOD)
        self.assertTrue(result.ok, result.errors)
        self.assertEqual((result.counts["images"], result.counts["charts"], result.counts["manifest_files"]), (3, 1, 1))
        self.assertEqual(result.counts["lite_expected_mib"], 900)

    def test_a_planted_image_from_the_excluded_vendor_fails(self):
        planted = GOOD.replace("ghcr.io/example/db:1.2.3", "docker.io/bitnami/postgresql:16.1.0")
        self.assert_error(planted, "vendor whose images and charts §4.1 excludes")
        self.assert_error(planted, "excluded by name")  # the licence policy's named exclusion fires as well

    def test_the_vendor_name_anywhere_fails(self):
        self.assert_error(GOOD + "# copied from Bitnami charts\n", "line ")

    def test_a_missing_digest_fails(self):
        self.assert_error(GOOD.replace(f"digest: {D3}, index_digest: {D1}", f"digest: latest, index_digest: {D1}"),
                          "image db: no digest")
        self.assert_error(GOOD.replace(f"digest: {D3}, index_digest: {D1}, local", f"index_digest: {D1}, local"),
                          "missing digest")

    def test_a_digest_in_the_upstream_reference_fails(self):
        self.assert_error(GOOD.replace('"ghcr.io/example/db:1.2.3"', f'"ghcr.io/example/db@{D3}"'), "is not <registry>")

    def test_a_tool_without_a_digest_fails(self):
        self.assert_error(GOOD.replace(f"crane:v0.22.1\", digest: {D1}", "crane:v0.22.1\", digest: sha256:abc"),
                          "tool crane: no digest")

    def test_a_denied_licence_fails(self):
        self.assert_error(GOOD.replace("licence: MIT", "licence: BUSL-1.1"), "denied")

    def test_an_unclassified_licence_fails(self):
        self.assert_error(GOOD.replace("licence: MIT", "licence: Some-Custom-Licence"), "unmapped")

    def test_gpl_in_a_shipped_image_needs_a_register_entry(self):
        self.assert_error(GOOD.replace("licence: MIT", "licence: GPL-2.0-only"), "gpl-separate-container")

    def test_a_build_only_image_is_checked_for_use_restrictions_only(self):
        result = self.lint(GOOD.replace("local: distribution/distribution, licence: Apache-2.0",
                                        "local: distribution/distribution, licence: GPL-2.0-only"))
        self.assertTrue(result.ok, result.errors)
        self.assert_error(GOOD.replace("local: distribution/distribution, licence: Apache-2.0",
                                       "local: distribution/distribution, licence: SSPL-1.0"), "denied")

    def test_two_images_sharing_a_local_path_fail(self):
        self.assert_error(GOOD.replace("local: example/db", "local: rancher/k3s"), "share the local path")

    def test_a_profile_over_budget_fails(self):
        self.assert_error(GOOD.replace("budget_mib: 1000", "budget_mib: 899"), "above the profile budget of 899")

    def test_a_component_above_its_limit_fails(self):
        self.assert_error(GOOD.replace("limit_mib: 600, expected_mib: 400", "limit_mib: 300, expected_mib: 400"),
                          "above its limit")

    def test_a_chart_without_a_checksum_fails(self):
        self.assert_error(GOOD.replace(f"sha256: {SHA}, published", "sha256: '', published"), "no SHA-256 of its .tgz")

    def test_a_manifest_not_at_its_commit_fails(self):
        self.assert_error(GOOD.replace(f'"https://example.invalid/{"b" * 40}/m.yml"', '"https://example.invalid/main/m.yml"'),
                          "not fetched at the pinned commit")

    def test_dangling_references_fail(self):
        self.assert_error(GOOD.replace("images: [db]}", "images: [nope]}"), "image 'nope' is not an image")
        self.assert_error(GOOD.replace("image: registry, storage", "image: other, storage"), "registry.image")
        self.assert_error(GOOD.replace("component: db,", "component: cache,"), "is not in profile lite")
        self.assert_error(GOOD.replace("name: cosign,", "name: cosine,"), "no 'cosign' entry")

    def test_not_yaml_fails_cleanly(self):
        self.assert_error("images: [\n", "not valid YAML")


class RealCellYamlTest(unittest.TestCase):
    """The committed cell.yaml: structure and pins. Licence verdicts are the lint's business, not frozen here."""

    @classmethod
    def setUpClass(cls):
        cls.cfg = config.load(ROOT / config.CELL_YAML)

    def test_every_check_but_the_licence_verdicts_passes(self):
        result = config.lint(ROOT / config.CELL_YAML, POLICY, ROOT / "tools/licence/register.yaml")
        structural = [e for e in result.errors if not e.startswith("licence:")]
        self.assertEqual(structural, [])

    def test_every_lite_image_is_pinned_by_digest(self):
        lite = self.cfg.profile_images("lite")
        self.assertGreaterEqual(len(lite), 20)
        for image in lite:
            self.assertRegex(image.digest, config.DIGEST)
            self.assertTrue(image.local_ref("r:5000").endswith("@" + image.digest))

    def test_the_spike_decided_cosign_3(self):
        self.assertTrue(self.cfg.tool("cosign").version.startswith("v3."), "OQ-135: cosign 3 with a signing config")
        self.assertEqual(self.cfg.signing["format"], "cosign-3-bundle")

    def test_the_registry_is_published_on_loopback_only(self):
        self.assertTrue(str(self.cfg.registry["host_port"]).startswith("127.0.0.1:"))

    def test_the_disk_guard_is_the_dn_013_line(self):
        self.assertGreaterEqual(float(self.cfg.guards["disk_min_free_gib"]), 15)


class CellHomeTest(unittest.TestCase):
    def test_default_and_override(self):
        self.assertEqual(config.cell_home({"HMS_CELL_HOME": "/x/y"}), Path("/x/y"))
        self.assertTrue(str(config.cell_home({})).replace("\\", "/").endswith(".local/share/hms-cell"))


if __name__ == "__main__":
    unittest.main()
