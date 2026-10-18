# ADR-009: Messaging: journal-as-outbox and one event backbone everywhere
Status: accepted-provisional
Date: 2026-10-18   Source: K §7.2, §7.4, §7.6, §15.4 (S9-K); BP §7.2, §7.6, §7.7; R08 §4.3, §6.2, §12.5, §13 #7; RL #7; BUILD-PROMPT §4.1 (Event backbone), §4.3, §5.3, §7 item 5, §12.1, §18.6, §21 (WP-0.3, WP-0.6), §4.2

## Context

**The question.** Which event backbone carries domain events, on site and centrally.

**The research** (R08 §4.3). The journal is the outbox: a message is published if and only if the transaction commits, without two-phase commit; the relay can duplicate messages, so consumers must be idempotent. Debezium's outbox router routes by aggregate type and keys by aggregate id; clinical streams are keyed by patient so a patient's events stay ordered. Apache Kafka 4.x in KRaft mode is the default broker. Alternatives: Redpanda (Business Source License, so denylisted), NATS JetStream ("light, good for edge"), Pulsar (operationally heavier). Lesson from the VA "unknown queue": every message has an acknowledgement state, and undeliverable messages land in a visible, owned work queue, never in a hidden dead-letter topic (R08 §4.3, §13 #7).

**BP** (BP §7.2): Kafka 4.x (KRaft), Debezium outbox, CloudEvents, Apicurio schema registry, keyed by patient; no hidden dead-letter topics; no reopen trigger.

**What K changed** (K §7.2, "Changed"). Journal-as-outbox is unchanged, with **one event backbone everywhere**: Kafka in KRaft mode (three small brokers co-located on the three nodes) by default; if the C9 footprint test fails, the backbone everywhere becomes NATS JetStream (R08 §4.3). K adds the reopen trigger "C9 fails on reference hardware", and spike S9-K compares Kafka with NATS JetStream on the on-site cell (K §15.4). Not marked [P].

**Why the status is accepted-provisional.** ADR-009 stays accepted-provisional until its spike criterion (C9) passes on the reference cell (BUILD-PROMPT §4.2; WP-0.6). The reference cell is [HUMAN: hardware]; dev-cell and lite-cell footprint numbers are indicative and cannot move this ADR to accepted. If a measured result already triggers the reopen rule, that is recorded instead (BUILD-PROMPT §21, WP-0.6).

## Decision

**Messaging:** journal-as-outbox, one event backbone everywhere: Kafka KRaft by default, NATS JetStream if C9 fails. Events keyed by patient. No hidden dead-letter topics.

**Stack detail** (BUILD-PROMPT §4.1, §5.3, §7 item 5, §12.1):
- **Event backbone:** Kafka 4.x in KRaft mode via Strimzi, three small brokers on the three cell nodes; Debezium outbox CDC; CloudEvents 1.0 envelopes; the Apicurio schema registry. Fallback: NATS JetStream everywhere if the on-site footprint test (C9) fails.
- **"Everywhere"** means the on-site cells and the central site use the same backbone. A switch to NATS JetStream applies everywhere, never per site, so there is one code path (K §7.2).
- **Contracts:** schemas in Apicurio; backward-compatible evolution only, with a 12-month deprecation window; at-least-once delivery; idempotent consumers; per-patient ordering (the Hub guarantees A08 never overtakes A01).
- **No silent failure:** undeliverable messages land in owned queues that alarm after 5 minutes; every channel has an owned dead-letter queue and a replay console (ADR-014).
- **C9** is measured as recorded in ADR-001: the p95 targets met with CPU and memory utilisation ≤60% on the reference cell with every component running (BUILD-PROMPT §18.6), with the interim aggregation default stated there.
- **WP-0.6** includes a Kafka vs NATS footprint comparison (BUILD-PROMPT §21).

## Consequences (including safety and licence impact)

**Safety.**
- Per-patient ordering keeps a patient's clinical events in sequence (H6, H15), and owned, alarmed queues mean no message disappears (constitution rule 6; SI-03; H5).
- At-least-once delivery makes idempotent consumers mandatory; a non-idempotent consumer would double-apply a fact (for example a charge or a task) after a redelivery.

**Footprint.** Three Kafka brokers share three nodes with PostgreSQL, Temporal, Keycloak and the application. That is the risk C9 measures, and the NATS fallback exists because of it.

**Licence.** Kafka, Strimzi, Debezium, Apicurio and NATS are on the allowlist (BUILD-PROMPT §4.1, Apache-2.0). Redpanda is excluded by name (BSL; BUILD-PROMPT §4.3).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** C9 footprint test; ordering tests.

**Where and when.**
- **C9 footprint test:** the C9 harness and the Kafka vs NATS comparison in `spikes/adr-001/` (WP-0.6), built and dry-run at reduced scale on the dev cell (indicative). The reference-cell run waits for hardware [HUMAN: hardware]. S9-K re-runs C9 on the real on-site cell with power-cut and WAN-cut injection (K §7.4).
- **Ordering tests:** WP-0.3 exit evidence ("events arrive in per-patient order with idempotent consumers"), and per-patient ordering in the Hub's channels (WP-1.1b, WP-1.12).

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

C9 fails on reference hardware.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
