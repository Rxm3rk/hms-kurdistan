# ADR-038: Document rendering and the print pipeline
Status: accepted-provisional
Date: 2026-10-19   Source: BUILD-PROMPT §4.1 (Document rendering, Label and token printing, Fonts), §4.3, §5.2 (`platform-docs` and the renderer satellite), §7 item 11, §11.1, §12.4, §12.8, §18.9, §21 (WP-0.8); K §6.7, §9.2; R16 §9.1, §9.2; ADR-003 (the document renderer is a satellite), ADR-011, ADR-022

## Context

**The question.** How HMS turns one template into PDF/A documents, ZPL wristbands and labels, and ESC/POS receipts and tokens, with correct Sorani and Arabic shaping, without sending label data to any online service (§3.7), and which HTML-to-PDF renderer the satellite uses.

**Fixed by the plan.** §4.1 [P]: HTML templates → PDF/A through a renderer with HarfBuzz-grade shaping; the candidates are a WeasyPrint container (BSD) or headless Chromium, and spike S7-K decides by golden-image tests on the target printers. ZPL is rendered server-side per printer DPI with `^PA` shaping and `^CI28` UTF-8 on Zebra firmware V60.14/V50.14 or later, with a `^GF` raster fallback; ESC/POS serves token printers; OFL fonts covering every Sorani letter, tested in CI. ADR-003 makes the document renderer a satellite.

**What was measured** (Windows host, not evidence of record, 19 October 2026; `build/docrender-spike/REPORT.md`, not committed): WeasyPrint 70.0 with Pango and HarfBuzz from the MSYS2 UCRT64 packages, loaded from a project-local directory with no system change, rendered a Sorani test page to PDF/A-2b with every Sorani letter joined correctly in isolated, initial, medial and final positions and Latin identifiers in order; two renders with fixed metadata gave identical bytes and identical rasters (pypdfium2 at 200 dpi). Headless Chromium was not tried.

## Decision

1. **One layout, many writers.** `platform-docs` lays out labels, wristbands, receipts and tokens itself: it chooses every text size and line break with HarfBuzz through the JDK's text layout (OpenJDK's layout engine since JDK 9, JEP 258) and the exact TrueType files of the print fonts, and refuses identity text that does not fit instead of truncating it. The ZPL text, ZPL `^GF` raster, ESC/POS raster and HTML writers draw that one layout. Documents are HTML with CSS paged media, paginated by the satellite.
2. **Raster where we cannot prove the printer.** The module rasterises text itself (shaped glyph outlines filled without anti-aliasing into a 1-bit image at the printer's DPI) for ZPL `^GF` and ESC/POS. Identity text is printed in ZPL text mode only on a printer model and firmware that passed S7-K with the pinned resident fonts; every other printer gets the raster (a tightening, recorded in the hazard log). Barcodes stay native printer barcodes in both ZPL modes.
3. **The renderer satellite is WeasyPrint, accepted-provisional.** `backend/satellites/document-renderer` (Python package `hms_docrender`) renders HTML to PDF/A-2b with WeasyPrint. Its resource fetcher resolves only the satellite's own fonts and `data:` URLs and refuses everything else; it opens no network connection. On the build host it runs in library form from a project-local runtime; its container (WeasyPrint with the distribution's Pango and HarfBuzz) is written and built when the cell exists. Headless Chromium remains the alternative; S7-K decides.
4. **Fonts.** Noto Sans and Noto Sans Arabic (OFL-1.1), the design system's families (OQ-148), as complete static TrueType files pinned by SHA-256, because printers and the JVM need TrueType and the design system's woff2 subsets split the digits from the Arabic letters.
5. **Evidence by golden images and fixtures.** ZPL text-mode output is compared byte for byte with approved fixtures; the images decoded from our own `^GF` and ESC/POS output and the satellite's PDF pages rasterised at a fixed DPI are compared with approved golden images; the PDF goldens are kept per renderer identity.

## Consequences (including safety and licence impact)

- Safety: one geometry for every output removes a class of mismatch between preview, PDF and label; the no-truncation rule turns an overflow into a refusal with a manual path (HAZ-0045, DN-069). ZPL text-mode appearance cannot be checked without physical printers: it is verified only in S7-K [HUMAN: printers], and the raster default covers the gap.
- Text shaped by the JDK and by the satellite can differ by small widths; the fit rule keeps a 5% margin, and the golden images show the result.
- Golden images depend on the renderer and its libraries; the satellite's runtime on each host is pinned and named in every PDF golden set.
- Licences: WeasyPrint (BSD-3-Clause) and most of its Python dependencies are on the allowlist; Pillow (MIT-CMU) and FreeType (FTL, inside the Pillow and pypdfium2 wheels and the MSYS2 runtime) are not named on it, so shipping the satellite waits for DN-066. On the build host the runtime is build-only. ZXing core (Apache-2.0) and Jackson YAML (Apache-2.0) join the backend.
- The Linux build host needs Pango libraries to render PDF goldens of record, a system change for the human (DN-067).

## Fitness test that guards it

**Guards:** the golden-image and byte-fixture tests (`GoldenImage:wristband-*`, `GoldenImage:specimen-label-*`, `GoldenImage:receipt-*`, `ByteFixture:zpl-text-*`, `ByteFixture:html-*`), the font-coverage test (`UnitTest:font-coverage-sorani`) and the offline-renderer tests (`UnitTest:renderer-refuses-remote-resources`, `UnitTest:html-has-no-external-urls`): the raster and byte-fixture tests in the fast tier, the PDF goldens in the nightly `golden-image-print` step.

**State on 2026-10-19:** being built on `wp/0.8-documents-printing`; no guard has a record of record yet.

## Reopen if

S7-K shows that WeasyPrint's PDF output fails on the target printers or that headless Chromium scores better on the golden-image tests; a target printer cannot print the `^GF` raster legibly at its DPI; the licence decision DN-066 refuses a component the satellite needs; or the JDK replaces HarfBuzz in its text layout.
