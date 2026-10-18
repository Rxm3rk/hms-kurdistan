# Glossary — Hospital Information Systems

Acronyms and terms used across the research pack (alphabetical).

| Term | Meaning |
|---|---|
| **ABAC** | Attribute-Based Access Control — access decisions from attributes (role, location, care relationship, data sensitivity labels, consent). |
| **ABDM** | Ayushman Bharat Digital Mission (India) — national digital health stack: ABHA IDs, facility/professional registries, consent-based health information exchange. |
| **ABHA** | Ayushman Bharat Health Account — India's 14-digit health ID. |
| **ACK** | HL7 v2 acknowledgement message. |
| **ADC** | Automated Dispensing Cabinet (e.g., BD Pyxis, Omnicell) on wards. |
| **ADT** | Admission, Discharge, Transfer — patient movement events and the HL7 v2 message family (A01 admit, A02 transfer, A03 discharge, A04 register, A08 update, A40 merge…). |
| **AIMS** | Anaesthesia Information Management System. |
| **ALOS** | Average Length of Stay. |
| **AMAM** | HIMSS Analytics Maturity Assessment Model. |
| **APACHE / SOFA** | ICU severity-of-illness scoring systems. |
| **AQL** | Archetype Query Language (openEHR). |
| **AR days** | Accounts-receivable days — average days to collect revenue. |
| **AR-DRG** | Australian Refined DRG classification (also used in parts of the Gulf). |
| **ASTM E1381/E1394 (LIS1/LIS2)** | Legacy lab-instrument communication standards (now CLSI LIS1-A / LIS2-A2). |
| **ATC** | WHO Anatomical Therapeutic Chemical drug classification. |
| **ATNA** | IHE Audit Trail and Node Authentication profile. |
| **BALP** | IHE Basic Audit Log Patterns (FHIR AuditEvent profiles). |
| **BCA** | Epic's Business Continuity Access — read-only downtime copies/reports. |
| **BCMA** | Barcode Medication Administration. |
| **BPMN** | Business Process Model and Notation (workflow modelling). |
| **Break-the-glass** | Emergency override granting access to restricted records, with mandatory reason and after-the-fact review. |
| **Bulk Data / Flat FHIR** | FHIR `$export` for population-level data extraction (NDJSON). |
| **C-CDA** | Consolidated Clinical Document Architecture (US document templates on HL7 CDA R2). |
| **CAP / CLIA** | College of American Pathologists accreditation / US Clinical Laboratory Improvement Amendments. |
| **CBAHI** | Saudi Central Board for Accreditation of Healthcare Institutions. |
| **CCHI** | Council of Health Insurance (Saudi Arabia). |
| **CDA** | HL7 Clinical Document Architecture. |
| **CDI** | Clinical Documentation Integrity/Improvement (ensures documentation supports coding). |
| **CDM** | Charge Description Master (chargemaster) — catalogue of billable items and prices. |
| **CDS** | Clinical Decision Support. |
| **CDS Hooks** | HL7 standard for invoking external CDS services at workflow points (patient-view, order-select, order-sign…). |
| **CHAI** | Coalition for Health AI. |
| **CMIO / CNIO** | Chief Medical / Nursing Information Officer. |
| **CMS** | US Centers for Medicare & Medicaid Services. |
| **Community Connect** | Epic's model letting a licensed health system extend its Epic instance to affiliated hospitals/clinics. |
| **CPOE** | Computerised Provider (Physician) Order Entry. |
| **CPT / HCPCS** | US procedure/service codes (AMA-licensed CPT; CMS HCPCS Level II). |
| **CQL** | Clinical Quality Language (HL7) — logic for CDS and quality measures. |
| **CQRS** | Command–Query Responsibility Segregation (separate write and read models). |
| **CSSD / SPD** | Central Sterile Services Department / Sterile Processing Department. |
| **DCB0129 / DCB0160** | NHS England clinical risk management standards for manufacturers / deploying organisations. |
| **DEC** | IHE PCD Device Enterprise Communication (device data to EHR). |
| **DFT** | HL7 v2 Detailed Financial Transaction (charges). |
| **DICOM / DICOMweb** | Imaging standard / its RESTful web services (QIDO-RS search, WADO-RS retrieve, STOW-RS store). |
| **DNFB** | Discharged Not Final Billed (RCM backlog metric). |
| **DPDP** | India's Digital Personal Data Protection Act 2023 (+ Rules 2025). |
| **DRG** | Diagnosis-Related Group — case-mix classification for per-case payment (MS-DRG, APR-DRG, G-DRG, AR-DRG, NordDRG, HRG…). |
| **DSI** | Decision Support Intervention (ONC HTI-1 term, incl. predictive DSIs with transparency "source attributes"). |
| **DSPT** | NHS Data Security and Protection Toolkit. |
| **DTAC** | NHS Digital Technology Assessment Criteria. |
| **eCQM** | Electronic Clinical Quality Measure. |
| **EHDS** | European Health Data Space Regulation. |
| **EHI export** | ONC criterion requiring export of all Electronic Health Information. |
| **EHR / EMR / HIS / HMS** | Electronic Health Record / Electronic Medical Record / Hospital Information System / Hospital Management System (HMS commonly implies EHR + administrative/ERP modules). |
| **eMAR** | Electronic Medication Administration Record. |
| **EMPI / MPI** | (Enterprise) Master Patient Index — patient identity matching and linking. |
| **EMRAM** | HIMSS Electronic Medical Record Adoption Model (Stages 0–7). |
| **ESI / MTS / CTAS / ATS** | ED triage scales: Emergency Severity Index (US), Manchester Triage System (UK/EU), Canadian Triage and Acuity Scale, Australasian Triage Scale. |
| **EVS** | Environmental Services (housekeeping). |
| **FEFO** | First-Expired, First-Out inventory rule. |
| **FHIR** | HL7 Fast Healthcare Interoperability Resources (R4 = 4.0.1, R4B, R5 = 5.0.0, R6 in development). |
| **FHIRcast** | HL7 standard to synchronise context (patient/study) across apps. |
| **Flowsheet** | Grid-style documentation of time-series observations (vitals, I&O, assessments). |
| **G-DRG / InEK** | German DRG system / its institute. |
| **GS1 / GTIN** | Global supply-chain standards / Global Trade Item Number (product barcode). |
| **HFR / HPR** | India Health Facility Registry / Healthcare Professionals Registry. |
| **HIE** | Health Information Exchange. |
| **HIMSS** | Healthcare Information and Management Systems Society. |
| **HIPAA** | US Health Insurance Portability and Accountability Act (Privacy, Security, Breach rules). |
| **HL7 v2** | Pipe-delimited messaging standard dominant for in-hospital interfaces. |
| **HPPD** | Nursing Hours Per Patient Day. |
| **HRG** | Healthcare Resource Group (England's case-mix system). |
| **HTI-1/2/4…** | ONC/ASTP "Health Data, Technology, and Interoperability" rules. |
| **I-PASS** | Structured handoff mnemonic (Illness severity, Patient summary, Action list, Situation awareness, Synthesis). |
| **ICD-10 / ICD-11** | WHO International Classification of Diseases (national modifications: ICD-10-CM/PCS US, ICD-10-AM Australia, ICD-10-GM Germany, ICD-10-CA Canada). |
| **IEC 62304** | Medical device software lifecycle standard. |
| **IEEE 11073 / SDC** | Point-of-care medical device communication standards / Service-oriented Device Connectivity. |
| **IHE** | Integrating the Healthcare Enterprise — publishes integration profiles (XDS, PIX/PDQ, SWF, LAW, PCD…). |
| **INFRAM** | HIMSS Infrastructure Adoption Model. |
| **IPS** | International Patient Summary (HL7 FHIR IG / ISO 27269). |
| **ISBT 128** | Global standard for labelling blood, cells, tissues. |
| **ISO 15189** | Medical laboratory quality & competence standard. |
| **JCI** | Joint Commission International (hospital accreditation outside the US). |
| **KLAS** | KLAS Research — healthcare IT vendor performance ratings ("Best in KLAS"). |
| **LIS / LIMS** | Laboratory Information (Management) System. |
| **LOINC** | Logical Observation Identifiers Names and Codes (lab tests, observations, documents). |
| **LWBS** | Left Without Being Seen (ED metric). |
| **MAR** | Medication Administration Record. |
| **MDI** | Medical Device Integration. |
| **MDR (EU)** | EU Medical Device Regulation 2017/745 (Rule 11 for software). |
| **MLLP** | Minimal Lower Layer Protocol — TCP framing for HL7 v2. |
| **MPPS / MWL** | DICOM Modality Performed Procedure Step / Modality Worklist. |
| **MyChart** | Epic's patient portal/app. |
| **NABH / NABL** | India's hospital / laboratory accreditation boards. |
| **NCPDP SCRIPT** | US e-prescribing standard. |
| **NEWS2 / PEWS / MEOWS** | Early warning scores (adult / paediatric / obstetric). |
| **NHCX** | India National Health Claims Exchange (FHIR-based). |
| **NPHIES** | Saudi national platform for health insurance exchange (FHIR-based). |
| **NPSG** | Joint Commission National Patient Safety Goals. |
| **OMOP CDM** | OHDSI Observational Medical Outcomes Partnership Common Data Model (research). |
| **ONC / ASTP** | US Office of the National Coordinator for Health IT (renamed Assistant Secretary for Technology Policy/ONC in 2024). |
| **openEHR** | Open specification for EHR persistence using a reference model + archetypes/templates. |
| **ORU / ORM / OML** | HL7 v2 observation result / order messages. |
| **PACS / VNA** | Picture Archiving and Communication System / Vendor Neutral Archive. |
| **PCCP** | FDA Predetermined Change Control Plan (for AI device updates). |
| **PIX / PDQ / PMIR** | IHE patient identifier cross-referencing / demographics query / identity management profiles. |
| **PM-JAY** | Pradhan Mantri Jan Arogya Yojana (India's public health insurance scheme). |
| **POA** | Present on Admission indicator (US coding). |
| **POCT** | Point-of-Care Testing. |
| **PROMs / PREMs** | Patient-Reported Outcome / Experience Measures. |
| **QHIN** | Qualified Health Information Network (US TEFCA). |
| **RBAC** | Role-Based Access Control. |
| **RCM** | Revenue Cycle Management. |
| **RIS** | Radiology Information System. |
| **RPO / RTO** | Recovery Point Objective (max data loss) / Recovery Time Objective (max downtime). |
| **RTLS** | Real-Time Location System. |
| **RxNorm / dm+d** | US / UK standard drug terminologies. |
| **SaMD** | Software as a Medical Device. |
| **SAFER Guides** | ONC Safety Assurance Factors for EHR Resilience self-assessment guides. |
| **SMART on FHIR** | OAuth2-based app launch and authorisation framework on FHIR. |
| **SNOMED CT** | Comprehensive clinical terminology (licensed via SNOMED International / national release centres). |
| **SOC 2** | AICPA service-organisation security attestation. |
| **SUS** | System Usability Scale (0–100). |
| **TEFCA** | US Trusted Exchange Framework and Common Agreement. |
| **TPA** | Third-Party Administrator (insurance claims processing; common in India/Middle East). |
| **UCUM** | Unified Code for Units of Measure. |
| **UDI** | Unique Device Identifier (DI + PI). |
| **USCDI** | US Core Data for Interoperability. |
| **X12 270/271, 278, 837, 835** | US EDI transactions: eligibility, prior auth, claims, remittance. |
| **XDS / XCA / MHD** | IHE cross-enterprise document sharing / cross-community access / mobile health documents. |
