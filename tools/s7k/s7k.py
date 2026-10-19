"""The S7-K printer test kit (BUILD-PROMPT.md §11.1, §12.8, §18.9; docs/specs/modules/platform-docs.md §11).

Spike S7-K tests printing and script shaping on the target printers and produces the Kurdistan Supported
Hardware List. This script makes the printer-independent test files, sends raw files to a printer on the
local network, writes the blank result form and checks a filled one. The protocol is tools/s7k/README.md.
Every printed text is synthetic, NOT FOR CLINICAL USE (§18.10).

Standard library only, except ``check-form``, which imports PyYAML and jsonschema from the project venv
inside that subcommand. Nothing here talks to an online service (§3.7): ``send`` refuses any host that does
not resolve only to loopback or private addresses (platform-docs.md §11).

Run: ``.tools/venv/Scripts/python.exe -I tools/s7k/s7k.py <list|send|font-download|patterns|form|check-form>``
(on Linux ``.tools/venv/bin/python``).
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import html
import ipaddress
import json
import math
import re
import socket
import struct
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Optional, Sequence

KIT_VERSION = "0.2.0"
NOTICE = "SYNTHETIC - NOT FOR CLINICAL USE"
FORM_ID = "hms-s7k-result-form/1"
KIT_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = KIT_DIR / "result-form.schema.json"
DEFAULT_PORT = 9100

# Dots per millimetre for the three printer resolutions (platform-docs.md §5.4).
DOTS_PER_MM = {203: 8, 300: 12, 600: 24}
DEFAULT_WIDTH_MM = 101.6  # a 4-inch label
DEFAULT_LENGTH_MM = 152.4  # a 6-inch label
MIN_WIDTH_MM = 20.0  # a wristband printer prints about 25 mm wide
MIN_LENGTH_MM = 50.0
MARGIN_MM = 3.0
NARROW_MARGIN_MM = 1.5  # below 40 mm of print width

# The engine's print fonts (backend/modules/platform-docs/src/main/resources/hms/platform/docs/fonts/,
# FONTS.md and fonts.json; platform-docs.md §7.1, §9): resident name, source file, SHA-256, version.
# A test checks this table against fonts.json.
FONT_DIR_IN_REPO = "backend/modules/platform-docs/src/main/resources/hms/platform/docs/fonts"
PRINT_FONTS: tuple[tuple[str, str, str, str], ...] = (
    ("E:NSARAB.TTF", "NotoSansArabic-Regular.ttf",
     "bdff3e5659d67e67def05b33f749683b9376ae819d65d3dd62ac4640b3aaef48", "2.013"),
    ("E:NSARABB.TTF", "NotoSansArabic-Bold.ttf",
     "4e5462d2e8be880317b9f49b5b2da109ddb6a3563d91cc604b67f3535832a555", "2.013"),
    ("E:NSLATN.TTF", "NotoSans-Regular.ttf",
     "478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823", "2.015"),
    ("E:NSLATNB.TTF", "NotoSans-Bold.ttf",
     "1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913", "2.015"),
)
DEFAULT_ARABIC_FONT = "E:NSARAB.TTF"
DEFAULT_ARABIC_BOLD_FONT = "E:NSARABB.TTF"
DEFAULT_LATIN_FONT = "E:NSLATN.TTF"
DEFAULT_LATIN_BOLD_FONT = "E:NSLATNB.TTF"
# Font files that reference.html loads from its own directory (copy them there; see the README).
REFERENCE_FONT_FILES = {"arabic": "NotoSansArabic-Regular.ttf", "arabic-bold": "NotoSansArabic-Bold.ttf",
                        "latin": "NotoSans-Regular.ttf", "latin-bold": "NotoSans-Bold.ttf"}

# Font metrics read from the pinned files with read_ttf_metrics (font units; a test re-reads the files).
# Noto Sans regular: units per em, hhea ascender and descender (as a positive depth), OS/2 cap height,
# and the advance widths of the characters the 100%-box and calibration rows use.
NOTO_SANS_UPEM = 1000
NOTO_SANS_ASCENDER = 1069
NOTO_SANS_DESCENDER = 293
NOTO_SANS_CAP_HEIGHT = 714
NOTO_SANS_ADVANCES = {
    " ": 260, "-": 322, "0": 572, "1": 572, "2": 572, "3": 572, "4": 572, "5": 572, "6": 572, "7": 572,
    "8": 572, "9": 572, "N": 760, "S": 549, "Y": 566, "H": 741, "É": 556, "g": 615, "x": 529,
}
# Noto Sans Arabic regular: hhea ascender and descender (its extent is about 2.11 em, platform-docs.md §5.3).
NOTO_ARABIC_ASCENDER = 1374
NOTO_ARABIC_DESCENDER = 738

# The legibility minimum for identity text (platform-docs.md §5.4, OQ-243 [P]; the CSO confirms, DN-069):
# Arabic script 8 pt at 8 dots/mm and 7 pt at 12 dots/mm or more; Latin 6 pt.
ARABIC_MIN_PT = {203: 8.0, 300: 7.0, 600: 7.0}
LATIN_MIN_PT = 6.0

SYN_NAME = "ئارام ڕێبوار"  # a synthetic Sorani name
SYN_NAME_LATIN = "Aram Rêbwar"  # its synthetic Latin form
SYN_MRN = "SYN-000123-7"
SYN_DATE = "2024-03-21"
# A synthetic digit-only identifier: it has no SYN- prefix on purpose, to test the digit-only MRN case
# (platform-docs.md §10). Every other identifier the kit prints starts with SYN-.
SYN_DIGITS = "0012345"
# The band serial is the print job id (platform-docs.md §6.1); a synthetic one of a job id's length
# (36 characters, the R4 alphabet A-Z a-z 0-9 -), so the symbol has the production size.
BAND_SERIAL = "SYN-J-019A3C000000700080000000000002"

# Payloads (platform-docs.md §6.1: printable ASCII, versioned, '|'-separated, no FNC1 or GS).
WRISTBAND_PAYLOAD = f"HMS1|M:{SYN_MRN}|E:SYN-E-000045|B:{BAND_SERIAL}"
SPECIMEN_PAYLOAD = f"HMS1|S:SYN-S-000077|M:{SYN_MRN}"
CODE128_PAYLOAD = "SYN-S-000077"
# The ^BX escape character, set explicitly as the engine does (the default is '~'). A payload must not contain it.
BX_ESCAPE = "_"

# Synthetic sample words that hold all ten Kurdish letters: پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە.
SAMPLE_WORDS = (
    "ژیان ڤەژین گوڵ "
    "چرۆ پێشڕەو"
)
BEH = "ب"  # the joining partner in the letter chart
ALEF = "ا"
LAM_V = "ڵ"  # LAM WITH SMALL V
ZWNJ = "‌"
ZWJ = "‍"
# The ten letters BUILD-PROMPT.md §4.1 and §11.1 name.
KURDISH_LETTERS = "پچژگڤڕڵۆێە"
# Lam with small v before alef (ڵا, بڵا) and synthetic sample words with it (ئاڵا, هەڵاڵە): the v mark
# must stay on the lam inside the lam-alef form.
LAM_V_ALEF_WORDS = (LAM_V + ALEF, BEH + LAM_V + ALEF, "ئاڵا",
                    "هەڵاڵە")
# The letters of transliterated Kurdish names in the Latin font (platform-docs.md §9).
LATIN_KURDISH_LETTERS = "çêîûşÇÊÎÛŞ"


@dataclass(frozen=True)
class Letter:
    """One Arabic-script letter. ``joining`` is its Unicode joining type (ArabicShaping.txt): D dual,
    R right, U non-joining. ``name`` is its Unicode name without "ARABIC LETTER "."""

    char: str
    name: str
    joining: str

    @property
    def kurdish(self) -> bool:
        return self.char in KURDISH_LETTERS


def _l(cp: int, name: str, joining: str) -> Letter:
    return Letter(chr(cp), name, joining)


# The Sorani alphabet in Arabic script, in alphabetical order.
SORANI_ALPHABET: tuple[Letter, ...] = (
    _l(0x0626, "YEH WITH HAMZA ABOVE", "D"),
    _l(0x0627, "ALEF", "R"),
    _l(0x0628, "BEH", "D"),
    _l(0x067E, "PEH", "D"),
    _l(0x062A, "TEH", "D"),
    _l(0x062C, "JEEM", "D"),
    _l(0x0686, "TCHEH", "D"),
    _l(0x062D, "HAH", "D"),
    _l(0x062E, "KHAH", "D"),
    _l(0x062F, "DAL", "R"),
    _l(0x0631, "REH", "R"),
    _l(0x0695, "REH WITH SMALL V BELOW", "R"),
    _l(0x0632, "ZAIN", "R"),
    _l(0x0698, "JEH", "R"),
    _l(0x0633, "SEEN", "D"),
    _l(0x0634, "SHEEN", "D"),
    _l(0x0639, "AIN", "D"),
    _l(0x063A, "GHAIN", "D"),
    _l(0x0641, "FEH", "D"),
    _l(0x06A4, "VEH", "D"),
    _l(0x0642, "QAF", "D"),
    _l(0x06A9, "KEHEH", "D"),
    _l(0x06AF, "GAF", "D"),
    _l(0x0644, "LAM", "D"),
    _l(0x06B5, "LAM WITH SMALL V", "D"),
    _l(0x0645, "MEEM", "D"),
    _l(0x0646, "NOON", "D"),
    _l(0x06BE, "HEH DOACHASHMEE", "D"),
    _l(0x06D5, "AE", "R"),
    _l(0x0648, "WAW", "R"),
    _l(0x06C6, "OE", "R"),
    _l(0x06CC, "FARSI YEH", "D"),
    _l(0x06CE, "YEH WITH SMALL V", "D"),
)
# The Arabic and Kurdish forms of three letters (§11.1): (Arabic, Kurdish).
VARIANT_PAIRS: tuple[tuple[Letter, Letter], ...] = (
    (_l(0x064A, "YEH", "D"), _l(0x06CC, "FARSI YEH", "D")),
    (_l(0x0643, "KAF", "D"), _l(0x06A9, "KEHEH", "D")),
    (_l(0x0647, "HEH", "D"), _l(0x06D5, "AE", "R")),
)
EXTRA_LETTERS: tuple[Letter, ...] = (
    _l(0x06BE, "HEH DOACHASHMEE", "D"),
    _l(0x0649, "ALEF MAKSURA", "D"),
    _l(0x0629, "TEH MARBUTA", "R"),
    _l(0x0621, "HAMZA", "U"),
    _l(0x0623, "ALEF WITH HAMZA ABOVE", "R"),
    _l(0x0625, "ALEF WITH HAMZA BELOW", "R"),
    _l(0x0622, "ALEF WITH MADDA ABOVE", "R"),
    _l(0x0624, "WAW WITH HAMZA ABOVE", "R"),
    _l(0x0626, "YEH WITH HAMZA ABOVE", "D"),
)
# Letters of Arabic-script (Arabic) names that Sorani does not use.
ARABIC_ONLY_LETTERS: tuple[Letter, ...] = (
    _l(0x062B, "THEH", "D"),
    _l(0x0630, "THAL", "R"),
    _l(0x0635, "SAD", "D"),
    _l(0x0636, "DAD", "D"),
    _l(0x0637, "TAH", "D"),
    _l(0x0638, "ZAH", "D"),
)
# Dot-differentiated letters for the legibility ladder: ب ت ث ن ی پ.
LADDER_LETTERS = "\u0628\u062a\u062b\u0646\u06cc\u067e"
# Minimal pairs that differ only by a Kurdish mark or dots: \u0631/\u0695, \u0644/\u06b5, \u06cc/\u06ce, \u0648/\u06c6, \u0632/\u0698, \u0641/\u06a4, \u062c/\u0686, \u06a9/\u06af.
MINIMAL_PAIRS: tuple[tuple[str, str], ...] = (
    ("\u0631", "\u0695"), ("\u0644", "\u06b5"), ("\u06cc", "\u06ce"), ("\u0648", "\u06c6"),
    ("\u0632", "\u0698"), ("\u0641", "\u06a4"), ("\u062c", "\u0686"), ("\u06a9", "\u06af"),
)
RIGHT_JOINING = "\u0627\u062f\u0631\u0695\u0632\u0698\u06d5\u0648\u06c6\u0629\u0623\u0625\u0622\u0624\u0630"


def joined_form(char: str) -> str:
    """The letter joined on both sides to beh where it can join, else joined on its right: \u0628X\u0628 or \u0628X."""
    return BEH + char if char in RIGHT_JOINING else BEH + char + BEH


def joining_forms(char: str) -> list[str]:
    """The letter alone, at the start, in the middle and at the end of a word, with beh (U+0628) as its partner."""
    return [char, char + BEH, BEH + char + BEH, BEH + char]


def expected_forms(letter: Letter) -> str:
    if letter.joining == "D":
        return "4 different forms: isolated, initial, medial, final"
    if letter.joining == "R":
        return "2 forms: isolated in the first two groups, final in the last two; it never joins to the left"
    return "1 form: it never joins; every beh beside it stands alone or joins only to the other beh"


# --------------------------------------------------------------------------------------------- ZPL text


class KitError(Exception):
    """A usage or input error; the command exits with 2."""


def zpl_field_data(text: str) -> str:
    """Field data for ``^FH\\^FD``: every '^', '~' and '\\' as a hex escape, the rest UTF-8 as is.

    A control character, a C1 control or a lone surrogate is refused (platform-docs.md §7.1, R7).
    """
    out = []
    for ch in text:
        code = ord(ch)
        if code < 0x20 or code == 0x7F or 0x80 <= code < 0xA0 or 0xD800 <= code <= 0xDFFF:
            raise KitError(f"field data holds a control character U+{code:04X}")
        out.append(f"\\{code:02X}" if ch in "^~\\" else ch)
    return "".join(out)


def _round_half_up(value: float) -> int:
    return int(math.floor(value + 0.5))


def _check_font_name(name: str) -> tuple[str, str]:
    """Split a printer font name such as ``E:NSARAB.TTF`` into drive and file name."""
    match = re.fullmatch(r"([REBA]):([A-Z0-9_]{1,16})\.TTF", name)
    if not match:
        raise KitError(
            f"{name!r} is not a printer TrueType name: a drive R:, E:, B: or A:, 1 to 16 upper-case letters, "
            "digits or '_', and .TTF (for example E:NSARAB.TTF)"
        )
    return match.group(1), match.group(2)


@dataclass(frozen=True)
class Options:
    dpi: int
    width_mm: float = DEFAULT_WIDTH_MM
    length_mm: float = DEFAULT_LENGTH_MM
    arabic_font: str = DEFAULT_ARABIC_FONT
    latin_font: str = DEFAULT_LATIN_FONT
    arabic_bold_font: str = DEFAULT_ARABIC_BOLD_FONT
    latin_bold_font: str = DEFAULT_LATIN_BOLD_FONT

    def __post_init__(self) -> None:
        if self.dpi not in DOTS_PER_MM:
            raise KitError(f"dpi must be one of {sorted(DOTS_PER_MM)}")
        if not (math.isfinite(self.width_mm) and MIN_WIDTH_MM <= self.width_mm <= 220):
            raise KitError(f"--width-mm must be between {MIN_WIDTH_MM:g} and 220")
        if not (math.isfinite(self.length_mm) and MIN_LENGTH_MM <= self.length_mm <= 1000):
            raise KitError(f"--length-mm must be between {MIN_LENGTH_MM:g} and 1000")
        for name in (self.arabic_font, self.latin_font, self.arabic_bold_font, self.latin_bold_font):
            _check_font_name(name)

    @property
    def margin_mm(self) -> float:
        return MARGIN_MM if self.width_mm >= 40.0 else NARROW_MARGIN_MM

    @property
    def dpmm(self) -> int:
        return DOTS_PER_MM[self.dpi]

    def dots(self, mm: float) -> int:
        return _round_half_up(mm * self.dpmm)

    def pt_dots(self, pt: float) -> int:
        return _round_half_up(pt * 25.4 / 72.0 * self.dpmm)

    def font_name(self, font: str) -> str:
        return {"arabic": self.arabic_font, "latin": self.latin_font, "arabic-bold": self.arabic_bold_font,
                "latin-bold": self.latin_bold_font}[font]

    @property
    def content_width(self) -> int:
        return self.dots(self.width_mm) - 2 * self.dots(self.margin_mm)


@dataclass(frozen=True)
class Row:
    """A caption (resident font) and a text field. ``font`` is resident, arabic, latin, arabic-bold or
    latin-bold. ``block`` False writes the field without ^FB (one line, no field-block parsing)."""

    caption: str
    text: str
    font: str
    size_pt: float
    align: str  # R or L
    lines: int = 2
    block: bool = True


@dataclass(frozen=True)
class BoxLine:
    """One line in the engine writer's form (platform-docs.md §7.1): ``^FT<x>,<y>^A@N,<h>,<h>,<font>
    ^FB<w>,1,0,L,0``, Latin font, with the box width set so that the text's width (from the pinned font's
    advance widths, taking ``h`` as the em) is ``percent`` of the box. Ticks mark the box's two ends."""

    caption: str
    text: str
    size_pt: float
    percent: int


@dataclass(frozen=True)
class RotatedLines:
    """Lines in the engine's 90° wristband frame (platform-docs.md §7.1): ``^FT`` with ``^A@R`` and a
    single-line ``^FB``, placed as the engine's ZplFrame places them. Ticks mark each box's two ends."""

    caption: str
    lines: tuple[tuple[str, str, str], ...]  # (text, font, ^FB justification)
    size_pt: float
    box_mm: float


@dataclass(frozen=True)
class HeightCalibration:
    """The ^A@ height calibration row: Latin text at ``h`` dots beside a bar exactly ``h`` dots tall."""

    caption: str
    text: str


@dataclass(frozen=True)
class Symbol:
    """A barcode block: a caption, the symbol, and its payload in plain text."""

    caption: str
    kind: str  # datamatrix or code128
    payload: str
    module_mm: float


Block = object  # Row, BoxLine, RotatedLines, HeightCalibration or Symbol

CAPTION_PT = 7.0
HEADER_PT = 9.0
GAP_MM = 1.5
DATAMATRIX_QUIET_MODULES = 2  # on each side; ISO/IEC 16022 asks for at least one

# Resident-font (^A0) text is about 0.6 of its height wide per character; 0.65 leaves room, so a caption
# block always has enough lines and ^FB never prints a caption's last words over each other. The same
# estimate sizes the rows in the downloaded fonts, which get one spare line on top (the kit cannot shape,
# so it cannot measure Arabic-script text).
RESIDENT_WIDTH_FACTOR = 0.65


def _resident_lines(text: str, height: int, width: int) -> int:
    return max(1, math.ceil(len(text) * RESIDENT_WIDTH_FACTOR * height / width))


def _spacing(height: int) -> int:
    return max(1, _round_half_up(height * 0.25))


def _block_height(height: int, lines: int) -> int:
    return lines * height + (lines - 1) * _spacing(height)


def _font_command(opts: Options, font: str, height: int, orientation: str = "N") -> str:
    if font == "resident":
        return f"^A0{orientation},{height},{height}"
    return f"^A@{orientation},{height},{height},{opts.font_name(font)}"


def _text_field(opts: Options, x: int, y: int, width: int, font: str, height: int, lines: int, align: str,
                text: str) -> str:
    if "\\" in text:
        raise KitError("a backslash never goes to a ZPL field block: ^FB reads it after the ^FH decoding (R7)")
    return (
        f"^FO{x},{y}{_font_command(opts, font, height)}^FB{width},{lines},{_spacing(height)},{align},0"
        f"^FH\\^FD{zpl_field_data(text)}^FS"
    )


def _engine_line(opts: Options, x: int, y: int, orientation: str, font: str, height: int, width: int,
                 justification: str, text: str) -> str:
    """A placed line exactly as the engine's ZplTextWriter writes it (platform-docs.md §7.1)."""
    if "\\" in text:
        raise KitError("a backslash never goes to a ZPL field block (platform-docs.md §3.2 R7)")
    return (f"^FT{x},{y}{_font_command(opts, font, height, orientation)}^FB{width},1,0,{justification},0"
            f"^FH\\^FD{zpl_field_data(text)}^FS")


def _bar(x: int, y: int, w: int, h: int) -> str:
    """A solid rectangle, as the engine writes rules: ^GB<w>,<h>,<min(w, h)>."""
    return f"^FO{x},{y}^GB{w},{h},{min(w, h)}^FS"


def _side_by_side(opts: Options) -> bool:
    return opts.width_mm >= 80.0


def latin_text_width(text: str, height: int) -> int:
    """The width in dots of ``text`` in Noto Sans at ``height`` dots to the em, from the advance widths.
    Kerning is left out; the 100%-box rows use only digits, the hyphen and S, Y, N."""
    try:
        units = sum(NOTO_SANS_ADVANCES[ch] for ch in text)
    except KeyError as exc:
        raise KitError(f"no advance width recorded for {exc.args[0]!r}") from exc
    return math.ceil(units * height / NOTO_SANS_UPEM)


def _code128_modules(payload: str) -> int:
    # Subset B: start, one symbol per character, check symbol (11 modules each), stop (13 modules).
    return (len(payload) + 2) * 11 + 13


# Square ECC 200 symbols: (modules per side, data codewords) (ISO/IEC 16022, symbol attributes table).
DATAMATRIX_SQUARE: tuple[tuple[int, int], ...] = (
    (10, 3), (12, 5), (14, 8), (16, 12), (18, 18), (20, 22), (22, 30), (24, 36), (26, 44), (32, 62),
    (36, 86), (40, 114), (44, 144), (48, 174), (52, 204), (64, 280), (72, 368), (80, 456), (88, 576),
    (96, 696), (104, 816), (120, 1050), (132, 1304), (144, 1558),
)


def datamatrix_ascii_codewords(payload: str) -> int:
    """Data codewords in ASCII encodation: two digits make one codeword, other ASCII one, above 127 two."""
    count, i = 0, 0
    while i < len(payload):
        if payload[i] in "0123456789" and i + 1 < len(payload) and payload[i + 1] in "0123456789":
            count, i = count + 1, i + 2
        else:
            count, i = count + (1 if ord(payload[i]) < 128 else 2), i + 1
    return count


def datamatrix_side(payload: str) -> int:
    """Modules per side of the smallest square ECC 200 symbol that holds ``payload`` in ASCII encodation.

    The engine takes the size from ZXing's encoder (platform-docs.md §6.2), which may switch to another
    encodation only when that is shorter; so the kit's symbol is the engine's size or larger, never
    smaller, and the space reserved for it is always enough. Compare with the engine's ZE-01 fixtures.
    """
    needed = datamatrix_ascii_codewords(payload)
    for side, capacity in DATAMATRIX_SQUARE:
        if capacity >= needed:
            return side
    raise KitError("the payload is too long for a DataMatrix symbol")


def _symbol_module_dots(opts: Options, symbol: Symbol) -> int:
    return max(1, _round_half_up(symbol.module_mm * opts.dpmm))


def _row_lines(block: Row, height: int, width: int) -> int:
    if not block.block:
        return 1
    estimate = _resident_lines(block.text, height, width)
    if block.font == "resident":
        return estimate
    return max(block.lines, estimate + 1)


def _caption(opts: Options, y: int, text: str) -> tuple[str, int]:
    """A full-width caption in the resident font at ``y``; returns the field and its height."""
    cap_h = opts.pt_dots(CAPTION_PT)
    lines = _resident_lines(text, cap_h, opts.content_width)
    margin = opts.dots(opts.margin_mm)
    return _text_field(opts, margin, y, opts.content_width, "resident", cap_h, lines, "L", text), \
        _block_height(cap_h, lines)


def _render_row(opts: Options, block: Row, y: int) -> tuple[list[str], int]:
    margin = opts.dots(opts.margin_mm)
    content_w = opts.content_width
    cap_h = opts.pt_dots(CAPTION_PT)
    gap = opts.dots(GAP_MM)
    text_h = opts.pt_dots(block.size_pt)
    if _side_by_side(opts):
        cap_w = opts.dots(38.0)
        text_x = margin + cap_w + opts.dots(2.0)
        text_w = margin + content_w - text_x
    else:
        cap_w = content_w
        text_x = margin
        text_w = content_w
    cap_lines = _resident_lines(block.caption, cap_h, cap_w)
    lines = _row_lines(block, text_h, text_w)
    text_block = _block_height(text_h, lines)
    fields = [_text_field(opts, margin, y, cap_w, "resident", cap_h, cap_lines, "L", block.caption)]
    text_y = y if _side_by_side(opts) else y + _block_height(cap_h, cap_lines) + opts.dots(0.5)
    if block.block:
        fields.append(_text_field(opts, text_x, text_y, text_w, block.font, text_h, lines, block.align, block.text))
    else:
        fields.append(f"^FO{text_x},{text_y}{_font_command(opts, block.font, text_h)}"
                      f"^FH\\^FD{zpl_field_data(block.text)}^FS")
    if _side_by_side(opts):
        return fields, max(_block_height(cap_h, cap_lines), text_block) + gap
    return fields, text_y - y + text_block + gap


def _render_box_line(opts: Options, block: BoxLine, y: int) -> tuple[list[str], int]:
    margin = opts.dots(opts.margin_mm)
    h = opts.pt_dots(block.size_pt)
    box_w = math.ceil(latin_text_width(block.text, h) * 100 / block.percent)
    caption, used = _caption(opts, y, f"{block.caption} | {block.size_pt:g} pt, h {h} dots, box {box_w} dots")
    top = y + used + opts.dots(0.5)
    if box_w > opts.content_width:
        note, more = _caption(opts, top, f"NOT PRINTED - the box needs {box_w} dots and the print width is "
                                         f"{opts.content_width} dots")
        return [caption, note], top - y + more + opts.dots(GAP_MM)
    baseline = top + math.ceil(h * NOTO_SANS_ASCENDER / NOTO_SANS_UPEM)
    tick_w, tick_h = max(2, opts.dots(0.25)), opts.dots(2.0)
    tick_y = baseline + math.ceil(h * NOTO_SANS_DESCENDER / NOTO_SANS_UPEM) + 1
    fields = [
        caption,
        _engine_line(opts, margin, baseline, "N", "latin", h, box_w, "L", block.text),
        _bar(margin, tick_y, tick_w, tick_h),
        _bar(margin + box_w - tick_w, tick_y, tick_w, tick_h),
    ]
    return fields, tick_y + tick_h - y + opts.dots(GAP_MM)


def _render_rotated(opts: Options, block: RotatedLines, y: int) -> tuple[list[str], int]:
    margin = opts.dots(opts.margin_mm)
    h = opts.pt_dots(block.size_pt)
    box = opts.dots(block.box_mm)
    caption, used = _caption(opts, y, block.caption)
    top = y + used + opts.dots(1.0)
    tick_w = max(2, opts.dots(0.25))
    fields = [caption]
    x = margin
    for text, font, justification in block.lines:
        ascender, descender = ((NOTO_ARABIC_ASCENDER, NOTO_ARABIC_DESCENDER) if font.startswith("arabic")
                               else (NOTO_SANS_ASCENDER, NOTO_SANS_DESCENDER))
        depth = math.ceil(h * descender / NOTO_SANS_UPEM)
        band = depth + math.ceil(h * ascender / NOTO_SANS_UPEM)
        if x + band > margin + opts.content_width:
            raise KitError("the rotated lines are wider than the print width")
        # The engine's 90° frame maps a line's baseline v and box start u to ^FT(W - v, u): the glyphs' tops
        # face +x, so the descenders lie between the band's left edge and the baseline.
        fields.append(_engine_line(opts, x + depth, top, "R", font, h, box, justification, text))
        fields.append(_bar(x, top - tick_w, band, tick_w))
        fields.append(_bar(x, top + box, band, tick_w))
        x += band + opts.dots(2.0)
    return fields, top + box + tick_w - y + opts.dots(GAP_MM)


def calibration_height(opts: Options, text: str) -> int:
    """The calibration row's ^A@ height in dots: 8 mm, or 6 or 4 mm when the text would not fit."""
    for mm in (8.0, 6.0, 4.0):
        h = opts.dots(mm)
        if opts.dots(2.0) + latin_text_width(text, h) <= opts.content_width:
            return h
    return opts.dots(4.0)


def _render_calibration(opts: Options, block: HeightCalibration, y: int) -> tuple[list[str], int]:
    margin = opts.dots(opts.margin_mm)
    h = calibration_height(opts, block.text)
    h_mm = h / opts.dpmm
    cap_em = h_mm * NOTO_SANS_CAP_HEIGHT / NOTO_SANS_UPEM
    cap_cell = h_mm * NOTO_SANS_CAP_HEIGHT / (NOTO_SANS_ASCENDER + NOTO_SANS_DESCENDER)
    caption, used = _caption(opts, y, f"{block.caption} | h {h} dots = {h_mm:.2f} mm, the bar's height. If h is "
                                      f"the em, H is {cap_em:.2f} mm tall; if h is ascender + descender, "
                                      f"{cap_cell:.2f} mm")
    top = y + used + opts.dots(1.0)
    baseline = top + math.ceil(h * NOTO_SANS_ASCENDER / NOTO_SANS_UPEM)
    text_x = margin + opts.dots(2.0)
    fields = [
        caption,
        _bar(margin, baseline - h, max(2, opts.dots(0.5)), h),
        _engine_line(opts, text_x, baseline, "N", "latin", h, margin + opts.content_width - text_x, "L", block.text),
    ]
    return fields, baseline + math.ceil(h * NOTO_SANS_DESCENDER / NOTO_SANS_UPEM) - y + opts.dots(GAP_MM)


def _render_symbol(opts: Options, block: Symbol, y: int) -> tuple[list[str], int]:
    margin = opts.dots(opts.margin_mm)
    content_w = opts.content_width
    module = _symbol_module_dots(opts, block)
    gap = opts.dots(GAP_MM)
    if block.kind == "datamatrix":
        if BX_ESCAPE in block.payload:
            raise KitError(f"a DataMatrix payload must not contain the ^BX escape character {BX_ESCAPE!r}")
        side = datamatrix_side(block.payload)
        quiet = DATAMATRIX_QUIET_MODULES * module
        caption, used = _caption(opts, y, f"{block.caption} | {side} x {side} modules of {module} dots")
        sym_y = y + used + opts.dots(1.0)
        needed = side * module + 2 * quiet
        if needed > content_w:
            note, more = _caption(opts, sym_y, f"NOT PRINTED - the symbol needs {needed / opts.dpmm:.1f} mm with "
                                               f"quiet zones and the print width is {content_w / opts.dpmm:.1f} mm; "
                                               "record it as not-run")
            return [caption, note], sym_y - y + more + gap
        # The engine's ^BX form: explicit columns and rows, format ID empty, escape character '_' (§6.2, §7.1).
        symbol = (f"^FO{margin + quiet},{sym_y + quiet}^BXN,{module},200,{side},{side},,{BX_ESCAPE}"
                  f"^FH\\^FD{zpl_field_data(block.payload)}^FS")
        text_y = sym_y + needed
        payload, more = _caption(opts, text_y, block.payload)
        return [caption, symbol, payload], text_y - y + more + gap
    if ">" in block.payload:
        raise KitError("a Code 128 payload here must not contain '>', the ^BC invocation character")
    caption, used = _caption(opts, y, block.caption)
    sym_y = y + used + opts.dots(1.0)
    quiet = 10 * module
    needed = _code128_modules(block.payload) * module + 2 * quiet
    bar_h = opts.dots(10.0)
    if needed > content_w:
        note, more = _caption(opts, sym_y, f"NOT PRINTED - the symbol needs {needed / opts.dpmm:.1f} mm with quiet "
                                           f"zones and the print width is {content_w / opts.dpmm:.1f} mm; record "
                                           "BC-03 as not-run")
        return [caption, note], sym_y - y + more + gap
    symbol = (f"^FO{margin + quiet},{sym_y}^BY{module},3,{bar_h}^BCN,{bar_h},Y,N,N,N"
              f"^FH\\^FD{zpl_field_data(block.payload)}^FS")
    # The interpretation line below the bars takes about 4 mm.
    return [caption, symbol], sym_y - y + bar_h + opts.dots(4.0) + gap


def _render_block(opts: Options, block: Block, y: int) -> tuple[list[str], int]:
    """ZPL fields for one block at ``y``; returns the fields and the height used, in dots."""
    if isinstance(block, Row):
        return _render_row(opts, block, y)
    if isinstance(block, BoxLine):
        return _render_box_line(opts, block, y)
    if isinstance(block, RotatedLines):
        return _render_rotated(opts, block, y)
    if isinstance(block, HeightCalibration):
        return _render_calibration(opts, block, y)
    if isinstance(block, Symbol):
        return _render_symbol(opts, block, y)
    raise TypeError(f"not a block: {block!r}")


def _header(opts: Options, pattern: "Pattern", page: int, pages: int) -> tuple[list[str], int]:
    margin = opts.dots(opts.margin_mm)
    content_w = opts.content_width
    head_h = opts.pt_dots(HEADER_PT)
    y = margin
    head_lines = _resident_lines(NOTICE, head_h, content_w)
    fields = [_text_field(opts, margin, y, content_w, "resident", head_h, head_lines, "L", NOTICE)]
    y += _block_height(head_h, head_lines) + opts.dots(1.0)
    info, used = _caption(opts, y, f"HMS S7-K kit {KIT_VERSION} | {pattern.pid} {pattern.slug} | {opts.dpi} dpi | "
                                   f"page {page}/{pages} | fonts {opts.arabic_font} {opts.arabic_bold_font} "
                                   f"{opts.latin_font} {opts.latin_bold_font}")
    fields.append(info)
    y += used + opts.dots(1.0)
    rule = max(2, opts.dots(0.3))
    fields.append(_bar(margin, y, content_w, rule))
    y += rule + opts.dots(GAP_MM)
    return fields, y


def render_zpl(pattern: "Pattern", opts: Options) -> bytes:
    """The ZPL of one pattern: one label format (^XA ... ^XZ) per page. Same input, same bytes."""
    blocks = pattern.blocks(opts)
    length = opts.dots(opts.length_mm)
    bottom = length - opts.dots(opts.margin_mm)
    _fields, top = _header(opts, pattern, 99, 99)  # the longest page numbers, so the header never grows later
    # First pass: split the blocks into pages.
    pages: list[list[Block]] = [[]]
    y = top
    for block in blocks:
        _f, height = _render_block(opts, block, y)
        if y + height > bottom and pages[-1]:
            pages.append([])
            y = top
            _f, height = _render_block(opts, block, y)
        if y + height > bottom:
            raise KitError(f"{pattern.pid}: one block is taller than the label; use a longer --length-mm")
        pages[-1].append(block)
        y += height
    out: list[str] = []
    if pattern.prefix:
        out.append(pattern.prefix)
    for number, page_blocks in enumerate(pages, start=1):
        header, y = _header(opts, pattern, number, len(pages))
        out += [
            "^XA",
            f"^FX HMS S7-K kit {KIT_VERSION} {pattern.pid} page {number} of {len(pages)} {opts.dpi} dpi synthetic",
            "^CI28",
            f"^PW{opts.dots(opts.width_mm)}",
            f"^LL{length}",
            "^LH0,0",
            "^PA1,1,1,1",
        ]
        out += header
        for block in page_blocks:
            fields, height = _render_block(opts, block, y)
            out += fields
            y += height
        out += ["^PQ1", "^XZ"]
    return ("\n".join(out) + "\n").encode("utf-8")


# --------------------------------------------------------------------------------------------- patterns


def _letter_caption(index: Optional[int], letter: Letter, suffix: str = "") -> str:
    lead = f"{index:02d} " if index is not None else ""
    mark = " [K]" if letter.kurdish else ""
    return f"{lead}U+{ord(letter.char):04X} {letter.name} ({letter.joining}){mark}{suffix}"


def _letter_row(index: Optional[int], letter: Letter, suffix: str = "") -> Row:
    return Row(_letter_caption(index, letter, suffix), "  ".join(joining_forms(letter.char)), "arabic", 12, "R")


def zt01_blocks() -> list[Block]:
    return [_letter_row(i, letter) for i, letter in enumerate(SORANI_ALPHABET, start=1)]


def zt02_blocks() -> list[Block]:
    rows: list[Block] = []
    for arabic, kurdish in VARIANT_PAIRS:
        rows.append(_letter_row(None, arabic, " Arabic form; isolated and final must differ from the Kurdish form"))
        rows.append(_letter_row(None, kurdish, " Kurdish form; isolated and final must differ from the Arabic form"))
    rows += [_letter_row(None, letter) for letter in EXTRA_LETTERS]
    rows += [_letter_row(None, letter, " Arabic names") for letter in ARABIC_ONLY_LETTERS]
    lam = "ل"
    rows.append(Row("lam-alef ligatures (mandatory): la, beh-la, la-hamza above, la-hamza below, la-madda",
                    "  ".join([lam + ALEF, BEH + lam + ALEF, lam + "أ", lam + "إ", lam + "آ"]),
                    "arabic", 12, "R"))
    rows.append(Row("LAM WITH SMALL V + alef: lv-a, beh-lv-a and two synthetic words; the v mark stays on the lam",
                    "  ".join(LAM_V_ALEF_WORDS), "arabic", 12, "R"))
    rows.append(Row("ZWNJ U+200C: the first pair joins, the second pair must not join",
                    BEH + BEH + "  " + BEH + ZWNJ + BEH, "arabic", 12, "R"))
    rows.append(Row("ZWJ U+200D: beh+ZWJ shows the initial form, ZWJ+beh the final form, beh+ZWJ+beh the medial",
                    BEH + ZWJ + "  " + ZWJ + BEH + "  " + BEH + ZWJ + BEH, "arabic", 12, "R"))
    rows.append(Row("U+060C Arabic comma between two beh", BEH + "، " + BEH, "arabic", 12, "R"))
    rows.append(Row("sample words holding all ten Kurdish letters (synthetic)", SAMPLE_WORDS, "arabic", 12, "R"))
    rows.append(Row("the same words in the bold font (E:NSARABB.TTF)", SAMPLE_WORDS, "arabic-bold", 12, "R"))
    latin = " ".join(LATIN_KURDISH_LETTERS) + "  " + SYN_NAME_LATIN
    rows.append(Row("Latin font: the letters of transliterated Kurdish names and a synthetic Latin name",
                    latin, "latin", 12, "L"))
    rows.append(Row("the same in the bold Latin font (E:NSLATNB.TTF)", latin, "latin-bold", 12, "L"))
    return rows


def zt03_blocks() -> list[Block]:
    return [
        Row("B1a name, own RTL field (Arabic font)", SYN_NAME, "arabic", 12, "R"),
        Row("B1b MRN, own LTR field (Latin font); expect SYN-000123-7", SYN_MRN, "latin", 12, "L"),
        Row("B1c date, own LTR field (Latin font); expect 2024-03-21", SYN_DATE, "latin", 12, "L"),
        Row("B1d digit identifier, own LTR field (Latin font); expect 0012345", SYN_DIGITS, "latin", 12, "L"),
        Row("B2a date alone, RTL field (Arabic font); expect 2024-03-21", SYN_DATE, "arabic", 12, "R"),
        Row("B2b digits alone, RTL field (Arabic font); expect 0012345", SYN_DIGITS, "arabic", 12, "R"),
        Row("B3a name + MRN, one RTL field; UBA: SYN-000123-7 left of the name, intact",
            f"{SYN_NAME} {SYN_MRN}", "arabic", 12, "R"),
        Row("B3b name + date, one RTL field (diagnostic); UBA: 21-03-2024 left of the name",
            f"{SYN_NAME} {SYN_DATE}", "arabic", 12, "R"),
        Row("B3c name + digits, one RTL field; UBA: 0012345 left of the name, intact",
            f"{SYN_NAME} {SYN_DIGITS}", "arabic", 12, "R"),
        Row("B4 escape check in a ^FB field (resident font); expect exactly: Escape check: ^XZ ~JA end",
            "Escape check: ^XZ ~JA end", "resident", 10, "L"),
        Row("B4b backslash check in a field WITHOUT ^FB (diagnostic): expect a backslash before 5E and before &",
            "Backslash check: \\5E \\& end", "resident", 10, "L", block=False),
        Row("B5 Eastern Arabic-Indic digits: non-clinical text only, never identifiers (11.1)",
            "".join(chr(0x0660 + d) for d in range(10)), "arabic", 12, "R"),
    ]


def _size_note(opts: Optional[Options], pt: int) -> str:
    if opts is None:
        return ""
    notes = [f" ({opts.pt_dots(pt)} dots)"]
    if pt == ARABIC_MIN_PT[opts.dpi]:
        notes.append(f" [Arabic-script identity minimum at {opts.dpi} dpi]")
    return "".join(notes)


def zt04_blocks(opts: Optional[Options] = None) -> list[Block]:
    rows: list[Block] = []
    isolated = " ".join(LADDER_LETTERS)
    joined = " ".join(ch * 3 for ch in LADDER_LETTERS)
    pairs_alone = "  ".join(f"{a} {b}" for a, b in MINIMAL_PAIRS)
    pairs_joined = "  ".join(f"{joined_form(a)} {joined_form(b)}" for a, b in MINIMAL_PAIRS)
    for pt in range(6, 13):
        note = _size_note(opts, pt)
        rows.append(Row(f"{pt} pt{note} isolated: beh teh theh noon farsi-yeh peh", isolated, "arabic", pt, "R"))
        rows.append(Row(f"{pt} pt{note} joined, medial forms", joined, "arabic", pt, "R"))
        rows.append(Row(f"{pt} pt{note} minimal pairs alone: reh, lam, yeh, waw, zain, feh, jeem, keheh and the "
                        "Kurdish letter beside each", pairs_alone, "arabic", pt, "R"))
        rows.append(Row(f"{pt} pt{note} minimal pairs joined to beh", pairs_joined, "arabic", pt, "R"))
        latin_note = " [Latin identity minimum]" if pt == LATIN_MIN_PT else ""
        rows.append(Row(f"{pt} pt{latin_note} Latin identifiers", f"{SYN_MRN} {SYN_DATE}", "latin", pt, "L"))
    return rows


def zt05_blocks() -> list[Block]:
    full = "text 100% of its ^FB box: one line, no wrap, no overprint, between the ticks"
    return [
        BoxLine(f"FB1 MRN, {full}", SYN_MRN, 10, 100),
        BoxLine("FB2 MRN, text 95% of its box (the engine's margin, platform-docs 5.3)", SYN_MRN, 10, 95),
        BoxLine(f"FB3 date, {full}", SYN_DATE, 10, 100),
        BoxLine(f"FB4 digit identifier, {full}", SYN_DIGITS, 10, 100),
        BoxLine(f"FB5 MRN, {full}", SYN_MRN, 7, 100),
        BoxLine(f"FB6 date, {full}", SYN_DATE, 7, 100),
        RotatedLines("R1 the 90-degree wristband frame as the engine writes it (^FT, ^A@R, one-line ^FB): the "
                     "name right-justified, the MRN left-justified, each between its two ticks; read with the "
                     "label turned a quarter turn anticlockwise",
                     ((SYN_NAME, "arabic", "R"), (SYN_MRN, "latin", "L")), 10, 40.0),
        HeightCalibration("CAL ^A@ height calibration (E:NSLATN.TTF): measure the height of H with a loupe and a "
                          "ruler; record h_dots and cap_height_mm in font_height_calibration", "HÉgx"),
    ]


def bc01_blocks() -> list[Block]:
    return [
        Symbol("BC-01 DataMatrix ECC 200, module 0.5 mm, wristband payload with a 36-character band serial, ^BX "
               "as the engine writes it (explicit size, escape character _)", "datamatrix", WRISTBAND_PAYLOAD, 0.5),
        Symbol("BC-02 DataMatrix ECC 200, module 0.25 mm (the template minimum), specimen payload",
               "datamatrix", SPECIMEN_PAYLOAD, 0.25),
        Symbol("BC-03 Code 128, module 0.25 mm", "code128", CODE128_PAYLOAD, 0.25),
    ]


def ja01_blocks() -> list[Block]:
    return [Row("JA-01: this job starts with ~JA (cancel all). This label must print exactly once.",
                "JA-01 printed after ~JA", "resident", 10, "L")]


@dataclass(frozen=True)
class Pattern:
    pid: str
    slug: str
    purpose: str
    items: tuple[str, ...]
    builder: Callable[..., list[Block]]
    prefix: str = ""
    takes_options: bool = False

    def file_name(self, dpi: int) -> str:
        return f"s7k-{self.pid.lower()}-{self.slug}-{dpi}.zpl"

    def blocks(self, opts: Optional[Options] = None) -> list[Block]:
        return self.builder(opts) if self.takes_options else self.builder()


PATTERNS: tuple[Pattern, ...] = (
    Pattern("ZT01", "sorani-chart", "ZPL text mode: every Sorani letter alone, initial, medial and final, with beh "
            "as the joining partner", ("ZT-01", "ZT-03", "ZT-04", "ZT-09"), zt01_blocks),
    Pattern("ZT02", "variants", "ZPL text mode: the Arabic and Kurdish forms of yeh, kaf and heh; heh "
            "doachashmee, alef maksura, teh marbuta, hamza forms, Arabic-only letters, lam-alef, lam with small v "
            "and alef, ZWNJ, ZWJ, the Arabic comma, sample words, the bold fonts and the Latin letters of "
            "transliterated names", ("ZT-02", "ZT-03", "ZT-04", "ZT-09"), zt02_blocks),
    Pattern("ZT03", "bidi", "ZPL text mode: a Sorani name with a Latin MRN, a date and a digit-only identifier, "
            "in their own fields and in one RTL field; the field-data escape checks",
            ("ZT-03", "ZT-05", "ZT-06", "ZT-07", "ZT-09"), zt03_blocks),
    Pattern("ZT04", "legibility", "ZPL text mode: the dot-differentiated letters beh teh theh noon yeh peh, the "
            "Kurdish minimal pairs and the Latin identifiers from 6 to 12 pt", ("ZT-03", "ZT-08", "ZT-09"),
            zt04_blocks, takes_options=True),
    Pattern("ZT05", "engine-lines", "ZPL text mode in the engine writer's form: identifiers at 100% and 95% of a "
            "one-line ^FB box, the 90-degree wristband frame, and the ^A@ height calibration",
            ("ZT-03", "ZT-09", "ZT-10", "ZT-11"), zt05_blocks),
    Pattern("BC01", "barcodes", "Native ^BX DataMatrix at 0.5 and 0.25 mm in the engine's form and ^BC Code 128, "
            "each with its payload in plain text", ("BC-01", "BC-02", "BC-03", "ZT-09"), bc01_blocks),
    Pattern("JA01", "cancel-then-print", "~JA followed by one label in the same job: does the label print once?",
            ("JA-01",), ja01_blocks, prefix="~JA"),
)

# Fixed files: printer configuration queries and the ESC/POS self-test (not resolution dependent).
CONFIG_FILES: tuple[tuple[str, bytes, str, tuple[str, ...]], ...] = (
    ("s7k-cfg-01-host-identification.zpl", b"~HI\n",
     "~HI: the printer replies with model, firmware, dots per mm and memory (send with --read-reply)", ("CFG-01",)),
    ("s7k-cfg-02-host-configuration.zpl", b"^XA^HH^XZ\n",
     "^HH: the printer replies with its configuration label as text (send with --read-reply)", ("CFG-01",)),
    ("s7k-cfg-03-print-configuration-label.zpl", b"~WC\n",
     "~WC: the printer prints its configuration label (photograph it)", ("CFG-01",)),
    ("s7k-cfg-04-print-directory-e.zpl", b"^XA^WDE:*.*^XZ\n",
     "^WD: the printer prints the directory of drive E: (check the downloaded fonts and their sizes)", ("FNT-01",)),
    ("s7k-cfg-05-host-directory-listing.zpl", b"^XA^HW^XZ\n^XA^HWE:*.*^XZ\n",
     "^HW: the printer replies with its resident object listing, names and sizes, for R: (the default) and E: "
     "(send with --read-reply; copy it into printer.resident_font_listing)", ("FNT-01",)),
)
ESCPOS_FILE = "s7k-ep01-escpos-selftest.bin"
REFERENCE_FILE = "s7k-reference.html"


def escpos_selftest() -> bytes:
    """ESC @, Latin lines, ESC d 4 (feed four lines), GS V 66 0 (feed and partial cut)."""
    lines = [
        NOTICE,
        f"HMS S7-K kit {KIT_VERSION} EP-01 ESC/POS self-test",
        "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "abcdefghijklmnopqrstuvwxyz -/:|.,",
        "Arabic-script receipts and tokens are raster",
        "images from the HMS engine (item EP-02).",
        "The paper is cut below this line.",
    ]
    body = "".join(line + "\n" for line in lines).encode("ascii")
    return b"\x1b@" + body + b"\x1bd\x04" + b"\x1dVB\x00"


def reference_html(opts: Options) -> bytes:
    """A reference page with the ZT strings, to open in a browser that shapes with HarfBuzz."""
    esc = html.escape
    families = {"arabic": ("S7K Arabic", "normal"), "arabic-bold": ("S7K Arabic", "bold"),
                "latin": ("S7K Latin", "normal"), "latin-bold": ("S7K Latin", "bold")}
    parts = [
        "<!DOCTYPE html>",
        '<html lang="en"><head><meta charset="utf-8">',
        f"<title>HMS S7-K kit {KIT_VERSION} reference - {NOTICE}</title>",
        "<style>",
    ]
    for key, (family, weight) in families.items():
        parts.append(f'@font-face {{ font-family: "{family}"; font-weight: {weight}; '
                     f'src: url("{REFERENCE_FONT_FILES[key]}"); }}')
    parts += [
        'body { font-family: "S7K Latin", "Noto Sans", sans-serif; font-size: 10pt; margin: 1.5em; }',
        "table { border-collapse: collapse; width: 100%; } td { border: 1px solid #999; padding: 4px 8px; }",
        "td.cap { width: 40%; font-size: 8pt; }",
        '.arabic, .arabic-bold { font-family: "S7K Arabic", "Noto Sans Arabic", serif; }',
        '.latin, .latin-bold, .resident { font-family: "S7K Latin", "Noto Sans", sans-serif; }',
        ".arabic-bold, .latin-bold { font-weight: bold; }",
        ".box { display: inline-block; white-space: pre; border-left: 1px solid #000; border-right: 1px solid #000; }",
        "</style></head><body>",
        f"<h1>{NOTICE}</h1>",
        f"<p>HMS S7-K kit {KIT_VERSION}, reference for the ZPL text-mode patterns at {opts.dpi} dpi. Open it with "
        f"{', '.join(REFERENCE_FONT_FILES.values())} in the same folder, in a browser that shapes with HarfBuzz "
        "(Firefox or Chromium). It shows how the text should look; it is not a golden image. Each row's bidi "
        "caption states what the Unicode Bidirectional Algorithm gives.</p>",
    ]
    for pattern in PATTERNS:
        if not pattern.pid.startswith("ZT"):
            continue
        parts.append(f"<h2>{esc(pattern.pid)} {esc(pattern.slug)}</h2><p>{esc(pattern.purpose)}</p><table>")
        for block in pattern.blocks(opts):
            if isinstance(block, Row):
                direction = "rtl" if block.align == "R" else "ltr"
                parts.append(
                    f'<tr><td class="cap">{esc(block.caption)}</td><td class="{block.font}" dir="{direction}" '
                    f'style="font-size: {block.size_pt:g}pt">{esc(block.text)}</td></tr>'
                )
            elif isinstance(block, BoxLine):
                h = opts.pt_dots(block.size_pt)
                box_mm = math.ceil(latin_text_width(block.text, h) * 100 / block.percent) / opts.dpmm
                parts.append(
                    f'<tr><td class="cap">{esc(block.caption)} (h as the em)</td><td class="latin" dir="ltr">'
                    f'<span class="box" style="width: {box_mm:.2f}mm; font-size: {h / opts.dpmm:.2f}mm">'
                    f"{esc(block.text)}</span></td></tr>"
                )
            elif isinstance(block, RotatedLines):
                for text, font, _justification in block.lines:
                    direction = "rtl" if font.startswith("arabic") else "ltr"
                    parts.append(f'<tr><td class="cap">{esc(block.caption)}</td><td class="{font}" '
                                 f'dir="{direction}" style="font-size: {block.size_pt:g}pt">{esc(text)}</td></tr>')
        parts.append("</table>")
    parts.append("<h2>Expected joining forms (ZT01, ZT02)</h2><table>")
    seen: set[str] = set()
    for letter in SORANI_ALPHABET + tuple(x for pair in VARIANT_PAIRS for x in pair) + EXTRA_LETTERS + ARABIC_ONLY_LETTERS:
        if letter.char in seen:
            continue
        seen.add(letter.char)
        parts.append(f'<tr><td class="cap">{esc(_letter_caption(None, letter))}</td><td>{esc(expected_forms(letter))}</td></tr>')
    parts.append("</table></body></html>")
    return ("\n".join(parts) + "\n").encode("utf-8")


def generate_patterns(opts: Options) -> dict[str, tuple[bytes, str, tuple[str, ...], Optional[int]]]:
    """Every kit file for one resolution: name -> (bytes, purpose, items, dpi or None)."""
    files: dict[str, tuple[bytes, str, tuple[str, ...], Optional[int]]] = {}
    for pattern in PATTERNS:
        files[pattern.file_name(opts.dpi)] = (render_zpl(pattern, opts), pattern.purpose, pattern.items, opts.dpi)
    for name, data, purpose, items in CONFIG_FILES:
        files[name] = (data, purpose, items, None)
    files[ESCPOS_FILE] = (escpos_selftest(), "ESC/POS: Latin lines, a feed and a partial cut on an 80 mm "
                          "receipt or token printer", ("EP-01",), None)
    files[REFERENCE_FILE] = (reference_html(opts), "Reference page for the ZT patterns: open it in a browser "
                             "with the font files beside it", ("ZT-01", "ZT-02", "ZT-05", "ZT-06", "ZT-08", "ZT-10"),
                             opts.dpi)
    return files


def manifest_bytes(opts: Options, files: dict[str, tuple[bytes, str, tuple[str, ...], Optional[int]]]) -> bytes:
    manifest = {
        "kit": "hms-s7k",
        "kit_version": KIT_VERSION,
        "notice": NOTICE,
        "provenance": "synthetic",
        "dpi": opts.dpi,
        "options": {"width_mm": opts.width_mm, "length_mm": opts.length_mm,
                    "arabic_font": opts.arabic_font, "arabic_bold_font": opts.arabic_bold_font,
                    "latin_font": opts.latin_font, "latin_bold_font": opts.latin_bold_font},
        "files": [
            {"file": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "purpose": purpose,
             "items": list(items), "dpi": dpi}
            for name, (data, purpose, items, dpi) in sorted(files.items())
        ],
    }
    return (json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")


def write_patterns(opts: Options, out_dir: Path) -> list[Path]:
    files = generate_patterns(opts)
    written = []
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        for name, (data, _purpose, _items, _dpi) in sorted(files.items()):
            path = out_dir / name
            path.write_bytes(data)
            written.append(path)
        manifest = out_dir / "MANIFEST.json"
        manifest.write_bytes(manifest_bytes(opts, files))
    except OSError as exc:
        raise KitError(f"cannot write the patterns to {out_dir}: {exc}") from exc
    written.append(manifest)
    return written


# --------------------------------------------------------------------------------------------- result items


@dataclass(frozen=True)
class Item:
    iid: str
    applies_to: tuple[str, ...]  # printer kinds
    title: str
    passes_when: str
    source: str  # the kit file, or "HMS engine (later)"
    expected_payload: Optional[str] = None


LABEL = ("label", "wristband")
_MIN_SIZES = ", ".join(f"{pt:g} pt at {dpi} dpi" for dpi, pt in sorted(ARABIC_MIN_PT.items()))
ITEMS: tuple[Item, ...] = (
    Item("CFG-01", LABEL, "Printer identity and firmware recorded",
         "make, model, serial, firmware and DPI are recorded from the ~HI reply and the photographed configuration "
         "label; for ZPL text mode the firmware is V60.14.x or V50.14.x or later (BUILD-PROMPT §4.1)",
         "s7k-cfg-01..03"),
    Item("FNT-01", LABEL, "Fonts downloaded and listed",
         "the ^WD directory label and the ^HW listing show E:NSARAB.TTF, E:NSARABB.TTF, E:NSLATN.TTF and "
         "E:NSLATNB.TTF with the byte sizes of the pinned files, and each recorded sha256 is the pinned one",
         "s7k-cfg-04, s7k-cfg-05 and font-download"),
    Item("ZT-01", LABEL, "Sorani letter chart",
         "every letter in all four positions is correctly joined: dual-joining letters show four different forms, "
         "right-joining letters two, and the beh beside each joins as expected; every Kurdish letter keeps its "
         "marks", "ZT01"),
    Item("ZT-02", LABEL, "Arabic and Kurdish variants, extras",
         "ي/ی and ك/ک differ in the isolated and final positions (their initial and medial forms may look alike); "
         "ه/ە differ; lam-alef forms the ligature; in ڵا, بڵا, ئاڵا and هەڵاڵە the v mark stays on the lam; the "
         "ZWNJ pair does not join and the ZWJ forms are initial, final and medial; the Arabic comma, sample words, "
         "bold rows and the Latin letters ç ê î û ş Ç Ê Î Û Ş print as in the reference", "ZT02"),
    Item("ZT-03", LABEL, "No missing-glyph boxes",
         "no box, question mark or blank appears in place of a letter on ZT01 to ZT05", "ZT01-ZT05"),
    Item("ZT-04", LABEL, "Right-to-left order",
         "Arabic-script text reads right to left, letters in logical order, on ZT01 to ZT05", "ZT01-ZT05"),
    Item("ZT-05", LABEL, "Identifiers not reordered in their own fields",
         "B1 and B2 print SYN-000123-7, 2024-03-21 and 0012345 exactly, in Western digits", "ZT03"),
    Item("ZT-06", LABEL, "Bidi in one mixed RTL field (diagnostic)",
         "B3a keeps the MRN intact and B3b and B3c look as their UBA captions say; record what printed in "
         "'observed'. HMS never prints identity text in a mixed field (platform-docs.md §7.1)", "ZT03"),
    Item("ZT-07", LABEL, "Field-data escapes",
         "B4 prints exactly 'Escape check: ^XZ ~JA end' and the rest of the label follows it; B4b is a diagnostic: "
         "note what it printed", "ZT03"),
    Item("ZT-08", LABEL, "Legibility of dot-differentiated letters",
         f"ب ت ث ن ی پ and the minimal pairs ر/ڕ ل/ڵ ی/ێ و/ۆ ز/ژ ف/ڤ ج/چ ک/گ are told apart without a loupe, alone "
         f"and joined, at every size from the Arabic-script identity minimum up ({_MIN_SIZES}), and the Latin "
         f"identifiers from {LATIN_MIN_PT:g} pt up (platform-docs.md §5.4, OQ-243); record the smallest legible "
         "sizes in 'smallest_legible_pt' and 'smallest_legible_pt_latin'", "ZT04"),
    Item("ZT-09", LABEL, "No clipped or overprinted text",
         "no text on ZT01 to ZT05 and BC01 is cut at an edge or printed over other text", "ZT01-ZT05, BC01"),
    Item("ZT-10", LABEL, "A line at 100% of its ^FB box",
         "every FB row of ZT05 prints on one line, with no wrap and no overprinted characters, between its two "
         "ticks; R1 prints each line between its ticks (HAZ-0045 cause, platform-docs.md §7.1)", "ZT05"),
    Item("ZT-11", LABEL, "^A@ height calibration recorded",
         "the CAL row's h_dots and the measured height of H are recorded in 'font_height_calibration', with the "
         "reading of h (em, cell or other) (platform-docs.md §7.1, §11)", "ZT05"),
    Item("JA-01", LABEL, "~JA before a label",
         "the label of JA01 prints exactly once (a reprint may then be prefixed with ~JA)", "JA01"),
    Item("BC-01", LABEL, "DataMatrix 0.5 mm, wristband payload",
         "five scans in HID-POS mode or under a US-English keyboard layout all return exactly the expected payload",
         "BC01", WRISTBAND_PAYLOAD),
    Item("BC-02", LABEL, "DataMatrix 0.25 mm, specimen payload",
         "five scans in HID-POS mode or under a US-English keyboard layout all return exactly the expected payload",
         "BC01", SPECIMEN_PAYLOAD),
    Item("BC-03", ("label",), "Code 128 (label printers only)",
         "five scans in HID-POS mode or under a US-English keyboard layout all return exactly the expected payload",
         "BC01", CODE128_PAYLOAD),
    Item("ZE-01", LABEL, "HMS engine ZPL text-mode labels",
         "wristband and specimen labels for Sorani, Arabic and Latin patients in en, ckb and ar match the "
         "reference images, never truncated", "HMS engine (later)"),
    Item("ZR-01", LABEL, "HMS engine ^GF raster labels",
         "the same labels in raster mode match the golden images (GoldenImage:wristband-*, "
         "GoldenImage:specimen-label-*)", "HMS engine (later)"),
    Item("FB-01", LABEL, "First-band scan verification",
         "the first wristband after a template or printer change is scanned and the payload equals the expected "
         "payload exactly (§12.8)", "HMS engine (later)"),
    Item("EP-01", ("receipt",), "ESC/POS self-test", "the Latin lines print in full and the paper is cut",
         ESCPOS_FILE),
    Item("EP-02", ("receipt",), "HMS engine ESC/POS raster receipts and tokens",
         "Sorani, Arabic and English receipts and tokens match the golden images (GoldenImage:receipt-escpos-*, "
         "GoldenImage:token-*)", "HMS engine (later)"),
    Item("PD-01", ("document",), "A4 PDF/A documents",
         "the satellite's sample A4 document prints at actual size with correct shaping and the print banner and "
         "watermark on every page", "HMS engine (later)"),
)
ITEM_IDS = tuple(item.iid for item in ITEMS)
ITEMS_BY_ID = {item.iid: item for item in ITEMS}
BARCODE_ITEMS = ("BC-01", "BC-02", "BC-03")
GRADED_ITEMS = ("BC-01", "BC-02")  # DataMatrix: an ISO/IEC 15415 grade where a verifier is available
SCANNER_MODES = ("hid-pos", "keyboard-us-english")  # platform-docs.md §6.1, OQ-246
SCANS_FOR_PASS = 5
TEXT_MODE_ITEMS = ("CFG-01", "FNT-01", "ZT-01", "ZT-02", "ZT-03", "ZT-04", "ZT-05", "ZT-07", "ZT-08", "ZT-09",
                   "ZT-10", "ZT-11", "BC-01", "BC-02", "BC-03", "ZE-01", "FB-01")
RASTER_MODE_ITEMS = ("CFG-01", "BC-01", "BC-02", "BC-03", "ZR-01", "FB-01")


def required_items(mode_items: Iterable[str], kind: str) -> tuple[str, ...]:
    """The items of a print mode that apply to a printer kind (BC-03 is for label printers only)."""
    return tuple(iid for iid in mode_items if kind in ITEMS_BY_ID[iid].applies_to)


# --------------------------------------------------------------------------------------------- send


class HostRefused(KitError):
    """The host is not a local address."""


# Loopback, RFC 1918 and RFC 4193 unique local (fc00::/7): loopback or private only (platform-docs.md §11).
# Nothing else, link-local included: label data never leaves the site (BUILD-PROMPT §3.7).
LOCAL_NETWORKS = tuple(ipaddress.ip_network(n) for n in (
    "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fc00::/7",
))
REFUSAL_TAIL = "is not loopback or private; label data never leaves the site (BUILD-PROMPT §3.7)"


def address_is_local(address: str) -> bool:
    """True for a loopback or private (RFC 1918, RFC 4193) address, also IPv4-mapped or with an IPv6 scope;
    False for anything else."""
    try:
        ip = ipaddress.ip_address(address.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return any(ip.version == net.version and ip in net for net in LOCAL_NETWORKS)


def resolve_local(host: str, port: int) -> list[tuple[int, tuple]]:
    """Resolve ``host`` once and return (family, sockaddr) pairs, or raise HostRefused unless every address it
    resolves to is local. The caller connects to these addresses, never to the name again."""
    if not host or host.strip() != host:
        raise HostRefused("the host is empty or has spaces")
    literal = True
    try:
        ipaddress.ip_address(host.split("%", 1)[0])
    except ValueError:
        literal = False
    if literal and not address_is_local(host):
        raise HostRefused(f"{host} {REFUSAL_TAIL}")
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (OSError, UnicodeError) as exc:
        raise HostRefused(f"{host!r} does not resolve: {exc}") from exc
    if not infos:
        raise HostRefused(f"{host!r} resolves to no address")
    outside = sorted({str(info[4][0]) for info in infos if not address_is_local(str(info[4][0]))})
    if outside:
        raise HostRefused(f"{host!r} resolves to {', '.join(outside)}, which {REFUSAL_TAIL}")
    return [(info[0], info[4]) for info in infos]


def _printable(data: bytes) -> str:
    text = data.decode("utf-8", "replace")
    return "".join(ch if ch in "\n\t" or ord(ch) >= 0x20 else f"<{ord(ch):02X}>" for ch in text)


DRAIN_SECONDS = 0.5
DRAIN_LIMIT = 1 << 20


def _read_for(sock: socket.socket, seconds: float, limit: int) -> bytes:
    """Read until the peer closes, ``seconds`` pass or ``limit`` bytes arrive."""
    data = bytearray()
    deadline = time.monotonic() + seconds
    while len(data) < limit:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        sock.settimeout(remaining)
        try:
            chunk = sock.recv(65536)
        except socket.timeout:
            break
        if not chunk:
            break
        data.extend(chunk)
    return bytes(data)


def send_job(addresses: Sequence[tuple[int, tuple]], data: bytes, timeout: float,
             read_reply: Optional[float]) -> tuple[bytes, Optional[str]]:
    """Send one job over one TCP connection to the first address that accepts it.

    Returns the reply read for ``read_reply`` seconds (b"" when None) and, when reading the reply failed
    after the job was sent, the reason. The connection closes gracefully: shutdown for writing, a brief
    drain, close. Raises OSError when no address accepts the connection or the job cannot be sent.
    """
    last: Optional[OSError] = None
    for family, sockaddr in addresses:
        sock = socket.socket(family, socket.SOCK_STREAM)
        try:
            sock.settimeout(timeout)
            sock.connect(sockaddr)
        except OSError as exc:
            sock.close()
            last = exc
            continue
        try:
            sock.sendall(data)
            reply, reply_error = b"", None
            if read_reply:
                try:
                    reply = _read_for(sock, read_reply, DRAIN_LIMIT)
                except OSError as exc:
                    reply_error = str(exc) or type(exc).__name__
            try:
                sock.shutdown(socket.SHUT_WR)
                _read_for(sock, DRAIN_SECONDS, DRAIN_LIMIT)
            except OSError:
                pass  # the job is sent; the peer may already have closed
            return reply, reply_error
        finally:
            sock.close()
    raise OSError(f"could not connect: {last}")


def _read_file(name: str) -> bytes:
    path = Path(name)
    try:
        return path.read_bytes()
    except OSError as exc:
        raise KitError(f"{name}: cannot read it: {exc.strerror or exc}") from exc


def _write_file(path: Path, data: bytes) -> None:
    try:
        path.write_bytes(data)
    except OSError as exc:
        raise KitError(f"{path}: cannot write it: {exc.strerror or exc}") from exc


def cmd_send(args: argparse.Namespace) -> int:
    if not 1 <= args.port <= 65535:
        raise KitError("--port must be between 1 and 65535")
    jobs = [(Path(name), _read_file(name)) for name in args.files]
    addresses = resolve_local(args.host, args.port)
    shown = ", ".join(sorted({str(sockaddr[0]) for _f, sockaddr in addresses}))
    for index, (path, data) in enumerate(jobs):
        digest = hashlib.sha256(data).hexdigest()
        if args.dry_run:
            print(f"dry run: would send {path} ({len(data)} bytes, sha256 {digest}) to {args.host}:{args.port} "
                  f"[{shown}] as one job")
            continue
        if index and args.pause:
            time.sleep(args.pause)
        try:
            reply, reply_error = send_job(addresses, data, args.timeout, args.read_reply)
        except OSError as exc:
            print(f"error: {path}: {exc}", file=sys.stderr)
            return 1
        print(f"sent {path} ({len(data)} bytes, sha256 {digest}) to {args.host}:{args.port} [{shown}]")
        if reply_error is not None:
            print(f"error: {path}: sent; reply read failed: {reply_error}", file=sys.stderr)
            return 1
        if args.read_reply:
            print(f"reply ({len(reply)} bytes):")
            print(_printable(reply))
            if args.reply_out:
                out = Path(args.reply_out)
                if len(jobs) > 1:
                    out = out.with_name(f"{out.stem}-{index + 1}{out.suffix}")
                _write_file(out, reply)
                print(f"reply saved to {out}")
    return 0


# --------------------------------------------------------------------------------------------- font download


def font_download_command(font: bytes, name: str) -> bytes:
    """``~DYd:f,B,T,<bytes>,,<binary data>`` for a TrueType file (Zebra ZPL II Programming Guide, ~DY).

    b=B (uncompressed binary) and x=T (TrueType, stored as .TTF) follow the guide; leaving w (bytes per row,
    used for graphics) empty is an assumption to verify in S7-K.
    """
    drive, stem = _check_font_name(name)
    if font[:4] not in (b"\x00\x01\x00\x00", b"true"):
        raise KitError("not a TrueType outline font (the file must start with 00 01 00 00 or 'true'; OpenType CFF "
                       "'OTTO' files and 'ttcf' collections are refused)")
    return f"~DY{drive}:{stem},B,T,{len(font)},,".encode("ascii") + font


def pinned_font(name: str) -> Optional[tuple[str, str, str, str]]:
    """The PRINT_FONTS entry for a resident name, or None."""
    return next((entry for entry in PRINT_FONTS if entry[0] == name), None)


def cmd_font_download(args: argparse.Namespace) -> int:
    font = _read_file(args.font)
    command = font_download_command(font, args.name)
    out = Path(args.out)
    _write_file(out, command)
    _drive, stem = _check_font_name(args.name)
    if len(stem) > 8:
        print(f"warning: {stem} is longer than 8 characters; older firmware may refuse it (verify in S7-K)",
              file=sys.stderr)
    digest = hashlib.sha256(font).hexdigest()
    pinned = pinned_font(args.name)
    if pinned is None:
        print(f"warning: {args.name} is not one of the engine's print fonts "
              f"({', '.join(e[0] for e in PRINT_FONTS)})", file=sys.stderr)
    elif digest != pinned[2]:
        print(f"warning: this is not the pinned {pinned[1]} (sha256 {pinned[2]}, {FONT_DIR_IN_REPO}/FONTS.md); "
              "a test with it is not a test of the engine's font", file=sys.stderr)
    print(f"font {Path(args.font).name}: {len(font)} bytes, sha256 {digest}")
    print(f"wrote {out}: {len(command)} bytes, sha256 {hashlib.sha256(command).hexdigest()}, stores {args.name}")
    return 0


def read_ttf_metrics(data: bytes, chars: str) -> dict:
    """Units per em, hhea ascender and descender, OS/2 cap height and the advance widths of ``chars`` from a
    TrueType file (cmap format 4). The tests use it to check the metrics recorded above against the pinned
    font files; the generator never reads a font."""

    def table(tag: bytes) -> int:
        count = struct.unpack(">H", data[4:6])[0]
        for i in range(count):
            name, _checksum, offset, _length = struct.unpack(">4sIII", data[12 + 16 * i: 28 + 16 * i])
            if name == tag:
                return offset
        raise KitError(f"no {tag.decode()} table")

    head, hhea, os2, cmap, hmtx = (table(t) for t in (b"head", b"hhea", b"OS/2", b"cmap", b"hmtx"))
    upem = struct.unpack(">H", data[head + 18: head + 20])[0]
    ascender, descender = struct.unpack(">hh", data[hhea + 4: hhea + 8])
    metrics_count = struct.unpack(">H", data[hhea + 34: hhea + 36])[0]
    cap_height = struct.unpack(">h", data[os2 + 88: os2 + 90])[0]
    glyphs: dict[int, int] = {}
    for i in range(struct.unpack(">H", data[cmap + 2: cmap + 4])[0]):
        platform, encoding, offset = struct.unpack(">HHI", data[cmap + 4 + 8 * i: cmap + 12 + 8 * i])
        sub = cmap + offset
        if (platform, encoding) not in ((3, 1), (0, 3)) or struct.unpack(">H", data[sub: sub + 2])[0] != 4:
            continue
        seg2 = struct.unpack(">H", data[sub + 6: sub + 8])[0]
        seg = seg2 // 2
        ends = struct.unpack(f">{seg}H", data[sub + 14: sub + 14 + seg2])
        starts = struct.unpack(f">{seg}H", data[sub + 16 + seg2: sub + 16 + 2 * seg2])
        deltas = struct.unpack(f">{seg}h", data[sub + 16 + 2 * seg2: sub + 16 + 3 * seg2])
        range_at = sub + 16 + 3 * seg2
        ranges = struct.unpack(f">{seg}H", data[range_at: range_at + seg2])
        for ch in chars:
            code = ord(ch)
            for k in range(seg):
                if starts[k] <= code <= ends[k]:
                    if ranges[k] == 0:
                        glyph = (code + deltas[k]) & 0xFFFF
                    else:
                        at = range_at + 2 * k + ranges[k] + 2 * (code - starts[k])
                        glyph = struct.unpack(">H", data[at: at + 2])[0]
                        glyph = (glyph + deltas[k]) & 0xFFFF if glyph else 0
                    glyphs.setdefault(code, glyph)
                    break
    advances = {}
    for ch in chars:
        glyph = min(glyphs.get(ord(ch), 0), metrics_count - 1)
        advances[ch] = struct.unpack(">H", data[hmtx + 4 * glyph: hmtx + 4 * glyph + 2])[0]
    return {"upem": upem, "ascender": ascender, "descender": -descender, "cap_height": cap_height,
            "advances": advances, "missing": [ch for ch in chars if glyphs.get(ord(ch), 0) == 0]}


# --------------------------------------------------------------------------------------------- form


def _q(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)  # a JSON string is a valid YAML double-quoted scalar


def blank_form() -> str:
    lines = [
        "# S7-K result form for ONE printer (tools/s7k/README.md). Fill it in by hand, then check it:",
        "#   .tools/venv/Scripts/python.exe -I tools/s7k/s7k.py check-form <this file>",
        f"# Everything the kit prints is synthetic: {NOTICE}.",
        "# Never write a name into 'approval': a human's approval is a sign-off record (BUILD-PROMPT §3.5).",
        f"form: {_q(FORM_ID)}",
        f"kit_version: {_q(KIT_VERSION)}",
        "provenance: test-result  # test-result | example",
        'date: ""  # YYYY-MM-DD, the day the prints were made',
        "tester:",
        '  name: ""  # the person who ran the test writes their own name',
        '  role: ""',
        "site:",
        '  name: ""',
        '  network: ""  # for example: isolated print VLAN, no internet route',
        "printer:",
        '  make: ""',
        '  model: ""',
        '  serial: ""',
        '  firmware: ""  # from the ~HI reply or the configuration label',
        "  dpi: 203  # label printers: 203 | 300 | 600, as the configuration label says",
        "  kind: label  # label | wristband | receipt | document",
        "  connection: network  # network | usb",
        '  host_identification: ""  # the ~HI reply, verbatim',
        '  resident_font_listing: ""  # the ^HW reply (s7k-cfg-05), verbatim',
        "  evidence: []  # file names of the configuration label photo or scan",
        f"fonts:  # one entry per downloaded font file ({FONT_DIR_IN_REPO})",
    ]
    for name, source, _sha, _version in PRINT_FONTS:
        lines += [
            f"  - file: {_q(name)}",
            f"    source_file: {_q(source)}",
            '    sha256: ""  # sha256 of the source font file (font-download prints it; must be the pinned one)',
            '    download_sha256: ""  # sha256 of the ~DY file sent',
            '    font_version: ""',
        ]
    lines += [
        "kit_files:",
        '  dpi_dir: ""  # for example tools/s7k/patterns/203',
        '  manifest_sha256: ""  # sha256 of the MANIFEST.json of the files sent',
        "font_height_calibration:  # ZT-11, from the CAL row of ZT05",
        "  h_dots: null  # the h the CAL caption states",
        "  cap_height_mm: null  # the measured height of H",
        "  interpretation: not-measured  # em | cell | other | not-measured",
        "items:  # result: pass | fail | not-run. pass or fail needs evidence; fail needs notes.",
    ]
    for item in ITEMS:
        lines += [
            f"  - id: {_q(item.iid)}",
            f"    # {item.title} ({', '.join(item.applies_to)}; from {item.source})",
            f"    # passes when: {item.passes_when}",
            "    result: not-run",
            '    notes: ""',
            "    evidence: []",
        ]
        if item.expected_payload is not None:
            lines += [
                f"    expected_payload: {_q(item.expected_payload)}",
                f"    decoded_payloads: []  # all {SCANS_FOR_PASS} scans, exactly as the scanner returned them",
                '    scanner: ""  # scanner make and model',
                '    scanner_mode: ""  # hid-pos | keyboard-us-english (never an Arabic or Sorani layout)',
            ]
        if item.iid in GRADED_ITEMS:
            lines.append('    grade: ""  # optional: ISO/IEC 15415 overall grade (A-F or 0.0-4.0) from a verifier')
        if item.iid == "ZT-08":
            lines.append("    smallest_legible_pt: null  # Arabic script, 6 to 12")
            lines.append("    smallest_legible_pt_latin: null  # Latin identifiers, 6 to 12")
        if item.iid == "ZT-06":
            lines.append('    observed: ""  # what B3a, B3b and B3c showed')
    lines += [
        "approval:  # human sign-off; the agent never fills it (BUILD-PROMPT §3.5)",
        "  status: requested",
        "  approved_by: []",
    ]
    return "\n".join(lines) + "\n"


def cmd_form(args: argparse.Namespace) -> int:
    out = Path(args.out)
    if out.exists() and not args.force:
        raise KitError(f"{out} exists; use --force to overwrite it")
    _write_file(out, blank_form().encode("utf-8"))
    print(f"wrote {out}")
    return 0


def _normalise(value):
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _normalise(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalise(v) for v in value]
    return value


def _barcode_errors(item: dict, expected: str) -> list[str]:
    iid, result = item["id"], item["result"]
    errors = []
    if item.get("expected_payload") != expected:
        errors.append(f"items {iid}: expected_payload must be {expected!r}")
    if result != "pass":
        return errors
    decoded = item.get("decoded_payloads") or []
    if len(decoded) < SCANS_FOR_PASS:
        errors.append(f"items {iid}: pass needs all {SCANS_FOR_PASS} decodes in decoded_payloads, got {len(decoded)}")
    for n, value in enumerate(decoded, start=1):
        if value != expected:
            errors.append(f"items {iid}: pass needs every decode exactly equal to {expected!r}; decode {n} is "
                          f"{value!r}")
    if not str(item.get("scanner", "")).strip():
        errors.append(f"items {iid}: pass needs the scanner make and model in 'scanner'")
    if item.get("scanner_mode") not in SCANNER_MODES:
        errors.append(f"items {iid}: pass needs scanner_mode {' or '.join(SCANNER_MODES)} (platform-docs.md §6.1, "
                      "OQ-246)")
    return errors


def semantic_errors(form: dict) -> tuple[list[str], list[str]]:
    """Rules the schema cannot state. Run only on a form that passed the schema."""
    errors: list[str] = []
    warnings: list[str] = []
    items = form["items"]
    printer = form["printer"]
    seen: dict[str, int] = {}
    for item in items:
        seen[item["id"]] = seen.get(item["id"], 0) + 1
    for iid in ITEM_IDS:
        if seen.get(iid, 0) == 0:
            errors.append(f"items: {iid} is missing")
        elif seen[iid] > 1:
            errors.append(f"items: {iid} appears {seen[iid]} times")
    run = False
    for item in items:
        iid, result = item["id"], item["result"]
        if result != "not-run":
            run = True
            if not item.get("evidence"):
                errors.append(f"items {iid}: a {result} result needs at least one evidence file (photo or scan)")
        if result == "fail" and not item.get("notes", "").strip():
            errors.append(f"items {iid}: a fail result needs notes saying what was wrong")
        expected = ITEMS_BY_ID[iid].expected_payload
        if expected is not None:
            errors += _barcode_errors(item, expected)
        else:
            for key in ("expected_payload", "decoded_payloads", "scanner", "scanner_mode"):
                if key in item:
                    errors.append(f"items {iid}: '{key}' belongs to the barcode items only")
        if "grade" in item and iid not in GRADED_ITEMS:
            errors.append(f"items {iid}: 'grade' (ISO/IEC 15415) belongs to the DataMatrix items BC-01, BC-02 only")
        for key in ("smallest_legible_pt", "smallest_legible_pt_latin"):
            if key in item and iid != "ZT-08":
                errors.append(f"items {iid}: '{key}' belongs to ZT-08 only")
        if iid == "ZT-08" and result == "pass":
            errors += _legibility_errors(item, printer["dpi"])
        if iid == "ZT-11" and result == "pass":
            calibration = form["font_height_calibration"]
            if calibration["h_dots"] is None or calibration["cap_height_mm"] is None \
                    or calibration["interpretation"] == "not-measured":
                errors.append("items ZT-11: pass needs font_height_calibration h_dots, cap_height_mm and an "
                              "interpretation")
    if printer["kind"] in LABEL and printer["dpi"] not in DOTS_PER_MM:
        errors.append(f"printer.dpi: a label printer here is 203, 300 or 600 dpi, not {printer['dpi']}")
    synthetic_printer = str(printer["make"]).startswith("SYN-") or str(printer["model"]).startswith("SYN-")
    if form["provenance"] == "example":
        if not str(printer["model"]).startswith("SYN-") or not str(printer["make"]).startswith("SYN-"):
            errors.append("printer: an example form names a synthetic printer (make and model starting SYN-)")
    else:
        if synthetic_printer:
            errors.append("printer: a SYN- make or model is an example printer; a test-result form names the real "
                          "printer (or set provenance: example)")
        if run:
            if not form["date"]:
                errors.append("date: a form with results needs the date the prints were made")
            if not form["tester"]["name"].strip():
                errors.append("tester.name: the person who ran the test writes their name")
            for key in ("make", "model", "serial", "firmware"):
                if not str(printer[key]).strip():
                    errors.append(f"printer.{key}: needed once any item has a result")
    if form["date"]:
        try:
            datetime.date.fromisoformat(form["date"])
        except ValueError:
            errors.append(f"date: {form['date']!r} is not a calendar date")
    for entry in form["fonts"]:
        pinned = pinned_font(entry["file"])
        if entry["sha256"] and (pinned is None or entry["sha256"] != pinned[2]):
            errors.append(f"fonts {entry['file']}: sha256 is not the pinned font's ({FONT_DIR_IN_REPO}/FONTS.md)")
    if run and printer["kind"] in LABEL and not any(f.get("sha256") for f in form["fonts"]):
        warnings.append("fonts: no font sha256 recorded; ZPL text-mode results cannot be tied to a font file")
    return errors, warnings


def _legibility_errors(item: dict, dpi: int) -> list[str]:
    errors = []
    arabic_min = ARABIC_MIN_PT.get(dpi)
    size = item.get("smallest_legible_pt")
    latin = item.get("smallest_legible_pt_latin")
    if size is None:
        errors.append("items ZT-08: pass needs smallest_legible_pt")
    elif arabic_min is not None and size > arabic_min:
        errors.append(f"items ZT-08: smallest legible Arabic-script size {size:g} pt is above the {arabic_min:g} pt "
                      f"minimum at {dpi} dpi (platform-docs.md §5.4, OQ-243), so the result is fail")
    if latin is None:
        errors.append("items ZT-08: pass needs smallest_legible_pt_latin")
    elif latin > LATIN_MIN_PT:
        errors.append(f"items ZT-08: smallest legible Latin size {latin:g} pt is above the {LATIN_MIN_PT:g} pt "
                      "minimum (platform-docs.md §5.4, OQ-243), so the result is fail")
    return errors


def implied_listing(form: dict) -> dict[str, str]:
    """What the results imply for the Supported Hardware List. Advisory: the listing is a human decision."""
    results = {item["id"]: item["result"] for item in form["items"]}

    def status(required: Iterable[str]) -> str:
        values = [results.get(iid, "not-run") for iid in required]
        if any(v == "fail" for v in values):
            return "not-eligible"
        return "eligible" if all(v == "pass" for v in values) else "incomplete"

    kind = form["printer"]["kind"]
    if kind in LABEL:
        return {"zpl-text": status(required_items(TEXT_MODE_ITEMS, kind)),
                "zpl-raster": status(required_items(RASTER_MODE_ITEMS, kind)),
                "ja-prefix": {"pass": "allowed", "fail": "not-allowed"}.get(results.get("JA-01", ""), "untested")}
    if kind == "receipt":
        return {"escpos-raster": status(("EP-01", "EP-02"))}
    return {"pdf": status(("PD-01",))}


def check_form(path: Path) -> tuple[list[str], list[str], dict[str, str], Optional[str]]:
    """Errors, warnings, the implied listing and the form's provenance."""
    try:
        import jsonschema  # the project venv provides these (tools/requirements.in)
        import yaml
    except ImportError as exc:
        raise KitError(f"check-form needs PyYAML and jsonschema from the project venv: {exc}") from exc
    try:
        form = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, yaml.YAMLError) as exc:
        return [f"cannot read {path}: {exc}"], [], {}, None
    form = _normalise(form)
    provenance = form.get("provenance") if isinstance(form, dict) else None
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema)
    errors = []
    for error in sorted(validator.iter_errors(form), key=lambda e: [str(p) for p in e.absolute_path]):
        where = "/".join(str(p) for p in error.absolute_path) or "(root)"
        errors.append(f"{where}: {error.message}")
    approval = form.get("approval") if isinstance(form, dict) else None
    if isinstance(approval, dict) and approval.get("approved_by"):
        errors.append("approval.approved_by must stay empty: an approval is recorded only by a human, in a sign-off "
                      "record (BUILD-PROMPT §3.5)")
    if errors:
        return errors, [], {}, provenance
    more, warnings = semantic_errors(form)
    return more, warnings, ({} if more else implied_listing(form)), provenance


def cmd_check_form(args: argparse.Namespace) -> int:
    path = Path(args.file)
    if not path.is_file():
        raise KitError(f"{args.file}: no such file")
    errors, warnings, listing, provenance = check_form(path)
    for warning in warnings:
        print(f"warning: {warning}")
    for error in errors:
        print(f"error: {error}")
    if errors:
        print(f"check-form: FAIL ({len(errors)} errors)")
        return 1
    if provenance == "example":
        print("EXAMPLE – not a test result: this form is a synthetic example and is never evidence (§3.5)")
    print("implied for the Supported Hardware List (advisory; the listing is a human decision): "
          + ", ".join(f"{k} {v}" for k, v in listing.items()))
    print("check-form: PASS")
    return 0


# --------------------------------------------------------------------------------------------- list and main


def cmd_list(args: argparse.Namespace) -> int:
    entries = [{"file": p.file_name(0).replace("-0.zpl", "-<dpi>.zpl"), "purpose": p.purpose, "items": list(p.items)}
               for p in PATTERNS]
    entries += [{"file": name, "purpose": purpose, "items": list(items)} for name, _d, purpose, items in CONFIG_FILES]
    entries.append({"file": ESCPOS_FILE, "purpose": "ESC/POS self-test: Latin lines and a partial cut",
                    "items": ["EP-01"]})
    entries.append({"file": REFERENCE_FILE, "purpose": "Reference page for the ZT patterns", "items": []})
    later = [{"item": i.iid, "title": i.title} for i in ITEMS if i.source == "HMS engine (later)"]
    if args.json:
        print(json.dumps({"kit_version": KIT_VERSION, "files": entries, "items": list(ITEM_IDS),
                          "from_hms_engine_later": later}, indent=2, ensure_ascii=False))
        return 0
    print(f"HMS S7-K kit {KIT_VERSION} ({NOTICE}). Generated per DPI by: s7k.py patterns --dpi 203|300|600 --out DIR")
    for entry in entries:
        print(f"  {entry['file']}\n      {entry['purpose']} [{', '.join(entry['items'])}]")
    print("Test files that come from the HMS engine later (not in this kit yet):")
    for entry in later:
        print(f"  {entry['item']} {entry['title']}")
    return 0


def cmd_patterns(args: argparse.Namespace) -> int:
    opts = Options(dpi=args.dpi, width_mm=args.width_mm, length_mm=args.length_mm,
                   arabic_font=args.arabic_font, latin_font=args.latin_font,
                   arabic_bold_font=args.arabic_bold_font, latin_bold_font=args.latin_bold_font)
    for path in write_patterns(opts, Path(args.out)):
        print(f"wrote {path}")
    return 0


def _seconds(minimum_exclusive: bool):
    """An argparse type: a finite number of seconds, above zero or at least zero."""

    def parse(text: str) -> float:
        try:
            value = float(text)
        except ValueError:
            raise argparse.ArgumentTypeError(f"{text!r} is not a number of seconds") from None
        if not math.isfinite(value) or value < 0 or (minimum_exclusive and value == 0):
            raise argparse.ArgumentTypeError(f"{text!r} must be a finite number of seconds "
                                             f"{'above zero' if minimum_exclusive else 'of zero or more'}")
        return value

    return parse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="s7k.py", description=f"HMS S7-K printer test kit {KIT_VERSION} ({NOTICE}). "
                                     "Protocol: tools/s7k/README.md.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("list", help="list the kit's test files and their purpose")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("send", help="send raw files to a printer on the local network over TCP (port 9100)")
    p.add_argument("--host", required=True, help="a loopback or private address, or a name resolving only to such "
                   "addresses")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--dry-run", action="store_true", help="check the host and show what would be sent; send nothing")
    p.add_argument("--timeout", type=_seconds(True), default=10.0, help="connect and send timeout in seconds")
    p.add_argument("--read-reply", type=_seconds(True), default=None, metavar="SECONDS",
                   help="after sending, read the printer's reply for this long (for ~HI, ^HH and ^HW)")
    p.add_argument("--reply-out", help="also save the raw reply to this file")
    p.add_argument("--pause", type=_seconds(False), default=0.0, help="seconds to wait between files")
    p.add_argument("files", nargs="+", metavar="FILE")
    p.set_defaults(func=cmd_send)

    p = sub.add_parser("font-download", help="write a ZPL ~DY command that stores a TrueType font on the printer")
    p.add_argument("--font", required=True, help="the TrueType file")
    p.add_argument("--name", required=True, help="printer drive and name, for example E:NSARAB.TTF")
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_font_download)

    p = sub.add_parser("patterns", help="generate the printer-independent test files for one resolution")
    p.add_argument("--dpi", type=int, required=True, choices=sorted(DOTS_PER_MM))
    p.add_argument("--out", required=True)
    p.add_argument("--width-mm", type=float, default=DEFAULT_WIDTH_MM, help="print width (default 101.6, 4 in)")
    p.add_argument("--length-mm", type=float, default=DEFAULT_LENGTH_MM, help="label length (default 152.4, 6 in)")
    p.add_argument("--arabic-font", default=DEFAULT_ARABIC_FONT)
    p.add_argument("--latin-font", default=DEFAULT_LATIN_FONT)
    p.add_argument("--arabic-bold-font", default=DEFAULT_ARABIC_BOLD_FONT)
    p.add_argument("--latin-bold-font", default=DEFAULT_LATIN_BOLD_FONT)
    p.set_defaults(func=cmd_patterns)

    p = sub.add_parser("form", help="write a blank result form (YAML) for one printer")
    p.add_argument("--out", required=True)
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_form)

    p = sub.add_parser("check-form", help="validate a filled result form (needs the project venv)")
    p.add_argument("file")
    p.set_defaults(func=cmd_check_form)
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except KitError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
