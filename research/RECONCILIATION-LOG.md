# Reconciliation Log: Cross-Report Contradictions

**Date:** 2026-10-16
**Scope:** 20 contradictions that a critic found across reports 01–11 in this research pack.

**Method.** For each contradiction:
1. Read the conflicting passages.
2. Re-verified time-sensitive facts against primary or official sources by direct fetch. Four web searches were used, out of a shared budget of 10.
3. Chose either the correct fact or the best-reasoned position.
4. Edited every affected report.

Each change carries an inline "(reconciled 2026-10-16: …)" note. Strategic tensions get a "Cross-report note" in each affected file rather than a silent rewrite. New sources were appended to each edited file's Sources list.

**Status key:**
- **Resolved:** a fact was corrected, or one position was adopted pack-wide.
- **Interim:** a position was adopted pending a proposed follow-up report: 12 (business plan / critical path), 14 (requirements catalogue), the QMS/regulatory report, or the beachhead-market report.

---

## Summary table

| # | Topic | Resolution (one line) | Status | Files edited |
|---|---|---|---|---|
| 1 | Core data architecture | `06`/`08`/`11` posture adopted for ADR-001: domain-owned Postgres core (DB per tenant), FHIR-shaped JSONB facts, generated FHIR R4 façade, HAPI libraries. Medplum is a reference design and optional component source. A 6–8 week spike gates the ADR | Resolved (spike-gated) | 02, 06, 08, 09, 10, 11 |
| 2 | FHIR finance/supply resources as canonical | FHIR names are naming guidance / edge projection only. The external financial API uses R6-core resources plus national IGs. `InventoryItem` corrected to R5 FMM 0, out of R6 core | Resolved | 02, 05, 06, 11 |
| 3 | ERP scope | The `05` §9.1 split is canonical. Native clinical-operational ERP; integrate payroll/HCM, enterprise GL and full P2P | Resolved | 01, 02, 05, 11 |
| 4 | MVP module scope | Interim "minimum viable hospital" (100–300-bed private multispecialty, India/KSA): native clinical-pathology LIS + RIS, OPD token queue, basic patient app, OT scheduling + basic intra-op record in MVP. Micro, AP and blood bank interfaced. AIMS and pumps in P2 unless a design partner requires them | Interim (report 14) | 01, 03, 04, 05, 09 |
| 5 | Blood bank | v1 in all markets: bedside verification in BCMA + HL7 interface. Native ISBT 128 later, non-US only, after the QMS exists | Resolved (per-market determination pending) | 03, 04, 07 |
| 6 | Early-warning / sepsis | v1: transparent NEWS2/PEWS calculators on nurse-entered vitals, regulated-module versioned, non-US first. Sepsis screening is non-interruptive and rule-based. No device-stream alarms. US uses cleared partners | Interim (QMS/regulatory report) | 03, 07, 08, 09 |
| 7 | Event sourcing | `08` "event sourcing lite" is the standard: bitemporal append-only journal + outbox + CDC. Full event sourcing only for order/MAR, by ADR | Resolved | 03, 08, 09, 11 |
| 8 | Availability / DR targets | `08` §12.6 is the single NFR table. 99.95% contractual write SLA and 99.99% internal SLO; reads 99.99%. In-region RPO 0, RTO ≤5 min engineering / ≤15 min contractual. Cross-region ≤5 min / ≤60 min. T0 cyber-recovery ≤72 h | Resolved | 07, 08, 10 |
| 9 | Market sequencing | One roadmap: Wave 1 India + KSA; Wave 1b UAE; Wave 2 one of Indonesia/Kenya/SE Asia, DACH via partner only; US a Phase 3 go/no-go. ONC/HITRUST/Da Vinci moved to Phase 3, with ONC retargeted to the 19 criteria HTI-5 retains. NABH/JCI/CBAHI/DoH are the primary accreditation trace | Resolved | 01, 03, 05, 06, 07, 09 |
| 10 | Go-live timelines | "6–12 months" restated as a mature-product target for <150 beds. First design-partner go-live is realistically M18–24+, set by the report-12 critical-path plan, not by `07` | Interim (report 12) | 01, 03, 05, 07, 10 |
| 11 | Within-site rollout | Big bang per site; first site a non-flagship design partner; unit piloting only as a pre-production "model unit" or dress rehearsal | Resolved | 03, 10 |
| 12 | Interface engine | `08` hybrid adopted: native Integration Hub owns the interfaces; OIE or the customer engine is optional for site transforms, under a patch-lag policy | Resolved | 02, 06, 08 |
| 13 | FHIR R6 ballot status | `08` corrected: ballot 5 is the 2nd full ballot (17 Jul 2026); CI snapshot1 (15 Oct 2026); another ballot certain; publication expected 2027 | Resolved | 06, 08, 11 |
| 14 | EU AI Act Art. 4 | `07` executive summary fixed: Art. 4 softened by Reg. (EU) 2026/1744; Art. 50 from 2 Aug 2026; Art. 50(2) legacy grace to 2 Dec 2026 | Resolved | 07 (09 already correct) |
| 15 | VA 2026 count / contract | `02`/`08` updated: 11 of 13 live as of 22 Aug 2026; Anchorage/Cleveland 24 Oct 2026; Aug 2026 modification adds three option years and $17B, total just under $27B | Resolved | 02, 08 (01, 10 already correct) |
| 16 | Dubai Health / Salama vendor | Salama is **Epic**, per 2017 contemporary press quoting DHA's IT director. The `01` "Cerner-based" claim was removed. Both docs use the same wording | Resolved (secondary evidence; primary still wanted) | 01, 10 |
| 17 | Epic programme costs | One cost table in `01` §9.2 separates contract / total programme / lost revenue. Helseplattformen: NOK 1.7B is the acquisition estimate, NOK 4.1B the original frame, NOK 6.7B the total to Oct 2024. Apotti marked conflicting (€407M FAQ vs €625M HS). MGB: $1.2B reported vs $1.6B incl. lost revenue | Resolved (Apotti conflicting) | 01, 10 |
| 18 | KFSHRC vendor | Harmonized: Cerner Millennium (now Oracle Health) per 2015 primary evidence, also evidenced 2020–2022; no Epic evidence; not re-confirmed for 2024–2026. Action added for the beachhead-market report | Resolved | 01, 10 |
| 19 | Epic CoMET vs Curiosity | Two generations stated with dates: CoMET/Curiosity v1 (2025 paper, 118M patients) and the UGM-2026 Curiosity (320M patients, 23B encounters). Cross-referenced | Resolved | 01, 09 |
| 20 | InterSystems 600+ hospitals | "InterSystems EHRs (TrakCare/IntelliCare): 600+ hospitals, 29 countries (vendor claim)" used in all three docs | Resolved | 01, 03, 08 |

---

## Detail per contradiction

### 1. Core data architecture: FHIR-native store vs domain-owned model with FHIR as the external contract

**Conflict.**
- `02` (exec #3/#4/#14, §7 lessons 1–2, §9, §10.1) ranked a FHIR-R4-native core first: self-hosted Medplum (TypeScript) or HAPI JPA. It said "never translate at the core".
- `09` §9.1 #2 said "FHIR-first internal API", and `10` §8 said "platform-first (FHIR-native)".
- `06` §7.1, `08` §3.11/§4.6 and `11` §0 recommend a domain-owned model with a FHIR façade. `08` adds Kotlin/JVM and a database per tenant.

**Resolution (ADR-001 posture; spike-gated).**
- Domain aggregates and state machines live in PostgreSQL, one database per tenant.
- Clinical facts are stored as typed, FHIR-shaped JSONB. Their projection is therefore near-identity, which keeps `02`'s valid "no translation smell" point.
- A generated FHIR R4 projection/façade serves reads, `$export`, IPS and Subscriptions. Writes go through domain commands, with a bounded set of FHIR writes translated into commands.
- The HAPI structures, validator and v2 libraries are embedded. The stack is Kotlin/JVM per `08` §12.5.
- Medplum is a reference design and an optional component source (React UI kit, on-prem agent pattern), not the system of record. Its single-database Projects model also conflicts with `08`'s database-per-tenant design.
- The 6–8 week load and safety spike from `02` §10.1 is kept as the gate. It compares Option A (own FHIR-shaped domain + HAPI libraries) with Option B (Medplum or HAPI JPA FHIR-native core) on a 1,000-bed workload, plus order/MAR invariants and R4→R6 mapping cost. If B clearly wins, ADR-001 is revisited.
- `09` and `10` now say "FHIR-first external/partner API".

**Evidence.** The reasoning in `06` §7.1 (R6 churn, transactional invariants, country projections), `08` §4.6 (comparison table) and `11` §0/§11/§12. The R6 incubator list was re-fetched (see #2).

**Files edited.**
- `02`: exec #3, #4, #14; §4.7 ranking reordered; §5.5 verdict; §7 lessons 1–2; §9 rows for clinical data platform and IAM, plus a cross-report note; §10.1 #1–#2.
- `06`: §7.1 cross-report note.
- `08`: §4.6 cross-report note.
- `09`: §0 #15, §9.1 #2 with a cross-report note.
- `10`: §8.
- `11`: §0 cross-report note.

### 2. FHIR financial and supply-chain resources as the canonical model

**Conflict.**
- `05` §7 mapped charge, tariff, package, contract and invoice to FHIR resources. `05` §9.2 rule 2 proposed a "FHIR-native financial API" including ChargeItem, ChargeItemDefinition and Invoice. `05` §3.8 called InventoryItem an R6 resource.
- `02` §9 said to build billing "on FHIR ChargeItem/Account/Invoice/…".
- `06` and `11` said not to adopt these resources as canonical, because R6 moves them out of core.

**Resolution.**
- In `05` §3.8, `InventoryItem` is corrected to **R5, FMM 0, moved out of R6 core**. InventoryReport, SupplyRequest and SupplyDelivery are moved out too.
- The `05` §7 FHIR column and the `02` §9 billing row are relabelled "naming guidance / edge projection only".
- The external financial API is limited to resources that stay in R6 core: Account, Claim, ClaimResponse, Coverage, CoverageEligibilityRequest/Response, ExplanationOfBenefit, PaymentNotice and PaymentReconciliation. National IGs (NPHIES, NHCX, Da Vinci PAS) and X12 sit alongside them.
- The charge master, tariffs, packages, ledger and inventory are internal aggregates, as in `11`.

**Evidence.**
- HL7 FHIR R6 ballot 5 notes, fetched 2026-10-16. "R6 Ballot (2nd Full Ballot)". The incubator list includes ChargeItem, ChargeItemDefinition, Invoice, Contract, InsurancePlan, InventoryItem, InventoryReport, SupplyRequest and SupplyDelivery. https://hl7.org/fhir/6.0.0-ballot5/ballot-intro.html
- HL7 FHIR R5 resource list, fetched 2026-10-16: InventoryItem 0, InventoryReport 0, ChargeItem 1, ChargeItemDefinition 1, Invoice 0, Contract 1, InsurancePlan 0, SupplyRequest 1, SupplyDelivery 1. https://hl7.org/fhir/R5/resourcelist.html

**Files edited.**
- `05`: §3.8; §7 preamble and column header; §9.2 rule 2; Sources 78–80.
- `02`: §9 billing row.
- `06`: §3.2.1 note; Sources 123.
- `11`: §11 note; Sources 25.

### 3. Hospital ERP scope: native vs integrate

**Conflict.**
- `01` §12.2 #4 and §12.5 #2 listed GL, HR/payroll, rostering, assets and procurement as native modules of one data model.
- `02` §9 integrated all general ERP, including assets.
- `05` §9.1 took a middle path.

**Resolution.** The `05` §9.1 split is canonical.
- **Native:** patient ledger, clinical supply chain and point-of-use, pharmacy stores, CMMS, acuity data and basic rostering, plus lite procurement and lite GL/AP/AR for emerging-market tenants.
- **Integrate:** payroll/HCM, enterprise GL and full procure-to-pay where the customer already runs an ERP.
- `01` drops native payroll. `02` makes assets and inventory native.
- The differentiator is now "a clinical-operational ERP natively joined to clinical events", not a full ERP.

**Evidence.** The `05` §9.1 rationale: payroll is regulated and country-specific, mature buyers already own an ERP, and point-of-use is weak in ERPs. `11` §12 is consistent with this split.

**Files edited.**
- `01`: §12.2 #1 and #4; §12.5 #2.
- `02`: exec #14; §9 rows for general ERP and pharmacy/inventory.
- `05`: exec #12; §9.1 cross-report note.
- `11`: §12 cross-report note.

### 4. MVP module scope (LIS/RIS, smart pumps, OPD queue and portal, OR/ICU)

**Conflict.**
- `03` put LIS/RIS as interfaces (native in P3), pumps in P2, OPD queue and portal in P2, and OR/ICU in P2.
- `04` §11 #15 put a native LIS, a native RIS and one-vendor pump interoperability in the MVP sequence.
- `05` treated the OPD queue as core.
- `09` Phase 1 includes the digital front door, and `01` lists a patient app and OR/ICU as must-haves.

**Resolution (interim, until the proposed requirements catalogue, report 14).** Define the "minimum viable hospital" as a 100–300-bed private multispecialty hospital in India/KSA. Its MVP includes:
- a native clinical-pathology LIS and a native RIS, because India/GCC buyers expect a single HIS with lab and radiology;
- microbiology, anatomic pathology and the blood bank as interfaces, going native in P2/P3;
- the OPD token queue;
- a basic patient app with WhatsApp/SMS and national rails;
- OT scheduling and a basic intra-op record, including the WHO checklist.

AIMS, full ICU device-integrated charting and pump interoperability are P2 unless a design partner requires them. `04` §11 #15 is restated: steps 1–5 are MVP, and steps 6–10 are P2/P3.

**Evidence.** A synthesis of `03`, `04`, `05` §4.6/§9.3, `09` §9.2 and `01` §12.2. No new external facts were needed.

**Files edited.**
- `03`: exec #14; §2 phase key and rows 5, 6, 20–25; §21.1 #5, #10, new #15–#16; §21.2 Phase 2.
- `04`: exec #15; §11 #15.
- `01`: §12.2 #2 and #5.
- `05`: §4.6.
- `09`: §9.2 Phase 1 item 7.

### 5. Blood bank and transfusion: build vs integrate in v1

**Conflict.**
- `04` §8.2/§11 said to build the blood bank natively outside the US.
- `07` §9.1 #7/§9.4 said to integrate in v1, with no US-only limit.
- `03` row 22 sat in between: bedside verification plus an interface.

**Resolution.**
- **v1, all markets:** bedside electronic transfusion verification inside BCMA, plus an HL7 interface to an external blood-bank system (a cleared BECS in the US).
- **Later, non-US only:** a native ISBT 128 blood-bank module inside the Regulated Modules track, once the ISO 13485 / IEC 62304 QMS exists.
- Record the per-market regulatory determination first. This is gap 15, carried to the proposed QMS/regulatory report.

**Evidence.** Internal consistency with `07`'s regulated-modules strategy and with `04` §3.5 (BECS is Class II 510(k) in the US; the EU SoHO Regulation applies from 2027). No new external facts were needed.

**Files edited.**
- `03`: §2 row 22.
- `04`: exec #15; §8.2 non-US blood-bank row; §11 #7 and #15 step 9; Sources 109.
- `07`: §9.1 #7; §9.4.

### 6. Early-warning scores, deterioration and sepsis alerting

**Conflict.**
- `03` put NEWS2/PEWS with escalation and sepsis screening rules in CDS v1.
- `07` said time-critical alerts are devices under the FDA's Jan 2026 CDS guidance, and that early-warning products should be integrated in v1.
- `09` put partner-integrated scores in Phase 2.
- `08` treated EWS as potential SaMD.

**Resolution (interim, until the QMS/regulatory report classifies each function per market: FDA, EU MDR Rule 11, SFDA, CDSCO, UAE).**
- v1 ships NEWS2/PEWS as **transparent published-score calculators on nurse-entered or nurse-validated vitals**, with escalation tasks.
- They are versioned in the regulated-module track (IEC 62304) and released first in non-US markets.
- Sepsis screening is non-interruptive and rule-based, and it shows its inputs.
- v1 has no automated continuous alarms from device streams.
- US deployments, and predictive deterioration/sepsis scores everywhere, use cleared partners.

**Evidence.** FDA CDS guidance (Jan 2026) as summarized in `07` §0 #10 and `09` §0 #8. No new fetch was needed.

**Files edited.**
- `03`: exec #8; §8.3; §21.1 #4.
- `07`: exec #10; §9.1 #7; §9.4.
- `08`: exec #14; §14 #10.
- `09`: exec #8; §9.3 #3.

### 7. Event sourcing: full vs "lite"

**Conflict.** `09` recommended an "event-sourced clinical core", and `03` §21.4 promised an "event-sourced clinical timeline". `08` recommends event sourcing "lite". `11` §17 #5 allows "or event sourcing for key aggregates".

**Resolution.**
- The `08` §3.5/§3.11 definition is the standard: current-state tables plus a bitemporal append-only journal in the same transaction. The journal is also the outbox and feeds CDC to the lakehouse.
- Full event sourcing is used only for order/MAR aggregates, by ADR.
- `03` and `09` now say "bitemporal append-only clinical journal with CDC to the lakehouse". This still meets `09`'s real requirement of fresh context for AI.

**Evidence.** The `08` §3.5 trade-offs: complexity, schema evolution, and tension with erasure duties.

**Files edited.**
- `03`: §21.4.
- `08`: §3.5 cross-report note.
- `09`: exec #15; §6.2 diagram and principle 1; §9.1 #1.
- `11`: §17 #5.

### 8. Availability and DR targets

**Conflict.**
- `07` T0: 99.99% availability; in-region RTO ≤15 min and RPO ≤1 min; cross-region ≤1 h / ≤5 min; cyber-recovery ≤72 h.
- `08`: ≥99.95% availability (reads 99.99%); in-region RPO 0 / RTO ≤5 min; cross-region ≤5 min / ≤60 min; ransomware tenant restore ≤24 h.
- `10`: 99.95%.

**Resolution.** `08` §12.6 is the single NFR table.

| Target | Engineering | Contractual |
|---|---|---|
| Write-path availability | 99.99% internal SLO | 99.95% SLA |
| Read and continuity paths | 99.99% | 99.99% |
| In-region RPO / RTO | 0 / ≤5 min | 0 / ≤15 min |
| Cross-region RPO / RTO | ≤5 min / ≤60 min | ≤5 min / ≤60 min |
| Cyber-recovery | Tenant restore ≤24 h | T0 ≤72 h |

`07` §6.3 #1 was also aligned. It now specifies a single writer with a synchronous standby, and active-active only for stateless tiers, per `08` §6.4.

**Evidence.** Internal design reasoning. The HIPAA NPRM's 72-hour restoration figure is already cited in `07`/`08`.

**Files edited.**
- `08`: §6.4 table; §12.6 header note and rows.
- `07`: §6.2 preamble and T0 row; §6.3 #1.
- `10`: §10.1 #1.

### 9. Market sequencing

**Conflict.**
- `01`: GCC, India and SE Asia first; DACH opportunistic; US not first.
- `05`: KSA + India, then UAE in Phase 2, then US/DE in Phase 3.
- `06`: India + GCC including UAE, then EU/UK/AU/CA in Phase 2, then US in Phase 3.
- `07` Phase 2 ran US ONC/HITRUST and UK certifications at M12–M24. Its ONC list targeted criteria HTI-5 would remove.
- `09` Phase 1 included Da Vinci (US).
- `03` traced the backlog to JC NPGs.

**Resolution.** One roadmap, recorded in the `06` §8 cross-report note:
- **Wave 1:** India + KSA.
- **Wave 1b:** UAE.
- **Wave 2:** one of Indonesia, Kenya or another SE Asian market. DACH only through a partner.
- **Wave 3 candidates:** EU, France, UK, Australia, Canada. No-regret engineering (IPS, EHDS-shaped logging, a DCB0129-style safety case) starts now.
- **US:** a Phase 3 go/no-go.

Consequences in the other reports:
- ONC/HITRUST (`07`) and Da Vinci (`09`) move to the US phase.
- The ONC target is retargeted to the **19 criteria HTI-5 would retain** plus the 7 it would revise. The (d)(1)–(13), (g)(3) and (b)(11) material stays as the internal engineering baseline.
- UK certifications wait for a UK entry decision.
- NABH, JCI, CBAHI and DoH are the primary accreditation trace in `03`, and JC NPGs a secondary pack.

**Evidence.** The `06` §4.2 HTI-5 table (34 removed, 7 revised, 19 retained, cross-checked there against the ASTP/ONC deck of 19 Feb 2026). HTI-5 was still proposed with no final rule as of 16 Oct 2026, per `06`/`09`.

**Files edited.**
- `01`: §12.1; §12.5 #1.
- `03`: exec #1; §21.4.
- `05`: §9.4 cross-report note.
- `06`: §8 Phase 1 cross-report note, Phase 2 note, Phase 3 note.
- `07`: exec #15; §2.1 HTI-5 retargeting; §3.3 ONC, HITRUST, UK and UAE rows; §9.2 Phase 2 and a new "US / UK on market decision" row; Sources 88–89.
- `09`: §9.2 Phase 1 item 6.

### 10. Implementation and build timelines

**Conflict.**
- `01` promised 6–12-month go-lives for 100–300-bed hospitals.
- `10` estimates 9–12 months for small hospitals and 12–18 months for mid-size.
- `07` had the first design-partner hospital live by M12, while `05` needs about 12 months just to build the finance MVP.

**Resolution (interim, until report 12 produces a critical-path build-and-go-live plan).**
- `01`'s 6–12 months is restated as a **mature-product target for <150-bed hospitals on foundation content**. Mid-size hospitals take 12–18 months.
- `07`'s Phase 1 exit becomes "design partner contracted and in implementation".
- First go-live is realistically **around M18–24 or later**: about 12 months of build plus 12–18 months of implementation.

**Evidence.** `10` §4.2/§4.12 duration estimates and `05` §9.3.

**Files edited.**
- `01`: §12.1 value proposition; §12.3; §12.5 #3.
- `03`: §21.2 Phase 1.
- `05`: §9.3.
- `07`: §9.2 Phase 1 exit criteria.
- `10`: note after the §4.12 table; §10.2 #12.

### 11. Within-site rollout strategy

**Conflict.** `03` §21.2 said to pilot on one unit, the ED and two clinics, then expand. `10` §4.4 recommends big bang per site.

**Resolution.**
- Standardize on `10`: big bang per site for all core clinical and revenue modules.
- The first site is a well-resourced, non-flagship design partner.
- Unit-level piloting is limited to a pre-production "model unit" or dress rehearsal.
- No live BCMA rollout unit by unit. Both reports already agreed partial closed loops are dangerous.

**Evidence.** The `10` §4.4 evidence table and `03`'s own EMRAM partial-loop warning.

**Files edited.**
- `03`: §21.2.
- `10`: §4.4 cross-report note.

### 12. Interface engine: OIE vs first-party gateway

**Conflict.** `02` said to reuse Eclipse OIE as the interface engine. `06` said to build a first-party gateway with no hard third-party dependency. `08` takes a hybrid.

**Resolution.**
- The `08` hybrid is adopted. The native Integration Hub (the same component as `06`'s "Interface Gateway") owns MLLP/v2, FHIR, DICOM and national adapters, with ack-state and replay.
- OIE, or the customer's Rhapsody/Cloverleaf, is optional for site-specific transforms only.
- A patch-lag policy applies: CVE monitoring, plus a patched build or compensating controls if upstream misses the SLA.

**Evidence.** The GitHub REST API on 2026-10-16 showed OIE's latest release is still **v4.6.0 (2026-07-09)**. So the Sep 2026 CVE fixes reported merged in `02` §3.4 were still unreleased. https://api.github.com/repos/OpenIntegrationEngine/engine/releases

**Files edited.**
- `02`: exec #8; §9 interface-engine row; §10.1 #3.
- `06`: §7.2; Sources 124.
- `08`: §12.5 integration row.

### 13. FHIR R6 ballot status

**Conflict.** `08` said R6 was in its "first full ballot" as of Oct 2026 and marked this Confirmed. `06` and `11` say ballot 5 (17 Jul 2026) was the second full ballot.

**Resolution.** `08` corrected to: "R6 6.0.0-ballot5 (2nd full ballot, 17 Jul 2026); CI 6.0.0-snapshot1 (15 Oct 2026); another ballot certain; publication expected 2027." The `08` verification-log row is now "Corrected", and its source [54] description was fixed.

**Evidence.**
- The ballot-5 page header reads "R6 Ballot (2nd Full Ballot)" and the body says "Welcome to the second full ballot … There is certain to be another ballot after this". https://hl7.org/fhir/6.0.0-ballot5/ballot-intro.html
- The CI page (6.0.0-snapshot1, generated 15 Oct 2026) still says "first full ballot". This is stale text, and it is the source of `08`'s error. https://build.fhir.org/ballot-intro.html
- No official publication date is given. "2027" is the expectation in `06` [5][6].

**Files edited.**
- `08`: exec #6; source [54]; new source [106]; verification-log row.
- `06`: §3.2.1 note.
- `11`: Sources 25 (re-verification note; no text change needed).

### 14. EU AI Act Art. 4 (AI literacy) after the Digital Omnibus

**Conflict.** The `07` executive summary said Art. 4 and Art. 50 were "unchanged". `07` §2.3 and `09` §5 say Art. 4 was softened.

**Resolution.**
- The `07` summary was fixed. Art. 4 is softened by Reg. (EU) 2026/1744: providers and deployers must *support the development of* staff AI literacy rather than guarantee a level of it.
- Art. 50 applies from 2 Aug 2026. Generative systems already on the market have until 2 Dec 2026 for Art. 50(2).
- The AI-literacy tracking feature (`09` G26) is kept regardless.

**Evidence.**
- Gibson Dunn (`07` [31]): the Omnibus would require providers and deployers to "support the development of AI literacy among their staff", rather than guarantee a specific level.
- Orrick (`07` [32]), 29 Jul 2026: the Art. 50(2) deadline of 2 Dec 2026 for systems placed on the market before 2 Aug 2026, and a link to eur-lex ELI reg/2026/1744.
- The final OJ text was not read directly, because EUR-Lex did not render.

**Files edited.**
- `07`: exec #4; §2.3 note.
- `09`: no change needed; it was already correct.

### 15. VA 2026 deployment count and Oracle contract status

**Conflict.** `02` said 8 facilities had gone live and that VA was "seeking" option years. `08` said 8 of 13 sites, with Indiana in August. `01` and `10` said 11 of 13, with a contract of about $27B.

**Resolution.**
- `02` and `08` now say: "11 of 13 2026 sites live as of 22 Aug 2026; Anchorage/Cleveland scheduled 24 Oct 2026."
- The contract is harmonized to the Aug 2026 modification: three option years and +$17B, for a total just under $27B. `02` keeps its earlier note that these periods extend the contract to as late as 2031-05-16.

**Evidence.**
- VA EHR Deployment Schedule (page dated 15 Sep 2026): go-lives on 11 Apr, 6 Jun and 22 Aug (Fort Wayne, Marion, Indianapolis); Anchorage and Cleveland upcoming on 24 Oct 2026. https://digital.va.gov/ehr-modernization/ehr-deployment-schedule/
- Washington Technology, 24 Aug 2026 (`10` [84]): "11 hospitals in 2026"; three option-year periods and a $17B boost bring the total to "just under $27 billion". https://www.washingtontechnology.com/contracts/2026/08/va-deploys-new-ehr-3-indiana-based-medical-facilities/415611/

**Files edited.**
- `02`: §2.7; Sources 135–136.
- `08`: §2.2; verification-log row; Sources 107–108.
- `01` and `10`: already correct; unchanged.

### 16. Dubai Health / Salama EHR vendor

**Conflict.** `01` said Salama was Cerner-based [U]. `10` said "reportedly Epic", with secondary evidence only.

**Resolution.**
- Contemporary 2017 reporting ties Salama to **Epic**, and no evidence of Cerner for Salama was found. The brief's prior expectation of Cerner is therefore not supported.
- Both docs now use the same wording: Epic, per contemporary press quoting DHA's IT director; no DHA or Epic primary release fetched; no evidence that Salama is Cerner-based.
- `01`'s EHS/Riayati "reportedly Cerner-based [U]" is kept separately.
- Follow-up: fetch a primary DHA/Dubai Health or Epic release.

**Evidence.**
- Khaleej Times, 8 Apr 2017, reporting DHA IT director Amani Al Jassmi: staff were "trained in the UAE and in the US by the international company EPIC". https://www.khaleejtimes.com/uae/electronic-medical-record-system-now-live-in-uae
- Search-result summaries of Emirates 24/7 (WAM, 8 Apr 2017), quoting "The programme we follow is EPIC from the USA", and of an ITU WSIS project record naming IBM and Epic as partners. Neither page could be read directly: Emirates 24/7 body missing, ITU request rejected.

**Files edited.**
- `01`: §4 UAE paragraph; Middle East vendor table; open items; Sources 180.
- `10`: §6.1 Dubai row; §10.5; verification-log row; Sources 97.

### 17. Reported costs of Helseplattformen, Apotti and MGB

**Conflict.**
- Helseplattformen: `01` gave ~NOK 3B + 522M, possibly over NOK 5B against NOK 3.7B. `10` gave NOK 6.7B against NOK 1.7B.
- Apotti: `01` gave €408M vs €625M as a conflict, while `10` stated €625M as fact.
- MGB: `01` gave $1.2B, and `10` gave $1.6B.

**Resolution.** One reconciled cost table in `01` §9.2, mirrored in `10`, separates the vendor/system contract, total programme cost (including internal labour) and lost revenue, each dated.
- **Helseplattformen:**
  - NOK 1.7B was the original **system acquisition-cost estimate** (18-year life).
  - NOK 4.1B was the **original programme frame**.
  - About **NOK 6.7B** is the **total programme cost to Oct 2024**, covering trusts, municipalities and GPs.
  - `01`'s NOK 3B/5B/3.7B figures are the specialist-care scope.
  - `10`'s "6.7B vs 1.7B" compared different scopes and has been corrected.
- **Apotti:** marked **conflicting** in both docs. Apotti's own FAQ gives a €407M investment cost "in its current scope", undated, which matches PLOS's €408M. €625M "by Nov 2022" comes from Helsingin Sanomat via Wikipedia, with unclear scope.
- **MGB:** $1.2B initially reported (Boston Globe, May 2016). $1.6B total by 2018, mostly lost patient revenue, with software under $100M (New Yorker, Nov 2018).

**Evidence.**
- Riksrevisjonen, Dokument 3:3 (2024–2025), 24 Oct 2024: "sterkt kritikkverdig"; costs higher than planned. The summary page gives no figures. https://www.riksrevisjonen.no/rapporter-mappe/no-2024-2025/helseplattformen-i-midt-norge/
- NRK, 24 Oct 2024: ~NOK 6.7B so far; original frame NOK 4.1B. https://www.nrk.no/trondelag/riksrevisjonen-legger-fram-resultatene-fra-undersokelse-om-helseplattformen-1.17092919
- Norwegian Wikipedia, citing Sunnmørsposten (3 Apr 2024), for the NOK 1.7B acquisition estimate.
- Apotti FAQ: https://www.apotti.fi/en/apotti/frequently-asked-questions/
- English Wikipedia "Epic Systems", citing the Boston Globe, the New Yorker and Helsingin Sanomat.

**Files edited.**
- `01`: §3.2 Norway and Finland rows; §9.2 rows plus the new reconciled cost table; open items; Sources 176, 177, 181, 182.
- `10`: exec #12; §4.12; §5.1 Helseplattformen and Apotti rows; §6.1 MGB row; verification-log rows; Sources 93, 94, 98.

### 18. KFSHRC EHR vendor

**Conflict.** A confidence gap only: `01` hedged, while `10` stated Cerner as current fact.

**Resolution.**
- Same wording in both: "Cerner Millennium (now Oracle Health) per 2015 primary evidence; no evidence of Epic". This pass found additional evidence from 2020 and 2022.
- The platform is not re-confirmed for 2024–2026.
- An action was added for the proposed beachhead-market report to confirm the current platform, because KFSHRC is a regional reference site.

**Evidence.**
- KFSH&RC press release via Zawya (2020): ICIS upgraded with Cerner Millennium. https://www.zawya.com/en/press-release/king-faisal-specialist-hospital-amp-research-centre-progresses-transformation-program-by-virtually-upgrading-cnct4bvf
- Hospitals Magazine, 2022 recap: Oracle Cerner transplant workflow and an AI MoU. https://hospitalsmagazine.com/multiple-expansions-go-lives-and-awards-for-oracle-cerner-clients-in-middle-east-africa/
- The 2015 Stage 7 release, already cited.

**Files edited.**
- `01`: §4 KFSHRC text; vendor table; open items; Sources 178–179.
- `10`: §6.1 KFSH&RC row; §10.5; verification-log row; Sources 95–96.

### 19. Epic generative model naming and scale (CoMET vs Curiosity)

**Conflict.** `01` described CoMET as 118M patients / 115B events, renamed Curiosity in Nov 2025. `09` described Curiosity as 320M patients / 23B encounters, with a March 2027 release.

**Resolution.** These are treated as two generations, each dated:
- **CoMET/Curiosity v1:** the arXiv paper (v1 16 Aug 2025; v3 7 Nov 2025, which names it Curiosity), pretrained on 118M patients and 115B events (151B tokens).
- **UGM-2026 "Cosmos Curiosity":** 320M patients and 23B encounters, with in-EHR release planned for March 2027.

The UGM coverage does not link the two, so the docs describe the second as a later, larger generation. The docs now cross-reference each other.

**Evidence.**
- arXiv abstract page: https://arxiv.org/abs/2508.12104
- Digital Health Wire, 24 Aug 2026: "Cosmos Curiosity is a new generative model trained on 320M deidentified patients and 23B encounters … ahead of a March 2027 release inside the EHR." https://digitalhealthwire.com/blue-ribbons-and-ai-agents-at-epic-ugm/

**Files edited.**
- `01`: exec #5; §2.2; Sources 175.
- `09`: exec #11; §6 table row; Sources 90.

### 20. InterSystems "600+ hospitals in 29 countries"

**Conflict.** `01` attributed the figures to InterSystems EHRs generally. `03` and `08` attributed them to TrakCare alone and marked this Confirmed.

**Resolution.** All three docs now use: "InterSystems EHRs (TrakCare/IntelliCare): 600+ hospitals, 29 countries (vendor claim)". The TrakCare-only claim is "deployed in 29 countries". The verification-log rows in `03` and `08` are marked Corrected.

**Evidence.** The InterSystems TrakCare page lists "InterSystems EHR Numbers to Know": 100M+ patients, 29 countries, 600+ hospitals. Under TrakCare it says "Deployed in 29 countries…". https://www.intersystems.com/products/trakcare/

**Files edited.**
- `01`: §5.1, wording only.
- `03`: §18 note; verification-log row; Sources 89.
- `08`: §2.5; verification-log row.

---

## Open follow-ups created by this reconciliation

1. **ADR-001 spike.** Run the 6–8 week load and safety spike comparing the own FHIR-shaped domain + HAPI libraries with a FHIR-native core (Medplum or HAPI JPA) on a 1,000-bed workload (#1).
2. **Proposed report 14: requirements catalogue.** Confirm the "minimum viable hospital" MVP scope with design partners (#4).
3. **Proposed report 12: business plan and critical path.** Set the first design-partner go-live date (#10).
4. **Proposed QMS/regulatory report.** Classify NEWS2/PEWS, sepsis screening and the native blood bank per market (FDA, EU MDR Rule 11, SFDA, CDSCO, UAE). This also closes gap 15 (#5, #6).
5. **Proposed beachhead-market report.** Confirm KFSHRC's 2024–2026 EHR platform (#18).
6. **Primary sources still wanted:** a DHA/Dubai Health or Epic release for Salama (#16); a Finnish primary source defining the scope of Apotti's €625M (#17); the final OJ text of Reg. (EU) 2026/1744 Art. 4 (#14); the HTI-5 final rule, to re-check the 19 retained criteria (#9).

**Note on parallel reports.** Three gap-filling reports appeared in this folder while the reconciliation was running: `12-build-program-business-plan.md`, `15-clinical-safety-qms-validation-and-migration.md` and `16-facility-peripheral-and-hardware-integrations.md`. The "proposed report 12" follow-up (#10) maps to `12`, and the "QMS/regulatory report" follow-ups (#5, #6) map to `15`. This pass did not edit or review those files. They should be checked against the positions above, especially #1, #4–#6, #8–#10.

## Files edited

- Reports: `01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`.
- New file: this log.
- `GLOSSARY.md` was not touched.
