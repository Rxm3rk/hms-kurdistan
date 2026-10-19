"""The S7-K kit (tools/s7k/s7k.py): host refusal, dry run, sending, patterns, font download and the form.

No test talks to a printer or leaves the machine: sends go to a listener on 127.0.0.1, or to a mocked
socket, and name resolution is mocked.
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import math
import re
import socket
import tempfile
import threading
import unicodedata
import unittest
from pathlib import Path
from unittest import mock

from s7k import s7k as kit

KIT_DIR = Path(kit.__file__).resolve().parent
REPO = KIT_DIR.parents[1]
FONT_DIR = REPO / kit.FONT_DIR_IN_REPO
EXAMPLE_FORM = KIT_DIR / "examples" / "result-form.example.yaml"


def run(argv: list[str]) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            code = kit.main(argv)
        except SystemExit as exc:  # argparse refuses an argument
            code = exc.code
    return code, out.getvalue(), err.getvalue()


def fake_getaddrinfo(*addresses: str):
    def resolver(host, port, *args, **kwargs):
        infos = []
        for address in addresses:
            family = socket.AF_INET6 if ":" in address else socket.AF_INET
            sockaddr = (address, port, 0, 0) if family == socket.AF_INET6 else (address, port)
            infos.append((family, socket.SOCK_STREAM, 6, "", sockaddr))
        return infos

    return resolver


class CaptureServer:
    """A listener on 127.0.0.1 that stores each connection's bytes; optionally answers each job."""

    def __init__(self, jobs: int, reply: bytes = b"") -> None:
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(jobs)
        self.sock.settimeout(10)
        self.port = self.sock.getsockname()[1]
        self.reply = reply
        self.received: list[bytes] = []
        self.thread = threading.Thread(target=self._serve, args=(jobs,), daemon=True)
        self.thread.start()

    def _serve(self, jobs: int) -> None:
        for _ in range(jobs):
            connection, _addr = self.sock.accept()
            with connection:
                connection.settimeout(10)
                data = bytearray()
                if self.reply:
                    data.extend(connection.recv(65536))
                    connection.sendall(self.reply)
                else:
                    while chunk := connection.recv(65536):
                        data.extend(chunk)
                self.received.append(bytes(data))
        self.sock.close()

    def join(self) -> None:
        self.thread.join(10)


def job_file(tmp: str, data: bytes = b"^XA^XZ\n", name: str = "job.zpl") -> str:
    path = Path(tmp) / name
    path.write_bytes(data)
    return str(path)


class HostPolicyTest(unittest.TestCase):
    def test_local_addresses_are_allowed(self) -> None:
        for address in ("127.0.0.1", "127.8.9.10", "10.1.2.3", "172.16.0.1", "172.31.255.254", "192.168.1.50",
                        "::1", "fd12:3456::1", "fc00::1", "fd00::1%eth0", "::ffff:10.0.0.5", "::ffff:127.0.0.1"):
            self.assertTrue(kit.address_is_local(address), address)

    def test_public_special_and_link_local_addresses_are_refused(self) -> None:
        # Link-local is refused: the spec allows loopback or private only (platform-docs.md §11).
        for address in ("8.8.8.8", "1.1.1.1", "172.32.0.1", "172.15.255.255", "100.64.0.1", "192.0.2.1",
                        "0.0.0.0", "255.255.255.255", "224.0.0.1", "169.254.10.20", "fe80::1", "fe80::1%eth0",
                        "::ffff:169.254.1.1", "2001:4860:4860::8888", "::ffff:8.8.8.8", "64:ff9b::a00:5", "::",
                        "ff02::1", "not-an-address", ""):
            self.assertFalse(kit.address_is_local(address), address)

    def test_s7k_sender_refuses_public_addresses(self) -> None:
        """UnitTest:s7k-sender-refuses-public-addresses: a public literal is refused before any lookup, a name
        that resolves to any public address is refused, and send never opens a socket for either."""
        with mock.patch("socket.getaddrinfo") as resolver:
            for literal in ("8.8.8.8", "::ffff:8.8.8.8", "2001:db8::1", "169.254.1.1", "fe80::1%eth0"):
                with self.assertRaises(kit.HostRefused, msg=literal):
                    kit.resolve_local(literal, 9100)
            resolver.assert_not_called()
        with mock.patch("socket.getaddrinfo", fake_getaddrinfo("93.184.216.34")):
            with self.assertRaises(kit.HostRefused) as caught:
                kit.resolve_local("printer.example", 9100)
        self.assertIn("93.184.216.34", str(caught.exception))
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch("socket.getaddrinfo", fake_getaddrinfo("203.0.113.9")), \
                    mock.patch("socket.socket") as sock:
                code, _out, err = run(["send", "--host", "labels.example", job_file(tmp)])
            sock.assert_not_called()
        self.assertEqual(code, 2)
        self.assertIn("never leaves the site", err)

    def test_name_resolving_to_private_and_public_refused(self) -> None:
        with mock.patch("socket.getaddrinfo", fake_getaddrinfo("192.168.1.20", "2001:db8::20")):
            with self.assertRaises(kit.HostRefused):
                kit.resolve_local("zebra-ward-3", 9100)
        with mock.patch("socket.getaddrinfo", fake_getaddrinfo("192.168.1.20", "169.254.3.4")):
            with self.assertRaises(kit.HostRefused):
                kit.resolve_local("zebra-ward-3", 9100)

    def test_name_resolving_only_to_private_allowed(self) -> None:
        with mock.patch("socket.getaddrinfo", fake_getaddrinfo("192.168.1.20", "fd00::20")):
            addresses = kit.resolve_local("zebra-ward-3", 9100)
        self.assertEqual([a[1][0] for a in addresses], ["192.168.1.20", "fd00::20"])

    def test_scoped_and_ipv4_mapped_literals_through_resolve_local(self) -> None:
        with mock.patch("socket.getaddrinfo", fake_getaddrinfo("fd00::1%eth0")) as _r:
            addresses = kit.resolve_local("fd00::1%eth0", 9100)
        self.assertEqual(addresses[0][1][0], "fd00::1%eth0")
        with mock.patch("socket.getaddrinfo", fake_getaddrinfo("::ffff:10.0.0.5")):
            self.assertEqual(kit.resolve_local("::ffff:10.0.0.5", 9100)[0][1][0], "::ffff:10.0.0.5")
        with mock.patch("socket.getaddrinfo") as resolver:
            for literal in ("::ffff:8.8.8.8", "::ffff:169.254.0.1", "fe80::1%eth0", "fe80::1%1"):
                with self.assertRaises(kit.HostRefused, msg=literal):
                    kit.resolve_local(literal, 9100)
            resolver.assert_not_called()

    def test_unresolvable_and_empty_refused(self) -> None:
        with mock.patch("socket.getaddrinfo", side_effect=socket.gaierror("no such name")):
            with self.assertRaises(kit.HostRefused):
                kit.resolve_local("nowhere.invalid", 9100)
        with mock.patch("socket.getaddrinfo", return_value=[]):
            with self.assertRaises(kit.HostRefused):
                kit.resolve_local("empty.invalid", 9100)
        for host in ("", " 10.0.0.1"):
            with self.assertRaises(kit.HostRefused):
                kit.resolve_local(host, 9100)

    def test_resolves_once_and_connects_to_the_checked_address(self) -> None:
        """The name is resolved exactly once; the socket connects to the checked sockaddr, never to the name."""
        resolver = mock.Mock(side_effect=fake_getaddrinfo("192.168.7.9"))
        with tempfile.TemporaryDirectory() as tmp, mock.patch("socket.getaddrinfo", resolver), \
                mock.patch("socket.socket") as socket_class:
            instance = socket_class.return_value
            instance.recv.return_value = b""
            code, out, err = run(["send", "--host", "zebra-ward-3", job_file(tmp), job_file(tmp, name="b.zpl")])
        self.assertEqual(code, 0, err)
        self.assertEqual(resolver.call_count, 1)
        self.assertEqual(instance.connect.call_args_list, [mock.call(("192.168.7.9", 9100))] * 2)
        self.assertEqual(out.count("sent "), 2)


class SendTest(unittest.TestCase):
    def test_dry_run_sends_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            job = job_file(tmp, b"^XA^FDx^FS^XZ\n")
            with mock.patch("socket.socket") as sock:
                code, out, _err = run(["send", "--host", "127.0.0.1", "--dry-run", job])
            sock.assert_not_called()
        self.assertEqual(code, 0)
        self.assertIn("dry run: would send", out)
        self.assertIn(hashlib.sha256(b"^XA^FDx^FS^XZ\n").hexdigest(), out)
        self.assertIn("14 bytes", out)

    def test_timeout_grows_with_the_file(self) -> None:
        self.assertEqual(kit.job_timeout(10.0, 0), 10.0)
        self.assertEqual(kit.job_timeout(10.0, 400_000), 30.0)
        with tempfile.TemporaryDirectory() as tmp:
            code, out, _err = run(["send", "--host", "127.0.0.1", "--dry-run", "--timeout", "5",
                                   job_file(tmp, b"x" * 100_000, "font.dy")])
        self.assertEqual(code, 0)
        self.assertIn("timeout 10.0 s", out)

    def test_failed_font_send_says_power_cycle(self) -> None:
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
        probe.close()
        with tempfile.TemporaryDirectory() as tmp:
            code, _out, err = run(["send", "--host", "127.0.0.1", "--port", str(port), "--timeout", "2",
                                   job_file(tmp, b"~DYE:NSARAB,B,T,4,,\x00\x01\x00\x00", "nsarab.dy")])
            self.assertEqual(code, 1)
            self.assertIn("power-cycle the printer and download the font again", err)
            code, _out, err = run(["send", "--host", "127.0.0.1", "--port", str(port), "--timeout", "2",
                                   job_file(tmp)])
            self.assertNotIn("power-cycle", err)

    def test_dry_run_still_refuses_public_host(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            code, _out, _err = run(["send", "--host", "8.8.4.4", "--dry-run", job_file(tmp)])
        self.assertEqual(code, 2)

    def test_each_file_arrives_exactly_as_one_job(self) -> None:
        payloads = [b"\x1b@binary\x00\xff^XA\n", "^XA^FDپ^FS^XZ\n".encode("utf-8")]
        server = CaptureServer(jobs=2)
        with tempfile.TemporaryDirectory() as tmp:
            files = [job_file(tmp, data, f"job{index}.bin") for index, data in enumerate(payloads)]
            code, out, err = run(["send", "--host", "127.0.0.1", "--port", str(server.port), *files])
        server.join()
        self.assertEqual(code, 0, err)
        self.assertEqual(server.received, payloads)
        self.assertEqual(out.count("sent "), 2)

    def test_read_reply_prints_and_saves_the_reply(self) -> None:
        reply = b"\x02SYN-EXAMPLE,V0.0,8,8192KB\x03\r\n"
        server = CaptureServer(jobs=1, reply=reply)
        with tempfile.TemporaryDirectory() as tmp:
            saved = Path(tmp) / "reply.bin"
            code, out, err = run(["send", "--host", "127.0.0.1", "--port", str(server.port), "--read-reply", "2",
                                  "--reply-out", str(saved), job_file(tmp, b"~HI\n", "hi.zpl")])
            self.assertEqual(saved.read_bytes(), reply)
        server.join()
        self.assertEqual(code, 0, err)
        self.assertEqual(server.received, [b"~HI\n"])
        self.assertIn("<02>SYN-EXAMPLE,V0.0,8,8192KB<03>", out)

    def test_connection_refused_exits_1(self) -> None:
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
        probe.close()  # nothing listens on this port now
        with tempfile.TemporaryDirectory() as tmp:
            code, _out, err = run(["send", "--host", "127.0.0.1", "--port", str(port), "--timeout", "2",
                                   job_file(tmp)])
        self.assertEqual(code, 1)
        self.assertIn("could not connect", err)

    def test_timeouts_must_be_finite_and_positive(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            job = job_file(tmp)
            for option, value in (("--timeout", "0"), ("--timeout", "-1"), ("--timeout", "nan"),
                                  ("--timeout", "inf"), ("--timeout", "x"), ("--read-reply", "0"),
                                  ("--read-reply", "-2"), ("--read-reply", "inf"), ("--pause", "-1"),
                                  ("--pause", "nan")):
                with mock.patch("socket.socket") as sock:
                    code, _out, err = run(["send", "--host", "127.0.0.1", option, value, job])
                sock.assert_not_called()
                self.assertEqual(code, 2, f"{option} {value}")
                self.assertIn(option, err)

    def test_unreadable_file_is_a_kit_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            for name in (str(Path(tmp) / "missing.zpl"), tmp):  # a missing file and a directory
                with mock.patch("socket.socket") as sock:
                    code, _out, err = run(["send", "--host", "127.0.0.1", name])
                sock.assert_not_called()
                self.assertEqual(code, 2, name)
                self.assertIn("cannot read it", err)

    def test_reply_read_failure_after_sending(self) -> None:
        server = CaptureServer(jobs=1)
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch.object(kit, "_read_for", side_effect=[ConnectionResetError("reset by peer"), b""]):
            code, out, err = run(["send", "--host", "127.0.0.1", "--port", str(server.port), "--read-reply", "1",
                                  job_file(tmp, b"~HI\n")])
        server.join()
        self.assertEqual(code, 1)
        self.assertIn("sent ", out)
        self.assertIn("sent; reply read failed: reset by peer", err)
        self.assertEqual(server.received, [b"~HI\n"])

    def test_close_is_graceful(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch("socket.socket") as socket_class:
            instance = socket_class.return_value
            instance.recv.return_value = b""
            code, _out, err = run(["send", "--host", "127.0.0.1", job_file(tmp)])
        self.assertEqual(code, 0, err)
        names = [c[0] for c in instance.method_calls]
        self.assertIn("sendall", names)
        self.assertLess(names.index("sendall"), names.index("shutdown"))
        self.assertLess(names.index("shutdown"), names.index("close"))
        instance.shutdown.assert_called_once_with(socket.SHUT_WR)


FIELD = re.compile(r"\^FD(.*?)\^FS", re.S)
FIELD_COMMAND = re.compile(r"\^F[OT]\d+,\d+(.*?)\^FS", re.S)
ENGINE_LINE = re.compile(r"\^FT\d+,\d+\^A@([NR]),(\d+),\2,E:[A-Z]+\.TTF\^FB\d+,1,0,[LRC],0\^FH\\\^FD[^^]*\^FS")


def generate(dpi: int, **options) -> dict[str, bytes]:
    with tempfile.TemporaryDirectory() as tmp:
        kit.write_patterns(kit.Options(dpi=dpi, **options), Path(tmp))
        return {p.name: p.read_bytes() for p in Path(tmp).iterdir()}


class PatternsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.files = {dpi: generate(dpi) for dpi in (203, 300, 600)}

    def zpl(self, dpi: int, pid: str) -> str:
        name = next(n for n in self.files[dpi] if n.startswith(f"s7k-{pid.lower()}-"))
        return self.files[dpi][name].decode("utf-8")

    def all_zpl(self):
        for dpi in (203, 300, 600):
            for name, data in self.files[dpi].items():
                if name.endswith(".zpl") and "-cfg-" not in name:
                    yield dpi, name, data.decode("utf-8")

    def test_generation_is_deterministic(self) -> None:
        self.assertEqual(generate(203), self.files[203])

    def test_committed_patterns_match_the_generator(self) -> None:
        for dpi in (203, 300, 600):
            committed_dir = KIT_DIR / "patterns" / str(dpi)
            committed = {p.name: p.read_bytes() for p in committed_dir.iterdir()}
            self.assertEqual(sorted(committed), sorted(self.files[dpi]), dpi)
            for name, data in self.files[dpi].items():
                self.assertEqual(committed[name], data, f"{committed_dir / name} is stale; run s7k.py patterns")

    def test_no_timestamps_in_generated_bytes(self) -> None:
        for dpi, files in self.files.items():
            for name, data in files.items():
                self.assertIsNone(re.search(rb"20\d\d-\d\d-\d\dT\d\d", data), name)
            manifest = json.loads(files["MANIFEST.json"])
            self.assertFalse({"generated", "generated_at", "timestamp", "created"} & set(manifest))

    def test_text_patterns_set_utf8_and_shaping(self) -> None:
        for dpi in (203, 300, 600):
            for pid in ("ZT01", "ZT02", "ZT03", "ZT04", "ZT05", "BC01"):
                text = self.zpl(dpi, pid)
                labels = text.count("^XA")
                self.assertGreater(labels, 0)
                self.assertEqual(text.count("^CI28"), labels, pid)
                self.assertEqual(text.count("^PA1,1,1,1"), labels, pid)
                self.assertEqual(text.count("^XZ"), labels, pid)
                self.assertIn(kit.NOTICE, text)
                self.assertIn(f"kit {kit.KIT_VERSION}", text)
                self.assertIn(f"^PW{kit.Options(dpi=dpi).dots(kit.DEFAULT_WIDTH_MM)}", text)

    def test_every_field_opens_and_closes(self) -> None:
        """Every ^FO or ^FT field ends with ^FS before the next field starts or the format ends."""
        for _dpi, name, text in self.all_zpl():
            for fmt in re.findall(r"\^XA(.*?)\^XZ", text, re.S):
                body = re.sub(r"\^FX[^^]*", "", fmt)  # a comment runs to the next caret
                opened = False
                for command in re.findall(r"\^(?:FO|FT|FS)", body):
                    if command == "^FS":
                        self.assertTrue(opened, f"{name}: ^FS without a field")
                        opened = False
                    else:
                        self.assertFalse(opened, f"{name}: {command} inside an open field")
                        opened = True
                self.assertFalse(opened, f"{name}: a field is still open at ^XZ")
                self.assertEqual(len(FIELD.findall(body)), body.count("^FD"), name)

    def test_arabic_fields_use_the_downloaded_font(self) -> None:
        text = self.zpl(203, "ZT01")
        self.assertIn("^A@N,34,34,E:NSARAB.TTF", text)

    def test_font_names_are_the_engine_fonts(self) -> None:
        names = {entry[0] for entry in kit.PRINT_FONTS}
        self.assertEqual(names, {"E:NSARAB.TTF", "E:NSARABB.TTF", "E:NSLATN.TTF", "E:NSLATNB.TTF"})
        used = set()
        for _dpi, _name, text in self.all_zpl():
            used |= set(re.findall(r"\^A@[NR],\d+,\d+,(E:[A-Z]+\.TTF)", text))
        self.assertEqual(used, names)

    def test_every_field_is_hex_escaped(self) -> None:
        for _dpi, name, text in self.all_zpl():
            for match in FIELD.finditer(text):
                self.assertTrue(text[: match.start()].endswith("^FH\\"), f"{name}: ^FD without ^FH\\")
                content = match.group(1)
                self.assertNotIn("^", content, name)
                self.assertNotIn("~", content, name)
                self.assertIsNone(re.search(r"\\(?![0-9A-F]{2})", content), f"{name}: bare backslash")

    def test_no_backslash_reaches_a_field_block(self) -> None:
        """B4 tests '^' and '~' inside ^FB fields; a backslash appears only in the B4b field, which has no ^FB."""
        for _dpi, name, text in self.all_zpl():
            for match in FIELD_COMMAND.finditer(text):
                field = match.group(0)
                if "^FB" in field:
                    self.assertNotIn("\\5C", field, f"{name}: a backslash in a ^FB field")
        text = self.zpl(203, "ZT03")
        self.assertIn("^FB445,2,7,L,0^FH\\^FDEscape check: \\5EXZ \\7EJA end^FS", text)
        b4b = next(m.group(0) for m in FIELD_COMMAND.finditer(text) if "Backslash check" in m.group(0)
                   and "^A0N,28,28" in m.group(0))
        self.assertNotIn("^FB", b4b)
        self.assertIn("^FH\\^FDBackslash check: \\5C5E \\5C& end^FS", b4b)
        with self.assertRaises(kit.KitError):
            kit._text_field(kit.Options(dpi=203), 0, 0, 100, "resident", 20, 1, "L", "a\\b")
        with self.assertRaises(kit.KitError):
            kit._engine_line(kit.Options(dpi=203), 0, 0, "N", "latin", 20, 100, "L", "a\\b")

    def test_field_data_escaping_and_refusals(self) -> None:
        self.assertEqual(kit.zpl_field_data("a^b~c\\d"), "a\\5Eb\\7Ec\\5Cd")
        self.assertEqual(kit.zpl_field_data("پ\u200c\u200d"), "پ\u200c\u200d")
        for bad in ("a\nb", "\x00", "\x7f", "\x85", "\ud800"):
            with self.assertRaises(kit.KitError):
                kit.zpl_field_data(bad)

    def test_every_sorani_letter_appears_in_all_positions(self) -> None:
        chart = self.zpl(203, "ZT01")
        for letter in kit.SORANI_ALPHABET:
            for form in kit.joining_forms(letter.char):
                self.assertIn(form, chart, f"U+{ord(letter.char):04X}")
        for char in kit.KURDISH_LETTERS:
            self.assertIn(char, chart)
            self.assertIn(char, kit.SAMPLE_WORDS)
        self.assertEqual(len(kit.KURDISH_LETTERS), 10)

    def test_variant_pairs_and_extras_appear(self) -> None:
        text = self.zpl(203, "ZT02")
        for arabic, kurdish in kit.VARIANT_PAIRS:
            self.assertNotEqual(arabic.char, kurdish.char)
            self.assertIn(kit.BEH + arabic.char + kit.BEH, text)
            self.assertIn(kit.BEH + kurdish.char + kit.BEH, text)
        self.assertIn("isolated and final must differ", text)
        for letter in kit.EXTRA_LETTERS + kit.ARABIC_ONLY_LETTERS:
            self.assertIn(letter.char, text)
        self.assertIn(kit.BEH + kit.ZWNJ + kit.BEH, text)
        self.assertIn("لا", text)

    def test_lam_with_small_v_before_alef(self) -> None:
        text = self.zpl(203, "ZT02")
        self.assertEqual(kit.LAM_V_ALEF_WORDS[:2], ("ڵا", "بڵا"))
        self.assertEqual(kit.LAM_V_ALEF_WORDS[2:], ("ئاڵا", "هەڵاڵە"))
        self.assertIn("  ".join(kit.LAM_V_ALEF_WORDS), text)
        self.assertIn("the v mark stays on the lam", text)
        self.assertIn("v mark stays on the lam", kit.ITEMS_BY_ID["ZT-02"].passes_when)

    def test_zwj_bold_fonts_and_latin_transliteration_letters(self) -> None:
        text = self.zpl(203, "ZT02")
        for form in (kit.BEH + kit.ZWJ, kit.ZWJ + kit.BEH, kit.BEH + kit.ZWJ + kit.BEH):
            self.assertIn(form, text)
        self.assertEqual(kit.LATIN_KURDISH_LETTERS, "çêîûşÇÊÎÛŞ")
        latin = " ".join(kit.LATIN_KURDISH_LETTERS)
        self.assertIn(f"E:NSLATN.TTF^FB", text)
        self.assertRegex(text, r"\^A@N,\d+,\d+,E:NSLATN\.TTF\^FB[^\n]*" + re.escape(latin))
        self.assertRegex(text, r"\^A@N,\d+,\d+,E:NSLATNB\.TTF\^FB[^\n]*" + re.escape(latin))
        self.assertRegex(text, r"\^A@N,\d+,\d+,E:NSARABB\.TTF\^FB[^\n]*" + re.escape(kit.SAMPLE_WORDS))
        for text_value in (latin, kit.SYN_NAME_LATIN, kit.SAMPLE_WORDS, kit.SYN_NAME):
            self.assertEqual(unicodedata.normalize("NFC", text_value), text_value)

    def test_letter_table_matches_unicode(self) -> None:
        letters = kit.SORANI_ALPHABET + tuple(x for p in kit.VARIANT_PAIRS for x in p) + kit.EXTRA_LETTERS \
            + kit.ARABIC_ONLY_LETTERS
        for letter in letters:
            self.assertEqual(unicodedata.name(letter.char), "ARABIC LETTER " + letter.name)
            self.assertEqual(unicodedata.bidirectional(letter.char), "AL")
        # The joining types the spec's font-coverage test names (platform-docs.md §9).
        joining = {letter.char: letter.joining for letter in kit.SORANI_ALPHABET}
        for char in "پچگڤڵێ":
            self.assertEqual(joining[char], "D")
        for char in "ژڕۆە":
            self.assertEqual(joining[char], "R")
        for letter in letters:
            self.assertEqual(letter.char in kit.RIGHT_JOINING, letter.joining == "R", letter.name)

    def test_bidi_pattern_holds_the_identifiers(self) -> None:
        text = self.zpl(203, "ZT03")
        for value in (kit.SYN_MRN, kit.SYN_DATE, kit.SYN_DIGITS, f"{kit.SYN_NAME} {kit.SYN_MRN}",
                      f"{kit.SYN_NAME} {kit.SYN_DATE}", f"{kit.SYN_NAME} {kit.SYN_DIGITS}"):
            self.assertIn(f"^FD{value}^FS", text)
        # The captions' UBA claims rest on these classes: '-' is ES (so a date after Arabic letters splits
        # into Arabic-number runs), '/' is CS.
        self.assertEqual(unicodedata.bidirectional("-"), "ES")
        self.assertEqual(unicodedata.bidirectional("/"), "CS")

    def test_legibility_ladder_covers_6_to_12_pt_with_minimal_pairs(self) -> None:
        text = self.zpl(300, "ZT04")
        pairs_alone = "  ".join(f"{a} {b}" for a, b in kit.MINIMAL_PAIRS)
        pairs_joined = "  ".join(f"{kit.joined_form(a)} {kit.joined_form(b)}" for a, b in kit.MINIMAL_PAIRS)
        for pt in range(6, 13):
            height = kit.Options(dpi=300).pt_dots(pt)
            self.assertIn(f"{pt} pt ({height} dots)", text)
            for value in (pairs_alone, pairs_joined):
                self.assertRegex(text, rf"\^A@N,{height},{height},E:NSARAB\.TTF\^FB[^\n]*\^FD{re.escape(value)}\^FS")
        for char in kit.LADDER_LETTERS:
            self.assertIn(char * 3, text)
        self.assertEqual(len(kit.MINIMAL_PAIRS), 8)
        self.assertIn(kit.BEH + "ڕ", pairs_joined)  # right-joining: joined on its right only
        self.assertIn(kit.BEH + "ڵ" + kit.BEH, pairs_joined)  # dual-joining: medial
        for a, b in kit.MINIMAL_PAIRS:
            self.assertIn(a, kit.ITEMS_BY_ID["ZT-08"].passes_when)
            self.assertIn(b, kit.ITEMS_BY_ID["ZT-08"].passes_when)

    def test_legibility_minimum_marked_per_dpi(self) -> None:
        """ZT-08 thresholds per platform-docs.md §5.4 (OQ-243): 8 pt at 203 dpi, 7 pt at 300 and 600; Latin 6 pt."""
        self.assertEqual(kit.ARABIC_MIN_PT, {203: 8.0, 300: 7.0, 600: 7.0})
        self.assertEqual(kit.LATIN_MIN_PT, 6.0)
        for dpi, pt in ((203, 8), (300, 7), (600, 7)):
            text = self.zpl(dpi, "ZT04")
            marker = f"[Arabic-script identity minimum at {dpi} dpi]"
            self.assertIn(f"{pt} pt ({kit.Options(dpi=dpi).pt_dots(pt)} dots) {marker}", text)
            self.assertEqual(len(re.findall(rf"(\d+) pt \(\d+ dots\) {re.escape(marker)}", text)), 4)
            self.assertEqual(set(re.findall(rf"(\d+) pt \(\d+ dots\) {re.escape(marker)}", text)), {str(pt)})
            self.assertIn("6 pt [Latin identity minimum] Latin identifiers", text)
        self.assertIn("OQ-243", kit.ITEMS_BY_ID["ZT-08"].passes_when)

    def test_engine_form_lines(self) -> None:
        """ZT05 writes lines exactly as the engine's ZplTextWriter: ^FT, ^A@N or ^A@R, ^FB<w>,1,0,<J>,0."""
        for dpi in (203, 300, 600):
            text = self.zpl(dpi, "ZT05")
            orientations = [m.group(1) for m in ENGINE_LINE.finditer(text)]
            self.assertIn("N", orientations)
            self.assertEqual(orientations.count("R"), 2)
            self.assertEqual(len(orientations), len(re.findall(r"\^FT", text)))
            self.assertRegex(text, r"\^A@R,\d+,\d+,E:NSARAB\.TTF\^FB\d+,1,0,R,0\^FH\\\^FD" + re.escape(kit.SYN_NAME))
            self.assertRegex(text, r"\^A@R,\d+,\d+,E:NSLATN\.TTF\^FB\d+,1,0,L,0\^FH\\\^FD" + re.escape(kit.SYN_MRN))

    def test_fb_line_at_100_percent_of_its_box(self) -> None:
        opts = kit.Options(dpi=203)
        text = self.zpl(203, "ZT05")
        h = opts.pt_dots(10)
        units = sum(kit.NOTO_SANS_ADVANCES[c] for c in kit.SYN_MRN)
        full = math.ceil(units * h / 1000)
        self.assertEqual(kit.latin_text_width(kit.SYN_MRN, h), full)
        self.assertIn(f"^A@N,{h},{h},E:NSLATN.TTF^FB{full},1,0,L,0^FH\\^FD{kit.SYN_MRN}^FS", text)
        self.assertIn(f"^FB{math.ceil(full * 100 / 95)},1,0,L,0^FH\\^FD{kit.SYN_MRN}^FS", text)
        self.assertIn("text 100% of its \\5EFB box", text)

    def test_height_calibration_row(self) -> None:
        for dpi in (203, 300, 600):
            opts = kit.Options(dpi=dpi)
            text = self.zpl(dpi, "ZT05")
            h = kit.calibration_height(opts, "HÉgx")
            self.assertEqual(h, opts.dots(8.0))
            self.assertIn(f"^A@N,{h},{h},E:NSLATN.TTF", text)
            self.assertRegex(text, rf"\^GB\d+,{h},\d+\^FS")  # the reference bar is h dots tall
            self.assertIn(f"h {h} dots = {h / opts.dpmm:.2f} mm (the bar). H: {h / opts.dpmm * 714 / 1000:.2f} mm if h "
                          "is the em", text)
            arabic_text = kit.ALEF + "  " + kit.BEH + kit.ALEF
            h_ar = kit.calibration_height(opts, arabic_text, "arabic")
            self.assertEqual(h_ar, opts.dots(8.0))
            self.assertRegex(text, rf"\^A@N,{h_ar},{h_ar},E:NSARAB\.TTF\^FB\d+,1,0,R,0\^FH\\\^FD{re.escape(arabic_text)}\^FS")
            self.assertIn(f"Alef: {h_ar / opts.dpmm * 714 / 1000:.2f} mm if h is the em", text)
        narrow = kit.Options(dpi=203, width_mm=25.0, length_mm=250.0)
        self.assertLessEqual(narrow.dots(2.0) + kit.latin_text_width("HÉgx", kit.calibration_height(narrow, "HÉgx")),
                             narrow.content_width)
        arabic_text = kit.ALEF + "  " + kit.BEH + kit.ALEF
        self.assertLessEqual(
            narrow.dots(2.0) + kit.arabic_text_width(arabic_text, kit.calibration_height(narrow, arabic_text, "arabic")),
            narrow.content_width)

    def test_wristband_payload_has_the_production_shape(self) -> None:
        self.assertRegex(kit.WRISTBAND_PAYLOAD, r"^HMS1\|M:SYN-000123-7\|E:SYN-E-000045\|B:[A-Za-z0-9-]{36}$")
        self.assertEqual(len(kit.BAND_SERIAL), 36)
        self.assertTrue(kit.BAND_SERIAL.startswith("SYN-"))
        self.assertEqual(kit.ITEMS_BY_ID["BC-01"].expected_payload, kit.WRISTBAND_PAYLOAD)

    def test_worst_case_band_serial_needs_36_by_36(self) -> None:
        self.assertEqual(len(kit.BAND_SERIAL_WORST), 36)
        self.assertRegex(kit.BAND_SERIAL_WORST, r"^SYN-[A-Za-z0-9-]{32}$")
        self.assertIsNone(re.search(r"\d\d", kit.BAND_SERIAL_WORST))
        self.assertEqual(kit.datamatrix_side(kit.WRISTBAND_PAYLOAD_WORST), 36)
        self.assertEqual(kit.ITEMS_BY_ID["BC-04"].expected_payload, kit.WRISTBAND_PAYLOAD_WORST)
        self.assertIn("BC-04", kit.required_items(kit.TEXT_MODE_ITEMS, "wristband"))
        self.assertIn("BC-04", kit.required_items(kit.RASTER_MODE_ITEMS, "wristband"))

    def test_datamatrix_size_from_the_payload(self) -> None:
        self.assertEqual(kit.datamatrix_ascii_codewords("123456"), 3)
        self.assertEqual(kit.datamatrix_ascii_codewords("A1"), 2)
        self.assertEqual(kit.datamatrix_ascii_codewords("12a3"), 3)
        self.assertEqual(kit.datamatrix_ascii_codewords("é"), 2)
        self.assertEqual(kit.datamatrix_ascii_codewords(kit.WRISTBAND_PAYLOAD), 54)
        self.assertEqual(kit.datamatrix_side(kit.WRISTBAND_PAYLOAD), 32)
        self.assertEqual(kit.datamatrix_side(kit.SPECIMEN_PAYLOAD), 22)
        self.assertEqual(kit.datamatrix_side("A" * 3), 10)
        self.assertEqual(kit.datamatrix_side("A" * 4), 12)
        with self.assertRaises(kit.KitError):
            kit.datamatrix_side("A" * 1559)

    def test_datamatrix_in_the_engine_form_with_its_space_reserved(self) -> None:
        for dpi, (big, small) in ((203, (4, 2)), (300, (6, 3)), (600, (12, 6))):
            text = self.zpl(dpi, "BC01")
            self.assertIn(f"^BXN,{big},200,32,32,,_^FH\\^FD{kit.WRISTBAND_PAYLOAD}^FS", text)
            self.assertIn(f"^BXN,{small},200,22,22,,_^FH\\^FD{kit.SPECIMEN_PAYLOAD}^FS", text)
            self.assertIn(f"^BXN,{big},200,36,36,,_^FH\\^FD{kit.WRISTBAND_PAYLOAD_WORST}^FS", text)
            self.assertIn("the typical size", text)
            self.assertNotRegex(text, r"\^BX[^\n]*\^BX")
            for module, side, payload in ((big, 32, kit.WRISTBAND_PAYLOAD), (big, 36, kit.WRISTBAND_PAYLOAD_WORST),
                                          (small, 22, kit.SPECIMEN_PAYLOAD)):
                symbol_y = int(re.search(rf"\^FO\d+,(\d+)\^BXN,{module},200,{side}", text).group(1))
                text_y = int(re.search(rf"\^FO\d+,(\d+)\^A0N,\d+,\d+\^FB\d+,\d+,\d+,L,0\^FH\\\^FD{re.escape(payload)}\^FS",
                                       text).group(1))
                self.assertGreaterEqual(text_y, symbol_y + side * module, dpi)
        self.assertNotIn(kit.BX_ESCAPE, kit.WRISTBAND_PAYLOAD + kit.SPECIMEN_PAYLOAD)

    def test_code128_in_the_engine_form(self) -> None:
        """^BY<m>^BC<o>,<h>,N,N,N,N as ZplFields.kt writes it; the payload is a separate caption field below."""
        for dpi, module in ((203, 2), (300, 3), (600, 6)):
            text = self.zpl(dpi, "BC01")
            bar_h = kit.Options(dpi=dpi).dots(10.0)
            match = re.search(rf"\^FO\d+,(\d+)\^BY{module}\^BCN,{bar_h},N,N,N,N\^FH\\\^FD{kit.CODE128_PAYLOAD}\^FS", text)
            self.assertIsNotNone(match, dpi)
            caption = re.search(rf"\^FO\d+,(\d+)\^A0N,\d+,\d+\^FB\d+,\d+,\d+,L,0\^FH\\\^FD{kit.CODE128_PAYLOAD}\^FS", text)
            self.assertIsNotNone(caption, dpi)
            self.assertGreater(int(caption.group(1)), int(match.group(1)) + bar_h)
            self.assertNotIn(",Y,N,N,N", text)

    def test_barcode_payload_refusals(self) -> None:
        with self.assertRaises(kit.KitError):
            kit._render_block(kit.Options(dpi=203), kit.Symbol("x", "datamatrix", "HMS1|M:A_B", 0.5), 0)
        with self.assertRaises(kit.KitError):
            kit._render_block(kit.Options(dpi=203), kit.Symbol("x", "code128", "SYN>5", 0.25), 0)

    def test_narrow_media_marks_code128_not_printed(self) -> None:
        for width, length in ((40.0, 100.0), (25.0, 250.0)):
            files = generate(203, width_mm=width, length_mm=length)
            text = next(d for n, d in files.items() if n.startswith("s7k-bc01-")).decode("utf-8")
            self.assertNotIn("^BC", text)
            self.assertIn("NOT PRINTED", text)
            self.assertIn("^BXN,4,200,32,32,,_", text)
            self.assertIn(f"^PW{kit.Options(dpi=203).dots(width)}", text)

    def test_ja01_starts_with_cancel_all(self) -> None:
        text = self.zpl(203, "JA01")
        self.assertTrue(text.startswith("~JA\n^XA"))
        self.assertEqual(text.count("^XA"), 1)

    def test_config_files(self) -> None:
        files = self.files[203]
        self.assertEqual(files["s7k-cfg-05-host-directory-listing.zpl"], b"^XA^HW^XZ\n^XA^HWE:*.*^XZ\n")
        self.assertEqual(files["s7k-cfg-04-print-directory-e.zpl"], b"^XA^WDE:*.*^XZ\n")
        self.assertEqual(files["s7k-cfg-01-host-identification.zpl"], b"~HI\n")

    def test_escpos_selftest_bytes(self) -> None:
        data = self.files[203][kit.ESCPOS_FILE]
        self.assertTrue(data.startswith(b"\x1b@"))
        self.assertTrue(data.endswith(b"\x1bd\x04\x1dVB\x00"))
        self.assertIn(kit.NOTICE.encode("ascii"), data)
        self.assertNotIn(b"\r", data)

    def test_manifest_hashes_match(self) -> None:
        for dpi, files in self.files.items():
            manifest = json.loads(files["MANIFEST.json"])
            self.assertEqual(manifest["dpi"], dpi)
            self.assertEqual(manifest["kit_version"], kit.KIT_VERSION)
            self.assertEqual(manifest["provenance"], "synthetic")
            listed = {entry["file"]: entry for entry in manifest["files"]}
            self.assertEqual(set(listed), set(files) - {"MANIFEST.json"})
            for name, entry in listed.items():
                self.assertEqual(entry["sha256"], hashlib.sha256(files[name]).hexdigest(), name)
                self.assertEqual(entry["bytes"], len(files[name]))
                self.assertTrue(entry["purpose"])
                self.assertIn("dpi", entry)

    def test_cli_patterns_and_list(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            code, _out, err = run(["patterns", "--dpi", "600", "--out", tmp])
            self.assertEqual(code, 0, err)
            self.assertEqual({p.name: p.read_bytes() for p in Path(tmp).iterdir()}, self.files[600])
        code, out, _err = run(["list", "--json"])
        self.assertEqual(code, 0)
        listing = json.loads(out)
        self.assertEqual(listing["items"], list(kit.ITEM_IDS))
        self.assertIn("s7k-zt05-engine-lines-<dpi>.zpl", [f["file"] for f in listing["files"]])

    def test_bad_options_refused(self) -> None:
        for options in ({"dpi": 150}, {"dpi": 203, "width_mm": 10}, {"dpi": 203, "width_mm": float("nan")},
                        {"dpi": 203, "arabic_font": "NSARAB.TTF"}, {"dpi": 203, "latin_font": "E:nslatn.ttf"},
                        {"dpi": 203, "latin_bold_font": "E:NS LATNB.TTF"}):
            with self.assertRaises(kit.KitError):
                kit.Options(**options)


class FontTest(unittest.TestCase):
    FONT = b"\x00\x01\x00\x00" + bytes(range(256)) + b"^XZ~JA"

    def test_command_header_and_exact_bytes(self) -> None:
        command = kit.font_download_command(self.FONT, "E:NSARAB.TTF")
        header = f"~DYE:NSARAB,B,T,{len(self.FONT)},,".encode("ascii")
        self.assertEqual(command, header + self.FONT)

    def test_cli_writes_the_file_and_warns_on_an_unpinned_font(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            font = Path(tmp) / "f.ttf"
            font.write_bytes(self.FONT)
            out = Path(tmp) / "f.dy"
            code, stdout, err = run(["font-download", "--font", str(font), "--name", "E:NSLATN.TTF", "--out", str(out)])
            self.assertEqual(code, 0, err)
            self.assertTrue(out.read_bytes().startswith(b"~DYE:NSLATN,B,T,"))
            self.assertIn("not the pinned NotoSans-Regular.ttf", err)
            code, _stdout, err = run(["font-download", "--font", str(Path(tmp) / "missing.ttf"), "--name",
                                      "E:NSLATN.TTF", "--out", str(out)])
            self.assertEqual(code, 2)
            self.assertIn("cannot read it", err)
        self.assertIn(hashlib.sha256(self.FONT).hexdigest(), stdout)

    def test_refusals(self) -> None:
        for magic in (b"OTTO", b"ttcf", b"wOF2", b"\x00\x00\x00\x00"):
            with self.assertRaises(kit.KitError):
                kit.font_download_command(magic + b"rest", "E:NSARAB.TTF")
        for name in ("NSARAB.TTF", "E:NSARAB.OTF", "Z:NSARAB.TTF", "E:NS ARAB.TTF", "E:.TTF",
                     "E:ABCDEFGHIJKLMNOPQ.TTF"):
            with self.assertRaises(kit.KitError):
                kit.font_download_command(self.FONT, name)

    @unittest.skipUnless((FONT_DIR / "fonts.json").is_file(), "the engine's fonts are not in this checkout")
    def test_print_fonts_match_the_engine_fonts(self) -> None:
        pinned = {entry["file"]: entry for entry in json.loads((FONT_DIR / "fonts.json").read_text(encoding="utf-8"))}
        self.assertEqual({e[1] for e in kit.PRINT_FONTS}, set(pinned))
        for _name, source, sha256, version in kit.PRINT_FONTS:
            self.assertEqual(pinned[source]["sha256"], sha256)
            self.assertEqual(pinned[source]["version"], version)
            self.assertEqual(hashlib.sha256((FONT_DIR / source).read_bytes()).hexdigest(), sha256)
        self.assertEqual(set(kit.REFERENCE_FONT_FILES.values()), set(pinned))

    @unittest.skipUnless((FONT_DIR / "NotoSans-Regular.ttf").is_file(), "the engine's fonts are not in this checkout")
    def test_recorded_metrics_match_the_font_files(self) -> None:
        latin = kit.read_ttf_metrics((FONT_DIR / "NotoSans-Regular.ttf").read_bytes(),
                                     "".join(kit.NOTO_SANS_ADVANCES) + kit.LATIN_KURDISH_LETTERS)
        self.assertEqual(latin["upem"], kit.NOTO_SANS_UPEM)
        self.assertEqual(latin["ascender"], kit.NOTO_SANS_ASCENDER)
        self.assertEqual(latin["descender"], kit.NOTO_SANS_DESCENDER)
        self.assertEqual(latin["cap_height"], kit.NOTO_SANS_CAP_HEIGHT)
        self.assertEqual({c: latin["advances"][c] for c in kit.NOTO_SANS_ADVANCES}, kit.NOTO_SANS_ADVANCES)
        self.assertEqual(latin["missing"], [])
        arabic = kit.read_ttf_metrics((FONT_DIR / "NotoSansArabic-Regular.ttf").read_bytes(),
                                      kit.KURDISH_LETTERS + kit.ZWNJ + kit.ZWJ)
        self.assertEqual(arabic["upem"], kit.NOTO_SANS_UPEM)
        self.assertEqual((arabic["ascender"], arabic["descender"]), (kit.NOTO_ARABIC_ASCENDER, kit.NOTO_ARABIC_DESCENDER))
        alef = kit.read_ttf_metrics((FONT_DIR / "NotoSansArabic-Regular.ttf").read_bytes(), "".join(kit.NOTO_ARABIC_ADVANCES))
        self.assertEqual(alef["advances"], kit.NOTO_ARABIC_ADVANCES)
        self.assertEqual(alef["tops"][kit.ALEF], kit.NOTO_ARABIC_ALEF_HEIGHT)
        self.assertEqual(latin["tops"]["H"], kit.NOTO_SANS_CAP_HEIGHT)
        self.assertEqual(arabic["missing"], [])


class FormTest(unittest.TestCase):
    def setUp(self) -> None:
        import yaml  # noqa: F401  (the project venv provides it; check-form needs it)

        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def example(self) -> dict:
        import yaml

        return yaml.safe_load(EXAMPLE_FORM.read_text(encoding="utf-8"))

    @staticmethod
    def item(form: dict, iid: str) -> dict:
        return next(i for i in form["items"] if i["id"] == iid)

    def check(self, form: dict) -> tuple[int, str]:
        import yaml

        path = self.dir / "form.yaml"
        path.write_text(yaml.safe_dump(form, allow_unicode=True, sort_keys=False), encoding="utf-8")
        code, out, _err = run(["check-form", str(path)])
        return code, out

    def real(self) -> dict:
        """The example turned into a plausible test-result form (still synthetic data)."""
        form = self.example()
        form["provenance"] = "test-result"
        form["tester"]["name"] = "Tester"
        form["printer"]["make"], form["printer"]["model"] = "Make", "Model"
        return form

    def test_blank_form_validates(self) -> None:
        path = self.dir / "blank.yaml"
        code, _out, err = run(["form", "--out", str(path)])
        self.assertEqual(code, 0, err)
        code, out, _err = run(["check-form", str(path)])
        self.assertEqual(code, 0, out)
        self.assertIn("zpl-text incomplete", out)
        self.assertNotIn("EXAMPLE", out)
        code, _out, _err = run(["form", "--out", str(path)])
        self.assertEqual(code, 2, "form must not overwrite without --force")

    def test_blank_form_lists_every_item_fonts_and_an_empty_approval(self) -> None:
        import yaml

        form = yaml.safe_load(kit.blank_form())
        self.assertEqual([item["id"] for item in form["items"]], list(kit.ITEM_IDS))
        self.assertEqual(form["approval"], {"status": "requested", "approved_by": []})
        self.assertEqual(form["tester"]["name"], "")
        self.assertEqual([f["file"] for f in form["fonts"]], [e[0] for e in kit.PRINT_FONTS])
        self.assertEqual(form["font_height_calibration"]["latin"]["interpretation"], "not-measured")
        self.assertEqual(form["font_height_calibration"]["arabic"]["interpretation"], "not-measured")
        self.assertIn("grade", self.item(form, "BC-04"))
        self.assertIn("grade", self.item(form, "BC-01"))
        self.assertNotIn("grade", self.item(form, "BC-03"))
        self.assertIn("smallest_legible_pt_latin", self.item(form, "ZT-08"))

    def test_example_passes_check_form_and_says_so(self) -> None:
        code, out, err = run(["check-form", str(EXAMPLE_FORM)])
        self.assertEqual(code, 0, out + err)
        self.assertIn("check-form: PASS", out)
        self.assertIn("EXAMPLE – not a test result", out)

    def test_example_is_marked_synthetic(self) -> None:
        form = self.example()
        self.assertEqual(form["provenance"], "example")
        self.assertEqual(form["printer"]["make"], "SYN-EXAMPLE")
        self.assertEqual(form["tester"]["name"], "")
        self.assertIn("example only, not a test result", EXAMPLE_FORM.read_text(encoding="utf-8"))

    def test_filled_approval_fails(self) -> None:
        form = self.example()
        form["approval"]["approved_by"] = ["Somebody"]
        code, out = self.check(form)
        self.assertEqual(code, 1)
        self.assertIn("approval.approved_by must stay empty", out)
        form = self.example()
        form["approval"]["status"] = "approved"
        self.assertEqual(self.check(form)[0], 1)

    def test_barcode_pass_needs_five_exact_decodes(self) -> None:
        form = self.example()
        self.item(form, "BC-01")["decoded_payloads"][2] = kit.WRISTBAND_PAYLOAD + " "
        code, out = self.check(form)
        self.assertEqual(code, 1)
        self.assertIn("BC-01", out)
        self.assertIn("decode 3", out)
        form = self.example()
        self.item(form, "BC-01")["decoded_payloads"] = [kit.WRISTBAND_PAYLOAD] * 4
        code, out = self.check(form)
        self.assertEqual(code, 1)
        self.assertIn("all 5 decodes", out)
        form = self.example()
        self.item(form, "BC-03")["expected_payload"] = "SYN-S-000078"
        self.assertEqual(self.check(form)[0], 1)

    def test_barcode_pass_needs_scanner_and_mode(self) -> None:
        for key, value, message in (("scanner", " ", "scanner make and model"),
                                    ("scanner_mode", "", "scanner_mode hid-pos or keyboard-us-english")):
            form = self.example()
            self.item(form, "BC-01")[key] = value
            code, out = self.check(form)
            self.assertEqual(code, 1, key)
            self.assertIn(message, out)
        form = self.example()
        self.item(form, "BC-01")["scanner_mode"] = "keyboard-sorani"
        self.assertEqual(self.check(form)[0], 1)

    def test_grade_only_on_datamatrix_items(self) -> None:
        form = self.example()
        self.item(form, "BC-01")["grade"] = "B"
        self.item(form, "BC-02")["grade"] = "2.5"
        self.assertEqual(self.check(form)[0], 0)
        form = self.example()
        self.item(form, "BC-03")["grade"] = "A"
        code, out = self.check(form)
        self.assertEqual(code, 1)
        self.assertIn("'grade'", out)
        form = self.example()
        self.item(form, "BC-01")["grade"] = "E"
        self.assertEqual(self.check(form)[0], 1)

    def test_fail_needs_notes_and_results_need_evidence(self) -> None:
        form = self.example()
        self.item(form, "JA-01")["notes"] = " "
        self.assertEqual(self.check(form)[0], 1)
        form = self.example()
        self.item(form, "ZT-01")["evidence"] = []
        self.assertEqual(self.check(form)[0], 1)

    def test_missing_or_duplicate_item_fails(self) -> None:
        form = self.example()
        form["items"] = [i for i in form["items"] if i["id"] != "ZT-05"]
        code, out = self.check(form)
        self.assertEqual(code, 1)
        self.assertIn("ZT-05 is missing", out)
        form = self.example()
        form["items"].append(dict(form["items"][0]))
        self.assertEqual(self.check(form)[0], 1)

    def test_real_result_needs_tester_and_a_real_printer(self) -> None:
        form = self.example()
        form["provenance"] = "test-result"
        code, out = self.check(form)
        self.assertEqual(code, 1)
        self.assertIn("tester.name", out)
        self.assertIn("SYN- make or model is an example printer", out)
        self.assertEqual(self.check(self.real())[0], 0)
        for key in ("make", "model"):
            form = self.real()
            form["printer"][key] = "SYN-X"
            self.assertEqual(self.check(form)[0], 1, key)
        # Even a form with no results must not name a SYN- printer as a test result.
        import yaml

        blank = yaml.safe_load(kit.blank_form())
        blank["printer"]["make"] = "SYN-EXAMPLE"
        code, out = self.check(blank)
        self.assertEqual(code, 1)
        self.assertIn("SYN- make or model", out)

    def test_legibility_thresholds_per_dpi(self) -> None:
        """ZT-08: 8 pt Arabic script at 203 dpi, 7 pt at 300 and 600; Latin 6 pt (platform-docs.md §5.4)."""
        cases = ((203, 8, 6, 0), (203, 8.5, 6, 1), (300, 7, 6, 0), (300, 7.5, 6, 1), (600, 7, 6, 0),
                 (600, 8, 6, 1), (203, 8, 6.5, 1), (203, None, 6, 1), (203, 8, None, 1))
        for dpi, arabic, latin, expected in cases:
            form = self.example()
            form["printer"]["dpi"] = dpi
            item = self.item(form, "ZT-08")
            item["smallest_legible_pt"], item["smallest_legible_pt_latin"] = arabic, latin
            code, out = self.check(form)
            self.assertEqual(code, expected, f"{dpi} dpi, {arabic} pt, Latin {latin} pt: {out}")

    def test_height_calibration_needed_for_zt11_pass(self) -> None:
        for script, key, value in (("latin", "h_dots", None), ("latin", "cap_height_mm", None),
                                   ("latin", "interpretation", "not-measured"), ("arabic", "h_dots", None),
                                   ("arabic", "alef_height_mm", None), ("arabic", "interpretation", "not-measured")):
            form = self.example()
            form["font_height_calibration"][script][key] = value
            code, out = self.check(form)
            self.assertEqual(code, 1, f"{script} {key}")
            self.assertIn(f"font_height_calibration.{script}", out)

    def test_h_dots_warning_unless_a_cal_row_height(self) -> None:
        for dpi, good in ((203, (64, 48, 32)), (300, (96, 72, 48)), (600, (192, 144, 96))):
            for h in good:
                form = self.example()
                form["printer"]["dpi"] = dpi
                self.item(form, "ZT-08")["smallest_legible_pt"] = 7
                form["font_height_calibration"]["latin"]["h_dots"] = h
                form["font_height_calibration"]["arabic"]["h_dots"] = h
                code, out = self.check(form)
                self.assertEqual(code, 0, out)
                self.assertNotIn("is not the h of a CAL row", out)
        form = self.example()
        form["font_height_calibration"]["arabic"]["h_dots"] = 65
        code, out = self.check(form)
        self.assertEqual(code, 0, out)  # a warning, not an error
        self.assertIn("font_height_calibration.arabic.h_dots: 65 is not the h of a CAL row at 203 dpi (32, 48, 64)", out)

    def test_font_hash_must_be_the_pinned_one(self) -> None:
        form = self.example()
        form["fonts"][0]["sha256"] = kit.PRINT_FONTS[0][2]
        self.assertEqual(self.check(form)[0], 0)
        form["fonts"][0]["sha256"] = "0" * 64
        code, out = self.check(form)
        self.assertEqual(code, 1)
        self.assertIn("not the pinned font", out)

    def test_schema_rejects_unknown_fields_and_values(self) -> None:
        form = self.example()
        form["items"][0]["result"] = "passed"
        self.assertEqual(self.check(form)[0], 1)
        form = self.example()
        form["extra"] = 1
        self.assertEqual(self.check(form)[0], 1)
        form = self.example()
        form["printer"]["evidence"] = ["../outside.jpg"]
        self.assertEqual(self.check(form)[0], 1)
        form = self.example()
        self.item(form, "BC-01")["decoded_payload"] = kit.WRISTBAND_PAYLOAD  # the 0.1.0 field
        self.assertEqual(self.check(form)[0], 1)
        form = self.example()
        self.item(form, "ZT-01")["scanner"] = "x"
        self.assertEqual(self.check(form)[0], 1)

    def test_implied_listing(self) -> None:
        form = self.example()
        self.assertEqual(kit.implied_listing(form)["zpl-text"], "not-eligible")
        for item in form["items"]:
            if item["id"] in kit.TEXT_MODE_ITEMS:
                item["result"] = "pass"
        self.assertEqual(kit.implied_listing(form)["zpl-text"], "eligible")
        self.assertEqual(kit.implied_listing(form)["zpl-raster"], "incomplete")

    def test_implied_listing_wristband_needs_no_code128(self) -> None:
        """BC-03 (Code 128) is required for label printers only, never for wristband printers."""
        form = self.example()
        for item in form["items"]:
            item["result"] = "pass" if item["id"] in kit.TEXT_MODE_ITEMS + kit.RASTER_MODE_ITEMS else "not-run"
        self.item(form, "BC-03")["result"] = "not-run"
        form["printer"]["kind"] = "wristband"
        self.assertEqual(kit.implied_listing(form), {"zpl-text": "eligible", "zpl-raster": "eligible",
                                                     "ja-prefix": "untested"})
        form["printer"]["kind"] = "label"
        self.assertEqual(kit.implied_listing(form)["zpl-text"], "incomplete")
        self.assertEqual(kit.implied_listing(form)["zpl-raster"], "incomplete")
        self.assertNotIn("BC-03", kit.required_items(kit.TEXT_MODE_ITEMS, "wristband"))
        self.assertIn("BC-03", kit.required_items(kit.TEXT_MODE_ITEMS, "label"))

    def test_schema_is_draft_2020_12(self) -> None:
        import jsonschema

        schema = json.loads(kit.SCHEMA_PATH.read_text(encoding="utf-8"))
        self.assertEqual(schema["$schema"], "https://json-schema.org/draft/2020-12/schema")
        jsonschema.Draft202012Validator.check_schema(schema)
        self.assertEqual(schema["properties"]["items"]["items"]["properties"]["id"]["enum"], list(kit.ITEM_IDS))


if __name__ == "__main__":
    unittest.main()
