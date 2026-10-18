# ADR-012: Offline and downtime safety matrix in the hazard log
Status: accepted
Date: 2026-10-18   Source: K §7.2, §7.9, §15.4 (S9-K), K-18; BP §7.2, §7.10, §15.4 (S9); R08 §6.3, §6.4, §13 #8, §14 #8; BUILD-PROMPT §2.1 (SI-15), §3.1, §10.1, §16.3, §18.7, §21 (WP-0.6, WP-3.3, WP-3.14), Appendix B.2, §4.2

## Context

**The question.** What the system may and may not do when part of it is unreachable, and how that is kept safe.

**The research** (R08 §6.3). Offline is a clinical-safety problem, not a sync-library choice. Clinical facts are append-only, so two vitals sets cannot conflict. State transitions sync as commands and are revalidated server-side; a dose given offline against an order discontinued meanwhile is accepted as fact (it happened) and raised to the clinician and pharmacist. Identity creations offline use temporary identifiers and go to a reconciliation queue. CRDTs are acceptable for draft note text and UI preferences, never for orders, medication state or identity. R08 says to define this matrix in the hazard log (R08 §14 #8); the risk is offline conflicts producing unsafe data (R08 §13 #8).

**BP** (BP §7.2): the offline and downtime safety matrix is entered in the hazard log (SI-15). The offline-BCMA conflict model stays open after the M3 freeze until spike S9 re-runs C2 on the edge agent; reopen if S9 finds a conflict class the matrix does not cover.

**What K changed** (K §7.2, "Changed"). "Offline" now means losing the on-site cell (rare), or losing the central site for pooled-tier sites. Mobile offline BCMA is unchanged. Internet loss alone is not an offline state for a hospital. S9-K (M4–M6) re-runs C2 and C9 on the on-site cell with power-cut and WAN-cut injection (K §15.4). K-18: unsafe offline conflicts are avoided because the on-site cell is the single writer. Not marked [P].

## Decision

**Offline and downtime safety matrix** in the hazard log (SI-15). "Offline" means losing the on-site cell (rare), losing the central site for pooled-tier sites, or mobile offline. Internet loss alone is not an offline state for a hospital.

**What SI-15 forbids offline** (BUILD-PROMPT §2.1, §16.3): new prescribing without full CDS; bed or OT-slot allocation; identifiers outside pre-allocated blocks; controlled-drug stock movement; identity merges. Offline commands are revalidated by the server. No last-writer-wins or CRDT merges on clinical state. At an on-site hospital these apply only if the cell itself is lost.

**Downtime layers** (BUILD-PROMPT §16.3; K §7.9): L0 node loss (automatic failover); L1 internet or WAN loss (hospitals: no clinical effect; outpatient sites: read-only continuity on the edge agent, downtime ID blocks, printed packets and the outpatient lab downtime protocol); L1b mains power loss (ADR-026); L2 site loss (DR standby promotion); L3 ransomware or corruption (immutable restore, continuity instance, clean kits); L4 prolonged outage (paper packets every 1–4 h, downtime forms, back-entry with valid time = paper time, labelled).

**How the matrix is held.** As hazard entries with causes, controls and verifying tests in `docs/safety/hazard-log.yaml` (BUILD-PROMPT §3.1, §10.1), in the form of Appendix B.2. Its worked example (offline administration against an order discontinued during an outage: offline administration only against orders verified before the outage; on reconnect the server revalidates; a conflicting administration is recorded as a fact and flagged as an owned task) is the pattern. Mobile offline BCMA works only against orders verified before the outage (BUILD-PROMPT §8.4).

## Consequences (including safety and licence impact)

**Safety.**
- The single writer per hospital (ADR-006, ADR-025) removes the worst conflict classes; what remains is mobile offline mode, edge-agent mode and loss of the cell itself (H2, H6).
- Revalidation on reconnect means an offline action can be accepted as a fact and still raise owned work, rather than being silently merged or dropped (SI-03; H5).
- Back-entry after outages will be frequent in Kurdistan, so its tooling and audit are sized for it (SI-10).
- Every control in the matrix starts as `planned` and is only `verified` with passing tests named in `verified_by`; human fields stay empty until a sign-off record exists (BUILD-PROMPT §3.5, §10.1).

**Licence.** None specific to this ADR. The mobile offline store is ADR-019.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Offline conflict suite (S9-K).

**Where and when.**
- WP-0.6: offline-BCMA conflict replays inside the C2 harness (`spikes/adr-001/`).
- WP-3.3: BCMA offline mode with revalidation and flagged facts; property tests for SI-02, SI-13 and SI-15 at 10⁶ sequences.
- WP-3.14: the S9-K offline-conflict suite on the real cell profile.
- The nightly tier runs the C2 property sequences and the chaos drills (BUILD-PROMPT §18.7, §19.1). The hazard log's SI-15 entry is seeded in WP-0.1 with every control `planned`.

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

S9-K finds an uncovered conflict class.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
