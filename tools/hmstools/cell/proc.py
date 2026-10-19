"""Processes and host facts for the cell tools: a runner that tests replace with a fake, `docker run` argument
lists for the pinned tool containers, and the disk and memory guards (DN-013; WP-0.2 plan §2.2).

Secrets never go on a command line: a container receives an environment variable by name only (`-e NAME`), and
the runner passes the value in the child's environment.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Protocol, Sequence

GIB = 1024 ** 3


@dataclass
class Result:
    argv: list[str]
    code: int
    stdout: str = ""
    stderr: str = ""

    @property
    def ok(self) -> bool:
        return self.code == 0

    def tail(self, lines: int = 3) -> str:
        text = (self.stderr.strip() or self.stdout.strip()).splitlines()
        return " | ".join(text[-lines:])


class Runner(Protocol):
    def __call__(self, argv: Sequence[str], env: Optional[dict[str, str]] = None, timeout: float = 600.0) -> Result:
        ...


def run(argv: Sequence[str], env: Optional[dict[str, str]] = None, timeout: float = 600.0) -> Result:
    """Run a program; never raises for a missing program or a timeout (exit code 127 or 124 instead)."""
    full_env = dict(os.environ)
    if env:
        full_env.update(env)
    try:
        done = subprocess.run(list(argv), capture_output=True, text=True, encoding="utf-8", errors="replace",
                              env=full_env, timeout=timeout, check=False)
    except FileNotFoundError:
        return Result(list(argv), 127, "", f"{argv[0]}: not found")
    except subprocess.TimeoutExpired:
        return Result(list(argv), 124, "", f"timed out after {timeout:.0f} s")
    return Result(list(argv), done.returncode, done.stdout, done.stderr)


@dataclass
class DockerRun:
    """`docker run --rm` of a pinned image. Mounts are (host path, container path, read_only)."""

    image: str
    args: list[str]
    network: Optional[str] = None
    user: Optional[str] = None
    mounts: list[tuple[str, str, bool]] = field(default_factory=list)
    env_names: list[str] = field(default_factory=list)  # passed by name: the value never appears in argv
    env_values: dict[str, str] = field(default_factory=dict)  # non-secret values only
    workdir: Optional[str] = None

    def argv(self) -> list[str]:
        out = ["docker", "run", "--rm"]
        if self.network:
            out += ["--network", self.network]
        if self.user:
            out += ["-u", self.user]
        for host, inside, read_only in self.mounts:
            out += ["-v", f"{host}:{inside}" + (":ro" if read_only else "")]
        for name in self.env_names:
            out += ["-e", name]
        for name, value in sorted(self.env_values.items()):
            out += ["-e", f"{name}={value}"]
        if self.workdir:
            out += ["-w", self.workdir]
        return out + [self.image, *self.args]


def host_user() -> Optional[str]:
    """uid:gid, so files a tool container writes into HMS_CELL_HOME belong to the user (POSIX only)."""
    if hasattr(os, "getuid"):
        return f"{os.getuid()}:{os.getgid()}"
    return None


def disk_free_gib(path: Path) -> float:
    return shutil.disk_usage(path).free / GIB


def mem_available_gib(meminfo: Optional[str] = None) -> Optional[float]:
    """MemAvailable from /proc/meminfo in GiB, or None where there is no /proc (Windows)."""
    if meminfo is None:
        try:
            meminfo = Path("/proc/meminfo").read_text(encoding="ascii")
        except OSError:
            return None
    for line in meminfo.splitlines():
        if line.startswith("MemAvailable:"):
            return int(line.split()[1]) * 1024 / GIB
    return None


class GuardError(RuntimeError):
    """A host limit that stops the command (fail closed)."""


def require_disk(path: Path, min_free_gib: float, what: str) -> float:
    """Raise GuardError if the disk holding path has less than min_free_gib free (DN-013); return the free GiB."""
    if not path.exists():
        raise GuardError(f"{what}: the disk guard path {path} does not exist; set guards.disk_path in cell.yaml to the "
                         "file system that holds Docker's data")
    free = disk_free_gib(path)
    if free < min_free_gib:
        raise GuardError(f"{what}: {free:.1f} GiB free on {path}, below the {min_free_gib:g} GiB line (DN-013); "
                         "stopped before pulling anything more")
    return free


def ensure_private_dir(path: Path) -> Path:
    """Create a directory readable only by the user (mode 700 on POSIX)."""
    path.mkdir(parents=True, exist_ok=True)
    if os.name == "posix":
        path.chmod(0o700)
    return path


def write_private(path: Path, text: str) -> None:
    """Write a file only the user can read (mode 600 on POSIX), creating it with that mode from the start."""
    ensure_private_dir(path.parent)
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_BINARY", 0)
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
    if os.name == "posix":
        path.chmod(0o600)
