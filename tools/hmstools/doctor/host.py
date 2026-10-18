"""Host probes for tools/doctor. Everything the checks read from the machine goes through ``Host``,
so the unit tests can replace it with a fake host."""

from __future__ import annotations

import ctypes
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional


class Host:
    """The real machine."""

    def __init__(self, root: Path):
        self.root = root

    # --- identity
    def system(self) -> str:
        return platform.system()

    def release(self) -> str:
        return platform.release()

    def version(self) -> str:
        return platform.version()

    def machine(self) -> str:
        return platform.machine()

    def python_version(self) -> tuple[int, int, int]:
        return tuple(sys.version_info[:3])  # type: ignore[return-value]

    def env(self, name: str) -> Optional[str]:
        return os.environ.get(name)

    def environ(self) -> dict[str, str]:
        return dict(os.environ)

    # --- files and commands
    def read_text(self, path: str) -> Optional[str]:
        try:
            with open(path, encoding="utf-8", errors="replace") as handle:
                return handle.read()
        except OSError:
            return None

    def exists(self, path: Path) -> bool:
        return path.exists()

    def glob(self, directory: Path, pattern: str) -> list[Path]:
        return sorted(directory.glob(pattern)) if directory.is_dir() else []

    def which(self, name: str) -> Optional[str]:
        return shutil.which(name)

    def run(
        self,
        argv: list[str],
        timeout: float = 30.0,
        cwd: Optional[Path] = None,
        env: Optional[dict[str, str]] = None,
    ) -> tuple[int, str]:
        exe = shutil.which(argv[0]) if not os.path.isabs(argv[0]) else argv[0]
        if exe is None:
            return 127, f"{argv[0]}: not found"
        try:
            proc = subprocess.run(
                [exe, *argv[1:]],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                timeout=timeout,
                cwd=str(cwd) if cwd else None,
                env=env,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return 124, f"{argv[0]}: timed out after {timeout:.0f} s"
        except OSError as exc:
            return 126, f"{argv[0]}: {exc}"
        return proc.returncode, proc.stdout.decode("utf-8", errors="replace").strip()

    # --- resources
    def cpu_count(self) -> int:
        return os.cpu_count() or 0

    def ram_gib(self) -> Optional[float]:
        return total_ram_gib()

    def disk_free_gib(self, path: Path) -> Optional[float]:
        try:
            return shutil.disk_usage(path).free / 1024**3
        except OSError:
            return None


def total_ram_gib() -> Optional[float]:
    """Total physical memory visible to this OS, in GiB (in WSL2, the memory of the VM)."""
    system = platform.system()
    try:
        if system == "Linux":
            with open("/proc/meminfo", encoding="ascii") as handle:
                for line in handle:
                    if line.startswith("MemTotal:"):
                        return int(line.split()[1]) / 1024**2
        elif system == "Windows":

            class MemoryStatus(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            status = MemoryStatus()
            status.dwLength = ctypes.sizeof(MemoryStatus)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):  # type: ignore[attr-defined]
                return status.ullTotalPhys / 1024**3
        elif system == "Darwin":
            out = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, check=False, timeout=10)
            return int(out.stdout.strip()) / 1024**3
    except (OSError, ValueError, AttributeError, subprocess.SubprocessError):
        return None
    return None
