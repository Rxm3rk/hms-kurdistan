
### 9.7 Diagnostics shared services: one order lifecycle and the critical-result service

**Release:** R1 (the wedge carries this platform). **Features:** `DX-ORD-01` (L), `DX-CRT-01` (M). **Modules:** `orders`, `results`, `platform-tasks`. **Read:** R04 §1, §11; R11 §10.2, §10.5; K SI-04.

**Build:**
- **One lifecycle** shared by lab, radiology, transfusion and pharmacy (and POCT and cardiology in P2): order → identify (patient plus specimen, unit, exam or dose) → perform → result or document → verify → notify and acknowledge → bill → analyse. Every step is a timestamped event (order, collect, dispatch, receive, accession, start, result, verify, notify, acknowledge), so turnaround-time KPIs come out of the box.
- **Five shared services** (R04 §1):
  - *identity and barcode:* wristbands with ≥2 identifiers; IHE LBL specimen labels; one ISBT 128 parser and validator; GS1 GTIN, lot, expiry and serial; UDI; every scan is an immutable event with user, device, location and time;
  - *rules:* non-device decision tables, versioned, effective-dated, with simulation and replay against history, an approval workflow and audit (ADR-017). Anything that releases a result without human review or interprets it belongs to a Tier 2 sidecar (`reg-lis-rules`), not this engine;
  - *closed-loop notification:* the critical-result service below;
  - *worklists:* one task primitive with domain views (collection lists, accession queues, bench worklists, reading worklists, verification queues);
  - *device and instrument gateway:* one ingestion tier (HL7 v2, ASTM via middleware, DICOM, later POCT01), with store-and-forward, clock sync and device–patient association.
- **"Scan, don't type."** Every override of a failed scan is a reportable event (SI-02).
- **The critical-result service** (SI-04):
  - policy tables per test or analyte, location and age: threshold, target notification time and escalation chain (ordering → covering provider → charge nurse → rapid response). Thresholds are governed content approved by the lab director and CSO [HUMAN];
  - channels: secure chat; phone with read-back capture; inbox with acknowledgement;
  - the recipient is **picked from the directory, never typed** ("RN notified" fails); read-back is recorded when phoned; electronic delivery counts only with confirmed receipt;
  - unacknowledged results escalate automatically on calendar-aware timers; a dashboard shows performance against policy;
  - **external referring doctors** of outpatient-tier patients are first-class recipients, with the same record and read-back logger;
  - the record holds date, time, the responsible lab person, the traceable recipient, the result and the read-back.
- **Designed downtime per ancillary:** label printing with downtime accession ranges; cached modality worklists; offline BCMA; a read-only cached MAR (R04 §11 #13).

**Acceptance (minimum):**
1. Every diagnostic order reaches a terminal state; anything unowned raises `TaskOrphaned` within 5 minutes (SI-03).
2. A critical result cannot be closed without a directory-picked recipient, and a phoned result cannot be closed without read-back.
3. Escalation fires on the configured timers in scenario tests with a simulated clock, including weekends and holidays.
4. Turnaround for every step is computable from events for 100% of orders.
5. External-referrer notification works end to end for outpatient-tier results, including during the outpatient lab downtime protocol (phone with read-back logged on the edge agent, back-entry within 4 h).

### 9.8 Laboratory information system (LIS)

**Release:** R1 core; R1.1 autoverification where the Boundary Register allows (manual technologist validation until then, with delta and critical rules as flags only); P2 microbiology (`DX-MIC-01`) and POCT (`DX-POC-01`, integrate); P3 anatomic pathology (`DX-AP-01`) and ISO 15189 document control (`DX-LAB-06`). **Features:** `DX-LAB-01` (L) worklists, bedside labels, accessioning and tracking; `DX-LAB-02` (L) analysers via middleware; `DX-LAB-03` (L) validation, reports, delta and critical rules, autoverification v1 (Tier 2 part); `DX-LAB-04` (M) QC and lot tracking; `DX-LAB-05` (M) send-outs; the lab-quality pack. **Module:** `lis` (+ `reg-lis-rules`). **Read:** R04 §2; K §4.2, §5.6, §9.1.

**Build:**
- **Pre-analytic:** test catalogue per orderable (specimen, container, minimum volume, stability, priority STAT/ASAP/timed/routine, LOINC order code); ask-at-order-entry questions (fasting, dose time for drug levels); duplicate-order checks; collection lists by unit, collector and time window that consolidate tubes; **bedside collection** on the handheld (scan wristband → print labels on demand → record collector, time and device; labels applied in the patient's presence); labels by tube type and draw order (IHE LBL); transport tracking by scan events (no pneumatic-tube integration); receipt scan with acceptability checks (haemolysis, clotting, insufficient quantity, wrong container, expired stability, unlabelled or mislabelled), a coded rejection reason, and an automatic recollection task to the care team; accessioning with aliquots, routing and storage location for add-ons.
- **Analytic:** host query or download of work orders; results return with instrument flags, QC status, dilutions and reruns; analyser status on the lab workspace; reagent and calibrator lots linked to every result for look-back.
- **Post-analytic:** an exception review queue with the reason highlighted; preliminary, final and corrected reports with a corrected-report trail; reference intervals by age, sex, pregnancy and method; interpretive comments; performing-lab identification; LOINC and UCUM on every result; add-on handling (stability, residual volume, stored tube); reflex rules approved by the lab director; reference-lab send-outs over HL7 v2 or FHIR with PDF fallback, keeping the performing lab's units and ranges; notifiable-disease triggers to the Directorate of Health format.
- **QC:** Westgard rules (1-2s warning; 1-3s, 2-2s, R-4s, 4-1s, 10-x rejection; selection by Sigma metric); Levey-Jennings charts; **QC lockout** (no release while QC has failed or is overdue); patient moving averages; QC frequency configurable per test.
- **Lab-quality pack (ISO 15189-aligned):** EQA enrolment and results; a rejection register; amended-report audit; TAT per test against policy.
- **Autoverification (R1.1, Tier 2, `reg-lis-rules`):** the rule stack in order: instrument error codes and QC status → HIL indices → measurement range and dilution → absurd limits → critical value (to manual review and notification) → delta check → cross-analyte consistency → patient context (dialysis, neonatal, post-transfusion) → release. Each rule has a rationale, validation evidence from simulated and historical cases, a version, and revalidation after any instrument or method change.
- **Patient release:** OTP to the registered mobile plus a knowledge check; single-use link valid ≤72 h; no clinical content in the message body; SI-21-labelled results and pregnancy tests never released by message; every release audited (§9.30).
- **Seam rule (W1-K):** the polyclinic LIS serves only the polyclinic's own patients until hospital A goes live, so a legacy order → our lab → legacy result path never exists (K §13.1c).

**Interfaces:** HL7 v2.5.1 OML/ORM and ORU/OUL (IHE PaLM LTW); analysers through middleware (ASTM E1381/E1394 = CLSI LIS01-A2/LIS02-A2 for legacy; IHE LAW / CLSI AUTO16 as the target, with query mode, echoed AWOS IDs and enhanced acks MSH-15 = NE, MSH-16 = AL); LIVD to seed analyser → LOINC maps.

**Acceptance (minimum):**
1. A specimen cannot be received without a scanned label that matches an order; mislabelled specimens follow the rejection path with a recollection task.
2. No result is released while its analyser's QC is failed or overdue.
3. A corrected result notifies the orderer and everyone who acknowledged the earlier version (R11 §10.5).
4. With autoverification off (the default), every result needs technologist validation; with it on, only results that pass every rule in the stack release, and each release records the rule-set version.
5. Analyser parallel-run tooling compares our results with the legacy path during cutover (K §13.2).

### 9.9 Radiology (RIS) and PACS integration

**Release:** R1 (RIS is in the wedge, KDV-10); P2 dose capture (`DX-RIS-03`) and ECG/endoscopy reports (`DX-CRD-01`, integrate); P3 imaging-AI orchestration. **Never** build a PACS. **Features:** `DX-RIS-01` (L) RIS core; `DX-RIS-02` (M) templates and actionable follow-up; `DX-PAC-01` (M, integrate) PACS link with the open-source viewer labelled non-diagnostic. **Module:** `ris`. **Read:** R04 §4; K §4.2–§4.3, §5.6–§5.7.

**Build:**
1. **Order** with reason and structured indication; duplicate-imaging and prior-study checks.
2. **Protocoling:** protocol, contrast and sedation; CT protocols record indication, contrast, age, size and the expected dose-index range.
3. **Scheduling** by modality, room and resource, with preparation instructions and reminders (trilingual).
4. **Screening at check-in:** MRI safety (implants, devices, foreign bodies, claustrophobia) **with incident capture**; contrast allergy and renal function; pregnancy status.
5. **Modality worklist (MWL):** demographics, accession number, requested procedure; the RIS assigns the Study Instance UID.
6. **MPPS** (in progress / completed / discontinued) drives exam status, technologist documentation, contrast and radiopharmaceutical documentation (dose, lot) and charge capture. Storage commitment confirms archive receipt.
7. **Reconciliation** for trauma and unidentified patients (IHE PIR).
8. **Reading worklist** by urgency, subspecialty and SLA timers, with priors fetched.
9. **Reporting:** structured templates (including RADS families), sign, addenda; measurements and dose auto-populated where available.
10. **Critical and actionable findings** go through the critical-result service (ACR categories: Cat 1 within minutes, Cat 2 within hours, Cat 3 within days).
11. **Incidental-finding follow-up:** recommendation capture, due dates, patient and referrer letters, closure reporting. R04 calls this the biggest gap in many RIS products.
- **Image access:** IHE IID launch from the chart; DICOMweb (QIDO-RS, WADO-RS, STOW-RS); the bundled OHIF viewer always shows a "non-diagnostic" banner; never couple to a proprietary PACS API.

**Interfaces:** IHE SWF.b (HL7 v2 OMI, DICOM MWL, MPPS, Storage Commitment); DICOMweb; IID; FHIR DiagnosticReport and ImagingStudy projections; DICOM SR for measurements.

**Acceptance (minimum):**
1. MWL use ~100% and orphan studies at zero in the integration test bed (a modality simulator plus an Orthanc or dcm4chee container).
2. MRI cannot be marked "screened" without a completed safety screen; an incident can be captured from the exam.
3. A Cat 1 finding follows the critical-result path with a named recipient and read-back.
4. Every incidental-finding recommendation has a due date, an owner and a closure state.

### 9.10 Medication management: formulary, pharmacy, eMAR and BCMA

**Release:** R1 formulary, brand master, outpatient e-prescribing and the outpatient pharmacy POS; R2a inpatient dispensing against transcribed paper orders (control sets B and C); **R2b the closed loop** (CPOE → pharmacist verification → dispensing → eMAR → BCMA, with control set A, and control set C at order entry); P2 Dose Engine, stewardship module, pumps, ADC and chemotherapy; P3 IV compounding. **Features:** `MED-FRM-01` (M) formulary with LASA, tall-man and high-alert flags; `MED-KRI-01` (M) regional brand master and in-house unit-dose labels; `MED-OPP-01` (M) outpatient pharmacy POS; `MED-CS-01` (M) Iraqi narcotics registers; `MED-DSP-01` (L) inpatient dispensing; `MED-PHV-01` (L) pharmacist verification; `MED-MAR-01` (L) eMAR; `MED-BCM-01` (L) mobile offline BCMA; `MED-INF-01` (M) infusion model. P2: `MED-DOSE-01`, `CLN-AMS-01`, `MED-INF-02`, `MED-ADC-01`, `MED-ONC-01`. P3: `MED-IV-01`. **Modules:** `medications` (Safety Kernel), `reg-screening`, `reg-dose` (P2). **Read:** R04 §5; R03 §9; K §4.2, §5.1, §5.6, §8, §12.1.

**Formulary and the regional brand master (R1):**
- Formulary items with LASA, tall-man and high-alert flags; ISMP display rules (no trailing zeros, no naked decimals); P&T status and restrictions (for example antimicrobials needing approval); therapeutic interchange; standardised concentrations; shortage substitution.
- **Regional brand master:** brand → clinical drug → generic and ATC → package GTINs → lot, plus the licensed drug-KB concept. Several GTINs map to one orderable. New products are scan-tested before use. Coverage KPI: unmapped formulary ≤5% at T-90. There is no national drug file [L].
- Typo-tolerant brand↔generic search across regional brands.
- **Drug knowledge base: licensed, never built.** A vendor-neutral adapter (`CLN-CDS-01`) with local re-tiering and regional brand mapping; a synthetic mock KB for development and tests (Q-K8). K first uses the adapter at R2a transcription; this prompt brings `CLN-CDS-01` and the outpatient subset of `CLN-CDS-02` (allergy, interaction, duplicate and dose-range screening shown verbatim) forward to **R1**, because outpatient e-prescribing without screening is unsafe [P]. Record the change in `OPEN-QUESTIONS.md`.

**Outpatient pharmacy POS (R1):** retail sale with batch and expiry; dual-currency payment (§9.21); price checks against KRG price lists if they exist [L]; narcotics registers; stock decrement and charge in one event; labels in the patient's language with drug names in Latin script.

**In-house unit-dose labels:** for imported drugs without a usable barcode, pharmacy prints unit-dose barcode labels that link to the brand master and lot. Label printing is a pharmacist workspace tool.

**Screening (`reg-screening`, Tier 2 presenter):** allergy and cross-sensitivity; drug–drug, drug–disease and duplicates; dose range by measured weight and BSA; renal and hepatic adjustment; pregnancy and lactation; paediatric and neonatal ranges; IV compatibility. KB output is shown verbatim. Alert tiers A–D (§14.3). Safe-regimen defaults: weekly oral methotrexate; vinca alkaloids in minibags only; opioid-tolerance check before extended-release opioids.

**Inpatient dispensing under the Core transcription control set (R2a):** control set B (§10.3) exactly, plus control set C (stewardship) and the patient-supplied medicine workflow. The screen is labelled "dispensing record, not an order or MAR". No MAR or schedule exists at a Core site.

**Pharmacist verification (R2b):** a queue ranked by STAT, first dose, high-alert and time due, with a STAT ≤15-minute timer; interventions with outcome codes; control set A (extended Dose Engine fallback) exactly as §10.3; the pharmacist-cover alarm; emergency and first-dose override paths with retrospective review within 4 h.

**Dispensing:** unit dose or ward stock; returns; charge on dispense or on administration per tenant configuration; perpetual stock across central pharmacy and satellites; GS1 DataMatrix at receipt populates lot and expiry for recalls; FEFO.

**Patient-supplied medicines (R2a onward):** received by pharmacy → identified against the brand master → expiry-checked → relabelled to the patient → flagged "patient-supplied" → only then scannable for administration (SI-12).

**Controlled drugs:** locked, append-only registers (corrections are addenda); perpetual counts; shift reconciliation; witnessed waste; no controlled-drug stock movement offline (SI-15).

**eMAR and BCMA (R2b):**
- eMAR: schedules generated from verified orders; PRN with reassessment tasks; titrations; independent double check for high-alert drugs (SI-13); late-dose windows configurable (tighter for time-critical drugs); holds, refusals and missed doses with reasons.
- BCMA: scan patient wristband and medication (GS1 or in-house label) → five-rights check against the verified order → document. Overrides need a reason that is never defaulted (SI-02). Compliance dashboards by unit and user. BCMA p95 ≤500 ms.
- **Mobile offline BCMA:** an encrypted cache; administration only against orders verified before the outage; server revalidation on reconnect; no last-writer-wins. A dose given offline against an order that was discontinued meanwhile is recorded as a fact and flagged to the prescriber and pharmacist as an owned task (SI-15; §15).
- **Time-critical doses** (STAT and first doses, antimicrobials, insulin, anticoagulants, anticonvulsants) can never be delayed by any payment, deposit or counter rule; they are charged to the running bill (SI-12).
- Scanning extends to ED, OT, recovery, labour and delivery and NICU.
- **Rollout is site-wide only, never unit by unit** (K §13.1). The facility-level clinical tier setting (§6.6) enforces this: the closed loop switches on for the whole facility or not at all.

**Infusion model (`MED-INF-01`, MVP):** infusion orders with rate, volume and concentration; pump-channel association recorded manually; manual rate and volume validation. Pump autoprogramming is P2 (`MED-INF-02`, one vendor, orders never commands, only once BCMA ≥95%).

**Medication reconciliation (R2b, `CLN-MRC-01`):** admission list, comparison, discrepancy resolution and a written discharge list at every level-of-care transition; cannot complete while any item is undecided (SI-09); at an upgrade, transcribed orders and seam medication lists are reconciliation input only.

**P2 and P3:** the Dose Engine (§10.4); the stewardship module (approval workflow, IV-to-PO prompts, bug–drug mismatch alerts, antibiogram at order entry, DOT per 1,000 patient-days); ADC integration (HL7 profiles and formulary to the cabinet; dispense, waste, return and discrepancy back; override review policy); pump integration (IHE PIV, IPEC via the vendor gateway; DERS compliance >95%); chemotherapy (regimens, cycles, cumulative dose, double checks; all BSA/AUC arithmetic inside the Dose Engine); IV compounding (P3).

**Acceptance (minimum):**
1. Property tests: no administration without an active verified order or a documented override (SI-02); high-alert administration impossible without a recorded independent double check (SI-13); offline administration impossible against an order not verified before the outage (SI-15).
2. Control set A: verification of a weight-, BSA-based, high-alert-infusion or neonatal order cannot complete without the pharmacist's independently entered dose and attestation; a mismatch returns the order; seeded 10× errors are stopped.
3. Control set B: no screen at a Core site shows a MAR, schedule or active-medicines list built from transcriptions (UI and API tests).
4. A payment hold on the account never blocks a time-critical dose (property test across the RCM ↔ MAR boundary).
5. An unverified outside medicine cannot be scanned for administration.
6. Static analysis proves no dose arithmetic exists outside `reg-dose` (which is absent in the MVP).
7. The CPOE error-category harness (§18.5) runs on the foundation content; interruptive alerts ≤8 per 100 medication orders on the synthetic replay.

### 9.11 Transfusion

**Release:** R2b. **Features:** `DX-BB-01` (M, Tier 2 part) bedside verification, orders, consent, reactions; `DX-BB-KRI-01` (S) blood-unit receipt and relabelling; `DX-BB-02` blood-bank interface (built as an optional inbound adapter; not assumed, because public blood banks issue on paper [L]); P2 `DX-BB-03a` blood-centre inventory and ISBT 128 labelling (regulated track; `DX-BB-03b`, the compatibility engine, is dropped). **Never:** a compatibility engine, electronic crossmatch, ABO-compatibility assignment or donor workflows. **Modules:** `transfusion`, `reg-transfusion`. **Read:** R04 §3; K SI-11, §5.6; Q-K14.

**Build:**
- **The loop as timed events:** consent → bedside-labelled sample (WBIT detection: a second concordant ABO/Rh determination, historical or from a second sample, configurable) → request → issue → two-person bedside verification → vitals timers → reaction → haemovigilance.
- **Receipt and relabel (default: every unit is relabelled at receipt, the safer reading of K-08 vs SI-11; record the choice in `OPEN-QUESTIONS.md`):** two-person **blind double entry** of unit number, ABO/Rh, product and expiry from the original label and the issue note; the original label is never covered; the new label prints unit number and ABO/Rh beside our barcode; any mismatch quarantines the unit; fridge temperature excursions (building signals) quarantine units.
- **Crossmatch results** from the issuing blood bank are recorded as entered results with their source document; our system never computes compatibility.
- **Bedside verification (T2, `reg-transfusion`)** runs inside the BCMA flow: wristband ↔ unit ↔ order ↔ sample match; two-person electronic witness; hard stop on mismatch; the witness confirms the unit number on the original label.
- **Fallback until T2 is activated:** the scripted two-person check (§10.3).
- Special-requirement flags (irradiated, CMV-safe, washed), returns under time and temperature rules, final disposition and reaction workup are workflow steps whose content the hospital configures [HUMAN].
- One shared ISBT 128 parser and validator (data identifiers, check characters) for future labelled units.

**Acceptance (minimum):** a unit cannot be issued or administered without a matching relabel record and two witness signatures; any field mismatch at receipt quarantines; any identifier mismatch at the bedside is a hard stop; relabel errors are measurable (target 0); WBIT per 1,000 samples is reported.

### 9.19 Devices and vitals integration

**Release:** R2.1 (the validated ICU monitor feed). In R2b the ICU flowsheet and ward vitals are nurse-entered, so nothing clinical depends on a device feed before R2.1. P2 IHE ACM consumer and RTLS ingestion (`OPS-RTL-01`); P3 alarm analytics (`DEV-ALM-01`) and SDC (`DEV-SDC-01`). **Never:** alarm forwarding, a nurse-call or RTLS engine; the HMS is never in the primary alarm path. **Features:** `DEV-GW-01` (L) device gateway via middleware with device–patient association; `DEV-VAL-01` (M) nurse validation UX. **Module:** `hub` (gateway) and `nursing`/`icu` (validation). **Read:** R04 §6; R16 §3; K §9.2.

**Build:**
- Consume IHE DEC PCD-01 (HL7 v2 ORU) from vendor middleware, normalised to IEEE 11073-10101 terms; store-and-forward.
- **Association:** scan-to-associate a device to a patient; automatic dissociation on discharge or transfer; the associated patient shown; full audit.
- **Validation:** device data lands unvalidated at a configurable granularity (≈15 min in ICU, on demand on wards); the nurse validates, marks artefacts or edits with a reason; **only validated values are charted and feed scores and CDS**; raw streams are kept separately and summarised, never one row per data point.
- Care-team assignment and ADT feed nurse-call and ACM platforms (P2 consumer of their acknowledgements).

**Acceptance:** no unvalidated device value appears on a flowsheet, in NEWS2 or in CDS; dissociation on transfer is automatic and tested; device → flowsheet latency <1 minute in the test bed.

### 9.33 Other ancillary services

| Service | Phase | Scope |
|---|---|---|
| Dietary | R2b (`SPC-DIE-01`) | Diet orders with religious preferences, NPO, therapeutic diets, allergy propagation to tray tickets; patient charges for extras. Diet kitchen operations in P2 (`ERP-SVC-01`) |
| POCT | P2 (integrate, `DX-POC-01`) | POCT01 data manager; result filing; operator and QC lockouts; unmatched-result queue |
| ECG and endoscopy reports | P2 (integrate, `DX-CRD-01`) | Orders and report display; DICOM waveform / HL7 aECG |
| CSSD-lite | P2 (`ERP-SVC-01`) | Set and load tracking; OT links set and load IDs to the case; recall by load |
| Rehabilitation (PT/OT/speech) | P2 (`SPC-REH-01`) | Referral, evaluation, plan of care, notes, scheduling |
| Dialysis | P3 (`SPC-DIA-01`) | Documentation; machines via the device gateway; in-unit BCMA |
