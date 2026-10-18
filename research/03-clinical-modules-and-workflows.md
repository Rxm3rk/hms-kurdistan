# 03 — Core Clinical Modules & Workflows

> **Track:** Core clinical modules and workflows (functional scope and detailed workflows a top-tier hospital EHR must support), benchmarked against Epic, Oracle Health (Cerner Millennium), MEDITECH Expanse, InterSystems TrakCare, Dedalus and Cambio.
> **Perspective:** Clinical informatics (physician and nursing informatics) and health-IT product research. Pure research, no code.
> **Status date:** 2026-10-16. **Companion docs:** `11-canonical-domain-model.md` (data model and state machines), `06-interoperability-standards.md`, `08-architecture-and-technology.md`.

**How to read the evidence labels**

- **[n]**: a numbered source in §22. Primary sources (Joint Commission NPG full text, ONC SAFER Guides, Leapfrog guidance, ASCO-ONS standards, ISMP, 42 CFR, eCQI specifications, RCP, peer-reviewed papers) were fetched and read for this report wherever possible.
- **[K]**: practitioner or domain knowledge that was **not re-verified in this session**. Treat it as a strong prior and verify it before using it in contracts or regulatory claims. This mostly covers vendor module nicknames, some international triage times and common scoring thresholds.
- **(est.)**: an estimate or rule of thumb, not a published standard.
- **Research note:** the shared web-search quota ran out after about 30 searches. After that, I checked facts by fetching primary documents directly rather than searching more. Some vendor-naming details (Dedalus, Cambio, newer Oracle names) and the current status of some CMS measures are therefore marked [K].
- **Verification pass 2 (2026-10-16):** about 30 claims were re-checked against primary texts (NPG standards PDF, Leapfrog 2026 CPOE guidance, ISMP 2024 list, SHOT 2023/2024, ASCO-ONS 2024, 42 CFR 482.13, eCQI CMS1244, Federal Register, peer-reviewed abstracts). Corrections are made in place. The results are in the verification log at the end of the document. Sources [82]–[88] were added in this pass.

---

## 1. Executive summary

1. **The 2026 safety rulebook has changed.** For US hospitals, The Joint Commission replaced the National Patient Safety Goals with **14 National Performance Goals (NPGs)**, effective 1 January 2026 [7][8][9]. Goal 1 ("right patient, right care, right time") bundles patient identification, critical results, patient flow and **ED boarding goals**, handoffs, alarm safety, deterioration recognition, resuscitation review and Universal Protocol. Goal 14 bundles medication management: ADC override review, concentration standardisation, perioperative labelling, anticoagulation, medication reconciliation and **antibiotic stewardship DOT/1,000 days** [8]. Our requirements backlog should be traceable to NPG element-of-performance (EP) numbers. *(Reconciled 2026-10-16 to the pack's market roadmap: Wave 1 India + KSA, Wave 1b UAE, US as a Phase 3 go/no-go; `06` §8. The **primary** accreditation trace is therefore NABH (India), JCI, CBAHI (KSA) and DoH Abu Dhabi standards. Joint Commission NPG EPs are a **secondary** rule pack, still worth keeping because many NPG elements mirror JCI requirements.)*
2. **The ONC SAFER Guides were revised in 2025:** 9 guides were consolidated into 8, recommendations fell from 147 to 88, and the High Priority Practices guide has 16 items [1][2][6]. They now cover AI governance, patient photos at registration, MRN check digits, barcoded wristbands, temporary unique IDs for unknown or downtime patients, and order-to-completion tracking for referrals [2][3][4][5]. They are the best freely available functional safety specification for an EHR, so we should build to them.
3. **Leapfrog's CPOE test is a ready-made acceptance test for our medication CDS.** It requires ≥85% of inpatient medication orders via CPOE and a system that catches ≥60% of serious test errors across 8 categories. One category (Excessive Alerts) **penalises over-alerting**, and hospitals that report false-positive alerts are scored as an Incomplete Evaluation [10][11]. For 2027, Leapfrog is signalling tougher expectations on **non-interruptive alerts** [10].
4. **Alert fatigue is the defining CDS failure mode.** Medication alerts are overridden in 46–96% of cases [16][17][18]. A widely deployed proprietary sepsis model had an AUC of 0.63 and missed 67% of sepsis cases while alerting on 18% of all inpatients [22]. CDS must be governed, tiered, measured (override and acceptance telemetry) and locally validated.
5. **Closed-loop medication management (CPOE → pharmacist verification → ADC/robot → BCMA/eMAR → smart-pump auto-programming) is the single highest-value safety investment.** BCMA cut non-timing administration errors by 41.4% and potential ADEs by 50.8% [39]. However, scan compliance decays over time and workarounds are common [40][41]. Pump auto-programming reduces errors but in one recent study was used for only about 53% of infusions [42][43].
6. **Identity is foundational and under-engineered in most products.** Industry estimates put duplicate rates at about 8–12%. RAND puts the US average at 8%, and 15–16% in large systems [62]. A ≤1% duplicate-rate goal is widely quoted as best practice, but the cited AHIMA articles do not state it, so treat it as an internal target rather than an AHIMA standard [61][62]. Best in class combines probabilistic EMPI matching, a human work queue, reversible merge/unmerge, distinct newborn naming ("Judy Girl A/B"), trauma/unknown aliases and photo capture [4][8][58][59].
7. **The ED needs time-stamp-grade data.** CMS's new **ECAT eCQM** (CMS1244) flags visits with >60 min arrival-to-room, LWBS, >4 h boarding or >8 h ED length of stay. The CY 2026 OPPS final rule adopted it in the **Hospital Outpatient Quality Reporting (OQR) programme**. Reporting is voluntary for CY 2027 and mandatory from CY 2028 (CY 2030 payment determination), and ECAT replaces the chart-abstracted OP-18 (median ED time for discharged patients) and OP-22 (LWBS) measures [30][82]. The FY 2027 IPPS rule only requested comment on inpatient use (IQR/VBP), so ECAT is not yet an inpatient programme measure [K]. The old ED-2 measure is retired from 2026 [31][78]. Stroke (door-to-needle ≤60/45/30 min), STEMI and sepsis (SEP-1) clocks all depend on reliable, auditable event times [32][33][34][35].
8. **Handoffs and deterioration are software problems as much as culture problems.** I-PASS reduced medical errors by 23% and preventable adverse events by 30% [36]. NEWS2 thresholds (≥5 urgent, ≥7 emergency, a single 3 means urgent ward-based review) should drive escalation tasks, not just a coloured number [23][24]. *(Reconciled 2026-10-16 with `07`, `08` and `09`. In v1 these are transparent published-score calculators on nurse-entered vitals, versioned as a regulated module and released first in non-US markets. Automated alarms from continuous device streams are excluded. See §21.1 #4.)*
9. **Documentation is bloated.** About 50% of note text is duplicated from elsewhere in the record [48]. In outpatient notes, median redundancy with the patient's previous note rose from 47.9% (2009) to 58.8% (2018), and only 29.4% of text was typed directly [49]. Ambient AI scribes show modest, mixed benefit in two 2025 NEJM AI RCTs (UCLA and UW Health) [50][51][87]. Design for source-attributed, problem-oriented notes with copy-forward visibility, not just bans.
10. **Specialty workflows carry hard regulatory content we must model exactly.** Examples: ASCO-ONS 2024 antineoplastic standards (16 required order elements, four verifications, no verbal orders except hold/stop) [52]; CMS restraint/seclusion rules (4/2/1-h order limits by age, 1-h face-to-face, PRN orders prohibited) [53]; suicide screening with a validated tool for age ≥12 in behavioural health [8]; WHO Labour Care Guide (active labour from 5 cm) [63][64].
11. **Transfusion safety remains a top hazard.** UK SHOT logged 899 wrong-blood-in-tube near misses in 2024 [54][55], and electronic identification systems lower wrong-component errors [56]. Bedside barcode verification for specimen collection and transfusion is non-negotiable.
12. **Results management is where diagnostic errors hide.** SAFER requires an explicit owner for every result, amended-result notifications, fail-safes for critical results, surrogate inbox coverage and monitoring of unacknowledged results [5]. NPG.01.02.01 requires defined critical-result reporting times [8].
13. **Vendor taxonomy converges.** Epic and Oracle Health module names map onto about 48 canonical functional modules (§2, §18) [71][73][74].
14. **Recommended MVP clinical scope:** identity/ADT/bed board, scheduling, the clinician chart, CPOE, governed rules-based CDS, the medication closed loop (verification, eMAR/BCMA), nursing documentation, ED, inpatient documentation/handoff/med rec/discharge, results inbox, lab/radiology interfaces, bedside transfusion and specimen labelling, downtime tooling and HIM basics. Specialties follow in Phase 2/3 (§21). *(Reconciled 2026-10-16. The interim MVP target is a 100–300-bed private multispecialty hospital in India/KSA. It adds a native clinical-pathology LIS and RIS (per `04` §11 #15), OPD token queue, a basic patient app/WhatsApp, OT scheduling and a basic intra-op record. See §2 and §21.)*
15. **Differentiate on safety-by-design, not feature count:** server-side safety invariants, every alert measured, every order tracked to completion, trustworthy time stamps, and governed AI (SAFER HP 1.5) [2]. On regulation: ONC HTI-1 decision-support-intervention (DSI) transparency (source attributes, risk management) is still the certification requirement. However, the **HTI-5 proposed rule** (Federal Register, 29 Dec 2025) would remove the DSI source-attribute and risk-management requirements, and no final rule had been found as of Oct 2026 [85]. Build transparency as a product feature regardless of the regulatory outcome.

---

## 2. Canonical module map

Phase key: **MVP** = required for first live inpatient + ED + clinic site. **P2** = second wave (12–24 months). **P3** = later or partner-sourced. *(Reconciled 2026-10-16: phases are set against a defined "minimum viable hospital", a 100–300-bed private multispecialty hospital in India/KSA (Wave 1 markets). Rows 5, 6 and 20–25 were changed to match `04` §11 #15, `05` §4.6/§9.3, `09` §9.2 and `01` §12.2. This is interim until the proposed requirements catalogue (report 14) and design-partner input confirm it.)* Epic names are confirmed against third-party catalogues [71] unless marked [K]. Oracle names come from Oracle documents and integrator catalogues [72][73][74] unless marked [K].

| # | Canonical module | Purpose | Key users | Epic equivalent | Oracle Health (Millennium) equivalent | Phase |
|---|---|---|---|---|---|---|
| 1 | Enterprise Master Patient Index (EMPI) | Unique identity, matching, merge/unmerge, aliases | Registrars, HIM data-integrity team | Identity [K] | Enterprise Master Person Index / Person Management [K] | MVP |
| 2 | Registration & ADT | Demographics, coverage, consents, admit/transfer/discharge, LOA, pending events | Registrars, unit clerks, bed managers | Prelude (registration), Grand Central (ADT) | Registration / Patient Management (ADT) [K] | MVP |
| 3 | Bed & capacity management, transfer centre | Bed board, EVS turnaround, transport, placement, command centre | Bed managers, house supervisors, EVS, transport | Grand Central (bed planning, transfer centre) [K] | CareAware Capacity Management [74] | MVP (bed board); P2 (command centre) |
| 4 | Scheduling, referrals & waitlists | Provider, resource and OR templates, overbooking, waitlists, referral intake | Schedulers, call centre, referral coordinators | Cadence (+ Referrals) | Scheduling Management [K] | MVP |
| 5 | Check-in, kiosks & queueing | Arrival, ID/photo, co-pay, queue tickets, wayfinding | Front desk, patients | Welcome [K] | (kiosk/partner solutions) [K] | **MVP (OPD token queue, India/KSA)**; P2 (kiosks, wayfinding) *(reconciled 2026-10-16)* |
| 6 | Patient portal & apps | Results, messaging, booking, e-check-in, proxies, questionnaires | Patients, caregivers | MyChart | HealtheLife / Oracle Health patient portal [K] | **MVP (basic patient app + WhatsApp/SMS + national rails)**; P2 (full MyChart-class portal) *(reconciled 2026-10-16)* |
| 7 | Clinician chart / workspace | Summary, problem list, allergies, results review, notes, chart search | All clinicians | EpicCare Inpatient / Ambulatory; Hyperspace/Hyperdrive client [K] | PowerChart | MVP |
| 8 | CPOE & order management | Orders, order sets/protocols, verbal orders, lifecycle, order-to-result tracking | Prescribers, nurses, pharmacists | Orders, SmartSets / order sets [K] | PowerOrders, PowerPlans | MVP |
| 9 | Clinical decision support platform | Rules, drug checking, advisories, calculators, predictive models, CDS Hooks | CDS committee, all clinicians | BestPractice/OurPractice Advisories, Cognitive Computing [K] | Discern Expert / Discern rules [K] | MVP (rules + drug KB); P2 (predictive) |
| 10 | Physician documentation | H&P, progress notes, consults, discharge summaries, templates, co-sign | Physicians, APPs, residents | Notes + SmartTools (SmartText, SmartPhrase, SmartLinks) [K] | Dynamic Documentation, PowerNote [73][74] | MVP |
| 11 | Nursing documentation & care planning | Assessments, flowsheets, I&O, care plans, risk scores, worklists | Nurses, allied health | ClinDoc (Inpatient Clinical Documentation) | CareNet, iView (Interactive View & I&O), PowerForms (Advanced Care Documentation) [73][74] | MVP |
| 12 | eMAR & barcode medication administration | Administration, five rights, PRN, titrations, infusions | Nurses | ClinDoc MAR, Rover mobile [71][K] | Bedside Medication Administration / Medication Administration Wizard [K] | MVP |
| 13 | Pharmacy (inpatient) | Verification, dispensing, ADC/robot interfaces, IV compounding, formulary | Pharmacists, technicians | Willow Inpatient | PharmNet | MVP |
| 14 | Ambulatory clinic EHR | Rooming, visit note, e-prescribing, AVS, in-basket | Clinic MDs/APPs/RNs/MAs | EpicCare Ambulatory | PowerChart Ambulatory [72] | MVP |
| 15 | Emergency department | Triage, tracking board, pathways, disposition, boarding, MCI mode | ED staff | ASAP | FirstNet (Emergency Medicine) [73] | MVP |
| 16 | Handoff, rounding & patient lists | I-PASS handoff, team lists, task lists, rounding checklists | Residents, hospitalists, nurses | Patient Lists / Handoff [K] | Handoff tool (I-PASS) in PowerChart [K] | MVP |
| 17 | Medication reconciliation | BPMH, admission/transfer/discharge reconciliation | Pharmacists/techs, prescribers | Within EpicCare/Willow [K] | Medication Reconciliation (PowerChart) [K] | MVP |
| 18 | Discharge & transitions | Discharge readiness, summary, AVS, post-acute referrals | Case managers, MDs, RNs | Discharge navigator [K] | Discharge/Transfer Management (legacy CapStone) [74] | MVP |
| 19 | Results management / in-basket | Result routing, acknowledgement, critical results, messages, surrogates | All ordering clinicians | In Basket [K] | Message Center [74] | MVP |
| 20 | Laboratory (LIS) incl. AP, micro | Specimen tracking, analysers, QC, reporting | Lab staff | Beaker | PathNet | **MVP = native clinical-pathology LIS core**; micro and AP start as interfaces, native in P2 (`04` §11 #15) *(reconciled 2026-10-16; was "MVP = interface; P3 native")* |
| 21 | Radiology (RIS) + PACS link | Protocolling, scheduling, reporting, image viewer launch | Radiology | Radiant | RadNet | **MVP = native RIS** with PACS via DICOMweb/IID (`04` §11 #15) *(reconciled 2026-10-16; was "MVP = interface; P3 native")* |
| 22 | Blood bank & bedside transfusion | Type & screen, crossmatch, issue, bedside barcode check, reactions | Lab, nurses, anaesthesia | Transfusion administration in ClinDoc; BB often third-party [K] | PathNet Blood Bank Transfusion [K] | MVP (bedside verification inside BCMA + HL7 interface to the external blood bank, all markets). Native ISBT 128 blood bank is later, non-US only, in the regulated-modules track after the QMS exists *(reconciled 2026-10-16)* |
| 23 | Perioperative (scheduling, intra-op, PACU) | Case booking, preference cards, checklist, intra-op record, implants | OR nurses, surgeons, schedulers | OpTime | SurgiNet | **MVP (OT scheduling + basic intra-op record incl. WHO checklist)**; P2 (preference cards, implants, PACU depth) *(reconciled 2026-10-16)* |
| 24 | Anaesthesia information management (AIMS) | Pre-op anaesthesia assessment, intra-op record, device feeds, PACU | Anaesthesiologists, CRNAs | Anesthesia | SurgiNet Anesthesia | P2 (unless a design partner requires it) |
| 25 | Critical care / ICU | Device-integrated flowsheets, drips, ventilator, scores, tele-ICU | ICU staff | ClinDoc ICU + device integration [K] | CareAware Critical Care, iView [72] | P2 (vitals device feed MVP-lite; full ICU device-integrated charting P2 unless a design partner requires it) |
| 26 | Maternity (antenatal, L&D, postpartum) | Pregnancy episode, partogram, fetal monitoring, delivery record | Midwives, obstetricians | Stork | PowerChart Maternity [K] | P2 |
| 27 | Neonatal / NICU | Newborn record, mother-baby link, growth, feeds, human milk | Neonatal teams | Stork + ClinDoc NICU [K] | PowerChart Maternity/NICU [K] | P2 |
| 28 | Oncology | Regimens/protocols, cycles, BSA dosing, cumulative dose, staging | Oncologists, chemo nurses, pharmacists | Beacon | PowerChart Oncology [K] | P2 |
| 29 | Cardiology (cath, echo, EP, ECG) | Procedure logs, structured reporting, registries | Cardiology | Cupid | CVNet [74] | P3 |
| 30 | Nephrology & dialysis | Dialysis prescriptions, run sheets, machine integration | Nephrology, dialysis RNs | Dialysis module (third-party lists name it "Beans"; verify) [71] | Nephrology/dialysis content [K] | P3 |
| 31 | Behavioural / mental health | Legal status/holds, risk assessments, restraint/seclusion, observations | Psychiatry, BH nursing | Behavioral Health [K] | PowerChart Behavioral Health [K] | P2 (restraint, suicide content MVP) |
| 32 | Rehabilitation therapies (PT/OT/SLP) | Evaluations, plans of care, functional outcome measures | Therapists | Rehab [K] | Rehab/Therapies content [K] | P2 |
| 33 | Ophthalmology | Eye exam, imaging devices, IOP, VA | Ophthalmology | Kaleidoscope | Ophthalmology content [K] | P3 |
| 34 | Dental / maxillofacial | Odontogram, periodontal charting, dental procedures | Dentists | Wisdom | Dental content [K] | P3 |
| 35 | Orthopaedics | Ortho-specific documentation, implants, outcomes | Orthopaedics | Bones | — [K] | P3 |
| 36 | Transplant | Candidate evaluation, waitlist, donor/organ, post-transplant | Transplant teams | Phoenix | Transplant content [K] | P3 |
| 37 | Endoscopy / GI procedures | Scheduling, procedure reporting, scope tracking | GI | Lumens | (SurgiNet/procedural) [K] | P3 |
| 38 | Infection prevention & control | Surveillance, isolation flags, outbreak management, NHSN reporting | IPs, epidemiologists | Bugsy | Infection-control content / third-party surveillance [K] | P2 (isolation flags MVP) |
| 39 | Antimicrobial stewardship | Restricted-agent approval, time-outs, DOT reporting | ASP pharmacists/ID | Willow/Bugsy stewardship [K] | Discern/third-party [K] | P2 |
| 40 | Palliative care & advance care planning | Goals of care, ACP documents, code status, symptom scores | Palliative teams, all MDs | ACP activity [K] | Advance directives content [K] | MVP (code status, ACP docs); P2 (palliative module) |
| 41 | Care management, utilisation review, population health | Case management, UR, registries, care gaps | Case managers, UR nurses | Healthy Planet | HealtheIntent / Care Management [K] | P2 |
| 42 | Social care, SDOH & community referrals | SDOH screening, CBO referral loop | Social workers, navigators | Compass Rose [K] | SDOH content [K] | P2 (screening MVP) |
| 43 | HIM: chart completion, scanning, ROI | Deficiency tracking, legal record, scanning/indexing, release of information, amendments | HIM staff | HIM / ROI / Media Manager [K] | HIM / ProFile [K] | MVP |
| 44 | Interoperability & HIE | HL7 v2/FHIR, C-CDA, HIE query, referral exchange | Integration team | Care Everywhere [K], Bridges | Open Engine, FHIR APIs [74] | MVP |
| 45 | Mobile clinical apps | Mobile BCMA, specimen collection, photos, secure chat, alerts | Nurses, physicians | Rover, Haiku, Canto | PowerChart Touch, CareAware Connect [74][K] | MVP (mobile BCMA/specimen) |
| 46 | Analytics, registries & quality reporting | eCQMs, registries, dashboards, research data | Quality, executives | Clarity / Caboodle / Cogito | HealtheIntent / Oracle Health Data Intelligence [K] | P2 |
| 47 | Home health & hospice | Visit scheduling, OASIS, hospice IDG | Home health staff | Dorothy (home health) [K] | HomeWorks [K] | P3 |
| 48 | Virtual care & tele-ICU | Video visits, remote monitoring, tele-ICU | Clinicians | Integrated telehealth [K] | Virtual care content [K] | P3 |

---

## 3. Patient identity & access

### 3.1 EMPI and registration

**Purpose:** Guarantee one record per person (no duplicates or overlays), the right person on every screen, wristband, label and message, and a fast path to registration for patients who cannot be identified.

**Key workflows**

1. **Search before create.** Search on name, DOB, sex, phone, national ID/insurance ID and address, using phonetic and fuzzy matching. The system must warn when a new record has the same first and last name as an existing one, or when results contain similar names (SAFER HP 1.2; Patient ID 1.6) [2][4].
2. **Create or confirm identity.** Capture legal name, preferred name, DOB, administrative sex plus sex parameter for clinical use and gender identity [K], identifiers (MRN with **check digit** [4]), contacts, language and interpreter need, and next of kin. Capture a **patient photo** at registration and display it in multiple places, including the banner, MAR and order entry (SAFER HP 2.3) [2].
3. **Verify identity** with an ID document, biometrics where lawful, or portal-verified identity.
4. **Print identity artefacts.** Wristbands and labels carry ≥2 identifiers plus a 1D/2D barcode (SAFER Patient ID 1.4) [4]. Never use a room or bed as an identifier (NPG.01.01.01 EP1) [8].
5. **Unknown, trauma and MCI patients.** Generate **temporary unique IDs** (pre-allocated alias records, e.g., "Trauma Zulu-17") that are later merged into permanent IDs, and use the same mechanism for downtime registration (SAFER Patient ID 2.2) [4]. Each alias must be unique and non-confusable across simultaneous arrivals.
6. **Newborns.** Auto-create the newborn at delivery, linked to the mother, using a **distinct naming** convention (mother's first and last name plus sex, e.g., "Smith, Judy Girl"; "Girl A/B" for multiples). Do not use "Babygirl" [8][58]. Distinct naming reduced wrong-patient orders in the NICU by 36.3% [60], and adoption rose from 18.3% to 90.5% of US hospitals between 2013 and 2023 [59]. Known pitfalls are name truncation on bands and screens, which produced identical names for twins, and errors at the temporary-to-legal name change [59]. Field lengths and band layouts must therefore be designed for long names.
7. **Duplicate detection and resolution.** Probabilistic matching runs in real time and in batches. Potential duplicates go to an HIM data-integrity work queue. A **merge** links the surviving and retired records and remaps all clinical data, orders, results and accounts. Merges must be **reversible** (unmerge), with propagation to downstream systems through HL7 A40/FHIR `Patient.link` and full audit (see doc 11, §3.1).
8. **Overlays** (one person's data in another's record) are treated as a safety incident: freeze, split clinical data by provenance, notify affected clinicians, and complete root-cause analysis (RCA).
9. **Deceased flagging and record locking.** SAFER requires that deceased status is clearly indicated [4].

**Evidence on scale:** Industry estimates put duplicate rates at 8–12% of records. RAND found an 8% average, rising to 15–16% in large systems. A Children's Medical Center Dallas study measured a cost of about $96 per duplicate and found that clinical care was negatively affected in 4% of confirmed duplicate cases [62]. A second AHIMA article gives 5–10% for most hospitals and about 20% for multi-facility or merged systems, and calls 5% the "acceptable" rate in physician offices [61]. **Correction (pass 2):** an earlier draft said AHIMA's target is ≤1%. Neither cited AHIMA article states that. ≤1% is a commonly quoted industry best-practice goal and should be set as an internal target, not attributed to AHIMA [K].

**CDS and safety:** similar-name alerts on the banner and lists ("name alert"), visually distinct display of adjacent similar names [4], wrong-patient re-entry checks, and retract-and-reorder monitoring (wrong-patient order rate) [K]. Note that SAFER removed its "one open chart per workstation" recommendation after a trial showed no reduction in wrong-patient errors [6]. Use cheaper mitigations (photo, banner design, ID re-verification) instead.

**KPIs:** duplicate creation rate per 1,000 registrations; open duplicate-queue age; overlay count; percentage of registrations with photo; wrong-patient retract-and-reorder rate [K].

**Best in class:** referential + probabilistic EMPI, photo and biometrics, real-time duplicate prevention at the point of registration, reversible merges with downstream propagation, and an HIM identity-integrity dashboard.

### 3.2 ADT (admit / discharge / transfer)

**Purpose:** Maintain the authoritative **encounter timeline**: where the patient is, under whom, at what level of care and status (inpatient vs observation vs outpatient-in-a-bed). This drives billing, staffing, bed availability, census, isolation and every downstream system.

**Key workflows**

1. **Pre-admission / pending admit** (elective surgery, transfers in). Create a pre-registration with an expected date and level of care.
2. **Decision to admit**, typically from the ED or clinic. Capture the **time stamp** because it drives ECAT boarding [30], level of care, admitting service and attending, and isolation needs.
3. **Bed request → bed assignment → bed ready → patient arrives.** Each step is a timed event.
4. **Admit (A01)**, with patient class (inpatient/observation) and the status-change workflow (e.g., observation to inpatient), including payer notification [K].
5. **Transfers:** intra-unit bed swap, inter-unit transfer (with **transfer med rec** and handoff), level-of-care change, and service/attending change (A02/A08) [K].
6. **Leave of absence (LOA) / pass.** Suspend medication administration due times, keep the bed, and record return.
7. **Pending events:** pending transfer, pending discharge (expected discharge date drives discharge planning), and pending A&D cancellations.
8. **Discharge (A03)** with disposition (home, SNF, rehab, hospice, AMA, death, transfer), time, and auto-trigger of bed cleaning.
9. **Corrections:** cancel admit/transfer/discharge with a reason. Back-dated events require supervisor rights and are audited.
10. **Census reconciliation** at midnight, and downtime re-entry with clinical-time vs system-time distinction (doc 11, P2).

**Data:** encounter class, location history, attending/admitting/consulting providers, accommodation, isolation status, expected and actual times, disposition, diagnoses, and admission source.

**Integrations:** HL7 v2 ADT broadcast (A01–A13, A17 swap, A40 merge) and FHIR Encounter with Subscriptions to lab, pharmacy, RIS, PACS, dietary, nurse call, RTLS, smart rooms, billing and HIE [K].

**KPIs:** decision-to-admit to bed-assign time; bed-assign to arrival; discharge order to physical departure; discharges before noon (%); bed turnaround (EVS dirty-to-clean); observation-to-inpatient conversion; occupancy (%); ALOS vs GMLOS [K].

**Best in class:** a real-time **capacity command centre** combining the bed board, EVS and transport tasks, predicted discharges, and ED boarding alerts. NPG.01.03.01 requires hospitals to measure and set goals for bed supply, throughput, supporting services and ED boarding, with leadership review [8].

### 3.3 Scheduling, referrals, waitlists and check-in

**Key workflows**

1. **Template build.** Provider templates (slot types, durations, visit types, overbook slots, holds), resource templates (rooms, equipment, imaging modalities, chairs for infusion, dialysis stations) and **OR block templates** (service/surgeon blocks, release rules, add-on and emergency rooms).
2. **Referral intake.** Receive electronic and paper referrals, triage them clinically (urgency category), check eligibility and authorisation, and **track to completion** (SAFER CPOE 2.4) [3].
3. **Booking:** rules-based visit-type selection (decision trees), multi-resource booking (provider + room + equipment), linked appointments (lab before visit), recurring series (dialysis, chemo, therapy) and patient self-scheduling.
4. **Overbooking** within configured limits by clinic and provider, driven by no-show prediction (est.: predictive overbooking is common in mature systems) [K].
5. **Waitlist management.** Each waitlist entry has a priority, a clinical urgency and the date the patient was placed on the list. When slots free up, the system auto-offers them. For NHS-style and other public systems, referral-to-treatment (RTT) clock rules apply [K].
6. **Reminders, pre-visit questionnaires, e-check-in and kiosk check-in.** Then rooming and queue management (ticketing and call-forward screens for high-volume Asian and Middle Eastern outpatient departments).
7. **Cancellations, no-shows and reschedules**, with reason codes.

**KPIs:** third-next-available appointment; no-show rate; slot fill rate; referral-to-appointment time; referral leakage; percentage of referrals closed-loop; OPD queue wait time [K].

---

## 4. Ambulatory / outpatient visit

**Purpose:** An efficient, safe and complete clinic encounter that produces orders, prescriptions, a plan, an after-visit summary (AVS) and a closed loop on results.

**Workflow (step by step)**

1. **Pre-visit planning.** The chart is prepped by an MA/RN: care gaps (screenings, immunisations), outstanding results and referrals, and pre-visit questionnaires (e.g., PHQ-9, PROMs).
2. **Arrival / check-in.** Identity re-verification with photo, insurance and consents.
3. **Rooming (MA/RN).** Vitals (height, weight and BMI; BP with repeat logic), allergies reviewed and coded with reaction and severity [3], medication list reviewed (patient-reported/BPMH), reason for visit, screenings (falls, depression, tobacco, SDOH), and immunisation status.
4. **Provider documentation.** History of present illness (HPI), review of systems (ROS) where needed, examination, data review (results, outside records via HIE), and **assessment and plan per problem** linked to the coded problem list (SNOMED CT → ICD-10/11).
5. **Orders.** Labs, imaging, referrals, procedures and follow-ups through order sets/favourites, with diagnosis linkage for medical necessity [K].
6. **E-prescribing.** Drug checks, formulary/benefit check, EPCS for controlled drugs and PDMP query (NPG.06.01.01 EP6 requires facilitating PDMP access) [8]. Transmit to the pharmacy and receive fill status.
7. **Patient education and shared decision-making.** AVS with plan, medications (NPG.14.05.01 EP4: written medication information at the end of an outpatient encounter) [8], instructions and follow-up.
8. **Check-out.** Follow-up appointment and referral scheduling, and orders released.
9. **Sign and close the encounter.** Charge capture and coding (E/M), and co-signature for trainees.
10. **Post-visit and in-basket.** Results return to the ordering clinician (or a defined responsible clinician) with **abnormal flagging, sorting and filtering**, surrogate coverage, reminders, and patient notification of normal and abnormal results with monitored timeliness (SAFER Test Results 2.2–2.12, 3.4) [5].

**CDS:** health maintenance and care-gap reminders, drug–drug/allergy/disease interaction and renal dosing checks, guideline order sets (diabetes, hypertension), risk calculators (ASCVD), and referral appropriateness criteria [K].

**Safety:** test-result follow-up ownership (SAFER HP 2.4) [2], tracking of referral loop closure [3], inbox optimisation to reduce burden (SAFER HP 2.2) [2], and patient portal messaging safety (SAFER HP 3.3: monitoring of messages, referrals and portal notifications) [2].

**KPIs:** visit cycle time; documentation time per visit and after-hours "pajama time" (EHR audit-log metrics) [K]; open encounters older than 72 h; unacknowledged abnormal results older than 7 days [K]; percentage of referrals closed; care-gap closure rates.

**Best in class:** pre-charting automation, ambient documentation with clinician review [50], team-based inbox pools, result auto-release with clinician-defined holds (aligned to information-blocking rules [K]), and closed-loop referral tracking.

---

## 5. Emergency Department

### 5.1 Purpose and data spine

The ED is a **time-critical, high-interruption** setting. The EHR must support rapid registration (quick-reg/alias), triage, a live tracking board, parallel work streams, disease pathways with clocks, and fast disposition. Every event needs a reliable time stamp, because ECAT, stroke, STEMI, sepsis and trauma quality all depend on it [30][32][34].

**Core time stamps:** arrival; quick registration; triage start and end; room placement; first provider contact; first ECG (chest pain); CT start and read (stroke); first antibiotic, lactate and cultures (sepsis); decision to admit; bed request, assign and ready; ED departure; LWBS/LWBS-after-triage; discharge; and AMA [30][33][K].

### 5.2 Triage

**Triage systems we must support (configurable per country):**

| System | Levels | Time-to-clinician targets | Notes |
|---|---|---|---|
| **ESI v5** (US; maintained by ENA) | 1–5 | Not time-based; resource-based | Decision points in order: A (lifesaving intervention?), B (high risk/confused/distress?), C (number of resources: ≥2 = ESI 3, 1 = ESI 4, 0 = ESI 5), D (danger-zone vitals: HR >100, RR >20, SpO₂ <92% in adults → consider ESI 2) [26]. v5 may enlarge the ESI-2 group [27]. |
| **Australasian Triage Scale (ATS)** | 1–5 | Immediate / 10 / 30 / 60 / 120 min; performance thresholds 100/80/75/70/70% [28] | National standard in Australia/NZ |
| **Manchester Triage System (MTS)** | Red/Orange/Yellow/Green/Blue | German version: 0/10/30/90/120 min [29]; UK original: 0/10/60/120/240 min [K] | Flowchart-by-presenting-complaint (about 50 charts) [K] |
| **CTAS** (Canada) | 1–5 | Immediate / 15 / 30 / 60 / 120 min with 98/95/90/85/80% fractiles [K] | Includes paediatric CTAS |

**Triage workflow:** quick registration (or alias) → triage nurse assessment (chief complaint from a coded list, vitals, pain, allergies, pregnancy status, infection-screen questions per NPG.05.02.01 "Identify–Isolate–Inform" at entry points [8], suicide screen [8], and falls risk) → **algorithmic level suggestion with nurse override and reason** → protocol (standing) orders where policy permits (e.g., ECG within 10 min for chest pain, analgesia, imaging for isolated limb injury) → room assignment or waiting room with **re-triage timers** [K].

### 5.3 Tracking board and flow

- **Tracking board columns:** room, patient (with similar-name flag), age/sex, acuity, chief complaint, timers (time since arrival, since last vitals, since order), status icons (orders pending, results new, critical result, consult called, bed requested, isolation, fall risk, sepsis flag) and assigned MD/RN.
- **Streams:** resus, acute, fast track (ESI 4–5 / ATS 4–5), paediatric, behavioural health, results-pending/"internal waiting", and observation unit.
- **Provider-in-triage** / rapid medical evaluation with split-flow (est.: a common lever for LWBS reduction) [K].
- **Consults** with a request time and response-time clocks.
- **Disposition:** discharge (instructions, prescriptions), admit (decision-to-admit time, bed request, handoff to inpatient team via I-PASS), transfer out (EMTALA documentation in the US [K]), observation, AMA and LWBS.
- **Boarding management:** boarding patients receive inpatient-equivalent care (inpatient orders, MAR, nursing assessments) while physically in the ED. NPG.01.03.01 EP2 requires boarding goals with attention to acuity [8]. ECAT flags boarding >240 min. Results are stratified into four strata (paediatric/adult × with/without a mental-health principal diagnosis), and encounters with observation stays are excluded from the boarding and LOS criteria [30]. ACEP considers boarding a patient-safety crisis [75].

### 5.4 Time-critical pathways

| Pathway | Key time stamps and targets | EHR features |
|---|---|---|
| **Stroke** | AHA Target: Stroke Phase III (launched 2019): door-to-needle ≤60 min in ≥85%, ≤45 min in ≥75%, ≤30 min in ≥50%; door-to-device (arrival to first thrombectomy-device pass) ≤90 min (direct) / ≤60 min (transfer) in ≥50% [32][88]. Interval goals: door-to-physician ≤10, stroke team ≤15, CT start ≤25, CT read ≤45 min [33] | Pre-arrival notification, "code stroke" order set, NIHSS calculator, last-known-well capture, thrombolytic weight-based dose calculator with double check, tenecteplase/alteplase content, automatic timers on the board |
| **STEMI / chest pain** | First ECG ≤10 min of arrival; door-to-balloon ≤90 min; first-medical-contact-to-device ≤120 min when transferred [K] | ECG device integration (ECG to EHR with image), cath lab activation page, registry export (e.g., NCDR Chest Pain-MI) [K] |
| **Sepsis** | CMS SEP-1 (Specifications Manual v5.18, with the v5.18a addendum of Sept 2025, applies to discharges 1 Jan–31 Dec 2026; v5.19 is posted for 2027 discharges) [84]: within 3 h of time zero: lactate, blood cultures before antibiotics, broad-spectrum antibiotics, 30 mL/kg crystalloid if hypotension or lactate ≥4. Within 6 h: repeat lactate if elevated; vasopressors and volume/perfusion reassessment for septic shock [35][77]. In a 590-patient, 4-ED cohort, the commonest reasons for bundle failure among the 255 non-compliant cases were the 30 mL/kg fluid requirement (31.0%), no repeat lactate (19.6%) and antibiotics not given within 3 h (16.5%) [35] | Screening (qSOFA/SIRS/NEWS2 + lab triggers), sepsis order set with bundle clock, a "time zero" visible to the team, abstraction support. CDC's Hospital Sepsis Program Core Elements (2023) set out the program structure [34] |
| **Trauma** | Trauma activation level, times to CT and OR, massive transfusion protocol activation [K] | Trauma flowsheet (primary/secondary survey), alias registration, MTP order set linked to blood bank, registry export (e.g., NTDB/TQIP) [K] |

### 5.5 Mass-casualty incident (MCI) / disaster mode

1. Command switches the ED (or the facility) into **disaster mode**.
2. **Pre-built alias records** (pre-allocated MRNs/encounters with unique alias names and pre-printed barcoded bands) are assigned at the door (SAFER Patient ID 2.2) [4].
3. Disaster triage tags (START/SALT, colour categories) are recorded, along with minimal data sets [K].
4. Track patient location and family reunification; send to regional systems.
5. Use simplified order sets and documentation; record **downtime/BCA** (business continuity access) read-only snapshots for systems that fail (SAFER Contingency Planning) [1].
6. After the event, reconcile aliases with true identities using the merge workflow.

NPG Goal 3 requires an emergency management programme with evaluation of plans [9].

**ED KPIs:** door-to-provider; LWBS (%); ED LOS (admitted and discharged); boarding time (median, % >4 h); ECAT composite [30]; triage accuracy (under/over-triage); 72-h return with admission; stroke DTN; sepsis bundle compliance; ECG ≤10 min.

**Best in class:** a predictive arrival and crowding forecast, an automatic boarding escalation ladder, pathway timers on the board, protocol orders at triage with auto-co-sign routing, and an MCI mode tested in drills.

---

## 6. Inpatient care

### 6.1 Admission

1. **ED-to-inpatient or direct admission.** Admission order set (level of care, attending, diet, activity, VTE assessment, code status, isolation, nursing protocols, admission med rec).
2. **Admission H&P** within 24 h of admission or within 30 days prior plus an update note (CMS CoP) [K]. Templates are problem-oriented and pull in, with attribution, data from ED notes and outside records.
3. **Problem list curation.** A single coded, longitudinal problem list plus a hospital problem list (principal problem flagged), with drug–disease CDS driven from it (Leapfrog Drug Diagnosis category) [10].
4. **Admission medication reconciliation** (§6.4).
5. **Nursing admission assessment** (§10) within the policy time (commonly 24 h) [K].
6. **Code status and advance directive** capture, prominently displayed on the banner.

### 6.2 Daily care: progress notes, flowsheets, rounding, interdisciplinary care

- **Rounding lists** by team, unit and service, with configurable columns (vitals trend, NEWS2, new results, lines/drains/airways and **line days**, Foley days for CAUTI prevention, VTE prophylaxis status, discharge readiness).
- **Interdisciplinary rounds checklist** (e.g., device necessity, sedation/delirium, mobility, nutrition, VTE, glucose, antibiotic time-out at 48–72 h, discharge barriers) [K].
- **Progress notes:** a problem-oriented SOAP/APSO structure, interval events auto-summarised with source links, and today's data pulled with time stamps. Copy-forward is visible (highlighted inherited text) (§15.3).
- **Consults:** consult orders with question, urgency, and acceptance and response times; consult notes are routed back to the requester; curbside vs formal is distinguished.
- **Care plans:** interdisciplinary plan with goals per problem (nursing, therapy, dietetics, social work), reviewed daily.

### 6.3 Handoff (I-PASS)

**Evidence:** In a nine-hospital study (10,740 admissions), I-PASS reduced the medical-error rate by 23% (24.5 to 18.8 per 100 admissions) and preventable adverse events by 30% (4.7 to 3.3), without lengthening handoffs [36]. NPG.01.04.01 requires a handoff process that gives the giver and receiver the opportunity to discuss [8].

**EHR requirements:**

1. A structured handoff tool with **I**llness severity (stable/watcher/unstable), **P**atient summary, **A**ction list (to-dos with owners and due times), **S**ituation awareness and contingency ("if/then"), and **S**ynthesis by receiver (acknowledgement).
2. Auto-populated fields (allergies, code status, active drips, lines, recent critical results) with attribution.
3. A printable/mobile sign-out list.
4. Handoff audit: who handed off to whom and when (est.: this is rare in vendor products and is a differentiator).
5. A nursing handoff variant (SBAR or I-PASS) at the bedside, with patient involvement [K].

### 6.4 Medication reconciliation (admission, transfer, discharge)

**Standard:** NPG.14.05.01 requires the hospital to obtain current medications at admission (good-faith effort), compare them with ordered medications to resolve omissions, duplications, contraindications, unclear information and changes, provide written medication information at discharge, and explain its importance [8].

**Evidence:** In a WHO High 5s cohort, patients had a mean of 4.6 discrepancies, with omission the commonest error (69.8%) [46]. WHO High 5s defined measures for reconciliation within 24 h of the decision to admit, and for the number of outstanding unintentional discrepancies [45]. Pharmacist- or technician-led reconciliation prevents discrepancies, but outcome evidence is mixed, and EHR tools often lacked reconciliation functionality [47].

**Workflow:**

1. **Best Possible Medication History (BPMH)** by a pharmacist, pharmacy technician or nurse. Sources: patient/caregiver interview, external dispensing history (e.g., Surescripts in the US, national e-prescription records), HIE, prior discharge lists and pill bottles. Record **source and confidence** per item, and last dose taken.
2. **Admission reconciliation.** For each home medication, the prescriber decides: continue (converted to an inpatient formulary order with therapeutic interchange), modify, hold (with reason) or discontinue. Every decision must be **explicit**, and the system blocks completion with undecided items.
3. **Transfer reconciliation** (ICU to ward, OR to ward). Review all active inpatient orders, because post-op and ICU orders are commonly auto-discontinued [K].
4. **Discharge reconciliation.** Compare home list and inpatient orders to the discharge list, with changes flagged as **new/changed/stopped/unchanged**. Generate prescriptions and a patient-friendly list in the patient's language.
5. Send the list to the PCP or next provider (C-CDA/FHIR) and the community pharmacy.

**KPIs:** percentage of admissions with BPMH within 24 h; unintentional discrepancies per patient (audit sample); percentage of discharges with a reconciled list; post-discharge ADE calls [45].

### 6.5 Discharge planning, discharge summary and readmission

1. **From admission:** expected discharge date, discharge-risk screen (e.g., LACE or HOSPITAL score [K]), and early case-management and social-work involvement.
2. **Discharge readiness checklist:** clinical criteria, medications ready (meds-to-beds), education completed (teach-back), equipment, transport, follow-up appointments booked, and post-acute referral accepted (§16).
3. **Discharge order** with disposition, then **discharge summary** (diagnoses, procedures, hospital course, results pending at discharge with an owner, medication changes, follow-up). Results pending at discharge are a known safety gap, and SAFER requires unambiguous follow-up responsibility [5].
4. **AVS** with medication list (NPG.14.05.01) [8], warning signs and contacts.
5. **Transmission** to the PCP, post-acute provider and patient portal. Post-discharge call or text.
6. **Readmission surveillance:** a flag on return within 30 days, and readmission-risk models used for transitional care [K].

**KPIs:** discharge summary completed within 24–48 h (%) [K]; discharges before noon; 30-day readmission (all-cause and condition-specific); percentage with follow-up appointment booked; results-pending-at-discharge acknowledgement rate.

---

## 7. CPOE & order management

### 7.1 Scope

**Orders** include medications, labs, imaging, procedures, nursing interventions, diet, activity, consults, referrals, blood products, isolation, admission/transfer/discharge, therapy, respiratory and code status. SAFER CPOE 1.1 says structured orders should be maximised and free text minimised, with free-text use reviewed and alerts when a structured equivalent exists [3].

### 7.2 Key capabilities

1. **Order catalogue / orderables master.** Coded (LOINC for labs, RadLex/local plus CPT/SNOMED for imaging, RxNorm/dm+d/national product codes for medications), with defaults, required fields, specimen requirements, synonyms (including brand names and abbreviations) and **Tall Man lettering** (SAFER CPOE) [3].
2. **Order sets / protocols / pathways.** Versioned and evidence-linked with an owner and review date (SAFER CPOE 1.3) [3]. Pre-selected vs optional items, conditional logic (weight, renal function), and **nurse-driven protocols** (e.g., electrolyte replacement, insulin, anticoagulation nomograms, Foley removal).
3. **Panels** (e.g., BMP) and linked orders (drug + level monitoring). Leapfrog expects drug-monitoring prompts for aminoglycosides, digoxin, lithium, phenytoin and warfarin, or a protocolised pharmacist monitoring response [10].
4. **Order timing types:** STAT/ASAP/routine/timed; **future orders** (outpatient, release at next encounter); **standing / recurring orders** (e.g., daily labs × N days, with an expiry date and renewal reminders); **conditional orders** ("if K <3.5 then…"); **PRN** with indication and maximum frequency; **titratable** with parameters; and **taper** schedules.
5. **Phase-of-care / signed-and-held orders** (pre-op → intra-op → PACU → post-op; transfer orders released on arrival).
6. **Verbal / telephone orders:** allowed by policy only for defined situations. **Read-back** is captured (checkbox plus attestation), along with the order's source and receiver and co-signature by the prescriber within the policy/state time limit, tracked in the HIM deficiency queue [K]. Oncology: verbal orders are not allowed except to hold or stop antineoplastics [52].
7. **Cosign and supervision:** trainee and APP orders routed for co-signature where required, and pharmacist/nurse protocol orders routed to a responsible provider.
8. **Duplicate checking:** exact and therapeutic duplicates across active, pending and recently resulted orders (e.g., "CBC resulted 2 h ago"), with configurable look-back windows per orderable [10][K].
9. **Weight, height and allergy capture** gates before medication ordering. Critical patient information (age, weight, allergies, pregnancy status) is visible during ordering [3].
10. **Diagnosis/indication capture** for antimicrobials (stewardship), PRNs and imaging appropriateness (e.g., US AUC for advanced imaging [K]).

### 7.3 Order lifecycle states

Align with FHIR `RequestStatus` and an internal richer state machine (see doc 11, §10.2): **draft → pending signature/co-sign → active (signed) → [pharmacy-verification pending] → in progress (specimen collected / dispensed / scheduled) → completed / resulted**, plus **on-hold/suspended** (e.g., NPO, OR, LOA), **discontinued / revoked**, **cancelled (never started)**, **expired** and **entered-in-error** [K]. Every transition records actor, time and reason.

### 7.4 Order-to-result tracking

SAFER Test Results 2.1 calls for tracking the status of orders and procedures (collected, received, completed, reported, acknowledged) [5]. Product requirements:

- An "orders not yet resulted" overdue view per clinician and unit (e.g., specimen ordered but never collected).
- Amended results notify the orderer and follow-up clinicians and display a clear amended flag (SAFER TR 2.3) [5].
- Text reports (radiology/pathology) coded at least as normal/abnormal (SAFER TR 1.2) [5].
- Identifiable ordering clinician and responsible clinician on every test (SAFER TR 2.2) [5].

### 7.5 Leapfrog CPOE Evaluation Tool expectations (2026, v5.3)

- **Standard:** ≥85% of inpatient medication orders entered by licensed prescribers via CPOE with decision support, **and** the hospital passes a timed simulated test showing it alerts on ≥60% of frequent serious errors [10][11].
- **Eight order-checking categories** [10]: Inappropriate Medication Combinations (drug–drug Level 1 contraindicated, e.g., simvastatin + itraconazole, MAOI + sumatriptan; Level 2, e.g., warfarin + levofloxacin, QT-prolonging pairs; and therapeutic duplication), Excessive Dosing (single and daily dose, e.g., tenfold digoxin), Drug Route (e.g., IV hydroxyzine), Drug Diagnosis (e.g., non-selective beta-blocker in asthma, prasugrel after stroke), Drug Age (Beers/STOPP), Drug Laboratory (incl. renal, e.g., KCl with hyperkalaemia), Drug Monitoring, and **Excessive Alerts** (low-priority combinations that should *not* interrupt).
- **Hard stops** are reserved for absolute contraindications such as MAOI + sumatriptan and intrathecal vincristine. Most alerts should be interruptive but overridable [10].
- **"Potentially Inaccurate Test Results"** (false-positive reporting) means the hospital is publicly reported as an Incomplete Evaluation with a 120-day retest lockout [10].
- **Evidence base:** CPOE reduced serious medication errors by 55% and later 88% in the Brigham studies [11]. Knowledge-base products tested "as designed" can still underperform once locally configured [13].
- **2026 changes and 2027 outlook (verified in pass 2):** v5.3 is the sixth release of the tool, which has been in the Leapfrog Hospital Survey since 2008. The 2026 scenarios were revised and non-formulary drugs removed, with no change to the scoring algorithm. The CPOE Expert Panel found non-interruptive alerts "less effective" and launched a multi-phase project: gathering examples, holding webinars through 2026, and preparing hospitals for "updated expectations in the 2027 CPOE Tool" [10].
- **Build implication:** ship a **Leapfrog-aligned default CDS configuration** and an internal regression test harness that replays the categories after every content update.

---

## 8. Clinical decision support (CDS)

### 8.1 Design principles

- **Five Rights of CDS (Osheroff):** the right information, to the right person, in the right intervention format, through the right channel, at the right time in the workflow [20].
- **SAFER HP 2.6 / CPOE 2.1:** alerts should be unambiguous, in context, actionable and "judiciously limited to the most significant, patient-specific notifications" [2][3]. SAFER CPOE 3.1 requires key CDS metrics to be defined and monitored, overrides to be classified and analysed, and users to be able to give in-line feedback [3].
- **Alert fatigue evidence:** override rates of 46–96% across studies (AHRQ: very low certainty on the exact rate, moderate certainty that it is clinically important) [17]. Ranges by type: drug–allergy 46–95%, DDI 56–96%, dose 82–97%, renal 74–97% [16]. Mitigations include specificity, patient-tailoring (e.g., renal-function-aware), tiering, interruptive only for high severity, and human-factors design [19].

### 8.2 CDS catalogue (what a top-tier EHR must support)

| CDS type | Examples | Delivery format |
|---|---|---|
| Drug–allergy (incl. cross-sensitivity) | Penicillin → cephalosporin (low cross-reactivity, so tier down) | Interruptive only for true allergy with severe reaction; coded reactions and severity required [3] |
| Drug–drug interaction | Level 1 contraindicated vs Level 2 monitor [10] | Severity-tiered; suppress low-value pairs (Leapfrog Excessive Alerts) [10] |
| Drug–disease | Beta-blocker/asthma; ketorolac/GI bleed [10] | Problem-list-driven |
| Dose range | Single, daily, cumulative (anthracyclines), **weight-based, BSA-based, renal/hepatic, age-based, paediatric/neonatal (corrected age)** [3][10] | Inline at order composition, with a dose calculator showing working (variables used) [3][52] |
| Duplicate therapy | Two ACE inhibitors, two statins, two benzodiazepines [10] | Inline, de-duplicated across PRNs |
| Drug–lab | KCl with high K⁺; nephrotoxins with rising creatinine [10] | Patient-specific |
| Drug–route / formulation | Vincristine IT (hard stop), IV hydroxyzine [10] | Hard stop for documented fatal routes |
| Drug–pregnancy/lactation | Teratogens | Requires pregnancy status capture [3] |
| Monitoring reminders | INR for warfarin, levels for aminoglycosides [10] | Auto-suggested linked lab order |
| Best-practice advisories | VTE prophylaxis on admission, Foley-day reminder, CAUTI/CLABSI bundles, immunisations | Prefer embedding in order sets and checklists over pop-ups |
| Early warning scores | NEWS2, PEWS, MEOWS/MEWS | Calculated in flowsheet; escalation tasks |
| Sepsis screening | SIRS/qSOFA/NEWS2 + lactate; predictive models | Team-level notification with a time-zero display; local validation required [22] |
| Antimicrobial stewardship | Indication required, restricted agents, 48–72 h time-out, IV-to-PO, bug–drug mismatch | Pharmacist worklists more than physician pop-ups |
| Imaging appropriateness | AUC/iRefer-style decision support [K] | At order-select |
| Predictive / AI | Deterioration, readmission, no-show, sepsis | Must carry source attributes, validation and monitoring (ONC HTI-1 DSI criterion §170.315(b)(11): 13 source attributes for evidence-based DSIs and 31 for predictive DSIs [K]. The HTI-5 proposed rule would remove these requirements and was not yet final as of Oct 2026 [85]. SAFER HP 1.5 AI governance [2]) |

### 8.3 Early warning scores

- **NEWS2 (RCP 2017):** parameters are RR, SpO₂ (Scale 1 or Scale 2 for hypercapnic respiratory failure), air vs oxygen (+2), systolic BP, pulse, consciousness (ACVPU, with new confusion scoring 3) and temperature. Response: **0** → monitor at least every 12 h; **1–4** → every 4–6 h, RN decides; **single parameter 3** → at least hourly, urgent ward-based review; **5–6** → urgent response, inform the medical team; **≥7** → emergency response by a team with critical care competencies [23][24][25]. NEWS2 ≥5 is the RCP's recommended trigger for urgent review of possible sepsis [25].
- **PEWS:** age-banded paediatric scores. England adopted a national PEWS (the System-wide Paediatric Observations Tracking, "SPOT", programme) [K]. Support multiple PEWS variants by configuration.
- **MEOWS / maternity EWS:** obstetric-specific thresholds, and a national maternity early warning score in England [K]. Do not apply NEWS2 in pregnancy [K].
- **MEWS:** legacy US variants. Many US systems also use proprietary deterioration indices [K].
- **v1 regulatory scope (reconciled 2026-10-16 with `07` §9.1 #7, `08` §1 #14 and `09` §0 #8).** v1 ships NEWS2/PEWS as transparent published-score calculators on nurse-entered or nurse-validated vitals, showing their components, with escalation tasks. They are versioned as a regulated module and released first in non-US markets. v1 has no automated continuous alarms from device streams, and US deployments use cleared partners. Each market (FDA, EU MDR Rule 11, SFDA, CDSCO, UAE) still needs a classification.
- **Requirements:** auto-calculation from validated vitals (device-integrated where possible; in v1, device vitals must be nurse-validated before scoring); display of the score's components; **escalation as a tracked task** (who was notified, when, response time); frequency-of-observations scheduling driven by the score; and family-initiated escalation pathways such as NHS England's Martha's Rule (2024 onward) [K]. NPG.01.05.02 requires written criteria for early warning signs and the response. NPG.01.05.05 requires an interdisciplinary committee to review resuscitation cases and data. Its listed review examples include how often early warning signs were present before in-hospital cardiac arrest on non-monitored units, but that specific review is an example, not a mandated element [8].

### 8.4 VTE prophylaxis

Mandatory risk assessment on admission and transfer (e.g., Padua, Caprini or the UK national DoH tool) embedded in the admission order set. Contraindication capture, prophylaxis order or documented reason, and reassessment at 24 h and on clinical change [K]. KPI: percentage of admissions with VTE assessment and appropriate prophylaxis.

### 8.5 Antimicrobial stewardship

NPG.14.06.01 requires a multidisciplinary antibiotic stewardship committee and monitoring of antibiotic use as **days of therapy (DOT) per 1,000 days present or patient days**, or reporting to NHSN AU [8]. EHR features: indication and intended duration at order, restricted-drug approval workflow, a 48–72 h time-out task, culture-to-therapy mismatch alerts, IV-to-PO eligibility lists, and automated NHSN AU/AR files [K].

### 8.6 Standards and drug knowledge bases

- **CDS Hooks 2.0.1 (HL7 STU 2 Release 2, FHIR R4/R4B; still the current published version in Oct 2026):** hooks include `patient-view` and `order-sign` (maturity 5, mature), `order-select` (4), `encounter-start`, `encounter-discharge`, `appointment-book`, `allergyintolerance-create`, `medication-refill` and `problem-list-item-create` (1, submitted), and `order-dispatch` (0, draft). `medication-prescribe` and `order-review` are deprecated. Cards can be info, suggestion (create/update/delete actions) or app link (SMART launch). A **feedback API** reports accepted/overridden outcomes with an `overrideReason` coding and an optional user comment [21]. Support is uneven across vendors (a third-party report says Oracle's support is partial) [76]. We should be a first-class CDS Hooks client.
- **CQL (Clinical Quality Language, HL7):** used for eCQMs and CPG-on-FHIR. Author shareable logic once for both measurement and CDS [K].
- **Drug knowledge bases (licensed):** First Databank (FDB MedKnowledge; FDB Multilex in the UK), Wolters Kluwer **Medi-Span** and **Lexicomp** (rebranded "UpToDate Lexidrug" [K]), Oracle/Cerner **Multum**, Merative **Micromedex**, Elsevier Gold Standard [K]. UK: **dm+d** (NHS Dictionary of Medicines and Devices) as the product dictionary with **BNF/BNFc** content [K]. Asia-Pacific: **MIMS/CIMS** [K]. Architecture: a pluggable drug-KB adapter, a local override layer (severity re-tiering, suppression lists) and versioned content releases with regression tests (§7.5).

### 8.7 CDS governance (must be a product feature, not a policy PDF)

1. A CDS committee with clinical owners per artefact (SAFER CPOE 1.3) [3].
2. An artefact registry: purpose, evidence, owner, target users, trigger, format, expected firing rate, and **retire-by date**.
3. Telemetry: firing rate, acceptance/override rate, override reason distribution, time-to-action and downstream outcome. CDS Hooks feedback gives a standard shape for this [21].
4. Silent-mode (shadow) deployment for new rules and models, with local validation before go-live. The Epic Sepsis Model case shows why: AUC 0.63, sensitivity 33%, PPV 12% [22].
5. A quarterly "alert burden" review that retires or re-tiers the alerts overridden most often.

---

## 9. Closed-loop medication management

### 9.1 The loop

**Prescribe (CPOE + CDS) → Pharmacist verification → Dispense (ADC / carousel / robot / IV room) → Administer (BCMA/eMAR, smart pump auto-programming) → Monitor (labs, vitals, response, ADE detection) → back to Prescribe.**

HIMSS EMRAM Stage 7 historically required >90% CPOE use and >95% closed-loop medication administration, blood product, human milk and specimen-collection scanning. Partial closed-loop coverage was a common reason for failing validation [15]. The modernised EMRAM retains Stage 7 as the "dynamic health record" with stricter criteria [14][80].

### 9.2 Step-by-step

1. **Prescribing:** structured order (drug, dose, unit, route, frequency, duration, indication, PRN reason, max dose), dosing weight explicit and dated, CDS (§8) and dose calculator with displayed working.
2. **Pharmacist verification:** a verification queue prioritised by STAT and first dose; full clinical view (labs, renal function, allergies, weight); intervention documentation (types, acceptance, estimated harm avoided); therapeutic interchange. **First doses are not available from the ADC until verified**, except defined override lists (emergency drugs). NPG.14.01.01 covers after-hours review by a qualified professional with retrospective pharmacist review when pharmacy is closed, and an **ADC override review policy** (100% review not required) [8].
3. **Dispensing:** unit-dose barcode-labelled; ADC profiling (pull only verified-order medications); robot/carousel picking with barcode; **IV compounding** with barcode and gravimetric verification and images (accepted as a surrogate for independent verification in the ASCO-ONS standards) [52]; standardised concentrations (NPG.14.02.01) [8]; and premixed/prefilled anticoagulants (NPG.14.04.01) [8].
4. **Administration (BCMA/eMAR):**
   1. The nurse opens the MAR (due/overdue/PRN/held, with due-time windows).
   2. **Scan patient wristband** (positive ID) and **scan medication** (right drug, dose, route, time, patient).
   3. System checks: wrong patient, wrong drug, wrong dose (partial or multiple units), expired product, early or late dose, allergy, duplicate administration, held order, high-alert medication requiring **independent double check** (documented in the EHR, SAFER CPOE 2.3 [3]), and pre-administration assessments (e.g., HR before digoxin, pain score before opioid, glucose before insulin).
   4. **PRN:** reason, pre-assessment and **reassessment task** (e.g., pain reassessment 30–60 min after the dose, per NPG.06.02.01 EP7) [8][K].
   5. **Titrations and infusions:** rate changes documented against the order's titration parameters; bag changes, boluses from the pump, and volume infused feeding I&O.
   6. **Smart pump interoperability:** the order is sent to the pump (auto-programming) with the drug library match. Pump status and rate return to the eMAR (auto-documentation) for nurse verification.
   7. Document not-given reasons (patient refused, NPO, held per parameters) and waste (controlled substances with a witness).
5. **Monitoring:** linked labs and levels, vitals and sedation scores for opioids (high-risk patient monitoring per NPG.06.02.01 EP6) [8], ADE trigger tools (naloxone, flumazenil, vitamin K, glucose <50 mg/dL triggers) [K].

### 9.3 Evidence

- **BCMA:** 41.4% relative reduction in non-timing administration errors (11.5% to 6.8%; 14,041 administrations observed), 50.8% reduction in potential ADEs (3.1% to 1.6%), and transcription errors eliminated (6.1% of transcriptions to 0) [39]. Note that Leapfrog's BCMA factsheet misquotes the first figure as 41.1% [12]. The NEJM abstract says 41.4%.
- **Workarounds:** 15 workaround types and 31 causes (unreadable barcodes, failing scanners, missing wristbands). Nurses overrode alerts for 4.2% of patients and 10.3% of medications charted [40]. In a London NHS longitudinal study (BMJ Health Care Inform 2025), scanning rates **declined over time** and per-ward medication scanning ranged from only 5.6% to 67%. "Barcode not readable" and scanner unavailability were the reasons given (the full text reports it as the most-selected reason, listed first in the dropdown; not re-checked in pass 2), and 37% of scanning alerts changed user action [41]. Weekly dashboards naming non-compliant users had the biggest effect on compliance [79].
- **Leapfrog BCMA standard:** BCMA in 100% of med/surg, ICU (adult/paediatric/neonatal), step-down, L&D, pre-op and PACU units; patient **and** medication scans in ≥95% of administrations; all five expert-panel decision-support elements; and ≥6 of 8 anti-workaround structures [12].
- **Smart-pump interoperability:** across the three studies in a 2025 systematic review, interoperability reduced specific administration errors by 15.4–54.8% and cumulative administration errors by 21.2–90.5% [42]. The review says manual programming errors account for "a substantial portion" of administration and documentation errors. **Correction (pass 2):** an earlier draft gave a 77.2% figure, which does not appear in the review's text [42]. In a 2026 AJHP study (Afaq et al.), integration cut programming steps (1.6 vs 3.3), raised dose-error-reduction-system compliance to 96.1% and cut hard-limit alerts by 50.3%. However, **auto-programming was used for only 53.4% of infusions** (68.3% for high-alert/REMS drugs) [43].

### 9.4 High-alert medications

The ISMP 2024 acute-care list [44] includes IV adrenergic agonists and antagonists, general anaesthetics, IV antiarrhythmics, all antithrombotics (anticoagulants, DOACs, direct thrombin inhibitors, GP IIb/IIIa inhibitors, thrombolytics), cardioplegic solutions, chemotherapy (parenteral and oral), hypertonic dextrose ≥20%, dialysis solutions, epidural/intrathecal medications, IV inotropes, insulin (U-500 special emphasis), liposomal formulations, paediatric oral sedation, IV moderate sedation, neuromuscular blockers, **opioids by all routes**, parenteral nutrition, hypertonic saline >0.9%, sterile water ≥100 mL, and oral sulfonylureas. Specific drugs listed include IM/SC epinephrine, IV epoprostenol, insulin U-500 (special emphasis), magnesium sulfate injection, oral non-oncologic methotrexate, nitroprusside, opium tincture, IV oxytocin, concentrated KCl, potassium phosphates, promethazine injection, **tranexamic acid injection** and IV/intraosseous vasopressin [44]. The 2024 list (MS5760) confirms TXA. It does not flag which entries are new, and the claim that TXA was added in 2024, absent from the 2018 list, was not re-checked against the 2018 edition [K].

**System behaviours for high-alert drugs:** standard concentrations only; tall-man names; hard limits in dose checking and pump libraries; documented independent double checks where policy requires; weekly-dosing guardrails for methotrexate (default weekly, indication required) [K]; NMB storage and labelling warnings; and insulin and anticoagulant protocols with lab linkage.

### 9.5 Controlled substances

EPCS (two-factor) and PDMP query at prescribing [8]; ADC count, discrepancy resolution and witnessed waste; diversion analytics (user vs peer pulls, waste patterns, pull-to-administration gaps) [K]; and chain-of-custody audit.

### 9.6 KPIs

CPOE rate (≥85% Leapfrog; >90% EMRAM legacy) [11][15]; patient and medication scan rates (≥95%) [12]; BCMA override rate by reason; pump auto-programming rate [43]; pump-library compliance; verification turnaround (STAT and first dose); ADC override rate and review completion [8]; omitted/delayed critical medications (e.g., antibiotics, Parkinson's medications [K]); ADEs per 1,000 patient-days (trigger tool) [K]; hypoglycaemia rate; naloxone use rate.

---

## 10. Nursing

### 10.1 Purpose

Nursing produces the largest volume of clinical data in the record. The design goal is **document once, reuse everywhere**, aligned to task lists and the time actually spent at the bedside.

### 10.2 Key workflows

1. **Admission assessment:** history, functional status, skin, falls, nutrition screen (e.g., MUST/MST [K]), pain, psychosocial and SDOH, learning needs, home medications, devices, isolation screen and suicide screen where indicated (NPG.08.01.01: validated screening for patients ≥12 being treated for behavioural health conditions, with assessment of positives and documented risk level and mitigation plan) [8].
2. **Shift assessments:** head-to-toe or system-focused with **documentation by exception** against defined normals [K]; reassessment intervals driven by acuity, scores and policy.
3. **Flowsheets:** vitals (device-integrated with nurse validation), I&O (oral, IV, blood, drains, urine, stool, with automatic running balance), lines/drains/airways (LDA) with insertion date, site, day count and removal, wound care (wound location on a body map, staging, measurements, **photography** with consent, dressing plan), neuro checks, restraint monitoring (§14.4), glucose and insulin, and sedation scales.
4. **Risk scores** (auto-calculated, triggering care-plan interventions):
   - **Braden** (pressure injury; six subscales; lower score means higher risk, ≤18 commonly "at risk") [K].
   - **Morse Fall Scale** (six items; high-risk cut-offs commonly ≥45, set locally) [K].
   - **Waterlow** (UK pressure-ulcer risk) [K].
   - Others: CAM-ICU/4AT (delirium), RASS, CPOT, Glasgow Coma Scale, and NEWS2/PEWS (§8.3).
5. **Care plans:** problem → goal → interventions → evaluation. Terminology options are NANDA-I/NIC/NOC (licensed), ICNP (ICN), Clinical Care Classification (CCC, free), or SNOMED CT-coded local problems [K]. **Recommendation:** use SNOMED CT-coded problem/intervention libraries with mappings to NANDA-I/NIC/NOC available as an option, because licensing and usability limit NNN in many markets [K].
6. **Task lists / worklists:** generated from orders, protocols, scores (e.g., a Braden ≤18 triggers a 2-hourly turn task), MAR, overdue documentation and pending escalations, prioritised by due time.
7. **Nursing handover:** a structured SBAR/I-PASS view at the bedside with patient involvement, including safety items (falls risk, isolation, lines, pending tasks) (NPG.01.04.01) [8].
8. **Patient acuity / classification for staffing:** acuity scored from documentation (est.: derived from data already charted, not separate forms), feeding staffing-to-demand tools. In the UK the Safer Nursing Care Tool is a common reference [K]. NPG Goal 12 ("staffed to meet the needs of patients") puts staffing adequacy on the accreditation agenda [8][81].
9. **Mobile nursing:** handheld BCMA, specimen collection with label printing at the bedside (labelled in the patient's presence per NPG.01.01.01 EP2) [8], vitals capture, photo capture, secure chat, and nurse-call/alarm integration with alarm management (NPG.01.05.01 alarm policies) [8].

### 10.3 Safety and KPIs

**Safety:** reconciled device data (no auto-filing of artefacts without validation), and alarm management policies covering who can change parameters and when alarms can be disabled [8].

**KPIs:** falls per 1,000 patient-days; falls with injury; hospital-acquired pressure injury (stage 2+) prevalence; CAUTI and CLABSI per 1,000 device-days; restraint prevalence; percentage of assessments on time; documentation time per shift (audit logs) [K]; scan compliance.

**Best in class:** documentation burden reduction (flowsheet rationalisation, the "25 by 5" initiative, which aims to cut documentation burden to 25% of its baseline within five years of its 2021 launch [K]), ambient nursing documentation now emerging (e.g., announced as "coming soon" in MEDITECH Expanse) [68], and acuity-driven assignment.

---

## 11. Critical care / ICU

**Purpose:** High-frequency, device-rich care with complex infusions and organ support.

**Workflows and capabilities**

1. **Device integration:** physiological monitors (HR, BP arterial/NIBP, SpO₂, EtCO₂, CVP, temperature), ventilators (mode, FiO₂, PEEP, tidal volume, plateau pressure), infusion pumps, CRRT, ECMO, IABP/Impella and bladder pressure, through a device-integration engine with **nurse-validated** charting at configurable intervals (e.g., q1h validated, q1–5 min stored) [K]. Doc 11 requires device provenance. The 2025 SAFER revision adds integration of FDA-approved device data [6].
2. **ICU flowsheet:** 24-h grid with drips (rate, dose, concentration and units), titration documentation against parameters, I&O with hourly balances, LDA days, ventilator bundle elements (head of bed, SAT/SBT, oral care), and the ABCDEF bundle (pain, awakening, breathing, choice of sedation, delirium, early mobility, family) [K].
3. **Scoring:** **SOFA** (daily), **APACHE II/IV** and SAPS for severity/benchmarking, RASS/CAM-ICU, and CPOT. A **SOFA-2** update was published in 2025 (Ranzani et al., JAMA 2025;334(23):2090–2103). It was developed and validated on 3.34 million ICU encounters in 1,319 ICUs across 9 countries, with AUROC for ICU mortality of 0.79 vs 0.77 for the original SOFA. Gastrointestinal and immune components were not included [86]. Clarification letters appeared in 2026, so support both SOFA and SOFA-2 by configuration while local adoption settles. Automate scores from structured data and show the component values.
4. **Multidisciplinary rounds** with daily goals sheet, line/catheter necessity, and antibiotic time-out.
5. **Tele-ICU:** a remote clinician cockpit with a multi-patient view, acuity flags, two-way video, and documentation/order privileges [K].
6. **Transfer out** with transfer med rec and handoff.

**KPIs:** standardised mortality ratio (APACHE/SAPS-predicted) [K]; ICU LOS; ventilator days; VAE, CLABSI and CAUTI rates; unplanned extubations; ICU readmission within 48 h; delirium prevalence; sedation-target attainment.

**Best in class:** a vendor-neutral device middleware layer (IHE PCD profiles / IEEE 11073 SDC where supported [K]), high-resolution waveform storage separate from the legal record, closed-loop pump interoperability, and AI-assisted deterioration surveillance that is validated locally [22].

---

## 12. Perioperative

### 12.1 Workflow

1. **Surgical scheduling:** case request (procedure codes, laterality, duration estimated from surgeon history, equipment, implants, blood, anaesthesia type, positioning), **block schedule** management (release times, utilisation), add-on/urgent case classes (e.g., NCEPOD categories in the UK [K]), and preference cards linked to supply chain.
2. **Pre-op assessment clinic:** anaesthesia pre-assessment (ASA class, airway, comorbidities), risk calculators (e.g., RCRI), pre-op tests and medication instructions (anticoagulant management per NPG.14.04.01 EP2 perioperative protocols) [8], and optimisation pathways (e.g., anaemia, diabetes).
3. **Consent:** procedure-specific e-consent with risks discussed, signature (patient/witness/clinician), interpreter, versioning, and display in the OR (NPG Goal 7 safe informed care) [9][K].
4. **Pre-op holding:** checklist (identity, consent, site marking, NPO, allergies, labs, blood availability, implants, antibiotics). NPG.01.06.01 requires a **standardised list** confirming relevant documentation (H&P, consent, nursing and pre-anaesthesia assessments), labelled imaging and results, and any required blood, implants, devices and equipment [8].
5. **Site marking** by the accountable practitioner, with an unambiguous mark visible after draping and an alternative process for mucosal surfaces, teeth and premature infants (NPG.01.06.02) [8].
6. **WHO Surgical Safety Checklist** [37]:
   - **Sign in** (before induction): identity, site, procedure and consent confirmed; site marked; anaesthesia machine and medication check; pulse oximeter working; known allergy; difficult airway/aspiration risk; risk of >500 mL blood loss (7 mL/kg in children).
   - **Time out** (before incision): team introductions; confirm patient, site and procedure; anticipated critical events (surgeon, anaesthesia, nursing); antibiotic prophylaxis within 60 minutes; essential imaging displayed.
   - **Sign out** (before the patient leaves the OR): procedure recorded; instrument, sponge and needle counts; specimen labelling; equipment problems; key concerns for recovery.
   - The 2009 eight-hospital study found mortality fell from 1.5% to 0.8% and complications from 11.0% to 7.0% [37]. Later mandated rollouts (e.g., Ontario) showed weaker effects, and implementation fidelity matters [38]. NPG.01.06.03 specifies time-out participants and the minimum agreement items [8].
   - **EHR design:** checklist steps captured in real time by role, with hard stops before incision time can be documented (est.: a common design) [K].
7. **Intra-op nursing record:** time stamps (in room, anaesthesia start, incision, closure, out of room), personnel, positioning, skin prep, tourniquet times, counts, specimens (barcode), implants (UDI scanned; lot/serial), wound class, and drains/catheters. Perioperative medication labelling on and off the sterile field is required by NPG.14.03.01 [8].
8. **AIMS:** auto-captured vitals and ventilator data at high frequency, drug administration with barcode syringe labels, fluids and blood, events and airway, anaesthesia quality measures, and billing time units [K].
9. **PACU:** Aldrete/PADSS scoring [K], pain and PONV management, handoff from anaesthesia to PACU, and discharge criteria to ward or home.
10. **Implant and supply capture → case costing:** item-level capture from the preference card, with actual usage reconciled against waste. Costs feed ERP (doc 05) for per-case margin.

### 12.2 OR KPIs

These are common benchmarks; targets are institution-specific (est.):

- First-case on-time start (%).
- Turnover time (wheels-out to wheels-in).
- Block utilisation (commonly targeted at about 75–85%).
- Prime-time utilisation.
- Same-day cancellation rate.
- Case duration estimate accuracy.
- Add-on wait time.
- Surgical site infection rate.
- Retained foreign object and wrong-site never events (target zero).
- Checklist compliance (all three phases, observed).
- Implant documentation completeness.

---

## 13. Maternity & neonatal

### 13.1 Antenatal

A pregnancy episode spanning the antenatal, intrapartum and postnatal periods, with EDD (LMP vs ultrasound-dated), G/P/A, risk assessment and risk category, booking bloods, screening results, ultrasound reports, fundal-height and fetal-growth charts (customised charts in some countries) [K], medications and immunisations, birth plan and a shared maternity record via the patient portal.

### 13.2 Labour and delivery

1. **Triage/assessment** (obstetric triage acuity tools exist; MEOWS for maternal observations) [K].
2. **Labour monitoring:**
   - Support the **WHO Labour Care Guide (LCG, 2020)**, the "next-generation partograph". Its seven sections are identifying information/labour characteristics, supportive care, care of the baby, care of the woman, labour progress, medication and shared decision-making. **Active first stage starts at 5 cm.** Evidence-based time limits per centimetre replace the old alert/action lines, and the "alert" column means deviations must be highlighted with a recorded response [63][64]. Approximate time limits per cm (about 6 h at 5 cm down to about 2 h at 9 cm) and second-stage limits should be configured from the WHO manual [65][K].
   - Also support legacy partograph and NICE-style charts by configuration [K].
3. **Fetal monitoring integration:** CTG/EFM central surveillance systems feeding tracings and annotations, plus structured interpretation (e.g., NICHD categories I–III in the US; FIGO/NICE classification elsewhere) [K].
4. **Delivery record:** mode, times (full dilatation, delivery, placenta), perineal trauma, quantitative blood loss (QBL) with a postpartum haemorrhage (PPH) bundle (note that tranexamic acid is now on the ISMP high-alert list) [44], oxytocin (high-alert, IV) [44], cord gases and Apgars.
5. **Newborn registration at birth:** mother–baby linking (shared episode, linked bands, infant security tags), distinct newborn naming [8][58], newborn assessment, vitamin K and immunisations, feeding, newborn screening, hearing screen and growth.

### 13.3 Postnatal and NICU

- Postnatal maternal observations (MEOWS), VTE assessment, breastfeeding support and contraception counselling.
- **NICU:** corrected gestational age display (SAFER CPOE) [3]; weight-based dosing with decimal precision (e.g., 0.1 mL/h rounding) [3]; TPN ordering and compounding; **human milk management** with barcode matching of milk to infant (an EMRAM Stage 7 scanning domain) [15]; growth charts (Fenton/INTERGROWTH-21st [K]); ventilator integration; and family-centred care documentation.

**KPIs:** caesarean rate (e.g., NTSV) [K]; PPH rate and severe maternal morbidity; 3rd/4th-degree tears; term admissions to the neonatal unit; time-to-delivery for category 1 caesarean [K]; human-milk scanning rate; newborn wrong-patient events.

---

## 14. Specialty modules

### 14.1 Oncology (chemotherapy / antineoplastic therapy)

The ASCO-ONS 2024 standards [52] are effectively a functional specification:

- **Regimen and protocol library:** versioned, evidence-referenced, with cycles, days and supportive care built in (premedication, hydration, growth factors, hypersensitivity medications) [52].
- **Order content** (Standard 3.9): two identifiers, date signed, prescriber, regimen/protocol name, **cycle and day**, full generic names, approved dose expressions (no trailing zero; leading zero), **dose calculation methodology and variables** (height, weight, BSA, AUC/Calvert, creatinine clearance), re-evaluation frequency, thresholds of change that trigger recalculation, date and route of administration, confirmed allergies, **hold/modify parameters** (labs, clinical status), sequencing, rate, and number of cycles the order is valid for [52].
- **Exception orders** (non-standard regimen or dose escalation) require a supporting reference or a second practitioner's authorisation [52].
- **Verbal orders are prohibited** except to hold or stop [52].
- **Four verifications** [52]:
  1. Order verification (two identifiers, drug, dose, route, rate, dosing calculations with variables, cycle/day).
  2. Preparation check (vial, concentration, volume, diluent, tubing/filters). Technology such as barcode or gravimetric checking can substitute.
  3. Pre-administration independent double check by two clinicians.
  4. **New in 2024:** a bedside check in the presence of the patient by two clinicians (one may be by video, one must be on site), covering drug, dose, rate, route, administration set and **pump settings**.
- **Weight in metric units only, confirmed by two people** [52]. Oral antineoplastics are ordered electronically with quantity, **refills defaulting to zero** and schedule [52].
- **Other required capabilities:** cumulative-dose tracking (e.g., anthracyclines, bleomycin) [K]; BSA capping policies; treatment-plan view (calendar of cycles); toxicity grading (CTCAE) [K]; SDOH and fertility assessments before treatment [52]; CRS/hypersensitivity management protocols [52]; and staging (TNM) and tumour board documentation [K].

### 14.2 Nephrology / dialysis

Dialysis prescription (modality, dialyser, blood/dialysate flow, UF goal, anticoagulation, access), run sheets with machine integration, access surveillance, and peritoneal dialysis regimens. Dialysis solutions are high-alert [44]. Registry reporting (e.g., CMS ESRD/CROWNWeb successor systems in the US) [K].

### 14.3 Cardiology

ECG management (device integration and storage), echo, cath and EP structured reporting, cardiac device clinic, and registry exports (e.g., NCDR) [K]. Epic Cupid / Oracle CVNet are the reference products [71][74].

### 14.4 Mental health

- **Legal status:** involuntary holds and detentions are jurisdiction-specific (e.g., US state emergency holds; England and Wales Mental Health Act sections). Model them as configurable legal-status objects with start time, expiry, required reviews, rights notifications and tribunal/hearing dates, plus alerts before expiry [K].
- **Suicide risk:** NPG.08.01.01 requires an environmental risk assessment (ligature points) for psychiatric units, mitigation on non-psychiatric units (1:1 observation, removing objects), **validated screening for patients ≥12** being treated for behavioural health conditions, evidence-based assessment of positives, documented overall risk and mitigation plan, and monitoring and reassessment policies [8].
- **Restraint and seclusion (42 CFR 482.13(e))** [53]:
  - Use only for immediate physical safety and only after less restrictive interventions are ineffective.
  - An order is required; **standing and PRN orders are prohibited**.
  - Orders for violent or self-destructive behaviour are limited to **4 h (adults ≥18), 2 h (ages 9–17) and 1 h (<9)**, renewable up to 24 h. After that, a practitioner must see the patient before a new order.
  - **Face-to-face evaluation within 1 hour** (practitioner or trained RN/PA, who then consults the attending).
  - Simultaneous restraint and seclusion requires continuous in-person or audio-video monitoring.
  - Documentation must cover the 1-h evaluation, behaviour, intervention, alternatives tried, justification and the patient's response with the reason for continuing.
  - Deaths during or within 24 h of restraint or seclusion (or within 1 week if restraint or seclusion may have contributed) are reported to CMS by the next business day, with an internal log for soft wrist restraints only [53].
  - **EHR design:** an order type with age-driven expiry timers, a 1-h face-to-face task with countdown, a monitoring flowsheet at policy intervals, and automatic discontinuation prompts.
- **Observation levels** (1:1, q15 min) with staff signatures, and patient property and contraband logs [K].

### 14.5 Rehabilitation, dental and ophthalmology

- **Rehab (PT/OT/SLP):** evaluations with standardised measures (e.g., Barthel, AM-PAC), goals, plan of care with payer recertification, timed-code session notes and equipment recommendations [K].
- **Dental:** odontogram (FDI/Universal), periodontal charting, phased treatment plans, imaging and CDT codes [K]; Epic Wisdom [71].
- **Ophthalmology:** acuity, IOP, drawings, OCT/visual-field device integration, laterality-heavy ordering; Epic Kaleidoscope [71].

### 14.6 Paediatrics (cross-cutting)

Growth charts (WHO 0–2 years, CDC 2–20 years in the US, UK-WHO in the UK [K]); **weight-based dosing as the default** with mg/kg display, adult-maximum capping and decimal precision; corrected age for preterm infants [3]; paediatric-specific CDS content (SAFER CPOE 2.2) [3]; PEWS; immunisation schedules and registry exchange; guardian/proxy access rules for adolescents [K]; and paediatric resuscitation equipment (NPG.01.05.03 EP2) [8].

### 14.7 Transplant

Candidate evaluation, waitlist status and registry reporting (e.g., UNOS/OPTN in the US [K]), donor and organ matching documentation, immunosuppression level monitoring, and tissue tracking (NPG Goal 9 "safe transplant practices") [9]. Epic Phoenix [71].

### 14.8 Infection prevention & control (IPC)

NPG.05.01.01 requires risk-based surveillance and control activities, with C. auris, CRE, norovirus, RSV, influenza and measles cited as examples. NPG.05.02.01 requires protocols for high-consequence infectious diseases (identify, isolate, inform) and screening at points of entry. NPG.05.03.01 requires CDC/WHO hand-hygiene compliance programmes [8].

**EHR features:**

- Isolation flags (contact/droplet/airborne/enhanced) on the banner, bed board and transport, with **bed-assignment constraints** (negative-pressure rooms, cohorting).
- MDRO history flags that persist across encounters.
- Lab-driven surveillance rules (e.g., new positive C. difficile, blood culture organisms).
- Device-day denominators.
- NHSN HAI event determination support (CLABSI, CAUTI, SSI, LabID) [K].
- Outbreak management (line lists, epi curves, contact tracing using ADT location history).
- Exposure workups for staff.
- Public-health electronic case reporting (eCR) [K].

### 14.9 Palliative care

Goals-of-care conversation documentation (structured with free text), advance directives and POLST/ReSPECT-type forms [K], code status as a discrete order with banner display, symptom scales (e.g., ESAS [K]), comfort-care order sets, and bereavement follow-up.

### 14.10 Blood transfusion (bedside)

- **Pre-transfusion sample:** positive patient ID at phlebotomy with barcode label **printed at the bedside**. In SHOT 2023 (986 WBIT reports), 434 (44.0%) stemmed from failure to identify the patient at phlebotomy and 285 (28.9%) from labelling samples away from the patient. Both errors occurred together in 23.6% of the reports where this was recorded [57]. NPG.01.01.01 EP2 requires specimen labelling in the patient's presence [8].
- **Consent** for transfusion, indication captured (supports patient blood management audit), and special requirements flags (irradiated, CMV-negative, antibody history).
- **Bedside administration:**
  1. Scan the patient.
  2. Scan the unit.
  3. System verifies unit-to-patient match, ABO/Rh compatibility, expiry and special requirements.
  4. A second verifier where policy requires (SHOT describes workarounds where the second nurse did not recheck) [55].
  5. Baseline and 15-minute vitals, and end-of-transfusion volume.
  6. Reaction workflow (stop, notify, sample, haemovigilance report).
- **Evidence:** SHOT 2024 recorded 1,408 near misses, including 899 WBIT (986 in 2023 [57]), and 359 incorrect-blood-component-transfused (IBCT) reports [55]. The "9.0% of 3,998 total reports" denominator was not found in the Key Insights document and remains unverified [54]. Most 2024 WBIT (84.2%) were caught at laboratory testing or result authorisation. The key insights cite suboptimal IT functionality, staff unfamiliarity with IT systems, complex systems leading to workarounds, and IT alerts overridden inappropriately [55]. A UK multicentre study showed lower wrong-component rates with electronic identification systems, but many hospitals did not use EIS for all transfusions [56].
- **KPIs:** bedside scan rate for blood (>95% EMRAM legacy) [15]; WBIT rate per 1,000 samples [K]; time from issue to start; reaction reporting completeness.

---

## 15. Clinical documentation

### 15.1 Structured vs free text

- Capture **discrete data** where it drives CDS, quality measures, billing or research: vitals, allergies, problems, medications, scores, LDAs, key exam findings, and order indications.
- Keep **narrative** for clinical reasoning, which is the part of the note that matters most.
- Avoid "structured everything", which creates checkbox notes without reasoning [K].

### 15.2 Template and tooling capabilities

- Specialty templates.
- **Smart phrases/macros** (user and shared).
- **Smart links** (pull live data with a time stamp and source).
- Smart lists (pick-lists with required choices).
- Problem-based charting.
- Voice recognition (front-end).
- **Ambient AI scribes**: draft notes with clinician review and edit tracking, with labelling of AI-generated content until signed (doc 11, P8).

**AI scribe evidence:** A 2025 UCLA three-arm RCT (Lukac et al., NEJM AI, Dec 2025 issue, e-pub 26 Nov 2025) randomised 238 outpatient physicians across 14 specialties to Microsoft DAX Copilot, Nabla or usual care. Nabla reduced time-in-note by 9.5% vs control (95% CI −17.2% to −1.8%), while DAX did not significantly reduce it. Both produced modest improvements in burnout and task load, and physicians reported clinically significant inaccuracies "occasionally" [50][51]. A University of Wisconsin pragmatic stepped-wedge RCT (Afshar et al., NEJM AI 2025; 66 practitioners) was published in the same issue. It found reduced work exhaustion/interpersonal disengagement and about 0.36 h/day less time on notes [87]. Conclusion: deploy with governance, edit-rate monitoring and patient consent workflows.

### 15.3 Copy-forward and note bloat

- About **50% of note text** (50.1%) in more than 100 million notes was duplicated from elsewhere in the record. 54.1% of the duplicated text came from the same author and about 46% from a different author, and the duplicated share rose from 33.0% (2015 notes) to 54.2% (2020 notes) [48]. In 2.7 million outpatient progress notes at OHSU (2009–2018), median note length grew 60.1%. Median redundancy, defined as text identical to the patient's last note by any author, rose from 47.9% to 58.8%, and only 29.4% of 2018 note text was typed directly [49]. **Correction (pass 2):** an earlier draft said "up to 58% copied from the author's own prior notes". The study measures redundancy against the patient's last note, not the author's own. The authors warn that blanket copy-paste bans may worsen information scatter [48].
- **Design responses:**
  - Visually distinguish inherited or copied text (e.g., grey or highlighted) with source attribution.
  - Prefer **smart links** (live, time-stamped data) to static copies.
  - Require attestation of review for copied sections in high-risk notes [K].
  - Run note-length and redundancy analytics per author.
  - Provide summarisation tools, such as an auto-generated hospital course with citations to source notes (est.: an emerging capability across major vendors [68]).

### 15.4 Signatures, co-signature, addenda and corrections

- E-signature with authentication, date and time.
- **Co-signature** workflows for trainees, APPs, verbal orders and scribes, with timeliness tracked.
- Signed notes are immutable. Changes are made by **addendum** (new text appended) or **correction/amendment**, which keeps the original version viewable, records a reason and author, and notifies recipients if the note was already sent (doc 11, P3).
- "Entered in error" for wrong-patient documentation, with the content moved and audit trails preserved.
- Patient-requested amendments (HIPAA right to amend in the US) with accept/deny workflow [K].

### 15.5 Legal medical record (LMR)

- Define the LMR explicitly per organisation: which document types, results, flowsheet rows, messages and images are included, and which are excluded (e.g., audit logs, CDS firing logs, draft notes, secure chat unless promoted) [K].
- Support a **designated record set** for patient access, legal holds and retention schedules by jurisdiction.

### 15.6 Scanned documents, photography and consents

- **Scanned documents:** indexed to patient, encounter and document type, with QA for mis-indexing (a wrong-patient risk). EMRAM Stage 7 historically required clinically relevant paper to be scanned within 24 h [15].
- **Clinical photography:** captured on mobile in-app (not on personal camera rolls), with consent, body-site tagging, DICOM or managed media storage, and sensitivity labels [K].
- **Consents:** e-consent with signature capture, witness and interpreter, version-controlled forms, and display at the point of care. Procedure consent feeds pre-procedure verification [8].

### 15.7 Release of information (ROI) and chart completion

- **ROI:** request logging, authorisation validation, minimum-necessary redaction, sensitive-data segmentation (e.g., 42 CFR Part 2 substance-use records in the US) [K], accounting of disclosures, and fulfilment tracking.
- **Chart completion:** deficiency tracking (unsigned notes, missing H&P or discharge summary, unsigned verbal orders), delinquency escalation and suspension policies [K].
- **Patient access to notes and results** without undue delay is mandated in the US under Cures Act information-blocking rules. The 2025 SAFER revision added topics on patient access to clinical notes and test results "in light of the 21st Century Cures Act" [6].

### 15.8 Documentation KPIs

- Note completion time (e.g., ED and progress notes within 24 h).
- Discharge summaries within 48 h.
- Unsigned verbal orders older than policy limit.
- Copy-forward proportion.
- Note length.
- Documentation time per encounter and after-hours EHR time (audit-log metrics) [K].
- Scanning QA error rate.

---

## 16. Care coordination & transitions

1. **Internal referrals and consults:** structured orders with reason, urgency, acceptance and completion tracking (SAFER CPOE 2.4) [3].
2. **External referrals:** electronic referral (FHIR/Direct/C-CDA, NHS e-RS style national services [K]), status tracking from sent through accepted, scheduled, seen and report received. SAFER HP 3.3 calls for monitoring communication patterns for referrals and portal messages [2].
3. **Transitions of care:** a C-CDA/FHIR transition summary with medications, allergies, problems, results pending, follow-up and care team. **Results pending at discharge** are assigned an explicit owner [5].
4. **Discharge to post-acute care:** referral packets to SNF, IRF, LTACH or home health, electronic placement platforms with acceptance tracking, and patient choice documentation (US CoP 482.43 requires offering choice lists [K]).
5. **Home health and hospice:** orders, plan of care, face-to-face documentation where payer rules require, and remote monitoring feeds [K].
6. **Care management:** risk stratification, case-manager worklists, utilisation review (admission criteria such as InterQual/MCG [K]), avoidable-day tracking, and care plans shared across settings.
7. **SDOH screening:** the five CMS HRSN domains (food insecurity, housing instability, transportation, utilities, interpersonal safety) were required in the US IQR programme for 2024 reporting [66][67]. **Status update (pass 2):** the FY 2026 IPPS final rule (CMS-1833-F, Aug 2025) removed SDOH-1, SDOH-2 and Hospital Commitment to Health Equity from Hospital IQR, starting with the CY 2024 reporting period / FY 2026 payment determination [83]. The CY 2026 OPPS final rule removed SDOH-1/2 from Hospital OQR [82]. US hospitals therefore no longer have a federal quality-reporting mandate for HRSN screening. Clinical value is independent of the regulation. Build a screening module (AHC-HRSN, PRAPARE and similar instruments), with Z-code suggestion (ICD-10 Z55–Z65), community-resource referral and closed-loop CBO feedback [K]. ASCO-ONS also requires SDOH assessment before and during antineoplastic therapy [52].

**KPIs:** referral closure rate; time to post-acute placement; avoidable days; 7-day follow-up after discharge; SDOH screening rate and positive-screen follow-up rate.

---

## 17. Results management (cross-cutting, safety-critical)

The SAFER Test Results guide (2025) [5] is the specification:

- **Structured results with LOINC and units, plus reference ranges (1.1).** Free-text reports carry a normal/abnormal code (1.2).
- **Status tracking from order to acknowledgement (2.1).** The ordering and responsible clinician are identifiable (2.2).
- **Amended results:** electronic notification, a visible amended flag, and direct contact if clinically significant (2.3).
- **Ownership and fail-safes:** written policies on follow-up responsibility (2.4), and fail-safe routing for vulnerable workflows such as critical results, results after discharge and results ordered by rotating trainees (2.5).
- **Inbox design:**
  - Abnormal flagging (2.6) and clear displays (2.7).
  - **Surrogates** and coverage (2.9).
  - Trending and graphing (2.10).
  - Sort and filter (2.11).
  - Self-reminders (2.12).
- **Monitoring:** unacknowledged results and follow-up of abnormal results (3.1); results lost to interface failure (3.2); CDS that depends on lab results kept in sync with lab system changes (3.3); timely patient notification (3.4).
- **Critical results:** NPG.01.02.01 requires a definition of critical results, reporting by and to whom, and acceptable timeliness, with timeliness evaluated [8]. EHR features include critical-result call logging (read-back, receiver, time), escalation if the call is not acknowledged within N minutes, and a dashboard.

**KPIs:** critical result notification time (median, % within policy); percentage of abnormal results acknowledged within 7 days [K]; results-pending-at-discharge acknowledged; amended-result acknowledgement.

---

## 18. Reference taxonomy — vendor crosswalk

Use this to talk to clinicians who have used these systems, and to name our own modules. Our canonical names are in §2.

| Functional area | Epic | Oracle Health (Millennium) | MEDITECH Expanse | InterSystems TrakCare | Dedalus / Cambio (EU) |
|---|---|---|---|---|---|
| Registration / ADT | Prelude, Grand Central | Registration / ADT (Patient Management) [K] | Registration/ADM [K] | Patient Administration (PAS) [69][K] | ORBIS PAS (Dedalus) [K]; COSMIC Patient Admin (Cambio) [K] |
| Scheduling | Cadence | Scheduling Management [K] | Community-Wide Scheduling [K] | Scheduling/Outpatients [69] | ORBIS / COSMIC scheduling [K] |
| EMPI | Identity [K] | EMPI [K] | EMPI [K] | HealthShare Patient Index [K] | Dedalus/Cambio EMPI [K] |
| Clinician EHR | EpicCare Inpatient / Ambulatory | PowerChart | Expanse for Physicians [68] | TrakCare EPR [69] | ORBIS EHR; Cambio COSMIC [K] |
| Nursing | ClinDoc, Rover | CareNet, iView, PowerForms | Expanse for Nurses (Patient Care) [68] | Nursing/clinical observations [69] | ORBIS Nursing; COSMIC Care [K] |
| CPOE | Orders / SmartSets [K] | PowerOrders, PowerPlans | Physician orders [K] | Order communications [K] | ORBIS/COSMIC orders [K] |
| CDS | BPA / OurPractice Advisories, Cognitive Computing [K] | Discern Expert, St. John Sepsis Agent [K] | Surveillance, CDS [68] | Clinical rules [K] | Cambio CDS (openEHR/GDL-based) [K] |
| Pharmacy | Willow | PharmNet | Pharmacy [68] | Medication Management [69] | ORBIS Medication [K] |
| eMAR / BCMA | ClinDoc MAR + Rover | Bedside Medication Administration / MAW [K] | Bedside Medication Verification (BMV) [K] | e-prescribing and administration [69] | ORBIS/COSMIC MAR [K] |
| ED | ASAP | FirstNet | Emergency Department [68] | Emergency [K] | ORBIS ED [K] |
| Surgery / Anaesthesia | OpTime / Anesthesia | SurgiNet / SurgiNet Anesthesia | Surgical Services [68] | Theatres/Anaesthesia [69] | ORBIS OR [K] |
| Maternity | Stork | PowerChart Maternity [K] | Labor and Delivery [68] | Maternity [K] | ORBIS Maternity [K] |
| Oncology | Beacon | PowerChart Oncology [K] | Oncology [68] | Oncology [K] | ORBIS Oncology [K] |
| Critical care | ClinDoc ICU + device integration [K] | CareAware Critical Care [72] | Critical Care [68] | ICU [K] | ICM (Dedalus) [K] |
| Lab | Beaker | PathNet | Pathology/Lab [68] | TrakCare Lab Enterprise [69] | Dedalus lab (e.g., DNLab) [K] |
| Radiology | Radiant | RadNet | Imaging & Therapeutic Services [K] | Radiology [K] | Dedalus RIS/PACS [K] |
| Cardiology | Cupid | CVNet | — [K] | — [K] | — |
| Infection control | Bugsy | Infection control/third-party [K] | Surveillance [68] | — [K] | — |
| Mobile | Haiku, Canto, Rover | PowerChart Touch, CareAware Connect | Expanse mobile [68] | TrakCare mobile [K] | — |
| Population health / care management | Healthy Planet | HealtheIntent [K] | Population Health [68] | HealthShare [K] | — |
| Portal | MyChart | HealtheLife [K] | Patient Connect [68] | Patient portal [K] | — |
| HIE / interfaces | Care Everywhere [K], Bridges | Open Engine, FHIR APIs | Interoperability, Traverse [68] | HealthShare/HealthConnect [K] | — |
| Analytics | Clarity, Caboodle, Cogito | HealtheIntent / Data Intelligence [K] | BCA analytics [68] | — [K] | — |

**Notes:** Oracle is rolling out a next-generation cloud EHR alongside Millennium, so track its naming separately [K]. InterSystems EHRs (TrakCare/IntelliCare): 600+ hospitals, 29 countries (vendor claim), mainly outside the US. TrakCare customers include KKESH in Saudi Arabia, Australia's Northern Territory and NHS trusts [69][89]. *(Reconciled 2026-10-16: the 600+/29 figures are for InterSystems EHRs collectively, not TrakCare alone; see `01` §5.1.)* MEDITECH Expanse is described by MEDITECH as cloud-native, with embedded physician ambient AI ("ambient listening for nurses coming soon" as of Oct 2026) and auto-generated hospital-course summaries and nurse handoffs [68].

---

## 19. Patient-safety requirements checklist

Each item should become a testable acceptance criterion with a traceability ID. "Server-side" means it is enforced in the domain layer for all channels (UI, API, mobile, interfaces), per doc 11, P11.

**Identification**

- [ ] ≥2 identifiers on all artefacts and verification steps; never room or bed [8].
- [ ] Patient photo captured and displayed on banner, MAR and order entry [2].
- [ ] MRN check digit [4].
- [ ] Barcoded wristbands and labels with ≥2 identifiers [4].
- [ ] Similar-name warnings at registration and search, with visually distinct adjacent similar names [2][4].
- [ ] Unique temporary IDs for unknown, trauma, MCI and downtime patients, with merge into permanent IDs [4].
- [ ] Distinct newborn naming, with field lengths and band layouts tested for truncation [8][59].
- [ ] Reversible merge/unmerge with downstream propagation; duplicate-rate dashboard (internal target, e.g., ≤1%, a common industry goal not stated by AHIMA [K]; baseline 8–12% [62]).
- [ ] Specimens labelled at the bedside in the patient's presence [8].

**Orders and CDS**

- [ ] Structured orders by default; free-text order monitoring; alert when a structured equivalent exists [3].
- [ ] Weight (dated, with source), height, allergies (coded reaction and severity) and pregnancy status visible during ordering. Weight is required before weight-based medications [3].
- [ ] Dose-range checking (single, daily, cumulative; weight/BSA/renal/age/paediatric) before submission. Displayed calculation working [3][52].
- [ ] Paediatric precision: decimal rounding and corrected age [3].
- [ ] Leapfrog 8-category coverage. Hard stops only for absolute contraindications (e.g., intrathecal vincristine, MAOI + triptan) [10].
- [ ] Excessive-alert suppression list maintained [10].
- [ ] CDS telemetry: firing, override and acceptance rates and override reasons; in-workflow feedback [3][21].
- [ ] AI/predictive tools: source attributes, local validation, drift monitoring and governance [2][22][K].
- [ ] Verbal orders: read-back captured and co-signature tracked; prohibited for antineoplastics except hold/stop [52].
- [ ] Order-to-completion tracking for tests, referrals and transitions [3][5].

**Medication administration**

- [ ] BCMA in all inpatient, ICU, L&D, pre-op and PACU units, with patient and medication scans ≥95% [12].
- [ ] Workaround controls: override reasons not defaulted to the first option, scan-failure analytics, and compliance dashboards by user/unit [41][79].
- [ ] Independent double-check documentation for high-alert medications [3][44].
- [ ] Smart-pump auto-programming and auto-documentation, with auto-programming rate monitored [42][43].
- [ ] Pharmacist verification before first dose (except defined emergency overrides); ADC override review [8].
- [ ] Standard concentrations; premixed/prefilled anticoagulants; anticoagulant reversal and perioperative protocols [8].
- [ ] Medication reconciliation at admission, transfer and discharge with explicit decision per item; written discharge list [8].
- [ ] PDMP access; opioid high-risk monitoring; pain reassessment tasks [8].
- [ ] Antibiotic stewardship DOT reporting [8].

**Results and communication**

- [ ] Critical-result definitions, timeliness targets, call logging with read-back, and escalation [8].
- [ ] Responsible clinician on every result; amended-result notification and flag [5].
- [ ] Surrogate inbox coverage; unacknowledged-result monitoring; patient notification timeliness [5].
- [ ] Structured I-PASS handoff tool and audit [36][8].
- [ ] Secure messaging reliable for high-risk information [2].

**Deterioration and alarms**

- [ ] NEWS2/PEWS/MEOWS auto-calculated, with escalation tasks and response-time tracking [23][24][8].
- [ ] Observation frequency driven by score [24].
- [ ] Alarm management configuration with role-based authority to change or disable alarms [8].
- [ ] Resuscitation event documentation (code sheet) feeding resuscitation review [8].

**Procedures**

- [ ] Pre-procedure verification checklist; site-marking documentation; time-out with role-based capture; WHO SSC three phases [8][37].
- [ ] Perioperative medication labelling support (syringe label printing) [8].
- [ ] Implant UDI capture [K].

**Blood, specimens, milk**

- [ ] Bedside barcode for transfusion; ABO/special-requirements checks; reaction workflow [54][56].
- [ ] Human milk barcode matching in NICU [15].

**Behavioural health and restraint**

- [ ] Suicide screening (validated, age ≥12 in behavioural health) and assessment with documented risk and plan [8].
- [ ] Restraint/seclusion orders with age-based expiry, no PRN, 1-h face-to-face task, monitoring and documentation elements, and death-reporting workflow [53].

**Records and resilience**

- [ ] Immutable signed notes with addenda and corrections; entered-in-error workflow; full audit [K].
- [ ] Copy-forward attribution and highlighting [48].
- [ ] Downtime: read-only BCA snapshots (MAR, active orders, allergies, census), downtime registration, back-entry with clinical vs system time, and staff trained and tested on downtime and recovery [2].
- [ ] Backups of data and configuration regularly tested [2].
- [ ] Change management: test updates in an integrated context with clinically authentic scenarios; notify users of impactful changes [2].

---

## 20. Clinical KPIs

Targets marked (est.) are common benchmarks, not mandated values. Set local targets with clinical governance.

| Domain | KPI | Definition | Benchmark / target | Source |
|---|---|---|---|---|
| Identity | Duplicate record rate | Duplicates ÷ total MPI records | ≤1% (est.; industry best-practice goal, not an AHIMA-published target); industry 8–12% typical, 15–16% in large systems | [62][K] |
| Identity | Wrong-patient retract-and-reorder | Orders retracted and reordered on a different patient within 10 min, per 100k orders | Track trend (est.) | [K] |
| ED | Arrival-to-room | % of visits >60 min | ECAT gap criterion (OQR; voluntary CY 2027, mandatory CY 2028) | [30][82] |
| ED | Boarding | Decision-to-admit to ED departure; % >240 min | ECAT gap criterion | [30] |
| ED | ED LOS | Arrival to departure; % >8 h | ECAT gap criterion | [30] |
| ED | LWBS | % of visits left without evaluation | ECAT gap criterion | [30] |
| ED | Triage time-to-clinician compliance | % seen within category target | ATS 100/80/75/70/70% | [28] |
| Stroke | Door-to-needle | % ≤60 / ≤45 / ≤30 min | ≥85% / ≥75% / ≥50% | [32] |
| Sepsis | SEP-1 compliance | All-or-none bundle | Track; failure drivers are fluids and repeat lactate | [35] |
| Inpatient | Med rec within 24 h | % admissions with BPMH and reconciliation within 24 h of decision to admit | High 5s measure | [45] |
| Inpatient | Discharge summary timeliness | % completed within 48 h | ≥90% (est.) | [K] |
| Inpatient | 30-day readmission | All-cause unplanned | Risk-adjusted benchmark | [K] |
| Inpatient | Handoff tool use | % patients with updated I-PASS each shift | ≥95% (est.) | [36] |
| CPOE | Medication CPOE rate | % inpatient medication orders by prescriber via CPOE | ≥85% (Leapfrog) | [11] |
| CPOE | Leapfrog CPOE test | % of serious errors alerted | ≥60% to meet standard; aim for 100% on fatal orders | [10][11] |
| CDS | Alert override rate | Overrides ÷ interruptive alerts, by alert | Downward trend; retire alerts with >90% override (est.) | [16][17] |
| CDS | Alerts per 100 orders | Interruptive alerts per 100 medication orders | Downward trend (est.) | [K] |
| Medication | Patient and medication scan compliance | % administrations with both scans | ≥95% | [12] |
| Medication | Pump auto-programming rate | % infusions auto-programmed | ≥85% (est.; 53% observed) | [43] |
| Medication | ADEs | Trigger-tool ADEs per 1,000 patient-days | Downward trend | [K] |
| Medication | Antibiotic use | DOT per 1,000 days present | Benchmark vs NHSN SAAR | [8] |
| Results | Critical result notification | % within policy time | ≥95% (est.) | [8] |
| Results | Unacknowledged abnormal results | Count older than 7 days per clinician | Approaching 0 (est.) | [5] |
| Deterioration | NEWS2 escalation compliance | % NEWS2 ≥5 with documented urgent review within policy time | ≥90% (est.) | [24] |
| Deterioration | Cardiac arrests outside ICU | Per 1,000 admissions | Downward trend | [8] |
| Nursing | Falls with injury | Per 1,000 patient-days | Downward trend | [K] |
| Nursing | HAPI stage 2+ | Prevalence | Downward trend | [K] |
| IPC | CLABSI / CAUTI | Per 1,000 device-days (NHSN SIR) | SIR <1 | [K] |
| Periop | First-case on-time starts | % | ≥80–90% (est.) | [K] |
| Periop | Block utilisation | Used ÷ allocated block minutes | 75–85% (est.) | [K] |
| Periop | WHO checklist compliance | % cases with all three phases completed (observed) | 100% | [37] |
| Maternity | PPH / severe maternal morbidity | Per 1,000 births | Benchmark | [K] |
| Transfusion | Bedside scan rate | % units with electronic bedside verification | >95% | [15] |
| Transfusion | WBIT | Per 1,000 samples | Approaching 0 | [54] |
| Mental health | Restraint hours | Per 1,000 patient-hours | Downward trend | [53][K] |
| Documentation | After-hours EHR time | Minutes per clinician per day outside scheduled hours | Downward trend | [K] |
| Documentation | Note duplication | % of note text inherited/copied | Monitor; target set locally | [48] |

---

## 21. Implications for our build

### 21.1 MVP clinical scope

These are opinionated recommendations. Ship for one acute hospital with an ED and outpatient clinics:

1. **Identity and flow:** EMPI with probabilistic matching and duplicate work queue, reversible merge/unmerge, alias pools (trauma/MCI/downtime), newborn auto-registration with distinct naming, photo capture, registration, ADT with all event types including pending/LOA and corrections, bed board with EVS tasks, and basic scheduling with referral tracking.
2. **The clinician chart:** summary, coded problem list, allergies (coded reaction and severity), results review with trending, notes, and order entry, all on a single patient banner standard (photo, two identifiers, allergies, code status, isolation, weight with date).
3. **CPOE:** orderables catalogue, order sets with versioning, all timing types (STAT/future/standing/conditional/PRN/titration), verbal-order read-back and co-sign, and a full lifecycle state machine with order-to-result tracking.
4. **CDS v1:** licensed drug KB with a local re-tiering layer, Leapfrog-aligned content (including the excessive-alert suppression list), NEWS2/PEWS with escalation tasks, VTE assessment, sepsis screening rules (not black-box models), CDS Hooks client, and **telemetry from day one**. *(Reconciled 2026-10-16 with `07`/`08`/`09`. NEWS2/PEWS are transparent published-score calculators on nurse-entered vitals, versioned as a regulated module and released first in non-US markets. Sepsis screening is non-interruptive and rule-based, and it shows its inputs. v1 has no automated continuous alarms from device streams. US deployments use cleared partners.)*
5. **Medication loop:** pharmacist verification queue, ADC profile interface, eMAR with BCMA on mobile devices, independent double-check workflow, PRN reassessment tasks, and med rec (admission/transfer/discharge). Smart-pump interoperability is a fast-follow in P2, but design the infusion data model for it now. *(Reconciled 2026-10-16: `04` §11 #15 now matches. Pump interoperability via one vendor moves into the MVP only if a design partner requires it.)*
6. **Nursing:** assessments, flowsheets, I&O, LDAs, wound photos, Braden/Morse/delirium scores with care-plan triggers, worklists, and nurse handoff.
7. **ED:** quick-registration/alias, configurable triage (ESI or ATS/MTS/CTAS per tenant), tracking board with timers, stroke/sepsis/STEMI pathway timers, disposition, boarding view and an ECAT-ready event model.
8. **Inpatient physician:** H&P, progress notes, consults, I-PASS handoff, rounding lists, discharge navigator, discharge summary and AVS.
9. **Results inbox:** routing rules, surrogates, critical-result logging and escalation, and unacknowledged-result monitoring.
10. **Interfaces:** lab (LIS), radiology (RIS/PACS launch), blood bank, ADT broadcast, pharmacy devices, monitors (vitals), and HIE (see doc 06). *(Reconciled 2026-10-16: for the India/KSA minimum viable hospital, the clinical-pathology LIS core and the RIS are **native** in MVP, per `04` §11 #15, because buyers there expect one HIS that includes lab and radiology. Microbiology, anatomic pathology and the blood bank start as interfaces. PACS is always integrated. Lab/RIS interfaces remain for sites that keep a third-party LIS/RIS.)*
11. **Bedside specimen collection and transfusion** with barcode.
12. **Behavioural safety content:** suicide screening, restraint/seclusion orders and timers.
13. **HIM basics:** deficiency tracking, scanning and indexing, ROI log, amendments, and audit.
14. **Downtime:** BCA read-only snapshots, downtime registration with pre-allocated IDs, and back-entry tooling.
15. **OPD and access (added 2026-10-16 in reconciliation):** OPD token queue with SMS/display, and a basic patient app with WhatsApp/SMS and national rails (ABHA/ABDM, Sehhaty/NPHIES), per `05` §4.6/§9.3 and `09` §9.2.
16. **Perioperative (added 2026-10-16 in reconciliation):** OT scheduling and a basic intra-op record, including the WHO Surgical Safety Checklist. AIMS is P2 unless a design partner requires it.

### 21.2 Sequencing

- **Phase 0 (foundation):** domain model, state machines, terminology services (SNOMED CT, LOINC, RxNorm/dm+d, UCUM), the drug-KB adapter, the CDS engine and telemetry, and audit. These are expensive to retrofit.
- **Phase 1 (MVP above):** go live **big bang per site** for all core clinical and revenue modules. The first site is a well-resourced, non-flagship design partner. Limit unit-level piloting to a pre-production **"model unit"** or dress rehearsal (technical dress rehearsals, simulated shifts) before the site-wide go-live. Do not go live on BCMA unit-by-unit. Partial closed loop was a classic EMRAM failure [15], and mixed paper/electronic MARs are dangerous [K]. *(Reconciled 2026-10-16 with `10` §4.4. This previously read "pilot on one inpatient unit, ED and two clinics, then expand hospital-wide". The first go-live date comes from the critical-path build plan, because implementation takes about 12–18 months on top of the MVP build (`10` §4.12).)*
- **Phase 2:** perioperative depth (preference cards, implants, PACU) + AIMS, ICU device integration and smart-pump interoperability, maternity/NICU (LCG, fetal monitoring, human milk), oncology (ASCO-ONS 2024 conformant), IPC surveillance and stewardship, care management/SDOH, full portal, native microbiology and AP, and analytics/eCQMs (ECAT, SEP-1). *(Reconciled 2026-10-16: OT scheduling with a basic intra-op record and the basic patient app moved into the MVP.)*
- **Phase 3:** cardiology, dialysis, ophthalmology, dental, transplant, endoscopy, home health and tele-ICU. Partner for these, or build them as configurable "specialty kits" on the same documentation and ordering framework.

### 21.3 Design pitfalls to avoid

1. **Alert fatigue by default.** Start with a minimal interruptive set: Level 1 DDIs, true severe allergies, dose limits for high-alert drugs, and fatal routes. Push everything else into order-set design, non-interruptive guidance or pharmacist queues. Ship override analytics in v1 [10][16][17][19]. Leapfrog has signalled that it will scrutinise non-interruptive alerts in 2027 [10], so even passive guidance must be visible and meaningful.
2. **Black-box predictive models.** Run new models silently, validate locally, publish model cards, and monitor drift. The Epic Sepsis Model is the cautionary tale [22]. SAFER HP 1.5 makes AI governance a shared vendor and organisation responsibility [2]. Do not make model cards depend on a regulatory mandate: HTI-5 proposes to drop the HTI-1 DSI source-attribute requirements [85].
3. **Copy-paste and note bloat.** Make the good path easy: smart links over copies, attribution, inherited-text highlighting and summarisation with citations. Avoid draconian bans [48][49].
4. **BCMA workarounds.** Do not default override reasons to the first list item. Make scanners and labels reliable (hardware matters), print wristbands at registration, and give managers per-user compliance dashboards [40][41][79].
5. **Weight and units.** A single dosing weight with date and source (stated vs measured), metric only [52], UCUM units everywhere, and no unit-less dose fields. Most catastrophic paediatric errors are 10× errors [K].
6. **Results falling through cracks.** Every result needs an owner. Model "results pending at discharge" and "results for discharged patients" as explicit queues [5].
7. **Wrong-patient errors.** Use photos, distinct newborn names, similar-name flags and retract-and-reorder monitoring. Do not rely on one-chart-at-a-time restrictions [4][6].
8. **Unreliable time stamps.** ED, stroke, sepsis and boarding measures depend on event time stamps. Capture them as first-class events, never inferred from note text [30].
9. **Configuration sprawl.** Version and scope all clinical content (order sets, CDS, forms) with owners and review dates [3]. Provide a content-promotion pipeline and regression tests (including a Leapfrog test harness).
10. **Specialty regulation drift.** Encode NPG, CMS CoP, ASCO-ONS and similar rules as configurable rule packs with source citations and review dates, because they change. The NPSG-to-NPG transition in 2026 is a recent example [7].

### 21.4 Where we can be best in class

- **Safety-telemetry-native EHR:** every alert, scan, override, escalation and handoff is measurable out of the box, with SAFER and accreditation dashboards that map to standard and EP numbers. The primary packs are NABH, JCI, CBAHI and DoH Abu Dhabi, and the Joint Commission NPG pack is secondary (reconciled 2026-10-16; see §1 #1).
- **Bitemporal append-only clinical journal with CDC to the lakehouse:** trustworthy times for every regulated clock (ECAT, SEP-1, stroke, restraint). *(Reconciled 2026-10-16: this replaces "event-sourced clinical timeline", per `08` §3.5/§3.11. Full event sourcing is limited to order/MAR aggregates, by ADR.)*
- **Closed-loop by construction:** order → verify → dispense → administer → monitor, with no transcription anywhere and device interoperability as a core service.
- **Clinician-time respect:** fewer clicks per order, smart defaults, ambient documentation with provenance, and inbox triage.
- **Internationalisable clinical content:** triage systems, EWS variants, terminologies (SNOMED CT/LOINC/ICD-10/11/dm+d/RxNorm), drug KBs (FDB/Medi-Span/Multum/BNF/MIMS) and legal-status frameworks configured per jurisdiction.

---

## 22. Sources

1. ONC/ASTP. SAFER Guides (2025) landing page. https://healthit.gov/clinical-quality-and-safety/safer-guides/
2. ONC/ASTP. SAFER Self-Assessment: High Priority Practices (2025; 16 recommendations). https://www.healthit.gov/sites/default/files/topiclanding/2025-01/4.%20High%20Priorities%20Final.pdf
3. ONC/ASTP. SAFER Guide: Computerized Provider Order Entry with Decision Support (2025). https://healthit.gov/wp-content/uploads/2025/06/SAFER-Guide-3.-CPOE-Final.pdf
4. ONC/ASTP. SAFER Guide: Patient Identification (2025). https://healthit.gov/wp-content/uploads/2025/01/Safer-Guide-6.-Patient-Identification-Final.pdf
5. ONC/ASTP. SAFER Guide: Test Results Reporting and Follow-Up (2025). https://healthit.gov/wp-content/uploads/2025/06/SAFER-Guide-8.-Test-Results-Reporting-Final.pdf
6. Sittig DF, Flanagan T, Sengstack P, …, Singh H. Revisions to the SAFER Guides to update national recommendations for safe use of EHRs. JAMIA 2025;32(4). It reports 9 guides consolidated into 8 and 147 recommendations cut to 88 (40%). https://pmc.ncbi.nlm.nih.gov/articles/PMC12005625/
7. The Joint Commission. National Performance Goals (overview). https://www.jointcommission.org/en-us/standards/national-performance-goals
8. The Joint Commission. National Performance Goals, effective January 2026, Hospital Program (full standards and EPs). https://digitalassets.jointcommission.org/api/public/content/9ca80055182b4274842a5780a94f2c82
9. The Joint Commission. 2026 Hospital National Performance Goals (goal list). https://digitalassets.jointcommission.org/api/public/content/8d49c3ffa9934ffda2ff83b5ad860ea7?v=aae10901
10. The Leapfrog Group. Guidance for the 2026 Leapfrog CPOE Evaluation Tool (v5.3, updated 4/1/2026). https://www.leapfroggroup.org/sites/default/files/Files/CPOE%20Tool%20Guidance%202026.pdf
11. The Leapfrog Group. Factsheet: Computerized Physician Order Entry (rev. 04/01/2025). https://ratings.leapfroggroup.org/sites/default/files/2025-03/2025%20CPOE%20Fact%20Sheet.pdf
12. The Leapfrog Group. Factsheet: Bar Code Medication Administration (rev. 04/01/2025). https://ratings.leapfroggroup.org/sites/default/files/2025-03/2025%20BCMA%20Fact%20Sheet.pdf
13. JAMIA Open (2026). Comparing a medication knowledge base product as designed with real-world implementations using the Leapfrog CPOE Evaluation Tool. https://academic.oup.com/jamiaopen/article/9/1/ooaf176/8415658
14. HIMSS. Electronic Medical Record Adoption Model (EMRAM). https://www.himss.org/maturity-models/emram/
15. HIMSS Analytics. Stage 7 overview (South Florida HIMSS chapter deck; legacy thresholds). https://southflorida.himss.org/sites/hde/files/2024-03/himss-stage-7.pdf
16. Poly TN, et al. Appropriateness of Overridden Alerts in CPOE: Systematic Review. JMIR Med Inform 2020. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7400042/
17. AHRQ. Making Healthcare Safer IV: Computerized CDS to Prevent Medication Errors and ADEs. https://www.ncbi.nlm.nih.gov/books/NBK600580/
18. van der Sijs H, et al. Overriding of drug safety alerts in CPOE. JAMIA 2006. https://interruptions.net/literature/Sijs-JAmMedInformAssoc06.pdf
19. AHRQ PSNet. Alert Fatigue (primer). https://psnet.ahrq.gov/primer/alert-fatigue
20. AHIMA Journal. The Five Rights of Clinical Decision Support. https://journal.ahima.org/Portals/0/archives/AHIMA%20files/The%20Five%20Rights%20of%20Clinical%20Decision%20Support_%20CDS%20Tools%20Helpful%20for%20Meeting%20Meaningful%20Use.pdf
21. HL7. CDS Hooks v2.0.1 specification. https://cds-hooks.hl7.org/
22. Wong A, et al. External Validation of a Widely Implemented Proprietary Sepsis Prediction Model in Hospitalized Patients. JAMA Intern Med 2021;181(8):1065–1070. https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2781307
23. Royal College of Physicians. NEWS2 Chart 2: thresholds and triggers. https://www.rcp.ac.uk/media/2acdezkd/news2-chart-2_news-thresholds-and-triggers_0.pdf
24. Royal College of Physicians. NEWS2 Chart 4: clinical response to trigger thresholds. https://www.rcp.ac.uk/media/mrllczrj/news2-chart-4_clinical-response-to-news-trigger-thresholds_0.pdf
25. Royal College of Physicians. NEWS2: Updated report of a working party (Dec 2017). https://www.rcp.ac.uk/media/a4ibkkbf/news2-final-report_0_0.pdf
26. Emergency Nurses Association. Emergency Severity Index Handbook, 5th ed. (v5, 2023). https://californiaena.org/wp-content/uploads/2023/05/ESI-Handbook-5th-Edition-3-2023.pdf
27. Journal of Emergency Medicine (2025). ESI Version 5: Simulation of predictive validity and triage level distribution. https://www.jem-journal.com/article/S0736-4679(25)00288-4/fulltext
28. Australasian College for Emergency Medicine. Triage (ATS categories and performance thresholds). https://acem.org.au/Content-Sources/Advancing-Emergency-Medicine/Better-Outcomes-for-Patients/Triage
29. Effects of displaying Manchester Triage System time targets (German MTS times). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11134237/
30. CMS / eCQI. Emergency Care Access & Timeliness (ECAT) eCQM, CMS1244 v1.2.000. https://ecqi.healthit.gov/sites/default/files/ecqm/measures/CMS1244-v1.2.000-QDM.html
31. The Joint Commission. ED-2 measure information form (v2026B1; retired 1/1/2026). https://manual.jointcommission.org/releases/TJC2026B1/MIF0165.html
32. American Heart Association/American Stroke Association. Target: Stroke Phase III brochure. https://www.stroke.org/-/media/files/professional/quality-improvement/target-stroke/target-stroke-phase-iii/aha-qi-target-stroke-phase-3-brochure.pdf
33. AHA. Target: Stroke Phase III suggested time interval goals. https://www.heart.org/-/media/Files/Professional/Quality-Improvement/Target-Stroke/Target-Stroke-Phase-III/9-17-Update/DS14860-Time-Interval-One-Pager_v2.pdf
34. CDC. Hospital Sepsis Program Core Elements (2023). https://www.cdc.gov/sepsis/hcp/core-elements/index.html
35. Rhee C, et al. Complex Sepsis Presentations, SEP-1 Compliance, and Outcomes. JAMA Netw Open 2025;8(3):e251100 (PMC11923707). https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2831700
36. Starmer AJ, et al. Changes in Medical Errors after Implementation of a Handoff Program. N Engl J Med 2014;371:1803–1812. https://www.nejm.org/doi/full/10.1056/NEJMsa1405556
37. Haynes AB, et al. A Surgical Safety Checklist to Reduce Morbidity and Mortality in a Global Population. N Engl J Med 2009;360:491–499. https://www.nejm.org/doi/full/10.1056/NEJMsa0810119
38. Urbach DR, Dimick JB, Haynes AB, Gawande AA. Is WHO's surgical safety checklist being hyped? BMJ 2019;366:l4700. https://www.bmj.com/content/366/bmj.l4700
39. Poon EG, et al. Effect of Bar-Code Technology on the Safety of Medication Administration. N Engl J Med 2010;362:1698–1707. https://www.nejm.org/doi/full/10.1056/NEJMsa0907115
40. Koppel R, et al. Workarounds to Barcode Medication Administration Systems. JAMIA 2008. https://www.eprescribingtoolkit.com/wp-content/uploads/2020/06/Workarounds-to-barcode-medication-administration-systems-Their-occurrences-causes-and-threats-to-patient-safety.pdf
41. BCMA system use and safety implications: a longitudinal study supported by clinical observation (London NHS, 2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC11784319/
42. Evaluating the Impact of Smart Infusion Pump Interoperability on Reducing Medication Administration Errors: A Systematic Literature Review (2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC12009041/
43. Integration of smart infusion pumps with electronic medical records improves safety and staff productivity at a large academic healthcare system. AJHP 2026. https://pubmed.ncbi.nlm.nih.gov/42364102/
44. ISMP. List of High-Alert Medications in Acute Care Settings (2024). https://www.ismp.org/system/files/resources/2024-01/ISMP_HighAlert_AcuteCare_List_010924_MS5760.pdf
45. WHO. The High 5s Project: Interim Report (MedRec measures). https://www.who.int/docs/default-source/patient-safety/high5s/high5-interimreport.pdf
46. The WHO High 5s project: medication reconciliation in a German university hospital (prospective cohort). https://pubmed.ncbi.nlm.nih.gov/35148970/
47. AHRQ PSNet. Medication Reconciliation (primer). https://psnet.ahrq.gov/primer/medication-reconciliation
48. Steinkamp J, Kantrowitz JJ, Airan-Javia S. Prevalence and Sources of Duplicate Information in the Electronic Medical Record. JAMA Netw Open 2022;5(9):e2233348. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2796664
49. Rule A, et al. Length and Redundancy of Outpatient Progress Notes Across a Decade. JAMA Netw Open 2021;4(7):e2115334. https://doi.org/10.1001/jamanetworkopen.2021.15334
50. Lukac PJ, et al. Ambient AI Scribes in Clinical Practice: A Randomized Trial. NEJM AI 2025. https://ai.nejm.org/doi/abs/10.1056/AIoa2501000
51. A Randomized Clinical Trial of Two Ambient AI Scribes (medRxiv preprint, 2025). https://www.medrxiv.org/content/10.1101/2025.07.10.25331333v1
52. Siegel RD, LeFebvre KB, Temin S, et al. Antineoplastic Therapy Administration Safety Standards for Adult and Pediatric Oncology: ASCO-ONS Standards. JCO Oncol Pract 2024;20(10):1314–1330 / Oncol Nurs Forum 2024;51(4). https://doi.org/10.1200/OP.24.00216 (full text: https://www.ons.org/system/files/journal-article-pdfs/ectGuidelines_1.pdf)
53. 42 CFR § 482.13 Condition of participation: Patient's rights (restraint and seclusion; death reporting). https://www.law.cornell.edu/cfr/text/42/482.13
54. SHOT. Annual SHOT Report 2024. https://www.shotuk.org/shot-reports/annual-shot-report-2024/
55. SHOT. Key Insights from the 2024 Annual SHOT Report Chapters. https://www.shotuk.org/wp-content/uploads/2025/07/Key-Insights-from-the-2024-Annual-SHOT-Report-Chapters.pdf
56. Murphy MF, et al. Electronic identification systems reduce the number of wrong components transfused (SHOT poster; Transfusion 2019). https://www.shotuk.org/wp-content/uploads/2024/10/Electronic-identification-systems-reduce-the-number-of-wrong-components-transfused.pdf
57. SHOT. Near Miss – Wrong Blood in Tube (WBIT) 2023 chapter. https://www.shotuk.org/wp-content/uploads/2024/10/13a.-Near-Miss-%E2%80%93-Wrong-Blood-in-Tube-WBIT-2023.pdf
58. The Joint Commission. Quick Safety: Temporary names put newborns at risk. https://digitalassets.jointcommission.org/api/public/content/bba9048c71aa44b7aa39d35a274335fb
59. Change in US Hospital Practice After the Joint Commission Requirement to Use Distinct Methods of Newborn Identification: 10-Year Follow-Up Survey (JCJQPS 2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC12533693/
60. Columbia University Center for Patient Safety Science. Our Impact (distinct newborn naming; 36.3% reduction in wrong-patient orders). https://www.vagelos.columbia.edu/departments-centers/center-patient-safety-science/research/our-impact
61. AHIMA Journal. Double Trouble (duplicate records). https://journal.ahima.org/Portals/0/archives/AHIMA%20files/Double%20Trouble.pdf
62. AHIMA. Why Patient Matching Is a Challenge: Research on MPI Data Discrepancies in Key Identifying Fields. https://journal.ahima.org/Portals/0/archives/AHIMA%20files/Why%20Patient%20Matching%20Is%20a%20Challenge_%20Research%20on%20Master%20Patient%20Index%20(MPI)%20Data%20Discrepancies%20in%20Key%20Identifying%20Fields.pdf
63. Hofmeyr GJ, et al. WHO next-generation partograph: revolutionary steps towards individualised labour care. BJOG 2021. https://obgyn.onlinelibrary.wiley.com/doi/10.1111/1471-0528.16694
64. FIGO position statement on the use of the WHO Labor Care Guide versus the partograph (IJGO 2025). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12177285/
65. WHO. WHO Labour Care Guide: User's Manual (2020/2021). https://www.who.int/publications/i/item/9789240017566
66. CMS Hospital Quality Reporting. SDOH measure FAQs (April 2025). https://www.qualityreportingcenter.com/globalassets/2025/04/iqr/14.-sdoh-measure--faqs_2025_vfinal508.pdf
67. Medisolv. An Intro to CMS's SDOH Measures. https://blog.medisolv.com/articles/intro-cms-sdoh-measures
68. MEDITECH. MEDITECH Expanse (solutions and care settings). https://ehr.meditech.com/ehr-solutions/meditech-expanse
69. InterSystems. TrakCare. https://www.intersystems.com/products/trakcare/
70. Epic Systems. Software. https://www.epic.com/software
71. Mindbowser. Epic Modules Every Mid-Sized Hospital Should Know About (third-party catalogue of Epic module names). https://www.mindbowser.com/epic-modules/
72. Oracle. Oracle Health Licensed Software Solution Descriptions (v121925). https://www.oracle.com/contracts/docs/oracle-health-licensed-software-solution-descriptions-v121925.pdf
73. Oracle. Oracle Health (Cerner) Certified Health IT Transparency and Disclosure. https://www.oracle.com/a/ocom/docs/industries/healthcare/cerner-certified-health-it-transparency-and-disclosure.pdf
74. Folio3 Digital Health. All About Cerner Millennium (module list). https://digitalhealth.folio3.com/blog/all-about-cerner-millennium/
75. ACEP. Emergency Department Boarding and Crowding. https://www.acep.org/administration/crowding--boarding
76. Nirmitee. CDS Hooks Implementation Guide for Epic and Oracle (third-party; vendor support claims unverified). https://nirmitee.io/blog/cds-hooks-production-epic-oracle-build-first-hook-guide/
77. Healio. Q&A: Changes to SEP-1 sepsis management bundle spark concern among experts (2023). https://www.healio.com/news/infectious-disease/20231026/qa-changes-to-sep1-sepsis-management-bundle-spark-concern-among-experts
78. The Joint Commission. Emergency Department chart-abstracted measures (ED-1, ED-2). https://www.jointcommission.org/en-us/knowledge-library/support-center/measurement/emergency-department
79. Svandova et al. BCMA Technology and Minimisation of Workarounds: Systematic Review (Human Behavior and Emerging Technologies, 2026). https://onlinelibrary.wiley.com/doi/10.1155/hbe2/7527482
80. HTN. Cambridge University Hospitals revalidates against HIMSS EMRAM Stage 7 (more stringent criteria), Sept 2024. https://htn.co.uk/2024/09/26/cambridge-university-hospitals-nhs-revalidates-against-himss-emram-stage-7-standard/
81. AACN. Nurse Staffing Identified as New Joint Commission National Performance Goal. https://www.aacn.org/newsroom/nurse-staffing-identified-as-new-joint-commission-national-performance-goal
82. Federal Register. Medicare Program: Hospital OPPS and ASC Payment Systems; Quality Reporting Programs … (CY 2026 OPPS/ASC final rule with comment period), doc. 2025-20907, published 25 Nov 2025. It adopts the ECAT eCQM in Hospital OQR (voluntary CY 2027, mandatory CY 2028 / CY 2030 payment determination), removes OP-18 and OP-22 from CY 2028, and removes SDOH-1/2 from OQR. https://www.federalregister.gov/documents/2025/11/25/2025-20907/medicare-program-hospital-outpatient-prospective-payment-and-ambulatory-surgical-center-payment (pass 2: confirmed via search summaries of the final rule. The full rule text was not read.)
83. Medisolv. 2026 IPPS Final Rule: What Your Hospital Should Know. It covers the FY 2026 IPPS final rule CMS-1833-F's removal of HCHE, SDOH-1, SDOH-2 and HCP COVID-19 vaccination from Hospital IQR. https://blog.medisolv.com/articles/2026-ipps-final-rule-what-your-hospital-should-know (secondary; the primary is the FY 2026 IPPS/LTCH final rule in the Federal Register, Aug 2025)
84. CMS QualityNet. Hospital Inpatient Specifications Manuals (v5.18a: discharges 01/01/2026–12/31/2026; v5.19: 2027). https://qualitynet.cms.gov/inpatient/specifications-manuals (also CMS listserves 2025-66-IP [v5.18, June 2025] and 2025-96-IP [v5.18a addendum, Sept 2025] on qualityreportingcenter.com)
85. Federal Register. Health Data, Technology, and Interoperability: ASTP/ONC Deregulatory Actions To Unleash Prosperity (HTI-5 proposed rule), doc. 2025-23896, published 29 Dec 2025. https://www.federalregister.gov/documents/2025/12/29/2025-23896/health-data-technology-and-interoperability-astponc-deregulatory-actions-to-unleash-prosperity (A Federal Register API query on 2026-10-16 found no HTI-5 final rule.)
86. Ranzani OT, et al. Development and Validation of the Sequential Organ Failure Assessment (SOFA)-2 Score. JAMA 2025;334(23):2090–2103. doi:10.1001/jama.2025.20516
87. Afshar M, et al. A Pragmatic Randomized Controlled Trial of Ambient Artificial Intelligence to Improve Health Practitioner Well-Being. NEJM AI 2025;2(12). doi:10.1056/AIoa2500945
88. American Heart Association. Introducing Target: Stroke Phase III (EVT door-to-device goals). https://www.heart.org/en/professional/quality-improvement/target-stroke/introducing-target-stroke-phase-iii (pass 2: the goal wording was confirmed via search excerpt. The page returned HTTP 403 to direct fetch.)
89. InterSystems. TrakCare product page, re-read 2026-10-16 during reconciliation ("InterSystems EHR Numbers to Know": 100M+ patients, 29 countries, 600+ hospitals; TrakCare "deployed in 29 countries"). https://www.intersystems.com/products/trakcare/
90. Companion reports used in the 2026-10-16 reconciliation: `01` §5.1/§12.2, `04` §8.2/§11, `05` §4.6/§9.3, `06` §8 (market roadmap), `07` §9.1/§9.4, `08` §1 #14/§3.5/§3.11, `09` §0 #8/§9.2, `10` §4.4/§4.12; see `RECONCILIATION-LOG.md`.

---

## Verification log (pass 2, 2026-10-16)

| Claim | Verdict | Source | Note |
|---|---|---|---|
| Joint Commission replaced NPSGs with 14 hospital NPGs effective Jan 2026; Goal 3 emergency management, Goal 7 safe informed care, Goal 9 transplant, Goal 12 staffing, Goal 14 medication management | Confirmed | [9][8][81] | Goal-list PDF lists all 14 goals. The full standards PDF is headed "Effective January 2026 for the Hospital Program". AACN: NPGs are "formerly known as National Patient Safety Goals". |
| NPG EP details: NPG.01.01.01 EP1 (≥2 identifiers, no room number), EP2 (specimen labelling in the patient's presence), EP3 (distinct newborn naming, "Smith, Judy Girl"); NPG.01.02.01 critical results; NPG.01.03.01 EP2 boarding goals with attention to acuity | Confirmed | [8] | Text read directly from the HAP NPG report (generated 26 Sep 2025). |
| NPG.08.01.01: validated suicide screening for patients ≥12 treated for behavioural health; NPG.14.01.01 ADC override review ("100% review not required"); NPG.14.06.01 DOT per 1,000 days present/patient days or NHSN AU; NPG.06.01.01 EP6 PDMP; NPG.06.02.01 EP6/EP7; NPG.14.05.01 EP4 | Confirmed | [8] | EP numbering matches the source. |
| NPG.01.05.05 "requires review of whether warning signs preceded in-hospital cardiac arrests" | Corrected | [8] | The standard requires interdisciplinary resuscitation case review. The early-warning-sign review is listed only as an example. |
| NPG.01.06.01–.03 (standardised pre-procedure list; site-marking alternatives for mucosa, teeth, premature infants; time-out participants and minimum agreement items) | Confirmed | [8] | — |
| SAFER Guides 2025: 8 guides, 88 recommendations, 16 High Priority Practices; one-open-chart recommendation removed after an RCT; new topics on AI, FDA device data, patient access to notes/results | Confirmed | [1][6] | Consolidated from 9 guides; recommendations cut from 147 to 88 (40%). The [K] on patient access was removed. SAFER HP 1.2, 1.5 (AI) and 2.3 (photos) numbering checked in [2]. |
| Leapfrog CPOE tool v5.3 (guidance updated 4/1/2026): ≥85% CPOE, ≥60% of serious errors alerted, 8 categories including Excessive Alerts; "Potentially Inaccurate Test Results" means Incomplete Evaluation with a 120-day retest lockout; 2027 non-interruptive-alert expectations | Confirmed | [10] | Hard-stop examples (MAOI + sumatriptan, IT vincristine) confirmed. No 2026 scoring change. |
| Brigham CPOE studies: 55% and later 88% reductions in serious medication errors | Confirmed | [11] | Leapfrog factsheet: 10.7 to 4.9 per 1,000 patient-days (55%), then 88%. |
| Leapfrog BCMA standard: 100% of listed unit types; ≥95% patient and medication scans; 5 decision-support elements; ≥6 of 8 anti-workaround practices | Confirmed | [12] | Factsheet rev. 04/01/2025. |
| BCMA (Poon 2010): 41.4% reduction in non-timing errors (11.5% to 6.8%), 50.8% reduction in potential ADEs, transcription errors eliminated | Confirmed | [39] (Europe PMC abstract) | Wording corrected to "6.1% of transcriptions". Leapfrog's factsheet misquotes the figure as 41.1%. |
| Smart-pump interoperability review: 15.4–54.8% and 21.2–90.5% reductions; manual programming = 77.2% of errors | Corrected | [42] | The ranges are confirmed. The 77.2% figure is not in the review text and was replaced with the review's qualitative wording. |
| AJHP 2026: auto-programming used for 53.4% of infusions (68.3% for high-alert drugs); 1.6 vs 3.3 steps | Confirmed | [43] | Added DERS compliance of 96.1% and a 50.3% fall in hard-limit alerts. |
| ISMP 2024 acute-care high-alert list contents, including tranexamic acid injection | Confirmed (content) / Still unverified ("new in 2024") | [44] | The list does not flag new entries. "New in 2024" depends on comparison with the 2018 list, which was not re-fetched. |
| ECAT eCQM (CMS1244 v1.2.000): >60 min arrival-to-room, LWBS, >240 min boarding, >480 min LOS; 4 age × mental-health strata | Confirmed | [30] | Measurement period CY 2027; intended for Hospital OQR. |
| ECAT voluntary 2027, mandatory 2028 | Confirmed, with programme clarified | [82] | CY 2026 OPPS final rule (FR 2025-20907): OQR, voluntary CY 2027, mandatory CY 2028 / CY 2030 payment determination, replacing OP-18 and OP-22. The FY 2027 IPPS rule only requested comment on inpatient use. |
| ED-2 retired from 1 Jan 2026 | Confirmed | [31] | The MIF page states "This measure is retired as of January 1, 2026". |
| SEP-1 spec "v5.18 for 2026 discharges" | Corrected | [84] | v5.18 (June 2025) plus the v5.18a addendum (Sept 2025) cover 2026 discharges. v5.19 is posted for 2027. |
| SEP-1 failure drivers: 30 mL/kg fluids 31%, repeat lactate 19.6% | Confirmed (clarified) | [35] (PMC full text) | The percentages are of 255 non-compliant cases. Antibiotics >3 h accounted for 16.5%. |
| Target: Stroke Phase III DTN 60/45/30 in 85/75/50%; door-to-device 90 (direct) / 60 (transfer) min in ≥50% | Confirmed | [88] (search excerpt) | The AHA PDFs returned 403. Confirmed from search excerpts of AHA pages. |
| I-PASS: 9 hospitals, 10,740 admissions, errors −23% (24.5 to 18.8/100), preventable AEs −30% (4.7 to 3.3) | Confirmed | [36] (Europe PMC abstract) | — |
| WHO Surgical Safety Checklist: mortality 1.5% to 0.8%, complications 11.0% to 7.0% | Confirmed | [37] (Europe PMC abstract) | 8 hospitals; 3,733 patients before and 3,955 after. |
| Epic Sepsis Model: AUC 0.63, missed 67% of sepsis cases, alerted on 18% of hospitalisations | Confirmed | [22] (Europe PMC abstract) | 38,455 hospitalisations. |
| WHO High 5s German cohort: mean 4.6 discrepancies, omission 69.8% | Confirmed | [46] | n=105 patients. |
| Duplicates: 8–12% industry, RAND 8%, $96 per duplicate, 4% care affected | Confirmed | [62] | RAND: 15–16% in large systems; the $96 figure is from Children's Medical Center Dallas. |
| "AHIMA's target is a ≤1% duplicate rate" | Refuted (as attributed) / Still unverified (as an industry goal) | [61][62] | Neither cited AHIMA article states it. [61] gives 5–10% typical and 5% "acceptable" in physician offices. Wording corrected in §1, §3.1, §19 and §20. |
| Copy-forward: 50% duplicated text, 46% from a different author | Confirmed | [48] | 50.1%; 54.1% of duplicated text came from the same author. |
| "Up to 58% of outpatient note content copied from the author's prior notes" | Corrected | [49] | Median redundancy is measured against the patient's last note (any author): 47.9% in 2009 to 58.8% in 2018. Only 29.4% of 2018 text was typed directly. |
| UCLA ambient-scribe RCT (238 physicians, DAX vs Nabla vs control) | Confirmed | [50][51] | Nabla −9.5% time-in-note; DAX not significant. NEJM AI Dec 2025. |
| Wisconsin pragmatic ambient-AI RCT in NEJM AI [K] | Confirmed | [87] | Afshar et al., stepped-wedge, 66 practitioners, same NEJM AI issue. |
| ASCO-ONS 2024: 16 order elements (Std 3.9), verbal orders only to hold/stop, 4 verifications with the 4th new (video allowed, ≥1 on site), metric weight, oral refills default 0 | Confirmed | [52] | 3.9.1–3.9.16; 3.5.1; 3.12.2.1–3.12.2.4; 3.10.2 ("zero being the preferred default"). |
| 42 CFR 482.13(e): no standing/PRN orders; 4/2/1 h limits up to 24 h; 1-h face-to-face; death reporting by next business day; soft wrist-restraint internal log | Confirmed | [53] | The internal log entry is due within 7 days. |
| SHOT 2024: 899 WBIT near misses; 359 IBCT | Confirmed | [55] | 1,408 near misses in total. |
| SHOT 2023: 986 WBIT; 44% failure to identify at phlebotomy | Confirmed | [57] | 434/986 (44.0%); labelled away from the patient 285/986 (28.9%). |
| SHOT 2024 IBCT = "9.0% of 3,998 reports" | Still unverified | [54] | The denominator is not in the Key Insights PDF (that PDF gives 3,322 error incidents in the HFE chapter). |
| SDOH-1/2 removal from IQR "[K: verify status]" | Confirmed (finalised) | [83][82] | FY 2026 IPPS final rule removed SDOH-1/2 and HCHE from IQR from the CY 2024 reporting period / FY 2026 payment determination. The CY 2026 OPPS rule removed them from OQR. |
| ONC HTI-1 DSI transparency [K] | Corrected / updated | [85] | HTI-1 DSI still applies, but the HTI-5 proposed rule (29 Dec 2025) would remove source-attribute and risk-management requirements. No final rule was found in the Federal Register as of 2026-10-16. |
| SOFA-2 published 2025 [K: verify] | Confirmed | [86] | Ranzani et al., JAMA 2025; 3.34 M ICU encounters, 1,319 ICUs, 9 countries; AUROC 0.79 vs 0.77. |
| CDS Hooks 2.0.1 hooks and feedback API | Confirmed | [21] | Still the current published version. Added medication-refill and problem-list-item-create, plus maturity levels. |
| ATS max waits and thresholds (100/80/75/70/70%) | Confirmed | [28] | — |
| TrakCare 600+ hospitals in 29 countries; KKESH, Northern Territory, NHS trust customers | **Corrected (reconciliation 2026-10-16)** | [69] | The NHS example is North Tees and Hartlepool. The product page gives 600+ hospitals, 29 countries and 100M+ patients for "InterSystems EHR" collectively. TrakCare alone is "deployed in 29 countries" |
| MEDITECH Expanse cloud-native; nurse ambient "coming soon" | Confirmed | [68] | As of fetch on 2026-10-16. |
| CTAS fractiles (98/95/90/85/80%), UK MTS times, Lexicomp renamed "UpToDate Lexidrug", Martha's Rule, "25 by 5", Oracle next-gen EHR naming | Still unverified | — | The official pages returned 403/404 or the search budget was reserved for higher-priority items. They remain [K]. |
