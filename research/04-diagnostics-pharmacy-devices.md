# Track 04: Diagnostics, Ancillary Services, Pharmacy & Medical Device Integration

*Research brief for the HMS design team. Prepared 2026-10-16. Scope: LIS (clinical pathology, microbiology, anatomic/digital pathology, molecular), blood bank/transfusion, radiology and imaging (plus cardiology, endoscopy, ultrasound), pharmacy, medical device integration (MDI), POCT, CSSD, dietary, rehab, dialysis, respiratory therapy, and build/buy/integrate strategy.*

**Method and evidence legend.** About 33 targeted web searches plus about 25 direct fetches of primary sources: IHE technical frameworks and publication indexes, CLSI, FDA (CDRH/CBER), CMS, The Joint Commission (2026 National Performance Goals manual, text extracted from the PDF), ICCBBA, ISMP (2026–2027 Targeted Medication Safety Best Practices, text extracted), SHOT, NHSBSA, CAP, vendor documentation, and peer-reviewed literature. The session's shared web-search quota ran out before every planned query was done. The gaps were TAT/rejection benchmarks, CLSI M39/M100 editions, WHONET specifics, and FHIR Genomics status. A few well-established facts therefore come from analyst domain knowledge and are marked **[K]**: verify these before contractual or regulatory use. Figures marked **(est.)** are analyst estimates or typical industry targets, not sourced benchmarks. Bracketed numbers [n] refer to the Sources list at the end. **A second verification pass (2026-10-16)** re-checked about 30 time-sensitive claims against primary sources. It corrected several: DSCSA small-dispenser dates, the FDA cybersecurity guidance version, the Data Innovations support dates, the Sectra award count and the ExRad status. It also upgraded several [K] items to sourced, and added sources [96]–[108]. See the verification log at the end.

---

## 0. Executive summary

1. **Instrument connectivity has a modern standard. Build on it natively.** The IHE Laboratory Analytical Workflow (LAW) profile (HL7 v2.5.1, LOINC/UCUM/SNOMED CT, query mode mandatory and broadcast optional) is now codified as **CLSI AUTO16, 2nd edition (published 3 June 2026, listed as free; replaces AUTO16 Ed1 of 2019)**. CLSI positions it as the next-generation alternative to the legacy ASTM-derived LIS01/LIS02 interfaces, adding capabilities they lack. CLSI does not formally withdraw LIS01/LIS02 [2][3][4][5]. Our LIS analyzer layer should be LAW-native, with legacy ASTM handled through middleware.
2. **ISO 15189:2022 is now the only valid edition.** The ILAC transition closed on 6 Dec 2025, three years after publication. Some accreditation bodies, such as IAS, set 31 Dec 2025 [11][12][104]. The 2022 edition is risk-based and **absorbs POCT requirements (ISO 22870 withdrawn)** [11][12]. LIS and POCT features must support risk registers, document control and POC oversight.
3. **The Joint Commission replaced hospital NPSGs with National Performance Goals (NPGs) on 1 Jan 2026.** Several map directly to product features [15][16]:
   - Critical results: **NPG.01.02.01**
   - Alarm safety: **NPG.01.05.01**
   - Two identifiers, and labeling specimens in the patient's presence: **NPG.01.01.01**
   - Imaging safety: **Goal 13**, which covers CT protocols with expected dose-index ranges, review of dose exceedances, and MRI incident data
   - ADC override-review policy: **NPG.14.01.01**
   - Antibiotic stewardship: **NPG.14.06.01**
4. **CAP critical-result documentation is exact.** Records must show the date, time, responsible lab individual, a *traceable* recipient ("first name alone is inadequate"; "RN notified" fails) and the result. Phone notification requires read-back. Electronic delivery is allowed if receipt is confirmed [13][14]. Build **one closed-loop critical-result service** shared by lab, radiology and POCT.
5. **Regulatory boundary: most LIS functions are not FDA devices, but blood bank software is.** **Blood establishment computer software (BECS) is a Class II 510(k) device** (product code MMH, CBER "BK" numbers), and new clearances continued through 2025–2026 [28][29][30][32]. FDA's LDT rule was vacated on 31 Mar 2025, and FDA reverted the regulation text on 19 Sep 2025 [27]. **In the US, integrate a cleared BECS. Do not build one.**
6. **Electronic bedside identification measurably cuts transfusion errors.** In SHOT data, near-miss wrong-component events at sample collection were 452 per 1.57M units with manual processes versus 17 per 376k with electronic systems (crude OR 0.16) [38]. Wrong blood in tube (WBIT) is still the largest near-miss category: 899/1,408 (63.8%) of 2024 near misses [37].
7. **Imaging is converging on DICOMweb plus IHE.** The relevant profiles are SWF.b (departmental workflow), **IID (Final Text Aug 2025) for launching images from the EHR**, WIA (web image access), MADO (manifest-based access), and AIW-I/AIR/AIRA for AI [40][42][44][45]. **PACS remains best-of-breed even at Epic and Oracle sites.** Sectra was Best in KLAS for US PACS for the 13th consecutive year in 2026 [55][56].
8. **Several radiology features are mandated.** Goal 13 requires CT protocols with expected dose ranges and analysis of CTDIvol/DLP/SSDE exceedances against benchmarks [15]. MQSA breast-density reporting has applied since 10 Sep 2024 [54]. The ExRad eCQM is still voluntary: CMS1074 in inpatient IQR and CMS1206 in outpatient OQR. The CY2026 OPPS final rule (Nov 2025) dropped the planned CY2027 mandatory OQR reporting [50][51][101]. The CMS AUC mandate was rescinded effective 1 Jan 2024 [53].
9. **The ISMP 2026–2027 best practices set concrete targets** [64]:
   - Above 95% dose-error-reduction-system (DERS) compliance, monitored monthly
   - Bidirectional smart-pump–EHR interoperability (autoprogramming and autodocumentation)
   - Barcode scanning beyond inpatient units: ED, perioperative, infusion, dialysis, radiology, L&D, cath lab
   - IV workflow management systems for sterile compounding
   - Metric-only weights
   - Limited ADC override lists
10. **Smart-pump interoperability works, but adoption is the bottleneck.** A 2025 systematic review found 15.4–54.8% reductions in specific administration errors [75]. A 2026 academic study saw **autoprogramming used for only 53.4%** of infusions [77].
11. **Gravimetric IV workflow systems catch errors that visual checks miss.** One oncology study found 7% of doses had an intercepted error, 71% of them caught by the weighing step. A vendor reports 4.2% [69][71]. Adoption is rising but uneven. Only 21.3% of US hospitals used sterile workflow management technology in 2020 [68]. By 2023, ASHP reported that nearly two-thirds used some technology to verify sterile preparation (e.g., barcode or image capture), up from 36% six years earlier. That broader metric is not directly comparable to the 2020 one [66].
12. **E-prescribing deadlines.** US Part D e-prescribing **cuts over to NCPDP SCRIPT 2023011 on 1 Jan 2028**, and F&B v60 / RTPB v13 are required by 2027 [58][59][60]. England's dm+d (SCCI0052) refreshes weekly [61]. The drug-product layer must be pluggable by region.
13. **Device integration standards.** In production, the standard is **IHE Devices (DEV, formerly PCD) TF Rev 10.0 (Nov 2024)**: DEC, ACM, PIV, IPEC and RTM [80][81]. **ISO/IEEE 11073 SDC (10700/10701:2024) plus IHE SDPi (revised May 2026)** is the emerging plug-and-play layer, but it is not yet a procurement baseline [80][82][83].
14. **Device cybersecurity is statutory.** FD&C §524B requires an SBOM, vulnerability monitoring and coordinated disclosure. FDA's final premarket guidance was reissued on 27 Jun 2025. It was reissued again in **February 2026** under a QMSR-aligned title, "Cybersecurity in Medical Devices: *Quality Management System* Considerations and Content of Premarket Submissions", which supersedes the June 2025 version [86][99]. ECRI's 2026 hazards include **legacy-device cyber risk (#8)** and **designs that prompt unsafe workflows (#9)** [87].
15. **Recommended posture.**
   - **Build** the diagnostic order-lifecycle core: LIS (clinical pathology, microbiology, AP workflow), RIS, pharmacy verification/eMAR/BCMA/inventory, POCT result filing, dietary and therapies. Put it on shared services: identity/barcode, a versioned rules engine, closed-loop notification, a device gateway and a terminology service.
   - **Integrate**: PACS/VNA/viewers, instrument middleware, BECS (US), drug knowledge bases, ADCs/robotics/IV workflow systems, pump and monitor middleware, voice recognition and AI.
   - *(Reconciled 2026-10-16 with `03`, `07` and `01`:*
     - *MVP: the clinical-pathology LIS core and the RIS are native. Microbiology and the AP workflow are native in P2 and start as interfaces.*
     - *Blood bank: v1 in **all markets** ships bedside transfusion verification inside BCMA plus an HL7 interface to an external blood-bank system. A native ISBT 128 blood bank follows later, non-US only, in the regulated-modules track once the ISO 13485 / IEC 62304 QMS exists.*
     - *Pump interoperability is P2 unless a design partner requires it. See §8.2 and §11.)*

---

## 1. Cross-cutting architecture for ancillaries

Every ancillary domain runs the same skeleton: **order → identify (patient + specimen/unit/exam/dose) → perform → result/document → verify → notify/acknowledge → bill → analyze**. Top-tier EHRs differentiate less on any single module than on how tightly this loop closes inside one patient record. Five shared platform services should be designed once and reused by every ancillary module:

- **Identity and barcode service.**
  - Patient wristbands (2D barcode/RFID carrying at least two person-specific identifiers, as NPG.01.01.01 explicitly allows) [15]
  - Specimen labels (IHE PaLM LBL) [1]
  - ISBT 128 for blood and other medical products of human origin [33]
  - GS1 GTIN/lot/expiry/serial for medications (DSCSA) and UDI for devices and instrument trays [K]
  - Every scan is an immutable event with user, device, location and time.
- **Rules engine.** One versioned, declarative, test-harnessed engine for autoverification, reflex testing, delta checks, critical values, protocol defaults, pharmacy screening overrides, ADC override policy and alarm escalation. Each rule set needs medical-director or committee sign-off and replay against historical data before activation. Incumbents scatter these across LIS, middleware and EHR. Unifying them is a real differentiator.
- **Closed-loop notification.** Critical labs, critical and actionable imaging findings, critical POCT results and pharmacy interventions all need policy-driven routing, escalation, read-back or acknowledgement capture, and audit, as required by CAP and NPG.01.02.01 [13][15][49].
- **Worklist and task engine.** This covers phlebotomy collection lists, accession queues, bench worklists, AP case and slide queues, radiology reading worklists with AI prioritization, pharmacist verification queues, IV-room queues, tray lines and therapy schedules. All are the same primitive with domain-specific views.
- **Device and instrument gateway.** One ingestion tier handles HL7 v2 (LAW, DEC, IPEC), ASTM (via middleware), DICOM, POCT01 and, later, SDC. It provides store-and-forward buffering, clock synchronization and device-to-patient association.

Timestamp every step as a first-class event: order, collect, dispatch, receive, accession, start, result, verify, notify, acknowledge. All TAT KPIs in §10 then come out of the box rather than through report-writing projects.

---

## 2. Laboratory Information System (LIS)

### 2.1 Market context

The LIS market is consolidating:

- **Clinisys** (Sunquest, CoPathPlus, WinPath, GLIMS) acquired **Orchard Software from Francisco Partners in July 2025** [90]. Clinisys claims "~24% global market share", citing Signify Research, *Laboratory Information Systems – World, 2025*. The claim is on Clinisys's history page [96]. Its June 2026 market-leadership release [90] cites Black Book 2025 rankings instead. No independent source for the 24% was found, so treat it as a vendor claim.
- **Epic Beaker** (clinical and anatomic pathology) and **Oracle Health PathNet** dominate hospitals that standardize on one EHR [K].
- **SCC Soft Computer** remains a significant independent player, including donor and transfusion products cleared as BECS [31].

CAP TODAY notes that niche modules (outreach, molecular, digital pathology, microbiology) thrive even under EHR consolidation [91]. The practical lesson: integrated EHR labs win the common path, while specialty sections keep best-of-breed satellites.

### 2.2 Clinical pathology workflow, step by step

1. **Order entry (CPOE).**
   - The test catalog maps each orderable to its specimen requirements, container, minimum volume, stability, collection priority (STAT/ASAP/timed/routine) and LOINC order code [K].
   - Ask-at-order-entry questions (e.g., fasting, dose time for drug levels).
   - Duplicate-order and test-utilization checks.
   - US outpatient medical-necessity checks (NCD/LCD, ABN generation) [K].
   - Orders flow to the LIS as HL7 v2 OML/ORM, or natively in an integrated build (IHE PaLM LTW) [1].
2. **Collection lists and positive patient ID.**
   - Lists are generated by unit, collector and time window, with tubes consolidated across orders.
   - At the bedside, a handheld scans the wristband and prints labels on demand. The record captures collector ID, collection timestamp and device.
   - NPG.01.01.01 requires labeling specimen containers in the patient's presence [15].
   - SHOT's 2023 WBIT chapter stresses that patient ID, sampling and labeling should be one continuous process at the bedside [93].
   - Labels follow tube-type and draw-order rules. IHE LBL standardizes label requests from the LIS to a label broker [1].
3. **Transport.** Pneumatic tube, porter or courier, with tracking events (IHE PaLM SET, Specimen Event Tracking) [1]. Send-outs need temperature-monitored transport and manifests.
4. **Receipt and acceptability.**
   - Specimens are scanned in, generating a receipt timestamp.
   - Acceptability checks cover hemolysis, clotting, insufficient quantity, wrong container, expired stability, and unlabeled or mislabeled specimens.
   - Rejection uses coded reasons and auto-generates a recollection task with notification to the care team [K].
5. **Accessioning and routing.**
   - Accession number, aliquot generation and routing to the total lab automation (TLA) line or bench worklists.
   - Sample storage location tracking, which enables add-ons and audits [K].
6. **Analysis via instrument interface (§2.3).** Host query or download of work orders, then results return with instrument flags, QC status, dilution and rerun information.
7. **Technical review and autoverification (§2.4).** Results that pass every rule auto-release. Exceptions route to a review queue with the reason highlighted.
8. **Delta checks and critical values (§2.5).** Critical values trigger the closed-loop notification workflow.
9. **Reporting.**
   - Final, preliminary and corrected statuses, with a corrected-report trail.
   - Age-, sex-, pregnancy- and method-specific reference intervals.
   - Interpretive comments.
   - Performing-lab identification (CLIA requires the performing lab's name and address on the report) [K].
   - Results go to the EHR as ORU/OUL or natively, with LOINC and UCUM [K].
10. **Add-on tests.** The system checks specimen stability and residual volume, locates the stored tube, and links the add-on to the original accession.
11. **Reflex testing.** Rules pre-approved by the medical director, e.g., TSH → free T4, or positive screen → confirmatory test. Billing logic and patient-facing transparency must be explicit [K].
12. **Send-outs and reference labs.**
   - Order manifests, packaging and tracking.
   - HL7 v2.5.1 LOI/LRI-style interfaces and an eDOS compendium import from Quest/Labcorp/Mayo/ARUP-type labs [K].
   - Result import that preserves the performing lab, units and reference ranges.
   - Inter-laboratory workflow is profiled in IHE PaLM ILW [1].

### 2.3 Instrument interfacing and middleware

**The stack.** Instruments, or the TLA line, connect to middleware such as Data Innovations Instrument Manager, Roche, Abbott or Beckman middleware. Middleware connects to the LIS.

**Legacy protocols.** Many installed analyzers still speak the ASTM E1381 low-level protocol with E1394 message content, later re-issued as CLSI LIS01-A2 and LIS02-A2, over RS-232 or TCP [K].

**IHE LAW / CLSI AUTO16.** These define order and result exchange for patient and QC specimens between an Analyzer Manager (LIS, middleware or LAS) and the Analyzer:

- Each Analytical Work Order Step (AWOS) gets a unique ID that the analyzer must echo back.
- HL7 enhanced acknowledgements are used (MSH-15 = NE, MSH-16 = AL).
- **Query mode is mandatory; broadcast mode is optional** [2][5].
- AUTO16 adds enhanced order management, richer result identification, HL7 v2.5.1, and LOINC/JLAC10/UCUM/SNOMED CT support. It aligns with the SHIELD semantic-interoperability initiative [4].
- AUTO16 Ed2 explicitly covers all lab specialties including blood bank. It excludes POC exchange, imaging, calibration and configuration data, and nomenclature mapping [3].

**Middleware value.**

- Data Innovations lists more than 1,200 instrument drivers, multi-site and multi-LIS scaling, rules-based autoverification, delta checks, moving-average (patient-based) QC, a specimen management workspace and KPI dashboards [8][9].
- The vendor claims "up to 95%" autoverification. This is a vendor claim with no independent benchmark [9].
- Lifecycle note: as of Oct 2026 the vendor page states that **support for IM versions 08.17.32 and older ends on 1 Jan 2027**, and it promotes v9.01.00 [8]. (An earlier draft said that v8.14 reached end of life on 1 Jan 2026. The current page does not show that.) Middleware is itself an upgrade burden.

**Mapping.** Use the IICC LIVD format (LOINC-to-IVD vendor test code mapping) to seed analyzer-to-LOINC mapping, rather than hand-mapping every assay [K].

### 2.4 Autoverification design

CLSI's original guideline was **AUTO10-A (2006)**, which FDA still lists among its recognized standards. **AUTO15 (2019)** gives discipline-specific guidance [6] [K]. National bodies have issued implementation recommendations, for example the Croatian Society of Medical Biochemistry [7], and single-center design and validation reports are common [10][92].

A best-practice rule stack, evaluated in order:

1. Instrument error and flag codes, then QC status (block release if the most recent QC failed)
2. Specimen integrity: hemolysis, icterus and lipemia (HIL) indices against analyte-specific thresholds
3. Analytical measurement range and dilution logic
4. Absurd, physiologically implausible limits
5. Critical-value check, which routes to manual review plus notification
6. Delta check (absolute or percent change within a time window, analyte-specific)
7. Cross-analyte consistency, e.g., anion gap, or K+ elevated with hemolysis
8. Patient context, e.g., dialysis, neonatal, or post-transfusion
9. Release

Each rule needs a documented rationale, validation evidence (simulated and historical cases), version control, and periodic revalidation after instrument or method changes.

**Published autoverification rates.** These vary widely by discipline and rule stringency. A majority of routine chemistry results autoverified, often 60–90% or more, is a reasonable design target **(est.)**. Hematology differentials, urinalysis microscopy and microbiology run lower.

### 2.5 Delta checks, critical values and closed-loop notification

**CAP requirements** [13][14]:

- Written critical-value procedures.
- Notification records with date, time, responsible lab individual, person notified (identified traceably) and result.
- **Read-back** when the result is phoned.
- Electronic transmission is acceptable if receipt by the intended recipient is confirmed.
- Clinician "opt-outs" are strongly discouraged.
- If the person testing is also the person treating the patient, recording both identities is unnecessary, but the result, date and time must be in the record.

**Joint Commission NPG.01.02.01** requires written procedures that define critical results, by whom and to whom they are reported, the acceptable time from availability to reporting, and evaluation of timeliness [15].

**Scale.** At Ohio State, 2023 POC glucose testing alone produced **879,721 results and 9,355 criticals across 741 devices and more than 7,000 operators**. Documentation compliance reached 100% only after a structured EHR flowsheet with a named-recipient picker replaced free text [14]. The lesson: never let the recipient be free text.

**Design.**

- Policy tables define, per test, analyte, location and age, the threshold, the target notification time and the escalation chain (ordering provider → covering provider → charge nurse → rapid response).
- Channels: secure chat, phone with read-back capture, or EHR inbox, with acknowledgement.
- Unacknowledged items auto-escalate.
- A dashboard tracks performance against the policy target.
- Typical targets are notification within 15–30 minutes of verification **(est.)**.

### 2.6 Quality control

- **Westgard multirules** [K]:
  - 1-2s as a warning
  - 1-3s, 2-2s, R-4s, 4-1s and 10-x as rejection rules
  - Sigma-metric-based rule selection
- Levey-Jennings charts.
- Peer comparison programs.
- **QC lockout**: results are blocked from auto-release when QC is failed or overdue.
- Patient-based real-time QC (moving averages) [9].
- **CLIA minimum**: two levels of control per 24 hours for most quantitative tests, unless an Individualized Quality Control Plan (IQCP) is used [K].
- Proficiency testing enrollment and tracking.
- **Measurement uncertainty** evaluation, which ISO 15189:2022 requires [K].
- Reagent and calibrator lot tracking linked to every result, so look-back is possible.

### 2.7 Terminology and reporting standards

- **LOINC** for orders and observations; **UCUM** for units; **SNOMED CT** for specimen type, body site, organism and qualitative findings [4] [K].
- US interfaces use HL7 v2.5.1 profiles: LRI (results), LOI (orders), eDOS (compendium) and ELR (public-health reporting) [K].
- The FHIR R4 resources are ServiceRequest, Specimen, Observation and DiagnosticReport.
- IHE XD-LAB covers shareable lab reports [1].
- Regional code systems include JLAC10 (Japan) [4] and NPU (Nordics) [K].

### 2.8 Microbiology

**Workflow** [K]:

1. Specimen receipt (source and site)
2. Plating, often on automation (BD Kiestra, Copan WASP/WASPLab) with digital plate imaging
3. Gram stain, reported as a preliminary result
4. Daily culture reads with workup notes
5. Organism identification, increasingly by MALDI-TOF
6. Susceptibility testing (MIC/disk) interpreted against **CLSI M100 or EUCAST** breakpoint tables, both updated annually
7. Expert rules (intrinsic resistance, confirmatory tests)
8. **Cascade or selective reporting** to support stewardship
9. Preliminary and final reports, often several per specimen
10. Infection-control alerts (MRSA, VRE, CRE, *C. auris*)
11. Notifiable-disease ELR

**Data model.** This is the key design decision. Microbiology results are hierarchical (specimen → isolate(s) → antimicrobial panel per isolate → interpretation, with comments at each level). They cannot be flattened into chemistry-style observations.

**Antibiograms.** Cumulative antibiograms follow **CLSI M39** (first isolate per patient per period; at least 30 isolates per organism) [K]. Export to **WHONET**, WHO's free surveillance software, for national and GLASS surveillance [K].

**US reporting.** NHSN AUR (Antimicrobial Use and Resistance) reporting is a Medicare Promoting Interoperability requirement for eligible hospitals and CAHs. It has applied since the CY2024 EHR reporting period, and from 2025 it is split into separate AU and AR Surveillance measures [100]. The AR Option draws on LIS data and the AU Option on eMAR/BCMA data, using SAAR benchmarking [88]. The LIS and pharmacy modules therefore have to feed one stewardship dataset.

### 2.9 Anatomic pathology and digital pathology

**AP workflow** [K]:

1. Accession by case → part (specimen) → block → slide
2. Gross description, often with photographs and dictation
3. Cassette printing and tracking
4. Processing, embedding and microtomy
5. Staining (H&E, special stains, IHC), with barcode-driven slide labeling at the microtome
6. Case assembly
7. Pathologist review and sign-out
8. Synoptic cancer reporting
9. Addenda and amendments
10. Intradepartmental and external consults

Frozen sections need an intraoperative TAT clock (≤20 minutes is the common target) [K]. Specimen-tracking scans at each station are the main defense against mix-ups.

**Synoptic reporting.**

- **CAP requires the required data elements of applicable cancer protocols, in synoptic format, for accreditation** [19][20].
- CAP's electronic protocols (eCC, being rebranded "eCP") are distributed as **Structured Data Capture (SDC) XML**, rendered by AP-LIS vendors as data-entry forms, and updated in rolling releases [18][20].
- Cancer-registry reporting expects HL7 2.5.1 with SPM segments and CAP eCC content [21].
- Internationally, ICCR datasets and national datasets (e.g., RCPath) play the same role [K].
- IHE APSR covers structured AP reports [1].

**Digital pathology (whole-slide imaging, WSI).**

- **DICOM Supplement 145** defines the WSI IOD as a tiled, multi-resolution pyramid [22].
- **IHE PaLM DPIA** (Digital Pathology Image Acquisition) was revised 2026-03-06. It defines how an acquisition manager instructs scanners about physical slides [1][23].
- A joint DICOM WG-26 / IHE PaLM connectathon drew more than 30 vendors. Slides from nearly all major scanners were analyzed by different vendors' AI and shown in one viewer [24].
- An NCI workshop recommends DICOM as the interoperability foundation and HL7/FHIR integration with the LIS and EHR [25].
- Leica's Aperio GT 450 DX offers DICOM output in an FDA-cleared WSI system [26].
- Design implications:
  - Slide barcodes should carry the accession, part, block and slide hierarchy.
  - The LIS should drive scanning worklists and own case-to-image linkage.
  - Images should go to a DICOM-capable archive, which can be the enterprise VNA.
  - WSI files are large (roughly 0.5–3 GB per slide compressed **(est.)**), so model storage tiering early.

### 2.10 Molecular and genomics

**Workflow** [K]:

1. Test order with clinical indication and consent
2. Nucleic acid extraction and QC
3. Library preparation and sequencing (batch and run tracking)
4. Bioinformatics pipeline (FASTQ → BAM → VCF), with versioned pipelines
5. Variant classification (ACMG/AMP 2015 germline; AMP/ASCO/CAP 2017 somatic tiers)
6. Interpretive report, with reanalysis and reclassification over time
7. Pharmacogenomic results feeding CDS (CPIC guidelines)

Standards include the HL7 v2 genetics IGs, the HL7 FHIR Genomics Reporting IG and GA4GH specifications [K].

**Regulation.** Because the LDT rule is vacated, laboratory-developed NGS assays in the US remain under CLIA/CAP oversight rather than FDA premarket review [27].

**Recommendation.** Integrate a specialized molecular LIMS and bioinformatics platform. Build structured result display, FHIR genomics storage and PGx CDS in the core.

### 2.11 Accreditation and regulation

- **CLIA (US, 42 CFR 493)** sets test-request, report-content, QC, PT, personnel and record-retention rules [K]:
  - Test records: 2 years
  - Pathology reports: 10 years
  - Immunohematology: 5 years
  - CAP accreditation is deemed status for CLIA, with biennial inspection.
- **ISO 15189:2022** [11][12]:
  - Since 6 Dec 2025 it is the only accreditable edition.
  - It integrates POCT and is aligned with ISO/IEC 17025.
  - Risk-based thinking replaces preventive action.
  - It strengthens document creation, amendment and record retention.
  - Information-system clauses require LIS validation, access control, and downtime and off-site management [K].
  - **India's NABL** accredits medical labs to ISO 15189 [K].
- **Joint Commission.**
  - The hospital program uses **NPGs** from 2026 [15][16].
  - The laboratory program still lists NPSGs, including NPSG.02.03.01 for critical results [17].
  - Waived testing falls under NPG.10.01.01 and NPG.10.02.01: training per test, and competency assessed at orientation and annually using at least two methods per person per test [15].
- **FDA status.**
  - LIS functions limited to transferring, storing, converting or displaying lab data are excluded from the device definition by the 21st Century Cures Act (FD&C 520(o)) [K].
  - **BECS is Class II, 510(k), product code MMH, 21 CFR 864.9165, reviewed by CBER** (2018 final rule; FDA declined to exempt it) [32][103].
  - The **LDT final rule was vacated on 31 Mar 2025 and reverted on 19 Sep 2025** [27].
  - Implication: a general LIS can be built under a strong QMS without 510(k). Blood bank functions cannot.

### 2.12 Best-in-class LIS features (target list)

- Bedside specimen collection with mobile PPID and on-demand labels
- Specimen tracking with a location map
- Smart collection-list consolidation
- A rules engine with simulation and replay (autoverification, reflex, delta, critical)
- LAW/AUTO16-native analyzer interfaces with LIVD mapping
- QC with Westgard multirules, Sigma metrics and patient-based QC
- A microbiology hierarchical result model with cascade reporting and WHONET export
- AP case, block and slide tracking with SDC synoptic forms and digital pathology worklists
- Outreach and client portal, billing and send-out management
- Real-time TAT and KPI dashboards
- Utilization management (duplicate-test alerts, test-of-the-month CDS)
- Patient-facing results release that complies with information-blocking rules [K]

---

## 3. Blood bank and transfusion medicine

### 3.1 Workflows

**Donor center (blood establishment)** [K]:

1. Donor registration and deferral-registry check
2. Health history questionnaire and eligibility (FDA's individual risk-based assessment framework applies in the US)
3. Collection (whole blood or apheresis)
4. Component manufacturing (red cells, plasma, platelets; pathogen reduction; irradiation; leukoreduction)
5. Testing (ABO/Rh, antibody screen, infectious-disease serology and NAT)
6. **Quarantine and release logic.** This is the core BECS safety function: untested or reactive units can never be labeled or released.
7. ISBT 128 labeling
8. Inventory and distribution
9. Lookback and recipient notification

FDA cleared new donor-side BECS in 2025–2026 [29][30]:

- BioLife Plasma Services' Donor Information System v9.0 (BK251307, 11 Aug 2026)
- Buoy Software's Blood Product Questionnaire Module v2.0.0 (BK261333, 8 Jun 2026)
- BioLife's Lookback Notification System v2.0 (BK241136, 20 Feb 2025)

The Buoy clearance shows that even donor-questionnaire software is regulated as BECS.

**Hospital transfusion service** [K]:

1. Type and screen. ABO/Rh needs two concordant determinations: a historical type, or a second independent sample (the WBIT safeguard).
2. Antibody identification, antigen typing and antigen-negative unit selection.
3. Special requirements flags (irradiated, CMV-safe, washed, HLA-matched), driven by patient attributes such as stem-cell transplant or IgA deficiency.
4. Crossmatch: immediate-spin, AHG, or **electronic**.
5. Issue with a unit-to-patient check.
6. Remote-issue refrigerators.
7. Massive transfusion protocol (MTP) and emergency release, with retrospective crossmatch.
8. Returns, with temperature and time rules.
9. Final disposition, for vein-to-vein traceability.
10. Transfusion reaction workup.
11. Haemovigilance reporting.
12. Inventory: days of supply, outdates, wastage.
13. Patient blood management (PBM) dashboards (restrictive thresholds, single-unit orders).

### 3.2 Electronic (computer) crossmatch

The classic requirements, carried into AABB standards [35][36]:

1. The computer contains logic that prevents assigning or releasing ABO-incompatible blood.
2. No clinically significant antibodies are detected now, and there is no history of them.
3. **At least two concordant ABO determinations are on record, one from the current sample.**
4. Critical elements have been validated on site.
5. There are mechanisms to verify data entry, unit labels and confirmatory typing, with alerts for discrepancies.

The system must hold the donor unit number, component name, confirmed ABO/D, two unique recipient identifiers, recipient ABO/D, antibody screen and compatibility interpretation [36].

FDA's guidance on computer crossmatch describes practices that satisfy 21 CFR 606.151(c) [36].

Electronic issue also enables **electronic remote issue** from satellite refrigerators. The Oxford model uses it to serve multiple sites [38].

### 3.3 ISBT 128

ISBT 128 is the global coding standard for medical products of human origin (blood, cells, tissues, milk, organs). It is maintained by ICCBBA. The current Technical Specification is still **ST-001 v6.2.2** (April 2023, per the title page; checked Oct 2026). Standalone reference tables RT019 and RT038 supersede the copies embedded in it [33][108]. The **US Industry Consensus Standard IG-002 v4.0.0** is dated January 2024. CBER's April 2024 guidance announced its acceptance and immediate implementation for blood component labeling [34].

Data structures include the Donation Identification Number (DIN: facility code + year + sequence + flags/check), product code, ABO/Rh, expiration date and time, and special testing [K]. Data identifiers begin with "=" or "&" [33]. Facilities need ICCBBA registration with an annual license fee, plus a facility ID. The fee requirement is stated in the ST-001 copyright notice [108].

**Build implication.** A shared ISBT 128 parser and validator, including concatenation and check-character logic, is used by the blood bank, bedside verification, and tissue/implant tracking in the OR.

### 3.4 Bedside transfusion verification and haemovigilance

NPG.01.01.01 requires two identifiers and explicitly accepts barcode or RFID carrying two or more identifiers [15].

**SHOT evidence.**

- In a 93-hospital study (93 of 222 UK hospitals responded, about 38% of UK issues in 2015–2016) covering about 2 million components, electronic identification systems (EIS) were associated with fewer wrong components transfused. No wrong components were transfused when EIS was used at blood draw or administration [38][107]. The sharpest effect was in **near-miss sample-collection errors: 452 per 1,570,063 units (manual) versus 17 per 376,323 (electronic), crude OR 0.16** [38].
- Caveats: wrong-component events are rare, and the study was underpowered for them [38].
- Failure modes include omitted patient-ID steps and over-reliance on scanning [38].
- Oxford's end-to-end electronic process cut pre-transfusion steps from 27 to 16 and from two nurses to one [38].

**SHOT 2024** [37][95][105][106]:

- Errors made up 3,322 of 3,998 reports (83.1%). The share has been unchanged for three years.
- WBIT accounted for 899 of 1,408 near misses (63.8%). Most WBIT (84.2%) were caught at lab testing or result authorisation, so the second-sample/historical-group check matters.
- There was one ABO-incompatible red-cell transfusion and three ABO-incompatible plasma transfusions. All three plasma cases were lab component-selection errors. Another 203 *potential* ABO-incompatible red-cell transfusions were intercepted.

Bedside electronic systems are now recommended as best practice, although implementation guidance is thin [39].

**IHE PaLM TMA** (Transfusion Medicine – Administration, Trial Implementation) profiles bedside administration messaging [1].

**Haemovigilance reporting** goes to SHOT (UK), the NHSN Hemovigilance Module (US) and national systems elsewhere. FDA requires transfusion-fatality reporting [K].

### 3.5 Regulatory

- **US.** BECS and BECS accessories are Class II under special controls, and a 510(k) is required [32].
  - CBER keeps yearly clearance lists.
  - 2025 clearances include:
    - **Haemonetics SafeTrace Tx 5.0.0** (BK251241, 10 Sep 2025)
    - **Immucor ImmuLINK v3.3** (BK251256, 24 Oct 2025)
    - **MAK-SYSTEM Patient Health Software (PHS) v11.0.0.0** (BK251188, 11 Jun 2025) [29]
  - 2021 clearances include **SCC SoftDonor 4.5.5.0** and **Sunquest Transfusion Manager 3.0** [31].
  - FDA had cleared 220 BECS/accessory 510(k)s between 1996 and 2015 [28] (from the CBER/regulations.gov summary).
  - Record retention for blood establishments is long: at least 10 years under 21 CFR 606.160 [K].
- **EU.** The SoHO Regulation (EU) 2024/1938 entered into force on 7 Aug 2024 and applies from **7 Aug 2027**. On that date it repeals the blood directive 2002/98/EC and the tissues-and-cells directive 2004/23/EC [98]. Implementing Regulation (EU) 2025/1467, which sets the EU SoHO Platform specifications, applies on the same date [98]. Plan for its traceability and vigilance data requirements.
- **India.** Blood centres are licensed under the Drugs and Cosmetics Rules, and the national e-RaktKosh platform aggregates inventory [K].

**Build versus integrate.** In the US, integrate a cleared transfusion system such as SafeTrace Tx, SCC SoftBank or Clinisys/Sunquest. Then build the order, bedside administration and documentation layers around it, with a regulatory review of whether our bedside verification counts as a BECS accessory. Outside the US, a native module is viable if it is developed under design controls (IEC 62304-style lifecycle, ISO 13485-aligned QMS) so a later 510(k) remains possible.

---

## 4. Radiology and imaging

### 4.1 RIS workflow, step by step

1. **Order.**
   - CPOE with reason for exam and structured indication.
   - Appropriateness CDS is optional: the CMS AUC program was **paused and its regulations rescinded effective 1 Jan 2024** [53].
   - Duplicate-imaging and prior-study checks.
2. **Protocoling.** A radiologist or technologist selects the protocol, contrast and sedation. CT protocols must address indication, contrast, age, size and an **expected dose-index range**, and be reviewed by the interpreting physician, medical physicist and lead technologist (NPG.13.02.01) [15].
3. **Scheduling.** Modality, room and resource; prep instructions; patient reminders; prior-authorization tracking (US) [K].
4. **Screening and check-in.**
   - MRI safety screening: implants, devices and foreign bodies, ferromagnetic objects, claustrophobia, acoustic noise (NPG.13.03.01) [15].
   - Contrast allergy and renal function.
   - Pregnancy status.
5. **Modality Worklist (DICOM MWL)** feeds demographics, accession number and requested procedure, avoiding manual entry. The RIS assigns the Study Instance UID (SWF.b) [42][43].
6. **Exam performance.**
   - MPPS (in progress, completed, discontinued) drives exam status, technologist documentation, contrast and radiopharmaceutical documentation (dose, lot), and charge capture.
   - Storage commitment confirms archive receipt [43].
7. **Image QA and reconciliation.** Patient Information Reconciliation (PIR, folded into SWF.b) fixes trauma and unidentified-patient studies [43].
8. **Reading worklist.**
   - Prioritized by urgency, AI triage flags, subspecialty and service-level timers.
   - Prior studies are auto-fetched.
   - IHE IRA synchronizes context across PACS, reporting and EHR, using FHIRcast [42][48].
9. **Reporting.** Structured templates, voice recognition and auto-population of measurements and dose (§4.5).
10. **Sign, distribute and communicate.** Critical and actionable findings go to closed-loop notification (§4.6).
11. **Addenda, peer learning, follow-up tracking and billing** (technical and professional components).

### 4.2 PACS, VNA, enterprise imaging and DICOMweb

**DICOMweb (PS3.18)** [40][41]:

| Service | Purpose | Classic DIMSE equivalent |
|---|---|---|
| QIDO-RS | Query | C-FIND |
| WADO-RS | Retrieve instances, metadata, bulk data and rendered images | C-GET |
| STOW-RS | Store | C-STORE |
| UPS-RS | Worklist (create, claim, complete workitems) | Unified Procedure Step |

Capabilities discovery is part of PS3.18 [40][41].

**Architecture choice for our HMS.**

- The RIS and EHR talk to any PACS or VNA through **HL7 v2/FHIR plus DICOM MWL/MPPS plus DICOMweb plus IID**.
- Enterprise imaging consolidates radiology, cardiology, endoscopy, dermatology photos, POCUS and pathology WSI into a VNA with a universal viewer.
- Hyperscaler DICOMweb stores, such as AWS HealthImaging, the Google Cloud Healthcare API and Azure Health Data Services DICOM, make cloud-native archives practical [K].
- PACS vendors increasingly run on hyperscalers. Sectra and Medicai both run on Azure [56] (via Medicai's comparison).

**Market.**

- **Sectra** won seven 2026 Best in KLAS awards for Sectra PACS (press release, 4 Feb 2026) [55]:
  - US PACS, its 13th consecutive year
  - Canada PACS, its 7th consecutive year
  - Five Global PACS regions: Northern Europe, Southern Europe, DACH, Middle East/Africa and Oceania
- **Agfa, Infinitt, Merge by Merative and Microsoft PowerShare** were also recognized in 2026 [56].
- Epic (Radiant) and Oracle (RadNet) provide the RIS. **Neither positions a native diagnostic PACS as its primary offering, so leading health systems pair EHR RIS with best-of-breed PACS** [K].

### 4.3 Image access across the enterprise

**IHE RAD TF Rev 23.0 (Aug 2025)** includes [42]:

- **SWF.b**
- **IID** (Invoke Image Display), added Final Text in Aug 2025: a URL-based launch of a viewer from the EHR, RIS or PHR, with no image handling in the invoker [44]
- **REM** (Radiation Exposure Monitoring)
- **XDS-I.b** (cross-enterprise imaging document sharing) [43]
- **WIA** (Web-based Image Access, added 2024)
- **PWF**

**MADO** (Manifest-based Access to DICOM Objects, Trial Implementation; the IHE index lists a revision dated 2026-09-03) lets an IID invoker open remote studies from a manifest's display URL and interoperates with XDS-I.b manifests [42][45].

**EBIW** (Encounter-Based Imaging Workflow, revised June 2025) covers unordered imaging such as POCUS and clinical photos [42].

### 4.4 Structured reporting, voice recognition and generative AI

**Content standards** [K]:

- RadLex lexicon, and the **LOINC/RSNA Radiology Playbook** for procedure codes
- RSNA RadReport template library (IHE MRRT format)
- ACR Reporting & Data Systems: BI-RADS, Lung-RADS, LI-RADS, PI-RADS, TI-RADS, O-RADS
- ACR Common Data Elements
- DICOM SR for measurements (TID 1500) and dose (RDSR)
- FHIR DiagnosticReport and ImagingStudy for EHR consumption

Voice recognition is dominated by Microsoft/Nuance PowerScribe, with generative impression drafting emerging across vendors [K].

**Mammography.** The 2023 MQSA final rule requires a breast-density assessment in the report and in the patient lay summary. FDA states that facilities have been subject to all of its requirements since 10 Sep 2024 [54]. FDA has also approved an alternative standard (#26, Jul 2025) on how the density statement is phrased [54]. Make this a hard-stop template element.

### 4.5 Critical and actionable findings, follow-up and peer learning

The ACR Actionable Reporting Work Group classifies findings by urgency (Category 1 within minutes, Category 2 within hours, Category 3 within days) and calls for IT support to document communication. This is consistent with Joint Commission critical-results requirements [49] [K].

Build:

- **Closed-loop communication**, shared with the lab
- **Incidental-finding follow-up tracking**: recommendation extraction, due dates, patient and PCP letters, and closure reporting. This is the biggest current gap in many RIS products.
- **Peer learning**: non-punitive discrepancy capture, case conferences, and feedback to the radiologist

### 4.6 AI integration

IHE profiles for AI [42][46][47][48]:

| Profile | Status | Role |
|---|---|---|
| **AIW-I** | Trial Implementation, 2020 | The PACS or task requestor creates UPS workitems. An AI orchestrator dispatches them to models over DICOMweb or DIMSE. Supports pull, triggered-pull and push. |
| **AIR** | Rev 1.3, Aug 2025 | Standard encoding and display of AI results. Defines an "AI-Ready" viewer. |
| **AIRA** | June 2025 | Records radiologist acceptance, rejection or modification of AI results. |
| **IRA** | 2023 | Places AI results in the reporting context. |

FDA's AI-enabled device list had decisions through **29 Jun 2026**. Radiology dominates: about 80% of a sampled page of recent entries **(est.)** [57].

**Design.** Our RIS and worklist must consume AI triage flags (prioritization), display AIR results, and record AIRA assessments for governance, drift monitoring and liability. Do not build models. Build the orchestration contract and the governance ledger.

### 4.7 Radiation dose and MR safety

**Dose capture.** Capture **DICOM RDSR** (CT dose SR) via IHE REM. Compute and store CTDIvol, DLP and SSDE per series, and compare against protocol expected ranges.

**NPG.13.04.01** requires the hospital to [15]:

- Review and analyze CT exams whose dose index exceeded expected ranges, compared with external benchmarks such as the ACR Dose Index Registry [K]
- Collect data on MRI thermal injuries and ferromagnetic-object incidents

**CMS1074 ("ExRad")** measures excessive dose or inadequate image quality in CT across 18 CT categories [50]:

- The 2026 version is CMS1074v3, the inpatient IQR measure. The outpatient OQR version is CMS1206v3.
- Each category has a size-adjusted dose threshold and a global-noise threshold. Translation software is needed to compute both.
- It remains voluntary. CMS proposed indefinite voluntary status in the CY2026 OPPS proposed rule (Jul 2025) [51]. The CY2026 OPPS final rule (issued 21 Nov 2025, published 25 Nov 2025) dropped the planned CY2027 mandatory OQR reporting. eCQI confirms voluntary reporting for CY2026 [101]. Some commentators expect CMS to propose a mandatory date in a later rule. Watch the CY2027 OPPS rulemaking (not verified).
- In IQR it is one of the self-selected eCQMs [K].
- An AAPM-commissioned panel identified 20 specification ambiguities [52].

**Recommendation.** Build RDSR ingestion and dose dashboards natively. Integrate a specialist dose platform only for advanced physics QA.

### 4.8 Cardiology, ECG, endoscopy and ultrasound

- **Cardiology** [K]:
  - Cardiovascular information systems (CVIS) cover cath, echo, nuclear and EP.
  - ECG management systems include GE MUSE and Philips IntelliSpace ECG.
  - ECG formats: DICOM 12-lead and General ECG waveform IODs, HL7 aECG (HL7 v3, used for FDA submissions) and SCP-ECG.
  - IHE Cardiology profiles cover resting ECG workflow, ECG retrieval for display, and cath and echo workflows.
  - Echo measurements arrive as DICOM SR.
  - Registry submissions (e.g., ACC NCDR) drive structured data capture.
- **Endoscopy** [K]:
  - Reporting systems such as Provation.
  - DICOM VL endoscopic image and video objects; the IHE Endoscopy workflow profile.
  - Quality KPIs: adenoma detection rate, cecal intubation.
  - **Scope reprocessing traceability**: each scope ID is linked to patient and reprocessing cycle (§7.2).
- **Ultrasound and POCUS.** Use DICOM SR measurement import (OB, vascular) and EBIW for encounter-based imaging, plus credentialing and QA workflows [42] [K].

---

## 5. Pharmacy information system

### 5.1 Formulary and drug knowledge

**Formulary management** [K]:

- P&T committee decisions, formulary status, restrictions (ID-approval antimicrobials, specialist-only drugs) and therapeutic interchange
- Standard concentrations: NPG.14.02.01 requires standardizing and limiting drug concentrations [15]
- Shortage substitution protocols, which NPG.14.02.01 also requires to be followed and communicated [15]
- Order sets
- Product-to-orderable mapping, with multiple NDCs/GTINs per orderable

**Drug knowledge bases.** License them; never build. Options include FDB MedKnowledge, Wolters Kluwer Medi-Span, Oracle Multum, Lexicomp/Micromedex for clinical reference, **dm+d** in England (NHSBSA, weekly refresh, the recognized standard SCCI0052, carrying SNOMED CT, BNF and GTIN links) [61], and regional compendia [K].

**Abstraction.** Insert a drug-knowledge abstraction layer so screening logic is content-agnostic and a region can switch vendors. FDB's new **Gravimetric Drug Density Module** (launched 30 Apr 2026 within MedKnowledge) supplies NDC-level drug densities. It shows that knowledge bases now also feed compounding devices [70].

### 5.2 Order verification and clinical screening

1. The pharmacist queue is prioritized by STAT, first dose, high-alert and time due.
2. Screening covers:
   - Allergy and cross-sensitivity
   - Drug–drug, drug–disease and duplicate therapy
   - Dose range: weight-based (metric only, measured rather than stated weight, per ISMP BP3 [64]) and BSA-based
   - Renal and hepatic adjustment
   - Pregnancy and lactation
   - Pediatric and neonatal dosing
   - IV compatibility and line access
3. The system defaults to safe regimens:
   - Weekly oral methotrexate (BP2)
   - Vinca alkaloids dispensed in minibags only (BP1)
   - Opioid-tolerance verification before extended-release opioids (BP15)
4. Interventions are documented with outcome codes.
5. **Override analytics** inform alert tuning. ECRI #9, designs that prompt unsafe workflows, applies here [87].

### 5.3 Dispensing: central, unit-dose, ADCs and robotics

- **Central pharmacy** [K]:
  - Unit-dose cart fill
  - Repackaging with barcode
  - Carousels (e.g., Swisslog, Omnicell) and pick robots
  - Barcode-verified picking
  - Tech-check-tech where permitted
- **Decentralized ADCs (BD Pyxis, Omnicell).**
  - These are different metrics, so the figures do not conflict:
    - **Decentralized drug distribution as the approach**: 86% of US hospitals in 2023, with most using ADCs as the primary method for maintenance doses (ASHP 2023 survey) [66]
    - **ADCs as the primary distribution method**: 74.5% in 2020 [68]
    - **Any ADC use**: about 97% in 2014 [K, ASHP 2014 survey, not re-verified]
  - ISMP's ADC guideline sets 9 core processes [63]:
    1. Ideal environmental conditions
    2. System security
    3. **Profiled cabinets with override monitoring**
    4. Appropriate configuration and functionality
    5. Optimal inventory
    6. Safe stocking and return processes
    7. Display of important patient and drug information
    8. Accurate withdrawal and transfer to the bedside
    9. Staff education and competency
  - ISMP BP16 limits the override list and requires retrospective pharmacist and nurse-manager review [64].
  - **NPG.14.01.01** requires a policy defining which overrides are reviewed and how often, though "a 100% review of overrides is not required" [15].
  - ASHP's 2021 guidelines cover override-list governance [65].
- **Integration pattern.** HL7 v2 feeds run to the ADC: ADT, profiled orders (RDE) and formulary master files. ADC transactions come back: dispense, waste, return, discrepancy and charges. Vendors add proprietary segments [K]. Our pharmacy module owns the profile. The ADC owns the hardware and local inventory.

### 5.4 IV compounding, TPN and chemotherapy (USP <797>/<800>)

- **USP <797>** (official 1 Nov 2023) replaced risk levels with **Categories 1, 2 and 3** [62]:
  - Category 1 default beyond-use dates: 12 hours room temperature or 24 hours refrigerated
  - Category 2: roughly 1 to 90 days, depending on preparation method, starting components, sterility testing and storage. The shortest is 1 day at room temperature for aseptically prepared CSPs made from nonsterile components without sterility testing. The longest is 90 days frozen for terminally sterilized, sterility-tested CSPs [K: from USP <797> BUD tables; source [62] was not retrievable in pass 2, so verify against the official text]
  - Immediate-use: administration starts within 4 hours
  - A Designated Person is required
  - It makes <800> (hazardous drugs) compendially applicable [62] [K]
- **IV workflow management systems (IVWMS).**
  - Components: barcode verification of ingredients, step-by-step images, **gravimetric verification**, remote pharmacist checking and label generation.
  - Reece et al.: 15,843 doses with 1,126 errors detected (7%), 71% of them by gravimetry [69].
  - Baxter reports 4.2% of doses with an intercepted error across more than 500 facilities (vendor data) [71].
  - An AJHP study cited by FDB found gravimetric checks identified discrepancies in more than 40% of preparations, versus under 1% with traditional methods. FDB describes this as a "nearly 90-fold" detection increase. The figure comes from a vendor press release, so check the primary study before quoting it [70].
  - Adoption: sterile workflow management technology was used in 21.3% of US hospitals in 2020 [68]. ASHP's 2023 survey reports that nearly two-thirds now use some sterile-preparation verification technology, up from 36% six years earlier. That is a broader category than IVWMS [66].
  - **ISMP BP11** calls for IVWMS for sterile compounding [64].
  - ASHP publishes an implementation checklist [67].
  - Products include Baxter DoseEdge, BD Cato, Omnicell IVX and compounding robots [K].
- **Parenteral nutrition (PN).** Standardized PN order templates, compatibility and limit checks, and a compounder interface (Baxter ExactaMix, B. Braun) [K].
- **Chemotherapy.**
  - Regimen and protocol library with cycle/day plans, BSA and AUC (Calvert) calculations, and dose-rounding rules.
  - Cumulative-dose tracking, nursing and pharmacy independent double checks, and closed-system transfer devices under <800>.
  - Antineoplastic administration standards reference metric weights (ASCO-ONS 2024 Standard 1.7) [64].

### 5.5 eMAR, BCMA and the closed loop

The loop is CPOE → pharmacist verification → dispense → eMAR → **BCMA** (scan patient + product) → administration documentation → pump autoprogramming and autodocumentation.

**Evidence.** In a landmark NEJM study (Poon et al. 2010, PMID 20445181), BCMA with eMAR produced these relative reductions [79]:

- Non-timing administration errors: 41.4%
- Potential adverse drug events: 50.8%
- Timing errors: 27.3%
- Transcription errors: eliminated, from 6.1% on units without bar-code eMAR

**Targets and requirements.**

- **Leapfrog**'s BCMA standard (now the "Safe Medication Administration" measure) requires three things [89][102]:
  - Both patient and medication scanned in 95% of bedside administrations
  - BCMA live in 100% of med/surg, ICU, L&D and pre-op/PACU units
  - All five decision-support elements

  The 2026 survey still assesses scanning compliance, unit coverage, decision support and workaround controls.
- ISMP BP18 extends BCMA beyond inpatient units: ED, OR, infusion, dialysis, radiology, L&D and the cath lab [64].
- BP20 requires barcode checks for tranexamic acid in surgical and OB areas [64].
- BP24 requires proactive scanning of new products and wristbands [64].
- ECRI ranks underuse of medication safety technology in perioperative settings as 2026 hazard #6 [87].
- Perioperative labeling under NPG.14.03.01 should be supported with label printing at the anesthesia workstation [15].

### 5.6 Inventory, procurement and supply-chain traceability

- Perpetual inventory across central pharmacy, satellites and ADCs, with par optimization [K]
- Wholesaler EDI: 850 purchase order, 855 acknowledgement, 856 advance ship notice, 810 invoice [K]
- Shortage management, including substitution protocols under NPG.14.02.01 [15]
- **DSCSA** package-level interoperable electronic tracing, with EPCIS data from trading partners. FDA's connected-trading-partner exemption for dispensers with 26 or more full-time employees ended on 27 Nov 2025. **The small-dispenser exemption was extended to 27 Nov 2027** by FDA on 6 Aug 2026. "Small" means 25 or fewer full-time pharmacists or pharmacy technicians, counted as of 27 Nov 2026. The previous end date was 27 Nov 2026 [97]. Hospital pharmacies above that threshold should therefore already comply, unless they hold an individual waiver or exemption (this is our inference).
- GS1 DataMatrix scanning at receipt populates lot and expiry for recalls [K]

### 5.7 Controlled substances and diversion

- Perpetual counts and shift reconciliation
- Witnessed waste
- DEA ordering (CSOS) and loss/theft reporting [K]
- **Analytics** that link ADC, eMAR, waste and OR anesthesia records:
  - ASHP's 2022 guidelines recommend analytics able to flag anomalous behavior [73].
  - ML approaches are published, e.g., Knight et al., AJHP 2022 [72].
  - Second-generation tools have shortened time to confirm diversion to an average of about 38 days [74].
  - Bluesight (Best in KLAS 2025 for diversion monitoring, more than 2,000 hospitals) uses unsupervised ML and closed-loop reconciliation (vendor data) [73].

**Recommendation.** Build reconciliation and case management natively. Integrate a specialist analytics engine initially.

### 5.8 Outpatient and discharge pharmacy and e-prescribing

- **US e-prescribing** [58][59][60]:
  - **NCPDP SCRIPT 2023011** is mandatory for Part D on **1 Jan 2028**, after a transition from v2017071 that began on 17 Jul 2024, the final rule's effective date [58].
  - **Formulary & Benefit v60** and **RTPB v13** are required by 1 Jan 2027.
  - SCRIPT 2023011 supports pharmacy-initiated transfer of electronic controlled-substance prescriptions [60].
  - EPCS requires DEA-compliant two-factor signing [K].
- **Meds-to-beds and outpatient dispensing.** Claims adjudication (NCPDP Telecommunication), patient counseling documentation and 340B split-billing where applicable [K].
- **England.** EPS (Electronic Prescription Service) and dm+d [61] [K].
- **India.** Prescription records under ABDM FHIR profiles [K].
- **Medication reconciliation** is required by NPG.14.05.01: admission list, comparison, discrepancy resolution and a written discharge list [15]. ISMP BP21 extends it to every level-of-care transition [64].

### 5.9 Medication coding

- **RxNorm** for US clinical drugs
- **NDC** for US packages; FDA has proposed a uniform format [K]
- **GTIN** for global trade items
- **ATC/DDD** for utilization analytics and stewardship
- **SNOMED CT** medicinal products
- **dm+d** (UK) [61]
- **ISO IDMP** for EU regulatory alignment [K]
- FHIR resources: Medication, MedicationRequest, MedicationDispense and MedicationAdministration

Design the product model as *orderable → clinical drug (RxNorm/dm+d VMP) → package (NDC/GTIN/AMPP) → lot/serial* [K].

### 5.10 Antimicrobial stewardship (AMS)

**Requirements.** NPG.14.06.01 requires a multidisciplinary committee and monitoring of antibiotic use, e.g., days of therapy [15]. The CMS Conditions of Participation require hospital stewardship programs [K]. NHSN AUR feeds SAAR benchmarking [88].

**Features.**

- Restricted-drug approval workflow
- 48–72-hour antibiotic time-outs
- IV-to-PO and dose-optimization prompts
- Bug–drug mismatch alerts that combine microbiology and the MAR
- Antibiogram display at order entry
- Cascade-reporting coordination with the lab
- Days of therapy (DOT) per 1,000 patient-days dashboards [K]

### 5.11 Clinical pharmacist workflows

- Patient lists with risk scores
- Rounding and intervention documentation
- Pharmacokinetic dosing: Bayesian, AUC-guided vancomycin per the 2020 consensus [K]
- TDM orders, renal dosing protocols, anticoagulation management (NPG.14.04.01 requires reversal and perioperative protocols and prefers unit-dose and prefilled products [15]), protocol-based prescribing under collaborative practice, and discharge counseling [K]

---

## 6. Medical device integration (MDI)

### 6.1 Landscape

| Device class | Data | Typical cadence |
|---|---|---|
| Physiologic monitors | HR, SpO2, NIBP/ABP, RR, temperature, EtCO2, waveforms | Up to ~1-minute discrete values in ICU/anesthesia |
| Ventilators | Settings and measured values | 1–15 minutes |
| Anesthesia machines and workstations | Agents, gases, ventilation | Continuous |
| Infusion pumps | Programming, status, events, volumes | Event-driven |
| Others | Dialysis/CRRT, ECGs, glucometers, beds, SCDs, ECMO | Varies |

### 6.2 Standards

- **IEEE 11073** [K][81]:
  - Nomenclature: 11073-10101 MDC codes
  - Domain information model: 11073-10201
  - IHE RTM (Rosetta Terminology Mapping) harmonizes vendor codes to MDC
- **IHE Devices (DEV) TF Rev 10.0 (2024-11-04)** [80][81]:

| Profile | Transaction | Purpose |
|---|---|---|
| **DEC** | PCD-01, HL7 v2 ORU | Device observations to the EHR |
| **ACM** | PCD-04 to PCD-07 | Alarm reporting and dissemination |
| **PIV** | PCD-03 | EHR/BCMA sends the infusion order to the pump (autoprogramming) |
| **IPEC** | PCD-10 | Pump events back to the EHR (autodocumentation) |
| **IDCO** | | Implantable cardiac device observations |
| **RTM** | | Terminology mapping |

  Trial-implementation supplements include [80]:

  - MEMDMC and MEMLS (equipment management and location, revised 2024-09-19)
  - **PCIM** (Point-of-Care Identity Management, revised 2026-05-07)
  - **SDPi** (revised 2026-05-07)
  - The new **PCMC** (Point-of-Care Monitored Communication), which the IHE index lists as published 2026-10-01. It has not been reviewed in this brief.
- **ISO/IEEE 11073 SDC** (Service-oriented Device Connectivity) [82][83][84][85]:
  - Core: 11073-20702 (MDPWS transport), 11073-10207 (BICEPS information model) and 11073-20701 (architecture and binding) [K].
  - **11073-10700:2024** (base participant requirements) and **11073-10701:2024** (metric provisioning) [82][83].
  - 10702 (alerts) and remote-control parts are in development [K].
  - FDA recognized IEEE 11073-10700-2022 in full (recognition no. 13-138) on 29 May 2024. ISO/IEEE 11073-10700 (1st ed., 2024-09) is the identical ISO adoption. FDA's entry states that **"implementing the IEEE 11073 SDC communication protocol is not sufficient to demonstrate safety, effectiveness, and security"** of a device [84].
  - Dräger is the leading commercial champion [85].
  - Verdict: track SDC and SDPi and design our gateway to accept them, but procure against DEC/ACM/PIV/IPEC today.

### 6.3 Integration platforms

Integration typically runs through vendor-neutral middleware: Philips Capsule (MDIP), Bernoulli, Masimo Iris Gateway, GE CARESCAPE Gateway and Oracle CareAware [K]. These platforms provide:

- Device drivers and serial-to-network bridges
- Device–patient association (barcode or location-based)
- Data normalization to IHE PCD-01 or vendor HL7
- Store-and-forward buffering
- Sometimes secondary alarm notification and surveillance analytics

Epic, Oracle and others consume these feeds into flowsheets [K]. **Recommendation: integrate a middleware platform.** Writing hundreds of device drivers is not a good use of our engineering effort.

### 6.4 Validation of auto-captured vitals

Device data lands as **unvalidated** values in the flowsheet, at a configurable granularity (e.g., 1 minute in anesthesia, 15 minutes in ICU, on-demand on wards). The nurse then reviews, validates, marks artifacts and edits with a reason, and only validated values become chartable and feed early-warning scores and CDS [K]. Raw streams are retained separately for analytics.

Patient–device association errors are the key safety risk. Requirements:

- Scan-to-associate
- Auto-dissociation on discharge or transfer
- Display of the associated patient on the device or gateway
- An audit trail

PCIM is an emerging IHE approach [80].

### 6.5 Alarm management and alarm fatigue

**NPG.01.05.01** requires hospitals to [15]:

- Identify the most important alarm signals, based on risk, noise and fatigue contribution, and on published evidence
- Set policies for clinically appropriate settings and for who may change parameters or turn alarms off
- Check alarms for proper settings and detectability
- Educate staff

The Joint Commission's sentinel-event data (98 alarm events in 2009–2012, 80 of them deaths) and reports that 85–99% of ICU alarms do not require intervention underpin the requirement [K].

**Build.**

- Alarm analytics: load per bed per day, top alarm types, duration and acknowledgement time, and nuisance-alarm rates
- Configuration governance for monitor default profiles
- Integration with ACM-based secondary notification (Vocera/Stryker, Ascom, Spok)

**Regulatory caution.** Systems forwarding alarms for active patient monitoring remain FDA-regulated devices. MDDS-type data transfer does not [K]. Integrate rather than build.

### 6.6 Smart pump interoperability: what the evidence says

- A **2025 systematic review** found interoperability reduced specific administration errors by 15.4–54.8%. Remaining errors are fewer but often high-risk [75].
- **Skog et al. (multihospital)** [76]:
  - Errors fell from 41.1% to 32.4% of infusions.
  - Continuous-medication errors fell from 12.6 to 6.0 per 100 infusions (p=0.005).
  - High-risk medication errors fell from 21 to 4.
- **A 2026 academic health system study** (AJHP, June 2026) [77]:
  - Programming steps fell from 3.3 to 1.6.
  - Alert resolution was 46–55% faster.
  - DERS compliance reached 96.1%.
  - But **autoprogramming compliance was only 53.4%** (68.3% for high-alert/REMS drugs).
- **Critical care review (2024)** [78]: keystrokes fell by 86%, with about 10 minutes of nurse time saved per infusion, which the authors put at more than $3M for a 316-bed hospital.
- **ISMP BP8** sets DERS compliance above 95%, monitored monthly; separate bolus and continuous limits; bidirectional interoperability with organizational compliance goals; and resourcing for library maintenance [64].

**Implication.** Our BCMA-to-pump workflow must make autoprogramming the path of least resistance: one scan sequence, fast pump pairing, and clear fallback. It must also report autoprogramming adoption per unit as a first-class KPI.

### 6.7 Cybersecurity of devices

**FD&C §524B** (cyber devices) requires [86] [K]:

- An SBOM
- A postmarket vulnerability monitoring and remediation plan
- Coordinated vulnerability disclosure
- Processes assuring cybersecurity

FDA has refuse-to-accept authority. The guidance has gone through three versions:

1. **September 2023**: the first final premarket guidance.
2. **27 Jun 2025**: "Cybersecurity in Medical Devices: Quality System Considerations and Content of Premarket Submissions" added Section VII on §524B and superseded the 2023 version [86].
3. **February 2026** (page dated 3 Feb 2026, docket FDA-2021-D-1158): reissued as **"Cybersecurity in Medical Devices: *Quality Management System* Considerations and Content of Premarket Submissions"**. It supersedes the June 2025 version and still addresses §524B [99].

The retitling matches the QMSR, which took effect 2 Feb 2026. FDA's page does not list substantive changes, so diff the two PDFs before updating procurement templates.

**Hospital side** [K]:

- MDS2 disclosure forms
- SBOM ingestion (SPDX/CycloneDX) correlated with vulnerability feeds
- IEC 80001-1:2021 risk management for medical IT networks
- Network segmentation
- Legacy-device compensating controls. In ECRI's 2026 hazards list, legacy-device cyber risk is #8 and "digital darkness" unpreparedness is #2. The #1 hazard is misuse of AI chatbots in healthcare [87].

**For our HMS.** Ship our own SBOM. Maintain a **medical device inventory with SBOM and vulnerability correlation**. Design all device gateways for zero-trust segmentation and downtime resilience.

---

## 7. Other ancillary services

### 7.1 Point-of-care testing (POCT)

- **Connectivity.**
  - **CLSI POCT01** defines device-to-data-manager connectivity [K]. IHE PaLM **LPOCT** profiles the POC workflow [1].
  - CLSI AUTO16 explicitly excludes POC [3].
  - Data managers include Telcor, Conworx, Abbott, Roche, Radiometer and Siemens [K].
- **Required controls.**
  - Operator lockout when competency or training has lapsed
  - QC lockout
  - Patient ID by wristband scan, plus handling for unmatched results
  - Reagent lot capture
- **Oversight.**
  - Waived-test competency at orientation and annually, using two methods (NPG.10.02.01) [15]
  - CLIA non-waived competency semiannually in year one and annually after [K]
  - ISO 15189:2022 now includes POCT requirements [11]
- **Scale.** One academic center ran 879k POC glucose tests a year [14].
- **Build versus integrate.** Integrate the data manager. Build result filing, critical-result documentation (named-recipient picker [14]), operator competency views and POCT KPIs.

### 7.2 CSSD and sterile processing

**Workflow** [K]:

1. Decontamination
2. Washer-disinfector, with cycle data captured
3. Inspection and assembly against count sheets with images
4. Packaging
5. Sterilization (steam, low-temperature), with parametric data and BI/CI results
6. Load release or quarantine
7. Storage
8. Case-cart picking from OR schedules and preference cards
9. Point of use
10. Return

Loaner management and manufacturer IFU libraries are part of the workflow.

**Traceability.** UDI direct marking of reusable instruments (2D DataMatrix) and set-level barcodes enable **patient-to-load traceability for recalls**. GS1, HIBCC and ICCBBA are FDA-accredited issuing agencies [K].

**Standards** [K]: ANSI/AAMI ST79 (steam), ST91 (flexible endoscopes) and ST108 (water quality).

**ECRI 2026** lists deficient cleaning instructions (#7) and water quality during sterilization (#10) [87].

**Build versus integrate.** Integrate a specialist tracking system (e.g., Censis, Getinge T-DOC, STERIS) in mature markets. Build a lightweight set and load tracker for emerging-market deployments. Either way, the OR module must link instrument set and load IDs to the surgical case.

### 7.3 Dietary and nutrition

**Workflow** [K]:

- Diet orders: NPO, therapeutic diets, texture levels per IDDSI 0–7, fluid restrictions, enteral and parenteral nutrition
- Allergy and intolerance propagation from the shared allergy list
- Cultural and religious preferences
- Menu selection or room service
- Tray tickets with allergen warnings
- Tray-line production and delivery confirmation
- Calorie counts
- Malnutrition screening and dietitian assessment, which feeds CMS's Global Malnutrition Composite Score eCQM in the US

**Standards.** HL7 v2 OMD (dietary orders) and FHIR NutritionOrder [K].

**Build versus integrate.** Build orders, allergy logic, tray tickets and the dietitian workflow. Integrate foodservice production systems (CBORD, Computrition) where they already exist.

### 7.4 Rehabilitation therapies (PT/OT/SLP)

**Workflow** [K]:

- Referral and orders
- Evaluation with standardized outcome measures (CMS Section GG for post-acute care)
- Plan of care with goals, certification and recertification
- Scheduling against therapist capacity
- Daily treatment notes
- Timed-code billing (US "8-minute rule")
- Discharge summary
- Inpatient rehab assessments (IRF-PAI in the US)

**Build versus integrate.** Build natively. This is documentation-heavy and integrates with scheduling and billing.

### 7.5 Dialysis

**Workflow** [K]:

- Orders: modality, dialyzer, bath, UF goal, anticoagulation
- Machine data via vendor gateways or PCD-01: blood and dialysate flow, pressures, UF and Kt/V
- Water-treatment logs under the ISO 23500 series
- Vascular access tracking
- Infection surveillance
- In-unit BCMA (ISMP BP18 targets dialysis) [64]

Outpatient ESRD units in the US report to CMS (EQRS, ESRD QIP). Acute inpatient dialysis and CRRT also need ICU flowsheet integration.

**Build versus integrate.** Build documentation and integrate machines through MDI.

### 7.6 Respiratory therapy

**Workflow** [K]:

- RT orders and protocol-driven care (oxygen titration, bronchodilators, SBT and weaning protocols)
- Ventilator settings and values via DEC
- Ventilator checks
- ABG POCT integration
- Airway documentation
- Therapist assignment and workload (RVUs)
- NHSN ventilator-associated event surveillance support

**Build versus integrate.** Build natively. Device data comes through MDI.

---

## 8. Build vs buy vs integrate

### 8.1 What top-tier systems actually do

The analyst synthesis below draws on [55][56][90][91] and domain knowledge [K]:

- **Single-vendor EHR shops** (Epic, Oracle Health) increasingly use the EHR's own modules for core ancillary *workflow*. On Epic that means Beaker (clinical and anatomic pathology), Radiant (RIS), Willow (pharmacy), Cupid (cardiology), Beacon (oncology) and OpTime/Anesthesia. On Oracle it means PathNet, RadNet and PharmNet. The reasons are a single patient record, closed-loop orders and results, and lower interface burden.
- **Best-of-breed persists** where the domain has one or more of the following:
  - **Regulatory weight**: BECS in the US, alarm forwarding
  - **Hardware coupling**: ADCs, carousels, IV robots, pumps, analyzers, scanners
  - **Extreme specialty depth**: PACS/VNA, digital pathology, molecular/NGS, dose monitoring, voice recognition, diversion analytics, CSSD tracking, POCT data management
  - **Network effects**: e-prescribing networks, reference labs
- **Hybrid sites** keep a specialist LIS (e.g., Sunquest/Clinisys or SCC) for microbiology, blood bank or outreach behind an EHR-native lab, and pair EHR RIS with Sectra, GE, Philips, Agfa, Fujifilm, Merge or Intelerad PACS.

### 8.2 Decision table

| Area | Recommendation | What we build | What we integrate | Rationale |
|---|---|---|---|---|
| LIS clinical pathology core | **Build** | Orders, collection/PPID, accessioning, specimen tracking, rules engine (autoverification, reflex, delta, critical), results, QC, reporting, send-outs, TAT analytics | Instrument middleware (Data Innovations or vendor) for legacy ASTM and analyzer drivers | Core of the order-to-result loop. Not an FDA device. Clear differentiation via the rules engine. |
| Analyzer connectivity | **Integrate first, build LAW-native next** | IHE LAW / AUTO16 endpoint, LIVD import | Middleware with 1,000+ drivers [8] | Driver breadth cannot be replicated quickly. LAW is the future target [3]. |
| Microbiology | **Build** | Hierarchical result model, culture workup, AST interpretation tables, cascade reporting, antibiogram, WHONET/NHSN export | MALDI-TOF/AST instruments via middleware; lab automation | Central to stewardship and infection control. Incumbent micro modules are often weak. |
| Anatomic pathology | **Build workflow; license content** | Case/part/block/slide tracking, grossing, histology tracking, sign-out, SDC synoptic engine | CAP eCP/eCC content license [18], dictation | Synoptic content is licensed. The workflow is ours. |
| Digital pathology | **Integrate** | Scan worklist orchestration, case-image linkage, viewer launch | WSI scanners, image management, AI (DICOM WSI, DPIA) [22][23] | Fast-moving specialist market. DICOM is now viable [24]. |
| Molecular / genomics | **Integrate** | Orders, results display, FHIR genomics store, PGx CDS | Molecular LIMS, bioinformatics, interpretation platforms | Deep specialty. Pipeline validation burden. |
| Blood bank (US) | **Integrate a cleared BECS** | Transfusion orders, consent, bedside administration UI, vitals and reaction documentation | SafeTrace Tx / SCC SoftBank / Clinisys etc. [29][31] | Class II 510(k) [32] |
| Blood bank (non-US) | **v1: integrate. Later: build under design controls** *(reconciled 2026-10-16 with `07` §9.1 #7/§9.4)* | v1: transfusion orders, bedside verification inside BCMA, and an HL7 interface to the external blood-bank system. Later, after the ISO 13485 / IEC 62304 QMS exists: a full transfusion service and ISBT 128 engine in the regulated-modules track | v1: the hospital's existing blood-bank system; national systems (e.g., e-RaktKosh) | Still a viable market differentiator, but not in v1. Building it inside the QMS keeps a future 510(k) path open. Record the per-market regulatory determination first. |
| RIS | **Build** | Orders, protocoling (dose ranges), scheduling, MWL/MPPS broker, tracking, reporting templates, critical/actionable findings, follow-up tracking, peer learning, MQSA, dose dashboards | n/a | Core workflow. Strong regulatory hooks (NPG 13) [15]. |
| PACS / VNA / viewer | **Integrate** (open source optional for low-cost tiers) | DICOMweb client, IID invoker, image-availability events | Sectra/GE/Philips/Agfa/Fujifilm/Intelerad/Merge or cloud DICOM stores | Best-of-breed even at Epic/Oracle sites [55][56] |
| Voice recognition / gen-AI reporting | **Integrate** | Structured template engine, RADS logic, FHIRcast context | PowerScribe or equivalents | Commodity speech engines. Our value is structure. |
| Imaging AI | **Integrate via standards** | Orchestration contract (AIW-I), AIR display, AIRA governance ledger | AI vendors and orchestrators [46][47] | Fast-moving, FDA-cleared models [57] |
| Dose monitoring | **Build basic; integrate advanced** | RDSR/REM ingestion, exceedance review workflow | Physics-grade dose platforms | NPG.13.04.01 compliance [15] |
| Cardiology CVIS/ECG, endoscopy | **Integrate** (build later) | Orders, results/report display, DICOM/aECG viewing | CVIS, ECG management, endoscopy reporting | Specialty depth; registry-driven |
| Pharmacy core | **Build** | Formulary, verification, eMAR/BCMA, central dispensing, inventory, CS reconciliation, AMS, chemo regimens, PN orders, med rec | n/a | The core of the medication-safety loop |
| Drug knowledge base | **License** | Abstraction layer, local overrides | FDB / Medi-Span / Multum / dm+d / regional | Never build. Content liability. |
| ADCs, carousels, robots | **Integrate** | Profiles, formulary sync, override policy, analytics | BD Pyxis, Omnicell, Swisslog, etc. | Hardware-coupled |
| IV workflow systems / compounders | **Integrate** | Orders to the IV queue, status return, labels | DoseEdge / Cato / Omnicell IVX; PN compounders | Hardware + gravimetric [69][70] |
| Diversion analytics | **Integrate first** | Reconciliation, case management, data feeds | Bluesight / Invistics / BD | Mature ML products [72][73] |
| E-prescribing networks | **Integrate** | SCRIPT 2023011-native messages, EPCS | Surescripts / NHS EPS / ABDM | Network access [58][59] |
| Device middleware | **Integrate** | PCD-01/DEC consumer, validation UX, device association, raw store | Capsule / Bernoulli / Masimo / GE / etc. | Driver breadth; regulated alarm functions |
| Alarm secondary notification | **Integrate** | Alarm analytics, policy configuration | ACM-capable alarm platforms | FDA-regulated active monitoring [K] |
| Smart pump interoperability | **Integrate via vendor gateways** | PIV (PCD-03) order send, IPEC (PCD-10) documentation, KPI | Pump vendor servers | Vendor-specific safety logic |
| POCT | **Integrate data manager** | Result filing, competency views, critical-result documentation | POCT01 data managers | Device diversity [14] |
| CSSD | **Integrate (mature markets) / build light** | Case-to-load linkage, recall trace | Censis / T-DOC / STERIS | Specialist |
| Dietary | **Build** (integrate foodservice) | Diet orders, allergy logic, tray tickets, dietitian notes | CBORD / Computrition | Order and allergy safety is clinical |
| Rehab, RT, dialysis documentation | **Build** | Full documentation and scheduling | Devices via MDI | Documentation-centric |

---

## 9. Standards and interfaces reference

| Area | Standard / profile | Version / status (as of Oct 2026) | Purpose | Mandatory / optional for our build |
|---|---|---|---|---|
| Lab orders/results (EHR↔LIS) | HL7 v2.5.1 (OML/ORM, ORU/OUL); IHE PaLM LTW | PaLM TF Rev 11.0 Final Text [1] | Order and result exchange | **Mandatory** |
| Analyzer interface | IHE PaLM LAW / **CLSI AUTO16** | AUTO16 Ed2, 3 Jun 2026 [3] | Analyzer work orders and results, patient and QC | **Mandatory (target)** |
| Legacy analyzers | ASTM E1381/E1394 → CLSI LIS01-A2/LIS02-A2 | Legacy [K] | Older analyzers | Mandatory via middleware |
| Lab automation | IHE PaLM LDA | Final Text [1] | Automation-system manager ↔ automation | Optional |
| Specimen labeling | IHE PaLM LBL | Final Text [1] | Label requests to a label broker | Recommended |
| Specimen tracking | IHE PaLM SET | Trial Implementation 2021 [1] | Specimen event tracking | Recommended |
| Code set distribution | IHE PaLM LCSD | Final Text [1] | Test-catalog sync | Optional |
| POCT | CLSI POCT01; IHE PaLM LPOCT | POCT01-A2 [K]; Final Text [1] | POC device ↔ data manager ↔ LIS | **Mandatory** (via data manager) |
| Lab semantics | LOINC, UCUM, SNOMED CT, LIVD | LOINC semiannual releases [K] | Observation, unit and specimen coding | **Mandatory** |
| US lab interop | HL7 v2.5.1 LRI, LOI, eDOS, ELR | [K] | Reference labs, public health | Mandatory (US) |
| Lab reports sharing | IHE XD-LAB; FHIR DiagnosticReport | Final Text [1] | Cross-enterprise report sharing | Recommended |
| Autoverification | CLSI AUTO10-A, AUTO15 | 2006 / 2019 [6] [K] | Rule design and validation guidance | Guidance |
| AP synoptic | CAP eCC/eCP (SDC XML); ICCR; IHE APSR | Rolling releases [18][20] | Structured cancer reporting | **Mandatory** for CAP-accredited labs [19] |
| Cancer registry | HL7 2.5.1 + eCC (NAACCR) | FY2026 [21] | Registry reporting | Mandatory (US) |
| Digital pathology | DICOM WSI (Sup 145); IHE PaLM DPIA | DPIA rev 2026-03-06 [1][22][23] | WSI storage and acquisition workflow | Recommended |
| Blood product coding | ISBT 128 (ST-001) | v6.2.2 (Apr 2023) plus RT019/RT038 [33] | Product/donation IDs and labels | **Mandatory** (blood bank) |
| US blood labeling | ICCBBA IG-002 US Consensus Standard | v4, Jan 2024 [34] | US blood component labels | Mandatory (US) |
| Bedside transfusion | IHE PaLM TMA | Trial Implementation 2019 [1] | Administration messaging | Optional |
| BECS | 21 CFR 864.9165 (product code MMH) | Class II, 510(k) [32] | Blood bank software regulation | **Mandatory if built (US)** |
| Imaging workflow | IHE SWF.b (HL7 v2 OMI + DICOM MWL/MPPS/Storage Commitment) | RAD TF Rev 23.0 [42] | Order → acquisition → archive | **Mandatory** |
| Imaging web services | DICOMweb (QIDO/WADO/STOW/UPS-RS) | PS3.18 current [40] | RESTful image query, retrieve, store, worklist | **Mandatory** |
| EHR image launch | IHE IID | Final Text Aug 2025 [44] | URL-based viewer invocation | **Mandatory** |
| Cross-enterprise imaging | IHE XDS-I.b; MADO; WIA | Final Text; MADO Trial Implementation [42][45] | Image sharing | Recommended |
| Unordered imaging | IHE EBIW | Trial Implementation 2025 [42] | POCUS, photos | Recommended |
| Reporting context | IHE IRA (FHIRcast) | Trial Implementation 2023 [42] | Context sync across reporting apps | Recommended |
| Imaging AI | IHE AIW-I, AIR, AIRA | 2020; Rev 1.3 2025; 2025 [42][46] | AI orchestration, results, assessment | Recommended |
| Dose | DICOM RDSR; IHE REM | Final Text [42] | CT dose capture | **Mandatory** (NPG 13 data) |
| Structured reports | DICOM SR; RadLex; LOINC/RSNA Playbook; ACR RADS | [K] | Structured imaging content | Recommended (RADS mandatory for mammography) |
| ECG | DICOM waveform; HL7 aECG; SCP-ECG | [K] | ECG storage and exchange | Optional (integrate) |
| E-prescribing (US) | NCPDP SCRIPT 2023011; F&B v60; RTPB v13 | Required 1 Jan 2028 / 1 Jan 2027 [59][60] | e-Rx, benefits | **Mandatory (US)** |
| Medication terminology | RxNorm, NDC, GTIN, ATC, dm+d, SNOMED CT | dm+d weekly [61] | Drug coding | **Mandatory** (by region) |
| Pharmacy messages | HL7 v2 RDE/RDS/RAS/RGV; FHIR Medication* | [K] | Orders, dispense, administration | **Mandatory** |
| Supply chain | GS1 / EPCIS (DSCSA) | In force; small-dispenser exemption to 27 Nov 2027 [97] | Product tracing | Mandatory (US dispensers) |
| Compounding | USP <797>, <800> | <797> official 1 Nov 2023 [62] | Sterile compounding and HD handling | **Mandatory** (US) |
| Device data | IHE DEV DEC (PCD-01); IEEE 11073-10101 nomenclature; RTM | DEV TF Rev 10.0 (Nov 2024) [80] | Device observations to the EHR | **Mandatory** |
| Alarms | IHE DEV ACM (PCD-04 to PCD-07) | Rev 10.0 [80] | Alarm dissemination | Recommended |
| Pump interoperability | IHE DEV PIV (PCD-03), IPEC (PCD-10) | Rev 10.0 [80] | Autoprogramming and autodocumentation | **Mandatory** (ISMP BP8) [64] |
| Plug-and-play devices | ISO/IEEE 11073 SDC (10207, 20701/2, 10700/10701); IHE SDPi | 10700/10701:2024 (FDA-recognized 10700, May 2024); SDPi Trial Implementation rev. 2026-05-07 [80][82][83][84] | Service-oriented device connectivity | Optional (roadmap) |
| Device cybersecurity | FD&C §524B; FDA premarket guidance; MDS2; IEC 80001-1; SBOM | QMSR-aligned guidance, Feb 2026, superseding 27 Jun 2025 [86][99] | Device security posture | **Mandatory** for procurement and governance |
| Device identification | FDA UDI / GS1 / HIBCC / ICCBBA | [K] | Instruments, implants, devices | **Mandatory** |
| Lab quality | ISO 15189:2022; CLIA; CAP; NABL | 2022 edition only, since 6 Dec 2025 (ILAC; some bodies 31 Dec 2025) [11][104] | Accreditation | **Mandatory** (by market) |
| Hospital accreditation | Joint Commission NPGs | Effective 1 Jan 2026 [15] | Patient ID, critical results, alarms, imaging, meds | **Mandatory** (US, Joint Commission-accredited) |

---

## 10. Key performance indicators

| Domain | KPI | Definition | Target / benchmark | Source / status |
|---|---|---|---|---|
| Lab | ED STAT TAT (e.g., K+, troponin) | Receipt → verified result, 90th percentile | ≤60 min **(est.)**; troponin rapid-rule-out pathways assume ~60 min | (est.) [K] |
| Lab | Inpatient AM draw results | % AM results available by round time (e.g., 07:00) | ≥90% **(est.)** | (est.) |
| Lab | Specimen rejection rate | Rejected ÷ received, by reason (hemolysis is usually the top cause) | <1% overall **(est.)**; ED hemolysis <2–3% **(est.)** | (est.) |
| Lab | WBIT / mislabel rate | Detected WBIT ÷ samples | Trend to zero. Monitor by collector and unit. | SHOT [37][93] |
| Lab | Critical value notification timeliness | Verify → documented receipt by responsible caregiver | ≥95% within policy (commonly 15–30 min) **(est.)** | NPG.01.02.01 requires evaluation [15] |
| Lab | Critical documentation completeness | % with all CAP elements (traceable recipient, read-back) | 100% | CAP [13][14] |
| Lab | Autoverification rate | Auto-released ÷ total results, by section | Chemistry ≥70–90% **(est.)** | Vendor claim up to 95% [9] |
| Lab | Corrected report rate | Corrected ÷ reported results | <0.1–0.2% **(est.)** | (est.) |
| Lab | Blood culture contamination | Contaminated ÷ blood cultures | ≤3% (CLSI), stretch ≤1% [K] | [K] |
| Lab | QC failure / lockout events | Per analyzer per month | Trend | ISO 15189 risk metrics [11] |
| AP | Routine surgical TAT | % routine biopsies signed out ≤2 working days | ≥90% **(est.)** [K] | [K] |
| AP | Frozen section TAT | % ≤20 min | ≥90% [K] | [K] |
| AP | Synoptic completeness | % cancer resections with all required eCC elements | 100% | CAP [19] |
| Blood bank | C:T ratio | Crossmatched ÷ transfused units | ≤2.0 [K] | [K] |
| Blood bank | Wastage / outdate rate | Wasted ÷ issued (RBC, platelets) | RBC <2–3% **(est.)** | (est.) |
| Blood bank | Bedside electronic verification compliance | % transfusions with full scan sequence | ≥98% **(est.)** | SHOT evidence [38] |
| Blood bank | Near-miss and incident reporting | Rate per 1,000 units | Track; higher reporting = better culture | SHOT [37] |
| Radiology | Report TAT | Exam complete → final report, by patient class | ED ≤60 min; inpatient ≤4–8 h; outpatient ≤24 h **(est.)** | (est.) |
| Radiology | Critical/actionable findings closed-loop rate | % communicated and acknowledged within category window | ≥95% **(est.)** | ACR [49] |
| Radiology | Follow-up recommendation closure | % recommended follow-ups completed or closed by due date | Trend to ≥80% **(est.)** | (est.) |
| Radiology | MWL utilization / unmatched studies | % exams acquired via MWL; orphan studies per 1,000 | ~100% / → 0 **(est.)** | SWF.b [43] |
| Radiology | CT dose-index exceedances | % exams above protocol expected range; % reviewed | 100% reviewed | NPG.13.04.01 [15] |
| Radiology | MRI safety incidents | Thermal injuries, ferromagnetic events | Collected and analyzed | NPG.13.04.01 [15] |
| Pharmacy | Verification TAT | Order → pharmacist verify (STAT / first dose / routine) | STAT ≤15 min; routine ≤30–60 min **(est.)** | (est.) |
| Pharmacy | BCMA patient and medication scan compliance | Scanned administrations ÷ total | ≥95% | Leapfrog [89][102] |
| Pharmacy | BCMA coverage | % of care areas live (incl. ED, OR, L&D, dialysis, radiology) | 100% | ISMP BP18 [64] |
| Pharmacy | ADC override rate | Override removals ÷ total removals; % reviewed per policy | Low and monitored; policy-defined review | ISMP [63][64]; NPG.14.01.01 [15] |
| Pharmacy | DERS compliance | Infusions using drug library ÷ total | >95%, monthly | ISMP BP8 [64] |
| Pharmacy | Autoprogramming rate | Autoprogrammed ÷ eligible infusions | Organizational goal; 53% observed in a 2026 study | [77] |
| Pharmacy | IVWMS error intercept rate | Doses with intercepted error ÷ doses | Monitor; 4–7% reported | [69][71] |
| Pharmacy | Medication error / ADE rate | Per 1,000 doses or patient-days (reported + trigger-tool) | Trend down; ISMP warns against error rates as a sole safety metric (BP25) | [64] |
| Pharmacy | Med reconciliation completion | % admissions/discharges with completed reconciliation | ≥95% **(est.)** | NPG.14.05.01 [15] |
| Pharmacy | Antimicrobial use | DOT per 1,000 patient-days; SAAR | Benchmark vs NHSN | [88] |
| Pharmacy | CS discrepancy resolution | % resolved within shift / 24 h | 100% within 24 h **(est.)** | (est.) |
| Pharmacy | Diversion case cycle time | Detection → confirmation | ~38 days reported with 2nd-gen tools | [74] |
| MDI | Auto-capture coverage and latency | % vitals from devices; device → flowsheet median latency | ICU ≥90% **(est.)**; <1 min **(est.)** | (est.) |
| MDI | Alarm burden | Alarms per bed per day; % non-actionable | Downward trend | NPG.01.05.01 [15] |
| MDI | Device patching and cyber posture | % devices with SBOM on file; % with known exploitable vulnerabilities mitigated | 100% SBOM for new purchases | §524B [86] |
| POCT | Operator competency currency | % active operators current | 100% (lockout enforced) | NPG.10.02.01 [15] |
| POCT | Unmatched / unidentified results | Per 1,000 POC tests | → 0 **(est.)** | (est.) |
| CSSD | Set errors / incomplete sets | Per 1,000 sets | Trend down **(est.)** | (est.) |
| Dietary | Allergy-tray errors; diet order → first tray | Count; minutes | 0; ≤60 min **(est.)** | (est.) |

---

## 11. Implications for our build

1. **Make the diagnostic order lifecycle a platform primitive.** Lab, radiology, POCT, cardiology, blood bank and pharmacy share one order/task/result/acknowledgement state machine with timestamped events. Every TAT and closed-loop KPI in §10 should be computable on day one without custom reports.
2. **Ship one rules engine and treat it as a medical-grade asset.** Rules are declarative and versioned, with a simulation and replay harness against historical data, approval workflow (medical director, P&T), effective-dating and an audit trail. It runs autoverification, reflex, delta, critical values, protocol defaults, pharmacy screening suppression, ADC override policy and alarm escalation. This is where we can clearly beat incumbents, whose logic is fragmented across LIS, middleware and EHR.
3. **Build one closed-loop critical-result service** for lab, radiology and POCT. It captures CAP elements by construction: named-recipient picker, never free text [14]; read-back checkbox for phone; electronic acknowledgement as receipt confirmation. It has policy-driven escalation and an NPG.01.02.01 timeliness dashboard [13][15].
4. **Identity everywhere.** Build a shared barcode and identity service: 2D wristbands, IHE LBL specimen labels, ISBT 128 parser/validator, GS1 (GTIN/lot/expiry/serial) and UDI. Make "scan, don't type" the default in every ancillary workflow, and log every override of a failed scan as a reportable event.
5. **LIS.** Build clinical pathology, microbiology and the AP workflow. Buy instrument middleware for driver breadth. Make IHE LAW / CLSI AUTO16 our native analyzer protocol [3], and require LAW conformance in analyzer procurement where we have leverage. Use LIVD to seed LOINC mapping. Ship WHONET and NHSN AUR exports. Design for ISO 15189:2022: risk register, document control, measurement uncertainty, POCT oversight and downtime [11].
6. **Pathology.** License CAP eCP/eCC SDC content and build a generic SDC renderer, reusable for ICCR and national datasets [18][20]. Go DICOM-WSI-first for digital pathology and integrate scanners and viewers through DPIA. Do not build an image management system for pathology [22][23][24].
7. **Blood bank.** In the US, integrate a cleared BECS and keep our code out of release and compatibility decisions [32]. Elsewhere, build under design controls (IEC 62304-style lifecycle, hazard analysis, traceability) so a future 510(k) is feasible. *(Reconciled 2026-10-16 with `07` §9.1 #7/§9.4. In **v1, every market** integrates an external blood-bank system via HL7. The native non-US ISBT 128 module comes later, in the regulated-modules track once the ISO 13485 / IEC 62304 QMS exists, and after a per-market regulatory determination.)* Build bedside electronic transfusion verification into BCMA. The SHOT evidence supports it [38]. Get a written regulatory opinion on whether it counts as a BECS accessory before US launch.
8. **Radiology.** Build the RIS:
   - Protocoling with expected dose ranges, MRI safety screening with incident capture, RDSR ingestion and an exceedance review workflow (NPG.13 [15])
   - MQSA density hard-stops
   - Critical and actionable findings, incidental follow-up tracking, and peer learning

   Integrate PACS and VNA strictly via **DICOM MWL/MPPS + DICOMweb + IID** [40][44]. Never couple to a proprietary PACS API. Use FHIRcast and IRA for context. Consume AI via AIW-I/AIR and record AIRA assessments [46][47].
9. **Pharmacy.** Build formulary, verification, eMAR/BCMA, central dispensing, inventory, controlled-substance reconciliation, AMS, chemotherapy regimens, PN orders and med rec. Put a **drug-knowledge abstraction layer** in front of FDB/Medi-Span/Multum/dm+d/regional content. Integrate ADCs, carousels, IV workflow systems, compounders and diversion analytics through well-specified HL7 v2/FHIR interfaces. Be **SCRIPT 2023011-native** now, ahead of the 2028 cutover [59]. Hard-code ISMP 2026–2027 defaults: metric-only weights, weekly methotrexate, minibag vincas, opioid-tolerance checks and override limits [64].
10. **Make smart-pump autoprogramming the easiest path.** Use a single scan sequence: patient → bag → pump channel. Support PIV (PCD-03) and IPEC (PCD-10) through vendor gateways, offer one-click acceptance of pump-documented volumes, and report DERS and autoprogramming compliance by unit monthly. Evidence shows the gains are real but adoption stalls around half of infusions without design attention [75][77].
11. **Device integration.** Buy middleware. Build the PCD-01/DEC consumer, a nurse validation UX with artifact marking, device–patient association with auto-dissociation, a raw high-frequency store for analytics, and alarm analytics for NPG.01.05.01. Keep alarm forwarding for active monitoring out of our regulated scope by integrating ACM-capable platforms. Put SDC/SDPi on the roadmap, not in the MVP [80][82].
12. **Security and regulatory boundary.**
    - Publish our own SBOM.
    - Maintain a device inventory that correlates vendor SBOMs and MDS2 forms with vulnerability feeds [86].
    - Segment device networks.
    - Write a **regulatory boundary map** per module (non-device/MDDS, CDS-exempt, regulated) and revisit it with every feature that drives device behavior: pump autoprogramming, alarm routing, blood release.
13. **Downtime is a feature.** Every ancillary needs a designed degraded mode:
    - Lab and blood bank label printing and downtime accession ranges
    - Cached modality worklists
    - BCMA offline with later reconciliation
    - ADC downtime override policy
    - Read-only cached MAR

    ECRI's #2 hazard for 2026 is unpreparedness for "digital darkness" [87], and ISO 15189 expects downtime plans [11] [K].
14. **Regionalize through configuration, not forks.** Terminology bindings (LOINC/SNOMED/UCUM, RxNorm or dm+d or national), accreditation packs (CAP/CLIA, ISO 15189/NABL, Joint Commission NPGs, NHS), e-prescribing adapters (Surescripts, EPS, ABDM) and blood-bank regulatory modes (US BECS-integrated versus native) should all be tenant-level configuration.
15. **Build sequence.** *(Reconciled 2026-10-16 with `03` §2/§21 and `07` §9.1. Steps 1–5 are the **MVP** for the India/KSA minimum viable hospital. Steps 6–10 are P2/P3, with interfaces to external microbiology, AP and blood-bank systems in the MVP. This is interim until the proposed requirements catalogue, report 14.)*
    1. Shared services
    2. Pharmacy core with BCMA and eMAR, including bedside transfusion verification. Pump interoperability via one vendor is **P2 unless a design partner requires it** (the infusion data model is designed now)
    3. LIS clinical pathology core with middleware, plus critical results
    4. RIS with PACS integration via DICOMweb/IID
    5. MDI vitals validation
    6. Microbiology, plus AMS (P2; interface in MVP)
    7. AP workflow with SDC (P2; interface in MVP)
    8. POCT, dietary, therapies
    9. Blood bank: an HL7 interface to an external blood-bank system in v1 in all markets (a cleared BECS in the US). A native ISBT 128 module comes later, non-US only, once the QMS exists
    10. Advanced items: digital pathology orchestration, AI governance, dose analytics, SDC

### Open items to verify before design freeze

- Current AABB Standards edition and electronic-crossmatch wording
- EU SoHO Regulation implementing and delegated acts beyond 2025/1467. The application date of 7 Aug 2027 is confirmed in pass 2 [98].
- Exact CLIA retention clauses (eCFR was not retrievable in pass 2)
- CLSI M39/M100 current editions
- ~~FDA cybersecurity guidance revision after QMSR~~: resolved in pass 2. It was reissued in Feb 2026 under a QMS title [99]. Still to do: diff it against the June 2025 text.
- ~~Leapfrog 2026 BCMA thresholds~~: resolved. The 95% scanning threshold stands [102].
- ~~DSCSA small-dispenser timelines~~: resolved. The exemption now runs to 27 Nov 2027 [97].
- Whether CMS's CY2027 OPPS rulemaking proposes mandatory ExRad (CMS1206) reporting [101]
- NABL/NABH specifics if India is a launch market
- Whether the Joint Commission laboratory program will also move to NPGs

---

## Sources

1. IHE International. Pathology and Laboratory Medicine (PaLM) Domain publications (TF Rev 11.0; LAW, LTW, LDA, LPOCT, LCSD, LBL, XD-LAB; supplements APSR, DPIA, ILW, LCC, SET, TMA). https://profiles.ihe.net/PaLM/
2. IVD Industry Connectivity Consortium. LAW (Laboratory Analytical Workflow) Profile. https://ivdconnectivity.org/law-profile/
3. CLSI. AUTO16 – Next-Generation In Vitro Diagnostic Instrument Interface, 2nd ed. (3 Jun 2026). https://clsi.org/shop/standards/auto16/
4. CLSI Insights. AUTO16: Next-Generation In Vitro Diagnostic Instrument Interface. https://clsi.org/resources/insights-blog/next-generation-in-vitro-diagnostic-instrument-interface-auto16/
5. IHE PaLM. Laboratory Analytical Workflow Supplement Rev 1.5 Final Text (2016). https://www.ihe.net/uploadedFiles/Documents/PaLM/IHE_PaLM_Suppl_LAW_Rev1.5_FT_2016-02-24.pdf
6. CLSI. AUTO10 Autoverification of Clinical Laboratory Test Results (preview). https://webstore.ansi.org/preview-pages/CLSI/preview_AUTO10-P.pdf
7. Croatian Society of Medical Biochemistry and Laboratory Medicine. National recommendations: implementation of autovalidation procedures (PMC). https://pmc.ncbi.nlm.nih.gov/articles/PMC11838716/
8. Data Innovations. Instrument Manager. https://www.datainnovations.com/product/instrument-manager/
9. Data Innovations. Autoverification module. https://datainnovations.com/autoverification/
10. Krasowski MD (University of Iowa). Autoverification in Clinical Chemistry (2014 talk). https://www.datainnovations.com/wp-content/uploads/2023/11/The-University-of-Iowa-Talks-Autoverification-in-Clinical-Chemistry.pdf
11. UKAS. ISO 15189:2022 – Guidance for accredited and applicant medical laboratories. https://www.ukas.com/resources/technical-bulletins/iso-151892022-guidance-for-accredited-and-applicant-medical-laboratories/
12. Standards Council of Canada. Transition to ISO 15189:2022 for accredited laboratories. https://scc-ccn.ca/accreditation/bulletins/transition-iso-151892022-accredited-laboratories-canada
13. College of American Pathologists. Critical Values – CAP Requirements (learning material, 2019). https://documents-cloud.cap.org/appsuite/learning/AP3/LMD/GoodLabDecisions/04_FrmtRsltRprts/story_content/external_files/Report%20Elements%20Part%202_2019_Proof.pdf
14. CAP TODAY. Critical result notifications at the point of care (Jan 2025). https://www.captodayonline.com/critical-result-notifications-at-the-point-of-care/
15. The Joint Commission. National Performance Goals Effective January 2026 for the Hospital Program (PDF). https://digitalassets.jointcommission.org/api/public/content/9ca80055182b4274842a5780a94f2c82
16. The Joint Commission. National Performance Goals. https://www.jointcommission.org/en-us/standards/national-performance-goals
17. The Joint Commission. National Patient Safety Goals Effective January 2026 for the Laboratory Program. https://digitalassets.jointcommission.org/api/public/content/3c7a110c215943bc80d9ce87e9d9ee9d?v=aef80e14
18. CAP. Electronic Cancer Protocols (eCP). https://www.cap.org/protocols-and-guidelines/electronic-cancer-protocols
19. CAP. Cancer Protocols Frequently Asked Questions. https://www.cap.org/protocols-and-guidelines/cancer-protocols/cancer-protocols-frequently-asked-questions/
20. CAP. CAP Cancer Protocol and eCC FAQ (PDF). https://documents.cap.org/protocols/cancer-protocol-ecc-frequently-asked-questions.pdf
21. CDC NPCR. Advancing Electronic Reporting. https://cdc.gov/national-program-cancer-registries/data-modernization/advancing-electronic-reporting.html
22. DICOM Standards Committee WG-26. Supplement 145: Whole Slide Microscopic Image IOD and SOP Classes. https://www.dicomstandard.org/News/ftsup/docs/sups/sup145.pdf
23. IHE PaLM. Digital Pathology Workflow – Image Acquisition (DPIA) Supplement. https://www.ihe.net/uploadedFiles/Documents/PaLM/IHE_PaLM_Suppl_DPIA.pdf
24. Maintaining and broadening DICOM adoption in digital pathology (PMC). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12616093/
25. Digital pathology imaging AI in cancer research and clinical trials: an NCI workshop report (PMC). https://pmc.ncbi.nlm.nih.gov/articles/PMC12753273/
26. Leica Biosystems. DICOM implementation using the Aperio GT 450 DX (white paper, Dec 2024). https://www.leicabiosystems.com/sites/default/files/media_product-download/2024-12/White_Paper_-_DICOM_3_DEC_2024_240796_Rev_B.pdf
27. U.S. FDA. Laboratory Developed Tests (status of 2024 final rule: vacated 31 Mar 2025; reverted 19 Sep 2025). https://www.fda.gov/medical-devices/in-vitro-diagnostics/laboratory-developed-tests
28. U.S. FDA CBER. 510(k) Blood Establishment Computer Software (index). https://www.fda.gov/vaccines-blood-biologics/substantially-equivalent-510k-device-information/510k-blood-establishment-computer-software
29. U.S. FDA CBER. 510(k) Blood Establishment Computer Software – 2025. https://www.fda.gov/vaccines-blood-biologics/substantially-equivalent-510k-device-information/510k-blood-establishment-computer-software-2025
30. U.S. FDA CBER. 510(k) Blood Establishment Computer Software – 2026. https://www.fda.gov/vaccines-blood-biologics/substantially-equivalent-510k-device-information/510k-blood-establishment-computer-software-2026
31. U.S. FDA CBER. 510(k) Blood Establishment Computer Software – 2021. https://www.fda.gov/vaccines-blood-biologics/substantially-equivalent-510k-device-information/510k-blood-establishment-computer-software-2021
32. Federal Register (18 May 2018). Classification of Blood Establishment Computer Software and Accessories. https://www.federalregister.gov/documents/2018/05/18/2018-10610/medical-devices-hematology-and-pathology-devices-classification-of-blood-establishment-computer
33. ICCBBA. ISBT 128 Technical Specification (ST-001 v6.2.2). https://iccbba.org/tech-spec/
34. ICCBBA. United States Industry Consensus Standard for the Uniform Labeling of Blood and Blood Components Using ISBT 128. https://iccbba.org/general-news/united-states-industry-consensus-standard-for-the-uniform-labeling-of-blood-and-blood-components-using-isbt-128/
35. Judd WJ. Requirements for the electronic crossmatch. Vox Sang 1998 (PubMed). https://pubmed.ncbi.nlm.nih.gov/9704475/
36. The Blood Project. Pathology Consultation on Electronic Crossmatch. https://www.thebloodproject.com/wp-content/uploads/2022/07/CROSSMATCH_2.pdf
37. SHOT. Annual SHOT Report 2024. https://www.shotuk.org/shot-reports/annual-shot-report-2024/
38. Murphy MF et al. (SHOT). Electronic identification systems reduce the number of wrong components transfused (Transfusion 2019; summary slides). https://www.shotuk.org/wp-content/uploads/2024/10/Electronic-identification-systems-reduce-the-number-of-wrong-components-transfused.pdf
39. A framework checklist for implementing bedside electronic transfusion systems (PMC). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12882753/
40. NEMA/DICOM. PS3.18 Web Services. https://dicom.nema.org/medical/dicom/current/output/html/part18.html
41. DICOM Standard. DICOMweb. https://www.dicomstandard.org/using/dicomweb
42. IHE International. Radiology (RAD) Domain publications (TF Rev 23.0; SWF.b, IID, REM, XDS-I.b, WIA, PWF; IRA, AIR, AIW-I, AIRA, MADO, EBIW). https://profiles.ihe.net/RAD/
43. IHE Radiology Technical Framework Volume 1. https://www.ihe.net/uploadedFiles/Documents/Radiology/IHE_RAD_TF_Vol1.pdf
44. IHE Radiology. Invoke Image Display (IID) Supplement. https://www.ihe.net/uploadedFiles/Documents/Radiology/IHE_RAD_Suppl_IID.pdf
45. IHE Radiology. Manifest-based Access to DICOM Objects (MADO) Supplement. https://www.ihe.net/uploadedFiles/Documents/Radiology/IHE_RAD_Suppl_MADO.pdf
46. IHE Radiology. AI Results (AIR) Supplement Rev 1.3 (2025). https://www.ihe.net/uploadedFiles/Documents/Radiology/IHE_RAD_Suppl_AIR.pdf
47. IHE Radiology. AI Workflow for Imaging (AIW-I) Supplement. https://www.ihe.net/uploadedFiles/Documents/Radiology/IHE_RAD_Suppl_AIW-I.pdf
48. Tejani AS et al. Integrating and Adopting AI in the Radiology Workflow: A Primer for Standards and IHE Profiles. Radiology 2024. https://pubs.rsna.org/doi/full/10.1148/radiol.232653
49. ACR Actionable Reporting Work Group. Actionable Findings and the Role of IT Support. JACR 2014. https://www.jacr.org/article/S1546-1440(13)00840-5/fulltext
50. eCQI Resource Center. CMS1074v3 eCQM Flow – Excessive Radiation Dose or Inadequate Image Quality for Diagnostic CT. https://ecqi.healthit.gov/sites/default/files/ecqm/measures/CMS1074-v3.3.000-eCQM-Flow.pdf
51. American College of Radiology. CMS Proposes to Keep Excessive Radiation Dose eCQM Voluntary. https://www.acr.org/News-and-Publications/cms-proposes-to-keep-excessive-radiation-dose-ecqm-voluntary
52. AJR. The New CMS Measure of Excessive Radiation Dose or Inadequate Image Quality in CT: Issues and Ambiguities (AAPM panel). https://ajronline.org/doi/10.2214/AJR.24.32458
53. CMS. Appropriate Use Criteria Program (paused; regulations rescinded effective 1 Jan 2024). https://www.cms.gov/medicare/quality/appropriate-use-criteria-program
54. U.S. FDA. Mammography Quality Standards Act and Program. https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-mqsa-and-mqsa-program
55. Sectra. Best in KLAS 2026 press release. https://sectra.com/news-and-press-releases/news-item/B599EE593A44BC19/
56. Radiology Business. Sectra, Agfa, Infinitt and other notable radiology vendors among the 2026 Best in KLAS. https://radiologybusiness.com/topics/health-it/enterprise-imaging/sectra-agfa-infinitt-and-other-notable-radiology-names-among-2026-best-klas
57. U.S. FDA. Artificial Intelligence-Enabled Medical Devices (list). https://www.fda.gov/medical-devices/artificial-intelligence-enabled-medical-devices/list-artificial-intelligence-enabled-medical-devices
58. CMS. E-Prescribing. https://www.cms.gov/medicare/regulations-guidance/electronic-prescribing
59. Federal Register (17 Jun 2024). Medicare Part D: Health Information Technology Standards and Implementation Specifications (CMS-4205-F2). https://www.federalregister.gov/documents/2024/06/17/2024-12842/medicare-program-medicare-prescription-drug-benefit-program-health-information-technology-standards
60. NCPDP. CMS Names NCPDP ePrescribing Standards in Final Rule. https://www.ncpdp.org/Resources/CMS-Names-NCPDP-ePrescribing-Standards-in-Final-Ru
61. NHS Business Services Authority. Dictionary of Medicines and Devices (dm+d). https://www.nhsbsa.nhs.uk/pharmacies-gp-practices-and-appliance-contractors/dictionary-medicines-and-devices-dmd
62. Wolters Kluwer. USP <797>: Translating low, medium, and high-risk compounding into categories. https://www.wolterskluwer.com/en/expert-insights/usp-797-translating-low-medium-and-high-risk-compounding-into-categories
63. ISMP. Guidelines for the Safe Use of Automated Dispensing Cabinets (2019). https://www.ismp.org/system/files/resources/2019-11/ISMP170-ADC%20Guideline-020719_final.pdf
64. ISMP. Targeted Medication Safety Best Practices for Hospitals 2026–2027. https://online.ecri.org/hubfs/ISMP/Resources/ISMP_TargetedMedicationSafetyBestPractices_Hospitals.pdf
65. ASHP. Guidelines on the Safe Use of Automated Dispensing Devices (2021). https://www.ashp.org/-/media/assets/policy-guidelines/docs/guidelines/safe-use-of-automated-dispensing-devices.ashx
66. ASHP News. National Survey: Hospitals Deploy Technology and Tap Pharmacy Technicians to Improve Safety (May 2024). https://news.ashp.org/news/ashp-news/2024/05/28/national-survey-hospitals-deploy-technology-and-tap-pharmacy-technicians-to-improve-safety
67. ASHP. Intravenous Workflow Management Systems (IVWMS) Implementation Checklist. https://www.ashp.org/-/media/assets/pharmacy-practice/resource-centers/compounding/docs/IV-Workflow-Implementation-Checklist.pdf
68. Pedersen CA et al. ASHP national survey of pharmacy practice in hospital settings: Dispensing and administration—2020. AJHP 2021. https://doi.org/10.1093/ajhp/zxab120
69. Reece KM et al. Implementation and evaluation of a gravimetric IV workflow software system in an oncology ambulatory care pharmacy. https://www.researchgate.net/publication/291422591_Implementation_and_evaluation_of_a_gravimetric_iv_workflow_software_system_in_an_oncology_ambulatory_care_pharmacy
70. FDB. FDB Launches Gravimetric Content (30 Apr 2026). https://www.fdbhealth.com/about-us/press-releases/2026-04-30-fdb-launches-gravimetric-content
71. Baxter. DoseEdge Pharmacy Workflow Manager case study (2024). https://rxinsider.com/wp-content/uploads/2025/04/Baxter_CaseStudy_2024-1.pdf
72. Knight T et al. Detecting drug diversion in health-system data using machine learning and advanced analytics. AJHP 2022 (PMC). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9353695/
73. Bluesight. Drug Diversion Monitoring in Hospitals: The Complete Guide. https://bluesight.com/news/drug-diversion-monitoring/
74. Pharmacy Times. Hospitals Can Leverage Data From Second-Generation Technology for More Effective Drug Diversion Prevention. https://www.pharmacytimes.com/view/hospitals-can-leverage-data-from-second-generation-technology-for-more-effective-drug-diversion-prevention
75. Evaluating the Impact of Smart Infusion Pump Interoperability on Reducing Medication Administration Errors: A Systematic Literature Review (2025, PMC). https://pmc.ncbi.nlm.nih.gov/articles/PMC12009041/
76. Skog J et al. The Impact of Smart Pump Interoperability on Errors in IV Infusion Administrations: A Multihospital Before and After Study. J Patient Saf 2022. https://www.researchgate.net/publication/357370442_The_Impact_of_Smart_Pump_Interoperability_on_Errors_in_Intravenous_Infusion_Administrations_A_Multihospital_Before_and_After_Study
77. Integration of smart infusion pumps with electronic medical records improves safety and staff productivity at a large academic healthcare system. Am J Health-Syst Pharm, June 2026 (PubMed 42364102; abstract verified via Europe PMC in pass 2). https://pubmed.ncbi.nlm.nih.gov/42364102/
78. Maximizing the impact of smart pump–EHR interoperability in critical care (2024). https://www.sciencedirect.com/science/article/abs/pii/S0964339724001940
79. Poon EG et al. Effect of Bar-Code Technology on the Safety of Medication Administration. NEJM 2010. https://www.nejm.org/doi/full/10.1056/NEJMsa0907115
80. IHE International. Devices (DEV) Domain publications (TF Rev 10.0; DEC, ACM, PIV, IPEC, IDCO, RTM; supplements MEMDMC, MEMLS, PCIM, SDPi). https://profiles.ihe.net/DEV/
81. IHE Devices Technical Framework Volume 1. https://www.ihe.net/uploadedFiles/Documents/DEV/IHE_DEV_TF_Vol1.pdf
82. ISO. ISO/IEEE 11073-10700:2024 – SDC base requirements. https://www.iso.org/standard/88167.html
83. ISO. ISO/IEEE 11073-10701:2024 – SDC metric provisioning. https://www.iso.org/standard/88168.html
84. U.S. FDA. Recognized Consensus Standard: IEEE 11073-10700-2022. https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfstandards/detail.cfm?standard__identification_no=45421
85. Dräger. SDC – Service-oriented Device Connectivity. https://www.draeger.com/en_seeur/Hospital/Interoperability-with-IEEE-11073-SDC
86. U.S. FDA. Cybersecurity (Medical Devices) – incl. final guidance of 27 Jun 2025. https://www.fda.gov/medical-devices/digital-health-center-excellence/cybersecurity
87. ECRI. Examining the Greatest Health Technology Threats of 2026. https://home.ecri.org/blogs/ecri-news/examining-the-greatest-health-technology-threats-of-2026
88. CDC NHSN. Antimicrobial Use and Resistance (AUR) Module. https://www.cdc.gov/nhsn/psc/aur/index.html
89. The Leapfrog Group. Bar Code Medication Administration (now redirects to the Safe Medication Administration measure). https://www.leapfroggroup.org/ratings-reports/bar-code-medication-administration
90. Clinisys. Recognized LIS Market Leadership (incl. Orchard acquisition, Signify share). https://www.clinisys.com/int/en/news/clinisys-recognized-as-lis-market-leadership/
91. CAP TODAY. LIS niche modules flourish amid IT consolidation. https://www.captodayonline.com/lis-niche-modules-flourish-amid-consolidation/
92. Designing and validating an autoverification system of biochemical test results, Hatay Mustafa Kemal University (PMC). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9344865/
93. SHOT. Near Miss – Wrong Blood in Tube (WBIT) 2023 chapter. https://www.shotuk.org/wp-content/uploads/2024/10/13a.-Near-Miss-%E2%80%93-Wrong-Blood-in-Tube-WBIT-2023.pdf
94. IVD Industry Connectivity Consortium. IHE LAW final text published (2016). https://ivdconnectivity.org/2016/03/11/iicc-ihe-law-final-text-published/
95. SHOT. Annual SHOT Report 2024 (full PDF; v1.2 now current at https://www.shotuk.org/wp-content/uploads/2025/09/ANNUAL-SHOT-REPORT-2024-V1.2.pdf). https://www.shotuk.org/wp-content/uploads/2025/07/ANNUAL-SHOT-REPORT-2024-V1.1.pdf
96. Clinisys. History of Clinisys (source of the "~24% global market share" claim, citing Signify Research, *Laboratory Information Systems – World, 2025*). https://www.clinisys.com/int/en/history/
97. U.S. FDA. Exemptions under the Drug Supply Chain Security Act (small-dispenser exemptions until 27 Nov 2027), and the FDA exemption letter dated 6 Aug 2026. https://www.fda.gov/drugs/drug-supply-chain-security-act-dscsa/exemptions-under-drug-supply-chain-security-act ; https://www.fda.gov/media/194424/download
98. Regulation (EU) 2024/1938 on substances of human origin (EUR-Lex), and Commission Implementing Regulation (EU) 2025/1467 ("As Regulation (EU) 2024/1938 applies from 7 August 2027..."). The application date and repealed directives were confirmed in pass 2 from search results quoting EUR-Lex and the European Blood Alliance; the EUR-Lex pages did not render through the fetch tool. https://eur-lex.europa.eu/eli/reg/2024/1938/oj/eng ; https://eur-lex.europa.eu/eli/reg_impl/2025/1467/oj/eng
99. U.S. FDA. Cybersecurity in Medical Devices: Quality Management System Considerations and Content of Premarket Submissions (final guidance, Feb 2026; supersedes 27 Jun 2025 version; docket FDA-2021-D-1158). https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-medical-devices-quality-management-system-considerations-and-content-premarket
100. CDC NHSN. FAQs: CMS Promoting Interoperability Program and AUR reporting (AUR required from the CY2024 EHR reporting period; split into AU and AR measures from 2025). https://www.cdc.gov/nhsn/cms/cms-faq-aur.html
101. Federal Register (25 Nov 2025). CY 2026 OPPS/ASC final rule, FR Doc 2025-20907, which keeps the Excessive Radiation eCQM voluntary in Hospital OQR. Also eCQI Resource Center, Required and Voluntary eCQM Updates for the CY 2026 Hospital OQR Reporting Period. https://www.federalregister.gov/documents/2025/11/25/2025-20907/medicare-program-hospital-outpatient-prospective-payment-and-ambulatory-surgical-center-payment ; https://ecqi.healthit.gov/required-and-voluntary-ecqm-updates-cy-2026-hospital-oqr-reporting-period
102. The Leapfrog Group. 2024 BCMA Fact Sheet (95% patient and medication scanning; 100% unit coverage; five decision-support elements), and the 2026 Safe Medication Administration measure page. https://ratings.leapfroggroup.org/sites/default/files/2024-03/2024%20BCMA%20Fact%20Sheet.pdf ; https://ratings.leapfroggroup.org/measure/hospital/2026/safe-medication-administration
103. U.S. FDA. Product Classification database, product code MMH (21 CFR 864.9165, Class 2, 510(k), CBER). https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=MMH
104. IAS. Transition Policy for ISO 15189:2022 (transition 2022-12-06 to 2025-12-31). See also the SCC [12] and the ILAC resolution as summarised by accreditation bodies; seen via search results in pass 2. https://www.iasonline.org/wp-content/uploads/2023/09/IAS-Transition-Policy-on-ISO-151892022-Final-2023-09-12.pdf
105. SHOT. Annual SHOT Report 2024, Chapter 3: Headline Data – Deaths, Major Morbidity and ABO-Incompatible Transfusions. https://www.shotuk.org/wp-content/uploads/2025/07/3.-Headline-Data-Deaths-Major-Morbidity-and-ABO-Incompatible-Transfusions-2024.pdf
106. SHOT. Key Insights from the 2024 Annual SHOT Report Chapters. https://www.shotuk.org/wp-content/uploads/2025/07/Key-Insights-from-the-2024-Annual-SHOT-Report-Chapters.pdf
107. Murphy MF, Addison J, Poles D, Dhiman P, Bolton-Maggs P. Electronic identification systems reduce the number of wrong components transfused. Transfusion 2019;59(12):3601–3607 (abstract via Europe PMC). https://europepmc.org/search?query=%22Electronic%20identification%20systems%20reduce%20the%20number%20of%20wrong%20components%20transfused%22
108. ICCBBA. ISBT 128 Standard Technical Specification v6.2.2, April 2023, ST-001 (title page and licence notice). https://iccbba.org/wp-content/uploads/2025/08/1a7593_1d979d39efc64822a9880496c2ebe4ef.pdf
109. Companion reports used in the 2026-10-16 reconciliation: `01` §12.2, `03` §2 (rows 20–25) and §21.1–21.2, `07` §9.1 #7 and §9.4 (Regulated Modules track; v1 integrate transfusion products); see `RECONCILIATION-LOG.md`.

---

## Verification log (pass 2, 2026-10-16)

| Claim | Verdict | Source | Note |
|---|---|---|---|
| CLSI AUTO16 2nd ed. published 3 Jun 2026, listed as free | Confirmed | [3] | It replaces AUTO16-Ed1 (2019). CLSI page shows "Free". |
| AUTO16 "succeeds" LIS01/LIS02 | Corrected | [4] | CLSI says LAW/AUTO16 adds capabilities beyond LIS01/LIS02 and highlights the differences. It does not say LIS01/LIS02 are replaced. Wording softened. |
| ISO 15189 transition closed 6 Dec 2025; ISO 22870 POCT folded in and withdrawn | Confirmed (nuanced) | [12][104] | The ILAC 3-year transition ended 6 Dec 2025. Some ABs (IAS, AC Diagnostics) used 31 Dec 2025. ISO 22870 POCT requirements are incorporated and 22870 is withdrawn. |
| Joint Commission NPG IDs: 01.01.01, 01.02.01, 01.05.01, 10.01.01/10.02.01, 13.02–13.04, 14.01–14.06 | Confirmed | [15] (PDF text extracted) | The NPG.14.01.01 phrase "A 100% review of overrides is not required" is verbatim. NPG.13.04.01 covers dose-index exceedances vs external benchmarks and MRI thermal/ferromagnetic incidents. |
| LDT rule vacated 31 Mar 2025; FDA reverted text 19 Sep 2025 | Confirmed | [27] | FDA LDT page. |
| BECS = Class II, 510(k), product code MMH, 21 CFR 864.9165 | Confirmed | [103] | FDA product classification: CBER, Hematology panel. |
| 2025 BECS clearances: SafeTrace Tx 5.0.0, ImmuLINK 3.3, MAK-SYSTEM PHS v11 | Confirmed | [29] | Added BK numbers and dates (10 Sep, 24 Oct, 11 Jun 2025). BioLife Lookback Notification System v2.0 was cleared 20 Feb 2025. |
| BioLife Donor Information System v9.0 cleared 11 Aug 2026 | Confirmed | [30] | BK251307. Also added Buoy Software Blood Product Questionnaire Module v2.0.0 (8 Jun 2026). |
| ISBT 128 ST-001 v6.2.2 (Apr 2023) is current; RT019/RT038 standalone tables supersede embedded ones | Confirmed | [33][108] | Title page says "Version 6.2.2, April 2023". The licence fee requirement is confirmed, so [K] was removed. |
| IG-002 v4 (Jan 2024) accepted by FDA CBER | Confirmed | [34] | CBER acceptance came via the April 2024 guidance. |
| SHOT 2024: errors 83.1%; WBIT 899/1,408 (63.8%) of near misses; 1 ABOi red-cell transfusion; 203 potential ABOi intercepted | Confirmed | [105][106] | 3,322/3,998 reports. There were also 3 ABOi plasma transfusions, which have been added. |
| SHOT EIS study: 93 hospitals, ~2M components; near-miss 452/1.57M vs 17/376k (OR 0.16) | Confirmed (partly) | [107], [38] | Hospital count and component count confirmed from the Transfusion 2019 abstract. Near-miss counts and the OR come from the SHOT slides [38] and are not in the abstract. |
| Sectra Best in KLAS US PACS 13th consecutive year (2026) "plus six regional Global PACS wins" | Corrected | [55] | Seven awards in total: US (13th consecutive year), Canada (7th), and **five** Global PACS regions. |
| IHE RAD TF Rev 23.0 (Aug 2025); IID added Aug 2025; WIA 2024; EBIW Jun 2025; AIR Aug 2025; AIRA Jun 2025; IRA 2023; AIW-I 2020 | Confirmed | [42] | IHE index: Rev 23.0 published 2025-08-08. MADO revision is dated 2026-09-03, now noted in the text. |
| IHE DEV TF Rev 10.0 (2024-11-04); PCIM and SDPi revised May 2026 | Confirmed | [80] | Both dated 2026-05-07. New supplement PCMC (published 2026-10-01) noted but not reviewed. |
| IHE PaLM DPIA revised 2026-03-06; SET TI 2021; TMA TI 2019 | Confirmed | [1] | PaLM TF Rev 11.0. No date shown on the index. |
| NCPDP SCRIPT 2023011 mandatory 1 Jan 2028; F&B v60 / RTPB v13 by 1 Jan 2027 | Confirmed | [58][60] | The transition began 17 Jul 2024. |
| FDA premarket cybersecurity guidance current version = 27 Jun 2025 | Corrected | [86][99] | Reissued Feb 2026 as "...Quality Management System Considerations...", superseding the 27 Jun 2025 version. Updated in exec summary, §6.7 and §9. |
| ECRI 2026 hazards: #2 digital darkness, #6 perioperative med-safety tech, #7 cleaning instructions, #8 legacy-device cyber, #9 unsafe-workflow designs, #10 sterilization water quality | Confirmed | [87] | #1 is misuse of AI chatbots, now noted in §6.7. |
| DSCSA: larger dispensers' exemption ended Nov 2025; small dispensers to Nov 2026 | Corrected | [97] | The small-dispenser exemption was extended to **27 Nov 2027** (FDA, 6 Aug 2026). Dispensers with 26 or more FTEs: 27 Nov 2025. |
| EU SoHO Regulation 2024/1938 applies from Aug 2027 | Confirmed | [98] | 7 Aug 2027. It repeals 2002/98/EC and 2004/23/EC. Confirmed via search results quoting EUR-Lex and Implementing Reg. 2025/1467; EUR-Lex itself did not render. |
| NHSN AUR is a Medicare PI requirement since CY2024 | Confirmed | [100] | From 2025 it is split into separate AU and AR Surveillance measures. |
| MQSA breast-density reporting effective Sep 2024 | Confirmed | [54] | FDA: facilities have been subject to all 2023 final-rule requirements since 10 Sep 2024. [K] removed. |
| CMS AUC rescinded effective 1 Jan 2024 | Confirmed | [53] | Rescinded via the CY2024 PFS final rule; regulations at 42 CFR 414.94. |
| CMS1074 (ExRad) 18 categories, v3 for 2026, voluntary (CMS proposed indefinite voluntary status) | Confirmed and updated | [50][51][101] | Eighteen CT categories counted in the eCQM flow. The CY2026 OPPS final rule (Nov 2025) **finalized** keeping OQR reporting voluntary. The OQR version is CMS1206v3. Future mandatory proposal is not verified. |
| CMS1074 "translation software... global noise" | Confirmed | [50] | The flow uses "Calculated CT Size-Adjusted Dose" and "Calculated CT Global Noise" thresholds. |
| Clinisys ~24% global LIS share (Signify 2025) cited to [90] | Corrected (citation) / Still unverified (independent) | [96], [90] | The 24% claim is on Clinisys's history page [96]. [90] cites Black Book instead. No independent Signify confirmation, so it is still a vendor claim. Orchard acquisition (Jul 2025) confirmed. |
| Data Innovations: >1,200 drivers; IM v8.14 end of life 1 Jan 2026 | Corrected | [8] | 1,200+ drivers confirmed. The page now says support for IM 08.17.32 and older ends **1 Jan 2027**, and features v9.01.00. The 8.14 claim is not on the current page. |
| ISMP 2026–2027 BP numbering (BP1 vinca, BP2 MTX, BP3 weight, BP8 DERS >95% monthly + bidirectional interop, BP11 IVWMS, BP15 opioid, BP16 ADC override, BP18 BCMA beyond inpatient, BP20 TXA, BP21 med rec, BP24 scanning, BP25 safety culture) | Confirmed | [64] (PDF text extracted) | Wording matches. The BP18 area list matches the text. |
| Poon NEJM 2010: ~41% fewer non-timing errors, ~51% fewer potential ADEs [K] | Confirmed | [79] (abstract via Europe PMC) | 41.4% and 50.8%. Also timing errors −27.3%, and transcription errors eliminated. [K] removed. |
| Leapfrog ≥95% BCMA scanning compliance [K] | Confirmed | [102] | 95% patient and medication scanning; 100% unit coverage; five decision-support elements. The 2026 measure is renamed "Safe Medication Administration". |
| Smart-pump SR 2025: 15.4–54.8% reductions | Confirmed | [75] | Medical Devices (Auckland) 2025;18:247–260. |
| 2026 study: autoprogramming 53.4% (68.3% HAM/REMS); DERS 96.1%; steps 3.3→1.6 | Confirmed | [77] | AJHP, June 2026. Alert resolution was 46.3%/55.0% faster. |
| FDA recognized IEEE 11073-10700-2022 in May 2024, noting conformance alone does not establish safety | Confirmed (wording refined) | [84] | Recognized 29 May 2024 (no. 13-138). FDA text: "not sufficient to demonstrate safety, effectiveness, and security". |
| FDB gravimetric content (Apr 2026); AJHP >40% vs <1% | Confirmed | [70] | FDB Gravimetric Drug Density Module, 30 Apr 2026. The AJHP figure is quoted in a vendor release, so it is flagged as such. |
| Bluesight Best in KLAS 2025, >2,000 hospitals | Confirmed (vendor claim) | [73] | Five-time Best in KLAS for Drug Diversion Monitoring; 2,000+ hospitals in the US and Canada. |
| 86% decentralized automated distribution (2023) vs 97% ADC use (2014): apparent inconsistency | Corrected (clarified) | [66][68] | These are different metrics: 86% decentralized distribution (2023); 74.5% ADC as primary method (2020); about 97% any ADC use (2014, still unverified). |
| ~21% of US hospitals used sterile workflow technology in 2020 | Confirmed and updated | [68], [66] | 21.3% in 2020. ASHP 2023: nearly two-thirds use some sterile-prep verification technology (a broader metric). Search snippet only; the ASHP page returned 403. |
| USP <797> Category 2 BUD "about 4 to 90 days" | Corrected (analyst knowledge) | [62] not retrievable | The BUD tables run from 1 day (aseptic, nonsterile starting components, room temperature) to 90 days (terminally sterilized, sterility tested, frozen). Flagged [K]; verify against official USP text. |
| FDA AI-enabled device list decisions through 29 Jun 2026 | Confirmed | [57] | The radiology share (~80%) is still an estimate. A full tally was not done. |
| CLIA retention (2 y / 10 y / 5 y); 21 CFR 606.160 10-year retention; AABB e-crossmatch wording; FDA "220 BECS 510(k)s 1996–2015" | Still unverified | — | eCFR and Federal Register redirected to a bot check. These keep their [K] / original citation. |
