# ADR-010: Workflow: Temporal behind WorkflowPort for long-running processes
Status: accepted
Date: 2026-10-18   Source: K §7.2, §7.4, §7.6; BP §7.2, §7.7; R08 §4.4, §12.5, §13 #9; BUILD-PROMPT §4.1 (Workflow), §4.3, §5.2 (platform-workflow), §7 items 4 and 6, §21 (WP-0.3), §4.2

## Context

**The question.** How long-running processes (days to months, with timers and human steps) are orchestrated without putting safety-critical state in a workflow engine.

**The research** (R08 §4.4). Temporal offers durable execution "whether that takes a second or a year": deterministic workflow code, activities with retries, timers lasting months, signals and queries, worker versioning; it is self-hostable on PostgreSQL and the server is MIT-licensed. Use it for discharge orchestration, referral lifecycles, prior authorisation, claim submission and remittance matching, interface replay, bulk export and migration pipelines. Do not use it for the order or MAR state machines or sub-second clinical decisions. Camunda 8.6 and later need a production licence. Risks: determinism discipline and versioning (R08 §12.5); licence rug-pulls (R08 §13 #9).

**BP** (BP §7.2, §7.7): Temporal (MIT) for discharge, pre-auth, claims, migration and cutover; never order or MAR state, never sub-second decisions; Camunda 8.6+ rejected on licence. Temporal has a single corporate steward, so workflows are written against a workflow-port abstraction with a fork-readiness plan under ADR-022. Reopen on an upstream licence or governance change.

**What K changed** (K §7.2). Temporal runs on site, on PostgreSQL persistence, and K adds C9 to the reopen trigger. If C9 fails for Option A, the lighter-workflow-persistence fallback applies before any reopen (K §7.4; ADR-001). BUILD-PROMPT §4.2 writes that order out in the trigger. Not marked [P].

## Decision

**Workflow:** Temporal behind `WorkflowPort` for long-running processes (discharge, pre-approval, claims, migration, cutover). Never order or MAR state, never sub-second decisions. Fork-readiness plan under ADR-022.

**Detail** (BUILD-PROMPT §4.1, §5.2, §7):
- Temporal on PostgreSQL persistence, used only behind a `WorkflowPort` interface. The `platform-workflow` module owns `WorkflowPort` and the Temporal adapter.
- Order and MAR state stay in their domain aggregates, in the same transaction as the journal (ADR-003, ADR-004).
- Work that a workflow creates for people is a task in the task engine (`platform-tasks`), with an owner, an SLA timer, an escalation chain and `TaskOrphaned` (SI-03; BUILD-PROMPT §7 item 4).
- Fork-readiness: Temporal is a critical-path dependency with a single corporate steward, so it is wrapped behind the port with a fork-readiness note in the dependency scorecard (BUILD-PROMPT §4.3; ADR-022).
- The C9 fallback is lighter workflow persistence behind the same `WorkflowPort`.

## Consequences (including safety and licence impact)

**Safety.**
- Keeping order and MAR state out of the workflow engine keeps the Safety Kernel transactional and its invariants testable in the domain (H2).
- Workflow timers never own work on their own: people's work is in owned tasks, so a stalled workflow still surfaces as an orphaned or overdue task (H5).

**Engineering.** The port costs an abstraction layer and keeps workflow code deterministic. In return, the fallback (lighter persistence) and a fork are possible without touching callers.

**Licence.** Temporal is MIT (BUILD-PROMPT §4.1). Camunda 8.6 and later is excluded by name (BUILD-PROMPT §4.3).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** ArchUnit: no Temporal types outside the adapter.

**Where and when.** The rule belongs in the ArchUnit rule library `backend/platform/arch-rules` (created in WP-0.1). It can only act once `platform-workflow` and its Temporal adapter exist (WP-0.3: "`WorkflowPort` with the Temporal adapter"). It runs in the fast tier's architecture tests.

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

C9 fails (first apply the fallback: lighter workflow persistence behind the same `WorkflowPort`, then re-run C9), or the upstream licence or steward changes.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
