"""test_printer_capture (docs/specs/modules/design-system.md §9; WP-0.7 S8): the label-printer simulator
stores the ZPL or PDF it receives on its raw port. The tests listen on an ephemeral loopback port instead
of 9100, so they never clash with a running simulator; all data is synthetic.
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import socket
import tempfile
import time
import unittest
from pathlib import Path

from simulators.label_printer import capture
from simulators.label_printer.capture import PrinterCaptureServer, detect_format

REPO_ROOT = Path(__file__).resolve().parents[4]
LABEL_FIXTURE = REPO_ROOT / "docs" / "specs" / "hal" / "fixtures" / "hal.print.label.ok.json"

# A minimal synthetic PDF: enough to be recognised, not a real document.
SYNTHETIC_PDF = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"
# ESC/POS initialise, synthetic text, line feed: a raw job that is neither ZPL nor PDF.
SYNTHETIC_ESC_POS = b"\x1b@SYN-RECEIPT-0001\n"


def fixture_zpl() -> bytes:
    """The ZPL of the HAL contract's hal.print.label.ok fixture, as a shell would send it to the printer."""
    fixture = json.loads(LABEL_FIXTURE.read_text(encoding="utf-8"))
    request = fixture["request"]
    assert request["format"] == "zpl" and request["contentEncoding"] == "utf-8"
    return request["content"].encode("utf-8")


def send(address: tuple[str, int], *parts: bytes, pause: float = 0.0) -> None:
    """Send one job over one connection, in parts, and close it."""
    with socket.create_connection(address, timeout=5) as connection:
        for part in parts:
            connection.sendall(part)
            if pause:
                time.sleep(pause)


class PrinterCaptureTest(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.out = Path(self._directory.name) / "captured"
        self.server = self.start_server()

    def tearDown(self) -> None:
        self.server.stop()
        self._directory.cleanup()

    def start_server(self, **options) -> PrinterCaptureServer:
        return PrinterCaptureServer(self.out, "127.0.0.1", 0, **options).start()

    def assert_stored(self, job: capture.CapturedJob, data: bytes, job_format: str, suffix: str) -> None:
        self.assertEqual(job.format, job_format)
        self.assertEqual(job.path.suffix, suffix)
        self.assertEqual(job.path.read_bytes(), data)
        metadata = json.loads(job.metadata_path.read_text(encoding="utf-8"))
        self.assertEqual(metadata["format"], job_format)
        self.assertEqual(metadata["file"], job.path.name)
        self.assertEqual(metadata["byteLength"], len(data))
        self.assertEqual(metadata["sha256"], hashlib.sha256(data).hexdigest())
        self.assertRegex(metadata["receivedAt"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")

    def test_stores_the_zpl_of_the_contract_label_fixture(self) -> None:
        zpl = fixture_zpl()
        send(self.server.address, zpl)
        self.assertTrue(self.server.wait_for(jobs=1))
        [job] = self.server.jobs()
        self.assert_stored(job, zpl, "zpl", ".zpl")
        self.assertEqual(job.path.name, "job-000001.zpl")

    def test_stores_a_pdf_sent_in_several_parts(self) -> None:
        send(self.server.address, SYNTHETIC_PDF[:10], SYNTHETIC_PDF[10:], pause=0.05)
        self.assertTrue(self.server.wait_for(jobs=1))
        [job] = self.server.jobs()
        self.assert_stored(job, SYNTHETIC_PDF, "pdf", ".pdf")

    def test_stores_other_raw_jobs_as_unknown(self) -> None:
        send(self.server.address, SYNTHETIC_ESC_POS)
        self.assertTrue(self.server.wait_for(jobs=1))
        [job] = self.server.jobs()
        self.assert_stored(job, SYNTHETIC_ESC_POS, "unknown", ".bin")

    def test_one_job_per_connection_numbered_in_order_and_across_restarts(self) -> None:
        zpl = fixture_zpl()
        send(self.server.address, zpl)
        self.assertTrue(self.server.wait_for(jobs=1))
        send(self.server.address, SYNTHETIC_PDF)
        self.assertTrue(self.server.wait_for(jobs=2))
        self.assertEqual([job.number for job in self.server.jobs()], [1, 2])
        self.server.stop()
        # A restarted simulator continues the numbering and never overwrites a stored job.
        self.server = self.start_server()
        send(self.server.address, zpl)
        self.assertTrue(self.server.wait_for(jobs=1))
        [job] = self.server.jobs()
        self.assertEqual(job.number, 3)
        self.assertEqual(sorted(path.name for path in self.out.iterdir()), [
            "job-000001.json", "job-000001.zpl", "job-000002.json", "job-000002.pdf",
            "job-000003.json", "job-000003.zpl",
        ])

    def test_a_quiet_sender_ends_the_job(self) -> None:
        self.server.stop()
        self.server = self.start_server(idle_timeout=0.2)
        zpl = fixture_zpl()
        with socket.create_connection(self.server.address, timeout=5) as connection:
            connection.sendall(zpl)
            # The connection stays open; after the idle timeout the job is stored anyway.
            self.assertTrue(self.server.wait_for(jobs=1, timeout=5))
        [job] = self.server.jobs()
        self.assert_stored(job, zpl, "zpl", ".zpl")

    def test_stores_nothing_for_an_empty_connection_or_an_oversized_job(self) -> None:
        self.server.stop()
        self.server = self.start_server(max_job_bytes=64)
        send(self.server.address)
        send(self.server.address, b"^XA" + b"^FDSYN" * 40 + b"^XZ")
        self.assertTrue(self.server.wait_for(rejected=1))
        time.sleep(0.1)
        self.assertEqual(self.server.jobs(), [])
        self.assertEqual(self.server.rejected, 1)
        self.assertEqual(list(self.out.iterdir()), [])

    def test_listens_on_loopback_by_default_on_port_9100(self) -> None:
        # A server built with the default host (on an ephemeral port, not to clash with a running simulator).
        default = PrinterCaptureServer(self.out, port=0)
        try:
            self.assertEqual(default.address[0], "127.0.0.1")
        finally:
            default.server_close()
        args = capture.parse_args(["--out", str(self.out)])
        self.assertEqual((args.host, args.port, args.allow_non_loopback), ("127.0.0.1", 9100, False))
        self.assertEqual(capture.DEFAULT_PORT, 9100)

    def test_refuses_a_host_that_is_not_loopback(self) -> None:
        for host in ("0.0.0.0", "", "192.0.2.1"):
            with self.subTest(host=host):
                self.assertFalse(capture.is_loopback_host(host))
                with self.assertRaises(ValueError):
                    PrinterCaptureServer(self.out, host, 0)
                errors = io.StringIO()
                with contextlib.redirect_stderr(errors):
                    code = capture.main(["--out", str(self.out), "--host", host, "--port", "0"])
                self.assertEqual(code, 2)
                self.assertIn("not a loopback address", errors.getvalue())
        for host in ("127.0.0.1", "127.0.0.2", "::1", "localhost"):
            with self.subTest(host=host):
                self.assertTrue(capture.is_loopback_host(host))

    def test_never_reuses_the_number_of_a_file_left_in_the_directory(self) -> None:
        self.server.stop()
        # An interrupted earlier run left a job without its sidecar and files of unfinished writes.
        for name in ("job-000004.zpl", "job-000005.json.tmp", "job-000006.part"):
            (self.out / name).write_bytes(b"SYN")
        self.server = self.start_server()
        send(self.server.address, SYNTHETIC_PDF)
        self.assertTrue(self.server.wait_for(jobs=1))
        [job] = self.server.jobs()
        self.assertEqual(job.number, 7)
        self.assertEqual((self.out / "job-000004.zpl").read_bytes(), b"SYN")

    def test_two_servers_on_one_directory_never_overwrite_each_other(self) -> None:
        second = self.start_server()
        try:
            zpl = fixture_zpl()
            for round_number in range(3):
                send(self.server.address, zpl)
                self.assertTrue(self.server.wait_for(jobs=round_number + 1))
                send(second.address, SYNTHETIC_PDF)
                self.assertTrue(second.wait_for(jobs=round_number + 1))
            jobs = self.server.jobs() + second.jobs()
            numbers = [job.number for job in jobs]
            self.assertEqual(len(set(numbers)), 6)
            for job in jobs:
                self.assertEqual(job.path.read_bytes(), zpl if job.format == "zpl" else SYNTHETIC_PDF)
                self.assertEqual(json.loads(job.metadata_path.read_text(encoding="utf-8"))["file"], job.path.name)
            self.assertEqual(len([path for path in self.out.iterdir() if path.suffix == ".json"]), 6)
            self.assertEqual([path.name for path in self.out.iterdir() if path.suffix in (".part", ".tmp")], [])
        finally:
            second.stop()

    def test_closes_connections_beyond_the_limit_unread(self) -> None:
        self.server.stop()
        self.server = self.start_server(max_connections=1, idle_timeout=5)
        zpl = fixture_zpl()
        with socket.create_connection(self.server.address, timeout=5) as first:
            first.sendall(zpl[:10])
            time.sleep(0.2)  # the first connection is being served
            with socket.create_connection(self.server.address, timeout=5) as second:
                self.assertTrue(self.server.wait_for(refused=1))
                with contextlib.suppress(OSError):
                    second.sendall(SYNTHETIC_PDF)
            first.sendall(zpl[10:])
        self.assertTrue(self.server.wait_for(jobs=1))
        [job] = self.server.jobs()
        self.assert_stored(job, zpl, "zpl", ".zpl")
        self.assertEqual(self.server.refused_connections, 1)

    def test_rejects_jobs_beyond_the_store_limits(self) -> None:
        self.server.stop()
        self.server = self.start_server(max_jobs=1)
        send(self.server.address, SYNTHETIC_PDF)
        self.assertTrue(self.server.wait_for(jobs=1))
        send(self.server.address, SYNTHETIC_PDF)
        self.assertTrue(self.server.wait_for(rejected=1))
        self.assertEqual(len(self.server.jobs()), 1)
        self.server.stop()
        self.server = self.start_server(max_stored_bytes=len(SYNTHETIC_PDF) + 1)
        send(self.server.address, SYNTHETIC_PDF)
        self.assertTrue(self.server.wait_for(jobs=1))
        send(self.server.address, SYNTHETIC_ESC_POS)
        self.assertTrue(self.server.wait_for(rejected=1))
        self.assertEqual([job.format for job in self.server.jobs()], ["pdf"])
        self.assertEqual(sorted(path.suffix for path in self.out.iterdir()), [".json", ".json", ".pdf", ".pdf"])

    def test_the_command_line_fails_with_exit_2_when_the_port_is_taken(self) -> None:
        errors = io.StringIO()
        with contextlib.redirect_stderr(errors):
            code = capture.main(["--out", str(self.out), "--port", str(self.server.address[1])])
        self.assertEqual(code, 2)
        self.assertIn("cannot listen", errors.getvalue())


class DetectFormatTest(unittest.TestCase):
    def test_formats(self) -> None:
        self.assertEqual(detect_format(fixture_zpl()), "zpl")
        self.assertEqual(detect_format(b"~JA\r\n^xa^FDSYN^FS^xz"), "zpl")
        self.assertEqual(detect_format(b"\r\n%PDF-1.4\n%%EOF"), "pdf")
        self.assertEqual(detect_format(SYNTHETIC_ESC_POS), "unknown")
        self.assertEqual(detect_format(b"^XA^FDSYN-NOT-ENDED"), "unknown")
        self.assertEqual(detect_format(b"^XZ^XA"), "unknown")


if __name__ == "__main__":
    unittest.main()
