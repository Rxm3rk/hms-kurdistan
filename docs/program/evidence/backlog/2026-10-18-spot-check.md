# Backlog spot check, 18 October 2026

Work package: WP-0.1 Programme bootstrap (BUILD-PROMPT.md §21: "`backlog.yaml` generated from Appendix A by a script, with a ten-row spot check").
Checked by: the WP-0.1 build agent (AI), not a person. This is not a human review (§3.5).
Where it ran: the Windows 11 build host in Git Bash, Python 3.12.10 from `.tools/venv`, PyYAML 6.0.3. Branch `wp/0.1-programme-bootstrap`, base commit `ed023b6`, working tree not yet committed (a dirty-tree run).
Plan of record: the working-tree `BUILD-PROMPT.md` has CRLF line endings (2,951 lines, every one CRLF; the git index holds CRLF too). The tool gives the same records, files and check result for LF and CRLF copies (unit test `RealPlanLineEndingTest`).

This file replaces the version written earlier the same day by a session that was cut off. That version's sample and its ten per-row results were confirmed by this session's fresh run. Its paragraph about a cross-check of all 236 rows described a run this session did not witness, so it is replaced below by this session's own run.

## Command

```sh
sh tools/hms backlog spot-check --seed 20261018 --count 10
```

Exit code 0. Seed **20261018**. The tool draws `random.Random(20261018).sample(rows, 10)` over the 236 Appendix A rows in source order (234 feature IDs plus the two part rows) and prints each raw row beside the record read from `docs/program/backlog.yaml`.

Sampled rows, in draw order: `IMP-FND-01`, `AI-DCS-01`, `ACC-OPD-01`, `CLN-QI-01`, `AI-AMB-01`, `PLT-OPS-02`, `IMP-RDY-01`, `DX-POC-01`, `DEV-GW-01`, `SPC-ICU-02`.

## Method

For each row the source line was read straight from BUILD-PROMPT.md (`sed -n '<line>p' BUILD-PROMPT.md`), not from the tool's output, and compared cell by cell with the backlog.yaml record:
- ID, Feature, Size and Phase with `id`, `title`, `size` and `phase`;
- Stance with `stance` and `domain_level` (the dagger);
- the Scope · Kurdistan note cell with `scope`, `kurdistan_note` (the italic part after the middle dot) and `placement_marked` ([P] in the note);
- `work_packages` with every mention of the ID in §21 (found with `awk` over lines 2267 to 2375, then read in context);
- the hand-edited fields with their defaults (`status: todo`; `tests`, `hazards` and `notes` empty).

## Result: ten of ten match

| # | ID | BUILD-PROMPT.md line | §21 mentions (line: package) | Result |
|---|---|---|---|---|
| 1 | `IMP-FND-01` | 2736 | 2322: WP-1.14 | Match. XL, R1, B, no dagger; scope "Order sets, flowsheets, templates, CDS, roles, reports, charge masters"; note "Re-scoped: Kurdistan foundation build (regional brands, trilingual forms)"; no [P]; `work_packages: [WP-1.14]` |
| 2 | `AI-DCS-01` | 2707 | 2369: Phase 5 | Match. M, P2, B; note "MVP→P2; English drafts with omission checklist"; work package `Phase 5 (the AI platform and products; none of this starts before company gate G3, ≈M40, K-23)`, the plan's wording for the bracket that lists it |
| 3 | `ACC-OPD-01` | 2503 | 2311: WP-1.3; 2329: Phase 1.1 | Match. M, R1, B; note "Display boards in R1.1"; `work_packages: [WP-1.3, Phase 1.1 (queue display boards)]` |
| 4 | `CLN-QI-01` | 2541 | 2319: WP-1.11 | Match. M, R1, B; the whole note, including its inner " · Placed R1: …" segment, kept in `kurdistan_note`; no [P], so `placement_marked: false`; `work_packages: [WP-1.11 (engine)]` |
| 5 | `AI-AMB-01` | 2706 | 2373: Phase 6 | Match. M, P3, stance P; scope "Ambient OPD documentation (EN/AR/HI), ≥2 partners"; note "MVP→P3; Sorani/Badini only after S8-K"; work package `Phase 6 (Sorani and Badini only after S8-K)` |
| 6 | `PLT-OPS-02` | 2458 | 2321: WP-1.13 | Match. L, R1, B; note "P2→MVP inside PLT-SITE-01; cell at hospital A by M18"; `work_packages: [WP-1.13]` |
| 7 | `IMP-RDY-01` | 2738 | 2322: WP-1.14 | Match. Size kept verbatim as "L (BP M→L)" and counted as L = 20 engineer-weeks; R1, B; note "RG3 adds WAN-, power-cut, dual-currency drills"; `work_packages: [WP-1.14]` |
| 8 | `DX-POC-01` | 2589 | 2369: Phase 5 | Match. M, P2, stance I; no italic note, so `kurdistan_note: null`; `work_packages: [Phase 5]` |
| 9 | `DEV-GW-01` | 2605 | 2365: Phase 4 | Match. L, R2.1, B+I (no dagger); two-segment note kept whole; work package `Phase 4 (the validated ICU monitor feed)`, shared with `DEV-VAL-01` as the plan words it |
| 10 | `SPC-ICU-02` | 2621 | 2369: Phase 5 | Match. S, P2, B; scope "APACHE II/SOFA (reg C)", no note; `work_packages: [Phase 5]` |

No discrepancies were found.

None of the ten rows has a dagger stance, an escaped pipe or a [P] mark. Those cases are covered by the unit tests in `tools/hmstools/backlog/tests/` (`test_source.py`, `test_real_plan.py`) and by the full cross-check below.

## Cross-check of all 236 rows

A throwaway script, written in this session independently of the tool and kept outside the repository, read BUILD-PROMPT.md as raw bytes, stripped the CR of each line, split every Appendix A row on unescaped pipes, split the scope cell at the first " · *" and did its own size arithmetic. It compared the twelve parsed fields of all 236 rows with backlog.yaml:
- 0 mismatches; 236 rows; 234 unique feature IDs; no row missing and none extra;
- [P] marks only in `CLN-CDS-01` and `CLN-CDS-02` (lines 2517 and 2518); 18 dagger stances; no escaped pipes in any Appendix A row today.

A.18, by the same script (S = 3, M = 8, L = 20, XL = 50):

| Phase | Feature IDs | Engineer-weeks, annotations honoured | A.18 | Engineer-weeks at face value |
|---|---|---|---|---|
| R1 | 110 | 1606 | 110 / 1606 | 1620 (+14) |
| R1.1 | 3 | 19 | 3 / 19 | 19 |
| R2a | 9 | 86 | 9 / 86 | 86 |
| R2b | 25 | 266 | 25 / 266 | 266 |
| R2.1 | 6 | 55 | 6 / 55 | 55 |
| P2 | 48 | 558 | 48 / 558 | 558 |
| P3 | 19 | 266 | 19 / 266 | 266 |
| DROPPED-K | 14 | 326 | 14 / 326 | 326 |
| MVP (R1 to R2.1) | 153 | 2032 | 153 / 2032 | 2046 (+14) |
| All | 234 | 3182 | 234 / 3182 | 3196 (+14) |

Every count and sum equals A.18 when the size annotations are honoured. At face value three R1 rows differ: `RCM-SCH-01` "M (−3)" counts 5, not 8 (its scheme part, "≈3 ew", is a separate P2 row); `DFD-REC-01` "M (−3)" counts 5, not 8 (its PHR-push part is a separate DROPPED-K row); `KRI-ID-01` "L (+12 net)" counts 12, not 20. That is 3 + 3 + 8 = 14. `docs/program/BACKLOG.md` shows both readings.

## Work-package mapping, checked by hand against §21

§21 (lines 2267 to 2375) was read in full. For each row below every mention of the ID in §21 was found with `awk` and read in context, and the package and the qualifier wording were compared with `work_packages` in backlog.yaml. The rows cover Phase 0 to Phase 6, the qualifiers (base, full, outpatient, inpatient, non-device rules and the longer wordings), a tail shared by two IDs, part rows, features named by several packages and features named by none.

| ID | §21 lines | `work_packages` in backlog.yaml | Result |
|---|---|---|---|
| `PLT-CORE-01` | 2287 | WP-0.3 | match |
| `PLT-CORE-03` | 2289 | WP-0.5 | match |
| `PLT-OPS-06` | 2290 | WP-0.6 | match |
| `PLT-UX-03` | 2291 | WP-0.7 (base) | match |
| `KRI-LOC-01` | 2291, 2318 | WP-0.7 (base); WP-1.10 | match |
| `TRU-REG-02` | 2293 | WP-0.9 | match |
| `PLT-CORE-02` | 2287, 2308 | WP-0.3; WP-1.1 (full) | match |
| `TRU-KEY-01` | 2288, 2321 | WP-0.4 (base); WP-1.13 (full) | match |
| `PLT-CORE-06` | 2308 | WP-1.1 (non-device rules) | match |
| `INT-ENG-01` | 2309, 2320 | WP-1.1b (base); WP-1.12 (full) | match |
| `CLN-ORD-02` | 2312, 2346 | WP-1.4 (outpatient); WP-3.1 (inpatient) | match |
| `CLN-CDS-02` | 2313, 2346 | WP-1.5 (outpatient subset); WP-3.1 (full) | match |
| `OPS-STAT-02` | 2319, 2339 | WP-1.11; WP-2.5 (MLC, births, deaths) | match |
| `KRI-LOC-02` | 2318 | WP-1.10 (framework) | match |
| `INT-FHIR-01` | 2320, 2329 | WP-1.12 (read); Phase 1.1 (FHIR SMART, Bulk and Subscriptions) | match |
| `RCM-INS-01` | 2317, 2329 | WP-1.9; Phase 1.1 (document-pack automation) | match |
| `DX-LAB-03` | 2315, 2329 | WP-1.7; Phase 1.1 (LIS autoverification v1 in `reg-lis-rules`, activated only where the Boundary Register allows) | match |
| `MED-DSP-01` | 2338 | WP-2.4 | match |
| `SPC-OT-03` | 2337, 2352 | WP-2.3 (charging and stock); WP-3.7 (clinical record) | match |
| `SPC-MAT-01` | 2339, 2354 | WP-2.5 (newborn registration, mother–baby link, birth notification); WP-3.9 (L&D record) | match |
| `PLT-UX-04` | 2348 | WP-3.3 | match |
| `CLN-CDS-05` | 2350 | WP-3.5 (`reg-ews`) and its fallback | match |
| `DX-BB-02` | 2355 | WP-3.10 (optional) | match |
| `IMP-MIG-01` | 2322, 2358 | WP-1.14; WP-3.13 (inpatient pack) | match |
| `DEV-GW-01` | 2365 | Phase 4 (the validated ICU monitor feed) | match |
| `DEV-VAL-01` | 2365 | Phase 4 (the validated ICU monitor feed) | match |
| `CLN-DOC-04` | 2357, 2365 | WP-3.12; Phase 4 (release-of-information workflow automation) | match |
| `OPS-STAT-01` | 2319, 2365 | WP-1.11; Phase 4 (secondary statutory returns) | match |
| `MED-DOSE-01` | 2369 | Phase 5 (the Dose Engine first; shadow mode ≥4 weeks, C2 activation) | match |
| `RCM-SCH-01` | 2317, 2369 | WP-1.9 | match: line 2369 names "the scheme part of `RCM-SCH-01`", which goes to the part row |
| `RCM-SCH-01 · part: scheme` | 2369 | Phase 5 (the scheme part) | match |
| `CLN-CDS-06` | 2369 | Phase 5 (sepsis screen, Regulated Module #2) | match |
| `AI-GW-01` | 2369 | Phase 5 (the AI platform and products; none of this starts before company gate G3, ≈M40, K-23) | match |
| `PLT-OPS-03` | 2373 | Phase 6 (multi-site edge cell (after a dedicated reconciliation hazard analysis)) | match |
| `AI-AMB-01` | 2373 | Phase 6 (Sorani and Badini only after S8-K) | match |
| `CLN-CDS-07` | 2373 | Phase 6 | match |
| `DFD-REC-01` | 2318 | WP-1.10 | match |
| `DFD-REC-01 · part: PHR push` | none | none | match (DROPPED-K) |
| `RCM-US-01` | none | none | match (DROPPED-K) |

All 39 rows match, so the parser needed no fix. These expectations are now a regression test (`HAND_CHECKED` in `tools/hmstools/backlog/tests/test_real_plan.py`).

A second throwaway script, line-based and independent of the tool's item and qualifier parsing, read the WP cell and the Scope/Features cell of every §21 table row and the first paragraph of Phase 1.1, 4, 5 and 6, and compared which packages name which IDs (qualifiers ignored): 220 feature IDs named, 0 differences. The 14 feature IDs named by no package are exactly the 14 DROPPED-K rows. This comparison is also a unit test now.

Observations for the lead (faithful to the text, not parser errors):
- WP-2.2 (line 2336) names the wildcard `RCM-*` "inpatient scope (§9.20–§9.21)". It names no single feature, so it is attached to none, and `check` warns about it.
- Line 2303 (the W3-K wedge variant) mentions `INT-SEAM-01`. It is a variant note, not a package listing; `INT-SEAM-01` is mapped to WP-1.3.
- Some §21 items refer to a feature's later scope without its ID, so that feature does not get the package: "MIS breadth" in Phase 1.1 (`OPS-MIS-01`); "AP/AR breadth" and "the consignment bill-only purchase order" in Phase 4, both worded under `ERP-PRC-01` (Appendix A and A.20 place them in `ERP-FIN-01` and `ERP-IMP-01`); "basic privacy reports" in WP-3.12 (`TRU-AUD-02`, A.20). If wanted, add these packages to `work_packages` by hand: generate keeps such entries and check lists them as warnings.

## Related results from this session

- `sh tools/hms backlog generate` and `sh tools/hms backlog render`: exit 0. Re-running both on the files on disk changed nothing except the backlog.yaml header comment, which this session edited.
- `sh tools/hms backlog check`: PASS, exit 0. Counts: 236 rows, 234 feature IDs, 2 part rows; by phase R1 110, R1.1 3, R2a 9, R2b 25, R2.1 6, P2 48, P3 19, DROPPED-K 14; status todo 234; 14 features without a work package, all DROPPED-K; 1 work-package reference not mapped. One warning: the WP-2.2 `RCM-*` wildcard.
- `sh tools/hms backlog check --json`: exit 0; the last stdout line is one JSON object with `check`, `ok` (true), `counts`, `errors` (empty) and `warnings` (the same one).
- `.tools/venv/Scripts/python.exe -I -m unittest discover -s tools/hmstools/backlog/tests -t tools`: 97 tests, OK.
