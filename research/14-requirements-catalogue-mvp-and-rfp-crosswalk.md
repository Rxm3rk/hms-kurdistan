# 14 — Master Requirements Catalogue, Reconciled MVP, RFP/KLAS Crosswalk and Competitive Feature Teardown

**Track:** Gap-filling synthesis: one backlog that engineering can plan against
**As of:** 16 October 2026
**Author role:** Senior health-IT research analyst
**Builds on:** `01-global-vendor-landscape.md` (doc 01), `02-open-source-and-platforms.md` (doc 02), `03-clinical-modules-and-workflows.md` (doc 03), `04-diagnostics-pharmacy-devices.md` (doc 04), `05-revenue-cycle-erp-operations.md` (doc 05), `06-interoperability-standards.md` (doc 06), `07-security-privacy-regulation.md` (doc 07), `08-architecture-and-technology.md` (doc 08), `09-ai-analytics-digital-front-door.md` (doc 09), `10-implementation-ux-lessons.md` (doc 10), `11-canonical-domain-model.md` (doc 11), and `GLOSSARY.md`. "Doc NN §x" refers to those files.

**Evidence tags.** `[n]` = numbered source fetched or searched in this session (list at the end). **[E]** = my estimate, with the basis shown. **[K]** = background knowledge I did not re-verify in this session. **[U]** = a search-result extract or vendor claim I could not open or corroborate. **‡** = a maturity-model criterion whose official text is behind a block (HIMSS returns HTTP 403 to automated access, as it did for doc 10).

**Research constraints.** I used all 12 shared WebSearch calls. Several vendor sites could not be reached: Balsam (TLS error), Aosta (DNS failure), the ezCaretech English site (404), oracle.com (403) and NIC eHospital (connection reset). Those cells are marked "?" or [U]. The Rajasthan iHMS 2.0 RFP (361 pages) was downloaded and text-extracted, and it is quoted directly.

---

## 1. Executive summary

1. **One backlog now replaces eleven MVP lists.** Appendix A holds **214 features** in 16 domains. **140 are MVP, 54 are P2 and 20 are P3.** Each has an ID, source documents, regulatory or accreditation driver, markets, dependencies, a build/integrate/partner decision, a regulated-module flag, a T-shirt size and a tag. A script confirmed that every dependency ID exists and that **no MVP feature depends on a P2/P3 feature**.
2. **The MVP is sized for a "minimum viable hospital".** The reference buyer is a **150–300-bed private multispecialty hospital in India or KSA** with an ED, OT, ICU, in-house lab and radiology, pharmacy, a blood storage centre, and a mix of insurance/TPA and cash billing (§2). The MVP is roughly **1,900 engineer-weeks of feature work [E]**. Of that, **17 features (≈180 engineer-weeks)** are market-gated, such as NPHIES, ABDM, NHCX and ZATCA.
3. **The biggest reversal is LIS and RIS.** Their cores become **native MVP**, not interface-only. Doc 03 put native LIS/RIS at P3, doc 04 put them in the MVP, and buyers settle it. Rajasthan's state tender puts Lab, Radiology, Blood Bank, Queue Management and Insurance Claims in its **first** implementation group [1]. Every Indian competitor we will meet lists native LIS/RIS [25][27][28]. Microbiology goes to P2 and anatomic pathology to P3.
4. **The other reconciliations:**
   - **Smart-pump interoperability** moves to P2, but the infusion data model ships in the MVP.
   - **Blood bank:** bedside transfusion verification and an interface are MVP. The native blood centre is P2 and runs on the regulated track. It is never sold in the US.
   - **NEWS2/PEWS/MEOWS** are MVP for IN/SA/AE only, built as a regulated module from intermittent, nurse-validated observations. Continuous or predictive alerting comes later via cleared partners.
   - **OPD queue, messaging, booking links, payment links and report download** are MVP. Kiosks and the full portal app are P2.
   - **OT core, anaesthesia record and ICU flowsheet with monitor feed** are MVP. Full AIMS is P2 and tele-ICU P3.
   - **ERP:** the MVP covers supply chain, pharmacy stores, procurement-lite and journal export. A native lite GL is P2, and HR/payroll is always integrated.
5. **There is now one availability table (§9.2).** It separates the **engineering SLO** (T0 99.99%, RPO 0 in-region, ≤5 min automated failover) from the **contractual SLA** (T0 99.95%, ≤15 min RTO, ≤72 h cyber-recovery). This resolves the doc 07/08/10 conflict. Public tenders can demand more, and Rajasthan's penalty-free uptime band starts at ≥99.999% [1].
6. **Indian public tenders are lowest-cost contests behind high eligibility walls.** Rajasthan iHMS 2.0 scored **70 marks on financial capability and experience and 30 on presentation and demo**, of which **only 5 were for AI/ML**. Bidders needed **≥70% in each section** before the **L1 (lowest NPV) bid** won [1]. Pass/fail gates included **average turnover ≥ ₹120 Cr** (≈US$14M [E]), ISO 9001, ISO 27001, ISO 20000-1 and **CMMI Level 3** [1]. A startup can only enter as the **IP-owner OEM behind a systems integrator (SI)**; the RFP explicitly allows "authorized representative" bids [1]. The tender was cancelled in January 2025 [2].
7. **Saudi tenders are won or lost at national-rail gates.** Black Book's 2026 study of 128 Saudi IT leaders found that 98% rate **NPHIES/SeHE interoperability** as critical or high, 98% say the same of regulatory agility, 97% of cybersecurity and supply-chain resilience, and 94% of in-country delivery capacity. Vendors without working Saudi integrations and local teams "may be eliminated despite strong global product credentials" [5]. KLAS records MoH greenfield cluster awards to Cloud Solutions (3 clusters), IQVIA (3), ALERT (1) and Ohum (1) between 2018 and 2022 [3].
8. **The NHS now buys against a published capability baseline.** The **Digital Capabilities Framework** (formerly Minimum Digital Foundations) has 100+ Core requirements, roughly equivalent to **HIMSS EMRAM Stage 5**, and is assessed via DTAC [11]. Typical NHS award weights are **quality 60 / price 30 / social value 10** [13][14]. Australian buyers want a "mature, tested and proven" single-configuration EMR+PAS that integrates about 220 legacy applications [19]. VGR is moving to a modular estate after paying a **SEK 657M** exit fee [17].
9. **KLAS scores are only partly about product.** The overall score averages **20 equally weighted questions** across six pillars (Culture, Loyalty, Operations, Product, Relationship, Value) [9][10]. At least 9 of the 20 are about promises, implementation, training, support and value. The catalogue therefore treats implementation tooling (IMP-*) as product, and §7.1 maps each pillar to features.
10. **The teardown shows two kinds of competitor.**
    - **Breadth-first local suites** (KareXpert, Insta, Akhil, Athma, ATS CareWare, IQVIA HIS) win on module checklists, national rails and price.
    - **Depth-first platforms** (Epic, Oracle, InterSystems) win on closed-loop safety, references and AI. Their weaknesses in our segment are price, localization and regional billing [3].
    - **Nobody combines the two** at the US$1.5–6K-per-bed-per-year price band [E, doc 01 §12.3]. The modern entrants (Avelios, MediMind, Commure, Canvas) show that AI-native and FHIR-native builds can reach hospital scale fast [29][35].
11. **What wins RFPs in our segment, in rough order:**
    1. Live national-rail integrations at a reference site (NPHIES, ABDM M1–M3, NHCX/TPA, Malaffi/NABIDH)
    2. Module-checklist coverage
    3. Price per bed
    4. Scripted demo performance
    5. In-country hosting and team
    6. Certifications (ISO 27001, CMMI L3, NABH HIS/EMR, CERT-In "Safe to Host")
    7. Implementation and adoption services
    8. AI, which is a tiebreaker, not a gate (§8.4)
12. **The maturity models double as acceptance tests.**
    - **Leapfrog CPOE** (≥85% of orders; ≥60% on the test) and **BCMA** (95% scanning; 100% unit coverage) [44][45]
    - **EMRAM Stage 6**: closed-loop medication, blood and milk, device integration and external data ‡ [41][42]
    - **China EMR Level 6** (closed loop) [46]
    - **NABH HIS/EMR "Advanced" certification**: KareXpert's listing shows 151 HIS and 164 EMR objective elements [23]

    All map to specific feature IDs in §7.
13. **The release train has eight quarterly increments over 24 months (§10).** The first India go-live is at **M12** and the first KSA go-live at **M15**. UAE and the first depth wave (pumps, AIMS, maternity, portal) come at **M16–18**, the native blood centre and on-prem/state data-centre installs at **M19–21**, and EMRAM Stage 6 readiness at **M22–24**.

---

## 2. The "minimum viable hospital" (MVH) reference profile

The MVP is defined against one buyer. If this buyer cannot sign and go live, the feature is MVP. Otherwise it is not.

| Attribute | MVH-200 reference (India or KSA) | Basis |
|---|---|---|
| Size | 150–300 beds (design point 200): about 150 ward beds, 20 adult ICU/CCU, 8–10 NICU/PICU, 15–20 ED bays, 6–8 OTs, 10 day-care beds | Doc 01 §12.1 segment (50–800 beds); [E] |
| Outpatients | India 800–1,500 OPD visits/day; KSA 500–1,000/day | [E] |
| Ancillaries | In-house clinical pathology (biochemistry, haematology, serology, microbiology); histopathology outsourced; X-ray/CT/MRI/USG; IP and retail OP pharmacy; blood storage unit or small blood centre; 6–10 dialysis chairs; physio; dietary; CSSD | [E]; Rajasthan scope [1] |
| Payer mix | India: cash 35–50%, TPA/insurer cashless 30–45%, PM-JAY/state/CGHS/ECHS 10–25%. KSA: private insurance via NPHIES 55–70%, cash 15–30%, government and corporate 10–20% | [E]; doc 05 §2.2 |
| Accreditation | India: NABH 6th ed. (and increasingly NABH-certified HIS/EMR [23][24]). KSA: CBAHI mandatory, JCI aspirational. UAE: DoH/DHA licensing and HIE connection | Doc 07 §7; doc 06 §4.6 |
| Users | 1,000–1,400 staff; 350–500 peak concurrent sessions | [E] from about 6 staff per bed with shift overlap |
| Incumbent | A local HIS (often on-prem, 10+ years old), paper MAR, analyzer interfaces via vendor middleware, standalone PACS | [E]; doc 01 §5.5 |
| Buying centre | Promoter/CEO, CFO, medical director, nursing director, IT head. Decision takes 3–9 months, with reference visits and a scripted demo | [E] |
| Go-live expectation | One big-bang core go-live 6–9 months after contract; revenue capture back to baseline within 2–4 weeks | Doc 01 §12.3; doc 10 §10.2 |

**What this buyer needs to sign.** Derived from §6 and §8.4:
1. Module coverage equivalent to Rajasthan "Group-2" [1]: OPD, appointments, queue, emergency, IPD/ADT/ward, doctor and nursing desks, lab, pharmacy, radiology, blood bank, CPOE, EMR, inventory, billing, insurance claims, MRD, birth/death registration, MIS and patient web/mobile.
2. National rails working **at a live site**.
3. In-country hosting and support.
4. ISO 27001 plus the market security audit.
5. A price inside the per-bed band.
6. A credible migration and adoption plan.

**What they need to go live.** The doc 10 readiness gates (training ≥95%, proficiency ≥85%, zero open Sev-1, performance SLOs met in dress rehearsal, downtime drill passed), plus analyzers and PACS connected, charge master and payer contracts loaded, and production credentials for NPHIES or NHCX/TPA.

---

## 3. Catalogue structure and conventions

**Hierarchy.** Each feature sits in a domain and an epic. Feature IDs take the form `DOMAIN-EPIC-NN` (for example `MED-BCM-01`). The 16 domains are:

| Code | Domain |
|---|---|
| PLT | Platform/NFR |
| TRU | Trust plane/security/downtime |
| ACC | Patient access |
| CLN | Clinical core |
| NUR | Nursing |
| MED | Medication |
| DX | Diagnostics |
| DEV | Devices |
| SPC | Specialty |
| RCM | Revenue |
| ERP | ERP |
| OPS | Operations |
| INT | Interoperability |
| AI | AI and data |
| DFD | Front door |
| IMP | Implementation tooling and telemetry |

**Columns** (CSV in Appendix A):

| Column | Meaning |
|---|---|
| `src` | Source document numbers; "14" means this report |
| `driver` | Regulatory or accreditation driver. NPG EP numbers come from docs 03 and 04. NABH chapter codes (AAC, COP, MOM, HIC, PSQ, IMS, HRM, FMS) and JCI chapter codes (IPSG, ACC, COP, ASC, MMU, PCI, QPS, MOI, SQE, FMS) are [K]. "RFP" means the requirement was seen in tenders (§6). |
| `mkt` | ALL, or a list of IN/SA/AE/EU/US |
| `deps` | Prerequisite feature IDs |
| `decision` | B = build; I = integrate a third party; P = partner or license (content or AI); B+I or B+P = hybrid |
| `reg` | Y = regulated-module track (ISO 13485/IEC 62304/ISO 14971, doc 07 §9.1 #7); C = conditional on market or configuration; N = not a device function |
| `size` | S ≤4, M 4–12, L 12–30, XL 30–80 engineer-weeks [E]. Midpoints of 3, 8, 20 and 50 are used for totals. |
| `tag` | MVP = needed for the MVH to sign and go live (a market-gated MVP item is required only in its listed market); P2 = months 13–24; P3 = after month 24 or opportunistic |

**Distribution** (computed from Appendix A):

| Domain | MVP | P2 | P3 | MVP effort (eng-weeks) [E] |
|---|---|---|---|---|
| Platform | 19 | 2 | 1 | 344 |
| Trust | 15 | 3 | 0 | 199 |
| Access | 9 | 3 | 0 | 103 |
| Clinical | 23 | 7 | 0 | 266 |
| Nursing | 4 | 0 | 1 | 39 |
| Medication | 8 | 4 | 1 | 112 |
| Diagnostics | 12 | 5 | 2 | 156 |
| Devices | 2 | 0 | 2 | 28 |
| Specialty | 8 | 7 | 3 | 61 |
| Revenue | 12 | 2 | 2 | 210 |
| ERP | 4 | 7 | 0 | 44 |
| Operations | 3 | 1 | 2 | 24 |
| Interop | 6 | 2 | 3 | 96 |
| AI & data | 5 | 5 | 2 | 64 |
| Front door | 4 | 3 | 1 | 32 |
| Implementation | 6 | 3 | 0 | 97 |
| **Total** | **140** | **54** | **20** | **≈1,875** |

**What the totals imply.**
- **Team size.** About 1,875 engineer-weeks delivered over roughly 48 build weeks implies **≈40 feature engineers**, plus ≈25% for QA, SRE and design, and a 10–15-person clinical-content team for IMP-FND-01 [E].
- **Decisions.** 126 of the MVP features are pure build. Two are partner (the drug knowledge base and the ambient scribe), two are integrate (PACS and the blood-bank interface), and ten are hybrid.
- **Regulated scope.** Only two MVP items are fully regulated: the QMS track itself (TRU-REG-01) and EWS (CLN-CDS-05). Four are conditional: the rules engine, drug checking, lab autoverification and bedside transfusion.

---

## 4. Cross-document conflict reconciliation

| # | Topic | Conflicting positions | **Decision** | Rationale | IDs |
|---|---|---|---|---|---|
| 1 | **LIS/RIS native vs interface** | Doc 03 §2: MVP = interface, native at P3. Doc 04 §8.2/§11: build the LIS and RIS cores in the MVP sequence. Doc 02 §9: build core lab, reuse PACS. | **MVP: native LIS core** (phlebotomy, labels, accessioning, analyzer connectivity, validation, autoverification v1, QC, send-outs) **and native RIS core** (orders, scheduling, MWL broker, templates, actionable findings). An interface mode stays for sites keeping a specialist LIS. **P2:** microbiology, POCT, dose. **P3:** anatomic pathology, ISO 15189 document control. **PACS:** always integrate, with an OSS PACS tier bundled. | Rajasthan puts lab, radiology and blood bank in its first implementation group [1]. Indian competitors all list native LIS/RIS [25][27][28]. EMRAM Stage 1 counts LIS/RIS/pharmacy as the base ‡ [41]. Lab and imaging are major revenue lines, and the shared order lifecycle (DX-ORD-01) is needed regardless. | DX-LAB-01..05, DX-RIS-01/02, DX-PAC-01 |
| 2 | **Smart pumps** | Doc 03 §21.1: P2 fast-follow. Doc 04 §11 #15: MVP via one vendor. | **P2 (MED-INF-02, months 16–18).** The MVP ships the infusion data model, pump-channel association and manual rate/volume validation (MED-INF-01). | Autoprogramming was used for only 53.4% of infusions even where available (doc 04 §0). The integration depends on a pump vendor's gateway and sits on a regulated boundary (doc 04 §11 #12). Leapfrog and ISMP targets are US frameworks that do not gate IN/SA purchases [E]. BCMA delivers most of the error reduction first (doc 03 §9.3). | MED-INF-01, MED-INF-02 |
| 3 | **Blood bank** | Doc 03: MVP bedside check plus interface. Doc 04: build natively outside the US, late in the sequence. Doc 07 §9.4: no BECS build in v1. | **MVP:** bedside transfusion verification (a BCMA extension), transfusion orders and consent, reaction capture, and an interface to e-RaktKosh or a third-party/cleared BECS. **P2:** native blood centre (non-US only) on the regulated track. **Never** a US BECS. | The harm sits at the bedside: wrong blood in tube is 63.8% of near misses (doc 04 §0). BECS is a Class II device in the US. India has a free national alternative (e-RaktKosh, doc 04 §8.2). Rajasthan still lists a blood bank module [1], so P2 keeps us competitive. | DX-BB-01/02/03, TRU-REG-01 |
| 4 | **EWS/sepsis** | Doc 03: NEWS2/PEWS plus sepsis rules in MVP CDS. Docs 07 and 09: integrate cleared products; FDA treats deterioration alerts from serial vitals as a device function [47]. Doc 08: isolate as potential SaMD. | **MVP (IN/SA/AE only):** NEWS2/PEWS/MEOWS calculated from nurse-validated intermittent observations, with components visible, protocol-driven observation frequency and escalation as tracked tasks. It is **built under TRU-REG-01** with a written regulatory memo by M3. There is no continuous-stream alarming. **P2:** a rule-based, non-interruptive sepsis screen, and predictive models via a cleared partner run in silent mode first. The feature is **disabled in US/EU builds** until cleared. | Accreditors require recognition of and response to deterioration (NPG.01.05.02; JCI and NABH COP [K]). Buyers in our markets expect it, and few "cleared" products exist there to integrate. The FDA position [47] and EU MDR Rule 11 (doc 07) make it a device in the US/EU, so we gate by market and run a QMS from day one. | CLN-CDS-05/06/07 |
| 5 | **OPD queue, kiosk and portal** | Doc 03 §2: queue and kiosk P2, portal P2. Doc 05 §4.6: queue is core in high-volume OPDs. Doc 09 §7.9: many front-door features MVP. | **MVP:** token/queue journey orchestration with display boards, SMS/WhatsApp reminders, booking links, payment links, report download and national PHR push, plus ABDM Scan-and-Share registration in India. **P2:** kiosks, full portal app, teleconsultation, CRM. **P3:** RPM and hospital-at-home. | OPD throughput and queues decide the buyer experience at 800–1,500 visits/day (doc 05 §4.6). Rajasthan lists Queue Management in Group-2 [1]. Doc 09 warns against forcing a proprietary app where WhatsApp and national apps dominate. | ACC-OPD-01/02/03, DFD-* |
| 6 | **OR, AIMS and ICU** | Doc 03: perioperative and AIMS P2, ICU P2 with a "vitals feed MVP-lite". Doc 04: MDI vitals in the MVP sequence. | **MVP:** OT booking, WHO checklist, intra-op nursing record with implant and consumable charging, op note, anaesthesia pre-assessment and intra-op/PACU record (manual or semi-automatic vitals), and an ICU q1h flowsheet with monitor feed via middleware plus nurse validation. **P2:** full AIMS with machine feed, OR analytics, severity scores, NICU. **P3:** tele-ICU. | The MVH has 6–8 OTs and a 20-bed ICU. OT charging (implants and consumables) is revenue-critical, and NABH/JCI assess surgical safety and anaesthesia (ASC/COP [K]). Device-fed AIMS is complex and depends on hardware. | SPC-OT-*, SPC-AN-*, SPC-ICU-*, DEV-GW-01 |
| 7 | **ERP depth** | Doc 01 §12.2: a natively joined ERP is the differentiator. Doc 05 §9.1: native sub-ledger and supply chain, lite GL for emerging markets, integrate in mature markets. Doc 02 §9: integrate general ERP via API. | **MVP:** item master, stores, FEFO, indents, consumption-to-charge, procurement-lite, AP/AR and GL journal export (Tally/Zoho/SAP B1/Odoo/Dynamics), staff master and privileges. **P2:** native lite GL and fixed assets, biomedical CMMS, rostering, enterprise ERP connectors, UDI/consignment, support services. HR/payroll is **always integrated**. **P3:** patient-level costing. | The clinical-supply-to-charge loop is where integrated EHR+ERP beats bolt-ons (doc 05 §9.1). GL and payroll are statutory and country-specific, and mid-size buyers already run Tally, Zoho or SAP B1 [K]. Rajasthan puts procurement and asset management in Group-3 [1]. | ERP-* |
| 8 | **Availability, RTO and RPO** | Doc 07 §6.2: T0 99.99%, RTO ≤15 min, RPO ≤1 min, cyber ≤72 h. Doc 08 §12.6: core 99.95% (reads 99.99%), RPO 0 / RTO ≤5 min, ransomware ≤24 h. Doc 10: 99.95% [E]. Rajasthan: penalty-free band at ≥99.999% [1]. | **A single table (§9.2)** separating the **engineering SLO** (the stricter figure) from the **contractual SLA** (the safer figure). | Engineering targets should be ambitious. Contracts should promise what single-writer Postgres plus continuity copies can prove under audit (doc 08 §6.4). | PLT-OPS-04, TRU-BCP-* |
| 9 | **"Microservices" in tenders** | Doc 08 §1: modular monolith core. Rajasthan mandates a "microservices architecture with messaging" and scores bidders' microservices projects [1]. | **Keep the modular monolith.** Package it as containerized modules plus satellite services on Kubernetes with Kafka messaging. Document the module boundaries as "services". | Splitting orders, meds and MAR across networked services weakens safety (doc 08 §1 #4). The RFP wording is satisfied by deployment topology and messaging. | PLT-CORE-04, PLT-OPS-01 |
| 10 | **FHIR store** | Doc 02 §10: embed Medplum or HAPI. Doc 08 §1: Postgres-native core, FHIR as external contract. | **Doc 08 wins for the transactional core.** Medplum or HAPI may back the façade or satellites (INT-FHIR-01 = B+I). | MediMind proves the FHIR-native approach at a 25-hospital network [35], but doc 11 shows that R6 is dropping finance and inventory resources. | INT-FHIR-01, PLT-CORE-01 |
| 11 | **AI scope at launch** | Doc 09 §9.2: P0 includes in-basket drafts and prior-auth packets. | **MVP:** AI gateway and control plane, multilingual OPD ambient (partner), discharge-summary drafts. In-basket AI is P3, because non-US message volumes are about a third of US volumes (doc 10 §1 #3). US prior auth is P3. | Spend AI effort where IN/SA clinicians spend time: OPD notes and discharge summaries. | AI-* |

---

## 5. MVP release definition

```yaml
release: MVP-1.0
reference_profile: MVH-200            # Section 2
scope_rule: "tag == MVP and (mkt == ALL or launch_market in mkt)"
feature_count: 140                    # incl. 17 market-gated
effort_estimate_eng_weeks: 1875       # [E] S=3, M=8, L=20, XL=50
launch_markets:
  - {market: IN, first_go_live: M12, gated: [ACC-OPD-02, INT-ABDM-01, RCM-NAT-02]}
  - {market: SA, first_go_live: M15, gated: [RCM-NAT-01, INT-SEHE-01]}
  - {market: AE, first_go_live: M18, gated: [RCM-NAT-03, INT-UAE-01]}   # MVP-gated, delivered in R5
regulated_in_mvp: [TRU-REG-01, CLN-CDS-05]            # plus conditional: PLT-CORE-06, CLN-CDS-02, DX-LAB-03, DX-BB-01
sign_gates:                           # what the buyer checks before contract
  - module checklist >= Rajasthan Group-2 equivalent
  - national rails live at a reference site (ABDM M1-M3 + NHCX/TPA; or NPHIES + ZATCA + SeHE)
  - in-country cell + local support team
  - ISO 27001 (+ SOC 2 Type II by M12); CERT-In Safe-to-Host (IN) / NCA ECC mapping (SA)
  - NABH HIS/EMR certification application filed (IN)
  - scripted demo: OPD->bill->pharmacy; IPD CPOE->verify->BCMA; lab analyzer->critical result; insurance pre-auth->claim
go_live_gates:                        # doc 10 readiness gates + this report
  - training >= 95% complete; proficiency >= 85%
  - zero open Sev-1; perf SLOs met in dress rehearsal (Section 9.1)
  - downtime drill passed (TRU-BCP-01..03)
  - top analyzers + PACS + monitors interfaced; HL7 queues owned and alarmed
  - foundation content >= 80% adopted (IMP-FND-01); charge master + payer contracts loaded
  - production credentials for NPHIES or NHCX/TPA; first claims round-trip tested
explicitly_excluded: [pump autoprogramming, native blood centre, full AIMS device feed, full portal app,
                      kiosks, microbiology, anatomic pathology, native GL, predictive sepsis, US/EU certification]
```

---

## 6. RFP and tender intelligence

### 6.1 Tender-by-tender evidence

| Buyer / tender | What it tells us | Source |
|---|---|---|
| **Rajasthan iHMS 2.0** (RISL; final RFP 9 Sep 2024; cancelled by office order uploaded 23 Jan 2025) | A statewide, single-platform HIS. **Group-1:** VNA-PACS, central CDR/FHIR, central MPI, readiness studies. **Group-2 (first wave):** 28 HIS modules including queue, lab, pharmacy, radiology, blood bank, CPOE, insurance claims, birth/death, patient portal/app. **Group-3:** procurement, OT, CSSD, diet, linen, assets, telemedicine/tele-ICU, quality, incident reporting. **Groups 4–5:** medical college and research systems. **Hosting:** Rajasthan State Data Centre. Hindi UI labels are required, and microservices are mandated. IP in customizations vests in the state. The contract runs 5 years (development plus 3 years of support). Aggregator listings value it at about ₹35–36.5 Cr [U]. | [1][2] |
| **Saudi MoH/HHC clusters** | 2018–22 greenfield cluster awards went to Cloud Solutions (3), IQVIA (3), ALERT (1) and Ohum (1). IQVIA customers praise local adaptation, but implementation and training were difficult and radiology was weaker. Epic is "not always localized" and its billing is not implemented in the region [3]. IQVIA is 2026 Best in KLAS ME/Africa [4]. Black Book's gates are listed in §1 [5]. In 2025 Oracle won two private ME multi-hospital groups [6], and Alrajhi bought EHR+ERP as one platform (doc 01 §4). | [3][4][5][6] |
| **UAE (SEHA/DoH, DHA)** | HIE connection is a licensing condition (Malaffi, NABIDH, Riayati). NABIDH requires HL7 v2/v3, CDA, FHIR and IHE PIX/PDQ/XDS/XCA/MHD (doc 06 §1). Claims run through Shafafiya/eClaimLink XML (doc 05). ADHICS sets the security baseline (doc 07). | Docs 05, 06, 07 |
| **NHS England** | The DCF has >100 Core requirements and is "broadly in line with EMRAM level 5". Solutions are assessed via DTAC. The EPR deadline was pushed to March 2026 [11][12]. Purchases are often framework call-offs: HPFT bought an EPR via the LPP Clinical Digital Solutions framework (£889K) [15], and Whittington extended System C by up to 5 years (≈£13.9M) [16]. Typical NHS weights are quality 60 / price 30 / social value 10, with social value usually ≥10% [13][14]. | [11]–[16] |
| **VGR (Sweden)** | The Millennium termination cost SEK 657M on top of SEK 3.8B spent. VGR continues its "modular healthcare information environment" strategy, and the national eHealth Agency was tasked with investigating EHR procurement problems [17][18]. | [17][18] |
| **Australia** | **WA Health EOI** (April 2025): a single-configuration statewide EMR+PAS that is "mature, tested and proven", with an established methodology and integration of about 220 legacy apps (90 definite). Integrators are invited [19]. The registration of interest closed 10 Dec 2025 [U][20]. **Tasmania:** Epic named preferred vendor (May 2025) within an A$476M strategy [U][21][22]. **NSW SDPR:** Epic, A$969M, phasing (doc 01 §5.7). Health NZ is pursuing shared records rather than a single-vendor EMR [U]. | [19]–[22] |

### 6.2 Scoring weights observed

| Regime | Technical/quality | Price | Other | Selection rule |
|---|---|---|---|---|
| Rajasthan iHMS 2.0 | 100 technical marks: 70 for financial capability and experience (turnover 15, years 10, govt project value 10, hospitals implemented 10, single eHealth project value 5, ABDM M1–M3 5, encounters/day 5, CMMI 5, microservices projects 5), and 30 for presentation and demo (presentation 15, functional demo 10, **AI/ML demo 5**) | NPV of the full financial bid (development, training, 3-year support, change-request man-months, adoption team, equipment-integration rates) | ≥70% required in **each** section | **L1 (least-cost) among technically qualified bidders** [1] |
| NHS (indicative) | 60 | 30 | Social value 10 | Most Advantageous Tender (Procurement Act 2023) [13][14] |
| KSA (Black Book buyer view) | Gates: NPHIES/SeHE, regulatory agility, cybersecurity, in-country delivery; then "five-year operating economics" | — | — | Elimination before award [5] |
| GCC/Asian private (typical) | Demo, references, EMRAM-stage references ‡ | Per-bed price | Implementation timeline | Negotiated [E]; doc 10 §7.3 |

### 6.3 Pass/fail gates seen repeatedly

1. **Corporate scale:** ₹120 Cr average turnover, positive net worth, prior government IT projects (1×₹30 Cr, 2×₹19 Cr or 3×₹15 Cr), ISO 9001/27001/20000-1 and CMMI L3+ [1]. The **OEM route is allowed**: the bidder must be the IP owner or its authorized representative with a manufacturer authorization form [1].
2. **National rails working before award:** NPHIES/SeHE [5]; ABDM M1–M3, certified by NHA [1].
3. **Security audit:** an annual CERT-In-style "Safe to Host" audit, with a ₹1 lakh/week penalty for a lapsed certificate [1]. Doc 07 §3.2 lists the enterprise security questionnaire (SOC 2/ISO, pen test ≤12 months, SBOM, MFA, SIEM export, tested RTO/RPO).
4. **Local presence:** an on-site central team plus an adoption team [1]; "local implementation resources" [5].
5. **Accessibility and clinical safety (UK):** VPAT/ACR, DTAC, DCB0129 (doc 07).

### 6.4 Reference-site and maturity requirements

- **Scored scale:** hospitals implemented (>100 hospitals earns full marks) and encounters per day (>100,000/day earns full marks) [1]. A greenfield vendor scores near zero on 25 of 70 marks. **Win private references first; enter public tenders through an SI with our IP from about M19** (§10).
- **EMRAM:** NHS DCF ≈ Stage 5 [11]. GCC and Asian tenders ask for Stage 6/7 reference sites or contractual support to reach them ‡ (doc 10 §7.3). Malaysia's IJN was reported as the country's first Stage 7 hospital in March 2026 [U][43], which shows that Stage 7 still sells in the region.
- **NABH:** the HIS/EMR certification has an "Advanced" level and an objective-element (OE) count. KareXpert's listing shows 142/151 OEs met for HIS and 150/164 for EMR, plus a WASA web-application security certificate [23].

### 6.5 Implementation and SLA clauses (normalized)

| Clause | Rajasthan value [1] | Our default |
|---|---|---|
| Phasing | Group-1 at T0+180 d, Group-2 at T1+180 d, Group-3 at T2+180 d | Core big-bang plus 2 waves (§10) |
| Payment | 1% after knowledge transfer, 13% at T1, 14% each at T2/T3/T4 (share of development cost); training and support paid as actuals or quarterly | Milestones tied to readiness gates, not dates (doc 10 §10.2) |
| Application uptime | Graduated penalties; the penalty-free band appears to start at ≥99.999%, with bands down to 99% (table extraction imperfect) | Bid against the §9.2 SLA, with exclusions for customer power and network (the RFP itself excludes power outages) |
| API response | Average ≤3 s/month penalty-free; graduated to ≥13 s | Our p95 budgets are about 3–10× tighter (§9.1) |
| Helpdesk | Sev-1 response ≤30 min, resolution ≤15 min (as printed); Sev-2 ≤1 h/≤1 h; Sev-3 ≤2 h/≤6 h; call loss ≤1% | Sev-1 response ≤15 min, workaround ≤4 h [E] |
| Penalty rates | 0.25–2.5% of the payable amount per breach; capped at 5% of contract value | Accept a 5% cap; refuse uncapped penalties |
| Training | ≥95% of sessions on schedule; ≥75% of participants rating ≥3/5; Hindi voice-over material | IMP-TRN-01 telemetry provides the evidence |
| IP and exit | Customization IP vests in the state; exit-management schedule | Core IP retained. Configuration and content are customer-owned. Source escrow offered. |

### 6.6 Normalized requirement → feature map (most frequent RFP lines)

| Normalized requirement | Typical wording or threshold | Feature IDs |
|---|---|---|
| National ID and health ID | ABHA creation/verification; Nafath/Absher; Emirates ID | ACC-ID-02, INT-ABDM-01 |
| National claims | NPHIES certified; NHCX/TPA; Shafafiya/eClaimLink | RCM-NAT-01/02/03 |
| HIE connection | SeHE; Malaffi/NABIDH/Riayati; ABDM HIP/HIU | INT-SEHE-01, INT-UAE-01, INT-ABDM-01 |
| Standards list | HL7 v2, FHIR R4, DICOM, SNOMED CT, LOINC, ICD-10 | INT-ENG-01, INT-FHIR-01, PLT-CORE-05 |
| Lab and imaging equipment interfacing | ASTM/HL7, uni/bi-directional; equipment list survey | DX-LAB-02, DX-PAC-01 |
| Queue and OPD | Token, display, SMS | ACC-OPD-01, DFD-MSG-01 |
| Insurance claim generation | Pre-auth, claim, rejection management | RCM-INS-01, RCM-DEN-01 |
| Birth and death registration | Statutory forms | SPC-MAT-01, SPC-DTH-01 |
| MIS and dashboards | Per module | OPS-MIS-01, AI-DAT-01 |
| Mobile app (patient and staff) | Android/iOS | PLT-UX-04, DFD-* |
| Security audit and hosting | Safe to Host; state DC / in-country cloud | TRU-SEC-03, PLT-OPS-01/02 |
| Uptime and DR | 99.5–99.999% bands; DC-DR | PLT-OPS-04, §9.2 |
| Training and adoption | ToT; e-learning; feedback | IMP-TRN-01, IMP-TEL-01 |
| Data migration | From the legacy HIS/EHR portal | IMP-MIG-01 |
| AI/ML innovation | Demo marks | AI-AMB-01, AI-DCS-01 |
| Incident reporting and quality | NABH/JCI QPS | CLN-INC-01, CLN-QI-01 |

---

## 7. Evaluation-criteria crosswalk

### 7.1 KLAS performance pillars → features

KLAS software scores average **16 numeric and 4 yes/no questions, equally weighted**, over a 13-month window [10]. The pillar indicator list below comes from a vendor's summary of KLAS's 2026 report [9][U].

| Pillar | Indicators [9] | What we build or commit |
|---|---|---|
| Culture | Keeps all promises; proactive service; product works as promoted | Public roadmap and release notes; PLT-OPS-07 (zero-downtime releases); IMP-SUP-01 (status page) |
| Loyalty | Forecasted satisfaction; likely to recommend; overall satisfaction; part of long-term plans; would buy again | Evergreen single code base with no "new EHR" discontinuity (the Oracle lesson, doc 01 §10.2); data portability |
| Operations | Ease of use; quality of implementation; quality of training | PLT-UX-01; IMP-FND-01; IMP-RDY-01; IMP-TRN-01 |
| Product | Delivery of new technology; overall quality; needed functionality; supports integration goals | Catalogue completeness; AI-*; INT-*; PLT-OPS-06 performance gate |
| Relationship | Executive involvement; quality of phone/web support | Named executive sponsor per account; IMP-SUP-01 |
| Value | Avoids charging for every little thing; drives tangible outcomes; worth the money | No fee for basic FHIR APIs (doc 01 §12.3); IMP-TEL-01 outcome telemetry; OPS-MIS-01 |

**Arch Collaborative (NEES).** The scale runs −100 to 100. Collaborative averages are **47.3 for nurses and 23.4 for physicians**, and the Pinnacle thresholds are 75 and 60 [8]. The drivers (doc 10 §3.1) map to features as follows:

| NEES driver | Features |
|---|---|
| Fast, reliable system | §9.1 budgets, PLT-OPS-05/06 |
| Training | IMP-TRN-01 |
| Personalization | Order favorites and templates in CLN-ORD-01 and PLT-CFG-03; AI-AMB-01 |
| Governance and trust | IMP-GOV-01, CLN-CDS-03 |
| External-data usability | INT-*, CLN-DOC-02 |

### 7.2 HIMSS EMRAM 2022, INFRAM and AMAM ‡

The 2022 criteria moved privacy and security to Stage 1. Stage 6 adds integration of external coded data into the CDR, digital patient-satisfaction measurement and device integration. Stage 7 adds evidence of safety improvement, clinician empowerment and data-leak protection [41]. Legacy Stage 7 decks cite **95% CPOE with ≥4 months of in-control data** and on-site validation by three inspectors [42]. Doc 10 §7.1 lists the older >95% closed-loop thresholds.

| Stage ‡ | Capability | Feature IDs |
|---|---|---|
| 1 | Ancillaries (LIS, RIS, pharmacy, PACS) plus, since 2022, privacy and security | DX-LAB-*, DX-RIS-01, MED-PHV-01, DX-PAC-01, TRU-IAM-*, TRU-AUD-01 |
| 2 | CDR, MPI, vocabularies | PLT-CORE-01/05, ACC-ID-01 |
| 3 | Nursing documentation, eMAR | NUR-FLW-01, MED-MAR-01 |
| 4 | CPOE with CDS; business continuity | CLN-ORD-02, CLN-CDS-02, TRU-BCP-01 |
| 5 | Structured physician documentation; endpoint security | CLN-DOC-01, PLT-CFG-03, TRU-SEC-01 |
| 6 | Closed-loop meds, blood and milk; device integration; external data; risk reporting | MED-BCM-01, DX-BB-01, SPC-NIC-01 (P2), DEV-GW-01, INT-FHIR-01, CLN-INC-01 |
| 7 | Paperless; HIE; analytics; DR; privacy monitoring; outcomes | TRU-BCP-04, AI-DAT-02, TRU-AUD-02, IMP-MAT-01 |
| INFRAM | Network, security, mobility, DC/cloud resilience | PLT-OPS-*, TRU-* |
| AMAM | Data governance, enterprise and predictive analytics | AI-DAT-01/02, AI-GOV-01, OPS-CMD-01 |

**Implication.** The MVP reaches Stage 5 capability. Stage 6 capability needs human-milk tracking (SPC-NIC-01) and the P2 device depth, which lands by R5–R6. A validated Stage 6/7 site needs months of usage data, so it is realistic at M30–36 (doc 10 §7.3).

### 7.3 China EMR application-level grading, levels 4–6

The NHC notice set Level 3+ for tertiary hospitals by 2019 and Level 4+ by 2020 [46].

| Level | Definition (doc 10 §7.2) | Feature IDs |
|---|---|---|
| L4 | Hospital-wide sharing; primary CDS | PLT-CORE-01, CLN-ORD-02, CLN-CDS-02 |
| L5 | Unified data management; intermediate CDS | AI-DAT-01/02, PLT-CORE-06 |
| L6 | Full-process closed loop; advanced CDS | MED-BCM-01, DX-ORD-01, DX-LAB-01, DX-BB-01, CLN-CDS-05 |

China is not a launch market (doc 01 §12.1), but L6's closed-loop definition is a good internal acceptance test.

### 7.4 Leapfrog CPOE and BCMA

- **CPOE:** ≥85% of inpatient medication orders entered via CPOE, and ≥60% on the timed test across 8 categories, including **Excessive Alerts**. False-positive reporting means an Incomplete Evaluation [44]. Features: CLN-ORD-02, CLN-CDS-01/02/03 (regression harness).
- **BCMA:** 95% patient and medication scanning, 100% coverage of med/surg, ICU, L&D and pre-op/PACU, and five decision-support elements [45]. Features: MED-BCM-01, MED-MAR-01, IMP-MAT-01.
- Leapfrog is US-only, but these are the best freely available acceptance tests for the safety core.

---

## 8. Competitive feature teardown

### 8.1 Vendor profiles

| Vendor | Deployment | AI (public evidence) | Localization (IN / GCC) | Price signals | Known weaknesses | Win/loss evidence |
|---|---|---|---|---|---|---|
| **Epic** | Self-hosted or Epic Hosting; Community Connect | Art/Emmie/Penny, AI Charting GA Feb 2026, Agent Factory (doc 09) | GCC: JHAH, KFMC, CCAD; "not always localized"; **billing not implemented in region** [3]. IN: none | Charité ≈€200M/10 yrs; NSW A$969M (doc 01 §9.2) | Price; regional billing; localization [3] | 7 international contracts/34 hospitals in 2025, mostly Community Connect [6]; Tasmania preferred vendor [21] |
| **Oracle Health Foundation EHR (Millennium)** | OCI-hosted / on-prem | Clinical AI Agent; nursing agent GA 14 Sep 2026 [51] | Large GCC base (SEHA, HMC); KLAS ME: slow on regional regulation; billing used by under half; mobile weak [3] | Alrajhi EHR+ERP bundle [53] | US customer losses; maternity below average [3] | 2 ME private groups won in 2025 [6]; VGR exit SEK 657M [17] |
| **Oracle new AI EHR** | OCI-native, voice-first, agentic | Embedded agents; AI patient portal (Aug 2026) [48][50] | Unknown | — | **Ambulatory-only** (ONC certified Nov 2025 [49]); acute not GA by Oct 2026 (doc 01) | None found in acute |
| **InterSystems TrakCare/IntelliCare** | Managed cloud on IRIS; one code base | Ambient orchestration, AI assistant, AI coding; EU MDR Class IIa [34] | Strongest NPHIES/SeHE interop in Black Book [5]; Mediclinic ME, Medcare (doc 01) | — | KLAS ME: "subpar end-user experience"; immature billing; maternity, oncology and lab/RIS integration need work [3] | 600+ hospitals in 29 countries; EMC Indonesia, 8 hospitals [34] |
| **Dedalus** | ORBIS U on AWS (doc 01) | ? | Egypt ministry deal (as Dedalus Enterprise Mgmt) [3] | — | "Slow to develop meaningful enhancements"; narrow adoption [3]; DACH KLAS 73.5 (doc 01) | Lost Charité (doc 01) |
| **IQVIA HIS** | Enterprise plus a cloud SaaS edition for clinics and small hospitals [39] | None stated [39] | KSA cluster greenfields; adapts to local needs [3] | — | Implementation and training difficulties; radiology weaker; limited BI/CDS [3] | Best in KLAS ME/A 2026 [4]; 3 cluster decisions 2018–22 [3] |
| **ezCaretech (BESTCare 2.0)** | Web-based [K] | ? | MNGHA (6 hospitals), Care Med (doc 01) | **≈US$5K/bed** (US$6.96M for 1,300 beds) [52] | Brand, scale (doc 01) | Care Med 2026; talks with HHC [52] |
| **KareXpert** | Managed cloud ("HiTrust Health Cloud"); Egyptian DC via Telecom Egypt [25][23] | "AI-ready" data lake; no specifics [25] | ABDM M1–M3; **NABH Advanced HIS+EMR** (to May 2028) [23]; Oman, Egypt | No public prices [25] | Depth unverified; claims vary (300+ vs 500+ hospitals) [23][25] | 300+ India hospitals and 15+ overseas [23] |
| **Insta by Practo** | SaaS [K] | None stated | Claims NABIDH, Malaffi, NPHIES and Riayati compliance, plus ZATCA e-invoicing [26] | Quote-based | Clinic heritage; acute depth unclear | 1,250+ centres, 22+ countries [26] |
| **Akhil (Miracle HMIS)** | Miracle on Cloud (50+ hospitals) plus on-prem [27] | "AI-powered" (unspecified) | Indian chains (Yashoda, Aster logos) [27] | — | No certifications shown [27] | KLAS: "grew rapidly" in 2025 (doc 01) |
| **Athma** | Not stated [28] | AIRA (Aug 2025, doc 01) | Narayana (80+ facilities); ABDM at one client [28] | — | Few third-party references | 200+ facilities; 3.5M app downloads [28] |
| **Aosta** | ? | ? | India | ? | Site unreachable [U] | KLAS: "grew rapidly" 2025 (doc 01) |
| **Balsam United/OASIS** | ? | ? | KSA private sector | ? | Site unreachable [U] | One of 8 vendors in Black Book's KSA scorecard [5] |
| **Adaptive TechSoft (CareWare)** | .NET/HTML5 on Oracle Exadata [U][38] | "AI techniques" (unspecified) [37] | **NPHIES-certified (2021)**; IHE testing; HIS+ERP (materials, finance, HR) [37][38] | — | Legacy stack [U] | 67–80+ hospitals [U][37]; significant 2025 contracts (doc 01) |
| **Avelios** | Modular, 30+ microservices, browser-based [29] | Voice AI to structured documentation, discharge letters, ICD/OPS coding suggestions [29] | DACH only; ISO 13485/27001/9001, BSI C5 [29] | — | Young; delivery risk (doc 01) | Klinikum Stuttgart (2,500 beds); SAP and Fresenius investors [29] |
| **MediMind** | FHIR-native on self-hosted Medplum; on-prem at the anchor customer [35] | Scribe (doctor signs); AI output stays "preliminary"; early warnings [35][36] | Georgia only | — | Tiny team; single market | 25-hospital network; 1.1M patients migrated; 15 analyzers live in 3 weeks [35] |
| **Akido Labs** | Care-delivery network, not an EHR vendor [31] | ScopeAI for clinician capacity [31] | US | — | Not an HIS competitor | 500K patients, 96 locations [31] |
| **Commure** | AI/RCM layer over 60+ EHRs [30] | Ambient (40M+ appointments), autonomous coding, call-centre agents [30] | US | — | No EHR | 130+ health systems, US$25B+ in claims [30] |
| **Canvas** | Outpatient EMR platform with plugins and agents [32] | Hyperscribe, Claim Coding Agent [32] | US | Trial; quote-based | Ambulatory only | 2026 Best in KLAS, ambulatory specialty [32] |
| **Elation** | Cloud primary-care EHR plus billing [33] | Note Assist; AI billing [33] | US | Quote-based | Ambulatory only | 2026 Best in KLAS small practice; 60,000+ clinicians [33] |

### 8.2 Epic-level coverage matrix (hospital-relevant competitors)

● = strong or proven; ◐ = present or partial; ○ = absent or weak; ? = no public evidence. **All ratings are [E]**, derived from the sources in §8.1. They are not hands-on tests.

| Vendor | OPD/ADT/queue | CPOE+CDS | Closed-loop meds | LIS/RIS | OT/ICU | Nat. claims | ERP/supply | Front door | Native AI | Nat. HIE |
|---|---|---|---|---|---|---|---|---|---|---|
| Epic | ● | ● | ● | ● | ● | ◐ | ○ | ● | ● | ◐ |
| Oracle Foundation | ● | ● | ● | ● | ◐ | ◐ | ● | ◐ | ◐ | ● |
| InterSystems | ● | ● | ◐ | ● | ◐ | ◐ | ○ | ◐ | ● | ● |
| IQVIA HIS | ● | ◐ | ? | ◐ | ● | ◐ | ? | ◐ | ○ | ? |
| ezCaretech | ● | ● | ? | ● | ◐ | ? | ◐ | ? | ? | ? |
| KareXpert | ● | ◐ | ? | ● | ? | ◐ | ◐ | ● | ◐ | ● |
| Insta | ● | ◐ | ? | ◐ | ? | ● | ◐ | ◐ | ○ | ● |
| Akhil | ● | ? | ? | ● | ? | ? | ? | ◐ | ◐ | ? |
| Athma | ● | ◐ | ? | ● | ● | ? | ◐ | ● | ◐ | ◐ |
| ATS CareWare | ● | ? | ? | ? | ? | ● | ● | ? | ○ | ◐ |
| Avelios (DACH) | ? | ● | ● | ◐ | ● | ● (DRG) | ○ | ? | ● | ● (gematik) |
| MediMind (GE) | ● | ◐ | ? | ● | ? | ◐ | ● | ? | ● | ◐ |

**Reading the matrix.** No local competitor shows public evidence of **closed-loop medication with BCMA**. That cell is "?" for every IN/GCC vendor. Global vendors, by contrast, are weak on **regional billing and price**. Our wedge is the empty intersection: **closed-loop safety (EMRAM 6-grade), plus national rails and self-pay billing, plus native supply chain, at local prices.**

### 8.3 Lessons from modern entrants

1. **Avelios:** a DRG workspace with AI code suggestions and revenue impact. It holds ISO 13485 at the company level, as well as BSI C5 [29]. **Copy:** a QMS from day one (TRU-REG-01) and coding AI tied to revenue impact (RCM-AI-01).
2. **MediMind:** 13 months from idea to a signed 25-hospital contract with two founders plus an "AI code factory". It took the anchor customer live on-prem in a day and ran analyzers in parallel with the incumbent for zero-downtime cutover [35]. **Copy:** parallel-run cutover for analyzers (DX-LAB-02) and an on-prem install path (PLT-OPS-02). **Do not copy:** FHIR as the transactional core (§4 #10).
3. **Commure and Canvas:** AI agents for coding, call centres and referral intake sold as an overlay [30][32]. **Copy:** our AI and RCM features should also be sellable as a wedge over incumbent HIS (doc 01 §11 #5).
4. **Akido:** AI that extends clinician capacity inside a care network [31]. This is relevant to Group-Connect hub-and-spoke models (doc 01 §12.3), not to the MVP.

### 8.4 Which features actually win RFPs in our segment

| Rank | Winning factor | Evidence | Our features |
|---|---|---|---|
| 1 | National rails live at references | Black Book gates [5]; ABDM marks [1]; KareXpert's NABH/ABDM listing [23] | RCM-NAT-*, INT-ABDM-01, INT-SEHE-01, INT-UAE-01 |
| 2 | Module checklist breadth | Rajasthan's 28-module Group-2 [1]; competitor module lists [25][27][28] | The full MVP |
| 3 | Price (per bed, L1) | L1 rule [1]; ≈US$5K/bed [52]; Epic's price limits ME growth [3] | Cost-to-serve; IMP-FND-01 shortens implementations |
| 4 | Demo performance | 25 of 100 marks for presentation and functional demo [1] | Scripted demo pack (§5) |
| 5 | In-country delivery and hosting | 94% of KSA buyers [5]; Jaipur on-site team [1] | PLT-OPS-01, TRU-SEC-03 |
| 6 | Certifications | CMMI, ISO, Safe to Host [1]; NABH HIS/EMR [23] | TRU-SEC-02/03 |
| 7 | Implementation and adoption | KLAS ME: IQVIA implementation and training complaints [3]; training SLAs [1] | IMP-* |
| 8 | AI | 5 of 100 marks [1]; AI is the top Middle East investment priority, "complementary" to the EHR [4] | AI-* (differentiator, not gate) |
| 9 | Safety depth (closed loop) | Wins tertiary/JCI/EMRAM buyers; rarely scored in mid-market tenders [E] | MED-BCM-01, DX-BB-01, DX-CRT-01 |

---

## 9. Consolidated non-functional requirements catalogue

### 9.1 Performance budgets (release blockers)

| Metric | Target | Source |
|---|---|---|
| Login (SSO or badge) | p95 ≤5 s; badge tap ≤2 s [E] | Doc 10 §10.1 |
| Warm screen / cold chart open | p95 ≤1.0 s / ≤1.5 s | Doc 08 §12.6 |
| BFF server time | p95 ≤300 ms; p99 ≤800 ms | Doc 08 |
| Patient search type-ahead | p95 ≤200 ms, including Arabic/Latin transliteration | Doc 08 |
| Order sign including CDS | p95 ≤1.5 s; each CDS service ≤500 ms; fail-open with a banner except hard stops | Doc 08 |
| BCMA scan to verification | p95 ≤500 ms; works offline | Doc 08 |
| Wristband/label print | ≤3 s request-to-print [E] | — |
| Tracking/bed/queue boards | ≤2 s freshness | Doc 08 |
| HL7 end-to-end | p95 ≤5 s; zero silent drops; unacknowledged >5 min raises an alarm | Doc 08 |
| Reporting replica / lakehouse | ≤60 s / ≤15 min | Doc 08 |
| Network tolerance | Core flows usable at 1 Mbps / 300 ms RTT | Doc 08 |
| RFP comparator | Average API ≤3 s (Rajasthan) | [1] |

### 9.2 Single availability and DR table (resolves docs 07, 08 and 10)

| Tier (doc 07 §6.2 scope) | Engineering SLO | **Contractual SLA (default)** | RPO (in-region / cross-region) | RTO infra (engineering / contract) | Cyber-recovery (engineering / contract) | Degraded mode |
|---|---|---|---|---|---|---|
| **T0 life-critical**: ADT, allergies, meds, CPOE, eMAR/BCMA, results and critical alerts, transfusion, notes read | 99.99% | **99.95%/month** | 0 (sync quorum) / ≤5 min | ≤5 min auto / ≤15 min in-region; ≤60 min cross-region | ≤24 h tenant restore / **≤72 h** | Continuity viewer ≤15 min stale; offline BCMA; downtime ID blocks |
| **T1 clinical ancillary**: LIS, pharmacy, RIS, OT, nursing write | 99.95% | 99.9% | ≤1 min / ≤5 min | ≤15 min / ≤60 min | ≤48 h / ≤5 days | Paper forms; queued interface replay; downtime accession ranges |
| **T2 business**: registration, scheduling, billing, claims, supply, portal | 99.9% | 99.9% | ≤15 min | ≤4 h | ≤7 days / ≤14 days | Offline capture; batch back-entry; claim queueing |
| **T3 analytics** | 99.5% | 99.5% | ≤24 h | ≤24–72 h | ≤30 days | None |

**Rules.**
- Single writer per tenant. No multi-master clinical writes (doc 08).
- Planned downtime for releases is zero.
- Uptime is measured at the application monitor and excludes customer power, LAN and WAN, as Rajasthan's own formula does [1].
- **Do not sign penalty-free bands above 99.95%** without pricing the risk. Answer 99.99%+ tender bands with the tier table and continuity evidence.
- Quarterly restore tests and an annual cyber-recovery exercise (doc 07 §6.3) are contract evidence.

### 9.3 Offline and edge

| Phase | Capability |
|---|---|
| MVP | Read-only continuity (TRU-BCP-01), offline BCMA with reconciliation (MED-BCM-01), downtime MRN, encounter and accession blocks (TRU-BCP-02), back-entry keeping original times (TRU-BCP-03) |
| P2 | On-prem/state-DC install (PLT-OPS-02) |
| P3 | Edge cell with a local primary (PLT-OPS-03) |

- **Safe offline:** append-only facts against verified orders.
- **Never offline:** bed or OT-slot allocation, identifiers outside pre-allocated blocks, controlled-drug stock, and new prescribing without full CDS (doc 08 §1 #10).

### 9.4 Localization and RTL (PLT-UX-03, PLT-CFG-02)

- **Arabic:** full RTL with bidi-safe mixed clinical text, and configurable Arabic-Indic or Western digits.
- **Calendars:** Hijri (Umm al-Qura) displayed alongside Gregorian; instants stored in UTC (doc 11 P10). Friday–Saturday weekend scheduling templates in the GCC.
- **Names:** Arabic four-part names with English transliteration and phonetic search. Single-name and initial-heavy Indian names.
- **Bilingual documents:** AR/EN printouts (invoices with ZATCA fields, sick leave, discharge summary, AVS). Hindi labels and training material for Indian public buyers [1]. Regional-language SMS/WhatsApp templates.
- **Finance:** INR/SAR/AED multi-currency; GST/VAT engines. Metric units only, UCUM everywhere (doc 11 P6).
- **Process:** professional translation with clinician review per locale. Never ship partially translated clinical paths (doc 10 §10.1 #14).

### 9.5 Accessibility

**WCAG 2.2 AA** (a W3C Recommendation; current edition dated 12 Dec 2024) [40]. It adds Focus Not Obscured (AA), Dragging Movements (AA), Target Size Minimum (AA), Consistent Help (A), Redundant Entry (A) and Accessible Authentication Minimum (AA), and removes 4.1.1 Parsing [40]. Ship a VPAT/ACR. Redundant Entry and Accessible Authentication matter clinically: no re-keying of demographics, and badge or passkey login.

### 9.6 Security baselines (from doc 07 §3.2 and §9.1)

- **Identity:** phishing-resistant MFA for privileged and remote access; SSO/SCIM; break-the-glass.
- **Audit:** 100% of PHI access audited per BALP, streamed to the customer SIEM.
- **Encryption:** AES-256 at rest and TLS 1.2+ (1.3 preferred) in transit; per-tenant keys; BYOK at P2.
- **Supply chain:** SBOM/VEX per release; critical patches ≤7 days for SaaS.
- **Testing:** annual pen test.
- **Attestations:** ISO 27001 family plus SOC 2 Type II by M12.
- **Market-specific:** CERT-In 6-hour reporting and Safe-to-Host (IN); NCA ECC/CCC and an in-Kingdom cell (SA); ADHICS (AE).
- **Clinical safety and resilience:** a hazard log, and a published 72-hour T0 cyber-recovery commitment.

### 9.7 Scalability targets (doc 08 §12.6)

| Dimension | Target |
|---|---|
| Sessions | 20K per cell; 8K per tenant DB |
| Write throughput | 3K tx/s sustained, 10K burst |
| Interfaces | 2K HL7 messages/s per cell |
| Patients | 50M per tenant |
| Load testing | 3× the largest customer, including a "1,000-bed day-in-the-life" |
| State scale (>100K encounters/day, the full-marks band in [1]) | P3 national cell, with a sharding evaluation before any state bid |

---

## 10. 24-month release train

| Increment | Months | Content (catalogue IDs) | Exit criteria |
|---|---|---|---|
| **R0 Foundations** | 0–3 | PLT-CORE-01..07, PLT-CFG-01/02, PLT-OPS-01 (dev cell), TRU-SEC-01, TRU-REG-01/02, TRU-IAM-01; ADR-001..010 (doc 08 §14); regulatory memos for EWS and blood bank | State-machine specs and hazard log approved; CI performance gate running; IN and SA design-partner contracts signed |
| **R1 Access & chart** | 4–6 | ACC-*, CLN-CHT-*, CLN-ORD-01/02 (alpha), PLT-CFG-03, PLT-UX-01/02/04, INT-ENG-01, INT-FHIR-01, TRU-AUD-01, TRU-PRV-*, RCM-ACC-01, RCM-TAR-01, RCM-CSH-01, ERP-INV-01, ABDM M1 sandbox | OPD end-to-end in sandbox (register→consult→bill→pharmacy); SOC 2 Type I and ISO 27001 Stage 1 |
| **R2 Closed loop & diagnostics** | 7–9 | MED-* (MVP), CLN-CDS-01/02/03/05/08, NUR-*, DX-ORD/CRT/LAB-01..05, DX-RIS-01/02, DX-PAC-01, DX-BB-01/02, DEV-GW-01, DEV-VAL-01, TRU-BCP-01..04, RCM-INS-01, RCM-NAT-02, INT-ABDM-01 (M2/M3), RCM-TAX-01 (GST), IMP-FND-01 (IN pack), IMP-MIG-01 | Dress rehearsal at the IN design partner; CERT-In Safe-to-Host audit; NABH HIS/EMR application filed |
| **R3 MVP GA (India)** | 10–12 | CLN-ED-*, SPC-OT-01..03, SPC-AN-01, SPC-ICU-01, SPC-MAT-01, SPC-DIE-01, SPC-DTH-01, CLN-DOC-*, CLN-INC-01, CLN-QI-01, OPS-*, AI-GW-01, AI-GOV-01, AI-AMB-01, AI-DCS-01, AI-DAT-01, DFD (MVP), IMP-RDY/TRN/TEL/SUP | **First go-live at M12** behind readiness gates; ISO 27001 and SOC 2 Type II |
| **R4 KSA pack + P2 start** | 13–15 | RCM-NAT-01, RCM-TAX-01 (ZATCA), INT-SEHE-01, ACC-ID-02 (SA), PLT-UX-03 hardening, KSA cell (CST CSP, NCA ECC), CBAHI KPI pack; DX-MIC-01, CLN-AMS-01, CLN-DOC-02, ACC-SCH-02 | **KSA go-live at M15**; NPHIES production claims round-trip |
| **R5 Depth 1 + UAE** | 16–18 | MED-INF-02 (first pump vendor), SPC-AN-02, SPC-MAT-02, SPC-NIC-01, DFD-APP-01, DFD-TEL-01, ACC-OPD-03, ERP-FIN-02, ERP-HTM-01, ERP-SVC-01, RCM-GRP-01, INT-UAE-01, RCM-NAT-03, UAE cell/ADHICS | UAE go-live; 3+ live sites; first NABH certificate (target) |
| **R6 Depth 2 + public-sector readiness** | 19–21 | DX-BB-03 (regulated), MED-ONC-01, SPC-ONC-01, CLN-IPC-02, AI-DAT-02, OPS-CMD-01, AI-NUR-01, AI-RCM-01, RCM-AI-01, PLT-OPS-02, TRU-KEY-01, IMP-MAT-01, MED-ADC-01 | First SI-consortium public bid (OEM with MAF) |
| **R7 Scale & maturity** | 22–24 | CLN-CDS-06/07, AI-SUM-01, AI-PAT-01, DFD-CRM-01, ERP-ROS-01, ERP-HR-02, ERP-FIN-03, ERP-IMP-01, INT-IPS-01, INT-PH-01, MED-ERX-01, IMP-GOV-01, IMP-CRT-01, TRU-AUD-02, TRU-BCP-05 | EMRAM Stage 6 readiness report at the lead site; partner certification academy live |

**Critical paths** (each must hold for the M12 go-live):
1. **Medication and transfusion:** PLT-CORE-01 → PLT-CORE-03 → CLN-ORD-02 → MED-PHV-01 → MED-MAR-01 → MED-BCM-01 → DX-BB-01.
2. **Revenue:** PLT-CORE-01 → RCM-ACC-01 → RCM-CHG-01 → RCM-INS-01 → RCM-NAT-02.
3. **India national rails:** INT-FHIR-01 → INT-ABDM-01 → DFD-REC-01.
4. **Hosting and security:** PLT-OPS-01 → TRU-SEC-02/03 (security gates for contract signature).
5. **Content:** PLT-CFG-01 → IMP-FND-01. The country foundation pack is XL and is usually what slips.

---

## 11. Implications for our build

1. **Freeze this catalogue as the single backlog of record.** Load Appendix A into the tracker unchanged. Any new feature needs an ID, a driver and a tag, and any change to an MVP tag needs product-council sign-off. Retire the per-document MVP lists.
2. **Commit to native LIS and RIS cores in the MVP.** They are what Indian and GCC buyers check first, and the shared order lifecycle makes them cheaper than they look. Buy analyzer breadth through middleware. Never build PACS.
3. **Make "closed loop at local prices" the headline.** No local competitor shows public evidence of BCMA plus bedside transfusion (§8.2). Lead every demo with CPOE → pharmacist verification → BCMA → transfusion check, then show NPHIES or NHCX claims from the same encounter.
4. **Treat national rails as product, not projects.** Fund ABDM M1–M3, NHCX/TPA, NPHIES, ZATCA and SeHE as owned country packs with SLAs. Black Book shows they decide elimination [5]. Get NABH HIS/EMR certification as early as NABH allows [23][24].
5. **Run a regulated-module QMS from month 0.** It is cheap now and decisive later. EWS ships in the MVP only under it, gated by market. The native blood centre and pump autoprogramming follow in P2 on the same track.
6. **Do not chase Indian state tenders before about M19.** Their eligibility walls (₹120 Cr turnover, CMMI L3) and L1 pricing reward incumbents [1]. Build private references first, then bid as the IP-owner OEM behind an SI. Have the state-data-centre install path (PLT-OPS-02) ready before that first bid, and plan for customization IP vesting in the state.
7. **Price the SLA, engineer the SLO.** Use the §9.2 table in every contract. Never accept uncapped penalties. Show continuity-copy evidence instead of promising 99.999%.
8. **Make KLAS pillars a design input.** Nine of the 20 KLAS questions are about promises, implementation, training, support and value [9][10]. Fund IMP-* features with the same priority as clinical ones. Instrument NEES-style micro-surveys from the first go-live.
9. **Keep AI inside the governance plane and aim it at OPD notes and discharge summaries.** It earns demo marks and clinician goodwill but does not win the bid alone [1][4]. Sell the AI and RCM layer as a wedge over incumbents in parallel (§8.3).
10. **Staff for content, not just code.** IMP-FND-01 (XL) and the country packs are on the critical path. A 10–15-person clinical content team is as important as the platform team [E].
11. **Copy MediMind's parallel-run analyzer cutover and Avelios's QMS-first posture. Reject FHIR-as-core.** Doc 08's Postgres journal plus FHIR façade stays.
12. **Re-verify quarterly:**
    - whether Rajasthan iHMS 2.0 is re-tendered;
    - HHC cluster HIS awards;
    - NABH's certified-software list;
    - the official EMRAM 2022 thresholds (currently ‡);
    - Oracle acute GA;
    - WA Health EMR stage-2 vendor selection.

---

## Appendix A — Master requirements catalogue (CSV, 214 rows)

The columns are defined in §3. In the `src` column, "14" means this report.

```csv
id,domain,epic,feature,src,driver,mkt,deps,decision,reg,size,tag
PLT-CORE-01,Platform,Clinical fact platform,Bitemporal append-only clinical journal with entered-in-error/amend semantics and provenance,08;11,JCI-MOI;NABH-IMS;SAFER,ALL,-,B,N,XL,MVP
PLT-CORE-02,Platform,Clinical fact platform,Enterprise hierarchy (tenant>legal entity>facility>unit>bed) with scoped config inheritance,08;11,-,ALL,-,B,N,L,MVP
PLT-CORE-03,Platform,Clinical fact platform,Domain state machines + server-side safety invariants for all channels,11;03,SAFER;NPG.01.01.01,ALL,PLT-CORE-01,B,N,L,MVP
PLT-CORE-04,Platform,Clinical fact platform,Domain event catalogue + transactional outbox,08;11,-,ALL,PLT-CORE-01,B,N,M,MVP
PLT-CORE-05,Platform,Clinical fact platform,Terminology service + licence entitlements (SNOMED/LOINC/ICD-10 variants/UCUM/ATC),06;08,EMRAM-S2,ALL,-,B+I,N,L,MVP
PLT-CORE-06,Platform,Clinical fact platform,Versioned rules engine with simulation/replay + approval + effective dating,04;03,SAFER;ISO15189,ALL,PLT-CORE-01,B,C,L,MVP
PLT-CORE-07,Platform,Clinical fact platform,Task/work-queue engine: every item owned + SLA timer + orphan alarm,10;11,SAFER,ALL,PLT-CORE-04,B,N,M,MVP
PLT-CFG-01,Platform,Configuration,Config-as-product: typed registry/change sets/signed bundles/promotion/3-way merge,08;10,-,ALL,PLT-CORE-02,B,N,L,MVP
PLT-CFG-02,Platform,Configuration,Effective-dated country packs (code sets/tax/claims/statutory reports),05;06,-,ALL,PLT-CFG-01,B,N,M,MVP
PLT-CFG-03,Platform,Configuration,Forms/template engine (FHIR Questionnaire/SDC renderer + builder),02;03,EMRAM-S5,ALL,PLT-CORE-05,B,N,L,MVP
PLT-CFG-04,Platform,Configuration,Extension SDK/plugin slots + SMART app launch,02;06,-,ALL,INT-FHIR-01,B,N,M,P2
PLT-UX-01,Platform,UX foundation,Design system; keyboard-first; WCAG 2.2 AA,10;08,WCAG2.2,ALL,-,B,N,M,MVP
PLT-UX-02,Platform,UX foundation,Workstation shell: silent ZPL wristband/label print; scanners; badge tap; FHIRcast,08,NPG.01.01.01;JCI-IPSG.1,ALL,-,B,N,M,MVP
PLT-UX-03,Platform,UX foundation,i18n: Arabic RTL; Hijri+Gregorian; bilingual prints; multi-script/phonetic name search,08;09,CBAHI;DoH,ALL,-,B,N,L,MVP
PLT-UX-04,Platform,UX foundation,Mobile clinical app framework with encrypted offline cache,03;08,-,ALL,-,B,N,L,MVP
PLT-OPS-01,Platform,Deployment,Cell-based multi-tenant SaaS with in-country cells (IN/SA/AE),07;08,DPDP;PDPL;NCA-ECC;ADHICS,ALL,-,B,N,XL,MVP
PLT-OPS-02,Platform,Deployment,On-prem/state-data-centre install from same signed artifacts,08;14,RFP (state DC hosting),IN;SA;AE,PLT-OPS-01,B,N,L,P2
PLT-OPS-03,Platform,Deployment,Edge cell (local primary) for low-connectivity hospitals,08,-,IN;SA,PLT-OPS-02,B,N,XL,P3
PLT-OPS-04,Platform,Deployment,HA multi-AZ + cross-region DR + PITR,07;08,INFRAM;RFP SLA,ALL,PLT-OPS-01,B,N,L,MVP
PLT-OPS-05,Platform,Deployment,Observability + real-user monitoring per screen/site + SLO dashboards,08;10,KLAS-Operations,ALL,-,B,N,M,MVP
PLT-OPS-06,Platform,Deployment,Performance gate: Synthea 1000-bed day-in-the-life load test in CI,08,-,ALL,-,B,N,M,MVP
PLT-OPS-07,Platform,Deployment,Zero-downtime releases (expand/contract); N-2 on-prem policy,08,KLAS-Product,ALL,-,B,N,M,MVP
TRU-IAM-01,Trust,Identity & access,SSO (SAML/OIDC); SCIM; phishing-resistant MFA; badge tap-and-go,07,NCA-ECC;ADHICS;HIPAA-NPRM,ALL,-,B+I,N,L,MVP
TRU-IAM-02,Trust,Identity & access,RBAC+ABAC+care relationship; privilege-gated clinical actions,07;05,JCI-SQE;NABH-HRM;CBAHI,ALL,-,B,N,L,MVP
TRU-IAM-03,Trust,Identity & access,Break-the-glass with reason capture and review queue,07,JCI-MOI;NABH-IMS,ALL,TRU-IAM-02,B,N,S,MVP
TRU-PRV-01,Trust,Privacy,Sensitivity labels + purpose-of-use propagated to UI/API/print/HIE,07;11,DPDP;PDPL;GDPR,ALL,-,B,N,M,MVP
TRU-PRV-02,Trust,Privacy,Consent management incl. ABDM consent artefacts,07;06,ABDM;DPDP;PDPL,ALL,-,B,N,M,MVP
TRU-AUD-01,Trust,Audit,BALP audit of 100% PHI access; tamper-evident; SIEM streaming,07;08,JCI-MOI;NABH-IMS;ADHICS;EMRAM-S1,ALL,-,B,N,M,MVP
TRU-AUD-02,Trust,Audit,Privacy monitoring + patient-facing access log,07,EHDS;EMRAM-S7,ALL,TRU-AUD-01,B+I,N,M,P2
TRU-KEY-01,Trust,Keys,Per-tenant KMS + BYOK/HYOK,07,NCA-CCC;ADHICS,ALL,PLT-OPS-01,B+I,N,M,P2
TRU-SEC-01,Trust,Secure SDLC,IEC 81001-5-1/SSDF; SBOM/VEX; signed builds; VDP,07;08,CRA;FDA-524B,ALL,-,B,N,M,MVP
TRU-SEC-02,Trust,Attestations,ISO 27001/27701/27017/27018 + SOC 2 Type II,07,RFP gate,ALL,TRU-SEC-01,B,N,L,MVP
TRU-SEC-03,Trust,Attestations,Market attestations: CERT-In/Safe-to-Host audit; NCA ECC/CCC; ADHICS; MeitY/CST cloud,07;14,CERT-In;NCA;ADHICS,IN;SA;AE,PLT-OPS-01,B,N,M,MVP
TRU-BCP-01,Trust,Downtime,Read-only continuity: unit snapshots <=15 min stale; shadow viewer; printable packets,07;08,JCI-MOI;NABH-IMS;SAFER;EMRAM-S4,ALL,PLT-CORE-04,B,N,L,MVP
TRU-BCP-02,Trust,Downtime,Downtime MRN/encounter/accession blocks + offline wristband/label printing,07;04,NPG.01.01.01,ALL,PLT-UX-02,B,N,M,MVP
TRU-BCP-03,Trust,Downtime,Back-entry + reconciliation keeping original event times (meds/results/charges),07;08,SAFER,ALL,PLT-CORE-01,B,N,L,MVP
TRU-BCP-04,Trust,Downtime,Immutable isolated backups; clean-room rebuild; quarterly restore tests,07,HIPAA-NPRM;INFRAM,ALL,PLT-OPS-04,B,N,L,MVP
TRU-BCP-05,Trust,Downtime,Code-Dark drill tooling + SAFER self-assessment workbook,07;10,SAFER;JCI-MOI,ALL,TRU-BCP-01,B,N,S,P2
TRU-REG-01,Trust,Regulatory,Regulated-module track: ISO 13485/IEC 62304/ISO 14971 QMS + per-module boundary map,07;08,MDR;SFDA;CDSCO;FDA,ALL,-,B,Y,L,MVP
TRU-REG-02,Trust,Regulatory,Clinical safety case + hazard log tied to backlog,07;08,DCB0129,ALL,-,B,N,M,MVP
ACC-ID-01,Access,Identity,EMPI: probabilistic match; steward queue; reversible merge/unmerge,03;11,SAFER;NPG.01.01.01;JCI-IPSG.1,ALL,PLT-CORE-03,B,N,L,MVP
ACC-ID-02,Access,Identity,National ID plug-ins: ABHA; Absher/Nafath/Iqama; Emirates ID/UAE Pass,06;09,ABDM;CHI;DoH,IN;SA;AE,ACC-ID-01,B,N,M,MVP
ACC-ID-03,Access,Identity,Unknown/trauma/MCI aliases; distinct newborn naming; photo capture,03,SAFER,ALL,ACC-ID-01,B,N,M,MVP
ACC-REG-01,Access,Registration & ADT,Registration with sponsor/payer selection; coverage; consents; AR/EN names,05,NABH-AAC;CBAHI,ALL,ACC-ID-01,B,N,M,MVP
ACC-ADT-01,Access,Registration & ADT,ADT incl. pending/LOA/corrections + HL7 ADT broadcast,03;06,JCI-ACC,ALL,ACC-REG-01,B,N,L,MVP
ACC-ADT-02,Access,Registration & ADT,Bed board with bed state machine; EVS status; isolation,03;05,NPG-Goal1,ALL,ACC-ADT-01,B,N,M,MVP
ACC-SCH-01,Access,Scheduling,Provider/resource scheduling; templates; overbooking; waitlists,03;05,-,ALL,-,B,N,L,MVP
ACC-SCH-02,Access,Scheduling,Referral intake + order-to-completion tracking,03,SAFER,ALL,ACC-SCH-01,B,N,M,P2
ACC-OPD-01,Access,OPD flow,OPD token/queue + multi-step journey (reg>vitals>consult>bill>lab>pharmacy) + display boards,05;09;14,NABH-AAC;RFP,IN;SA;AE,ACC-SCH-01,B,N,M,MVP
ACC-OPD-02,Access,OPD flow,ABDM Scan-and-Share QR registration,09;06,ABDM,IN,ACC-ID-02,B,N,S,MVP
ACC-OPD-03,Access,OPD flow,Self-service kiosk check-in + payment,09,-,ALL,ACC-OPD-01,B+I,N,M,P2
ACC-TRF-01,Access,Patient flow,Transfer centre + patient transport tasks,05,-,ALL,ACC-ADT-02,B,N,M,P2
CLN-CHT-01,Clinical,Chart,Clinician chart + banner standard (photo; 2 IDs; allergies; code status; isolation; dated weight),03;11,NPG.01.01.01;JCI-IPSG.1;NABH-AAC,ALL,ACC-ID-01,B,N,L,MVP
CLN-CHT-02,Clinical,Chart,Coded problem list; coded allergies (reaction/severity); home meds,03,EMRAM-S2,ALL,PLT-CORE-05,B,N,M,MVP
CLN-CHT-03,Clinical,Chart,Results review + trending + cumulative views,03,-,ALL,DX-ORD-01,B,N,M,MVP
CLN-ORD-01,Clinical,CPOE,Orderables catalogue + versioned order sets,03,Leapfrog-CPOE;EMRAM-S4,ALL,PLT-CFG-01,B,N,L,MVP
CLN-ORD-02,Clinical,CPOE,CPOE all timing types; verbal-order read-back/co-sign; lifecycle; order-to-result tracking,03;11,Leapfrog-CPOE;JCI-MMU;NABH-MOM;EMRAM-S4,ALL,CLN-ORD-01;PLT-CORE-03,B,N,XL,MVP
CLN-CDS-01,Clinical,CDS,Drug KB abstraction (FDB/Medi-Span/Multum/MIMS/regional) + local re-tiering,03;04,Leapfrog-CPOE,ALL,-,P,N,M,MVP
CLN-CDS-02,Clinical,CDS,Order checks: DDI/allergy/dose/route/duplicate/renal/age (Leapfrog 8 categories),03,Leapfrog-CPOE;EMRAM-S4;China-L4,ALL,CLN-CDS-01,B,C,L,MVP
CLN-CDS-03,Clinical,CDS,CDS telemetry: overrides/PPV/alert burden + Leapfrog regression harness,03;10,Leapfrog-CPOE;KLAS-NEES,ALL,CLN-CDS-02,B,N,M,MVP
CLN-CDS-04,Clinical,CDS,CDS Hooks client + CQL engine,06;08,-,ALL,INT-FHIR-01,B+I,N,M,P2
CLN-CDS-05,Clinical,CDS,EWS calc (NEWS2/PEWS/MEOWS) from validated obs + escalation tasks + obs frequency,03;14,NPG.01.05.02;JCI-COP;NABH-COP,IN;SA;AE,NUR-FLW-01;TRU-REG-01,B,Y,M,MVP
CLN-CDS-06,Clinical,CDS,Rule-based sepsis screen as non-interruptive worklist flag,03;14,SEP-1;NABH-COP,IN;SA;AE,CLN-CDS-05,B,Y,S,P2
CLN-CDS-07,Clinical,CDS,Predictive deterioration/sepsis via cleared partner; silent-mode local validation,09;07,FDA-CDS-2026;AI-Act,ALL,AI-GOV-01,P,Y,M,P2
CLN-CDS-08,Clinical,CDS,VTE risk assessment + prophylaxis prompts,03,JCI-COP;NABH-COP,ALL,CLN-CDS-02,B,N,S,MVP
CLN-DOC-01,Clinical,Documentation,H&P/progress/consult notes; structured templates; co-sign; addenda,03,EMRAM-S5;JCI-MOI;NABH-IMS,ALL,PLT-CFG-03,B,N,L,MVP
CLN-DOC-02,Clinical,Documentation,Copy-forward provenance + bloat indicators + change-since-last-note,10;03,-,ALL,CLN-DOC-01,B,N,M,P2
CLN-DOC-03,Clinical,Documentation,Discharge navigator + summary + bilingual AVS,03,NABH-AAC;JCI-ACC,ALL,CLN-DOC-01,B,N,M,MVP
CLN-DOC-04,Clinical,Documentation,HIM: deficiency tracking; scanning/indexing; ROI log; amendments,03;07,JCI-MOI;NABH-IMS,ALL,CLN-DOC-01,B,N,M,MVP
CLN-MRC-01,Clinical,Transitions,Medication reconciliation at admission/transfer/discharge,03,NPG-Goal14;JCI-MMU;NABH-MOM,ALL,MED-MAR-01,B,N,M,MVP
CLN-HND-01,Clinical,Transitions,I-PASS handoff + team/rounding lists,03,NPG-Goal1;JCI-PCC,ALL,-,B,N,M,MVP
CLN-RES-01,Clinical,Results,Results inbox: routing; surrogates; unacknowledged monitoring; pending-at-discharge queue,03,SAFER;NPG.01.02.01,ALL,DX-CRT-01,B,N,M,MVP
CLN-ED-01,Clinical,Emergency,ED quick-reg; configurable triage (ESI/CTAS/MTS/ATS); tracking board with timers,03,NPG-Goal1;NABH-AAC,ALL,ACC-ID-03,B,N,L,MVP
CLN-ED-02,Clinical,Emergency,Stroke/STEMI/sepsis pathway clocks; disposition; boarding view,03,CMS-ECAT;NABH-COP,ALL,CLN-ED-01,B,N,M,MVP
CLN-ED-03,Clinical,Emergency,MCI/disaster mode,03,JCI-FMS;NABH-FMS,ALL,CLN-ED-01,B,N,M,P2
CLN-BH-01,Clinical,Safety content,Suicide screening + restraint/seclusion orders and timers,03,NPG;JCI-COP,ALL,CLN-ORD-02,B,N,S,MVP
CLN-IPC-01,Clinical,Infection control,Isolation flags and alerts,03,NABH-HIC;JCI-PCI,ALL,-,B,N,S,MVP
CLN-IPC-02,Clinical,Infection control,HAI surveillance; device-days; outbreak management,03,NABH-HIC;JCI-PCI,ALL,DX-MIC-01,B,N,M,P2
CLN-AMS-01,Clinical,Stewardship,Restricted-antimicrobial approval; time-outs; DOT reporting,03;04,NPG.14.06.01;NABH-MOM,ALL,MED-PHV-01,B,N,M,P2
CLN-ACP-01,Clinical,Safety content,Code status + advance care planning documents,03,-,ALL,-,B,N,S,MVP
CLN-INC-01,Clinical,Quality & safety,Incident/safety-event reporting + RCA workflow,07;10;14,NABH-PSQ;JCI-QPS;EMRAM-S6,ALL,-,B,N,M,MVP
CLN-QI-01,Clinical,Quality & safety,Accreditation KPI capture (NABH/CBAHI/JAWDA/JCI indicators),07;05,NABH-PSQ;CBAHI;JAWDA,IN;SA;AE,AI-DAT-01,B,N,M,MVP
NUR-FLW-01,Nursing,Documentation,Assessments; flowsheets; I&O; LDAs; charting by exception,03;10,EMRAM-S3;NABH-COP,ALL,PLT-CFG-03,B,N,L,MVP
NUR-FLW-02,Nursing,Documentation,Braden/Morse/delirium scores with care-plan triggers,03,JCI-IPSG.6;NABH-COP,ALL,NUR-FLW-01,B,N,M,MVP
NUR-CP-01,Nursing,Care planning,Care plans; shift worklists; nurse handoff,03,NABH-COP,ALL,NUR-FLW-01,B,N,M,MVP
NUR-WND-01,Nursing,Documentation,Wound photography + documentation,03,-,ALL,NUR-FLW-01,B,N,S,MVP
NUR-STF-01,Nursing,Staffing,Acuity-based staffing view,05,NPG-12,ALL,NUR-FLW-01,B,N,M,P3
MED-PHV-01,Medication,Pharmacy,Pharmacist verification queue with clinical screening,04,JCI-MMU;NABH-MOM;EMRAM-S6,ALL,CLN-ORD-02,B,N,L,MVP
MED-FRM-01,Medication,Pharmacy,Formulary; LASA/tall-man; high-alert flags; item-master link,04,ISMP;NABH-MOM;JCI-MMU,ALL,ERP-INV-01,B,N,M,MVP
MED-DSP-01,Medication,Pharmacy,IP dispensing (unit dose/ward stock); returns; charge on dispense/admin,04;05,NABH-MOM,ALL,MED-PHV-01;ERP-INV-01,B,N,L,MVP
MED-OPP-01,Medication,Pharmacy,Outpatient/retail pharmacy POS with batch/expiry + e-Rx receipt,04;05,GST;ZATCA,ALL,ERP-INV-01,B,N,M,MVP
MED-MAR-01,Medication,Administration,eMAR: schedules; PRN reassessment; independent double-check; titrations,03;04,EMRAM-S3;JCI-MMU,ALL,MED-PHV-01,B,N,L,MVP
MED-BCM-01,Medication,Administration,Mobile BCMA (patient+med scan); override reasons; compliance dashboards; offline cache,03;04;07,Leapfrog-BCMA;EMRAM-S6;JCI-IPSG.1;China-L6,ALL,MED-MAR-01;PLT-UX-02,B,N,L,MVP
MED-INF-01,Medication,Administration,Infusion data model + pump-channel association + manual rate/volume validation,03;04;14,ISMP,ALL,MED-MAR-01,B,N,M,MVP
MED-INF-02,Medication,Administration,Smart-pump interoperability (PIV/IPEC) via first vendor gateway,04;14,ISMP;EMRAM-S6,ALL,MED-INF-01;DEV-GW-01,I,C,L,P2
MED-ADC-01,Medication,Pharmacy,ADC/robot interfaces + override policy,04,NPG.14.01.01,ALL,MED-PHV-01,I,N,M,P2
MED-CS-01,Medication,Pharmacy,Controlled-substance registers + reconciliation (NDPS/SFDA/MOHAP),04,NDPS;SFDA,IN;SA;AE,MED-DSP-01,B,N,M,MVP
MED-ONC-01,Medication,Specialty meds,Chemotherapy regimens; BSA dosing; dual verification,03;04,ASCO-ONS,ALL,MED-PHV-01,B,C,L,P2
MED-IV-01,Medication,Specialty meds,IV compounding/TPN workflow + IV workflow system interfaces,04,ISMP;USP797,ALL,MED-PHV-01,B+I,N,M,P3
MED-ERX-01,Medication,e-Prescribing,National e-Rx: Wasfaty (SA); Riayati/NABIDH (AE); ABDM e-Rx (IN),04;06,MoH;ABDM,IN;SA;AE,CLN-ORD-02,B,N,M,P2
DX-ORD-01,Diagnostics,Shared,Shared diagnostic order lifecycle (order>specimen/exam>result>ack),04,SAFER;China-L6,ALL,CLN-ORD-02,B,N,L,MVP
DX-CRT-01,Diagnostics,Shared,Closed-loop critical result service (named recipient; read-back; escalation),04,NPG.01.02.01;JCI-IPSG.2;NABH-AAC;CAP,ALL,DX-ORD-01,B,N,M,MVP
DX-LAB-01,Diagnostics,LIS,Phlebotomy worklists; bedside specimen labels; accessioning; tracking,04,NPG.01.01.01;ISO15189;EMRAM-S6,ALL,DX-ORD-01;PLT-UX-02,B,N,L,MVP
DX-LAB-02,Diagnostics,LIS,Analyzer connectivity: middleware + direct ASTM/HL7 drivers; LAW-ready,04;06;14,RFP,ALL,DX-LAB-01,B+I,N,L,MVP
DX-LAB-03,Diagnostics,LIS,Result entry/validation; autoverification v1; delta/critical rules; reports,04,ISO15189;NABL,ALL,PLT-CORE-06;DX-LAB-02,B,C,L,MVP
DX-LAB-04,Diagnostics,LIS,QC (Levey-Jennings/Westgard) + reagent/lot tracking,04,ISO15189;NABL;CBAHI,ALL,DX-LAB-02,B,N,M,MVP
DX-LAB-05,Diagnostics,LIS,Send-out tests + reference-lab interfaces,04,-,ALL,DX-LAB-01,B,N,M,MVP
DX-LAB-06,Diagnostics,LIS,ISO 15189:2022 document control + risk register,04,ISO15189,ALL,-,B,N,M,P3
DX-MIC-01,Diagnostics,LIS,Microbiology: culture workup; AST; cascade reporting; antibiogram; WHONET export,04,NABH-HIC;JCI-PCI,ALL,DX-LAB-03,B,N,L,P2
DX-AP-01,Diagnostics,LIS,Anatomic pathology workflow + synoptic reporting,04,CAP,ALL,DX-LAB-01,B,N,L,P3
DX-POC-01,Diagnostics,LIS,POCT data-manager integration,04,ISO15189,ALL,DX-ORD-01,I,N,M,P2
DX-RIS-01,Diagnostics,RIS,RIS core: orders; scheduling; protocoling; MWL/MPPS broker; tracking,04,EMRAM-S1,ALL,DX-ORD-01,B,N,L,MVP
DX-RIS-02,Diagnostics,RIS,Report templates; structured reports; actionable-finding follow-up,04,NPG.01.02.01,ALL,DX-RIS-01;DX-CRT-01,B,N,M,MVP
DX-RIS-03,Diagnostics,RIS,Radiation dose capture (RDSR) + exceedance review,04,NPG-Goal13;AERB,ALL,DX-RIS-01,B,N,M,P2
DX-PAC-01,Diagnostics,Imaging,PACS/VNA integration (DICOMweb + IID launch); bundled OSS PACS tier,04;02,EMRAM-S1,ALL,DX-RIS-01,I,N,M,MVP
DX-CRD-01,Diagnostics,Imaging,ECG/cardiology + endoscopy report integration,04,-,ALL,DX-ORD-01,I,N,M,P2
DX-BB-01,Diagnostics,Transfusion,Bedside transfusion verification (BCMA extension); orders; consent; reactions,03;04,EMRAM-S6;JCI-COP;NABH-COP;China-L6,ALL,MED-BCM-01,B,C,M,MVP
DX-BB-02,Diagnostics,Transfusion,Blood bank interface (e-RaktKosh/third-party/cleared BECS),04;07,-,ALL,DX-BB-01,I,N,M,MVP
DX-BB-03,Diagnostics,Transfusion,Native blood centre: donors; components; ISBT 128; crossmatch; inventory; issue,04,NABH;CDSCO;SFDA;AABB,IN;SA;AE,DX-BB-01;TRU-REG-01,B,Y,XL,P2
DEV-GW-01,Devices,Integration,Device gateway via middleware (PCD-01/DEC) + device-patient association,04,EMRAM-S6,ALL,-,B+I,N,L,MVP
DEV-VAL-01,Devices,Integration,Nurse validation UX for auto-captured vitals + artifact marking,04,-,ALL,DEV-GW-01,B,N,M,MVP
DEV-ALM-01,Devices,Alarms,Alarm analytics via ACM-capable platform,04,NPG.01.05.01,ALL,DEV-GW-01,I,Y,M,P3
DEV-SDC-01,Devices,Integration,ISO/IEEE 11073 SDC/IHE SDPi plug-and-play,04,-,ALL,DEV-GW-01,B,C,L,P3
SPC-OT-01,Specialty,Perioperative,OT booking/scheduling + list management,03;05;14,JCI-ASC;NABH-COP,ALL,ACC-SCH-01,B,N,M,MVP
SPC-OT-02,Specialty,Perioperative,WHO surgical safety checklist; consent; site marking; pre-op checklist,03,WHO-SSC;JCI-IPSG.4;NABH-COP,ALL,SPC-OT-01,B,N,S,MVP
SPC-OT-03,Specialty,Perioperative,Intra-op nursing record; counts; implants/consumables to charge+stock; op note,03;05,JCI-ASC;NABH-COP,ALL,SPC-OT-01;ERP-INV-01,B,N,M,MVP
SPC-AN-01,Specialty,Perioperative,Anaesthesia pre-assessment + intra-op/PACU record (manual/semi-auto vitals),03,JCI-ASC;NABH-COP,ALL,SPC-OT-01,B,N,M,MVP
SPC-AN-02,Specialty,Perioperative,Full AIMS with anaesthesia machine/monitor feed,03;04,EMRAM-S6,ALL,DEV-GW-01;SPC-AN-01,B,C,L,P2
SPC-OT-04,Specialty,Perioperative,OR analytics: utilisation; turnover; first-case on-time,05,-,ALL,SPC-OT-01,B,N,M,P2
SPC-ICU-01,Specialty,Critical care,ICU flowsheet (q1h); fluid balance; drips; ventilator settings; bundles,03,NABH-COP;JCI-COP,ALL,NUR-FLW-01;DEV-GW-01,B,N,L,MVP
SPC-ICU-02,Specialty,Critical care,ICU severity scores (APACHE II/SOFA),03,-,ALL,SPC-ICU-01,B,C,S,P2
SPC-ICU-03,Specialty,Critical care,Tele-ICU,03;14,-,ALL,SPC-ICU-01,B+P,N,L,P3
SPC-MAT-01,Specialty,Maternity,Labour & delivery record + newborn registration + mother-baby link + birth notification,03;14,NABH-COP;statutory birth reg,ALL,ACC-ID-03,B,N,M,MVP
SPC-MAT-02,Specialty,Maternity,Antenatal episode; WHO LCG partograph; fetal monitoring,03,WHO-LCG,ALL,SPC-MAT-01,B,N,L,P2
SPC-NIC-01,Specialty,Maternity,NICU flowsheets; feeds; human-milk tracking,03,EMRAM-S6,ALL,SPC-MAT-01,B,N,M,P2
SPC-ONC-01,Specialty,Oncology,Oncology regimens; cycles; staging (with MED-ONC-01),03,ASCO-ONS,ALL,MED-ONC-01,B,N,L,P2
SPC-DIE-01,Specialty,Allied,Diet orders with allergy logic + tray tickets,04,NABH-COP,ALL,CLN-ORD-02,B,N,S,MVP
SPC-REH-01,Specialty,Allied,Rehab/physio/dietitian documentation + scheduling,04,-,ALL,PLT-CFG-03,B,N,M,P2
SPC-DIA-01,Specialty,Allied,Dialysis documentation + machine integration,03;04,-,ALL,DEV-GW-01,B,N,M,P3
SPC-OTH-01,Specialty,Specialty kits,Ophthalmology/dental/cath/endoscopy kits on shared framework,03,-,ALL,PLT-CFG-03,B+P,N,L,P3
SPC-DTH-01,Specialty,Statutory,Death certificate (MCCD/national forms) + mortuary register,14,NABH;statutory,ALL,-,B,N,S,MVP
RCM-ACC-01,Revenue,Patient accounting,Single patient financial account + append-only ledger,05;11,-,ALL,PLT-CORE-01,B,N,XL,MVP
RCM-CHG-01,Revenue,Patient accounting,Charge router from clinical events (orders/admin/bed-days/supplies),05;11,-,ALL,RCM-ACC-01;PLT-CORE-04,B,N,L,MVP
RCM-TAR-01,Revenue,Pricing,Tariff engine: price lists; room categories; packages; effective dating,05,-,ALL,RCM-ACC-01,B,N,L,MVP
RCM-CSH-01,Revenue,Self-pay,Deposits; interim bills; approved discounts; refunds; cashier shifts; UPI/mada/card,05,-,ALL,RCM-ACC-01,B,N,L,MVP
RCM-TAX-01,Revenue,Tax,Tax engine + e-invoicing (GST; ZATCA Fatoora; UAE VAT),05,ZATCA;GST,IN;SA;AE,RCM-ACC-01,B,N,M,MVP
RCM-INS-01,Revenue,Insurance,Payer/contract rules; eligibility; pre-auth; claims with attachments,05,IRDAI-1h/3h;CHI,ALL,RCM-TAR-01,B,N,L,MVP
RCM-NAT-01,Revenue,National claims,NPHIES adapter (eligibility; prior auth; claims; payment reconciliation),05;06,CHI-NPHIES,SA,RCM-INS-01,B,N,L,MVP
RCM-NAT-02,Revenue,National claims,NHCX + PM-JAY TMS + TPA portal workflows,05;06,IRDAI;NHA,IN,RCM-INS-01,B,N,L,MVP
RCM-NAT-03,Revenue,National claims,Shafafiya (DoH) + eClaimLink (DHA) XML adapters,05,DoH;DHA,AE,RCM-INS-01,B,N,M,MVP
RCM-COD-01,Revenue,Coding,Coding workbench (ICD-10-AM/SBS; ICD-10; CPT) + CDI worklists,05,CHI;DoH,ALL,CLN-DOC-03,B,N,M,MVP
RCM-DEN-01,Revenue,Insurance,Rejection/denial work queues; resubmission; payer aging,05,-,ALL,RCM-INS-01,B,N,M,MVP
RCM-SCH-01,Revenue,Insurance,Government scheme + corporate credit billing (CGHS/ECHS/corporates),05,-,IN;SA;AE,RCM-INS-01,B,N,M,MVP
RCM-GRP-01,Revenue,Coding,Grouper SPI (AR-DRG shadow billing; IR-DRG),05,CHI;DoH;DHA,SA;AE,RCM-COD-01,I,N,M,P2
RCM-AI-01,Revenue,Coding,AI coding suggestions with confidence routing,05;09,-,ALL,RCM-COD-01;AI-GW-01,P,N,M,P2
RCM-CST-01,Revenue,Costing,Patient-level costing (TDABC/PLICS),05,-,ALL,ERP-INV-01;RCM-CHG-01,B,N,L,P3
RCM-US-01,Revenue,US RCM,X12 837/835; Da Vinci CRD/DTR/PAS; price transparency,05,CMS-0057-F,US,RCM-INS-01,B+I,N,XL,P3
ERP-INV-01,ERP,Supply chain,Item master; stores; batch/expiry FEFO; indents; ward stock; consumption-to-charge,05,NABH-MOM;JCI-MMU,ALL,-,B,N,L,MVP
ERP-PRC-01,ERP,Supply chain,Procurement lite: PR>PO>GRN>3-way match; vendor master,05;14,-,ALL,ERP-INV-01,B,N,M,MVP
ERP-FIN-01,ERP,Finance,AP/AR + GL journal posting/export (Tally/Zoho/SAP B1/Odoo/Dynamics),05,-,ALL,RCM-ACC-01,B+I,N,M,MVP
ERP-FIN-02,ERP,Finance,Native lite GL (multi-entity; multi-currency) + fixed assets,05,-,IN;SA;AE,ERP-FIN-01,B,N,L,P2
ERP-FIN-03,ERP,Finance,Enterprise ERP connectors (SAP S/4; Oracle Fusion; Workday; Dynamics),05,-,ALL,ERP-FIN-01,I,N,M,P2
ERP-IMP-01,ERP,Supply chain,Implant/UDI capture; consignment; recall trace,05;04,-,ALL,ERP-INV-01,B,N,M,P2
ERP-HTM-01,ERP,Assets,Biomedical CMMS: asset register; PM; work orders,05,NABH-FMS;JCI-FMS,ALL,-,B,N,M,P2
ERP-HR-01,ERP,Workforce,Staff master + credentialing/privileging records,05,NABH-HRM;JCI-SQE;CBAHI,ALL,TRU-IAM-02,B,N,M,MVP
ERP-HR-02,ERP,Workforce,HR/payroll/attendance via local payroll integration,05,-,ALL,ERP-HR-01,I,N,M,P2
ERP-ROS-01,ERP,Workforce,Basic rostering + acuity staffing,05,NPG-12,ALL,ERP-HR-01,B,N,M,P2
ERP-SVC-01,ERP,Support services,CSSD tracking; linen; housekeeping/BMW; diet kitchen,04;05;14,NABH-HIC;BMW-Rules,IN;SA;AE,ERP-INV-01,B,N,M,P2
OPS-FLW-01,Operations,Patient flow,Discharge clearance (non-blocking) + expected discharge date + discharge tasks,05;03,-,ALL,ACC-ADT-02,B,N,M,MVP
OPS-CMD-01,Operations,Command centre,Capacity command-centre data layer + tiles,05,-,ALL,AI-DAT-02,B,N,L,P2
OPS-PRD-01,Operations,Command centre,Predictive discharge/census forecasting,05;09,-,ALL,OPS-CMD-01,B,N,M,P3
OPS-MIS-01,Operations,MIS,MIS dashboards: revenue; collections; payer mix; occupancy/ALOS; TAT,05,NABH;JAWDA,ALL,AI-DAT-01,B,N,M,MVP
OPS-STAT-01,Operations,MIS,Statutory returns (HMIS/DHIS2; MoH statistics; notifiable disease),05;06,IDSP;MoH,IN;SA;AE,OPS-MIS-01,B,N,M,MVP
OPS-RTL-01,Operations,Patient flow,RTLS integration (location events),05,-,ALL,-,I,N,M,P3
INT-ENG-01,Interop,Engine,HL7 v2 engine (MLLP/TLS); ack-state visibility; replay; owned queues,06;08,-,ALL,PLT-CORE-04,B+I,N,L,MVP
INT-FHIR-01,Interop,APIs,FHIR R4 facade (IPA; SMART 2.x; Bulk; Subscriptions),06;08,ABDM;NPHIES,ALL,PLT-CORE-01,B+I,N,L,MVP
INT-DOC-01,Interop,Documents,PDF/A + CDA/FHIR Document generation from one source,06,-,ALL,-,B,N,M,MVP
INT-ABDM-01,Interop,National,ABDM M1/M2/M3 (V3 APIs; NRCeS bundles),06;14,ABDM;NABH-DHS;RFP,IN,INT-FHIR-01;TRU-PRV-02,B,N,L,MVP
INT-SEHE-01,Interop,National,Saudi SeHE HIE connectivity,06;14,MoH;BlackBook gate,SA,INT-FHIR-01,B,N,M,MVP
INT-UAE-01,Interop,National,Malaffi/NABIDH/Riayati adapters (v2/CDA/FHIR/IHE XDS-PIX-PDQ),06,DoH;DHA;MOHAP,AE,INT-ENG-01,B,N,L,MVP
INT-IPS-01,Interop,Documents,IPS $summary generation,06,EHDS,ALL,INT-FHIR-01,B,N,M,P2
INT-PH-01,Interop,National,Public-health reporting (IHIP/IDSP; HESN),06,-,IN;SA;AE,INT-ENG-01,B,N,M,P2
INT-OEHR-01,Interop,Europe,openEHR CDR adapter (EHRbase),02;06,-,EU,INT-FHIR-01,I,N,M,P3
INT-EU-01,Interop,Europe,EHDS interoperability + logging components (EEHRxF; CE self-cert),06;07,EHDS,EU,INT-IPS-01;TRU-AUD-02,B,N,XL,P3
INT-US-01,Interop,US,ONC (b)(10)/(g)(10) + TEFCA via partner,06,ONC,US,INT-FHIR-01,B+P,N,XL,P3
AI-GW-01,AI & data,AI platform,AI gateway: in-country model routing; prompt mgmt; evaluation; kill switch,09;08,SAFER-HPP;AI-Act,ALL,PLT-OPS-01,B,N,L,MVP
AI-GOV-01,AI & data,AI platform,AI control plane: registry; model cards; provenance; draft states; monitoring; AI safety events,09;07,JC-RUAIH;HTI-1;AI-Act,ALL,AI-GW-01,B,N,L,MVP
AI-AMB-01,AI & data,Clinician AI,Ambient OPD documentation (EN/AR/HI) via >=2 partners,09,-,ALL,AI-GOV-01;CLN-DOC-01,P,N,M,MVP
AI-DCS-01,AI & data,Clinician AI,Source-linked discharge summary draft with clinician sign-off,09,-,ALL,AI-GOV-01;CLN-DOC-03,B,N,M,MVP
AI-SUM-01,AI & data,Clinician AI,Source-cited chart summary / pre-visit brief,09,-,ALL,AI-GOV-01,B,N,M,P2
AI-NUR-01,AI & data,Clinician AI,Nursing voice/ambient to flowsheets,09,-,ALL,NUR-FLW-01;AI-GOV-01,P,N,M,P2
AI-RCM-01,AI & data,Operational AI,Claim pre-submission scrubbing + denial prediction,09;05,-,ALL,RCM-DEN-01,B,N,M,P2
AI-PAT-01,AI & data,Patient AI,Patient-friendly result explanations (templated then AI),09,-,ALL,DFD-REC-01,B,N,S,P2
AI-INB-01,AI & data,Clinician AI,In-basket triage + grounded draft replies,09,-,ALL,DFD-APP-01,B,N,M,P3
AI-IMG-01,AI & data,Imaging AI,Imaging AI orchestration (AIW-I/AIR) + governance ledger,04;09,-,ALL,DX-RIS-02,I,Y,M,P3
AI-DAT-01,AI & data,Data platform,Operational reporting replica (<=60 s) + report builder,08;09,EMRAM-S7;AMAM,ALL,PLT-CORE-04,B,N,M,MVP
AI-DAT-02,AI & data,Data platform,CDC lakehouse (Iceberg) + OMOP/SQL-on-FHIR views,08;09,AMAM,ALL,AI-DAT-01,B,N,L,P2
DFD-MSG-01,Front door,Engagement,SMS/WhatsApp reminders + outreach without an account,09,-,ALL,ACC-SCH-01,B+I,N,M,MVP
DFD-BOK-01,Front door,Engagement,Web booking link + rules-based self-scheduling,09,-,ALL,ACC-SCH-01,B,N,M,MVP
DFD-PAY-01,Front door,Engagement,Payment links + bill pay (UPI/mada/cards),09;05,-,ALL,RCM-CSH-01,B+I,N,M,MVP
DFD-REC-01,Front door,Engagement,Report download + national PHR push (ABHA app; Sehhaty where available),09;06,ABDM,IN;SA;AE,INT-ABDM-01,B,N,M,MVP
DFD-APP-01,Front door,Portal,Full portal/app: records; messaging; proxy; refills; questionnaires,09,-,ALL,DFD-MSG-01,B,N,XL,P2
DFD-TEL-01,Front door,Virtual care,Teleconsultation (video) with booking and billing,09;14,-,ALL,ACC-SCH-01,B+I,N,M,P2
DFD-CRM-01,Front door,Engagement,CRM/contact centre; leads; international patient desk,05;09,-,IN;SA;AE,-,B,N,M,P2
DFD-RPM-01,Front door,Virtual care,RPM / hospital-at-home,09,-,ALL,DFD-APP-01,B+P,N,L,P3
IMP-FND-01,Implementation,Content,Foundation content packs per country (order sets/flowsheets/templates/CDS/roles/reports/charge masters),10;08,NABH;CBAHI;JCI,ALL,PLT-CFG-01,B,N,XL,MVP
IMP-MIG-01,Implementation,Migration,Data migration toolkit + legacy archive viewer,10,-,ALL,-,B,N,L,MVP
IMP-RDY-01,Implementation,Go-live,Readiness scorecard + cutover/rehearsal tooling + rollback triggers,10,KLAS-Operations,ALL,-,B,N,M,MVP
IMP-TRN-01,Implementation,Training,Training sandbox; micro-learning; proficiency tracking,10,KLAS-Operations;RFP training SLA,ALL,-,B,N,M,MVP
IMP-TEL-01,Implementation,Telemetry,Clinician-time + usability telemetry + embedded micro-surveys,10,KLAS-NEES,ALL,PLT-OPS-05,B,N,M,MVP
IMP-SUP-01,Implementation,Support,Service desk integration; ticket telemetry; independent status page,07;10,RFP SLA;KLAS-Relationship,ALL,-,B+I,N,S,MVP
IMP-GOV-01,Implementation,Governance,Governance intake portal (requests; scoring; 30-day loop closure),10,KLAS-NEES,ALL,-,B,N,S,P2
IMP-MAT-01,Implementation,Maturity,Maturity readiness report (EMRAM thresholds) + accreditation evidence packs,10;07,EMRAM;NABH;CBAHI,ALL,AI-DAT-01,B,N,M,P2
IMP-CRT-01,Implementation,Partners,Analyst/partner certification academy,10;01,-,ALL,IMP-TRN-01,B,N,M,P2
```

---

## Sources

1. RajCOMP Info Services Ltd (RISL), "RFP for Design, Development, Implementation & Maintenance of IHMS 2.0", final RFP, 9 Sep 2024 (361 pp.; eligibility §4/§5.14, evaluation §5.14–5.18, timelines and payments p. 55–57, SLAs §7.3 p. 103–107, IPR clause p. 89). https://risl.rajasthan.gov.in/tenders/pdf/Final_RFP_IHMS20_09092024.pdf
2. DoIT&C Rajasthan, Tender Details id=1072 (RFP, corrigenda 1–5, and an "Office Order regarding Cancellation of RFP" uploaded 23 Jan 2025) [search listing]. https://doitc.rajasthan.gov.in/TenderDetails.aspx?id=1072
3. KLAS Research, "Middle East & Africa EHR 2024: A Look into Vendors' Broader Portfolios". https://klasresearch.com/report/middle-east-and-africa-ehr-2024-a-look-into-vendors-broader-portfolios/3084
4. KLAS Research, "Middle East Summit 2026: Advancing Healthcare Excellence Through IT". https://klasresearch.com/report/middle-east-summit-2026-advancing-healthcare-excellence-through-it/3984
5. Black Book Research via Newswire, "Saudi Arabia Ranks No. 1 Among Next-Wave EHR Markets as National Buying Cycle Accelerates" (30 Jul 2026). https://www.newswire.com/news/saudi-arabia-ranks-no-1-among-next-wave-ehr-markets-as-national-buying-22835899
6. HIT Consultant, "KLAS Releases Global Hospital EHR Market Share 2026 Report" (8 Jul 2026). https://hitconsultant.net/2026/07/08/klas-global-hospital-ehr-market-share-2026/
7. KLAS Research, "Global Hospital EHR Market Share 2026" (via doc 01 [45]). https://klasresearch.com/report/global-hospital-ehr-market-share-2026-purchasing-decisions-drop-to-almost-five-year-low/3955
8. KLAS Arch Collaborative (NEES scale, averages, Pinnacle thresholds). https://engage.klasresearch.com/klas-arch-collaborative/
9. Indica Labs, press release listing the KLAS pillar indicators (2026) [search extract]. https://indicalab.com/news/press-release/halo-ap-earned-top-scores/
10. KLAS, Best in KLAS 2024 report (methodology: 16 numeric and 4 yes/no questions, equally weighted; 13-month window) [search extract]. https://www.performancehealthus.com/hubfs/Best%20in%20KLAS%20Report%202024.pdf
11. The Access Group, "NHS Digital Capabilities Framework". https://www.theaccessgroup.com/en-gb/blog/hsc-nhs-dcf/
12. Find a Tender, NHS England Frontline Digitisation notice 034431-2024 [search extract]. https://www.find-tender.service.gov.uk/Notice/034431-2024
13. Find a Tender, notice 032216-2025 (price 40 / social value 10 example) [search extract]. https://www.find-tender.service.gov.uk/Notice/032216-2025
14. Find a Tender, NHS Workforce Alliance notice 037372-2025 (quality 60 / price 30 / social value 10) [search extract]. https://www.find-tender.service.gov.uk/Notice/037372-2025
15. HPFT EPR call-off, LPP CDS-IHE framework [search extract]. https://d3tenders.com/contract/?ocid=ocds-b5fd17-16f894e8-7303-4d4c-8140-de4294de02b4
16. Whittington Health PAS/EPR contract extension [search extract]. https://d3tenders.com/contract/?ocid=ocds-h6vhtk-04ef35
17. SVT, "Klart: VGR säger upp Millennium" (Aug 2026) [search extract]. https://www.svt.se/nyheter/lokalt/vast/klart-vgr-sager-upp-millenium-for-657-miljoner-kronor
18. Infrastrukturnyheter, "Millennium skrotas – VGR betalar 657 miljoner" (27 Aug 2026) [search extract]. https://www.infrastrukturnyheter.se/20260827/33505/millennium-skrotas-vgr-betalar-657-miljoner
19. Health Services Daily, "$100m EOI for WA statewide EMR and PAS project" (3 Apr 2025). https://www.healthservicesdaily.com.au/100m-eoi-for-wa-statewide-emr-and-pas-project/26781
20. techpartner.news, "WA Health completes first stage of Electronic Medical Record program rollout" [search extract]. https://www.techpartner.news/news/wa-health-completes-first-stage-of-electronic-medical-record-program-rollout-620089
21. Tasmania Department of Health, "Tasmania on track to deliver epic health transformation" [search extract; HTTP 403 on fetch]. https://www.health.tas.gov.au/news-sajari/news/tasmania-track-deliver-epic-health-transformation
22. Pulse+IT, "Tasmania begins next phase of digital health transformation" (Sep 2026) [search extract]. https://www.pulseit.news/australian-digital-health/tasmania-begins-next-phase-of-digital-health-transformation/
23. NABH, certified software listing: KareXpert Technologies (Advanced; HIS and EMR certificates to May 2028; OE tables). https://nabh.co/software/karexpert-technologies/
24. NABH, Digital Health Standards (HIS/EMR standard and test cases, 1st ed.). https://nabh.co/digital-health-standards/
25. KareXpert, home page. https://www.karexpert.com/
26. Insta by Practo, home page. https://www.instahms.com/
27. Akhil Systems, home page (Miracle HMIS, Miracle on Cloud, Miracle LIS/RIS, Augastam). https://www.akhilsystems.com/
28. Athma, home page. https://athma.health/
29. Avelios Medical, home page. https://www.avelios.com/en
30. Commure, home page. https://www.commure.com/
31. Akido Labs, home page. https://www.akidolabs.com/
32. Canvas Medical, home page. https://www.canvasmedical.com/
33. Elation Health, home page. https://www.elationhealth.com/
34. InterSystems, IntelliCare product page. https://www.intersystems.com/products/intellicare/
35. Medplum, "MediMind: An AI-Native Hospital System" (case study). https://www.medplum.com/blog/medimind-case-study
36. MediMind, "The AI-Native Hospital OS" [search extract]. https://medimind.md/
37. Adaptive TechSoft (ats), About Us. https://ats-ware.com/about/
38. TradeArabia, "Saudi hospitals implement advanced CareWare system by ats" [search extract]. https://tradearabia.com/News/329880/Saudi-hospitals-implement-advanced-CareWare-system-by-ats
39. IQVIA, Hospital Information System (Middle East & Africa). https://www.iqvia.com/locations/middle-east-and-africa/solutions/provider-solutions/hospital-information-system
40. W3C, Web Content Accessibility Guidelines (WCAG) 2.2, W3C Recommendation (12 Dec 2024 edition). https://www.w3.org/TR/WCAG22/
41. Altus, "A Strategic Road Map to Achieve EMRAM Stage 6 or 7" (2022 criteria summary). https://www.altus-inc.com/insight/blog/strategic-road-map-to-achieve-emram-stage-6-or-7
42. South Florida HIMSS chapter, HIMSS Analytics Stage 7 overview deck (legacy thresholds) [search extract; also doc 03 [15]]. https://southflorida.himss.org/sites/hde/files/2024-03/himss-stage-7.pdf
43. Malay Mail, "IJN becomes Malaysia's first hospital to achieve HIMSS EMRAM Stage 7 validation" (6 Mar 2026) [headline only; HTTP 403]. https://www.malaymail.com/news/malaysia/2026/03/06/ijn-becomes-malaysias-first-hospital-to-achieve-himss-emram-stage-7-validation/211602
44. The Leapfrog Group, Guidance for the 2026 CPOE Evaluation Tool (v5.3) (via doc 03 [10]). https://www.leapfroggroup.org/sites/default/files/Files/CPOE%20Tool%20Guidance%202026.pdf
45. The Leapfrog Group, BCMA Fact Sheet and 2026 Safe Medication Administration measure (via doc 04 [102]). https://ratings.leapfroggroup.org/sites/default/files/2024-03/2024%20BCMA%20Fact%20Sheet.pdf
46. NHC General Office, 国卫办医函〔2018〕1079号 (EMR application-level grading; reprint). https://www.waizi.org.cn/doc/49207.html
47. FDA, "Clinical Decision Support Software" guidance (29 Jan 2026) (via doc 07 [42]). https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software
48. Oracle, "Oracle Ushers in New Era of AI-Driven Electronic Health Records" (13 Aug 2025) (via doc 01 [15]). https://www.oracle.com/news/announcement/oracle-ushers-in-new-era-of-ai-driven-electronic-health-records-2025-08-13/
49. Oracle, "ONC Certification of Oracle's AI-Powered EHR Marks Turning Point" (18 Nov 2025) (via doc 01 [17]). https://www.oracle.com/news/announcement/onc-certification-oracle-ehr-marks-turning-point-for-healthcare-industry-2025-11-18/
50. Healthcare Dive, "Oracle launches AI-driven patient portal" (Aug 2026) (via doc 01 [18]). https://www.healthcaredive.com/news/Oracle-launches-AI-driven-patient-portal/827656/
51. HIT Consultant, "Oracle Health Clinical AI Agent for Nurses Expands Inpatient EHR Automation" (14 Sep 2026) (via doc 01 [19]). https://hitconsultant.net/2026/09/14/oracle-health-launches-clinical-ai-agent-for-nurses-inpatient-ehr-documentation/
52. Korea Biomedical Review, "ezCaretech signs $6.9 million next-generation HIS deal with Saudi healthcare group Care Med" (2026) (via doc 01 [93]). https://www.koreabiomed.com/news/articleView.html?idxno=32612
53. Oracle, "Alrajhi Medicine to Digitize its Healthcare Operations with Oracle" (27 Jan 2026) (via doc 01 [90]). https://www.oracle.com/news/announcement/alrajhi-medicine-to-digitize-its-healthcare-operations-with-oracle-2026-01-27/

**Open verification items:**
- Rajasthan iHMS 2.0 re-issue status after the January 2025 cancellation.
- Names and vendors of the HHC cluster HIS awards since 2023.
- NABH's full certified-software list and level definitions.
- The official HIMSS EMRAM 2022 criteria thresholds.
- Balsam/OASIS and Aosta product details (sites unreachable).
- The WA Health stage-2 EMR vendor and the Tasmania contract signature.
- Health NZ's Shared Digital Health Records scope (search extract only, no source retained).
