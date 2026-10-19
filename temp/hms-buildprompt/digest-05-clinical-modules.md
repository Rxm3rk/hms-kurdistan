# Digest 05: Clinical modules, functional depth (Kurdistan)

**Sources read:** R03 in full (§1–§21, verification log); K §2, §4.1–§4.3, §5.1–§5.8, §6, §7.9, §8, §9.1, §12.1, §17, §18, K-01…K-30; BP §4.2–§4.3, §5.1–§5.2 (full SI text); RL #4–#6, #11 (already reflected in R03).

**Conventions**
- **Phases:** R1 (M22); R1.1 (≈M25); R2a Inpatient Core (M27); R2b Clinical Safety (M37); R2.1 (≤M40). MVP = R1 + R2 + R2.1. P2 = M38–M54 (GA M50). P3 = M52+ or partner (K §4.2–§4.3).
- **Two tiers:** a Core site (R2a only) keeps orders and the MAR on paper. Clinical Safety (CPOE, verification, eMAR/BCMA, transfusion) activates site-wide, never unit by unit (K-21, K-24; R03 §21.2).
- **Evidence tags:** [K] = R03 practitioner knowledge, unverified. [L] = K local assumption. [E] = estimate.
- **Flags:** CONFLICT and AMBIGUOUS lines mark source disagreements. K governs phasing.

**SI shorthand** (K §5.1; full text BP §5.1): 01 ≥2 identifiers, never room/bed · 02 no administration without active verified order or documented override; reasons never defaulted · 03 every order reaches a terminal state; all work owned with SLA; `TaskOrphaned` ≤5 min · 04 critical results to a named recipient, read-back, timed escalation · 05 dated sourced dosing weight, UCUM, dose maths only in Dose Engine, 10×/100× hard stop; fallback control set until Dose Engine (P2) · 06 signed notes immutable · 07 AI `draft-ai` until signed (P2) · 08 reversible merges; overlays are incidents; auto-merge precision ≥99.9% · 09 med rec blocked while items undecided · 10 clinical ≠ system time · 11 wristband↔unit↔order↔sample + two-person e-witness · 12 money never blocks discharge or emergency care · 13 high-alert double check · 14 hard stops only from governed list; baseline interruptive day 0 · 15 offline limits · 16 banner (photo, 2 IDs, allergies, code status, isolation, dated weight) everywhere; identity re-verified at signing if context changed <60 s · 17 results pending at/after discharge to owned queues · 18 Tier 2 only via Boundary Register · 19 kill switch per rule/flag · 20 PHI residency · 21 sensitivity labels on every channel.

**Kurdistan deltas applied throughout**
- **Text language:** clinical text is English. Patient outputs use the patient's preferred language, captured at registration, from approved Sorani, Badini or Arabic templates (K §4.3, §6.4, §6.7).
- **UI language:** chosen per user (Sorani, Arabic, English). Drug names, doses and units stay in Latin script, with Western digits. Zero untranslated strings in clinical paths; bidi tests for mixed strings (K §6.2, §6.5, §6.7).
- **UI rules and speed:** defaults never select a dose, route or patient; one sign/co-sign pattern; no stacked modals (K §6.2). p95 targets: chart open ≤1.5 s, order sign with CDS ≤1.5 s, BCMA ≤500 ms (K §17).
- **Dropped from R03:** Joint Commission NPG EPs; CMS rules (ECAT/OQR, SEP-1 abstraction, CoP, restraint law, HRSN); EMTALA; EPCS/PDMP; E/M; Cures Act/HIPAA; NHSN; US registries. Generic patterns are kept. Accreditation trace = JCI 8th edition + KRG licensing (K §5.8).
- **Coding:** WHO ICD-10. SNOMED CT licence open (Q-K9; default Global Patient Set + local codes). Medicines via the regional brand master: brand → clinical drug → generic/ATC → GTINs → lot + KB concept (K §8). R03 assumes SNOMED CT/RxNorm/dm+d (R03 §4, §7.2, §10.2).

---

## 1. Patient identity and access

**Phase**
- **R1:** EMPI and registration with Iraqi identity rules, scheduling, OPD token queue, referral tracking (K §4.2).
- **MVP:** aliases, newborn naming, photo, ADT including leave (K §4.3).
- **R1.1:** queue display boards; printed tokens until then (K §4.2).
- **P2:** transfer centre, kiosks, RTLS ingestion (K §4.3); same-gender clinician preference (K §6.7).
- **P3:** predictive discharge (K §4.3).

**Must-have**
- **Search before create:** name, DOB, sex, phone, IDs, address; phonetic and fuzzy. Warn on same first + last name or similar names (R03 §3.1 #1).
- **Matching:** Fellegi–Sunter + document-number shortcut. Normalise ي/ی, ك/ک, ه/ە, alef forms, taa marbuta. Transliteration dictionaries (Muhammad/Mohammed/Mihemed). Extra weight on father's, grandfather's and mother's names and on DOB precision (K §8).
- **Names:** given + father + grandfather + family/tribal; the mother's full name is an identifying attribute. Kurdish (Arabic script), Arabic and Latin forms with variants and a display name per locale; cross-script search (KRI-ID-01) (K §6.7, §8).
- **DOB precision flag:** exact / year only / estimated. Placeholder dates (1 Jan, 1 Jul) get low match weight (K §8).
- **Identifiers:** Unified National Card; older civil ID, nationality certificate; Kurdistan residency card; passport (ICAO 9303 MRZ); UNHCR/IDP documents; MRN with check digit. Read from the document (barcode/MRZ/OCR), never typed. Verification recorded separately ("verify later"; no online service). Mobile number = contact and match feature, not an identifier (K §8, §9.1).
- **Demographics:** legal/preferred name; administrative sex (plus clinical sex parameter and gender identity [K]); contacts; language; interpreter need; next of kin (R03 §3.1 #2). Preferred output language (K §6.7).
- **Photo:** taken at registration, shown on banner, MAR and order entry (R03 §3.1 #2).
- **Bands and labels:** printed at registration with ≥2 identifiers + 1D/2D barcode (R03 §3.1 #4, §21.3 #4). Name in the patient's script + Latin; MRN + DOB or the approximate-DOB flag (K §5.1 SI-01). Zebra `^PA`+`^CI28` shaping, or `^GF` raster with golden-image tests (K §6.7). Long-name truncation tested (R03 §19).
- **Alias pools:** pre-allocated, unique, non-confusable IDs ("Trauma Zulu-17") for unknown, trauma, MCI and downtime patients; merged later (R03 §3.1 #5; K §8).
- **Newborns:** auto-created at delivery, linked to mother, with a distinct name; "Girl A/B" for multiples (R03 §3.1 #6).
  - CONFLICT: R03 §3.1 #6 uses mother's first+last name + sex ("Smith, Judy Girl") and forbids "Babygirl"; K §8 uses "Baby of [mother]".
- **Duplicates:** real-time + batch matching → HIM merge-steward queue (K §6.1). A merge links records and remaps clinical data, orders, results and accounts. It is reversible, propagates via HL7 A40 / FHIR `Patient.link`, stores the algorithm version and is audited (R03 §3.1 #7; K §8).
- **Overlays and deceased:** an overlay is a safety incident: freeze, split by provenance, notify, RCA. Deceased flag + record lock (R03 §3.1 #8–#9).
- **Wrong-patient defences:** similar-name flags on banner and lists; retract-and-reorder monitoring. No one-chart-per-workstation rule (R03 §3.1; BP §5.1).
- **Scheduling:** provider/resource/OR-block templates; linked and recurring bookings; capped overbooking; waitlists with auto-offer; reason-coded cancellations/no-shows; call-forward screens (R03 §3.3). Friday–Saturday weekend, Kurdistan holidays, calendar-aware SLAs (K §4.3, §6.7).

**Workflow:** search → confirm, or create from a document scan → record verification → photo → print band → unknown patients get an alias from a pre-allocated block → merge later (R03 §3.1; K §8).

**Safety:** SI-01; SI-08 (≥99.9% on a 2,000-pair cross-script gold set, S14-K); SI-15 (offline: no IDs outside blocks, no merges; K §7.9); SI-16 (photo, trilingual name); SI-12 (no deposit blocks ED registration); SI-21 (VIP); SI-10 (downtime back-entry); JCI IPSG.1 (K §5.8).

**Data:** Patient; typed Identifier; name parts per script; DOB precision; mother's name; photo; language; Link + algorithm version; alias pool; deceased flag (R03 §3.1; K §8).

**KPIs:** duplicate rate (≤1% internal target vs industry 8–12%); retract-and-reorder per 100k orders (R03 §20); queue age, overlays, % with photo (R03 §3.1); OPD wait, no-shows (R03 §3.3). Kurdistan: duplicates <1%; overlays 0; cross-script precision ≥99.9% (K §17).

**Refs:** R03 §3.1, §3.3, §19–§21; K §4.2–§4.3, §5.1, §5.8, §6.1, §6.7, §7.9, §8, §9.1, §17; BP §5.1.

---

## 2. Ambulatory / OPD visit

**Phase**
- **R1:** OPD chart and orders, immunisation record, OP pharmacy POS with narcotics registers, LIS/RIS with critical-result service, WhatsApp/SMS report release (K §4.2).
- **P2:** patient app, teleconsultation, referrer portal (no commission features), English dictation structuring (K §4.3).
- **P3:** OPD ambient AI, AI-AMB-01 (K §4.1, §4.3).

**Must-have**
- **Consultant workspace:** token-driven queue; one-screen visit; favourites and order chips; brand↔generic e-Rx across regional brands. Median follow-up documentation ≤90 s [E] (K §6.1).
- **Pre-visit and check-in:** care gaps, outstanding results/referrals, questionnaires. Check-in includes photo re-verification and consents (R03 §4 #1–#2).
- **Rooming:** height/weight/BMI; BP repeat logic; allergies coded with reaction + severity ("NKA" ≠ "not assessed"); med list (BPMH); reason; screenings; immunisation status (R03 §4 #3; K §4.3).
- **Note and orders:** HPI, ROS, exam, data review; assessment and plan per problem on the coded problem list. Orders via order sets/favourites, diagnosis-linked (R03 §4 #4–#5).
- **E-Rx:** drug checks, then sent to the in-house OP pharmacy POS (retail, dual currency, narcotics registers) (R03 §4 #6; K §4.3). EPCS, PDMP and benefit checks are dropped (US).
- **Patient instructions/AVS:** plan, written medication information, follow-up (R03 §4 #7), from approved templates (K §4.3).
- **Check-out and close:** check-out releases orders and books follow-up and referrals; sign and close; trainee co-sign (R03 §4 #8–#9). No E/M: the "Kurdistan" documentation profile (K §6.4).
- **Post-visit:** results go to the ordering/responsible clinician with abnormal flags, sort/filter, surrogates, reminders and monitored patient notification (R03 §4 #10).
- **Report release:** by WhatsApp, Viber or SMS via OTP or expiring link, BALP-audited. No clinical content in message bodies. Labelled results and pregnancy tests are never sent by message (K §4.2–§4.3, §5.1 SI-20/21).

**Workflow:** token → check-in → rooming → consult → orders/e-Rx → instructions → check-out → sign → results to inbox (R03 §4). Demo: OPD token → consult → lab → pharmacy → dual-currency bill (K-02).

**Safety:** SI-03 (referrals, results, letters owned); SI-04 (including external referring doctors); SI-05; SI-14; SI-16; SI-20; SI-21; SI-06 (K §5.1).

**Data:** encounter, vitals, coded allergies, med list with source, problems, diagnosis-linked orders, prescriptions, instructions, immunisations (R03 §4).

**KPIs:** visit cycle time; documentation time per visit; after-hours EHR time; open encounters >72 h; unacknowledged abnormal results >7 days; % referrals closed; care-gap closure (R03 §4, §20).

**Refs:** R03 §4, §20; K-02; K §4.1–§4.3, §5.1, §6.1, §6.4.

---

## 3. Emergency department

**Phase**
- **ED module:** R2b. **MLC register:** R2a (K §4.2, §9.1).
- **MVP content:** quick registration, one triage scale per tenant, tracking board, stroke/STEMI/sepsis pathway clocks (workflow timers, not a device), MLC register with police-notification timestamps (K §4.3).
- **R2b:** code documentation (K §4.2).
- **P2:** MCI/disaster mode; rule-based sepsis screen (Regulated Module #2) (K §4.3).
- **P3:** triage AI, partner only (K §4.3).
- AMBIGUOUS: BP §4.3 lists an ED boarding view in MVP; K §4.3 omits it.

**Must-have**
- **Quick registration** with a pre-allocated alias (R03 §5.1).
- **First-class timestamps**, never inferred from notes (R03 §5.1, §21.3 #8): arrival; quick reg; triage start/end; room; first provider; first ECG; CT start/read; first antibiotic/lactate/cultures; decision to admit; bed request/assign/ready; departure; LWBS (including after triage); discharge; AMA.
- **Triage scale per tenant:** ESI v5 (decision points A–D; resources ≥2 → 3, 1 → 4, 0 → 5; HR >100, RR >20 or SpO₂ <92% → consider 2); ATS (immediate/10/30/60/120 min; 100/80/75/70/70%); MTS (German 0/10/30/90/120; UK 0/10/60/120/240 [K]); CTAS (immediate/15/30/60/120; 98/95/90/85/80% [K]) (R03 §5.2).
- **Triage flow:** coded complaint, vitals, pain, allergies, pregnancy status, infection screen (identify–isolate–inform), suicide screen, falls risk → algorithmic level suggestion; nurse override with reason → standing protocol orders where policy allows (ECG ≤10 min chest pain, analgesia, limb imaging) → room, or waiting room with re-triage timers [K] (R03 §5.2).
- **Tracking board:** columns room, patient + similar-name flag, age/sex, acuity, complaint, timers (arrival, last vitals, order), MD/RN; icons for orders pending, new/critical result, consult called, bed requested, isolation, fall risk, sepsis; streams resus, acute, fast track, paediatric, behavioural, results-pending, observation (R03 §5.3).
- **Consults and disposition:** consults carry a request time and response clocks. Disposition: discharge; admit (decision time, bed request, I-PASS); transfer out; observation; AMA; LWBS. Boarders get inpatient orders, MAR and nursing assessments (R03 §5.3).
- **Stroke:** last-known-well, NIHSS, code-stroke order set, weight-based thrombolytic dose with double check, board timers. Door-to-needle ≤60 min in ≥85%, ≤45 in ≥75%, ≤30 in ≥50%. Door-to-physician ≤10, stroke team ≤15, CT start ≤25, CT read ≤45 min (R03 §5.4).
- **STEMI:** first ECG ≤10 min; door-to-balloon ≤90 min; FMC-to-device ≤120 min if transferred [K]; cath-lab activation (R03 §5.4). ECG integration (I) is P2 (K §4.3).
- **Sepsis:** visible time zero; ≤3 h lactate, cultures before antibiotics, broad-spectrum antibiotics, 30 mL/kg crystalloid if hypotension or lactate ≥4; ≤6 h repeat raised lactate, vasopressors and reassessment in shock (CMS SEP-1 definition) (R03 §5.4). Until P2: clocks + non-scoring checklist (K §5.6).
- **Thrombolytic dose maths:** belongs to the Dose Engine (P2). Until then, KB output is shown verbatim, with a pharmacist double check (K §5.1 SI-05, §5.6).
- **Trauma:** activation level, CT/OR times, MTP order set linked to blood bank, survey flowsheet (R03 §5.4). Not named in K §4.3.
- **MLC register:** locked, append-only, with police-notification timestamps; corrections are addenda; forensic/MLC label (K §5.1 SI-21, §8, §9.1).
- **Code documentation:** the resuscitation record feeds resuscitation review (K §4.2; R03 §19).
- **P2 MCI mode:** command switch; pre-built aliases with pre-printed barcoded bands; START/SALT tags; minimal data sets; location tracking and family reunification; simplified order sets; read-only snapshots; post-event merge (R03 §5.5).

**Workflow:** arrival/quick reg → triage → protocol orders → room or waiting (re-triage) → provider → orders, clocks → consults → disposition → boarding (R03 §5.2–§5.3).

**Safety:** SI-01; SI-10; SI-12 (no deposit or payment rule blocks ED registration or emergency orders); SI-15; SI-03; SI-21; SI-18 (sepsis screen) (K §5.1, §5.6).

**Data:** event timestamps; scale, level and override reason; coded complaint; alias → identity link; time zero; disposition; MLC entry with police-notification time (R03 §5; K §8).

**KPIs:** % arrival-to-room >60 min, % boarding >240 min, % LOS >8 h, LWBS % (US ECAT gap criteria, kept as definitions); triage time-to-clinician compliance; stroke DTN; sepsis bundle compliance (R03 §20); door-to-provider, triage accuracy, 72-h return with admission, ECG ≤10 min (R03 §5.5); MLC entries 100% on time (K §17).

**Refs:** R03 §5, §19–§21; K §4.2–§4.3, §5.1, §5.6, §8, §9.1, §17; BP §4.3.

---

## 4. Inpatient care and ADT

**Phase**
- **R2a:** ADT and bed board, ward census, downtime, inpatient billing (deposits, packages, running bill, discharge billing) (K §4.2).
- **R2b:** discharge and med rec, nursing (K §4.2).
- **MVP clinical core:** I-PASS (K §4.3).
- **P2:** transfer centre; RTLS; English AI discharge drafts (K §4.3).
- **P3:** predictive discharge (K §4.3).
- AMBIGUOUS: K §4.2 names no release for I-PASS.

**Must-have: ADT (R03 §3.2)**
- **Admission:** pending admit (expected date, level of care); timestamped decision to admit with level, service, attending, isolation (#1–#2).
- **Bed flow:** bed request → assign → ready → arrival, each timed, on a bed state machine (#3; K §4.3). Bed board with EVS tasks (R03 §21.1 #1).
- **Patient class:** admit as inpatient or observation, with a status-change workflow (#4).
- **Transfers:** bed swap; inter-unit with transfer med rec and handoff; level-of-care change; service/attending change (#5).
- **Leave and pending events:** LOA suspends medication due times, keeps the bed and records the return (#6). Pending transfer/discharge; expected discharge date drives planning (#7).
- **Discharge and corrections:** discharge records disposition and time and triggers bed cleaning (#8). Cancellations need a reason; back-dated events need supervisor rights and are audited (#9).
- **Census and downtime:** midnight census reconciliation; downtime re-entry keeps clinical vs system time (#10).
- **Interfaces:** HL7 v2 ADT (A01–A13, A17, A40); FHIR Encounter Subscriptions.
- **Deposits:** pre-admission deposits stay hospital policy. No deposit rule blocks ED registration, emergency order or discharge order (K §5.1 SI-12, §12.1).

**Must-have: inpatient clinical (R2b)**
- **Admission order set:** level of care, attending, diet incl. religious preferences (K §4.3), activity, VTE assessment, code status, isolation, nursing protocols, admission med rec (R03 §6.1 #1).
- **H&P:** problem-oriented, pulling ED/outside notes with attribution. Timing per hospital policy (R03 cites US CoP 24 h) (R03 §6.1 #2).
- **Problems and banner:** coded longitudinal problem list + hospital list with principal problem, driving drug–disease CDS. Code status and advance directive on the banner (R03 §6.1 #3, #6).
- **Rounding lists** by team/unit/service: vitals trend, NEWS2, new results, LDAs, line and Foley days, VTE status, discharge readiness (R03 §6.2).
- **Visiting consultants:** tablet-first evening rounds; "changes since last note"; queue of results, co-signs, orders to sign, consults, discharges due (K §6.1).
- **Rounds and consults:** interdisciplinary checklist (device necessity, sedation/delirium, mobility, nutrition, VTE, glucose, 48–72 h antibiotic time-out, discharge barriers) [K]. Consults carry question, urgency, acceptance/response times; note routed back (R03 §6.2).
- **I-PASS:** Illness severity (stable/watcher/unstable), Patient summary, Action list (owners, due times), Situation awareness/if-then, receiver Synthesis; auto-filled allergies, code status, drips, lines, recent critical results with attribution; printable/mobile sign-out; handoff audit (who → whom, when); bedside nursing SBAR/I-PASS (R03 §6.3; K §6.5).
- **Discharge:** expected date + risk screen (LACE/HOSPITAL [K]) from admission; readiness checklist (criteria, meds ready, teach-back, equipment, transport, follow-up booked); discharge order with disposition; summary (diagnoses, procedures, course, results pending with owner, med changes, follow-up); AVS (med list, warning signs, contacts); transmission; post-discharge call/text; 30-day readmission flag (R03 §6.5). Patient parts from templates (K §4.3).
- **P2:** source-cited English AI discharge drafts as `draft-ai` (K-23; SI-07).

**Workflow:** pending admit → decision → bed request/assign/ready → admit (order set, H&P, BPMH/med rec, nursing assessment) → rounds, notes, consults → shift handoffs → transfers (med rec) → readiness → discharge order → summary/AVS → bed cleaning (R03 §3.2, §6).

**Safety:** SI-12; SI-09; SI-17; SI-10; SI-15 (no bed allocation offline); SI-03; SI-16 (code status, isolation) (K §5.1).

**Data:** encounter class; location history; attending/admitting/consulting providers; accommodation; isolation; expected and actual times; disposition; diagnoses; admission source (R03 §3.2); handoff audit (R03 §6.3).

**KPIs:** med rec ≤24 h; discharge summary ≤48 h (≥90% est.); 30-day readmission; I-PASS each shift (≥95% est.) (R03 §20); decision-to-admit → bed, bed → arrival, discharge order → departure, discharges before noon, turnaround, occupancy, ALOS (R03 §3.2); I-PASS coverage (K §5.2).

**Refs:** R03 §3.2, §6, §20, §21.1; K-23; K §4.2–§4.3, §5.1–§5.2, §6.1, §6.5, §12.1.

---

## 5. CPOE and order management

**Phase**
- **R1:** OPD orders (K §4.2).
- **R2b:** inpatient CPOE, site-wide only (K §4.2, K-24).
- **R2a Core:** orders on paper; pharmacy transcribes (module 7) (K §4.2).
- **P2:** CDS Hooks/CQL; Dose Engine; chemotherapy (K §4.3).

**Must-have**
- **Order types:** medications, labs, imaging, procedures, nursing, diet (religious preferences, K §4.3), activity, consults, referrals, blood, isolation, ADT, therapy, respiratory, code status. Structured by default; free text monitored, with an alert when a structured equivalent exists (R03 §7.1).
- **Orderables master:** coded (LOINC labs; regional brand master for medicines); defaults; required fields; specimen requirements; synonyms incl. brands; Tall Man lettering (R03 §7.2 #1; K §8). Typo-tolerant brand↔generic search (K §6.2).
- **Order sets:** versioned, evidence-linked, owner + review date; pre-selected vs optional; conditional logic (weight, renal); nurse-driven protocols (electrolytes, insulin, anticoagulation nomograms, Foley removal) (R03 §7.2 #2). Linked monitoring for aminoglycosides, digoxin, lithium, phenytoin, warfarin (#3).
- **Timing types:** STAT/ASAP/routine/timed; future; standing/recurring with expiry and renewal reminders; conditional ("if K <3.5 then…"); PRN with indication + max frequency; titratable with parameters; taper (R03 §7.2 #4; K §4.3).
- **Phase-of-care / signed-and-held orders:** pre-op → intra-op → PACU → post-op; transfer orders released on arrival (R03 §7.2 #5).
- **Verbal/telephone orders:** defined situations only. Read-back (checkbox + attestation), source and receiver captured. Prescriber co-signs on timers within the policy limit, tracked in the HIM deficiency queue. Prohibited for antineoplastics except hold/stop (R03 §7.2 #6; K §4.3, §6.1). Co-sign routing for trainee and protocol orders (#7).
- **Duplicate checks:** exact + therapeutic across active, pending and recently resulted orders; look-back per orderable (R03 §7.2 #8).
- **Gates:** dated sourced weight, height and allergies before medication orders. Age, weight, allergies and pregnancy status visible while ordering (R03 §7.2 #9; K §4.3). Indication required for antimicrobials, PRNs and imaging (#10); stewardship rules in module 6.
- **Lifecycle:** draft → pending signature/co-sign → active → [pharmacy verification pending] → in progress (collected/dispensed/scheduled) → completed/resulted. Also on-hold/suspended (NPO, OR, LOA), discontinued, cancelled, expired, entered-in-error. Each transition logs actor, time and reason (R03 §7.3). State-machine specs come before UI (K §8).
- **Order-to-result tracking:** overdue "not yet resulted" view per clinician/unit; amended-result notices; ordering + responsible clinician on every test (R03 §7.4).
- **Visiting consultants:** tablet-first fast ordering with favourites, order chips, order sets (K §6.1, §18 risk 15).
- **Leapfrog harness:** 8 categories (incl. Excessive Alerts), run on customer content after every KB or content release (R03 §7.5; K-10, §6.3).

**Workflow:** select → compose → inline CDS → sign (re-verify identity if context changed in the last 60 s) → co-sign → verification (meds) → in progress → resulted → acknowledged (R03 §7; BP §5.1).

**Safety:** SI-02; SI-03; SI-05 (until the Dose Engine, a KB result ≥10× max is a Tier A hard stop); SI-14; SI-15 (no new prescribing offline without full CDS); SI-16; SI-19; SI-10 (K §5.1, §5.6).

**Data:** orderable code; timing type; parameters; indication; PRN reason/max; ordering, responsible and co-signing practitioners; verbal-order source/receiver/read-back; status history (R03 §7).

**KPIs:** medication CPOE ≥85%; Leapfrog test ≥60%, aiming for 100% on fatal orders (R03 §20); overdue verbal orders (R03 §15.8). Kurdistan: inpatient CPOE share ≥70% at 90 days, ≥85% at 12 months (K §17); below 70% at 90 days triggers risk 15 (K §18).

**Refs:** R03 §7, §15.8, §19–§21; K-10, K-24; K §4.2–§4.3, §5.1–§5.2, §5.6, §6.1–§6.3, §8, §17–§18.

---

## 6. Clinical decision support (CDS)

**Phase**
- **MVP:** drug-KB adapter with local re-tiering and regional brand mapping; Leapfrog-category harness; VTE; NEWS2/PEWS/MEOWS (Regulated Module #1; non-ICU wards; nurse-validated observations) (K §4.3).
- **At go-live:** stewardship control set (K §5.2).
- **P2:** Dose Engine (Class C rigour, ≈M50); rule-based sepsis screen (Regulated Module #2); partner predictive deterioration, run silent first; CDS Hooks/CQL; stewardship module CLN-AMS-01 (K §4.3, §5.6).
- CONFLICT: R03 §21.1 #4 puts the CDS Hooks client and sepsis screening in CDS v1; K §4.3 puts both in P2.

**Must-have**
- **Tiers:** A = hard stop (≤20 rules). B = interruptive with reason (≤8 per 100 medication orders at go-live, ≤5 by month 12). C = inline passive. D = pharmacist queue (K §6.3).
- **Hard stops:** only for absolute contraindications, e.g. MAOI + sumatriptan, intrathecal vincristine (R03 §7.5).
- **Minimal interruptive set:** Level 1 DDIs, true severe allergies, high-alert dose limits, fatal routes. Everything else goes to order sets, passive guidance or pharmacist queues (R03 §21.3 #1).
- **Catalogue:** drug–allergy (tiered cross-sensitivity); DDI (severity tiers, suppression list); drug–disease (problem list); dose range (single/daily/cumulative; weight, BSA, renal, hepatic, age, paediatric; working shown); duplicate therapy; drug–lab; drug–route (fatal routes hard stop); pregnancy/lactation; monitoring reminders; advisories inside order sets; EWS; stewardship; imaging appropriateness (R03 §8.2).
- **Drug KB:** licensed (P), never built (K-09). Pluggable adapter; local override layer; versioned releases with regression tests (R03 §8.6). Screening shown verbatim; vendor's written regulatory position required (K §5.6).
- **Governance in product:** registry (purpose, evidence, owner, users, trigger, format, expected firing rate, retire-by date); telemetry (firing, accept/override, reasons, time-to-action, outcome); in-line feedback; quarterly alert-burden review (R03 §8.7). Each interruptive rule has owner, evidence, measured PPV, review-by date (BP §5.1 SI-14).
- **Rollout and retirement:** vendor baseline interruptive from day 0. New or locally modified rules run silent 2–4 weeks with replay. Rules with >90% override are reviewed, never auto-retired; Tier A/B exempt (K §5.4, §6.3).
- **Kill switches:** one per rule and per flag; safety-relevant changes default to off (BP §5.1 SI-19).
- **VTE:** Padua/Caprini/UK DoH assessment at admission and transfer, in the admission order set. Contraindications; prophylaxis or documented reason; reassess at 24 h and on change [K] (R03 §8.4). As a sweep candidate, fallback = prompts with clinician-chosen actions, pending written triage by M9 (K §5.6).
- **NEWS2:** RR, SpO₂ Scale 1/2, air vs O₂ (+2), SBP, pulse, ACVPU (new confusion = 3), temperature. 0 → ≥12-hourly; 1–4 → 4–6-hourly; single 3 → ≥hourly + urgent ward review; 5–6 → urgent response; ≥7 → emergency response. PEWS age-banded; MEOWS in pregnancy (no NEWS2 [K]). Components shown; escalation is a tracked task (who, when, response time) (R03 §8.3).
- **NEWS2 activation:** local opinion, safety case, usability with Kurdish-, Arabic- and English-first nurses, hospital sign-off, independent assessor (K §5.6).
- **NEWS2 fallback:** electronic charting; nurse-calculated score; nurse-assigned escalation; observation frequency set by the nurse, never by a score (K §5.6).
  - CONFLICT: R03 §8.3/§19 want score-driven observation frequency; K §5.6/§5.7 forbid a score driving care unless the Register allows it.
- **Stewardship control set:** restricted antimicrobials need indication + approver (order entry on Clinical Safety sites; transcription on Core sites); mandatory 48–72 h time-out task to prescriber; stop/review date on every antimicrobial order; monthly DDD/DOT from dispensing data; stewardship lead named at RG1 (K §5.2). **P2** module adds culture–therapy mismatch and IV-to-PO lists (R03 §8.5).
- **P2 sepsis screen:** SIRS/qSOFA/NEWS2 + lactate rules; non-interruptive; inputs shown; team notification with time zero; local validation (R03 §8.2, §21.1 #4).
- **Predictive models:** partners only, run silent first (K §4.3, §5.7).

**Safety:** SI-14, SI-19, SI-18, SI-05, SI-07 (P2) (K §5.1).

**Data:** artefact registry; firing/override telemetry with reasons; KB version; override layer; score components; escalation tasks (R03 §8).

**KPIs:** override rate (R03 §20: retire >90% override, est.; K §6.3: review, never auto-retire, Tier A/B exempt); interruptive alerts per 100 orders; NEWS2 escalation compliance (≥90% est.); arrests outside ICU; DOT per 1,000 days present (R03 §20); VTE assessment % (R03 §8.4). Kurdistan: ≤8/100 at go-live, ≤5 at 12 months; NEWS2 ≥5 reviewed within policy ≥90% (K §17).

**Refs:** R03 §7.5, §8, §20, §21; K-09, K-10; K §4.3, §5.1–§5.2, §5.4, §5.6–§5.7, §6.3, §17; BP §5.1.

---

## 7. Closed-loop medication

**Phase**
- **R1:** OP pharmacy POS (retail, dual currency, narcotics registers) (K §4.2).
- **R2a Core:** IP dispensing against transcribed paper orders under the Core transcription control set; stewardship control set; receipt of patient-supplied medicines (K §4.2).
- **R2b:** CPOE, verification, eMAR and mobile BCMA with offline mode; Dose Engine fallback control set site-wide incl. NICU/PICU; med rec (K §4.2).
- **P2:** Dose Engine; pumps (one vendor, orders never commands, only once BCMA ≥95%); ADC (I); chemotherapy (K §4.3, K-09); Ramadan mode (fasting-aware timing templates) (K §6.7).
- **P3:** IV compounding (K §4.3).
- CONFLICT: R03 §21.1 #5 puts the ADC profile interface in MVP; K §4.3 puts ADC (I) in P2.

**R2a Core transcription control set (K §4.2):** only pharmacists transcribe, attaching an image of the signed paper order; KB allergy, interaction and dose screening at transcription with the dosing double check; ordering practitioner mandatory; second check for high-alert and paediatric orders; no MAR, schedule or "active medicines" view from transcribed orders (screen labelled "dispensing record, not an order or MAR"); transcribed orders are reconciliation input only at upgrade; 50 audited monthly.

**Must-have (R2b loop)**
- **Prescribe:** drug, dose, unit, route, frequency, duration, indication, PRN reason, max dose, explicit dated dosing weight (R03 §9.2 #1). Dose maths only in the Dose Engine; until then, KB output verbatim (K §5.6).
- **Verify:** queue ranked by STAT, first dose and high-alert; STAT ≤15 min timer; full view (labs, renal, allergies, weight); interventions documented; therapeutic interchange. First doses unavailable until verified, except the emergency override list (R03 §9.2 #2; K §6.1).
- **Extended fallback control set:** system-enforced independent pharmacist double check on every weight- or BSA-based dose (any age), every high-alert infusion and every neonatal order; KB result ≥10× max = Tier A hard stop; seeded 10×/unit errors in each test cycle; alarm if no pharmacist is logged into the queue >30 min; review within 4 h of any dose given before verification; 24×7 pharmacist cover at RG1 (K §5.6).
- **Dispense:** barcoded unit doses, standard concentrations (R03 §9.2 #3). In-house unit-dose labels from the regional brand master; many GTINs → one orderable; new products scan-tested (K §4.3, §8).
- **Patient-supplied medicines:** pharmacy receives, identifies, expiry-checks, relabels to the patient and flags "patient-supplied". Unverified outside medicines cannot be scanned for administration (K §5.1 SI-12, §12.1).
- **Payment never delays care:** no payment rule delays a verified time-critical dose (STAT and first doses, antimicrobials, insulin, anticoagulants, anticonvulsants); it is charged to the running bill (K §5.1 SI-12).
- **BCMA:** MAR (due/overdue/PRN/held, with windows) → scan wristband → scan drug → checks: wrong patient/drug/dose (partial or multiple units), expired, early/late, allergy, duplicate administration, held order, high-alert double check, pre-administration assessments (HR before digoxin, pain before opioid, glucose before insulin) (R03 §9.2 #4).
- **PRN:** reason, pre-assessment, reassessment task (pain 30–60 min after) (R03 §9.2 #4).
- **Infusions:** rate changes checked against titration parameters; bag changes; volume infused feeds I&O; model ready for P2 pumps (R03 §9.2, §21.1 #5). Until then: manual programming + BCMA scan (K §5.6).
- **Not given and controlled drugs:** not-given reasons; witnessed controlled-drug waste; counts, discrepancy resolution, chain of custody; Iraqi narcotics registers (R03 §9.2, §9.5; K §4.1).
- **Override controls:** reasons never default to the first option; scan-failure analytics; per-user/unit compliance dashboards (R03 §19, §21.3 #4).
- **Offline BCMA:** encrypted cache; administer only against orders verified before the outage (K §6.6).
- **Monitor:** linked labs/levels; opioid sedation scores; ADE triggers (naloxone, flumazenil, vitamin K, glucose <50 mg/dL) [K] (R03 §9.2 #5).
- **High-alert:** ISMP 2024 list, incl. opioids by all routes, insulin, anticoagulants, concentrated KCl, IV oxytocin, TXA injection. Standard concentrations, tall-man, hard limits, documented double checks, weekly methotrexate default with indication [K] (R03 §9.4).
- **Med rec:** BPMH by pharmacist/tech/nurse from patient/caregiver, prior lists, pill bottles (source, confidence, last dose per item); explicit admission decision per item (continue/modify/hold with reason/stop), completion blocked while undecided; transfer review of all active orders; discharge list flagged new/changed/stopped/unchanged in the patient's language from a template (R03 §6.4; K §4.3).

**Safety:** SI-02, SI-05, SI-09, SI-12, SI-13, SI-15, SI-01 (K §5.1); JCI MMU, IPSG.3 (K §5.8).

**Data:** verification + interventions; dispense (lot, GTIN, label); administration (scans, times, overrides + reason, witness); patient-supplied flag; PRN reassessment; waste (R03 §9; K §12.1).

**KPIs:** scan compliance ≥95%; pump auto-programming rate (P2); ADEs per 1,000 patient-days; DOT (R03 §20); override rate by reason; STAT/first-dose verification turnaround; omitted critical medicines (R03 §9.6). Kurdistan: scans ≥95% at 90 days, ≥98% at 12 months, 100% unit coverage; extended double checks 100%; no-pharmacist gaps >30 min = 0; pre-verification doses reviewed ≤4 h = 100%; time-critical doses delayed by payment = 0 (K §17).

**Refs:** R03 §6.4, §9, §19–§21; K-09, K-21, K-24; K §4.1–§4.3, §5.1–§5.2, §5.6, §5.8, §6.1, §6.6–§6.7, §8, §12.1, §17.

---

## 8. Nursing

**Phase**
- **R2b** (K §4.2).
- **MVP content:** assessments, flowsheets, I&O, charting by exception; Braden/Morse/delirium; care plans and shift worklists; wound photos; flowsheet field governance; paediatric weight-based rounding; UI language per nurse (K §4.3).
- **Also R2b:** NEWS2/PEWS/MEOWS on non-ICU wards where the Register allows (K §4.2).
- **P3:** nursing ambient (partner, after S8-K); acuity-based staffing (K §4.3).
- CONFLICT: R03 §10.2 #8 includes acuity scoring for staffing; K §4.3 defers acuity-based staffing to P3.

**Must-have**
- **Shift brain-sheet:** due, overdue, PRN-eligible, changed, escalations. I-PASS/SBAR generated from the chart (K §6.1, §6.5).
- **Admission assessment:** history, function, skin, falls, nutrition (MUST/MST [K]), pain, psychosocial, learning needs, home meds, devices, isolation screen. Suicide screen with a validated tool for ages ≥12 in behavioural health, with risk level and mitigation (R03 §10.2 #1; K §4.3).
- **Shift assessments:** by exception against defined normals; reassessment intervals set by acuity, scores and policy (R03 §10.2 #2).
- **Flowsheets:** vitals (device-captured, nurse-validated); I&O with running balance; LDAs (insertion date, site, day count, removal); wounds (body map, staging, measurements, consented photos, dressing plan); neuro checks; restraint monitoring; glucose/insulin; sedation scales (R03 §10.2 #3).
- **Scores:** auto-calculated and triggering care-plan interventions: Braden (≤18 at risk [K]), Morse (≥45 high, set locally [K]), Waterlow, CAM-ICU/4AT, RASS, CPOT, GCS (R03 §10.2 #4). Braden/Morse are sweep candidates; fallback = prompts with clinician-chosen actions (K §5.6). JCI IPSG.6 = Morse with care-plan prompts (K §5.8).
- **Care plans:** problem → goal → interventions → evaluation; SNOMED CT-coded library with optional NANDA-I/NIC/NOC mapping (R03 §10.2 #5).
  - AMBIGUOUS: SNOMED licence undecided for Kurdistan (K §8, Q-K9).
- **Worklists:** built from orders, protocols, scores (Braden ≤18 → 2-hourly turn task), MAR, overdue documentation and escalations, ordered by due time (R03 §10.2 #6).
- **Mobile nurse mode:** BCMA; bedside specimen labels printed in the patient's presence; vitals; in-app photos, never the camera roll (R03 §10.2 #9, §15.6; K §6.6).
- **Language:** UI in Sorani, Arabic or English per nurse. Drug names, doses and units stay in Latin script with Western digits, so a nurse never translates a dose (K §6.5).
- **Devices and alarms:** vitals validated, not transcribed; no auto-filed artefacts; device–patient association with auto-dissociation at discharge/transfer (R03 §10.3; K §4.3, §6.5). Role-based authority to change/disable alarms (R03 §10.3); alarm forwarding never built (K §5.6).
- **Training:** up to 14 h for nurses new to computers (K §6.8).

**Workflow:** handover/brain-sheet → assessments → MAR and tasks → observations → score → escalation task → care-plan update → handover (R03 §10.2; K §6.5).

**Safety:** SI-01, SI-02, SI-13, SI-03 (escalations owned), SI-16, SI-18, SI-10 (K §5.1).

**Data:** flowsheet rows with clinical time, device provenance and validation; I&O balance; LDA days; wound images with consent and body site; scores with components; care plans; tasks (R03 §10).

**KPIs:** falls with injury per 1,000 patient-days; HAPI stage 2+; NEWS2 escalation compliance; CLABSI/CAUTI (R03 §20); assessments on time; documentation time per shift; restraint prevalence; scan compliance (R03 §10.3). Kurdistan: nurse documentation time −20% and nurse SUS ≥72 at 12 months (K §6.8, §17).

**Refs:** R03 §10, §15.6, §19–§21; K §4.2–§4.3, §5.6, §5.8, §6.1, §6.5–§6.6, §6.8, §8, §17.

---

## 9. Critical care / ICU

**Phase**
- **R2b:** ICU flowsheet with nurse-validated vitals (K §4.2).
- **R2.1:** validated monitor feed; manual until then (K §4.2).
- **P2:** severity scores; IHE ACM (K §4.3).
- **P3:** tele-ICU (B+P); alarm analytics (K §4.3).
- **NEWS2:** non-ICU wards only (K §4.3).

**Must-have**
- **Device gateway:** via middleware, with device–patient association and auto-dissociation. Nurse-validated charting at configurable intervals (e.g. validated q1h, stored q1–5 min [K]). Device provenance kept (R03 §11 #1; K §4.3).
- **24-h grid:** drips (rate, dose, concentration, units); titration vs parameters; hourly I&O balance; LDA days; ventilator bundle (head of bed, SAT/SBT, oral care); ABCDEF bundle [K] (R03 §11 #2).
- **Rounds and transfer:** multidisciplinary rounds with daily goals, line necessity and antibiotic time-out (R03 §11 #4). Transfer out with med rec and handoff (#6).
- **Waveforms:** high-resolution waveforms stored apart from the legal record (R03 §11).
- **P2 scores:** SOFA (SOFA-2 by configuration), APACHE II/IV, SAPS, automated with components; RASS, CAM-ICU, CPOT (R03 §11 #3; K §4.3).
- **P3 tele-ICU:** multi-patient view, acuity flags, video, order privileges (R03 §11 #5).

**Safety:** never in the primary alarm path; alarms never built (K §4.3, §5.7). SI-10; SI-05/SI-13 (high-alert infusion double check); SI-02; SI-15 (K §5.1, §5.6).

**Data:** observations with provenance and validation status; infusion parameters; ventilator settings; LDAs; scores (R03 §11).

**KPIs:** SMR; ICU LOS; ventilator days; VAE/CLABSI/CAUTI; unplanned extubations; readmission <48 h; delirium prevalence; sedation-target attainment (R03 §11, §20).

**Refs:** R03 §11, §20; K §4.2–§4.3, §5.1, §5.6–§5.7.

---

## 10. Perioperative

**Phase**
- **R2a:** OT scheduling and OT billing (K §4.2).
- **R2b:** WHO checklist (K §4.2).
- **R2.1:** anaesthesia pre-assessment and intra-op/PACU record (lite; paper until then) (K §4.2).
- **MVP:** intra-op record with implants and consumables to charge and stock (K §4.3).
- **P2:** full AIMS with device feed; OR analytics (K §4.3).
- AMBIGUOUS: K §4.2 names no release for the intra-op record.
- CONFLICT: R03 §2 row 23 puts implants and preference cards in P2; K §4.3 puts implant/consumable capture in MVP.

**Must-have**
- **Case request:** procedure, laterality, duration (surgeon history), equipment, implants, blood, anaesthesia type, positioning. Block schedule with release times; add-on/urgent classes; preference cards linked to supply (R03 §12.1 #1). No OT allocation offline (SI-15).
- **Pre-op assessment:** ASA, airway, comorbidities, RCRI, tests, medication instructions incl. perioperative anticoagulant protocol, optimisation pathways (R03 §12.1 #2).
- **E-consent:** procedure-specific risks; patient/witness/clinician signatures; interpreter; versioned; shown in OR (R03 §12.1 #3). Guardian/co-signer consent and chaperone documentation at R2b (K §6.7).
- **Pre-op checks:** holding checklist covering identity, consent, site marking, NPO, allergies, labs, blood, implants, antibiotics, H&P, nursing and pre-anaesthesia assessments, labelled imaging (R03 §12.1 #4). Site marking by the accountable practitioner, with alternatives for mucosa, teeth and premature infants (#5).
- **WHO SSC**, captured by role in real time (R03 §12.1 #6):
  - **Sign in:** identity, site, procedure, consent; site marked; anaesthesia machine/medicines check; oximeter; allergy; airway/aspiration; >500 mL blood loss (7 mL/kg children).
  - **Time out:** introductions; confirm patient/site/procedure; critical events; antibiotic prophylaxis ≤60 min; imaging displayed.
  - **Sign out:** procedure recorded; counts; specimen labels; equipment problems; recovery concerns.
  - Incision time cannot be documented before time out [K].
- **Intra-op record:** in room, anaesthesia start, incision, closure, out of room; personnel; positioning; skin prep; tourniquet times; counts; barcoded specimens; implants by UDI scan (lot, serial); wound class; drains; syringe label printing (R03 §12.1 #7, §19).
- **Implant and supply capture:** flows to charge and stock; usage reconciled against waste (R03 §12.1 #10; K §4.3).
- **PACU:** Aldrete/PADSS [K]; pain/PONV; anaesthesia → PACU handoff; discharge criteria (R03 §12.1 #9).
- **P2 AIMS:** high-frequency vitals/ventilator capture; barcode syringe labels; fluids, blood, events, airway (R03 §12.1 #8).

**Safety:** SI-01, SI-15, SI-13, SI-03; JCI IPSG.4 checklist completion (K §5.8).

**Data:** booking; block; checklist steps by role/time; intra-op timestamps; counts; implants (UDI, lot, serial); consumables; specimens (R03 §12).

**KPIs:** first-case on-time starts (≥80–90% est.); block utilisation (75–85% est.); WHO checklist 100% across all three phases (R03 §20); turnover; same-day cancellations; duration accuracy; SSI; never events; implant documentation completeness (R03 §12.2).

**Refs:** R03 §2, §12, §19–§21; K §4.2–§4.3, §5.8, §6.7.

---

## 11. Maternity and neonatal

**Phase**
- **MVP:** labour and delivery record; newborn registration and mother–baby link; birth and death notifications on KRG forms (R2a); statutory-register framework (K §4.2–§4.3, §9.1).
- **R2b:** NICU/PICU live with the site under the fallback control set (K §5.1 SI-05); MEOWS where the Register allows (K §4.2).
- **P2:** antenatal episode and WHO LCG; NICU with human-milk tracking (K §4.3).
- AMBIGUOUS: K §4.2 names no release for the L&D record or newborn registration.
- CONFLICT: R03 §2 rows 26–27 put maternity and NICU in P2; K §4.3 puts the L&D record and newborn registration in MVP.

**Must-have (MVP)**
- **Obstetric triage**, with MEOWS for maternal observations (R03 §13.2 #1).
- **Delivery record:** mode; times (full dilatation, delivery, placenta); perineal trauma; quantitative blood loss with PPH bundle; oxytocin and TXA (ISMP high-alert); cord gases; Apgars (R03 §13.2 #4).
- **Newborn:** auto-created with shared episode, linked bands, infant security tags and distinct name. Assessment, vitamin K, immunisations, feeding, screening, hearing, growth (R03 §13.2 #5, §3.1 #6).
- **Statutory forms:** KRG birth notification; death certificate with ICD-10 cause of death in WHO format. Entries are locked and append-only; corrections are addenda (K §8, §9.1).
- **Postnatal:** MEOWS, VTE assessment, breastfeeding support, contraception counselling (R03 §13.3).
- **NICU basics:** corrected gestational age; weight-based dosing with decimal precision (0.1 mL/h rounding) (R03 §13.3); pharmacist double check on every neonatal order (K §5.6).
- **Sensitivity:** reproductive-health label; pregnancy tests never released by message (K §5.1 SI-21).

**P2**
- **Antenatal:** EDD (LMP vs ultrasound), G/P/A, risk category, booking bloods, screening, ultrasound, growth charts, birth plan (R03 §13.1).
- **WHO Labour Care Guide:** seven sections; active first stage from 5 cm. Per-cm limits (≈6 h at 5 cm → ≈2 h at 9 cm) and second-stage limits configured from the WHO manual. The "alert" column needs a recorded response. Legacy partograph by configuration (R03 §13.2 #2).
- **CTG/EFM:** integration with structured interpretation (R03 §13.2 #3). Not named in K.
- **NICU depth:** TPN; human-milk barcode matching to infant; Fenton/INTERGROWTH-21st charts [K]; ventilator integration (R03 §13.3; K §4.3).

**Safety:** SI-01, SI-05, SI-13, SI-21, SI-08 (K §5.1). Guard against band/screen name truncation and temporary-to-legal name-change errors (R03 §3.1 #6).

**KPIs:** PPH/severe maternal morbidity per 1,000 births (R03 §20); caesarean rate; 3rd/4th-degree tears; term NICU admissions; human-milk scan rate; newborn wrong-patient events (R03 §13.3); birth/death registers 100% on time (K §17).

**Refs:** R03 §2, §3.1, §13, §20; K §4.2–§4.3, §5.1, §5.6, §8, §9.1, §17.

---

## 12. Clinical documentation

**Phase**
- **MVP:** notes with copy-forward provenance; English text; template-based patient instructions; HIM with legal health record (K §4.3).
- **R1:** OPD notes (K §4.2).
- **R2b:** inpatient notes; legal health record with manual ROI register (K §4.2).
- **R2.1:** ROI automation; ICD-10 coding (manual sheet until then) (K §4.2).
- **P2:** dictation structuring; discharge drafts (K §4.3).
- **P3:** Sorani/Badini ambient, only once partners pass S8-K (K §4.3, K-23).

**Must-have**
- **Structured vs narrative:** discrete data where it drives CDS, quality, billing or research (vitals, allergies, problems, meds, scores, LDAs, key findings, indications); narrative for reasoning (R03 §15.1).
- **Templates:** specialty templates; smart phrases; smart links (live data with timestamp and source); smart lists with required choices; problem-based charting; front-end voice (R03 §15.2).
- **Notes as synthesis:** built from structured data with span-level provenance (K §6.4).
- **Copy-forward:** inherited text marked with source; smart links preferred over static copies; attestation for copied sections in high-risk notes [K]; per-author length/redundancy analytics; no blanket bans (R03 §15.3, §21.3 #3).
- **Signing:** authenticated e-signature with date/time. Co-sign for trainees, verbal orders and scribes, with timeliness tracked. One sign pattern (R03 §15.4; K §6.2).
- **Amendments:** signed notes immutable; addenda appended. Corrections keep the original viewable, record reason and author, and notify recipients if already sent. Entered-in-error moves content with audit. Signed rendering hashed (R03 §15.4; BP §5.1 SI-06).
- **Legal medical record:** defined per organisation (in/out, e.g. audit logs, CDS logs, drafts, chat unless promoted); designated record set; legal holds; retention (R03 §15.5). Kurdistan retention period unknown, so records are never auto-deleted (K §2).
- **Scans and photos:** scans indexed to patient, encounter and type, with mis-indexing QA. In-app clinical photos with consent, body site and sensitivity labels (R03 §15.6).
- **E-consent:** signature, witness, interpreter, versioned forms, point-of-care display (R03 §15.6). Guardian/co-signer consent and chaperone documentation at R2b (K §6.7).
- **ROI:** request log; authorisation; minimum-necessary redaction; segmentation by SI-21 labels (HIV, mental health, reproductive/sexual health, GBV, forensic/MLC, VIP); disclosure accounting; fulfilment tracking (R03 §15.7; K §5.1).
- **Chart completion:** deficiencies (unsigned notes, missing H&P/discharge summary, unsigned verbal orders) with escalation (R03 §15.7).
- **Documentation profile:** "Kurdistan" profile without US billing norms (K §6.4).

**Safety:** SI-06, SI-07, SI-10, SI-21, SI-03, SI-16 (K §5.1); JCI MOI (K §5.8).

**KPIs:** after-hours EHR time; note duplication (R03 §20); notes ≤24 h; discharge summaries ≤48 h; overdue verbal orders; copy-forward proportion; note length; scanning QA errors (R03 §15.8).

**Refs:** R03 §15, §19–§21; K-23; K §2, §4.2–§4.3, §5.1, §5.8, §6.2, §6.4, §6.7; BP §5.1.

---

## 13. Care coordination and transitions

**Phase**
- **R1:** referral intake and tracking with owned queues, plus seam bridge to hospital A while it is on paper or legacy (K §4.2).
- **R2b:** discharge and med rec (K §4.2).
- **P2:** referrer portal (no commission features); patient app; teleconsultation (K §4.3).
- **Not named in K:** care management/UR; SDOH screening (R03 §2 rows 41–42 = P2).

**Must-have**
- **Internal referrals/consults:** reason, urgency, acceptance and completion tracking (R03 §16 #1).
- **External referrals:** sent → accepted → scheduled → seen → report received (R03 §16 #2). Seam messages are owned tasks (K §5.1 SI-03).
- **Referral loop:** created → owned queue → appointment/admission → acknowledgement → closure (K §5.2); closure letter to referrer (BP §5.2).
- **Transition summary:** meds, allergies, problems, pending results with explicit owner, follow-up, care team (R03 §16 #3). IPS `$summary` and PDF/A + FHIR from one source (K §4.3).
- **After discharge:** med list in the patient's language from a template (R03 §6.4; K §4.3). Post-discharge call/text (R03 §6.5) via WhatsApp, Viber or SMS, with no clinical content (K §5.1 SI-20).
- **Dropped (US):** HRSN mandate, CoP choice lists, InterQual/MCG, Direct/C-CDA (R03 §16).

**Safety:** SI-03, SI-17, SI-09, SI-12, SI-20, SI-21 (K §5.1).

**KPIs:** referral closure rate; time to post-acute placement; 7-day follow-up (R03 §16); referral-to-appointment time; leakage (R03 §3.3). Kurdistan: referrals closed within SLA; open referrals >14 days (K §5.2).

**Refs:** R03 §2, §3.3, §6.4–§6.5, §16; K §4.2–§4.3, §5.1–§5.2; BP §5.2.

---

## 14. Results management

**Phase**
- **R1:** critical-result service with LIS/RIS, extended to external referring doctors (K §4.2–§4.3).
- **R1.1:** LIS autoverification v1; manual validation until then; Tier 2 if interpretive (K §4.2, §5.6).
- **R2b:** inpatient results routing and critical results; inbox with discharge queues (K §4.2–§4.3).

**Must-have**
- **Structured results:** LOINC, UCUM, reference ranges. Free-text reports coded normal/abnormal (R03 §17).
- **Status and ownership:** status tracked from order to acknowledgement; ordering and responsible clinician on every result (R03 §7.4, §17).
- **Amended results:** notification, visible flag, direct contact if significant (R03 §17).
- **Fail-safe routing:** critical results, results after discharge, results ordered by rotating trainees (R03 §17).
- **Inbox:** abnormal flags; clear display; surrogates; trends/graphs; sort/filter; self-reminders (R03 §17). Team pools (K §6.4); mobile acknowledgement and critical read-back (K §6.6).
- **Monitoring:** unacknowledged results; abnormal follow-up; interface losses (owned dead-letter queue alarmed at 5 min; zero silent drops, K §9); CDS–lab sync; patient notification timeliness (R03 §17).
- **Critical results:** defined values, reporters, recipients and timeliness targets. Call log (read-back, receiver, time); escalation if not acknowledged within N minutes; dashboard (R03 §17). Named recipient chosen by picker (BP §5.1 SI-04). Read-back logger for internal and external doctors (K §6.1). Critical-result escalation is a sweep candidate: until the written triage due by M9, the fallback is prompts with clinician-chosen actions (K §5.6).
- **Discharge queues:** explicit "pending at discharge" and "discharged patients" queues (R03 §21.3 #6; SI-17).
- **Patient release:** by OTP or expiring link. Labelled results and pregnancy tests never by message (K §4.2, §5.1 SI-21).
- **Outpatient-tier lab downtime:** critical results phoned, read-back logged on the edge agent, back-entered within 4 h (K §7.9).

**Safety:** SI-03, SI-04, SI-17, SI-21, SI-10 (K §5.1); JCI IPSG.2 (K §5.8).

**KPIs:** critical notification within policy (≥95% est.); unacknowledged abnormal results >7 days → 0 (R03 §20); pending-at-discharge acknowledged; amended-result acknowledgement (R03 §17). Kurdistan: critical results within policy, incl. external referrers, ≥95% (K §17).

**Refs:** R03 §7.4, §17, §20, §21; K §4.2–§4.3, §5.1, §5.6, §5.8, §6.1, §6.4, §6.6, §7.9, §9, §17; BP §5.1.

---

## Specialty modules (R03 §14) with Kurdistan phase

- **14.1 Oncology:** P2, both the oncology module and chemotherapy (K §4.3). Already in MVP: no verbal orders for antineoplastics except hold/stop (K §4.3). Spec (ASCO-ONS 2024): 16 order elements; four verifications incl. a two-clinician bedside check; metric weight confirmed by two people; oral refills default to 0; cumulative-dose tracking (R03 §14.1).
- **14.2 Nephrology/dialysis:** P3 (K §4.3). Dialysis solutions are high-alert (R03 §14.2).
- **14.3 Cardiology:** ECG integration (I) is P2 (K §4.3). Cath, echo and EP reporting are not named in K; R03 rates them P3 as a specialty kit (R03 §2, §21.2).
- **14.4 Mental health:** MVP = suicide screening and restraint timers (K §4.3); legal status and observation levels not named in K (R03 §2 row 31 = P2). Restraint design: order type with age-driven expiry timers, no standing or PRN orders, 1-h face-to-face task, monitoring flowsheet, discontinuation prompts (R03 §14.4). R03's 4/2/1-h limits are US 42 CFR 482.13; K states no Kurdistan values. Mental-health label applies (SI-21).
- **14.5 Rehab:** P2 (K §4.3). **Dental and ophthalmology:** not named in K; R03 = P3 (R03 §2, §21.2).
- **14.6 Paediatrics (cross-cutting):** MVP: PEWS (Register-gated), paediatric weight-based rounding, NICU/PICU live with the site under the fallback control set (K §4.3, §5.1). Weight-based dosing by default, mg/kg display, adult-maximum capping, corrected age (R03 §14.6).
- **14.7 Transplant:** not named in K; R03 = P3 (R03 §2, §21.2).
- **14.8 Infection prevention and control:** MVP = isolation on the banner (SI-16) and notifiable diseases from LIS results/diagnoses in R1 (K §9.1). **P2:** HAI surveillance; microbiology with WHONET/GLASS export (K §4.3). Design: isolation flags constraining bed assignment; persistent MDRO flags; outbreak line lists from ADT location history (R03 §14.8).
- **14.9 Palliative:** code status in MVP (K §4.3). R03 §2 row 40 adds ACP documents (MVP) and a palliative module (P2); neither is named in K.
- **14.10 Bedside transfusion:**
  - **Phase:** T1 workflow and haemovigilance in MVP; T2 bedside verification in R2b; blood-unit receipt with relabelling. **P2:** blood-centre inventory and ISBT 128. The compatibility engine is never built (K §4.2–§4.3, K-08).
  - **Workflow:** bedside-printed sample label; consent, indication and special requirements; scan patient → scan unit → system verifies match, ABO/Rh, expiry and special requirements → second verifier → baseline and 15-min vitals → reaction workflow (R03 §14.10).
  - **SI-11 relabel control (K §5.1):** two-person blind double entry from the original label and issue note. The original label is never covered. The new label shows unit number and ABO/Rh. The bedside witness confirms the unit number on the original label. Any mismatch quarantines the unit.
  - **Fallback:** scripted two-person check, with no automated pass/fail (K §5.6).
  - **KPIs:** bedside verification ≥98%; WBIT trending to 0; relabel errors 0 (K §17); WBIT per 1,000 samples (R03 §20).
