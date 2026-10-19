## Appendix A. The backlog of record (Kurdistan)

Every feature the programme builds, integrates or deliberately drops, from R14 Appendix A as amended by BP §4.1 and K §4.1. **Sizes** are engineer-weeks of happy-path coding (S≈3, M≈8, L≈20, XL≈50); squad person-months ≈ engineer-weeks × 0.72 plus regulated overhead. **Stance:** B build, I integrate, P partner or licence († = domain-level stance). **Phase** is the first Kurdistan release that runs the feature: R1 wedge, R1.1, R2a inpatient Core, R2b Clinical Safety, R2.1, P2, P3, or DROPPED-K. Where this prompt places a feature differently from the K text or from a "not determinable" placement, the note says so, and **[P]** marks a safety-driven change of this prompt. Keep this table in `docs/program/backlog.yaml` and use it for scope as §1 says: where it deliberately differs from K (a note, a [P] mark or an A.20 entry), follow it and keep the item open until a human confirms; where it differs from K without such a mark, K wins.

### A.1 PLT: Platform/NFR

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `PLT-CORE-01` | Clinical journal | XL | R1 | B | Bitemporal append-only journal; entered-in-error/amend semantics; provenance |
| `PLT-CORE-02` | Enterprise hierarchy | L | R1 | B | Tenant>legal entity>facility>unit>bed; scoped config inheritance |
| `PLT-CORE-03` | State machines + invariants | L | R1 | B | Domain state machines; server-side safety invariants on all channels · *SI-01..21 kept; SI-20/21 restated (K §5.1)* |
| `PLT-CORE-04` | Event catalogue + outbox | M | R1 | B | Domain event catalogue; transactional outbox |
| `PLT-CORE-05` | Terminology service | L | R1 | B+I | SNOMED/LOINC/ICD-10 variants/UCUM/ATC + licence entitlements · *WHO ICD-10; SNOMED GPS until licensed (ADR-015)* |
| `PLT-CORE-06` | Rules engine | L | R1 | B | Versioned rules; simulation/replay; approval; effective dating (reg C) |
| `PLT-CORE-07` | Task/work-queue engine | M | R1 | B | Every item owned; SLA timer; orphan alarm · *Seam messages to hospital A are owned tasks (SI-03)* |
| `PLT-CFG-01` | Config-as-product | L | R1 | B | Typed registry; change sets; signed bundles; promotion; 3-way merge |
| `PLT-CFG-02` | Country packs | M | R1 | B | Effective-dated code sets, tax, claims, statutory reports · *Kurdistan pack; BP calendar addition kept (with PLT-UX-03)* |
| `PLT-CFG-03` | Forms engine | L | R1 | B | FHIR Questionnaire/SDC renderer + builder |
| `PLT-CFG-04` | Extension SDK | M | P2 | B | Plugin slots; SMART app launch |
| `PLT-UX-01` | Design system | M | R1 | B | Keyboard-first design system; WCAG 2.2 AA · *Western digits for clinical numerals (K §6.2)* |
| `PLT-UX-02` | Workstation shell | M | R1 | B | Silent ZPL wristband/label print; scanners; badge tap; FHIRcast · *Kurdish/Arabic label shaping or raster fallback (K §9.2)* |
| `PLT-UX-03` | i18n / RTL | L | R1 | B | Arabic RTL; Hijri+Gregorian; bilingual prints; multi-script/phonetic name search · *Re-scoped, same size: Kurdish+Arabic RTL; Hijri optional* |
| `PLT-UX-04` | Mobile app framework | L | R2b | B | Mobile clinical app framework; encrypted offline cache · *One app: nurse mode (BCMA, R2b) + physician mode (K §6.6) · Placed R2b: Mobile app is needed for nurse BCMA in R2b* |
| `PLT-OPS-01` | Cells | XL | R1 | B | Cell-based multi-tenant SaaS with in-country cells (IN/SA/AE) · *Becomes on-site hospital cells + Kurdistan central/DR site (K-16)* |
| `PLT-OPS-02` | On-prem install | L | R1 | B | On-prem/state-DC install from same signed artefacts · *P2→MVP inside PLT-SITE-01; cell at hospital A by M18* |
| `PLT-OPS-03` | Edge cell | XL | P3 | B | Edge cell (local primary) for low-connectivity hospitals · *Single-hospital cell now default; multi-site edge cell P3 (KDV-2)* |
| `PLT-OPS-04` | HA + DR | L | R1 | B | HA multi-AZ; cross-region DR; PITR · *On-site sync HA; Kurdistan DR site, RPO ≤15 min (K-17)* |
| `PLT-OPS-05` | Observability | M | R1 | B | Observability; RUM per screen/site; SLO dashboards |
| `PLT-OPS-06` | Performance gate | M | R1 | B | Synthea 1000-bed day-in-the-life load test in CI · *K tests 300-bed day on three-node cell (K-13)* |
| `PLT-OPS-07` | Zero-downtime releases | M | R1 | B | Expand/contract releases; N-2 on-prem policy · *Monthly on-site train; max drift N-1 (ADR-021)* |
| `PLT-EDGE-01` | Site edge agent (BP new) | L | R1 | B† | Plane B appliance: continuity replica, queue state, print spool, device bridge · *Outpatient-tier sites; merged into cell at hospitals (ADR-011)* |
| `PLT-SITE-01` | On-site cell (K new) | L+M | R1 | B† | Umbrella, 48 ew: PLT-OPS-02 (L) + fleet/licensing/certificates/updates (L) + on-site immutable backup, off-site replication (M) · *Sub-IDs not assigned; ew here excludes PLT-OPS-02* |
| `PLT-PWR-01` | Power-loss resilience (K new) | M | R1 | B† | Power-loss resilience (K §4.1); power design in ADR-026 · *Inferred R1: RG1 power obligations; M18 power-cut tests* |

### A.2 TRU: Trust plane, security, downtime

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `TRU-IAM-01` | SSO/MFA | L | R1 | B+I | SAML/OIDC SSO; SCIM; phishing-resistant MFA; badge tap-and-go |
| `TRU-IAM-02` | RBAC/ABAC | L | R1 | B | RBAC+ABAC+care relationship; privilege-gated clinical actions |
| `TRU-IAM-03` | Break-the-glass | S | R1 | B | Reason capture; review queue |
| `TRU-PRV-01` | Sensitivity labels | M | R1 | B | Labels + purpose-of-use propagated to UI/API/print/HIE · *SI-21 labels: HIV, MH, reproductive, GBV, MLC, VIP* |
| `TRU-PRV-02` | Consent management | M | R1 | B | Consent management incl. ABDM consent artefacts · *ABDM artefacts out; K consent registry (K §10)* |
| `TRU-AUD-01` | BALP audit | M | R1 | B | 100% PHI-access audit; tamper-evident; SIEM streaming · *Message report releases logged* |
| `TRU-AUD-02` | Privacy monitoring | M | P2 | B+I | Privacy monitoring; patient-facing access log · *Patient-visible access log P2 (K §10)* |
| `TRU-KEY-01` | Per-tenant KMS | M | R1 | B+I | Per-tenant KMS + BYOK/HYOK · *BP P2→MVP; HSM/TPM KMS, no HYOK (ADR-008); inferred R1* |
| `TRU-SEC-01` | Secure SDLC | M | R1 | B | IEC 81001-5-1/SSDF; SBOM/VEX; signed builds; VDP |
| `TRU-SEC-02` | ISO 27001 + SOC 2 | L | R1 | B | ISO 27001/27701/27017/27018 + SOC 2 Type II · *ISO 27001(+27701) ≈M24; SOC 2 only if a buyer asks · Placed R1: Controls built from R1; the certification itself is [HUMAN]* |
| `TRU-SEC-03` | Market attestations | M | R1 | B | CERT-In Safe-to-Host; NCA ECC/CCC; ADHICS; MeitY/CST · *Replaced, same size: ISO 27001 and local attestations · Placed R1: Controls built from R1; attestations are [HUMAN]* |
| `TRU-BCP-01` | Read-only continuity | L | R1 | B | Unit snapshots ≤15 min stale; shadow viewer; printable packets · *Edge-agent continuity R1; DR continuity instance by hospital A RG4* |
| `TRU-BCP-02` | Downtime ID blocks | M | R1 | B | Downtime MRN/encounter/accession blocks; offline wristband/label print · *Downtime accession numbers in outpatient lab protocol* |
| `TRU-BCP-03` | Back-entry | L | R1 | B | Back-entry + reconciliation keeping original event times · *Frequent outages; sized for back-entry (SI-10); inferred R1* |
| `TRU-BCP-04` | Immutable backups | L | R1 | B | Isolated immutable backups; clean-room rebuild; quarterly restore tests · *On site + DR site; ≥90 days of restore points* |
| `TRU-BCP-05` | Code-Dark drills | S | R1 | B | Drill tooling; SAFER self-assessment workbook · *BP P2→MVP; WAN- and power-cut drills gate RG3* |
| `TRU-REG-01` | QMS + Boundary Register | XL (BP L→XL) | R1 | B | ISO 13485/IEC 62304/ISO 14971 QMS; Regulatory Boundary Register service (reg Y) · *ISO 13485 certificate deferred; Register is Tier 2 switch (K-05)* |
| `TRU-REG-02` | Safety case + hazard log | L (BP M→L) | R1 | B | Hazard-log service; Release Evidence Pack generator · *DCB0129 model; safety case per release (K §5.3)* |

### A.3 ACC: Patient access

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `ACC-ID-01` | EMPI | L | R1 | B | Probabilistic match; steward queue; reversible merge/unmerge · *Cross-script gold set (S14-K); auto-merge precision ≥99.9%* |
| `ACC-ID-02` | National ID plug-ins | M | R1 | B | ABHA; Absher/Nafath/Iqama; Emirates ID/UAE Pass · *Replaced, same size: Iraqi ID documents (card, residency, passport, UNHCR/IDP)* |
| `ACC-ID-03` | Aliases, newborn, photo | M | R1 | B | Unknown/trauma/MCI aliases; distinct newborn naming; photo capture · *Inferred R1 (registration); K §4.3 Identity list* |
| `ACC-REG-01` | Registration | M | R1 | B | Sponsor/payer selection; coverage; consents; AR/EN names · *Output language captured at registration (K §6.7)* |
| `ACC-ADT-01` | ADT | L | R2a | B | ADT incl. pending/LOA/corrections; HL7 ADT broadcast |
| `ACC-ADT-02` | Bed board | M | R2a | B | Bed state machine; EVS status; isolation |
| `ACC-SCH-01` | Scheduling | L | R1 | B | Provider/resource scheduling; templates; overbooking; waitlists · *Friday–Saturday weekend; Kurdistan holidays* |
| `ACC-SCH-02` | Referral tracking | M | R1 | B | Referral intake; order-to-completion tracking · *BP P2→MVP; owned queues across hospital-A seam* |
| `ACC-OPD-01` | OPD token journey | M | R1 | B | Token/queue; reg>vitals>consult>bill>lab>pharmacy journey; display boards · *Display boards in R1.1* |
| `ACC-OPD-02` | ABDM Scan-and-Share | S | DROPPED-K | B | ABDM QR registration (IN) · *Dropped: India national rail* |
| `ACC-OPD-03` | Kiosk | M | P2 | B+I | Self-service check-in + payment |
| `ACC-TRF-01` | Transfer centre | M | P2 | B | Transfer centre; patient transport tasks |

### A.4 CLN: Clinical core

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `CLN-CHT-01` | Chart + banner | L | R1 | B | Banner: photo, 2 IDs, allergies, code status, isolation, dated weight · *Name in patient's script plus Latin (SI-01, SI-16)* |
| `CLN-CHT-02` | Problems/allergies | M | R1 | B | Coded problems; coded allergies (reaction/severity); home meds · *'NKA' distinct from 'not assessed'* |
| `CLN-CHT-03` | Results review | M | R1 | B | Results review; trending; cumulative views · *Inferred R1 (wedge LIS/RIS results)* |
| `CLN-ORD-01` | Orderables + order sets | L | R1 | B | Orderables catalogue; versioned order sets |
| `CLN-ORD-02` | CPOE | XL | R1 | B | All timing types; verbal read-back/co-sign; lifecycle; order-to-result tracking · *OPD orders R1; inpatient CPOE R2b; R2a orders on paper · Outpatient orders R1; inpatient CPOE R2b* |
| `CLN-CDS-01` | Drug KB adapter | M | R1 | P | Drug KB abstraction (FDB/Medi-Span/Multum/MIMS/regional); local re-tiering · *Regional brand mapping; R1 OPD use unstated · Placed R1: [P] Pulled to R1 so outpatient e-prescribing is screened* |
| `CLN-CDS-02` | Order checks | L | R1 | B | DDI/allergy/dose/route/duplicate/renal/age checks (reg C) · *KB screening at R2a transcription; CPOE checks R2b · Placed R1: [P] Outpatient subset in R1; transcription checks R2a; full CPOE checks R2b* |
| `CLN-CDS-03` | CDS telemetry + harness | M | R1 | B | Override/PPV/alert-burden telemetry; CPOE error-category regression harness (Leapfrog-style, unofficial) · *Harness runs after every KB/content release (K §6.3) · Placed R1: CDS runs from R1, so telemetry and the harness do too* |
| `CLN-CDS-04` | CDS Hooks + CQL | M | P2 | B+I | CDS Hooks client; CQL engine |
| `CLN-CDS-05` | NEWS2/PEWS/MEOWS | M | R2b | B | EWS from validated obs; escalation tasks; obs frequency (reg Y) · *Regulated Module #1; non-ICU wards; Register-gated* |
| `CLN-CDS-06` | Sepsis screen | S | P2 | B | Rule-based non-interruptive worklist flag (reg Y) · *Regulated Module #2 (K-07)* |
| `CLN-CDS-07` | Predictive deterioration | M | P3 | P | Cleared partner; silent-mode local validation (reg Y) · *Conflict: K §4.3 P2 vs K §11.2 P3 · Placed P3: Device-grade partner model, silent first (K §11.2 AI-3)* |
| `CLN-CDS-08` | VTE prompts | S | R2b | B | VTE risk assessment; prophylaxis prompts · *Inferred R2b (inpatient CPOE); sweep candidate (K §5.6)* |
| `CLN-DOC-01` | Clinical notes | L | R1 | B | H&P/progress/consult notes; templates; co-sign; addenda · *English clinical text; OPD chart in R1* |
| `CLN-DOC-02` | Copy-forward provenance | M | R1 | B | Copy-forward provenance; bloat indicators; change-since-last-note · *BP P2→MVP (bloat indicator BP R2.1); K §4.2 silent · Placed R1: Provenance from the first note; bloat indicators by R2b* |
| `CLN-DOC-03` | Discharge + AVS | M | R2b | B | Discharge navigator; summary; bilingual AVS · *Patient instructions: Sorani/Badini/Arabic approved templates* |
| `CLN-DOC-04` | HIM + legal record | L (BP M→L) | R2b | B | Deficiencies; scanning; ROI; amendments; LHR; signatures; retention · *Manual ROI register until R2.1; never auto-delete* |
| `CLN-MRC-01` | Med rec | M | R2b | B | Med rec at admission/transfer/discharge · *Polyclinic history is reconciliation input only (SI-09)* |
| `CLN-HND-01` | I-PASS | M | R2b | B | I-PASS handoff; team/rounding lists · *Inferred R2b (inpatient)* |
| `CLN-RES-01` | Results inbox | M | R2b | B | Routing; surrogates; unacknowledged monitoring; pending-at-discharge queue · *Named in R2b; R1 OPD inbox unstated · Outpatient result acknowledgement runs in R1 through DX-ORD-01* |
| `CLN-ED-01` | ED triage + board | L | R2b | B | ED quick-reg; configurable triage; tracking board with timers · *One triage scale per tenant* |
| `CLN-ED-02` | ED pathway clocks | M | R2b | B | Stroke/STEMI/sepsis clocks; disposition; boarding view · *Workflow timers, not a device* |
| `CLN-ED-03` | MCI mode | M | P2 | B | MCI/disaster mode |
| `CLN-BH-01` | Suicide screen + restraint | S | R2b | B | Suicide screening; restraint/seclusion orders and timers · *Inferred R2b (inpatient orders)* |
| `CLN-IPC-01` | Isolation flags | S | R1 | B | Isolation flags and alerts · *Banner (R1) and bed board (R2a) both carry isolation · Placed R1: Banner flag in R1; bed-board use in R2a* |
| `CLN-IPC-02` | HAI surveillance | M | P2 | B | HAI surveillance; device-days; outbreaks |
| `CLN-AMS-01` | Stewardship | M | P2 | B | Restricted-antimicrobial approval; time-outs; DOT · *BP P2→MVP; K →P2; stewardship control set at go-live* |
| `CLN-ACP-01` | Code status + ACP | S | R2a | B | Code status; advance care planning documents · *Code status on banner (R1); 'code documentation' in R2b · Placed R2a: Inpatient workflow; the banner field exists from R1* |
| `CLN-INC-01` | Incidents + RCA | M | R1 | B | Incident/safety-event reporting; RCA workflow · *In K §4.3 Quality MVP; release unstated · Placed R1: Safety-event reporting from the first go-live* |
| `CLN-QI-01` | Accreditation KPIs | M | R1 | B | NABH/CBAHI/JAWDA/JCI indicator capture · *Replaced, same size: JCI + KRG licensing indicators · Placed R1: Measure engine in R1; JCI and KRG packs complete by R2b* |
| `CLN-IMM-01` | Immunisation (BP new) | M | R1 | B† | Administration/history; lot from stores; BCMA scan; VXU, FHIR Immunization · *BCMA scan with inpatient BCMA (BP); ABDM part unaddressed in K* |

### A.5 NUR: Nursing

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `NUR-FLW-01` | Flowsheets | L | R2b | B | Assessments; flowsheets; I&O; LDAs; charting by exception · *UI language per nurse; drug names, units in Latin* |
| `NUR-FLW-02` | Risk scores | M | R2b | B | Braden/Morse/delirium with care-plan triggers |
| `NUR-CP-01` | Care plans | M | R2b | B | Care plans; shift worklists; nurse handoff |
| `NUR-WND-01` | Wound photos | S | R2b | B | Wound photography + documentation |
| `NUR-STF-01` | Acuity staffing | M | P3 | B | Acuity-based staffing view |

### A.6 MED: Medication

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `MED-PHV-01` | Pharmacist verification | L | R2b | B | Verification queue with clinical screening · *Pharmacist-cover alarm; 24×7 cover is an RG1 obligation* |
| `MED-FRM-01` | Formulary | M | R1 | B | Formulary; LASA/tall-man; high-alert flags; item-master link · *Inferred R1 (OP POS); regional brands* |
| `MED-DSP-01` | IP dispensing | L | R2a | B | Unit dose/ward stock; returns; charge on dispense/admin · *Against transcribed paper orders, Core transcription control set* |
| `MED-OPP-01` | OP pharmacy POS | M | R1 | B | Retail POS; batch/expiry; e-Rx receipt · *Re-scoped: retail, dual currency, KRG pricing; H1/X, DPCO dropped* |
| `MED-MAR-01` | eMAR | L | R2b | B | Schedules; PRN reassessment; independent double-check; titrations · *No MAR from transcribed orders in R2a* |
| `MED-BCM-01` | Mobile BCMA | L | R2b | B | Patient+med scan; override reasons; dashboards; offline cache · *Unverified patient-supplied medicines never scannable* |
| `MED-INF-01` | Infusion model | M | R2b | B | Infusion data model; pump-channel association; manual rate/volume checks · *Inferred R2b (with eMAR)* |
| `MED-INF-02` | Smart pumps | L | P2 | I | PIV/IPEC via first vendor gateway (reg C) · *Only once BCMA ≥95% (K-09)* |
| `MED-ADC-01` | ADC/robots | M | P2 | I | ADC/robot interfaces; override policy |
| `MED-CS-01` | Controlled drugs | M | R1 | B | Controlled-substance registers + reconciliation (NDPS/SFDA/MOHAP) · *Replaced, same size: Iraqi narcotics registers* |
| `MED-ONC-01` | Chemotherapy | L | P2 | B | Regimens; BSA dosing; dual verification (reg C) |
| `MED-IV-01` | IV compounding | M | P3 | B+I | IV compounding/TPN; IV workflow interfaces |
| `MED-ERX-01` | National e-Rx | M | DROPPED-K | B | Wasfaty; Riayati/NABIDH; ABDM e-Rx · *Dropped: national e-Rx interface (K §14.2)* |
| `MED-DOSE-01` | Dose Engine (BP new) | L | P2 | B† | Shared Class C Dose Engine (Tier 2) · *MVP→P2 (≈M50); extended fallback control set meanwhile* |
| `MED-TNT-01` | Track-and-trace (BP new) | M | DROPPED-K | B† | SFDA RSD and UAE Tatmeen from GS1 scans · *Dropped: KSA/UAE-only* |
| `MED-KRI-01` | Brand master + labels (K new) | M | R1 | B† | Regional brand master; in-house unit-dose barcode labels · *Release unstated; brands serve POS, labels serve BCMA · Placed R1: Brand master for the R1 POS; unit-dose labels by R2a* |

### A.7 DX: Diagnostics (LIS, RIS, imaging, transfusion)

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `DX-ORD-01` | Diagnostic order lifecycle | L | R1 | B | Order>specimen/exam>result>ack |
| `DX-CRT-01` | Critical results | M | R1 | B | Named recipient; read-back; escalation · *Extended to external referring doctors (SI-04)* |
| `DX-LAB-01` | Phlebotomy + accessioning | L | R1 | B | Worklists; bedside labels; accessioning; tracking |
| `DX-LAB-02` | Analyzer connectivity | L | R1 | B+I | Middleware + direct ASTM/HL7 drivers; LAW-ready |
| `DX-LAB-03` | Validation + autoverification | L | R1 | B | Result validation; autoverification v1; delta/critical rules; reports (reg C) · *Autoverification v1 R1.1; manual validation until then* |
| `DX-LAB-04` | QC / lab-quality pack | M (BP L; K M) | R1 | B | Levey-Jennings/Westgard QC; reagent/lot tracking · *NABL upsizing dropped; ISO 15189-aligned quality pack kept* |
| `DX-LAB-05` | Send-outs | M | R1 | B | Send-out tests; reference-lab interfaces |
| `DX-LAB-06` | ISO 15189 doc control | M | P3 | B | Document control; risk register · *BP NABL condition (P3→P2) not addressed in K* |
| `DX-MIC-01` | Microbiology | L | P2 | B | Culture; AST; cascade reporting; antibiogram · *WHONET/GLASS export* |
| `DX-AP-01` | Anatomic pathology | L | P3 | B | AP workflow; synoptic reporting |
| `DX-POC-01` | POCT | M | P2 | I | POCT data-manager integration |
| `DX-RIS-01` | RIS core | L | R1 | B | Orders; scheduling; protocoling; MWL/MPPS broker; tracking · *Moved into wedge (KDV-10); BP had R2* |
| `DX-RIS-02` | Radiology reporting | M | R1 | B | Templates; structured reports; actionable-finding follow-up · *BP Form F gate dropped (PCPNDT out)* |
| `DX-RIS-03` | Dose capture | M | P2 | B | RDSR capture; exceedance review · *Not in K §4.3; K §14.2 keeps P2* |
| `DX-PAC-01` | PACS integration | M | R1 | I | DICOMweb + IID launch; bundled OSS PACS tier · *OSS viewer labelled non-diagnostic* |
| `DX-CRD-01` | ECG/endoscopy | M | P2 | I | ECG/cardiology + endoscopy report integration |
| `DX-BB-01` | Bedside transfusion | M | R2b | B | BCMA extension; orders; consent; reactions (reg C) · *Two-person e-witness; relabelled units; Register-gated T2* |
| `DX-BB-02` | Blood bank interface | M | R2b | I | e-RaktKosh/third-party/cleared BECS interface · *Not dropped in K §4.1; K §9.1 assumes no interface · Placed R2b: Optional inbound adapter only; no interface assumed (K §9.1)* |
| `DX-BB-03a` | Blood-centre inventory (BP split) | L | P2 | B | Inventory; ISBT 128 labelling (regulated track) |
| `DX-BB-03b` | Compatibility engine (BP split) | XL | DROPPED-K | B | IVD-grade compatibility engine · *Never built; licensed if ever needed* |
| `DX-BB-KRI-01` | Unit receipt + relabel (K new) | S | R2b | B+I† | Receipt of public blood-bank units; relabel with our barcode · *Blind two-person double entry; mismatch quarantines (SI-11)* |

### A.8 DEV: Devices

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `DEV-GW-01` | Device gateway | L | R2.1 | B+I | Middleware PCD-01/DEC; device–patient association · *Inferred: validated ICU monitor feed R2.1 · Nothing clinical depends on a device feed before R2.1* |
| `DEV-VAL-01` | Vitals validation UX | M | R2.1 | B | Nurse validation of auto-captured vitals; artifact marking · *Inferred with ICU monitor feed (R2.1)* |
| `DEV-ALM-01` | Alarm analytics | M | P3 | I | Via ACM-capable platform (reg Y) · *Alarm forwarding never built* |
| `DEV-SDC-01` | SDC/SDPi | L | P3 | B | ISO/IEEE 11073 SDC plug-and-play (reg C) · *Not in K §4.3; K §14.2 keeps P3* |

### A.9 SPC: Specialty

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `SPC-OT-01` | OT booking | M | R2a | B | OT booking/scheduling; list management · *Privileges gate OT booking (K §12.2)* |
| `SPC-OT-02` | WHO checklist | S | R2b | B | WHO checklist; consent; site marking; pre-op checklist |
| `SPC-OT-03` | Intra-op record + charging | M | R2a | B | Intra-op record; counts; implants/consumables to charge+stock; op note · *OT billing R2a; clinical intra-op record release unstated · OT charging and stock R2a; clinical intra-op record R2b* |
| `SPC-AN-01` | Anaesthesia record | M | R2.1 | B | Pre-assessment; intra-op/PACU record (manual/semi-auto vitals) · *Lite; paper record until R2.1* |
| `SPC-AN-02` | Full AIMS | L | P2 | B | Machine/monitor feed (reg C) |
| `SPC-OT-04` | OR analytics | M | P2 | B | Utilisation; turnover; first-case on-time |
| `SPC-ICU-01` | ICU flowsheet | L | R2b | B | q1h flowsheet; fluid balance; drips; ventilator; bundles · *Validated monitor feed in R2.1* |
| `SPC-ICU-02` | ICU severity scores | S | P2 | B | APACHE II/SOFA (reg C) |
| `SPC-ICU-03` | Tele-ICU | L | P3 | B+P | Tele-ICU |
| `SPC-MAT-01` | L&D + newborn | M | R2a | B | L&D record; newborn registration; mother–baby link; birth notification · *Re-scoped; KRG birth notification R2a; L&D release unstated · Newborn registration, mother-baby link and birth notification R2a; electronic L&D record R2b* |
| `SPC-MAT-02` | Antenatal + partograph | L | P2 | B | Antenatal episode; WHO LCG; fetal monitoring |
| `SPC-NIC-01` | NICU | M | P2 | B | NICU flowsheets; feeds; human-milk tracking |
| `SPC-ONC-01` | Oncology | L | P2 | B | Regimens; cycles; staging |
| `SPC-DIE-01` | Diet orders | S | R2b | B | Diet orders with allergy logic; tray tickets · *Religious preferences; inferred R2b (inpatient orders)* |
| `SPC-REH-01` | Rehab | M | P2 | B | Rehab/physio/dietitian documentation |
| `SPC-DIA-01` | Dialysis | M | P3 | B | Dialysis documentation; machine integration |
| `SPC-OTH-01` | Specialty kits | L | P3 | B+P | Ophthalmology/dental/cath/endoscopy |
| `SPC-DTH-01` | Death certificate | S | R2a | B | MCCD/national forms; mortuary register · *Re-scoped: KRG forms; WHO-format ICD-10 cause of death* |

### A.10 RCM: Revenue

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `RCM-ACC-01` | Patient account + ledger | XL | R1 | B | Single patient financial account; append-only ledger · *Functional-currency ledger keeps original amounts (K §12.1)* |
| `RCM-CHG-01` | Charge router | L | R1 | B | Charges from orders, administrations, bed-days, supplies |
| `RCM-TAR-01` | Tariff engine | L | R1 | B | Price lists; room categories; packages; effective dating · *IQD lists default; USD only where permitted (L-33)* |
| `RCM-CSH-01` | Cashiering | L | R1 | B | Deposits; interim bills; discounts; refunds; shifts; UPI/mada/card · *Re-scoped, same size; dual currency builds on it* |
| `RCM-TAX-01` | Tax engine | M | R1 | B | Tax + e-invoicing (GST; ZATCA Fatoora; UAE VAT) · *Replaced, same size: Kurdistan receipt/tax rules (Q-K6)* |
| `RCM-INS-01` | Payer contracts + claims | L | R1 | B | Contract rules; eligibility; pre-auth; claims with attachments · *Re-scoped: corporate/NGO/insurer credit, document packs; automation R1.1* |
| `RCM-NAT-01` | NPHIES | L | DROPPED-K | B | NPHIES adapter (SA) · *Dropped: KSA national rail* |
| `RCM-NAT-02` | NHCX/PM-JAY/TPA | L | DROPPED-K | B | NHCX + PM-JAY TMS + TPA workflows (IN) · *Dropped: India national rail* |
| `RCM-NAT-03` | Shafafiya/eClaimLink | M | DROPPED-K | B | DoH/DHA XML adapters (AE) · *Dropped: UAE national rail* |
| `RCM-COD-01` | Coding workbench | M | R2.1 | B | Coding workbench (ICD-10-AM/SBS; ICD-10; CPT); CDI worklists · *Re-scoped: WHO ICD-10, no CPT/IHACPA; manual sheet until R2.1* |
| `RCM-DEN-01` | Denials | M | R1 | B | Rejection/denial queues; resubmission; payer aging · *Inferred R1 (credit flow); denial root-cause queues* |
| `RCM-SCH-01` | Corporate credit | M (−3) | R1 | B | Government scheme + corporate credit billing (CGHS/ECHS/corporates) · *Corporate credit stays; scheme part split to P2* |
| `RCM-SCH-01 · part: scheme` | Scheme billing | ≈3 ew | P2 | B | Government-scheme part of RCM-SCH-01 · *Activated when national insurance reaches the Region* |
| `RCM-GRP-01` | DRG grouper SPI | M | DROPPED-K | I | AR-DRG shadow billing; IR-DRG (SA;AE) · *BP P2→MVP (R3 KSA); K drops: no DRG grouper* |
| `RCM-AI-01` | AI coding | M | P2 | P | AI coding suggestions with confidence routing |
| `RCM-CST-01` | Costing | L | P3 | B | Patient-level costing (TDABC/PLICS) |
| `RCM-US-01` | US RCM | XL | DROPPED-K | B+I | X12; Da Vinci; price transparency (US) · *Dropped: US-only (K §14.2)* |

### A.11 ERP: ERP

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `ERP-INV-01` | Stores | L | R1 | B | Item master; stores; FEFO; indents; ward stock; consumption-to-charge · *Inferred R1 (OP POS dependency)* |
| `ERP-PRC-01` | Procurement-lite | M | R2.1 | B | PR>PO>GRN>3-way match; vendor master · *K R2.1 says 'breadth'; base release unstated* |
| `ERP-FIN-01` | AP/AR + GL export | M | R1 | B+I | AP/AR; GL journal posting/export · *Daily GL journals R1 (K §9.1); AP/AR breadth R2.1* |
| `ERP-FIN-02` | Lite GL | L | P2 | B | Native lite GL (multi-entity, multi-currency); fixed assets |
| `ERP-FIN-03` | ERP connectors | M | P2 | I | SAP S/4; Oracle Fusion; Workday; Dynamics · *Not in K §4.3; K §14.2 keeps P2* |
| `ERP-IMP-01` | Implant/UDI | M | P2 | B | Implant/UDI capture; consignment; recall trace · *K §12.2 puts consignment in MVP procurement-lite · Consignment bill-only PO built in R2.1 with ERP-PRC-01* |
| `ERP-HTM-01` | CMMS | M | P2 | B | Biomedical asset register; PM; work orders |
| `ERP-HR-01` | Staff master | M | R1 | B | Staff master; credentialing/privileging records · *Medical Syndicate/IMA registration IDs; inferred R1* |
| `ERP-HR-02` | Payroll integration | M | P2 | I | HR/payroll/attendance via local payroll · *Always integrated* |
| `ERP-ROS-01` | Rostering | M | P2 | B | Basic rostering; acuity staffing |
| `ERP-SVC-01` | Support services | M | P2 | B | CSSD; linen; housekeeping/BMW; diet kitchen · *CSSD-lite (K §4.3)* |

### A.12 OPS: Operations

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `OPS-FLW-01` | Discharge clearance | M | R2a | B | Non-blocking clearance; expected discharge date; discharge tasks · *Inferred R2a (discharge billing); SI-12 extended* |
| `OPS-CMD-01` | Command-centre data | L | P2 | B | Command-centre data layer + tiles |
| `OPS-PRD-01` | Predictive discharge | M | P3 | B | Predictive discharge/census forecasting · *Conflict: K §4.3 P3 vs K §11.2 forecasts P2* |
| `OPS-MIS-01` | MIS dashboards | M | R1 | B | Revenue; collections; payer mix; occupancy/ALOS; TAT · *MIS basics R1, breadth R1.1; owner's dashboard by currency* |
| `OPS-STAT-01` | Statutory returns | M | R1 | B | HMIS/DHIS2; MoH statistics; notifiable disease · *Replaced, same size: KRG Ministry returns; inpatient R2a* |
| `OPS-RTL-01` | RTLS | M | P2 | I | RTLS location events · *BP/K §4.3 list RTLS ingestion P2; counts keep P3 · Placed P2: RTLS ingestion is P2 (K §4.3, §9.2); the engine is never built* |
| `OPS-STAT-02` | Statutory registers (BP new) | L | R1 | B† | Locked append-only registers; per-format export · *Kurdistan content; MLC, births/deaths R2a* |

### A.13 INT: Interoperability

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `INT-ENG-01` | HL7 v2 engine | L | R1 | B+I | MLLP/TLS; ack-state visibility; replay; owned queues |
| `INT-FHIR-01` | FHIR façade | L | R1 | B+I | FHIR R4 façade (IPA; SMART; Bulk; Subscriptions) · *SMART/Bulk/Subscriptions in R1.1* |
| `INT-DOC-01` | Documents | M | R1 | B | PDF/A + CDA/FHIR documents from one source · *K §4.3 lists PDF/A + FHIR (no CDA)* |
| `INT-ABDM-01` | ABDM | L | DROPPED-K | B | ABDM M1/M2/M3 (IN) · *Dropped: India national rail* |
| `INT-SEHE-01` | SeHE | M | DROPPED-K | B | Saudi HIE connectivity (SA) · *Dropped: KSA national rail* |
| `INT-UAE-01` | UAE HIEs | L | DROPPED-K | B | Malaffi/NABIDH/Riayati adapters (AE) · *Dropped: UAE national rail* |
| `INT-IPS-01` | IPS $summary | M | R1 | B | IPS $summary generation · *Conflict: K §4.3/§9 MVP 'from day one'; §4.1 silent* |
| `INT-PH-01` | Public-health reporting | M | P2 | B | IHIP/IDSP; HESN · *Not in K §4.3; notifiable diseases via OPS-STAT (R1)* |
| `INT-OEHR-01` | openEHR adapter | M | P3 | I | openEHR CDR adapter (EHRbase) · *Kept (K §14.2)* |
| `INT-EU-01` | EHDS | XL | DROPPED-K | B | EHDS components (EU) · *Dropped: EU-only (K §14.2)* |
| `INT-US-01` | ONC/TEFCA | XL | DROPPED-K | B+P | ONC + TEFCA via partner (US) · *Dropped: US-only (K §14.2)* |
| `INT-SEAM-01` | Group seam bridge (BP new) | M | R1 | B† | Alternate IDs from legacy ADT; REF/ADT/MDM; ORM/OML/ORU with ack state · *Hospital-A seam until its M37 go-live* |

### A.14 AI: AI and data

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `AI-GW-01` | AI gateway | L | P2 | B | In-country model routing; prompt mgmt; evaluation; kill switch · *MVP→P2 (≈M42); counsel-approved region pinning* |
| `AI-GOV-01` | AI control plane | L | P2 | B | Registry; model cards; provenance; draft states; monitoring · *MVP→P2; K costs gateway + plane at 20 total* |
| `AI-AMB-01` | Ambient OPD | M | P3 | P | Ambient OPD documentation (EN/AR/HI), ≥2 partners · *MVP→P3; Sorani/Badini only after S8-K* |
| `AI-DCS-01` | Discharge draft | M | P2 | B | Source-linked discharge summary draft; clinician sign-off · *MVP→P2; English drafts with omission checklist* |
| `AI-SUM-01` | Chart summary | M | P2 | B | Chart summary / pre-visit brief · *Not in K §4.3; K §14.2 keeps P2* |
| `AI-NUR-01` | Nursing ambient | M | P3 | P | Nursing voice/ambient to flowsheets · *Conflict: K §4.3 P3 vs §14.2 arithmetic P2* |
| `AI-RCM-01` | Claim scrubbing | M | P2 | B | Pre-submission scrubbing; denial prediction · *K §4.3 marks claim scrubbing (P)* |
| `AI-PAT-01` | Result explanations | S | P2 | B | Templated result explanations only (K §11.2): AI may suggest a template, never generate patient text; never used for SI-21-labelled results or pregnancy tests; released only through the §9.30 release rule (control-plane requirement G10, SI-07) · *Not in K §4.3; K §14.2 keeps P2* |
| `AI-INB-01` | In-basket AI | M | P3 | B | In-basket triage; grounded draft replies · *Not in K §4.3; K §14.2 keeps P3* |
| `AI-IMG-01` | Imaging AI | M | P3 | I | AIW-I/AIR orchestration; governance ledger (reg Y) |
| `AI-DAT-01` | Reporting replica | M | R1 | B | Reporting replica ≤60 s; report builder · *On the on-site cell; inferred R1 (MIS basics)* |
| `AI-DAT-02a` | CDC bronze (BP split) | M | R1 | B | CDC bronze landing in object storage · *Central site; migration staging; inferred R1* |
| `AI-DAT-02b` | Silver/OMOP (BP split) | M | P2 | B | Silver layer; OMOP; SQL-on-FHIR views |

### A.15 DFD: Front door

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `DFD-MSG-01` | SMS/WhatsApp | M | R1 | B+I | Reminders/outreach without an account · *DLT dropped; OTP + knowledge-check release; Viber via KRI-MSG-01* |
| `DFD-BOK-01` | Booking link | M | R1.1 | B | Web booking link; rules-based self-scheduling · *BP R2.1; K §4.2 silent · Placed R1.1: Ships with wallet payment links* |
| `DFD-PAY-01` | Payment links | M | R1.1 | B+I | Payment links; bill pay (UPI/mada/cards) · *Re-scoped: wallet links (FIB, FastPay, ZainCash, Qi Card)* |
| `DFD-REC-01` | Report download | M (−3) | R1 | B | Report download + national PHR push · *Download by OTP/expiring link stays; PHR part dropped* |
| `DFD-REC-01 · part: PHR push` | PHR push | ≈3 ew | DROPPED-K | B | National PHR push (ABHA app; Sehhaty) · *No national PHR* |
| `DFD-APP-01` | Portal/app | XL | P2 | B | Records; messaging; proxy; refills |
| `DFD-TEL-01` | Teleconsultation | M | P2 | B+I | Video with booking and billing |
| `DFD-CRM-01` | CRM | M | P2 | B | CRM/contact centre; leads; international patient desk · *Not in K §4.3; K §14.2 keeps P2* |
| `DFD-RPM-01` | RPM | L | P3 | B+P | RPM / hospital-at-home |

### A.16 IMP: Implementation tooling and telemetry

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `IMP-FND-01` | Foundation content | XL | R1 | B | Order sets, flowsheets, templates, CDS, roles, reports, charge masters · *Re-scoped: Kurdistan foundation build (regional brands, trilingual forms)* |
| `IMP-MIG-01` | Migration Workbench | XL (BP L→XL) | R1 | B | 12-part Migration Workbench; legacy archive viewer · *Paper and local-billing packs; master-data build* |
| `IMP-RDY-01` | Readiness tooling | L (BP M→L) | R1 | B | Readiness scorecard; cutover/rehearsal; rollback; model-ward/UAT kits · *RG3 adds WAN-, power-cut, dual-currency drills* |
| `IMP-TRN-01` | Training tooling | M | R1 | B | Training sandbox; micro-learning; proficiency tracking |
| `IMP-TEL-01` | Clinician telemetry | M | R1 | B | Clinician-time + usability telemetry; micro-surveys · *K §4.3 drops 'telemetry' from BP's tooling list · Placed R1: Usability telemetry from the first go-live (T-120 baselines)* |
| `IMP-SUP-01` | Service desk + status page | S | R1 | B+I | Service-desk integration; ticket telemetry; status page · *Inferred R1 (24×7 support M21); status page (K §13.7)* |
| `IMP-GOV-01` | Governance intake | S | R2.1 | B | Requests; scoring; 30-day loop closure · *BP P2→MVP; manual path until R2.1* |
| `IMP-MAT-01` | Maturity + evidence packs | M | P2 | B | EMRAM readiness report; accreditation evidence packs |
| `IMP-CRT-01` | Partner academy | M | P2 | B | Analyst/partner certification academy · *Academy live by M36 (K §13.7)* |

### A.17 KRI: Kurdistan features (K §4.1)

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `KRI-LOC-01` | Trilingual UI/outputs | M | R1 | B† | Sorani, Arabic, English UI; trilingual outputs · *Trilingual receipts and reports at R1* |
| `KRI-LOC-02` | Badini templates | S | R1 | B† | Badini patient templates · *Release unstated; Duhok review; Latin-script need via S7-K · Placed R1: Framework in R1; Badini content before the first Duhok go-live* |
| `KRI-ID-01` | Iraqi identity + cross-script EMPI | L (+12 net) | R1 | B† | Iraqi name parts; Kurdish/Arabic/Latin transliteration; cross-script matching (K §8) · *+12 net over ACC-ID-02* |
| `KRI-RCM-01` | Dual-currency cashiering | M | R1 | B† | IQD/USD; per-currency drawers; change in either currency; rounding |
| `KRI-RCM-02` | Doctor-fee ledger | M | R1 | B† | Practitioner fee lines; package shares; payout ledger; statements · *No referral-commission feature* |
| `KRI-PAY-01` | Card/wallet adapters | M | R1 | B† | Card-terminal and wallet adapters; K §12.1 pairs them with three-way reconciliation · *Wallet links R1.1; no card PAN in HMS* |
| `KRI-STAT-02` | DHIS2 export | S | R1.1 | B† | DHIS2 data-value sets via Web API · *Only if the KRG uses DHIS2* |
| `KRI-MSG-01` | Viber + SMS gateways | S | R1 | B† | Viber; local SMS gateways · *Per-site GSM/SMPP gateway in K §9.1 (R1)* |

### A.18 Totals after the placements above

| Phase | Feature IDs | Engineer-weeks |
|---|---|---|
| R1 | 110 | 1606 |
| R1.1 | 3 | 19 |
| R2a | 9 | 86 |
| R2b | 25 | 266 |
| R2.1 | 6 | 55 |
| P2 | 48 | 558 |
| P3 | 19 | 266 |
| DROPPED-K | 14 | 326 |
| **MVP (R1 to R2.1)** | **153** | **2032** |
| **All** | **234** | 3182 |

These per-feature sums differ slightly from K's release-level figures (≈2,060 MVP engineer-weeks; ≈1,370 squad PM including the control sets) because K costs the AI gateway and control plane at 20 engineer-weeks where R14 sizes them at 40, and because of the placements noted above. K's release-level plan of record governs capacity; this table governs scope.
### A.19 Controls and items without feature IDs

| Item | Phase | Where specified |
|---|---|---|
| Core transcription control set (control set B) | R2a | §10.3 |
| Stewardship control set (control set C) | R2a (Core sites at transcription; Clinical Safety sites at order entry) | §10.3 |
| Patient-supplied medicine workflow | R2a | §9.10; SI-12 |
| Extended Dose Engine fallback control set (control set A), including the KB ≥10× hard stop and the pharmacist-cover alarm | R2b (and at transcription in R2a) | §10.3; SI-05 |
| Chaperone documentation; guardian or co-signer consent | R2b | §14.7 |
| Iraq federal pack (federal returns, insurance scheme adapter, practitioner fields, Arabic-first review) | P2 | §11.10 |
| IHE ACM consumer; referrer portal without commission features; Ramadan mode; same-gender clinician preference; cross-referenced group identities; regional-cloud ciphertext backups | P2 | §12.8, §9.30, §11.7, ADR-006, Q-K2 |
| First AI SKUs: dictation structuring, insurer document-pack assembly, template-suggested patient instructions, no-show outreach; grounding service; HITL UX kit | P2 | §17 |
| Federated benchmarking; app marketplace; partner-only triage AI | P3 | §17.1 |

### A.20 Source conflicts and how this prompt resolves them

| Conflict | Resolution used here (record each in `OPEN-QUESTIONS.md` for confirmation) |
|---|---|
| AI gateway and control plane: 20 engineer-weeks in K §4.1 vs 40 in R14 | Scope follows R14 (both features); capacity planning follows K |
| `INT-IPS-01`: "from day one" (K §4.3, §9) vs not moved in K §4.1 | R1 |
| `AI-NUR-01`, `CLN-CDS-07`: P2 in places, P3 in K §11.2 | P3 |
| `OPS-PRD-01` predictive discharge P3 vs AI-0 forecasts P2 | Operational forecasts P2; predictive discharge P3 |
| `OPS-RTL-01`: P3 in counts vs RTLS ingestion P2 in K §4.3 | P2 ingestion; never an engine |
| `DX-BB-02` blood-bank interface kept vs "no interface assumed" | Optional inbound adapter in R2b; manual receipt is the default |
| `ACC-ID-02` vs `KRI-ID-01` | One identity epic; build both IDs together in WP-1.2 |
| `DFD-MSG-01`: K drops BP's +4 as DLT governance, but the +4 also covered OTP/expiring-link release | Keep the release rule in R1 |
| `DX-LAB-04` back to M vs the lab-quality pack kept in K §4.3 | Build the lab-quality pack in R1 under `DX-LAB-04`/`DX-LAB-05`; watch capacity |
| `DEV-GW-01`: dependency of the ICU flowsheet (R14) vs monitor feed in R2.1 (K) | R2.1; the R2b ICU flowsheet uses nurse-entered vitals |
| `TRU-AUD-02`: privacy analytics MUST at GA vs P2 | Rules-based privacy reports by R2b; full analytics and the patient-visible log in P2 |
| `ERP-IMP-01` at P2 vs consignment in MVP procurement-lite (K §12.2) | Consignment bill-only PO in R2.1; UDI recall trace in P2 |
| `IMP-CRT-01` academy tooling P2 vs academy live by M36 | Tooling in P2; the academy itself is a business activity |
| `CLN-DOC-02` bloat indicator in BP R2.1, absent from K | Provenance in R1; bloat indicators by R2b |
| LIS rules: one shared rules engine (R04) vs Tier 2 isolation (K) | Releasing or interpreting results = Tier 2 `reg-lis-rules`; reflex, add-on and routing rules = non-device decision tables |
| Relabel scope: units "without a usable barcode" (K-08) vs every unit (SI-11) | Relabel every unit at receipt (the safer, uniform reading; Q-K14 default) |
| Event names: `ChargeCreated`/`PatientTransferred` (R11) vs `ChargeGenerated`/`EncounterMoved` (BP) | R11 names canonical; BP names are aliases |
| Undrawn transitions (medication administration, specimen rejection, bed blocked/closed) | Proposed in §8.4 and put to the approving panels |
| "Paediatric weight-based rounding" in K §4.3's MVP nursing scope (carried over from BP, where the Dose Engine was MVP) vs SI-05 with the Dose Engine in P2 | No dose arithmetic or rounding outside `reg-dose`; until P2 the pharmacist decides under control set A (SAC-13) |
| `AI-PAT-01` "templated then AI" (R14, BP) vs template-only patient text (K §11.2, §11.3) | Templates only; AI may suggest a template and never writes patient text |
