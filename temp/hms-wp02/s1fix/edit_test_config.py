from pathlib import Path
p = Path("tools/hmstools/cell/tests/test_config.py")
s = p.read_bytes().decode("utf-8")
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:70], s.count(old))
    s = s.replace(old, new)
rep('''manifests:
  - name: m
    commit: {"b" * 40}
    profiles: [lite]
''', '''manifests:
  - name: m
    version: 1.0.1
    source: "https://example.invalid/m"
    commit: {"b" * 40}
    published: "2026-01-02"
    profiles: [lite]
''')
rep('''     licence: Apache-2.0, role: substrate, component: substrate, profiles: [lite], ships: true}}''',
    '''     licence: Apache-2.0, role: substrate, component: substrate, profiles: [lite], ships: true, released: "2026-09-30"}}''')
rep('''     ships: false}}''', '''     ships: false, released: "2026-09-24"}}''')
rep('''     licence: MIT, role: database, component: db, profiles: [lite], ships: true}}''',
    '''     licence: MIT, role: database, component: db, profiles: [lite], ships: true, released: "2026-08-13"}}''')
rep('''     licence: Apache-2.0, purpose: copy}}''', '''     licence: Apache-2.0, released: "2026-09-04", purpose: copy}}''')
rep('''     licence: Apache-2.0, purpose: sign}}''', '''     licence: Apache-2.0, released: "2026-08-06", purpose: sign}}''')
rep('''    def test_dangling_references_fail(self):''', '''    def test_an_image_or_tool_without_a_release_date_fails(self):
        self.assert_error(GOOD.replace(', released: "2026-08-13"}}', "}}"), "images[2] (db): missing released")
        self.assert_error(GOOD.replace(', released: "2026-09-04"', ""), "tools[0] (crane): missing released")

    def test_a_malformed_or_future_date_fails(self):
        self.assert_error(GOOD.replace('released: "2026-08-13"', 'released: "13 August 2026"'),
                          "image db: released: want a quoted date YYYY-MM-DD")
        self.assert_error(GOOD.replace('released: "2026-08-13"', "released: 2026-08-13"), "want a quoted date")
        self.assert_error(GOOD.replace('released: "2026-08-13"', 'released: "2026-02-30"'), "is not a date")
        self.assert_error(GOOD.replace('released: "2026-08-13"', 'released: "2026-10-20"'), "is after resolved_on")
        self.assert_error(GOOD.replace('published: "2026-01-01"', 'published: "2027-01-01"'),
                          "chart c: published: 2027-01-01 is after resolved_on")
        self.assert_error(GOOD.replace('published: "2026-01-02"', 'published: ""'), "manifest m: missing published")

    def test_a_manifest_pinned_by_release_must_use_its_assets(self):
        by_release = GOOD.replace(f'commit: {"b" * 40}', "release: v1.0.1").replace(
            f'"https://example.invalid/{"b" * 40}/m.yml"', '"https://example.invalid/m/releases/download/v1.0.1/m.yml"')
        result = self.lint(by_release)
        self.assertTrue(result.ok, result.errors)
        self.assert_error(by_release.replace("/download/v1.0.1/", "/download/v1.0.0/"), "is not an asset of release v1.0.1")
        self.assert_error(by_release.replace("    release: v1.0.1\n", ""), "pin it by exactly one of")
        self.assert_error(by_release.replace("    release: v1.0.1\n", f"    release: v1.0.1\n    commit: {'b' * 40}\n"),
                          "pin it by exactly one of")
        self.assert_error(by_release.replace('"https://example.invalid/m/releases', '"http://example.invalid/m/releases'),
                          "is not an https URL")

    def test_dangling_references_fail(self):''')
rep('''    def test_the_spike_decided_cosign_3(self):''', '''    def test_no_pinned_chart_is_one_oq_137_excludes(self):
        charts = {chart["name"] for chart in self.cfg.data["charts"]}
        self.assertFalse(charts & {"kyverno", "openfga"}, "OQ-137: Kyverno from its release manifest, OpenFGA from our template")
        kyverno = next(m for m in self.cfg.data["manifests"] if m["name"] == "kyverno")
        self.assertEqual(kyverno["release"], "v1.19.1")

    def test_every_image_and_tool_has_a_release_date(self):
        for entry in self.cfg.data["images"] + self.cfg.data["tools"]:
            self.assertRegex(entry["released"], config.DATE, entry["name"])

    def test_the_spike_decided_cosign_3(self):''')
p.write_bytes(s.encode("utf-8"))
print("ok")
