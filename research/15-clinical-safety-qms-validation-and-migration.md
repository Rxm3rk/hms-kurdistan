# 15 — Clinical Safety Case, QMS and Regulatory Classification, Verification and Validation, and Legacy-HIS Data Migration and Cutover

*Research pack gap-filler, 16 October 2026. Builds on 03 (clinical modules), 04 (diagnostics, pharmacy, devices), 06 (interoperability), 07 (security and regulation), 08 (architecture), 09 (AI), 10 (implementation) and 11 (domain model). Cross-references use the form "07 §2.2".*

**Evidence tags.**
- **[V]**: verified this session against a primary or official source.
- **[S]**: secondary source (law firm, trade press, consultancy, vendor blog) or a search-index snippet whose primary page could not be fetched.
- **[K]**: background knowledge, not verified this session.
- **[E]**: my estimate.
- **[I]**: my inference or opinion.
- **[U]**: unresolved or uncertain; verify before relying on it.

**Method.** I used 12 web searches (the full budget) and about 35 direct fetches. Six regulator PDFs were text-extracted locally: FDA CDS 2026, MDCG 2019-11 rev.1, the MHRA software guidance v1.10g, SFDA MDS-G008 and MDS-G027, HSA GL-07 R2, the EC 20th notified-body survey, the Cambio MDR certificate and the Joint Commission RUAIH guidance. Several pages returned 403 or empty: NHS England Digital DCB pages, the ABDM sandbox, Joint Commission certification pages and CDSCO. Claims that depend on those pages carry [S] or [K].

---

## 1. Executive summary

1. **NEWS2 is a regulated function in most launch markets. It is not ordinary "CDS content."** MDCG 2019-11 rev.1 gives a near-exact NEWS2 analogue as a worked example: a risk score from respiratory rate, heart rate, blood pressure and SpO₂ "to trigger care processes", qualified as medical device software [5] [V]. SFDA's 2025 digital-health guidance names "a CDSS that monitors patient data in real time and generates alerts for abnormal conditions" as a medical device [15] [V]. FDA treats deterioration and sepsis alerting as a device because it is time-critical (examples 11 and 24) [1] [V]. **Ruling:** NEWS2/PEWS becomes **Regulated Module #1**, built under IEC 62304/ISO 14971 from the first commit and registered market by market. This settles the 03-vs-07 dispute (§5.1).
2. **Drug-interaction checking diverges across regulators.** FDA lists DDI and drug-allergy alerts as Non-Device CDS [1] [V]. MDCG rev.1 lists "MDSW integrated into an EHR … alerts for potential adverse drug interactions" and renal dose-adjustment flags as MDSW [5] [V]. EU entry therefore probably requires CE-marking the medication-safety engine (Class IIa). Cambio already holds IIa for both its EHR and its CDS [28] [V].
3. **Blood bank, ruled (§5.2).** Build transfusion ordering, issue tracking and haemovigilance natively. Build **bedside verification as a regulated sub-module**. **Do not build the compatibility/release engine** (ABO/Rh interpretation, electronic crossmatch) for v1 in any market. In the US it is BECS (Class II, 510(k)). In the UK and EU it is IVD software [9] [V].
4. **Pump autoprogramming, ruled (§5.3).** It is allowed only through the pump vendor's regulated gateway. Our software sends *orders*, never *commands*, and the clinician confirms at the pump. SFDA states that software that "drives a device or influences the use of a device shall fall within the same class as the device" [14] [V]. MDCG cites "remote pump activation" as a device function [5] [V]. Ship with one vendor in the first post-go-live wave, not on day one.
5. **QMS: one ISO 13485-based integrated management system covering the whole company, with risk-proportionate rigour (Tier 0/1/2).** Do not run a 13485 island for "regulated modules only." Shared platform services (rules engine, terminology, identity, audit) sit underneath every regulated module and would otherwise need SOUP qualification on every release. Cambio runs ISO 13485 alongside 27001/9001/20000/14001 [27] [V].
6. **The incumbents follow three certification models.**
   - **(A) Certify the EHR:** Cambio (BSI 2797; COSMIC EHR and Cambio CDS both Class IIa; valid 2024-08-13 to 2029-08-12) [28] and InterSystems ("Class IIa MDR certification") [26] [V].
   - **(B) Non-device plus clinical safety case:** Better lists ISO 9001/27001/20000/14001 and Cyber Essentials Plus, plus a DCB0129 assurance mark, and makes no CE claim [29][30] [V]. Epic and Oracle publish no MDR position that I could find [U].
   - **(C) Separately regulated modules:** our plan (08 §10). Use (C), and keep the QMS capable of (A) for the EU.
7. **Notified-body capacity is a 13–18-month problem.** The EC's 20th survey (data to 28 Feb 2026) shows 62% of NBs take 13–18 months from written agreement to a new MDR QMS certificate. For QMS-plus-product, 51% take 13–18 months and 31% take 19–24 months. That is on top of application preparation [6] [V]. Starting the QMS in month 0 is the only way to have a CE IIa module by month 24–30.
8. **IEC 62304 Edition 2 will not arrive before about 2028.** The IEC's forecast publication date is 26 Oct 2028, and only CD2 exists. The draft replaces classes A/B/C with process-rigour Levels I/II [24] [S]. Build to 62304:2006+A1:2015 now, using a structure that maps cleanly to the Level I/II split.
9. **UK DCB0129/0160 is under formal review.** NHS England's consultation ran 29 Jun–11 Sep 2026. It asks whether the standards should apply to medical devices, whether alternative standards should be adopted, and whether cybersecurity should be added. The current texts (DCB0129 v4.2, DCB0160 v3.2) remain in force [11][12] [S]. **Use DCB0129 as our global clinical-safety operating model regardless.** It is the only mature, auditable "safety case per release" regime for non-device health IT.
10. **AI safety events need a product-level reporting channel.** Element 5 of the Joint Commission/CHAI RUAIH guidance calls for "voluntary, blinded reporting of AI-safety related events" to PSOs, and FDA pathways if the AI is a device [31] [V]. Build AI-event capture, linked to model version and prompt provenance, into the incident system.
11. **V&V must be traceable from requirement to hazard to control to test to release evidence, and generated from the backlog.** The suites that matter:
    - a Leapfrog-category CPOE harness (03 §7.5)
    - ISMP high-alert scenarios
    - closed-loop medication and transfusion end-to-end scripts
    - property-based tests on the order/MAR/encounter state machines (11 §10)
    - HL7 v2 conformance profiles
    - national sandbox suites (06 §4)
    - a 1,000-bed-day load test (08 §14 #13)
    - quarterly DR and downtime drills
    - summative usability with 15–20 users per user group (10 §10.1 #13)
12. **Migration in India/GCC is a data-rights problem as much as a technical one.** Most Indian incumbents are SaaS or vendor-hosted. Data exit depends on the hospital's contract and its standing as DPDP data fiduciary. An unexpected lever: NABH HIS/EMR certification requires ABDM M3 (06 §4.5), so NABH-certified incumbents such as KareXpert [33] [V] already generate NRCeS FHIR R4 bundles for seven HI types. **An ABDM-bundle importer is a near-universal document-level migration channel for India** [I].
13. **Cutover is where patients get hurt. The risk is concentrated in four items:**
    - active inpatient medication orders and PRN last-given times, which carry a double-dosing hazard
    - open IP bills, deposits and packages in progress
    - pharmacy opening balances, including controlled drugs
    - ABDM care contexts already linked by the old HIP bridge, which cannot be unlinked [35] [S]

    Each needs a scripted, reconciled cutover step and an owner (§9.4).
14. **Big bang vs pilot, settled (§10.3): "Pilot the product, big-bang the hospital."**
    - **Before go-live:** model-ward simulation and production-build dress rehearsals.
    - **At go-live:** one cutover for all inpatient clinical and revenue modules at a site.
    - **No live single-unit inpatient pilots of the medication loop.** This overrides 03 §21.2's "pilot on one inpatient unit" and agrees with 10 §4.4.
    - Multi-site customers go in site or regional waves.
15. **Build list.** We must build:
    - a Regulatory Boundary Register (function × market × class)
    - a Hazard Log service wired into the backlog and CI
    - a Release Evidence Pack generator
    - a Content Simulation and Replay harness
    - a Migration Workbench (connectors, mapping studio, EMPI pre-match, reconciliation, cutover orchestrator, legacy viewer, ABDM care-context mapper)
    - Customer UAT and deployment-safety kits

    These are product features that shorten implementations (01 §12.2 #9), not internal paperwork.

---

## 2. QMS design

### 2.1 Scope decision: whole company or regulated modules only?

| Option | Description | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. 13485 island** | ISO 9001 (or nothing) for the company; ISO 13485 scoped to a "regulated modules" team | Less overhead for ERP/billing teams | Regulated modules depend on shared services: rules engine, terminology, EMPI, audit journal, UI shell, workstation printing. Under IEC 62304 those become **SOUP** and must be specified, risk-assessed and regression-verified at every platform release. Two cultures, two document systems. | Reject |
| **B. Company-wide 13485 with tiered rigour** | One integrated management system (IMS). ISO 13485 is the backbone and the certificate scope covers all health software. Procedures scale by tier. | One change-control, CAPA, supplier, training and complaint system. Platform services are developed *under* design controls, not qualified as SOUP. Supports model (A) for the EU later. Buyers see one certificate. | Overhead must be actively contained through tiering. | **Adopt** [I] |
| **C. Whole product as a device** (Cambio/InterSystems model) | CE-mark the EHR as Class IIa | Simple boundary story in the EU. Necessary if EU regulators treat EHR-embedded DDI as MDSW [5]. | Every release of every module falls under MDR change assessment, and US positioning becomes awkward | Keep available for the EU phase only |

**Tiering** [I]:
- **Tier 0: non-safety.** Reports, ERP back office, HR. Standard SDLC, ISO 27001 controls, lightweight design review.
- **Tier 1: safety-relevant, non-device.** ADT/EMPI, CPOE, eMAR/BCMA, results routing, documentation, downtime, billing that affects care (for example, pre-auth blocks). Requires:
  - a DCB0129-style hazard log, a safety case per release, a CSO sign-off
  - 62304 Class B-equivalent process
  - IEC 82304-1 product requirements
- **Tier 2: medical device software.** NEWS2/PEWS, dose engines, DDI/dose-range (EU), bedside transfusion verification, later sepsis and triage AI. Requires:
  - full ISO 13485 design controls, an ISO 14971 risk file, an IEC 62366-1 usability engineering file
  - 62304 Class B or C
  - regulatory submissions and post-market surveillance (PMS)

**Certificate scope wording** (draft) [I]: "Design, development, release, deployment support and servicing of health software, including medical device software, for hospitals and health systems." FDA's QMSR, which incorporates ISO 13485:2016 by reference, has applied since 2 Feb 2026 (07 §2.2). One QMS therefore serves FDA, MDR, SFDA (which follows IMDRF principles [16] [S]), CDSCO (which expects a QMS covering the software lifecycle [18] [S]) and HSA.

### 2.2 The standards stack and how the pieces interlock

| Standard | What it governs | Where it lives in our IMS | Notes |
|---|---|---|---|
| ISO 13485:2016 | QMS for device organisations | IMS backbone: document control, CAPA, complaints, suppliers, management review | Not on the ISO harmonised structure, so keep a crosswalk to 27001 [K] |
| IEC 62304:2006+A1:2015 | Software lifecycle; safety classes A/B/C | Engineering procedures for Tier 1 and 2 | Ed. 2 is at CD2; forecast publication 26 Oct 2028; Levels I/II replace A/B/C; former Class B moves to Level II, modelled on Class C [24][25] [S] |
| ISO 14971:2019 (+ ISO/TR 24971) | Risk management | Risk management plan per product family; hazard log as the single source | Hazard log entries serve both DCB0129 and 14971 [I] |
| IEC 62366-1:2015+A1:2020 | Usability engineering | Use specification, hazard-related use scenarios, formative and summative evaluation | For Tier 2, and for Tier 1 critical tasks (10 §10.1 #13) |
| IEC 81001-5-1:2021 | Security in the health software lifecycle | Secure SDLC procedures, threat models, SBOM, vulnerability handling | Draft 62304 Ed. 2 delegates cybersecurity to 81001-5-1 [24] [S]. FDA recognised [K]. |
| IEC 82304-1:2016 | Product safety and security for stand-alone health software | Product-level requirements, validation and accompanying documents for the whole HMS | The natural frame for Tier 1 and for EHDS EHR conformity (06 §4.3) [I] |
| ISO/IEC 27001:2022 (+27701) | ISMS (and privacy) | Shared IMS processes: internal audit, management review, supplier security | 81001-5-1 activities supply evidence for the 27001 Annex A secure-development controls [K] |
| IEC 80001-1:2021 | Risk management for hospital networks with devices | Customer-side; we supply inputs (MDS2-like disclosures) | See 07 §2.6 |
| DCB0129 v4.2 / DCB0160 v3.2 | NHS clinical risk management (manufacturer / deployer) | Operating model for Tier 1 clinical safety, globally | Under review in 2026 [11][12] [S] |

### 2.3 IEC 62304 safety class by module (current edition)

Class C applies where a failure, after external risk controls (for example independent pharmacist verification or a pump-side confirmation), could still contribute to death or serious injury. Assignments are my recommendation [I].

| Module / function | Tier | 62304 class (Ed. 2 level) | Main external risk controls that justify the class |
|---|---|---|---|
| ADT, EMPI merge/unmerge, registration | 1 | B (II) | HIM steward queue, reversible merges (11 §15 #7) |
| CPOE and order lifecycle | 1 | B (II) | Pharmacist verification, result-closure tracking |
| eMAR/BCMA | 1 | B (II) | Wristband plus product barcode, nurse judgement |
| DDI, allergy and dose-range engine | 2 (EU) / 1 (US) | B (II) | Pharmacist verification; knowledge-base vendor's own controls |
| Weight/BSA dose calculators (paediatric, chemotherapy, heparin, insulin) | 2 | **C (II)** | Double check is often absent at 03:00; 10× errors are lethal (03 §21.3 #5) |
| NEWS2/PEWS score and escalation | 2 | B (II) | Nurse observation, manual escalation backstop |
| Sepsis screening (rules) | 2 | B (II); C if autonomous orders | Clinician review |
| Bedside transfusion verification | 2 | **C (II)** | Two-person check is the only other barrier; wrong blood can kill (03 §1 #11) |
| Transfusion compatibility/release engine (deferred) | 2 (IVD) | **C (II)** | Serology QC |
| Pump autoprogramming interface | 1 or 2 by market | **C-rigour** even if non-device | Pump DERS, clinician confirmation at the pump |
| Alarm forwarding | Not built; integrate | — | Out of scope (§4.3 i) |
| AI scribe / summaries | 1 (2 if suggesting diagnoses) | B (II) | Mandatory clinician sign-off (11 §15 #11) |
| ED triage AI | 2; defer and partner | C (II) | — |
| Billing, ERP, HR, BI | 0 | n/a (A-like) | — |

### 2.4 Risk files, usability files and security files: what goes in them

- **ISO 14971 risk management file (per product family).** It holds:
  - the risk management plan with an acceptability policy, using the 5×5 severity/likelihood matrix that DCB0129 also uses [K]
  - a **top-down clinical hazard analysis** keyed to recurring harm patterns: wrong patient, wrong drug/dose/route/time, missed or late result, delayed escalation, data loss or corruption, unavailability or downtime, wrong blood, alarm not delivered, AI hallucination accepted
  - a bottom-up FMEA per module
  - a traceability matrix and residual-risk evaluation
  - a benefit-risk statement
  - production and post-production review inputs (complaints, telemetry, field incidents)

  For AI, add an AI-specific annex: data shift, automation bias, hallucination, performance degradation after update. ISO/IEC 23894 and AAMI/BSI 34971 are the reference texts [K].
- **IEC 62366-1 usability engineering file.** It holds:
  - the use specification (user groups per market and language)
  - user-interface characteristics related to safety
  - known use problems, drawn from incumbent failures (VA "unknown queue", Helseplattformen unsent letters, BCMA workarounds; 10 §5, 03 §21.3)
  - hazard-related use scenarios, formative evaluations, and the summative protocol and report
- **IEC 81001-5-1 security file.** It holds threat models (STRIDE/LINDDUN, 08 §10), SBOM, a vulnerability-handling and coordinated-disclosure process, security verification evidence, and patch timelines. That last item also feeds FDA §524B and the EU CRA (07 §2.2–2.3).

### 2.5 How the incumbents handle certification

| Vendor | Public regulatory posture (what I could verify) | Model | Lesson for us |
|---|---|---|---|
| **Cambio (COSMIC)** | BSI (NB 2797) EU QMS certificate MDR 771804, Annex IX Ch. I and III. **COSMIC EHR Class IIa; Cambio CDS Class IIa.** First issued 2024-08-13, expires 2029-08-12 [28] [V]. Also ISO 13485, 27001, 9001, 20000, 14001 [27] [V]. | A: certify the whole EHR | A full Nordic EHR can live inside MDR IIa. The NB route was Annex IX QMS with technical-documentation sampling. |
| **InterSystems (TrakCare/IntelliCare)** | "InterSystems electronic health record (EHR) solutions have achieved Class IIa Medical Device Regulation (MDR) certification." The page adds that "regulatory status may vary by offering, jurisdiction, and intended use" [26] [V]. | A | A competitor in the GCC (Mediclinic ME, Medcare; 01 §4) can show a CE IIa EHR in tenders. |
| **Better (Better Platform / Meds)** | Certifications page: ISO 9001, ISO/IEC 27001, ISO 14001, ISO/IEC 20000-1, Cyber Essentials (Plus) [29] [V]. The Better Meds page carries a "DCB0129 Assured by Safehand" logo [30] [V]. No CE or ISO 13485 claim. | B: non-device plus clinical safety case | A UK ePMA/BCMA vendor treats medication administration as non-device, with DCB0129 as its safety evidence. |
| **Epic** | No public MDR/CE position found this session [U]. ONC-certified in the US (07 §2.1). The Epic Sepsis Model was not FDA-cleared and was criticised for poor performance (03 §1 #4) [K]. | B (inferred) [I] | The largest vendor has not made device certification a selling point. Safety-by-design is still open as a differentiator. |
| **Oracle Health (Millennium)** | No public MDR/CE position found [U]. Cerner historically held an FDA 510(k) for its blood bank transfusion module [K]. | B with cleared ancillaries [K] | Even Oracle used a 510(k) for transfusion. |

### 2.6 Regulator and notified-body costs and timelines

| Item | Timeline | Cost | Evidence |
|---|---|---|---|
| Build an ISO 13485 IMS from zero to certification | 9–15 months | Registrar US$20–60k initial plus US$10–30k/yr surveillance; eQMS tooling US$20–100k/yr; 3–6 QA/RA FTE | [E]; 07 §3.3 gives US$150–500k over 18 months |
| **EU MDR Class IIa (Annex IX)** | Prepare application 6–12 months [S]; application to written agreement 1–3 months [S]; **agreement to certificate: 62% of NBs take 13–18 months and 30% take 6–12 months (QMS); for QMS+product, 51% take 13–18 and 31% take 19–24 months** [6] [V] | NB fees €50–150k initial (07 §3.3) plus about €20–50k/yr surveillance and technical-documentation sampling [E] | EC 20th NB survey: 53 NBs, 32,898 MDR applications and 18,010 certificates as of 28 Feb 2026 [6] [V] |
| Proposed MDR revision COM(2025) 1023 (16 Dec 2025) | Not law. Proposes NB clocks (QMS 120 days, technical documentation 90 days), possible down-classification of some software, and surveillance-based certificate validity | — | [7] [S]. Do not plan on it. |
| FDA 510(k) / De Novo | 9–18 months including preparation (07 §3.3) | User fee about US$25k standard (small business about 25% of that) [K, verify FY2027]; total US$250k–1M+ (07 §3.3) | — |
| GB (UK MDR 2002) | Class I: self-declaration plus MHRA registration. Class IIa+: UK Approved Body, or CE accepted until 30 Jun 2030 for MDR-certified devices [10] [V] | Low for Class I | [9][10] [V] |
| SFDA MDMA | [U]. SFDA generally relies on reference-country approvals (07 §2.5) [K] | [U] | — |
| CDSCO licence | Class A/B through the State Licensing Authority, C/D through the Central Licensing Authority [19] [S]; imports through the Central route [K] | Import licence fees per site and per product under MDR 2017 schedules [K, verify] | Final MDSW guidance of 21 Jul 2026 [18] [S] |
| HSA | Class B/C registration routes [U]. CDSS based solely on established guidelines is non-MD [23] [V] | [U] | — |

**Implication.** The critical path to a CE IIa module is about 24–30 months from QMS start: 9–15 months to build the QMS, 6–12 months to prepare the application (overlapping), and 13–18 months of NB time [E]. In the launch markets (India, KSA, UAE) local routes may be faster, but SFDA's reliance on reference approvals [K] means **a CE certificate effectively gates KSA for regulated modules**. Start the QMS in month 0.

---

## 3. Regulatory frameworks at a glance

| Regulator | Core software rule | CDS carve-out | Classes | Primary source |
|---|---|---|---|---|
| **US FDA** | FD&C 201(h); 520(o) exclusions | Four Non-Device CDS criteria. Criterion 4 weighs "level of software automation" and "time-critical nature". **Automation bias** is named explicitly. A single clinically appropriate recommendation gets enforcement discretion. | I/II/III | CDS guidance, 29 Jan 2026, superseding 6 Jan 2026 [1] [V] |
| **EU MDR** | Rule 11: decision information is IIa; IIb if it could cause serious deterioration; III if death. Monitoring is IIa, or IIb for vital parameters with immediate danger; otherwise Class I | None as such. HIS (admission, scheduling, billing) and storage-only EHR are not devices, but **modules** may be [5] [V] | I/IIa/IIb/III; IMDRF-mapped table (Annex III) | MDCG 2019-11 rev.1, June 2025 [5] [V] |
| **GB MHRA** | UK MDR 2002 (MDD-based). Rule 10: IIa for direct diagnosis or monitoring of vital processes; IIb for immediate danger. **Rule 12: all other active devices Class I** [9] [V] | Decision support "applies automated reasoning … dose calculations" and is therefore likely a device; reference-only tools are not [9] [V] | I (self-declared)/IIa/IIb/III | Software guidance v1.10g (Oct 2026 contact update) [9]; CE accepted to 30 Jun 2030 [10] [V] |
| **SFDA (KSA)** | MDS-G008 Rule 11 mirror: **B** for decisions; **C** for serious deterioration; **D** for death; monitoring B, or C for vital/immediate danger; **A** otherwise [14] [V]. "Software, which drives a device or influences the use of a device, shall fall within the same class as the device" [14] [V] | MDS-G027: HIT (EHR, HIS, DSS, e-prescribing) is not a device "unless specifically intended to analyze or interpret medical information"; **only the regulated modules need submission** [15] [V] | A/B/C/D | MDS-G008 v2.0 (13 Dec 2022) [14]; MDS-G027 v1.0 (version date 10 Aug 2025) [15] [V] |
| **CDSCO (India)** | MDR 2017 First Schedule A–D. The MDSW matrix weighs significance of information against healthcare situation. Driving software takes the hardware's class [18] [S] | Excludes software limited to "data transfer, storage, archival, formatting, communication". HIS/LIS are excluded only where they do not independently serve a medical purpose; "function-specific rather than product-specific" [18] [S] | A/B/C/D | Final MDSW guidance (CDSCO/MD/GD/MDSW/01/2026), 21 Jul 2026 [18] [S]; draft 21 Oct 2025 [19] [S] |
| **UAE** | Emirates Drug Establishment (founded 29 Sep 2023) is "the only federal authority responsible for regulating all medical and pharmaceutical products" [20] [V]. Device services moved from MOHAP, reportedly effective 29 Dec 2025 [21] [S] | No EDE SaMD-specific guidance found [U] | [U] | [20][21] |
| **HSA (Singapore)** | GL-07 R2: IMDRF table. Critical × treat/diagnose or drive = **C**; critical × inform = **B**; serious × drive = **B**; non-serious × drive = **A**, but **B** if analysing or monitoring a vital physiological process [23] [V] | **Non-MD if output is "solely based on established clinical guidelines"** (new in R2). The display exemption "does not include real time patient information intended for patient monitoring or treatment decisions" [23] [V] | A/B/C/D | GL-07 R2 (21 Jul 2025) [23]; GL-04 R4 (Dec 2025) [22] [V] |

---

## 4. Classification memos by function and market

### 4.1 Function × market matrix

"Dev" means likely a medical device. Classes are the most probable class for an HCP-facing, hospital-use intended purpose. Many cells are my inference from the cited framework and should be read as **regulatory hypotheses to confirm by pre-submission or written opinion**.

| Function | US FDA | EU MDR | GB | KSA SFDA | India CDSCO | UAE | Singapore HSA |
|---|---|---|---|---|---|---|---|
| **NEWS2/PEWS score + escalation** | Score with visible components: arguable Non-Device CDS (discrete values are "medical information"). **Deterioration alerting is a device** (ex. 11, 24; time-critical) [1] [V/I] | **Dev, IIa** (MDCG Annex II Fig.2 Ex.2) [5] [V]; IIb if marketed for ICU/ED continuous surveillance [5] | Dev; Class I (Rule 12), IIa if "monitoring vital processes" [9] [I] | **Dev** ("monitors … real time … alerts") [15] [V]; **B** (C if vital/immediate danger) [14] | Dev; likely B [I] | [U]; expect reference-approval reliance | Possibly non-MD (NEWS2 is an RCP guideline), but the real-time monitoring carve-out applies; **seek HSA opinion** [23] [I] |
| **Sepsis screening** (rules or ML) | **Dev** (ex. 11: "detect … sepsis … generate an alarm") [1] [V] | Dev; **IIb** (critical × drives management) [5] [I]; ML adds AI Act Annex I obligations from 2 Aug 2028 (07 §2.3) | Dev; I/IIa [I] | Dev; **C** [14] [I] | Dev; C [I] | [U] | **C** if MD (critical × drive) [23] [I]; guideline-only rule sets arguably non-MD |
| **Dose and weight calculators** | Not addressed directly. HCP-facing, label/protocol-based, formula visible, not time-critical: plausibly Non-Device CDS [1] [I]. Patient insulin bolus: Dev (ex. 28) [1] [V] | **Dev**: "Drug planning systems (e.g. chemotherapy) … calculate the drug dosage … qualified as medical devices" [5] [V]; IIa (IIb for chemo) [I] | Dev; "calculators linked to specific devices/drugs are likely to qualify as devices whatever the complexity" [9] [V]; Class I | Dev; "Software to select dose of cytostatic drugs" sits under Rule 11 (B, up to C/D) [14] [V] | Dev; B/C [I] | [U] | **Non-MD**: "Drug dosage calculator based on established clinical guidelines"; simple calcs (BMI, unit conversion) [23] [V] |
| **DDI, allergy and dose-range checking** | **Non-Device CDS** (ex. 4a–c) with source citation (footnote: link to DailyMed) [1] [V] | **Dev**: EHR-integrated "alerts for potential adverse drug interactions"; renal dose and interaction flags [5] [V]; IIa | Dev (automated reasoning) [9]; Class I [I] | Likely Dev (decision-making HIT) [15] [I]; B | Likely Dev; B [18] [I] | [U] | Label-consistent drug information is non-MD [23] [V]; patient-specific screening ambiguous [I] |
| **BCMA / eMAR** | Health IT, not listed as a device [K] | Likely non-device (identity and recording) unless it computes doses [5] [I]; Better Meds markets as non-device [29][30] [V] | Likely non-device [I] | Prescribing/dispensing workflow without decision-making is not MD [15] [V] | Likely excluded [18] [I] | [U] | Likely non-MD [I] |
| **Bedside transfusion verification** | **Dev**: BECS covers patient/component identity at transfusion; Class II 510(k) (07 §2.2) [V via pack] | Borderline; seek NB opinion. Compatibility-from-IVD logic is IVD MDSW [5][9] [I] | Borderline (as EU) [9] [I] | [U] | [U] | [U] | [U] |
| **Native blood bank** (ABO/Rh interpretation, crossmatch, electronic issue, release blocks) | **Dev**: BECS Class II 510(k) (04 §3.5) | Inventory and workflow parts not a device (LIS precedent [5] [V]); **compatibility = IVD MDSW** under IVDR, likely a high class [K/U] | IVD software: "compatibility of blood … from results generated by an IVD" [9] [V] | [U] (IVD rules parallel IVDR) [K] | Medical-purpose function, so likely IVD MDSW [18] [I] | [U] | [U] |
| **Pump autoprogramming** | Pumps Class II; EHR order data reaches the pump via the vendor's cleared interoperability system [K] | "Drives or influences" a device is MDSW; "remote pump activation" cited [5] [V]; may inherit the pump's class (IIb) [K/I] | Appendix 3 "drives or influences the use of a device" [8] [V title]; likely Dev if it drives [I] | **Same class as the device** [14] [V] (pumps likely C [K]) | Driving software inherits the hardware class [19] [S] | [U] | [U] |
| **Alarm forwarding** (secondary notification) | **Dev**: product code MSX, "system, network and communication, physiological monitors", 21 CFR 870.2300, Class II, 510(k) [3] [V] | **Dev**: "A software module generating alarms based on … physiological parameters is … MDSW" [5] [V]; IIb (ICU/ED vital surveillance) [5] | Dev: remote monitor access that "applies user-defined filtering rules to any alarms" [9] [V] | Dev; **C** (vital, immediate danger) [14] [V] | Dev; C [I] | [U] | Dev; B or C [23] [I] |
| **AI scribe and summaries** | Documentation drafted for clinician sign-off: generally outside CDS; diagnostic or treatment suggestions are analysed as CDS [1] [I] | Speech-to-text and communication systems "do not fall within the definition of a medical device" [5] [V]; generative interpretation may be MDSW; AI Act Art. 50 transparency (07 §2.3) | NHS England AVT guidance (Apr 2025): summarising products likely Class I devices; DCB0129/0160 apply [K] | Transcription is not MD; a "voice scribe system that transcribes … and generates diagnostic suggestions" **is MD** [15] [V] | MD only with medical purpose; validation in "representative Indian populations" for imported models [18] [S] | [U] | Non-MD if documentation only [I] |
| **ED triage AI** | **Dev** (ex. 27: stroke triage, time-critical) [1] [V] | Dev; IIb/III; AI Act Annex III "emergency healthcare patient triage" from 2 Dec 2027 (07 §2.3) | Dev; IIa+ [I] | Dev; C/D [I] | Dev; C/D [I] | [U] | **C**: HSA's own example "vital sign readings to triage … MACE at the emergency department" [23] [V] |

### 4.2 Per-function memos (the reasoning behind the matrix)

**a. NEWS2/PEWS.**
- The NEWS2 algorithm is public and simple (03 §8.3). The regulatory problem is its *purpose*, not its complexity: it drives escalation of deteriorating patients.
- EU: MDCG's Figure 2 Example 2 is a risk score from RR, HR, BP and SpO₂ "to trigger care processes to help reduce ICU transfers … adverse events". It is a direct analogue, qualified as MD MDSW [5] [V].
- KSA: SFDA's own HIT examples remove any doubt [15] [V].
- US: a score computed from one discrete set of observations is not a FDA "pattern". But an alert that a patient is deteriorating is time-critical and fails Criterion 4, consistent with examples 11 and 24 [1] [V/I].
- GB: GB is the most permissive market. Under Rule 12, most such software is Class I and self-declared [9] [V/I].
- Singapore: HSA's R2 "established clinical guidelines" exemption could cover a verbatim RCP NEWS2, but its own footnote carves out real-time monitoring information [23] [V].
- **Conclusion:** treat NEWS2/PEWS as a device everywhere except possibly Singapore. Design it as a transparent, guideline-verbatim module (all components visible, thresholds sourced to RCP or national PEWS, escalation tasks configurable by the hospital) to minimise class and maximise Criterion 4 arguments.

**b. Sepsis screening.**
- FDA example 11 names sepsis explicitly [1] [V].
- In the IMDRF/MDR table, sepsis is a critical situation and an alert drives management, giving IIb in the EU [5] and C in KSA [14] [I].
- Rules-based screening based solely on Surviving Sepsis criteria may be non-MD in Singapore [23] [I]. That is not a basis for a global design.
- Doc 09 §2.1 already recommends against black-box sepsis models.
- **Conclusion:** sepsis screening is Regulated Module #2 (rules first). ML deterioration models come from cleared partners (09 §3 #23).

**c. Dose and weight calculators.**
- The EU and GB are explicit that dosage calculation is a device [5][9] [V], and SFDA lists cytostatic dose selection [14] [V].
- Singapore exempts guideline-based dosage calculators [23] [V].
- FDA's 2026 guidance has no dose-calculator example. An HCP-facing calculator with visible formula, inputs and source, used in a non-time-critical setting, fits the Non-Device CDS pattern [1] [I].
- The FDA enforcement-discretion examples page (content current as of 29 Sep 2022) lists no clinician calculators [2] [V]. Do not assume a "simple calculator" safe harbour.
- **Conclusion:** one shared, versioned **Dose Engine** (UCUM, dosing-weight provenance; 11 §15 #3). Build it as Tier 2, Class C, used by CPOE, pharmacy, chemotherapy and infusion modules.

**d. DDI, allergy and dose-range checking.**
- This is the starkest divergence. FDA calls it Non-Device CDS [1]. MDCG rev.1 calls EHR-integrated DDI alerts MDSW [5] [V].
- For launch markets SFDA is the swing vote. Its HIT text says prescribing software is non-device only when it works "without performing clinical decision-making" [15] [V].
- **Conclusion:** the medication-safety screening engine (DDI, allergy, dose range, duplicate therapy, renal/hepatic) sits in Tier 2 from day one, whatever the US posture. Choose a drug knowledge base vendor (04 §5.1) whose content carries its own regulatory status in our markets [U, verify per vendor]. Our layer documents its intended purpose as "presentation and local tiering of vendor screening results."

**e. BCMA/eMAR.**
- No regulator lists barcode administration checking as a device. UK market practice (Better Meds: DCB0129 assurance, no CE) treats it as non-device [29][30] [V].
- Keep any dose arithmetic inside BCMA delegated to the Dose Engine, so the non-device boundary stays clean [I].

**f. Bedside transfusion verification.**
- In the US it is squarely BECS (07 §2.2).
- In the EU and UK it is borderline. Pure identity matching (wristband ↔ unit ↔ order) is not IVD interpretation. But its sole purpose is to prevent a lethal incompatible transfusion, and many e-transfusion products on the UK market are sold as devices [K].
- **Conclusion:** build it as Tier 2, Class C, with its own risk file, and obtain a written regulatory opinion per market before first use. The SHOT evidence (899 WBIT near misses in 2024; 03 §1 #11) makes it too valuable to defer.

**g. Native blood bank.**
- The compatibility engine is a US 510(k) device (04 §3.5).
- In the EU and UK it is IVD software whose class follows IVDR rules for blood-grouping and compatibility purposes, which is top-risk territory [9][K/U].
- **Conclusion:** see the §5.2 ruling.

**h. Pump autoprogramming.**
- Three regulators say, in different words, that software that drives a device shares its regulatory fate [5][14][19].
- The industry-standard architecture places the control point inside the pump vendor's regulated system: the EHR sends an IHE PCD PIV order (RGV^O15) to the vendor gateway; the gateway validates it against the drug library; the clinician confirms at the pump [K].
- **Conclusion:** see the §5.3 ruling.

**i. Alarm forwarding.**
- Device in every framework that addresses it: FDA MSX Class II [3]; MDCG's alarm-generating module [5]; MHRA alarm filtering [9]; SFDA vital monitoring C [14] [V].
- Doc 04 §6.5 already says integrate (Vocera/Stryker, Ascom, Spok, which are ACM-capable). **Confirmed: do not build.** Our product consumes acknowledgement events for alarm analytics (NPG.01.05.01), which is MDDS-like and non-device [I].

**j. AI scribes and summaries.**
- Transcription is non-device in the EU and KSA [5][15] [V]. Adding diagnostic suggestions makes it a device in KSA [15] [V].
- **Conclusion:** two product SKUs with distinct intended purposes. (1) "Documentation assistant": drafts only; no diagnostic, coding-for-care or treatment suggestions; mandatory sign-off; provenance (09 §1.7). (2) "Clinical suggestions": a regulated-track feature, deferred. Enforce the boundary technically, with prompt and output classifiers that block diagnosis or treatment suggestions in SKU 1 [I].

**k. ED triage AI.**
- Device everywhere, and AI Act Annex III high-risk in the EU.
- **Conclusion:** defer and partner (07 §2.7). Conventional ESI/MTS/ATS triage, where the nurse assigns the category and the system documents and timestamps it (03 §5.2), stays non-device [I].

---

## 5. Rulings on the three open disputes

### 5.1 NEWS2/PEWS (03 says MVP CDS; 07/09 say device/partner)

**Ruling: NEWS2/PEWS ships in the inpatient MVP as Regulated Module #1, the pathfinder for the whole QMS.**
- It is in the MVP because inpatient wards without electronic early-warning scores are not credible against Millennium or TrakCare (01 §4), and NPG.01.05.02 requires escalation criteria (03 §8.3).
- It is regulated because §4 shows it is a device in the EU, KSA, likely India and the US (if it alerts), and Class I in GB.

It is the ideal pathfinder: a published deterministic algorithm, a bounded intended purpose, and cheap clinical evaluation (equivalence to published RCP performance plus verification of correct computation).

**Concretely** [I]:
- An intended-purpose statement written for minimum class: "calculates and displays the NEWS2/PEWS score and components for adult/paediatric inpatients from clinician-entered or device-validated observations, and creates escalation tasks according to the deploying hospital's configured escalation policy." Avoid "detects deterioration" or "predicts."
- 62304 Class B; full 14971 risk file; 62366 summative test with ward nurses (15+ per language group).
- A market switch in the Regulatory Boundary Register. The module activates per tenant only where the registration status is "cleared" or "not required." The fallback is electronic observation charting with frequency scheduling, and nurse-assigned escalation without automated scoring.
- Registration sequence: India (CDSCO Class B; State route if the manufacturing site is in India [19] [S]), then CE IIa (started in month 0, so about M24–30), then SFDA MDMA using the CE certificate [K], then GB Class I declaration if pursued. Defer the US.
- Upgrade path: ML deterioration models are partner-supplied (09 §3), inside the same escalation workflow.

### 5.2 Native blood bank (04: native outside the US; 07: integrate cleared in v1)

**Ruling: split the domain into three modules with different postures.**

| Module | Content | Posture | When |
|---|---|---|---|
| **T1. Transfusion workflow** | Order set, consent, sample request, product request, issue/receipt tracking, cold-chain timers, administration documentation, reaction capture, haemovigilance reporting (SHOT/NHSN/national) | Tier 1 non-device (in the US, only as a client of a cleared BECS) | MVP |
| **T2. Bedside electronic verification** | Wristband ↔ unit (ISBT 128) ↔ order ↔ sample match; two-person electronic witness; hard stop on mismatch | **Tier 2, Class C**; written regulatory opinion per market; US: BECS accessory 510(k) or partner | MVP (India/GCC) after opinion |
| **T3. Transfusion-service engine** | ABO/Rh interpretation, antibody screen workflow, serological or electronic crossmatch, release blocks, inventory allocation | **Do not build in v1, in any market.** Integrate the hospital's blood bank system; interface to e-RaktKosh in India (04 §3.5) | Phase 3, as an IVD-grade product |

This keeps doc 04's ambition (a native, differentiated transfusion pathway) while removing the single highest-class function from the critical path. Doc 04's "native elsewhere" is amended to "native T1/T2; integrated T3."

### 5.3 Pump autoprogramming (03: P2 fast-follow; 04: MVP with one vendor; 07: no-control gateway)

**Ruling: ship in the first post-go-live wave (go-live + 3–6 months, once BCMA scan compliance is ≥95% per Leapfrog/ISMP, 04 §6.6), with one pump vendor, under four guardrails** [I]:
1. **Orders, never commands.** We emit an infusion order (IHE PCD PIV) to the vendor's regulated gateway. Pump-side DERS and clinician confirmation are the control points. We never write pump settings directly.
2. **Vendor intended-use alignment.** Obtain a written statement from the pump vendor that their cleared or CE-marked system's intended use includes receiving EMR infusion orders through their published interface, and that our implementation conforms to their interface specification and test suite.
3. **Class C rigour regardless of legal status.** Full hazard analysis covering unit mismatch, concentration mismatch, wrong channel and stale order. Interface conformance tests, joint V&V with the vendor, and a per-unit autoprogramming-compliance KPI (target ≥80% in year one, against the 53.4% baseline in 04 §6.6) [E].
4. **Per-market regulatory memo** before activation. The EU risk is that "driving or influencing" pulls our interface into IIb [5]. The KSA rule assigns driving software the device's class [14] [V].

---

## 6. Clinical safety case operations

### 6.1 DCB0129/0160 practice and the 2026 review

- **Current requirements** (DCB0129 v4.2 and DCB0160 v3.2, both 2018) [S]:
  - a clinical risk management system and plan
  - a named **Clinical Safety Officer** (registered clinician, trained)
  - a hazard log
  - a **clinical safety case report** per release or deployment

  DCB0160 mirrors these for the deploying organisation (07 §2.4).
- **Legal teeth (England).** Health and Care Act 2022 s.95 changed "have regard to" to "must comply" from 7 Jul 2025. DUAA 2025 s.121 extended scope to IT providers from 5 Feb 2026 [11] [S] (07 §2.4).
- **The review.**
  - Announced 4 Dec 2024.
  - 11 focus groups ran January–July 2025.
  - Consultation ran 29 Jun–11 Sep 2026.
  - Questions: alternative standards, application to medical devices, cybersecurity requirements, and implementation support. The stated drivers include the shift from waterfall to agile [11][12] [S].
  - No revised text is published yet. Some guidance and template updates "may come quickly" [12] [S].
- **DTAC v2.0** reportedly took effect 6 Apr 2026 [S].

**Our operating model** [I]: run DCB0129 globally as the Tier 1 safety regime, written so that (a) a future agile-friendly DCB revision, (b) ISO 14971 for Tier 2, and (c) customer DCB0160-style deployment cases all draw from the same hazard log.

### 6.2 Hazard-log tooling tied to the backlog

Treat the hazard log as a **product service with an API**, not a spreadsheet [I].

- **Data model.**
  - Hazard ID, title, clinical context, cause(s), effect, harm, initial severity × likelihood, risk rating.
  - Controls, each typed design / test / training / labelling / deployment, and each linked to a requirement or story.
  - Verification evidence (test IDs, runs), residual risk, status, owner, CSO approval, and affected markets and modules.
- **Backlog integration.**
  - A mandatory "clinical safety impact" field on every story and bug: none / possible / yes.
  - "Possible" or "yes" auto-routes to CSO triage within 2 working days [E].
  - Bugs tagged with a patient-safety severity reuse the same severity scale.
- **CI/CD gates.**
  - A release cannot be promoted if any story linked to an open hazard control lacks passing verification evidence.
  - A Tier 2 module cannot be promoted without a signed regulatory impact assessment (§8.3).
- **Generation.** The Clinical Safety Case Report and hazard-log delta are generated per release from the service, then reviewed and signed by the CSO. Customers receive their market-specific extract.
- **Deployment hazards** (templates): local order-set or CDS configuration errors, interface mapping errors, printer and label configuration, device association, downtime readiness. These seed each customer's DCB0160-style log (§8.4).

### 6.3 Clinical Safety Officer staffing

| Role | Ratio / size | Notes |
|---|---|---|
| Chief Clinical Safety Officer (physician or senior nurse with informatics background) | 1, hired by M3 | Owns the risk policy, signs Tier 2 risk files, chairs the safety board |
| Product CSOs (registered clinicians, DCB0129-trained) | about 1 per 2–3 clinical squads [E] | Pharmacist CSO for the medication domain; lab or transfusion scientist for diagnostics |
| Market CSOs | 1 per market cluster (UK; GCC; India) [E] | Local practice, language, regulator liaison |
| Squad "safety champions" (engineers/designers) | 1 per squad | First-line triage; hazard-log hygiene |
| Independent review | Annual external audit of the clinical risk management system [E] | Mirrors NB-style independence for Tier 1 |

### 6.4 Incidents, complaints and field safety

A single **Safety Event pipeline** handles customer tickets flagged as patient-safety, telemetry anomalies (for example orphaned orders above 0; 10 §10.3), AI events, security incidents with clinical impact, and regulatory reports [I].

| Market | Device vigilance (Tier 2) | Timelines | Field action |
|---|---|---|---|
| EU MDR | Art. 87 serious-incident reporting | Within 15 days of awareness; 2 days for a serious public-health threat; 10 days for death or unanticipated serious deterioration [K] | FSCA plus Field Safety Notice; PSUR at least every 2 years for IIa, annually for IIb/III [K] |
| US FDA | 21 CFR 803 MDR | 30 calendar days; 5 work days where remedial action is needed [K] | 21 CFR 806 corrections and removals [K] |
| GB MHRA | Strengthened PMS regulations in force 16 Jun 2025 [10] [V] | Similar to the EU [K] | FSN; Yellow Card |
| KSA SFDA | National reporting system (NCMDR) [K] | [U] | [U] |
| India CDSCO | Adverse-event investigation and lifecycle monitoring expected [18] [S]; Materiovigilance Programme of India [K] | [U] | [U] |
| UAE EDE | Post-market vigilance moved to EDE [21] [S] | [U] | [U] |
| Singapore HSA | Mandatory AE reporting [K] | [U] | [U] |

**For Tier 1 (non-device) we impose the same discipline by contract** [I]: customer safety notices with the same format as FSNs, a published known-issues list (BECS-style "known anomalies" labelling; 07 §2.2), a 24-hour notification target for safety-relevant defects, and a kill switch for any CDS rule or feature flag.

### 6.5 Post-market surveillance

The PMS plan per product family combines:
- **Telemetry KPIs:** alert override and PPV per rule, retract-and-reorder, orphaned work, BCMA scan compliance, autoprogramming compliance, NEWS2 escalation response times, AI edit distance and rejection rate (10 §10.3, 09 §1.8).
- Complaint and incident trends.
- Literature and recall monitoring for SOUP and partners.
- Periodic benefit-risk re-evaluation.

Output: a PSUR-style report per Tier 2 module (statutory in the EU), and an annual "Safety Performance Report" per customer as a commercial differentiator [I].

### 6.6 AI safety-event reporting

- **The external expectation.** RUAIH element 5 asks for voluntary, blinded reporting of AI safety events, including "unsafe recommendations, major performance degradation after an update, or biased outputs." Events go to PSOs or similar, and through FDA pathways for regulated AI [31] [V]. The Joint Commission has since launched a RUAIH certification that includes AI-event reporting processes [32] [S]. The EU AI Act adds serious-incident duties for high-risk AI (07 §2.3) [K].
- **What we build:**
  - one-click "Report AI issue" on every AI-generated artefact
  - automatic capture of model, version, prompt template, retrieval sources and output diff (09 §5.3)
  - routing into the Safety Event pipeline
  - customer export in a PSO-compatible de-identified format [I]
  - a monthly AI safety review with the model owner and CSO

---

## 7. Verification and validation strategy

### 7.1 Traceability model

**User need → requirement → hazard(s) → risk control(s) → verification test(s) → validation evidence → release.**
- All links live in the hazard-log service and the requirements tool.
- Tests carry requirement and hazard IDs as tags.
- CI publishes results with those IDs, so the trace matrix is *generated*, never hand-maintained [I].
- FDA's premarket software documentation (Basic or Enhanced) and MDR technical documentation can then be produced from the same graph [K].

### 7.2 Test portfolio

| Layer | What | Gate | Evidence artefact |
|---|---|---|---|
| Unit and property-based | State machines for orders, MAR doses, encounters, specimens, beds and claims (11 §10). Invariants such as "no administration without an active verified order or documented override", "every order reaches a terminal state", "merge is reversible". Generators produce random event sequences, including out-of-order and duplicate events. | Every commit | Coverage of invariants, not just lines |
| Module and contract | Spring Modulith-style module tests (08 §10); consumer-driven contracts for REST and events; **HL7 v2 conformance profiles** per interface (message structure, cardinality, vocabulary bindings), validated with NIST-style tooling [K] | Every merge | Profile conformance report per interface |
| FHIR | HL7 validator against pinned IG versions (US Core, `ndhm.in`, `nphies-fs`, UK Core); Inferno where relevant (06 §7.4) | Every merge | Validation report per artefact type |
| **Clinical scenario suites** | See §7.3 | Nightly and pre-release | Scenario pass matrix mapped to hazards |
| National sandboxes | ABDM M1–M3 functional tests and WASA; NPHIES eligibility through payment; NABIDH/Malaffi/Riayati onboarding (06 §4.5–4.6) | Per release touching adapters; annual recertification | Sandbox logs, certificates |
| Performance | The **1,000-bed day** (§7.4) | Weekly; release blocker on p95 regression | Load report against SLOs (08 §12.6) |
| Resilience | Chaos experiments, DR failover, downtime and BCA drills (§7.5) | Monthly game day; quarterly DR | Drill reports with measured RTO/RPO |
| Security | SAST/DAST/SCA, SBOM diff, annual third-party pen test, pre-release pen test for Tier 2 changes, WASA by a CERT-In-empanelled auditor (KareXpert's NABH listing shows a one-year WASA validity [33] [V]) | Per release / annual | Pen-test summary in the evidence pack |
| Usability | Formative (continuous); summative for Tier 2 and Tier 1 critical tasks (§7.6) | Before first release of a feature and after significant UI change | IEC 62366 summative report; NISTIR 7742 format |
| Localization, RTL, accessibility | §7.7 | Per release | Pseudo-locale and RTL screenshot diffs; WCAG 2.2 AA audit |
| Migration | Mock conversions (§9.5) | Per customer | Reconciliation pack |
| Customer UAT | UAT kit (§8.4) | Per customer go-live and upgrade | Signed UAT and DCB0160-style case |

### 7.3 Clinical scenario suites

1. **Leapfrog CPOE harness.** Automate the eight Leapfrog categories with simulated patients and orders after every drug-KB or CDS content update. Include the **Excessive Alerts** category, so over-alerting fails the build (03 §7.5). Target: ≥60% of serious-error scenarios caught *and* zero interruptive alerts on the "should not alert" set [E].
2. **ISMP scenarios.** Weekly methotrexate, minibag vincristine, opioid tolerance, metric-only weights, 10× decimal errors, look-alike/sound-alike drugs, concentration standardisation, insulin and heparin protocols (04 §11 #9).
3. **Closed-loop medication end to end:**
   - prescribe → verify → dispense (ADC profile) → BCMA scan sequence → pump order
   - with the failure paths: wrong patient, wrong drug, expired, dose outside range, discontinued while in transit, offline administration against a stale order (08 §6.3)
   - PRN double-dose at shift change; cutover-day "last given" carry-over
4. **Transfusion end to end:** consent → sample with bedside label (WBIT detection) → product request → issue → bedside two-person verification → vitals timers → reaction → haemovigilance report, with a mismatch at each step.
5. **Results closure:** critical value → named recipient → escalation; result for a discharged patient; amended result (03 §1 #12).
6. **Identity:** newborn naming, unknown trauma alias, merge and unmerge with downstream notification, similar-name alerts.
7. **Downtime:** read-only BCA access, downtime registration with pre-allocated IDs, back-entry with original times (11 §15 #10).
8. **Deterioration:** NEWS2 threshold boundaries (0/1–4/single 3/5–6/≥7), SpO₂ Scale 2 selection, task escalation timers.

### 7.4 The "1,000-bed day" performance test

A synthetic workload for a 1,000-bed tertiary hospital [E]:
- **Daily volumes:** about 1,000 inpatients, 3,000 outpatient visits and 300 ED arrivals.
- **Clinical throughput:** about 20,000 orders, 25,000 medication administrations and 15,000 result messages.
- **Load profile:** vitals every 4 hours, with a 7–9 am shift-change peak at 3× average concurrency.
- **Interfaces:** about 300,000 HL7/FHIR messages per day, and 2 years of history preloaded.

Run it in CI from month 6 (08 §14 #13) against the p95 budgets in 08 §12.6. Treat regressions as release blockers (10 §10.1 #1). Rerun it per customer on their sizing before go-live.

### 7.5 Chaos, DR and downtime drills

- **Monthly game days:** kill a database primary, partition Kafka, slow the terminology service, expire certificates.
- **Quarterly:** regional DR failover with measured RTO/RPO against 07 §6.2 tiers, plus an immutable-backup restore test.
- **Twice-yearly customer downtime drill** with BCA and paper workflows (ECRI 2026 #2 hazard; 04 §11 #13).

### 7.6 Summative usability

- Follow IEC 62366-1 with NISTIR 7804 methods: **15–20 participants per distinct user group**, more than ONC's 10 (10 §10.1 #13).
- **In the GCC, user groups must reflect reality** [I]: Arabic-first and English-first clinicians are distinct user groups because they use different UI directions, and a large share of the nursing workforce is expatriate and English-first [K].
- **India:** English UI with vernacular patient-facing outputs.
- **Critical tasks:** patient search and selection; weight-based and high-alert ordering; BCMA with override; transfusion check; NEWS2 escalation; critical-result acknowledgement; discharge med rec.

### 7.7 RTL, localization and accessibility testing

- Pseudo-localisation builds for text expansion.
- RTL mirroring tests: layout, icons, charts, tables.
- **Bidirectional mixed-content tests:** an Arabic name, an English drug name, numerals and units in one string.
- Decision on clinical numerals [I]: always Western digits for doses and lab values, with a configurable display for others.
- Dual Hijri/Gregorian dates.
- Printing tests on ZPL wristband and label printers for Arabic and Indic scripts (shaping and conjuncts).
- Collation and transliteration search.
- WCAG 2.2 AA (10 §10.1 #10).

### 7.8 Synthetic data with Indic and Arabic names and identifiers

Extend Synthea (08 §10) with **locale packs** [I]:
- **Names.**
  - Indian regional patterns: single names, initial-first South Indian style ("R. Kumar"), father's name as surname, multiple scripts.
  - Arabic: ism + nasab (bin/bint) + nisba/laqab, "Al-" variants, and transliteration variants (Mohammed / Muhammad / Mohamed).
- **Identifiers with valid check digits** [K]:
  - ABHA number (14-digit)
  - Aadhaar format (12-digit, Verhoeff) for masking and handling tests only; Aadhaar storage is legally restricted
  - Saudi national ID / Iqama (10-digit; leading 1 for citizens, 2 for residents)
  - Emirates ID (15-digit, "784" prefix)
  - Qatar QID
- **Realistic dirt** [K]: imputed DOBs ("01-01-YYYY"), mobile numbers shared within families, expatriates with several identifiers over time (passport, visa, Iqama), mixed-script duplicates.

This data drives EMPI tuning (§9.3) and wrong-patient UX tests.

---

## 8. Validating configuration and content; continuous delivery under validation

### 8.1 Content is a regulated artefact

Order sets, CDS rules, NEWS2 escalation policies, drug-KB tiering, lab reference ranges, tariffs, packages and payer rules change patient care and revenue as surely as code does.

- Treat them as **versioned, signed content bundles**, with owner, evidence link, review date, approval workflow and effective-dating (08 §14 #6, 04 §11 #2, 03 §21.3 #9).
- Each bundle carries its own hazard-log links.
- Tier 2 content (for example dose limits inside the Dose Engine) inherits the module's design controls.

### 8.2 Simulation and replay against historical data

| Content type | Simulation before activation | Acceptance metric [E] |
|---|---|---|
| CDS rule / alert | **Silent mode** for 2–4 weeks, then replay against the last 90 days of orders: firing rate per 100 orders, estimated PPV from outcomes, overlap with existing alerts | Interruptive alerts per 100 orders not increased without CDS committee sign-off; PPV floor per tier |
| Order set | Diff against the previous version; replay of typical orders through dose and DDI checks; Leapfrog harness | Zero new hard-stop conflicts; Leapfrog pass |
| NEWS2 policy | Replay of 90 days of observations: escalation volume per ward per shift | Within staffing capacity agreed with nursing leadership |
| Tariff / package / payer rule | **Re-price the last 3–6 months of encounters** under the old and new rules; package coverage and leakage report; NPHIES/NHCX claim scrub replay | Revenue delta explained line by line; zero unpriced services |
| Lab reference range / autoverification | Replay of historical results: autoverification rate, flag changes (04 §2.4) | Medical director sign-off |

### 8.3 Continuous delivery under validation

| Change class | Example | Path | Evidence |
|---|---|---|---|
| C0 non-safety | Report layout, ERP screen | Continuous, behind flags | Automated tests |
| C1 safety-relevant, non-device | eMAR UI change, order routing | Flags default off; CSO review; regression plus scenario suites; activation in tenant windows (08 §10) | Hazard-log delta; scenario report |
| C2 device module | Dose Engine, NEWS2, transfusion verification | **Batched regulated release** (for example quarterly); full V&V; **regulatory impact assessment**: does it change intended purpose or create a significant change requiring NB or FDA review? [K]; AI changes only within an authorised PCCP (07 §2.2) | Full release evidence pack; NB notification where needed |

**Release Evidence Pack** (generated per release and per market):
- release notes and the known-anomalies list
- hazard-log delta and the Clinical Safety Case Report
- trace matrix extract and test summary (including Leapfrog and scenario results)
- performance and DR results
- SBOM with vulnerability status and the pen-test summary
- usability summary for UI-affecting changes
- regulatory impact assessment
- feature-flag defaults per tenant

### 8.4 Customer UAT and deployment-safety kits

Each kit contains:
- scripted UAT scenarios per module, mapped to hazards
- synthetic test patients for the customer's locale
- expected results and sign-off forms
- a **deployment hazard log pre-filled** with known deployment hazards (DCB0160-style), for the customer's CSO or patient-safety lead
- an interface test pack (HL7 profiles, sample messages)
- a downtime-drill script
- an upgrade regression subset for quarterly activations

These kits turn our validation into the hospital's validation and cut implementation time (01 §12.5) [I].

---

## 9. Data migration and cutover

### 9.1 Incumbent inventory in the launch markets

Export capabilities are mostly not publicly documented. The table records what is known and the extraction channels to *test during pre-sales discovery*.

| Incumbent | Where (pack refs) | Deployment | Likely extraction channels | Known / unknown |
|---|---|---|---|---|
| **Oracle Health Millennium** | SEHA/PureHealth, HMC Qatar, KFSHRC (2015 evidence), Dubai/EHS sources (01 §4) | Oracle-hosted or on-prem Oracle DB [K] | Vendor-assisted DB extracts or CCL reports [K]; HL7 v2 interface archives; FHIR R4 APIs (bulk availability outside the US [U]) | Millennium exits are large and fee-sensitive. One archive vendor describes a Millennium archive deadline carrying "$1.4 million in monthly fee risk" [38] [S] |
| **InterSystems TrakCare** | Mediclinic ME (7 hospitals); Medcare moving to IntelliCare (01 §4) | IRIS/Caché [K] | SQL projections of globals; HL7 v2/FHIR via IRIS for Health/HealthShare [K] | Competitor holds CE IIa [26]; expect vigorous retention |
| **IQVIA HIS** | Saudi MoH clusters (2025 wins; 01 §4) | [U] | [U] | Recently installed; integration more likely than replacement before about 2030 [I] |
| **ezCaretech BESTCare** | MNGHA, Care Med (01 §4) | [U] | [U] | — |
| **Local GCC vendors** (Balsam/OASIS etc.) | Private hospitals and clinics | Often on-prem SQL Server/Oracle [K] | DB extract; NPHIES message archives for claims history [I] | — |
| **KareXpert** | 300+ hospitals in India (01 §5.5) | Cloud SaaS [S] | Vendor export or API under contract; **ABDM FHIR bundles** (NABH Advanced HIS/EMR certified to May 2028 [33] [V]; NABH requires ABDM M3 (06 §4.5)) | Exit terms are a contract question |
| **Insta by Practo** | 500+ clients (01 §5.5) | SaaS [S] | Vendor export or API [U]; ABDM bundles if certified [U] | — |
| **Akhil, MocDoc, Suvarna, Birlamedisoft, Aosta** | India (01 §5.5) | Mix of on-prem and SaaS [U] | DB extract (on-prem); CSV/report exports; ABDM bundles where M2-certified [U] | Schema documentation rarely available [K] |
| **NIC eHospital** | Public hospitals, free (01 §5.5) | Government cloud / state data centres [U] | Through NIC/state IT under government data-sharing rules [U] | Data ownership sits with the state health department [I] |
| **In-house systems** (Apollo, Narayana/Athma, chain-built) | 01 §5.5 | On-prem/private cloud | Direct DB access with the customer's own engineers | Usually the *easiest* technically, the hardest semantically |

**Discovery checklist for every deal** [I]:
- contractual data-return rights and fees
- whether the legacy vendor will provide schema documentation and extraction support, and at what price
- read-only licence cost after cutover
- interface-engine message archives (HL7 v2 replay is often the cleanest discrete history)
- document stores (PDF/scans)
- ABDM status (HIP ID, bridge, linked care-context counts)
- payer artefacts (NPHIES and TPA pre-auth states)

Under DPDP the hospital is the data fiduciary and the incumbent a processor (06 §4.5). Write data return at the customer's instruction into the go-live plan at T-6 months [I].

### 9.2 Migration patterns: discrete, document and archive

| Pattern | What moves | How | Pros / cons |
|---|---|---|---|
| **Discrete (live data)** | Demographics and identifiers; allergies; active problems; home/active meds (as reconciliation input, never as active orders); immunisations; 2–5 years of labs with LOINC mapping (10 §4.6); recent vitals; future appointments; referrals; payer coverage; deposits and balances (§9.4) | Domain APIs (not direct DB writes), with `migrated` provenance and **bitemporal** recorded vs effective times (08 §3.7) | Usable by CDS (allergy and DDI checks work from day one). Mapping effort; quality risk. |
| **Document** | Discharge summaries, operative notes, imaging and pathology reports, clinic notes, scanned paper | PDF/A plus FHIR DocumentReference with type, date, author and encounter; ABDM bundles map well (OPConsultNote, DischargeSummary, DiagnosticReport, Prescription) | Cheap and faithful. Not computable. |
| **Archive (not imported)** | Full legacy history: closed encounters, historical orders and MARs, audit trails, billing history | Read-only legacy viewer launched in patient context | Meets retention (07 §8.2) and medico-legal needs; enables decommissioning. |
| **Clinician abstraction** | Problem lists and key history for scheduled patients | Chart-prep sprint 2–4 weeks before go-live (10 §4.6) | Highest quality; costs clinician time. |

### 9.3 EMPI de-duplication before load: benchmarks and targets

- **Baseline expectations.** Industry estimates of duplicate rates are 8–12%; RAND gives an 8% average and 15–16% for large systems (03 §1 #6).
- **No published benchmark was found for Indian or GCC hospitals** [U].
  - India: expect worse, because of weak identifier use, shared mobile numbers and imputed DOBs [I].
  - GCC: national IDs and Iqama help, but expatriates accumulate identifiers [I].

| Metric | Target before cutover [E unless cited] |
|---|---|
| Residual duplicate rate in the loaded MPI | <1% (internal target; 03 §1 #6) |
| **Known overlays (two people in one record) loaded** | **0**. False merges are more dangerous than duplicates |
| Gold-standard adjudicated pair set per source | 1,000–2,000 pairs, stratified by match score |
| Precision at the auto-merge threshold | ≥99.9% on the gold set |
| Review-queue clearance | 100% of high-score pairs adjudicated by HIM before Mock 3; residual medium-score pairs carried into the live steward queue with an SLA |
| Linkage keys preserved | Every legacy MRN stored as an alternate identifier; merge history kept and reversible (11 §15 #7) |

### 9.4 Cutover playbook: the risky items

| Item | Recommended method | Main hazard | Control |
|---|---|---|---|
| **Inpatients (open encounters)** | Create "conversion admissions" with original admit time, bed, attending, isolation, code status, weight with date (11 §15 #2–3) | Lost context; wrong bed | Charge-nurse verification checklist per patient at T+0 to T+4 h |
| **Active inpatient orders** | Pharmacists **pre-build** orders from the converted med list 24–48 h before cutover as "pending prescriber signature". Prescribers sign at go-live. No automated activation of legacy orders. [I] | Omitted or duplicated meds | 100% pharmacist plus prescriber review; reconciliation report per patient |
| **MAR** | Hard MAR cut at a fixed time (choose a low-activity hour). Last administrations documented in legacy; **PRN and last-given times and infusion rates carried over visibly** | **Double-dosing of PRN opioids and insulin; infusion rate errors** | Nurse double-check at cutover; "last given" banner for 24 h |
| **ED** | Drain to minimum census; quick-register in-progress patients in the new system; legacy remains read-only | Lost results for in-transit patients | Results-in-flight list reconciled every 30 min for 6 h [E] |
| **Pending results and specimens** | Accession-number mapping table; LIS/RIS route to the new system from T0; in-flight list | Orphaned results (VA lesson; 10 §4.8) | Orphan queue at zero on the dashboard |
| **Pharmacy stock opening balances** | Wall-to-wall count at cutover with batch/expiry scanning (GS1); witnessed controlled-drug counts; ADC reconciliation; open POs and consignment stock loaded separately | Stock-outs; controlled-substance discrepancies | Variance report signed by the chief pharmacist; CD register sign-off |
| **Deposits and advances (India and GCC self-pay)** | Per-patient deposit balance migrated as an opening ledger entry with legacy receipt references; GL control-total match | Lost patient money; disputes | Totals reconciled to the paisa/halala; patient-facing deposit statement on request |
| **Packages in progress** (India surgical/cardiac packages, PM-JAY, TPA) | Migrate package header with entitlement, consumed components and remaining coverage; or close in legacy if the discharge is imminent [I] | Leakage or double billing | Package-by-package sign-off by billing lead |
| **Pre-authorisations** (NPHIES, TPA/insurer, PM-JAY) | Migrate approval numbers, validity, approved amounts, pending requests; status re-check after cutover | Claim denials | Pre-auth list reconciled; payer liaison on duty |
| **Open IP bills** | Default: interim legacy bill at cutover plus a new account with carried-forward deposits; migrate charges only for package cases [I] | Fragmented bills confuse payers | Payer-specific rules agreed before cutover |
| **AR run-out** | Pre-cutover discharges stay in legacy for 6–12 months (10 §4.6); India TPA settlements and NPHIES resubmissions need a read-only licence and claim-submission ability | Lost cash | AR run-out dashboard; contract for legacy access |
| **E-invoicing chains** | KSA ZATCA Phase 2: onboard the new solution's EGS units before go-live; a new invoice counter and hash chain starts in the new system [K] | Non-compliant invoices | ZATCA sandbox test in Mock 3 |
| **Future appointments and referrals** | Convert 6–12 months forward with slot mapping; patient re-notification where times change | Missed appointments | Clinic-by-clinic count reconciliation |

### 9.5 Mock conversions and reconciliation metrics

| Event | Timing | Exit criteria [E] |
|---|---|---|
| Mock 1 | T-120 d | Full extract runs; ≥95% of records load; mapping gaps listed |
| Mock 2 | T-75 d | ≥99.5% load; **every reject has a reason code**; clinician sample review of 30–50 charts |
| Mock 3 | T-45 d | Production-like, timed within the cutover window; 100% reconciliation; HIM and finance sign-off |
| Dress rehearsal | T-14 d | Full runbook including delta loads, interfaces, printing and the financial cutover; timings within plan |
| Go-live load | T0 | Delta load complete; dashboards green |

**Reconciliation metrics.**
- **Accounting identity per entity:** source count = loaded + rejected (with reason) + intentionally excluded. Must hold at 100%.
- **Control totals and hashes** on financial fields (deposits, AR, package balances) and clinical counts (active allergies per patient, active meds per inpatient).
- **Field-level defect thresholds:** zero defects in critical fields (identifiers, allergies, active meds, blood group, code status, weight); <0.5% in non-critical fields.
- **100% review** of active inpatient allergies and medications at cutover.
- **Load duration** at or below the planned cutover window, with 25% headroom.

### 9.6 Legacy archive options and costs

| Option | Description | Cost signal | Recommendation |
|---|---|---|---|
| Keep legacy live, read-only | Licence/AMC plus infrastructure | VGR keeps legacy systems up to eight years at about SEK 40M/yr (01 §3.5) | Only for the AR run-out window |
| Third-party archive (Harmony, MediQuant, InterScripts, ELLKAY, Olah, Triyam) | Active archive with EHR launch | KLAS: ROI comes mainly from decommissioning, lower infrastructure and eliminated maintenance; 42% of deep adopters use EHR-integrated access [36][37] [S]. Pricing not public; [E] US$50–250k per major source system one-time plus 10–25%/yr | Large US/GCC Millennium exits |
| **Our built-in Legacy Data Viewer** | Extracted data in lakehouse and document store; patient-context launch; audit; retention policies | Marginal cost [E] | **Default for India/GCC**; doubles as the migration staging area |
| PDF dump | Printed records as PDF/A | Cheapest | Small clinics only |

### 9.7 ABDM care-context re-linking

When a hospital replaces its HMIS, its HIP identity (the HFR facility) stays the same, but the *bridge* (software endpoint) changes. Care contexts the old system linked are referenced by patients' PHR apps. Once linked, care contexts cannot be unlinked [35] [S]. No official NHA guidance on vendor changes was found [U].

Recommended procedure [I]:
1. At exit, obtain from the incumbent the full linked-care-context register: patient reference, ABHA address, care-context reference, display, HI types and dates.
2. Load the register into our ABDM adapter as **legacy care contexts**, mapped to migrated documents or archive entries.
3. Re-point the facility's HIP bridge to ours, following the sandbox-exit and V3 bridge-URL process [35] [S], and coordinate with NHA.
4. Our HIP must answer discover, link and data-request callbacks for the old references and generate FHIR bundles from migrated data.
5. **Do not re-link** contexts that already exist (risk of duplicates for patients). Agree DHIS incentive counting with NHA [U].

### 9.8 Migration tooling we must build (the "Migration Workbench")

1. **Source connectors:** JDBC (Oracle, SQL Server, PostgreSQL, MySQL), CSV/SFTP, HL7 v2 archive replay, FHIR Bulk, **ABDM FHIR bundle importer**, CDA/C-CDA, DICOM metadata indexer.
2. **Staging in the lakehouse,** with schema discovery and profiling (null rates, code distributions, date anomalies).
3. **Mapping studio:** ConceptMaps from local codes to SNOMED/LOINC/ICD-10/SBS/drug codes (06 §7.3); reusable *incumbent migration packs* for the top incumbents.
4. **EMPI pre-match** service with gold-set tooling and a steward queue (§9.3).
5. **Loaders through domain APIs:** idempotent, re-runnable, with `migrated` provenance and bitemporal times.
6. **Reconciliation dashboards and accounting identity** (§9.5), plus a clinician sample-review app.
7. **Financial opening-balance tools:** deposits, packages, pre-auths, AR run-out tracking.
8. **Pharmacy count app:** mobile GS1 scanning with witnessed controlled-drug counts.
9. **Active-order conversion assistant:** pharmacist pre-build, prescriber sign.
10. **Cutover orchestrator:** a timed runbook as a Temporal workflow (08 §4.4) with go/no-go checkpoints.
11. **Legacy Data Viewer** (§9.6).
12. **ABDM care-context mapper** (§9.7).

---

## 10. Go-live safety

### 10.1 Readiness gates (contractual, building on 10 §10.2)

| Gate | Timing | Must be true [E unless cited] |
|---|---|---|
| G1 Build complete | T-90 | Foundation content ≥80% adopted (10 §10.1 #2); interfaces unit-tested; regulatory statuses confirmed per tenant in the Boundary Register |
| G2 Integrated testing | T-45 | Mock 3 passed; scenario suites green; 1,000-bed-day test at customer sizing within SLOs; deployment hazard log reviewed by the customer's CSO |
| G3 Readiness | T-14 | Dress rehearsal passed; training ≥95% complete and proficiency ≥85% (10 §10.2); downtime drill passed; zero open severity-1 and no unmitigated high-risk hazards; command centre staffed |
| G4 Go/no-go | T-1 | Final delta-load rehearsal on time; safety dashboard live (10 §4.8); payer and HIE connectivity (NPHIES/ABDM/HIE) verified in production |

### 10.2 Rollback and slow-down criteria

**Reality.** After about 48–72 hours of live documentation, "rollback to legacy" means re-entering every new fact into legacy. VGR halted after three days (01 §3.5).

Therefore define three levels [I]:
1. **Feature fallback.** Turn off a flagged feature (for example a CDS rule or autoprogramming) at any time.
2. **Workflow fallback.** Revert a workflow to downtime procedures for a unit (for example paper MAR plus back-entry).
3. **Full fallback to legacy.** Allowed only within a defined window (≤72 h), with legacy kept warm and a back-entry team ready.

**Example triggers for level 3** [E]:
- an unexplained loss or misrouting of orders or results (orphan queue >0 for more than 2 h with patient impact)
- BCMA unavailable for more than 4 h across multiple units
- p95 order-sign latency above 5× SLO for more than 4 h
- a sentinel event attributable to the system
- payer connectivity failure blocking admissions for more than 24 h

### 10.3 Settling big bang vs unit pilot (03 vs 10)

**Ruling: "Pilot the product, big-bang the hospital."**
- **Before go-live,** de-risk with simulation, not live partial deployments:
  - a **model ward**: 1–2 weeks of scripted shifts on the production build with real staff and synthetic patients
  - **day-in-the-life** dress rehearsals
  - parallel billing replay for revenue (§8.2)
- **At go-live,** cut over all inpatient clinical and revenue modules at a site in one event. A partial closed loop and mixed paper/electronic MARs are known hazards (03 §21.2), and the observational evidence on big-bang go-lives is reassuring when readiness is high (10 §4.4).
- **Allowed phasing:**
  - ERP and back-office modules
  - outpatient clinics *before* inpatient, where clinic and inpatient medication records do not interleave
  - self-contained units (stand-alone day-care, dialysis or a separate specialty hospital)
  - multi-site customers in regional waves (10 §4.4)
- **Not allowed:** live single-unit inpatient pilots of orders, MAR or BCMA. This overrides 03 §21.2's "pilot on one inpatient unit".

---

## 11. Implications for our build (opinionated)

1. **Hire a Head of QA/RA and a Chief Clinical Safety Officer by month 3.** Adopt a company-wide ISO 13485-based IMS integrated with ISO 27001, with Tier 0/1/2 rigour. Target certification by month 12–15. This is the gating item for every regulated module and for KSA.
2. **Create a Regulatory Boundary Register as a product service.** Model each function × market × intended purpose × class × status (cleared / not required / pending). Tenant activation of Tier 2 features is driven by the register, not by configuration toggles.
3. **NEWS2/PEWS is Regulated Module #1.** Write the intended purpose for minimum class, give it a full 14971/62366 file, register it in India first, then CE IIa (start the NB process immediately), then SFDA. Ship observation charting as the fallback where it is not yet registered.
4. **Build the Dose Engine and the medication-safety screening layer as Tier 2 from the first commit.** The EU already treats EHR-embedded DDI as MDSW [5]. Do not let dose arithmetic leak into CPOE, BCMA or pump code paths.
5. **Blood bank: native T1 workflow, regulated T2 bedside verification, integrated T3 compatibility engine** (§5.2). Revisit T3 as an IVD-grade product in Phase 3.
6. **Pump autoprogramming:** one vendor, orders not commands, vendor intended-use letter, Class C rigour, go-live + 3–6 months (§5.3). **Never build alarm forwarding.**
7. **AI documentation stays non-device by technical enforcement.** Block diagnostic and treatment suggestions in the documentation SKU, and build AI-event reporting into every AI surface (RUAIH element 5 [31]).
8. **Ship the Hazard Log service and Release Evidence Pack generator before the first pilot customer.** Every story carries a safety-impact field, CI blocks unverified hazard controls, and the safety case is generated per release.
9. **Operate DCB0129 globally for Tier 1.** Track the NHS review [11][12], but do not wait for it. Sell the per-release safety case and customer deployment kit as differentiators in India and the GCC, where no incumbent offers them [I].
10. **Make the Leapfrog harness, ISMP suite and closed-loop scenario suites nightly release gates.** Over-alerting must fail builds as surely as missed alerts do.
11. **Make property-based tests on the order, MAR and encounter state machines a non-negotiable engineering standard.** The 11 §15 invariants are the property list.
12. **Treat content (order sets, CDS, tariffs, packages) as signed bundles with simulation and replay.** No CDS rule goes interruptive without a silent-mode period. No tariff goes live without a re-pricing replay.
13. **Build the Migration Workbench as a product,** with incumbent migration packs prioritised by pipeline: (a) an ABDM-bundle importer plus generic SQL for Indian incumbents; (b) a Millennium pack for the GCC; (c) a TrakCare pack. Price migration as a fixed-scope service backed by these tools (01 §12.2 #9).
14. **Script the cutover of the four dangerous items** (active meds and PRN last-given; deposits and packages; pharmacy opening balances including controlled drugs; ABDM care contexts) with owners, reconciliation and sign-offs, and rehearse them in Mock 3 and the dress rehearsal.
15. **Make the Legacy Data Viewer our default archive in India/GCC.** It removes a third-party cost line and doubles as migration staging.
16. **Write readiness gates and rollback levels into contracts.** Go-live is decided by gates, never dates (10 §10.2). Level-3 rollback is allowed only within 72 hours, with a warm legacy system.
17. **Default to "pilot the product, big-bang the hospital"** for every inpatient go-live. Use model-ward simulation instead of live unit pilots.
18. **Plan regulatory spend realistically** [E]: about US$0.5–1.0M over the first 30 months for the QMS, the first CE IIa and two local registrations, excluding US FDA. Add a dedicated regulatory engineer per regulated module.

---

## 12. Uncertainty register

| Item | Status | Next step |
|---|---|---|
| UAE device rules for software (EDE); whether the DoH/DHA AI policies impose separate requirements | [U]: only secondary sources on the MOHAP→EDE transfer [21] | Fetch EDE legislation and guidance; local counsel |
| SFDA MDMA pathway for software without a reference-country approval, and its timelines and fees | [U] | SFDA MDS-REQ 1; pre-submission meeting |
| CDSCO final MDSW guidance text (classification matrix, licensing route for software, QMS expectations) | [S] via law-firm summary [18] | Obtain document CDSCO/MD/GD/MDSW/01/2026 |
| EU IVDR class for transfusion compatibility software and bedside verification | [K/U] | NB pre-application opinion |
| Whether NHS England AVT guidance (Apr 2025) still classifies summarising scribes as Class I | [K] | Fetch the current guidance (england.nhs.uk returned empty) |
| Revised DCB0129/0160 content and timetable | [S]; not published | Monitor NHS England |
| MDR revision COM(2025) 1023 effect on Rule 11 | [S] [7] | Track the legislative process |
| Epic and Oracle MDR/CE positions; Cerner blood bank 510(k) | [U]/[K] | Search EUDAMED and the FDA 510(k) database |
| Incumbent export capabilities (KareXpert, Insta, Akhil, MocDoc, Suvarna, eHospital, IQVIA HIS) | [U] | Pre-sales discovery questionnaire (§9.1) |
| Official NHA process for an HIP bridge change and existing care contexts | [U] | NHA/ABDM support query |
| Indian and GCC duplicate-rate baselines | [U] | Measure during the first three customer migrations and publish |

---

## Sources

1. U.S. FDA. *Clinical Decision Support Software: Guidance for Industry and FDA Staff* (issued 29 Jan 2026; supersedes 6 Jan 2026; docket FDA-2017-D-6569). https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software (PDF: https://www.fda.gov/media/109618/download) [V]
2. U.S. FDA. *Examples of Software Functions for Which the FDA Will Exercise Enforcement Discretion* (content current as of 29 Sep 2022). https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-which-fda-will-exercise-enforcement-discretion [V]
3. U.S. FDA. Product Classification database, product code MSX ("system, network and communication, physiological monitors", 21 CFR 870.2300, Class 2, 510(k)). https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=MSX [V]
4. European Commission. *Guidance – MDCG endorsed documents and other guidance*. https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-endorsed-documents-and-other-guidance_en [V]
5. MDCG. *MDCG 2019-11 rev.1: Qualification and classification of software – Regulation (EU) 2017/745 and Regulation (EU) 2017/746* (June 2025). https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf [V]
6. European Commission / DG SANTE study. *Survey results of the 20th NB survey (MDR/IVDR), data status 28 February 2026* (2 Jul 2026). https://health.ec.europa.eu/document/download/59b9d90e-be42-4895-9f6f-bec35138bb0a_en [V]
7. Veranex. "Europe Is Rewriting the Rules on Medical Devices. Here's What the Proposed MDR Revision Means for You" (on COM(2025) 1023, 16 Dec 2025). https://veranex.com/blog/what-the-proposed-2025-eu-mdr-revision-means-for-you [S]
8. GOV.UK / MHRA. *Medical devices: software applications (apps)* (last updated 1 Jul 2023; appendices on symptom checkers, clinical calculators, "drives or influences", FSNs). https://www.gov.uk/government/publications/medical-devices-software-applications-apps [V]
9. MHRA. *Guidance: Medical device stand-alone software including apps (including IVDMDs)*, v1.10g (revision history to Oct 2026). https://assets.publishing.service.gov.uk/media/6abf6c8c943e890cb55e5e52/Medical_device_stand-alone_software_including_apps__including_IVDMDs.pdf [V]
10. GOV.UK / MHRA. *Regulating medical devices in the UK* (last updated 20 Feb 2026). https://www.gov.uk/guidance/regulating-medical-devices-in-the-uk [V]
11. NHS England. *National review of clinical risk management standards DCB0129 and DCB0160: supporting information* (page returned empty to the fetcher; details from the search index). https://www.england.nhs.uk/long-read/national-review-of-clinical-risk-management-standardsdcb0129-and-dcb0160-supporting-information/ [S]
12. HTN. "National review opens to inform revision of digital clinical safety standards" (3 Jul 2026). https://htn.co.uk/2026/07/03/national-review-opens-to-inform-revision-of-digital-clinical-safety-standards/ [S]
13. NHS England Digital. *DCB0129: Clinical Risk Management: its Application in the Manufacture of Health IT Systems* (403 to automated fetch). https://digital.nhs.uk/data-and-information/information-standards/information-standards-and-data-collections-including-extractions/publications-and-notifications/standards-and-collections/dcb0129-clinical-risk-management-its-application-in-the-manufacture-of-health-it-systems [K]
14. Saudi Food and Drug Authority. *MDS-G008 Guidance on Medical Devices Classification*, v2.0 (13 Dec 2022). https://www.sfda.gov.sa/sites/default/files/2022-12/MDS%E2%80%93G008.pdf [V]
15. Saudi Food and Drug Authority. *MDS-G027 Guidance on Digital Health Products*, v1.0 (version date 10 Aug 2025; file posted Aug 2026). https://sfda.gov.sa/sites/default/files/2026-08/MDS-G027_0.pdf [V]
16. Saudi Food and Drug Authority. *MDS-G23 Guidance on Software as a Medical Device* (2020). https://www.sfda.gov.sa/sites/default/files/2020-03/MDS_G23.pdf [S, listed via search]
17. Saudi Food and Drug Authority. *MDS-G010 Guidance on AI/ML-based Medical Devices*. https://www.sfda.gov.sa/sites/default/files/2023-01/MDS-G010ML.pdf [S, listed via search]
18. National Law Review. "Code & Compliance: Decoding India's Medical Device Software Guidance" (on CDSCO final guidance CDSCO/MD/GD/MDSW/01/2026, 21 Jul 2026). https://natlawreview.com/article/code-compliance-decoding-indias-medical-device-software-guidance [S]
19. Nishith Desai Associates. "The Next Frontier in MedTech Regulation: Dissecting CDSCO's Draft Guidance on Medical Device Software" (draft of 21 Oct 2025). https://www.nishithdesai.com/default.aspx?id=15465 [S, search snippet]
20. Emirates Drug Establishment. Official website. https://www.ede.gov.ae/en [V]
21. RegDesk. "UAE Medical Device Regulatory Update: Transfer of Services from MOHAP to EDE." https://www.regdesk.co/blog/uae-medical-device-regulatory-update-transfer-of-services-from-mohap-to-ede/ [S, search snippet]
22. Health Sciences Authority (Singapore). *Medical devices guidance documents* (GL-04-R4 Dec 2025; GL-07-R2; GN-37-R1; GN-21-R7 Jul 2026; GL-10-R1 Aug 2026). https://www.hsa.gov.sg/medical-devices/guidance-documents [V]
23. Health Sciences Authority. *GL-07: Guidelines on Risk Classification of SaMD and Qualification of CDSS*, Revision 2 (21 Jul 2025). https://isomer-user-content.by.gov.sg/409/ae814059-a3ff-4ce3-8192-4534a43ddc6f/gl-07-r2-guidelines-risk-classification-samd-cdss-(2025-jul)-pub.pdf [V]
24. QuickBird Medical. "IEC 62304 Edition 2 has been delayed until October 2028" (10 Sep 2026). https://quickbirdmedical.com/en/news/iec-62304-edition-2-august-2026/ [S]
25. Johner Institute. "IEC 62304 2nd Edition: All Areas of Application and Changes." https://blog.johner-institute.com/iec-62304-medical-software/iec-62304-2nd-edition-all-areas-of-application-and-changes/ [S, search snippet]
26. InterSystems. *InterSystems IntelliCare EHR* (FAQ: "Class IIa Medical Device Regulation (MDR) certification"). https://www.intersystems.com/products/intellicare/ [V]
27. Cambio Group. *Compliance*. https://www.cambiogroup.com/compliance-eng/ [V]
28. BSI (NB 2797). *EU Quality Management System Certificate MDR 771804 R000 — Cambio Healthcare System AB* (Annex IX Ch. I and III; Cambio COSMIC EHR Class IIa, Cambio CDS Class IIa; 2024-08-13 to 2029-08-12). https://www.cambio.se/wp-content/uploads/2024/09/Cambio-MDR-certificate.pdf [V]
29. Better. *Certifications*. https://www.better.care/certifications/ [V]
30. Better. *Better Meds*. https://www.better.care/better-meds/ [V]
31. The Joint Commission and Coalition for Health AI. *The Responsible Use of AI in Healthcare (RUAIH)* (Sept 2025). https://digitalassets.jointcommission.org/api/public/content/dcfcf4f1a0cc45cdb526b3cb034c68c2 [V]
32. The Joint Commission. *Responsible Use of AI in Healthcare certification* (403 to automated fetch; details from the search index). https://www.jointcommission.org/en-us/certification/responsible-use-of-ai-in-healthcare [S]
33. NABH. *KareXpert Technologies* (Digital Health HIS/EMR certification listing: Advanced; EMR DH-EMR-A-2026-0014 and HIS DH-HIS-A-2026-0015 valid to 26 May 2028; WASA to 17 Sep 2026). https://nabh.co/software/karexpert-technologies/ [V]
34. NABH. *Digital Health Standards* (HIS/EMR Systems 1st ed. and test cases). https://nabh.co/digital-health-standards/ [V]
35. Nirmitee. "ABDM v3 API Migration Guide for Developers" and "Build an ABDM HIP (M2): V3 Reference Architecture Guide." https://nirmitee.io/blog/abdm-v3-api-migration-guide-everything-that-changed/ ; https://nirmitee.io/blog/building-abdm-hip-from-scratch-m2-flow-reference-architecture/ [S]
36. KLAS Research. *Data Archiving 2024: Examining the Complexity and Content of Archive Deployments*. https://klasresearch.com/report/data-archiving-2024-examining-the-complexity-and-content-of-archive-deployments/3345 [S, search snippet]
37. HIT Consultant. "What KLAS' May 2026 Brief Reveals About the Real ROI of Legacy Data Decommissioning" (20 May 2026). https://hitconsultant.net/2026/05/20/klas-2026-data-archiving-healthcare-it-insights/ [S, search snippet]
38. Harmony Healthcare IT. "How Health Systems Successfully Switched Legacy Data Archiving Partners." https://www.harmonyhit.com/resources/how-health-systems-successfully-switched-legacy-data-archiving-partners/ [S, vendor claim]

**Pack cross-references used:**
- 01: §3.5, §4, §5.5, §12
- 03: §1, §5.2, §7.5, §8.3, §21
- 04: §3.4–3.5, §5, §6.5–6.6, §11
- 06: §4.5–4.6, §7
- 07: §2.1–2.7, §3.3, §6.2, §8.2
- 08: §3.7, §4.4, §6.3, §10, §12.6, §14
- 09: §1.7–1.8, §2.1, §3, §5.3
- 10: §4.4–4.8, §10
- 11: §10, §15
