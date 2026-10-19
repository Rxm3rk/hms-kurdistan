"""The library entry point: one request in, one PDF/A-2b out (docs/specs/modules/platform-docs.md §7.5).

Order of a render, each step failing closed:

1. the runtime is located and the font directory is verified against ``fonts.json`` (``FontIntegrityError``);
2. every character of the document's text is checked against R7 and the fonts' character maps;
3. WeasyPrint is imported in the hermetic environment (``env``) and the renderer identity computed;
4. the HTML is laid out and written as PDF/A-2b with the offline fetcher, inside a socket guard that makes any
   connect, bind, listen or name lookup raise; a refused fetch, a network attempt (even one WeasyPrint would
   have swallowed), or a WeasyPrint error-level message fails the render;
5. the title, language, creation and modification dates come from the request, never from the HTML or the
   clock, so the same request on the same identity gives the same bytes (``UnitTest:pdf-deterministic``).
"""

from __future__ import annotations

import hashlib
import logging
import socket
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .contract import PDF_VARIANT, RenderRequest
from .env import EnvironmentRefused, Runtime, RuntimeMissing, import_weasyprint, load_runtime
from .fetcher import OfflineResolver, ResourceRefused, weasyprint_fetcher
from .fonts import FontIntegrityError, FontSet, UnrenderableText
from . import identity as identity_module

# Relative references are joined to this base; urljoin leaves them relative under an unknown scheme, so they
# reach the fetcher and are refused there instead of being dropped with a log message.
BASE_URL = "hms-document:/"

# WeasyPrint messages below ERROR that still mean the PDF would not be what the HTML asked for.
_FATAL_WARNINGS = ("cannot be loaded", "Failed to load", "Failed to render")


@dataclass(frozen=True)
class RenderResult:
    pdf: bytes
    sha256: str
    page_count: int
    renderer_identity: str
    identity_hash: str


class RenderRefused(Exception):
    """The render was refused before or during layout. ``code`` is one of the contract's refusal codes."""

    def __init__(self, code: str, detail: str):
        super().__init__(f"{code}: {detail}")
        self.code = code
        self.detail = detail


class RenderFailed(Exception):
    """The render could not run or WeasyPrint failed. ``code`` is ``render-error`` or ``runtime-error``."""

    def __init__(self, code: str, detail: str):
        super().__init__(f"{code}: {detail}")
        self.code = code
        self.detail = detail


class NetworkRefused(BaseException):
    """Raised by the socket guard. A BaseException, so WeasyPrint's ``except Exception`` cannot swallow it."""


class SocketGuard:
    """While active, every socket connect, bind, listen, send-to and name lookup in Python code raises.

    The renderer never needs the network (§3.7, HAZ-0047); this guard is the second line behind the fetcher. Each
    attempt is recorded in ``attempts`` (the call name only) before raising, so an attempt that some library caught
    still fails the render.
    """

    _SOCKET_METHODS = ("connect", "connect_ex", "bind", "listen", "sendto")
    _MODULE_FUNCTIONS = ("getaddrinfo", "gethostbyname", "gethostbyname_ex", "gethostbyaddr", "create_connection", "create_server")

    def __init__(self) -> None:
        self.attempts: list[str] = []
        self._saved: list[tuple[Any, str, Any]] = []

    def _refuse(self, name: str) -> Callable[..., Any]:
        def refuse(*args: Any, **kwargs: Any) -> Any:
            self.attempts.append(name)
            raise NetworkRefused(f"network access attempted during a render ({name})")

        return refuse

    def __enter__(self) -> "SocketGuard":
        for owner, names in ((socket.socket, self._SOCKET_METHODS), (socket, self._MODULE_FUNCTIONS)):
            for name in names:
                self._saved.append((owner, name, getattr(owner, name)))
                setattr(owner, name, self._refuse(f"socket.{name}"))
        return self

    def __exit__(self, *exc: Any) -> None:
        for owner, name, original in reversed(self._saved):
            setattr(owner, name, original)
        self._saved.clear()


class _Collect(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.fatal: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        if record.levelno >= logging.ERROR or any(marker in message for marker in _FATAL_WARNINGS):
            self.fatal.append(f"{record.levelname}: {message}"[:300])


_lock = threading.Lock()


def render(request: RenderRequest, *, font_dir: Path | None = None, runtime: Runtime | None = None) -> RenderResult:
    """Render one request. Raises RenderRefused or RenderFailed; never returns a partial PDF."""
    if request.pdf_variant != PDF_VARIANT:
        raise RenderRefused("render-error", f"only {PDF_VARIANT} is rendered")
    with _lock:
        try:
            runtime = runtime or load_runtime()
        except RuntimeMissing as exc:
            raise RenderFailed("runtime-error", str(exc)) from None
        try:
            fonts = FontSet.load(font_dir)
        except FontIntegrityError as exc:
            raise RenderRefused("font-integrity", str(exc)) from None
        try:
            fonts.check_text(request.html)
        except UnrenderableText as exc:
            raise RenderRefused("unrenderable-text", str(exc)) from None
        try:
            weasyprint = import_weasyprint(runtime)
            identity = identity_module.compute(runtime, fonts)
        except EnvironmentRefused as exc:
            raise RenderFailed("runtime-error", str(exc)) from None
        return _render(weasyprint, request, fonts, identity)


def _render(weasyprint: Any, request: RenderRequest, fonts: FontSet, identity: identity_module.Identity) -> RenderResult:
    resolver = OfflineResolver(fonts.bytes_by_name())
    fetcher = weasyprint_fetcher(resolver)
    collector = _Collect()
    logger = logging.getLogger("weasyprint")
    logger.addHandler(collector)
    guard = SocketGuard()
    try:
        with guard:
            html = weasyprint.HTML(string=request.html, base_url=BASE_URL, url_fetcher=fetcher)
            document = html.render(pdf_variant=PDF_VARIANT)
            metadata = document.metadata
            metadata.title = request.title
            metadata.created = request.created_at
            metadata.modified = request.created_at
            metadata.lang = request.language
            metadata.keywords = [
                f"hms-template-id:{request.template_id}",
                f"hms-template-version:{request.template_version}",
                f"hms-template-sha256:{request.template_content_hash}",
                f"hms-provenance:{request.provenance}",
            ]
            metadata.attachments = []
            pdf = document.write_pdf(pdf_variant=PDF_VARIANT)
            page_count = len(document.pages)
    except NetworkRefused as exc:
        raise RenderRefused("network-attempt", str(exc)) from None
    except fetcher.refused_type as exc:
        raise RenderRefused("resource-refused", str(exc.refusal)) from None
    except ResourceRefused as exc:  # defensive: a refusal raised outside the fetcher adapter
        raise RenderRefused("resource-refused", str(exc)) from None
    except Exception as exc:
        raise RenderFailed("render-error", f"{type(exc).__name__}: {exc}"[:500]) from None
    finally:
        logger.removeHandler(collector)
    if guard.attempts:
        raise RenderRefused("network-attempt", f"network access attempted during the render: {', '.join(guard.attempts)}")
    if fetcher.refusals:
        raise RenderRefused("resource-refused", fetcher.refusals[0])
    if collector.fatal:
        raise RenderFailed("render-error", "; ".join(collector.fatal[:5]))
    if not pdf.startswith(b"%PDF-") or page_count < 1:
        raise RenderFailed("render-error", "WeasyPrint returned no PDF pages")
    return RenderResult(pdf, hashlib.sha256(pdf).hexdigest(), page_count, identity.text, identity.hash)
