import sys

p = sys.argv[1]
s = open(p, encoding='utf-8').read()
R = []


def r(old, new):
    R.append((old, new))


r('''**Sources read:**
- R03 in full (§1–§21 and the verification log).
- K §2, §4.1–§4.3, §5.1–§5.8, §6, §7.9, §8, §9.1, §12.1, §17, §18, and decisions K-01…K-30.
- BP §4.2–§4.3 and §5.1–§5.2 (full SI text).
- RL #4–#6 and #11, which R03 already reflects.''',
  '''**Sources read:** R03 in full (§1–§21, verification log); K §2, §4.1–§4.3, §5.1–§5.8, §6, §7.9, §8, §9.1, §12.1, §17, §18, K-01…K-30; BP §4.2–§4.3, §5.1–§5.2 (full SI text); RL #4–#6, #11 (already reflected in R03).''')

r('''**SI shorthand** (K §5.1; full text in BP §5.1)
- **SI-01:** ≥2 identifiers; never room or bed.
- **SI-02:** no administration without an active verified order or a documented override; override reasons are never defaulted.
- **SI-03:** every order reaches a terminal state; all work is owned with an SLA; `TaskOrphaned` fires within 5 min.
- **SI-04:** critical results go to a named recipient, with read-back and timed escalation.
- **SI-05:** one dated, sourced dosing weight; UCUM units; dose maths only in the Dose Engine; 10×/100× hard stop. The fallback control set applies until the Dose Engine (P2).
- **SI-06:** signed notes are immutable.
- **SI-07:** AI output stays `draft-ai` until signed (P2).
- **SI-08:** merges are reversible; overlays are incidents; auto-merge precision ≥99.9%.
- **SI-09:** med rec is blocked while any item is undecided.
- **SI-10:** clinical time ≠ system time.
- **SI-11:** wristband ↔ unit ↔ order ↔ sample match, plus a two-person e-witness.
- **SI-12:** money never blocks discharge or emergency care.
- **SI-13:** high-alert drugs need a double check.
- **SI-14:** hard stops come only from a governed list; the baseline is interruptive from day 0.
- **SI-15:** offline limits.
- **SI-16:** banner (photo, 2 IDs, allergies, code status, isolation, dated weight) everywhere; identity re-verified at signing if the context changed in the last 60 s.
- **SI-17:** results pending at or after discharge go to owned queues.
- **SI-18:** Tier 2 functions only via the Boundary Register.
- **SI-19:** kill switch per rule or flag.
- **SI-20:** PHI residency.
- **SI-21:** sensitivity labels on every channel.''',
  '''**SI shorthand** (K §5.1; full text BP §5.1): 01 ≥2 identifiers, never room/bed · 02 no administration without active verified order or documented override; reasons never defaulted · 03 every order reaches a terminal state; all work owned with SLA; `TaskOrphaned` ≤5 min · 04 critical results to a named recipient, read-back, timed escalation · 05 dated sourced dosing weight, UCUM, dose maths only in Dose Engine, 10×/100× hard stop; fallback control set until Dose Engine (P2) · 06 signed notes immutable · 07 AI `draft-ai` until signed (P2) · 08 reversible merges; overlays are incidents; auto-merge precision ≥99.9% · 09 med rec blocked while items undecided · 10 clinical ≠ system time · 11 wristband↔unit↔order↔sample + two-person e-witness · 12 money never blocks discharge or emergency care · 13 high-alert double check · 14 hard stops only from governed list; baseline interruptive day 0 · 15 offline limits · 16 banner (photo, 2 IDs, allergies, code status, isolation, dated weight) everywhere; identity re-verified at signing if context changed <60 s · 17 results pending at/after discharge to owned queues · 18 Tier 2 only via Boundary Register · 19 kill switch per rule/flag · 20 PHI residency · 21 sensitivity labels on every channel.''')

r('''- **Triage scale per tenant (R03 §5.2):**
  - **ESI v5:** decision points A–D; resources ≥2 → 3, 1 → 4, 0 → 5; HR >100, RR >20 or SpO₂ <92% → consider 2.
  - **ATS:** immediate/10/30/60/120 min; 100/80/75/70/70%.
  - **MTS:** German 0/10/30/90/120; UK 0/10/60/120/240 [K].
  - **CTAS:** immediate/15/30/60/120; 98/95/90/85/80% [K].''',
  '''- **Triage scale per tenant:** ESI v5 (decision points A–D; resources ≥2 → 3, 1 → 4, 0 → 5; HR >100, RR >20 or SpO₂ <92% → consider 2); ATS (immediate/10/30/60/120 min; 100/80/75/70/70%); MTS (German 0/10/30/90/120; UK 0/10/60/120/240 [K]); CTAS (immediate/15/30/60/120; 98/95/90/85/80% [K]) (R03 §5.2).''')

r('''- **Tracking board:**
  - **Columns:** room; patient + similar-name flag; age/sex; acuity; complaint; timers (arrival, last vitals, order); MD/RN.
  - **Icons:** orders pending, new/critical result, consult called, bed requested, isolation, fall risk, sepsis.
  - **Streams:** resus, acute, fast track, paediatric, behavioural, results-pending, observation (R03 §5.3).''',
  '''- **Tracking board:** columns room, patient + similar-name flag, age/sex, acuity, complaint, timers (arrival, last vitals, order), MD/RN; icons for orders pending, new/critical result, consult called, bed requested, isolation, fall risk, sepsis; streams resus, acute, fast track, paediatric, behavioural, results-pending, observation (R03 §5.3).''')

r('''- **Sepsis:** visible time zero (R03 §5.4).
  - **Within 3 h:** lactate, cultures before antibiotics, broad-spectrum antibiotics, 30 mL/kg crystalloid if hypotension or lactate ≥4.
  - **Within 6 h:** repeat a raised lactate; vasopressors and reassessment in shock (CMS SEP-1 definition).
  - **Until P2:** clocks + non-scoring checklist (K §5.6).''',
  '''- **Sepsis:** visible time zero; ≤3 h lactate, cultures before antibiotics, broad-spectrum antibiotics, 30 mL/kg crystalloid if hypotension or lactate ≥4; ≤6 h repeat raised lactate, vasopressors and reassessment in shock (CMS SEP-1 definition) (R03 §5.4). Until P2: clocks + non-scoring checklist (K §5.6).''')

r('''**KPIs**
- % arrival-to-room >60 min, % boarding >240 min, % LOS >8 h, LWBS % (US ECAT gap criteria, kept as definitions) (R03 §20).
- Triage time-to-clinician compliance; stroke DTN; sepsis bundle compliance (R03 §20).
- Door-to-provider, triage accuracy, 72-h return with admission, ECG ≤10 min (R03 §5.5).
- MLC entries 100% on time (K §17).''',
  '''**KPIs:** % arrival-to-room >60 min, % boarding >240 min, % LOS >8 h, LWBS % (US ECAT gap criteria, kept as definitions); triage time-to-clinician compliance; stroke DTN; sepsis bundle compliance (R03 §20); door-to-provider, triage accuracy, 72-h return with admission, ECG ≤10 min (R03 §5.5); MLC entries 100% on time (K §17).''')

r('''- **I-PASS (R03 §6.3; K §6.5):**
  - **Structure:** Illness severity (stable/watcher/unstable), Patient summary, Action list (owners, due times), Situation awareness/if-then, receiver Synthesis.
  - **Auto-fill:** allergies, code status, drips, lines, recent critical results, with attribution.
  - **Output and audit:** printable/mobile sign-out; handoff audit (who → whom, when); bedside nursing SBAR/I-PASS.''',
  '''- **I-PASS:** Illness severity (stable/watcher/unstable), Patient summary, Action list (owners, due times), Situation awareness/if-then, receiver Synthesis; auto-filled allergies, code status, drips, lines, recent critical results with attribution; printable/mobile sign-out; handoff audit (who → whom, when); bedside nursing SBAR/I-PASS (R03 §6.3; K §6.5).''')

r('''- **Discharge (R03 §6.5; K §4.3):**
  - **From admission:** expected date and risk screen (LACE/HOSPITAL [K]).
  - **Readiness checklist:** criteria, meds ready, teach-back, equipment, transport, follow-up booked.
  - **Order and summary:** discharge order with disposition; summary (diagnoses, procedures, course, results pending with owner, med changes, follow-up).
  - **After:** AVS (med list, warning signs, contacts); transmission; post-discharge call/text; 30-day readmission flag.
  - **Patient parts:** from templates.''',
  '''- **Discharge:** expected date + risk screen (LACE/HOSPITAL [K]) from admission; readiness checklist (criteria, meds ready, teach-back, equipment, transport, follow-up booked); discharge order with disposition; summary (diagnoses, procedures, course, results pending with owner, med changes, follow-up); AVS (med list, warning signs, contacts); transmission; post-discharge call/text; 30-day readmission flag (R03 §6.5). Patient parts from templates (K §4.3).''')

r('''**KPIs**
- Med rec ≤24 h; discharge summary ≤48 h (≥90% est.); 30-day readmission; I-PASS each shift (≥95% est.) (R03 §20).
- Decision-to-admit → bed, bed → arrival, discharge order → departure, discharges before noon, turnaround, occupancy, ALOS (R03 §3.2).
- I-PASS coverage (K §5.2).''',
  '''**KPIs:** med rec ≤24 h; discharge summary ≤48 h (≥90% est.); 30-day readmission; I-PASS each shift (≥95% est.) (R03 §20); decision-to-admit → bed, bed → arrival, discharge order → departure, discharges before noon, turnaround, occupancy, ALOS (R03 §3.2); I-PASS coverage (K §5.2).''')

r('''- **Catalogue (R03 §8.2):**
  - **Interactions:** drug–allergy (tiered cross-sensitivity); DDI (severity tiers, suppression list); drug–disease (from problem list).
  - **Dose:** dose range (single/daily/cumulative; weight, BSA, renal, hepatic, age, paediatric; working shown); duplicate therapy.
  - **Patient context:** drug–lab; drug–route (fatal routes hard stop); pregnancy/lactation.
  - **Guidance:** monitoring reminders; advisories inside order sets; EWS; stewardship; imaging appropriateness.''',
  '''- **Catalogue:** drug–allergy (tiered cross-sensitivity); DDI (severity tiers, suppression list); drug–disease (problem list); dose range (single/daily/cumulative; weight, BSA, renal, hepatic, age, paediatric; working shown); duplicate therapy; drug–lab; drug–route (fatal routes hard stop); pregnancy/lactation; monitoring reminders; advisories inside order sets; EWS; stewardship; imaging appropriateness (R03 §8.2).''')

r('''- **Governance in product:**
  - **Registry:** purpose, evidence, owner, users, trigger, format, expected firing rate, retire-by date.
  - **Telemetry:** firing, accept/override, reasons, time-to-action, outcome.
  - **Review:** in-line feedback; quarterly alert-burden review (R03 §8.7).
  - **Interruptive rules:** each has owner, evidence, measured PPV, review-by date (BP §5.1 SI-14).''',
  '''- **Governance in product:** registry (purpose, evidence, owner, users, trigger, format, expected firing rate, retire-by date); telemetry (firing, accept/override, reasons, time-to-action, outcome); in-line feedback; quarterly alert-burden review (R03 §8.7). Each interruptive rule has owner, evidence, measured PPV, review-by date (BP §5.1 SI-14).''')

r('''- **NEWS2 (R03 §8.3):**
  - **Inputs:** RR, SpO₂ Scale 1/2, air vs O₂ (+2), SBP, pulse, ACVPU (new confusion = 3), temperature.
  - **Responses:** 0 → ≥12-hourly; 1–4 → 4–6-hourly; single 3 → ≥hourly + urgent ward review; 5–6 → urgent response; ≥7 → emergency response.
  - **Variants:** PEWS age-banded; MEOWS in pregnancy (no NEWS2 [K]).
  - **Display:** components shown; escalation is a tracked task (who, when, response time).''',
  '''- **NEWS2:** RR, SpO₂ Scale 1/2, air vs O₂ (+2), SBP, pulse, ACVPU (new confusion = 3), temperature. 0 → ≥12-hourly; 1–4 → 4–6-hourly; single 3 → ≥hourly + urgent ward review; 5–6 → urgent response; ≥7 → emergency response. PEWS age-banded; MEOWS in pregnancy (no NEWS2 [K]). Components shown; escalation is a tracked task (who, when, response time) (R03 §8.3).''')

r('''- **Stewardship control set (K §5.2):**
  - Restricted antimicrobials need indication + approver: at order entry on Clinical Safety sites, at transcription on Core sites.
  - Mandatory 48–72 h time-out task to the prescriber.
  - Stop/review date on every antimicrobial order.
  - Monthly DDD/DOT from dispensing data.
  - Stewardship lead named at RG1.
  - **P2** module adds culture–therapy mismatch and IV-to-PO lists (R03 §8.5).''',
  '''- **Stewardship control set:** restricted antimicrobials need indication + approver (order entry on Clinical Safety sites; transcription on Core sites); mandatory 48–72 h time-out task to prescriber; stop/review date on every antimicrobial order; monthly DDD/DOT from dispensing data; stewardship lead named at RG1 (K §5.2). **P2** module adds culture–therapy mismatch and IV-to-PO lists (R03 §8.5).''')

r('''**KPIs**
- Override rate (review >90%); interruptive alerts per 100 orders; NEWS2 escalation compliance (≥90% est.); arrests outside ICU; DOT per 1,000 days present (R03 §20).
- VTE assessment % (R03 §8.4).
- Kurdistan: ≤8/100 at go-live, ≤5 at 12 months; NEWS2 ≥5 reviewed within policy ≥90% (K §17).''',
  '''**KPIs:** override rate (review >90%); interruptive alerts per 100 orders; NEWS2 escalation compliance (≥90% est.); arrests outside ICU; DOT per 1,000 days present (R03 §20); VTE assessment % (R03 §8.4). Kurdistan: ≤8/100 at go-live, ≤5 at 12 months; NEWS2 ≥5 reviewed within policy ≥90% (K §17).''')

r('''**R2a Core transcription control set (K §4.2)**
- Only pharmacists transcribe, attaching an image of the signed paper order.
- KB allergy, interaction and dose screening at transcription, with the dosing double check.
- Ordering practitioner mandatory.
- Second check for high-alert and paediatric orders.
- No MAR, schedule or "active medicines" view from transcribed orders; screen labelled "dispensing record, not an order or MAR".
- Transcribed orders are reconciliation input only at upgrade; 50 audited monthly.''',
  '''**R2a Core transcription control set (K §4.2):** only pharmacists transcribe, attaching an image of the signed paper order; KB allergy, interaction and dose screening at transcription with the dosing double check; ordering practitioner mandatory; second check for high-alert and paediatric orders; no MAR, schedule or "active medicines" view from transcribed orders (screen labelled "dispensing record, not an order or MAR"); transcribed orders are reconciliation input only at upgrade; 50 audited monthly.''')

r('''- **Extended fallback control set (K §5.6):**
  - System-enforced independent pharmacist double check on every weight- or BSA-based dose (any age), every high-alert infusion and every neonatal order.
  - KB result ≥10× max = Tier A hard stop.
  - Seeded 10×/unit errors in each test cycle.
  - Alarm if no pharmacist is logged into the queue for >30 min.
  - Review within 4 h of any dose given before verification.
  - 24×7 pharmacist cover at RG1.''',
  '''- **Extended fallback control set:** system-enforced independent pharmacist double check on every weight- or BSA-based dose (any age), every high-alert infusion and every neonatal order; KB result ≥10× max = Tier A hard stop; seeded 10×/unit errors in each test cycle; alarm if no pharmacist is logged into the queue >30 min; review within 4 h of any dose given before verification; 24×7 pharmacist cover at RG1 (K §5.6).''')

r('''- **BCMA:** MAR (due/overdue/PRN/held, with windows) → scan wristband → scan drug → checks (R03 §9.2 #4):
  - **Identity and dose:** wrong patient/drug/dose (partial or multiple units).
  - **Product and timing:** expired product; early/late dose.
  - **Safety:** allergy; duplicate administration; held order; high-alert double check.
  - **Pre-administration assessments:** HR before digoxin, pain before opioid, glucose before insulin.''',
  '''- **BCMA:** MAR (due/overdue/PRN/held, with windows) → scan wristband → scan drug → checks: wrong patient/drug/dose (partial or multiple units), expired, early/late, allergy, duplicate administration, held order, high-alert double check, pre-administration assessments (HR before digoxin, pain before opioid, glucose before insulin) (R03 §9.2 #4).''')

r('''- **Med rec (R03 §6.4; K §4.3):**
  - **BPMH:** pharmacist/tech/nurse; from patient/caregiver, prior lists, pill bottles; source, confidence and last dose per item.
  - **Admission:** explicit decision per item (continue / modify / hold with reason / stop); completion blocked while undecided.
  - **Transfer:** review of all active orders.
  - **Discharge:** list flagged new/changed/stopped/unchanged, in the patient's language from a template.''',
  '''- **Med rec:** BPMH by pharmacist/tech/nurse from patient/caregiver, prior lists, pill bottles (source, confidence, last dose per item); explicit admission decision per item (continue/modify/hold with reason/stop), completion blocked while undecided; transfer review of all active orders; discharge list flagged new/changed/stopped/unchanged in the patient's language from a template (R03 §6.4; K §4.3).''')

r('''**KPIs**
- Scan compliance ≥95%; pump auto-programming rate (P2); ADEs per 1,000 patient-days; DOT (R03 §20).
- Override rate by reason; STAT/first-dose verification turnaround; omitted critical medicines (R03 §9.6).
- Kurdistan (K §17):
  - Scans ≥95% at 90 days, ≥98% at 12 months; 100% unit coverage.
  - Extended double checks 100%.
  - No-pharmacist gaps >30 min = 0.
  - Pre-verification doses reviewed ≤4 h = 100%.
  - Time-critical doses delayed by payment = 0.''',
  '''**KPIs:** scan compliance ≥95%; pump auto-programming rate (P2); ADEs per 1,000 patient-days; DOT (R03 §20); override rate by reason; STAT/first-dose verification turnaround; omitted critical medicines (R03 §9.6). Kurdistan: scans ≥95% at 90 days, ≥98% at 12 months, 100% unit coverage; extended double checks 100%; no-pharmacist gaps >30 min = 0; pre-verification doses reviewed ≤4 h = 100%; time-critical doses delayed by payment = 0 (K §17).''')

r('''- **Flowsheets (R03 §10.2 #3):**
  - **Vitals:** device-captured, nurse-validated.
  - **I&O:** with running balance.
  - **LDAs:** insertion date, site, day count, removal.
  - **Wounds:** body map, staging, measurements, consented photos, dressing plan.
  - **Other:** neuro checks; restraint monitoring; glucose/insulin; sedation scales.''',
  '''- **Flowsheets:** vitals (device-captured, nurse-validated); I&O with running balance; LDAs (insertion date, site, day count, removal); wounds (body map, staging, measurements, consented photos, dressing plan); neuro checks; restraint monitoring; glucose/insulin; sedation scales (R03 §10.2 #3).''')

r('''**KPIs**
- Falls with injury per 1,000 patient-days; HAPI stage 2+; NEWS2 escalation compliance; CLABSI/CAUTI (R03 §20).
- Assessments on time; documentation time per shift; restraint prevalence; scan compliance (R03 §10.3).
- Kurdistan: nurse documentation time −20% and nurse SUS ≥72 at 12 months (K §6.8, §17).''',
  '''**KPIs:** falls with injury per 1,000 patient-days; HAPI stage 2+; NEWS2 escalation compliance; CLABSI/CAUTI (R03 §20); assessments on time; documentation time per shift; restraint prevalence; scan compliance (R03 §10.3). Kurdistan: nurse documentation time −20% and nurse SUS ≥72 at 12 months (K §6.8, §17).''')

r('''**KPIs**
- Duplicate rate (≤1% internal target vs industry 8–12%); retract-and-reorder per 100k orders (R03 §20).
- Queue age, overlays, % with photo (R03 §3.1).
- OPD wait, no-shows (R03 §3.3).
- Kurdistan: duplicates <1%; overlays 0; cross-script precision ≥99.9% (K §17).''',
  '''**KPIs:** duplicate rate (≤1% internal target vs industry 8–12%); retract-and-reorder per 100k orders (R03 §20); queue age, overlays, % with photo (R03 §3.1); OPD wait, no-shows (R03 §3.3). Kurdistan: duplicates <1%; overlays 0; cross-script precision ≥99.9% (K §17).''')

r('''**KPIs**
- Medication CPOE ≥85%; Leapfrog test ≥60%, aiming for 100% on fatal orders (R03 §20).
- Overdue verbal orders (R03 §15.8).
- Kurdistan: inpatient CPOE share ≥70% at 90 days, ≥85% at 12 months (K §17). Below 70% at 90 days triggers risk 15 (K §18).''',
  '''**KPIs:** medication CPOE ≥85%; Leapfrog test ≥60%, aiming for 100% on fatal orders (R03 §20); overdue verbal orders (R03 §15.8). Kurdistan: inpatient CPOE share ≥70% at 90 days, ≥85% at 12 months (K §17); below 70% at 90 days triggers risk 15 (K §18).''')

r('''**KPIs**
- First-case on-time starts (≥80–90% est.); block utilisation (75–85% est.); WHO checklist 100% across all three phases (R03 §20).
- Turnover; same-day cancellations; duration accuracy; SSI; never events; implant documentation completeness (R03 §12.2).''',
  '''**KPIs:** first-case on-time starts (≥80–90% est.); block utilisation (75–85% est.); WHO checklist 100% across all three phases (R03 §20); turnover; same-day cancellations; duration accuracy; SSI; never events; implant documentation completeness (R03 §12.2).''')

r('''**KPIs**
- PPH/severe maternal morbidity per 1,000 births (R03 §20).
- Caesarean rate; 3rd/4th-degree tears; term NICU admissions; human-milk scan rate; newborn wrong-patient events (R03 §13.3).
- Birth/death registers 100% on time (K §17).''',
  '''**KPIs:** PPH/severe maternal morbidity per 1,000 births (R03 §20); caesarean rate; 3rd/4th-degree tears; term NICU admissions; human-milk scan rate; newborn wrong-patient events (R03 §13.3); birth/death registers 100% on time (K §17).''')

r('''**KPIs**
- After-hours EHR time; note duplication (R03 §20).
- Notes ≤24 h; discharge summaries ≤48 h; overdue verbal orders; copy-forward proportion; note length; scanning QA errors (R03 §15.8).''',
  '''**KPIs:** after-hours EHR time; note duplication (R03 §20); notes ≤24 h; discharge summaries ≤48 h; overdue verbal orders; copy-forward proportion; note length; scanning QA errors (R03 §15.8).''')

r('''**KPIs**
- Referral closure rate; time to post-acute placement; 7-day follow-up (R03 §16).
- Referral-to-appointment time; leakage (R03 §3.3).
- Kurdistan: referrals closed within SLA; open referrals >14 days (K §5.2).''',
  '''**KPIs:** referral closure rate; time to post-acute placement; 7-day follow-up (R03 §16); referral-to-appointment time; leakage (R03 §3.3). Kurdistan: referrals closed within SLA; open referrals >14 days (K §5.2).''')

r('''**KPIs**
- Critical notification within policy (≥95% est.); unacknowledged abnormal results >7 days → 0 (R03 §20).
- Pending-at-discharge acknowledged; amended-result acknowledgement (R03 §17).
- Kurdistan: critical results within policy, incl. external referrers, ≥95% (K §17).''',
  '''**KPIs:** critical notification within policy (≥95% est.); unacknowledged abnormal results >7 days → 0 (R03 §20); pending-at-discharge acknowledged; amended-result acknowledgement (R03 §17). Kurdistan: critical results within policy, incl. external referrers, ≥95% (K §17).''')

r('''- **14.1 Oncology:** P2, both the oncology module and chemotherapy (K §4.3).
  - **Already in MVP:** no verbal orders for antineoplastics except hold or stop (K §4.3).
  - **Spec (ASCO-ONS 2024):** 16 order elements; four verifications, incl. a two-clinician bedside check; metric weight confirmed by two people; oral refills default to 0; cumulative-dose tracking (R03 §14.1).''',
  '''- **14.1 Oncology:** P2, both the oncology module and chemotherapy (K §4.3). Already in MVP: no verbal orders for antineoplastics except hold/stop (K §4.3). Spec (ASCO-ONS 2024): 16 order elements; four verifications incl. a two-clinician bedside check; metric weight confirmed by two people; oral refills default to 0; cumulative-dose tracking (R03 §14.1).''')

r('''- **14.4 Mental health:**
  - **MVP:** suicide screening and restraint timers (K §4.3). Legal status and observation levels are not named in K (R03 §2 row 31 = P2).
  - **Restraint design:** order type with age-driven expiry timers; no standing or PRN orders; 1-h face-to-face task; monitoring flowsheet; discontinuation prompts (R03 §14.4).
  - **Time limits:** R03's 4/2/1-h limits are US 42 CFR 482.13; K states no Kurdistan values.
  - **Label:** mental-health label applies (SI-21).''',
  '''- **14.4 Mental health:** MVP = suicide screening and restraint timers (K §4.3); legal status and observation levels not named in K (R03 §2 row 31 = P2). Restraint design: order type with age-driven expiry timers, no standing or PRN orders, 1-h face-to-face task, monitoring flowsheet, discontinuation prompts (R03 §14.4). R03's 4/2/1-h limits are US 42 CFR 482.13; K states no Kurdistan values. Mental-health label applies (SI-21).''')

r('''- **14.6 Paediatrics (cross-cutting):** MVP (K §4.3, §5.1).
  - **Scope:** PEWS (gated by the Register); paediatric weight-based rounding; NICU/PICU live with the site under the fallback control set.
  - **Dosing:** weight-based by default; mg/kg display; capped at the adult maximum; corrected age (R03 §14.6).''',
  '''- **14.6 Paediatrics (cross-cutting):** MVP: PEWS (Register-gated), paediatric weight-based rounding, NICU/PICU live with the site under the fallback control set (K §4.3, §5.1). Weight-based dosing by default, mg/kg display, adult-maximum capping, corrected age (R03 §14.6).''')

r('''- **14.8 Infection prevention and control (IPC):**
  - **MVP:** isolation shown on the banner (SI-16); notifiable diseases from LIS results and diagnoses in R1 (K §9.1).
  - **P2:** HAI surveillance; microbiology with WHONET/GLASS export (K §4.3).
  - **Design:** isolation flags that constrain bed assignment; persistent MDRO flags; outbreak line lists from ADT location history (R03 §14.8).''',
  '''- **14.8 Infection prevention and control:** MVP = isolation on the banner (SI-16) and notifiable diseases from LIS results/diagnoses in R1 (K §9.1). **P2:** HAI surveillance; microbiology with WHONET/GLASS export (K §4.3). Design: isolation flags constraining bed assignment; persistent MDRO flags; outbreak line lists from ADT location history (R03 §14.8).''')

bad = []
for i, (old, new) in enumerate(R):
    c = s.count(old)
    if c != 1:
        bad.append((i, c, old[:70]))
if bad:
    for b in bad:
        print("NO-UNIQUE-MATCH", b)
    sys.exit(1)
for old, new in R:
    s = s.replace(old, new)
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print("applied", len(R), "replacements")
