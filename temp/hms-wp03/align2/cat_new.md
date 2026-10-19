## 4. Platform events of WP-0.3

Names, owners and payloads are the owning module specifications'; this table follows them (`platform-tasks.md` §6, `platform-tenancy.md` §8, `platform-config.md` §10, `envelope.md` §10). Where an owning specification changes a name, this table changes with it before the type reaches `specified`. None carries patient data other than the patient's UUID, and tenancy and configuration events carry no patient at all. All are `catalogued` and reach `specified` in WP-0.3 with their schemas.

**Valid-time kind** (D10; `ValidTimeKind`, kernel specification §6.2) is declared per event type. It tells the journal's classifier how to treat the row's valid time. Tenancy and configuration events are `EFFECTIVE`: their valid time is an effective date, not a clinical time. Task, pool, queue, request and dead-letter events are `CLINICAL_AT_RECORDING`: the act happens when the server records it, and any clinical "performed at" time travels as event data. No WP-0.3 event type has a `TimingClass`, because none needs an entry-time policy (kernel specification §2). `EFFECTIVE` is allowed only for non-clinical owners; a catalogue test checks this under safety code-owner review (kernel specification §21).

| Canonical name | Owner | Producers | Partition key | Valid-time kind | Free text | What happened | Source |
|---|---|---|---|---|---|---|---|
| `TaskRequested` | `platform-tasks` | any module | patient if any | `CLINICAL_AT_RECORDING` | none | A module requested a task for one of its own aggregates. The row is version 1 of a new `TaskRequest` aggregate; `platform-tasks` reads it from the journal in the same database (in-database consumer `platform-tasks`; `envelope.md` §2) | SI-03; D14 |
| `TaskCompletionRequested`, `TaskCancellationRequested` | `platform-tasks` | any module | patient if any | `CLINICAL_AT_RECORDING` | none | The focus module requested the completion or cancellation of a task, or withdrew a request. Each row is version 1 of a new `TaskRequest` aggregate; in-database consumer `platform-tasks` (`platform-tasks.md` §5.3) | D14 |
| `TaskCreated` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none | A task was created with an owner, an SLA and an escalation chain | SI-03; §7 item 4; §8.4 "Task" |
| `TaskClaimed` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none | open → claimed | §8.4 |
| `TaskReleased` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none | claimed → open | §8.4 |
| `TaskReassigned` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none (reason code) | The owner changed, without a gap | CTRL-0003-4 |
| `TaskCompleted` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none | open or claimed → done, by the focus module (or by `platform-tasks` for its own alarm tasks) | §8.4 |
| `TaskCancelled` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none (reason code) | open or claimed → cancelled, by the focus module | §8.4 |
| `TaskSlaBreached` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none | The SLA's due time passed | §7 item 4 |
| `TaskEscalated` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none | A step of the escalation chain fired, was skipped or failed | §7 item 4; H4 |
| `TaskOrphaned` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none | Unowned or unroutable work detected, on a `Task` (holder unroutable) or on a `TaskRequest` (request refused or not materialised); a first-class alarm, raised within 5 minutes on continuous time | SI-03; §5.3; §8.5; CTRL-0003-5 |
| `TaskOrphanCleared` | `platform-tasks` | owner | patient if any | `CLINICAL_AT_RECORDING` | none | The orphan episode closed (ownership restored, task final, or request materialised, withdrawn or resolved), on a `Task` or a `TaskRequest` | SI-03 |
| `PoolDefined`, `PoolMemberAdded`, `PoolMemberRemoved`, `PoolRetired` | `platform-tasks` | owner | aggregate | `CLINICAL_AT_RECORDING` | none | A pool was defined or retired, or a member was added or removed (routing administration) | SI-03; CTRL-0003-5 |
| `QueueDefined`, `QueueMonitorAssigned`, `QueueMonitorUnassigned`, `QueueRetired` | `platform-tasks` | owner | aggregate | `CLINICAL_AT_RECORDING` | none | A queue was defined or retired, or a monitor was assigned or unassigned (routing administration) | SI-03; CTRL-0003-5 |
| `EnterpriseNodeCreated`, `EnterpriseNodeChanged`, `EnterpriseNodeRetired` | `platform-tenancy` | owner | tenant | `EFFECTIVE` | none | A node of the enterprise hierarchy (tenant → … → bed, service points) was added, changed (updated, moved, country pack or zone changed) or retired | §7 item 1; R11 §2 |
| `SettingChanged` | `platform-tenancy` | owner | tenant | `EFFECTIVE` | `reason`: audit of an administrative change; configuration carries no PHI | One accepted batch of setting changes (values set or cleared, locks applied or removed) on one aggregate of the configuration chain | §6.6; K §7.7 |
| `ChangeSetSubmitted`, `ChangeSetApproved` | `platform-config` | owner | tenant | `EFFECTIVE` | none | A change set was submitted, or its last required approval was recorded | `PLT-CFG-01`; R08 §5 "change set" |
| `ChangeSetRejected`, `ChangeSetWithdrawn` | `platform-config` | owner | tenant | `EFFECTIVE` | `reason`: as above | A change set was rejected or withdrawn | `PLT-CFG-01` |
| `ChangeSetStale`, `ChangeSetApplyStarted`, `ChangeSetApplyRefused`, `ChangeSetApplied` | `platform-config` | owner | tenant | `EFFECTIVE` | none (refusal codes) | A change set went stale, started applying, was refused by tenancy, or was applied | `PLT-CFG-01` |
| `BundleActivationPending`, `BundlePromoted`, `BundlePromotionRefused` | `platform-config` | owner | tenant | `EFFECTIVE` | none | A signed bundle's activation passed its first step, completed, or was refused (gate report) | §6.6; §19.4; ADR-020; ADR-021 |
| `OverlayMergeCompleted` | `platform-config` | owner | tenant | `EFFECTIVE` | none | A three-way merge run finished | `PLT-CFG-01` |
| `FeatureFlagChanged` | `platform-config` | owner | tenant | `EFFECTIVE` | `reason`: as above | A flag's value changed by activation | SI-19; §6.6 "Flag changes are audited" |
| `KillSwitchEngaged`, `KillSwitchEngagementConfirmed`, `KillSwitchReviewed`, `KillSwitchReleased` | `platform-config` | owner | tenant | `EFFECTIVE` | `reason`: as above | A kill switch was engaged, its engagement confirmed, its review recorded, or it was released | SI-19; §7 item 8 |
| `DeadLetterItemOpened`, `DeadLetterItemReplayed`, `DeadLetterItemResolved` | `platform-journal` | any consuming module (written by the event library on its behalf) | patient if any | `CLINICAL_AT_RECORDING` | none (the resolution reason stays in the journal row, not in the event) [P] | A consumer's dead-letter item was opened, replayed or resolved without replay | ADR-009; §12.1; `envelope.md` §10 |

`platform-workflow` publishes no events in WP-0.3 (the port only, and work that a workflow creates for people is a task, ADR-010).

**Why task events carry the patient key.** A task about a patient (a verification task, a critical-result call, a dead-letter item for a patient's message) must stay in order with that patient's clinical events; for example a task created by an `OrderSigned` must not overtake it at the Hub or on a worklist (ADR-009). Tasks and task requests without a patient are keyed by their own id on the platform topic. Pools and queues have no patient and are keyed by their own id.

**Why configuration events share the tenant key.** A kill switch, a flag and a lock are different aggregates. With one key per tenant, consumers apply `KillSwitchEngaged` and a later `FeatureFlagChanged` in commit order (SI-19; D6; `PropertyTest:partition-key-follows-aggregate-keying`).

## 5. Aggregate types of WP-0.3

Registered in code with the events (`envelope.md` §12). Names are PascalCase and unique across modules (`platform-journal.md` §4.1). Clinical aggregate types are registered by their modules' work packages. The valid-time kind belongs to each event type (§4), not to the aggregate type.

| Aggregate type | Owner | Writers | Keying |
|---|---|---|---|
| `Task` | `platform-tasks` | owner | patient if any |
| `TaskRequest` | `platform-tasks` | any module | patient if any |
| `Pool` | `platform-tasks` | owner | aggregate |
| `Queue` | `platform-tasks` | owner | aggregate |
| `EnterpriseStructure` | `platform-tenancy` | owner | tenant |
| `TenantConfiguration` | `platform-tenancy` | owner | tenant |
| `UserPreferences` | `platform-tenancy` | owner | tenant |
| `ConfigChangeSet` | `platform-config` | owner | tenant |
| `KillSwitchBoard` | `platform-config` | owner | tenant |
| `StreamActivation` | `platform-config` | owner | tenant |
| `FeatureFlag` | `platform-config` | owner | tenant |
| `DeadLetterItem` | `platform-journal` | any module | patient if any |

`TaskRequest` is written by the requesting module at version 1; `platform-tasks` may append `TaskOrphaned` and `TaskOrphanCleared` as later versions (`platform-tasks.md` §5.3). Every tenancy and configuration aggregate is keyed by its tenant (D6), so one tenant's structure, configuration, preference, flag and kill-switch events stay in commit order. `Task`, `TaskRequest` and `DeadLetterItem` are work management, not clinical facts: a user's claim or completion is recorded at its recorded time, and a clinical "performed at" time travels as event data (`platform-tasks.md` §6).

