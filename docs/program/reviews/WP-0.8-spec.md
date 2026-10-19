# WP-0.8 specification review (automated review (AI))

Reviews of `docs/specs/modules/platform-docs.md` before its code (BUILD-PROMPT §3.2 step 2). Each review was an independent agent session with no write access; it is recorded as "automated review (AI)", never as a human review (§3.5). The work is patient-safety relevant (wristband and label content, shaping, print audit), so the review policy of DN-065 asks for at least two lenses and every major finding fixed before commit.

| Round | Lens | Result | Answered in |
|---|---|---|---|
| 1 | Engineering correctness and feasibility | 0 critical, 14 major (plus 2 raised as minor that the integrator treated as major: approval of goldens, wristband copies), 15 minor | The rewrite of the spec (round 2 input) |
| 1 | Clinical safety and hazard control | 0 critical, 19 major (20 counted with the watermark finding), 9 minor | The rewrite of the spec |
| 2 | Both lenses: each round-1 major checked, new findings | Of 36 round-1 majors, 23 resolved and 13 partly; 12 new or remaining majors, 12 minor; 0 critical | The round-2 revision (this commit) |

## Round 1, summary of the major findings and their resolution

Engineering: Arabic line height (font `hhea` metrics, spec §5.3); fixed font role for Latin-script patients (`by-script`, §4.1); `^GF` byte limit (bands of at most 99,999 bytes, §7.2); `^FB` overprint and backslash sequences (text mode only after S7-K; `\` refused, §7.1, R7); Noto Sans Arabic decomposes Sorani letters (glyph-sequence and mark tests, §9); golden identity and comparison rules (§10); hermetic satellite fonts (§7.5); veraPDF required (§7.5, §10); deterministic watermark (injected clock and ids, §8.5); outcome and first-band commands (§12); audit before output (§8.3); renderer reachability (§7.5, KA-083); S7-K and the renderer choice (OQ-245, KA-087).

Clinical safety: hazard entries HAZ-0045 to HAZ-0049 in B.2 form; one decision entry per CSO reading (DN-068 to DN-074) and tightenings recorded; the print banner defined and the label exemption put to the CSO (DN-068); banner sizing (§7.4); `ownForm` (§3.1); minimum legible sizes and the worst-case corpus check (§4.3, §5.4); unknown, alias and newborn patients (DN-073); first-band verification key, blocking and visual confirmation (§6.3); media check (§7.6); duplicates and reprints (§8.6); SI-21 redaction obligations (§8.4, R10); specimen barcode (OQ-240); payload alphabet and `^BX` escape (§6, R4); downtime (DN-074); digits and structured times (R8, §2); human review of goldens (§10, KA-080); linter completeness (§4.3); watermark on labels (DN-070).

## Round 2, the remaining major findings and their resolution

| # | Finding | Resolution |
|---|---|---|
| B-1 | Template hash, printer serial and the dispatched outcome missing from the contract types | Added to `PrintJobHeader`, `PrintAuditRecord`, `PrintOutcome` and `RenderRequest` |
| B-2 | The approximate-DOB marker `≈` has no glyph in either pinned font and an undefined element | The marker is `~` in the Latin date element; the approximate caption follows R6 and the legibility minimum (R5, §3.3) |
| B-3 | First-band verification could leave a printer blocked; visual confirmation false undefined | A refused, failed or unknown first job releases the pending state; no visual confirmation counts as a mismatch; who verifies (§6.3) |
| B-4 | `~JA` placement and its effect on other queued jobs | `~JA` before `^XA`; the printer's other open jobs become outcome-unknown and are audited (§7.1, §8.6) |
| B-5 | The media check was undefined | §7.6: ±1.0 mm, print-head width, unknown media refused |
| B-6 | The document banner could be re-broken by the satellite | Banner lines pre-broken with a fixed line height; `bannerTooTall` refusal (§7.4) |
| B-7 | Several printed fields could not carry sensitivity labels | Every clinical free-text field is `LabelledText` (§3.1) |
| B-8 | The downtime architecture was asserted, not decided | Moved to DN-074's options (§12) |
| B-9 | "No photo" would be false for a patient with a photo; sensitivity indicators undecided | "Photo on record (not printed)"; both in DN-068 |
| B-10 | MRN check digit unchecked at print; single-identifier specimen barcode | `MrnCheckPort`, fail closed (R4a, KA-081); the default specimen barcode carries two identifiers (§6.1, DN-068) |
| B-11 | Eastern digits in clinical display text | R8 covers all printed text |
| B-12 | Mixed-script non-identity text refused | The `mixed` font chain for non-identity text; identity text and captions single-font (§4.1, rule 7) |

The round-2 minor findings were answered in the same revision where they touched the text (REPRINT beneath content, resident-font hashes as a provisioning record, `media.min_dots_per_mm`, the Latin-own rule, specimen copies in DN-071, audit failures on outcome reports, NFC at entry as OQ-249, test names in §13, the watermark wording) or by the files this commit adds (`docs/specs/state-machines/print-job.yaml`, `docs/specs/events/platform-docs.md`).

## Round 3 (verification of round 2)

8 of the 12 round-2 majors resolved; B-3, B-4, B-7 and B-8 partly; one new major (N-1: an unknown first-band outcome released the pending state although such a band may have printed). Answered: a mismatch has an audited reset after the band's removal (`ResetFirstBandKey`, DN-072); an unknown first outcome keeps the key pending until the band is verified or the user states that none came out (`DeclareNoBandPrinted`); the print-job machine gains `CancelledByReprint` and audited late outcomes; banner allergies and weight are never redacted and the SI-16/SI-21 tension goes to the CSO (DN-068 item 7); the HAZ-0049 row no longer asserts the downtime path; the minors (references, R8's own refusal key `print.refused.easternDigits`, auditing first-band outcomes, the approximate caption in lint rule 1, the `mediaMatches` predicate) fixed.

**State:** the round-3 fixes were not re-reviewed as a spec; the code review of the slices checks them against the code.
