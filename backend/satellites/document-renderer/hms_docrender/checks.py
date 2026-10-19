"""Checks inside a render: the parsed document, every laid-out and drawn text run, the fonts, the PDF.

docs/specs/modules/platform-docs.md §3.2 R7 and R8 (for all text, §7.5), §7.4 (resources; no attachment), §7.5
(hermetic fonts, determinism, PDF/A-2b); HAZ-0047. The HTML-text check in ``fonts`` runs first, before WeasyPrint is
loaded, on what Python's ``html.parser`` sees. WeasyPrint parses the HTML its own way (tinyhtml5: ``<xmp>``,
``<plaintext>``) and draws text the HTML never spells out (``attr()``, counters, list markers in any counter style,
``<input value>``, SVG ``<text>`` inside ``data:`` images), so the checks are repeated where the text is final:

- ``lint_document``: the tree WeasyPrint parsed, before layout. ``<bdo>`` and the CSS values ``bidi-override``,
  ``isolate-override`` and ``unicode-bidi: plaintext`` are refused (R7: nothing may reorder a printed name; the
  module's ``HtmlLint`` refuses the same), and so is a ``rel`` naming ``attachment`` (WeasyPrint would embed the
  file, stamped with the clock time, which breaks determinism and PDF/A-2b).
- ``TextAudit.check_layout``: every text box of every laid-out page, including absolutely positioned ones, list
  markers and page-margin boxes: R7 (control, format, surrogate, NFC, a combining mark that starts a run, coverage)
  and R8 (Eastern digits), and the shaped glyphs: no missing glyph (Pango's unknown-glyph flag or glyph 0) and every
  glyph from a font in the element's own ``font-family`` chain (R7: "a glyph in its element's font chain"; a
  generic family such as ``serif`` names no print font, so it matches none).
- ``TextAudit.draw_hook``: the same over every line WeasyPrint draws, HTML and SVG text alike (both go through
  ``weasyprint.draw.text.draw_first_line``), so SVG text in images and an ellipsis are seen too.
- ``PinnedFontConfiguration``: an ``@font-face`` source that is not ``hms-font:`` (``data:``, ``local()``, anything
  else) is refused before any byte is fetched.
- ``pdf_attachment_markers``: the written PDF holds no file specification, embedded file or file attachment.

Refusals carry fixed reason codes and counts (``fonts.R7_*``, ``fonts.R8_*``), never document text.
"""

from __future__ import annotations

import re
import zlib
from collections import Counter
from contextlib import contextmanager
from typing import Any, Iterator

from .fonts import (
    R7_BIDI_MARKUP, R7_FONT_OUTSIDE_CHAIN, R7_UNKNOWN_GLYPH, character_problems,
)

# --------------------------------------------------------------------------------------------- the parsed document

ATTACHMENT_LINK = "attachment-link"
_BIDI_VALUES = frozenset({"bidi-override", "isolate-override", "plaintext"})
# The module HtmlLint's blunt pattern, applied to the whole HTML (text included).
_BIDI_TEXT = re.compile(r"bidi-override|isolate-override|unicode-bidi\s*:\s*plaintext", re.IGNORECASE)


def _local(tag: Any) -> str:
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def _declarations(tokens: Any) -> Iterator[Any]:
    """Every declaration in a block's content, recursing into nested rules (``@media``, ``@page`` margin rules)."""
    import tinycss2

    for item in tinycss2.parse_blocks_contents(tokens, skip_comments=True, skip_whitespace=True):
        if item.type == "declaration":
            yield item
        elif item.type in ("qualified-rule", "at-rule") and item.content is not None:
            yield from _declarations(item.content)


def _stylesheet_declarations(css: str) -> Iterator[Any]:
    import tinycss2

    for rule in tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True):
        if rule.type in ("qualified-rule", "at-rule") and rule.content is not None:
            yield from _declarations(rule.content)


def _reorders(declarations: Iterator[Any]) -> int:
    count = 0
    for declaration in declarations:
        if declaration.lower_name != "unicode-bidi":
            continue
        for token in declaration.value:
            if token.type == "ident" and token.lower_value in _BIDI_VALUES:
                count += 1
    return count


def lint_document(html_text: str, root: Any) -> tuple[Counter[str], Counter[str]]:
    """(R7 problems, refused resources) of the document WeasyPrint parsed (``root``: its ElementTree root)."""
    text_problems: Counter[str] = Counter()
    resources: Counter[str] = Counter()
    bidi = len(_BIDI_TEXT.findall(html_text))
    for element in root.iter():
        name = _local(element.tag)
        if name == "bdo":
            bidi += 1
        rel = element.get("rel")
        if rel and "attachment" in rel.lower().split():
            resources[ATTACHMENT_LINK] += 1
        style = element.get("style")
        if style:
            bidi += _reorders(_declarations(style))
        if (element.get("unicode-bidi") or "").strip().lower() in _BIDI_VALUES:
            bidi += 1  # an SVG presentation attribute
        if name == "style":
            bidi += _reorders(_stylesheet_declarations("".join(element.itertext())))
    if bidi:
        text_problems[R7_BIDI_MARKUP] += bidi
    return text_problems, resources


# --------------------------------------------------------------------------------------------- fonts


class FontSourceRefused(BaseException):
    """An ``@font-face`` source other than ``hms-font:``. A BaseException, so WeasyPrint cannot swallow it."""

    code = "font-source-not-pinned"


def pinned_font_configuration() -> Any:
    """A WeasyPrint font configuration that loads ``@font-face`` sources only from ``hms-font:`` URLs."""
    from weasyprint.text.fonts import FontConfiguration

    class PinnedFontConfiguration(FontConfiguration):
        def add_font_face(self, rule_descriptors: Any, url_fetcher: Any) -> Any:
            for font_type, url in rule_descriptors.get("src") or ():
                if font_type != "external" or not isinstance(url, str) or not url.lower().startswith("hms-font:"):
                    raise FontSourceRefused()
            return super().add_font_face(rule_descriptors, url_fetcher)

    return PinnedFontConfiguration()


# --------------------------------------------------------------------------------------------- text and glyphs

_GENERIC_FAMILIES = frozenset({"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "math", "emoji",
                               "fangsong", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded"})


class TextAudit:
    """Collects R7 and R8 problems of the text WeasyPrint lays out and draws (codes and counts only)."""

    def __init__(self, coverage: frozenset[int]):
        self.coverage = coverage
        self.problems: dict[str, Counter[str]] = {"layout": Counter(), "draw": Counter()}
        self.runs_checked = {"layout": 0, "draw": 0}

    def _check(self, stage: str, textbox: Any) -> None:
        problems = self.problems[stage]
        text = textbox.text if stage == "layout" else textbox.pango_layout.text
        if text:
            character_problems([text], self.coverage, problems)
        self._glyphs(textbox, problems)
        self.runs_checked[stage] += 1

    def _glyphs(self, textbox: Any, problems: Counter[str]) -> None:
        from weasyprint.text.ffi import ffi, pango

        chain = {name.casefold() for name in (textbox.style["font_family"] or ())} - _GENERIC_FAMILIES
        line, _ = textbox.pango_layout.get_first_line()
        run = line.runs[0] if line.runs != ffi.NULL else ffi.NULL
        while run != ffi.NULL:
            glyph_item = run.data
            run = run.next
            glyphs = glyph_item.glyphs
            for index in range(glyphs.num_glyphs):
                glyph = glyphs.glyphs[index].glyph
                if glyph == pango.PANGO_GLYPH_EMPTY:
                    continue  # a zero-width character shaping consumed (ZWNJ, ZWJ, ZWSP)
                if glyph == 0 or glyph & pango.PANGO_GLYPH_UNKNOWN_FLAG:
                    problems[R7_UNKNOWN_GLYPH] += 1
            font = glyph_item.item.analysis.font
            if font == ffi.NULL:
                problems[R7_FONT_OUTSIDE_CHAIN] += 1
                continue
            description = pango.pango_font_describe_with_absolute_size(font)
            try:
                family_pointer = pango.pango_font_description_get_family(description)
                family = ffi.string(family_pointer).decode("utf-8", "replace") if family_pointer != ffi.NULL else ""
            finally:
                pango.pango_font_description_free(description)
            if family.casefold() not in chain:
                problems[R7_FONT_OUTSIDE_CHAIN] += 1

    def check_layout(self, document: Any) -> Counter[str]:
        """R7 and R8 over every text box of every laid-out page (before anything is drawn)."""
        from weasyprint.formatting_structure.boxes import TextBox

        for page in document.pages:
            for box in page._page_box.descendants(placeholders=True):
                if not isinstance(box, TextBox):
                    continue
                layout = box.pango_layout
                layout.reactivate(box.style)
                try:
                    self._check("layout", box)
                finally:
                    layout.deactivate()
        return self.problems["layout"]

    @contextmanager
    def draw_hook(self) -> Iterator["TextAudit"]:
        """While active, every line WeasyPrint draws (HTML and SVG text) is checked right after it is drawn."""
        import weasyprint.draw.text as draw_text

        original = draw_text.draw_first_line

        def draw_first_line(stream: Any, textbox: Any, *args: Any, **kwargs: Any) -> Any:
            emojis = original(stream, textbox, *args, **kwargs)
            self._check("draw", textbox)
            return emojis

        draw_text.draw_first_line = draw_first_line
        try:
            yield self
        finally:
            draw_text.draw_first_line = original


# --------------------------------------------------------------------------------------------- the PDF

ATTACHMENT_MARKERS = (b"/Filespec", b"/EmbeddedFile", b"/FileAttachment")


def pdf_objects(pdf: bytes) -> bytes:
    """The PDF's bytes plus every Flate stream decompressed (object streams hold most dictionaries)."""
    parts = [pdf]
    for match in re.finditer(rb"stream\r?\n", pdf):
        start = match.end()
        end = pdf.find(b"endstream", start)
        if end < 0:
            break
        try:
            parts.append(zlib.decompress(pdf[start:end]))
        except zlib.error:
            continue
    return b"\n".join(parts)


def pdf_attachment_markers(pdf: bytes) -> list[str]:
    """The attachment markers (``/Filespec``, ``/EmbeddedFile``, ``/FileAttachment``) found in the PDF."""
    objects = pdf_objects(pdf)
    return [marker.decode("ascii") for marker in ATTACHMENT_MARKERS if marker in objects]
