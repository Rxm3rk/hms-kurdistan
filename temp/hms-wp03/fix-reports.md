===== kernel
## Revision 2 of `platform-kernel.md`: review findings resolved

File edited: `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-kernel.md` (revision 2, about 1,500 lines). No other file was touched. I then re-read the whole spec once for consistency. One fix came out of that pass: there is now a separate `DEVICE` entry mode, so a stored clinical-time source of DEVICE or INTERFACE can be derived. There are 7 modes in all.

### Critical and major findings

| ID | Sev | Resolution |
|---|---|---|
| CA-01 | crit | Fixed. The entry mode is no longer an input. `CommandContext.entryMode` derives it from the actor kind, the capture channel and the back-entry authority (§7.3, D10). The objects that select privileged modes have restricted factories with ArchUnit allow-lists, which hold only test sources in WP-0.3 (§7.2, §11). `TimingRequirement` gains CHANNEL_IDENTITY, MIGRATION_PROVENANCE and BACK_ENTRY_AUTHORITY. Test: `PropertyTest:kernel-entry-mode-derived-from-context`. |
| CA-02 | crit | Fixed (D11). `EntryTimePolicy` and `GovernedThreshold` have private constructors and `init` checks (durations ≥ 0, factor > 0). They can only be built by `@SafetyParameterFactory fromResolved(ResolvedParameter…, EnvironmentClass)`. `ArchTest:safety-parameter-factories-only-in-resolvers` enforces this (§6.5). |
| CA-03 | major | Fixed. The factories refuse SYNTHETIC values in TRAIN and PROD (`UnitTest:synthetic-safety-parameters-refused-in-train-and-prod`). Provenance travels in `EntryTimingResult.Accepted.policy` and in `ComparisonRecord`. |
| CA-04 | major | Fixed. New §7 `hms.kernel.context` with full signatures, invariants and tests. `TenantId`, `FacilityId`, `PatientId` and `UserId` are now in `hms.kernel.ids`. Context added to §3, §4 and the framework-free rule. The API 1 freeze waits until the journal, envelope and tenancy revisions agree. |
| CA-05 | major | Fixed (D3). The settings are `calendar.weekend-days`, `calendar.holidays` and the new `calendar.confirmed-years`. `kri.*` names are pack items only. No value is shipped. Lock column aligned with tenancy. |
| CA-06 | major | Fixed (D4). `AsOf(validAt: Instant, knownAt: Instant? = null)`, plus `AsOf.latest` and `AsOf.knownAt(validAt, RecordedTime)`. A query bound is not a stamp, so `RecordedTime` stays for written rows only. I chose D4's "Instant for knownAt" option. |
| CA-07 | major | Fixed. New `ValidTime(start: ClinicalTime, endExclusive: ClinicalTime?)` with `toValidPeriod()`, `ValidTimeResult` and tests. |
| CA-08 | major | Fixed (D10). `EntryTimingCode` is the one stored vocabulary (7 values with a `labelled` flag). `EntryLabel` is removed. The journal's 4-value list goes. |
| CA-09 | major | Fixed. `EntryTimingResult.Accepted` / `Refused`. `EntryTiming` holds accepted results only. |
| CA-10 | major | Fixed. BackEntry requires BACK_ENTRY_AUTHORITY. `BackEntryAuthority` is issued only by the back-entry tooling, after its own permission check. `BackEntryEpisode` is built only from the registry. Its facility must match the context. Whether the back-dating privilege is also needed goes to DN-KN6. |
| CA-11 | major | Fixed. New `SYSTEM` mode and `ValidTimeInput.AtRecording`, stamped by the journal's single clock read. New `ValidTimeKind` (CLINICAL_CAPTURED, CLINICAL_AT_RECORDING, EFFECTIVE) and `EffectiveDated`. No policy is needed for these paths. SYSTEM with a given clinical time is refused. |
| CA-12 | major | Fixed. `@DoseMagnitudeAccess magnitude()` on `DoseQuantity` and `DoseRate`. A stored dose is rebuilt with `DoseQuantity.of(Quantity.ofMagnitude(...))`. The ArchUnit rule covers the new members. |
| CA-13 | major | Fixed. Added `plusBusinessDaysAtLocalTime(Instant, days)` with a fixed earlier-instant DST rule (gap → transition instant; overlap → earlier offset). Defined behaviour for days = 0, negative days (throw) and a non-business start day. `plusBusinessTime` is dropped. Test oracles are stated. |
| CA-14 | major | Fixed. `confirmedYears` is configured separately. `isBusinessDay` returns `CalendarAnswer`. A test checks that years with only Newroz are reported as uncovered. |
| CA-15 | major | Fixed. `restore` is allowed only from `..infrastructure.persistence..` and `hms.kernel.journal.infrastructure..`. Factories are `@JvmStatic`, rules match the static and Companion methods, and fixtures call through the companion and from Java. |
| CA-16 | major | Fixed. Both deviations are in §20, with OQ-KN15. |
| CS-01 | crit | Fixed, as for CA-01 and CA-10. Added the proposed hazard cause HC-KN1. A mode a channel cannot hold is not refused after the fact; it cannot be derived in the first place. |
| CS-02 | crit | Fixed. `atRecordedTime` is removed. `AtRecording` is allowed only for declared event types, and is refused for offline, device, interface, back-entry and migrated entries. `ClinicalTimeSource` is stored. Added detekt rule `NoClinicalTimeFromRecordedTime`, HC-KN2, and test `kernel-at-recording-only-where-declared`. |
| CS-03 | crit | Fixed, with one change to the recommendation. `Flag` now carries `kbMultiple` and `basis`. The literal rule ("raised counts only when kbMultiple ≤ factor") is logically inverted: a flag raised at 5× does not prove a dose is 10× or more. I applied the sound rule: raised and kbMultiple ≥ factor → stop; not raised and kbMultiple ≤ factor → below; anything else → DoseCheckUnavailable. |
| CS-04 | major | Fixed. A ratio is defined as a decimal multiple of ordered over maximum. `DoseBasis` is on every KB result plus an `orderedBasis` parameter. A basis mismatch gives DoseCheckUnavailable. A KB adapter contract test is required. HC-KN5 added. |
| CS-05 | major | Fixed. All kernel tests are renamed `kernel-…` and listed as parts, outside the `SI-nn-*` test families. §15 has a "rest of the control" column. |
| CS-06 | major | Fixed in part. Added `UnitCheck.NotMetric`. "Metric only" is marked not covered (KA-KN1). The refusal at command level is assigned to medications (Phase 1) with its own test. The kernel cannot enforce it. |
| CS-07 | major | Fixed, as for CA-02 and CA-03. `ContentProvenance` uses the §19.4 vocabulary and lives in `hms.kernel.time`. |
| CS-08 | major | Fixed. The module that owns a timing class registers 4 definitions per class. No definition is registered before DN-KN1, so lookups give NotConfigured and the entry is refused. The strictness direction goes to DN-KN1 and is checked by `PropertyTest:entry-time-tolerance-strictness-direction`. |
| CS-09 | major | Fixed. A refused device, interface, offline or migration entry goes to an owned, alarmed queue. That is the inbound adapter's control, with a test named for when the first adapter arrives. HC-KN3 added. |
| CS-10 | major | Fixed. New `OFFLINE_CAPTURE` mode, code and tolerance. `CaptureChannel.OfflineQueued` can only be set by the offline sync endpoint (allow-listed). Decision goes to DN-KN6. |
| CS-11 | major | Fixed in part. HC-KN4 and KA-KN6 record the risk. Step detection is required of platform-tasks and events, and their test gains a backward-step case. I did not add a kernel monotonic clock (D17 small API; "no system clock in the domain"). |
| CS-12 | major | Fixed. `ArchTest:production-never-binds-test-adapters` and `UnitTest:app-hms-production-clock-is-system-utc`. TestClock is documented as test-only. |
| CS-13 | major | Fixed, as for CA-07 and CA-08. The classified instant (the start, with the end bounded) is stated. |
| CS-14 | major | Fixed, as for CA-06. |
| CS-15 | major | Fixed, as for CA-15. Includes an inbound-adapter violating fixture. |
| CS-16 | major | Fixed with one exception. OQ-KN1/2/3/4/10 became DN-KN2..6 for the CSO, with status "requested" and empty approval fields. A tightenings list is added. The continuous-timer reading is deferred to the platform-tasks CSO decision. Not applied to OQ-KN11 (recorded-time offset): it is a storage convention, not an SI reading. |
| CS-17 | major | Fixed, as for CA-04. `ChangeReason` (Entered / SystemGenerated, no default) is in the context library. |
| CS-18 | major | Fixed, as for CA-05. |
| CS-19 | major | Fixed. New `DoseRate` type (magnitude ≥ 0, unit mandatory) for §2.1 (d). Zero minimum is tested. Added to DN-KN4. |
| CS-20 | major | Fixed. `FluidEntry` (Measured or Medication). A negative entry gives `InvalidEntry`. Property test added. |
| CS-21 | major | Fixed. CTRL-0005-17 is marked as a partial kernel contribution (numbers only). KA-KN5 added. |

Minor findings are also fixed: CA-17 to CA-26 and CS-22 to CS-27. These cover the extra tests, §1 wording, thread-safety and clock range, implicit-locale APIs, input limits and offset seconds, `asEntered` in records, the precision question (OQ-KN14) and the tasks calendar API.

### Interfaces I assume from sibling specs (spec §21)

- **Journal**
  - `append` takes a `CommandContext`. Each entry carries a `ValidTimeInput`, an expected `EntryTimingCode` and a `ChangeReason?`.
  - The journal reads the clock once and derives the mode from `context.entryMode`. It gets the policy via `EntryTimePolicySource` only when `needsPolicy` is true. It classifies, and refuses on a code mismatch.
  - It enforces the requirements. `BackDatingAuthorization` refuses everything in production in WP-0.3. `SystemGenerated` reasons are allowed only for SYSTEM actors.
  - It stores the `EntryTimingCode` name, the clinical-time source and `ValidTime` with offsets. `JournalEntry.recordedAt: RecordedTime`.
  - It imports `TransactionContext`, `TransactionRunner`, `TxOutcome`, `IdempotencyKey`, the typed ids and `AsOf` from the kernel.
- **Events catalogue and envelope**
  - Each event type declares its `ValidTimeKind` and, where needed, its `TimingClass`.
  - EFFECTIVE is allowed only for non-clinical owners, checked by a catalogue test.
  - `entrytiming` uses the `EntryTimingCode` list. The CloudEvents `time` stays an `Instant` on the wire.
- **Tenancy**
  - Uses the kernel ids, `AsOf`, `ContentProvenance` and `CommandContext`.
  - Declares the 3 calendar keys, including the proposed `calendar.confirmed-years`, and builds `BusinessCalendar.of(zone, weekend, holidays, confirmedYears)`.
  - Implements `EntryTimePolicySource` in the allow-listed package `hms.platform.tenancy.application.settings` (proposed). It answers NotConfigured until DN-KN1.
  - Checks each tighten-only comparator against its declared direction (D12). Considers the facility default-zone setting (OQ-KN15).
- **Config**: `Environment` has the same values as `EnvironmentClass` and may alias it. The deployment parameter `platform.config.environment` gives the class to app-hms. SYNTHETIC/APPROVED is `ContentProvenance`. Gate G8 stays the first synthetic gate.
- **Tasks**
  - Uses `UserId` instead of `UserRef`, and kernel tenant and facility ids.
  - Computes business-calendar due times with `plusBusinessDaysAtLocalTime` and raises an alarm when a `CalendarAnswer` is incomplete.
  - Runs alarm paths as `ActorRef.system` from `hms.platform.tasks.application.system`.
  - Detects backward clock steps and adds a backward-step case to the orphan-alarm test. Keeps its CSO decision on continuous timers.
- **Workflow**: `WorkflowCallContext` uses the kernel `TenantId`, `ActorRef` and `CorrelationId`.
- **app-hms**: binds `Clock.systemUTC()`, `UuidV7Generator(clock, SecureRandom())` and `EnvironmentClass`, and no test or in-memory adapter in production.
- **Build file (integrator)**: `:platform:quantity` needs `api(project(":platform:time"))`.

### Proposed items (local labels; the integrator numbers them)

**DN-KN1 (CSO) [HUMAN]: values and direction of the SI-10 entry-time tolerances.**
- Status: requested. Decided by: (empty). Date: (empty).
- Blocks: every clinical entry that needs a timing policy from Phase 1, and the WP-0.3 task completion with a user-given `performedAt`.
- Default in use: no definition registered and no vendor value; every entry that needs a policy is refused; tests use synthetic policies.
- Context: the tolerances are contemporaneous, future, interface-lateness and offline-capture, per timing class. They are SI-10 parameters, vendor-locked and tighten-only (CTRL-0010-1).
- Options:
  1. The CSO sets each value per timing class before Phase 1 and confirms that a smaller value is stricter for all four (default proposal).
  2. One vendor value per tolerance for all classes, tightened per tenant.
  3. Zero for all (strictest, operationally heavy).
- Also to confirm: that a smaller future, lateness or offline tolerance is stricter, even though it sends more device data to the owned exception queue.

**DN-KN2 (CSO) [HUMAN]: what "audited" means in "one audited comparison API" (§6.8 #1; CTRL-0005-5).**
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: one small, code-owner-reviewed API. Every outcome carries a `ComparisonRecord` that the caller stores with its journal row and audit event. The kernel writes nothing.
- Options: (1) the default; (2) each call emits its own audit event (needs a port and WP-0.4).

**DN-KN3 (CSO) [HUMAN]: KB comparisons of §2.1 (c).**
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: §10.5 as written.
- Questions:
  1. Is the internal exact product `ordered >= factor × maximum` a comparison allowed by (c), not dose arithmetic?
  2. Does "exactly the ordered unit" include the dose basis?
  3. Is the flag rule right (a flag decides only through its declared multiple, otherwise "dose check unavailable")?
  4. Is a ratio the decimal multiple of ordered over maximum?
  5. Must a governed factor be at least 1?

**DN-KN4 (CSO) [HUMAN]: what counts as a unit-less dose, and zero rates.**
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: `DoseQuantity` and `DoseRate` refuse the unity `1`, atom-less numbers and factors, and annotation-only units. A dose must be positive. A rate or titration bound may be zero, never negative. This is a tightening of SI-05.
- Open point: how counted doses (tablets, puffs) are expressed.
- Options: confirm, or allow named annotation forms.

**DN-KN5 (CSO) [HUMAN]: clinical number and unit display beyond the stated ISMP rules.**
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: `.` as decimal separator, no grouping, ASCII-only input, raw UCUM code as the unit.
- Open points: grouping for large numbers, the decimal separator in ar and ckb, Eastern Arabic-Indic digit input, unit display names.
- Options: name the source (the ISMP list placed in `docs/content-sources/`) and a rule for each point.

**DN-KN6 (CSO) [HUMAN]: entry-timing labels, windows, back-entry privilege and offline capture.**
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: §6.2 as written.
  - BACK_DATED, BACK_ENTRY, OFFLINE_CAPTURE, LATE_ARRIVAL and MIGRATED are labelled.
  - A back-entry needs a registry episode and must fall inside its window.
  - Back-entry needs the tooling's own permission, not the back-dating privilege.
  - An offline capture older than its tolerance is refused into an owned queue.
  - AtRecording is allowed only for declared event types and only online.
- Context: also covers whether the device clock offset is checked at sync (ADR-026). Merged with the journal spec's open question on back-entry privilege.
- Options:
  1. The default.
  2. Back-entry also needs the back-dating privilege.
  3. An offline capture beyond its tolerance becomes BackDated under the capturing user's privilege.

**OQ-KN5: the UCUM specification as a content source.** A copy and its terms of use need to be placed in `docs/content-sources/`, by a human if fetching it is outward-facing. The semantic tables arrive with WP-1.1. Until the copy is present, test vectors are limited to grammar cases that need no atom table.

**OQ-KN6: non-dose quantities.** Results, nursing, reg-ews, reg-lis-rules and Tier 2 calculators will need comparisons, and some arithmetic, on non-dose quantities. Before Phase 1, decide between widening the magnitude allow-list (for example to `hms.reg..`) and adding a separate measurement comparison API. Either way a `DoseQuantity` or `DoseRate` never reaches a non-dose comparison.

**OQ-KN7: IQD scale and cash rounding settings.**
- Does the ledger keep IQD at the ISO minor unit or at whole dinars?
- The cash-rounding mode key `kri.rcm.cash-rounding.mode`.
- Does USD need its own key `kri.rcm.cash-rounding.usd` while L-33 stands?

For rcm and the CFO (L-14, L-33).

**OQ-KN8: exchange-rate direction.** Does change in the other currency use the inverse of one posted rate (`convertBack`) or a separately posted rate (buy and sell)? How does a corrected rate supersede a wrong one? For the rcm specification (§9.21, §11.4).

**OQ-KN9: business hours and facility calendars.**
- Do administrative SLAs need business hours and part days (such as the eve of a holiday)?
- May a facility override the tenant's weekend or holidays?

For platform-tasks, platform-tenancy and the tenant (§7 item 1; L-20).

**OQ-KN11: offset of recorded time.** "Original offset" (§5.3) is applied to clinical time only. Recorded time is stored as UTC and displayed in the facility zone. Confirm. This stays an open question because it is a storage convention, not an SI reading.

**OQ-KN12: feature ID for the kernel libraries.** Appendix A has no row for them. Add one, or record a mapping to `PLT-CORE-01`, `PLT-CORE-02`, `PLT-CORE-07` and `PLT-CFG-01` (same question as workflow's OQ-W1).

**OQ-KN13: purpose-of-use vocabulary.** The vocabulary is the Trust Plane's (WP-0.4). Which code do WP-0.3 SYSTEM processes and tests carry until then? Proposal: synthetic codes in tests; no production deployment exists before WP-0.4.

**OQ-KN14: approximate clinical times on paper.** Paper downtime records often give a date only or "morning". Should `ValidTime` carry a precision (exact, minute, hour, day, approximate), or should the TRU-BCP-03 tooling record the stated time as text beside the instant? For TRU-BCP-03 and the CSO.

**OQ-KN15: calendar and zone ownership (for the tenancy spec).**
1. §5.2 gives calendars to platform-i18n, but this build keeps the data in tenancy and the type in the kernel (tenancy's OQ-T4).
2. The proposed `calendar.confirmed-years` setting.
3. §4.1's per-tenant default zone, honoured by a COUNTRY_PACK or TENANT setting (proposed `tenancy.facility.default-zone`) that pre-fills the facility zone at creation. The Kurdistan pack supplies `Asia/Baghdad`.

**KA-KN1: UCUM validation is syntactic only.**
- Accepted without check: unknown atoms, grammatical misspellings and non-metric units.
- Missing until WP-1.1: no atom table, dimension check, metric check (SAC-11) or conversion.
- The `UnitCatalogue` binding answers Unavailable. Refusing on that answer is the medications module's control.
- HAZ-0005 (CTRL-0005-4). Backlog: PLT-CORE-05. Closes with: WP-1.1 and a human placing the UCUM files.

**KA-KN2 (only if the detekt rules are not built in WP-0.3): the detekt half of §6.8 #1 and the time and reason rules are missing.**
- Covers `NoDoseArithmetic`, `NoClinicalTimeFromRecordedTime` and `NoLiteralChangeReason`.
- HAZ-0005 (CTRL-0005-5); HAZ-0010 (CTRL-0010-3, -4). Backlog: PLT-CORE-03 or the first medications feature.
- Closes with: the three rules, with `NoDoseArithmetic` before the medications module (§9.10 acceptance 6).

**KA-KN3: limits of the ArchUnit rules.**
- Cannot see: arithmetic on a magnitude inside an allowed persistence package; values laundered through `display()` or `asEntered()` and parsed back; a `ClinicalTime` built from `RecordedTime.instant`.
- Compensated by: the detekt rules and safety code-owner review.
- HAZ-0005 (CTRL-0005-5); HAZ-0010 (CTRL-0010-3). Closes with: detekt with type resolution, or "mitigated" while review stands in.

**KA-KN4: calendar data and entry-time tolerances are not configured.**
- Missing: holiday dates beyond the pack's Newroz item, confirmed years, and SI-10 tolerances.
- Behaviour meanwhile: calendar answers flag uncovered years and treat unknown days as business days (deadlines earlier, never later); every entry that needs a policy is refused.
- HAZ-0010, HAZ-0003. Closes with: the Kurdistan pack (WP-1.1) and DN-KN1.

**KA-KN5: unit display names are not approved content.**
- `display()` shows the raw UCUM code; the kernel's part of CTRL-0005-17 covers numbers only.
- Raw codes must not be shown to clinicians in TRAIN or PROD until approved names and the ISMP list are placed and checked. That mechanism and its test belong to the frontend and medications specs (Phase 1).
- HAZ-0005 (CTRL-0005-17). Closes with: DN-KN5 and the approved content.

**KA-KN6: safety timers run on wall-clock time.**
- A cell-wide backward clock step delays every pending safety timer (HC-KN4).
- Compensated by: ADR-026's time source and alarms, and the step detection that platform-tasks and events specify.
- HAZ-0003 (CTRL-0003-5). Closes with: step detection and its property test passing.

**KA-KN7: the command context is not yet bound to the authenticated principal.**
- Until WP-0.4, any code can build a USER actor. The other actor kinds, offline capture and back-entry authority are guarded only by package allow-lists. In WP-0.3 those hold no production package, so the privileged modes cannot occur.
- HAZ-0010 (CTRL-0010-4, -5). Closes with: WP-0.4 building `CommandContext` from the authenticated session.

**Proposed hazard causes for existing hazards (new HAZ numbers are not proposed):**
- **HC-KN1 (HAZ-0010):** the entry mode or the downtime episode is asserted by the caller, so a back-dated entry escapes the privilege.
- **HC-KN2 (HAZ-0010):** an offline-captured act is stamped with its sync time, so the next dose is timed wrongly.
- **HC-KN3 (HAZ-0010, HAZ-0003):** a device or interface clock ahead of the server gets an observation refused as future and lost.
- **HC-KN4 (HAZ-0003):** the whole cell's clock steps backwards (an NTP step or GPS reacquisition) and delays every pending safety timer.
- **HC-KN5 (HAZ-0005):** a KB result on another basis, a ratio in another form, or a flag set at a different multiple hides a dose of 10× or more.
- **HC-KN6 (HAZ-0005, HAZ-0010):** a safety parameter is hand-made in code, or synthetic content reaches TRAIN or PROD.

**ADR:** none proposed. These choices sit inside ADR-004, ADR-016 and the §6.2 conventions.
===== journal
Revised in place:

- `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-journal.md`
- `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\events\envelope.md`
- `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\events\catalogue.md`

All 8 critical and 44 major findings are fixed. One recommendation was applied partly (SAF-01: no separate entry_mode column). Most minor findings are fixed too. I edited no other file, changed no git state, and ran no Gradle or Docker.

## 1. Critical and major findings

| Id | Sev | Resolution |
|---|---|---|
| CA-01 | crit | Fixed. The kernel EntryTiming vocabulary is the only one. Columns are entry_timing (CONTEMPORANEOUS, BACK_DATED, BACK_ENTRY, LATE_ARRIVAL, MIGRATED), entry_label (the kernel EntryLabel) and back_entry_episode_id. DB checks pair each label with its kind. The privilege check is keyed on BACK_DATED. MIGRATED only with MIGRATION_LOADER actor and migrated source. Refused is never stored. Envelope gains `entrylabel`. New round-trip property test. |
| CA-02 | crit | Fixed. The appender classifies every row itself, with one clock read (J-4, J-6). The caller states `expectedTiming`; a different result is refused with `TimingMismatch`. New test PropertyTest:SI-10-journal-classifies-every-append. |
| CA-03 | crit | Fixed. New `BackDatingAuthorization` port. Its production binding (`RefusingBackDatingAuthorization`) refuses every request. The decision id comes only from the port, never from the caller. Named test: UnitTest:back-dated-append-refused-by-production-authorization. |
| CA-04 | crit | Fixed. The linter's refused list now covers trigger-function replace, alter or drop; DROP SCHEMA; DROP or ALTER POLICY; OWNER, RENAME, DROP COLUMN, ALTER COLUMN TYPE, SET UNLOGGED and ENABLE REPLICA or ALWAYS TRIGGER; extra CREATE TRIGGER and CREATE RULE; BYPASSRLS and SUPERUSER roles; DO blocks; EXECUTE; data-modifying CTEs. Each has its own planted fixture. The contradiction with §9.8 is resolved. |
| SAF-01 | crit | Fixed (as CA-01 and CA-02), plus a future-clinical-time refusal and a back-entry episode verified server-side by `BackEntryAuthorization`, with a refuse-all production binding. Applied partly: no separate entry_mode column, because the mode can be derived from actor_kind and the timing kind. |
| SAF-02 | crit | Fixed (as CA-03). KA-J3 now names the mechanism and the tests. |
| SAF-03 | crit | Fixed. A gap-free per-key `key_seq` (commit-ordered through a counter-row lock), `PublicationWatermarkCheck`, and automatic GAP_FILL re-publication as the SYSTEM actor, audited, with an alarm and task within 5 minutes. New DN-J1 asks the cell for failover-safe replication slots. New ChaosTest:postgres-failover-no-event-lost. HAZ-J1 has the slot-loss cause. |
| SAF-04 | crit | Fixed. The first failure is written durably to the consumer's database before any retry, and retries are bounded. A lag-age monitor outside the consumer's process catches crash loops and stalls (waits for the cell, KA-E1). New ChaosTest:consumer-crash-loop-alarms-within-5-minutes. |
| CA-05 | maj | Fixed. Every CREATE TABLE must carry a fact-table, aggregate-table or read-model marker. An unclassified table or an unparseable statement fails the build. |
| CA-06 | maj | Fixed. The API is built on CommandContext, typed ids, ChangeReason, PurposeOfUse, IdempotencyKey and CorrelationId. TransactionContext and TransactionRunner move to hms.kernel.context. :platform:context is added to §3. The old OQ is removed. |
| CA-07 | maj | Fixed. AsOf is used everywhere and recordedAt is a RecordedTime. The journal's own `ValidTimeSpec.Given(from: ClinicalTime, to: ClinicalTime?)` replaces the missing kernel ValidTime type. |
| CA-08 | maj | Fixed. The D6 rule now lives in one place, per aggregate type: PATIENT, PATIENT_IF_ANY, AGGREGATE or TENANT. A partition_scope column drives the DB check. The catalogue gains `tenant` and `as its aggregate`. |
| CA-09 | maj | Fixed. Adapters move to hms.kernel.journal.inmemory and .testing. New ArchTest:app-hms-binds-no-inmemory-or-testing-adapter. In-memory adapters enlist through the TransactionContext completion hook (assumed of the kernel). |
| CA-10 | maj | Fixed. `FactTableMigrationLinter` is a class in :platform:arch-rules that each project runs on its own migrations. |
| CA-11 | maj | Fixed. The setting definition is declared in tenancy's SettingCatalogue on the event library's behalf. The key `platform.events.dead-letter-alarm-after` follows tenancy's naming grammar. |
| CA-12 | maj | Fixed. Catalogue §4 now uses the owning specs' names and tenant keys. TaskReleased, TaskSlaBreached, TaskOrphanCleared and TaskRequested are added. |
| CA-13 | maj | Fixed. CatalogueEntry gains producers, inDatabaseConsumers and freeTextFields. J-13 checks the producer. Rows with an undecided name, owner or key move to a "not registered" list (§2.1) that the matching test reads. Statuses are aligned with CatalogueStatus. |
| CA-14 | maj | Fixed. TaskRequested is one named exception in envelope §2: a past-tense fact, read from the journal in the same database (D14), with the orphan guarantee. |
| CA-15 | maj | Fixed. New `DeadLetterTaskSink` port. The task's SLA starts at firstFailureAt. |
| CA-16 | maj | Fixed. The as-was view folds in version order, and the projection's `ValidTimeView` answers for valid time V. Valid periods are half-open. Corrections carry defined valid periods. ValidWindow means overlap. New PropertyTest:journal-as-was-valid-at and journal-as-was-back-entry-and-retraction. |
| CA-17 | maj | Fixed. A safe tail reads by transaction-id horizon, so no late-committing row is skipped. Rebuilds go into a shadow store from the tail. The commit-lag limit of "known at" is stated. New late-commit tests. |
| CA-18 | maj | Fixed. Keys are scoped per actor and carry a request fingerprint. Consumer keys are derived as `evt:<consumer>:<event>:<effect>`. Idempotency is checked before versions. |
| CA-19 | maj | Fixed. Any result other than Appended makes the transaction rollback-only; a Commit then rolls back and throws. The insert runs under a savepoint. A commit check (`expectRow`) catches an aggregate write with no journal row. |
| CA-20 | maj | Fixed. Two payloads: `payload` (full change data, ADR-008 fields as ciphertext) and `event_data` (minimised, published). Recorded as ADR-J1. |
| CA-21 | maj | Fixed. The journal's own CloudEvents transform is the primary design, not the Debezium router. The ce_type column is dropped and the mapper builds `type`. |
| CA-22 | maj | Fixed. Migrations run in a separate job under the owner role. The app connects only as the runtime role and checks the schema version at start. New IntegrationTest:journal-runtime-role-cannot-alter-or-drop. |
| CA-23 | maj | Fixed. Readers are scoped: ModuleJournalReader for a module's own rows, JournalTail per catalogued consumer, privileged AsWasReader. New ArchTest. The KA wording is corrected. |
| CA-24 | maj | Fixed. Projection gains `key()` with state per key. The store tracks applied versions per aggregate and offers shadow and promote. |
| CA-25 | maj | Fixed. Gap detection and recovery as SAF-03. Consumers apply events strictly by `keyseq`; a gap parks the whole partition key. Live and replayed events go through the same ledger, so they cannot overtake each other. |
| CA-26 | maj | Fixed. The ledger takes a TransactionContext and its `record` is insert-if-absent. New ParkedEventStore and DeadLetterStore ports. |
| CA-27 | maj | Fixed. New `provenance` and `actorkind` attributes. Actor, on-behalf-of and device ids travel in event_data `meta.provenance`, not in headers. |
| CA-28 | maj | Fixed. The kernel rule set extends to hms.kernel.events and to hms.kernel.journal outside infrastructure. Two ArchTests are named. `isAlarming` takes `now` instead of a Clock. |
| CA-29 | maj | Fixed. One rule: aggregate types are PascalCase and unique across modules, in a registry. Proposed names: EnterpriseStructure, TenantConfiguration, ScopeConfiguration, ConfigChangeSet, ConfigBundleActivation, ConfigKillSwitch, Task, DeadLetterItem. |
| CA-30 | maj | Fixed. Refusals are not journal rows (§4.7); new KA-J5. Config and tenancy must align. |
| SAF-05 | maj | Fixed (as CA-19). |
| SAF-06 | maj | Fixed (as CA-18). New PropertyTest:journal-idempotency-key-reuse-with-different-request-refused. |
| SAF-07 | maj | Fixed. RecordedTimeRegression is retryable. The command runner waits at most 1 s (the ADR-026 alarm bound), then reports a clock fault. New PropertyTest:SI-10-clock-skew-journal. Cause added to HAZ-J2. |
| SAF-08 | maj | Fixed (as CA-16). |
| SAF-09 | maj | Fixed. Shadow rebuild with an atomic swap. A store with no previous version answers "rebuilding, unavailable, manual check required", never an empty list. New HAZ-J3 and test. |
| SAF-10 | maj | Fixed (as CA-04, CA-05 and CA-10). The residual-risk text now names the owner role. |
| SAF-11 | maj | Fixed. meta.security is required in every patient event (an empty array when none). Disclosing consumers check labels through the policy enforcement point and fail closed. Recorded as an SI-21 reading (OQ-E2), with a contract test. |
| SAF-12 | maj | Fixed. Each consumer's spec declares its parking scope (key or aggregate) and why. Parked count and oldest age appear on the dead-letter task. Safety-relevant parked types are named. Cause added to HAZ-J1. |
| SAF-13 | maj | Fixed. Replay runs in key_seq (commit) order. Modes are REDELIVER, REBUILD_STATE (external effects suppressed; ledger reset allowed only here) and GAP_FILL. New UnitTest:replay-rebuild-state-suppresses-external-effects. |
| SAF-14 | maj | Fixed. Cause added to HAZ-J1. Merge ordering goes to empi as OQ-E4. |
| SAF-15 | maj | Fixed. Dead-letter items and parked events live in the consumer's database and are never deleted. DeadLetterItem is an aggregate with a lifecycle; resolutions are journaled, audited and reportable. |
| SAF-16 | maj | Fixed. The factory clamps an invalid value to PT5M and raises DeadLetterSettingsInconsistent; the alarm keeps working. New unit test. |
| SAF-17 | maj | Fixed (as CA-26 and CA-18). New PropertyTest:consumer-ledger-commits-with-effect. |
| SAF-18 | maj | Fixed. One SLA start (first failure). The TaskOrphaned sentence is corrected to match tasks §4.3. The DeadLetterTaskSink port is defined. Hazard-log test-name additions are proposed in OQ-E5, not self-approved. |
| SAF-19 | maj | Fixed (as CA-12 and CA-08). New "one tenant's configuration events share a key" property. |
| SAF-20 | maj | Fixed (as CA-14, under D14). |
| SAF-21 | maj | Fixed (as CA-06 and CA-07). |
| SAF-22 | maj | Fixed (as CA-09), plus a start-up refusal test (D8). |

Minor findings fixed: CA-31 to CA-46, SAF-23 to SAF-30. SAF-28 is handled as a proposal inside OQ-E2, not as a routing change.

## 2. Interfaces assumed from siblings

- **hms.kernel.context (D1):**
  - CommandContext with the D1 fields.
  - ActorRef with kinds USER, DEVICE, INTERFACE, MIGRATION_LOADER, SYSTEM.
  - ChangeReason and PurposeOfUse, neither with a default.
  - IdempotencyKey (opaque, ≤200 characters), CorrelationId, DeviceRef.
  - `TransactionRunner.inTransaction(tenant, block: (TransactionContext) -> TxOutcome<T>): T`.
  - TransactionContext with `markRollbackOnly`, `isRollbackOnly`, a before-commit hook and an on-completion hook. The runner rolls back and throws when a rollback-only block returns Commit.
  - An in-memory runner in hms.kernel.context.inmemory.
- **hms.kernel.ids:** TenantId, FacilityId, PatientId, UserId; IdGenerator.
- **hms.kernel.time:**
  - RecordedTime.restore, with its ArchUnit rule narrowed to hms.kernel.journal.infrastructure and ..inmemory.
  - AsOf with some lawful knownAt (the journal compares instants, whichever form the kernel picks).
  - EntryTimeClassifier, EntryTiming.Accepted with a `kind: EntryTimingKind`, EntryLabel, EntryTimeRefusal, BackEntryEpisode.
  - EntryMode derived from CommandContext.
  - EntryTimePolicy and PolicySource, built only by resolver factories (D11).
  - If the kernel adds a clinical period type with offsets on both ends, ValidTimeSpec.Given switches to it.
- **platform-tenancy:**
  - Implements `EntryTimePolicies` (returns Unavailable while DN-KN1 has no values).
  - Declares `platform.events.dead-letter-alarm-after`: DURATION, maximum PT5M, VENDOR_FOUNDATION, default PT5M, SafetyInvariant SI-03, TightenOnly with shorter stricter, owner platform-journal.
  - Adopts aggregate types EnterpriseStructure, TenantConfiguration, ScopeConfiguration, all keyed TENANT, time class ADMINISTRATIVE.
- **platform-config:** adopts aggregate types ConfigChangeSet, ConfigBundleActivation, ConfigKillSwitch (TENANT, ADMINISTRATIVE). Refusals are not journal rows.
- **platform-tasks:**
  - Uses `JournalAppender` (not "JournalAppend").
  - Reads TaskRequested through `JournalTails.forConsumer`.
  - Writes SYSTEM rows with AtRecordedTime and puts other instants (due, breach) in event data.
  - Aggregate type `Task` is PATIENT_IF_ANY and ADMINISTRATIVE.
  - Implements `DeadLetterTaskSink`, with the SLA starting at firstFailureAt; its §7.1 needs to align.
  - Runs the rebuild property over its own worklist.
  - Keeps its own idempotency store for refusals only.

## 3. Proposed OQ, KA, HAZ, ADR and DN items (local labels)

**platform-journal.md**

- **OQ-J1: privilege for downtime back-entry.** SI-10 says "Back-dating is privileged and audited" and "Back-entry keeps the original clinical times and is labelled". This spec requires, for a back-entry, the back-entry permission and a downtime episode verified server-side (J-9). Is a downtime back-entry also a form of back-dating that needs the back-dating decision of J-8? The journal can enforce either. A reading of a safety invariant, so the CSO's (§3.4 item 1). Default until answered: back-entry permission and verified episode only.
- **OQ-J2: tamper evidence for the journal.** Should journal rows carry a per-aggregate hash chain (each row hashing its predecessor), so that a privileged rewrite of the table is detectable, as AU-3 requires of the audit store (R07 §5.4)? Per-aggregate chains fit the existing version order. Cost: a canonical serialisation of every row and a verifier. Default: no chain; the residual risk of §9.3 is recorded.
- **OQ-J3: row-level security in every topology.** §6.4 requires `FORCE ROW LEVEL SECURITY` in the pooled tier. This spec applies it in every topology so one migration serves all (§2.2 rule 5; §9.4). Confirm, since every module's tables would follow.
- **OQ-J4: journal partitioning.** Decide in WP-0.6 from the 1,000-bed-day volumes whether the journal is partitioned (candidate: hash on `aggregate_id`, which keeps the version key; the idempotency and key-sequence keys would then include the aggregate). Range partitioning by time is ruled out by J-3 and §9.6.
- **OQ-J5: entry timing of administrative and system rows (a reading of SI-10 for the CSO).** This spec classifies configuration and structure changes by a zero-tolerance rule: a planned (future) valid time is "contemporaneous" (not back-dated), and a retroactive one is back-dating that needs a verified decision (§4.4 "Time classes"). System actors may only write rows whose valid time is their recorded time (J-10, J-17). Confirm both, since SI-10's "back-dating is privileged" is written for clinical entries.
- **ADR-J1: the journal row carries two payloads.** Proposal: `payload` holds the full change data, the source for rebuild and audit, with ADR-008 designated fields as ciphertext under the tenant key; `event_data` holds the minimised published data under the catalogued schema plus the appender's `meta` block; only `event_data` is published. Context: §2.2 rule 1 and §5.3 D need rebuilds from the journal; `envelope.md` §6 minimises published data; crypto-shredding (ADR-004, ADR-008) fails if designated fields are plain text in an immutable row. Consequences: more storage per row; every module writes two mappings; a test proves that no designated field is plain text in either column.
- **ADR-J2: ordering without gaps.** Proposal: a per-partition-key counter (`key_seq`, gap-free, commit-ordered by a counter-row lock) and a safe tail by transaction-id horizon (`tx_id`, `xid8`), instead of ordering by recorded time (§8.3). Context: recorded time is read before commit, so recorded-time paging can skip rows; replay must keep per-patient commit order (§12.1 "A08 never overtakes A01"); consumers must detect loss per key (D15). Consequences: one counter-row upsert per key per append, serialising writes per key until commit; rare deadlocks between appends that touch two keys in opposite orders, reported as retryable.
- **DN-J1: replication slots that survive failover (for WP-0.2).** The cell must provide failover-synchronised logical replication slots (PostgreSQL 17+ failover slots with CloudNativePG slot synchronisation), so a primary failover does not drop the outbox slot. The watermark check (§10.3) detects and repairs a lost slot, but repair is a privileged operation and should be rare. Owner: the WP-0.2 cell.
- **KA-J1: privileged journal reads are not audited yet.** `AsWasReader` emits no BALP AuditEvent until the Trust Plane Audit SDK exists; no production code calls it in WP-0.3 (`ArchTest:journal-privileged-readers-not-used-by-modules`). Command handlers do read their own module's rows in production (`ModuleJournalReader`, for idempotency and history), and `platform-tasks` reads `TaskRequested` rows through its tail; those reads are not audited either. Hazard references: H14 (HAZ-0021), SI-21. Backlog: `PLT-CORE-01`, `TRU-AUD-01`. Closes with WP-0.4.
- **KA-J2: the outbox is not published yet.** Journal rows are written but no CloudEvents transform, connector, topic, Apicurio registration, dead-letter store or publication watermark check runs, so no event leaves the journal, and the per-patient ordering, journal-rebuild and failover tests have not run on real infrastructure. Hazard references: H5, H6 (HAZ-0003 CTRL-0003-5; HAZ-J1). Backlog: `PLT-CORE-04`. Closes with the WP-0.3 cell slice after WP-0.2 (DN-040).
- **KA-J3: back-dated and back-entry appends are refused.** Mechanism: the production bindings `RefusingBackDatingAuthorization` and `RefusingBackEntryAuthorization` (§4.4), proved by `UnitTest:back-dated-append-refused-by-production-authorization` and `UnitTest:back-entry-append-refused-by-production-authorization`. Hazard reference: HAZ-0010 (CTRL-0010-4, -5). Backlog: `PLT-CORE-01`, `TRU-BCP-03`. Closes with WP-0.4 (back-dating) and `TRU-BCP-03` (back-entry).
- **KA-J4: user-timed appends to clinical aggregate types are refused until the entry-time tolerances are configured.** Mechanism: `EntryTimePolicies` returns `Unavailable` when no vendor-locked tolerance is configured (DN-KN1), proved by `UnitTest:clinical-append-refused-without-entry-time-policy`. No clinical module exists in WP-0.3; administrative and system rows are unaffected. Hazard reference: HAZ-0010 (CTRL-0010-1). Closes when the CSO sets the values (DN-KN1).
- **KA-J5: refused commands leave no journal row.** Refusal audit (R07 AU-1 "outcome") waits for the Trust Plane Audit SDK; meanwhile `platform-config` and `platform-tenancy` route refusals to their own audit ports (§4.7). Hazard references: HAZ-0019 (configuration), HAZ-0021. Closes with WP-0.4.
- **HAZ-J1 (proposed): a domain event is lost, duplicated, reordered or silently stuck between the journal and its consumers.** Seeded hazards H6, H5 and H15. Description: a committed change never reaches a consumer (Hub, tasks, RCM, analytics), reaches it twice and is applied twice, overtakes an earlier event for the same patient, or waits unseen, so downstream systems act on missing, duplicated or stale facts (for example a charge posted twice, an A08 before its A01, a task never created). Causes: an outbox write outside the state-change transaction; a non-idempotent consumer; a partition key other than the patient; a change of a topic's partition count; a replication slot lost or re-created without a snapshot (failover, operator action); a consumer that crash-loops or stalls and so never creates a dead-letter item; head-of-line blocking when one poison event parks a patient's key; a journal replay that reorders a patient's events or re-fires external effects; a patient merge that leaves one person's events under two keys; dead-letter items lost to topic retention; an unowned or unalarmed dead-letter queue. Proposed controls: journal-as-outbox in the same transaction (§6); key sequence and publication watermark check with gap re-publication (§8.3, §10.3); failover slots (DN-J1); at-least-once delivery with idempotent consumers and per-key sequence checks, per-patient keys, fixed partition counts, dead-letter items stored in the consumer's database and never deleted, first-failure clock, independent consumer-lag-age monitor, parking scope declared and alarmed per consumer, replay modes that suppress external effects (`envelope.md` §8–§11); merge ordering handed to `empi` (`envelope.md` OQ-E4). Planned verification: `IntegrationTest:events-per-patient-order-idempotent-consumers`, `PropertyTest:idempotent-consumer-at-least-once`, `PropertyTest:dead-letter-parking-keeps-key-order`, `ChaosTest:broker-loss-no-event-lost`, `ChaosTest:dead-letter-alarm-within-5-minutes`, `ChaosTest:consumer-crash-loop-alarms-within-5-minutes`, `ChaosTest:postgres-failover-no-event-lost`, `IntegrationTest:outbox-debezium-cloudevents`. Owner: `platform-journal-squad` [P]. Initial risk: for CSO triage, not proposed here.
- **HAZ-J2 (proposed): a clinical write is silently lost or wrongly refused at the journal.** Seeded hazards H6, H2. Description: a clinician is told an action was saved when it was not, or a valid write is refused in normal operation, so care proceeds on a missing record (for example a second dose given but not recorded). Causes: an idempotency key reused by another actor or for a different request; a caller committing after a non-`Appended` result; an aggregate write without its journal row; clock skew between nodes making `RecordedTimeRegression` refuse quick successive writes; missing entry-time policy. Proposed controls: per-actor keys with request fingerprints (§4.6); rollback-only and commit check (J-2); bounded retry of `RecordedTimeRegression` within the ADR-026 skew bounds and a clear clock-fault error beyond (§6 step 7); explicit refusal, never silent, when no policy exists (J-7). Planned verification: `PropertyTest:journal-idempotency-key-reuse-with-different-request-refused`, `UnitTest:commit-after-non-appended-result-rolls-back`, `PropertyTest:journal-no-aggregate-write-without-row`, `PropertyTest:SI-10-clock-skew-journal`. Owner: `platform-journal-squad` [P]. Initial risk: for CSO triage.
- **HAZ-J3 (proposed): a read model being rebuilt is shown as complete.** Seeded hazard H5. Description: during a rebuild a worklist or board is empty or partial and looks like "no work", so tasks are missed (SI-03). Causes: rebuilding in place; serving a new projection version before it has caught up. Proposed controls: shadow rebuild with atomic swap; "rebuilding, unavailable, manual check required" status, never an empty result (§8.2). Planned verification: `PropertyTest:read-model-never-served-partial-during-rebuild`. Owner: `platform-journal-squad` [P]. Initial risk: for CSO triage.
- **Proposed tightenings [P]** (for the controls' notes in the hazard log):
  - J-5 chained-correction rules (CTRL-0006-4, -6).
  - J-6 caller expectation must match the journal's classification, and J-17 AtRecordedTime limits (CTRL-0010-1, -3).
  - J-9 back-entry only with a verified episode (CTRL-0010-5, -6).
  - J-10 provenance consistency (CTRL-0010-5).
  - J-11 reasons never defaulted for SI-06 and SI-10 (CTRL-0006-4, -6, CTRL-0010-4).
  - J-14 key fixed at creation (CTRL-0006-6).
  - Row-level security in every topology (§9.4).
  - Administrative retroactive changes treated as back-dating (CTRL-0010-4).

**envelope.md**

- **OQ-E1: the `type` prefix.** CloudEvents recommends a reverse-DNS prefix for `type`. Which domain does the vendor own and want in every event type? Default `hms.` until answered; changing it after the first published event is a breaking change for every consumer, so it should be answered before the first `published` status.
- **ADR-E1: event payload schema language and compatibility mode.** Proposal: JSON Schema in Apicurio with an open content model, full transitive compatibility per major, tolerant readers, breaking changes only as a new major published in parallel for at least 12 months (§7). Context: §5.3 fixes Apicurio and "backward-compatible evolution only" but not the schema language or which direction "backward" protects; both are long-lived contract decisions with every consumer and the published catalogue (R11 §17 #3).
- **OQ-E2: sensitivity labels on events (a reading of SI-21 for the CSO and the privacy officer, §3.4 item 1).** SI-21 asks for labels and purpose-of-use to be enforced at the policy enforcement point for every channel, interfaces and analytics included. Kafka consumers sit behind the backbone, not behind the PEP. This spec's reading: labels travel only in the payload (`meta.security`, required in every patient event from v1, an empty array when none); infrastructure never sees a label beside a patient key; every consumer that discloses outside the clinical core evaluates labels through the Trust Plane SDK's PEP and fails closed on a missing property or an unknown label (§6). Also: should `BreakTheGlassAccess`, which reveals which patients' records were emergency-accessed, go to a restricted trust-plane stream that only `trust-audit` and the privacy office read, rather than the shared patient topic? Proposal: yes, a third stream, decided with this OQ.
- **OQ-E3: free text in payloads.** This spec forbids free text in payloads unless the catalogue entry names the field and why (`freeTextFields`, §6). Confirm, and list the event types that need free text (override reasons, cancellation reasons, configuration change reasons).
- **OQ-E4: per-person ordering across a merge (for `empi`, WP-1.2).** After `PatientMerged` one person's events span two keys (§9). Decide whether `empi` moves the replaced patient's open aggregates to the survivor through an audited workflow, or every per-person-ordered consumer holds the replaced key's later events until it has applied the merge. Test with merge-then-update ordering at the Hub.
- **OQ-E5: test names for the hazard log.** Propose adding `UnitTest:dead-letter-alarm-due-after-5-minutes`, `ChaosTest:dead-letter-alarm-within-5-minutes` and `ChaosTest:consumer-crash-loop-alarms-within-5-minutes` to CTRL-0003-5; `UnitTest:envelope-carries-no-phi-attributes` to CTRL-0020-7; and `ContractTest:SI-21-disclosing-consumer-refuses-unlabelled-event` to CTRL-0021-3 and CTRL-0021-5. Recorded here, not self-approved.
- **KA-E1: the delivery machinery does not exist until the cell.** No dead-letter store, parking, alarm wiring, lag-age monitor, replay job, Apicurio registration or schema file exists in WP-0.3; only the pure rules of §12 and their tests. Crash loops and stalls are therefore not alarmed yet. Hazard references: H5, H6 (HAZ-0003 CTRL-0003-5; HAZ-J1). Backlog: `PLT-CORE-04`. Closes with the WP-0.3 cell slice after WP-0.2 (DN-040). Shared with `platform-journal.md` KA-J2.

**catalogue.md**

- **OQ-C1: names for the unnamed ADT events.** §8.5 lists leave / return (A21 / A22), pending admit (A14), pre-admit (A05) and bed swap (A17) without event names, and R11 §14 names none. Proposed for the `adt` work package to name, in R11's style; until then they are not in the registry (§2.1).
- **OQ-C2: `OrderVerified` and `ResultAmended`.** BP §7.6 uses both; §8.5 neither lists them nor declares them aliases. Is `OrderVerified` an alias of `MedicationVerified`, and is `ResultAmended` an alias of `ResultCorrected` or a separate event (the §8.4 result machine has both "amended" and "corrected" states)? A naming decision for the human lead, next to OQ-036.
- **OQ-C3: owners and producers where R11 §14 names a function, not a module.** `PatientArrived` (`adt`) vs `PatientCheckedIn` (`scheduling`); `ReferralSent`/`ReferralAccepted` (`scheduling`); `IdentityVerified` (`empi`); the result events (schema in `results`, produced by `lis` and `ris`); `ChargeCreated` (schema in `rcm`, produced by the clinical modules) and who writes `ChargeCredited`; the owner of `StaffAssignmentChanged` (care-team assignment, ADR-024: `adt`, `nursing` or a care-team module). Confirm or correct per module work package.
- **OQ-C4: keys for finance and staffing events.** Whether `ClaimSubmitted`/`ClaimAdjudicated` (a corporate or insurer claim may cover many patients), `PaymentReconciled` and `StaffAssignmentChanged` are keyed by patient, by their aggregate or by tenant. Until decided they are not in the registry (§2.1).
===== tenancy
# platform-tenancy.md: review fixes (WP-0.3)

File edited: `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-tenancy.md` (rewritten; a new section 16 lists the sibling interfaces it assumes). After the rewrite I re-read sections 5.4 to 5.7 for consistency and fixed three gaps: D-2 wording, the case where W-5's parent is NotConfigured at COUNTRY_PACK, and the governed-roles flag on the verdict. I did not re-read sections 1 to 5.3 or 6 to 16 line by line. I only searched them for stale terms (UserRef, the old event names, HOLIDAY_LIST, ScopeConfiguration, and others), and found none.

## 1. Critical and major findings

| Finding | Sev | Resolution |
|---|---|---|
| CA-01 / SAF-01 | crit | Fixed. `ConfigurationCommands` is open only to `hms.platform.config` (new ArchTest). A new `ChangeSetVerifier` port is defined in tenancy.api and implemented by config (D12). W-16 verifies tenant, change-set id and `ChangesDigest`. W-17 checks the origin against level and environment: vendor and pack levels only from the matching verified bundle stream; applied change sets only in BUILD or PLAY. W-18 refuses SYNTHETIC in TRAIN and PROD. Provenance now comes from the verdict, not from the command. Section 10 drops "administrators write directly". New tests: `PropertyTest:config-direct-apply-with-unverified-change-set-refused`, `UnitTest:config-origin-must-fit-level-and-environment`, `UnitTest:config-synthetic-change-refused-in-train-and-prod`. |
| CA-02 | crit | Fixed. Each `Direction` carries `DirectionSample(reference, looser, stricter, source)`, supplied and cited by the owning SI's spec. D-7 checks the samples at registration. The harness asserts the looser sample is refused at every level. Changing a sample is a §3.4 item 10 change. New test: `UnitTest:setting-catalogue-direction-samples`. |
| CA-03 / SAF-13 | crit / major | Fixed. `tier2Binding` is a mandatory field with no default; `GatesTier2Function` is refused (D-6). BOOLEAN or ENUM settings owned by Tier 2 modules (`hms.reg..`) are refused [P] (OQ-T11). Acceptance 5 and section 5.9 now claim only what the test proves; CTRL-0018-1 stays planned until the arch rule also passes. **Not applied:** SAF-13's "no definition read from a Tier 2 module's caller". A catalogue cannot see who reads a key, so that is left to `ArchTest:tier-2-activation-only-through-register`. |
| CA-04 / SAF-07 (config file) | crit / major | Tenancy part fixed. `Resolution` gains `Unavailable(cause)`: a store failure is never a default or NotConfigured. Section 16 records that config maps NotConfigured, Refused and Unavailable to its own Unavailable flag outcome. The three-way FlagDecision is config's. |
| SAF-02 | crit | Fixed (D12). `VendorLock.Fixed(direction?)`. D-9 and W-6: a Fixed safety key's vendor value is never looser than the coded default, or must equal it when there is no direction. The read filter ignores planted entries. New test: `PropertyTest:config-chain-fixed-si-parameter-never-loosened-by-bundle`. |
| CA-13 / SAF-03 | major / crit | Fixed. `CLINICAL_TIER` `allowedLevels = {FACILITY}`. D-12: a key that needs site evidence has no vendor, pack or tenant level. R-C now reads "the facility's own value, otherwise the coded CORE". The clinical-tier test adds the vendor and pack cases. |
| SAF-04 (config file) | crit | Tenancy part fixed (D8). In-memory adapters move to `hms.platform.tenancy.inmemory`, marked VOLATILE. In TEST, TRAIN and PROD, assembly refuses to start without durable repositories or an environment class (`UnitTest:tenancy-refuses-to-start-without-durable-repositories`). KA-T1 now states the effect. `IntegrationTest:config-values-survive-restart` is added. |
| CA-05 / SAF-14 | major | Fixed. Uses the kernel's `TenantId`, `FacilityId`, `UserId`, `CommandContext`, `ChangeReason`, `ActorRef`, `AsOf` and `RecordedTime`. The other ids implement `TypedId`. OQ-T1 is closed; old KA-T4 (UserRef) is gone. Section 5.7: `validAt` never defaults and is the clinical time of the act; only `knownAt` may default. |
| CA-06 | major | Fixed. One journal row per accepted batch on one aggregate. Aggregate types are PascalCase (`EnterpriseStructure`, `TenantConfiguration`, `UserPreferences`), with UUID aggregate ids (tenant id or user id). Retroactive changes map to kernel `BackDated` and need the D10 decision, which is refused in WP-0.3 (KA-T5). Refusals go to `TenancyAudit`, never to the journal. |
| CA-07 (config file) | major | Tenancy part fixed: aggregate ids are stated, and partition key = aggregate id (D6). |
| CA-08 / SAF-18 | major | Fixed. Vendor and pack entries are stored as per-tenant copies inside `TenantConfiguration`, written by that tenant's activation. One batch is one aggregate and one expected version; rollout across tenants is config's. |
| CA-09 (config file) | major | Tenancy side offered. `TenantConfiguration` records the last applied origin per stream (W-22, idempotent on manifest hash; `lastActivation` query), so config's anti-rollback can trust a record written in the same transaction. The rest is config's design. |
| CA-10 | major | Fixed. New `ConfigurationQueries`: `entries`, `entryAt`, `chainOf`, `validate` (dry run; returns refusals and the indexes of governed changes), `missingRequired`, `lastActivation`. |
| CA-11 (config file) | major | Tenancy part fixed. Content items are not chain values. New types `CONTENT_REF` and `SET`; key families are allowed only when their members are known at assembly. The content store is config's. |
| CA-12 (config file) | major | Tenancy part fixed. `ScopeAddress` (natural key from H-8 codes) and `resolveAddress`; OQ-T10 asks whether the hierarchy is promoted. |
| CA-14 | major | Fixed. `configurationRequired` (names a control, must be GOVERNED) is allowed instead of a vendor default. W-5 when the parent is NotConfigured: refused below COUNTRY_PACK, governed at COUNTRY_PACK. W-6 handles a missing coded default. DN-T2 asks the CSO. |
| CA-15 / SAF-08 | major | Fixed. The harness has a parameter mode and a rule mode. SI-18 and SI-19 run in rule mode, and SI-18 is defined once. Config's checks and the explicit `vendorLock` on backing settings are recorded as assumptions. **Not applied:** SAF-08's own fix (tag the backing settings `SafetyInvariant(SI-19)`). It would force Fixed or TightenOnly locks and block go-live ON; rule mode avoids that. The SI-19 reading is config's to record. |
| CA-16 / SAF-16 | major | Fixed. W-10 covers all four change kinds and needs `governedRolesApproved` from the verdict. Site evidence is checked separately: every `SettingChange` now carries `evidence`. Config carrying evidence on manifest items is an assumption in section 16. |
| CA-18 | major | Fixed. Holidays are a new `HOLIDAY_CALENDAR` type: a map from year to holidays, with covered years listed. Pack and tenant values merge by union; covered years come only from the least specific level that has a value. New refusals `NO_FACILITY_ZONE` and `INVALID_CALENDAR`, and a composite `CalendarProvenance` with a version digest. |
| CA-20 | major | Fixed. Each user's preferences are a separate `UserPreferences` aggregate, written through `UserPreferenceCommands`. Partition key is the user id. This refines D6's "per tenant", and the spec says so. |
| CA-21 | major | Fixed. `resolve(TypedSettingKey)` always uses the registered definition (`DEFINITION_MISMATCH` otherwise). `SettingDefinition` is no longer a data class. The catalogue is sealed after assembly (D-13), and registration is split out from reads. |
| CA-22 / SAF-25 (config file) | major / minor | Tenancy part fixed. `validFrom = null` means the command's recorded time; clients and bundles send null for "now". Timing classification is left to the kernel classifier inside the appender (D10). |
| SAF-05 | major | Fixed. Strictness is now a partial order (STRICTER, EQUAL, LOOSER, INCOMPARABLE). W-5 refuses an incomparable value. On read, incomparable values give `INCOMPARABLE_VALUES` unless the definition supplies a meet. |
| SAF-06 | major | Fixed. New `SettingGroup` cross-key constraints (W-19, read step 8, `resolveGroup`) and `requiredAt` (W-20, `missingRequired`). Keys are kebab-case; tasks keys are assumed renamed (for example `tasks.orphan.alarm-limit`). |
| SAF-17 | major | Fixed. Event names are the catalogue's (`EnterpriseNodeCreated`, `EnterpriseNodeChanged`, `EnterpriseNodeRetired`, `SettingChanged`) and the partition key follows D6. FlagChanged's actor and reason are config's. |
| SAF-19 (config file) | major | Tenancy part fixed. The obligation text now says NICU, PICU and every inpatient area. The clinical-tier test is marked as a proposed addition to CTRL-0005-14. |

Minor findings also fixed: CA-23, CA-24, CA-25, CA-26, CA-27 (tenancy part; the Gradle dependencies are left to the integrator), CA-28, CA-29, CA-30, CA-31, CA-34, CA-35, CA-36, CA-37, CA-38, SAF-20, SAF-21, SAF-27, SAF-28.

## 2. Interfaces assumed from siblings (spec section 16)

- **Kernel:**
  - `hms.kernel.ids`: `TypedId`, `requireV7`, `TenantId`, `FacilityId`, `UserId`.
  - `hms.kernel.context`: `CommandContext` (with causation id), `ChangeReason`, `ActorRef` with its kind, `TransactionContext` and `TransactionRunner`. The transaction context is assumed to expose the single recorded-time reading that the appender also stamps (OQ-T12).
  - `hms.kernel.time`: `AsOf(validAt: Instant, knownAt: RecordedTime?)` plus a lawful way to build `knownAt` for a query; `RecordedTime`, `ValidPeriod`, `EntryTiming`; `BusinessCalendar.of(zone, weekend, Map<Year, Set<LocalDate>>)`.
  - The D11 policy factories take a tenancy `Resolution.Resolved`, whose constructor is internal.
- **Journal:** `append` in the caller's transaction; PascalCase `AggregateType`; one entry per aggregate per append. The appender stamps the recorded time, derives the entry mode from `CommandContext`, classifies with `EntryTimeClassifier`, and refuses `BackDated` without a `BackDatingAuthorization` decision (always refused in WP-0.3 production).
- **Events:** partition key = aggregate id when there is no patient. Catalogue §4 should describe `SettingChanged` as "one row per batch, listing its changes", and `EnterpriseNodeChanged` as covering moves, country-pack and zone changes.
- **Config:**
  - Implements `ChangeSetVerifier`, returning `humanApproved` and `governedRolesApproved`, and computes the digest with tenancy's `ChangesDigest.of`.
  - Records each activation's diff digest before calling tenancy.
  - Requires the governed roles for the changes that `validate` marks governed.
  - Uses `ConfigurationQueries` instead of re-implementing chain logic, and addresses scopes in bundles by `ScopeAddress`.
  - Carries evidence refs on governed items and sends `validFrom = null` for "now".
  - Uses `CountryPackId("kri")`.
  - Registers flag backing settings with an explicit `vendorLock` and `tier2Binding`.
  - Maps NotConfigured, Refused and Unavailable to its Unavailable flag outcome, and runs the SI-19 harness instance in rule mode.
- **Tasks:**
  - Kebab-case keys: `tasks.orphan.alarm-limit`, `tasks.orphan.scan-interval`, `tasks.orphan.grace`, `tasks.orphan.scan-budget`.
  - SI-03 parameters are TightenOnly, with direction samples taken from SI-03.
  - `S + G + B ≤ L` is declared as a `SettingGroup`; the fallback queue uses `requiredAt`.
  - Uses the D3 calendar keys; escalation policies are content (via `CONTENT_REF`) or a structured type that the tasks spec proposes.
- **EnvironmentClass:** tenancy declares it in its api until a kernel home is decided (OQ-T13).

## 3. Proposed items (local labels)

**Open questions**
- **OQ-T1: closed** by D1 (kernel ids and `hms.kernel.context`) and D6 (partition key). Kept as a label for traceability.
- **OQ-T2: Hierarchy shape choices to confirm with real master data in WP-1.1.** A unit always has a department; departments do not nest; no campus level (R08 §5 has one, §7 item 1 does not); a room hangs only under a unit; service points have a department or facility as organisational parent and a floor or unit as physical parent; cost centres sit under a legal entity; one country pack per tenant (a group spanning the Kurdistan and federal Iraq packs, §11.10, would need a pack per legal entity or facility); code uniqueness per facility for facility-level kinds (H-8). Owner: implementation lead with the first customer's enterprise-structure data (R11 §16).
- **OQ-T3: Who owns the bed.** §8.2 puts the location tree, with "operational status" among bed attributes, in `platform-tenancy`; §5.2 gives beds to `adt`, and §8.4's bed state machine is approved by the nurse panel and bed manager. Proposal: this module owns the bed as a location node with its structural attributes; `adt` owns bed status and occupancy (the §8.4 machine and the exclusion constraint, §9.12).
- **OQ-T4: Calendar levels.** Keys decided by D3 (`calendar.weekend-days`, `calendar.holidays`, levels `COUNTRY_PACK` and `TENANT`; the pack supplies the [L] L-20 items). Open: a facility-level override; which calendar applies to a tenant-level context with no facility zone; and the move of both definitions to `platform-i18n` when it exists (§5.2).
- **OQ-T5: The clinical tier's coded default and its evidence check.** Proposal: coded default `CORE` (K-24: Core-first is the normal entry; `CLINICAL_SAFETY` needs RG1–RG4 evidence, §6.6), facility level only. Who builds the `GovernedChangeVerifier` that checks RG1–RG4 evidence (WP-0.9 release evidence, or `IMP-RDY-01`), and what evidence does a downgrade to `CORE` need?
- **OQ-T6: SIs with no configurable parameter.** The hazard log plans `PropertyTest:config-chain-vendor-lock-SI-nn` for all 21 SIs. Some (for example SI-06, signed notes immutable) may have no parameter at all. Proposal: the harness fails on zero definitions and zero rule checks unless the SI is in a reviewed list with a reason, and such a control is verified by a catalogue rule rather than by a vacuous pass. CSO to confirm the reading.
- **OQ-T7: Another user's preferences.** May an administrator write a user's preferences, or only the user?
- **OQ-T8: moved** to DN-T1 (a reading of CTRL-0018-1 is a decision, not a question).
- **OQ-T9: Configuration reads by every module (D5).** §5.2's dependency column lists only some modules' synchronous calls. D5 lets every module read configuration through `hms.platform.tenancy.api`. Record this against §5.2 for the human lead.
- **OQ-T10: Enterprise structure across environments.** Proposal: the hierarchy is master data per environment, not promoted; bundles address scopes by `ScopeAddress` (H-8 codes), resolved at activation and refused if missing. Alternative: promote the hierarchy in its own signed stream with stable ids. Decide with `platform-config` and the implementation lead.
- **OQ-T11: Tier 2 modules and on/off settings.** D-6 refuses every `BOOLEAN` and `ENUM` definition owned by a Tier 2 module (`hms.reg..`), so an on/off switch there can only be a flag that asks the Register. This may block harmless display settings. Confirm with `safety-registry` and the CSO.
- **OQ-T12: Recorded time before the append.** Tenancy needs the command's single recorded time before it builds its facts (5.7). It assumes the kernel's `TransactionContext` exposes the one clock reading that the journal appender also stamps (D10). If the kernel and journal specs choose otherwise, this is an integration point to settle.
- **OQ-T13: Home of `EnvironmentClass`.** Tenancy (W-18), `platform-config` (G8) and the kernel's policy factories (D11) all need the deployment's environment class. Proposal: one type in `hms.kernel.context`. Until decided, tenancy declares it in its api and `platform-config` maps its `Environment` onto it.

**Decisions needed**
- **DN-T1: Reading of CTRL-0018-1.** CTRL-0018-1 says "Tier 2 activation is vendor-locked in the configuration chain: a tenant may tighten it". This spec keeps activation out of the chain altogether (5.9) and puts the tenant's tightening on the function's kill switch in `platform-config` (SI-19). Proposed amendment to the description: "No configuration layer holds Tier 2 activation; the Register is the only switch. A tenant may keep a cleared function off through its kill switch, and releasing the switch never activates it." It needs every Tier 2 function in the Register to have a `tier2Function`-bound flag (a `platform-config` registry rule). A reading of a hazard control, so the CSO's [HUMAN] (§3.4 item 1). Status: requested.
- **DN-T2: Safety parameters with no coded default.** D-2 lets an SI or tighten-only parameter be declared `configurationRequired` (no coded value) when the CSO has not set one, as the kernel's SI-10 tolerances are (DN-KN1). Its first value then comes only from a governed vendor or pack bundle, and readers fail closed until then. Confirm this route [HUMAN]. Status: requested.

**Known anomalies**
- **KA-T1:** In WP-0.3's first pass `platform-tenancy` has no schema and only volatile in-memory repositories. An in-memory store would lose tenant tightenings on restart, so `app-hms` refuses to start in TEST, TRAIN and PROD (D8; `UnitTest:tenancy-refuses-to-start-without-durable-repositories`). The lock exit criterion is evidenced at domain level only; `IntegrationTest:config-chain-lock-persisted` waits for the cell (DN-040).
- **KA-T2:** `TenancyAuthorization` and `TenancyAudit` have no production adapters before WP-0.4. Deployed wiring denies every structure and configuration write (`UnitTest:tenancy-deployed-wiring-denies-every-write`); test adapters permit them.
- **KA-T3:** No `GovernedChangeVerifier` exists. Deployed wiring refuses every change that needs site evidence, so no facility can change its clinical tier until the verifier is built (OQ-T5; `UnitTest:governed-change-refused-without-verifier`).
- **KA-T4:** `ChangeSetVerifier` has no production binding until `platform-config` has persistence. Every configuration write is refused in a deployed system (`UnitTest:config-write-refused-when-verifier-missing-or-unavailable`). User preferences are unaffected but also denied by KA-T2.
- **KA-T5:** The journal's production back-dating binding refuses every back-dated append until WP-0.4 (D10), so no retroactive structure or configuration change is possible (`UnitTest:config-retroactive-ordinary-change-refused-without-back-dating-decision`).

**Proposed hazard**
- **HAZ-T1: The configuration chain resolves an unintended value for a safety-relevant setting.**
  - *Description:* a context resolves a value that no authorised decision intended: a looser SI parameter, a below-lock override, a value written outside the governed path, or another facility's clinical tier.
  - *Causes:*
    - a lock masking a stricter lower value;
    - a parent or vendor tightening that leaves an older lower value looser;
    - a reversed strictness comparator;
    - incomparable values resolved arbitrarily;
    - a vendor bundle loosening a `Fixed` SI parameter;
    - a direct write with a fabricated change set or synthetic content;
    - a vendor-level clinical tier;
    - a cross-key constraint broken by one tightened key;
    - a unit whose physical and organisational facilities disagree;
    - a resolution context that does not match the hierarchy;
    - a retroactive change rewriting what applied in the past;
    - a race between a parent lock and a child write;
    - a routine relaxation of a tenant's own SI tightening;
    - volatile storage losing tightenings on restart;
    - a stale cache (later);
    - over-tightening, which can also harm: an alarm or hard-stop flood (alert fatigue, H4) or a near-zero scan interval overloading a scanner. The type bounds that limit this are owner-sourced values (5.3).
  - *Effects:* an SI or a fallback control weakened at one scope without a decision (for example a later orphan alarm, H5; a delayed escalation, H4); a unit of a `CORE` facility treated as `CLINICAL_SAFETY`, or the reverse (H2); configuration that differs from what was approved (H6).
  - *Seeded hazards:* H2, H4, H5, H6.
  - *Proposed controls:* D-2 … D-13; W-4 … W-7, W-10, W-11, W-14, W-16 … W-23; read steps 3, 5 and 8; H-7; `INCONSISTENT_CONTEXT`; per-tenant aggregate versions; the start-up refusal of volatile storage.
  - *Planned verification:* the property and unit tests of section 13 (lock, tighten-only, direction samples, fixed SI, relaxation, groups, unverified change set, synthetic, as-was, clinical tier, hierarchy invariants, tenant isolation, start-up refusal), `IntegrationTest:config-chain-lock-persisted` and `IntegrationTest:config-values-survive-restart`.
  - *Initial risk:* for CSO triage [HUMAN]; agent proposal severity major, likelihood remote (medium on the log's matrix).

**ADR:** none proposed.

**Tightenings [P] to record (§3.4 item 1), each against the CTRL-00nn-1 preamble controls unless stated:**
1. Safety-classified settings never have a user level (D-4).
2. Tighten-only is checked against the parent's effective value, not only the vendor's (W-5).
3. Reads of tighten-only keys return the strictest value on the chain, so a later tightening above always wins; incomparable values are refused, never picked (step 5, R-T).
4. A vendor value looser than the coded default is refused for tighten-only and `Fixed` SI keys; loosening an SI parameter is a code change with hazard-log review (W-6; D-9).
5. Governed locks are not allowed on tighten-only keys, so a lock can never loosen (D-5).
6. Safety-classified keys cannot be changed retroactively (W-11; CTRL-0010-1).
7. No definition may bind a Tier 2 function; the `tier2` namespace is reserved; Tier 2 modules own no on/off setting (D-6; CTRL-0018-1; DN-T1).
8. The clinical tier exists at the facility level only, with no vendor, pack or tenant value, and every change needs approval and site evidence (5.8; D-12; CTRL-0005-14).
9. Reads ignore values below a lock, at a level the definition does not allow, or looser than a safety key's coded default, as defence in depth (step 3).
10. Every tighten-only direction is proven by owner-supplied samples at registration (D-7).
11. A relaxation of a tighten-only value, even one still at least as strict as the parent, is a governed change (W-23).
12. Tenancy refuses synthetic content in TRAIN and PROD itself, behind `platform-config`'s gate G8 (W-18; §19.4).
13. The chain has no direct administrator write path: every non-user write is a verified change set or bundle (W-16, W-17; D12).
===== config
## platform-config.md: review fixes

I rewrote `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-config.md` and then re-read it for consistency. No other file was touched, and git state is unchanged. Every critical and major finding was fixed. Four were fixed differently from the recommendation, and two parts of recommendations were not applied; the reasons are in the table.

### Critical and major findings

| ID | Sev | Resolution |
|---|---|---|
| CA-04 | crit | Fixed. `FlagDecision` now has three outcomes: `On`, `Off(reason)` and `Unavailable(reason, handling)`. Each flag declares what "unavailable" means (`UnavailableHandling`). `CDS_RULE` flags are forced to MANUAL_CHECK_REQUIRED. Tier 2-bound flags are forced to TREAT_AS_OFF. No failure ever yields On (INV-3, INV-23, §6.2). New test `PropertyTest:SI-19-evaluation-failure-never-silent`. |
| SAF-04 | crit | Fixed under D8. In-memory adapters move to `hms.platform.config.inmemory`. Production wiring binds no repository, so the app refuses to start. Three mechanisms: an unsatisfied port, an ArchTest, and a `ConfigPersistenceGuard`. Two tests: `IntegrationTest:app-hms-refuses-to-start-with-volatile-config-state` now, and `IntegrationTest:kill-switch-survives-restart` with the persistence slice. The KA text now states the restart effect. |
| CA-01 / SAF-01 (shared) | crit | Fixed on the config side (§5.7, INV-19). Tenancy's api defines a `ChangeOriginVerifier` port and config implements it. It checks the change set or bundle activation: state, tenant, environment, batch digest, human approvals, and no SYNTHETIC in TRAIN/PROD. There is now one write path; administrators work through change sets (a tightening [P]). New test `PropertyTest:fabricated-change-origin-writes-nothing`. |
| CA-03 / SAF-13 (shared) | crit/maj | Config side fixed: INV-6 and G12 now rely on tenancy's catalogue refusing any Tier-2-binding attribute (D12). A flag's backing setting declares only a Tier-2 restriction, never a binding. |
| CA-07 | maj | Fixed. Partition key is the aggregate id (D6). There is now one `KillSwitchBoard` per tenant, with aggregate id = tenant id, so one tenant's switch events stay in order. No ordering is promised across aggregates, and caches re-read state instead of relying on event order. |
| CA-09 | maj | Fixed (§5.7). Activation and change-set apply are two commits: config marks the activation pending, tenancy writes the values plus a stream head in its own transaction, then config completes. A reconciler finishes interrupted runs. Anti-rollback trusts tenancy's stream head. New test `PropertyTest:activation-interrupted-between-commits-reconciles`. Also proposed as ADR-CFG-2. |
| CA-11 | maj | Fixed (§5.8). The chain holds `CONTENT_REF` values under key families `content.<type>.<item>`. Config holds the bodies in a content-addressed store, read through `ContentReader`. If tenancy does not provide this, G5 refuses content items. |
| CA-12 | maj | Fixed (§5.9). Bundles address scopes by `ScopePath` (tenant code plus node codes), never database ids. The stream is named `TENANT_OVERLAY:<tenant code>`. New gate G13 refuses unresolvable paths. New test for promoting a unit-scoped item BUILD → TEST. |
| CA-15 / SAF-08 | maj | Fixed (§6.5). The SI-19 "lock" covers rules, not flag values. Backing settings are explicitly `SafetyRelevant` with `VendorLock.None`. The SI-19 test instance is config's own property, not tenancy's W-4…W-7 harness. The reading goes to the CSO as DN-CFG-3, and CTRL-0019-1 stays planned until then. |
| CA-17 | maj | Fixed (INV-4). A live evaluation always uses the current kill-switch state, whatever `validAt` is. An as-was evaluation uses switch history up to `knownAt`. New test `PropertyTest:SI-19-kill-switch-live-and-as-was`. |
| CA-19 / SAF-15 | maj | Fixed (§7). The merge table is now ordered, first match wins. Incomparable tighten-only values give a blocking `CONFLICT_SAFETY`. New test `PropertyTest:merge-each-override-matches-exactly-one-rule`. One part differs from the recommendation: `DROPPED_LOCKED` blocks for every safety-classified key, not only when the tenant value was stricter, because `Fixed` keys have no comparator. |
| CA-22 / SAF-25 | maj | Mostly fixed (§5.10). `ChangeItem` gains `validFrom` and `validTo`. A null start means "from the apply or activation recorded time". An explicit past start is refused at submit and at G7. **Not applied:** classifying `validFrom` with `EntryTimeClassifier`. A setting's valid period is not a clinical time: the classifier would refuse future-dated settings as CLINICAL_TIME_IN_FUTURE, and it has no vendor tolerances yet (DN-KN1). |
| CA-05 / SAF-14 (shared) | maj | Config side fixed. Config's own `ChangeReason` is deleted. It now uses kernel `CommandContext` (causation id included), `ActorRef`, kernel ids and kernel `AsOf`. `validAt` never defaults. |
| CA-06 (shared, config parts) | maj | Fixed. Journal type names are PascalCase (`ConfigChangeSet`, `KillSwitchBoard`, `StreamActivation`, `FeatureFlag`). Each command writes one row per aggregate. Refused commands go to the audit port, while a gate run that refuses an activation is a journaled outcome. |
| CA-10 (shared) | maj | Config side fixed. §3.1 lists the tenancy operations needed (`entryAt`, `entries`, `validate`, `chainOf`, `streamHead`, `pathOf`/`scopeByPath`), each with a fail-closed fallback if not provided. Compare-and-set (INV-8) now uses raw entries. |
| CA-14 (shared) | maj | Config side fixed. `engagement-task-sla` is removed; the SLA now comes from the task kind's definition in platform-tasks (D14). |
| CA-16 / SAF-16 | maj | Fixed. `ChangeItem.evidence` and the manifest's `evidenceRef` are required for GOVERNED keys and checked at G9, then passed into `SetValue.evidence`. §8 states the one write path for governed values. |
| SAF-05 (shared) | maj | Config side fixed. The approver-roles key is `ROLE_SET`, tighten-only under a partial order (a superset is stricter). If tenancy lacks it, roles are vendor-only. |
| SAF-07 | maj | Fixed, same change as CA-04. Unreadable kill-switch state is never On, with the per-kind reasoning written out in §6.2. |
| SAF-09 | maj | Fixed. `CDS_RULE` and `CLINICAL_BEHAVIOUR` backing settings are GOVERNED in both directions, with the CSO among approvers. A CDS rule set OFF by value raises the review task and appears on the engaged-switch views. ON values may only come from TENANT_OVERLAY. CTRL-0014-5 runs on that go-live bundle. Differs from the recommendation: this covers every CDS rule, not only Tier A/B, because config cannot see a rule's tier. |
| SAF-10 | maj | Fixed differently from the recommendation: the question is now DN-CFG-2 for the CSO, blocking R1 go-live, with three options and no default chosen; picking break-glass versus refusal is the CSO's decision. KA-CFG-4 is linked to CTRL-0019-3, and no flagged clinical behaviour goes live until the DN is answered. |
| SAF-11 | maj | Fixed differently from the recommendation: `reviewRef` is checked against an in-config human review (`recordReview`) instead of an external port. Release needs a RELEASE_APPROVED review recorded after the latest engagement (refusal `REVIEW_REQUIRED`). New test `UnitTest:kill-switch-release-needs-review`. |
| SAF-12 | maj | Fixed differently from the recommendation: the engage transaction writes a `TaskRequested` row, which platform-tasks reads from the journal (D14), instead of a Kafka consumer. Kind is `platform.config.kill-switch-review`, priority STAT. Owner comes from `platform.config.killswitch.review-queue`. If that queue is not configured, the request is written with no owner, takes the dead-letter path with its 5-minute alarm (D15), and config raises an alarm. Engagement never fails because of this (INV-21). |
| SAF-17 (shared) | maj | Config side fixed. Event names follow the catalogue (`ChangeSetApplied`, `BundlePromoted`, `BundlePromotionRefused`, `FeatureFlagChanged`, `KillSwitch*`); new events are marked as additions. Actor, on-behalf-of and reason are now in the payloads. |
| SAF-18 | maj | Fixed. Activation is per tenant; INV-11 and INV-12 are per tenant; rollout behaviour across tenants is stated (§5.3). |
| SAF-19 | maj | Partly applied. INV-18 adds the registry refusal `CLOSED_LOOP_FLAG_BELOW_FACILITY`, with test `UnitTest:closed-loop-flag-below-facility-refused`, proposed as an addition to CTRL-0005-14. **Not applied:** the arch rule that orders, medications and transfusion "derive closed-loop capabilities only from the clinical tier". ArchUnit cannot see "derives a capability"; the readers' `PropertyTest:clinical-tier-has-no-partial-loop` covers it. |

These minor findings were also fixed: CA-23, CA-27, CA-32, CA-33, SAF-22, SAF-23, SAF-24, SAF-26, SAF-29.

### Interfaces I assume from sibling specs

**Tenancy** (their names win; each has a fail-closed fallback in §3.1):
- `ConfigurationCommands.apply` takes a `ChangeOrigin` (a change set, or a bundle with stream, sequence, manifest hash and activation id). It is idempotent on the origin and restricted by an arch rule to config and tenancy's own USER-preference handler.
- `ChangeOriginVerifier.verify(tenant, origin, batchDigest)` returns Confirmed or Refused. Tenancy defines it; config implements it.
- `ApplyConfigurationChanges.digest()`, `validate()` (dry run), `entryAt`, `entries`, `chainOf`.
- `streamHead(tenant, stream)`, written in the same transaction as a bundle batch; tenancy refuses a sequence that is not above it.
- `EnterpriseDirectory.pathOf` and `scopeByPath`.
- Value types `CONTENT_REF`, `ROLE_SET` and the queue-reference type, plus key families.
- Tier-2 binding attribute (refused by the catalogue) versus Tier-2 restriction attribute (accepted).
- `EvidenceRef` as a tagged union on every `SettingChange`; `Strictness` as a partial order.
- Vendor and pack values stored in each tenant's database.
- The SI-19 harness instance is accepted from config.

**Kernel:**
- `hms.kernel.context`: `CommandContext` (with causation id), `ChangeReason`, `ActorRef` with kind, `IdempotencyKey`, `CorrelationId`, `TransactionContext`, `TransactionRunner`.
- `hms.kernel.ids`: `TenantId`, `FacilityId`, `UserId`.
- `hms.kernel.time`: `AsOf(validAt, knownAt: RecordedTime?)` plus the kernel's as-was constructor (D4); `EntryTiming`, with the appender classifying entries (D10).
- `ContentProvenance` as a shared kernel type.
- The D11 production gate reads the environment class from config's `platform.config.environment`.

**Journal:**
- `JournalAppender.append(tx, context, entries)`, with PascalCase `AggregateType`.
- One row per aggregate per append.
- `byIdempotencyKey` for retries.

**Tasks:**
- The `hms.platform.tasks.api` types `CreateTask`, `TaskKind`, `FocusRef`, `Owner` and `TaskPriority.STAT`.
- `TaskRequested` rows are read from the journal behind a watermark, and a row with no task past the grace becomes `TaskOrphaned` (D14).
- A `tasks.kinds.<kind>` registration, with SLA and escalation tighten-only for safety-relevant kinds.
- Tenant-level tasks route to the tenant-level fallback queue.
- `OWNER_MISSING` turns a request into a dead-letter task with the 5-minute alarm (D15).
- A by-focus-owner completion request row written through the journal.

**Events:** the catalogue adds `ChangeSetSubmitted`, `ChangeSetApproved`, `ChangeSetRejected`, `ChangeSetWithdrawn`, `ChangeSetStale`, `ChangeSetApplyStarted`, `ChangeSetApplyRefused`, `BundleActivationPending`, `OverlayMergeCompleted`, `KillSwitchEngagementConfirmed` and `KillSwitchReviewed`.

**Gradle (for the integrator):** `:modules:platform-config` needs `:platform:journal`, `:platform:events` and the platform-tasks api added.

### Proposed items (local labels)

**Open questions**
- **OQ-CFG-1 (D5):** §5.2 lists only Trust as a dependency for platform-config. This spec depends on `hms.platform.tenancy.api`, as the governed write path into the chain, and on `hms.platform.tasks.api` for the `TaskRequested` payload types only. Proposal: record both in the module map.
- **OQ-CFG-2 (CSO, Trust Plane):** Who may engage, review and release kill switches, per scope? Default: three separate permissions, and release needs a RELEASE_APPROVED review. Should the reviewer have to be a different person from the one who engaged?
- **OQ-CFG-3 (CSO):** What does engaging a kill switch on a Tier A hard stop or a Tier B baseline rule require? Options: anyone with the engage permission; a second person or the CSO; a mandatory time limit; a compensating manual check while engaged. Interim default: the engage permission, step-up authentication, a reason, a STAT review task, and the rule's registry status untouched.
- **OQ-CFG-4:** What are the maximum propagation delay of a kill switch across cell nodes (`platform.config.killswitch.max-propagation`) and the reconciliation bound of §5.7? No source sets them. They are to be set with the WP-0.2 cell and confirmed by the CSO.
- **OQ-CFG-5:** Should a vendor-signed kill-switch directive apply at once at every cell, without the promotion gates? Default: not built; a hospital engages locally after a field safety notice.
- **OQ-CFG-6 [P]:** PLAY is a sink: nothing is promoted out of it, and changes are re-authored in BUILD. Confirm.
- **OQ-CFG-7 [P]:** The author of a change set cannot approve it, and this is now code. Confirm, or name the content types where one person may do both (that would be a code change with hazard review).
- **OQ-CFG-8 [P]:** Every non-safety merge conflict blocks until a human resolves it. Should an owning module be able to declare "keep the tenant value" for a non-safety key?
- **OQ-CFG-9:** Does SI-19 clause b also govern safety-relevant setting values delivered in a bundle, beyond flags? Default [P]: such an item needs CSO approval, as a C1 flag does.
- **OQ-CFG-10:** Who checks a flag's OPERATIONAL claim, and a CLINICAL_BEHAVIOUR flag's declared `whenUnavailable`? Default: the owning module's hazard analysis and code review state it, and both are listed in the Release Evidence Pack.
- **OQ-CFG-11 [P]:** Confirm the canonical JSON subset of §5.5, and decide whether to claim RFC 8785 conformance for it.
- **OQ-CFG-12 [P]:** In TEST, TRAIN and PROD, are runtime changes outside bundles limited to kill switches, reviews and USER preferences, and are retroactive items never allowed in bundles? Confirm, or name operational settings that need a faster path.
- **OQ-CFG-13 (with platform-tasks):** Proposal: escalation policies `tasks.escalation.policies.<id>` become the content type `tasks.escalation-policy`, read through `ContentReader`.
- **OQ-CFG-14 [P]:** Bundles address scopes by code paths, and each environment sets up its own enterprise structure. Should the structure instead travel in its own signed stream with stable ids?

**Known anomalies**
- **KA-CFG-1:** The production trust store is empty and the production signer returns SIGNING_UNAVAILABLE, so no bundle can be built or activated outside tests (HAZ-CFG-A). Closes with ADR-CFG-1 and DN-CFG-1.
- **KA-CFG-2:** The production HumanApprovalSource confirms nothing, so no change set with APPROVED items reaches APPROVED outside tests, and nothing needing approval can reach TRAIN or PROD (HAZ-0019; HAZ-CFG-A). Closes with WP-0.4 and OQ-005.
- **KA-CFG-3:** Governed values cannot be activated until tenancy's GovernedChangeVerifier and evidence model exist. No facility can move to CLINICAL_SAFETY and no CDS rule flag can be turned on (HAZ-0005; HAZ-0019). Closes with tenancy's verifier (WP-0.9, IMP-RDY-01).
- **KA-CFG-4:** ConfigAuthorization denies everything in production, so no one can engage, review or release a kill switch in a deployed system. A stop that cannot be used fails SI-19 clause a. Until DN-CFG-2 is answered, no clinical behaviour behind a flag may go live (HAZ-0019 CTRL-0019-3; HAZ-CFG-C). Closes with WP-0.4 and DN-CFG-2.
- **KA-CFG-5:** Refused commands go to an operational log adapter, not a BALP audit (HAZ-CFG-C). Closes with WP-0.4.
- **KA-CFG-6:** There are no persistent repositories. Production binds none and the app refuses to start with this module wired. An in-memory kill switch would be lost on restart and silently released, which is why none is bound. Propagation across cell nodes is unproven (HAZ-0019 CTRL-0019-3). Closes with the schema slice and the WP-0.2 cell.
- **KA-CFG-7:** The production Register port answers UNAVAILABLE, so every Tier 2-bound flag is Unavailable and handled as off; the fallback control sets stay in force (HAZ-0018). Closes with WP-0.9.
- **KA-CFG-8:** The terminology port fails closed, so any item with coded references fails G6 (HAZ-CFG-A). Closes with WP-1.1.
- **KA-CFG-9:** Some tenancy interfaces assumed in §3.1 may be missing in WP-0.3. Each missing one disables its feature through the fail-closed fallback stated there (HAZ-CFG-A). Closes with tenancy's revised spec.

**Hazards**
- **HAZ-CFG-A: Tampered, unsigned, rolled-back, synthetic, unapproved or unverified configuration takes effect.**
  - Causes: a bundle altered after signing; an untrusted, revoked or wrong-role key; a revoked key restored by a release rollback; activation without verification; an older bundle replayed; synthetic thresholds or codes promoted; an approval recorded by a system or agent; a direct chain write with a fabricated change set or provenance; a partial two-module activation; a scope mis-mapped across environments.
  - Effects: wrong order sets, rules, escalation policies or thresholds reach patients; a safety tightening is reverted.
  - Seeded hazards H2, H4, H6. Agent proposal for CSO triage: severity major, likelihood remote.
  - Controls:
    - CTRL-CFG-A-1, G1–G4 with monotonic revocations: `PropertyTest:bundle-any-altered-byte-refused`, `UnitTest:bundle-untrusted-or-revoked-key-refused`, `UnitTest:empty-trust-store-refuses-every-bundle`, `PropertyTest:bundle-anti-rollback`, `UnitTest:release-rollback-keeps-revocations`.
    - CTRL-CFG-A-2, G8 plus the verifier's runtime refusal: `PromotionGate:synthetic-item-blocks-train-and-prod`, `UnitTest:origin-verifier-refuses-synthetic-in-train-and-prod`.
    - CTRL-CFG-A-3, approvals only from humans: `PropertyTest:change-set-approval-only-from-human-evidence`, `IntegrationTest:bundle-approvals-only-from-sign-off-records`.
    - CTRL-CFG-A-4, per-tenant atomic activation with reconciliation: `PropertyTest:refused-activation-changes-nothing`, `PropertyTest:activation-interrupted-between-commits-reconciles`.
    - CTRL-CFG-A-5, deterministic canonical form: `PropertyTest:canonical-serialisation-deterministic`.
    - CTRL-CFG-A-6, origin verification: `PropertyTest:fabricated-change-origin-writes-nothing`.
    - CTRL-CFG-A-7, G13 scope paths: `UnitTest:node-scoped-item-promotes-build-to-test`, `UnitTest:unresolvable-scope-path-refuses-activation`.
- **HAZ-CFG-B: An upgrade merge silently loses or loosens a tenant's safety setting.**
  - Causes: a tightening dropped; a safety conflict auto-resolved; overlapping rules applied in an arbitrary order; incomparable values; a vendor turning a key Fixed with a value looser than the tenant's; removed or retyped keys handled silently.
  - Effects: a hospital's stricter safety parameter returns to the looser vendor value without anyone deciding it.
  - Seeded hazards H2, H4. Agent proposal: severity major, likelihood occasional, level high.
  - Controls:
    - CTRL-CFG-B-1, the ordered rules: `PropertyTest:merge-each-override-matches-exactly-one-rule`, `PropertyTest:merge-never-drops-a-tenant-value-silently`, `PropertyTest:merge-tightening-kept-while-stricter`, `PropertyTest:merge-safety-conflict-never-auto-resolved`.
    - CTRL-CFG-B-2: `UnitTest:bundle-build-refused-with-unresolved-merge`.
    - CTRL-CFG-B-3: `PropertyTest:merged-overlay-passes-lock-gate-or-is-refused`.
- **HAZ-CFG-C: A safety rule or behaviour is switched off without authority, review or anyone noticing, or cannot be switched off when needed.**
  - Causes: engagement without the role; engagement left in place indefinitely; a Tier A stop treated as retirement; no owner told; a CDS rule switched off by an ordinary value change; release without review; engagement failing for lack of task configuration; no one able to engage while authorisation is unavailable.
  - Effects: a governed protection is absent while clinicians assume it is active, or a faulty rule keeps firing.
  - Seeded hazards H2, H4. Agent proposal: severity major, likelihood remote.
  - Controls:
    - CTRL-CFG-C-1, permission, human actor, step-up and review before release: `PropertyTest:SI-19-flag-change-reason-never-defaulted`, `UnitTest:kill-switch-engage-needs-permission`, `UnitTest:kill-switch-release-needs-review`.
    - CTRL-CFG-C-2, a STAT owned review task requested in the same transaction: `UnitTest:kill-switch-engagement-writes-task-request`, `UnitTest:kill-switch-engages-without-review-queue`, `UnitTest:cds-rule-off-by-value-requests-review-task`, `IntegrationTest:kill-switch-engagement-raises-owned-task`.
    - CTRL-CFG-C-3, INV-16: `UnitTest:kill-switch-never-retires-a-rule`.
    - CTRL-CFG-C-4, visibility: `AcceptanceTest:engaged-kill-switches-listed`.
    - CTRL-CFG-C-5, CDS flags governed in both directions: `UnitTest:cds-rule-flag-backing-setting-governed`.
- **New causes for HAZ-0019:**
  - A failed flag evaluation is read as OFF, so a CDS rule's protection is silently absent: `PropertyTest:SI-19-evaluation-failure-never-silent`.
  - Kill-switch state held in memory is lost on restart or failover: `IntegrationTest:app-hms-refuses-to-start-with-volatile-config-state` now, and `IntegrationTest:kill-switch-survives-restart` later.
  - No one can engage while authorisation is unavailable: DN-CFG-2.
- **Proposed additions to the hazard log's planned verification:** `UnitTest:kill-switch-never-retires-a-rule` to CTRL-0014-7, and `UnitTest:closed-loop-flag-below-facility-refused` to CTRL-0005-14.

**ADRs**
- **ADR-CFG-1 (configuration bundle signing and trust):**
  - Ed25519 through the JDK provider.
  - Key roles: vendor content and tenant configuration.
  - The trust store ships in the signed release.
  - Rotation and revocation, with the revocation-set sequence kept outside the release so a rollback cannot restore a revoked key.
  - Anti-rollback per tenant and stream.
  - How promotion records travel between environments.
  - Key custody (TPM or HSM, aligned with ADR-008) and escrow.
  - Reopen if a Kurdistan rule or a buyer requires a different algorithm or a transparency log.
- **ADR-CFG-2 (governed configuration writes across the module boundary):**
  - Tenancy verifies every non-USER write through `ChangeOriginVerifier`, implemented by config.
  - Activation and apply are two commits, with tenancy's stream head as the anti-rollback authority and a reconciler for the second commit.
  - Content bodies sit in a content-addressed store; references sit in the chain.
  - Scopes are addressed by code paths across environments.
  - Guarded by `PropertyTest:fabricated-change-origin-writes-nothing` and `PropertyTest:activation-interrupted-between-commits-reconciles`.
  - Reopen if config and tenancy are ever allowed one transaction.

**Decisions needed** (each [HUMAN], status requested, approver and date empty)
- **DN-CFG-1:** Production custody of the configuration-signing keys (§4.3). Blocks activation outside tests (KA-CFG-1), not WP-0.3's domain work.
- **DN-CFG-2 (CSO):** Engaging a kill switch when no authorisation decision can be made. Choosing between an unusable stop and an unauthorised one is a patient-safety choice and a reading of SI-19 clause a (§3.4 items 1 and 8). Options:
  - (a) refuse, and accept that the stop is unusable during the outage;
  - (b) a local break-glass engage path: audited, step-up on cell-local credentials, mandatory review afterwards;
  - (c) engage-only break-glass (never release) for named roles held locally.

  No default is chosen. Blocks R1 go-live of any clinical behaviour behind a flag (KA-CFG-4; CTRL-0019-3).
- **DN-CFG-3 (CSO):** What "vendor-locked" means for SI-19 in the configuration chain. This spec reads it as locking SI-19's rules, not flag values (§6.5); a tighten-only flag value would stop any tenant from turning a validated baseline on. Blocks CTRL-0019-1 from leaving planned.
===== tasks
I rewrote both files and fixed every critical and major finding. Most are applied as the reviewers asked; ten are applied a different way or in part, and the table gives each reason. `sh tools/hms safety check` passes after the `task.yaml` changes, and every guard in the YAML names a predicate it declares. No other file was touched.

Files:
- C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-tasks.md (substantially rewritten, about 800 lines)
- C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\state-machines\task.yaml (21 transitions)

## Critical and major findings

| ID | Sev | Resolution |
|---|---|---|
| CA-01 | crit | Fixed. There are now two scan scopes, `ScanScope.Facility` and `ScanScope.Tenant`, each with its own watermark, heartbeat and watchdog. Pools and queues can be tenant-level. Fallback queues are resolved facility first, then tenant. Test `UnitTest:tenant-level-task-orphan-detected`; the chaos test seeds tenant-level work. |
| CA-02 | crit | Fixed. The dead-letter SLA starts at `firstFailureAt`, and the task is due at `firstFailureAt + A − T`, so the alarm is never late by the tick. An item that arrives late is created already breached. Boundary test with retries. Assumes the events spec keeps consumer retry windows shorter than `A` (A-5). |
| CA-03 | crit | Fixed (§4.4). The SLA starts at the `TaskRequested` row's recorded time. Every orphan scan also looks back for requests with no task and opens a `REQUEST_NOT_MATERIALISED` episode within the 5-minute bound. A refused request alarms at once. Requests are read from the journal with a watermark, not through Kafka (D14). |
| CA-04 | major | Fixed. New `KernelTaskCommands(tx: TransactionContext, ctx, cmd)`. It never opens a transaction of its own. |
| CA-05 | major | Fixed. A kernel caller must roll back on any result other than `Created`. Added `requireCreated()`, the `KernelTaskCallerContract` test kit and `PropertyTest:SI-03-kernel-caller-rolls-back-on-task-rejection`. |
| CA-06 | major | Fixed. Each command appends one journal entry per aggregate. Episode-closing facts travel as a field on the command's own event. Escalation is one step per command. Idempotency keys are derived (`tasks:` + SHA-256 of caller key, operation and task id). `IdempotencyStore` is removed. Side effect: an unroutable owner at creation now alarms at the first scan without grace, not inside the creating transaction. |
| CA-07 | major | Fixed in part. The operational alarm now comes from an after-commit relay: at-least-once, deduplicated on the episode id, retried. `detectedAt` is the recorded time of the `TaskOrphaned` row. Not applied: a per-episode alarm before commit, because it would duplicate alarms. Instead, `OrphanDetectionDegraded` uses a path that needs no database when a commit fails. |
| CA-08 | major | Fixed. Scans are fixed-rate. The bound is now `C + S + G + B + F ≤ L`, where `F` is leader takeover and `C` is directory staleness. The database RTO limit is stated, with a degraded alarm and the residual risk in HAZ-TK7. |
| CA-09 | major | Fixed. No step ever moves work to an owner who cannot act. An unroutable non-terminal target is skipped. An unroutable terminal target fails the step: the holder stays and an escalation-failed task and alarm are raised. New YAML predicates `stepTargetRoutable`, `stepTargetUnroutable`, `stepIsTerminal`, `stepNotTerminal`. A failed step is recorded once. |
| CA-10 | major | Fixed. `Release` has an `ownerRoutable` guard and refusal `OwnerNotRoutable`. |
| CA-11 | major | Fixed. The three uses of routability are separated (§3.3). An authenticated session counts as routable for self-claim. Moving work during an outage is allowed only to a target last known routable, and is flagged. Recorded as DN-TK3. |
| CA-12 | major | Fixed. The scan, timers, intake, relay and sink act as the SYSTEM actor and never consult the user-authorisation port. Platform kinds are never refused for missing settings. A refused alarm path raises `AlarmPathRefused` and retries. |
| CA-13 | major | Fixed. Keys follow tenancy's grammar (`platform.tasks.orphan-alarm.max-delay`, etc.) and use closed value types (queue codes are `STRING`). Task kinds are code, with per-kind tighten-only SLA settings. Escalation policies are config content (D2). The dead-letter setting's owner is OQ-TK14. |
| CA-14 | major | Fixed. Pools and queues have stable codes. A `FallbackQueueActivationCheck` blocks activation, plus a run-time resolution check. |
| CA-15 | major | Fixed. All ids and context use the kernel types (D1). The CommandContext question is removed. `ReasonCode` is the coded form of `ChangeReason`. Reads take `CommandContext`. |
| CA-16 | major | Fixed (D3). `calendar.weekend-days` and `calendar.holidays` come through `CalendarReader`, with country-pack values from L-20 and no vendor value. Facility override is OQ-TK8. |
| CA-17 | major | Fixed (D8). In-memory adapters move to `...infrastructure.inmemory` and `...testing`, never bound by app-hms. `TasksPersistenceGuard` makes app-hms refuse to start without task persistence, with a named test. |
| CA-18 | major | Fixed. The `tasks` schema, migrations and jOOQ repositories are written in WP-0.3, with integration tests waiting for the cell. Table shapes are listed. This goes beyond the WP-0.3 page's list, so the integrator should confirm (OQ-TK11). |
| CA-19 | major | Fixed. New §3.7 records the deviation from §8.2 and how order and task terminal states are linked (DN-TK7). |
| CA-20 | major | Fixed. The Tier 2 contract is one message, `EscalationTaskRequestV1`, versioned on its own. Its transport is OQ-TK10. |
| CA-21 | major | Fixed. Added eight pool/queue events and three request events, plus a list of catalogue corrections for the integrator. |
| CA-22 | major | Fixed. Owner is the consumer's own team queue code, with fallbacks. One alarm source (this module's timer). The sink port is `DeadLetterSink` (A-5). The CTRL-0003-5 reading is DN-TK4. |
| CA-23 | major | Fixed. New `TaskCompletionRequested` and `TaskCancellationRequested`, applied only after the caller commits and only from the focus module. Kill-switch intake from config is in §7.5 and A-7. |
| CA-24 | major | Fixed. CTRL-0004-5, CTRL-0005-12 and CTRL-0017-5 are relabelled as H3 and H2 controls. An H4 hazard is proposed (HAZ-TK8). CTRL-0003-2 added to the YAML header. |
| CA-25 | major | Fixed (D10). `workBeganAt` and `performedAt` are the valid times of the journal row, so the journal classifies them. Back-dated times are refused in WP-0.3 (KA-TK8). A start in the future is refused. |
| CA-26 | major | Fixed. `CreateRejection` and `TaskRefusal` are now complete sealed sets. Added `ReasonNotInList`, `ClinicalTimeRefused` and `FacilityMismatch`, and stated which facility wins. The reason list is OQ-TK12. |
| CA-27 | major | Fixed. Every routing command takes `expectedVersion` and returns a sealed result. `retire` is narrowed to pools and queues. `Monitor` is sealed. The orphan scan is named as backstop for races across two aggregates. |
| CA-28 | major | Fixed. Handles `uncoveredYears` (coverage task and alarm). DST resolution is stated. `BusinessDays` must be at least 1. The "calendar changes who" claim is replaced by KA-TK7. |
| CA-29 | major | Fixed. Every recommended test is named, and §13 now maps each acceptance criterion to its tests. |
| SAF-01 | crit | Fixed (D14). There is no `task.cancel` or user Complete. Only the focus owner closes a task. Orphan-alarm tasks close only when their episode clears. |
| SAF-02 | crit | Fixed. Same as CA-12. Dead-letter raises that fail go to a persisted pending list with a `DeadLetterTaskPending` alarm. |
| SAF-03 | crit | Fixed a different way. Kinds are code. Per-kind SLAs are tighten-only settings declared by the owning module. Policies for safety-relevant kinds come from the vendor or country pack only. Not applied: forcing callers to pass an explicit SLA. The tighten-only setting already blocks loosening, and an explicit SLA would copy the value into code. |
| SAF-04 | crit | Fixed (§4.4 reconciliation, HAZ-TK4, new chaos test). The other option offered (synchronous calls) was not taken, per D14. |
| SAF-05 | major | Fixed. Same budget change as CA-08. The claim that the fallback guarantees the bound is removed, and an overrun counts as an SI-03 breach report. Alarm delivery to a human is not a setting: it is covered by the 1-minute margin and measured in the chaos test. |
| SAF-06 | major | Fixed. Same as CA-07. |
| SAF-07 | major | Fixed. Same as CA-09. The reviewer's "open an episode against the terminal owner" became an escalation-failed task and alarm instead, because the holder is still routable, which is not the definition of orphaned. |
| SAF-08 | major | Fixed. NOTIFY targets are checked and skipped when unroutable. Recipients see the task in their worklist; push delivery is KA-TK6. |
| SAF-09 | major | Fixed. Same as CA-10, plus `PropertyTest:SI-03-release-never-leaves-a-gap`. |
| SAF-10 | major | Fixed. Same as CA-11, with one detection-blind alarm per scope (HAZ-TK3). |
| SAF-11 | major | Applied as an open question (OQ-TK6), with a predicate and a test. Default kept: escalation releases the claim. Completion now belongs to the focus module, so the former claimant can still record work they finished. |
| SAF-12 | major | Fixed. Same as CA-23. A fulfilment later marked entered-in-error means the focus module requests a new task. |
| SAF-13 | major | Fixed. Same as CA-01. Timers use the same scopes. |
| SAF-14 | major | Fixed. Same as CA-25. The start comes only from trusted sources, never later than creation. |
| SAF-15 | major | Fixed. Referral example removed. Kinds default to safety-relevant (K-1). Business time needs a classified kind and `ROUTINE` priority. |
| SAF-16 | major | Fixed. The calendar decision is restated for the CSO (DN-TK1), and the gap is recorded as KA-TK7 rather than a tightening. |
| SAF-17 | major | Fixed. `orphanedWork` reports every episode, tracks cumulative orphaned time, includes work with no patient, and flags work with a patient. |
| SAF-18 | major | Fixed. New reasons `POOL_UNKNOWN`, `QUEUE_UNKNOWN`, `OUT_OF_SCOPE`; owners must be in the task's tenant and scope; `PropertyTest:SI-03-owner-in-tenant-scope`. |
| SAF-19 | major | Fixed with a different authority. The alarm source is this module's timer, not the events policy, because a kernel library has no process to run a timer. The events policy supplies and validates the value. |
| SAF-20 | major | Fixed. Same as CA-15; the port is named `JournalAppender`. |
| SAF-21 | major | Fixed. Same as CA-13 and CA-16, with safety class, levels including VENDOR_FOUNDATION, comparator direction and a direction test per setting. |
| SAF-22 | major | Fixed in part. The scan and timers keep running and alarm when settings can't be read. Changed from the recommendation: they use the stricter of the resolved value and the vendor default, not vendor values alone, because vendor values alone would undo a tenant's tightening. |
| SAF-23 | major | Fixed (§4.5). The lease is refused on a node blocked for clock skew. Leader-on-skewed-node and power-cut faults added to the chaos test. |
| SAF-24 | major | Fixed. Same as CA-21. |

Minor findings: all applied. CA-30, CA-31, CA-32, CA-34, CA-35, CA-36 and CA-37 were applied directly. CA-33 is covered by the SAF-15 fix. SAF-25 to SAF-31 were applied too: tightenings list, KA backlog IDs, D7 rule (e) and its test name, the uncovered-years case, label-neutral kind codes, YAML authorisation predicates and effects, and D8 naming.

## Interfaces assumed from sibling specs (§15)

- **A-1 kernel context:** `hms.kernel.context` provides `CommandContext` (with causation id), `ActorRef` with kind `USER`/`DEVICE`/`INTERFACE`/`MIGRATION_LOADER`/`SYSTEM`, `ChangeReason`, `IdempotencyKey`, `CorrelationId`, `TransactionContext` and `TransactionRunner`. `hms.kernel.ids` provides `TenantId`, `FacilityId`, `PatientId`, `UserId`, `TypedId` and `IdGenerator`. Reads use `CommandContext` unless the kernel defines a read context.
- **A-2 kernel time:** `RecordedTime`, `ClinicalTime.resolveLocal`, the single `AsOf`, one `EntryTiming` vocabulary, `EntryTimeClassifier`, `BusinessCalendar` with `uncoveredYears`. `EntryMode` is derived from the context, never from request input.
- **A-3 journal:**
  - Several aggregates per append, each at most once.
  - One clock read per append; the journal classifies timing itself and refuses on a mismatch with the caller's expectation.
  - Back-dated appends go through a back-dating port that refuses everything in WP-0.3.
  - An entry can ask for its valid time to equal the append's recorded time.
  - `byIdempotencyKey`.
  - A cursor read by aggregate type `TaskRequest` with a commit-safe watermark (otherwise this spec's look-back covers it), and a sequence gap check.
- **A-4 tenancy:** `SettingDefinition`, `SettingCatalogue`, `ConfigurationReader.resolve` with provenance, `CalendarReader`, the key grammar, the closed value types, and the facility `zone`.
- **A-5 events:**
  - `hms.kernel.events.DeadLetterSink` with `raise(item, context)` (tenant, facility, patient, owning-team queue code) and `resolved(itemId, outcome)`.
  - `DeadLetterItem.firstFailureAt`.
  - `DeadLetterAlarmPolicy` supplies and validates `A` and raises no alarm itself.
  - Consumer retry windows are shorter than `A`.
  - `platform.events.dead-letter-alarm-after` is registered by platform-tasks.
- **A-6 config:** a runtime read of `platform.tasks.escalation-policy` items by code and version; an activation-check hook for `FallbackQueueActivationCheck`; the gate that refuses synthetic provenance in TRAIN and PROD.
- **A-7 config kill switch:** config raises its kill-switch task as a `TaskRequested` of its own kind, with one owner plus a NOTIFY step at offset zero to the CSO's queue code, and its own SLA setting.
- **A-8 workflow:** D7 rule (e) `safetyKernelNeverUsesWorkflow`, test `ArchTest:safety-kernel-never-uses-workflow`.
- **A-9 site:** the ADR-026 clock-skew monitor tells the leadership adapter which nodes are write-blocked.

## Proposed items (full text, local labels)

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
- **OQ-TK5: cross-key constraints in setting definitions.** `C + S + G + B + F ≤ L` spans six keys; tenancy validates one key at a time. Proposal: a definition may name a cross-key constraint that writes are checked against. Until then the policy factory refuses and §4.6 applies.
- **OQ-TK6: a REASSIGN escalation step on a claimed task.** Default: it releases the claim and tells the former claimant; the focus module can still record finished work. Option: keep a routable claimant's claim and notify the new owner. For the nurse and physician panels.
- **OQ-TK7: local changes to escalation policies of safety-relevant kinds.** Default: vendor or country pack only; tenants decide who holds each role code. Option: tenant variants whose every offset is no later than the vendor's, and day-type variants (DN-TK1).
- **OQ-TK8: facility-level calendars** (D3). Calendar keys are set at COUNTRY_PACK and TENANT. Should a facility override them?
- **OQ-TK9: the state-machine template.** `task.yaml` declares `initial: open`, uses `(start)` for the creating command, and puts effects in `description` fields. Appendix B.3 defines none of these; the README and the WP-0.5 generator contract should.
- **OQ-TK10: transport of the Tier 2 escalation request** from a sidecar process to the Tier 1 host (§5.4).
- **OQ-TK11: persistence in WP-0.3.** The WP-0.3 page lists the journal's schema and repository code as in scope now, not the task engine's. This spec writes the `tasks` schema, migrations and jOOQ repositories now, because the exit chaos test needs them. Confirm.
- **OQ-TK12: the governed list of reason codes.** Declared in code in WP-0.3; should it become governed content that tenants may extend?
- **OQ-TK13: configuration reads.** §5.2 lets `platform-tasks` call only Trust and the journal synchronously. D5 allows every module to read configuration through `hms.platform.tenancy.api`; this module also reads escalation policies through `platform-config`. Record against §5.2's column.
- **OQ-TK14: the dead-letter alarm-age setting** is declared by this module on behalf of the events library (§8). Confirm with the events spec, or move it to an application-level definition.

**Known anomalies** (proposed `KNOWN-ANOMALIES.md` rows)
- **KA-TK1: task persistence unproven.** The jOOQ adapters are written but untested until the cell. Until their integration tests pass, `app-hms` refuses to start with `platform-tasks` wired (`TasksPersistenceGuard`). Hazard: HAZ-0003. Backlog: `PLT-CORE-07`.
- **KA-TK2: what waits for the cell.** The chaos tests, the scheduler, the leader lease, the clock-health link, the watchdog, the intake stall alarm and the journal gap check. The 5-minute bound is proven only on a simulated clock. HAZ-0003, CTRL-0003-5. Backlog: `PLT-CORE-07`, `PLT-OPS-05`.
- **KA-TK3: routability knows only active and inactive accounts.** No absence, surrogate or roster yet. HAZ-0003, HAZ-0017 (CTRL-0017-5). Backlog: `CLN-RES-01`, `ERP-ROS-01`; the Trust Plane adapter is WP-0.4 (`TRU-IAM-01`).
- **KA-TK4: no user authorisation or read audit until WP-0.4.** Production wiring denies every user action, so no person can claim, release or reassign. Subject-bearing reads are not yet audited. HAZ-0003, HAZ-0021 to HAZ-0027 (SI-21). Backlog: `TRU-IAM-02`, `TRU-AUD-01`, `TRU-PRV-01`.
- **KA-TK5: operational alarms have no transport** until the cell's OpenTelemetry pipeline exists; the recording adapter serves tests only. HAZ-0003; seeded H9 (no hazard entry yet). Backlog: `PLT-OPS-05`.
- **KA-TK6: NOTIFY has no push delivery.** Recipients see escalated tasks only in their worklist until `platform-notify` exists. HAZ-0003, HAZ-TK8. Backlog: `PLT-CORE-07`.
- **KA-TK7: no day-type escalation variants.** CTRL-0004-5's "calendar-aware timers" mechanism is incomplete: timers never pause, but no chain changes on weekends or holidays. HAZ-0004. Backlog: `PLT-CORE-07`.
- **KA-TK8: back-dated and back-entered task times are refused in WP-0.3.** The journal's back-dating port refuses every back-dated append, and the back-entry tooling does not exist. Work begun on paper starts its SLA at entry. HAZ-0010, HAZ-0003. Backlog: `TRU-BCP-03`.

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
===== workflow
I revised `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-workflow.md`, the only file I edited. The review file lists 16 major findings, although its summary says 15. All 16 are dealt with: 13 fully fixed and 3 fixed with one part not applied, for the reasons given. There were no critical findings.

## Major findings

| ID | Resolution |
|---|---|
| WF-CA-1 | **Fixed (D8).** `InMemoryWorkflowEngine` and `RecordingWorkflowAudit` move to main code in `hms.platform.workflow.infrastructure.inmemory`, which sits under a layer, so rule (b) passes. Their KDoc says test and dev only. `WorkflowAssembly.production(registry)` takes no engine or audit parameter. The spec cites `ArchTest:production-wiring-never-binds-inmemory-adapters`. §2, §3, §12 and AC2/AC3 are rewritten. The check on `app-hms` waits for its Spring Boot application, and the spec records that. |
| WF-CA-2 | **Fixed (D1).** `WorkflowCallContext` and `CancelReason` are gone. The port takes the kernel `CommandContext` and uses `TenantId` and `ChangeReason`. The signal and cancel dedup key is `context.idempotencyKey`, so the raw `signalKey` is removed. OQ-W2 is closed by citing D1. |
| WF-CA-3 | **Fixed.** `StatusResult.Rejected(problem)` is added. W7 now applies to `status` too. It compares two values without asking the engine, so it reveals nothing about whether the ref exists. The validation test covers `status`. |
| WF-CA-4 | **Fixed.** One model is chosen: api value classes are plain carriers, and the gateway checks every rule and returns `Rejected`. A rule table maps each rule to its problem. `REASON_MISSING` is removed rather than renamed to `REASON_BLANK`: the kernel `ChangeReason` cannot be blank, so the gateway can never see a blank reason. `UnitTest:cancel-reason-has-no-default` replaces it. New problems: `INVALID_NAME`, `INVALID_CANCEL_CODE`. |
| WF-CA-5 | **Fixed.** `Delivered` and `AlreadyDelivered` are merged into `Accepted`. Each workflow keeps its seen keys, carries them across continue-as-new, and caps them with a per-type maximum. Temporal Update is noted only as a later option. W1 is split: inside the engine it holds within the retention period (a cell setting longer than every type's lifetime); beyond retention the owning aggregate records attempts and never reuses one (WT-1). |
| WF-CA-6 | **Fixed.** The §5 table now has rows for (a) a restart with different arguments: `AlreadyExists`, no change, arguments not compared [P]; (b) a second cancel: `CancelRequested`, the first code kept, both audited; (c) a signal during clean-up: `Accepted`; (d) `Running(cancelRequested)` can end `Cancelled`, `Failed` or `Completed`; (e) cancel is idempotent on `context.idempotencyKey`. The property test and the contract suite are extended to these rows. |
| WF-CA-7 | **Fixed, one part not applied.** New DN-W2 covers how `rcm` and `migration` reach the port, and OQ-W5's premise is corrected. Not applied: the claim that `migration` may not call these APIs. §5.2 gives `migration` "via public APIs only", and both `api` packages are public. Only `rcm` (the satellite) is blocked. |
| WF-CA-8 | **Fixed.** §1 is rewritten. The owning module writes `TaskRequested` through its own outbox (`platform-tasks.md` §5.1 path 2; D14). It consumes `TaskCompleted` and `TaskCancelled` from the catalogue and signals the workflow (WT-4). |
| WF-CA-9 | **Fixed.** The order is now fixed: values, then registry, then audit attempt, then engine, then audit outcome. The KA text is corrected: production answers `Rejected(UNKNOWN_TYPE)` for every call; a registered type gets `WorkflowEngineUnavailable(AUDIT_UNAVAILABLE)` on commands and `NO_ENGINE` on status. New `UnitTest:workflow-production-assembly-fails-closed`. The `app-hms` wiring part of AC2 is recorded as waiting. |
| WF-CS-1 | **Fixed, one part not applied.** WT-2 adds a process-watch task outside the engine: an owned task with a continuous SLA equal to the type's maximum idle time, replaced at each step. If steps stop, it breaches on the task engine's own clock. Not applied: "push the deadline forward". `platform-tasks` fixes due times at creation, so the watch is a new task at each step instead. Also added: the `WorkflowEngineUnreachable` alarm within 5 minutes, the maximum idle time as a tighten-only setting read through tenancy (D5), a later ChaosTest, and narrower wording for the proposed control and the bound. |
| WF-CS-2 | **Fixed.** WT-4: the owning module writes a signal-intent journal entry and a relay delivers it at least once, idempotently. Past the retry policy it becomes a dead-letter task with the 5-minute alarm, timed from the first failure (D15). New HAZ-0003 cause and `ChaosTest:workflow-signal-survives-engine-outage`. |
| WF-CS-3 | **Fixed.** WT-3: a manual takeover is recorded on the owning aggregate, and every activity checks the process mode first and does nothing if it is manual. The engine instance is cancelled when the engine is back. Fallback tasks carry the ref. Added: an "answer lost" contract test, a later AcceptanceTest, the KA text, and candidate HAZ-W1. |
| WF-CS-4 | **Fixed.** The HAZ-0012 rows now map to CTRL-0012-4 and CTRL-0012-3, citing CTRL-0012-4's planned PropertyTest. New rule WT-6. Proposed arch rule (f), `ArchTest:clinical-guards-never-read-workflow`. A later property test checks discharge against every pre-approval status, including `WorkflowEngineUnavailable`. |
| WF-CS-5 | **Fixed.** The cancel `ChangeReason` goes to audit and the owner's journal only; the engine gets a declared `CancelCode`. `Code` values must come from a per-type declared list, and clinical codes are never arguments. The workflow id is an opaque UUIDv5 (W8). Payload encryption is required before the first patient-linked type runs outside tests. Temporal logs and visibility stay on the cell. OQ-W3 is extended. |
| WF-CS-6 | **Fixed.** Audit is in two phases: an attempt record before the engine call and an outcome record after. If the attempt record fails, the call is refused. If the outcome record fails, the real result is returned and a `WorkflowAuditIncomplete` alarm is raised. The production binding is `UnavailableWorkflowAudit`, which refuses every write. New tests `workflow-gateway-audits-every-command` and `workflow-gateway-refuses-when-audit-unavailable`. |
| WF-CS-7 | **Fixed, one part not applied.** `At(Instant)` is replaced by `ClinicalAt(ClinicalTime)`, `RecordedAt(RecordedTime)` and `Date(LocalDate)`, and status times are typed `RecordedTime`. WT-8 says timers built from dates are computed by the owner using `BusinessCalendar` and the facility zone. Not applied: putting a zone reference inside `Date`. The zone is the owning facility's (a tenancy attribute), so carrying it would duplicate configuration. |

## Minor findings
- **Fixed:** CS-8 (risk class is now mixed and both lenses apply), CA-11 (`WorkflowId`, its derivation, and a pattern and length for `aggregateType`), CA-12 (citation fixed), CA-13 (`FailureKind` and `UnavailableReason` enums), CA-14 (cites D7 and adds ADR-W1), CS-9 (WT-9), CS-10 (OQ-W3(b) and (c)).
- **Partly fixed, CA-10:** this spec uses `ArchTest:safety-kernel-never-uses-workflow`. I could not correct `platform-tasks.md` because it is outside my files, so §14 carries a note to that spec.
- **Partly fixed, CA-15:** proposed as SM-W1. The yaml file is outside my files.

## Interfaces assumed from siblings
- **`platform-kernel.md`:**
  - `hms.kernel.ids.TenantId`.
  - `hms.kernel.context`: `CommandContext` (tenant, facility, actor with kind, on-behalf-of, device, purpose-of-use, clinical time, idempotency key, correlation id, causation id), `ChangeReason` (cannot be blank at construction), `IdempotencyKey`, and `ActorRef` with kind `SYSTEM`.
  - `hms.kernel.time`: `ClinicalTime`, `RecordedTime.now(clock)`, and `RecordedTime.restore` allowed in `..infrastructure..` under D7.
  - `BusinessCalendar`.
- **`platform-tasks.md`:**
  - `TaskRequested` journal entries from non-kernel modules, materialised from the journal (D14), with a correlation to the workflow ref.
  - `TaskCompleted` and `TaskCancelled` events.
  - **A non-kernel focus owner can complete its own task through the same journal path (a by-focus-owner completion request, D14).** WT-2 depends on this. If `platform-tasks` does not offer it, OQ-W5 stays open.
  - Dead-letter tasks with the 5-minute alarm from the first failure (§7.1, D15).
  - Continuous-clock SLA breach and escalation.
- **`platform-tenancy.md`:** `SettingCatalogue` holds per-type settings (D2), read through `hms.platform.tenancy.api` (D5); `NotConfigured` means fail closed; each facility node has a `zone` attribute.
- **`platform-config.md`:** `FlagDecision` has an `Unavailable` outcome (D13).
- **`:platform:arch-rules`:** owns the D8 production-wiring rule and rule (e) (D7).

## Proposed items (local labels)
- **OQ-W1: backlog ID.** Appendix A has no feature ID for §7 item 6. KA-W1 needs a backlog ID (§3.5). Proposal: a [P] backlog item for the workflow port under WP-0.3, or carry it under `PLT-CORE-07`'s work package without a feature ID.
- **OQ-W2: closed by D1.** `TenantId` lives in `hms.kernel.ids`; `CommandContext`, `ActorRef`, `CorrelationId`, `IdempotencyKey` and `ChangeReason` live in `hms.kernel.context`. The port uses them. No integrator number is needed.
- **DN-W1 (touches ADR-010's guard, so stop-and-ask item 2): where workflow definitions live and in what form.** Rule (c) allows Temporal types only in `hms.platform.workflow.infrastructure`. Temporal-native definitions for `rcm`, `adt` and `migration` would therefore all have to live in this module, which would then import those modules (and `rcm` is a separate deployable). Options:
  1. Engine-neutral definitions (steps, signal waits, durable timers) declared through a small contract in `hms.platform.workflow.api` and run by the adapter. This keeps the C9 fallback and a fork free of definition rewrites.
  2. Temporal-native definitions in each owning module's own `..workflow.infrastructure..` package, which widens rule (c).
  3. All definitions centrally in this module.

  Proposal: option 1, decided before the first workflow type (Phase 1: `RCM-INS-01` or `IMP-MIG-01`), together with DN-W2.
- **DN-W2 (touches §5.2's dependency column, so stop-and-ask): how `rcm` and `migration` reach `WorkflowPort` and `platform-tasks`.** §5.2 lists `platform-workflow` as an application module with no dependencies. It gives `rcm` (a satellite, its own deployable) only "Trust (SDK); its own journal and outbox from the platform libraries", and it gives `migration` "via public APIs only". `migration` runs in `app-hms` and may call `WorkflowPort`'s `api` and `platform-tasks`' `api` as public APIs. `rcm` may call neither. Options:
  1. Split the port, its value types, the gateway and the SPI into a kernel-level library (as the journal became `:platform:journal`). Each process (app-hms, the rcm satellite) hosts its own gateway and adapter against the cell's Temporal, with one task queue per module.
  2. A client library with a remote port served by `app-hms`.
  3. `rcm` writes workflow-command intents to its outbox and `app-hms` executes them.

  For task requests, `rcm` writes `TaskRequested` to its own journal. Whether `platform-tasks`' journal reader (D14) reaches the satellite's schema is `platform-tasks`' question. Proposal: option 1, decided with DN-W1 before `RCM-INS-01`.
- **OQ-W3: Temporal namespaces, the shared store and payload protection.**
  - (a) One namespace per tenant (proposed) or one per cell.
  - (b) Temporal's databases are per cell and shared by every tenant, even with one namespace per tenant. That departs from §6.4 "one database per tenant" and ADR-006 for the pooled tier. It is recorded as a deviation to decide before the adapter is built.
  - (c) Payload encryption with the tenant's envelope keys (ADR-008, `trust-keys`, WP-0.4), so crypto-shredding a tenant reaches its workflow history. Tenant offboarding deletes the tenant's namespace.
  - (d) The patient-linked ids in business keys (W3) and the opaque id (W8).
  - (e) Temporal server logs and visibility stay on the cell.
- **OQ-W4: worker versioning and N-1 rollback.** Temporal worker versioning against ADR-021's "migrations always roll back to N-1". Proposal: expand → contract for definitions, with the replay test run on N and N-1.
- **OQ-W5: how a failed or stalled workflow raises an owned task.** Corrected premise: owning modules outside the Safety Kernel request tasks through their own outbox (`TaskRequested`, `platform-tasks.md` §5.1 path 2; D14). They do not call `platform-tasks` in their transaction, and `rcm` cannot call it at all (DN-W2). Proposal, in three parts:
  - WT-2 (the process-watch task, outside the engine) as the backstop that needs no engine;
  - WT-5 (the owning module's failure activity writes `TaskRequested`) for early warning;
  - the adapter's `WorkflowFailed` and `WorkflowEngineUnreachable` operational alarms.

  Rejected options: the adapter calling `platform-tasks` directly (a dependency §5.2 does not list), and a `WorkflowFailed` domain event (no engine-side mechanism survives losing the engine). Depends on the by-focus-owner completion interface assumed from `platform-tasks`.
- **OQ-W6: reconciliation after restore.** Temporal's databases and the tenant database can be restored to different points. Proposal: a reconciliation job compares open workflows with their owning aggregates and raises owned tasks for mismatches; owner WP-1.13 (restore test) [P]. WT-2 already surfaces a stall in the meantime.
- **OQ-W7: what "lighter workflow persistence" means** (K §7.4; ADR-010): Temporal on a lighter store, or a small durable-step engine on the tenant PostgreSQL behind the same port. To be settled if WP-0.6's indicative C9 numbers show risk, and only on reference-cell evidence.
- **ADR-W1: ADR-010 note, the Safety Kernel and clinical guards never depend on the workflow engine.** Records the tightening of §3.4 item 1: ADR-010's "never order or MAR state" is extended to Safety Kernel timers (rule (e), adopted by D7) and to clinical guards (rule (f), proposed). ADR-010's "Fitness test" lists rules (c), (e) and (f).
- **SM-W1: state-machine file.** Add `docs/specs/state-machines/workflow-instance.yaml` in Appendix B.3 form from the §5 table, with terminal states and named guard predicates, so the property-test generator can use it. It is outside this specification's file scope; the integrator places it.
- **KA-W1: the workflow engine and its audit are fail-closed stand-ins.** Proposed `KNOWN-ANOMALIES.md` row: "`WorkflowPort` has no engine yet. The production assembly binds `UnavailableWorkflowEngine` and `UnavailableWorkflowAudit`. No workflow type is registered, so every production call with valid values answers `Rejected(UNKNOWN_TYPE)`. For a registered type, every command answers `WorkflowEngineUnavailable(AUDIT_UNAVAILABLE)` before reaching the engine, and status answers `WorkflowEngineUnavailable(NO_ENGINE)`. Nothing is ever reported as started. The Temporal adapter waits for Temporal on PostgreSQL in the dev cell (WP-0.2; DN-040). The production audit adapter and the read-audit decision for status wait for the Trust Plane SDK (WP-0.4). Requirements WT-1 to WT-10 are not yet controls: no workflow type exists. No clinical command depends on the port (rules (e) and (f); ADR-010)."
  - Mechanism and test: `WorkflowAssembly.production`; `UnitTest:workflow-production-assembly-fails-closed`.
  - Hazard references: H5 (HAZ-0003), SI-03; SI-12 (HAZ-0012).
  - Backlog ID: per OQ-W1. Status: open.
  - Closes with: WP-0.3 completion after WP-0.2 (the Temporal adapter and `IntegrationTest:workflow-port-contract-temporal`) and WP-0.4 (the audit adapter).
- **CTRL-W1 (proposed control for HAZ-0003):** "Long-running processes never own people's work or Safety Kernel timers. Every human step of a workflow is an owned task in the task engine. While a process is open, an owned process-watch task with a continuous SLA (the type's maximum idle time) is renewed at each step, so a process that stalls, fails or loses its engine surfaces as an overdue owned task on the task engine's clock. Signals that close human steps are delivered at least once, and an undeliverable one becomes a dead-letter task with the 5-minute alarm. The Safety Kernel modules (`orders`, `medications`, `results`, `platform-tasks`) never depend on `platform-workflow`, so an engine outage cannot stop an order, a MAR entry or a `TaskOrphaned` alarm."
  - Type: design. Covers: [b, c]. State: planned.
  - Sources: §2.2 rule 6, §4.2 ADR-010, §7 items 4 and 6.
  - Planned verification: `ArchTest:safety-kernel-never-uses-workflow`, `ChaosTest:workflow-engine-loss-clinical-work-continues`, `ChaosTest:workflow-engine-loss-stalled-process-surfaces-as-overdue-task`, `ChaosTest:workflow-signal-survives-engine-outage`.
- **Suggested causes to add to HAZ-0003:**
  1. "A long-running process fails, stalls or loses its engine, and the people's work it should create never appears."
  2. "The signal that closes a workflow's human step is lost while the workflow engine is unavailable, so the workflow waits for ever with no open task."
- **HAZ-W1 (candidate, for the integrator and the CSO to judge): a long-running process runs twice.** "After an unknown start outcome, a process runs both by hand and in the workflow engine (a claim submitted twice, a cutover step executed twice), and migrated or financial records are corrupted." Proposed control: WT-3 (manual takeover recorded on the owning aggregate; activities check the process mode). Planned verification: `AcceptanceTest:workflow-manual-takeover-no-double-execution`. Whether this is a patient-safety hazard (cutover) or an operational risk (claims) is for the CSO.
- **Proposed arch rule (f) `clinicalGuardsNeverReadWorkflow` [P]:** no class in a `domain` package of `adt`, `ed`, `periop`, `icu`, `maternity`, `nursing` or `record` depends on `hms.platform.workflow..`. Verified by `ArchTest:clinical-guards-never-read-workflow` with fixture test `ClinicalGuardsWorkflowRuleTest`. Needs the integrator to adopt it.
- **Note to `platform-tasks` (not an item):** rename `ArchitectureTest:safety-kernel-does-not-use-workflow-port` to `ArchTest:safety-kernel-never-uses-workflow` (D7's rule name), so one name wins.
