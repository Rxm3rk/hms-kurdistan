
### 9.27 Health information management and the legal record

**Release:** R2b (legal health record, deficiencies, manual release-of-information register); R2.1 (release-of-information workflow automation, coding in §9.24). **Feature:** `CLN-DOC-04` (L). **Modules:** `him`, `record`. **Read:** R07 §8; K §10.1; §13.4 of this prompt.

**Build:** the per-tenant legal health record definition and release rendering (§13.4); **deficiency tracking** (unsigned notes, missing co-signatures, incomplete discharge summaries) as owned queues with SLA timers; chart scanning and indexing into DocumentReference with barcode cover sheets and OCR indexing; patient-requested amendments as addenda with a statement of disagreement; the release-of-information register (intake, identity and authority checks, redaction of sensitivity-labelled content, disclosure log, SLA timers), automated in R2.1; retention schedules and legal holds; a record-review sampler for quality audits; court-evidence export with hash, audit trail and certificate template; the HIM view of the EMPI steward queue.

**Acceptance:** a signed note can never be altered, only amended or marked entered-in-error (SI-06); a release containing labelled content is redacted unless purpose and authority allow it, and every disclosure is logged; a legal hold blocks destruction on every copy, including backups.

### 9.28 Statutory registers and Ministry reporting

**Release:** R1 (narcotics registers, notifiable diseases, KRG outpatient returns); R1.1 (DHIS2); R2a (MLC register, births, deaths, inpatient returns); R2.1 (secondary returns); P2 (wider public-health reporting, `INT-PH-01`). **Features:** `OPS-STAT-01`, `OPS-STAT-02`, `KRI-STAT-02`, `SPC-DTH-01`, `SPC-MAT-01` (birth notification), `MED-CS-01`. **Module:** `statutory`. **Read:** K §8, §9.1; §11.5 of this prompt.

**Build:**
- A **register framework:** locked, append-only entries; corrections only as addenda; per-format exports; required-time SLA timers (target: 100% of entries within the required times); access logging on locked records, with MLC entries carrying the forensic/MLC sensitivity label.
- **MLC register** fed from ED and ADT, with police-notification timestamps.
- **Narcotics registers** fed from controlled-drug movements (§9.10).
- **Births** from newborn registration; **deaths** with ICD-10 cause of death in the WHO certificate format and a mortuary register.
- **Notifiable diseases** triggered from LIS results and coded diagnoses through a configurable rule list approved by the hospital [HUMAN].
- **KRG returns** generated from the indicator catalogue (§9.31); **DHIS2** data-value sets through the Web API if the KRG uses it. Formats load as configuration when the Ministry supplies them (Q-K3).

**Acceptance:** a register entry cannot be edited or deleted through any channel; a sample KRG return and a DHIS2 payload validate against their configured formats; a notifiable result creates a report task with an owner and a due time.

### 9.29 Quality, incidents, accreditation and the safety dashboard

**Release:** R1 (incident reporting, measure engine); R2b (JCI and KRG packs complete; safety dashboard for Clinical Safety KPIs); P2 (evidence packs and EMRAM readiness, `IMP-MAT-01`). **Features:** `CLN-INC-01`, `CLN-QI-01`, `TRU-REG-02` (hazard-log UI). **Module:** `quality`. **Read:** K §5.8, §17; BP §5.8.

**Build:**
- **Incident and safety-event reporting** with an anonymous option, categories, severity, an optional patient or encounter link, RCA workflow and CAPA tracking. A "system-attributable sentinel event" flag notifies the Safety Board, which can freeze new go-lives until the CAPA closes [HUMAN].
- **The accreditation-pack engine:** chapter → standard → measurable element → evidence query or attestation → KPI (numerator, denominator, sampling) → manual fallback. Packs: JCI 8th edition first, then KRG licensing and inspection checklists [L]. The system computes numerators and denominators; manual entry is the minimum fallback.
- **The safety dashboard**, live from hour 0 of every go-live: BCMA scan compliance; overrides by user and unit; orphaned work; critical results within policy (including external referrers); extended double-check completion; pharmacist-cover alarms; time-critical doses delayed by payment (target 0); transfusion bedside verification, WBIT and relabel errors; NEWS2 escalations within policy; interruptive alerts per 100 medication orders; EMPI duplicates and overlays; statutory registers on time; system-attributable sentinel events.

**JCI traceability (K §5.8):**

| Requirement | Feature | SI | Evidence produced |
|---|---|---|---|
| IPSG.1 patient identification | EMPI; trilingual wristbands; BCMA | 01, 08, 16 | Scan compliance by unit; duplicate and overlay reports |
| IPSG.2 critical results | Critical-result service, including external referrers | 04 | Timeliness and read-back log |
| IPSG.3 high-alert medications | High-alert and LASA flags; double checks | 13 | Double-check completion |
| IPSG.4 safe surgery | WHO checklist; site marking; time-out | — | Checklist completion |
| IPSG.6 falls | Morse with care-plan prompts | 03 | Assessment completion; falls per 1,000 bed-days |
| MMU medication management | Verification; med rec; controlled-drug registers; extended dosing double check | 05, 09 | Med-rec and double-check completion |
| MOI information management | Append-only record; legal health record; continuity drills | 06, 10, 15 | Record-review and drill reports with measured recovery |
| KRG licensing indicators [L] | Measure engine; statutory registers | — | Monthly returns |

**Acceptance:** every dashboard KPI is computed from source events and reconciles with a hand count on synthetic data; each JCI row's evidence query runs and produces its report.

### 9.30 Patient and referrer front door

**Release:** R1 (messaging without an account, report release, trilingual outputs); R1.1 (booking and wallet payment links); P2 (patient app, teleconsultation, CRM, referrer portal, IVR); P3 (remote monitoring). **Features:** `DFD-MSG-01`, `KRI-MSG-01`, `DFD-REC-01`, `DFD-BOK-01`, `DFD-PAY-01`; P2 `DFD-APP-01`, `DFD-TEL-01`, `DFD-CRM-01`; P3 `DFD-RPM-01`. **Module:** `front-door`. **Read:** R09 §7; K §9.1–§9.2.

**Build:**
- **One channel-agnostic engagement engine:** journeys (reminders, preparation instructions, result-ready notices, payment requests, follow-ups), trilingual templates in Sorani, Badini, Arabic and English, per-channel consent (opt-in), delivery receipts, and channels WhatsApp Business, Viber and SMS. No patient account is needed.
- **The report-release rule (all channels):** OTP to the registered mobile **plus** a knowledge check when the link is opened; single-use links valid ≤72 h; **no clinical content in message bodies**; SI-21-labelled results and pregnancy tests are never released by message; an "expect a call" flag holds release for results a clinician wants to explain first; every release is audited (BALP).
- **Shutdowns:** SMS goes through the per-site GSM/SMPP gateway; critical messages go by voice call; central adapters queue store-and-forward for ≥7 days.
- **Booking links** (rules-based self-scheduling) and **payment links** for deposits, top-ups and bills, confirmed by webhook (R1.1). Queue status by message.
- **P2:** the patient app (records, messaging, proxy access with identity proofing, refills), teleconsultation with booking and billing, a CRM and international-patient desk, a referrer portal **with no commission features**, and an IVR under the same release rule.

**Acceptance:** a message body never contains clinical content (template linter and payload tests); a labelled result is never offered for release; a link works once and expires at 72 h; during a simulated internet cut, SMS leaves through the site gateway and central messages queue, then send in order when the internet returns.

### 9.32 Migration Workbench, foundation content and go-live tooling

**Release:** R1 (all, for the wedge); R2b (inpatient cutover pack); R2.1 (governance intake, `IMP-GOV-01`); P2 (partner academy tooling, `IMP-CRT-01`). **Features:** `IMP-FND-01`, `IMP-MIG-01`, `IMP-RDY-01`, `IMP-TRN-01`, `IMP-TEL-01`, `IMP-SUP-01`. **Module:** `migration` (public APIs only). **Read:** R15 §9–§10; K §13.

**Build:**
- **Migration Workbench:** connectors (JDBC for Oracle, SQL Server, PostgreSQL and MySQL; CSV/SFTP; HL7 v2 archive replay; FHIR Bulk; DICOM metadata); staging and profiling (null rates, code distributions, date anomalies); a mapping studio producing ConceptMaps to ICD-10, LOINC, UCUM, ATC and the regional brand master; EMPI pre-match with gold-set tooling and a steward queue; loaders that go **through domain APIs only** (idempotent, re-runnable, `migrated` provenance, original clinical times; every SI applies to loaders too); reconciliation dashboards with the accounting identity and a clinician sample-review app; opening balances (deposits and packages per currency reconciled to the dinar, corporate receivables); a pharmacy count app (GS1 scanning, witnessed controlled-drug counts); the active-order assistant (pharmacist pre-build, prescriber signs at go-live); a cutover orchestrator (a `WorkflowPort` runbook with go/no-go checkpoints); and the **Legacy Data Viewer** in patient context.
- **Paper-site packs:** most Kurdistan sites start from paper plus a local billing or pharmacy program, so "migration" is mostly a master-data build from foundation content and the hospital's own lists, plus patient-index seeding from the billing system with EMPI pre-match.
- **Foundation content tooling:** load, diff and adopt the Kurdistan foundation content; a deviation log that alarms above 10%; content always flagged NOT FOR CLINICAL USE until approved [HUMAN].
- **Readiness tooling:** the readiness scorecard; RG1–RG4 evidence templates (§18.13); cutover and rehearsal runbooks; rollback tooling for the three levels; model-ward and UAT kits (scripts mapped to hazards, synthetic patients, expected results, sign-off forms, a pre-filled deployment hazard log for the customer's CSO, an interface pack, a downtime-drill script, an upgrade regression subset).
- **Training:** the TRAIN environment with synthetic patients and role sandboxes; micro-learning; proficiency tracking in three languages.
- **Telemetry:** clinician time and task telemetry, micro-surveys, SUS and NEES capture for the T-120 baselines.
- **Support:** service-desk integration and a status page (built and run locally; publishing it is a [HUMAN] decision, §3.7).

**Acceptance:** a mock conversion on synthetic legacy data reaches the accounting identity at 100% with every reject coded; the cutover orchestrator runs a dry-run end to end with checkpoints; the Legacy Data Viewer opens in patient context with audit.
