# Open questions

Questions that do not block work yet (BUILD-PROMPT §3.1): the Q-K list (§23), the A.20 source conflicts, the Appendix A placements awaiting human confirmation (§1 scope rule), recorded differences between sources, content requests, and the engineering choices [P] the build made where the plan sets no value. An item moves to `DECISIONS-NEEDED.md` when it blocks a work package (§23).

Every item has an ID (OQ-nnn) and a status: `open`, `answered` (a human has answered; the answer, who gave it and the date are recorded under the item), `moved` (now a DN item) or `closed`. The build agent never answers these on a human's behalf. Until a human answers, the build uses the default shown, built as configuration or a port so that a later answer is a data change, not a rewrite (§23).

Calendar: M0 = January 2027, so M12 = January 2028 (K §0).

## (a) K's open questions Q-K1…Q-K19

Source: K §19.2 (question, deadline "By", K's default if unanswered), BUILD-PROMPT §23 (default to build with). Owners: K §19.2 names none; where the deadline names a validation-sprint workstream, the owner is the one K §19.1 gives for it, and related [L] items (K Appendix B) are listed with their owners.

### OQ-001 · Q-K1: Design partner #1 and hospital A
- **Question (K §19.2):** DP#1's identity. Does it have a polyclinic or diagnostic centre? Is hospital A on paper or an electronic ADT?
- **Default to build with (§23):** build for W1-K (polyclinic first, with the seam controls in §9.2) and keep W2-K buildable (§21, wedge variants). K's default if this stays unanswered is W2-K: Core HIS across hospital A at ≈M24, with R2a code-complete at M21. Build the search-only EMPI client and `INT-SEAM-01`.
- **K's default if unanswered:** W2-K: Core HIS across hospital A at ≈M24.
- **Deadline:** M2–M6.
- **Owner:** not named in K §19.
- **Context:** K-20 (wedge); §21 wedge variants (W1-K, W2-K, W3-K). Affects WP-1.3 (`INT-SEAM-01`) and Phase 2 timing (under W2-K, R2a completes with Phase 1). Under W2-K, DP#1's CSO signs a W2-K hazard analysis before that RG1 [HUMAN].
- **Status:** open

### OQ-002 · Q-K2: Cross-border rules and regional cloud
- **Question (K §19.2):** May encrypted backups or PHI-free services use a regional cloud? May AI inference run offshore with consent and minimisation?
- **Default to build with (§23):** no PHI offshore in any form; Kurdistan DR site only. Regional-cloud backup target behind a disabled-by-default adapter.
- **K's default if unanswered:** no PHI offshore in any form until a counsel opinion; Kurdistan DR site only.
- **Deadline:** M4 (S17-K).
- **Owner:** counsel and DPO (K §19.1, S17-K legal opinions pack).
- **Context:** SI-20; K-16; §13.3 (residency); L-11 (CTO), L-15 (DPO). Regional-cloud ciphertext backups are a P2 item after Q-K2 (A.19); offshore AI inference also needs a Safety Board processor entry (§17.2).
- **Status:** open

### OQ-003 · Q-K3: KRG return formats and statutory forms
- **Question (K §19.2):** KRG Ministry return formats, notifiable-disease rules, DHIS2 use, birth and death forms.
- **Default to build with (§23):** build the indicator catalogue and export framework; formats load as configuration.
- **K's default if unanswered:** build the framework; formats loaded as configuration when received.
- **Deadline:** requested M6; in hand M12.
- **Owner:** Kurdistan pack PM and Chief CSO (K §19.1 item 6: meetings with the KRG Ministry of Health on reporting formats).
- **Context:** L-24 (Kurdistan pack PM); §11.5, §12.7; WP-1.11 (`OPS-STAT-01`, `OPS-STAT-02`); R1.1 `KRI-STAT-02`; WP-2.5 (births, deaths, MLC).
- **Status:** open

### OQ-004 · Q-K4: Device status of the Tier 2 functions
- **Question (K §19.2):** Device status of NEWS2, transfusion verification, LIS autoverification and the Dose Engine; any vigilance channel.
- **Default to build with (§23):** treat all as devices; fallback control sets active; voluntary post-market surveillance reports.
- **K's default if unanswered:** treat all as devices; fallback control sets at go-live; voluntary post-market surveillance.
- **Deadline:** M9 (S16-K).
- **Owner:** Kurdistan pack PM and Chief CSO (K §19.1 item 6 covers device opinions and any vigilance channel). Related: L-16 (Head of QA).
- **Context:** K-05; SI-18; §10.2 (the Boundary Register, seeded in WP-0.9); §10.3 (fallback control sets).
- **Status:** open

### OQ-005 · Q-K5: Electronic signatures, records and retention
- **Question (K §19.2):** Does Law No. 78 of 2012 apply in the Region? Are electronic records admissible? What retention periods apply?
- **Default to build with (§23):** simple electronic signatures with strong authentication and audit behind a pluggable signature-provider port; never auto-delete; 25-year retention floor.
- **K's default if unanswered:** simple e-signatures with strong authentication and audit; never auto-delete; 25-year floor.
- **Deadline:** M4.
- **Owner:** counsel and DPO (K §19.1; S17-K covers electronic signatures and records and retention, K §15.4). Related: L-17, L-18 (counsel).
- **Context:** §13.4 (signatures, retention, legal hold; court-evidence exports wait for admissibility rules); KDV-12.
- **Status:** open

### OQ-006 · Q-K6: Tax and receipts
- **Question (K §19.2):** Tax treatment of hospital services and of our software sales; receipt rules; company and investment set-up.
- **Default to build with (§23):** a configurable tax and receipt engine; receipt templates as configuration. The zero rate is a development default only: a tax-counsel opinion is a [HUMAN] prerequisite for the R1 go-live and part of the wedge RG1 evidence (K §12.1).
- **K's default if unanswered:** configurable tax engine; counsel opinion before R1.
- **Deadline:** M4.
- **Owner:** counsel and DPO (K §19.1; S17-K covers tax on hospital services and company set-up, K §15.4).
- **Context:** `RCM-TAX-01` (WP-1.9); Phase 1 exit (§21).
- **Status:** open

### OQ-007 · Q-K7: Kotlin or C#
- **Question (K §19.2):** Kotlin vs C# (ADR-002) and real loaded costs.
- **Default to build with (§23):** Kotlin (ADR-002).
- **K's default if unanswered:** Kotlin; blended costs as §14.5 (K §14.5).
- **Deadline:** M3.
- **Owner:** CTO and CFO (K §19.1, S18-K talent and salary survey). Related: L-21 (CTO), L-22 (CFO).
- **Context:** ADR-002; switching needs an ADR backed by the S18-K survey (§4.1). WP-0.1 builds the Kotlin skeleton.
- **Status:** open

### OQ-008 · Q-K8: Drug knowledge base
- **Question (K §19.2):** Drug-KB vendor with regional brand coverage and Arabic content; licence terms.
- **Default to build with (§23):** a vendor-neutral drug-KB port with a synthetic mock KB for tests; the regional brand master is our own asset.
- **K's default if unanswered:** best-coverage vendor; the brand master stays our asset.
- **Deadline:** M6.
- **Owner:** not named in K §19 (the S20-K coverage test, K §15.4). Related: L-25 (medication lead).
- **Context:** `CLN-CDS-01` (WP-1.5); licensed content (§3.4 item 5); company gate G1 needs the drug-KB contract with the vendor's written regulatory position (K §15.1).
- **Status:** open

### OQ-009 · Q-K9: SNOMED CT
- **Question (K §19.2):** Is Iraq a member, what does an MLDS licence cost, and does CDS need subsumption?
- **Default to build with (§23):** Global Patient Set plus local codes; terminology service ready for SNOMED.
- **K's default if unanswered:** Global Patient Set plus local codes; no licence until needed.
- **Deadline:** M6.
- **Owner:** not named in K §19.
- **Context:** ADR-015; KDV-14; `PLT-CORE-05` (WP-1.1); SNOMED CT is licensed content (§3.4 item 5).
- **Status:** open

### OQ-010 · Q-K10: Payment, wallet and messaging partners
- **Question (K §19.2):** Payment, wallet and messaging partners (WhatsApp Business, Viber, SMS).
- **Default to build with (§23):** card-terminal and wallet ports with one reference adapter each, plus WhatsApp and SMS adapters; vendors chosen later.
- **K's default if unanswered:** card terminals plus one wallet; WhatsApp and SMS.
- **Deadline:** M12.
- **Owner:** not named in K §19. Related: L-26 (Kurdistan pack PM).
- **Context:** `KRI-PAY-01`, `KRI-MSG-01`, `DFD-MSG-01` (WP-1.9, WP-1.10); simulators only until partners exist (§3.7).
- **Status:** open

### OQ-011 · Q-K11: Colocation operators
- **Question (K §19.2):** Colocation operators for the central and DR sites: power, security, connectivity.
- **Default to build with (§23):** central and DR deployment parameterised by site; no operator-specific code.
- **K's default if unanswered:** two operators in two cities.
- **Deadline:** M9.
- **Owner:** not named in K §19. Related: L-37 (CTO).
- **Context:** WP-1.13; `deploy/central/`.
- **Status:** open

### OQ-012 · Q-K12: National ID verification and document formats
- **Question (K §19.2):** Is there any national ID verification service or card SDK? What are the MRZ and barcode formats?
- **Default to build with (§23):** capture from the document, verify later; card-format parsers as plug-ins.
- **K's default if unanswered:** capture from the document; verify later.
- **Deadline:** M9.
- **Owner:** not named in K §19. Related: L-13 (identity squad lead).
- **Context:** `KRI-ID-01`, `ACC-ID-02` (WP-1.2); §11.2.
- **Status:** open

### OQ-013 · Q-K13: National health insurance
- **Question (K §19.2):** National health insurance (Law No. 22 of 2020): federal rollout has reportedly begun. When does it reach the Region, and what are its rails?
- **Default to build with (§23):** the scheme abstraction is ready; no adapter until the scheme arrives; the federal adapter sits in the Iraq pack.
- **K's default if unanswered:** scheme abstraction ready; federal adapter in the Iraq pack; no Kurdistan adapter until the scheme arrives.
- **Deadline:** watch; M24.
- **Owner:** not named in K §19. Related: L-5 (counsel).
- **Context:** the scheme part of `RCM-SCH-01` (P2); §11.10.
- **Status:** open

### OQ-014 · Q-K14: Public blood banks
- **Question (K §19.2):** Public blood bank workflows: labels, ISBT 128 use, issue documentation.
- **Default to build with (§23):** relabel at receipt (SI-11 controls); ISBT 128 parsing ready.
- **K's default if unanswered:** relabel at receipt.
- **Deadline:** M12.
- **Owner:** not named in K §19. Related: L-23 (lab informaticist).
- **Context:** `DX-BB-KRI-01` (WP-3.10); the relabel-scope conflict OQ-035.
- **Status:** open

### OQ-015 · Q-K15: Accreditation targets
- **Question (K §19.2):** Which accreditation targets Kurdistan buyers value; KRG licensing checklists.
- **Default to build with (§23):** JCI pack first.
- **K's default if unanswered:** JCI pack first.
- **Deadline:** M6.
- **Owner:** Kurdistan pack PM and Chief CSO (K §19.1 item 6 covers licensing checklists). Related: L-19 (Chief CSO).
- **Context:** `CLN-QI-01` (WP-1.11); §11.8.
- **Status:** open

### OQ-016 · Q-K16: Federal entry route
- **Question (K §19.2):** Baghdad partner and federal entry route; federal vs KRG rules for software vendors.
- **Default to build with (§23):** Iraq pack as configuration.
- **K's default if unanswered:** partner-led entry.
- **Deadline:** M40.
- **Owner:** not named in K §19.
- **Context:** K-29; §11.10 (Iraq federal pack, P2).
- **Status:** open

### OQ-017 · Q-K17: Badini output script
- **Question (K §19.2):** Badini output: Arabic script only, or Latin script for some patients?
- **Default to build with (§23):** Arabic script; Latin-script templates possible through `ku-Latn`.
- **K's default if unanswered:** Arabic script.
- **Deadline:** M4 (S7-K).
- **Owner:** not named in K §19 (S7-K). Related: L-12 (CPO).
- **Context:** `KRI-LOC-02`; locales (§4.1: `ku-Latn` only if Q-K17 says it is needed); WP-0.7, WP-1.10.
- **Status:** open

### OQ-018 · Q-K18: Public-sector pilot funding
- **Question (K §19.2):** Funding sources for a public-sector pilot (KRG budget, donors, development banks).
- **Default to build with (§23):** no public-sector-specific features.
- **K's default if unanswered:** no public work without funding.
- **Deadline:** company gate G3.
- **Owner:** not named in K §19.
- **Context:** K-29.
- **Status:** open

### OQ-019 · Q-K19: Pricing, deposits and invoices in US dollars
- **Question (K §19.2):** Under current Central Bank rules, may hospitals and we price, hold deposits and invoice in US dollars?
- **Default to build with (§23):** IQD price lists, with USD accepted at the posted rate; USD price lists disabled by default behind a tenant setting.
- **K's default if unanswered:** IQD price lists, with US dollars accepted at the posted rate.
- **Deadline:** M4 (S17-K).
- **Owner:** counsel and DPO (K §19.1, S17-K). Related: L-33 (CFO + counsel).
- **Context:** `RCM-TAR-01`, `KRI-RCM-01` (WP-1.9); §11.4.
- **Status:** open

## (b) Source conflicts from BUILD-PROMPT Appendix A.20, awaiting human confirmation

Each row is recorded as A.20 asks. The build follows the resolution until a human confirms or changes it (§1).

| ID | Conflict (A.20) | Resolution used (A.20) | Where it matters | Status |
|---|---|---|---|---|
| OQ-020 | AI gateway and control plane: 20 engineer-weeks in K §4.1 vs 40 in R14 | Scope follows R14 (both features); capacity planning follows K | `AI-GW-01`, `AI-GOV-01` (P2); A.18 explains the resulting sum differences | open |
| OQ-021 | `INT-IPS-01`: "from day one" (K §4.3, §9) vs not moved in K §4.1 | R1 | WP-1.12 | open |
| OQ-022 | `AI-NUR-01`, `CLN-CDS-07`: P2 in places, P3 in K §11.2 | P3 | Phase 6 | open |
| OQ-023 | `OPS-PRD-01` predictive discharge P3 vs AI-0 forecasts P2 | Operational forecasts P2; predictive discharge P3 | Phase 5, Phase 6 | open |
| OQ-024 | `OPS-RTL-01`: P3 in counts vs RTLS ingestion P2 in K §4.3 | P2 ingestion; never an engine | Phase 5 | open |
| OQ-025 | `DX-BB-02` blood-bank interface kept vs "no interface assumed" | Optional inbound adapter in R2b; manual receipt is the default | WP-3.10 | open |
| OQ-026 | `ACC-ID-02` vs `KRI-ID-01` | One identity epic; build both IDs together in WP-1.2 | WP-1.2 | open |
| OQ-027 | `DFD-MSG-01`: K drops BP's +4 as DLT governance, but the +4 also covered OTP/expiring-link release | Keep the release rule in R1 | WP-1.10 | open |
| OQ-028 | `DX-LAB-04` back to M vs the lab-quality pack kept in K §4.3 | Build the lab-quality pack in R1 under `DX-LAB-04`/`DX-LAB-05`; watch capacity | WP-1.7 | open |
| OQ-029 | `DEV-GW-01`: dependency of the ICU flowsheet (R14) vs monitor feed in R2.1 (K) | R2.1; the R2b ICU flowsheet uses nurse-entered vitals | WP-3.8; Phase 4 | open |
| OQ-030 | `TRU-AUD-02`: privacy analytics MUST at GA vs P2 | Rules-based privacy reports by R2b; full analytics and the patient-visible log in P2 | WP-3.12; Phase 5. §13.1 records the same conflict for AU-6 (MUST at GA in K §10, P2 in K §4.3) with the same interim default | open |
| OQ-031 | `ERP-IMP-01` at P2 vs consignment in MVP procurement-lite (K §12.2) | Consignment bill-only PO in R2.1; UDI recall trace in P2 | Phase 4; Phase 5 | open |
| OQ-032 | `IMP-CRT-01` academy tooling P2 vs academy live by M36 | Tooling in P2; the academy itself is a business activity | Phase 5 | open |
| OQ-033 | `CLN-DOC-02` bloat indicator in BP R2.1, absent from K | Provenance in R1; bloat indicators by R2b | WP-1.4; Phase 3 | open |
| OQ-034 | LIS rules: one shared rules engine (R04) vs Tier 2 isolation (K) | Releasing or interpreting results = Tier 2 `reg-lis-rules`; reflex, add-on and routing rules = non-device decision tables | WP-1.7; R1.1 | open |
| OQ-035 | Relabel scope: units "without a usable barcode" (K-08) vs every unit (SI-11) | Relabel every unit at receipt (the safer, uniform reading; Q-K14 default) | WP-3.10. Safety-relevant: the stricter reading applies (§1); §9.11 also asks for this record | open |
| OQ-036 | Event names: `ChargeCreated`/`PatientTransferred` (R11) vs `ChargeGenerated`/`EncounterMoved` (BP) | R11 names canonical; BP names are aliases | WP-0.3 (event catalogue) | open |
| OQ-037 | Undrawn transitions (medication administration, specimen rejection, bed blocked/closed) | Proposed in §8.4 and put to the approving panels | WP-0.5 | open |
| OQ-038 | "Paediatric weight-based rounding" in K §4.3's MVP nursing scope (carried over from BP, where the Dose Engine was MVP) vs SI-05 with the Dose Engine in P2 | No dose arithmetic or rounding outside `reg-dose`; until P2 the pharmacist decides under control set A (SAC-13) | Safety-relevant: SI-05; WP-3.2; Phase 5 (`MED-DOSE-01`) | open |
| OQ-039 | `AI-PAT-01` "templated then AI" (R14, BP) vs template-only patient text (K §11.2, §11.3) | Templates only; AI may suggest a template and never writes patient text | Phase 5 | open |

## (c) Appendix A placements awaiting human confirmation

§1: where Appendix A deliberately differs from K (a note, a [P] mark or an A.20 entry), the build follows Appendix A and keeps the item open here until a human confirms it. The notes are quoted from Appendix A's "Scope · Kurdistan note" column.

### [P] marks (safety-driven changes of this prompt)

| ID | Feature | Phase | Appendix A note | Status |
|---|---|---|---|---|
| OQ-040 | `CLN-CDS-01` Drug KB adapter | R1 | Regional brand mapping; R1 OPD use unstated · Placed R1: [P] Pulled to R1 so outpatient e-prescribing is screened. (§9.10: K first uses the adapter at R2a transcription; record the change here) | open |
| OQ-041 | `CLN-CDS-02` Order checks | R1 | KB screening at R2a transcription; CPOE checks R2b · Placed R1: [P] Outpatient subset in R1; transcription checks R2a; full CPOE checks R2b. (§9.10: outpatient subset = allergy, interaction, duplicate and dose-range screening shown verbatim) | open |

### Placement notes

| ID | Feature | Phase | Appendix A note | Status |
|---|---|---|---|---|
| OQ-042 | `PLT-UX-04` Mobile app framework | R2b | One app: nurse mode (BCMA, R2b) + physician mode (K §6.6) · Placed R2b: Mobile app is needed for nurse BCMA in R2b | open |
| OQ-043 | `TRU-SEC-02` ISO 27001 + SOC 2 | R1 | ISO 27001(+27701) ≈M24; SOC 2 only if a buyer asks · Placed R1: Controls built from R1; the certification itself is [HUMAN] | open |
| OQ-044 | `TRU-SEC-03` Market attestations | R1 | Replaced, same size: ISO 27001 and local attestations · Placed R1: Controls built from R1; attestations are [HUMAN] | open |
| OQ-045 | `CLN-ORD-02` CPOE | R1 | OPD orders R1; inpatient CPOE R2b; R2a orders on paper · Outpatient orders R1; inpatient CPOE R2b | open |
| OQ-046 | `CLN-CDS-03` CDS telemetry + harness | R1 | Harness runs after every KB/content release (K §6.3) · Placed R1: CDS runs from R1, so telemetry and the harness do too | open |
| OQ-047 | `CLN-CDS-07` Predictive deterioration | P3 | Conflict: K §4.3 P2 vs K §11.2 P3 · Placed P3: Device-grade partner model, silent first (K §11.2 AI-3). (Also OQ-022) | open |
| OQ-048 | `CLN-DOC-02` Copy-forward provenance | R1 | BP P2→MVP (bloat indicator BP R2.1); K §4.2 silent · Placed R1: Provenance from the first note; bloat indicators by R2b. (Also OQ-033) | open |
| OQ-049 | `CLN-RES-01` Results inbox | R2b | Named in R2b; R1 OPD inbox unstated · Outpatient result acknowledgement runs in R1 through DX-ORD-01 | open |
| OQ-050 | `CLN-IPC-01` Isolation flags | R1 | Banner (R1) and bed board (R2a) both carry isolation · Placed R1: Banner flag in R1; bed-board use in R2a | open |
| OQ-051 | `CLN-ACP-01` Code status + ACP | R2a | Code status on banner (R1); 'code documentation' in R2b · Placed R2a: Inpatient workflow; the banner field exists from R1 | open |
| OQ-052 | `CLN-INC-01` Incidents + RCA | R1 | In K §4.3 Quality MVP; release unstated · Placed R1: Safety-event reporting from the first go-live | open |
| OQ-053 | `CLN-QI-01` Accreditation KPIs | R1 | Replaced, same size: JCI + KRG licensing indicators · Placed R1: Measure engine in R1; JCI and KRG packs complete by R2b | open |
| OQ-054 | `MED-KRI-01` Brand master + labels (K new) | R1 | Release unstated; brands serve POS, labels serve BCMA · Placed R1: Brand master for the R1 POS; unit-dose labels by R2a | open |
| OQ-055 | `DX-BB-02` Blood bank interface | R2b | Not dropped in K §4.1; K §9.1 assumes no interface · Placed R2b: Optional inbound adapter only; no interface assumed (K §9.1). (Also OQ-025) | open |
| OQ-056 | `DEV-GW-01` Device gateway | R2.1 | Inferred: validated ICU monitor feed R2.1 · Nothing clinical depends on a device feed before R2.1. (Also OQ-029) | open |
| OQ-057 | `SPC-OT-03` Intra-op record + charging | R2a | OT billing R2a; clinical intra-op record release unstated · OT charging and stock R2a; clinical intra-op record R2b | open |
| OQ-058 | `SPC-MAT-01` L&D + newborn | R2a | Re-scoped; KRG birth notification R2a; L&D release unstated · Newborn registration, mother-baby link and birth notification R2a; electronic L&D record R2b | open |
| OQ-059 | `ERP-IMP-01` Implant/UDI | P2 | K §12.2 puts consignment in MVP procurement-lite · Consignment bill-only PO built in R2.1 with ERP-PRC-01. (Also OQ-031) | open |
| OQ-060 | `OPS-RTL-01` RTLS | P2 | BP/K §4.3 list RTLS ingestion P2; counts keep P3 · Placed P2: RTLS ingestion is P2 (K §4.3, §9.2); the engine is never built. (Also OQ-024) | open |
| OQ-061 | `DFD-BOK-01` Booking link | R1.1 | BP R2.1; K §4.2 silent · Placed R1.1: Ships with wallet payment links | open |
| OQ-062 | `IMP-TEL-01` Clinician telemetry | R1 | K §4.3 drops 'telemetry' from BP's tooling list · Placed R1: Usability telemetry from the first go-live (T-120 baselines) | open |
| OQ-063 | `KRI-LOC-02` Badini templates | R1 | Release unstated; Duhok review; Latin-script need via S7-K · Placed R1: Framework in R1; Badini content before the first Duhok go-live | open |

### Placements inferred where K states no release

Appendix A marks these "inferred": K does not determine the release, so this prompt chose one.

| ID | Feature | Phase | Appendix A note | Status |
|---|---|---|---|---|
| OQ-064 | `PLT-PWR-01` Power-loss resilience (K new) | R1 | Inferred R1: RG1 power obligations; M18 power-cut tests | open |
| OQ-065 | `TRU-KEY-01` Per-tenant KMS | R1 | BP P2→MVP; HSM/TPM KMS, no HYOK (ADR-008); inferred R1 | open |
| OQ-066 | `TRU-BCP-03` Back-entry | R1 | Frequent outages; sized for back-entry (SI-10); inferred R1 | open |
| OQ-067 | `ACC-ID-03` Aliases, newborn, photo | R1 | Inferred R1 (registration); K §4.3 Identity list | open |
| OQ-068 | `CLN-CHT-03` Results review | R1 | Inferred R1 (wedge LIS/RIS results) | open |
| OQ-069 | `CLN-CDS-08` VTE prompts | R2b | Inferred R2b (inpatient CPOE); sweep candidate (K §5.6) | open |
| OQ-070 | `CLN-HND-01` I-PASS | R2b | Inferred R2b (inpatient) | open |
| OQ-071 | `CLN-BH-01` Suicide screen + restraint | R2b | Inferred R2b (inpatient orders) | open |
| OQ-072 | `MED-FRM-01` Formulary | R1 | Inferred R1 (OP POS); regional brands | open |
| OQ-073 | `MED-INF-01` Infusion model | R2b | Inferred R2b (with eMAR) | open |
| OQ-074 | `DEV-VAL-01` Vitals validation UX | R2.1 | Inferred with ICU monitor feed (R2.1) | open |
| OQ-075 | `SPC-DIE-01` Diet orders | R2b | Religious preferences; inferred R2b (inpatient orders) | open |
| OQ-076 | `RCM-DEN-01` Denials | R1 | Inferred R1 (credit flow); denial root-cause queues | open |
| OQ-077 | `ERP-INV-01` Stores | R1 | Inferred R1 (OP POS dependency) | open |
| OQ-078 | `ERP-HR-01` Staff master | R1 | Medical Syndicate/IMA registration IDs; inferred R1 | open |
| OQ-079 | `OPS-FLW-01` Discharge clearance | R2a | Inferred R2a (discharge billing); SI-12 extended | open |
| OQ-080 | `AI-DAT-01` Reporting replica | R1 | On the on-site cell; inferred R1 (MIS basics) | open |
| OQ-081 | `AI-DAT-02a` CDC bronze (BP split) | R1 | Central site; migration staging; inferred R1 | open |
| OQ-082 | `IMP-SUP-01` Service desk + status page | R1 | Inferred R1 (24×7 support M21); status page (K §13.7) | open |

### Notes recording another difference from K

Appendix A's note records that K §4.3, K's module catalogue, does not list the feature, lists less of its scope, or gives it another stance. For the rows "Not in K §4.3", K §14.2 keeps the work only within the P2 and P3 engineer-weeks it carries over from BP. Appendix A keeps the phase and stance shown, and the build follows it until a human confirms (§1).

| ID | Feature | Phase | Appendix A note | Status |
|---|---|---|---|---|
| OQ-108 | `DX-RIS-03` Dose capture | P2 | Not in K §4.3; K §14.2 keeps P2 | open |
| OQ-109 | `DEV-SDC-01` SDC/SDPi | P3 | Not in K §4.3; K §14.2 keeps P3 | open |
| OQ-110 | `ERP-FIN-03` ERP connectors | P2 | Not in K §4.3; K §14.2 keeps P2 | open |
| OQ-111 | `INT-DOC-01` Documents | R1 | K §4.3 lists PDF/A + FHIR (no CDA). (The feature reads "PDF/A + CDA/FHIR documents from one source"; K §4.3's MVP interoperability list has "PDF/A plus FHIR documents from one source") | open |
| OQ-112 | `INT-PH-01` Public-health reporting | P2 | Not in K §4.3; notifiable diseases via OPS-STAT (R1). (K §4.3 lists "KRG returns and notifiable diseases" in the MVP, served by `OPS-STAT-01`) | open |
| OQ-113 | `AI-SUM-01` Chart summary | P2 | Not in K §4.3; K §14.2 keeps P2 | open |
| OQ-114 | `AI-RCM-01` Claim scrubbing | P2 | K §4.3 marks claim scrubbing (P). (Appendix A's stance is B, build; K §4.3's **P** is "partner or licence") | open |
| OQ-115 | `AI-INB-01` In-basket AI | P3 | Not in K §4.3; K §14.2 keeps P3 | open |
| OQ-116 | `DFD-CRM-01` CRM | P2 | Not in K §4.3; K §14.2 keeps P2 | open |

The remaining Appendix A rows with a "Conflict:" note (`INT-IPS-01`, `OPS-PRD-01`, `AI-NUR-01`) are A.20 entries and are tracked in (b) as OQ-021, OQ-023 and OQ-022. Section (d) records three further notes as differences between sources (OQ-088 to OQ-090). Every other Appendix A note restates a change K makes itself (re-scoped, replaced, dropped, moved or kept in K) or adds context, and needs no entry here. The build agent checked this row by row over all 236 rows on 18 October 2026, when OQ-108 to OQ-116 were added for review finding R-08.

## (d) Recorded differences between sources

Differences noticed while writing the Phase 0 plan. Where one affects safety, the stricter reading is in use (§1).

### OQ-083: Who approves the state machines
- **Sources:** §21 WP-0.5 names "[HUMAN: pharmacist and nurse panels, lab CSO, HIM, CSO]". §8.4 names, per machine: encounter (nurse panel + HIM + CSO); order and medication administration (pharmacist and nurse panel + CSO); specimen (lab CSO); result (lab CSO + physician panel); bed (nurse panel + bed manager); appointment (OPD panel); credit claim and pre-approval (RCM lead + Kurdistan pack PM).
- **Reading in use:** request approval from every approver §8.4 names (the fuller list; it adds the physician panel for results and the bed manager for beds).
- **Status:** open

### OQ-084: The lite cell cannot show WP-0.2's failover criterion
- **Sources:** §5.1 defines the lite cell as one Kafka broker, two PostgreSQL instances and no Argo CD. WP-0.2's exit evidence (§21) requires that killing any single node (primary or standby) keeps PostgreSQL writable with no committed transaction lost, and that losing two nodes stops writes; that is the behaviour of three instances with quorum synchronous replication (§5.1, §16.2).
- **Reading in use:** the criterion is not weakened; on a lite cell it stays open and the evidence says so.
- **Status:** moved (blocks WP-0.2 on this host: DN-005)

### OQ-085: How lite-cell numbers are labelled
- **Sources:** §3.5 says "Dev-cell and lite-cell numbers are 'indicative'"; §5.1 and "Before the first session" say lite-cell numbers are labelled "lite".
- **Reading in use:** lite-cell results carry the label "lite" and count as indicative; neither counts as evidence for C7, C9, the SLOs or release gates (`evidence/README.md`).
- **Status:** open

### OQ-086: Package overrun and revisit-window semantics are undefined
- **Sources:** §9.20 and K §12.1 name package overrun rules and a free revisit window; §9.20 says the sources do not define their behaviour and asks for the semantics to be logged here.
- **Reading in use:** both are built as configurable rules in WP-1.9; the semantics chosen are recorded under this item when they are built.
- **Status:** open

### OQ-087: When the hazard-log service gets its UI
- **Sources:** §10.1 says build the hazard log in Phase 0 as data plus a CI gate and grow it into a service with UI in Phase 1. §21 WP-0.9 builds the hazard-log service and the Boundary Register with "API and minimal UI" in Phase 0.
- **Reading in use:** WP-0.1 builds the data and the CI check; WP-0.9 adds the API and a minimal UI; the full service UI follows in Phase 1. No conflict in substance.
- **Status:** open

### OQ-088: `CLN-IMM-01` ABDM part
- **Sources:** Appendix A note: "BCMA scan with inpatient BCMA (BP); ABDM part unaddressed in K". K does not address the India (ABDM) part of BP's immunisation feature.
- **Reading in use:** Appendix A keeps `CLN-IMM-01` in R1 without the ABDM part (the India national rail is dropped in K §2, "What does not apply").
- **Status:** open

### OQ-089: `DX-LAB-06` BP condition not addressed in K
- **Sources:** Appendix A note: "BP NABL condition (P3→P2) not addressed in K".
- **Reading in use:** Appendix A keeps `DX-LAB-06` in P3.
- **Status:** open

### OQ-090: `ERP-PRC-01` base release unstated
- **Sources:** Appendix A note: "K R2.1 says 'breadth'; base release unstated".
- **Reading in use:** Appendix A places `ERP-PRC-01` in R2.1 (with AP/AR breadth and the consignment bill-only purchase order, §21 Phase 4).
- **Status:** open

### OQ-091: [L] tags in K with no row of their own in K Appendix B
- **Sources:** K Appendix B says "Every [L] item in this edition rests on one of these assumptions". Some product-relevant [L] tags in K have no obvious single row; `ASSUMPTIONS.md` lists them with the nearest row.
- **Reading in use:** treat each as configuration or as a recorded assumption, like L-1…L-37. A human decides whether K Appendix B should gain rows for them.
- **Status:** open

### OQ-092: K's defaults and the build defaults differ in kind for some Q-K items
- **Sources:** for Q-K6, Q-K8, Q-K10, Q-K11, Q-K16 and Q-K18, K §19.2 states a business default (for example "Best-coverage vendor", "Two operators in two cities", "Partner-led entry") and §23 states how to build around the question (a port, a parameter, configuration). Section (a) shows both.
- **Reading in use:** no conflict found; the build follows §23 and does not foreclose K's business default.
- **Status:** open

### OQ-093: §21 names some scope without feature IDs
- **Sources:** BUILD-PROMPT §21 names scope in words where Appendix A has a feature ID, so the backlog generator cannot attach the work package: "MIS breadth" (Phase 1.1; probably `OPS-MIS-01`), "AP/AR breadth" and the consignment purchase order (Phase 4; probably `ERP-FIN-01` and `ERP-IMP-01`), and "basic privacy reports" (WP-3.12; probably `TRU-AUD-02`). WP-2.2 also names the wildcard `RCM-*`, which matches no single feature (a warning of `tools/hms backlog check`).
- **Reading in use:** those features carry no work package from these phrases yet. `work_packages` is a hand-edited field that regeneration keeps, so the mapping is added by hand when the phase is planned.
- **Status:** open

### OQ-101: Release rings against the critical-patch deadline
- **Sources:** ADR-021 (§4.2, K §7.9) stages every on-site release through rings: the reference cell for at least 7 days, then a non-flagship site for at least 14 days, then all sites, so a release reaches every site after 21 days at the earliest. SD-8 (§13.1) and the §16 table require critical and KEV fixes on site within 14 days.
- **Reading in use:** neither figure is changed (ADR-021 records the tension). An expedited path for critical fixes needs a human decision when WP-1.13 builds the release train.
- **Status:** open

### OQ-102: No freshness target for the central data landing
- **Sources:** ADR-023 sets the reporting replica at ≤60 s and lands encrypted CDC bronze data centrally, but neither K nor BUILD-PROMPT restates BP's ≤15-minute lakehouse figure for the central landing.
- **Reading in use:** the freshness tests that guard ADR-023 test the ≤60 s replica target only until a central target is set.
- **Status:** open

### OQ-103: Care-team assignment has no feature ID, owning module or work package
- **Sources:** ADR-024 (§4.2) makes care-team assignment a core ES-lite domain that feeds nurse call; §9 says role and unit assignment from the staff master feed it and that it feeds the nurse-call and ACM platforms, but Appendix A gives it no feature ID and §21 no work package. ADR-024 also records that R16 §2.2 and §8.5 describe the nurse-call feed differently.
- **Reading in use:** it is built with the work package that builds ADT and the staff assignment it depends on, once a human assigns it; the nurse-call feed format waits for that decision.
- **Status:** open

### OQ-104: The dependency scorecard has no file or work package
- **Sources:** §4.3 requires a scorecard (steward, funding, release cadence, bus factor, licence history) for every runtime dependency, and §4.1 uses it to choose the object store and to re-resolve pins at phase boundaries; no file and no work package are named for it.
- **Reading in use:** the scorecard is created as `docs/program/dependency-scorecard.md` by the first work package that adds a runtime dependency to a running system: WP-0.2, which also chooses the object store through it [P].
- **Status:** open

### OQ-105: Two ADR guards have no exit criterion that names them
- **Sources:** ADR-027's guard is "break-glass tests", but WP-1.13's exit evidence does not name them; ADR-023's guard is "freshness tests", which no exit criterion names.
- **Reading in use:** both tests are added with the work packages that build those features (WP-1.13; the reporting replica's work package) and listed in their exit evidence when those packages are planned.
- **Status:** open

### OQ-117: ADR-016 has no reopen trigger, where BP §7.2 sets one
- **Sources:** BP §7.2 gives ADR-016 (regulated-module segregation) the reopen trigger "NB pre-submission rejects the segregation argument", and K keeps BP's ADR-016 text (K §7.2). BUILD-PROMPT §4.2 sets no trigger ("—"). K plans no notified-body submission before an export market chooses one (K-04; KDV-3), so the BP trigger has nothing to fire on in Kurdistan (ADR-016, Context).
- **Reading in use:** ADR-016 follows §4.2: no reopen trigger, with BP's trigger quoted for reference. Any change to the ADR stays stop-and-ask item 2 (§3.4). A human confirms whether BP's trigger returns when an export market brings a notified-body route.
- **Status:** open

### OQ-118: ADR-017's reopen trigger names the Safety Board, where BP §7.2 names a notified body
- **Sources:** BP §7.2 gives ADR-017 (CDS) the reopen trigger "A notified-body-agreed change to the device boundary", and K keeps BP's ADR-017 text (K §7.2). BUILD-PROMPT §4.2 words it "A change to the device boundary agreed through the Safety Board". K plans no notified-body route before an export market chooses one (K-04; KDV-3) (ADR-017, Context).
- **Reading in use:** ADR-017 uses the §4.2 wording and quotes BP's for reference. The device-boundary rule itself, no rules engine inside the device boundary, is the same in all three sources. A human confirms the wording, and whether a notified body must also agree once an export market brings one.
- **Status:** open

### OQ-119: How C9's "≤60% utilisation" is aggregated
- **Sources:** K §7.4 words C9's pass as "p95 targets met at ≤60% CPU and memory headroom on the reference hardware". BUILD-PROMPT §18.6 reads it as "p95 targets met with CPU and memory utilisation ≤60%" and asks for the interpretation to be recorded in the ADR. Neither says whether utilisation is taken per node or across the cell, or as a peak or a sustained value (ADR-001).
- **Reading in use (interim default, §1):** the stricter reading, per node over the peak window, and the spike report states the aggregation it used (ADR-001). A human settles the reading before the reference-cell run of C9 counts as evidence (WP-0.6; DN-009).
- **Status:** open

### OQ-120: SI-05 clause d before the Dose Engine
- **Sources:** §2.1 SI-05 reads "Hard stop at 10×/100× deviation." Until `reg-dose` is active at a site, the KB ≥10× Tier A rule (§10.3 A.2) stops only a KB result ≥10× the maximum dose, because outside `reg-dose` the system may only compare a KB-returned ratio, flag or maximum with a governed threshold (§2.1 (c)). A 10× or 100× error below that threshold, a tenfold or hundredfold underdose, or an order with no KB ratio, flag or maximum gets no automated hard stop and is left to pharmacists (double check where CTRL-0005-9 applies; otherwise verification without independent calculation; after the fact for override doses).
- **Question for the CSO [HUMAN]:** is this gap of control set A acceptable until P2, what must the seeded 10× errors (§9.10 acceptance 2, §10.3 A.3) include, and does control set A need a further control within the §2.1 allowed comparisons?
- **Reading in use:** the hazard log does not count these errors as covered by clause d before the Dose Engine (CTRL-0005-7 and CTRL-0005-16 in `docs/safety/hazard-log.yaml`; `docs/safety/README.md`, open question 9). It blocks nothing now: nothing is built, and every control is `planned`. It must be answered before R2b go-live, where RG3 validates control set A (CTRL-0005-15); Appendix A.19 also places control set A at transcription in R2a, so the CSO says whether the answer is needed by then.
- **Status:** open

## (e) Content requests

Content requests are logged here when a slice needs clinical content that only exists as synthetic sample content (§3.3, §19.4), or a published source document that a human must place in `docs/content-sources/` (§3.5).

### OQ-143: Code-status and isolation vocabularies
- **Content needed:** the code-status vocabulary (values, definitions, labels in en, ckb and ar) and the isolation-precaution vocabulary (§9.4: contact, droplet, airborne, and any others), approved for clinical use [HUMAN] (§3.4 item 3).
- **In use:** synthetic sample entries (`provenance: synthetic`, NOT FOR CLINICAL USE) in the WP-0.7 demo fixtures only (`docs/specs/modules/design-system.md` §2.1). Until approved content exists, a code that the client vocabulary does not know shows the field as unavailable (design-system §2.1 rule 6).
- **Needed by:** WP-1.4 (`CLN-IPC-01`) and R2a (`CLN-ACP-01`), before any clinical use.
- **Status:** open

### OQ-151: Clinician review of the ckb and ar UI text
- **Content needed:** a clinician review [HUMAN] of every `ckb` and `ar` message the agent drafted (DN-021), starting with the `banner.*`, `clinical.*` and `sign.*` keys; and a translation memory owned by the content team (§11.1).
- **In use:** agent-drafted text, marked `unreviewed` per key (KA-031).
- **Points the build agent raised for the reviewer** (WP-0.7 slice S2; the review covers every message, not only these):
  - `ar` `banner.weight.source.stated`, drafted as "حسب الإفادة": it must read as reported by the patient or family, the least reliable weight source, and never as authorised or approved (an earlier draft, "مصرح به", could be read that way).
  - `ar` `sign.outcomeUnknown`: it must say that the outcome is not known, never "not signed" and never "he does not know" (an earlier draft began "لا يعرف").
  - `ar` `hal.capture.discardedAfterContextChange`: it must say that the capture is gone and nothing was saved for the new patient (an earlier draft said "ignored", "تم تجاهل").
  - `ar` plurals: the `two` branches use "# ثانية", "# حساسية" and "# نتيجة" rather than the dual form, and `commandPalette.resultCount` has `zero {# نتيجة}`.
  - `ar` `sign.intent.*`: written to be gender-neutral; it also needs the HIM review.
  - `ckb` wording: `banner.isolation.label` "جیاکردنەوە", `banner.mrn.label` "ژمارەی تۆماری پزیشکی", and the letter for /h/ (ه against ھ).
- **Needed by:** before any hospital use; it is part of the release translation gate (§11.1, §18.9; Phase 1 exit).
- **Status:** open

### OQ-152: The UCUM unit display map
- **Content needed:** a governed map from each UCUM unit code used on screens to its ISMP-safe display form (for example `ug` → `mcg`; `U` and `[iU]` → `units`), approved for clinical use [HUMAN] (§3.4 item 3). The ISMP list of error-prone abbreviations is the source.
- **In use:** a synthetic sample (`kg`, `g`, `mg`, `ug` → `mcg`, `mL`, `L`, `U` → `units`, `mmol/L`, `%`), labelled NOT FOR CLINICAL USE. A unit not in the map shows "Invalid value" (`docs/specs/modules/design-system.md` §2.6).
- **Needed by:** the work package that builds the formulary (`MED-FRM-01`) and WP-1.7 (results), before clinical use.
- **Status:** open

## (f) Engineering choices [P] made in WP-0.1, awaiting confirmation

Choices the build made where the plan of record sets no value. They bind until a human confirms or changes them; changing one is an ordinary change with a recorded reason, except where a [HUMAN] role is named.

### OQ-094: Host resource thresholds in `tools/doctor`
- **Choice:** the dev cell needs at least 32 GB of RAM (at least 30 GiB measured) and 8 cores; the lite cell at least 16 GB (15 GiB measured) and 4 cores; at least 50 GiB of free disk; on Windows the WSL2 VM is sized as host RAM minus 4 GiB (`tools/hmstools/doctor/checks.py`).
- **Sources:** BUILD-PROMPT "Before the first session" sets 32 GB and 8 cores for the full dev cell and no figure for the lite cell or the disk.
- **Next:** WP-0.2 measures what the lite cell uses on this host (a 10 GB VM, DN-005) and confirms or changes the lite-cell and disk thresholds.
- **Status:** open

### OQ-095: The hazard-log risk vocabulary
- **Choice:** severity `negligible`, `minor`, `serious`, `major`, `catastrophic`; likelihood `improbable`, `remote`, `occasional`, `probable`, `frequent`; level `low`, `medium`, `high`, `very-high` (`docs/safety/README.md`, `docs/safety/hazard-log.schema.json`). The `initial_risk` values in the hazard log are proposals, never acceptances.
- **Sources:** BUILD-PROMPT Appendix B.2 uses this family of words without fixing the scale.
- **Who confirms:** the CSO [HUMAN].
- **Status:** open

### OQ-096: Backend packages and test tiers
- **Choice:** base package `hms`; modules in `hms.<module>` with hyphens turned into dots; shared kernel libraries in `hms.kernel.<lib>`. Each test tier has its own source set: `src/test` (unit and architecture tests, fast tier), `src/propertyTest` (property-based tests, fast tier with 1,000 sequences and nightly with 10⁶), `src/integrationTest` (merge tier) (`backend/README.md`).
- **Why source sets:** splitting one source set by test tags made Kotest report the excluded tests as skipped and left an empty placeholder test in the JUnit reports, so the tier counts were wrong (81 tests and 14 skipped reported where 66 ran).
- **Status:** open

### OQ-097: Licences acceptable for build-only tools
- **Choice:** `tools/licence/policy.yaml` lists licences acceptable only for tools that never ship (for example CC0-1.0, the Boost licence BSL-1.0, and GPL or AGPL build tools). §4.3 checks build- and CI-only tools for use restrictions, not distribution terms; the list is not an extension of the shipped allowlist. 0BSD and Zlib were on it until DN-022 (decided 18 October 2026) added them to the shipped allowlist; slice S1 of WP-0.7 moved them on 19 October 2026.
- **Status:** open

### OQ-098: When each §6.8 fitness function arrives
- **Choice:** the work package that adds each fitness function the skeleton cannot express yet (`backend/README.md`, "Fitness functions"; the CI runner's step owners, `sh tools/ci/run <tier> --list`). Where §21 names the evidence (WP-0.3 journal rebuild, WP-0.4 repository access and canary scan) the placement follows it; the others are [P]: dose-arithmetic analysis in WP-0.3 when `Quantity` exists, the fact-table write ban and the N-1 migration test with the first migrations in WP-0.3, Modulith verification when `app-hms` exists (WP-0.3), the egress test with the dev cell (WP-0.2), the scans and SBOM in WP-0.9, Tier 2 coverage and mutation gates with the first Tier 2 sidecar (WP-1.5).
- **Status:** open

### OQ-099: Branch names and the tenant-identifier register
- **Choice:** branches must match `main`, `wp/<n.m>-<slug>` (§3.6), `release/<version>` or `hotfix/<slug>`, and may not contain a registered tenant identifier or the words customer, tenant or client (`tools/hmstools/repo/rules.py`). `tools/config/tenant-identifiers.yaml` registers only the reserved synthetic examples `SYN-TENANT-0001` and `SYN-TENANT-0002`; real tenants are added at onboarding [HUMAN].
- **Sources:** §3.6 names only `main` and `wp/<work-package>-<slug>`; `release/` and `hotfix/` are this build's additions.
- **Status:** open

### OQ-100: Evidence labels for the two checkouts
- **Choice:** runs on the Windows checkout are labelled "Windows host" and are never evidence of record; fast-tier and doctor evidence of record comes from the WSL clone at a committed SHA, labelled "WSL build host, no cell" (`docs/program/evidence/README.md`, KA-001).
- **Status:** open

### OQ-121: Whether a risk acceptance survives a linked release or incident
- **Choice:** a sign-off record authorises its field only while the subject is at the version it decided on. A hazard entry has no `version` field, so its version is its content without the human fields (`docs/safety/signoffs/README.md`, "Subject version"), and that content includes the entry's linked `releases` and `incidents`. Linking a release or an incident to a hazard therefore voids its risk acceptance (`residual_risk.accepted_by`, and with it `status: accepted`) and its CSO triage, and `sh tools/hms safety check` fails until the CSO signs a new record for the new version (`tools/hmstools/safety/signoffs.py`, `content_version`).
- **Sources:** §10.1 gives the hazard record "linked features, invariants, incidents and releases"; neither §3.5 nor §10.1 says whether adding such a link is a change that a risk acceptance must cover again.
- **Who confirms:** the CSO [HUMAN]: should a hazard's risk acceptance survive linking a release or an incident to it? No hazard is accepted yet and no entry links a release or an incident.
- **Status:** open

## (g) Engineering choices [P] and readings made in WP-0.7, awaiting confirmation

Choices WP-0.7 made where the plan of record sets no value, and readings of the plan it uses until a human confirms them. They bind until a human confirms or changes them; changing one is an ordinary change with a recorded reason, except where a [HUMAN] role is named. The WP-0.7 readings of safety invariants are not here: they are decisions for the CSO, DN-026 to DN-032 in `DECISIONS-NEEDED.md`.

### OQ-140: Two frontend packages beyond §6.1
- **Choice:** `frontend/packages/ui-core` (DOM-free: the banner model, patient context, `clinical-number`, the clock; shared by web and mobile) and `frontend/packages/hal-client` (the typed HAL contract and its transports).
- **Sources:** §6.1 [P] and ADR-019 "Layout [P]" list design-system, regulated-ui, i18n and api-client. ADR-019 is not edited; this entry records the addition.
- **Status:** open

### OQ-141: Western digits for every number in the staff UI; dates as YYYY-MM-DD
- **Choice:** a tightening of §6.5, applied to all staff workspaces:
  - the UI locales are `en`, `ckb-u-ca-gregory-nu-latn` and `ar-u-ca-gregory-nu-latn` (canonical BCP 47 form);
  - no Eastern Arabic-Indic digit appears anywhere in the staff workspaces;
  - the banner shows dates as `YYYY-MM-DD` (`docs/specs/modules/design-system.md` §2.6, §3);
  - the §6.5 option of Eastern digits for patient-facing text is kept for those surfaces;
  - the grouping of clinical numbers is not part of this choice: it is DN-031.
- **Sources:** §6.5, §11.1, §14.6, §18.9 "Digits".
- **Who confirms:** the human lead; for the Western digits on clinical numerals, which the hazard log records as a tightening of CTRL-0005-17, also the CSO [HUMAN]. WP-0.8's wristband date format must match the banner's.
- **Status:** open

### OQ-142: The demo route is left out of production builds
- **Choice:** `/demo/*` is registered only when the build sets `VITE_HMS_DEMO=1`, and the route-tree test checks that the production tree has no `/demo`. Demo pages use synthetic fixtures only and carry a "NOT FOR CLINICAL USE" watermark.
- **Sources:** §21 WP-0.7 exit ("A demo route renders the banner…"); §3.3, §18.10. The plan says nothing about production builds.
- **Status:** open

### OQ-144: The API-client generator waits for WP-0.4
- **Choice:** WP-0.7 does not build the `packages/api-client` generator. The banner reads synthetic fixtures. The first OpenAPI contracts come with WP-0.3 and WP-0.4 (`docs/specs/api/README.md`).
- **Sources:** §6.3; §21 WP-0.7 scope does not name the API client.
- **Status:** open

### OQ-145: `shell-fast` fails on the Windows checkout
- **Choice:** the new fast-tier step `shell-fast` (`cargo test`, `clippy -D warnings` and `fmt --check` for `frontend/apps/shell`) runs in the WSL clone. On the Windows checkout, which has no Rust toolchain, it fails with an explicit "Rust toolchain missing" message. It never skips silently. Windows runs are not evidence of record (KA-001, OQ-100).
- **Status:** open

### OQ-146: Changing the UI language on mobile needs an app restart
- **Choice:** the mobile app applies a language change after a restart, because switching React Native's layout direction needs a reload. The web app changes language in place.
- **Sources:** §11.1 (UI language per user), §14.6.
- **Status:** open

### OQ-147: The HAL audit log stays on the workstation until WP-0.4
- **Choice:** `hal-core` writes its audit records (a closed allowlist of fields, no PHI, no payload hash; `docs/specs/hal/README.md`) as JSON lines to a local file. Shipping them to the BALP audit store, and the canary scan over them, come with WP-0.4 (`TRU-AUD-01`).
- **Sources:** §13.5 ("every call is audited"), §12.8, §21 WP-0.4.
- **Status:** open

### OQ-148: One font family for the UI and for WP-0.8's prints
- **Choice:** slice S4 chooses one OFL family (Noto Sans Arabic with Noto Sans, or Vazirmatn), decided by the `font-coverage` and `glyph-render` tests. WP-0.8 uses the same family and reuses `packages/i18n/src/sorani-letters.json`, and keeps its own font-coverage test.
- **Sources:** §4.1 "Fonts" [P]; §21 WP-0.8.
- **Status:** open

### OQ-149: Who approves the patient-context state machine
- **Reading in use:**
  - Approval is requested from `cso`, `physician-panel` and `nurse-panel` (`docs/specs/state-machines/patient-context.yaml`; `approved_by` empty, `record: null`).
  - Every transition is marked proposed, because R11 draws no such machine; R11 §15 item 6 states only the rule.
  - The readings the machine encodes are DN-026, DN-027, DN-028 and DN-032.
- **Sources:** §8.4 names approvers for each of its machines, but none for patient context; OQ-083.
- **Who confirms:** the human lead and the CSO [HUMAN]. The approval itself is written only from a sign-off record (§3.5). The request can join WP-0.5's approval requests.
- **Status:** open

### OQ-150: The shapes and error vocabulary of HAL contract v1
- **Choice:** `docs/specs/hal/` (README, `hal-v1.schema.json`, 69 fixtures):
  - a closed result envelope `{ok, value | error, auditId}`;
  - six error kinds, each with fixed reasons, a `retryable` flag, an `outcomeUnknown` flag (true, with `retryable` false, for timeouts and device errors on print and payment calls) and a catalogue key, with no free text;
  - `reprintOf` for an explicit, audited reprint;
  - `blobRef` handles for scans, photos and signatures;
  - subscriptions for barcode reads, delivered only to the focused window;
  - subscriptions for badge taps, delivered to every window. The shell runs the Keycloak step-up over the workstation certificate and sends only the outcome and an opaque, single-use, short-lived `stepUpRef`; the badge credential never crosses the bridge, and WP-0.4 designs the redemption;
  - captures bound in `hal-client` to the window's patient and discarded after a context change;
  - with no shell, `no-shell` for every call (`not-implemented` comes from the shell);
  - an audit-record allowlist with no payload hash, and audit records for subscription events;
  - amounts as decimal strings;
  - a payment value with no card data, and "declined" as a result rather than an error;
  - `contractVersion` 1, changed only by addition.
- **Sources:** §12.8 names the calls, requires "a typed result and an audit ID" and routes the badge "reader → shell → Keycloak step-up bound to the workstation certificate"; R16 §9.6 and §14.2. Neither gives shapes.
- **Who confirms:** the human lead and the security owner (the badge routing).
- **Status:** open

### OQ-153: How the version rule was read for WP-0.7's frontend pins
- **Choice:** "the newest generally available release that has had at least one patch release" is read per release line (major.minor): take the newest line that already has an x.y.1 or later, and pin the newest patch release of that line; pre-releases, canaries and experimental builds never count. The peer ranges of the packages that depend on a component then cap it, as TypeScript stays at 6.0.3 under typescript-eslint's `<6.1.0`. Applied in WP-0.7 slice S1 (ADR-002, "Added by WP-0.7"), this reading held back:
  - `@types/react` to 19.2.18 and `@types/react-dom` to 19.2.7 (their 19.3 line has only 19.3.0), while React itself is 19.3.1;
  - the Fontsource packages to 5.2.10 (5.3.0 has no patch release);
  - `@axe-core/playwright` and axe-core to 4.12.1 (the 4.13 and 4.14 lines have no patch release);
  - Ajv to 8.17.1 (8.18.0 and 8.20.0 have no patch release; 8.19 was never published).
- **Sources:** §4.1 (the version rule). WP-0.1 pinned some `.0` releases (review finding O-3 in `docs/program/reviews/WP-0.1.md`), so its reading may differ; this entry records the reading WP-0.7 used.
- **Who confirms:** the human lead.
- **Status:** open

### OQ-154: jsdom stays on 29.x while the Windows checkout runs Node 24.13
- **Choice:** jsdom 29.1.1, not the newer 30.1.3. jsdom 30 declares `engines.node` `^22.22.2 || ^24.15.0 || >=26.0.0`. The workspace allows any Node 24 (`engines`: `>=24 <25`) and installs with `engineStrict`, and the Windows host has Node 24.13.0 (the WSL build host has 24.22.0, `DECISIONS-NEEDED.md`, "Host check"), so jsdom 30 cannot be installed on the Windows checkout. jsdom 29 supports every Node 24 release. jsdom is a build-only test environment for component tests; nothing ships from it.
- **Sources:** §4.1 ("supported by the components that depend on it"; Node 24 LTS).
- **Next:** at the next re-resolution, if the workspace's Node floor is raised to 24.15 or later (which needs the Windows host's Node upgraded [HUMAN], §3.4 item 9), jsdom moves to its newest line.
- **Status:** open

### OQ-155: Dependencies WP-0.7 added beyond its plan's list
- **Choice:** WP-0.7 slice S1 pinned, besides the packages its plan named:
  - Ajv 8.17.1 (build-only, in `@hms/hal-client`), so that the `hal-contract-fixtures` test validates every fixture against `docs/specs/hal/hal-v1.schema.json` itself (JSON Schema 2020-12) rather than against a second, hand-written copy of the schema;
  - `@testing-library/jest-dom` 7.0.1 (build-only), for DOM matchers in component tests;
  - `playwright-core` 1.64.1 as a direct development dependency of `@hms/web`: it is the peer dependency of `@axe-core/playwright`, and naming it pins it to the same version as `@playwright/test` instead of letting pnpm pick one;
  - the type packages `@types/react`, `@types/react-dom` and `@types/fontkit` (build-only);
  - `@hms/ui-core` as a dependency of `@hms/hal-client`, so that captures can be bound to the window's patient context (`docs/specs/hal/README.md`).
- **Sources:** §4.1 (test tooling [P]); the WP-0.7 implementation plan, section 3.
- **Status:** open

### OQ-156: The fonts come from the Fontsource npm packages
- **Choice:** Noto Sans Arabic and Noto Sans (OFL-1.1) are installed from the npm packages `@fontsource/noto-sans-arabic` and `@fontsource/noto-sans` 5.2.10, pinned in the lockfile like any other dependency, not downloaded from Google's font repository. Each package ships woff2 subsets with `unicode-range` declarations. Checked with fontkit on 19 October 2026 (Windows host): the `arabic` subset of Noto Sans Arabic (weights 400 and 700) has glyphs for all ten Sorani letters (ڕ ڵ ۆ ێ ە ڤ گ چ پ ژ) and for ی, ک, ه, ي and ك, but no Western digits; the digits are in the `latin` subsets of both families. So the `font-coverage` test must read the subsets the design system bundles together, not one file. Slice S4 still chooses the family by the `font-coverage` and `glyph-render` tests (OQ-148).
- **Sources:** §4.1 "Fonts" [P]; §3.7 (registry downloads only).
- **Status:** open

### OQ-157: The HAL's Tauri IPC binding, and replies the client cannot use
- **Choice:** in `frontend/packages/hal-client` (WP-0.7 slice S8):
  - the shell exposes three Tauri commands, and its capabilities allow no other: `hal_call` with `{contractVersion, call, request}` for the ten request and reply calls; `hal_subscribe` with `{contractVersion, call, request, onEvent}` for `hal.scan.onBarcode` and `hal.auth.onBadge`, where `onEvent` is a Tauri channel that carries that one window's events; and `hal_release_blob` with `{blobRef}`, which releases the bytes of a discarded capture. `hal_release_blob` is a session-resource release, not one of the twelve calls; it is best effort, and the shell still deletes every blob when the session ends. Slice S9 implements the shell side;
  - the client checks every reply, event and request with Zod schemas that repeat `docs/specs/hal/hal-v1.schema.json`, because Ajv is a build-only dependency (OQ-155). The `hal-contract-fixtures` test keeps the two in step: both must accept every fixture and every error the contract allows, and reject the same changes;
  - a request that does not match the contract is refused in the client and never sent: `invalid-request` / `invalid-request`, or for the two subscriptions (which have no such kind) `not-permitted` / `capability-not-granted`, and for `hal.capabilities` `unavailable` / `not-implemented`. The simulated shell refuses such a request the same way, and copies nothing of it into its audit record;
  - a reply the client cannot use (a rejected invoke, a reply that does not match the call's result schema, a reply with the reason `no-shell`, which only hal-client gives, or in WP-0.7 a success reply to `hal.pay.request`, KA-027) becomes `device-error` / `device-fault` with the call's flags, so after a print or a payment the screen reports an unknown outcome and nothing repeats the call. `hal.kiosk.lock` and `hal.capabilities` have no `device-error` kind, so for them it becomes `unavailable` / `not-implemented`. A success reply to `hal.id.read` becomes `unavailable` / `not-implemented` (not retryable: the call cannot succeed with this shell). Every error result the client makes itself carries a new UUIDv7 that names no audit record (KA-040), never the reply's own audit ID, because the shell's record of that reply may say `ok` or another kind and would not agree with the result;
  - the client waits at most 180 seconds (`DEFAULT_CALL_DEADLINE_MS`, configurable) for the shell's reply to an invoke. The shell's own time limit for every call, a signature included, must be shorter (slice S9), so the client's deadline only ends a call that the shell never answers; the call then returns `timeout` / `device-timeout` where its kinds allow it (outcome unknown for a print), otherwise the unusable-reply error, and a capture gives the window's modal guard back. A reply after the deadline is not used, and a blob it names is released; a subscription the shell opens after the deadline delivers no events;
  - events that do not match the contract or name another subscription are dropped; at most 64 events that arrive before the subscribe reply are held for it;
  - a capture is bound to the window's patient id, its context-change counter (ui-core's `lastChange.version`) and its change time; with a patient open and neither the counter nor the time known, the result is discarded.
- **Sources:** §12.8 ("a typed result and an audit ID"), §13.5 (no arbitrary native code reachable from the web layer; every call audited); `docs/specs/hal/README.md` ("calls never throw across the bridge", "the blob is released", "writtenBy … hal-client for its own no-shell refusal only"). The README names no IPC commands, no path for releasing a blob and no audit ID for a failure that only the client sees.
- **Who confirms:** the human lead; the security owner for the command allowlist.
- **Status:** open

### OQ-158: Input formats and machine details in ui-core
- **Choice:** in `frontend/packages/ui-core` (WP-0.7 slice S3), where the specification sets no value:
  - **Identifier formats.** A patient id or a governed content code is 1 to 128 ASCII letters, digits, `.`, `_`, `:` or `-`, starting with a letter or digit; an MRN is 1 to 64 ASCII letters, digits and inner hyphens, stored with its check digit, which is not validated (KA-033). Anything else is invalid, which puts the banner in its error state (patient id, MRN) or makes the code's field unavailable. WP-1.2 sets the real formats.
  - **Same-origin photo sources.** A root-relative path (`/…`, never `//`) or an inline `data:image/png`, `jpeg` or `webp` base64 URL. Any other source makes the photo unavailable, shown as "No photo".
  - **Name forms.** A form is trimmed, put in Unicode normalisation form C (so a decomposed accented letter is checked and shown as the letter it is canonically equal to), and is invalid when it is empty or holds a control, format (bidi control), other default-ignorable (combining grapheme joiner, variation selector, filler), surrogate, private-use or line or paragraph separator character, or U+FFFD. Every other character must be one the form's script shows visibly (Unicode Script_Extensions; the Kurdish and Arabic forms Arabic, the Latin form Latin): a letter of the script, so a look-alike letter of another script (a Cyrillic "е" in a Latin name) makes the form invalid; a non-spacing or spacing combining mark of the script directly after a letter or another mark, so an Arabic shadda on a Latin name, a Latin accent on a Kurdish name or a mark on a space is invalid, and an enclosing mark is never allowed; an ASCII digit or a decimal digit of the script; punctuation of the Common script or of the script; U+0020 SPACE, never two in a row (HTML collapses them, so two would look like one); and ZWNJ or ZWJ in the Kurdish and Arabic forms only, directly after a letter or mark. Any other character (U+00A0, U+3000 or another space, a symbol such as U+2800 BRAILLE PATTERN BLANK) makes the form invalid, so two names that look the same cannot differ by a hidden or blank character. At least one letter is required, and digits and punctuation are allowed for alias names. A name object with an unknown key makes every form invalid, and an unknown `ownScript` counts as identity incomplete. No length limit is set, so a long name is never refused. Governed labels are held to the same control, format and default-ignorable rules, but not to a script.
  - **Untrusted input.** Before any schema runs, the banner data is copied into plain data, as JSON would hold it: only own enumerable data properties, into objects with no prototype, at every depth. An object whose prototype is not `Object.prototype` or null (a class instance), a getter (never called), an array hole, a function, a symbol, a bigint, anything nested deeper than 16 levels (a cycle) and a proxy that throws read as unreadable, which no schema accepts, so that field shows its unavailable or invalid state. Optional keys of the parsed values are read as own properties only. A polluted `Object.prototype` therefore cannot supply a status, an allergy item, a label or a name form, and missing allergy data never yields NKA (CTRL-0016-4).
  - **Platform.** `src` assumes ECMAScript (ES2024) and its own imports (Zod) only: no DOM and no Node.js or Web API, so it runs unchanged in the browser and in React Native. `tsconfig.src.json` type-checks `src` with no ambient types and the package's `typecheck` script runs it after `tsconfig.json` (tests, Node types). The idempotency key of a sign command is therefore always injected (`PatientContextDeps.newIdempotencyKey`): the web app supplies Web Crypto's `randomUUID`, the mobile app its platform's source; ui-core has no default. The monotonic clock reads `globalThis.performance` when present and reads as unreadable (within the window) when it is missing.
  - **Governed labels.** A label missing in the user's locale falls back to the first available label in the order `en`, `ckb`, `ar`, then to the recorded code (language `zxx`), each marked "Not translated" (design-system §2.1 rule 6 names no order).
  - **Weight.** The field is `{status: none-recorded}` ("No dated weight") or `{status: recorded, value, unit: kg, measuredOn, source}`; a missing field is invalid ("Weight unavailable"), as the data model makes every missing field invalid.
  - **Patient-context events.** `ConfirmSwitch` names the requested patient the dialog showed and `Reverify` names the patient the step showed and the confirming user; a mismatch is refused. `SignRefused` carries the server's refusal code and has a transition only for `reverification-required`; any other refusal is sent as `SignRejected`. A sign or co-sign dialog keeps the idempotency key it was given when it opened for every submission, after a rejection too (design-system §2.3 names the key's creation and its reuse after an unknown outcome only). A co-signature is accepted as authenticated only with badge tap plus PIN (§12.8). If guards ever enabled transitions to different states at once, the event is refused (a test checks that no combination of predicate values allows it).
  - **Change times.** Re-verification counts against a change counter (`lastChange.version`), not a time, so a re-verification confirmed inside a dialog still counts for that signature when the change time is unknown; the sign command carries wall-clock times as epoch milliseconds, or null when the wall clock cannot be read.
- **Sources:** `docs/specs/modules/design-system.md` §2.1 "Data model", §2.3; `docs/specs/state-machines/patient-context.yaml`. None of them sets these values.
- **Who confirms:** the human lead; the CSO for the name-form and photo rules, which decide when the banner flags a name or shows "No photo".
- **Status:** open

### OQ-159: The localisation choices of slice S2
- **Choice:** in `frontend/packages/i18n` (WP-0.7 slice S2), where the specification sets no value:
  - **Review marking (DN-021).** The catalogue format has no room for metadata, so the status of each translated message lives in `src/messages/review/<locale>.json` for `ckb` and `ar`: a flat JSON object from every key of that locale's catalogue to its status. The localisation lint fails on a missing review file, a message with no status, a status for a key the catalogue lacks, a review file for any other locale, and any status other than `unreviewed`. A reviewed status, and what it records (who reviewed which text and when, and whether a later change to the text lapses it), is decided with the clinician review (OQ-151); until then no message can be marked reviewed without changing the lint. `reviewStatus(locale, key)` gives the status to screens and evidence.
  - **`#` in plurals.** The clinical-keys rule requires `#` in every branch of a `ckb` or `ar` plural under `banner.*` and `clinical.*` (design-system §9), and also under any other key whose English message keeps `#` in every branch of the same argument (today `sign.reverify.reason` and `commandPalette.resultCount`), as the §10 notes ask of translators. Equality with the English text is checked on the parsed messages, so the spacing of ICU syntax and the order of branches do not count; in literal text the check applies NFC and removes white space, format characters (general category Cf, which holds RLM, LRM, ALM, the bidi embeddings and isolates, ZWSP, ZWNJ, ZWJ, the BOM and the soft hyphen) and other default-ignorable code points. A message that does not parse is compared on its text, normalised the same way. A message that is only partly English is not caught.
  - **Pseudo-locales.** `en-XA`, expanded: ASCII letters accented, each message in `[` and `]`, and 40% padding in breakable groups of `~`; `ar-XB`, mirrored: each run of literal text wrapped in U+202E RIGHT-TO-LEFT OVERRIDE and U+202C POP DIRECTIONAL FORMATTING, with direction `rtl`. These are the tags Android and Chromium use. Both format with the `en` Intl tag, because their plural branches are the English ones.
  - **Letter pairs.** `sorani-letters.json` records, as `arabicFormInSorani`, that ي and ك never occur in Sorani text, while ه is itself a Sorani letter (it writes /h/), so ه and ە can never be swapped mechanically. WP-0.8's input normalisation should follow it.
  - **Intl tags.** `en` also gets `en-u-ca-gregory-nu-latn`, so every UI locale states its calendar and digits explicitly (OQ-141).
- **Sources:** DN-021; `docs/specs/modules/design-system.md` §2.9, §9 (`UnitTest:clinical-keys-lint`), §10 (notes for translators); §14.7, §18.9.
- **Who confirms:** the human lead; the format of a reviewed status together with the clinician review (OQ-151).
- **Status:** open

### OQ-160: The design-system foundation of slice S4
- **Choice:** slice S4 (`frontend/packages/design-system`) made these engineering choices where `docs/specs/modules/design-system.md` sets no value:
  - **Fonts (the family choice of OQ-148):** Noto Sans with Noto Sans Arabic, in the order `'Noto Sans', 'Noto Sans Arabic', sans-serif`, so Latin text and the Western digits come from Noto Sans in every locale and Arabic-script text from Noto Sans Arabic. `src/fonts.css` bundles only the woff2 of Noto Sans `latin` and `latin-ext` and Noto Sans Arabic `arabic`, at weights 400 and 700, with Fontsource's `unicode-range` and `font-display: swap`. `UnitTest:font-coverage` passes on the Windows host; `E2E:glyph-render` (slice S7) has not run, so the choice is not yet confirmed by both tests. The gap at U+202F is KA-038.
  - **Colour tokens:** the roles `--hms-color-bg*` (neutral surfaces), `--hms-color-text*` (neutral text), `--hms-color-<role>-bg`/`-text`/`-border` for `accent`, `info`, `success`, `warning` and `danger`, `--hms-color-border*`, and `--hms-color-focus` with `--hms-color-focus-inner`, written as `#rrggbb`. The status surfaces (`info`, `success`, `warning`, `danger`) are light, and neutral text and borders may sit on them; the `accent` surface is a filled action colour that carries only `--hms-color-accent-text`. `UnitTest:tokens-contrast` checks, beyond the specification's text pairs: neutral text on the status surfaces (4.5:1); borders on the neutral and status surfaces (3:1, WCAG 2.2 1.4.11); and that every stylesheet of the package puts only the accent text on the accent surface. It fails on a colour token that fits no role. No dark theme.
  - **Focus indicator:** two rings, a dark outline (`--hms-color-focus`) and a light inner ring (`--hms-color-focus-inner`, a `box-shadow` that fills the outline offset), because no single colour reaches 3:1 both on the light surfaces and on the filled accent surface. The test requires one of the two rings to reach 3:1 on every surface, the accent one included, and the rings 3:1 against each other (the two-colour technique of WCAG's C40). A component's own `box-shadow` is replaced while it has focus.
  - **Density:** comfortable spacing and type, with a minimum target size of 44 CSS px; compact with 24 CSS px, the §6.5 minimum. The choice is stored in `localStorage` under `hms.density.<userKey>`, where the application passes a staff identifier; without one it is kept in memory only.
  - **Modal stack guard:** one module-level guard per window. The package entry point exports only that guard; `createModalStackGuard` and a provider for another guard are in the test entry point `@hms/design-system/testing`, which throws in production builds; a `ModalStackProvider` nested in a provider of another guard throws. `Modal` fails at once without a `ModalStackProvider`. A hold is an opaque token that only the holder receives and only it can release; the snapshot shows the holder's kind and owner, and owners are compared by object identity, never by label. A HAL capture holds the guard with `acquire('hal-capture', owner)`, passing an owner object of its own. In production a refused modal calls `onOpenChange(false)` and `onRefused`, and a `role="status"` region marked `data-live-announcer` (so React Aria's `ariaHideOutside` leaves it exposed while a modal hides the page) announces `modal.blocked`, once per refusal, and shows it as a status line above the modal layer until the holder releases the guard. Raw `react-aria-components` dialogs outside the design system can still bypass the guard (KA-042).
  - **Messages in JSX:** the design system renders its catalogue text through a `Message` component, which shows a key missing at run time as the key, isolated left to right, in a visible error style (danger colours, dashed border); string-only paths stay plain (KA-039).
  - **Locale:** `<html lang>` gets the plain tag (`en`, `ckb`, `ar`), while react-intl and React Aria's `I18nProvider` get the `ui-intl` tag (`ckb-u-ca-gregory-nu-latn` and the like). `LocaleProvider` takes an optional `messages` override for the in-memory pseudo-locales of development and test builds.
- **Sources:** §4.1 "Fonts" [P]; §6.5 (design tokens, density modes, contrast, targets, no stacked modals); `docs/specs/modules/design-system.md` §2.5, §2.7 to §2.9, §3.
- **Who confirms:** the human lead.
- **Number:** first written as a second OQ-157 while slice S8 wrote its own; renumbered OQ-160 at the integrator's checkpoint after slices S2, S3, S4 and S8, because S8's code cites OQ-157. OQ-160 is the first number of WP-0.7's extended range OQ-160…OQ-169 [P] (`STATUS.md`), as OQ-140…OQ-159 is full.
- **Status:** open

### OQ-161: The patient banner of slice S5a
- **Choice:** slice S5a (`frontend/packages/design-system/src/banner`) made these engineering choices where `docs/specs/modules/design-system.md` §2.1 sets no value, or sets the rule but not the means of meeting it:
  - **Status icons are decorative.** Each status (`BANNER_STATUSES` in `banner-status.tsx`) shows an inline SVG icon of its own shape beside its own text. The icon is `aria-hidden`, and the visible text is what assistive technology reads, once; the icon has no accessible name of its own, because the catalogue has no icon names and a second name would read every status twice. This is the reading applied to §9's "a distinct icon with an accessible name" for `UnitTest:colour-not-only-carrier`: the status is named by its text, and the icon is distinct by shape. The shapes: a dashed circle (missing), a triangle with "!" (unavailable), an octagon with a cross (the error state), an identity card with "!" (identity incomplete), a square with a tilde (approximate date of birth), an empty-set sign (NKA), a square with "?" (allergies not assessed), a diamond with "!" (allergies recorded), a circle with a bar (recorded as none), a document (code status documented), a shield (isolation active) and a globe (not translated). None carries a direction, so none is mirrored. Within one field no two statuses share a shape or a text, and no two share an outline (round, square, wide card, a polygon by its number of corners, or curved), so "No known allergies" (a circle) and "Allergies not assessed" (a square) differ by silhouette and not only by a small inner mark. `UnitTest:colour-not-only-carrier` reads each outline from the drawing itself; how the icons look at their real size is left to the `E2E:visual` baselines (slice S7).
  - **Tones.** Each status has one tone, which takes its colours from one role pair of `tokens.css`: danger for the error state, an unreadable MRN, recorded allergies and active isolation; warning for every missing or unavailable state, "Allergies not assessed", "Code status not documented", "No dated weight", the approximate-DOB flag and "Identity incomplete"; info for NKA, a documented code status and "Not translated"; neutral for "No isolation recorded". Every allergy item sits on the danger surface.
  - **The error state keeps the fields.** In its error state the banner shows "Patient banner data unavailable" first and still renders every field with its own content or state (rule 4: "the other fields still render"); a missing or invalid MRN also shows that text in the MRN's place. The banner's `<section>` carries `data-error-state`, `data-signing-blocked` and `data-identity-incomplete` from the model; the `_clinical` layout (slice S6) disables the clinical actions from the same model.
  - **Photo.** An absent or invalid photo, and a photo whose image fails to load, show "No photo" in a dashed frame at least as wide as the image (4 rem) where there is room; the frame may shrink to the space there is and is never wider than it, so a long translation wraps inside it (`flex: 0 1 auto`, `max-inline-size: 100%`, `min-inline-size: min(4rem, 100%)`). The image itself is a fixed 4 × 5 rem and never shrinks.
  - **Weight.** §2.1 sets the rule: the weight is shown through `ClinicalNumber` with its unit, and the banner does so. The choice is how the banner gets `ClinicalNumber`'s input. ui-core's banner model keeps only the display form (`BannerModel.weight.quantity`: `number`, `unit`, `text`), not the decimal string as received, so the banner passes the display number with its U+202F group separators (DN-031) removed, and the display unit with a one-entry map `kg` → `kg`. A display form already has a leading zero, no trailing zero and no redundant leading zero, so `ClinicalNumber` shows exactly the model's text again; this is character work only, with no numeric conversion and no arithmetic (SI-05). `UnitTest:banner-renders-every-field` checks, in every locale and for values below and above 1000, that the banner's weight element is identical to the one `ClinicalNumber` renders for the recorded value and that its text is the model's. If ui-core later changes its display form, `ClinicalNumber` shows "Invalid value" rather than a wrong weight. The simpler way, for ui-core's `WeightField` (slice S3's file) to keep the received decimal string, so that the banner passes it unchanged, is open to the lead. S5a's first version copied `ClinicalNumber`'s markup by hand instead; an independent review found that this departed from §2.1, and it was replaced.
  - **Governed labels.** The label locale is read from react-intl's locale tag (`ckb-u-ca-gregory-nu-latn` → `ckb`); any other language reads as `en`. A label is isolated with its own `lang` and the direction of its locale (left to right for a code, `zxx`). An allergy item shows its substance, reaction and severity as three separately isolated labels, with spacing and no punctuation between them, so no separator has to be translated.
  - **Name forms.** Every form is shown with its label, in the model's order (the own-script form first), and the first form is set larger and bold.
  - **Wrapping.** `banner.css` sets `overflow-wrap: anywhere` on the banner, every value and every status, so text wraps at word boundaries and a single word wider than its place breaks inside the word; no rule sets an ellipsis, a line clamp, a fixed or maximum height, hidden overflow or `nowrap` on text.
  - **Reuse.** `PatientIdentity` (the error state, photo, every name form, MRN, date of birth and "Identity incomplete") is exported for the switch confirmation, the re-verification step, the palette's patient results and the patient chooser, so §2.1 rule 3 holds there with the same markup and styles. The banner takes an optional `actions` slot for the layout's close and change controls.
- **Sources:** `docs/specs/modules/design-system.md` §2.1 (fields, rules 1 to 6), §2.6, §3, §9; §6.5; §14.7; §18.9.
- **Who confirms:** the human lead; the CSO for the tones and the error-state layout, which decide how a clinician reads an incomplete identity.
- **Status:** open

### OQ-162: Sign and co-sign, the command palette and the density setting of slice S5b
- **Choice:** slice S5b (`frontend/packages/design-system/src/{sign,command-palette,density}`) made these engineering choices where `docs/specs/modules/design-system.md` §2.3 to §2.5 sets no value:
  - **The dialog is a view of the machine.** `SignDialog` takes the window's patient-context snapshot and a `send` that applies ui-core's `transition`. It is open exactly while the window holds a sign session in `re-verification-required`, `signing` or `submitting`, and it sends only the machine's events (`Reverify`, `RejectPatient`, `SubmitSign`, `CancelSign` and the outcome events), so every safety rule stays the machine's. Escape sends `CancelSign`, which the machine refuses while submitting, so the dialog stays open then. The application (slice S6) owns the store. `SignButton` sends `OpenSign`; while the banner identity does not allow signing it is disabled, with `sign.blockedByBanner` beside it.
  - **Who confirms the patient.** On open, `Reverify` names the window's session user as the confirming user. When the dialog comes back to re-verification after the signer authenticated (`sign.reverify.signerDiffers`, for example a co-signer authenticating at another user's workstation after that user confirmed the patient, or the server's `sign.refused.reverify`), it drops that authentication: "This is the right patient" stays disabled until the person signing authenticates again in the re-verification step (badge tap plus PIN for a co-signature), the confirmation is recorded for the user that authentication returns, and the signature uses that same authentication. So a confirmation is never credited to a signer from an earlier authentication while someone else is at the keyboard. The dialog cannot tell who physically presses the control; this attribution is part of what re-verification consists of, which is the CSO's decision (DN-027, where it is listed in the default in use).
  - **Steps and focus.** The review step is always shown. The re-verification step takes the place of the authentication step while it is required. The intent statement with Sign or Co-sign is always last, and Sign is disabled until the machine is in `signing` and the signer has authenticated. On open, React Aria focuses the dialog itself, never a control. Moving between re-verification and authentication puts focus on the new step's heading. A control that has just been pressed and is then disabled never keeps focus: after a successful sign-in focus goes to the intent and sign section (in the re-verification step, to its heading), and after Sign or Co-sign to that section, which is focusable (`tabIndex=-1`) and named by the intent statement; never to Sign itself. "This is the right patient" is disabled while the snapshot holds no valid banner identity (the rule of `signingIdentityValid`), so only "Not this patient" and Cancel remain. `sign.reverify.reason` ("changed in the last 60 seconds") is shown only when that is why the step is open: not for a disputed identity and not on a return after authentication, where the notice says why (KA-043). The seconds it shows come from the `contextDeps` the dialog is given, which must be the window's own `PatientContextDeps` object, so the dialog and the machine's guard read one window value. After "Not this patient" focus goes to the element the application passes as `rejectedFocusTarget` (the banner's close and change controls), and is set again on the next animation frame, so React Aria's focus restoration cannot return it to the Sign action; without that element it goes to the dialog's status message.
  - **Authentication in WP-0.7 (KA-032).** `createSimulatedAuthenticator(userId)` vouches for one user. A signature is `single`; a co-signature is `badge-and-pin` once a PIN of 4 to 8 ASCII digits is typed, and is refused otherwise. Nothing checks the PIN; it is cleared from the field when used and never stored or logged. Creating the simulated authenticator throws in a production build unless `VITE_HMS_DEMO=1`. The catalogue has no text of its own for this step (KA-043).
  - **Outcomes.** The submitter answers `accepted`, `refused` (with the server's reason), `rejected` or `unknown`. No answer within 30 s (`submitTimeoutMs`), a rejected promise, an exception, or an answer of any other shape is `unknown`, never `rejected`. A refusal with any reason other than `reverification-required` is sent as `SignRejected`. A late answer to an earlier attempt is ignored. When the dialog closes while a command is in flight (a change of user, DN-028), the window shows `sign.outcomeUnknown`, because the signature may have been saved.
  - **Messages.** `sign.done`, `sign.reverify.rejected`, `sign.contextChanged`, `sign.blockedByBanner` and that `sign.outcomeUnknown` are shown, after the dialog has closed, in a `role="status"` region next to it, marked `data-live-announcer` like the modal stack's, until the next sign session opens. Messages while the dialog stays open are in a `role="alert"` region inside it.
  - **Palette.** Built on React Aria's `Autocomplete`, `TextField` (not `SearchField`, so Escape always closes rather than first clearing the text) and `Menu`, with one section per group (navigation, patients, settings). React Aria's "focus the first item while typing" is off (`disableAutoFocusFirst`), and the result list is remounted whenever the set of results changes, which drops any highlight and clears the field's active descendant; so a highlight never carries over to another list, even one that still holds the highlighted item. A chosen item runs only when the palette's content has unmounted, after the palette has released the modal slot. Ctrl+K and Cmd+K are read from the physical key (`KeyboardEvent.code` `KeyK`), so they work on Sorani and Arabic layouts; they are ignored, with nothing announced, while another dialog holds the window's modal slot. Search matches every word of the query as a substring, ignoring case, after NFC and after folding ي→ی, ك→ک and ه→ە on both sides; the folding is for matching only, never for display, and can only widen a search. The result count is a `role="status"` line (`commandPalette.resultCount`).
  - **Commands.** A command names catalogue keys; a patient result is a banner model shown with the banner's `PatientIdentity` (OQ-161). `languageCommands` gives one "Change language" command per other UI locale, with that language's own name as its detail. `useDensityCommand` gives "Change density", which switches to the other of the two modes and shows its name.
  - **Density control.** A React Aria `RadioGroup` of `RadioField` and `RadioButton` (`Radio` is deprecated in React Aria Components 1.22), labelled `density.label` and bound to `DensityProvider`.
  - **Stylesheets.** `sign/sign.css`, `command-palette/command-palette.css` and `density/density-control.css`, imported by `styles.css`: logical properties and tokens only, targets at least `--hms-target-min-size`, and the highlighted palette item and the chosen density shown by a border or weight change as well as by colour.
  - **Test time limits.** The sign and palette test files (those importing `test/sign/harness.tsx`) allow 20 s a test and 5 s a `waitFor`, set in that harness, instead of the package's 5 s and 1 s: their multi-step keyboard flows take 1 to 3 s each in jsdom on an idle Windows host and timed out on a busy one. The submit-timeout test runs the real 30 s default on fake `setTimeout` and `clearTimeout`, so it does not depend on host speed. `vitest.shared.ts` is unchanged.
- **Sources:** `docs/specs/modules/design-system.md` §2.2 to §2.5, §2.8, §9, §10; §6.2; §6.5; §9.4; §12.8; §14.2.
- **Who confirms:** the human lead; the CSO for the attribution of the re-verification (DN-027) and for treating every unclear sign outcome as unknown.
- **Status:** open

### OQ-163: The web frame and the demo route of slice S6
- **Choice:** slice S6 (`frontend/apps/web/{index.html, vite.config.ts, src/**}`) made these engineering choices where `docs/specs/modules/design-system.md` §2.2, §4 and §5 set no value:
  - **Routes.** Code-based TanStack Router routes, built afresh by `createAppRouteTree(demo)`: the root (the frame), `/` (the start page) and the pathless `_clinical` layout, with the demo's `/demo/banner` under it. `staticData.clinical` is made required by augmenting `StaticDataRouteOption`, which makes TanStack's `staticData` option itself required; an optional `staticData.titleKey` names the page title. The `_clinical` layout is registered only when it has routes, so a production build has none until a clinical work package adds one (KA-044). An address that matches no route goes to `/`, keeping `locale` and `density` and replacing the history entry.
  - **The demo only in demo builds** (OQ-142). The app imports its demo module from `src/demo/selected.ts`, which is `null`; a Vite `resolveId` plugin resolves that file to `src/demo/index.ts` only when `VITE_HMS_DEMO` is exactly `1`. A mistake in the switch can only leave the demo out. A production bundle was checked by searching it for the fixtures' patient ids, the demo path, the demo user and the synthetic photo: none was found, and a demo bundle has all four.
  - **Address parameters.** Every value is read as a plain string (custom `parseSearch` and `stringifySearch`), because the router's default JSON reading would turn `?patient=1e3` into the number 1000. `locale` and `density` apply on every route; `patient` (a patient id, as ui-core accepts it) is the request of every clinical route. `?fixture=<id>` on `/demo/banner` is turned into `?patient=<that fixture's patient id>`, replacing the history entry. An unknown or malformed value is ignored (Zod with `catch`).
  - **The address and the patient context** (`usePatientUrlSync`). When the context changes, the address follows it (replace), and the old address is never taken as a new request. An address naming another patient is passed to the machine once, through `requestPatient`. A refused request, or a cancelled confirmation, puts the address back to the current patient (replace). A clinical address without a patient gets the context's patient added. While the address and the context disagree, the `_clinical` layout renders nothing patient-specific, the banner included: this is the stricter reading of §2.2 "renders nothing patient-specific", and the switch confirmation shows both patients meanwhile. Patients chosen in a chooser or in the palette are requested through the address (push), so the browser history and deep links take the same path.
  - **The query cache.** Patient data has keys `['patient', <patientId>, ...]`. `requestPatient` loads the banner through `queryClient.query` before it sends `SelectPatient`. After every transition the store keeps only the queries of the context's patient and of a patient whose switch waits; a refused request leaves nothing. Queries never pause for the browser's online state (`networkMode: 'always'`), never retry and never refetch on focus or reconnect; the data is in memory in WP-0.7.
  - **The window's store.** One `PatientContextStore` per window applies ui-core's `transition` and adds no rule of its own. The machine's modal state is the window's modal stack guard: `isModalOpen` while a `modal` holds it, `isHalCaptureWaiting` while a `hal-capture` holds it. The idempotency key of a sign step is a random version 4 UUID from `crypto.getRandomValues`, which, unlike `crypto.randomUUID`, also exists on a page served without TLS (OQ-158). The frame shows the machine's `patientContext.*` messages in a `role="status"` region; the sign dialog shows its own.
  - **Session user.** Demo builds use the synthetic user `user-synthetic-demo`. Production builds have none, so they request no patient (fail closed; KA-044). The density is stored per session user. When the window gains focus, a context opened under another user than the session's is cleared with `UserChanged` (DN-028).
  - **The switch confirmation** (`src/patient/switch-confirmation.tsx`; no earlier slice owned it). A design-system `Modal` with `role="alertdialog"`, open exactly in `switch-pending-confirmation`. The current and the requested patient are shown side by side with `PatientIdentity`, and "Keep current patient" comes first. "Switch to requested patient" is described by the requested patient's panel and is not focused on open (React Aria focuses the dialog itself). It is disabled, with `patientContext.switch.requestedInvalid`, when ui-core's `enabledTransitions` finds no `ConfirmSwitch` transition, so the dialog asks the machine rather than repeating its guard. Escape cancels.
  - **The patient chooser.** A React Aria `GridList` of `PatientIdentity` entries; nothing is selected, and Enter or a press requests the patient. Outside the demo page its accessible name reuses `commandPalette.group.patients` ("Patients"), because the catalogue has no key of its own for it (KA-044).
  - **The frame.** A skip link that focuses `<main>` without changing the address. A header with the main navigation (React Aria links, through React Aria's router provider), the command palette (navigation, the demo's patients in demo builds, density and language), the language choice (a React Aria radio group with each language's own name, styled with the density control's classes) and the density setting. The document title is the deepest matched route's `titleKey`, or `app.name`. The demo watermark is a fixed, opaque band at the end edge of the viewport, never interactive, reading `NOT FOR CLINICAL USE` from the English catalogue with the locale's `demo.watermark` beside it in `ckb` and `ar`; the page and open dialogs leave room for it.
  - **Built pages.** A Content-Security-Policy meta element: `default-src 'none'`; scripts, styles, images, fonts and connections from the page's own origin; `data:` for images and fonts; and the two style elements React Aria adds, allowed by SHA-256 hash, because a static page cannot carry a nonce. Also `referrer: no-referrer`, an empty `data:` icon (so the browser requests no favicon), and Zod's `jitless` mode, so Zod never probes `new Function`, which the policy forbids. The development server has no policy, because React refresh needs an inline script. `vite dev` and `vite preview` listen on 127.0.0.1 only.
  - **Tests beyond the §9 table.** Besides `route-tree.test.ts` (`ArchTest:banner-present-on-every-clinical-route`): `demo-fixtures.test.ts`, `patient-query-cache.test.ts` and `patient-address-is-a-request.test.tsx`. The whole-app test files and the S1 smoke test allow 20 s a test and 5 s a `waitFor` (set in `test/harness.tsx` and in the smoke test), as in OQ-162, because whole-app renders take 1 to 4 s each in jsdom on a busy Windows host. `vitest.shared.ts` is unchanged.
- **Sources:** `docs/specs/modules/design-system.md` §2.1 rules 3 and 4, §2.2, §2.4, §2.5, §2.9, §4, §5, §8, §9; §3.3; §6.2; §6.5; §14.2; §18.10.
- **Who confirms:** the human lead; the CSO for hiding the banner while the address names another patient (a reading of §2.2 under SI-16, the stricter one).
- **Status:** open
