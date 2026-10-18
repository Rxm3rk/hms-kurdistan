"""Unit tests for tools/bootstrap (no network: HTTP goes through a fake opener)."""

from __future__ import annotations

import hashlib
import io
import tarfile
import tempfile
import unittest
import urllib.error
import zipfile
from pathlib import Path

from hmstools.bootstrap import core, steps


class FakeResponse(io.BytesIO):
    def __init__(self, data: bytes, status: int = 200, headers: dict | None = None):
        super().__init__(data)
        self.status = status
        self.headers = {"Content-Length": str(len(data)), **(headers or {})}


class FakeOpener:
    """Serves byte strings by URL and records requests; supports Range like a real server."""

    def __init__(self, files: dict[str, bytes]):
        self.files = files
        self.requests: list[tuple[str, str | None]] = []

    def __call__(self, request, timeout):
        url = request.full_url
        rng = request.headers.get("Range")
        self.requests.append((url, rng))
        if url not in self.files:
            raise urllib.error.HTTPError(url, 404, "not found", {}, None)
        data = self.files[url]
        if rng:
            start = int(rng.split("=")[1].rstrip("-"))
            if start >= len(data):
                raise urllib.error.HTTPError(url, 416, "range not satisfiable", {}, None)
            return FakeResponse(data[start:], status=206)
        return FakeResponse(data)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class TempRoot(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / "BUILD-PROMPT.md").write_text("plan\n", encoding="utf-8")

    def tearDown(self) -> None:
        self._tmp.cleanup()


class Base36AndGradleHash(unittest.TestCase):
    def test_base36_matches_java_biginteger(self) -> None:
        self.assertEqual(core.base36(0), "0")
        self.assertEqual(core.base36(35), "z")
        self.assertEqual(core.base36(36), "10")
        self.assertEqual(core.base36(36**5 - 1), "zzzzz")

    def test_wrapper_directory_hash_for_gradle_981(self) -> None:
        # The directory the Gradle wrapper uses for this URL (seeded in .tools/gradle-home by the lead).
        self.assertEqual(steps.gradle_dist_hash(steps.GRADLE_DEFAULT_URL), "a2l6ltp3k1vth6lwipzm5p2jp")


class GradleDist(TempRoot):
    def test_defaults_without_wrapper_properties(self) -> None:
        dist = steps.gradle_dist(self.root)
        self.assertEqual(dist.url, steps.GRADLE_DEFAULT_URL)
        self.assertEqual(dist.sha256, steps.GRADLE_DEFAULT_SHA256)
        self.assertEqual(
            dist.zip_path,
            self.root / ".tools/gradle-home/wrapper/dists/gradle-9.8.1-bin/a2l6ltp3k1vth6lwipzm5p2jp/gradle-9.8.1-bin.zip",
        )

    def test_reads_escaped_wrapper_properties(self) -> None:
        props = self.root / steps.WRAPPER_PROPERTIES
        props.parent.mkdir(parents=True)
        props.write_text(
            "# comment\ndistributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\n"
            "distributionSha256Sum=" + "ab" * 32 + "\n"
            "distributionUrl=https\\://example.invalid/dists/gradle-9.9.0-bin.zip\n"
            "zipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n",
            encoding="utf-8",
        )
        dist = steps.gradle_dist(self.root)
        self.assertEqual(dist.url, "https://example.invalid/dists/gradle-9.9.0-bin.zip")
        self.assertEqual(dist.sha256, "ab" * 32)
        self.assertEqual(dist.dist_name, "gradle-9.9.0-bin")
        self.assertIn(steps.gradle_dist_hash(dist.url), dist.zip_path.parts)

    def test_mirror_url_forms(self) -> None:
        self.assertEqual(steps.mirror_url("https://m.invalid/gradle/", "g.zip"), "https://m.invalid/gradle/g.zip")
        self.assertEqual(steps.mirror_url("https://m.invalid/x/g.zip", "g.zip"), "https://m.invalid/x/g.zip")

    def test_ensure_gradle_from_mirror_verifies_against_official_checksum(self) -> None:
        payload = b"fake gradle distribution"
        props = self.root / steps.WRAPPER_PROPERTIES
        props.parent.mkdir(parents=True)
        props.write_text(
            f"distributionUrl=https\\://services.invalid/gradle-1.0-bin.zip\ndistributionSha256Sum={sha(payload)}\n",
            encoding="utf-8",
        )
        opener = FakeOpener({"https://mirror.invalid/g/gradle-1.0-bin.zip": payload})
        previous = core.set_opener(opener)
        try:
            placed = steps.ensure_gradle(self.root, mirror="https://mirror.invalid/g")
        finally:
            core.set_opener(previous)
        self.assertEqual(placed.read_bytes(), payload)
        self.assertEqual([u for u, _ in opener.requests], ["https://mirror.invalid/g/gradle-1.0-bin.zip"])
        # Second run: reused, no request.
        opener.requests.clear()
        previous = core.set_opener(opener)
        try:
            steps.ensure_gradle(self.root, mirror="https://mirror.invalid/g")
        finally:
            core.set_opener(previous)
        self.assertEqual(opener.requests, [])

    def test_mirror_with_wrong_file_fails_and_keeps_nothing(self) -> None:
        props = self.root / steps.WRAPPER_PROPERTIES
        props.parent.mkdir(parents=True)
        props.write_text(
            f"distributionUrl=https\\://services.invalid/gradle-1.0-bin.zip\ndistributionSha256Sum={sha(b'good')}\n",
            encoding="utf-8",
        )
        opener = FakeOpener({"https://mirror.invalid/gradle-1.0-bin.zip": b"tampered"})
        previous = core.set_opener(opener)
        try:
            with self.assertRaises(core.BootstrapError):
                steps.ensure_gradle(self.root, mirror="https://mirror.invalid/")
        finally:
            core.set_opener(previous)
        self.assertFalse(steps.gradle_dist(self.root).zip_path.exists())
        self.assertEqual(list((self.root / ".tools/downloads").glob("*")), [])


class Download(TempRoot):
    def run_download(self, opener: FakeOpener, url: str, dest: Path, digest: str) -> Path:
        previous = core.set_opener(opener)
        try:
            return core.download(url, dest, digest, attempts=1)
        finally:
            core.set_opener(previous)

    def test_downloads_and_verifies(self) -> None:
        data = b"x" * 1000
        dest = self.root / "d" / "file.bin"
        self.run_download(FakeOpener({"https://h.invalid/f": data}), "https://h.invalid/f", dest, sha(data))
        self.assertEqual(dest.read_bytes(), data)
        self.assertFalse(dest.with_name("file.bin.part").exists())

    def test_reuses_verified_file_without_network(self) -> None:
        data = b"cached"
        dest = self.root / "file.bin"
        dest.write_bytes(data)
        opener = FakeOpener({})
        self.run_download(opener, "https://h.invalid/f", dest, sha(data))
        self.assertEqual(opener.requests, [])

    def test_checksum_mismatch_deletes_and_fails(self) -> None:
        dest = self.root / "file.bin"
        with self.assertRaises(core.BootstrapError) as ctx:
            self.run_download(FakeOpener({"https://h.invalid/f": b"evil"}), "https://h.invalid/f", dest, sha(b"good"))
        self.assertIn("SHA-256 mismatch", str(ctx.exception))
        self.assertFalse(dest.exists())
        self.assertFalse(dest.with_name("file.bin.part").exists())

    def test_resumes_partial_download(self) -> None:
        data = bytes(range(256)) * 10
        dest = self.root / "file.bin"
        dest.with_name("file.bin.part").write_bytes(data[:700])
        opener = FakeOpener({"https://h.invalid/f": data})
        self.run_download(opener, "https://h.invalid/f", dest, sha(data))
        self.assertEqual(dest.read_bytes(), data)
        self.assertEqual(opener.requests[0][1], "bytes=700-")

    def test_complete_part_file_is_verified_after_416(self) -> None:
        data = b"complete already"
        dest = self.root / "file.bin"
        dest.with_name("file.bin.part").write_bytes(data)
        self.run_download(FakeOpener({"https://h.invalid/f": data}), "https://h.invalid/f", dest, sha(data))
        self.assertEqual(dest.read_bytes(), data)

    def test_rejects_malformed_checksum(self) -> None:
        with self.assertRaises(core.BootstrapError):
            self.run_download(FakeOpener({}), "https://h.invalid/f", self.root / "f", "not-a-checksum")


class Archives(TempRoot):
    def test_zip_with_parent_path_is_refused(self) -> None:
        archive = self.root / "bad.zip"
        with zipfile.ZipFile(archive, "w") as bundle:
            bundle.writestr("../escape.txt", "x")
        with self.assertRaises(core.BootstrapError):
            core.extract_archive(archive, self.root / "out")
        self.assertFalse((self.root / "escape.txt").exists())

    def test_tar_with_absolute_path_is_refused(self) -> None:
        archive = self.root / "bad.tar.gz"
        with tarfile.open(archive, "w:gz") as bundle:
            info = tarfile.TarInfo("/etc/evil")
            info.size = 1
            bundle.addfile(info, io.BytesIO(b"x"))
        with self.assertRaises(core.BootstrapError):
            core.extract_archive(archive, self.root / "out")

    def test_good_zip_extracts_single_top_directory(self) -> None:
        archive = self.root / "good.zip"
        with zipfile.ZipFile(archive, "w") as bundle:
            bundle.writestr("jdk-25.0.1+1/bin/java", "#!/bin/sh\n")
            bundle.writestr("jdk-25.0.1+1/release", "JAVA_VERSION=25\n")
        core.extract_archive(archive, self.root / "out")
        self.assertEqual(core.single_top_dir(self.root / "out").name, "jdk-25.0.1+1")


class Parsing(unittest.TestCase):
    def test_java_major(self) -> None:
        self.assertEqual(steps.java_major("25.0.4.1"), 25)
        self.assertEqual(steps.java_major("21"), 21)
        self.assertEqual(steps.java_major("1.8.0_292"), 8)
        self.assertIsNone(steps.java_major(None))

    def test_gitleaks_asset_names(self) -> None:
        self.assertEqual(steps.gitleaks_asset_name("8.30.1", "windows", "x64"), "gitleaks_8.30.1_windows_x64.zip")
        self.assertEqual(steps.gitleaks_asset_name("8.30.1", "linux", "x64"), "gitleaks_8.30.1_linux_x64.tar.gz")
        self.assertEqual(steps.gitleaks_asset_name("8.30.1", "mac", "aarch64"), "gitleaks_8.30.1_darwin_arm64.tar.gz")

    def test_parse_checksums(self) -> None:
        text = f"{'a' * 64}  gitleaks_8.30.1_linux_x64.tar.gz\n{'b' * 64} *gitleaks_8.30.1_windows_x64.zip\nnoise\n"
        sums = steps.parse_checksums(text)
        self.assertEqual(sums["gitleaks_8.30.1_linux_x64.tar.gz"], "a" * 64)
        self.assertEqual(sums["gitleaks_8.30.1_windows_x64.zip"], "b" * 64)

    def test_parse_pins_from_hashed_requirements(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "r.txt"
            path.write_text(
                "# comment\nPyYAML==6.0.3 \\\n    --hash=sha256:" + "a" * 64 + "\ntyping_extensions==4.16.0 \\\n"
                "    --hash=sha256:" + "b" * 64 + "\n",
                encoding="utf-8",
            )
            self.assertEqual(steps.parse_pins(path), {"pyyaml": "6.0.3", "typing-extensions": "4.16.0"})

    def test_venv_mismatches(self) -> None:
        pins = {"pyyaml": "6.0.3", "jsonschema": "4.26.0"}
        good = {"python": "3.12.10", "packages": {"pyyaml": "6.0.3", "jsonschema": "4.26.0", "pip": "25"}}
        self.assertEqual(steps.venv_mismatches(good, pins), [])
        bad = {"python": "3.13.1", "packages": {"pyyaml": "6.0.2"}}
        problems = steps.venv_mismatches(bad, pins)
        self.assertEqual(len(problems), 3)
        self.assertEqual(steps.venv_mismatches(None, pins), ["the venv Python does not run"])

    def test_requirements_txt_pins_match_requirements_in(self) -> None:
        root = Path(__file__).resolve().parents[4]
        pins_in = steps.parse_pins(root / steps.REQUIREMENTS_IN)
        pins_txt = steps.parse_pins(root / steps.REQUIREMENTS_TXT)
        self.assertEqual(pins_in, pins_txt)
        text = (root / steps.REQUIREMENTS_TXT).read_text(encoding="utf-8")
        self.assertEqual(text.count("==") , len(pins_txt))
        self.assertGreaterEqual(text.count("--hash=sha256:"), 2 * len(pins_txt))

    def test_select_files_keeps_sdist_and_target_wheels(self) -> None:
        names = [
            ("x-1.0.tar.gz", "sdist"),
            ("x-1.0-py3-none-any.whl", "bdist_wheel"),
            ("x-1.0-cp312-cp312-win_amd64.whl", "bdist_wheel"),
            ("x-1.0-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", "bdist_wheel"),
            ("x-1.0-cp312-cp312-musllinux_1_2_x86_64.whl", "bdist_wheel"),
            ("x-1.0-cp312-cp312-macosx_11_0_arm64.whl", "bdist_wheel"),
            ("x-1.0-cp313-cp313-win_amd64.whl", "bdist_wheel"),
        ]
        chosen = steps.select_files([{"filename": n, "packagetype": t} for n, t in names])
        self.assertEqual(
            [e["filename"] for e in chosen],
            sorted(
                [
                    "x-1.0.tar.gz",
                    "x-1.0-py3-none-any.whl",
                    "x-1.0-cp312-cp312-win_amd64.whl",
                    "x-1.0-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
                ]
            ),
        )


class EnvScript(TempRoot):
    def test_to_posix(self) -> None:
        self.assertEqual(steps.to_posix(Path("C:\\Users\\x\\repo")), "/c/Users/x/repo")
        self.assertEqual(steps.to_posix(Path("/home/x/repo")), str(Path("/home/x/repo")))

    def test_env_script_without_jdk_warns_and_exports_gradle_home(self) -> None:
        script = steps.env_script(self.root, msys=False)
        self.assertIn("export GRADLE_USER_HOME=", script)
        self.assertIn("no JDK 25", script)
        self.assertIn('"$PATH"', script)
        self.assertNotIn("JAVA_HOME=", script)

    def test_toolchain_env_puts_tools_bin_first(self) -> None:
        env = steps.apply_toolchain_env(self.root, {"PATH": "/usr/bin"})
        self.assertTrue(env["PATH"].startswith(str(self.root / ".tools" / "bin")))
        self.assertEqual(env["GRADLE_USER_HOME"], str(self.root / ".tools" / "gradle-home"))


if __name__ == "__main__":
    unittest.main()


class Frontend(TempRoot):
    def test_toolchain_env_and_env_script_set_a_project_local_corepack_home(self) -> None:
        expected = self.root / ".tools" / "corepack"
        self.assertEqual(steps.toolchain_env(self.root)["COREPACK_HOME"], str(expected))
        script = steps.env_script(self.root, msys=False)
        self.assertIn(f"export COREPACK_HOME='{expected}'", script)

    def test_nothing_to_install_without_frontend_package_json(self) -> None:
        self.assertEqual(steps.ensure_frontend(self.root), self.root / "frontend")

    def _with_package_json(self) -> None:
        (self.root / "frontend").mkdir()
        (self.root / "frontend" / "package.json").write_text("{}\n", encoding="utf-8")

    def test_missing_corepack_fails_with_a_clear_message(self) -> None:
        self._with_package_json()
        original = steps.shutil.which
        steps.shutil.which = lambda name, *a, **k: None
        try:
            with self.assertRaisesRegex(core.BootstrapError, "corepack is not on PATH"):
                steps.ensure_frontend(self.root)
        finally:
            steps.shutil.which = original

    def _fake_run(self, returncode: int, output: bytes):
        calls = []

        def run(argv, **kwargs):
            calls.append((argv, kwargs))
            return steps.subprocess.CompletedProcess(argv, returncode, stdout=output)

        return calls, run

    def test_frozen_install_in_frontend_with_project_local_caches(self) -> None:
        self._with_package_json()
        calls, fake = self._fake_run(0, b"Lockfile is up to date\nDone in 1s\n")
        original_which, original_run = steps.shutil.which, steps.subprocess.run
        steps.shutil.which = lambda name, *a, **k: "/usr/bin/corepack"
        steps.subprocess.run = fake
        try:
            result = steps.ensure_frontend(self.root)
        finally:
            steps.shutil.which, steps.subprocess.run = original_which, original_run
        self.assertEqual(result, self.root / "frontend" / "node_modules")
        argv, kwargs = calls[0]
        self.assertEqual(argv, ["/usr/bin/corepack", "pnpm", "install", "--frozen-lockfile"])
        self.assertEqual(kwargs["cwd"], self.root / "frontend")
        self.assertEqual(kwargs["env"]["COREPACK_HOME"], str(self.root / ".tools" / "corepack"))
        self.assertEqual(kwargs["env"]["COREPACK_ENABLE_DOWNLOAD_PROMPT"], "0")

    def test_failed_install_raises_with_the_output_tail(self) -> None:
        self._with_package_json()
        calls, fake = self._fake_run(1, b"ERR_PNPM_OUTDATED_LOCKFILE Cannot install with frozen-lockfile\n")
        original_which, original_run = steps.shutil.which, steps.subprocess.run
        steps.shutil.which = lambda name, *a, **k: "/usr/bin/corepack"
        steps.subprocess.run = fake
        try:
            with self.assertRaisesRegex(core.BootstrapError, "exit 1.*ERR_PNPM_OUTDATED_LOCKFILE"):
                steps.ensure_frontend(self.root)
        finally:
            steps.shutil.which, steps.subprocess.run = original_which, original_run
