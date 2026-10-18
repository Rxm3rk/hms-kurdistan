# 02 — Open-Source Hospital/Health Information Systems and FHIR-/openEHR-Native Platforms

**Track:** Open-source HIS/EHR, ancillary OSS, FHIR-native/headless platforms, openEHR ecosystem: what exists, how it is built, what to learn, and what to reuse versus build.
**Prepared:** 2026-10-16
**Audience:** Architecture and product leadership for a new Hospital Management System (HMS = HIS/EHR + hospital ERP/operations).

---

## 0. Method and evidence notes

- **Evidence base.** About 26 web searches ran before the shared session search budget was used up. The rest of the work was direct fetches of about 80 primary sources: official sites, documentation, release notes, GitHub READMEs and LICENSE files, the DPGA registry and vendor pricing and compliance pages. The live GitHub REST API (repository metadata) and GitHub release Atom feeds were queried on **2026-10-16** for about 55 repositories, and Codeberg for GNU Health [124]. Star and fork counts, last-push dates and release dates in this document come from those queries unless another source is cited.
- **Search budget.** The brief asked for 30+ searches. Only about 26 were possible, so a few areas got less coverage: SmartCare (Zambia), the national EMRs of Malawi and Rwanda, Code24/DIPS/Cambio openEHR details, and peer-reviewed performance studies. Those passages are flagged as **background knowledge (not re-verified in this session)**.
- **Labels.** "Vendor claim" marks numbers taken from marketing pages. "Estimate" marks the author's own judgment. Activity levels are the author's classification of observed commit and release cadence: *Very active* (releases weekly to monthly), *Active* (releases every few months), *Maintenance* (commits continue, releases rare), *Dormant* (no meaningful activity for 12 months or more), *Archived*.
- **Not legal advice.** The licensing analysis is an engineering-level reading. Get counsel to review before shipping.
- **Verification pass 2 (2026-10-16).** About 40 claims were re-checked against primary sources: vendor and regulator pages, GitHub release feeds and LICENSE files, the medRxiv and PubMed APIs, and the SMART Zambia Institute. Corrections were made in place, and the log at the end of the document lists each one. New sources are numbered [127]–[134].

---

## 1. Executive summary

1. **No OSS project is a ready-made, world-class, hospital-scale HMS.** The mature full systems serve specific markets. OpenMRS and Bahmni target low-resource and LMIC settings. OpenEMR targets US ambulatory care. GNU Health is a broad but niche Tryton-based HIS. VistA is a VA-specific legacy system now being retired. Each is a good source of lessons and some components, but none is a good base to fork for a modern commercial multi-hospital product.
2. **OpenMRS remains the largest open EMR community.** It reports 8,000+ facilities, 70+ countries and 15M patient records [1]. Activity is high. Platform 2.8.x is current (2.8.10 on 2026-10-06), with Java 21, Elasticsearch, Infinispan and S3 storage support added in Aug 2025 [5][124]. The O3 micro-frontend product reached 3.7.1 (tagged 2026-07-13, announced 2026-08-03), and 3.8.0 release candidates have been out since 2026-10-08 [1][124]. The EAV "obs" model and the long tail of distributions are the main lessons to avoid repeating.
3. **The OSS HIS world is moving to FHIR as its internal model, not only as an API.** Bahmni Lite 2.0 (announced 2026-10-05) moves its clinical workflows to FHIR R4 and replaces AngularJS with React 19 [13]. CARE (OHC, India) re-architected to a "FHIR R5-aligned" core in Feb 2025 [39][124]. MediMind, which is under contract with a 25-hospital network in Georgia (first modules live), builds on Medplum and says "FHIR R4 became our operational data model, not an interoperability layer bolted to the edge of the system" [86]. The direction is clear. *(Reconciled 2026-10-16: this describes an OSS trend. It is not the pack's storage decision. Our clinical facts are stored FHIR-shaped, but the system of record is domain-owned; see #14.)*
4. **Medplum is the most viable open-source foundation for a FHIR-native hospital product (opinion).** It is Apache-2.0, built on TypeScript, Postgres and Redis, and very active (v5.2.5 on 2026-10-15). It earned ONC certification on 2025-12-31 and has hospital-network references, though neither is a full inpatient EHR yet. Awell Panels runs a post-discharge follow-up worklist on self-hosted Medplum for a national post-acute provider with 180+ inpatient facilities. MediMind is under contract with a 25-hospital network and has its first modules in production [82][83][86][88][124]. It does not give you hospital workflows (ADT/beds, MAR, OT, ED, nursing) or ERP. You build those. *(Reconciled 2026-10-16: across the pack, Medplum is a reference design and an optional component source, such as its React UI kit and on-prem agent pattern. It is not the system of record. See #14 and the cross-report note in §9.)*
5. **HAPI FHIR is the safest Java-side building block.** It is Apache-2.0 and maintained by Smile Digital Health. Minor releases come about quarterly (8.10.0 in May 2026, 8.12.0 on 2026-09-01), with patch releases on several lines in between (8.12.1 and 8.8.2 in Sep 2026) [71][94][124]. The JPA starter explicitly ships "without security", so treat it as a toolkit, not a product [72]. IBM's LinuxForHealth FHIR server is effectively dormant: its last release was Dec 2022 and its last push Apr 2024 [75][124].
6. **Watch for license "rug pulls".** NextGen made Mirth Connect proprietary from 4.6 (announced 2025-03-19). The community fork, Open Integration Engine (MPL-2.0), shipped 4.6.0 in Jul 2026 and entered Eclipse Foundation incubation on 2026-09-07 [63][64][65]. Orthanc ended dual licensing for good [51]. OCL moves premium features (full FHIR terminology service, matching, private repos) behind subscriptions from 2026-11-01, and anonymous API access is already disabled [69][125]. DHIS2 begins a Shared Services Fee in 2026 [77]. Aidbox is proprietary, with only a free development license [90].
7. **openEHR is real and growing in Europe but is regional.** Slovenia stores about 98% of its population's data in openEHR, per an unsourced HiGHmed claim [111]. Catalonia covers 7.5–8M residents. Norway, Sweden and Finland have broad vendor-driven adoption: 3 of 4 Norwegian health regions, 19 of 21 Swedish regions and 16 of 21 Finnish counties [111][112][132]. EHRbase is the main open-source CDR (Apache-2.0, very active, v2.36.0 in Sep 2026) [105][107]. A 2026 preprint finds that no country names openEHR in binding regulation [112]. Use openEHR as a persistence and modelling option for EU and Nordic tenders. It should not be the default core.
8. **Ancillary OSS is where reuse pays off most.** Imaging: OHIF (MIT), dcm4chee (MPL-1.1), Orthanc (GPL/AGPL) and Weasis (EPL/Apache). Lab: OpenELIS Global (MPL-2.0, FHIR-native, 1,000+ labs claimed). Terminology: Snowstorm (Apache-2.0). Interfaces: OIE, as an optional engine for site-specific transforms behind our native Integration Hub (reconciled 2026-10-16; see §9). Synthetic data: Synthea (Apache-2.0). Analytics: SQL-on-FHIR pipelines. All are mature and active [47][50][52][53][54][62][70][80][81].
9. **MPI is a weak spot in OSS.** OpenCR's last release was in 2021 [55][124]. Jembi's JeMPI last released in Aug 2024 [57]. SanteMPI/SanteDB is active but has a small community [56]. Plan to build patient matching into the platform (FHIR `$match` and survivorship), and use SanteMPI or HAPI MDM only where a national-registry role is needed.
10. **Hyperscaler FHIR services store data. They are not EHR foundations.** Azure API for FHIR was retired on 2026-09-30; Azure Health Data Services is its successor [74]. Microsoft's OSS FHIR server drops Cosmos DB support on the same date [73]. Google Cloud Healthcare API supports DSTU2, STU3 and R4 [95]. AWS HealthLake is positioned around payer (CMS) APIs and analytics [96]. They are useful for analytics and exchange tiers but risky as the system of record for a multi-cloud or on-prem product.
11. **Ambulatory API-EHRs are not hospital foundations.** These include Canvas (Python plugin SDK), Oystehr/Ottehr, Healthie and Elation. Every one targets outpatient or virtual care [97][98][99][102][103]. Ottehr's license is a custom non-OSI license with a "Competing Product" ban and AI-ingestion restrictions [100]. Do not reuse its code.
12. **Sustainability, not technology, kills OSS health projects.** HospitalRun was volunteer-run with no anchor institution and was archived in stages from 2023 to 2025 [37][38]. OSEHRA shut down on 2020-02-14 after the VA chose Cerner [30]. The projects that survive have institutional anchors: OpenMRS Inc. with AMPATH, PIH and CDC/PEPFAR; HISP UiO for DHIS2; UW DIGI for OpenELIS; the OHC Foundation for CARE. Many of them are now adding fees.
13. **Design for "distribution" licensing.** Hospitals often want on-prem deployments, which count as *distribution* under the GPL. So GPL and AGPL components (OpenEMR, GNU Health, Open Hospital, ERPNext/Marley, SENAITE, Orthanc, OpenLMIS, CHT) must be unmodified, separately run services, or kept out of the shipped product. Permissive and weak-copyleft components (Apache, MIT, BSD, MPL, LGPL, EPL) are safe as building blocks if you follow the rules.
14. **Recommended posture (opinion; reconciled 2026-10-16).** Build a proprietary hospital-workflow product on our own **FHIR-shaped domain model on PostgreSQL** (one database per tenant), using the **HAPI FHIR structures, validator and v2 libraries**. Store clinical facts as typed, FHIR-shaped JSONB. Keep operational aggregates (ADT, orders, MAR, charges, inventory) as domain-owned tables with state machines. Serve reads, `$export`, IPS and Subscriptions from a generated FHIR R4 projection, and route writes through domain commands. Self-hosted Medplum or HAPI FHIR JPA as a FHIR-native core is the **alternative**. Test both options in the 6–8 week load and safety spike (§10.1 #1) before ADR-001 is frozen. Integrate rather than rebuild PACS, viewer, terminology server and analytics. For interfaces, the native Integration Hub is core, and OIE is optional for site transforms. Build MPI, scheduling, orders/CPOE, ADT/bed management, MAR, LIS/RIS cores, charge capture and patient accounting yourself. Build the clinical-operational ERP natively: clinical supply chain, pharmacy stores, CMMS/assets, basic rostering, and lite GL/procurement for emerging-market tenants. Integrate payroll/HCM, enterprise GL and full procure-to-pay through connectors where the customer already runs an ERP (see `05` §9.1).

---

## 2. Full HIS/EHR projects

### 2.1 OpenMRS (Platform 2.x and O3, "OpenMRS 3")

**Status (verified 2026-10-16).**
- openmrs-core: 1,944 stars and 4,437 forks. Latest releases are **2.8.10 (2026-10-06)** and 2.8.9 (2026-08-07), with a parallel maintenance line, 2.6.17 (2026-08-06) [7][124].
- Platform **2.8.0 (2025-08-15)** added the following [5]:
  - Java 21/24 support
  - Hibernate Search 6.2.4
  - Liquibase 4.31
  - an S3 storage service and storage abstraction
  - an Elasticsearch backend for full-text search
  - an Infinispan distributed cache for clustered deployments
  - ProviderRole moved into core
  - PostgreSQL in the setup wizard
  - new `concept_reference_range` and `obs_reference_range` tables
- The **O3 reference application** shipped 3.6 on 2026-03-11, with Workspace v2, billing, printing, lab reference ranges, dispensing improvements and audit logging. The 3.6 notes (Nov 2025 target) bump Platform from 2.7.6 to 2.8.4, Billing from 1.3.2 to 2.2.0 and Stock Management from 2.0.3 to 3.0.0 [6]. 3.7.0 was tagged on 2026-06-29. **3.7.1** was tagged on 2026-07-13 and announced on 2026-08-03. **3.8.0** is in release candidates (rc.1 on 2026-10-08, rc.2 on 2026-10-15) [1][124].
- Frontend libraries are moving fast: `esm-core` went from v9 (Feb–Mar 2026) through v10 (Jun) to **v11 (2026-10-06)**, and `esm-patient-chart` reached v13 (Oct 2026) [124].
- It is a DPG (since 2023-01-13, assessed against openmrs-core) [10].
- Reported scale is 8,000+ facilities, 70+ countries and 15M patient records (project claim) [1].

**Architecture.**
- **Backend:** a Java/Spring/Hibernate "platform" (openmrs-core) with a module system (OMOD) that loads modules at runtime and extends the data model, services and web layers. Databases are MySQL/MariaDB, with PostgreSQL support improving in 2.8 [5].
- **Data model:** a person/patient core, plus visit → encounter → **obs**, where obs is a generic entity-attribute-value (EAV) row keyed by a **concept**. There are also orders (drug and test) and programs/workflows. The **concept dictionary** is the semantic backbone: every question and answer is a concept with datatypes, classes and mappings. Most implementations seed it from **CIEL**, a curated dictionary mapped to SNOMED CT, ICD-10, LOINC and RxNorm and distributed through Open Concept Lab. CIEL is itself a registered DPG [119]. (Data-model description: background knowledge; the CIEL version used by Bahmni Lite 2.0 is v2026-06-13 [13].)
- **FHIR:** the FHIR2 module (MPL-2.0) is a *translation layer*, structured as ResourceProviders → Services → Translators → DAOs over Hibernate. It is actively released (4.3.0 in Sep 2026, with a 2.5.x maintenance line) [9][124].
- **O3 frontend:**
  - It is built on **single-spa micro-frontends** with React, TypeScript and the Carbon Design System, and ES modules loaded through an **import map** [3][4].
  - An **app shell** loads modules, routes, a global store and a **service worker that provides a basic offline mode** [3].
  - Modules contribute UI through **extension slots**. Each module declares a configuration schema, and implementers can change settings at runtime through Implementer Tools [3].
  - Distributions are assembled with the O3 CLI (`spa-assemble-config.json`). The backend is configured with **Initializer** content packages, so metadata lives as code [3].
  - The reference distribution runs as four containers: MariaDB, the backend, nginx serving the SPA, and an nginx gateway [3].

**Why O3 was built (lessons).** OpenMRS's own write-up names the 2.x problems [2]:
- weak scaling and point-of-care workflows
- custom frontends that other implementers could not reuse, which "fragmented the product into distributions"
- form building that needed HTML skills and a developer

O3 was co-funded and co-built by AMPATH, Mekom, CDC Kenya, Palladium-Kenya, CDC TAP, PIH, UCSF, ICRC, UW DIGI and others [2].

**O3 adoption snapshot (as of Jun 2024) [2]:**
- Kenya: Palladium-Kenya on 33 HIV sites and 10 outpatient sites
- Uganda: METS/UgandaEMR on 6 sites
- ICRC: rehabilitation and mental health in 27 countries
- Cambodia: 100+ Ministry of Health facilities for NCD care
- Ethiopia: ICAP
- Namibia: UCSF

**Strengths:**
- the largest open EMR community
- strong concept-dictionary discipline
- DPG status, with credibility among governments and PEPFAR-funded programmes
- a modern O3 UI
- active core releases

**Weaknesses for our purposes:**
- The EAV obs model is flexible but makes reporting, constraint enforcement and performance hard, so it needs ETL flattening (see fhir-data-pipes [81]).
- Inpatient, ERP and billing depth is shallow. Billing, stock, wards and bed management in O3 are recent and maturing [3][6].
- Distribution sprawl and version lag continue. Bahmni Lite 2.0 ships on core 2.6.15 while the current core is 2.8.10 [13][124].
- Frequent frontend major versions create churn for downstream projects [124].

### 2.2 National OpenMRS-based EMRs (KenyaEMR, UgandaEMR+, others)

- **KenyaEMR** (Palladium-Kenya with Kenya MoH, CDC/PEPFAR) was an early, large adopter of O3 [2]. On the palladiumkenya GitHub org, the forked `openmrs-module-kenyaemr` and several O3 forks are now **archived**. Activity in that org now centres on dashboards, case surveillance and a "compass-shr" repository [12][124]. *Pass 2 (2026-10-16):* `openmrs-module-kenyaemr` is still reachable, with its last release v19.1.2 in Oct 2024. The O3 frontend (`kenyaemr-esm-3.x`), `openmrs-config-kenyaemr` and `kenyahmis-releases` now return HTTP 404 on GitHub [124]. Search snippets (not primary) say these were archived on 2026-02-11, and that later "KenyaEMR 3.x Facility-Wide" and "KenyaHMIS" releases extend KenyaEMR towards hospital management. Where active KenyaEMR 3.x development is now hosted is **still not verified**. The repositories may have gone private.
- **UgandaEMR+** (METS Programme, Makerere University) is clearly on O3. Its esm modules (patient queues, registration, laboratory, data visualizer, exchange) and core and sync modules were updated between Jul and Oct 2026 [11].
- **Malawi, Rwanda and Mozambique** have long-running OpenMRS-based national EMR programmes, for example Malawi's Baobab/EGPAF-supported EMRS and PIH-supported systems in Rwanda. *(Background knowledge; not re-verified.)*
- **SmartCare (Zambia)** was a national, non-OpenMRS EMR built with CDC support *(origin: background knowledge)*. Its successor, **SmartCare Pro**, is now the government EHR. On 2026-07-09 the SMART Zambia Institute said SmartCare Pro had been rolled out to "approximately 80 percent of health facilities nationwide" [127]. Secondary reports from Apr 2026 (not fetched) cite 2,000+ facilities, 12M+ consolidated patient records, and IHM-Southern Africa and US-government support. The tech stack and licence were not verified, and it does not appear to be OSS. **Lesson:** a government-owned, donor-co-funded national EMR can scale to most facilities in a country, and it competes directly with any commercial HMS in that market.
- **Lesson:** national programmes succeed when a donor-funded implementing partner takes long-term ownership of a distribution (Palladium, METS, PIH). The cost is forks that lag upstream. The O3 move was explicitly meant to shrink those forks into shared modules plus local config [2].

### 2.3 Bahmni

**What it is.** Bahmni is an OpenMRS distribution, started in 2012, that bundles several systems [17][18]:
- OpenMRS for the EMR
- **Odoo** (originally OpenERP) for billing, inventory and accounting. The Standard demo runs **Odoo 16** [14].
- **OpenELIS** for lab
- **dcm4chee** (PACS)
- **Metabase** for reporting
- Crater billing in the Lite edition [14]

It is governed by the **Bahmni Coalition**, and SNOMED International joined it [17]. It is a DPG [17][119]. The bahmniapps repository is **MPL-2.0** (LICENSE file verified) [18].

**Editions and releases.**
- **Lite:** v1.0 in Jun 2023 and 1.0.1 in Feb 2025 [14].
- **Standard:** 1.0.0 in Sep 2024, a containerized suite of EMR, OpenELIS, Odoo and dcm4chee [14].
- **Security patch (2026-07-02):** Lite 1.0.2 and Standard 1.0.2 [15]. The 2025 roadmap included a patch for an "OpenMRS critical security issue" [16].
- **Bahmni Lite 2.0** (tag 2026-09-24, announced 2026-10-05) [13]:
  - a React 19 frontend for Home, Registration and Clinical, replacing AngularJS
  - FHIR R4 across registration, clinical workflows and lab entry
  - Forms 2.0 rebuilt on Carbon
  - data-migration scripts that turn legacy diagnoses, lab results, documents and medication notes into FHIR resources
  - OpenMRS core 2.5.14 → 2.6.15, on MySQL 8.0
  - SNOMED module v3.0.0-SNAPSHOT and CIEL v2026-06-13
  - Docker and Helm deployment
  - Upgrading from 1.0.x requires running migration and validation scripts.
- Bahmni reports 500+ sites, 50+ countries and 20M+ patient records (project claim) [17].

**Lessons.**
1. Assembling best-of-breed OSS (EMR + ERP + LIS + PACS + BI) works for low-resource hospitals. The cost is integration and operations: several databases, sync jobs and Postgres version alignment, which appears as a 2025 roadmap item [16].
2. A UI on dead frameworks (AngularJS) leaves years of modernization debt.
3. Moving to FHIR later required data migration, which is expensive. Choose the canonical model early.

### 2.4 Ozone HIS (newer entrant on OpenMRS O3)

Ozone is Mekom's integrated distribution. Per its repository topics it combines OpenMRS (O3), Odoo, SENAITE and Superset, with FHIR-based integration. It is **MPL-2.0** and a **registered DPG** [19][119]. Its latest release is **1.0.0-alpha.15 (2026-01-02)**, and it has 36 stars [124]. That makes it the "Bahmni pattern on O3" and evidence that the integrated EMR + ERP + LIMS + BI stack is still in demand. It is still pre-1.0. *(Some Ozone details, such as Keycloak and EIP-based integration and FOSS vs Pro editions, are background knowledge, not verified.)*

### 2.5 OpenEMR

**Status.**
- GPL-3.0, PHP. 5,530 stars and 3,082 forks [24][124].
- **8.0.0 released 2026-02-11.** It requires PHP 8.2–8.5 and MariaDB 10.6–11.8 or MySQL 5.7–8.4 [21][22].
- Since then: 8.2.0 (Jul), 8.3.0 (Aug), 8.4.0 (2026-09-13) and **8.4.1 (2026-09-20)** [22][124].
- **ONC certification.** 8.0 holds ONC Ambulatory certification number 15.05.05.3115.OPEN.02.01.1.260130, dated 2026-01-30 (confirmed on the OpenEMR 8.0.0 certification-requirements page). **The 7.0 certification was retired on 2026-02-27**, which forced upgrades: "users needed to upgrade to OpenEMR version 8 to maintain ONC certification" [21][121][128].
- Security patches in early 2026 fixed high-severity issues, for example an authenticated blind SQL injection in 8.0.0 patch 3 [22].
- The 7.0.3 release (Mar 2025) added DSI (b)(11), SMART and OAuth2 PKCE, and FHIR fixes [20]. Certified sites must register their FHIR endpoints [121].

**Scope:** ambulatory and practice management. That covers multi-facility scheduling, US X12 5010 and UB-04 billing, eRx, a portal and 34 languages. The features page lists **no inpatient features** [23].

**Evidence:** a peer-reviewed comparison (Purkayastha et al., 2019) found OpenEMR met all 32 functional criteria, VistA 28, and OpenMRS 12 fully plus 11 partially. OpenMRS performed better on user tasks [118].

**Lessons.**
- Certification compliance is a treadmill: recertification forces upgrades.
- A PHP monolith with decades of code needs constant security work.
- Strong US billing does not transfer internationally.
- GPL-3 blocks proprietary on-prem derivatives.

### 2.6 GNU Health

**Status.**
- **HIS 5.0.0 released 2025-06-29** (PyPI upload and info-gnu announcement on 29 Jun 2025, US time). The announcement calls the 5.0 series "a major leap in functionality". *(Pass 1 said "its largest release"; that wording was not found in the announcement.)* It runs on **Tryton 7.0 LTS (supported to end of 2028)** and Python 3.13, with a native GTK client and a development web client [25][26].
- Patch releases continued to 5.0.6 on PyPI (2026-04-11) [27]. The client reached 5.0.2 (2026-04-20).
- The code lives on **Codeberg** (gnuhealth/his, 18 stars, updated 2026-10-12) [29].
- It is GPL-3 (GNU package) and a DPG (owner: GNU Solidario) [28][119].
- **Features (5.0):**
  - lab ("Occhiolino"): out-of-range visual aids, veterinary testing, analyte code harmonization
  - a refactored imaging package
  - social determinants: uninsured and homeless checks, ICF link
  - genetics datasets [25]
- **Federation and Thalamus:** the "GNU Health Federation" connects heterogeneous HIS nodes into regional or national networks through the **Thalamus** message server and a Person Master Index. The client has a Federation Record Locator plugin [27]. Thalamus had little activity in 2026 (last updated Apr 2026; 2 stars) [124].
- **Partners shown:** Jamaica's Ministry of Health, AIIMS (India), Cruz Roja Mexicana, Mahosot Hospital (Laos), Bafia Hospital (Cameroon) and others. How each uses it is not described [28].

**Architecture lessons.**
- Building on a general ERP framework (Tryton) gives you accounting, stock and HR almost for free, which is one reason GNU Health covers so much.
- The cost is a niche framework, a niche UI paradigm (desktop GTK) and a small contributor pool.
- The Federation is an interesting design for a national person index plus federated records. Its adoption is limited.

### 2.7 VistA, WorldVistA and OSEHRA

**History and status.**
- VistA is the VA's MUMPS/M-based EHR, built on the **FileMan** hierarchical data dictionary, with the CPRS Delphi client. It was released through FOIA. *(Background knowledge.)*
- **OSEHRA**, the VA-founded open-source steward, shut down on **2020-02-14** after the VA chose Cerner. Its assets went to WorldVistA (VistA repositories) and Logica Health (other repositories, plus about 1.5 TiB of archive) [30][31].
- WorldVistA is volunteer-run with "no business model". It still publishes FOIA-derived artefacts: the ViViaN code visualization shows a Sep 2026 FOIA version [31][33].
- The WorldVistA/VistA GitHub repository (Apache-2.0, 143 stars) still describes itself as OSEHRA-maintained. Its latest release entries are CPRS test builds from 2020 [32][124].
- **The VA is moving off VistA.** It planned 13 Oracle Federal EHR go-lives in 2026, with completion across about 170 sites "as early as 2031" [34][122]. **11 of the 13 2026 sites were live as of 22 Aug 2026** (Michigan 11 Apr, Ohio/Kentucky 6 Jun, Indiana 22 Aug). Anchorage and Cleveland are scheduled for 24 Oct 2026 [135][136]. In Aug 2026 VA added three option-year periods and **US$17B** to the Oracle contract, raising its total value to **just under US$27B** [136]. VA's earlier notice said these periods would extend the contract from May 2028 to as late as **2031-05-16** [35]. *(Reconciled 2026-10-16: the earlier text said "eight facilities" and "seeking" the option years. Both were stale.)* The program's lifecycle cost is "estimated at roughly $37 billion" [34].

**Lessons.**
- VistA proves that a clinician-designed, deeply integrated hospital system can be excellent (VistA/CPRS was long well regarded clinically).
- Code alone does not create a sustainable ecosystem. Without an anchor customer and a commercial support market, the steward collapsed.
- MUMPS/FileMan skills are scarce, and integrating with the modern world is hard.
- Do not use VistA as a base. Study its order-entry, pharmacy (BCMA) and package modularity for domain insight.

### 2.8 Open Hospital (Informatici Senza Frontiere)

- GPL-3.0, Java. Repositories: CORE (business logic and data access), a **Swing** GUI, a REST API (work in progress) and a **React UI (work in progress)**. It runs standalone ("portable") or client-server and is **designed to work offline** [36].
- Active: core **v1.15.2 (2026-10-07)**, after v1.15.0 (Feb 2026) and v1.14.2 (May 2024) [124]. It has 112 stars.
- **Lesson:** small hospitals in low-connectivity settings value simple local deployment above everything. A desktop-first architecture has slowed the move to web and API for years.

### 2.9 HospitalRun (post-mortem)

- HospitalRun was offline-first (CouchDB/PouchDB, Ember then React). It started in 2014 at a charity and drew a big following after a 2015 Hacker News post (frontend: 6,889 stars) [37][124].
- The v2 monorepo was archived on 2023-01-09, after its last push on 2021-02-05 [124]. An administrator marked the GitHub organization archived on **2025-10-15**. The closure notice says "all associated repositories have been archived". Open Collective lists the project as inactive [37][38].
- The last frontend release was 2.0.0-alpha.7 (Nov 2020) [124].
- **Why it stalled (inference from the timeline; no official reason given):**
  - It depended on volunteers and had no anchor implementer or funder.
  - A full rewrite (v1 Ember → v2 React) reset its maturity.
  - Its offline-first CouchDB design was hard to fit with hospital-grade reporting and integration.
  - It had no deployments of the kind that pay for maintainers.
- **Lesson:** GitHub stars do not equal sustainability. You need paying users or institutional anchors.

### 2.10 CARE (Open Healthcare Network, India)

**Origins.** CARE started in 2020 for COVID-19 coordination. Six state health departments adopted it, it ran Kerala's oxygen war room, and it was the TeleICU tool for the **10BedICU** project (2021). It is MIT-licensed, a verified DPG, and stewarded by the **OHC Foundation** [39][40][41].

**Re-architecture.**
- A "**Care Re-architecture V3.0**" backend release was published on **2025-02-12** [124].
- CARE Core v3.0.0 is described as "FHIR R5-aligned", built on Django/DRF/Celery with PostgreSQL, Redis and object storage [39]. Modules:
  - Administration
  - Definitions (ValueSets, Questionnaires)
  - Clinical (Encounters, Observations)
  - Scheduling
  - Pharmacy
  - Labs
  - Billing (Claims, Coverage, Invoice)
  - Coordination
- A **plugin surface** carries AI Scribe, TeleICU, devices, claims, messaging, analytics and imaging. It supports SNOMED CT, LOINC, UCUM, ICD-10 and ABDM, and "bring your own terminology" [39][40].
- **Activity:** care_fe ships frequent "production releases" (v3.0.32 on 2025-12-23) with daily commits (pushed 2026-10-16). Backend commits continue too (2026-10-13) [124].

**Lessons and relevance.**
- CARE is the closest OSS analogue to what we want. It is a modern web stack, FHIR-shaped, plugin-based, covers hospital, ICU, pharmacy, lab and billing, and permits commercial reuse under MIT.
- Its weaknesses are a domain model tuned to Indian public-sector workflows, a smaller global community and a single foundation steward.
- Its plugin model ("extend the core without forking") is worth studying. **A strong candidate to evaluate hands-on (opinion).**

### 2.11 ERPNext/Frappe Healthcare (Marley Health) and Odoo-based modules

- **Marley Health** is an HIS on the Frappe framework and ERPNext, now hosted at earthians/marley (the frappe/health name redirects there). It is GPL-3.0 with 543 stars and is very active (v16.6.1 on 2026-09-22, with a v15.x line maintained in parallel) [42][124].
  - Clinical modules: patient, OPD/IPD, procedures, rehab, lab and multiple code systems, with a design "largely based on HL7 FHIR".
  - ERPNext supplies pharmacy and supplies, purchasing, HR, accounting, assets and quality [42].
  - **Lesson:** the ERP-first path quickly yields hospital *operations* (billing, stock, HR). Clinical depth and the medical-grade UX are thinner. The GPL applies.
- **Odoo:** the OCA `vertical-medical` repository is AGPL-3.0 with 296 stars. Its **19.0 branch has one commit**, so the Odoo 19 migration has barely started [43]. Bahmni and Ozone instead use **stock Odoo** for billing, inventory and accounting, integrated over APIs [14][19]. *(Odoo Community is LGPL-3 and Odoo Enterprise is proprietary: background knowledge.)*
  - **Lesson:** use Odoo or ERPNext as a back-office ERP integrated by API. Do not embed clinical logic in an ERP.

### 2.12 Other notable projects and 2025–2026 newcomers

- **OpenSRP 2 (fhircore):**
  - A Kotlin Android app on Google's **Android FHIR SDK**, configured as FHIR resources, with Structured Data Capture (SDC) forms, Keycloak identity and a HAPI FHIR backend. Apache-2.0, DPG [44][119].
  - Latest release v2.2.2 (Nov 2025) [124].
  - The Android FHIR SDK moved to the **OHS Foundation**. Its last push was Mar 2026, and the data-capture library was at 1.3.1 in Nov 2025, so activity is slowing [120][124].
- **Community Health Toolkit (CHT)** is Medic's offline-first community-health platform. AGPL-3.0, DPG, very active (5.3.0 on 2026-08-31 and 5.3.1 on 2026-09-15, with daily commits in Oct 2026) [46][124]. It is relevant only for community-outreach extensions.
- **Tamanu** (Beyond Essential Systems):
  - An EHR for mobile and desktop with a **central server, a facility server and a mobile client** that sync data, built on Node.js and PostgreSQL [45].
  - Very active (v2.66.0 on 2026-10-15) [124].
  - **Licensing caution:** the repository contains both a `LICENSE-GPL` file and a **Business Source License 1.1** file (`LICENSE-BSL`) [45][126]. *Pass 2:* the root `package.json` declares `"GPL-3.0-and-later AND BUSL-1.1"`. The `central-server`, `shared` and `database` packages declare `GPL-3.0-or-later AND BUSL-1.1`. The `facility-server`, `web`, `patient-portal`, `api-client` and `ui-components` packages declare `GPL-3.0-or-later` only [131]. The BSL file as published has no parameter block: no Licensor, Additional Use Grant or Change Date is filled in. So the production-use terms for the BSL-covered packages are unclear. Ask the vendor.
  - **Lesson:** its facility-edge-plus-central-sync topology is the right pattern for intermittently connected hospitals.
- **MediMind** (Georgia, 2026) is an "AI-native hospital system" on Medplum. The anchor customer runs it on-premise on its own hardware [86]:
  - under contract with a 25-hospital network, with "the first modules live in production" (case study dated 2026-08-06)
  - about 1.1M patients migrated, 3.1M visits and 3.7M observations
  - lab analyzers over HL7v2/ASTM (fifteen analyzer lines live within three weeks)
  - imaging scanner → archive → FHIR → viewer
  - pharmacy, billing, HR and ministry reporting, multilingual
  - AI output kept separate and labelled preliminary
  - It is not OSS itself, but it is the best public evidence that a FHIR-native OSS platform is being used to build a hospital-network system. Full network-wide go-live is not yet documented.
- **Ottehr** (MassLight, on Oystehr) is an outpatient, urgent care and telemedicine EHR. It is "open" only under a **custom license** with an attribution requirement, a **Competing Product** prohibition and restrictions on AI ingestion and derivation [100]. That is not OSI open source. **Do not reuse it.**

---

## 3. Ancillary OSS components

### 3.1 Laboratory

- **OpenELIS Global 2** (UW DIGI):
  - MPL-2.0, Java. 272 stars and 653 forks.
  - Very active: **3.2.3.0 (2026-09-26)** and 3.2.2.0 (Aug 2026) [48][124].
  - Describes itself as "FHIR-native", with analyzer integration (ASTM, HL7, CSV), specimen tracking with chain of custody, a pathology workflow and One Health (human, animal, environment) [47].
  - Claims 1,000+ labs, 26+ countries and 18.7M+ patients. A DPG [47][119].
  - **Verdict:** the best OSS LIS to integrate with for public-health and reference labs.
- **SENAITE** (successor to Bika):
  - GPL-2.0, Python on Plone/Zope (stack: background knowledge).
  - Last core release **v2.6.0 (2025-04-04)**, though commits continue (2026-10-14) [49][124].
  - Strong sample lifecycle, worksheets with QC and an audit trail, ISO 17025-oriented [49].
  - **Verdict:** good for environmental, research and hybrid labs. Its release cadence is slow and it is GPL.

### 3.2 Imaging (PACS, VNA, viewers)

- **Orthanc:**
  - A lightweight DICOM server with a REST API and plugins: PostgreSQL/MySQL, DICOMweb, Stone and other viewers, whole-slide imaging [50]. A DPG [119].
  - **Licensing:** the core is **GPLv3+**. Scalability and cloud plugins (for example PostgreSQL and the web viewer) are **AGPLv3+**. **Dual licensing has ended for good**: it is "no longer available and never will be again". 1.9.7 (2021-08-31) was the last eligible version [51].
  - **Latest version:** **1.13.0 (2026-08-15)**, after 1.12.11 (2026-04-14), from the official source-download index [129].
  - Calling Orthanc over REST or DICOM from proprietary software is fine. Proprietary *plugins* distributed to clients, or proprietary cloud use with AGPL plugins, are "Restricted" [51].
  - **Verdict:** run it unmodified as a separate service.
- **dcm4chee-arc-light:**
  - Enterprise Java EE archive on WildFly, with LDAP configuration, Keycloak security, QIDO/WADO/STOW modules, and support for Postgres, Oracle, SQL Server and other databases.
  - The README states **MPL-1.1** [52].
  - Very active: **5.35.2 (2026-10-15)** [124].
  - **Verdict:** the choice for enterprise-scale VNA/PACS.
- **OHIF Viewer:**
  - **MIT**, a web zero-footprint viewer with GPU visualization, segmentation, microscopy and 4D support.
  - Funded by NCI ITCR (2023–28) [53]. 4,373 stars, with v3.14 betas shipping daily in Oct 2026 [123][124].
  - Medplum's DICOMweb beta uses OHIF [87].
  - **Verdict:** embed it as the default viewer.
- **Weasis:**
  - Desktop diagnostic viewer, dual **EPL-2.0 or Apache-2.0**. Supports DICOMweb and DIMSE and launches from EHR portals through a `weasis://` URL [54].
  - v4.7.3 (Aug 2026) [124].
  - **Verdict:** offer it to radiologists alongside OHIF.

### 3.3 Client registry and MPI

- **OpenCR** (IntraHealth): MIT; Node, HAPI FHIR and Elasticsearch with configurable decision rules. **Last release 3.0.0 in Jul 2021, last push Apr 2025** [55][124]. Treat it as dormant.
- **SanteMPI/SanteDB** (SanteSuite): Apache-2.0, C#/.NET. Very active (v3.0.2118 on 2026-10-11), but small (6 stars). SanteSuite is a DPG [56][119]. *(Its IHE PIXm/PDQm/PMIR, HL7v2 and offline "dCDR" features are background knowledge.)*
- **JeMPI** (Jembi): **MPL-2.0** (GitHub licence metadata). Last release **1.1.0 on 2024-08-12**, last push 2025-04-16, 23 stars [57][124]. It is packaged in the OpenHIM Platform [59].
- **HAPI FHIR MDM** (EMPI) works with JSON matching rules and depends on subscriptions [72].
- **Verdict:** hospital-grade MPI needs probabilistic matching, survivorship rules, a steward work queue, merge/unmerge with clinical-safety checks, and audit. No OSS option is both strong and lively. **Build it** on your FHIR core, and integrate SanteMPI or OpenCR-style registries for national client-registry roles.

### 3.4 Interoperability layer, interface engines, workflow automation

- **OpenHIM** (Jembi): MPL-2.0, Node.js and MongoDB. It is a security, audit (ATNA), routing and mediator proxy with a transaction log and re-run [58]. Its last release was **v8.5.0 in Sep 2024**, but commits continue (Sep 2026), so it is in maintenance [124].
- **Instant OpenHIE v2 and the OpenHIM Platform:**
  - Instant OpenHIE v2 is a CLI that packages and deploys HIE components, **on Docker Swarm only** [60].
  - Jembi's OpenHIM Platform (MPL-2.0) packages OpenHIM, HAPI FHIR, JeMPI or SanteMPI, Kafka, ClickHouse or Elasticsearch, Superset, Kibana, JSReport, Keycloak, nginx or Traefik, OpenFn and mediators [59].
  - This is the reference **national HIE** stack. It is not a hospital-internal integration bus.
- **OpenFn Lightning:** LGPL-3.0, Elixir, workflow automation with an adaptor library. Very active (v2.19.2 on 2026-10-16). A DPG [61][62][119]. Use it for programme and government integrations (DHIS2 and similar).
- **Mirth Connect → Open Integration Engine (OIE) and BridgeLink:**
  - NextGen made Mirth Connect a single commercial, proprietary product from **4.6** (announced 2025-03-19). **4.5.2 is the last open-source version** [63].
  - **OIE** is an MPL-2.0 fork of the community code. It shipped **v4.6.0 on 2026-07-09**, which made Java 17 the minimum. Its release notes say it "remediates 24 known CVEs (1 Critical, 10 High, 12 Medium, 1 Low) through dependency upgrades" [130]. It became **Eclipse Open Integration Engine** in incubation on **2026-09-07** [64][65][124].
  - Patch lag: as of Oct 2026, OIE had merged fixes for three CVEs disclosed in Sep 2026, but they were not yet in a release. Commercial Mirth had moved to 4.7.x, with 4.7.2 fixing those CVEs [66].
  - **BridgeLink** (Innovar Healthcare) is a second fork. Its MPL-2.0 engine is free, and Innovar sells optional paid offerings around it [66].
  - Note the version-string collisions: OIE 4.6.0 and "OpenShare Engine 4.6.0-7" both report 4.6.0, and commercial Mirth also has a 4.6 line. Check which build is installed [66].
- **Apache NiFi** (Apache-2.0) is very active (2.12.0 in Sep 2026) [67]. It suits bulk data-flow and ETL pipelines, not HL7v2 interface management.

### 3.5 Terminology

- **Open Concept Lab (OCL):**
  - A FHIR-enabled terminology platform that hosts CIEL. oclapi2 is very active (2.3.223 on 2026-10-16). A DPG [68][119][124].
  - **Change:** paid subscriptions start **2026-11-01**. The Mapper, AI assistant, matching, private repositories, the **full FHIR terminology service** and the MCP server become premium, and the free tier keeps public browsing and a rate-limited API [69]. *Pass 2:* the tiers are Community (free), Pro ($20/month, one person), Team ($79/month, up to 5 members) and Enterprise (custom). Existing accounts that use premium features have until **2026-12-01** to subscribe [69].
  - An anonymous API call made during this research returned "Anonymous API access is disabled" [125]. A pass-2 re-test on 2026-10-16 returned "Authentication required. Anonymous API access is disabled." with an `upgrade_url` pointing to the pricing page.
  - The tools remain open source and can be self-hosted [69].
- **Snowstorm** (SNOMED International):
  - **Apache-2.0** (LICENSE verified), Elasticsearch-based, with a FHIR terminology API covering SNOMED CT, LOINC, ICD-10 and ICD-10-CM. It powers the SNOMED browser [70].
  - **11.0.0 (2026-09-02)** [124]. Bahmni integrates with it [17].
  - The SNOMED CT *content* still needs a license (Affiliate or a member-country National Release Center). *(Background knowledge.)*

### 3.6 FHIR servers and libraries

- **HAPI FHIR:**
  - Apache-2.0, Java, the reference library and JPA server. 2,413 stars. Recent releases: 8.10.0 (2026-05-21), 8.10.1 (2026-07-22), 8.12.0 (2026-09-01), 8.12.1 (2026-09-15) and a backport 8.8.2 (2026-09-25) [71][124].
  - The JPA starter supports Postgres, SQL Server and H2 (**MySQL is not supported**: "does not support MySQL as it is deprecated"), Lucene or Elasticsearch, subscriptions, CQL, CDS Hooks, MDM, runtime IG install, OpenTelemetry and an MCP endpoint. It ships **without security**. Docker and Helm deployment [72].
- **Microsoft FHIR Server:**
  - MIT, .NET with a SQL Server backend. It is the code behind Azure Health Data Services. 5.1.2 (2026-10-11) [73][124].
  - **The Cosmos DB provider loses support on 2026-09-30 and R4B on 2026-07-01** [73].
  - Azure API for FHIR was retired on 2026-09-30 [74].
- **LinuxForHealth (IBM) FHIR:** Apache-2.0, but the last release was **5.1.1 in Dec 2022** and the last push **Apr 2024**, even though the README still says "under active development" [75][124]. **Avoid it.**
- **Blaze** (Samply): Apache-2.0, Clojure, a high-performance FHIR server with a built-in CQL engine. "Widely used" in Germany's Medical Informatics Initiative. v1.11.0 (Aug 2026) [76][124]. Good for analytics and research cohorts.

### 3.7 Public-health and HMIS reporting, HR and supply chain

- **DHIS2** (HISP UiO): BSD-3. The system of record for health data in **80+ LMIC governments** and in use in 100+ countries. Very active (2.43.2, 2.42.6 and 2.41.10 maintained in parallel). A **Shared Services Fee and Contributing Partner Program starts in 2026** [77][124]. For LMIC markets, aggregate and tracker reporting *to* DHIS2 is a must-have integration.
- **iHRIS:** LGPL-3.0. Commits continue (Sep 2026), but there has been no formal release since 2023 [78][124]. *(iHRIS 5 being FHIR-based is background knowledge.)*
- **OpenLMIS:** AGPL-3.0, Java microservices. Active again (v3.20.0 and 3.20.1 in Sep–Oct 2026, after 3.19.2 in Nov 2025) [79][124]. It is for national supply chains, not hospital pharmacy inventory.

### 3.8 Synthetic data and analytics

- **Synthea** (MITRE): Apache-2.0, 3,397 stars. **v4.0.0 (2026-03-05)** added US Core 7 export and requires JDK 17 or later. A DPG [80][119]. *Estimate:* Synthea models longitudinal and ambulatory histories well. It is weak on inpatient detail (ADT moves, MAR, high-frequency vitals, OR schedules), so we will need our own inpatient scenario generators.
- **fhir-data-pipes** (OHS Foundation, which started it as a Google–OpenMRS collaboration): Apache-2.0. It moves FHIR from HAPI, GCP or OpenMRS into **Parquet with SQL-on-FHIR views**, using Apache Beam [81]. It is the reference pattern for analytics on a FHIR core.

---

## 4. FHIR-native and headless EHR platforms

### 4.1 Medplum

- **License and activity:** Apache-2.0, TypeScript monorepo. 2,746 stars and 976 forks. Releases are nearly daily or weekly (**v5.2.5 on 2026-10-15**) [89][124].
- **Architecture:**
  - Node.js server with **PostgreSQL** (primary store) and **Redis** (cache and job queue) [84].
  - AWS CDK reference deployment on ECS Fargate with RDS, ElastiCache and S3. **Bots** (TypeScript functions) run on Lambda or in-process.
  - A React component library and a TypeScript SDK [84][85].
  - The **Medplum Agent** runs on-prem and connects HL7v2/MLLP, ASTM and DICOM devices to the cloud over outbound HTTPS [85].
  - Integrations: SMART App Launch, CDS Hooks, FHIRcast and C-CDA [85].
  - *(Background knowledge, re-verify: resources are stored per type as JSON plus extracted search columns. Multi-tenancy uses "Projects" and AccessPolicies.)*
- **Imaging:** a **DICOMweb beta** (Aug 2026) [87]:
  - STOW, QIDO and WADO-RS at `/dicomweb`, under the same OAuth and access policies as FHIR
  - the Agent acts as a C-STORE SCP
  - custom DicomStudy, DicomSeries and DicomInstance resources
  - OHIF as the viewer
  - Gaps: studies are not yet linked to Patient ("the next thing we are building"), richer QIDO-RS querying is planned, and C-MOVE is mentioned only as a capability users may need. *(Blog dated 2026-08-07.)*
- **Compliance:** **ONC certified 2025-12-31** (Medplum 5; CHPL 15.04.04.3147.Medp.05.03.1.251231). Certified criteria are (a)(2), (a)(5), (a)(14), (b)(1), (b)(10), (b)(11), (c)(1), (d)(1)–(7), (d)(9), (d)(12), (d)(13), (g)(3)–(7), (g)(9) and (g)(10). *Pass 2 correction:* pass 1 said "(d)(1)–(13)", but (d)(8), (d)(10) and (d)(11) are not on the disclosure. (a)(9) is not listed [83]. SOC 2 and a standard BAA are shown for the cloud tiers [82].
- **Pricing (cloud):** Free ($0, no bots, emails or custom domains). **Production $2,000/month** includes bots, 1 custom domain and 3 access policies. **Premium $6,000/month** adds sent emails, diagnostics, lab and medication integrations, 5 custom domains, 10 access policies, and private Slack support. Enterprise by quote, including dedicated infrastructure. **Self-hosted Community is free.** Self-hosted Enterprise by quote [82]. *(Pass 1 wrongly listed bots as a Premium-only feature.)*
- **Hospital-scale evidence:**
  - MediMind: under contract with a 25-hospital network, with the first modules live. The anchor customer runs it on-premise. About 1.1M patients and 3.7M observations were migrated, with HL7v2/ASTM analyzers and imaging [86].
  - Awell Panels: a care-team worklist on self-hosted Medplum (on GCP), used for 14-day post-discharge follow-up at an unnamed national post-acute provider. It went from 2 to all 180 facilities in nine months and handles about 250k discharges a year with about 500 weekly users [88]. **This is a care-coordination layer, not an inpatient EHR**, so it is evidence of scale and multi-facility operation, not of inpatient workflows.
- **Gaps for an HMS (opinion):**
  - no inpatient workflow apps (ADT and beds, nursing documentation, MAR/BCMA, OT scheduling, ED tracking board)
  - no ERP
  - analytics depends on your own ETL or warehouse
  - one VC-backed company is the steward
  - performance at very high write rates (ICU device streams) must be load-tested
- **Verdict:** the strongest OSS foundation for a TypeScript team building a FHIR-native HMS. **Recommended**, with an abstraction boundary and an upstream-contribution policy.

### 4.2 Aidbox (Health Samurai)

- **Proprietary.** The free development license prohibits loading "real healthcare data or Protected Health Information". *(Pass 1 also said data is capped at 5 GB. The current licensing, product and price pages do not state a cap, so treat that as unverified.)* Production licenses are per **dataset/database**, and any number of instances, read replicas and DR standbys can serve it [90].
- FHIR R4 and R5, SQL on FHIR, SMART, subscriptions, bulk data and terminology [92]. *(Postgres JSONB storage: background knowledge.)*
- **Platform change:** the legacy **Zen and Entity-Attribute engines stopped working in Aug 2025**, so users had to move to the FHIR Schema engine. The Jul 2025 LTS keeps legacy support for two years [91].
- **Pricing:** a third-party comparison and an earlier vendor page put Core at about **$1,900/month or $19,000/year per database**. The current vendor price page lists Development (free), Production ("pay-as-you-go") and Enterprise (custom) with no rates, so **verify with the vendor** [92][93].
- **Verdict:** technically excellent. Proprietary dependence in the core of our product brings vendor risk, as the forced engine migrations show.

### 4.3 Smile Digital Health (Smile CDR / "Smile Omni")

The company maintains HAPI FHIR. It now markets "Smile Omni" (OmniVera, OmniCompli, OmniQ, OmniConcierge), focused on payer and regulatory work and quality measures. For CMS-0057-F, the Patient Access, Provider Access, Payer-to-Payer and Prior Authorization API requirements apply from **2027-01-01**, and the operational prior-authorization provisions have applied since 2026-01-01 [94][134]. It claims 190+ implementations and 255k TPS (vendor claims) [94]. **Verdict:** a commercial, enterprise-grade HAPI. It fits payer interop and data platforms better than a hospital EHR core.

### 4.4 Hyperscaler FHIR services

- **Azure Health Data Services:** FHIR and DICOM services. **Azure API for FHIR was retired on 2026-09-30**. The SMART-on-FHIR proxy went earlier, and SMART on FHIR (Enhanced) replaces it [74].
- **Google Cloud Healthcare API:** FHIR stores for DSTU2, STU3 and R4, with profile/IG validation, Pub/Sub notifications, and BigQuery export and streaming [95].
- **AWS HealthLake:** a managed FHIR R4 "AI-ready persistence layer" with identity linking across claims, clinical and ADT data, SQL querying and an MCP server. It is positioned for CMS payer APIs and analytics [96].
- **Verdict:** good analytics and exchange tiers and handy for cloud tenants. Their quotas, feature lag and retirement risk (Azure) make them a poor system of record for a portable, on-prem-capable HMS.

### 4.5 Ambulatory API-first EHRs

- **Canvas Medical:** a Python **plugin SDK**. Plugins respond to events, return "effects" and read data through read-only Django ORM views, running sandboxed inside your Canvas instance [97]. It markets outpatient specialty and virtual care (2026 Best in KLAS ambulatory specialty) [98]. canvas-plugins is a small public repository (14 stars) [124].
- **Oystehr (formerly ZapEHR):** a headless platform with FHIR R4B/R5 APIs, "Zambdas" (functions), telehealth, eRx, eligibility and claims, and "ONC Certification as a Service", priced on usage [99].
- **Healthie and Elation:** API-first ambulatory platforms. Healthie targets virtual-first, nutrition and behavioural care [102]. Elation's REST, FHIR and HL7 docs moved to help.elationhealth.com [103].
- **Verdict:** none of them target hospitals. Their extension *patterns* are worth studying: Canvas's event → effect plugin contract, and Oystehr's "certification as a service".

### 4.6 Network and data aggregators

- **Metriport:** API, warehouse and EHR apps over Carequality, CommonWell, eHealth Exchange and TEFCA. **AGPL-3.0 for the main code, with a separately licensed "Enterprise Edition" directory** (open core) [101]. Release-feed activity ended in Oct 2025, though commits continued to Aug 2026 [124].
- **Particle Health:** a commercial national record-retrieval API (FHIR R4 or C-CDA), "Signal" ADT alerts and "TEFCA in a Box" [104].
- **Verdict:** for US deployments, integrate one of these for outside records. Do not build national network connectivity yourself.

### 4.7 Hospital-scale viability ranking (opinion)

| Rank | Foundation | Why |
|---|---|---|
| 1 | **Own FHIR-shaped domain on Postgres + HAPI libraries** *(moved from rank 3; reconciled 2026-10-16)* | Most control over invariants, tenancy (DB per tenant) and performance tuning. FHIR version churn is absorbed in the projection. Highest build cost. This is the pack's ADR-001 posture (`06` §7.1, `08` §3.11, `11` §0) |
| 2 | **Medplum (self-hosted)** | OSS (Apache-2.0), hospital evidence, ONC-certified, DICOMweb, device agent, TypeScript end to end. It is the spike alternative and a reference design. Its Projects share one database, which conflicts with `08`'s DB-per-tenant model |
| 3 | **HAPI FHIR JPA (Java)** | The most mature OSS FHIR engine; you build security, tenancy, UI and workflow yourself. It is the spike alternative for a JVM team |
| 4 | Aidbox | Excellent but proprietary core; licensing and engine-change risk |
| 5 | Hyperscaler FHIR services | Analytics and exchange tier only |
| — | Canvas, Oystehr, Healthie, Elation | Ambulatory only |

---

## 5. The openEHR ecosystem

### 5.1 Concepts

openEHR uses a **two-level model**:
- a stable **Reference Model** (compositions, entries, data types)
- clinician-governed **archetypes** (maximal reusable data definitions) and **templates** (use-case constraints)

These are published in the **Clinical Knowledge Manager (CKM)**, which Ocean Health Systems develops and runs. Data is queried with **AQL**, a path-based query language. *(Concept descriptions are background knowledge; the CKM page confirmed its archetype, template and terminology-subset governance role [CKM fetch, no stats available].)*

### 5.2 CDRs

- **EHRbase** (vitagroup, with Hannover Medical School and HiGHmed): **Apache-2.0**, Java and PostgreSQL. "The primary open-source CDR" [107]. Very active: **v2.36.0 on 2026-09-15**, with roughly monthly releases [105][124]. EHRbase 2 rewrote its AQL engine. vitagroup sells "HIP EHRbase" and "HIP CDR" (adds a FHIR store) for large-scale production [108]. ICT&health reported (2025-05-15) that EHRbase drew "more than 400 active subscribers" within five months. The article does not say whether these are sandbox, cloud or production subscribers [106].
- **Better Platform** (Slovenia; commercial): an openEHR CDR for the lifelong clinical record plus a **FHIR operational repository** for demographics, identity, scheduling, referrals and workflow, with an Interop Hub and Better Studio, an AI and low-code app builder [109]. Customers listed include NHS Wales, OneLondon, The Christie, Charité-BIH, Universitätsspital Basel, Slovenia's Ministry of Health and Catalonia's health system. It claims 40M+ records and 1,000+ institutions (vendor claims) [109].
- **Others:**
  - EHRServer (CaboLabs), ArcEHR (beta) and FerroEHR (Rust, MIT, single maintainer) [107]
  - commercial Nordic and Dutch vendors (DIPS Arena in Norway, Cambio in Sweden, Code24 in the Netherlands) and Ocean *(background knowledge; not re-verified)*

### 5.3 Adoption

- **Slovenia:** the national EHR stores about **98%** of the population's data in openEHR [111]. *(HiGHmed's promotional page gives this without a source. The preprint confirms that Slovenia's national system is openEHR-based but does not give the percentage [132].)*
- **Catalonia:** a regional platform covering about 7.5M [111] to "8M+" [113] residents. Madrid's InfoBANC covers 6.5M [111].
- **Nordics:**
  - A 2026 medRxiv preprint (Kohler S. et al., BIH/Charité; v1 2026-08-31, v2 2026-09-06; not peer-reviewed) reports **3 of 4 Norwegian health regions**, **19 of 21 Swedish regions** and **16 of 21 Finnish wellbeing services counties** on openEHR-based systems [112][132]. It combined a vendor survey (11 vendors, deployments in 22 countries and 100+ institutions and regions) with a community survey (n=29, 17 countries). Together they cover 28 countries, 26 of them with a reported openEHR CDR. It found that 61% of deployments serve primary use only.
  - HiGHmed says "seven regions" in Sweden, without a source [111]. The figures differ, so prefer the preprint, which is newer and survey-based.
- **Ireland, Malta, Greece, Jamaica and Slovenia** run national systems [112].
- **Moscow (EMIAS):** about 12.6M citizens and 670+ providers per 2020–21 sources. No 2025–26 confirmation was found [114].
- **Wales:** DHCW contracted Better in 2021 for a national openEHR CDR that the Welsh Clinical Portal uses [110]. Current scale was not verified.
- **Germany:** HiGHmed and university hospitals use EHRbase [107][111].
- **Brazil:** public and private projects [111].
- **Fragility:** the preprint "identified no country in which openEHR is named in binding national regulation" [112][132]. Black Book (via openEHR.org, 2025-04-01) says "Slovenia stands out with a national mandate for openEHR" but gives no details of the mandate, so sources disagree [113]. Treat Slovenia's "mandate" as a de facto national choice unless a legal instrument is found.

### 5.4 openEHR + FHIR hybrid patterns

1. **openEHR CDR for clinical persistence, FHIR for exchange.** Most literature recommends this split. An expert-panel viewpoint in JMIR (Pedrera-Jiménez M. et al., 2023-12-28; panel includes openEHR board members) rates openEHR "Suitable" for persistence and querying, where FHIR is "Limited". FHIR and ISO 13606 are rated "Suitable" for exchange, where openEHR is "Limited" [115][133]. Note that this is consensus opinion, not empirical evaluation.
2. **Better-style dual repositories:** openEHR for clinical data, FHIR for operational data such as identity, scheduling and workflow [109].
3. **Mapping layers:** **FHIRconnect** (arXiv, Nov 2025) is a DSL with an open-source engine ("openFHIR"). It mapped 24 international archetypes to 15 FHIR profiles across 7 domains and reports 65% mapping reuse [116].
4. **Archetype-relational mapping** for performance-critical persistence [117].

### 5.5 Pros and cons versus FHIR-native persistence (opinion, informed by [112][115][116])

| Dimension | openEHR CDR | FHIR-native store |
|---|---|---|
| Clinical modelling depth and governance | **Strong** (CKM, archetype reuse, clinician-led) | Profiles and IGs are good, but data is a less "maximal" model |
| Query | **AQL is powerful for clinical querying** | FHIR search is limited; use SQL-on-FHIR or a warehouse |
| Developer ecosystem and talent | Small | **Large** (HAPI, Medplum, SMART, CDS Hooks, US/EU regulation) |
| Regulatory pull | EU/Nordic tenders; EHDS alignment is an opportunity | **US (ONC/CMS), India (ABDM), most national exchange specs** |
| Operational/admin data | Weak; usually paired with FHIR | **Native** (Patient, Encounter, Appointment, ChargeItem, ...) |
| Tooling maturity | EHRbase plus commercial CDRs | Many servers, validators, SDKs |
| Cost of dual standards | Mapping needed for all exchange | Single model |

**Verdict:** a FHIR-shaped core plus an **optional openEHR export/CDR adapter** (EHRbase plus FHIRconnect) for Nordic, UK and EU public tenders. *(Reconciled 2026-10-16: "FHIR-shaped" means our own domain store with FHIR-shaped clinical facts and a generated FHIR projection; see the §9 cross-report note.)*

---

## 6. Comparison tables

### 6.1 Full HIS/EHR systems and platforms

Activity reflects the GitHub/Codeberg state on 2026-10-16 [124] unless cited.

| Project | License | Stack | Data model | Scope | Activity 2025–26 | Deployments (claims) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|---|---|
| **OpenMRS (2.8 + O3 3.7)** | MPL-2.0 + Healthcare Disclaimer [8] | Java/Spring/Hibernate, MySQL/MariaDB (Postgres improving); React/single-spa/Carbon | EAV obs + concept dictionary (CIEL); FHIR2 translation layer | Outpatient/HIV/NCD EMR; growing billing, stock, wards, lab | **Very active** (core 2.8.10 Oct 2026; esm-core v11) | 8,000+ facilities, 70+ countries [1] | Community, DPG, concept discipline, micro-frontends | EAV reporting pain; shallow inpatient/ERP; distribution lag |
| **Bahmni (Lite 2.0 / Standard 1.0.2)** | MPL-2.0 (bahmniapps) [18] | OpenMRS + Odoo 16 + OpenELIS + dcm4chee + Metabase; React 19 (Lite 2.0) | OpenMRS obs → FHIR R4 in 2.0 | Small/medium hospitals, LMIC | **Active** (Lite 2.0 Sep–Oct 2026) | 500+ sites, 50+ countries [17] | Integrated EMR+ERP+LIS+PACS; offline on-prem | Multi-system ops; long AngularJS legacy; costly migrations |
| **Ozone HIS** | MPL-2.0 | OpenMRS O3 + Odoo + SENAITE + Superset | OpenMRS + FHIR integration | Integrated HIS | Active, **pre-1.0** (alpha.15 Jan 2026) | DPG [119] | Modern O3-based integrated distribution | Immature |
| **OpenEMR 8.4** | GPL-3.0 | PHP 8.2–8.5, MariaDB/MySQL | Relational | US ambulatory, practice management | **Very active** (8.0 → 8.4.1 in 2026) | 4,000+ downloads/month (not deployments) [23] | ONC-certified; full US billing; FHIR/SMART | No inpatient; GPL; security debt; US-centric |
| **GNU Health 5.0** | GPL-3.0 | Python 3.13, Tryton 7.0 LTS, PostgreSQL; GTK client | Relational ORM (Tryton) | Broad HIS + public health + lab + genetics | **Active** (5.0 Jun 2025; patches to Apr 2026) | Jamaica MoH, AIIMS, Laos, Cameroon partners [28] | Breadth; ERP underneath; Federation | Niche framework/UI; small community |
| **VistA (WorldVistA)** | Apache-2.0 (repo) / public domain origins | MUMPS/M, FileMan, Delphi CPRS | Hierarchical M globals | Full hospital (VA) | **Maintenance/volunteer**; VA migrating to Oracle by ~2031 [34] | VA (being replaced) | Proven clinical depth (BCMA, orders) | Dead ecosystem, scarce skills |
| **Open Hospital 1.15** | GPL-3.0 | Java, Swing; React UI WIP | Relational | Small rural hospitals, offline | **Active** (v1.15.2 Oct 2026) | Not stated [36] | Simple, offline | Desktop-centric; small team |
| **HospitalRun** | MIT | JS, CouchDB/PouchDB, React | Document | Offline hospital | **Archived** (last release 2020) [37] | — | Offline-first idea | Abandoned |
| **CARE (OHC) v3** | MIT | Django/DRF/Celery, Postgres, Redis; React/Tailwind | **FHIR R5-aligned** relational | Hospital, ICU/TeleICU, pharmacy, lab, billing | **Very active** (re-architecture Feb 2025; daily FE commits) | Indian states; DPG [39][40] | Modern, permissive, plugins, FHIR-shaped | India-centric; single steward |
| **Marley Health (Frappe)** | GPL-3.0 | Python/Frappe, MariaDB, ERPNext | Frappe DocTypes ("largely based on FHIR") | OPD/IPD + full ERP | **Very active** (v16.6.1 Sep 2026) | Frappe Cloud users | ERP depth fast | GPL; clinical UX depth |
| **OCA vertical-medical (Odoo)** | AGPL-3.0 | Python/Odoo | Odoo ORM | Medical add-ons | **Low** (19.0 branch: 1 commit) | — | Odoo ecosystem | Stalled migration; AGPL |
| **OpenSRP 2 (fhircore)** | Apache-2.0 | Kotlin, Android FHIR SDK, HAPI, Keycloak | FHIR (on-device) | Community/frontline | Active (v2.2.2 Nov 2025) | DPG [119] | Offline FHIR on Android | Not hospital; SDK slowing |
| **Tamanu** | GPL-3.0 + BSL 1.1 files [45][126] | Node.js, Postgres, central/facility/mobile sync | Relational | Facility EHR, Pacific | **Very active** (v2.66.0 Oct 2026) | Pacific nations *(background)* | Edge + central sync topology | License ambiguity (BSL) |
| **Medplum 5.2** | Apache-2.0 | TypeScript/Node, Postgres, Redis, React | **FHIR R4 native** | Headless platform + reference apps | **Very active** (weekly releases) | Post-discharge worklist across 180 facilities (Awell); 25-hospital contract, first modules live (MediMind) [86][88] | ONC-certified, Agent, DICOMweb, bots | No hospital workflows/ERP; single steward |
| **Aidbox** | Proprietary (free dev) | Clojure/Java, Postgres (JSONB) | FHIR R4/R5 | Headless FHIR backend | Active | Many (vendor) | Performance, SQL on FHIR, forms | Proprietary; forced engine migration [91] |
| **HAPI FHIR JPA** | Apache-2.0 | Java/Spring, Postgres/MSSQL, Lucene/ES | FHIR (indexed resources) | FHIR server/library | **Very active** (8.12 Sep 2026) | Ubiquitous | Mature, complete spec support | No security/UI out of the box [72] |
| **EHRbase 2.36** | Apache-2.0 | Java, PostgreSQL | **openEHR RM** + AQL | Clinical data repository | **Very active** | HiGHmed/German university hospitals [107] | Open-source openEHR CDR | Needs FHIR side; small talent pool |

### 6.2 Ancillary components

| Component | License | Stack | Function | Latest release (2025–26) | Activity | Notes |
|---|---|---|---|---|---|---|
| OpenELIS Global 2 | MPL-2.0 | Java | LIS | 3.2.3.0 (2026-09-26) | Very active | FHIR-native; 1,000+ labs [47] |
| SENAITE | GPL-2.0 | Python/Plone | LIMS | 2.6.0 (2025-04-04) | Maintenance | ISO 17025 focus [49] |
| Orthanc | GPLv3+ core / AGPLv3+ plugins | C++ | DICOM server | 1.13.0 (2026-08-15) [129] | Active | No dual licensing [51] |
| dcm4chee-arc-light | MPL-1.1 | Java EE/WildFly | Enterprise PACS/VNA | 5.35.2 (2026-10-15) | Very active | Keycloak, LDAP [52] |
| OHIF Viewer | MIT | TS/React, Cornerstone | Web viewer | 3.14 betas (Oct 2026) | Very active | NCI-funded to 2028 [53] |
| Weasis | EPL-2.0 / Apache-2.0 | Java | Desktop viewer | 4.7.3 (2026-08) | Active | DICOMweb + DIMSE [54] |
| OpenCR | MIT | Node, HAPI, ES | Client registry | 3.0.0 (2021) | **Dormant** | [55] |
| SanteMPI/SanteDB | Apache-2.0 | C#/.NET | MPI/registry | 3.0.2118 (2026-10) | Active (small) | DPG [56] |
| JeMPI | MPL-2.0 | Java/Kafka *(bg)* | MPI | 1.1.0 (2024-08-12) | Low (last push 2025-04) | [57][124] |
| OpenHIM | MPL-2.0 | Node, MongoDB | IOL/proxy | 8.5.0 (2024-09) | Maintenance | [58] |
| Eclipse OIE | MPL-2.0 | Java | Interface engine | 4.6.0 (2026-07-09) | Active | Mirth fork [64][65] |
| OpenFn Lightning | LGPL-3.0 | Elixir | Workflow automation | 2.19.2 (2026-10-16) | Very active | DPG [62] |
| Apache NiFi | Apache-2.0 | Java | Dataflow/ETL | 2.12.0 (2026-09) | Very active | [67] |
| OCL (oclapi2) | Open source (license per repo) | Python/Django | Terminology management | 2.3.223 (2026-10-16) | Very active | Paid tiers from 2026-11-01 [69] |
| Snowstorm | Apache-2.0 | Java, Elasticsearch | SNOMED/FHIR terminology server | 11.0.0 (2026-09-02) | Active | SNOMED content license needed |
| Microsoft FHIR Server | MIT | .NET, SQL Server | FHIR server | 5.1.2 (2026-10-11) | Very active | Cosmos DB support ended [73] |
| LinuxForHealth FHIR | Apache-2.0 | Java | FHIR server | 5.1.1 (2022-12) | **Dormant** | [75] |
| Blaze | Apache-2.0 | Clojure | FHIR + CQL analytics | 1.11.0 (2026-08) | Active | German MII [76] |
| DHIS2 | BSD-3 | Java, Postgres | HMIS/tracker | 2.43.2 (2026-10) | Very active | Shared Services Fee 2026 [77] |
| iHRIS | LGPL-3.0 | (FHIR-based v5, bg) | HR registry | none since 2023 | Maintenance | [78] |
| OpenLMIS | AGPL-3.0 | Java microservices | National LMIS | 3.20.1 (2026-10) | Active | [79] |
| Synthea | Apache-2.0 | Java | Synthetic patients | 4.0.0 (2026-03) | Active | US Core 7 [80] |
| fhir-data-pipes | Apache-2.0 | Java/Beam, Parquet | FHIR → analytics | (continuous) | Active | SQL-on-FHIR [81] |
| Mirth Connect ≥4.6 | **Proprietary** | Java | Interface engine | commercial | — | 4.5.2 last OSS [63] |

---

## 7. Architecture lessons (cross-cutting)

1. **Data model choice drives everything after it.**
   - *EAV/obs* (OpenMRS) gives schema-free agility and a governed concept dictionary. The price is costly reporting and weak integrity, and every serious implementation ends up flattening data with ETL (fhir-data-pipes, Bahmni marts/Metabase) [81].
   - *Relational ORM* (GNU Health/Tryton, OpenEMR, Frappe) is easy to query but rigid. Every new clinical form becomes a schema change.
   - *Document stores* (HospitalRun CouchDB) make offline sync easy and reporting and integrity hard.
   - *FHIR-native* (Medplum, CARE, Bahmni Lite 2.0, MediMind) is the current consensus: standard semantics, exchange "for free", and profiles for constraints [13][39][86].
   - **Lesson:** use FHIR R4 resources as the canonical *clinical* model. Keep *financial and inventory* data in proper relational and ledger models. Feed analytics through SQL-on-FHIR into columnar stores. *(Reconciled 2026-10-16: read "canonical clinical model" as the canonical vocabulary and storage shape for clinical facts, held as FHIR-shaped JSONB inside our own PostgreSQL domain store. Operational aggregates such as orders/MAR, ADT and beds are domain-owned and projected to FHIR at the edge. See `08` §3.11 and `11` §0.)*
2. **Translation layers are a smell when they sit at the core.** OpenMRS's FHIR2 module needs Translators and DAOs to map between models [9]. Bahmni had to write migration scripts to move legacy obs into FHIR [13]. MediMind says "FHIR R4 became our operational data model, not an interoperability layer bolted to the edge of the system" [86]. Choose the canonical model once. *(Reconciled 2026-10-16: the smell is hand-written translation between two **different** clinical models, such as obs to FHIR. A generated projection from FHIR-shaped facts and domain aggregates defined in one schema is the pattern adopted in `06` §7.1 and `08` §4.6. It is not that smell.)*
3. **Extensibility mechanisms work best in layers.**
   - *Backend modules or plugins:* OpenMRS OMOD, CARE "plugs", Canvas handler → effect, Medplum bots and subscriptions [3][39][97][85].
   - *Frontend micro-frontends with extension slots:* O3 single-spa, import maps and slots [3].
   - *Configuration as content:* OpenMRS Initializer, content packages and config schemas [3].
   - **Lesson:** do all three, but keep frontend modules in one framework, versioned, behind a stable host API. O3 shipped three esm-core major versions in 2026, which shows the cost of churn [124].
4. **Distributions fragment a product.** OpenMRS 2.x split into incompatible distributions. O3 exists to rebuild a shared product with local config [2]. **Lesson:** one product with tenant- and country-level content packs. No customer forks.
5. **Offline support depends on topology, not only the browser.**
   - O3 offers a basic service-worker offline mode [3].
   - Real hospital resilience comes from **on-prem or edge servers**: Bahmni on-site, Open Hospital client-server, and Tamanu's facility server plus central server with mobile sync [36][45].
   - Device and edge connectivity uses outbound agents (Medplum Agent) [85].
   - **Lesson:** design a "facility edge node" that can run the hospital during WAN outages and sync with conflict rules.
6. **Scale is designed in, not added later.** OpenMRS added Elasticsearch, Infinispan clustering and S3 storage only in 2025 [5]. Microsoft dropped Cosmos DB [73]. HAPI warns its starter lacks shared subscription state across instances [72]. **Lesson:** decide on horizontal scaling, search indexing, caching, object storage and event streaming on day 1. Do not put high-frequency device data into FHIR Observation rows; use a time-series store and summarize into FHIR.
7. **Upgrades are a product feature.**
   - Bahmni Lite 1.x → 2.0 needed data migration and republishing forms [13].
   - OpenEMR's ONC certification retirement forced upgrades by a deadline [21].
   - Aidbox removed legacy engines [91].
   - **Lesson:** use zero-downtime online migrations, versioned config, automated upgrade tests against production-like data, and an LTS cadence.
8. **Rewriting the UI is the most common and most expensive form of debt.** Examples: AngularJS → React (Bahmni, 2026), OpenMRS 2.x → O3, Swing → React (Open Hospital, still in progress), GTK → web (GNU Health, a development web client), and Ember → React at HospitalRun, which was fatal [13][2][36][25][37]. **Lesson:** keep the UI thin over stable APIs and the design system, and budget for continuous frontend renewal.
9. **Governance and funding decide survival.**
   - *Anchors:* OpenMRS Inc. with PEPFAR/CDC implementers; HISP UiO with WHO collaborating-centre status; UW DIGI; the OHC Foundation; SNOMED in the Bahmni Coalition [1][77][47][39][17].
   - *Failures:* HospitalRun (volunteers only) and OSEHRA (lost its anchor customer) [37][30].
   - *Monetization moves:* DHIS2 fees, OCL subscriptions, Mirth going proprietary, Orthanc ending dual licensing [77][69][63][51].
   - **Lesson:** every OSS dependency needs a sustainability risk score and an exit plan.
10. **Configuration beats customization, up to a point.** Concept dictionaries, form builders (O3 Form Builder, Bahmni Forms 2.0), and FHIR Questionnaire/SDC (OpenSRP) let implementers move without developers [2][13][44]. Workflow logic such as order sets, CDS and MAR rules still needs real engineering. **Lesson:** offer a governed low-code layer for forms, order sets, value sets and reports, and keep core workflows in code.
11. **Compliance and security drive the release cadence.** Examples: OpenEMR's SQL injection fixes, the OpenMRS critical security issue that triggered Bahmni patch releases, and the 24 CVEs remediated in OIE 4.6.0, the fork's first feature release after its 4.5.2 rebuild (2025-07-09) [22][15][16][124][130]. **Lesson:** SBOM, dependency scanning, a coordinated-disclosure policy and a patch SLA from v1.

---

## 8. Licensing analysis

### 8.1 License families as encountered

| Family | Components (this report) | Key obligations | Implication for a commercial HMS |
|---|---|---|---|
| **Permissive** (Apache-2.0, MIT, BSD-3) | Medplum, HAPI FHIR, MS FHIR Server (MIT), EHRbase, Snowstorm, Synthea, OHIF (MIT), CARE (MIT), DHIS2 (BSD-3), Blaze, OpenSRP, fhir-data-pipes, SanteDB, OpenCR (MIT), Weasis (Apache option), NiFi | Keep notices; Apache adds a patent grant and NOTICE handling | **Safe** to embed, modify and ship closed-source. Preferred for the core. |
| **Weak copyleft, file-level** (MPL-2.0 / MPL-1.1) | OpenMRS (MPL-2.0 + HD), Bahmni apps, OpenELIS, OpenHIM, OIE, Ozone, JeMPI, dcm4chee (MPL-1.1), OpenMRS FHIR2 | Modified MPL *files* must be released under MPL when distributed; new files can be proprietary; larger works allowed | **Safe** if MPL code stays in separate files or modules and changes are upstreamed. OpenMRS adds a **Healthcare Disclaimer** that strengthens no-warranty/clinical-responsibility terms [8]. *(Exact HD text: check the OpenMRS license page.)* |
| **Weak copyleft, library** (LGPL-3.0, EPL-2.0) | OpenFn Lightning, iHRIS (LGPL); Weasis (EPL option); Odoo Community (LGPL-3, bg) | Changes to the library must be shared; linking from proprietary code is allowed (LGPL relinking rules) | Usually fine as separate services or unmodified libraries. |
| **Strong copyleft** (GPL-2.0/3.0) | OpenEMR, GNU Health, Open Hospital, Marley/ERPNext, SENAITE (GPL-2), Orthanc core, Tamanu (GPL part) | Distributing derivatives requires source under the GPL; SaaS without distribution is not a trigger | **Hospitals' on-prem installs count as distribution.** Use only as **separate, unmodified programs** talking over network APIs ("aggregation"), or not at all. Never link them into the core. |
| **Network copyleft** (AGPL-3.0) | Orthanc plugins (PostgreSQL, viewers), OpenLMIS, CHT, OCA vertical-medical, Metriport (main code) | Users interacting over a network get source rights for modifications | Run **unmodified** in isolation, or publish changes. Orthanc FAQ: proprietary cloud use with AGPL plugins is "Restricted" [51]. |
| **Source-available / non-OSI** | Tamanu (BSL 1.1 alongside GPL on the `central-server`, `shared` and `database` packages) [126][131], **Ottehr** (custom MIT-derived with Competing Product and AI-ingestion bans) [100], Metriport Enterprise Edition directory [101] | Production or competing use restricted; change dates (BSL) | **Exclude from the product.** Do not copy code or let engineers or AI tools ingest it for derivative work. |
| **Proprietary with a free tier** | Aidbox (dev: no PHI; a 5 GB cap is not stated on current pages) [90], Mirth Connect ≥4.6 [63], Smile CDR, hyperscaler APIs | Commercial terms; vendor lock-in | Commercial dependencies; negotiate escrow and exit terms. |
| **Content licenses** | SNOMED CT (Affiliate/NRC), LOINC (free with terms), CIEL (DPG, open content) [119], OCL service tiers [69] | Per-country licensing; attribution | Track per tenant and country. SNOMED fees vary by country (bg). |

### 8.2 Practical rules (opinion)

1. **Core allowlist:** Apache-2.0, MIT, BSD, ISC, MPL-2.0 (file-level; upstream your fixes), LGPL and EPL (as unmodified libraries or services).
2. **Service-boundary list:** GPL and AGPL components only as **unmodified, separately deployed containers** behind documented network APIs. Ship their source offer with on-prem bundles. No proprietary plugins *inside* Orthanc. Get counsel to review any on-prem bundle that includes GPL or AGPL containers.
3. **Denylist:** BSL, "competing use" licenses, licenses with AI-training or ingestion clauses, and unlicensed code.
4. **Rug-pull hedge:** prefer components under foundation governance (Eclipse OIE, Apache NiFi) or with multiple active forks. Pin versions. Keep an exit adapter for every vendor-steered OSS dependency (Medplum, OCL, EHRbase/vitagroup, Snowstorm/SNOMED).
5. **Healthcare Disclaimer and medical-device regulation:** OSS warranty disclaimers do not move regulatory responsibility. If modules count as SaMD (for example CDS that qualifies as a medical device under EU MDR), the manufacturer, meaning us, carries it. *(General regulatory knowledge.)*

---

## 9. Reuse vs Build map

Legend: **Reuse** = adopt as a separate component; **Embed** = use as a library or foundation inside our code; **Build** = our own code (maybe on standards and libraries); **Integrate** = connector to an external or commercial system.

| Functional area | Recommendation | Component(s) | Reasoning |
|---|---|---|---|
| **Clinical data platform / FHIR server** | **Build (on embedded libraries)**; spike the alternative *(reconciled 2026-10-16)* | **First choice:** our own FHIR-shaped domain store on PostgreSQL (one DB per tenant), using **HAPI FHIR structures, validator and v2 libraries**, with a generated FHIR R4 projection/façade. **Alternative to test in the §10.1 spike:** **Medplum** (self-hosted, Apache-2.0) or **HAPI FHIR JPA** as a FHIR-native core | Invariant-heavy hospital workflows (orders/MAR, beds, charges) need domain-owned state machines, and R4 to R6 churn is cheaper to absorb in a projection (`06` §7.1, `08` §3.11/§4.6, `11` §0). Do not hand-build a FHIR *library*: the HAPI structures and validator give the API surface [72]. Medplum stays a reference design and optional component source (React UI kit, agent pattern) [83][85]. |
| **Operational/hospital workflows** (ADT, beds, transfers, OT, ED board, nursing, MAR/BCMA, discharge) | **Build** | On FHIR resources (Encounter, Location, Task, MedicationAdministration, ...) | Where the product wins. No OSS does this at world-class level. Study VistA BCMA, OpenMRS wards/bed management [3] and CARE [39]. |
| **Orders/CPOE and order sets** | **Build** | FHIR ServiceRequest, MedicationRequest, PlanDefinition | Core safety-critical differentiator. CDS via CDS Hooks/CQL (HAPI clinical reasoning or Blaze CQL as engines) [72][76]. |
| **MPI / patient identity** | **Build** (core) + **Integrate** (national) | FHIR Patient + `$match`, survivorship, steward queue; SanteMPI or national CR via PIXm/PDQm | OSS MPIs are dormant or small [55][56][57]. Identity quality is a patient-safety issue. |
| **Terminology service** | **Reuse** | **Snowstorm** (SNOMED) + FHIR terminology (HAPI or Medplum) for LOINC/ICD/local; CIEL seed content; OCL optional | Apache-2.0, active [70]. Handle SNOMED licensing per country. Self-host OCL if used, since tiers change Nov 2026 [69]. |
| **Laboratory (LIS)** | **Build** core lab workflows + **Integrate/Reuse** full LIS | Native: orders, specimens, result review, analyzer gateway (edge agent). Optional: **OpenELIS Global** for reference and public-health labs | Hospital lab must be tightly integrated with CPOE. OpenELIS is MPL-2.0, FHIR-native and active [47][48]. SENAITE only as a separate GPL service. |
| **PACS / VNA** | **Reuse** | **dcm4chee-arc** (enterprise) or **Orthanc** (small/medium, unmodified) | Building a PACS has no ROI. MPL-1.1 vs GPL/AGPL trade-off [51][52]. |
| **Image viewer** | **Embed** | **OHIF** (web, MIT) + **Weasis** (diagnostic desktop) | Proven; DICOMweb; Medplum already pairs with OHIF [87]. |
| **RIS / radiology workflow** | **Build** | FHIR ImagingStudy/ServiceRequest + worklist (DICOM MWL via archive) | Ties into orders, scheduling and reporting. |
| **Interface engine (HL7v2/X12/files)** | **Build** core + **optional Reuse** *(reconciled 2026-10-16)* | **Native Integration Hub** owns MLLP/v2, FHIR, DICOM and national adapters, with ack-state and replay. **Eclipse OIE** (MPL-2.0), or the customer's Rhapsody/Cloverleaf, is optional for site-specific transforms. Our edge agent handles devices | Matches `08` §12.5 and `06` §7.2: no hard dependency on a third-party engine. OIE is active, foundation-governed and Mirth-compatible [64][65], but has patch lag: v4.6.0 (2026-07-09) was still the latest release on 2026-10-16, and the Sep 2026 CVE fixes were merged but unreleased [66][124]. A patch-lag policy therefore applies: CVE monitoring, plus a patched build or compensating controls if upstream misses the SLA. Avoid unpatched Mirth 4.5.2 [63]. |
| **Internal eventing/integration bus** | **Build** (on infra) | Kafka/NATS + FHIR Subscriptions | Platform concern; OpenHIM is a national-HIE pattern, not an internal bus [58][59]. |
| **Government/programme integrations** | **Reuse** | **OpenFn** (LGPL), DHIS2 APIs | LMIC requirement; DPG ecosystems [62][77]. |
| **Reporting/BI and analytics** | **Reuse + Build** | SQL-on-FHIR v2 views → Parquet/warehouse (**fhir-data-pipes** pattern), Superset/Metabase | Proven pattern [81]; Bahmni uses Metabase [14]. Build curated hospital KPIs and regulatory reports. |
| **National HMIS reporting** | **Integrate** | DHIS2 aggregate and tracker | 80+ governments use it [77]. |
| **Synthetic test data** | **Reuse + Build** | **Synthea** v4 (Apache-2.0) + our own inpatient scenario generators | Synthea lacks inpatient detail (estimate) [80]. |
| **Forms / clinical documentation** | **Build** (on standards) | FHIR Questionnaire/SDC renderer and builder; learn from O3 Form Builder and Bahmni Forms 2.0 | Core UX differentiator. Standards keep content portable [2][13][44]. |
| **Scheduling** (OPD, OT, resources) | **Build** | FHIR Schedule/Slot/Appointment | Hospital scheduling (OT, multi-resource) is beyond OSS offerings. |
| **Billing / charge capture / patient accounting** | **Build** | Internal aggregates: charge master, tariffs/packages, charges, ledger, invoices. FHIR ChargeItem/Invoice names are **naming guidance and edge projection only** *(reconciled 2026-10-16)*. The external API uses R6-core resources (Account, Claim, ClaimResponse, Coverage, CoverageEligibility*, EOB, PaymentNotice, PaymentReconciliation) plus national IGs and country payer adapters | Revenue integrity needs native clinical-event coupling. OSS billing (OpenMRS, Bahmni, Odoo) is basic [6][14]. ChargeItem, ChargeItemDefinition, Invoice, Contract and InsurancePlan move out of FHIR R6 core [137] (see `06` §3.2.1, `11` §11). |
| **General ERP** (payroll/HCM, enterprise GL, full procure-to-pay) | **Integrate** where the customer runs an ERP; **native lite** GL/AP/AR and procurement for emerging-market tenants *(reconciled 2026-10-16)* | Connectors for Odoo/ERPNext (SMB/LMIC) and SAP/Oracle/Dynamics/Workday (enterprise) | Proven pattern (Bahmni, Ozone, Marley) [14][19][42]. Avoid GPL linkage by integrating over APIs. Biomedical assets (CMMS), clinical inventory and basic rostering are **native**, per `05` §9.1. |
| **Pharmacy and inventory (hospital)** | **Build** core + **Integrate** ERP | Native dispensing, formulary, ward stock, clinical supply chain and point-of-use, biomedical asset register (CMMS). The ERP handles procurement and finance where present | Safety and clinical integration. OpenLMIS is national supply chain only [79]. |
| **Identity and access (IAM)** | **Reuse** | Keycloak (plus OpenFGA per `08` §12.5); Medplum's OAuth only if Option B wins the spike; SMART on FHIR | Used across OpenSRP, dcm4chee and the OpenHIM Platform [44][52][59]. |
| **Patient portal / apps** | **Build** | On SMART/FHIR APIs | Brand and UX differentiator. |
| **Mobile/offline field apps** | **Reuse** (optional) | Android FHIR SDK / OpenSRP patterns | Only for outreach; the SDK is slowing [120]. |
| **openEHR export / CDR** | **Optional reuse** | **EHRbase** + FHIRconnect/openFHIR mappings | For EU, Nordic and UK tenders [105][116]. |
| **Outside records (US)** | **Integrate** | Metriport (AGPL, as a service) / Particle / HIE | Network contracts and certifications [101][104]. |
| **Device integration (monitors, pumps)** | **Build** edge + **Reuse** protocols | Edge agent (HL7v2/IHE PCD, ASTM), time-series store, FHIR summaries | High-volume data; not FHIR-row-per-datapoint (lesson 7.6). |

**Cross-report note (reconciled 2026-10-16): core data architecture.** Earlier drafts of this report ranked a FHIR-native core (Medplum or HAPI JPA) first. `06` §7.1, `08` §3.11/§4.6 and `11` §0 recommend a domain-owned model with FHIR as the external contract. The reconciled position for ADR-001 follows `06`/`08`/`11`:
- domain aggregates and state machines in PostgreSQL, one database per tenant;
- clinical facts as typed, FHIR-shaped JSONB, so most clinical projections are near-identity, which keeps this report's "no translation smell" point;
- a generated FHIR R4 projection/façade for reads, `$export`, IPS and Subscriptions, with writes through domain commands;
- HAPI libraries embedded, and Kotlin/JVM per `08` §12.5.

Medplum (TypeScript, Projects in one shared database) does not fit `08`'s stack or its database-per-tenant model, so it stays a reference design and an optional component source. Keep the 6–8 week spike (§10.1 #1) as the gate. If the FHIR-native option clearly wins on the 1,000-bed workload and safety invariants, revisit ADR-001.

---

## 10. Implications for our build: concrete recommendations and pitfalls

### 10.1 Recommendations (opinionated)

1. **Do not fork a legacy HIS. Build a proprietary hospital-workflow product on open standards and libraries** *(ranking reconciled 2026-10-16 with `06` §7.1, `08` §3.11 and `11` §0)*.
   - **Option A (ranked first):** our own FHIR-shaped domain model on PostgreSQL, one database per tenant (Kotlin/JVM per `08` §12.5). Embed the **HAPI FHIR structures, validator and v2 libraries**, and generate a FHIR R4 projection/façade for reads, `$export`, IPS and Subscriptions. Writes go through domain commands.
   - **Option B (alternative):** a FHIR-native core, either **self-hosted Medplum** (TypeScript) or **HAPI FHIR JPA**. Both are permissive and very active. Medplum carries ONC certification [83] and has hospital-network references [86][88].
   - Run a 6–8 week **load and safety spike comparing A and B** before freezing ADR-001. Target 1,000-bed workloads: ICU vitals, order bursts at shift change, and MAR scans. Also test the order/MAR invariants and R4-to-R6 mapping cost.
   - Keep a **repository/port abstraction** either way. If B is not chosen, Medplum stays a reference design and an optional component source (React UI kit, agent pattern), not the system of record.
2. **Pick canonical models by domain, and never hand-translate between two different clinical models at the core.**
   - **Clinical:** FHIR R4 vocabulary with national/IG profiles (US Core, ABDM, IPS, EU EHDS later). Clinical facts are stored as typed, FHIR-shaped JSONB. Operational aggregates (orders/MAR, ADT/beds) are domain-owned and projected to FHIR at the edge (reconciled 2026-10-16).
   - **Financial/inventory:** relational and double-entry ledger.
   - **Device streams:** time-series.
   - **Imaging:** DICOM archive.
   - **Analytics:** SQL-on-FHIR → Parquet/warehouse.
   - Avoid the EAV trap. Use FHIR profiles plus Questionnaire for flexibility instead of a bespoke obs table.
3. **Assemble ancillaries from mature OSS as separate services:**
   - dcm4chee or Orthanc, with OHIF and Weasis
   - Eclipse OIE, as an optional engine for site-specific transforms behind our native Integration Hub, under the patch-lag policy (reconciled 2026-10-16; see §9)
   - Snowstorm plus a FHIR terminology server
   - OpenELIS (optional)
   - OpenFn and DHIS2 connectors for LMIC tenants
   - Synthea for test data
   - Keycloak (if not using Medplum auth)
   - Put each behind our own integration contracts, with health checks, upgrade runbooks and SBOM entries.
4. **Build the differentiators natively:**
   - MPI with stewardship
   - ADT/bed management and patient flow
   - CPOE with order sets and CDS (CDS Hooks/CQL)
   - closed-loop medication (MAR/BCMA)
   - nursing documentation
   - OT and ED boards
   - multi-resource scheduling
   - charge capture → patient accounting
   - a clinician-grade UX with a governed low-code forms and reports layer
   - None of these exist at world-class level in OSS. That is our moat.
5. **Adopt O3's good ideas without its churn:**
   - extension slots
   - per-module config schemas with runtime implementer tools
   - Initializer-style **content packs** (concepts/value sets, forms, order sets, roles and reports as versioned artefacts per country or tenant)
   - Prefer a modular monolith frontend with a plugin host over a public micro-frontend marketplace until third-party extension demand is real. Pin a single framework major per LTS.
6. **Engineer for intermittent connectivity:** a facility edge node (Tamanu/Bahmni-style), local survivability for ED, wards, MAR and lab, and asynchronous sync to central with conflict policies. Device and analyzer connectivity through an outbound agent, as Medplum Agent does.
7. **Plan certification and compliance from sprint 1.**
   - US: ONC (g)(10), (b)(10) and DSI (b)(11). Medplum's certified base may reduce the effort, but our product still needs its own certification.
   - India: ABDM.
   - EU: EHDS/IPS, MDR classification of CDS.
   - Note how OpenEMR's certification retirement forced upgrades [21]. Design for annual certification updates.
8. **Licensing governance:** adopt the allowlist, service-boundary list and denylist from §8.2. Automate license scanning in CI. Quarantine GPL/AGPL services. Ban source-available code (Ottehr, BSL) from repositories and AI-tool contexts. Keep source-offer packages for on-prem bundles.
9. **OSS dependency risk management:**
   - Score each dependency for steward type, funding, release cadence, bus factor and license-change history.
   - **High risk:** Medplum (single company), OCL (new paid tiers), EHRbase (vendor-steered), OpenHIM (slow releases), OpenCR/JeMPI (dormant), LinuxForHealth (dead), Mirth (closed).
   - Contribute upstream to the components we depend on (Medplum, HAPI, OIE, OHIF) to gain influence and reduce fork drift.
10. **openEHR as a strategic option, not the core.** Provide an EHRbase-backed openEHR CDR adapter and FHIRconnect mappings for Nordic, UK and EU public tenders. Track the EHDS regulatory direction [112][116].
11. **Learn from the national DPG ecosystems if we target LMIC governments.** Ministries increasingly ask for DPG status, DHIS2 reporting, OpenHIE alignment and CIEL/OCL terminology [10][77][119]. A commercial product can still win by offering **open APIs, DPG-compatible integrations and data portability**. Releasing a permissively licensed "community core" (as CARE does under MIT) is a separate strategic decision.

### 10.2 Pitfalls to avoid

- **The EAV/obs trap:** infinite flexibility and unqueryable data. Use profiled FHIR resources and a governed terminology instead.
- **Distribution forks per customer:** the OpenMRS 2.x fragmentation [2]. Insist on one codebase plus content packs.
- **UI framework lock-in:** AngularJS cost Bahmni a decade [13]. Keep UI layers replaceable.
- **Treating FHIR search as the analytics engine:** it is not. Use SQL-on-FHIR and a warehouse from day 1 [81].
- **Putting device telemetry into FHIR rows,** which leads to database bloat. Summarize instead.
- **Trusting "open source" labels:** Ottehr (competing-use and AI clauses), Tamanu (BSL), Metriport (open core), Mirth (proprietary from 4.6), OCL (paid service tiers). Read every LICENSE [63][69][100][101][126].
- **Embedding GPL/AGPL code into an on-prem product:** this turns the product into a GPL derivative. Orthanc's FAQ states this explicitly [51].
- **Relying on dormant components:** LinuxForHealth FHIR, OpenCR and HospitalRun [37][55][75].
- **Hyperscaler retirement risk:** Azure API for FHIR was retired on 2026-09-30 [74]. Keep cloud FHIR services out of the system of record.
- **Underestimating ERP and billing:** OSS HIS billing is basic. Country-specific payer rules and revenue-cycle depth decide hospital purchases.
- **Ignoring the security patch cadence:** recent critical issues in OpenEMR and OpenMRS show that mature OSS also ships vulnerabilities [15][16][22]. Track CVEs for every component.
- **Assuming stars mean sustainability:** HospitalRun had 6.9k stars and was archived [37][124].

### 10.3 Open questions to verify next (search budget was used up in this session)

- Current KenyaEMR 3.x repositories and national rollout counts. The key palladiumkenya O3 repositories returned 404 on 2026-10-16. Malawi and Rwanda EMR status. *(SmartCare Pro status was partly resolved in pass 2: about 80% of Zambian facilities as of 2026-07-09 [127]. Stack and licence are still unknown.)*
- Medplum write throughput and partitioning guidance at more than 10M resources and high write rates; storage-schema details.
- Exact OpenMRS Healthcare Disclaimer text and Bahmni component licenses beyond bahmniapps.
- Tamanu: the package-level GPL/BSL split was resolved in pass 2 [131]. The BSL parameters (Change Date, Additional Use Grant) are still missing. Ozone FOSS vs Pro edition boundaries are still unknown, because the Ozone website does not describe them.
- CIEL size and license terms after the OCL subscription changes.
- ~~Orthanc's latest version number. JeMPI's license.~~ Resolved in pass 2: Orthanc 1.13.0 (2026-08-15) [129]; JeMPI is MPL-2.0 [124].
- Current openEHR status in Moscow and Wales (2025–26). Pass 2 found no 2025–26 primary source for either.
- Whether Aidbox's free development license still has a data-size cap.

---

## 11. Sources

GitHub and Codeberg metrics (stars, forks, licenses, last push, release tags and dates) were queried live on 2026-10-16 via the GitHub REST API, GitHub release Atom feeds and the Codeberg API [124].

1. OpenMRS home page (stats, 3.7.1 announcement): https://openmrs.org/
2. "O3: The New OpenMRS Explained and the Investments that made it possible" (2024-06-30): https://openmrs.org/o3-the-new-openmrs-explained-and-the-investments-that-made-it-possible/
3. O3 Docs, Key repositories: https://o3-docs.openmrs.org/en-US/docs/key-repositories/
4. OpenMRS 3.0 frontend framework (single-spa): https://openmrs.atlassian.net/wiki/display/projects/OpenMRS+3.0:+A+Frontend+Framework+that+enables+collaboration+and+better+User+Experience
5. OpenMRS Platform Release Notes 2.8.0 (2025-08): https://openmrs.atlassian.net/wiki/spaces/docs/pages/558891067/Platform+Release+Notes+2.8.0+2025-08
6. OpenMRS O3 Release Notes 3.6: https://openmrs.atlassian.net/wiki/spaces/docs/pages/557645825/Release+Notes+3.6+Goal+2025-11
7. openmrs-core repository and releases: https://github.com/openmrs/openmrs-core
8. openmrs-core NOTICE (MPL 2.0 with Healthcare Disclaimer): https://github.com/openmrs/openmrs-core/blob/master/NOTICE.md
9. OpenMRS FHIR2 module: https://github.com/openmrs/openmrs-module-fhir2
10. DPGA registry, OpenMRS: https://www.digitalpublicgoods.net/r/openmrs
11. METS Programme (UgandaEMR) GitHub: https://github.com/METS-Programme
12. Palladium Kenya GitHub: https://github.com/palladiumkenya
13. Bahmni Lite 2.0 release (OpenMRS Talk, 2026-10-05): https://talk.openmrs.org/t/bahmni-lite-2-0-release/50199
14. Bahmni Lite overview and releases: https://bahmni.atlassian.net/wiki/spaces/BAH/pages/3064332289 and https://bahmni.atlassian.net/wiki/spaces/BAH/pages/3110207489
15. Bahmni Security Patch, July 02 2026: https://bahmni.atlassian.net/wiki/spaces/BAH/pages/5519474693/Bahmni+Security+Patch+July+02+2026+Release+Notes
16. Bahmni 2025 roadmap inputs: https://talk.openmrs.org/t/need-your-inputs-for-bahmni-2025-roadmap/44736
17. Bahmni website: https://www.bahmni.org/
18. Bahmni apps repository (MPL-2.0 LICENSE): https://github.com/Bahmni/openmrs-module-bahmniapps
19. Ozone HIS repository: https://github.com/ozone-his/ozone
20. OpenEMR 7.0.3 release: https://community.open-emr.org/t/openemr-7-0-3-has-just-been-released/25137
21. OpenEMR 8.0.0 release: https://community.open-emr.org/t/openemr-8-0-0-has-just-been-released/26552
22. OpenEMR QA and Release Process: https://www.open-emr.org/wiki/index.php/QA_and_Release_Process
23. OpenEMR Features: https://www.open-emr.org/wiki/index.php/OpenEMR_Features
24. OpenEMR repository: https://github.com/openemr/openemr
25. GNU Health HIS 5.0 announcement (info-gnu): https://www.mail-archive.com/info-gnu@gnu.org/msg03426.html
26. GNU Health changelog: https://docs.gnuhealth.org/his/changelog.html
27. gnuhealth on PyPI: https://pypi.org/project/gnuhealth/
28. GNU Health website: https://www.gnuhealth.org/
29. GNU Health HIS on Codeberg: https://codeberg.org/gnuhealth/his
30. "Open Source Electronic Health Record Alliance to Shut Down" (HC Innovation Group): https://www.hcinnovationgroup.com/clinical-it/electronic-health-record-electronic-medical-record-ehr-emr/news/21124994/open-source-electronic-health-record-alliance-to-shut-down
31. Logica Health, OSEHRA Archive: https://www.logicahealth.org/osehra-archive/
32. WorldVistA/VistA repository: https://github.com/WorldVistA/VistA
33. ViViaN (WorldVistA): https://vivian.worldvista.org/
34. VA to restart Oracle EHR rollout with 2026 go-lives (ExecutiveGov): https://www.executivegov.com/articles/va-ehr-launch-oracle-cerner-13-sites
35. VA seeks to extend Oracle EHR contract through 2031 (Nextgov, Aug 2026): https://www.nextgov.com/modernization/2026/08/va-seeks-extend-its-oracle-health-record-contract-through-2031/415380/
36. Open Hospital repository: https://github.com/informatici/openhospital
37. HospitalRun GitHub organization (closure notice): https://github.com/hospitalrun
38. HospitalRun Open Collective: https://opencollective.com/hospitalrun
39. CARE Core (OHC): https://ohc.network/product/care-core
40. CARE documentation: https://docs.ohc.network/
41. CARE backend repository: https://github.com/ohcnetwork/care
42. Marley Health repository: https://github.com/earthians/marley
43. OCA vertical-medical: https://github.com/OCA/vertical-medical
44. OpenSRP FHIR Core: https://github.com/opensrp/fhircore
45. Tamanu repository: https://github.com/beyondessential/tamanu
46. Community Health Toolkit: https://github.com/medic/cht-core
47. OpenELIS Global website: https://openelis-global.org/
48. OpenELIS Global 2 repository: https://github.com/DIGI-UW/OpenELIS-Global-2
49. SENAITE website: https://www.senaite.com/
50. Orthanc website: https://www.orthanc-server.com/
51. Orthanc Book, licensing FAQ: https://orthanc.uclouvain.be/book/faq/licensing.html
52. dcm4chee-arc-light repository: https://github.com/dcm4che/dcm4chee-arc-light
53. OHIF website: https://ohif.org/
54. Weasis repository: https://github.com/nroduit/Weasis
55. OpenCR (IntraHealth client registry): https://github.com/intrahealth/client-registry
56. SanteDB server: https://github.com/santedb/santedb-server
57. JeMPI: https://github.com/jembi/JeMPI
58. OpenHIM website: http://openhim.org/
59. Jembi OpenHIM Platform: https://github.com/jembi/platform
60. Instant OpenHIE v2 docs: https://jembi.gitbook.io/instant-v2
61. OpenFn documentation: https://docs.openfn.org/documentation
62. OpenFn Lightning repository: https://github.com/OpenFn/lightning
63. NextGen, "A New Era for Mirth Connect" (2025-03-19): https://www.nextgen.com/blog/industry-news/a-new-era-for-mirth-connect-by-nextgen-healthcare
64. Eclipse Open Integration Engine website: https://openintegrationengine.org/
65. Open Integration Engine repository: https://github.com/OpenIntegrationEngine/engine
66. Saga IT, Mirth Connect alternatives 2026 (BridgeLink, version naming): https://saga-it.com/blog/mirth-connect-alternatives
67. Apache NiFi: https://github.com/apache/nifi
68. Open Concept Lab: https://openconceptlab.org/
69. OCL pricing (subscriptions from 2026-11-01): https://openconceptlab.org/pricing/
70. Snowstorm repository: https://github.com/IHTSDO/snowstorm
71. HAPI FHIR: https://github.com/hapifhir/hapi-fhir
72. HAPI FHIR JPA Server Starter: https://github.com/hapifhir/hapi-fhir-jpaserver-starter
73. Microsoft FHIR Server: https://github.com/microsoft/fhir-server
74. Microsoft Learn, migration strategies from Azure API for FHIR: https://learn.microsoft.com/en-us/azure/healthcare-apis/fhir/migration-strategies
75. LinuxForHealth FHIR: https://github.com/LinuxForHealth/FHIR
76. Blaze FHIR server: https://github.com/samply/blaze
77. DHIS2 About: https://dhis2.org/about/
78. iHRIS repository: https://github.com/iHRIS/iHRIS
79. OpenLMIS reference distribution: https://github.com/OpenLMIS/openlmis-ref-distro
80. Synthea v4.0.0 release: https://github.com/synthetichealth/synthea/releases/tag/v4.0.0
81. fhir-data-pipes (OHS Foundation): https://github.com/ohs-foundation/fhir-data-pipes
82. Medplum pricing: https://www.medplum.com/pricing
83. Medplum ONC certification disclosure: https://www.medplum.com/docs/compliance/onc
84. Medplum self-hosting server config: https://www.medplum.com/docs/self-hosting/server-config
85. Medplum documentation home: https://www.medplum.com/docs
86. Medplum blog, MediMind case study (Aug 2026): https://www.medplum.com/blog/medimind-case-study
87. Medplum blog, DICOM and DICOMweb beta (Aug 2026): https://www.medplum.com/blog/dicom-beta
88. Medplum blog, Awell Panels case study (Sep 2026): https://www.medplum.com/blog/awell-panels-case-study
89. Medplum repository: https://github.com/medplum/medplum
90. Aidbox licensing and support: https://www.health-samurai.io/docs/aidbox/overview/licensing-and-support
91. Aidbox May 2025 release / migration timeline: https://www.health-samurai.io/news/aidbox-may-2025-release-mcp-launch-important-migration-timeline
92. Health Samurai, Aidbox FHIR server page: https://www.health-samurai.io/fhir-server
93. CapMinds, Medplum vs Aidbox (third-party pricing): https://www.capminds.com/blog/medplum-vs-aidbox-which-fhir-platform-fits-digital-health-product-development/
94. Smile Digital Health: https://www.smiledigitalhealth.com/
95. Google Cloud Healthcare API, FHIR concepts: https://docs.cloud.google.com/healthcare-api/docs/concepts/fhir
96. AWS HealthLake: https://aws.amazon.com/healthlake/
97. Canvas SDK documentation: https://docs.canvasmedical.com/sdk/
98. Canvas Medical: https://www.canvasmedical.com/
99. Oystehr: https://www.oystehr.com/
100. Ottehr repository and LICENSE: https://github.com/masslight/ottehr
101. Metriport repository and LICENSE: https://github.com/metriport/metriport
102. Healthie API: https://www.gethealthie.com/api
103. Elation API docs (moved notice): https://docs.elationhealth.com/reference/introduction
104. Particle Health: https://www.particlehealth.com/
105. EHRbase releases: https://github.com/ehrbase/ehrbase/releases
106. ICT&health, "EHRbase reaches 400 users in five months" (2025-05-15): https://www.icthealth.org/news/ehrbase-reaches-400-users-in-five-months
107. openEHR Developer Guide, Clinical Data Repositories: https://developer.openehr.org/tooling/clinical-data-repositories/
108. openEHR.org, "An open health platform is not only openEHR: it's open source at the core": https://openehr.org/an-open-health-platform-is-not-only-openehr-its-open-source-at-the-core/
109. Better Platform: https://www.better.care/better-platform/
110. Digital Health, "Better to deliver clinical data repository for Wales" (2021): https://www.digitalhealth.net/2021/07/better-to-deliver-clinical-data-repository-for-wales/
111. HiGHmed, openEHR worldwide: https://www.highmed.org/en/worldwide-openehr
112. Kohler S., Meyer-Eschenbach F., Michelena X., Frey N., Marschollek M., Eils R., "Global Adoption of openEHR Clinical Data Repositories: A Vendor and Community Survey," medRxiv preprint, doi:10.64898/2026.08.27.26361529 (v1 2026-08-31, v2 2026-09-06; not peer-reviewed; abstract verified via [132], full text not retrievable): https://www.medrxiv.org/content/10.64898/2026.08.27.26361529v2.full.pdf
113. openEHR.org, Black Book Research openEHR 2025 opportunities: https://openehr.org/black-book-research-identifies-top-global-growth-opportunities-for-openehr-adoption-in-2025/
114. Inidus, "Who has adopted open platforms?": https://inidus.com/who-has-adopted-open-platforms/
115. JMIR 2023, "Can OpenEHR, ISO 13606, and HL7 FHIR Work Together?": https://www.jmir.org/2023/1/e48702
116. Kohler S. et al., "FHIRconnect: Towards a seamless integration of openEHR and FHIR" (arXiv:2511.14618, Nov 2025): https://arxiv.org/abs/2511.14618
117. "Archetype relational mapping: a practical openEHR persistence solution" (PMC): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4636072/
118. Purkayastha S. et al., "Comparison of Open-Source EHR Systems Based on Functional and User Performance Criteria," Healthc Inform Res 2019;25(2):89–98: https://e-hir.org/journal/view.php?doi=10.4258/hir.2019.25.2.89
119. Digital Public Goods Alliance registry (pages reviewed 2026-10-16): https://www.digitalpublicgoods.net/registry
120. Android FHIR SDK (OHS Foundation): https://github.com/ohs-foundation/android-fhir
121. OpenEMR 7.0.3 ONC certification requirements: https://www.open-emr.org/wiki/index.php/OpenEMR_7.0.3_ONC_Ambulatory_EHR_Certification_Requirements
122. Federal News Network, VA 2026 EHR plans (Dec 2025): https://federalnewsnetwork.com/veterans-affairs/2025/12/va-in-2026-looks-to-get-ehr-rollout-back-on-track-embark-on-health-care-reorganization/
123. OHIF Viewers repository: https://github.com/OHIF/Viewers
124. Live repository metrics, queried 2026-10-16: GitHub REST API (`https://api.github.com/repos/{owner}/{repo}`), GitHub release feeds (`https://github.com/{owner}/{repo}/releases.atom`), Codeberg API (`https://codeberg.org/api/v1/repos/gnuhealth/his`)
125. OCL API anonymous request response ("Anonymous API access is disabled"), 2026-10-16: https://api.openconceptlab.org/orgs/CIEL/sources/CIEL/versions/
126. Tamanu LICENSE-BSL (Business Source License 1.1): https://github.com/beyondessential/tamanu/blob/main/LICENSE-BSL
127. SMART Zambia Institute, "SmartCare Pro rollout reaches 80% of health facilities" (2026-07-09): https://www.szi.gov.zm/?p=7457
128. OpenEMR 8.0.0 ONC Ambulatory EHR Certification Requirements (certification number and date): https://www.open-emr.org/wiki/index.php/OpenEMR_8.0.0_ONC_Ambulatory_EHR_Certification_Requirements
129. Orthanc official source-download index (1.13.0 dated 2026-08-15; 1.12.11 dated 2026-04-14), accessed 2026-10-16: https://orthanc.uclouvain.be/downloads/sources/orthanc/index.html
130. Open Integration Engine v4.6.0 release notes ("remediates 24 known CVEs"; Java 17 minimum): https://github.com/OpenIntegrationEngine/engine/releases/tag/v4.6.0
131. Tamanu licence declarations in `package.json` (root: "GPL-3.0-and-later AND BUSL-1.1"; per-package fields under `packages/*/package.json`), accessed 2026-10-16: https://github.com/beyondessential/tamanu/blob/main/package.json
132. medRxiv/bioRxiv public API, preprint metadata and abstract for doi 10.64898/2026.08.27.26361529, accessed 2026-10-16: https://api.medrxiv.org/details/medrxiv/10.64898/2026.08.27.26361529
133. Pedrera-Jiménez M. et al., "Can OpenEHR, ISO 13606, and HL7 FHIR Work Together? An Agnostic Approach for the Selection and Application of Electronic Health Record Standards to the Next-Generation Health Data Spaces," J Med Internet Res 2023;25:e48702 (PMID 38153779; PMCID PMC10784985; Table 1 ratings read from PMC full text): https://pubmed.ncbi.nlm.nih.gov/38153779/
134. CMS, "CMS Interoperability and Prior Authorization Final Rule (CMS-0057-F)" fact sheet: https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
135. US Department of Veterans Affairs, EHR Deployment Schedule (page dated 15 Sep 2026; 2026 go-lives 11 Apr, 6 Jun, 22 Aug; Anchorage and Cleveland 24 Oct 2026), fetched 2026-10-16 during reconciliation: https://digital.va.gov/ehr-modernization/ehr-deployment-schedule/
136. Washington Technology, "VA deploys new EHR at 3 Indiana-based medical facilities" (24 Aug 2026; "11 hospitals in 2026"; three option-year periods and a $17B boost raise the contract to "just under $27 billion"), fetched 2026-10-16: https://www.washingtontechnology.com/contracts/2026/08/va-deploys-new-ehr-3-indiana-based-medical-facilities/415611/
137. HL7 FHIR R6 Ballot (2nd Full Ballot), 6.0.0-ballot5, ballot notes (ChargeItem, ChargeItemDefinition, Invoice, Contract, InsurancePlan, InventoryItem, InventoryReport, SupplyRequest, SupplyDelivery moved to incubator IGs), fetched 2026-10-16: https://hl7.org/fhir/6.0.0-ballot5/ballot-intro.html
138. Companion reports used in the 2026-10-16 reconciliation: `05-revenue-cycle-erp-operations.md` §9.1; `06-interoperability-standards.md` §7.1–7.2; `08-architecture-and-technology.md` §3.11, §4.6, §12.5; `11-canonical-domain-model.md` §0, §11; `RECONCILIATION-LOG.md`.

---

## Verification log (pass 2, 2026-10-16)

| Claim | Verdict | Source | Note |
|---|---|---|---|
| Azure API for FHIR retired on 2026-09-30; Azure Health Data Services is the successor | Confirmed | [74] | Microsoft Learn (updated 2026-10-05): "deprecated Azure API for FHIR on September 30, 2026". The FHIR Proxy and sync agent are also being deprecated. |
| Microsoft OSS FHIR Server: Cosmos DB provider support ends 2026-09-30; R4B ends 2026-07-01; MIT | Confirmed | [73] | README note; SQL provider and R4 remain supported. 5.1.2 released 2026-10-11 [124]. |
| NextGen made Mirth Connect proprietary from 4.6 (announced 2025-03-19); 4.5.2 is the last OSS version | Confirmed | [63] | Blog dated 2025-03-19: "single commercial and proprietary" licensing model from 4.6. |
| OIE v4.6.0 on 2026-07-09; Eclipse incubation on 2026-09-07 | Confirmed | [64][124][130] | Release notes: Java 17 minimum, 24 CVEs remediated. |
| "OIE's 24 CVE fixes" cited to Saga IT [66]; "commercial Mirth 4.6 vs OIE 4.6.0" name collision [66] | Corrected | [66][130] | The 24 CVEs come from OIE's own release notes [130], not Saga. Saga's collision is OIE 4.6.0 vs "OpenShare Engine 4.6.0-7". Saga also says commercial Mirth is on 4.7.x, and three Sep 2026 CVE fixes were merged in OIE but not yet released. |
| Medplum ONC certified 2025-12-31, CHPL 15.04.04.3147.Medp.05.03.1.251231 | Confirmed | [83] | Product listed as "Medplum, 5". |
| Medplum certified criteria include "(d)(1)–(13)" | Corrected | [83] | Actually (d)(1)–(7), (d)(9), (d)(12), (d)(13). (d)(8), (d)(10) and (d)(11) are not listed, and neither is (a)(9). |
| Medplum pricing: Production $2,000/mo; Premium $6,000/mo "adds bots…" | Corrected | [82] | Prices confirmed. Bots are already in Production; Premium adds sent emails, diagnostics/lab/medication integrations, more domains and access policies. |
| Medplum "used at inpatient scale (180+ inpatient facilities via Awell)" | Corrected | [88] | Awell Panels is a post-discharge follow-up worklist for an unnamed national post-acute provider (180 facilities, ~250k discharges/yr, ~500 weekly users). It is not an inpatient EHR. |
| MediMind: 25-hospital network; quote "FHIR R4 as the operational data model, not a translation layer" | Corrected | [86] | The network is "under contract" with "the first modules live in production". The exact quote is "FHIR R4 became our operational data model, not an interoperability layer bolted to the edge of the system". 1.1M patients, 3.1M visits and 3.7M observations confirmed. |
| Medplum DICOMweb beta (Aug 2026): /dicomweb, Agent C-STORE SCP, OHIF, no Patient linking | Confirmed (minor rewording) | [87] | Blog dated 2026-08-07. C-MOVE is mentioned only as a possible need, not as a listed gap. |
| OCL paid subscriptions from 2026-11-01; premium features include the FHIR terminology service and MCP server; anonymous API disabled | Confirmed | [69][125] | Added: Pro $20/mo, Team $79/mo, grace period to 2026-12-01. The anonymous API was re-tested and is still disabled. |
| DHIS2: system of record in 80+ LMIC governments, 100+ countries; Shared Services Fee from 2026; BSD-3 | Confirmed | [77] | "From 2026, a new model for collective support"; the page gives no month or fee amount. |
| OpenEMR 8.0.0 released 2026-02-11; ONC cert 15.05.05.3115.OPEN.02.01.1.260130 dated 2026-01-30 | Confirmed | [21][22][128] | |
| OpenEMR 7.0 certification retired 2026-02-27 | Confirmed | [121] | "OpenEMR version 7.0 ONC certification retired on 2/27/2026". The citation now points to [121] rather than only [21][22]. |
| OpenEMR 8.2.0 / 8.3.0 / 8.4.0 / 8.4.1 dates | Confirmed | [124] | 2026-07-08, 2026-08-18, 2026-09-13 and 2026-09-20. |
| GNU Health HIS 5.0.0 released 2025-06-30; "largest release"; Tryton 7.0 LTS to end of 2028 | Corrected | [25][27] | Released 2025-06-29 (PyPI and info-gnu). The announcement says "major leap in functionality", not "largest release". The Tryton 7.0 support "until end of 2028" is confirmed. |
| OSEHRA closed 2020-02-14; ~1.5 TiB archive to Logica; VistA repos to WorldVistA | Confirmed | [31] | The HC Innovation Group article [30] returned 403. Confirmed via the Logica archive page. |
| VA: 13 Oracle EHR go-lives in 2026, completion "as early as 2031", ~$37B lifecycle cost, contract extension through 2031 | Confirmed (expanded) | [34][35] | Added: 8 facilities deployed by Aug 2026; the extension would run the contract to 2031-05-16 (it currently expires May 2028). |
| Orthanc: GPLv3+ core, AGPLv3+ plugins; dual licensing ended; 1.9.7 last eligible | Confirmed | [51] | 1.9.7 was released 2021-08-31. |
| Orthanc latest version (open question) | Confirmed (new) | [129] | 1.13.0 dated 2026-08-15. |
| JeMPI license (open question) | Confirmed (new) | [124] | MPL-2.0 per GitHub licence metadata. Last release 1.1.0 (2024-08-12), last push 2025-04-16. |
| Tamanu GPL vs BSL scope (open question) | Corrected / partly resolved | [126][131] | The root package.json declares "GPL-3.0-and-later AND BUSL-1.1". BSL also covers the central-server, shared and database packages; the others are GPL-only. The BSL file has no Change Date or Additional Use Grant. |
| HospitalRun archived in stages 2023–2025 | Confirmed (dated) | [37][124] | Org marked archived by an admin on 2025-10-15; the monorepo's last push was 2021-02-05. |
| OpenMRS: 8,000+ facilities, 70+ countries, ~15M records; 3.7.1 announced 2026-08-03 | Confirmed | [1][124] | 3.7.1 was tagged 2026-07-13, 3.6.0 on 2026-03-11 and 3.8.0-rc.2 on 2026-10-15. |
| openmrs-core 2.8.0 on 2025-08-15 (Java 21/24, Hibernate Search 6.2.4, storage service, ProviderRole); 2.8.10 on 2026-10-06 | Confirmed (partly) | [5][124] | The S3, Elasticsearch, Infinispan and Liquibase items were not visible in the fetched portion of the notes. |
| OpenMRS a DPG since 2023-01-13 (openmrs-core assessed) | Confirmed | [10] | |
| Bahmni Lite 2.0: React 19, core 2.5.14 → 2.6.15, MySQL 8.0, CIEL v2026-06-13, tag 2026-09-24, announced 2026-10-05 | Confirmed | [13][124] | The bahmni-docker 2.0.0-lite tag commit is dated 2026-09-24. bahmniapps LICENSE is MPL-2.0. |
| KenyaEMR 3.x hosting (unverified) | Still unverified | [124] | kenyaemr-esm-3.x, openmrs-config-kenyaemr and kenyahmis-releases now return 404. Search snippets suggest they were archived on 2026-02-11. |
| SmartCare Pro (Zambia) status (unverified) | Corrected / partly resolved | [127] | Government source (2026-07-09): about 80% of facilities nationwide. Stack and licence are still unknown. |
| medRxiv preprint (28 countries; NO 3/4, SE 19/21, FI 16/21; no binding regulation) | Confirmed | [132] | Abstract retrieved via the official medRxiv API. Kohler S. et al., v1 2026-08-31, v2 2026-09-06; not peer-reviewed. |
| Slovenia ~98% of population data in openEHR | Still unverified | [111] | The claim is unsourced on a HiGHmed promotional page. The preprint confirms an openEHR-based national system but gives no percentage. |
| Black Book: Slovenia has a national openEHR mandate; Catalonia 8M+ | Confirmed (as reported) | [113] | The article (2025-04-01) asserts a mandate without detail, which conflicts with the preprint. |
| FHIRconnect: 24 archetypes, 15 FHIR profiles, 7 domains, 65% reuse, openFHIR engine | Confirmed | [116] | arXiv:2511.14618, submitted 2025-11-18. |
| JMIR 2023: openEHR "Suitable" for persistence and querying; FHIR "Suitable" for exchange | Confirmed (characterisation refined) | [133] | Pedrera-Jiménez et al., 2023-12-28. This is an expert-panel viewpoint, and FHIR is rated "Limited" for persistence and querying. |
| Purkayastha 2019: OpenEMR 32/32, VistA 28, OpenMRS 12 full + 11 partial; OpenMRS better on user tasks | Confirmed | [118] | |
| Aidbox dev license: no PHI and a 5 GB cap; per-dataset production licensing | Corrected | [90] | No-PHI and per-dataset licensing are confirmed. The 5 GB cap is not stated on current licensing, product or price pages. |
| Aidbox Zen/Entity-Attribute engines stopped Aug 2025; Jul 2025 LTS keeps legacy support for 2 years | Confirmed | [91] | News dated 2025-06-01. |
| Aidbox pricing "pay-as-you-go", no rates published | Confirmed | [92] | Price page: Development free; Production pay-as-you-go; Enterprise custom. |
| Smile: 190+ implementations, 255k TPS (vendor claims); CMS-0057-F live 2027-01-01 | Confirmed | [94][134] | CMS: the API requirements apply from 2027-01-01 and the operational prior-auth provisions from 2026-01-01. |
| Google Cloud Healthcare API supports DSTU2, STU3, R4 | Confirmed | [95] | No R5 support is stated. |
| AWS HealthLake: FHIR R4, "AI-ready persistence layer", identity resolution, SQL, MCP server, CMS APIs | Confirmed | [96] | |
| Canvas: 2026 Best in KLAS (Ambulatory Specialty EHR) | Confirmed | [98] | Inferred from the award link and image on the home page. |
| OHIF: MIT; NCI ITCR funding 2023–28 | Confirmed | [53] | Also funded 2015–20. |
| OpenELIS: 1,000+ labs, 26+ countries, 18.7M+ patients; "FHIR-native"; MPL | Confirmed (project claim) | [47] | |
| EHRbase "sandbox passed 400 subscribers" | Corrected | [106] | The article says "more than 400 active subscribers" in five months and does not mention a sandbox. |
| HAPI FHIR "releases about monthly"; JPA starter "without security", MySQL deprecated, MCP | Corrected (cadence) / Confirmed | [71][72][124] | Minor releases are about quarterly (8.10.0 May, 8.12.0 Sep 2026), with patches in between. The README says "no security implementation" and "does not support MySQL as it is deprecated". |
| Ottehr custom license: attribution, Competing Product ban, AI-ingestion ban | Confirmed | [100] | The LICENSE also has a "reciprocal obligations" clause. |
| Metriport AGPL-3.0 with separately licensed Enterprise Edition (`pkgs/`) | Confirmed | [101] | |
| Instant OpenHIE v2 on Docker Swarm only | Confirmed | [60] | "Docker swarm is now the only supported target". |
| Synthea v4.0.0 (2026-03-05): US Core 7, JDK 17+ | Confirmed | [80][124] | Also adds JDK 25 support and drops JDK 11. |
| Release and activity facts for ~30 OSS repos (EHRbase 2.36.0, OpenELIS 3.2.3.0, dcm4chee 5.35.2, SanteDB v3.0.2118, Blaze 1.11.0, DHIS2 2.43.2, OpenLMIS 3.20.1, CHT 5.3.1, NiFi 2.12.0, Snowstorm 11.0.0 (Apache-2.0), LinuxForHealth 5.1.1, OpenCR 3.0.0, OpenHIM 8.5.0, iHRIS 5.1.0, SENAITE 2.6.0, Open Hospital 1.15.2, CARE V3.0, Marley 16.6.1, OCL 2.3.223, OpenFn 2.19.2, FHIR2 4.3.0, esm-core v11) | Confirmed | [124] | Re-queried via the GitHub API and release Atom feeds. Small date fix for CHT: 5.3.0 was 2026-08-31, not Sep–Oct. |
| Moscow EMIAS and Wales openEHR current scale | Still unverified | [110][114] | No 2025–26 primary source found. Search snippets mention a 2024 DHCW aim for a single national CDR by 2030 (not fetched). |
| Malawi and Rwanda OpenMRS-based national EMRs; Ozone FOSS vs Pro editions | Still unverified | — | The Ozone website does not describe its editions. |
