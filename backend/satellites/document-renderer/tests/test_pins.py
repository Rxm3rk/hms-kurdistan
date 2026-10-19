"""Pins and runtime records: requirements.txt, the MSYS2 lock, LICENCES.md, bootstrap.py and runtime.json agree.

BUILD-PROMPT.md §4.3 (every dependency pinned and its licence recorded), docs/specs/modules/platform-docs.md §10 (the
runtime is part of the renderer identity).
"""

from __future__ import annotations

import importlib.util
import json
import re
import tempfile
import unittest
from importlib import metadata
from pathlib import Path
from unittest import mock

from hms_docrender import env
from tests.support import SATELLITE

spec = importlib.util.spec_from_file_location("docrender_bootstrap", SATELLITE / "bootstrap.py")
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)

BINARY = {"brotli", "cffi", "fonttools", "pillow", "pypdfium2", "zopfli", "zxing-cpp"}


class PinsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pins = {p["name"]: p for p in bootstrap.parse_requirements((SATELLITE / "requirements.txt").read_text(encoding="utf-8"))}

    def test_the_top_level_pins(self) -> None:
        self.assertEqual(self.pins["weasyprint"]["version"], "70.0")
        self.assertEqual(self.pins["pypdfium2"]["version"], "5.14.0")
        self.assertEqual(self.pins["zxing-cpp"]["version"], "3.1.1")
        top = re.findall(r"^([a-z0-9-]+)==([^\s;]+)", (SATELLITE / "requirements.in").read_text(encoding="utf-8"), re.M)
        for name, version in top:
            self.assertEqual(self.pins[bootstrap.normalise(name)]["version"], version)

    def test_binary_packages_have_a_windows_and_a_linux_wheel(self) -> None:
        for name, pin in self.pins.items():
            expected = 2 if name in BINARY else 1
            self.assertEqual(len(pin["hashes"]), expected, name)
        self.assertEqual(self.pins["zstandard"]["marker"], 'sys_platform == "win32"')

    def test_licences_md_lists_every_pin(self) -> None:
        licences = (SATELLITE / "LICENCES.md").read_text(encoding="utf-8")
        for name, pin in self.pins.items():
            self.assertRegex(licences, rf"\|\s*{re.escape(name)}\s*\|\s*{re.escape(pin['version'])}\s*\|", name)

    def test_the_msys2_lock(self) -> None:
        lock = json.loads((SATELLITE / "runtime" / "msys2-ucrt64.lock.json").read_text(encoding="utf-8"))
        self.assertEqual(lock["repo"], "https://repo.msys2.org/mingw/ucrt64/")
        versions = {p["name"].removeprefix("mingw-w64-ucrt-x86_64-"): p["version"] for p in lock["packages"]}
        self.assertEqual(versions["pango"], "1.58.2-1")
        self.assertEqual(versions["harfbuzz"], "14.6.0-1")
        self.assertEqual(len(lock["packages"]), 21)
        licences = (SATELLITE / "LICENCES.md").read_text(encoding="utf-8")
        for package in lock["packages"]:
            self.assertEqual(package["url"], lock["repo"] + package["filename"])
            self.assertRegex(package["sha256"], r"^[0-9a-f]{64}$")
            self.assertTrue(package["licence"])
            self.assertTrue(package["dlls"])
            for dll in package["dlls"]:
                self.assertRegex(dll["sha256"], r"^[0-9a-f]{64}$")
            self.assertIn(package["name"].removeprefix("mingw-w64-ucrt-x86_64-"), licences)

    def test_bootstrap_and_env_agree(self) -> None:
        self.assertEqual(bootstrap.FONTCONFIG_XML, env.FONTCONFIG_XML)
        self.assertEqual(set(bootstrap.BASE_INTERPRETER_DLLS), set(env.BASE_INTERPRETER_DLLS))
        elements = re.sub(r"<!--.*?-->", "", env.FONTCONFIG_XML, flags=re.S)
        self.assertNotIn("<dir", elements)
        self.assertNotIn("<include", elements)
        self.assertIn("<fontconfig>", elements)

    def test_requirement_parser_refuses_loose_pins(self) -> None:
        for text in ("weasyprint>=70 --hash=sha256:" + "a" * 64, "weasyprint==70.0", "weasyprint==70.0 --hash=md5:abc",
                     'x==1 ; python_version < "3.13" --hash=sha256:' + "a" * 64):
            with self.subTest(text=text), self.assertRaises(bootstrap.BootstrapError):
                pins = bootstrap.parse_requirements(text)
                for pin in pins:
                    bootstrap.marker_applies(pin["marker"])


class UnlistedFilesTest(unittest.TestCase):
    """Review correctness 13: bootstrap refuses a site-packages file no RECORD lists (a planted .pth or sitecustomize)."""

    def test_this_runtime_has_no_unlisted_file(self) -> None:
        self.assertEqual(bootstrap.unlisted_site_files(), [])

    def test_planted_files_are_reported(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ("evil.pth", "sitecustomize.py", "json.py", "pkg/shadow.py", bootstrap.PTH_NAME, "__pycache__/x.pyc",
                         "pkg/__pycache__/y.pyc"):
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                (root / name).write_text("x", encoding="utf-8")
            with mock.patch("sysconfig.get_path", lambda name: tmp):
                self.assertEqual(bootstrap.unlisted_site_files(), ["evil.pth", "json.py", "pkg/shadow.py", "sitecustomize.py"])


class RuntimeRecordTest(unittest.TestCase):
    """This runtime matches the pins (bootstrap.py verified every file; this checks the record it wrote)."""

    def test_runtime_json_matches_the_installed_packages(self) -> None:
        runtime = env.load_runtime()
        pins = bootstrap.parse_requirements((SATELLITE / "requirements.txt").read_text(encoding="utf-8"))
        for pin in pins:
            if bootstrap.marker_applies(pin["marker"]):
                self.assertEqual(metadata.version(pin["name"]), pin["version"], pin["name"])
                self.assertEqual(runtime.info["packages"][pin["name"]], pin["version"])
        self.assertTrue({"pango", "harfbuzz", "freetype", "fontconfig", "fribidi"} <= set(runtime.info["native"]))
        self.assertEqual(runtime.info["requirements_sha256"], bootstrap.sha256_file(SATELLITE / "requirements.txt"))


if __name__ == "__main__":
    unittest.main()
