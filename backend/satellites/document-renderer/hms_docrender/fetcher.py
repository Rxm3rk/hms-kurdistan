"""The offline resource fetcher (docs/specs/modules/platform-docs.md §7.4 resources, §7.5 offline only; HAZ-0047).

Exactly two kinds of URL resolve:

- ``hms-font:<name>``, where ``<name>`` is one of the four print-font names; the bytes are the ones the font check
  verified against ``fonts.json`` (``fonts.FontSet``), never re-read from disk;
- ``data:`` URLs (inline images and barcodes).

Everything else is refused by raising: ``http:``, ``https:``, ``file:``, ``ftp:``, relative references, any other
scheme, and any ``hms-font:`` value that is not exactly a known name (so no path, ``..``, percent-encoding, query or
fragment can reach a file). In WeasyPrint the refusal is a ``FatalURLFetchingError``, which stops the render, so a
refused fetch always fails the render instead of leaving a gap in the PDF.

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


class ResourceRefused(Exception):
    """A URL the offline fetcher does not serve. The message names the scheme and the reason."""


@dataclass(frozen=True)
class Resource:
    body: bytes
    media_type: str


def _describe(url: str) -> str:
    """A short, safe description of a refused URL for messages (data: URLs are never echoed)."""
    if url[:5].lower() == "data:":
        return "data: URL"
    return repr(url if len(url) <= 120 else url[:117] + "...")


class OfflineResolver:
    """Resolves ``hms-font:`` names and ``data:`` URLs; refuses everything else."""

    def __init__(self, fonts: Mapping[str, bytes]):
        self._fonts = dict(fonts)
        self.served: list[str] = []  # what was served, for tests and diagnostics (scheme:name, never data)

    def resolve(self, url: str) -> Resource:
        if not isinstance(url, str) or not url:
            raise ResourceRefused("refused an empty or non-text URL")
        match = _SCHEME.match(url)
        if match is None:
            raise ResourceRefused(f"refused a relative reference {_describe(url)}: only hms-font: and data: URLs resolve")
        scheme = match.group(1).lower()
        rest = url[match.end():]
        if scheme == "hms-font":
            return self._font(rest, url)
        if scheme == "data":
            return self._data(rest)
        raise ResourceRefused(f"refused the {scheme}: URL {_describe(url)}: only hms-font: and data: URLs resolve (offline renderer)")

    def _font(self, name: str, url: str) -> Resource:
        if not _FONT_NAME.match(name):
            raise ResourceRefused(f"refused {_describe(url)}: an hms-font: value must be exactly a print-font name")
        if name not in self._fonts:
            raise ResourceRefused(f"refused {_describe(url)}: not a print-font name ({', '.join(sorted(self._fonts))})")
        self.served.append(f"hms-font:{name}")
        return Resource(self._fonts[name], FONT_MEDIA_TYPE)

    def _data(self, rest: str) -> Resource:
        header, comma, payload = rest.partition(",")
        if not comma:
            raise ResourceRefused("refused a data: URL without a comma")
        params = header.split(";")
        is_base64 = params[-1].strip().lower() == "base64"
        if is_base64:
            params = params[:-1]
        media_type = params[0].strip() or "text/plain"
        if not _MEDIA_TYPE.match(media_type):
            raise ResourceRefused("refused a data: URL with a malformed media type")
        raw = unquote_to_bytes(payload)
        if is_base64:
            try:
                body = base64.b64decode(b"".join(raw.split()), validate=True)
            except (binascii.Error, ValueError):
                raise ResourceRefused("refused a data: URL with invalid base64") from None
        else:
            body = raw
        if len(body) > MAX_DATA_URL_BYTES:
            raise ResourceRefused(f"refused a data: URL larger than {MAX_DATA_URL_BYTES} bytes")
        self.served.append(f"data:{media_type.lower()}")
        return Resource(body, media_type.lower())


def weasyprint_fetcher(resolver: OfflineResolver) -> Any:
    """A WeasyPrint URL fetcher that serves only what ``resolver`` resolves; every refusal is fatal."""
    from weasyprint.urls import FatalURLFetchingError, URLFetcher, URLFetcherResponse

    class Refused(FatalURLFetchingError):
        """A refused fetch; fatal, so it stops the render (WeasyPrint swallows ordinary exceptions)."""

        def __init__(self, refusal: ResourceRefused):
            super().__init__(str(refusal))
            self.refusal = refusal

    class OfflineFetcher(URLFetcher):
        refused_type = Refused

        def __init__(self) -> None:
            # No protocol allowed for the inherited opener; fetch() below never calls it anyway.
            super().__init__(allowed_protocols=(), fail_on_errors=True)
            self.refusals: list[str] = []

        def fetch(self, url: str, headers: Any = None) -> Any:
            try:
                resource = resolver.resolve(url)
            except ResourceRefused as refusal:
                self.refusals.append(str(refusal))
                raise Refused(refusal) from None
            return URLFetcherResponse(url, body=resource.body, headers={"Content-Type": resource.media_type})

        def open(self, url: Any, data: Any = None, timeout: Any = None) -> Any:
            return self.fetch(url if isinstance(url, str) else url.full_url)

    return OfflineFetcher()
