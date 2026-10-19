# Domain-event catalogue

The list of HMS domain events: canonical names, aliases, owning modules, producers, the HL7 v2 and FHIR mappings, partition keys and status; and the aggregate types of WP-0.3 with their keying. Started in WP-0.3 for `PLT-CORE-04` ("domain event catalogue", Appendix A.1) from BUILD-PROMPT §8.5, R11 §14 and BP §7.6. The catalogue "is a published product surface" (§5.3; R11 §17 #3): consumers code against these names. Envelope, naming and delivery rules: `docs/specs/events/envelope.md`. The journal that carries every event: `docs/specs/modules/platform-journal.md`.

**Status on 2026-10-19:** revised after two automated review lenses. No event is published. Every event below is `catalogued` (name, owner, producers and key agreed; no schema yet). The platform events of WP-0.3 (§4) use the names of their owning module specifications and reach `specified` in WP-0.3 together with their schemas. The code registry in `hms.kernel.events` must list exactly the events and aggregate types of §2, §4 and §5, and none of §2.1 (`UnitTest:event-catalogue-matches-document`). Open items carry local labels (OQ-C1 and so on, §7); the integrator numbers them.

**Programme numbers (19 October 2026).** OQ-C1 to OQ-C4 are OQ-172. (`docs/program/DECISIONS-NEEDED.md`, `docs/program/OPEN-QUESTIONS.md` §(g).)

## 1. Rules

- **Canonical names follow R11 §14.** Where R11 §14 has no name, the name comes from §8.5 or BP §7.6 (`MedicationOverridden`, `ResultAcknowledged`, `CriticalResultEscalated`, `ImmunizationRecorded`, `ReferralSent`, `ReferralAccepted`, `StaffAssignmentChanged`, `IdentityVerified`, `PaymentReconciled`, `TaskOrphaned`), or from the owning module specification for platform events (§4). BP §7.6 names that §8.5 declares aliases are aliases, never separate events: `ChargeGenerated` = `ChargeCreated` and `EncounterMoved` = `PatientTransferred` (§8.5; A.20; OQ-036). An alias is never written to the journal or used as a CloudEvents `type` (`envelope.md` §4).
- **Names** are PascalCase, past tense, unique across the catalogue, and never name a sensitive category (`envelope.md` §4).
- **Expanded names.** §8.5 and R11 §14 write groups with slashes ("AppointmentBooked / Rescheduled / …"). Each short form is expanded with the group's noun (`AppointmentRescheduled`, `MedicationNotGiven`, `ChargeCredited`) [P]; R11's spelling is otherwise kept unchanged.
- **Owner** = the §5.2 module that owns the event's schema. **Producers** = the modules that may write it to their journal; the journal refuses any other (`platform-journal.md` J-13). Unless a row says otherwise, the owner is the only producer. Where R11 §14's "Emitted by" does not name a §5.2 module, the assignment is marked [P] or the event is not registered yet (§2.1).
- **Partition key** (D6; `envelope.md` §5, §9):
  - `patient`: keyed by the patient's UUID, ordered with all of that patient's events (ADR-009);
  - `patient if any`: keyed by the patient when the aggregate has one at creation, otherwise by the aggregate's id;
  - `aggregate`: keyed by the aggregate's id, on the platform topic;
  - `tenant`: keyed by the tenant's id, on the platform topic, so all of one tenant's events of this kind stay in order (tenancy and configuration).
  The aggregate type's keying (§5) decides the key; an event type's keying must be compatible with every aggregate type that writes it.
- **Valid-time kind** (D10): every event type declares one `ValidTimeKind` and, where its entries can be given a clinical time, a `TimingClass` (`envelope.md` §12; kernel specification §6.2). §4 lists them for the platform events. For the events of §2, the producing work package declares both with the schema; no module produces a §2 event in WP-0.3.
- **HL7 v2 and FHIR columns** are copied from §8.5 for the group of events in each row. Which trigger serves which single event of a group is decided in the Hub's conformance profiles (§12.2; Phase 1), not here. Nothing in these columns was added from memory.
- **Free text.** No event carries free text unless its row names the field and why (`envelope.md` §6). Clinical events name none until their schemas are written.
- **Status** (the `CatalogueStatus` values):
  - `catalogued`: the name, owner, producers and key are agreed; no schema yet;
  - `specified`: a JSON Schema and sample payloads exist in the repository (`envelope.md` §7);
  - `published`: registered in Apicurio and produced by a released build;
  - `deprecated`: still produced, with a deprecation date and an earliest removal date at least 12 months later (§5.3).
- **Adding an event:** the work package that builds the producing feature adds its row here and in the code registry, writes its schema (status `specified`), and adds the producer and consumer contract tests (§22.1 item 2 "domain events published as catalogued"; §18.2).

## 2. Clinical and business events (§8.5; R11 §14; BP §7.6)

| Canonical names | Aliases | Owner | Producers | HL7 v2 (§8.5) | FHIR (§8.5) | Partition key | Status |
|---|---|---|---|---|---|---|---|
| `PatientRegistered`, `PatientUpdated` | — | `empi` | owner | ADT^A04 / A08 / A28 / A31 | Patient | patient | catalogued |
| `PatientMerged`, `PatientUnmerged` | — | `empi` | owner | A40; there is no standard unmerge trigger (agree A47/A08 corrections per interface) | Patient.link | patient (§3 note 1) | catalogued |
| `AppointmentBooked`, `AppointmentRescheduled`, `AppointmentModified`, `AppointmentCancelled`, `AppointmentNoShow` | — | `scheduling` | owner | SIU^S12 / S13 / S14 / S15 / S26 | Appointment | patient | catalogued |
| `PatientArrived` | — | `adt` [P] | owner | ADT^A04 or A10 | Encounter | patient | catalogued |
| `PatientCheckedIn` | — | `scheduling` [P] | owner | SIU^S14 | Encounter | patient | catalogued |
| `EncounterAdmitted`, `PatientTransferred`, `PatientDischarged` | `EncounterMoved` = `PatientTransferred` | `adt` | owner | A01 / A02 / A03 | Encounter | patient | catalogued |
| `AdmissionCancelled`, `DischargeCancelled` | — | `adt` | owner | A11 / A13 | Encounter | patient | catalogued |
| `OrderSigned`, `OrderModified`, `OrderDiscontinued` | — | `orders` | owner | OML^O21, OMI^O23, OMG^O19, ORM^O01 (legacy), RDE^O11 | ServiceRequest / MedicationRequest | patient | catalogued |
| `MedicationVerified`, `MedicationDispensed` | — | `medications` | owner | RDS^O13 | MedicationDispense | patient | catalogued |
| `MedicationAdministered`, `MedicationNotGiven`, `MedicationOverridden` | — | `medications` | owner | RAS^O17 | MedicationAdministration | patient | catalogued |
| `SpecimenCollected`, `SpecimenReceived`, `SpecimenRejected` | — | `lis` | owner | OML; SSU^U03; OUL^R22 | Specimen | patient | catalogued |
| `ResultPreliminary`, `ResultFinal`, `ResultCorrected` | — | `results` (schemas) | `lis`, `ris` [P] (OQ-C3) | ORU^R01 | Observation / DiagnosticReport | patient | catalogued |
| `ResultAcknowledged` | — | `results` | owner | ORU^R01 | Observation / DiagnosticReport | patient | catalogued |
| `CriticalResultCommunicated`, `CriticalResultAcknowledged`, `CriticalResultEscalated` | — | `results` | owner | ORU + ACK workflow | Communication / Task | patient | catalogued |
| `ImagingStudyAvailable` | — | `ris` | owner | ORU/OMI; DICOM MPPS | ImagingStudy | patient | catalogued |
| `NoteSigned`, `NoteAmended` | — | `record` | owner | MDM^T02 / T08 | Composition / DocumentReference | patient | catalogued |
| `ChargeCreated` | `ChargeGenerated` = `ChargeCreated` | `rcm` (schema) | `orders`, `medications`, `lis`, `ris` [P]; each WP that adds charge capture adds its module (§3 note 2; OQ-C3) | DFT^P03 / P11 | Internal API (finance resources leave R6 core) | patient | catalogued |
| `ChargeCredited` | — | `rcm` (schema) | `rcm` and the producers of `ChargeCreated` [P] (OQ-C3) | DFT^P03 / P11 | Internal API | patient | catalogued |
| `BedStatusChanged` | — | `adt` | owner | A20 | Location.operationalStatus | aggregate (the bed; §3 note 3) | catalogued |
| `ConsentRecorded`, `ConsentRevoked` | — | `trust-policy` | owner | CON segment | Consent | patient | catalogued |
| `BreakTheGlassAccess` | — | `trust-policy` | owner | — | AuditEvent | patient; stream to be decided (`envelope.md` OQ-E2) | catalogued |
| `ImmunizationRecorded` | — | `record` | owner | VXU^V04 | Immunization | patient | catalogued |
| `ReferralSent`, `ReferralAccepted` | — | `scheduling` [P] (§5.2: "referrals intake"; §9.2) | owner | REF / RRI | ServiceRequest | patient | catalogued |
| `IdentityVerified` | — | `empi` [P] | owner | — | Internal | patient | catalogued |

### 2.1 Named, not registered yet

These names come from §8.5, R11 §14 or BP §7.6, but their owner, key or name is not decided. They are **not** in the code registry, so the journal refuses them until they are (`UnitTest:event-catalogue-matches-document` reads this list).

| Name or group | HL7 v2 (§8.5) | FHIR (§8.5) | What is missing |
|---|---|---|---|
| Leave / return; pending admit; pre-admit; bed swap (`adt`) | A21 / A22; A14; A05; A17 | Encounter | Names (OQ-C1) |
| `ClaimSubmitted`, `ClaimAdjudicated` (`rcm`) | Document pack (no X12) | Claim / ClaimResponse where an insurer accepts FHIR | Key: a claim may cover many patients (OQ-C4) |
| `PaymentReconciled` (`rcm`) | — | Internal | Key (OQ-C4) |
| `StaffAssignmentChanged` | — | Internal | Owner (ADR-024: `adt`, `nursing` or a care-team module) and key (OQ-C3, OQ-C4) |
| `OrderVerified`, `ResultAmended` (BP §7.6) | — | — | Alias or separate event (OQ-C2; §3 note 4) |

## 3. Notes

1. **Merges.** Merges are reversible links, not moves (SI-08), so a patient's earlier events keep their key. `PatientMerged` and `PatientUnmerged` are keyed by the surviving patient's UUID [P]; consumers that hold the replaced patient's events use the link in the payload. After a merge one person's events span two keys; per-person ordering across them is `envelope.md` OQ-E4, for `empi` (WP-1.2). Merges are never offline (SI-15). The payload rules for both patients' identifiers are written with `empi`.
2. **Charges.** §5.2 says `rcm` "consumes clinical events (for example `ChargeGenerated`) and never changes clinical aggregates", and that during an RCM outage "charge events wait in the outbox". The order-sign transaction includes the charge event (§5.2; ADR-001 C1). So `ChargeCreated` is written by the clinical producer on its own aggregate and consumed by `rcm`; the schema belongs to `rcm` as the conformist downstream's contract. Who writes `ChargeCredited` is OQ-C3.
3. **Bed status.** A bed has no patient key, so `BedStatusChanged` is not ordered with the patient events of the admission that occupied the bed. The Hub's per-patient ordering (A08 never overtakes A01) is unaffected; A20 ordering against A01/A02 is the Hub's to handle (§12.1) [P].
4. **BP §7.6 names not in §8.5.** BP §7.6 also names `OrderVerified` and `ResultAmended`. §8.5 declares only two aliases, so these are neither aliases nor separate events until decided (OQ-C2). They are not in the code registry.

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

## 6. Aliases

| Alias (BP §7.6) | Canonical (R11 §14) | Rule |
|---|---|---|
| `ChargeGenerated` | `ChargeCreated` | Alias only; never a type, never a journal `event_type` (§8.5; A.20; OQ-036) |
| `EncounterMoved` | `PatientTransferred` | As above |

## 7. Open questions (local labels; the integrator numbers them)

- **OQ-C1: names for the unnamed ADT events.** §8.5 lists leave / return (A21 / A22), pending admit (A14), pre-admit (A05) and bed swap (A17) without event names, and R11 §14 names none. Proposed for the `adt` work package to name, in R11's style; until then they are not in the registry (§2.1).
- **OQ-C2: `OrderVerified` and `ResultAmended`.** BP §7.6 uses both; §8.5 neither lists them nor declares them aliases. Is `OrderVerified` an alias of `MedicationVerified`, and is `ResultAmended` an alias of `ResultCorrected` or a separate event (the §8.4 result machine has both "amended" and "corrected" states)? A naming decision for the human lead, next to OQ-036.
- **OQ-C3: owners and producers where R11 §14 names a function, not a module.** `PatientArrived` (`adt`) vs `PatientCheckedIn` (`scheduling`); `ReferralSent`/`ReferralAccepted` (`scheduling`); `IdentityVerified` (`empi`); the result events (schema in `results`, produced by `lis` and `ris`); `ChargeCreated` (schema in `rcm`, produced by the clinical modules) and who writes `ChargeCredited`; the owner of `StaffAssignmentChanged` (care-team assignment, ADR-024: `adt`, `nursing` or a care-team module). Confirm or correct per module work package.
- **OQ-C4: keys for finance and staffing events.** Whether `ClaimSubmitted`/`ClaimAdjudicated` (a corporate or insurer claim may cover many patients), `PaymentReconciled` and `StaffAssignmentChanged` are keyed by patient, by their aggregate or by tenant. Until decided they are not in the registry (§2.1).
