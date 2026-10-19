
---

## 18. Verification and validation

Read: R15 §6–§10; R03 §19, §21; BP §5; K §5, §13.3–§13.5. Over-alerting fails the build exactly as a missed alert does (R15 §11 #10).

### 18.1 Traceability

- **Chain:** user need → requirement (feature ID) → hazard(s) → risk control(s) → verification test(s) → validation evidence → release.
- Tests carry requirement and hazard IDs in their names or tags; CI publishes results keyed by those IDs; `docs/safety/traceability.csv` is **generated, never hand-maintained**.
- Every SI has a hazard entry, state-machine property tests and a nightly scenario suite. Every SAC (§18.4) has a hazard ID and an acceptance test.
- Clinical timestamps are first-class events, never inferred from notes.

### 18.2 Test portfolio

| Layer | Scope and tools | Gate | Evidence |
|---|---|---|---|
| Unit and property | State machines (orders, MAR doses, encounters, specimens, beds, claims) and invariants with Kotest property tests; generators produce random, out-of-order and duplicate events; R11 §15 is the property list | Every commit (short runs); nightly 10⁶ sequences | Invariant coverage report |
| Module and contract | Spring Modulith module tests; consumer-driven REST and event contracts; an HL7 v2 conformance profile per interface (structure, cardinality, vocabulary) | Every merge | Conformance report per interface |
| FHIR | HL7 validator against pinned profiles; R4 projections, IPS `$summary`, the KRG return bundle | Every merge | Validation report per artefact |
| Integration | Testcontainers with real PostgreSQL, Kafka, Keycloak and OpenFGA; analyser, modality, card-terminal and printer simulators | Every merge | Test report |
| End to end | Playwright clinical journeys in `en`, `ckb`, `ar`; Maestro mobile flows including offline BCMA | Merge (smoke); nightly (full) | Videos and traces on failure |
| Clinical scenarios | §18.5 | Nightly and pre-release | Pass matrix linked to hazards |
| Performance | §18.6 | Nightly; any p95 regression blocks release | Load report against SLOs |
| Resilience | §18.7 | Nightly chaos; monthly game days; quarterly restore | Measured RTO/RPO |
| Security | SAST, SCA, secrets, container and IaC scans; DAST on staging; SBOM diff; annual penetration test and a pre-release test for Tier 2 changes | Per merge / release / annual | Scan reports; pen-test summary |
| Usability | Formative tests every sprint with a clinician panel [HUMAN]; summative per §18.8 | Before a feature's first release and after significant UI change | IEC 62366 report |
| Localisation, RTL, accessibility | §18.9 | Every merge and release | Pseudo-locale, RTL diffs, axe and WCAG audit |
| Topology and egress | The same signed artefacts on the three-node cell (dev cell in CI, reference cell before release) and the central substrate; no usable PHI leaves the cell | Every release | Conformance and egress reports |
| Tier 2 | 100% boundary-value tests; mutation testing (PIT); render-integrity tests; fail-safe tests on timeout | Every merge touching Tier 2 | Tier 2 verification report |
| Migration and UAT | §18.12; UAT kits per customer | Per customer | Reconciliation pack; signed UAT [HUMAN] |

### 18.3 Property-based invariant testing (criterion C2)

For every SI, write a property that drives random command sequences through **every channel adapter** (UI command layer, API, mobile sync, HL7 inbound, migration loader, plugin effects) and asserts the invariant after every step. Include offline-BCMA conflict replays, out-of-order and duplicate events, clock skew, and back-entry. The nightly run executes 10⁶ sequences at the application-command layer with in-memory adapters, plus at least 10⁴ sequences through each real channel adapter, with **zero violations** as a hard gate; the evidence records the actual counts; a violation is a Sev-1 safety defect with a hazard-log entry.

### 18.4 Patient-safety acceptance criteria (SAC-01 to SAC-53, from R03 §19 and BP §5.1)

Each criterion gets a traceability ID, a hazard link and at least one automated test. Where an SI applies, it is enforced server-side on every channel.

| SAC | Criterion | SI / phase |
|---|---|---|
| 01 | Every label, wristband, MAR entry, print and verification step shows ≥2 identifiers, never room or bed; name in the patient's script plus Latin; MRN plus DOB or the approximate-DOB flag | SI-01 |
| 02 | A photo is captured and shown on the banner, MAR and order entry | SI-16 |
| 03 | MRNs carry a check digit; invalid MRNs are rejected at entry and scan | — |
| 04 | Barcoded wristbands and labels carry ≥2 identifiers and print at registration, with Kurdish/Arabic shaping or raster fallback | SI-01 |
| 05 | Similar-name warnings at registration and search, distinct across scripts; retract-and-reorder monitored | SI-16 |
| 06 | Unknown, trauma, MCI and downtime patients get unique temporary IDs (alias pools, pre-allocated blocks) that merge into permanent IDs | SI-15 |
| 07 | Newborns get distinct names ("Baby of [mother]") that pass truncation tests in all three scripts | — |
| 08 | Merge and unmerge are reversible and propagate downstream; duplicate-rate dashboard; overlays are incidents | SI-08 |
| 09 | Specimens labelled at the bedside in the patient's presence, with WBIT detection | — |
| 10 | Orders structured by default; free text monitored and alerted when a structured equivalent exists | — |
| 11 | Ordering shows dated, sourced weight, height, coded allergies and pregnancy status; "NKA" ≠ "not assessed"; no weight-based medicine signed without a weight; metric only; no unit-less dose fields | SI-05, SI-16 |
| 12 | Dose-range checks show their working before submission (in full from Dose Engine activation in P2; control set A until then) | SI-05 |
| 13 | Paediatric dose rounding happens only inside `reg-dose` (P2). Until then the system shows corrected age, never rounds or recalculates a dose, and rounding is the pharmacist's documented decision under control set A | SI-05 |
| 14 | The CPOE error-category harness (eight Leapfrog-style categories) passes with the licensed KB and CSO-approved scenarios [HUMAN]; hard stops only from the governed list | SI-14 |
| 15 | The excessive-alert suppression list is versioned content exercised by the Excessive Alerts category | SI-14 |
| 16 | Firing, override and acceptance rates and override reasons recorded per rule; in-workflow feedback | SI-14 |
| 17 | AI and predictive tools show source attributes, local validation, drift monitoring and governance (P2; partners only, silent first) | SI-07 |
| 18 | Verbal orders capture read-back and track co-signature; antineoplastic verbal orders rejected except hold/stop | — |
| 19 | Tests, referrals and transitions tracked to completion; unowned work raises `TaskOrphaned` within 5 min | SI-03 |
| 20 | BCMA live site-wide (inpatient, ICU, labour and delivery, pre-op, PACU), patient and medication scans ≥95% per unit (R2b) | SI-02 |
| 21 | Override reasons never defaulted; scan-failure analytics; every override reportable | SI-02 |
| 22 | A high-alert dose cannot be documented without a recorded independent double check | SI-13 |
| 23 | Pump autoprogramming and auto-documentation: **P2** (one vendor, orders never commands, only after BCMA ≥95%); manual programming with BCMA scan until then | — |
| 24 | No first dose without pharmacist verification except defined emergency overrides; review within 4 h; alarm if the queue is unstaffed >30 min | SI-02, SI-05 |
| 25 | Formulary holds standard concentrations, premixed anticoagulants, reversal and perioperative protocols (content [HUMAN]) | — |
| 26 | Med rec at admission, transfer and discharge with a decision per item; cannot complete with undecided items; written discharge list | SI-09 |
| 27 | Opioid high-risk monitoring and pain-reassessment tasks | — |
| 28 | Stewardship reporting (DOT/DDD) and the stewardship control set until P2 | — |
| 29 | Critical-result definitions and timeliness targets configured; read-back logged; named recipient with a timed escalation chain, including external referrers | SI-04 |
| 30 | Every result has a responsible clinician; amended results notify and flag; pending-at-discharge results go to owned queues | SI-03, SI-17 |
| 31 | Surrogate inbox coverage; unacknowledged abnormal results >7 days monitored; labelled results and pregnancy tests never released by message | SI-17, SI-21 |
| 32 | Structured I-PASS handoff with audit and a per-shift coverage KPI | — |
| 33 | Reliable secure messaging for high-risk information; no PHI in notifications | SI-20 |
| 34 | NEWS2/PEWS/MEOWS calculated with visible components, escalation tasks and response-time tracking, passing boundary tests; only where the Register allows | SI-18 |
| 35 | Observation frequency driven by the score **only if the Register entry covers it**; until then the nurse sets frequency | SI-18 |
| 36 | Alarm configuration authority: **out of scope** (the HMS is never in the primary alarm path) | — |
| 37 | A code sheet documents resuscitations and feeds review (R2b) | — |
| 38 | Pre-procedure checklist, site marking, role-based time-out and all three WHO checklist phases captured | — |
| 39 | Perioperative syringe labels print | — |
| 40 | Implant UDI capture on the intra-op record | — |
| 41 | Bedside transfusion: wristband ↔ unit ↔ order ↔ sample match plus two-person e-witness; mismatch is a hard stop; relabel controls; scripted fallback until T2 | SI-11 |
| 42 | Human-milk barcode matching in NICU: **P2** | — |
| 43 | Validated suicide screening with documented risk and plan | — |
| 44 | Restraint and seclusion orders with expiry, no PRN, face-to-face task, monitoring; time limits as configurable rule packs with source and review date [HUMAN] | — |
| 45 | Signed notes immutable; amendments are versions; entered-in-error replaces delete; signed rendering hashed | SI-06 |
| 46 | Copy-forward text attributed and highlighted | — |
| 47 | Read-only continuity snapshots, downtime registration, labelled back-entry keeping clinical time distinct; Code-Dark drills supported | SI-10, SI-15 |
| 48 | Data and configuration backups restore-tested quarterly per hospital | — |
| 49 | Updates tested in an integrated context with clinical scenarios; impactful changes notified (release notes, known anomalies, flag defaults) | — |
| 50 | ISMP display rules (no trailing zeros, no naked decimals) and tall-man lettering | SI-05 |
| 51 | The banner distinguishes "NKA" from "not assessed" | SI-16 |
| 52 | RIS MRI-safety screening with incident capture | — |
| 53 | Device auto-dissociation on discharge or transfer | — |

### 18.5 Clinical scenario suites (nightly release gates)

1. **CPOE error-category harness** (Leapfrog-style and unofficial: the Leapfrog CPOE Evaluation Tool is Leapfrog's own test, which hospitals take; never report a "Leapfrog result"). It covers all eight categories, including Excessive Alerts, and runs after every KB or CDS change. Threshold: ≥60% of serious-error scenarios caught **and** zero interruptive alerts on the "should not alert" set [E]. The threshold applies only with the licensed KB and CSO-approved scenarios [HUMAN]; with the mock KB the harness checks plumbing and alert-budget accounting only, and each such run is recorded as "mock-KB run, not clinical evidence". Budgets: Tier A ≤20 rules; Tier B ≤8 interruptive alerts per 100 medication orders at go-live and ≤5 by month 12.
2. **ISMP:** weekly methotrexate; minibag vincristine; opioid tolerance; metric-only weights; 10× decimal errors; look-alike/sound-alike drugs; concentration standardisation; insulin and heparin protocols; seeded 10× and unit errors in every integrated cycle.
3. **Closed-loop medication:** prescribe → verify → dispense → BCMA, with failures injected: wrong patient, wrong drug, expired product, dose out of range, discontinued in transit, offline administration on a stale order, PRN double dose at shift change, cutover "last given" carry-over; plus the SI-12 extensions (no payment rule delays a time-critical dose; unverified patient-supplied medicine cannot be scanned).
4. **Transfusion:** consent → bedside-labelled sample → request → issue → two-person check → vitals → reaction → haemovigilance, with a mismatch injected at each step; relabel at receipt with blind double entry; relabel errors must be 0.
5. **Results closure:** critical value → named recipient → escalation; a discharged patient's result; an amended result; external referrers.
6. **Identity:** newborn naming; trauma alias; merge/unmerge with downstream notification; similar-name alerts; cross-script duplicates.
7. **Downtime:** read-only continuity; pre-allocated IDs; back-entry with original times; cell loss, WAN cut, power cut.
8. **Deterioration:** NEWS2 boundaries (0 / 1–4 / a single parameter scoring 3 / 5–6 / ≥7), SpO₂ Scale 2, escalation timers; PEWS and MEOWS only where the Register allows.
9. **Revenue and SI-12:** charges from events only; package coverage and leakage; deposit and payment rules never blocking discharge, emergency care or time-critical doses; dual-currency shift close.
10. **Seam (W1-K):** referral acknowledgement within 24 h; no overlays; polyclinic LIS limited to its own patients; medication list as reconciliation input only.

### 18.6 Performance: spike criteria, the 1,000-bed day and the 300-bed day

- **The 1,000-bed day** [E]: ≈1,000 inpatients, 3,000 OPD visits, 300 ED arrivals, ≈20,000 orders, 25,000 administrations, 15,000 results, vitals every 4 h, ≈300,000 HL7/FHIR messages, two years of history preloaded, and a 07:00–09:00 peak at 3× average concurrency. Runs on the central pooled-tier profile.
- **The 300-bed day** on the three-node reference cell (3 × 32 cores, 128 GB, NVMe) with **every component running** [HUMAN: hardware]. Dev-cell runs of the same workload are indicative and never count as C9 evidence. Scale the 1,000-bed workload to 300 beds and 800 sessions; record the scaled volumes in the spike report. Pass (C9): p95 targets met with CPU and memory utilisation ≤60% (record the interpretation in the ADR, since K's wording is ambiguous). Re-run at customer sizing on the installed cell at RG2.
- **ADR-001 spike criteria** (decision rule in §4.2):

| # | Criterion | Weight | Pass |
|---|---|---|---|
| C1 | Atomic order-sign: order + CDS override + verification task + MAR schedule + charge event | 15 | p95 ≤300 ms at 3× peak |
| C2 | Invariants under 10⁶ randomised command sequences, including offline-BCMA conflict replays | 25 | Zero violations (hard gate) |
| C3 | Bitemporal "what did the clinician see at 09:12" on a 30-day chart | 10 | p95 ≤1.5 s |
| C4 | FHIR R4 read/search over the projection | 5 | p95 ≤300 ms; lag p99 ≤5 s |
| C5 | R4 → R6 from unchanged storage | 10 | ≤15 engineer-days; no storage migration |
| C6 | IPS `$summary` and a KRG return bundle from the same facts | 5 | 100% validator conformance |
| C7 | Point-in-time restore of a 5-year, 150-bed tenant on on-site hardware | 10 | ≤4 h |
| C8 | Add a clinical fact type end to end | 15 | ≤3 days |
| C9 | The 300-bed day on the three-node cell | 5 | As above |

- Cell SLOs (release blockers): BFF p95/p99 300/800 ms; warm screen 1.0 s and cold chart 1.5 s p95; patient search 200 ms; order sign with CDS 1.5 s; BCMA 500 ms; HL7 end to end p95 ≤5 s with zero silent drops.

### 18.7 Chaos, DR and downtime drills

| Cadence | Drill |
|---|---|
| Nightly (CI) | Node kill, PostgreSQL failover, broker loss, network partition, slow terminology service, WAN cut, power-cut emulation (graceful shutdown path), clock skew; assert alarms ≤5 min and no data loss |
| Monthly | Game day on the reference cell (database primary kill, Kafka partition, certificate expiry); generator-transfer test support |
| Quarterly | Restore test per hospital; DR promotion with measured RTO/RPO (two consecutive failed restores reopen K-17) |
| Twice a year | Code-Dark drill per unit (packets, continuity instance, back-entry) |
| Before announced shutdowns | Planned WAN-loss drill |
| Annual | Cyber-recovery exercise with one customer, including the hospital-estate-down scenario |
| Before go-live | RG1: burn-in, failover and power-cut tests. RG3: WAN-cut and mains-cut drills; cash-drawer and dual-currency drill |

Pass criteria per layer are in §16.3–§16.4. Build drill modes and reports so each drill produces evidence with measured times.

### 18.8 Summative usability support

The studies themselves are [HUMAN]. Engineering provides: IEC 62366-1 use specifications per role; task scripts for the critical tasks (patient search and selection; weight-based and high-alert ordering; BCMA with override; transfusion check; NEWS2 escalation; critical-result acknowledgement; discharge med rec; pick-lists); a study environment in TRAIN with synthetic patients; task-timing telemetry; and NISTIR 7742-format report templates. **Kurdish-first, Arabic-first and English-first users are separate groups of 15–20 each**, before every Tier 2 function and Tier 1 critical task. Release blockers: task time worse by >10% or any new critical use error.

### 18.9 Localisation, RTL and accessibility tests

| Test | Requirement |
|---|---|
| Pseudo-locale | Expansion builds catch truncation and hard-coded text |
| RTL | Layout, icons, charts and tables mirrored correctly; screenshot diffs every release |
| Bidi | Mixed strings (Sorani or Arabic name + English drug + numerals + units) isolated correctly |
| Digits | Clinical numerals Western on every screen and print; Eastern Arabic-Indic only for configured non-clinical patient text |
| Script | Every Sorani letter renders, shapes, sorts and searches; Arabic vs Kurdish letter variants normalised |
| Printing | Golden images per printer model and language; S7-K results drive the Supported Hardware List |
| Names | Four-part names with transliteration; cross-script search; trilingual banner; newborn band truncation |
| Calendar | Friday–Saturday weekend; holidays; calendar-aware SLA timers |
| Translation gate | Zero missing keys in clinical paths; clinician review recorded [HUMAN] |
| Accessibility | WCAG 2.2 AA per release (axe in CI plus a manual audit per release) |

### 18.10 Synthetic data

- A generator (Synthea-based or our own) with a **Kurdistan locale pack:** four-part names in Kurdish (Arabic script), Arabic and Latin with transliteration variants and character-variant noise; the mother's name; Iraqi identifier types with plausible formats (the sources give no format or check-digit rules, so mark the generators as assumptions); DOB precision flags with placeholder dates (1 January, 1 July); phones shared within families; several identifiers per person; mixed-script duplicates.
- **Canary identities** for the PHI-leak scan (§6.2).
- Clinical content in samples is labelled NOT FOR CLINICAL USE.
- Production PHI never enters non-production environments. Synthetic data is for development and testing only, never for clinical validation.

### 18.11 Content validation and replay

The pipeline is §19.4. Acceptance per content type [E]:

| Content | Simulation | Acceptance |
|---|---|---|
| CDS rule | Silent 2–4 weeks, then replay of up to 90 days of orders: firing rate, PPV, overlap | No rise in interruptive alerts per 100 orders without CDS committee sign-off [HUMAN] |
| Order set | Diff against the prior version; dose and interaction replay; CPOE error-category harness | Zero new hard-stop conflicts; harness passes |
| NEWS2 policy | Replay 90 days of observations: escalations per ward per shift | Within agreed nursing capacity [HUMAN] |
| Tariff, package, payer rule | Re-price 3–6 months of encounters under old and new rules | Delta explained line by line; zero unpriced services |
| Lab range, autoverification rule | Replay historical results: autoverification rate, flag changes | Lab director sign-off [HUMAN] |

A first site with no electronic history uses the vendor-validated Tier A/B baseline, interruptive from day 0, validated on the harness and on synthetic or multi-site replay.

### 18.12 Migration verification

- **Mocks:** Mock 1 at T-120 (full extract, ≥95% loaded, mapping gaps listed); Mock 2 at T-75 (≥99.5% loaded, every reject with a reason code, clinicians review 30–50 charts); Mock 3 at T-45 (production-like and timed, 100% reconciled, HIM and finance sign-off); dress rehearsal at T-14 (full runbook within plan).
- **Metrics:** the accounting identity holds at 100% (source = loaded + rejected with reason + intentionally excluded); control totals and hashes on deposits, receivables, package balances, allergies per patient and active medicines per inpatient; zero defects in critical fields (identifiers, allergies, active medicines, blood group, code status, weight) and <0.5% elsewhere; 100% review of active inpatient allergies and medicines; the load fits the window with 25% headroom; deposits and packages reconciled to the dinar per currency.
- **EMPI:** duplicates <1%, zero overlays loaded, ≥99.9% precision at the auto-merge threshold on the 2,000-pair gold set; HIM adjudicates 100% of high-score pairs before Mock 3; every legacy MRN kept as an alternate identifier.
- **The three most dangerous items** (scripted, owned, reconciled, signed off, rehearsed in Mock 3 and the dress rehearsal): active medicines and PRN last-given times; deposits and packages; pharmacy opening balances including controlled drugs.

### 18.13 Go-live readiness evidence (RG1–RG4) and rollback

The gates are contractual and [HUMAN]; the software produces their evidence.

| Gate | Timing | Evidence the system must produce |
|---|---|---|
| RG1 Build complete | T-90 | Code frozen (Clinical Safety sites feature-complete since T-150); foundation content adoption ≥90% with the deviation log; Boundary Register state and fallback sets per Tier 2 function; control set A and 24×7 pharmacist cover confirmed (Clinical Safety sites) or the transcription double check (Core sites); control set C configured and a hospital stewardship lead named (every site); control set B configured (Core sites); infrastructure obligations evidenced (UPS, generator transfer, cell burn-in, failover and power-cut tests, Wi-Fi survey); blood-unit relabelling workflow agreed; calendars configured; seam controls live |
| RG2 Integrated testing | T-45 | Mock 3 passed; scenario suites green; the 300-bed day at customer sizing on the installed cell within SLOs; deployment hazard log signed by the customer's CSO |
| RG3 Readiness | T-14 | Dress rehearsal passed; device-class rehearsal including Kurdish and Arabic printing; training ≥95% complete, proficiency ≥85%, ≥80% "ready" per unit; downtime drill including WAN-cut and mains-cut drills; cash-drawer and dual-currency drill; zero open Sev-1; no unmitigated high-risk hazard; orphan queue at zero; control set A validated for NICU/PICU and paediatrics and signed by the Chief CSO; statutory registers live; pharmacist-cover alarm tested; patient-supplied medicine workflow live; command centre staffed; independent assessor concurs (customers #1–3) |
| RG4 Go/no-go | T-1 | Final delta load on time; safety dashboard live; continuity instance and clean kits ready; DR standby replicating within target; insurance bound; card terminals and wallet links tested; KRG return formats tested; independent assessor concurs (customers #1–3) |

**Rollback levels:** (1) a feature flag, any time; (2) a unit falls back to downtime procedures; (3) full fallback to paper or legacy, **only within 72 hours**. **Level-3 triggers:** orphaned items >2 h with patient impact; BCMA down >4 h across units; order-sign p95 >5× SLO for >4 h; a system-attributable sentinel event; while seams exist, unmatched results >0 for 1 h; the on-site cell unavailable >4 h without DR promotion. Build the dashboards and alarms that detect each trigger automatically.

**Rollout ruling: "pilot the product, big-bang the hospital."** A model ward (1–2 weeks of scripted shifts on the production build with real staff and synthetic patients) precedes one site-wide cutover of inpatient clinical and revenue modules. **BCMA is never rolled out unit by unit.** Phasing is allowed only for back office, outpatients before inpatients where medication records do not interleave, self-contained units and multi-site waves. Two big bangs per hospital (Core, then Clinical Safety) are normal in Kurdistan; NICU and PICU go live with the rest of the site, never later.
