# Print fonts

The four fonts every print uses (docs/specs/modules/platform-docs.md §9; BUILD-PROMPT §4.1 "Fonts", §11.1, §18.9). This directory is the one copy: the JVM font registry (`hms.platform.docs.infrastructure.fonts.FontRegistry`) and the renderer satellite both read it, and both refuse to run when a file's SHA-256 differs from `fonts.json`.

| File | Family, weight | Version (name ID 5) | SHA-256 |
|---|---|---|---|
| `NotoSansArabic-Regular.ttf` | Noto Sans Arabic, regular | 2.013 | `bdff3e5659d67e67def05b33f749683b9376ae819d65d3dd62ac4640b3aaef48` |
| `NotoSansArabic-Bold.ttf` | Noto Sans Arabic, bold | 2.013 | `4e5462d2e8be880317b9f49b5b2da109ddb6a3563d91cc604b67f3535832a555` |
| `NotoSans-Regular.ttf` | Noto Sans, regular | 2.015 | `478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823` |
| `NotoSans-Bold.ttf` | Noto Sans, bold | 2.015 | `1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913` |

- **What:** Noto Sans Arabic (role `arabic`: Sorani, Arabic and Badini in Arabic script) and Noto Sans (role `latin`: Latin names, MRNs, dates, Western digits), regular and bold. These are the design system's families (OQ-148).
- **Why the Noto project's TrueType files, not the design system's Fontsource woff2 subsets (spec §9, OQ-232):** Zebra `^PA` text mode needs a downloaded TrueType or OpenType font; the JVM's `Font.createFont` reads TrueType; and the Fontsource subsets split the Western digits from the Arabic letters, so a Sorani line with an MRN would need two files. The complete static hinted TrueType files keep every glyph, the `GSUB`/`GPOS` shaping tables and the `hhea` metrics the fit rule uses (spec §5.3) in one file per weight.
- **Source:** `https://github.com/notofonts/notofonts.github.io/raw/main/fonts/<Family>/hinted/ttf/<file>` (the `source_url` of each entry in `fonts.json`). Each file's git blob SHA equals the blob SHA the GitHub contents API reports for that path (checked 2026-10-19; last commits touching the files: `4dba672` for Noto Sans Arabic, 2025-10-16; `28b15b4` for Noto Sans, 2024-11-21). Blob SHAs: `NotoSansArabic-Regular.ttf` `72c9228c330febcd1488b9d5ad7aac91e28a2380`, `NotoSansArabic-Bold.ttf` `2bec96247a08b7c4f52437f55f6e385b2974149e`, `NotoSans-Regular.ttf` `f27f4ff59562d58480f1cb94194393484b8da9e9`, `NotoSans-Bold.ttf` `aae7546dc1905b228aff70cde8c818b82f3a2bc4`, `OFL.txt` (`fonts/LICENSE`) `9651ea7d51c39a7778cc327a423fb200350aa948`.
- **Licence:** SIL Open Font License 1.1 (`OFL-1.1`), copyright 2022 The Noto Project Authors. `OFL.txt` is the repository's `fonts/LICENSE` (`https://github.com/notofonts/notofonts.github.io/raw/main/fonts/LICENSE`, SHA-256 `f2095b08bed08b23a6fe26112fcd679a2bee3f002eef077eb05d215ed1051bd8`), the OFL 1.1 text of 26 February 2007. The fonts are unmodified, so the Reserved Font Name clause is not engaged.
- **Coverage gap to know:** neither font has U+2248 `≈`, so the approximate-DOB marker is `~` (U+007E) in the Latin date element (spec §3.2 R5, DN-068); no symbol font is added.

## How to update

1. Download the new files from the URLs above into a new, empty directory; compare each file's `git hash-object` with the `sha` of `https://api.github.com/repos/notofonts/notofonts.github.io/contents/fonts/<Family>/hinted/ttf/<file>`.
2. Read the version (name ID 5) with fontTools; replace the files here and update `version` and `sha256` in `fonts.json` and the table above.
3. Run `UnitTest:font-coverage-sorani` and the shaper and rasteriser tests. The JVM renderer identity contains the font hashes (spec §10), so every approved golden image becomes "no approved set" until a Sorani and Arabic reader approves the new set [HUMAN]; printers in ZPL text mode need the new files downloaded (`~DY`) and S7-K re-run, because the resident font hashes no longer match (spec §7.1).
