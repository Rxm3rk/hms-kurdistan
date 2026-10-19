"""Offline only: the fetcher and the socket guard (docs/specs/modules/platform-docs.md §7.5; HAZ-0047; BUILD-PROMPT §3.7).

UnitTest:renderer-refuses-remote-resources and UnitTest:renderer-opens-no-socket.
"""

from __future__ import annotations

import base64
import re
import socket
import unittest
from pathlib import Path
from unittest import mock

from hms_docrender import render as render_module
from hms_docrender.fetcher import OfflineResolver, ResourceRefused
from hms_docrender.render import NetworkRefused, RenderRefused, SocketGuard, render
from tests.support import SATELLITE, html_document, make_request, requires_fonts

STUB_FONTS = {name: f"font bytes of {name}".encode() for name in (
    "noto-sans-arabic-regular", "noto-sans-arabic-bold", "noto-sans-regular", "noto-sans-bold")}
# A 1x1 white PNG.
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGP4DwABAQEAG7buVgAAAABJRU5ErkJggg==")

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
    """UnitTest:renderer-refuses-remote-resources (HAZ-0047): only hms-font: names and data: URLs resolve."""

    def test_the_resolver_refuses_everything_but_font_names_and_data(self) -> None:
        resolver = OfflineResolver(STUB_FONTS)
        for url in REFUSED_URLS:
            with self.subTest(url=url), self.assertRaises(ResourceRefused):
                resolver.resolve(url)
        self.assertEqual(resolver.served, [])

    def test_the_resolver_serves_the_four_font_names_and_data_urls(self) -> None:
        resolver = OfflineResolver(STUB_FONTS)
        for name, body in STUB_FONTS.items():
            self.assertEqual(resolver.resolve(f"hms-font:{name}").body, body)
        self.assertEqual(resolver.resolve("HMS-FONT:noto-sans-bold").body, STUB_FONTS["noto-sans-bold"])
        png = resolver.resolve("data:image/png;base64," + base64.b64encode(PNG_1X1).decode())
        self.assertEqual((png.body, png.media_type), (PNG_1X1, "image/png"))
        text = resolver.resolve("data:,SYN%20text")
        self.assertEqual((text.body, text.media_type), (b"SYN text", "text/plain"))

    def test_malformed_data_urls_are_refused(self) -> None:
        resolver = OfflineResolver(STUB_FONTS)
        for url in ("data:image/png;base64", "data:image/png;base64,***", "data:not a type,x"):
            with self.subTest(url=url), self.assertRaises(ResourceRefused):
                resolver.resolve(url)

    def test_a_refusal_never_echoes_a_data_url(self) -> None:
        with self.assertRaises(ResourceRefused) as caught:
            OfflineResolver(STUB_FONTS).resolve("data:image/png;base64,***SYN-SECRET")
        self.assertNotIn("SYN-SECRET", str(caught.exception))

    @requires_fonts
    def test_a_render_that_needs_any_refused_resource_fails(self) -> None:
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
        }
        for label, body in cases.items():
            with self.subTest(case=label), self.assertRaises(RenderRefused) as caught:
                render(make_request(html_document(body)))
            self.assertEqual(caught.exception.code, "resource-refused", caught.exception.detail)

    @requires_fonts
    def test_a_data_url_image_renders(self) -> None:
        body = f'<p>SYN</p><img src="data:image/png;base64,{base64.b64encode(PNG_1X1).decode()}" style="width: 5mm">'
        result = render(make_request(html_document(body)))
        self.assertTrue(result.pdf.startswith(b"%PDF-1.7"))


class RecordingGuard(SocketGuard):
    instances: list["RecordingGuard"] = []

    def __enter__(self) -> "RecordingGuard":
        RecordingGuard.instances.append(self)
        return super().__enter__()


class RendererOpensNoSocketTest(unittest.TestCase):
    """UnitTest:renderer-opens-no-socket: no socket is opened during a render, and any attempt fails the render."""

    def test_the_guard_refuses_and_records_every_network_call_and_restores_after(self) -> None:
        original_connect, original_lookup = socket.socket.connect, socket.getaddrinfo
        with SocketGuard() as guard:
            with self.assertRaises(NetworkRefused):
                socket.create_connection(("127.0.0.1", 9), timeout=1)
            with self.assertRaises(NetworkRefused):
                socket.getaddrinfo("example.invalid", 443)
            probe = socket.socket()
            try:
                with self.assertRaises(NetworkRefused):
                    probe.connect(("127.0.0.1", 9))
                with self.assertRaises(NetworkRefused):
                    probe.bind(("127.0.0.1", 0))
            finally:
                probe.close()
        self.assertEqual(guard.attempts, ["socket.create_connection", "socket.getaddrinfo", "socket.connect", "socket.bind"])
        self.assertIs(socket.socket.connect, original_connect)
        self.assertIs(socket.getaddrinfo, original_lookup)

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


if __name__ == "__main__":
    unittest.main()
