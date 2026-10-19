"""Unit tests for tools/doctor with a fake host (no real commands are run)."""

from __future__ import annotations

import json
import unittest
from pathlib import Path, PurePosixPath
from typing import Optional

from hmstools.doctor import checks
from hmstools.doctor.__main__ import render, to_json

ROOT = Path("/home/dev/src/hms")
REQUIREMENTS = "PyYAML==6.0.3 \\\n    --hash=sha256:" + "a" * 64 + "\njsonschema==4.26.0 \\\n    --hash=sha256:" + "b" * 64 + "\n"
# 'java -version' of the pinned release (ADR-002) and of other JDK 25 builds, as each prints it.
TEMURIN_PINNED = (
    'openjdk version "25.0.4.1" 2026-08-18 LTS\n'
    "OpenJDK Runtime Environment Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS)\n"
    "OpenJDK 64-Bit Server VM Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS, mixed mode, sharing)\n"
)
UBUNTU_25 = (  # the system JDK the provisioning script installs on the WSL build host: same version, not the pin
    'openjdk version "25.0.4.1" 2026-08-18\n'
    "OpenJDK Runtime Environment (build 25.0.4.1+1-1-24.04.4-Ubuntu)\n"
)
TEMURIN_NEWER = 'openjdk version "25.0.5" 2026-10-20 LTS\nOpenJDK Runtime Environment Temurin-25.0.5+11 (build 25.0.5+11-LTS)\n'


class FakeHost:
    """A configurable host. Commands answer from ``commands`` keyed by the joined argv."""

    def __init__(self, **overrides):
        self.root = overrides.pop("root", ROOT)
        self._system = overrides.pop("system", "Linux")
        self._release = overrides.pop("release", "6.6.87.2-microsoft-standard-WSL2")
        self.files: dict[str, str] = {
            "/proc/version": "Linux version 6.6.87.2-microsoft-standard-WSL2 (root@host) #1 SMP",
            "/etc/os-release": 'PRETTY_NAME="Ubuntu 24.04.3 LTS"\nVERSION_CODENAME=noble\n',
            str(self.root / ".gitattributes"): "* text=auto eol=lf\n*.png binary\n",
            str(self.root / "tools" / "requirements.txt"): REQUIREMENTS,
        }
        self.paths = {
            str(self.root / ".tools" / "jdk-25.0.4.1+1" / "bin" / "java"),
            str(self.root / ".tools" / "venv" / "bin" / "python"),
            str(self.root / ".tools" / "bin" / "gitleaks"),
            str(self.root / "frontend" / "package.json"),
            str(self.root / "tools" / "requirements.txt"),
        }
        self.on_path = {n: f"/usr/bin/{n}" for n in
                        ["docker", "k3d", "kubectl", "helm", "node", "corepack", "rustc", "cargo", "pkg-config", "git"]}
        venv = json.dumps({"python": "3.12.3", "packages": {"PyYAML": "6.0.3", "jsonschema": "4.26.0"}})
        self.commands: dict[str, tuple[int, str]] = {
            "docker --version": (0, "Docker version 28.5.1, build e180ab8"),
            "docker info --format {{.ServerVersion}}": (0, "28.5.1"),
            "k3d version": (0, "k3d version v5.8.3"),
            "kubectl version --client": (0, "Client Version: v1.34.1"),
            "helm version --short": (0, "v3.19.0+g3d8990f"),
            "node --version": (0, "v24.13.0"),
            "corepack --version": (0, "0.34.5"),
            "corepack pnpm --version": (0, "12.12.1"),
            "rustc --version": (0, "rustc 1.90.0 (1159e78c4 2025-09-14)"),
            "cargo --version": (0, "cargo 1.90.0 (840b83a10 2025-07-30)"),
            "git --version": (0, "git version 2.43.0"),
            f"git -C {self.root} config --get core.autocrlf": (1, ""),
            f"{self.root / '.tools' / 'jdk-25.0.4.1+1' / 'bin' / 'java'} -XX:-UsePerfData -version": (0, TEMURIN_PINNED),
            f"{self.root / '.tools' / 'venv' / 'bin' / 'python'} -I -c {checks.VENV_PROBE}": (0, venv),
            f"{self.root / '.tools' / 'bin' / 'gitleaks'} version": (0, "8.30.1"),
        }
        for module in ["webkit2gtk-4.1", "ayatana-appindicator3-0.1", "librsvg-2.0", "openssl"]:
            self.commands[f"pkg-config --exists {module}"] = (0, "")
        self.ram = overrides.pop("ram", 47.0)
        self.cores = overrides.pop("cores", 16)
        self.disk = overrides.pop("disk", 400.0)
        self.disk_by_path: dict[str, float] = overrides.pop("disk_by_path", {})
        self.python = overrides.pop("python", (3, 12, 3))
        self.envvars: dict[str, str] = overrides.pop("env", {})
        if overrides:
            raise TypeError(f"unknown overrides {overrides}")

    def system(self) -> str:
        return self._system

    def release(self) -> str:
        return self._release

    def version(self) -> str:
        return "#1 SMP"

    def machine(self) -> str:
        return "x86_64"

    def python_version(self):
        return self.python

    def env(self, name: str) -> Optional[str]:
        return self.envvars.get(name)

    def environ(self) -> dict[str, str]:
        return dict(self.envvars)

    def read_text(self, path: str) -> Optional[str]:
        return self.files.get(str(path))

    def exists(self, path: Path) -> bool:
        # Compare in POSIX form, so Linux paths built with pathlib also match when the tests run on Windows.
        text = Path(path).as_posix()
        known = {Path(p).as_posix() for p in self.paths}
        return text in known or any(p.startswith(text + "/") for p in known)

    def glob(self, directory: Path, pattern: str) -> list[Path]:
        found = set()
        for p in self.paths:
            path = Path(p)
            try:
                rel = path.relative_to(directory)
            except ValueError:
                continue
            first = directory / rel.parts[0]
            if PurePosixPath(rel.parts[0]).match(pattern):
                found.add(first)
        return sorted(found)

    def which(self, name: str) -> Optional[str]:
        return self.on_path.get(name)

    def run(self, argv, timeout=30.0, cwd=None, env=None):
        key = " ".join(str(a) for a in argv)
        return self.commands.get(key, (127, f"{argv[0]}: not found"))

    def cpu_count(self) -> int:
        return self.cores

    def ram_gib(self) -> Optional[float]:
        return self.ram

    def disk_free_gib(self, path: Path) -> Optional[float]:
        return self.disk_by_path.get(Path(path).as_posix(), self.disk)


def item(report: checks.Report, item_id: str) -> checks.Item:
    return next(i for i in report.items if i.id == item_id)


class FullTier(unittest.TestCase):
    def test_complete_wsl2_host_passes_with_dev_cell(self) -> None:
        report = checks.run_checks(FakeHost())
        failing = [(i.id, i.found) for i in report.items if not i.ok]
        self.assertEqual(failing, [])
        self.assertTrue(report.ok)
        self.assertEqual(report.profile, "dev cell")
        self.assertIn("(WSL2)", item(report, "os").found)
        self.assertEqual(item(report, "autocrlf").found, "unset (false)")

    def test_every_prerequisite_is_checked(self) -> None:
        ids = [i.id for i in checks.run_checks(FakeHost()).items]
        for expected in ["os", "container-engine", "container-daemon", "k3d", "kubectl", "helm", "jdk", "node",
                         "pnpm", "rust", "tauri", "python", "git", "autocrlf", "gitattributes", "venv", "gitleaks",
                         "ram", "cpu", "disk"]:
            self.assertIn(expected, ids)

    def test_repository_under_mnt_c_fails(self) -> None:
        report = checks.run_checks(FakeHost(root=Path("/mnt/c/Users/dev/hms")))
        self.assertFalse(item(report, "os").ok)
        self.assertIn("Windows file system", item(report, "os").note)
        self.assertFalse(report.ok)

    def test_missing_container_engine_prints_ubuntu_install_commands(self) -> None:
        host = FakeHost()
        del host.on_path["docker"]
        report = checks.run_checks(host)
        engine = item(report, "container-engine")
        self.assertFalse(engine.ok)
        fix = engine.to_dict(windows_host=False)["fix"]["ubuntu"]
        self.assertTrue(any("docker-ce" in line for line in fix))
        self.assertIn("apt-get install -y docker-ce", render(report))
        self.assertFalse(report.ok)

    def test_unreachable_daemon_fails(self) -> None:
        host = FakeHost()
        host.commands["docker info --format {{.ServerVersion}}"] = (1, "Cannot connect to the Docker daemon")
        report = checks.run_checks(host)
        self.assertTrue(item(report, "container-engine").ok)
        self.assertFalse(item(report, "container-daemon").ok)

    def test_podman_is_accepted(self) -> None:
        host = FakeHost()
        del host.on_path["docker"]
        host.on_path["podman"] = "/usr/bin/podman"
        host.commands["podman --version"] = (0, "podman version 4.9.3")
        host.commands["podman info --format {{.Version.Version}}"] = (0, "4.9.3")
        report = checks.run_checks(host)
        self.assertTrue(item(report, "container-daemon").ok)

    def test_autocrlf_true_fails_and_input_passes(self) -> None:
        host = FakeHost()
        host.commands[f"git -C {host.root} config --get core.autocrlf"] = (0, "true")
        self.assertFalse(item(checks.run_checks(host), "autocrlf").ok)
        host.commands[f"git -C {host.root} config --get core.autocrlf"] = (0, "input")
        self.assertTrue(item(checks.run_checks(host), "autocrlf").ok)

    def test_missing_gitattributes_fails(self) -> None:
        host = FakeHost()
        del host.files[str(host.root / ".gitattributes")]
        self.assertFalse(item(checks.run_checks(host), "gitattributes").ok)

    def test_wrong_node_and_jdk_versions_fail(self) -> None:
        host = FakeHost()
        host.commands["node --version"] = (0, "v22.11.0")
        java = host.root / ".tools" / "jdk-25.0.4.1+1" / "bin" / "java"
        host.commands[f"{java} -XX:-UsePerfData -version"] = (0, 'openjdk version "21.0.5" 2024-10-15 LTS')
        report = checks.run_checks(host)
        self.assertFalse(item(report, "node").ok)
        self.assertFalse(item(report, "jdk").ok)

    def test_only_the_pinned_jdk_passes(self) -> None:
        # ADR-002 pins one Temurin release (tools/hmstools/bootstrap/steps.py); any other JDK 25 fails (R-14).
        host = FakeHost()
        java = host.root / ".tools" / "jdk-25.0.4.1+1" / "bin" / "java"
        jdk = item(checks.run_checks(host), "jdk")
        self.assertTrue(jdk.ok)
        self.assertEqual(jdk.found, '.tools/jdk-25.0.4.1+1: java "25.0.4.1", Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS), '
                                    "the pinned release")
        for other in (UBUNTU_25, TEMURIN_NEWER, 'openjdk version "25.0.4.1" 2026-08-18 LTS'):
            host.commands[f"{java} -XX:-UsePerfData -version"] = (0, other)
            jdk = item(checks.run_checks(host), "jdk")
            self.assertFalse(jdk.ok, other)
            self.assertIn("not the pinned release", jdk.found)
            self.assertIn("Temurin-25.0.4.1+1", jdk.need)
            self.assertTrue(any("sh tools/bootstrap jdk" in line for line in jdk.to_dict(windows_host=False)["fix"]["ubuntu"]))

    def test_the_pinned_project_jdk_wins_over_a_system_jdk(self) -> None:
        # The WSL build host has Ubuntu's OpenJDK 25.0.4.1 on PATH; tools/ci/run uses .tools/jdk-25.0.4.1+1.
        host = FakeHost()
        host.on_path["java"] = "/usr/bin/java"
        host.paths.add("/usr/bin/java")
        host.commands[f"{Path('/usr/bin/java')} -XX:-UsePerfData -version"] = (0, UBUNTU_25)
        jdk = item(checks.run_checks(host), "jdk")
        self.assertTrue(jdk.ok)
        self.assertTrue(jdk.found.startswith(".tools/jdk-25.0.4.1+1:"), jdk.found)

    def test_without_a_project_jdk_the_system_jdk_must_be_the_pin(self) -> None:
        host = FakeHost()
        host.paths.discard(str(host.root / ".tools" / "jdk-25.0.4.1+1" / "bin" / "java"))
        host.on_path["java"] = "/usr/bin/java"
        host.paths.add("/usr/bin/java")
        host.commands[f"{Path('/usr/bin/java')} -XX:-UsePerfData -version"] = (0, UBUNTU_25)
        jdk = item(checks.run_checks(host), "jdk")
        self.assertFalse(jdk.ok)
        self.assertIn("PATH: java \"25.0.4.1\" (build 25.0.4.1+1-1-24.04.4-Ubuntu), not the pinned release", jdk.found)
        host.commands[f"{Path('/usr/bin/java')} -XX:-UsePerfData -version"] = (0, TEMURIN_PINNED)
        self.assertTrue(item(checks.run_checks(host), "jdk").ok)

    def test_java_home_comes_before_path_without_a_project_jdk(self) -> None:
        host = FakeHost(env={"JAVA_HOME": "/opt/jdk-other"})
        host.paths.discard(str(host.root / ".tools" / "jdk-25.0.4.1+1" / "bin" / "java"))
        host.paths.update({"/opt/jdk-other/bin/java", "/usr/bin/java"})
        host.on_path["java"] = "/usr/bin/java"
        host.commands[f"{Path('/opt/jdk-other/bin/java')} -XX:-UsePerfData -version"] = (0, TEMURIN_NEWER)
        host.commands[f"{Path('/usr/bin/java')} -XX:-UsePerfData -version"] = (0, TEMURIN_PINNED)
        jdk = item(checks.run_checks(host), "jdk")
        self.assertFalse(jdk.ok, "the build would run on JAVA_HOME, which is not the pin")
        self.assertIn("JAVA_HOME: java \"25.0.5\"", jdk.found)
        host.envvars["JAVA_HOME"] = "/opt/missing"
        jdk = item(checks.run_checks(host), "jdk")
        self.assertFalse(jdk.ok)
        self.assertIn("JAVA_HOME: no java", jdk.found)

    def test_nightly_rust_is_not_stable(self) -> None:
        host = FakeHost()
        host.commands["rustc --version"] = (0, "rustc 1.92.0-nightly (abc 2025-10-01)")
        self.assertFalse(item(checks.run_checks(host), "rust").ok)

    def test_tauri_prerequisites_name_what_is_missing(self) -> None:
        host = FakeHost()
        host.commands["pkg-config --exists webkit2gtk-4.1"] = (1, "")
        host.commands["pkg-config --exists ayatana-appindicator3-0.1"] = (1, "")
        host.commands["pkg-config --exists appindicator3-0.1"] = (0, "")
        tauri = item(checks.run_checks(host), "tauri")
        self.assertFalse(tauri.ok)
        self.assertIn("webkit2gtk-4.1", tauri.found)
        self.assertNotIn("appindicator", tauri.found)

    def test_python_must_be_312(self) -> None:
        self.assertFalse(item(checks.run_checks(FakeHost(python=(3, 13, 1))), "python").ok)

    def test_venv_with_wrong_pin_fails(self) -> None:
        host = FakeHost()
        venv = host.root / ".tools" / "venv" / "bin" / "python"
        bad = json.dumps({"python": "3.12.3", "packages": {"PyYAML": "6.0.2", "jsonschema": "4.26.0"}})
        host.commands[f"{venv} -I -c {checks.VENV_PROBE}"] = (0, bad)
        venv_item = item(checks.run_checks(host), "venv")
        self.assertFalse(venv_item.ok)
        self.assertIn("pyyaml", venv_item.found)


class Resources(unittest.TestCase):
    def test_lite_cell_below_32_gb(self) -> None:
        report = checks.run_checks(FakeHost(ram=23.4, cores=8))
        self.assertEqual(report.profile, "lite cell")
        self.assertTrue(item(report, "ram").ok)
        self.assertTrue(report.ok)

    def test_no_cell_below_16_gb_fails(self) -> None:
        report = checks.run_checks(FakeHost(ram=7.7, cores=8))
        self.assertEqual(report.profile, "none")
        self.assertFalse(item(report, "ram").ok)
        self.assertFalse(report.ok)

    def test_dev_cell_needs_eight_cores(self) -> None:
        self.assertEqual(checks.run_checks(FakeHost(ram=62.0, cores=6)).profile, "lite cell")
        self.assertEqual(checks.run_checks(FakeHost(ram=62.0, cores=2)).profile, "none")

    def test_disk_threshold(self) -> None:
        self.assertFalse(item(checks.run_checks(FakeHost(disk=20.0)), "disk").ok)
        self.assertTrue(item(checks.run_checks(FakeHost(disk=checks.DISK_FREE_GIB)), "disk").ok)

    def test_wsl2_disk_counts_the_windows_drive_that_holds_the_virtual_disk(self) -> None:
        host = FakeHost(disk=947.5, disk_by_path={"/mnt/c": 35.0})
        host.paths.add("/mnt/c/Windows")
        disk = item(checks.run_checks(host), "disk")
        self.assertFalse(disk.ok)
        self.assertIn("947.5 GiB free on the repository volume (the WSL2 virtual disk)", disk.found)
        self.assertIn("35.0 GiB free on C:", disk.found)
        report = checks.run_checks(host)
        self.assertEqual(report.host["windows_drive_free_gib"], 35.0)
        self.assertEqual(report.host["disk_free_gib"], 35.0)

    def test_native_linux_disk_ignores_mnt_c(self) -> None:
        host = FakeHost(disk=400.0, disk_by_path={"/mnt/c": 1.0})
        host.files["/proc/version"] = "Linux version 6.8.0-45-generic (buildd@lcy02) #45-Ubuntu SMP"
        host.paths.add("/mnt/c/Windows")
        self.assertTrue(item(checks.run_checks(host), "disk").ok)

    def test_rust_installed_by_rustup_but_not_on_path(self) -> None:
        host = FakeHost(env={"HOME": "/home/surface"})
        del host.on_path["rustc"], host.on_path["cargo"]
        host.paths.update({"/home/surface/.cargo/bin/rustc", "/home/surface/.cargo/bin/cargo"})
        rust = item(checks.run_checks(host), "rust")
        self.assertFalse(rust.ok)
        self.assertIn("rustup installed them in ~/.cargo/bin", rust.found)
        self.assertEqual(rust.fix_key, "rust-path")
        self.assertIn('. "$HOME/.cargo/env"', checks.UBUNTU["rust-path"][0])


class WindowsHost(unittest.TestCase):
    def windows(self, ram: float) -> checks.Report:
        host = FakeHost(root=Path("C:/Users/dev/hms"), system="Windows", release="11", ram=ram, cores=8,
                        env={"MSYSTEM": "MINGW64"})
        return checks.run_checks(host)

    def test_windows_host_fails_os_and_prints_wsl_steps(self) -> None:
        report = self.windows(63.7)
        self.assertFalse(item(report, "os").ok)
        steps = "\n".join(report.windows_steps)
        self.assertIn("wsl --install -d Ubuntu-24.04", steps)
        self.assertIn("memory=32GB", steps)
        self.assertIn("processors=8", steps)
        self.assertIn("/mnt/c/Users/dev/hms", steps)
        self.assertIn("Windows host steps", render(report))
        self.assertFalse(item(report, "tauri").ok)

    def test_windows_profile_leaves_memory_for_windows(self) -> None:
        self.assertEqual(self.windows(63.7).profile, "dev cell")
        self.assertEqual(self.windows(31.8).profile, "lite cell")
        report = self.windows(15.6)
        self.assertEqual(report.profile, "none")
        self.assertIn("memory=11GB", "\n".join(report.windows_steps))


class FastTier(unittest.TestCase):
    def test_fast_tier_checks_only_its_five_items(self) -> None:
        report = checks.run_checks(FakeHost(system="Windows", ram=4.0, disk=1.0), tier="fast")
        self.assertEqual([i.id for i in report.items], ["jdk", "node", "pnpm", "venv", "gitleaks"])
        self.assertIsNone(report.profile)

    def test_fast_tier_missing_gitleaks_fails(self) -> None:
        host = FakeHost()
        host.paths.discard(str(host.root / ".tools" / "bin" / "gitleaks"))
        report = checks.run_checks(host, tier="fast")
        self.assertFalse(report.ok)
        self.assertIn("sh tools/bootstrap gitleaks", render(report))


class JsonContract(unittest.TestCase):
    def test_json_follows_checkresult_contract(self) -> None:
        host = FakeHost()
        del host.on_path["k3d"]
        data = to_json(checks.run_checks(host))
        for key in ["check", "ok", "counts", "errors", "warnings"]:
            self.assertIn(key, data)
        self.assertEqual(data["check"], "doctor")
        self.assertFalse(data["ok"])
        self.assertEqual(data["counts"]["missing"], 1)
        self.assertTrue(any("k3d" in e for e in data["errors"]))
        self.assertEqual(data["profile"], "dev cell")
        self.assertEqual(data["thresholds"]["marked"], "[P]")
        json.dumps(data)  # serialisable


if __name__ == "__main__":
    unittest.main()
