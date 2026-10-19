"""The print fonts: the one font directory, its integrity check and the character-map check of a document's text.

docs/specs/modules/platform-docs.md §1 (print fonts: one copy, in the platform-docs module), §7.5 (hermetic
fonts), §9 (families and roles), and rule R7 of §3.2 applied to all text. The font directory is
``backend/modules/platform-docs/src/main/resources/hms/platform/docs/fonts/``; ``fonts.json`` there pins each file
by SHA-256. Before any render every font file is hashed and compared with ``fonts.json`` (a mismatch, a missing
file or a missing entry refuses), and every character of the document's text must be in the union of the four
fonts' character maps (an uncovered character refuses), so no fallback font can stand in for a missing glyph.

The verified bytes are kept in memory and served to WeasyPrint from there (``fetcher``), so a file changed after
the check cannot reach the PDF.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable, Mapping

SATELLITE_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = SATELLITE_DIR.parents[2]
DEFAULT_FONT_DIR = REPO_DIR / "backend" / "modules" / "platform-docs" / "src" / "main" / "resources" / "hms" / "platform" / "docs" / "fonts"
FONT_DIR_ENV = "HMS_DOCRENDER_FONT_DIR"
FONTS_JSON = "fonts.json"

# hms-font: name -> file in the font directory (the module's PrintFont enum: infrastructure/fonts/PrintFonts.kt).
FONT_FILES: Mapping[str, str] = {
    "noto-sans-arabic-regular": "NotoSansArabic-Regular.ttf",
    "noto-sans-arabic-bold": "NotoSansArabic-Bold.ttf",
    "noto-sans-regular": "NotoSans-Regular.ttf",
    "noto-sans-bold": "NotoSans-Bold.ttf",
}

ZWNJ, ZWJ, ZWSP = "\u200c", "\u200d", "\u200b"
# Format characters R7 allows (§3.2): they join or break, they never reorder. Shaping consumes them, so they
# need no glyph of their own.
ALLOWED_FORMAT = frozenset({ZWNJ, ZWJ, ZWSP})
# HTML whitespace other than U+0020: collapsed by the layout, never drawn.
HTML_SPACE = frozenset("\t\n\r\f")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class FontIntegrityError(Exception):
    """The font directory does not match fonts.json (a refusal: the render does not run)."""


class UnrenderableText(Exception):
    """The document's text has characters the print fonts cannot draw or that R7 refuses. Never carries the text."""


def font_dir_default() -> Path:
    """The font directory: ``HMS_DOCRENDER_FONT_DIR`` if set (the container sets it), else the module's directory."""
    override = os.environ.get(FONT_DIR_ENV)
    return Path(override) if override else DEFAULT_FONT_DIR


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class PrintFont:
    name: str  # the hms-font: name
    file: str
    sha256: str
    data: bytes
    postscript_name: str
    version: str
    cmap: frozenset[int]


def read_pins(font_dir: Path) -> dict[str, str]:
    """file name -> SHA-256 from fonts.json, for the four print fonts.

    Accepted shapes: ``{"fonts": [{"file": ..., "sha256": ...}, ...]}`` or a bare list of such objects; the file
    key may also be ``fileName``. Other keys (version, licence) are ignored here. Every one of the four files must
    appear exactly once with a lower-case hex SHA-256, or the font directory is refused.
    """
    path = font_dir / FONTS_JSON
    if not path.is_file():
        raise FontIntegrityError(f"{path} is missing")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise FontIntegrityError(f"{path} cannot be read as JSON: {exc}") from None
    entries = data.get("fonts") if isinstance(data, dict) else data
    if not isinstance(entries, list):
        raise FontIntegrityError(f"{path}: expected a 'fonts' list")
    pins: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise FontIntegrityError(f"{path}: every font entry must be an object")
        file = entry.get("file", entry.get("fileName"))
        digest = entry.get("sha256")
        if file not in FONT_FILES.values():
            continue  # not one of the print fonts; never served
        if file in pins:
            raise FontIntegrityError(f"{path}: {file} is listed twice")
        if not isinstance(digest, str) or not _SHA256.match(digest):
            raise FontIntegrityError(f"{path}: {file} has no valid lower-case hex sha256")
        pins[file] = digest
    missing = sorted(set(FONT_FILES.values()) - set(pins))
    if missing:
        raise FontIntegrityError(f"{path}: no entry for {', '.join(missing)}")
    return pins


class FontSet:
    """The four print fonts, verified against fonts.json, with their bytes and character maps."""

    def __init__(self, font_dir: Path, fonts: Mapping[str, PrintFont]):
        self.dir = font_dir
        self.fonts = dict(fonts)
        self.coverage: frozenset[int] = frozenset().union(*(f.cmap for f in self.fonts.values()))

    @classmethod
    def load(cls, font_dir: Path | None = None) -> "FontSet":
        from fontTools.ttLib import TTFont  # fontTools is pinned in requirements.txt

        font_dir = Path(font_dir) if font_dir is not None else font_dir_default()
        pins = read_pins(font_dir)
        fonts: dict[str, PrintFont] = {}
        for name, file in FONT_FILES.items():
            path = font_dir / file
            if not path.is_file():
                raise FontIntegrityError(f"{path} is missing")
            data = path.read_bytes()
            digest = sha256_hex(data)
            if digest != pins[file]:
                raise FontIntegrityError(f"{file}: SHA-256 {digest} does not match fonts.json ({pins[file]})")
            try:
                font = TTFont(io.BytesIO(data), lazy=True)
                cmap = frozenset(font.getBestCmap() or {})
                names = font["name"]
                postscript = names.getDebugName(6) or ""
                version = names.getDebugName(5) or ""
            except Exception as exc:  # a file that matches its pin but is not a font is still refused
                raise FontIntegrityError(f"{file}: not a readable TrueType font ({type(exc).__name__})") from None
            if not cmap:
                raise FontIntegrityError(f"{file}: has no Unicode character map")
            fonts[name] = PrintFont(name, file, digest, data, postscript, version, cmap)
        return cls(font_dir, fonts)

    def sha256s(self) -> dict[str, str]:
        return {font.file: font.sha256 for font in self.fonts.values()}

    def bytes_by_name(self) -> dict[str, bytes]:
        return {name: font.data for name, font in self.fonts.items()}

    def check_text(self, html: str) -> None:
        """Refuse the document unless every character of its text passes R7 and is in a print font's cmap."""
        check_characters(document_text(html), self.coverage)


# ------------------------------------------------------------------------------------------- text extraction

# Elements whose text is never laid out. <head> is not listed: its end tag may be omitted, and a missed
# </head> must never hide body text from the check (text in <head> itself is only whitespace).
_NOT_RENDERED = frozenset({"title", "style", "script", "template"})
_VOID = frozenset({"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"})
_CSS_CONTENT = re.compile(r"content\s*:\s*([^;}]*)", re.IGNORECASE)
_CSS_STRING = re.compile(r'"((?:\\.|[^"\\])*)"|\'((?:\\.|[^\'\\])*)\'', re.DOTALL)
_CSS_ESCAPE = re.compile(r"\\([0-9a-fA-F]{1,6})[ \t\r\n\f]?|\\(.)", re.DOTALL)


def _css_unescape(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        if match.group(1):
            code = int(match.group(1), 16)
            return chr(code) if 0 < code <= 0x10FFFF and not 0xD800 <= code <= 0xDFFF else "\ufffd"
        return "" if match.group(2) == "\n" else match.group(2)

    return _CSS_ESCAPE.sub(repl, text)


def css_content_strings(css: str) -> list[str]:
    """The strings of every ``content:`` declaration (generated text the layout draws)."""
    found = []
    for declaration in _CSS_CONTENT.finditer(css):
        for match in _CSS_STRING.finditer(declaration.group(1)):
            found.append(_css_unescape(match.group(1) if match.group(1) is not None else match.group(2)))
    return found


class _TextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.texts: list[str] = []
        self.styles: list[str] = []
        self._stack: list[str] = []
        self._in_style = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name == "style" and value:
                self.styles.append(value)
        if tag in _VOID:
            return
        self._stack.append(tag)
        if tag == "style":
            self._in_style += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name == "style" and value:
                self.styles.append(value)

    def handle_endtag(self, tag: str) -> None:
        if tag in _VOID or tag not in self._stack:
            return
        while self._stack:
            top = self._stack.pop()
            if top == "style":
                self._in_style -= 1
            if top == tag:
                break

    def handle_data(self, data: str) -> None:
        if self._in_style:
            self.styles.append(data)
        elif not any(tag in _NOT_RENDERED for tag in self._stack):
            self.texts.append(data)


def document_text(html: str) -> list[str]:
    """The text a layout of ``html`` can draw: body text nodes and CSS ``content`` strings."""
    collector = _TextCollector()
    collector.feed(html)
    collector.close()
    texts = list(collector.texts)
    for css in collector.styles:
        texts.extend(css_content_strings(css))
    return texts


def check_characters(texts: Iterable[str], coverage: frozenset[int]) -> None:
    """R7 for all text (§3.2, §7.5). The refusal names categories and counts, never the text (§3.2)."""
    problems: Counter[str] = Counter()
    for text in texts:
        if not unicodedata.is_normalized("NFC", text):
            problems["text not in Unicode NFC"] += 1
        for char in text:
            if char in HTML_SPACE or char in ALLOWED_FORMAT:
                continue
            category = unicodedata.category(char)
            if category == "Cs":
                problems["unpaired surrogate (Cs)"] += 1
            elif category == "Cc":
                problems["control character (Cc)"] += 1
            elif category == "Cf":
                problems["format character (Cf) other than ZWNJ, ZWJ or ZWSP"] += 1
            elif ord(char) not in coverage:
                problems[f"character not in the print fonts' character maps ({category})"] += 1
    if problems:
        detail = "; ".join(f"{reason}: {count}" for reason, count in sorted(problems.items()))
        raise UnrenderableText(f"refused text (R7): {detail}")
