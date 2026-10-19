# ADR-001: Core data, Option A: our own FHIR-shaped domain model on PostgreSQL
Status: accepted-provisional
Date: 2026-10-18   Source: K §7.2, §7.4, §7.6, §15.4 (S1, S2, S9-K), K-13; BP §7.2, §7.5; R08 §3.10, §3.11, §4.6; R02 §1 #3, §2.12, §9; RL #1, #2, #13; BUILD-PROMPT §4.1, §5.1, §5.3, §18.6, §21 (WP-0.6), §4.2

## Context

**The question.** Which store is the system of record for clinical data: our own domain model, or a FHIR-native server. The options are BP's (BP §7.5; K §7.4):
- **A:** our own FHIR-shaped domain model on PostgreSQL, one database per tenant, with HAPI libraries.
- **B:** a FHIR-native core (self-hosted Medplum or HAPI JPA) behind a repository abstraction.
- **A′:** A, with HAPI JPA as the projection store instead of generated projection tables.

**Why the research expects A** (BP §7.5; RL #1; R08 §3.11, §4.6):
- R6 moves the finance and supply resources out of core and reorganises dosage (RL #2, #13), so an R4-native store would need a data migration within five years.
- FHIR has no workflow states such as a pharmacist verification queue. A hospital order/MAR engine needs invariants and workflow states that FHIR resources do not express (R08 §1 #6, §4.6).
- Medplum's single-database Projects conflict with database-per-tenant (RL #1).
- R02's "translation smell" warning is met by storing stable facts FHIR-shaped, so their projection is near-identity (RL #1; R02 §9).
- RL #1 settled the cross-report conflict (R02 had ranked a FHIR-native core first) in favour of this posture, gated by a load and safety spike.

**What K changed** (K-13, "Adapted"; K §7.2, §7.4). K keeps Option A as the default and BP's decision rule, but re-weights the spike for on-site deployment and a smaller team, and adds criterion C9 (on-site footprint):

| # | Criterion | Weight in K (BP) |
|---|---|---|
| C1 | Atomic order-sign | 15 (15) |
| C2 | Invariants under 10⁶ randomised command sequences, including offline-BCMA conflict replays | 25 (25) |
| C3 | Bitemporal "what did the clinician see at 09:12" | 10 (10) |
| C4 | FHIR R4 read/search over the projection | 5 (10) |
| C5 | R4 → R6 from unchanged storage | 10 (15) |
| C6 | IPS `$summary` and a KRG return bundle from the same facts | 5 (10) |
| C7 | Point-in-time restore on on-site hardware | 10 (5) |
| C8 | Add a clinical fact type end to end | 15 (10) |
| C9 | On-site footprint: the 300-bed day on a three-node cell | 5 (new) |

K also adds Kurdistan-specific triggers: if C9 fails for Option A, the ADR-009 and ADR-010 fallbacks apply before any reopen, and spike S9-K (M4–M6) re-runs C2 and C9 on the real on-site cell with power-cut and WAN-cut injection (K §7.4). Medplum stays a comparator. MediMind runs on it under contract with a 25-hospital network in Georgia (R02 §1 #3, §2.12); Medplum's single-database conflict with database-per-tenant matters less on single-hospital cells (K §7.2).

**[P] marks.** BUILD-PROMPT §4.2 does not mark this decision [P]; it is K's. The stack details below that BUILD-PROMPT §4.1 marks [P] (quorum synchronous replication; jOOQ and Flyway) are this prompt's engineering choices, binding until an ADR changes them.

**Why the status is accepted-provisional.** ADR-001 stays accepted-provisional until its spike criteria pass on the reference cell (BUILD-PROMPT §4.2; WP-0.6). The reference cell is three servers provided by a human [HUMAN: hardware] (BUILD-PROMPT §5.1). Until it exists, dev-cell numbers are "indicative" and lite-cell numbers "lite"; neither can move this ADR to accepted. If a measured result already triggers the reopen rule, that is recorded instead (BUILD-PROMPT §21, WP-0.6).

## Decision

**Core data, Option A:** our own FHIR-shaped domain model on PostgreSQL, one database per tenant, HAPI libraries for structures and validation. Stable facts (Observation, Condition, AllergyIntolerance, QuestionnaireResponse) are stored FHIR-shaped so their projection is near-identity; translation is concentrated where FHIR is weakest (workflow states such as the verification queue). A repository/port abstraction stays whatever the outcome.

**Stack detail that belongs to this decision** (BUILD-PROMPT §4.1, §5.1, §5.3):
- **Database:** PostgreSQL 18 (17 minimum) on CloudNativePG, one database per tenant. On site, three instances with quorum synchronous replication [P]: a commit waits for any one of the two standbys and never degrades to asynchronous. A two-node-plus-witness cell needs its own ADR stating its RPO.
- **SQL access and migrations [P]:** jOOQ open-source edition (type-safe SQL, works naturally with exclusion constraints and range types) and Flyway community edition. Migrations follow expand → migrate → contract so rollback to N-1 always works (ADR-021).
- **Health standards:** HAPI FHIR structures and validator. The FHIR R4 projection and its versioning are ADR-005.
- **Storage shapes per tenant database** (BUILD-PROMPT §5.3; R08 §3.11): (A) relational aggregates with foreign keys and exclusion constraints; (B) immutable facts with `valid_period`, `recorded_at`, `author`, `attester`, `source` and `supersedes_id`; (C) the bitemporal journal-as-outbox (ADR-004); (D) read models rebuildable from the journal.
- **The repository/port abstraction** is the exit path whatever the spike shows. Every module reaches its data store only through repositories, and those repositories are wrapped by the Trust Plane Policy and Audit SDKs (ADR-013; BUILD-PROMPT §5.2).

**The decision rule** (K §7.4, which keeps BP §7.5's rule):
- A is the default.
- B replaces A only if it passes C2 and beats A by ≥15 weighted points.
- A′ is adopted only if generated projection tables miss C4 or C8 (BP §7.5).
- Whatever wins, the repository abstraction stays and ADR-001 freezes at M3.
- If C2 fails for both options, stop and redesign the order/MAR boundary.
- If C9 fails for Option A, apply the ADR-009 (NATS JetStream) and ADR-010 (lighter workflow persistence) fallbacks and re-run C9 before any reopen (K §7.4).

**Pass thresholds** (BUILD-PROMPT §18.6; K §7.4):

| # | Criterion | Weight | Pass |
|---|---|---|---|
| C1 | Atomic order-sign: order + CDS override + verification task + MAR schedule + charge event | 15 | p95 ≤300 ms at 3× peak |
| C2 | Invariants under 10⁶ randomised command sequences, including offline-BCMA conflict replays | 25 | Zero violations (hard gate) |
| C3 | Bitemporal "what did the clinician see at 09:12" on a 30-day chart | 10 | p95 ≤1.5 s |
| C4 | FHIR R4 read/search over the projection | 5 | p95 ≤300 ms; lag p99 ≤5 s |
| C5 | R4 → R6 from unchanged storage | 10 | ≤15 engineer-days; no storage migration |
| C6 | IPS `$summary` and a KRG return bundle from the same facts | 5 | 100% validator conformance |
| C7 | Point-in-time restore of a 5-year, 150-bed tenant on on-site hardware | 10 | ≤4 h |
| C8 | Add a clinical fact type end to end | 15 | ≤3 days |
| C9 | The 300-bed day on the three-node cell | 5 | p95 targets met with CPU and memory utilisation ≤60% |

**The C9 interpretation, recorded as BUILD-PROMPT §18.6 requires.** K's wording is "p95 targets met at ≤60% CPU and memory headroom on the reference hardware" (K §7.4), which is ambiguous. This ADR records BUILD-PROMPT §18.6's reading: **C9 passes when the p95 targets are met with CPU and memory utilisation ≤60%** on the three-node reference cell (3 × 32 cores, 128 GB, NVMe) with every component running. Neither source says whether utilisation is taken per node or across the cell, or as a peak or a sustained value. Until a human settles this, the spike report states the aggregation it used, and the stricter reading (per node, over the peak window) is the interim default, as BUILD-PROMPT §1 requires for an ambiguity that cannot wait. The question is open in `docs/program/OPEN-QUESTIONS.md` as OQ-119.

**How the spike runs in this build** (BUILD-PROMPT §21, WP-0.6; §18.6):
- Measure Option A only. Options B and A′ are assessed on paper from R08 and K §7.4 (a desk assessment) unless the human asks for a prototype.
- Spike code lives in `spikes/adr-001/`. It is not production code and is rebuilt from specs in Phase 1.
- C1–C6 and C8 are measured on the dev cell (indicative). The C7 and C9 harnesses are built and dry-run at reduced scale. The reference-cell run waits for hardware [HUMAN].
- For C5 and C8 (and ADR-004's tooling criterion), report what can be measured (files, modules and migrations touched; agent wall-clock time) and ask the human to convert it into engineer-days.
- Workloads: the 1,000-bed day (K §7.4, after R15 §7.4) for C1–C3; the 300-bed day on the reference cell for C9, scaled from the 1,000-bed workload to 300 beds and 800 sessions, with the scaled volumes recorded in the spike report.
- Medication event sourcing (spike S2) is decided inside this spike (ADR-004).

## Consequences (including safety and licence impact)

**Safety.**
- The order/MAR invariants (SI-02, SI-05, SI-09, SI-13, SI-15) are enforced in the domain layer and by relational constraints, not in FHIR application code (R08 §4.6). C2 (zero violations) is the hard gate for that claim; it addresses H2 and H6.
- C1 depends on the Safety Kernel sharing one transaction (ADR-003). An order-sign is one atomic transaction: order + CDS override record + verification task + MAR schedule + charge event (BUILD-PROMPT §5.2).
- Bitemporal facts and the journal support signed-note immutability (SI-06) and the clinical-time rules (SI-10), and C3 measures the medico-legal "as-was" query.
- Quorum synchronous replication gives RPO 0 when any one node fails and stops writes rather than degrading when two are lost (BUILD-PROMPT §16.2), which addresses H6.

**Engineering.**
- FHIR projections must be written and tested (ADR-005). That cost is the price of absorbing R4 → R6 churn in the mapping layer rather than in storage (R08 §4.6).
- One database per tenant gives per-tenant backup, restore and keys (R08 §5), which C7 and crypto-shredding (ADR-008) rely on.
- Phase 1 builds on Option A behind the repository abstraction while the status is provisional. If the reference-cell run reopens this ADR, the abstraction limits the rework.

**Licence.**
- PostgreSQL (PostgreSQL licence), HAPI FHIR (Apache-2.0), jOOQ open-source edition and Flyway community edition (Apache-2.0) are on the allowlist (BUILD-PROMPT §4.1, §4.3). Liquibase under FSL is denylisted (§4.3), so it is not a migration alternative.
- §4.3 excludes "Medplum components inside the product" by name. A B outcome built on Medplum could therefore not ship without changing ADR-022, which is stop-and-ask item 2 (§3.4). Of the B variants, only HAPI JPA (Apache-2.0) can ship under the current policy.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Spike harness C1–C9 (§18.6).

**Where and when.**
- The harness is built in WP-0.6 ("Synthetic data and the ADR-001 harness"), which depends on WP-0.4 and WP-0.5. Its code lives in `spikes/adr-001/`, with the synthetic population and the 1,000-bed and 300-bed workload generators (§18.10).
- The C2 property runs use the property-test models generated from the state-machine specifications (WP-0.5). The nightly tier runs 10⁶ sequences at the application-command layer plus at least 10⁴ through each real channel adapter (§19.1).
- The WP-0.6 exit evidence is a written spike report: C1–C6 and C8 measured on the dev cell (indicative); C7 and C9 harnesses built and dry-run at reduced scale.
- The reference-cell run of C7 and C9 waits for hardware [HUMAN: hardware]. Spike S9-K re-runs C2 and C9 on the real on-site cell with power-cut and WAN-cut injection (K §7.4, §15.4).

**State on 2026-10-18:** not implemented. No criterion has been measured, and this ADR claims no result. Results appear only in the spike report and in CI evidence under `docs/program/evidence/`.

## Reopen if

Option B (FHIR-native core) passes C2 and beats A by ≥15 weighted points; or C2 fails for both, in which case stop and redesign the order/MAR boundary. If C9 fails for Option A, apply the ADR-009 (NATS JetStream) and ADR-010 (lighter workflow persistence) fallbacks and re-run C9 before any reopen (K §7.4).

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
