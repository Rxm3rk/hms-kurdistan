
---

## 8. The canonical data model

R11 is the specification: **patient-centric, encounter-anchored, order-driven.** FHIR is the vocabulary and the external contract, never the storage schema. Every fact records who, what, when (effective vs recorded), where, why, how sure and from where. Finance is a projection of clinical activity. Domain events map 1:1 to interoperability triggers (R11 §0; BP §8; K §8). Read: R11 in full before WP-0.4; K §8.

### 8.1 Modelling principles (R11 §1)

| # | Principle |
|---|---|
| P1 | Patient-centric, encounter-anchored: every clinical record has a subject and, where it applies, an encounter. Problems, allergies and home medicines are patient-level |
| P2 | Clinical time ≠ system time: store effective, recorded/authored and transaction time; display effective, audit both |
| P3 | Immutable history: updates are versions; entered-in-error replaces delete; merges are links; the "as-was" view is reconstructible |
| P4 | Explicit status with an allowed-transition table per record type |
| P5 | Coded plus text: {local code, standard code(s), display, original text, code-system version}, value-set bound per field |
| P6 | UCUM units everywhere; an explicit, versioned dosing weight; conversions only through the terminology service |
| P7 | Namespaced identifiers `{system, value, type, period, assigner}`, unique per system |
| P8 | Provenance everywhere (user, device, interface, AI model, patient); AI content labelled until a human verifies it |
| P9 | Configuration is versioned, scoped to a node of the enterprise tree, inherited downward and promoted through environments |
| P10 | Instants in UTC with the facility time zone; date of birth is a date without a zone; local-calendar rendering (Gregorian; Hijri display optional) |
| P11 | Safety invariants live in the domain layer, for every channel |
| P12 | Privacy labels on records; access = role + care relationship + labels + consent |

### 8.2 Aggregate catalogue (owning module in brackets)

Physical, organisational and financial hierarchies stay separate but cross-referenced: a ward sits physically in a building, organisationally in a department and financially in a cost centre (R11 §2).

| Area | Aggregates and key attributes |
|---|---|
| **Enterprise** (`platform-tenancy`) | Tenant (residency, deployment, licensing, locale pack, keys); Organization (legal entity, department, payer, referring organisation); Location tree facility → building → floor → unit → room → bed (operational status, gender restriction, isolation capability, telemetry, level of care, cost centre); HealthcareService (specialty, hours, referral method, eligibility); cost centre; store |
| **Identity** (`empi`, `workforce`, `trust-identity`) | Patient (identifier list, names in several scripts with parts and use, sex and gender fields, birth date with precision flag, deceased, contacts, language and interpreter flag, photo, links); match candidate (score, algorithm version, status, reviewer); merge link (survivor, replaced-by, algorithm version; reversible); newborn link; RelatedPerson (next of kin, guardian, proxy, guarantor); Person (links one human's patient and staff records, for employee-as-patient rules); Practitioner and PractitionerRole (typed identifiers, privileges per hospital, visiting-consultant flag); CareTeam; user account (never conflated with practitioner); employee |
| **Access and flow** (`scheduling`, `adt`) | Schedule; Slot; Appointment and responses; referral (ServiceRequest with from/to, urgency, reason, attachments, authorisation status); waitlist entry; **OPD queue token** (number, service point, status waiting/called/in-service/done/skipped, call count, estimated wait); surgical case request; EpisodeOfCare; **Encounter** (class AMB/EMER/IMP/OBSENC/SS/VR, status and class history, participants, diagnoses with role and rank, hospitalisation details, **location history = the single source for census, patient-days and bed charges**); ADT event log; triage record; leave; bed with one authority and an exclusion constraint against double occupancy |
| **Clinical record** (`record`, `nursing`) | Problem (clinical and verification status); encounter diagnosis; allergy/intolerance ("NKA" is an explicit assertion distinct from "not assessed"); vital signs and flowsheet rows (LOINC, UCUM, method, device, validated-by-nurse flag); scores (components, total, calculation version); forms (QuestionnaireResponse-shaped); clinical note (type, authors, status, attestation, addenda, per-segment source attribution typed/dictated/copied/AI, hashed rendering at signature); procedure; care plan and goals; immunisation (vaccine, lot from stores, expiry, site, route, dose number, performer, consent); flags (fall risk, isolation, code status, violence risk, carrier status, VIP, interpreter); advance directive and code status (own model, banner-visible) |
| **Orders and tasks** (`orders`, `platform-tasks`) | One aggregate holds the request, its tasks and its status history: placer and filler identifiers, basedOn/replaces, group identifier for order sets, status, intent, priority, code and details, timing, as-needed, requester and on-behalf-of (verbal orders: read-back flag and co-sign due time), performer, reason, supporting info. Order kinds: lab, imaging, procedure, nursing, therapy, consult, referral, medication, diet, device, blood, ADT, order set. Every fulfilment step is a Task; worklists are read models over open tasks |
| **Diagnostics** (`lis`, `ris`, `results`, `transfusion`) | Specimen (accession, barcode, type, container, collection details, condition, parent for aliquots, logistics state); result (LOINC, value, UCUM, versioned reference range, interpretation, method, analyser, performer, status); report; imaging study (Study Instance UID, accession, modality, DICOMweb endpoint); critical-result communication (Communication + Task: recipient, time, read-back, escalation); blood unit (unit number, product, ABO/Rh, expiry, status, location, relabel record); transfusion (witnesses, vitals, reactions). Microbiology (P2) is hierarchical: specimen → isolate → susceptibility panel; never flattened |
| **Medications** (`medications`) | Medication product (regional brand master codes, form, ingredients with UCUM strength, manufacturer, lot/expiry, high-alert, LASA, controlled schedule); formulary item; **MedicationOrder with its own dose model** (independent of FHIR `Dosage`; dosing weight/height and renal function used; Dose Engine calculation ID from P2); pharmacist verification (Task + Provenance, interventions); transcribed paper order (R2a: image, transcribing pharmacist, ordering practitioner; never a MAR); dispense (quantity, lot, location, prepared-by, checked-by); **administration** (status and reason, time, dose and rate, route and site, performer, barcode evidence or override reason, witness, pump, order link); patient-supplied medicine; home medicines; medication reconciliation (decision per item, reason, who, when) |
| **Finance** (`rcm`) | All internal aggregates (§9.20): guarantor, account, ledger, charge, tariff, package, deposit, estimate, invoice, pre-approval, credit claim, payment, adjustment, `Money`, exchange rate, cashier drawer and shift, doctor-fee ledger |
| **Supply, assets, workforce** (`supply`, `workforce`) | Item master; stock and lot; requisition and transfer; PO, GRN and vendor invoice; implant/device instance (UDI DI+PI, recall status); biomedical asset (P2); roster (P2); credential and privilege. Internal aggregates, because these resources leave FHIR R6 core |
| **Cross-cutting** (Trust Plane, kernel) | AuditEvent (every read, write, print, export, break-the-glass); Provenance (including AI agent and model version); Consent; sensitivity label; Task; Communication; List; Binary/DocumentReference (object storage plus hash); terminology and definitional content (versioned, promotable); topic subscriptions; device metrics; release-of-information request |
| **Statutory** (`statutory`) | Register entries (locked, append-only, corrections as addenda): MLC with police-notification timestamps, narcotics, births, deaths with ICD-10 cause, notifiable diseases; KRG return and DHIS2 data-value sets |

### 8.3 Storage shapes and identifiers

As §5.3: relational aggregates (A), immutable bitemporal facts (B), the journal-as-outbox (C), rebuildable read models (D). UUIDv7 identifiers; UTC instants with the original offset; `tenant_id` and `facility_id` on every row; site-prefixed downtime number blocks; migrated data carries `migrated` provenance with its original times. Back-dating is privileged and audited; back-entry keeps valid time = paper time.

### 8.4 State machines

Write each machine as an executable YAML spec (Appendix B.3) and generate property-test models from it **before any UI**. Guards are lists of named predicates (for example `[activeVerifiedOrder, twoIdentifiersConfirmed, productScanMatches]`); each predicate is implemented once in the module's domain package and unit-tested, prose goes in a `description` field, and the generator fails on an unknown predicate. Each machine has an owner module and an approval gate [HUMAN]. Where R11 leaves a transition undrawn (noted below), propose the transition, mark it "proposed", and put it to the approving panel.

**Encounter** (approval: nurse panel + HIM + CSO):

| From | Command | Guard / effect | To |
|---|---|---|---|
| (start) | Pre-admit / schedule | — | planned |
| planned | Arrive | — | arrived |
| planned | Cancel | — | cancelled |
| arrived | Triage | Triage record (scale, complaint, vitals, time) | triaged |
| arrived, triaged | Admit to bed | No bed allocation offline (SI-15); no deposit rule blocks ED registration or emergency orders (SI-12) | in-progress |
| in-progress | Transfer / swap bed | Appends a location-history period | in-progress |
| in-progress | Leave → return | — | on-leave → in-progress |
| in-progress | Discharge | Never blocked by bill, deposit or pre-approval (SI-12); pending results routed to owned queues (SI-17) | discharged-not-closed |
| discharged-not-closed | Administrative close (coding and charging done) | — | finished |
| finished | Cancel discharge | Audited | in-progress |
| in-progress | Cancel admission | Audited | entered-in-error |

**Order** (approval: pharmacist and nurse panel + CSO):

| From | Command | Guard / effect | To |
|---|---|---|---|
| (start) | Save unsigned; cutover pre-build "pending prescriber signature" | — | draft |
| draft | Sign | Privileges (§9.26); identity re-verified if the context changed <60 s ago (SI-16); CDS checks; co-sign rules; verbal orders carry read-back and a co-sign due time and are refused for antineoplastics; restricted antimicrobials need indication and approver | active (medication: pending-verification) |
| draft | Discard | — | revoked |
| active: pending-verification | Pharmacist verifies | Control set A where it applies; emergency/first-dose override path with review ≤4 h | active: verified |
| active | Hold / resume | — | on-hold ↔ active |
| active | Fulfilled / result final | — | completed |
| active | Discontinue | Reason required | revoked |
| active | Mark error | — | entered-in-error |

Every order reaches completed, revoked or entered-in-error (SI-03). A modification is a new request that `replaces` the old one.

**Medication administration, per scheduled dose** (approval: pharmacist and nurse panel + CSO):

| From | Command | Guard / effect | To |
|---|---|---|---|
| (start) | Dose falls due | Late-dose windows configurable; tighter for time-critical drugs | scheduled |
| scheduled | Start / give | Active verified order or documented override with a non-defaulted reason (SI-02); wristband scan with two identifiers (SI-01); product scan within tolerance, else stop with reason; high-alert independent double check (SI-13); unverified patient-supplied product unscannable (SI-12); offline only for orders verified before the outage (SI-15) | in-progress (infusions) or completed |
| in-progress | Complete | — | completed |
| scheduled, in-progress | Not done (held, refused, missed, NPO, off unit) | Reason required | not-done |
| in-progress | Stop | — | stopped |
| any | Mark error | Audited | entered-in-error |

R11 draws only the outcomes after in-progress; the direct scheduled → completed and scheduled → not-done transitions above are proposed and need approval.

**Specimen** (approval: lab CSO): ordered → label printed → collected (collector, time, scanned wristband) → in transit → received → in process → resulted → stored or disposed. Rejected (unlabelled, haemolysed, insufficient, wrong container, expired stability) → recollection task. R11 does not say which states can reject; propose: received and in process.

**Result** (approval: lab CSO + physician panel): registered → preliminary → final → amended or corrected; cancelled; entered-in-error. Every correction notifies the orderer and everyone who acknowledged the earlier version. Final requires technologist validation until autoverification is active.

**Bed** (approval: nurse panel + bed manager): available → reserved/assigned (not offline) → occupied (exclusion constraint) → dirty → cleaning → available; side states blocked (isolation, contamination, maintenance, staffing; reason required) and closed. Every change emits ADT^A20, projected to HL7 table 0116 codes. Entry and exit paths for blocked and closed are proposed for approval.

**Appointment** (approval: OPD panel): proposed → pending → booked → checked-in/arrived → fulfilled; cancelled (by whom, why, late-cancel flag); no-show; waitlist (constraints, priority, auto-offer); reschedule and modify as their own events.

**Credit claim and pre-approval** (approval: RCM lead + Kurdistan pack PM): §9.23.

**Other lifecycles to specify the same way:**
- *Identity:* match candidate possible → confirmed-same / confirmed-different (reviewer); merge → unmerge (restores). Never offline; overlays are safety incidents; results are never silently re-attached.
- *Clinical note:* preliminary → final (signed, rendering hashed) → amended (new version with reason); addendum as a linked note; retraction → entered-in-error with reason; `draft-ai` until signed (P2).
- *Blood unit:* received → blind double entry → relabelled → stored → issued → bedside-verified → transfused, or quarantined (mismatch or temperature excursion), or returned → final disposition.
- *Patient-supplied medicine:* received → identified → expiry-checked → relabelled and flagged → administrable.
- *Medication reconciliation:* each item continue / modify / hold / stop / new with reason; completion blocked while any item is undecided.
- *Critical result:* flagged → named recipient → read-back → acknowledged, otherwise escalated (`CriticalResultEscalated`).
- *Referral:* created → owned queue → appointment or admission → acknowledgement → closure letter.
- *Task:* open → claimed → done / cancelled, with SLA timers, escalation and `TaskOrphaned`.

### 8.5 Domain-event catalogue (R11 §14; BP §7.6)

| Event | HL7 v2 | FHIR |
|---|---|---|
| PatientRegistered / Updated | ADT^A04 / A08 / A28 / A31 | Patient |
| PatientMerged / Unmerged | A40; there is no standard unmerge trigger (agree A47/A08 corrections per interface) | Patient.link |
| AppointmentBooked / Rescheduled / Modified / Cancelled / NoShow | SIU^S12 / S13 / S14 / S15 / S26 | Appointment |
| PatientArrived / CheckedIn | ADT^A04 or A10; SIU^S14 | Encounter |
| EncounterAdmitted / PatientTransferred / PatientDischarged | A01 / A02 / A03 | Encounter |
| AdmissionCancelled / DischargeCancelled | A11 / A13 | Encounter |
| Leave / return; pending admit; pre-admit; bed swap | A21 / A22; A14; A05; A17 | Encounter |
| OrderSigned / Modified / Discontinued | OML^O21, OMI^O23, OMG^O19, ORM^O01 (legacy), RDE^O11 | ServiceRequest / MedicationRequest |
| MedicationVerified / Dispensed | RDS^O13 | MedicationDispense |
| MedicationAdministered / NotGiven / Overridden | RAS^O17 | MedicationAdministration |
| SpecimenCollected / Received / Rejected | OML; SSU^U03; OUL^R22 | Specimen |
| ResultPreliminary / Final / Corrected; ResultAcknowledged | ORU^R01 | Observation / DiagnosticReport |
| CriticalResultCommunicated / Acknowledged / Escalated | ORU + ACK workflow | Communication / Task |
| ImagingStudyAvailable | ORU/OMI; DICOM MPPS | ImagingStudy |
| NoteSigned / Amended | MDM^T02 / T08 | Composition / DocumentReference |
| ChargeCreated / Credited | DFT^P03 / P11 | Internal API (finance resources leave R6 core) |
| ClaimSubmitted / Adjudicated | Document pack (no X12) | Claim / ClaimResponse where an insurer accepts FHIR |
| BedStatusChanged | A20 | Location.operationalStatus |
| ConsentRecorded / Revoked | CON segment | Consent |
| BreakTheGlassAccess | — | AuditEvent |
| ImmunizationRecorded | VXU^V04 | Immunization |
| ReferralSent / Accepted | REF / RRI | ServiceRequest |
| StaffAssignmentChanged; IdentityVerified; PaymentReconciled | — | Internal |
| **TaskOrphaned** | — | First-class alarm |

Canonical names follow R11 §14. BP §7.6 uses `ChargeGenerated` and `EncounterMoved` for `ChargeCreated` and `PatientTransferred`: treat those as aliases, never as separate events. Events are written atomically with the state change and published through the outbox; the Hub translates them.

### 8.6 Master data required before go-live (R11 §16, Kurdistan form)

Each ships as a validated, importable template in the Migration Workbench with a named owner. Kurdistan foundation content supplies ≥90% of it; the hospital adds its own price lists, formulary, staff and services.

1. Enterprise structure, departments, cost centres.
2. Users, roles, security classes, the practitioner directory and privileges (Kurdistan identifiers).
3. Order catalogue with codes (LOINC and local; SNOMED Global Patient Set where useful).
4. Lab definitions, reference ranges, specimen definitions, analyser maps.
5. Imaging catalogue and modality map.
6. Formulary, dispensing locations and the regional brand master, linked to the licensed drug KB.
7. Order sets, templates, flowsheets and forms (trilingual; patient templates in Sorani, Badini and Arabic).
8. Charge master, price lists, packages and contracts (IQD by default).
9. Payer master: insurers, corporates and NGOs with contract prices, eligibility letters, credit limits and co-pay.
10. Classifications: WHO ICD-10 (ICD-11 if adopted).
11. Terminologies (§8.7).
12. Item master, vendors, stores and par levels (several GTINs per orderable, scan-tested).
13. Interface endpoints and code maps (the Kurdistan pack: identifier URIs, endpoints, consent rules, residency policy).

Kurdistan additions: the exchange-rate table and cash-rounding unit; tenant calendars and holidays; KRG return formats, notifiable-disease rules and birth and death forms (when supplied); doctor-fee rules; site-prefixed downtime number blocks.

### 8.7 Terminology and coding (K ADR-015; Q-K9)

| Code system | Position |
|---|---|
| ICD-10 | WHO base version, for insurers and statistics; commercial use needs WHO permission [HUMAN] |
| ICD-11 | Dual coding if the KRG adopts it (free) |
| LOINC (seeded via LIVD), UCUM | Free; used throughout |
| ATC | Electronic files need a WHOCC licence [HUMAN] |
| SNOMED CT | Iraq is probably not a member [L]; an affiliate licence is priced on request. Default: the free Global Patient Set for coded exchange, local codes for the rest, and a licence only when CDS subsumption, a partner or an export market needs it |
| Drugs | No national drug file [L]: the regional brand master (§9.10) plus the licensed drug-KB concepts |

Every coded element keeps the local code, standard code, display, original text and code-system version; retrofitting this is "ruinous" (R06 §8). Code sets are versioned by date of service as data. On-site cells receive terminology and drug-KB snapshots.

### 8.8 FHIR projection policy

FHIR R4 (4.0.1) is the contract now: IPA, SMART App Launch 2.2, Bulk `$export`, topic-based Subscriptions (backport), and IPS `$summary` from day one. R6 is a second projection added on demand, with no storage migration (ADR-005; spike C5). Never build anything canonical on resources leaving R6 core (ChargeItem, ChargeItemDefinition, Invoice, InventoryItem, SupplyRequest, SupplyDelivery, DeviceUsage, FormularyItem, Contract, InsurancePlan, ClinicalImpression, MedicationKnowledge); they are edge projections at most. Bounded FHIR writes become domain commands.
