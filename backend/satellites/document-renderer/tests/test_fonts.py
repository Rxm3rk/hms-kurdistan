"""Hermetic fonts and R7/R8 text: integrity against fonts.json and the satellite's pins, the HTML text check, and the
checks over every laid-out and drawn text run (docs/specs/modules/platform-docs.md §3.2 R7 and R8, §7.5, §9).

Includes the regression tests of the WP-0.8 renderer reviews: safety 1 (the coverage check bypassed by text the
layout draws but the HTML does not spell out), 3 (R8 in the satellite), 4 (markup that reorders text), 10 (each glyph
from its element's font chain) and correctness 3 (the .notdef warning is fatal) and 6 (the font pins).
"""

from __future__ import annotations

import base64
import contextlib
import json
import logging
import shutil
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock

from hms_docrender import checks
from hms_docrender.fonts import (
    FONT_FILES, PINNED_FONT_SHA256, R7_BIDI_MARKUP, R7_FONT_OUTSIDE_CHAIN, R7_MARK_WITHOUT_BASE, R7_NOT_NFC,
    R7_UNCOVERED, R7_UNKNOWN_GLYPH, R8_EASTERN_DIGIT, FontIntegrityError, FontSet, UnrenderableText,
    character_problems, check_characters, css_content_strings, document_text, font_dir_default,
)
from hms_docrender.render import RenderRefused, _Collect, render
from tests.support import html_document, make_request, requires_fonts

SORANI = "پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە ھ"
ARABIC = "ي ی ك ک ه ە ى ة ء أ إ ؤ ئ آ ، ؛ ؟"
ARABIC_FONT = "font-family: 'HMS Arabic', 'HMS Latin'"


class TempFontDir:
    """A copy of the font directory that a test may damage."""

    def __enter__(self) -> Path:
        self._tmp = tempfile.TemporaryDirectory()
        self.path = Path(self._tmp.name) / "fonts"
        shutil.copytree(font_dir_default(), self.path)
        return self.path

    def __exit__(self, *exc: object) -> None:
        self._tmp.cleanup()


def refusal(body: str, head: str = "") -> RenderRefused:
    try:
        render(make_request(html_document(body, head=head)))
    except RenderRefused as exc:
        return exc
    raise AssertionError("the render was not refused")


@requires_fonts
class FontIntegrityTest(unittest.TestCase):
    """UnitTest:renderer-refuses-font-hash-mismatch: every font file must match fonts.json and the satellite's pins."""

    def test_the_module_fonts_verify(self) -> None:
        fonts = FontSet.load()
        self.assertEqual(set(fonts.sha256s()), set(FONT_FILES.values()))

    def test_the_satellite_pins_equal_the_module_fonts_json(self) -> None:
        """Review correctness 6: the satellite carries the same four pins as the module's fonts.json."""
        entries = json.loads((font_dir_default() / "fonts.json").read_text(encoding="utf-8"))
        entries = entries["fonts"] if isinstance(entries, dict) else entries
        self.assertEqual({e["file"]: e["sha256"] for e in entries if e["file"] in PINNED_FONT_SHA256}, dict(PINNED_FONT_SHA256))

    def test_a_tampered_font_is_refused_and_the_render_does_not_run(self) -> None:
        with TempFontDir() as directory:
            target = directory / "NotoSans-Regular.ttf"
            data = bytearray(target.read_bytes())
            data[len(data) // 2] ^= 0x01
            target.write_bytes(bytes(data))
            with self.assertRaises(FontIntegrityError) as caught:
                FontSet.load(directory)
            self.assertIn("NotoSans-Regular.ttf", str(caught.exception))
            with self.assertRaises(RenderRefused) as refused:
                render(make_request(), font_dir=directory)
            self.assertEqual(refused.exception.code, "font-integrity")

    def test_other_fonts_with_a_matching_fonts_json_are_refused(self) -> None:
        """Review correctness 6: --font-dir pointing at other fonts plus a fonts.json that pins them still refuses."""
        with TempFontDir() as directory:
            shutil.copyfile(directory / "NotoSans-Bold.ttf", directory / "NotoSans-Regular.ttf")
            entries = self.entries(directory)
            bold = next(e["sha256"] for e in entries if e["file"] == "NotoSans-Bold.ttf")
            for entry in entries:
                if entry["file"] == "NotoSans-Regular.ttf":
                    entry["sha256"] = bold
            (directory / "fonts.json").write_text(json.dumps(entries), encoding="utf-8")
            with self.assertRaises(FontIntegrityError) as caught:
                FontSet.load(directory)
            self.assertIn("satellite's pin", str(caught.exception))
            with self.assertRaises(RenderRefused) as refused:
                render(make_request(), font_dir=directory)
            self.assertEqual(refused.exception.code, "font-integrity")

    def test_missing_files_and_bad_pins_are_refused(self) -> None:
        def damage_missing_font(d: Path) -> None:
            (d / "NotoSansArabic-Bold.ttf").unlink()

        def damage_missing_json(d: Path) -> None:
            (d / "fonts.json").unlink()

        def damage_missing_entry(d: Path) -> None:
            entries = [e for e in self.entries(d) if e["file"] != "NotoSans-Bold.ttf"]
            (d / "fonts.json").write_text(json.dumps(entries), encoding="utf-8")

        def damage_duplicate_entry(d: Path) -> None:
            entries = self.entries(d)
            (d / "fonts.json").write_text(json.dumps(entries + entries[:1]), encoding="utf-8")

        def damage_bad_hash(d: Path) -> None:
            entries = self.entries(d)
            entries[0]["sha256"] = entries[0]["sha256"].upper()
            (d / "fonts.json").write_text(json.dumps(entries), encoding="utf-8")

        def damage_not_json(d: Path) -> None:
            (d / "fonts.json").write_text("{", encoding="utf-8")

        for damage in (damage_missing_font, damage_missing_json, damage_missing_entry, damage_duplicate_entry,
                       damage_bad_hash, damage_not_json):
            with self.subTest(damage=damage.__name__), TempFontDir() as directory:
                damage(directory)
                with self.assertRaises(FontIntegrityError):
                    FontSet.load(directory)

    @staticmethod
    def entries(directory: Path) -> list[dict]:
        data = json.loads((directory / "fonts.json").read_text(encoding="utf-8"))
        return list(data["fonts"] if isinstance(data, dict) else data)


class CharacterCheckTest(unittest.TestCase):
    """UnitTest:renderer-refuses-uncovered-characters (R7 and R8 for all text): reason codes and counts, never the text."""

    COVERAGE = frozenset(ord(c) for c in "abcSYN-0123 \u0301\u0661")

    def test_refusals_name_reason_codes_never_the_text(self) -> None:
        cases = {
            "uncovered": ("abc中", "r7-uncovered"),
            "bidi override": ("abc\u202eSYN", "r7-format"),
            "bidi isolate": ("\u2068abc\u2069", "r7-format"),
            "control": ("abc\u0007", "r7-control"),
            "not NFC": ("e\u0301", "r7-not-nfc"),
            "lone surrogate": ("abc\ud800", "r7-surrogate"),
            "Arabic-Indic digit": ("SYN \u0661\u0662", "r8-eastern-digit"),
            "Extended Arabic-Indic digit": ("SYN \u06f1", "r8-eastern-digit"),
        }
        for label, (text, code) in cases.items():
            with self.subTest(case=label), self.assertRaises(UnrenderableText) as caught:
                check_characters([text], self.COVERAGE)
            self.assertNotIn(text, str(caught.exception))
            self.assertIn(code, caught.exception.problems)
            self.assertRegex(str(caught.exception), r"^[a-z]+: ([a-z0-9-]+=\d+(, )?)+$")

    def test_r8_covers_both_eastern_digit_ranges_and_only_them(self) -> None:
        """Review safety 3: U+0660-0669 and U+06F0-06F9 are refused even when a font covers them."""
        everything = frozenset(range(0x10000))
        for code in [*range(0x0660, 0x066A), *range(0x06F0, 0x06FA)]:
            self.assertEqual(character_problems([f"SYN {chr(code)}"], everything), Counter({R8_EASTERN_DIGIT: 1}))
        self.assertEqual(character_problems(["SYN 0123456789 \u066b \u06fa"], everything), Counter())

    def test_a_combining_mark_split_from_its_base_is_refused(self) -> None:
        """Review safety 1: a<b>&#x301;</b> passed a per-run NFC check; the runs joined and a mark-led run now refuse."""
        problems = character_problems(["a", "\u0301"], self.COVERAGE)
        self.assertEqual(problems[R7_MARK_WITHOUT_BASE], 1)
        self.assertEqual(problems[R7_NOT_NFC], 1)
        self.assertEqual(character_problems(["\u0627", "\u0653"], frozenset({0x627, 0x653}))[R7_NOT_NFC], 1)

    def test_joiners_and_html_whitespace_pass_without_glyphs(self) -> None:
        check_characters(["abc\u200cSYN\u200d0123\u200b\n\t\r"], self.COVERAGE)

    def test_text_extraction(self) -> None:
        html = ("<html><head><title>中</title><style>p::before { content: \"S\\59 N\" } .x { color: red }</style>"
                "<script>var x = '中';</script><p style='quotes: none'>abc</p><svg><text>SYN</text></svg>")
        texts = document_text(html)
        self.assertIn("abc", texts)
        self.assertIn("SYN", texts)
        self.assertNotIn("中", "".join(texts))

    def test_body_text_counts_when_the_head_end_tag_is_omitted(self) -> None:
        self.assertIn("中", "".join(document_text("<html><head><meta charset=utf-8><p>中</p>")))

    def test_css_content_strings(self) -> None:
        self.assertEqual(css_content_strings('a::after { content: "x" counter(p) \'\\4E2D\' }'), ["x", "中"])

    @requires_fonts
    def test_sorani_and_arabic_letters_are_covered(self) -> None:
        fonts = FontSet.load()
        fonts.check_text(html_document(f"<p>{SORANI}</p><p>{ARABIC}</p><p>شیلان ئەحمەد کەریم Shilan Ahmed Karim SYN-000123-7 ~1990</p>"))

    @requires_fonts
    def test_an_uncovered_character_refuses_the_render(self) -> None:
        for text in ("SYN 中", "SYN \u2248 1990", "SYN \u202e1-321000-NYS", "<style>p::after { content: '\\4E2D' }</style>SYN",
                     "SYN \u0661\u0669\u0669\u0660"):
            with self.subTest(text=text), self.assertRaises(RenderRefused) as caught:
                render(make_request(html_document(f"<p>{text}</p>")))
            self.assertEqual(caught.exception.code, "unrenderable-text")
            self.assertNotIn("中", caught.exception.detail)

    @requires_fonts
    def test_the_approximate_marker_is_in_the_print_fonts_and_the_old_one_is_not(self) -> None:
        """§3.2 R5 uses "~" (U+007E); "≈" (U+2248) is in none of the four fonts, which is why the spec dropped it."""
        coverage = FontSet.load().coverage
        self.assertIn(ord("~"), coverage)
        self.assertNotIn(0x2248, coverage)


@requires_fonts
class LaidOutTextTest(unittest.TestCase):
    """Review safety 1 and 3: R7 and R8 over every laid-out text box, whatever produced the text."""

    def test_text_the_html_check_cannot_see_is_refused_after_layout(self) -> None:
        cases = {
            "<xmp> (tinyhtml5 keeps its content as text)": ("<xmp><title>\u4e2d SYN</title></xmp>", R7_UNCOVERED),
            "<plaintext>": ("<p>SYN</p><plaintext><title>\u4e2d</title>", R7_UNCOVERED),
            "attr()": ('<p data-x="\u4e2d" class="a">SYN</p><style>.a::after { content: attr(data-x) }</style>', R7_UNCOVERED),
            "<input value>": ('<p><input value="\u4e2d SYN"></p>', R7_UNCOVERED),
            "cjk-decimal list marker": ('<ol style="list-style-type: cjk-decimal"><li>SYN</li></ol>', R7_UNCOVERED),
            "arabic-indic list marker": ('<ol style="list-style-type: arabic-indic"><li>SYN</li></ol>', R8_EASTERN_DIGIT),
            "arabic-indic counter()": ('<style>p::before { content: counter(x, arabic-indic) } p { counter-increment: x 5 }</style><p>SYN</p>',
                                       R8_EASTERN_DIGIT),
            "Eastern digits from attr()": ('<p data-x="\u0661\u0662" class="a">SYN</p><style>.a::after { content: attr(data-x) }</style>',
                                           R8_EASTERN_DIGIT),
            "control character from attr()": ('<p data-x="SYN&#x7;" class="a">SYN</p><style>.a::after { content: attr(data-x) }</style>',
                                              "r7-control"),
            "absolutely positioned text": ('<div style="position: absolute; top: 5mm" data-x="\u4e2d" class="a">SYN</div>'
                                           '<style>.a::after { content: attr(data-x) }</style>', R7_UNCOVERED),
            "page margin box": ('<style>@page { @bottom-center { content: counter(page, arabic-indic) } }</style><p>SYN</p>',
                                R8_EASTERN_DIGIT),
        }
        for label, (body, code) in cases.items():
            with self.subTest(case=label):
                caught = refusal(body)
                self.assertEqual(caught.code, "unrenderable-text")
                self.assertIn(code, caught.detail)
                self.assertNotIn("\u4e2d", caught.detail)

    def test_a_missing_glyph_in_an_svg_image_is_refused_when_drawn(self) -> None:
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><text y="15" font-family="HMS Latin">\u4e2d</text></svg>'
        caught = refusal(f'<img src="data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}" style="width: 10mm">')
        self.assertEqual(caught.code, "unrenderable-text")
        self.assertIn(R7_UNKNOWN_GLYPH, caught.detail)

    def test_eastern_digits_in_an_svg_image_are_refused_when_drawn(self) -> None:
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><text y="15" font-family="HMS Arabic">\u0661\u0662</text></svg>'
        caught = refusal(f'<img src="data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}" style="width: 10mm">')
        self.assertIn(R8_EASTERN_DIGIT, caught.detail)

    def test_the_notdef_warning_alone_refuses(self) -> None:
        """Review correctness 3: with the layout and draw checks disabled, WeasyPrint's .notdef warning still refuses."""
        with mock.patch.object(checks.TextAudit, "check_layout", lambda self, document: Counter()), \
                mock.patch.object(checks.TextAudit, "draw_hook", lambda self: contextlib.nullcontext(self)):
            caught = refusal('<p data-x="\u4e2d" class="a">SYN</p><style>.a::after { content: attr(data-x) }</style>')
        self.assertEqual((caught.code, caught.detail), ("unrenderable-text", f"draw: {R7_UNKNOWN_GLYPH}=1"))

    def test_the_collector_maps_messages_to_codes_and_never_keeps_their_text(self) -> None:
        collector = _Collect()
        for level, template, args in ((logging.WARNING, '.notdef glyph rendered for Unicode string unsupported by fonts: "%s" (U+%04X)', ("\u4e2d", 0x4E2D)),
                                      (logging.ERROR, "Failed to load image at %r: %s", ("data:image/png;base64,SYN-SECRET", "x")),
                                      (logging.ERROR, "Something new %s", ("SYN-SECRET",)),
                                      (logging.WARNING, "Ignored %s", ("SYN-SECRET",))):
            collector.emit(logging.LogRecord("weasyprint", level, __file__, 1, template, args, None))
        self.assertEqual(collector.notdef, 1)
        self.assertEqual(collector.fatal, Counter({"image-load-failed": 1, "weasyprint-error": 1}))

    def test_a_glyph_from_a_font_outside_its_elements_chain_is_refused(self) -> None:
        """Review safety 10: R7 "a glyph in its element's font chain"; fallback to another pinned font is refused."""
        cases = {
            "Arabic text in a Latin-only element": "<p style=\"font-family: 'HMS Latin'\">SYN شیلان</p>",
            "a dash missing from the Arabic font": "<p style=\"font-family: 'HMS Arabic'\">شیلان \u2014 x</p>",
            "a generic family only": "<p style=\"font-family: serif\">SYN</p>",
        }
        for label, body in cases.items():
            with self.subTest(case=label):
                self.assertIn(R7_FONT_OUTSIDE_CHAIN, refusal(body).detail)
        render(make_request(html_document(f"<p style=\"{ARABIC_FONT}\">شیلان \u2014 SYN</p>")))  # both fonts in the chain


@requires_fonts
class ReorderingMarkupTest(unittest.TestCase):
    """Review safety 4: <bdo>, bidi-override, isolate-override and unicode-bidi: plaintext are refused (R7)."""

    def test_markup_that_reorders_text_is_refused(self) -> None:
        cases = {
            "<bdo>": '<p><bdo dir="rtl">SYN-000123-7</bdo></p>',
            "bidi-override (style attribute)": '<p style="unicode-bidi: bidi-override; direction: rtl">SYN-000123-7</p>',
            "isolate-override (style element)": "<style>p { unicode-bidi: isolate-override }</style><p>SYN</p>",
            "plaintext": "<style>@media print { p { unicode-bidi: plaintext } }</style><p>SYN</p>",
            "escaped bidi-override": '<p style="unicode-bidi: bidi-overrid\\65">SYN</p>',
            "SVG presentation attribute": '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text unicode-bidi="bidi-override">SYN</text></svg>',
        }
        for label, body in cases.items():
            with self.subTest(case=label):
                caught = refusal(body)
                self.assertEqual((caught.code, caught.detail.split(":")[0]), ("unrenderable-text", "document"))
                self.assertIn(R7_BIDI_MARKUP, caught.detail)

    def test_isolate_is_allowed(self) -> None:
        render(make_request(html_document('<p style="unicode-bidi: isolate; direction: ltr">SYN-000123-7</p>')))


if __name__ == "__main__":
    unittest.main()
