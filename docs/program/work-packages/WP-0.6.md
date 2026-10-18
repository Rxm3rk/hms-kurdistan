# WP-0.6: Synthetic data and the ADR-001 harness
Phase / release: Phase 0 Foundation / no clinical go-live (feature first runs in R1)   Features: `PLT-OPS-06`
Read first: BUILD-PROMPT §3.5 ("Name the cell behind every number"); §4.2 (ADR-001, ADR-004, ADR-009, ADR-010); §5.1; §15 (offline administration rules); §18.3; §18.6; §18.10; §19.4 (synthetic identifiers). Research: K §7.4; R08 §3.11, §4–§7 (for the Option B and A′ desk assessment)
Depends on: WP-0.4, WP-0.5   Simulators needed: none
Entry criteria:
- WP-0.4 and WP-0.5 merged, or reviewed and stacked (§3.6, §21).
- Not met yet: waits on WP-0.4 and WP-0.5, which wait on WP-0.2. Reference-cell runs need DN-009.
Deliverables:
- The synthetic population generator (§18.10): four-part names in Kurdish (Arabic script), Arabic and Latin with transliteration variants and character-variant noise; the mother's name; Iraqi identifier types with plausible formats, marked as assumptions (the sources give no format or check-digit rules); DOB precision flags with placeholder dates (1 January, 1 July); phones shared within families; several identifiers per person; mixed-script duplicates; canary identities for the PHI-leak scan. Synthetic identifiers use the reserved forms (`SYN-` MRNs and accession numbers, `urn:hms:synthetic:*` codes) and `provenance: synthetic` (§19.4).
- 1,000-bed-day and 300-bed-day workload generators; the 300-bed day is the 1,000-bed workload scaled to 300 beds and 800 sessions, with the scaled volumes recorded (§18.6).
- The benchmark harness for spike criteria C1–C9 (§18.6), including offline-BCMA conflict replays for C2.
- The Kafka vs NATS JetStream footprint comparison (ADR-009).
- Option A measured. Options B and A′ assessed on paper from R08 and K §7.4 (a desk assessment) unless the human asks for a prototype.
- Spike code in `spikes/adr-001/`, not production code, rebuilt from specifications in Phase 1.
- For C5, C8 and ADR-004's tooling criterion: what can be measured (files, modules and migrations touched; agent wall-clock time), with a request to the human to convert it into engineer-days.
- The written spike report, every number naming its cell (dev cell "indicative"; lite cell "lite").
Exit criteria (evidence required):
- A written spike report: C1–C6 and C8 measured on the dev cell (indicative); C7 and C9 harnesses built and dry-run at reduced scale.
- ADR-001 and ADR-009 stay accepted-provisional until a reference-cell run [HUMAN: hardware], unless a measured result already triggers a reopen rule, which is recorded.
- §22.2 work-package Definition of Done and a reviewer report.
Hazards touched:
- No production control: spike code is not production code.
- C2 runs the invariants under 10⁶ randomised command sequences, including offline-BCMA conflict replays (SI-02, SI-15). A violation is recorded in the spike report and applies the ADR-001 decision rule (C2 is a hard gate, §18.6).
[HUMAN] gates:
- Reference-cell hardware for C7 and C9 evidence (DN-009).
- Conversion of the measured effort for C5, C8 and the ADR-004 tooling criterion into engineer-days.
- A prototype of Options B or A′ only if the human asks for one.
