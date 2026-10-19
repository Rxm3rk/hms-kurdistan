"""Hermetic fonts: integrity against fonts.json and the character-map check (docs/specs/modules/platform-docs.md §7.5, §9, R7)."""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from hms_docrender.fonts import (
    FONT_FILES, FontIntegrityError, FontSet, UnrenderableText, check_characters, css_content_strings, document_text,
    font_dir_default,
)
from hms_docrender.render import RenderRefused, render
from tests.support import html_document, make_request, requires_fonts

SORANI = "پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە ھ"
ARABIC = "ي ی ك ک ه ە ى ة ء أ إ ؤ ئ آ ، ؛ ؟"


class TempFontDir:
    """A copy of the font directory that a test may damage."""

    def __enter__(self) -> Path:
        self._tmp = tempfile.TemporaryDirectory()
        self.path = Path(self._tmp.name) / "fonts"
        shutil.copytree(font_dir_default(), self.path)
        return self.path

    def __exit__(self, *exc: object) -> None:
        self._tmp.cleanup()


@requires_fonts
class FontIntegrityTest(unittest.TestCase):
    """UnitTest:renderer-refuses-font-hash-mismatch: every font file must match its SHA-256 in fonts.json."""

    def test_the_module_fonts_verify(self) -> None:
        fonts = FontSet.load()
        self.assertEqual(set(fonts.sha256s()), set(FONT_FILES.values()))

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

    def test_a_replaced_font_is_refused(self) -> None:
        with TempFontDir() as directory:
            shutil.copyfile(directory / "NotoSans-Bold.ttf", directory / "NotoSans-Regular.ttf")
            with self.assertRaises(FontIntegrityError):
                FontSet.load(directory)

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
    """UnitTest:renderer-refuses-uncovered-characters (R7 for all text): uncovered, control, bidi and non-NFC text refuses."""

    COVERAGE = frozenset(ord(c) for c in "abcSYN-0123 ")

    def test_refusals_name_categories_never_the_text(self) -> None:
        cases = {
            "uncovered": "abc中",
            "bidi override": "abc\u202eSYN",
            "bidi isolate": "\u2068abc\u2069",
            "control": "abc\u0007",
            "not NFC": "e\u0301",
            "lone surrogate": "abc\ud800",
        }
        for label, text in cases.items():
            with self.subTest(case=label), self.assertRaises(UnrenderableText) as caught:
                check_characters([text], self.COVERAGE)
            self.assertNotIn(text, str(caught.exception))

    def test_joiners_and_html_whitespace_pass_without_glyphs(self) -> None:
        check_characters(["abc\u200cSYN\u200d0123\u200b\n\t\r"], self.COVERAGE)

    def test_text_extraction(self) -> None:
        html = ("<html><head><title>中</title><style>p::before { content: \"S\\59 N\" } .x { color: red }</style>"
                "<script>var x = '中';</script><p style='quotes: none'>abc</p><svg><text>SYN</text></svg>")
        texts = document_text(html)
        self.assertIn("abc", texts)
        self.assertIn("SYN", texts)
        self.assertIn("SYN", [t for t in texts if t == "SYN"])
        self.assertNotIn("中", "".join(texts))

    def test_body_text_counts_when_the_head_end_tag_is_omitted(self) -> None:
        self.assertIn("中", "".join(document_text("<html><head><meta charset=utf-8><p>中</p>")))

    def test_css_content_strings(self) -> None:
        self.assertEqual(css_content_strings('a::after { content: "x" counter(p) \'\\4E2D\' }'), ["x", "中"])

    @requires_fonts
    def test_sorani_and_arabic_letters_are_covered(self) -> None:
        fonts = FontSet.load()
        fonts.check_text(html_document(f"<p>{SORANI}</p><p>{ARABIC}</p><p>شیلان ئەحمەد کەریم Shilan Ahmed Karim SYN-000123-7 1990-01-01</p>"))

    @requires_fonts
    def test_an_uncovered_character_refuses_the_render(self) -> None:
        for text in ("SYN 中", "SYN \u2248 1990", "SYN \u202e1-321000-NYS", "<style>p::after { content: '\\4E2D' }</style>SYN"):
            with self.subTest(text=text), self.assertRaises(RenderRefused) as caught:
                render(make_request(html_document(f"<p>{text}</p>")))
            self.assertEqual(caught.exception.code, "unrenderable-text")
            self.assertNotIn("中", caught.exception.detail)

    @requires_fonts
    def test_the_approximate_marker_is_not_in_the_print_fonts(self) -> None:
        """Evidence for the spec issue: U+2248 (the §3.2 R5 approximate-DOB marker) is in none of the four fonts."""
        self.assertNotIn(0x2248, FontSet.load().coverage)


if __name__ == "__main__":
    unittest.main()
