# Digest 02: Canonical domain model (Kurdistan edition)

Sources: R11 (full); BP §7.6, §8 (+ §5.1, §7.1–7.4, §12); K §7.5, §8 (+ §4.2–4.3, §5, §6.7, §7.1–7.3, §7.9, §9.1, §10, §12, §13, App A); RL #1, #2, #5, #7, #13. K overrides BP where K App A records a change; RL settles conflicts. Drops are listed in §11.

---

## 1. Modelling principles

- **P1 Patient-centric, encounter-anchored.** Every clinical record has `subject` and, where applicable, `encounter`; problems, allergies and home meds are patient-level (R11 §1).
- **P2 Clinical ≠ system time.** Store `effective[x]`, `recorded`/`authored` and transaction time; display effective, audit both (R11 §1).
- **P3 Immutable history.** Updates are versions; `entered-in-error` replaces delete; merges are links; "as-was" view reconstructible (R11 §1).
- **P4 Explicit status** with an allowed-transition table per record type (R11 §1, §10).
- **P5 Coded + text.** CodeableConcept = {local code, standard code(s), display, original text}, value-set bound per field (R11 §1), plus code-system version (K §8).
- **P6 Coded units.** UCUM everywhere; explicit, versioned dosing weight; conversion only via the terminology service (R11 §1).
- **P7 Namespaced identifiers.** `{system, value, type, period, assigner}`, unique per `system` (R11 §1).
- **P8 Provenance everywhere.** `source` = user/device/interface/AI model/patient, plus optional Provenance (who, on-behalf-of, signature, agent version); AI content labelled until human-verified (R11 §1).
- **P9 Scoped configuration.** Versioned, scoped to a tree node, inherited downward, promoted through environments (R11 §1).
- **P10 Time.** Instants in UTC with facility time zone; DOB a date without zone; local-calendar rendering (R11 §1). K: Gregorian; Hijri display optional (K §4.1, §6.7).
- **P11 Safety invariants in the domain layer**, for every channel (R11 §1; BP §5.1).
- **P12 Privacy labels.** `meta.security`; access = role + care relationship + labels + consent (R11 §1).

**R11 §0:** FHIR is the vocabulary, not the storage schema; every fact records who, what, when (effective vs recorded), where, why, how sure and from where; finance projects clinical activity; domain events map 1:1 to interop triggers.

**Constitution rules binding data** (BP §7.1; K §7.1):
- #1 one system of record per tenant; all else rebuildable.
- #2 immutable bitemporal facts (linter: no UPDATE/DELETE on fact tables).
- #3 strong consistency in the core.
- #4 FHIR/v2 are generated projections.
- #6 nothing fails silently: owner, timer, alarm ≤5 min.
- #7 invariants, policy, audit below the API.
- #8 configuration over code, no forks.
- #9 (K) residency is a property of the cell.
- #10 AI proposes, humans dispose; agents never touch the DB.

**Storage posture** (RL #1; BP §7.5; K §7.4): PostgreSQL aggregates and state machines, one DB per tenant; typed FHIR-shaped JSONB facts; generated FHIR R4 façade (reads, `$export`, IPS, Subscriptions); writes via domain commands; HAPI libraries embedded. Option A default, spike-gated, frozen M3; K adds C9 (on-site footprint).

## 2. Enterprise structure

Tenant → Legal entity (Organization) → Facility → Building → Floor → Unit/Ward → Room → Bed. Department/Service line → Cost centre and Store/Pharmacy/Warehouse sit under the Facility (R11 §0, §2).

- **Tenant** (platform concept): residency region, deployment, licensing, locale pack; hard isolation boundary for data and keys (R11 §2).
  - **K:** tenant = contracting enterprise; one hospital = one on-site cell. A group shares a tenant only if links measure ≥99.95% over 60 days (incl. an exam-shutdown period unless private circuits; retested yearly), else separate tenants with identities cross-referenced (P2). Outpatient tier pooled with FORCE RLS (K ADR-006). Per-tenant keys, crypto-shredding (K ADR-008).
- **Organization:** identifiers (tax ID, licence no., national facility registry ID: generic pattern), type (prov/dept/ins/pay), partOf; legal entities, departments, payers, referring orgs (R11 §2). KRG MoH identifiers sit in the Kurdistan pack (K-26).
- **Facility → Bed** (Location; physicalType si/bu/lvl/wa/ro/bd, also wi, co, ca, area; `partOf`): operational status (bed: v2-0116 C/H/O/U/K/I), gender restriction, isolation capability, telemetry capable, level of care, cost centre. Bed state is a separate machine (§4.6); R4 `Location.status` is general availability only (R11 §2).
- **HealthcareService:** specialty, available times, referral method, eligibility; drives scheduling and referral routing (R11 §2).
- **Department** (Organization, type=dept): specialty, head, cost centre (R11 §2).
- **Cost centre / GL segment** (ERP): GL code, budget owner; mapped from Location/Department for charge and cost allocation (R11 §2).
- **Store** (Location + ERP): store type (central, pharmacy, ward stock, OR), par levels (R11 §2).

**Rules:**
- Physical and organisational hierarchies stay separate but cross-referenced: a ward sits physically in a building, organisationally in a department and financially in a cost centre (R11 §2).
- Configuration and security rules are scoped to tree nodes (R11 §0). Row-level `tenant_id`/`facility_id`: §5.

## 3. Aggregate catalogue

Contexts follow BP §7.4 (unchanged per K §7.3; revenue gains dual-currency cash and the doctor-fee ledger). Releases follow K §4.2–4.3.

### 3.1 People and identity
Patient access (EMPI) and Trust Plane (IAM); squad 1 (BP §8); R1.

- **Patient** (R11 §3; K §8): identifier list (K types, §10); names (multiple; use official/usual/maiden/alias; multiple scripts); gender + sex-for-clinical-use (Extensions Pack, draft FMM 1) + gender identity; birthDate + precision flag; deceased; address; telecom; language + interpreter needed; marital status; religion/ethnicity where lawful; photo; links replaced-by/replaces/seealso.
  - Enterprise person ID always present; MRN per facility or enterprise, configurable (R11 §3.1). Special flows: newborn, unknown ("Trauma Alpha"), John/Jane Doe (R11 §3).
- **Identifier:** {system, value, type, period, assigner}, unique per system. Legacy-hospital numbers are typed alternate identifiers (INT-SEAM-01), so cutover becomes a link operation (K §13.1).
- **Match candidate:** {patientA, patientB, score, algorithm/version, status possible/confirmed-same/confirmed-different, reviewer} (R11 §3.1).
- **Merge (link):** survivor + `replaced-by` link + re-pointed active references + algorithm version; logged, reversible; emits PatientMerged/Unmerged (R11 §3.1; BP §8). Lifecycle in §4.9a.
- **Newborn link:** mother–baby via RelatedPerson/`Patient.link` + encounter linkage, for couplet care and billing (R11 §3.1). Named "Baby of [mother]" (K §8).
- **RelatedPerson:** relationship (NOK, guardian, proxy, guarantor, emergency contact), contact, legal authority; proxy access, billing guarantor (R11 §3).
- **Person:** links one human's Patient/Practitioner/RelatedPerson records; employee-patients trigger privacy rules (R11 §3).
- **Practitioner:** typed identifiers (K §8), qualifications, languages; separate from the user account (R11 §3).
- **PractitionerRole:** organisation, locations, specialty, clinical privileges, availability, endpoints; several roles across facilities (R11 §3). Per-hospital privileges + visiting-consultant flag (K §8); privileges gate order entry and OT booking (K §12.2).
- **CareTeam:** patient-specific members and roles; basis of care-relationship access and notifications (R11 §3); assignment uses ES-lite (BP ADR-024).
- **User account:** login, MFA, roles, security group, linked Practitioner/Employee; never conflated with practitioner (locums, students, scribes, interfaces) (R11 §3).
- **Employee:** position, grade, department, contract, credentials, competencies; feeds rostering and credentialing (R11 §3).

### 3.2 Scheduling, referrals, queues
Squad 1; R1.

- **Schedule:** actors (practitioner/room/device/team), planning horizon, service types (R11 §4).
- **Slot:** start/end; status free/busy/busy-unavailable/busy-tentative/entered-in-error; overbook flag; visit type (R11 §4).
- **Appointment:** status (§4.7); participants (patient, practitioner, location, equipment); service type; reason; priority; `basedOn` referral; cancellation reason (R11 §4).
- **AppointmentResponse:** participant accept/decline (R11 §4).
- **Referral:** ServiceRequest (referral) with from/to, urgency, reason, attachments, authorisation status (R11 §4). Loop in §4.9h.
- **Waitlist entry:** Appointment (waitlist) or custom; constraints (provider, time windows), priority, auto-offer rules (R11 §4).
- **Queue token (OPD):** custom aggregate + Encounter/Appointment link; token no., service point, status waiting/called/in-service/done/skipped, call count, estimated wait (R11 §4).
- **Surgical case request:** ServiceRequest + Appointment; procedures, surgeon, anaesthesia type, duration, equipment, implants, pre-op requirements (R11 §4).
- **Calendars:** Friday–Saturday weekend; Newroz and the Eids; calendar-aware SLA timers (K §6.7).

### 3.3 Encounters, episodes, ADT, location history
Squad 1; OPD in R1, inpatient in R2a.

- **EpisodeOfCare:** condition focus (pregnancy, oncology regimen, dialysis programme), managing org, care manager, period (R11 §5).
- **Encounter** (R11 §5): class (AMB, EMER, IMP, OBSENC, SS, HH, VR); type; status (§4.1); statusHistory; classHistory (e.g. ED → IMP); participants with roles (attending, admitter, referrer, consultant); period; reasonCode; diagnosis (role admission/billing/discharge + rank); hospitalization (admit source, readmission flag, diet/special arrangements, discharge disposition, destination); location history (location + status + period); serviceProvider; accounts; partOf (sub-encounters, e.g. OR visit).
  - **Location history is the single source of truth** for occupancy, census, patient-days and bed-day charges; bed boards, isolation tracking and room charges derive from it, never from separate tables (R11 §5; BP §8).
  - Keep rank and principal/secondary sequencing; keep status/class/location history in our event store, projected per FHIR version (R11 §5; BP §8).
- **ADT event log:** event type (admit, transfer, discharge, leave, cancel-admit, pending admit, swap beds, update), effective time, recorded time, user, reason. Maps to v2 A01–A62 (R11 §5).
- **Triage record:** Observations + `Encounter.priority`; acuity scale, coded chief complaint, vitals, triage nurse, time (R11 §5). One scale per tenant (K §4.3).
- **Leave/pass:** R4 `onleave` + location period. R5/R6: `on-hold` + subjectStatus `on-leave` (R11 §5).
- **Bed/room/unit:** one authority per bed. PG exclusion constraints prevent double occupancy. Internal state + reason is authoritative over 0116 (BP §8; R11 §10.6).

### 3.4 Clinical record
Clinical record context.

- **Problem** (Condition, problem-list-item): clinicalStatus active/recurrence/relapse/inactive/remission/resolved; verificationStatus unconfirmed/provisional/differential/confirmed/refuted/entered-in-error; onset/abatement, severity, body site, code + ICD mapping (R11 §6).
- **Encounter diagnosis:** Condition + `Encounter.diagnosis` (role, rank); principal vs secondary (R11 §6).
- **Allergy/intolerance:** type, category (food/medication/environment/biologic), criticality, substance or class code, reactions (manifestation, severity), verification. **"NKA" is an explicit assertion, distinct from "not assessed"** (R11 §6).
- **Vital signs:** LOINC, UCUM, method, device, body position, validated-by-nurse flag for device values (R11 §6). Device streams are summarised, never one row per datapoint (BP §8).
- **Flowsheet row:** Observation + ObservationDefinition template (R11 §6).
- **Assessment/score** (NEWS2, Braden, Morse, GCS, pain): store components + total + calculation version (R11 §6; BP §8).
- **Structured form:** Questionnaire/Response for admission assessments, WHO surgical checklist, consents (R11 §6).
- **Clinical note** (R11 §6, §6.1; BP §8): Composition + DocumentReference; type (LOINC document ontology), authors, status (§4.9b), attestation/co-signature, addenda, sharing restrictions; source attribution per segment (typed, dictated, ambient-AI, copied-forward); inserted data kept as snapshot or as-of reference; rendered, hashed copy stored at signature. K: English clinical text; patient instructions in Sorani/Badini/Arabic from approved templates (K §4.3).
- **Procedure:** code (local; SNOMED subject to Q-K9), performers + role, period, body site, outcome, complications, implants (focalDevice), report (R11 §6).
- **Care plan/goals, family history, clinical impression:** CarePlan, Goal, CareTeam; FamilyMemberHistory; impressions stored as notes + Conditions (resource not in R6 core) (R11 §6).
- **Immunisation:** vaccine code, lot (from the stores ledger), expiry, site, route, dose no., performer, consent, registry-reporting status. Projected as VXU and FHIR Immunization (R11 §6; BP §8). R1 (K §4.2).
- **Flag:** fall risk, isolation (contact/droplet/airborne), DNR/code status, violence risk, MRSA/CRE carrier, VIP, interpreter needed (R11 §6).
- **Advance directive / code status:** own model, because R5 is incomplete; banner-visible, time-stamped, reviewable (R11 §6).
- **Media:** body site, consent, de-identification. R5 replaces Media with DocumentReference/Observation (R11 §6).

### 3.5 Orders and tasks
Safety Kernel (Orders and CPOE; Tasks and owned queues); squad 3.

**Order kinds → fulfilment (R11 §7.1):**
- lab → Specimen → Observation + DiagnosticReport;
- imaging → ImagingStudy + DiagnosticReport;
- procedure/nursing/therapy → Procedure, Observation, Task;
- consult/referral → Encounter + note;
- medication → dispense → administration;
- diet (NutritionOrder) → tray tickets, intake;
- device (DeviceRequest) → internal device-use record;
- blood → product, crossmatch, transfusion record;
- ADT order → Encounter events;
- order set (PlanDefinition/ActivityDefinition → RequestGroup/RequestOrchestration) → linked requests sharing `groupIdentifier`.

**Common attributes (R11 §7.2):**
- placer/filler (accession) identifiers; `basedOn`/`replaces`; `groupIdentifier`;
- status (draft/active/on-hold/revoked/completed/entered-in-error/unknown);
- intent (proposal/plan/directive/order/original-order/reflex-order/filler-order/instance-order/option);
- priority (routine/urgent/asap/stat); code; orderDetail; quantity; occurrence/Timing; asNeeded;
- requester (+ on-behalf-of for verbal/telephone orders: read-back flag, co-sign due-by);
- performer, location, reason (indication), insurance, supportingInfo, specimen, bodySite, note, patientInstruction, Provenance history.

**Rules:**
- One aggregate holds request + tasks + status history (R11 §0; BP §8).
- Every fulfilment step is a Task. Worklists are read models over open Tasks by role, location and due time (R11 §7.3).
- Orders, Medications and the MAR share one transactional boundary (BP ADR-003).
- Temporal never holds order or MAR state (K ADR-010).
- **K phasing:** OPD orders in R1; inpatient CPOE in R2b; R2a uses paper orders under the transcription control set (§3.7).

### 3.6 Diagnostics
Diagnostics (LIS/RIS) + Kernel results and critical-result service; squad 6.

- **Specimen** (R11 §8): accession ID, barcode, type, container, collection (collector, time, method, site, fasting), received time, condition (haemolysed, clotted), parent (aliquots), processing steps. FHIR status (available/unavailable/unsatisfactory/entered-in-error) describes the specimen; logistics states are internal (§4.4).
- **Result:** LOINC, value + UCUM, versioned age/sex reference range, interpretation (H/L/HH/LL/A/AA, critical), method, analyser, performer, status (§4.5), derivedFrom, hasMember (R11 §8).
- **Report:** DiagnosticReport with code, status, results, conclusion (+ coded), PDF, performer, resultsInterpreter, imagingStudy, effective/issued times (R11 §8).
- **Microbiology:** culture → isolate → susceptibility (antibiotic, MIC/zone, S/I/R) (R11 §8). **P2**, with WHONET/GLASS export (K §4.3).
- **Critical-result communication:** Communication + Task recording who was notified, when, read-back and the escalation chain (R11 §8). Named recipient from a picker, never free text (BP SI-04). Includes external referring doctors (K SI-04).
- **Imaging study:** Study Instance UID, accession, modality, series/instance counts, DICOMweb endpoint, start time, procedure code (R11 §8). RIS in R1 (K §4.3).
- **Pathology case:** part → block → slide; synoptic fields (R11 §8). **P3** (K §4.3).
- **Blood unit:** BiologicallyDerivedProduct; ISBT 128 donation ID + product code, ABO/Rh, expiry, status, location; issue modelled internally (R11 §8). K: units from public blood banks, relabelled at receipt (§4.9c); native ISBT 128 inventory P2 (regulated track); **no compatibility engine, ever** (K §4.3; K-08; RL #5).
- **Transfusion:** two-person verification, start/stop vitals, reactions (haemovigilance) (R11 §8). R2b (K §4.2).

### 3.7 Medications
Kernel (Medications, pharmacy, eMAR, BCMA); squad 4.

- **Medication product:** code (K regional brand master, §10), form, ingredients with UCUM strength, manufacturer, lot/expiry, high-alert, LASA, controlled schedule (R11 §9).
- **Formulary item:** internal aggregate with status, restrictions (e.g. ID-approval antibiotics), default dosing, forms, cost, stock locations (R11 §9). LASA, tall-man and high-alert flags (K §4.3).
- **MedicationOrder:** dosage (Timing, route, site, method, dose and rate ranges), asNeeded + indication, max dose per period, duration, dispense request, substitution, pharmacist verification status, dosing weight/height and renal function used (R11 §9). **Own dose model**, independent of FHIR `Dosage` (R11 §9; BP §8). Dose Engine calculation ID (BP §8) once the P2 Engine is live; until then the extended fallback control set (K §5.1 SI-05).
- **Pharmacist verification:** Task + Provenance; verifier, time, interventions, notes (R11 §9).
- **Dispense:** quantity, days supply, lot/expiry, location (central/ADC/ward), prepared-by/checked-by, compounding (R11 §9).
- **Administration (eMAR):** status, statusReason (held, refused, NPO, off unit), time, actual dose/rate, route/site, performer, **barcode evidence** (wristband + product, or override reason), witness (high-alert/controlled), pump, linked order (R11 §9).
- **Home meds:** MedicationStatement with source and adherence (R11 §9).
- **Med reconciliation:** per transition, a decision per med, reason, reconciled-by and time (R11 §9). Lifecycle in §4.9e.
- **K: transcribed paper order (R2a)** (K §4.2; KDV-16): pharmacists only, with an image of the signed order; KB screening at transcription; ordering practitioner mandatory; second check for high-alert/paediatric. **No MAR, schedule or "active medicines" view**; screen labelled "dispensing record, not an order or MAR"; reconciliation input only at upgrade; 50 audited monthly.
- **K: patient-supplied medicine:** flagged "patient-supplied"; lifecycle in §4.9d (K §12.1).
- **K: in-house unit-dose labels:** MED-KRI-01 barcodes for imported drugs (K §4.3).
- **Event sourcing:** ES-lite by default (RL #7). Full ES for MedicationOrder/Administration only if BCMA p95 ≤500 ms, order-sign ≤1.5 s, tooling ≤8 engineer-weeks and no critical-path cost; revert on tooling overrun, BCMA p95 >500 ms, upcasting >20% of squad capacity, or any C1 miss (BP §7.6).

### 3.8 Finance
Revenue context (account, charge router, claims; GL); squad 8.

All are **internal aggregates**; FHIR names are naming guidance only. The external API uses R6-core resources only (Account, Claim, ClaimResponse, Coverage, CoverageEligibility*, EOB, PaymentNotice, PaymentReconciliation). Never persist ChargeItem/Invoice JSON as the record (R11 §11; RL #2).

- **Coverage:** payer, plan, member ID, relationship, primary/secondary order, period, network, co-pay, authorisation requirements (R11 §11).
- **Account:** guarantors, coverages, encounters, balance, status, type (inpatient/outpatient/package/corporate) (R11 §11).
- **Ledger:** append-only double entry with reversals (BP §8). Functional currency, original amounts kept, FX differences to the GL export (K §8).
- **Tariff:** price by payer/plan/ward class, effective periods, packages, discounts (R11 §11). Versioned by date of service as data; IQD by default (K §12.1).
- **Charge:** CDM code, quantity, unit price, service date, override reason, source event (order/procedure/administration/bed-day/supply), status planned/billable/not-billable/aborted/billed/entered-in-error/unknown (R11 §11); performing and ordering department **and practitioner** (K §8).
- **Package:** inclusions, exclusions, LOS limits, implant pass-through, overrun rules, free revisit window (K §12.1).
- **Deposit:** set by package or bed category; top-up alerts; **held in the tendered currency** (K §12.1).
- **Estimate:** validity, patient share, separate surgeon and anaesthetist fee lines, variance tracked (K §12.1).
- **Invoice:** lines, taxes (configurable, Q-K6), discounts, payer splits. Status: draft/issued/balanced/cancelled/entered-in-error (R11 §11; K §12.1).
- **Pre-approval:** first-class entity linked to orders, coverage, units and validity dates; checked at claim build; SLA timers paused while a query is open (K §12.1).
- **Credit claim:** per-line payer/patient/non-payable split, deduction-reason codes, document pack (K §12.1, §9.1).
- **Payment:** method (cash, card, wallet/QR), receipt no., cashier session (R11 §11; K §12.1). Records tendered currency, amount, rate and change given (K §8).
- **Adjustment:** reason, approver, policy (R11 §11). Thresholds by role/amount/%; charity or Zakat funds (K §12.1).
- **Guarantor / credit:** person or org with credit status; payment plans; bad debt and charity tracked separately (K §12.1).
- **Money, exchange rate, cashier drawer, doctor-fee ledger:** see §10.

**Rules:**
- The charge router generates charges from clinical events, traceable to source; manual entry for exceptions only (R11 §11). Clinicians never type charges (K §12).
- One patient-account view. Country differences live in adapters and configuration, never forks (R11 §11).
- No DRG grouper. Replay 3–6 months of encounters before any tariff goes live (K §12.1).

### 3.9 Supply chain, assets, workforce
Supply chain and stores; GL. All internal aggregates, because these FHIR resources leave R6 core (R11 §12; BP §8). Phase per K §12.2.

- **Item master** (MVP): code, GTIN, UDI-DI, UoM conversions, category, chargeable flag + CDM link, implant flag, lot/serial tracking, storage (R11 §12).
- **Stock/lot** (MVP): store, bin, lot, serial, expiry (FEFO), quantity, consignment flag (R11 §12).
- **Requisition/transfer** (MVP: indents, ward stock): from/to store, items, approval (R11 §12).
- **PO / GRN / vendor invoice** (MVP, procurement-lite): 3-way match; consignment with bill-only PO on use (R11 §12; K §12.2).
- **Implant/device instance** (MVP: OT implants to charge and stock): UDI (DI+PI), lot/serial, expiry, implanted-in (`Procedure.focalDevice`), recall status (R11 §12).
- **Biomedical asset** (P2, CMMS): asset tag, location, maintenance, calibration, service history, connectivity (R11 §12).
- **Shift/roster** (P2, basic rostering): unit, role, skill mix, hours, ratios, acuity requirement (R11 §12).
- **Credential/privilege** (MVP): licence + expiry, board certification, privileges per procedure, competency. Privileges gate orders and OT booking (R11 §12; K §12.2).
- **Also:** controlled-drug registers (MVP); payroll/HCM always integrated (P2); costing in P3, with resource IDs, timestamps and lots captured from day one (K §12.2); FEFO and lot/UDI from consumption to charge (BP §8).

### 3.10 Cross-cutting records
Trust Plane, Kernel and Knowledge contexts.

- **AuditEvent:** every read, write, print, export and break-the-glass; ATNA/BALP; tamper-evident (R11 §13). Hash-chained WORM store that tenant admins cannot disable (BP §8; K §10).
- **Provenance:** authorship, signatures, transformations, AI agent identity + model version (R11 §13).
- **Consent:** category, policy, provisions (actors, purpose, data classes, period), signature/witness, source document (R11 §6); append-only (BP §8). K registry: treatment eConsent by the performing clinician, messaging consent per channel, research opt-in, optional guardian/co-signer; enforced at the policy point (K §10).
- **Sensitivity label:** append-only, enforced at the policy enforcement point on every channel (BP §8; SI-21). K labels: HIV, mental health, reproductive and sexual health, gender-based violence, forensic/MLC, VIP (K SI-21).
- **Task:** universal work item; every task has an owner + SLA; unowned work raises `TaskOrphaned` ≤5 min, a first-class alarm (R11 §13; SI-03; BP §7.6).
- **Communication:** secure messages, critical-result calls, notifications (R11 §13). K report release: OTP to the registered mobile + knowledge check; single-use links ≤72 h; no clinical content in bodies; SI-21-labelled results and pregnancy tests never sent; BALP-logged (K §9.2).
- **List:** worklists, reconciliation snapshots, "my patients" (R11 §13).
- **Binary/DocumentReference:** scans, PDFs, images; object storage + hash (R11 §13). Paper charts scanned to PDF/A (K §13.5).
- **Terminology and definitional content:** CodeSystem/ValueSet/ConceptMap/NamingSystem; PlanDefinition, Questionnaire, ObservationDefinition, SpecimenDefinition, Library, Measure; versioned and promotable (R11 §13).
- **Subscription** (topic-based; backport on R4) and **device metrics** (Device, DeviceMetric, Observation) (R11 §13).
- **Release of information:** intake, identity/authority checks, redaction of labelled content, disclosure log, SLA timers. Manual register until R2.1 (K §10.1).
- **Retention:** **never auto-delete**; 25-year floor. Destruction needs a schedule, approval and legal-hold check; a litigation hold overrides every schedule (K §10.1).

### 3.11 Statutory registers
Not on the BP §7.4 map; framework OPS-STAT-02.

- **Statutory register entry:** locked, append-only; corrections are addenda (BP §8; K §8). K content: MLC with police-notification timestamps (R2a); narcotics registers (R1 OP POS); births and deaths on KRG forms, ICD-10 cause of death (R2a); notifiable diseases from LIS results and diagnoses (R1) (K §8, §9.1). No register may sit in R1.1/R2.1 (K §4.2).
- **KRG return / DHIS2 data-value set:** statistical returns from the indicator catalogue (R1 outpatient, R2a inpatient); DHIS2 Web API in R1.1 if the KRG uses it; secondary statutory returns in R2.1; formats loaded as configuration (K §9.1, §4.2; Q-K3).

## 4. State machines

Specs come before any UI (R11 §17 #2). Owner, approver and gate per machine follow BP §8 and K §8. An empty guard cell means the sources give no guard.

### 4.1 Encounter
R11 §10.1. Owner: squad 1. Approval: nurse panel + HIM + CSO, G1.

| From | Event/command | Guard / effect | To |
|---|---|---|---|
| (start) | Pre-admit (A05) / schedule | | planned |
| planned | Patient arrives (A04/A10) | | arrived |
| planned | Cancel | | cancelled |
| arrived | ED triage | Triage record: scale, complaint, vitals, time | triaged |
| arrived / triaged | Admit to bed (A01) | No bed allocation offline (SI-15). No deposit rule blocks ED registration or emergency orders (K SI-12) | in_progress |
| in_progress | Transfer (A02) / swap (A17) | Appends a location-history period | in_progress |
| in_progress | Leave (A21) | | onleave |
| onleave | Return (A22) | | in_progress |
| in_progress | Discharge (A03) | Never blocked by bill, deposit or pre-auth (SI-12). Pending results go to owned queues (SI-17) | finished: discharged-not-closed |
| discharged-not-closed | Administrative close (coding and charging done) | | finished (closed) |
| finished | Cancel discharge (A13) | Audited | in_progress |
| in_progress | Cancel admission (A11) | Audited | entered_in_error |

- **Terminal:** finished, cancelled, entered_in_error.
- **R5/R6 projection** (our convention, not HL7's): arrived/triaged → `in-progress` (or `planned`) + subjectStatus; onleave → `on-hold` + `on-leave`; finished → `discharged`, then `completed`; abandoned → `discontinued` (R11 §10.1).
- **Who:** triage nurse (R11 §5); admitter/attending as participant roles; others unspecified.

### 4.2 Order
R11 §10.2. Owner: squad 3. Approval: pharmacist and nurse panel + CSO, G1.

| From | Event/command | Guard / effect | To |
|---|---|---|---|
| (start) | Pend / save unsigned; at cutover, pharmacists pre-build orders as "pending prescriber signature" (K §13.5) | | draft |
| draft | Sign | **Required:** co-sign where required (R11 §10.2); orderer privileges (K §12.2); identity re-verified if the context changed <60 s ago (SI-16); dose/allergy/interaction/duplicate checks (R11 §9 #5).<br>**Verbal orders:** read-back flag + co-sign due-by (R11 §7.2); none for antineoplastics (K §4.3).<br>**Restricted antimicrobials:** indication + approver (K §5.2) | active (medication orders: pending-verification) |
| draft | Discard | | revoked |
| active: pending-verification | Pharmacist verifies | Checks re-run (R11 §9 #5). Emergency/first-dose override may bypass (R11 §10.2) | active: verified (dispensable) |
| active | Hold (NPO, OR) | | on_hold |
| on_hold | Resume | | active |
| active | Fulfilled / result final | | completed |
| active | Discontinue | Reason | revoked |
| active | Mark error | | entered_in_error |

- **Terminal:** completed, revoked, entered_in_error. Every order must reach one (SI-03).
- **Modification** = a new request with `basedOn`/`replaces` (R11 §7.2).
- **Antimicrobials** carry a stop/review date and a 48–72 h time-out task (K §5.2).
- **Who:** requester, co-signer, pharmacist (R11 §7.2, §9).

### 4.3 Medication administration (per scheduled dose)
R11 §10.3. Owner: squad 4. Approval: pharmacist and nurse panel + CSO, G1.

| From | Event/command | Guard / effect | To |
|---|---|---|---|
| (start) | Dose falls due | | scheduled (due) |
| scheduled | Start (infusion started) | **Order:** active verified order or documented override, reason never defaulted, reportable (SI-02).<br>**Scans:** ≥2 identifiers via wristband; product within tolerance, else hard or soft stop with reason (R11 §9 #2–3).<br>**Checks:** high-alert double check (SI-13); checks re-run (R11 §9 #5); unverified patient-supplied medicine unscannable (K SI-12) | in-progress |
| in-progress | Complete | | completed |
| (as listed) | Held / refused / missed | statusReason required | not-done |
| (as listed) | Stop | | stopped |
| (as listed) | Mark error | | entered-in-error |

- **Late doses:** configurable windows (e.g. ±30/60 min; time-critical tighter) (R11 §10.3).
- **Time-critical doses** (STAT/first, antimicrobials, insulin, anticoagulants, anticonvulsants): never delayed by payment; charged to the running bill (K SI-12).
- **Offline commands** revalidated by the server; no last-writer-wins (SI-15).
- **Who:** performer; witness for high-alert/controlled (R11 §9).
- **Ambiguity:** R11 §10.3 draws outcomes only after in-progress; scheduled → completed/not-done are not drawn.

### 4.4 Specimen
R11 §10.4; BP §8. Owner: squad 6. Approval: Lab CSO, G1.

| From | Event | Guard / effect | To |
|---|---|---|---|
| (start) | Order placed | | ordered |
| ordered | Print label | | label printed |
| label printed | Collect | Collector, time, scanned wristband; 2 identifiers (R11 §15 #1) | collected |
| collected | Dispatch | | in transit |
| in transit | Receive at lab | | received |
| received | Process | | in process |
| in process | Result | | resulted |
| resulted | Store / dispose | | stored / disposed |
| (source not specified) | Reject | Reason (unlabelled, haemolysed, insufficient); **recollect task generated** | rejected |

- **Terminal:** stored, disposed, rejected.
- BP §8 shortens the chain (ordered → labelled → collected → in transit → received → resulted).

### 4.5 Result
R11 §10.5. Owner: squad 6. Approval: Lab CSO + physician panel, G1.

| From | Event | Guard / effect | To |
|---|---|---|---|
| (start) | Register | | registered |
| registered | Preliminary | | preliminary |
| preliminary | Validate | Autoverification from R1.1; manual validation before that (K §4.2) | final |
| final | Amend / correct | **Notify the orderer and everyone who acknowledged the earlier version** | amended / corrected (child of amended) |
| any | Cancel / mark error | | cancelled / entered-in-error |

**Critical results:** named recipient, read-back, timed escalation (SI-04, §4.9f).

### 4.6 Bed
R11 §10.6; BP §8. Owner: squad 1. Approval: nurse panel + bed manager, G1.

| From | Event | Guard / effect | To |
|---|---|---|---|
| available (clean) | Reserve/assign (pending admit A14 / transfer) | Not offline (SI-15; K: only if the cell is lost) | reserved/assigned |
| reserved/assigned | Patient placed | Exclusion constraint: no double occupancy | occupied |
| occupied | Patient left | | dirty |
| dirty | Start cleaning | Isolation-aware cleaning (BP §6.1) | cleaning in progress |
| cleaning in progress | Done | | available |
| (side branch) | Block (isolation, contamination, maintenance, staffing) | Reason required | blocked |
| (side branch) | Close | | closed |

- **Every change** emits ADT^A20.
- **0116 projection:** available/reserved = U (plus pending event); occupied = O; dirty/cleaning = H; blocked-isolation = I; blocked-contamination = K; closed or blocked-maintenance/staffing = C (R11 §10.6).
- **Who:** bed manager/EVS (BP §6.1).
- Source and exit states for blocked/closed are not specified.

### 4.7 Appointment
R11 §10.7, §4. Owner: squad 1. Approval: OPD panel, M9.

| From | Event | Guard / effect | To |
|---|---|---|---|
| (start) | Propose | | proposed |
| proposed | Request | | pending |
| pending | Book (S12) | | booked |
| booked | Check in / arrive | | checked-in / arrived |
| checked-in / arrived | Visit complete | | fulfilled |
| open states | Cancel (S15) | Record by whom, why, late-cancel flag | cancelled |
| booked | No-show (S26) | | noshow |
| (start) | Waitlist | Constraints, priority, auto-offer | waitlist |

Reschedule = S13; modify = S14. The R4 set also includes entered-in-error.

### 4.8 Claim and pre-approval (Kurdistan "credit claim")
Owner: squad 8. Approval: RCM lead + pack PM, M9 (BP §8 names the KSA/India pack PMs; K §8 names no approver).

| From | Event | Guard / effect | To |
|---|---|---|---|
| draft | Scrub | Edits pass | scrubbed |
| scrubbed | Submit (document pack; FHIR Claim if the insurer takes it, K §9.1) | Pre-approval checked at claim build (K §12.1) | submitted |
| submitted | Acknowledge | | acknowledged |
| acknowledged | Adjudicate | | adjudicated (paid / partially paid / denied) |
| adjudicated | Appeal / resubmit | Denial root-cause queue (K §12.1) | appealed / resubmitted |
| adjudicated / appealed / resubmitted | Close | R11 draws the chain linearly | closed |

- **Pre-authorisation runs in parallel:** requested → approved / partially approved / denied / pended (R11 §10.8).
- **BP TPA sequence, generalised by K** to corporate/NGO/insurer credit: pre-auth → query (clock paused while open) → approval → enhancements → final bill → discharge authorisation → settlement → appeal (BP §12.1; K §12.1).
- **Clocks escalate to the desk, not to clinicians** (BP §12).

### 4.9 Additional lifecycles (BP/K)

- **a. Identity (EMPI)** (R11 §3.1): match candidate possible → confirmed-same / confirmed-different (reviewer); confirmed-same → merge → unmerge (restores). Guards: never offline (K §7.9); auto-merge precision ≥99.9%, overlays are safety incidents, propagation via A40/`Patient.link` (SI-08); results never silently re-attached (R11 §15 #7).
- **b. Clinical note** (R11 §6.1; SI-06/07): preliminary → final (signed, rendering hashed) → amended (new version + reason + visible marker). Addendum = linked note; retraction → entered-in-error + reason. `draft-ai` until a human signs (K: from P2).
- **c. Blood-unit receipt** (K SI-11, §9.2; R2b; states derived from text, no formal list)
  - **Receipt:** received → two-person blind double entry of unit no., ABO/Rh, product and expiry from the original label + issue note → match → relabelled (unit no. and ABO/Rh beside the barcode; original label never covered) → issuable. Any mismatch or fridge excursion → **quarantined**.
  - **Bedside:** wristband ↔ unit ↔ order ↔ sample match + two-person e-witness; mismatch = hard stop; witness confirms the unit no. on the original label. Before T2: scripted fallback, both e-signatures, no automated pass/fail (BP SI-11).
- **d. Patient-supplied medicine** (K §12.1; R2a): received by pharmacy → identified → expiry-checked → relabelled to the patient, flagged "patient-supplied" → administrable. Unverified items cannot be scanned.
- **e. Med rec** (R11 §9; SI-09): each item continue/modify/hold/stop/new + reason; completion blocked while any item is undecided; transcribed orders and polyclinic history are reconciliation input only (K §4.2, §13.1).
- **f. Critical result** (R11 §8; SI-04): flagged → named recipient → read-back documented → acknowledged, else the timed escalation chain fires (`CriticalResultEscalated`, BP §7.6). Outpatient downtime: phoned, read-back logged on the edge agent, back-entered ≤4 h (K §7.9).
- **g. Task:** see §3.10.
- **h. Referral** (K §5.2; BP §5.2): created → owned queue → appointment/admission → acknowledgement → closure letter to the referrer. Seam: hospital A's logged receipt = acknowledgement; unacknowledged >24 h = 0 (K §13.1).
- **i. No drawn transitions** (R11 §6–§9): Slot, queue token (§3.2); Condition (§3.4); Specimen FHIR status (§3.6); Charge, Invoice (§3.8). Observation: registered/preliminary/final/amended/corrected/cancelled/entered-in-error/unknown. MedicationAdministration: in-progress/not-done/on-hold/completed/entered-in-error/stopped/unknown. Composition: preliminary/final/amended/entered-in-error.

## 5. Storage shapes and event layers

**Storage shapes** (BP §7.6, citing R08 §3.11):
- **A:** relational aggregates with FK and exclusion constraints.
- **B:** immutable facts with `valid_period`, `recorded_at`, author, attester, source (`ai-draft`, `device`, `migrated`), `supersedes_id`.
- **C:** bitemporal journal, written in the same transaction as the state change; both outbox and write-audit trail.
- **D:** rebuildable read models, pushed over SSE.

| Layer | Content | Guarantees |
|---|---|---|
| 1 Clinical journal | One append-only row per state change. Columns: aggregate, patient, valid time, recorded time, actor, on-behalf-of, device, reason, payload, previous version | Same transaction; never updated |
| 2 Domain events | CloudEvents 1.0; Apicurio schemas; backward-compatible only; 12-month deprecation | Debezium → Kafka keyed by patient (per-patient order); at-least-once; idempotent consumers |
| 3 Integration messages | HL7 v2, FHIR and Kurdistan-pack outputs, generated by the Hub | Per-patient ordering (A08 never overtakes A01); MSH-10 idempotency; ack state; replay; owned dead-letter queues alarm at 5 min |

**K messaging backbone (ADR-009):** Kafka KRaft, three brokers co-located on the cell. If C9 fails, NATS JetStream everywhere.

**Identifier and time rules:**
- UUIDv7, "merge-friendly across edge cells" (K §7.5); `tenant_id` + `facility_id` on every row; instants in UTC with the original offset (BP §7.6).
- Effective, recorded and transaction times kept separate; the "as-was" view answers "what did the clinician see" (BP §8).
- Back-dating privileged and audited (SI-10); back-entry valid time = paper time (K §7.9 L4); downtime entries flagged (R11 §15 #10); migrated data carries `migrated` provenance + original times (BP §8).
- GPS or stratum-1 NTP per cell; node skew >1 s alarms; a node >5 s out is blocked from clinical writes (K ADR-026).
- Downtime numbers (MRN, encounter, accession blocks) carry a site prefix (K §7.5); no identifiers outside pre-allocated blocks offline (SI-15).

## 6. Domain-event catalogue (R11 §14)

| Domain event | Emitter | HL7 v2 | FHIR | Consumers |
|---|---|---|---|---|
| PatientRegistered / Updated | Identity | ADT^A04/A08/A28/A31 | Patient create/update | EMPI, billing, lab, RIS, portal |
| PatientMerged / Unmerged | Identity | A40. **No standard unmerge trigger:** A37 only reverses A24. Use A47/A08 corrections or site-specific handling, agreed per interface | Patient.link | All downstream |
| AppointmentBooked / Rescheduled / Modified / Cancelled / NoShow | Scheduling | SIU^S12/S13/S14/S15/S26 | Appointment | Reminders, RIS, billing |
| PatientArrived / CheckedIn | Access | ADT^A04 or A10; SIU^S14 with filler status (not S12) | Encounter arrived (R4) / subjectStatus (R5/R6) | Queue, nursing |
| EncounterAdmitted | ADT | A01 | Encounter in-progress (IMP) | Bed mgmt, dietary, pharmacy, billing, LIS/RIS |
| PatientTransferred | ADT | A02 | Encounter.location | Bed mgmt, nursing, pharmacy |
| PatientDischarged | ADT | A03 | Encounter finished / discharged | Billing, EVS, portal, HIE |
| AdmissionCancelled / DischargeCancelled | ADT | A11 / A13 | Encounter status | All |
| OrderSigned / Modified / Discontinued | Orders | ORM^O01 (deprecated but common), OML^O21, OMG^O19, OMI^O23, OMP^O09, RDE^O11 | ServiceRequest / MedicationRequest | LIS, RIS, pharmacy, billing, CDS |
| MedicationVerified / Dispensed | Pharmacy | RDS^O13 | MedicationDispense | ADC, eMAR |
| MedicationAdministered / NotGiven | eMAR | RAS^O17 | MedicationAdministration | Billing, CDS, pump |
| SpecimenCollected / Received / Rejected | LIS | OML; SSU^U03; OUL^R22 | Specimen | LIS, nursing |
| ResultPreliminary / Final / Corrected | LIS/RIS | ORU^R01 | Observation / DiagnosticReport | Inbox, CDS, portal, HIE |
| CriticalResultCommunicated / Acknowledged | Results | ORU + ACK workflow | Communication / Task | Quality, audit |
| ImagingStudyAvailable | RIS/PACS | ORU/OMI; DICOM MPPS | ImagingStudy | Viewer, reporting |
| NoteSigned / Amended | Documentation | MDM^T02/T08 | Composition / DocumentReference | HIM, coding, HIE, portal |
| ChargeCreated / Credited | Charging | DFT^P03 (P11 from v2.5) | ChargeItem in R4/R5 only, else internal API | Billing, GL |
| ClaimSubmitted / Adjudicated | RCM | R11 lists X12 837/835 (US, dropped). **K:** document pack (PDF + structured summary) by email/portal (K §9.1) | Claim / ClaimResponse | AR, GL |
| BedStatusChanged | Bed mgmt | A20 | Location.operationalStatus (0116) | EVS, command centre |
| ConsentRecorded / Revoked | Consent | CON segment; no dedicated trigger (optional in MDM T01–T11, v2.7.1) | Consent | Data sharing, research |
| BreakTheGlassAccess | Security | — | AuditEvent | Privacy office |

**Other triggers:**
- Leave A21/A22; pending admit A14; pre-admit A05; bed swap A17 (R11 §14).
- Events are written atomically with the state change (outbox), published on the bus and translated by the integration layer (R11 §14).

**BP §7.6 additions** (no specific mapping given): `EncounterMoved`, `OrderVerified`, `MedicationAdministered/Overridden`, `SpecimenRejected`, `ResultAmended/Acknowledged`, `CriticalResultEscalated`, `ChargeGenerated`, `StaffAssignmentChanged`, `IdentityVerified`, `PaymentReconciled`; **`TaskOrphaned` is a first-class alarm**.

**K MVP message baseline:** ADT, OML/ORM, ORU, SIU, DFT, MDM, RDE/RDS/RAS, MFN, VXU, REF/RRI (K §9).

## 7. Safety invariants checklist (R11 §15)

SI cross-references are matched by text. BP §5.1 requires every R11 §15 item to map to a hazard-log ID and an acceptance test.

| # | R11 §15 item | SI / K note |
|---|---|---|
| 1 | **Positive ID:** two identifiers at every specimen collection, administration, transfusion and procedure; wristband barcodes encode a stable identifier | SI-01: never room/bed; name in patient's script + Latin; MRN + DOB (or approximate-DOB flag) |
| 2 | **Banner integrity:** allergies (NKA vs not assessed), code status, isolation, dated weight, critical flags; always visible and current | SI-16; trilingual names |
| 3 | **Weight/height provenance:** dosing weight measured/stated/estimated + date; weight-based doses reference the weight used | SI-05; fallback set until the P2 Dose Engine |
| 4 | **Order–result closure:** every order ends in a result, cancellation or explicit "not performed"; unacknowledged results escalate | SI-03, SI-17 |
| 5 | **Critical value loop:** documented communication within policy time, with read-back | SI-04; incl. external referrers |
| 6 | **Wrong-patient prevention:** one active patient context per window/session; retract-and-reorder metrics; photo in banner | SI-16: re-verify at signing if context changed <60 s |
| 7 | **Merge safety:** reversible; downstream notified; no silent re-attachment of results | SI-08; cross-script gold set |
| 8 | **Unit safety:** UCUM; no trailing zeros or naked decimals (ISMP); tall-man lettering for LASA | SI-05 family (BP §5.1); Western clinical digits (K §6.7) |
| 9 | **Time safety:** recorded vs effective; late-entry labels; DST handled for scheduled meds | SI-10 |
| 10 | **Downtime integrity:** back-entries flagged, with original paper times | SI-10; frequent back-entry, tooling sized (K §5.1) |
| 11 | **AI labelling:** AI-drafted content marked; human sign-off before entering the legal record | SI-07; from P2 |
| 12 | **Sensitive data segmentation:** labels respected in UI, API, exports, print and HIE | SI-21 restated (labels §3.10); never released by message |

## 8. Master data before go-live (R11 §16 in K form)

Shipped as validated, importable Migration Workbench templates, each with a named owner (BP §8). Kurdistan foundation content supplies ≥90% (K §8), combined with the hospital's own price lists, formulary, staff and services (K §13.5).

| # | Set (R11 source → owner) | Kurdistan form |
|---|---|---|
| 1 | Enterprise structure, departments, cost centres (customer → Ops/Finance) | Tenancy per ADR-006 |
| 2 | Users, roles, security classes, practitioner directory, privileges (HR/MSO → IAM/MSO) | K identifiers and privileges (§10) |
| 3 | Order catalogue with codes (customer + packs → content team) | Foundation catalogue; LOINC + local; SNOMED GPS |
| 4 | Lab definitions, ranges, specimen definitions, analyser maps (Lab → LIS team) | Foundation content |
| 5 | Imaging catalogue + modality map (Radiology → RIS team) | RIS in R1 |
| 6 | Drug database, formulary, dispensing locations (drug KB + Pharmacy → pharmacy informatics) | Regional brand master (§10) |
| 7 | Order sets, templates, flowsheets, questionnaires (packs + committees → CMIO/CNIO) | Trilingual forms; Sorani/Badini/Arabic patient templates |
| 8 | CDM, price lists, packages, contracts (Finance → revenue integrity) | Charge-master and package templates; IQD default, USD only where L-33 allows |
| 9 | Payer master, plan codes, TPA rules (Finance → patient access) | Insurers, corporates, NGOs: contract prices, eligibility letters, credit limits, co-pay (K §12.1) |
| 10 | Classifications (WHO/national → HIM) | WHO ICD-10; ICD-11 if adopted (§10) |
| 11 | Terminologies (licensors → terminology service) | Per the §10 terminology table |
| 12 | Item master, vendors, stores, par levels (supply chain → materials) | Several GTINs per orderable, scan-tested (K §8) |
| 13 | Interface endpoints and code maps (integration) | Kurdistan pack: identifier URIs, endpoints, consent rules, residency policy (K §9) |

**K additions:** exchange-rate table and cash-rounding unit (K §8); tenant calendars, configured by RG1 (K §6.7, §13.3); KRG return formats, notifiable-disease rules, birth/death forms (Q-K3: requested M6, in hand M12); doctor-fee rules (K §8); site-prefixed downtime blocks (K §7.5).

## 9. Build implications (R11 §17)

1. **FHIR R4 now, path to R5/R6.** Encounter status/subjectStatus, RequestOrchestration and the R6 dosage reorganisation must be mapping changes, not schema rewrites.
   - Never build on resources leaving R6 core: ChargeItem, ChargeItemDefinition, Invoice, InventoryItem, InventoryReport, SupplyRequest, SupplyDelivery, DeviceUsage, EncounterHistory, FormularyItem, Contract, InsurancePlan; also ClinicalImpression and MedicationKnowledge. Edge projections only.
   - R6 is in ballot, another ballot certain, publication expected 2027 (RL #13). K: R4, IPS `$summary`, R6 on demand (K §8); R11's national-IG examples do not apply.
2. **State-machine and invariant specs before any UI**: the safety case and test oracle (R11's DCB0129/IEC 62304 files: generic pattern). K gates in §4.
3. **Event catalogue as a product surface**: integration, analytics (CDC/lakehouse), command centre, AI triggers (P2 in K), audit.
4. **Enterprise hierarchy and scoped, versioned configuration first-class from day one**; retrofitting multi-facility support is among the costliest mistakes.
5. **Bitemporal, append-only clinical facts.** RL #7: ES-lite (current state + journal in one transaction; journal = outbox; CDC to lakehouse); full ES only for order/MAR, by ADR.
6. **Finance derives from clinical events.** Build the charge router early, "even for cash-only MVPs" (K §12); the charge/invoice model is ours.

## 10. Kurdistan-specific data rules (K §8 complete, plus linked K rules)

All items are K §8 unless marked.

**Identifiers:**
- Types: Iraqi Unified National Card no.; older civil ID; nationality certificate; Kurdistan residency card; passport (ICAO 9303 MRZ); UNHCR and IDP documents; hospital MRN with check digit [L].
- Captured from the document (barcode, MRZ, OCR), never the keyboard. Identity verification is recorded separately. No online verification is assumed: "verify later" (K §9.1).
- **Mobile number = contact data and a matching feature, not an identifier.**
- Merges are reversible links with the algorithm version.

**Names:**
- Parts: given, father, grandfather, family/tribal; the mother's full name is an identifying attribute.
- Scripts: Kurdish (Arabic script), Arabic, Latin; transliteration variants stored; display name per locale.
- Cross-script matching is added by KRI-ID-01; R11 specifies none [I].

**Birth date:** date + precision flag (exact / year only / estimated). Placeholder dates (1 Jan, 1 Jul) get low matching weight.

**Practitioners:**
- Typed identifiers: syndicate no. (doctors, pharmacists, nurses); KRG or federal MoH licence; boards (Kurdistan, Iraqi/ICMS, Arab, foreign).
- Per-hospital privileges; visiting-consultant flag.
- Performing and ordering practitioner on every charge.

**Money:**
- Decimal + ISO 4217 (IQD, USD); cash rounding per tenant (e.g. IQD 250); exchange rates effective-dated with source and timestamp.
- **Each payment** records tendered currency, amount, rate and change given (possibly in the other currency).
- Ledger in the functional currency; originals kept; FX differences to the GL export. IQD price lists by default; USD prices, deposits, contracts only where L-33 allows.
- Per-currency drawers with denomination counts and shift close; deposits held in the tendered currency (K §12.1); opening balances reconciled to the dinar (K §13.5).

**Doctor-fee ledger:** payable sub-ledger per practitioner; percentage, fixed or package-share rules; settlement cycles and statements; **never payroll**; exported to AP. Surgeon, anaesthetist and consultant fees are separate charge lines; no referral-commission feature (K §12.1).

**Statutory registers:** see §3.11. **Unchanged:** Encounter, Bed, Order, Medication, Specimen, Result, Note, Account, Item, Consent and Audit follow BP §8 and R11.

**EMPI:**
- **Matching:** Fellegi–Sunter + document-number shortcut; Kurdish/Arabic normalisation (ي/ی, ك/ک, ه/ە, alef forms, taa marbuta); transliteration dictionaries (Muhammad/Mohammed/Mihemed); higher weight on father's, grandfather's and mother's names and DOB precision (weighting [I], tuned in S14-K).
- **Special identities:** alias pools for trauma, MCI, downtime; "Baby of [mother]" (cut NICU wrong-patient orders 36.3%, R03 §3.1).
- **Tests:** dirty synthetic data (01-01 DOBs, shared family phones, mixed-script duplicates).
- **Cutover:** duplicates <1%; zero overlays; ≥99.9% auto-merge precision on a 2,000-pair cross-script gold set.

**Terminology** (Q-K9):

| Code system | K position |
|---|---|
| ICD-10 | WHO base version; commercial use needs WHO permission |
| ICD-11 | Dual coding if the KRG adopts it |
| LOINC (LIVD-seeded), UCUM | Free |
| ATC | WHOCC licence |
| SNOMED CT | MLDS affiliate licence. **Default:** Global Patient Set (free, English, no hierarchy) for exchange, local codes otherwise; licence only when CDS subsumption, a partner or export needs it |

Every coded element keeps local code, standard code, display, original text and version. On-site cells get terminology and drug-KB snapshots (K ADR-015).

**Drug coding:**
- No national drug file.
- The **regional brand master** maps brand → clinical drug → generic + ATC → package GTINs → lot, plus the drug-KB concept.
- Several GTINs per orderable; new products scan-tested; unmapped formulary ≤5% at T-90.

**FHIR:** R4, IPS `$summary`, R6 on demand; finance, supply and formulary stay internal.

**Display** (K §6.7, §4.3): Western digits for clinical numerals; drug names and units in Latin script.

## 11. Conflicts, ambiguities and drops

**Conflicts and ambiguities:**
- **Settled by RL:** storage posture (R02 vs R11/R06/R08 → RL #1); event sourcing (R11 §17 #5 vs R08 → RL #7); FHIR finance (R05/R02 vs R11/R06 → RL #2).
- **Charge provider:** R05 §7 vs R11 §11 (department only); K §8 puts both practitioners on every charge.
- **R6 timing:** BP §8 plans an R6 beta by M24; K §8 says "on demand". K governs.
- **Specimen chain:** R11 §10.4 is fuller than BP §8; use R11.
- **Event names:** R11 `ChargeCreated`/`PatientTransferred` vs BP §7.6 `ChargeGenerated`/`EncounterMoved`; unreconciled.
- **Diagnosis rank:** R11 §5 keeps it for DRG; K §12.1 has no grouper; K §8 keeps Encounter "as BP".
- **Practitioner IDs:** K §4.3 "Kurdistan Medical Syndicate or Iraqi Medical Association registration" vs the K §8 list; wording variance.
- **Unspecified:** MAR direct transitions (§4.3); specimen-reject source (§4.4); bed blocked/closed paths (§4.6); claim close after paid adjudication (§4.8). Most actors are unnamed; named: triage nurse, requester/co-signer, pharmacist, collector, performer/witness, bed manager/EVS, reviewer, desk.

**Dropped (Kurdistan deltas):** EID, Iqama, ABHA, Aadhaar, Hijri DOB from card; HPR/SCFHS/PRN/DoH-DHA IDs; ABDM ImmunizationRecord; India HFR; Form F, MTP, NDPS, Schedule H1/X, BMW, CRS registers; X12, CARC/RARC, NPHIES, NHCX, PM-JAY, Da Vinci PAS, UPI, GST/VAT specifics, DRG, US POA; CPT, ICD-10-PCS, OPCS-4, RxNorm, NDC, dm+d, SBS, SFDA, DDC, IHACPA; PCPNDT/MTP label rules. Dose Engine, stewardship module and AI products move to P2.
