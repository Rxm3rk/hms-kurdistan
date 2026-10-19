# WP-0.8: Documents and printing
Phase / release: Phase 0 Foundation / no clinical go-live   Features: none listed in §21
Read first: BUILD-PROMPT §2.1 (SI-01, SI-16 on prints); §3.7 (printer simulator; no data to online renderers); §4.1 (document rendering, label and token printing, fonts); §5.2 (`platform-docs` and the renderer satellite); §7 item 11; §11.1; §12.4; §12.8; §13.1 (DP-8 watermarking); §18.9 (Script, Printing); §19.4 (synthetic content). Research: K §6.7, §9.2; R16 §9.1
Depends on: WP-0.3   Simulators needed: label and wristband printers: a capture endpoint that stores the ZPL or PDF for golden tests (§3.7)
Entry criteria:
- WP-0.3 merged, or reviewed and stacked (§3.6, §21).
- The printer capture endpoint exists under `tools/simulators/<party>` with contract fixtures (§3.7).
- Not met yet: waits on WP-0.3, which waits on WP-0.2.
- State: in-progress since 19 October 2026 on `wp/0.8-documents-printing` (stacked on `wp/0.1-programme-bootstrap` at `09afa41`), cluster-free parts only. Starting before the entry criteria are met is a deviation from §21 approved by the human lead (DN-065). What needs the cell (persistence, the print spool, the outbox), the Trust Plane (the policy enforcement point, the BALP audit store) or physical printers still waits; tests that need a container are written and recorded as waiting for the cell. The printer capture simulator exists on `wp/0.7-design-system` (`b597713`) and is merged late, at a committed SHA.
Deliverables:
- A template engine: HTML templates rendered to PDF/A, with documents and labels generated from one source (§7 item 11, §12.4).
- The PDF/A renderer satellite with HarfBuzz-grade shaping for Sorani and Arabic. Candidates: a WeasyPrint container or headless Chromium; spike S7-K decides by golden-image tests on the target printers, so the choice stays accepted-provisional (§4.1).
- A ZPL renderer per printer DPI with `^PA` shaping and `^CI28` UTF-8 on Zebra firmware V60.14/V50.14 or later, and a `^GF` raster fallback; ESC/POS for token printers (§4.1).
- The golden-image test harness for the paths we rasterise ourselves (PDF/A pages at fixed DPI; the ZPL `^GF` raster decoded from our own output) and byte-for-byte fixtures for ZPL text mode.
- A font-coverage test for every Sorani letter (پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە) (§4.1, §11.1).
- Print audit (every print audited as its own event type, §6.3, §7 item 11) and watermarking (user, time, patient; DP-8).
- Trilingual sample wristband, specimen label and receipt with synthetic data only (`SYN-` MRNs and accession numbers, `provenance: synthetic`, §19.4). Wristbands carry at least two identifiers and a barcode (DataMatrix with MRN and encounter); newborn names are never truncated (§12.8; SI-01).
- The S7-K printer test kit, ready for a human to run on physical printers.
Exit criteria (evidence required):
- Golden images pass for the paths we rasterise ourselves (PDF/A pages at fixed DPI; the ZPL `^GF` raster decoded from our own output) for a trilingual wristband, specimen label and receipt.
- ZPL text-mode output is checked byte for byte against approved fixtures; its printed appearance is verified only in S7-K on physical printers [HUMAN: printers].
- The S7-K kit is ready to run.
- The renderer choice stays accepted-provisional until S7-K.
- The font-coverage test passes.
- Label data never goes to an online renderer.
- §22.2 work-package Definition of Done and a reviewer report.
Hazards touched:
- H1 wrong patient (SI-01: two identifiers on every label, wristband and print; the name in the patient's script plus Latin).
- H13 privacy egress (label data never leaves for an online renderer, §3.7).
- H14 unlawful disclosure (print audit and watermarking; printing passes through the policy enforcement point once WP-0.4 exists).
[HUMAN] gates:
- S7-K on physical printers [HUMAN: printers]; its results drive the Kurdistan Supported Hardware List (§18.9).
