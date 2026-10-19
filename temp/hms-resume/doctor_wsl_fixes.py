"""tools/doctor: count the Windows drive behind WSL2's virtual disk; recognise rustup's ~/.cargo/bin."""
import sys
from pathlib import Path

root = Path(sys.argv[1])


def rep(rel, old, new):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, (rel, old[:90])
    p.write_text(s.replace(old, new), encoding="utf-8", newline="\n")


C = "tools/hmstools/doctor/checks.py"
rep(C, """WINDOWS_RESERVE_GIB = 4.0  # [P] memory left to Windows when sizing the WSL2 VM
""", """WINDOWS_RESERVE_GIB = 4.0  # [P] memory left to Windows when sizing the WSL2 VM
# WSL2 keeps each distribution's virtual disk on a Windows drive: C: unless it was moved [P]. Space inside the
# virtual disk is only real while that drive has it, so on WSL2 the disk check also counts this drive.
WSL_WINDOWS_DRIVE = Path("/mnt/c")
""")
rep(C, """def is_windows(host: Host) -> bool:
    return host.system().lower().startswith(("windows", "msys", "mingw", "cygwin"))
""", """def is_windows(host: Host) -> bool:
    return host.system().lower().startswith(("windows", "msys", "mingw", "cygwin"))


def is_wsl2(host: Host) -> bool:
    proc_version = (host.read_text("/proc/version") or "").lower()
    return host.system() == "Linux" and "microsoft" in proc_version and (
        "wsl2" in proc_version or "microsoft-standard" in proc_version
    )
""")
rep(C, """    proc_version = host.read_text("/proc/version") or ""
    wsl2 = "microsoft" in proc_version.lower() and ("wsl2" in proc_version.lower() or "microsoft-standard" in proc_version.lower())
""", """    wsl2 = is_wsl2(host)
""")
rep(C, """def check_rust(host: Host) -> Item:
    need = "Rust stable (rustc and cargo)"
    if not host.which("rustc") or not host.which("cargo"):
        missing = [name for name in ("rustc", "cargo") if not host.which(name)]
        return Item("rust", "Rust stable and cargo", False, f"{', '.join(missing)} not on PATH", need)""",
"""def check_rust(host: Host) -> Item:
    need = "Rust stable (rustc and cargo)"
    if not host.which("rustc") or not host.which("cargo"):
        missing = [name for name in ("rustc", "cargo") if not host.which(name)]
        home = host.env("HOME")
        cargo_bin = Path(home) / ".cargo" / "bin" if home else None
        if cargo_bin and all(host.exists(cargo_bin / name) for name in ("rustc", "cargo")):
            return Item(
                "rust", "Rust stable and cargo", False,
                f"{', '.join(missing)} not on PATH in this shell, but rustup installed them in ~/.cargo/bin", need,
                fix_key="rust-path",
                note="rustup adds '. \\"$HOME/.cargo/env\\"' to ~/.profile and ~/.bashrc; a non-login shell reads neither.",
            )
        return Item("rust", "Rust stable and cargo", False, f"{', '.join(missing)} not on PATH", need)""")
rep(C, """    disk = host.disk_free_gib(host.root)
    # On a Windows host the cells run in the WSL2 VM, which can be given the host RAM minus what Windows needs.""",
"""    disk = host.disk_free_gib(host.root)
    disk_label = "unknown" if disk is None else f"{disk:.1f} GiB free on the repository volume"
    windows_disk = None
    if is_wsl2(host) and host.exists(WSL_WINDOWS_DRIVE):
        windows_disk = host.disk_free_gib(WSL_WINDOWS_DRIVE)
        if windows_disk is not None:
            disk_label += f" (the WSL2 virtual disk); {windows_disk:.1f} GiB free on C:, which holds that disk"
            disk = windows_disk if disk is None else min(disk, windows_disk)
    # On a Windows host the cells run in the WSL2 VM, which can be given the host RAM minus what Windows needs.""")
rep(C, """            "disk", "Free disk", disk is not None and disk >= DISK_FREE_GIB,
            "unknown" if disk is None else f"{disk:.1f} GiB free on the repository volume",
            f">= {DISK_FREE_GIB:.0f} GiB free [P]",
        ),""", """            "disk", "Free disk", disk is not None and disk >= DISK_FREE_GIB, disk_label,
            f">= {DISK_FREE_GIB:.0f} GiB free [P]",
            note="" if windows_disk is None else
            "On WSL2 the smaller figure counts: the virtual disk can only grow while its Windows drive has space [P].",
        ),""")
rep(C, """        "disk_free_gib": None if disk is None else round(disk, 1),
    }""", """        "disk_free_gib": None if disk is None else round(disk, 1),
        "windows_drive_free_gib": None if windows_disk is None else round(windows_disk, 1),
    }""")

F = "tools/hmstools/doctor/fixes.py"
rep(F, """    "tauri": [""", """    "rust-path": [
        '. "$HOME/.cargo/env"   # puts ~/.cargo/bin on PATH in this shell; or start a login shell (bash -l)',
    ],
    "tauri": [""")
rep(F, """    "disk": ["Free space on the volume that holds the repository, or move the repository to a larger volume."],""",
    """    "disk": [
        "Free space on the volume that holds the repository, or move the repository to a larger volume.",
        "# WSL2: free space on the Windows drive that holds the virtual disk (C: by default), or move the"
        " distribution to a larger drive with 'wsl --manage Ubuntu-24.04 --move <folder>' (in Windows).",
    ],""")

T = "tools/hmstools/doctor/tests/test_doctor.py"
rep(T, """        self.disk = overrides.pop("disk", 400.0)""", """        self.disk = overrides.pop("disk", 400.0)
        self.disk_by_path: dict[str, float] = overrides.pop("disk_by_path", {})""")
rep(T, """    def disk_free_gib(self, path: Path) -> Optional[float]:
        return self.disk
""", """    def disk_free_gib(self, path: Path) -> Optional[float]:
        return self.disk_by_path.get(Path(path).as_posix(), self.disk)
""")
rep(T, """    def test_disk_threshold(self) -> None:
        self.assertFalse(item(checks.run_checks(FakeHost(disk=20.0)), "disk").ok)
        self.assertTrue(item(checks.run_checks(FakeHost(disk=checks.DISK_FREE_GIB)), "disk").ok)
""", """    def test_disk_threshold(self) -> None:
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
""")
print("ok")
