# Bitemporal journal and outbox (`platform-journal`)

The module specification of the bitemporal journal-as-outbox, written before the code it governs (BUILD-PROMPT §3.2 step 2, §22.1 item 1) in WP-0.3. Features: `PLT-CORE-01` clinical journal ("bitemporal append-only journal; entered-in-error/amend semantics; provenance", Appendix A.1) and the outbox part of `PLT-CORE-04` ("domain event catalogue; transactional outbox"). Decisions it implements: ADR-004 (event-sourcing-lite with the journal as the transactional outbox) and ADR-009 (journal-as-outbox, events keyed by patient, no hidden dead-letter topics). Sources: §2.1 preamble, SI-06 and SI-10, §2.2 rules 1, 2, 6 and 7, §5.2, §5.3 C, §6.2, §6.3, §6.4, §6.7, §6.8 items 2, 4, 9 and 10, §7 items 2, 3 and 5, §8.1 P2, P3, P8, P10, §8.3, §12.1, §13.4; R08 §3.5–§3.7, §3.11, §4.3; R11 §1, §14; BP §7.6; K §7.5; ADR-008; ADR-026.

Companion specifications: the CloudEvents envelope and delivery rules in `docs/specs/events/envelope.md` and the domain-event catalogue in `docs/specs/events/catalogue.md`. The time types (`ClinicalTime`, `RecordedTime`, `ValidTime`, `ValidTimeInput`, `ValidTimeKind`, `AsOf`, `EntryTiming`, `EntryTimingCode`, `ClinicalTimeSource`, `EntryTimeClassifier`, `EntryTimePolicy`) belong to `hms.kernel.time`; the identifier generator and the typed ids `TenantId`, `FacilityId`, `PatientId`, `UserId` to `hms.kernel.ids`; the command context (`CommandContext`, `ActorRef`, `ChangeReason`, `IdempotencyKey`, `CausationId`, `TransactionContext`, `TransactionRunner`, the `EntryTimePolicySource` port) to `hms.kernel.context` (`docs/specs/modules/platform-kernel.md`; integrator decision D1). This document uses them and lists what it assumes of them (§18).

**Status on 2026-10-19:** specification only, revised after two automated review lenses (correctness; clinical safety). Nothing below is built. Everything marked [P] is this build's own engineering choice, not the plan's. Open items carry local labels (OQ-J1, KA-J1, HAZ-J1, ADR-J1, DN-J1 and so on, §17); the integrator numbers them.

## 1. Purpose and scope

The journal is the tenant's write record. Every state change of every aggregate writes one row, in the same transaction as the change, and the row is never updated or deleted (§5.3 C; ADR-004). The same rows serve three purposes (§5.3 C; R08 §3.11 C):

1. **The write-audit trail.** Who changed what, when in the world (valid time) and when in the system (recorded time), on whose behalf, from which device, for what purpose and why (§5.3 C; §6.2 "commands carry context"). Reads are audited separately by the Trust Plane (§7 item 2; R08 §3.11 C).
2. **The transactional outbox.** Debezium reads the rows from the write-ahead log and publishes them as CloudEvents to Kafka, keyed by patient (§5.3 "Event layers" 2; ADR-009; R08 §4.3). A row is published if and only if its transaction commits, without two-phase commit (R08 §4.3).
3. **The source of every derived view.** Read models are rebuilt by folding the journal (§2.2 rule 1; §5.3 D; R08 §3.6), and the "as-was" view is reconstructed from it on both time axes (§7 item 3; §8.1 P3; R08 §3.7).

The journal is also where SI-10 is enforced (§2.1, SI-10 "Enforced in: Bitemporal journal"). It classifies every append's timing itself, below every channel (§4.4).

**Where it lives [P] (integrator's shared architecture).** §5.2 lists `platform-journal` as a Platform module that owns "bitemporal journal, outbox, domain-event publication, as-was queries". §6.1 lists `journal` among the shared kernel libraries under `backend/platform/`, and §5.2 says the `rcm` satellite has "its own journal and outbox from the platform libraries". The journal is therefore built as the kernel library `:platform:journal` (package `hms.kernel.journal`) that every module and the `rcm` satellite link, each writing to the journal table in its own database. The library realises the `platform-journal` module's responsibilities; there is no separate Spring application module of that name in WP-0.3. Catalogue entries that name `platform-journal` as owner mean this library. The domain-event contract types live in the sibling library `:platform:events` (`hms.kernel.events`; `envelope.md`).

**Out of scope.** Immutable fact tables of shape B (`valid_period`, `recorded_at`, `author`, `attester`, `source`, `supersedes_id`; §5.3 B) belong to the modules that own the facts (for example `record`); they follow the same immutability rules (§9.3) but are not this library. Clinical-note lifecycle rules of SI-06 (signing, addenda, the hashed rendering) belong to `record` (§8.4 "Clinical note"); the journal gives them their storage guarantees. Read auditing (BALP AuditEvents) belongs to `trust-audit` (WP-0.4). Audit of refused commands is not a journal row (§4.7).

## 2. What is built in WP-0.3 and what waits

DN-040 (19 October 2026) lets WP-0.3 build its cluster-free parts before WP-0.2's cell exists. Tests that need PostgreSQL, Kafka or Debezium are written now in `src/integrationTest` (compiled in the fast tier, run in the merge tier; `backend/README.md` "Test tiers") and recorded as waiting.

The "Now" column uses four words only: **Built** (code and its fast-tier tests exist in WP-0.3), **Written** (code exists and compiles, but has not run against its real infrastructure), **Specified** (this document only; no code yet), **Not built**.

| Part | Now (WP-0.3) | Later | Waits for |
|---|---|---|---|
| Entry model, append validation, entry-time classification through the kernel classifier, as-was functions, projection runner, tail ordering (`hms.kernel.journal.domain`) | Built (unit and property tests, fast tier) | — | — |
| In-memory adapters (`hms.kernel.journal.inmemory`, test and dev only, D8) | Built | — | — |
| `BackDatingAuthorization` port and its production binding | Built: the binding refuses every request (§4.4) | A binding that asks the policy decision point | WP-0.4 |
| Back-entry | Built as a check (J-9); no production code can build a `BackEntryAuthority` (kernel §7.2), so no back-entry row can occur | Back-entry rows | `TRU-BCP-03` back-entry tooling |
| Policy lookup through the kernel's `EntryTimePolicySource` | Built in the appender; test double built | Tolerance values; tenancy's `EntryTimePolicyResolver` answers `NotConfigured` until then | DN-KN1 (CSO). Until then every append that needs a policy is refused (§4.4) |
| Flyway migration (schema `journal`, table, counter table, trigger, grants, indexes, row-level security) | Written | Run against PostgreSQL | WP-0.2 cell or Testcontainers in the merge tier |
| jOOQ adapter (append, readers, tail) | Written | Run against PostgreSQL | As above |
| Migration linter (§6.8 #2), a reusable class in `:platform:arch-rules` (D7) | Built; runs in the fast tier of every project with migrations | — | — |
| Journal-rebuild exit test (§21 WP-0.3) | Built: property version on the in-memory adapter (fast tier) | The PostgreSQL version | WP-0.2 cell (DN-040) |
| N-1 upgrade-and-rollback test (§6.8 #9) | Written: harness only; the first migration has no N-1 | First run | A second journal migration |
| `EnvelopeMapper` (journal row to `HmsEnvelope`) | Built | — | — |
| CloudEvents transform, Debezium connector, Kafka topics, Apicurio registration | Specified (here and in `envelope.md`) | Built and tested | WP-0.2 cell (DN-040) |
| Publication watermark check (gap detection, §10.3) | Built: its comparison logic, on the in-memory adapter. The topic reader and wiring are Specified | Wired and tested | WP-0.2 cell (D15) |
| Per-patient ordering exit test (§21 WP-0.3) | Built: consumer idempotency and key-sequence logic on a simulated at-least-once broker (`envelope.md` §9) | Kafka run | WP-0.2 cell |
| Read auditing of privileged journal reads | Not built: the privileged readers have no production caller in WP-0.3 | Trust Plane Audit SDK | WP-0.4 (§7 item 2; ADR-013) |
| Audit of refused commands | Not built: not a journal row (§4.7) | Trust Plane Audit SDK | WP-0.4 |

**Start-up refusal (D8).** `app-hms` production wiring never binds an `..inmemory..` or `..testing..` type (`ArchTest:production-never-binds-test-adapters`, the kernel's rule with its exception for the `app-hms` dev and test wiring package; kernel §11). Until the jOOQ adapter has passed its merge-tier tests on the cell, the production profile has no verified journal and the application refuses to start rather than run on memory. This holds in every environment class (BUILD, TEST, TRAIN, PROD, PLAY); the in-memory journal runs only in the dev profile with no environment class, the same rule as the modules' volatile stores (D8; `IntegrationTest:app-hms-refuses-to-start-without-journal-persistence`, waits for the cell).

## 3. Packages and dependencies

| Package | Holds | Rules |
|---|---|---|
| `hms.kernel.journal.domain` | The entry model, append validation, entry-time classification glue, the as-was functions, `Projection` and `ProjectionRunner`, tail ordering | Pure Kotlin: no Spring, Jakarta, jOOQ, Jackson, Temporal, Kafka, CloudEvents, Debezium or Apicurio types; never reads the system clock. Business outcomes are sealed result values (§6.2) |
| `hms.kernel.journal` | The ports (`JournalAppender`, `ModuleJournalReader`, `JournalTail`, `AsWasReader`, `ReadModelStore`, `BackDatingAuthorization`), the services `ReadModelRebuilder` and `PublicationWatermarkCheck` (its comparison logic; the topic reader is an infrastructure adapter), `EnvelopeMapper`, and the refusing production binding of the privilege port | Same rules as `domain` [P] |
| `hms.kernel.journal.infrastructure` | `JooqJournal` (the ports over jOOQ), `JournalTable` (hand-declared jOOQ table and fields, §9.7), the CloudEvents transform (§10) | The only code that touches the journal table; insert and select only, plus the counter-table upsert (§9.3, `ArchTest:journal-adapter-insert-and-select-only`) |
| `hms.kernel.journal.inmemory` | `InMemoryJournal` (every port), with an explicit transaction scheduler for tests | Main code, test and dev only, never bound by `app-hms` production wiring (D8) |
| `hms.kernel.journal.testing` | Test doubles of `BackDatingAuthorization` and of the kernel's `EntryTimePolicySource`; generators for property tests | As above (D8) |
| `src/main/resources/db/migration/journal/` | The Flyway migrations of §9 | Checked by the migration linter |

**Dependencies.** `:platform:ids` (UUIDv7 generator, typed ids), `:platform:time` (`ClinicalTime`, `RecordedTime`, `ValidTimeInput`, `AsOf`, `EntryTiming`, `EntryTimingCode`, `EntryTimeClassifier`), `:platform:context` (`CommandContext`, `ActorRef`, `ChangeReason`, `IdempotencyKey`, `CorrelationId`, `CausationId`, `TransactionContext`, `TransactionRunner`, `EntryTimePolicySource`; D1), `:platform:events` (catalogue, aggregate-type registry, partition key, envelope types). jOOQ and the PostgreSQL driver only in `infrastructure`. No dependency on any application module (`backend/platform/README.md`). Application modules depend on the journal; the journal never depends on them (so `platform-tasks` depends on `:platform:journal`, D5).

**Architecture rules [P].** The kernel rule set of the kernel specification (§11 there) is extended to `hms.kernel.journal..` except `..infrastructure..`: framework-free (with `io.cloudevents`, `io.debezium` and `io.apicurio` in `FRAMEWORK_PACKAGES`, D7) and no system clock (`ArchTest:kernel-journal-framework-free-outside-infrastructure`; `ArchTest:no-now-in-domain` extended). `RecordedTime.restore` follows the kernel's rule unchanged: the journal's adapters in `hms.kernel.journal.infrastructure..` and `hms.kernel.journal.inmemory..` are on its allow-list (`ArchTest:persistence-only-factories`, kernel §11). `AsWasReader` and `JournalTails.forPlatform` may be used only by `hms.kernel.journal..` and, from WP-0.4, the Trust Plane SDK wrapper (`ArchTest:journal-privileged-readers-not-used-by-modules`).

## 4. The domain model

### 4.1 The journal entry: every column and why

One row per change (§5.3 C). The columns below are the §5.3 C list ("aggregate type and id, patient id, valid time, recorded time, actor, on-behalf-of, device, purpose-of-use, reason, payload, previous version"), the R08 §3.11 C additions (tenant, facility, event type), the §6.2 command context (idempotency key, correlation id) and what the outbox and ordered readers need (§8.3, §10).

| Column | Type | Meaning | Why |
|---|---|---|---|
| `id` | `uuid` (version 7) | The entry's identifier; also the CloudEvents `id` | UUIDv7 for every identifier (§5.3; RFC 9562). Generated by the injected `hms.kernel.ids` generator, never by the database [P], so tests are deterministic. Consumers deduplicate on it (ADR-009) |
| `tenant_id` | `uuid` | The tenant (`TenantId`) | Every row carries `tenant_id` (§6.4), even in a database per tenant (R08 §3.11 "defense in depth") |
| `facility_id` | `uuid`, nullable | The facility (`FacilityId`), where the change has one | "and, where it applies, `facility_id`" (§5.3; §6.4) |
| `producer_module` | `text` | The §5.2 module that wrote the row, for example `adt` | Becomes the CloudEvents `source`. Checked against the aggregate type's owner and the event type's producers (J-13) |
| `aggregate_type` | `text` | The aggregate's registered type name, PascalCase, unique across modules, for example `Encounter` | §5.3 C; CloudEvents `subject`. Registered with owner and keying in `hms.kernel.events` (J-13; `envelope.md` §12) |
| `aggregate_id` | `uuid` | The aggregate's identifier | §5.3 C |
| `version` | `integer` ≥ 1 | The aggregate's version after this change | Optimistic concurrency on aggregate version (§6.2) |
| `previous_version` | `integer`, nullable | The version this change was made against; null only for version 1 | "previous version" (§5.3 C). Always `version − 1` (check constraint) |
| `patient_id` | `uuid`, nullable | The patient (`PatientId`) the change concerns | §5.3 C. Present exactly when the aggregate has a patient (J-14) |
| `partition_scope` | `text` | `patient`, `tenant` or `aggregate`: which identifier keys this row | The D6 rule, decided per aggregate type (J-14; `envelope.md` §5) |
| `partition_key` | `text` | The patient id, the tenant id or the aggregate id, by `partition_scope` | The Kafka message key and the CloudEvents `partitionkey` (D6) |
| `key_seq` | `bigint` ≥ 1 | The row's position among all rows of its partition key: 1, 2, 3, … with no gaps, in commit order | Lets consumers detect a lost or duplicated event per key and lets replay keep commit order (§8.3; `envelope.md` §9, §11) [P] |
| `event_stream` | `text`, generated | `patient` when `partition_scope = 'patient'`, otherwise `platform` | The CloudEvents transform routes the two streams to two topics (§10) [P] |
| `event_type` | `text` | The canonical event name from the catalogue, for example `EncounterAdmitted` | R11 §14 names are canonical; aliases are never written (§8.5; A.20; OQ-036) |
| `event_major` | `integer` ≥ 1 | The event type's major version | Breaking changes need a new major (`envelope.md` §7). The CloudEvents `type` string is built by the mapper, not stored (§10) |
| `change_kind` | `text` | `CHANGE`, `AMENDMENT` or `ENTERED_IN_ERROR` | SI-06: "Amendments are versions … entered-in-error replaces delete" (§2.1); P3 (§8.1) |
| `supersedes_version` | `integer`, nullable | For `AMENDMENT` and `ENTERED_IN_ERROR`: the version of the same aggregate that this row amends or retracts | Corrections link to what they correct (§13.4 "Amendments"; R07 §8.4). A foreign key to the same aggregate's version makes a cross-aggregate link impossible (§9.2) |
| `valid_from` | `timestamptz` | Clinical (valid) time: when the change became true in the world, as a UTC instant | "Clinical time is distinct from system time" (SI-10); valid time (§5.3 C); `effective` (§8.1 P2) |
| `valid_from_offset_s` | `integer` | The UTC offset, in seconds, of the valid time as supplied | "instants stored in UTC with the original offset" (§5.3; §8.1 P10) |
| `valid_to` | `timestamptz`, nullable | End of the valid period, exclusive; null = open | Facts with a period (R08 §3.7) |
| `valid_to_offset_s` | `integer`, nullable | Its original offset | As above |
| `valid_period` | `tstzrange`, generated | `tstzrange(valid_from, valid_to, '[)')` | §6.4 names `valid_period tstzrange`; generated so the adapter binds plain timestamps (§9.7) [P] |
| `recorded_at` | `timestamptz` | Recorded (system) time: when the system recorded the change | One reading of the injected `Clock` per append, made by the appender (J-4; §6.2; SI-10). Microsecond precision |
| `entry_timing` | `text` | The `EntryTimingCode` of the kernel's accepted classification (`EntryTiming.code`): `CONTEMPORANEOUS`, `BACK_DATED`, `BACK_ENTRY`, `OFFLINE_CAPTURE`, `LATE_ARRIVAL`, `MIGRATED` or `EFFECTIVE_DATED` | Computed by the appender, never by the caller (§4.4; D10). Whether screens, prints and exports label the row follows from the code (`EntryTimingCode.labelled`; display text keyed `entry-timing.<code>`; SI-10 "labelled"; CTRL-0010-5; §13.4 "Entry metadata"); no separate label is stored |
| `clinical_time_source` | `text` | The kernel `ClinicalTimeSource` of the classification (`EntryTiming.source`): `ENTERED`, `DEVICE`, `INTERFACE`, `AT_RECORDING`, `MIGRATED` or `EFFECTIVE_DATE` | Keeps visible where the stored valid time came from, including a valid time stamped from the recorded time (`AT_RECORDING`; kernel §6.1, §6.2) |
| `back_entry_episode_id` | `uuid`, nullable | The downtime episode a back-entry belongs to, as verified server-side | Reconciliation of back-entries (CTRL-0010-6; `TRU-BCP-03`). Required exactly for `BACK_ENTRY` |
| `entry_policy_ref` | `text`, nullable | Where the tolerances that classified the row came from: the keys, provenance and sources of the `ResolvedParameter`s of `EntryTimingResult.Accepted.policy` | Audit of the classification (D11). Null when the classification needed no policy (§4.4) |
| `actor_id` | `uuid` | The principal that made the change | "actor" (§5.3 C); "who" (R07 §5.4 AU-1) |
| `actor_kind` | `text` | `USER`, `DEVICE`, `INTERFACE`, `MIGRATION_LOADER` or `SYSTEM` (the kernel `ActorRef` kind, D1) | The entry mode is derived from it (§4.4) |
| `on_behalf_of_id` | `uuid`, nullable | The user on whose behalf (verbal orders, scribes) | §5.3 C; §6.2 |
| `device_id` | `uuid`, nullable | The registered device | §5.3 C; §6.2; "where" (AU-1) |
| `source` | `text` | Provenance of the content: `user`, `device`, `ai-draft`, `migrated`, `interface` or `system` | Provenance everywhere (§8.1 P8); the §5.3 B source list, plus `system` for changes the platform makes itself [P]. Consistent with `actor_kind` and `entry_timing` (J-10) |
| `purpose_of_use` | `text` | The purpose-of-use code (`PurposeOfUse`, D1) | §5.3 C; §6.2; "why" (AU-1). Never defaulted: a `CommandContext` cannot be built without it (kernel, D1) |
| `reason` | `text`, nullable | The `ChangeReason` text | §5.3 C. Required, never defaulted, for amendments, entered-in-error, back-dating and back-entry (J-5, J-8, J-11) |
| `policy_decision_id` | `uuid`, nullable | The decision id returned by `BackDatingAuthorization` | "Back-dating is privileged and audited" (SI-10). Required exactly for `BACK_DATED`; never supplied by the caller (J-8) |
| `idempotency_scope` | `uuid` | The actor id of the command | Keys are unique per actor, not per tenant, so one actor's key can never return another actor's outcome (§4.6) [P] |
| `idempotency_key` | `text` | The command's `IdempotencyKey` | §6.2; §6.3 `Idempotency-Key`; commands idempotent (§22.1 item 2) |
| `request_fingerprint` | `bytea` (32 bytes) | SHA-256 of the command request as the module canonicalised it | A reused key with a different request is refused, never answered with the first outcome (§4.6) [P] |
| `command_seq` | `smallint` | Position of the row within its command's append (0, 1, …) | One command may change several aggregates in one transaction (the order-sign of §5.2) |
| `correlation_id` | `uuid` | The command's `CorrelationId` | §6.2 |
| `causation_id` | `uuid`, nullable | The event or command that caused this change | Lets consumers and investigators follow chains [P] |
| `payload` | `jsonb` | The full change data, as the owning module's schema defines it. Fields that ADR-008 designates for encryption are stored as ciphertext under the tenant key | The source for rebuilds and audit (§5.3 C "payload"; §2.2 rule 1). Never published (ADR-J1) |
| `event_data` | `jsonb` | The published event data: minimised, under the catalogued schema (`envelope.md` §6), plus the `meta` block the appender adds (§6 step 6) | What consumers receive (ADR-J1) |
| `tx_id` | `xid8`, default `pg_current_xact_id()` | The database transaction that wrote the row | The safe watermark of the journal tail (§8.3). Never used as event order or as a time [P] |
| `db_inserted_at` | `timestamptz`, default `clock_timestamp()` | The database's own time at insert | The third time of R11 P2 ("the DB transaction time"). Forensic only: never used by domain logic, as-was queries or ordering [P] |

`recorded_at` and `valid_from` are separate columns everywhere and neither is derived from the other (SI-10; §6.2 "Clinical time and recorded time are separate fields everywhere"). The single exception is a row whose valid time is defined as its recorded time (`ValidTimeInput.AtRecording`, §4.4), which the kernel classifier accepts only where kernel §6.2 allows it; such a row stores `clinical_time_source = 'AT_RECORDING'`, so the defaulting stays visible.

### 4.2 Invariants

The domain validates J-2 to J-17 (with J-11b) before the adapter writes; the database enforces the ones marked DB again (§9). A DB check is a backstop for a broken adapter. It cannot prove that a decision or an episode is real; `BackDatingAuthorization` and the kernel's `BackEntryAuthority` do that (J-8, J-9).

| # | Invariant | Source | DB |
|---|---|---|---|
| J-1 | A row, once committed, is never updated or deleted, by any channel, role or tool | §5.3 C "never updated"; §2.2 rule 2; SI-06 | Trigger, grants, linter |
| J-2 | A row is written only inside the caller's transaction, together with the state change it records. Any result other than `Appended` marks the transaction rollback-only, and the runner never commits a rollback-only transaction. Every aggregate write that a repository declares to the transaction has a matching appended row at commit | §5.3 C; ADR-004; H6 | — (runner commit check, §6) |
| J-3 | `version` = `previous_version` + 1, and (`tenant_id`, `aggregate_type`, `aggregate_id`, `version`) is unique; an append against a stale version is refused, never merged | §6.2 optimistic concurrency; SI-15 "no last-writer-wins" | Check and unique constraint |
| J-4 | `recorded_at` comes from one reading of the injected `Clock`, made by the appender inside `append`. The caller cannot supply it. All rows of one append share it, and the classification of J-6 uses that same reading | §6.2; SI-10; D10 | — |
| J-5 | `AMENDMENT` and `ENTERED_IN_ERROR` rows name a `supersedes_version` lower than their own, of the same aggregate, and carry a reason. The target must be a `CHANGE` or `AMENDMENT` version that no earlier row has retracted. An `ENTERED_IN_ERROR` row carries the target's valid period unchanged | SI-06; §13.4; R07 §8.4 | Foreign key, check (target kind and retraction checked in the domain) |
| J-6 | The appender classifies every row with the kernel's `EntryTimeClassifier`, the only classifier (§4.4), against the J-4 reading, with the event type's `ValidTimeKind` from the catalogue. A `Refused` classification refuses the append. A classification whose `EntryTimingCode` differs from the caller's stated expectation refuses the append (`TimingMismatch`) | SI-10; D10 | Value lists of `entry_timing` and `clinical_time_source` |
| J-7 | When `EntryTimeClassifier.needsPolicy` says so, the appender looks the policy up through the kernel's `EntryTimePolicySource`, keyed by the event type's `TimingClass`. No policy, no append: the classifier answers `Refused(TIMING_POLICY_NOT_CONFIGURED)` for `NotConfigured`, `Unavailable` and `NotLookedUp`, and the append is refused (`EntryTimeRefused`). Rows that need no policy pass `NotLookedUp` (§4.4) | SI-10; CTRL-0010-1; D11 | — |
| J-8 | A `BACK_DATED` row has a non-blank reason, a `USER` actor, and a decision id that `BackDatingAuthorization` returned for this append. The caller cannot supply a decision id. Until WP-0.4 the production binding refuses every request | SI-10 "Back-dating is privileged and audited"; CTRL-0010-4; D10 | Check: reason, decision id and actor kind present |
| J-9 | A `BACK_ENTRY` row requires `context.backEntry`, the kernel's `BackEntryAuthority`, which only the back-entry tooling can issue after its own permission check and a server-side episode lookup (kernel §7.2, §7.3). The row stores `backEntry.episode.episodeId` and a non-blank reason. No production code can issue an authority until `TRU-BCP-03` exists | SI-10; §7 item 3; §16.3 L4; D10 | Check: episode id exactly for `BACK_ENTRY` |
| J-10 | `MIGRATED` timing, `MIGRATION_LOADER` actor and `migrated` source occur together or not at all. A `SYSTEM` actor writes only `system` source rows classified `CONTEMPORANEOUS` or `EFFECTIVE_DATED` | §8.3; SI-10 [P] | Check |
| J-11 | A reason, when required, is never defaulted: the journal has no default reason, and `ChangeReason` refuses blank text (D1) | SI-02's "never defaulted" pattern applied to SI-06 and SI-10 reasons [P] | Check (`btrim(reason) <> ''`) |
| J-11b | A `ChangeReason.SystemGenerated` reason requires actor kind `SYSTEM` (`SystemReasonNeedsSystemActor`). A reason that the classification requires (`USER_ENTERED_REASON`) must be a `ChangeReason.Entered` | Kernel §7.4; D1 [P] | — |
| J-12 | Per aggregate, `recorded_at` never decreases with version. An append whose clock reading is earlier than the aggregate's last `recorded_at` returns `RecordedTimeRegression`, writes nothing and is safe to retry (§6 step 7) | Keeps as-was views coherent per aggregate (§7) [P] | — |
| J-13 | The aggregate type is registered and owned by `producer_module` (or registered as writable by any module); the event type at its major is in the catalogue; `producer_module` is one of the event type's producers; the event type's keying is compatible with the aggregate type's (`envelope.md` §12). Aliases are never written | §8.5; A.20; §5.2 | — |
| J-14 | The partition scope follows the aggregate type's keying (D6): `PATIENT` types always have a patient and are keyed by it; `PATIENT_IF_ANY` types are keyed by the patient when version 1 has one, else by the aggregate id; `AGGREGATE` types never have a patient; `TENANT` types never have a patient and are keyed by the tenant id. `patient_id` and the scope are fixed at version 1 | ADR-009; D6; SI-08 merges are links | Check (key matches scope) |
| J-15 | `key_seq` numbers the rows of each partition key 1, 2, 3, … without gaps, in commit order | §8.3 [P] | Unique (`tenant_id`, `partition_key`, `key_seq`); counter-row lock |
| J-16 | (`tenant_id`, `idempotency_scope`, `idempotency_key`, `command_seq`) is unique. A key already used by the same actor with a different request fingerprint is refused (`IdempotencyKeyReused`) | §6.2; §22.1 item 2 [P] | Unique constraint |
| J-17 | Valid time comes from the caller as `ValidTimeInput.Given` (a kernel `ValidTime` with its offsets), or as `ValidTimeInput.AtRecording`, which the classifier accepts only for event types the catalogue declares `CLINICAL_AT_RECORDING` or `EFFECTIVE`, and never for an offline-captured, back-entered, device, interface or migrated entry (kernel §6.2). An offline-captured act carries its capture time, never the sync time | SI-10; D10 [P] | — |

Moving documentation to another patient is an entered-in-error on the old aggregate plus a new aggregate for the right patient, never a change of `patient_id` (J-14). A changed key would split one aggregate's events across partitions and lose their order (ADR-009); the wrong-patient move is a controlled, audited workflow (§13.4) [P].

**Nothing in the API deletes.** There is no delete, update, purge or "hard correction" operation on any port. Erasure duties are met by crypto-shredding under per-tenant keys (ADR-004 consequences; ADR-008), never by deleting rows. This works only because designated fields are ciphertext in `payload` and absent from `event_data` (ADR-J1). Retention: never auto-delete, 25-year floor until Kurdistan rules are confirmed (§13.4).

### 4.3 Change kinds: amendment and entered-in-error as new rows (SI-06, P3)

- **`CHANGE`**: an ordinary state change, including creation (version 1).
- **`AMENDMENT`**: a new version that replaces the content of an earlier version, with a reason; the earlier row stays, readable in history and in every as-was view recorded before the amendment (SI-06 clause b; §13.4 "the original stays viewable"). Its valid period is the period of the content it states, normally the amended version's.
- **`ENTERED_IN_ERROR`**: a new version that retracts an earlier one, with a reason (SI-06 clause d; §8.1 P3 "entered-in-error replaces delete"). It carries the retracted version's valid period (J-5), so a valid-time filter keeps the pair together. The retracted row stays in the journal.
- **Chained corrections [P].** An amendment may target a `CHANGE` or an earlier `AMENDMENT`. A retracted version cannot be amended or retracted again. A retraction cannot itself be retracted; restoring retracted content is a new `CHANGE` or `AMENDMENT` of a live version, with a reason. Several amendments of one version are allowed, each a new version.
- **Addenda** are links, not a change kind: an addendum is its own aggregate (a note) whose payload links to the signed note (SI-06 clause c; §8.4 "addendum as a linked note"). The `record` module owns that rule.

What a version means for an aggregate (for example that a signed note accepts no `CHANGE` after `final`) is the owning module's domain rule (SI-06 clause a is enforced by `record`, CTRL-0006-3). The journal guarantees only that whatever was written stays as written.

### 4.4 Time axes, entry timing, back-entry and back-dating (SI-10)

**Two axes, always.** Valid time (`valid_from`, `valid_to`, with their original offsets) is supplied by the user, the device or the interface as a kernel `ValidTime` of `ClinicalTime` values (`ValidTimeInput.Given`), or stamped by the appender for `AtRecording` (below). A module takes it from the command's clinical time in `CommandContext` or from the command itself. Recorded time is read once per append from the injected `Clock` (J-4). The domain never calls `now()`.

**Precision.** PostgreSQL stores microseconds. The appender truncates the clock reading to microseconds (`RecordedTime.now` already does, kernel §3), and kernel time values reach the journal already at microsecond precision. This keeps the in-memory and PostgreSQL adapters identical, which the rebuild tests need.

**The journal classifies; the caller only states an expectation (D10) [P].** The appender, not the caller, computes every row's `EntryTiming`:

1. It reads the clock once (J-4).
2. It takes the entry mode only from `context.entryMode`, which the kernel derives from the authenticated context (kernel §7.3), never from request input (D10). `BACK_ENTRY` arises only when the context carries a `BackEntryAuthority` (J-9); the journal has no back-entry flag of its own.
3. It reads the event type's `ValidTimeKind` and, where declared, its `TimingClass` from the catalogue entry (`envelope.md` §12). When `EntryTimeClassifier.needsPolicy(input, kind, mode)` is true, it asks the kernel's `EntryTimePolicySource.policyFor(context, timingClass, AsOf.latest(recorded))` (J-7); otherwise it passes `NotLookedUp`. It then calls `EntryTimeClassifier.classify(input, kind, recorded, mode, policy, episode)`, with `episode = context.backEntry?.episode`.
4. `Refused(reason)` refuses the append (`EntryTimeRefused`), including `CLINICAL_TIME_IN_FUTURE` and `TIMING_POLICY_NOT_CONFIGURED`.
5. The result's `EntryTimingCode` must equal the entry's `expectedTiming`, or the append is refused (`TimingMismatch`). The client therefore cannot slip a late row in as contemporaneous, and a user who expected a contemporaneous entry is sent back to the back-dating flow rather than silently back-dated.
6. It enforces the result's requirements (kernel §6.2). `BACK_DATING_AUTHORIZATION` and `USER_ENTERED_REASON`: a `ChangeReason.Entered` reason and a verified decision (J-8, J-11b); the appender calls `BackDatingAuthorization.verify` and stores the returned decision id. `BACK_ENTRY_AUTHORITY`: the context's authority (J-9). `MIGRATION_PROVENANCE`: J-10. It stores the code, the `ClinicalTimeSource`, the accepted `ValidTime` and the sources of the policy's `ResolvedParameter`s.

**One classifier, no per-module rules (D10).** Every row goes through the kernel classifier; the journal has no rule of its own for any aggregate type. Configuration and structure (tenancy and config) are event types of kind `EFFECTIVE`. A start not earlier than the recorded time is `EffectiveDated` (code `EFFECTIVE_DATED`). A start earlier than the recorded time is a retroactive change: `BackDated` (code `BACK_DATED`, source `EFFECTIVE_DATE`), which needs a `ChangeReason.Entered` and a verified decision like any back-dating (J-8). Work management (`Task`, `TaskRequest`, `Pool`, `Queue`, `DeadLetterItem`) is `CLINICAL_AT_RECORDING` and uses `AtRecording`; a task's "performed at" is event data. A clinical act and its clinical time are journaled by the owning clinical module on its own aggregate. No tolerance applies to `EFFECTIVE` and `AtRecording` rows, so `entry_policy_ref` is null.

**`AtRecording`.** A row may define its valid time as its own recorded time (`ValidTimeInput.AtRecording`). The appender writes `valid_from` = the J-4 reading with offset 0 and an open end, and the classifier answers `Contemporaneous(AT_RECORDING)` or `EffectiveDated` without a policy. The classifier refuses it for `CLINICAL_CAPTURED` event types and for offline-captured, back-entered, device, interface and migrated entries (`CAPTURE_TIME_REQUIRED`; J-17). So an act captured offline keeps its capture time and never takes the sync time (D10).

**What each classification stores** (kernel §6.2 vocabulary, the only one, D10):

| Kernel classification | `entry_timing` | Labelled | Also required |
|---|---|---|---|
| `Contemporaneous(source)` | `CONTEMPORANEOUS` | no | — |
| `EffectiveDated` | `EFFECTIVE_DATED` | no | — |
| `BackDated(lag, source)` | `BACK_DATED` | yes | `ChangeReason.Entered`; `USER` actor; decision id from `BackDatingAuthorization` (J-8) |
| `BackEntry(lag, episodeId)` | `BACK_ENTRY` | yes | reason; the context's `BackEntryAuthority`, whose episode id is stored (J-9) |
| `OfflineCapture(lag)` | `OFFLINE_CAPTURE` | yes | the device of the offline session (`CHANNEL_IDENTITY`) |
| `LateArrival(lag, source)` | `LATE_ARRIVAL` | yes | — (the channel is the actor) |
| `Migrated(lag)` | `MIGRATED` | yes | `MIGRATION_LOADER` actor and `migrated` source (J-10) |
| `Refused(reason)` | not stored | — | the append is refused |

"Labelled" is `EntryTimingCode.labelled`; the display text is localisation content keyed `entry-timing.<code>` (kernel §6.2). The code travels into every event (`envelope.md` §5, extension `entrytiming`), so screens, prints and exports downstream can show the label (CTRL-0010-5). No separate label is stored or published.

**Fail-closed, and how [P] (D16).** Three mechanisms keep privileged timing out of the journal until the real decisions exist. Each has a named test that runs the production wiring's mechanism.

| What is refused in WP-0.3 | Mechanism | Test |
|---|---|---|
| Every back-dated append | `RefusingBackDatingAuthorization` (main code, the production binding) returns `Refused(NO_POLICY_DECISION_POINT)`; the appender maps it to `BackDatingNotAuthorised` | `UnitTest:back-dated-append-refused-by-production-authorization` |
| Every back-entry append | The kernel mechanism: no production code can issue a `BackEntryAuthority` (the `BACK_ENTRY_TOOLING` allow-list is empty in WP-0.3), and without one `context.entryMode` is never `BACK_ENTRY` (kernel §7.2, §7.3) | `ArchTest:back-entry-authority-only-from-back-entry-tooling`; `PropertyTest:kernel-entry-mode-derived-from-context` (kernel specification) |
| Every user-timed append to a clinical event type | The resolver behind the kernel's `EntryTimePolicySource` answers `NotConfigured` while no tolerance definition or value exists (DN-KN1), and the classifier answers `Refused(TIMING_POLICY_NOT_CONFIGURED)`. The resolver is `platform-tenancy`'s `EntryTimePolicyResolver` (tenancy §5.12). A policy with `Synthetic` provenance is refused in TRAIN and PROD by the D11 production gate | `UnitTest:clinical-append-refused-without-entry-time-policy`; `UnitTest:entry-time-policy-resolver-answers-not-configured` (tenancy); the D11 gate's own test (kernel and tenancy specifications) |

Test doubles of `BackDatingAuthorization` and `EntryTimePolicySource` live in `hms.kernel.journal.testing` and are never bound in production (D8).

- Whether a downtime back-entry also needs a back-dating decision, beyond the back-entry permission and a verified episode, is a reading of SI-10 for the CSO (OQ-J1).

### 4.5 Versions and optimistic concurrency

Each new row states the version it was made against (`expectedPrevious`; null for creation). The append writes `version = expectedPrevious + 1`. One append may write several consecutive versions of one aggregate (for example two consecutive changes of one order in one command); each later row's `expectedPrevious` is the earlier row's version. A `TaskRequested` in the same append is a different aggregate (§4.8). If another transaction has already written a version, the append returns `VersionConflict` with the current version and the transaction becomes rollback-only (§6). Two clients never both succeed against the same version, so a stale write can never silently overwrite a newer one (SI-15 clause g, CTRL-0015-10: "no last-writer-wins … on clinical state").

### 4.6 Idempotency

Every append carries the command's `IdempotencyKey` (from `CommandContext`) and a `CommandFingerprint`: a SHA-256 of the command request as the module canonicalised it [P]. The rows of one command share both and are numbered by `command_seq`. Keys are scoped by actor (`idempotency_scope` = the actor id), so one actor's key never returns another actor's outcome [P].

- **Order of checks.** The appender checks idempotency first, then versions. A retried command whose first copy committed gets its original outcome even though the version has moved on.
- **Same key, same fingerprint, same actor:** `AlreadyApplied` with the first command's rows. Nothing is written; the transaction becomes rollback-only, so the caller's repeated state change is undone too.
- **Same key and actor, different fingerprint:** `IdempotencyKeyReused`. Nothing is written. A device reset or client bug that reuses a key for a second dose is refused, never told "saved" (H2, H6).
- **Before executing**, a command handler may ask `ModuleJournalReader.byIdempotencyKey` and return the original outcome without executing again (§22.1 item 2). The append's own check still guards the race.
- **Keys made by consumers** of events (`envelope.md` §9) and by `platform-tasks`' `TaskRequested` intake are derived, never the bare event id: `evt:<consumerId>:<eventId>:<effect>` [P]. Two consumers of one event, or one event that drives two commands, never collide.
- **Refused commands write no journal row** (§4.7). A module that must return the same refusal on a retry keeps its own idempotency store for refusals only, keyed by the same scope and key. For applied commands the journal is the source of truth, and a module checks the journal first (`platform-tasks`' `IdempotencyStore` follows this rule) [P].
- Client keys are opaque text of at most 200 characters (the kernel `IdempotencyKey`, D1). The HTTP boundary requires a UUID from clients [P].

### 4.7 What is not a journal row

The journal records changes that happened. A refused command changes nothing, and its transaction rolls back, so it leaves no journal row. Audit of refusals (R07 AU-1 "outcome") comes from the Trust Plane Audit SDK in WP-0.4. `platform-config` and `platform-tenancy` route refusals to their own audit ports meanwhile (KA-J5). Reads are not journal rows either (§7 "Access").

### 4.8 Requests to `platform-tasks`: `TaskRequested`

A module outside the Safety Kernel requests a task by appending a `TaskRequested` row as version 1 of a new `TaskRequest` aggregate (id = the `TaskRequestId`), in the same command as the change that needs the work (D14; `platform-tasks` §5.3). It never collides with the caller's own aggregate in the same append. The row is a past-tense fact: "this module requested a task for this focus". Its `event_data` carries the `CreateTask` fields; its `id` is the request's identity, from which `platform-tasks` makes its idempotency key. `TaskCompletionRequested` and `TaskCancellationRequested` are written the same way, each as version 1 of its own `TaskRequest`. The producer writes only version 1; `platform-tasks` may append `TaskOrphaned` and `TaskOrphanCleared` as later versions. `platform-tasks` reads these rows through `JournalTails.forConsumer("platform-tasks", {TaskRequested, TaskCompletionRequested, TaskCancellationRequested})` in the same database, with a watermark, not through Kafka (§8.3; D14). The catalogue lists the three request types with owner `platform-tasks`, every module as producer, `platform-tasks` as in-database consumer, and keying "patient if any" (`catalogue.md` §4).

## 5. Public API

Kotlin-like notation. Kept small; other streams code against it (D17). Names in `hms.kernel.time`, `hms.kernel.ids`, `hms.kernel.context` and `hms.kernel.events` are those specifications' (§18 lists what this API assumes of them).

```kotlin
package hms.kernel.journal.domain

@JvmInline value class JournalEntryId(val value: UUID)                // UUIDv7, checked in init
@JvmInline value class AggregateVersion(val value: Int)              // >= 1, checked in init
data class AggregateRef(val type: AggregateType, val id: UUID)       // AggregateType: hms.kernel.events
class PayloadJson private constructor(val text: String)              // a JSON object; factory returns a sealed result
class EventDataJson private constructor(val text: String)            // a JSON object without a "meta" member
class CommandFingerprint private constructor(val sha256: ByteArray)  // of(canonicalRequestBytes)

/** One change to append. */
class NewEntry(
    val aggregate: AggregateRef,
    val expectedPrevious: AggregateVersion?,      // null = creation (version 1)
    val patientId: PatientId?,
    val eventType: EventType,                     // hms.kernel.events: canonical name + major
    val changeKind: ChangeKind,                   // hms.kernel.events
    val supersedes: AggregateVersion?,            // AMENDMENT and ENTERED_IN_ERROR only
    val validTime: ValidTimeInput,                // hms.kernel.time: Given(ValidTime) or AtRecording (J-17)
    val expectedTiming: EntryTimingCode,          // hms.kernel.time; checked against the journal's own classification
    val reason: ChangeReason?,                    // hms.kernel.context
    val provenance: Provenance,                   // hms.kernel.events: USER, DEVICE, AI_DRAFT, MIGRATED, INTERFACE, SYSTEM
    val securityLabels: Set<String>,              // copied to event_data.meta.security; empty when none (envelope §6)
    val payload: PayloadJson,
    val eventData: EventDataJson,
)

/** One command's append. */
class AppendRequest(
    val producerModule: ModuleId,                 // hms.kernel.events
    val entries: List<NewEntry>,                  // non-empty
    val fingerprint: CommandFingerprint,
)

/** A committed row, as read back. */
class JournalEntry(
    val id: JournalEntryId,
    val tenantId: TenantId, val facilityId: FacilityId?,
    val producerModule: ModuleId,
    val actor: ActorRef, val onBehalfOf: UserId?, val device: DeviceRef?,
    val purposeOfUse: PurposeOfUse,
    val idempotencyKey: IdempotencyKey, val correlationId: CorrelationId, val causationId: CausationId?,
    val aggregate: AggregateRef, val version: AggregateVersion,
    val patientId: PatientId?, val partitionKey: PartitionKey, val keySeq: Long,
    val eventType: EventType, val changeKind: ChangeKind, val supersedes: AggregateVersion?,
    val validTime: ValidTime,                     // hms.kernel.time: start and end with their original offsets
    val recordedAt: RecordedTime,                 // restored only by the adapters (kernel ArchTest:persistence-only-factories)
    val timing: EntryTimingCode, val clinicalTimeSource: ClinicalTimeSource,
    val backEntryEpisodeId: UUID?, val entryPolicyRef: String?,
    val reason: ChangeReason?, val policyDecisionId: UUID?,
    val provenance: Provenance, val commandSeq: Int,
    val payload: PayloadJson, val eventData: String,  // event data with the meta block
)

sealed interface AppendResult {
    data class Appended(val entries: List<JournalEntry>) : AppendResult
    data class AlreadyApplied(val entries: List<JournalEntry>) : AppendResult
    data class IdempotencyKeyReused(val key: IdempotencyKey) : AppendResult
    data class VersionConflict(val aggregate: AggregateRef, val expected: AggregateVersion?, val actual: AggregateVersion?) : AppendResult
    /** Safe to retry: nothing was written (J-12). */
    data class RecordedTimeRegression(val aggregate: AggregateRef, val lastRecordedAt: Instant, val clockReading: Instant) : AppendResult
    data class Rejected(val violations: List<JournalViolation>) : AppendResult
}

sealed interface JournalViolation {
    data object EmptyAppend : JournalViolation
    data class VersionChainBroken(val aggregate: AggregateRef) : JournalViolation
    data class UnknownAggregateType(val type: AggregateType) : JournalViolation
    data class AggregateTypeNotOwned(val type: AggregateType, val producer: ModuleId) : JournalViolation
    data class UnknownEventType(val eventType: EventType) : JournalViolation
    data class ProducerNotAllowed(val eventType: EventType, val producer: ModuleId) : JournalViolation
    data class KeyingIncompatible(val eventType: EventType, val type: AggregateType) : JournalViolation
    data class PatientRequired(val aggregate: AggregateRef) : JournalViolation
    data class PatientForbidden(val aggregate: AggregateRef) : JournalViolation
    data class PatientChanged(val aggregate: AggregateRef) : JournalViolation
    data class ReasonRequired(val changeKind: ChangeKind, val timing: EntryTimingCode?) : JournalViolation
    data class SupersedesRequired(val changeKind: ChangeKind) : JournalViolation
    data class SupersedesNotAllowed(val changeKind: ChangeKind) : JournalViolation
    data class SupersedesUnknownVersion(val aggregate: AggregateRef, val version: AggregateVersion) : JournalViolation
    data class CorrectionTargetRetracted(val aggregate: AggregateRef, val version: AggregateVersion) : JournalViolation
    data class CorrectionTargetIsRetraction(val aggregate: AggregateRef, val version: AggregateVersion) : JournalViolation
    data class RetractionValidTimeDiffers(val aggregate: AggregateRef) : JournalViolation
    data class EntryTimeRefused(val aggregate: AggregateRef, val reason: EntryTimeRefusal) : JournalViolation
    data class TimingMismatch(val aggregate: AggregateRef, val expected: EntryTimingCode, val actual: EntryTimingCode) : JournalViolation
    data class BackDatingNotAuthorised(val code: String) : JournalViolation
    data object BackDatingNeedsUserActor : JournalViolation
    data object SystemReasonNeedsSystemActor : JournalViolation           // J-11b
    data object ProvenanceInconsistent : JournalViolation                 // J-10
}

/** A pure fold over journal rows (read models and as-was views). S is the state of one key. */
interface Projection<S> {
    val name: String
    val version: Int                                   // bump when the fold changes; forces a rebuild
    fun key(entry: JournalEntry): String?              // null: this projection ignores the row
    fun initial(key: String): S
    fun apply(state: S, entry: JournalEntry): S
}

/** A projection whose state can answer "what was true at valid time V". */
interface ValidTimeView<S, A> {
    fun at(state: S, validAt: Instant): A
}

/** As-was selection (§7); pure functions over rows already read. */
object AsWas {
    fun knownAt(entries: List<JournalEntry>, asOf: AsOf): List<JournalEntry>     // recorded_at <= knownAt
    fun validAt(entries: List<JournalEntry>, validAt: Instant): List<JournalEntry> // valid_from <= V < valid_to
    fun overlapping(entries: List<JournalEntry>, window: ValidWindow): List<JournalEntry>
    /** Folds each aggregate's rows known at asOf.knownAt in version order, then asks the view at asOf.validAt. */
    fun <S, A> view(projection: Projection<S>, view: ValidTimeView<S, A>, entries: List<JournalEntry>, asOf: AsOf): Map<String, A>
}
```

```kotlin
package hms.kernel.journal

interface JournalAppender {
    /** Appends all rows of one command in the caller's transaction, or none (§6). */
    fun append(tx: TransactionContext, context: CommandContext, request: AppendRequest): AppendResult
    /** A repository declares an aggregate write; the commit check requires a matching appended row (J-2). */
    fun expectRow(tx: TransactionContext, aggregate: AggregateRef, version: AggregateVersion)
}

/** A module's own rows only (its producer_module and aggregate types). Used by command handlers. */
interface ModuleJournalReader {
    fun history(tx: TransactionContext, aggregate: AggregateRef, asOf: AsOf? = null): List<JournalEntry>
    fun byIdempotencyKey(tx: TransactionContext, actor: ActorRef, key: IdempotencyKey): List<JournalEntry>
}
interface JournalReaders { fun forModule(module: ModuleId): ModuleJournalReader }

/** Committed rows in a never-skipping order (§8.3). One per in-database consumer. */
interface JournalTail {
    fun read(tx: TransactionContext, after: TailPosition?, limit: Int): TailPage   // rows below the safe horizon
}
interface JournalTails {
    /** Event types must name the consumer as an in-database consumer in the catalogue (for example TaskRequested). */
    fun forConsumer(consumer: ConsumerId, eventTypes: Set<EventType>): JournalTail
    /** Every row: the rebuilder and the publication watermark check only. */
    fun forPlatform(purpose: PlatformTailPurpose): JournalTail
}

/** Privileged reads (§7 Access). From WP-0.4 wrapped by the Trust Plane SDK; no module calls them directly. */
interface AsWasReader {
    fun aggregateHistory(tx: TransactionContext, aggregate: AggregateRef, asOf: AsOf? = null): List<JournalEntry>
    fun patientTimeline(tx: TransactionContext, patient: PatientId, asOf: AsOf, window: ValidWindow, page: PageRequest): Page<JournalEntry>
}

/** Read-model storage with a shadow for rebuilds (§8.2). */
interface ReadModelStore<S> {
    fun status(tx: TransactionContext): ReadModelStatus          // Ready(version, position) | Rebuilding(progress) | Absent
    fun apply(tx: TransactionContext, batch: ProjectionBatch<S>) // live store
    fun openShadow(tx: TransactionContext, projectionVersion: Int): ShadowId
    fun applyShadow(tx: TransactionContext, shadow: ShadowId, batch: ProjectionBatch<S>)
    fun promote(tx: TransactionContext, shadow: ShadowId)       // atomic swap
    fun snapshot(tx: TransactionContext): Map<String, S>        // for the rebuild comparison
}

class ReadModelRebuilder(tails: JournalTails, runner: TransactionRunner, clock: Clock) {
    fun <S> rebuild(tenant: TenantId, projection: Projection<S>, store: ReadModelStore<S>, reason: ChangeReason): RebuildReport
}

// Privilege port (§4.4). Back-entry has no journal port: the kernel's BackEntryAuthority in the context decides it (J-9).
// Tolerances come through the kernel's hms.kernel.context.EntryTimePolicySource (J-7).
interface BackDatingAuthorization {
    fun verify(context: CommandContext, aggregate: AggregateRef, clinical: ClinicalTime, recorded: RecordedTime, reason: ChangeReason): BackDatingDecision
}
sealed interface BackDatingDecision { data class Authorised(val decisionId: UUID) : BackDatingDecision; data class Refused(val code: String) : BackDatingDecision }
```

Helper types: `ValidWindow` (half-open `[from, to)` of instants; a row matches when its valid period overlaps the window), `PageRequest` and `Page<T>` (cursor paging), `TailPosition` (`tx_id`, entry id of the last row read), `TailPage` (rows, next position, horizon), `ProjectionBatch<S>` (the states to write, the per-aggregate applied versions, the tail position), `RebuildReport` (rows read, duration on the injected clock, final position), `PlatformTailPurpose` (`REBUILD`, `PUBLICATION_WATERMARK`).

The adapter is constructed with a `java.time.Clock`, the `hms.kernel.ids` generator, the catalogue, `BackDatingAuthorization` and the kernel's `EntryTimePolicySource`; callers never pass a recorded time, an entry id, an entry mode, a classification or a decision id.

## 6. Appending in the caller's transaction

1. The module's application layer opens a transaction with `TransactionRunner.inTransaction` (`hms.kernel.context`), changes its aggregate tables, declares each aggregate write with `expectRow`, and calls `JournalAppender.append` with the same `TransactionContext` (J-2).
2. The adapter refuses a context that is not its own or not active. That is a programming error and throws (kernel specification §3, "programming errors throw" [P]).
3. **Idempotency first** (§4.6): rows with the same tenant, actor scope and key mean `AlreadyApplied` (same fingerprint) or `IdempotencyKeyReused` (different fingerprint).
4. **Validation.** The domain reads the clock once (J-4), classifies every row (§4.4), calls `BackDatingAuthorization` and the kernel's `EntryTimePolicySource` where needed, and validates J-3 to J-17 (with J-11b). It returns `Rejected` with every violation found, before any insert. J-5, J-12 and J-14 need the aggregate's earlier rows, which the adapter reads in the same transaction.
5. **Insert, all or nothing.** The jOOQ adapter sets a savepoint; takes the key-sequence counter rows of the request's partition keys, in sorted key order (§8.3); and inserts every row in one statement. A unique-key violation from a racing transaction rolls back to the savepoint (undoing the counter increments too), and the adapter re-reads to return `AlreadyApplied`, `IdempotencyKeyReused` or `VersionConflict`. `ON CONFLICT DO UPDATE` is never used on the journal table (§9.3).
6. **Event data.** The appender adds the `meta` block to each row's `event_data`: `meta.security` (the labels, an empty array when none) and `meta.provenance` (actor id, actor kind, on-behalf-of, device). The module's mapper never writes `meta` (`envelope.md` §6).
7. **Only `Appended` commits.** Any other result marks the transaction rollback-only. If the block still returns `TxOutcome.Commit`, the runner rolls back and throws a programming error. At commit the runner also checks that every `expectRow` declaration has its appended row; a missing row rolls back and throws [P]. `AlreadyApplied` returns the original outcome to the client. `VersionConflict` is reported as a business outcome (RFC 9457 problem at the HTTP boundary, §6.2), never retried silently with a different base version. `RecordedTimeRegression` is retried by the application layer's command runner: it waits until its clock passes the aggregate's last `recorded_at`, for at most the ADR-026 alarm bound of 1 s, and then reports a clock fault. A node more than 5 s out is blocked from clinical writes by `platform-site` (ADR-026) [P].
8. One append is one command: all its rows share `recorded_at` (the single J-4 reading), the idempotency key, the fingerprint and the correlation id, numbered by `command_seq`. A caller that needs that reading for its own rows in the same transaction (for example tenancy's fact rows) takes it from `AppendResult.Appended.entries[0].recordedAt` after `append` returns. The `TransactionContext` exposes no time.

A transaction may hold appends from two modules: the Safety Kernel modules create tasks in the caller's transaction (`platform-tasks` §5). Each append is its own command with its own key. Counter rows are taken in sorted order within one append; a deadlock across two appends that take keys in opposite orders is detected by PostgreSQL, aborts one transaction, and is reported as retryable. Nothing is committed by the aborted one.

## 7. As-was queries (§7 item 3)

Two questions, one per axis (R08 §3.7), both expressed with the kernel's `AsOf` (D4):

- **"What did the system know at time R?"** `AsWas.knownAt(entries, asOf)` keeps the rows with `recorded_at ≤ R`. "What did the clinician see at 09:12" (§7 item 3) is this view with R = 09:12 on the patient's timeline: back-entries and amendments recorded after 09:12 are excluded, and a row later retracted by entered-in-error is still included, because at 09:12 it had not been retracted.
- **"What was true in the world at time V, as known at R?"** `AsWas.view` takes the rows known at R, folds each aggregate's rows **in version order** (never in valid-time order, so a back-entry never reorders a state machine), and asks the projection's `ValidTimeView` what was true at V. The projection, not the row order, decides supersession: an amendment replaces the content it names; an entered-in-error marks its target as never true. A back-entry recorded at 10:30 for 08:00 appears in the view for V = 09:00 only when R ≥ 10:30.
- **Row filters.** `AsWas.validAt(entries, V)` keeps rows whose valid period contains V: `valid_from ≤ V` and (`valid_to` is null or `V < valid_to`), half-open (R08 §3.7). `AsWas.overlapping` keeps rows whose valid period overlaps a `ValidWindow`. These filter rows; they do not fold state.
- **Retractions.** The retracted row is never dropped from history; the projection decides how it shows (for example struck through with its reason, §13.4).
- **Limits, stated honestly.** (1) `recorded_at` is read when the append runs, before the transaction commits. A row recorded at 09:11.999 that commits at 09:12.050 is in the known-at-09:12 view, though no screen could have shown it then. The gap is bounded by the transaction's duration, which the runner caps with a transaction timeout (deployment configuration) [P]. (2) What a particular screen displayed also depends on read-model freshness (boards ≤2 s, §7 item 17) and on what the user opened; the latter is recorded by the Trust Plane's read audit (§7 item 2, WP-0.4), not by the journal.
- **Performance.** C3 asks for the 09:12 view on a 30-day chart at p95 ≤1.5 s (§18.6). The indexes of §9.5 serve it; the measurement is WP-0.6's spike (indicative on the dev cell, evidence only on the reference cell, §3.5).
- **Access.** The journal holds PHI from every module, so reads are scoped [P]. A command handler reads only its own module's rows (`ModuleJournalReader`). `platform-tasks` reads the request rows of every module (`TaskRequested`, `TaskCompletionRequested`, `TaskCancellationRequested`) through its `JournalTail`, because the catalogue names it as their in-database consumer. A patient timeline or another module's history is a privileged read through `AsWasReader`. From WP-0.4 every privileged call goes through the Trust Plane SDK with purpose-of-use and emits a BALP AuditEvent (§6.3; §7 item 2). In WP-0.3 no production code calls `AsWasReader` (`ArchTest:journal-privileged-readers-not-used-by-modules`; KA-J1).

## 8. Read models, the journal tail and rebuild

### 8.1 Rules for projections

- A read model is a `Projection` fold over journal rows (§5.3 D; R08 §3.6). It holds no information that is not in the journal's `payload` and columns, so it can be dropped and rebuilt at any time (§2.2 rule 1). ADR-008 ciphertext fields are decrypted by the projection with the tenant key, when the read model needs them.
- **A projection may depend on the order of rows within one aggregate (version order), never on how rows of different aggregates interleave** [P]. The `ProjectionRunner` applies each aggregate's rows in version order: a row whose predecessor has not been applied yet waits until it arrives, and a row already applied is skipped. The property test of §15 shuffles the interleaving and requires the same result.
- A projection never calls the clock or any port; time-dependent views (overdue, SLA) take the evaluation time as a query parameter.
- Read-model tables are not fact tables. Each is marked `hms:read-model` in its creating migration, and a rebuild may truncate its shadow (§9.3).

### 8.2 Rebuild procedure

- `ReadModelRebuilder.rebuild` opens a shadow store for the projection's version, consumes the platform tail (§8.3) from the beginning into the shadow, and promotes the shadow atomically once it has caught up with the tail's horizon. It reports rows read, duration and the final position, and it is resumable from the shadow's recorded position.
- **While a rebuild runs, reads never see a partial result.** The live store keeps serving the previous version until the swap. If there is no previous version (a first build, or a store lost), the store's status is `Rebuilding`, and every query over it returns "rebuilding, unavailable, manual check required", never an empty list. A worklist that is empty because it is rebuilding would look like "no work" (H5; SI-03) [P].
- A projection whose `version` changed is rebuilt into a shadow before the new version serves reads; the old version serves meanwhile [P].
- A rebuild is an operations action with a reason, audited (§13).
- **The journal-rebuild exit test** (§21 WP-0.3; §6.8 #10): random command sequences drive aggregates through the in-memory adapter, with transactions interleaved and committed late by the test scheduler, while a synthetic reference projection is maintained incrementally from the tail. Then the read model is dropped and rebuilt from the journal, and the rebuilt state must equal the incremental state exactly. The journal's test uses only synthetic projections; `platform-tasks` runs the same property over its worklist in its own module, on the journal's in-memory adapter. The same test runs against PostgreSQL in the merge tier once the cell exists (DN-040).

### 8.3 Order without gaps: the safe tail and the key sequence [P]

`recorded_at` is read before commit, so rows do not become visible in `recorded_at` order. A reader that pages by recorded time could pass a row that commits later and skip it for ever. Two mechanisms close this (ADR-J2).

**The safe tail.** Each row stores the writing transaction's id (`tx_id`, `xid8`). A tail read takes the current safe horizon H = `pg_snapshot_xmin(pg_current_snapshot())`: every transaction with an id below H has ended, so the set of committed rows with `tx_id < H` is final. A read returns rows with (`tx_id`, `id`) greater than the last position and `tx_id < H`, in (`tx_id`, `id`) order. A row is never skipped: when a position was taken, every row at or below it was already final. `tx_id` order is neither commit order nor version order, which is why the `ProjectionRunner` sequences each aggregate by version (§8.1). `tx_id` is never a time and never event order. The tail serves the rebuild (§8.2), `platform-tasks`' `TaskRequested` intake (§4.8; D14) and the publication watermark check (§10.3). A long-running transaction holds the horizon back; the runner's transaction timeout bounds that delay, and tail lag is alarmed (§10.3).

**The key sequence.** The append takes a counter row per partition key in `${journalSchema}.key_sequence` (`INSERT … ON CONFLICT DO UPDATE … RETURNING`; a counter table, not a fact table) and numbers its rows from it. The counter row stays locked until the transaction ends, so two transactions that touch one key commit in `key_seq` order, and a rolled-back transaction rolls its numbers back. Each key's rows are therefore numbered 1, 2, 3, … without gaps, in commit order (J-15). Contention is per key: one patient, one tenant's configuration, or one platform aggregate. Consumers use `keyseq` to detect a lost, duplicated or reordered event per key, and replay sorts by it (`envelope.md` §9, §11).

The in-memory adapter models both: transaction numbers are assigned at begin; the horizon is the oldest open transaction; and per-key counters stay locked until commit. A test scheduler interleaves begin, append, commit and rollback steps, so late commits and out-of-order transaction ids occur in the fast tier (`PropertyTest:journal-tail-never-skips-late-commit`; `PropertyTest:journal-key-sequence-gap-free-commit-ordered`).

## 9. Persistence

### 9.1 Schema and table (PostgreSQL 18, 17 minimum, §4.1)

One database per tenant, one schema per module (§6.4): the journal's schema is `journal`. The `rcm` satellite runs the same migration in its own database (§5.2), so the schema name is a Flyway placeholder with default `journal` [P].

```sql
-- V0001__create_journal_entry.sql
-- hms:fact-table ${journalSchema}.entry
-- hms:aggregate-table ${journalSchema}.key_sequence
CREATE SCHEMA IF NOT EXISTS ${journalSchema};

CREATE TABLE ${journalSchema}.entry (
    id                    uuid        NOT NULL,
    tenant_id             uuid        NOT NULL,
    facility_id           uuid,
    producer_module       text        NOT NULL,
    aggregate_type        text        NOT NULL,
    aggregate_id          uuid        NOT NULL,
    version               integer     NOT NULL,
    previous_version      integer,
    patient_id            uuid,
    partition_scope       text        NOT NULL,
    partition_key         text        NOT NULL,
    key_seq               bigint      NOT NULL,
    event_stream          text        GENERATED ALWAYS AS (CASE WHEN partition_scope = 'patient' THEN 'patient' ELSE 'platform' END) STORED,
    event_type            text        NOT NULL,
    event_major           integer     NOT NULL,
    change_kind           text        NOT NULL,
    supersedes_version    integer,
    valid_from            timestamptz NOT NULL,
    valid_from_offset_s   integer     NOT NULL,
    valid_to              timestamptz,
    valid_to_offset_s     integer,
    valid_period          tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from, valid_to, '[)')) STORED,
    recorded_at           timestamptz NOT NULL,
    entry_timing          text        NOT NULL,
    clinical_time_source  text        NOT NULL,
    back_entry_episode_id uuid,
    entry_policy_ref      text,
    actor_id              uuid        NOT NULL,
    actor_kind            text        NOT NULL,
    on_behalf_of_id       uuid,
    device_id             uuid,
    source                text        NOT NULL,
    purpose_of_use        text        NOT NULL,
    reason                text,
    policy_decision_id    uuid,
    idempotency_scope     uuid        NOT NULL,
    idempotency_key       text        NOT NULL,
    request_fingerprint   bytea       NOT NULL,
    command_seq           smallint    NOT NULL,
    correlation_id        uuid        NOT NULL,
    causation_id          uuid,
    payload               jsonb       NOT NULL,
    event_data            jsonb       NOT NULL,
    tx_id                 xid8        NOT NULL DEFAULT pg_current_xact_id(),
    db_inserted_at        timestamptz NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT entry_pk PRIMARY KEY (id),
    CONSTRAINT entry_id_is_v7 CHECK (uuid_extract_version(id) = 7),
    CONSTRAINT entry_aggregate_version_uq UNIQUE (tenant_id, aggregate_type, aggregate_id, version),
    CONSTRAINT entry_command_uq UNIQUE (tenant_id, idempotency_scope, idempotency_key, command_seq),
    CONSTRAINT entry_key_seq_uq UNIQUE (tenant_id, partition_key, key_seq),
    CONSTRAINT entry_version_chain CHECK (version >= 1 AND (
        (version = 1 AND previous_version IS NULL) OR previous_version = version - 1)),
    CONSTRAINT entry_key_seq_positive CHECK (key_seq >= 1),
    CONSTRAINT entry_partition CHECK (
        (partition_scope = 'patient'   AND patient_id IS NOT NULL AND partition_key = patient_id::text) OR
        (partition_scope = 'tenant'    AND patient_id IS NULL     AND partition_key = tenant_id::text) OR
        (partition_scope = 'aggregate' AND patient_id IS NULL     AND partition_key = aggregate_id::text)),
    CONSTRAINT entry_change_kind CHECK (change_kind IN ('CHANGE', 'AMENDMENT', 'ENTERED_IN_ERROR')),
    CONSTRAINT entry_supersedes CHECK (
        (change_kind = 'CHANGE' AND supersedes_version IS NULL) OR
        (change_kind <> 'CHANGE' AND supersedes_version IS NOT NULL AND supersedes_version < version
         AND reason IS NOT NULL)),
    CONSTRAINT entry_supersedes_same_aggregate FOREIGN KEY (tenant_id, aggregate_type, aggregate_id, supersedes_version)
        REFERENCES ${journalSchema}.entry (tenant_id, aggregate_type, aggregate_id, version),
    CONSTRAINT entry_timing CHECK (entry_timing IN ('CONTEMPORANEOUS', 'BACK_DATED', 'BACK_ENTRY', 'OFFLINE_CAPTURE',
        'LATE_ARRIVAL', 'MIGRATED', 'EFFECTIVE_DATED')),
    CONSTRAINT entry_clinical_time_source CHECK (clinical_time_source IN ('ENTERED', 'DEVICE', 'INTERFACE', 'AT_RECORDING',
        'MIGRATED', 'EFFECTIVE_DATE')),
    CONSTRAINT entry_back_dating_privileged CHECK (
        (entry_timing = 'BACK_DATED') = (policy_decision_id IS NOT NULL) AND
        (entry_timing <> 'BACK_DATED' OR (reason IS NOT NULL AND actor_kind = 'USER'))),
    CONSTRAINT entry_back_entry_episode CHECK (
        (entry_timing = 'BACK_ENTRY') = (back_entry_episode_id IS NOT NULL) AND
        (entry_timing <> 'BACK_ENTRY' OR reason IS NOT NULL)),
    CONSTRAINT entry_migrated_together CHECK (
        (entry_timing = 'MIGRATED') = (actor_kind = 'MIGRATION_LOADER') AND
        (actor_kind = 'MIGRATION_LOADER') = (source = 'migrated')),
    CONSTRAINT entry_system_actor CHECK (
        (actor_kind = 'SYSTEM') = (source = 'system') AND
        (actor_kind <> 'SYSTEM' OR entry_timing IN ('CONTEMPORANEOUS', 'EFFECTIVE_DATED'))),
    CONSTRAINT entry_actor_kind CHECK (actor_kind IN ('USER', 'DEVICE', 'INTERFACE', 'MIGRATION_LOADER', 'SYSTEM')),
    CONSTRAINT entry_reason_not_blank CHECK (reason IS NULL OR btrim(reason) <> ''),
    CONSTRAINT entry_source CHECK (source IN ('user', 'device', 'ai-draft', 'migrated', 'interface', 'system')),
    CONSTRAINT entry_valid_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT entry_offsets CHECK (
        valid_from_offset_s BETWEEN -64800 AND 64800 AND
        (valid_to IS NULL) = (valid_to_offset_s IS NULL) AND
        (valid_to_offset_s IS NULL OR valid_to_offset_s BETWEEN -64800 AND 64800)),
    CONSTRAINT entry_event_major CHECK (event_major >= 1),
    CONSTRAINT entry_fingerprint_length CHECK (octet_length(request_fingerprint) = 32),
    CONSTRAINT entry_payload_object CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT entry_event_data_object CHECK (jsonb_typeof(event_data) = 'object' AND event_data ? 'meta')
);

CREATE TABLE ${journalSchema}.key_sequence (
    tenant_id     uuid   NOT NULL,
    partition_key text   NOT NULL,
    last_seq      bigint NOT NULL CHECK (last_seq >= 1),
    CONSTRAINT key_sequence_pk PRIMARY KEY (tenant_id, partition_key)
);
```

The same migration continues (sketch; the exact text is reviewed with the code):

```sql
CREATE FUNCTION ${journalSchema}.refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'journal rows are never updated, deleted or truncated (SI-06, SI-10; BUILD-PROMPT §2.2 rule 2, §5.3 C)'
        USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER entry_no_update_delete BEFORE UPDATE OR DELETE ON ${journalSchema}.entry
    FOR EACH ROW EXECUTE FUNCTION ${journalSchema}.refuse_change();
CREATE TRIGGER entry_no_truncate BEFORE TRUNCATE ON ${journalSchema}.entry
    FOR EACH STATEMENT EXECUTE FUNCTION ${journalSchema}.refuse_change();

REVOKE ALL ON ${journalSchema}.entry, ${journalSchema}.key_sequence FROM PUBLIC;
GRANT USAGE ON SCHEMA ${journalSchema} TO ${appRole};
GRANT INSERT, SELECT ON ${journalSchema}.entry TO ${appRole};
GRANT INSERT, SELECT, UPDATE ON ${journalSchema}.key_sequence TO ${appRole};

ALTER TABLE ${journalSchema}.entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${journalSchema}.entry FORCE ROW LEVEL SECURITY;
CREATE POLICY entry_tenant ON ${journalSchema}.entry
    USING (tenant_id = current_setting('hms.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('hms.tenant_id')::uuid);
-- the same policy on key_sequence; indexes of §9.5 follow
```

The offset bounds are the ±18:00 range that `java.time.ZoneOffset` allows. The value lists of `change_kind`, `entry_timing` (`EntryTimingCode`), `clinical_time_source` (`ClinicalTimeSource`), `actor_kind` and `source` are kept equal to the Kotlin types by a test (`IntegrationTest:journal-schema-matches-adapter`).

### 9.2 Why these keys

- (`tenant_id`, `aggregate_type`, `aggregate_id`, `version`) unique: optimistic concurrency (J-3), the per-aggregate history order, and the target of the supersedes foreign key, which makes an amendment or retraction of another aggregate's row impossible in the database (J-5).
- (`tenant_id`, `idempotency_scope`, `idempotency_key`, `command_seq`) unique: command idempotency per actor (§4.6).
- (`tenant_id`, `partition_key`, `key_seq`) unique: the gap-free key sequence (J-15).
- No foreign keys to other modules' tables: modules never read each other's tables (§5.2), and the journal must accept rows from every module.

### 9.3 Never updated or deleted: trigger, grants, linter, code rule (§6.8 #2)

Four independent layers, so that one mistake does not open the table:

1. **Trigger.** A `BEFORE UPDATE OR DELETE … FOR EACH ROW` trigger and a `BEFORE TRUNCATE … FOR EACH STATEMENT` trigger call `${journalSchema}.refuse_change()`, which raises an exception naming SI-06 and §2.2 rule 2. A trigger does not depend on grants, so it also stops the table owner while it is enabled.
2. **Grants and roles.** The table is owned by the migration role (`${ownerRole}`), never by the runtime role. Migrations run only in a separate migration job or init container under that role; `app-hms` never holds its credentials (§9.8) [P]. `REVOKE ALL … FROM PUBLIC`; the runtime role (`${appRole}`) gets `INSERT, SELECT` on `entry` and `INSERT, SELECT, UPDATE` on the counter table only; the CDC role (`${cdcRole}`, created by the cell) gets `SELECT` and replication rights only. No role has `BYPASSRLS` (§6.4).
3. **Migration linter** (`StaticAnalysis:no-update-or-delete-on-fact-tables`, CTRL-0006-3). A reusable class, `FactTableMigrationLinter`, in `:platform:arch-rules` (D7). Every project with migrations runs it over its own `db/migration` tree in its fast tier, wired by the test conventions; the journal, `platform-tenancy` and `platform-config` are the first users. It fails closed:
   - **Every table is classified.** Each `CREATE TABLE` in any migration carries one marker in the same file: `-- hms:fact-table`, `-- hms:aggregate-table` or `-- hms:read-model`. An unclassified table fails the build. A statement the linter cannot parse fails the build.
   - **Statements refused against a fact table:** `UPDATE`; `DELETE`; `TRUNCATE`; `MERGE`; `INSERT … ON CONFLICT … DO UPDATE`; `DROP TABLE`; `ALTER TABLE … RENAME` (table or column), `DROP COLUMN`, `ALTER COLUMN … TYPE`, `OWNER TO`, `SET UNLOGGED`, `DISABLE TRIGGER`, `ENABLE REPLICA TRIGGER`, `ENABLE ALWAYS TRIGGER`, `ATTACH PARTITION`, `DETACH PARTITION`, `NO FORCE ROW LEVEL SECURITY`, `DISABLE ROW LEVEL SECURITY`; `DROP TRIGGER`, `ALTER TRIGGER` and any further `CREATE TRIGGER` on it (a `BEFORE INSERT` trigger can drop rows silently); `CREATE RULE` on it; `DROP POLICY` and `ALTER POLICY` on it; `GRANT` of `UPDATE`, `DELETE`, `TRUNCATE` or `TRIGGER` on it.
   - **Statements refused against a fact table's trigger function** after the migration that creates it: `CREATE OR REPLACE FUNCTION`, `ALTER FUNCTION`, `DROP FUNCTION` (with or without `CASCADE`).
   - **Statements refused in every migration:** `DROP SCHEMA`; `DROP OWNED`; `REASSIGN OWNED`; `TRUNCATE … CASCADE`; `SET session_replication_role`; `CREATE ROLE` or `ALTER ROLE` with `SUPERUSER` or `BYPASSRLS`; `DO` blocks; `EXECUTE` inside any function body; data-modifying CTEs (`WITH … UPDATE|DELETE|INSERT`) that name a fact table; any function body that runs `UPDATE`, `DELETE` or `TRUNCATE` on a fact table [P].
   - **Creation rule.** A migration that marks a fact table must create the refuse-change triggers for it in the same file.
   - Each statement kind has a planted fixture in the linter's tests, plus an unclassified-table fixture and an unparseable-statement fixture.
4. **Code rule.** `ArchTest:journal-adapter-insert-and-select-only`: only `hms.kernel.journal.infrastructure` references `JournalTable`, and no class there calls jOOQ's `update`, `delete`, `deleteFrom`, `truncate`, `mergeInto` or `onDuplicateKeyUpdate`/`doUpdate` on it. The single upsert is on the counter table.

**Residual risk (stated, not hidden).** Two identities can still defeat the trigger at run time, outside migrations: a PostgreSQL superuser, and the owner role, which can `ALTER TABLE … DISABLE TRIGGER`. The runtime and CDC roles are neither. The owner role's credentials are used only by the migration job, whose SQL the linter checks; a superuser on the cell is an operations-plane, break-glass identity (ADR-027). Detecting a privileged rewrite after the fact needs a hash chain over the rows, which the plan does not ask of the journal (AU-3 asks it of the audit store, R07 §5.4). OQ-J2 puts the question.

### 9.4 Row-level security

The migration enables and forces row-level security with a tenant policy: `USING (tenant_id = current_setting('hms.tenant_id')::uuid)` and the same `WITH CHECK` [P]. `current_setting` without `missing_ok` raises an error when the setting is absent, so a connection that did not declare its tenant reads and writes nothing (fails closed; `IntegrationTest:journal-rls-tenant-isolation`). The jOOQ transaction runner sets `hms.tenant_id` with `set_config(…, true)` (transaction-local) at the start of every transaction. §6.4 requires this for the pooled tier; applying it in every topology keeps one signed artefact for all (§2.2 rule 5). Whether the database-per-tenant cells keep it is OQ-J3.

### 9.5 Indexes

| Index | Serves |
|---|---|
| Primary key on `id` | Consumers and investigators locating one event |
| Unique (`tenant_id`, `aggregate_type`, `aggregate_id`, `version`) | Concurrency; aggregate history; supersedes foreign key |
| Unique (`tenant_id`, `idempotency_scope`, `idempotency_key`, `command_seq`) | Idempotency |
| Unique (`tenant_id`, `partition_key`, `key_seq`) | Key sequence; replay in commit order per key |
| (`tenant_id`, `tx_id`, `id`) | The tail: rebuild, `TaskRequested` intake, publication watermark (§8.3) |
| (`tenant_id`, `patient_id`, `recorded_at`) `WHERE patient_id IS NOT NULL` | "Known at R" patient timeline (§7; C3) |
| (`tenant_id`, `patient_id`, `valid_from`) `WHERE patient_id IS NOT NULL` | "Valid at V" patient timeline |
| (`tenant_id`, `event_type`, `tx_id`) | A consumer's tail filtered by event type (`TaskRequested`) |

A GiST index on `valid_period` (with `btree_gist` for the patient column) is the alternative for overlap queries; it is not added until WP-0.6's C3 measurement shows the B-tree pair is not enough [P].

### 9.6 Partitioning

Not partitioned in WP-0.3 [P]. Reasons:

- Every unique constraint of a partitioned table must include the partition key. Range partitioning by `recorded_at` would make (`tenant_id`, `aggregate_type`, `aggregate_id`, `version`) unenforceable across partitions and break optimistic concurrency (J-3), idempotency (§4.6) and the key sequence (J-15).
- Partitions are a delete path: `DETACH PARTITION` followed by `DROP TABLE` removes rows without firing a `DELETE` trigger. The linter forbids it (§9.3), but an unpartitioned table has no such path at all.
- Rows are never deleted (25-year floor, never auto-delete, §13.4), so partition dropping, the usual reason to partition, does not apply.

If WP-0.6's 1,000-bed day (two years of history, §18.6) shows that one heap is too large, the candidate is hash partitioning on `aggregate_id`, which keeps the version key enforceable; the idempotency and key-sequence keys would then need the aggregate in them. That is OQ-J4, decided from measurements.

### 9.7 jOOQ without code generation [P]

Decision: **no jOOQ code generation in WP-0.3.** `JournalTable` declares the tables and their fields by hand as typed jOOQ `Field<T>` constants (`DSL.name("journal", "entry")`, `SQLDataType.UUID`, `SQLDataType.TIMESTAMPWITHTIMEZONE`, `SQLDataType.JSONB`, …).

Why:

- Code generation against a live database needs PostgreSQL at build time, which the fast tier must not need (§19.1; DN-040).
- jOOQ's DDL-file code generation interprets the SQL without PostgreSQL and is not expected to understand the PL/pgSQL trigger function, generated columns, `xid8` or range types this migration uses; it would make the migration bend to the generator.
- The library has two small tables. A hand-declared table is short, reviewable, and needs no new dependency or build plugin (§4.3).
- Binding `valid_from`/`valid_to` as plain `timestamptz` and generating `valid_period` in the database (§9.1) avoids a range-type binding, which jOOQ's open-source core does not provide without an extra module.

The guard against drift is `IntegrationTest:journal-schema-matches-adapter` (merge tier): it migrates a PostgreSQL database and compares every hand-declared field's name, type and nullability with `information_schema.columns`. Revisit when a module has many tables (a module that owns several tables may choose live-database code generation in the merge tier); that choice is per module.

### 9.8 Flyway migrations

- **Location and naming [P]:** `src/main/resources/db/migration/journal/V<NNNN>__<snake_case_description>.sql`, a zero-padded four-digit version per module (`V0001__create_journal_entry.sql`). Repeatable migrations (`R__`) are not used for the journal.
- **One Flyway history per module schema [P]:** each module's migrations run with `schemas` = its schema and the history table in that schema (`journal.flyway_schema_history`), so module version sequences are independent.
- **Who runs them [P].** A separate migration job (or init container) runs every module's migrations under `${ownerRole}`, the journal's first. `app-hms` connects only as `${appRole}`; at start-up it checks that each schema's Flyway version is one it supports and refuses to start otherwise. It never runs Flyway and never holds owner credentials (`IntegrationTest:journal-runtime-role-cannot-alter-or-drop`).
- **Placeholders:** `journalSchema` (default `journal`), `ownerRole`, `appRole`, `cdcRole`. Role names come from the deployment, never from code (§6.2 "no tenant-specific code").
- **Expand → migrate → contract** (§6.4). A journal column is never dropped, renamed or retyped: the table is a fact table, and the linter refuses all three (§9.3). New columns are added nullable or with a default.
- **N-1** (§6.8 #9): migrations "roll back to N-1" (ADR-021) by compatibility: the N-1 application must run against the N schema. Flyway community edition has no undo migrations, and the journal never needs one, because expand-only changes are backward compatible. `MigrationTest:journal-upgrade-rollback-n-1` runs from the second journal migration on; the first migration has no N-1.

### 9.9 The in-memory adapter

`InMemoryJournal` (`hms.kernel.journal.inmemory`, D8) implements the kernel's marker `hms.kernel.context.VolatileStore` (kernel §7.5) and every port with the same domain validation, the same unique keys, the same key sequence and the same tail semantics. It enlists in the kernel's in-memory transaction runner through the `TransactionContext` completion hook, so the rows of a rolled-back transaction disappear together with the in-memory repositories' changes, and the commit check of J-2 runs (§18). It is the adapter the nightly 10⁶-sequence property runs use (§19.1 "at the application-command layer with in-memory adapters"). It cannot show database-level guarantees (trigger, grants, row-level security, real transaction ids); those are integration tests (§15).

## 10. The outbox: publication (wiring waits for the cell)

The journal table is the outbox (ADR-004, ADR-009). Unlike the usual outbox pattern, **rows are never deleted after capture**: the table is the permanent record (J-1).

### 10.1 The CloudEvents transform (primary design) [P]

The Debezium outbox event router copies column values into headers unchanged. It cannot build `/hms/<module>`, `<AggregateType>/<id>`, the `type` and `dataschema` strings, or `validfrom` with its original offset, and Debezium emits `timestamptz` in UTC. So the primary design is a single-message transform owned by this library, not the router:

- Debezium's PostgreSQL connector captures inserts on `${journalSchema}.entry` only.
- The transform (code in `hms.kernel.journal.infrastructure`, packaged as a Kafka Connect plugin when the wiring is built) turns each change record into a binary-mode CloudEvent with `EnvelopeMapper`, the same mapping the fast-tier tests cover. It rebuilds offsets from the `*_offset_s` columns, builds `type` from `event_type` and `event_major`, uses `event_data` as the message value, `partition_key` as the message key, and `event_stream` to choose the topic.
- `payload` is never published (ADR-J1).
- Because `type` is built by the mapper, changing the type prefix later (`envelope.md` OQ-E1) never touches the fact table.
- Producer settings in the connector keep per-key order: idempotent producer, ordering preserved on retry (`envelope.md` §8).

### 10.2 Database prerequisites, owned by the cell [P]

`wal_level = logical`; a publication on `${journalSchema}.entry` only; a replication slot per connector; the CDC role. Replication slots must survive a primary failover: PostgreSQL 17+ failover slots with slot synchronisation in CloudNativePG (DN-J1). The insert-only table needs no special replica identity. Logical decoding reads the write-ahead log, which row-level security does not filter; an initial snapshot by `SELECT` would be filtered (§9.4), so connectors start without a data snapshot. Rows that no slot captured (before the first connector, or while a slot was lost) are found by the watermark check and re-published (§10.3).

### 10.3 Nothing lost silently: the publication watermark check (D15) [P]

A connector that is stopped, a slot that is dropped or re-created, or a failover without a synchronised slot can leave committed rows unpublished. A slot-lag alarm cannot see a dropped slot, because a dropped slot has no lag. So `PublicationWatermarkCheck` compares the journal with the topics:

- It reads the journal through the platform tail (§8.3) and keeps, per partition key, the highest `key_seq` committed. It consumes the patient and platform topics in its own consumer group and keeps, per key, the highest contiguous `keyseq` seen.
- A row that has been final for longer than the check interval and has not appeared on its topic is a **publication gap**. The check raises the operational alarm `JournalPublicationGap` and an owned task in the platform operations queue within 5 minutes of the gap (the §6.7 dead-letter bound, applied here) [P].
- Recovery is a gap re-publication (`envelope.md` §11, mode `GAP_FILL`): the missing rows go to the shared topic, unchanged, with the same ids, in `key_seq` order. The check starts it automatically for the missing range, as the `SYSTEM` actor and audited, because the rows are committed facts and re-publishing the same ids is idempotent; operations can also start it. The alarm and the task stay open until the gap is filled and the cause (a lost slot, a stopped connector) is found. Consumers that saw the jump in `keyseq` have parked the key and resume when the gap fills (`envelope.md` §9).
- The check also alarms when the tail horizon stops advancing (a stuck transaction) and when slot lag grows (disk alarms, §6.7).
- The check runs as the `SYSTEM` actor, outside any consumer's process. It waits for the cell: its comparison logic is built now on the in-memory adapter; wiring and `ChaosTest:postgres-failover-no-event-lost` wait for the cell (KA-J2).

## 11. Events published

The journal carries every module's events: each row becomes one CloudEvent per published major (`envelope.md` §2). Event names, owners, producers and keys are in `catalogue.md`. The journal library itself owns the dead-letter item aggregate type and its events (`DeadLetterItemOpened`, `DeadLetterItemReplayed`, `DeadLetterItemResolved`), written by the event library on behalf of the consuming module (`envelope.md` §10; `catalogue.md` §4).

## 12. Configuration

| Key [P] | Level | Lock | Default | Notes |
|---|---|---|---|---|
| None owned by the journal | — | — | — | Entry-time tolerances are the kernel's `EntryTimePolicy`: declared by the module that owns each timing class's event types, resolved by `platform-tenancy`'s `EntryTimePolicyResolver` and handed to the journal through the kernel's `EntryTimePolicySource` (D2, D11; kernel §6.3). The dead-letter alarm setting is owned and declared by `platform-tasks` (`platform-tasks` §8). Retention is fixed by §13.4 ("never auto-delete") and is not a setting. The transaction timeout (§7, §8.3) is deployment configuration |

The journal uses no calendar: recorded and valid times are continuous instants; calendars apply only to SLA timers configured for them (integrator's shared architecture).

## 13. Permissions and audit

The Trust Plane SDK arrives in WP-0.4 (§21; ADR-013). Until then the items below are ports or rules on callers. Privileged timing is refused in production: back-dating by the refusing `BackDatingAuthorization` binding, back-entry by the kernel's empty back-entry allow-list (§4.4).

| Operation | Who | Permission (WP-0.4) | Audit |
|---|---|---|---|
| Append | Only a module's application layer, after its own policy check | None of its own: the command's permission covers it (§6.3 "every endpoint passes through the policy enforcement point") | The row itself is the write-audit trail (§5.3 C) |
| Back-dated append | A user with the back-dating privilege | Decided through `BackDatingAuthorization`; its decision id is stored (J-8). Production refuses all until WP-0.4 | The row (reason, both times, decision id) plus the decision's own audit (CTRL-0010-4) |
| Back-entry append | A user of the back-entry tooling with the back-entry permission, in a verified downtime episode | Decided by the kernel's `BackEntryAuthority` in the context, which only the back-entry tooling issues after its own permission check (J-9; kernel §7.2). No production code can issue one until `TRU-BCP-03` | The row (reason, both times, episode id, code `BACK_ENTRY`) |
| Privileged as-was query (medico-legal, quality, CDS replay) | Authorised reviewers | A read permission with purpose-of-use (§7 item 2) | BALP AuditEvent per query (§6.3) |
| Read-model rebuild | Operations | An operations permission with a reason [P] | Audited as an administrative action (R07 §5.4 AU-1 "admin change") |
| Gap re-publication and journal replay | Operations | A privileged operation with a reason (`envelope.md` §11) | Audited (§7 item 5) |

## 14. Hazards and controls

The journal is the "enforced in" location of SI-10 ("Bitemporal journal") and part of SI-06's ("Clinical journal") (§2.1). HAZ-0010's owner is `platform-journal-squad`; HAZ-0006's is `record-squad` (`docs/safety/hazard-log.yaml`).

| Hazard | Control | What this library implements | Not here |
|---|---|---|---|
| HAZ-0006 (H6) | CTRL-0006-1 (preamble: every channel) | One append path below every channel adapter; every actor kind goes through the same validation (§4.2, §6) | Vendor lock of SI-06 parameters (`platform-tenancy`) |
| HAZ-0006 | CTRL-0006-2 (property tests) | Journal parts of the SI-06 property tests (§15) | The note lifecycle suite (`record`) |
| HAZ-0006 | CTRL-0006-3 (clause a) | Fact immutability: trigger, grants, migration linter, insert-only adapter (§9.3) | The rule that no command changes a signed note (`record`) |
| HAZ-0006 | CTRL-0006-4 (clause b) | An amendment is a new row linked by `supersedes_version`, with a reason; the original stays readable (§4.3) | Note versioning UI and author rules (`record`) |
| HAZ-0006 | CTRL-0006-6 (clause d) | No delete operation exists; entered-in-error is a new row with a reason; the retracted row stays (§4.2, §4.3) | The wrong-patient move workflow (`record`, `him`) |
| HAZ-0010 (H6) | CTRL-0010-1 (preamble: every channel; vendor-locked) | The journal classifies every append itself with the kernel classifier, below every channel, from `context.entryMode`, never from request input; tolerances come only from vendor-locked settings through the kernel's `EntryTimePolicySource`, never from a constant (§4.4) | The settings and their tighten-only rule (`platform-tenancy`; kernel) |
| HAZ-0010 | CTRL-0010-2 (property tests with clock skew, out-of-order events, back-entry) | `PropertyTest:SI-10-clock-skew-journal`, late-committing transactions in the tail tests, back-entry properties (§15) | `ScenarioSuite:downtime` (`TRU-BCP-03`) |
| HAZ-0010 | CTRL-0010-3 (clause a) | Valid and recorded time as separate columns; recorded time only from one reading of the injected `Clock` (§4.1, §4.4) | — |
| HAZ-0010 | CTRL-0010-4 (clause b) | Back-dating needs a reason, a `USER` actor and a decision verified through `BackDatingAuthorization`; production refuses all until WP-0.4 (§4.4) | The privilege itself (Trust Plane, WP-0.4) |
| HAZ-0010 | CTRL-0010-5 (clause c) | Back-entry keeps the paper time as valid time; every row carries its `EntryTimingCode`, which says whether it is labelled and travels in every event (§4.4; `envelope.md` §5) | Labels on screens, prints and exports (`record`, `platform-docs`, `hub`) |
| HAZ-0010 | CTRL-0010-6 (clause d) | The verified episode id on every back-entry row, for reconciliation; append and as-was paths sized for bursts (indexes §9.5); measured later | The back-entry tooling (`TRU-BCP-03`) and its performance test |
| HAZ-0015 (H2, H6) | CTRL-0015-10 (clause g) | Optimistic concurrency refuses a stale write instead of overwriting (§4.5) | Offline sync semantics (WP for mobile) |
| HAZ-J1 (proposed, §17) | — | Journal-as-outbox in the same transaction; key sequence; safe tail; publication watermark check | Consumer-side controls (`envelope.md`) |
| HAZ-J2 (proposed, §17) | — | Idempotency per actor with fingerprints; rollback-only on every non-`Appended` result; commit check; bounded retry of `RecordedTimeRegression` | — |
| HAZ-J3 (proposed, §17) | — | Shadow rebuild; `Rebuilding` status never served as empty | Each read model's query adapter (owning module) |

**Proposed tightenings [P]** (§3.4 item 1; `docs/safety/README.md` "Tightenings"), for the integrator to add to the controls' notes: J-5 chained-correction rules (CTRL-0006-4, -6); J-6 caller expectation must match the journal's classification and J-17 `AtRecording` limits (CTRL-0010-1, -3); J-9 back-entry only with a verified episode (CTRL-0010-5, -6); J-10 provenance consistency (CTRL-0010-5); J-11 reasons never defaulted for SI-06 and SI-10, and J-11b system reasons only for `SYSTEM` actors (CTRL-0006-4, -6, CTRL-0010-4); J-14 key fixed at creation (CTRL-0006-6); row-level security in every topology (§9.4); retroactive `EFFECTIVE` changes treated as back-dating (kernel §6.2; CTRL-0010-4).

## 15. Tests

Names follow `<Kind>:<name>` (`docs/safety/README.md` "Test names"). Where the hazard log already plans a name, the same name is used; new names are proposed for the hazard log's `planned_verification`, recorded, not self-approved.

| Test | Tier | Verifies | When |
|---|---|---|---|
| `StaticAnalysis:no-update-or-delete-on-fact-tables` | fast | CTRL-0006-3; §6.8 #2; the linter fails on a planted fixture for every statement kind of §9.3, on an unclassified table and on an unparseable statement, and passes on the real migrations | WP-0.3 |
| `ArchTest:journal-adapter-insert-and-select-only` | fast | §9.3 item 4 | WP-0.3 |
| `ArchTest:no-now-in-domain` | fast | CTRL-0010-3 (rule (d), applied to `hms.kernel.journal..` except `infrastructure`) | WP-0.3 |
| `ArchTest:kernel-journal-framework-free-outside-infrastructure` | fast | §3: no framework, CloudEvents, Debezium or Apicurio type outside `infrastructure` | WP-0.3 |
| `ArchTest:journal-privileged-readers-not-used-by-modules` | fast | §7 Access | WP-0.3 |
| `ArchTest:production-never-binds-test-adapters` | fast | D8: the kernel's rule (kernel §11), with its exception for the `app-hms` dev and test wiring package | WP-0.3 |
| `UnitTest:back-dated-append-refused-by-production-authorization` | fast | CTRL-0010-4; D16: the production binding refuses; no decision id reaches a row | WP-0.3 |
| `UnitTest:clinical-append-refused-without-entry-time-policy` | fast | J-7; D16 | WP-0.3 |
| `UnitTest:commit-after-non-appended-result-rolls-back` | fast | J-2: `Commit` after any non-`Appended` result rolls back and throws | WP-0.3 |
| `PropertyTest:journal-no-aggregate-write-without-row` | fast / nightly | J-2 commit check, on the in-memory adapter | WP-0.3 |
| `PropertyTest:journal-append-all-or-none-in-memory` | fast / nightly | J-2: an append writes every row of a command or none, under random conflicts | WP-0.3 |
| `PropertyTest:SI-10-clinical-time-distinct-from-system-time` | fast / nightly | CTRL-0010-3: for random valid times and clock readings, the stored valid time equals the input and the recorded time equals the single clock reading; neither is derived from the other except `AtRecording`, which is stored with source `AT_RECORDING` | WP-0.3 (journal part) |
| `PropertyTest:SI-10-journal-classifies-every-append` | fast / nightly | J-4, J-6: one clock reading; the stored classification equals the kernel classifier's on that reading; no caller expectation, actor kind or valid time avoids J-8 or J-9 | WP-0.3 |
| `PropertyTest:SI-10-future-clinical-time-refused` | fast / nightly | J-6 (journal part of the kernel property) | WP-0.3 (journal part) |
| `PropertyTest:SI-10-channels-journal-append` | fast / nightly | CTRL-0010-1: every actor kind reaches the same validation; mode is never taken from input | WP-0.3 (journal part) |
| `PropertyTest:SI-10-clock-skew-journal` | fast / nightly | CTRL-0010-2; J-12: a `TestClock` stepping backwards gives `RecordedTimeRegression`, writes nothing, and a retry after the clock passes succeeds | WP-0.3 |
| `PropertyTest:SI-10-back-entry-keeps-clinical-time-and-label` | fast / nightly | CTRL-0010-5: with a `BackEntryAuthority` issued in test sources (kernel §7.2), a back-entry keeps the paper time, records the clock time, carries the code `BACK_ENTRY` and the episode id, and its envelope carries both | WP-0.3 (journal part) |
| `PropertyTest:SI-10-back-dating-is-privileged-and-audited` | fast / nightly | CTRL-0010-4: a back-dated append without reason, `USER` actor or authorised decision is `Rejected`; with all three, the row holds reason, both times and the port's decision id | WP-0.3 (journal part) |
| `PropertyTest:journal-timing-round-trips-to-envelope` | fast / nightly | Every accepted classification's `EntryTimingCode` and `ClinicalTimeSource` round-trip through the row, and the code through the envelope's `entrytiming` | WP-0.3 |
| `PropertyTest:SI-06-amendment-is-a-new-version` | fast / nightly | CTRL-0006-4 (journal part): an amendment adds a version; every earlier row is unchanged and visible in history and in as-was views before it | WP-0.3 (journal part) |
| `PropertyTest:SI-06-entered-in-error-replaces-delete` | fast / nightly | CTRL-0006-6 (journal part): no sequence of port calls removes or alters a row; entered-in-error needs a reason, a live same-aggregate target and the target's valid period | WP-0.3 (journal part) |
| `PropertyTest:SI-06-channels-journal-append` | fast / nightly | CTRL-0006-1: every actor kind goes through the same correction rules | WP-0.3 (journal part) |
| `PropertyTest:SI-15-no-last-writer-wins-on-clinical-state` | fast / nightly | CTRL-0015-10 (journal part): concurrent appends on one version yield one `Appended` and one `VersionConflict`, never two rows | WP-0.3 (journal part) |
| `PropertyTest:journal-rebuild-equals-incremental` | fast / nightly | §21 WP-0.3 exit criterion and §6.8 #10, on the in-memory adapter with late commits; synthetic projections | WP-0.3 |
| `PropertyTest:journal-rebuild-interleaving-independent` | fast / nightly | §8.1: the same state for every cross-aggregate interleaving | WP-0.3 |
| `PropertyTest:journal-tail-never-skips-late-commit` | fast / nightly | §8.3: every committed row is read exactly once by the tail, whatever the commit order | WP-0.3 |
| `PropertyTest:journal-key-sequence-gap-free-commit-ordered` | fast / nightly | J-15 on the in-memory adapter | WP-0.3 |
| `PropertyTest:read-model-never-served-partial-during-rebuild` | fast / nightly | §8.2: a query during a rebuild returns the old version or "rebuilding", never a partial result | WP-0.3 |
| `PropertyTest:journal-as-was-known-at` | fast / nightly | §7: the known-at view holds exactly the rows recorded at or before R, including later-retracted ones | WP-0.3 |
| `PropertyTest:journal-as-was-valid-at` | fast / nightly | §7: the valid-at filter at V = `valid_from` (included) and V = `valid_to` (excluded); window overlap | WP-0.3 |
| `PropertyTest:journal-as-was-back-entry-and-retraction` | fast / nightly | §7: a back-entry and a retraction appear in the valid-time view only when known; the fold stays in version order | WP-0.3 |
| `PropertyTest:journal-idempotent-append` | fast / nightly | §4.6: a repeated command returns `AlreadyApplied` and writes nothing; keys of different actors never collide | WP-0.3 |
| `PropertyTest:journal-idempotency-key-reuse-with-different-request-refused` | fast / nightly | §4.6: same actor and key, different fingerprint → `IdempotencyKeyReused` | WP-0.3 |
| `UnitTest:journal-append-rejections` | fast | J-5 to J-17: one case per `JournalViolation` and for `RecordedTimeRegression`, including chained corrections and a `ChangeReason.SystemGenerated` reason from a non-`SYSTEM` actor (`SystemReasonNeedsSystemActor`, J-11b) | WP-0.3 |
| `UnitTest:publication-watermark-detects-gap` | fast | §10.3 comparison logic on the in-memory adapter | WP-0.3 |
| `IntegrationTest:journal-update-delete-truncate-refused` | merge | Trigger: UPDATE, DELETE and TRUNCATE fail, as the runtime role and as the table owner | Waits for the cell (DN-040) |
| `IntegrationTest:journal-runtime-role-insert-select-only` | merge | Grants (§9.3 item 2) | Waits for the cell |
| `IntegrationTest:journal-runtime-role-cannot-alter-or-drop` | merge | §9.8: the runtime role cannot `ALTER`, `DROP` or disable the trigger | Waits for the cell |
| `IntegrationTest:journal-append-in-caller-transaction` | merge | J-2: rollback of the caller leaves no row; commit leaves every row; the commit check refuses a declared write without a row | Waits for the cell |
| `IntegrationTest:journal-optimistic-concurrency` | merge | J-3 on real concurrent transactions; the savepoint keeps the caller's transaction usable for the rollback | Waits for the cell |
| `IntegrationTest:journal-tail-and-key-sequence` | merge | §8.3 with real transaction ids and counter-row locks | Waits for the cell |
| `IntegrationTest:journal-schema-matches-adapter` | merge | §9.7 drift guard; enum value lists equal the check constraints | Waits for the cell |
| `IntegrationTest:journal-rls-tenant-isolation` | merge | §9.4: no rows without `hms.tenant_id`; no cross-tenant read or write | Waits for the cell |
| `IntegrationTest:journal-rebuild` | merge | §21 WP-0.3 exit criterion on PostgreSQL (the exit evidence) | Waits for the cell |
| `IntegrationTest:journal-as-was-30-day-chart` | merge | §7 functional correctness on a 30-day synthetic chart; the C3 timing is WP-0.6's | Waits for the cell |
| `IntegrationTest:app-hms-refuses-to-start-without-journal-persistence` | merge | §2; D8 | Waits for the cell |
| `MigrationTest:journal-upgrade-rollback-n-1` | merge | §6.8 #9 | From the second journal migration |
| `IntegrationTest:outbox-debezium-cloudevents` | merge | §10: a committed row arrives once as a valid CloudEvent with the right key, `keyseq` and headers; a rolled-back row never arrives; `payload` is never published | Waits for the cell |
| `ChaosTest:postgres-failover-no-event-lost` | nightly | §10.2, §10.3: a primary failover and a dropped slot lose no event; a gap alarms within 5 minutes and is re-published | Waits for the cell |
| `PerformanceTest:back-entry-after-simulated-long-outage` | nightly | CTRL-0010-6 (journal part) | With `TRU-BCP-03` |

## 16. Acceptance criteria

1. Every column of §9.1 exists in the migration and in `JournalTable`, and the drift test passes against PostgreSQL (merge tier, once the cell exists).
2. No code path, role or migration can update, delete or truncate a journal row: the linter, the architecture rule and the trigger tests each fail on a planted violation and pass on the clean tree; an unclassified table fails the linter.
3. An append either writes every row of a command in the caller's transaction or none; a transaction with any non-`Appended` result never commits.
4. Valid time and recorded time are separate in every row; recorded time comes only from one reading of the injected clock per append.
5. The journal classifies every append itself. A caller expectation that differs is refused. In WP-0.3 production wiring, every back-dated append, every back-entry append and every user-timed append to a clinical event type is refused by a named mechanism with a passing test (§4.4).
6. Amendments and entered-in-error are new rows with reasons, linked to a live version of the same aggregate; the earlier rows stay readable.
7. The known-at and valid-at views return exactly the rows §7 defines, including the boundary cases.
8. The journal-rebuild test passes on the in-memory adapter now and on PostgreSQL once the cell exists (§21 exit criterion); the tail never skips a late-committing row; a read during a rebuild is never partial.
9. Each partition key's rows carry a gap-free `key_seq` in commit order.
10. The hazard log lists this library's implementations of CTRL-0006-1, -2, -3, -4, -6, CTRL-0010-1 to -6 and CTRL-0015-10 in `implemented_in` only when the code exists, and in `verified_by` only after the named tests ran green in a recorded CI run (§3.5).

## 17. Open questions, proposals and known anomalies (local labels; the integrator numbers them)

- **OQ-J1: privilege for downtime back-entry.** SI-10 says "Back-dating is privileged and audited" and "Back-entry keeps the original clinical times and is labelled". This spec requires, for a back-entry, the back-entry permission and a downtime episode verified server-side (J-9). Is a downtime back-entry also a form of back-dating that needs the back-dating decision of J-8? The journal can enforce either. A reading of a safety invariant, so the CSO's (§3.4 item 1). Default until answered: back-entry permission and verified episode only.
- **OQ-J2: tamper evidence for the journal.** Should journal rows carry a per-aggregate hash chain (each row hashing its predecessor), so that a privileged rewrite of the table is detectable, as AU-3 requires of the audit store (R07 §5.4)? Per-aggregate chains fit the existing version order. Cost: a canonical serialisation of every row and a verifier. Default: no chain; the residual risk of §9.3 is recorded.
- **OQ-J3: row-level security in every topology.** §6.4 requires `FORCE ROW LEVEL SECURITY` in the pooled tier. This spec applies it in every topology so one migration serves all (§2.2 rule 5; §9.4). Confirm, since every module's tables would follow.
- **OQ-J4: journal partitioning.** Decide in WP-0.6 from the 1,000-bed-day volumes whether the journal is partitioned (candidate: hash on `aggregate_id`, which keeps the version key; the idempotency and key-sequence keys would then include the aggregate). Range partitioning by time is ruled out by J-3 and §9.6.
- **OQ-J5: entry timing of administrative and system rows. Closed.** The kernel classifier decides, with no journal rule of its own (kernel §6.2; D10): an `EFFECTIVE` change whose start is earlier than the recorded time is `BackDated` and needs a reason and a verified decision; otherwise it is `EffectiveDated`. `SYSTEM` rows are `CONTEMPORANEOUS` or `EFFECTIVE_DATED` (J-10).
- **ADR-J1: the journal row carries two payloads.** Proposal: `payload` holds the full change data, the source for rebuild and audit, with ADR-008 designated fields as ciphertext under the tenant key; `event_data` holds the minimised published data under the catalogued schema plus the appender's `meta` block; only `event_data` is published. Context: §2.2 rule 1 and §5.3 D need rebuilds from the journal; `envelope.md` §6 minimises published data; crypto-shredding (ADR-004, ADR-008) fails if designated fields are plain text in an immutable row. Consequences: more storage per row; every module writes two mappings; a test proves that no designated field is plain text in either column.
- **ADR-J2: ordering without gaps.** Proposal: a per-partition-key counter (`key_seq`, gap-free, commit-ordered by a counter-row lock) and a safe tail by transaction-id horizon (`tx_id`, `xid8`), instead of ordering by recorded time (§8.3). Context: recorded time is read before commit, so recorded-time paging can skip rows; replay must keep per-patient commit order (§12.1 "A08 never overtakes A01"); consumers must detect loss per key (D15). Consequences: one counter-row upsert per key per append, serialising writes per key until commit; rare deadlocks between appends that touch two keys in opposite orders, reported as retryable.
- **DN-J1: replication slots that survive failover (for WP-0.2).** The cell must provide failover-synchronised logical replication slots (PostgreSQL 17+ failover slots with CloudNativePG slot synchronisation), so a primary failover does not drop the outbox slot. The watermark check (§10.3) detects and repairs a lost slot, but repair is a privileged operation and should be rare. Owner: the WP-0.2 cell.
- **KA-J1: privileged journal reads are not audited yet.** `AsWasReader` emits no BALP AuditEvent until the Trust Plane Audit SDK exists; no production code calls it in WP-0.3 (`ArchTest:journal-privileged-readers-not-used-by-modules`). Command handlers do read their own module's rows in production (`ModuleJournalReader`, for idempotency and history), and `platform-tasks` reads the request rows (`TaskRequested`, `TaskCompletionRequested`, `TaskCancellationRequested`) through its tail; those reads are not audited either. Hazard references: H14 (HAZ-0021), SI-21. Backlog: `PLT-CORE-01`, `TRU-AUD-01`. Closes with WP-0.4.
- **KA-J2: the outbox is not published yet.** Journal rows are written but no CloudEvents transform, connector, topic, Apicurio registration, dead-letter store or publication watermark check runs, so no event leaves the journal, and the per-patient ordering, journal-rebuild and failover tests have not run on real infrastructure. Hazard references: H5, H6 (HAZ-0003 CTRL-0003-5; HAZ-J1). Backlog: `PLT-CORE-04`. Closes with the WP-0.3 cell slice after WP-0.2 (DN-040).
- **KA-J3: back-dated and back-entry appends are refused.** Mechanism: the production binding `RefusingBackDatingAuthorization` (§4.4), proved by `UnitTest:back-dated-append-refused-by-production-authorization`; and the kernel's empty back-entry allow-list, so no `BackEntryAuthority` exists and the mode is never `BACK_ENTRY`, proved by `ArchTest:back-entry-authority-only-from-back-entry-tooling` and `PropertyTest:kernel-entry-mode-derived-from-context` (kernel specification). Hazard reference: HAZ-0010 (CTRL-0010-4, -5). Backlog: `PLT-CORE-01`, `TRU-BCP-03`. Closes with WP-0.4 (back-dating) and `TRU-BCP-03` (back-entry).
- **KA-J4: user-timed appends to clinical event types are refused until the entry-time tolerances are configured.** Mechanism: tenancy's `EntryTimePolicyResolver` answers `NotConfigured` while no vendor-locked tolerance is configured (DN-KN1), and the classifier answers `Refused(TIMING_POLICY_NOT_CONFIGURED)`, proved by `UnitTest:clinical-append-refused-without-entry-time-policy`. No clinical module exists in WP-0.3; `EFFECTIVE` and `AtRecording` rows need no policy and are unaffected. Hazard reference: HAZ-0010 (CTRL-0010-1). Closes when the CSO sets the values (DN-KN1).
- **KA-J5: refused commands leave no journal row.** Refusal audit (R07 AU-1 "outcome") waits for the Trust Plane Audit SDK; meanwhile `platform-config` and `platform-tenancy` route refusals to their own audit ports (§4.7). Hazard references: HAZ-0019 (configuration), HAZ-0021. Closes with WP-0.4.
- **HAZ-J1 (proposed): a domain event is lost, duplicated, reordered or silently stuck between the journal and its consumers.** Seeded hazards H6, H5 and H15. Description: a committed change never reaches a consumer (Hub, tasks, RCM, analytics), reaches it twice and is applied twice, overtakes an earlier event for the same patient, or waits unseen, so downstream systems act on missing, duplicated or stale facts (for example a charge posted twice, an A08 before its A01, a task never created). Causes: an outbox write outside the state-change transaction; a non-idempotent consumer; a partition key other than the patient; a change of a topic's partition count; a replication slot lost or re-created without a snapshot (failover, operator action); a consumer that crash-loops or stalls and so never creates a dead-letter item; head-of-line blocking when one poison event parks a patient's key; a journal replay that reorders a patient's events or re-fires external effects; a patient merge that leaves one person's events under two keys; dead-letter items lost to topic retention; an unowned or unalarmed dead-letter queue. Proposed controls: journal-as-outbox in the same transaction (§6); key sequence and publication watermark check with gap re-publication (§8.3, §10.3); failover slots (DN-J1); at-least-once delivery with idempotent consumers and per-key sequence checks, per-patient keys, fixed partition counts, dead-letter items stored in the consumer's database and never deleted, first-failure clock, independent consumer-lag-age monitor, parking scope declared and alarmed per consumer, replay modes that suppress external effects (`envelope.md` §8–§11); merge ordering handed to `empi` (`envelope.md` OQ-E4). Planned verification: `IntegrationTest:events-per-patient-order-idempotent-consumers`, `PropertyTest:idempotent-consumer-at-least-once`, `PropertyTest:dead-letter-parking-keeps-key-order`, `ChaosTest:broker-loss-no-event-lost`, `ChaosTest:dead-letter-alarm-within-5-minutes`, `ChaosTest:consumer-crash-loop-alarms-within-5-minutes`, `ChaosTest:postgres-failover-no-event-lost`, `IntegrationTest:outbox-debezium-cloudevents`. Owner: `platform-journal-squad` [P]. Initial risk: for CSO triage, not proposed here.
- **HAZ-J2 (proposed): a clinical write is silently lost or wrongly refused at the journal.** Seeded hazards H6, H2. Description: a clinician is told an action was saved when it was not, or a valid write is refused in normal operation, so care proceeds on a missing record (for example a second dose given but not recorded). Causes: an idempotency key reused by another actor or for a different request; a caller committing after a non-`Appended` result; an aggregate write without its journal row; clock skew between nodes making `RecordedTimeRegression` refuse quick successive writes; missing entry-time policy. Proposed controls: per-actor keys with request fingerprints (§4.6); rollback-only and commit check (J-2); bounded retry of `RecordedTimeRegression` within the ADR-026 skew bounds and a clear clock-fault error beyond (§6 step 7); explicit refusal, never silent, when no policy exists (J-7). Planned verification: `PropertyTest:journal-idempotency-key-reuse-with-different-request-refused`, `UnitTest:commit-after-non-appended-result-rolls-back`, `PropertyTest:journal-no-aggregate-write-without-row`, `PropertyTest:SI-10-clock-skew-journal`. Owner: `platform-journal-squad` [P]. Initial risk: for CSO triage.
- **HAZ-J3 (proposed): a read model being rebuilt is shown as complete.** Seeded hazard H5. Description: during a rebuild a worklist or board is empty or partial and looks like "no work", so tasks are missed (SI-03). Causes: rebuilding in place; serving a new projection version before it has caught up. Proposed controls: shadow rebuild with atomic swap; "rebuilding, unavailable, manual check required" status, never an empty result (§8.2). Planned verification: `PropertyTest:read-model-never-served-partial-during-rebuild`. Owner: `platform-journal-squad` [P]. Initial risk: for CSO triage.

## 18. Interfaces this specification assumes of its siblings

- **`hms.kernel.context` (D1):** `CommandContext` with tenant, facility, actor, on-behalf-of, device, purpose-of-use, clinical time, capture channel, back-entry authority (`BackEntryAuthority?`), idempotency key, correlation id and causation id (`CausationId?`), and the derived `entryMode` (kernel §7.3); `ActorRef(id, kind)` with kinds `USER`, `DEVICE`, `INTERFACE`, `MIGRATION_LOADER`, `SYSTEM`; `ChangeReason.Entered` (non-blank, no default) and `ChangeReason.SystemGenerated`; `PurposeOfUse` (no default); `IdempotencyKey` (opaque, ≤200 characters); `CorrelationId`; `DeviceRef`; the `EntryTimePolicySource` port (`policyFor(context, timingClass, at: AsOf): EntryTimePolicyLookup`). `SYSTEM_PROCESSES` holds `hms.kernel.journal..`, for the publication watermark check and its automatic gap fill (§10.3). `TransactionRunner.inTransaction(tenant, block: (TransactionContext) -> TxOutcome<T>): T`. `TransactionContext` with `tenant`, `fun markRollbackOnly(cause: String)`, `val isRollbackOnly: Boolean`, `fun onBeforeCommit(check: () -> Unit)` and `fun onCompletion(hook: (committed: Boolean) -> Unit)`; the runner rolls back and throws when a rollback-only transaction's block returns `Commit`. `TxOutcome` lives beside the runner. `InMemoryTransactionRunner` in `hms.kernel.context.inmemory` (test and dev only, D8).
- **`hms.kernel.ids`:** `TenantId`, `FacilityId`, `PatientId`, `UserId` typed ids; the `IdGenerator`.
- **`hms.kernel.time`:** `RecordedTime` (with `now(clock)` and the persistence-only `restore`, under the kernel's `ArchTest:persistence-only-factories`, whose allow-list holds `hms.kernel.journal.infrastructure..` and `hms.kernel.journal.inmemory..`); `ClinicalTime`; `ValidTime` (start and end with their offsets); `ValidTimeInput` (`Given(ValidTime)`, `AtRecording`); `ValidTimeKind`; `ClinicalTimeSource`; `TimingClass`; `AsOf(validAt, knownAt)` with `AsOf.latest` and `AsOf.knownAt(validAt, recorded)` (D4); `EntryTimeClassifier.needsPolicy(input, kind, mode)` and `classify(input, kind, recorded, mode, policy, episode)`; `EntryTimingResult` (`Accepted(timing, validTime, policy)`, `Refused(reason)`); `EntryTiming` with `code`, `source` and `requirements`; `EntryTimingCode` (`CONTEMPORANEOUS`, `BACK_DATED`, `BACK_ENTRY`, `OFFLINE_CAPTURE`, `LATE_ARRIVAL`, `MIGRATED`, `EFFECTIVE_DATED`, with `labelled`); `EntryTimeRefusal`; `TimingRequirement`; `EntryMode` (D10); `EntryTimePolicy` with its `ResolvedParameter` sources, built only by factories in the configuration resolvers (D11); `EntryTimePolicyLookup` (`Available`, `NotConfigured`, `Unavailable`, `NotLookedUp`); `BackEntryEpisode`.
- **`hms.kernel.events` (`envelope.md` §12):** `EventType`, `ChangeKind`, `Provenance`, `ModuleId`, `ConsumerId`, `AggregateType` and the aggregate-type registry (owner, writers, keying), `PartitionKey`, the catalogue with producers, in-database consumers and, per event type, `validTimeKind: ValidTimeKind` and `timingClass: TimingClass?`; `CausationId` on the envelope.
- **`platform-tenancy`:** implements the kernel's `EntryTimePolicySource` as `EntryTimePolicyResolver` in `hms.platform.tenancy.application.settings`, answering `NotConfigured` while no tolerance is configured (tenancy §5.12; D11); uses PascalCase aggregate types `EnterpriseStructure`, `TenantConfiguration`, `UserPreferences` with keying `TENANT`; its event types are of kind `EFFECTIVE`.
- **`platform-config`:** uses PascalCase aggregate types `ConfigChangeSet`, `KillSwitchBoard`, `StreamActivation`, `FeatureFlag` with keying `TENANT`; its event types are of kind `EFFECTIVE`, and a command states the expected timing `EFFECTIVE_DATED`; refusals are not journal rows (§4.7).
- **`platform-tasks`:** uses `JournalAppender.append(tx, context, request: AppendRequest)` and `JournalReaders.forModule(...)`, whose `ModuleJournalReader.byIdempotencyKey(tx, actor, key)` it calls; reads `TaskRequested`, `TaskCompletionRequested` and `TaskCancellationRequested` through `JournalTails.forConsumer` (§4.8; D14); writes its rows with `ValidTimeInput.AtRecording` (event kind `CLINICAL_AT_RECORDING`), its `SYSTEM` rows from `hms.platform.tasks.application.system`, and puts other instants (due, breach, performed at) in event data; aggregate types `Task` and `TaskRequest` with keying `PATIENT_IF_ANY`, `Pool` and `Queue` with keying `AGGREGATE`; runs the rebuild property over its own worklist; implements `DeadLetterTaskSink` (`envelope.md` §12); owns and declares the dead-letter alarm setting and builds `DeadLetterAlarmPolicy` (`platform-tasks` §8).
