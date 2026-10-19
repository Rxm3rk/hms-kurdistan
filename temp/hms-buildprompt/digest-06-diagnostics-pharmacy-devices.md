# Digest 06: Diagnostics, transfusion, pharmacy, devices and ancillaries

**Sources**
- R04, read in full.
- K: §1, §4.1–4.3, §5.1–5.7, §7.9, §8, §9, §12.1, §13, §17, §19, App. A and App. B.
- BP: §4.3, §5.1, §5.5–5.7 and §9.2, where K inherits them.
- R11 §10 (state machines, per K §8).
- R14 App. A (feature IDs; backlog of record, K §4.1).
- RL #4, #5 and #11.

**Precedence and tags**
- Precedence: K > BP > R04/R11. RL settles research conflicts. Conflicts are listed in §9.
- **[AK]** = R04 analyst knowledge, unverified (R04 writes it as "[K]").
- **(est.)** = estimate.
- **[L]** = Kurdistan local assumption (K App. B).

**Phase key (K §4.2–4.3)**
- **R1 wedge** (live M22): outpatient and diagnostics.
- **R1.1** (≈M25): non-safety items only, each with a manual path.
- **R2a** (M27): Core inpatient.
- **R2b** (M37): Clinical Safety.
- **R2.1** (by M40).
- **MVP** = R1 to R2.1. **P2** = M38–M54 (GA wave M50). **P3** = M52+ or partner-led.

---

## 0. Phase map with feature IDs

R14 App. A gives feature names and sizes. K overrides phase and stance.

| Area | IDs (size) | Kurdistan phase | Stance |
|---|---|---|---|
| Shared diagnostic order lifecycle; closed-loop critical-result service | DX-ORD-01 (L), DX-CRT-01 (M) | R1. The wedge "carries the platform" (K §4.2) | B |
| LIS: worklists, bedside labels, accessioning and tracking; analyzers; QC and lot tracking; send-outs; lab-quality pack (its ID is unclear, C19) | DX-LAB-01 (L), DX-LAB-02 (L, B+I), DX-LAB-04 (M), DX-LAB-05 (M) | R1 | B; middleware I |
| Result validation, reports, delta/critical rules; **autoverification v1** | DX-LAB-03 (L, reg C) | Validation in R1. Autoverification in R1.1, only where the Register allows | B, Tier 2 |
| ISO 15189 document control and risk register | DX-LAB-06 (M) | R14 says P3 (C19) | B |
| Microbiology with WHONET/GLASS | DX-MIC-01 (L) | P2 | B |
| Anatomic pathology | DX-AP-01 (L) | P3 | B |
| POCT data manager | DX-POC-01 (M) | P2 | I |
| RIS core; templates and actionable follow-up; PACS link (DICOMweb + IID) with an open-source viewer labelled non-diagnostic | DX-RIS-01 (L), DX-RIS-02 (M), DX-PAC-01 (M, I) | R1 (KDV-10) | B; PACS I |
| Dose capture (RDSR) and exceedance review | DX-RIS-03 (M) | P2 (C9) | B |
| ECG/cardiology and endoscopy report integration | DX-CRD-01 (M) | P2 | I |
| Imaging-AI orchestration | — | P3 | I |
| Bedside transfusion verification, orders, consent, reactions | DX-BB-01 (M, reg C) | R2b | B |
| Blood-unit receipt and relabelling | DX-BB-KRI-01 (S) | R2b | B |
| Blood-bank interface | DX-BB-02 (M) | Status unclear in Kurdistan (C3) | I |
| Blood-centre inventory and ISBT 128 labelling (BP "03a") | DX-BB-03 (XL, reg Y) | P2, regulated track | B |
| Compatibility engine (BP "03b") | — | **Never** (licensed if ever needed) | — |
| Formulary (LASA, tall-man, high-alert) | MED-FRM-01 (M) | MVP. Used from R1 by OPD e-Rx and the OP POS (K §4.2, §6.1) | B; drug KB P |
| Regional brand master and in-house unit-dose labels | MED-KRI-01 (M) | MVP | B |
| OP pharmacy POS (dual currency, narcotics registers) | MED-OPP-01 (M), MED-CS-01 (M) | R1 | B |
| IP dispensing; pharmacist verification | MED-DSP-01 (L), MED-PHV-01 (L) | R2a: dispensing against transcribed paper orders, with screening at transcription. R2b: verification of CPOE orders (K §4.2) | B |
| eMAR; mobile offline BCMA; infusion model | MED-MAR-01 (L), MED-BCM-01 (L), MED-INF-01 (M) | eMAR and BCMA in R2b (K §4.2). Infusion model is MVP (K §4.3), with no release named | B |
| Dose Engine | MED-DOSE-01 (L) | P2 (≈M50). Fallback control set runs in the MVP | B, Tier 2 |
| Stewardship module | CLN-AMS-01 (M) | P2. Control set runs in the MVP | B |
| Smart pumps (one vendor); ADC/robots | MED-INF-02 (L, I, reg C), MED-ADC-01 (M, I) | P2 | I |
| Chemotherapy | MED-ONC-01 (L, reg C) | P2 | B |
| IV compounding and TPN, plus IVWMS interfaces | MED-IV-01 (M, B+I) | P3 | B+I |
| Device gateway (PCD-01/DEC) with device–patient association; nurse validation UX | DEV-GW-01 (L, B+I), DEV-VAL-01 (M) | MVP. Validated ICU monitor feed in R2.1 | B + I |
| IHE ACM reporter/consumer; RTLS ingestion | — | P2 | I |
| Alarm analytics | DEV-ALM-01 (M, reg Y) | P3 | I |
| SDC/SDPi | DEV-SDC-01 (L) | Not in K (C16) | — |
| Alarm forwarding, nurse-call engine, RTLS engine, pneumatic tube | — | **Never** | — |

Refs: R14 App. A; K §4.1–4.3, §9.2, K-08, K-09; BP §4.3.

---

## 1. Shared ancillary architecture

**Kurdistan phase.** Built in the R1 wedge (K §4.2). Stance B (R04 §0 #15, §11 #1).

**Must-have functional requirements**
- **One order lifecycle.** A single order/task/result/acknowledgement state machine with timestamped events, shared by lab, radiology, POCT, cardiology, blood bank and pharmacy (R04 §11 #1; DX-ORD-01).
- **Skeleton for every ancillary:** order → identify (patient, plus specimen/unit/exam/dose) → perform → result/document → verify → notify/acknowledge → bill → analyze (R04 §1).
- **Timestamps.** Every step is a first-class event: order, collect, dispatch, receive, accession, start, result, verify, notify, acknowledge. TAT KPIs then come out of the box (R04 §1).
- **Five shared services** (R04 §1):

| Service | Requirements |
|---|---|
| Identity and barcode | Wristbands (2D barcode/RFID) with ≥2 person-specific identifiers. Specimen labels to IHE PaLM LBL. ISBT 128 parser/validator. GS1 GTIN/lot/expiry/serial for medicines. UDI for devices and trays [AK]. Every scan is an immutable event recording user, device, location and time (R04 §1, §11 #4) |
| Rules engine | Declarative and versioned. Simulation and replay harness against historical data. Approval workflow (medical director, P&T), effective-dating, audit trail. R04's scope: autoverification, reflex, delta, critical values, protocol defaults, pharmacy screening suppression, ADC override policy (R04 §1, §11 #2). R04 also lists alarm escalation; that drops out because alarms are never built (K §4.3). For the Tier 2 split see C1 |
| Closed-loop notification | Covers critical labs, critical and actionable imaging, critical POCT and pharmacy interventions. Policy routing, escalation, read-back/acknowledgement capture, audit (R04 §1, §11 #3) |
| Worklist/task engine | One primitive with domain views: collection lists, accession queues, bench worklists, AP case/slide queues, reading worklists with AI priority, pharmacist verification queues, IV-room queues, tray lines, therapy schedules (R04 §1) |
| Device/instrument gateway | One ingestion tier for HL7 v2 (LAW, DEC, IPEC), ASTM via middleware, DICOM, POCT01, and later SDC. Store-and-forward, clock sync, device–patient association (R04 §1) |

- **"Scan, don't type"** is the default. Every override of a failed scan is a reportable event (R04 §11 #4; SI-02).
- **The Integration Hub owns every interface** (K §9):
  - HL7 v2 2.3–2.8 with per-interface conformance profiles;
  - per-patient ordering; MSH-10 idempotency;
  - store-and-forward and replay;
  - per channel: an owner, ack state, an owned dead-letter queue alarmed at 5 min, and a replay console;
  - **zero silent drops.**
- **Printing and scanning** (K §9.2 plane A):
  - silent wristband and label printing, rendered per printer DPI;
  - Kurdish/Arabic shaping or a raster fallback, with golden-image tests;
  - Zebra needs firmware V60.14/V50.14+ for `^PA` shaping and `^CI28` UTF-8, plus a font with the glyphs;
  - HID-POS scanners must preserve GS1 FNC1.
- **Label identity.** The name prints in the patient's script plus Latin transliteration. MRN plus DOB, or the approximate-DOB flag, is the second identifier (K SI-01).
- **Clinical text.** Drug names, doses and units stay in Latin script, with Western digits, in every UI language (K §6.2, §6.5).
- **Designed downtime per ancillary** (R04 §11 #13):
  - lab and blood-bank label printing with downtime accession ranges;
  - cached modality worklists;
  - BCMA offline with later reconciliation;
  - an ADC downtime override policy;
  - a read-only cached MAR.
- At hospitals, WAN loss has no clinical effect because of the on-site cell (K §7.9 L1).
- **Regionalise by configuration, not forks** (R04 §11 #14; K-26).
- **A regulatory boundary map per module.** Revisit it for any feature that drives device behaviour: pump autoprogramming, alarm routing, blood release (R04 §11 #12). In K this is the Boundary Register (K-05, SI-18).

**State/lifecycle**
- **Order** (R11 §10.2):
  - draft → active (signed, co-signed if required) ↔ on_hold;
  - active → completed (fulfilled/result final), revoked (with reason) or entered_in_error;
  - medication orders add pending verification → verified before dispensing, unless an emergency or first-dose override applies.
- **Result** (R11 §10.5):
  - registered → preliminary → final → amended or corrected; also cancelled and entered-in-error;
  - every correction notifies the orderer and everyone who acknowledged the earlier version.
- **Ownership** (K §8): order, medication administration, specimen and result machines each have an owner squad and an approval gate by G1 (M6). "Write the state-machine and invariant specs before any UI work."

**Rules**
- **Rule activation.** Medical-director or committee sign-off, plus replay against historical data, before activation (R04 §1).
- **New or locally modified CDS rules** run silent for 2–4 weeks with replay. The vendor-validated baseline is interruptive from day 0 (K §5.4).
- **Tier 2 functions** are LIS interpretive rules, transfusion verification, the Dose Engine and the screening presenter (K-06, K §5.5; BP §5.5). They must:
  - run as separately versioned, process-isolated components;
  - fail safe to "unavailable, manual check required", never "pass";
  - render regulated display through Tier 2-owned UI components with render-integrity checks.
- **No rules engine inside the device boundary** (K §5.5; BP §5.5).

**Safety.** SI-01, -02, -03 (`TaskOrphaned` ≤5 min), -04, -10, -15, -16, -17, -18, -19 (K §5.1). Hazards H1, H3, H5 (BP §5.1).

---

## 2. Laboratory Information System (LIS)

**Kurdistan phase**
- **R1:** LIS core with analyzers via middleware, the critical-result service and a lab-quality pack (K §4.2).
- **R1.1:** autoverification v1, only where the Register allows. Until then: manual technologist validation, with delta and critical rules as flags only (K §4.2, §5.6).
- **P2:** microbiology; POCT (I).
- **P3:** anatomic pathology (K §4.3).
- **Seam:** the polyclinic LIS/RIS serves only polyclinic patients until hospital A goes live (K §13.1c).

### 2.1 Pre-analytic (R04 §2.2 #1–5; DX-LAB-01)
- **Test catalog per orderable:** specimen requirements, container, minimum volume, stability, priority (STAT/ASAP/timed/routine), LOINC order code [AK].
- **Order entry:** ask-at-order-entry questions (fasting; dose time for drug levels); duplicate-order and utilisation checks.
- **Collection lists:** by unit, collector and time window, consolidating tubes across orders.
- **Bedside collection:**
  - the handheld scans the wristband and prints labels on demand;
  - it records collector ID, collection time and device;
  - labels are applied in the patient's presence;
  - ID, sampling and labelling are one continuous bedside process (R04 §2.2 #2);
  - the mobile nurse mode includes bedside specimen labels (K §6.6).
- **Labels** follow tube-type and draw-order rules (IHE LBL).
- **Transport:** tracking events per IHE PaLM SET. Send-outs need temperature-monitored transport and manifests (R04 §2.2 #3). No pneumatic-tube integration (C18).
- **Receipt:**
  - scan-in creates the receipt timestamp;
  - acceptability checks: haemolysis, clotting, insufficient quantity, wrong container, expired stability, unlabelled or mislabelled;
  - a coded rejection reason auto-creates a recollection task and notifies the care team [AK].
- **Accessioning:** accession number; aliquots; routing to TLA or bench worklists; storage-location tracking for add-ons and audits [AK].

### 2.2 Analytic (R04 §2.2 #6, §2.3, §2.6; DX-LAB-02)
- **Work orders:** host query or download. Results return with instrument flags, QC status, and dilution and rerun data.
- **Analyzer status** shows on the lab workspace (K §6.1).
- **Lot tracking:** reagent and calibrator lots are linked to every result for look-back (DX-LAB-04).

### 2.3 Post-analytic (R04 §2.2 #7–12; DX-LAB-03, DX-LAB-05)
- **Review queue:** exceptions show the reason highlighted.
- **Reporting:**
  - preliminary, final and corrected statuses, with a corrected-report trail;
  - reference intervals by age, sex, pregnancy and method;
  - interpretive comments;
  - performing-lab identification;
  - LOINC and UCUM on every result.
- **Add-ons:** check stability and residual volume, locate the stored tube, and link to the original accession.
- **Reflex:** rules pre-approved by the medical director (e.g. TSH → free T4). Billing logic and patient transparency are explicit [AK].
- **Send-outs:**
  - manifests and tracking;
  - compendium import [AK];
  - results keep the performing lab, units and reference ranges;
  - IHE PaLM ILW (R04 §2.2 #12);
  - Kurdistan: reference labs over HL7 v2 or FHIR, with PDF fallback, in R1 (K §9.1).
- **Patient release** (K §9.2 plane C):
  - OTP to the registered mobile **plus** a knowledge check when the link is opened;
  - single-use links valid ≤72 h;
  - no clinical content in message bodies;
  - SI-21-labelled results and pregnancy tests are never released by message;
  - every release is logged in BALP audit.
- **Notifiable diseases:** from LIS results to the Directorate of Health format, in R1 (K §9.1).

### 2.4 Lab-quality pack (MVP)
- **Contents:** EQA, rejection register, amended-report audit and TAT per test; ISO 15189-aligned (K §4.3). Which feature carries the pack is unclear (C19).
- **ISO 15189:2022 design points** (R04 §11 #5, §2.11):
  - risk register;
  - document control;
  - measurement uncertainty;
  - POCT oversight;
  - downtime;
  - LIS validation, access control, and downtime and off-site management [AK].
- **PT/EQA:** enrolment and tracking (R04 §2.6).
- **Retention:** never auto-delete; 25-year floor until local rules are confirmed (K KDV-12, Q-K5).

### 2.5 QC (R04 §2.6; DX-LAB-04)
- **Westgard [AK]:**
  - 1-2s is a warning;
  - 1-3s, 2-2s, R-4s, 4-1s and 10-x are rejection rules;
  - rules are selected by Sigma metric.
- **Levey-Jennings charts** and peer comparison.
- **QC lockout:** no auto-release while QC is failed or overdue.
- **Patient-based real-time QC:** moving averages.
- **QC frequency** is configurable per test. CLIA's two levels per 24 h (unless IQCP) is a US reference only [AK].
- **Measurement uncertainty** is evaluated [AK].

### 2.6 Autoverification (R1.1; Tier 2)

**Rule stack, evaluated in order** (R04 §2.4):
1. Instrument error and flag codes, then QC status (block if the latest QC failed).
2. HIL indices against analyte-specific thresholds.
3. Analytical measurement range and dilution logic.
4. Absurd or implausible limits.
5. Critical value → manual review plus notification.
6. Delta check: absolute or % change within a time window, analyte-specific.
7. Cross-analyte consistency (anion gap; K+ elevated with haemolysis).
8. Patient context (dialysis, neonatal, post-transfusion).
9. Release.

- **Per rule:** a documented rationale, validation evidence (simulated and historical cases), version control, and revalidation after any instrument or method change (R04 §2.4).
- **Activation** (K-05, K §5.6): a written local opinion, our safety case, hospital sign-off and independent-assessor concurrence. Classification: "IVD if interpretive".
- **Design target:** a majority of routine chemistry autoverified, 60–90%+ (est.). Haematology differentials, urine microscopy and microbiology run lower (R04 §2.4).

### 2.7 Critical values (R04 §2.5, §11 #3; K SI-04; DX-CRT-01)
- **Policy tables** per test, analyte, location and age. Each row holds:
  - the threshold;
  - the target notification time;
  - the escalation chain: ordering → covering provider → charge nurse → rapid response.
- **Channels:** secure chat; phone with read-back capture; inbox with acknowledgement.
- **Escalation:** unacknowledged results auto-escalate. A dashboard tracks performance against policy.
- **Record (CAP pattern):**
  - date, time, the responsible lab individual, a **traceable recipient** and the result;
  - the recipient comes from a picker, never free text ("RN notified" fails);
  - read-back when phoned;
  - electronic delivery is acceptable if receipt is confirmed;
  - opt-outs are discouraged.
- **Kurdistan** (K §4.3, SI-04, §6.1):
  - named recipients include **external referring doctors** for outpatient-tier results;
  - a read-back logger covers internal and external doctors.
- **Outpatient-tier downtime protocol** (K §7.9 L1):
  - middleware holds and validates results;
  - paper reports carry downtime accession numbers;
  - criticals are phoned, with read-back logged on the edge agent and back-entered within 4 h;
  - sites pre-stage on announced shutdown days;
  - during shutdowns, critical messages go by voice call (K §9.1).
- **Typical target:** notification within 15–30 min of verification (est.).

### 2.8 Microbiology (P2; DX-MIC-01) (R04 §2.8)
- **Workflow [AK]:**
  1. receipt (source and site);
  2. plating, with automation and imaging;
  3. Gram stain, reported as preliminary;
  4. daily reads with workup notes;
  5. identification (MALDI-TOF);
  6. AST (MIC/disk) against CLSI M100 or EUCAST tables, which update annually;
  7. expert rules;
  8. cascade or selective reporting;
  9. preliminary and final reports, often several per specimen;
  10. infection-control alerts (MRSA, VRE, CRE, *C. auris*);
  11. notifiable reporting.
- **Data model:** hierarchical. Specimen → isolate(s) → antimicrobial panel per isolate → interpretation, with comments at each level. **Never flattened.**
- **Antibiograms:** CLSI M39, i.e. first isolate per patient per period and ≥30 isolates per organism [AK]. WHONET export for national and GLASS surveillance (K §4.3, §9.1).
- **Stewardship:** LIS and pharmacy feed one stewardship dataset.

### 2.9 Anatomic pathology (P3) and sections outside the K catalogue
- **AP workflow [AK]** (R04 §2.9, §11 #6):
  - case → part → block → slide accessioning;
  - grossing;
  - cassette tracking;
  - barcode slide labels;
  - sign-out, addenda and consults;
  - a frozen-section clock (≤20 min target);
  - a scan at each station.
- **Synoptic reporting:** licensed SDC XML content through a generic SDC renderer that can be reused for ICCR and national datasets.
- **Digital pathology** (DICOM WSI, DPIA; integrate) and **molecular** (integrate a LIMS; build display, FHIR genomics and PGx CDS) are not in K (R04 §2.9–2.10).

### 2.10 State/lifecycle
- **Specimen** (R11 §10.4): ordered → label printed → collected (collector, time, scanned wristband) → in transit → received → in process → resulted → stored or disposed. Branch: rejected (unlabelled, haemolysed, insufficient) → recollect task.
- **Result:** see §1. Amendments are audited (K §4.3).

### 2.11 Interfaces (see also §8)
- **EHR↔LIS:** native, or HL7 v2.5.1 OML/ORM and ORU/OUL; IHE PaLM LTW (R04 §2.2).
- **Analyzers via middleware** (K §9; R04 §2.3):
  - legacy: ASTM E1381/E1394, i.e. CLSI LIS01-A2/LIS02-A2, over RS-232 or TCP;
  - target: IHE LAW / CLSI AUTO16 Ed2 (3 Jun 2026).
- **LAW specifics** (R04 §2.3):
  - every AWOS ID is echoed back;
  - enhanced acks MSH-15 = NE, MSH-16 = AL;
  - **query mode mandatory**, broadcast optional;
  - AUTO16 Ed2 covers all specialties including blood bank, but excludes POC, imaging, calibration and configuration data, and nomenclature mapping.
- **LIVD** seeds the analyzer → LOINC mapping (R04 §2.3; K §8).
- **Coded elements** keep local code, standard code, display, original text and code-system version (K §8).

### 2.12 Safety
- SI-01, -03, -04, -17, -18, -21; H3.
- Analyzer parallel run (K §13.2, §13.6).
- Results-closure suites (K §13.6).
- Level-3 rollback trigger while seams exist: unmatched results >0 for 1 h (K §13.3).

### 2.13 KPIs (R04 §10; K §5.2, §17)

| KPI | Target |
|---|---|
| ED STAT TAT, receipt → verified, p90 | ≤60 min (est.) |
| AM results available by round time | ≥90% (est.) |
| Rejection rate, by reason | <1%; ED haemolysis <2–3% (est.) |
| WBIT/mislabel rate, by collector and unit | → 0 |
| Critical results within policy, including external referrers | ≥95% (K §17) |
| Critical documentation completeness | 100% |
| Autoverification (chemistry) | ≥70–90% (est.) |
| Corrected-report rate | <0.1–0.2% (est.) |
| Blood-culture contamination | ≤3%, stretch ≤1% [AK] |
| QC lockouts per analyzer per month | Trend |
| Unacknowledged abnormal results >7 days | Live KPI (K §5.2) |
| AP (P3) | Routine sign-out ≤2 working days ≥90%; frozen ≤20 min ≥90% [AK]; synoptic completeness 100% |

### 2.14 Build/buy/integrate (R04 §8.2)
- **Build:** LIS core; microbiology; the AP workflow (license the content).
- **Integrate:** instrument middleware, for legacy ASTM and driver breadth (1,200+ drivers). Middleware is itself an upgrade burden: support for IM ≤08.17.32 ends 1 Jan 2027 (R04 §2.3).
- **Analyzer connectivity:** integrate first, then build LAW-native.
- **Integrate:** digital pathology; molecular.

---

## 3. Blood bank and transfusion medicine

**Kurdistan phase** (§0; K §4.3, K-08, §9.1)
- **R2b:** T1 workflow and haemovigilance; T2 bedside verification; receipt and relabel.
- **P2:** blood-centre inventory and ISBT 128 labelling.
- **Never:** a compatibility engine.
- **Public blood banks:** issue on paper or labels, with no interface assumed.

**Must-have functional requirements**
- **Loop of timed events:** consent → bedside-labelled sample → issue → two-person verification → vitals → reaction (K §5.2). BP adds vitals timers and haemovigilance (BP §5.2).
- **Clinical layer:** orders, consent, bedside administration UI, vitals and reaction documentation (R04 §8.2; DX-BB-01).
- **Bedside verification runs inside BCMA** (R04 §11 #7).
- **Receipt and relabel** (K SI-11, §5.6):
  - two-person **blind double entry** of unit number, ABO/Rh, product and expiry, taken from the original label and the issue note;
  - the original label is **never covered**;
  - the new label prints the unit number and ABO/Rh beside our barcode;
  - **any mismatch quarantines the unit**;
  - at the bedside, the witness also confirms the unit number on the original label.
- **Fridge temperature excursions quarantine blood units** (K §9.2 plane B).
- **R04 hospital-service functions** (R04 §3.1). Their T1 status is unstated (C10):
  - special-requirement flags (irradiated, CMV-safe, washed, HLA-matched);
  - massive transfusion protocol and emergency release;
  - returns under temperature/time rules;
  - final disposition;
  - reaction workup;
  - inventory: days of supply, outdates, wastage;
  - PBM dashboards.
- **Downtime:** label printing and downtime accession ranges (R04 §11 #13).
- **Setup** (K §13.2–13.3):
  - discover the workflow with the supplying public blood bank in phases 0–1;
  - RG1 requires the relabelling workflow to be agreed.

**Out of scope** (K §4.3, §5.7; R04 §3.1–3.2)
- Electronic/computer crossmatch.
- ABO-compatibility assignment.
- Donor-centre quarantine/release (BECS) logic.
- Donor workflows.

**Unit lifecycle.** No source defines a formal unit state machine. The sequence below is assembled from K SI-11, K §9.2 and R04 §3.1 #5, #8 and #9:
1. received with the issue note → blind double entry;
2. → relabelled (entries match) **or** quarantined (mismatch, or fridge excursion);
3. → stored → issued → bedside-verified → transfused;
4. → reaction → workup → haemovigilance, **or** → returned (temperature/time rules) → final disposition.

**Rules**
- **SI-11:** wristband ↔ unit ↔ order ↔ sample match plus a two-person electronic witness. A mismatch is a hard stop (BP SI-11; K §5.1).
- **Fallback until T2 activation** (K §5.6):
  - scripted two-person check, with identifiers scanned and shown side by side;
  - both electronic signatures required;
  - no automated pass/fail;
  - the witness confirms the unit number on the original label.
- **T2 classification and activation** (K §5.6). T2 is "Borderline". It activates the same way as NEWS2:
  - a local opinion;
  - our safety case;
  - summative usability with Kurdish-first, Arabic-first and English-first nurses;
  - hospital sign-off;
  - an independent assessor.
- **ABO/Rh:** two concordant determinations (a historical type or a second independent sample) as the WBIT safeguard (R04 §3.1 #1). Enforcement is unstated in K (C10).
- **Failure modes to design against:** omitted patient-ID steps; over-reliance on scanning (R04 §3.4).
- **ISBT 128** (R04 §3.3; labelling is P2, parsing see C11):
  - DIN = facility code + year + sequence + flags/check;
  - product code; ABO/Rh; expiry date/time; special testing;
  - data identifiers begin with "=" or "&";
  - ST-001 v6.2.2 plus RT019/RT038;
  - ICCBBA registration, annual fee and facility ID;
  - **one shared parser/validator** with concatenation and check-character logic, used by the blood bank, bedside verification and OR tissue/implant tracking.

**Interfaces**
- None with public blood banks (K §9.1).
- IHE PaLM TMA (Trial Implementation 2019) is optional (R04 §3.4, §9).
- AUTO16 covers blood-bank analyzers (R04 §2.3).

**Safety**
- SI-11, -01, -16, -18; H8 wrong blood (BP §5.1).
- Lab and transfusion CSO duty sits with the lab informaticist (K §5.3).

**KPIs**
- **K §17, §5.2:** bedside verification ≥98%; WBIT per 1,000 samples, trending to 0; relabel errors 0.
- **R04 §10:**
  - C:T ratio ≤2.0 [AK];
  - RBC wastage <2–3% (est.);
  - near-miss reports per 1,000 units tracked (higher reporting = better culture).

**Stance.** B + I (K §4.3). RL #5's v1 HL7 interface is not assumed in Kurdistan (C3).

---

## 4. Radiology/RIS and PACS

**Kurdistan phase**
- **R1:** RIS core with MWL/MPPS and a PACS link. The bundled open-source viewer is labelled non-diagnostic (K §4.2; KDV-10).
- **P2:** dose capture (C9).
- **P3:** imaging-AI orchestration.
- **Never:** build a PACS (K-09).

**Must-have functional requirements** (R04 §4.1; DX-RIS-01/02, DX-PAC-01)
1. **Order:** CPOE with reason and structured indication; duplicate-imaging and prior-study checks; appropriateness CDS optional.
2. **Protocoling:** protocol, contrast, sedation. CT protocols cover indication, contrast, age, size and an **expected dose-index range**, reviewed by the interpreting physician, medical physicist and lead technologist (NPG.13.02.01 pattern). RIS protocoling is a workspace tool (K §6.1).
3. **Scheduling:** modality, room, resource, prep instructions, reminders.
4. **Screening and check-in:**
   - **MRI safety screening** covering implants, devices and foreign bodies, ferromagnetic objects, claustrophobia and acoustic noise, **with incident capture** (an acceptance criterion, BP §5.1);
   - contrast allergy and renal function;
   - pregnancy status (K §4.3).
5. **MWL:** demographics, accession number and requested procedure. The RIS assigns the Study Instance UID.
6. **MPPS:** in progress / completed / discontinued. It drives exam status, technologist documentation, contrast and radiopharmaceutical documentation (dose, lot) and charge capture. Storage commitment confirms archive receipt.
7. **Reconciliation:** PIR for trauma and unidentified patients.
8. **Reading worklist:** prioritised by urgency, AI flags, subspecialty and SLA timers. Priors are auto-fetched. IRA/FHIRcast carries context.
9. **Reporting:** structured templates; voice recognition (integrate); auto-populated measurements and dose.
10. **Sign and distribute.** Critical and actionable findings go to the closed-loop service.
11. **After reporting:** addenda, peer learning, follow-up tracking, and billing of technical and professional components.

- **Incidental-finding follow-up** (R04 §4.5). R04 calls this "the biggest current gap" in many RIS products. It covers:
  - recommendation extraction;
  - due dates;
  - patient and referrer letters;
  - closure reporting.
- **Peer learning:** non-punitive discrepancy capture, case conferences, feedback (R04 §4.5).
- **Image access:** IID launch from the chart. It is URL-based, and the invoker does no image handling (R04 §4.3).
- **Dose capture (P2)** (R04 §4.7):
  - RDSR via IHE REM;
  - CTDIvol, DLP and SSDE stored per series, against protocol ranges;
  - an exceedance review workflow;
  - MRI thermal and ferromagnetic incident data;
  - basic dashboards built; a physics platform integrated only for advanced QA.
- **Imaging AI (P3)** (R04 §4.6):
  - consume triage flags;
  - display AIR results;
  - record AIRA accept/reject/modify;
  - build the AIW-I orchestration contract and a governance ledger;
  - never build models.

**Lifecycle.** From R04 §4.1 and R11 §10.2/§10.5: order → protocoled → scheduled → screened/checked in → MWL item → MPPS in progress → completed or discontinued → storage committed → read → report preliminary/final → addendum.

**Rules**
- **ACR actionable categories:** Cat 1 within minutes; Cat 2 within hours; Cat 3 within days (R04 §4.5).
- **RADS templates** (BI-RADS, Lung-RADS, LI-RADS, PI-RADS, TI-RADS, O-RADS). Required template elements can be hard stops (MQSA density pattern; the US rule does not apply) (R04 §4.4).
- **Viewer:** the open-source viewer is always labelled non-diagnostic (K §5.6–5.7). It is a sweep candidate, with written triage by M9 (K §5.6).
- **Never couple to a proprietary PACS API** (R04 §11 #8).
- **No Form F gate** (K SI-21 drops PCPNDT).

**Interfaces** (full list in §8; K §9)
- Mandatory: SWF.b (HL7 v2 OMI, DICOM MWL/MPPS, Storage Commitment), DICOMweb and IID.
- DICOMweb mapping to DIMSE (R04 §4.2):
  - QIDO-RS ≈ C-FIND;
  - WADO-RS ≈ C-GET (instances, metadata, bulk data, rendered images);
  - STOW-RS ≈ C-STORE;
  - UPS-RS = workitems;
  - plus capabilities discovery.
- Content standards: FHIR DiagnosticReport and ImagingStudy; DICOM SR TID 1500 for measurements; RDSR for dose.

**Safety.** SI-01; SI-04 (including external referrers); SI-17; SI-21 (labelled results and pregnancy never by message, K §9.2); H3.

**KPIs (R04 §10; K §17)**
- Report TAT: ED ≤60 min; inpatient ≤4–8 h; outpatient ≤24 h (est.).
- Critical/actionable findings closed within the category window: ≥95% (est.).
- Critical results within policy, including external referrers: ≥95% (K).
- Follow-up closure: trend to ≥80% (est.).
- MWL use ~100%; orphan studies → 0 (est.).
- CT exceedances: 100% reviewed (P2).
- MRI incidents: collected and analysed.

**Stance (R04 §8.2)**
- **Build:** RIS; basic dose capture.
- **Integrate:** PACS/VNA/viewer (open source optional for low-cost tiers; K §16.5 lists a "PACS partner plus an open-source tier"); voice recognition; imaging AI via standards; advanced dose QA.

---

## 5. Pharmacy information system

**Kurdistan phase.** See §0 (K §4.2–4.3).

### 5.1 Formulary, brand master and drug KB
- **Formulary (MED-FRM-01):** LASA, tall-man and high-alert flags; ISMP display rules (no trailing zeros, no naked decimals); item-master link (K §4.3; BP §4.3; R14 App. A).
- **Governance** (R04 §5.1):
  - P&T status and restrictions (ID-approval antimicrobials, specialist-only drugs);
  - therapeutic interchange;
  - standardised, limited concentrations;
  - shortage substitution protocols that are followed and communicated;
  - order sets.
- **Regional brand master (MED-KRI-01)** (K §8):
  - maps brand → clinical drug → generic and ATC → package GTINs → lot, plus the licensed drug-KB concept;
  - several GTINs may map to one orderable;
  - new products are **scan-tested before use**;
  - unmapped formulary ≤5% at T-90;
  - there is no national drug file [L].
- **Search:** typo-tolerant brand↔generic search across regional brands (K §6.2, §6.1).
- **Drug KB: license, never build** (R04 §5.1; K §1).
  - An abstraction layer keeps screening content-agnostic and lets a region switch vendors (R04 §5.1).
  - The adapter re-tiers locally and maps regional brands (K §4.3).
  - Vendor criteria: regional brand coverage and Arabic content (Q-K8). Coverage <90% at contract is a risk trigger (K §18 #27).
  - ATC files need a WHOCC licence (K §8).

### 5.2 Verification and screening (MED-PHV-01)
- **Queue** ranked by STAT, first dose, high-alert and time due (R04 §5.2), with a STAT ≤15 min timer (K §6.1).
- **Screening checks** (R04 §5.2):
  - allergy and cross-sensitivity;
  - drug–drug, drug–disease, duplicates;
  - weight-based dose range: metric only, using measured not stated weight (ISMP BP3);
  - BSA-based dose range;
  - renal and hepatic adjustment;
  - pregnancy and lactation;
  - paediatric and neonatal dosing;
  - IV compatibility and line access.
- **KB screening is shown verbatim,** under the vendor's written regulatory position (K §5.6).
- **Safe-regimen defaults** (R04 §5.2, §11 #9):
  - weekly oral methotrexate (BP2);
  - vinca alkaloids in minibags only (BP1);
  - opioid-tolerance verification before extended-release opioids (BP15).
- **Interventions** carry outcome codes. Override analytics tune alerts (R04 §5.2).
- **Alert tiers** (K §6.3, K-10):
  - **A:** hard stop, ≤20 rules.
  - **B:** interruptive, reason required; ≤8 per 100 medication orders at go-live, ≤5 by M12.
  - **C:** inline, passive.
  - **D:** pharmacist queue.
  - Rules with >90% override are reviewed, never auto-retired; A/B are exempt.
  - The Leapfrog-category harness runs after every KB or content release.
- **Dose Engine fallback control set,** until the Engine is active (K §5.6, SI-05):
  1. **System-enforced independent pharmacist double check** on every weight- or BSA-based dose at any age, every high-alert infusion and every neonatal order. Mechanics (BP §5.6):
     - verification cannot complete until the pharmacist records an independently calculated dose and attests that it matches;
     - a mismatch returns the order to the prescriber;
     - the system does no arithmetic.
  2. A KB result **≥10× the maximum dose is a Tier A hard stop.** KB output is shown verbatim, with no local arithmetic.
  3. Seeded adult and paediatric 10× and unit errors are injected in every integrated test cycle.
  4. **Pharmacist-cover alarm:** fires if no pharmacist is logged in to the queue for >30 min. Any dose given before verification gets pharmacist review within 4 h.
  5. Core sites apply item 1 at transcription.
  6. 24×7 pharmacist cover [L] is an RG1 obligation at Clinical Safety sites.
  - NICU/PICU go live with the rest of the site, never later (K SI-05).
- **Dose Engine activation (P2)** (K §5.6):
  - a C2 change;
  - ≥4 weeks of shadow running visible only to pharmacists;
  - the NICU double check stays for 3 months after activation.
- **Core transcription control set (R2a)** (K §4.2):
  - only pharmacists transcribe, with an image of the signed order attached;
  - KB screening and the double check run at transcription;
  - the orderer is mandatory;
  - high-alert and paediatric orders get a second check;
  - no MAR, schedule or "active medicines" view is built from transcribed orders; the screen is labelled "dispensing record, not an order or MAR";
  - transcribed orders are reconciliation input only;
  - 50 orders are audited monthly.

### 5.3 Dispensing: IP, OP, unit dose, patient-supplied
- **IP dispensing (MED-DSP-01):** unit dose or ward stock; returns; charge on dispense or administration (R14 App. A). In R2a it runs against transcribed orders; in R2b against CPOE (K §4.2).
- **Central-pharmacy patterns** (R04 §5.3):
  - unit-dose cart fill;
  - repackaging with barcodes;
  - barcode-verified picking;
  - carousels and robots (integrate);
  - tech-check-tech where permitted [AK].
- **In-house unit-dose barcode labels** for imported drugs without usable barcodes. Label printing is a pharmacist-workspace tool (K §4.3, §6.1, §18 #16).
- **OP POS (MED-OPP-01, R1):**
  - retail sale with batch and expiry (R14 App. A) and narcotics registers;
  - KRG price-list checks, if such lists exist [L] (K §12.1);
  - dual currency (K §12.1, §8): IQD price lists by default; USD only where L-33 confirms; payment in either currency at the posted rate; change in either; an effective-dated rate table with source and timestamp; per-currency drawers with denomination counts and shift close; cash rounding per tenant (e.g. IQD 250 [L]).
- **Patient-supplied medicines (R2a)** (K §12.1; SI-12):
  - received by pharmacy → identified → expiry-checked → relabelled to the patient → flagged "patient-supplied";
  - **unverified outside medicines cannot be scanned for administration.**
- **SI-12 extension** (K §5.1): no payment, deposit or counter rule may delay a verified time-critical inpatient dose. Time-critical means STAT and first doses, antimicrobials, insulin, anticoagulants and anticonvulsants. The dose is charged to the running bill.
- **Inventory:**
  - perpetual stock across central pharmacy, satellites and ADCs, with par levels;
  - shortage management;
  - GS1 DataMatrix at receipt populates lot and expiry for recalls [AK] (R04 §5.6);
  - FEFO (K §4.3).

### 5.4 Controlled drugs (MED-CS-01 → Iraqi narcotics registers, K §4.1)
- **Registers** are locked, append-only statutory entries. Corrections are addenda (OPS-STAT-02) (K §8).
  - 100% within the required times (K §17).
  - Live at RG3 (K §13.3).
- **Counts and waste:** perpetual counts, shift reconciliation, witnessed waste (R04 §5.7).
- **Offline:** no controlled-drug stock movement (SI-15; K §7.9).
- **Diversion:** R04 says build reconciliation and case management natively, and integrate analytics first (R04 §5.7). K is silent.

### 5.5 eMAR and BCMA specifics (MED-MAR-01, MED-BCM-01)
- **eMAR:** schedules, PRN reassessment, independent double check, titrations.
- **BCMA:** patient and medication scan, override reasons, compliance dashboards, offline cache (R14 App. A).
- **Loop:** CPOE → verify → dispense → eMAR → BCMA → documentation → pump (P2) (R04 §5.5).
- **Offline BCMA** (K §6.6; BP SI-15):
  - the cache is encrypted;
  - administration is allowed only against orders verified before the outage;
  - offline commands are revalidated by the server;
  - no last-writer-wins merges;
  - notifications carry no PHI.
- **Scanning scope** (R04 §5.5):
  - beyond inpatient wards: ED, OR, infusion, dialysis, radiology, L&D, cath lab (BP18);
  - tranexamic acid checks in surgical and OB areas (BP20);
  - proactive scanning of new products and wristbands (BP24);
  - perioperative labels printed at the anaesthesia workstation.
- **Rollout:** site-wide only, never unit by unit (K §13.1; RL #11).
- **Overrides:** reasons are never defaulted (SI-02).
- **High-alert medicines:** documented independent double check (SI-13).
- **Performance:** BCMA p95 ≤500 ms (K §17).
- **Rollback:** a Level-3 trigger fires if BCMA is down >4 h across units (K §13.3).

### 5.6 ADC (P2, integrate; MED-ADC-01)
- **Feeds to the ADC:** ADT, profiled orders (RDE) and formulary master files, over HL7 v2.
- **Feeds back:** dispense, waste, return, discrepancy and charges. Vendors add proprietary segments.
- **Ownership:** pharmacy owns the profile; the ADC owns the hardware and local inventory (R04 §5.3).
- **ISMP's 9 core processes,** including profiled cabinets with override monitoring.
- **Overrides:** a limited override list with retrospective pharmacist and nurse-manager review (BP16). A policy defines which overrides are reviewed and how often; 100% review is not required.
- **Downtime:** an ADC downtime override policy (R04 §11 #13).

### 5.7 Pumps (P2; MED-INF-02)
- **K constraints:**
  - one vendor;
  - **orders, never commands**;
  - only once BCMA ≥95% (K-09, K §5.7).
- **Activation:** the vendor's intended-use letter. Fallback: manual programming with a BCMA scan (K §5.6).
- **Workflow** (R04 §11 #10):
  - one scan sequence: patient → bag → pump channel;
  - PIV (PCD-03) and IPEC (PCD-10) via the vendor gateway;
  - one-click acceptance of pump-documented volumes;
  - DERS and autoprogramming compliance reported per unit, monthly.
- **ISMP BP8:**
  - DERS compliance >95%, monitored monthly;
  - separate bolus and continuous limits;
  - bidirectional interoperability;
  - resourcing for library maintenance.
- **Why autoprogramming must be easy:** without design attention, adoption stalls at about half of infusions (53.4% observed) (R04 §6.6, §11 #10).
- **MVP:** MED-INF-01 ships the infusion data model, pump-channel association and manual rate/volume validation (R14 App. A; R04 §11 #15).

### 5.8 Chemotherapy (P2), IV compounding and TPN (P3)
- **Chemotherapy (MED-ONC-01)** (R04 §5.4):
  - regimen library with cycle/day plans;
  - BSA and AUC (Calvert) calculations and dose rounding (C13);
  - cumulative-dose tracking;
  - independent nursing and pharmacy double checks;
  - closed-system transfer devices;
  - metric weights.
- **MED-IV-01 (P3)** covers IV compounding and TPN, plus IVWMS interfaces (R14 App. A; K §4.3).
  - IVWMS components: ingredient barcodes, step images, gravimetric checks, remote checking, labels (R04 §5.4).
  - PN: standard templates, compatibility and limit checks, compounder interface (R04 §5.4).

### 5.9 Antimicrobial stewardship
- **MVP control set** (K §5.2):
  - restricted antimicrobials need an indication and an approver, at order entry or at transcription;
  - a mandatory 48–72 h time-out task;
  - a stop or review date on every antimicrobial order;
  - a monthly DDD/DOT report from dispensing data;
  - a stewardship lead named at RG1.
- **P2 module (CLN-AMS-01)** (R04 §5.10):
  - approval workflow;
  - IV-to-PO and dose-optimisation prompts;
  - bug–drug mismatch alerts that combine microbiology and the MAR;
  - antibiogram shown at order entry;
  - cascade-reporting coordination;
  - DOT per 1,000 patient-days.

### 5.10 Med rec and clinical pharmacist
- **Med rec** (R04 §5.8; SI-09):
  - admission list, comparison, discrepancy resolution, written discharge list;
  - at every level-of-care transition (BP21);
  - cannot complete while any item is undecided;
  - the seam medication list is reconciliation input only (K §13.1d).
- **Clinical pharmacist** (R04 §5.11):
  - patient lists with risk scores;
  - intervention documentation;
  - TDM and renal protocols;
  - anticoagulation reversal and perioperative protocols, preferring unit-dose and prefilled products;
  - discharge counselling;
  - pharmacokinetic dosing (C13).

### 5.11 State/lifecycle
- **Medication order:** draft → active → pending verification → verified. An emergency or first-dose override is possible (R11 §10.2).
- **Administration per dose** (R11 §10.3):
  - scheduled (due) → in-progress → completed | not-done (held/refused/missed, with reason) | stopped | entered-in-error;
  - late-dose windows are configurable (e.g. ±30/60 min), tighter for time-critical drugs.
- **Dispense:** no source state machine. ADC events are dispense, waste, return and discrepancy (R04 §5.3).
- **Patient-supplied medicine:** received → identified → expiry-checked → relabelled → flagged → scannable (K §12.1).

### 5.12 Interfaces (see §8)
- **HL7 v2:** RDE/RDS/RAS (+RGV) and MFN (K §9; R04 §9).
- **FHIR:** Medication, MedicationRequest, MedicationDispense, MedicationAdministration.
- **GS1:** FNC1 preserved (K §9.2).
- **ATC/DDD.**
- **Product model:** orderable → clinical drug → package → lot/serial (R04 §5.9), extended by the brand master (K §8).

### 5.13 Safety
- SI-01, -02, -05, -09, -12, -13, -14, -15, -16, -18, -19; H2.
- Static analysis fails the build if dose arithmetic appears outside the Dose Engine (K §5.5).

### 5.14 KPIs (K §5.2, §17; R04 §10)

| KPI | Target |
|---|---|
| BCMA patient and drug scan | ≥95% at 90 days; ≥98% at 12 months; 100% unit coverage |
| Extended double-check completion | 100% |
| Queue without a logged-in pharmacist >30 min | 0 |
| Pre-verification doses reviewed ≤4 h | 100% |
| Time-critical doses delayed by payment | 0 |
| Interruptive alerts per 100 orders | ≤8 at go-live; ≤5 at 12 months |
| Statutory registers on time | 100% |
| Verification TAT | STAT ≤15 min; routine 30–60 min (est.) |
| Med-rec completion | ≥95% (est.) |
| CS discrepancies resolved | 100% within 24 h (est.) |
| DOT/DDD per 1,000 patient-days | Trend |
| ADC override review | Per policy (P2) |
| DERS compliance | >95% monthly (P2) |
| Autoprogramming | Per organisational goal (P2) |
| Error/ADE rate | Trend; never the sole safety metric (BP25) |

### 5.15 Build/buy/integrate (R04 §8.2; K §4.3)
- **Build:** pharmacy core.
- **License:** drug KB.
- **Integrate:** ADCs, robots, IVWMS, compounders.
- **Integrate first:** diversion analytics.
- **Pumps:** via the vendor gateway.

---

## 6. Medical device integration

**Kurdistan phase** (§0; K §4.2–4.3, §9.2)
- **MVP:** the gateway with association, auto-dissociation and nurse validation. R2b: ICU flowsheet with nurse-validated vitals. R2.1: validated ICU monitor feed.
- **P2:** ACM; RTLS ingestion.
- **P3:** alarm analytics.
- **Never:** alarm forwarding; nurse-call and RTLS engines; pneumatic tube.

**Must-have functional requirements**
- **Middleware provides** (R04 §6.3):
  - drivers and serial-to-network bridges;
  - association by barcode or location;
  - normalisation to PCD-01;
  - store-and-forward.
- **We build** (R04 §11 #11; DEV-GW-01, DEV-VAL-01):
  - the PCD-01/DEC consumer;
  - a validation UX with artifact marking;
  - association with auto-dissociation;
  - a raw high-frequency store.
- **Placement:** an analyzer and monitor bridge on the on-site cell or edge agent, with one VLAN per device class (K §9.2 plane B).
- **Association** (R04 §6.4; BP §5.1 acceptance criteria):
  - scan-to-associate;
  - auto-dissociation on discharge or transfer;
  - the associated patient is shown on the device or gateway;
  - audit trail.
- **Validation** (R04 §6.4; K §6.5):
  - data lands **unvalidated** at a configurable granularity: 1 min in anaesthesia, 15 min in ICU, on demand on wards;
  - the nurse validates, marks artifacts, or edits with a reason;
  - only validated values are chartable and feed EWS and CDS;
  - raw streams are kept separately;
  - "device vitals are validated, not transcribed."
- **NEWS2** uses nurse-validated observations. Under the fallback, the nurse sets observation frequency, never a score (K §4.3, §5.6).
- **Nurse call:** care-team assignment feeds nurse call (K §9.2). The HMS feeds ADT and staff assignment to nurse-call and ACM platforms and consumes their acknowledgements (BP §9.2).
- **Device classes and cadence** (R04 §6.1):
  - monitors (vitals, waveforms): down to ~1 min;
  - ventilators: 1–15 min;
  - anaesthesia machines: continuous;
  - pumps: event-driven;
  - others (dialysis, glucometers, ECMO): varies.

**Lifecycle** (R04 §6.4)
- **Association:** associated (scan) → auto-dissociated (discharge or transfer).
- **Observation:** unvalidated → validated, artifact, or edited (reason).

**Interfaces** (R04 §6.2, §9)
- **Mandatory:** IHE DEV TF Rev 10.0 (Nov 2024) DEC, PCD-01 (HL7 v2 ORU); IEEE 11073-10101 MDC; RTM.
- **P2:** ACM PCD-04 to PCD-07; PIV PCD-03; IPEC PCD-10.
- **Other:** IDCO; PCIM (emerging).
- **SDC/SDPi:** roadmap only. FDA says SDC conformance alone does not demonstrate safety (R04 §6.2).

**Safety**
- **The HMS is never in the primary alarm path.** Alarm forwarding is never built; integrate ACM platforms (K §9.2, §5.6).
- **No device-stream deterioration alarms** (BP §5.7; RL #6).
- **Association errors are the key risk** (R04 §6.4).
- **Registration check:** S16-K checks whether handhelds, scanners or pumps need registration (K §5.6).
- **Cybersecurity** (R04 §6.7, §11 #12; K §5.4):
  - ship our own SBOM;
  - a device inventory correlating SBOM, MDS2 and vulnerabilities;
  - IEC 80001-1;
  - segmentation and zero-trust gateways;
  - IEC 81001-5-1.

**KPIs (R04 §10)**
- ICU auto-capture ≥90% (est.).
- Device → flowsheet latency <1 min (est.).
- Alarms per bed per day: downward trend (P3).
- SBOM on file for new purchases: 100%.

**Stance.**
- **Integrate** the middleware (Capsule, Bernoulli, Masimo Iris, GE CARESCAPE, Oracle CareAware [AK]) and alarm secondary notification.
- **Build** the consumer, validation and association (R04 §8.2).
- Overall B + I (K §4.3).

---

## 7. Other ancillaries (one line each)

| Ancillary | Kurdistan phase | Key content (refs) |
|---|---|---|
| POCT | P2 (I), DX-POC-01 | Integrate a POCT01 data manager (IHE LPOCT). Build result filing, critical documentation with a named-recipient picker, and competency views. Operator and QC lockouts; wristband ID plus an unmatched-result queue; reagent lots. KPIs: competency 100%; unmatched → 0 (R04 §7.1, §10; K §9) |
| ECG/cardiology and endoscopy reports | P2 (I), DX-CRD-01 | ECG and endoscopy report integration (R14 App. A). Orders and report display; DICOM waveform, HL7 aECG, SCP-ECG (R04 §4.8, §8.2). R04 also lists scope-reprocessing traceability (R04 §4.8, §7.2) |
| CSSD | P2 "CSSD-lite" | Light set-and-load tracker. The OR links set and load IDs to the case. UDI/GS1 DataMatrix gives patient-to-load recall trace (R04 §7.2; K §4.3) |
| Dietary | MVP: diet orders with religious preferences | R04 adds NPO, therapeutic diets, IDDSI 0–7, allergy propagation, tray tickets with allergen warnings, HL7 v2 OMD and FHIR NutritionOrder. K phases only the diet orders (R04 §7.3; K §4.3) |
| Rehab/physio (PT/OT/SLP) | P2 | Build: referral, evaluation, plan of care, notes, scheduling (R04 §7.4; K §4.3) |
| Dialysis | P3 | Build documentation; machines via MDI (PCD-01); in-unit BCMA; water-treatment logs to ISO 23500 (R04 §7.5; K §4.3) |
| Oncology/chemotherapy | P2 | See §5.8 |
| NICU human-milk tracking | P2 | (K §4.3) |
| Respiratory therapy | Not in K | R04: build; ventilators via DEC; ABG POCT (R04 §7.6) |
| Ultrasound/POCUS | With RIS | DICOM SR measurements; EBIW (R04 §4.8) |

---

## 8. Standards and interfaces reference (R04 §9, condensed)

| Area | Standard | Status for our build |
|---|---|---|
| Lab orders/results | HL7 v2.5.1 OML/ORM, ORU/OUL; IHE PaLM LTW | Mandatory |
| Analyzers | IHE LAW / CLSI AUTO16 Ed2 (target); ASTM E1381/E1394 = LIS01-A2/LIS02-A2 via middleware | Mandatory |
| Lab automation; code-set sync | IHE LDA; LCSD | Optional |
| Specimen labels; tracking | IHE LBL; SET | Recommended |
| POCT | CLSI POCT01; IHE LPOCT, via a data manager | P2 |
| Lab semantics | LOINC (LIVD-seeded), UCUM, SNOMED CT (Global Patient Set default) | Mandatory |
| Lab report sharing | IHE XD-LAB; FHIR DiagnosticReport | Recommended |
| Autoverification guidance | CLSI AUTO10-A, AUTO15 | Guidance |
| AP synoptic | SDC XML (CAP eCP licensed; ICCR); IHE APSR | P3 |
| Digital pathology | DICOM WSI (Sup 145); IHE DPIA | Not phased |
| Blood product coding | ISBT 128 ST-001 v6.2.2 + RT019/RT038 | P2 labelling |
| Bedside transfusion messaging | IHE PaLM TMA | Optional |
| Imaging workflow | IHE SWF.b (OMI + MWL/MPPS/Storage Commitment) | Mandatory |
| Imaging web | DICOMweb QIDO/WADO/STOW/UPS-RS | Mandatory |
| Image launch | IHE IID | Mandatory |
| Image sharing | XDS-I.b; MADO; WIA; EBIW | Recommended |
| Reporting context | IHE IRA (FHIRcast) | Recommended |
| Dose | DICOM RDSR; IHE REM | P2 |
| Structured imaging content | DICOM SR; RadLex; LOINC/RSNA Playbook; RadReport (MRRT); ACR RADS | Recommended |
| Imaging AI | AIW-I, AIR, AIRA | P3 |
| ECG | DICOM waveform; HL7 aECG; SCP-ECG | P2 (I) |
| Medication coding | GTIN; ATC (WHOCC licence); SNOMED CT; regional brand master | Mandatory |
| Pharmacy messages | HL7 v2 RDE/RDS/RAS/RGV, MFN; FHIR Medication* | Mandatory |
| Device data | IHE DEV DEC (PCD-01); IEEE 11073-10101; RTM | Mandatory |
| Alarms | IHE DEV ACM (PCD-04 to PCD-07) | P2 |
| Pumps | IHE DEV PIV (PCD-03), IPEC (PCD-10) | P2 |
| Plug-and-play | ISO/IEEE 11073 SDC; IHE SDPi | Roadmap |
| Device identification | UDI / GS1 / HIBCC / ICCBBA | Mandatory |
| Device cybersecurity | SBOM, MDS2, IEC 80001-1 | Mandatory (procurement, governance) |
| Lab quality | ISO 15189:2022 (the only edition since 6 Dec 2025) | Aligned |
| Hospital accreditation | JCI 8th edition (IPSG.1–3, MMU) + KRG checklists, replacing TJC NPGs | K §5.8 |

---

## 9. Conflicts, gaps and ambiguities

Precedence is K > BP > R04.

| # | Topic | Conflict or gap |
|---|---|---|
| C1 | Rules engine | R04 §1 and §11 #2 put autoverification in one shared rules engine. K-06 and K §5.5 (BP §5.5) make LIS interpretive rules Tier 2 and process-isolated, with **no rules engine inside the device boundary**. No source says which LIS rules may stay shared; RL is silent |
| C2 | Relabel scope | K-08 relabels only "units without a usable barcode". The K SI-11 note and K §4.3 relabel at receipt with no qualifier. Q-K14's default: "relabel at receipt" |
| C3 | Blood-bank interface | RL #5, R04 §8.2, BP §4.3 and R14 (DX-BB-02, MVP) have an HL7 blood-bank interface. K §9.1 assumes none, yet K §4.1 does not drop DX-BB-02. Quarantine therefore sits in our system (K SI-11, §9.2), not the external one (BP §5.7) |
| C4 | Micro and AP interfaces | R04 §11 #15 and RL #4 put these interfaces in the MVP. K §4.3 has no MVP interface (microbiology P2, AP P3). Reference-lab send-outs (K §9.1) are the only stated path |
| C5 | Pump interoperability | R04 §9 says PIV/IPEC is "Mandatory (ISMP BP8)". RL #4 and K-09 place it in P2: one vendor, only once BCMA ≥95% |
| C6 | Compatibility engine | BP §4.3 had a P3 IVD-grade engine (BP "03b"). K §4.3 says it is never built. R04 §3.2's electronic crossmatch is therefore out. Under BP's 03a/03b split, DX-BB-03's "crossmatch" scope (R14 App. A) falls into 03b, so it is not part of K's P2 |
| C7 | Diagnostic viewer | BP §4.3 and §5.6 name a cleared partner viewer for reporting. K repeats only "open-source viewer labelled non-diagnostic" (K §4.3, §5.6). K §16.5 lists a "PACS partner plus an open-source tier" |
| C8 | Autoverification timing | BP §4.3 and R14 (DX-LAB-03) put autoverification v1 in R1. K §4.2 and §5.6 put it in R1.1, after the local opinion |
| C9 | Dose capture | DX-RIS-03 is P2 in R14 App. A and BP §4.3. K §4.3 is silent but inherits it, because K §4.1 changes the backlog only through its table |
| C10 | Transfusion-service steps | K does not say where crossmatch testing happens, how its result is recorded, or whether the two-sample ABO rule (R04 §3.1 #1), MTP, returns or PBM are in T1. Q-K14 is open until M12. Our system never computes compatibility (K §5.7) |
| C11 | Label formats | Barcode symbology and content are unspecified for the receipt relabel and the in-house unit-dose labels (K SI-11; MED-KRI-01). ISBT 128 labelling is P2. Whether incoming units carry ISBT 128 is Q-K14 |
| C12 | Haemovigilance reporting | R04 §3.4 assumes national systems. K §5.3: no vigilance channel is known in Kurdistan; notify the KRG Ministry if one exists (Q-K4) |
| C13 | Dose arithmetic | Chemotherapy BSA/AUC (R04 §5.4) and pharmacokinetic dosing (R04 §5.11) are dose arithmetic. They may live only in the Dose Engine (K §5.5; SI-05), which is P2, as is MED-ONC-01 |
| C14 | Witness count | R04 §3.4 cites Oxford cutting from two nurses to one. K SI-11 requires a two-person electronic witness. K governs |
| C15 | Middleware alarms | R04 §6.3 says middleware sometimes forwards secondary alarms. K: alarms never built; ACM consumer only, in P2; never in the primary alarm path (K §4.3, §9.2) |
| C16 | SDC | R14 App. A (DEV-SDC-01) and BP §4.3 list SDC at P3. K §4.3 omits it. R04 §6.2: roadmap only |
| C17 | BCMA target | R04 §10 (Leapfrog) says ≥95%. K §17 says ≥95% at 90 days and ≥98% at 12 months. K governs |
| C18 | Pneumatic tube | R04 §2.2 #3 tracks pneumatic-tube transport. K §9.2 marks pneumatic tube "Never", so specimen tracking is scan-event based |
| C19 | Lab-quality pack | K §4.1 undoes BP's NABL upsizing of DX-LAB-04 (QC and lot tracking, back to M). Yet K §4.3 keeps a lab-quality pack (EQA, rejection register, amended-report audit, TAT per test) without naming its feature. DX-LAB-06 (ISO 15189 document control and risk register) is P3 in R14 and P2-conditional in BP §4.3; K says only "ISO 15189-aligned" |

---

## 10. Dropped for Kurdistan (generic pattern kept where noted)

- **US rules:**
  - BECS 510(k); the LDT rule;
  - CLIA rules and retention (QC frequency kept, configurable);
  - CAP (critical-result documentation pattern kept);
  - TJC NPGs (JCI pack instead, K §5.8);
  - MQSA (hard-stop template elements kept);
  - CMS ExRad/AUC;
  - NHSN AUR/SAAR (single stewardship dataset kept);
  - DSCSA/EPCIS;
  - NCPDP SCRIPT/EPCS, Surescripts, 340B;
  - USP <797>/<800> as law (IVWMS pattern kept, P3);
  - X12 EDI;
  - FD&C §524B (SBOM and cyber practice kept).
  - Refs: R04 §2.11, §3.5, §4.7, §5.6–5.8, §6.7.
- **Other markets:**
  - England's dm+d and EPS; RxNorm/NDC;
  - ABDM; NABL specifics; India's e-RaktKosh;
  - SFDA RSD/Tatmeen (MED-TNT-01); CDSCO;
  - Schedule H1/X and NDPS forms; MRP/NLEM-DPCO checks;
  - PCPNDT Form F;
  - national e-Rx (MED-ERX-01).
  - Refs: K §2, §4.1, §4.3; BP §4.3.
- **EU SoHO Regulation:** export reference only (R04 §3.5).
