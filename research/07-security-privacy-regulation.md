# 07 — Security, Privacy, Regulation, Certification, Accreditation & Operational Resilience

**Research track:** Security / privacy / regulatory compliance for an internationally sellable Hospital Management System (HMS = HIS/EHR + hospital ERP/operations)
**Prepared:** 2026-10-16
**Audience:** Product, architecture, engineering leadership, compliance/regulatory, go-to-market

> **How to read this document: confidence tags.**
> - **[V]** = verified in this research session against the cited primary source or a credible secondary source.
> - **[R]** = reported by credible secondary sources (law firms, trade press). Not checked against the primary legal text this session.
> - **[U]** = analyst knowledge (training data to mid-2026) that was **not re-verified this session**. Confirm before relying on it for contracts, regulatory submissions or marketing claims.
> - **Pass-2 fact-check (2026-10-16).** About 30 claims were re-checked against primary or credible sources. Tags were upgraded or corrected in place, and new sources were added as [74]–[87]. See the "Verification log (pass 2)" table at the end.
>
> **Method note.** The shared web-search budget ran out after 14 searches. The rest of the research used about 55 direct fetches of primary or credible sources: HHS/OCR material, ASTP/ONC healthit.gov, eCFR via Cornell LII, FDA guidance pages and the PDF text of the January 2026 CDS guidance, European Commission pages, CISA, HHS 405(d)/HPH CPG, the NHS DSPT, legislation.gov.uk, NABH notices, DLA Piper's country law summaries, the PwC/HSE post-incident report text, JAMA papers, HIPAA Journal, and others. Some primary sites blocked automated access (Joint Commission, HIMSS, several NHS England pages, EUR-Lex, Federal Register). Those points are tagged [R] or [U]. **This is not legal advice.** Engage counsel in each target jurisdiction before entering the market.

---

## 0. Executive summary

1. **The US HIPAA Security Rule overhaul is still only proposed.** The NPRM was published 6 Jan 2025 and comments closed 7 Mar 2025. As of October 2026 there is no final rule, and the regulatory agenda now targets final action around **July 2027** [1][2][3]. The proposal would remove "addressable" specifications and require MFA, encryption at rest and in transit, an annual asset inventory and network map, vulnerability scans every 6 months, annual penetration tests, and **restoration of critical systems within 72 hours** [2][3][5]. **Build to the NPRM now.** OCR enforcement (risk-analysis initiative, extended to risk management in 2026 [13]) and enterprise RFPs already expect these controls.
2. **The 2024 HIPAA reproductive-health privacy rule is gone.** It was vacated nationwide on 18 Jun 2025 (*Purl v. HHS*), and the appeal was dismissed in Sept 2025. Only the NPP changes tied to substance use disorder (SUD) survive [6][7]. Sensitive-data segmentation is still needed, because state laws keep tightening (WA My Health My Data [11], state shield laws, Texas).
3. **42 CFR Part 2 compliance has been mandatory since 16 Feb 2026, and OCR now enforces it.** OCR announced the programme on 13 Feb 2026, and enforcement started 16 Feb 2026 [8][9][10][79]. The HMS must support SUD record labelling, single TPO consent, redisclosure notices, separate SUD counseling notes, and a block on using records in proceedings against the patient.
4. **The EU AI Act high-risk dates moved.** The Digital Omnibus on AI is final: Regulation (EU) 2026/1744, adopted by Council 29 Jun 2026 and published in the OJ on 24 Jul 2026 [33]. Stand-alone Annex III systems (for example emergency-triage AI) are due **2 Dec 2027**, and AI embedded in Annex I products (MDR/IVDR device software) is due **2 Aug 2028** [31][32][33]. The Omnibus also **softened Art. 4 AI literacy** (applicable since Feb 2025). Providers and deployers must now *support the development of* staff AI literacy rather than guarantee a level of it (§2.3). **Art. 50 transparency applies from 2 Aug 2026**, and providers of generative systems already on the market have until **2 Dec 2026** for Art. 50(2) marking [31][32]. We ship AI-literacy training tracking regardless (`09` G26). *(Reconciled 2026-10-16: this summary previously said Art. 4 and Art. 50 were "unchanged", which contradicted §2.3.)*
5. **EHDS (Regulation (EU) 2025/327) has been in force since 26 Mar 2025.** It turns EHR systems into a regulated product class with security, interoperability and logging requirements and self-certification. Cross-border priority data follows in two waves: patient summaries and e-prescriptions by **Mar 2029**; images, lab results and discharge reports by **Mar 2031**. Secondary use applies from 2029 [28]. Patients get a right to see who accessed their data, so **the audit log becomes a patient-facing product feature**.
6. **The EU Cyber Resilience Act (CRA) has its first obligations live now.** Reporting of actively exploited vulnerabilities started **11 Sep 2026**, and full obligations apply from **11 Dec 2027** [30]. Reporting also covers products already on the EU market before Dec 2027 [84]. Pure SaaS is largely out of scope, and MDR-regulated modules are excluded [U]. On-prem installers, desktop and mobile clients, and downtime/edge appliances we sell into the EU are in scope.
7. **NIS2 makes EU hospitals "essential entities", and they push supply-chain security requirements down to vendors** [29]. The Commission proposed targeted NIS2 amendments on 20 Jan 2026 [29].
8. **India's DPDP timeline.** The DPDP Rules 2025 were notified 13/14 Nov 2025. Consent-manager registration starts about 13 Nov 2026, and the substantive obligations (notice/consent, security, breach reporting, retention, children's data, SDF duties) apply **13 May 2027** [14][15]. MeitY consulted on compressing this to 12 months, but no amendment had been notified as of Sept–Oct 2026 [16][17]. CERT-In's 6-hour incident reporting and 180-day in-India log retention already apply [80].
9. **Data localization is the most important architectural constraint for selling internationally.** Examples: UAE (Federal Law No. 2 of 2019, Art. 13), China (PIPL plus health-data rules), Australia (My Health Record), Saudi Arabia (NCA/government data), Germany (§393 SGB V + C5), France (HDS), Kenya (strategic-interest processing), and even US state law: Texas SB 1188 has required US-only EHR storage since 1 Jan 2026 [75]. **Design in-country "sovereign cells" from day one** [19][20][23][75][81][U].
10. **FDA rewrote its CDS guidance (6 Jan 2026, reissued 29 Jan 2026)** [42]. Some 2022 positions are relaxed: a single clinically appropriate recommendation can be non-device. **Time-critical alerts are still devices**, including sepsis/stroke alarms and deterioration alerts from serial vitals in the EHR [42]. *(Reconciled 2026-10-16 with `03`, `08` and `09`. v1 ships NEWS2/PEWS only as transparent published-score calculators on nurse-entered vitals with escalation tasks. They are versioned in the regulated-module track and released first in non-US markets. Sepsis screening is non-interruptive and rule-based, and it shows its inputs. v1 has no automated continuous alarms from device streams, and US deployments use cleared partners. Each function still needs a per-market classification under FDA, EU MDR Rule 11, SFDA, CDSCO and the UAE regime.)* Premarket cybersecurity guidance was updated Feb 2026 [46]. The AI-enabled device guidance is still a draft (Jan 2025) [45]. Blood-bank software (BECS) remains a **Class II 510(k) device** [47].
11. **The threat level is high and still rising.** 2024: 741 large breaches affecting more than 289M individuals; Change Healthcare alone was 192.7M [52][54]. 2025: about 772–805 large breaches affecting about 138.5M individuals, with hacking/IT incidents above 80% [52]. Comparitech counted 410 ransomware attacks on healthcare organisations in H1 2026, up 14% from 360 in H2 2025. Of these, 247 hit providers (only about +3–4%) and 163 hit healthcare businesses such as billing, pharma and health-tech firms (about +35%). **Vendors like us are the fastest-growing target** [65][78]. **Patient harm is now documented.** The Synnovis attack was a contributing factor in a patient's death, with about 170 harm events [57][59]. Peer-reviewed studies show spill-over to neighbouring emergency departments [66] and widespread care disruption [67].
12. **The same root causes recur:**
    - remote access without MFA (Change Healthcare)
    - phishing or malicious downloads (HSE, Ascension)
    - 6–8 weeks of undetected dwell time (HSE, Kettering)
    - over-privileged administrator accounts and flat networks
    - backups that were not isolated (HSE had only periodic offline tape)

    EHR outages lasted **2 to 16+ weeks** [53][55][60][63]. **Design for 4–6 weeks of degraded operation, not hours.**
13. **What buyers require as a baseline:**
    - SOC 2 Type II and/or ISO 27001 (often both); HITRUST r2 for large US health systems
    - a penetration test within the last 12 months, BAA/DPA, SBOM, phishing-resistant MFA
    - audit logs that can be exported to the customer's SIEM, and customer-managed keys
    - tested RTO/RPO evidence

    Market-specific extras: **UK** needs DSPT + DTAC + DCB0129 + Cyber Essentials Plus. **India** needs NABH digital-health certification and in-country hosting. **KSA** needs NCA ECC/CCC alignment. **Abu Dhabi** needs ADHICS support.
14. **Accreditation drives HMS features:** downtime continuity, two-identifier patient ID, critical-result closed loop, medication reconciliation, BCMA/closed-loop administration, record authentication timeliness, audit. Relevant schemes: Joint Commission (Accreditation 360 from 1 Jan 2026, with 14 National Performance Goals replacing the NPSG chapter for hospitals [77]), JCI 8th ed. (effective 1 Jan 2024 [U]), NABH 6th ed. (effective **1 Jan 2025** [69]), HIMSS EMRAM Stage 6/7, and China EMR grading with MLPS Level 3 [U].
15. **Bottom line for the build.** Treat trust as a platform: identity, policy/consent, audit, keys and residency should be shared services every module uses. Keep the core HMS outside medical-device regulation, and put device-grade functions in a separately governed "regulated module" track. Ship a read-only downtime system and immutable, isolated recovery in v1. Sequence certifications as SOC 2/ISO first, then India and the GCC (KSA, then UAE), then MDR/AI Act/EHDS and other markets as each entry decision is made. ONC/HITRUST wait for the US go/no-go (Phase 3), and UK certifications wait for a UK entry decision. *(Reconciled 2026-10-16 to the pack's single market roadmap; see §9.2 and `06` §8.)*

---

## 1. Privacy and data-protection law

### 1.1 United States

**HIPAA (45 CFR Parts 160/164).** As a hosted HMS vendor we are a **business associate (BA)** of every covered-entity customer. We are directly liable for Security Rule compliance and for some Privacy Rule obligations, and we must sign BAAs.

Product requirements that follow from current HIPAA:
- Risk analysis support and evidence.
- Access controls, audit controls, integrity, and person/entity authentication (§164.312).
- Patient right of access within 30 days. The 2020 Privacy NPRM proposed 15 days, and HIPAA Journal reports a Privacy Rule final action targeted for August 2026. It had not been published at last check, and HIPAA Journal now expects it before the end of 2026 [1].
- Amendment (§164.526), accounting of disclosures (§164.528), minimum necessary, restrictions, and confidential communications.
- Breach notification support: individuals within 60 days of discovery; HHS (contemporaneously if 500+); media for 500+ residents of a state.

**OCR enforcement (2025–2026) [V, 13].**
- 2025: 14 actions (12 settlements, 2 civil money penalties). About 10 cited risk-analysis failures.
- 2026 to date: 11 settlements. OCR says its **risk-analysis initiative expands to risk management** in 2026.
- The Right of Access initiative has produced more than 50 penalties [1].
- 2026 inflation-adjusted CMP minimums per violation are $145 (Tier 1), $1,461 (Tier 2), $14,602 (Tier 3) and $73,011 (Tier 4). The official annual cap is **$2,190,294** per violation category for all tiers. Under OCR's 2019 Notice of Enforcement Discretion, the effective annual caps are lower for Tiers 1–3: about $36.5k, $146k and $365k [13].

**HIPAA Security Rule NPRM, status and contents.**
- Status: NPRM published 6 Jan 2025 (RIN 0945-AA22). More than 4,700 comments. The final rule missed its May 2026 target, and the agenda now targets about July 2027. More than 100 provider groups asked HHS to withdraw it [2][3]. If finalized, it takes effect 60 days after publication, with compliance about 180 days later (about 240 days total), and BAA updates within one year [2][3].
- Proposed requirements [2][3][5]:
  - removal of "addressable" specifications
  - mandatory MFA
  - encryption of ePHI at rest and in transit
  - written technology asset inventory and network map, reviewed at least annually
  - vulnerability scanning at least every 6 months
  - penetration testing at least annually
  - restoration of critical electronic information systems and data within **72 hours**
  - annual compliance audit
  - BA safeguard verification
  - network segmentation and anti-malware [U for the last three]
  - patch timelines (reported as 15 days for critical and 30 days for high) [U]
  - 24-hour notifications about workforce access changes and contingency-plan activation [U]
- HHS estimated first-year industry cost at about $9B [3].
- **Legislative track.** HIPAA Journal reports that the US Senate unanimously passed the Health Care Cybersecurity and Resiliency Act on 1 Oct 2026, and the bill now goes to the House [R, 1]. Watch it as a possible statutory route to similar controls.
- **Recommendation:** design to the NPRM as if it were final. It is now the de-facto US buyer baseline.

**2024 Reproductive Health Privacy Rule: vacated.**
- On 18 Jun 2025 the N.D. Texas court in *Purl v. HHS* (2:24-cv-228-Z) vacated the rule nationwide. The only part kept was the NPP amendments relating to Part 2/SUD [6].
- Intervenors' appeals were dismissed in Sept 2025, so the vacatur appears final. The attestation requirement no longer applies [7].
- **Design implication:** keep the "reproductive health" sensitivity label and attestation-capture workflow as an **optional, configurable** policy. State laws (shield laws in several states, WA MHMDA) and customer policy may still require them.

**42 CFR Part 2 (SUD records), 2024 final rule.**
- Published 16 Feb 2024 (89 FR 12472), effective 16 Apr 2024, **compliance required 16 Feb 2026**. Administration and civil enforcement moved to OCR (Aug 2025), and OCR announced its Part 2 enforcement program on 13 Feb 2026 [8][9][10].
- Key mechanics [8][9][U for detail]:
  - a single patient consent can cover all future treatment, payment and healthcare operations (TPO) uses
  - HIPAA covered entities and BAs that receive records under that consent may redisclose them as HIPAA permits
  - records may **not** be used in civil, criminal, administrative or legislative proceedings against the patient without specific consent or a court order
  - HIPAA-style breach notification and penalties apply
  - "SUD counseling notes" need separate consent
  - every disclosure must carry a notice (a copy of the consent or a clear explanation)
- **Required HMS capabilities:**
  - Part 2 program flags at facility, department and provider level
  - a sensitivity label on SUD data elements and documents
  - a consent registry holding Part 2 TPO consents and revocations
  - automatic redisclosure notices on outbound documents and messages (CCD, FHIR, fax, print)
  - legal-proceedings disclosure blocks with an override that requires a court order
  - a separate SUD counseling-notes type
  - accounting of disclosures

**Information blocking (Cures Act; 45 CFR Part 171).**
- Developers of certified health IT and HIN/HIEs are liable if they "know or should know" a practice is likely to interfere with access to EHI. Providers are liable only if they know it is unreasonable [12].
- Enforcement is active: HHS announced a "crackdown" on 3 Sep 2025, followed by an ONC enforcement alert (Sept 2025), enforcement-discretion notices (24 Nov 2025) and an updated portal process (Apr 2026) [12].
- OIG can impose CMPs of up to $1M per violation on developers and HINs (effective Sept 2023), and providers face CMS disincentives (final rule 2024) [U].
- **Tension with privacy/security:** security controls that block access must be narrowly tailored, documented and applied consistently (Security Exception). Privacy-driven withholding must fit the Privacy Exception.
- **Design implication:**
  - security throttles and app-vetting rules must be policy-documented, consistent and non-discriminatory
  - immediate release of results and notes to the patient portal must be the default (with configurable exceptions such as Preventing Harm)
  - ship an "EHI export" capability

**State laws (selected).**
- **Washington My Health My Data Act** [V, 11]. Covers "consumer health data" outside HIPAA, including inferences. Applies from 31 Mar 2024 (small businesses from 30 Jun 2024). Requires consent to collect and share, and a valid signed authorization to sell (kept 6 years). Deletion rights extend to archives and backups. Violations are per se Consumer Protection Act violations, with **private right of action**. This matters for any non-HIPAA features: marketing sites, wellness apps, pre-registration forms, cookies.
- **California CCPA/CPRA and CMIA** [U]. PHI under HIPAA and medical information under CMIA are largely exempt from CCPA, but employee, marketing and website data is covered. CMIA reaches some digital health providers.
- **Texas.** HB 300 adds stricter training and a 15-business-day electronic access rule [U]. **SB 1188 (2025)** [V, 75] was signed in June 2025, and most provisions took effect 1 Sep 2025:
  - From **1 Jan 2026**, covered entities must keep EHRs of Texas patients **physically maintained in the US or a US territory**. This includes records held by third-party, subcontracted or cloud facilities, and it applies to records created before that date.
  - EHRs need a biological-sex-at-birth field. Practitioners must disclose AI use in diagnosis. Parents and guardians get immediate access to a minor's record unless law restricts it.
  - The AG can seek civil penalties of $5k (negligent), $25k (knowing) and $250k (PHI used for financial gain) per violation, and licensing regulators can discipline repeat violations.
  - Law-firm commentary is split on whether offshore *view-only access* is restricted, or only storage [R].
  - **This is a binding US-only hosting constraint, including backups, replicas and DR copies.**
- **Online tracking technologies** [U]. OCR's tracking-tech bulletin was partly vacated (*AHA v. Becerra*, N.D. Tex., June 2024), but class actions over pixels on patient portals continue. **No third-party trackers on authenticated pages.**

### 1.2 European Union

**GDPR in a medical-record context [U unless noted].**
- **Lawful basis.** Health data is special-category data (Art. 9), so both an Art. 6 basis and an Art. 9 condition are needed:
  - Art. 6: typically 6(1)(c) legal obligation, (e) public task, or (b) contract for private providers
  - Art. 9: typically **9(2)(h)** provision of health care under professional secrecy (Art. 9(3)), 9(2)(i) public health, 9(2)(j) research with safeguards
  - Consent is generally **not** the right basis for core clinical record-keeping
- **DPIA.** Mandatory for large-scale processing of special-category data (Art. 35(3)(b)), so every hospital deployment needs one. Vendors should provide a DPIA "kit" with data flows, sub-processors, transfer impact assessments and security measures.
- **Data subject rights:**
  - Access (Art. 15): CJEU C-307/22 (Oct 2023) confirmed patients are entitled to a **free first copy** of their medical record regardless of their reason.
  - Rectification (Art. 16): implement as amendment/addendum, never overwrite.
  - Erasure (Art. 17): usually limited by Art. 17(3)(b)/(c) because retention laws apply.
  - Restriction (Art. 18), portability (Art. 20), and objection to research or secondary uses.
- **Controller/processor.** The hospital is the controller and we are the processor (Art. 28 DPA), with sub-processor flow-down. Art. 32 security, Art. 33 72-hour breach notification by the controller (we must notify the controller "without undue delay"; contracts typically say 24–48 h), and Art. 25 privacy by design.
- **Fines.** Up to €20M or 4% of turnover (Art. 83(5)). Security and breach-notification failures fall in the €10M/2% tier (Art. 83(4)).
- **Transfers.** No general localization, but Chapter V applies: adequacy decision, SCCs plus a transfer impact assessment, or BCRs. The EU–US Data Privacy Framework survived a General Court challenge (*Latombe*, Sept 2025), with an appeal reported pending [U].
- **GDPR "Digital Omnibus"** [R, 82]. The Commission proposed it on 19 Nov 2025 (COM(2025) 837; procedure 2025/0360(COD)). Proposed changes:
  - a relative definition of personal data: data is not personal for a holder with no means reasonably likely to identify the person
  - breach notification to the authority only for "high-risk" breaches, with the deadline extended from 72 h to **96 h**
  - a single EU incident-reporting entry point shared with NIS2, DORA and eIDAS

  As of Oct 2026 it is still before Parliament and Council, with no trilogue agreement found. The EDPB has objected to the narrower personal-data definition. Art. 33's 72-hour rule still applies. Track it, but do not design to it until it is adopted.

**European Health Data Space (EHDS), Regulation (EU) 2025/327 [V, 28; details U].**
- Published 5 Mar 2025 and in force 26 Mar 2025. Key implementing acts are due by **Mar 2027**.
- Primary-use cross-border exchange: group 1 (patient summaries, ePrescription/eDispensation) by **Mar 2029**; group 2 (medical images, lab results, hospital discharge reports) by **Mar 2031**.
- Secondary-use rules apply to most categories (EHR data) by Mar 2029, and to the rest (for example genomic data) by Mar 2031 [28].
- **For EHR system manufacturers (us)** [U]:
  - essential requirements on interoperability and security/logging, built around two harmonised components: a "European interoperability software component" and a "European logging software component"
  - technical documentation, EU declaration of conformity, **CE marking** (self-certification) and registration in an EU database
  - post-market obligations
  - These obligations are tied to the 2029/2031 data-category waves.
- **Patient rights in primary use** [U]: immediate free electronic access, the right to add information, rectification, portability, the right to **restrict** health professionals' access, and the right to **information on who accessed their data**.
- **Secondary use** [U]: patients have an opt-out. Hospitals (as data holders) must make data available to health data access bodies, which process it in secure processing environments.
- **Design implications:**
  - an EHDS-conformant logging component
  - patient-facing access transparency
  - patient-controlled access restrictions with emergency override
  - EEHRxF (European EHR exchange format, FHIR-based) export
  - secondary-use datasets with opt-out enforcement

**NIS2, Directive (EU) 2022/2555 [V/U, 29].**
- Transposition deadline 17 Oct 2024. Healthcare providers are in Annex I "Health", making them essential entities [U].
- Customer obligations [U]: Art. 21 risk-management measures, including supply-chain security; management-body accountability; reporting within **24 h (early warning), 72 h (notification) and 1 month (final report)**; fines of at least €10M or 2% of turnover for essential entities.
- Hospitals will flow these duties down to us by contract: security measures, incident notification fast enough for their 24 h clock, audit rights, and evidence of coordinated vulnerability disclosure.
- The Commission proposed targeted NIS2 amendments on 20 Jan 2026 [29].

**National overlays to plan for [U, verify each]:**
- **France: HDS.** Hosting of health data requires HDS certification. Referential v2 (2024) adds EEA hosting and transparency about non-EU access.
- **Germany: §393 SGB V.** Cloud processing of health/social data requires a **BSI C5 attestation (Type 2)** and processing in Germany, the EU/EEA, or an adequate country with a German establishment. Germany also has hospital IT security under §75c/§391 SGB V (B3S for KRITIS hospitals).
- **Netherlands: NEN 7510** (information security in healthcare, mandatory), **NEN 7512** (trust basis for data exchange), and **NEN 7513** (logging of access to electronic patient records). NEN 7513 is an excellent specification for audit-log fields.
- **Spain: ENS** (Esquema Nacional de Seguridad) for public-sector hospitals.

### 1.3 United Kingdom

- **UK GDPR and DPA 2018.** Similar to the EU regime; fines up to £17.5M or 4%.
- **Data (Use and Access) Act 2025 (c. 18)** [V/U, 35]:
  - amends UK GDPR on recognised legitimate interests (Sch. 4), automated decision-making (s.80), scientific research consent (s.68) and a controller complaints procedure (s.103)
  - **s.121 and Schedule 15 create information standards for health and adult social care in England that apply directly to IT suppliers** (para. 4) and allow compliance notices to "relevant IT suppliers" (para. 8)
  - Royal Assent June 2025, with staged commencement [U]
  - Result: NHS interoperability and information standards become **enforceable against vendors**, not only against NHS bodies.
- **National data opt-out** [U]. Patients can opt out of their confidential patient information being used for research and planning beyond their individual care. Organisations must apply it, using the NHS "Check for National Data Opt-outs" service. The HMS secondary-use pipeline must honour it, and GP Type 1 opt-outs, when processing NHS data.
- **Caldicott Principles and Caldicott Guardians** [U] shape access governance: role-based access, legitimate relationships, smartcard/RBAC norms.
- **DSPT** [V, 36]:
  - 2024-25: CAF-aligned for Trusts/ICBs/CSUs/ALBs; v7 published Oct 2024.
  - 2025-26: v8 published 18 Sep 2025, with independent-audit scope covering Trusts, ICBs, ALBs, CSUs, OES, Genomics **and IT suppliers**.
  - 2026-27: v9 published 2 Oct 2026. **Corrected in pass 2:** the 2026-27 mandatory audit scope (1 Oct 2026) **does include IT suppliers**. It has a separate list of 12 mandatory outcomes for them: lawful-basis framework, staff contracts, training, just culture, staff records, anti-virus/email protection, incident response, software and hardware support status, penetration testing, firewall management, and supplier due diligence. Detailed IT-supplier audit guidance was "to be shared shortly" [36][87].
  - Suppliers handling NHS patient data must still complete the DSPT; "Standards Met" is a procurement gate [U].

### 1.4 India

- **DPDP Act 2023 and DPDP Rules 2025** (G.S.R. 846(E); notified 13 Nov 2025, gazetted 14 Nov 2025) [V, 14][15]:
  - **Phase I (13 Nov 2025):** Data Protection Board provisions.
  - **Phase II (about 13 Nov 2026):** Consent Manager registration (Rule 4). A Consent Manager must be an India-incorporated company with net worth of at least ₹2 crore [R]. Fiduciaries are not required to integrate with consent managers [14].
  - **Phase III (13 May 2027):**
    - notice and consent
    - reasonable security safeguards
    - breach reporting to the Board "without delay", with a detailed report within 72 h, and notice to individuals
    - retention and erasure
    - children's data: verifiable parental consent for under-18s, with **exemptions for clinical and mental-health establishments and healthcare professionals** for certain purposes
    - Significant Data Fiduciary (SDF) duties: India-based DPO, independent auditor, annual DPIA and audit, algorithmic due diligence, possible localization of specified data
    - data principal rights and cross-border rules (blacklist approach)
    - **minimum one-year retention of logs** [14]
  - **Maximum penalty:** ₹250 crore for failure to maintain reasonable security safeguards [14].
  - **Status check:** MeitY consulted (Jan 2026; feedback closed 4 Feb 2026) on compressing the timeline to 12 months for SDFs and some provisions [16][18]. As of the source's 20 Sep 2026 review, no amending notification had been found. MeitY invited applications for the Data Protection Board on 6 May 2026, but no Chairperson or Members had been reported as appointed [17]. No SDF designations were found in the sources checked; this is not independently confirmed. **Plan to be ready by Nov 2026 where feasible** as a buffer.
- **Until May 2027, the IT Act 2000 and the 2011 SPDI Rules** (medical records are sensitive personal data) remain operative [14].
- **CERT-In Directions No. 20(3)/2022 (28 Apr 2022)** [V, 80]:
  - report Annexure I cyber incidents to CERT-In **within 6 hours** of noticing them (partial information is acceptable at first)
  - keep logs of all ICT systems for a rolling **180 days within Indian jurisdiction**
  - synchronise clocks to NIC/NPL NTP servers (or servers traceable to them)
  - designate a point of contact
  - Applies to service providers, intermediaries, data centres, body corporates and government organisations. Non-compliance is punishable under s.70B(7) of the IT Act.
  - DLA Piper notes logs may be held abroad if they can be produced to CERT-In within a reasonable time [14]. The Directions themselves say "within the Indian jurisdiction", so treat in-India log retention as the safe default.
- **ABDM** (Ayushman Bharat Digital Mission) [R/U]:
  - Health Data Management Policy: consent artefacts via the ABDM consent manager, ABHA IDs, data stored in India for ABDM flows
  - HMS integration milestones (M1 ABHA creation/linking, M2 HIP data sharing, M3 HIU consent-based fetch) are de-facto requirements for Indian hospitals, especially those under PM-JAY
  - Aadhaar numbers, if stored, must sit in an Aadhaar Data Vault (HSM-encrypted) under UIDAI rules [U]

### 1.5 Gulf Cooperation Council

**Saudi Arabia, PDPL** [V, 19]:
- In force 14 Sep 2023, compliance from 14 Sep 2024, actively enforced by SDAIA (as of 2026).
- Health data is "sensitive" data. A DPO is required where core activities involve sensitive data, and registration on the National Data Governance Platform is required in practice.
- Breach notice to SDAIA within **72 h**. Transfers under the Transfer Regulations require adequacy or appropriate safeguards and must be limited to the minimum necessary.
- Penalties: up to SAR 5M administrative fines (doubled for repeat offences). Disclosing sensitive data with intent to harm or for personal benefit carries **up to 2 years' imprisonment and/or SAR 3M**.
- **Overlay** [U]:
  - NCA Essential Cybersecurity Controls (ECC, revised 2024) and Cloud Cybersecurity Controls (CCC, revised 2024) apply to government entities and CNI, and are commonly imposed on private hospitals by contract
  - CST cloud regulatory framework (CSP registration and data classification)
  - government and MOH data hosted in-Kingdom
  - integration with NPHIES (national insurance exchange) and MOH platforms
  - **In practice, plan for in-Kingdom hosting with a CST-registered CSP.**

**United Arab Emirates** [V/U, 20]:
- **Federal Law No. 2 of 2019 (ICT in Health Fields).** Applies to all health entities, insurers, TPAs and similar. **Art. 13 prohibits storing, processing, generating or transferring health data outside the UAE** except as permitted by decision of the Health Authority in coordination with the Ministry. Ministerial Decision No. 51 of 2021 sets out the exceptions [20]. Cabinet Resolution 32/2020 implements the central EMR system [20]. Retention is **at least 25 years** from the last health procedure, longer where needed (Art. 20) [V, 81]. Breaching the Art. 13 localization rule carries a fine of AED 500,000–700,000 [81].
- **The Federal PDPL (Decree-Law 45/2021)** leaves health data to the sectoral law. Its Executive Regulations were still unpublished as of Jan 2025 [20].
- **DIFC and ADGM** (including DHCC) have their own regimes [20].
- **Abu Dhabi.** DoH's **ADHICS** standard is mandatory for DoH-licensed facilities and has control levels by entity type; integration with **Malaffi** (the Abu Dhabi HIE) is required [U].
- **Dubai.** DHA health data protection policies; NABIDH HIE integration; the DESC Information Security Regulation (ISR) for Dubai government entities [U].
- **Northern Emirates.** MOHAP's Riayati platform [U].
- **Design implication:** UAE deployments must run in UAE regions (Azure UAE North/Central, AWS me-central-1, Oracle/G42/Core42 sovereign options), with support access from abroad tightly controlled and logged.

### 1.6 Asia-Pacific

**Singapore** [V, 21; U]:
- PDPA: consent or deemed consent, DPO required, "comparable protection" for offshore transfers.
- Breach notification to the PDPC **within 3 calendar days** of assessment if there is significant harm or 500+ individuals are affected.
- Penalties up to 10% of Singapore turnover (for turnover above S$10M) or S$1M.
- Public healthcare follows government IM8 and Public Sector (Governance) Act rules rather than PDPA [21].
- **Healthcare Services Act** licensing conditions and MOH cybersecurity requirements apply [U].
- **Health Information Act (HIA)** [V, 76; details R]. Parliament passed the Health Information Bill on **12 Jan 2026** (first reading Nov 2025). MOH intends it to commence in **early 2027**.
  - All licensed healthcare providers must contribute key health information to the National Electronic Health Record (NEHR): allergies, vaccinations, diagnoses, medications, lab results, radiology images and discharge summaries.
  - It adds data-security and cybersecurity duties for providers.
  - Patients can monitor NEHR access via HealthHub. Insurer access to NEHR is prohibited.
  - MOH has published an HIA overview circular (6 Mar 2026), "NEHR Contribution Requirements" (27 Jul 2026) and HIA Implementation Guide v2.0 (14 Aug 2026).
  - **NEHR contribution is therefore a mandatory interface for any HMS sold to Singapore private providers from 2027.**

**Australia** [V, 22; U]:
- Privacy Act 1988 as amended by the **Privacy and Other Legislation Amendment Act 2024**:
  - statutory tort for serious invasions of privacy (commenced June 2025 [U])
  - **automated-decision transparency in privacy policies from 10 Dec 2026** [22]
  - Children's Online Privacy Code framework
- Health information is sensitive information. Notifiable Data Breaches require assessment within 30 days.
- Penalties for serious interference: the greater of AUD 50M, 3x the benefit, or 30% of adjusted turnover [22].
- **My Health Records Act 2012 s.77** prohibits holding or processing My Health Record data outside Australia [U].
- **SOCI Act:** "critical hospitals" have registration, critical-infrastructure risk-management program and 12 h/72 h incident-reporting duties [U].
- **Cyber Security Act 2024:** ransomware-payment reporting within 72 h for larger businesses (from 30 May 2025) [U].
- State health departments typically require onshore hosting, IRAP-assessed clouds and Essential Eight maturity [U].

**China** [V, 23; U]:
- Under PIPL, medical health information is **sensitive personal information**, requiring **separate consent**, a PIPIA (records kept at least 3 years), and specific notice [23].
- Cross-border transfers [23]:
  - a CAC security assessment for sensitive PI of more than 10,000 people per year, important data, or CIIO transfers
  - otherwise the standard contract filed within 10 working days, or certification (available from 1 Jan 2026)
- Compliance audits [23]: at least every 2 years for processors of PI of more than 10M people (Measures effective 1 May 2025). The Network Data Security Management Regulation (effective 1 Jan 2025) requires a network data security officer above that threshold.
- Penalties: up to 5% of prior-year revenue [23].
- **Health-specific localization** [U]: population health information and health/medical big data must be stored within China.
- **MLPS 2.0** (GB/T 22239-2019) [U]: hospital core systems are generally classified **Level 3**, which requires testing by an accredited evaluator.
- **Market reality:** China requires an in-country partner or JV, local hosting, MLPS certification, local cryptography (SM2/SM3/SM4 under the Cryptography Law for some systems) and EMR-grading alignment. **Treat it as a separate product line, not a region switch.**

### 1.7 Latin America and Africa

**Brazil, LGPD** [V, 24]:
- Health data is sensitive. "Protection of health" is a legal basis only for procedures by health professionals, health services or sanitary authorities.
- Breach notice to the ANPD and data subjects **within 3 working days** (Resolution CD/ANPD 15/2024). Incident records must be kept 5 years.
- International transfers via ANPD SCCs (Resolution 19/2024). **EU–Brazil mutual adequacy has been in place since Jan 2026.** The Commission's adequacy decision for Brazil is dated 26 Jan 2026, with the mutual adoption announced 10 Feb 2026 [24][74].
- DPO required. Fines of up to 2% of Brazilian revenue, capped at BRL 50M per infraction [24].
- Art. 11 §4 restricts sharing health data for economic advantage [U].

**Kenya, Data Protection Act 2019** [V, 25; U]:
- **Mandatory ODPC registration for health administration and patient care, regardless of size.** Certificates are valid 24 months.
- Health data is sensitive. Transfers need documented safeguards, and **consent for sensitive data leaving Kenya**.
- Breach notice to the Data Commissioner within 72 h; processors must notify controllers within 48 h.
- Penalty: KES 5M or 1% of turnover, **whichever is lower** [25].
- **Data Protection (General) Regulations 2021, reg. 26** [U] requires processing for listed "strategic interests" (reportedly including public health) to be done in Kenya, or at least with a serving copy in Kenya.
- **Digital Health Act 2023** adds health-information governance and a Digital Health Agency [U].
- **Assume in-country hosting for public-sector and possibly all health deployments.**

**Nigeria, NDPA 2023 and GAID 2025** [V, 26]:
- Health status is sensitive data.
- **Registration as a data controller/processor of major importance (DCPMI): tertiary and secondary hospitals are "Extra-High Level"** (fee ₦100k, annual Compliance Audit Return due 31 March). Primary health centres and labs are "Ordinary High Level".
- Breach notice to the NDPC within 72 h. Transfers via adequacy or NDPC-approved instruments.
- Fines: the greater of 2% of revenue or ₦10M for DCPMIs [26].
- Government data hosting rules (NITDA local-content guidelines) may require local hosting for public hospitals [U].

**South Africa, POPIA** [V, 27]:
- Health is "special personal information", prohibited without consent unless an exception applies.
- **Prior authorisation from the Information Regulator** for transfers of special personal information to countries without adequate protection.
- Breach notice to the Regulator and data subjects "as soon as reasonably possible". From April 2025 notifications are reportedly via the Regulator's eServices portal [U].
- Registered Information Officer required. Fines up to R10M; offences up to 10 years [27].
- The National Health Act also imposes confidentiality duties [U].

### 1.8 Regulatory matrix

| Jurisdiction | Law / regulation | Scope | Key obligations for an HMS vendor | Data residency | Penalties | Status / dates |
|---|---|---|---|---|---|---|
| US (federal) | HIPAA Privacy, Security, Breach Notification Rules | Covered entities and BAs (vendor = BA) | BAA; Security Rule safeguards and risk analysis; support access, amendment, accounting of disclosures; breach notice to CE | None federally | 2026: $145–$73,011 minimum per violation by tier; cap $2,190,294 per category per year (lower for Tiers 1–3 under enforcement discretion); criminal; state AGs [13] | In force; OCR risk-analysis/risk-management initiative [13] |
| US (federal) | HIPAA Security Rule NPRM | Same | Mandatory MFA, encryption, inventory/network map, 6-monthly scans, annual pen test, 72 h restore, annual audit [2][3][5] | — | — | **Proposed**; final targeted about Jul 2027 [1][2][3] |
| US (federal) | 2024 Reproductive Health Privacy Rule | — | None (vacated); SUD NPP changes survive | — | — | Vacated 18 Jun 2025; appeal dismissed Sept 2025 [6][7] |
| US (federal) | 42 CFR Part 2 (2024 rule) | Part 2 programs, lawful holders, BAs, QSOs | SUD labelling, TPO consent, redisclosure notice, counseling notes, no use in proceedings, breach notice | — | HIPAA-aligned CMPs; criminal [8][9] | Compliance since **16 Feb 2026**; OCR enforcing [8] |
| US (federal) | Cures Act information blocking (45 CFR 171) | Certified health IT developers, HINs/HIEs, providers | Avoid interference with EHI access; narrowly tailored security/privacy exceptions; EHI export | — | OIG CMP up to $1M per violation [U]; provider disincentives | Enforcement push from Sept 2025 [12] |
| US (federal) | ONC Health IT Certification (45 CFR 170) | Needed for CMS programs (CEHRT) | (d)(1)–(13), (g)(10) API, (b)(11) DSI, (g)(3) SED, real-world testing, Insights | — | Certification termination | HTI-1/2/3/4 final; (b)(11) privacy & security update due 31 Dec 2027 [37][38] |
| US (state) | WA My Health My Data | Non-HIPAA consumer health data | Consent, authorization to sell, deletion incl. backups, privacy policy link | — | WA CPA; **private right of action** [11] | In force 2024 |
| US (state) | TX SB 1188 (2025) [75] | EHRs of TX patients (covered entities, incl. cloud/third-party storage) | EHRs physically maintained in the US/territories; birth-sex field; AI-use disclosure; parental access | **US only** (from 1 Jan 2026) [75] | AG civil penalties $5k/$25k/$250k per violation; licensing discipline [75] | In force 1 Sep 2025; storage rule from **1 Jan 2026** [75] |
| EU | GDPR | Controllers/processors handling EU data | Art. 28 DPA, Art. 32, breach support, DPIA kit, rights tooling, Art. 25 | No localization; Ch. V transfer rules | €20M/4% (security tier €10M/2%) | In force; Digital Omnibus amendments proposed 19 Nov 2025 (96 h/high-risk breach threshold), not adopted as of Oct 2026 [82] |
| EU | EHDS (Reg. 2025/327) | EHR manufacturers, providers, data holders | EHR essential requirements (interop + logging), CE self-cert, EU database, patient rights, secondary-use availability | Secondary use in secure processing environments | Set by Member States | In force 26 Mar 2025; 2027/2029/2031 waves [28] |
| EU | NIS2 | Hospitals (essential); vendors via supply chain | Flow-down Art. 21 measures; support 24 h/72 h/1-month reporting | — | ≥€10M/2% (essential) [U] | Transposed from Oct 2024; amendments proposed Jan 2026 [29] |
| EU | Cyber Resilience Act | Products with digital elements (not MDR devices; SaaS mostly out) [U] | Annex I secure-by-design, SBOM, vulnerability handling, support period, exploited-vulnerability and incident reporting | — | €15M/2.5% [U] | Reporting from **11 Sep 2026** (also for products already on the market [84]); full **11 Dec 2027** [30] |
| EU | AI Act (as amended by Digital Omnibus, Reg. (EU) 2026/1744, OJ 24 Jul 2026 [33]) | Providers/deployers of AI | High-risk: QMS, risk management, data governance, logging (Art. 12), transparency, human oversight, robustness, conformity, registration, post-market monitoring | — | €35M/7% (prohibited); €15M/3% (other) [U] | Annex III high-risk **2 Dec 2027**; Annex I (devices) **2 Aug 2028** [31][32] |
| EU | MDR 2017/745 | Device software (Rule 11) | QMS, technical file, notified body (IIa+), PMS, vigilance, UDI | — | National | Transition to 2027/2028 for legacy devices [U]; MDCG 2019-11 rev.1 (Jun 2025) [34] |
| France / Germany / NL | HDS; §393 SGB V + C5; NEN 7510/7513 [U] | Health data hosting / cloud | Certification or attestation; logging spec (NEN 7513) | FR: EEA; DE: DE/EU/adequate + German establishment [U] | National | In force [U] |
| UK | UK GDPR, DPA 2018, DUAA 2025 | Controllers/processors | DSPT; national data opt-out; **information standards binding on IT suppliers** [35] | No localization (NHS offshoring guidance) [U] | £17.5M/4% | DUAA 2025 staged commencement [35] |
| UK | DCB0129 / DCB0160; DTAC; DSPT | Health IT manufacturers / NHS deployers | Clinical risk management (CSO, hazard log, safety case); DTAC evidence; DSPT "Standards Met" | — | Procurement exclusion; DUAA compliance notices | DSPT v8 (2025-26), v9 (2026-27, published 2 Oct 2026; IT suppliers in mandatory audit scope) [36][87] |
| India | DPDP Act 2023 + Rules 2025 | Data fiduciaries/processors | Notice/consent; security; breach (72 h detailed); erasure; children; SDF DPIA/audit; 1-year log retention [14] | No general localization; blacklist; SDF localization possible; ABDM data in India [R] | Up to ₹250 crore [14] | 13 Nov 2025 / ~13 Nov 2026 / **13 May 2027** [14][15] |
| India | CERT-In Directions (2022) [80] | Service providers, intermediaries, data centres, body corporates, government | 6 h incident reporting; 180-day logs in India; NTP sync | Logs in India [80] | IT Act s.70B(7) | In force (since 2022) |
| Saudi Arabia | PDPL + Implementing & Transfer Regs; NCA ECC/CCC [U] | Controllers; government/CNI | DPO, registration, 72 h breach, transfer safeguards, NCA controls | Transfer regs; government/MOH data in KSA [U] | SAR 5M; SAR 3M + 2 years (sensitive) [19] | Enforced since 14 Sep 2024 [19] |
| UAE | Federal Law No. 2/2019 (ICT in Health) + Cabinet Res. 32/2020 + MD 51/2021 | All health entities | Localization; 25-year retention [81]; central EMR; emirate standards (ADHICS, DHA) | **In-country unless exception** [20] | AED 500k–700k for localization breach [81]; other fines/imprisonment under health and cyber laws [20][U] | In force (since May 2019) |
| Singapore | PDPA (+ HCSA; Health Information Act [76]) | Private sector; HIA: all licensed providers | DPO, 3-day breach notice, transfer limitation; HIA: mandatory NEHR contribution, cybersecurity duties | No general localization | 10% turnover or S$1M [21] | PDPA in force; HIA passed 12 Jan 2026, commencement planned early 2027 [76] |
| Australia | Privacy Act (POLA 2024); MHR Act; SOCI; Cyber Security Act 2024 [U] | APP entities; critical hospitals | NDB; ADM transparency (Dec 2026); incident reporting; ransomware-payment reporting | **MHR data onshore** [U]; state onshore norms | AUD 50M / 3x benefit / 30% turnover [22] | Reforms phased 2025–2026 [22] |
| China | PIPL, DSL, CSL, MLPS 2.0, health-data rules [U] | All processors | Separate consent, PIPIA, CAC mechanisms, audits, MLPS Level 3 | **In-country** (health/important data) [U] | Up to 5% revenue [23] | In force; certification route from 1 Jan 2026 [23] |
| Brazil | LGPD + ANPD Res. 15/2024, 19/2024 | Controllers/processors | DPO; 3-working-day breach notice; SCCs | None | 2%, max BRL 50M per infraction [24] | EU adequacy decision 26 Jan 2026 [24][74] |
| Kenya | DPA 2019 + Regs 2021; Digital Health Act 2023 [U] | Controllers/processors | Mandatory registration (health); 72 h breach; consent for sensitive transfers | Strategic-interest processing in Kenya [U] | KES 5M or 1% (lower) [25] | In force |
| Nigeria | NDPA 2023 + GAID 2025 | DCPMIs incl. hospitals | Registration; annual CAR; DPIA; 72 h breach | No general rule; government hosting norms [U] | Greater of 2% or ₦10M [26] | In force |
| South Africa | POPIA | Responsible parties | Information Officer; prior authorisation for some transfers; breach notice | None (transfer restrictions) | R10M; up to 10 years [27] | In force |

### 1.9 Data residency and localization matrix (deployment view)

| Market | Must clinical data stay in-country? | Practical hosting pattern | Support-access constraint | Notes |
|---|---|---|---|---|
| US | No (federal). **TX SB 1188 requires US-only physical storage of Texas patients' EHRs from 1 Jan 2026**, including cloud, backup and DR copies [75]. Federal health agencies require FedRAMP. | US regions (2+), US-only backups | Offshore support possible under BAA, but buyers often require US-only admin access | Customer contracts frequently say "US only" |
| EU (general) | No. Transfers need Ch. V mechanisms. | EU regions; EU-only backups and keys | Non-EU support needs SCCs/DPF plus a TIA; prefer EU follow-the-sun | Sovereignty demands rising (EU-only operators, HYOK) |
| France | **Yes in effect (EEA)**, HDS-certified host [U] | HDS-certified provider in FR/EEA | Disclose non-EEA access | HDS certificate is a hard procurement gate |
| Germany | **Restricted.** C5 Type 2 + DE/EU/adequate location [U] | German regions with C5-attested CSP | Strict | KRITIS hospitals: B3S/§391 SGB V [U] |
| UK | No. NHS guidance permits UK/EEA/adequate/US with safeguards [U] | UK regions preferred (NHS norm) | UK-based admin preferred | DSPT, DTAC |
| India | Not generally, but ABDM flows and public procurement require India hosting; CERT-In logs in India [80]; possible SDF localization [14][R][U] | India regions (MeitY-empanelled CSP for government) | India-based support for public hospitals | Aadhaar Data Vault if Aadhaar stored [U] |
| Saudi Arabia | **Effectively yes** for government/MOH; transfers restricted under PDPL [19][U] | In-Kingdom, CST-registered CSP; NCA CCC | In-Kingdom admin for government | NPHIES integration |
| UAE | **Yes** (Art. 13, Federal Law 2/2019) with narrow exceptions [20] | UAE regions | Remote support must not export data; log all sessions | 25-year retention [81] |
| Singapore | No (private sector); public healthcare follows government rules [21] | SG region | Comparable-protection contracts | HIA (passed Jan 2026, commencing early 2027) adds NEHR contribution and cybersecurity duties [76] |
| Australia | **Yes for My Health Record data**; state norms onshore [U] | AU regions, IRAP-assessed | Onshore admin for government | Essential Eight |
| China | **Yes** [U] | In-China via licensed local partner | No offshore access without CAC mechanism | Separate product line |
| Brazil | No | BR or adequate region | SCCs | EU adequacy |
| Kenya | **Likely yes** for strategic-interest/public health processing [U] | In-country DC or in-country serving copy | Consent needed for sensitive transfers [25] | Verify reg. 26 scope |
| Nigeria | No general rule; government data local [U] | Local or regional | NDPC transfer instruments | Annual CAR |
| South Africa | No; transfer conditions and prior authorisation [27] | ZA regions (AWS/Azure available) | Contracts/BCRs | — |

**Architectural conclusion.** We need a **cell-based, region-pinned deployment model**:
- each "sovereign cell" contains its own data stores, keys (in-country HSM/KMS, BYOK/HYOK), backups, logs, identity federation endpoints and support jump-hosts
- the global control plane carries no PHI: only telemetry scrubbed of identifiers, release artifacts and license data

---

## 2. Software certification and medical-device regulation

### 2.1 US ONC Health IT Certification Program (ASTP/ONC)

- **Why it matters.** US hospitals need certified EHR technology (CEHRT) to meet CMS Promoting Interoperability and avoid Medicare payment adjustments. For the US hospital market, ONC certification of the core EHR modules is **effectively mandatory** [U].
- **Rule set** [V, 37]: HTI-1 (final 9 Jan 2024: Cures Update, DSI/algorithm transparency, Insights), HTI-2 (final 16 Dec 2024: TEFCA, info blocking), HTI-3 (final 17 Dec 2024: Protecting Care Access), HTI-4 (final 4 Aug 2025: e-prescribing, real-time prescription benefit, prior-authorization APIs; part of CMS-1833-F).
- **Upcoming deadlines** [V, 38]: §170.315(b)(11) DSI "privacy and security requirements" update and (b)(3) e-prescribing updates are due **31 Dec 2027**. HTI-1 standards updates for (g)(10) (US Core / SMART v2) and others passed on 31 Dec 2025. The old (a)(9) CDS criterion expired 1 Jan 2025.
- **Deregulatory proposals** [U]: ASTP has signalled deregulation of the program in 2025–2026. The eCFR text was last amended 4 Aug 2025 [39]. **Verify the current criteria list before committing the US certification scope.**
- **HTI-5 retargeting (reconciled 2026-10-16 with `06` §4.2).** HTI-5 was proposed on 29 Dec 2025, and no final rule had been published as of 16 Oct 2026. It would remove 34 criteria, revise 7 and keep 19 [88][89]. All of **(d)(1)–(d)(13)** and **(g)(3)–(g)(6)** (including SED) would be removed, and **(b)(11)** would be revised to drop the source-attribute/model-card requirements. If the US goes ahead (Phase 3 go/no-go), the certification target is:
  - the **19 retained criteria**: (a)(1)–(a)(4), (a)(15), (b)(3), (b)(4), (b)(10), (c)(1), (c)(2), (f)(1)–(f)(3), (g)(10), (g)(31)–(g)(33), (j)(20), (j)(21);
  - the **7 revised criteria** in their revised form: (a)(5), (b)(1), (b)(11), (c)(3), (e)(1), (f)(5), (f)(6).

  The (d), (g)(3) and (b)(11) material below stays as our **internal engineering baseline**, because buyers and SAFER still expect those controls. It is no longer the certification scope.
- **Privacy and security criteria §170.315(d)(1)–(13)** [V, 39]:
  - (d)(1) authentication, access control, authorization
  - (d)(2) auditable events and tamper-resistance (logging on by default; records audit-log status and encryption status)
  - (d)(3) audit reports (by time period, sortable)
  - (d)(4) amendments (append accepted amendments; append request and denial if denied)
  - (d)(5) automatic access time-out
  - (d)(6) emergency access
  - (d)(7) end-user device encryption (or no local storage)
  - (d)(8) integrity (message digests)
  - (d)(9) trusted connection (message- or transport-level encryption and integrity)
  - (d)(10) auditing actions on health information (default-on, restricted disabling, alteration detection)
  - (d)(11) accounting of disclosures
  - (d)(12) encrypt authentication credentials (attestation)
  - (d)(13) multi-factor authentication (attestation plus use cases)
  - **The (d)(12)/(d)(13) "attest yes/no" model is a floor. Buyers expect "yes".**
- **Safety-enhanced design (g)(3)** [V, 39]: user-centred design applied to the listed safety-relevant criteria (CPOE, CDS, eMAR-related, etc.), **summative testing with at least 10 participants per capability**, reported per NISTIR 7742.
- **Decision Support Interventions (b)(11)** [V, 39]:
  - source attributes for evidence-based and **predictive** DSIs: developer, funding, intended use and users, out-of-scope cautions, training data, fairness/bias, external validation, performance, monitoring, update schedule
  - plain-language display to users
  - **intervention risk management** (validity, fairness, safety, security, privacy) and governance for predictive DSIs we supply
  - **This is effectively a US AI transparency regime for EHR vendors.**
- **Conditions and Maintenance of Certification** [V/U, 40]: annual real-world testing (plans and results), APIs (SMART/FHIR), information-blocking attestations, assurances, communications, and the **Insights Condition**. Insights reporting is phased; verify the current schedule.

### 2.2 US FDA: which HMS functions are devices?

**Non-device by statute (FD&C 520(o), Cures Act) and FDA examples** [V, 43]:
- administrative support: scheduling, bed/room management, shift rosters, billing codes, payments, accounting
- EHR functions: transfer, store, convert and display data; patient access
- medical device data systems (solely transfer/store/convert/display device data, e.g., PACS display, central-station data to a phone without analysis)
- display of lab results without interpretation
- secure clinician messaging
- **Caveat: software that generates alarms or alerts, or prioritizes patients on multi-patient displays, is not in the non-device category** [43].

**Clinical Decision Support guidance, January 2026** [V, 42]. First issued 6 Jan 2026. The current final version is dated 29 Jan 2026; its cover page says it "supersedes 'Clinical Decision Support Software' issued on January 6, 2026" (docket FDA-2017-D-6569). Together these replace the Sept 2022 guidance.

The four Non-Device CDS criteria:
1. does not acquire, process or analyze a medical image, an IVD signal, or a pattern/signal from a signal-acquisition system
2. displays, analyzes or prints medical information
3. supports or provides recommendations to an HCP
4. lets the HCP independently review the basis, so they do not rely primarily on it

Notable 2026 interpretations:
- **"Pattern"** means multiple, sequential or repeated measurements (e.g., ECG waveforms, CGM series, NGS outputs). A single discrete result (e.g., a blood pressure reading) is "medical information".
- **Single recommendations can be non-device.** Examples: a differential that "may present … a single clinically appropriate diagnostic recommendation when alternative diagnoses are highly improbable", a single care pathway for chronic low-back pain, transplant mortality risk for planning.
- **Time-critical tasks fail Criterion 4.** FDA explicitly weighs **automation bias** and **level of automation**.
- **Device examples relevant to us:** software that detects stroke or sepsis and **generates an alarm** (time-critical, example 11); software that analyzes **hourly SpO2/HR from the EHR to flag deterioration** (a "pattern", example 24); heart-failure hospitalization prediction from wearable data.
- **Non-device examples:** evidence-based order sets, DDI and drug-allergy alerts, formulary guidance, duplicate-test/prescription alerts, preventive-care reminders, discharge summaries.
- Criterion 4 labelling expectations: intended use and users, required inputs, a plain-language description of algorithm development and validation (including data representativeness), and patient-specific knowns/unknowns in the output. Usability testing may be needed.

**Design implications:**
- Order sets, DDI/allergy checking, reminders and dashboards are non-device if built to the Criterion 4 transparency pattern.
- **Early-warning or sepsis alerts that run continuously on serial vitals are devices.** Either take them through FDA (510(k)/De Novo) as regulated modules, or integrate third-party cleared algorithms.

**Other FDA items:**
- **Blood Establishment Computer Software (BECS)** [V, 47], 21 CFR 864.9165, **Class II (special controls)**, 510(k). Covers donor eligibility, preventing release of unsuitable units, compatibility testing, and patient/component identity at transfusion. Special controls require V&V, hazard analysis, a traceability matrix, and labelling with known anomalies. **A hospital transfusion-service module is a regulated device. Recommendation: integrate a cleared transfusion system in v1 rather than build one.**
- **AI-enabled device software functions** [V, 45]: draft guidance (Jan 2025, docket FDA-2024-D-4488), still marked "Draft – not for implementation" on FDA's page as of Oct 2026. It covers marketing-submission content and total-product-lifecycle risk management.
- **PCCP** [U]: final guidance for AI-enabled devices (Dec 2024) allows pre-authorized model updates. This is essential if we ever ship learning models.
- **Cybersecurity** [V, 46]: "Cybersecurity in Medical Devices: Quality Management System Considerations and Content of Premarket Submissions", **final Feb 2026** (page current as of 3 Feb 2026), superseding the 27 Jun 2025 final guidance. It also covers **§524B "cyber devices"**: SBOM, a post-market vulnerability monitoring plan, and patch processes.
- **QMSR** [V, 83]: FDA's Quality Management System Regulation, incorporating ISO 13485:2016 by reference, took effect **2 Feb 2026**. One QMS can now serve both FDA and MDR.

### 2.3 EU: MDR Rule 11, MDCG 2019-11, AI Act, CRA

- **MDR Rule 11** [U]:
  - software providing information used for diagnostic or therapeutic decisions is **Class IIa**
  - **IIb** if decisions could cause serious deterioration or surgical intervention
  - **III** if they could cause death or irreversible deterioration
  - software monitoring physiological processes is IIa (IIb for vital parameters where variations could mean immediate danger)
  - everything else is Class I
  - **Most decision software therefore ends up IIa or higher, which needs a notified body.**
- **MDCG 2019-11 rev.1 (June 2025)** [V, 34] is the current qualification and classification guidance. HIS/EHR administrative and storage functions are generally not devices; modules that compute patient-specific diagnostic or therapeutic information (dose calculators, PDMS alarms, risk scores driving treatment) may be devices [U]. **MDCG 2025-6 (June 2025)** [V, 34] is an FAQ on how MDR/IVDR and the AI Act interact. **MDCG 2019-16 rev.1** (July 2020) [V, 34] covers device cybersecurity. No new software-specific MDCG guidance dated 2026 was listed as of Oct 2026. MDCG 2025-4 (June 2025) covers MDSW apps on online platforms [34].
- **AI Act (Reg. 2024/1689) as amended by the Digital Omnibus on AI** (Reg. (EU) 2026/1744; provisional agreement 6 May 2026, Council adoption 29 Jun 2026, OJ publication 24 Jul 2026) [V, 31][32][33]:
  - High-risk via **Annex I** (AI that is, or is a safety component of, an MDR/IVDR device requiring notified-body assessment) applies from **2 Aug 2028**.
  - **Annex III** stand-alone high-risk applies from **2 Dec 2027**. Healthcare-relevant Annex III items [U]: **emergency healthcare patient triage**, and public-authority eligibility decisions for healthcare services.
  - Public-authority providers/deployers: until 2 Aug 2030 [32].
  - The safety-component definition was narrowed. A mechanism lets sectoral law (e.g., MDR) displace equivalent AI Act requirements (delegated act due by 2 Aug 2028).
  - The legal basis for processing special-category data for **bias detection** was extended to all AI systems under "strict necessity" with safeguards.
  - Art. 4 AI literacy was softened to "support the development of" literacy, so providers and deployers no longer have to guarantee a specific level of staff literacy [31]. (Re-checked 2026-10-16 during reconciliation. The executive summary now matches. The final OJ wording was not read directly because EUR-Lex did not render.)
  - Art. 50 transparency applies 2 Aug 2026, with Art. 50(2) marking for legacy generative systems due by 2 Dec 2026 [31][32].
  - **Provider obligations for high-risk systems** [U]: risk management, data governance, technical documentation, **automatic event logging (Art. 12)**, instructions/transparency (Art. 13), **human oversight (Art. 14)**, accuracy/robustness/cybersecurity (Art. 15), QMS, conformity assessment, registration, post-market monitoring, serious-incident reporting. **Hospitals as deployers** need logs, oversight and (public bodies) fundamental-rights impact assessments, so we must give them tooling.
- **Cyber Resilience Act (Reg. 2024/2847)** [V, 30; U]:
  - In force 10 Dec 2024; **reporting obligations from 11 Sep 2026**; main obligations **11 Dec 2027**; Commission implementation guidance published 27 Jul 2026 [30].
  - Exclusions [U]: products covered by MDR/IVDR. Pure SaaS is outside scope unless it is a "remote data processing solution" integral to a product.
  - Applies to [U]: on-prem HMS distributions, thick clients, mobile apps, interface-engine software, and downtime appliances placed on the EU market.
  - Obligations [U]: Annex I security requirements (secure by default, no known exploitable vulnerabilities, SBOM, vulnerability handling, free security updates for the support period, generally 5 years or more), CE marking, conformity assessment (self-assessment for default-class products), reporting of actively exploited vulnerabilities and severe incidents (24 h early warning, 72 h notification, final report).
  - **Reporting also covers products already on the market.** The Commission's summary says reporting obligations "apply to all products with digital elements that have been made available on the Union market", including those placed before 11 Dec 2027 [V, 84]. The same summary says the manufacturer sets the support period and must state its end date (month/year) at purchase, and that micro and small enterprises cannot be fined for missing the 24 h deadline [84].

### 2.4 United Kingdom

- **DCB0129 / DCB0160** [U]: mandatory NHS information standards under the Health and Social Care Act 2012.
  - **DCB0129 (manufacturers):** a clinical risk management system, a named **Clinical Safety Officer** (registered clinician, trained), a clinical risk management plan, a **hazard log**, and a **clinical safety case report** for each release.
  - **DCB0160 (deploying organisations)** mirrors this for deployment.
  - DUAA 2025 s.121/Sch. 15 means information standards can now be enforced directly against IT suppliers [35].
  - A 2025–2026 NHS England review of these standards was reported [U]. Check for revised versions.
- **DTAC** [U]: the NHS procurement baseline covering clinical safety (DCB0129), data protection (DPIA, DSPT), technical security (Cyber Essentials Plus, penetration test), interoperability, and usability/accessibility (WCAG 2.x AA). A revised DTAC was reported in 2025/26; verify the current version.
- **MHRA** [V, 85; programme details U]: UK MDR 2002 as amended. New post-market surveillance requirements came into force 16 Jun 2025 [85]. The Software and AI as a Medical Device Change Programme and the "AI Airlock" sandbox are under way [U]. **CE-mark acceptance in Great Britain:**
  - MDR/IVDR-certified devices: until **30 Jun 2030**
  - MDD/AIMDD-certified general devices: until the earlier of certificate expiry or **30 Jun 2028**
  - IVDD devices: until the earlier of certificate expiry or 30 Jun 2030
  - The government has said it will consult on indefinite recognition of CE-marked devices; this had not been adopted at last check [85].

### 2.5 India, Saudi Arabia and others

- **India CDSCO** [U]: Medical Devices Rules 2017 cover software meeting the device definition (risk classes A–D). Licensing for all device classes has been mandatory since Oct 2023. Software-specific (SaMD) guidance has been signalled; verify its status. **NABH certification of HIS/EMR systems** is separate and voluntary but commercially important [70].
- **Saudi SFDA** [U]: Medical Device Marketing Authorization (MDMA) is required for SaMD. SFDA has published SaMD and AI/ML guidance and generally relies on reference-country approvals (FDA/CE/TGA/Health Canada/Japan).
- **UAE**: device registration through MOHAP or the Emirates Drug Establishment (verify which body currently handles it).

### 2.6 Standards stack (adopt as the internal engineering baseline)

| Standard | Purpose | Our use |
|---|---|---|
| IEC 62304 (health software lifecycle) | Software lifecycle processes, safety classes A/B/C | Apply class B-like rigour to all clinical code; class C for regulated modules |
| ISO 14971:2019 | Risk management for medical devices | Clinical hazard analysis (also satisfies DCB0129 style) |
| IEC 82304-1 | Health software product safety and security (stand-alone) | Product-level requirements for non-device health software |
| ISO 13485:2016 | Device QMS (FDA QMSR basis since 2 Feb 2026 [83]) | Required before the first regulated module ships |
| **IEC 81001-5-1:2021** | Security activities in the health software lifecycle | **Adopt now** as the secure SDLC baseline; FDA-recognized; EU harmonisation status to verify [U] |
| IEC 80001-1:2021 | Risk management for IT networks incorporating medical devices (healthcare delivery organisations) | Customer-side; we provide inputs (MDS2-like disclosures, network requirements) |
| ISO 27789 / NEN 7513 / IHE ATNA and BALP | EHR audit trails | Audit log schema and transport |
| HL7 FHIR Security Labels / HCS, DS4P | Sensitivity tagging | Segmentation model |
| NIST SP 800-218 (SSDF), SLSA, OWASP ASVS/MASVS | Secure development and supply chain | CI/CD gates, verification levels |

### 2.7 Device-boundary map for planned HMS modules

| HMS module / function | US (FDA) | EU (MDR) | Recommendation |
|---|---|---|---|
| ADT, scheduling, bed management, rostering, billing/RCM, ERP, supply chain | Not a device [43] | Not a device | Core product |
| EHR documentation, results display, PACS image display (non-diagnostic) | Not a device / MDDS [43] | Generally not | Core product |
| CPOE order sets, DDI/allergy alerts, duplicate-order alerts, reminders | Non-device CDS if Criterion 4 met [42] | Often not (case-by-case) | Core; implement the transparency UI pattern |
| Weight-based dose calculators (paediatric, chemo, insulin, heparin nomograms) | Possibly device (directive, time-sensitive) [U] | Likely IIa+ [U] | Regulated-module track or a constrained "reference" design |
| Early-warning scores / sepsis / deterioration alerts on serial vitals | **Device** [42] | Likely IIa/IIb [U] | Regulated module or partner-supplied cleared algorithm |
| ED triage AI | Device if time-critical | Device + AI Act Annex I/III [U] | Defer; partner |
| Transfusion service / blood bank (BECS) | **Class II 510(k)** [47] | Device (IVD/MDR boundary) [U] | **Integrate a cleared product** |
| Infusion pump / monitor integration (display only) | MDDS (not a device) if no control or alarm [43] | Accessory/MDDS analysis needed | Gateway with no control functions |
| PDMS / ICU charting with alarms | Device if it alarms [43] | Likely device | Defer or regulated module |
| Generative AI documentation (ambient scribe, summaries) | Usually non-device if HCP reviews; watch CDS criteria | AI Act transparency; device if diagnostic | Governed AI framework; HCP sign-off |

---

## 3. Security frameworks and attestations buyers ask for

### 3.1 Framework landscape

- **ISO/IEC 27001:2022** (ISMS). The transition from 2013 ended 31 Oct 2025 [U]. Common add-ons:
  - **27701** (privacy information management; a 2025 stand-alone edition was reportedly published [U])
  - **27017** (cloud security controls)
  - **27018** (PII in public clouds)
  - **27799** (health-sector guidance for 27002)
  - ISO 27001 is the global lingua franca in the EU, UK, GCC, India and APAC.
- **SOC 2 Type II** (AICPA Trust Services Criteria): Security plus Availability and Confidentiality, with Privacy as an option. This is the US enterprise default, and US RFPs routinely ask for "your latest SOC 2 Type II report (≤12 months)" [U].
- **HITRUST** [V, 50]: **e1** (43 controls, 1-year validity, foundational), **i1** (182 controls, 1 year, leading practice), **r2** (risk-based, tailorable, **2-year validity**, highest assurance; maps to HIPAA and NIST CSF). There is also an **AI Security Assessment/Certification** (stand-alone or combined) and a 51-control AI Risk Management assessment. HITRUST claims fewer than 1% of certified environments reported a breach, and its site also advertises a "99.62% breach-free rate". These are vendor statistics with no disclosed period, sample or methodology [50]. Large US health systems and payers increasingly require r2.
- **NIST CSF 2.0** (Feb 2024; six functions including the new *Govern*) [51][U]. US hospital programmes use it as the risk vocabulary, often together with NIST SP 800-66r2 (HIPAA Security Rule implementation guide, 2024) [U].
- **HHS 405(d) HICP** [U]: 5 threats (social engineering, ransomware, loss/theft of equipment or data, insider data loss, attacks on connected medical devices) and 10 practices.
- **HPH Cybersecurity Performance Goals** [V, 49], voluntary:
  - **10 Essential:** mitigate known vulnerabilities, email security, MFA, basic training, strong encryption, revoke credentials for departing workforce, basic incident planning, unique credentials, separate user/privileged accounts, vendor/supplier cybersecurity requirements
  - **10 Enhanced:** asset inventory, third-party vulnerability disclosure, third-party incident reporting, cybersecurity testing, mitigation, detect/respond to relevant TTPs, network segmentation, centralized log collection, centralized incident planning, configuration management
  - No mandate had been enacted as of this research. HHS's Dec 2023 concept paper floated tying CPGs to CMS requirements [49][U].
- **CISA Secure by Design Pledge** [V, 48], voluntary, for enterprise software makers, with 7 goals: MFA uptake (ideally phishing-resistant), eliminating default passwords, reducing whole vulnerability classes, easier patching, a published VDP with safe harbor, accurate CVEs with CWE/CPE, and **giving customers intrusion-evidence logs**. **We should sign it.** It is cheap, credible, and matches our architecture.
- **OWASP ASVS** (v5.0 released 2025 [U]): Level 2 baseline, Level 3 for authentication, authorization, break-the-glass, admin and PHI APIs. OWASP MASVS for mobile. OWASP API Security Top 10.
- **CSA STAR**: Level 1 (CAIQ self-assessment), Level 2 (third-party via ISO 27001 or SOC 2).
- **Regional schemes:**
  - **UK:** DSPT, DTAC, Cyber Essentials Plus, DCB0129
  - **India:** MeitY empanelment of cloud service offerings (STQC audit) for government buyers [U]; CERT-In-empanelled auditors for security audits [U]
  - **Saudi Arabia:** NCA ECC and CCC (for SaaS serving government/CNI), CST registration [U]
  - **UAE:** ADHICS (Abu Dhabi), DESC ISR / CSP certification (Dubai) [U]
  - **Australia:** IRAP, Essential Eight
  - **Germany:** C5
  - **France:** HDS
  - **Netherlands:** NEN 7510
  - **Spain:** ENS
  - **US federal (VA/DoD/IHS):** FedRAMP

### 3.2 What enterprise hospital RFPs typically demand

Based on common vendor-risk questionnaires (SIG, HITRUST, CAIQ, NHS DTAC, health-system third-party risk platforms) [U, analyst synthesis]:

1. **Attestations:** SOC 2 Type II (≤12 months old) and/or ISO 27001 (+27701/27017/27018); HITRUST r2 for large US health systems; latest independent penetration test executive summary (≤12 months) with remediation status.
2. **Contracts:** BAA (US), Art. 28 DPA with SCCs (EU/UK), sub-processor list with change notification, right to audit, cyber-insurance limits (often US$5–10M+), breach notification SLA (**24–72 h**, increasingly 24 h because of NIS2 and contractual trends), data return and destruction on exit.
3. **Identity:** SAML/OIDC SSO with the customer IdP, SCIM, **MFA (phishing-resistant for privileged and remote access)**, EPCS-compliant 2FA (US), badge tap-and-go.
4. **Access governance:** granular RBAC/ABAC, break-the-glass, sensitive-record controls, VIP/employee protection.
5. **Audit:** complete user-activity logs, SIEM export (syslog/CEF/JSON, near-real-time), long retention, privacy-monitoring integration.
6. **Data protection:** AES-256 at rest, TLS 1.2+ in transit, customer-managed keys (BYOK), data-residency commitments.
7. **Secure development:** SSDLC description, SAST/DAST/SCA, **SBOM on request**, vulnerability SLAs (critical ≤15–30 days), VDP.
8. **Resilience:** RTO/RPO by tier with **evidence of tested restores**, immutable backups, read-only downtime solution, uptime SLA (99.9–99.99%), status page, incident communication plan.
9. **Medical devices / clinical safety:** MDS2 forms (where device-adjacent), DCB0129 safety case (UK), regulatory status statement per module.
10. **Accessibility:** VPAT/ACR (WCAG 2.1/2.2 AA); Section 508 for US public bodies.

### 3.3 Certification roadmap

Effort and cost are **analyst estimates** (external fees plus typical internal effort for a mid-size SaaS vendor). They are not quotes. Validate with assessors.

| Certification / attestation | Market relevance | Effort | Indicative external cost | Timeline | Phase |
|---|---|---|---|---|---|
| CISA Secure by Design Pledge + public VDP + CVE program | Global credibility; US federal buyers | Low | ~US$0–20k (bug bounty extra) | 1–3 months | 0 |
| SOC 2 Type I, then Type II | **US enterprise mandatory** | Medium | US$40–120k/yr audit + US$20–60k/yr GRC tooling | Type I M6; Type II M12 (6–12 month window) | 1 |
| ISO/IEC 27001:2022 + 27701 + 27017 + 27018 | **Global (EU, UK, GCC, India, APAC)** | Medium–high | US$30–100k first cycle (certification body) + optional consultancy US$30–100k | 9–12 months; annual surveillance | 1 |
| Annual third-party penetration test (CREST/CHECK-qualified) + annual red team | Universal | Medium | US$30–100k per test; red team US$80–250k | Annual; first by M9 | 1 |
| CSA STAR Level 1 to Level 2 | Cloud buyers, EU | Low | L1 free; L2 +US$10–30k on the ISO audit | 1–3 months after ISO | 1–2 |
| ONC Health IT Certification. Target the 19 criteria HTI-5 would retain plus the 7 revised ones: (g)(10), (b)(10), CPOE (a)(1)–(a)(3), (b)(3) e-Rx, CQMs, public health, HTI-4 ePA. Re-check against the HTI-5 final rule *(reconciled 2026-10-16; see §2.1)* | **US hospital market (CEHRT)** | **High** (multi-FTE-years: API, real-world testing) | US$50–200k ATL/ACB fees; engineering dominates | 12–18 months; annual RWT | **US go/no-go (Phase 3+)** *(was 2)* |
| HITRUST i1, then r2 | Large US health systems and payers | High | i1 US$50–120k; r2 US$100–300k+ | i1 6–9 months; r2 9–18 months | **US go/no-go (Phase 3+)** *(was 2)* |
| UK: DSPT (IT suppliers in the 2026-27 mandatory independent-audit scope [87]) + DTAC + DCB0129 safety case + Cyber Essentials Plus | **NHS market entry** | Medium (CSO 0.5–1 FTE) | CE+ £3–10k; pen test; CSO salary | 4–8 months | **On UK entry decision (Wave 3 candidate)** *(was 2)*. The DCB0129-style hazard log still starts in Phase 0 |
| India: DPDP readiness + CERT-In processes + NABH HIS/EMR certification + ABDM M1–M3 + India cell (MeitY-empanelled CSP) | **India** | Medium | NABH fees modest [U]; empanelment/STQC US$20–60k [U] | Before **13 May 2027** (prefer Nov 2026) | 2 |
| KSA: NCA ECC/CCC alignment + in-Kingdom cell (CST-registered CSP) + PDPL program | **Saudi** | Medium | US$30–100k audit/advisory [U] | 6–9 months | 2 |
| UAE: ADHICS control mapping + UAE cell + Malaffi/NABIDH/Riayati integrations | **UAE** | Medium | US$20–60k [U] | 4–8 months | 2 (UAE is Wave 1b, after India + KSA) |
| ISO 13485 QMS + IEC 62304 for regulated modules | Prerequisite for SaMD | High | US$150–500k over 18 months (QMS build, registrar, staffing) | 12–18 months | 3 |
| FDA 510(k) / De Novo (e.g., deterioration alert, transfusion if built) | US regulated modules | High | US$250k–1M+ per product incl. V&V and cybersecurity file | 9–18 months | 3 |
| EU MDR CE (Class IIa/IIb) + AI Act conformity (Annex I) | EU regulated modules | High | €50–150k notified-body fees + documentation; AI Act increment €50–200k [U] | 12–24 months; AI Act by **2 Aug 2028** | 3 |
| CRA conformity (on-prem/clients/appliances) | EU products with digital elements | Medium | Mostly internal; SBOM/vulnerability tooling | Reporting **now**; full by **11 Dec 2027** | 2–3 |
| EHDS EHR-system conformity (interop + logging components, CE self-cert, EU database) | **EU EHR market** | High | Unknown until implementing acts (due Mar 2027) | Ready by **Mar 2029** (group 1) | 3 |
| France HDS / Germany C5 Type 2 / Netherlands NEN 7510 / Spain ENS | Country gates | Medium each | €30–150k each [U] | 6–12 months each | 3 |
| FedRAMP Moderate (optional) | US federal health (VA/DoD/IHS) | Very high | US$0.5–2M | 12–24 months | 4 (optional) |
| China MLPS Level 3 + local partner | China | Very high (separate product line) | Partner-dependent | 18+ months | 4 (optional) |

---

## 4. Threat landscape and incident lessons

### 4.1 Statistics

- **US large breaches (500+ records) reported to OCR** [V, 52]:
  - 2023: 745 breaches, 79.7% hacking/IT
  - 2024: 741 breaches, **more than 289M individuals**
  - 2025: 772–805 breaches (sources differ), about **138.5M individuals**, more than 80% hacking/IT
  - 2026 to 30 April: 252 breaches (−9.5% year on year)
  - About 15–23% are reported by business associates, which undercounts BA-originated breaches.
  - OCR has an investigation backlog of about 936 breaches [52]. 2026 data is incomplete after the 43-day HHS shutdown [64].
- **Healthcare ransomware** [R, 65; partly V, 78]:
  - Comparitech's healthcare roundup (reported by DOTmed, Jul 2026) counted **410** attacks on healthcare organisations in H1 2026, up about 14% from 360 in H2 2025.
  - The split is **247 providers** (hospitals, clinics; only about +3–4%) and **163 healthcare businesses** (billing, pharma, health-tech; about +35%). US provider attacks fell more than 7%.
  - Comparitech's cross-sector roundup independently confirms 247 healthcare-provider attacks (+4%) and +35% for healthcare businesses [78].
  - **Read this carefully:** the "+14%" headline is driven by attacks on vendors and service companies like us, not by hospitals themselves.
- **The largest incidents are business associates, and concentration risk is real:**
  - Change Healthcare: **192.7M** individuals, the largest healthcare breach on record [53][54]
  - Conduent: 62.2M (detected Jan 2025) [64]
  - Episource: 6.7M [64]
  - TriZetto: 3.4M [64]
  - Aflac: 13.9M via help-desk social engineering [64]
- **The EU's health threat landscape** (ENISA, Jan 2021–Mar 2023) identified ransomware and data-theft extortion as the leading threats [71][U for details]. ENISA's *Cyber Hygiene in the Health Sector* (Sep 2025) gives practical guidance [71].

### 4.2 Evidence of patient harm

- **Disruption is the norm.** Neprash et al. (*JAMA Health Forum*, Dec 2022) found 374 ransomware attacks on US care-delivery organisations from 2016 to 2021 (43 in 2016, 91 in 2021). **44.4% disrupted care**: 41.7% involved EHR/system downtime, 10.2% delayed or cancelled care, 4.3% diverted ambulances. About 42M patients' PHI was exposed [67].
- **Spill-over to neighbouring hospitals.** Dameff et al. (*JAMA Netw Open*, May 2023) studied UC San Diego EDs adjacent to a health system hit by ransomware (May 2021). During the attack phase [66]:
  - ED census +15.1%
  - **EMS arrivals +35.2%**
  - left-without-being-seen +127.8%
  - median door-to-room time 21 to 31 minutes
  - **stroke code activations +74.6%**, confirmed strokes +113.6%
  - county EMS diversion hours +74.1%

  The authors call such attacks **regional disasters** requiring coordinated planning [66].
- **Mortality.** A Medicare-claims working paper (McGlave, Neprash, Nikpay, 2023) estimated a significant rise in in-hospital mortality for patients already admitted when an attack started [68][U, not accessible this session]. **A death has been attributed in part to an attack.** King's College Hospital confirmed in June 2025 that "a long wait for a blood test result due to the cyberattack" was one of several contributing factors in a patient's death during the Synnovis incident. South East London ICB counted about 170 patient-harm incidents (mostly low harm, some moderate or severe) [57][59].
- **Düsseldorf (Sept 2020).** A patient diverted from the closed ED died. Contemporaneous reporting said prosecutors could not establish that the delay caused the death [U].

### 4.3 Incident lessons

| Incident | Vector / root cause (as reported) | Impact | Design lesson for our HMS |
|---|---|---|---|
| **Düsseldorf University Hospital, Sept 2020** [U] | Reportedly an unpatched Citrix gateway vulnerability (CVE-2019-19781) exploited months after the fix | IT failure, ED closed, diversions; a diverted patient died (causation not established) | Patch edge appliances to KEV-driven SLAs; "ED diversion" and downtime modes; avoid customer-exposed legacy remote-access dependencies |
| **Irish HSE (Conti), May 2021** [V, 60][61][62] | Phishing email (16 Mar) with a malicious Excel file opened 18 Mar; **8 weeks** undetected; AV alerts on Cobalt Strike not escalated; patient-zero AV signatures over a year old; more than 30k Windows 7 machines; no CISO; no ransomware runbooks; recovery plans only for Active Directory; backups only **periodically to offline tape** | More than 80% of the IT estate affected; 31 of 54 acute hospitals cancelled services; full recovery took about **4 months** (1,075 of 1,087 applications by 21 Sep 2021); recovery sped up by a decryption key released by the attacker | Managed detection and response with 24x7 triage; **immutable/offline backups for all critical systems incl. identity**; prioritized recovery list mapped to clinical services; restore to a **common point in time**; clinical continuity plans for **total IT loss for weeks**; "code of connection" for anything touching our platform |
| **CommonSpirit, Oct 2022** [U] | Ransomware across shared infrastructure | About 624k individuals; EHR outages for about 2+ weeks at multiple facilities; about US$150M+ reported impact | Large shared identity and network domains are a big blast radius. Use **cells and per-tenant isolation** so one tenant or region cannot take down others |
| **Lurie Children's (Rhysida), Jan–Feb 2024** [U] | Ransomware (reported demand about US$3.4M, not paid) | Epic, MyChart and phones offline for weeks to months; about 790k notified | Telephony, paging and secure messaging belong in the downtime plan; paediatric dosing references available offline |
| **Change Healthcare (ALPHV), Feb 2024** [V, 53][54] | **Stolen credentials on a Citrix remote-access portal without MFA**; encryption 21 Feb; data exfiltrated | **192.7M** individuals; claims, eligibility, pharmacy and prior auth disrupted for weeks to months; 94% of hospitals affected per an AHA survey [R]; US$22M ransom paid, data still leaked; UnitedHealth reported about US$2.5–3.1B in 2024 impacts (figures vary) [53] | **No exceptions to phishing-resistant MFA** (including acquired or legacy systems); continuous external attack-surface scanning; **RCM must support multiple clearinghouses and offline claim queuing**; BA concentration risk in customer risk registers |
| **Ascension (Black Basta), May 2024** [V, 55][56] | A contractor/employee downloaded a malicious file (search-engine link) | 5.6M individuals; EHR, e-prescribing and phones down for about 5 weeks across about 140 hospitals; ambulance diversion; 7 of 25,000 servers exfiltrated; about US$1.3–1.8B reported financial impact | Browser isolation and download controls for clinical endpoints are the customer's job, but **our platform must survive a compromised customer endpoint**: token binding, anomaly detection, rapid session revocation; e-prescribing fallback |
| **Synnovis / London (Qilin), Jun 2024** [V, 57][58][59] | Ransomware on an outsourced pathology provider | 10,152 outpatient appointments and 1,710 elective procedures postponed at two trusts [R]; O-negative blood shortage; about 170 harm incidents; **one death with the attack a contributing factor**; data on about 900k+ patients leaked (STI/cancer results published); about £32.7M cost [R] | **Suppliers are part of the clinical safety case.** Lab-result fallback (manual phone/print with read-back); blood-bank resilience; cyber hazards in the DCB0129 hazard log; extortion-aware data minimization |
| **Kettering Health (Interlock), May 2025** [V, 63] | Access 9 Apr, detonation 20 May (**about 6 weeks dwell**) | 14 medical centers; procedures cancelled; Epic core restored 2 Jun; paper charting **back-entered**; 1.69M individuals; scam calls to patients | Dwell-time detection; **back-entry and reconciliation workflows**; patient-communication templates (anti-scam) |
| **Frederick Health, Jan 2025** [V, 64] | Ransomware; file share exfiltration | About 2 weeks on paper; ambulance diversion; 934k individuals | File shares are where PHI leaks. Keep documents in governed stores with DLP |
| **DaVita (Interlock), Apr 2025** [V, 64] | Ransomware | 2.69M; dialysis centers kept open on contingency processes | Outpatient chronic-care continuity: offline treatment-plan access |
| **Yale New Haven, Mar 2025** [V, 64] | Data theft without encryption | 5.56M; no clinical disruption | Exfiltration-only extortion is common. **Egress monitoring, bulk-query anomaly detection, DLP** |
| **Aflac, Jun 2025** [V, 64] | **Help-desk social engineering** of identity systems | 13.9M | Strong help-desk identity verification for password/MFA resets; phishing-resistant enrolment |
| **Blue Shield of California, 2025** [V, 64] | Google Analytics misconfiguration (2021–2024) | 4.7M | **No third-party trackers on PHI pages**; privacy review gates for front-end changes |
| **Oracle Health legacy (Cerner) servers, 2025** [R] | Reported compromise of legacy data-migration servers holding customer data | Patients of multiple hospital customers notified | **Decommission migration and legacy environments**; data inventory covering vendor-side copies |

### 4.4 Cross-cutting lessons translated into requirements

1. **Identity is the perimeter.** Every major incident started with credentials, phishing or social engineering. Requirement: phishing-resistant MFA, PAM, session-anomaly detection, and fast revocation.
2. **Dwell time of 6–8 weeks is typical.** Requirement: centralized logs, EDR on all servers, 24x7 SOC with escalation SLAs, and deception/canaries in PHI stores.
3. **Recovery, not prevention, decides patient outcomes.** Requirements:
   - isolated immutable backups, including identity and configuration
   - clean-room rebuild capability
   - a **72-hour restoration target for critical clinical systems** (aligned with the HIPAA NPRM)
   - read-only downtime access within minutes
4. **Plan for weeks.** Observed EHR outages were HSE about 4 months, Lurie weeks to months, Ascension about 5 weeks, Kettering about 2 weeks. Requirement: offline-capable workflows and documented back-entry.
5. **Third parties are clinical dependencies** (Change, Synnovis, Conduent). Requirement: graceful degradation when an integrated service (lab, clearinghouse, ePrescribing hub, HIE) is down, with queued replay.
6. **Extortion now targets the data itself.** Requirement: data minimization, field-level encryption of the most sensitive identifiers, segmentation of sensitive results, and bulk-export controls.

---

## 5. Security architecture requirements checklist

**MUST** = release-blocking for GA in any market. **SHOULD** = target within 12 months of GA, or a market-specific MUST. Drivers cite the obligations that justify each item.

### 5.1 Identity and authentication

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| IA-1 | Federate with customer IdPs (SAML 2.0, OIDC); SCIM provisioning and **automatic deprovisioning within minutes**; no local passwords for workforce in federated tenants | MUST | HPH CPG "revoke credentials" [49]; NPRM [5] |
| IA-2 | **Phishing-resistant MFA** (FIDO2/WebAuthn passkeys, PIV/smartcard, platform authenticators) for all remote, privileged, admin, vendor-support and developer access; never password-only remote access; no SMS OTP for privileged users | MUST | Change Healthcare [53]; CISA pledge [48]; ONC (d)(13) [39]; NPRM [5]; NIST SP 800-63-4 (final Jul 2025) [86] |
| IA-3 | Clinical shared-workstation model: **badge tap-and-go** (RFID/NFC + PIN), fast user switching, session roaming between workstations, proximity/inactivity lock with **location-specific timeouts** ((d)(5)), kiosk-mode devices, VDI compatibility | MUST | ONC (d)(5) [39]; clinician usability |
| IA-4 | EPCS: DEA-compliant two-factor signing, identity proofing, two-person logical access control approval, EPCS audit reports (US) | MUST (US) | 21 CFR 1311 [U] |
| IA-5 | Unique user IDs; **no shared or generic accounts**; no default passwords; service identities via workload identity, not static keys | MUST | HPH CPG [49]; CISA pledge [48] |
| IA-6 | Privileged access management for vendor staff: just-in-time elevation, approval workflow, **session recording**, customer-visible access log and optional customer approval ("lockbox") | MUST | HSE PIR [60]; NIS2 supply chain [29] |
| IA-7 | Step-up authentication for high-risk actions: break-the-glass, bulk export, EPCS, admin policy changes, key operations | MUST | Audit and defence-in-depth |
| IA-8 | Risk-based/continuous authentication (device posture, impossible travel, token binding/DPoP), with **one-click global session revocation per user or tenant** | SHOULD | Ascension lesson [55] |
| IA-9 | Patient and proxy identity: IAL2-equivalent proofing for portal accounts; delegated proxy access (parent, guardian, caregiver) with age-based adolescent confidentiality rules configurable by jurisdiction | MUST | Cures access; state/national minors' laws [U] |
| IA-10 | Credential storage with Argon2id/bcrypt; secrets never logged | MUST | ONC (d)(12) [39] |
| IA-11 | Help-desk identity verification workflow for MFA/password resets (video or ID check, manager callback); resets logged and alerted | MUST | Aflac [64] |

### 5.2 Authorization and sensitive-record segmentation

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| AZ-1 | Central policy decision point combining **RBAC (role catalog) + ABAC** (facility, department, encounter, care-team membership, time, device trust, purpose of use), enforced server-side on every API, search, report, print and export path | MUST | ONC (d)(1) [39]; GDPR Art. 25/32; minimum necessary |
| AZ-2 | **Care-relationship-based access**: active treatment relationship (attending, care team, consult, scheduled or recent encounter, ED arrival). Outside a relationship, require a reason prompt or break-the-glass | MUST | HIPAA minimum necessary; NHS legitimate-relationship norms [U] |
| AZ-3 | **Sensitivity labelling** using HL7 confidentiality codes (N/R/V) and sensitivity categories: SUD/Part 2, HIV/STI, mental health/psychotherapy notes, reproductive health, genetic, sexual and gender-identity data, domestic violence, adolescent-confidential, **VIP/celebrity**, **employee-as-patient**, legal/forensic. Labels propagate to documents, results, orders, messages, prints, FHIR `meta.security` and analytics | MUST | Part 2 [8]; state laws [11]; GDPR Art. 9; EHDS restrictions [28] |
| AZ-4 | **Break-the-glass**: reason code + free text; time-boxed and scope-limited; immediate notification to the privacy office; mandatory retrospective review queue with outcome tracking | MUST | ONC (d)(6) [39]; EHDS patient restrictions [28][U] |
| AZ-5 | Field-level masking and confidential demographics (protected address for DV victims, masked national IDs); "restricted patient" mode | MUST | Privacy and safeguarding |
| AZ-6 | Multi-entity scoping (hospital group, legal entity, facility); cross-entity access only through configured data-sharing agreements | MUST | Controller boundaries (GDPR, DPDP) |
| AZ-7 | Purpose-of-use propagated on every access and disclosure (treatment, payment, operations, research, public health, legal, patient request) | MUST | Part 2; GDPR purpose limitation; EHDS secondary use |
| AZ-8 | Patient-directed restrictions ("hide this episode from provider X") with emergency override | SHOULD (MUST for EU by 2029) | EHDS [28][U] |

### 5.3 Consent management

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| CN-1 | Consent registry (FHIR Consent) covering: treatment, HIE opt-in/out, **Part 2 TPO consent and revocation**, research, marketing, secondary-use opt-out (EHDS, **NHS national data opt-out**), **DPDP consent artefacts and consent-manager integration**, ABDM consent, PIPL separate consent | MUST | [8][14][28][U] |
| CN-2 | Consent enforced at the **policy enforcement point** for interfaces, HIE/FHIR, exports and analytics, not only in the UI | MUST | Part 2; GDPR; DPDP |
| CN-3 | Automatic redisclosure notices (Part 2); accounting of disclosures ((d)(11), §164.528) | MUST (US) | [8][39] |
| CN-4 | Patient-facing consent and access-transparency dashboard (who accessed, when, why) | SHOULD (MUST EU 2029) | EHDS [28][U]; trust |

### 5.4 Audit logging and privacy monitoring

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| AU-1 | Log **every** view, create, update, delete, print, export, query/search, login/logout, failed access, consent change, break-the-glass and admin change, capturing: **who** (user, role, on-behalf-of, app/client ID), **what** (patient, resource, element/field set, query parameters), **when** (UTC, NTP-synced), **where** (device, IP, workstation, location, app), **why** (purpose of use, BTG reason) and **outcome** | MUST | ONC (d)(2)/(d)(3)/(d)(10) [39]; HIPAA §164.312(b); NEN 7513/ISO 27789 [U]; EU AI Act Art. 12 |
| AU-2 | Standard formats: FHIR **AuditEvent per IHE BALP**; DICOM/ATNA syslog (RFC 5424 over TLS) for legacy; OpenTelemetry for system events | MUST | Interoperability; SIEM ingestion |
| AU-3 | **Tamper-evident**: append-only, hash-chained segments anchored periodically; WORM storage in a separate security account; logging cannot be disabled by tenant admins; integrity verification reports | MUST | ONC (d)(2)/(d)(10) [39] |
| AU-4 | Retention configurable per jurisdiction and per log class: default at least **6 years** for access logs (HIPAA documentation norm) and longer where records law requires; **at least 1 year** (DPDP Rules) [14]; **180 days in-country** (CERT-In) [80] | MUST | [14][80] |
| AU-5 | Near-real-time streaming to the customer's SIEM (syslog/CEF/JSON/webhooks) **at no extra charge**, plus our own SOC | MUST | CISA pledge goal 7 [48]; HPH CPG centralized logs [49] |
| AU-6 | Privacy monitoring analytics: same-surname/household, coworker, neighbor, VIP, employee-patient, terminated-user, high-volume and after-hours access; case management; standard feed to Protenus / Imprivata FairWarning-type tools | MUST | OCR enforcement; insider threat (HICP) [U] |
| AU-7 | Investigator tooling: patient-centric and user-centric audit reports, export with chain of custody, eDiscovery/legal-hold integration | MUST | ONC (d)(3) [39]; litigation |
| AU-8 | Patient-visible access log (with configurable suppression of staff names where local law requires) | SHOULD (MUST EU 2029) | EHDS [28][U] |

### 5.5 Data protection, keys and DLP

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| DP-1 | TLS 1.2+ (prefer 1.3) externally; **mTLS service mesh internally**; HSTS; no plaintext MLLP across untrusted networks | MUST | ONC (d)(9) [39]; NPRM [5] |
| DP-2 | AES-256 encryption at rest for **all** stores: databases, object storage, search indexes, caches, queues, logs, backups, analytics copies | MUST | NPRM [5]; HPH CPG [49] |
| DP-3 | Envelope encryption with **per-tenant keys** in a KMS/HSM (FIPS 140-3-validated modules where required); rotation; crypto-shredding for tenant exit | MUST | Tenant isolation; sovereignty |
| DP-4 | **BYOK** for enterprise tenants; **HYOK / external key manager** in sovereign cells (EU/KSA/UAE) | SHOULD (MUST for sovereign deals) | Residency matrix §1.9 |
| DP-5 | Secrets vault; no secrets in code or images; automated rotation; detection in CI | MUST | SSDF |
| DP-6 | End-user devices: no unmanaged local PHI; encrypted, policy-controlled offline stores for downtime/mobile; remote wipe | MUST | ONC (d)(7) [39] |
| DP-7 | Application-layer encryption or tokenization of national identifiers (SSN, Aadhaar via a UIDAI-compliant vault, Emirates ID, Iqama) and the most sensitive result types | SHOULD (MUST India if Aadhaar stored [U]) | Extortion lesson [57] |
| DP-8 | DLP: export throttles and approvals, **watermarking** of prints/PDFs (user, time, patient), bulk-FHIR export anomaly detection, clipboard/screenshot restrictions in mobile apps, egress monitoring | MUST | Yale/Frederick lessons [64] |
| DP-9 | Retention and erasure engine: per-jurisdiction schedules, legal holds, erasure workflows where permitted, backup expiry alignment, deletion certificates | MUST | GDPR/DPDP/WA MHMDA [11][14] |
| DP-10 | De-identification and pseudonymization service (HIPAA Safe Harbor / Expert Determination, GDPR pseudonymization, EHDS secondary-use extracts), with re-identification keys held separately | SHOULD | EHDS [28]; research |

### 5.6 Platform, tenancy and residency

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| PL-1 | **Cell-based architecture** with a hard blast radius per cell; per-tenant database or schema plus row-level security as defence-in-depth; per-tenant keys; noisy-neighbour limits | MUST | CommonSpirit lesson; multi-tenancy |
| PL-2 | **Sovereign cell** blueprint deployable in-country (UAE, KSA, India, AU, FR/DE, KE), including on-prem/hybrid for customers that require it, with identical security controls | MUST (architecture); per-market build | §1.9 |
| PL-3 | Global control plane carries **no PHI**; telemetry scrubbed of identifiers; support tooling accesses data only inside the cell | MUST | Localization laws |
| PL-4 | Infrastructure as code, immutable images, CIS-hardened baselines, drift detection, configuration management database | MUST | HPH CPG enhanced [49] |
| PL-5 | Separate production, staging and development; **no production PHI in non-production** (synthetic or masked data only) | MUST | Breach prevention |

### 5.7 Secure SDLC, supply chain, vulnerability management, testing

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| SD-1 | SSDLC aligned to **IEC 81001-5-1** and NIST SSDF; security and privacy threat modelling (STRIDE + LINDDUN) per epic; security requirements traceability | MUST | IEC 81001-5-1 [U]; CRA [30] |
| SD-2 | CI gates: SAST, SCA, secrets scanning, IaC and container scanning, DAST on staging; two-person code review; protected branches | MUST | SSDF |
| SD-3 | **SBOM** (CycloneDX/SPDX) for every release and deployable artifact, plus VEX statements; provided to customers on request | MUST | FDA §524B [46]; CRA [30]; RFPs |
| SD-4 | Signed artifacts (Sigstore), provenance (target SLSA L3), hermetic builds for critical components | SHOULD | Supply-chain attacks |
| SD-5 | Memory-safe languages for new services; framework-level elimination of injection and XSS classes | MUST | CISA pledge goal 3 [48] |
| SD-6 | OWASP **ASVS L2** baseline; **L3** for authentication/authorization/BTG/admin/PHI APIs; MASVS for mobile; API Top 10 | MUST | Buyer expectation |
| SD-7 | Public **VDP with safe harbor**, bug bounty, CVE issuance with CWE/CPE; become a CVE Numbering Authority | MUST | CISA pledge [48]; CRA |
| SD-8 | Remediation SLAs: SaaS critical / KEV **≤7 days**, high ≤30 days (stricter than the NPRM's reported 15/30 [U]); customer-installed components auto-update with signed packages | MUST | NPRM [U]; HPH CPG [49] |
| SD-9 | Continuous vulnerability scanning (at least **every 6 months** formally; in practice continuous); external attack-surface management | MUST | NPRM [2][3] |
| SD-10 | Independent penetration test **at least annually** and after major changes (multi-tenant breakout, APIs, mobile, thick client, interface engine), plus an annual red team / purple team | MUST (pen test); SHOULD (red team) | NPRM [2][3]; HPH CPG [49] |
| SD-11 | Third-party/sub-processor risk management; open-source governance; exit plans for critical suppliers | MUST | NIS2 [29]; HPH CPG [49] |

### 5.8 APIs and integration

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| AP-1 | **SMART App Launch v2** with granular scopes; OAuth 2.0 + PKCE; short-lived access tokens; refresh-token rotation; app registration and vetting that is **non-discriminatory and documented** (information-blocking safe) | MUST (US) | ONC (g)(10) [38]; info blocking [12] |
| AP-2 | SMART Backend Services (JWT client assertion) for system integrations; UDAP for B2B trust in network exchange | MUST / SHOULD | ONC; TEFCA [U] |
| AP-3 | API gateway: rate limiting, schema validation, bulk-data anomaly detection, per-client quotas, mTLS for partner links, message integrity | MUST | ONC (d)(8) [39] |
| AP-4 | Interface engine (HL7 v2/FHIR/DICOM/X12): TLS everywhere, message journaling with **replay after downtime**, dead-letter handling, PHI-minimized logging | MUST | Resilience §6 |

### 5.9 Endpoints, mobile and medical devices

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| EN-1 | Browser-first clients; signed desktop clients that need no local admin rights; managed update channel | MUST | Patchability (CISA goal 4) [48] |
| EN-2 | Mobile: MDM/MAM support, app attestation, jailbreak/root detection, encrypted storage, **no PHI in push notifications**, biometric unlock bound to device keys | MUST | ONC (d)(7) [39] |
| EN-3 | Medical-device integration via a **segmented gateway** (device VLANs, no device-to-internet paths), read-only by default; provide network requirements for customer IEC 80001-1 risk files and MDS2-style disclosures | MUST | HICP threat 5 [U]; IEC 80001-1 [U] |
| EN-4 | Downtime print and label infrastructure (wristbands, specimen labels, MAR) that works when the core is unavailable | MUST | §6 |

### 5.10 AI-specific controls

| ID | Requirement | Level | Drivers |
|---|---|---|---|
| AI-1 | AI/DSI inventory with **source attributes** and model cards; intervention risk management; fairness monitoring | MUST (US for (b)(11)) | ONC (b)(11) [39]; AI Act Arts 11–15 [U] |
| AI-2 | Human-oversight UX: show inputs used, basis, knowns/unknowns; never auto-execute orders; capture acceptance/override reasons | MUST | FDA CDS Criterion 4 [42]; AI Act Art. 14 [U] |
| AI-3 | Automatic logging of AI inputs, outputs, versions and user actions | MUST | AI Act Art. 12 [U] |
| AI-4 | LLM safety: no PHI to external models without BAA/DPA and residency compliance; prompt-injection defences for tool-using agents; output provenance labels | MUST | GDPR; HIPAA; AI Act Art. 50 [31] |
| AI-5 | Change control for models (PCCP-style plans for regulated models; versioned rollback for non-regulated) | MUST (regulated) | FDA PCCP [U] |

---

## 6. Resilience and downtime

### 6.1 What the evidence says about duration

Real-world EHR outages after ransomware have lasted from about **2 weeks** (Kettering: 20 May to 2 Jun 2025 [63]; Frederick Health [64]) to about **5 weeks** (Ascension [55][56]) and about **4 months** for full estate recovery (HSE [60]). The HSE review explicitly says continuity planning must assume "total loss of IT for up to several weeks", and that offline or attacker-inaccessible backups must exist for **all** critical systems, data and infrastructure, including Active Directory, with tested restores to a common point in time [60]. The HIPAA NPRM proposes **72-hour restoration** of critical systems [2][3]. **Our design target: no clinical data loss and read-only access within minutes; full read/write restoration of tier-0 clinical functions within 72 hours, even after a destructive attack; and safe degraded operation for at least 4–6 weeks for customers whose own estates are down.**

### 6.2 Recommended RTO/RPO tiers

These are opinionated recommendations. Top vendors' internal targets are not public, so these are **not** benchmarks of named vendors. *(Reconciled 2026-10-16: the canonical NFR table is `08` §12.6, and the T0 row below is aligned to it. T1–T3 are tiers this report adds for non-core functions.)*

| Tier | Functions | Availability SLO | RTO (infrastructure / region failure) | RPO | **Cyber-recovery RTO** (clean rebuild from immutable copies) | Downtime mode |
|---|---|---|---|---|---|---|
| **T0 Life-critical clinical** | Patient index/ADT, allergies, problem and medication lists, CPOE, eMAR/BCMA, results (incl. critical-result alerts), blood-product administration, clinical notes read | Write paths: **99.95% contractual SLA, 99.99% internal SLO**. Read and continuity paths: **99.99%** (per `08` §12.6) | In-region auto-failover **≤5 min** (engineering target), **≤15 min** contractual; **≤60 min** cross-region | **0** in-region (synchronous quorum); **≤5 min** cross-region | **≤72 h** contractual (stretch 24–48 h; `08` engineering target: tenant restore ≤24 h) | Read-only downtime viewer + local encrypted snapshot (≤15 min stale) + pre-printed downtime packets |
| **T1 Clinical ancillary** | LIS/pathology interfaces, pharmacy verification/dispensing, radiology orders/results, OR/anesthesia scheduling, nursing documentation write | 99.95% | ≤1 h | ≤5 min | ≤5 days | Paper forms; queued interface replay; downtime accession/MRN blocks |
| **T2 Business-critical** | Registration, scheduling, patient portal, billing/RCM, claims, supply chain, HR/payroll | 99.9% | ≤4 h | ≤15 min | ≤7–14 days | Offline capture; batch back-entry; alternative clearinghouse |
| **T3 Non-critical** | Data warehouse, BI, research extracts, AI training | 99.5% | ≤24–72 h | ≤24 h | ≤30 days | None |

### 6.3 Resilience requirements (MUST unless noted)

1. **High availability:** multi-AZ for T0/T1, with a single writer per tenant and a synchronous standby. Active-active applies only to stateless tiers and read models, per `08` §6.4 (reconciled 2026-10-16). Cell-level isolation; regional disaster recovery with documented, **tested** failover at least twice a year.
2. **Immutable, isolated backups:**
   - object-lock/WORM copies in a **separate cloud account/tenant with separate identity, credentials and admin staff** (a logically air-gapped vault)
   - covers databases, object stores, **identity configuration** (IdP, directory, PAM), secrets/keys escrow, infrastructure-as-code, CI/CD, and audit logs
   - retention long enough to outlast typical dwell time (at least 90 days of restore points)
3. **Clean-room recovery:** a scripted rebuild of a cell from known-good images and IaC into a fresh account, then restoring data to a **common, verified point in time** across services, with malware and integrity scanning of restored data (HSE lesson [60]).
4. **Restore testing:** quarterly automated restore tests per tier, and an annual full-scale cyber-recovery exercise with at least one customer. Evidence is retained for SOC 2/ISO/HITRUST and NPRM-style audits.
5. **Read-only downtime system (BCA-equivalent):**
   - Epic's Business Continuity Access (BCA) model is the industry reference [U]: designated downtime PCs receive scheduled report pushes (census, MAR, active orders, allergies, recent results, care plans) and keep printing locally; plus a read-only web copy. Oracle Health's 724Access Downtime Viewer is the comparable product [U].
   - **Our design:** (a) an encrypted local snapshot service on designated downtime workstations per unit, refreshed every 15 minutes, with local printers; (b) a read-only "shadow" instance in a separate account and region with independent identity (break-glass local accounts held in sealed envelopes or an offline vault); (c) unit-level PDF packets (census, MAR, med lists, allergy and code status, pending results) generated every 1–4 hours and printable offline; (d) patient-facing downtime notices.
6. **Offline-capable workflows:** BCMA on mobile scanners with an offline cache of the current MAR (time-bounded, encrypted, reconciled on reconnect); offline registration with pre-allocated **downtime MRN and encounter number blocks**; downtime specimen accession ranges; downtime wristband and label printing.
7. **Back-entry and reconciliation:** structured back-entry that keeps **original clinical event times**, marks entries "documented during downtime", supports scanning paper forms into the chart, and provides medication-administration reconciliation, duplicate-order detection, results reconciliation (paper results versus later electronic results), and charge capture recovery. Kettering explicitly back-entered paper records [63].
8. **Integration resilience:** durable queues with replay for all interfaces; clinically prioritized catch-up ordering; alternate routes (second clearinghouse, fax/print fallback for lab and pharmacy) (Change and Synnovis lessons).
9. **Communications:** a status page independent of the primary cloud; out-of-band incident communication (SMS/voice/email from a separate provider); downtime-notification templates; patient anti-scam messaging (Kettering [63]).
10. **ONC SAFER Guides support:** the 2025 revision has **8 guides**: High Priority Practices; Organizational Responsibilities (now covering AI-enabled systems); Contingency Planning; System Management; Patient Identification; CPOE with Decision Support; Test Results Reporting and Follow-Up; Clinician Communication [41]. CMS Promoting Interoperability requires hospitals to attest to an annual SAFER self-assessment. ASTP's page (updated Feb 2026) says the **2016** guides remain applicable to the CMS measure [41]. A "yes" attestation has reportedly been required since CY2024 [U]. **Ship a SAFER self-assessment workbook pre-filled with our product's capabilities and evidence.**
11. **Cyber-incident playbooks** (jointly with customers): ransomware in the customer estate, ransomware or compromise in our cell, vendor-side credential compromise, insider snooping, patient-portal credential stuffing, mass exfiltration/extortion, third-party (clearinghouse/lab) outage, cloud-region outage, medical-device network compromise, DDoS. Each playbook covers clinical-safety decision points (when to go to downtime, when to divert) and regulatory clocks (HIPAA 60 days, GDPR 72 h, NIS2 24 h, CERT-In 6 h, Saudi PDPL 72 h, Singapore 3 days, Brazil 3 working days, Kenya/Nigeria 72 h, CRA 24 h).
12. **Exercises:** tabletop exercises with each enterprise customer at least annually (half-yearly for T0 sites); "Code Dark" live downtime drills per unit at least annually (SAFER Contingency Planning practice [41][U]); after-action reports feed the DCB0129 hazard log.
13. **Clinical safety of downtime:** hazard-log entries for downtime-specific risks (wrong-patient errors on paper, missed critical results, duplicate medication doses, blood-matching delays (Synnovis [57])). Mitigations include two-identifier checks on all downtime outputs and critical-result phone escalation scripts.

---

## 7. Accreditation and maturity models that drive HMS requirements

| Body / model | Status (as researched) | Specific HMS features they drive |
|---|---|---|
| **The Joint Commission (US)** | **Accreditation 360** launched 1 Jan 2026. A new National Performance Goals chapter (**14 NPGs** for hospitals, e.g., NPG 12 nurse staffing) **replaces the NPSG chapter** for the Hospital and Critical Access Hospital programmes. More than 700 hospital requirements were removed, standards are now publicly available, and JC says the NPG chapter adds no new requirements. Other programmes keep NPSGs [R, 77; JC site blocked automated access] | IM (information management) continuity standards: **written downtime plan, staff training, testing, backups** [U]; RC record-of-care: authentication and dating of entries, verbal-order authentication timeframes, timeliness of H&P/op notes; MM: pharmacist review, high-alert meds; patient-safety goals: **two patient identifiers**, **critical results to the responsible caregiver on time**, medication reconciliation, labelling, alarm safety, suicide-risk screening, health equity; Sentinel Event Alert on cyberattacks (2022) [U]. Features: identity banners, critical-result closed loop with escalation and audit, med rec, co-signature timers, downtime toolkit, alarm integration |
| **CMS Conditions of Participation (US)** | In force [U] | §482.24 medical records: authentication, confidentiality, **retention ≥5 years**; pharmacy and nursing CoPs; Promoting Interoperability: CEHRT, security risk analysis measure, SAFER attestation [41] |
| **JCI Hospital Standards 8th ed.** | Effective 1 Jan 2024 [U] | IPSGs (patient ID, effective communication incl. critical results, high-alert meds, safe surgery, infection, falls); **MOI**: information governance, privacy/confidentiality, security, data integrity, **planned and unplanned downtime**, document control, record retention; MMU (medication management). Features: document-control module, data-quality dashboards, downtime, audit |
| **NABH Hospital Standards 6th ed. (India)** | **Effective 1 Jan 2025** (new applicants from that date; migration by stage) [V, 69] | Information management chapter: confidentiality, integrity, security, retention, record completeness. **NABH Digital Health Standards for Hospitals (2nd ed., Sept 2025)**, **Digital Health Standards for HIS/EMR Systems (1st ed.) with test cases**, and **NABH certification of HIS/EMR systems** (announced Oct 2024) and entry-level digital-health certification (Feb 2025) [V, 70]. Features: ABDM integration, audit trails, e-consent, CPOE, BCMA, e-prescriptions, downtime. **Pursue NABH HIS/EMR certification early for India** |
| **ACHS / NSQHS Standards (Australia)** | NSQHS 2nd ed. (updated 2021) [U] | Medication Safety (med rec, eMM), Communicating for Safety (patient ID, handover, critical info), Recognising and Responding to Acute Deterioration (careful: automated deterioration alerts may be devices), Clinical Governance (incl. digital), **My Health Record** integration |
| **CQC (England)** | Single assessment framework [U] | "Safe" and "Well-led" evidence; DSPT status; record keeping; safeguarding flags; incident reporting |
| **HIMSS EMRAM (2022 criteria), INFRAM, AMAM, DIAM, CCMM** | Active [U; site blocked] | EMRAM Stage 6–7: **closed-loop medication administration (CPOE, pharmacist verification, BCMA, eMAR)**, blood products and human milk, structured documentation, CDS, **business continuity/downtime**, security (identity, audit, encryption), analytics and governance, patient engagement. **INFRAM**: segmentation, security, mobility, DC resilience. **AMAM**: analytics maturity. **DIAM**: imaging. **CCMM**: continuity of care/interoperability. GCC and Asian private hospitals use Stage 7 as a marketing signal, so RFPs ask whether our system has enabled Stage 6/7 sites |
| **China NHC EMR application-level grading (levels 0–8); interoperability maturity assessment; smart-hospital grading; MLPS 2.0** | National policy [U] | Tertiary-hospital EMR grading targets (historically level 4 or higher); closed-loop processes; structured EMR; interoperability testing; **MLPS Level 3** for core systems |
| **Saudi CBAHI** (+ MOH digital-health targets, NPHIES) | Active [U] | Patient ID, medication management, information management/record retention; national exchange integration |
| **UAE DoH (Abu Dhabi) / DHA / MOHAP** | Active [U] | ADHICS controls, JAWDA quality KPIs extracted from the EMR, Malaffi/NABIDH/Riayati HIE integration, Emirates ID-based identity |

**Feature implications common to all accreditors:** two-identifier patient ID everywhere (screens, labels, wristbands, downtime prints); closed-loop medication administration (CPOE, pharmacist verification, BCMA, eMAR) with override audit; critical-result acknowledgement with escalation; medication reconciliation at transitions; authentication and co-signature timers; document control; incident/event reporting; downtime plans with drills; audit trails; record retention and release controls.

---

## 8. Medico-legal record requirements

### 8.1 Legal health record (LHR) and designated record set

- Define, per tenant, the **legal health record**: the official business record disclosed on request and used in litigation, separate from operational metadata.
- Define the HIPAA **designated record set**: medical and billing records used to make decisions about individuals.
- Configure which document types, results, images, messages, audit metadata and device data are part of the LHR, and how the LHR is rendered for release: paginated PDF plus FHIR/C-CDA, with a version history and signature manifestation.
- Every entry needs an author, an authenticator, the signature date/time, the event date/time, the **entry date/time** (late entries flagged), version history, amendment links, and source system/device provenance.

### 8.2 Retention periods (selected; verify locally)

| Jurisdiction | Adult records | Minors / special | Source / confidence |
|---|---|---|---|
| US (federal floor) | Medicare CoP: at least **5 years** (§482.24) | States commonly require 7–10 years for adults, and age of majority plus several years for minors; mammography at least 5–10 years; occupational exposure 30 years | [U] |
| US HIPAA documentation | Policies, risk analyses, BAAs, access logs (as documentation): **6 years** | — | §164.316 [U] |
| England (NHS Records Management Code 2023) | Adult hospital: **8 years** after treatment concludes | Children: until 25th birthday (26th if 17 at conclusion); maternity 25 years; mental health 20 years; some oncology 30 years | [U] |
| Germany | **10 years** (BGB §630f) | Radiation/radiotherapy records longer (up to 30 years) | [U] |
| France | **20 years** from last stay/visit | Minors: at least until age 28 | [U] |
| Netherlands | **20 years** (WGBO) | — | [U] |
| UAE | **At least 25 years** from last health procedure (Federal Law 2/2019, Art. 20; Cabinet Res. 32/2020) | — | [V, 81] |
| India | IMC regulations: inpatient records **3 years**; medico-legal cases until disposal; NABH and state rules often longer | DPDP erasure obligations defer to other laws [14] | [U] |
| China | Outpatient at least **15 years**; inpatient at least **30 years** | — | [U] |
| Australia (NSW/Vic) | **7 years** from last entry | Minors: until age 25 | [U] |
| Brazil | **20 years** (CFM / Law 13.787/2018) | — | [U] |
| South Africa (HPCSA) | **6 years** after dormancy | Minors: until 21st birthday; mentally incompetent: lifetime | [U] |
| Saudi Arabia / Singapore / Kenya / Nigeria | Set by MOH/regulator policy | — | **Verify** |

**Design implication:** a jurisdiction-aware retention engine with per-record-class schedules. The default must be **never auto-delete clinical records without an explicit, approved retention policy** and no active legal hold. Retention must apply consistently to backups, archives, search indexes and analytics copies (WA MHMDA deletion reaches backups [11]).

### 8.3 Electronic signatures

| Jurisdiction | Framework | Practical HMS implication |
|---|---|---|
| US | ESIGN Act + UETA [U]; CMS signature requirements (no stamped signatures; electronic signatures acceptable with controls) [U]; **DEA EPCS** (21 CFR 1311) [U]; 21 CFR Part 11 for FDA-regulated research records [U] | Signature = authenticated user + intent + manifestation + linkage + audit; co-signature workflows; EPCS-certified signing |
| EU | **eIDAS 2.0** (Reg. (EU) 2024/1183, amending 910/2014; EUDI Wallets due from Member States around end 2026) [U]; a qualified electronic signature (QES) equals a handwritten one | Advanced signatures are typical for clinical notes. **Some national e-prescription schemes require a QES** (e.g., Germany's eRezept via the health professional card [U]). Integrate national eID/smartcards and qualified trust-service providers |
| UK | Electronic Communications Act 2000 + UK eIDAS [U] | NHS smartcard / CIS2 identity for signing; EPS advanced e-signatures [U] |
| India | **IT Act 2000** s.3 (digital signature), **s.3A** (electronic signature incl. Aadhaar eSign), s.5 (legal recognition) [U]; **Bharatiya Sakshya Adhiniyam 2023** (in force 1 Jul 2024) admissibility certificate for electronic records [U]; Telemedicine Practice Guidelines 2020 for e-prescriptions [U] | Aadhaar eSign / DSC integration for consent forms and discharge summaries; evidence-certificate generation for court requests |
| KSA / UAE / Singapore / China | Electronic Transactions Law (KSA 2007); Federal Decree-Law 46/2021 on Electronic Transactions & Trust Services (UAE); Electronic Transactions Act (SG); Electronic Signature Law (CN) [U] | Pluggable signature providers per market |

### 8.4 Amendments, corrections and late entries

- **Never overwrite or delete** a signed entry. Corrections create a new version linked to the original, with reason, author and timestamp, and the original stays viewable to authorized users.
- Patient-requested amendments: HIPAA §164.526 (act within 60 days; allow statements of disagreement); ONC (d)(4) append [39]; GDPR Art. 16 rectification, implemented as an addendum plus a flag; UK notes of disagreement [U].
- Late entries are marked with both event time and entry time. Downtime back-entries are flagged (§6.3).
- Wrong-patient documentation needs a controlled "move" workflow with audit and notification to downstream recipients, including corrected-result messages to HIE and portals.

### 8.5 Litigation hold, release of information, eDiscovery

- **Legal hold** at patient, encounter, user or date-range level. It suspends retention purges across all copies, preserves all versions and **audit trails**, and records custodian and chain of custody. Courts treat audit trails as discoverable; spoliation sanctions apply (US FRCP 37(e)) [U].
- **Release of information (ROI)** module:
  - request intake with identity verification and authority checks (proxy, attorney, subpoena versus court order, which matters for Part 2 [8])
  - clocks: HIPAA 30 days [1]; GDPR/UK one month; DPDP rights from May 2027 [14]
  - fee rules: the first copy is free under GDPR per CJEU C-307/22 [U]
  - sensitivity-label filtering with redaction
  - accounting of disclosures; delivery via portal, secure link, or FHIR/C-CDA
  - This is also how we avoid information blocking (timely electronic access) [12].
- **Patient portal** default: immediate release of results and notes, with documented exceptions (US Cures Act) [12].

---

## 9. Implications for our build (opinionated)

### 9.1 Ten architectural decisions to lock in now

1. **Build a "Trust Plane" as shared platform services that every module must use:** Identity (federation, MFA, step-up, sessions), Policy (RBAC + ABAC + care relationship + sensitivity labels + consent), Audit (BALP AuditEvent pipeline, tamper-evident store, SIEM streaming, patient access log), Keys (per-tenant KMS/HSM, BYOK/HYOK), Residency (cell routing), Retention/Legal hold, and De-identification. No module talks to a data store without the Policy and Audit SDKs. **Retrofitting segmentation and audit later is the most expensive mistake HMS vendors make.**
2. **Sensitivity labels and purpose-of-use from day one.** Adopt the HL7 confidentiality/sensitivity vocabulary and propagate it through FHIR `meta.security`, documents, prints and analytics. This covers Part 2, state laws, GDPR Art. 9, EHDS restrictions and VIP/employee protection with a single mechanism.
3. **Cell-based, sovereign-capable deployment.** Every PHI-bearing component, backup, key and log lives in a region-pinned cell. The global control plane is PHI-free. The cell blueprint must be deployable in UAE, KSA, India, Australia, France/Germany and Kenya without code changes, plus an on-prem/hybrid variant for customers that require it.
4. **Phishing-resistant MFA by default, and no exceptions.** Passkeys/FIDO2/smartcard for all privileged, remote and vendor access; badge tap-and-go for clinical workstations; JIT PAM with session recording for our own staff; a customer-visible support-access log. This is the Change Healthcare lesson in one line.
5. **Downtime-first clinical design.** Ship the BCA-equivalent (local encrypted snapshots, read-only shadow instance with independent identity, printable unit packets), offline BCMA with reconciliation, downtime ID blocks, and back-entry workflows **in v1**. Accreditors (JC/JCI/NABH), SAFER and every incident post-mortem point here.
6. **Immutable, isolated, tested recovery.** A logically air-gapped backup vault with separate identity; clean-room rebuild automation; a common point-in-time restore; quarterly restore tests; a **72-hour T0 cyber-recovery objective** publicly committed in our SLA.
7. **Keep the core HMS outside medical-device regulation, deliberately.** Build CDS to FDA's Criterion 4 transparency pattern (inputs, basis, knowns/unknowns, non-time-critical) [42] and to MDCG 2019-11 rev.1 [34]. Put **device-grade functions** in a separately governed **Regulated Modules** track (ISO 13485 / IEC 62304 / ISO 14971 / IEC 81001-5-1) with its own release train: continuous deterioration/sepsis alerting, high-risk dose calculators, transfusion/BECS, PDMS alarms, triage AI. **For v1: integrate cleared third-party transfusion and early-warning products rather than build them.** *(Clarified 2026-10-16 during reconciliation with `03`, `04`, `08` and `09`:*
   - *Transfusion, all markets in v1: ship bedside electronic transfusion verification inside BCMA, plus an HL7 interface to an external blood-bank system/BECS. A native ISBT 128 blood-bank module comes later, **non-US only**, inside this Regulated Modules track once the ISO 13485 / IEC 62304 QMS exists. US deployments always integrate a cleared BECS.*
   - *Early warning in v1: NEWS2/PEWS ships as a transparent published-score calculator on nurse-entered vitals, with escalation tasks. It is versioned in this track and released first in non-US markets. Sepsis screening is non-interruptive and rule-based, and it shows its inputs. v1 has **no automated continuous alarms from device streams**. US deployments use cleared partners.*
   - *Record the per-market regulatory determination (FDA, EU MDR Rule 11, SFDA, CDSCO, UAE) for each of these functions before release.)*
8. **Adopt IEC 81001-5-1 + NIST SSDF as the SDLC now**, with SBOM/VEX per release, signed artifacts, a public VDP, and CVE issuance. This satisfies FDA 524B expectations for future modules, the CRA (reporting already live since 11 Sep 2026 for on-prem components), NHS/DTAC, and the CISA pledge in one programme.
9. **Make the audit log a product.** Support privacy-monitoring integrations (Protenus / Imprivata FairWarning-style), give patients an access view (EHDS 2029), give regulators forensic-grade exports, and give customers SIEM streaming at no extra charge.
10. **An AI governance framework baked into the platform:** a DSI/model registry with ONC (b)(11) source attributes, human-oversight UI patterns, AI event logging (AI Act Art. 12), bias monitoring, and residency-safe LLM routing. This turns 2027–2028 AI Act and ONC obligations into configuration rather than rework.

### 9.2 Phased compliance roadmap

| Phase | Window | Goals | Exit criteria |
|---|---|---|---|
| **0 — Foundations** | M0–M3 | ISMS/PIMS scope; Trust Plane architecture; regulatory-boundary memo per module (FDA/MDR/AI Act); appoint **CISO, DPO, Clinical Safety Officer**; start DCB0129-style hazard log; IEC 81001-5-1 SSDLC; SBOM pipeline; VDP + CISA pledge; threat models for identity, audit, consent | Architecture decision records approved; hazard log live; CI security gates enforced |
| **1 — Enterprise-ready MVP** | M3–M12 | SOC 2 Type I (M6), then **Type II (M12)**; **ISO 27001 + 27701/27017/27018 (M12)**; first independent pen test (by M9); HIPAA BA programme + BAA template; GDPR DPA/SCC/TIA + DPIA kit; HA multi-AZ; immutable backups + clean-room DR tested; BCA-equivalent downtime; badge tap-and-go; break-the-glass; Part 2 consent and labels; SIEM streaming | Platform enterprise-ready, with a documented restore test and a downtime drill. First design-partner hospital contracted and in implementation. *(Reconciled 2026-10-16: the earlier exit criterion was "first design-partner hospital live" by M12. The go-live date is now set by the critical-path build-and-go-live plan (proposed business-plan report 12), not by this compliance roadmap. With about 12 months to build the MVP (`05` §9.3, `03` §21.1) and about 12–18 months to implement at a 100–300-bed site (9–12 months below 150 beds; `10` §4.2), first go-live realistically falls around **M18–24 or later**.)* |
| **2 — Market certifications** | M12–M24 | *(Reconciled 2026-10-16 to the single market roadmap in `06` §8: Wave 1 India + KSA, Wave 1b UAE. US ONC/HITRUST moved to the US go/no-go phase, and UK certifications to a UK entry decision; see the row below.)* **India:** India cell, DPDP readiness (target Nov 2026, deadline 13 May 2027), CERT-In 6-hour process, ABDM M1–M3, NABH HIS/EMR certification. **GCC:** KSA cell (CST CSP, NCA ECC/CCC mapping, PDPL), UAE cell (ADHICS mapping, Malaffi/NABIDH/Riayati). CSA STAR L2; CRA vulnerability/incident reporting process for EU on-prem components | Certificates and attestations issued; first contract signed in each target market |
| **3 — Regulated modules and EU** | M24–M36 | ISO 13485 QMS (QMSR-aligned); first SaMD module (FDA 510(k)/De Novo; CE IIa) with PCCP; **EU AI Act high-risk conformity** (Annex III triage by 2 Dec 2027 if pursued; Annex I device AI by 2 Aug 2028); **CRA full conformity by 11 Dec 2027**; **EHDS EHR conformity** (logging and interoperability components, EEHRxF) ready for **Mar 2029**; HDS (FR), C5 Type 2 (DE), NEN 7510 (NL) as GTM requires | Regulated-module release train operating; EU go-live |
| **US / UK on market decision** *(moved from Phase 2; reconciled 2026-10-16)* | After the US go/no-go (Phase 3 in `06` §8) or a UK entry decision | **US:** ONC certification retargeted to the 19 criteria HTI-5 would retain plus the 7 revised ones (§2.1): (g)(10) SMART v2, (b)(10) EHI export, CPOE, e-Rx, CQMs, public health, HTI-4 ePA, RWT. Confirm against the HTI-5 final rule. HITRUST i1, then r2. **UK:** DSPT + DTAC + Cyber Essentials Plus + DCB0129 safety case | Certificates issued; first US or UK contract |
| **4 — Maturity and optional markets** | M36+ | Customer enablement for HIMSS EMRAM Stage 7 / INFRAM; FedRAMP (if US federal); China (MLPS L3 + partner JV) only as a separate business decision; Australia (IRAP, MHR conformance) | Stage-7 reference sites; optional market entries |

### 9.3 Watch-list (re-verify quarterly)

- HIPAA Security Rule final rule (target about Jul 2027), HIPAA Privacy Rule final rule (Aug 2026 target missed; expected before end-2026), the Health Care Cybersecurity and Resiliency Act (Senate-passed 1 Oct 2026, pending in the House), and any 2026 CMS proposals tying HPH CPGs to Conditions of Participation [1][2][3][49].
- ONC certification deregulation and the current criteria list; Insights Condition reporting schedule [37][38].
- FDA: final AI-enabled device guidance; further CDS enforcement-discretion changes [42][45].
- EU: AI Act harmonised standards; MDR/AI Act sectoral alignment delegated act (by Aug 2028); EHDS implementing acts (Mar 2027); CRA harmonised standards; NIS2 amendments; GDPR Digital Omnibus [28][29][30][31][32].
- India: any notified compression of the DPDP timeline; SDF designations; Data Protection Board constitution [16][17].
- UK: revised DCB0129/0160 and DTAC; DUAA commencement; Cyber Security and Resilience Bill [U].
- EU GDPR Digital Omnibus (96 h breach notification, "high-risk" threshold, relative personal-data definition), still under negotiation [82].
- Singapore Health Information Act commencement (planned early 2027) and NEHR contribution specs [76]; Texas SB 1188 interpretation of offshore access and any AG/HHSC guidance [75]; Kenya digital-health regulations; Saudi health-sector data rules [U].
- MHRA consultation on indefinite recognition of CE-marked devices [85]; DSPT IT-supplier audit guidance for 2026-27 [87].

### 9.4 Things we should explicitly *not* do

- Do not let any module write PHI to logs, analytics or third-party SaaS (including error trackers and product analytics) outside the cell.
- Do not depend on a single clearinghouse, ePrescribing hub or lab network without a degraded-mode path.
- Do not build blood-bank/BECS or continuous deterioration alerting into the core in v1. Integrate cleared products. *(Clarified 2026-10-16: this applies in **all markets** for v1. v1 still ships bedside transfusion verification inside BCMA, an interface to the external blood-bank system, and transparent NEWS2/PEWS calculators with escalation tasks, which have no device-stream alarms. A native ISBT 128 blood bank may follow later, non-US only, in the Regulated Modules track once the QMS exists; see §9.1 #7.)*
- Do not put third-party trackers or session-replay tools on authenticated patient or clinician pages.
- Do not promise "HIPAA certified" or "GDPR certified" in marketing. Neither exists. Cite the actual attestations.

---

## 10. Sources

Confidence tags in the body show whether each claim was verified against the source this session. Sources marked *(reference)* are canonical texts cited for orientation that were **not fetched** this session.

1. HIPAA Journal, "HIPAA Updates and HIPAA Changes in 2026": https://www.hipaajournal.com/hipaa-updates-hipaa-changes/
2. NormGrid, "HIPAA Security Rule Update: Status and Proposed Changes": https://www.normgrid.com/hipaa/security-rule-update/
3. Cyberz.pro, "HIPAA Security Rule Changes in 2026: What Actually Changed, and What Slipped to 2027" (30 Jul 2026): https://cyberz.pro/blog/2026/07/30/hipaa-security-rule-changes-2026/
4. Federal Register, "HIPAA Security Rule To Strengthen the Cybersecurity of Electronic Protected Health Information" (NPRM, 6 Jan 2025): https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information
5. HHS OCR, HIPAA Security Rule NPRM Fact Sheet: https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html
6. Husch Blackwell, "Federal Court Vacates 2024 HIPAA Reproductive Health Privacy Rule": https://www.huschblackwell.com/newsandinsights/federal-court-vacates-2024-hipaa-reproductive-health-privacy-rule-key-impacts-for-covered-entities-and-npp-compliance
7. Health Law Diagnosis, "Appeals Dropped of Decision Vacating HIPAA Reproductive Health Privacy Rule" (Sept 2025): https://www.healthlawdiagnosis.com/2025/09/appeals-dropped-of-decision-vacating-hipaa-reproductive-health-privacy-rule-confirming-apparent-end-of-the-rule-and-attestation-requirement/
8. HHS, "Understanding Confidentiality of SUD Patient Records (Part 2)": https://www.hhs.gov/hipaa/part-2/index.html
9. HHS, "Fact Sheet: 42 CFR Part 2 Final Rule": https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/
10. Snell & Wilmer, "42 CFR Part 2 and Privacy Rule Compliance: Action Required by February 16, 2026": https://www.swlaw.com/publication/42-cfr-part-2-and-privacy-rule-compliance-action-required-by-february-16-2026/
11. Washington State Attorney General, "Protecting Washingtonians' Personal Health Data and Privacy" (My Health My Data Act): https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy
12. ASTP/ONC, "Information Blocking": https://www.healthit.gov/topic/information-blocking
13. HIPAA Journal, "HIPAA Violation Fines" (2025–2026 enforcement, CMP tiers): https://www.hipaajournal.com/hipaa-violation-fines/
14. DLA Piper, Data Protection Laws of the World: India: https://www.dlapiperdataprotection.com/?t=law&c=IN
15. dcomply, "DPDP Rules 2025: All 22 Rules, effective dates": https://dpdpa.dcomply.in/rules/
16. Business Standard, "MeitY may cut compliance timeline for key DPDP rules to 12 months" (Jan 2026): https://www.business-standard.com/technology/tech-news/meity-may-cut-compliance-timeline-for-key-dpdp-rules-to-12-months-126012201293_1.html
17. MirvoLegal, "DPDP Rules, 2025: Compliance Timeline for Data Fiduciaries (as at September 2026)": https://www.mirvolegal.com/insights/dpdp-rules-2025-compliance-timeline/
18. Mondaq, "MeitY Plans To Cut Short DPDP Compliance Timeline And Notify Cross Border Restrictions For SDFs": https://www.mondaq.com/india/data-protection/1773554/meity-plans-to-cut-short-dpdp-compliance-timeline-and-notify-cross-border-restrictions-for-sdfs
19. DLA Piper, Data Protection Laws of the World: Saudi Arabia: https://www.dlapiperdataprotection.com/?t=law&c=SA
20. DLA Piper, Data Protection Laws of the World: United Arab Emirates: https://www.dlapiperdataprotection.com/?t=law&c=AE
21. DLA Piper, Data Protection Laws of the World: Singapore: https://www.dlapiperdataprotection.com/?t=law&c=SG
22. DLA Piper, Data Protection Laws of the World: Australia: https://www.dlapiperdataprotection.com/?t=law&c=AU
23. DLA Piper, Data Protection Laws of the World: China: https://www.dlapiperdataprotection.com/?t=law&c=CN
24. DLA Piper, Data Protection Laws of the World: Brazil: https://www.dlapiperdataprotection.com/?t=law&c=BR
25. DLA Piper, Data Protection Laws of the World: Kenya: https://www.dlapiperdataprotection.com/?t=law&c=KE
26. DLA Piper, Data Protection Laws of the World: Nigeria: https://www.dlapiperdataprotection.com/?t=law&c=NG
27. DLA Piper, Data Protection Laws of the World: South Africa: https://www.dlapiperdataprotection.com/?t=law&c=ZA
28. European Commission, "European Health Data Space Regulation (EHDS)": https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en
29. European Commission, "NIS2 Directive": https://digital-strategy.ec.europa.eu/en/policies/nis2-directive
30. European Commission, "Cyber Resilience Act": https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
31. Gibson Dunn, "EU AI Act Omnibus Agreement: Postponed High-Risk Deadlines and Other Key Changes": https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/
32. Orrick, "EU AI Act Update: Digital Omnibus Finalizes 8 Compliance Changes" (Jul 2026): https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes
33. European Parliament Legislative Train, "Digital Omnibus on AI": https://www.europarl.europa.eu/legislative-train/package-digital-package/file-digital-omnibus-on-ai
34. European Commission, "Guidance: MDCG endorsed documents and other guidance" (MDCG 2019-11 rev.1, MDCG 2025-6, MDCG 2019-16 rev.1): https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-endorsed-documents-and-other-guidance_en
35. legislation.gov.uk, Data (Use and Access) Act 2025 (c. 18), contents: https://www.legislation.gov.uk/ukpga/2025/18/contents
36. NHS Data Security and Protection Toolkit, News: https://www.dsptoolkit.nhs.uk/News
37. ASTP/ONC, "Certification Program Regulations": https://www.healthit.gov/certification-health-it/certification-program-regulations/
38. ASTP/ONC, "Certification Criteria Updates by Regulatory Deadline": https://www.healthit.gov/certification-health-it/onc-certification-criteria-health-it-regulatory-update-deadline/
39. Cornell LII, 45 CFR §170.315, "2015 Edition health IT certification criteria": https://www.law.cornell.edu/cfr/text/45/170.315
40. ASTP/ONC, "Certification of Health IT": https://www.healthit.gov/topic/certification-ehrs/certification-health-it
41. ASTP/ONC, "SAFER Guides": https://www.healthit.gov/topic/safety/safer-guides
42. FDA, "Clinical Decision Support Software: Guidance for Industry and FDA Staff" (issued 29 Jan 2026; supersedes 6 Jan 2026): https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software (PDF: https://www.fda.gov/media/109618/download)
43. FDA, "Examples of Software Functions That Are NOT Medical Devices": https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-are-not-medical-devices
44. FDA, "Device Software Functions Including Mobile Medical Applications": https://www.fda.gov/medical-devices/digital-health-center-excellence/device-software-functions-including-mobile-medical-applications
45. FDA, "Artificial Intelligence-Enabled Device Software Functions: Lifecycle Management and Marketing Submission Recommendations" (draft, Jan 2025): https://www.fda.gov/regulatory-information/search-fda-guidance-documents/artificial-intelligence-enabled-device-software-functions-lifecycle-management-and-marketing
46. FDA, "Cybersecurity in Medical Devices: Quality Management System Considerations and Content of Premarket Submissions" (final, Feb 2026): https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-medical-devices-quality-management-system-considerations-and-content-premarket
47. Cornell LII, 21 CFR §864.9165, "Blood establishment computer software and accessories": https://www.law.cornell.edu/cfr/text/21/864.9165
48. CISA, "Secure by Design Pledge": https://www.cisa.gov/securebydesign/pledge
49. HHS, "Healthcare and Public Health (HPH) Cybersecurity Performance Goals": https://hhscyber.hhs.gov/cybersecurity-performance-goals.html
50. HITRUST, "Assessments and Certifications": https://hitrustalliance.net/assessments-and-certifications
51. NIST, "Cybersecurity Framework": https://www.nist.gov/cyberframework
52. HIPAA Journal, "Healthcare Data Breach Statistics": https://www.hipaajournal.com/healthcare-data-breach-statistics/
53. HIPAA Journal, Change Healthcare cyberattack coverage: https://www.hipaajournal.com/change-healthcare-responding-to-cyberattack/
54. Healthcare IT News, "New numbers from the Change Healthcare data breach: 193 million affected": https://www.healthcareitnews.com/news/new-numbers-change-healthcare-data-breach-193-million-affected
55. BleepingComputer, "Ascension: Health data of 5.6 million stolen in ransomware attack": https://www.bleepingcomputer.com/news/security/ascension-health-data-of-56-million-stolen-in-ransomware-attack/
56. Becker's Hospital Review, "Ascension ransomware attack affects 5.6 million": https://www.beckershospitalreview.com/healthcare-information-technology/cybersecurity/ascension-ransomware-attack-affects-5-million/
57. The Record, "Ransomware attack contributed to patient's death, says Britain's NHS" (25 Jun 2025): https://therecord.media/ransomware-attack-contributed-patient-death-uk-nhs
58. The Register, "NHS supplier ends probe into ransomware attack that contributed to patient death" (13 Nov 2025): https://www.theregister.com/2025/11/13/synnovis_qilin_investigation/
59. Digital Health, "Patient death linked to cyber attack on NHS pathology provider" (Jun 2025): https://www.digitalhealth.net/2025/06/patient-dies-as-a-result-of-cyber-attack-on-nhs-pathology-provider/
60. PwC for HSE, "Conti cyber attack on the HSE: Independent Post Incident Review" (3 Dec 2021): https://cyberireland.ie/wp-content/uploads/2022/02/conti-cyber-attack-on-the-hse-full-report.pdf (executive summary: https://regmedia.co.uk/2021/12/10/ireland_hse_ransomware_exec_summary_pwc_report.pdf)
61. The Stack, "PwC's HSE hack post-incident report should be a textbook for leaders": https://www.thestack.technology/pwc-hse-hack-post-incident-report/
62. Office of the Comptroller and Auditor General (Ireland), "Financial impact of cyber security attack" (2022): https://www.audit.gov.ie/en/find-report/publications/2022/12-financial-impact-of-cyber-security-attack.pdf
63. HIPAA Journal, Kettering Health ransomware attack: https://www.hipaajournal.com/kettering-health-ransomware-attack/
64. UpGuard, "Biggest Data Breaches in Healthcare" (updated Jul 2026): https://www.upguard.com/blog/biggest-data-breaches-in-healthcare
65. DOTmed, "Healthcare ransomware attacks rose 14% in first half of 2026, report finds": https://www.dotmed.com/news/story/66564
66. Dameff C, Tully J, Chan TC, et al., "Ransomware Attack Associated With Disruptions at Adjacent Emergency Departments in the US", *JAMA Netw Open* 2023;6(5):e2312270: https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2804585
67. Neprash HT, McGlave CC, Cross DA, et al., "Trends in Ransomware Attacks on US Hospitals, Clinics, and Other Health Care Delivery Organizations, 2016–2021", *JAMA Health Forum* 2022;3(12):e224873: https://jamanetwork.com/journals/jama-health-forum/fullarticle/2799961
68. McGlave CC, Neprash HT, Nikpay S, "Hacked to Pieces? The Effects of Ransomware Attacks on Hospitals and Patients" (SSRN working paper, 2023): https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4579292 *(not accessible this session)*
69. NABH, "Notification – Implementation Plan of 6th Edition NABH Accreditation Standards for Hospitals" (10 Sep 2024): https://nabh-portal-live.s3.ap-south-1.amazonaws.com/wp-content/uploads/2025/07/24125105/Notification-%E2%80%93-Implementation-Plan-of-6th-Edition-Standards.pdf
70. NABH, "Digital Health Standards" (Hospitals 2nd ed.; HIS/EMR Systems 1st ed. and test cases; certification notices): https://nabh.co/digital-health-standards/
71. ENISA, "Health Threat Landscape" (Jul 2023) and related "Cyber Hygiene in the Health Sector" (Sep 2025): https://www.enisa.europa.eu/publications/health-threat-landscape
72. Chief Healthcare Executive, "These are the biggest health data breaches in the first half of 2025": https://www.chiefhealthcareexecutive.com/view/these-are-the-biggest-health-data-breaches-in-the-first-half-of-2025
73. Quarles, "HIPAA Reproductive Health Rule Vacated Nationally": https://www.quarles.com/newsroom/publications/hipaa-reproductive-health-rule-vacated-nationally

*Added in pass-2 verification (2026-10-16):*

74. European Commission, "Adequacy decisions" (Brazil decision dated 26 Jan 2026; mutual adequacy news 10 Feb 2026): https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
75. HIPAA Journal, "Texas Enacts Law Governing Security and Storage of Electronic Health Records" (18 Jul 2025): https://www.hipaajournal.com/texas-enacts-electronic-health-record-law/ (enrolled bill text: https://legiscan.com/TX/text/SB1188/id/3247564, not fetched)
76. Singapore MOH / HealthInfo, "Announcements" (HIA passed 12 Jan 2026; HIA circular 6 Mar 2026; NEHR Contribution Requirements 27 Jul 2026; HIA Implementation Guide v2.0, 14 Aug 2026): https://www.healthinfo.gov.sg/news-and-events/announcements/ (early-2027 commencement and NEHR data list per law-firm and gov.sg summaries, e.g., Baker McKenzie Jan 2026: https://www.bakermckenzie.com/en/insight/publications/2026/01/singapore-health-information-bill-passed-in-parliament, not fetched)
77. McDermott Will & Schulte, "Joint Commission announces key accreditation updates for 2026" (14 Nov 2025): https://www.mcdermottlaw.com/insights/joint-commission-announces-key-accreditation-updates-for-2026/
78. Comparitech, "Ransomware Roundup: H1 2026" (updated 2 Jul 2026): https://www.comparitech.com/news/ransomware-roundup-h1-2026/
79. HIPAA Journal, "HHS Office for Civil Rights Establishes Part 2 Enforcement Program" (16 Feb 2026): https://www.hipaajournal.com/hhs-part2-enforcement-program/ (HHS press release of 13 Feb 2026 reported by Ropes & Gray, Foley Hoag and others; hhs.gov blocked automated access)
80. CERT-In, Directions No. 20(3)/2022-CERT-In under s.70B(6) IT Act (28 Apr 2022), paras (i), (ii), (iv): https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf (text confirmed from the official-domain document via search index; direct fetch failed) and FAQs (May 2022): https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf
81. Latham & Watkins, "New UAE Law Regulates Healthcare Data" (Jun 2019; Arts 13 and 20 of Federal Law No. 2 of 2019 and penalties): https://www.lw.com/en/insights/2019/06/new-uae-law-regulates-healthcare-data
82. iubenda, "EU Digital Omnibus GDPR changes: proposed amendments explained" (COM(2025) 837, 19 Nov 2025): https://www.iubenda.com/en/blog/eu-digital-omnibus-gdpr-changes-proposed-amendments-explained/
83. FDA, "Quality Management System Regulation (QMSR)": https://www.fda.gov/medical-devices/postmarket-requirements-devices/quality-management-system-regulation-qmsr
84. European Commission, "Cyber Resilience Act – Summary of the legislative text": https://digital-strategy.ec.europa.eu/en/policies/cra-summary
85. GOV.UK / MHRA, "Regulating medical devices in the UK": https://www.gov.uk/guidance/regulating-medical-devices-in-the-uk
86. NIST, SP 800-63-4 Digital Identity Guidelines (final, Jul 2025): https://pages.nist.gov/800-63-4/
87. NHS DSPT, "DSPT Audit 26-27 Areas of Mandatory Audit" (1 Oct 2026; includes a separate IT-supplier audit list): https://www.dsptoolkit.nhs.uk/News/170
88. Companion reports used in the 2026-10-16 reconciliation: `03` §8.3/§21, `04` §8.2/§11, `05` §9.3, `06` §4.2 (HTI-5 status table and the 19 retained criteria, cross-checked there against the ASTP/ONC overview deck of 19 Feb 2026) and §8, `08` §6.4/§12.6, `09` §0/§9.2–9.3, `10` §4.2; see `RECONCILIATION-LOG.md`.
89. Federal Register, "Health Data, Technology, and Interoperability: ASTP/ONC Deregulatory Actions To Unleash Prosperity" (HTI-5 proposed rule), doc. 2025-23896, 29 Dec 2025 (not re-fetched during reconciliation; retained and revised criteria taken from `06` §4.2): https://www.federalregister.gov/documents/2025/12/29/2025-23896/health-data-technology-and-interoperability-astponc-deregulatory-actions-to-unleash-prosperity

**Reference texts (canonical; not fetched this session; claims citing them are tagged [U]):**
- R1. GDPR, Regulation (EU) 2016/679: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- R2. AI Act, Regulation (EU) 2024/1689: https://eur-lex.europa.eu/eli/reg/2024/1689/oj
- R3. Cyber Resilience Act, Regulation (EU) 2024/2847: https://eur-lex.europa.eu/eli/reg/2024/2847/oj
- R4. EHDS, Regulation (EU) 2025/327: https://eur-lex.europa.eu/eli/reg/2025/327/oj
- R5. NIS2, Directive (EU) 2022/2555: https://eur-lex.europa.eu/eli/dir/2022/2555/oj
- R6. eIDAS 2.0, Regulation (EU) 2024/1183: https://eur-lex.europa.eu/eli/reg/2024/1183/oj
- R7. MDR, Regulation (EU) 2017/745: https://eur-lex.europa.eu/eli/reg/2017/745/oj
- R8. CJEU, Case C-307/22 *FT v DW* (free first copy of medical records): https://curia.europa.eu/juris/liste.jsf?num=C-307/22
- R9. NIST SP 800-63-4, Digital Identity Guidelines: https://pages.nist.gov/800-63-4/
- R10. NIST SP 800-66r2, Implementing the HIPAA Security Rule: https://csrc.nist.gov/pubs/sp/800/66/r2/final
- R11. HHS 405(d) Program / HICP: https://405d.hhs.gov/
- R12. IHE ITI Basic Audit Log Patterns (BALP): https://profiles.ihe.net/ITI/BALP/
- R13. HL7 SMART App Launch: https://hl7.org/fhir/smart-app-launch/
- R14. CERT-In Directions under Section 70B(6) of the IT Act (28 Apr 2022): https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf
- R15. The Joint Commission (standards, NPGs, Sentinel Event Alerts): https://www.jointcommission.org/
- R16. HIMSS Maturity Models (EMRAM, INFRAM, AMAM, DIAM, CCMM): https://www.himss.org/maturity-models/

---

## Verification log (pass 2, 2026-10-16)

Scope: about 40 claims re-checked, prioritising [U]/[R] items and time-sensitive regulatory dates. Several primary sites blocked automated access (hhs.gov, jointcommission.org, iso.org, eur-lex, pib.gov.in, CERT-In direct PDF fetch). In those cases the best available official-domain text or credible secondary source was used, as noted.

| Claim | Verdict | Source | Note |
|---|---|---|---|
| HIPAA Security Rule final rule missed May 2026; agenda now targets **Jul 2027** | Confirmed | [1] | HIPAA Journal citing the 2026 Unified Agenda |
| HIPAA Privacy Rule final rule targeted Aug 2026, not yet published | Confirmed | [1] | HIPAA Journal now expects it before end-2026 |
| 2026 HIPAA CMPs: "about $145 to about $2.19M; intermediate tiers conflict" | Corrected | [13] | Tier minimums $145 / $1,461 / $14,602 / $73,011; official cap $2,190,294 for all tiers; enforcement-discretion caps lower for Tiers 1–3 |
| OCR: 14 actions in 2025, 11 in 2026 to date; risk-analysis initiative extended to risk management | Confirmed | [13] | Counts are entries in HIPAA Journal's tables, not official OCR totals |
| Part 2 compliance 16 Feb 2026; OCR enforcement programme announced 13 Feb 2026 | Confirmed | [79], [1] | Enforcement began 16 Feb 2026; no investigation of earlier violations |
| Large breaches: 2023 = 745; 2024 = 741 / >289M; 2025 = 772–805 / ~138.5M; 2026 to 30 Apr = 252; backlog 936; 43-day shutdown | Confirmed | [52] | Source's own 2025 and 2026 counts are internally inconsistent; range retained |
| Texas SB 1188 "reportedly" requires US-only EHR storage, phased from 2026 [U] | Corrected (upgraded) | [75] | In force 1 Sep 2025; US storage from **1 Jan 2026**, covering cloud/third-party copies and pre-2026 records; AG penalties $5k/$25k/$250k |
| EU AI Act Digital Omnibus final; Annex III **2 Dec 2027**; Annex I **2 Aug 2028**; Art. 50(2) legacy systems 2 Dec 2026 | Confirmed | [33], [31] | Added: Reg. (EU) 2026/1744, Council adoption 29 Jun 2026, OJ 24 Jul 2026; provisional agreement 6 May 2026 |
| EHDS in force 26 Mar 2025; implementing acts Mar 2027; group 1 Mar 2029; group 2 Mar 2031; secondary use 2029/2031 | Confirmed | [28] | EC page does not give a specific date for EHR-system obligations ("most obligations… 4 years after entry into force") |
| CRA in force 10 Dec 2024; reporting **11 Sep 2026**; full **11 Dec 2027**; Commission guidance 27 Jul 2026 | Confirmed | [30] | — |
| CRA reporting "reportedly" covers products already on the market [U] | Confirmed (upgraded) | [84] | Commission summary states this explicitly |
| CRA excludes MDR/IVDR products; pure SaaS out of scope | Still unverified | [84] | EC summary only says products covered by other Union legislation may be excluded; check Reg. 2024/2847 Art. 2 |
| NIS2 targeted amendments proposed 20 Jan 2026 | Confirmed | [29] | — |
| GDPR Digital Omnibus proposals [U] | Corrected (expanded) | [82] | COM(2025) 837 of 19 Nov 2025; 96 h deadline, "high-risk" threshold, single entry point, relative personal-data definition; not adopted as of Oct 2026 |
| DPDP Rules notified 13 Nov 2025; phases 13 Nov 2026 / **13 May 2027**; ₹250 crore cap; 1-year log retention | Confirmed | [14], [17] | Some sources count dates one day later |
| DPDP status "as of 28 Sep 2026; no SDF designated; Board not appointed" | Corrected | [17] | Source reviewed 20 Sep 2026; Board applications invited 6 May 2026, no appointments reported; SDF claim not substantiated by source and was softened |
| CERT-In: 6 h incident reporting; 180-day logs in India; NIC/NPL NTP [U] | Confirmed (upgraded) | [80] | Official text confirmed via index of the cert-in.org.in PDF; direct fetch failed |
| Saudi PDPL: in force 14 Sep 2023, compliance 14 Sep 2024; 72 h breach notice; SAR 5M; SAR 3M + 2 years for sensitive data | Confirmed | [19] | — |
| UAE Federal Law 2/2019 Art. 13 localization; MD 51/2021 exceptions; PDPL Executive Regulations unpublished (Jan 2025) | Confirmed | [20] | — |
| UAE retention at least 25 years (Art. 20) [U] | Confirmed (upgraded) | [81] | Added: AED 500k–700k fine for breaching Art. 13 localization |
| Singapore Health Information Bill: "status could not be verified" | Corrected | [76] | Passed 12 Jan 2026; commencement planned early 2027; Implementation Guide v2.0 (14 Aug 2026) |
| EU–Brazil mutual adequacy since Jan 2026 | Confirmed | [74] | Commission decision dated 26 Jan 2026; mutual adoption news 10 Feb 2026 |
| DSPT 2026-27 (v9) audit list does **not** include IT suppliers | Refuted / corrected | [87], [36] | 2026-27 mandatory audit includes a separate 12-outcome list for IT suppliers; v9 published 2 Oct 2026 |
| FDA CDS guidance issued 6 Jan 2026, reissued 29 Jan 2026 | Confirmed | [42] | PDF cover: "issued on January 29, 2026… supersedes… January 6, 2026"; docket FDA-2017-D-6569 |
| FDA premarket cybersecurity guidance final Feb 2026, superseding Jun 2025 | Confirmed | [46] | Supersedes the 27 Jun 2025 final guidance |
| FDA AI-enabled device software guidance still draft (Jan 2025) | Confirmed | [45] | Docket FDA-2024-D-4488 |
| QMSR effective 2 Feb 2026, incorporating ISO 13485:2016 [U] | Confirmed (upgraded) | [83] | — |
| MDCG 2019-11 rev.1 (Jun 2025); MDCG 2025-6 (Jun 2025); MDCG 2019-16 rev.1 | Confirmed | [34] | 2019-16 rev.1 is dated Jul 2020; no 2026 software-specific MDCG guidance listed |
| MHRA: PMS from 16 Jun 2025; CE acceptance "extended (verify end date)" | Corrected (completed) | [85] | MDR/IVDR to 30 Jun 2030; MDD/AIMDD to 30 Jun 2028 (or earlier certificate expiry); consultation on indefinite recognition announced |
| ONC: (b)(11) privacy & security update and (b)(3) e-Rx due 31 Dec 2027; (g)(10) etc. passed 31 Dec 2025; (a)(9) expired 1 Jan 2025 | Confirmed | [38] | — |
| HITRUST e1 = 43 controls / 1 yr; i1 = 182 / 1 yr; r2 = 2 yr; AI Risk Mgmt = 51 controls | Confirmed | [50] | Breach-rate claims are vendor marketing without methodology |
| Healthcare ransomware H1 2026: 410 attacks, +14% | Confirmed with qualification | [65], [78] | 247 providers (+3–4%) + 163 healthcare businesses (+35%); US provider attacks fell >7%; the headline is vendor-driven |
| Neprash et al. 2022: 374 attacks; 44.4% disrupted care; 41.7% EHR downtime; 10.2% delays; 4.3% diversion; ~42M exposed | Confirmed | [67] | — |
| Dameff et al. 2023: ED census +15.1%, EMS +35.2%, LWBS +127.8%, door-to-room 21→31 min, stroke codes +74.6%, confirmed strokes +113.6%, diversion hours +74.1% | Confirmed | [66] | Observational before/after study (association) |
| King's College Hospital: delayed blood test due to the attack was one of several contributing factors in a death | Confirmed | [57] | ~170 harm-incidents figure not re-checked this pass (Digital Health blocked) |
| Kettering Health: access 9 Apr 2025, outage 20 May, Epic core restored 2 Jun, 1.69M affected, Interlock | Confirmed | [63] | 1,695,382 per OCR portal |
| Breach sizes: Conduent 62.2M, Episource 6.7M, TriZetto 3.4M, Aflac 13.9M, Frederick 934k, DaVita 2.69M, Yale NH 5.56M, Blue Shield CA 4.7M, Change 192.7M | Confirmed | [64] | Secondary compilation (UpGuard); Aflac totals differ across filings |
| Joint Commission 2026 restructuring into National Performance Goals [U] | Confirmed (upgraded to [R]) | [77] | Accreditation 360, effective 1 Jan 2026; 14 NPGs; hospital and CAH programmes only |
| SAFER Guides 2025 revision has 8 guides; 2016 guides still apply to CMS measure; page updated Feb 2026 | Confirmed | [41] | Page last updated 27 Feb 2026 |
| NIST SP 800-63-4 [U] | Confirmed (upgraded) | [86] | Final, Jul 2025 |
| Health Care Cybersecurity and Resiliency Act passed US Senate 1 Oct 2026 (new item) | Added, reported | [1] | Not checked against Congress.gov |
| JCI Hospital Standards 8th ed. effective 1 Jan 2024 | Still unverified | — | JCI/JC sites blocked automated access |
| ISO/IEC 27701 stand-alone 2025 edition | Still unverified | — | iso.org blocked automated access |
| EU–US DPF *Latombe* appeal pending; NPRM patch timelines (15/30 days); Synnovis £32.7M cost; McGlave mortality estimate | Still unverified | — | Not re-checked this pass; keep [U]/[R] tags |
