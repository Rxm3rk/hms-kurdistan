"""Download, verification, extraction and host-detection helpers for tools/bootstrap (stdlib only)."""

from __future__ import annotations

import hashlib
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from typing import Callable, Optional

USER_AGENT = "hms-kurdistan-bootstrap/1 (project-local toolchain fetch)"
CHUNK = 256 * 1024
RETRYABLE_HTTP = {408, 425, 429, 500, 502, 503, 504}


class BootstrapError(RuntimeError):
    """A step could not complete; the message says what to do."""


def log(message: str) -> None:
    print(f"bootstrap: {message}", file=sys.stderr, flush=True)


# --------------------------------------------------------------------------- host


def host_os() -> str:
    """Return ``linux``, ``windows`` or ``mac``."""
    system = platform.system().lower()
    if system.startswith("linux"):
        return "linux"
    if system.startswith(("windows", "msys", "mingw", "cygwin")):
        return "windows"
    if system == "darwin":
        return "mac"
    raise BootstrapError(f"unsupported operating system: {platform.system()}")


def host_arch() -> str:
    """Return ``x64`` or ``aarch64``."""
    machine = platform.machine().lower()
    if machine in {"x86_64", "amd64", "x64"}:
        return "x64"
    if machine in {"aarch64", "arm64"}:
        return "aarch64"
    raise BootstrapError(f"unsupported CPU architecture: {platform.machine()}")


def exe_name(name: str, os_name: Optional[str] = None) -> str:
    return name + ".exe" if (os_name or host_os()) == "windows" else name


def tools_dir(root: Path) -> Path:
    return root / ".tools"


def private_env(root: Path) -> dict[str, str]:
    """Environment for child processes that keeps temporary and cache files inside .tools/."""
    tmp = tools_dir(root) / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    for key in ("TMP", "TEMP", "TMPDIR"):
        env[key] = str(tmp)
    env["PIP_CACHE_DIR"] = str(tools_dir(root) / "cache" / "pip")
    env["PIP_DISABLE_PIP_VERSION_CHECK"] = "1"
    env["PYTHONNOUSERSITE"] = "1"
    return env


def run_quiet(argv: list[str], timeout: float = 60.0, env: Optional[dict[str, str]] = None) -> tuple[int, str]:
    """Run a command and return (exit code, combined stdout and stderr). Never raises for a missing binary."""
    try:
        proc = subprocess.run(
            argv,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            env=env,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return 127, str(exc)
    return proc.returncode, proc.stdout.decode("utf-8", errors="replace")


# --------------------------------------------------------------------------- hashing


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def base36(number: int) -> str:
    """Base-36 digits as java.math.BigInteger#toString(36) prints them (lower case, no leading zeros)."""
    if number < 0:
        raise ValueError("negative number")
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    if number == 0:
        return "0"
    out = []
    while number:
        number, rest = divmod(number, 36)
        out.append(digits[rest])
    return "".join(reversed(out))


# --------------------------------------------------------------------------- network

Opener = Callable[[urllib.request.Request, float], object]


def _default_open(request: urllib.request.Request, timeout: float):  # pragma: no cover - network
    return urllib.request.urlopen(request, timeout=timeout)


_open: Opener = _default_open


def set_opener(opener: Opener) -> Opener:
    """Replace the HTTP opener (used by the unit tests); returns the previous one."""
    global _open
    previous = _open
    _open = opener
    return previous


def http_get(url: str, timeout: float = 60.0, headers: Optional[dict[str, str]] = None) -> bytes:
    """GET a small resource (JSON, a checksum file) into memory, with retries."""
    last: Optional[BaseException] = None
    for attempt in range(1, 5):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
        try:
            with _open(request, timeout) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_HTTP:
                raise BootstrapError(f"GET {url} failed: HTTP {exc.code}") from exc
            last = exc
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
            last = exc
        time.sleep(min(20, 2**attempt))
    raise BootstrapError(f"GET {url} failed after retries: {last}")


def _fetch_resumable(url: str, part: Path, timeout: float) -> None:
    have = part.stat().st_size if part.exists() else 0
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    if have:
        request.add_header("Range", f"bytes={have}-")
    try:
        response = _open(request, timeout)
    except urllib.error.HTTPError as exc:
        if exc.code == 416 and have:
            log(f"{part.name}: already complete ({have} bytes), verifying")
            return
        raise
    with response:
        status = getattr(response, "status", 200)
        if have and status == 206:
            mode = "ab"
            log(f"resuming {url} at {have} bytes")
        else:
            mode, have = "wb", 0
        length = response.headers.get("Content-Length")
        total = have + int(length) if length and length.isdigit() else None
        done, started, last_report = have, time.monotonic(), time.monotonic()
        with open(part, mode) as out:
            while True:
                block = response.read(CHUNK)
                if not block:
                    break
                out.write(block)
                done += len(block)
                now = time.monotonic()
                if now - last_report >= 15:
                    rate = (done - have) / max(now - started, 0.001) / 1024
                    size = f" of {total / 1048576:.1f} MiB" if total else ""
                    log(f"{part.name[:-5]}: {done / 1048576:.1f} MiB{size} ({rate:.0f} KiB/s)")
                    last_report = now
        if total is not None and done < total:
            raise ConnectionError(f"connection closed at {done} of {total} bytes")


def download(url: str, dest: Path, expected_sha256: str, *, attempts: int = 6, timeout: float = 60.0) -> Path:
    """Download ``url`` to ``dest`` and verify its SHA-256. Reuses a verified ``dest`` and resumes a ``.part`` file.

    A file whose checksum does not match is deleted and the step fails: nothing unverified is kept.
    """
    expected = expected_sha256.strip().lower()
    if len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
        raise BootstrapError(f"not a SHA-256 checksum for {dest.name}: {expected_sha256!r}")
    if dest.is_file():
        if sha256_file(dest) == expected:
            log(f"reusing verified {dest.name}")
            return dest
        log(f"{dest.name}: checksum does not match, fetching again")
        dest.unlink()
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    restarted = False
    while True:
        for attempt in range(1, attempts + 1):
            try:
                _fetch_resumable(url, part, timeout)
                break
            except urllib.error.HTTPError as exc:
                if exc.code not in RETRYABLE_HTTP or attempt == attempts:
                    raise BootstrapError(f"download failed: {url}: HTTP {exc.code}") from exc
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
                if attempt == attempts:
                    raise BootstrapError(f"download failed after {attempts} attempts: {url}: {exc}") from exc
                log(f"{dest.name}: {exc}; retrying ({attempt}/{attempts})")
            time.sleep(min(30, 2**attempt))
        actual = sha256_file(part)
        if actual == expected:
            os.replace(part, dest)
            log(f"verified {dest.name} (sha256 {expected})")
            return dest
        part.unlink()
        if restarted:
            raise BootstrapError(
                f"SHA-256 mismatch for {url}: expected {expected}, got {actual}; the file was deleted"
            )
        log(f"{dest.name}: SHA-256 mismatch after download ({actual}); deleted, fetching once more from the start")
        restarted = True


# --------------------------------------------------------------------------- archives


def _check_member(name: str) -> None:
    pure = PurePosixPath(name.replace("\\", "/"))
    if pure.is_absolute() or ".." in pure.parts or (pure.parts and ":" in pure.parts[0]):
        raise BootstrapError(f"unsafe path in archive: {name!r}")


def extract_archive(archive: Path, into: Path) -> None:
    """Extract a .zip or .tar.gz into a new directory, refusing absolute paths and '..' components."""
    into.mkdir(parents=True, exist_ok=False)
    name = archive.name.lower()
    if name.endswith(".zip"):
        with zipfile.ZipFile(archive) as bundle:
            members = bundle.infolist()
            for info in members:
                _check_member(info.filename)
            bundle.extractall(into)
            if os.name == "posix":
                for info in members:
                    mode = (info.external_attr >> 16) & 0o777
                    target = into / info.filename
                    if mode and target.exists() and not target.is_symlink():
                        os.chmod(target, mode)
    elif name.endswith((".tar.gz", ".tgz", ".tar")):
        with tarfile.open(archive, "r:*") as bundle:
            for member in bundle.getmembers():
                _check_member(member.name)
            if hasattr(tarfile, "data_filter"):
                bundle.extractall(into, filter="data")
            else:  # Python without PEP 706 filters: members were checked above
                bundle.extractall(into)  # noqa: S202
    else:
        raise BootstrapError(f"unsupported archive type: {archive.name}")


def single_top_dir(directory: Path) -> Path:
    entries = [p for p in directory.iterdir() if p.name not in {"__MACOSX"}]
    if len(entries) != 1 or not entries[0].is_dir():
        raise BootstrapError(f"expected one top-level directory in the archive, found {[p.name for p in entries]}")
    return entries[0]


def remove_tree(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)


def link_or_copy(source: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    if tmp.exists():
        tmp.unlink()
    try:
        os.link(source, tmp)
    except OSError:
        shutil.copyfile(source, tmp)
    os.replace(tmp, dest)
