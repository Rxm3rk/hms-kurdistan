# 06: Interoperability Standards, Terminologies and National Health Data Exchange Mandates

> Track: interoperability standards, terminologies, and national data-exchange mandates (research only, no code).
> Status date: 2026-10-16. Companion documents: `11-canonical-domain-model.md` (internal model), `04-diagnostics-pharmacy-devices.md`, `05-revenue-cycle-erp-operations.md`, `08-architecture-and-technology.md`.
> Audience: product, architecture, regulatory and go-to-market leads.

---

## 0. How to read this document

**Evidence labels.** Every non-trivial claim carries a label:

- **[V]**: verified in this session against a primary or official source (HL7, ASTP/ONC, CMS, EUR-Lex/European Commission material, gematik, ANS, legislation.gov.uk, SNOMED International, WHO, Infoway, NPHIES, Malaffi, Synapxe, and so on).
- **[S]**: verified only against a reputable secondary source (law firm, trade press, peer-reviewed article, integrator or vendor blog). Probably right, but confirm it.
- **[K]**: background knowledge that was **not** re-verified this session. Confirm before relying on it contractually, in regulatory filings, or in pricing.

**Method and limits.** This session ran about 25 web searches before the shared search quota ran out. After that, verification relied on about 65 direct fetches of primary sources, plus text extraction from two PDFs: the EHDS briefing deck of September 2026 and the WHO ICD-11 fact sheet of May 2026. Several official portals refused automated access: digital.nhs.uk (403), NRCeS/ABDM sandbox (connection refused), loinc.org (403) and chi.gov.sa (refused). Those sections lean on secondary sources and are flagged. Section 9 consolidates the open questions.

**Pass 2 (2026-10-16).** A second fact-checking pass re-verified about 45 claims against primary sources. It used 8 web searches and about 60 direct fetches, including HL7 `package-list.json` files, the Federal Register API, CISA, Eclipse, gov.sg and EUR-Lex-derived briefings. Corrections and upgrades are made inline, new sources are numbered [102]–[122], and the results are tabulated in the verification log at the end of the document. In pass 2, "[S]" also marks official-domain content that was seen only through a search-index extract because direct fetches timed out (IHACPA, ADHA, AMA pricing, PIB).

---

## 1. Executive summary

1. **FHIR R4 (4.0.1) is the world's regulatory API baseline in 2026, and R6 is not published yet.** Every national implementation guide (IG) checked is built on R4: US Core 9.0.0, UK Core 2.0.1, AU Core 2.0.0, ABDM `ndhm.in` 6.5.0, NPHIES, SATUSEHAT, ISiK and JP Core 1.2.0 [7][62][72][65][67][78][54][77]. R5 (March 2023) is still "the current published version" on hl7.org, but regulators barely use it [4]. R6 is in normative balloting: ballot 4 (May 2026) was "the first full ballot" and ballot 5 (17 July 2026) "the second full ballot". The CI build moved to `6.0.0-snapshot1` on 15 October 2026 [1][2][3]. Final publication in 2027 is the realistic expectation, and national R6 IGs will follow later still [5][6]. **Build for R4 now, behind a façade that is independent of FHIR version.**
2. **HL7 v2 still runs the inside of every hospital.** It carries ADT, orders, results, charges, scheduling and pharmacy messages, and HL7 publishes a v2-to-FHIR mapping IG (1.0.0 STU1) [17]. An HMS without a strong v2/MLLP engine cannot be sold anywhere.
3. **The US is deregulating certification while pushing FHIR-first networks.** HTI-5 was proposed on 29 Dec 2025. It would remove 34 of 60 certification criteria, revise 7 and keep 19, including deleting all 13 privacy and security criteria and the Direct criteria (h)(1)/(h)(2) [30][32][33]. **(b)(10) EHI Export and (g)(10) Standardized API appear in neither the removal nor the revision list, so they would survive** (counts and lists confirmed against ASTP/ONC's own overview deck [100]). As of 16 Oct 2026 the final rule has **not** been published: the Federal Register shows only the proposed rule, the healthit.gov HTI-5 page lists no final rule, and the FY 2027 IPPS final rule (4 Aug 2026) says the HTI-5 final rule "will be issued after" it [30][102]. The Unified Agenda had targeted August 2026 [33]. HTI-4 (final, 31 Jul 2025) added FHIR ePA criteria (g)(31)–(33) and (j)(20)–(21) based on Da Vinci CRD/DTR/PAS, CDS Hooks and Subscriptions. It also moved e-prescribing to NCPDP SCRIPT 2023011, mandatory from 1 Jan 2028 [34][35].
4. **US network exchange now runs on two tracks.** TEFCA has 11 designated QHINs [41]. The voluntary CMS Interoperability Framework (July 2025) has "CMS Aligned Networks" in general availability since July 2026. It requires US Core FHIR APIs on USCDI v3+, documents as FHIR attachments, encounter notifications via FHIR Subscriptions, IAL2/AAL2 identity, and HITRUST-or-equivalent security [45][46][48][49].
5. **USCDI v6 was finalised in July 2025** [36][37], and **USCDI v7 was released on 23 Jul 2026** (30 new data elements plus one significantly revised, and two new data classes, Adverse Events and Healthcare Information Attributes) [105]. v7 has no SVAP or certification date yet. The 2026 SVAP round approved USCDI v6, US Core 9.0.0 and C-CDA 5.0.0 for voluntary certification from 29 Aug 2026. The regulatory baseline for (g)(10) is still USCDI v3, US Core 6.1.0, SMART 2.0.0 and Bulk Data 1.0 [38][39].
6. **The EU EHDS is product legislation that will bind us as a manufacturer.** It entered into force on 26 Mar 2025. Its key implementing acts are due by 26 Mar 2027; as of 22 Sep 2026 only 2 of the 9 key acts were published, and the EEHRxF specification and the EHR common specifications were still **pending** [50][51]. EHR systems must contain a *European interoperability software component* and a *European logging software component*, pass an automated test in an Article 40 digital testing environment, self-declare conformity, carry CE marking and register in the EU database. Obligations start on 26 Mar 2029 for patient summaries and ePrescription/eDispensation, and on 26 Mar 2031 for images, lab results and discharge reports [51].
7. **Germany and France have hard vendor gates today.** In Germany, ISiK Stufe 3 has been binding since 1 Jul 2025; Stufe 5 is published with its binding date not yet set, and Stufe 4 was withdrawn [54]. Use of the ePA ("ePA für alle") has been mandatory for all providers, including hospitals, since 1 Oct 2025 [V, 55]. Sanctions apply from 2026; for hospitals this means losing the Telematikzuschlag if TI requirements are unmet by 1 Apr 2026 [S, 56]. In France, Ségur "vague 2" DPI listing closed its last dossier window on 30 Jun 2026, and hospitals must deploy by 17 Mar 2027 [58][59].
8. **England has made information standards legally binding on IT suppliers.** Schedule 15 of the Data (Use and Access) Act 2025 came into force on 5 Feb 2026. It brings compliance notices, public censure and powers for an accreditation scheme [63].
9. **India's ABDM is the most "vendor-certifiable" national stack.** It is organised as milestones M1 (ABHA), M2 (Health Information Provider) and M3 (Health Information User), uses FHIR R4 NRCeS profiles, and exits the sandbox via NHA testing plus a security audit [66]. The NABH Digital Health Standards require M3 plus three Indian deployments [65]. DHIS incentives pay software companies 25% of what their facilities earn [65]. NHCX extends FHIR to claims [65].
10. **In the Gulf, connectivity is a licensing condition.** Saudi NPHIES runs FHIR R4 *messaging* for eligibility, prior authorisation, claims and payment (IG 1.0.0 STU, Dec 2025) [67]. The UAE has three regulator-run exchanges, all of which require EMR integration through approved vendors: Malaffi (Abu Dhabi, 3,144 facilities connected), NABIDH (Dubai, mandating HL7 v2/v3, CDA R2, FHIR R4 and IHE PIX/PDQ/XDS/XCA/MHD) and Riayati (MOHAP, under Ministerial Resolution 156/2021) [69][70][71].
11. **Australia and Canada are converging on national FHIR cores plus enforcement.** In Australia, "Sharing by Default" has been enforced since 1 Jul 2026 for pathology and diagnostic imaging reports, with medicines next [74][75], and My Health Record is moving from CDA to FHIR [73]. In Canada, CA Core+, the HALO SMART launch framework and a national conformance platform (Dec 2025) form a "certify once, connect many" model [83].
12. **Terminology licensing is a recurring cost and a market-entry issue.** SNOMED CT is free in its **54 member territories** but fee-bearing elsewhere. Italy, Japan, China, Brazil, Mexico, Kenya, Nigeria, Egypt, Oman, Kuwait, Bahrain and the Philippines are *not* on the member list [23][24][25]. The Global Patient Set is free under CC BY-ND 4.0 [26]. ICD-11 is free under CC BY-ND 3.0 IGO [28]. CPT needs an AMA licence for every product containing it, worldwide [119]. ICD-10-AM/ACHI is licensed by IHACPA: vendor fees apply, and country licences are signed government-to-government only [S, 118]. ICD-10-CA/CCI is licensed by CIHI [K].
13. **ICD-11 is real but still mainly used for mortality.** WHO reports 132 countries "at various stages of implementation" and 4 million API requests a day [28]. National ICD-10 modifications still drive hospital billing almost everywhere, and the US has no ICD-11 date [S, 97]. Support both in parallel.
14. **The International Patient Summary (IPS) is now the most reusable artefact across borders.** EN ISO 27269:2025 (17 Sep 2025) and HL7 IPS IG 2.0.0 (3 Oct 2025) were published within weeks of each other. An errata release, 2.0.1 (19 Jun 2026), is now the current published version [13][14][15][16][111]. Generating a conformant IPS from day one pays off in the EU, India, Australia, Canada and the US.
15. **The integration-engine and cloud-FHIR market is in flux.** Mirth Connect became commercial-only with 4.6 (19 Mar 2025); 4.5.2 is the last open-source release [85][86]. CISA advisory ICSMA-26-253-01 (10 Sep 2026) covers three CVEs in Mirth Connect ≤ 4.7.1, and the fix is commercial 4.7.2 [114]. Community forks now exist, and the Open Integration Engine fork is now an incubating Eclipse Foundation project [87][115]. Microsoft deprecated Azure API for FHIR on 30 Sep 2026 [88]. **Do not let any third-party engine or managed FHIR service become a hard dependency of the product.**

---

## 2. Standards catalog

| Standard | Owner | Current version (as of Oct 2026) | Use in hospital | Required or optional | Licensing |
|---|---|---|---|---|---|
| HL7 v2.x | HL7 International | Latest normative **2.9.1** (published Sep 2024; 2.9 was ANSI-approved Dec 2019) [S, 106]. Installed base is mostly 2.3 to 2.5.1 | ADT, orders, results, scheduling, charges, pharmacy, immunisation, master files | De facto required everywhere. Regulatory in US public health (2.5.1 IGs) [38] | Free (HL7 IP policy) [K] |
| HL7 v2-to-FHIR IG | HL7 | 1.0.0 STU1 (7 Oct 2025; based on v2.9, FHIR R4) [V, 17] | Mapping v2 feeds into a FHIR façade or repository | Optional | Free (CC0) |
| FHIR R4 / R4B / R5 | HL7 | 4.0.1 (2019, partly normative), 4.3.0 (2022), 5.0.0 (Mar 2023, "current published") [V, 4] | APIs, apps, national exchanges | R4 required in US/UK/AU/CA/IN/SA/ID/DE/JP | Free (CC0) |
| FHIR R6 | HL7 | Ballot 5 (17 Jul 2026), CI `6.0.0-snapshot1` (15 Oct 2026). Fully normative ballot [V, 1][2][3] | Future baseline; publication expected 2027 [S, 5][6] | Not yet | Free |
| US Core | HL7 US Realm | 9.0.0 (31 May 2026, enables USCDI v6). (g)(10) baseline 6.1.0. SVAP: 7.0.0, 8.0.1, 9.0.0 [V, 7][38][39] | US API conformance | Required for ONC (g)(10) and the CMS Framework | Free |
| SMART App Launch | HL7 | 2.2.0 (STU 2.2) [V, 8]. (g)(10) baseline 2.0.0, SVAP 2.2.0 (approved in the 2024 SVAP cycle) [V, 38][39] | App launch, OAuth scopes, backend services | Required in US. HALO (Canada) builds on it [83] | Free |
| Bulk Data Access | HL7 | 3.0.0 (STU3, 11 Dec 2025); 4.0.0 in ballot (Aug 2026). (g)(10) baseline 1.0.0, SVAP 2.0.0 [V, 9][39][112] | Population export, analytics, payer and registry feeds | Required in US (g)(10) | Free |
| CDS Hooks | HL7 | 2.0.1 (STU2). patient-view and order-sign mature [V, 10] | External CDS, payer coverage (CRD) | Required for HTI-4 (j)(20) ePA [V, 34] | Free |
| FHIRcast | HL7 | 3.0.0 (STU3) [V, 11] | Context sync (radiology reporting, viewers) | Optional | Free |
| Subscriptions R5 Backport | HL7 | 1.1.0 (Jan 2023); 1.2.0 only at ballot stage (Dec 2023) [V, 18] | Topic-based notifications on R4/R4B | HTI-4 (j)(21) and CMS Framework notifications [34][45] | Free |
| IPA | HL7 | 1.1.0 (STU1.1, 19 Mar 2025) [V, 12] | Minimal international patient-access API | Optional (good default outside the US) | Free |
| IPS | HL7 + ISO/CEN | IG 2.0.0 (STU2, 3 Oct 2025), now superseded by errata release 2.0.1 (19 Jun 2026, current). ISO 27269:2025 [V, 13][14][15][111] | Patient summary, cross-border, discharge | EHDS Group 1 (via EEHRxF), many national programmes | Free |
| SDC / Questionnaire | HL7 | SDC **4.0.0** (STU4, 24 Mar 2026, current); 3.0.0 (2022) is the previous STU [V, 107] | Forms, assessments, payer DTR | Required in US ePA (DTR) [34] | Free |
| CQL / Clinical Reasoning | HL7 | CQL 1.5.x normative [K]; **CQL 2.0.0** (R2 STU1, trial use, active 29 Jul 2026) is now the current publication, and its normative elements stay normative [V, 108] | Quality measures, CDS, DTR logic | US eCQM/dQM, ePA | Free |
| Da Vinci (CRD, DTR, PAS, PDex, CDex) | HL7 Da Vinci | Versions referenced by HTI-4 [S, 34][91] | Prior authorisation, payer exchange | US (CMS-0057-F, HTI-4) | Free |
| CDA R2 / C-CDA | HL7 | C-CDA 5.0.0 (STU5, active 13 Jun 2026) [V, 19] | Discharge and referral documents | US (b)(1) (revised in HTI-5) [32]. Legacy national document exchanges | Free |
| IHE ITI (PIX/PDQ, XDS.b, XCA, XCPD, ATNA, MHD, PIXm/PDQm, PMIR, mCSD, BALP, PCF, IUA) | IHE International | Technical Framework, rolling [K, 90] | Identity, document sharing, audit, consent | Required by many HIEs (NABIDH, TEFCA, ePA DE, DMP FR, eHDSI) [69][43] | Free |
| DICOM / DICOMweb | NEMA/MITA (DICOM SC) | Republished several times a year (PS3.1–3.22) [V, 20] | Imaging storage, worklists, viewing, web APIs | Required for imaging | Free |
| IHE RAD (SWF.b, IOCM, IID, WIA, XDS-I.b, AIR, IMR) | IHE | Mix of final text and trial implementation [K] | Imaging workflow, image sharing, AI results | Procurement requirement | Free |
| ISO/IEEE 11073 (Nomenclature, PHD, SDC -10207/-20701/-20702) | IEEE/ISO | Family of standards [K] | Device data, OR/ICU interoperability | Optional (growing in DE and EU) | Paid standards documents |
| LOINC | Regenstrief | Semi-annual releases (2.8x) [K] | Lab and clinical observations, orders, document types | Required in US/AU/IN/UAE/SA and many others | Free licence with attribution [K] |
| LIVD | HL7 / IICC | **Not yet published as an STU.** Latest hl7.org release is 1.0.0-ballot (Jan 2024 ballot), and the CI build is labelled 1.0.0 but "is not an authorized publication" [V, 21][110] | Mapping analyser test codes to LOINC | Optional (strongly recommended) | Free |
| UCUM | Regenstrief | Stable [K] | Units of measure | Required wherever FHIR Quantity is profiled | Free [K] |
| SNOMED CT | SNOMED International | International Edition (monthly) plus national editions [K] | Problems, findings, procedures, allergies | Mandated in UK, AU, IN, ABDM, many EU states | Free in 54 members; fees elsewhere [V, 23][24] |
| ICD-10 and national modifications | WHO plus national bodies | ICD-10-CM/PCS, -AM/ACHI, -GM/OPS, -CA/CCI, etc. [K] | Coding, DRG/casemix billing, statistics | Required for billing nearly everywhere | Varies (see §5) |
| ICD-11 (MMS) | WHO | Annual releases, API, offline packages [V, 28] | Mortality and morbidity, future billing | Optional or transitional in most places | Free, CC BY-ND 3.0 IGO [V, 28] |
| ATC/DDD | WHO Collaborating Centre (Oslo) | Annual update [K] | Drug classification, utilisation | Common in EU/ME/APAC | Index free to view; electronic files sold by WHOCC [K] |
| RxNorm | US NLM | Monthly and weekly releases [V, 120] | US drug normalisation | Required (USCDI, CMS) [36] | Free; full files need a free UMLS licence [V, 120] |
| NCPDP SCRIPT / RTPB | NCPDP | SCRIPT 2023011 (mandatory 2028). RTPB v13 [V, 34] | US e-prescribing | Required (US) | Paid membership/standards [K] |
| dm+d | NHSBSA / NHS England | Weekly releases [K] | UK medicines | Required (UK) | Free (TRUD) [K] |
| IDMP (ISO 11615/11616/11238/11239/11240) | ISO, EMA SPOR | Ongoing [K] | Medicinal product identification | EU regulatory; future EU ePrescription | Paid ISO documents [K] |
| openEHR | openEHR International | AM 2.3.0 (Mar 2024), ITS-REST 1.1.0 (Jul 2026), PROC 1.7.0 (Aug 2024) [V, 29] | Clinical data repository and modelling | Optional (national in Norway, Slovenia, Catalonia and others) [K] | Free (specs); CKM content mostly CC-BY-SA [K] |
| ISO 13606 | ISO/CEN | 2019 revision [K] | EHR extract communication | Rare (legacy in ES/SE) | Paid ISO documents |
| UDAP / HL7 FAST Security | HL7 / UDAP.org | HL7 UDAP Security IG **2.0.0** (STU2, 9 Dec 2025); STU1 was 1.0.0 (2022) and 1.1.0 (2024) [V, 109] | B2B FHIR trust (TEFCA Facilitated FHIR) | US network exchange | Free |
| OAuth 2.x / OIDC | IETF / OpenID | OIDC Core 1.0 (required by (g)(10)) [V, 39] | Authentication and authorisation | Required | Free |

---

## 3. Standards in depth

### 3.1 HL7 Version 2: the in-hospital backbone

**Why it persists.** HL7 v2 is event-driven: something happens (admit, order, result) and a message is pushed. That matches how clinical systems behave, and it runs over simple TCP framing (MLLP) inside trusted hospital networks. Every LIS, RIS/PACS, pharmacy cabinet, dietary, bed-management, nurse-call, device gateway and billing system sold in the last 30 years speaks it. Replacing it brings no clinical benefit and costs a great deal. FHIR has not replaced intra-hospital messaging: FHIR Messaging is rarely used, with Saudi NPHIES the notable national exception [67], and FHIR Subscriptions are only now becoming mainstream [18][45]. Regulators also keep v2 alive. In the US, immunisation (VXU), syndromic surveillance (ADT) and electronic lab reporting (ORU) still use HL7 v2.5.1 IGs under SVAP [38].

**Versions in the field [K].** Expect 2.3/2.3.1 (very common in older LIS/RIS), 2.4 (Europe, the Gulf and Asia), 2.5/2.5.1 (US regulatory, IHE profiles) and some 2.6–2.8 (newer European and Asian builds). 2.9.1 (normative, September 2024) is the latest [S, 106] and is rarely deployed. National and IHE profiles constrain v2 further. Examples are IHE PAM (patient administration), IHE SWF.b (radiology), IHE LTW/LAW (lab), IHE DEV/PCD (devices), Germany's HL7 v2 profiles, France's IHE PAM-FR, Japan's JAHIS profiles, and NABIDH's v2 requirements in Dubai [69]. Treat the version as a *dialect*. Your engine must accept 2.3 to 2.8, tolerate Z-segments, and validate against conformance profiles per interface.

**Message types the HMS must support (minimum viable catalogue)** [K]:

| Domain | Messages / triggers | Direction (typical) |
|---|---|---|
| Patient administration | ADT^A01 admit, A02 transfer, A03 discharge, A04 register outpatient/ED, A05 pre-admit, A06/A07 change class, A08 update, A11/A12/A13 cancels, A21–A27 leave of absence/bed status, A28/A31 person add/update, A40 merge patient (plus A47 identifier change), A60 adverse reaction info | Out to all ancillaries; in from external PAS where we are not the PAS |
| Orders | ORM^O01 (legacy), OML^O21/O33/O35 (lab), OMG^O19 (general), OMI^O23 (imaging), ORL/ORG/ORI acknowledgements | Out to LIS/RIS; in from outreach |
| Results | ORU^R01 (lab, radiology report, device vitals), ORU^R30-R32 (point-of-care), OUL^R22 (specimen-oriented lab) | In |
| Scheduling | SIU^S12–S26 (out), SRM/SRR (request/response) | Both |
| Charges / finance | DFT^P03/P11, BAR^P01/P05/P06 | Out to external billing, or in from ancillaries |
| Documents | MDM^T01–T11 (T02 original document plus content) | Both (transcription, external document stores) |
| Pharmacy | RDE^O11 (encoded order), RDS^O13 (dispense), RAS^O17 (administration), RGV^O15 (give), RRE/RRD acknowledgements | Out to pharmacy and automated dispensing cabinets, in from cabinets |
| Immunisation | VXU^V04, QBP^Q11/RSP^K11 | Out to registries |
| Master files | MFN^M01–M16 (staff, locations, charge master, test catalogue) | Both |
| Queries | QBP/RSP (PDQ, PIX in v2 form) | Both |

**Acknowledgement and transport [K].** There are two acknowledgement modes. *Original mode* returns an application ACK with MSA-1 = AA, AE or AR. *Enhanced mode* separates accept-level ACKs (CA/CE/CR) from application ACKs, controlled by MSH-15 and MSH-16. MLLP frames each message as `<VT> … <FS><CR>`. Production requirements are:
- MLLP over TLS when traffic crosses network zones;
- strict ordering *per patient* (never per interface alone), because A08 must not overtake A01;
- idempotency keyed on MSH-10 (message control ID);
- store-and-forward queues with replay;
- dead-letter handling with alerting;
- message-level audit retention.

**v2-to-FHIR.** The HL7 v2-to-FHIR IG (1.0.0 STU1, FHIR R4) supplies ConceptMaps for message structures, segments, datatypes and vocabularies, plus a Bundle profile for a converted message [17]. Use it as the reference mapping for our inbound v2 pipeline into the canonical model and FHIR façade. Do not invent private mappings when the IG already defines one.

### 3.2 FHIR

#### 3.2.1 Release status and what it means for us

| Release | Status | Practical reading |
|---|---|---|
| R4 (4.0.1) | First normative content (Patient, Observation, Bundle, CapabilityStatement, StructureDefinition, ValueSet, CodeSystem, OperationOutcome, Parameters, Binary, plus datatypes and the RESTful API) [V, 4]. The rest is trial use | The global regulatory baseline. Every national IG in this report is R4 |
| R4B (4.3.0) | Interim release (2022) [V, 4] | Used by a few IGs (Subscriptions backport targets R4B [18]). Skip as a server target |
| R5 (5.0.0) | Trial use, still "the current published version" [V, 2][4] | Little regulatory adoption. HL7 Europe publishes parallel R4 and R5 IGs [22] |
| R6 | Fully **normative** ballot. Ballot 4 (May 2026) was "the first full ballot of R6", ballot 5 (17 Jul 2026) the second. CI `6.0.0-snapshot1` built 15 Oct 2026 [V, 1][2][3]. The ballot notes say "there is certain to be another ballot after this" [V, 3]. *(Reconciled 2026-10-16: the CI ballot-intro page, generated 15 Oct 2026, still says "first full ballot", while the ballot-5 page says "2nd Full Ballot" [2]. The CI wording is stale. `08` relied on it and has been corrected.)* | Final publication expected in 2027 [S, 5][6]; HL7 publishes no official date [V, 1][3]. One analysis says US Core v10 on R6 depends on R6 shipping in time [S, 6] |

**R6 changes that matter for an HMS** [V, 3]:
- Medication dosage is extensively reorganised, affecting MedicationRequest, MedicationDispense, MedicationStatement, Dosage and Timing. This is a migration risk for pharmacy interfaces.
- Observation gains an `organizer` element for panels.
- **33 immature resources move out of core into incubators or other IGs**, including **ChargeItem, Invoice, Contract, InsurancePlan, SupplyRequest, SupplyDelivery, Transport, GraphDefinition, StructureMap and TestScript**. Asynchronous bulk data and bundle requests also move out of the core spec.

The ERP and billing consequence is clear: **do not adopt FHIR ChargeItem or Invoice as the canonical model for our revenue cycle.** Use national claims standards (Claim/ExplanationOfBenefit for NPHIES and NHCX, X12 in the US, local XML elsewhere) at the edge, and keep finance internal (see `05-revenue-cycle-erp-operations.md`). *(Reconciled 2026-10-16: the ballot-5 incubator list also contains ChargeItemDefinition, InventoryItem and InventoryReport. In R5 these are FMM 1, 0 and 0 [2][123]. `05` §3.8, §7 and §9.2 and `02` §9 now treat FHIR finance and supply names as naming guidance and edge projection only. The external financial API is limited to resources that stay in R6 core (Account, Claim, ClaimResponse, Coverage, CoverageEligibilityRequest/Response, ExplanationOfBenefit, PaymentNotice, PaymentReconciliation), plus national IGs (NPHIES, NHCX, Da Vinci PAS) and X12, matching `11` §11.)* Once an R6 ballot completes, no further breaking changes are allowed [V, 3], which will make R6 the long-term stable target.

**Maturity model.** Resources outside the normative core carry FHIR Maturity Model (FMM) levels 0 to 5. National IGs pin the profiles they need, so for us the binding constraint is each **IG's version**, not the resource's FMM.

#### 3.2.2 RESTful API, search, subscriptions and bulk

- **REST:** read/vread, create/update/patch/delete, conditional create and update (critical for idempotent interfaces), history, `batch` and `transaction` Bundles. Search supports chaining, `_include`/`_revinclude`, `_has`, modifiers, `_summary`/`_elements`, paging and `_count`. Operations include `$everything`, `$validate`, `$match` (EMPI), `$docref` (IPA [12]), and `$summary` (IPS).
- **Subscriptions:** R4's criteria-based Subscription was weak. R5 introduced *topic-based* subscriptions (SubscriptionTopic), and the **R5 Backport IG 1.1.0** brings them to R4/R4B [V, 18]. Regulators are now asking for them. HTI-4's (j)(21) requires FHIR Subscriptions capabilities for ePA [V, 34]. The CMS Framework requires appointment and encounter notifications via FHIR Subscriptions [V, 45]. ISiK has a Subscriptions module [V, 54].
- **Bulk Data (`$export`)**, at system, Patient and Group level, produces NDJSON asynchronously under SMART Backend Services. The (g)(10) baseline is v1.0.0 with mandatory group export, SVAP allows v2.0.0, and v3.0.0 is the current published version [V, 9][39]. CMS encourages bulk exchange for Aligned Networks [V, 45].

#### 3.2.3 Security and app ecosystem

- **SMART App Launch 2.2.0** [V, 8] covers discovery via `.well-known/smart-configuration`; EHR launch and standalone launch; v2 scope syntax with resource and interaction granularity (for example `user/Encounter.rs`); asymmetric (`private_key_jwt`) client authentication as the preferred method; Backend Services; token introspection; App State; and User-Access Brands. SMART v2 also requires PKCE: "All SMART apps SHALL support" PKCE, and servers "SHALL support the S256 code_challenge_method and SHALL NOT support the plain method" [V, 113]. The US (g)(10) baseline is SMART 2.0.0 with token introspection and named capability sets, and SMART 2.2.0 is SVAP-approved [V, 39]. Canada's HALO (v1.1.1, Oct 2025) standardises SMART in-EMR launch for national apps such as eReferral and patient summary [V, 83].
- **CDS Hooks 2.0.1** [V, 10]: `patient-view` and `order-sign` are mature and `order-select` is documented. `encounter-start`, `encounter-discharge` and `appointment-book` are at "submitted" level. US ePA (CRD) depends on order-sign/order-select and appointment-book hooks [34].
- **FHIRcast 3.0.0** [V, 11]: a hub-based context-synchronisation protocol, with Patient-open, ImagingStudy and DiagnosticReport events. It is useful for radiology reporting, viewer and EHR side-by-side workflows.
- **UDAP / HL7 FAST Security** (HL7 UDAP Security IG 2.0.0, STU2, Dec 2025 [V, 109]) provides dynamic client registration and trust for B2B FHIR. TEFCA's Facilitated FHIR relies on it [S, 42].

#### 3.2.4 Core and patient-summary IGs

- **US Core 9.0.0** (R4) is current; versions 6.1.0, 7.0.0 and 8.0.x remain in regulatory use [V, 7][39].
- **IPA 1.1.0** (International Patient Access) is a minimal, jurisdiction-neutral patient-access API. It covers Patient, AllergyIntolerance, Condition, MedicationRequest/MedicationStatement, Immunization, Observation and DocumentReference, plus `$docref` and SMART [V, 12]. **Recommended as our default patient-access API outside the US.**
- **IPS:** HL7 IPS IG 2.0.0 (STU2, 3 Oct 2025, with breaking changes from 1.1.0) [V, 13][14] and EN ISO 27269:2025 (17 Sep 2025) [V, 15][16]. **Version 2.0.1 (19 Jun 2026) is an errata release and is now "the current published version".** It corrects the extensions-package dependency and makes minor updates [V, 13][111]. Target 2.0.1. HL7 Europe's European Patient Summary IG (1.0.0, ballot) is the EU derivative [V, 22].
- **National base and core profiles (all R4):**
  - UK Core STU2 2.0.1 (Jul 2024; the newest release found on the history page) [V, 62]
  - AU Core 2.0.0 (on AU Base 6.0.0) [V, 72]
  - CA Core+ (harmonised with CIHI, AB, BC and ON) [V, 83]
  - ABDM/NRCeS `ndhm.in` 6.5.0, with v7.0.0 in preview [S, 65]
  - NPHIES Financial Services IG 1.0.0 [V, 67]
  - ISiK (Stufe 3 binding) [V, 54]
  - JP Core 1.2.0 (30 Jul 2025) [V, 77]
  - HL7 Europe Base/Core STU2, Laboratory STU2 and Medication Prescription/Dispense STU1 (published), with Hospital Discharge Report, Imaging Report and EPS still in ballot [V, 22]
  - SATUSEHAT (FHIR-based, version not stated on the portal) [V, 78]
  - Brazil RNDS (FHIR "adapted to RNDS definitions") [V, 82]
- **Da Vinci** (US payer and provider): CRD, DTR, PAS, PDex, Plan-Net, CDex, HRex. HTI-4 certification criteria (g)(31)–(33) cover Coverage Requirements Discovery, Documentation Templates and Rules (FHIR Questionnaires), and Prior Authorization Submission and Status [V, 34][91].

#### 3.2.5 Terminology services, forms and clinical reasoning

- **FHIR terminology operations:** `CodeSystem/$lookup`, `$validate-code`, `$subsumes`, `ValueSet/$expand` and `$validate-code`, and `ConceptMap/$translate`. Implicit value sets exist for SNOMED CT (`?fhir_vs=ecl/...`) and LOINC. Every country stack we target assumes a terminology server: Canada runs a national FHIR terminology server [V, 83], and ABDM requires 42 ValueSets [S, 65].
- **Questionnaire/SDC** (current release SDC 4.0.0, STU4, March 2026 [V, 107]) covers forms, adaptive questionnaires, `$populate` and data extraction. It is the mechanism for US ePA DTR [V, 34], ISiK's form module [V, 54] and many national assessment forms.
- **Clinical Reasoning/CQL** covers Library, PlanDefinition, ActivityDefinition, Measure and MeasureReport. The US is moving quality reporting from QRDA toward FHIR-based digital quality measures [K]; QRDA I/III were still SVAP-updated in 2026 [V, 38].

### 3.3 Documents: CDA, C-CDA and IHE document sharing

- **CDA R2** remains the payload of many *national document exchanges*. Examples are My Health Record in Australia (migrating to FHIR) [V, 73], NABIDH in Dubai [V, 69], the eHealth Digital Service Infrastructure (eHDSI, CDA-based) that underpins MyHealth@EU [K], France's DMP (via the CI-SIS framework) [K], Italy's FSE (CDA2) [K] and China's shared-document standard WS/T 500 [K].
- **C-CDA in the US.** **C-CDA 5.0.0** (13 Jun 2026) consolidates C-CDA 2.1 guidance and is aligned with the current USCDI. It is published with FHIR IG tooling but remains XML CDA [V, 19]. It was SVAP-approved in 2026 [V, 38]. HTI-5 proposes to *revise* (b)(1) Transitions of Care, effective 1 Jan 2027 [S, 32]. C-CDA is therefore still required for US certification, while the policy direction is FHIR-first [33].
- **C-CDA on FHIR** maps document templates to FHIR Composition [K]. It is useful, but documents in the CMS Framework travel as FHIR attachments (PDF, TIFF, JPG) [V, 45].
- **IHE document sharing** [K]:
  - XDS.b (registry plus repository within an affinity domain)
  - XCA and XCPD (cross-community query, the backbone of TEFCA's QHIN query [S, 43] and of eHDSI)
  - XDR/XDM (push and media)
  - MHD/MHDS (the FHIR equivalent using DocumentReference, List and Binary)
  Germany's ePA document interfaces and France's DMP are built on IHE XDS-style transactions [K]. NABIDH explicitly mandates XDS, XCA, XCPD and MHD [V, 69]. The MHD client and server pattern is how new national programmes are adopting document sharing on FHIR.

### 3.4 Imaging, devices, laboratory, pharmacy

**Imaging.**
- **DICOM** has 22 parts and is republished several times a year [V, 20]. The HMS needs: Modality Worklist (C-FIND) provider, MPPS receiver, Storage Commitment awareness, DICOMweb client (QIDO-RS, WADO-RS, STOW-RS per PS3.18) and image-viewer launch (IHE IID) [K].
- **IHE RAD profiles** to plan for [K]: SWF.b (scheduled workflow), IOCM (image object changes), PIR, XDS-I.b (cross-enterprise image sharing), WIA (web-based image access), AIR (AI results) and IMR (interactive multimedia report).
- **Policy drivers:** Australia's Sharing by Default covers diagnostic imaging *reports* from 1 Jul 2026 (images excluded) [S, 74]. The EHDS makes medical images and reports a Group 2 priority category for 2031 [V, 51]. The HL7 Europe Imaging Report IG is in ballot [V, 22]. Malaffi is a reference site for HIE-level image exchange [V, 70].

**Devices** [K].
- Most hospitals bring device data in through vendor gateways that emit HL7 v2 ORU^R01, coded where possible with the ISO/IEEE 11073-10101 nomenclature (MDC).
- **IHE DEV (formerly PCD)** profiles cover Device Enterprise Communication (DEC), Alert Communication Management (ACM), Point-of-care Infusion Verification (PIV) and Implantable Device Cardiac Observation (IDCO).
- **ISO/IEEE 11073 SDC** (-10207 BICEPS, -20702 MDPWS, -20701 architecture, -10700 series requirements) is the service-oriented standard for OR and ICU device interoperability. It is gaining traction in German and EU procurement.
- **Personal Health Devices** use 11073-20601 and the PCHAlliance profiles.
- **Plan:** a device-integration service that takes v2 from gateways and exposes FHIR Observation, Device and DeviceMetric. SDC comes later.

**Laboratory.**
- **LOINC** is used for orders and results, with **UCUM** units and **SNOMED CT** for specimens and organisms. USCDI v6 newly binds lab, imaging and clinical test orders to LOINC [V, 37].
- **LIVD** maps in-vitro-diagnostic test codes to LOINC [V, 21]. Its FHIR IG has not been published as an STU: hl7.org carries only 1.0.0-ballot (Jan 2024), and the "1.0.0" CI build is not an authorised publication [V, 110]. The LIVD file format is nonetheless in industry use. Manufacturers publish LIVD files through the IICC [K]. Importing them cuts LOINC mapping effort sharply.
- **Analyser connectivity** uses CLSI LIS1-A/LIS2-A2 (formerly ASTM E1381/E1394), IHE LAW (HL7 v2.5.1) and POCT1-A for point-of-care testing [K]. These normally go through lab middleware.
- **Policy drivers:** the NABIDH LOINC mandate for labs (since 2021) [V, 69], Australia's Sharing by Default for pathology reports [S, 74], the EHDS Group 2 lab results category (2031) [V, 51] and the HL7 Europe Laboratory Report IG STU2 [V, 22].

**Pharmacy.**
- **United States:** NCPDP SCRIPT 2023011 becomes mandatory for certification from 1 Jan 2028, after a 2017071/2023011 transition window that ends 31 Dec 2027. RTPB v13 joins the Base EHR definition on 1 Jan 2028 [V, 34]. Electronic prior authorisation transactions in SCRIPT are now required [V, 34]. RxNorm is the USCDI binding for medication orders [V, 37].
- **United Kingdom:** dm+d plus the EPS FHIR APIs [K].
- **Germany:** E-Rezept on FHIR (KBV/gematik profiles) over the TI [K]. The ePA medication list is fed automatically from e-prescriptions. The electronic medication plan (the next stage of the digitally supported medication process, dgMP) was due "im Sommer 2026" [V, 55]; whether it went live on time was not verified.
- **Other drug code systems:** WHO ATC/DDD for classification [K], Dubai Drug Code [V, 69], Indonesia's KFA [V, 78] and the Australian Medicines Terminology (within SNOMED CT-AU) [K].
- **IDMP** (ISO 11615/11616/11238/11239/11240 via EMA SPOR) is the long-run EU identification layer for cross-border ePrescription [K]. The HL7 Europe Medication Prescription and Dispense IG STU1 is published [V, 22].

### 3.5 openEHR and ISO 13606

- **openEHR** separates a stable Reference Model (RM) from clinical knowledge expressed as **archetypes** (ADL 2, AM 2.3.0 [V, 29]), which are composed into **templates** (OPT). Data is queried with **AQL**, and the REST API is ITS-REST 1.1.0 (Jul 2026) [V, 29]. Its strength is a vendor-neutral, query-able *clinical data repository* whose content models are governed by clinicians through the Clinical Knowledge Manager [K]. National or regional deployments include Norway, Slovenia, Catalonia and parts of the UK (Wales), and vendors include Better and Ocean Health Systems [K].
- **Relationship to FHIR.** The two are complementary. openEHR is a persistence and modelling approach; FHIR is an exchange and API standard. Mapping layers from openEHR templates to FHIR profiles exist and are maturing [K].
- **ISO 13606** (2019 revision) is the EHR-extract communication standard that shares archetype heritage with openEHR. Its uptake is limited and legacy, chiefly in Spain and Sweden [K].
- **Our position:** do not adopt openEHR as the core store, because transactional HMS and ERP domains fit poorly. Borrow its discipline instead: a two-level model (stable core plus versioned, clinician-governed content templates). Keep an **openEHR export/adapter** option on the roadmap for tenders that require it, notably in the Nordics, Slovenia and Catalonia [K].

### 3.6 Identity, consent and audit

**Patient identity.**
- **IHE profiles:** PIX/PDQ (v2/v3), **PIXm/PDQm** (FHIR), **PMIR** (FHIR patient master identity registry with merge/link events) and **mCSD** (care services directory, for facility, practitioner and organisation registries) [K]. NABIDH mandates PIX, PDQ, PIXm and PDQm [V, 69]. OpenHIE organises national architectures around client, facility and health-worker registries plus an interoperability layer [V, 81].
- **Matching algorithms** [K]:
  - *Deterministic* matching uses exact or rule-based keys and is safe only when a reliable national ID is present.
  - *Probabilistic* matching (Fellegi–Sunter) uses m/u probabilities per field, typically estimated with EM; agreement weights are summed against upper and lower thresholds, with a clerical-review band in between. Blocking keeps pair comparison tractable, and Jaro–Winkler handles string similarity.
  - *Referential* matching compares records against a curated third-party identity reference, a US commercial pattern.
  - FHIR `Patient/$match` exposes the result with match grades.
- **National identifiers:**
  - India: ABHA number and ABHA address (M1) [S, 66]
  - UAE: Emirates ID as the primary key for all three HIEs [S, 71]
  - England: NHS Number via PDS [K]
  - Australia: IHI via the HI Service [K]
  - Saudi Arabia: national ID or Iqama [K]
  - France: INS, mandatory with qualification via the INSi teleservice [K]
  - Germany: KVNR on the eGK card [K]
  - Indonesia: NIK plus the SATUSEHAT IHS number [K]
  - Brazil: CNS/CPF [K]
  - The US has no national patient ID. The CMS Framework instead relies on IAL2-proofed digital credentials [V, 45].

**Consent** [K unless cited].
- FHIR Consent (R4 trial use, remodelled in R5).
- IHE BPPC (scanned or CDA consent) and the FHIR-based **PCF** (Privacy Consent on FHIR).
- **ABDM's consent manager (HIE-CM)**, based on India's DEPA model: the patient approves each HIU request through a consent artefact, and data is encrypted end-to-end with Fidelius (ECDH plus AES-GCM) [S, 66]. India's DPDP Rules 2025 were notified on 13 Nov 2025. Under Rule 1, the consent-manager rule (Rule 4) applies from 13 Nov 2026, and the substantive consent, rights, security, breach and cross-border rules (Rules 3, 5–16, 22, 23) apply from 13 May 2027 [S, 65][117].
- The CMS Framework requires purpose-of-use on every query and propagation of consent preferences to all parties [V, 45].
- US 42 CFR Part 2 (substance-use-disorder records) needs data segmentation and security labels [K].

**Audit and provenance** [K unless cited].
- IHE **ATNA**: DICOM-format audit messages over TLS syslog, plus node authentication.
- IHE **BALP** (Basic Audit Log Patterns): FHIR AuditEvent patterns.
- FHIR **Provenance** for authorship, device and AI-agent attribution.
- The EHDS makes logging one of only two harmonised components of an EHR system, and logs must be generated in the right format and testable [V, 51]. Audit is therefore a product-certification requirement in the EU, not just a hospital policy matter.

---

## 4. National and regional exchange frameworks

### 4.1 Country mandate matrix

| Country / region | National patient ID | Exchange platform(s) | Required standard / IG | Vendor certification / onboarding | Key dates (as of Oct 2026) |
|---|---|---|---|---|---|
| **United States** | None. MBI for Medicare. IAL2 credentials in the CMS Framework [45] | TEFCA (11 QHINs) [41]; Carequality/CommonWell; CMS Aligned Networks [45]; Surescripts; state HIEs | USCDI v3 baseline (v6 via SVAP); US Core 6.1.0+ (9.0.0 via SVAP); SMART 2.0/2.2; Bulk; C-CDA; Da Vinci (ePA); NCPDP SCRIPT 2023011 [34][38][39] | ONC Health IT Certification (ONC-ACB testing, Inferno for (g)(10)) [K]; Real World Testing; Insights Condition (cut to one FHIR measure under HTI-5) [S, 31] | USCDI v3 baseline 1 Jan 2026 [44]; CMS Framework criteria 13–16 effective 4 Jul 2026 [45]; HTI-5 final pending, not published as of 16 Oct 2026 (removals at the final rule's effective date and on 1 Jan 2027) [100][102]; CMS-0057-F payer operational provisions 1 Jan 2026 and payer APIs 1 Jan 2027 [V, 103]; USCDI v7 released 23 Jul 2026, with no certification date [105]; SCRIPT 2023011 and RTPB 1 Jan 2028 [34] |
| **EU (EHDS)** | National IDs. Cross-border identification implementing regulation (EU) 2026/2099, applying from 26 Mar 2027 [51][122] | MyHealth@EU (NCPeH), national infrastructures [51] | EEHRxF (implementing act pending); HL7 Europe IGs as likely technical basis [22][51] | Self-declaration, Article 40 digital testing environment, CE marking, registration in the EU database [51] | Key implementing acts due 26 Mar 2027; Group 1 on 26 Mar 2029; Group 2 on 26 Mar 2031 [51] |
| **Germany** | KVNR (eGK) [K] | Telematikinfrastruktur: ePA für alle, E-Rezept, KIM, TI-Messenger [55][K] | ISiK (FHIR R4) for hospital systems; ePA interfaces; KBV/gematik FHIR profiles [54][K] | gematik ISiK Bestätigungsverfahren (Tiger test suite, mandatory under §373 SGB V) [S][54]; TI component approvals [K] | ISiK Stufe 3 binding since 1 Jul 2025, Stufe 5 date TBD [54]; ePA mandatory since 1 Oct 2025 [55]; hospitals lose the Telematikzuschlag if TI requirements are unmet by 1 Apr 2026 [S, 56] |
| **France** | INS (qualified via INSi) [K] | DMP / Mon espace santé; MSSanté; Pro Santé Connect [S, 58] | CI-SIS (IHE XDS/CDA plus FR Core FHIR) [K] | Ségur référencement (ANS); intrusion test paid by vendor [V, 58] | V2 DPI dossiers 15 Dec 2025, 31 Mar 2026, 30 Jun 2026; hospital deployment by 17 Mar 2027 [58][59] |
| **Netherlands** | BSN [K] | LSP, Twiin, MedMij [K] | Nictiz zibs and FHIR; Wegiz use cases [K] | NEN norms and certification under Wegiz [K] | Phased per use case [K] |
| **Italy** | Codice fiscale [K] | FSE 2.0, INI, EDS [61][K] | CDA2 (HL7 Italia) and FHIR; INI spec v2.6.4 (2026) [V, 61] | Regional accreditation [K] | PNRR milestones 2025–26 [K] |
| **Spain** | CIP-SNS [K] | HCDSNS, interoperable eReceta [K] | CDA/IHE plus FHIR [K] | Regional [K] | n/a |
| **Nordics** | Personal identity numbers [K] | DK: Sundhed.dk/FMK; SE: NPÖ (Inera); NO: Kjernejournal/NHN/e-resept; FI: Kanta [K] | Mix of CDA, IHE XCA, FHIR, openEHR (NO) [K] | National conformance [K] | n/a |
| **United Kingdom (England)** | NHS Number (PDS) [K] | Spine (PDS, SCR, EPS, e-RS, NRL), MESH, GP Connect, NHS App/NHS login, ICS shared care records; Single Patient Record planned [64][K] | UK Core (FHIR R4) [62]; SNOMED CT, dm+d, ICD-10/OPCS-4 [K] | DTAC, DSPT, DCB0129/0160 clinical safety, Spine conformance (SCAL) [K]; DUAA Schedule 15 compliance notices and accreditation [63] | DUAA Schedule 15 in force 5 Feb 2026 [63]; SPR architecture options published Sep 2025 [S, 64] |
| **India** | ABHA number/address [66] | ABDM: HIE-CM, gateway, HFR, HPR; NHCX [65][66] | NRCeS FHIR R4 (`ndhm.in` 6.5.0; seven HI types plus invoice) [S, 65][66] | Sandbox, M1–M3 functional test by NHA, WASA/Safe-to-Host audit, production credentials [S, 66]; NABH DHS needs M3 [S, 65] | DPDP Rules notified 13 Nov 2025: consent-manager rule (Rule 4) from 13 Nov 2026, substantive obligations from 13 May 2027 [S, 65][117]; no hard ABDM vendor deadline, mandates via NMC, states and NABH [S, 65] |
| **Saudi Arabia** | National ID / Iqama [K] | NPHIES (CHI and MOH); Wasfaty; Seha Virtual Hospital; Sehhaty [K] | NPHIES FHIR R4 messaging (IG 1.0.0 STU, Dec 2025) [V, 67]; SBS V3 codes [S, 68]; ICD-10-AM [K] | NPHIES onboarding/testing [K]; SBS conformance or loss of access [S, 68] | SBS version deadlines per CHI [S, 68] |
| **UAE: Abu Dhabi** | Emirates ID [71] | Malaffi (3,144 facilities) [V, 70] | HL7/FHIR per Malaffi specs; ICD-10, LOINC, DOH formulary [S, 101] | DOH onboarding plus sandbox; connectivity a licensing prerequisite [S, 101] | Live [70] |
| **UAE: Dubai** | Emirates ID [69] | NABIDH (since Oct 2020) [V, 69] | HL7 v2/v3, CDA R2, FHIR R4, IHE PIX/PDQ/XDS/XCA/XCPD/PIXm/PDQm/MHD; ICD-10-CM, CPT, HCPCS, CDT, DDC, LOINC [V, 69] | Approved EMR list; EMR ≥ HIMSS EMRAM stage 2 [V, 69] | EMR transitions 3 months (clinic) or 6 months (hospital) [69] |
| **UAE: MOHAP (Northern Emirates)** | Emirates ID [71] | Riayati / NUMR; e-Claims Post Office [S, 71] | HL7 or FHIR [S, 71] | Connected-EMR list; security assessment; data-privacy agreement [S, 71] | Ministerial Resolution 156/2021 [S, 71] |
| **Qatar / Oman / Bahrain** | QID / Civil ID / CPR [K] | National HIS and HIE programmes (Oman Al-Shifa; Bahrain I-SEHA) [K] | Exchange standards not verified [K]. Qatar is a SNOMED member, while Oman and Bahrain are not [V, 23]. Qatar and Bahrain (like Saudi Arabia) hold government ICD-10-AM/ACHI licences from IHACPA [S, 118] | Not verified | Not verified (see §9) |
| **Australia** | IHI (HI Service) [K] | My Health Record; eRx (ASL); secure messaging [K] | AU Core 2.0.0 (R4) [72]; MHR CDA moving to FHIR [73] | ADHA conformance (CIS for MHR), NASH PKI [K] | Sharing by Default for pathology and DI reports from 1 Jul 2026, with Medicare benefits conditional on upload; medicines from online prescribing services next [74][75][121] |
| **Singapore** | NRIC/FIN [K] | NEHR (Synapxe for MOH) [V, 76] | Not verified | NEHR onboarding [76]; under the Health Information Bill all licensed providers must contribute key data to the NEHR and meet cybersecurity and data-security requirements [V, 116] | HIB passed by Parliament on 12 Jan 2026; MOH "intends for the HIB to take effect from early 2027". The exact commencement date is not yet gazetted [V, 116] |
| **New Zealand** | NHI [K] | Hira programme; NHI/HPI FHIR APIs [K] | NZ Base FHIR [K] | Not verified | Not verified |
| **Japan** | Insurance numbers; My Number card for online eligibility [K] | Online eligibility (オンライン資格確認); e-prescription service; CLINS EMR sharing service [77][K] | JP Core 1.2.0 (R4); CLINS package [V, 77] | MHLW/SSK certification [K] | Not verified [K] |
| **South Korea** | RRN [K] | HIE (CDA), My Healthway (FHIR), HIRA claims/DUR [K] | KR Core [K] | EMR certification (KHIS) [K] | Not verified |
| **China** | Resident ID; e-health card [K] | Regional population health platforms; national medical insurance platform [K] | WS/T 500 (CDA-based), WS 445 [K] | EMR application-level grading (0–8); interoperability maturity assessment [K] | Not verified |
| **Indonesia** | NIK; SATUSEHAT IHS number [K] | SATUSEHAT [V, 78] | SATUSEHAT FHIR; ICD-10, ICD-9-CM, LOINC, SNOMED CT, KFA [V, 78] | Registration and API credentials (sandbox, then production) [V, 78] | EMR mandate under Permenkes 24/2022 (deadline end-2023) [K] |
| **Thailand / Malaysia / Philippines** | National IDs [K] | NHSO/Health Link (TH); MOH (MY); PhilHealth eClaims (PH) [K] | Mixed; FHIR emerging [K] | Not verified | Not verified |
| **Kenya** | National ID / client registry ID [K] | DHA HIE (AfyaConnect): registries, shared health record, claims and pre-auth (SHA) [V, 79][80] | HIE APIs with OAuth 2.0 [V, 80]; FHIR [K] | DHA digital health system certification programme [V, 79] | Digital Health Act 2023 [K] |
| **Rwanda / Nigeria / South Africa / Ethiopia** | NIDA / NIN / SA ID / Fayda [K] | OpenHIE-pattern HIEs; SA HPRS; NHI Act (SA) [K] | HNSF (SA); FHIR/OpenHIE [K] | Not verified | Not verified |
| **Canada** | Provincial health numbers [K] | Provincial EHRs; Connected Care Trust Framework (NHISA) [V, 83][84] | CA Core+, CACDI; HALO (SMART); Infoway terminology server [V, 83] | Pan-Canadian Conformance Platform (Dec 2025) plus Projectathons [V, 83] | HALO v1.1.1 Oct 2025; CCTF Blueprint May 2026 [83][84] |
| **Brazil** | CNS / CPF [K] | RNDS; Meu SUS Digital [82][K]; TISS for private insurers [K] | FHIR adapted by RNDS (RAC, discharge summary, labs) [V, 82] | Establishment and integrator onboarding; ICP-Brasil certificates [K] | Portaria 1.792/2020 (lab notification) [V, 82] |
| **Mexico / Chile** | CURP / RUN [K] | National programmes [K] | NOM-024 (MX); FHIR CL Core (CL) [K] | NOM-024 certification (MX) [K] | Chile clinical-record interoperability law (2024) [K] |

### 4.2 United States in detail

**Statutory and regulatory stack.**

- **The 21st Century Cures Act and information blocking (45 CFR Part 171).** The actors are providers, certified health IT developers, and HIEs/HINs. Developers are held to a "knows or should know" standard. HHS announced a "crackdown on health data blocking" on 3 Sep 2025 and issued an enforcement alert the same month, followed by enforcement-discretion notices on 24 Nov 2025 [V, 40]. HHS-OIG's final rule (posted 27 Jun 2023) allows penalties of "up to a $1 million penalty per violation" for developers, HIEs and HINs [V, 104]. Provider disincentives (under the 2024 HHS disincentives rule) are also in force [K]. HTI-5 would:
  - define "access", "use" and "exchange" to include automated means, *including autonomous AI* [S, 31][32];
  - tighten the Manner and Infeasibility exceptions;
  - remove the TEFCA manner exception [S, 32].
- **The ONC Health IT Certification Program (45 CFR 170.315).** This is the gate to the US hospital market, because Medicare Promoting Interoperability requires CEHRT [K]. The criteria most relevant to a hospital EHR, with their HTI-5 status:

| Criterion | Topic | HTI-5 proposed status |
|---|---|---|
| (a)(1)–(a)(3) | CPOE (meds, lab, imaging) | Not listed as removed or revised, so retained [32] |
| (a)(4) | Drug-drug and drug-allergy checks | Retained (by elimination) [32] |
| (a)(5) | Demographics | **Revise** (at final rule) [32][100] |
| (a)(9) | CDS (legacy) | **Remove** (effective at final rule) [32][100] |
| (a)(12), (a)(14) | Family health history; implantable device list | **Remove**: (a)(12) on 1 Jan 2027, (a)(14) at final rule [100] |
| (a)(15) | Social, psychological and behavioural data | Not listed as removed or revised, so retained [100] |
| (b)(1) | Transitions of care (C-CDA) | **Revise** (1 Jan 2027) [32][100] |
| (b)(2), (b)(7)–(b)(9) | Reconciliation; security tags; care plan | **Remove**: (b)(2) on 1 Jan 2027, the others at final rule [100] |
| (b)(3) | e-Prescribing (SCRIPT 2023011) | Updated by HTI-4 [34] |
| (b)(10) | **EHI Export** | Retained [32] |
| (b)(11) | Decision Support Interventions (HTI-1) | **Revise**: AI model-card and source-attribute requirements removed [33] |
| (c)(1)–(c)(4) | CQM record/export, import/calculate, report, filter | (c)(1), (c)(2) retained; (c)(3) **revise**; (c)(4) **remove** (1 Jan 2027) [32][100] |
| (d)(1)–(d)(13) | Privacy and security (including MFA, audit) | **All remove** at final rule (an alternative proposal keeps some audit criteria) [31][32][100] |
| (e)(1), (e)(3) | View/download/transmit; patient health information capture | (e)(1) **revise**; (e)(3) **remove** (1 Jan 2027) [100] |
| (f)(1)–(f)(7) | Public health (immunisation, syndromic, ELR, cancer, eCR, AUR, surveys) | (f)(1)–(f)(3) retained; (f)(4), (f)(7) **remove** (1 Jan 2027); (f)(5), (f)(6) **revise** [32][100] |
| (g)(1)–(g)(7), (g)(9) | Measure calculation, SED, QMS, accessibility, C-CDA performance, legacy APIs | **Remove**: (g)(1), (g)(2), (g)(7) and (g)(9) on 1 Jan 2027; (g)(3)–(g)(6) at final rule [100] |
| (g)(10) | **Standardized API (FHIR)** | Retained [32] |
| (g)(31)–(g)(33), (j)(20)–(j)(21) | ePA (Da Vinci CRD/DTR/PAS, CDS Hooks, Subscriptions) | New in HTI-4 [34] |
| (h)(1), (h)(2) | Direct messaging | **Remove** [32] |

The 19 retained criteria are derived by elimination. Pass 2 cross-checked them against ASTP/ONC's own overview presentation (19 Feb 2026), which lists 34 removals and 7 revisions with their timing [V, 100]. The 19 are (a)(1)–(a)(4), (a)(15), (b)(3), (b)(4), (b)(10), (c)(1), (c)(2), (f)(1)–(f)(3), (g)(10), (g)(31)–(g)(33), (j)(20) and (j)(21). The final rule may change this list. ASTP has signalled future rules that further remove "non-FHIR-based" criteria. An HTI-6 proposed rule on API standards appeared on the Unified Agenda for November 2026 [S, 33].

- **HTI rule history.**
  - HTI-1 (Jan 2024): DSI, USCDI v3, Insights Condition [K].
  - HTI-2 (proposed Aug 2024): parts finalised as HTI-3 (Protecting Care Access, Dec 2024) [V, 40] and the TEFCA rule (45 CFR 172, Dec 2024) [S, 44]. The ePA and SCRIPT pieces became HTI-4 (Jul 2025) [V, 34]. The rest was withdrawn in Dec 2025 [S, 31].
  - HTI-5 (proposed 22 Dec 2025, published in the Federal Register 29 Dec 2025; comments closed 27 Feb 2026; final not published as of 16 Oct 2026) [V, 30][102].
- **USCDI.** v6 was released 24 Jul 2025, adding Facility Address, Portable Medical Order, Family Health History, Care Plan and Date of Onset, broadening UDI to all devices, binding RxNorm to medication orders and binding LOINC to orders [V, 36][37]. Draft v7 was released on 29 Jan 2026, and **final USCDI v7 was released on 23 Jul 2026**. It adds 30 new data elements plus one significantly revised element (Tobacco and Nicotine Product Use), and two new data classes (Adverse Events; Healthcare Information Attributes). New elements include Referral Order and Referral Note, Medical Device Order, Nutrition Assessment and Nutrition Order, and Specimen Collection Method [V, 105]. v7 has no SVAP or certification date yet.
- **SVAP.** The 2026 cycle, announced 30 Jun 2026, approved USCDI v6, C-CDA 5.0.0, US Core 9.0.0 and the 2026 CMS QRDA I/III IGs for voluntary use from 29 Aug 2026. Updated test tools are expected by December 2026 [V, 38]. SMART 2.2.0 was approved in the 2024 cycle [V, 38]. The US Core 8.0.1 surveillance compliance date is 15 Nov 2027 [V, 39].
- **TEFCA.**
  - Eleven designated QHINs: CommonWell, eClinicalWorks (PrismaNet), eHealth Exchange, Epic Nexus, Health Gorilla, Kno2, KONZA, MedAllies, Netsmart, Oracle Health Information Network and Surescripts (re-confirmed 16 Oct 2026; further candidates are still onboarding) [V, 41].
  - Exchange modalities: QHIN query (IHE XCPD/XCA with C-CDA), message delivery, and **Facilitated FHIR**, in which the QHIN brokers discovery and the requester calls the responder's FHIR endpoint directly under UDAP [S, 42][43].
  - QHIN-to-QHIN FHIR (roadmap Stage 3) was piloted, and I found no confirmation that it is generally available [S, 44][98].
  - Vendors connect as Participants or Subparticipants through a QHIN, and each QHIN sets its own onboarding specification [S, 43].
- **The CMS Interoperability Framework and Aligned Networks (July 2025 onward).** There were 60+ pledgers, 21 networks and 7 EHR vendors [V, 46]. Criteria include:
  - US Core FHIR APIs on USCDI v3+;
  - LOINC, RxNorm and SNOMED terminology;
  - documents as FHIR attachments;
  - FHIR Subscription notifications;
  - IAL2/AAL2 identity;
  - a record locator;
  - HITRUST or equivalent security;
  - purpose-of-use and consent propagation;
  - endpoints published in the CMS National Provider Directory.
  Criteria 13–16 have been in effect since 4 Jul 2026, and early adopters reached GA in July 2026 [V, 45]. Oracle Health (Apr 2026) and b.well (Jul 2026, SMART Health Links/QR intake) announced Aligned Network status [S, 48][49]. The framework is voluntary but sets market expectations, so EHRs are expected to make data available to aligned networks [S, 92].
- **CMS Interoperability and Prior Authorization rule (CMS-0057-F).** Impacted payers had to implement certain (operational) provisions by 1 Jan 2026, and have "primarily January 1, 2027" for the Patient Access, Provider Access, Payer-to-Payer and Prior Authorization APIs [V, 103]. Providers report an ePA measure in Promoting Interoperability from 2027 [V, 34].

### 4.3 European Union and member states

**The EHDS (Regulation (EU) 2025/327)** [V, 50][51][52].

- **Timeline.**
  - Entry into force: 26 Mar 2025.
  - General application and key implementing acts: 26 Mar 2027.
  - Group 1 (patient summary, ePrescription/eDispensation) and most secondary use: 26 Mar 2029.
  - Group 2 (medical images and reports, lab results, discharge reports) and remaining secondary use: 26 Mar 2031.
  - Third countries may join HealthData@EU from 26 Mar 2035.
- **What counts as an EHR system (Art. 2(2)(k)).** Any software intended to store, intermediate, export, import, convert, edit or view *priority-category* data for providers or patients. Appointment-booking-only systems are out of scope [V, 51]. **Our HMS is squarely in scope.**
- **Vendor obligations (Chapter III, Arts 25–49)** [V, 51]:
  - **two harmonised components**: the European interoperability software component (import and export in EEHRxF) and the European logging software component (access logs per Art. 9);
  - Annex II essential requirements plus Art. 36 common specifications;
  - a mandatory automated test in an Art. 40 digital testing environment before market placement;
  - Art. 37 technical documentation and an Art. 38 information sheet;
  - an Art. 39 EU declaration of conformity (self-assessment, no notified body);
  - Art. 41 CE marking;
  - Art. 49 registration in the EU database;
  - post-market obligations.
  Member States may add national requirements on other parts of EHR systems, as long as they do not interfere with the harmonised components [V, 51]. Other EU law can overlap (MDR/IVDR, AI Act, Cyber Resilience Act), and a single EU declaration is allowed where appropriate [V, 51].
- **Status of implementing acts as of 22 Sep 2026** [V, 51]:
  - Published:
    - (EU) 2026/771 (EHDS Board, 7 Apr 2026);
    - **2026/2083 (MyHealth@EU, 18 Sep 2026, applies from 26 Mar 2027)**;
    - 2026/2098 (dataset metadata, HealthDCAT-AP, applies from 26 Mar 2029);
    - **2026/2099 (cross-border identification and authentication; adopted 21 Sep 2026, published in the OJ 22 Sep 2026; applies generally from 26 Mar 2027, with some provisions from 2028–2029)**.

    Pass 1 gave 27 Mar 2027 for 2026/2099. Both [51] and [122] give **26 Mar 2027**, and this pass corrects it.
  - **Pending:** EEHRxF technical specifications (Art. 15), **common specifications for EHR systems (Art. 36)**, data quality (Art. 13(4)), and secondary-use acts.
  - The Xt-EHR joint action produced logical information models and FHIR IG inputs, which "are currently being revised". They are *not* legally binding; only the adopted act counts [V, 51].
- **Note on dates.** Some commentators read Art. 105 as putting the full Chapter III conformity regime at 2031, or as giving in-house systems until 2031 [S, 53]. The Commission's own explanation ties the harmonised components to early 2029 for Group 1 [V, 51]. **Plan for March 2029.**
- **Likely technical basis.** HL7 Europe IGs: Base/Core STU2, Laboratory STU2 and Medication Prescription/Dispense STU1 are published; Hospital Discharge Report, Imaging Report and European Patient Summary are in ballot [V, 22]. Expect IPS-derived patient summaries and FHIR R4 first, but **the FHIR version of the EEHRxF is not yet fixed** [K].

**Germany** [V, 54][55][56][57].
- **ISiK** is gematik's FHIR REST spec for hospital systems.

  | Stufe | Released | Status |
  |---|---|---|
  | 3 | 1 Jul 2023 | Binding from 1 Jul 2025 |
  | 4 | 1 Jul 2024 | Withdrawn 1 Jul 2025 |
  | 5 | 1 Jul 2025 | Being made binding; date TBD. Valid Stufe 3 holders will get extension certificates |

  The modules are Basis, Dokumentenaustausch, Terminplanung, Medikation, Vitalparameter, Sicherheit, Connect, ICU workflow, Subscriptions, Formular and Organspende. Confirmation (Bestätigung) is mandatory under §373 SGB V for products the DKG defines as relevant; testing uses the Tiger test suite, and fees follow TeleGebV [S][54]. A valid confirmation supports KHSFV funding checks [V, 54].
- **ePA für alle.** The opt-out launch was 15 Jan 2025, with nationwide rollout from 29 Apr 2025. **From 1 Oct 2025 all providers, including hospitals, must fill the ePA** with findings, discharge and other letters, and imaging and lab reports. The medication list is auto-fed from E-Rezept. The electronic medication plan (dgMP stage) was announced for summer 2026, and TI-Messenger was to be available for all insurers from the start of Q2 2026; providers have been able to use it since April 2024 [V, 55]. The BMG page says consequences of non-use are decided by the relevant KV (for practices); it gives no 2026 sanction date [V, 55]. Hospitals face no fee cuts but lose the Telematikzuschlag if TI requirements are not met by 1 Apr 2026 [S, 56]. Hospital uptake was still limited in spring 2026 [S, 57].
- **Other TI services** [K]: KIM (secure mail), eAU, KBV MIOs, the connector/TI-Gateway path to "TI 2.0" zero trust. Classifications are ICD-10-GM and OPS (BfArM). Germany is a SNOMED member with a free affiliate licence [V, 27].

**France** [V, 58][59][60].
- Ségur "vague 2" for DPI (hospital EHR) requires interoperability, Pro Santé Connect strong authentication, DMP read and write, MSSanté and cybersecurity [S, 58].
- Dossier deadlines were 15 Dec 2025, 31 Mar 2026 and 30 Jun 2026, under the Arrêté of 16 May 2024. The vendor pays for the intrusion test [V, 58].
- Hospitals have until 17 Mar 2027 to deploy (ANS) [V, 59]. Third-party guides cite later financing dates, so treat them as unconfirmed [S].
- By 10 Aug 2026, 21 DPIs and 21 PFIs were listed (for example Sillage 26.1, DxCare, Hopital Manager, TrakCare T2026) [S, 60][96].
- Other requirements [K]: INS identity, CI-SIS profiles, CCAM procedures, CIM-10 (PMSI).

**Italy, Netherlands, Spain, Nordics.**
- Italy's FSE 2.0 has 29 document types and 26 million consents; INI interoperability spec v2.6.4 and Patient Summary (PSS) technical notes were published in July–September 2026 [V, 61]. Italy is **not** a SNOMED member [V, 23].
- The Netherlands (Wegiz, Nictiz zibs, Twiin), Spain (HCDSNS) and the Nordics (Kanta, NPÖ, Kjernejournal, FMK) are summarised in the matrix but **not verified this session** [K].

### 4.4 United Kingdom (England)

- **Legal lever (new).** Under DUAA Schedule 15, information standards can now regulate the design, quality, capabilities *and supply contracts* of IT, including interoperability, portability, data storage and access, and security. They may adopt external standards "as they change over time". The Secretary of State can issue compliance notices (with at least 28 days to comply), publicly name suspected non-compliant suppliers, and create a fee-bearing **accreditation scheme**. These provisions have been in force since 5 Feb 2026 [V, 63]. This is England's step toward ONC-style supplier regulation.
- **Policy.** The 10 Year Health Plan (2025) calls for a Single Patient Record. NHS England issued an RFI in May 2025 and announced three candidate architectures in September 2025, none of which stores the data in a single record [S, 64]. NHS England's functions are being merged into DHSC [K].
- **Integration surface for a hospital EPR** [K; digital.nhs.uk refused automated access]:
  - PDS FHIR (demographics and NHS Number trace);
  - SCR, NRL (FHIR DocumentReference pointers) and GP Connect (Access Record, Appointment Management);
  - e-RS (referrals) and EPS (FHIR R4 prescribing);
  - MESH (asynchronous transfer, including Transfer of Care discharge documents) and BaRS (Booking and Referral Standard);
  - NEMS (events), CIS2 (staff authentication over OIDC), NHS login and NHS App integration (including secondary-care Wayfinder);
  - HSCN connectivity;
  - SUS+ Commissioning Data Sets and ECDS submissions;
  - mandatory SNOMED CT and dm+d;
  - ICD-10 and OPCS-4 for activity coding.
- **Assurance** [K]: DTAC, DSPT, DCB0129 (manufacturer) and DCB0160 (deployer) clinical safety, Cyber Essentials Plus, and Spine conformance (SCAL/onboarding).
- **UK Core.** STU2 2.0.1 (Jul 2024) is the newest release on its history page. A later release may exist but was not verified [V, 62].

### 4.5 India (ABDM and NHCX)

- **Building blocks** [S, 65][66]:
  - ABHA (identity), HFR (facility registry; the HFR ID is the HIP ID), HPR (professional registry);
  - the Gateway and HIE-CM (consent manager);
  - HIP and HIU roles, and the PHR app.
  Clinical data is exchanged as FHIR R4 bundles per the NRCeS IG `ndhm.in` 6.5.0 (v7.0.0 in preview August 2026). The seven HI types are OPConsultNote, DischargeSummary, DiagnosticReport, Prescription, ImmunizationRecord, WellnessRecord and HealthDocumentRecord, plus an invoice artefact. Coding uses SNOMED CT, LOINC and ICD-10.
- **Milestones** [S, 66]:
  - **M1**: ABHA creation and verification, and Scan & Share registration.
  - **M2**: act as HIP; link care contexts; respond to discover/link/consent callbacks; push Fidelius-encrypted FHIR.
  - **M3**: act as HIU; raise consent requests; fetch, decrypt and purge.
  - "M4" is informal shorthand for NHCX.
  New builds use the V3 APIs.
- **Certification path.** Sandbox, then at least two milestones, then NHA functional testing, then a WASA/Safe-to-Host security audit by a CERT-In-empanelled agency, then approval and production credentials. The bridge ID is then registered in HFR [S, 66]. Third-party estimate: 3–6 months [S, 66].
- **Commercial levers** [S, 65]:
  - **DHIS**: hospitals earn ₹20 per ABHA-linked transaction above a per-bed base, capped at ₹4 crore. **Digital solution companies get 25% of facility incentives**, plus ₹5 per transaction for non-eligible facilities above 200 a month. Cumulative payouts to software companies exceeded ₹26 crore by June 2026.
  - **NABH Digital Health Standards** require **ABDM M3** and three operational Indian deployments.
  - The NMC requires HMIS integration for medical colleges.
  - State tenders (for example Rajasthan iHMS 2.0) require M1–M3.
- **NHCX.** A FHIR-based claims exchange. IRDAI's May 2024 circular directs insurers to onboard and sets one-hour cashless and three-hour discharge authorisation targets [S, 65].
- **Privacy.** DPDP Act 2023 and DPDP Rules 2025 (notified 13 Nov 2025): consent managers from 13 Nov 2026, main obligations from 13 May 2027 [S, 65][117]. Consent managers must be companies incorporated in India [S, 117]. India is a SNOMED member, so use is free under an affiliate licence [V, 23].

### 4.6 Middle East

- **Saudi Arabia.**
  - **NPHIES** is the national platform, combining the CHI financial and MOH clinical exchange models [S, 67]. The published **Healthcare Financial Services IG** (1.0.0, STU, HL7 Saudi Arabia, 3 Dec 2025) covers eligibility, prior and advanced authorisation, claims and batch claims, payment reconciliation and notice, communication request/response, cancellation, polling and status. It uses **FHIR R4 Messaging** (synchronous and asynchronous message bundles) and deliberately deviates from FHIR "best practice" to match Saudi business processes [V, 67].
  - Systems that do not conform to the required **SBS** (Saudi Billing System) code version lose NPHIES access [S, 68].
  - Saudi Arabia holds a government ICD-10-AM/ACHI/AR-DRG licence from IHACPA, as do Qatar and Bahrain. This supports the ICD-10-AM/ACHI basis of Saudi coding and SBS [S, 118].
  - Not verified this session: Wasfaty (national e-prescribing), Seha Virtual Hospital, Sehhaty, the clinical HIE (SeHE/NHIC), and PDPL/NDMO data-residency requirements [K]. Saudi Arabia is a SNOMED member [V, 23].
- **United Arab Emirates.**
  - **Malaffi** (Abu Dhabi, DoH/ADHDS): 3,144 of 3,147 signed facilities connected, 100% of hospitals; recognised as a SNOMED global reference site in Nov 2025 [V, 70]. Connectivity is a licensing prerequisite [S, 101].
  - **NABIDH** (Dubai, DHA, since Oct 2020) mandates HL7 v2, v3, CDA R2 and FHIR R4; IHE PIX, PDQ, XCA, XDS, XCPD, PDQm, PIXm and MHD; ICD-10-CM, CPT-4, HCPCS, CDT, the Dubai Drug Code and LOINC. About 60% of facilities (1,527 of ~2,550) were integrated by Mar 2025. EMRs must be at least HIMSS EMRAM stage 2 [V, 69].
  - **Riayati** (MOHAP) is mandatory for MOHAP-licensed facilities under Ministerial Resolution 156/2021, covers more than 3,000 facilities and includes an e-Claims Post Office. The three HIEs have interoperated since Jan 2023 [S, 71].
  - Each regulator has its own claims platform (DoH Shafafiya, DHA eClaimLink) [K]. Health data localisation applies under Federal Law No. 2 of 2019 [K]. The UAE uses CPT, so vendors need an AMA distribution licence [K].
- **Qatar, Oman, Bahrain.** Not verified this session (see §9).

### 4.7 Asia-Pacific

- **Australia.**
  - Sharing by Default legislation passed in February 2025. **From 1 Jul 2026**, pathology and diagnostic imaging reports must be uploaded to My Health Record unless an exception applies. Enforcement is by withholding Medicare benefits and civil penalties, and the Health Secretary has a new power to set binding data standards [S, 74]. Official ADHA and Department of Health material confirms the details:
    - Medicare benefits for in-scope services (Category 5 and 6) are payable only when the report is uploaded, and non-compliant providers may have to repay benefits or face civil penalties.
    - Only written reports are in scope; images are not.
    - Exceptions cover patient request, no My Health Record, safety concerns and technical failure. Extensions of time are possible.
    - Providers that are not uploading must display a notice to patients [S, 121]. (These official pages were seen via search-index extracts because direct fetches timed out.)

    ADHA's 8 Jul 2026 release says report uploads rose 105% (over 5 million a week) and consumer views rose 433% (over 3 million a week) as at 7 Jun 2026. Both are measured **against the 2023 announcement baseline**, not since 1 July [S, 74][121]. The 2026–27 Budget funds extension to prescribed and dispensed medicines and GP chronic-condition plans [S, 75]. In January 2026 the Government named medicines information from online prescribing services as the next share-by-default category [S, 121].
  - My Health Record is being re-platformed on FHIR with Telstra Health, and ADHA approved a FHIR operations and governance framework [S, 73].
  - AU Core 2.0.0 (trial use; AUCDI-informed; built by Sparked) [V, 72].
  - Not verified this session: HI Service (IHI, HPI-I, HPI-O), NASH, CIS conformance, ICD-10-AM/ACHI/ACS [K].
- **Singapore.** NEHR (MOH-owned, run by Synapxe) has been in place since 2011 with all public institutions contributing; private providers are onboarding progressively [V, 76]. **The Health Information Bill (HIB) was passed by Parliament on 12 Jan 2026** [V, 116].
  - All licensed healthcare providers must share key data with the NEHR: allergies, vaccinations, diagnoses, medications, lab results, radiological images and discharge summaries.
  - Contributors and accessors must meet cybersecurity and data-security requirements and notify MOH of confirmed incidents and breaches.
  - MOH "intends for the HIB to take effect from early 2027" [V, 116].

  For an HMS sold in Singapore, NEHR contribution becomes a legal requirement for the customer, so it is a product requirement for us. The exact commencement date and technical contribution specifications were not verified.
- **Japan.** JP Core 1.2.0 (R4, 30 Jul 2025), with a CLINS package for the EMR information-sharing service [V, 77]. Not verified this session: the "3 documents / 6 data" scope, online eligibility via My Number card, e-prescriptions (since 2023), the standard-type EMR initiative and the target of near-universal EMR adoption by 2030 [K]. Japan is **not** a SNOMED member [V, 23], and its national masters (MEDIS, JLAC) apply [K].
- **South Korea and China.** Not verified this session (see matrix, all [K]). In China, EMR application-level grading and interoperability maturity assessments drive hospital IT procurement. China is not a SNOMED member [V, 23].
- **Indonesia.** SATUSEHAT is FHIR-based. Facilities first register Organization, Location, Practitioner and Patient, then submit use-case bundles (outpatient, emergency, inpatient, pharmacy, ANC, TB and others). It uses ICD-10, ICD-9-CM, LOINC, SNOMED CT (affiliate licence) and KFA [V, 78]. The EMR mandate comes from Permenkes 24/2022 [K]. Indonesia is a SNOMED member [V, 23].
- **Thailand, Malaysia and the Philippines** are SNOMED members except the Philippines [V, 23]. Their national exchange details were not verified [K].

### 4.8 Africa and other low- and middle-income countries

- **OpenHIE** is the reference architecture [V, 81]. It comprises an interoperability layer (for example OpenHIM), client registry, facility registry, health-worker registry, terminology service (often OCL/CIEL), shared health record and product catalogue. IHE FHIR profiles (PIXm/PDQm, mCSD, MHD, SVCM) are used [K]. Any HMS sold into African ministries should present itself as an **OpenHIE point-of-service system**.
- **Kenya.** The Digital Health Agency mandate covers an integrated HIE and registries as the "single source of truth for clients, facilities, providers, products" [V, 79]. Its HIE exposes registries, a shared health record, and claims and pre-authorisation, using OAuth 2.0 [V, 80]. A DHA certification programme for digital health systems exists [V, 79]. Not verified this session: the Digital Health Act 2023, SHA (which replaced NHIF in 2024) and Afya Yangu [K].
- **Rwanda, Nigeria, South Africa (HNSF, NHI Act) and Ethiopia** were not verified this session [K].

### 4.9 Americas (excluding the US)

- **Canada** [V, 83][84]:
  - The **Shared Pan-Canadian Interoperability Roadmap** (March 2023).
  - **CA Core+** harmonises jurisdictional FHIR profiles and is informed by CIHI's PCHDCF and CACDI.
  - A national **FHIR terminology server**.
  - The **Connected Care Trust Framework**: common governance, the NHISA legal agreement modelled partly on TEFCA, and a common technical framework.
  - **HALO** (SMART in-EMR launch; v1.0.0 April 2025, v1.1.1 October 2025).
  - The **Pan-Canadian Conformance Platform** (launched December 2025, with sandboxes, validators and automated tests), plus Projectathons (latest February 2026).
  Not verified this session: the federal Connected Care for Canadians bill (C-72), which lapsed in 2024–25 [K]; and provincial EHRs (Netcare, ConnectingOntario, CareConnect, DSQ) [K].
- **Brazil.** RNDS is the national integration platform. It uses FHIR adapted to RNDS definitions over HTTPS, began with COVID lab notification under Portaria 1.792/2020, and extends to clinical-care records and discharge summaries [V, 82]. Not verified this session: CNS/CPF identifiers, ICP-Brasil certificate authentication, the ANS **TISS** standard for private-insurer billing, and LGPD [K]. Brazil is not a SNOMED member [V, 23].
- **Mexico and Chile.** Not verified this session (NOM-024-SSA3-2012; Chile's 2024 clinical-record interoperability law) [K].

---

## 5. Terminology and classification licensing

| Terminology | Owner | Cost model | Vendor obligations | Notes for our HMS |
|---|---|---|---|---|
| SNOMED CT | SNOMED International | **Free in 54 member territories** [V, 23]. Non-member use needs an MLDS licence, may carry fees set by World Bank band, renews annually with a Statement of Usage, and web or mobile apps attract extra fees [V, 24][25]. Low-income countries, research and "public good" uses can be exempt [S, 27] | Become an **Affiliate**, register per member country (NRC or MLDS) and **issue sublicences** to customers [V, 25] | Price SNOMED into non-member deals (IT, JP, CN, BR, MX, KE, NG, EG, OM, KW, BH, PH are not members [V, 23]). Germany's membership covers affiliates free [V, 27]. The US is a member via NLM [V, 23][99]. Qatar is also a member [V, 23]. Non-member fees are quoted on request, and fee exemptions "may be applied" [V, 24] |
| SNOMED CT Global Patient Set | SNOMED International | **Free, CC BY-ND 4.0**. IDs, FSNs, English preferred terms and active flags only, with no hierarchy [V, 26] | Attribution; no distributed derivatives without approval [V, 26] | Usable for coded exchange in non-member countries, but no subsumption, so it is not enough for full CDS |
| LOINC | Regenstrief | Free under the LOINC licence (attribution; LOINC content cannot be modified) [K] | Registration; licence notice | Universal lab and observation backbone |
| UCUM | Regenstrief | Free [K] | Attribution | Mandatory for quantities |
| ICD-11 | WHO | **Free, CC BY-ND 3.0 IGO**; "no licence fees" for implementation, integration, vendor use or national adaptation [V, 28] | Attribution; no derivatives of the classification itself | Use the WHO API or the offline container [V, 28] |
| ICD-10 (WHO) | WHO | Commercial use requires WHO permission [K] | Licence | Base for countries without a national modification |
| ICD-10-CM / ICD-10-PCS | CDC NCHS / CMS | Public domain [K] | None | US only |
| ICD-10-AM / ACHI / ACS | IHACPA (Australia) | Licensed and fee-bearing. Software vendors need an Electronic Code List licence: about A$2,000 (small business) or A$11,250, plus about A$2,000 per code list. Country licences are **government-to-government only** [S, 118] | Vendor ECL licence; a country licence must be held by the government | Used in Australia. IHACPA licensees include Saudi Arabia, Qatar, Bahrain, Singapore, New Zealand, Ireland and Turkey, among others [S, 118]. Saudi SBS is ACHI-based [K] |
| ICD-10-GM / OPS | BfArM (Germany) | Free download under BfArM terms [K] | Terms of use | DRG grouping requires certified groupers [K] |
| ICD-10-CA / CCI | CIHI (Canada) | Licensed [K] | Licence | Canada |
| OPCS-4 | NHS England (TRUD) | Free [K] | TRUD terms | England procedures |
| CCAM | CNAM / ATIH (France) | Free [K] | n/a | France procedures and fees |
| CPT | American Medical Association | **Licensed**: "any entity using CPT content anywhere worldwide must have a license", one licence per product, with royalties set by product and user type [V, 119]. The 2026 AMA distribution schedule is about US$18.50 per user for CPT Standard (seen via search index; confirm) [S, 119] | AMA distribution agreement (direct or via an authorised distributor) [V, 119] | Required in US and UAE (Dubai and Abu Dhabi use CPT [V, 69]) |
| HCPCS Level II | CMS | Public domain [K] | None | US |
| CDT (dental) | ADA | Licensed [K] | ADA licence | US, Dubai [V, 69] |
| RxNorm | NLM | Free; "a free UMLS license is required to download the full RxNorm monthly and weekly releases" [V, 120] | UMLS terms (some sources restricted) | US |
| UMLS | NLM | Free licence, with source-specific restrictions [K] | Annual usage report | Cross-mapping research only; not a runtime dependency |
| ATC/DDD | WHO Collaborating Centre, Oslo | Online index free to view; electronic files and commercial redistribution need permission or purchase [K] | Agreement with WHOCC | Drug classification, DDD stewardship |
| dm+d | NHSBSA / NHS England | Free (TRUD) [K] | TRUD terms | England medicines |
| National drug files (SFDA, DDC, KFA, AMT, MEDIS, etc.) | National regulators | Generally free to licensed providers and vendors [K] | Registration | Country packs |

**Terminology server products** (comparison for selection; licensing details [K] unless cited):

| Product | Type | Strengths | Watch-outs |
|---|---|---|---|
| **Ontoserver** (CSIRO) | Commercial FHIR terminology server | Fullest SNOMED/ECL and FHIR TS support; used as national terminology infrastructure (Australia; NHS England national terminology server) [K] | Commercial licence outside national programmes |
| **Snowstorm / Snowstorm Lite** (SNOMED International) | Open source | Native SNOMED editions, ECL, FHIR API | SNOMED-centric; LOINC and ICD need other loaders; ops burden |
| **HAPI FHIR JPA** | Open source (Apache 2.0) | General CodeSystem/ValueSet/ConceptMap; same stack as many FHIR servers | ECL and large-scale SNOMED performance weaker than dedicated servers |
| **OCL (Open Concept Lab)** | Open source | LMIC and OpenHIE standard; CIEL dictionary; collaborative mapping | Not a full SNOMED reasoner |
| **WHO ICD-API** | Free (WHO) | ICD-11 browse, search, coding tool, offline container [V, 28] | ICD-11 only |
| National servers (Infoway TS, NHS, AU NCTS, NRCeS) | Government | Authoritative national content [V, 83] | Online dependency; mirror locally |
| "Ocean" | Not verified | The user's list mentions "Ocean". Ocean Health Systems is an openEHR CDR vendor [K]; I could not verify a standalone terminology-server product under that name | Clarify which product is meant |

---

## 6. Integration engines and platforms

| Product | Model (Oct 2026) | Notes |
|---|---|---|
| **Mirth Connect (NextGen)** | **Commercial-only since 4.6 (19 Mar 2025)**. 4.5.2 is the last MPL release, and source code is no longer published for new releases [V, 85][86] | Three commercial tiers [S, 87]. Integrators estimate low-to-mid five figures per year per production instance [S, 87]. CISA advisory ICSMA-26-253-01 (10 Sep 2026) lists three CVEs (CVE-2026-82583, CVE-2026-78224, CVE-2026-82578) affecting Mirth Connect ≤ 4.7.1, and NextGen recommends updating to 4.7.2 or later [V, 114]. Customers stuck on 4.5.2 carry security debt; OIE had merged the fixes but not yet released them as of Oct 2026 [S, 87] |
| **Open Integration Engine (OIE)** | Community MPL 2.0 fork of the open-source Mirth codebase (4.5.2 per [87]) that runs existing Mirth channels [V, 115][S, 87]. It is now the **Eclipse Open Integration Engine**, an "Incubating" Eclipse Foundation project: the proposal was posted 4 Jun 2026, and incubation began 7 Sep 2026 per [87] [V, 115] | Viable for low-cost, on-premise LMIC deployments; governance is still maturing. BridgeLink and OpenShare are other forks [S, 87] |
| **Rhapsody / Corepoint** (Rhapsody Health) | Commercial [S, 87] | Strong in Australia, New Zealand, the UK and the US; enterprise-grade |
| **InterSystems HealthShare Health Connect (IRIS)** | Commercial [S, 87] | Dominant in parts of Europe and the Middle East; a platform commitment |
| **Infor Cloverleaf** | Commercial [S, 87] | Large US/EU installed base; TCL scripting |
| **Iguana** (iNTERFACEWARE) | Commercial [S, 87] | Lua scripting; developer-friendly |
| **Qvera QIE** | Commercial [S, 87] | Mirth-conversion tooling |
| **Apache Camel** (plus HAPI v2/FHIR libraries) | Open source [S, 87] | Build-your-own; strong for embedded product engines |
| **OpenHIM** | Open source [K] | OpenHIE interoperability layer |
| **Azure Health Data Services** | Cloud PaaS | **Azure API for FHIR deprecated 30 Sep 2026**; move to the AHDS FHIR service [V, 88] |
| **Google Cloud Healthcare API** | Cloud PaaS | Managed FHIR, HL7 v2 and DICOM stores [S, 87] |
| **AWS HealthLake / HealthImaging** | Cloud PaaS | FHIR R4, SMART, Bulk, integrated NLP, C-CDA/CSV-to-FHIR transformation agent (preview), duplicate-record linking (preview) [V, 89] |
| **Redox** | Network-as-a-service | One API to many US EHRs; useful for US go-to-market without building every interface [S, 87] |
| **Health Gorilla** | Network and QHIN | Designated QHIN; a TEFCA on-ramp [V, 41] |

---

## 7. Interoperability architecture for our HMS

This aligns with `11-canonical-domain-model.md`, which uses "FHIR as the vocabulary of the domain, not necessarily as the storage schema".

### 7.1 Canonical model versus a FHIR-native store

**Recommendation: a domain-owned canonical model with a FHIR façade, *not* a FHIR-native store as the system of record.**

Rationale:
1. **The HMS is transactional and ERP-heavy.** ADT, beds, orders and tasks, closed-loop medication, charge capture, inventory, procurement and HR are state machines with invariants. FHIR resources are exchange shapes. Several ERP-relevant resources are being moved out of FHIR core in R6, including ChargeItem, Invoice, Contract, InsurancePlan, SupplyRequest and SupplyDelivery [V, 3].
2. **Version churn.** R4 regulation today and R6 tomorrow, plus R6's reorganised medication dosage [V, 3], mean persisting FHIR R4 JSON as the source of truth would force a data migration later.
3. **Country divergence.** NPHIES messaging [67], ABDM bundles with Fidelius encryption [66], ISiK REST [54], US Core REST [7] and EEHRxF documents [51] are *projections* of the same facts. Each is a profile pack, not a schema.

The design pattern:
- **Domain services** own aggregates and emit **domain events** (for example `PatientAdmitted`, `OrderSigned`, `ResultFinalised`, `DoseAdministered`, `ChargePosted`).
- A **FHIR projection service** maintains a materialised R4 resource store, fed by change data capture or events, for read and search, `$export`, `$summary`/IPS, `$docref`, and Subscriptions (R5 backport).
- **FHIR writes** are accepted for a bounded set (Appointment, QuestionnaireResponse, DocumentReference, Observation from devices and patients, Consent, Task) and translated into domain commands. They are never written straight into the projection.
- **Every coded element** keeps the local code, standard code(s), display, original text and code-system *version*. Every record carries provenance, including interface, device or AI source.
- **The internal model is versioned independently.** The façade supports **multiple FHIR versions side by side** (R4 now; R6 added once national IGs require it), with mapping per version.

**Cross-report note (reconciled 2026-10-16): core data architecture.** `02` (exec #3/#4/#14, §7, §9, §10.1) originally ranked a FHIR-native core (self-hosted Medplum or HAPI FHIR JPA) first. `09` §9.1 #2 said "FHIR-first internal API", and `10` §8 said "platform-first (FHIR-native)". The reconciled ADR-001 posture is this section's:
- domain aggregates and state machines in PostgreSQL, one database per tenant (`08` §3.11);
- clinical facts stored as typed, FHIR-shaped JSONB, so their projection is close to identity and this design does not create the "translation at the core" problem `02` warns about;
- a generated FHIR R4 projection/façade for reads, `$export`, IPS and Subscriptions, with writes through domain commands;
- HAPI structures, validator and v2 libraries embedded.

Medplum is a reference design and an optional component source, not the system of record. `02` §10.1 keeps a 6–8 week load and safety spike, comparing this design with a FHIR-native core on a 1,000-bed workload, as the gate before ADR-001 is frozen. `02`, `09` and `10` now use this wording, and `09`/`10` say "FHIR-first external/partner API".

### 7.2 Integration runtime

- **Build a first-party "Interface Gateway"** as part of the product, on proven open libraries (HAPI v2/FHIR or equivalent, a DICOM toolkit, and a Camel-style routing core). It handles:
  - HL7 v2 over MLLP/TLS, with conformance profiles per interface and per-patient ordering;
  - FHIR REST client and server;
  - FHIR messaging (NPHIES);
  - DICOM MWL, MPPS and DICOMweb;
  - CLSI LIS2-A2 and IHE LAW through lab middleware;
  - X12 (US only, later);
  - national adapters packaged as plug-ins (ABDM bridge with Fidelius, NPHIES, Malaffi/NABIDH/Riayati, SATUSEHAT, ISiK, PDS/MESH/NRL, TI connector/KIM, DMP/MSSanté/INSi).
- **Coexist with hospital enterprise engines.** Large customers already run Rhapsody, InterSystems or Cloverleaf. Ship certified channel templates for them rather than trying to replace them.
- **Optional third-party engine for site transforms (reconciled 2026-10-16 with `02` §9 and `08` §12.5).** This "Interface Gateway" is the same component `08` calls the native **Integration Hub**. It owns MLLP/v2, FHIR, DICOM and national adapters, with ack-state and replay. Eclipse Open Integration Engine (MPL-2.0), or the customer's Rhapsody/Cloverleaf, may run as an **optional** engine for site-specific transforms only. A patch-lag policy governs it. OIE v4.6.0 (9 Jul 2026) was still its latest release on 16 Oct 2026, and the Sep 2026 CVE fixes were merged but not released [124]. The policy therefore requires CVE monitoring, plus a patched build or compensating controls if upstream misses the SLA.
- **No hard dependency on Mirth commercial** [85], on a single cloud FHIR service [88], or on any one network vendor. Abstract cloud services behind ports. Data-residency rules in the Gulf, India and the EU will often force on-premise or in-country deployment [K].

### 7.3 Terminology strategy

- Run an internal **FHIR Terminology Service** ($lookup, $validate-code, $expand, $translate, $subsumes) as a platform component. Use **Snowstorm** for SNOMED editions where we hold rights, **HAPI** or an equivalent for LOINC, ICD, national code systems and ConceptMaps, the **WHO ICD-API container** for ICD-11 [28], and **OCL** for OpenHIE/LMIC customers. Evaluate **Ontoserver** where it is national infrastructure.
- **Content packs per jurisdiction** carry editions, value sets, ConceptMaps (for example local lab code to LOINC, charge item to national procedure code) and licence entitlements. The **licence entitlement service** tracks SNOMED affiliate registration and sublicensing per tenant and country, CPT seats, IHACPA and CIHI licences, and non-member SNOMED Statements of Usage [25].
- **Local-first mapping workflow.** Hospitals start with local catalogues. Mapping uses LIVD imports for labs [21], with assisted and AI-suggested mapping followed by human sign-off. Mapping coverage is tracked as a go-live metric.
- **Dual coding for classifications.** Keep the national ICD-10 modification for billing and ICD-11 for statistics where it is required [28]. Generate classification codes from SNOMED-coded clinical data through published maps where available [K].

### 7.4 Profile and IG management per country

- Treat every national requirement as an **NPM-packaged "Country Pack"** containing:
  - IG dependencies (US Core, UK Core, AU Core, CA Core+, `ndhm.in`, `nphies-fs`, ISiK, HL7 EU, JP Core);
  - identifier `system` URIs (NHS Number, IHI, ABHA, Emirates ID, INS, KVNR, NIK);
  - consent rules;
  - document templates;
  - endpoints and certificates;
  - claims dialects;
  - data-residency policy.
- **Conformance in CI.** Validate every outbound artefact with the HL7 FHIR validator against pinned IG versions, and run the national test suites in pipelines: Inferno for (g)(10), gematik Tiger for ISiK [54], the ABDM sandbox [66], the Infoway conformance platform [83], ANS Ségur tests [58] and the EU Art. 40 testing environment when available [51].
- **Track regulatory dates as product requirements**, with owners for each. The key dates are those in the matrix in §4.1.

### 7.5 Identity, security, audit and consent (cross-cutting)

- **EMPI.** Probabilistic Fellegi–Sunter matching with a deterministic national-ID shortcut. Expose PIXm, PDQm and `$match`, and emit v2 A40/A47 and FHIR link events. Integrate with national registries (PDS, HI Service, ABHA, INSi, SATUSEHAT).
- **Authorisation server.** SMART App Launch 2.2 (EHR launch, standalone launch, backend services, PKCE, granular scopes, token introspection) [8]. UDAP for US B2B [42]. Mutual TLS for national gateways.
- **Audit.** ATNA syslog plus FHIR AuditEvent (BALP) plus Provenance. Design the EHDS **logging component** as a separable, testable module now [51].
- **Consent engine.** Evaluate FHIR Consent and PCF policies, ABDM consent artefacts, purpose-of-use (CMS Framework [45]) and security labels (US Part 2).

---

## 8. Implications for our build (phased and opinionated)

### Phase 0: Foundations required for any market (build before the first customer)

1. **Coded-data discipline in the canonical model:** local plus standard codes, code-system versions, UCUM units, provenance and AI labelling. Retrofitting this later is ruinous.
2. **Terminology service plus licence-entitlement service** (§7.3).
3. **EMPI** with configurable matching and national-ID plug-ins.
4. **HL7 v2 engine**, minimum set: ADT (A01–A13, A28/A31, A40), OML/ORM, ORU, SIU, DFT/BAR, MDM, RDE/RDS/RAS, VXU and MFN. Enhanced ACKs and MLLP over TLS. Use v2-to-FHIR IG mappings [17].
5. **Imaging:** DICOM MWL and MPPS, DICOMweb viewer launch, and OMI/ORU with RIS.
6. **Lab:** LOINC/UCUM catalogue, LIVD import [21] (the LIVD FHIR IG is still at ballot stage, so pin to the version manufacturers actually publish [110]), and analyser connectivity through middleware.
7. **FHIR R4 façade:**
   - IPA 1.1.0 conformance [12];
   - **IPS 2.0.x `$summary` generation** (target 2.0.1) [13][111];
   - Bulk `$export` [9];
   - topic-based Subscriptions (backport) [18];
   - SMART 2.2 with Backend Services [8];
   - CDS Hooks *client* (patient-view, order-select, order-sign) [10].
8. **Audit and consent:** ATNA/BALP plus Provenance, built as an EHDS-shaped logging module [51].
9. **Security baseline:** ISO 27001 and SOC 2 Type II [K]. HITRUST becomes relevant for the US through the CMS Framework [45]. Clinical-safety case process (DCB0129-style) from the start [K].

### Phase 1: Launch markets (recommended: India and the GCC, then Indonesia or Kenya)

**Cross-report note (reconciled 2026-10-16): one market roadmap for the pack.** `01` §12.1, `05` §9.4, `07` §9.2, `09` §9.2 and this section used different sequences. The reconciled roadmap is:
- **Wave 1:** India + KSA.
- **Wave 1b:** UAE (Malaffi/NABIDH/Riayati adapters, DoH/DHA e-claims).
- **Wave 2:** *one* of Indonesia, Kenya or another SE Asian market. DACH enters only through a TI-experienced partner.
- **Wave 3 candidates, decided case by case:** the other Phase 2 markets below (EU-wide, France, UK, Australia, Canada). Their long-lead "no-regret" engineering (IPS, an EHDS-shaped logging component, a DCB0129-style safety case) still starts now.
- **US:** a Phase 3 go/no-go. ONC/HITRUST and Da Vinci work in `07`/`09` moves there, retargeted to the 19 criteria HTI-5 would retain (§4.2).

The bullets below keep their detail, but the UAE now follows India + KSA.

Why these first: mandates are explicit and vendor-certifiable, SNOMED is free (India, Saudi Arabia, UAE and Indonesia are members [23]), FHIR R4 dominates, and buyers pay for compliance.

- **India:** ABDM **M1 + M2 + M3** on the V3 APIs, with NRCeS bundles (`ndhm.in` 6.5.0, watching v7) [65][66]. Then **NHCX** claims [65], the **NABH DHS** listing (needs M3 and three deployments) [65], and DPDP-ready consent [65]. Commercial upside comes from DHIS revenue share [65].
- **UAE:** adapters for Malaffi, NABIDH and Riayati. NABIDH needs **v2, CDA, FHIR and IHE XDS/XCA/PIX/PDQ/MHD** [69]. Build ICD-10-CM/CPT/HCPCS/DDC/LOINC packs [69], add the regulator e-claims connectors (DoH, DHA) [K], and secure an **AMA CPT distribution licence** [K]. Deploy in-country [K].
- **Saudi Arabia:** NPHIES FHIR messaging (eligibility through payment) [67], **SBS** code packs [68], ICD-10-AM/ACHI licensing [K] and Wasfaty e-prescribing [K]. Deploy in-country [K].
- **Indonesia or Kenya** (pick one): SATUSEHAT FHIR submission bundles [78], or Kenya DHA certification plus the HIE, registries and SHA claims [79][80]. Position the product as an OpenHIE point-of-service system [81].

### Phase 2: Regulated high-income markets (start engineering now, because lead times are long)

*(Reconciled 2026-10-16: these are **Wave 3 candidates** for market entry. Germany is a Wave 2 option only through a partner. The "start engineering now" advice applies to the no-regret items, such as IPS, HL7 Europe IGs and the EHDS logging component. It does not mean these markets get certification spend in the first 24 months. See the cross-report note under Phase 1.)*

- **EU-wide (EHDS):** a product team dedicated to the **European interoperability component** (EEHRxF import/export) and the **logging component**, technical documentation, Art. 40 testing, the EU declaration of conformity, CE marking and EU database registration. **Hard date: 26 Mar 2029 for Group 1.** Track the Art. 15 and Art. 36 implementing acts, due 26 Mar 2027 [51]. Build against HL7 Europe IGs and IPS now as "no-regret" work [22][13]. Also map the overlap with the AI Act and the Cyber Resilience Act [51].
- **Germany:** ISiK Stufe 5 confirmation (Stufe 3 for any earlier sale) [54], TI connectivity for ePA (filling obligations since 1 Oct 2025), E-Rezept, KIM and TI-Messenger [55], ICD-10-GM/OPS, and §301 billing exchange [K]. Expect high effort, so partner with a TI-experienced integrator.
- **France:** if entering, Ségur DPI listing (the V2 windows closed 30 Jun 2026 [58]), so plan for the next wave or a regional opportunity, plus INS/INSi, DMP, MSSanté, Pro Santé Connect and CCAM/PMSI [K]. This is a high-barrier, low-margin market; entry is optional.
- **United Kingdom:** DTAC, DSPT, DCB0129, Cyber Essentials Plus and Spine onboarding (PDS, NRL, MESH, e-RS, EPS, GP Connect, NHS login), plus SNOMED CT, dm+d, OPCS-4 and SUS/ECDS feeds [K]. Watch the DUAA accreditation scheme regulations [63].
- **Australia:** My Health Record conformance (pathology and DI reports under Sharing by Default from 1 Jul 2026 [74]), AU Core 2.0 [72], HI Service, eRx and ICD-10-AM/ACHI [K].
- **Canada:** CA Core+ and HALO SMART launch, validated on the Pan-Canadian Conformance Platform [83].

### Phase 3: The United States (a deliberate go/no-go decision)

- **Cost of entry:** ONC certification. Under HTI-5 the burden falls to about 19 criteria, but **(b)(10) EHI Export, (g)(10) FHIR API, CPOE, e-Rx (SCRIPT 2023011 + RTPB by 2028), CQMs, public health, and HTI-4 ePA** remain [32][34]. Add TEFCA connectivity through a QHIN, CMS Aligned Network expectations (IAL2, 24-hour availability, notifications) [45], X12 claims, CMS-0057-F payer APIs (1 Jan 2027) [103] and HIPAA/Part 2.
- **Recommendation:** do not lead with the US. US-only work in the other reports (ONC/HITRUST in `07` §9.2, Da Vinci CRD/DTR/PAS in `09` §9.2) now sits in this phase (reconciled 2026-10-16). If the opportunity arises, target segments underserved by Epic and Oracle (specialty, behavioural and rural hospitals), use **Redox or Health Gorilla** as an on-ramp [87][41], and certify the (b)(10)/(g)(10) set first. HTI-5's FHIR-first direction lowers the long-run cost [33].

### Cross-phase "no-regret" engineering choices

- **FHIR version.** R4 now. Design mapping layers so R6 can be added in 2027–2028 without changing the internal model [1][3]. Do not adopt R5 broadly; use the backports instead.
- **IPS everywhere.** IPS is the common denominator for EHDS, ABDM, AU, CA, CMS and cross-border patients [13][15].
- **Subscriptions-based eventing** for notifications (CMS, ISiK, ePA) [18][45][54].
- **Documents.** Generate PDF/A plus a structured document (CDA or FHIR Document) from the same source. Many exchanges still want CDA (NABIDH, MHR, eHDSI), while CMS wants FHIR attachments [45][69][73].
- **AI and automation.** In the US, the information-blocking definitions are expanding to cover autonomous AI access [31]. Design API rate-limit and fairness policies with this in mind, and label AI-generated content with Provenance.

---

## 9. Uncertainty register (verify before committing)

| Item | Why uncertain | How to resolve |
|---|---|---|
| HTI-5 final rule publication and final criteria list | No final rule in the Federal Register as of 16 Oct 2026. The FY 2027 IPPS final rule (4 Aug 2026) says it will follow; the Unified Agenda targeted Aug 2026 [33][102] | Check healthit.gov/hti5 and the Federal Register |
| ~~USCDI v7 final~~ **Resolved in pass 2** | v7 was released 23 Jul 2026 [105]. Its SVAP and certification adoption date is still open | Watch the 2027 SVAP cycle and HTI rulemaking |
| EEHRxF FHIR version and the Art. 36 common specifications | Pending implementing acts [51] | EUR-Lex; Commission comitology register |
| EHDS Chapter III date for in-house systems (2029 vs 2031) | Commentators disagree [53] | Art. 105 text on EUR-Lex [52] |
| UK Core latest release after 2.0.1; NHS API onboarding details | digital.nhs.uk blocked automated fetch | Manual review of the NHS developer hub |
| ABDM official DHIS terms after 2025 | Only a secondary source [65] | NHA/ABDM circulars |
| NPHIES clinical HIE scope; Wasfaty, SeHE and Saudi data-residency rules | CHI portal unreachable | CHI/NHIC documentation |
| Qatar, Oman, Bahrain, Korea, China, Thailand, Malaysia, Philippines, NZ, Rwanda, Nigeria, South Africa, Ethiopia, Mexico, Chile details | Search quota exhausted. Pass 2 resolved Singapore's HIB status (passed 12 Jan 2026; intended effect early 2027) [116] | Dedicated follow-up research sprint; Singapore HIB commencement notice and NEHR contribution specifications |
| LOINC licence terms and current release number | loinc.org returned 403 in both passes | Manual check of loinc.org/license and the release page |
| SNOMED non-member fee levels | Quoted on request [24] | Request a quote from SNOMED International via MLDS |
| ~~Mirth September 2026 CVE and OIE Eclipse claims~~ **Resolved in pass 2** | Confirmed by CISA ICSMA-26-253-01 [114] and the Eclipse project page [115] | n/a (an OIE release that contains the fixes is still pending) |

---

## 10. Sources

1. HL7 FHIR CI build, v6.0.0-snapshot1 (15 Oct 2026). https://build.fhir.org/
2. HL7 FHIR R6 ballot 5 (17 Jul 2026). https://hl7.org/fhir/6.0.0-ballot5/index.html
3. HL7 FHIR R6 Ballot Notes (ballot-intro). https://build.fhir.org/ballot-intro.html
4. HL7 FHIR version history. https://hl7.org/fhir/history.html
5. Saga IT, "FHIR R4 vs R5 vs R6: 2026 Comparison". https://saga-it.com/blog/fhir-r4-vs-r5-vs-r6
6. Health Samurai, "FHIR R6 Release Date & What's New". https://www.health-samurai.io/articles/getting-ready-for-fhir-r6-what-you-need-to-know
7. HL7 US Core IG (9.0.0). https://hl7.org/fhir/us/core/
8. HL7 SMART App Launch (2.2.0). https://hl7.org/fhir/smart-app-launch/
9. HL7 Bulk Data Access IG. https://hl7.org/fhir/uv/bulkdata/
10. HL7 CDS Hooks (2.0.1). https://cds-hooks.hl7.org/
11. HL7 FHIRcast (3.0.0). https://fhircast.hl7.org/
12. HL7 International Patient Access (1.1.0). https://hl7.org/fhir/uv/ipa/
13. HL7 International Patient Summary IG (2.0.0). http://hl7.org/fhir/uv/ips/index.html
14. HL7 Product Brief, IPS Edition 2. https://www.hl7.org/implement/standards/product_brief.cfm?product_id=535
15. EN ISO 27269:2025 catalogue entry. https://standards.iteh.ai/catalog/standards/cen/9b27a2df-ce24-4ff5-b9bf-42ef46d09eca/en-iso-27269-2025
16. international-patient-summary.net, "Updated IPS standards are now available" (Dec 2025). https://international-patient-summary.net/updated-ips-standards-are-now-available/
17. HL7 V2-to-FHIR IG (1.0.0). https://hl7.org/fhir/uv/v2mappings/
18. HL7 Subscriptions R5 Backport IG (1.1.0). https://hl7.org/fhir/uv/subscriptions-backport/
19. HL7 C-CDA (5.0.0). https://hl7.org/cda/us/ccda/
20. DICOM Standard, current edition. https://www.dicomstandard.org/current
21. HL7 LIVD IG. https://build.fhir.org/ig/HL7/livd/
22. HL7 Europe FHIR IG portal. https://hl7.eu/fhir/
23. SNOMED International, Members. https://www.snomed.org/members
24. SNOMED International, Get SNOMED CT. https://www.snomed.org/get-snomed
25. SNOMED CT Vendor Introduction, Licensing. https://docs.snomed.org/snomed-ct-practical-guides/vendor-introduction-to-snomed-ct/7-licensing
26. SNOMED International, Global Patient Set. https://www.snomed.org/gps
27. BfArM, SNOMED CT affiliate licence. https://www.bfarm.de/EN/Code-systems/Terminologies/SNOMED-CT/affiliate-licence/_node.html
28. WHO, ICD-11 Fact Sheet (May 2026). https://icd.who.int/en/docs/ICD11_Fact_Sheet_2026.pdf
29. openEHR Specifications. https://specifications.openehr.org/
30. ASTP/ONC, HTI-5 proposed rule page. https://www.healthit.gov/hti5
31. AHA, "ASTP/ONC proposes deregulatory actions, withdraws HTI-2 proposals" (23 Dec 2025). https://www.aha.org/news/headline/2025-12-23-atsponc-proposes-deregulatory-actions-withdraws-hti-2-proposals
32. McDermott Will & Emery, "ASTP's HTI-5 relaxes certification criteria while tightening information blocking exceptions". https://www.mcdermottlaw.com/insights/astps-hti-5-relaxes-certification-criteria-while-tightening-information-blocking-exceptions/
33. Pacific AI, "HTI-5 removes 34 of 60 certification criteria". https://pacific.ai/hti-5-removes-certification-criteria/
34. ASTP/ONC, HTI-4 Final Rule Overview Fact Sheet (Jul 2025). https://www.healthit.gov/sites/default/files/page/2025-07/HTI-4%20Final%20Rule%20Overview%20Fact%20Sheet_508%20(1).pdf
35. HIMSS, "ASTP/ONC updates certification criteria and standards in HTI-4 final rule". https://www.himss.org/news-center/astp-onc-updates-health-it-certification-criteria-and-standards-in-hti-4-final-rule/
36. ASTP/ONC, USCDI Version 6 (Jul 2025). https://isp.healthit.gov/sites/default/files/2025-07/USCDI-Version-6-July-2025.pdf
37. ASTP/ONC Standards Bulletin 2025-2. https://www.healthit.gov/topic/standardsbulletin_25-2
38. ASTP/ONC, Standards Version Advancement Process. https://www.healthit.gov/topic/standards-version-advancement-process-svap
39. ASTP/ONC, Test Method §170.315(g)(10). https://www.healthit.gov/test-method/standardized-api-patient-and-population-services
40. ASTP/ONC, Information Blocking. https://www.healthit.gov/topic/information-blocking
41. Sequoia Project RCE, Designated QHINs. https://rce.sequoiaproject.org/designated-qhins/
42. ONC blog, "FHIR Roadmap for TEFCA Exchange V.2". https://healthit.gov/blog/interoperability/fhir-roadmap-for-tefca-exchange-v-2-fhir-apis-are-on-their-way-into-tefca-exchange/
43. Medplum, "Technical Guide to TEFCA". https://www.medplum.com/blog/technical-guide-to-tefca
44. Saga IT, "TEFCA Integration Guide 2026". https://saga-it.com/blog/tefca-integration-guide
45. CMS, Interoperability Framework. https://www.cms.gov/health-technology-ecosystem/interoperability-framework
46. CMS press release, "White House, Tech Leaders Commit to Create Patient-Centric Healthcare Ecosystem" (30 Jul 2025). https://www.cms.gov/newsroom/press-releases/white-house-tech-leaders-commit-create-patient-centric-healthcare-ecosystem
47. CMS, Health Tech Ecosystem data-network pledgees. https://www.cms.gov/initiatives/health-technology-ecosystem/overview/early-adopters-all-pledgees/data-networks
48. Oracle, "Oracle Health Achieves CMS Aligned Network Status" (20 Apr 2026). https://www.oracle.com/news/announcement/oracle-health-demonstrates-interoperability-leadership-2026-04-20/
49. b.well, "b.well's CMS Aligned Network Goes Live" (Jul 2026). https://resources.icanbwell.com/bwells-cms-aligned-network-goes-live-real-patient-data-now-exchanging-across-major-health-plans-digital-platforms-and-health-systems/
50. European Commission, European Health Data Space Regulation. https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en
51. A. Berler, "The European Health Data Space" (e-health-suisse briefing, 23 Sep 2026; cites Commission FAQ of 26 Mar 2026 and EUR-Lex status of 22 Sep 2026). https://www.e-health-suisse.ch/payload/api/documents/file/European%20Health%20Data%20Space%20September%202026.pdf?prefix=documents
52. EUR-Lex, Regulation (EU) 2025/327. https://eur-lex.europa.eu/eli/reg/2025/327/oj/eng
53. kdevlabs, "Why EHDS compliance changes what you build, and when". https://kdevlabs.com/blog/ehds-compliance-health-tech-vendors
54. gematik Fachportal, ISiK. https://fachportal.gematik.de/zielgruppen/primaersystemhersteller/isik
55. Bundesministerium für Gesundheit, "Die ePA für alle". https://www.bundesgesundheitsministerium.de/themen/digitalisierung/elektronische-patientenakte/epa-fuer-alle
56. Solidaris, "Elektronische Patientenakte: Neue Pflichten und Sanktionen". https://www.solidaris.de/aktuelles/elektronische-patientenakte-neue-pflichten-und-sanktionen-fuer-arztpraxen-und-krankenhaeuser
57. Verbraucherzentrale, "Elektronische Patientenakte (ePA)". https://www.verbraucherzentrale.de/wissen/gesundheit-pflege/krankenversicherung/elektronische-patientenakte-epa-digitale-patientenakte-fuer-alle-kommt-57223
58. ANS, "Le dispositif DPI Vague 2 du Couloir Hôpital". https://esante.gouv.fr/ens/segur-numerique-sante/vague-2/dispositif-dpi-couloir-hopital
59. ANS, "Ségur numérique : mise à jour du calendrier réglementaire (Vague 2 à l'hôpital)". https://esante.gouv.fr/espace-presse/segur-numerique-mise-jour-du-calendrier-reglementaire-pour-les-dispositifs-de-la-vague-2-lhopital
60. DSIH, "Le DPI Sillage obtient le référencement Ségur V2". https://dsih.fr/articles/6183/le-dpi-sillage-obtient-le-referencement-segur-v2
61. Fascicolo Sanitario Elettronico, FSE 2.0. https://www.fascicolosanitario.gov.it/it/fse-2.0
62. Simplifier.net, UK Core version history. https://simplifier.net/guide/ukcoreversionhistory
63. legislation.gov.uk, Data (Use and Access) Act 2025, Schedule 15. https://www.legislation.gov.uk/ukpga/2025/18/schedule/15
64. Wikipedia, "Single Patient Record". https://en.wikipedia.org/wiki/Single_Patient_Record
65. Caladrius Health, "ABDM for EHR Vendors" (25 Sep 2026). https://caladriushealth.ai/blog/2026/09/25/ABDM-for-EHR-Vendors/
66. Nirmitee, "ABDM Milestones M1, M2, M3 and M4 Explained (2026)". https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/
67. NPHIES, Healthcare Financial Services IG Edition 1 (1.0.0). https://portal.nphies.sa/ig/index.html
68. CHI, SBS V3 Information Systems Implementation. https://www.chi.gov.sa/Rules/DocLib2/SBS_V3_Information%20Systems%20Implementation.pdf
69. PMC, "Health Information Exchange as a Strategy for Advancing the Modernization of Healthcare Ecosystem in the Emirate of Dubai". https://pmc.ncbi.nlm.nih.gov/articles/PMC12611100/
70. Malaffi. https://www.malaffi.ae/
71. Pabau, "What is Riayati?". https://pabau.com/blog/what-is-riayati/
72. HL7 Australia, AU Core (2.0.0). https://hl7.org.au/fhir/core/
73. Australian Digital Health Agency, Annual Progress Report Jul 2025–Jun 2026. https://www.digitalhealth.gov.au/sites/default/files/documents/annual-2025-6-interoperability-plan-and-hi-roadmap-july-25-june-26.pdf
74. ADHA, "Australians already seeing the benefits of sharing health information by default". https://www.digitalhealth.gov.au/newsroom/media/australians-already-seeing-the-benefits-of-sharing-health-information-by-default
75. Healthcare IT News, "Budget 2026: Australia funds $400M more for My Health Record". https://www.healthcareitnews.com/news/anz/budget-2026-australia-funds-400m-more-my-health-record
76. Synapxe, National Electronic Health Record (NEHR). https://www.synapxe.sg/healthtech/national-programmes/national-electronic-health-record-nehr
77. JP Core FHIR IG. https://jpfhir.jp/fhir/core/
78. Kemenkes, SATUSEHAT Platform FHIR documentation. https://satusehat.kemkes.go.id/platform/docs/id/fhir/
79. Kenya Digital Health Agency. https://dha.go.ke/
80. Kenya HIE API documentation. https://hie-docs.dha.go.ke/
81. OpenHIE Architecture Specification. https://guides.ohie.org/arch-spec/
82. Ministério da Saúde, RNDS integration guide. https://rnds-guia.saude.gov.br/docs/introducao/
83. Canada Health Infoway, Market Guidance Volume 2 (Mar 2026). https://www.infoway-inforoute.ca/en/component/edocman/6595-market-guidance-volume-2/view-document
84. Canada Health Infoway, Connected Care Trust Framework. https://www.infoway-inforoute.ca/en/featured-initiatives/connected-care-trust-framework
85. NextGen Healthcare, Mirth Connect GitHub wiki. https://github.com/nextgenhealthcare/connect/wiki
86. NextGen Healthcare, "A New Era for Mirth Connect". https://www.nextgen.com/blog/industry-news/a-new-era-for-mirth-connect-by-nextgen-healthcare
87. Saga IT, "Mirth Connect Alternatives 2026". https://saga-it.com/blog/mirth-connect-alternatives
88. Microsoft Learn, "What is Azure API for FHIR?" (deprecation notice). https://learn.microsoft.com/en-us/azure/healthcare-apis/azure-api-for-fhir/overview
89. AWS, "What is AWS HealthLake?". https://docs.aws.amazon.com/healthlake/latest/devguide/what-is.html
90. IHE International, Profiles. https://www.ihe.net/resources/profiles/
91. ASTP/ONC, Electronic Prior Authorization Fact Sheet (Oct 2025). https://www.healthit.gov/wp-content/uploads/2025/10/ePA_fact_sheet_OCT2025_508.pdf
92. KFF, "Charting the Way Forward: New Efforts to Advance Electronic Health Information Sharing". https://www.kff.org/patient-consumer-protections/charting-the-way-forward-new-efforts-to-advance-electronic-health-information-sharing/
93. Flexpa, "Flexpa Reaches Production as Kill the Clipboard Early Adopter". https://www.flexpa.com/blog/flexpa-reaches-production-kill-the-clipboard
94. Healthcare IT News, "ASTP/ONC seeks relaxation of health IT certification criteria with HTI-5". https://www.healthcareitnews.com/news/astponc-seeks-relaxation-health-it-certification-criteria-hti-5
95. Deutsches Ärzteblatt, "Ab Anfang Oktober ePA-Nutzung für Praxen verpflichtend". https://www.aerzteblatt.de/news/ab-anfang-oktober-epa-nutzung-fur-praxen-verpflichtend-13f0e40a-c05e-4417-9c90-521f93730fb7
96. Docaposte, "Ségur Vague 2 : Docaposte Santé fait référencer ses deux DPI". https://www.docaposte.com/presse/communique-de-presse/segur-vague-2-docaposte-sante-fait-referencer-ses-deux-dpi
97. ICD10monitor, "ICD-11 in 2025: Evolution, Global Progress, and What to Watch". https://medlearn.com/icd10monitor/icd-11-in-2025-evolution-global-progress-and-what-to-watch/
98. Healthcare Innovation, "TEFCA QHIN-to-QHIN FHIR Exchange to be Piloted in 2025". https://www.hcinnovationgroup.com/interoperability-hie/trusted-exchange-framework-and-common-agreement-tefca/news/53083106/tefca-qhin-to-qhin-fhir-exchange-to-be-piloted-in-2025
99. US NLM, Licensing SNOMED CT. https://www.nlm.nih.gov/healthit/snomedct/snomed_licensing.html
100. ASTP/ONC, HTI-5 Proposed Rule Overview Presentation (19 Feb 2026). https://healthit.gov/wp-content/uploads/2026/02/2026-02-19_HTI-5_Proposed_Rule_Overview_Presentation_508.pdf
101. Bonami Software, "Malaffi Integration (Abu Dhabi)". https://www.bonamisoftware.com/malaffi-integration
102. Federal Register: API search for "HTI-5" (accessed 16 Oct 2026; no final rule returned), and the FY 2027 IPPS/LTCH PPS final rule, 91 FR 49570, Doc. 2026-15833 (4 Aug 2026; effective 1 Oct 2026; states that the HTI-5 final rule "will be issued after this final rule is published"). https://www.federalregister.gov/d/2026-15833
103. CMS, "CMS Interoperability and Prior Authorization Final Rule (CMS-0057-F)". https://www.cms.gov/priorities/key-initiatives/burden-reduction/interoperability/policies-and-regulations/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
104. HHS-OIG, Information Blocking (featured topic). https://oig.hhs.gov/reports-and-publications/featured-topics/information-blocking/
105. ONC, Standards Bulletin 2026-2 (USCDI v7, released 23 Jul 2026). https://healthit.gov/standards-and-technology/onc-standards-bulletin/onc-standards-bulletin-2026-2/
106. HL7 Product Brief, "HL7 Messaging Standard Version 2.9.1" (normative, status date 5 Sep 2024), and HL7 Standups, "Normative Publication of … Version 2.9.1" (6 Sep 2024). https://www.hl7.org/implement/standards/product_brief.cfm?product_id=649 (seen via search index; direct fetch returned an empty page)
107. HL7 Structured Data Capture IG, version list (4.0.0 STU4, 24 Mar 2026). https://hl7.org/fhir/uv/sdc/package-list.json
108. HL7 Clinical Quality Language 2.0.0 (R2 STU1, active 29 Jul 2026). https://cql.hl7.org/
109. HL7 UDAP Security IG, version list (2.0.0 STU2, 9 Dec 2025). https://hl7.org/fhir/us/udap-security/package-list.json
110. HL7 LIVD IG, version list (latest: 1.0.0-ballot, 21 Dec 2023). https://hl7.org/fhir/uv/livd/package-list.json
111. HL7 IPS IG, version list (2.0.1 errata, 19 Jun 2026; 2.0.0, 3 Oct 2025). https://hl7.org/fhir/uv/ips/package-list.json
112. HL7 Bulk Data Access IG, version list (3.0.0, 11 Dec 2025; 4.0.0-ballot, 7 Aug 2026). https://hl7.org/fhir/uv/bulkdata/package-list.json
113. HL7 SMART App Launch 2.2.0, "App Launch: Launch and Authorization" (PKCE requirements). https://hl7.org/fhir/smart-app-launch/app-launch.html
114. CISA, ICS Medical Advisory ICSMA-26-253-01, "NextGen Healthcare Mirth Connect" (10 Sep 2026). https://www.cisa.gov/news-events/ics-medical-advisories/icsma-26-253-01
115. Eclipse Foundation, Eclipse Open Integration Engine project (state: Incubating) and project proposal (posted 4 Jun 2026). https://projects.eclipse.org/projects/technology.oie ; https://projects.eclipse.org/proposals/eclipse-open-integration-engine
116. Government of Singapore, "What is the Health Information Bill?" (Parliament, Jan 2026). https://www.gov.sg/explainers/parliament-jan2026/
117. PIB, "DPDP Rules, 2025 Notified" (Nov 2025); Rule 1 commencement provisions as reported in search extracts. https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf
118. IHACPA, "Products and licenses" (ECL vendor fees; government-to-government country licences; licensee list). https://www.ihacpa.gov.au/health-care/products-and-licenses (seen via search index; direct fetch timed out)
119. AMA, "CPT® licensing frequently asked questions (FAQs)"; AMA compliance notice "Standard CPT Distribution Pricing Schedule 2026" (seen via search index only). https://www.ama-assn.org/practice-management/cpt/cpt-licensing-frequently-asked-questions-faqs
120. US NLM, RxNorm Terms of Service. https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html
121. ADHA, "Better access to health information" (updated 10 Aug 2026) and media release of 8 Jul 2026; Department of Health consultation on online prescribing services share-by-default (seen via search index; direct fetches timed out). https://www.digitalhealth.gov.au/healthcare-providers/initiatives-and-programs/better-access-to-health-information
122. Deutsche Sozialversicherung Europavertretung, "European Health Data Space" (Sep 2026; implementing regulations 2026/2083, 2026/2098 and 2026/2099 and their application dates). https://dsv-europa.de/en/news/2026/09/ehds.html
123. HL7 FHIR R5 resource list with maturity levels (InventoryItem 0, InventoryReport 0, ChargeItem 1, ChargeItemDefinition 1, Invoice 0, Contract 1, InsurancePlan 0, SupplyRequest 1, SupplyDelivery 1), fetched 2026-10-16 during reconciliation. https://hl7.org/fhir/R5/resourcelist.html
124. Open Integration Engine GitHub releases via the GitHub REST API (latest release v4.6.0, published 2026-07-09, as of 2026-10-16). The Sep 2026 CVE fixes are merged but unreleased per `02-open-source-and-platforms.md` §3.4. https://api.github.com/repos/OpenIntegrationEngine/engine/releases
125. Companion reports used in the 2026-10-16 reconciliation: `01` §12.1, `02` §9/§10.1, `05` §3.8/§7/§9.2/§9.4, `07` §9.2, `08` §3.11/§4.6/§12.5, `09` §9.1–9.2, `10` §8, `11` §0/§11; see `RECONCILIATION-LOG.md`.

---

## Verification log (pass 2, 2026-10-16)

| Claim | Verdict | Source | Note |
|---|---|---|---|
| HTI-5 final rule not yet published | Confirmed | [30][102] | healthit.gov/hti5 lists only the proposed rule (FR 29 Dec 2025; comments to 27 Feb 2026). The Federal Register API returns no final rule. The FY 2027 IPPS final rule (4 Aug 2026) says the HTI-5 final "will be issued after" it |
| HTI-5 removes 34 of 60 criteria, revises 7, removes all 13 (d) criteria and (h)(1)/(h)(2); (b)(10) and (g)(10) retained | Confirmed | [100] | Counted from ONC's own deck (19 Feb 2026). The timing table was corrected: (a)(12), (b)(2), (c)(4), (e)(3), (f)(4), (f)(7), (g)(1), (g)(2), (g)(7) and (g)(9) take effect 1 Jan 2027, the rest at the final rule. (e)(3) and (a)(15) rows added |
| HTI-4: SCRIPT 2017071/2023011 transition to 31 Dec 2027, 2023011 only from 1 Jan 2028; RTPB v13 in Base EHR from 1 Jan 2028; provider ePA measure from 2027 | Confirmed | [34] | Text extracted from the ONC fact sheet PDF |
| USCDI v7 final released July 2026 (previously "not verified") | Corrected (now confirmed) | [105] | Released 23 Jul 2026: 30 new elements plus 1 revised, and 2 new data classes. No certification date |
| 2026 SVAP: USCDI v6, US Core 9.0.0, C-CDA 5.0.0 from 29 Aug 2026 | Confirmed | [38] | Announced 30 Jun 2026; QRDA I/III IGs also approved. SMART 2.2.0 was a 2024 SVAP approval |
| CMS-0057-F: payer operational provisions 1 Jan 2026, payer APIs 1 Jan 2027 (was [K]) | Confirmed | [103] | Upgraded from [K] |
| Information blocking: up to $1M CMP per violation (was [K]) | Confirmed | [104] | OIG final rule posted 27 Jun 2023. Provider-disincentive detail still [K] |
| "Enforcement alert … on 24 Nov 2025" | Corrected | [40] | The enforcement alert is dated September 2025; 24 Nov 2025 is the enforcement-discretion notices |
| TEFCA has 11 designated QHINs (list as given) | Confirmed | [41] | Candidate QHINs are still onboarding |
| CMS Framework: criteria 13–16 in effect 4 Jul 2026; GA July 2026; 60+ pledgers, 21 networks, 7 EHRs | Confirmed | [45][46] | |
| FHIR R6: ballot 5 = "second full ballot" (17 Jul 2026); CI 6.0.0-snapshot1 (15 Oct 2026); 33 resources moved out of core; no breaking changes after ballot | Confirmed | [1][2][3] | The ballot notes add "there is certain to be another ballot after this". No official publication date. R5 is still "current published" [4] |
| HL7 v2 latest normative "2.9.x" [K] | Corrected | [106] | 2.9.1, normative, September 2024 (seen via search index of the HL7 product brief) |
| Bulk Data 3.0.0 published | Confirmed | [112] | 11 Dec 2025; 4.0.0-ballot Aug 2026 |
| SDC "3.x published" [K] | Corrected | [107] | SDC 4.0.0 (STU4) published 24 Mar 2026 |
| CQL "1.5.x normative" [K] | Corrected (amplified) | [108] | CQL 2.0.0 (R2 STU1) active 29 Jul 2026; 1.5.x normative content remains |
| UDAP / FAST Security "1.0" | Corrected | [109] | HL7 UDAP Security IG 2.0.0 (STU2) published 9 Dec 2025 |
| LIVD "1.0.0" | Corrected | [110] | No STU publication: only 1.0.0-ballot (Dec 2023). The CI "1.0.0" is "not an authorized publication" |
| IPS IG current = 2.0.0 | Corrected | [111] | 2.0.1 errata published 19 Jun 2026 is now current; 2.0.0 dated 3 Oct 2025 confirmed |
| SMART v2 requires PKCE [K] | Confirmed | [113] | Apps SHALL support PKCE; servers SHALL support S256 and SHALL NOT support plain |
| US Core 9.0.0; CDS Hooks 2.0.1; Subscriptions Backport 1.1.0; IPA 1.1.0; C-CDA 5.0.0 (13 Jun 2026); v2-to-FHIR 1.0.0 | Confirmed | [7][10][18][12][19][17] | Dates added: US Core 9.0.0 on 31 May 2026; IPA 1.1.0 on 19 Mar 2025; v2-to-FHIR 1.0.0 on 7 Oct 2025 |
| AU Core 2.0.0 on AU Base 6.0.0; JP Core 1.2.0 (30 Jul 2025); UK Core 2.0.1 newest release | Confirmed | [72][77][62] | UK Core STU3 entries (1.6.0/1.7.0) are review builds, not releases |
| HL7 Europe IG statuses (Base/Core STU2, Lab STU2, MPD STU1 published; HDR, Imaging, EPS in ballot) | Confirmed | [22] | |
| openEHR AM 2.3.0, ITS-REST 1.1.0 (Jul 2026), PROC 1.7.0 | Confirmed | [29] | Dates added: AM March 2024, PROC August 2024 |
| SNOMED CT: 54 members; IT, JP, CN, BR, MX, KE, NG, EG, OM, KW, BH, PH not members; US a member | Confirmed | [23] | Qatar is a member (added). "US member via NLM" upgraded from [K] |
| SNOMED GPS free under CC BY-ND 4.0, no hierarchy | Confirmed | [26] | |
| Non-member SNOMED fees by World Bank band, annual Statement of Usage | Confirmed | [24] | Fee exemptions "may be applied"; amounts quoted on request |
| ICD-11: CC BY-ND 3.0 IGO, 132 countries, 4 million API requests a day, no licence fees for vendors | Confirmed | [28] | Text extracted from the May 2026 fact sheet |
| CPT licensed worldwide, per product [K] | Confirmed | [119] | AMA FAQ: "any entity using CPT content anywhere worldwide must have a license". The US$18.50/user 2026 figure is only [S] (search extract) |
| ICD-10-AM/ACHI licensed, fee-bearing [K] | Confirmed (secondary access) | [118] | IHACPA page via search extract: vendor ECL fees, government-to-government country licences, licensees include SA, QA and BH. Direct fetch timed out |
| RxNorm full files need a (free) UMLS licence [K] | Confirmed | [120] | |
| Azure API for FHIR deprecated 30 Sep 2026 | Confirmed | [88] | |
| Mirth 4.6 commercial-only from 19 Mar 2025; 4.5.2 last open source | Confirmed | [85][86] | NextGen blog names 4.5.2 explicitly |
| Mirth September 2026 CVEs fixed in 4.7.2 (was [S]) | Confirmed | [114] | CISA ICSMA-26-253-01, 10 Sep 2026; affects ≤ 4.7.1; three CVEs |
| OIE entered Eclipse incubation (was [S]) | Confirmed | [115] | Project state "Incubating"; proposal posted 4 Jun 2026. The 7 Sep 2026 incubation date is from [87] only |
| ISiK Stufe 3 binding 1 Jul 2025; Stufe 4 withdrawn 1 Jul 2025; Stufe 5 binding date TBD | Confirmed | [54] | No Stufe 6 mentioned |
| ePA mandatory for all providers since 1 Oct 2025; e-medication plan summer 2026; TI-Messenger all insurers from Q2 2026 | Confirmed | [55] | "Sanctions from 2026" re-attributed to [56] (BMG gives no hospital sanction date) |
| EHDS timeline (2025/2027/2029/2031/2035) | Confirmed | [50] | |
| EHDS implementing acts: 2 of 9 key acts published; EEHRxF (Art. 15) and Art. 36 pending as of 22 Sep 2026 | Confirmed | [51][122] | No evidence of EEHRxF adoption found by 16 Oct 2026 |
| 2026/2099 applies "from 27 Mar 2027" | Corrected | [51][122] | Applies generally from **26 Mar 2027** (adopted 21 Sep 2026, OJ 22 Sep 2026) |
| England DUAA Schedule 15 in force 5 Feb 2026; covers supply contracts; 28-day compliance notices; accreditation scheme | Confirmed | [63] | In force via S.I. 2026/82 |
| Malaffi 3,144 of 3,147 facilities, 100% of hospitals | Confirmed | [70] | |
| NPHIES Financial Services IG 1.0.0 STU (HL7 Saudi Arabia, Dec 2025), FHIR R4.0.1 | Confirmed | [67] | |
| Australia Sharing by Default from 1 Jul 2026 (path and DI reports) | Confirmed (secondary access) | [121] | Official ADHA/DoH pages via search extract. The 105%/433% figures are against the 2023 baseline, as at 7 Jun 2026 (clarified) |
| Singapore Health Information Bill status [K] | Corrected (now confirmed) | [116] | Passed 12 Jan 2026; MOH intends effect from early 2027 |
| India DPDP Rules: consent manager ~Nov 2026, substantive ~May 2027 | Confirmed (dates sharpened) | [117] | Notified 13 Nov 2025; Rule 4 from 13 Nov 2026; main rules from 13 May 2027 (search extract of Rule 1) |
| NABIDH figures (1,527 of ~2,550 facilities; EMRAM stage 2) | Still unverified | [69] | PMC returned a CAPTCHA in pass 2; still rests on the pass-1 reading |
| ABDM DHIS terms (₹20/transaction, 25% to software companies, ₹26 crore paid) | Still unverified | [65] | abdm.gov.in returned 403; still secondary-only |
| LOINC licence terms and release numbering [K] | Still unverified | n/a | loinc.org returned 403 again |
| Saudi SBS is ACHI-based [K] | Still unverified (indirect support) | [118] | Saudi Arabia is an IHACPA licensee, but chi.gov.sa was unreachable |
| France Ségur V2 dossier windows and the 17 Mar 2027 hospital deadline | Still unverified in pass 2 | [58][59] | The ANS pages returned empty content to the fetcher; pass-1 [V] retained |
| Oracle Health CMS Aligned Network (Apr 2026) | Still unverified in pass 2 | [48] | oracle.com returned 403; remains [S] |
