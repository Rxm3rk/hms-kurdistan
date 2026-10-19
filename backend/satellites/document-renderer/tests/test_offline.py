"""Offline only: the fetcher, the font sources and the socket guard (docs/specs/modules/platform-docs.md §7.5; HAZ-0047;
BUILD-PROMPT §3.7).

UnitTest:renderer-refuses-remote-resources and UnitTest:renderer-opens-no-socket, and the regression tests of the
WP-0.8 renderer reviews (correctness 1, 4, 7, 8, 14; safety 9).
"""

from __future__ import annotations

import base64
import io
import re
import socket
import unittest
from pathlib import Path
from unittest import mock

from hms_docrender import render as render_module
from hms_docrender.fetcher import FONT_SIGNATURES, OfflineResolver, ResourceRefused
from hms_docrender.fonts import font_dir_default
from hms_docrender.render import NetworkRefused, RenderFailed, RenderRefused, SocketGuard, render
from tests.support import SATELLITE, html_document, make_request, requires_fonts

STUB_FONTS = {name: f"font bytes of {name}".encode() for name in (
    "noto-sans-arabic-regular", "noto-sans-arabic-bold", "noto-sans-regular", "noto-sans-bold")}
# A 1x1 white PNG.
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGP4DwABAQEAG7buVgAAAABJRU5ErkJggg==")
SVG_SQUARE = b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'


def data_url(media_type: str, body: bytes) -> str:
    return f"data:{media_type};base64,{base64.b64encode(body).decode()}"


REFUSED_URLS = [
    "http://example.invalid/logo.png",
    "https://example.invalid/logo.png",
    "HTTPS://EXAMPLE.INVALID/x.css",
    "file:///C:/Windows/Fonts/arial.ttf",
    "file:///etc/hosts",
    "ftp://example.invalid/x.png",
    "gopher://example.invalid/x",
    "hms-font2:noto-sans-regular",
    "javascript:alert(1)",
    "logo.png",
    "../fonts/NotoSans-Regular.ttf",
    "/etc/passwd",
    "//example.invalid/x.png",
    "C:/Windows/Fonts/arial.ttf",
    "hms-font:../NotoSans-Regular.ttf",
    "hms-font:..%2Ffonts.json",
    "hms-font:noto-sans-regular/../../fonts.json",
    "hms-font:NotoSans-Regular.ttf",
    "hms-font://noto-sans-regular",
    "hms-font:/noto-sans-regular",
    "hms-font:noto-sans-regular?x=1",
    "hms-font:noto-sans-regular#x",
    "hms-font:Noto-Sans-Regular",
    "hms-font:noto-sans-medium",
    "hms-font:",
    "",
]


class RendererRefusesRemoteResourcesTest(unittest.TestCase):
    """UnitTest:renderer-refuses-remote-resources (HAZ-0047): only hms-font: names and inline-image data: URLs resolve."""

    def test_the_resolver_refuses_everything_but_font_names_and_data(self) -> None:
        resolver = OfflineResolver(STUB_FONTS)
        for url in REFUSED_URLS:
            with self.subTest(url=url), self.assertRaises(ResourceRefused):
                resolver.resolve(url)
        self.assertEqual(resolver.served, [])

    def test_the_resolver_serves_the_four_font_names_and_inline_images(self) -> None:
        resolver = OfflineResolver(STUB_FONTS)
        for name, body in STUB_FONTS.items():
            self.assertEqual(resolver.resolve(f"hms-font:{name}").body, body)
        self.assertEqual(resolver.resolve("HMS-FONT:noto-sans-bold").body, STUB_FONTS["noto-sans-bold"])
        png = resolver.resolve(data_url("image/png", PNG_1X1))
        self.assertEqual((png.body, png.media_type), (PNG_1X1, "image/png"))
        jpeg = resolver.resolve(data_url("IMAGE/JPEG", b"\xff\xd8\xff\xe0" + b"\x00" * 16))
        self.assertEqual(jpeg.media_type, "image/jpeg")
        svg = resolver.resolve("data:image/svg+xml," + SVG_SQUARE.decode().replace(" ", "%20"))
        self.assertEqual((svg.body, svg.media_type), (SVG_SQUARE, "image/svg+xml"))
        self.assertEqual(resolver.resolve(data_url("image/svg+xml", b'<?xml version="1.0"?>' + SVG_SQUARE)).media_type, "image/svg+xml")

    def test_malformed_data_urls_are_refused(self) -> None:
        resolver = OfflineResolver(STUB_FONTS)
        for url in ("data:image/png;base64", "data:image/png;base64,***", "data:not a type,x"):
            with self.subTest(url=url), self.assertRaises(ResourceRefused):
                resolver.resolve(url)

    def test_only_inline_image_types_are_served_and_their_bodies_must_match(self) -> None:
        """Review correctness 1: a data: URL is never a stylesheet, a font or anything but png, jpeg or svg."""
        resolver = OfflineResolver(STUB_FONTS)
        cases = {
            "data:,SYN%20text": "data-url-type-not-allowed",
            "data:text/plain,SYN": "data-url-type-not-allowed",
            "data:text/css,p{color:red}": "data-url-type-not-allowed",
            data_url("font/ttf", b"\x00\x01\x00\x00" + b"\x00" * 32): "data-url-type-not-allowed",
            data_url("application/pdf", b"%PDF-1.4"): "data-url-type-not-allowed",
            data_url("image/gif", b"GIF89a"): "data-url-type-not-allowed",
            data_url("image/png", SVG_SQUARE): "data-url-content-mismatch",
            data_url("image/jpeg", PNG_1X1): "data-url-content-mismatch",
            data_url("image/svg+xml", PNG_1X1): "data-url-content-mismatch",
        }
        for signature in FONT_SIGNATURES:
            for media_type in ("image/png", "image/jpeg", "image/svg+xml"):
                cases[data_url(media_type, signature + b"\x00" * 64)] = "data-url-font-body"
        for url, reason in cases.items():
            with self.subTest(url=url[:40]), self.assertRaises(ResourceRefused) as caught:
                resolver.resolve(url)
            self.assertEqual(caught.exception.reason, reason)
        self.assertEqual(resolver.served, [])

    def test_a_refusal_carries_a_reason_code_never_the_url(self) -> None:
        """Review safety 9 / correctness 4 (SI-20): no URL, query or data: content in a refusal."""
        resolver = OfflineResolver(STUB_FONTS)
        for url in ("data:image/png;base64,***SYN-SECRET", "https://example.invalid/SYN-SECRET?mrn=SYN-000123-7",
                    "SYN-SECRET.png", "synsecret://x", "hms-font:SYN-SECRET", data_url("text/plain", b"SYN-SECRET")):
            with self.subTest(url=url[:30]), self.assertRaises(ResourceRefused) as caught:
                resolver.resolve(url)
            self.assertNotIn("SYN", str(caught.exception))
            self.assertNotIn("SECRET", str(caught.exception).upper())
            self.assertRegex(str(caught.exception), r"^[a-z0-9-]+(:[a-z0-9-]+)?$")

    @requires_fonts
    def test_a_render_that_needs_any_refused_resource_fails(self) -> None:
        nested = base64.b64encode(b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">'
                                  b'<image href="https://example.invalid/i.png" width="10" height="10"/></svg>').decode()
        cases = {
            "https image": '<img src="https://example.invalid/logo.png">',
            "http stylesheet": '<link rel="stylesheet" href="http://example.invalid/x.css"><p>x</p>',
            "@import": '<style>@import url("http://example.invalid/y.css");</style><p>x</p>',
            "file font": '<style>@font-face { font-family: X; src: url(file:///C:/Windows/Fonts/arial.ttf); } p { font-family: X; }</style><p>x</p>',
            "relative image": '<img src="logo.png">',
            "protocol-relative image": '<img src="//example.invalid/logo.png">',
            "ftp image": '<img src="ftp://example.invalid/x.png">',
            "unknown scheme": '<img src="gopher://example.invalid/x">',
            "font path traversal": '<style>@font-face { font-family: X; src: url(hms-font:../NotoSans-Regular.ttf); } p { font-family: X; }</style><p>x</p>',
            "base element": '<base href="https://example.invalid/"><img src="logo.png">',
            "svg image href": '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="https://example.invalid/i.png" width="10" height="10"/></svg>',
            "css background": '<div style="background: url(https://example.invalid/bg.png); width: 10mm; height: 10mm"></div>',
            # Review correctness 14: a refused fetch nested in an SVG data: image (WeasyPrint swallows BaseException there).
            "svg data image with a nested https image": f'<img src="data:image/svg+xml;base64,{nested}" style="width: 5mm">',
            "data: stylesheet": '<link rel="stylesheet" href="data:text/css,p%7Bcolor:red%7D"><p>x</p>',
            "@import of a data: stylesheet": '<style>@import url("data:text/css,p{color:red}");</style><p>x</p>',
        }
        for label, body in cases.items():
            with self.subTest(case=label), self.assertRaises(RenderRefused) as caught:
                render(make_request(html_document(body)))
            self.assertEqual(caught.exception.code, "resource-refused", caught.exception.detail)
            self.assertNotIn("example", caught.exception.detail)

    @requires_fonts
    def test_svg_nested_refusal_is_reported_with_its_reason(self) -> None:
        """Review correctness 14: the nested refusal inside an SVG image fails the render as a refusal, by its reason."""
        svg = (b'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="20" height="20">'
               b'<image xlink:href="file:///C:/Windows/win.ini" width="10" height="10"/></svg>')
        with self.assertRaises(RenderRefused) as caught:
            render(make_request(html_document(f'<img src="{data_url("image/svg+xml", svg)}" style="width: 5mm">')))
        self.assertEqual((caught.exception.code, caught.exception.detail), ("resource-refused", "scheme-not-allowed:file"))

    @requires_fonts
    def test_a_font_is_never_loaded_from_anything_but_hms_font(self) -> None:
        """Review correctness 1: a data: font (here a pinned font with "1" drawn as "7") or local() is refused."""
        from fontTools.ttLib import TTFont

        font = TTFont(str(font_dir_default() / "NotoSans-Regular.ttf"))
        for table in font["cmap"].tables:
            if ord("1") in table.cmap and ord("7") in table.cmap:
                table.cmap[ord("1")] = table.cmap[ord("7")]
        buffer = io.BytesIO()
        font.save(buffer)
        evil = base64.b64encode(buffer.getvalue()).decode()
        cases = {
            "data: font/ttf": f"url(data:font/ttf;base64,{evil})",
            "data: font claiming image/png": f"url(data:image/png;base64,{evil})",
            "data: svg as a font": f"url({data_url('image/svg+xml', SVG_SQUARE)})",
            "local()": "local('Noto Sans')",
            "hms-font then data: fallback": f"url(hms-font:noto-sans-regular), url(data:font/ttf;base64,{evil})",
        }
        for label, source in cases.items():
            body = (f'<style>@font-face {{ font-family: "Evil"; src: {source}; }} .d {{ font-family: "Evil"; }}</style>'
                    '<p class="d">Dose 1 mg</p>')
            with self.subTest(case=label), self.assertRaises(RenderRefused) as caught:
                render(make_request(html_document(body)))
            self.assertEqual(caught.exception.code, "resource-refused")

    @requires_fonts
    def test_inline_images_render(self) -> None:
        for media_type, body in (("image/png", PNG_1X1), ("image/svg+xml", SVG_SQUARE)):
            with self.subTest(media_type=media_type):
                result = render(make_request(html_document(f'<p>SYN</p><img src="{data_url(media_type, body)}" style="width: 5mm">')))
                self.assertTrue(result.pdf.startswith(b"%PDF-1.7"))

    @requires_fonts
    def test_a_fetch_that_fails_for_another_reason_still_fails_the_render_with_a_json_code(self) -> None:
        """Review correctness 8: an exception inside the fetcher becomes a fatal fetch error, mapped to render-error."""

        def broken_resolve(self: OfflineResolver, url: str):
            raise ValueError("SYN-SECRET broke")

        with mock.patch.object(OfflineResolver, "resolve", broken_resolve):
            with self.assertRaises((RenderFailed, RenderRefused)) as caught:
                render(make_request())
        self.assertNotIn("SYN-SECRET", caught.exception.detail)


class RecordingGuard(SocketGuard):
    instances: list["RecordingGuard"] = []

    def __enter__(self) -> "RecordingGuard":
        RecordingGuard.instances.append(self)
        return super().__enter__()


class RendererOpensNoSocketTest(unittest.TestCase):
    """UnitTest:renderer-opens-no-socket: no socket is opened during a render, and any attempt fails the render."""

    def test_the_guard_refuses_and_records_every_network_call_and_restores_after(self) -> None:
        import _socket

        originals = (socket.socket.connect, socket.getaddrinfo, socket.socket.__init__, _socket.socket, _socket.getaddrinfo,
                     socket.getnameinfo, socket.socketpair)
        own_connect = "connect" in vars(socket.socket)
        with SocketGuard() as guard:
            with self.assertRaises(NetworkRefused):
                socket.create_connection(("127.0.0.1", 9), timeout=1)
            with self.assertRaises(NetworkRefused):
                socket.getaddrinfo("example.invalid", 443)
            with self.assertRaises(NetworkRefused):
                socket.socket()
            with self.assertRaises(NetworkRefused):
                socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            with self.assertRaises(NetworkRefused):
                _socket.socket()
            with self.assertRaises(NetworkRefused):
                socket.getnameinfo(("127.0.0.1", 80), 0)
            with self.assertRaises(NetworkRefused):
                _socket.getaddrinfo("example.invalid", 443)
            with self.assertRaises(NetworkRefused):
                socket.socketpair()
        self.assertEqual(guard.attempts[:4], ["socket.create_connection", "socket.getaddrinfo", "socket.socket.__init__",
                                              "socket.socket.__init__"])
        self.assertEqual(guard.attempts[4:7], ["_socket.socket", "socket.getnameinfo", "_socket.getaddrinfo"])
        self.assertEqual(len(guard.attempts), 8)
        self.assertEqual((socket.socket.connect, socket.getaddrinfo, socket.socket.__init__, _socket.socket, _socket.getaddrinfo,
                          socket.getnameinfo, socket.socketpair), originals)
        self.assertEqual("connect" in vars(socket.socket), own_connect, "an inherited method is restored by removing the shadow")
        probe = socket.socket()  # works again after the guard
        probe.close()

    def test_a_socket_made_before_the_guard_cannot_send_or_connect_under_it(self) -> None:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            with SocketGuard() as guard:
                for call in (lambda: probe.sendto(b"x", ("127.0.0.1", 9)), lambda: probe.connect(("127.0.0.1", 9)),
                             lambda: probe.bind(("127.0.0.1", 0))):
                    with self.assertRaises(NetworkRefused):
                        call()
                if hasattr(probe, "sendmsg"):
                    with self.assertRaises(NetworkRefused):
                        probe.sendmsg([b"x"], [], 0, ("127.0.0.1", 9))
            self.assertIn("socket.socket.sendto", guard.attempts)
        finally:
            probe.close()

    @requires_fonts
    def test_a_document_that_would_need_a_fetch_fails_without_touching_a_socket(self) -> None:
        RecordingGuard.instances.clear()
        html = html_document('<img src="http://127.0.0.1:9/x.png"><link rel="stylesheet" href="https://127.0.0.1:9/x.css">')
        with mock.patch.object(render_module, "SocketGuard", RecordingGuard):
            with self.assertRaises(RenderRefused) as caught:
                render(make_request(html))
        self.assertEqual(caught.exception.code, "resource-refused")
        self.assertEqual(len(RecordingGuard.instances), 1, "the render ran inside the socket guard")
        self.assertEqual(RecordingGuard.instances[0].attempts, [], "the fetcher refused before any socket call")

    @requires_fonts
    def test_a_network_attempt_fails_the_render_even_if_a_library_swallows_it(self) -> None:
        real_resolve = OfflineResolver.resolve

        def leaky_resolve(self: OfflineResolver, url: str):  # a fetcher bug that tries the network, then hides it
            try:
                socket.getaddrinfo("example.invalid", 443)
            except BaseException:  # noqa: BLE001 - simulating a library that swallows everything
                pass
            return real_resolve(self, url)

        with mock.patch.object(OfflineResolver, "resolve", leaky_resolve):
            with self.assertRaises(RenderRefused) as caught:
                render(make_request())
        self.assertEqual(caught.exception.code, "network-attempt")
        self.assertIn("socket.getaddrinfo", caught.exception.detail)

    @requires_fonts
    def test_a_network_attempt_inside_a_fetch_stops_the_render(self) -> None:
        def connecting_resolve(self: OfflineResolver, url: str):
            socket.create_connection(("127.0.0.1", 9), timeout=1)

        with mock.patch.object(OfflineResolver, "resolve", connecting_resolve):
            with self.assertRaises(RenderRefused) as caught:
                render(make_request())
        self.assertEqual(caught.exception.code, "network-attempt")
        self.assertIsNot(socket.create_connection, None)

    def test_the_package_has_no_network_listener(self) -> None:
        forbidden = re.compile(r"socketserver|http\.server|xmlrpc\.server|asyncio\.start_server|\.listen\(|\.bind\(|create_server\(|urlopen\(")
        for path in sorted((SATELLITE / "hms_docrender").rglob("*.py")):
            with self.subTest(file=path.name):
                self.assertIsNone(forbidden.search(path.read_text(encoding="utf-8")), f"{path} has network listener or client code")

    def test_the_guard_is_documented_as_python_only(self) -> None:
        """Review correctness 7: the docs say the guard covers Python only and --network none is the real control."""
        for text in (render_module.SocketGuard.__doc__ or "", (SATELLITE / "README.md").read_text(encoding="utf-8")):
            self.assertIn("Python", text)
            self.assertIn("--network none", text)


if __name__ == "__main__":
    unittest.main()
