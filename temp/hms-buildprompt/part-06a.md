
---

## 12. Integration and interoperability

The native Integration Hub owns every interface; it runs inside each cell, with central adapters at the central site (ADR-014; K §9). R06: "An HMS without a strong v2/MLLP engine cannot be sold anywhere." Read: R06 §3, §7, §8; R16 §2, §4–§10, §12, §14; K §9.

### 12.1 Channel operations (every channel, no exceptions)

- An owner, visible acknowledgement state, an owned dead-letter queue that alarms at 5 minutes, and a replay console. **Zero silent drops** (the VA failure sent >11,000 orders to an unknown queue).
- Store-and-forward with ordered replay and idempotency keys; per-patient ordering (A08 never overtakes A01); message-level audit retention.
- War-room dashboards for go-lives: queue age, unacknowledged messages, error rates per channel.
- Optional customer engines (Eclipse OIE or the hospital's own) are allowed for site transforms only, under a patch-lag policy. No hard dependency on Mirth Connect or any cloud-only FHIR service.

### 12.2 HL7 v2 engine (`INT-ENG-01`, R1)

- Accept 2.3–2.8 as dialects with one conformance profile per interface; tolerate Z-segments.
- Original (AA/AE/AR) and enhanced (CA/CE/CR via MSH-15/16) acknowledgements; MLLP over TLS across network zones; MSH-10 idempotency.
- v2-to-FHIR mappings follow the HL7 v2-to-FHIR IG only, never private mappings.
- **MVP message baseline:** ADT (A01–A08, A11–A13, A21–A27, A28/A31, A40/A47, A60), orders (ORM^O01, OML^O21/O33/O35, OMG^O19, OMI^O23 with ORL/ORG/ORI), results (ORU^R01, OUL^R22), scheduling (SIU^S12–S26), charges (DFT^P03/P11), documents (MDM^T01–T11), pharmacy (RDE^O11, RDS^O13, RAS^O17, RGV^O15), immunisation (VXU^V04), master files (MFN), referrals (REF/RRI), PIX/PDQ queries (QBP/RSP).

### 12.3 FHIR façade (`INT-FHIR-01`; read API in R1, SMART/Bulk/Subscriptions in R1.1)

- A projection service keeps a materialised R4 store for read and search, `$export`, `$summary`, `$docref` and Subscriptions. It is generated from domain events (constitution rule 4).
- Writes are accepted only for Appointment, QuestionnaireResponse, DocumentReference, device/patient Observation, Consent and Task, and each becomes a domain command; nothing writes into the projection directly.
- **Profiles:** IPA 1.1 as the default patient-access API; SMART App Launch 2.2 (`.well-known/smart-configuration`, EHR and standalone launch, v2 scopes, `private_key_jwt`, PKCE S256 only, Backend Services, token introspection); Bulk Data `$export` (system, Patient, Group) as async NDJSON; topic-based Subscriptions through the R5 backport; **IPS 2.0.1 `$summary` from day one** (`INT-IPS-01`, R1).
- REST features: conditional create and update for idempotent interfaces, history, batch/transaction, chaining, `_include`/`_revinclude`, `_has`, `$everything`, `$validate`, `$match`.
- Pin IG versions and validate in CI with the HL7 validator. Several FHIR versions can run side by side (R4 now, R6 when needed); skip R4B and R5 as server targets.
- CDS Hooks 2.0.1 for third-party CDS and FHIRcast 3.0.0 for context sync are P2.

### 12.4 Documents (`INT-DOC-01`, R1)

PDF/A and FHIR documents generated from one source; recent paper charts scanned to PDF/A with document references (§9.32); every document carries its provenance and, once signed, a hash.

### 12.5 Imaging, laboratory and device standards

- **Imaging:** DICOM MWL (C-FIND) provider, MPPS receiver, Storage Commitment, DICOMweb client (QIDO-RS, WADO-RS, STOW-RS), IHE IID launch, OMI/ORU with the RIS; plan for IHE SWF.b, PIR and IOCM. The imaging tier is integrated: dcm4chee or an unmodified Orthanc container, with the OHIF viewer labelled non-diagnostic.
- **Laboratory:** analysers through vendor middleware (ASTM/CLSI LIS01-A2/LIS02-A2 for legacy; IHE LAW / CLSI AUTO16 as the target, query mode); LOINC orders and results, UCUM units; manufacturer LIVD files imported to seed analyser maps; reference-lab send-outs over HL7 v2 or FHIR with PDF fallback.
- **Devices:** gateway ORU^R01 under IHE DEC PCD-01, coded in IEEE 11073-10101; IHE ACM, PIV and IPEC in P2; SDC/SDPi on the roadmap only.

### 12.6 Identity, audit and consent interfaces

- EMPI exposes PIX/PDQ (v2) and PIXm/PDQm and `$match` (FHIR) with match grades, and emits A40/A47 and FHIR `Patient.link` events.
- ATNA (TLS syslog, node authentication) and BALP AuditEvents; Provenance for authors, devices and AI agents.
- Consent as FHIR Consent with purpose-of-use and security labels.
- There is no national exchange to connect to in Kurdistan [L]. Follow R06's no-regret path: IPS everywhere, an OpenHIE-style point-of-service posture, and a thin Kurdistan pack that holds identifier URIs, endpoints, consent rules and residency policy.

### 12.7 The Kurdistan pack interfaces (K §9.1)

| Partner [L] | Interface | Release |
|---|---|---|
| KRG Ministry of Health | Statistical returns from the indicator catalogue (formats as configuration, Q-K3) | R1 outpatient; R2a inpatient |
| Directorate of Health surveillance | Notifiable diseases from LIS results and diagnoses; WHONET/GLASS export with microbiology | R1; P2 |
| DHIS2, if the KRG uses it | Data-value sets through the DHIS2 Web API (`KRI-STAT-02`) | R1.1 |
| Civil registration | Birth and death notifications; death certificate with ICD-10 cause in the WHO format | R2a |
| Police | MLC register with notification timestamps (locked) | R2a |
| Insurers, corporates, NGOs | Pre-approval and claims by document pack (PDF plus structured summary) over email or portal; FHIR Claim where an insurer can take it | R1; automation R1.1 |
| Card acquirers and wallets | Semi-integrated terminals; wallet and QR payment links; settlement files for three-way reconciliation | R1; wallet links R1.1 |
| Messaging | WhatsApp Business, Viber, local SMS gateways; a per-site GSM/SMPP gateway for shutdowns | R1 |
| Identity documents | National card barcode/OCR, residency card, passport MRZ; no online verification ("verify later") | R1 |
| Public blood banks | Paper or label issue; units relabelled at receipt; optional inbound adapter (`DX-BB-02`) only if a bank ever supports one | R2b |
| Reference laboratories | HL7 v2 or FHIR send-outs, PDF fallback | R1 |
| Hospital accounting software | Daily summarised GL journals (CSV or API) with drill-back; never line-level | R1 |
| Iraq federal pack | Federal Ministry returns; federal health insurance scheme adapter | P2 |

### 12.8 Facility, peripheral and hardware integration (R16; K §9.2)

**Three planes; each integration lives in the lowest plane that meets its downtime need** (ADR-011). Wristband printing is never cloud-only.

| Plane | Runs on | MVP | P2 | Never |
|---|---|---|---|---|
| **A. Workstation shell (Tauri HAL)** | Each PC, kiosk or thin client | Silent wristband and label printing rendered per printer DPI with Sorani/Arabic shaping (`^PA`, `^CI28`) or `^GF` raster fallback, golden-image tests; HID-POS scanners preserving GS1 FNC1/GS; document scanning (TWAIN/WIA) into DocumentReference; camera; ID-card barcode and passport MRZ readers; badge tap-to-switch ≤2 s; on-glass signature | Signature pads | — |
| **B. On-site cell (hospitals) or site edge agent (outpatient tier)** | The cell, or a hardened appliance | Queue state; ESC/POS token printers; RTL HTML signage; print spool; analyser and monitor bridge via middleware; semi-integrated card terminals; one VLAN per device class; building signals (mains, generator, UPS); fridge-temperature excursions quarantining blood units and vaccine lots; the per-site GSM/SMPP SMS gateway | IHE ACM consumer; RTLS ingestion | Pneumatic tube |
| **C. Central adapters** | Central site | WhatsApp, Viber and SMS under the report-release rule (§9.30); wallet payment links; KRG returns; DHIS2 | IVR (same release rule) | Alarm, nurse-call or RTLS engines |

**The HAL contract** (a versioned bridge; every call returns a typed result and an audit ID): `hal.print.label / raw / document()`, `hal.scan.onBarcode / document()`, `hal.id.read({type})`, `hal.auth.onBadge()`, `hal.sign.capture()`, `hal.pay.request()`, `hal.camera.photo()`, `hal.kiosk.lock()`, and `hal.capabilities()`, which reports the devices attached, healthy and permitted for this workstation profile and user. Drivers are signed plugins that load only if signature and policy allow. The shell caches templates, the unit's wristband queue and downtime accounts, and can print to USB with no network. With no shell present, the UI degrades to the site print service.

**Canonical events:** `StaffAssignmentChanged` (feeds nurse call and communications platforms), `AlertAcknowledged` from ACM platforms (P2), `EnvironmentExcursion`, `DeviceStatusChanged`, `TokenIssued / Called / Served / Recalled`, `IdentityVerified`, `PaymentCaptured / Refunded / Failed`, `PrintJobCompleted / Failed` (with template version).

**Rules** (R16 §17; K §9.2):
- No card PAN ever touches the HMS; three-way reconciliation of receipts, terminal batches and acquirer or wallet files.
- Care-team assignment is a core domain and feeds nurse call. The HMS feeds ADT and staff assignment to nurse-call and ACM platforms and consumes their acknowledgements, but **is never in the primary alarm path**.
- `IdentityVerified {method, assurance level, source, timestamp, operator, evidence hash, result}` is stored as provenance, separate from the identity record. Lookups never block registration. Raw biometrics are never stored.
- Wristbands carry ≥2 identifiers and a barcode (DataMatrix with MRN and encounter); newborn names are never truncated; the first band after any template or printer change is scan-verified.
- Badge tap goes reader → shell → Keycloak step-up bound to the workstation certificate → session swap in <2 s; co-signature, controlled drugs and break-the-glass need tap plus PIN.
- Building-system data is context only (isolation-room pressure loss blocks bed assignment; med-gas alarms show a unit banner); the HMS is never the annunciator.
- A **Kurdistan Supported Hardware List** with in-country service from a hardware partner; messaging passed through at cost plus a capped margin.

**Peripheral downtime behaviour** (R16 §12, read through K §7.9): wristband and label printing must work from the cell or edge cache, and from the shell's USB fallback if the edge is down; local ID reads keep working; BCMA uses its time-bounded offline cache; messaging queues (never time-critical alerts); terminals run standalone into the reconciliation queue; online ID lookups never block registration; fridge quarantine back-dates on reconnect. Encode this matrix in the hazard log and test every degraded mode before go-live.

**Acceptance (minimum, §12):** conformance profiles exist and pass for every MVP message type; a chaos test that drops a downstream system raises the dead-letter alarm within 5 minutes and replays in order with no duplicates; FHIR projections pass the validator for every exposed profile; `$summary` produces a valid IPS for a synthetic inpatient; golden-image print tests pass for Sorani, Arabic and English wristbands on every printer model on the Supported Hardware List.
