# ADR-003: Modular monolith plus satellites
Status: accepted
Date: 2026-10-18   Source: K §7.2 (kept), §7.3, K-06; BP §5.5, §7.2, §7.4; R08 §1 #4, §4.1, §4.2, §13 #3; R14 §4 #9; BUILD-PROMPT §2.2 rule 3, §5.2, §6.1, §6.8 item 3, §4.2

## Context

**The question.** How the backend is decomposed: one deployable, many microservices, or a modular core with a few separate services.

**The research** (R08 §4.1). For a hospital, the decisive force is consistency. Signing an order must atomically persist it, record CDS overrides, create a pharmacy verification task, recompute the MAR schedule and emit charge events; saga compensation is dangerous because a dose cannot be "un-administered". A modular monolith also aggregates the chart in process (latency), enforces module ownership with tooling (Spring Modulith; Shopify's Packwerk), and is far simpler to install on a 2–3 node hospital cluster. Modules talk through interfaces and domain events, so one can be extracted later. Satellites are justified only where scaling, isolation or regulatory needs genuinely differ (R08 §1 #4). The risk is decay into a "ball of mud" (R08 §13 #3).

**Tenders.** Some tenders mandate "microservices"; containerised modules plus satellite services on Kubernetes with messaging satisfy that wording without splitting orders, medications and the MAR across the network (R14 §4 #9; BP §7.2).

**Sources.** K keeps BP's text for ADR-003 (K §7.2). BUILD-PROMPT §4.2 states the Safety Kernel as Orders, Medications (including the MAR), Results and Tasks, matching BP's bounded-context map (BP §7.4), and adds that Tier 2 modules are separate processes (BP §5.5; K-06). The decision is not marked [P].

## Decision

**Modular monolith plus satellites.** Orders, Medications (including the MAR), Results and Tasks share one transactional boundary (the Safety Kernel). RCM, the Integration Hub, the document renderer, the AI gateway (P2) and analytics are satellites (BP §7.2). Tier 2 modules are separate processes.

**The module map** is BUILD-PROMPT §5.2. Each module is a Spring Modulith application module, or a separate process where marked: the Trust Plane (`trust-identity`, `trust-policy`, `trust-audit`, `trust-keys`); the platform modules (including `platform-tasks`, which is part of the Safety Kernel); patient access and flow (`empi`, `scheduling`, `adt`); the Safety Kernel (`orders`, `medications`, `results`); the regulated Tier 2 modules (`reg-ews`, `reg-transfusion`, `reg-screening`, `reg-lis-rules`, `reg-dose` in P2); the clinical record; diagnostics; knowledge; revenue and ERP (`rcm` as a satellite with its own deployable and schema on every cell); governance; and the edges (`hub`, `front-door`, `analytics`, `ai-gateway` in P2).

**Dependency rules** (BUILD-PROMPT §5.2, enforced by ArchUnit and Modulith verification):
- A module imports only another module's `api` package (commands, queries, published events). No module reads another module's tables.
- Only the Safety Kernel modules (`orders`, `medications`, `results`, `platform-tasks`) may share a database transaction. An order-sign is one atomic transaction: order + CDS override record + verification task + MAR schedule + charge event (ADR-001 criterion C1).
- Every module reaches its data store only through repositories wrapped by the Trust Plane Policy and Audit SDKs (ADR-013).
- `rcm` is a downstream conformist. It consumes clinical events (for example `ChargeGenerated`) and never changes clinical aggregates. No kernel, ADT or order command calls it synchronously; screens that show both compose them in the BFF; during an RCM outage clinical work continues while charge events wait in the outbox.
- `hub` is the anti-corruption layer to every external format (ADR-014).
- Tier 2 sidecars expose a pure-function, schema-versioned API and fail to "unavailable, manual check required", never to "pass" (ADR-016).

**Repository layout [P]** (BUILD-PROMPT §6.1): `backend/modules/` (one directory per application module), `backend/app-hms/` (the modular-monolith Spring Boot application), `backend/regulated/` (Tier 2 sidecars, each its own deployable and release train), `backend/hub/`, `backend/satellites/` (rcm with finance-export, the document renderer, analytics, the ai-gateway in P2) and `backend/platform/` (shared kernel libraries). Each module is hexagonal: `api/`, `domain/` (pure Kotlin, no framework types), `application/`, `infrastructure/`, `web/`, `events/`, `test/`.

## Consequences (including safety and licence impact)

**Safety.**
- The shared kernel transaction is what makes the atomic order-sign possible. It protects SI-02 (no administration without a verified order), SI-03 (every order reaches a terminal state) and the verification and MAR schedule link (H2, H5).
- Making RCM a satellite enforces SI-12 at the boundary: no payment, deposit or counter state can block an ADT, order or MAR command (H4).
- Keeping the Hub as the only emitter of external formats concentrates interface safety (H15) and egress control (SI-20, H13) in one place.
- Process-isolated Tier 2 modules keep the kernel out of device scope (K §5.5; ADR-016).

**Engineering.** One main artefact plus a few satellites keeps on-site installs simple (R08 §4.1). The price is discipline: without enforced boundaries the monolith decays (R08 §13 #3), so the architecture tests block merge (BUILD-PROMPT §6.8 item 3).

**Licence.** No new dependency beyond ADR-002 (Spring Modulith, Apache-2.0). Satellites are separate deployables, which also keeps any future GPL or AGPL component separable as an unmodified container (ADR-022).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Modulith verification; ArchUnit.

**Where and when.**
- **ArchUnit rule library:** `backend/platform/arch-rules`, created in WP-0.1. Its layering rules (modules import only another module's `api`; `domain` packages free of framework types; BUILD-PROMPT §6.8 item 3) run in the fast tier's architecture tests for every project.
- **Spring Modulith verification:** from WP-0.3, when `backend/app-hms` and the first application modules exist. Until then there is no application for Modulith to verify.
- **The reopen metric.** The trigger needs a trend of boundary violations across sprints. Architecture tests block merge, so violations show up as failed fast-tier runs and recorded exceptions; the CI evidence records under `docs/program/evidence/ci/` are the intended source of the count. No count exists yet.

**State on 2026-10-18:** the rule library is being created in WP-0.1 by the backend part of the work package; Modulith verification does not exist yet. This ADR claims no result.

## Reopen if

Boundary violations rise for two consecutive sprints.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
