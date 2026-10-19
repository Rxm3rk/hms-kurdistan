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
