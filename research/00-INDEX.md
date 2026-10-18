# Research Pack Index and Reading Guide

This pack covers research and planning for a top-tier Hospital Management System: the clinical record (HIS/EHR), a clinical-operational ERP, revenue cycle, and a patient digital front door. **No code has been written.** All facts are as of **16 October 2026**.

There are about 366,000 words in total: 16 research reports, a reconciliation log, a glossary, three competing blueprint proposals and the final master blueprint.

---

## Start here

**[`../BLUEPRINT.md`](../BLUEPRINT.md) (v1.2.1, ≈48,700 words) is the answer.** It says what to build, for whom, in what order, with what team and money, and how to go live without harming patients. The rest of the pack is its evidence base.

- **One page:** read §1, the executive summary and the 30 numbered decisions (D-01…D-30). Each decision has a rationale, evidence and a "reopen if" trigger.
- **One hour:** add §3 (market and waves), §4 (scope), §5 (clinical safety), §7.1–§7.5 (architecture constitution, ADRs, ADR-001), §14.2–§14.6 (capacity, team, budget, funding) and §15 (roadmap and Gantt).
- **What is still open:** §18 (33 risks), §19 (decisions still required), Appendix C (22 argued deviations from the pack) and Appendix D (the revision log answering 85 review issues).

**Kurdistan Region of Iraq.** [`../BLUEPRINT-KURDISTAN.md`](../BLUEPRINT-KURDISTAN.md) (v1.1, ≈38,000 words) re-plans the blueprint for Kurdistan.
- **What it covers:** Erbil, Sulaymaniyah, Duhok and Halabja first, then federal Iraq. Inpatient hospitals run on on-site servers; the product works in Kurdish, Arabic and English; billing handles dinars and dollars.
- **Plan:**
  - outpatient wedge at M22 (Nov 2028);
  - first full hospital at M37 (Feb 2030);
  - ≈US$36M of equity.
- **Where to start:** its Part 0 is a three-minute summary written to be read aloud.
- **PDF:** a print-ready A4 copy is [`../BLUEPRINT-KURDISTAN.pdf`](../BLUEPRINT-KURDISTAN.pdf).
- **Status:** this pack has no Iraq or Kurdistan research. Every Kurdistan-specific fact in that edition is a local assumption marked [L], listed in its Appendix B, and checked in its M0–M3 validation sprint.
- **Precedence:** for Kurdistan questions the edition overrides `BLUEPRINT.md` wherever its Appendix A records a change.

**Build brief.** [`../BUILD-PROMPT.md`](../BUILD-PROMPT.md) (v1.0, ≈57,000 words) turns the Kurdistan edition into an implementation programme for an AI coding agent: fixed stack and ADR baseline, architecture, conventions, the 21 safety invariants as code rules, every module with acceptance tests, the testing and release strategy, a phased build sequence (Phase 0 foundation → R1 wedge → R2a → R2b → R2.1 → P2 → P3) and the full 234-feature backlog. It cites this pack section by section ("Read:" lines) instead of repeating it.

**Which source wins when they disagree:**
1. `BLUEPRINT.md`, where Appendix C records an argued deviation.
2. [`RECONCILIATION-LOG.md`](RECONCILIATION-LOG.md) (RL), which settles 20 contradictions between reports.
3. The individual reports R01–R16. Each one already carries inline "(reconciled 2026-10-16: …)" notes and a pass-2 verification log.

---

## The documents

| Ref | File | Words | What it covers | Read it for |
|---|---|---|---|---|
| R01 | [01-global-vendor-landscape.md](01-global-vendor-landscape.md) | 18.9k | HIS/EHR and hospital-ERP vendors by region (Epic, Oracle Health, MEDITECH, InterSystems, Dedalus, Cambio, Indian and Gulf suites), market sizing, pricing, programme costs, win/loss reasons | Why Epic is not the target, and why private 50–800-bed groups in emerging markets are |
| R02 | [02-open-source-and-platforms.md](02-open-source-and-platforms.md) | 16.8k | Open-source HIS/EHRs, ancillary OSS (LIS, PACS, MPI, interface engines, terminology, FHIR servers), Medplum/HAPI/headless platforms, openEHR, licensing, reuse vs build map | What to reuse as separate services, what to build, and licence risks |
| R03 | [03-clinical-modules-and-workflows.md](03-clinical-modules-and-workflows.md) | 20.7k | 48 clinical modules and detailed workflows benchmarked against Epic, Oracle, MEDITECH, TrakCare, Dedalus and Cambio; safety acceptance checklist; KPIs | Functional depth of a top-tier EHR, and safety-by-design as the differentiator |
| R04 | [04-diagnostics-pharmacy-devices.md](04-diagnostics-pharmacy-devices.md) | 17.7k | LIS, blood bank, RIS/PACS, pharmacy/eMAR/BCMA, device integration, POCT, CSSD, dietary, dialysis and more; build/buy/integrate | Native diagnostic order lifecycle on five shared services; what to integrate |
| R05 | [05-revenue-cycle-erp-operations.md](05-revenue-cycle-erp-operations.md) | 17.2k | Revenue cycle (US superset model plus country variants), patient accounting, charge capture, supply chain, ERP boundary, operations | One patient financial account, effective-dated country packs, native supply-to-charge |
| R06 | [06-interoperability-standards.md](06-interoperability-standards.md) | 18.8k | FHIR R4/R5/R6, HL7 v2, DICOM, IHE, terminologies and licensing, national exchange mandates in about 30 jurisdictions | A FHIR-version-independent façade, the Integration Hub, terminology service, country packs |
| R07 | [07-security-privacy-regulation.md](07-security-privacy-regulation.md) | 23.1k | Privacy law, medical-device rules, certifications, threats, 70 MUST/SHOULD security requirements, resilience, medical-record law | Trust Plane services, sovereign cells, the regulated-modules boundary, cyber recovery |
| R08 | [08-architecture-and-technology.md](08-architecture-and-technology.md) | 18.1k | How incumbents are built; the reference architecture and stack (Kotlin/JVM modular monolith, PostgreSQL per tenant, bitemporal journal, cells) | The technical skeleton and NFRs |
| R09 | [09-ai-analytics-digital-front-door.md](09-ai-analytics-digital-front-door.md) | 20.9k | GenAI and ambient documentation evidence, data platform, AI governance, patient front door (WhatsApp, national apps), clinician mobile | Where AI pays, what never to build, and governance as product |
| R10 | [10-implementation-ux-lessons.md](10-implementation-ux-lessons.md) | 19.4k | EHR usability and burnout evidence, KLAS data, implementation playbook and staffing ratios, failure case studies (VA, Helseplattformen, VGR), TCO | How programmes fail and how to go live safely |
| R11 | [11-canonical-domain-model.md](11-canonical-domain-model.md) | 8.7k | Canonical domain model: aggregates, state machines, safety invariants, bitemporal history, event-to-HL7/FHIR mapping, R6 incubator impact | The data model behind the façade |
| R12 | [12-build-program-business-plan.md](12-build-program-business-plan.md) | 13.7k | Vendor-side build programme: MVP sizing, team, five-year budget and scenarios, gates G0–G6, design partners, pricing, funding, kill criteria | The business case (the blueprint re-plans its numbers in §14) |
| R13 | [13-beachhead-india-gcc-requirements-pack.md](13-beachhead-india-gcc-requirements-pack.md) | 14.8k | India, KSA and UAE accreditation, national rails (ABDM/NHCX, NPHIES, Malaffi/NABIDH), tax, privacy, hosting rules; 78-row L0/L1/L2 requirement matrix; launch checklists | What each launch market legally and commercially requires |
| R14 | [14-requirements-catalogue-mvp-and-rfp-crosswalk.md](14-requirements-catalogue-mvp-and-rfp-crosswalk.md) | 11.9k | One backlog of 214 features (140 MVP / 54 P2 / 20 P3, ≈1,875 eng-weeks), tender intelligence, KLAS/EMRAM/Leapfrog crosswalk, competitor teardown, release train | The single backlog of record (the blueprint re-baselines it to 154/47/21) |
| R15 | [15-clinical-safety-qms-validation-and-migration.md](15-clinical-safety-qms-validation-and-migration.md) | 13.6k | ISO 13485 QMS, per-market device classification of HMS functions, NEWS2/blood bank/pump rulings, clinical safety case, V&V, migration and cutover, go-live safety | Why the safety and QMS track starts at month 0 |
| R16 | [16-facility-peripheral-and-hardware-integrations.md](16-facility-peripheral-and-hardware-integrations.md) | 11.9k | Nurse call, telephony, RTLS, queues and kiosks, payments, national ID, printers and scanners, BMS/IoT, downtime behaviour, certified hardware | The three edge planes: workstation shell, site edge agent, cloud Integration Hub |
| RL | [RECONCILIATION-LOG.md](RECONCILIATION-LOG.md) | 5.3k | 20 cross-report contradictions resolved, with reasoning (ADR-001 core data, FHIR finance, ERP boundary, MVP, blood bank, early warning, event sourcing, NFRs, markets, timelines, rollout, Integration Hub, R6 status…) | Canonical positions when reports disagree |
| — | [GLOSSARY.md](GLOSSARY.md) | 1.7k | Acronyms from ABAC to XDS | Reference |
| A | [blueprint-drafts/proposal-A-market-business-first.md](blueprint-drafts/proposal-A-market-business-first.md) | 15.3k | Competing blueprint, market and business lens | GTM, pricing and business-viability detail (grafted into the final) |
| B | [blueprint-drafts/proposal-B-clinical-safety-product-first.md](blueprint-drafts/proposal-B-clinical-safety-product-first.md) | 14.8k | Competing blueprint, clinical-safety and product lens | **The winning base** (judge tally B 155, A 149, C 145) |
| C | [blueprint-drafts/proposal-C-platform-architecture-first.md](blueprint-drafts/proposal-C-platform-architecture-first.md) | 14.4k | Competing blueprint, 20-year platform lens | Architecture depth (grafted into the final) |

The three proposals are superseded by `BLUEPRINT.md` and are kept for provenance.

---

## Reading paths by role

| You are | Read |
|---|---|
| **Founder / investor** | BLUEPRINT §1, §3, §14, §15, §16, §18 → R12 → R01 §10–§12 → R14 §8 |
| **CMIO / clinical safety officer** | BLUEPRINT §5, §6, §13 → R15 → R03 → R10 §2–§5 → R04 (medication and transfusion) |
| **CTO / architect** | BLUEPRINT §7, §8, §9, §11 → R08 → R11 → R06 → RL #1, #2, #7, #8, #12, #13 → R02 → R16 |
| **CISO / DPO / regulatory** | BLUEPRINT §5.6, §10 → R07 → R15 §4–§5 → R13 (privacy and hosting rows) |
| **Product / market** | BLUEPRINT §2–§4, §12, §16 → R14 → R13 → R05 → R09 |
| **Implementation / delivery** | BLUEPRINT §13, §14.3 → R10 → R15 §10 (migration and go-live) → R16 |
| **Kurdistan / Iraq stakeholder** | BLUEPRINT-KURDISTAN Part 0, §1, §2, §3, §14, §19 and Appendix B (the assumptions to verify) → §7 (on-site cells) → §12 (Kurdistan billing) |

---

## How the pack was produced

1. **Research.** Parallel research agents wrote R01–R10 from web sources, and R11 was written as a canonical domain model.
2. **Verify and gap-fill (pass 2).**
   - 541 factual claims were checked against sources, and 163 were corrected inline (see each report's "Verification log (pass 2, 2026-10-16)").
   - 20 cross-report contradictions were resolved in the RL.
   - Five gap reports were added: R12–R16.
3. **Design panel.**
   - 16 digests of the reports fed three independent blueprint proposals (A/B/C).
   - Three judges scored them: a hospital buyer, an investor and an engineer-regulator. B won.
   - A synthesizer wrote `BLUEPRINT.md` from B, with grafts from A and C.
   - Three critics reviewed it (completeness, accuracy and red team): 85 issues, 9 of them critical.
   - Two revision rounds followed, each independently verified. The last residual issue (V3) was fixed by hand in v1.2.1.

   BLUEPRINT Appendix B has the details, and Appendix D lists every change.

## Conventions

- **[E]** our estimate; **[I]** our inference; **[K]/[U]** unverified items inherited from the pack.
- **M-numbers** count months from **M0 = January 2027**.
- FX: US$1 ≈ ₹88 ≈ SAR 3.75 ≈ AED 3.67.
- Report sections are cited as "R08 §12.6" (report 8, section 12.6). Reconciliation items are cited as "RL #n".
