# Digest 01: the Kurdistan backlog of record

**Sources read in full:** R14 (§1–§11 and Appendix A, 214 rows); BP §4.1–§4.3; K §4.1–§4.3. Other K sections are cited only where they place or qualify a feature. **Lineage:** R14 Appendix A → BP §4.1 amendments (222 IDs) → K §4.1 amendments. K inherits BP wherever K §4.1 records no change.

## 1. Conventions

**ID format.** `DOMAIN-EPIC-NN`, for example `MED-BCM-01` (R14 §3). BP splits add a/b suffixes (DX-BB-03 → 03a/03b; AI-DAT-02 → 02a/02b). K-new items use the KRI prefix, embed "KRI" (MED-KRI-01, DX-BB-KRI-01), or sit under PLT (PLT-SITE-01, PLT-PWR-01).

**Domain codes, with epic codes** (R14 §3; Appendix A `epic` column):
- **PLT** Platform/NFR: CORE clinical fact platform, CFG configuration, UX, OPS deployment; EDGE (BP); SITE, PWR (K).
- **TRU** Trust plane, security, downtime: IAM, PRV privacy, AUD audit, KEY keys, SEC secure SDLC and attestations, BCP downtime, REG regulatory.
- **ACC** Patient access: ID, REG/ADT registration and ADT, SCH scheduling, OPD flow, TRF patient flow.
- **CLN** Clinical core: CHT chart, ORD CPOE, CDS, DOC documentation, MRC/HND transitions, RES results, ED, BH/ACP safety content, IPC infection control, AMS stewardship, INC/QI quality; IMM (BP).
- **NUR** Nursing: FLW/WND documentation, CP care planning, STF staffing.
- **MED** Medication: PHV/FRM/DSP/OPP/ADC/CS pharmacy, MAR/BCM/INF administration, ONC/IV specialty meds, ERX e-prescribing; DOSE, TNT (BP); KRI (K).
- **DX** Diagnostics: ORD/CRT shared, LAB/MIC/AP/POC LIS, RIS, PAC/CRD imaging, BB transfusion (BB-KRI, K).
- **DEV** Devices: GW/VAL/SDC integration, ALM alarms.
- **SPC** Specialty: OT/AN perioperative, ICU, MAT/NIC maternity, ONC, DIE/REH/DIA allied, OTH kits, DTH statutory.
- **RCM** Revenue: ACC/CHG accounting, TAR pricing, CSH self-pay, TAX, INS/DEN/SCH insurance, NAT national claims, COD/GRP/AI coding, CST costing, US.
- **ERP** ERP: INV/PRC/IMP supply chain, FIN finance, HTM assets, HR/ROS workforce, SVC support services.
- **OPS** Operations: FLW/RTL patient flow, CMD/PRD command centre, MIS/STAT MIS (STAT-02 is BP's).
- **INT** Interoperability: ENG engine, FHIR APIs, DOC/IPS documents, ABDM/SEHE/UAE/PH national, OEHR/EU Europe, US; SEAM (BP).
- **AI** AI and data: GW/GOV platform, AMB/DCS/SUM/NUR/INB clinician AI, RCM operational, PAT patient, IMG imaging, DAT data platform.
- **DFD** Front door: MSG/BOK/PAY/REC/CRM engagement, APP portal, TEL/RPM virtual care.
- **IMP** Implementation tooling and telemetry: FND content, MIG migration, RDY go-live, TRN training, TEL telemetry, SUP support, GOV governance, MAT maturity, CRT partners.
- **KRI** Kurdistan features (K §4.1 gives no domain name): LOC language, ID identity, RCM/PAY billing and payments, STAT/MSG reporting and messaging.

**Size** (R14 §3; K §4.1). S ≤4, M 4–12, L 12–30, XL 30–80 engineer-weeks (ew). Totals use midpoints 3/8/20/50. Sizes count happy-path feature coding only (BP §4.1). Squad person-months (PM) = ew × 0.72, plus regulated overhead where stated (BP §4.1; K §4.1). Capacity applies an AI-tooling factor of ×1.05 (BP §4.1; K §14.2). In the Size column, "BP L→XL" is a BP resize, "(−3)" a K trim and "+12 net" K's incremental count.

**Stance** (R14 §3). B build; I integrate a third party; P partner or licence (content or AI); B+I or B+P hybrid. R14's per-feature decision governs; domain stances are summaries (BP §4.3; K §4.3). **†** = no per-feature decision recorded, so the K §4.3 domain stance is shown. K never builds alarm forwarding, nurse call, RTLS, PACS, a drug KB, speech or LLM models, payment wallets or national ID systems (K-09).

**Regulated flag** (R14 §3). Y = regulated-module track (ISO 13485/IEC 62304/ISO 14971); C = conditional; N = not a device function. Shown in Scope as "(reg Y)" or "(reg C)".

**R14 and BP tags.** R14: MVP = needed for the MVH to sign and go live (market-gated items only in their market); P2 = months 13–24; P3 = after month 24 or opportunistic (R14 §3). BP: R1 M18, R1.1 ≈M21, R2 M28, R2.1 by M31, R3 KSA M34, R4 UAE M48; P2 M28–M44 (GA M38); P3 M40+ (BP §4.2–§4.3).

**Kurdistan phase codes** (K §4.2–§4.3; squad PM are K's estimates [E]):

| Code | When | Runs (short) | PM |
|---|---|---|---|
| R1 | Live M22; code-complete M19 = RG1 | Wedge: EMPI, OPD, referrals, seam bridge, LIS, RIS, OP pharmacy POS, IQD/USD billing, doctor fees, credit, KRG returns, on-site cell | ≈560 |
| R1.1 | ≈M25 | Wallet links, DHIS2, document-pack automation, autoverification v1, MIS breadth, display boards, FHIR SMART/Bulk/Subscriptions | ≈100 |
| R2a | First live M27; code-complete M24 (M21 if W2-K) | Inpatient Core: ADT, inpatient and OT billing, OT scheduling, dispensing on transcribed paper orders, control sets, MLC, births/deaths | ≈85 |
| R2b | M37, hospital A; feature-complete M32; freeze M34 | Clinical Safety: CPOE, verification, eMAR/BCMA, dose fallback set, nursing, ED, ICU flowsheet, transfusion, NEWS2, discharge, results | ≈540 |
| R2.1 | By M40 | Anaesthesia record (lite), ICD-10 coding, ICU monitor feed, procurement/AP-AR breadth, ROI automation, governance intake, secondary returns | ≈80 |
| P2 | M38–M54; GA wave M50 | Depth and add-ons, incl. Dose Engine, stewardship, AI | ≈400 |
| P3 | M52+ or partner-led | Later depth | ≈190 |
| MVP? | — | In the K MVP; release not determinable from K §4.2/§4.3 | — |
| DROPPED-K | — | Removed in K; reason in note | — |

The Iraq federal pack (code-complete M48, live M52, ≤40 PM inside P2 capacity) has no feature IDs. Every R1.1 and R2.1 item has a manual path on go-live day, and none is a safety control or statutory register (K §4.2).

**Placement rules used here.** Phase = the first K release that runs the feature; later completion goes in the note. "Inferred" = K §4.2 names the parent workflow but not the feature. Rows labelled "part" are sub-parts of an ID, not counted as IDs.

## 2. Backlog by domain

Scope is R14 text, trimmed, or BP/K text for new items.

### PLT · Platform/NFR

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| PLT-CORE-01 | Clinical journal | XL | R1 | B | Bitemporal append-only journal; entered-in-error/amend semantics; provenance |  |
| PLT-CORE-02 | Enterprise hierarchy | L | R1 | B | Tenant>legal entity>facility>unit>bed; scoped config inheritance |  |
| PLT-CORE-03 | State machines + invariants | L | R1 | B | Domain state machines; server-side safety invariants on all channels | SI-01..21 kept; SI-20/21 restated (K §5.1) |
| PLT-CORE-04 | Event catalogue + outbox | M | R1 | B | Domain event catalogue; transactional outbox |  |
| PLT-CORE-05 | Terminology service | L | R1 | B+I | SNOMED/LOINC/ICD-10 variants/UCUM/ATC + licence entitlements | WHO ICD-10; SNOMED GPS until licensed (ADR-015) |
| PLT-CORE-06 | Rules engine | L | R1 | B | Versioned rules; simulation/replay; approval; effective dating (reg C) |  |
| PLT-CORE-07 | Task/work-queue engine | M | R1 | B | Every item owned; SLA timer; orphan alarm | Seam messages to hospital A are owned tasks (SI-03) |
| PLT-CFG-01 | Config-as-product | L | R1 | B | Typed registry; change sets; signed bundles; promotion; 3-way merge |  |
| PLT-CFG-02 | Country packs | M | R1 | B | Effective-dated code sets, tax, claims, statutory reports | Kurdistan pack; BP calendar addition kept (with PLT-UX-03) |
| PLT-CFG-03 | Forms engine | L | R1 | B | FHIR Questionnaire/SDC renderer + builder |  |
| PLT-CFG-04 | Extension SDK | M | P2 | B | Plugin slots; SMART app launch |  |
| PLT-UX-01 | Design system | M | R1 | B | Keyboard-first design system; WCAG 2.2 AA | Western digits for clinical numerals (K §6.2) |
| PLT-UX-02 | Workstation shell | M | R1 | B | Silent ZPL wristband/label print; scanners; badge tap; FHIRcast | Kurdish/Arabic label shaping or raster fallback (K §9.2) |
| PLT-UX-03 | i18n / RTL | L | R1 | B | Arabic RTL; Hijri+Gregorian; bilingual prints; multi-script/phonetic name search | Re-scoped, same size: Kurdish+Arabic RTL; Hijri optional |
| PLT-UX-04 | Mobile app framework | L | MVP? | B | Mobile clinical app framework; encrypted offline cache | One app: nurse mode (BCMA, R2b) + physician mode (K §6.6) |
| PLT-OPS-01 | Cells | XL | R1 | B | Cell-based multi-tenant SaaS with in-country cells (IN/SA/AE) | Becomes on-site hospital cells + Kurdistan central/DR site (K-16) |
| PLT-OPS-02 | On-prem install | L | R1 | B | On-prem/state-DC install from same signed artefacts | P2→MVP inside PLT-SITE-01; cell at hospital A by M18 |
| PLT-OPS-03 | Edge cell | XL | P3 | B | Edge cell (local primary) for low-connectivity hospitals | Single-hospital cell now default; multi-site edge cell P3 (KDV-2) |
| PLT-OPS-04 | HA + DR | L | R1 | B | HA multi-AZ; cross-region DR; PITR | On-site sync HA; Kurdistan DR site, RPO ≤15 min (K-17) |
| PLT-OPS-05 | Observability | M | R1 | B | Observability; RUM per screen/site; SLO dashboards |  |
| PLT-OPS-06 | Performance gate | M | R1 | B | Synthea 1000-bed day-in-the-life load test in CI | K tests 300-bed day on three-node cell (K-13) |
| PLT-OPS-07 | Zero-downtime releases | M | R1 | B | Expand/contract releases; N-2 on-prem policy | Monthly on-site train; max drift N-1 (ADR-021) |
| PLT-EDGE-01 | Site edge agent (BP new) | L | R1 | B† | Plane B appliance: continuity replica, queue state, print spool, device bridge | Outpatient-tier sites; merged into cell at hospitals (ADR-011) |
| PLT-SITE-01 | On-site cell (K new) | L+M | R1 | B† | Umbrella, 48 ew: PLT-OPS-02 (L) + fleet/licensing/certificates/updates (L) + on-site immutable backup, off-site replication (M) | Sub-IDs not assigned; ew here excludes PLT-OPS-02 |
| PLT-PWR-01 | Power-loss resilience (K new) | M | R1 | B† | Power-loss resilience (K §4.1); power design in ADR-026 | Inferred R1: RG1 power obligations; M18 power-cut tests |

### TRU · Trust plane, security, downtime

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| TRU-IAM-01 | SSO/MFA | L | R1 | B+I | SAML/OIDC SSO; SCIM; phishing-resistant MFA; badge tap-and-go |  |
| TRU-IAM-02 | RBAC/ABAC | L | R1 | B | RBAC+ABAC+care relationship; privilege-gated clinical actions |  |
| TRU-IAM-03 | Break-the-glass | S | R1 | B | Reason capture; review queue |  |
| TRU-PRV-01 | Sensitivity labels | M | R1 | B | Labels + purpose-of-use propagated to UI/API/print/HIE | SI-21 labels: HIV, MH, reproductive, GBV, MLC, VIP |
| TRU-PRV-02 | Consent management | M | R1 | B | Consent management incl. ABDM consent artefacts | ABDM artefacts out; K consent registry (K §10) |
| TRU-AUD-01 | BALP audit | M | R1 | B | 100% PHI-access audit; tamper-evident; SIEM streaming | Message report releases logged |
| TRU-AUD-02 | Privacy monitoring | M | P2 | B+I | Privacy monitoring; patient-facing access log | Patient-visible access log P2 (K §10) |
| TRU-KEY-01 | Per-tenant KMS | M | R1 | B+I | Per-tenant KMS + BYOK/HYOK | BP P2→MVP; HSM/TPM KMS, no HYOK (ADR-008); inferred R1 |
| TRU-SEC-01 | Secure SDLC | M | R1 | B | IEC 81001-5-1/SSDF; SBOM/VEX; signed builds; VDP |  |
| TRU-SEC-02 | ISO 27001 + SOC 2 | L | MVP? | B | ISO 27001/27701/27017/27018 + SOC 2 Type II | ISO 27001(+27701) ≈M24; SOC 2 only if a buyer asks |
| TRU-SEC-03 | Market attestations | M | MVP? | B | CERT-In Safe-to-Host; NCA ECC/CCC; ADHICS; MeitY/CST | Replaced, same size: ISO 27001 and local attestations |
| TRU-BCP-01 | Read-only continuity | L | R1 | B | Unit snapshots ≤15 min stale; shadow viewer; printable packets | Edge-agent continuity R1; DR continuity instance by hospital A RG4 |
| TRU-BCP-02 | Downtime ID blocks | M | R1 | B | Downtime MRN/encounter/accession blocks; offline wristband/label print | Downtime accession numbers in outpatient lab protocol |
| TRU-BCP-03 | Back-entry | L | R1 | B | Back-entry + reconciliation keeping original event times | Frequent outages; sized for back-entry (SI-10); inferred R1 |
| TRU-BCP-04 | Immutable backups | L | R1 | B | Isolated immutable backups; clean-room rebuild; quarterly restore tests | On site + DR site; ≥90 days of restore points |
| TRU-BCP-05 | Code-Dark drills | S | R1 | B | Drill tooling; SAFER self-assessment workbook | BP P2→MVP; WAN- and power-cut drills gate RG3 |
| TRU-REG-01 | QMS + Boundary Register | XL (BP L→XL) | R1 | B | ISO 13485/IEC 62304/ISO 14971 QMS; Regulatory Boundary Register service (reg Y) | ISO 13485 certificate deferred; Register is Tier 2 switch (K-05) |
| TRU-REG-02 | Safety case + hazard log | L (BP M→L) | R1 | B | Hazard-log service; Release Evidence Pack generator | DCB0129 model; safety case per release (K §5.3) |

### ACC · Patient access

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| ACC-ID-01 | EMPI | L | R1 | B | Probabilistic match; steward queue; reversible merge/unmerge | Cross-script gold set (S14-K); auto-merge precision ≥99.9% |
| ACC-ID-02 | National ID plug-ins | M | R1 | B | ABHA; Absher/Nafath/Iqama; Emirates ID/UAE Pass | Replaced, same size: Iraqi ID documents (card, residency, passport, UNHCR/IDP) |
| ACC-ID-03 | Aliases, newborn, photo | M | R1 | B | Unknown/trauma/MCI aliases; distinct newborn naming; photo capture | Inferred R1 (registration); K §4.3 Identity list |
| ACC-REG-01 | Registration | M | R1 | B | Sponsor/payer selection; coverage; consents; AR/EN names | Output language captured at registration (K §6.7) |
| ACC-ADT-01 | ADT | L | R2a | B | ADT incl. pending/LOA/corrections; HL7 ADT broadcast |  |
| ACC-ADT-02 | Bed board | M | R2a | B | Bed state machine; EVS status; isolation |  |
| ACC-SCH-01 | Scheduling | L | R1 | B | Provider/resource scheduling; templates; overbooking; waitlists | Friday–Saturday weekend; Kurdistan holidays |
| ACC-SCH-02 | Referral tracking | M | R1 | B | Referral intake; order-to-completion tracking | BP P2→MVP; owned queues across hospital-A seam |
| ACC-OPD-01 | OPD token journey | M | R1 | B | Token/queue; reg>vitals>consult>bill>lab>pharmacy journey; display boards | Display boards in R1.1 |
| ACC-OPD-02 | ABDM Scan-and-Share | S | DROPPED-K | B | ABDM QR registration (IN) | Dropped: India national rail |
| ACC-OPD-03 | Kiosk | M | P2 | B+I | Self-service check-in + payment |  |
| ACC-TRF-01 | Transfer centre | M | P2 | B | Transfer centre; patient transport tasks |  |

### CLN · Clinical core

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| CLN-CHT-01 | Chart + banner | L | R1 | B | Banner: photo, 2 IDs, allergies, code status, isolation, dated weight | Name in patient's script plus Latin (SI-01, SI-16) |
| CLN-CHT-02 | Problems/allergies | M | R1 | B | Coded problems; coded allergies (reaction/severity); home meds | 'NKA' distinct from 'not assessed' |
| CLN-CHT-03 | Results review | M | R1 | B | Results review; trending; cumulative views | Inferred R1 (wedge LIS/RIS results) |
| CLN-ORD-01 | Orderables + order sets | L | R1 | B | Orderables catalogue; versioned order sets |  |
| CLN-ORD-02 | CPOE | XL | R1 | B | All timing types; verbal read-back/co-sign; lifecycle; order-to-result tracking | OPD orders R1; inpatient CPOE R2b; R2a orders on paper |
| CLN-CDS-01 | Drug KB adapter | M | R2a | P | Drug KB abstraction (FDB/Medi-Span/Multum/MIMS/regional); local re-tiering | Regional brand mapping; R1 OPD use unstated |
| CLN-CDS-02 | Order checks | L | R2a | B | DDI/allergy/dose/route/duplicate/renal/age checks (reg C) | KB screening at R2a transcription; CPOE checks R2b |
| CLN-CDS-03 | CDS telemetry + harness | M | MVP? | B | Override/PPV/alert-burden telemetry; Leapfrog regression harness | Harness runs after every KB/content release (K §6.3) |
| CLN-CDS-04 | CDS Hooks + CQL | M | P2 | B+I | CDS Hooks client; CQL engine |  |
| CLN-CDS-05 | NEWS2/PEWS/MEOWS | M | R2b | B | EWS from validated obs; escalation tasks; obs frequency (reg Y) | Regulated Module #1; non-ICU wards; Register-gated |
| CLN-CDS-06 | Sepsis screen | S | P2 | B | Rule-based non-interruptive worklist flag (reg Y) | Regulated Module #2 (K-07) |
| CLN-CDS-07 | Predictive deterioration | M | P2 | P | Cleared partner; silent-mode local validation (reg Y) | Conflict: K §4.3 P2 vs K §11.2 P3 |
| CLN-CDS-08 | VTE prompts | S | R2b | B | VTE risk assessment; prophylaxis prompts | Inferred R2b (inpatient CPOE); sweep candidate (K §5.6) |
| CLN-DOC-01 | Clinical notes | L | R1 | B | H&P/progress/consult notes; templates; co-sign; addenda | English clinical text; OPD chart in R1 |
| CLN-DOC-02 | Copy-forward provenance | M | MVP? | B | Copy-forward provenance; bloat indicators; change-since-last-note | BP P2→MVP (bloat indicator BP R2.1); K §4.2 silent |
| CLN-DOC-03 | Discharge + AVS | M | R2b | B | Discharge navigator; summary; bilingual AVS | Patient instructions: Sorani/Badini/Arabic approved templates |
| CLN-DOC-04 | HIM + legal record | L (BP M→L) | R2b | B | Deficiencies; scanning; ROI; amendments; LHR; signatures; retention | Manual ROI register until R2.1; never auto-delete |
| CLN-MRC-01 | Med rec | M | R2b | B | Med rec at admission/transfer/discharge | Polyclinic history is reconciliation input only (SI-09) |
| CLN-HND-01 | I-PASS | M | R2b | B | I-PASS handoff; team/rounding lists | Inferred R2b (inpatient) |
| CLN-RES-01 | Results inbox | M | R2b | B | Routing; surrogates; unacknowledged monitoring; pending-at-discharge queue | Named in R2b; R1 OPD inbox unstated |
| CLN-ED-01 | ED triage + board | L | R2b | B | ED quick-reg; configurable triage; tracking board with timers | One triage scale per tenant |
| CLN-ED-02 | ED pathway clocks | M | R2b | B | Stroke/STEMI/sepsis clocks; disposition; boarding view | Workflow timers, not a device |
| CLN-ED-03 | MCI mode | M | P2 | B | MCI/disaster mode |  |
| CLN-BH-01 | Suicide screen + restraint | S | R2b | B | Suicide screening; restraint/seclusion orders and timers | Inferred R2b (inpatient orders) |
| CLN-IPC-01 | Isolation flags | S | MVP? | B | Isolation flags and alerts | Banner (R1) and bed board (R2a) both carry isolation |
| CLN-IPC-02 | HAI surveillance | M | P2 | B | HAI surveillance; device-days; outbreaks |  |
| CLN-AMS-01 | Stewardship | M | P2 | B | Restricted-antimicrobial approval; time-outs; DOT | BP P2→MVP; K →P2; stewardship control set at go-live |
| CLN-ACP-01 | Code status + ACP | S | MVP? | B | Code status; advance care planning documents | Code status on banner (R1); 'code documentation' in R2b |
| CLN-INC-01 | Incidents + RCA | M | MVP? | B | Incident/safety-event reporting; RCA workflow | In K §4.3 Quality MVP; release unstated |
| CLN-QI-01 | Accreditation KPIs | M | MVP? | B | NABH/CBAHI/JAWDA/JCI indicator capture | Replaced, same size: JCI + KRG licensing indicators |
| CLN-IMM-01 | Immunisation (BP new) | M | R1 | B† | Administration/history; lot from stores; BCMA scan; VXU, FHIR Immunization | BCMA scan with inpatient BCMA (BP); ABDM part unaddressed in K |

### NUR · Nursing

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| NUR-FLW-01 | Flowsheets | L | R2b | B | Assessments; flowsheets; I&O; LDAs; charting by exception | UI language per nurse; drug names, units in Latin |
| NUR-FLW-02 | Risk scores | M | R2b | B | Braden/Morse/delirium with care-plan triggers |  |
| NUR-CP-01 | Care plans | M | R2b | B | Care plans; shift worklists; nurse handoff |  |
| NUR-WND-01 | Wound photos | S | R2b | B | Wound photography + documentation |  |
| NUR-STF-01 | Acuity staffing | M | P3 | B | Acuity-based staffing view |  |

### MED · Medication

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| MED-PHV-01 | Pharmacist verification | L | R2b | B | Verification queue with clinical screening | Pharmacist-cover alarm; 24×7 cover is an RG1 obligation |
| MED-FRM-01 | Formulary | M | R1 | B | Formulary; LASA/tall-man; high-alert flags; item-master link | Inferred R1 (OP POS); regional brands |
| MED-DSP-01 | IP dispensing | L | R2a | B | Unit dose/ward stock; returns; charge on dispense/admin | Against transcribed paper orders, Core transcription control set |
| MED-OPP-01 | OP pharmacy POS | M | R1 | B | Retail POS; batch/expiry; e-Rx receipt | Re-scoped: retail, dual currency, KRG pricing; H1/X, DPCO dropped |
| MED-MAR-01 | eMAR | L | R2b | B | Schedules; PRN reassessment; independent double-check; titrations | No MAR from transcribed orders in R2a |
| MED-BCM-01 | Mobile BCMA | L | R2b | B | Patient+med scan; override reasons; dashboards; offline cache | Unverified patient-supplied medicines never scannable |
| MED-INF-01 | Infusion model | M | R2b | B | Infusion data model; pump-channel association; manual rate/volume checks | Inferred R2b (with eMAR) |
| MED-INF-02 | Smart pumps | L | P2 | I | PIV/IPEC via first vendor gateway (reg C) | Only once BCMA ≥95% (K-09) |
| MED-ADC-01 | ADC/robots | M | P2 | I | ADC/robot interfaces; override policy |  |
| MED-CS-01 | Controlled drugs | M | R1 | B | Controlled-substance registers + reconciliation (NDPS/SFDA/MOHAP) | Replaced, same size: Iraqi narcotics registers |
| MED-ONC-01 | Chemotherapy | L | P2 | B | Regimens; BSA dosing; dual verification (reg C) |  |
| MED-IV-01 | IV compounding | M | P3 | B+I | IV compounding/TPN; IV workflow interfaces |  |
| MED-ERX-01 | National e-Rx | M | DROPPED-K | B | Wasfaty; Riayati/NABIDH; ABDM e-Rx | Dropped: national e-Rx interface (K §14.2) |
| MED-DOSE-01 | Dose Engine (BP new) | L | P2 | B† | Shared Class C Dose Engine (Tier 2) | MVP→P2 (≈M50); extended fallback control set meanwhile |
| MED-TNT-01 | Track-and-trace (BP new) | M | DROPPED-K | B† | SFDA RSD and UAE Tatmeen from GS1 scans | Dropped: KSA/UAE-only |
| MED-KRI-01 | Brand master + labels (K new) | M | MVP? | B† | Regional brand master; in-house unit-dose barcode labels | Release unstated; brands serve POS, labels serve BCMA |

### DX · Diagnostics (LIS, RIS, imaging, transfusion)

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| DX-ORD-01 | Diagnostic order lifecycle | L | R1 | B | Order>specimen/exam>result>ack |  |
| DX-CRT-01 | Critical results | M | R1 | B | Named recipient; read-back; escalation | Extended to external referring doctors (SI-04) |
| DX-LAB-01 | Phlebotomy + accessioning | L | R1 | B | Worklists; bedside labels; accessioning; tracking |  |
| DX-LAB-02 | Analyzer connectivity | L | R1 | B+I | Middleware + direct ASTM/HL7 drivers; LAW-ready |  |
| DX-LAB-03 | Validation + autoverification | L | R1 | B | Result validation; autoverification v1; delta/critical rules; reports (reg C) | Autoverification v1 R1.1; manual validation until then |
| DX-LAB-04 | QC / lab-quality pack | M (BP L; K M) | R1 | B | Levey-Jennings/Westgard QC; reagent/lot tracking | NABL upsizing dropped; ISO 15189-aligned quality pack kept |
| DX-LAB-05 | Send-outs | M | R1 | B | Send-out tests; reference-lab interfaces |  |
| DX-LAB-06 | ISO 15189 doc control | M | P3 | B | Document control; risk register | BP NABL condition (P3→P2) not addressed in K |
| DX-MIC-01 | Microbiology | L | P2 | B | Culture; AST; cascade reporting; antibiogram | WHONET/GLASS export |
| DX-AP-01 | Anatomic pathology | L | P3 | B | AP workflow; synoptic reporting |  |
| DX-POC-01 | POCT | M | P2 | I | POCT data-manager integration |  |
| DX-RIS-01 | RIS core | L | R1 | B | Orders; scheduling; protocoling; MWL/MPPS broker; tracking | Moved into wedge (KDV-10); BP had R2 |
| DX-RIS-02 | Radiology reporting | M | R1 | B | Templates; structured reports; actionable-finding follow-up | BP Form F gate dropped (PCPNDT out) |
| DX-RIS-03 | Dose capture | M | P2 | B | RDSR capture; exceedance review | Not in K §4.3; K §14.2 keeps P2 |
| DX-PAC-01 | PACS integration | M | R1 | I | DICOMweb + IID launch; bundled OSS PACS tier | OSS viewer labelled non-diagnostic |
| DX-CRD-01 | ECG/endoscopy | M | P2 | I | ECG/cardiology + endoscopy report integration |  |
| DX-BB-01 | Bedside transfusion | M | R2b | B | BCMA extension; orders; consent; reactions (reg C) | Two-person e-witness; relabelled units; Register-gated T2 |
| DX-BB-02 | Blood bank interface | M | MVP? | I | e-RaktKosh/third-party/cleared BECS interface | Not dropped in K §4.1; K §9.1 assumes no interface |
| DX-BB-03a | Blood-centre inventory (BP split) | L | P2 | B | Inventory; ISBT 128 labelling (regulated track) |  |
| DX-BB-03b | Compatibility engine (BP split) | XL | DROPPED-K | B | IVD-grade compatibility engine | Never built; licensed if ever needed |
| DX-BB-KRI-01 | Unit receipt + relabel (K new) | S | R2b | B+I† | Receipt of public blood-bank units; relabel with our barcode | Blind two-person double entry; mismatch quarantines (SI-11) |

### DEV · Devices

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| DEV-GW-01 | Device gateway | L | R2.1 | B+I | Middleware PCD-01/DEC; device–patient association | Inferred: validated ICU monitor feed R2.1 |
| DEV-VAL-01 | Vitals validation UX | M | R2.1 | B | Nurse validation of auto-captured vitals; artifact marking | Inferred with ICU monitor feed (R2.1) |
| DEV-ALM-01 | Alarm analytics | M | P3 | I | Via ACM-capable platform (reg Y) | Alarm forwarding never built |
| DEV-SDC-01 | SDC/SDPi | L | P3 | B | ISO/IEEE 11073 SDC plug-and-play (reg C) | Not in K §4.3; K §14.2 keeps P3 |

### SPC · Specialty

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| SPC-OT-01 | OT booking | M | R2a | B | OT booking/scheduling; list management | Privileges gate OT booking (K §12.2) |
| SPC-OT-02 | WHO checklist | S | R2b | B | WHO checklist; consent; site marking; pre-op checklist |  |
| SPC-OT-03 | Intra-op record + charging | M | R2a | B | Intra-op record; counts; implants/consumables to charge+stock; op note | OT billing R2a; clinical intra-op record release unstated |
| SPC-AN-01 | Anaesthesia record | M | R2.1 | B | Pre-assessment; intra-op/PACU record (manual/semi-auto vitals) | Lite; paper record until R2.1 |
| SPC-AN-02 | Full AIMS | L | P2 | B | Machine/monitor feed (reg C) |  |
| SPC-OT-04 | OR analytics | M | P2 | B | Utilisation; turnover; first-case on-time |  |
| SPC-ICU-01 | ICU flowsheet | L | R2b | B | q1h flowsheet; fluid balance; drips; ventilator; bundles | Validated monitor feed in R2.1 |
| SPC-ICU-02 | ICU severity scores | S | P2 | B | APACHE II/SOFA (reg C) |  |
| SPC-ICU-03 | Tele-ICU | L | P3 | B+P | Tele-ICU |  |
| SPC-MAT-01 | L&D + newborn | M | R2a | B | L&D record; newborn registration; mother–baby link; birth notification | Re-scoped; KRG birth notification R2a; L&D release unstated |
| SPC-MAT-02 | Antenatal + partograph | L | P2 | B | Antenatal episode; WHO LCG; fetal monitoring |  |
| SPC-NIC-01 | NICU | M | P2 | B | NICU flowsheets; feeds; human-milk tracking |  |
| SPC-ONC-01 | Oncology | L | P2 | B | Regimens; cycles; staging |  |
| SPC-DIE-01 | Diet orders | S | R2b | B | Diet orders with allergy logic; tray tickets | Religious preferences; inferred R2b (inpatient orders) |
| SPC-REH-01 | Rehab | M | P2 | B | Rehab/physio/dietitian documentation |  |
| SPC-DIA-01 | Dialysis | M | P3 | B | Dialysis documentation; machine integration |  |
| SPC-OTH-01 | Specialty kits | L | P3 | B+P | Ophthalmology/dental/cath/endoscopy |  |
| SPC-DTH-01 | Death certificate | S | R2a | B | MCCD/national forms; mortuary register | Re-scoped: KRG forms; WHO-format ICD-10 cause of death |

### RCM · Revenue

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| RCM-ACC-01 | Patient account + ledger | XL | R1 | B | Single patient financial account; append-only ledger | Functional-currency ledger keeps original amounts (K §12.1) |
| RCM-CHG-01 | Charge router | L | R1 | B | Charges from orders, administrations, bed-days, supplies |  |
| RCM-TAR-01 | Tariff engine | L | R1 | B | Price lists; room categories; packages; effective dating | IQD lists default; USD only where permitted (L-33) |
| RCM-CSH-01 | Cashiering | L | R1 | B | Deposits; interim bills; discounts; refunds; shifts; UPI/mada/card | Re-scoped, same size; dual currency builds on it |
| RCM-TAX-01 | Tax engine | M | R1 | B | Tax + e-invoicing (GST; ZATCA Fatoora; UAE VAT) | Replaced, same size: Kurdistan receipt/tax rules (Q-K6) |
| RCM-INS-01 | Payer contracts + claims | L | R1 | B | Contract rules; eligibility; pre-auth; claims with attachments | Re-scoped: corporate/NGO/insurer credit, document packs; automation R1.1 |
| RCM-NAT-01 | NPHIES | L | DROPPED-K | B | NPHIES adapter (SA) | Dropped: KSA national rail |
| RCM-NAT-02 | NHCX/PM-JAY/TPA | L | DROPPED-K | B | NHCX + PM-JAY TMS + TPA workflows (IN) | Dropped: India national rail |
| RCM-NAT-03 | Shafafiya/eClaimLink | M | DROPPED-K | B | DoH/DHA XML adapters (AE) | Dropped: UAE national rail |
| RCM-COD-01 | Coding workbench | M | R2.1 | B | Coding workbench (ICD-10-AM/SBS; ICD-10; CPT); CDI worklists | Re-scoped: WHO ICD-10, no CPT/IHACPA; manual sheet until R2.1 |
| RCM-DEN-01 | Denials | M | R1 | B | Rejection/denial queues; resubmission; payer aging | Inferred R1 (credit flow); denial root-cause queues |
| RCM-SCH-01 | Corporate credit | M (−3) | R1 | B | Government scheme + corporate credit billing (CGHS/ECHS/corporates) | Corporate credit stays; scheme part split to P2 |
| RCM-SCH-01 · part: scheme | Scheme billing | ≈3 ew | P2 | B | Government-scheme part of RCM-SCH-01 | Activated when national insurance reaches the Region |
| RCM-GRP-01 | DRG grouper SPI | M | DROPPED-K | I | AR-DRG shadow billing; IR-DRG (SA;AE) | BP P2→MVP (R3 KSA); K drops: no DRG grouper |
| RCM-AI-01 | AI coding | M | P2 | P | AI coding suggestions with confidence routing |  |
| RCM-CST-01 | Costing | L | P3 | B | Patient-level costing (TDABC/PLICS) |  |
| RCM-US-01 | US RCM | XL | DROPPED-K | B+I | X12; Da Vinci; price transparency (US) | Dropped: US-only (K §14.2) |

### ERP · ERP

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| ERP-INV-01 | Stores | L | R1 | B | Item master; stores; FEFO; indents; ward stock; consumption-to-charge | Inferred R1 (OP POS dependency) |
| ERP-PRC-01 | Procurement-lite | M | R2.1 | B | PR>PO>GRN>3-way match; vendor master | K R2.1 says 'breadth'; base release unstated |
| ERP-FIN-01 | AP/AR + GL export | M | R1 | B+I | AP/AR; GL journal posting/export | Daily GL journals R1 (K §9.1); AP/AR breadth R2.1 |
| ERP-FIN-02 | Lite GL | L | P2 | B | Native lite GL (multi-entity, multi-currency); fixed assets |  |
| ERP-FIN-03 | ERP connectors | M | P2 | I | SAP S/4; Oracle Fusion; Workday; Dynamics | Not in K §4.3; K §14.2 keeps P2 |
| ERP-IMP-01 | Implant/UDI | M | P2 | B | Implant/UDI capture; consignment; recall trace | K §12.2 puts consignment in MVP procurement-lite |
| ERP-HTM-01 | CMMS | M | P2 | B | Biomedical asset register; PM; work orders |  |
| ERP-HR-01 | Staff master | M | R1 | B | Staff master; credentialing/privileging records | Medical Syndicate/IMA registration IDs; inferred R1 |
| ERP-HR-02 | Payroll integration | M | P2 | I | HR/payroll/attendance via local payroll | Always integrated |
| ERP-ROS-01 | Rostering | M | P2 | B | Basic rostering; acuity staffing |  |
| ERP-SVC-01 | Support services | M | P2 | B | CSSD; linen; housekeeping/BMW; diet kitchen | CSSD-lite (K §4.3) |

### OPS · Operations

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| OPS-FLW-01 | Discharge clearance | M | R2a | B | Non-blocking clearance; expected discharge date; discharge tasks | Inferred R2a (discharge billing); SI-12 extended |
| OPS-CMD-01 | Command-centre data | L | P2 | B | Command-centre data layer + tiles |  |
| OPS-PRD-01 | Predictive discharge | M | P3 | B | Predictive discharge/census forecasting | Conflict: K §4.3 P3 vs K §11.2 forecasts P2 |
| OPS-MIS-01 | MIS dashboards | M | R1 | B | Revenue; collections; payer mix; occupancy/ALOS; TAT | MIS basics R1, breadth R1.1; owner's dashboard by currency |
| OPS-STAT-01 | Statutory returns | M | R1 | B | HMIS/DHIS2; MoH statistics; notifiable disease | Replaced, same size: KRG Ministry returns; inpatient R2a |
| OPS-RTL-01 | RTLS | M | P3 | I | RTLS location events | BP/K §4.3 list RTLS ingestion P2; counts keep P3 |
| OPS-STAT-02 | Statutory registers (BP new) | L | R1 | B† | Locked append-only registers; per-format export | Kurdistan content; MLC, births/deaths R2a |

### INT · Interoperability

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| INT-ENG-01 | HL7 v2 engine | L | R1 | B+I | MLLP/TLS; ack-state visibility; replay; owned queues |  |
| INT-FHIR-01 | FHIR façade | L | R1 | B+I | FHIR R4 façade (IPA; SMART; Bulk; Subscriptions) | SMART/Bulk/Subscriptions in R1.1 |
| INT-DOC-01 | Documents | M | R1 | B | PDF/A + CDA/FHIR documents from one source | K §4.3 lists PDF/A + FHIR (no CDA) |
| INT-ABDM-01 | ABDM | L | DROPPED-K | B | ABDM M1/M2/M3 (IN) | Dropped: India national rail |
| INT-SEHE-01 | SeHE | M | DROPPED-K | B | Saudi HIE connectivity (SA) | Dropped: KSA national rail |
| INT-UAE-01 | UAE HIEs | L | DROPPED-K | B | Malaffi/NABIDH/Riayati adapters (AE) | Dropped: UAE national rail |
| INT-IPS-01 | IPS $summary | M | R1 | B | IPS $summary generation | Conflict: K §4.3/§9 MVP 'from day one'; §4.1 silent |
| INT-PH-01 | Public-health reporting | M | P2 | B | IHIP/IDSP; HESN | Not in K §4.3; notifiable diseases via OPS-STAT (R1) |
| INT-OEHR-01 | openEHR adapter | M | P3 | I | openEHR CDR adapter (EHRbase) | Kept (K §14.2) |
| INT-EU-01 | EHDS | XL | DROPPED-K | B | EHDS components (EU) | Dropped: EU-only (K §14.2) |
| INT-US-01 | ONC/TEFCA | XL | DROPPED-K | B+P | ONC + TEFCA via partner (US) | Dropped: US-only (K §14.2) |
| INT-SEAM-01 | Group seam bridge (BP new) | M | R1 | B† | Alternate IDs from legacy ADT; REF/ADT/MDM; ORM/OML/ORU with ack state | Hospital-A seam until its M37 go-live |

### AI · AI and data

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| AI-GW-01 | AI gateway | L | P2 | B | In-country model routing; prompt mgmt; evaluation; kill switch | MVP→P2 (≈M42); counsel-approved region pinning |
| AI-GOV-01 | AI control plane | L | P2 | B | Registry; model cards; provenance; draft states; monitoring | MVP→P2; K costs gateway + plane at 20 total |
| AI-AMB-01 | Ambient OPD | M | P3 | P | Ambient OPD documentation (EN/AR/HI), ≥2 partners | MVP→P3; Sorani/Badini only after S8-K |
| AI-DCS-01 | Discharge draft | M | P2 | B | Source-linked discharge summary draft; clinician sign-off | MVP→P2; English drafts with omission checklist |
| AI-SUM-01 | Chart summary | M | P2 | B | Chart summary / pre-visit brief | Not in K §4.3; K §14.2 keeps P2 |
| AI-NUR-01 | Nursing ambient | M | P3 | P | Nursing voice/ambient to flowsheets | Conflict: K §4.3 P3 vs §14.2 arithmetic P2 |
| AI-RCM-01 | Claim scrubbing | M | P2 | B | Pre-submission scrubbing; denial prediction | K §4.3 marks claim scrubbing (P) |
| AI-PAT-01 | Result explanations | S | P2 | B | Result explanations (templated then AI) | Not in K §4.3; K §14.2 keeps P2 |
| AI-INB-01 | In-basket AI | M | P3 | B | In-basket triage; grounded draft replies | Not in K §4.3; K §14.2 keeps P3 |
| AI-IMG-01 | Imaging AI | M | P3 | I | AIW-I/AIR orchestration; governance ledger (reg Y) |  |
| AI-DAT-01 | Reporting replica | M | R1 | B | Reporting replica ≤60 s; report builder | On the on-site cell; inferred R1 (MIS basics) |
| AI-DAT-02a | CDC bronze (BP split) | M | R1 | B | CDC bronze landing in object storage | Central site; migration staging; inferred R1 |
| AI-DAT-02b | Silver/OMOP (BP split) | M | P2 | B | Silver layer; OMOP; SQL-on-FHIR views |  |

### DFD · Front door

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| DFD-MSG-01 | SMS/WhatsApp | M | R1 | B+I | Reminders/outreach without an account | DLT dropped; OTP + knowledge-check release; Viber via KRI-MSG-01 |
| DFD-BOK-01 | Booking link | M | MVP? | B | Web booking link; rules-based self-scheduling | BP R2.1; K §4.2 silent |
| DFD-PAY-01 | Payment links | M | R1.1 | B+I | Payment links; bill pay (UPI/mada/cards) | Re-scoped: wallet links (FIB, FastPay, ZainCash, Qi Card) |
| DFD-REC-01 | Report download | M (−3) | R1 | B | Report download + national PHR push | Download by OTP/expiring link stays; PHR part dropped |
| DFD-REC-01 · part: PHR push | PHR push | ≈3 ew | DROPPED-K | B | National PHR push (ABHA app; Sehhaty) | No national PHR |
| DFD-APP-01 | Portal/app | XL | P2 | B | Records; messaging; proxy; refills |  |
| DFD-TEL-01 | Teleconsultation | M | P2 | B+I | Video with booking and billing |  |
| DFD-CRM-01 | CRM | M | P2 | B | CRM/contact centre; leads; international patient desk | Not in K §4.3; K §14.2 keeps P2 |
| DFD-RPM-01 | RPM | L | P3 | B+P | RPM / hospital-at-home |  |

### IMP · Implementation tooling and telemetry

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| IMP-FND-01 | Foundation content | XL | R1 | B | Order sets, flowsheets, templates, CDS, roles, reports, charge masters | Re-scoped: Kurdistan foundation build (regional brands, trilingual forms) |
| IMP-MIG-01 | Migration Workbench | XL (BP L→XL) | R1 | B | 12-part Migration Workbench; legacy archive viewer | Paper and local-billing packs; master-data build |
| IMP-RDY-01 | Readiness tooling | L (BP M→L) | R1 | B | Readiness scorecard; cutover/rehearsal; rollback; model-ward/UAT kits | RG3 adds WAN-, power-cut, dual-currency drills |
| IMP-TRN-01 | Training tooling | M | R1 | B | Training sandbox; micro-learning; proficiency tracking |  |
| IMP-TEL-01 | Clinician telemetry | M | MVP? | B | Clinician-time + usability telemetry; micro-surveys | K §4.3 drops 'telemetry' from BP's tooling list |
| IMP-SUP-01 | Service desk + status page | S | R1 | B+I | Service-desk integration; ticket telemetry; status page | Inferred R1 (24×7 support M21); status page (K §13.7) |
| IMP-GOV-01 | Governance intake | S | R2.1 | B | Requests; scoring; 30-day loop closure | BP P2→MVP; manual path until R2.1 |
| IMP-MAT-01 | Maturity + evidence packs | M | P2 | B | EMRAM readiness report; accreditation evidence packs |  |
| IMP-CRT-01 | Partner academy | M | P2 | B | Analyst/partner certification academy | Academy live by M36 (K §13.7) |

### KRI · Kurdistan features (K §4.1)

| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |
|---|---|---|---|---|---|---|
| KRI-LOC-01 | Trilingual UI/outputs | M | R1 | B† | Sorani, Arabic, English UI; trilingual outputs | Trilingual receipts and reports at R1 |
| KRI-LOC-02 | Badini templates | S | MVP? | B† | Badini patient templates | Release unstated; Duhok review; Latin-script need via S7-K |
| KRI-ID-01 | Iraqi identity + cross-script EMPI | L (+12 net) | R1 | B† | Iraqi name parts; Kurdish/Arabic/Latin transliteration; cross-script matching (K §8) | +12 net over ACC-ID-02 |
| KRI-RCM-01 | Dual-currency cashiering | M | R1 | B† | IQD/USD; per-currency drawers; change in either currency; rounding |  |
| KRI-RCM-02 | Doctor-fee ledger | M | R1 | B† | Practitioner fee lines; package shares; payout ledger; statements | No referral-commission feature |
| KRI-PAY-01 | Card/wallet adapters | M | R1 | B† | Card-terminal and wallet adapters; K §12.1 pairs them with three-way reconciliation | Wallet links R1.1; no card PAN in HMS |
| KRI-STAT-02 | DHIS2 export | S | R1.1 | B† | DHIS2 data-value sets via Web API | Only if the KRG uses DHIS2 |
| KRI-MSG-01 | Viber + SMS gateways | S | R1 | B† | Viber; local SMS gateways | Per-site GSM/SMPP gateway in K §9.1 (R1) |

### Review-added control sets (no IDs; +15 squad PM in total; K §4.1)

| Control set | Phase | Scope | Source |
|---|---|---|---|
| Core transcription control set | R2a | Pharmacists alone transcribe, attaching the signed-order image; KB screening plus the dosing double check; ordering practitioner mandatory; second check on high-alert and paediatric orders; no MAR or "active medicines" view; 50 orders audited monthly | K §4.2; KDV-16 |
| Stewardship control set | R2a | Indication and approver for restricted antimicrobials (at order entry on Clinical Safety sites, at transcription on Core sites); 48–72 h time-out; stop or review date; monthly DDD/DOT; lead named at RG1 | K §4.2, §5.2 |
| Patient-supplied medicine workflow | R2a | Pharmacy receives, identifies, expiry-checks, relabels and flags "patient-supplied"; unverified outside medicines cannot be scanned; no payment rule delays a time-critical dose | K §4.2, §12.1; SI-12 |
| KB ≥10× hard stop | R2b | A drug-KB result ≥10× the maximum dose is a Tier A hard stop; KB output shown verbatim, no local arithmetic | K §5.6 item 2 |
| Pharmacist-cover alarm | R2b | Alarm if no pharmacist is logged in to the verification queue for >30 min; review within 4 h of any dose given before verification | K §5.6 item 4 |

The base **extended Dose Engine fallback control set** runs until the engine is active at a site (≈M50). It has three parts: a system-enforced pharmacist double check on every weight- or BSA-based dose, high-alert infusion and neonatal order; seeded 10× and unit errors in every test cycle; and 24×7 pharmacist cover as an RG1 obligation. Core sites apply the double check at transcription (R2a); Clinical Safety sites run the whole set (R2b). It is costed in K's −26 PM Dose Engine/stewardship line, not in the +15 (K §4.1, §5.6).

## 3. Totals

Per-feature sums of the rows above. KRI-ID-01 counts at +12 net; PLT-SITE-01 counts at 28 because PLT-OPS-02 has its own row.

| Phase | IDs | ew | Note or K's stated figure |
|---|---|---|---|
| R1 | 98 | 1,496 | — |
| R1.1 | 2 | 11 | Most R1.1 content is sub-functions of R1 rows |
| R2a | 10 | 111 | — |
| R2b | 23 | 238 | — |
| R2.1 | 6 | 55 | — |
| MVP? | 14 | 121 | — |
| **MVP** | **153** | **2,032**; **2,048** with +16 ew of kept BP in-ID additions (calendars 4; R03 §19/R11 §15 items 12) | ≈2,060 ew before control sets; **≈1,372 PM** incl. +15 PM control sets (K §4.1) |
| P2 | 48 | 558 (incl. 3 ew scheme part) | 543 ew, ≈400 PM (K §14.2) |
| P3 | 19 | 266 | 258 ew, ≈190 PM (K §14.2) |
| DROPPED-K | 14 | 326 (incl. 3 ew PHR part); also NPHIES claim types 8, DLT 4, DX-LAB-04 −12 | K §4.1: −99 rails, −40 market additions. K §14.2: −8 e-Rx, −150 US/EU, −50 compatibility engine |
| **All** | **234** (BP 222 + 12 K-new) | 3,182 | — |

**Reconciliation with K's figures.**
- **MVP 2,048 vs ≈2,060.** −20: K §4.1 costs the AI gateway and control plane at 20 ew; R14 sizes AI-GW-01 + AI-GOV-01 at 40. +8: INT-IPS-01 is in the MVP here (per K §4.3 and §9), but K §4.1 does not move it.
- **P2 558 vs 543.** +20 (the same AI sizing); −8 (INT-IPS-01); −8 (AI-NUR-01 moved to P3); +11 (K's unnamed "KSA and UAE P2 items").
- **P3 266 vs 258.** +8 (AI-NUR-01).
- **R1 share.** First-release attribution puts R1+R1.1 at ≈74% of per-feature MVP ew. K §4.2 puts the wedge at ≈48% of MVP effort (≈660 of ≈1,372 PM), and BP §4.2 counted platform features as only "partly exercised" in the wedge.
- **Release PM** (K §4.2): R1 ≈660 (≈560 + ≈100 in R1.1); R2a ≈85; R2b ≈540; R2 ≈625; R2.1 ≈80; Iraq pack ≤40.

**Lineage.**
- R14: 140 / 54 / 20 = 214 IDs; 1,875 / 611 / 400 ew. Only the MVP ew is stated in R14; P2 and P3 ew are computed from Appendix A.
- BP: 154 / 47 / 21 = 222 IDs; 2,149 / 523 / 450 ew.
- K: computed here as 153 / 48 / 19 plus 14 dropped = 234. K states no feature counts.

**K's ID-level changes.**
- **Dropped (14).** From the MVP: ACC-OPD-02, INT-ABDM-01, INT-SEHE-01, INT-UAE-01, RCM-NAT-01/02/03, MED-TNT-01, RCM-GRP-01. From P2: MED-ERX-01. From P3: RCM-US-01, INT-EU-01, INT-US-01, DX-BB-03b.
- **Out of the MVP.** To P2: AI-GW-01, AI-GOV-01, AI-DCS-01, MED-DOSE-01, CLN-AMS-01. To P3: AI-AMB-01.
- **Into the MVP from P2.** PLT-OPS-02; INT-IPS-01 (K §4.3 only).
- **P2 → P3.** AI-NUR-01 (K §4.3 only).
- **New (12).** The eight KRI-* IDs, plus PLT-SITE-01, PLT-PWR-01, MED-KRI-01 and DX-BB-KRI-01.
- **Content replaced at the same size.** ACC-ID-02, TRU-SEC-03, RCM-TAX-01, CLN-QI-01, MED-CS-01, OPS-STAT-01.
- **Re-scoped, not re-sized.** PLT-UX-03, RCM-CSH-01, RCM-INS-01, DFD-PAY-01, MED-OPP-01, RCM-COD-01, SPC-MAT-01, SPC-DTH-01, IMP-FND-01.
- **Trimmed.** RCM-SCH-01 (scheme part to P2); DFD-REC-01 (PHR push dropped).
- **Kept with Kurdistan content.** OPS-STAT-02.

## 4. Could not place, and conflicts

**MVP features with an undeterminable release (14):** PLT-UX-04, TRU-SEC-02, TRU-SEC-03, CLN-CDS-03, CLN-DOC-02, CLN-IPC-01, CLN-ACP-01, CLN-INC-01, CLN-QI-01, MED-KRI-01, DX-BB-02, DFD-BOK-01, IMP-TEL-01, KRI-LOC-02.

**Items with no feature ID:**
- **K's first AI SKUs and platform parts (all P2):** dictation structuring, insurer document-pack assembly, template-based patient instructions, no-show outreach, grounding service, HITL UX kit (K §4.3, §11.2).
- **Iraq federal pack:** federal returns, insurance adapter, practitioner fields, Arabic-first review (K §4.2).
- **Placed, but without IDs:**
  - P2: IHE ACM reporter/consumer; referrer portal with no commission features; Ramadan mode and same-gender preference (K §6.7); cross-referenced group identities (ADR-006); regional-cloud ciphertext backups (K §7.8).
  - R2b: chaperone documentation and guardian consent (K §6.7).
  - P3: federated benchmarking; app marketplace; partner-only triage AI.
- **Not attributable to one release:** BP's kept in-ID additions (+16 ew).
- **Unidentifiable:** K §14.2's "KSA and UAE P2 items (11)". No KSA/UAE-only P2 ID remains in Appendix A once BP moved RCM-GRP-01 to the MVP. BP §4.3's P2 lists Hajj/Umrah surge mode, the Seha/Sehhaty exchange and UAE PASS login without IDs.

**Conflicts and ambiguities:**
1. **AI platform size.** K §4.1 moves "AI gateway and control plane (20)" to P2, but R14 App. A sizes AI-GW-01 L + AI-GOV-01 L = 40 ew.
2. **INT-IPS-01.** MVP "from day one" (K §4.3, §9) vs no move in K §4.1 and an unchanged P2 total (K §14.2).
3. **AI-NUR-01.** P3 (K §4.3) vs P2 arithmetic unchanged (K §14.2).
4. **CLN-CDS-07.** P2 (K §4.3) vs P3 "AI-3 device-grade" (K §11.2).
5. **OPS-PRD-01.** Predictive discharge P3 (K §4.3) vs capacity and length-of-stay forecasts P2 (K §11.2 AI-0).
6. **OPS-RTL-01.** P3 in the R14/BP/K counts vs "RTLS ingestion" P2 (BP §4.3; K §4.3, §9.2).
7. **DX-BB-02.** Kept in K §4.1 arithmetic vs "no interface assumed" (K §9.1) and relabelling instead (K §4.3).
8. **ACC-ID-02 vs KRI-ID-01.** ACC-ID-02 is kept at M (K §4.1) while KRI-ID-01 is L "+12 net over ACC-ID-02"; K does not say whether ACC-ID-02 survives as a separate ID.
9. **DFD-MSG-01.** K §4.1 drops BP's +4 as "DLT template governance", but BP §4.1's +4 also covered OTP/expiring-link release, which K §4.2 and §9.2 keep.
10. **DX-LAB-04.** Back to M (K §4.1) vs K §4.3 keeping EQA, rejection register, amended-report audit and TAT per test (BP §4.1 NABL-pack items).
11. **DEV-GW-01.** R14 makes it a dependency of SPC-ICU-01; K puts the ICU flowsheet in R2b but the validated monitor feed in R2.1.
12. **TRU-AUD-02.** Privacy-monitoring analytics is a MUST at GA (K §10) vs privacy monitoring in P2 (K §4.3).
13. **ERP-IMP-01.** Consignment is in MVP procurement-lite (K §12.2) vs ERP-IMP-01, which includes consignment, at P2.
14. **IMP-CRT-01.** Academy live by M36 (K-30; K §13.7) vs the P2 window M38–M54 (K §4.3).
15. **PLT-OPS-03.** K §4.3 drops BP's P3 "edge cell" vs the multi-site edge cell staying P3 (K §7.8; KDV-2; K §14.2).
16. **CLN-DOC-02.** BP §4.2 put the bloat indicator in R2.1; K §4.2 R2.1 omits it, while K §4.3 keeps copy-forward provenance in the MVP.
17. **Omissions from K §4.3.** These IDs are missing from K §4.3 but kept by K §14.2 arithmetic. P2: DX-RIS-03, ERP-FIN-03, AI-SUM-01, AI-PAT-01, DFD-CRM-01, INT-PH-01. P3: DEV-SDC-01, AI-INB-01.
18. **Citations.** K §4.1 cites R14 "replace", "market-gated" and "re-scope" lists. R14 has no replace or re-scope list; its market-gated IDs appear only in §1 #2 and the §5 YAML.
