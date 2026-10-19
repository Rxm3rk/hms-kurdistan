"""The label-printer capture endpoint (BUILD-PROMPT.md §3.7, §12.8; docs/specs/hal/README.md; WP-0.7 S8).

A raw-port (port 9100, "JetDirect") listener that stands in for a wristband or label printer. Each TCP
connection is one print job, as on a raw-port printer: the job ends when the sender closes the connection
or stops sending for ``idle_timeout`` seconds. Each job is stored under the output directory as
``job-NNNNNN.zpl``, ``job-NNNNNN.pdf`` or, for anything else (an ESC/POS job, for example), ``job-NNNNNN.bin``,
with a sidecar ``job-NNNNNN.json`` that records the format, the size, the SHA-256 and the time received.
The sidecar is written last, so a sidecar means a complete job. Nothing is printed, rendered or answered.

Standard library only. It listens on a loopback address only, unless ``--allow-non-loopback`` is given, and
it bounds what a sender can make it hold: the connections at once, the size of one job, and the jobs and
bytes it stores in one run. All data sent to it in this build is synthetic, NOT FOR CLINICAL USE; it is a
simulator, not a store for real labels.

Run: ``python -I tools/simulators/label_printer/capture.py --out <directory> [--host H] [--port P]``.
"""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
import re
import socket
import socketserver
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9100
# The largest content hal.print.document allows (32 MiB of base64 text); a label is far smaller.
DEFAULT_MAX_JOB_BYTES = 32 * 1024 * 1024
DEFAULT_IDLE_TIMEOUT_S = 10.0
# Bounds on what one run holds: connections at once (each may buffer up to max_job_bytes in memory), and
# the jobs and bytes it stores. A job past either store limit is rejected whole, like an oversized one.
DEFAULT_MAX_CONNECTIONS = 8
DEFAULT_MAX_JOBS = 10_000
DEFAULT_MAX_STORED_BYTES = 1024 * 1024 * 1024
_CHUNK = 64 * 1024
# Any name of a job: its data, its sidecar, or a file of an unfinished write (".part", ".tmp").
_JOB_FILE = re.compile(r"^job-(\d{6,})\.")
SUFFIX_BY_FORMAT = {"zpl": ".zpl", "pdf": ".pdf", "unknown": ".bin"}
_PART_SUFFIX = ".part"
_O_BINARY = getattr(os, "O_BINARY", 0)  # Windows only; without it Windows would translate line ends
_CREATE_NEW = os.O_WRONLY | os.O_CREAT | os.O_EXCL | _O_BINARY


def detect_format(data: bytes) -> str:
    """Return ``pdf``, ``zpl`` or ``unknown`` for the bytes of one job.

    PDF: the job starts with ``%PDF-`` (after optional whitespace). ZPL: the job holds a label format, a
    ``^XA`` followed later by ``^XZ`` (commands in either case; ``~`` commands may come first).
    """
    stripped = data.lstrip(b" \t\r\n\x00")
    if stripped.startswith(b"%PDF-"):
        return "pdf"
    upper = data.upper()
    start = upper.find(b"^XA")
    if start >= 0 and upper.find(b"^XZ", start + 3) > start:
        return "zpl"
    return "unknown"


def is_loopback_host(host: str) -> bool:
    """True when every address ``host`` names is a loopback address (127.0.0.0/8 or ::1).

    The empty string and ``0.0.0.0`` mean every interface, so they are not loopback; a name that does not
    resolve is not either.
    """
    if not host:
        return False
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except (OSError, UnicodeError):
        return False
    addresses = {info[4][0] for info in infos}
    try:
        return bool(addresses) and all(ipaddress.ip_address(str(address)).is_loopback for address in addresses)
    except ValueError:
        return False


def _job_numbers(directory: Path) -> list[int]:
    return [int(match.group(1)) for match in map(_JOB_FILE.match, os.listdir(directory)) if match]


def _number_taken(directory: Path, stem: str, own: str) -> bool:
    """Whether a file of job ``stem`` other than ``own`` exists in ``directory``."""
    prefix = stem + "."
    return any(name.startswith(prefix) and name != own for name in os.listdir(directory))


def _fsync_write(descriptor: int, data: bytes) -> None:
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())


@dataclass(frozen=True)
class CapturedJob:
    """One stored job."""

    number: int
    format: str
    path: Path
    metadata_path: Path
    byte_length: int
    sha256: str
    received_at: str


class _JobHandler(socketserver.BaseRequestHandler):
    """Reads one connection to its end and hands the bytes to the server."""

    server: "PrinterCaptureServer"

    def handle(self) -> None:
        connection: socket.socket = self.request
        connection.settimeout(self.server.idle_timeout)
        received = bytearray()
        while True:
            try:
                chunk = connection.recv(_CHUNK)
            except socket.timeout:
                break  # the sender went quiet: the job ends here, as on a raw-port printer
            except OSError:
                break
            if not chunk:
                break
            received.extend(chunk)
            if len(received) > self.server.max_job_bytes:
                self.server.reject()
                return
        if received:
            self.server.store(bytes(received))


class PrinterCaptureServer(socketserver.ThreadingTCPServer):
    """A raw-port listener that stores every job it receives in ``out_dir``.

    One output directory is meant for one server. Two servers on one directory still never overwrite each
    other's jobs: a job's number is reserved by creating ``job-NNNNNN.part`` exclusively, and a number any
    file of which exists (data, sidecar or the remains of an interrupted write) is never used again.
    """

    daemon_threads = True
    # On Windows SO_REUSEADDR would let a second listener take the same port, so it stays off there.
    allow_reuse_address = os.name != "nt"

    def __init__(
        self,
        out_dir: Path,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        *,
        max_job_bytes: int = DEFAULT_MAX_JOB_BYTES,
        idle_timeout: float = DEFAULT_IDLE_TIMEOUT_S,
        max_connections: int = DEFAULT_MAX_CONNECTIONS,
        max_jobs: int = DEFAULT_MAX_JOBS,
        max_stored_bytes: int = DEFAULT_MAX_STORED_BYTES,
        allow_non_loopback: bool = False,
        on_job: Optional[Callable[[CapturedJob], None]] = None,
    ) -> None:
        limits = (max_job_bytes, idle_timeout, max_connections, max_jobs, max_stored_bytes)
        if any(limit <= 0 for limit in limits):
            raise ValueError("the job size, idle timeout, connection, job and byte limits must be positive")
        if not allow_non_loopback and not is_loopback_host(host):
            raise ValueError(
                f"{host!r} is not a loopback address; the simulator stores jobs with no access control, so it "
                "listens on loopback only unless --allow-non-loopback is given"
            )
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.max_job_bytes = max_job_bytes
        self.idle_timeout = idle_timeout
        self.max_jobs = max_jobs
        self.max_stored_bytes = max_stored_bytes
        self.on_job = on_job
        self.rejected = 0
        self.refused_connections = 0
        self.stored_bytes = 0
        self._connections = threading.BoundedSemaphore(max_connections)
        self._lock = threading.Lock()
        self._jobs: list[CapturedJob] = []
        self._changed = threading.Condition(self._lock)
        # Continue after every job number already in the directory, finished or not.
        self._next_number = 1 + max(_job_numbers(self.out_dir), default=0)
        self._thread: Optional[threading.Thread] = None
        super().__init__((host, port), _JobHandler)

    @property
    def address(self) -> tuple[str, int]:
        host, port = self.server_address[:2]
        return str(host), int(port)

    def process_request(self, request, client_address) -> None:
        """Refuse a connection beyond ``max_connections`` at once: it is closed unread."""
        if not self._connections.acquire(blocking=False):
            with self._lock:
                self.refused_connections += 1
                self._changed.notify_all()
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self._connections.release()
            raise

    def process_request_thread(self, request, client_address) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._connections.release()

    def _reserve(self) -> tuple[int, Path]:
        """Reserve the next free job number by creating its ``.part`` file exclusively."""
        for _attempt in range(10_000):
            number = self._next_number
            self._next_number += 1
            stem = f"job-{number:06d}"
            part = self.out_dir / (stem + _PART_SUFFIX)
            try:
                descriptor = os.open(part, _CREATE_NEW, 0o600)
            except FileExistsError:
                continue
            if _number_taken(self.out_dir, stem, part.name):
                # Another server, or an interrupted run, already used this number.
                os.close(descriptor)
                os.unlink(part)
                continue
            os.close(descriptor)
            return number, part
        raise OSError("no free job number in the output directory")

    def store(self, data: bytes) -> Optional[CapturedJob]:
        """Store one job and its sidecar; return what was stored, or None when a store limit rejected it."""
        job_format = detect_format(data)
        digest = hashlib.sha256(data).hexdigest()
        received_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        with self._lock:
            if len(self._jobs) >= self.max_jobs or self.stored_bytes + len(data) > self.max_stored_bytes:
                self.rejected += 1
                self._changed.notify_all()
                return None
            number, part = self._reserve()
            stem = f"job-{number:06d}"
            path = self.out_dir / (stem + SUFFIX_BY_FORMAT[job_format])
            metadata_path = self.out_dir / (stem + ".json")
            metadata_tmp = self.out_dir / (stem + ".json.tmp")
            try:
                _fsync_write(os.open(part, os.O_WRONLY | os.O_TRUNC | _O_BINARY), data)
                # The number is ours: at every moment some file of it exists, so the rename cannot overwrite.
                os.replace(part, path)
                metadata = {
                    "job": number,
                    "file": path.name,
                    "format": job_format,
                    "byteLength": len(data),
                    "sha256": digest,
                    "receivedAt": received_at,
                    "provenance": "simulator",
                }
                _fsync_write(
                    os.open(metadata_tmp, _CREATE_NEW, 0o600),
                    (json.dumps(metadata, indent=2) + "\n").encode("utf-8"),
                )
                os.replace(metadata_tmp, metadata_path)
            except BaseException:
                # The number stays used (a file of it may remain); a later job takes the next one.
                for leftover in (part, metadata_tmp):
                    try:
                        os.unlink(leftover)
                    except OSError:
                        pass
                raise
            job = CapturedJob(number, job_format, path, metadata_path, len(data), digest, received_at)
            self.stored_bytes += len(data)
            self._jobs.append(job)
            self._changed.notify_all()
        if self.on_job is not None:
            self.on_job(job)
        return job

    def reject(self) -> None:
        """Count a job that is not stored (too large); nothing of it is kept."""
        with self._lock:
            self.rejected += 1
            self._changed.notify_all()

    def jobs(self) -> list[CapturedJob]:
        """The jobs this server stored, in the order received."""
        with self._lock:
            return list(self._jobs)

    def wait_for(self, jobs: int = 0, rejected: int = 0, refused: int = 0, timeout: float = 5.0) -> bool:
        """Wait until at least ``jobs`` are stored, ``rejected`` rejected and ``refused`` connections refused."""
        deadline = time.monotonic() + timeout
        with self._changed:
            while len(self._jobs) < jobs or self.rejected < rejected or self.refused_connections < refused:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False
                self._changed.wait(remaining)
            return True

    def start(self) -> "PrinterCaptureServer":
        """Serve in a background thread."""
        self._thread = threading.Thread(
            target=self.serve_forever, kwargs={"poll_interval": 0.05}, name="label-printer-capture", daemon=True
        )
        self._thread.start()
        return self

    def stop(self) -> None:
        """Stop serving and close the listening socket."""
        if self._thread is not None:
            self.shutdown()
            self._thread.join(timeout=5)
            self._thread = None
        self.server_close()

    def __enter__(self) -> "PrinterCaptureServer":
        return self.start()

    def __exit__(self, *_exc: object) -> None:
        self.stop()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="label-printer-capture",
        description="Raw port-9100 label-printer simulator: stores each job's ZPL or PDF (synthetic data only).",
    )
    parser.add_argument("--out", required=True, type=Path, help="directory for the captured jobs")
    parser.add_argument("--host", default=DEFAULT_HOST,
                        help=f"loopback address to listen on (default {DEFAULT_HOST})")
    parser.add_argument("--allow-non-loopback", action="store_true",
                        help="allow a --host that is not a loopback address (closed test networks only)")
    parser.add_argument("--port", default=DEFAULT_PORT, type=int, help=f"TCP port (default {DEFAULT_PORT})")
    parser.add_argument("--idle-timeout", default=DEFAULT_IDLE_TIMEOUT_S, type=float,
                        help=f"seconds of silence that end a job (default {DEFAULT_IDLE_TIMEOUT_S:g})")
    parser.add_argument("--max-job-bytes", default=DEFAULT_MAX_JOB_BYTES, type=int,
                        help=f"larger jobs are rejected and not stored (default {DEFAULT_MAX_JOB_BYTES})")
    parser.add_argument("--max-connections", default=DEFAULT_MAX_CONNECTIONS, type=int,
                        help=f"connections at once; more are closed unread (default {DEFAULT_MAX_CONNECTIONS})")
    parser.add_argument("--max-jobs", default=DEFAULT_MAX_JOBS, type=int,
                        help=f"jobs stored in one run; later ones are rejected (default {DEFAULT_MAX_JOBS})")
    parser.add_argument("--max-stored-bytes", default=DEFAULT_MAX_STORED_BYTES, type=int,
                        help=f"bytes stored in one run; later jobs are rejected (default {DEFAULT_MAX_STORED_BYTES})")
    return parser.parse_args(argv)


def _print_job(job: CapturedJob) -> None:
    print(f"job {job.number}: {job.format}, {job.byte_length} bytes -> {job.path.name}", flush=True)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if args.allow_non_loopback and not is_loopback_host(args.host):
        print(
            f"label-printer-capture: WARNING: listening on {args.host}, not a loopback address; anyone who can "
            "reach it can store jobs (closed test networks only)",
            file=sys.stderr,
            flush=True,
        )
    try:
        server = PrinterCaptureServer(
            args.out,
            args.host,
            args.port,
            max_job_bytes=args.max_job_bytes,
            idle_timeout=args.idle_timeout,
            max_connections=args.max_connections,
            max_jobs=args.max_jobs,
            max_stored_bytes=args.max_stored_bytes,
            allow_non_loopback=args.allow_non_loopback,
            on_job=_print_job,
        )
    except (OSError, ValueError) as error:
        print(f"label-printer-capture: cannot listen on {args.host}:{args.port}: {error}", file=sys.stderr)
        return 2
    host, port = server.address
    print(f"label-printer-capture: listening on {host}:{port}, storing jobs in {server.out_dir}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
