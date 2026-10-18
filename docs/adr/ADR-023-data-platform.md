# ADR-023: Data platform: reporting replica and read models on site, encrypted CDC bronze landing centrally
Status: accepted
Date: 2026-10-18   Source: K §7.2 (kept), §7.8, §11.1; BP §4.1, §7.2, §7.11, §11.1; R08 §3.6, §3.8, §3.9, §14 #15; RL #7; BUILD-PROMPT §2.2 rule 1, §3.5, §4.1 (Central analytics), §5.2 (analytics), §5.3, §7 item 17, §9.31, §17.1, §19.1, §21 (WP-0.3, WP-1.11, Phase 5), A.14 (AI-DAT-01, AI-DAT-02a, AI-DAT-02b), §4.2

## Context

**The question.** Where reporting and analytics run, how fresh each layer is, and where the history needed for migration staging, CDS replay and analytics is kept.

**The research.**
- Read models are denormalised, rebuildable projections (boards, verification queues, task lists, results inboxes), fed by journal events and pushed to clients over server-sent events. They are disposable: a corrupted one is rebuilt from the journal (R08 §3.6).
- In the lakehouse, change data capture feeds Iceberg tables on object storage; dbt builds models; Trino, Spark or DuckDB query them; the lakehouse publishes SQL-on-FHIR views, OMOP and BI marts (R08 §3.9). OMOP is an analytics output, never the operational model (R08 §3.8).
- R08 says to plan analytics as CDC into a lakehouse from day one, minutes rather than nightly, and to publish OMOP and SQL-on-FHIR views as product features (R08 §14 #15). RL #7 records that the journal is also the outbox and feeds CDC to the lakehouse.

**BP** (BP §7.2, §11.1, §4.1, §7.11): ADR-023 "replica and CDC bronze landing in the MVP; silver, OMOP, SQL-on-FHIR in P2", with no reopen trigger. In the MVP: operational read models (≤2 s); a reporting replica (≤60 s) carrying MIS, the accreditation measure engine and safety telemetry; and CDC from the journal into bronze Iceberg storage, so the history needed for migration staging, silent-mode replay and AI grounding exists from day one (BP §11.1). BP split `AI-DAT-02` into `AI-DAT-02a` (CDC bronze landing, MVP) and `AI-DAT-02b` (silver layer, OMOP and SQL-on-FHIR, P2), because CDC is cheap on day one and feeds migration staging and silent replay (BP §4.1). BP's freshness targets: boards ≤2 s, reporting replica ≤60 s, lakehouse ≤15 min (BP §7.11).

**Sources.** K keeps BP's ADR-023 text (K §7.2) and places the layers for the on-site topology (K §11.1): read models (≤2 s) and a reporting replica (≤60 s) on site, carrying MIS, JCI measures, KRG returns, safety telemetry and the owner's dashboard; centrally, an encrypted CDC bronze landing per tenant for migration staging, CDS replay and analytics. K's central site holds "terminology, CDC bronze landing, analytics" (K §7.8). BUILD-PROMPT §4.2 states that placement. Not marked [P].

**Difference between sources, recorded.** K's NFR table (K §7.10) and BUILD-PROMPT give no freshness figure for the central bronze landing; BP §7.11's "lakehouse freshness ≤15 min" is the only figure in the sources. Whether it carries over is not settled, so this ADR records it for reference without adopting it, and the gap is listed for `docs/program/OPEN-QUESTIONS.md` (BUILD-PROMPT §1).

## Decision

**Data platform:** reporting replica (≤60 s) and read models on site; encrypted CDC bronze landing centrally in the MVP; silver layer, OMOP and SQL-on-FHIR in P2.

**Detail** (BUILD-PROMPT §17.1, §7 item 17, §5.2, §5.3, §9.31, §4.1):
- **On site (MVP):** read models (≤2 s boards) and the reporting replica (≤60 s), carrying MIS, JCI measures, KRG returns, safety telemetry and the owner's dashboard (revenue and collections by currency, unbilled consumption, deposits outstanding, corporate receivables, occupancy), with a report builder on the replica (§17.1, §7 item 17). Read models are rebuildable from the journal and pushed to clients over server-sent events (§5.3; ADR-004).
- **Centrally (MVP):** an encrypted CDC bronze landing per tenant, for migration staging, CDS replay and analytics (§17.1); `AI-DAT-02a` is "CDC bronze landing in object storage".
- **P2:** the silver layer; OMOP and SQL-on-FHIR outputs; command-centre data (§17.1; `AI-DAT-02b`, `OPS-CMD-01`).
- **P3:** opt-in benchmarking with hospitals as co-owners. We never sell identifiable data (§17.1).
- **Owner:** the `analytics` satellite owns read models, the reporting replica, measures and the CDC landing, and reaches clinical data through events and CDC only (§5.2).
- **Reporting rules** (§9.31): one indicator catalogue drives dashboards, accreditation measures and statutory returns; dashboards render from the replica without touching the transactional database; the report builder applies row-level security by facility, department and role, and its exports are audited and watermarked.
- **Central analytics stack** (§4.1): Apache Iceberg, Trino, dbt Core, SQL-on-FHIR (P2: OMOP).

## Consequences (including safety and licence impact)

**Safety and privacy.**
- Read models and the replica are derived data, rebuildable from the journal (constitution rule 1). A stale or corrupted read model is rebuilt, never treated as a source of record (R08 §3.6; H6).
- Dashboards and the report builder render from the replica without touching the transactional database (§9.31), which keeps reporting load off the clinical write paths.
- Report exports are audited and watermarked, and the report builder applies row-level security by facility, department and role (§9.31; ADR-013).
- The central landing is encrypted and per tenant (K §11.1). What may leave the cell is governed by SI-20 and constitution rule 9 (ADR-007).
- CDC history from day one gives migration staging and CDS replay their data (BP §11.1; K §11.1), which the content pipeline's replay checks rely on (BUILD-PROMPT §19.4; ADR-020).

**Engineering.** OMOP and SQL-on-FHIR are outputs, never the operational model (R08 §3.8); the domain model stays the truth (constitution rule 4).

**Licence.** Iceberg, Trino, dbt Core and SQL-on-FHIR are Apache-2.0 and run centrally (BUILD-PROMPT §4.1). The ORT scan confirms each pinned package (ADR-022).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Freshness tests.

**Where and when.**
- BUILD-PROMPT §21 names no freshness exit criterion. The tests belong with the components they measure: read models from WP-0.3 (read models rebuildable from the journal; journal-rebuild test); the reporting replica (`AI-DAT-01`) and the central CDC bronze landing (`AI-DAT-02a`) in WP-1.11, whose exit evidence includes "Owner's dashboard from the replica" and "CDC landing at the central profile"; the silver layer, OMOP and SQL-on-FHIR (`AI-DAT-02b`) in Phase 5.
- Targets of record: read models ≤2 s and the replica ≤60 s (BUILD-PROMPT §7 item 17, §17.1, §4.2). No target of record exists for the central landing (see Context).
- Every freshness number names its cell; dev-cell and lite-cell numbers are indicative (BUILD-PROMPT §3.5).

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
