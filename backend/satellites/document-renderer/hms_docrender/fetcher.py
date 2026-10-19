"""The offline resource fetcher (docs/specs/modules/platform-docs.md §7.4 resources, §7.5 offline only; HAZ-0047).

Exactly two kinds of URL resolve:

- ``hms-font:<name>``, where ``<name>`` is one of the four print-font names; the bytes are the ones the font check
  verified against ``fonts.json`` (``fonts.FontSet``), never re-read from disk;
- ``data:`` URLs of the three inline image types ``image/png``, ``image/jpeg`` and ``image/svg+xml`` (§7.4: images
  and barcodes inline), whose decoded body must start like that type (PNG signature, JPEG SOI marker, or XML or
  ``<svg``). Any other ``data:`` type is refused: a stylesheet would carry CSS no pre-layout check has seen, and a
  font body (sfnt, ``OTTO``, ``ttcf``, ``true``, ``wOFF``, ``wOF2``) would bypass the font pins of ``fonts.json``.
  WeasyPrint's ``@font-face`` loader ignores the media type, so a body with a font signature is refused whatever
  type it claims, and ``render`` separately refuses every ``@font-face`` source that is not ``hms-font:``.

Everything else is refused by raising: ``http:``, ``https:``, ``file:``, ``ftp:``, relative references, any other
scheme, and any ``hms-font:`` value that is not exactly a known name (so no path, ``..``, percent-encoding, query or
fragment can reach a file). In WeasyPrint the refusal is a ``FatalURLFetchingError``, which stops the render, so a
refused fetch always fails the render instead of leaving a gap in the PDF.

A refusal carries a fixed reason code (``REASONS``), never the URL: a ``data:`` URL is document content (a barcode
image carries patient identifiers) and any other URL is document text too (SI-20).

``OfflineResolver`` has no dependency on WeasyPrint; ``weasyprint_fetcher`` adapts it and must be called only after
``env.prepare`` (it imports WeasyPrint).
"""

from __future__ import annotations

import base64
import binascii
import re
from dataclasses import dataclass
from typing import Any, Mapping
from urllib.parse import unquote_to_bytes

_SCHEME = re.compile(r"^([A-Za-z][A-Za-z0-9+.-]*):")
_FONT_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_MEDIA_TYPE = re.compile(r"^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$")
FONT_MEDIA_TYPE = "font/ttf"
MAX_DATA_URL_BYTES = 8 * 1024 * 1024

# The only data: types served (§7.4) and the start of a body of each type.
DATA_IMAGE_TYPES = ("image/png", "image/jpeg", "image/svg+xml")
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_JPEG_SIGNATURE = b"\xff\xd8\xff"
_SVG_START = re.compile(rb"^(?:\xef\xbb\xbf)?\s*<(?:\?xml|svg[\s>/]|!--|!DOCTYPE\s+svg)", re.IGNORECASE)
# Font file signatures: TrueType 1.0, OpenType CFF, TrueType collection, Apple 'true', WOFF and WOFF2.
FONT_SIGNATURES = (b"\x00\x01\x00\x00", b"OTTO", b"ttcf", b"true", b"wOFF", b"wOF2")

# Schemes named in a refusal; any other scheme is reported as "other" (a scheme is document text too).
_KNOWN_SCHEMES = frozenset({"http", "https", "file", "ftp", "ftps", "ws", "wss", "blob", "javascript", "mailto", "about",
                            "gopher", "smb", "ldap", "jar", "resource", "chrome", "res"})

# Fixed reason codes of a refused resource (the "detail" of a resource-refused result).
REASONS = (
    "empty-url",
    "relative-reference",
    "scheme-not-allowed",
    "font-name-invalid",
    "font-name-unknown",
    "data-url-malformed",
    "data-url-type-not-allowed",
    "data-url-content-mismatch",
    "data-url-font-body",
    "data-url-too-large",
)


class ResourceRefused(Exception):
    """A URL the offline fetcher does not serve. ``reason`` is one of ``REASONS``; the message never holds the URL."""

    def __init__(self, reason: str, qualifier: str | None = None):
        assert reason in REASONS, reason
        self.reason = reason
        self.code = f"{reason}:{qualifier}" if qualifier else reason
        super().__init__(self.code)


@dataclass(frozen=True)
class Resource:
    body: bytes
    media_type: str


def data_body_matches(media_type: str, body: bytes) -> bool:
    """Does ``body`` start like ``media_type`` (one of ``DATA_IMAGE_TYPES``)?"""
    if media_type == "image/png":
        return body.startswith(_PNG_SIGNATURE)
    if media_type == "image/jpeg":
        return body.startswith(_JPEG_SIGNATURE)
    if media_type == "image/svg+xml":
        return _SVG_START.match(body[:4096]) is not None
    return False


class OfflineResolver:
    """Resolves ``hms-font:`` names and inline-image ``data:`` URLs; refuses everything else."""

    def __init__(self, fonts: Mapping[str, bytes]):
        self._fonts = dict(fonts)
        self.served: list[str] = []  # what was served, for tests and diagnostics (scheme:name or data:type only)

    def resolve(self, url: str) -> Resource:
        if not isinstance(url, str) or not url:
            raise ResourceRefused("empty-url")
        match = _SCHEME.match(url)
        if match is None:
            raise ResourceRefused("relative-reference")
        scheme = match.group(1).lower()
        rest = url[match.end():]
        if scheme == "hms-font":
            return self._font(rest)
        if scheme == "data":
            return self._data(rest)
        raise ResourceRefused("scheme-not-allowed", scheme if scheme in _KNOWN_SCHEMES else "other")

    def _font(self, name: str) -> Resource:
        if not _FONT_NAME.match(name):
            raise ResourceRefused("font-name-invalid")
        if name not in self._fonts:
            raise ResourceRefused("font-name-unknown")
        self.served.append(f"hms-font:{name}")
        return Resource(self._fonts[name], FONT_MEDIA_TYPE)

    def _data(self, rest: str) -> Resource:
        header, comma, payload = rest.partition(",")
        if not comma:
            raise ResourceRefused("data-url-malformed")
        params = header.split(";")
        is_base64 = params[-1].strip().lower() == "base64"
        if is_base64:
            params = params[:-1]
        media_type = params[0].strip().lower() or "text/plain"
        if not _MEDIA_TYPE.match(media_type):
            raise ResourceRefused("data-url-malformed")
        if media_type not in DATA_IMAGE_TYPES:
            raise ResourceRefused("data-url-type-not-allowed")
        raw = unquote_to_bytes(payload)
        if is_base64:
            try:
                body = base64.b64decode(b"".join(raw.split()), validate=True)
            except (binascii.Error, ValueError):
                raise ResourceRefused("data-url-malformed") from None
        else:
            body = raw
        if len(body) > MAX_DATA_URL_BYTES:
            raise ResourceRefused("data-url-too-large")
        if body.startswith(FONT_SIGNATURES):
            raise ResourceRefused("data-url-font-body")
        if not data_body_matches(media_type, body):
            raise ResourceRefused("data-url-content-mismatch")
        self.served.append(f"data:{media_type}")
        return Resource(body, media_type)


def weasyprint_fetcher(resolver: OfflineResolver) -> Any:
    """A WeasyPrint URL fetcher that serves only what ``resolver`` resolves; every refusal is fatal."""
    from weasyprint.urls import FatalURLFetchingError, URLFetcher, URLFetcherResponse

    class Refused(FatalURLFetchingError):
        """A refused fetch; fatal, so it stops the render (WeasyPrint swallows ordinary exceptions)."""

        def __init__(self, refusal: ResourceRefused):
            super().__init__(refusal.code)
            self.refusal = refusal

    class OfflineFetcher(URLFetcher):
        refused_type = Refused

        def __init__(self) -> None:
            # No protocol allowed for the inherited opener; fetch() below never calls it anyway.
            super().__init__(allowed_protocols=(), fail_on_errors=True)
            self.refusals: list[str] = []  # reason codes, in order

        def fetch(self, url: str, headers: Any = None) -> Any:
            try:
                resource = resolver.resolve(url)
            except ResourceRefused as refusal:
                self.refusals.append(refusal.code)
                raise Refused(refusal) from None
            return URLFetcherResponse(url, body=resource.body, headers={"Content-Type": resource.media_type})

        def open(self, url: Any, data: Any = None, timeout: Any = None) -> Any:
            return self.fetch(url if isinstance(url, str) else url.full_url)

    return OfflineFetcher()
