**WP-0.3 cross-spec check: inconsistencies and decision violations, with the edit that fixes each**

Paths are relative to `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\`. Items are ordered most severe first. "Fix" names the spec that should change and what it should change to.

## A. Entry timing (D10)

**1. The journal and envelope still use the old 4–5-value timing vocabulary.**
- Where: `modules/platform-journal.md` §4.1 columns `entry_timing` and `entry_label` (lines 92-93), §4.4 table (l.177-186), §5 `NewEntry.expectedTiming: EntryTimingKind`, `JournalEntry.timing/label`, `ReasonRequired`, `TimingMismatch`, SQL `entry_timing` and `entry_label_matches_timing` CHECKs (l.553-559), §18 kernel bullet (`EntryTimingKind`, `EntryLabel`). Also `events/envelope.md` §5 `entrytiming`/`entrylabel` (l.65-66), §12 `HmsEnvelope.entryTiming: EntryTimingKind, entryLabel: EntryLabel?` and the note at l.296.
- Conflict: the kernel (§6.2) has only `EntryTimingCode`, with 7 values: `CONTEMPORANEOUS, BACK_DATED, BACK_ENTRY, OFFLINE_CAPTURE, LATE_ARRIVAL, MIGRATED, EFFECTIVE_DATED`. Labels come from `EntryTimingCode.labelled` and display text keyed `entry-timing.<code>`. There is no `EntryLabel` and no `EntryTimingKind`.
- Fix (journal):
  - Replace `EntryTimingKind` with `EntryTimingCode` everywhere.
  - Make the `entry_timing` CHECK list the 7 kernel values.
  - Drop `entry_label`, its CHECK and `EntryLabel`.
  - Add a `clinical_time_source text` column with a CHECK over `ClinicalTimeSource` (kernel §14 and §21 say the journal stores it; the table has no such column).
- Fix (envelope): `entrytiming` lists the 7 codes; delete the `entrylabel` extension; `HmsEnvelope.entryTiming: EntryTimingCode`; remove `entryLabel` from `ALLOWED_EXTENSIONS` and `LOGGABLE_ATTRIBUTES`.

**2. The journal derives the entry mode differently from the kernel and has a second back-entry mechanism.**
- Where: `platform-journal.md` §4.4 step 2 (l.164), §5 `AppendRequest.backEntryRequested`, `BackEntryAuthorization`/`BackEntryDecision` (l.408-411), J-9, the fail-closed table row 2, `UnitTest:back-entry-append-refused-by-production-authorization`, KA-J3.
- Conflict: the journal maps DEVICE→INTERFACE, gives SYSTEM no mode, and selects BACK_ENTRY from a request flag plus a journal port. The kernel (§7.3) maps DEVICE→DEVICE and SYSTEM→SYSTEM, and BACK_ENTRY comes only from `CommandContext.backEntry` (a `BackEntryAuthority` that only the back-entry tooling can issue, checked by ArchUnit).
- Fix (journal):
  - Read the mode only from `context.entryMode`.
  - Delete `backEntryRequested`, the `BackEntryAuthorization` port and its refusing binding.
  - J-9 becomes: a BACK_ENTRY row requires `context.backEntry` and stores `backEntry.episode.episodeId`.
  - Re-base the back-entry fail-closed row on the kernel mechanism: `ArchTest:back-entry-authority-only-from-back-entry-tooling` plus `PropertyTest:kernel-entry-mode-derived-from-context`.

**3. Time classification metadata lives in three incompatible places.**
- Where:
  - `platform-journal.md` §4.4 "Time classes" (`CLINICAL`/`ADMINISTRATIVE` per aggregate type; an "administrative rule" outside the classifier), J-6, J-7, J-10, J-17, `ValidTimeSpec` (`Given`/`AtRecordedTime`), the `entry_system_actor` CHECK (l.569-571).
  - `envelope.md` §12 `TimeClass` and `AggregateTypeEntry.timeClass`; `CatalogueEntry` has no time kind.
  - `catalogue.md` §5 "Time class" column.
- Conflict: the kernel declares `ValidTimeKind` (`CLINICAL_CAPTURED`/`CLINICAL_AT_RECORDING`/`EFFECTIVE`) plus a `TimingClass` per event type, and uses `ValidTimeInput` (`Given(ValidTime)`/`AtRecording`). The classifier is the only classifier (D10).
- Fix (envelope §12):
  - Add `val validTimeKind: ValidTimeKind` and `val timingClass: TimingClass?` to `CatalogueEntry`.
  - Drop `TimeClass` and `AggregateTypeEntry.timeClass`.
- Fix (catalogue): replace the §5 "Time class" column with a "Valid-time kind" column per event in §4. Tenancy and config events are `EFFECTIVE`; task, pool, queue and dead-letter events are `CLINICAL_AT_RECORDING`.
- Fix (journal):
  - Replace `ValidTimeSpec` with `ValidTimeInput`.
  - Delete the administrative rule; every row goes through `EntryTimeClassifier.classify(input, kind, recorded, mode, policy, episode)`.
  - Change J-10, J-17 and the `entry_system_actor` CHECK to allow SYSTEM rows with `CONTEMPORANEOUS` or `EFFECTIVE_DATED`.

**4. Retroactive configuration changes: the kernel says `EffectiveDated` (no privilege); journal and tenancy say `BackDated` (needs a decision).**
- Where: kernel §6.2, first table row (EFFECTIVE → `EffectiveDated`). Journal §4.4 ADMINISTRATIVE paragraph and OQ-J5. `modules/platform-tenancy.md` §4.4 bullet 1, W-11, §5.7 "Mapping to EntryTiming" (l.369), `UnitTest:config-retroactive-ordinary-change-refused-without-back-dating-decision`, `UnitTest:config-null-valid-from-takes-recorded-time` ("row is Contemporaneous"), KA-T5. `modules/platform-config.md` §5.10 bullet 3 ("anything other than Contemporaneous is refused by the appender").
- Fix (kernel §6.2): add a row above the current first row: `any mode | Given, kind EFFECTIVE | start earlier than recorded | BackDated(lag) | BACK_DATED | no policy`, with requirements `BACK_DATING_AUTHORIZATION` and `USER_ENTERED_REASON`. Otherwise `EffectiveDated`.
- Fix (tenancy): a non-retroactive row is `EFFECTIVE_DATED`, not `Contemporaneous` (§5.7 and the test name/expectation).
- Fix (config §5.10): "the command states expected timing `EFFECTIVE_DATED`; any other classification is refused as `TimingMismatch`". The appender has no per-module rule.

**5. Two incompatible policy ports and lookup types.**
- Where: `platform-journal.md` §5 `EntryTimePolicies.policyFor(tenant, facility, type: AggregateType, at: RecordedTime)` with its own `EntryTimePolicyLookup {Found, Unavailable(reason)}` (l.413-416); §2 table, §3, J-7, fail-closed row 3 ("returns Unavailable"), KA-J4, §18 tenancy bullet.
- Conflict: kernel §7.6 has `hms.kernel.context.EntryTimePolicySource.policyFor(context, timingClass, at: AsOf)` returning `hms.kernel.time.EntryTimePolicyLookup {Available, NotConfigured, Unavailable, NotLookedUp}`.
- Fix (journal):
  - Delete `EntryTimePolicies` and its lookup type; use `EntryTimePolicySource` keyed by the event type's `TimingClass`.
  - Replace the `EntryTimePolicyUnavailable` violation with `EntryTimeRefused(TIMING_POLICY_NOT_CONFIGURED)`.
  - Fail-closed row 3: "the resolver answers `NotConfigured`".
  - Also: `classify(...)` at l.165 must use the kernel's 6-argument signature; "kernel `PolicySource`" (l.95) becomes "the `ResolvedParameter` sources of `EntryTimingResult.Accepted.policy`".

**6. The tenancy spec never specifies the resolver the kernel and journal rely on (D16 mechanism is missing).**
- Where:
  - Kernel §6.3 and §21 say tenancy implements `EntryTimePolicySource` in `hms.platform.tenancy.application.settings` ("to be confirmed by the tenancy specification").
  - Journal §18 says tenancy implements `EntryTimePolicies`.
  - `platform-tenancy.md` has neither, and its §3 package table has no `application.settings`.
- Fix (tenancy):
  - Add `hms.platform.tenancy.application.settings.EntryTimePolicyResolver : EntryTimePolicySource`. It resolves the four keys at `AsOf.latest(recorded)`, converts `Resolution.Resolved` and its `Provenance` into kernel `ResolvedParameter`s, and calls `EntryTimePolicy.fromResolved(..., environment)`. It answers `NotConfigured` when a definition or value is missing.
  - Add the package to §3.
  - Add the test `UnitTest:entry-time-policy-resolver-answers-not-configured`.

**7. "No tolerance definition registered" (kernel) vs "declared `configurationRequired`" (tenancy).**
- Where: kernel §6.3 "No value, no definition" ("Tenancy's D-2 requires a vendor default for every SafetyInvariant key"), §2 table row, §12.1, KA-KN4. Tenancy D-2, §5.11 last sentence, DN-T2.
- Conflict: tenancy's D-2 allows `configurationRequired` + `GOVERNED` with no vendor default.
- Fix (kernel): the owning module registers the four definitions per timing class as `SafetyInvariant`, `TightenOnly`, `configurationRequired = RequiredBecause("CTRL-0010-1")`, `GOVERNED`, no `vendorDefault`. The resolver then answers `NotConfigured`. Delete the "requires a vendor default" sentence.
- Also: each definition's `Direction.samples` (tenancy D-7) carry the kernel's synthetic ordered pairs, with source CTRL-0010-1.
- Also: the key prefix `platform.time.entry.*` breaks tenancy's grammar ("the first segment names the owner's area"). Either reserve `platform.time` in tenancy's grammar or rename the keys to `<owning-area>.entry-time.<timing-class>.*`.

**8. Task clinical times written as valid times conflict with the kernel, journal and catalogue.**
- Where: `modules/platform-tasks.md` §4.1 `workBeganAt` bullet, §5.2 "Clinical time" (l.401), §5.3 `TaskCompletionRequested` performed-at, §6 note, `CreateRejection.ClinicalTimeRefused`. `state-machines/task.yaml` predicate `clinicalTimeAccepted` and the CompleteByFocusOwner description ("performedAt as the valid time").
- Conflict:
  - Journal §4.4 and catalogue §5 say `Task` rows are administrative and a task's "performed at" is event data.
  - The intake runs as SYSTEM, and the kernel refuses SYSTEM + `Given` (`SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME`). So every request carrying `workBeganAt` or `performedAt` would be refused at intake and turn into `TaskOrphaned`.
- Fix (tasks and task.yaml): `workBeganAt` and `performedAt` are payload fields; every Task row uses `ValidTimeInput.AtRecording`. Delete `clinicalTimeAccepted` and the `ClinicalTimeRefused` cases. SLA start from `workBeganAt` waits for the back-entry tooling (keep KA-TK8).
- Fix (kernel): §2 table, §6.3 "WP-0.3 effect", §21 tasks row and DN-KN1 "Blocks" drop "task completion with a user-given `performedAt`".

**9. `ChangeReason.SystemGenerated` is never enforced by the journal.** Kernel §7.4 and §21 say the journal refuses it for non-SYSTEM actors; the journal has no rule.
- Fix (journal): add J-11b, "a `ChangeReason.SystemGenerated` reason requires actor kind SYSTEM", the violation `SystemReasonNeedsSystemActor`, and a case in `UnitTest:journal-append-rejections`.

## B. Kernel context and time API (D1, D4)

**10. `AsOf.knownAt` type: tenancy and config still say `RecordedTime?`.**
- Where: tenancy §5.7 bullets 3-4 (l.366-367) and §16 kernel bullet; config §5.10 last bullet (l.547).
- Conflict: kernel §6.1 decided `AsOf(validAt: Instant, knownAt: Instant? = null)`, with `AsOf.knownAt(validAt, recorded)` and `AsOf.latest`.
- Fix (tenancy, config): `AsOf(validAt: Instant, knownAt: Instant? = null)`. An as-was query builds it from an `Instant`, or with `AsOf.knownAt(validAt, recorded)`.

**11. `TransactionContext` is underspecified in the kernel; journal and tenancy assume more.**
- Where:
  - Kernel §7.6: `interface TransactionContext { val tenant: TenantId }` and nothing else.
  - Journal §18 assumes `tenantId`, `markRollbackOnly(cause)`, `isRollbackOnly`, a before-commit hook, an on-completion hook, and an in-memory runner in `hms.kernel.context.inmemory`. Journal J-2 and §6 step 7 depend on these.
  - Tenancy OQ-T12 assumes the context exposes the append's single recorded time.
- Fix (kernel §7.5-7.6): add
  - `fun markRollbackOnly(cause: String)`
  - `val isRollbackOnly: Boolean`
  - `fun onBeforeCommit(check: () -> Unit)`
  - `fun onCompletion(hook: (committed: Boolean) -> Unit)`
  - `InMemoryTransactionRunner` in `hms.kernel.context.inmemory` (test and dev only, D8).

  Keep the property name `tenant`; the journal uses `tenant`.
- Fix (tenancy, closes OQ-T12): do not read time from the transaction context. Build the fact rows after `append` returns, using `AppendResult.Appended.entries[0].recordedAt`, in the same transaction. Journal §6 should state that the rows carry the single reading.

**12. `RecordedTime.restore` allow-list: three different rules.**
- Kernel §6.1 and §11 `ArchTest:persistence-only-factories`: `..infrastructure.persistence..` plus `hms.kernel.journal.infrastructure..`.
- Journal §3 and §15 `ArchTest:recorded-time-restore-only-in-journal-persistence`: narrowed to `hms.kernel.journal.infrastructure` and `hms.kernel.journal.inmemory`. That would forbid the tenancy, tasks and config jOOQ adapters from reading their own `recorded_at` columns.
- `modules/platform-workflow.md` §9: "D7 permits in `..infrastructure..`".
- Fix:
  - Journal: drop the narrowing and its test; use the kernel rule.
  - Kernel: add `hms.kernel.journal.inmemory..` to the allow-list.
  - Workflow §9: the Temporal status mapping lives in `hms.platform.workflow.infrastructure.persistence`.

**13. The SYSTEM actor allow-list holds only `hms.platform.tasks.application.system..`, but other specs run as SYSTEM.**
- Where: kernel §7.2 `SYSTEM_PROCESSES`. SYSTEM is also used by:
  - journal §10.3 (the publication watermark check and automatic GAP_FILL);
  - envelope §11 and §10 (DeadLetterItem rows written by the event library);
  - config §5.7 (reconciler) and §9;
  - workflow §7 (signal relays).

  Separately, tasks never names the package `application.system` (§4.3 "System actor", §5.9).
- Fix (kernel §7.2): add `hms.kernel.journal..` (watermark check, gap fill), `hms.kernel.events..` (dead-letter rows) and `hms.platform.config.application.system..` (reconciler).
- Fix (workflow): its relays act as the user actor whose event caused them, or the kernel adds the owning modules' relay packages.
- Fix (tasks): state that `OrphanScan`, `TaskTimers`, `RequestIntake`, the relay and the dead-letter sink live in `hms.platform.tasks.application.system`.

**14. `EnvironmentClass` and `ContentProvenance` are declared twice.**
- Tenancy §6 declares its own `enum class EnvironmentClass` (l.453) and lists its own `ContentProvenance` among its api helper types (l.613). OQ-T13 proposes moving `EnvironmentClass` to `hms.kernel.context`.
- Config §4.4 declares `enum class Environment`.
- The kernel puts both in `hms.kernel.time`.
- Fix (tenancy): import `hms.kernel.time.EnvironmentClass` and `ContentProvenance`, and close OQ-T13.
- Fix (config): `typealias Environment = hms.kernel.time.EnvironmentClass`.

**15. Calendar API and keys disagree.**
- `BusinessCalendar.of`: kernel §6.4 is `of(zone, weekend, holidays: Set<LocalDate>, confirmedYears: Set<Year>)` returning `Valid | NoBusinessDayInWeek`. Tenancy §16 assumes `of(zone, weekend, holidays: Map<Year, Set<LocalDate>>)`, and tenancy §5.10 uses a refusal `HolidayOutsideItsYear` the kernel does not have.
- Confirmed years: kernel §6.4, §12.1 and §21 require a setting `calendar.confirmed-years`. Tenancy instead carries covered years inside the `HOLIDAY_CALENDAR` value.
- Locking: kernel §12.1 says the calendar keys are "lockable at COUNTRY_PACK". Tenancy §5.10 says "not lockable".
- Fix (kernel):
  - Drop `calendar.confirmed-years`; tenancy passes the value's covered years as `confirmedYears`.
  - Add `HolidayOutsideConfirmedYears` to `BusinessCalendarResult`.
  - Set the lock column to "not lockable".
- Fix (tenancy §16): adopt the kernel's 4-argument signature.

**16. Smaller kernel-facing renames.**
- Journal §5 `JournalEntry.causationId: UUID?` and envelope `HmsEnvelope.causationId: UUID?` become `CausationId?`.
- Journal §3 cites "kernel spec §10 there" for the arch rules; it is §11.
- Kernel §21 workflow row says `WorkflowCallContext`; workflow uses `CommandContext`. Fix the kernel row.
- Kernel §21 tasks row says tasks computes business deadlines with `plusBusinessDaysAtLocalTime`; tasks §4.1 re-implements the rule with `ClinicalTime.resolveLocal`. Tasks should call `BusinessCalendar.plusBusinessDaysAtLocalTime`.

## C. Safety parameters (D11)

**17. Factories, constructor visibility and the ArchUnit rule are inconsistent.**
- Where: tasks §4.6 and §8 (`OrphanTimingPolicy`/`TimerPolicy` "internal constructors", rule `ArchTest:task-safety-policies-built-only-by-resolver` restricted to `hms.platform.tasks.infrastructure.config`); envelope §12 `DeadLetterAlarmPolicy internal constructor`, `fromResolved(value, source: PolicySource)` with no environment argument.
- Conflict: kernel §3 and §6.5 require private constructors, `@SafetyParameterFactory` factories taking `ResolvedParameter`s plus `EnvironmentClass`, one rule `ArchTest:safety-parameter-factories-only-in-resolvers` over the `SAFETY_PARAMETER_RESOLVERS` allow-list, and the synthetic gate. Kernel §3 says `internal` is not an access control. `PolicySource` does not exist in `hms.kernel.time`.
- Fix (tasks): private constructors; `@SafetyParameterFactory fromResolved(..., environment)`; use the kernel rule; delete `ArchTest:task-safety-policies-built-only-by-resolver`.
- Fix (envelope): `DeadLetterAlarmPolicy private constructor`; `@SafetyParameterFactory fun fromResolved(value: ResolvedParameter<Duration>, environment: EnvironmentClass)`, which refuses synthetic provenance in TRAIN and PROD; replace `PolicySource` with `ResolvedParameter` (also in the l.296 note).
- Fix (kernel §6.5): add `hms.platform.tasks.infrastructure.config..` to `SAFETY_PARAMETER_RESOLVERS`. The dead-letter policy's resolver is the tasks package (see 23).

## D. Configuration write path and tenancy↔config API (D2, D12, D13)

**18. The change-verification port has two incompatible definitions.**
- Tenancy §6 (the owner) defines `ChangeSetVerifier.verify(tenant, changeSet: ChangeSetId, digest: ChangesDigest): ChangeSetVerdict {Verified(origin, contentProvenance, humanApproved, governedRolesApproved) | NotVerified(VerificationRefusal) | Unavailable}`, with `ChangeOrigin {AppliedChangeSet, BundleActivation(stream: BundleStreamRef, sequence, manifestHash: String)}`. `ApplyConfigurationChanges` carries `changeSet: ChangeSetId`.
- Config §3.1 and §5.7 define `ChangeOriginVerifier.verify(tenant, origin, batchDigest: Sha256): OriginVerdict {Confirmed(provenance) | Refused}`, with `ChangeOrigin {ChangeSet(id), Bundle(stream: BundleStream, ..., activation)}` carried in the command and `ApplyConfigurationChanges.digest()`. The same names appear in config INV-19, §4.7, ADR-CFG-2 and `PropertyTest:fabricated-change-origin-writes-nothing`.
- Fix (config; tenancy's names win, as config itself says):
  - Implement `ChangeSetVerifier` with tenancy's verdict.
  - Every bundle-activation batch gets its own `ChangeSetId`, and the verdict reports `BundleActivation`.
  - The digest is `ChangesDigest.of(changes)`.
  - Rename everywhere: `ChangeOriginVerifier`→`ChangeSetVerifier`, `OriginVerdict`→`ChangeSetVerdict`, `BundleStream`→`BundleStreamRef`.

**19. Config's "assumed" tenancy interfaces do not match the revised tenancy api (config §3.1 table, KA-CFG-9).**

| Config assumes | Tenancy actually has |
|---|---|
| `streamHead(tenant, stream)` | `ConfigurationQueries.lastActivation(tenant, stream): AppliedOrigin?` |
| `EnterpriseDirectory.pathOf` / `scopeByPath`, type `ScopePath` | `ScopeAddress` and `EnterpriseDirectory.resolveAddress(tenant, address, at)`; no `pathOf` (tenancy must add `addressOf(tenant, scope, at)` or config builds the address from `node().code`) |
| `entryAt(key, scope, at)`, `entries(scopeFilter, at)` | `entryAt(tenant, key, scope, at)`, `entries(tenant, filter, at)` |
| `ConfigurationReader.resolve(definition, ...)` | `resolve(key: TypedSettingKey<T>, ...)` |
| `SettingCatalogue.register` | registration is on `SettingCatalogueRegistrar.register` |
| `Strictness.isAtLeastAsStrictAs` | `Strictness.compare(a, b): Order` |
| `EvidenceRef` as a tagged union | opaque `EvidenceRef` plus `EvidenceKind` |

- Fix (config): adopt the right-hand column throughout §3.1, §4, §5.7-5.9, §7 and §8. Delete the fallbacks in KA-CFG-9 that no longer apply.

**20. Tier-2 attribute.** Config INV-6, §6.1 and G12 require a Tier-2 *restriction* variant on backing settings. Tenancy's `Tier2Binding` has only `NotTier2 | GatesTier2Function`.
- Fix (tenancy §5.3): add `data class RestrictsTier2Function(val function: String) : Tier2Binding`, which D-6 accepts (a restriction, never sufficient). Otherwise config backing settings use `NotTier2`, and `tier2Function` lives only on `FlagDefinition`.

**21. Value types and key families config needs do not exist.**
- `ROLE_SET` and a "queue reference" type for `platform.config.approver-roles.*` and `platform.config.killswitch.review-queue` (config §3.1, §12): tenancy's closed set has neither. Tasks uses `STRING(...)` queue codes. `tasks.fallbackQueue` is camelCase, which tenancy's grammar refuses.
- Content references `content.<type>.<item>` (config §5.8): tenancy says open-ended ids are content and key families are only for members known at assembly. D-13 seals the catalogue, so per-item keys are impossible, and `content` is not a reserved namespace.
- Fix (config):
  - Approver roles: `SET(STRING(role pattern))`. Review queue: `STRING([a-z][a-z0-9-]{0,62}, 63)`.
  - Reference tasks' key `platform.tasks.orphan-alarm.fallback-queue`.
  - Redesign 5.8: owning modules declare fixed keys whose value is `CONTENT_REF` (for example `orders.default-order-set`), or tenancy adds open key families to its grammar. Pick one; recommended: fixed keys.

**22. Fixed safety key with no direction and no default can never be written.** Config §12 `platform.config.killswitch.max-propagation` is `Fixed`, `SafetyRelevant`, with no vendor default and no `Direction`. Tenancy D-9 and W-6 only accept a value equal to the coded default, and there is none.
- Fix (config): declare `Direction` ("shorter is stricter") with samples citing CTRL-0019-3, and `configurationRequired = RequiredBecause("CTRL-0019-3")`.

**23. The dead-letter alarm setting has three owners and two level sets.**
- `envelope.md` §10: declared in tenancy's catalogue "on behalf of" the events library, owner `platform-journal`, level VENDOR_FOUNDATION only, min > 0.
- `platform-journal.md` §12 and §18: tenancy declares it.
- `platform-tasks.md` §8 and A-5: declared by `platform-tasks`, levels VF, CP, TENANT, FACILITY, `DURATION(PT30S, PT5M)`.
- Tenancy §5.11: does not list it.
- A `TightenOnly` key allowed only at VENDOR_FOUNDATION cannot be tightened.
- Fix: `platform-tasks` owns and declares it (it resolves it and builds `DeadLetterAlarmPolicy`) with tasks' row. Envelope §10, journal §12 and §18, and tenancy §5.11 cite tasks §8. Close OQ-TK14.

**24. `TenancyAudit` has no production binding (D8/D16).** Tenancy §10 and KA-T2 give it only an in-memory test adapter. Every refusal touching a safety key is "reported to `TenancyAudit`".
- Fix (tenancy): name a fail-closed production binding, for example `OperationalLogTenancyAudit` (PHI-free), with `UnitTest:tenancy-refusal-reaches-audit-port`. This mirrors config's `OperationalLogConfigAudit`.

**25. Permission spelling.** Tenancy §10 uses `config.change-set.apply`; config §9 (the owner) uses `config.changeset.apply`.
- Fix (tenancy): `config.changeset.apply`.

## E. Events, aggregates, keys (D6, D14, D15)

**26. Tenancy event names: catalogue vs owner.** Catalogue §4 (l.94-96) lists `HierarchyNodeCreated/Updated/Moved/Retired`, `SettingValueChanged`, `SettingLockApplied/Removed`. Tenancy §7 and §8 publish `EnterpriseNodeCreated`, `EnterpriseNodeChanged`, `EnterpriseNodeRetired` and `SettingChanged` (one row per batch).
- Fix (catalogue, which says the owner wins): replace those rows with the tenancy names; `SettingChanged` free text is `reason`.

**27. Config event names: catalogue vs owner.** Catalogue §4 (l.97-102) lists `ConfigChangeSetSubmitted/Approved/Applied/Rejected`, `ConfigBundleActivated`, `ConfigBundleRefused`, `ConfigMergeCompleted`, `FlagChanged`, `KillSwitchEngaged/Released`. Config §10 publishes `ChangeSetSubmitted`, `ChangeSetApproved`, `ChangeSetRejected`, `ChangeSetWithdrawn`, `ChangeSetStale`, `ChangeSetApplyStarted`, `ChangeSetApplyRefused`, `ChangeSetApplied`, `BundleActivationPending`, `BundlePromoted`, `BundlePromotionRefused`, `OverlayMergeCompleted`, `FeatureFlagChanged`, `KillSwitchEngaged`, `KillSwitchEngagementConfirmed`, `KillSwitchReviewed`, `KillSwitchReleased`. Config marks some as "listed" that the catalogue does not list.
- Fix (catalogue §4): list config §10's names. Fix (config §10): mark the catalogue column accurately.

**28. Aggregate types (catalogue §5, journal §18).**

| Module | Catalogue / journal say | Owner spec says |
|---|---|---|
| tenancy | `EnterpriseStructure`, `TenantConfiguration`, `ScopeConfiguration` | `EnterpriseStructure`, `TenantConfiguration`, `UserPreferences` |
| config | `ConfigChangeSet`, `ConfigBundleActivation`, `ConfigKillSwitch` | `ConfigChangeSet`, `KillSwitchBoard`, `StreamActivation`, `FeatureFlag` |
| tasks | `Task` only | also `TaskRequest`, `Pool`, `Queue` |

- Fix (catalogue §5 and journal §18):
  - Tenancy: replace `ScopeConfiguration` with `UserPreferences`.
  - Config: use config's four names.
  - Tasks: add `TaskRequest` (owner platform-tasks, writers any module, keying patient if any), `Pool` and `Queue` (keying aggregate).
  - Delete catalogue l.126, the stale note about `tenancy.EnterpriseStructure` names.

**29. Partition keys of tenancy and config aggregates violate D6 ("per tenant").**
- Tenancy §8 (l.645) and §11: key = aggregate id, with `UserPreferences` keyed by user id.
- Config §5.2 (l.389, which cites "journal J-10"; the right rule is J-14) and §10: key = aggregate id, so `ConfigChangeSet`, `StreamActivation` and `FeatureFlag` are keyed by their own UUIDs.
- The catalogue says `tenant`.
- Fix (tenancy, config): every aggregate has keying `TENANT` (partition key = tenant id). Config deletes "consumers must not assume any order across different config aggregates".

**30. `TaskRequested` model: own aggregate vs focus aggregate, and missing request events.**
- Tasks §5.3 and config §5.2: version 1 of its own `TaskRequest` aggregate; also `TaskCompletionRequested` and `TaskCancellationRequested`.
- Journal §4.8 and §4.5 example: appended "on its own aggregate (the task's focus)" as a consecutive version.
- Envelope §2: "No other request type exists".
- Catalogue §4: `TaskRequested` keyed "as its aggregate"; the two other request events are missing.
- Fix:
  - Journal §4.8 and envelope §2: "version 1 of a new `TaskRequest` aggregate"; envelope names all three request types.
  - Catalogue §4: add `TaskCompletionRequested` and `TaskCancellationRequested` (owner platform-tasks, producers any module, in-database consumer platform-tasks); keying of all three is `patient if any`.
  - Catalogue §4 also adds the eight pool and queue events: `PoolDefined`, `PoolMemberAdded`, `PoolMemberRemoved`, `PoolRetired`, `QueueDefined`, `QueueMonitorAssigned`, `QueueMonitorUnassigned`, `QueueRetired`.
  - Catalogue §4 `TaskCompleted` description: "open or claimed → done, by the focus module" (matching task.yaml).
  - Tasks §4.4 and A-3: read through `JournalTails.forConsumer("platform-tasks", {TaskRequested, TaskCompletionRequested, TaskCancellationRequested})`, not "by aggregate type".

**31. Journal reader and append names in tasks and config.**
- Tasks §5.2 and §5.9 and config §3 use `JournalReader` / `JournalReader.byIdempotencyKey`. Tasks A-3 uses `append(tx, context, entries)`.
- Journal has `JournalReaders.forModule(...)` → `ModuleJournalReader.byIdempotencyKey(tx, actor, key)` and `append(tx, context, request: AppendRequest)`.
- Several specs cite a "journal rule: an aggregate appears at most once per append" (tenancy §11, config §5.2 "journal §6 item 6", tasks invariant 7 and A-3). The journal has no such rule; its §4.5 allows consecutive versions of one aggregate, and §6 item 6 is the `meta` block.
- Fix (tasks, config, tenancy): use the journal's names, and delete the citation or change it to "this module's own rule".

**32. Dead-letter sink port and alarm source.**
- Port name: tasks §7.1 and A-5 say `hms.kernel.events.DeadLetterSink` with `raise(item, context)` and `resolved(itemId, outcome)`. Envelope §12 says `DeadLetterTaskSink.raise(tx, item)` with no queue-code context and no `resolved`. Journal §18 says `DeadLetterTaskSink`.
- Who raises the alarm: tasks §7.1 says tasks is "the one source of the §6.7 dead-letter alarm; `DeadLetterAlarmPolicy` raises no alarm of its own". Envelope §10 has its own evaluator over the failure records and says "the alarm of the next item does not depend on the sink".
- Fix (envelope): add `fun resolved(tx, itemId, outcome)` to `DeadLetterTaskSink`, and add `owningQueueCode` to `DeadLetterItem` or to `raise`.
- Fix (tasks): rename to `DeadLetterTaskSink`. Replace "the one source" with "the task's SLA breach is the primary alarm; the events evaluator over failure records is the independent backstop when the sink is unavailable (D15)".

**33. The kill-switch review task: config and tasks disagree on owner, SLA, refusal path and kind registration.**
- Owner: config §6.3 says the queue in `platform.config.killswitch.review-queue`. Tasks §7.5 says "the flag owner's queue code" plus a NOTIFY step to the CSO.
- SLA: config §12 deleted `platform.config.killswitch.engagement-task-sla` ("D-2 could not register"). Tasks K-3 requires a `TightenOnly` `defaultSla` setting declared by the kind's owner, and tasks §7.5 says config declares it. Tenancy D-2 now allows `configurationRequired` + `GOVERNED`.
- `owner = null`: config §6.3 says this goes down "its dead-letter path … dead-letter task". Tasks §4.4 says a refused request opens `TaskOrphaned` (`REQUEST_REFUSED`) immediately, with no dead-letter step.
- Registration: config says the kind is "registered as a `tasks.kinds.<kind>` entry". Tasks §3.4 registers kinds as code (`TaskKindDefinition`).
- Fix (config):
  - Declare `TaskKindDefinition("platform.config.kill-switch-review", SafetyRelevant, CONTINUOUS_ONLY, defaultSla = platform.config.killswitch.review-sla [TightenOnly, configurationRequired, GOVERNED], escalationPolicy = ...)`.
  - Restore the SLA key.
  - State the `REQUEST_REFUSED` → `TaskOrphaned` path.
  - Focus aggregate type `KillSwitchBoard`, not "KillSwitch".
- Fix (tasks §7.5): owner = `platform.config.killswitch.review-queue`.

**34. Escalation-policy content type name.** Tasks §4.2 and A-6: `platform.tasks.escalation-policy`. Config §5.8 and OQ-CFG-13: `tasks.escalation-policy`, and says tasks declares `tasks.escalation.policies.<id>` (tasks does not).
- Fix (config): `platform.tasks.escalation-policy`; close OQ-CFG-13.

**35. Tasks setting keys and the SI-03 group as tenancy describes them.**
- Tenancy §5.3 (l.183), §5.11, §12 and §16 use `tasks.orphan.alarm-limit`, `tasks.orphan.scan-interval`, `tasks.orphan.grace`, `tasks.orphan.scan-budget`, with the group `S + G + B ≤ L`.
- Tasks §8 (the owner) uses `platform.tasks.orphan-alarm.max-delay`, `.scan-interval`, `.grace`, `.scan-budget`, `.leader-takeover`, plus `platform.tasks.routing.directory-max-staleness`, with the constraint `C + S + G + B + F ≤ L`.
- Tasks §8 and OQ-TK5 say "tenancy validates one key at a time", but tenancy now has `SettingGroup` (W-19, R-G).
- Fix (tenancy): use tasks' keys and the 6-term group in the examples and §16.
- Fix (tasks): declare the constraint as a tenancy `SettingGroup`; close OQ-TK5. Also set `platform.tasks.alarm-task.sla` to `configurationRequired` + `GOVERNED`, as D-2 requires for a TightenOnly key with no default.

## F. In-memory adapters and start-up refusal (D8)

**36. One D8 arch rule, six test names.**

| Spec | Test name |
|---|---|
| kernel §11 | `ArchTest:production-never-binds-test-adapters` |
| journal §2, §15 | `ArchTest:app-hms-binds-no-inmemory-or-testing-adapter` |
| tenancy §3 | `ArchTest:inmemory-and-testing-packages-only-from-test-sources` |
| config §11, §14 | `ArchTest:inmemory-adapters-never-in-production-wiring` |
| tasks §5.9, §11 | `ArchTest:in-memory-adapters-never-bound-in-app-hms` |
| workflow §3, §10 | `ArchTest:production-wiring-never-binds-inmemory-adapters` |

- Fix: all use the kernel's name and its exception clause (app-hms dev and test wiring package).

**37. Start-up refusal differs by environment.**
- Tenancy §11 and KA-T1 refuse volatile repositories only in TEST, TRAIN and PROD, so BUILD and PLAY could run on memory and lose change sets.
- Config §11 refuses whenever any deployment environment is set (`VolatileStore` marker, `ConfigPersistenceGuard`).
- Tasks uses `TasksPersistenceGuard`.
- Fix (tenancy): refuse in every environment class (BUILD, TEST, TRAIN, PROD, PLAY); volatile only in the dev profile with no environment class. Use config's shared `VolatileStore` marker instead of a per-port `DURABLE`/`VOLATILE` attribute, or have config adopt tenancy's; pick one for all three.

## G. "Fails closed" claims without a mechanism or named test (D16)

**38.** Each claim below needs a mechanism and a named test, or must be reworded so it is not a claim.
- Kernel §16 rows "No back-dated append" and "entry that needs a timing policy" cite "the journal's test (journal specification)". Name them: `UnitTest:back-dated-append-refused-by-production-authorization` and `UnitTest:clinical-append-refused-without-entry-time-policy`.
- Config §5.8 (l.533): "If tenancy provides no key families or `CONTENT_REF` … G5 refuses them (fail closed)". No test is named, and the premise is stale. Delete after 21, or add `UnitTest:content-item-without-chain-reference-refused`.
- Config KA-CFG-9 (l.977): "each missing one disables its feature by the fallback (fail closed)". No tests. Delete after 19.
- Config §4.6 (l.333) and tenancy §5.6 step 5 and step 7 (l.336, 338): "a caller that gets NotConfigured/Refused/Unavailable fails closed". Reword to "each caller's spec must name its fail-closed mechanism and test; this module claims none".
- Workflow §7 (l.236): "(fails closed; the owning type's test proves it)". Reword to "a requirement on each owning type, with a named test in its spec; not a control here (D16)".
- Journal §4.4 fail-closed row 3 relies on a tenancy resolver that tenancy does not specify (see 6). It is not a control until tenancy adds it.
- Tenancy `TenancyAudit` (see 24).

## H. Minor and stale references

**39.**
- Workflow l.25 and l.371 cite `platform-tasks.md` "§5.1 path 2"; it is §5.3.
- Workflow l.380 note: tasks already uses `ArchTest:safety-kernel-never-uses-workflow`. Delete the note.
- Tasks §3.1 and §7.2 cite "journal J-13" for the partition key; it is J-14.
- Config §3.1 and §6.3 cite tenancy "OQ-T8"; it moved to DN-T1.
- Tenancy's `Provenance` class collides by simple name with `hms.kernel.events.Provenance` used in the same module's journal calls. Rename it to `SettingProvenance`.
- Kernel §12.1 lists `kri.rcm.cash-rounding.*` and `kri.rcm.exchange-rates` in the "Key" column, although its own heading says `kri.*` are pack item names, never keys (D3). Mark them "rcm to name (generic key), `kri.*` = pack item".
- Kernel OQ-KN15's proposed `tenancy.facility.default-zone` should be `platform.tenancy.facility.default-zone`, to match tenancy's key style.
- Kernel KA-KN6 and HC-KN4 say `platform-tasks` and `hms.kernel.events` specify detection of a backward clock step, with a `TestClock.setTo`-backwards case. Neither spec does. Add it to tasks §4.5 and §11 (`UnitTest:backward-clock-step-detected-and-alarmed`), or record it as a tasks KA.