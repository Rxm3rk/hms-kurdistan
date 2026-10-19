# WP-0.3: Platform kernel
Phase / release: Phase 0 Foundation / no clinical go-live (features first run in R1)   Features: `PLT-CORE-01`, `PLT-CORE-02`, `PLT-CORE-04`, `PLT-CORE-07`, `PLT-CFG-01`
Read first: BUILD-PROMPT §2.1 (SI-03, SI-06, SI-10, SI-19); §2.2; §4.2 (ADR-003, ADR-004, ADR-009, ADR-010, ADR-020); §5.2; §5.3; §6.2; §6.4; §6.6; §7 (items 1, 3–8); §8.1–§8.3; §8.5. Research: R08 §12; R07 §5, §9.1; BP §7 (the §7 "Read:" line); R11 (§8 asks for R11 in full before WP-0.4)
Depends on: WP-0.2   Simulators needed: none
Entry criteria:
- WP-0.2 merged, or reviewed and stacked (§3.6, §21): the dev cell (or lite cell) runs Kafka, PostgreSQL and Temporal for the Debezium pipeline and the chaos test.
- Module specifications for the platform modules written first (§3.2 "Specify first"): `docs/specs/modules/platform-*.md`.
- Waits on WP-0.2. **Deviation approved (DN-040, 19 October 2026):** the human lead approved starting the cluster-free parts now. State: `in-progress` on `wp/0.3-platform-kernel`, stacked on `wp/0.1-programme-bootstrap` at `09afa41`. In scope now: the module specifications, the kernel libraries, the hierarchy and configuration chain with locks (domain level), signed bundles, flags and kill switches, the task engine domain, `WorkflowPort` (port only), the journal's schema, migrations and repository code, the event catalogue and envelope rules, and the architecture tests. Waiting on WP-0.2 (the cell): the Debezium → Kafka pipeline with Apicurio, the Temporal adapter, the journal-rebuild and per-patient-ordering tests against real infrastructure, the `TaskOrphaned` chaos test, and persistence-backed lock evidence.
Deliverables:
- Platform libraries under `backend/platform/` (package `hms.kernel.<lib>`): UUIDv7 identifiers; an injected `Clock` (never `now()` inside the domain); clinical (valid) time distinct from recorded time; `Money` (`BigDecimal` plus an ISO 4217 currency, explicit rounding, never floating point); `Quantity` with UCUM units, so a unit-less dose cannot form a valid command (§6.2).
- The bitemporal journal as transactional outbox (`platform-journal`, `PLT-CORE-01`): one append-only row per change, written in the same transaction as the state change and never updated; as-was queries; read models rebuildable from the journal (§5.3, §7 item 3; ADR-004).
- Debezium → Kafka with CloudEvents 1.0 envelopes and the Apicurio schema registry; events keyed by patient for per-patient ordering; at-least-once delivery; idempotent consumers; owned, alarmed dead-letter queues; replay (`PLT-CORE-04`; §5.3, §7 item 5; ADR-009). The domain-event catalogue starts in `docs/specs/events/` (§8.5).
- The enterprise hierarchy (tenant → legal entity → facility → building → floor → department → unit → room → bed, plus service points) and the configuration chain with locks: vendor foundation → Kurdistan pack → tenant → legal entity → facility → department → unit → user; the most specific value wins unless a parent has locked it; safety invariants and Tier 2 activation are vendor-locked (`PLT-CORE-02` base; §6.6, §7 item 1).
- Signed configuration bundles: typed registry, change sets, signing, promotion BUILD → TEST → TRAIN → PROD, three-way merges, no customer branches (`PLT-CFG-01`; §6.6; ADR-020).
- Flags and kill switches: every CDS rule and clinical-behaviour flag has a kill switch; safety-relevant changes default to off; flag changes are audited (SI-19; §6.6, §7 item 8).
- The task engine (`platform-tasks`, Safety Kernel; `PLT-CORE-07`): every task has an owner (person, pool or queue), an SLA, an escalation chain and a state; `TaskOrphaned` fires within 5 minutes for unowned or unroutable work (SI-03; §7 item 4). SLA timers are calendar-aware where a tenant calendar applies (§7 item 1; the calendar is [L] data, L-20).
- `WorkflowPort` with the Temporal adapter; no Temporal types outside the adapter (ADR-010).
- Architecture tests for these modules (Spring Modulith verification, ArchUnit layering, `domain` free of framework types; §6.8 item 3).
Exit criteria (evidence required):
- The journal-rebuild test passes.
- Events arrive in per-patient order with idempotent consumers.
- `TaskOrphaned` fires within 5 minutes in a chaos test.
- A locked setting cannot be overridden below its lock.
- §22.2 work-package Definition of Done and a reviewer report.
Hazards touched:
- H5 orphaned work (SI-03, `TaskOrphaned`).
- H6 data loss or corruption (journal-as-outbox; SI-06 and SI-10 rely on its immutability and its two time axes).
- H4 delayed escalation (escalation chains; kill switches, SI-19).
[HUMAN] gates:
- None in §21.
