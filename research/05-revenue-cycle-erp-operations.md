# 05 — Revenue Cycle Management, Hospital ERP, and Hospital Operations

**Track:** Revenue cycle management (global), hospital ERP (finance, supply chain, HR, assets), hospital operations (patient flow, capacity, command centers, support services)
**Prepared:** 2026-10-16
**Audience:** Product, architecture, and domain teams designing a world-class Hospital Management System (HIS/EHR + hospital ERP/operations)

> **How to read the evidence in this document**
> - `[n]`: the statement is supported by source *n* in the numbered Sources list. Most of these sources were fetched or retrieved during this research session (Oct 2026).
> - `[K]`: analyst domain knowledge that was **not re-verified in this session**. The shared web-search budget ran out partway through the research, after about 24 searches and 20 page fetches. Treat `[K]` items as strong priors and verify them before relying on them for regulatory or contractual decisions.
> - **"Estimate"** marks benchmark ranges that are commonly quoted by consultants or vendors but have no authoritative standard behind them. No numbers have been invented. Where sources disagree, both figures are shown.
> - **Pass-2 verification (2026-10-16):** about 30 claims were re-checked against primary or authoritative sources. Corrections are made in place, new sources are numbered [64] onward, and the results are in the "Verification log" at the end. Items still tagged `[K]` were **not** re-verified in pass 2 unless the log says so.

---

## 0. Executive summary

1. **The US is the hardest revenue cycle to support, so treat it as the reference model.** If the data model can handle US multi-payer coverage (coordination of benefits, prior auth, separate hospital and professional claims, contract-level expected reimbursement, denials), every other country's model is a subset of it plus country-specific adapters. The one exception is Germany's planned capacity-funding layer, which adds something new.
2. **CMS-0057-F is now partly in force.** Since 1 Jan 2026, impacted payers (Medicare Advantage, Medicaid/CHIP fee-for-service and managed care) must decide prior auth within **72 hours (expedited) / 7 calendar days (standard)** and give specific denial reasons. The four FHIR APIs (Patient Access, Provider Access, Payer-to-Payer, **Prior Authorization**) are due **1 Jan 2027**. As of late Sept/Oct 2026 no delay had been announced [1][2][3][4]. From the CY2027 performance/reporting period, an Electronic Prior Authorization attestation measure applies in MIPS Promoting Interoperability and the Medicare PI program. Per [2], it is optional (bonus points) for hospitals in 2027 and required from 2028, and clinician-side changes are still in the CY2027 PFS proposed rule. CMS has used enforcement discretion since 28 Feb 2024 so that FHIR-based prior auth can skip the X12 278 [1]. A separate **proposed** rule, **CMS-0062-P** (published 14 Apr 2026, not final), would extend prior-auth API and decision-time requirements to **drugs** from 1 Oct 2027 [2].
3. **The Da Vinci "burden reduction" trio (CRD → DTR → PAS) is the target prior-auth architecture.** PAS is now at v2.2.1, and CMS-0057-F guidance cites the STU 2.0.x/2.1.0 versions of CRD/DTR/PAS [5][6][7]. Any HMS sold in the US needs order-time coverage discovery (CDS Hooks), questionnaire-based documentation (SMART/embedded), and FHIR prior auth submission, with an X12 bridge.
4. **Hospital Price Transparency became much stricter in 2026.** The CY2026 OPPS rule replaces the "estimated allowed amount" with the **median, 10th and 90th percentile allowed amounts and their count, calculated from 835 remittance data over a 12–15-month lookback**. It also adds a CEO/senior-official attestation and Type 2 NPIs. Enforcement started 1 Apr 2026 [8][9]. Remittance data is therefore now a *regulatory reporting input*, not just a cash-posting input.
5. **Denials keep rising and drive RCM ROI.** Kodiak reports an average initial denial rate of **11.6% in 2025**, up from 11.4%, and **$48.4B** in net revenue lost to final denials and bad debt (up 25% on 2024) [14]. In H1 2026 the initial denial rate fell to **10.63%** (from 12.00% in H1 2025), but payer takebacks of already-paid claims rose to **1.57%** (from 1.38%) [64]. Clinical denials (missing prior auth, medical necessity) are the growth area, so CDI, prior auth, and denial analytics need to be first-class features.
6. **Autonomous AI coding is real but narrow.** It works reliably on high-volume, low-variance outpatient encounters. Inpatient and complex surgical coding still need humans [20]. Most adoption figures in circulation are vendor-sourced. Build an "AI-assist with confidence routing" architecture rather than promising full autonomy.
7. **Internationally, almost every insured market now runs on DRG-type case-mix plus a national e-claims platform.** Examples: Germany aG-DRG with §301 EDI; France GHM/GHS through PMSI; England HRG4+ under the NHS Payment Scheme; Australia AR-DRG v12.0 from 1 July 2026; Saudi Arabia's FHIR-based NPHIES with AR-DRG shadow billing; Abu Dhabi Shafafiya and Dubai eClaimLink XML; Brazil TISS (version Sept/2026); India NHCX on FHIR; Kenya SHA [22–52]. The HMS needs a **pluggable grouper interface** and **per-country claim adapters**, not hard-coded logic.
8. **Germany is shifting from pure per-case DRGs to capacity funding.** Under the KHVVG, as amended by the KHAG (in force 6 Mar 2026), the *Vorhaltevergütung* (about 60% of the budget, tied to *Leistungsgruppen*) now starts **1 Jan 2028**, with convergence in 2028–29 and full effect from 2030 [22][23][24][25]. The 2026 Hybrid-DRG catalogue (§115f SGB V) has **69 Hybrid-DRGs covering 904 OPS codes**, up from 583 codes in 2025 [30]. An earlier figure of "106 new procedures" referred to the April 2025 service-selection decision, not to the final catalogue [67]. German billing has to track service-group assignment, staffing floors, and nursing budgets separately from DRG revenue.
9. **Saudi Arabia's NPHIES is a model for "claims-platform-as-national-infrastructure".** It is FHIR R4, message-based, and handles eligibility, prior auth, claims, payment reconciliation, and communications. It processed **292M transactions in 2024 and 96M in Q1 2025**, with 6,419+ facilities and 25 insurers onboarded [44]. AR-DRG is in shadow billing, and analysts expect full rollout by about 2028 [47][48].
10. **ICD-11 is coming slowly and does not yet drive reimbursement in any major market.** WHO figures put 132 Member States/areas at some stage of implementation, 14 of which are collecting or reporting ICD-11 data. These are the "recent WHO reports" cited in a mid-2025 paper; IFHIMA repeats the 132 total as of July 2025, and no newer breakdown was found [55][56]. WHO says an ICD-11-based DRG system is still "under development" [53]. The US has no date [55]. France began ICD-10/ICD-11 dual-coding pilots in 2025 [55]. Design for **multiple classification systems with versioned, effective-dated code sets** (ICD-10-CM/-GM/-AM/-TM, ICD-11 MMS, CCAM, OPS, OPCS-4, ACHI/SBS, CPT, TUSS).
11. **Self-pay-heavy markets need a different finance core.** India, GCC self-pay, Africa, South and Southeast Asia private sectors, and medical tourism need deposits and advances, interim bills, package or bundled pricing, corporate credit, discount-approval workflows, multiple price lists, multi-currency, and tax engines. These are first-class requirements, not customizations.
12. **ERP: integrate for mature markets, embed a "hospital-grade sub-ledger" for emerging markets.** Large systems standardize on Workday, Oracle Fusion, SAP S/4HANA, or Infor CloudSuite for GL, HR, and payroll [K]. The HMS must own the *patient sub-ledger*, charge master, clinical supply consumption, and pharmacy stores, then post summarized journals to the ERP. *(Reconciled 2026-10-16: the native-vs-integrate split in §9.1 is now the pack's canonical ERP position. `01` §12.2 #4 dropped native payroll, and `02` §9 now treats assets and inventory as native.)*
13. **Cost accounting is a competitive differentiator.** Patient-level costing is a regulatory requirement in some markets: England's PLICS feeds NHS prices [37][38], InEK cost calculation feeds German DRG weights [26], and Australia uses the NHCDC [K]. Time-driven activity-based costing (TDABC, per Kaplan and Porter) is the conceptual gold standard [57]. Capturing time stamps and resource identifiers at source makes TDABC possible later.
14. **Command centers work, but the evidence is weaker than the marketing.** Hopkins, Humber River, Tampa General, and Bradford report throughput gains [K][69]. However, a scoping review found only 8 eligible articles (4 peer-reviewed) on 7 command centers and judged the evidence heterogeneous and "in its earliest stages" [72]. Vendor outcome claims (e.g., LeanTaaS "+6% OR case volume", Qventus "15–30% fewer excess days") come without published methodology [58][59]. Build the *data substrate*: real-time events, bed/EVS/transport state machines, and predictive discharge. Command-center UI is a thin layer on top of it.
15. **Top build principle:** use one patient financial account model with effective-dated rules for tariffs, contracts, groupers, edits, and taxes, configured per country "pack". Do not fork code per country.

---

## 1. US revenue cycle (reference model for complexity)

### 1.1 End-to-end map

| Stage | Main functions | Key standards / artifacts | HMS ownership |
|---|---|---|---|
| Patient access | Scheduling, pre-registration, registration/ADT, insurance discovery, eligibility, COB, prior auth, financial clearance, price estimates, POS collection | X12 270/271, 278, FHIR Da Vinci CRD/DTR/PAS, HL7 v2 ADT, MBI, NSA GFE | Native |
| Middle cycle | Charge capture, CDM, coding (ICD-10-CM/PCS, CPT/HCPCS, modifiers), CDI, DRG/APC grouping, charge reconciliation, DNFB management | NUBC revenue codes, MS-DRG/APR-DRG groupers, NCCI/MUE, OCE/MCE | Native (groupers often licensed) |
| Back end | Claim build and scrub, clearinghouse submission, acknowledgments, claim status, remittance posting, denials, underpayments, appeals, patient statements, payment plans, collections, bad debt and charity | 837I/837P, 999/277CA, 276/277, 835 with CARC/RARC, 275 attachments | Native core; clearinghouse integrated |
| Revenue integrity / finance | Contract modelling, expected reimbursement, reserves, cost report, price transparency files, audits (RAC/MAC/UPIC) | CMS-2552-10 cost report, 45 CFR 180 MRF | Native + analytics |

### 1.2 Patient access

**Registration and identity.** Registration builds the encounter, the guarantor, and the ordered list of coverages. Errors made here cause a large share of downstream denials. Benchmark sources point to front-end causes (eligibility, registration, prior auth) as a leading denial category [K]. HFMA's MAP Keys include patient-access metrics such as pre-registration rate (PA-2), insurance verification rate (PA-3), service authorization rates (PA-4/PA-5), uninsured conversion to third-party funding (PA-6), and point-of-service cash collections (PA-7) [12].

**Eligibility (X12 270/271).** These are HIPAA-mandated real-time or batch transactions (X12 005010) [K]. Good practice is to: (a) run an automated eligibility check on scheduling and again 24–72 hours before service; (b) run insurance discovery for self-pay patients, which helps the PA-6 conversion metric; (c) parse 271 benefit segments (EB) into structured deductible, coinsurance, and out-of-pocket accumulators that drive estimates [K].

**Prior authorization: regulatory timeline (verified Oct 2026).**

| Date | Requirement (impacted payers: MA, Medicaid/CHIP FFS and managed care; QHPs on FFEs for API provisions) | Source |
|---|---|---|
| 8 Apr 2024 | CMS-0057-F effective (released 17 Jan 2024) | [1][2] |
| 28 Feb 2024 | Enforcement discretion: covered entities using a FHIR Prior Authorization API may skip the X12 278 | [1] |
| 1 Jan 2026 | 72 h expedited / 7 calendar-day standard decision timeframes; specific denial reasons; metrics reporting begins (QHPs excluded from timeframes) | [2][4] |
| 31 Mar 2026 | First public prior auth metrics reports (CY2025) | [2] |
| 1 Jan 2027 | Patient Access, Provider Access, Payer-to-Payer, and Prior Authorization APIs operational (rating/plan-year variants for managed care/QHPs) | [1][2][3] |
| CY2027 | Electronic Prior Authorization attestation measure in MIPS PI (clinicians) and the Medicare PI program (hospitals/CAHs). For hospitals it is optional (bonus) in 2027 and required from 2028; clinician details are in the CY2027 PFS proposed rule | [2] |
| Proposed (not final) | **CMS-0062-P** (published 14 Apr 2026; comments closed 15 Jun 2026) would add **drug** prior auth to the API and decision-time framework from **1 Oct 2027**. Proposed drug decision times are 24 h expedited / 72 h standard, and 24 h for all Medicaid/CHIP requests. *Correction: an earlier draft said this rule would extend timeframes to QHPs; the source does not say that* | [2] |

Drugs are excluded from the CMS-0057-F API requirements [2][4], but CMS-0062-P proposes to add them (see table). Separately, the AMA has documented a heavy physician prior-auth burden, and in 2025 major payers made voluntary pledges to streamline prior auth [K]. CMS's **WISeR** (Wasteful and Inappropriate Service Reduction) Model adds another layer. It runs from 1 Jan 2026 to 31 Dec 2031 in six states (AZ, NJ, OH, OK, TX, WA), and uses technology vendors with AI/ML plus clinician review to make prior-auth decisions for selected services in Original Medicare, such as skin substitutes, nerve stimulators, and knee arthroscopy. It does not apply to Medicare Advantage [71].

**Prior authorization: technical architecture.** The HL7 Da Vinci approach [5][6][7]:
- **CRD (Coverage Requirements Discovery):** CDS Hooks fire at order-sign or appointment-book and return coverage rules and whether prior auth or documentation is needed.
- **DTR (Documentation Templates and Rules):** a CQL-driven FHIR Questionnaire is prepopulated from the EHR and launched as SMART app or native UI.
- **PAS (Prior Authorization Support):** a FHIR Claim bundle (use = preauthorization) goes to the payer, or to an intermediary that can translate it to X12 278. PAS v2.2.1 is current [5]. Many X12-required fields are "Must Support" but defined only in licensed X12 guides [5].

**Design implication:** model `AuthorizationRequest` and `Authorization` as first-class entities. Link them to orders, scheduled procedures, coverages, units/visits authorized, validity dates, and payer reference numbers. Check claim lines against them at claim-build time.

### 1.3 Financial clearance and price estimates

**Hospital Price Transparency (45 CFR Part 180).** Hospitals must post (i) a single machine-readable file (MRF) of standard charges (gross, discounted cash, payer-specific negotiated, de-identified min/max) and (ii) a consumer-friendly display of at least 300 shoppable services or a price estimator tool [9]. **CY2026 changes** (CMS-1834-FC, effective 1 Jan 2026, enforced from 1 Apr 2026) [8][9]:
- For percentage- or algorithm-based negotiated rates, publish the **median, 10th and 90th percentile allowed amounts plus their count**, calculated from **EDI 835 ERA or equivalent** over a **12–15-month lookback**. Where a percentile falls between two observed amounts, use the next-highest observed value.
- An attestation that the file is complete and accurate, with the **name of the CEO, president, or senior official** encoded in the file.
- **Type 2 NPIs** with hospital taxonomy (prefix 28 or 27) encoded.
- A 35% civil monetary penalty reduction if the hospital waives an ALJ hearing, except for core failures [8].

**No Surprises Act Good Faith Estimates (GFE).** For uninsured and self-pay patients, GFEs have been in force since 2022 (45 CFR 149.610). They are due within 1 business day if service is scheduled ≥3 business days out, or within 3 business days if scheduled ≥10 days out or on request. They must list diagnosis codes, expected service codes, charges, and NPI/TIN for each provider and facility. Patients can start dispute resolution if the bill exceeds the GFE by ≥$400 [10]. The **insured GFE and Advanced EOB (AEOB) are still not implemented.** The proposed rule (CMS-9900) was still at the proposed stage as of spring 2026, and congressional pressure continues [10][11]. Build GFE as a *multi-provider estimate document* (convening and co-providers) on the same estimate engine as the price transparency tool.

**Estimate engine.** An estimate engine needs four inputs: (1) a procedure "shopping bundle" template; (2) contract terms per payer and plan; (3) live benefit accumulators from the 271; (4) historical allowed amounts per bundle. The 2026 transparency rule pushes the fourth input onto every hospital anyway.

### 1.4 Charge capture and the Charge Description Master

**CDM fields** [K]: charge code, description, NUBC revenue code (4-digit), CPT/HCPCS, default modifiers, price per price schedule, department/cost center, GL revenue account, unit of measure, status indicator mappings, effective dates, and a statistical-unit flag. A typical acute hospital CDM holds tens of thousands of lines [K, estimate].

**Charge capture patterns:**
- *Order-driven* (charge on result or verification).
- *Documentation-driven* (charge from the MAR, nursing flowsheets, or OR record: implants, supplies, time).
- *Time-based* (anesthesia, OR minutes, observation hours, ventilator days).
- *Point-of-use scan* (supplies and implants via GS1 barcodes).
- *Manual/charge-entry* (should be the exception).

**Charge reconciliation:** daily departmental reconciliation of expected versus captured charges (e.g., procedures performed vs. charges). HFMA tracks **late charges** (posted >3 days after service, CL-2) and **charge lag days** (PB-4) [12].

**Key principle:** charges are *derived* from clinical events through rules (charge triggers), never typed in by clinicians. This is what "integrated" means in RCM.

### 1.5 Coding, CDI, and AI coding

**Code sets.** ICD-10-CM (diagnoses, all settings), ICD-10-PCS (inpatient procedures), CPT and HCPCS Level II (outpatient and professional), and modifiers (e.g., -25, -59/X{EPSU}, -LT/-RT). The FY2026 ICD-10-CM update added **487 new codes** (with 38 revised and 28 deleted), and CPT 2026 contained **418 changes** (288 new, 84 deleted, 46 revised) [21]. MS-DRG v43.1 added **80 ICD-10-PCS procedure codes** effective 1 Apr 2026 [17]. Code sets now update **twice a year** (October and April), so plan versioning accordingly.

**CDI (Clinical Documentation Integrity).** Concurrent and retrospective review to make sure documentation supports specificity, CC/MCC capture, POA indicators, severity of illness and risk of mortality (APR-DRG SOI/ROM), HCCs, and quality measures (PSIs/HACs). CDI query workflows must follow AHIMA/ACDIS compliant-query guidance (non-leading, multiple choice, clinical indicators) [K]. AI vendors are moving into pre-bill CDI. For example, R1 announced on 14 Oct 2025 that it would acquire Phare Health (AI inpatient coding and CDI), and the deal closed later that month [70].

**Computer-assisted and autonomous coding.** The AMA CPT taxonomy for AI (Appendix S) distinguishes *assistive*, *augmentative*, and *autonomous* tiers. Most products in market remain computer-assisted [21]. Autonomous coding works reliably on high-volume, low-variance outpatient work (radiology, E/M, ED pro-fee, lab, some ambulatory surgery). Complex multi-procedure cases still go to humans [20]. One critical review notes that independent surveys show lower uptake: about 3 in 10 providers use AI in coding and about 1 in 5 in denials management (Bain survey cited by HFMA) [20]. **Legal responsibility for the codes stays with the billing provider** [21].

**Design implication:** a coding workbench with (a) NLP/LLM suggestions carrying evidence spans and confidence; (b) per-encounter-type autonomy thresholds; (c) audit sampling; (d) a grouper preview showing DRG impact; (e) an edit check before final.

### 1.6 DRG grouping

- **MS-DRG (Medicare IPPS):** v43.0 for FY2026 discharges (1 Oct 2025 – 31 Mar 2026), with **770 payable MS-DRGs finalized** (772 had been proposed; FY2025 had 771), and v43.1 from 1 Apr 2026 [16][17][18][19]. The FY2027 IPPS final rule (**CMS-1849-F**) was displayed 31 Jul 2026 and published 4 Aug 2026, and applies to discharges from 1 Oct 2026 [66]. Under CMS's numbering convention the FY2027 grouper is v44, though the rule's home page does not state the version number. CMS publishes grouper software and definitions manuals [17][18].
- **APR-DRG (Solventum, formerly 3M):** used by many Medicaid programs and commercial contracts. It assigns four severity-of-illness and four risk-of-mortality subclasses per base DRG and is licensed [K].
- **Outpatient:** OPPS APCs and C-APCs with status indicators and packaging; EAPGs in some Medicaid programs; ASC payment groups [K].
- **Case Mix Index (CMI):** the sum of MS-DRG relative weights divided by discharges (HFMA FM-5) [12].

### 1.7 Claims: build, scrub, submit

- **Institutional:** 837I (paper UB-04/CMS-1450): type of bill, revenue codes, condition/occurrence/value codes, POA, DRG, attending/operating NPIs.
- **Professional:** 837P (CMS-1500). **Dental:** 837D [K].
- **Edits:** NCCI procedure-to-procedure and MUE edits (quarterly), Medicare Code Editor (inpatient), Integrated Outpatient Code Editor (OPPS), LCD/NCD medical necessity, payer-specific rules, and the 3-day/72-hour payment window and two-midnight rule [K].
- **Clearinghouses** (Waystar, Availity, Optum/Change Healthcare, Experian, FinThrive, etc.) [K] return 999 (syntax) and 277CA (claim acknowledgment). Claim status runs via 276/277.
- **Resilience lesson:** the February 2024 Change Healthcare cyberattack disrupted claims and payments nationally for weeks [K]. **Design for multi-clearinghouse routing and a direct-to-payer fallback.**

### 1.8 Remittance, denials, and underpayments

**835 ERA** carries payment, adjustments (CARC group codes CO/PR/OA/PI), and remarks (RARC). Auto-posting rates above 90% are a common target [K, estimate]. 835 data now also feeds the price transparency percentile calculation [8].

**Denials management:**
- Categorize by root cause: front-end/eligibility, authorization, coding, medical necessity, timely filing, duplicate, bundling, clinical validation, DRG downgrade.
- Route to work queues with SLA timers and appeal templates.
- Track **remittance denial rate (AR-5)** and **denial write-offs as % of NPSR (AR-6)** [12].

**Industry data:**

| Metric | Value | Source |
|---|---|---|
| Average initial denial rate, 2025 | 11.6% | Kodiak [14][15] |
| Median final denial rate, 2025 | 2.7% (up from 2.5%) | Kodiak [14][15] |
| Average clinical denial rate, 2025 | 2.6% | Kodiak [14][15] |
| Net revenue lost to final denials + bad debt, 2025 | $48.4B (up 25% from $38.6B) | Kodiak [14] |
| Initial denial rate, H1 2026 | 10.63% (H1 2025: 12.00%); traditional Medicare inpatient 4.21% vs MA 9.15% | Kodiak via [64] |
| Payer takebacks/recoupments, H1 2026 | 1.57% (H1 2025: 1.38%). Kodiak's release expresses this against **accounts receivable**; some outlets say "net revenue" | Kodiak via [64] |
| Initial denial rate, private payers, Premier survey (2024 report, 2022 claims) | nearly 15%; 54.3% of private-payer denials eventually overturned | Premier [65] |
| Provider spend adjudicating denials | $19.7B/yr (2022 claims), of which $10.6B was spent on claims that should have been paid on submission. A 2025 Premier follow-up (2023 claims) reportedly puts the "wasted" figure at nearly $18B. *Correction: the $18B figure is Premier's, not an AHA estimate, and is not confirmed from a primary Premier page* | Premier [65]; $18B still unverified |

**Underpayments:** an expected reimbursement engine models each payer contract (DRG × base rate, per diem, % of charges, fee schedule, carve-outs, stop-loss/outlier, lesser-of logic, implants at invoice + %) and flags variance against the 835. This is the same contract model needed for estimates and transparency MRFs. **Build one contract engine with three uses.**

### 1.9 Patient financial services

- **Statements:** consolidated HB + PB statements, plain-language, with digital-first delivery (SMS/email, wallet payments) [K].
- **Payment plans,** presumptive charity (propensity-to-pay scoring), and financial assistance screening.
- **Nonprofit hospitals:** IRS §501(r) requires a financial assistance policy, amounts-generally-billed limits, and restrictions on extraordinary collection actions (notification periods before ECAs) [K].
- **Bad debt and charity** are tracked separately (AR-7, AR-8) [12].
- Collections agency placement and early-out vendors via outbound and inbound file interfaces.

### 1.10 Single billing office (SBO)

An SBO combines **hospital billing (HB)** and **professional billing (PB)** under one patient-facing account: one statement, one guarantor balance, one payment plan, one customer-service view. The claims and payer rules underneath stay separate (837I vs 837P, different edits) [K]. Epic's Resolute HB/PB with an SBO configuration is the reference implementation in US academic and integrated systems [K].

**Design implication:** the *guarantor account* aggregates across facility and professional *encounter accounts*. Payments are allocated by configurable rules (oldest first, by service date, or patient-designated).

### 1.11 US RCM vendor landscape (orientation, not endorsement)

- **EHR-native RCM:** Epic (Cadence scheduling, Prelude registration, Resolute HB/PB, Grand Central ADT/capacity, plus 2025-announced AI assistants for revenue cycle) [K]. Oracle Health (Cerner) patient accounting and RCM [K]. MEDITECH Expanse RCM [K].
- **Clearinghouse and platform:** Waystar, which completed its acquisition of Iodine Software (CDI AI) on 1 Oct 2025 after announcing a $1.25B deal in Jul 2025 [68]; Availity, Experian Health, FinThrive, Optum/Change [K].
- **Outsourcing / RCM services:** R1 (taken private in 2024 [K]; acquired Phare Health for AI inpatient coding in Oct 2025 [70]), Ensemble, Optum360 [K].
- **Autonomous coding:** CodaMetrix, Fathom, Nym, Arintra, and others [20][21]. Accuracy claims are mostly vendor-reported.

---

## 2. Global reimbursement and claims models

### 2.1 Archetypes an international HMS must support

| Archetype | Typical markets | What the HMS must do |
|---|---|---|
| **A. National/statutory insurer with DRG + national EDI** | Germany, France, Australia (public), Nordics, Thailand, Indonesia, Japan (DPC) [K], China (DRG/DIP) [K] | Code to the national classification, group with a certified grouper, transmit statutory datasets, manage audit/medical review |
| **B. Global budget / commissioning with activity currencies** | England (NHS Payment Scheme/API), Nordic regions, Australian states | Produce commissioning datasets (e.g., SUS+), HRG grouping, PLICS costing; little patient billing except private patients and overseas visitors |
| **C. Mandatory private insurance through a national exchange** | Saudi Arabia (NPHIES), UAE (eClaimLink/Shafafiya), Qatar [K], India private (NHCX) | Real-time eligibility/pre-auth/claims via national platform, payer-specific benefit rules, DRG transition, co-pays and deductibles at POS |
| **D. Government scheme with package rates and pre-auth** | India PM-JAY, CGHS/ECHS, state schemes; Philippines PhilHealth case rates; Kenya SHA; Nigeria NHIA | Package catalogue, pre-auth with clinical evidence upload, scheme-specific portals, claim tracking, delayed-payment AR |
| **E. Fragmented private multi-payer** | US, South Africa (medical schemes), Brazil supplementary health (ANS/TISS), Nigeria HMOs | Full contract management, coding, denials ("glosas" in Brazil), switching houses |
| **F. Self-pay dominant** | Private hospitals in South Asia, Africa, parts of SE Asia and MENA; medical tourism | Deposits, packages, discounts with approvals, corporate credit, multi-currency, tax |

Most real hospitals combine three or four archetypes at once. A private hospital in India, for example, handles self-pay, TPA/insurer cashless claims, PM-JAY or a state scheme, CGHS credit, and corporate credit at the same time.

### 2.2 Country deep dives

#### Germany (statutory GKV + private PKV)
- **Payment:** aG-DRG flat rates. Since 2020 nursing staff costs are carved out into a hospital-specific **Pflegebudget** paid through separate nursing relative weights [26][31]. The 2026 catalogue uses ICD-10-GM 2026 and OPS 2026, and InEK also published *Vorhaltebewertungsrelationen* (capacity weights) for the coming reform [26].
- **Data exchange:** **§301 SGB V** EDI between hospitals and sickness funds [27][28]:
  - Hospitals send admission, extension, medical justification, invoice, discharge, and outpatient-surgery invoice messages.
  - Funds send cost-coverage, information requests, and payment messages.
  - Specifications are updated several times a year. There was a code update effective 16 Oct 2026, and supplements take effect 1 Oct 2026 / 1 Jan 2027 [28].
- **Other statutory data:** §21 KHEntgG annual dataset to the InEK DRG data office [K]. Medical service (*Medizinischer Dienst*) audits with statutory audit quotas [K].
- **Hybrid-DRG (§115f SGB V):** sector-neutral flat rates for procedures done outpatient or with up to a 2-day stay. The **2026 catalogue (effective 1 Jan 2026) has 69 Hybrid-DRGs and 904 OPS codes, up from 583 codes in 2025.** New areas include appendectomy, cholecystectomy, minimally invasive coronary and peripheral vascular procedures, and fracture osteosynthesis. Severity levels are new for 2026, and add-on fees (*Zusatzentgelte*) cannot be billed on top [30]. *Correction: the earlier "106 new procedures" figure came from the 28 Apr 2025 service-selection decision, not the final catalogue [67].* Billing via §301 with admission reason code 12 is cited from [29], which could not be re-fetched in pass 2 (connection reset). A 2027 catalogue agreement (GKV-SV/KBV/DKG) was signed 31 Mar 2026. The KHAG also keeps annual catalogue-update deadlines running into 2030 [23]. Both points argue against a near-term repeal of §115f, so the earlier report that the emergency-care reform would repeal it from 2028 is **unverified and doubtful** [K].
- **KHVVG reform (Dec 2024) as amended by the KHAG (in force 6 Mar 2026; Bundestag Drucksache 21/2512):** hospitals are assigned to **service groups (Leistungsgruppen)** with quality and staffing criteria. **Vorhaltevergütung** (capacity funding, about 60%) begins **1 Jan 2028**. 2026–27 are budget-neutral, convergence runs in 2028–29, and full effect comes from 2030. Each year, InEK sends states case-number and minimum-volume data by 30 Jun, and states send their service-group assignment decisions to InEK by 30 Sep. Pass 1 gave the first of these deadlines as 30 Sep 2027 [22][23][24][25].
- **HMS implications:**
  - Cases must carry a **Leistungsgruppe** attribute and minimum-volume tracking.
  - Staffing-floor compliance (PpUGV) and the nursing-need tool PPR 2.0 must be reported [K].
  - Revenue is split across DRG, nursing budget, capacity budget, and supplementary fees (*Zusatzentgelte*).

#### France
- **Payment:** **T2A** (activity-based pricing). PMSI discharge abstracts are grouped into **GHM** (homogeneous patient groups), which map to **GHS** tariffs. The number of GHM grew from about 500 in 2004 to more than 2,500 in 2024 [34].
- **Code sets and tooling:** diagnoses in CIM-10 (French ICD-10 for PMSI), procedures in **CCAM**. ATIH publishes the yearly PMSI technical notice (2026 changes effective 1 Jan 2026) and the funding notice. The 2026 notice created 10 new increased-rate GHS (*GHS majorés*) [32][33].
- **2026 campaign:** expensive drugs and devices removed from the add-on list (*liste en sus*) were folded back into GHS tariffs. Funding-allocation components (*compartiments de dotation*) rose 1.5% [35].
- **Reform:** France is moving toward a mixed model of activity plus allocated funding (*dotations*) for some activities, such as critical care and radiotherapy. The Senate earlier voted to delay the end of T2A's central role to 2028 [35][36].
- **Billing:**
  - Private clinics (ex-OQN) bill the Assurance Maladie per stay.
  - Public hospitals have been moving to individual invoicing (**FIDES**) [K].
  - Complementary insurers (*mutuelles*) use third-party-payment standards (e.g., ROC) [K].
- **ICD-11:** dual-coding pilot in 10 university hospitals (about 10,000 stays) from 2025, with more pilots planned for 2026–27 [55].

#### United Kingdom (England)
- **Payment:** the **NHS Payment Scheme (NHSPS)** replaced Payment by Results/National Tariff in 2023 [K]. For 2026/27 [37][38][39][40]:
  - **Aligned Payment and Incentive (API)** contracts have a fixed element plus a variable element. Provider–ICB relationships with expected activity of ≤£1.5m get a low-volume (LVA) block payment instead [39].
  - **Elective and community diagnostic activity is paid at 100% of the NHSPS unit price.** For these services the variable element is the only funding route [39]. *Correction: an earlier draft said the elective variable rate was 50%.*
  - New **blended payments** combine a fixed payment for planned activity with a variable rate for activity above or below plan: **20%** for urgent and emergency care (with a locally agreed "break-glass" clause), **50%** for external-beam radiotherapy/SABR, and a locally agreed percentage for genomic testing [39]. These figures come from the consultation document; check them against the final Annex.
  - **HRG4+ phase 3** currencies.
  - Prices are still built from **2018/19 PLICS cost data and HES**. They have been rolled forward for cost uplift and efficiency since 2022/23 rather than recalculated. Some prices were reset for 2026/27, such as non-elective stroke and pneumonia, which now use 2023/24 cost data [38]. An August 2026 pay-award update followed.
  - Chargeable overseas visitors are billed at **150%** of the NHSPS price, or 100% for holders of EU Settlement Scheme status [39].
- **Data flows:** Commissioning Data Sets through **SUS+**, the Emergency Care Data Set (ECDS), and annual National Cost Collection (PLICS) [K]. Code sets: ICD-10 5th edition and **OPCS-4** [K].
- **Patient billing is limited to:** private patients (insurers such as Bupa/AXA use CCSD codes) and **overseas visitors** under the NHS charging regulations [K].
- **HMS implications:** strong activity data capture, grouping, and costing. Little claims processing.

#### Nordics
- **Classification:** **NordDRG** is maintained by the Nordic Casemix Centre with country versions. Procedures are coded in **NCSP** (NOMESCO) and diagnoses in ICD-10 national versions [K].
- **Payment:** Norway funds a substantial share of somatic hospital activity through activity-based financing (ISF) [K]. Denmark uses DkDRG/DAGS [K]. Sweden and Finland use DRG for regional funding, benchmarking, and productivity rather than invoice-level claims [K].
- **HMS implications:** reporting to national patient registers and grouping. Patient billing is minimal (small co-pays and visitor/foreign billing) [K].

#### Australia
- **Public hospitals:** **activity-based funding (ABF)** under the National Health Reform Agreement. IHACPA sets the **National Efficient Price (NEP)** per National Weighted Activity Unit. The NEP Determination 2026–27 was published 11 Mar 2026 and sets the **NEP26 at A$7,418 per NWAU(26)** [41][75].
- **AR-DRG v12.0** (approved April 2025, supersedes v11.0) prices admitted acute care from **1 July 2026**, with no shadow-pricing period; back-casting volume multipliers support the transition. It adds new maternal-care groupings and ADRG A16 (posthumous organ procurement) [41][42][75]. The cost model uses 6.8M separations, and ICU time is priced per hour (0.0446 NWAU(26)/hour) [41][43].
- **Other classifications:** AN-SNAP v5.0 (subacute), AMHCC v1.1 (mental health), Tier 2 v10.0 (non-admitted), and AECC v1.1 (emergency) [41].
- **Code sets:** ICD-10-AM/ACHI/ACS [K].
- **Private patients:** MBS items, private health insurer claims via the ECLIPSE/IHC channel, and Hospital Casemix Protocol (HCP) data to insurers [K].

#### Saudi Arabia
- **Payers:** CHI (Council of Health Insurance, formerly CCHI) regulates mandatory private insurance. **NPHIES** is the national FHIR R4 **validating and routing exchange.** It does *not* adjudicate [44].
- **NPHIES use cases** [44]: eligibility (plus insurer lookup), prior and advanced authorization, claims (single and batch), payment reconciliation and notification, communication request/response, cancellation, polling, and status check.
- **NPHIES scale** [44]: 143M transactions (2023), 292M (2024), and 96M in Q1 2025 (50M eligibility, 11M authorization, 31M claims, 4M payment). 6,419+ facilities, 25 insurers, and 60+ software vendors are onboarded, and every organization uses a PKI identity.
- **Public sector:** public providers are joining NPHIES as the public system moves toward a national-insurer model [45].
- **Coding and DRG:**
  - **ICD-10-AM** diagnoses and **SBS** (Saudi Billing System, ACHI-derived) procedures [45][46][47].
  - **AR-DRG** has been mandated since 2021 for public hospitals billing private insurers [47]. Version 9 is used for reporting all admitted care [45][47].
  - Private-sector DRG payment is in **shadow billing**, with full rollout expected around 2028 (analyst estimate, not a CHI circular) [48].
- **Tax:** VAT and ZATCA e-invoicing (Fatoora) integration are also required for invoices [K].

#### United Arab Emirates
- **Dubai (DHA):** mandatory insurance (ISAHD). Claims, prior requests, and remittances are exchanged as XML through **eClaimLink**. DHA publishes coding lists, including the **Dubai Drug Code**, denial codes, and clinician specialties [50]. Coding uses ICD-10-CM, CPT, HCPCS, and DDC [50][K]. Inpatient and day-case DRG billing on eClaimLink uses **3M (now Solventum) IR-DRG** [76]. A May 2021 DHA circular on "DRG Year 2 implementation" introduced IR-DRG v3.01 fixes and the v3.3 Codefinder/Grouper, which implies DRG billing began around 2020 [76]. The grouper version in use in 2026 was not found, so verify it [K].
- **Abu Dhabi (DOH):** **Shafafiya** is the data-standards portal and the "Post Office" web-service for XML exchange. Each file carries SenderID/ReceiverID, and providers must use their own HIS/billing systems because DOH provides no upload UI. Its core concepts are Encounter, Episode, Claim, Activity, and Observation, and it publishes prices, standards, dictionaries, and *clinical costing* [49]. Inpatient claims carry a single DRG-type activity that covers the whole case [49]. The grouper is IR-DRG per secondary sources, but the DOH page names no version [K]. The Thiqa and Daman programmes and the Malaffi HIE are also relevant [K].
- **Federal:** mandatory employee health insurance was extended to all emirates from 2025 [K].
- **HMS implications:** XML claim adapters per emirate, activity-level claims with observations (lab values attached), and DRG grouping for inpatient.

#### Qatar
- Law No. 22 of 2021 created a mandatory health insurance framework. **Visitor insurance has been mandatory since Feb 2023**, and expatriate phases are planned [K]. Hamad Medical Corporation dominates the public sector. Private claims go through insurer and TPA portals rather than a single national FHIR exchange [K, verify].

#### India
- **PM-JAY (Ayushman Bharat):**
  - Cover is ₹5 lakh per family per year for secondary and tertiary care. It was expanded in Oct 2024 to all citizens aged 70+ (Ayushman Vay Vandana) [K].
  - Hospitals deliver **package rates** from the Health Benefit Package (HBP 2022, roughly 1,900+ procedures) [K, estimate].
  - **Pre-authorization** and **claims** run through NHA's Transaction Management System, and State Health Agencies run the scheme in insurance, trust, or hybrid mode [K].
- **NHCX (National Health Claims Exchange):** launched 2024 under ABDM. It is built on the open **HCX protocol with FHIR R4 profiles** for coverage eligibility, pre-auth, claim, communication, and payment notice between hospitals, insurers, TPAs, and government schemes. IRDAI has directed insurers to onboard [K]. *The official NHA/ABDM pages returned 403 during this session. Verify current onboarding counts and mandates.*
- **Private insurance:**
  - Cashless claims via TPA or insurer pre-auth.
  - Reimbursement claims where the patient pays first.
  - The **IRDAI Master Circular on Health Insurance Business (29 May 2024)** requires cashless authorization decisions within **1 hour** and final discharge authorization within **3 hours** of the hospital's request [77]. Several secondary sources add that if the insurer misses the discharge deadline, it must pay any resulting extra hospital charges from shareholders' funds. The circular reference number varies across secondary sources, so check it on irdai.gov.in.
- **Other schemes:** **CGHS/ECHS** credit billing at government-notified rates, and many state schemes [K].
- **Tax:** non-ICU room rent above ₹5,000/day attracts 5% GST, so the tax engine needs line-level rules [K].
- **Digital public infrastructure:** ABHA health IDs, the Health Facility Registry, and the Healthcare Professionals Registry [K].

#### Indonesia
- **JKN** is run by **BPJS Kesehatan**. Hospitals are paid by **INA-CBGs** (case-based groups, ICD-10 + ICD-9-CM) and primary care by capitation [K].
- **Policy changes:** standardized inpatient class (**KRIS**) under Perpres 59/2024 [K]. The Ministry of Health is developing an Indonesian DRG (**iDRG**) and national coding modifications [K, verify status].
- **Data:** national FHIR platform **SATUSEHAT** for health data exchange [K].

#### Philippines
- **PhilHealth** (UHC Act 2019): "all case rates" for inpatient, **Z-benefits** for catastrophic conditions, and **Konsulta** primary care capitation. eClaims are submitted with ICD-10 + RVS codes, and a No Balance Billing policy applies for indigent/basic accommodation. A move from case rates to **DRG-based payment** is being piloted [K, verify status].

#### Thailand
- Three public schemes: **UCS** (NHSO), **SSS** (Social Security Office), and **CSMBS** (civil servants) [K].
- Inpatient payment uses **Thai DRG** (v6.x) under global budgets. Outpatient is mainly capitation. Diagnoses are coded in **ICD-10-TM** and claims submitted via e-claim [K].
- A 2025 trade article named Thailand among ICD-11 "frontrunners" for reimbursement [55-adjacent; low confidence, not confirmed by WHO]. Treat this as unverified.

#### Kenya
- **SHA (Social Health Authority)** replaced NHIF in Oct 2024 under the Social Health Insurance Act (No. 16 of 2023). The Oct 2024 date is [K]; the SHA site refers to the "defunct NHIF". SHA runs **three statutory funds plus a civil-servant scheme fund** [51]:
  - **Primary Healthcare Fund (PHF)**: outpatient; maternal, newborn and child health; cancer screening; optical; end-of-life.
  - **Social Health Insurance Fund (SHIF)**: inpatient, maternity/neonatal, renal, mental health, surgery.
  - **Emergency, Chronic and Critical Illness Fund (ECCIF)**: ambulance, accident and emergency, critical illness, palliative, chronic illness.
  - **Public Officers Medical Scheme Fund (POMSF)**: SHA publishes separate payment reports and contract notices for it. *Added in pass 2; the earlier draft listed only three funds.*
- **Tariffs:** standardized benefit tariffs and packages [51].
- **Digital platforms:** eligibility checks, a provider portal, e-contracting, and the Afya Yangu member portal [51].
- **Operations:** SHA publishes facility-level payment reports, and legacy NHIF pending claims are still being verified (notice of 28 Sep 2026) [51].
- **HMS implications:** eligibility at registration, package/tariff mapping, claim attachments, and tracking slow-paying government receivables.

#### Nigeria
- The **NHIA Act 2022** replaced the NHIS and made health insurance mandatory. **HMOs** act as intermediaries. Primary care is paid by capitation; secondary and tertiary care by fee-for-service with pre-authorization codes. State health insurance agencies and the Basic Health Care Provision Fund add more payers [K].
- **HMS implications:** multi-HMO authorization codes, capitation reconciliation, and high self-pay volume.

#### South Africa
- **Private sector:** around 70+ **medical schemes** regulated by the Council for Medical Schemes. Prescribed Minimum Benefits cover about 270 diagnosis-treatment pairs plus a chronic disease list [K, approximate].
- **Claims:** sent electronically through **switching houses**, with **ICD-10 (WHO) mandatory on claims**, **NAPPI** codes for medicines and devices, and tariff codes. Hospitals negotiate per-diem, fee-for-service, and alternative reimbursement (case-based/DRG-like) arrangements [K].
- **NHI Act:** signed into law 15 May 2024, with phased implementation and ongoing litigation [K].

#### Brazil
- **SUS (public):**
  - Inpatient stays are authorized and paid via **AIH** (*Autorização de Internação Hospitalar*) through **SIH/SUS**.
  - Outpatient via **SIA/SUS** (BPA/APAC).
  - Procedures and prices come from the **SIGTAP** table, the facility registry is **CNES**, and diagnoses use CID-10 [K].
- **Supplementary (private) health:** regulated by ANS. The **TISS** standard is **mandatory** for electronic exchange between providers and health-plan operators. The current version is **TISS September/2026**, with **TUSS** terminology [52]. Denials (*glosas*) and their appeal (*recurso de glosa*) are a major workflow. Some operators pay DRG-based through DRG Brasil [K].
- **HMS implications:** dual SUS + TISS billing engines, guide types (consultation, SP/SADT, inpatient, professional fees) [K], and glosa management.

### 2.3 Country reimbursement comparison table

| Country | Dominant payer model | Diagnosis / procedure classification | DRG / case-mix system | Claims standard / platform | Key integration requirement for the HMS |
|---|---|---|---|---|---|
| **USA** | Multi-payer: Medicare, Medicaid, MA, commercial, self-pay | ICD-10-CM, ICD-10-PCS, CPT/HCPCS | MS-DRG v43/v44 (IPPS), APR-DRG, APC/EAPG [16][17] | X12 5010 (270/271, 278, 837I/P, 835, 276/277); FHIR Da Vinci PAS/CRD/DTR [1][5] | Clearinghouse(s), prior auth APIs by Jan 2027, price transparency MRF from 835 data [8] |
| **Germany** | Statutory GKV (+PKV, self-pay) | ICD-10-GM, OPS | aG-DRG + Pflegebudget; Hybrid-DRG (69 in 2026); Vorhaltevergütung from 2028 [22][26][29][30] | §301 SGB V EDI; §21 KHEntgG data to InEK [27][28] | Certified grouper, §301 message lifecycle, Leistungsgruppen and staffing-floor reporting |
| **France** | Assurance Maladie + complementary *mutuelles* | CIM-10 (FR), CCAM | GHM → GHS (T2A) + allocated funding (*dotations*) [32][33][34] | PMSI (RSS/RSA) to ATIH; FIDES/B2 billing [K] | PMSI abstracting, ATIH grouping function, mutuelle third-party payment |
| **England** | NHS commissioning (API), private patients, overseas visitors | ICD-10 5th ed, OPCS-4 [K] | HRG4+ phase 3 [37] | SUS+ CDS, ECDS, PLICS cost collection [K][38] | Data-set extracts, HRG grouping, patient-level costing |
| **Nordics** | Tax-funded regions + ABF share | ICD-10 national, NCSP [K] | NordDRG / DkDRG [K] | National patient registers [K] | Register reporting, DRG grouping, small co-pays |
| **Australia** | Public ABF (NHRA) + private health insurance + MBS | ICD-10-AM / ACHI / ACS | AR-DRG v12.0 (from 1 Jul 2026); NEP26 A$7,418/NWAU(26) [41][42][75] | State ABF data sets; ECLIPSE/IHC; HCP [K] | NWAU calculation, private-patient election, insurer claims |
| **Saudi Arabia** | Mandatory private insurance (CHI) + government; public moving to insurer model | ICD-10-AM, SBS (ACHI-based) [45][47] | AR-DRG v9 (reporting), shadow billing toward full rollout around 2028 [47][48] | **NPHIES** (FHIR R4 messaging, PKI) [44] | Real-time eligibility, pre-auth, claims, payment reconciliation via NPHIES; ZATCA e-invoice [K] |
| **UAE** | Mandatory insurance (Dubai ISAHD; Abu Dhabi Thiqa/Daman/enhanced plans) | ICD-10-CM, CPT, HCPCS, DDC [50][K] | IR-DRG (3M/Solventum) for inpatient; Dubai confirmed [76], Abu Dhabi DRG-type activity [49] (version [K]) | **eClaimLink** (DHA), **Shafafiya** (DOH) XML [49][50] | Per-emirate XML adapters, activity-level claims with observations |
| **Qatar** | Public (HMC) + mandatory visitor insurance; expat phases [K] | ICD-10-AM/CM [K] | Not nationally DRG-paid [K] | Insurer/TPA portals [K] | Insurance verification for visitors, TPA approvals |
| **India** | Self-pay + private insurers/TPAs + PM-JAY/state schemes + CGHS/ECHS | ICD-10 (WHO); package codes | Package rates (HBP 2022); no national DRG [K] | NHA TMS (PM-JAY); **NHCX** (FHIR/HCX) [K] | Pre-auth with documents, 1-hour cashless / 3-hour discharge SLA [77], GST, ABHA/ABDM |
| **Indonesia** | JKN (BPJS Kesehatan) + private | ICD-10, ICD-9-CM | INA-CBGs → iDRG (in development) [K] | BPJS e-claim (V-Claim/E-Klaim) [K]; SATUSEHAT FHIR [K] | INA-CBG grouper, SEP issuance, SATUSEHAT reporting |
| **Philippines** | PhilHealth + HMOs + self-pay | ICD-10, RVS | All case rates → DRG pilot [K] | PhilHealth eClaims [K] | Case-rate deductions, No Balance Billing, eClaims |
| **Thailand** | UCS / SSS / CSMBS + private | ICD-10-TM | Thai DRG v6.x [K] | NHSO e-claim [K] | Scheme-specific rules, DRG relative weights |
| **Kenya** | SHA (PHF, SHIF, ECCIF; plus POMSF for public officers) + private [51] | ICD-10/11 (transition) [K] | Package/tariff-based [51] | SHA provider portal [51] | Eligibility at registration, tariff mapping, claims tracking |
| **Nigeria** | NHIA via HMOs; states; self-pay | ICD-10 [K] | Capitation + fee-for-service [K] | HMO portals / authorization codes [K] | Multi-HMO authorization, capitation reconciliation |
| **South Africa** | Private medical schemes + public; NHI Act (2024) | ICD-10 (WHO), NAPPI, tariff codes [K] | Per-diem / ARMs, limited DRG [K] | Switching houses (EDI) [K] | Real-time switch claims, PMB logic |
| **Brazil** | SUS + supplementary health (ANS) | CID-10, SIGTAP, TUSS | AIH (SUS); DRG Brasil (some private) [K] | SIH/SIA (SUS); **TISS Sept/2026** (private) [52] | Dual SUS/TISS engines, glosa management |

### 2.4 ICD-11 adoption status (Oct 2026)

- **Status:** ICD-11 came into effect 1 Jan 2022. Countries may keep using ICD-10 "for as long as necessary", but WHO stopped maintaining ICD-10 in 2018. WHO warns that relying only on ICD-10↔ICD-11 crosswalks causes data gaps [53].
- **Adoption counts:** of 132 Member States/areas engaged, 72 have started implementation (including translation), 50 are running or expanding pilots, and 14 are collecting or reporting ICD-11 data [55]. The paper cites these only as "recent WHO reports". The "May 2024" date given in pass 1 could not be confirmed, but IFHIMA repeats the 132 total as of July 2025 [56]. The categories overlap, so they should not be summed.
- **Furthest along:** China, Iran, Kuwait, Malaysia, and UNRWA are cited as more advanced [55].
- **France:** dual-coding pilots from 2025 [55]. **US:** an NCVHS ICD-11 workgroup but no regulatory implementation date. The paper's authors propose full deployment by about 2030 as a "realistic yet ambitious" goal; this is not a federal plan [55].
- **WHO releases:** the 2025 update (released 14 Feb 2025: 14 languages, a traditional-medicine module covering Ayurveda/Siddha/Unani, API/FHIR coding integration and NLP coding aids) [54], and the current **2026-01** MMS release in the WHO ICD-11 browser [74].
- **Reimbursement:** WHO says an ICD-11/ICHI-based DRG system is still under development [53]. **No major DRG payer is known to reimburse on ICD-11 as of this writing** [K].
- **Implication:** support ICD-11 MMS (post-coordination clusters, stem codes plus extension codes) as a *clinical and statistical* code system now, with dual-coding capability. Keep billing on national ICD-10 modifications until each payer switches.

### 2.5 Self-pay-heavy markets: functional requirements

These are first-class needs in India, South Asia, Africa, private hospitals in MENA and SE Asia, and medical tourism [K]:

1. **Deposits and advances:** admission deposit by estimated package or bed category; top-up alerts when the running bill passes a threshold of the deposit; refunds of unused deposit; deposit transfer between encounters and family members (with controls).
2. **Interim and running bills:** day-wise bill view for patients and relatives, with the estimate compared to actual.
3. **Packages and bundles:** fixed-price surgical packages with inclusions and exclusions, length-of-stay limits, room-category multipliers, implant pass-through, and "package overrun" rules.
4. **Multiple price lists/tariffs:** general, corporate A/B/C, insurer/TPA-specific, government scheme (CGHS/PM-JAY), international patient, staff, and VIP. Room-category-based pricing (general ward / semi-private / private / suite) that recalculates *other* charges. In India, insurers apply "proportionate deduction" when room rent exceeds policy caps [K].
5. **Corporate and credit billing:** credit limits, authorization letters, co-pay splits, monthly statements, aging per corporate account.
6. **Discounts and concessions:** approval workflows (amount and % thresholds by role), charity/welfare funds (e.g., Zakat-funded or trust-funded), and audit trails.
7. **Multi-currency:** price in local currency, collect in USD/EUR/AED, FX revaluation, and international patient desks.
8. **Tax engine:** GST/VAT by item and patient category, e-invoicing integration (Saudi ZATCA, India GST e-invoicing for B2B) [K].
9. **Cash management:** shift-wise cashier closing, denomination counts, cash/card/UPI/mobile-money reconciliation (M-Pesa in Kenya, UPI in India) [K].
10. **Billing finalization before discharge:** "bill clearance" gating the discharge workflow (ethically sensitive and regulated in some jurisdictions). This should be configurable and should never block clinical discharge orders.

---

## 3. Hospital ERP

### 3.1 Finance core

- **General ledger:** multi-entity (hospital, clinics, foundation), multi-currency, multi-book (IFRS/local GAAP). The chart of accounts must align with statutory hospital reporting. In the US that is the Medicare cost report CMS-2552-10 cost centers [K]; other countries have their own (e.g., German KHBV accounting rules [K]).
- **AP/AR:**
  - *Patient AR stays in the RCM sub-ledger.*
  - Non-patient AR (grants, rentals, corporate contracts) lives in the ERP.
  - The RCM sub-ledger posts summarized journals (revenue by cost center/payer, contractual adjustments, cash, bad debt, charity) to the GL daily.
- **Cost centers:** the hierarchy of revenue-producing departments (lab, radiology, OR), nursing units, and overhead departments (EVS, dietary, admin). This hierarchy is the backbone of departmental P&L and step-down cost allocation [K].
- **Budgeting:** volume-driven (statistics budget → revenue budget → labor budget based on FTE/HPPD targets → non-labor budget), flex budgeting on actual volumes, and rolling forecasts. Tools include Axiom (Kaufman Hall, acquired by Vizient in 2024 [K]), Strata, Workday Adaptive Planning, and Oracle EPM [K].
- **Fixed assets:** capitalization thresholds, componentization, depreciation by local rules, transfers, disposals. Integrates with biomedical asset management (§3.4) through a shared asset ID.

### 3.2 Cost accounting

| Method | How it works | Where used | Limitation |
|---|---|---|---|
| **RCC (ratio of cost to charges)** | Department cost ÷ department charges × patient charges | US cost report, legacy | Charges are distorted, so costs are inaccurate [K] |
| **RVU/standard costing** | Standard cost per charge code built from RVUs or engineered standards, then reconciled to GL | Most US cost accounting systems (Strata, Epic Cost Accounting, etc.) [K] | Effort to maintain standards |
| **Activity-based costing (ABC)** | Resources → activities → cost objects via drivers | Germany InEK calculation [K], Australia NHCDC [K], NHS PLICS [37][38] | Data-intensive |
| **Time-driven ABC (TDABC)** | Two parameters: capacity cost rate (cost per minute of each resource) × time each patient spends with the resource, from process maps (Kaplan & Porter, HBR 2011) [57] | Value-based care pilots, ortho/oncology episodes [K] | Needs accurate time stamps |

**Patient-level costing is mandatory or quasi-mandatory in several markets:** NHS PLICS feeds the National Cost Collection and NHSPS prices [37][38], InEK cost-calculation hospitals feed German DRG weights [26], and Australia's NHCDC feeds IHACPA prices [43][K].

**Design implication:** every clinical event should carry a **resource ID** (staff, room, device), **start/stop time stamps**, and **consumed items (with lot)**. That data enables TDABC later at near-zero marginal cost.

### 3.3 Procurement and supply chain

- **Procure-to-pay:** requisition → approval (budget check) → purchase order → **goods receipt note (GRN)** → invoice → **3-way match** (PO vs GRN vs invoice, with tolerances) → payment. Contract price compliance comes through GPOs (Vizient, Premier, HealthTrust in the US) and the GHX e-commerce exchange [K].
- **Inventory structures:**
  - Central stores, ward/unit stock with **par levels**, two-bin Kanban, and automated dispensing cabinets for supplies.
  - **Low-unit-of-measure (LUM)** distribution.
  - **Consignment** stock (implants, ortho sets) with "bill-only" PO generation upon use.
  - **Loaner trays** managed through the sterile processing department (SPD) [K].
- **Implants and traceability:**
  - **UDI** (FDA UDI rule with the GUDID database; EU MDR UDI with EUDAMED) [K].
  - **GS1** identifiers (GTIN for products, GLN for locations, GS1 DataMatrix barcodes, EPCIS for traceability events) [63][K].
  - Implant records must link UDI-DI + UDI-PI (lot/serial/expiry) to the patient, the procedure, and the charge for recalls and registries [K].
- **Expiry and FEFO:** first-expiry-first-out picking, near-expiry alerts, and quarantine of expired stock.
- **Recall management:** search by GTIN and lot → locate stock (stores, wards, consignment) → quarantine → identify affected patients (implants, drugs) → notify clinicians. Recall classes I/II/III apply [K].
- **Point-of-use capture:** barcode or RFID scanning in OR, cath lab, and IR documents usage, decrements inventory, triggers replenishment, and generates charges at once. This single event serves clinical, inventory, and RCM needs.
- **Pharmacy vs general stores:** pharmacy has separate regulatory controls: controlled substances registers, batch/lot, cold chain, drug traceability. In the US, DSCSA enhanced drug distribution security has applied since Nov 2023, with phased exemptions [K]. Formulary and pricing logic also differ. Both should share item master *patterns* but keep separate stores, ledgers, and permissions.
- **Spend context:** labor is typically the largest hospital expense and supplies the second-largest [K, estimate].

### 3.4 Biomedical engineering / healthcare technology management (HTM)

- **Asset register:** UDI/serial, manufacturer, model, location, risk classification, warranty, service contracts, and software/firmware versions (cybersecurity patching).
- **Maintenance:** preventive maintenance (PM) schedules per manufacturer or an **Alternative Equipment Management (AEM)** program. CMS has allowed risk-based AEM since 2013, except for specified equipment [K]. **Joint Commission requires 100% on-time PM for high-risk equipment** [K].
- **Testing:** calibration and electrical safety testing (e.g., IEC 62353) with recorded results [K].
- **Corrective maintenance:** work orders, downtime tracking, mean time between failures (MTBF), parts inventory.
- **Integrations:** with RTLS (find the pump), with clinical systems (device association to patient), and with fixed assets (finance).
- **Vendors:** standalone CMMS (e.g., Nuvolo, Accruent/TMS, Phoenix) or ERP EAM modules (SAP PM, Oracle EAM, Infor EAM) [K].

### 3.5 Human resources, credentialing, and privileging

- **Core HR:** position control (budgeted vs filled FTEs by cost center and job code), recruitment/ATS, onboarding, employee health (immunizations, TB, fit-testing), performance, learning management.
- **Licensing and certification:** primary-source verification, expiry alerts (RN license, BLS/ACLS/PALS, DEA registrations), and auto-block from scheduling when expired.
- **Medical staff credentialing and privileging:**
  - Primary-source verification of education, training, license, board certification, malpractice history, and NPDB queries.
  - **Delineated privileges** per procedure.
  - **Focused and ongoing professional practice evaluation (FPPE/OPPE)**.
  - Reappointment cycles (typically at most every 2–3 years, by regulator/accreditor) [K].
  - **The privilege list must be checked by the clinical system:** OR scheduling and order entry should block a surgeon from booking a procedure they are not privileged for.
- **Competencies:** unit-specific competencies (e.g., CRRT, chemo administration) linked to scheduling eligibility.

### 3.6 Staff scheduling, rostering, and staffing rules

**Approaches:**
- **Fixed ratios.** California mandated nurse:patient ratios (e.g., 1:5 med-surg, 1:2 ICU, 1:4 ED) [K]. Oregon passed enforceable statewide ratios (HB 2697, 2023, phased from 2024) [K]. Victoria and Queensland (Australia) have ratio laws [K].
- **Statutory staffing duties/tools.** Wales: Nurse Staffing Levels Act 2016. Scotland: Health and Care (Staffing) Act, commenced April 2024. Germany: nurse staffing floors (PpUGV) and PPR 2.0 [K].
- **Acuity-based staffing.** Patient classification systems compute required care hours from patient acuity and convert them to HPPD-based staffing targets [K].

**Fatigue and working-time rules:**
- EU Working Time Directive (48 h/week average, 11 h daily rest) [K].
- US residents: ACGME 80 h/week averaged over 4 weeks [K].
- Local union and collective-bargaining rules (consecutive shifts, weekend rotation, seniority bidding).

**Features:**
- Self-scheduling, shift bidding, float pool, agency/locum management, on-call rosters (with call-back pay), and skill-mix constraints.
- Real-time census-driven staffing adjustments (flex up/down), and **optimization solvers** for roster generation.
- Integration with the HMS census and acuity data.

**Vendors:** UKG (Kronos), symplr (API Healthcare/ShiftWizard), QGenda (physicians), Allocate/RLDatix (UK), plus Workday, Oracle, and SAP scheduling modules [K].

### 3.7 Payroll and time-and-attendance

- **Healthcare payroll specifics:**
  - Shift differentials (night/weekend), on-call and call-back pay, overtime.
  - US FLSA's hospital-specific "8 and 80" overtime option [K].
  - Premium/incentive shifts, agency invoices, multiple concurrent jobs/rates per employee.
  - Physician compensation (wRVU-based productivity, stipends, call pay).
  - Retroactive pay awards (e.g., the NHS 2026/27 pay award required a tariff update [37][40]).
- **Time capture:** biometric or badge clocks, mobile geofencing, and timecard approval by unit managers. Labor distribution to cost centers feeds productivity reporting (§5).

### 3.8 ERP vendor landscape and integration patterns

| Segment | Typical choices | Notes |
|---|---|---|
| US/large IDNs and AMCs | **Workday** (HCM, Financials, SCM), **Oracle Fusion Cloud** (ERP/SCM/HCM), **Infor CloudSuite Healthcare** (strong in supply chain via GHX), **SAP S/4HANA** [K] | Epic + Workday is a common pairing [K]. Epic exposes cost centers, charges, and supply usage via interfaces and Chronicles/Clarity extracts [K] |
| Germany / DACH | SAP (historically with IS-H patient management, which is not carried forward to S/4HANA; migrations run through about 2027–2030) [K] | Big migration wave: an opportunity for HMS vendors with SAP integration |
| UK NHS | Oracle, SAP, Unit4, Infor; NHS Shared Business Services; ESR (national workforce/payroll system) [K] | ESR integration is mandatory for workforce data [K] |
| GCC | Oracle (EBS → Fusion), SAP, Microsoft Dynamics 365 [K] | Arabic/Hijri calendars, ZATCA e-invoicing |
| Emerging markets / mid-size private | HMS-embedded finance & stores, **Odoo**, **Microsoft Dynamics 365 Business Central**, **SAP Business One**, **Tally** (India), NetSuite, Sage [K] | Buyers expect the HMS to include inventory, pharmacy, purchase, and basic accounting |

**Integration patterns:**
1. **Master data:** item master, vendor master, cost centers, employees/providers, and the chart of accounts. Decide per object which system is the source of truth.
2. **Transactional:** HMS → ERP: summarized revenue and cash journals, supply consumption, requisitions. ERP → HMS: PO status, item prices, employee status/terminations, cost-center changes.
3. **Standards:** ERP APIs (REST/SOAP), flat-file batch for GL, HL7 v2 MFN/MFE for master files, FHIR (`Practitioner`, `Organization`, `Location`, `Device`; `SupplyRequest`/`SupplyDelivery` and `InventoryItem` only as optional edge projections), EDI 850/855/856/810 for procurement via GHX [K]. *(Reconciled 2026-10-16: `InventoryItem` is an **R5** resource at FMM 0, and the R6 ballot moves it out of core into an incubator IG. So do `InventoryReport`, `SupplyRequest` and `SupplyDelivery` [78][79]. The item master, stock and requisitions are internal aggregates, per `11` §12.)*

---

## 4. Operations and patient flow

### 4.1 Bed management and environmental services

- **Bed board:** a real-time view of beds by unit, with:
  - Bed status as a state machine: *occupied → pending discharge → vacated/dirty → cleaning in progress → clean/inspected → ready/assigned → occupied*.
  - Blocked beds (isolation, maintenance, staffing).
  - Bed attributes (gender, isolation capability, telemetry, bariatric).
- **Bed request and assignment:** from ED, PACU, direct admits, and transfers. Assignment rules cover specialty, gender, isolation, and acuity. Escalation timers drive the "admit decision → bed assigned → bed ready → patient in bed" chain.
- **EVS integration:** a discharge event automatically creates a cleaning job, dispatched to the nearest available EVS staff member via mobile app. Clean type (standard vs terminal vs C. diff UV) is inferred from isolation flags. Turnaround time is measured from "dirty" to "clean".
- **Products:** Epic Grand Central/Capacity Management, TeleTracking, Oracle Health Capacity Management, and others [K].

### 4.2 Capacity command centers

- **Exemplars:**
  - Johns Hopkins Hospital's Judy Reitz Capacity Command Center (2016, with GE HealthCare) [K].
  - Humber River Hospital, Toronto (Canada's first, opened fall 2017, GE) [K, consistent with GE reporting].
  - Tampa General's CareComm. A temporary center opened Dec 2018 and the permanent center on about 20 Aug 2019 with GE; it was described as "first in Florida and only the fourth in the world" [69]. *Correction: an earlier draft said 2020.*
  - Bradford Teaching Hospitals, UK (2019, GE) [K, not re-verified].
  - Many Epic- and TeleTracking-based centers.
- **Common pattern:** co-locating bed management, transfer center, EMS dispatch, EVS/transport dispatch, staffing, and clinical surveillance. Wall displays of "tiles" (single-purpose apps) monitor flow constraints and patient-level risks [K].
- **Evidence:** reported benefits include faster ED bed assignment, more accepted transfers, fewer OR/PACU holds, and reduced boarding. These come mostly from **self-reported single-site pre/post analyses**, often with vendor involvement [K]. A scoping review of hospital capacity command centers (Franklin et al., *J Patient Saf* 2022;18(6):e912–e921; literature through April 2019) found only 8 eligible articles (4 peer-reviewed) describing 7 centers. All reported improvements, but the authors judged design heterogeneity and evidence quality too limited for generalization, with peer-reviewed evidence "in its earliest stages" [72]. A 2023 benchmarking survey by the same group found 25 operating centers among 31 US respondents. All 18 that tracked ROI reported it as positive, but this was self-reported [72]. Vendor outcome claims for predictive-flow tools (LeanTaaS: "+$10K per bed/year, +2% admissions" [58]; Qventus: "15–30% reduction in excess days" [59]) have no published methodology on the vendor pages.
- **Lesson for our build:** success depends on (a) reliable real-time event data, (b) explicit escalation rules and owners, (c) standard work and daily huddles. The command-center UI is necessary but not sufficient.

### 4.3 Predictive discharge and census forecasting

- **Patient-level predictions:**
  - **Expected discharge date** (clinician-entered plus ML-adjusted).
  - **Discharge readiness/barrier** tracking (pending consults, imaging, placement, transport, medications to bring home).
  - Likelihood of discharge in the next 24/48 h.
- **Unit and hospital forecasts:** census, admissions by hour/day (time-series models with seasonality, elective schedule, ED arrivals), and surge prediction. Forecasts feed staffing and elective-cancellation decisions.
- **Governance:** model monitoring, calibration per site, and explainability. Avoid opaque scores that clinicians ignore.

### 4.4 Transfer center and patient transport

- **Transfer center:** intake of external transfer requests, physician-to-physician call connection (recorded), bed availability check, acceptance/decline with reasons (EMTALA obligations in the US [K]), transport arrangement (ground/air), and outreach analytics (referral leakage).
- **Internal transport:** a dispatch system for porters (wheelchair/stretcher/bed), priority rules, mobile task queues, and performance (response and completion times). It integrates with EVS and bed management.

### 4.5 Perioperative / OR scheduling optimization

- **Block scheduling:** block allocation by surgeon/service, **release rules** (e.g., unused blocks released 72 h or 7 days prior), open time, and an auction/marketplace for released time.
- **Metrics:** block utilization, prime-time utilization, first-case on-time starts (FCOTS), turnover time, case-duration accuracy (scheduled vs actual), cancellations (day-of-surgery), PACU holds.
- **Tools:** case-duration prediction (ML on surgeon, procedure, patient factors), sequencing, and staff/equipment/tray coordination with SPD. LeanTaaS iQueue for ORs claims a mean +6% case volume and about $100K per OR/year (vendor claim) [58].

### 4.6 Outpatient queue management

- Token or ticket systems with kiosks and SMS, virtual queues, multi-step journey orchestration (registration → vitals → consult → lab → pharmacy → billing), clinic load balancing, displays, and no-show prediction with overbooking.
- In high-volume OPDs (India, Africa, SE Asia), queue management is a **core** module, often with cash/billing checkpoints between steps [K]. *(Reconciled 2026-10-16: `03` §2 row 5 now puts the OPD token queue in the clinical MVP for India/KSA, which matches §9.3 #6.)*

### 4.7 Real-time location systems (RTLS)

- **Technologies:** infrared (room-level certainty), BLE, Wi-Fi, UWB (sub-meter), passive and active RFID [K].
- **Use cases:**
  - Asset tracking (pumps, wheelchairs) to reduce rental and hoarding.
  - Staff duress buttons.
  - Infant protection and wander management.
  - Hand-hygiene compliance.
  - Automated patient-journey time stamps (feeds TDABC and throughput metrics).
  - Temperature monitoring of fridges (vaccines, blood).
- **Vendors:** CenTrak, Midmark, Securitas/Stanley (AeroScout), Sonitor, Kontakt.io [K].
- **HMS role:** consume location events via API and use them to automate statuses (e.g., patient arrived in OR, room vacated).

### 4.8 Support services

| Service | Core functions | Integration with HMS |
|---|---|---|
| **Environmental services** | Task dispatch, clean types, inspections, supply par for EVS | Bed status, isolation flags |
| **Linen/laundry** | Par per unit, soiled/clean tracking (RFID tagged linen), contractor billing by weight | Census-based par |
| **Dietary/food services** | Diet orders from EHR (texture, allergies, NPO, cultural/religious), menu selection, tray tickets, nutrient analysis, patient charges for extras | Orders, allergies, NPO events from OR schedule |
| **Mortuary** | Body receipt and release, storage location, chain of custody, autopsy/medico-legal holds, death certificate status (ICD-11 cause-of-death coding via WHO tools such as DORIS [53]) | Death event in ADT, legal/police workflows |
| **Security/visitor management** | Visitor registration/badging, visiting rules per unit (e.g., ICU), watch-lists, incident logs | ADT (patient location, privacy flags) |
| **Facilities / CAFM** | Work orders, planned maintenance, space management, utilities, statutory inspections (fire, lifts, medical gases) | Room status (out-of-service beds), asset register |
| **Energy** | Building management system (HVAC, OR air changes, pressure monitoring), metering, sustainability reporting | OR schedule-driven HVAC setback [K] |
| **Sterile processing (SPD)** | Instrument tray tracking, sterilization cycles, load records, recall by load | OR case carts, patient-tray linkage |

---

## 5. MIS and analytics for management

**Executive dashboards.** Typical tiles: volumes (admissions, discharges, ED visits, surgeries, OPD visits); case mix index; revenue vs budget; cash collections; AR days; DNFB; denial rate; labor productivity; supply cost per case; occupancy/ALOS; quality and safety (HAIs, falls, readmissions); patient experience.

**Departmental P&L.** Revenue by cost center (gross charges → net revenue via contractual allowances) less direct costs (labor from payroll distribution, supplies from consumption, depreciation from fixed assets) less allocated overhead (step-down). This requires the cost-center discipline in §3.1.

**Payer mix.** Share of gross and net revenue and of patient days by payer class (Medicare/Medicaid/commercial/self-pay, or NPHIES insurers/government/self-pay, etc.). Net revenue per adjusted discharge by payer.

**Productivity metrics:**
- **HPPD (hours per patient day):** worked (or paid) nursing hours ÷ patient days for a unit.
- **Adjusted patient days / adjusted discharges:** inpatient days × (total gross revenue ÷ inpatient gross revenue). This converts outpatient activity into inpatient-equivalent volume [K].
- **FTE per adjusted occupied bed (AOB):** total FTEs ÷ (adjusted patient days ÷ days in period) [K].
- **Worked hours per unit of service** by department (lab tests, imaging procedures, OR minutes), benchmarked through vendors such as Vizient, Premier, Strata [K]. In England, the national Model Health System benchmarks productivity and cost [K].

**Regulatory and statistical reporting:**
- **US:** Medicare cost report, AHA Annual Survey, state discharge data, quality reporting (IQR/OQR), price transparency MRFs [8][K].
- **England:** SUS+, ECDS, National Cost Collection, NHSPS activity [37][38][K].
- **Germany:** §21 KHEntgG data, quality reports, Pflegebudget data to InEK [31][K].
- **Australia:** ABF activity data, NHCDC [41][43].
- **LMICs:** national HMIS returns (monthly facility aggregates: OPD attendance by diagnosis, admissions, deliveries, deaths, immunizations, notifiable diseases) are frequently on **DHIS2**, used in many dozens of countries. Kenya's KHIS and Nigeria's NHMIS are DHIS2-based [62][K]. Integration options: DHIS2 Web API (dataValueSets), IHE **ADX**, and emerging FHIR-based aggregate reporting (e.g., WHO SMART Guidelines IGs) [K]. India: HMIS portal returns and ABDM [K]. Indonesia: SATUSEHAT [K].

**Design implication:** maintain an **indicator catalogue** (definition, numerator/denominator, data source, period, disaggregations, target) so the same metric definitions drive internal dashboards and statutory returns.

---

## 6. KPI tables

### 6.1 Revenue cycle KPIs

| KPI | Definition (HFMA MAP Key where applicable) | Benchmark / reference range | Source / confidence |
|---|---|---|---|
| **Net days in A/R** (FM-1) | Net patient A/R ÷ average daily net patient service revenue | Common target <40–50 days for hospitals; <35 often called best-in-class (vendor) | [12] definition; range = estimate [13][K] |
| **DNFB days** (PB-1) | Gross DNFB $ ÷ average daily gross patient service revenue | ≤4 days target | [12][13] |
| **FBNS days** (PB-2) | Gross $ final-billed but held in the claims tool ÷ average daily gross revenue | <1–2 days | [12]; range estimate |
| **Charge lag** (PB-4) | Average days from service date to charge posting | <2–3 days; late charges = posted >3 days after service | [12]; range estimate |
| **Clean claim rate** (CL-1) | Claims passing edits with no manual intervention ÷ claims accepted into the claims tool | >85% (HFMA/PwC deck); vendors cite 95–98%, but no professional-society standard exists | [12][13] |
| **Initial (remittance) denial rate** (AR-5) | Claims denied ÷ claims remitted (claim level) | US average 11.6% (2025); 10.63% (H1 2026) | [12][14][64] |
| **Final denial write-off rate** (AR-6 variant) | Net denial write-offs ÷ NPSR | Kodiak median final denial rate 2.7% (2025) | [12][14] |
| **Aged A/R >90 days** (AR-1) | Billed A/R >90 days ÷ total billed A/R | <15–20% target | [12]; range estimate |
| **Cost to collect** (FM-6) | Total revenue cycle cost ÷ total patient service cash collected | 2–4% typical target | [12]; range estimate [13][K] |
| **Cash collection as % of NPSR** (FM-2) | Patient service cash ÷ average monthly NPSR | ≥100% (steady state) | [12]; estimate |
| **Net collection rate** | Payments ÷ (charges − contractual adjustments) | 95–99% target | Estimate [K] |
| **POS cash collections** (PA-7) | POS payments ÷ total self-pay cash | Varies by market; rising emphasis | [12] |
| **Pre-registration / insurance verification rate** (PA-2/PA-3) | Pre-registered or verified encounters ÷ scheduled/registered | >95–98% | [12]; estimate |
| **Auto-posting rate** | 835 lines auto-posted without touch ÷ total | >90% | Estimate [K] |
| **Case mix index** (FM-5) | Σ MS-DRG weights ÷ discharges | Hospital-specific; trend matters | [12] |
| **Prior auth turnaround (payer)** | Time from request to decision | ≤72 h expedited / ≤7 days standard (impacted payers, from 2026) | [2][4] |
| **Self-pay markets: deposit coverage** | Deposits held ÷ running bill for open inpatient accounts | Target ≥100% by policy | Estimate [K] |
| **Government scheme claim payment TAT** (e.g., PM-JAY/SHA) | Days from claim submission to payment | Scheme SLAs vary; track by scheme | [51][K] |

### 6.2 Operations KPIs

| KPI | Definition | Benchmark / reference | Source / confidence |
|---|---|---|---|
| **Average length of stay (ALOS)** | Total inpatient days ÷ discharges (exclude day cases; report also as observed/expected via DRG GMLOS) | Strongly country-dependent: about 4.5–5.5 days typical US acute; much longer in Germany/Japan | Estimate [K] |
| **Bed occupancy rate** | Occupied bed-days ÷ available bed-days | ~85% often cited. Bagust et al. (BMJ 1999, a simulation study) found risks "discernible" above about 85% average occupancy, with regular bed shortages and periodic crises at ≥90%. England planning has used ≤92% G&A [K] | Bagust [73]; England target [K] |
| **Bed turnover rate** | Discharges ÷ average available beds (per period) | Context-specific | Definition [K] |
| **Turnover interval** | (Available − occupied bed-days) ÷ discharges | Lower = tighter; too low raises risk | Definition [K] |
| **Discharge before noon** | % of discharges with departure before 12:00 | Common target 25–40% | Estimate [K] |
| **Bed turnaround (EVS)** | Time from "dirty" to "clean/ready" | Target <60 min standard clean | Estimate [K] |
| **ED door-to-provider** | Arrival → first provider contact (median) | Common target <30 min | Estimate [K] |
| **ED LWBS** | Patients leaving before being seen ÷ ED arrivals | Common target <2% | Estimate [K] |
| **ED boarding time** | Time from admit decision to ED departure | Joint Commission recommends boarding not exceed 4 h [K]; England 4-hour standard (interim 78% target for March 2026) [K] | [K] |
| **OR first-case on-time starts** | % first cases with incision/wheels-in at scheduled time (define tolerance) | ≥80–90% target | Estimate [K] |
| **OR turnover time** | Wheels-out → next wheels-in, same room | ~25–40 min typical targets | Estimate [K] |
| **Block utilization** | (Used block minutes + turnover credit) ÷ allocated block minutes | Targets ~75–85% | Estimate [K] |
| **Day-of-surgery cancellation rate** | Cancelled cases on the day ÷ scheduled | <2–5% | Estimate [K] |
| **30-day readmission rate** | Unplanned readmissions within 30 days ÷ index discharges | Medicare all-cause around mid-teens %; condition-specific per HRRP | Estimate [K] |
| **HPPD** | Nursing worked hours ÷ patient days | Med-surg about 7–9; ICU about 16–24 | Estimate [K] |
| **FTE per adjusted occupied bed** | FTEs ÷ (adjusted patient days ÷ days) | US hospitals often ~4–7 | Estimate [K] |
| **PM completion (high-risk equipment)** | Completed PMs on time ÷ scheduled | 100% (Joint Commission) | [K] |
| **Transfer acceptance rate / time to accept** | Accepted ÷ requested; request → decision time | Track declines by reason (no bed, no specialty) | Definition [K] |

---

## 7. Canonical finance data model

The core entities below map to HL7 FHIR R4 Financial resources [60] and established RCM designs (e.g., Epic's guarantor account / hospital account / liability bucket concepts [K]).

*Reconciled 2026-10-16: the "FHIR mapping" column is **naming guidance and edge projection only**. Every entity here is an internal aggregate with its own lifecycle; none is persisted as FHIR JSON. That includes charge items, charge definitions/tariffs, packages, payer contracts, invoices and the ledger. The R6 ballot moves `ChargeItem`, `ChargeItemDefinition`, `Invoice`, `Contract` and `InsurancePlan` out of core into incubator IGs [78]. Project to them only when a partner or national IG requires it. See `11` §11 and `06` §3.2.1.*

| Entity | Purpose | Key attributes | FHIR mapping (naming guidance / edge projection only) |
|---|---|---|---|
| **Patient / Person** | Clinical subject | MRN(s), national IDs (ABHA, Iqama, Emirates ID, MBI, KVNR) | `Patient` |
| **Guarantor (financially responsible party)** | Who pays the patient share | Person or organization, relationship, address, credit status, statement preferences | `Account.guarantor`, `RelatedPerson`/`Organization` |
| **Guarantor account** | Aggregates patient-responsibility balances across encounters (SBO) | Balance, payment plans, statements, collections status | `Account` (type = guarantor) |
| **Encounter / visit** | Clinical episode | Type (IP/OP/ED/day case), dates, location, attending, discharge disposition | `Encounter`, `EpisodeOfCare` |
| **Billing account (encounter account / case)** | Financial container for one billable episode; maps to one or more claims | Account class, financial class, admit/discharge, DRG, billing status (open/DNFB/billed/closed), country-specific case IDs (e.g., §301 case number, AIH number) | `Account` (type = encounter/case) |
| **Coverage** | Insurance/scheme membership | Payer, plan, member ID, subscriber, relationship, effective dates, **priority order (COB)**, network, co-pay rules | `Coverage` |
| **Eligibility check** | Point-in-time verification | Request/response, benefits, accumulators, time stamp | `CoverageEligibilityRequest/Response` (X12 270/271, NPHIES, NHCX) |
| **Authorization** | Pre-auth/approval | Services, units, validity, status, payer reference, attachments | `Claim` (use = preauthorization), `ClaimResponse` (PAS/NPHIES/NHCX) |
| **Estimate / GFE / quotation** | Pre-service price | Line items, providers (NPI/TIN), contract basis, patient share, validity | `Claim` (use = predetermination) / custom |
| **Charge item** | One billable event | Charge code (CDM), service date, quantity, unit price (from price list), performing/ordering provider, revenue code, CPT/HCPCS/local code, modifiers, cost center, source event link, lot/UDI | `ChargeItem` |
| **Charge definition / price list (tariff)** | Price rules | Code, price by tariff, effective dating, room-category multipliers, package membership | `ChargeItemDefinition` |
| **Package / bundle** | Fixed-price episode | Inclusions/exclusions, LOS limit, implant pass-through, overrun rules | `ChargeItemDefinition` (composite) |
| **Payer contract** | Expected reimbursement model | Methodologies (DRG×base, per diem, %charges, fee schedule, packages, capitation), carve-outs, outliers, effective dating | `Contract`, `InsurancePlan` |
| **Coding abstract** | Final codes for billing/statistics | Dx (with POA), Px, sequence, grouper inputs/outputs (DRG/HRG/GHM/AR-DRG, weights), coder, version | `Claim.diagnosis/procedure`, custom |
| **Claim** | Bill to a payer | Type (institutional/professional/dental/pharmacy), lines, coverage sequence, attachments, status lifecycle, external IDs (ICN, NPHIES ID) | `Claim` |
| **Claim response / remittance** | Adjudication result | Paid/allowed/patient share, adjustment reason codes (CARC/RARC, glosa codes, §301 payment record) | `ClaimResponse`, `ExplanationOfBenefit`, `PaymentReconciliation` |
| **Liability bucket** | Who owes what, sequentially | Primary/secondary/tertiary/self-pay bucket per account, balance per bucket | Custom (Account sub-balances) |
| **Financial transaction** | Ledger entries on accounts | Types: charge, payment, adjustment (contractual, administrative, bad debt, charity, discount, small balance), refund, transfer; GL mapping; reversal links; immutable | Custom (append-only ledger) |
| **Deposit / advance** | Pre-payment held | Amount, currency, applied/unapplied, refundable flag | `PaymentNotice`/custom |
| **Invoice / statement** | Document to guarantor/corporate | Lines, tax lines (VAT/GST), e-invoice ID (ZATCA/GST), currency | `Invoice` |
| **Denial / work item** | Exception management | Root cause, owner, SLA, appeal status, recovered amount | `Task` + custom |
| **GL journal (summary)** | Interface to ERP | Entity, period, account, cost center, payer class, amount | n/a (ERP) |

**Rules that matter:**
1. **Append-only ledger.** Never update monetary amounts in place. Post reversals. Every amount must trace to a source event and user.
2. **Effective-dated everything:** prices, contracts, code sets, grouper versions, tax rates, edits. Claims must be re-gradable "as of date of service".
3. **Separate clinical truth from billing representation:** the clinical record generates charge items. Billing views (claims, packages, DRG bills) are *derived* and can be regenerated.
4. **Coverage priority and liability transfer** are explicit and auditable (primary → secondary → patient).

---

## 8. Design guidance: configurability and "integrated RCM"

### 8.1 What makes RCM "integrated"

1. **One patient account across clinical and financial domains.** Registration, orders, documentation, charges, coding, claims, and payments share identifiers and real-time state. There are no batch re-keying interfaces between "clinical HIS" and "billing system".
2. **Charges derived from clinical events** (orders, MAR administrations, OR times, supply scans), with charge-reconciliation dashboards.
3. **Front-end-to-back-end feedback loops.** Denial root causes feed back into registration edits, prior-auth rules, and CDI queries.
4. **Single billing office** for facility and professional fees with one patient statement.
5. **Shared contract engine** for estimates, expected reimbursement/underpayments, and transparency files [8].
6. **Work queues everywhere** (registration, auth, coding, DNFB, edits, denials, follow-up) with SLA timers and productivity metrics.

### 8.2 Multi-country configurability

- **Country pack** (versioned, deployable artifact) containing:
  1. Code systems and value sets (ICD-10 national modification, procedure system, drug codes, ICD-11).
  2. Grouper adapter(s) behind a **Grouper SPI** (input: case abstract; output: group, weight, LOS bounds, flags). Groupers may be licensed: APR-DRG (Solventum), AR-DRG (IHACPA licence), certified G-DRG groupers. Some are public: the CMS MS-DRG grouper, the HRG4+ grouper from NHS England, and ATIH's grouping function [K].
  3. Claim adapters (X12, §301, NPHIES FHIR, NHCX FHIR, eClaimLink/Shafafiya XML, TISS XML, PMSI files, SUS+ CDS, SHA/PM-JAY portals).
  4. Edit/validation rule sets (NCCI-like, national edits, payer edits).
  5. Tax and e-invoicing rules.
  6. Statutory reports (HMIS/DHIS2 datasets, cost collections).
  7. Calendars, languages, RTL, and number/currency formats.
- **Rules engine** (decision tables + expression language) for eligibility routing, price derivation, package logic, discount approvals, authorization requirements, and claim edits. Use explicit versioning and simulation ("what would this claim look like under the new contract?").
- **Tariff engine:** price lists × room category × patient category × payer, with inheritance (base list + overrides), effective dating, and packages.
- **Payer/contract registry:** payer → plans → contracts → terms, with network status and authorization rules.

### 8.3 Common pitfalls

1. **Separate HB and PB systems** with reconciliation spreadsheets, which yields multiple statements and patient confusion.
2. **CDM sprawl:** duplicate codes, missing revenue codes, prices not maintained, no ownership.
3. **Hard-coded tariffs and country logic** in application code, which makes every new payer a release.
4. **No effective dating,** so retroactive contract changes or code-set updates corrupt historical claims.
5. **Mutable financial records** (editing amounts in place) that fail audits.
6. **Single clearinghouse dependency.** The Change Healthcare 2024 outage showed the systemic risk [K].
7. **Treating prior auth as a fax and phone process** when it is becoming API-based (CMS-0057-F, NPHIES, NHCX) [1][44].
8. **Ignoring the professional/physician side** in markets where doctors bill separately (US, South Africa, Brazil, India private consultants with revenue share).
9. **Over-promising autonomous AI coding** without audit trails and accountability [20][21].
10. **Discharge-blocking bill clearance** that harms patient flow. Separate *clinical discharge* from *financial clearance*.
11. **GL posting from HMS at line level** into the ERP. Post summarized journals with drill-back instead.
12. **Command center as a screen project** without data latency guarantees, owners, and escalation rules [K].

---

## 9. Implications for our build (opinionated)

### 9.1 Build natively vs integrate

| Capability | Decision | Rationale |
|---|---|---|
| Patient access (scheduling, registration/ADT, coverage, eligibility, authorization) | **Build native** | Core to every workflow and to downstream data quality |
| Patient financial ledger (accounts, charges, transactions, liability buckets, deposits, statements) | **Build native** | The "single patient account" is our differentiator; ERPs cannot do this |
| CDM/tariff engine, packages, contract engine (expected reimbursement + estimates) | **Build native** | Multi-country configurability is the moat |
| Coding workbench + CDI worklists | **Build native** (UI + workflow) | Integrate AI coding engines via an API (vendor-neutral), keep audit and human-in-the-loop native |
| DRG/HRG/case-mix groupers | **Integrate via Grouper SPI** | Licensing and certification (Solventum, IHACPA, InEK-certified); use public groupers natively where licensing allows (MS-DRG, HRG4+, ATIH) [K] |
| Claim formatting and national platforms | **Build adapters natively** for national platforms (NPHIES, NHCX, §301, Shafafiya/eClaimLink, TISS); **integrate clearinghouses** for US/South Africa switches | National platforms are few and stable; US clearinghouses add payer connectivity we can't replicate |
| Denials/underpayments analytics | **Build native** (work queues + root-cause taxonomy); optional integration with specialist vendors | Feedback loop requires native data |
| Price transparency MRF / GFE (US) | **Build native** on contract engine + 835 history | 2026 rule makes 835-derived percentiles mandatory [8] |
| GL, AP, fixed-asset accounting, HCM, payroll | **Integrate** with Workday/Oracle/SAP/Infor/Dynamics in mature markets; **embed a lightweight finance module** (GL, AP/AR, cash/bank, fixed asset register) for emerging markets | Payroll/HR is regulated and country-specific; mature buyers already own an ERP |
| Inventory, pharmacy stores, point-of-use, implants/UDI, consignment, recall | **Build native** (clinical supply chain); integrate procurement with ERP where present | Clinical consumption is tied to patient and charge; ERPs are weak at point-of-use |
| Procurement (PR→PO→GRN→3-way match) | **Native "lite"** for emerging markets; integrate with ERP/GHX in mature markets | Avoid duplicating ERP P2P where present |
| Biomedical/HTM CMMS | **Native module** (asset register + PM + work orders) with an integration option | Ties to RTLS, device-patient association, fixed assets |
| Credentialing/privileging | **Native privileging enforcement**; integrate with credentialing systems (e.g., symplr, CredentialStream) or HR | Privileges must gate clinical actions in real time |
| Staff scheduling/rostering | **Integrate** best-of-breed (UKG, QGenda, Allocate) in mature markets; **native basic rostering + acuity staffing** for emerging | Complex labor rules; native acuity data is our advantage |
| Bed management, EVS, transport, transfer center, OR scheduling, OPD queues | **Build native** | Real-time state machines must live next to ADT |
| Command center | **Build native data layer + configurable tile UI**; open APIs for predictive vendors (LeanTaaS, Qventus) | Data substrate matters more than UI [K] |
| RTLS | **Integrate** (consume location events) | Hardware ecosystem |
| Cost accounting (TDABC/PLICS) | **Phase 2 native**, with event time-stamp/resource capture from day 1 | Data foundation first |
| Analytics/MIS | **Native operational dashboards** + export to lakehouse; DHIS2/ADX connectors | Statutory reporting is a sales requirement in LMICs |

**Cross-report note (reconciled 2026-10-16): ERP scope.** This table is the pack's canonical native-vs-integrate position.
- `01` §12.2 #4/§12.5 #2 previously listed Finance/GL, HR/payroll, rostering, assets and procurement all as native modules of "a single transactional data model".
- `02` §9 previously integrated all general ERP, including assets.
- Both have been edited to match this split:
  - **Native:** patient ledger, clinical supply chain and point-of-use, pharmacy stores, CMMS, acuity data and basic rostering, plus lite procurement and lite GL/AP/AR for emerging-market tenants.
  - **Integrate:** payroll/HCM, enterprise GL and full procure-to-pay where the customer already runs an ERP.
- The differentiator is "a clinical-operational ERP natively joined to clinical events", not a full ERP.
- `11` §12 models the item master, stock and requisitions as internal ERP aggregates, consistent with this.

### 9.2 Multi-country architecture: top rules

1. **Effective-dated, versioned "country packs"** (code systems, groupers, claim adapters, edits, tax, statutory reports) on one codebase. No country forks.
2. **FHIR financial API layer, limited to resources that stay in R6 core** (`Account`, `Claim`, `ClaimResponse`, `Coverage`, `CoverageEligibilityRequest/Response`, `ExplanationOfBenefit`, `PaymentNotice`, `PaymentReconciliation`) [60][78], plus the national IGs: NPHIES, NHCX, Da Vinci PAS, and X12 in the US. This already matches NPHIES, NHCX, and Da Vinci PAS [5][44], so new FHIR-based national platforms become profile mappings rather than projects. *(Reconciled 2026-10-16: this was a "FHIR-native" layer that included `ChargeItem`, `ChargeItemDefinition` and `Invoice`. Those move out of R6 core. The charge master, tariffs, packages, charges, invoices, ledger and inventory are internal aggregates, projected to R4 `ChargeItem`/`Invoice` or the R6 incubator equivalents only when a partner or IG requires it; see `11` §11 and `06` §3.2.1.)*
3. **Rules and tariff engines with simulation** to model contract or tariff changes before go-live.
4. **Classification abstraction:** support dual coding (ICD-10-xx + ICD-11) and map at the abstract level. Never store "the" diagnosis code in a single column [53][55].
5. **Multi-entity, multi-currency, multi-tax ledger** from day 1 (GCC groups, Indian chains, African networks span countries).
6. **Resilience:** multiple clearinghouse/channel routes, offline queueing for national platforms, idempotent submissions, and full message archives (regulatory audit).

### 9.3 MVP finance scope by market maturity

**Emerging / self-pay-heavy markets** (India, East and West Africa, SE Asia, GCC private secondary hospitals). MVP in about 12 months of build. *(Reconciled 2026-10-16: this is build time only. Implementing it at a 100–300-bed hospital takes another ~12–18 months (`10` §4.2/§4.12), so a first design-partner go-live is realistically around M18–24 or later. The date should come from the critical-path plan in the proposed business-plan report (12).)*
1. Registration with national ID; payer/sponsor selection (self-pay, corporate, insurer/TPA, government scheme).
2. Tariff engine (multiple price lists, room categories, packages), deposits/advances, interim bills, discounts with approval workflows, refunds, cashier shift closing, multi-mode payments (cash/card/UPI/mobile money).
3. Insurance/TPA pre-auth and claims workflow with document attachments. National adapters for the first target country: **NPHIES** (KSA), **NHCX + PM-JAY TMS workflows** (India), **SHA** (Kenya), **eClaimLink/Shafafiya** (UAE).
4. Pharmacy and general stores (item master, batches/expiry FEFO, GRN, indents, ward stock, consumption-to-charge), basic purchasing (PR→PO→GRN), vendor payables.
5. Lightweight GL with automatic journals, tax/e-invoicing (GST/VAT/ZATCA), and an export to Tally/Odoo/Dynamics/SAP B1.
6. OPD queue management, bed board with EVS status, discharge clearance (non-blocking for clinical discharge).
7. MIS: daily revenue/collections, payer mix, occupancy/ALOS, scheme receivables aging, DHIS2/HMIS monthly returns.

**Mature insured markets** (US, Germany, Australia, UK private, GCC tertiary). MVP + 12–24 months:
1. Everything above, plus coding workbench, CDI, grouper SPI with certified groupers, full claim lifecycle (837/835 or §301 or HRG/SUS+), denials and underpayment management, contract modelling, SBO.
2. US-specific: Da Vinci CRD/DTR/PAS by 2027 payer go-lives [1][5], price transparency MRF with 835-derived percentiles [8], GFE, 501(r) workflows.
3. ERP integration (Workday/Oracle/SAP/Infor) instead of native GL. Supply chain point-of-use + UDI + consignment; HTM CMMS.
4. Capacity/command center data layer, OR block management, predictive discharge.
5. Costing data capture; PLICS/InEK/NHCDC exports as country packs.

### 9.4 Sequencing recommendation

1. **Phase 0 (architecture):** canonical financial model (§7), append-only ledger, effective-dating framework, rules/tariff engine, FHIR financial API, country-pack mechanism.
2. **Phase 1:** emerging-market MVP for **one GCC country (KSA via NPHIES) + India**. Both have FHIR-based national exchanges, large private hospital markets, and self-pay + insurance mixes that exercise the full engine [44].
3. **Phase 2:** grouper SPI + DRG workflows (AR-DRG for KSA shadow billing → Australia; IR-DRG for UAE), ERP connectors, supply chain/UDI, command center.
4. **Phase 3:** US RCM (highest complexity, highest value; enter via ambulatory/specialty or partner clearinghouse) and Germany (§301 + KHVVG service groups ahead of the 2028 Vorhaltevergütung) [22][27].

*Cross-report note (reconciled 2026-10-16): market roadmap.* The pack now uses one roadmap (`06` §8):
- **Wave 1:** India + KSA, as Phase 1 above.
- **Wave 1b:** UAE. The eClaimLink/Shafafiya claim adapters come with UAE entry; IR-DRG grouping stays with the Phase 2 grouper work.
- **Wave 2:** one of Indonesia, Kenya or another SE Asian market. DACH enters only through a partner, so Germany's Phase 3 work here assumes a partner.
- **US:** a Phase 3 go/no-go.

---

## 10. Sources

**United States: regulation, standards, and RCM data**
1. CMS — CMS Interoperability and Prior Authorization Final Rule (CMS-0057-F) page (last modified 10/08/2026). https://www.cms.gov/priorities/burden-reduction/overview/interoperability/policies-regulations/cms-interoperability-prior-authorization-final-rule-cms-0057-f
2. Nirmitee — "CMS-0057-F Explained: Requirements and 2027 API…" (status as of Sept 2026). https://nirmitee.io/blog/cms-0057-f-explained-prior-authorization-rule-2027/
3. PilotFish — CMS-0057-F Compliance Fact Sheet. https://healthcare.pilotfishtechnology.com/cms-0057-f-compliance-fact-sheet/
4. MCG — Key Changes in the CMS Final Rule on Prior Authorization. https://www.mcg.com/blog/cms-final-rule-prior-authorization-interoperability/
5. HL7 — Da Vinci Prior Authorization Support (PAS) FHIR IG (current v2.2.1; STU 2.1). https://hl7.org/fhir/us/davinci-pas/
6. HL7 — Da Vinci Documentation Templates and Rules (DTR) IG STU 2.1. https://hl7.org/fhir/us/davinci-dtr/STU2.1/
7. WEDI — CMS-0057-F HL7 Da Vinci implementation guide versions. https://www.wedi.org/assets/pdf/CMS0057F+HL7+Da+Vinci+2/
8. CMS — Fact sheet: CY 2026 OPPS/ASC Final Rule — Hospital Price Transparency Policy Changes (21 Nov 2025). https://www.cms.gov/newsroom/fact-sheets/cy-2026-opps-ambulatory-surgical-center-final-rule-hospital-price-transparency-policy-changes
9. CMS MLN — Hospital Price Transparency (MLN7215754). https://cms.gov/files/document/mln7215754-hospital-price-transparency.pdf
10. McDermott+ — No Surprises Act implementation in 2026: the regulatory to-do list. https://www.mcdermottplus.com/blog/regs-eggs/no-surprises-act-implementation-in-2026-the-regulatory-to-do-list/
11. HFMA — Congress pressures CMS to implement No Surprises Act requirements (GFE/AEOB). https://www.hfma.org/fast-finance/cms-plans-gfe-aebo-rules/
12. HFMA — MAP Keys (29 revenue cycle KPIs and definitions). https://www.hfma.org/data-and-insights/map/map-keys/
13. HFMA-hosted PwC deck — Revenue Cycle Management and Revenue Calculations. https://www.hfma.org/wp-content/uploads/2023/07/Revenue-Cycle-Management-2021-mari.pdf
14. TechTarget RevCycle — "Hospitals lost over $48B from claims denials, uncollected bills" (Kodiak data). https://www.techtarget.com/revcyclemanagement/news/366641065/Hospitals-lost-over-48B-from-claims-denials-uncollected-bills
15. Kodiak Solutions — March 2026 Benchmarking Intelligence Report (page returned 403 on direct fetch; figures via [14] and search abstracts). https://www.kodiaksolutions.io/internal/benchmarking_reports/march_2026_benchmarking_intelligence_report
16. Federal Register — FY 2026 IPPS/LTCH PPS Final Rule (CMS-1833-F), 4 Aug 2025. https://www.federalregister.gov/documents/2025/08/04/2025-14681/medicare-program-hospital-inpatient-prospective-payment-systems-for-acute-care-hospitals-ipps-and
17. CMS — ICD-10 MS-DRGs Version 43.1 effective April 1, 2026. https://www.cms.gov/files/document/icd-10-ms-drg-v43-1-effective-april-1-2026.pdf
18. CMS — Manual System transmittal R13398OTN (MS-DRG v43 grouper). https://www.cms.gov/files/document/r13398otn.pdf
19. Wisconsin Hospital Association — Medicare IPPS Final Rule Payment Brief FFY 2026. https://www.wha.org/getmedia/457a9776-1753-4334-b680-d8bbbd0f4e8f/Inpatient-PPS-Rule-Brief-FFY-2026-Final-Rule.pdf
20. Medversify — "AI in Medical Billing, Honestly: What Autonomous Coding Actually Does in 2026". https://medversify.com/blog/ai-medical-billing-autonomous-coding-2026/
21. CombineHealth — "6 Key Trends in Medical Coding for 2026" (CPT 2026 changes, ICD-10-CM FY2026, AMA Appendix S, R1–Phare). https://www.combinehealth.ai/blog/medical-coding-trends

**Germany**

22. Deutscher Bundestag — Drucksache 21/2512 (KHAG government bill, 3 Nov 2025). https://dserver.bundestag.de/btd/21/025/2102512.pdf
23. AOK — Gesetz zur Anpassung der Krankenhausreform (KHAG). https://www.aok.de/pp/reform/gesetz-zur-anpassung-der-krankenhausreform/
24. GÖRG — Das Krankenhausreformanpassungsgesetz (KHAG) (1 Apr 2026). https://www.goerg.de/de/aktuelles/veroeffentlichungen/01-04-2026/das-krankenhausreformanpassungsgesetz-khag-die-reform-der-krankenhausreform
25. Rödl & Partner — Vom Fall zur Struktur: neue Vorhaltevergütung. https://www.roedl.com/insights/bezahlung-krankenhaeuser-neue-vorhalteverguetung/
26. InEK — aG-DRG-System 2026. https://www.g-drg.de/ag-drg-system-2026
27. GKV-Datenaustausch — Datenübermittlung nach §301 Abs. 3 SGB V, Gesamtdokument (01.11.2025). https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/krankenhaeuser/gesamtdokument/_301_Gesamtdokument_01.11.2025.pdf
28. DKG — Datenübermittlung nach §301 Abs. 3 SGB V (updates 2025–2026). https://www.dkgev.de/themen/digitalisierung-daten/elektronische-datenuebermittlung/datenuebermittlung-zu-abrechnungszwecken/datenuebermittlung-nach-301-abs-3-sgb-v/
29. GKV-Spitzenverband — Hybrid-DRG (§115f SGB V). https://www.gkv-spitzenverband.de/krankenversicherung/ambulant_stationaere_versorgung/hybrid_drg_115f/hybrid_drg.jsp
30. KBV — Hybrid-DRG für 2026 stehen fest. https://www.kbv.de/praxis/tools-und-services/praxisnachrichten/2025/11-13/hybrid-drg-fuer-2026-stehen-fest-das-sind-die-neuerungen
31. InEK — FAQ Pflegebudget (Vereinbarungsjahre ab 2025). https://www.g-drg.de/pflegebudget-ab-2025/faq-pflegebudget-vereinbarungsjahre-ab-2025

**France**

32. ATIH — Notice technique PMSI 2026 (ATIH-294-9-2025, 21 Nov 2025). https://atih.sante.fr/sites/default/files/public/content/5109/notice_technique_pmsi_2026_vdef_0.pdf
33. ATIH — Notice technique financement 2026 (ATIH-34-1-2026, 18 Feb 2026). https://www.atih.sante.fr/sites/default/files/public/content/5155/notice_technique_complementaire_financement_2026.pdf
34. Sécurité sociale — PLFSS 2026, Annexe 6. https://www.securite-sociale.fr/files/live/sites/SSFR/files/medias/PLFSS/2026/PLFSS2026-Annexe6-2025-10-13_avec%20couverture.pdf
35. DGOS — Campagne 2026 de financement (Club DIM presentation, 6 Feb 2026). https://www.fhpmco.fr/wp-content/uploads/2026/02/PPT-DGOS-Club-DIM-06-02-2026.pdf
36. Public Sénat — Le Sénat reporte à 2028 la réforme du financement des hôpitaux. https://www.publicsenat.fr/actualites/parlementaire/475888

**United Kingdom**

37. NHS England — 2026/27 NHS Payment Scheme, Annex B: Guidance on currencies. https://www.england.nhs.uk/wp-content/uploads/2026/03/26-27NHSPS-Annex-B-Guidance-on-currencies.pdf
38. NHS England — 2026/27 NHS Payment Scheme, Annex D: Prices and cost adjustments. https://www.england.nhs.uk/wp-content/uploads/2026/03/26-27NHSPS-Annex-D-Prices-and-cost-adjustments.pdf
39. NHS England — NHS provider payment mechanisms (2026/27 consultation supporting document). https://www.england.nhs.uk/wp-content/uploads/2025/11/26-27-NHSPS-CnSD-NHS-provider-payment-mechanisms.pdf
40. HFMA (UK) — Navigating 2026/27: What every NHS income team needs to know (Mar 2026). https://www.hfma.org.uk/system/files/2026-03/Navigating%202026.27%20-%20What%20every%20NHS%20income%20team%20needs%20to%20know.pdf

**Australia**

41. IHACPA — National Efficient Price Determination 2026–27. https://www.ihacpa.gov.au/resources/national-efficient-price-determination-2026-27
42. IHACPA — AR-DRG Version 12.0. https://www.ihacpa.gov.au/resources/ar-drg-version-120
43. IHACPA — National Pricing Model Technical Specifications 2026–27. https://www.ihacpa.gov.au/sites/default/files/2026-03/National_Pricing_Model_Technical_Specifications_2026-27.PDF

**Middle East**

44. NPHIES — Healthcare Financial Services Implementation Guide (introduction; FHIR R4; transaction volumes). https://portal.nphies.sa/ig/introduction.html
45. Council of Health Insurance (CHI) — NPHIES / FAQ. https://www.chi.gov.sa/en/Uniplat/pages/default3.aspx
46. CHI — Design of local framework: local shadow billing implementation (DRG). https://www.chi.gov.sa/en/Rules/MedicalStandards/Experimental_Billing_Application_Using_Diagnostic_Packages.pdf
47. PCSI 2024 — Implementation of AR-DRG reimbursement for public providers in Saudi Arabia's mandatory private health insurance scheme. https://pcsinternational.org/conference/PCSI2024/assets/PCSI2024_Abstract_75.html
48. Argaam/Al Rajhi Capital — Saudi Arabia Healthcare Sector report (23 Jun 2026). https://argaamplus.s3.amazonaws.com/efab2513-3051-47f5-a1ec-40c6b276c6a1.pdf
49. Department of Health Abu Dhabi — Shafafiya. https://www.doh.gov.ae/en/Shafafiya
50. Dubai Health Authority — eClaimLink. https://www.eclaimlink.ae/

**Africa and Latin America**

51. Social Health Authority (Kenya) — official site (funds, portals, payment reports, notices). https://www.sha.go.ke/
52. ANS (Brazil) — Padrão TISS (current version Sept/2026). https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss

**Classifications (ICD-11)**

53. WHO — ICD-11 Implementation FAQ. https://www.who.int/standards/classifications/frequently-asked-questions/icd-11-implementation
54. WHO — WHO releases 2025 update to ICD-11 (14 Feb 2025). https://www.who.int/news/item/14-02-2025-who-releases-2025-update-to-the-international-classification-of-diseases-(icd-11)
55. Boussat B, Jakob R, Boyer L, Romano PS. Strategic pathways to ICD-11 adoption in France and the United States. *Health Affairs Scholar* 2025;3(7):qxaf099. https://pmc.ncbi.nlm.nih.gov/articles/PMC12208713/
56. IFHIMA — ICD-11 (status July 2025). https://ifhima.org/publication-resources/articles/icd-11/

**Costing, operations vendors, standards**

57. Kaplan RS, Porter ME. How to Solve the Cost Crisis in Health Care. *Harvard Business Review*, Sept 2011. https://hbr.org/2011/09/how-to-solve-the-cost-crisis-in-health-care
58. LeanTaaS — iQueue product claims (vendor-stated). https://www.leantaas.com/
59. Qventus — product and outcome claims (vendor-stated). https://www.qventus.com/
60. HL7 FHIR R4 — Financial Module (Coverage, Claim, ClaimResponse, EOB, Account, ChargeItem, Invoice, PaymentReconciliation). https://hl7.org/fhir/R4/financial-module.html
61. X12 — HIPAA transaction standards (270/271, 276/277, 278, 835, 837). https://x12.org/
62. DHIS2 — District Health Information Software 2. https://dhis2.org/
63. GS1 Healthcare — identification and UDI standards. https://www.gs1.org/industries/healthcare

**Added in verification pass 2 (2026-10-16)**

64. TechTarget RevCycle — "Insurers deny less just to claw back more later: analysis" (23 Sep 2026; Kodiak H1 2026 data from about 2,400 hospitals and 375,000 physicians). https://www.techtarget.com/revcyclemanagement/news/366651012/Insurers-deny-less-just-to-claw-back-more-later-analysis
65. Premier Inc. — "Trend Alert: Private Payers Retain Profits by Refusing or Delaying Legitimate Medical Claims" (21 Mar 2024; 2022 claims). https://premierinc.com/newsroom/blog/trend-alert-private-payers-retain-profits-by-refusing-or-delaying-legitimate-medical-claims
66. CMS — FY 2027 IPPS/LTCH PPS Final Rule home page (CMS-1849-F; display 31 Jul 2026, FR publication 4 Aug 2026). https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/fy-2027-ipps-final-rule-home-page
67. reimbursement.institute — "Hybrid-DRG Leistungen 2026: das sind die neuen OPS Codes" (on the 28 Apr 2025 decision: 106 newly selected services). https://reimbursement.institute/blog/hybrid-drg-leistungskatalog-2026-das-sind-die-ops-codes/
68. Waystar — "Waystar Closes Acquisition of Iodine Software" (1 Oct 2025). https://www.waystar.com/news/waystar-closes-acquisition-of-iodine-software-extending-ai-leadership-in-healthcare-software/
69. WUSF Public Media — "Tampa General Opens Command Center To Improve Patient Experience, Outcomes" (21 Aug 2019). https://www.wusf.org/2019-08-21/tampa-general-opens-command-center-to-improve-patient-experience-outcomes
70. R1 — press release "R1 to Acquire Phare Health…" (14 Oct 2025), via Yahoo Finance. https://finance.yahoo.com/news/r1-acquire-phare-health-leading-120000130.html. The deal closed later in Oct 2025 per MarketScreener deal notices; the exact closing day (21 or 22 Oct) differs between notices.
71. CMS Innovation Center — WISeR (Wasteful and Inappropriate Service Reduction) Model. https://www.cms.gov/priorities/innovation/innovation-models/wiser
72. Franklin BJ, Mueller SK, Bates DW, Gandhi TK, Morris CA, Goralnick E. Use of Hospital Capacity Command Centers to Improve Patient Flow and Safety: A Scoping Review. *J Patient Saf* 2022;18(6):e912–e921 (PMID 35435429). Also Franklin BJ et al., Hospital Capacity Command Centers: A Benchmarking Survey. *Jt Comm J Qual Patient Saf* 2023;49(4):189–198 (PMID 36781349). Abstracts retrieved via Europe PMC.
73. Bagust A, Place M, Posnett JW. Dynamics of bed use in accommodating emergency admissions: stochastic simulation model. *BMJ* 1999;319(7203):155–158 (PMID 10406748). Abstract retrieved via Europe PMC.
74. WHO — ICD-11 for Mortality and Morbidity Statistics browser, release 2026-01. https://icd.who.int/browse/2026-01/mms/en
75. IHACPA — "IHACPA releases the 2026–27 national efficient price and national efficient cost determinations" (11 Mar 2026) and NEP Determination 2026–27 PDF. https://www.ihacpa.gov.au/news/ihacpa-releases-2026-27-national-efficient-price-and-national-efficient-cost-determinations-public-hospitals ; https://www.ihacpa.gov.au/sites/default/files/2026-03/national_efficient_price_determination_2026-27_2.pdf. The IHACPA site timed out on direct fetch; figures come from IHACPA-domain search results.
76. Dubai Health Authority (ISAHD) — External Circular GC 05/2021 (23 May 2021): 3M IR-DRG v3.01 fixes and IR-DRG v3.3 Codefinder/Grouper roll-out. https://www.isahd.ae/content/docs/GC%2005-2021.pdf
77. PSU Watch — "IRDAI directs health insurers to decide on cashless authorisation in 1 hour" (29 May 2024). https://psuwatch.com/newsupdates/irdai-directs-health-insurers-to-decide-on-cashless-authorisation-in-1-hour. This is secondary; the primary IRDAI circular was not fetched.
78. HL7 FHIR R6 Ballot (2nd Full Ballot), 6.0.0-ballot5, ballot notes. ChargeItem, ChargeItemDefinition, Invoice, Contract, InsurancePlan, InventoryItem, InventoryReport, SupplyRequest and SupplyDelivery move to incubator IGs. Fetched 2026-10-16 during reconciliation. https://hl7.org/fhir/6.0.0-ballot5/ballot-intro.html
79. HL7 FHIR R5 resource list with maturity levels (InventoryItem 0, InventoryReport 0, ChargeItem 1, ChargeItemDefinition 1, Invoice 0, Contract 1, InsurancePlan 0, SupplyRequest 1, SupplyDelivery 1). Fetched 2026-10-16. https://hl7.org/fhir/R5/resourcelist.html
80. Companion reports used in the 2026-10-16 reconciliation: `01` §12.2/§12.5, `02` §9, `03` §2, `06` §3.2.1 and §8, `10` §4.2/§4.12, `11` §11–12; see `RECONCILIATION-LOG.md`.

**Not URL-verified this session (cited as [K]; verify before use):** Franklin and Bagust are now verified as [72] and [73], and the IRDAI circular is verified via secondary source [77]. NHA PM-JAY and NHCX documentation (nha.gov.in / abdm.gov.in returned 403/connection refused). Joint Commission EC/MS/LD standards. CMS S&C 14-07 (AEM). California Title 22 nurse ratios. Oregon HB 2697. Scotland Health and Care (Staffing) Act 2019. EU Working Time Directive 2003/88/EC.

---

*Method note:* Research ran on 2026-10-16 with about 24 web searches and 20 primary-source fetch attempts. Several official sites (NHA India, BMJ, GS1, Hopkins, InEK direct) blocked automated fetching. A shared search quota cut off further searching, which especially affected UAE DRG versions, Qatar, Indonesia iDRG, Philippines DRG, Nigeria, and command-center outcome literature. Those items are marked `[K]` and should be the first targets for a follow-up verification pass.

*Pass-2 note (2026-10-16):* This pass used 8 web searches and about 35 fetches of primary or official pages: CMS, HL7, IHACPA via search, AOK/KBV/DKG, NHS England PDFs, the NPHIES IG, CHI/PCSI, DOH Abu Dhabi, the DHA circular, the SHA Kenya site, ANS, WHO, and Europe PMC. Some sites still blocked fetching or timed out: IHACPA, GKV-Spitzenverband, PMC, Kodiak, NHS England planning pages, and Vizient. Items that depend on them are flagged in the log below.

---

## Verification log (pass 2, 2026-10-16)

| Claim | Verdict | Source | Note |
|---|---|---|---|
| CMS-0057-F released 17 Jan 2024; X12 278 enforcement discretion from 28 Feb 2024; payer APIs due 1 Jan 2027; no delay announced | Confirmed | [1] (page modified 8 Oct 2026); [2] | [2] says no deadline had moved as of 25 Sep 2026 |
| "CMS-0062-P would extend decision timeframes to QHPs (proposed Oct 2027)" | Corrected | [2] | CMS-0062-P (proposed 14 Apr 2026) covers **drug** prior auth from 1 Oct 2027 with 24 h/72 h drug decision times. QHP extension is not in the source |
| MIPS electronic prior auth from PY2027 | Corrected (nuanced) | [2] | Measure starts CY2027. For hospitals it is optional (bonus) in 2027 and required from 2028; clinician changes are in the CY2027 PFS proposed rule. [2] is a vendor explainer, so confirm in the Federal Register |
| CY2026 price transparency: median/10th/90th percentile allowed amounts + count from 835 data; 12–15-month lookback; effective 1 Jan 2026, enforced from 1 Apr 2026; CEO/senior-official name; Type 2 NPIs (taxonomy 28/27); 35% CMP reduction | Confirmed | [8] (CMS fact sheet, 21 Nov 2025) | All details match |
| Da Vinci PAS current version v2.2.1 (STU 2) | Confirmed | [5] | HL7 page shows no publication date |
| CMS-0057-F recommended IG versions CRD/DTR/PAS STU 2.0.x / 2.1.0 | Confirmed | [7] (WEDI PDF) | PAS 2.1.0/2.0.1; DTR 2.1.0/2.0.0; CRD 2.1.0/2.0.1 |
| Kodiak 2025: initial denial rate 11.6% (from 11.4%); median final 2.7%; clinical 2.6%; >$48B lost | Confirmed | [14] | Exact loss is $48.4B (up 25% from $38.6B) |
| Kodiak H1 2026 initial denial rate 10.63% | Confirmed | [64] | H1 2025 was 12.00% |
| "Recoupments 1.57% of net revenue" (H1 2026) | Corrected | [64] + Kodiak release (via search) | Takebacks were 1.57% vs 1.38%. The press release states the base as accounts receivable |
| Premier survey: about 15% initial denials | Confirmed (clarified) | [65] | Applies to claims to **private payers**, 2022 data; 54.3% overturned; $19.7B/yr adjudication cost |
| "Hospital spend on overturning denials 2025 ≈ $18B (AHA estimate)" | Corrected / still unverified | [65]; secondary search results | Attribution changed to a 2025 Premier follow-up (2023 claims). The $18B figure is not confirmed on a Premier primary page |
| FY2026 MS-DRG "772 total (770 payable)" | Corrected | [19] (WHA brief) | 770 payable finalized; 772 had been **proposed**; FY2025 had 771 |
| MS-DRG v43.1 adds 80 ICD-10-PCS codes from 1 Apr 2026 | Confirmed | [17] | |
| FY2027 grouper (v44) applies from 1 Oct 2026 | Confirmed (rule); version label by convention | [66] | FY2027 IPPS final rule CMS-1849-F, displayed 31 Jul 2026. Home page does not print "v44" |
| ICD-10-CM FY2026 +487 codes; CPT 2026 418 changes | Confirmed (secondary) | [21] | 288 new / 84 deleted / 46 revised (CPT); 38 revised / 28 deleted (ICD-10-CM) |
| CMS WISeR model, AI-assisted prior auth in Original Medicare from 2026 | Confirmed | [71] | 1 Jan 2026 – 31 Dec 2031; AZ, NJ, OH, OK, TX, WA; not MA |
| R1 "agreed in Oct 2025 to acquire Phare Health" | Corrected (updated) | [70] | Announced 14 Oct 2025; closed later in Oct 2025 |
| Waystar announced Iodine acquisition in 2025 | Confirmed (updated) | [68] | Closed 1 Oct 2025; announced Jul 2025 at $1.25B EV |
| KHAG passed 2026; Vorhaltevergütung from 1 Jan 2028; 2026–27 budget-neutral; convergence 2028–29; full effect 2030 | Confirmed | [23] (AOK) | KHAG in force 6 Mar 2026; states report Leistungsgruppen decisions to InEK by 30 Sep each year |
| Hybrid-DRG: "106 new procedures added from 2026" | Corrected | [30] (KBV), [67] | 2026 catalogue: 69 Hybrid-DRGs, 904 OPS codes (2025: 583). "106" refers to the 28 Apr 2025 selection decision |
| Emergency-care reform would repeal §115f from 2028 | Still unverified (doubtful) | [23]; search results | KHAG keeps catalogue deadlines running, and the 2027 catalogue agreement was signed 31 Mar 2026 |
| §301 code update effective 16 Oct 2026; supplement effective 1 Oct 2026 / 1 Jan 2027 | Confirmed | [28] (DKG) | Schlüsselfortschreibung of 9 Oct 2026; Nachtrag of 24 Sep 2026 |
| NHSPS 2026/27: API variable element "at 50% for elective activity"; API applies to contracts >£1.5m | Corrected | [39] | Elective activity is paid at **100%** of unit price. UEC blended variable rate is 20%, radiotherapy 50%. LVA block applies at ≤£1.5m. Based on the consultation document, so check the final Annex |
| NHSPS prices built from 2018/19 PLICS + HES | Confirmed | [38] (Annex D) | Prices rolled over since 2022/23; stroke/pneumonia NEL reset on 2023/24 data |
| AR-DRG v12.0 prices admitted acute care from 1 Jul 2026, no shadow pricing; NEP Determination published 11 Mar 2026 | Confirmed | [75] | NEP26 = A$7,418 per NWAU(26). IHACPA site timed out; confirmed via IHACPA-domain search results |
| NPHIES: FHIR R4; does not adjudicate; 143M (2023) / 292M (2024) / 96M (Q1 2025) transactions; 6,419+ facilities, 25 insurers, 60+ vendors | Confirmed | [44] | |
| Saudi AR-DRG mandated in 2021 for public hospitals billing private insurers; v9 grouping | Confirmed | [47] | |
| Abu Dhabi Shafafiya: XML Post Office, no DOH upload UI, Encounter/Episode/Claim/Activity/Observation | Confirmed | [49] | Inpatient claims carry a single DRG-type activity; IR-DRG version not stated |
| Dubai inpatient DRG uses IR-DRG | Confirmed | [76] | 3M IR-DRG v3.01 / v3.3 grouper per May 2021 circular; current (2026) version not found |
| IRDAI Master Circular (29 May 2024): cashless decision ≤1 h, discharge authorization ≤3 h | Confirmed (secondary) | [77] | Primary IRDAI PDF not fetched; reference number differs across sources |
| Kenya SHA runs three funds (PHF, SHIF, ECCIF) | Corrected | [51] | SHA also runs a Public Officers Medical Scheme Fund (POMSF). Legacy NHIF pending-claims notice of 28 Sep 2026 confirmed |
| Brazil TISS current version Sept/2026; mandatory | Confirmed | [52] | Page updated 30 Sep 2026; mandatory-from date not stated |
| ICD-11: 132 engaged / 72 started / 50 piloting / 14 reporting; China, Iran, Kuwait, Malaysia, UNRWA most advanced; France pilot of 10 hospitals and about 10,000 stays from 2025 | Confirmed | [55] (full text via Europe PMC); [56] | The "May 2024" date for the counts is still unverified. The US "~2030" is the authors' goal, not a federal plan |
| WHO: ICD-10 maintenance stopped 2018; ICD-11 in effect 1 Jan 2022; ICD-11/ICHI-based DRG "under development" | Confirmed | [53] | |
| WHO 2026 ICD-11 release | Confirmed | [74] | Browser shows MMS release 2026-01 |
| Tampa General CareComm opened 2020 | Corrected | [69] | Permanent center opened Aug 2019 (temporary Dec 2018); "fourth in the world" |
| Humber River command centre opened 2017; Bradford 2019 | Still unverified (Humber consistent with search results) | search results only | No primary Bradford source fetched |
| Franklin et al. scoping review (J Patient Saf 2022): evidence limited/heterogeneous | Confirmed | [72] | 8 articles (4 peer-reviewed), 7 command centers, literature through Apr 2019 |
| Bagust et al. BMJ 1999: risk rises above ~85% occupancy | Confirmed | [73] | Crises expected at ≥90% |
| England 4-hour interim target 78% for March 2026 | Still unverified | n/a | NHS England planning guidance page did not render; retained as [K] |
| Kaufman Hall (Axiom) acquired by Vizient in 2024 | Still unverified | n/a | Vizient press-release URL returned 404; retained as [K] |
