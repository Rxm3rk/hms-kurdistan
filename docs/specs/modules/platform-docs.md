# Documents and printing (`platform-docs` and the renderer satellite)

The module specification of `platform-docs` and its document renderer satellite, written before the code it governs (BUILD-PROMPT §3.2 step 2, §22.1 item 1) in WP-0.8 slice S0. §21 lists no feature ID for WP-0.8 (`docs/program/work-packages/WP-0.8.md`); the work serves §7 item 11 and the features that print: `PLT-UX-02` (silent wristband and label print), `PLT-UX-03` (bilingual prints), `INT-DOC-01` (§12.4), `TRU-PRV-01` (labels propagated to print) and `TRU-BCP-02` (downtime print). Sources: §2.1 SI-01, SI-16, SI-20 and SI-21; §3.4; §3.5; §3.7; §4.1 (document rendering, label and token printing, fonts); §4.3; §5.2; §6.2, §6.3, §6.6; §7 item 11; §9.1; §11.1; §12.4; §12.8; §13.1 AZ-1, AZ-3, AU-1, DP-8, EN-4; §18.9; §19.1; §19.4; K §6.7, §9.2; R16 §9.1, §9.2, §9.3, §12; ADR-003, ADR-011, ADR-019, ADR-022, ADR-038; the HAL contract `docs/specs/hal/` on `wp/0.7-design-system` (commit `b597713`).

**What this document is.** A specification. When it was written no code existed, no test named here had run, and every hazard-log control it cites was `planned`. Section 15 lists what WP-0.8 builds now and what waits. WP-0.8 started before its entry criteria were met, on the human lead's decision of 19 October 2026 (DN-065): it builds only what needs no cluster. Two automated reviews (AI) of the first draft, an engineering lens and a clinical-safety lens, found no critical and 33 major findings; a second round found 13 of them partly resolved and 12 new major findings; this revision answers both rounds (`docs/program/reviews/WP-0.8-spec.md`).

**Readings of safety invariants are the CSO's decisions.** Where this specification reads SI-01, SI-16, SI-21 or DP-8 more precisely than the plan states, the reading is a decision entry for the CSO [HUMAN] with options: DN-068 to DN-074. The default in use is the stricter reading. Every default that adds to an invariant is recorded as a tightening in the control's `notes` and in the "Tightenings" table of `docs/safety/README.md` (§3.4 items 1 and 8). Where a default leaves a stricter option open, the decision entry says so.

## 1. Parts and where they live

| Part | Path | Language | Holds |
|---|---|---|---|
| `platform-docs` module | `backend/modules/platform-docs` (Gradle `:modules:platform-docs`, package `hms.platform.docs`) | Kotlin | `api/`: the commands, content types and results other modules use (§12). `domain/`: the SI-01 content rules, the template model and linter, the fit rule, the layout result, the barcode payload, the print-job lifecycle, the audit and watermark models, the first-band verification and issued-band rules. `application/`: the print service and its ports. `infrastructure/`: template loading, text shaping and measurement, the font registry, the ZPL, ESC/POS and HTML writers, the 1-bit rasteriser, the barcode encoder adapter, the renderer-satellite client |
| Renderer satellite | `backend/satellites/document-renderer` (Python package `hms_docrender`) | Python | HTML → PDF/A-2b with WeasyPrint (accepted-provisional, ADR-038); an offline-only resource fetcher; a library entry point, a command line and the request contract; the PDF golden-image harness; container packaging for when the cell exists |
| PDF/A checker | `backend/satellites/pdfa-verify` (Gradle `:satellites:pdfa-verify`) | Kotlin | A build-only command that validates PDFs with veraPDF (its MPL-2.0 option) for the golden step (§10) |
| Print templates | `content/print-templates/` | YAML (data) | Versioned templates (§6.6 extension tier 1). Every template is `provenance: synthetic` and NOT FOR CLINICAL USE until approved content replaces it (§19.4) |
| Print fonts | `backend/modules/platform-docs/src/main/resources/hms/platform/docs/fonts/` | TrueType | Noto Sans and Noto Sans Arabic, regular and bold (OFL-1.1), with `OFL.txt` and `fonts.json` (file, SHA-256, font version). The one copy: the satellite reads it too and checks every hash (§9) |
| S7-K printer test kit | `tools/s7k/` | Python (standard library) and data | The protocol, test patterns, a sender for raw port 9100 (local addresses only), the result form, and the engine's outputs with their reference images (§11) |

The HAL contract (`hal.print.label`, `hal.print.raw`, `hal.print.document`, `hal.scan.onBarcode`) and the label-printer capture simulator (`tools/simulators/label_printer/`) belong to WP-0.7. This module produces what those calls carry and accepts what they report (§12); it does not change them.

## 2. The pipeline

One source for every output (§7 item 11, §12.4): a template plus validated content gives one layout, and every writer draws that layout.

```text
PrintCommand ─► policy (§8.4) ─► content rules (§3) ─► template lint (§4.3) ─► layout + fit (§5) ─► writer (§7) ─► audit (§8.3) ─► result
```

| Kind | Outputs | Golden or fixture (§10) |
|---|---|---|
| `wristband` | ZPL raster (`^GF`), ZPL text (`^PA`, only on printers S7-K passed, §7.1), PDF | ZPL raster image, ZPL text bytes, HTML bytes, PDF page image |
| `specimen-label` | as `wristband` | as `wristband` |
| `receipt` | ESC/POS raster, PDF | ESC/POS image, HTML bytes, PDF page image |
| `token` | ESC/POS raster | ESC/POS image |
| `document` (A4, A5) | PDF | HTML bytes, PDF page image |

- **Labels, wristbands, receipts and tokens** are laid out by this module (§5): it chooses each text's size and line breaks with the same shaping engine that rasterises them, so every output agrees on geometry, and the HTML carries every line already broken.
- **Documents** are HTML with CSS paged media, paginated by the satellite; the module measures the print banner and sets the page's top margin from it (§7.4), so the banner is never clipped.
- **Nothing is computed from clinical values.** Amounts, doses and results arrive as display strings from their owning module and are placed unchanged. Times arrive as instants and are formatted by this module in the tenant's zone, `YYYY-MM-DD HH:mm`, Western digits (formatting is not arithmetic; SI-05's "dose arithmetic" and the §9.21 cashiering arithmetic stay with their owners).
- **Print as stored.** Text is never normalised, transliterated or re-spelt: ي/ی, ك/ک and ه/ە print as the record holds them (§11.1 normalisation is for search, not for print).

## 3. Print content and the SI-01 rules

### 3.1 The content model (in `api`, so callers import only the api package)

`PatientIdentity`: `patientRef` (internal identifier: audit only, never printed, never in an event); `names` (a map from name form to the whole name: `ckb`, `ar`, `ku-Arab` in Arabic script, `latin`), the design system's forms; `ownForm` (the form in the patient's own script); `latinConfirmed` (the registrar confirmed the Latin form, CTRL-0001-6); `mrn` (as issued, check digit included); `birthDate` (`value`, `precision` of day, month or year, `approximate`); optional `sex` (governed display text); `newborn`; `alias` (unknown or alias patient, §9.1). There is **no location field**: room, bed and ward cannot fill an identifier slot (CTRL-0001-4).

Per kind: `WristbandContent` (identity, `encounterId`); `SpecimenLabelContent` (identity, `specimenId`, specimen type, `collectedAt` instant, tests); `ReceiptContent` (identity, receipt number, issuer lines, item and total lines with descriptions and display amounts, cashier, `issuedAt`); `TokenContent` (token number, service point, `issuedAt`; no patient data); `DocumentContent` (identity, `PrintBanner`, title, blocks of headings and paragraphs). Every free-text field that can carry clinical meaning is a `LabelledText` (specimen type, tests, receipt line descriptions, the banner's code status and isolation, the document title, headings and paragraphs); issuer lines, cashier and service point are administrative text. `LabelledText` carries SI-21 sensitivity labels and the redacted form to print when the policy asks for it (§8.4). `PrintBanner` mirrors the screen banner's fields and states (`docs/specs/modules/design-system.md` §2.1 on `wp/0.7-design-system`): allergies as exactly one of NKA, not assessed, a list, or unavailable (missing data never prints as NKA); code status, isolation and dated weight as display text or unavailable; whether a photo is on record (no photo is printed yet: the banner shows "Photo on record (not printed)" or "No photo", OQ-239). The banner's sensitivity indicators (CTRL-0016-3) wait for the policy point (WP-0.4) and are part of DN-068. Banner allergies and the dated weight are never redacted (SI-16 requires them on every clinical print; an allergy can imply a labelled condition, so DN-068 puts this SI-16/SI-21 tension to the CSO). Every identifier in samples is synthetic (`SYN-`, §19.4).

### 3.2 The rules

Checked before layout; R6 and R7 call the shaping port (`TextShaper`), the rest are pure domain checks. A failure is a refusal, never a partial print.

| Rule | Check | Refusal (message key) |
|---|---|---|
| R1 two identifiers (SI-01 a, d) | Every patient print carries the name and the second identifier: the MRN plus the date of birth at its recorded precision, or the approximate-DOB flag with the recorded estimate. A patient with no date-of-birth value at all is refused (DN-073 asks the CSO about unknown patients) | `print.refused.identifierMissing` |
| R2 never room or bed (SI-01 b) | The content model has no location field, and the template linter refuses any binding outside the closed binding set (§4.3) | build time (`TemplateLint`) |
| R3 both scripts (SI-01 c) | `names[ownForm]` and `names[latin]` are present and `latinConfirmed` is true (CTRL-0001-6, a recorded tightening). For a patient whose own form is Latin the name prints once (DN-068). A missing or unconfirmed form fails closed. Alias names follow the same rule (DN-073) | `print.refused.identityIncomplete` |
| R4 identifiers' characters | The MRN, encounter, specimen and receipt numbers are non-blank and use only `A-Z a-z 0-9 -`, so no identifier can carry a payload separator or a printer escape character; the MRN prints exactly as issued | `print.refused.identifierInvalid` |
| R4a MRN check digit (SI-01 "MRN (with check digit)", CTRL-0001-7) | The identity service confirms the check digit through the `MrnCheckPort`; the algorithm is WP-1.2's. With no identity service, production wiring refuses every patient print (fail closed); tests use a synthetic adapter that accepts `SYN-` MRNs only (KA-081) | `print.refused.mrnCheckFailed` |
| R5 date of birth | Printed at its recorded precision in Western digits (`YYYY-MM-DD`, `YYYY-MM`, `YYYY`) in the Latin date element. Whenever it is approximate or less precise than a day, the date carries the language-independent marker `~` (for example `~1985-07`) and the "Approx." caption in the label language; a placeholder day or month is never printed (CTRL-0001-7; the banner's rule). The approximate caption is subject to R6 and the legibility minimum like identity text. (`≈` is not used: neither pinned font has U+2248) | `print.refused.identifierInvalid` |
| R6 never truncated | Identity text (every printed name form, the MRN, the date of birth, the encounter, specimen and receipt numbers) is never cut, elided or clipped. It shrinks to its minimum size and wraps onto its maximum lines; if it still does not fit, the print is refused (§5.3, DN-069). This holds for newborn ("Baby of …"), twin and alias names in every script (§12.8, R16 §9.1) | `print.refused.identityDoesNotFit` |
| R7 renderable | Every character has a glyph in its element's font chain, and shaping produces no missing glyph. Refused: control characters (Unicode Cc), format characters (Cf) other than ZWNJ, ZWJ and ZWSP (so no bidi embedding, override, isolate or mark can reorder a printed name), unpaired surrogates, text not in Unicode NFC, and `\` in text that goes to a ZPL field block (`^FB` reads `\&` as a line break) | `print.refused.unrenderableText` |
| R8 Western digits | No printed text carries Arabic-Indic (U+0660–0669) or Extended Arabic-Indic (U+06F0–06F9) digits (§11.1, §18.9: clinical numerals are Western on every print); text that does is refused, never converted. Eastern digits for configured non-clinical patient text (§11.1) are not supported yet, so the rule covers all text | `print.refused.easternDigits` |
| R9 barcode agrees with the text | The barcode payload is built from the same content object as the printed text, never from a separate input (§6) | — |
| R10 sensitivity labels | Every `LabelledText` with a label the policy decision names prints its redacted form; with none, the print is refused (§8.4) | `print.refused.policyDenied` |

A refusal produces a `PrintJobRefused` event and an audit record (§8). The screen shows the message key and the next step: a larger or alternate template where the hospital configured one, otherwise the hospital's downtime procedure (DN-069). It never offers to print without the field. The refusal names the field and a code-point category, never the text.

### 3.3 Label language and captions

The label language (`en`, `ckb`, `ar`) chooses the captions (MRN, date of birth, approximate, encounter, specimen) and the caption layout direction. It never changes the name forms. Captions are separate text elements with their own font role (§4.3 rule 7), from the template's caption keys in the three languages, never literals. The approximate-DOB marker `~` is language-independent and part of the date value (R5). The facility's default label language is configuration (`docs.labels.default-language`, default `en` [P], OQ-236). The samples are rendered in all three languages. Badini (`ku-Arab`) patient templates are a content item for Duhok review (§11.1, L-12, OQ-063); the engine supports the form, no template uses it yet (KA-085).

## 4. Templates

### 4.1 Format

A template is a YAML document `content/print-templates/<id>.yaml`:

```yaml
id: SYN-WRISTBAND-ADULT            # SYN- for synthetic content
version: 1                         # integer; with the content hash, keys first-band verification (§6.3)
provenance: synthetic              # synthetic | approved (§19.4)
kind: wristband                    # wristband | specimen-label | receipt | token | document
media:                             # the printer's media and the reading frame on it
  width_mm: 25.4                   # across the print head
  length_mm: 279.4                 # along the feed (flow kinds: the minimum)
  rotation: 90                     # 0, or 90: the reading frame runs along the media length
  printable: {x_mm: 75, y_mm: 2, w_mm: 150, h_mm: 21.4}   # in the reading frame
captions: {mrn: {en: "MRN", ckb: "…", ar: "…"}, …}
elements:
  - {type: text, bind: identity.name.own, font: by-script, weight: bold, box: {x_mm: 0, y_mm: 0, w_mm: 100, h_mm: 9}, size_pt: {max: 12, min: 8}, max_lines: 2, align: start}
  - {type: caption, key: mrn, font: by-label-language, box: {…}, size_pt: {max: 7, min: 6}}
  - {type: text, bind: identity.mrn, font: latin, direction: ltr, box: {…}, …}
  - {type: barcode, bind: barcode.wristband, symbology: datamatrix, box: {…}, module_mm: 0.5}
```

- The reading frame is the label as read: for `rotation: 0` its width is `width_mm`; for `rotation: 90` its width is `length_mm` and its height `width_mm`. `printable` and every `box` are in the reading frame.
- `bind` names a field of the closed binding set (`identity.name.own`, `identity.name.latin`, `identity.mrn`, `identity.birthDate`, `identity.sex`, `encounter.id`, `specimen.*`, `receipt.*`, `token.*`, `document.title`, `document.body`, `document.banner`, `watermark`, `notice.synthetic`, `barcode.wristband`, `barcode.specimen`). No free text, no expressions, no scripts.
- `font` is `arabic`, `latin`, `by-script` (from the bound name form's script: Arabic-script forms use `arabic`, Latin uses `latin`), for captions `by-label-language`, and for non-identity text `mixed`: a chain of both fonts with the label language's first, so a Sorani receipt line holding "Amoxicillin 500 mg" prints (each character takes the first font that has it). Identity text and captions always use one font.
- For a patient whose own form is Latin, the `identity.name.own` element prints the Latin name and the `identity.name.latin` element prints nothing (DN-068). Labels print no third name form; documents' banners print the own form and the Latin form, and every other recorded form below them. `direction` is `auto` (the paragraph direction of the text's first strong character) or forced `ltr` (MRNs, dates, numbers: a digit-only identifier is never reordered).
- `overflow` defaults to `refuse`; `wrap-grow` is allowed only for non-identity text in flow kinds.
- HAL mapping: `wristband` → `labelType: wristband`, `specimen-label` → `labelType: specimen`.

### 4.2 Versioning and provenance

A template is content (§6.6, §19.4). Its id, version and content hash (SHA-256 of the canonical YAML) travel with every print job, every event and every audit record (§12.8 "with template version"). One (id, version) has one content hash; the loader refuses a second file that claims an existing (id, version) with different content, and the bundle pipeline enforces it across bundles (WP-0.3, KA-082). Promotion of a bundle with a `synthetic` template to TRAIN or PROD fails (§19.4). The WP-0.8 templates are samples; the hospital's layouts are content requests (OQ-238).

### 4.3 The template linter (`TemplateLint`; CTRL-0001-5's proposed linter, a recorded tightening)

Runs when a template loads and in the fast tier over every file in `content/print-templates/`. It refuses a template that:

1. is a patient kind without elements bound to `identity.name.own`, `identity.name.latin`, `identity.mrn` and `identity.birthDate` (CTRL-0001-5), or without an `approximate` caption element beside the date; that caption prints only when R5 applies (the date is approximate or less precise than a day);
2. binds a field outside the closed set (so nothing binds a room or bed, R2), or binds a field its kind does not have;
3. lets identity text be clipped: an identity element without `size_pt.min`, with `max_lines` below 1, or with `overflow` other than `refuse`; or non-identity text on a fixed layout with `overflow` other than `refuse`;
4. is a `wristband` without a DataMatrix bound to `barcode.wristband` (§12.8), or a `specimen-label` without a barcode bound to `barcode.specimen` and without the human-readable specimen ID next to it;
5. is a `document` without the `document.banner` and `watermark` elements (SI-16 for documents, CTRL-0016-5; labels, wristbands and receipts carry SI-01's identifiers instead of the banner, a reading for the CSO, DN-068; DP-8), or any patient kind without a `watermark` element (DN-070);
6. places an element outside the printable area, lets two elements' boxes intersect, puts a barcode whose module is below 0.25 mm, or lets anything enter a barcode's quiet zone (at least one module for DataMatrix, ten modules for Code 128);
7. puts a caption and a value in one element, or gives an identity element or a caption the `mixed` font (a Latin MRN beside a Sorani caption is two elements);
8. uses a caption without text in each of `en`, `ckb` and `ar`;
9. is `synthetic` without a `notice.synthetic` element ("SYNTHETIC – NOT FOR CLINICAL USE" printed visibly, §19.4);
10. declares an identity element or the approximate caption whose `size_pt.min` is below the legibility minimum for its font role at the template's `media.min_dots_per_mm` (default 8; §5.4).

**The worst-case fit check** (`TemplateFitCheck`, application layer, because it shapes text): in the fast tier every patient template must fit, at its minimum sizes, a governed worst-case corpus of identity text per script: the registration field limits, four-part names, "Baby of" with a four-part mother's name plus sex and twin marker, alias names, the longest MRN and encounter forms (DN-069, OQ-244). A template that cannot fit the corpus is refused before any patient meets it.

**Element order sets the reading order of flow kinds** (top to bottom); in fixed kinds boxes are absolute.

## 5. Layout and the fit rule

### 5.1 Shaping and measurement

Text is shaped with HarfBuzz through the JDK's text layout (OpenJDK's layout engine since JDK 9, JEP 258), using `Font.layoutGlyphVector` per bidirectional run (never `createGlyphVector`, which does not shape), with the exact TrueType file of the element's font role and weight, `kern` and `liga` on (as Pango and the printer use them), and one pinned `FontRenderContext` (identity transform, fractional metrics on, anti-aliasing hint on) for measuring and rasterising alike. Runs come from the Unicode Bidirectional Algorithm (`java.text.Bidi`) with the element's paragraph direction (§4.1). The port returns, per run, the advance, the glyph ids with their positions, and whether any glyph is the missing glyph.

### 5.2 Line breaking

Lines break only at U+0020 and at ZWSP. A word is never split and no hyphen is added. Identity text with one word wider than its box at the minimum size does not fit (R6).

### 5.3 Fit

For each text element, for each size from `size_pt.max` down to the effective minimum (the larger of `size_pt.min` and the legibility minimum, §5.4) in steps of 0.5 pt, quantised to the whole printer dots the writer will emit: break the text into at most `max_lines` lines no wider than 95% of the box width; the size fits when the lines' block height (the first line's ascent, plus (n − 1) line heights, plus the last line's descent) is no more than the box height. The line height and the ascent and descent come from the font's own metrics (`hhea` ascender, descender and line gap), never from a fixed factor: Noto Sans Arabic's extent is about 2.11 em, so a 1.2 em line would clip its marks. The first size that fits wins. If none fits, the element does not fit: a refusal for identity text (R6); for non-identity text in flow kinds with `wrap-grow`, the block grows. The 5% horizontal margin absorbs small width differences between the JDK's and the satellite's shaping; it is unverified for printers until S7-K. The layout result is the list of placed lines (text, paragraph direction, font, size, line box, baseline, measured width), barcodes and rules, in the reading frame.

### 5.4 DPI and legibility

Printer profiles state dots per millimetre: 8 (203 dpi), 12 (300 dpi, which Zebra heads implement as 304.8 dpi) and 24 (600 dpi). Millimetres convert to dots with the profile's dots per millimetre, rounding half up once per coordinate, never accumulated. The legibility minimum for identity text is configuration [P] (OQ-243): Arabic-script text 8 pt at 8 dots/mm and 7 pt at 12 dots/mm or more; Latin text 6 pt. S7-K tests these with the dot-differentiated letters ب ت ث ن ی پ, and the CSO confirms them (DN-069).

## 6. Barcodes and first-band verification

### 6.1 Symbols and payloads [P] (OQ-233)

- Wristband: DataMatrix ECC 200 (§12.8, R16 §9.1), payload `HMS1|M:<MRN>|E:<encounter>|B:<band serial>`, where the band serial is the print job id (so a later scan can reject a superseded band, §8.6).
- Specimen label: the symbology and payload are the LIS's decision (WP-1.7, OQ-240). The default is DataMatrix `HMS1|S:<specimen id>|M:<MRN>`, so the barcode itself carries two identifiers (SAC-04); Code 128 with the specimen ID alone (what some analyser tube readers need) is a template option the LIS may choose. The human-readable specimen ID is always beside the barcode.
- Printable ASCII only, no FNC1 or GS; every field is an identifier that passed R4, so no field holds `|`, `~` or `\`. Scans for verification use HID-POS mode or the HAL's normalisation, never a keyboard wedge under an Arabic or Sorani keyboard layout (R16 §9.3, OQ-246).

### 6.2 Who draws the symbol

In both ZPL modes the printer draws it natively (`^BX` with the columns and rows of the symbol the encoder chose and an explicit escape character outside the payload alphabet; `^BC` for Code 128); the raster fallback concerns text only. In PDF, HTML and ESC/POS outputs the module draws it from ZXing's matrix (Apache-2.0). Verification: the module's matrix is decoded back with ZXing's decoder in the fast tier (`UnitTest:barcode-round-trip`); the nightly PDF golden step decodes every symbol on the rasterised pages with an independent decoder, zxing-cpp (Apache-2.0), and compares it with the expected payload (`GoldenImage:barcode-decodes-*`); the ZPL fixtures show the `^BX`/`^BC` field data equal to the payload. The printer's own symbol is verified only by the first-band scan and in S7-K.

### 6.3 First band after a change is scan-verified (§12.8; DN-072)

The verification key is the template id, version and content hash, the printer's serial and firmware, the output mode, the dots per millimetre, the loaded media size and, for ZPL text mode, the resident font hashes. The first wristband printed for a key not yet verified is marked `scan-verification-required`; **further wristbands on that key are refused** until it is verified, and an unknown verification state counts as "required" (fail closed). Verification is a command (`VerifyFirstBand`, §12) by a user allowed to print wristbands at that workstation (the policy point decides, WP-0.4): the scanned payload must equal the expected payload exactly, and the user confirms on screen that the printed name forms, MRN and date of birth match; a scan that matches without that confirmation counts as a mismatch. A mismatch marks the band unusable, blocks the key, and asks for an owned task to remove the band from the patient (the task engine is WP-0.3; until then the refusal says so, KA-077). A first job that ends refused or failed produced no band, so it releases the pending state and the next wristband on the key becomes the first band. A first job with an unknown outcome may have printed, so the key stays pending until the user either verifies that band or states on screen that no band came out (audited, DN-072). After a mismatch the key stays blocked until a user records that the mismatched band was removed and the printer and template were checked (`ResetFirstBandKey`, audited, with a reason); the next band on the key is then a first band again. A printer is never left blocked without a recorded way out. Every verification, "no band came out" statement and reset is audited (§8.3).

## 7. Writers

### 7.1 ZPL text mode (printers that shape: Zebra V60.14.x or V50.14.x and later)

```text
~JA                                 reprints only, before ^XA: cancel formats still queued in the printer (§8.6)
^XA
^CI28                               UTF-8 field data
^PW<width dots>^LL<length dots>^LH0,0
^PA1,1,1,1                          default glyph shown, bidirectional layout, character shaping, OpenType
^FT<x>,<y>^A@<o>,<h>,<w>,E:<FONT>.TTF^FB<width>,1,0,<L|R|C>,0^FH\^FD<text>^FS     one per placed line
^FO<x>,<y>^BX<o>,<module dots>,200,<cols>,<rows>,,_^FH\^FD<payload>^FS
^PQ1
^XZ
```

- **Use (a tightening, DN-074 records the reasoning):** identity text goes in text mode only to a printer whose profile says S7-K passed text mode for its model and firmware, and whose provisioning record shows the pinned print fonts downloaded (a Zebra lists resident fonts by name and size only, `^HW`, so the hash is the provisioning record, and the fonts are downloaded again whenever the verification key changes). Every other printer gets the raster mode (§7.2), and so does a layout with any line in more than one font (a field takes one `^A@` font). Text mode is always generated for the fixtures and the S7-K kit.
- `~JA` is placed before `^XA` because tilde commands act on arrival; inside a format it could cancel the reprint itself. Because it cancels every format queued on the printer, the service marks that printer's other jobs still `rendered` or `dispatched` as `outcome-unknown` and audits them, so no job claims to be printing that was cancelled.
- Field data is UTF-8 in logical order; the printer reorders and shapes. Every `^`, `~` and `\` is written as a `^FH\` hex escape (`\5E`, `\7E`, `\5C`), so no content can end a field or start a command; `\` itself never reaches a field block (R7), because `^FB` reads `\&` and `\(*)` after the hex decoding.
- `^FT` sets the baseline origin of the line (with `^FB` it anchors the last line, the only one); `<h>` and `<w>` are the size in dots. How Zebra maps `^A@` height to the em is an S7-K calibration item. `<o>` is `N`, or `R` for a 90° frame, with coordinates transformed from the reading frame.
- `^FB` overprints its last line when the printer's text is wider than ours, so text-mode identity text depends on S7-K having passed the printer (HAZ-0045 cause).
- Fonts are resident as `E:NSARAB.TTF`, `E:NSARABB.TTF`, `E:NSLATN.TTF` and `E:NSLATNB.TTF`; the S7-K kit and printer provisioning download them (`~DY`) and record their hashes.
- Output is checked byte for byte against approved fixtures (`ByteFixture:zpl-text-*`); its printed appearance is verified only in S7-K [HUMAN: printers] (KA-076).

### 7.2 ZPL raster mode (`^GF`, any ZPL printer)

The module rasterises every placed text line, caption, rule and the notice into a 1-bit image of the printable area at the printer's dots per millimetre: the shaped glyph outlines are filled without anti-aliasing (a pixel is black when its centre is inside an outline), and rotated onto the media for a 90° frame. It writes the image as one or more `^FO<x>,<y>^GFA,<bytes>,<bytes>,<row bytes>,<hex>^FS` fields, uncompressed, upper-case hexadecimal, each holding a band of whole rows of at most 99,999 bytes (the documented `^GF` limit). Barcodes stay native fields. No `^PA` is sent. The image decoded from our own `^GF` output is compared with an approved golden image (`GoldenImage:wristband-*`, `GoldenImage:specimen-label-*`).

### 7.3 ESC/POS (receipt and token printers)


`ESC @`; the rasterised layout at the profile's width and dots per millimetre (576 dots for 80 mm paper at 8 dots/mm, 512 at 180 dpi, 384 for 58 mm) as `GS v 0` raster images in bands of at most 256 rows; then a partial cut with feed `GS V 66 0`. Arabic-script text is always rasterised: ESC/POS code pages cannot shape Sorani. The image decoded from our own output is compared with an approved golden image (`GoldenImage:receipt-escpos-*`, `GoldenImage:token-*`).

### 7.4 HTML

- **Labels, receipts and tokens:** one page of the reading frame's size (or the receipt's laid-out length); each placed line an absolutely positioned element with its font, size, CSS `line-height` equal to the layout's, `direction`, `white-space: pre` and `unicode-bidi: isolate`; barcodes as inline SVG rectangles. The template id, version, content hash and provenance are in the document metadata, and synthetic templates print the notice visibly.
- **Documents:** CSS paged media. The print banner is a running element (`position: running(banner)`, placed with `@top-center { content: element(banner) }`). The module lays the banner out with the fit rule at the page width and writes each banner line pre-broken (`white-space: pre`, the layout's line height), so the satellite cannot break it differently; `@page { margin-top }` is the banner's laid-out height, so a long allergy list or long name forms grow the margin instead of being clipped. A banner taller than half the page is refused (`print.refused.bannerTooTall`). The watermark line is a running element in `@bottom-center` on every page; on a reprint a diagonal "REPRINT" is drawn beneath the content in solid light grey (no transparency, which keeps PDF/A-2 simple).
- **Resources:** fonts by the `hms-font:` scheme only; images and barcodes inline. No `http:`, `https:` or `file:` URL, no script, no external style sheet, no `@import` (`HtmlLint`, fast tier; HAZ-0047).
- Output is checked byte for byte against approved HTML fixtures (`ByteFixture:html-*`), which are the inputs of the PDF goldens.

### 7.5 The renderer satellite: HTML → PDF/A-2b

- **Contract (version 1; `backend/satellites/document-renderer/contract/render-request.schema.json`):** in: the HTML (UTF-8), `pdf/a-2b`, the title, template id, version and content hash, provenance, language and a fixed creation time. Out: the PDF, its SHA-256, the page count and the renderer identity (§10). The command line reads one JSON request on standard input and writes the PDF to a named file; no network listener in WP-0.8.
- **The module's client** (`DocumentRendererPort`): a subprocess adapter that runs the satellite's command line from a configured runtime, used by the tests and the sample generator. Production wiring has no satellite until the cell exists, so a document print is refused with `print.refused.rendererUnavailable` (KA-083), never silently skipped.
- **Offline only (§3.7, HAZ-0047):** the fetcher resolves `hms-font:` names from the one font directory and `data:` URLs, and refuses everything else, including paths outside that directory; a refused fetch fails the render. The satellite opens no socket (`UnitTest:renderer-opens-no-socket`); its container runs with no egress (WP-0.2, §6.8 item 11).
- **Hermetic fonts:** fontconfig runs from the satellite's own configuration with no system font directory, so no system font can stand in for a missing glyph. Before rendering, the satellite checks every font file against `fonts.json` (refuses on a mismatch) and every character of the HTML's text against the fonts' character maps (refuses an uncovered character, the R7 rule for all text).
- **Determinism:** creation and modification dates come from the request; the same input on the same renderer identity gives the same bytes (`UnitTest:pdf-deterministic`).
- **PDF/A conformance:** PDF/A-2b (ISO 19005-2 level B) with embedded fonts and an sRGB output intent, validated by veraPDF in the golden step; a non-conforming PDF fails the step (`PdfaCheck:veraPDF-2b`).
- **Accepted-provisional (ADR-038).** Only WeasyPrint is built. S7-K judges its PDFs on the target printers against absolute pass criteria; comparing with headless Chromium, the other §4.1 candidate, needs a second renderer that WP-0.8 does not build (KA-087).

### 7.6 The media check

Before a label, wristband or receipt is written, the printer profile's loaded media must equal the template's media within ±1.0 mm (width always; length for fixed kinds), and the template's width in dots must not exceed the print head's width (`printheadWidthDots`). Unknown media or an unknown print head width is a refusal (`print.refused.mediaMismatch`; fail closed). A media change is also a new first-band verification key (§6.3).

## 8. Print jobs, audit, policy and watermark

### 8.1 Lifecycle

The executable machine is `docs/specs/state-machines/print-job.yaml` (Appendix B.3; approval requested). In short: `requested` → `refused` (policy, rules, lint, fit, renderer, audit) | `failed` (render error) | `rendered`; `rendered` → `dispatched` (the HAL said `sent`) | `completed` (the HAL said `completed`) | `failed` (a HAL error with a known outcome) | `outcome-unknown` (a HAL timeout or device error on a print call); `dispatched` → `completed` | `failed` | `outcome-unknown`. Outcomes arrive through `ReportPrintOutcome` (§12). A job is never retried by itself. A job still `rendered` or `dispatched` on a printer that receives a reprint's `~JA` becomes `outcome-unknown` (cancelled by the reprint); a HAL outcome reported later for an `outcome-unknown` job is audited as a late outcome and leaves the state unchanged, so a job that printed after all is still on record.

### 8.2 Events

`PrintJobRequested`, `PrintJobRefused`, `PrintJobCompleted`, `PrintJobFailed` and `PrintJobOutcomeUnknown`, each with the template id, version and content hash (§12.8). Payloads carry the job, tenant, facility, printer and correlation identifiers, never a patient reference, a name, label text or a barcode payload (SI-20). Publication through the journal outbox waits for WP-0.3 (KA-078); the schemas are in `docs/specs/events/platform-docs.md`.

### 8.3 Audit (§6.3, AU-1)

Every outcome (refused, rendered, dispatched, completed, failed, outcome unknown) is audited as event type `print`: who (user, on-behalf-of, workstation), what (template id, version and content hash, output mode, copies, reprint and reason), whom (patient reference), when (injected clock), where (printer id and serial), why (purpose of use), the outcome and the output's SHA-256. **The record is written before the output is returned; if the audit write fails, the print is refused** (`print.refused.auditUnavailable`). That refusal cannot itself be audited: it is published as a `PrintJobRefused` event and counted in a PHI-free metric. For an outcome report (`ReportPrintOutcome`), an audit failure leaves the job's state unchanged and the report may be repeated (`AuditUnavailable`). The record belongs in the cell's BALP audit store; until WP-0.4 the only adapter is in-memory, for tests (KA-078). The patient reference and the SHA-256 never go to the HAL's local audit log, logs, telemetry or events (SI-20, CTRL-0020-7).

### 8.4 Policy enforcement (AZ-1, AZ-3, SI-21)

Every print passes the `PrintPolicyPort` first. The decision is `Allowed` with obligations (for example "print the redacted form of text labelled `hiv`"), `Denied`, or `Unavailable`. The policy decision point is WP-0.4; until then production wiring has none and **refuses every print** (`print.refused.policyUnavailable`; KA-077). Tests and the sample generator use a test-only policy that allows synthetic (`SYN-`) patients only. How printing behaves during a downtime with no reachable policy point (EN-4 wants downtime wristbands and labels to print with the core down) is DN-074; the downtime print path is WP-1.13.

### 8.5 Watermark (DP-8; DN-070)

`Watermark`: the printing user's display name and staff identifier, the print time (tenant zone, `YYYY-MM-DD HH:mm`, Western digits), the patient's MRN, the job id, and "REPRINT" with the original job id on a reprint. Placement (the default in use):
- documents: the full watermark line at the foot of every page, and the diagonal "REPRINT" on a reprint;
- receipts: the full watermark line at the end;
- wristbands and specimen labels: a minimal mark (the job's short id and the print time) in its own element away from the barcode's quiet zone, plus "R" on a reprint; it leaves out the user, whom DP-8 names, so it is an intermediate reading, not the strictest one (the job id leads to the user in the audit record; DN-070 offers the full watermark);
- tokens: none (no patient).

The watermark is part of the layout. The clock and the job id are injected, so fixtures and goldens are deterministic.

### 8.6 Reprints, copies and duplicates (DN-071)

- A reprint is a new job with `reprintOf` and a reason (`lost`, `damaged`, `illegible`, `details-changed`, `printer-fault`), required on every reprint of any patient print.
- **A wristband is printed one copy at a time** (`copies` must be 1; `^PQ1` always, copies go through the HAL). Specimen labels (one per tube of the same specimen) and documents allow up to the HAL's 10; whether specimen copies need a reason is part of DN-071.
- A second wristband request for the same patient and encounter while a band is issued is treated as a reprint and needs a reason (`IssuedBands` port; in memory until the cell, KA-077).
- Every ZPL reprint starts with `~JA` before `^XA` (§7.1), so a format still queued in the printer after an unknown outcome cannot print later beside the next patient's band; the printer's other open jobs become `outcome-unknown` (S7-K verifies the effect).
- The band serial in the payload (§6.1) lets a later scan reject a superseded band; a merge (SI-08), an identity correction or an encounter change asks for an owned "replace wristband" task (the scan check and the task are later work, KA-088).
- The destination printer is the one the workstation's profile binds to its location; choosing another printer is an explicit user step (OQ-241).

## 9. Fonts and the font-coverage test

- **Families:** Noto Sans (Latin script, Western digits) and Noto Sans Arabic (Sorani and Arabic), regular and bold, OFL-1.1: the design system's families (OQ-148). Prints use the Noto project's complete static TrueType files, not the design system's woff2 subsets: Zebra `^PA` needs a downloaded TrueType or OpenType font, the JVM reads TrueType, and the Fontsource subsets split the Western digits from the Arabic letters (OQ-232). `fonts.json` pins each file by SHA-256 and font version.
- **Roles:** `arabic` (Noto Sans Arabic, which has no Latin letters) and `latin` (Noto Sans). An element uses one role; name elements use `by-script` (§4.1).
- **The font-coverage test** (`UnitTest:font-coverage-sorani`, §4.1, §11.1, §18.9), on the shaping port and the font files:
  1. the `arabic` font's character map covers every Sorani letter پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە, ھ (U+06BE), both forms of ي/ی, ك/ک and ه/ە, the Arabic letters including ى, ة and the hamza forms, ZWNJ, ZWJ and the Arabic comma; the `latin` font covers Basic Latin, the letters of transliterated Kurdish names (ç ê î û ş and their capitals), the Western digits and the separators;
  2. each Sorani letter alone, at the start, in the middle and at the end of a word (joined to ب) shapes with no missing glyph;
  3. joining forms: Noto Sans Arabic decomposes most Sorani letters into a base glyph and a mark (`ccmp`, for example ڵ → ل + mark), so the test compares glyph sequences: for each dual-joining letter (پ چ گ ڤ ڵ ێ) the four forms give four different sequences, for each right-joining letter (ژ ڕ ۆ ە) isolated and final differ; and every mark glyph is positioned (a non-zero offset from its base), so ڕ/ر, ڵ/ل and ێ/ی never print alike;
  4. after WP-0.7 is merged, the list is checked against `frontend/packages/i18n/src/sorani-letters.json` (OQ-148).
- S7-K repeats points 2 and 3 on each printer by eye (§11).

## 10. Golden images and fixtures

| Output | Compared | Where it runs |
|---|---|---|
| ZPL text mode | ZPL bytes against approved `.zpl` fixtures | fast tier |
| ZPL raster | the 1-bit image decoded from our own `^GF` fields against an approved PNG, pixel for pixel | fast tier, and again in the nightly `golden-image-print` step |
| ESC/POS | the image decoded from our own `GS v 0` bands against an approved PNG | fast tier and nightly |
| HTML | HTML bytes against approved fixtures | fast tier |
| PDF/A pages | each page of the satellite's PDF of each approved HTML fixture, rasterised at 150 dpi in 8-bit grey with pypdfium2, against an approved PNG, pixel for pixel; plus veraPDF conformance and the zxing-cpp barcode decode | nightly `golden-image-print` step (needs the satellite's runtime) |

- **Decoders are independent of writers:** the `^GF` and `GS v 0` decoders in the tests parse our output bytes and share no code with the writers.
- **Renderer identity.** Images depend on the code that draws them. The JVM goldens are keyed by the JDK's vendor and runtime version, the print fonts' SHA-256s and the module's rasteriser version; the PDF goldens by the WeasyPrint, pydyf, fontTools, Pango, HarfBuzz, FreeType, fontconfig and pypdfium2 versions and the font hashes. A run whose identity has no approved set fails closed ("no approved golden images for <identity>") and writes candidates. The operating system is deliberately not in the JVM identity, because the JDK is pinned on every host; if the WSL run of record differs from the Windows approval, the failure shows it (KA-086).
- **Approval.** The harness writes candidates, a difference image and a manifest to `build/golden-candidates/`; it never overwrites an approved file. An approved set has a manifest with each file's SHA-256, the template id, version and hash, the identity, and `human_script_review: requested`. A set the build agent approved is regression evidence only: it proves the output did not change, not that Sorani and Arabic look right. A Sorani and Arabic reader signs the first set and every change to an identity-text golden [HUMAN] (KA-080). Changing an approved golden named in a hazard's `verified_by` is stop-and-ask item 10 (§3.4).
- **Cases (all synthetic):** for each of wristband, specimen label and receipt, in each label language: a Sorani-script patient, an Arabic-script patient and a Latin-script patient; a long four-part name that wraps; a newborn name at the edge of fitting; twins whose names differ only in the final marker; an alias name; an approximate date of birth; a digit-only MRN under `ckb` and `ar`; at 8 and 12 dots per millimetre, and one wristband at 24. Refusal cases (a name that cannot fit, a missing or unconfirmed Latin form, an unrenderable character, a bidi control) have unit tests, not images. A sample A4 document carries the banner (with a long allergy list and three long name forms), the watermark and a reprint.
- **Exit-criterion evidence:** the fast-tier JUnit reports for the JVM goldens and fixtures, and the `golden-image-print` step's own result in the nightly record for the PDF goldens (the nightly tier as a whole fails closed on its other NOT-BUILT steps).

## 11. The S7-K printer test kit (`tools/s7k/`)

Ready for a human to run [HUMAN: printers]; the agent never runs it on a physical printer. Contents: the protocol and pass criteria; printer-independent ZPL patterns (the Sorani letter chart in every joining form, a bidi pattern, a legibility ladder, native barcodes, a `^FB` line at 100% of its box, a `~JA` reprint case); `~DY` font downloads; the engine's outputs (ZPL text and raster, ESC/POS, PDF) for the sample cases with their reference images; a sender for raw port 9100 that refuses any address that is not loopback or private; a result form (schema, with the approval block `status: requested`, `approved_by: []`). Pass criteria per printer model and firmware: every Sorani letter joined correctly and its marks attached, no box glyphs, right-to-left order, Western digits and no reordered identifiers, no clipped or overprinted text, dot-differentiated letters legible at the minimum size, each barcode decodes to its exact payload (and DataMatrix grades per ISO/IEC 15415 where a verifier is available), `^A@` height calibration recorded, resident font listing (`^HW`) and hashes recorded, firmware read back (`~HI`). Before the human run the kit is self-tested against the WP-0.7 capture simulator on 127.0.0.1:9100 (after the merge, §15). The results drive the Kurdistan Supported Hardware List (§11.1, §18.9) and each printer profile's `textModeVerifiedByS7k`.

## 12. Contracts

- **Module API (`hms.platform.docs.api`):** `PrintCommand` (template id, content, label language, printer profile, copies, `reprintOf` and reason, command context: tenant, facility, actor, on-behalf-of, device, purpose of use, idempotency key, correlation id, time zone) → `PrintResult` (`Rendered` with the bytes, media type, SHA-256, template id, version and hash, and whether first-band verification is required; or `Refused` with the reason and message key). `ReportPrintOutcome` (job id, the HAL result: `sent`, `completed`, or an error kind with `outcomeUnknown`) → the new job state. `VerifyFirstBand` (job id, scanned payload, the user's visual confirmation) → `Verified` or `Mismatch`. Business outcomes are values (§6.2). The printer profile (model, serial, firmware, dots per millimetre, media, resident font hashes, S7-K status) comes from the printer registry and `hal.capabilities` later (OQ-241, KA-084).
- **Events:** §8.2; `docs/specs/events/platform-docs.md`. AsyncAPI and CloudEvents come with the outbox (WP-0.3).
- **Satellite:** §7.5.
- **HAL:** outputs go to the shell unchanged as `hal.print.label` (ZPL or PDF), `hal.print.raw` (ESC/POS) or `hal.print.document` (PDF); the web client's integration is later work (KA-084).
- **Downtime:** how wristbands and labels print with the core down (EN-4, §12.8: the shell caches templates and prints to USB) is undecided: output pre-rendered by this module cannot cover patients registered during the outage, and a second layout engine in the shell would have to reproduce these rules exactly. The options are in DN-074; the downtime path is WP-1.13 (CTRL-0001-8, KA-088).

## 13. Hazards, controls and tests

New entries in `docs/safety/hazard-log.yaml`: HAZ-0045 to HAZ-0049. Existing controls this module implements in part: CTRL-0001-5, CTRL-0001-6, CTRL-0001-7, CTRL-0016-5 (print templates only), CTRL-0021-8 (redaction on prints, with the policy point still WP-0.4).

| Entry | Hazard | Main controls (tests) |
|---|---|---|
| HAZ-0045 (H1, SI-01) | Identity text on a print truncated, clipped, mis-shaped, illegible, reordered or printed off the media, so staff cannot check the patient | R6 and the fit rule with font metrics (`UnitTest:fit-never-truncates`, `PropertyTest:fit-never-truncates`); R4a, R7 and R8 (`UnitTest:print-refuses-unrenderable-text`, `UnitTest:print-refuses-eastern-digits`, `UnitTest:print-refused-without-mrn-check`); the print banner's states and its height (`UnitTest:print-banner-allergy-states`, `UnitTest:print-banner-never-clipped`); the worst-case fit check (`TemplateFitCheck:worst-case-identity-corpus`); the legibility minimum; font coverage and joining (`UnitTest:font-coverage-sorani`); raster default for identity text (`UnitTest:identity-text-rasterised-unless-s7k-verified`); media check (`UnitTest:print-refuses-media-mismatch`); goldens (`GoldenImage:wristband-*`, `GoldenImage:specimen-label-*`, `GoldenImage:receipt-*`); S7-K |
| HAZ-0046 (H1, SI-01) | A label whose printer commands or barcode do not match its content | `^FH` escaping and R7 (`PropertyTest:zpl-field-data-cannot-inject`); R4 payload alphabet; payload from the same content (`UnitTest:barcode-round-trip`, `GoldenImage:barcode-decodes-*`); first-band verification (`UnitTest:first-band-scan-verification`, `UnitTest:first-band-blocks-until-verified`) |
| HAZ-0047 (H13, SI-20) | Print data sent off site or to an online service | offline fetcher, no sockets, hermetic fonts (`UnitTest:renderer-refuses-remote-resources`, `UnitTest:renderer-opens-no-socket`); `HtmlLint` (`UnitTest:html-has-no-external-urls`); the S7-K sender's local-address rule (`UnitTest:s7k-sender-refuses-public-addresses`); no PHI in events (`UnitTest:print-events-carry-no-phi`) |
| HAZ-0048 (H14, SI-21, DP-8) | A print that is not audited, not watermarked, or discloses sensitivity-labelled content | audit before output, refusal on audit failure (`UnitTest:every-print-outcome-audited`, `UnitTest:print-refused-when-audit-fails`); watermark (`UnitTest:watermark-on-every-patient-print`); fail-closed policy (`UnitTest:print-refused-without-policy`); redaction obligations (`UnitTest:labelled-text-redacted-on-print`) |
| HAZ-0049 (H1, SI-01) | A duplicate, stale or misdirected wristband or label | one copy per wristband, reason on every reprint, a second band is a reprint (`UnitTest:wristband-single-copy`, `UnitTest:reprint-requires-reason`, `UnitTest:second-band-is-a-reprint`); no automatic retry and `~JA` before a reprint (`UnitTest:no-automatic-reprint`, `ByteFixture:zpl-reprint-*`); band serial in the payload; the downtime path is undecided (DN-074, WP-1.13) |

## 14. Message keys

`print.refused.identifierMissing`, `print.refused.identityIncomplete`, `print.refused.identifierInvalid`, `print.refused.identityDoesNotFit`, `print.refused.unrenderableText`, `print.refused.templateInvalid`, `print.refused.policyUnavailable`, `print.refused.policyDenied`, `print.refused.auditUnavailable`, `print.refused.reprintReasonRequired`, `print.refused.copiesNotAllowed`, `print.refused.printerUnsupported`, `print.refused.mediaMismatch`, `print.refused.rendererUnavailable`, `print.refused.firstBandPending`, `print.refused.easternDigits`, `print.refused.bannerTooTall`, `print.refused.mrnCheckFailed`, `print.firstBand.scanRequired`, `print.firstBand.mismatch`, `print.caption.mrn`, `print.caption.dob`, `print.caption.approximate`, `print.caption.encounter`, `print.caption.specimen`, `print.watermark.printedBy`, `print.watermark.reprint`, `print.notice.synthetic`. Their `ckb` and `ar` text is drafted by the agent and unreviewed (the WP-0.7 rule, DN-021 on `wp/0.7-design-system`); the label captions live in the templates until the `packages/i18n` catalogues are shared with the backend (OQ-237).

## 15. Not built in WP-0.8, decisions and open questions

- **Waits for the cell (WP-0.2) and the kernel (WP-0.3):** persistence of jobs, issued bands and first-band state (in memory until then); the print spool; event publication; signed template bundles and the one-hash-per-version rule across bundles; the owned tasks (identity incomplete, remove a failed band, replace a wristband); the satellite's container image (written, not built).
- **Waits for WP-0.4:** the policy decision point (until then every production print is refused) and the BALP audit store.
- **Waits for WP-0.7 and later:** the web client's HAL calls; the printer registry and `hal.capabilities` profile data; the S7-K kit's self-test against the capture simulator (after merging `wp/0.7-design-system`); the downtime print path and the superseded-band scan check (WP-1.13 and later).
- **Waits for a human:** S7-K on physical printers [HUMAN: printers]; the human script review of the goldens [HUMAN]; the hospital's real templates and worst-case name corpus (content requests); the CSO's readings DN-068 to DN-074; the licence decision DN-066; the WSL runtime DN-067.
- **Records:** DN-065 to DN-074; OQ-230 to OQ-249; KA-075 to KA-089; ADR-038; HAZ-0045 to HAZ-0049.
- **R7 and NFC:** a name stored in another Unicode normal form is refused rather than normalised at print, so registration must store NFC (a requirement on WP-1.2, OQ-249).
