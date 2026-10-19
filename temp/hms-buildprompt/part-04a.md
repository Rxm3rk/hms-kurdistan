
---

## 9. Functional modules (the full catalogue)

Each module below gives its **release**, the **feature IDs** (Appendix A), the owning **code modules** (§5.2), what to **build**, the **rules** that matter, minimum **acceptance** tests, and where to **read** for depth. Everything in §2 applies to every module. Content values (thresholds, order sets, templates) are governed configuration; ship synthetic samples flagged NOT FOR CLINICAL USE until clinicians approve real content [HUMAN]. Platform capabilities (Trust Plane, journal, tasks, printing, configuration, the Hub, the cell) are specified in §7, §12, §13 and §16 and are not repeated here.

### 9.0 The module catalogue at a glance

| § | Module | Releases | Main features |
|---|---|---|---|
| 9.1 | Patient identity, registration and EMPI | R1 | `ACC-ID-01`–`03`, `KRI-ID-01`, `ACC-REG-01` |
| 9.2 | Scheduling, OPD flow, referrals and the seam | R1 (display boards R1.1); P2 kiosks, transfer centre | `ACC-SCH-01`, `ACC-SCH-02`, `ACC-OPD-01`, `INT-SEAM-01` |
| 9.3 | The outpatient visit | R1 | `CLN-ORD-02` (OPD), `CLN-IMM-01`, `MED-OPP-01` |
| 9.4 | The clinical record | R1 (outpatient) → R2b (inpatient) | `CLN-CHT-01`–`03`, `CLN-DOC-01`–`02`, `CLN-IPC-01`, `CLN-ACP-01` |
| 9.5 | Orders and CPOE | R1 outpatient; R2b inpatient | `CLN-ORD-01`, `CLN-ORD-02` |
| 9.6 | Clinical decision support | R1 screening; R2b full; P2 CDS Hooks, sepsis | `CLN-CDS-01`–`08` |
| 9.7 | Diagnostics shared services | R1 | `DX-ORD-01`, `DX-CRT-01` |
| 9.8 | Laboratory (LIS) | R1; R1.1; P2; P3 | `DX-LAB-01`–`06`, `DX-MIC-01`, `DX-AP-01`, `DX-POC-01` |
| 9.9 | Radiology (RIS) and PACS | R1; P2 | `DX-RIS-01`–`03`, `DX-PAC-01`, `DX-CRD-01` |
| 9.10 | Medication management | R1 outpatient; R2a inpatient dispensing; R2b closed loop; P2 | `MED-*`, `CLN-MRC-01` |
| 9.11 | Transfusion | R2b; P2 | `DX-BB-01`, `-02`, `-03a`, `DX-BB-KRI-01` |
| 9.12 | ADT, beds, patient flow and handoff | R2a; R2b handoff; P2 | `ACC-ADT-01`, `ACC-ADT-02`, `OPS-FLW-01`, `CLN-HND-01` |
| 9.13 | Nursing | R2b; P3 staffing | `NUR-FLW-01`, `NUR-FLW-02`, `NUR-CP-01`, `NUR-WND-01`, `CLN-BH-01` |
| 9.14 | Emergency department | R2b (MLC register R2a); P2 MCI mode | `CLN-ED-01`–`03` |
| 9.15 | Perioperative and anaesthesia | R2a scheduling and billing; R2b checklist and record; R2.1 anaesthesia; P2 AIMS | `SPC-OT-01`–`04`, `SPC-AN-01`–`02` |
| 9.16 | Critical care | R2b; R2.1 monitor feed; P2 scores; P3 tele-ICU | `SPC-ICU-01`–`03` |
| 9.17 | Maternity and neonatal | R2a registration; R2b L&D record; P2 antenatal, NICU | `SPC-MAT-01`–`02`, `SPC-NIC-01` |
| 9.18 | Results management, discharge and care transitions | R1 outpatient results; R2b inpatient | `CLN-RES-01`, `CLN-DOC-03`, `CLN-MRC-01` |
| 9.19 | Devices and vitals integration | R2.1; P2; P3 | `DEV-GW-01`, `DEV-VAL-01`, `DEV-ALM-01`, `DEV-SDC-01` |
| 9.20 | Revenue cycle core | R1; R2a | `RCM-ACC-01`, `RCM-CHG-01`, `RCM-TAR-01`, `OPS-FLW-01` |
| 9.21 | Cashiering, deposits and dual currency | R1; R1.1 | `RCM-CSH-01`, `KRI-RCM-01`, `KRI-PAY-01`, `DFD-PAY-01`, `RCM-TAX-01` |
| 9.22 | Doctor fees and payouts | R1 | `KRI-RCM-02` |
| 9.23 | Credit, pre-approvals and claims | R1; R1.1; P2 | `RCM-INS-01`, `RCM-DEN-01`, `RCM-SCH-01` |
| 9.24 | Clinical coding | R2.1; P2 | `RCM-COD-01`, `RCM-AI-01` |
| 9.25 | Supply chain, stores and procurement | R1; R2a; R2.1; P2 | `ERP-INV-01`, `ERP-FIN-01`, `ERP-PRC-01`, `ERP-IMP-01` |
| 9.26 | Workforce, credentialing and privileges | R1; P2 | `ERP-HR-01`, `ERP-ROS-01` |
| 9.27 | Health information management | R2b; R2.1 | `CLN-DOC-04` |
| 9.28 | Statutory registers and Ministry reporting | R1; R1.1; R2a; R2.1 | `OPS-STAT-01`, `OPS-STAT-02`, `KRI-STAT-02`, `SPC-DTH-01` |
| 9.29 | Quality, incidents and accreditation | R1; R2b; P2 | `CLN-INC-01`, `CLN-QI-01`, `IMP-MAT-01` |
| 9.30 | Patient and referrer front door | R1; R1.1; P2; P3 | `DFD-*`, `KRI-MSG-01` |
| 9.31 | MIS, dashboards and reporting | R1; R1.1; P2 | `OPS-MIS-01`, `AI-DAT-01`, `AI-DAT-02a` |
| 9.32 | Migration Workbench and go-live tooling | R1; R2b; R2.1 | `IMP-*` |
| 9.33 | Other ancillary services | R2b; P2; P3 | `SPC-DIE-01`, `SPC-REH-01`, `SPC-DIA-01`, `ERP-SVC-01` |

### 9.1 Patient identity, registration and EMPI

**Release:** R1 (P2: kiosks; same-gender clinician preference). **Features:** `ACC-ID-01` (L) EMPI; `ACC-ID-02` (M) identity documents (re-scoped to Iraqi documents) together with `KRI-ID-01` (L) Iraqi identity and cross-script EMPI, built as one epic; `ACC-ID-03` (M) aliases, newborn naming, photo; `ACC-REG-01` (M) registration. **Module:** `empi`. **Read:** R03 §3.1; R11 §3; K §8; §11.2 of this prompt.

**Build:**
- **Search before create:** by name (cross-script, phonetic and trigram), date of birth, sex, phone, identifiers and address, with similar-name warnings. Patient search p95 ≤200 ms.
- **Capture from the document:** national card barcode or OCR, residency card, passport MRZ through the shell HAL; never typed when a document is present; identity verification recorded separately (`IdentityVerified`, "verify later").
- **Identity data:** the identifier list (§11.2); four-part names in Kurdish (Arabic script), Arabic and Latin with transliteration variants and a display name per locale; the mother's full name; birth date with its precision flag; administrative sex, clinical sex parameter and gender identity; contacts (a mobile number is contact data and a matching feature, never an identifier); preferred language for patient outputs; interpreter need; next of kin and guardians.
- **Photo** at registration, shown on the banner, MAR and order entry.
- **Wristbands and labels** at registration: ≥2 identifiers and a barcode; the name in the patient's script plus Latin; MRN plus date of birth or the approximate-DOB flag.
- **Alias pools** of pre-allocated, unique, non-confusable identifiers ("Trauma Zulu-17") for unknown, trauma, mass-casualty and downtime patients, merged into the real identity later.
- **Newborns:** created automatically at delivery and linked to the mother; a distinct name in the pattern "Baby of <mother's name> <sex> <A/B for multiples>" in each script (configurable); never a bare generic "Baby".
- **Duplicates and merges:** real-time and batch matching (Fellegi–Sunter with a document-number shortcut, Kurdish/Arabic normalisation, transliteration dictionaries, weighting on father's, grandfather's and mother's names and DOB precision) feeding the HIM steward queue; merges are reversible links that re-point clinical data, orders, results and accounts, propagate downstream (A40, `Patient.link`) and record the algorithm version. **An overlay is a safety incident:** freeze, split by provenance, notify, RCA.
- **Deceased** flag with record lock; VIP and employee-as-patient labels; consent capture at registration (messaging per channel).
- A **gold-set evaluation tool** reports precision and recall on the 2,000-pair cross-script set (S14-K).

**Rules:** SI-01, SI-08, SI-15 (no identifiers outside pre-allocated blocks and no merges offline), SI-16, SI-12 (no deposit rule blocks ED registration), SI-21.

**Acceptance:** duplicates <1%, zero overlays and ≥99.9% auto-merge precision on the synthetic cross-script gold set; unmerge restores every re-pointed record; band and label golden images pass in three scripts, including long-name and newborn truncation cases; a mobile number alone never matches two people.

### 9.2 Scheduling, OPD flow, referrals and the seam

**Release:** R1 (display boards R1.1; P2 kiosks `ACC-OPD-03` and transfer centre `ACC-TRF-01`). **Features:** `ACC-SCH-01` (L), `ACC-OPD-01` (M), `ACC-SCH-02` (M), `INT-SEAM-01` (M). **Modules:** `scheduling`, `hub`. **Read:** R03 §3.3; R05 §4.6; R16 §6; K §13.1.

**Build:**
- **Scheduling:** provider, room, equipment and OT-block templates; linked and recurring bookings; capped overbooking; waitlists with auto-offer; reason-coded cancellations and no-shows; the Friday–Saturday weekend and Kurdistan holidays; trilingual reminders.
- **The OPD token journey:** registration → vitals → consultation → lab → pharmacy → billing, with checkpoints configurable per hospital (pay-first sites put the cashier before services). Tokens are issued at check-in, called to a service point, served, skipped or recalled; one token follows the patient across queues; numbers are masked on displays; timestamps for generation, call and service feed TAT dashboards; queue state lives in the cell or edge agent so it survives WAN loss; ESC/POS token printing; RTL HTML display boards in R1.1.
- **Referral tracking:** intake from internal and external sources; every referral is an owned task in a queue with an SLA, through created → owned queue → appointment or admission → acknowledgement → closure letter to the referrer. Open referrals >14 days are reported.
- **The seam (W1-K, while hospital A is on paper or legacy):** one group tenant and EMPI from day one; if hospital A has an electronic ADT, its numbers arrive as alternate identifiers (INT-SEAM-01); if it is on paper, its admission desk gets a search-only EMPI client so polyclinic patients keep one number. Every referral or transfer to hospital A carries a printed and structured visit summary and the active medication list; hospital A's logged receipt counts as acknowledgement. Seam KPIs: unacknowledged referrals >24 h = 0; overlays = 0.

**Acceptance:** the token journey runs end to end with WAN cut; referral SLA timers respect the tenant calendar; the seam suite (§18.5 #10) passes.

### 9.3 The outpatient visit

**Release:** R1 (P2: patient app, teleconsultation, English dictation structuring; P3: ambient AI). **Features:** `CLN-ORD-02` (outpatient scope), `CLN-IMM-01` (M), `MED-OPP-01` (M) for the pharmacy hand-off, plus the record features in §9.4. **Modules:** `record`, `orders`, `medications`. **Read:** R03 §4; K §6.1.

**Build:**
- **The consultant's one-screen visit,** driven by the token queue: pre-visit view (outstanding results and referrals, care gaps); rooming (height, weight, BMI, BP with repeat logic, coded allergies with reaction and severity, medication list with source, reason for visit, screenings, immunisation status); history, examination and data review; assessment and plan per coded problem; diagnosis-linked orders from favourites, order chips and order sets; e-prescribing with typo-tolerant brand↔generic search over the regional brand master, screened (§9.6), sent to the outpatient pharmacy POS; patient instructions in the patient's language from approved templates; check-out (book follow-up and referrals); sign and close; trainee co-signature. Target: median documentation ≤90 s for a follow-up visit [E].
- **Visiting consultants** work evenings, often on tablets: fast login (badge or passkey), large touch targets, favourites, minimal typing.
- **Immunisation record:** vaccine, lot from the stores ledger, expiry, site, route, dose number, performer, consent; HL7 VXU and FHIR Immunization projections.
- **After the visit:** results go to the ordering and responsible clinician for acknowledgement (§9.18); reports reach patients only through the release rule (§9.30).
- The documentation profile is free of US billing norms (no E/M levelling).

**Acceptance:** the demo encounter "token → consult → lab → pharmacy → dual-currency bill" (K-02) runs end to end on synthetic data in three UI languages; an e-prescription for a patient with a recorded allergy to the drug raises the screening alert; instructions print in Sorani, Badini and Arabic with drug names and doses in Latin script.

### 9.4 The clinical record

**Release:** R1 (outpatient record); R2b (inpatient notes, discharge, code documentation); R2a (code status and advance care planning workflow). **Features:** `CLN-CHT-01` (L) chart and banner; `CLN-CHT-02` (M) problems, allergies, home medicines; `CLN-CHT-03` (M) results review; `CLN-DOC-01` (L) notes; `CLN-DOC-02` (M) copy-forward provenance; `CLN-IPC-01` (S) isolation flags; `CLN-ACP-01` (S) code status and advance care planning. **Module:** `record`. **Read:** R03 §15; R11 §6; K §6.4.

**Build:**
- **The banner (SI-16)** as a design-system component on every clinical screen, mobile view and print: photo, two identifiers, trilingual name, allergies ("NKA" distinct from "not assessed"), code status, isolation, dated weight, sensitivity indicators where the user is entitled to see them.
- **Problems** (coded, longitudinal, with clinical and verification status) and **allergies** (coded substance or class, reaction, severity, criticality, verification) driving drug–disease and drug–allergy CDS; home medicines with source.
- **Results review:** trends, cumulative views, graphs, abnormal flags.
- **Notes:** specialty templates; smart phrases; smart links (live data with timestamp and source); smart lists with required choices; problem-based charting. **Notes are synthesis, not accumulation:** composed from structured data with span-level provenance; copied text is marked with its source, and smart links are preferred over static copies. English clinical text. Signing with authentication, intent and manifestation; co-signature for trainees, verbal orders and scribes with timeliness tracking; signed notes immutable, with amendments as versions and addenda as links (SI-06); per-author length and redundancy analytics (no blanket copy-paste ban).
- **Flags:** fall risk, isolation (contact/droplet/airborne, constraining bed assignment from R2a), code status, violence risk, MDRO carrier, VIP, interpreter needed.
- **Code status and advance directives** in their own model: banner-visible, time-stamped, reviewable.
- **Clinical photos** in-app only (never the device gallery), with consent, body site and labels; scanned documents indexed to patient, encounter and type with mis-indexing QA.
- **eConsent** by the performing clinician, with witness, interpreter and versioned forms; guardian or co-signer and chaperone documentation from R2b.
- **Back-entry after downtime** keeps the paper's clinical time and is labelled (SI-10).

**Acceptance:** the banner test passes on every clinical route and print; signing after a patient-context change within 60 s forces re-verification; a signed note cannot be edited through any channel; copied text shows its source on screen and in print.

### 9.5 Orders and CPOE

**Release:** R1 (outpatient orders); R2b (inpatient CPOE, activated site-wide only, never unit by unit); R2a sites keep orders on paper (pharmacy transcription, §9.10). **Features:** `CLN-ORD-01` (L) orderables and order sets; `CLN-ORD-02` (XL) CPOE. **Module:** `orders` (Safety Kernel). **Read:** R03 §7; R11 §7, §10.2; K §4.2, §6.1.

**Build:**
- **Order types:** medications, laboratory, imaging, procedures, nursing, diet (with religious preferences), activity, consults, referrals, blood products, isolation, ADT, therapy, respiratory, code status. Structured by default; free text monitored and alerted when a structured equivalent exists.
- **Orderables master:** coded (LOINC for laboratory; the regional brand master for medicines), defaults, required fields, specimen requirements, synonyms including brand names, tall-man lettering; typo-tolerant search.
- **Order sets:** versioned and evidence-linked, with an owner and a review date; pre-selected versus optional items; conditional logic (weight, renal function); nurse-driven protocols (electrolytes, insulin, anticoagulation nomograms, catheter removal); linked monitoring orders (aminoglycosides, digoxin, lithium, phenytoin, warfarin).
- **Timing types:** STAT/ASAP/routine/timed; future; standing and recurring with expiry and renewal reminders; conditional ("if K < 3.5 then …"); PRN with indication and maximum frequency; titratable with parameters; tapers. Phase-of-care orders (pre-op → intra-op → PACU → post-op) and signed-and-held orders released on transfer.
- **Verbal and telephone orders** only in defined situations: read-back captured with source and receiver; co-signature timers within policy, tracked in the HIM deficiency queue; **refused for antineoplastics except hold or stop**.
- **Checks at ordering:** duplicate checks (exact and therapeutic, with look-back per orderable); age, dated weight, allergies and pregnancy status visible; no weight-based medicine signable without a dated weight; indication required for antimicrobials (with the stewardship control set), PRNs and imaging.
- **The order lifecycle** (§8.4) with actor, time and reason on every transition; order-to-result tracking with an overdue "not yet resulted" view per clinician and unit.
- **Order-sign** is one atomic transaction in the Safety Kernel: order + CDS override record + verification task + MAR schedule + charge event (C1, p95 ≤300 ms server time at 3× peak; ≤1.5 s end to end with CDS).
- **Tablet-first rounds** for visiting consultants: favourites, order chips, order sets, minimal typing.

**Acceptance:** property tests prove every order reaches a terminal state and no medication order is dispensable before verification (except the emergency override list); a verbal antineoplastic order is refused; the CPOE error-category harness (§18.5) runs on foundation content; CPOE share is measurable by unit (targets ≥70% at 90 days and ≥85% at 12 months, K §17).

### 9.6 Clinical decision support

**Release:** R1 (drug-KB adapter and outpatient screening [P], telemetry and harness); R2a (screening at pharmacist transcription); R2b (full inpatient checks, VTE prompts, NEWS2 as Regulated Module #1); P2 (CDS Hooks and CQL `CLN-CDS-04`, sepsis screen `CLN-CDS-06` as Regulated Module #2, stewardship module `CLN-AMS-01`); P3 (partner predictive deterioration `CLN-CDS-07`, silent first). **Features:** `CLN-CDS-01` (M, partner content), `CLN-CDS-02` (L), `CLN-CDS-03` (M), `CLN-CDS-05` (M, Tier 2), `CLN-CDS-08` (S). **Modules:** `cds`, `reg-screening`, `reg-ews`. **Read:** R03 §8; K §5.2, §5.6, §6.3.

**Build:**
- **The CDS registry:** every artefact has purpose, evidence, owner, intended users, trigger, format (tier A–D, §14.3), expected firing rate and a review-by date; firing, acceptance, override and reason telemetry; time-to-action; in-workflow feedback; quarterly alert-burden reports. Every rule and flag has a kill switch (SI-19).
- **The checks catalogue:** drug–allergy with tiered cross-sensitivity; drug–drug by severity with a suppression list; drug–disease from the problem list; dose range (single, daily, cumulative; weight, BSA, renal, hepatic, age, paediatric) **shown verbatim from the licensed KB, with no local arithmetic until the Dose Engine**; duplicate therapy; drug–lab; drug–route (fatal routes are hard stops); pregnancy and lactation; monitoring reminders; advisories inside order sets.
- **The minimal interruptive set:** level-1 interactions, true severe allergies, high-alert dose limits and fatal routes. Everything else goes to order sets, passive guidance or the pharmacist queue. Hard stops only for absolute contraindications on the governed list (for example intrathecal vincristine) (SI-14).
- **Rollout:** the vendor-validated baseline is interruptive from day 0; new or locally modified rules run silent for 2–4 weeks with replay; rules overridden >90% are reviewed, never auto-retired (Tier A/B exempt).
- **VTE:** a risk assessment (Padua, Caprini or UK DoH, chosen per tenant) in the admission order set and at transfer, with contraindications and a prophylaxis order or documented reason; reassessment at 24 h and on change. As a sweep candidate it runs as **prompts with clinician-chosen actions** until its Boundary Register triage is written.
- **NEWS2/PEWS/MEOWS** in `reg-ews` (§10.4): inputs RR, SpO₂ scale 1 or 2, air versus oxygen, systolic BP, pulse, ACVPU (new confusion scores 3), temperature; NEWS2 response bands 0 (≥12-hourly), 1–4 (4–6-hourly), a single parameter of 3 (≥hourly with urgent ward review), 5–6 (urgent response), ≥7 (emergency response); components visible; escalation as a tracked task; PEWS age-banded; MEOWS in pregnancy. **Activation and frequency scheduling only where the Boundary Register allows**; until then the fallback (§10.3) runs.
- **The stewardship control set** (§10.3 C) from R2a.
- **CDS for visiting consultants** must stay within the ≤1.5 s order-sign budget (≤500 ms per CDS service; services fail open with a banner, except hard stops, which fail closed).

**Acceptance:** interruptive alerts ≤8 per 100 medication orders on the synthetic replay; zero interruptive alerts on the "should not alert" set; every kill switch works without a deploy; NEWS2 boundary tests at 100%; the screening presenter never alters KB output.
