# 13 — Beachhead-Market Requirements Pack: India + Saudi Arabia + UAE

*Research date: 16 October 2026. This is research only; there is no code. It builds on and corrects 01-global-vendor-landscape.md, 05-revenue-cycle-erp-operations.md, 06-interoperability-standards.md, 07-security-privacy-regulation.md and 09-ai-analytics-digital-front-door.md. It maps the US-anchored safety requirements in 03-clinical-modules-and-workflows.md to local accreditation bodies, and closes the "NABL/NABH specifics" item left open in 04-diagnostics-pharmacy-devices.md.*

---

## 0. How to read this document

**Evidence tags**

| Tag | Meaning |
|---|---|
| **[V]** | Verified this session against a primary source: a regulator, a standards body, or an official implementation guide (IG) or PDF |
| **[S]** | A secondary source (law firm, consultancy, trade press), or a primary source seen only through a search-index summary |
| **[K]** | Background knowledge, not verified this session |
| **[E]** | Our estimate |
| **[U]** | Conflicting or unresolved |

**Cross-references.** "→06 §4.5" means section 4.5 of 06-interoperability-standards.md.

**Access limits this session.** Some sources could not be reached from the research environment:

- **Saudi Arabia.** Most government domains refused connections: chi.gov.sa, nphies.sa, nca.gov.sa, sdaia.gov.sa, cbahi.gov.sa and wasfaty.sa. The CHI-hosted NPHIES IG at portal.nphies.sa, sfda.gov.sa, moh.gov.sa and zatca.gov.sa were reachable.
- **India.** abdm.gov.in, nha.gov.in, sandbox.abdm.gov.in and nhcx.abdm.gov.in returned HTTP 403, and nrces.in refused connections. PIB, IRDAI, NABH, CDSCO and UIDAI were reachable.

Where a blocked body is cited, the evidence comes from documents it publishes elsewhere (the NPHIES IG, PIB backgrounders, NABH PDFs on S3) or from secondary sources, or the claim is tagged [K]. This is why Saudi rows carry more [K] tags than Indian or UAE rows.

**MVP tags used in the requirement matrix**

| Tag | Meaning |
|---|---|
| **L0** | Must exist at the first go-live in that market. Missing it is a legal or commercial blocker. |
| **L1** | Due within about 6 months of the first go-live, or before the second customer. |
| **L2** | Later, or optional. |

---

## 1. Executive summary

1. **NABH 6th edition (effective 1 Jan 2025) is the spec for an Indian HIS** [V,1].
   - Structure: 10 chapters, 100 standards and 639 objective elements (OEs). The OEs split into 105 Core, 457 Commitment, 60 Achievement and 17 Excellence.
   - Core OEs that translate directly into product features:
     - unique ID at registration (AAC.2.b) and two identifiers at every touchpoint (COP.1.b)
     - high-risk and look-alike/sound-alike (LASA) medicines (MOM.3.e)
     - reconciliation and verbal orders (MOM.4.e/f)
     - antimicrobial stewardship (IPC.2.f)
     - nine IMS Core OEs on record identity, integrity, security, retention and review
   - It also defines **32 general and 18 department KPIs**. NABH explicitly expects the HIS/EMR to compute their numerators and denominators, with manual entry as the fallback.
2. **The India certification that wins deals is NABH's HIS/EMR product certification** [V,5,6,7].
   - Scope: two levels (Basic and Advanced). There are 171 HIS OEs and 166 EMR OEs, spread across 8 chapters.
   - Hard prerequisites: ABDM **M1, M2 and M3** certificates, a valid **WASA** security audit, and **MoUs with 3 hospitals** running the version being certified.
   - Cost and timing: NABH fees run ₹50k–₹1.5 lakh. On top of that, a NABH-empanelled testing agency (NESTA) charges for 50–100 hours of testing. Non-conformities must be closed within 90 days, and the certificate is valid for 2 years.
   - 32 products are listed today, including KareXpert, Suvarna, Akhil Systems, MocDoc and eClinicalWorks India.
   - **Correction:** 06 attributed the "M3 plus three deployments" rule to the hospital Digital Health Standards. It actually belongs to this product certification.
3. **NABH Digital Health Standards, 2nd edition (Sep 2025), is a hospital-level standard** [V,3,4].
   - Structure: 8 chapters, 38 standards and 182 OEs, of which 17 are Core. Hospitals are rated Silver, Gold or Platinum.
   - Fees are ₹20k–₹1.25 lakh a year, and accreditation lasts 4 years.
   - Our product must let a customer hospital pass all 17 Core OEs without customisation.
4. **ABDM has reached real scale** [V,8].
   - More than 100 crore health records are linked to more than 90 crore ABHA accounts (May 2026).
   - 23.21 crore Scan & Share OPD tokens had been issued by 18 Jun 2026.
   - DHIS had paid hospitals ₹107+ crore and digital solution companies ₹26+ crore by the same date.
   - The last DHIS terms found (Corrigendum 6, Nov 2025–Mar 2026) pay a facility ₹20 per transaction above 100 a month and pay the software company ₹5 per linkage, with a ₹5 crore cap [S,11]. Whether DHIS continued after March 2026 is **unverified**.
5. **IRDAI master circular verified: Ref. IRDAI/HLT/CIR/PRO/84/5/2024, 29 May 2024** [V,12].
   - Cashless decisions are due within 1 hour, and final discharge authorisation within 3 hours. If the insurer is late, it pays any extra hospital charges from shareholders' funds.
   - Insurers and TPAs must collect claim documents from the hospital, not the patient.
   - Insurers, together with the Insurance Councils, "may endeavor to" onboard hospitals on NHCX. This is a soft instruction, not a mandate.
   - To join NHCX, a provider needs an HFR ID and ABDM M1 with WASA, must pass a Health Tech Committee (HTC) demo, and must complete sandbox certification [V,9]. An IRDAI panel recommended in Aug 2026 that NHCX be made mandatory for all insurers, TPAs and network hospitals [S,47].
6. **Abu Dhabi's ADHICS v2 is stricter than 07 assumed** [V,31]. It was published in May 2024, took effect in Aug 2024, and has a separate **"Service Provider" control category that applies to EMR vendors**, due within 6 months of onboarding. It requires all of the following:
   - cloud hosting inside the UAE, **including backup and DR**
   - **no remote support from outside the UAE**
   - access to PHI systems only for people physically in the UAE or licensed by DoH
   - no storage abroad of even **anonymised or encrypted** copies without DoH approval
   - encryption keys that are **not supplied by the cloud provider that hosts the application**

   **Consequence: a follow-the-sun global support model is not allowed for Abu Dhabi.**
7. **Abu Dhabi's HIE Data Standards 2026** [V,30] require an Emirates ID card reader integrated into every EMR and LIS, a chip read at every visit, and the legal name captured exactly as spelled in English on the Emirates ID.
   - Malaffi connection is a condition of licence renewal and of submitting Daman claims [V,27].
   - 3,144 of 3,147 signed facilities are connected [V,26], and 71 EMR products are listed as connected [V,28].
8. **Dubai DRG status** [V,37,38].
   - DHIC circular GC 06-2025 scheduled **IR-DRG grouper v3.5** and the **2024 ICD-10-CM/CPT/HCPCS** code sets for 1 Apr 2026.
   - **GC 02-2026 (17 Mar 2026) deferred both "until further notice"**, so the 2021 code sets remain mandatory.
   - Abu Dhabi's Mandatory Tariff V2025.1, applied from 1 Nov 2025, extends IR-DRG to inpatient and day-case encounters [S,36].
9. **UAE Federal Law 2/2019 verified** [V,40].
   - Art. 13 bars storing or processing UAE health data outside the UAE unless a Health Authority resolution allows it.
   - Art. 20 requires retention for at least 25 years after the last procedure.
   - Art. 24 sets a fine of AED 500k–700k for breaching Art. 13.
   - Separately, since 1 Jan 2025, employers must buy health insurance before residency permits for private-sector and domestic workers are issued or renewed. The basic plan costs AED 320 a year [V,41].
10. **NPHIES (Saudi Arabia) is FHIR R4 messaging** [V,15]. The IG (v1.0.0, Dec 2025) is derived from PDF IG v2.6. As of Oct 2025:
    - 6,600 regulated providers, 28 insurers and 8 TPAs connected, covering 14.1M insured people plus 18.8M+ visitors
    - 60+ software vendors onboarded
    - 96% of authorisations adjudicated within 30 minutes
    - SeHE (clinical) and SHIB (financial) merged into nphies

    We could not verify the vendor certification steps or the current SBS version [K].
11. **SFDA MDS-G27 (Aug 2025) states that EHR, HIS, decision-support and e-prescribing products are "in general" not medical devices** [V,19].
    - Only modules that analyse or interpret data for diagnosis or treatment need a Medical Device Marketing Authorization (MDMA). Examples: real-time CDSS alerts, a LIMS that suggests diagnoses, a scribe that proposes diagnoses.
    - **Only those modules are submitted.**
    - India's CDSCO software guidance takes a similar position (draft 21 Oct 2025; reportedly finalised in 2026) [S,14].
12. **Hosting snapshot (Oct 2026)** [V,21–23].
    - Saudi Arabia: Azure lists **no** public region. AWS has **announced** a Saudi region but not launched it. Google's Dammam region (`me-central2`) is sold only through **CNTXT**; it holds a CST Class C licence and has been assessed against NCA's ECC and CCC.
    - UAE: Azure UAE North and AWS `me-central-1`.
    - India: AWS Mumbai and Hyderabad, and Azure Central India, India South Central (Hyderabad), South India and West India.
13. **KFSHRC still appears to run Cerner/Oracle Health.** Millennium has been live since 2002, with a virtual upgrade around 2020 [S,25]. We found no evidence of a switch to Epic (consistent with 01).
14. **Verification backlog:**
    - CBAHI's current hospital edition [U]
    - NCA ECC-2/CCC-2 control text [K]
    - Wasfaty and SeHE integration specs [K]
    - ZATCA wave thresholds [K]
    - CGHS 2025 rates [K]
    - the HBP 2022 package count [K]
    - NHCX FHIR IG version [K]

    See §12.
15. **Launch order recommendation:**
    1. India first: ABDM M1–M3, NHCX, NABH HIS/EMR Advanced, and depth in TPA and GST handling.
    2. UAE second: private hospitals in Abu Dhabi and Dubai, through Malaffi, NABIDH, Shafafiya, eClaimLink and the ADHICS Service Provider controls.
    3. Saudi Arabia third, with a local partner: NPHIES, ZATCA and an in-Kingdom licensed cloud.

---

## 2. Corrections and confirmations to earlier documents

| Item | Earlier doc | Now | Evidence |
|---|---|---|---|
| IRDAI master circular reference | 05 §2.2: "reference varies" | **IRDAI/HLT/CIR/PRO/84/5/2024**, 29.05.2024. Subject: "Master Circular on IRDAI (Insurance Products) Regulations 2024 – Health Insurance". Insurers had to have 1-hour systems in place by 31 Jul 2024 | [V,12] |
| "NABH DHS needs M3 and 3 deployments" | 06 §4.5 | Applies to the **NABH HIS/EMR product certification**, not to the Digital Health Standards (DHS), which certify hospitals | [V,3,5,6] |
| Dubai IR-DRG version | 05: "not found" | v3.5 and 2024 code sets were scheduled for 1 Apr 2026, then **deferred indefinitely**. The previous documented upgrade was v3.3 (GC 05/2021) | [V,37,38,39] |
| ADHICS | 07 §1.5: [U] | **v2 verified** (DOH/SD/ICSO/ADHICS/V2/2024): tiers, a Service Provider category, and cloud residency and key-custody rules | [V,31,32] |
| UAE health-data localisation | 07: Art. 13 [V], penalty [V] | Confirmed against the English text, including the Art. 24 fine of AED 500k–700k | [V,40] |
| UAE federal mandatory insurance | 05: [K] | Verified: from 1 Jan 2025, insurance is a prerequisite for residency permits | [V,41] |
| NABH infection-control chapter | Scope listed "HIC" | Renamed **IPC (Infection Prevention and Control)** in the 6th edition | [V,1] |
| Saudi SaMD rules | 07 §2.5: [U] | **MDS-G27** (Aug 2025), together with G23 (SaMD), G10 (AI/ML) and G38 (pre-market cybersecurity) | [V,19,20] |
| Malaffi figures | 01, 06 | 3,144 of 3,147 facilities connected; 56,192 end-users with access; 100% of hospitals | [V,26] |
| KFSHRC platform | 01 (2015 evidence) | Also Cerner since 2002 with a virtual upgrade around 2020. No evidence of a switch | [S,25] |

---

## 3. India

### 3.1 NABH Hospital Accreditation Standards, 6th edition

The table below is reconstructed from NABH's summary table, which is misaligned in the PDF text layer. Each chapter's row was checked by summing its four category columns [V,1].

| Chapter | Standards | OEs | Core | Commitment | Achievement | Excellence |
|---|---|---|---|---|---|---|
| AAC: Access, Assessment and Continuity of Care | 13 | 87 | 6 | 68 | 9 | 4 |
| COP: Care of Patients | 20 | 135* | 13 | 107 | 12 | 4 |
| MOM: Management of Medication | 11 | 68 | 13 | 48 | 6 | 1 |
| PRE: Patient Rights and Education | 8 | 52 | 12 | 32 | 7 | 1 |
| IPC: Infection Prevention and Control (formerly HIC) | 8 | 49 | 13 | 33 | 3 | 0 |
| PSQ: Patient Safety and Quality Improvement | 7 | 46 | 8 | 28 | 7 | 3 |
| ROM: Responsibility of Management | 6 | 37 | 4 | 23 | 8 | 2 |
| FMS: Facility Management and Safety | 7 | 43 | 11 | 29 | 2 | 1 |
| HRM: Human Resource Management | 13 | 76 | 16 | 56 | 4 | 0 |
| IMS: Information Management System | 7 | 45 | 9 | 33 | 2 | 1 |
| **Total** | **100** | **639** | **105** | **457** | **60** | **17** |

\*NABH prints 135 for COP, but its category columns add up to 136, and the 639 total also implies 136.

**Decision rules** [V,1]:
- Every Core OE must score at least 4.
- At least 80% compliance on Commitment OEs at the final assessment.
- No standard may have more than one OE scoring 2 or below.
- Standard and chapter averages must each be at least 4.
- Accreditation lasts 4 years. Surveillance adds the Achievement OEs to the scoring; re-accreditation adds the Excellence OEs.
- The 6th edition adds annexures on medication errors, risk management, PROMs, PREMs and clinical audit.

**OEs that turn directly into HIS features** (crosswalk to the US-anchored list in 03 §7–9):

| OE (category) | Requirement (paraphrased) [V,1] | HIS feature | US analogue in 03 |
|---|---|---|---|
| AAC.2.b (Core) | Unique identification number generated at registration | UHID issued at the end of registration; merge and unmerge | Joint Commission (JC) NPSG.01 |
| COP.1.b (Core) | Uniform patient-identification process using at least two identifiers | Two-identifier prompts on orders, specimens, the medication administration record (MAR) and transfusion; wristband printing | NPSG.01.01.01 |
| AAC.5.a | Re-assessment, with documented effectiveness of the early warning system (new interpretation) | Early warning score (EWS) flowsheet, escalation and audit | Doc 03 §8.3 |
| AAC.6.f / g | Lab results within a defined time frame; critical results notified "at the earliest" | Turnaround-time (TAT) clocks by test; closed-loop critical-value log | NPSG.02.03.01 |
| AAC.7.a (Core) / f | Imaging complies with legal requirements; critical imaging results notified immediately | PCPNDT gate on obstetric ultrasound (USG) (§3.10); critical-findings loop | ACR critical findings (04 §4.5) |
| COP.2.c (Core) | Emergency care "in consonance with statutory requirements including medico-legal cases" | Medico-legal case (MLC) register and police-intimation workflow (§3.10) | No direct analogue |
| MOM.3.c / e (Core) | Defined high-risk medication list; high-risk and LASA medicines handled safely | High-alert and LASA flags; Tall Man lettering; storage alerts | ISMP lists (03 §9.4) |
| MOM.4.e / f (Core) | Reconciliation at transition points; safe handling of verbal orders | Reconciliation at admission, transfer and discharge; read-back and countersign timers | NPSG.03.06.01 |
| MOM.9 | Narcotics, chemotherapy and radiopharmaceuticals used, prescribed and stored safely | Controlled-substance registers; dual sign-off | DEA analogue (03 §9.5) |
| IPC.2.f (Core) | Antimicrobial stewardship implemented and use monitored | Restricted-antimicrobial approval; days-of-therapy (DOT) and defined-daily-dose (DDD) dashboards | CMS stewardship |
| PRE.4 (Core c, e) | Informed consent covers risks and alternatives and is taken by the person performing the procedure | eConsent tied to the procedure order and the performing clinician | — |
| PRE.6 (a Core; b–d) | Pricing policy explained; tariff list available; expected costs explained, including when the care plan changes | Estimate engine; re-estimate on a change of plan (§3.11) | US price transparency (05 §1.3) |
| IMS.3.a/c, IMS.5.a–c, IMS.6.a/b, IMS.7.a (Core) | Unique medical-record ID; complete, chronological record; confidentiality, integrity and security; document control and retention; periodic record review | Append-only signed record; audit trail; retention engine; record-review sampling tool | ONC (b)(10) / HIPAA |
| IMS.3.e–g | Entries signed, dated and timed; author identifiable; authorised abbreviations only | e-signatures; abbreviation blocklist | Doc 11 §6.1 |
| IMS.1.e (Achievement) / h (Excellence) | IT contingency plan; use of digital health technology | Downtime viewer; offline mode (08 §6.3) | SAFER guides |

**KPIs** [V,1]:
- **32 general KPIs**, under PSQ.3a–d. Examples:
  - time to initial assessment
  - CLABSI, CAUTI and VAP rates using CDC/NHSN definitions
  - return to ICU within 48 hours
  - mortality ratio adjusted with APACHE, SOFA, SAPS or MPM
  - needlestick injuries per 1,000 occupied-bed days
  - blood-component turnaround time
  - OPD waiting time
  - emergency-medicine stock-outs
  - handover documentation
  - prescription-audit compliance
- **18 department-specific KPIs**, for example hypoglycaemia below 54 mg/dl, stroke door-to-needle time, contrast reactions and triage time.
- Reporting is monthly and cumulative year to date.
- NABH's guidance explains how each indicator "could be captured from the system (HIS/EMR)". Where the system cannot collate the data, it should "at a minimum… have a provision for manual entry of the numerator and denominator". This is a direct requirement on the measure engine in 09 §6.

### 3.2 NABH Digital Health Standards for Hospitals, 2nd edition (Sep 2025)

| Chapter | Standards | OEs | Core |
|---|---|---|---|
| AAC | 8 | 40 | 3 |
| COP | 9 | 41 | 0 |
| MOM | 4 | 13 | 2 |
| DIS: Digital Infrastructure | 2 | 14 | 2 |
| DOM: Digital Operations Management | 6 | 25 | 6 |
| FPM: Finance and Procurement Management | 3 | 17 | 3 |
| HRM | 4 | 14 | 0 |
| IMS | 2 | 18 | 1 |
| **Total** | **38** | **182** | **17** (plus 57 Commitment, 53 Achievement, 55 Excellence) |

**The 17 Core OEs are the minimum digital surface for any Indian hospital customer** [V,3]:

| Area | Core OEs |
|---|---|
| AAC | Digital unique hospital ID, with or without ABHA; every record linked to that ID; a digital unique sample ID traceable to the patient |
| MOM | Digital drug list at each location, updated on use and on replenishment; digital stock checklists |
| DIS | Power backup for digital systems; active anti-virus |
| DOM | An IT policy, reviewed periodically; continuous vendor support and updates; digital archive and retrieval; digital management of end-user credentials; digital restriction of transfers to external storage |
| FPM | Digital recording of quality concerns about purchased assets; digital patient payments; predefined charges for all key services |
| IMS | A defined IT budget |

**Levels, ABDM links and fees** [V,3,4]:

- **Pass thresholds at first award:**

  | Level | Core | Commitment | Achievement | Excellence |
  |---|---|---|---|---|
  | Silver | 100% | 60% | – | – |
  | Gold | 100% | 60% | 60% | – |
  | Platinum | 100% | 60% | 60% | 60% |

  At surveillance (24 months) the Commitment and Achievement thresholds rise to 80%.
- **ABDM-linked Excellence and Achievement OEs:** lab reports, radiology reports and images, and discharge summaries linked to the patient's ABHA; patients' external records accessible through ABHA; use of HFR and HPR.
- **Fees:** ₹20k–₹1.25 lakh a year by bed band and level, plus an application fee of ₹10k–₹30k, plus 18% GST.
- **Validity and follow-on:** 4 years. In year 3, a hospital that is not already accredited must apply for a main NABH programme (Hospital, SHCO, Dental, AYUSH or Eye Care).

### 3.3 NABH certification of HIS/EMR products (the vendor certification)

| Attribute | Detail [V,5,6,7] |
|---|---|
| Standard | NABH Standards for HIS and EMR Systems V12.1 (14 Sep 2024), released 17 Sep 2024. Registration opened 1 Dec 2024; testing started 15 Jan 2025 |
| Chapters | AAC, COP, MOM, DAC (Digital Application Control), DOM, FPM, HRM, IMS |
| OEs | **HIS: 171** (51 Core, 78 Commitment, 27 Achievement, 15 Excellence). **EMR: 166** (49 / 69 / 28 / 20). 106 technical OEs are common to both |
| Levels and pass marks | **Base:** Core 100%, Commitment 60%, Achievement 30%. **Advanced:** Core 100%, Commitment 80%, Achievement 60%, Excellence 60% (FAQ figures; the brochure table renders inconsistently) |
| Prerequisites | (1) ABDM **M1, M2 and M3** certificates (M1 alone does not qualify). (2) A valid **WASA** certificate. (3) **MoUs with 3 hospitals** using the version being certified. Vendors may test before M3 is complete, but the certificate is issued only after it |
| Testing | NABH assigns 3 empanelled testing agencies (NESTAs). The vendor negotiates with them and picks one. Testing runs on NABH's Software Assessment portal against NABH's published test cases and takes about **50–100 hours**. A NABH Software Assessor validates the results and the Technical Committee decides |
| Non-conformities | Must be resolved within **90 days**. One re-test round is included in the testing agency's statement of work |
| Validity | **2 years**. No surveillance audits; only "focus assessments" for added scope. Changes to Core functions must be notified to NABH. Certification is per product version |
| Fees (NABH only, plus 18% GST; testing is extra) | Basic: HIS ₹50k, EMR ₹50k, both ₹75k. Advanced: HIS ₹1 lakh, EMR ₹1 lakh, both ₹1.5 lakh |
| International vendors | Eligible if they meet the three prerequisites. IST timestamps are acceptable for international teleconsultations |
| Incentives | None from NABH. (Earlier DHIS terms gave NABH/QCI-certified software companies a 20% bonus [S,10]) |
| Market signal | 32 listings, including 17 "HIS and EMR – Advanced" (KareXpert, Suvarna, Akhil, MocDoc, Medixcel, eClinicalWorks India, TrioTree and others) plus clinic-management-system products (HealthPlix, Eka Care) |

**Lead time** [E]:
- ABDM M1–M3 takes 3–6 months (→06 §4.5).
- Then 3 live hospitals are needed, which is a chicken-and-egg problem.
- Then testing and closing non-conformities takes 2–4 months.
- In total, NABH Advanced realistically arrives **9–15 months after the first Indian pilot**.

### 3.4 Laboratories and premium hospitals: NABL and JCI

- **NABL 112** sets NABL's specific criteria on top of ISO 15189:2022 [K]. Its companion guidance document NABL 112B was issued as Issue 01 on 18 Dec 2024, with Amendment 01 on 4 Nov 2025 [S]. The ISO 15189:2012 → 2022 transition deadline has passed (→04 §2.11).
- LIS features NABL assessors look for [K]:
  - critical-value communication logs
  - TAT per test
  - Westgard quality-control rules with corrective-action records
  - proficiency testing (PT/EQAS) records
  - a sample-rejection register
  - an audit trail for amended reports
  - the NABL symbol printed only on results inside the accredited scope (this needs a per-test scope flag)
- **JCI 8th edition** (effective 1 Jan 2025 [K]) matters for premium and medical-tourism hospitals. Its International Patient Safety Goals map onto the US-style features already in 03, so no extra build is needed beyond configuration [K].

### 3.5 ABDM (V3 APIs)

- **Integration path** (→06 §4.5; confirmed in principle by [V,8]):
  1. Sandbox
  2. M1: ABHA creation and verification, Scan & Share
  3. M2: act as a Health Information Provider (HIP), linking care contexts and sending FHIR bundles
  4. M3: act as a Health Information User (HIU), raising consent requests and then fetching, decrypting and purging data
  5. Functional testing
  6. WASA / safe-to-host audit by a CERT-In-empanelled auditor
  7. HTC demo
  8. Production credentials, with the bridge registered in HFR

  PIB confirms that every new application "must first be tested in a sandbox… [and] pass a security audit before going live" [V,8].
- **Scale (PIB, 6 Jul 2026)** [V,8]:
  - more than 100 crore records linked to more than 90 crore ABHA accounts
  - 23.21 crore Scan & Share tokens; an IIHMR study found waits fell from about 1 hour to 2–5 minutes
  - five live UHI services
  - **Aarogya Setu 2.0** (launched 29 Jun 2026) is now the national PHR app. It shows each patient's **PM-JAY wallet and private insurance through NHCX**, so patients will arrive knowing their coverage.
- **Low-end competitor:** the government's free **eSushrut@Clinic** HMIS (C-DAC) is aimed at small clinics and had more than 2,200 facilities onboarded [V,8]. Do not compete for single-doctor clinics.
- **AI policy:** **SAHI** (an AI strategy for health) and **BODH** (a federated benchmarking platform) were launched in Feb 2026 [V,8]. They should feed our AI governance artefacts (→09 §5).
- **DHIS (Digital Health Incentive Scheme)**:

  | Term | Original (from 1 Jan 2023) [S,10] | Corrigendum 6 (Nov 2025–Mar 2026) [S,11] |
  |---|---|---|
  | Hospital | ₹20 per transaction above a base of 50 per bed per month | ₹20 per eligible transaction above 100 a month |
  | Digital solution company (DSC) | 25% of what its eligible facilities earn; ₹5 per transaction for other facilities (more than 200 a month); +20% if NABH/QCI-certified; at least 10 active facilities | ₹5 per record linkage, reported to ABDM by API; still at least 10 facilities |
  | Sharing | — | ₹10 to the HIU and ₹5 to the HIP for each successful share |
  | Cap | ₹4 crore | ₹5 crore per facility or DSC; counted once a day and at most five times a month per ABHA |
  | Paid to 18 Jun 2026 [V,8] | Hospitals ₹107+ crore; labs and pharmacies ₹2.95 crore; DSCs ₹26+ crore | |

### 3.6 NHCX (National Health Claims Exchange)

- **Provider onboarding** [V,9]:
  1. Create an HFR ID and become ABDM M1-compliant: sandbox, M1 integration, functional testing and WASA, HTC demo, M1 go-live.
  2. Request NHCX sandbox access, choose the payer or provider role, register and generate a participant ID, then build the integration.
  3. Internal demo, including FHIR bundle validation.
  4. HTC demo before NHA, TCS, NRCeS and GIC.
  5. NHCX sandbox certification.
  6. Production role assignment, using the same client ID and secret as ABDM M1 production.
- **Use cases** [V,9]: coverage eligibility, pre-determination, pre-authorisation, claim submission, communication request, payment notice and reprocess.
- **Profiles:** the NRCeS NHCX IG (CoverageEligibilityRequest/Response, Claim, ClaimResponse, Communication, PaymentNotice and Task, carried in encrypted HCX envelopes) was **unreachable this session** [K].
- **Status:**
  - 34 insurers and TPAs were live in Jul 2024 [S].
  - PM-JAY claims still run in NHA's Transaction Management System (TMS 2.0). NHCX-PMJAY-HMIS documents in the sandbox indicate that hospitals will raise PM-JAY cases from their own HMIS [S,47].
  - An IRDAI panel recommended mandatory NHCX integration plus standard price bands (Aug 2026) [S,47].

### 3.7 Government and quasi-government schemes

| Scheme | What the HIS must support | Tag |
|---|---|---|
| **PM-JAY** (₹5 lakh per family per year; extended in 2024 to everyone aged 70+, "Ayushman Vay Vandana") | Beneficiary identification (Aadhaar e-KYC); package master from HBP 2022 (about 1,900+ procedures); pre-auth with mandatory documents and photos; package billing with implants and stratification; claim and query cycles in TMS, moving to NHCX from the HMIS; HEM empanelment data; incentive uplift for NABH-accredited hospitals | [S,48] [K] |
| State schemes (MJPJAY in Maharashtra, Aarogyasri in AP and Telangana, CMCHIS in Tamil Nadu, and others) | Separate package masters, portals and pre-auth rules; many are converged with PM-JAY on the same TMS | [K] |
| **CGHS** | Credit billing for beneficiaries with a referral and permission letter; city-wise rate masters with NABH and non-NABH differentials; package rules; bill submission through the CGHS bill portal; rates revised in 2025 (verify) | [K] |
| **ECHS / ESIC** | Referral-based credit billing at CGHS-linked rates; scheme-specific portals and claims | [K] |

**Design rule:** build one "scheme" abstraction, holding package master, eligibility check, pre-auth workflow, document checklist, claim format and rate master. Then plug each scheme in as configuration, not as a code fork (→05 §2.1).

### 3.8 Private insurance: the TPA cashless state machine

The states below come from the IRDAI rules [V,12] and common TPA practice [K]:

```
Intimation → PreAuthRequested(docs, ICD-10, proposed procedure, estimate, room category)
  → [Query ⇄ QueryResponse]*  (SLA clock pauses on query)
  → PreAuthApproved(amount, room-rent cap, co-pay, sub-limits)       (decision ≤ 1 h of request)
  → [EnhancementRequested → EnhancementApproved]*
  → DischargeAuthRequested(final bill, discharge summary, investigations, pharmacy returns)
  → FinalApproved(payer-payable, deductions, patient-payable)         (≤ 3 h; insurer bears delay cost)
  → ClaimDocsSubmitted (physical/e-docs; NHCX Claim)
  → Settled(UTR, TDS) | PartiallySettled(deduction reasons) | Denied(CRC-approved, reasons)
  → Reconciliation/Appeal
```

**Billing implications:**
- Every line on the running bill carries **payer-payable and patient-payable** splits and a **"non-payable" flag**, based on the IRDAI list of excluded consumables [K].
- The bill handles **room-rent eligibility**. When a patient chooses a room above the policy's cap, the **proportionate deduction** applies only to the item categories it may legally cover; IRDAI's 2020 product guidelines exclude pharmacy, implants and diagnostics [K].
- Co-pay and sub-limits.
- Network package rates, such as GIPSA PPN rates for public-sector insurers [K].
- Every pre-auth and discharge request starts SLA timers with escalations to the insurance desk.
- Deduction reason codes feed denial analytics (→05 §1.8).

### 3.9 GST and e-invoicing

| Rule | Detail | Tag |
|---|---|---|
| Healthcare services by clinical establishments | Exempt | [K] |
| Room rent (non-ICU) above ₹5,000 a day | **5% GST without input tax credit (ITC)** on the whole room charge, under Notification 04/2022-CT(R) from 18 Jul 2022. ICU, CCU, ICCU and NICU are exempt. No source reports a change in the Sep 2025 rate rationalisation | [S,13] |
| Medicines and devices sold over the counter or to outpatients | Most moved to **5%**, and some life-saving drugs to 0%, from 22 Sep 2025. Requires HSN-wise tax rates on pharmacy lines | [S,13] |
| Health insurance premiums | Exempt from 22 Sep 2025, which affects packaged and insured products | [S] |
| e-Invoice (IRN and QR) | Required for B2B taxable supplies when aggregate annual turnover exceeds ₹5 crore (Aug 2023). For hospitals this mainly covers corporate and B2B billing and taxable ancillary services | [K] |

**Requirement:** a line-level tax engine keyed on:
- SAC/HSN code
- patient type: OP, IP or day care
- room category and daily rate (the threshold is tested per day)
- whether ITC may be claimed

It must also produce GSTR-1 and GSTR-3B extracts and a Tally voucher export (§3.11).

### 3.10 Privacy and statutory registers

**Privacy** (→07 §1.4):
- **DPDP Rules:** Consent Manager registration opens on **13 Nov 2026**, four weeks from today. The main obligations, including 72-hour breach detail and one-year log retention, apply from **13 May 2027**.
- **CERT-In:** incidents must be reported within 6 hours; ICT logs must be kept for 180 days in India; clocks must be synchronised to NIC/NPL NTP servers.
- **Aadhaar:** if the Aadhaar number is stored, it goes in an HSM-backed Aadhaar Data Vault and is masked on screen [U, 07].

| Statutory duty | What the HIS must do | Tag |
|---|---|---|
| **Medico-legal cases (MLC)** (BNSS replaced the CrPC from 1 Jul 2024; NABH COP.2.c Core) | Flag MLC at ED triage. Keep a serial MLC register. Run a police-intimation workflow with a time stamp and the name and badge of the officer informed. Lock the MLC record (no edits; addenda only). Print the injury report. Follow free-treatment rules for victims of acid attacks and sexual assault | [V,1] [K] |
| **PCPNDT Act** | Every obstetric ultrasound needs an online **Form F**, with declarations by the doctor and the patient. The ultrasound order cannot be completed until Form F is done. Keep records for 2 years and file monthly reports with the Appropriate Authority. Never record or display fetal sex | [K] |
| **MTP Act** (amended 2021) | Opinion forms, admission register and monthly statement under the MTP Regulations. Strict confidentiality, with a restricted record and limited access | [K] |
| **Drugs & Cosmetics Rules** | **Schedule H1 register**: prescriber, patient, drug and quantity, kept for 3 years. Schedule X: separate records and duplicate prescriptions. Batch, expiry and MRP enforcement | [K] |
| **NDPS** (NABH MOM.9) | Recognised Medical Institution registration; receipt and consumption registers for essential narcotic drugs; dual sign-off on wastage | [V,1] [K] |
| **Bio-Medical Waste Rules 2016** (NABH IPC Core) | Bar-coded bags and containers; daily weights by category; annual report to the State Pollution Control Board (Form IV) | [V,1] [K] |
| **Registration of births and deaths** (RBD Amendment Act 2023, from 1 Oct 2023) | Report births and deaths to the Civil Registration System (CRS) within 21 days; MCCD cause-of-death certificate. A death certificate must be in the record (NABH IMS.4.g) | [V,1] [K] |
| **IDSP/IHIP and Nikshay** | Notifiable-disease reporting in IHIP formats (state-specific lists); mandatory TB notification to Nikshay by private providers | [K] |
| **Telemedicine Practice Guidelines 2020** (NABH COP: telemedicine "safely and securely") | Verify the patient's identity; record consent; check the practitioner's registration number; enforce the restricted-drug lists in teleconsult prescriptions; retain records | [V,1] [K] |
| Mental Healthcare Act 2017; THOTA (organ transplant) | Advance directives, nominated representative and restraint reporting; organ-transplant registry reporting | [K] |

### 3.11 India operations and end-to-end private-hospital workflows

**OPD (high-volume, pay-first):**
1. Walk-in or appointment.
2. Scan & Share QR or a desk registration creates a UHID and a token, with ABHA verified or created.
3. **Collect the consultation fee first**, or post-pay for corporate and TPA patients.
4. Doctor-wise queue display and SMS/WhatsApp alerts.
5. Vitals.
6. Consultation with an e-prescription (brand or generic), orders and a printed Hindi/regional-language prescription.
7. **Collect payment for investigations before sample collection**, using UPI dynamic QR or a card POS terminal.
8. Lab and radiology.
9. OP pharmacy sale with batch, expiry and MRP checks, an HSN-wise GST invoice and the Schedule H1 register.
10. A **free revisit window** (configurable per doctor and department).
11. ABDM M2 care-context link for the OPConsultNote, Prescription and DiagnosticReport bundles.

**IPD:**
1. Admission request.
2. **Estimate** by package or itemised, by room category (PRE.6).
3. **Admission deposit.**
4. Bed allocated by class. The room class acts as a **tariff multiplier** on many charges [K].
5. TPA pre-auth or scheme pre-auth.
6. **Daily running bill**, with deposit-top-up alerts against estimate burn.
7. Package billing: inclusions, exclusions and over-package items.
8. Enhancements.
9. Discharge initiation: discharge summary, pharmacy returns, and department "no-dues" clearance from nursing, pharmacy, lab and billing.
10. Final bill.
11. TPA final approval within 3 hours.
12. Collect the patient share, issue the refund or adjust the deposit, and issue the gate pass.
13. Claim dispatch and settlement reconciliation.
14. ABDM DischargeSummary link.

**Doctor payouts:**
- Model types: fixed retainer, fee-for-service share (for example a percentage of the consultation or procedure fee), and hybrids. Payouts are computed on **collected** revenue, net of TPA deductions.
- TDS at 10% on professional fees under s.194J; payout statements [K].
- **Referral fees:** the Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations 2002 forbid doctors from giving or receiving rebates or commissions. The NMC's 2023 replacement regulations were put in abeyance, so the 2002 code still applies [K]. The product should:
  - **track referral sources for analytics only**, and
  - **not ship a "referral commission to doctor" payout feature**.

  Arrangements between institutions (for example corporate tie-ups) can be modelled as contracts.

**Payments and finance:**
- UPI dynamic QR on every bill, reconciled through payment-aggregator webhooks.
- Integrated card POS terminals.
- NEFT for corporate payers.
- Daily cash and UPI closure per counter.
- **Tally Prime export** of sales, receipts, journals and GST ledgers as XML vouchers. This is a must-have for Indian hospital finance teams [K].

**Language:** patient-facing outputs (prescription, consent, estimate, discharge summary, SMS) in Hindi plus the state language. The clinical UI can stay in English [K]. NABH DHS also suggests displaying patient information in the local language [V,3].

---

## 4. Saudi Arabia

### 4.1 NPHIES (financial)

What the IG confirms [V,15,16,17]:
- **Architecture:** NPHIES is a centralised gateway that validates messages and **does not adjudicate**. It uses FHIR R4 messaging. Invalid submissions are rejected; valid ones are delivered in real time or stored until the recipient is available.
- **Lineage:** the NPHIES Healthcare Financial Services IG v1.0.0 (dated 3 Dec 2025) is based on PDF IG v2.6. It excludes the fraud-reporting and prescription-authorisation use cases, which stay in the PDF documentation on the portal.
- **Use cases:**
  - eligibility
  - prior and advanced authorisation
  - claims and batch claims
  - payment reconciliation and payment notice
  - information submission and request (communication)
  - cancellation and error notice
  - polling and status check
- **Deviations from the FHIR base:**
  - proprietary missing-data reason codes in `Claim.supportingInfo` for weight, blood pressure, height and temperature
  - practitioner identifier type "PRN" accepted (with "MD" to be phased out)
  - SNOMED body-site codes
  - `Coding.display` lengthened to 500 characters
- **Code systems in the artefacts:**
  - ICD-10-AM
  - institutional, dental and pharmacy claim types
  - FDI tooth and surface codes
  - "Scientific codes" for medications
  - services codes
  - diagnosis-on-admission and discharge-disposition value sets
- **Market (Oct 2025):** 6,600 regulated providers, 28 insurers, 8 TPAs, 14.1M+ people with employer insurance and 18.8M+ with visitor insurance. About 18,000 provider organisations in total are entitled to connect. KPIs: 6,419+ facilities and 60+ software vendors onboarded; 98% claims market share; 96% of authorisations adjudicated within 30 minutes.
- **Volumes:** 143M transactions (2023), 292M (2024), 96M in Q1 2025.
- **Scope:** NPHIES merges CHI's SHIB (financial) and MOH's SeHE (clinical). The public health system has joined and is adding providers as it moves toward a national-insurer model.

**Not verified:**
- vendor onboarding and certification steps (registration, test cases, PKI certificates, go-live approval)
- the currently mandated SBS version (06 notes that a non-conforming SBS version loses access [S])

Both are **[K]**. Budget **2–4 months** for NPHIES vendor certification [E].

### 4.2 Coding, DRG and licensing

| Item | Status | Tag |
|---|---|---|
| Diagnoses | ICD-10-AM | [V,17] |
| Procedures | SBS, an extension of ACHI codes. Third-party sources describe a 7-digit ACHI root plus a 2-digit extension | [S,44] |
| ICD-10-AM edition | Australia has used the 13th edition since 1 Jul 2025 [S,43]. The Saudi edition in force was not verified | [U] |
| AR-DRG | v9 for reporting admitted care; private payment still at shadow-billing stage, with full rollout expected around 2028 (an analyst estimate) | [S,44] (→05) |
| Licensing | The government holds the IHACPA country licence. Vendors need an IHACPA Electronic Code List (ECL) licence (→06 §5) | [S] |

### 4.3 National platforms

| Platform | Role | What the HIS must do | Tag |
|---|---|---|---|
| **Seha Virtual Hospital (SVH)** | Supports 242+ hospitals in 48 specialties and 68 sub-specialties: virtual ICU, telestroke, virtual MDTs, teleradiology, remote EEG, home monitoring, and consultations through 937 and Sehhaty | Provide referral and consult interfaces and accept tele-ICU documentation; integration method not published | [V,18] |
| **Sehhaty** | MOH patient app: appointments, records, sick leave, virtual consultations | Exchange appointments and results through national interfaces; do not build a competing app | [V,18] [K] |
| **SeHE / NHIC** | Clinical HIE (now under the nphies umbrella) | Push documents to the unified record; specifications unpublished | [V,15] [K] |
| **Wasfaty** | National e-prescribing; MOH prescriptions dispensed by community pharmacies | Transmit outpatient prescriptions through Wasfaty interfaces with SFDA drug codes and receive dispense status | [K] |
| **SFDA RSD (track and trace)** | GTIN-serialised dispensing reported by pharmacies | Scan the 2D DataMatrix at dispense and report to RSD | [K] |
| **Nafath / Yakeen / Absher** | National digital ID and SSO (Nafath); identity and demographic verification (Yakeen, operated by Elm) | Verify identity at registration. Citizens' ID data often carries a **Hijri date of birth** | [K] |

### 4.4 ZATCA e-invoicing (Fatoora)

- **Phases:** Phase 1 started on 4 Dec 2021. Phase 2 (integration) started on 1 Jan 2023 and is rolled out to taxpayers in waves, with **at least 6 months' notice** [V,46].
- **Technical model** [K]:
  - UBL 2.1 XML invoices
  - a cryptographic stamp issued under a ZATCA certificate (CSID)
  - a QR code
  - standard (B2B) invoices must be **cleared** by ZATCA before they are shared
  - simplified (B2C) invoices are **reported** within 24 hours
- **Exposure:** hospitals are large taxpayers and will already be in an integration wave. Our billing must issue Phase 2-compliant invoices for patient shares and payer invoices from day one.
- **VAT** is 15%. Private healthcare for Saudi citizens has special treatment, with the State bearing the VAT [K]. This needs a tax rule driven by the patient's nationality.

### 4.5 Privacy, cybersecurity and residency

- **PDPL** (→07 §1.5):
  - Health data is sensitive.
  - Organisations need a DPO and registration on the national platform.
  - Breaches must be notified within 72 hours.
  - Transfers abroad need adequacy or appropriate safeguards and must be limited to the minimum necessary [S,24]. The 2024 amendments to the transfer regulation add SCCs, BCRs and risk assessments [K].
- **NCA ECC (2024 revision) and CCC (2024)**: mandatory for government bodies and critical national infrastructure, and imposed on private hospitals and suppliers through contracts [K].
- **CST Cloud Computing Regulatory Framework**: cloud providers are registered or licensed by class. Google's Dammam region holds a Class C licence covering Qualifying and Classes A, B and C, and was assessed against ECC and CCC [V,21].
- **Practical rule:** host all Saudi PHI in the Kingdom on a CST-licensed provider [K] (→07 §1.9).
- **Hosting options:**

  | Option | Status (Oct 2026) | Tag |
  |---|---|---|
  | Google Cloud `me-central2` | Live. Saudi-billed customers must buy through **CNTXT**. Offers "Sovereign Controls by CNTXT" (managed external key manager, Key Access Justifications, local support) and a "KSA Data Boundary" package for non-Saudi organisations | [V,21] |
  | Azure | Not live; no Saudi region in Microsoft's 13 Oct 2026 list | [V,22] |
  | AWS | Announced, not launched | [V,23] |
  | Oracle (Jeddah, Riyadh), stc/center3, local and sovereign providers | Available | [K] |

### 4.6 CBAHI

- **What we could find:** the 3rd-edition hospital standards and the Oct 2016 accreditation guide. That guide makes **Management of Information (MOI)** and **Medical Records (MR)** mandatory chapters, along with Leadership, HR and Quality and Patient Safety (QM). It also requires a records-review committee that samples about 5% of records each quarter [S,45].
- **Not resolved:** whether a 4th edition is in force [U]. Its IT expectations should be assumed to follow JCI patterns: patient identification, medication management, record completeness, and information-security policy.
- **Action:** buy the current CBAHI manual and map it to our OE engine (§11, point 3).

### 4.7 SFDA and software regulation

**MDS-G27, Guidance on Digital Health Products (v1.0, 11 Aug 2025)** [V,19]:
- **HIT that is not a device:** EHR, HIS, decision-support systems and e-prescribing software, "in general". Also any software intended "solely for administrative or communication support", including scheduling, admission, billing, pharmacy dispensing, and prescribing software that does not make clinical decisions. Also software that only stores, transfers, converts or displays data.
- **HIT that is a device:**
  - a LIMS that automatically interprets results and suggests diagnoses
  - a **CDSS that monitors data in real time and generates alerts** for abnormal conditions
  - a voice scribe that generates **diagnostic suggestions**
- **Modular rule:** "Only the modules that independently qualify as medical devices are subject to regulatory oversight." The other modules are excluded if their separation is documented.
- **Pathway:** MDMA under MDS-REQ 1, together with:
  - MDS-G23 (SaMD)
  - MDS-G10 (AI/ML, v1.0 dated 29 Nov 2022 [V,20])
  - MDS-G38 (pre-market cybersecurity)

**Implication:** keep sepsis or deterioration alerting, AI coding suggestions with diagnostic output, and similar features in separately versioned and documented modules (→07 §2.7, →09 §2.6).

### 4.8 Procurement and market access

**Buyers** [K]:
- Public care has moved to **Health Holding Company** clusters, about 20 of them (→01 §4).
- Large private groups and Black Book's scorecard both put **NPHIES and SeHE capability** first.

**Government bid requirements** [K]:
- **LCGPA** local-content requirements and price preference
- **Regional HQ** rules: from 1 Jan 2024, government contracts generally require a regional HQ in the Kingdom
- **Nitaqat** Saudisation quotas for the local entity

**Reference sites** (→01 §4):
- KFSHRC: Cerner/Oracle [S,25]
- JHAH and KFMC: Epic
- Alrajhi Medicine: Oracle EHR plus ERP
- Care Med: ezCaretech, about US$5k per bed [E] (→01)

**Recommendation:** enter through a Saudi partner that already has NPHIES certification and CST-licensed hosting.

---

## 5. United Arab Emirates

### 5.1 Abu Dhabi (Department of Health, DoH)

**Malaffi (the HIE)**
- Who must connect [V,27]: hospitals, clinics, pharmacies, diagnostic centres, home care and telemedicine providers, among others. Military and some other facility types are exempt. Facilities with only a preliminary licence must connect **before** their active licence is issued; Malaffi recommends starting about 2 months ahead.
- Onboarding steps [V,27]:
  1. Accession agreement and facility declaration.
  2. **Malaffi security assessment** (an excerpt of the DoH ADHICS survey).
  3. An **HL7-capable EMR**.
  4. Etisalat SD-WAN with a no-objection certificate from Malaffi.
- Consequences of not connecting: no licence renewal, and no Daman claims [V,27].
- Specifications: real-time HL7 message specifications (general, pharmacy and reference-lab variants), participation criteria and the participant agreement. All are on request only [V,29].
- Vendor listing: a vendor is "connected" once it has **one client connected** and has met the interoperability requirements. This listing is not DoH certification [V,28].
- Connected vendors include Cerner, Epic, TrakCare, Dedalus, Napier, Insta Practo, Akhil Systems and Microsoft Dynamics 365 [V,28].

**HIE policy** (DOH/POL/STR/HIE/1.1/2020, effective 16 Apr 2020) [V,33]:
- Facilities must include specific **Malaffi consent wording** in their standard consent forms.
- DoH **mandates sharing even where consent is unavailable**.
- Emergency "break the seal" access is allowed for qualified conditions.
- Access must be removed within 24 hours of a request.
- Interoperability standards: HL7 v2.x/v3, NCPDP SCRIPT, SNOMED and XML.

**HIE Data Standards 2026** [V,30]. Each standard has a 6-month implementation window from the date of the circular.

| Standard | Requirement |
|---|---|
| 1. Patient identifier | **Emirates ID (EID) card reader integrated with every EMR and LIS.** A "mandatory physical swipe or digital reading of the original chip… at every visit". The EID number is 15 digits; passport for visitors |
| 2. Patient name | Multi-field legal name exactly as the **English spelling on the EID or passport**; no titles or nicknames |
| 3. Date of birth | Released |
| 4. Nationality | Released |
| 5. Phone | Released |
| 6. Email | Released |
| 7. Address | Coming |
| 8–10. Clinical | Non-drug allergies, problem list and lab results |

The governing reference is the DoH Reference and Master Data Standards, with code sets on the Shafafiya portal (login required).

**Claims and DRG**
- Shafafiya XML claims and prior authorisation go through the "Post Office" web service (→05 §2.2).
- The DoH Coding Manual is CSv2021.
- A DoH notice dated 16 Dec 2021 announced "JAWDA certification for healthcare providers" [V,35].
- The pharmacy benefit management (PBM) notice of Dec 2023 requires **dose, frequency and RxInstruction** in prior authorisations and claims [V,35].
- Mandatory Tariff and Claims & Adjudication Rules V2025.1 apply IR-DRG to inpatient and day-case encounters (except dental) from 1 Nov 2025 [S,36].

**ADHICS v2** [V,31,32]
- Document DOH/SD/ICSO/ADHICS/V2/2024: published May 2024, effective Aug 2024, revision due May 2027. It absorbs the retired Patient Healthcare Data Privacy and IoMT Security standards.
- **11 domains:** Human Resources, Asset Management, Physical and Environmental, Access Control, Communications and Operations, Data Privacy and Protection, **Cloud Security**, Third Party Security, Information Systems Acquisition, Development and Maintenance, Incident Management, and Continuity.
- **Control categories:**

  | Category | Applies to |
  |---|---|
  | Basic | Everyone |
  | Transitional | Hospitals with 1–20 beds, and centres |
  | Advanced | Hospitals with 21+ beds, Malaffi, insurers and TPAs |
  | **Service Provider** | EMR vendors, medical-technology vendors, web and mobile apps |

  Each category is due within 6 months of onboarding or of the standard's release. Independent audits are required at least annually.
- **Clauses that drive our architecture:**
  - Only people **physically present in the UAE, or holding a DoH licence**, may access systems containing PII or PHI. Exceptions need DoH approval.
  - Health information "**and its copies in any form, whether encrypted, anonymized, deidentified, pseudonymized**" must not be stored, processed or transferred outside the UAE without DoH approval.
  - Under CS 1.2 (Transitional and Service Provider), the cloud must be "physically hosted within UAE… **including backup and disaster recovery**".
  - The data must not be accessible to other parties in a multi-tenant environment, to analytics providers that send data abroad, or to "**any entity/party that provides remote support from outside UAE**".
  - Encryption keys must **not be provided by the CSP** that provides the application and hosting, and the CSP must not store or control them. The entity configures its own keys.
- Taken together, these clauses make Abu Dhabi the strictest residency and support regime in this pack, stricter than the generic "UAE regions, controlled remote support" pattern in 07 §1.5.

**JAWDA and AI**
- **JAWDA** is DoH's mandatory quality-KPI programme, with KPIs submitted quarterly by service line [K]. The measure engine must ship the JAWDA definitions (verify the current KPI manual).
- **The DoH AI policy** is old: v0.9, dated 30 Apr 2018. It applies to providers, insurers and anyone using Abu Dhabi patient data for AI [V,34]. Expect a newer AI standard [K].

**Payers:** Thiqa covers nationals and is accessed through Daman's network. Employers and sponsors must insure expatriate employees and their families [V,41].

### 5.2 Dubai (DHA / DHIC)

**NABIDH** (→06 §4.6) [V via 06]:
- Mandated standards: HL7 v2 and v3, CDA R2 and FHIR R4; IHE PIX, PDQ, XDS, XCA, XCPD, PDQm, PIXm and MHD.
- Code sets: ICD-10-CM, CPT, HCPCS, CDT, the Dubai Drug Code (DDC) and LOINC.
- **The EMR must be at least HIMSS EMRAM stage 2.**
- About 60% of facilities were connected as of Mar 2025.

The NABIDH site renders only through JavaScript, so its conformance-testing process could not be re-read [K].

**eClaimLink:**
- XML claims, e-authorisation (circular GC 07-2016, updated GC 03-2018) and ePrescription (GC 04-2018) [V,39].
- The DDC list is used in eClaimLink (GC 12-2018).
- Code sets were upgraded to the 2018 versions in 2020 (GC 03-2020) [V,39].

**DRG:**
- Full DRG implementation (GC 04-2020) [V,39].
- Grouper v3.3 Codefinder with v3.01 fixes (GC 05/2021).
- **GC 06-2025 (23 Dec 2025)** set the following for 1 Apr 2026: 2024 code sets (available on eClaimLink from 1 Jan 2026), new relative weights and base rates, and **grouper v3.5**. Resubmissions for earlier dates of service would stay on the 2021 code sets [V,37].
- **GC 02-2026 (17 Mar 2026)** deferred all of this "until further notice". "The code sets and payment transactions currently in place" continue [V,38]. No re-scheduling circular appeared in the ISAHD index (GC 03-2026 to GC 05-2026 cover other topics) [V,39].
- **Product requirement:** code-set and grouper versions must be selected by date of service, and the switch must be possible by configuration within weeks.

**Policy currency:** the ISAHD index also lists PD-02-2025 (Data Governance and Record Management) and PD-05-2025 (Dubai Health Insurance Claims Management) [V,39]. Both need reading before go-live [K]. A 2026 Dubai law may be renaming or restructuring the health insurance regulator [S,36], so watch for changes.

### 5.3 Northern Emirates (MOHAP)

**Riayati** is mandatory for MOHAP-licensed facilities (Ministerial Resolution 156/2021). It covers more than 3,000 facilities and includes an e-Claims Post Office (→06 §4.6) [S]. Treat it as L2 unless a customer is in the Northern Emirates.

### 5.4 Federal

- **Federal Law 2/2019** [V,40]:
  - Art. 13: localisation, with exceptions by Health Authority resolution in coordination with the Ministry. Ministerial Decision 51/2021 lists the exceptions (→07 [20]); we did not re-read it [K].
  - Arts. 4–6: the central system.
  - Art. 20: retention of at least 25 years.
  - Art. 24: fine of AED 500k–700k.
- **UAE PDPL** (Decree-Law 45/2021) defers to sector law for health data (→07).
- **Insurance** [V,41]:
  - The federal basic plan costs AED 320 a year.
  - Co-pays: inpatient 20% (capped at AED 500 per visit and AED 1,000 a year); outpatient 25% (capped at AED 100 per visit; no co-pay for a follow-up within 7 days for the same condition); medication 30% (capped at AED 1,500 a year).
  - The network is limited.
  - The eligibility and co-pay engine must encode these rules.
- **Identity** [K]: ICP's EID Toolkit (SDK) for card readers; UAE PASS for patient-portal login.
- **Device registration** body: MOHAP or the Emirates Drug Establishment. Still unverified (→07 §2.5).

---

## 6. Cross-cutting Gulf requirements

| Topic | Requirement | Tag |
|---|---|---|
| **RTL and bilingual records** | Full right-to-left UI using CSS logical properties. Bidi isolation for Latin drug names, codes and lab units inside Arabic text (→08 §8). **Bilingual clinical documents** (discharge summary, consent, sick leave, prescription labels) generated from one structured source, with Arabic and English side by side or on separate pages, as PDF/A. Arabic glyph shaping in thermal label printers and wristbands. A choice of Eastern Arabic or Western digits per output | [K] |
| **Hijri and Gregorian dates** | Store ISO-8601 Gregorian UTC. Display and enter **Umm al-Qura** Hijri dates (ICU calendar `islamic-umalqura`) alongside Gregorian. Accept Hijri dates of birth from Yakeen and Saudi IDs. Show age in both calendars. Calculate due dates and gestational age in Gregorian. Saudi government payroll moved to Gregorian in 2016, but citizen documents still often carry Hijri dates | [K] |
| **Weekends** | KSA: Friday–Saturday. UAE: Saturday–Sunday since 2022, with a Friday half-day in government. Rosters and SLAs must be calendar-aware per tenant | [K] |
| **Arabic names and the EMPI** | Store Arabic and English name parts separately: first name, father, grandfather and family (KSA four-part names); the EID English spelling is authoritative in Abu Dhabi [V,30]. Matching should: normalise Arabic (strip diacritics; unify alef forms أ/إ/آ→ا, taa marbuta ة→ه, alef maqsura ى→ي); handle the particles "Al-/El-", "bin/ibn/bint" and "Abu"; treat "Abd/Abdul + name" compounds as one token; use transliteration-variant dictionaries (Mohammed/Muhammad/Mohamed). Use **national ID, Iqama, EID or passport as a deterministic key**, with probabilistic matching as the fallback. Many patients share very common first names, so date of birth and the father's name carry more weight (→03 §3.1, →11 §3.1) | [K] |
| **Gender-specific workflows** | Patients can state a preference for a same-gender clinician, and scheduling should respect it. Document chaperones for intimate examinations. Support gender-separated waiting areas, wards and queues. Gender-aware nurse assignment rules. Saudi women may consent to their own care without a guardian (since the 2019 reforms), but the consent module must support a guardian or co-signer where the patient chooses one | [K] |
| **Ramadan** | Tenant-level "Ramadan mode": shifted clinic hours and evening clinics; KSA labour law limits Muslim workers to 6 hours a day. **eMAR time templates anchored to suhoor and iftar**, computed from the facility's location. Pharmacist checks for medicines with many daily doses. Fasting risk stratification for diabetes (IDF-DAR) in the OPD template. Prompts to offer once-daily formulations | [K] |
| **Hajj and Umrah** | Surge and MCI modes for Makkah and Madinah facilities (→03 §5.5); visitor insurance through NPHIES | [K] |

---

## 7. Quick scan: Qatar, Oman, Bahrain and Kuwait

| Country | SNOMED CT | Insurance and claims | Licensing and notes | Hosting | Tag |
|---|---|---|---|---|---|
| Qatar | **Member** (→06 §5) | Law 22/2021; visitor insurance mandatory since Feb 2023; expatriate phases planned; insurer and TPA portals | MoPH licensing; HMC runs Cerner; holds an ICD-10-AM licence | Azure Qatar Central (3 availability zones) [V,22]; Google Doha | [K] |
| Oman | Non-member (MLDS licence needed) | Phased private-sector mandatory insurance ("Dhamani") | MoH's national HIS is Al-Shifa | Local data centres | [K] |
| Bahrain | Non-member | National programme "Sehati" (Law 23/2018) | NHRA licensing; holds an ICD-10-AM licence | AWS `me-south-1` [V,23] | [K] |
| Kuwait | Non-member | Dhaman hospitals for expatriates | Among the early ICD-11 adopters (→05 §2.4) | Google region planned | [K] |

---

## 8. Infrastructure and content

### 8.1 Hosting per market (deployment view; extends 07 §1.9)

| Market | Hyperscaler regions (Oct 2026) | Sovereign or local providers | Hard constraints |
|---|---|---|---|
| India | AWS `ap-south-1` Mumbai and `ap-south-2` Hyderabad; Azure Central India, India South Central (Hyderabad), South India and West India [V,22,23]; Google Mumbai and Delhi [K] | Yotta, CtrlS and NIC (MeitY-empanelled for government work) [K] | CERT-In logs kept in India; ABDM and public tenders expect hosting in India (→07) |
| KSA | Google `me-central2` through CNTXT [V,21]; no Azure or AWS region yet [V,22,23] | Oracle Jeddah and Riyadh, stc/center3 and other CST-licensed providers [K] | In-Kingdom hosting on a CST-licensed provider; NCA ECC/CCC for government |
| UAE | Azure UAE North (3 availability zones) with UAE Central restricted for DR; AWS `me-central-1` [V,22,23] | Core42/G42, Khazna, Etisalat (e&) cloud [K] | ADHICS CS 1.2: UAE-only hosting **including backup and DR**, customer-controlled keys, no support from abroad [V,31] |

### 8.2 Certification lead times and costs

| Item | Market | Cost | Lead time | Tag |
|---|---|---|---|---|
| ABDM M1–M3, WASA audit, HTC demo | India | WASA audit about ₹1–5 lakh | 3–6 months | [S] (06) / [E] |
| NHCX participant | India | Engineering only | 1–3 months after M1 | [E] |
| NABH HIS/EMR (Advanced, both) | India | ₹1.5 lakh + GST, plus NESTA testing (50–100 h) | About 2–4 months once there are 3 live sites; 2-year cycle | [V,5,6] / [E] |
| NABH DHS (customer-side) | India | ₹30k–₹1.55 lakh in year one, by bed band | Hospital-driven | [V,4] |
| NPHIES vendor certification and PKI | KSA | Engineering plus partner | 2–4 months | [E] |
| ZATCA Phase 2 (CSID onboarding) | KSA | Low | Weeks | [K] |
| NCA ECC/CCC assessment (government customers) | KSA | Audit fees | 3–6 months | [E] |
| SFDA MDMA (regulated modules only) | KSA | Varies | 3–12 months | [E] |
| Malaffi onboarding | AD | Connection is free; the provider pays for SD-WAN | About 2 months before licence | [V,27,28] |
| ADHICS Service Provider controls and annual audit | AD | Audit fees | 6 months from onboarding | [V,31] |
| NABIDH conformance and EMRAM stage 2 | Dubai | HIMSS validation if requested | 2–4 months | [E] |
| eClaimLink / Shafafiya test accounts | UAE | Low | 1–2 months | [E] |
| ISO 27001 / SOC 2 Type II | All | — | 6–12 months | [E] (→07 §3.3) |

### 8.3 Regional drug databases

| Market | Regulatory list | Coding in claims | Commercial content | Tag |
|---|---|---|---|---|
| India | CDSCO approvals; NLEM and NPPA ceiling prices (DPCO 2013); MRP rules; HSN codes for GST | No national drug code in claims; brand names dominate | CIMS India, MIMS India, Medindia brand databases; Jan Aushadhi generics list | [K] |
| KSA | SFDA registered drug list (registration numbers, GTIN) | NPHIES "Scientific codes" for medications [V,17]; RSD serialisation | FDB, Lexicomp or Micromedex with Arabic content; MIMS Gulf | [V]/[K] |
| UAE | Emirates Drug Establishment / MOHAP registry; Tatmeen track and trace | **Dubai Drug Code** (eClaimLink, NABIDH) [V,39]; DoH drug codes (Shafafiya) [V,35] | Same as KSA | [V]/[K] |

### 8.4 Terminology licensing per market

| Code system | India | KSA | UAE |
|---|---|---|---|
| SNOMED CT | Free (member; NRCeS) | Free (member) | Free (member); Malaffi is a SNOMED reference site [V,26] |
| LOINC, UCUM, ICD-11 | Free | Free | Free |
| ICD-10 base | WHO ICD-10 for scheme claims | **ICD-10-AM: IHACPA ECL vendor licence** | ICD-10-CM (public domain) |
| Procedures | Scheme package codes | **SBS** (from CHI through the NPHIES portal) [K] | **CPT: AMA licence required**; HCPCS (free); CDT for dental (ADA licence) |
| DRG | — | AR-DRG (IHACPA) | IR-DRG grouper (3M/Solventum licence) [K] |

Sources: →06 §5 and [V,37].

---

## 9. Requirement matrix

**Column key:**
- **M/O:** M = mandatory, by law, regulator or accreditation; O = optional, but often commercially necessary.
- **Verif.:** the evidence tag.
- **Deadline:** dates are hard deadlines; "—" means continuous.

| ID | Requirement | Source (date) | M/O | Verif. | Module | MVP | Deadline |
|---|---|---|---|---|---|---|---|
| IN-01 | UHID at registration; ≥2 identifiers at every touchpoint | NABH 6th AAC.2.b, COP.1.b (Jan 2025) [1]; DHS AAC Core [3] | M | V | Registration/EMPI | L0 | — |
| IN-02 | ABHA create and verify; Scan & Share token; link ABHA to UHID | ABDM M1 [8]; DHS AAC [3] | M | V/S | Registration | L0 | — |
| IN-03 | ABDM M2 HIP: care contexts and FHIR bundles (OPConsult, Discharge, Rx, DiagnosticReport…) | 06 §4.5; NABH FAQ (2024) [6] | M | S | Integration | L0 | — |
| IN-04 | ABDM M3 HIU: consent requests, fetch, decrypt, purge | [6]; 06 | M | S | Integration | L0 | — |
| IN-05 | WASA / safe-to-host audit kept current | [6][8] | M | V | Security | L0 | Annual [K] |
| IN-06 | NABH HIS/EMR certification at Advanced level | NABH V12.1 (Sep 2024) [5][6] | O (commercially M) | V | Product/QMS | L1 | Renew every 2 years |
| IN-07 | DHIS linkage-count API and claim support | DHIS Corr. 6 (Nov 2025) [11] | O | S/U | Integration | L1 | Scheme period [U] |
| IN-08 | NHCX: eligibility, pre-auth, claim, communication, payment notice | NHCX [9]; IRDAI (May 2024) [12] | M (becoming) | V/S | Claims | L0 | IRDAI mandate pending [S,47] |
| IN-09 | TPA cashless state machine with 1-hour and 3-hour SLA timers, document packs, enhancements, deductions | IRDAI/HLT/CIR/PRO/84/5/2024 [12] | M | V | RCM | L0 | — |
| IN-10 | PM-JAY and state-scheme package billing; pre-auth documents; TMS, then HMIS-via-NHCX | NHA [S,47][K] | M (empanelled) | K | RCM | L1 | — |
| IN-11 | CGHS, ECHS and ESIC credit billing with city and accreditation rate masters | [K] | M (empanelled) | K | RCM | L1 | — |
| IN-12 | GST engine: room rent above ₹5,000 at 5% without ITC; HSN pharmacy rates; GSTR extracts | CBIC Notif. 04/2022-CT(R) [13] | M | S | Billing/Finance | L0 | — |
| IN-13 | e-Invoice (IRN) for B2B taxable supplies (turnover > ₹5 crore) | GST [K] | M (if applicable) | K | Finance | L1 | — |
| IN-14 | Estimate engine; tariff list; re-estimate on change of plan | NABH PRE.6 [1] | M | V | Billing | L0 | — |
| IN-15 | NABH KPI engine: 32 + 18 KPIs, computed numerator/denominator with manual fallback, monthly YTD | NABH KPI annex [1] | M | V | Quality/Analytics | L0 | Monthly |
| IN-16 | High-risk and LASA flags; reconciliation; verbal-order read-back; NDPS, chemo and radiopharmaceutical controls | MOM.3, 4, 9 [1] | M | V | CPOE/Pharmacy | L0 | — |
| IN-17 | Antimicrobial stewardship (restriction and usage) | IPC.2.f [1] | M | V | CPOE/Pharmacy | L0 | — |
| IN-18 | Critical-result loop and TAT monitoring (lab and imaging) | AAC.6.f/g, AAC.7.f [1] | M | V | LIS/RIS | L0 | — |
| IN-19 | Signed, timed, attributable entries; abbreviation control; record review; retention and destruction | IMS.3–7 [1] | M | V | Clinical docs/Records | L0 | — |
| IN-20 | Location-wise digital drug lists and stock checklists | DHS MOM Core [3] | M (DHS) | V | Inventory | L0 | — |
| IN-21 | Credential management; external-storage controls; archive and retrieval | DHS DOM Core [3] | M (DHS) | V | Security/Platform | L0 | — |
| IN-22 | Digital payments; predefined charge master | DHS FPM Core [3] | M (DHS) | V | Billing | L0 | — |
| IN-23 | DPDP notices, consent, rights, breach handling, consent-manager integration | DPDP Rules 2025 (→07) | M | V (07) | Consent/Platform | L0 | 13 Nov 2026 / 13 May 2027 |
| IN-24 | CERT-In: 6-hour incident reporting; 180-day logs in India; NTP | CERT-In 20(3)/2022 (→07) | M | V (07) | SecOps | L0 | — |
| IN-25 | MLC register and police-intimation workflow | COP.2.c [1]; BNSS [K] | M | V/K | ED/ADT | L0 | — |
| IN-26 | PCPNDT Form F gate on obstetric ultrasound; monthly reports; 2-year retention | PCPNDT Act [K] | M (if USG) | K | RIS/OB | L0 | Monthly |
| IN-27 | MTP forms and confidential register | MTP Act/Regs [K] | M (if service offered) | K | OB/Gyn | L1 | Monthly |
| IN-28 | Schedule H1 and X and NDPS registers | D&C Rules, NDPS [K]; MOM.9 [1] | M | K | Pharmacy | L0 | — |
| IN-29 | BMW bar-coding, weights, annual Form IV | BMW Rules 2016 [K]; IPC Core [1] | M | K | Facilities | L1 | Annual |
| IN-30 | Birth and death reporting to CRS within 21 days; MCCD | RBD Act 2023 [K]; IMS.4.g [1] | M | K | ADT/Records | L0 | 21 days |
| IN-31 | IHIP and Nikshay notifiable-disease reporting | [K] | M | K | Public-health reporting | L1 | Per state |
| IN-32 | Teleconsultation per TPG 2020 | TPG 2020 [K]; COP OE [1] | M (if telehealth) | K | Telehealth | L1 | — |
| IN-33 | UPI dynamic QR; card POS; reconciliation | Market [K] | O (commercially M) | K | Billing | L0 | — |
| IN-34 | Tally Prime voucher export | Market [K] | O (commercially M) | K | Finance | L0 | — |
| IN-35 | Hindi plus state-language patient documents | DHS [3]; market | O | V/K | i18n | L1 | — |
| IN-36 | Doctor revenue share with TDS (s.194J); no referral commissions to doctors | IMC Regs 2002 [K] | M (legal limit) | K | Finance | L1 | — |
| IN-37 | Aadhaar masking; vault if stored | UIDAI (→07) | M | U | Registration/Security | L0 | — |
| IN-38 | NABL LIS features (QC, PT, scope flag, amendment audit) | NABL 112 / ISO 15189 [K] | M (NABL labs) | K | LIS | L1 | — |
| SA-01 | NPHIES FS messaging, all use cases | NPHIES FS IG 1.0.0 (Dec 2025) [15] | M | V | Claims | L0 | — |
| SA-02 | NPHIES vendor onboarding, PKI and certification | [15]; [K] | M | K | Integration | L0 | — |
| SA-03 | ICD-10-AM and SBS packs by version; dental, pharmacy and institutional claim types; FDI codes | [16][17]; 06 | M | V/K | Coding | L0 | Per CHI version notice |
| SA-04 | AR-DRG grouping (shadow) | 05 [S] | M (direction of travel) | S | DRG | L1 | About 2028 [S] |
| SA-05 | IHACPA ECL vendor licence | 06 | M | S | Commercial | L0 | — |
| SA-06 | ZATCA Phase 2 invoices (UBL 2.1, CSID, stamp, QR; clearance and reporting) | ZATCA [46]; [K] | M | V/K | Finance | L0 | Wave date |
| SA-07 | Wasfaty e-prescription send and dispense status | [K] | M (MOH-linked) | K | CPOE/Pharmacy | L1 | — |
| SA-08 | SeHE/NHIC clinical document exchange | [15]; [K] | M (clusters) | K | Integration | L1 | — |
| SA-09 | Nafath/Yakeen verification; Hijri date of birth | [K] | O (commercially M) | K | Registration | L0 | — |
| SA-10 | PDPL: DPO, registration, 72-hour breach notice, transfer controls | PDPL (→07); [24] | M | V/K | Platform | L0 | — |
| SA-11 | In-Kingdom hosting on a CST-licensed provider; ECC/CCC for government | [21]; [K] | M | S/K | Platform | L0 | — |
| SA-12 | CBAHI hospital standards pack (MOI, MR, patient ID, medication) | CBAHI 3rd ed. [45] | M (accreditation) | U | Quality | L0 | — |
| SA-13 | Separate regulated CDS modules; MDMA if released | SFDA MDS-G27 (Aug 2025) [19] | M (if device) | V | QMS | L1 | Before release |
| SA-14 | SFDA RSD dispense reporting | [K] | M (pharmacy) | K | Pharmacy | L0 | — |
| SA-15 | Sehhaty / SVH referral and consult interfaces | [18]; [K] | O | V/K | Patient access | L2 | — |
| SA-16 | Local content, regional HQ and Nitaqat compliance for government bids | [K] | M (government) | K | Commercial | — | — |
| AE-01 | Malaffi connection: HL7 v2 real-time feeds, accession agreement, security assessment, SD-WAN | Malaffi [27][29] | M (licence) | V | Integration | L0 (AD) | Before active licence |
| AE-02 | EID reader in EMR and LIS; chip read every visit; passport fallback | DoH HIE Std 1 (2026) [30] | M | V | Registration | L0 | 6 months from circular |
| AE-03 | Legal-name capture exactly as EID English spelling | DoH HIE Std 2 (2026) [30] | M | V | EMPI | L0 | 6 months from circular |
| AE-04 | Malaffi consent wording; mandated sharing; break-the-seal | DoH HIE Policy 1.1 (Apr 2020) [33] | M | V | Consent | L0 | — |
| AE-05 | ADHICS v2 Service Provider and Transitional/Advanced controls; annual independent audit | ADHICS v2 (May 2024) [31] | M | V | Security | L0 | 6 months from onboarding |
| AE-06 | UAE-only hosting including backup and DR; no support from abroad; in-UAE or DoH-licensed access; customer-held keys | ADHICS CS 1.2, DP [31]; FL 2/2019 Art. 13 [40] | M | V | Platform/Support | L0 | — |
| AE-07 | Shafafiya XML claims and prior auth; DoH codes; PBM dose and frequency | DoH [35]; 05 | M | V/S | Claims | L0 (AD) | — |
| AE-08 | IR-DRG for inpatient and day case | DoH Tariff V2025.1 [36] | M | S | DRG | L0 (AD) | From 1 Nov 2025 |
| AE-09 | eClaimLink claims, eAuth and eRx on the 2021 code sets with the current grouper | DHIC GC 02-2026 [38] | M | V | Claims | L0 (Dubai) | — |
| AE-10 | Code-set and grouper version selected by date of service; v3.5 and 2024 sets ready | GC 06-2025 [37] | M | V | Coding | L1 | TBD (deferred) |
| AE-11 | NABIDH conformance (v2, CDA, FHIR, IHE); EMRAM stage 2 | 06 [69] | M (Dubai) | V (06) | Integration | L0 (Dubai) | — |
| AE-12 | Riayati / MOHAP e-Claims | 06 | M (Northern Emirates) | S | Integration | L2 | — |
| AE-13 | AMA CPT and ADA CDT licences | 06 | M | V (06) | Commercial | L0 | — |
| AE-14 | DDC and DoH drug codes; Tatmeen | [35][39]; [K] | M | V/K | Pharmacy | L0 | — |
| AE-15 | JAWDA KPI submission | DoH [35]; [K] | M (AD) | K | Quality | L1 | Quarterly [K] |
| AE-16 | Retention of at least 25 years | FL 2/2019 Art. 20 [40] | M | V | Records | L0 | — |
| AE-17 | AI governance artefacts per DoH AI policy | DoH AI v0.9 (2018) [34] | M | V | AI platform | L1 | — |
| AE-18 | Federal basic-plan co-pay rules | u.ae (2025) [41] | M | V | RCM | L0 | — |
| GCC-01 | Hijri/Gregorian display and entry (Umm al-Qura) with Gregorian canonical storage | [K] | M (KSA) | K | Platform | L0 | — |
| GCC-02 | Arabic name model, normalisation and transliteration-aware matching | [30]; [K] | M | V/K | EMPI | L0 | — |
| GCC-03 | Full RTL UI; bilingual PDF/A documents; Arabic label printing | [K] | M | K | Platform | L0 | — |
| GCC-04 | Same-gender preference scheduling; chaperone documentation | [K] | O (commercially M) | K | Scheduling | L1 | — |
| GCC-05 | Ramadan mode: hours, eMAR anchored to suhoor and iftar, fasting risk template | [K] | O | K | Scheduling/eMAR | L1 | — |
| GCC-06 | Per-tenant weekend and holiday calendars | [K] | M | K | Platform | L0 | — |

---

## 10. Launch-readiness checklists

### India (first customer: a 100–300-bed NABH private hospital)

**Must be in place before go-live:**
- [ ] ABDM M1–M3 production certificates, a current WASA certificate, and the bridge registered in HFR
- [ ] Registered as a DHIS digital solution company and linkage API live (if the scheme is still running)
- [ ] NHCX participant ID, sandbox certification and production credentials
- [ ] TPA and insurer master data (top 25 payers); document checklists; SLA timers
- [ ] GST engine tested on room-rent and pharmacy scenarios; Tally export accepted by the customer's CA
- [ ] NABH 6th edition Core-OE walkthrough passed with the customer's quality team; KPI pack configured
- [ ] DHS 17 Core OEs demonstrably met by configuration
- [ ] Statutory registers live: MLC, Form F, Schedule H1, NDPS, BMW and CRS
- [ ] Hindi plus state-language templates for prescriptions, consents, estimates and discharge summaries
- [ ] India-region hosting; CERT-In runbook (6-hour reporting); logs kept 180 days in India
- [ ] DPDP notice and consent artefacts; Consent Manager integration plan (registration opens 13 Nov 2026)

**Commercial milestones:**
- [ ] Three signed hospital MoUs, then apply for **NABH HIS and EMR Advanced** certification

### UAE (first customers: an Abu Dhabi private hospital, then Dubai)

- [ ] UAE entity; UAE-resident support team; **no PHI access from outside the UAE**; DoH exemption process documented for any exceptions
- [ ] Hosting in Azure UAE North or AWS `me-central-1` (or a sovereign UAE provider), with backup and DR in the UAE
- [ ] Customer-managed keys held outside our control as the cloud provider (an HSM or external key manager owned by the customer)
- [ ] ADHICS v2 Service Provider control self-assessment, plus an independent audit booked
- [ ] Malaffi: specification requested, HL7 v2 feeds certified, consent wording delivered to the customer, SD-WAN ordered at least 2 months ahead
- [ ] EID reader SDK integrated in the EMR and LIS; name and ID capture follows HIE Standards 1–6
- [ ] Shafafiya Post Office adapter; DoH code sets; IR-DRG grouper licence; PBM dose and frequency fields
- [ ] Dubai: NABIDH conformance; EMRAM stage 2 evidence; eClaimLink adapter on the 2021 code sets with the v3.5 switch staged
- [ ] AMA CPT and ADA CDT distribution licences; DDC loaded
- [ ] JAWDA KPI definitions loaded; 25-year retention policy configured
- [ ] Bilingual Arabic/English documents and RTL UI signed off by the customer's clinical documentation committee

### Saudi Arabia (first customer: a private group, through a partner)

- [ ] Local partner selected with NPHIES certification and CST-licensed hosting (Google `me-central2` through CNTXT, Oracle, or a local provider); NCA ECC/CCC mapping complete
- [ ] NPHIES PKI, certification test set passed, and SBS and ICD-10-AM versions loaded; IHACPA ECL licence signed
- [ ] ZATCA Phase 2 CSID onboarding; clearance and reporting flows; VAT treatment by nationality
- [ ] Nafath/Yakeen identity verification; Hijri date of birth handled
- [ ] Wasfaty and RSD integration (if the hospital has an outpatient pharmacy)
- [ ] PDPL: DPO named; records of processing; transfer impact for any non-Saudi telemetry (we recommend sending none)
- [ ] CBAHI current-edition crosswalk completed with the customer's quality team
- [ ] SFDA classification memo per module under MDS-G27; regulated CDS disabled until an MDMA is granted
- [ ] For government bids: local-content plan, regional-HQ status, Nitaqat staffing plan

---

## 11. Implications for our build (opinionated)

1. **Make India the build-and-prove market, and make NABH HIS/EMR Advanced the first certification.** It is cheap (about ₹1.5 lakh plus testing), quick (50–100 hours of testing), and recognised by every Indian buyer. Its prerequisites (ABDM M1–M3, WASA, 3 sites) force the right engineering anyway. Plan the first three Indian go-lives as the certification cohort.
2. **Treat ABDM, NHCX and IRDAI as one workstream, "India rails".** NHCX reuses the M1 credentials and the HFR identity, and IRDAI's 1-hour and 3-hour SLAs are measured against hospital timestamps. Our claims domain (→11 §11) needs SLA timers, document-pack objects and deduction-reason codes from day one. Patients will see their coverage in Aarogya Setu 2.0, so hospitals will be pushed toward NHCX.
3. **Build a generic "accreditation pack" engine, not hard-coded compliance.** NABH 6th edition, NABH DHS, the NABH HIS/EMR standard, CBAHI, JAWDA, JCI and ADHICS all share the same shape:

   > chapter → standard → objective element (with category) → evidence query or attestation → KPI definition (numerator, denominator, sampling) → manual-entry fallback

   Ship the NABH 6th edition and DHS packs first, then JAWDA, then CBAHI once the manual is obtained. Under this model, US NPSG anchors in 03 become just another pack.
4. **Redesign the Gulf deployment model around ADHICS v2, the strictest regime.** This is a **change** from 07 and 08:
   - **Abu Dhabi:** each cell needs (a) UAE-only primary, backup and DR; (b) **customer-held keys** through an external key manager or HSM that we cannot access; (c) a **UAE-resident support roster** with just-in-time access, session recording, and zero standing access for engineers outside the UAE; (d) **no PHI-derived telemetry** leaving the cell. That includes de-identified analytics and AI training. ADHICS explicitly covers anonymised copies.
   - **Saudi Arabia:** apply the same pattern in-Kingdom.

   The global control plane may carry only code, configuration and licence data.
5. **Version code sets and groupers by date of service as a platform primitive.** Dubai's planned 1 Apr 2026 switch to 2024 code sets and grouper v3.5 was cancelled two weeks before go-live. Claims for earlier dates of service must stay on the old versions while new ones move on. Australia moves ICD-10-AM and AR-DRG every 3 years, and SBS versions gate NPHIES access. Treat `(code system, version, effective-from, effective-to, payer)` as data, and test version switches in CI.
6. **Split the product into "HIT core" and "regulated modules".** SFDA MDS-G27 and CDSCO's software guidance both carve EHR, HIS, billing and dispensing out of device regulation, but they capture real-time alerting CDS, interpretive LIMS rules and scribes that suggest diagnoses. Package those as separately versioned modules with their own QMS (IEC 62304, ISO 14971) and documented separation, so the core can ship in every market without an MDMA or CDSCO licence. This matches the device-boundary map in 07 §2.7.
7. **Build the EMPI for Gulf names now.** It needs: national IDs (EID, Saudi ID and Iqama, passport, ABHA, Aadhaar reference) as typed identifiers with deterministic precedence; separate Arabic and English name parts; Arabic normalisation; transliteration dictionaries; and Hijri date-of-birth parsing. Abu Dhabi's mandate to read the EID card means capture should come **from the card, not the keyboard**, so card-reader integration counts as an EMPI feature.
8. **India billing must be "pay-first and package-first", not a US-style claim-first design.** This means:
   - deposits, the running bill, room-class tariff multipliers, packages with exclusions, and the free revisit window
   - UPI QR on every bill, and Tally export
   - a GST engine that tests the room-rent threshold per day and HSN rates per pharmacy line

   Build doctor revenue share, but **no referral-commission feature**. It would be a liability under the medical-ethics regulations.
9. **Statutory registers are cheap to build and expensive to miss.** MLC, PCPNDT Form F, H1/X, NDPS, BMW and CRS are small forms with hard workflow gates. A Form F gate on obstetric ultrasound is a criminal-law issue for the hospital. Build them as a configurable "statutory register" framework with locked records and export formats per state.
10. **Saudi Arabia needs a partner, not a direct entry.** Azure and AWS have no Saudi region, Google is sold only through CNTXT, NPHIES certification and CBAHI details sit behind blocked portals, and government bids need local content, a regional HQ and Nitaqat compliance. That points to a **Saudi integration and hosting partner** for the first 2–3 deals. Keep our product NPHIES-native: FHIR R4 messaging and SBS packs.
11. **Do not build national patient apps; integrate with them.** Aarogya Setu 2.0, Sehhaty/SVH, UAE PASS and Malaffi's provider portal already own the patient relationship (→09 §7.7). Spend on appointment, record and coverage interfaces and on WhatsApp in India.
12. **AI features need market-specific gating.** DoH's AI policy, India's SAHI and BODH, SFDA's AI/ML guidance and ADHICS's offshore rules mean any LLM features (→09) must run **in-region** in UAE and KSA cells, with no prompt or output logging outside the country. Without in-country model hosting, ship those markets with GenAI off.

---

## 12. Verification backlog (next research pass)

| # | Item | Why it matters | Suggested source |
|---|---|---|---|
| 1 | CBAHI hospital standards: current edition, chapters, IT-related standards | Saudi accreditation pack | cbahi.gov.sa (needs Saudi network access) or purchase the manual |
| 2 | NPHIES vendor certification process; current SBS version | Saudi go-live gate | portal.nphies.sa (registration area), CHI circulars |
| 3 | Wasfaty and SeHE/NHIC integration specifications | Saudi clinical exchange | MOH and NHIC through a partner |
| 4 | NCA ECC-2:2024 and CCC-2:2024 control text; CST CSP classes for health data | Hosting design | nca.gov.sa, cst.gov.sa |
| 5 | ZATCA wave thresholds for 2025–2026 | Billing timeline | ZATCA wave announcements |
| 6 | DHIS status after Mar 2026 | Revenue-share model | abdm.gov.in (Indian network) |
| 7 | NHCX FHIR IG version and profiles; PM-JAY-via-NHCX timeline | Claims build | nrces.in, nhcx.abdm.gov.in |
| 8 | HBP 2022 package count and current HBP version; CGHS 2025 rate revision | Package masters | pmjay.gov.in, cghs.gov.in |
| 9 | CDSCO final medical-device-software guidance (date and text) | Device boundary in India | cdsco.gov.in |
| 10 | UAE Ministerial Decision 51/2021 exceptions; UAE PDPL Executive Regulations | Telemetry and support exceptions | MOHAP / UAE legislation portal |
| 11 | DoH JAWDA KPI manual (current version); DoH Mandatory Tariff V2025.1 primary text | AD quality and DRG | doh.gov.ae |
| 12 | NABIDH conformance process and approved-EMR list | Dubai go-live gate | nabidh.ae (renders only with JavaScript) |
| 13 | JCI 8th edition and NABL 112 current issue | Premium hospitals and labs | JCI, nabl-india.org |
| 14 | Qatar, Oman, Bahrain and Kuwait insurance platforms | Phase-2 GCC expansion | National regulators |

---

## Sources

1. NABH, *Accreditation Standards for Hospitals, 6th Edition* (effective 1 Jan 2025): foreword, chapter summary, decision rules, IMS chapter, KPI annex. https://nabh-portal-live.s3.ap-south-1.amazonaws.com/wp-content/uploads/2025/07/13111206/NABH-Hospital-Accreditation-Standard-6th-Edition-January-2025.pdf
2. NABH, Hospital accreditation programme page. https://nabh.co/hospital/
3. NABH, *Digital Health Standards for Hospitals, 2nd Edition* (Sep 2025). https://nabh-portal-live.s3.ap-south-1.amazonaws.com/wp-content/uploads/2025/07/02133924/NABH-Digital-Health-Standards-For-Hospitals-2nd-Edition_September-2025.pdf
4. NABH, Digital Health programme page (fees, validity, eligibility). https://nabh.co/digital-health/
5. NABH, *Information Brochure for NABH Digital Health Standards for HIS/EMR Systems*. https://nabh-portal-live.s3.ap-south-1.amazonaws.com/wp-content/uploads/2025/07/25081027/General-Information-Brochure_HIS-EMR-Standards.pdf
6. NABH, *FAQs: HIS/EMR Certification* (xlsx). https://nabh-portal-live.s3.ap-south-1.amazonaws.com/wp-content/uploads/2025/07/25081001/FAQs_HIS-EMR-Certification.xlsx
7. NABH, Certified Healthcare Software listing. https://nabh.co/nabh-certified-healthcare-software/
8. Press Information Bureau (GoI), *Ayushman Bharat Digital Mission: India's Digital Health Backbone* (6 Jul 2026). https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/jul/doc202676912801.pdf
9. NATHEALTH, *National Health Claims Exchange: The Next Step in Digital Health Interoperability* (Jun 2025), including the "NHCX Integration Process – Provider" flow. https://nathealthindia.org/wp-content/uploads/2025/06/National-Health-Claims-Exchange_Latest.pdf
10. PIB, NHA announces incentives under ABDM (Dec 2022), https://www.pib.gov.in/PressReleasePage.aspx?PRID=1885610 ; and the DHIS extension (Aug 2023), https://www.pib.gov.in/PressReleasePage.aspx?PRID=1945911 (both read through a search-index summary [S])
11. NHA/ABDM, DHIS Corrigendum 6 (20 Nov 2025). https://abdm.gov.in/strapicms/uploads/20_Nov_2025_vf_DHIS_Corrigendum_6_dba5b58a53.pdf (HTTP 403 on direct fetch; content from a search-index summary [S])
12. IRDAI, *Master Circular on Health Insurance Business*, Ref. IRDAI/HLT/CIR/PRO/84/5/2024, 29 May 2024 (paras 15–17, Ch. I IV(c), Ch. III II). https://irdai.gov.in/document-detail?documentId=4942918
13. ClearTax, *GST on hospital room rent and beds*, https://cleartax.in/s/gst-on-hospital-room-rent-beds ; Taxgarden, *GST on healthcare (2026)*, https://taxgarden.in/blog/gst-on-healthcare-medical-services-india-2026 [S]
14. Nishith Desai Associates, *Dissecting CDSCO's Draft Guidance on Medical Device Software*, https://www.nishithdesai.com/default.aspx?id=15465 ; Lexology, *CDSCO releases final guidance document on medical device software*, https://www.lexology.com/library/detail.aspx?g=0049fff8-5f9c-469c-8701-0a30b009a4c5 (403 on direct fetch) [S]
15. CHI / HL7 Saudi Arabia, *NPHIES Healthcare Financial Services IG Edition 1, v1.0.0*: Introduction (metrics as of Oct 2025). https://portal.nphies.sa/ig/introduction.html
16. Same IG: Roadmap (deviations; PDF IG v2.6 basis). https://portal.nphies.sa/ig/roadmap.html
17. Same IG: Artifacts (code systems and value sets). https://portal.nphies.sa/ig/artifacts.html
18. Saudi Ministry of Health, *Seha Virtual Hospital*. https://www.moh.gov.sa/en/Ministry/Projects/Pages/Seha-Virtual-Hospital.aspx
19. SFDA, *MDS-G27 Guidance on Digital Health Products*, v1.0 (11 Aug 2025). https://www.sfda.gov.sa/sites/default/files/2025-08/MDS-G027.pdf
20. SFDA, *MDS-G010 Guidance on AI and ML technologies based Medical Devices*, v1.0 (29 Nov 2022). https://www.sfda.gov.sa/sites/default/files/2023-01/MDS-G010ML.pdf [S]
21. Google Cloud, *Dammam region access*. https://docs.cloud.google.com/docs/dammam-region-access
22. Microsoft Learn, *List of Azure regions* (updated 13 Oct 2026). https://learn.microsoft.com/en-us/azure/reliability/regions-list
23. AWS, *AWS Regions*, https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html ; AWS Global Infrastructure (announced regions), https://aws.amazon.com/about-aws/global-infrastructure/regions_az/
24. DLA Piper, *Data Protection Laws of the World: Saudi Arabia (transfer)*. https://www.dlapiperdataprotection.com/?t=transfer&c=SA [S]
25. Cerner, *KFSH&RC achieves highest level of health care IT adoption* (12 Oct 2015), https://cernercorporation.gcs-web.com/news-releases/news-release-details/king-faisal-specialist-hospital-research-centre-achieves-highest ; Zawya, *KFSH&RC virtually upgrades its ICIS*, https://www.zawya.com/en/press-release/king-faisal-specialist-hospital-amp-research-centre-progresses-transformation-program-by-virtually-upgrading-cnct4bvf [S]
26. Malaffi, home page ("Malaffi in numbers"; SNOMED reference site, Nov 2025). https://www.malaffi.ae/
27. Malaffi, *Facilities required to connect*. https://www.malaffi.ae/providers/facilities-required-to-connect/
28. Malaffi, *Connected EMR systems*. https://www.malaffi.ae/connected-emrs/
29. Malaffi, *Provider resources*. https://www.malaffi.ae/providers/resources/
30. DoH Abu Dhabi, *Health Information Exchange Standards (2026)*, https://www.doh.gov.ae/en/resources/HIE ; Standard 1 (Patient Identifier), https://www.doh.gov.ae/-/media/Feature/Resources/Health-Information-Exchange-standards/Standard-1---Patient-Identifier---Emirates-ID-and-Passport.ashx ; Standard 2 (Patient Name), https://www.doh.gov.ae/-/media/Feature/Resources/Health-Information-Exchange-standards/Standard-2---Patient-Name.ashx
31. DoH Abu Dhabi, *Abu Dhabi Healthcare Information and Cyber Security Standard (ADHICS) V2*, DOH/SD/ICSO/ADHICS/V2/2024 (published May 2024; effective Aug 2024). https://www.doh.gov.ae/-/media/Feature/Resources/Standards/ADHICS-v2-standard.ashx
32. DoH Abu Dhabi, *AAMEN programme*. https://www.doh.gov.ae/en/programs-initiatives/Aamen
33. DoH Abu Dhabi, *Policy on the Abu Dhabi Health Information Exchange*, DOH/POL/STR/HIE/1.1/2020 (effective 16 Apr 2020). https://www.doh.gov.ae/-/media/A78104416DF2440E89AC90FB75F11055.ashx
34. DoH Abu Dhabi, *Policy on Use of Artificial Intelligence in the Healthcare Sector*, v0.9 (30 Apr 2018), https://www.doh.gov.ae/-/media/E9C1470A575146B18015DEBE57E47F8D.ashx ; DoH policies index, https://www.doh.gov.ae/en/resources/policies
35. DoH Abu Dhabi, *Shafafiya standards* (Coding Manual CSv2021; JAWDA certification notice, 16 Dec 2021), https://www.doh.gov.ae/en/Shafafiya/standards ; notices (PBM dose/frequency, 1 Dec 2023), https://www.doh.gov.ae/en/Shafafiya/notices
36. Avior Advisory, *UAE Healthcare Regulatory Tracker*. https://www.avioradvisory.com/avior-uae-healthcare-regulatory-tracker.pdf [S]
37. DHA/DHIC, *GC 06-2025: Update of Code Sets, DRG Payment Parameters and Grouper Version – Effective 1 April 2026* (23 Dec 2025). https://www.isahd.ae/content/docs/GC%2006-2025%20Circular%20on%20Update%20of%20Code%20Sets,%20DRG%20Payment%20Parameters%20and%20Grouper%20Version%20%E2%80%93%20Effective%201%20April%202026.pdf
38. DHA/DHIC, *GC 02-2026: Deferral of the Update of 2024 Code Sets Scheduled for 1st April 2026* (17 Mar 2026). https://www.isahd.ae/content/docs/GC%2002-2026_Deferral%20of%20the%20Update%20of%202024%20Code%20Sets%20Scheduled%20for%201st%20April%202026.pdf
39. ISAHD (Dubai), *Law & Regulations* index (GC 07-2016, GC 03/04-2018, GC 12-2018, GC 03-2020, GC 04-2020, GC 05-2021, PD-02-2025, PD-05-2025, GC 01–05-2026). https://www.isahd.ae/Home/LawAndRegulations
40. UAE, *Federal Law No. (2) of 2019 Concerning the Use of ICT in Health Fields* (English text; Arts. 13, 20, 24). https://www.isahd.ae/content/docs/Federal%20Law%20No.%20(2)%20of%202019,%20Concerning%20the%20Use%20of%20the%20Information%20and%20Communications%20Technology%20in%20Health%20Fields.pdf
41. UAE Government portal, *Getting a health insurance*. https://u.ae/en/information-and-services/health-and-fitness/Healthcare-access-and-insurance/getting-a-health-insurance
42. DTS Solution, *ADHICS v2.0: What's new? What's changed?* (Feb 2025). https://www.dts-solution.com/adhics-v2-0-whats-new-whats-changed/ [S]
43. IHACPA, *ICD-10-AM/ACHI/ACS* (Thirteenth Edition from 1 Jul 2025). https://www.ihacpa.gov.au/health-care/classification/icd-10-amachiacs [S]
44. AAPC, *Healthcare in Saudi Arabia, Part 1* (SBS/ACHI, AR-DRG v9). https://www.aapc.com/blog/89126-healthcare-in-saudi-arabia-part-1/ [S]
45. CBAHI, *Hospital Accreditation Guide* (Oct 2016, 3rd-edition companion; third-party copy). https://www.slideshare.net/slideshow/cbahi-hospital-accreditation-guide-october-2016/75644899 [S]
46. ZATCA, *E-Invoicing* (Phase 1 on 4 Dec 2021; Phase 2 from 1 Jan 2023), https://zatca.gov.sa/en/E-Invoicing/Pages/default.aspx ; *Roll-out phases* (waves with at least 6 months' notice), https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/Roll-out-phases.aspx
47. Nirmitee, *PMJAY claim process: TMS 2.0 vs NHCX (2026)*, https://nirmitee.io/blog/nhcx-pmjay-tms-ayushman-bharat-claims/ ; Aptiplus (31 Aug 2026), IRDAI panel on mandatory NHCX, https://aptiplus.in/daily-current-affairs/national-health-claims-exchange-nhcx-digitising-claims-reforming-health-insurance [S]
48. Wikipedia, *Ayushman Bharat Pradhan Mantri Jan Arogya Yojana* (70+ extension, 2024). https://en.wikipedia.org/wiki/Ayushman_Bharat_Pradhan_Mantri_Jan_Arogya_Yojana [S]

*Cross-referenced pack documents: 01-global-vendor-landscape.md, 03-clinical-modules-and-workflows.md, 04-diagnostics-pharmacy-devices.md, 05-revenue-cycle-erp-operations.md, 06-interoperability-standards.md, 07-security-privacy-regulation.md, 08-architecture-and-technology.md, 09-ai-analytics-digital-front-door.md, 10-implementation-ux-lessons.md, 11-canonical-domain-model.md.*
