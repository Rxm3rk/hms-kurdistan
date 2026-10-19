
---

## 10. Regulated modules and safety tooling

**Why device-grade rigour where no regulator asks** (K §5.6): the hazards are identical wherever the software runs; hospital due diligence and international accreditation look for it; and a later Gulf export needs it. Process: IEC 62304 Class B-equivalent for Tier 1 (ADT/EMPI, CPOE, eMAR/BCMA, results routing, downtime) and Class C for Tier 2; ISO 14971 risk management; IEC 62366-1 usability engineering; IEC 82304-1; IEC 81001-5-1 secure development. Tier 0 (billing, ERP, HR, BI) follows the standard SDLC (K §5.4; BP §5.4). Read: R15 §2–§8; K §5; BP §5.

### 10.1 The hazard log service (TRU-REG-02)

Build it in Phase 0 as data plus a CI gate, and grow it into a service with UI in Phase 1.
- **Hazard record:** ID; title; description; causes; effects; initial severity, likelihood and risk; controls (each typed as design, protective or information, with implementation references and the IDs of the tests that verify it); residual risk; status; owner; linked features, invariants, incidents and releases.
- **Story link:** every backlog item carries a safety-impact field. "Possible" or "yes" opens CSO triage with a 2-working-day SLA timer. **Safety valve:** if more than 10% of triages miss the target in a month, C1 and C2 promotion pauses until the backlog clears (K §5.3).
- **CI gate:** each control carries `state: planned | implemented | verified`. Seeded controls start as `planned`. Promotion of a release is blocked while any control for a feature in that release is not `verified` with passing test IDs in `verified_by`. Never change a state to make a gate pass.
- **Human fields:** CSO triage, risk acceptance (status `accepted`) and approvals are written only from a human sign-off record (§3.5).
- **Release outputs, generated:** the Clinical Safety Case Report and the Release Evidence Pack (safety case, SBOM/VEX, test results, regulatory-impact assessment, known anomalies, Boundary Register state).
- **Customer outputs:** DCB0160-style deployment-case and UAT kits per hospital; field safety notices in FSN format within 24 hours of confirmation; the known-anomalies list; the annual Safety Performance Report.
- **One Safety Event pipeline** carries safety tickets, telemetry anomalies, AI issue reports (P2, with model, prompt and sources) and security incidents.
- **[HUMAN]** CSO triage, risk acceptance, safety case sign-off, the weekly Safety Board and its release veto, sentinel-event attribution by the joint panel.

### 10.2 The Regulatory Boundary Register (SI-18)

- **Entry per function and version:** function; intended purpose (written for the minimum class); tier; jurisdiction (KRG, federal Iraq, later others); status (`not-assessed`, `required`, `not-required`, `cleared`, `withdrawn`); fallback control set; evidence.
- **Evidence for activation (K-05):** a written local opinion (KRG Ministry of Health and counsel) that no registration applies, or the registration itself, with its scope (function, intended purpose, version, jurisdiction) and expiry (24 months, or on any change); the safety case; the hospital's clinical-governance sign-off; **independent-assessor concurrence** for the first activation of each Tier 2 function and each major version at any customer, and for every activation at customers #1–3; product-liability insurance naming the function. Federal Iraq sites need a federal Ministry opinion.
- **Mechanics:** the flag service asks the Register before enabling any Tier 2 function; a configuration toggle cannot override it. Activation is a C2 change. Expiry or withdrawal reverts the site to the fallback control set and raises tasks.
- Seed the Register with every Tier 2 function and the "sweep candidates" (VTE prompts, Braden/Morse care-plan triggers, the critical-result escalation chain, NEWS2 frequency scheduling, the imaging viewer) (K §5.6).

### 10.3 Fallback control sets (built, tested and active in the MVP)

Each fallback is pre-built, hazard-logged and signed by the Chief CSO [HUMAN]. Where a fallback removes an automated protection, a named manual control set replaces it; it is never simply left off (BP §5.6).

**A. Extended Dose Engine fallback** (every Clinical Safety site until the Dose Engine is active there; K §5.6):
1. A system-enforced, documented independent pharmacist double check on every weight- or BSA-based dose at any age, every high-alert infusion and every neonatal order. Verification cannot complete until the pharmacist records an independently calculated dose and attests that it matches the order. A mismatch returns the order to the prescriber. **The system performs no dose arithmetic** (the definition and the narrow allowed comparisons are in §2.1).
2. A drug-KB result ≥10× the maximum dose is a **Tier A hard stop**, with the KB output shown verbatim.
3. Seeded adult and paediatric 10× and unit errors are part of every integrated test cycle (ship them as test assets).
4. An alarm when no pharmacist is logged in to the verification queue for more than 30 minutes; a pharmacist review task within 4 hours of any dose given before verification.
5. Core sites apply item 1 at transcription.
6. 24×7 pharmacist cover is an RG1 obligation at Clinical Safety sites [HUMAN].
Live KPIs: double-check completion 100%; intercepted dose errors; STAT neonatal verification time.

**B. Core transcription control set** (R2a; K §4.2):
- only pharmacists transcribe, with an image of the signed paper order attached;
- drug-KB allergy, interaction and dose screening runs at transcription, plus the dosing double check from A;
- the ordering practitioner is mandatory, so result and task routing works;
- high-alert and paediatric orders get a second check;
- **no MAR, schedule or "active medicines" view is built from transcribed orders;** the screen is labelled "dispensing record, not an order or MAR";
- transcribed orders are reconciliation input only at the Clinical Safety upgrade;
- an audit tool samples 50 transcribed orders a month.

**C. Stewardship control set** (until CLN-AMS-01 in P2; K §5.2): restricted antimicrobials need an indication and an approver at order entry (Clinical Safety) or transcription (Core); a mandatory 48–72 h time-out task goes to the prescriber; every antimicrobial order carries a stop or review date; a monthly DDD/DOT report from dispensing data; a named hospital stewardship lead at RG1 [HUMAN].

**D. Other fallbacks** (K §5.6):

| Function | Fallback |
|---|---|
| NEWS2/PEWS/MEOWS | Electronic observation charting; nurse-calculated score; nurse-assigned escalation tasks; observation frequency set by the nurse, never by a score |
| Bedside transfusion verification (T2) | Scripted two-person check: identifiers scanned and shown side by side; both electronic signatures required; no automated pass/fail; the witness confirms the unit number on the original label |
| LIS autoverification and interpretive rules | Manual technologist validation; delta and critical rules shown as flags only |
| Screening presenter | Drug-KB screening shown verbatim |
| Sweep candidates | Prompts with clinician-chosen actions; imaging viewer labelled non-diagnostic |
| Sepsis rules (P2) | Pathway clocks and a non-scoring checklist |
| Pump autoprogramming (P2) | Manual pump programming with a BCMA scan |
| AI documentation (P2) | Manual documentation |

### 10.4 Tier 2 module engineering

- **Isolation:** each Tier 2 module is a separately versioned, process-isolated sidecar on the same node as the core, with a pure-function, schema-versioned API, its own SBOM, SOUP list and release train, and a deterministic fail-safe ("unavailable, manual check required", never "pass"). A local call costs milliseconds, well inside the 500 ms CDS and BCMA budgets (BP §5.5).
- **Display:** regulated values are rendered only by Tier 2-owned UI components with render-integrity checks. CPOE and MAR screens host these components but never compute or reformat regulated values.
- **Calculators:** native, guideline-verbatim, deterministic code. No rules engine inside the device boundary. 100% boundary-value tests; mutation testing; every result stores components, total and calculation version.
- **Intended purposes** are written for the minimum class. NEWS2 "calculates and displays the score and components from nurse-validated discrete observations on non-ICU wards … and creates escalation tasks according to the hospital's configured policy". Nothing "detects" or "predicts". ICU use is excluded.

| Module | Phase | Scope |
|---|---|---|
| `reg-ews` (Regulated Module #1) | R2b, where the Register allows | NEWS2, PEWS and MEOWS on non-ICU wards from nurse-validated observations; escalation tasks per hospital policy; frequency scheduling only if the Register entry covers it. The PEWS and MEOWS variant used is chosen by the hospital and approved by the CSO [HUMAN] |
| `reg-transfusion` (T2) | R2b | Wristband ↔ unit ↔ order ↔ sample matching; two-person electronic witness; hard stop on mismatch; checks on relabelled units (SI-11) |
| `reg-screening` | R1 (outpatient e-prescribing, [P]); R2a at transcription; R2b full inpatient. Its Register entry, with the KB vendor's written regulatory position, is required before wedge RG1 | Presentation and local tiering of the licensed drug-KB's interaction, allergy and dose-range results; output verbatim |
| `reg-lis-rules` | R1.1, where the Register allows | Autoverification, delta checks, interpretive rules |
| `reg-dose` (the Dose Engine) | P2 (≈GA wave) | Weight- and BSA-based dosing, rounding, maximum-dose and 10×/100× checks, paediatric and neonatal logic, UCUM throughout. Activation is a C2 change with ≥4 weeks of shadow running visible only to pharmacists; the NICU double check stays for 3 months after activation |
| Sepsis screen (Regulated Module #2) | P2, after Module #1 is live | Rule-based screen; pathway clocks meanwhile |

### 10.5 IEC 62304 software safety class per module (R15 §2.3)

Class C means a failure could still contribute to death or serious injury after external controls act. Tier 0 (billing, ERP, HR, BI) follows the standard SDLC.

| Module | Tier | Class | External controls relied on |
|---|---|---|---|
| ADT, EMPI merge/unmerge | 1 | B | HIM steward queue; reversible merges |
| CPOE and order lifecycle | 1 | B | Pharmacist verification; result-closure tracking |
| eMAR and BCMA | 1 | B | Wristband and product barcodes; nurse judgement |
| Interaction, allergy and dose-range screening presenter | 2 | B | Pharmacist verification; the KB vendor's own controls |
| Weight/BSA dose calculation (Dose Engine, P2) | 2 | **C** | None reliable at 03:00; 10× errors are lethal |
| NEWS2/PEWS/MEOWS with escalation | 2 | B | Nurse observation and manual escalation |
| Sepsis rules (P2) | 2 | B (C if it ever placed autonomous orders, which it must not) | Clinician review |
| Bedside transfusion verification (T2) | 2 | **C** | The two-person check is the only other barrier |
| Pump autoprogramming (P2) | 1–2 | C-level rigour | Pump DERS; confirmation at the pump |
| AI documentation (P2) | 1 | B | Mandatory clinician sign-off |

K §5.4 asks for a Class C process for all of Tier 2; apply Class C rigour to every Tier 2 module regardless of its assessed class. A documented segregation and class-propagation analysis shows the Safety Kernel stays Class B (§5.2).

---

## 11. The Kurdistan pack

One owned pack with a product manager (K-26). Country behaviour is data, never a fork. Everything here is configuration with K's defaults, and every [L] value is listed in `ASSUMPTIONS.md` until confirmed.

### 11.1 Languages and scripts (KRI-LOC-01, KRI-LOC-02, PLT-UX-03)

- Three UI languages per user (English, Sorani, Arabic). Each patient's preferred output language is captured at registration. Clinical content (orders, results, notes) is English. Patient outputs are in the patient's language, from approved templates (Sorani, Badini in Arabic script, Arabic, English).
- **Sorani:** font coverage, printer shaping, collation and search normalisation for پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە, and the Arabic versus Kurdish forms of ي/ی, ك/ک and ه/ە. Spike S7-K tests this on the target printers and produces the Kurdistan Supported Hardware List.
- **Badini:** patient templates are reviewed by Duhok staff [HUMAN]. Latin-script Kurmanji output only if Q-K17 requires it.
- **Digits:** Western digits always for clinical numerals; Eastern Arabic-Indic digits configurable for non-clinical numbers in patient-facing Kurdish and Arabic text.
- **Localisation is a release gate:** clinician-reviewed translation [HUMAN]; **zero untranslated strings in clinical paths** across all three languages; a translation memory owned by the content team.

### 11.2 Identity (KRI-ID-01; replaces ACC-ID-02's content)

- **Identifier types [L]:** Iraqi Unified National Card number; older civil ID and nationality certificate; Kurdistan residency card; passport (ICAO 9303 MRZ); UNHCR registration and IDP documents; hospital MRN with check digit. Typed with system, value, type, period and assigner.
- **Capture from the document** (barcode, MRZ or OCR), never typed, with identity verification recorded separately ("verify later": no online verification service is assumed, Q-K12).
- **Mobile number** is contact data and a matching feature, never an identifier (phones are often shared within a family).
- **Names:** given, father's, grandfather's and family or tribal name; the mother's full name as an identifying attribute; Kurdish (Arabic script), Arabic and Latin forms, with transliteration variants stored and a display name per locale; search across scripts.
- **Birth date** with a precision flag (exact, year only, estimated). Placeholder dates such as 1 January or 1 July carry low weight in matching.
- **Matching:** Fellegi–Sunter with a document-number shortcut; Kurdish and Arabic character normalisation; transliteration dictionaries (Muhammad/Mohammed/Mihemed and similar); higher weight on father's and grandfather's names, the mother's name and DOB precision (tuned in S14-K).
- **Special identities:** alias pools for trauma, mass-casualty incidents and downtime; newborn naming "Baby of [mother]" (cut NICU wrong-patient orders by 36.3%, R03 §3.1).
- **Targets:** duplicates <1%, **zero overlays**, auto-merge precision ≥99.9% on a 2,000-pair cross-script gold set (K §8).

### 11.3 Practitioners (ERP staff master; K §8)

Typed identifiers [L]: syndicate number for doctors, pharmacists and nurses; KRG or federal Ministry practice licence; board certificates (Kurdistan Board, Iraqi Board of the Iraqi Council for Medical Specializations, Arab Board, foreign boards). Privileges per hospital gate order entry and OT booking. A **visiting-consultant** flag. Every charge carries the ordering and performing practitioner (needed for doctor-fee payouts).

### 11.4 Money (KRI-RCM-01; §9 Revenue)

ISO 4217 amounts (IQD, USD) as decimals; an effective-dated exchange-rate table with source and timestamp; per-payment tendered currency, amount, rate and change given (possibly in the other currency); cash rounding per tenant; per-currency drawers; the ledger in the tenant's functional currency with original amounts kept and FX differences posted to the GL export. **IQD price lists by default**; USD prices, deposits and contracts only where Q-K19 / L-33 confirms they are allowed.

### 11.5 Statutory registers and reporting (OPS-STAT-01, OPS-STAT-02, KRI-STAT-02)

Locked, append-only registers whose corrections are addenda: the **MLC register** with police-notification timestamps; **narcotics registers**; **birth and death notifications** on KRG forms (death certificate with ICD-10 cause of death in the WHO format); **notifiable diseases** from LIS results and diagnoses, in the Directorate of Health's surveillance format; **KRG Ministry returns** from an indicator catalogue; **DHIS2** data-value sets through the DHIS2 Web API if the KRG uses it (R1.1). Formats arrive as configuration when the Ministry supplies them (Q-K3); build the framework first.

### 11.6 Messaging and payments (KRI-MSG-01, KRI-PAY-01)

- WhatsApp Business, Viber and local SMS gateways, with trilingual templates. A **per-site GSM/SMPP gateway** that does not use the internet carries SMS during shutdowns; critical messages go by voice call. Central adapters queue store-and-forward for ≥7 days.
- Semi-integrated card terminals (no card number ever touches the HMS); wallet and QR payment links (example providers [L]: FIB, FastPay, ZainCash, Qi Card; partners chosen by Q-K10); three-way reconciliation of receipts, terminal batches and acquirer or wallet files.

### 11.7 Calendars

Gregorian; Friday–Saturday weekend; Kurdistan holidays (Newroz on 21 March, the Eids and others) in tenant calendars; calendar-aware SLA timers. Hijri display optional. Ramadan mode (fasting-aware medication timing templates) in P2.

### 11.8 Accreditation and licensing packs (`CLN-QI-01`)

The accreditation-pack engine models chapter → standard → measurable element → evidence query → KPI (numerator, denominator, sampling) → manual fallback. Ship in this order: **JCI 8th edition** (configuration), **KRG Ministry licensing and inspection checklists** [L], the WHO Patient Safety Friendly Hospital Initiative if the KRG uses it [L], Iraqi federal standards at Wave 2 (K §5.8).

### 11.9 Kurdistan foundation content (IMP-FND-01)

Formulary with regional brands; order catalogues; charge-master and package templates; trilingual forms; lab definitions and analyser maps; the 13 master-data sets (§8.6). Target ≥90% adoption per customer, with a deviation log that alarms above 10%. Until clinicians and pharmacists approve real content [HUMAN], ship synthetic sample content flagged **NOT FOR CLINICAL USE**.

### 11.10 Iraq federal pack (P2, ≤40 PM)

Federal Ministry returns; the federal health insurance scheme adapter (rollout reportedly begun [L]); federal practitioner registration fields; an Arabic-first content review with Baghdad users (K §3.4).
