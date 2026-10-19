===== kernel
Files I wrote: `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-kernel.md` (one new file, no other edits). I ran no git command that changes state and no Gradle run.

## API summary (kernel API 1)
- **Stable now:** all of `hms.kernel.ids`, all of `hms.kernel.time`, and `TestClock`. After acceptance, changes are additive only.
- **ids:** `fun interface IdGenerator { fun newId(): UUID }`, implemented by `UuidV7Generator(clock: Clock, random: RandomGenerator)`.
  - Follows RFC 9562 §5.7 / §6.2 Method 1: a 12-bit counter in `rand_a`, seeded with its top bit clear. On counter overflow it borrows the next millisecond.
  - Its timestamp is `max(clock, last)`, so ids stay strictly increasing even when the clock goes backwards.
  - Also: `UuidV7.parse/isV7/requireV7/compare` (unsigned byte order, as PostgreSQL uses) `/format`, `interface TypedId`, and `IdGenerator.next(::TaskId)`.
  - Never `UUID.fromString` on input, because it accepts short groups.
- **time:**
  - `RecordedTime` is a value class over `Instant`. It is made only by `now(clock)`; `restore` is persistence-only (opt-in marker plus an ArchUnit rule).
  - `ClinicalTime(instant, offset)` has `of(...)` and `resolveLocal(local, zone)`, which returns `Resolved`, `Ambiguous` or `InGap` for DST and never guesses. `atRecordedTime(...)` is the named, visible default.
  - `ValidPeriod` is half-open `[start, end)`. `AsOf(validAt, knownAt: RecordedTime? = null)`.
  - `EntryTimeClassifier.classify(clinical, recorded, mode: USER|BACK_ENTRY|INTERFACE|MIGRATION, policy, episode?)` returns `EntryTiming`: `Contemporaneous`, `BackDated`, `BackEntry`, `LateArrival`, `Migrated` or `Refused`. Each accepted result carries a label and the requirements the command layer must meet.
  - `BusinessCalendar(zone, weekend, holidays per year)` has `plusBusinessDays`, `businessDaysBetween` and `plusBusinessTime`. Each returns `CalendarAnswer(value, uncoveredYears)`.
- **testing:** `TestClock(initial, zone)` with `advanceBy` and `setTo` (which can move backwards); views from `withZone` share the same time.
- **money:**
  - `Money(BigDecimal, Currency)`, with the scale taken from the JDK's ISO 4217 data. `+`, `-` and `times(Long)` are exact; `times(factor, RoundingMode)` needs a rounding mode.
  - `allocate` uses the largest-remainder method, so the shares always sum exactly.
  - `CashRoundingPolicy` is `NotConfigured` or `ToIncrement`. Also `ExchangeRate.convert/convertBack(…, RoundingMode)` and `ExchangeRateTable.rateAt(from, to, at)`. No floating point anywhere.
- **quantity:**
  - `UcumUnit.parse` checks UCUM syntax only. `UnitCatalogue` is the port for the terminology service; until that exists, `UnavailableUnitCatalogue` answers `Unavailable` and callers fail closed.
  - `Quantity` has no operators and is not `Comparable`. `magnitude()` and `ofMagnitude()` are restricted to `hms.reg.dose..`, `hms.kernel.quantity..` and `..infrastructure..`.
  - `DoseQuantity` refuses a missing unit, unity or atom-less units, and zero or negative values.
  - `ClinicalNumberFormat` applies the ISMP rules (leading zero, no trailing zeros, ASCII digits, never rounds).
  - `DoseComparisons` implements exactly §2.1 (b)–(e), and every result carries a `ComparisonRecord`.

## Proposed items (all to be numbered; full text is in spec §17)
- **OQ-KN1, what "audited" means in §6.8 #1:** this build reads it as one small API that safety code owners review, plus a `ComparisonRecord` on every result that the caller stores with its journal and audit rows. The kernel writes nothing itself. Confirm, or say whether each call must emit its own audit event.
- **OQ-KN2, KB maximum in §2.1 (c):** the hard stop is decided by `ordered >= factor × maximum`, computed exactly inside the API and never returned. CTRL-0005-7 already reads it this way. The CSO should confirm this is not dose arithmetic.
- **OQ-KN3, what counts as a unit-less dose (a tightening):** `DoseQuantity` refuses unity `1`, bare numbers or factors, annotation-only units, and zero or negative doses. This must be recorded as a tightening of SI-05. It leaves open how counted doses such as tablets are expressed.
- **OQ-KN4, clinical number display beyond the stated ISMP rules:** digit grouping, the decimal separator in `ar`/`ckb`, Eastern Arabic-Indic digit input, and unit display names. Needs the ISMP source in `docs/content-sources/` and CSO approval.
- **OQ-KN5, UCUM specification as a content source:** a copy and its terms of use must be placed in `docs/content-sources/`. The grammar and its test vectors come from it, not from memory.
- **OQ-KN6, non-dose quantities:** results, nursing, `reg-ews` and `reg-lis-rules` will need same-unit comparisons or arithmetic on non-dose values. Decide before Phase 1: widen the allow-list to `hms.reg..`, or add a separate non-dose comparison API. `DoseQuantity` stays unwrappable only inside the kernel either way.
- **OQ-KN7, IQD scale and cash-rounding settings:** whether the ledger keeps IQD at the ISO minor unit or whole dinars. Also new keys `kri.rcm.cash-rounding.mode` and possibly `kri.rcm.cash-rounding.usd`.
- **OQ-KN8, exchange-rate direction:** whether change in the other currency uses the inverse of one posted rate or a separate buy/sell rate, and how a corrected rate supersedes a wrong one.
- **OQ-KN9, business hours and facility calendar override:** whether administrative SLAs need business hours or part days, and whether a facility may override the tenant's weekend or holidays.
- **OQ-KN10, labels and windows in the entry-time classification:** `LATE_ARRIVAL` for late interface data, `LATE_ENTRY` for back-dating, and the rule that a back-entry must name its downtime episode and fall inside its window are additions beyond CTRL-0010-5. CSO to confirm.
- **OQ-KN11, offset of recorded time:** this build applies §5.3's "original offset" to clinical time only. Recorded time is stored as a UTC instant and shown in the facility zone.
- **OQ-KN12, feature ID:** Appendix A has no row for the kernel libraries (the same question as the workflow spec's OQ-W1).
- **DN-KN1, for the CSO [HUMAN]: values of the SI-10 entry-time tolerances.**
  - These are the contemporaneous, future and interface-lateness tolerances, per record type. They are vendor-locked and tighten-only.
  - Options: (1) a value per record type before Phase 1 (default); (2) one vendor value, tightened per tenant; (3) zero for all, the strictest.
  - Until answered: no value ships, and tests use synthetic values marked `PolicySource.Synthetic`.
- **KA-KN1, UCUM validation is syntactic only:** unknown atoms pass until WP-1.1 (`PLT-CORE-05`), and the port fails closed. HAZ-0005.
- **KA-KN2 (only if the detekt rule slips):** the detekt half of §6.8 #1 is missing. It must exist before the medications module (§9.10 acceptance 6). HAZ-0005.
- **KA-KN3, limits of the ArchUnit magnitude rule:** it cannot see arithmetic inside allowed `..infrastructure..` code, or a value laundered through `display()` and parsed back. HAZ-0005.
- **KA-KN4, unconfigured calendar data and SI-10 tolerances:** calendar answers report uncovered years and count unknown days as business days, so deadlines come earlier, never later. HAZ-0010, HAZ-0003.
- **HAZ / ADR:** none proposed. The spec maps the kernel parts of CTRL-0005-4/5/6/9/10/17, CTRL-0010-1/2/3/4/5 and CTRL-0003-5 to named tests.
- **Proposed new names (non-`kri.*`):** settings `platform.time.entry.{contemporaneous-tolerance,future-tolerance,interface-lateness-tolerance}.<record-type>`; permissions `clinical-time.back-date` and `clinical-time.back-entry`.

## Disagreements with or extensions to the shared architecture
- **Non-dose quantities (OQ-KN6):** restricting the `Quantity` magnitude to `hms.reg.dose..`/kernel/infrastructure is right for doses. It would also block legitimate non-dose work in Phase 1, such as critical-value and reference-range checks, NEWS2 bands and LIS delta checks. I kept the rule as decided for WP-0.3 and made `DoseQuantity`'s inner quantity `internal`.
- **`DoseComparisons` signatures:** (b)–(d) take `DoseQuantity`; (e) fluid balance takes plain `Quantity`, because intake and output are not all medication doses.
- **Entry-time classifier has four modes:** I added `INTERFACE` and `MIGRATION` to the shared back-dating/back-entry pair. Device and migrated data cannot hold a user privilege, so they must not land in `BackDated`.
- **Recorded time and precision:** `RecordedTime` carries no offset (OQ-KN11). All kernel instants are truncated to microseconds to match PostgreSQL `timestamptz` [P].
- **Alignment with sibling specs:**
  - The facility zone is the tenancy spec's `FACILITY.zone` node attribute, not a setting.
  - `AsOf` takes a nullable `knownAt` so that `platform-tenancy` can reuse the kernel type. Its spec currently defines its own `AsOf(validAt: Instant, knownAt: Instant?)`, so the integrator should merge the two.
  - Calendar setting levels match the `platform-tasks` spec (COUNTRY_PACK, TENANT); a facility override is OQ-KN9.
- **Detekt rule feasibility:** a precise `NoDoseArithmetic` rule needs type resolution. Today the `detekt` task passes no classpath, and detekt 1.23.8's embedded Kotlin 2.0.21 is older than the project's Kotlin 2.3.21, so this has to be proven before the rule is relied on.
===== journal
I wrote all three specs: the journal module spec, the CloudEvents envelope rules and the domain-event catalogue. They are specification only and nothing is built. I ran no Gradle and no git state changes, and I changed no file outside the three below.

**Files written**
- C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-journal.md
- C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\events\envelope.md
- C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\events\catalogue.md

**API summary**
1. `hms.kernel.journal.domain` holds the row types `NewEntry`/`JournalEntry`, the shared command context `ChangeContext`, `ChangeKind` (CHANGE, AMENDMENT, ENTERED_IN_ERROR) and `Source` (§5.3 B list plus `system`). It also holds the sealed `AppendResult` (Appended, AlreadyApplied, VersionConflict, IdempotencyKeyReused, RecordedTimeRegression, Rejected) and the sealed `JournalViolation`. Pure folds are `Projection<S>` and the `AsWas` functions `knownAt`, `validAt` and `view`.
2. The ports, in `hms.kernel.journal`:
   - `JournalAppender.append(tx: TransactionContext, context, entries): AppendResult` writes in the caller's transaction. Only `Appended` commits; every other result means the caller rolls back through `TransactionRunner.inTransaction` and `TxOutcome.Commit` / `TxOutcome.Rollback`.
   - `JournalReader`: `history`, `patientTimeline`, `byIdempotencyKey`, `streamForRebuild`.
   - `ReadModelStore` and the `ReadModelRebuilder` service.
3. The adapters (`JooqJournal`, `JournalTable`) live in `hms.kernel.journal.infrastructure`. jOOQ is used without code generation; a merge-tier drift test checks the hand-declared table against PostgreSQL. `InMemoryJournal` is a test fixture.
4. Database (from `V0001__create_journal_entry.sql`):
   - one table `journal.entry`, append-only;
   - `valid_period` is a generated `tstzrange` column;
   - unique (tenant, aggregate type, aggregate id, version) gives optimistic concurrency, and a foreign key to that key keeps a correction on the same aggregate;
   - an update/delete/truncate trigger, a REVOKE leaving the runtime role INSERT and SELECT only, forced row-level security, and a migration linter;
   - no partitioning.
5. Rules hold J-1 to J-13. Recorded time comes only from the injected `Clock`. Back-dating needs a reason and a policy decision id, so it is refused until WP-0.4 issues decisions. A back-entry keeps the paper time and carries a label. A patient key is fixed at version 1.
6. `hms.kernel.events`:
   - catalogue and type types: `EventType` (type string `hms.<CanonicalName>.v<major>`), `EventCatalogue`, `PartitionKey.of(patientId, aggregateId)`;
   - envelope: `HmsEnvelope` and `EnvelopeRules` (an exact extension allowlist and a logging allowlist);
   - consumers: `IdempotentConsumer.decide`, the `ProcessedEventLedger` port, `DeadLetterAlarmPolicy` (5 minutes, refuses anything longer).
7. Envelope extensions: `tenantid`, `facilityid`, `patientid`, `partitionkey`, `validfrom`, `validto`, `entrytiming`, `changekind`, `supersedes`, `aggversion`, `correlationid`, `causationid`, `traceparent`. CloudEvents `time` is the recorded time. Events travel in binary mode with the patient as the Kafka key, on one patient topic and one platform topic per journal database. Partition counts are fixed. Owned dead-letter queues park the failed event's key so later events for that key wait in order.

**Proposed items (to be numbered)**

*Open questions*
- **OQ – privilege for downtime back-entry:** SI-10 says "Back-dating is privileged and audited" and "Back-entry keeps the original clinical times and is labelled". Is a downtime back-entry a form of back-dating that needs a privilege decision, or is the label enough? This is a reading of a safety invariant, so it is the CSO's call (§3.4 item 1). Default until answered: privilege required for `BACK_DATED` only.
- **OQ – tamper evidence for the journal:** should rows carry a per-aggregate hash chain, so a superuser's rewrite is detectable, as AU-3 requires of the audit store (R07 §5.4)? Default: no chain, with the residual risk recorded in §9.3.
- **OQ – row-level security in every topology:** §6.4 requires `FORCE ROW LEVEL SECURITY` only in the pooled tier. The spec applies it everywhere so one signed migration serves all topologies (§2.2 rule 5). Please confirm; every module's tables would follow.
- **OQ – journal partitioning:** decide in WP-0.6 from the 1,000-bed-day volumes. The candidate is hash on `aggregate_id`, and the idempotency key would then include the aggregate. Range partitioning by time is ruled out because the version key could not be enforced across partitions, and dropping a partition deletes rows without firing a DELETE trigger.
- **OQ – shared kernel types:** should `hms.kernel.ids` provide `TenantId`, `FacilityId`, `PatientId` and `ActorId`? Should `TransactionContext`/`TransactionRunner` move to a shared `hms.kernel.tx`? The journal API uses plain `UUID` for now.
- **OQ – placement:** `InMemoryJournal` as Gradle test fixtures of `:platform:journal` or in `:platform:testing`; the migration linter in `backend/platform/arch-rules`, where it must see every project's migrations.
- **OQ – `type` prefix:** CloudEvents recommends a reverse-DNS prefix, and none has been named. Default `hms.`. It must be decided before the first published event, because changing it later breaks every type.
- **OQ – sensitivity labels on events:** labels only in the payload (`meta.security`), never in attributes, so no tool sees a label beside a patient key (SI-21, CTRL-0021-5). Needs confirmation by the privacy officer and the CSO.
- **OQ – free text in payloads:** forbidden unless the catalogue entry names the field and the reason. Confirm, or list the types that need it (for example override and cancellation reasons).
- **OQ – Debezium header placement:** can the pinned Debezium 3.6 outbox router place the journal columns as `ce_*` headers in the required form, or is a small transform in `:platform:journal` needed? Decided when the wiring is built.
- **OQ – unnamed ADT events:** §8.5 lists leave/return (A21/A22), pending admit (A14), pre-admit (A05) and bed swap (A17) without names, and R11 §14 names none. The `adt` work package should name them.
- **OQ – `OrderVerified` and `ResultAmended`:** BP §7.6 uses both; §8.5 neither lists them nor declares them aliases. Is `OrderVerified` an alias of `MedicationVerified`? Is `ResultAmended` an alias of `ResultCorrected` or a separate event? The §8.4 result machine has both "amended" and "corrected" states. This is a naming decision next to OQ-036.
- **OQ – owners where R11 §14 names a function, not a module:**
  - `PatientArrived` → `adt`; `PatientCheckedIn` → `scheduling`;
  - `ReferralSent`/`ReferralAccepted` → `scheduling`;
  - `IdentityVerified` → `empi`;
  - result events: schema in `results`, produced by `lis` and `ris`;
  - `ChargeCreated`: schema in `rcm`, written by the clinical producers; `ChargeCredited` could come from either side;
  - `StaffAssignmentChanged`: undecided.
- **OQ – keys for finance and staffing events:** should `ClaimSubmitted`/`ClaimAdjudicated`, `PaymentReconciled` and `StaffAssignmentChanged` be keyed by patient or by their own aggregate? A corporate or insurer claim may cover many patients.

*Known anomalies*
- **KA – journal reads not audited:** the as-was and history ports emit no BALP AuditEvent until the Trust Plane Audit SDK exists. No production caller uses them in WP-0.3. Hazard: H14 (HAZ-0021). Backlog: `PLT-CORE-01`, `TRU-AUD-01`. Closes with WP-0.4.
- **KA – outbox not published:** journal rows are written, but no Debezium connector, Kafka topic, Apicurio registration, dead-letter queue or replay exists. The per-patient-ordering and PostgreSQL journal-rebuild exit tests have not run on real infrastructure. Hazards: H5, H6 (CTRL-0003-5). Backlog: `PLT-CORE-04`. Closes with the WP-0.3 cell slice after WP-0.2 (DN-040).
- **KA – back-dated appends refused:** no back-dated entry can be written until the WP-0.4 policy decision point issues decisions; this fails closed. Hazard: HAZ-0010 (CTRL-0010-4). Backlog: `PLT-CORE-01`, `TRU-BCP-03`. Closes with WP-0.4.

*New hazard*
- **HAZ – a domain event is lost, duplicated, reordered or silently stuck between the journal and its consumers.** Seeded hazards: H6, H5, H15.
  - **Description:** a committed change never reaches a consumer (Hub, tasks, RCM, analytics), reaches it twice and is applied twice, overtakes an earlier event for the same patient, or waits in a dead-letter queue nobody owns. Examples: a charge posted twice, an A08 before its A01, a task never created.
  - **Causes:** an outbox write outside the state-change transaction; a non-idempotent consumer; a partition key other than the patient; a change of a topic's partition count; an unowned or unalarmed dead-letter queue; a replication slot dropped or lagging.
  - **Proposed controls:** the outbox write in the same transaction; at-least-once delivery with idempotent consumers keyed on the CloudEvents id; per-patient keys and fixed partition counts; owned dead-letter queues that park their key, raise an owned task and alarm 5 minutes after the first failure; replay from the journal; a replication-slot lag alarm.
  - **Planned verification:** `IntegrationTest:events-per-patient-order-idempotent-consumers`, `PropertyTest:idempotent-consumer-at-least-once`, `ChaosTest:broker-loss-no-event-lost`, `ChaosTest:dead-letter-alarm-within-5-minutes`, `IntegrationTest:outbox-debezium-cloudevents`.
  - **Owner:** platform-journal-squad [P]. Initial risk is left for CSO triage.

*New ADR*
- **ADR – event payload schema language and compatibility mode.** Proposal: JSON Schema in Apicurio, with full transitive compatibility within each major version, tolerant readers, and breaking changes only as a new major published in parallel for at least 12 months. Context: §5.3 fixes Apicurio and "backward-compatible evolution only", but not the schema language or which direction "backward" protects. Under at-least-once delivery with replay, both directions matter. These are long-lived contract decisions with every consumer.

No DN items are proposed.

**Disagreements and notes on the shared architecture**
1. Kernel libraries cannot depend on modules, so the journal API uses raw UUIDs for tenant, facility, patient and actor. I recommend `hms.kernel.ids` provide these four typed ids. `TransactionContext` would fit better in a shared `hms.kernel.tx` than in the journal, because every module's repositories will need it.
2. I added `source = system` beyond the §5.3 B list, for platform-made changes such as `TaskOrphaned` timers. I also added J-13: an aggregate's patient is fixed at creation, so its events never change partition.
3. The `rcm` satellite's own journal is handled by a Flyway placeholder `${journalSchema}`.
4. I suggest adding `io.cloudevents..`, `io.debezium..` and `io.apicurio..` to `HmsArchitectureRules.FRAMEWORK_PACKAGES`, so no domain package can use them.
5. Row-level security in every topology, test-fixture placement and the linter in arch-rules all touch build-logic and other modules' migrations, so they are your call.
6. The WP-0.3 platform event names in catalogue §4 (TaskCreated/Claimed/Reassigned/Escalated/Completed/Cancelled/Orphaned, EnterpriseNode*, SettingChanged, ChangeSetApplied, BundlePromoted, BundlePromotionRefused, FeatureFlagChanged, KillSwitchEngaged/Released) are proposals. The sibling module specs win, and catalogue.md must be corrected to match them. I gave `SettingChanged` to `platform-tenancy`, which owns the configuration chain in your layout.
7. I agree that CloudEvents `time` is the recorded time. The spec explains why and puts clinical time in `validfrom`/`validto` with its original offset. No other disagreements.
===== tenancy
Files written:
- C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-tenancy.md (601 lines; nothing else touched)

**API summary (`hms.platform.tenancy.api`)**
- Ids are typed value classes: `TenantId`, `NodeId`, `LegalEntityId`, `FacilityId`, `DepartmentId`, `UnitId`, plus `UserRef` (a placeholder until WP-0.4), `ChangeSetId` (issued by platform-config), `CountryPackId` and `SettingKey`. There are also the enums `NodeKind`, `Axis` and `ConfigLevel` (VENDOR_FOUNDATION … USER).
- `EnterpriseDirectory`: `node`, `ancestors`, `children`, `contextOf`. Each takes `AsOf(validAt, knownAt?)`. `contextOf` maps any node onto a `ResolutionContext(tenant, legalEntity?, facility?, department?, unit?, user?)`: a bed or room maps to its unit, a building or floor to its facility, a service point to its organisational parent.
- `ConfigurationReader.resolve(definition, context, AsOf)` returns `Resolved(value, Provenance)`, `NotConfigured` or `Refused`. `Provenance` gives the level, the scope, the entry or definition default with its change set and recorded time, and any masked entries.
- `CalendarReader.businessCalendar(context, AsOf)` assembles `hms.kernel.time.BusinessCalendar` from the settings and the facility's zone.
- `EnterpriseStructureCommands` has create, update, move and retire. There is no delete. Results are sealed `NodeCommandResult` values.
- `ConfigurationCommands.apply(ApplyConfigurationChanges)` applies an ordered batch of SetValue, ClearValue, ApplyLock and RemoveLock under one `ChangeSetId`. The batch is all-or-nothing. A refusal is a typed `WriteRefusal` per change, from W-1 to W-15. Examples: `BelowLock`, `LooserThanParent`, `VendorLocked`, `LevelNotAllowed`, `GovernedEvidenceMissing`, `RetroactiveNotAllowed`.
- `SettingDefinition<T>` has key, type, owner, allowedLevels (a write rule and also a read filter), lockableAt, `SafetyClass`, `VendorLock` (None / Fixed / TightenOnly(strictness)), vendorDefault, changeControl and sources. `SettingCatalogue.register` enforces the definition rules D-1 to D-8.
- Read rules:
  - Values below a lock or at a level the definition does not allow are ignored.
  - For an ordinary key, the most specific value wins.
  - For a tighten-only key, the strictest value on the chain wins.
- Clinical tier: key `platform.tenancy.clinical-tier`. It can be written only at the vendor and facility levels, the change is governed, and the vendor default is CORE [P]. Tier 2 activation is kept out of the chain by refusing the reserved namespace `tier2.`.
- Events, keyed by tenant: `HierarchyNodeCreated`, `HierarchyNodeUpdated`, `HierarchyNodeMoved`, `HierarchyNodeRetired`, `SettingValueChanged`, `SettingLockApplied`, `SettingLockRemoved`.

**Proposed items (the spec labels them T1–T8; you assign the real numbers)**
- **OQ-T1 – where the shared ids live.** `TenantId`, `FacilityId` and `CommandContext` appear in every command (§6.2) and on every row (§5.3, §6.4). The journal is a kernel library and needs them, but it cannot import a module. Proposal: put them in the kernel (`hms.kernel.ids` or `hms.kernel.context`). The partition key for events not tied to a patient (proposed: tenant id) belongs to the events spec.
- **OQ-T2 – hierarchy shape choices to confirm with real master data in WP-1.1:**
  - a unit always has a department, and departments do not nest;
  - there is no campus level (R08 §5 has one, §7 item 1 does not);
  - a room sits only under a unit;
  - a service point's organisational parent is a department or facility, and its physical parent is a floor or unit;
  - a cost centre sits under a legal entity;
  - there is one country pack per tenant. A group spanning the Kurdistan and federal Iraq packs (§11.10) would need a pack per legal entity or facility.
  - Owner: the implementation lead, with the first customer's enterprise-structure data (R11 §16).
- **OQ-T3 – who owns the bed.** §8.2 puts the location tree, including bed operational status, in platform-tenancy. §5.2 and §8.4 give beds to adt. Proposal: tenancy owns the bed as a location node with its structural attributes; adt owns bed status and occupancy (the §8.4 state machine and the exclusion constraint, §9.12).
- **OQ-T4 – calendar keys and levels.** ASSUMPTIONS.md names the pack items `kri.calendar.weekend` and `kri.calendar.holidays`. Proposal: generic keys `calendar.weekend-days` and `calendar.holidays`, with the Kurdistan pack supplying their country-pack values under those `kri.*` item names. Open: tenant level only (§7 item 1, §11.7 "tenant calendars"), or facility as well? The definitions move to platform-i18n when that module exists (§5.2).
- **OQ-T5 – clinical tier default and evidence check.** Proposal: vendor default CORE (K-24: Core first is the normal entry), with no tenant or pack default, so a new facility never inherits CLINICAL_SAFETY without its own evidence. Open: who builds the `GovernedChangeVerifier` that checks the RG1–RG4 evidence (WP-0.9 release evidence, or `IMP-RDY-01`)?
- **OQ-T6 – SIs with no configurable parameter.** The hazard log plans `config-chain-vendor-lock-SI-nn` for all 21 SIs, and some (for example SI-06) may have no parameter. Proposal: the test harness fails when an SI has no definitions, unless the SI is on a reviewed list with a reason. Such a control is then verified by the catalogue rule (no definition may weaken it), not by an empty pass. The CSO should confirm this reading.
- **OQ-T7 – user-level settings.** Who may write another user's settings: the user only, or an administrator too?
- **OQ-T8 – the tightening side of SI-18.** CTRL-0018-1 says "a tenant may tighten it" for Tier 2 activation. Proposal: that tightening is the function's kill switch in platform-config (SI-19; §10.2), never a value in this chain. platform-config's spec agrees: its kill-switch state is not a chain setting.
- **KA-T1:** tenancy has only in-memory repositories in WP-0.3's first pass. The exit criterion "a locked setting cannot be overridden below its lock" is shown at domain level only; `IntegrationTest:config-chain-lock-persisted` waits for the cell (DN-040).
- **KA-T2:** `TenancyAuthorization` and `TenancyAudit` have no production adapters before WP-0.4. Deployed wiring denies every structure and configuration write, so it fails closed.
- **KA-T3:** no `GovernedChangeVerifier` exists, so deployed wiring refuses every governed change. No facility can move from CORE to CLINICAL_SAFETY until it is built.
- **KA-T4:** `UserRef` is an opaque placeholder until trust-identity (WP-0.4) provides the user id type.
- **HAZ-T1 – the configuration chain resolves an unintended value for a safety-relevant setting.**
  - Description: a context resolves a value that no authorised decision intended: a looser SI parameter, an override below a lock, or another facility's clinical tier.
  - Causes:
    - a lock hiding a stricter lower value;
    - a later tightening by the vendor or a parent that leaves an older lower value looser;
    - a unit whose physical and organisational facilities disagree;
    - a resolution context that does not match the hierarchy;
    - a retroactive change rewriting what applied in the past;
    - a race between a parent's lock and a child's write;
    - a stale cache (later).
  - Effects: an SI or a fallback control is weakened at one scope without a decision (for example a later orphan alarm, H5, or a delayed escalation, H4). A unit of a CORE facility may be treated as CLINICAL_SAFETY, or the reverse (H2).
  - Seeded hazards: H2, H4, H5.
  - Controls: D-2 to D-6; W-4 to W-7, W-10, W-11, W-14; read steps 3 and 5; H-7; the `InconsistentContext` refusal; one version per tenant aggregate.
  - Verification: the spec's property tests (lock, tighten-only, lock never loosens, as-was, clinical tier, hierarchy invariants, tenant isolation) and `IntegrationTest:config-chain-lock-persisted`.
  - Initial risk: my proposal is severity major, likelihood remote (medium on the log's matrix); triage is the CSO's.
- **Tightenings to record in `docs/safety/README.md`.** All are [P] and fall under the CTRL-00nn-1 controls unless noted:
  1. Safety-classified settings never have a user level.
  2. A tighten-only write is checked against the parent's effective value, not only the vendor's.
  3. A tighten-only read returns the strictest value on the chain.
  4. A vendor foundation value looser than the coded default is refused.
  5. Governed locks are not allowed on tighten-only keys, so a lock can never loosen a value.
  6. Safety-classified keys cannot be changed retroactively (CTRL-0010-1).
  7. The `tier2.` namespace is reserved (CTRL-0018-1).
  8. The clinical tier has no tenant or pack default, and a change without accepted evidence is refused (CTRL-0005-14).
  9. Reads ignore values below a lock or at a level the definition does not allow.
- **DN / ADR:** none.

**Disagreements with the shared architecture and interface points**
1. **Calendar keys.** The architecture names `kri.calendar.weekend` and `kri.calendar.holidays` as the keys. A country prefix in product code means one key per country, so I propose generic keys with the pack supplying the values (OQ-T4). platform-config's spec uses `kri.calendar.weekend`; the two need aligning.
2. **Who holds setting definitions.** My spec keeps a `SettingCatalogue` in tenancy. platform-config's spec proposes a `SettingDefinitionLookup` in tenancy.api that its typed registry implements. Either works; please pick one so there is a single store of definitions.
3. **Shape of the write API.** platform-config's spec expects a single `write(change)` and `ancestors(ScopeRef)`. I specified a batch `apply` that writes the whole change set or nothing, and per-axis `ancestors` plus `contextOf`. platform-config may need a small `chainOf(context)` query added. The definition fields also differ in names: their `LockPolicy` is my `allowedLevels` plus `VendorLock`, and their `assumptionRef` is my `sources`.
4. **Aggregates.** I made the enterprise structure and the tenant configuration one aggregate each per tenant [P], so concurrent writes are serialised. This goes slightly beyond "optimistic concurrency per aggregate".
5. **Test fixtures.** The vendor-lock property harness and an in-memory chain ship as test fixtures in package `hms.platform.tenancy.api.testing` [P]. That keeps the rule that other modules use tenancy only through its `api` package.
===== config
**Files written**
- `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-config.md` (about 730 lines). I aligned it with the tenancy spec `docs/specs/modules/platform-tenancy.md` after that spec appeared.

**API summary (`hms.platform.config.api`)**
- `ConfigRegistry`: registers content types (`ContentTypeDefinition`) and flags (`FlagDefinition`). Setting definitions stay in tenancy's `SettingCatalogue`, and each flag registers a backing setting `flag.<key>` there. Flag kinds are `CDS_RULE`, `CLINICAL_BEHAVIOUR` and `OPERATIONAL`. Every flag has a kill switch by construction, and a safety-relevant flag must default to OFF or registration is refused.
- `FlagEvaluator.evaluate(key, ResolutionContext, AsOf) -> FlagDecision`. An unknown flag is OFF. A kill switch engaged at the scope or any parent scope wins over any value. A Tier 2-bound flag is also OFF unless the Register says cleared or not-required, and OFF while the Register is missing.
- `KillSwitchCommands.engage/release` on a `ConfigScope` (tenant down to unit, never user). The reason is a `ChangeReason` that cannot be blank or defaulted. Every change produces a `FlagAuditRecord`.
- `ChangeSetCommands`: submit, recordApproval, reject, withdraw, apply. States go SUBMITTED to APPROVED, REJECTED or WITHDRAWN, then APPLIED or STALE. Approval comes only from evidence that `HumanApprovalSource` confirms, and the author cannot approve their own change set. Applying checks that every `before` value is still current. Writes go only through tenancy's `ConfigurationCommands.apply`.
- `BundleCommands.build/activate`: full-snapshot bundles per stream (`VENDOR_FOUNDATION`, `COUNTRY_PACK:kurdistan`, `TENANT_OVERLAY:<tenant>`). Each has a manifest, a canonical JSON subset written in pure Kotlin, SHA-256 hashes and an Ed25519 signature from the JDK. Activation runs gates G1–G12: signature, integrity, anti-rollback, lineage (BUILD → TEST → TRAIN → PROD, PLAY is a dead end), schema, references, locks, synthetic items block TRAIN/PROD, human approvals, content checks, flags and Tier 2. Activation is atomic.
- `OverlayMerge.merge(base, overlay, newBase) -> MergeResult`: every tenant override appears in exactly one finding. A tenant tightening is kept while it stays stricter. A conflict on a safety-relevant key is never resolved automatically. For a `Fixed` key the vendor value wins.
- Ports defined here, all failing closed until their real adapters exist: `HumanApprovalSource`, `BoundaryRegisterPort`, `TerminologyValidationPort`, `ConfigAuthorization`, `ConfigAudit`, `BundleSigner`, `TrustStore`, `PromotionLedger`.

**Proposed items (to be numbered)**

*Hazards*
- **HAZ A: Tampered, unsigned, rolled-back, synthetic or unapproved configuration is activated.**
  - Seeded hazards H2, H4, H6; invariant SI-19 plus the §19.4 gate; modules platform-config and content; features PLT-CFG-01, PLT-CFG-02.
  - Initial risk (my proposal, not an acceptance): major / remote / medium.
  - CTRL-A-1: gates G1–G4; an empty trust store fails closed; the trust store ships only in the signed release.
  - CTRL-A-2: the synthetic gate G8.
  - CTRL-A-3: approvals only from human evidence.
  - CTRL-A-4: atomic activation.
  - CTRL-A-5: deterministic canonical form.
  - Tests: `PropertyTest:bundle-any-altered-byte-refused`, `UnitTest:bundle-untrusted-or-revoked-key-refused`, `UnitTest:empty-trust-store-refuses-every-bundle`, `PropertyTest:bundle-anti-rollback`, `PromotionGate:synthetic-item-blocks-train-and-prod`, `PropertyTest:change-set-approval-only-from-human-evidence`, `IntegrationTest:bundle-approvals-only-from-sign-off-records`, `PropertyTest:refused-activation-changes-nothing`, `PropertyTest:canonical-serialisation-deterministic`.
- **HAZ B: An upgrade merge silently loses or loosens a tenant's safety setting.**
  - Seeded hazards H2, H4; the SI preamble (tighten, never loosen); modules platform-config and platform-tenancy.
  - Initial risk (my proposal): major / occasional / high.
  - CTRL-B-1: the merge rules. CTRL-B-2: a bundle cannot be built while a blocking merge finding is open. CTRL-B-3: gate G7 re-checks locks and tighten-only on the merged result.
  - Tests: `PropertyTest:merge-never-drops-a-tenant-value-silently`, `PropertyTest:merge-tightening-kept-while-stricter`, `PropertyTest:merge-safety-conflict-never-auto-resolved`, `UnitTest:bundle-build-refused-with-unresolved-merge`, `PropertyTest:merged-overlay-passes-lock-gate-or-is-refused`.
- **HAZ C: A kill switch switches off a safety rule or behaviour without authority, review or anyone noticing.**
  - Seeded hazards H2, H4; invariants SI-19, SI-14.
  - Initial risk (my proposal): major / remote / medium.
  - CTRL-C-1: permission and step-up authentication, reason never defaulted.
  - CTRL-C-2: every engagement raises an owned task to the flag owner and the CSO.
  - CTRL-C-3: a kill switch never retires a rule.
  - CTRL-C-4: engaged switches are listed wherever the flag is shown.
  - Tests: `PropertyTest:SI-19-flag-change-reason-never-defaulted`, `UnitTest:kill-switch-engage-needs-permission`, `IntegrationTest:kill-switch-engagement-raises-owned-task`, `UnitTest:kill-switch-never-retires-a-rule` (also proposed as an addition to CTRL-0014-7), `AcceptanceTest:engaged-kill-switches-listed`.

*Open questions*
1. **CSO:** what engaging a kill switch on a Tier A hard stop or Tier B baseline rule requires (second person, CSO only, time limit, compensating manual check). Interim default: anyone with the engage permission, with step-up, a reason and the highest-priority owned task to the rule owner and CSO; the rule's registry status is untouched.
2. **CSO and Trust Plane:** who may engage and who may release, per scope. Default: separate permissions, and release needs a linked review reference.
3. Kill-switch engagement when the policy decision point is down. Default: refused.
4. The maximum time for a kill switch to reach every node of a cell (`platform.config.killswitch.max-propagation`). No source sets it; to be set with the WP-0.2 cell.
5. A vendor-signed, fleet-wide kill-switch directive that skips promotion. Default: not built; hospitals engage locally after a field safety notice.
6. PLAY is a dead end: nothing is promoted out of it. Confirm.
7. The author of a change set cannot approve it. Confirm, or name the exceptions.
8. Non-safety merge conflicts: may an owning module declare "keep the tenant value"? Default: every conflict blocks until a human resolves it.
9. Does SI-19 clause b also govern safety-relevant setting values in bundles, not just flags? Default: such items need CSO approval, as C1 flags do.
10. Who verifies that a flag declared `OPERATIONAL` really has no clinical effect. Default: the owning module's hazard analysis; listed in the Release Evidence Pack.
11. Confirm the canonical JSON subset, and whether to claim RFC 8785 conformance for it.
12. No configuration value changes in TEST, TRAIN or PROD outside bundles, except kill switches and user preferences. Confirm.

*Known anomalies*
- The production trust store is empty and the production `BundleSigner` returns SIGNING_UNAVAILABLE, so no bundle can be built or activated outside tests.
- The runtime `HumanApprovalSource` returns "no approval" until WP-0.4 and the signature-provider port (OQ-005).
- `BoundaryRegisterPort` fails closed, so every Tier 2-bound flag is OFF and the fallback control sets stay in force (until WP-0.9).
- `TerminologyValidationPort` fails closed, so any item with codes fails gate G6 (until WP-1.1).
- `ConfigAuthorization` is deny-all in production wiring, and audit goes to the journal only, with no BALP events (until WP-0.4).
- Configuration state is in memory only, and kill-switch propagation across a cell's nodes is unproven (later schema slice and the WP-0.2 cell).

*ADR (proposed): configuration bundle signing and trust.* Ed25519 through the JDK provider; two key roles (vendor content, tenant configuration); the trust store shipped in the signed release; rotation and revocation; anti-rollback per environment and stream; how promotion records travel between environments; key custody aligned with ADR-008. Reopen if a rule or buyer requires another algorithm or a transparency log.

*DN [HUMAN]: production custody of the configuration-signing keys* (§4.3). It blocks activation outside tests, not WP-0.3's domain work.

*Tightenings to record* (§3.4 item 1)
- Kill switches cover `OPERATIONAL` flags too, not only CDS and clinical flags.
- No kill switch and no safety-classified flag at USER level.
- Every kill-switch engagement raises an owned task.

**Where I depart from the shared architecture, or need a decision**
- **Setting definitions:** tenancy keeps them in its `SettingCatalogue`. I followed that, so the config registry holds only content types and flags and reads settings from tenancy. The shared architecture puts every definition in the config registry; the integrator should confirm which one stands.
- **Reason type:** tenancy's `ApplyConfigurationChanges.reason` is a `String`; this spec uses a `ChangeReason` value class that cannot be blank. One type should win, placed in the kernel next to `CommandContext` (tenancy OQ-T1).
- **Event keys:** config events carry no patient, so I key them by tenant, matching tenancy. The events spec needs to own the rule for patient-free events.
- **Promotion between real environments:** checking that a bundle passed the earlier environment needs a promotion ledger that crosses deployments. That is not covered by the shared architecture; I folded its transport into the key ADR.
===== tasks
Files written:
- `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-tasks.md`
- `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\state-machines\task.yaml`

`sh tools/hms safety check` still passes with `task.yaml` present (state_machine_specs=1, approval_fields_filled=0). A separate script found no unknown or unused predicates and confirmed every `from`/`to` is a declared state or `"(start)"`. `sh tools/hms repo check` fails only on three branch names that already existed (`t3/state-machines-invariants`, `t3/wp-0-3-platform-kernel`, `t3/wp08-documents-printing`). Neither of my files is involved.

**API summary (`hms.platform.tasks.api`, version 1):**
1. **`TaskCommands`**: `create`, `claim`, `release`, `reassign`, `complete`, `completeByFocusOwner`, `cancel`, `raiseDeadLetterTask`. Every command takes a `CommandContext` and returns a sealed result: `CreateTaskResult` (Created or Rejected with a `CreateRejection`) or `TaskCommandResult` (Applied or Refused with a `TaskRefusal`). Commands are idempotent on the idempotency key.
2. **`CreateTask`** holds kind, facility, optional patient, optional encounter, focus, owner, SLA, priority (ROUTINE/URGENT/ASAP/STAT) and an escalation request (KindDefault, Policy or Explicit). Owner, SLA and reason are nullable on purpose so the domain itself refuses a missing value, whatever the channel.
3. **`Owner`** is `Person(UserRef)`, `Pool(PoolId)` or `Queue(QueueId)`. The holder is the claimant when claimed, otherwise the owner. `SlaSpan` is `Continuous(Duration)` or `BusinessDays(Int)`.
4. **`WorkRoutingCommands`** manage pools, members, queues, monitors and retirement. A change that would leave live work unroutable is refused with `WouldLeaveWorkUnroutable`.
5. **`TaskQueries`**: `task`, `worklist` (cursor paging), `tasksForFocus`, `overdue`, `openOrphanEpisodes`.
6. **Ports**: task, routing, scan-watermark and idempotency repositories; `JournalAppend`; `RoutingDirectory`; `TaskSettings` (reads tenancy's `ConfigurationReader` and `CalendarReader`); `TaskAuthorization` (fails closed in production); `OperationalAlarms`. In-memory adapters are refused outside the dev and test profiles.
7. **Events**: TaskCreated, TaskClaimed, TaskReleased, TaskReassigned, TaskCompleted, TaskCancelled, TaskSlaBreached, TaskEscalated, TaskOrphaned (the §8.5 name), TaskOrphanCleared. Keyed by patient when there is one, else by task id.
8. **Orphan bound**: a scan runs every S, with grace G and scan budget B. Configuration requires S + G + B ≤ L, where L = 5 min, vendor-locked and tighten-only. Defaults [P] are S = G = B = 1 min. Each episode raises one TaskOrphaned, one alarm task owned by the facility's fallback supervisory queue, and one operational alarm. It clears when ownership is restored or the task finishes.

**Proposals for the integrator to number (full text in §14 of the spec):**
- **Decision for the CSO, "calendar-aware" safety timers.** §7 item 1, §9.7 and BP §6.7 list calendar-aware timers, and BP §6.7 includes escalation and orphan alarms. Reading in use: safety-relevant timers (orphan alarm, clinical SLAs, escalation) run on continuous time and are never paused by weekends or holidays. The calendar changes who receives the work, not when. Only kinds configured as not safety-relevant may use business time. This is stricter than pausing, so it is also a tightening under CTRL-0003-5 and CTRL-0004-5.
- **Decision for the CSO, SLA start of back-entered work.** Default: the SLA runs from the paper time (stricter), and the task is labelled back-entry (SI-10). Option: run it from entry time and use a separate back-entry review queue. An outage could produce many tasks that are due at once.
- **OQ: approvers of `task.yaml`.** §8.4 names none. Proposed: CSO, nurse panel, physician panel. Lab and pharmacy panels may want a say.
- **OQ: claims held by a deactivated person.** Default: the orphan alarm only. Option: release the claim to the owning pool or queue automatically.
- **OQ: SLA pause and resume** for §9.23 pre-approval clocks. Not in WP-0.3; it would apply only to kinds that are not safety-relevant.
- **OQ: business-time granularity.** L-20 gives no working hours, so business SLAs count whole business days.
- **OQ: platform-tasks and platform-tenancy.** The §5.2 table lets platform-tasks call only Trust and the journal, but it must read its settings through tenancy's api. Proposal: every module may read configuration through that api.
- **OQ: cross-key constraints in setting definitions.** S + G + B ≤ L spans four keys, and tightening L alone can break it. Proposal: a setting definition can name a cross-key constraint that writes are checked against. Until then the module checks on read and falls back to G = 0, S = B = L/3, with the alarm `OrphanSettingsInconsistent`.
- **OQ: one kernel `CommandContext`.** The same question as tenancy's OQ-T1.
- **Content request:** CSO-approved escalation policies, the facility default policy, and the SLA and escalation of `platform.task-orphaned` and `platform.dead-letter` tasks. Until then, synthetic samples marked NOT FOR CLINICAL USE.
- **ADR: how work becomes a task across the Safety Kernel boundary.** Kernel modules (orders, medications, results) create tasks in their own transaction. Every other module writes `TaskRequested` to its outbox; this module consumes it idempotently on the CloudEvents id, and failures dead-letter into owned tasks.
- **KA:** task persistence is in memory only in WP-0.3 (no `tasks` schema). HAZ-0003, PLT-CORE-07.
- **KA:** the chaos test, the scan scheduler, the replica lock and the detector watchdog wait for the cell. The 5-minute bound is proven only on a simulated clock. CTRL-0003-5.
- **KA:** routability knows only active and inactive accounts. There is no absence, surrogate or roster handling yet, and the Trust adapter arrives in WP-0.4. HAZ-0003, HAZ-0017.
- **KA:** no policy enforcement or read audit until WP-0.4; the production authorisation adapter denies everything.
- **KA:** operational alarms have no transport until the cell's OpenTelemetry pipeline exists.
- **New causes and controls for HAZ-0003:**
  1. Cause: the orphan detector or the timer service stops or falls behind, so orphaned work raises no alarm. Control: scan heartbeat and overrun alarms, plus a watchdog outside the scanning process that alarms within 5 minutes when no scan completes (`ChaosTest:orphan-detection-stall-alarms`).
  2. Cause: the fallback supervisory queue has no routable monitor. Control: a facility without a fallback queue is refused; an unroutable fallback queue raises an operational alarm, never a second task (`UnitTest:fallback-queue-unroutable-raises-operational-alarm`).
  3. Cause: mass orphaning (a directory outage or mass deactivation) floods supervisors with alarms. Control: the operational alarm aggregates per facility and reason, while each episode still gets its own task (`UnitTest:orphan-alarms-aggregate-per-facility`).
- **Tightenings for `docs/safety/README.md`:**
  - a routing directory that cannot answer counts as unroutable;
  - an owner unroutable at creation alarms at once, with no grace;
  - terminal escalation owners are pools or queues, never one person;
  - an unroutable escalation target is skipped to the next step at once;
  - safety-relevant timers are continuous.

**Disagreements or gaps in the shared architecture:**
- **Build file.** `backend/modules/platform-tasks/build.gradle.kts` depends only on ids, time and events. It also needs `:platform:journal` and the platform-tenancy api project (the integrator's file).
- **Dead-letter alarm age.** I did not declare my own key. The spec reads the setting `hms.kernel.events` declares, as the journal spec assigns it (`envelope.md` §10). The events spec should also name the dead-letter sink port that this module implements.
- **`UserRef`.** The spec uses tenancy's placeholder `UserRef` rather than defining a second one.
- **State-machine explanation.** The state-machines README expects a `task.md` explanation beside `task.yaml`. It was not assigned to me; the explanation lives in §3–§4 of the module spec.
- **Ambiguous source text.** The integrator's rule that safety timers are continuous agrees with the hazard log (HAZ-0004 cause "including at weekends and holidays"; §9.7 acceptance 3). BP §6.7 lists "orphan alarms" among calendar-aware timers, so I raised it as the CSO decision above rather than diverging silently.
===== workflow
I wrote one file: `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-workflow.md`. No other files were changed and no git command that changes state was run.

**API summary (`hms.platform.workflow.api`):**
- `WorkflowPort` has four operations: `start(context, StartWorkflow)`, `signal(context, WorkflowRef, WorkflowSignal)`, `status(context, WorkflowRef)` and `cancel(context, WorkflowRef, CancelReason)`. There is deliberately no "start and wait for the result" operation.
- The workflow id is derived from `WorkflowRef(tenant, type, key)`. `BusinessKey` is `aggregateType`, `aggregateId: UUID` and `attempt: Int`; the attempt is always set by the caller, never defaulted. One instance may exist per ref, ever (reject duplicate).
- `WorkflowArguments` can hold only identifiers, codes, counts and instants. Free text cannot be expressed, so workflow history holds no clinical content.
- Results are sealed types: `StartResult` (Started / AlreadyExists / Rejected), `SignalResult` (Delivered / AlreadyDelivered / NotFound / NotRunning / Rejected), `StatusResult` (Found / NotFound) and `CancelResult` (CancelRequested / AlreadyClosed / NotFound / Rejected).
- `WorkflowEngineUnavailable(detail)` is a member of all four result types. On `start` it means "outcome unknown"; a retry with the same key is safe.
- `WorkflowStatus` is Running(cancelRequested) / Completed / Failed(reasonCode) / Cancelled(reason). `CancelReason` must not be blank. `WorkflowProblem` is an enum of rejection reasons.
- Inside the module: `WorkflowGateway` (application layer) checks the input and the type registry before it calls a `WorkflowEngine` SPI. In WP-0.3 `app-hms` wires only `UnavailableWorkflowEngine` (fail-closed), and the choice is made in code, never by a setting. `InMemoryWorkflowEngine` lives in `src/test` only. `WorkflowAuditPort` is a port only.
- New arch rule (e) `safetyKernelNeverUsesWorkflow`: `hms.orders..`, `hms.medications..`, `hms.results..` and `hms.platform.tasks..` never depend on `hms.platform.workflow..`. Its fixture test is `SafetyKernelWorkflowRuleTest`. The test names are `ArchTest:safety-kernel-never-uses-workflow`, `UnitTest:workflow-port-contract-fail-closed`, `UnitTest:workflow-port-contract-in-memory`, `UnitTest:workflow-gateway-validation` and `PropertyTest:workflow-start-idempotent-by-business-key`.
- Tests that wait for the cell: `IntegrationTest:workflow-port-contract-temporal`, `IntegrationTest:workflow-replay-determinism`, `IntegrationTest:temporal-postgresql-restart-keeps-workflows` and `ChaosTest:workflow-engine-loss-clinical-work-continues`.

**Proposed items (all unnumbered):**
- **OQ-W1 (backlog ID):** Appendix A has no feature ID for §7 item 6, but the known anomaly below needs a backlog ID (§3.5). Proposal: a [P] backlog item for the workflow port under WP-0.3, or carry it under `PLT-CORE-07`'s work package without a feature ID.
- **OQ-W2 (where shared types live):** `TenantId`, `ActorRef` and `CorrelationId` are needed here. §5.2 lists no synchronous dependency for `platform-workflow`, and kernel libraries (the journal) need `TenantId` too, which a kernel library cannot import from a module. Proposal: put them in the kernel (`hms.kernel.ids` or a small command-context library), not in `hms.platform.tenancy.api`.
- **DN-W1 (touches ADR-010's guard, so stop-and-ask item 2):** where workflow definitions live and in what form. Rule (c) allows Temporal types only in `hms.platform.workflow.infrastructure`, so Temporal-native definitions for `rcm`, `adt` and `migration` would all have to live in this module, which would then import those modules (and `rcm` is a separate deployable). Options:
  1. Engine-neutral definitions (steps, signal waits, durable timers) declared through a small contract in `hms.platform.workflow.api` and run by the adapter. This keeps the C9 fallback and a fork free of definition rewrites.
  2. Temporal-native definitions in each owning module's own `..workflow.infrastructure..` package, which widens rule (c).
  3. All definitions centrally in this module.

  Proposal: option 1, decided before the first workflow type (Phase 1: `RCM-INS-01` or `IMP-MIG-01`).
- **OQ-W3 (namespaces and payload protection):** one Temporal namespace per tenant (proposed) or one per cell. Also: whether payloads, already references only, are also encrypted with the tenant's envelope keys (ADR-008, `trust-keys`, WP-0.4) so crypto-shredding reaches workflow history.
- **OQ-W4 (versioning against rollback):** Temporal worker versioning against ADR-021's "migrations always roll back to N-1". Proposal: definitions change expand → contract, and the replay test runs on N and N-1.
- **OQ-W5 (how a failed or stalled workflow raises an owned task):** §5.2 lists no synchronous call for `platform-workflow`, and rule (e) forbids `platform-tasks` from importing this module. Options:
  1. Each workflow type supplies a failure activity from its owning module, which may already call `platform-tasks`.
  2. The adapter calls `platform-tasks`' api directly (a dependency §5.2 does not list).
  3. An internal event (proposed name `WorkflowFailed`) carried by a kernel-level contract that `platform-tasks` consumes without importing this module.

  Proposal: option 1 plus an operational alarm from the adapter (§6.7).
- **OQ-W6 (reconciliation after restore):** Temporal's databases and the tenant database can be restored to different points. Proposal: a reconciliation job compares open workflows with their owning aggregates and raises owned tasks for mismatches; owner WP-1.13 [P].
- **OQ-W7 (meaning of "lighter workflow persistence", K §7.4; ADR-010):** Temporal on a lighter store, or a small durable-step engine on the tenant PostgreSQL behind the same port. To be settled if WP-0.6's indicative C9 numbers show risk, and only on reference-cell evidence.
- **KA (the fail-closed stand-in):** proposed `KNOWN-ANOMALIES.md` row:
  - Description: "`WorkflowPort` has no engine yet. `app-hms` wires `UnavailableWorkflowEngine`, which answers every start, signal, status and cancel with `WorkflowEngineUnavailable` ('workflow engine unavailable, manual process required'); it never reports a workflow as started. The Temporal adapter waits for Temporal on PostgreSQL in the dev cell (WP-0.2; DN-040), and the production audit adapter for the port waits for the Trust Plane SDK (WP-0.4). No workflow type exists, and no clinical command depends on the port (rule (e); ADR-010)."
  - Hazard references: H5 (HAZ-0003), SI-03; SI-12 (HAZ-0012).
  - Backlog ID: per OQ-W1. Status: open.
  - Closes with: WP-0.3 completion after WP-0.2 (the Temporal adapter and `IntegrationTest:workflow-port-contract-temporal`).
- **New control for HAZ-0003 (not a new HAZ):**
  - Text: "Long-running processes never own people's work or Safety Kernel timers. Every human step of a workflow is an owned task in the task engine; a workflow that fails or stalls raises an owned task and an alarm; the Safety Kernel modules (`orders`, `medications`, `results`, `platform-tasks`) never depend on `platform-workflow`, so an engine outage cannot stop an order, a MAR entry or a `TaskOrphaned` alarm."
  - Type: design; covers: [b, c]; sources: §2.2 rule 6, §4.2 ADR-010, §7 items 4 and 6.
  - Planned verification: `ArchTest:safety-kernel-never-uses-workflow`, `ChaosTest:workflow-engine-loss-clinical-work-continues`.
  - Suggested new cause for HAZ-0003: "A long-running process fails, stalls or loses its engine, and the people's work it should create never appears."
- No new ADR is proposed. DN-W1 may later lead to an ADR-010 amendment.

**Where I differ from the shared architecture (raised, not acted on):**
1. **`TenantId` placement.** Importing it from `hms.platform.tenancy.api` would give `platform-workflow` a module dependency that §5.2 does not list, and kernel libraries such as the journal cannot import a module at all. I propose kernel placement (OQ-W2). The current `build.gradle.kts` depends only on `:platform:ids`.
2. **Where workflow definitions live.** Rule (c), together with the shared plan of "the Temporal adapter in `hms.platform.workflow.infrastructure`", does not say where definitions written by `rcm`, `adt` or `migration` go. This needs a decision before the first workflow type (DN-W1).
3. **The adapter could start before the cell.** `temporal-testing`'s in-process test environment would let the adapter be built and tested without the cell. Real Temporal-on-PostgreSQL acceptance would still wait. I kept DN-040's scope (the port only) and did not diverge.
4. **Rule (e) adds a guard rule.** A design element of the spec goes beyond the shared plan: "a workflow outcome is never a guard on an ADT, order, MAR or discharge command" (it keeps SI-12 and CTRL-0012-3 true). It is a spec rule only, with no test of its own yet.
