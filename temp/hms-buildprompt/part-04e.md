
### 9.12 ADT, beds, patient flow and handoff

**Release:** R2a (ADT, bed board, census, non-blocking discharge clearance); R2b (I-PASS handoff); P2 (transfer centre, RTLS ingestion); P3 (predictive discharge). **Features:** `ACC-ADT-01` (L), `ACC-ADT-02` (M), `OPS-FLW-01` (M), `CLN-HND-01` (M). **Module:** `adt`. **Read:** R03 §3.2, §6; R05 §4.1; R11 §5, §10.1, §10.6.

**Build:**
- **ADT:** pending admission (expected date, level of care); a timestamped decision to admit (level, service, attending, isolation); bed request → assign → ready → arrival, each timed; inpatient versus observation class with a status-change workflow; transfers (bed swap, inter-unit with transfer med rec and handoff, level-of-care, service or attending change); leave of absence (suspends due times, holds the bed, records the return); pending transfer and discharge with an expected discharge date; cancellations with a reason; back-dated events only with supervisor rights and audit; midnight census reconciliation; downtime re-entry keeping clinical time.
- **Location history** is the single source of truth for census, patient-days, bed charges, isolation tracking and outbreak line lists.
- **Bed board:** the bed state machine (§8.4) with EVS cleaning status, gender and isolation constraints, blocks with reasons, and escalation timers from decision-to-admit to patient-in-bed; isolation-room pressure alarms from building signals block assignment.
- **Admission order set:** level of care, attending, diet with religious preferences, activity, VTE assessment, code status, isolation, nursing protocols, admission med rec (R2b).
- **Rounding lists** by team, unit and service: vitals trend, NEWS2, new results, lines and catheter days, VTE status, discharge readiness; the visiting consultant's evening queue (results, co-signs, orders to sign, consults, discharges due; "changes since last note").
- **Consults:** question, urgency, acceptance and response times; the note routes back to the requester.
- **I-PASS handoff (R2b):** Illness severity (stable/watcher/unstable), Patient summary, Action list with owners and due times, Situation awareness and contingencies, Synthesis by the receiver; auto-filled allergies, code status, drips, lines and recent critical results with attribution; printable and mobile sign-out; handoff audit (who handed to whom, when); bedside nursing SBAR.
- **Discharge clearance** runs in parallel and never blocks the clinical discharge order (SI-12); the discharge event creates the bed-cleaning job.

**Acceptance:** two patients can never occupy one bed (database constraint and property test); census and bed-day charges reconcile with location history; a discharge order succeeds with an unpaid balance; I-PASS coverage per shift is measurable.

### 9.13 Nursing

**Release:** R2b (P3: nursing ambient AI through a partner only after S8-K; acuity-based staffing `NUR-STF-01`). **Features:** `NUR-FLW-01` (L) assessments, flowsheets, I&O, lines and devices, charting by exception; `NUR-FLW-02` (M) Braden, Morse and delirium with care-plan triggers; `NUR-CP-01` (M) care plans, shift worklists, handoff; `NUR-WND-01` (S) wound photography; `CLN-BH-01` (S) suicide screening, restraint and seclusion. **Module:** `nursing`. **Read:** R03 §10, §14.4; K §6.5.

**Build:**
- **The shift brain-sheet** (home queue): due, overdue, PRN-eligible, changed, escalations; I-PASS/SBAR generated from the chart.
- **Admission assessment:** history, function, skin, falls, nutrition screen, pain, psychosocial, learning needs, home medicines, devices, isolation screen; validated suicide screening (behavioural-health contexts, age ≥12) with risk level and plan.
- **Shift assessments by exception** against defined normals; reassessment intervals driven by acuity, scores and policy.
- **Flowsheets:** vitals (nurse-entered in R2b; device-captured and nurse-validated from R2.1), I&O with a running balance, lines, drains and airways (insertion date, site, day count, removal), wounds (body map, staging, measurements, consented in-app photos, dressing plan), neuro checks, glucose and insulin, sedation scales. **Flowsheet field governance** is a product feature: a catalogue of fields with owners, retirement and duplication checks.
- **Scores** with components and calculation version: Braden, Morse, delirium (CAM-ICU/4AT), RASS, CPOT, GCS, pain. Braden and Morse care-plan triggers are sweep candidates: until their Boundary Register triage is written, they are **prompts with nurse-chosen actions**.
- **Care plans:** problem → goal → interventions → evaluation, from a governed library.
- **Worklists** from orders, protocols, scores (for example a turning task when Braden indicates risk), the MAR, overdue documentation and escalations, ordered by due time.
- **Restraint and seclusion:** orders with expiry timers, no standing or PRN orders, a face-to-face assessment task, a monitoring flowsheet and discontinuation prompts; time limits are configurable rule packs with source and review date [HUMAN] (the research gives only US values).
- **Language:** each nurse chooses Sorani, Arabic or English for the UI; drug names, doses and units stay in Latin script and Western digits, so a nurse never translates a dose. Screens are sized for staff new to computers.

**Acceptance:** documentation by exception produces a complete legal record; a score with care-plan triggers never auto-orders anything unless the Register says `cleared` or `not-required` for that tenant (tested for `not-assessed`, `required` and `withdrawn`); restraint orders cannot be PRN and expire on schedule; nurse documentation time per shift is measurable (target −20% at 12 months).

### 9.14 Emergency department

**Release:** R2b (the MLC register from R2a); P2 (MCI/disaster mode `CLN-ED-03`; the sepsis screen); P3 (partner triage AI). **Features:** `CLN-ED-01` (L) quick registration, triage, tracking board; `CLN-ED-02` (M) pathway clocks, disposition, boarding view. **Module:** `ed`. **Read:** R03 §5; K §4.3, §9.1.

**Build:**
- **Quick registration** with a pre-allocated alias; **no deposit or payment rule can block ED registration or emergency orders** (SI-12).
- **First-class timestamps,** never inferred from notes: arrival, quick registration, triage start and end, roomed, first provider, first ECG, CT start and read, first antibiotic, lactate and cultures, decision to admit, bed request, assignment and ready, departure, discharge, LWBS (including after triage), against medical advice.
- **Triage:** one configurable scale per tenant (ESI v5, ATS, MTS or CTAS, with their published levels and target times); coded chief complaint, vitals, pain, allergies, pregnancy status, infection screen, suicide screen, falls risk; an algorithmic level suggestion with nurse override and reason; standing protocol orders where policy allows (for example an ECG within 10 minutes for chest pain); re-triage timers for waiting patients. The scale itself is chosen by the hospital [HUMAN].
- **Tracking board:** room, patient (with similar-name flag), age and sex, acuity, complaint, timers (arrival, last vitals, orders pending), doctor and nurse; icons for pending orders, new or critical results, consults, bed requests, isolation, fall risk and sepsis concern; streams (resuscitation, acute, fast track, paediatric, behavioural, results-pending, observation, boarders).
- **Pathway clocks** (workflow timers, not a device): stroke (last known well, NIHSS, code-stroke order set; door-to-needle targets ≤60 min, with stricter tiers), STEMI (first ECG ≤10 min, door-to-balloon ≤90 min), sepsis (visible time zero; the 3-hour and 6-hour bundle elements); trauma activation with a massive-transfusion order set. Thrombolytic dose arithmetic waits for the Dose Engine; until then KB output is shown verbatim under the pharmacist double check (control set A).
- **Consults and disposition:** consult request time and response clocks; discharge, admit (decision time, bed request, I-PASS), transfer out, observation, AMA, LWBS; boarders receive inpatient orders, MAR and nursing assessments.
- **MLC register** entries created from the ED with police-notification timestamps (§9.28).
- **Code documentation** (resuscitation record) feeding resuscitation review.
- **P2 MCI mode:** a command switch; pre-printed barcoded alias bands; triage tags; minimal data sets; location tracking and family reunification; simplified order sets; post-event merge.

**Acceptance:** every timestamp above is captured as an event and reportable; the board updates within 2 s; a patient with an unpaid balance can be registered, triaged, treated and admitted without any payment prompt blocking care.

### 9.15 Perioperative and anaesthesia

**Release:** R2a (OT booking and lists; implants and consumables to charge and stock); R2b (WHO checklist, consent, site marking, intra-op clinical record); R2.1 (anaesthesia pre-assessment and intra-op/PACU record, lite; paper record until then); P2 (full AIMS with device feed `SPC-AN-02`; OR analytics `SPC-OT-04`). **Features:** `SPC-OT-01` (M), `SPC-OT-02` (S), `SPC-OT-03` (M), `SPC-AN-01` (M). **Module:** `periop`. **Read:** R03 §12; K §4.2–§4.3.

**Build:**
- **Case request and scheduling:** procedure, laterality, expected duration (from surgeon history), equipment, implants, blood, anaesthesia type, positioning; block schedules with release times; add-on and urgent classes; preference cards linked to supply. **Privileges gate booking**; **no OT allocation offline** (SI-15).
- **Pre-op assessment:** ASA, airway, comorbidities, cardiac risk, tests, medication instructions (including perioperative anticoagulant protocols), optimisation pathways.
- **eConsent** with procedure-specific risks, patient, witness and clinician signatures, interpreter, versioned forms, displayed in the theatre.
- **Holding-area checklist:** identity, consent, site marking, fasting, allergies, labs, blood availability, implants, antibiotics, H&P, nursing and anaesthesia assessments, imaging. Site marking by the accountable practitioner, with alternatives where marking is impossible.
- **WHO Surgical Safety Checklist** captured by role in real time: sign in (identity, site, procedure, consent, marking, anaesthesia machine and medicines check, oximeter, allergy, airway and aspiration risk, expected blood loss >500 mL or 7 mL/kg in children), time out (introductions, confirmation, critical events, antibiotic prophylaxis within 60 minutes, imaging displayed), sign out (procedure recorded, counts, specimen labels, equipment problems, recovery concerns). **Incision time cannot be recorded before the time out.**
- **Intra-op record:** in-room, anaesthesia start, incision, closure and out-of-room times; personnel; positioning; skin preparation; tourniquet times; counts; barcoded specimens; **implants by UDI scan** (lot, serial) to the patient record, charge and stock; wound class; drains; perioperative syringe labels printed at the anaesthesia workstation.
- **PACU:** recovery scoring, pain and PONV, the anaesthesia-to-PACU handoff, discharge criteria.

**Acceptance:** the time-out cannot be skipped or back-filled silently; an implant scan creates the implant record, stock movement and charge in one transaction; an OT booking by a surgeon without the privilege is refused.

### 9.16 Critical care

**Release:** R2b (ICU flowsheet with nurse-entered vitals; code documentation); R2.1 (validated monitor feed through §9.19); P2 (severity scores `SPC-ICU-02`); P3 (tele-ICU `SPC-ICU-03`). NEWS2 is excluded from ICU by its intended purpose. **Feature:** `SPC-ICU-01` (L). **Module:** `icu`. **Read:** R03 §11.

**Build:** a 24-hour grid with hourly charting; infusions with rate, dose, concentration and units, and titration checked against ordered parameters; hourly I&O balance; lines, drains and airway days; the ventilator bundle (head of bed, sedation and breathing trials, oral care); multidisciplinary rounds with daily goals, line necessity and antibiotic time-out; transfer out with med rec and handoff. High-resolution waveforms, if captured, stay outside the legal record. P2 severity scores (SOFA, APACHE, SAPS) store components. **Never in the primary alarm path.**

**Acceptance:** infusion titrations outside ordered parameters require a reason; the fluid balance reconciles with I&O entries; after R2.1, only nurse-validated device values reach the flowsheet.

### 9.17 Maternity and neonatal

**Release:** R2a (newborn registration, mother–baby link, birth notification); R2b (labour and delivery record; MEOWS where the Register allows; NICU/PICU live with the rest of the site under control set A); P2 (antenatal episode and WHO Labour Care Guide `SPC-MAT-02`; NICU flowsheets, feeds and human-milk tracking `SPC-NIC-01`). **Features:** `SPC-MAT-01` (M). **Module:** `maternity`. **Read:** R03 §13; K §9.1.

**Build:**
- **Obstetric triage** with MEOWS for maternal observations (Register-gated; nurse-calculated fallback).
- **Labour and delivery record:** mode of delivery; times (full dilatation, delivery, placenta); perineal trauma; quantitative blood loss with a PPH bundle; oxytocin and tranexamic acid as high-alert medicines; cord gases; Apgar scores.
- **Newborn:** created automatically at delivery with a shared episode, linked bands and distinct naming (§9.1); assessment, vitamin K, immunisations, feeding, screening, growth.
- **Statutory:** the KRG birth notification at R2a; deaths with ICD-10 cause in the WHO format (§9.28).
- **Postnatal:** maternal observations, VTE assessment, breastfeeding support.
- **NICU basics (R2b):** corrected gestational age; until the Dose Engine (P2), **the system never calculates, converts or rounds a weight-based dose** (SI-05). The KB range is shown verbatim, the pharmacist records an independently calculated dose under control set A (double check on every neonatal order), and the screen displays the entered value and unit (for example to 0.1 mL/h) without recomputing it; NICU goes live with the site, never later.
- The reproductive-health label applies; pregnancy tests are never released by message.
- **P2:** antenatal episode (EDD by LMP versus ultrasound, gravidity and parity, risk category, booking bloods, ultrasound, growth charts, birth plan); the WHO Labour Care Guide (active first stage from 5 cm, time limits configured from the WHO manual, an "alert" column that requires a recorded response); NICU depth (parenteral nutrition, human-milk barcode matching to the infant, growth charts, ventilator integration).

**Acceptance:** mother and baby are linked from the delivery event with distinct identities and bands; the birth notification produces a locked register entry; neonatal orders cannot be verified without the independent double check.

### 9.18 Results management, discharge and care transitions

**Release:** R1 (outpatient result acknowledgement through the diagnostic order lifecycle; critical results, §9.7); R2b (inpatient results inbox, discharge, med rec, transition summaries); P2 (AI discharge drafts in English, `draft-ai`). **Features:** `CLN-RES-01` (M), `CLN-DOC-03` (M), `CLN-MRC-01` (M). **Modules:** `results`, `record`, `medications`. **Read:** R03 §6.4–§6.5, §16, §17.

**Build:**
- **Results inbox:** every result has an ordering and a responsible clinician; abnormal flags; trends and graphs; sort, filter and pools; surrogates for absence; self-reminders; amended results notify and are visibly flagged; **explicit queues for results pending at discharge and results for discharged patients** (SI-17); unacknowledged abnormal results >7 days reported; mobile acknowledgement and critical read-back.
- **Discharge:** an expected discharge date from admission; a readiness checklist (criteria met, medicines ready, teach-back, equipment, transport, follow-up booked); the discharge order with disposition (never blocked by money); the discharge summary (diagnoses, procedures, course, results pending with an owner, medication changes, follow-up); after-visit instructions and the medication list in the patient's language from templates, with new, changed, stopped and unchanged items flagged; transmission to the referrer; post-discharge contact through the front door (no clinical content in messages).
- **Medication reconciliation** (§9.10): best possible medication history with source and last dose; a decision per item at admission, transfer and discharge; cannot complete while any item is undecided (SI-09).
- **Transition summaries:** IPS `$summary` and PDF/A from one source; referral letters and transfer summaries as owned tasks until acknowledged.

**Acceptance:** a result arriving after discharge always lands in an owned queue and raises a task; discharge cannot complete med rec with undecided items; the discharge summary lists every pending result with its owner.
