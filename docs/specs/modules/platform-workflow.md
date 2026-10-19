# Module specification: platform-workflow

Module: `platform-workflow` (Gradle `:modules:platform-workflow`, package `hms.platform.workflow`)   Group: Platform (BUILD-PROMPT §5.2)
Work package: WP-0.3 (port only, DN-040); the Temporal adapter waits for the cell (WP-0.2)   Status: draft, revised after the two-lens review, 2026-10-19
Sources: BUILD-PROMPT §2.1 (SI-02, SI-03, SI-12, SI-19), §2.2 rules 1, 3 and 6, §3.4 item 1, §3.5, §4.1 (Workflow), §4.2 (ADR-001, ADR-003, ADR-006, ADR-008, ADR-010, ADR-021, ADR-022), §4.3, §5.2, §5.3, §6.1, §6.2, §6.4, §6.6, §6.7, §6.8 #3, §7 item 6, §9.18, §9.23, §9.32, §19.1, §21 (WP-0.3), §22.1; `docs/adr/ADR-010-workflow-temporal.md`; `docs/adr/ADR-022-licence-dependency-governance.md`; R08 §4.4, §12.5, §13 #9; K §7.2, §7.4; `docs/program/DECISIONS-NEEDED.md` DN-040; `docs/safety/hazard-log.yaml` HAZ-0003, HAZ-0012. Sibling specifications: `platform-kernel.md` (`hms.kernel.ids`, `hms.kernel.time`, `hms.kernel.context`), `platform-tasks.md`, `platform-tenancy.md`, `platform-config.md`, `docs/specs/events/catalogue.md`.

**Risk class of this work.** Mixed (DN-040 decision 2). The port, its value types and the fail-closed engine are low-risk scaffolding: the module is not part of the Safety Kernel and holds no clinical state (§5.2; ADR-010). The parts that guard HAZ-0003 and HAZ-0012 are patient-safety-relevant: the rules in section 1, the requirements on workflow types (section 8), arch rules (e) and (f) (section 10), the hazard mapping (section 11) and the proposed control (section 14). DN-040 lists "the task engine and SI-03" as safety-relevant, so those parts take both review lenses, and every major finding is fixed before commit.

**Labels.** [P] marks this build's own engineering choices. Local labels (OQ-W, DN-W, KA-W, HAZ-W, ADR-W) are numbered by the integrator (D9). "D1" to "D17" are the integrator's WP-0.3 decisions.

## 1. Purpose and scope

`platform-workflow` owns `WorkflowPort` and the Temporal adapter (§5.2). It orchestrates long-running processes that last hours to months, with timers and human steps: discharge, pre-approval, claims, migration and cutover (§4.2 ADR-010; §7 item 6). Temporal is used only behind the port (§4.1).

**Feature IDs.** Appendix A has no feature ID for the workflow port: §7 item 6 is a WP-0.3 deliverable (§21) without its own row. Its first users carry their own IDs: `RCM-INS-01` (pre-approval and claims, "a `WorkflowPort` workflow", §9.23) and `IMP-MIG-01` (the cutover orchestrator, "a `WorkflowPort` runbook", §9.32). Discharge (§9.18) is a later user. See OQ-W1.

**What a workflow may do.** Coordinate steps that belong to other modules: call their public APIs (through activities), wait for signals, keep coarse process timers (for example a pre-approval validity date), and report status (R08 §4.4; ADR-010).

**What may never be a workflow** (ADR-010; §4.2):
- Order state and MAR state. They stay in their domain aggregates, in the same transaction as the journal (ADR-003, ADR-004).
- Sub-second decisions. No caller waits on a workflow inside a clinical command. The port has no "start and wait for the result" operation [P].
- Safety Kernel timers [P]: the task engine's SLA, escalation and `TaskOrphaned` timers stay in `platform-tasks`, driven by its injected `Clock` (SI-03; §7 item 4). This extends ADR-010's rule from order and MAR state to the Safety Kernel's timers, so a Temporal outage can never silence an orphan alarm. D7 adopts it as arch rule (e); the extension of ADR-010 is recorded as ADR-W1 (section 14).
- A guard. A workflow's status or outcome is never a guard predicate of an ADT, ED, order, MAR or discharge command [P]. This keeps SI-12 clause a true: pre-approval and final billing run as workflows, and they never block discharge or emergency care (§9.18 "never blocked by money"; §9.23; CTRL-0012-4). It also keeps CTRL-0012-3 true: no RCM state, including an `rcm` workflow's state, blocks an ADT, order, discharge or MAR command. Arch rule (f) and a property test verify it (sections 10 and 12).

**Human steps are tasks** (SI-03; ADR-010 "Work that a workflow creates for people is a task in the task engine"). When a workflow needs a person, an activity of the owning module asks for a task. The owning module is not in the Safety Kernel, so it does not call `platform-tasks` in its own transaction. It writes a `TaskRequested` journal entry in its own transaction (`platform-tasks.md` §5.3), with an owner (person, pool or queue), an SLA, an escalation chain, its own aggregate as the focus and the workflow ref as correlation. `platform-tasks` materialises the request from the journal (D14). The owning module learns that the task closed from the catalogue's `TaskCompleted` and `TaskCancelled` events (`catalogue.md` §4) and then signals the workflow, at least once (section 8, WT-4). The task, not the workflow timer, owns the person's work. Between human steps, the process-watch task (section 8, WT-2) owns the process, so a stalled or lost workflow surfaces as an overdue owned task on the task engine's own clock (ADR-010, consequences; HAZ-0003).

**Example workflow types (examples only; each is specified by its owning work package).**

| Type (proposed name [P]) | Owner | Shape (illustrative) | Source |
|---|---|---|---|
| `adt.discharge` | `adt` | readiness checklist steps as tasks; summary; follow-up booking; transport; final bill posted after discharge, never before | §9.18; R08 §4.4 |
| `rcm.pre-approval` | `rcm` | request, query ⇄ response (repeatable, clock paused), approval; escalation goes to the insurer desk, never to clinicians | §9.23 |
| `rcm.claim` | `rcm` | build pack, submit, adjudication, denial queue | §9.23 |
| `migration.load` | `migration` | idempotent, re-runnable load batches through domain APIs | §9.32; R08 §4.4 |
| `migration.cutover` | `migration` | runbook with go/no-go checkpoints as tasks | §9.32 |

How `rcm` (a satellite) and `migration` reach the port is DN-W2 (section 14).

## 2. What is in WP-0.3 and what waits

"Built" means code and passing tests in WP-0.3. "Specified" means this document fixes the design or the requirement now and nothing is built until the named dependency arrives.

| Item | In WP-0.3 | Built later, when | Why |
|---|---|---|---|
| `WorkflowPort` API, value types, sealed results | built | — | DN-040: "`WorkflowPort` (the port only)" |
| Domain rules (names, keys, arguments, cancel codes, workflow-id derivation, status model) | built | — | pure Kotlin, no cluster |
| `WorkflowGateway` (validation and audit in front of any engine), the `WorkflowEngine` SPI and `WorkflowTypeRegistry` | built | — | same rules for every engine |
| Fail-closed engine `UnavailableWorkflowEngine` and fail-closed audit `UnavailableWorkflowAudit`, bound by `WorkflowAssembly.production` | built | — | §3.5 "No silent stubs"; D8; D16 |
| In-memory engine and recording audit adapter, main code in `..infrastructure.inmemory`, test and dev only | built | — | contract tests; D8 |
| Arch rule (e): Safety Kernel never depends on `hms.platform.workflow` | built (rule and fixtures) | — | §6.8 #3; D7 |
| Arch rule (f) [P]: clinical domain packages never depend on `hms.platform.workflow` | specified (proposed); built if the integrator adopts it | integrator adoption | SI-12; CTRL-0012-4 |
| D8 rule `ArchTest:production-never-binds-test-adapters` over `app-hms` | the rule and its fixtures are built (owned by `:platform:arch-rules`); its run on `app-hms` waits | the Spring Boot application in `app-hms` | `app-hms` has no application yet (its `build.gradle.kts`) |
| Temporal adapter (`TemporalWorkflowEngine`), status-time mapping, engine-unreachable probe and alarm | specified only (section 9) | WP-0.2 cell (Temporal on PostgreSQL); DN-040 | §21 WP-0.3; DN-040 "What still waits" |
| Workflow definitions (any real workflow type) | not specified here | the owning work packages (Phase 1); DN-W1, DN-W2 | none is needed before R1 |
| Requirements WT-1 to WT-10 on every workflow type (section 8) | specified only (requirements, not controls) | each owning work package, with its named tests | needs a real type |
| Policy enforcement and the production audit adapter | ports built; production audit refuses every write | Trust Plane SDK, WP-0.4 | §21 WP-0.4 |
| C9 footprint evidence with Temporal running | specified only | WP-0.6 harness; reference cell [HUMAN] | §18.6; §3.5 "Name the cell" |

**Persistence (D8).** In WP-0.3 this module holds no state of its own. Its production engine refuses every call, so the application does not run on memory and need not refuse to start. When the Temporal adapter arrives, the engine's own store holds the state (section 9).

## 3. Package layout

Hexagonal layers per §6.1; only `api` may be imported by other modules (§5.2; arch rule (b)).

| Package | Holds |
|---|---|
| `hms.platform.workflow.api` | `WorkflowPort`, the value types and the sealed results (section 4). No Temporal, Spring or Jackson types |
| `hms.platform.workflow.domain` | Pure rules: type, signal, aggregate-type and argument-name syntax; business-key rules; argument validation against a type's declared schema; cancel-code rule; workflow-id derivation; status model and its terminal states. No framework types, no system clock (arch rules (a), (d)) |
| `hms.platform.workflow.application` | `WorkflowGateway` (implements `WorkflowPort`: validates, checks the type registry, audits, then calls the engine); the `WorkflowEngine` SPI; `WorkflowTypeRegistry` (per type: its owning module, the argument schema, its signals and their argument schemas, its cancel codes, the maximum number of signals per instance); `WorkflowAuditPort` |
| `hms.platform.workflow.infrastructure` | `UnavailableWorkflowEngine`, `UnavailableWorkflowAudit` and `WorkflowAssembly.production(...)` now; `TemporalWorkflowEngine`, its workers and the engine probe later, with the status-time mapping in `..infrastructure.persistence` (section 9). The only package where `io.temporal..` types may appear (arch rule (c)) |
| `hms.platform.workflow.infrastructure.inmemory` | `InMemoryWorkflowEngine`, `RecordingWorkflowAudit` and `WorkflowAssembly.inMemory(...)`. Main code under the `infrastructure` layer, so rule (b) maps it to this module (D8). KDoc: test and dev only |

**Assembly [P].** `WorkflowAssembly.production(registry)` builds `WorkflowGateway` with `UnavailableWorkflowEngine` and `UnavailableWorkflowAudit`. It takes no engine or audit parameter, so no caller and no setting can select a stub. `app-hms` calls only this factory. The engine is chosen in code at assembly, never by a configuration value. The D8 arch rule `ArchTest:production-never-binds-test-adapters` (the kernel's rule, `platform-kernel.md` section 11, in `:platform:arch-rules`) fails if a main class outside a `..inmemory..` or `..testing..` package depends on `hms.kernel.testing..` or on any `..inmemory..` or `..testing..` package, except `app-hms`'s dev and test wiring package named by the `app-hms` specification; it runs on `app-hms` once the application exists. Other modules' tests get a port from `WorkflowAssembly.inMemory(registry, clock)`.

## 4. Public API (`hms.platform.workflow.api`)

Kept small and stable: other streams code against it (D17). Kotlin-like notation.

Types from the kernel (D1, D4): `hms.kernel.ids.TenantId`; `hms.kernel.context.CommandContext`, `ChangeReason`, `IdempotencyKey`; `hms.kernel.time.ClinicalTime`, `RecordedTime`. This module defines no copy of any of them.

```kotlin
// §6.2 "Commands carry context": every operation takes the kernel CommandContext (D1): tenant, facility,
// actor (with its kind), on-behalf-of, device, purpose-of-use, clinical time, idempotency key,
// correlation id and causation id. The audit record and the WP-0.4 policy enforcement point use them.

@JvmInline value class WorkflowType(val name: String)   // "<owning-module>.<process>", lower-case kebab segments, e.g. "rcm.pre-approval"
@JvmInline value class SignalName(val name: String)     // lower-case kebab, e.g. "task-completed"
@JvmInline value class CancelCode(val code: String)     // from the type's declared cancel-code list; never clinical text

// The idempotent business key: the owning aggregate plus an explicit attempt number (never defaulted).
data class BusinessKey(val aggregateType: String, val aggregateId: UUID, val attempt: Int)

data class WorkflowRef(val tenant: TenantId, val type: WorkflowType, val key: BusinessKey)
@JvmInline value class WorkflowId(val value: UUID)      // opaque; WorkflowIds.of(ref) in the domain (section 5, W8)

// References, process codes, counts and typed times only; no free text, no clinical code [P].
sealed interface ArgumentValue {
    data class Id(val value: UUID) : ArgumentValue
    data class Code(val value: String) : ArgumentValue                 // a process code from the type's declared list
    data class Count(val value: Long) : ArgumentValue
    data class ClinicalAt(val value: ClinicalTime) : ArgumentValue      // valid time, with its original offset (§5.3)
    data class RecordedAt(val value: RecordedTime) : ArgumentValue      // system time, from a Clock
    data class Date(val value: LocalDate) : ArgumentValue               // a business date in the owning facility's zone
}
@JvmInline value class WorkflowArguments(val values: Map<String, ArgumentValue>)

data class StartWorkflow(val type: WorkflowType, val key: BusinessKey, val arguments: WorkflowArguments)
data class WorkflowSignal(val name: SignalName, val arguments: WorkflowArguments)   // dedup key: context.idempotencyKey
data class CancelWorkflow(val code: CancelCode, val reason: ChangeReason)          // reason: audit only, never sent to the engine

enum class FailureKind { ENGINE_FAILURE, TIMED_OUT, TERMINATED_BY_OPERATOR, DEFINITION_ERROR }

sealed interface WorkflowStatus {
    data class Running(val startedAt: RecordedTime, val cancelRequested: Boolean) : WorkflowStatus
    data class Completed(val at: RecordedTime) : WorkflowStatus
    data class Failed(val at: RecordedTime, val kind: FailureKind) : WorkflowStatus
    data class Cancelled(val at: RecordedTime, val code: CancelCode) : WorkflowStatus
}

enum class WorkflowProblem {
    TENANT_MISMATCH, INVALID_NAME, INVALID_KEY, INVALID_ARGUMENTS, INVALID_CANCEL_CODE, UNKNOWN_TYPE, UNKNOWN_SIGNAL,
}

enum class UnavailableReason { NO_ENGINE, ENGINE_UNREACHABLE, DEADLINE_EXCEEDED, AUDIT_UNAVAILABLE }

/** No engine handled the call. Fail closed (§3.5). On start the outcome is unknown (see below). */
data class WorkflowEngineUnavailable(val reason: UnavailableReason) : StartResult, SignalResult, StatusResult, CancelResult

sealed interface StartResult {
    data class Started(val ref: WorkflowRef, val id: WorkflowId) : StartResult
    data class AlreadyExists(val ref: WorkflowRef, val id: WorkflowId, val status: WorkflowStatus) : StartResult
    data class Rejected(val problem: WorkflowProblem) : StartResult
}
sealed interface SignalResult {
    data object Accepted : SignalResult                              // the engine holds the signal; a repeated key has no further effect
    data object NotFound : SignalResult
    data class NotRunning(val status: WorkflowStatus) : SignalResult  // Completed, Failed or Cancelled
    data class Rejected(val problem: WorkflowProblem) : SignalResult
}
sealed interface StatusResult {
    data class Found(val status: WorkflowStatus) : StatusResult
    data object NotFound : StatusResult
    data class Rejected(val problem: WorkflowProblem) : StatusResult
}
sealed interface CancelResult {
    data object CancelRequested : CancelResult
    data class AlreadyClosed(val status: WorkflowStatus) : CancelResult
    data object NotFound : CancelResult
    data class Rejected(val problem: WorkflowProblem) : CancelResult
}

interface WorkflowPort {
    fun start(context: CommandContext, command: StartWorkflow): StartResult
    fun signal(context: CommandContext, ref: WorkflowRef, signal: WorkflowSignal): SignalResult
    fun status(context: CommandContext, ref: WorkflowRef): StatusResult
    fun cancel(context: CommandContext, ref: WorkflowRef, command: CancelWorkflow): CancelResult
}
```

**Where value rules are checked [P].** The api value classes are plain carriers with no `init` checks, except the kernel types, which keep their own rules (a `ChangeReason` cannot be blank, D1). Inputs reach the port from every channel (an activity, an event consumer, a loader), and business outcomes are values, not exceptions (§6.2). So `WorkflowGateway` checks every rule in the table below and answers `Rejected(problem)`. Nothing in the port throws on bad input.

| Rule | Applies to | Problem |
|---|---|---|
| `ref.tenant` equals `context.tenant` | signal, status, cancel | `TENANT_MISMATCH` |
| Type name: 2 or more dot-separated segments, each `[a-z][a-z0-9]*(-[a-z0-9]+)*`, at most 64 characters (that the first segment is the owning module is checked at registration) | start, and every ref | `INVALID_NAME` |
| Signal name: one kebab segment as above, at most 48 characters | signal | `INVALID_NAME` |
| `aggregateType`: one kebab segment as above, at most 48 characters [P] | start, and every ref | `INVALID_KEY` |
| `attempt` ≥ 1 | start, and every ref | `INVALID_KEY` |
| At most 32 arguments; each name `[a-z][a-zA-Z0-9]*`, at most 48 characters [P] | start, signal | `INVALID_ARGUMENTS` |
| Each argument name and kind matches the type's (or signal's) declared schema; required arguments present | start, signal | `INVALID_ARGUMENTS` |
| A `Code` value is in the declared list for that argument; at most 64 characters, `[A-Za-z0-9._:-]` | start, signal | `INVALID_ARGUMENTS` |
| The cancel code is in the type's declared cancel-code list | cancel | `INVALID_CANCEL_CODE` |
| The type is registered | every operation | `UNKNOWN_TYPE` |
| The signal is registered for the type | signal | `UNKNOWN_SIGNAL` |

The cancel reason needs no row: `CancelWorkflow.reason` is a kernel `ChangeReason`, which cannot be blank, and the parameter has no default (W2).

**`WorkflowEngineUnavailable` on `start` means "outcome unknown".** The start may have reached the engine before the connection failed. A retry with the same business key is safe: it returns `Started` or `AlreadyExists` (W1). The caller must never begin the process by hand on this answer alone. Manual takeover follows WT-3 (section 8).

## 5. Domain model, invariants and state machine

The workflow instance as the port sees it (the engine's internal states map onto these):

| From | Operation | Guard / effect | Result | To |
|---|---|---|---|---|
| (none) | `start` | type registered; key and arguments valid | `Started` | `Running` |
| any existing instance | `start`, same ref, same or different arguments | no change; arguments are not compared, the business key identifies the instance [P] | `AlreadyExists(status)` | unchanged |
| `Running` | `signal` | signal registered for the type | `Accepted` | `Running` |
| `Running` | `signal`, repeated `context.idempotencyKey` | no further effect | `Accepted` | `Running` |
| `Running(cancelRequested)` | `signal` | the engine still accepts it; the definition decides whether it has an effect during clean-up, and its spec says so | `Accepted` | `Running(cancelRequested)` |
| `Running` | `cancel` | cancel code declared for the type | `CancelRequested` | `Running(cancelRequested = true)` |
| `Running(cancelRequested)` | `cancel` again (any key, any code) | no change; the first code is kept; both requests are audited with their reasons | `CancelRequested` | unchanged |
| `Running(cancelRequested)` | (engine) | clean-up finished | — | `Cancelled(first code)` |
| `Running(cancelRequested)` | (engine) | clean-up failed | — | `Failed` |
| `Running`, `Running(cancelRequested)` | (engine) | definition finished (before it saw a cancel request) | — | `Completed` |
| `Running`, `Running(cancelRequested)` | (engine) | failure, timeout or operator termination | — | `Failed(kind)` |
| `Completed`, `Failed`, `Cancelled` | `signal` | terminal | `NotRunning(status)` | unchanged |
| `Completed`, `Failed`, `Cancelled` | `cancel` | terminal | `AlreadyClosed(status)` | unchanged |
| (none) | `signal`, `cancel`, `status` | — | `NotFound` | (none) |

A repeated `cancel` or `signal` with the same `context.idempotencyKey` returns the first result. Temporal's "continued as new" stays `Running` under the same workflow id; "terminated" and "timed out" map to `Failed` with their `FailureKind` (section 9).

The table is normative for WP-0.3. An Appendix B.3 file, `docs/specs/state-machines/workflow-instance.yaml`, is proposed so the property-test generator can use it (section 14, item SM-W1); it is outside this file's scope.

Invariants (each enforced in `domain` or `application`, below the API, for every caller):
- **W1 One instance per ref.** Within the engine: a start with an existing `WorkflowRef` never creates a second instance, whatever its state, while the engine retains the instance. The retention period is a cell setting that must exceed every type's maximum lifetime plus a margin [P] (section 9). Beyond retention: the owning module's aggregate records every attempt it starts and never re-uses one (WT-1). A new run needs a new `attempt`, chosen explicitly by the owning module.
- **W2 Cancel needs a reason, never defaulted.** `CancelWorkflow.reason` is a kernel `ChangeReason` (non-blank by construction, D1), and no signature has a default for it. This applies SI-02's "never defaulted" rule to cancellation, and the reason is audited (§6.6 "Flag changes are audited", applied here [P]). The reason goes to the audit record and the owning module's journal only; the engine receives the cancel code.
- **W3 No clinical content in workflow state [P].** Arguments are identifiers, process codes from a declared list, counts and typed times. No free text and no clinical code (a diagnosis, procedure or drug code) is ever an argument; activities read clinical data through the owning module's API when they run. The cancel reason never reaches the engine. Failure and unavailability carry enums, never engine messages. This keeps the domain aggregate the system of record (§2.2 rule 1; ADR-010) and keeps clinical content out of the engine's history, which its tools and logs can show (§6.2 PHI-safe logging). Patient-linked identifiers still reach the history (the business key), so payload encryption is required before the first patient-linked type runs outside tests (section 9; OQ-W3).
- **W4 Terminal is terminal.** No signal or cancel changes a closed instance.
- **W5 Signals are idempotent** on `context.idempotencyKey`. The port does not tell the caller whether a signal was a duplicate; both answers are `Accepted`. Temporal does not deduplicate signals, so each workflow keeps its seen keys in its state. That set is carried across continue-as-new and bounded by a per-type maximum number of signals per instance, declared in the registry; an instance that exceeds it fails as `DEFINITION_ERROR` and surfaces per section 8 [P].
- **W6 Fail closed.** No path returns a success-shaped result (`Started`, `Accepted`, `CancelRequested`, `Found`) when no engine handled the call (§3.5). Mechanism: the production assembly binds `UnavailableWorkflowEngine` and `UnavailableWorkflowAudit`; tests: `UnitTest:workflow-port-contract-fail-closed`, `UnitTest:workflow-production-assembly-fails-closed`.
- **W7 Tenant scope.** A `WorkflowRef` whose tenant differs from `context.tenant` returns `Rejected(TENANT_MISMATCH)` for every operation, status included. The check compares two values and never looks up the engine, so it reveals nothing about whether the ref exists.
- **W8 Opaque, collision-free workflow id [P].** `WorkflowIds.of(ref)` is a name-based UUID (RFC 9562 version 5, SHA-1) over the canonical string `tenant|type|aggregateType|aggregateId|attempt` (UUIDs in lower-case canonical form, attempt in decimal), under a fixed namespace UUID declared in `domain`. No field can contain `|`, so distinct refs give distinct strings. The id shows no aggregate or patient UUID in the engine's tools. The owning module holds the ref, so no reverse mapping is stored here.

**Validation and audit order in `WorkflowGateway` [P].**
1. Value and tenant rules (the table in section 4) → `Rejected(problem)`.
2. The type registry → `Rejected(UNKNOWN_TYPE)` or `Rejected(UNKNOWN_SIGNAL)`.
   A command rejected at step 1 or 2 is recorded as one audit record (section 7); the engine is never called.
3. For commands (start, signal, cancel), the audit attempt record (section 7). If audit is unavailable → `WorkflowEngineUnavailable(AUDIT_UNAVAILABLE)`, and the engine is not called. `status` skips this step.
4. The engine, under its call deadline.
5. For commands, the audit outcome record.

The same order runs in front of every engine, so the contract tests prove it once. In WP-0.3 no workflow type is registered in production, so a production call with valid values answers `Rejected(UNKNOWN_TYPE)`; a registered type (tests only) reaches step 3, where the production audit refuses, and the production engine refuses as well.

## 6. Commands, queries and events

| Operation | Kind | Idempotent on | Results |
|---|---|---|---|
| `start` | command | the business key (W1) | `Started`, `AlreadyExists`, `Rejected`, `WorkflowEngineUnavailable` |
| `signal` | command | `context.idempotencyKey` (W5) | `Accepted`, `NotFound`, `NotRunning`, `Rejected`, `WorkflowEngineUnavailable` |
| `cancel` | command (code and reason required) | `context.idempotencyKey`; a later cancel keeps the first code | `CancelRequested`, `AlreadyClosed`, `NotFound`, `Rejected`, `WorkflowEngineUnavailable` |
| `status` | query | — | `Found`, `NotFound`, `Rejected`, `WorkflowEngineUnavailable` |

**Events published.** None. Nothing in the §8.5 catalogue belongs to this module (`catalogue.md` §4). Business outcomes of a workflow (for example `ClaimSubmitted`) are the owning module's domain events, written to its journal in its own transaction (§5.3). Task requests, process-watch tasks and signal intents are the owning module's journal entries too (section 8). The engine-unreachable and workflow-failed signals are operational alarms (§6.7), not domain events.

## 7. Configuration, permissions and audit

**Configuration chain.** This module declares no setting in WP-0.3 (§6.6). Engine endpoints, namespaces, task queues, call deadlines and the namespace retention period are deployment settings of the cell (Helm), not tenant configuration. Per-type settings belong to the owning module and are declared in `platform-tenancy`'s `SettingCatalogue` (D2) and read through `hms.platform.tenancy.api` (D5): the maximum idle time of WT-2 and the process-watch pool. No value is shipped here; each owning work package declares and justifies its own. The maximum idle time is vendor-locked and tighten-only, shorter being tighter, because it bounds how late a stalled process surfaces (HAZ-0003) [P]. If either setting cannot be resolved (`NotConfigured`), the owning module does not start the workflow and raises the work as an owned manual task. This is a requirement on each owning type, with a named test in its spec; it is not a control here (D16). A workflow type that changes clinical behaviour ships behind a flag owned by `platform-config`, off by default, with a kill switch (§19.3 class C1; SI-19). Its behaviour when the switch engages, or when the flag cannot be evaluated, is WT-9.

**Permissions.** `WorkflowPort` is called from other modules' application layers after their own policy checks; it has no endpoint of its own. The policy enforcement point arrives with the Trust Plane SDK (WP-0.4, §21). Until then `WorkflowGateway` enforces only tenant scope (W7). Signal deliveries from an owning module's relay (WT-4) act as the actor of the event that caused them (the user who completed or cancelled the task), with that event as causation id and the idempotency key derived from the intent entry. They never build a `SYSTEM` actor: the kernel's `SYSTEM_PROCESSES` allow-list (`platform-kernel.md` §7.2) holds no workflow relay package, and adding an owning module's relay package is a kernel spec revision with safety review. An owning type whose relay must deliver a signal caused by a non-user event (for example a task cancelled by the task engine's own system process) needs that revision before it is built. WP-0.4's policy must permit these relayed deliveries, because refusing them would strand a workflow (D14 treats alarm paths the same way).

**Audit [P].** `WorkflowAuditPort` (application layer) records every start, signal and cancel, including `Rejected` and `WorkflowEngineUnavailable` outcomes. A call that passes validation gets two entries; a rejection gets one:
- the **attempt** record, before the engine is called: tenant, actor and actor kind, on-behalf-of, purpose of use, device, correlation and causation ids, idempotency key, operation, workflow ref and workflow id, signal name or cancel code, and for cancel the `ChangeReason`;
- the **outcome** record, after the call: the same correlation id, the result case and, for failures, the enum.

Failure semantics:
- If the attempt record cannot be written, the gateway refuses with `WorkflowEngineUnavailable(AUDIT_UNAVAILABLE)` and does not call the engine. The caller then follows WT-3 as for any unavailability.
- If the outcome record cannot be written, the engine change has already happened and cannot be undone. The gateway still returns the real result, raises the operational alarm `WorkflowAuditIncomplete` (§6.7), and the attempt record lets the audit trail be reconciled.
- For a rejection, the attempt and outcome are one record; if it cannot be written, the rejection is still returned (nothing changed) and the same alarm is raised.

`status` writes no workflow audit record in WP-0.3. Whether a status read of a patient-linked ref needs a BALP AuditEvent is decided with the Trust Plane SDK (WP-0.4); it is part of KA-W1.

Bindings: tests and dev use `RecordingWorkflowAudit` (`..infrastructure.inmemory`). The production binding in WP-0.3 is `UnavailableWorkflowAudit`, which refuses every write, so production can never run a workflow command without audit. The Trust Plane adapter replaces it in WP-0.4. Event names in the audit store are set by `trust-audit` (WP-0.4).

## 8. Requirements on every workflow type, and failure surfacing

Nothing fails silently (§2.2 rule 6). This module cannot enforce these alone: the owning module does most of the work. Every workflow-type specification must meet WT-1 to WT-10, and its review checks them. None is a control yet; each becomes one only with its named test passing (D16).

- **WT-1 Start protocol (W1, HAZ-0003).** In one transaction of its own, the owning module records the start intent on its aggregate (type, attempt, workflow ref) and writes the `TaskRequested` entry for the first process-watch task (WT-2). Only after commit does it call `start`, retrying with the same ref until it gets `Started`, `AlreadyExists` or `Rejected`. The aggregate refuses a second start intent for an attempt it has used.
- **WT-2 Process watch (HAZ-0003, outside the engine) [P].** While an instance is open, the owning module keeps exactly one open process-watch task for it: focus = its aggregate; owner = the type's declared pool; continuous SLA = the type's maximum idle time (section 7). At each step the workflow reaches, an activity of the owning module, in one transaction, requests the next watch task and completes the previous one by focus owner (D14). The new one is written first, so there is never a gap. If the engine is lost, restored to an earlier point, or the instance fails or hangs, no step arrives: the watch task breaches its SLA and escalates on the task engine's own `Clock`, with no dependency on Temporal. When the instance ends, the owning module completes the last watch task. The bound is stated plainly: a stalled process surfaces as an overdue owned task no later than its type's maximum idle time after its last step, plus the task engine's timer tick. It is not the 5-minute `TaskOrphaned` bound, because the work stays owned.
- **WT-3 Outcome unknown and manual takeover (no double execution).** After `WorkflowEngineUnavailable` on `start`, the owning module keeps retrying; the watch task already owns the process. Manual execution may begin only after the owning aggregate records a **manual takeover** for that ref. That is a deliberate act by a person working the watch task, with a `ChangeReason`. From then on, every activity of that ref first reads the aggregate's process mode through the owning module's API, and if it is manual, it ends without a side effect. When the engine is reachable again, the owning module calls `cancel` with a takeover cancel code. Every manual-fallback task carries the workflow ref so the two paths can be reconciled. A process can therefore never run by hand and in the engine at once, even if a lost start reached the engine.
- **WT-4 Signals delivered at least once (HAZ-0003).** The owning module consumes `TaskCompleted` and `TaskCancelled` for the tasks it requested (and any other event a workflow waits for). In the transaction that records the consumption, it writes a signal-intent journal entry. A relay in the owning module delivers it with `signal`, acting as the causing event's actor (section 7), using an idempotency key derived from the intent entry's id, and retries with back-off on `WorkflowEngineUnavailable`. It stops only on `Accepted`, `NotRunning` or `NotFound`; `NotFound` raises an owned task, because the workflow should exist. A delivery that still fails when the retry policy ends becomes a dead-letter item. That item turns into an owned task with the 5-minute alarm, the clock starting at the first failed delivery (`platform-tasks.md` §7.1; D15). The undelivered signal also leaves the watch task un-rotated, so it breaches (WT-2).
- **WT-5 Failure surfacing.** A type declares a failure-handling activity of the owning module. When the instance reaches `Failed`, the activity writes a `TaskRequested` for a failure task in the type's declared pool, through the owning module's outbox. The adapter raises the operational alarm `WorkflowFailed` (§6.7). A log line alone is never enough. The failure activity can itself fail to run, for example on a definition error, so WT-2's watch task is the backstop.
- **WT-6 Never a guard (SI-12; CTRL-0012-3, CTRL-0012-4).** No guard predicate of an ADT, ED, order, MAR or discharge command (§8.4) reads a workflow's status or outcome. Clinical domain packages do not depend on `hms.platform.workflow` (arch rule (f)).
- **WT-7 Arguments (W3).** Arguments are declared per type and per signal (name, kind, required, the code list for each `Code`). No clinical code, no free text. Patient-linked keys require payload encryption before use outside tests (OQ-W3).
- **WT-8 Business dates.** A calendar date (a pre-approval validity date, a discharge date) travels as `Date`, interpreted in the owning facility's zone (the facility node's `zone` in `platform-tenancy`; §4.1 `Asia/Baghdad` default). A durable timer derived from a date or a business-day span gets its instant from an owning-module activity that uses the kernel `BusinessCalendar` (`calendar.weekend-days`, `calendar.holidays`; D3) and the facility zone. Workflow code never converts a date to an instant itself.
- **WT-9 Kill switch and flag unavailability (SI-19; D13) [P].** For a flagged type, the owning module evaluates the flag before `start` and in each step activity. The safe side is reasoned like this. A workflow only coordinates, the clinical command never depends on it (WT-6), and the work it would do can always be done by a person from an owned task. So stopping is the safe side. When the switch is engaged, or the flag answers `Unavailable` (D13), new starts are refused and the work is raised as an owned manual task. Running instances stop at their next step and raise an owned task, and their watch task stays open until a person closes the process. The flag is never read as silently off for work already in flight: the work moves to a person.
- **WT-10 Determinism, versioning and replay.** Section 9; every definition change passes the replay test on N and N-1.

**While the engine is unavailable.** Callers receive `WorkflowEngineUnavailable` and follow WT-3. Clinical commands never depend on the engine (section 1; rules (e), (f)), so clinical work continues.

**Engine unreachable (later, with the adapter).** A probe in the adapter, in the application process and not inside Temporal, checks the engine at a fixed interval. If it fails for longer than a stated window, it raises the operational alarm `WorkflowEngineUnreachable` within 5 minutes of the first failed probe (§2.2 rule 6; §6.7 style) [P].

## 9. Temporal adapter design (waits for the cell, WP-0.2)

Recorded now so the port does not have to change later. Nothing here is built in WP-0.3.

- **Placement.** `TemporalWorkflowEngine` implements the `WorkflowEngine` SPI in `hms.platform.workflow.infrastructure` (arch rule (c)). Temporal Java SDK 1.36.1 from the version catalogue (Apache-2.0 per its POM; server MIT; `backend/gradle/libs.versions.toml`). Status times come from the engine's history and are mapped with the kernel's persistence-only `RecordedTime.restore`. That mapping lives in `hms.platform.workflow.infrastructure.persistence`, the package the kernel's `ArchTest:persistence-only-factories` permits (`..infrastructure.persistence..`; `platform-kernel.md` section 11).
- **Persistence.** Temporal on PostgreSQL (§4.1; K §7.2): its own databases (default store and SQL visibility) on the cell's CloudNativePG cluster, separate from the tenant databases [P]. They are shared by every tenant of the cell, which departs from §6.4 "one database per tenant" for the pooled tier (ADR-006); see OQ-W3. Their backup and restore belong to the cell's backup plan (§16.2). After a restore the two may disagree; the domain aggregate is the record, WT-2 surfaces a stall, and the reconciliation rule is OQ-W6.
- **Workflow id.** `WorkflowIds.of(ref)` (W8). Id reuse policy "reject duplicate". Namespace retention (a cell setting) exceeds every type's maximum lifetime plus a margin; W1 beyond retention rests on the owning aggregate (WT-1).
- **Signals.** Signals carry the idempotency key; each definition keeps the bounded seen-key set (W5). The adapter answers `Accepted` once the server has accepted the signal. Temporal Workflow Update, with the key as the update id, may replace this later without changing the port.
- **Namespaces.** One Temporal namespace per tenant [P] (OQ-W3): isolation and retention per tenant, which matters for the pooled tier at the central site (ADR-006).
- **Task queues.** One task queue per owning module per tenant [P], so a slow module cannot starve another. Whether the `rcm` satellite runs its own workers in its own process (ADR-003) depends on DN-W2.
- **Determinism and versioning** (R08 §4.4, §12.5 "use worker versioning"). Workflow code is deterministic: no system clock, randomness, threads or I/O; time comes from the engine's workflow clock; every side effect is an activity, and activities are idempotent, keyed on workflow id plus activity id. Every change to a definition passes a replay test against recorded histories (merge tier). Definitions change expand → contract, like migrations (§6.4) [P]: release N ships the new version dormant, so a rollback to N-1 (ADR-021) can still run every history (OQ-W4).
- **Deadlines.** Every engine call has a deadline; a missed deadline returns `WorkflowEngineUnavailable(DEADLINE_EXCEEDED)` [P]. No caller blocks on the engine.
- **Payloads and visibility [P].** Arguments are references, process codes, counts and typed times (W3). Before the first patient-linked type runs outside tests, payloads are encrypted by a payload codec; the key (tenant envelope keys, ADR-008) is OQ-W3. No search attribute or memo holds an identifier. Temporal's server logs and visibility store stay on the cell. Only allowlisted metrics without workflow ids join the PHI-free telemetry that §6.7 exports to the central site.
- **Failure mapping.** Engine failure, timeout, operator termination and definition errors map to `FailureKind`. Exception messages never leave the adapter (§6.2 PHI-safe logging).
- **The C9 fallback** (ADR-010; ADR-001; K §7.4). If C9 fails for Option A, "lighter workflow persistence behind the same `WorkflowPort`" applies before any reopen. Because callers see only the port, the fallback changes no caller. What "lighter" means is OQ-W7; whether it also leaves workflow definitions untouched depends on DN-W1.
- **Fork-readiness note** (§4.3; ADR-022; R08 §13 #9). Temporal is a critical-path dependency with a single corporate steward. Exit paths: (1) fork the MIT server and the Apache-2.0 SDK at the pinned version; (2) the C9 fallback engine behind the same port; (3) another engine behind the port. Watched under ADR-010's trigger "upstream licence or steward change". This note moves to the dependency scorecard when that file exists (ADR-022, "Gaps on 2026-10-18").

## 10. Architecture rules

| Rule | State | Where |
|---|---|---|
| (c) `temporalOnlyInWorkflowAdapter`: no `io.temporal..` type outside `hms.platform.workflow.infrastructure..` | exists, runs (ADR-010) | `HmsArchitectureRules.kt`; `TemporalBoundaryRuleTest` |
| (a), (b), (d): domain framework-free; other modules only through `api`; domain never reads the system clock | exist, run | `HmsArchitectureRules.kt` |
| **(e) `safetyKernelNeverUsesWorkflow`**: no class in `hms.orders..`, `hms.medications..`, `hms.results..` or `hms.platform.tasks..` depends on any class in `hms.platform.workflow..` | WP-0.3; adopted by D7 | `HmsArchitectureRules.kt`, added to `all()`; fixture test `SafetyKernelWorkflowRuleTest` (fails on an `orders.application` fixture and a `platform.tasks.domain` fixture that use `WorkflowPort`; passes on an `adt.application` fixture that uses it) |
| **(f) `clinicalGuardsNeverReadWorkflow`** [P]: no class in a `domain` package of `adt`, `ed`, `periop`, `icu`, `maternity`, `nursing` or `record` depends on any class in `hms.platform.workflow..` | proposed; integrator adoption | `HmsArchitectureRules.kt`; fixture test `ClinicalGuardsWorkflowRuleTest` (fails on an `adt.domain` fixture that reads `WorkflowStatus`; passes on an `adt.application` fixture that starts a workflow) |
| D8 (the kernel's rule): no main class outside a `..inmemory..` or `..testing..` package depends on `hms.kernel.testing..` or on any `..inmemory..` or `..testing..` package, except `app-hms`'s dev and test wiring package | WP-0.3, owned by `:platform:arch-rules` | `ArchTest:production-never-binds-test-adapters`; runs on `app-hms` when the application exists |
| Spring Modulith verification: `platform-workflow` exposes only `api` | WP-0.3, with `app-hms` | `app-hms` verification test (§6.8 #3) |

Rule (e) is stricter than §5.2 requires (a tightening, §3.4 item 1). Its reason: the Safety Kernel shares one transaction and must stay testable in the domain (ADR-003, ADR-010 consequences, H2), and its timers must not depend on an engine that can be absent (SI-03, H5). Rule (f) puts WT-6 into code: guards live in the domain (§8.4), so a domain that cannot see the workflow API cannot guard on it. Rules (e) and (f) together cover the Safety Kernel and the clinical modules named in SI-12's commands.

## 11. Hazards and controls

This module adds no SI enforcement of its own. It supports these planned controls:

| Hazard | Control | How this module supports it | Verification (named) |
|---|---|---|---|
| HAZ-0003 (H5, SI-03 b) | CTRL-0003-4 (owner and SLA on every work item) | human steps are tasks in `platform-tasks`, requested through the owning module's outbox (section 1); WT-2 keeps an owned watch task for every open process | `PropertyTest:SI-03-owner-and-sla-on-every-work-item` (the control's own); `ChaosTest:workflow-engine-loss-stalled-process-surfaces-as-overdue-task` (later) |
| HAZ-0003 (H5, SI-03 c) | CTRL-0003-5 (`TaskOrphaned` within 5 minutes) | the orphan timer stays in the task engine; rule (e) keeps `platform-tasks` independent of the workflow engine; undelivered signals become dead-letter tasks with the 5-minute alarm (WT-4) | `ArchTest:safety-kernel-never-uses-workflow`; `ChaosTest:workflow-signal-survives-engine-outage` (later) |
| HAZ-0012 (SI-12 a) | CTRL-0012-4 (pre-authorisation never blocks discharge or emergency care) | a workflow outcome is never a guard (WT-6); pre-approval runs as an `rcm` workflow outside the clinical commands | `ArchTest:clinical-guards-never-read-workflow` (proposed rule (f)); the control's planned `PropertyTest:SI-12-pre-authorisation-never-blocks-discharge-or-emergency-care`, extended to every pre-approval workflow status including `WorkflowEngineUnavailable` (later, with `adt.discharge` and `rcm.pre-approval`) |
| HAZ-0012 (SI-12 a, b) | CTRL-0012-3 (no RCM state blocks an ADT, order, discharge or MAR command) | an `rcm` workflow's state is RCM state; rules (e) and (f) keep it out of those commands | `ArchTest:safety-kernel-never-uses-workflow`; `ArchTest:clinical-guards-never-read-workflow` |

A proposed new control and new causes for HAZ-0003, and a candidate hazard, are in section 14.

## 12. Tests

**Now (WP-0.3).**

| Test (Kind:name) | Tier | Verifies |
|---|---|---|
| `UnitTest:workflow-port-contract-fail-closed` | fast | an abstract contract suite run against `WorkflowGateway` + `UnavailableWorkflowEngine` + recording audit, with a registered test type: every valid call returns `WorkflowEngineUnavailable(NO_ENGINE)`; nothing reports `Started`, `Accepted`, `CancelRequested` or `Found` (W6) |
| `UnitTest:workflow-production-assembly-fails-closed` | fast | `WorkflowAssembly.production(registry)`: with an empty registry every valid call returns `Rejected(UNKNOWN_TYPE)`; with a registered type every command returns `WorkflowEngineUnavailable(AUDIT_UNAVAILABLE)` and the engine is never called; `status` returns `WorkflowEngineUnavailable(NO_ENGINE)`. This is the mechanism behind W6 and KA-W1 (D16) |
| `UnitTest:workflow-port-contract-in-memory` | fast | the same suite against `InMemoryWorkflowEngine`: idempotent start, including with different arguments (W1); every row of the section 5 table, including a second cancel keeping the first code, a signal during clean-up, `Running(cancelRequested)` → `Cancelled`, `Failed` or `Completed`; terminal states (W4); signal and cancel idempotency on `context.idempotencyKey` (W5); `NotFound` and `NotRunning` |
| `UnitTest:workflow-start-outcome-unknown-then-retry` | fast | the in-memory engine in "answer lost" mode creates the instance but answers `WorkflowEngineUnavailable(ENGINE_UNREACHABLE)`; the retry with the same ref returns `AlreadyExists`, never a second instance (WT-3 port side) |
| `UnitTest:workflow-gateway-validation` | fast | every row of the section 4 rule table, for every operation it applies to, including `status`: `TENANT_MISMATCH` (W7), `INVALID_NAME`, `INVALID_KEY`, `INVALID_ARGUMENTS` (count, name, kind, schema, undeclared code, a code longer than 64 characters), `INVALID_CANCEL_CODE`, `UNKNOWN_TYPE`, `UNKNOWN_SIGNAL`; each rejection happens before the engine is called, and a rejected command writes its one rejection audit record |
| `UnitTest:workflow-gateway-audits-every-command` | fast | start, signal and cancel, with `Started`, `AlreadyExists`, `Accepted`, `CancelRequested`, `Rejected` and `WorkflowEngineUnavailable` outcomes: the attempt and outcome records hold the fields listed in section 7; the cancel `ChangeReason` is in the audit record and not in the engine call |
| `UnitTest:workflow-gateway-refuses-when-audit-unavailable` | fast | an audit adapter that fails on the attempt record → `WorkflowEngineUnavailable(AUDIT_UNAVAILABLE)` and no engine call; one that fails on the outcome record → the real result plus the `WorkflowAuditIncomplete` alarm |
| `UnitTest:cancel-reason-has-no-default` | fast | by Kotlin reflection, no parameter of type `ChangeReason` on the port or its commands is optional (W2) |
| `PropertyTest:workflow-id-opaque-and-collision-free` | fast (1,000) / nightly (10⁶) | distinct refs give distinct `WorkflowId`s; the id's string form never contains the aggregate id or the tenant id (W8) |
| `PropertyTest:workflow-start-idempotent-by-business-key` | fast (1,000) / nightly (10⁶) | any sequence of start (same or different arguments), signal (new or repeated key), cancel (first or repeated, any code), engine completion, failure and clean-up over a small set of refs: one instance per ref, terminal states never left, the first cancel code kept, every result as the section 5 table says (`PropertyTestBudget`) |
| `ArchTest:safety-kernel-never-uses-workflow` | fast | rule (e) on fixtures (`SafetyKernelWorkflowRuleTest`) |
| `ArchTest:clinical-guards-never-read-workflow` | fast | proposed rule (f) on fixtures (`ClinicalGuardsWorkflowRuleTest`) |
| `ArchTest:production-never-binds-test-adapters` | fast | the D8 rule on fixtures; on `app-hms` once the application exists |
| `ArchTest:temporal-only-in-workflow-adapter` | fast | rule (c), existing `TemporalBoundaryRuleTest` |
| `ArchitectureTest` of `:modules:platform-workflow` | fast | all `HmsArchitectureRules` on this project's production classes, including `..infrastructure.inmemory` |

The in-memory engine takes an injected `Clock` for its status times (`RecordedTime.now(clock)`; `TestClock` in tests).

**Later (merge tier `src/integrationTest`, or nightly; waiting for the cell or the first workflow type).**

| Test (Kind:name) | Tier | Waits for |
|---|---|---|
| `IntegrationTest:workflow-port-contract-temporal` (the same contract suite against `TemporalWorkflowEngine`) | merge | the adapter; Temporal on PostgreSQL in the dev cell (WP-0.2) |
| `IntegrationTest:workflow-replay-determinism` (recorded histories replay on the current definitions and on N-1) | merge | the first workflow type |
| `IntegrationTest:temporal-postgresql-restart-keeps-workflows` | merge | dev cell |
| `IntegrationTest:workflow-signal-dedup-across-continue-as-new` | merge | the adapter; the first type that continues as new |
| `ChaosTest:workflow-engine-loss-clinical-work-continues` (kill Temporal; clinical commands succeed; callers get `WorkflowEngineUnavailable`) | nightly | dev cell |
| `ChaosTest:workflow-engine-loss-stalled-process-surfaces-as-overdue-task` (kill Temporal mid-workflow; the watch task breaches and escalates within the type's maximum idle time plus one timer tick, on the task engine's clock; `WorkflowEngineUnreachable` within 5 minutes) | nightly | dev cell; the first workflow type (WT-2) |
| `ChaosTest:workflow-signal-survives-engine-outage` (close a human-step task while Temporal is down; the signal is delivered after recovery; past the retry policy, a dead-letter task alarms within 5 minutes of the first failed delivery) | nightly | dev cell; the first workflow type (WT-4) |
| `AcceptanceTest:workflow-manual-takeover-no-double-execution` (a lost start that reached the engine, then a manual takeover: no activity of the ref has a side effect) | merge | the first workflow type (WT-3) |
| `PropertyTest:SI-12-pre-authorisation-never-blocks-discharge-or-emergency-care` (CTRL-0012-4's own), with every `rcm.pre-approval` status and `WorkflowEngineUnavailable` | fast / nightly | `adt.discharge`, `rcm.pre-approval` |
| C9 footprint with Temporal running (indicative on the dev cell; evidence only on the reference cell) | nightly / spike | WP-0.6; reference cell [HUMAN] |

## 13. Acceptance criteria (WP-0.3 part)

1. `hms.platform.workflow.api` holds the section 4 types, uses the kernel's `TenantId`, `CommandContext`, `ChangeReason`, `IdempotencyKey`, `ClinicalTime` and `RecordedTime`, defines no copy of them, and holds no Temporal, Spring, Jakarta or Jackson type; `ArchitectureTest` passes for the project.
2. `WorkflowAssembly.production` binds `UnavailableWorkflowEngine` and `UnavailableWorkflowAudit` and takes no engine or audit parameter; `UnitTest:workflow-port-contract-fail-closed` and `UnitTest:workflow-production-assembly-fails-closed` pass; KA-W1 (section 14) is in `KNOWN-ANOMALIES.md` with a backlog ID and hazard references (§3.5). That `app-hms` calls this factory and binds no in-memory adapter is checked by `ArchTest:production-never-binds-test-adapters` once the Spring Boot application exists; until then it is recorded as waiting.
3. The in-memory engine lives in `hms.platform.workflow.infrastructure.inmemory` (main code, KDoc "test and dev only") and passes the same contract suite; the D8 arch rule passes on its fixtures.
4. Rule (e) exists in `HmsArchitectureRules.all()`, fails on its violating fixtures, passes on its compliant fixture, and runs in every project's `ArchitectureTest`. Rule (f) is added the same way if the integrator adopts it.
5. Validation, audit, idempotency, id derivation and the state-machine property pass; results are recorded only from runs in the session (§3.5).
6. Everything in section 2 not marked "built" ("specified", "specified only", "not specified here", or a part that waits) is recorded as waiting in `STATUS.md` and the WP-0.3 work-package file. No claim is made for the adapter, and no WT requirement is described as a control in force.

## 14. Open questions and proposals (local labels; the integrator numbers them, D9)

- **OQ-W1: backlog ID.** Appendix A has no feature ID for §7 item 6. KA-W1 needs a backlog ID (§3.5). Proposal: a [P] backlog item for the workflow port under WP-0.3, or carry it under `PLT-CORE-07`'s work package without a feature ID.
- **OQ-W2: closed by D1.** `TenantId` lives in `hms.kernel.ids`; `CommandContext`, `ActorRef`, `CorrelationId`, `IdempotencyKey` and `ChangeReason` live in `hms.kernel.context`. The port uses them (section 4). No integrator number is needed.
- **DN-W1 (touches ADR-010's guard, so stop-and-ask item 2): where workflow definitions live and in what form.** Rule (c) allows Temporal types only in `hms.platform.workflow.infrastructure`, so Temporal-native definitions for `rcm`, `adt` and `migration` would all have to live in this module, which would then import those modules (and `rcm` is a separate deployable). Options: (1) engine-neutral definitions (steps, signal waits, durable timers) declared through a small contract in `hms.platform.workflow.api` and run by the adapter, which keeps the C9 fallback and a fork free of definition rewrites; (2) Temporal-native definitions in each owning module's own `..workflow.infrastructure..` package, which widens rule (c); (3) all definitions centrally in this module. Proposal: option 1, decided before the first workflow type (Phase 1: `RCM-INS-01` or `IMP-MIG-01`), together with DN-W2.
- **DN-W2 (touches §5.2's dependency column, so stop-and-ask): how `rcm` and `migration` reach `WorkflowPort` and `platform-tasks`.** §5.2 lists `platform-workflow` as an application module with no dependencies. It gives `rcm` (a satellite, its own deployable) only "Trust (SDK); its own journal and outbox from the platform libraries", and it gives `migration` "via public APIs only". `migration` runs in `app-hms` and may call `WorkflowPort`'s `api` and `platform-tasks`' `api` as public APIs. `rcm` may call neither. Options: (1) split the port, its value types, the gateway and the SPI into a kernel-level library (as the journal became `:platform:journal`), each process (app-hms, the rcm satellite) hosting its own gateway and adapter against the cell's Temporal, with one task queue per module; (2) a client library with a remote port served by `app-hms`; (3) `rcm` writes workflow-command intents to its outbox and `app-hms` executes them. For task requests, `rcm` writes `TaskRequested` to its own journal; whether `platform-tasks`' journal reader (D14) reaches the satellite's schema is `platform-tasks`' question. Proposal: option 1, decided with DN-W1 before `RCM-INS-01`.
- **OQ-W3: Temporal namespaces, the shared store and payload protection.** (a) One namespace per tenant (proposed) or one per cell. (b) Temporal's databases are per cell and shared by every tenant, even with one namespace per tenant. That departs from §6.4 "one database per tenant" and ADR-006 for the pooled tier, and it is recorded as a deviation to decide before the adapter is built. (c) Payload encryption with the tenant's envelope keys (ADR-008, `trust-keys`, WP-0.4), so crypto-shredding a tenant reaches its workflow history; tenant offboarding deletes the tenant's namespace. (d) The patient-linked ids in business keys (W3) and the opaque id (W8). (e) Temporal server logs and visibility stay on the cell (section 9).
- **OQ-W4: worker versioning and N-1 rollback.** Temporal worker versioning against ADR-021's "migrations always roll back to N-1". Proposal: expand → contract for definitions (section 9), with the replay test run on N and N-1.
- **OQ-W5: how a failed or stalled workflow raises an owned task.** Corrected premise: owning modules outside the Safety Kernel request tasks through their own outbox (`TaskRequested`, `platform-tasks.md` §5.3; D14); they do not call `platform-tasks` in their transaction, and `rcm` cannot call it at all (DN-W2). Proposal: WT-2 (process-watch task, outside the engine) as the backstop that needs no engine, plus WT-5 (the owning module's failure activity writes `TaskRequested`) for early warning, plus the adapter's `WorkflowFailed` and `WorkflowEngineUnreachable` operational alarms. Rejected options: the adapter calling `platform-tasks` directly (a dependency §5.2 does not list), and a `WorkflowFailed` domain event (no engine-side mechanism survives losing the engine). Depends on the interface assumed from `platform-tasks` below.
- **OQ-W6: reconciliation after restore.** Temporal's databases and the tenant database can be restored to different points. Proposal: a reconciliation job compares open workflows with their owning aggregates and raises owned tasks for mismatches; owner WP-1.13 (restore test) [P]. WT-2 already surfaces a stall in the meantime.
- **OQ-W7: what "lighter workflow persistence" means** (K §7.4; ADR-010): Temporal on a lighter store, or a small durable-step engine on the tenant PostgreSQL behind the same port. To be settled if WP-0.6's indicative C9 numbers show risk, and only on reference-cell evidence.
- **ADR-W1: ADR-010 note, the Safety Kernel and clinical guards never depend on the workflow engine.** Records the tightening of §3.4 item 1: ADR-010's "never order or MAR state" extended to Safety Kernel timers (rule (e), adopted by D7) and to clinical guards (rule (f), proposed). ADR-010's "Fitness test" lists rules (c), (e) and (f).
- **SM-W1: state-machine file.** Add `docs/specs/state-machines/workflow-instance.yaml` in Appendix B.3 form from the section 5 table, with terminal states and named guard predicates, so the property-test generator can use it. Outside this specification's file scope; the integrator places it.
- **KA-W1: the workflow engine and its audit are fail-closed stand-ins.** Proposed `KNOWN-ANOMALIES.md` row: "`WorkflowPort` has no engine yet. The production assembly binds `UnavailableWorkflowEngine` and `UnavailableWorkflowAudit`. No workflow type is registered, so every production call with valid values answers `Rejected(UNKNOWN_TYPE)`. For a registered type, every command answers `WorkflowEngineUnavailable(AUDIT_UNAVAILABLE)` before reaching the engine, and status answers `WorkflowEngineUnavailable(NO_ENGINE)`. Nothing is ever reported as started. The Temporal adapter waits for Temporal on PostgreSQL in the dev cell (WP-0.2; DN-040). The production audit adapter and the read-audit decision for status wait for the Trust Plane SDK (WP-0.4). Requirements WT-1 to WT-10 are not yet controls: no workflow type exists. No clinical command depends on the port (rules (e) and (f); ADR-010)." Mechanism and test: `WorkflowAssembly.production`; `UnitTest:workflow-production-assembly-fails-closed`. Hazard references: H5 (HAZ-0003), SI-03; SI-12 (HAZ-0012). Backlog ID: per OQ-W1. Status: open. Closes with: WP-0.3 completion after WP-0.2 (the Temporal adapter and `IntegrationTest:workflow-port-contract-temporal`) and WP-0.4 (the audit adapter).
- **Proposed control for HAZ-0003 (local label CTRL-W1):** "Long-running processes never own people's work or Safety Kernel timers. Every human step of a workflow is an owned task in the task engine. While a process is open, an owned process-watch task with a continuous SLA (the type's maximum idle time) is renewed at each step, so a process that stalls, fails or loses its engine surfaces as an overdue owned task on the task engine's clock. Signals that close human steps are delivered at least once, and an undeliverable one becomes a dead-letter task with the 5-minute alarm. The Safety Kernel modules (`orders`, `medications`, `results`, `platform-tasks`) never depend on `platform-workflow`, so an engine outage cannot stop an order, a MAR entry or a `TaskOrphaned` alarm." Type: design; covers: [b, c]; sources: §2.2 rule 6, §4.2 ADR-010, §7 items 4 and 6; state: planned; planned verification: `ArchTest:safety-kernel-never-uses-workflow`, `ChaosTest:workflow-engine-loss-clinical-work-continues`, `ChaosTest:workflow-engine-loss-stalled-process-surfaces-as-overdue-task`, `ChaosTest:workflow-signal-survives-engine-outage`.
- **Suggested causes to add to HAZ-0003:** (1) "A long-running process fails, stalls or loses its engine, and the people's work it should create never appears." (2) "The signal that closes a workflow's human step is lost while the workflow engine is unavailable, so the workflow waits for ever with no open task."
- **HAZ-W1 (candidate, for the integrator and the CSO to judge): a long-running process runs twice.** "After an unknown start outcome, a process runs both by hand and in the workflow engine (a claim submitted twice, a cutover step executed twice), and migrated or financial records are corrupted." Proposed control: WT-3 (manual takeover recorded on the owning aggregate; activities check the process mode); planned verification `AcceptanceTest:workflow-manual-takeover-no-double-execution`. Whether this is a patient-safety hazard (cutover) or an operational risk (claims) is for the CSO.
