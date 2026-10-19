# Task engine (`platform-tasks`)

The module specification of the task engine, written before the code it governs (BUILD-PROMPT §3.2 step 2, §22.1 item 1) in WP-0.3. Feature: `PLT-CORE-07` Task/work-queue engine, "Every item owned; SLA timer; orphan alarm · *Seam messages to hospital A are owned tasks (SI-03)*" (Appendix A.1). Module: `platform-tasks`, in the Safety Kernel (§5.2), Gradle project `:modules:platform-tasks`, package `hms.platform.tasks`. The executable state machine is `docs/specs/state-machines/task.yaml` (Appendix B.3).

Sources: §2.1 SI-03, SI-10 and the preamble; §2.2 rules 1, 2, 3, 6 and 7; §3.4 items 1, 3 and 4; §3.5; §4.2 (ADR-001, ADR-004, ADR-009, ADR-010, ADR-026); §5.2 (`platform-tasks` row, dependency rules, the Tier 2 task API); §5.3; §6.2; §6.3; §6.4; §6.6; §6.7; §7 items 1, 3 and 4; §8.2 "Orders and tasks"; §8.4 "Task"; §8.5; §9.2; §9.7; §14.1; §16.4; §18.3; §18.7; §18.13; §19.4; §21 WP-0.3; R11 §1 (P1, P2, P10), §7.2, §7.3, §14; BP §5.5, BP §6.7, BP §7.6; K §7.5. Hazard log: HAZ-0003, HAZ-0004, HAZ-0005, HAZ-0010, HAZ-0017. Kurdistan facts: L-20 (`docs/program/ASSUMPTIONS.md`). Integrator decisions D1 to D17 of the WP-0.3 specification round.

**Status.** Everything here is a specification. No code exists yet, no test named below has run, and every hazard-log control it cites is `planned`. WP-0.3 builds the cluster-free parts (DN-040): the domain, the application services, the ports, the in-memory adapters for tests, the `tasks` schema, its migrations and jOOQ repositories, and every test that runs on an injected clock. What needs the cell waits (§2).

**Risk class.** Patient-safety relevant: this module enforces SI-03 for every work item. It gets the correctness and the clinical-safety review lenses, never recorded as a human review (§3.5).

**Labels.** [P] marks this build's own engineering choices, which the sources do not dictate. Open items carry local labels (`OQ-TK1`, `DN-TK1`, `KA-TK1`, `HAZ-TK1`, `ADR-TK1`, `CR-TK1`). The integrator numbers them; §14 lists them all.

## 1. Purpose and scope

SI-03 says: "Every order reaches a terminal state. Every task, result, message, letter and referral has an owner and an SLA. Unowned work raises `TaskOrphaned` within 5 minutes. Seam messages to a hospital still on paper or legacy systems are owned tasks" (§2.1). Its "Enforced in" column names the task engine. This module is that engine.

It owns (§5.2): tasks, owned queues, pools, SLA timers, escalation chains and `TaskOrphaned`. Every fulfilment step of an order is a task, and worklists are read models over open tasks (§8.2; R11 §7.3). Team inboxes are pools (§7 item 4). Each role workspace opens on an owned home queue fed by this engine (§14.1; BP §6.1 "No queue is unowned").

In scope:
- the Task aggregate and its state machine (open → claimed → done / cancelled, §8.4);
- owners: a person, a pool or a queue (§7 item 4), with pools and queues as aggregates of this module;
- routability of owners, through a `RoutingDirectory` port for person status;
- SLA timers on the injected `Clock`, continuous or business-calendar;
- escalation chains ending in a mandatory terminal owner;
- `TaskOrphaned`: detection, the alarm, its owner, deduplication and clearing;
- task requests from modules outside the Safety Kernel, read from the journal, and the alarm when one is not turned into a task;
- the tasks the platform raises itself: dead-letter items (§5.3, §6.7), orphan alarms, failed escalations;
- the commands, queries and events of all of these.

Out of scope, owned elsewhere:
- whether a given order, result, message, letter or referral creates a task, with which kind, owner and policy. The owning module (`orders`, `results`, `scheduling`, `hub`, …) decides and asks this module. SI-03 clause a ("Every order reaches a terminal state") is the `orders` machine's (CTRL-0003-3). Clause d (the seam) is `scheduling` and `hub` work (CTRL-0003-6, §9.2, WP-1.3).
- the content of escalation policies (who, after how long): governed clinical content (§3.4 item 3), owned by the module whose work it is (for example the critical-result policy tables of `results`, §9.7).
- whether a task kind is safety-relevant: the owning module classifies its kinds in its hazard analysis (§3.4 item 3). This engine only enforces the consequences (§3.4).
- the safety dashboard (§9.29) and the Level-3 rollback trigger monitor (§18.13): `quality` and operations build them on this module's queries (CTRL-0003-7).
- dead-letter capture itself: the event backbone (`hms.kernel.events`, `PLT-CORE-04`) and the Hub (§12.1) put items there; this module makes them owned tasks (§7.1).

## 2. What WP-0.3 builds and what waits

"Built now" is code and tests delivered in WP-0.3. "Specified only, built later" is written in this spec so the API is stable, but no code or test for it exists until the named dependency arrives.

| Part | Built now in WP-0.3 (cluster-free, DN-040) | Specified only, built later | On what |
|---|---|---|---|
| Domain: Task, Pool, Queue, routability, SLA, escalation, orphan episodes, the state machine | Built, with unit and property tests | — | — |
| Orphan scan, request reconciliation and timers | Built in the application layer (`hms.platform.tasks.application.system`), driven by the injected `Clock`; proven with `TestClock` (`hms.kernel.testing`), including a backward clock step (§4.5) | The scheduler in a live process, the leader lease across replicas, the watchdog outside the process | `app-hms` and the cell (WP-0.2) |
| Clinical times on tasks (`workBeganAt`, `performedAt`) | Carried as event data; every Task row takes its valid time at recording (`ValidTimeInput.AtRecording`, §5.2) | `workBeganAt` as the SLA start (DN-TK2; KA-TK8) | The back-entry tooling (`TRU-BCP-03`) |
| SI-03 timing settings | Definitions, the tenancy `SettingGroup` for `C + S + G + B + F ≤ L`, the policy objects and their resolver (§8) | — | — |
| `TaskOrphaned` within 5 minutes | Proven on a simulated clock (`PropertyTest:SI-03-orphan-alarm-within-5-minutes`) | The chaos test, the WP-0.3 exit criterion (§12) | The dev cell (WP-0.2) |
| Persistence | Repository ports; the `tasks` schema, Flyway migrations and jOOQ repositories written now [P] (§10; OQ-TK11); in-memory adapters in `...inmemory` for tests only (D8) | Integration tests against PostgreSQL in `src/integrationTest` | The cell |
| Journal entries for every change | Written through `JournalAppender` (the journal library's in-memory adapter in tests) | Same-transaction proof against PostgreSQL | The journal's jOOQ adapter and the cell |
| Domain events | Produced as journal entries with their catalogue type | Publication through Debezium → Kafka | `PLT-CORE-04` on the cell |
| Task requests from non-kernel modules (§5.3) | The intake and its reconciliation, reading the journal through its consumer tail with a watermark (D14), unit-tested on the in-memory journal | The journal's PostgreSQL reader; the gap check against the real journal sequence (D15) | The cell |
| Dead-letter intake (§7.1) | The sink adapter, its tasks and its timer | Wiring to the real dead-letter topics and Hub queues | `PLT-CORE-04` on the cell; `INT-ENG-01` (WP-1.1b) |
| Person status (`RoutingDirectory`) | Port and in-memory adapter | The Trust Plane adapter (user active or deactivated) | WP-0.4 |
| Absence, surrogates, rosters | Not built | `CLN-RES-01` surrogates (R2b), `ERP-ROS-01` rostering (P2) | Later work packages |
| User permissions and read audit | `TaskAuthorization` port; allow-list test adapter; production adapter denies every user action (§9) | The Trust Plane SDK | WP-0.4 |
| Operational alarm transport | `OperationalAlarms` port; the after-commit relay; a recording adapter for tests | OpenTelemetry to the cell's alerting (§6.7) | WP-0.2 and `PLT-OPS-05` |
| Escalation notices outside the worklist | Not built; NOTIFY recipients see the task in their worklist (§4.2) | `platform-notify` | KA-TK6 |
| REST/BFF endpoints, worklist UI | Not built | Contract-first OpenAPI (§6.3) | The first workspace that shows a queue |

## 3. Domain model

All types below live in `hms.platform.tasks.domain`, pure Kotlin, with no framework type (arch rule (a)), and never read the system clock (arch rule (d)). A function that needs the time takes a `java.time.Clock` or a `RecordedTime` (§6.2). Business outcomes are sealed result values, never exceptions (§6.2). Ids and context types are the kernel's (D1): `TenantId`, `FacilityId`, `PatientId` and `UserId` from `hms.kernel.ids`; `CommandContext`, `ActorRef`, `ChangeReason`, `IdempotencyKey`, `CorrelationId` and `TransactionContext` from `hms.kernel.context`.

### 3.1 The Task aggregate

| Field | Type | Rule |
|---|---|---|
| `id` | `TaskId` (UUIDv7, `TypedId`) | §5.3. A caller that requests a task chooses its id from its own generator, so it can refer to the task before it exists (§5.3) [P] |
| `tenantId`, `facilityId` | `TenantId`, `FacilityId?` | §5.3: `tenant_id` on every row, `facility_id` where it applies. `facilityId` is null only for a tenant-level task (§3.2) |
| `kind` | `TaskKind` (a code registered in the kind registry, §3.4) | `kindRegistered` |
| `subject` | `PatientId?` | R11 §1 P1. Fixed at creation; the partition key of the task's events (D6; journal J-14) |
| `encounter` | `EncounterRef?` | R11 §1 P1. A UUID reference until `adt` publishes its encounter id type [P] |
| `focus` | `FocusRef(module, aggregateType, aggregateId)`, required | The aggregate the work is for: an order, a result, a referral, a dead-letter item, a task request, another task. The shape follows the FHIR R4 `Task.focus` element [P] |
| `owner` | `Owner` = `Person(UserId)` \| `Pool(PoolId)` \| `Queue(QueueId)`, required | §7 item 4. `UserId` is a user account, never a practitioner record (§8.2) |
| `claimant` | `UserId?`, set only in `claimed` | |
| `priority` | `ROUTINE`, `URGENT`, `ASAP`, `STAT` | The order priorities of R11 §7.2 |
| `sla` | `Sla(startsAt, startSource, dueAt, clock, span, calendarVersion?)` | §4.1 |
| `escalation` | `EscalationChain` snapshot: policy code and version, steps, terminal owner reference, next step index, step outcomes | §4.2 |
| `escalationRecipients` | `List<Owner>` | People, pools or queues told by a fired NOTIFY step (§4.2) |
| `state` | `OPEN`, `CLAIMED`, `DONE`, `CANCELLED` | §8.4 |
| `slaBreachedAt` | `RecordedTime?` | Set once |
| `ownerUnroutableAtCreation` | `Boolean` | The first scan opens the episode without grace (§4.3) |
| `orphanEpisode` | `OrphanEpisode?` (at most one open) | §4.3 |
| `orphanedTotal` | `Duration` | Sum of the closed episodes, for the Level-3 query (§5.8) |
| `requestId` | `TaskRequestId?` | The `TaskRequest` it was made from (§5.3) |
| `version` | `Long` | Optimistic concurrency (§6.2) |

The task carries no free text [P]. A worklist shows the kind's message key and the focus, so no clinical text sits in task rows, events or logs (§6.2 PHI-safe logging; SI-20). Kind codes are label-neutral: a code never names a sensitivity label or a diagnosis (SI-21) [P]; the kind registry refuses codes on a deny list that the PHI canary scan also uses.

**Holder.** The holder is the claimant when the task is `claimed`, and the owner otherwise. Routing, orphan detection and "who must act now" all use the holder.

### 3.2 Pools and queues

Both are aggregates of this module (§5.2 "owned queues, pools"), with UUIDv7 ids and versions [P]:
- **Pool**: a team inbox (§7 item 4). Members are user accounts. Any routable member may claim a task the pool owns.
- **Queue**: a work queue that a role watches (a home queue, §14.1; a referral queue, §9.2). Monitors are persons or pools. Any routable monitor may claim.

**Scope.** A pool or queue belongs to one tenant and either to one facility or to the tenant as a whole (a tenant-level pool or queue, `facility` null) [P]. A facility-level task may be owned by a pool or queue of its facility or by a tenant-level one of its tenant. A tenant-level task may be owned only by tenant-level pools and queues. Nothing crosses a tenant (H5, H13, H14).

**Codes.** Each pool and queue has a `code` (`[a-z][a-z0-9-]{0,62}`), unique among the live pools and queues of its scope [P]. Configuration and escalation policies name queues by code, never by id, because ids are made at run time and differ between environments (§6.6 promotion BUILD → TEST → TRAIN → PROD). A code is resolved in the task's scope: the facility first, then the tenant level.

A member or monitor change that would leave live work with no routable holder is refused with `WouldLeaveWorkUnroutable(liveTasks)` [P]; the caller first reassigns the work. The check runs against the pool's or queue's version, so two concurrent removals are serialised (§5.7). A change made outside this module (a user deactivated in the Trust Plane) cannot be refused here; the orphan scan catches it (§4.3).

### 3.3 Routability

`Routability` = `Routable` | `Unroutable(reason, since: Instant?)` | `Unknown(lastKnown: Routable | Unroutable | null, lastKnownAt: Instant?)`.

| Holder | Unroutable when | Reason |
|---|---|---|
| Person | The account is inactive (deactivated, suspended), unknown, or in another tenant | `PERSON_INACTIVE`, `PERSON_UNKNOWN`, `OUT_OF_SCOPE` |
| Pool | Retired, unknown, out of the task's scope, or no member is a routable person | `POOL_RETIRED`, `POOL_UNKNOWN`, `OUT_OF_SCOPE`, `POOL_EMPTY` |
| Queue | Retired, unknown, out of the task's scope, or no monitor is routable | `QUEUE_RETIRED`, `QUEUE_UNKNOWN`, `OUT_OF_SCOPE`, `QUEUE_UNMONITORED` |
| Code reference | The code resolves to no live pool or queue in the task's scope | `CODE_UNRESOLVED` |

`Unknown` means the `RoutingDirectory` cannot answer for a person within the staleness bound `C` (§4.3, §8). The adapter may answer from a cache no older than `C`; older than that it answers `Unavailable` with the last status it knew, which the domain maps to `Unknown`. (`PERSON_UNKNOWN` is different: the directory answered, and the account does not exist.)

Pool and queue routability is a pure domain function of this module's data and the person statuses the directory returns. Person status comes through the `RoutingDirectory` port (§5.9): the Trust Plane adapter from WP-0.4, an in-memory adapter in tests. Absence with surrogate cover (§9.18; CTRL-0017-5) and on-duty rosters (P2) are not modelled yet: until they are, an active account counts as routable (KA-TK3).

**Three uses, three rules** [P] (DN-TK3):
1. **Detection** (the orphan scan): only `Unroutable` opens an episode. `Unknown` does not open per-task episodes; the scope raises one "orphan detection blind" alarm instead (§4.3). An episode already open stays open while the holder is `Unknown`, and an episode closes only on `Routable`.
2. **Moving work** (reassignment, release, escalation): the target must be `Routable`, or `Unknown` with `lastKnown = Routable`. The second case is applied and flagged `routabilityUnverified` in the event. Anything else is refused (user commands) or skipped (escalation).
3. **Claiming**: an authenticated actor claiming for themselves counts as a routable person, because their live session shows the account is active. Membership is this module's own data. So a directory outage never blocks self-claim (H7).

### 3.4 Task kinds

A task kind is code, declared by its owning module in that module's `api` package and registered when `app-hms` assembles, like a setting definition (tenancy §5.3) [P]. Unknown kinds are refused, and a module may create only the kinds it owns.

```kotlin
data class TaskKindDefinition(
    val code: TaskKind,                         // "<owning module area>.<name>", label-neutral
    val owner: String,                          // owning module id
    val safety: KindSafety,                     // default SafetyRelevant
    val slaClock: SlaClockPolicy,               // CONTINUOUS_ONLY (default) or BUSINESS_ALLOWED
    val defaultSla: SettingDefinition<Duration>?, // a TightenOnly duration declared by the owner (§8)
    val escalationPolicy: String?,              // a policy code (§4.2); required when SafetyRelevant
    val messageKey: String,                     // i18n catalogue key (§6.5)
)
sealed interface KindSafety {
    data class SafetyRelevant(val controls: Set<String>) : KindSafety
    data class NotSafetyRelevant(val classificationRef: String) : KindSafety   // the owner's hazard-analysis record
}
enum class SlaClockPolicy { CONTINUOUS_ONLY, BUSINESS_ALLOWED }
```

Registration rules (a violation stops `app-hms` from assembling) [P]:
- K-1: `safety` defaults to `SafetyRelevant`. `NotSafetyRelevant` must name the owner's hazard-analysis record that classified it.
- K-2: `BUSINESS_ALLOWED` needs `NotSafetyRelevant`. Allowing business time is a classification the owning module records for the CSO's review (§3.4 item 3).
- K-3: a `SafetyRelevant` kind names an escalation policy and a `defaultSla` setting that is `TightenOnly` with shorter as stricter. The platform kinds of §7 use the coded platform chain and `platform.tasks.alarm-task.sla` instead.
- K-4: the code is unique, follows the setting-key grammar, starts with the owner's area and is not on the label deny list.

### 3.5 Invariants (each enforced in the domain, for every channel; §2.1 preamble, CTRL-0003-1)

1. A task always has exactly one owner and one SLA. Creation without both is refused (`OwnerMissing`, `SlaMissing`), whatever the channel (CTRL-0003-4).
2. A task always has an escalation chain whose last step reassigns it to a terminal owner, and that terminal owner is a pool or a queue, never a single person [P] (§7 item 4).
3. Work never moves from a routable holder to one that is not routable (§3.3 rule 2). A user reassignment or release to such an owner is refused and the old owner stays (CTRL-0003-4: "a reassignment never leaves a gap without an owner"). An escalation step whose target is not routable is skipped; if it is the terminal step, it fails, the holder stays, and an escalation-failed alarm is raised (§4.2). There is no exception.
4. Every state has a path to `done` or `cancelled`; `done` and `cancelled` are final. The task machine has no non-terminal sink (the CTRL-0003-3 rule applied to tasks [P]).
5. A safety-relevant kind runs on the continuous clock. A business-calendar clock needs a `BUSINESS_ALLOWED` kind and `ROUTINE` priority [P] (§4.1).
6. At most one orphan episode is open per task (§4.3).
7. Every command appends exactly one journal entry for the task, in the same transaction, and increments `version` (§5.3 C, §22.1 item 2). One entry per aggregate per command is this module's own rule [P]; the journal itself allows consecutive versions of one aggregate in an append (journal §4.5). A command whose `expectedVersion` differs is refused with `VersionConflict(current)`.
8. A reason that a command requires is a code from the governed list and is never defaulted (the SI-02 rule for override reasons, applied here [P]).
9. Recorded times come only from the injected `Clock`. Every Task row takes its valid time at recording (`ValidTimeInput.AtRecording`; the catalogue declares task events `CLINICAL_AT_RECORDING`), because each is a system or user act at that moment. A clinical time a caller gives (when work began, `workBeganAt`; when it was done, `performedAt`) is a payload field, never the row's valid time (SI-10; D10; kernel CTRL-0010-3) [P].
10. A task whose focus belongs to another module is completed or cancelled only by that module, because its own aggregate recorded the fulfilment or ended (D14). No user permission completes or cancels it.
11. Pool and queue owners stay inside the task's tenant and scope (§3.2).

### 3.6 State machine

`docs/specs/state-machines/task.yaml` is normative. In short:

| From | Command | Guard | To |
|---|---|---|---|
| (start) | Create | permitted caller; owner in scope; SLA with a start not in the future; registered kind; clock allowed; chain ending in a terminal owner | open |
| open | Claim | `task.claim`; eligible, authenticated claimant | claimed |
| claimed | Release | claimant or supervisor; owner routable | open |
| open, claimed | Reassign | `task.reassign`; new owner present, in scope and routable; reason code | open (claim released) |
| open, claimed | CompleteByFocusOwner | the focus module records the fulfilment | done |
| open, claimed | CancelByFocusOwner | the focus module's aggregate ended | cancelled |
| open, claimed | BreachSla | due time reached, not yet recorded | same |
| open, claimed | Escalate | next step due; target routable (REASSIGN or NOTIFY), or unroutable (skipped, or failed at the terminal step) | open after a REASSIGN, else same |
| open, claimed | DetectOrphan | holder unroutable, no open episode, grace elapsed | same |
| open, claimed | ClearOrphan | open episode, holder routable | same |

§8.4 draws only open → claimed → done / cancelled. The other transitions are marked `proposed` in the YAML for the approvers. §8.4 names no approvers for the task machine; the YAML requests the CSO, the nurse panel and the physician panel as this build's proposal (OQ-TK1). `approved_by` stays empty until a human sign-off record exists (§3.5).

### 3.7 Deviation from §8.2: tasks are their own aggregate

§8.2 "Orders and tasks" says "One aggregate holds the request, its tasks and its status history". This module makes each task its own aggregate, pointing to the order through `focus`. Reasons [P]: §5.2 gives tasks, queues and `TaskOrphaned` to `platform-tasks`; the same engine must own tasks whose focus is not an order (results, referrals, dead-letter items); and the order-sign stays atomic because the Safety Kernel shares one transaction (§5.2, ADR-001 C1). What the order keeps: its status history records each task it created (the task id, in the order's own journal row) and each task outcome it acted on. The order's terminal state and its tasks' terminal states are linked by rule: an order that reaches a terminal state cancels or completes its live tasks in the same transaction (`CancelByFocusOwner`, `CompleteByFocusOwner`), so no live task outlives a final order (CTRL-0003-3, with `orders`). This deviation is reported under §3.5 "Report every deviation" (DN-TK7).

## 4. Timers

Every timer runs on the injected `Clock`. The application services `TaskTimers`, `OrphanScan` and `RequestIntake` take `now` from it; the domain takes it as a parameter. In tests the clock is `TestClock` (`hms.kernel.testing`), so every timing claim below is proven without waiting.

### 4.1 SLA and its clock

`SlaClock` is `CONTINUOUS` or `BUSINESS_CALENDAR`. `SlaSpan` is `Continuous(Duration)` with a positive duration, or `BusinessDays(Int)` with at least 1 day; anything else is refused (`SlaInvalid`).

**Start.** The SLA starts at the earliest of the instants this module can trust, never later than the creation:
- the creation instant, read from the `Clock` by the command handler (at or before the journal's recorded time, so never later);
- for a materialised request, the recorded time of its `TaskRequested` row (§5.3), read from the journal, never from the payload;
- for a dead-letter task, the first-failure time in the item's failure headers (§7.1);
- later, not in WP-0.3: a clinical time the caller gives as `workBeganAt` (work that began on paper before the task existed). In WP-0.3 `workBeganAt` is only a payload field of `TaskCreated`, never the row's valid time (invariant 9), and does not move the SLA start. Using it as the SLA start waits for the back-entry tooling and a real downtime episode (SI-10; `TRU-BCP-03`; DN-TK2; KA-TK8). A `workBeganAt` later than now is refused (`SlaStartInFuture`).
An earlier start makes the deadline earlier, never later. The due time is fixed at creation and never moved silently [P]. A task created after its due time records `slaBreachedAt` in `TaskCreated` itself (one event per command, §3.5 invariant 7).

**Continuous**: `dueAt = startsAt + duration`. Weekends, holidays and the night count.

**Business calendar** (only `BUSINESS_ALLOWED` kinds with `ROUTINE` priority, §3.5 invariant 5): `dueAt` = the same local wall-clock time on the Nth business day after `startsAt`, in the task's facility zone (R11 §1 P10; tenancy `FACILITY.zone`). A tenant-level task has no facility zone, so it runs on the continuous clock [P]. The calendar is the kernel's `BusinessCalendar`, read through tenancy's `CalendarReader` from the generic keys `calendar.weekend-days` and `calendar.holidays` (D3). The Kurdistan pack supplies their country-pack values ([L] L-20, pack items `kri.calendar.weekend` and `kri.calendar.holidays`); no day or date is in code. The task records the calendar version it used. Edge cases [P]:
- **DST.** The due time is computed by the kernel's `BusinessCalendar.plusBusinessDaysAtLocalTime(startsAt, days)`, which fixes the rule: in an overlap the earlier instant is taken; in a gap, the first instant after the gap. Both are the earlier, stricter choice. This module does not re-implement it.
- **Not configured.** When `CalendarReader` answers `NotConfigured`, the task runs on the continuous clock with the same span counted as whole days of 24 hours, which is never later, and the operational alarm `CalendarNotConfigured` is raised. It never falls back quietly to "no holidays" (tenancy §5.10).
- **Years not covered.** When the answer lists `uncoveredYears`, the earlier date it returns is used (unknown days count as business days), and this module raises one `platform.calendar-coverage` task per scope and year to the fallback supervisory queue, plus the operational alarm `CalendarYearsUncovered` (§7.4).

**Calendar awareness for safety work.** A safety-relevant timer runs continuously and is never paused by a weekend or a holiday: the SLA, every escalation step and the orphan alarm [P]. §7 item 1, §9.7 acceptance 3 and BP §6.7 ask for calendar-aware timers, including for "escalation, orphan alarms". This build reads that as: the calendar may only ever make safety timing earlier or reach more people, never later. Choosing a different chain on a weekend or a holiday (an on-call queue, shorter offsets) is that stricter form, but no API here provides it yet. So the CTRL-0004-5 mechanism is incomplete, recorded as KA-TK7, not claimed as a tightening. The reading goes to the CSO (DN-TK1).

`BreachSla` fires at the first timer tick at or after `dueAt`, so at most `T` (`platform.tasks.timers.tick-interval`) late, and records `slaBreachedAt` once (`TaskSlaBreached`). A breach does not change ownership; escalation does.

### 4.2 Escalation chains

`EscalationChain(policy: PolicyRef?, steps: List<EscalationStep>, terminal: OwnerRef)`, with `EscalationStep(offset: SlaSpan, target: OwnerRef, mode: REASSIGN | NOTIFY)` and `OwnerRef` = an `Owner` by id, or a pool or queue code (§3.2).
- A step fires at `dueAt + offset`, on the task's SLA clock [P]. Offsets are non-negative and non-decreasing.
- The last step is `REASSIGN` to the terminal owner, which is a pool or queue (invariant 2).
- **Snapshot.** Offsets, modes and the order of steps are fixed at creation, with the policy code and version, so a later policy change never silently alters work in flight [P]. Target codes resolve when the step fires, in the task's scope: the facility decides *who* holds a role code; the policy decides *when*.
- **One step per command.** Each `Escalate` applies one step and appends one `TaskEscalated` (invariant 7). The idempotency key is derived from the task id and the step index (§5.2). Catch-up after downtime applies every due step in order, one command each, in one timer pass.
- **REASSIGN, target routable** (§3.3 rule 2): ownership moves to the target and any claim is released; the former claimant is told through the event. The focus module can still record work the former claimant finished, because completion belongs to the focus module (invariant 10). Whether a REASSIGN step should instead keep a routable claimant's claim is put to the approvers (OQ-TK6).
- **NOTIFY, target routable**: the target is added to `escalationRecipients` and ownership is unchanged. Each recipient sees the task in their worklist as "escalated to me". Push delivery waits for `platform-notify` (KA-TK6).
- **Target not routable, not the last step**: the step is recorded as `SKIPPED` with the reason, the holder and any claim stay, and the next step fires at once, earlier than planned [P].
- **Target not routable, last step**: the step is recorded as `FAILED`, the holder and any claim stay, and this module raises a `platform.escalation-failed` task to the fallback supervisory queue (in the same append) and the operational alarm `EscalationFailed` (§7.3) [P]. Work is never moved to an owner that cannot act (invariant 3; DN-TK5). A failed terminal step stays pending: it is due again only once its target is routable, and then it fires. So `FAILED` is recorded once, not at every tick.
- **After the chain.** A task still live one more SLA span after its last step raises the operational alarm `TaskOverdueAtTerminalOwner` once [P].
- **Manual reassignment** does not change the next step index: the chain continues on its schedule [P]. A reassignment to a person after the chain is exhausted leaves the task with that person; the orphan scan and the overdue query still cover it.
- **Sources of a chain**, in order: an explicit chain in the create command (a module that builds its own from its policy tables, such as the critical-result chain of §9.7); the policy the kind names; for kinds that are not safety-relevant only, the facility's default policy (`platform.tasks.escalation.default-policy`). With none, creation is refused (`EscalationChainMissing`).
- **Policies are clinical content** (§3.4 item 3: "escalation policies"). They are items of the `platform-config` content type `platform.tasks.escalation-policy` (D2), versioned, with `provenance: synthetic | approved` (§19.4). The policy for a safety-relevant kind comes from the vendor foundation or the country pack only; a tenant overlay cannot replace it, but the tenant decides who holds each role code [P] (OQ-TK7). This build writes only synthetic samples marked NOT FOR CLINICAL USE and logs a content request (CR-TK1). Promotion to TRAIN or PROD fails while a synthetic item is present (§19.4; `platform-config` INV-13).
- The engine executes chains; it never decides a clinical threshold. Where a chain belongs to a Boundary Register sweep candidate (the critical-result chain, CTRL-0004-7), the classification is the owning module's, and Tier 2 escalation requests arrive through the narrow contract of §5.4 (§5.2; BP §5.5).

### 4.3 TaskOrphaned

**Definition.** An *orphan episode* is one continuous period in which work has no owner who can act. It has one of two causes:
- **Holder unroutable**: a live task (`open` or `claimed`) whose holder is `Unroutable` (§3.3). This covers the CTRL-0003-5 list: an owner deactivated, a pool empty, a queue unmonitored, a claimant deactivated, and a dead-letter task whose owner cannot act.
- **Request not materialised**: a `TaskRequested` row (§5.3) that has no task after the grace `G`, or whose creation was refused.
Work that never reached this module as a task or a request is the owning module's invariant to prevent (§1).

**Scopes.** Detection runs per scope: `ScanScope.Facility(tenant, facility)` covers the facility's tasks; `ScanScope.Tenant(tenant)` covers tenant-level tasks and requests without a facility [P]. Each scope has its own schedule, watermark, candidates, heartbeat and watchdog, under the same settings. `TaskTimers` uses the same scopes.

**Episode start.** The start `t0` of a holder-unroutable episode is the instant from which the routing directory's source (the Trust Plane) reports the holder unroutable. The domain uses a lower bound, so the alarm can be early but never late:
1. the `since` the directory reports with the `Unroutable` answer, when it reports one;
2. otherwise the start of the previous completed scan of the scope (the watermark), at which the holder was routable or the task did not exist;
3. but never earlier than the task's creation or its last holder change (creation, claim, release, reassignment, escalation).
A candidate keeps its start until the holder is seen `Routable` at two consecutive scans [P]. So a holder that flips between unroutable and routable at every scan still alarms at `start + G`.
A request-not-materialised episode starts at the request's recorded time.

**Detection loop.** `OrphanScan.run(scope)` starts at fixed-rate instants, one every `S`, with at most one scan per scope at a time [P]. It reads `now` from the `Clock` once at its start. It evaluates routability once per distinct holder of live tasks (one directory lookup per holder, not per task). Then:
- for each live task with an `Unroutable` holder and no open episode: if `now − start ≥ G`, or the task has `ownerUnroutableAtCreation`, it applies `DetectOrphan`; otherwise it records the task as a candidate with its start;
- for each live task with an open episode and a `Routable` holder, it applies `ClearOrphan`;
- for each `TaskRequested` row of the scope older than `G` with no task and no open episode, it raises a request-not-materialised episode (§4.4).
Candidates and the watermark are persisted (`ScanStateRepository`), so a restart never moves a start later. With no watermark (first start, or lost state), rule 3 applies alone: the start is the creation or last holder change.

**Directory unknown.** When the directory answers `Unknown` for a holder, the scan opens no per-task episode for it. Instead, at the first scan that sees it, without grace, it raises one `platform.orphan-detection-blind` task per scope to the fallback supervisory queue and the operational alarm `OrphanDetectionBlind` ("orphan detection blind, manual check required"), so within the same bound. The alarm task closes itself when the directory answers again (§7.4; DN-TK3). Tasks whose holder was already `Unroutable` keep their episodes and candidates.

**The 5-minute bound.** The settings (§8) are:
- `L`, `platform.tasks.orphan-alarm.max-delay`: vendor-locked at 5 minutes, tighten-only (§2.1 SI-03);
- `S`, scan interval;
- `G`, grace;
- `B`, scan budget;
- `F`, leader takeover: the longest time a new scan leader needs to take over after the leader is lost;
- `C`, `platform.tasks.routing.directory-max-staleness`: the oldest person status the directory adapter may answer from.
Each is vendor-locked and tighten-only. `OrphanTimingPolicy` refuses any combination with `C + S + G + B + F > L` (§8).

Proof for a holder that becomes unroutable at `t0` (start ≤ `t0`):
- The adapter reports it by `t0 + C`.
- Detection is allowed from `max(t0 + C, start + G) ≤ t0 + C + G`.
- Scans start every `S`. After a lost leader, the gap grows by at most `F`. So a scan that sees the holder unroutable starts by `t0 + C + G + S + F`.
- It finishes within `B`. So `TaskOrphaned` is recorded by `t0 + C + G + S + B + F ≤ L`.
The same argument holds for a request-not-materialised episode with `t0` = the request's recorded time and `C` = 0.

`detectedAt` is the recorded time of the `TaskOrphaned` journal row, not the scan's start, so the bound is measured on what was committed. The bound holds under four conditions, each with its own alarm when it fails:
1. **No scan overruns `B`.** A longer scan raises `OrphanScanOverrun`, which is itself an SI-03 breach report.
2. **Leadership is regained within `F`.** The scan heartbeat (the last completed scan per scope) is watched from outside the scanning process. No completed scan within `S + B + F` raises `OrphanDetectionStalled` (§6.7) [P]. The watchdog waits for the cell (KA-TK2).
3. **The database accepts the commit.** An in-cell database failover may take up to 5 minutes (§16.4 RTO ≤ 5 min), which no budget that fits in `L` can absorb. When a scan cannot commit, it raises `OrphanDetectionDegraded` through `OperationalAlarms` directly, a path that does not need the database, and keeps its candidates in memory to retry. During such an outage `TaskOrphaned` can be late. This residual risk is recorded in HAZ-TK7.
4. **The directory adapter honours `C`.** Lag in the Trust Plane before the directory reports a deactivation is upstream of `t0`. It is a requirement on the Trust Plane (WP-0.4) and a hazard cause (HAZ-TK6). The chaos test measures it from the deactivating action.

On a `TestClock`, `C`, `F` and the scan duration are zero. The unit and property tests then assert the stricter `detectedAt − t0 ≤ S + G`. The [P] defaults (§8) sum to 4 minutes, which leaves 1 minute for the operational alarm to reach a human. The chaos test measures that delivery too (§12).

**Never for routable owned work.** `DetectOrphan` requires the holder to be `Unroutable` at the scan. A task whose holder is routable at every scan never raises `TaskOrphaned` (property test, §11).

**The alarm.** `TaskOrphaned` is a first-class alarm (§5.3, §8.5; K §7.5). `DetectOrphan` is one command and one append, with two entries on two aggregates (invariant 7):
1. `TaskOrphaned` on the orphaned task (or on the `TaskRequest`, §4.4): the episode opens;
2. `TaskCreated` for an **orphan-alarm task** (kind `platform.task-orphaned`, focus = the orphaned task or request, subject = the same patient), owned by the **fallback supervisory queue** of the scope (`platform.tasks.orphan-alarm.fallback-queue`, the code resolved at the facility, else the tenant level).
After commit, the **operational alarm relay** reads the committed `TaskOrphaned` row and raises a PHI-free operational alarm through `OperationalAlarms` (scope, owning module, kind category, reason, episode id; no patient data, no kind code, SI-20, SI-21). It is at-least-once, with the episode id as the deduplication key at the alarm sink, and retries until the sink accepts. So a lost emission is retried and a duplicate is suppressed. A rolled-back append emits nothing. When one scan opens many episodes in a scope for the same reason (a mass deactivation), the relay sends one aggregated alarm with the count and the episode ids; each episode still has its own `TaskOrphaned` row and alarm task [P].

**System actor.** The scan, the timers, the intake, the relay and the dead-letter sink act as the SYSTEM actor of this module (`ActorRef.system(...)`, kind `SYSTEM`; D1, D14). `OrphanScan`, `TaskTimers`, `RequestIntake`, the operational alarm relay and the `DeadLetterTaskSink` implementation live in `hms.platform.tasks.application.system`, the package on the kernel's `SYSTEM_PROCESSES` allow-list (kernel §7.2). They are authorised by module identity in wiring and never consult the user-authorisation port (§9). Platform alarm kinds are never refused for missing settings (§7). If an alarm path is refused anyway, it raises the operational alarm `AlarmPathRefused` with the reason, keeps the episode open and retries at the next scan. Nothing is dropped.

**No fallback queue.** A bundle that leaves an active facility (or a tenant with tenant-level work) without a fallback supervisory queue code cannot be activated: a `platform-config` activation check that this module supplies refuses it (`FallbackQueueActivationCheck`) [P]. If the code still does not resolve to a live queue at run time, `TaskOrphaned` is still appended and the operational alarm is raised with `FALLBACK_QUEUE_MISSING`. The alarm task is created at the first scan after the queue exists. Nothing is dropped.

**No recursion.** An orphan-alarm task that is itself orphaned (the fallback queue has no routable monitor) gets its own episode and `TaskOrphaned`, but no second alarm task. It raises the operational alarm `FallbackQueueUnroutable` [P].

**Deduplication.** The episode lives on the orphaned aggregate, so two scans on two replicas that race are serialised by its version: one wins, the other gets `VersionConflict`, rolls back the whole append and re-reads. The append's idempotency key is derived from the episode. One episode gives one `TaskOrphaned` row, one alarm task and one operational alarm at the sink (or one entry in an aggregated alarm).

**Clearing.** The episode closes when:
- the holder is `Routable` at a scan: `ClearOrphan`, which appends `TaskOrphanCleared` (cause `HOLDER_ROUTABLE`);
- a claim, reassignment or escalation gives a routable holder, or the task becomes final. That command's own event carries `orphanEpisodeClosed` with the cause (`CLAIMED`, `REASSIGNED`, `ESCALATED`, `FINAL`), because a command appends one entry per aggregate (invariant 7);
- for a request episode: the request is materialised, withdrawn or resolved (§4.4).
In the same append, this module completes the orphan-alarm task with outcome `CLEARED`. A later loss of the holder opens a new episode and a new alarm. The closed episode's length is added to `orphanedTotal`.

**Faster paths [P].** When this module learns of a deactivation directly (a Trust Plane event from WP-0.4), or creates a task whose owner is unroutable, it may scan the affected tasks at once. The periodic scan remains the guarantee.

### 4.4 Task requests: intake and reconciliation

Modules outside the Safety Kernel never share a transaction with it (§5.2). They request, complete and cancel tasks by writing request rows into the journal in their own transaction (§5.3). This module turns them into task commands (D14):
- **Intake.** `RequestIntake` reads the request rows from the journal in the same database through its consumer tail, `JournalTails.forConsumer("platform-tasks", {TaskRequested, TaskCompletionRequested, TaskCancellationRequested})` (journal §5; the catalogue names this module as their in-database consumer), not by aggregate type. It reads after its watermark (the tail position), every `I` (`platform.tasks.intake.poll-interval`), as the SYSTEM actor. It applies each request idempotently on the request id: create the task with the request's task id, or complete or cancel it. It does not go through Kafka.
- **Ordering.** Requests are applied in journal order. A completion or cancellation for a task that is not yet materialised waits until its creation is applied.
- **Refusal.** A creation refused by the domain (any `CreateRejection`) opens a request-not-materialised episode at once, without grace: `TaskOrphaned` on the `TaskRequest` (cause `REQUEST_REFUSED`, with the reason) plus an orphan-alarm task (§4.3) [P]. So a refused request is owned work within seconds, never dead-lettered quietly.
- **Reconciliation.** Each orphan scan (§4.3) also looks back for `TaskRequested` rows older than `G` with no task and no episode, and opens a `REQUEST_NOT_MATERIALISED` episode. This catches a stalled intake, a crashed process, or a row that the watermark skipped because its transaction committed late. The look-back covers at least `L` behind the intake watermark [P].
- **Clearing.** A request episode clears when the task is created (cause `MATERIALISED`), when the producer withdraws the request (`TaskCancellationRequested` for it), or when a supervisor records a resolution after acting in the producing module (`ResolveOrphanedRequest`, §5.2).
- **Liveness.** The intake records a heartbeat. No progress for `L` while rows are pending raises `TaskIntakeStalled`. A gap in the journal sequence behind the watermark raises `JournalGapSuspected` (D15). Both wait for the cell (KA-TK2).
- **SLA start.** A materialised task's SLA starts at the request's recorded time (§4.1), so delay in the intake never extends the SLA.

### 4.5 Leadership and clock health

One node runs the scan, the timers and the intake for a scope at a time, under a lease from the `ScanLeadership` port [P]. The lease is never longer than `F`; `app-hms` refuses to start if the adapter's lease is longer. A new leader starts a scan as soon as it holds the lease. The adapter never grants or renews a lease on a node that the clock-skew monitor has blocked from clinical writes (ADR-026; `platform-site`). So a leader whose clock drifts loses the lease, and a healthy node takes over within `F`. Task writes count as clinical writes [P]. The adapter and the skew monitor wait for the cell (KA-TK2).

**Backward clock step (kernel HC-KN4, KA-KN6) [P].** A cell-wide step back (an NTP step, GPS reacquisition) would delay every pending timer by the size of the step. Each scope persists the latest instant its scan, timers and intake have observed (in `scan_state`, with the heartbeat). A pass whose `Clock` reading is earlier than that instant, or whose append the journal answers with `RecordedTimeRegression`, has detected a backward step. It then raises the operational alarm `ClockSteppedBack` through `OperationalAlarms` directly (the path that needs no database, as for `OrphanDetectionDegraded`), and evaluates due times (SLA, escalation steps, grace) against the later of the reading and the persisted instant, so no time is lost. A regressed append is retried at the next pass; nothing is dropped. Test: `UnitTest:backward-clock-step-detected-and-alarmed`; `PropertyTest:SI-03-orphan-alarm-within-5-minutes` includes a `TestClock.setTo`-backwards case.

### 4.6 Settings that cannot be read

Timing values reach the domain only as `OrphanTimingPolicy` and `TimerPolicy` objects. Their constructors are private. They are built only by their `@SafetyParameterFactory` functions `fromResolved(..., environment: EnvironmentClass)` from kernel `ResolvedParameter`s, and validated in `init` (D11; kernel §6.5). If resolution fails (`NotConfigured`, `Refused`, tenancy unavailable), or the resolved values break the sum, the scan and the timers keep running. They use, for each value, the stricter of the resolved value and the coded vendor default. They raise `OrphanSettingsUnavailable` or `OrphanSettingsInconsistent` [P]. Each value is then no looser than the vendor's, so the SI-03 5-minute bound holds. A tenant tightening below 5 minutes may not be met, which is what the alarm says. Failing closed never means stopping an alarm loop.

## 5. Public API (`hms.platform.tasks.api`)

Kept small and stable: other modules code against it (D17). Kotlin-like notation; names change only by updating this specification first.

### 5.1 Types

```kotlin
@JvmInline value class TaskId(override val value: UUID) : TypedId            // init: UuidV7.requireV7
@JvmInline value class PoolId(override val value: UUID) : TypedId
@JvmInline value class QueueId(override val value: UUID) : TypedId
@JvmInline value class TaskRequestId(override val value: UUID) : TypedId
@JvmInline value class TaskKind(val code: String)                 // registered (§3.4)
@JvmInline value class RoutingCode(val code: String)              // pool or queue code (§3.2)
@JvmInline value class ReasonCode(val code: String)               // from the governed list (invariant 8)
@JvmInline value class OutcomeCode(val code: String)              // the focus module's completion or ending code
@JvmInline value class EncounterRef(val value: UUID)              // until adt's encounter id exists [P]

sealed interface Owner {
    data class Person(val user: UserId) : Owner
    data class Pool(val pool: PoolId) : Owner
    data class Queue(val queue: QueueId) : Owner
}
sealed interface OwnerRef {
    data class ById(val owner: Owner) : OwnerRef
    data class PoolCode(val code: RoutingCode) : OwnerRef
    data class QueueCode(val code: RoutingCode) : OwnerRef
}
data class FocusRef(val module: String, val aggregateType: String, val aggregateId: UUID)
enum class TaskPriority { ROUTINE, URGENT, ASAP, STAT }

sealed interface SlaSpan {
    data class Continuous(val duration: Duration) : SlaSpan     // > 0
    data class BusinessDays(val days: Int) : SlaSpan            // >= 1
}
data class SlaRequest(val span: SlaSpan?, val workBeganAt: ClinicalTime? = null)   // span null = the kind's default
sealed interface EscalationRequest {
    data object KindDefault : EscalationRequest
    data class Policy(val code: String, val version: Int) : EscalationRequest
    data class Explicit(val steps: List<EscalationStepSpec>, val terminal: OwnerRef) : EscalationRequest
}
data class EscalationStepSpec(val offset: SlaSpan, val target: OwnerRef, val mode: EscalationMode)
enum class EscalationMode { REASSIGN, NOTIFY }
```

`owner`, `sla` and `reason` are nullable on purpose. A request from any channel (API, event, loader) reaches the domain, which refuses the missing value itself (invariant 1; CTRL-0003-1 "for every channel").

### 5.2 Commands

```kotlin
data class CreateTask(
    val id: TaskId,                                   // chosen by the caller
    val kind: TaskKind, val facility: FacilityId?, val subject: PatientId?, val encounter: EncounterRef?,
    val focus: FocusRef, val owner: OwnerRef?, val sla: SlaRequest?, val priority: TaskPriority,
    val escalation: EscalationRequest = EscalationRequest.KindDefault,
)
data class CompleteByFocusOwner(val task: TaskId, val expectedVersion: Long?, val outcome: OutcomeCode, val performedAt: ClinicalTime? = null)
data class CancelByFocusOwner(val task: TaskId, val expectedVersion: Long?, val outcome: OutcomeCode)
data class ClaimTask(val task: TaskId, val expectedVersion: Long)                            // claimant = ctx.actor
data class ReleaseTask(val task: TaskId, val expectedVersion: Long)
data class ReassignTask(val task: TaskId, val expectedVersion: Long, val newOwner: OwnerRef?, val reason: ReasonCode?)
data class ResolveOrphanedRequest(val request: TaskRequestId, val reason: ReasonCode?)          // task.supervise

/** For orders, medications and results only (§5.2 shared transaction; ArchUnit rule, §11). */
interface KernelTaskCommands {
    fun create(tx: TransactionContext, ctx: CommandContext, cmd: CreateTask): CreateTaskResult
    fun completeByFocusOwner(tx: TransactionContext, ctx: CommandContext, cmd: CompleteByFocusOwner): TaskCommandResult
    fun cancelByFocusOwner(tx: TransactionContext, ctx: CommandContext, cmd: CancelByFocusOwner): TaskCommandResult
}

/** User actions, called by this module's own web adapter; each runs in its own transaction. */
interface TaskCommands {
    fun claim(ctx: CommandContext, cmd: ClaimTask): TaskCommandResult
    fun release(ctx: CommandContext, cmd: ReleaseTask): TaskCommandResult
    fun reassign(ctx: CommandContext, cmd: ReassignTask): TaskCommandResult
    fun resolveOrphanedRequest(ctx: CommandContext, cmd: ResolveOrphanedRequest): TaskCommandResult
}
```

- **Who calls what.** `KernelTaskCommands` is for the Safety Kernel modules, inside their own transaction (§5.2; ADR-001 C1). `TaskCommands` is for people, through this module's web adapter. Every other module uses the request rows of §5.3. The timers, the scan, the intake and the sink are application services inside this module, not api.
- **Transactions.** `KernelTaskCommands` never opens a transaction: it changes the task tables and calls `JournalAppender.append(tx, context, request: AppendRequest)` with the caller's `TransactionContext` (journal §5, §6). `TaskCommands` opens its own through `TransactionRunner`.
- **Idempotency.** Each task command is its own journal append. Its idempotency key is derived from the caller's key: `IdempotencyKey` of `"tasks:" + base64url(SHA-256(callerKey + "|" + operation + "|" + taskId))` [P]. It is deterministic, never longer than the journal's limit, and distinct from the caller's own key, so the caller's append and the task's append in one transaction never collide (journal §4.6). A repeated command returns the first result from the journal (`JournalReaders.forModule("platform-tasks")` → `ModuleJournalReader.byIdempotencyKey(tx, actor, key)`). A key reused with a different payload is refused (`IdempotencyKeyReused`). Refusals write nothing and are evaluated again when repeated [P]. The module keeps no idempotency store of its own.
- **Facility.** The task's facility is `CreateTask.facility`. When `ctx.facility` is set and differs, creation is refused (`FacilityMismatch`) [P].
- **Version of by-focus-owner commands.** `expectedVersion` null means the current version, read under a row lock in the caller's transaction [P]. A focus module does not track task versions.
- **Reasons.** `ReasonCode` is the coded form of the kernel's `ChangeReason`. The journal row's reason is the code, never free text, so no PHI enters it [P]. The governed list of reassignment and resolution reasons is declared in code by this module in WP-0.3. Its entries are operational, not clinical, and go to the approvers with `task.yaml` (OQ-TK12).
- **Clinical time.** Every Task row is appended with `ValidTimeInput.AtRecording`: its valid time is the journal's single recorded-time read, because it is a system or user act at that moment (invariant 9; §15 A-3). `performedAt` (copied from the focus module's fulfilment) and `workBeganAt` are payload fields of `TaskCompleted` and `TaskCreated`, never a valid time. So the SYSTEM-actor intake never supplies a clinical time, which the kernel would refuse (`SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME`), and no task command needs an entry-time policy. The focus module's own row carries the act's clinical time.

### 5.3 Requests from modules outside the Safety Kernel

A non-kernel module writes one of these as a journal row in its own transaction, through `JournalAppender` (ADR-TK1; D14). Each row starts its own aggregate of type `TaskRequest` (id = `TaskRequestId`, version 1). So it never collides with the caller's own aggregate in the same append. The producer writes only version 1; this module may append `TaskOrphaned` and `TaskOrphanCleared` as later versions (§4.4). The schemas are this module's; the producer is the requesting module (`producer_module`).

| Event | Payload | Rule |
|---|---|---|
| `TaskRequested` | the `CreateTask` fields, including the caller-chosen `TaskId`; schema version | The task exists if and only if the caller's change committed. Its SLA starts at this row's recorded time (§4.1) |
| `TaskCompletionRequested` | task id, outcome code, performed-at (a payload field, not the row's valid time) | Applied only if the producer is the task's focus module (invariant 10) |
| `TaskCancellationRequested` | task id or request id, outcome code | As above. Naming a request withdraws it |

These rows reach this module after the caller commits, so a task is never completed for work whose transaction rolled back (H5). A focus module whose fulfilment is later marked entered-in-error requests a new task for the work that is now undone. It never reopens a final task (invariant 4).

### 5.4 The Tier 2 escalation-request contract

BP §5.5 and §5.2 ask for "a narrow, versioned task API whose contract is part of Tier 2 verification". That contract is one message, not this whole api [P]:

```kotlin
data class EscalationTaskRequestV1(
    val schemaVersion: Int = 1, val requestId: UUID, val sourceModule: String, val sourceModuleVersion: String,
    val kind: TaskKind, val tenant: TenantId, val facility: FacilityId, val subject: PatientId?,
    val focus: FocusRef, val priority: TaskPriority,
)
```

Its owner, SLA and chain come from the kind's definition, never from the sidecar. Inside the Tier 1 host it becomes a `TaskRequested` row (§5.3). Its schema is versioned on its own, and changes to `TaskCommands` never touch it. The transport from a sidecar process to the host is the Tier 2 work package's to fix (OQ-TK10).

### 5.5 Results and refusals

```kotlin
sealed interface CreateTaskResult {
    data class Created(val task: TaskId, val version: Long, val ownerUnroutable: Boolean) : CreateTaskResult
    data class Rejected(val reason: CreateRejection) : CreateTaskResult
}
sealed interface CreateRejection {
    data object OwnerMissing : CreateRejection
    data class OwnerUnknown(val ref: OwnerRef) : CreateRejection
    data class OwnerOutOfScope(val ref: OwnerRef) : CreateRejection
    data object SlaMissing : CreateRejection
    data class SlaInvalid(val span: SlaSpan) : CreateRejection
    data object SlaStartInFuture : CreateRejection
    data object KindUnknown : CreateRejection
    data object KindNotOwnedByCaller : CreateRejection
    data object ContinuousClockRequired : CreateRejection
    data object EscalationChainMissing : CreateRejection
    data class EscalationChainInvalid(val problem: ChainProblem) : CreateRejection
    data class EscalationPolicyNotFound(val code: String, val version: Int?) : CreateRejection
    data class SettingUnavailable(val key: String) : CreateRejection          // NotConfigured or Refused
    data object FacilityMismatch : CreateRejection
    data object IdempotencyKeyReused : CreateRejection
}
enum class ChainProblem { NEGATIVE_OFFSET, OFFSETS_DECREASING, LAST_STEP_NOT_REASSIGN, TERMINAL_NOT_POOL_OR_QUEUE, TARGET_OUT_OF_SCOPE }

sealed interface TaskCommandResult {
    data class Applied(val task: TaskId, val version: Long) : TaskCommandResult
    data class Refused(val reason: TaskRefusal) : TaskCommandResult
}
sealed interface TaskRefusal {
    data object TaskNotFound : TaskRefusal
    data class VersionConflict(val current: Long) : TaskRefusal
    data class NotAllowedInState(val state: TaskState) : TaskRefusal
    data object ClaimantNotEligible : TaskRefusal
    data object NotClaimantOrSupervisor : TaskRefusal
    data class OwnerNotRoutable(val reason: UnroutableReason) : TaskRefusal     // release
    data object NewOwnerMissing : TaskRefusal
    data class NewOwnerUnknown(val ref: OwnerRef) : TaskRefusal
    data class NewOwnerOutOfScope(val ref: OwnerRef) : TaskRefusal
    data class NewOwnerNotRoutable(val reason: UnroutableReason) : TaskRefusal
    data object ReasonRequired : TaskRefusal
    data object ReasonNotInList : TaskRefusal
    data object NotFocusOwner : TaskRefusal
    data object NotAuthorised : TaskRefusal
    data object IdempotencyKeyReused : TaskRefusal
}
```

An unroutable owner at creation is not a rejection: the work is created and the first scan opens its episode without grace (§4.3), because refusing it would lose it (H5). `KindUnknown` and every other rejection are fail-closed refusals with named tests (§11).

### 5.6 The kernel caller's contract

A kernel caller that gets anything but `Created` from `create` must refuse its own command and return `TxOutcome.Rollback`. So an order-sign never commits without its verification task (CTRL-0003-4; H5). The helper `CreateTaskResult.requireCreated()` returns the created task or a `TaskCreationRefused` business outcome for the caller to return. The contract kit `KernelTaskCallerContract`, in `hms.platform.tasks.testing` (test only, D8), gives each kernel caller a test double that rejects. Each of `orders`, `medications` and `results` runs it in its own suite (`PropertyTest:SI-03-kernel-caller-rolls-back-on-task-rejection`). For `completeByFocusOwner` and `cancelByFocusOwner`, the caller re-reads and retries on `VersionConflict`. It returns any other refusal to its user. A task left live is never lost work.

### 5.7 Routing administration

```kotlin
sealed interface Monitor { data class Person(val user: UserId) : Monitor; data class Pool(val pool: PoolId) : Monitor }
sealed interface RoutingTarget { data class Pool(val pool: PoolId) : RoutingTarget; data class Queue(val queue: QueueId) : RoutingTarget }

interface WorkRoutingCommands {
    fun definePool(ctx: CommandContext, facility: FacilityId?, code: RoutingCode, nameKey: String): RoutingResult
    fun addPoolMember(ctx: CommandContext, pool: PoolId, expectedVersion: Long, member: UserId): RoutingResult
    fun removePoolMember(ctx: CommandContext, pool: PoolId, expectedVersion: Long, member: UserId): RoutingResult
    fun defineQueue(ctx: CommandContext, facility: FacilityId?, code: RoutingCode, nameKey: String): RoutingResult
    fun assignQueueMonitor(ctx: CommandContext, queue: QueueId, expectedVersion: Long, monitor: Monitor): RoutingResult
    fun unassignQueueMonitor(ctx: CommandContext, queue: QueueId, expectedVersion: Long, monitor: Monitor): RoutingResult
    fun retire(ctx: CommandContext, target: RoutingTarget, expectedVersion: Long): RoutingResult
}
sealed interface RoutingResult {
    data class Applied(val id: UUID, val version: Long) : RoutingResult
    data class Refused(val reason: RoutingRefusal) : RoutingResult
}
sealed interface RoutingRefusal {
    data class WouldLeaveWorkUnroutable(val liveTasks: Int) : RoutingRefusal
    data class VersionConflict(val current: Long) : RoutingRefusal
    data object NotFound : RoutingRefusal
    data object ScopeNotFound : RoutingRefusal
    data object DuplicateCode : RoutingRefusal
    data object AlreadyRetired : RoutingRefusal
    data object OutOfScope : RoutingRefusal
    data object NotAuthorised : RoutingRefusal
}
```

`nameKey` is a catalogue key, never a literal (§6.5). `WouldLeaveWorkUnroutable` is checked against live tasks in the same transaction. Removing a pool member also checks every queue that pool monitors. The pool's or queue's version serialises concurrent changes to it. A race across two aggregates (a queue and the pool that monitors it) is not serialised; the orphan scan is the backstop [P].

### 5.8 Queries

```kotlin
interface TaskQueries {
    fun task(ctx: CommandContext, id: TaskId): TaskView?
    fun worklist(ctx: CommandContext, q: WorklistQuery): Page<TaskSummary>        // own, pool, queue and "escalated to me"; cursor paging (§6.3)
    fun tasksForFocus(ctx: CommandContext, focus: FocusRef): List<TaskSummary>
    fun overdue(ctx: CommandContext, scope: ScanScope, cursor: Cursor?): Page<TaskSummary>
    fun orphanedWork(ctx: CommandContext, scope: ScanScope?, longerThan: Duration?): List<OrphanedWorkView>
}
```

Reads take the kernel `CommandContext` (D1), whose idempotency key they ignore. `orphanedWork` feeds the safety dashboard and the Level-3 trigger "orphaned items >2 h with patient impact" (§16.4, §18.13; CTRL-0003-7). It reports every open episode and every task whose `orphanedTotal` plus its open episode exceeds the duration, flags those with a subject, and leaves the judgement of patient impact to a human [P]. Work with no subject (an unparsed message) is reported too. Worklists are read models over open tasks, rebuildable from the journal (§2.2 rule 1; journal §8).

### 5.9 Ports this module needs (in `application`, adapters in `infrastructure`)

| Port | Purpose | WP-0.3 adapter | Later |
|---|---|---|---|
| `TaskRepository`, `RoutingRepository`, `ScanStateRepository`, `IntakeStateRepository` | Aggregates, scan watermark, candidates, heartbeat, intake watermark | jOOQ on the `tasks` schema (§10); in-memory in `...inmemory` for tests | Integration tests on the cell |
| `JournalAppender`, `JournalReaders` (→ `ModuleJournalReader`), `JournalTails` (→ `JournalTail`) (`hms.kernel.journal`) | One entry per command per aggregate in the same transaction; idempotency look-up; request intake through the consumer tail (§4.4) | The journal's in-memory adapter in tests | The journal's jOOQ adapter |
| `RoutingDirectory` | Person status: active, inactive, unknown, or unavailable with the last status; staleness ≤ `C` | In memory (tests) | Trust Plane (WP-0.4) |
| `TaskSettings` | Resolved settings (§8) and the business calendar, through `ConfigurationReader` and `CalendarReader` (`hms.platform.tenancy.api`, D5); escalation policies through `platform-config` (§15 A-6) | Resolver over tenancy's in-memory store in tests | — |
| `TaskAuthorization` | User policy decisions (§9) | Allow-list in tests; `DenyAllTaskAuthorization` in production wiring | Trust Plane SDK (WP-0.4) |
| `OperationalAlarms` | PHI-free operational alarms with a deduplication key | Recording adapter in tests | OpenTelemetry to the cell's alerting (§6.7; `PLT-OPS-05`) |
| `ScanLeadership` | Lease per scope; refused on a write-blocked node (§4.5) | Single-process adapter in tests | Leader lease on the cell |

**In-memory adapters (D8).** They live in `hms.platform.tasks.infrastructure.inmemory` and `hms.platform.tasks.testing`, for tests and the dev profile only. Each in-memory repository implements the kernel's marker `hms.kernel.context.VolatileStore` (`platform-kernel.md` §7.5). That covers the repositories, the directory, the fixed-value settings, the alarm recorder and the allow-list authorisation. `app-hms` production wiring never binds them, except in `app-hms`'s dev and test wiring package (`ArchTest:production-never-binds-test-adapters`, the kernel's rule, kernel §11). Each in-memory repository implements the shared `VolatileStore` marker (config §11). `TasksPersistenceGuard` refuses to start when any bound task repository is a `VolatileStore` while an environment class is set (BUILD, TEST, TRAIN, PROD or PLAY); volatile stores are allowed only in the dev profile with no environment class. Until the jOOQ adapters pass their integration tests, `app-hms` has no task persistence, so the guard refuses to start with `platform-tasks` wired, rather than run on memory (KA-TK1; `UnitTest:app-hms-refuses-to-start-without-task-persistence`).

## 6. Events published

Each command writes one journal entry per aggregate. The entry is also the outbox row (§5.3, ADR-004). The type, partition key and envelope rules are `hms.kernel.events`' (`PLT-CORE-04`; `envelope.md`). Partition key (D6): the patient id when the aggregate has a subject, else the aggregate id.

| Event | Aggregate | When | Payload (ids, codes and times only) |
|---|---|---|---|
| `TaskCreated` | Task | Create, materialised request, platform alarm task | task, kind, facility, subject?, focus, owner, priority, SLA (start, start source, due, clock), chain policy code and version, owner-unroutable flag, `slaBreachedAt` when created overdue, request id?, `workBeganAt`? (event data, not the valid time) |
| `TaskClaimed` | Task | Claim | task, claimant, `orphanEpisodeClosed`? |
| `TaskReleased` | Task | Release | task, former claimant, by-supervisor flag, `routabilityUnverified` |
| `TaskReassigned` | Task | Reassign | task, from owner, to owner, reason code, `routabilityUnverified`, `orphanEpisodeClosed`? |
| `TaskCompleted` | Task | CompleteByFocusOwner; platform completion of its alarm tasks | task, by (the focus module, or this module for its own alarm tasks), on-behalf-of, outcome code, performed-at? (event data, not the valid time), `orphanEpisodeClosed`? |
| `TaskCancelled` | Task | CancelByFocusOwner | task, by (focus module), outcome code, `orphanEpisodeClosed`? |
| `TaskSlaBreached` | Task | BreachSla | task, due, breached-at |
| `TaskEscalated` | Task | Escalate | task, step index, mode, target, outcome (`FIRED`, `SKIPPED`, `FAILED`), reason when not fired, new owner after a REASSIGN, `routabilityUnverified`, `orphanEpisodeClosed`? |
| `TaskOrphaned` | Task or TaskRequest | DetectOrphan; a request refused or not materialised (§4.4) | episode, cause, holder kind, reason, episode start (lower bound), alarm task |
| `TaskOrphanCleared` | Task or TaskRequest | ClearOrphan; a request materialised, withdrawn or resolved | episode, cause |
| `PoolDefined`, `PoolMemberAdded`, `PoolMemberRemoved`, `PoolRetired` | Pool | Routing administration | pool, scope, code, member |
| `QueueDefined`, `QueueMonitorAssigned`, `QueueMonitorUnassigned`, `QueueRetired` | Queue | Routing administration | queue, scope, code, monitor |
| `TaskRequested`, `TaskCompletionRequested`, `TaskCancellationRequested` | TaskRequest | Written by other modules (§5.3); schema owned here | §5.3 |

Every row above that this module writes uses `ValidTimeInput.AtRecording` (invariant 9), so the journal classifies it `CONTEMPORANEOUS` (D10) and the envelope's `entrytiming` carries that code; this module never sets it. Times such as the due time, the breach time and `performedAt` are event data.

- **Names.** `TaskOrphaned` is the §8.5 catalogue's name, a first-class alarm with no HL7 v2 trigger. The others are names this module proposes, in R11 §14's style. None duplicates a BP name. Domain-specific escalation events stay with their owners (`CriticalResultEscalated` is `results`', §8.4).
- **Catalogue corrections** for `docs/specs/events/catalogue.md` §4 (the owning spec wins; for the integrator): `TaskEscalated` is "a step of the escalation chain fired, was skipped or failed", not "(SLA breached)"; `TaskCompleted` is "open or claimed → done, by the focus module"; `TaskCancelled` is "open or claimed → cancelled, by the focus module"; `TaskOrphaned` names its two causes and both aggregates; add `TaskReleased`, `TaskSlaBreached`, `TaskOrphanCleared`, the eight pool and queue events (never patient-keyed) and the three request events (patient-keyed when the request has a subject).
- **No PHI beyond ids.** No names, no free text, no clinical content (§6.2; SI-20).
- The FHIR R4 `Task` projection is the Hub's (§8.8, §12.3; ADR-005), specified with the façade, not here.

## 7. Tasks the platform raises

Platform kinds are declared by this module in code (§3.4). They are never refused for missing settings, because an alarm that cannot be raised is worse than one with a strict default [P]. Each runs on the continuous clock. Its SLA is `platform.tasks.alarm-task.sla`; when that is not configured, the task is due at creation, the strictest value, and the operational alarm `AlarmTaskSlaNotConfigured` is raised. Its chain is one terminal step, at offset zero, to the fallback supervisory queue. No value is chosen here (CR-TK1).

### 7.1 Dead-letter items (§5.3, §6.7; CTRL-0003-5)

"Undeliverable messages land in owned queues that alarm after 5 minutes" (§5.3); §6.7 alarms on "dead-letter queue items older than 5 minutes". The events backbone calls this module through `hms.kernel.events.DeadLetterTaskSink`, a port the events library defines and this module implements in `hms.platform.tasks.application.system` (kernel libraries depend on no module) (envelope §12; §15 A-5). The Hub uses the same port (§12.1, `INT-ENG-01`: "a dead-lettered message raises an owned task and an alarm"). For each item, this module creates a task of kind `platform.dead-letter`:
- **Focus**: the dead-letter item (consumer, CloudEvents id, partition and offset). Subject and facility come explicitly from the sink call, never parsed from the partition key.
- **Owner**: the owning team's queue code that the consumer's registration declares, carried as `DeadLetterItem.owningQueueCode` (envelope §10 "the owning team's queue"), resolved in the item's scope. If that code does not resolve, `platform.tasks.dead-letter.fallback-queue`. If that does not resolve either, the fallback supervisory queue.
- **SLA**: continuous, starting at the item's first failure (envelope §10: "the clock starts at the first failure"). The due time is `firstFailureAt + A − T`. `A` is `platform.events.dead-letter-alarm-after` (5 minutes, vendor-locked, tighten-only); `T` is the tick interval. So the breach fires no later than `firstFailureAt + A`. An item that reaches this module after that time is created already breached and alarms at once. Retries before the move to the dead-letter queue therefore never extend the alarm, provided the consumer's retry window is shorter than `A` (§15 A-5).
- **On breach**: `TaskSlaBreached`, then the operational alarm `DeadLetterItemAged` from the relay. The task's SLA breach is the primary §6.7 dead-letter alarm; the events library's evaluator over its failure records is the independent backstop when the sink is unavailable (envelope §10; D15). The events library's `DeadLetterAlarmPolicy` carries and validates `A`; this module resolves the setting and builds the policy (§8; §15 A-5).
- **Ownership**: an item whose owner cannot act raises `TaskOrphaned` like every task. "An item nobody picks up" (envelope §10) is the SLA breach alarm plus the escalation chain, not `TaskOrphaned`. That reading of CTRL-0003-5 goes to the CSO (DN-TK4).
- **Idempotent** on the item id. A sink call that cannot be completed raises `DeadLetterTaskPending` and is retried at every tick from a persisted pending list. The task closes when the item is replayed or resolved without replay (envelope §10), through `DeadLetterTaskSink.resolved(tx, itemId, outcome)`, a by-focus-owner completion.

### 7.2 Orphan-alarm tasks

Kind `platform.task-orphaned`, owned by the fallback supervisory queue (§4.3). Focus: the orphaned task or request. Subject: the orphaned work's patient, so its events keep that patient's order (journal J-14). This module completes it when its episode clears. A request episode can also be closed by `ResolveOrphanedRequest` (§4.4). No user completes or cancels it otherwise.

### 7.3 Escalation-failed tasks

Kind `platform.escalation-failed`, focus = the task whose terminal step failed (§4.2), owned by the fallback supervisory queue. It closes when that task becomes final, is reassigned to a routable owner, or its terminal target becomes routable and the step is applied.

### 7.4 Detection-blind and calendar-coverage tasks

`platform.orphan-detection-blind`: one per scope while the directory cannot answer (§4.3). It closes when the directory answers again. `platform.calendar-coverage`: one per scope and uncovered year (§4.1). It closes when the calendar covers that year.

### 7.5 Tasks other modules raise through this engine

`platform-config` raises an owned task for every kill-switch engagement (its §6.3). It declares the kind in code as a `TaskKindDefinition` (§3.4): `platform.config.kill-switch-review`, `SafetyRelevant`, `CONTINUOUS_ONLY`, with an escalation policy and the SLA setting `platform.config.killswitch.review-sla` (`TightenOnly`, `configurationRequired`, `GOVERNED`; its value is `[HUMAN]`). It writes a `TaskRequested` row whose focus is its `KillSwitchBoard` aggregate and whose one owner is the queue code in `platform.config.killswitch.review-queue`, resolved at the switch's scope. Whether the kind's escalation policy also tells the CSO's queue (a `NOTIFY` step) is `platform-config`'s to declare. When the queue is not configured, the request has no owner: the domain refuses it (`OwnerMissing`), and the intake opens `TaskOrphaned` (`REQUEST_REFUSED`) on the `TaskRequest` at once, with an orphan-alarm task in the fallback supervisory queue (§4.4). There is no dead-letter step. A review SLA with no value is refused the same way (`SettingUnavailable`) (§15 A-7).

## 8. Configuration

Every setting below is a tenancy `SettingDefinition`, declared in this module's `api` and registered in tenancy's `SettingCatalogue`, the one store of setting definitions (D2). Values resolve through the chain VENDOR_FOUNDATION → COUNTRY_PACK → TENANT → LEGAL_ENTITY → FACILITY → DEPARTMENT → UNIT → USER (§6.6; tenancy §5). SI-03's parameters are vendor-locked: a lower level may tighten them and never loosen them (§2.1 preamble; CTRL-0003-1). For every duration here, shorter is stricter. Each `TightenOnly` definition carries that direction as its strictness comparator. A test per definition checks the direction on known looser and stricter samples (D12; `PropertyTest:task-settings-strictness-direction`).

| Key | Type | Vendor default | Allowed levels | Safety class | Lock and direction |
|---|---|---|---|---|---|
| `platform.tasks.orphan-alarm.max-delay` (`L`) | `DURATION(PT15S, PT5M)` | `PT5M` (§2.1 SI-03) | VENDOR_FOUNDATION, COUNTRY_PACK, TENANT, FACILITY | `SafetyInvariant(SI-03; CTRL-0003-1, CTRL-0003-5)` | `TightenOnly`; `GOVERNED`. The type's maximum refuses anything above 5 minutes at every level |
| `platform.tasks.orphan-alarm.scan-interval` (`S`) | `DURATION(PT5S, PT5M)` | `PT1M` [P] | as above | as above | `TightenOnly`; `GOVERNED` |
| `platform.tasks.orphan-alarm.grace` (`G`) | `DURATION(PT0S, PT5M)` | `PT1M` [P] | as above | as above | `TightenOnly`; `GOVERNED` |
| `platform.tasks.orphan-alarm.scan-budget` (`B`) | `DURATION(PT5S, PT5M)` | `PT1M` [P] | as above | as above | `TightenOnly`; `GOVERNED` |
| `platform.tasks.orphan-alarm.leader-takeover` (`F`) | `DURATION(PT5S, PT5M)` | `PT30S` [P] | as above | as above | `TightenOnly`; `GOVERNED` |
| `platform.tasks.routing.directory-max-staleness` (`C`) | `DURATION(PT0S, PT5M)` | `PT30S` [P] | as above | as above | `TightenOnly`; `GOVERNED` |
| `platform.tasks.timers.tick-interval` (`T`) | `DURATION(PT1S, PT1M)` | `PT30S` [P] | as above | `SafetyRelevant(CTRL-0003-4, CTRL-0003-5)` | `TightenOnly`; the maximum lateness of SLA and escalation timers |
| `platform.tasks.intake.poll-interval` (`I`) | `DURATION(PT1S, PT1M)` | `PT5S` [P] | as above | `SafetyRelevant(CTRL-0003-4)` | `TightenOnly` |
| `platform.tasks.orphan-alarm.fallback-queue` | `STRING([a-z][a-z0-9-]{0,62}, 63)`, a queue code | none: configuration required | TENANT, FACILITY | `SafetyRelevant(CTRL-0003-5)` | Structurally locked below FACILITY; activation check (§4.3) |
| `platform.tasks.dead-letter.fallback-queue` | as above | none | TENANT, FACILITY | `SafetyRelevant(CTRL-0003-5)` | As above |
| `platform.events.dead-letter-alarm-after` (`A`) | `DURATION(PT30S, PT5M)` | `PT5M` (§5.3, §6.7) | VENDOR_FOUNDATION, COUNTRY_PACK, TENANT, FACILITY | `SafetyInvariant(SI-03; CTRL-0003-5)` | `TightenOnly`; `GOVERNED`. Owned and declared by this module, which resolves it and builds the events library's `DeadLetterAlarmPolicy`; the library cannot import the tenancy api (envelope §10; §15 A-5) |
| `platform.tasks.escalation.default-policy` | `STRING`, a policy code | none | VENDOR_FOUNDATION, COUNTRY_PACK, TENANT, FACILITY | `SafetyRelevant(CTRL-0003-4)` | `GOVERNED`. Used only by kinds that are not safety-relevant (§4.2) |
| `platform.tasks.alarm-task.sla` | `DURATION(PT0S, PT24H)` | none: `configurationRequired = RequiredBecause("CTRL-0003-5")`; content request (CR-TK1) | VENDOR_FOUNDATION, COUNTRY_PACK, TENANT, FACILITY | `SafetyRelevant(CTRL-0003-5)` | `TightenOnly`; `GOVERNED` (tenancy D-2); not configured means due at creation (§7) |
| `calendar.weekend-days`, `calendar.holidays` | tenancy's (§5.10) | none | COUNTRY_PACK, TENANT (facility override: OQ-TK8) | `Ordinary` | Read through `CalendarReader`; the Kurdistan pack supplies `[L]` L-20 values (`kri.calendar.weekend`, `kri.calendar.holidays`) |

- **Per-kind SLAs** are settings the owning module declares with its kind (§3.4 K-3), for example the 4-hour pharmacist review of CTRL-0005-12 in `medications`. They are `TightenOnly`, so a tenant can shorten them and never lengthen them. An owning module that implements an SI timing passes no longer span than its own setting allows.
- **Escalation policies** are `platform-config` content (§4.2), not settings (D2).
- **No vendor value** is given here for anything clinical. The `[P]` timing defaults are engineering values. Their sum, 4 minutes, leaves 1 minute of the 5 for alarm delivery. The chaos test measures whether that margin holds (§12).
- **Safety parameter objects (D11).** `OrphanTimingPolicy` (`L`, `S`, `G`, `B`, `F`, `C`) and `TimerPolicy` (`T`, `I`) have private constructors and validate in `init` (floors, the sum). Their `@SafetyParameterFactory` functions `fromResolved(..., environment: EnvironmentClass)` build them only from kernel `ResolvedParameter`s, or from the coded vendor defaults (§4.6). The kernel's rule restricts every `@SafetyParameterFactory` call to its `SAFETY_PARAMETER_RESOLVERS` allow-list, which holds this module's resolver package `hms.platform.tasks.infrastructure.config..`, and to test sources (`ArchTest:safety-parameter-factories-only-in-resolvers`, kernel §6.5). The same package builds the events library's `DeadLetterAlarmPolicy` (§7.1). A policy with synthetic provenance is refused when the environment class is TRAIN or PROD, the kernel's synthetic gate (`UnitTest:task-safety-policy-synthetic-refused-in-train-and-prod`).
- **Cross-key constraint.** The sum `C + S + G + B + F ≤ L` spans six keys. This module declares it as a tenancy `SettingGroup` (`platform.tasks.orphan-alarm.timing-bound` [P]; members `L`, `S`, `G`, `B`, `F`, `C`; source SI-03), registered with the definitions (tenancy §5.3, D-11). Tenancy checks it at write (W-19) and at read (R-G), and the scan reads the six values together through `resolveGroup`. The policy factory still refuses an inconsistent set, and §4.6 applies (`PropertyTest:config-chain-group-constraint-holds`, with tenancy).
- **No kill switch of its own.** None of these keys turns orphan detection or escalation off: SI-03 is not a configuration value (§2.1 preamble). Kill switches (SI-19) apply to the CDS rules and clinical-behaviour flags that request tasks, not to the engine that keeps work owned. That reading of SI-19 and §22.1 item 6 goes to the CSO (DN-TK6).

## 9. Permissions and audit

The Trust Plane SDK arrives in WP-0.4 (§21). Until then `TaskAuthorization` is a port. Tests use an allow-list adapter. Production wiring binds `DenyAllTaskAuthorization`, which refuses every user action (`UnitTest:production-task-authorization-denies-every-user-action`). It is never consulted on an alarm path (`UnitTest:alarm-paths-independent-of-authorisation`).

| Permission (proposed [P]) | Allows |
|---|---|
| `task.read` | Reading tasks in scope; subject-bearing tasks also need the care relationship, labels and purpose of use (§7 item 2; SI-21) |
| `task.claim` | Claiming tasks one is eligible for |
| `task.reassign` | Reassigning within the task's scope |
| `task.supervise` | Releasing another's claim, resolving an orphaned request, reading orphaned work |
| `routing.admin` | Pools, queues, members and monitors |

There is no `task.complete` or `task.cancel`. Completion and cancellation belong to the focus module (invariant 10; D14).

Module identities, authorised by wiring, not by the user port:
- the SYSTEM actor of this module: scan, timers, intake, relay, dead-letter sink (§4.3);
- kernel callers through `KernelTaskCommands`, acting in their own command's context, which they have already authorised;
- the producer of a request row, attested by the journal's `producer_module`, which must be the focus module for completion and cancellation.

Audit:
- every write appends a journal entry with actor, actor kind, on-behalf-of, device, purpose of use, reason code, recorded time and its valid time at recording; a clinical time a caller gives is event data (invariant 9) (§5.3 C: the journal is the write-audit trail);
- a worklist entry about a patient is PHI, so every read of a subject-bearing task emits a BALP AuditEvent through the Trust Plane (§6.3; R07 §5.4 AU-1, AU-2), from WP-0.4 (KA-TK4);
- sensitivity labels (SI-21) are enforced at the policy enforcement point; a worklist row about a labelled record shows only what the policy allows (WP-0.4).

## 10. Persistence

Storage shape A, relational aggregates, plus the journal (shape C) for every change (§5.3, §6.4). Schema `tasks`, written in WP-0.3 with its Flyway migrations and jOOQ repositories [P] (OQ-TK11). Integration tests are in `src/integrationTest` and wait for the cell. Tables, each with `tenant_id`, a UUIDv7 `id`, `version` and audit columns, and `facility_id` where it applies (§6.4):
- shape A, current state, updated under optimistic concurrency: `task`, `task_escalation_step`, `task_escalation_recipient`, `pool`, `pool_member`, `queue`, `queue_monitor`;
- operational state of the timers, shape A: `scan_state` (watermark, heartbeat per scope), `scan_candidate`, `intake_state`, `dead_letter_pending`.
History of every row is the journal, which is never updated (§2.2 rule 2). So no table here is an append-only fact table for the migration linter (D7). Membership and monitor history comes from `PoolMember*` and `QueueMonitor*` events. Indexes serve the scan (live tasks by holder and scope), worklists (live tasks by owner, priority and due time) and the timers (live tasks by next fire time). Migrations follow expand → migrate → contract with the N-1 test (§6.4). The project runs the reusable migration linter from `:platform:arch-rules` (D7).

## 11. Hazards, controls and tests

HAZ-0003 (seeded H5, SI-03) is this module's hazard; `platform-tasks-squad` owns it. The engine also carries the timer and orphan-alarm mechanism of controls owned by other modules: CTRL-0004-5 (HAZ-0004, seeded H3), CTRL-0005-12 (HAZ-0005, seeded H2) and CTRL-0017-5 (HAZ-0017, seeded H3). WP-0.3 lists "H4 delayed escalation (escalation chains; kill switches, SI-19)". The hazard log's H4 entries (HAZ-0014, HAZ-0019) do not cover escalation chains, so an H4 hazard for escalation is proposed (HAZ-TK8).

| Control | What this module implements | Tests (names as planned in the hazard log where it plans them) |
|---|---|---|
| CTRL-0003-1 (every channel; vendor-locked parameters) | Invariants 1–11 in the domain; nullable channel inputs refused by the domain; the §8 locks, directions and the timing constraint; policy objects only from resolved settings | `PropertyTest:SI-03-channels-*` (kernel api, request intake and dead-letter sink now; each channel adapter as it arrives); `PropertyTest:config-chain-vendor-lock-SI-03 (an orphan alarm later than 5 minutes is refused)`; `UnitTest:orphan-timing-policy-refuses-inconsistent-settings`; `PropertyTest:task-settings-strictness-direction`; `UnitTest:task-safety-policy-synthetic-refused-in-train-and-prod`; `ArchTest:safety-parameter-factories-only-in-resolvers` |
| CTRL-0003-2 (property tests on the task machine) | The YAML is the oracle; WP-0.5's generator builds the model from it | `PropertyTest:SI-03-every-task-reaches-a-terminal-state`; `PropertyTest:task-machine-conforms-to-spec` (hand-written from `task.yaml` until WP-0.5's generator exists, then generated) |
| CTRL-0003-4 (owner and SLA; no gap) | Creation refused without owner, SLA or chain; owners in scope; moves only to routable owners; release guarded; escalation skips or fails, never moves work to an owner who cannot act; the kernel caller's rollback contract; focus-owner-only closing | `PropertyTest:SI-03-owner-and-sla-on-every-work-item`; `PropertyTest:SI-03-reassignment-never-leaves-a-gap`; `PropertyTest:SI-03-release-never-leaves-a-gap`; `PropertyTest:SI-03-owner-in-tenant-scope`; `PropertyTest:SI-03-kernel-caller-rolls-back-on-task-rejection`; `UnitTest:task-creation-rejected-without-owner`; `UnitTest:task-creation-rejected-without-sla`; `UnitTest:task-creation-refusals` (one case per `CreateRejection`); `UnitTest:escalation-chain-must-end-in-terminal-pool-or-queue`; `UnitTest:routing-change-refused-when-work-would-be-unroutable`; `UnitTest:completion-and-cancellation-only-by-focus-owner`; `UnitTest:request-completion-from-non-focus-module-refused`; `AcceptanceTest:SAC-19` (with the first module that creates tasks end to end) |
| CTRL-0003-5 (`TaskOrphaned` within 5 minutes) | §4.3 to §4.6 in full; dead-letter tasks (§7.1) | `PropertyTest:SI-03-orphan-alarm-within-5-minutes (simulated clock)`: random holders, loss instants, flapping holders, facility and tenant scopes, unmaterialised and refused requests, and settings that satisfy the constraint; asserts `detectedAt − t0 ≤ S + G` for every episode on a `TestClock`; `PropertyTest:SI-03-no-orphan-alarm-for-routable-owned-work`; `PropertyTest:SI-03-orphan-alarm-deduplicated-per-episode`; `UnitTest:orphan-alarm-task-owned-by-fallback-queue`; `UnitTest:orphan-episode-cleared-when-ownership-restored`; `UnitTest:orphan-alarm-task-completed-on-clear`; `UnitTest:unroutable-owner-at-creation-alarms-at-first-scan`; `UnitTest:tenant-level-task-orphan-detected`; `UnitTest:flapping-holder-keeps-episode-start`; `UnitTest:directory-unknown-raises-one-detection-blind-alarm`; `UnitTest:directory-outage-does-not-block-self-claim`; `UnitTest:fallback-queue-missing-still-records-task-orphaned`; `UnitTest:fallback-queue-unroutable-raises-operational-alarm`; `UnitTest:fallback-queue-activation-check-refuses-missing-queue`; `UnitTest:alarm-paths-independent-of-authorisation`; `UnitTest:operational-alarm-emitted-after-commit-only`; `UnitTest:orphan-scan-runs-on-vendor-values-when-settings-unreadable`; `UnitTest:orphan-scan-overrun-and-stall-alarms`; `UnitTest:backward-clock-step-detected-and-alarmed` (§4.5); `UnitTest:task-request-refused-raises-task-orphaned`; `UnitTest:task-request-not-materialised-within-bound`; `UnitTest:dead-letter-alarm-at-5-minutes-after-first-failure` (boundary, with retries); `UnitTest:dead-letter-owner-falls-back`; `UnitTest:dead-letter-task-pending-raises-operational-alarm`; `ChaosTest:task-orphaned-within-5-minutes` and `ChaosTest:task-request-pipeline-stopped-alarms-within-5-minutes` (wait for the cell, §12) |
| CTRL-0003-7 (orphaned work reported; Level-3 trigger) | `orphanedWork` and `overdue` queries with cumulative orphaned time; PHI-free metrics (open episodes per scope, detection latency, scan duration, last completed scan) | `UnitTest:orphaned-work-query-includes-cumulative-and-subjectless`; `IntegrationTest:safety-dashboard-orphaned-work` (with `quality`, §9.29); `IntegrationTest:open-referrals-over-14-days-report` (with `scheduling`, WP-1.3) |
| CTRL-0010-3 (SI-10, task part) | Every Task row takes its valid time at recording (`ValidTimeInput.AtRecording`); `workBeganAt` and `performedAt` are payload fields, never valid times, so no task row is back-dated or back-entered; classification by the journal (D10); start never in the future | `UnitTest:task-clinical-times-are-payload-not-valid-time`; `UnitTest:sla-start-in-future-refused`; `UnitTest:sla-runs-from-request-recorded-time` |
| H3 and H2 controls whose timers run here: CTRL-0004-5 (critical results escalate on calendar-aware timers), CTRL-0005-12 (pharmacist review task "escalated and orphan-alarmed like every task"), CTRL-0017-5 (results queues "orphan-alarmed like every task") | Escalation steps fire on the continuous clock through weekends and holidays; every task is orphan-alarmed; per-kind SLAs tighten-only. The policies, recipients and controls stay with `results` and `medications` | `UnitTest:safety-timers-run-through-weekends-and-holidays` (a synthetic calendar, never real dates); `UnitTest:escalation-steps-fire-in-order-and-end-at-terminal-owner`; `UnitTest:escalation-skips-unroutable-target`; `UnitTest:notify-step-to-unroutable-target-skipped`; `UnitTest:terminal-step-to-unroutable-owner-fails-and-alarms`; `UnitTest:escalation-reassign-releases-claim-and-notifies-former-claimant`; `UnitTest:escalation-catch-up-after-downtime`; `UnitTest:task-overdue-at-terminal-owner-alarms`; the owners' scenario tests (`ScenarioTest:critical-result-escalation-simulated-clock-weekends-and-holidays`) run on this engine |

Other tests:
- calendar: `UnitTest:safety-relevant-kind-refuses-business-calendar-clock`; `UnitTest:urgent-priority-refuses-business-calendar-clock`; `PropertyTest:business-calendar-sla-skips-weekend-and-holidays` (synthetic calendars, DST gap and overlap); `UnitTest:calendar-not-configured-falls-back-to-continuous`; `UnitTest:calendar-uncovered-years-raise-coverage-task`;
- kinds: `UnitTest:task-kind-unknown-refused`; `UnitTest:task-kind-registration-rules` (K-1 to K-4); `UnitTest:kind-without-safety-flag-defaults-to-safety-relevant`;
- commands: `UnitTest:task-reason-never-defaulted`; `UnitTest:reason-not-in-list-refused`; `UnitTest:release-to-unroutable-owner-refused`; `UnitTest:supervisor-release-audited`;
- journal and idempotency: `UnitTest:task-every-command-appends-one-journal-entry-in-memory`; `PropertyTest:task-commands-idempotent`; `UnitTest:idempotency-key-reused-with-different-payload-refused`; `UnitTest:derived-idempotency-key-distinct-from-caller-key`; `UnitTest:task-requested-consumer-idempotent-on-request-id`; `IntegrationTest:task-journal-entry-in-same-transaction` (merge tier, waits for the journal's PostgreSQL adapter);
- wiring: `UnitTest:production-task-authorization-denies-every-user-action`; `UnitTest:app-hms-refuses-to-start-without-task-persistence`; `ArchTest:production-never-binds-test-adapters`; `ArchTest:kernel-task-commands-only-from-safety-kernel` (proposed for `:platform:arch-rules`);
- architecture: `HmsArchitectureRules.all()` from `:platform:arch-rules`, including D7's rule (e) `safetyKernelNeverUsesWorkflow` with its test `ArchTest:safety-kernel-never-uses-workflow` (`SafetyKernelWorkflowRuleTest`). Task timers live here, never in Temporal (ADR-010).

Property tests take their sequence count from `PropertyTestBudget` (1,000 in the fast tier, 10⁶ nightly; §18.3). A control moves to `implemented` and `verified` only with these tests passing and recorded (§3.5).

## 12. The chaos tests (WP-0.3 exit criterion; wait for the cell)

"`TaskOrphaned` fires within 5 minutes in a chaos test" (§21 WP-0.3; §2.2 rule 6; §18.7 nightly). `ChaosTest:task-orphaned-within-5-minutes` runs in `tests/` on the three-node dev cell (WP-0.2), against the assembled `app-hms` with real PostgreSQL and Kafka:
1. Seed synthetic pools, queues, fallback queues and owned tasks, at facility and tenant level, with routable holders; also control tasks whose holders stay routable.
2. At recorded instants `t0`, make holders unroutable: deactivate a person, empty a pool, unassign a queue's last monitor. Also dead-letter a message, and commit task requests while the intake is stopped.
3. During the window, inject the §18.7 faults one at a time: kill the node running the scan; fail over the PostgreSQL primary; partition the broker; skew a node's clock beyond the ADR-026 block, including the scan leader's; cut power to a node (power-cut emulation).
4. Assert for every episode: a `TaskOrphaned` row with `detectedAt − t0 ≤ 5 min`, an orphan-alarm task in the fallback queue's worklist, and the operational alarm in the cell's alerting within 5 minutes of `t0`, all measured on the cell's time source; exactly one of each per episode; none for the control tasks; the dead-letter alarm within 5 minutes of the first failure. Also report the Trust Plane's deprovisioning lag, measured from the deactivating action.
5. A database failover longer than the slack must give `OrphanDetectionDegraded` within 5 minutes, and the late `TaskOrphaned` is recorded as the HAZ-TK7 residual (§4.3).
6. Stop every scan worker: `OrphanDetectionStalled` alarms within 5 minutes. Stop the intake: `TaskIntakeStalled` and the request episodes alarm within 5 minutes (`ChaosTest:task-request-pipeline-stopped-alarms-within-5-minutes`).
Evidence goes to `docs/program/evidence/` with date, tier and commit, naming the cell; dev-cell numbers are indicative (§3.5 "Name the cell behind every number").

## 13. Acceptance criteria

| # | Criterion | Tests |
|---|---|---|
| 1 | A task cannot be created without an owner in scope, an SLA and an escalation chain ending in a terminal pool or queue, through any channel; the domain refuses it (CTRL-0003-4) | `PropertyTest:SI-03-owner-and-sla-on-every-work-item`, `UnitTest:task-creation-refusals`, `PropertyTest:SI-03-channels-*` |
| 2 | No user command or escalation step moves work to an owner who cannot act; a failed terminal step raises an alarm | `PropertyTest:SI-03-reassignment-never-leaves-a-gap`, `PropertyTest:SI-03-release-never-leaves-a-gap`, `UnitTest:terminal-step-to-unroutable-owner-fails-and-alarms` |
| 3 | On a `TestClock`, every orphan episode (both causes, both scopes) records `TaskOrphaned` at most `S + G` after `t0`, with `C + S + G + B + F ≤ L ≤ 5 min` enforced; never for a task whose holder stays routable (CTRL-0003-5) | `PropertyTest:SI-03-orphan-alarm-within-5-minutes`, `PropertyTest:SI-03-no-orphan-alarm-for-routable-owned-work` |
| 4 | Each episode gives exactly one `TaskOrphaned`, one orphan-alarm task and one operational alarm at the sink, emitted after commit, and clears when ownership is restored or the work is final | `PropertyTest:SI-03-orphan-alarm-deduplicated-per-episode`, `UnitTest:operational-alarm-emitted-after-commit-only`, `UnitTest:orphan-alarm-task-completed-on-clear` |
| 5 | A bundle without a fallback supervisory queue cannot be activated; an orphan alarm limit above 5 minutes is refused at every level; no SI-03 parameter can be loosened; synthetic safety policies are refused in TRAIN and PROD (CTRL-0003-1) | `UnitTest:fallback-queue-activation-check-refuses-missing-queue`, `PropertyTest:config-chain-vendor-lock-SI-03`, `PropertyTest:task-settings-strictness-direction`, `UnitTest:task-safety-policy-synthetic-refused-in-train-and-prod` |
| 6 | Safety-relevant timers fire through weekends and holidays; business-calendar SLAs skip the configured weekend days and holidays (generic keys, synthetic dates) | `UnitTest:safety-timers-run-through-weekends-and-holidays`, `PropertyTest:business-calendar-sla-skips-weekend-and-holidays` |
| 7 | Every command writes one journal entry per aggregate, with its valid time at recording and any given clinical time as event data; commands are idempotent; kernel callers roll back on a rejected create | `UnitTest:task-every-command-appends-one-journal-entry-in-memory`, `PropertyTest:task-commands-idempotent`, `PropertyTest:SI-03-kernel-caller-rolls-back-on-task-rejection`, `IntegrationTest:task-journal-entry-in-same-transaction` (cell) |
| 8 | The task machine conforms to `task.yaml`; every state reaches `done` or `cancelled` | `PropertyTest:task-machine-conforms-to-spec`, `PropertyTest:SI-03-every-task-reaches-a-terminal-state` |
| 9 | `HmsArchitectureRules.all()` passes, including rule (e); in-memory adapters are never bound in `app-hms` production wiring; safety parameter factories are called only from the resolver allow-list | `ArchTest:safety-kernel-never-uses-workflow`, `ArchTest:production-never-binds-test-adapters`, `ArchTest:safety-parameter-factories-only-in-resolvers` |
| 10 | Exit criterion, on the cell: the chaos tests of §12 pass (wait for WP-0.2) | `ChaosTest:task-orphaned-within-5-minutes`, `ChaosTest:task-request-pipeline-stopped-alarms-within-5-minutes` |

## 14. Open questions, decisions, known anomalies and proposals

Local labels; the integrator numbers them (D9).

**Decisions for the CSO**
- **DN-TK1: "calendar-aware" timers for safety work.** §7 item 1, §9.7 and BP §6.7 list calendar-aware SLA timers, BP §6.7 even for "escalation, orphan alarms". This build reads it as: safety-relevant timers never pause for weekends or holidays, and the calendar may only make safety timing earlier or reach more people. Day-type chain variants are not built (KA-TK7). Only kinds classified as not safety-relevant, at `ROUTINE` priority, may use business time. Default in use: that reading.
- **DN-TK2: SLA start of back-entered work.** When a task is created after an outage for work that began on paper, does its SLA run from the paper time (overdue at once, escalates) or from entry? Default in use: from the paper time, the stricter choice, entered through the back-entry tooling with a real downtime episode (SI-10). Until that tooling exists, the start is the entry time (KA-TK8). An outage could create many already-due tasks; the CSO weighs that alarm load against lateness.
- **DN-TK3: directory outage.** Default in use: an outage opens no per-task episodes but one "orphan detection blind" alarm task and operational alarm per scope; self-claim works on the authenticated session; work moves only to targets last known routable, flagged as unverified. Option: count unknown as unroutable for every task (alarm flood, every claim blocked).
- **DN-TK4: dead-letter items and CTRL-0003-5.** Default in use: the dead-letter task's SLA breach at 5 minutes after the first failure is the §6.7 alarm; `TaskOrphaned` fires for a dead-letter task only when its owner cannot act. Envelope §10 says "an item nobody picks up becomes `TaskOrphaned`"; this build reads "nobody picks up" as the SLA breach plus escalation.
- **DN-TK5: unroutable terminal escalation owner.** Default in use: the step fails, the routable holder keeps the task, and an escalation-failed task and alarm go to the fallback queue. Option: move the task to the terminal owner anyway and rely on the orphan alarm.
- **DN-TK6: no kill switch for the task engine.** SI-19 and §22.1 item 6 ask for a kill switch for "any clinical behaviour". This build gives the engine none, because SI-03 cannot be switched off; kill switches stop the rules that request tasks.
- **DN-TK7: tasks as their own aggregate** (§3.7), a deviation from §8.2's "one aggregate holds the request, its tasks and its status history".

**Open questions**
- **OQ-TK1: approvers of `task.yaml`.** §8.4 names none. Proposed: CSO, nurse panel, physician panel. Laboratory and pharmacy panels may also want a say, since their worklists are tasks.
- **OQ-TK2: claims held by a deactivated person.** Default: the orphan alarm; a supervisor reassigns (release is refused while the owner cannot act). Option: release the claim automatically when the owner is routable.
- **OQ-TK3: SLA pause and resume.** §9.23 needs a pre-approval SLA clock that pauses across weekends and holidays. Not in WP-0.3; a pause would be allowed only for kinds that are not safety-relevant.
- **OQ-TK4: business-time granularity.** L-20 gives weekend days and holidays but no working hours, so business-calendar SLAs count whole business days.
- **OQ-TK5: cross-key constraints in setting definitions.** Closed: tenancy's `SettingGroup` (W-19, R-G) carries `C + S + G + B + F ≤ L` (§8).
- **OQ-TK6: a REASSIGN escalation step on a claimed task.** Default: it releases the claim and tells the former claimant; the focus module can still record finished work. Option: keep a routable claimant's claim and notify the new owner. For the nurse and physician panels.
- **OQ-TK7: local changes to escalation policies of safety-relevant kinds.** Default: vendor or country pack only; tenants decide who holds each role code. Option: tenant variants whose every offset is no later than the vendor's, and day-type variants (DN-TK1).
- **OQ-TK8: facility-level calendars** (D3). Calendar keys are set at COUNTRY_PACK and TENANT. Should a facility override them?
- **OQ-TK9: the state-machine template.** `task.yaml` declares `initial: open`, uses `(start)` for the creating command, and puts effects in `description` fields. Appendix B.3 defines none of these; the README and the WP-0.5 generator contract should.
- **OQ-TK10: transport of the Tier 2 escalation request** from a sidecar process to the Tier 1 host (§5.4).
- **OQ-TK11: persistence in WP-0.3.** The WP-0.3 page lists the journal's schema and repository code as in scope now, not the task engine's. This spec writes the `tasks` schema, migrations and jOOQ repositories now, because the exit chaos test needs them. Confirm.
- **OQ-TK12: the governed list of reason codes.** Declared in code in WP-0.3; should it become governed content that tenants may extend?
- **OQ-TK13: configuration reads.** §5.2 lets `platform-tasks` call only Trust and the journal synchronously. D5 allows every module to read configuration through `hms.platform.tenancy.api`; this module also reads escalation policies through `platform-config`. Record against §5.2's column.
- **OQ-TK14: the dead-letter alarm-age setting.** Closed: this module owns and declares `platform.events.dead-letter-alarm-after` (§8); envelope §10, journal and tenancy cite this section.

**Known anomalies** (proposed `KNOWN-ANOMALIES.md` rows)
- **KA-TK1: task persistence unproven.** The jOOQ adapters are written but untested until the cell. Until their integration tests pass, `app-hms` refuses to start with `platform-tasks` wired (`TasksPersistenceGuard`). Hazard: HAZ-0003. Backlog: `PLT-CORE-07`.
- **KA-TK2: what waits for the cell.** The chaos tests, the scheduler, the leader lease, the clock-health link, the watchdog, the intake stall alarm and the journal gap check. The 5-minute bound is proven only on a simulated clock. HAZ-0003, CTRL-0003-5. Backlog: `PLT-CORE-07`, `PLT-OPS-05`.
- **KA-TK3: routability knows only active and inactive accounts.** No absence, surrogate or roster yet. HAZ-0003, HAZ-0017 (CTRL-0017-5). Backlog: `CLN-RES-01`, `ERP-ROS-01`; the Trust Plane adapter is WP-0.4 (`TRU-IAM-01`).
- **KA-TK4: no user authorisation or read audit until WP-0.4.** Production wiring denies every user action, so no person can claim, release or reassign. Subject-bearing reads are not yet audited. HAZ-0003, HAZ-0021 to HAZ-0027 (SI-21). Backlog: `TRU-IAM-02`, `TRU-AUD-01`, `TRU-PRV-01`.
- **KA-TK5: operational alarms have no transport** until the cell's OpenTelemetry pipeline exists; the recording adapter serves tests only. HAZ-0003; seeded H9 (no hazard entry yet). Backlog: `PLT-OPS-05`.
- **KA-TK6: NOTIFY has no push delivery.** Recipients see escalated tasks only in their worklist until `platform-notify` exists. HAZ-0003, HAZ-TK8. Backlog: `PLT-CORE-07`.
- **KA-TK7: no day-type escalation variants.** CTRL-0004-5's "calendar-aware timers" mechanism is incomplete: timers never pause, but no chain changes on weekends or holidays. HAZ-0004. Backlog: `PLT-CORE-07`.
- **KA-TK8: a given `workBeganAt` does not start the SLA in WP-0.3.** Every Task row takes its valid time at recording, and `workBeganAt` is only event data (invariant 9). Using it as the SLA start waits for the back-entry tooling and a real downtime episode. Work begun on paper starts its SLA at entry. HAZ-0010, HAZ-0003. Backlog: `TRU-BCP-03`.

**Hazard-log proposals** (for HAZ-0003 unless stated)
- **HAZ-TK1.** Cause: "the orphan detector, the timers or the request intake stop or fall behind, so orphaned work raises no alarm". Control: "fixed-rate scans with a heartbeat per scope; overrun and stall alarms; a watchdog outside the scanning process that alarms within 5 minutes when no scan completes" (`UnitTest:orphan-scan-overrun-and-stall-alarms`, `ChaosTest:orphan-detection-stall-alarms`).
- **HAZ-TK2.** Cause: "the fallback supervisory queue is missing or has no routable monitor". Control: "bundle activation refused without a fallback queue code; at run time `TaskOrphaned` is still recorded and an operational alarm raised; an unroutable fallback queue raises an operational alarm, not a task" (`UnitTest:fallback-queue-activation-check-refuses-missing-queue`, `UnitTest:fallback-queue-unroutable-raises-operational-alarm`).
- **HAZ-TK3.** Cause: "a directory outage or a mass deactivation blinds orphan detection or floods supervisors". Control: "one detection-blind alarm task per scope instead of an episode per task; self-claim on the authenticated session; operational alarms aggregated per scope and reason" (`UnitTest:directory-unknown-raises-one-detection-blind-alarm`, `UnitTest:directory-outage-does-not-block-self-claim`).
- **HAZ-TK4.** Cause: "a task request is committed but never turned into a task". Control: "reconciliation in every orphan scan raises `TaskOrphaned` on the request within the 5-minute bound; a refused request alarms at once; intake heartbeat and journal gap check" (`UnitTest:task-request-not-materialised-within-bound`, `ChaosTest:task-request-pipeline-stopped-alarms-within-5-minutes`).
- **HAZ-TK5.** Cause: "a task is closed while its focus still needs the work". Control: "only the focus module completes or cancels; non-kernel requests apply only after the caller commits; a fulfilment marked entered-in-error raises a new task" (`UnitTest:completion-and-cancellation-only-by-focus-owner`, `UnitTest:request-completion-from-non-focus-module-refused`).
- **HAZ-TK6.** Cause: "person status is stale or propagated late". Control: "the directory staleness bound `C` is inside the 5-minute budget; the Trust Plane's deprovisioning lag is a WP-0.4 requirement measured by the chaos test".
- **HAZ-TK7.** Cause: "a database failover or the loss of the scan leader delays `TaskOrphaned`". Control: "the leader takeover `F` is inside the budget; the scan raises `OrphanDetectionDegraded` through a path that needs no database". Residual: a database failover longer than the slack (in-cell RTO up to 5 minutes, §16.4) can make `TaskOrphaned` late.
- **HAZ-TK8 (new hazard, seeded H4 "delayed escalation").** Title: "Overdue owned work is not escalated to someone who can act". Causes: an escalation target cannot act; a NOTIFY is not seen; the chain is exhausted; timers run late. Controls: unroutable targets skipped at once; a failed terminal step keeps the holder and raises an escalation-failed task and alarm; an alarm for work overdue at the terminal owner; the tick bound `T` (`UnitTest:terminal-step-to-unroutable-owner-fails-and-alarms`, `UnitTest:notify-step-to-unroutable-target-skipped`, `UnitTest:task-overdue-at-terminal-owner-alarms`). Owner: `platform-tasks-squad`.
- **HAZ-TK9 (seeded H9, "alarm not delivered").** Cause: "an operational alarm is lost between commit and the alerting system". Control: "after-commit relay, at-least-once, deduplicated on the episode id, retried until accepted" (`UnitTest:operational-alarm-emitted-after-commit-only`; delivery bound measured on the cell, `PLT-OPS-05`).
- **HAZ-TK10.** Cause: "a Safety Kernel caller commits its change although task creation was refused". Control: "caller contract and contract kit; `requireCreated()`" (`PropertyTest:SI-03-kernel-caller-rolls-back-on-task-rejection`).

**ADR proposal**
- **ADR-TK1: how work becomes a task across the Safety Kernel boundary.** Kernel modules create, complete and cancel tasks in their own transaction, as separate journal appends with derived idempotency keys. Every other module writes `TaskRequest` rows to the journal in its own transaction. This module reads them from the journal in the same database with a watermark, not through Kafka, applies them idempotently, and alarms within the SI-03 bound on any request not turned into a task (D14).

**Content request**
- **CR-TK1:** CSO-approved escalation policies for the platform and for each safety-relevant kind; the SLA of platform alarm tasks (`platform.tasks.alarm-task.sla`); the facility default policy for kinds that are not safety-relevant. Until then, synthetic samples marked NOT FOR CLINICAL USE, and alarm tasks due at creation.

**Tightenings** (to be recorded in `docs/safety/README.md`)
- an unroutable owner at creation alarms at the first scan, without grace;
- terminal escalation owners are pools or queues, never one person;
- an unroutable escalation target is skipped at once; a failed terminal step never moves the work;
- safety-relevant timers never pause (DN-TK1);
- the CTRL-0003-3 no-sink rule applies to tasks (invariant 4);
- reassignment and resolution reasons are never defaulted (invariant 8, after SI-02);
- routing changes that would leave live work unroutable are refused;
- the escalation chain is snapshotted at creation;
- a holder must be seen routable at two consecutive scans before a candidate is dropped;
- business time needs a classified kind and `ROUTINE` priority;
- the dead-letter alarm is due `T` early, so it is never late.

## 15. Interfaces this spec assumes from sibling specs

Siblings are being revised at the same time. Where a sibling settles a name differently, this spec follows it; the shape below is what this module needs.

- **A-1 kernel context (D1).** `hms.kernel.context`: `CommandContext` (tenant, facility, actor, on-behalf-of, device, purpose of use, clinical time, idempotency key, correlation id, causation id); `ActorRef` with kind `USER`, `DEVICE`, `INTERFACE`, `MIGRATION_LOADER`, `SYSTEM`; `ChangeReason`; `IdempotencyKey`; `CorrelationId`; `TransactionContext`; `TransactionRunner` with commit and rollback outcomes. `hms.kernel.ids`: `TenantId`, `FacilityId`, `PatientId`, `UserId`, `TypedId`, `IdGenerator`. Reads use `CommandContext` unless the kernel defines a read context.
- **A-2 kernel time (D4, D10, D11).** `RecordedTime`, `ClinicalTime`, `AsOf(validAt: Instant, knownAt: Instant? = null)`, the single `EntryTimingCode` vocabulary, `ValidTimeInput` (`Given`, `AtRecording`), `EntryTimeClassifier`, `BusinessCalendar` with `plusBusinessDaysAtLocalTime` and `CalendarAnswer.uncoveredYears`, `ResolvedParameter`, `EnvironmentClass` and `@SafetyParameterFactory`. `EntryMode` is derived from `CommandContext`, never from request input.
- **A-3 journal.** `JournalAppender.append(tx, context, request: AppendRequest)`, whose `NewEntry` items may name several aggregates; one entry per aggregate per command is this module's own rule (invariant 7), not the journal's. One recorded-time read per append; the journal classifies each entry's timing against that read and refuses the append when it differs from the entry's `expectedTiming` (`TimingMismatch`). Every Task row asks for `ValidTimeInput.AtRecording` and expects `CONTEMPORANEOUS` (invariant 9). `JournalReaders.forModule("platform-tasks")` → `ModuleJournalReader.byIdempotencyKey(tx, actor, key)`. `JournalTails.forConsumer("platform-tasks", {TaskRequested, TaskCompletionRequested, TaskCancellationRequested})`, a tail that never skips a late commit, with this module's look-back as the backstop (§4.4), and a sequence gap check (D15).
- **A-4 tenancy.** `SettingDefinition` (with `configurationRequired: RequiredBecause?`), `SettingGroup`, registration through `SettingCatalogueRegistrar.register(definitions, groups)`, `ConfigurationReader.resolve(key: TypedSettingKey<T>, context, at)` and `resolveGroup` with provenance, `CalendarReader.businessCalendar`, the key grammar and the closed value types (D2). The facility `zone` attribute.
- **A-5 events.** `hms.kernel.events.DeadLetterTaskSink` with `raise(tx, item)` and `resolved(tx, itemId, outcome)` (envelope §12); `DeadLetterItem` with `patientId`, `facilityId`, `owningQueueCode` and `firstFailureAt`, the tenant coming from the `TransactionContext`; `DeadLetterAlarmPolicy` with a private constructor and the `@SafetyParameterFactory` `fromResolved(value: ResolvedParameter<Duration>, environment: EnvironmentClass)`, called only from this module's resolver package; the events library's evaluator over its failure records as the independent backstop alarm when the sink is unavailable (envelope §10; D15); consumers' retry windows shorter than `A`; the setting `platform.events.dead-letter-alarm-after` owned and declared by this module (§8).
- **A-6 config.** A read of active content items of `platform.tasks.escalation-policy` by code and version; an activation check this module supplies (`FallbackQueueActivationCheck`); the production gate that refuses synthetic provenance by environment class (D11).
- **A-7 config kill switch.** `platform-config` declares `platform.config.kill-switch-review` as a `TaskKindDefinition` with its SLA setting `platform.config.killswitch.review-sla`, and raises the task as a `TaskRequested` row focused on `KillSwitchBoard`, owned by the queue in `platform.config.killswitch.review-queue`. A missing queue or SLA value takes the `REQUEST_REFUSED` → `TaskOrphaned` path (§7.5).
- **A-8 workflow.** D7 rule (e) `safetyKernelNeverUsesWorkflow` in `:platform:arch-rules`, with `ArchTest:safety-kernel-never-uses-workflow`.
- **A-9 site.** The ADR-026 clock-skew monitor tells the leadership adapter which nodes are blocked from clinical writes.
