"""The library entry point: one request in, one PDF/A-2b out (docs/specs/modules/platform-docs.md §7.5).

Order of a render, each step failing closed:

1. the runtime is located and the font directory is verified against ``fonts.json`` and the satellite's pins
   (``FontIntegrityError``);
2. every character of the document's HTML text is checked against R7, R8 and the fonts' character maps;
3. WeasyPrint is imported in the hermetic environment (``env``) and the renderer identity computed;
4. inside a socket guard that makes Python-level socket creation, connect, bind, listen, send, and name lookups
   raise, the HTML is parsed with the offline fetcher, the parsed tree is linted (``checks.lint_document``: no
   ``<bdo>``, no bidi override, no attachment), laid out with a font configuration that loads only ``hms-font:``
   sources, every laid-out text box is checked (R7, R8, missing glyphs, each glyph's font in its element's chain),
   and the PDF/A-2b is written while every drawn line is checked again (``checks.TextAudit``); a refused fetch, a
   network attempt (even one WeasyPrint would have swallowed), a WeasyPrint ``.notdef`` warning or error-level
   message, or an attachment in the written PDF fails the render;
5. the title, language, creation and modification dates come from the request, never from the HTML or the
   clock, so the same request on the same identity gives the same bytes (``UnitTest:pdf-deterministic``).

Every refusal and failure carries a stable code (the result schema's ``code``) and a detail made only of fixed
reason codes, counts, file names and library messages about the runtime: never the document's text, a URL or a
WeasyPrint message (they quote URLs and characters of the document; SI-20).

The socket guard covers Python code only; native libraries are not covered. The real control is the container's
network: it runs with no network at all (``--network none``, Dockerfile; §7.5 "no egress").
"""

from __future__ import annotations

import hashlib
import logging
import socket
import threading
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from . import checks
from . import identity as identity_module
from .contract import PDF_VARIANT, RenderRequest
from .env import EnvironmentRefused, Runtime, RuntimeMissing, import_weasyprint, load_runtime
from .fetcher import OfflineResolver, ResourceRefused, weasyprint_fetcher
from .fonts import (
    R7_UNKNOWN_GLYPH, FontIntegrityError, FontSet, UnrenderableText, describe_problems,
)

# Relative references are joined to this base; urljoin leaves them relative under an unknown scheme, so they
# reach the fetcher and are refused there instead of being dropped with a log message.
BASE_URL = "hms-document:/"

# WeasyPrint log messages (matched on the message template, never the formatted text) and their reason codes.
# The .notdef warning is a missing glyph (R7): a refusal, "unrenderable-text". The others below ERROR still mean
# the PDF would not be what the HTML asked for, so they fail the render like every error-level message.
_NOTDEF = ".notdef glyph rendered"
_FATAL_TEMPLATES = (
    ("cannot be loaded", "font-face-load-failed"),
    ("Failed to load image", "image-load-failed"),
    ("Failed to load inline SVG", "svg-load-failed"),
    ("Failed to load stylesheet", "stylesheet-load-failed"),
    ("Failed to load attachment", "attachment-load-failed"),
    ("Missing href in <link rel=\"attachment\">", "attachment-load-failed"),
    ("Failed to render", "svg-render-failed"),
    ("Failed to load", "load-failed"),
)


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
    """While active, socket creation and every socket connect, bind, listen, send and name lookup raise.

    The renderer never needs the network (§3.7, HAZ-0047); this guard is the second line behind the fetcher. Each
    attempt is recorded in ``attempts`` (the call name only) before raising, so an attempt that some library caught
    still fails the render. It patches the ``socket`` module, ``socket.socket`` and the ``_socket`` C module's
    functions, so it covers Python code only: a native library that opens a socket itself is not seen. The real
    control is the container's network (``--network none``, §7.5 "no egress").
    """

    _SOCKET_METHODS = ("__init__", "connect", "connect_ex", "bind", "listen", "sendto", "sendmsg", "sendmsg_afalg")
    _MODULE_FUNCTIONS = ("getaddrinfo", "getnameinfo", "gethostbyname", "gethostbyname_ex", "gethostbyaddr",
                         "create_connection", "create_server", "socketpair", "fromfd", "fromshare")
    _C_FUNCTIONS = ("socket", "SocketType", "getaddrinfo", "getnameinfo", "gethostbyname", "gethostbyname_ex",
                    "gethostbyaddr", "socketpair", "dup")

    def __init__(self) -> None:
        self.attempts: list[str] = []
        self._saved: list[tuple[Any, str, Any, bool]] = []

    def _refuse(self, name: str) -> Callable[..., Any]:
        def refuse(*args: Any, **kwargs: Any) -> Any:
            self.attempts.append(name)
            raise NetworkRefused(f"network access attempted during a render ({name})")

        return refuse

    def __enter__(self) -> "SocketGuard":
        import _socket

        targets = ((socket.socket, "socket.socket.", self._SOCKET_METHODS), (socket, "socket.", self._MODULE_FUNCTIONS),
                   (_socket, "_socket.", self._C_FUNCTIONS))
        for owner, prefix, names in targets:
            for name in names:
                if hasattr(owner, name):
                    self._saved.append((owner, name, getattr(owner, name), name in vars(owner)))
                    setattr(owner, name, self._refuse(prefix + name))
        return self

    def __exit__(self, *exc: Any) -> None:
        for owner, name, original, own in reversed(self._saved):
            if own:
                setattr(owner, name, original)
            else:
                delattr(owner, name)  # inherited (a method of _socket.socket): remove the shadowing attribute
        self._saved.clear()


class _Collect(logging.Handler):
    """Collects the reason codes of WeasyPrint's fatal log messages; never their text (it quotes the document)."""

    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.notdef = 0
        self.fatal: Counter[str] = Counter()

    def emit(self, record: logging.LogRecord) -> None:
        template = record.msg if isinstance(record.msg, str) else ""
        if _NOTDEF in template:
            self.notdef += 1
            return
        code = next((code for marker, code in _FATAL_TEMPLATES if marker in template), None)
        if code is None and record.levelno >= logging.ERROR:
            code = "weasyprint-error"
        if code is not None:
            self.fatal[code] += 1


_lock = threading.Lock()


def _counts(counter: Counter[str]) -> str:
    return ", ".join(f"{code}={count}" for code, count in sorted(counter.items()))


def render(request: RenderRequest, *, font_dir: Path | None = None, runtime: Runtime | None = None) -> RenderResult:
    """Render one request. Raises RenderRefused or RenderFailed; never returns a partial PDF."""
    if request.pdf_variant != PDF_VARIANT:
        raise RenderRefused("render-error", "pdf-variant-not-offered")
    with _lock:
        try:
            runtime = runtime or load_runtime()
        except (RuntimeMissing, OSError, ValueError) as exc:
            raise RenderFailed("runtime-error", f"runtime-unavailable: {type(exc).__name__}: {exc}") from None
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
    from weasyprint.urls import FatalURLFetchingError

    resolver = OfflineResolver(fonts.bytes_by_name())
    fetcher = weasyprint_fetcher(resolver)
    collector = _Collect()
    logger = logging.getLogger("weasyprint")
    logger.addHandler(collector)
    audit = checks.TextAudit(fonts.coverage)
    guard = SocketGuard()
    try:
        with guard:
            html = weasyprint.HTML(string=request.html, base_url=BASE_URL, url_fetcher=fetcher)
            text_problems, resources = checks.lint_document(request.html, html.etree_element)
            if resources:
                raise RenderRefused("resource-refused", _counts(resources))
            if text_problems:
                raise RenderRefused("unrenderable-text", describe_problems("document", text_problems))
            document = html.render(pdf_variant=PDF_VARIANT, font_config=checks.pinned_font_configuration())
            _raise_collected(guard, fetcher, collector)
            laid_out = audit.check_layout(document)
            if laid_out:
                raise RenderRefused("unrenderable-text", describe_problems("layout", laid_out))
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
            with audit.draw_hook():
                pdf = document.write_pdf(pdf_variant=PDF_VARIANT)
            page_count = len(document.pages)
    except (RenderRefused, RenderFailed):
        raise
    except NetworkRefused:
        raise RenderRefused("network-attempt", _counts(Counter(guard.attempts)) or "socket") from None
    except checks.FontSourceRefused as exc:
        raise RenderRefused("resource-refused", exc.code) from None
    except fetcher.refused_type as exc:
        raise RenderRefused("resource-refused", exc.refusal.code) from None
    except ResourceRefused as exc:  # defensive: a refusal raised outside the fetcher adapter
        raise RenderRefused("resource-refused", exc.code) from None
    except FatalURLFetchingError:  # the fetcher failed for a reason other than a refusal (fail_on_errors)
        raise RenderFailed("render-error", "fetch-failed") from None
    except Exception as exc:
        raise RenderFailed("render-error", f"exception: {type(exc).__name__}") from None
    finally:
        logger.removeHandler(collector)
    _raise_collected(guard, fetcher, collector)
    drawn = audit.problems["draw"]
    if drawn:
        raise RenderRefused("unrenderable-text", describe_problems("draw", drawn))
    if not pdf.startswith(b"%PDF-") or page_count < 1:
        raise RenderFailed("render-error", "no-pdf-pages")
    markers = checks.pdf_attachment_markers(pdf)
    if markers:
        raise RenderFailed("render-error", "pdf-has-attachment: " + ", ".join(markers))
    return RenderResult(pdf, hashlib.sha256(pdf).hexdigest(), page_count, identity.text, identity.hash)


def _raise_collected(guard: SocketGuard, fetcher: Any, collector: _Collect) -> None:
    """Raise for what was recorded but possibly swallowed: a network attempt, a refused fetch, a fatal message."""
    if guard.attempts:
        raise RenderRefused("network-attempt", _counts(Counter(guard.attempts)))
    if fetcher.refusals:
        raise RenderRefused("resource-refused", fetcher.refusals[0])
    if collector.notdef:
        raise RenderRefused("unrenderable-text", describe_problems("draw", Counter({R7_UNKNOWN_GLYPH: collector.notdef})))
    if collector.fatal:
        raise RenderFailed("render-error", "weasyprint: " + _counts(collector.fatal))
