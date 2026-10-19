# Module specification: platform kernel libraries (ids, time, context, money, quantity)

Libraries: `:platform:ids` (`hms.kernel.ids`), `:platform:time` (`hms.kernel.time`), `:platform:context` (`hms.kernel.context`), `:platform:money` (`hms.kernel.money`), `:platform:quantity` (`hms.kernel.quantity`), and the `TestClock` that `:platform:testing` (`hms.kernel.testing`) gains   Group: shared kernel, `backend/platform/` (BUILD-PROMPT §6.1)
Work package: WP-0.3 (cluster-free part, DN-040)   Status: draft, revision 2 (after the automated correctness and clinical-safety reviews), 2026-10-19
Sources: BUILD-PROMPT §2.1 (preamble, SI-03, SI-05 and the definition of dose arithmetic, SI-10, SI-15, "also carried as acceptance criteria"), §2.2 rules 2 and 7, §3.4 items 1, 3-5, 8, §3.5, §4.1 (stack; locales and default time zone), §4.2 (ADR-003, ADR-004, ADR-009, ADR-010, ADR-016, ADR-020, ADR-026), §5.2, §5.3, §6.1, §6.2, §6.3, §6.4, §6.5, §6.6, §6.8 #1 to #3, §7 items 1, 3, 4, 9, 18, §8.1 (P2, P6, P7, P10), §8.3, §9.10 acceptance 6, §9.20, §9.21, §11.4, §11.7, §13 (R07 AZ-7), §18.3, §18.4 (SAC-11, SAC-13, SAC-47, SAC-50), §19.1, §19.2, §19.4, §21 (WP-0.3, WP-0.4, WP-0.5), §22.1; `docs/program/work-packages/WP-0.3.md`; `docs/program/DECISIONS-NEEDED.md` DN-040; `docs/program/ASSUMPTIONS.md` L-13, L-14, L-20, L-33; `docs/safety/hazard-log.yaml` HAZ-0003, HAZ-0005, HAZ-0010; `docs/safety/README.md` ("Test names", "Tightenings"); `backend/README.md`; `backend/platform/README.md`; `backend/platform/arch-rules/src/main/kotlin/hms/kernel/archrules/*.kt`; R08 §3.7, §3.11, §6.2, §8; R11 §1 (P2, P6, P10), §15 items 8-10; R07 §5.4 (AU-1); BP §7.6, BP §8; K §7.2 (ADR-026), K §7.7, K §8 (Money); the WP-0.3 integrator decisions D1 to D17; the sibling specifications `platform-journal`, `platform-tenancy`, `platform-config`, `platform-tasks`, `platform-workflow`, `docs/specs/events/envelope.md` and `docs/specs/events/catalogue.md`.

Risk class of this work: patient-safety relevant (DN-040 decision 2 names "time and the `Clock`, clinical vs recorded time, `Quantity`/UCUM"). It gets at least two independent automated review lenses (correctness; clinical safety and hazard), never recorded as a human review (§3.5).

Local labels: open items in this spec carry local labels (OQ-KN1, DN-KN1, KA-KN1, HC-KN1 for proposed hazard causes, and so on). They are **to be numbered** by the integrator; this spec allocates no programme number (D9).

Revision 2 adds `hms.kernel.context` and the cross-cutting typed ids (D1), makes the kernel's entry-timing vocabulary the only one (D10), derives the entry mode from the command context, removes `ClinicalTime.atRecordedTime`, makes safety parameters buildable only from resolved configuration (D11), fixes the `AsOf` query coordinate (D4), aligns the calendar keys (D3), and closes the dose-comparison gaps the safety review found.

---

**Programme numbers (19 October 2026).** DN-KN1 to DN-KN6 are DN-042; OQ-KN1 to OQ-KN15 are OQ-170; HC-KN1 to HC-KN6 are OQ-177; KA-KN labels become KA numbers when the code that makes them true is committed. (`docs/program/DECISIONS-NEEDED.md`, `docs/program/OPEN-QUESTIONS.md` §(g).)

## 1. Purpose and scope

These five libraries are the shared kernel that every module uses for identifiers, time, the command context, money and measured quantities. They do no I/O and read no system clock. They hold no shared mutable state, except the id generator's counter. They depend on nothing outside the JDK, the Kotlin standard library and other kernel libraries: never on an application module or a framework [P]. Every application module may import them (§5.2; arch rule (b) always allows `hms.kernel..`).

WP-0.3's deliverable, in the words of §21 and the work package: "UUIDv7 identifiers; an injected `Clock` (never `now()` inside the domain); clinical (valid) time distinct from recorded time; `Money` (`BigDecimal` plus an ISO 4217 currency, explicit rounding, never floating point); `Quantity` with UCUM units, so a unit-less dose cannot form a valid command (§6.2)". D1 adds the command context that §6.2 says every command carries.

| Library | What it gives | Main sources |
|---|---|---|
| `hms.kernel.ids` | UUIDv7 identifiers (RFC 9562) from an injected generator; parsing and validation; the typed-id pattern; the cross-cutting ids `TenantId`, `FacilityId`, `PatientId`, `UserId` (D1) | §5.3, §8.3; R08 §3.11, §6.2; BP §7.6 |
| `hms.kernel.time` | `RecordedTime` (system time, only from a `Clock`), `ClinicalTime` (user- or device-supplied, with its original offset), `ValidTime` (a clinical period with offsets), half-open `ValidPeriod`, `AsOf`, the SI-10 entry-timing vocabulary and classifier (the only one, D10), `BusinessCalendar`, and the governed-parameter types (D11) | §2.1 SI-10; §5.3; §6.2; §7 items 1, 3; §8.1 P2, P10; §11.7; §19.4; R08 §3.7; R11 §15 items 9-10 |
| `hms.kernel.context` | `CommandContext` (tenant, facility, actor, on-behalf-of, device, purpose of use, clinical time, capture channel, back-entry authority, idempotency key, correlation and causation ids), `ActorRef` with its kind, `DeviceRef`, `PurposeOfUse`, `ChangeReason`, `IdempotencyKey`, `CorrelationId`, `CausationId`, `TransactionContext` and `TransactionRunner`, the `EntryTimePolicySource` port, and the derivation of the entry mode | §6.2 "Commands carry context"; §6.3 `Idempotency-Key`; §2.1 SI-10; R07 AZ-7 |
| `hms.kernel.money` | `Money`, allocation without losing a minor unit, cash rounding, `ExchangeRate` and an effective-dated rate table | §6.2; §9.20; §9.21; §11.4; K §8 |
| `hms.kernel.quantity` | `UcumUnit` (syntactic UCUM), `Quantity`, `DoseQuantity`, `DoseRate`, `DoseComparisons` (the one audited comparison API for §2.1 (b)-(e)), the ISMP clinical number format, the `UnitCatalogue` port, `GovernedThreshold` | §2.1 SI-05 and its definition of dose arithmetic; §6.2; §6.5; §6.8 #1; §8.1 P6; R11 §15 item 8 |
| `hms.kernel.testing` (gains) | `TestClock`, a controllable `java.time.Clock`, test-only (D8) | §18.3 (clock skew, back-entry); HAZ-0003 CTRL-0003-5 "(simulated clock)" |

**Feature IDs.** Appendix A has no row of its own for the kernel libraries; they are named WP-0.3 deliverables (§21) that the WP-0.3 features stand on: `PLT-CORE-01` (the journal's two time axes), `PLT-CORE-02` (calendar data in the configuration chain), `PLT-CORE-07` (SLA timers on the injected clock), `PLT-CFG-01`. Later consumers carry their own IDs: `PLT-CORE-03` (WP-0.5 state machines), `KRI-RCM-01` and `RCM-ACC-01` (money, R1), the `MED-*` features (doses, Phase 1), `TRU-BCP-03` (back-entry). See OQ-KN12.

**Out of scope.** Downtime number blocks (MRN, encounter, accession) belong to `platform-site` (§5.2, §7 item 18). So does the downtime-episode registry that back-entry reads (`TRU-BCP-03`). The clock-skew write block (a node more than 5 s out is blocked from clinical writes) is a site service, not a kernel rule (§4.2 ADR-026; `docs/adr/ADR-026-power-and-time.md`). Hijri display and calendar rendering belong to `platform-i18n` (§5.2, §7 item 10, §11.7). Unit conversion belongs to the terminology service (§8.1 P6). Date of birth with its precision flag belongs to `empi` (§8.2; L-13). The journal's tables, its append path (which is the binding caller of the entry-time classifier, D10), its `BackDatingAuthorization` port and its as-was queries belong to `hms.kernel.journal` (sibling specification). Permission decisions belong to the Trust Plane (WP-0.4).

## 2. What is in WP-0.3 and what waits

"Built" means code and its fast-tier tests are merged in WP-0.3. "Specified only" means the signature or rule is fixed in this spec but no production code path uses it in WP-0.3 (the type may exist, but what makes it reachable waits). WP-0.5 codes against the four rows marked "WP-0.5 uses" (section 3).

**Built in WP-0.3**

| Item | Status | What still waits, and for whom | Why |
|---|---|---|---|
| `hms.kernel.ids` (section 5): `IdGenerator`, `UuidV7Generator`, `UuidV7` (`parse`, `isV7`, `requireV7`, `compare`, `format`), `UuidParseResult`, `TypedId`, `IdGenerator.next`, `TenantId`, `FacilityId`, `PatientId`, `UserId`. **WP-0.5 uses** | built, unit and property tests | — | §5.3; D1 |
| `hms.kernel.time` time axes (section 6.1): `RecordedTime` (`now`, persistence-only `restore`), `ClinicalTime` (`parse`, `of`, `resolveLocal`), `LocalTimeResolution`, `ValidTime`, `ValidTimeInput`, `ValidTimeKind`, `ClinicalTimeSource`, `ValidPeriod`, `AsOf`. **WP-0.5 uses** | built | — | SI-10; D4 |
| `hms.kernel.time` SI-10 classification (section 6.2): `EntryMode`, `TimingClass`, `EntryTimeClassifier` (`needsPolicy`, `classify`), `EntryTimingResult`, `EntryTiming`, `EntryTimingCode`, `EntryTimeRefusal`, `TimingRequirement`, `EntryTimePolicy`, `EntryTimePolicyLookup`, `BackEntryEpisode` | built, pure, tested for all seven modes with synthetic policies | tolerance values (DN-KN1) and the privileged modes' production callers (table below) | D10 |
| `BusinessCalendar`, `CalendarAnswer`, `BusinessCalendarResult` (section 6.4) | built (type and arithmetic) | Kurdistan calendar data (table below) | §7 item 1; D3 |
| Governed safety-parameter types (section 6.5): `ContentProvenance`, `EnvironmentClass`, `ResolvedParameter`, `@SafetyParameterFactory`, `SafetyParameterResult` | built | — | D11 |
| `hms.kernel.context` (section 7): `CommandContext` with the derived `entryMode`, `CommandContextResult`, `ActorRef` and `ActorKind`, `DeviceRef`, `InterfaceChannelRef`, `MigrationRunRef`, `SystemProcess`, `PurposeOfUse`, `IdempotencyKey`, `CorrelationId`, `CausationId`, `CaptureChannel`, `BackEntryAuthority`, `ChangeReason`, `TransactionContext`, `TransactionRunner`, `TxOutcome`, the `EntryTimePolicySource` port. **WP-0.5 uses** | built (types, derivation, refusals). `USER` and `SYSTEM` actors are used in WP-0.3 production; `SYSTEM` only from the `SYSTEM_PROCESSES` allow-list (section 7.2) | the production `TransactionRunner` (the journal's jOOQ adapter); binding to the authenticated principal (WP-0.4) | §6.2; D1; D14 |
| `InMemoryTransactionRunner` in `hms.kernel.context.inmemory` | built, test and dev only (D8) | — | the journal's and modules' in-memory adapters enlist in it |
| `TestClock` in `hms.kernel.testing` (section 8). **WP-0.5 uses** | built, test-only (D8) | — | WP-0.5 and `platform-tasks` drive time with it |
| `hms.kernel.money` (section 9) | built | first consumer `rcm` (R1) | §6.2; K §8 |
| `hms.kernel.quantity` (section 10): syntactic `UcumUnit`, `Quantity`, `DoseQuantity`, `DoseRate`, `DoseComparisons`, `ClinicalNumberFormat`, `GovernedThreshold`, the `UnitCatalogue` port and its `UnavailableUnitCatalogue` binding | built | first consumers medications and CDS (Phase 1); semantic UCUM (table below) | SI-05; KA-KN1 |
| ArchUnit half of the §6.8 #1 fitness function and the other kernel rules of section 11 | built | — | `backend/README.md` places it in WP-0.3 "when `Quantity` exists" |
| detekt rules (`NoDoseArithmetic`, `NoClinicalTimeFromRecordedTime`, `NoLiteralChangeReason`) | planned in WP-0.3 | if they slip: KA-KN2; `NoDoseArithmetic` must exist before the medications module (§9.10 acceptance 6) | §6.8 #1 |

**Specified only: no production code path in WP-0.3**

| Item | WP-0.3 state | Waits for | Why |
|---|---|---|---|
| Binding of `CommandContext` and `ActorRef.user` to the authenticated principal | types exist; any code can build a `USER` actor (KA-KN7) | WP-0.4 (Trust Plane SDK) | KA-KN7 |
| `DEVICE`, `INTERFACE` and `MIGRATION_LOADER` actors, offline capture | buildable only from allow-listed packages (section 11), which hold only test sources in WP-0.3 | the Hub, the migration loader (§8.3), the mobile offline mode and edge agent (SI-15, `MED-BCM-01`); DN-KN6 | section 7.2 |
| Values of the SI-10 entry-time tolerances | none. An owning module registers its four definitions per timing class as `configurationRequired`, with no vendor default (section 6.3); the resolver answers `NotConfigured`; no WP-0.3 event type has a timing class; every entry that needs a policy is refused | DN-KN1 (CSO) | §3.4 items 1, 3: safety-invariant parameters are not the agent's to choose |
| Back-dating in production (clinical and retroactive effective dates) | classified; the journal's `BackDatingAuthorization` production binding refuses every back-dated append | WP-0.4 policy decision point | D10; journal specification |
| Back-entry in production | classified; no production code can build a `BackEntryAuthority` or a `BackEntryEpisode`, so `BACK_ENTRY` cannot occur | `TRU-BCP-03` tooling and the `platform-site` episode registry (R1) | D10 |
| Semantic UCUM validation (atom table, dimensions, conversions, metric only) | port only (`UnitCatalogue`); its binding answers `Unavailable` | terminology service, `PLT-CORE-05`, WP-1.1, licensed or official UCUM files placed by a human (§3.4 item 5; §21 WP-1.1) | §8.1 P6: "conversions only through the terminology service" |
| Kurdistan calendar data (weekend, holidays, covered years) | none; tenancy's values are configuration | the Kurdistan pack as signed configuration, `PLT-CFG-02`, WP-1.1; holiday dates each year [L] L-20 | `docs/program/ASSUMPTIONS.md` L-20 |
| Cash-rounding increment and mode | type only; "not configured" is a value | tenant configuration (L-14), `rcm` in R1 | K §8: "IQD 250" is an example only |
| jOOQ converters and column mappings | mapping rules only (section 14) | each module's infrastructure; the journal adapter first | kernel libraries take no persistence dependency [P] |
| Trust Plane permission and audit wiring | requirements named only (section 12) | WP-0.4 (Trust Plane SDK) | §21 WP-0.4 |

## 3. Stability contract

**Stable now (kernel API 1):** everything in `hms.kernel.ids`, `hms.kernel.time` and `hms.kernel.context`, and `TestClock`. WP-0.5 codes against these signatures (D17). Kernel API 1 is frozen when this revision is accepted together with the sibling journal, envelope and tenancy revisions that use its shared types (`EntryTimingCode`, `ValidTime`, `ValidTimeInput`, `AsOf`, `CommandContext`, the typed ids). Until then a signature may still change, with notice to WP-0.5. After the freeze, changes are additive only (new functions; new sealed subtypes only where the sealed type is marked "open for additions"). A breaking change needs a revision of this spec, a CHANGELOG entry and notice to every stream that uses the API [P]. `EntryTimingCode` is a stored vocabulary: adding a value is also a journal migration and an envelope change.

**Stable for WP-0.3, first consumers in Phase 1:** `hms.kernel.money`, and `hms.kernel.quantity` except where OQ-KN6 may add a non-dose comparison API. No WP-0.3 or WP-0.5 code needs money or doses.

**Kotlin rules that every kernel type follows [P]:**
- Validated types are plain classes with private constructors and factories, never `data class` (a data class's `copy` would bypass validation).
- Every invariant is also checked in an `init` block, so a reflective constructor call (for example a JSON mapper in a web adapter) cannot build an invalid value; such a failure throws `IllegalArgumentException`, because it is a programming error.
- User or interface input goes through factories that return sealed results (business outcomes are values, §6.2). Programming errors (a currency mismatch in `Money.plus`, a negative count) throw.
- Restricted factories and accessors (persistence-only, safety-parameter, actor-kind, back-entry and dose-magnitude, section 11) carry a `@RequiresOptIn` marker and are `@JvmStatic` where they are companion functions. Their ArchUnit rules match both the static method and the `Companion` method. Each violating fixture calls through the companion from Kotlin and statically from Java.
- Kotlin `internal` is public in bytecode. This spec never relies on it as an access control; where access matters, an ArchUnit rule is the control.
- No Jackson, jOOQ, Spring, Jakarta, CloudEvents, Debezium or Apicurio annotations or types in the kernel libraries (§6.1; the widened framework list, D7; section 11).
- Instants are truncated to microseconds when a kernel time value is made, because PostgreSQL `timestamptz` keeps microseconds; a value read back then equals the value written [P].
- No `ZoneId.systemDefault()`, `Locale.getDefault()` or `TimeZone.getDefault()`, and no API overload that uses the default locale or zone implicitly: the zone and the locale are always passed in from configuration (§4.1 "configurable per tenant"; §8.1 P10) [P].

## 4. Gradle projects, packages and dependencies

| Project | Package | Depends on (main) | Test dependencies |
|---|---|---|---|
| `:platform:ids` | `hms.kernel.ids` | JDK, Kotlin stdlib | `:platform:testing`, `:platform:arch-rules`, Kotest |
| `:platform:time` | `hms.kernel.time` | JDK, Kotlin stdlib | same |
| `:platform:context` | `hms.kernel.context` | `:platform:ids`, `:platform:time` (as `api`, as `backend/platform/context/build.gradle.kts` already declares) | same |
| `:platform:money` | `hms.kernel.money` | `:platform:time` (`ValidPeriod`, `RecordedTime` for rate effectivity) | same |
| `:platform:quantity` | `hms.kernel.quantity` | `:platform:time` (`ResolvedParameter`, `ContentProvenance`, `EnvironmentClass` for `GovernedThreshold`, section 6.5). The build file needs `api(project(":platform:time"))` | same |
| `:platform:testing` | `hms.kernel.testing` | JDK, Kotlin stdlib (unchanged) | — |

Each project applies `hms.kotlin-conventions`, `hms.quality-conventions` and `hms.test-conventions`, and has an `ArchitectureTest` that checks `HmsArchitectureRules.all()` plus the kernel rules of section 11 (`backend/README.md`, "Fitness functions"; `verifyProjectConventions`). Property tests live in `src/propertyTest` and take their sequence count from `PropertyTestBudget.sequences()`, never a literal (`backend/README.md`, "Test tiers"). No kernel library has `src/integrationTest` content in WP-0.3.

Production wiring [P]: `app-hms` provides to every module exactly one `java.time.Clock` (`Clock.systemUTC()`), exactly one `IdGenerator` (`UuidV7Generator(clock, SecureRandom())`) and the `EnvironmentClass` read from the deployment parameter `platform.config.environment` (`platform-config` specification). It never binds a class from `hms.kernel.testing` or from any `..testing..` or `..inmemory..` package (D8; `ArchTest:production-never-binds-test-adapters`, section 11). The cell's time source is the GPS or stratum-1 NTP source of ADR-026; audit times come from it (R07 §5.4 AU-1 "UTC, NTP-synced"; `docs/adr/ADR-026-power-and-time.md`).

## 5. `hms.kernel.ids`: UUIDv7 identifiers (stable)

**Rule.** Every identifier is a UUIDv7 (§5.3 "UUIDv7 for every identifier"; §8.3; BP §7.6). They are time-ordered and merge-friendly across cells (R08 §3.11; site-issued, R08 §6.2). The application makes them, not the database: ids exist before the insert and tests are deterministic [P]. PostgreSQL 18's own `uuidv7()` (R08 §3.11) is not used for application rows [P].

**Layout (RFC 9562 §5.7).** 128 bits, big-endian: `unix_ts_ms` (48 bits, milliseconds since the Unix epoch) · `ver` (4 bits, `0111`) · `rand_a` (12 bits) · `var` (2 bits, `10`) · `rand_b` (62 bits). Canonical text: lower-case `8-4-4-4-12` hex.

**Monotonicity [P] (RFC 9562 §6.2, "Method 1", a fixed-length dedicated counter).**
- `rand_a` holds a 12-bit counter. At each new millisecond it is seeded from the injected `RandomGenerator` with its top bit clear (a rollover guard), and it is incremented for every further id in the same millisecond.
- If the counter would pass `0xFFF`, the generator moves its logical timestamp one millisecond ahead and reseeds.
- `rand_b` is 62 fresh random bits for every id.
- **Clock going backwards:** the generator keeps a logical timestamp `max(clock.millis(), last)`. When the clock steps back, ids continue from the last timestamp with the counter, so ids from one generator stay strictly increasing. The generator never sleeps.
- **Range:** a clock reading below 0 or above 2⁴⁸ − 1 ms throws `IllegalStateException`. That is a programming or clock fault, not a business outcome. For a clock in range the generator never fails, with one exception: at the last millisecond (2⁴⁸ − 1) a counter rollover has no next millisecond to borrow, so it also throws `IllegalStateException` (the year 10889; found while building the slice).
- The guarantee is per generator instance (one per JVM, section 4). Ids from different nodes are unique, not totally ordered. **An id's timestamp is never a recorded or clinical time, and id order is never event order**; the journal orders by aggregate version and recorded time (sibling journal specification) [P].
- **Thread safety:** one lock guards the state (last timestamp, counter) and the draw of the random bits. So a `RandomGenerator` that is not thread-safe (`SplittableRandom` in tests, section 8) is still used safely [P].

**Ordering.** `java.util.UUID.compareTo` compares signed longs. `UuidV7.compare` compares unsigned and byte-wise, which is the order PostgreSQL uses for `uuid` [P]. A property test proves the generator's output is strictly increasing under `UuidV7.compare`.

**Parsing.** `java.util.UUID.fromString` is lenient (it accepts short groups), so it is never used on input. `UuidV7.parse` accepts exactly 36 characters in `8-4-4-4-12` form, upper or lower case, and checks version 7 and the RFC 9562 variant [P].

**Typed ids.** The kernel declares the four ids that cross every module (D1): `TenantId`, `FacilityId`, `PatientId` (the `empi` person id, never an MRN) and `UserId` (an HMS user account issued by `trust-identity`, never an IdP subject and never a practitioner record, §8.2). Every other typed id is declared by its owning module in its `api` package, as a value class that implements `TypedId` and checks the version in `init`. Siblings drop their own placeholders (`UserRef` becomes `UserId`).

```kotlin
package hms.kernel.ids

/** Makes identifiers. Inject it; domain code never calls a static generator. */
fun interface IdGenerator {
    fun newId(): java.util.UUID
}

/** RFC 9562 UUIDv7, Method 1 counter, monotonic per instance, also when the clock goes backwards. */
class UuidV7Generator(clock: java.time.Clock, random: java.util.random.RandomGenerator) : IdGenerator {
    /** Throws IllegalStateException when the clock reads before 1970 or beyond 48 bits of milliseconds. */
    override fun newId(): java.util.UUID
}

object UuidV7 {
    fun parse(text: String): UuidParseResult
    fun isV7(uuid: java.util.UUID): Boolean
    /** Throws IllegalArgumentException when [uuid] is not a v7 UUID with the RFC 9562 variant (a programming error). */
    fun requireV7(uuid: java.util.UUID): java.util.UUID
    /** Unsigned byte-wise order, the order PostgreSQL uses. */
    fun compare(a: java.util.UUID, b: java.util.UUID): Int
    /** Lower-case canonical form. */
    fun format(uuid: java.util.UUID): String
}

sealed interface UuidParseResult {
    data class Valid(val uuid: java.util.UUID) : UuidParseResult
    data class Invalid(val error: UuidParseError) : UuidParseResult
}

enum class UuidParseError { MALFORMED, NOT_VERSION_7, NOT_RFC_9562_VARIANT }

/** Implemented by every typed id. */
interface TypedId {
    val value: java.util.UUID
}

/** Makes a typed id: `ids.next(::TaskId)`. */
fun <T : TypedId> IdGenerator.next(wrap: (java.util.UUID) -> T): T

@JvmInline value class TenantId(override val value: java.util.UUID) : TypedId { init { UuidV7.requireV7(value) } }
@JvmInline value class FacilityId(override val value: java.util.UUID) : TypedId { init { UuidV7.requireV7(value) } }
@JvmInline value class PatientId(override val value: java.util.UUID) : TypedId { init { UuidV7.requireV7(value) } }
@JvmInline value class UserId(override val value: java.util.UUID) : TypedId { init { UuidV7.requireV7(value) } }
```

Module pattern (illustrative, in `hms.platform.tasks.api`):

```kotlin
@JvmInline
value class TaskId(override val value: java.util.UUID) : TypedId {
    init { UuidV7.requireV7(value) }
}
```

## 6. `hms.kernel.time` (stable)

### 6.1 The two time axes

| Concept | Type | Comes from | Never |
|---|---|---|---|
| Recorded (system, transaction) time | `RecordedTime` | only the injected `Clock`, at the moment the server records; for journal rows, the appender's single clock read (D10) | supplied by a client, a command, a device or an interface |
| Clinical (valid, effective) time | `ClinicalTime` | the user, the device or the interface message, with its original UTC offset | silently replaced by recorded time; made from a recorded time |
| Clinical validity of a fact | `ValidTime` | a start and an optional end, both `ClinicalTime` with their offsets | empty or reversed |
| Validity of a fact or a setting, as instants | `ValidPeriod` | half-open `[start, end)` over instants; `ValidTime.toValidPeriod()` | closed or empty |
| The two axes of a query | `AsOf` | "what did the record say, as known at `knownAt`, about `validAt`" | written as a recorded time |

Sources: SI-10 "Clinical time is distinct from system time"; §6.2 "Clinical time and recorded time are separate fields everywhere"; §8.1 P2; R11 §1 P2; R08 §3.7; §5.3 "instants stored in UTC with the original offset"; §6.4 `valid_period tstzrange`.

**Offsets [P].** `ClinicalTime` keeps the original offset that came with it (§5.3; BP §7.6). An offset with non-zero seconds (historic local mean time only) is refused, because RFC 3339 and the envelope's `validfrom` cannot carry it. `RecordedTime` is a UTC instant only: the server has no "original" local offset of its own, and display uses the facility zone (§8.1 P10). This is this build's reading of §5.3 (OQ-KN11).

**Time zones and DST [P].** The facility zone is the facility node's `zone` attribute in `platform-tenancy` (§8.1 P10; section 12; the §4.1 per-tenant default is OQ-KN15). The kernel never assumes that any zone has a fixed offset; zone rules come from the JDK's IANA time-zone data, which is a SOUP item updated with the JDK (§4.3 "SOUP list"). Elapsed-time rules (SLA, escalation, `TaskOrphaned`, "within 4 h") are `Instant` plus `Duration`, so a DST change never stretches or shrinks them. Local wall-clock entry ("08:00") is resolved through `ClinicalTime.resolveLocal`, which never guesses: a time in a DST gap is refused and a time in a DST overlap returns both candidates for the user to choose (R11 §15 item 9 "daylight-saving transitions handled for scheduled meds").

**No clinical time from recorded time [P] (CTRL-0010-3; D10).** No kernel function makes a `ClinicalTime` from a `RecordedTime`; revision 1's `ClinicalTime.atRecordedTime` is removed. When an act and its recording are the same server-side event, the entry says so with `ValidTimeInput.AtRecording`. The journal appender then stamps the valid time from its own single clock read (D10). `AtRecording` is lawful only where section 6.2 allows it: event types that the event catalogue declares `CLINICAL_AT_RECORDING` or `EFFECTIVE`, and never for an offline-captured, back-entered, device, interface or migrated entry. So an offline scan always carries its capture time, never its sync time. The stored `ClinicalTimeSource.AT_RECORDING` keeps the defaulting visible in the record. Code that rebuilds a clinical time from `RecordedTime.instant` is flagged by the detekt rule `NoClinicalTimeFromRecordedTime` (KA-KN3 states what it cannot see).

**Date of birth (§8.1 P10).** A date of birth is a `java.time.LocalDate` without a zone, owned by `empi` with its precision flag (L-13). The kernel offers no conversion from a `LocalDate` to `ClinicalTime`, so a date of birth can never become an instant by accident [P]. Approximate clinical times on paper records (a date only, "morning") are OQ-KN14.

**As-was query coordinates (D4) [P].** `AsOf.knownAt` is an `Instant`, not a `RecordedTime`. It is a query bound ("as known at 09:12"), not a stamp. So application and web code can build an as-was query from a user's instant without any persistence-only factory, and a query coordinate can never be written as a recorded time, because writes take recorded time only from the journal's clock read (D10) or `RecordedTime.now(clock)`. `RecordedTime` stays the type of every written row. `AsOf.knownAt(validAt, recorded)` builds a query from a recorded time already held. This is the "lawful way" D4 asks for; `AsOf` remains the only as-of type, and siblings use it (tenancy's own `AsOf` and the journal's bare `knownAt: Instant` parameters are replaced by it).

```kotlin
package hms.kernel.time

/** System time. Made only from the injected Clock; truncated to microseconds. */
@JvmInline
value class RecordedTime private constructor(val instant: java.time.Instant) : Comparable<RecordedTime> {
    override fun compareTo(other: RecordedTime): Int
    companion object {
        /** The only way application code gets a recorded time. */
        @JvmStatic fun now(clock: java.time.Clock): RecordedTime
        /** Rebuilds a stored value. ArchUnit: callable only from ..infrastructure.persistence.., hms.kernel.journal.infrastructure.. and hms.kernel.journal.inmemory.. (section 11). */
        @PersistenceOnly @JvmStatic fun restore(instant: java.time.Instant): RecordedTime
    }
}

/** Clinical (valid) time with the offset it was given in. Truncated to microseconds. */
class ClinicalTime private constructor(val instant: java.time.Instant, val offset: java.time.ZoneOffset) :
    Comparable<ClinicalTime> {
    fun toOffsetDateTime(): java.time.OffsetDateTime
    fun atZone(zone: java.time.ZoneId): java.time.ZonedDateTime
    fun isSameInstantAs(other: ClinicalTime): Boolean
    /** By instant, then by offset, so that it agrees with equals. */
    override fun compareTo(other: ClinicalTime): Int
    // equals and hashCode: instant and offset
    companion object {
        /** Input from a user, device or message: RFC 3339 date-time with an explicit offset ("Z" is +00:00). */
        @JvmStatic fun parse(text: String): ClinicalTimeParseResult
        /** Throws IllegalArgumentException for an offset with non-zero seconds (a programming error once input went through parse). */
        @JvmStatic fun of(dateTime: java.time.OffsetDateTime): ClinicalTime
        @JvmStatic fun of(instant: java.time.Instant, offset: java.time.ZoneOffset): ClinicalTime
        /** Resolves a wall-clock time in a zone without guessing across DST transitions. */
        @JvmStatic fun resolveLocal(local: java.time.LocalDateTime, zone: java.time.ZoneId): LocalTimeResolution
    }
}

sealed interface ClinicalTimeParseResult {
    data class Valid(val time: ClinicalTime) : ClinicalTimeParseResult
    data class Invalid(val error: ClinicalTimeParseError) : ClinicalTimeParseResult
}

enum class ClinicalTimeParseError { MALFORMED, OFFSET_MISSING, OFFSET_HAS_SECONDS, OUT_OF_RANGE }

sealed interface LocalTimeResolution {
    data class Resolved(val time: ClinicalTime) : LocalTimeResolution
    /** DST overlap: the wall-clock time happened twice; the user chooses. */
    data class Ambiguous(val earlier: ClinicalTime, val later: ClinicalTime) : LocalTimeResolution
    /** DST gap: the wall-clock time never happened in this zone; refused. */
    data class InGap(val local: java.time.LocalDateTime, val zone: java.time.ZoneId) : LocalTimeResolution
}

/** Clinical validity with original offsets: [start, endExclusive); endExclusive null means open. Never empty. */
class ValidTime private constructor(val start: ClinicalTime, val endExclusive: ClinicalTime?) {
    fun toValidPeriod(): ValidPeriod
    companion object {
        @JvmStatic fun from(start: ClinicalTime): ValidTime
        /** Emptiness is checked after truncation to microseconds. */
        @JvmStatic fun of(start: ClinicalTime, endExclusive: ClinicalTime): ValidTimeResult
    }
}

sealed interface ValidTimeResult {
    data class Valid(val validTime: ValidTime) : ValidTimeResult
    /** endExclusive is not after start. */
    data object EmptyOrReversed : ValidTimeResult
}

/** What an entry says about its valid time (D10). */
sealed interface ValidTimeInput {
    data class Given(val validTime: ValidTime) : ValidTimeInput
    /** The act is its own recording: the journal appender sets start = its recorded time, offset UTC, open end. */
    data object AtRecording : ValidTimeInput
}

/** Declared per event type in the event catalogue (hms.kernel.events), never by a command or a request. */
enum class ValidTimeKind {
    /** A clinical act whose time the user, the device or the interface supplies (an observation, a dose given). */
    CLINICAL_CAPTURED,
    /** An act that happens when the server records it (for example a task state change); may also be given a time. */
    CLINICAL_AT_RECORDING,
    /** An effective date of configuration or structure (tenancy, config); not a clinical time. A start earlier than the recorded time is BackDated (section 6.2). */
    EFFECTIVE,
}

/** Where the stored clinical time came from. Stored with the journal row and shown with the label. */
enum class ClinicalTimeSource { ENTERED, DEVICE, INTERFACE, AT_RECORDING, MIGRATED, EFFECTIVE_DATE }

/** Half-open [start, endExclusive); endExclusive null means open-ended. Never empty. Maps to tstzrange '[)'. */
class ValidPeriod private constructor(val start: java.time.Instant, val endExclusive: java.time.Instant?) {
    val isOpenEnded: Boolean
    fun contains(instant: java.time.Instant): Boolean
    fun overlaps(other: ValidPeriod): Boolean
    companion object {
        @JvmStatic fun from(start: java.time.Instant): ValidPeriod
        /** Both bounds are truncated to microseconds first; then emptiness is checked. */
        @JvmStatic fun of(start: java.time.Instant, endExclusive: java.time.Instant): ValidPeriodResult
    }
}

sealed interface ValidPeriodResult {
    data class Valid(val period: ValidPeriod) : ValidPeriodResult
    /** endExclusive is not after start. */
    data object EmptyOrReversed : ValidPeriodResult
}

/**
 * The coordinates of an as-was question on both axes (§7 item 3; R08 §3.7): what the record said, as known
 * at [knownAt], about [validAt]. knownAt null means the latest knowledge. The only as-of type (D4) [P].
 * knownAt is a query bound, never a stamp, so it is an Instant.
 */
data class AsOf(val validAt: java.time.Instant, val knownAt: java.time.Instant? = null) {
    companion object {
        @JvmStatic fun latest(validAt: java.time.Instant): AsOf
        /** As known at a recorded time already held, for example a journal row's own recorded time. */
        @JvmStatic fun knownAt(validAt: java.time.Instant, recorded: RecordedTime): AsOf
    }
}

/** Kotlin opt-in marker for persistence-only factories; the binding check is the ArchUnit rule. */
@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
annotation class PersistenceOnly
```

### 6.2 Entry timing: back-dating, back-entry and late data (SI-10)

SI-10: "Back-dating is privileged and audited. Back-entry keeps the original clinical times and is labelled. Back-entry after outages will be frequent, so tooling and audit are sized for it." §7 item 3: "Back-entry tooling records valid time = paper time and recorded time = now, labelled." §8.3: "migrated data carries `migrated` provenance with its original times."

**One vocabulary (D10).** `EntryTimingCode` is the only entry-timing vocabulary. The journal's `entry_timing` column, the envelope's `entrytiming` extension and every module use it; the journal's revision 1 list of four values goes. Labels shown on screens, prints and exports come from the code (`EntryTimingCode.labelled`); their display text is localisation content keyed `entry-timing.<code>`.

**Who classifies (D10).** The journal appender is the only binding classifier. For each append it reads the clock once and makes the `RecordedTime`. It takes the `EntryMode` from `CommandContext.entryMode` (section 7.3). It gets the policy through `EntryTimePolicySource` only when `EntryTimeClassifier.needsPolicy` says so. It classifies every entry, refuses the append when an entry's expected `EntryTimingCode` differs from the result, and then enforces the result's requirements (below). A module may call the classifier to predict the result, for example to ask the user for a reason first; a prediction binds nothing. The classifier is pure, so every channel gets the same answer (§2.1 preamble; §2.2 rule 7).

**Entry modes are derived, never declared (D10).** `EntryMode` is computed from the actor kind, the capture channel and the back-entry authority of the authenticated command context (section 7.3). No request field, header or command field sets it. The objects that select the privileged modes (`BackEntryAuthority`, `CaptureChannel.OfflineQueued`, the non-user `ActorRef` kinds) can be built only in allow-listed packages (section 11), and those allow-lists hold no WP-0.3 production package.

**What is classified [P].** The start of the `ValidTime` is classified (lag = recorded instant minus clinical start instant; a positive lag means the clinical time is earlier). For `CLINICAL_*` kinds the end, when given, must not be later than the recorded time by more than the future tolerance either.

| Mode | Valid time input and kind | Condition | Result | Code | Policy |
|---|---|---|---|---|---|
| any | `Given`, kind `EFFECTIVE` | start earlier than recorded (a retroactive change) | `BackDated(lag, EFFECTIVE_DATE)` | `BACK_DATED` | no |
| any | any input, kind `EFFECTIVE` | — (start not earlier than recorded, or `AtRecording`) | `EffectiveDated` (source `EFFECTIVE_DATE`) | `EFFECTIVE_DATED` | no |
| any | `AtRecording`, kind `CLINICAL_CAPTURED` | — | `Refused(CAPTURE_TIME_REQUIRED)` | — | no |
| `OFFLINE_CAPTURE`, `BACK_ENTRY`, `DEVICE`, `INTERFACE`, `MIGRATION` | `AtRecording`, any `CLINICAL_*` kind | — | `Refused(CAPTURE_TIME_REQUIRED)` | — | no |
| `USER` or `SYSTEM` | `AtRecording`, kind `CLINICAL_AT_RECORDING` | — | `Contemporaneous(AT_RECORDING)` | `CONTEMPORANEOUS` | no |
| `SYSTEM` | `Given`, any `CLINICAL_*` kind | — | `Refused(SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME)` | — | no |
| `USER`, `OFFLINE_CAPTURE`, `DEVICE`, `INTERFACE` | `Given`, `CLINICAL_*` | the policy is not available | `Refused(TIMING_POLICY_NOT_CONFIGURED)` | — | needed |
| `USER`, `OFFLINE_CAPTURE`, `DEVICE`, `INTERFACE` | `Given`, `CLINICAL_*` | clinical start or end later than recorded by more than `futureTolerance` | `Refused(CLINICAL_TIME_IN_FUTURE)` | — | needed |
| `BACK_ENTRY`, `MIGRATION` | `Given`, `CLINICAL_*` | clinical start or end later than recorded by any amount | `Refused(CLINICAL_TIME_IN_FUTURE)` | — | no |
| `USER` | `Given` | lag ≤ `contemporaneousTolerance` | `Contemporaneous(ENTERED)` | `CONTEMPORANEOUS` | needed |
| `USER` | `Given` | lag > `contemporaneousTolerance` | `BackDated(lag, ENTERED)` | `BACK_DATED` | needed |
| `OFFLINE_CAPTURE` | `Given` | lag ≤ `offlineCaptureTolerance` | `OfflineCapture(lag)` | `OFFLINE_CAPTURE` | needed |
| `OFFLINE_CAPTURE` | `Given` | lag > `offlineCaptureTolerance` | `Refused(OFFLINE_CAPTURE_TOO_LATE)` | — | needed |
| `BACK_ENTRY` | `Given` | no episode passed | `Refused(BACK_ENTRY_WITHOUT_EPISODE)` | — | no |
| `BACK_ENTRY` | `Given` | clinical start inside the episode window | `BackEntry(lag, episodeId)` | `BACK_ENTRY` | no |
| `BACK_ENTRY` | `Given` | clinical start outside the episode window | `Refused(OUTSIDE_BACK_ENTRY_WINDOW)` | — | no |
| `DEVICE`, `INTERFACE` | `Given` | lag ≤ `interfaceLatenessTolerance` | `Contemporaneous(DEVICE or INTERFACE, after the mode)` | `CONTEMPORANEOUS` | needed |
| `DEVICE`, `INTERFACE` | `Given` | lag > `interfaceLatenessTolerance` | `LateArrival(lag, DEVICE or INTERFACE)` | `LATE_ARRIVAL` | needed |
| `MIGRATION` | `Given` | clinical start not after recorded | `Migrated(lag)` | `MIGRATED` | no |

Rows are checked top to bottom; the first that matches decides. Boundaries are inclusive on the accepting side (a lag equal to the tolerance is accepted) [P]. "The policy is not available" means `EntryTimePolicyLookup` is `NotConfigured`, `Unavailable` or `NotLookedUp`.

**Requirements of each accepted result [P].** The journal enforces them (journal specification); the kernel only states them.

| Result | Requirements |
|---|---|
| `Contemporaneous` | none; the source (`ENTERED`, `DEVICE`, `INTERFACE`, `AT_RECORDING`) is stored |
| `BackDated` | `BACK_DATING_AUTHORIZATION` (a policy decision verified through the journal's `BackDatingAuthorization` port; its WP-0.3 production binding refuses every back-dated append, D10), `USER_ENTERED_REASON` (a `ChangeReason.Entered`, never defaulted), `AUDIT_BOTH_TIMES`, `LABEL_ON_DISPLAY_PRINT_EXPORT` (CTRL-0010-4). The same four apply to a retroactive `EFFECTIVE` change; no timing policy is involved |
| `BackEntry` | `BACK_ENTRY_AUTHORITY` (the context's `BackEntryAuthority`, issued by the back-entry tooling only after its own permission check and a server-side episode lookup), `AUDIT_BOTH_TIMES`, `LABEL_ON_DISPLAY_PRINT_EXPORT` (CTRL-0010-5). Whether back-entry also needs the back-dating privilege is DN-KN6 |
| `OfflineCapture` | `CHANNEL_IDENTITY` (the device of the offline session), `AUDIT_BOTH_TIMES`, `LABEL_ON_DISPLAY_PRINT_EXPORT` |
| `LateArrival` | `CHANNEL_IDENTITY` (the device or interface actor), `AUDIT_BOTH_TIMES`, `LABEL_ON_DISPLAY_PRINT_EXPORT` |
| `Migrated` | `MIGRATION_PROVENANCE` (§8.3), `AUDIT_BOTH_TIMES`, `LABEL_ON_DISPLAY_PRINT_EXPORT` |
| `EffectiveDated` | none from the kernel (the start is not earlier than the recorded time); the owning module's own rules still apply (for example tenancy's W-11) |

The stored source is fixed by the result: `BackEntry` and `OfflineCapture` are `ENTERED`; `Migrated` is `MIGRATED`; `EffectiveDated` is `EFFECTIVE_DATE`; `BackDated` (`ENTERED` for a clinical kind, `EFFECTIVE_DATE` for `EFFECTIVE`), `Contemporaneous` and `LateArrival` carry theirs.

**A refused channel entry is never dropped [P] (SI-03; §5.3).** A `Refused` result on a `DEVICE`, `INTERFACE`, `OFFLINE_CAPTURE` or `MIGRATION` channel does not lose the data. The inbound adapter puts the message in an owned, alarmed exception queue (the dead-letter path of `hms.kernel.events` and `platform-tasks`, D15), with the refusal reason. The kernel supplies the refusal codes. The never-drop rule is each inbound adapter's control, with its test `PropertyTest:SI-10-refused-channel-entry-goes-to-owned-queue` planned with the first inbound clinical adapter; no such adapter exists in WP-0.3. Proposed cause HC-KN3.

```kotlin
package hms.kernel.time

/** Derived by CommandContext.entryMode (section 7.3); never read from request input. */
enum class EntryMode { USER, OFFLINE_CAPTURE, BACK_ENTRY, DEVICE, INTERFACE, MIGRATION, SYSTEM }

/** The class of record whose tolerances apply (for example "vital-sign"); declared per event type in the event catalogue. */
@JvmInline
value class TimingClass(val name: String) // [a-z][a-z0-9-]*, checked in init

object EntryTimeClassifier {
    /** True when classify needs an EntryTimePolicy for this combination (section 6.2 table, column "Policy"). */
    fun needsPolicy(input: ValidTimeInput, kind: ValidTimeKind, mode: EntryMode): Boolean

    fun classify(
        input: ValidTimeInput,
        kind: ValidTimeKind,
        recorded: RecordedTime,
        mode: EntryMode,
        policy: EntryTimePolicyLookup,
        episode: BackEntryEpisode?, // from the context's BackEntryAuthority; used only in BACK_ENTRY
    ): EntryTimingResult
}

sealed interface EntryTimingResult {
    /** validTime is the stamped value for AtRecording, otherwise the given one. policy is null when none was needed. */
    data class Accepted(val timing: EntryTiming, val validTime: ValidTime, val policy: EntryTimePolicy?) : EntryTimingResult
    data class Refused(val reason: EntryTimeRefusal) : EntryTimingResult
}

/** Accepted classifications only: a refused entry has no EntryTiming and cannot be appended. code, source and requirements are fixed per subtype (section 6.2). */
sealed interface EntryTiming {
    val code: EntryTimingCode
    val source: ClinicalTimeSource
    val requirements: Set<TimingRequirement>

    data class Contemporaneous(override val source: ClinicalTimeSource) : EntryTiming
    /** source ENTERED for a CLINICAL_* kind, EFFECTIVE_DATE for a retroactive EFFECTIVE change. */
    data class BackDated(val lag: java.time.Duration, override val source: ClinicalTimeSource) : EntryTiming
    data class BackEntry(val lag: java.time.Duration, val episodeId: java.util.UUID) : EntryTiming
    data class OfflineCapture(val lag: java.time.Duration) : EntryTiming
    data class LateArrival(val lag: java.time.Duration, override val source: ClinicalTimeSource) : EntryTiming
    data class Migrated(val lag: java.time.Duration) : EntryTiming
    data object EffectiveDated : EntryTiming
}

/** The one stored vocabulary (D10): the journal's entry_timing column and the envelope's entrytiming extension. */
enum class EntryTimingCode(val labelled: Boolean) {
    CONTEMPORANEOUS(false),
    BACK_DATED(true),
    BACK_ENTRY(true),
    OFFLINE_CAPTURE(true),
    LATE_ARRIVAL(true),
    MIGRATED(true),
    EFFECTIVE_DATED(false),
}

enum class EntryTimeRefusal {
    CLINICAL_TIME_IN_FUTURE,
    CAPTURE_TIME_REQUIRED,
    SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME,
    TIMING_POLICY_NOT_CONFIGURED,
    OFFLINE_CAPTURE_TOO_LATE,
    BACK_ENTRY_WITHOUT_EPISODE,
    OUTSIDE_BACK_ENTRY_WINDOW,
}

enum class TimingRequirement {
    BACK_DATING_AUTHORIZATION,
    BACK_ENTRY_AUTHORITY,
    USER_ENTERED_REASON,
    CHANNEL_IDENTITY,
    MIGRATION_PROVENANCE,
    AUDIT_BOTH_TIMES,
    LABEL_ON_DISPLAY_PRINT_EXPORT,
}

/** Tolerances for one timing class (section 6.3). Built only by its factory from resolved settings (D11, section 6.5). */
class EntryTimePolicy private constructor(
    val timingClass: TimingClass,
    val contemporaneousTolerance: java.time.Duration,
    val futureTolerance: java.time.Duration,
    val interfaceLatenessTolerance: java.time.Duration,
    val offlineCaptureTolerance: java.time.Duration,
    val sources: List<ResolvedParameter<java.time.Duration>>, // key, provenance and source of each value
) {
    // init: every duration >= 0; four sources whose keys are the timing class's four keys (section 6.3)
    companion object {
        @SafetyParameterFactory @JvmStatic
        fun fromResolved(
            timingClass: TimingClass,
            contemporaneous: ResolvedParameter<java.time.Duration>,
            future: ResolvedParameter<java.time.Duration>,
            interfaceLateness: ResolvedParameter<java.time.Duration>,
            offlineCapture: ResolvedParameter<java.time.Duration>,
            environment: EnvironmentClass,
        ): SafetyParameterResult<EntryTimePolicy>
    }
}

sealed interface EntryTimePolicyLookup {
    data class Available(val policy: EntryTimePolicy) : EntryTimePolicyLookup
    /** A definition or its value is missing (until DN-KN1: always, since no tolerance has a value). */
    data class NotConfigured(val timingClass: TimingClass, val missingKeys: List<String>) : EntryTimePolicyLookup
    /** Configuration could not be read. */
    data object Unavailable : EntryTimePolicyLookup
    /** The caller did not look a policy up because needsPolicy was false. */
    data object NotLookedUp : EntryTimePolicyLookup
}

/** A downtime episode as held by the episode registry (TRU-BCP-03; platform-site). Never built from a command payload. */
class BackEntryEpisode private constructor(val episodeId: java.util.UUID, val window: ValidPeriod) {
    companion object {
        /** ArchUnit: callable only from the episode registry's package (none in WP-0.3) and test sources. */
        @EpisodeRegistryOnly @JvmStatic fun fromRegistry(episodeId: java.util.UUID, window: ValidPeriod): BackEntryEpisode
    }
}

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
annotation class EpisodeRegistryOnly
```

### 6.3 Where the tolerances come from

The kernel reads no configuration. `EntryTimePolicySource` (section 7.6) is the port the journal reads through; `platform-tenancy` implements it with `hms.platform.tenancy.application.settings.EntryTimePolicyResolver` (D2, D5; tenancy specification §3; section 21).

- **Keys [P].** Four per timing class: `platform.time.entry.<timing-class>.contemporaneous-tolerance`, `.future-tolerance`, `.interface-lateness-tolerance`, `.offline-capture-tolerance`. Tenancy's key grammar reserves `platform.time.entry` as a shared namespace for these keys.
- **Who declares them.** The module that owns the event types of a timing class declares its four `SettingDefinition`s in its `api` package and registers them through tenancy's `SettingCatalogueRegistrar` (D2). Each is `SafetyInvariant` (SI-10; CTRL-0010-1), `VendorLock.TightenOnly`, `configurationRequired = RequiredBecause("CTRL-0010-1")`, `GOVERNED`, with no `vendorDefault` and with `USER` not in its allowed levels (tenancy D-2, D-4). Each definition's `Direction.samples` (tenancy D-7) carry the synthetic ordered pairs below, with source CTRL-0010-1.
- **No value yet.** No value exists until DN-KN1 is answered [P]. The resolver then answers `NotConfigured`, the classifier answers `Refused(TIMING_POLICY_NOT_CONFIGURED)`, and the journal refuses the append. Mechanism and tests: section 16.
- **WP-0.3 effect.** No WP-0.3 event type is `CLINICAL_CAPTURED`, and no WP-0.3 entry needs a policy: task rows use `ValidTimeInput.AtRecording`, and a task's `performedAt` is payload data (`platform-tasks` specification). A later entry that needs a policy is refused in production until DN-KN1 is answered. Tests use synthetic policies built through the factory with `ContentProvenance.SYNTHETIC` and `EnvironmentClass.TEST`.
- **Resolution.** The policy is resolved for the context's tenant and facility, at `AsOf.latest(recorded instant)`.
- **Strictness direction (D12).** For each of the four tolerances this build proposes that a smaller duration is stricter: it flags more entries as back-dated or late, and refuses more future times [P]. A smaller future, lateness or offline tolerance also refuses more device and offline data, which is safe only because a refused channel entry goes to an owned queue (section 6.2). The CSO confirms the direction (DN-KN1). Each definition's `Strictness` comparator is checked against this direction by `PropertyTest:entry-time-tolerance-strictness-direction`, using synthetic ordered pairs (a zero duration is stricter than any positive one; of two positive durations, the shorter is stricter). These pairs are test samples, not values. The property is written when the owning module registers the four definitions with tenancy's `Strictness` (after DN-KN1); WP-0.3's time slice has no definition to run it against, and no test pretends otherwise.

### 6.4 `BusinessCalendar`

Tenant calendars with the Friday-Saturday weekend and Kurdistan holidays are data [L] (§7 item 1; §11.7; L-20). `platform-tenancy` builds the calendar (its `CalendarReader`) from the generic settings `calendar.weekend-days` and `calendar.holidays` and the facility zone (D3; section 12). The holiday value lists the years it covers; tenancy passes them as `confirmedYears` (tenancy specification §5.10). The Kurdistan pack supplies the values under its items `kri.calendar.weekend` and `kri.calendar.holidays` ([L] L-20). No day or date is written in code. Holidays are whole days in the calendar's zone [P]. Business hours wait for OQ-KN9.

**Where it applies.** The kernel offers the arithmetic and does not settle where it applies. `platform-tasks` reads "calendar-aware" timers for safety work as continuous time (orphan alarm, clinical SLAs, escalation, the 4-hour review of CTRL-0005-12 never pause for a weekend or holiday) and raises that reading as a decision for the CSO (`platform-tasks` specification). The kernel's tests support either answer.

**Coverage [P].** Holidays such as the Eids move every year and are configured each year (L-20). A year counts as covered only when configuration confirms that its holiday list is complete: it is one of the `confirmedYears`, which tenancy takes from the covered years listed in the `calendar.holidays` value. Holiday dates alone never confirm a year. A holiday dated in a year that is not confirmed is refused when the calendar is built (`HolidayOutsideConfirmedYears`), so a recurring holiday such as Newroz entered for every year cannot make a year look complete. An answer that touches an unconfirmed year still returns a value, treating unknown days as business days (so a deadline comes earlier, never later), and lists the uncovered years. `platform-tasks` raises its owned configuration alarm when an answer is incomplete (interface assumed, section 21).

**Local-time deadlines [P].** `plusBusinessDaysAtLocalTime` serves `platform-tasks`' business-calendar SLA ("the same local time on the Nth business day after `startsAt`"). It takes the local date and time of `start` in the zone, moves the date with `plusBusinessDays`, and combines it with the same local time. No user is present to choose, so the rule is fixed and always takes the earlier instant: in a DST gap, the first instant after the gap (the transition instant); in a DST overlap, the earlier offset.

```kotlin
package hms.kernel.time

class BusinessCalendar private constructor(
    val zone: java.time.ZoneId,
    val weekend: Set<java.time.DayOfWeek>,
    val holidays: Set<java.time.LocalDate>,
    val confirmedYears: Set<java.time.Year>,
) {
    fun isBusinessDay(date: java.time.LocalDate): CalendarAnswer<Boolean>
    /** days >= 0; negative throws. 0 returns date. n >= 1: the n-th business day strictly after date, whether or not date is one. */
    fun plusBusinessDays(date: java.time.LocalDate, days: Int): CalendarAnswer<java.time.LocalDate>
    /** The same local time in [zone] on plusBusinessDays(start's local date, days); DST rule above. days >= 0; negative throws. */
    fun plusBusinessDaysAtLocalTime(start: java.time.Instant, days: Int): CalendarAnswer<java.time.Instant>
    /** Business days in [startInclusive, endExclusive); a reversed range throws. */
    fun businessDaysBetween(startInclusive: java.time.LocalDate, endExclusive: java.time.LocalDate): CalendarAnswer<Int>
    companion object {
        @JvmStatic fun of(
            zone: java.time.ZoneId,
            weekend: Set<java.time.DayOfWeek>,
            holidays: Set<java.time.LocalDate>,
            confirmedYears: Set<java.time.Year>,
        ): BusinessCalendarResult
    }
}

data class CalendarAnswer<T>(val value: T, val uncoveredYears: Set<java.time.Year>) {
    val isComplete: Boolean get() = uncoveredYears.isEmpty()
}

sealed interface BusinessCalendarResult {
    data class Valid(val calendar: BusinessCalendar) : BusinessCalendarResult
    data object NoBusinessDayInWeek : BusinessCalendarResult
    /** A holiday whose year is not in confirmedYears. */
    data class HolidayOutsideConfirmedYears(val dates: Set<java.time.LocalDate>) : BusinessCalendarResult
}
```

Revision 1's `plusBusinessTime(Instant, Duration)` is removed: no consumer needs it and its DST behaviour was not defined.

### 6.5 Governed safety parameters (D11)

A safety parameter (the SI-10 tolerances, the SI-05 hard-stop factor, and any later one of the same kind) cannot be hand-made [P]:
- Its class has a private constructor and validates its values in `init`.
- It is built only by a `@SafetyParameterFactory` function from `ResolvedParameter` values, which carry the setting key, the content provenance and the source entry.
- `ArchTest:safety-parameter-factories-only-in-resolvers` allows calls to those factories only from the packages in the arch-rules allow-list `SAFETY_PARAMETER_RESOLVERS` and from test sources. In WP-0.3 the list holds the tenancy resolver package that implements `EntryTimePolicySource` (`hms.platform.tenancy.application.settings..`, tenancy specification §3) and the `platform-tasks` resolver package (`hms.platform.tasks.infrastructure.config..`), which builds the task safety policies and `DeadLetterAlarmPolicy`. The medications and CDS resolver joins in Phase 1. Every change to the list needs safety code-owner review.
- **Synthetic gate (§19.4 "a gate, not a label").** Every factory takes the `EnvironmentClass` and refuses a value with `ContentProvenance.SYNTHETIC` when the environment is `TRAIN` or `PROD` (`SafetyParameterRefusal.SYNTHETIC_IN_TRAIN_OR_PROD`). Test: `UnitTest:synthetic-safety-parameters-refused-in-train-and-prod`. This sits behind `platform-config`'s gate G8, which refuses synthetic bundle items for TRAIN and PROD; it also covers values that reach a factory by any other path.
- The provenance travels with the result: `EntryTimingResult.Accepted.policy` and `ComparisonRecord` (section 10.5) carry the keys and sources, so the journal row and audit event can say which configuration an entry was judged by.

These types sit in `hms.kernel.time` because it is the lowest kernel library that both users (`hms.kernel.time` itself and `hms.kernel.quantity`) can depend on.

```kotlin
package hms.kernel.time

/** §19.4 vocabulary. platform-tenancy and platform-config use this type. */
enum class ContentProvenance { SYNTHETIC, APPROVED }

/** The deployment environment. platform-config's Environment is a typealias of this type; tenancy imports it. */
enum class EnvironmentClass { BUILD, TEST, TRAIN, PROD, PLAY }

/** A value resolved from the configuration chain, with where it came from. */
class ResolvedParameter<T : Any>(
    val key: String,
    val value: T,
    val provenance: ContentProvenance,
    val sourceRef: String, // the value entry id, or "definition-default"
    val changeSet: java.util.UUID?,
)

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
annotation class SafetyParameterFactory

sealed interface SafetyParameterResult<out T> {
    data class Built<T>(val parameter: T) : SafetyParameterResult<T>
    data class Refused(val reason: SafetyParameterRefusal, val key: String) : SafetyParameterResult<Nothing>
}

enum class SafetyParameterRefusal { SYNTHETIC_IN_TRAIN_OR_PROD, VALUE_OUT_OF_RANGE, KEY_MISMATCH }
```

## 7. `hms.kernel.context`: the command context (stable)

### 7.1 What a command carries

§6.2: "Commands carry context: tenant, facility, actor, on-behalf-of, device, purpose-of-use, clinical (valid) time, idempotency key and correlation id." D1 adds the causation id, the change reason and the transaction context.

| Field | Type | Rule [P] |
|---|---|---|
| tenant | `TenantId` | always |
| facility | `FacilityId?` | null only for tenant-level work (§5.3 "`facility_id` where it applies") |
| actor | `ActorRef` | always, with its kind (7.2) |
| on-behalf-of | `UserId?` | only when the actor kind is `USER`; never the actor's own user |
| device | `DeviceRef?` | the device the command came from (workstation, handheld, scanner); required for a `DEVICE` actor and for offline capture, and must match them |
| purpose of use | `PurposeOfUse` | always; a code from the Trust Plane vocabulary (R07 AZ-7; WP-0.4). The kernel checks only its form and defines no values (OQ-KN13) |
| clinical time | `ClinicalTime?` | the act time the client or device supplied for the command; required for offline capture (the device's capture time) |
| capture channel | `CaptureChannel` | `Online`, or `OfflineQueued`, which only the offline sync endpoint can build (7.2) |
| back-entry authority | `BackEntryAuthority?` | only from the back-entry tooling (7.2); only with a `USER` actor; its facility must equal the context's facility |
| idempotency key | `IdempotencyKey` | always (§6.3 `Idempotency-Key`); 1 to 200 visible ASCII characters [P], matching the journal's limit |
| correlation id | `CorrelationId` | always; UUIDv7 |
| causation id | `CausationId?` | the event or command that caused this one; null for a first cause |

The change reason (`ChangeReason`) belongs to each change, not to the context, because one command may carry several changes with different reasons. The journal takes it per entry.

### 7.2 Actor kinds and who may build them

There is no actor kind for AI. An AI draft is accepted by a `USER`, and its origin is a journal attribute (the journal's `AI_DRAFT` source), not an actor kind.

| Kind | Means | Factory | Who may call it (ArchUnit, section 11) |
|---|---|---|---|
| `USER` | a person's HMS account (`UserId`) | `ActorRef.user(UserId)` | anyone in WP-0.3; WP-0.4 binds it to the authenticated principal (KA-KN7) |
| `DEVICE` | a registered device (`DeviceRef`) | `ActorRef.device(DeviceRef)` | allow-list `DEVICE_INBOUND`: test sources only in WP-0.3 |
| `INTERFACE` | a registered interface channel | `ActorRef.interfaceChannel(InterfaceChannelRef)` | allow-list `INTERFACE_INBOUND`: test sources only in WP-0.3 (the Hub, §12, joins later) |
| `MIGRATION_LOADER` | the migration loader identity (§8.3) | `ActorRef.migrationLoader(MigrationRunRef)` | allow-list `MIGRATION_LOADER`: test sources only in WP-0.3 |
| `SYSTEM` | a named platform process | `ActorRef.system(SystemProcess)` | allow-list `SYSTEM_PROCESSES`: `hms.platform.tasks.application.system..` (the orphan scan, SLA breach, escalation and dead-letter alarm paths, D14), `hms.kernel.journal..` (the publication watermark check and automatic gap fill), `hms.kernel.events..` (dead-letter rows written by the event library), `hms.platform.config.application.system..` (the reconciler), and test sources. A signal relay of `platform-workflow` acts as the actor of the event that caused it, never as `SYSTEM` (`platform-workflow.md` section 7). A relay package joins this list only through a revision of this spec with safety review; none is listed, and no relay exists in WP-0.3 |

Two more objects select privileged entry modes and are restricted the same way:
- `CaptureChannel.offlineQueued(DeviceRef)`: allow-list `OFFLINE_SYNC_ENDPOINT`, test sources only in WP-0.3. The mobile offline mode and edge agent (SI-15, `MED-BCM-01`) add their sync endpoint by spec revision.
- `BackEntryAuthority.issue(...)`: allow-list `BACK_ENTRY_TOOLING`, test sources only in WP-0.3. The `TRU-BCP-03` tooling adds its package when it is specified. It issues an authority only after it has checked its own permission (proposed `clinical-time.back-entry`, section 12) and loaded the episode from the registry for the context's facility.

Every addition to these allow-lists is a spec revision with safety code-owner review. With all of them empty in WP-0.3 production, `DEVICE`, `INTERFACE`, `MIGRATION_LOADER`, offline capture and back-entry cannot occur there; this fails closed (section 16).

### 7.3 The entry mode

`CommandContext.entryMode` is derived [P] (D10):

| Context | `EntryMode` |
|---|---|
| actor `USER`, `Online`, no back-entry authority | `USER` |
| actor `USER`, `OfflineQueued`, no back-entry authority | `OFFLINE_CAPTURE` |
| actor `USER`, `Online`, with a back-entry authority | `BACK_ENTRY` |
| actor `DEVICE` | `DEVICE` |
| actor `INTERFACE` | `INTERFACE` |
| actor `MIGRATION_LOADER` | `MIGRATION` |
| actor `SYSTEM` | `SYSTEM` |

Any other combination (back-entry while offline; offline capture or back-entry with a non-user actor; on-behalf-of with a non-user actor) is refused when the context is built.

### 7.4 Change reasons

A reason is never defaulted (§2.1 SI-02 spirit; tenancy and tasks "never defaulted"; D1). `ChangeReason.Entered` holds what a user typed or chose for this change. `ChangeReason.SystemGenerated` holds a coded reason of a `SYSTEM` actor (for example the orphan scan); the journal refuses it for any other actor kind (journal specification). No constant, default parameter or empty reason exists. `StaticAnalysis:no-literal-change-reason` flags a string literal passed to `ChangeReason.entered` outside test sources (KA-KN2 if it slips).

### 7.5 Transactions

`TransactionContext`, `TransactionRunner` and `TxOutcome` move here from `hms.kernel.journal` (D1), because every module's repositories need them, not only the journal. Their meaning is unchanged: the journal's jOOQ adapter implements them, and an aggregate write and its journal rows commit or roll back together (ADR-004).

What a transaction context offers [P] (D1; the journal's J-2 and its in-memory adapter depend on it):
- `tenant`: the tenant the transaction was opened for.
- `markRollbackOnly(cause)` and `isRollbackOnly`: any participant can doom the transaction. When a rollback-only transaction's block returns `TxOutcome.Commit`, the runner rolls back and throws `IllegalStateException` (a programming error).
- `onBeforeCommit(check)`: a check that runs before commit; if it throws, the transaction rolls back and the exception propagates.
- `onCompletion(hook)`: a hook told after the end whether the transaction committed. In-memory adapters use it to keep or drop their changes.
- The context carries no time. A module that needs the append's recorded time reads it from the journal's append result.

`InMemoryTransactionRunner` in `hms.kernel.context.inmemory` implements the runner for tests and the dev profile (D8).

`hms.kernel.context.VolatileStore` is a marker interface with no members. Every in-memory repository or store of the journal and of every module implements it (D8). Each module's start-up guard refuses a `VolatileStore` binding whenever an environment class is set (BUILD, TEST, TRAIN, PROD or PLAY); volatile stores are allowed only in the dev profile with no environment class. One marker for all modules, so the rule is the same everywhere.

`InMemoryTransactionRunner` runs the before-commit checks, then the completion hooks, in registration order. Production wiring never binds it (`ArchTest:production-never-binds-test-adapters`, section 11).

### 7.6 Code

```kotlin
package hms.kernel.context

class CommandContext private constructor(
    val tenant: hms.kernel.ids.TenantId,
    val facility: hms.kernel.ids.FacilityId?,
    val actor: ActorRef,
    val onBehalfOf: hms.kernel.ids.UserId?,
    val device: DeviceRef?,
    val purposeOfUse: PurposeOfUse,
    val clinicalTime: hms.kernel.time.ClinicalTime?,
    val capture: CaptureChannel,
    val backEntry: BackEntryAuthority?,
    val idempotencyKey: IdempotencyKey,
    val correlationId: CorrelationId,
    val causationId: CausationId?,
) {
    /** SI-10 entry mode, derived (section 7.3); never taken from request input. */
    val entryMode: hms.kernel.time.EntryMode
    companion object {
        @JvmStatic fun of(
            tenant: hms.kernel.ids.TenantId,
            facility: hms.kernel.ids.FacilityId?,
            actor: ActorRef,
            onBehalfOf: hms.kernel.ids.UserId?,
            device: DeviceRef?,
            purposeOfUse: PurposeOfUse,
            clinicalTime: hms.kernel.time.ClinicalTime?,
            capture: CaptureChannel,
            backEntry: BackEntryAuthority?,
            idempotencyKey: IdempotencyKey,
            correlationId: CorrelationId,
            causationId: CausationId?,
        ): CommandContextResult
    }
}

sealed interface CommandContextResult {
    data class Valid(val context: CommandContext) : CommandContextResult
    data class Refused(val reasons: Set<CommandContextRefusal>) : CommandContextResult
}

enum class CommandContextRefusal {
    ON_BEHALF_OF_NEEDS_USER_ACTOR, ON_BEHALF_OF_SELF, DEVICE_ACTOR_NEEDS_MATCHING_DEVICE,
    OFFLINE_CAPTURE_NEEDS_USER_ACTOR, OFFLINE_CAPTURE_NEEDS_CLINICAL_TIME, OFFLINE_CAPTURE_DEVICE_MISMATCH,
    BACK_ENTRY_NEEDS_USER_ACTOR, BACK_ENTRY_WHILE_OFFLINE, BACK_ENTRY_FACILITY_MISMATCH,
}

enum class ActorKind { USER, DEVICE, INTERFACE, MIGRATION_LOADER, SYSTEM }

class ActorRef private constructor(val kind: ActorKind, val id: java.util.UUID, val systemProcess: SystemProcess?) {
    companion object {
        @JvmStatic fun user(user: hms.kernel.ids.UserId): ActorRef
        @ActorKindRestricted @JvmStatic fun device(device: DeviceRef): ActorRef
        @ActorKindRestricted @JvmStatic fun interfaceChannel(channel: InterfaceChannelRef): ActorRef
        @ActorKindRestricted @JvmStatic fun migrationLoader(run: MigrationRunRef): ActorRef
        @ActorKindRestricted @JvmStatic fun system(process: SystemProcess): ActorRef
    }
}

@JvmInline value class DeviceRef(val id: java.util.UUID)              // UUIDv7 from the device registry
@JvmInline value class InterfaceChannelRef(val id: java.util.UUID)    // UUIDv7 from the interface registry (Hub)
@JvmInline value class MigrationRunRef(val id: java.util.UUID)        // UUIDv7 of the migration run
@JvmInline value class SystemProcess(val name: String)                // [a-z][a-z0-9.-]*, e.g. "platform-tasks.orphan-scan"
@JvmInline value class PurposeOfUse(val code: String)                 // non-blank, <= 64 chars [P]; vocabulary: Trust Plane (OQ-KN13)
@JvmInline value class IdempotencyKey(val value: String)              // 1..200 visible ASCII [P]
@JvmInline value class CorrelationId(val value: java.util.UUID)       // UUIDv7
@JvmInline value class CausationId(val value: java.util.UUID)

sealed interface CaptureChannel {
    data object Online : CaptureChannel
    class OfflineQueued private constructor(val device: DeviceRef) : CaptureChannel {
        companion object {
            /** Only the offline sync endpoint, from the authenticated device session (section 7.2). */
            @ActorKindRestricted @JvmStatic fun of(device: DeviceRef): OfflineQueued
        }
    }
}

/** Issued by the back-entry tooling after its permission check and a server-side episode lookup (TRU-BCP-03). */
class BackEntryAuthority private constructor(
    val episode: hms.kernel.time.BackEntryEpisode,
    val facility: hms.kernel.ids.FacilityId,
    val permissionDecision: java.util.UUID,
) {
    companion object {
        @BackEntryToolingOnly @JvmStatic fun issue(
            episode: hms.kernel.time.BackEntryEpisode,
            facility: hms.kernel.ids.FacilityId,
            permissionDecision: java.util.UUID,
        ): BackEntryAuthority
    }
}

sealed interface ChangeReason {
    /** Typed or chosen by the user for this change. */
    class Entered private constructor(val text: String) : ChangeReason
    /** A coded reason of a SYSTEM actor; the journal refuses it for other actor kinds. */
    class SystemGenerated private constructor(val code: String) : ChangeReason
    companion object {
        /** Refuses null, blank after trim, and more than 2,000 characters [P]. No default exists. */
        @JvmStatic fun entered(text: String?): ChangeReasonResult
        /** Grammar [a-z][a-z0-9.-]*; throws otherwise (a programming error). */
        @JvmStatic fun system(code: String): ChangeReason
    }
}

sealed interface ChangeReasonResult {
    data class Valid(val reason: ChangeReason.Entered) : ChangeReasonResult
    data class Refused(val error: ChangeReasonError) : ChangeReasonResult
}

enum class ChangeReasonError { MISSING, BLANK, TOO_LONG }

/** The caller's open transaction (section 7.5). Implemented by the runners. */
interface TransactionContext {
    val tenant: hms.kernel.ids.TenantId
    val isRollbackOnly: Boolean
    /** cause: non-blank, for the log; never PHI. */
    fun markRollbackOnly(cause: String)
    /** Runs before commit; a throw rolls the transaction back and propagates. */
    fun onBeforeCommit(check: () -> Unit)
    /** Runs after the end; committed is false after a rollback. */
    fun onCompletion(hook: (committed: Boolean) -> Unit)
}

fun interface TransactionRunner {
    /** Runs block in one transaction; commits only when block returns TxOutcome.Commit, otherwise rolls back. */
    fun <T> inTransaction(tenant: hms.kernel.ids.TenantId, block: (TransactionContext) -> TxOutcome<T>): T
}

sealed interface TxOutcome<T> {
    data class Commit<T>(val value: T) : TxOutcome<T>
    data class Rollback<T>(val value: T) : TxOutcome<T>
}

/** Port: the SI-10 tolerances of a timing class (section 6.3). Implemented by platform-tenancy's resolver. */
fun interface EntryTimePolicySource {
    fun policyFor(
        context: CommandContext,
        timingClass: hms.kernel.time.TimingClass,
        at: hms.kernel.time.AsOf,
    ): hms.kernel.time.EntryTimePolicyLookup
}

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
annotation class ActorKindRestricted

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
annotation class BackEntryToolingOnly
```

## 8. `hms.kernel.testing`: `TestClock` (stable, test-only)

```kotlin
package hms.kernel.testing

/** A controllable java.time.Clock for tests only (D8). Thread-safe. Views made by withZone share the same time. */
class TestClock(initial: java.time.Instant, zone: java.time.ZoneId = java.time.ZoneOffset.UTC) : java.time.Clock() {
    override fun getZone(): java.time.ZoneId
    override fun withZone(zone: java.time.ZoneId): java.time.Clock
    override fun instant(): java.time.Instant
    /** Moves time forward; a negative duration is a programming error. */
    fun advanceBy(duration: java.time.Duration)
    /** Sets time, forwards or backwards, to test clock rollback and skew (§18.3). */
    fun setTo(instant: java.time.Instant)
}
```

It serves the WP-0.5 property tests, `PropertyTest:SI-03-orphan-alarm-within-5-minutes (simulated clock)` (CTRL-0003-5) and the SI-10 properties with clock skew and back-entry (CTRL-0010-2; §18.3). Deterministic ids in tests come from `UuidV7Generator(testClock, SplittableRandom(seed))` [P].

`TestClock` lives in a main source set (`:platform:testing`) but is test-only (D8). A frozen `TestClock` in production would stop every SLA, escalation and `TaskOrphaned` timer without an error. So `ArchTest:production-never-binds-test-adapters` forbids any main class of `app-hms` or of a module (outside `..testing..` and `..inmemory..` packages) from depending on `hms.kernel.testing`, and `UnitTest:app-hms-production-clock-is-system-utc` checks the production wiring (section 11).

## 9. `hms.kernel.money`

Rules (§6.2; §9.21; §11.4; K §8): `BigDecimal` plus a `java.util.Currency` (ISO 4217); never `Double` or `Float` in the API; every operation that can lose precision takes an explicit `RoundingMode`; IQD and USD; cash rounding per tenant (the "IQD 250" figure is an example [L], not a default; L-14).

- **Scale.** An amount's scale always equals the currency's ISO 4217 minor units, read from the JDK (`Currency.getDefaultFractionDigits`) and never typed in code. A currency without minor units in the JDK data (a negative value) is refused by `ofExact` and `ofRounded` (a `MoneyRefusal`). `zero` and `ofMinorUnits` take a currency the caller already holds from validated configuration, so for them it is a programming error and throws [P]. `ofExact` pads a shorter scale with zeros and refuses a longer one. A unit test pins the JDK's value for IQD and USD so that a JDK data change is noticed; its expected values are taken from ISO 4217 when the test is written, not from memory. Whether the ledger keeps IQD at the ISO minor unit or at whole dinars ("reconciliation to the dinar", §9.21) is OQ-KN7.
- **Exact operations:** `plus`, `minus`, unary minus, `times(count: Long)`, `allocate`, `split`. A currency mismatch is a programming error and throws; conversion is always explicit through `ExchangeRate`.
- **Operations that can lose precision** take a `RoundingMode`: `times(factor, rounding)`, `ofRounded`, `ExchangeRate.convert`, `ExchangeRate.convertBack`, cash rounding.
- **Allocation without losing a minor unit [P]:** in minor units (`BigInteger`), each share is the floor of its exact proportion; the remaining minor units go one each to the largest remainders, ties to the lower index. The shares always sum exactly to the original. A negative amount is allocated as its absolute value and negated. Weights are non-negative with a positive sum.
- **Cash rounding:** to a positive increment in the same currency with the tenant's `RoundingMode`; the result keeps the rounding difference so the ledger can post it (§9.21). The policy is built by a validated factory (positive increment). Rounding an amount in another currency is a programming error and throws. "Not configured" is a value. The kernel returns it; the refusal in the cashier flow is `rcm`'s control (R1), and it never blocks care (SI-12 sits in `rcm`, §5.2).
- **Exchange rates:** a rate converts `from` → `to` (units of `to` per one unit of `from`), with an effective period, a source and the time it was recorded (§9.21 "effective-dated exchange-rate table (source and timestamp)"). A table answers "the rate effective at instant t" (§9.21 acceptance: "the exchange rate used on every payment is the one effective at that instant") and refuses overlapping periods for one pair. Whether change in the other currency uses the inverse of one posted rate (`convertBack`) or a separately posted rate is OQ-KN8 for the `rcm` specification.

```kotlin
package hms.kernel.money

class Money private constructor(val amount: java.math.BigDecimal, val currency: java.util.Currency) : Comparable<Money> {
    val isZero: Boolean
    val signum: Int
    operator fun plus(other: Money): Money
    operator fun minus(other: Money): Money
    operator fun unaryMinus(): Money
    fun times(count: Long): Money
    fun times(factor: java.math.BigDecimal, rounding: java.math.RoundingMode): Money
    /** Exact: the result sums to this amount. */
    fun allocate(weights: List<java.math.BigDecimal>): List<Money>
    fun split(parts: Int): List<Money>
    /** Same currency only; a mismatch throws. */
    override fun compareTo(other: Money): Int
    companion object {
        /** Throws for a currency without minor units (programming error). */
        @JvmStatic fun zero(currency: java.util.Currency): Money
        /** Throws for a currency without minor units (programming error). */
        @JvmStatic fun ofMinorUnits(minorUnits: Long, currency: java.util.Currency): Money
        @JvmStatic fun ofExact(amount: java.math.BigDecimal, currency: java.util.Currency): MoneyResult
        @JvmStatic fun ofRounded(amount: java.math.BigDecimal, currency: java.util.Currency, rounding: java.math.RoundingMode): MoneyResult
    }
}

sealed interface MoneyResult {
    data class Valid(val money: Money) : MoneyResult
    data class Refused(val reason: MoneyRefusal) : MoneyResult
}

enum class MoneyRefusal { CURRENCY_HAS_NO_MINOR_UNITS, MORE_DECIMALS_THAN_THE_CURRENCY_HAS }

sealed interface CashRoundingPolicy {
    data object NotConfigured : CashRoundingPolicy
    class ToIncrement private constructor(val increment: Money, val rounding: java.math.RoundingMode) : CashRoundingPolicy
    /** A different currency from the policy's increment throws. */
    fun round(amount: Money): CashRoundingOutcome
    companion object {
        @JvmStatic fun toIncrement(increment: Money, rounding: java.math.RoundingMode): CashRoundingPolicyResult
    }
}

sealed interface CashRoundingPolicyResult {
    data class Valid(val policy: CashRoundingPolicy.ToIncrement) : CashRoundingPolicyResult
    data object IncrementNotPositive : CashRoundingPolicyResult
}

sealed interface CashRoundingOutcome {
    /** payable = amount + difference; payable is a whole multiple of the increment. */
    data class Rounded(val payable: Money, val difference: Money) : CashRoundingOutcome
    data object NotConfigured : CashRoundingOutcome
}

class ExchangeRate private constructor(
    val from: java.util.Currency,
    val to: java.util.Currency,
    val rate: java.math.BigDecimal,
    val effective: hms.kernel.time.ValidPeriod,
    val source: String,
    val recordedAt: hms.kernel.time.RecordedTime,
) {
    fun convert(amount: Money, rounding: java.math.RoundingMode): Money
    fun convertBack(amount: Money, rounding: java.math.RoundingMode): Money
    companion object {
        @JvmStatic fun of(
            from: java.util.Currency,
            to: java.util.Currency,
            rate: java.math.BigDecimal,
            effective: hms.kernel.time.ValidPeriod,
            source: String,
            recordedAt: hms.kernel.time.RecordedTime,
        ): ExchangeRateResult
    }
}

sealed interface ExchangeRateResult {
    data class Valid(val rate: ExchangeRate) : ExchangeRateResult
    data class Refused(val reason: ExchangeRateRefusal) : ExchangeRateResult
}

enum class ExchangeRateRefusal { SAME_CURRENCY, RATE_NOT_POSITIVE, SOURCE_MISSING, CURRENCY_HAS_NO_MINOR_UNITS }

class ExchangeRateTable private constructor(val rates: List<ExchangeRate>) {
    fun rateAt(from: java.util.Currency, to: java.util.Currency, at: java.time.Instant): RateLookup
    companion object {
        @JvmStatic fun of(rates: List<ExchangeRate>): ExchangeRateTableResult
    }
}

sealed interface RateLookup {
    data class Found(val rate: ExchangeRate) : RateLookup
    data object NoRateEffective : RateLookup
}

sealed interface ExchangeRateTableResult {
    data class Valid(val table: ExchangeRateTable) : ExchangeRateTableResult
    data class OverlappingPeriods(val from: java.util.Currency, val to: java.util.Currency) : ExchangeRateTableResult
}
```

## 10. `hms.kernel.quantity`

### 10.1 What SI-05 asks of this library

SI-05: "UCUM units; no unit-less doses. **Dose arithmetic only in the Dose Engine** (static analysis fails the build otherwise)." §6.2: "every quantity carries a UCUM unit in a platform `Quantity` type. Unit-less doses do not compile into a valid command." §6.8 #1: "custom detekt rule plus ArchUnit on `Dose`/`Quantity` operations; the allowed comparisons (a)-(e) go through one audited comparison API." The `reg-dose` Dose Engine is P2 and separate (§2.1 SI-05; §4.2 ADR-016; §10.4).

So [P]:
- `Quantity`, `DoseQuantity` and `DoseRate` have **no arithmetic operators at all**: no `plus`, `minus`, `times`, `div`, `rem`, `unaryMinus`, `inc`, `dec`, `rangeTo`, and none is `Comparable`.
- A magnitude is reachable only through `magnitude()` on each of the three types, and a `Quantity` is built from a `BigDecimal` only through `ofMagnitude()`. All carry the `@DoseMagnitudeAccess` opt-in marker. `ArchTest:dose-and-quantity-operations-only-in-reg-dose` allows calls to them only from `hms.reg.dose..`, `hms.kernel.quantity..` and `..infrastructure.persistence..` (persistence mapping) (section 11). This is the only way out of a `DoseQuantity` or `DoseRate`; revision 1's `internal` field is not an access control and is gone.
- A stored dose is rebuilt as `DoseQuantity.of(Quantity.ofMagnitude(...))` (or `DoseRate.of`), which validates again.
- Everything else uses `Quantity.parse` for input as entered, `display()` for (a), and `DoseComparisons` for (b) to (e).
- `equals` is representational (the same unit code and the same `BigDecimal`, scale included). It is not a clinical comparison: "0.5" and "0.50" are not `==`, which fails towards review, and clinical matching goes through `DoseComparisons` [P].

### 10.2 UCUM units

**WP-0.3 validates syntax only [P].** `UcumUnit.parse` checks a code against the UCUM case-sensitive grammar (terms joined by `.` and `/`, prefixed or plain atoms, integer exponents, the `10*n` style factors, parenthesised terms, `{...}` annotations). A code longer than 256 characters is refused (`TOO_LONG`) [P]. The grammar and its test vectors are coded from the UCUM specification text, which a human places in `docs/content-sources/` with its terms of use recorded (OQ-KN5); nothing is written from memory (§3.4 item 5; §3.5). Unknown atoms pass the syntax check.

**Semantic validation** (the atom table, dimensions, conversions, and SAC-11's "weights and doses are metric only") belongs to the terminology service (`PLT-CORE-05`, WP-1.1; §8.1 P6; ADR-015) behind the `UnitCatalogue` port. Its WP-0.3 binding `UnavailableUnitCatalogue` answers `Unavailable`. The kernel claims only that answer. The control that a command accepting a `DoseQuantity`, a `DoseRate` or a dosing weight must obtain `UnitCheck.Known`, and otherwise refuses or routes the item to an owned manual check, is the medications module's (Phase 1), with its own command-level test. "Metric only" is not covered by the kernel (KA-KN1).

Unit equality is exact, case-sensitive code equality [P]. Two codes that UCUM might treat as equivalent count as different units, so a comparison returns "unit mismatch", which sends the item to review (§2.1 (b): "a unit mismatch counts as a mismatch").

`hasUnitAtom` is true when the parsed code contains at least one unit atom, rather than only the unity `1`, numbers, factors such as `10*3`, or annotations [P].

### 10.3 `DoseQuantity` and `DoseRate`

A dose field in any command is a `DoseQuantity`, and a rate or a titration bound is a `DoseRate`, never a `Quantity` or a number. So a command without a valid unit cannot be built on any channel (§6.2; CTRL-0005-4). Both refuse [P]:
- a missing or blank unit;
- a unit that fails the syntax check;
- a unit with no unit atom (the unity `1`, a bare number or factor, an annotation only). This reads "unit-less" strictly. It is a tightening of SI-05 for the CSO to confirm, and it leaves open how counted doses such as tablets are expressed (DN-KN4).

`DoseQuantity` also refuses a magnitude that is zero or negative. `DoseRate` refuses a negative magnitude and accepts zero, so a titration order with a minimum of 0 and a paused rate of 0 stay inside the unit-mandatory types (§2.1 (d); a tightening [P], DN-KN4).

### 10.4 Input numbers and the ISMP clinical number format

**Input [P].** `Quantity.parse` accepts a plain decimal in ASCII digits with `.` as the decimal separator: optional `-` (refused later for doses, rates and fluid entries), digits, an optional `.` followed by digits. It refuses exponent notation, grouping separators, non-ASCII digits, a naked decimal point (`.5`), a trailing decimal point (`5.`), and more than 34 significant digits or more than 15 digits after the point (`TOO_MANY_DIGITS`) [P]. The scale as entered is kept. Eastern Arabic-Indic digit input is normalised, if at all, by the client before it reaches the kernel (DN-KN5).

**Display (§2.1 (a); §2.1 "ISMP display rules (no trailing zeros, no naked decimals)"; §6.5 "doses always with a leading zero and never a trailing zero"; SAC-50; R11 §15 item 8; CTRL-0005-17).** `ClinicalNumberFormat.format` shows a value unchanged in value:
- a leading zero before a decimal point (`0.5`, never `.5`);
- no trailing zeros after the decimal point (`5`, never `5.0`; `0.25`, never `0.250`). Zeros before the decimal point are never removed: `10` stays `10`, `100.0` becomes `100`, `10.50` becomes `10.5`. The formatter never uses `stripTrailingZeros` output directly, which gives `1E+1` for 10;
- no exponent notation;
- Western (ASCII) digits on every locale (§6.5 "Clinical numerals ... always uses Western digits"). The formatter builds text from `BigDecimal.toPlainString()` and never calls a locale-sensitive formatter, so a JVM whose default locale is `ar` or `ckb` gives the same text;
- `.` as the decimal separator and no grouping, until DN-KN5 is answered;
- the UCUM code as the unit, after one space. Display names for units are content for the terminology and localisation services (R08 §8 "UCUM units with local display conventions") (DN-KN5; KA-KN5).

The format never rounds: a value has exactly the digits it was entered with, minus trailing zeros after the point (CTRL-0005-6). The frontend `ClinicalNumber` component (§6.5) and this formatter share one table of test vectors, including `10`, `100`, `1000`, `0.05`, `10.50` and `100.0` [P].

### 10.5 `DoseComparisons`: the one audited comparison API

It implements exactly §2.1 (b) to (e) and nothing else. (a) is display, section 10.4. "Audited" is read as [P] (DN-KN2): (1) this object is the only code outside `reg-dose` that reads dose magnitudes for a decision, it is small, and safety code owners review every change to it; (2) every outcome carries a `ComparisonRecord` (the SI-05 clause, the API version, the inputs as entered and as displayed, the KB text verbatim, the threshold's key and provenance, the outcome) that the calling command stores in its journal row and audit event. The kernel itself writes nothing.

| §2.1 clause | Function | Rule |
|---|---|---|
| (b) "exact comparison of two independently entered quantities in the same UCUM unit; a unit mismatch counts as a mismatch and returns the order for review" | `matchIndependentEntries` | same unit code and numerically equal (`compareTo == 0`, so `0.5` matches `0.50`); otherwise `Mismatch(UNIT_MISMATCH or VALUE_MISMATCH)`; no tolerance |
| (c) "comparing a KB-returned ratio, flag or maximum (in exactly the ordered unit) with a governed threshold, as the ≥10× hard stop does. If the KB returns none of these, the screen shows 'dose check unavailable' and the order goes to pharmacist review" | `checkKbResult` | see the rules below; anything not decidable gives `DoseCheckUnavailable` |
| (d) "checking a nurse-entered rate against the ordered minimum and maximum in the same unit (titration)" | `checkRateAgainstOrderedRange` | all three are `DoseRate`; units exactly equal, else `UnitMismatch`; inclusive bounds [P]; minimum above maximum gives `InvalidOrderedRange` |
| (e) "fluid-volume balances (intake and output)" | `fluidBalance` | every entry, measured volume or medication volume, exactly in `balanceUnit` (the configured intake-and-output unit), else `UnitMismatch` with no partial sums; a negative entry gives `InvalidEntry`; exact `BigDecimal` sums, no rounding; net may be negative |

**Rules for (c) [P].** A KB result states its basis (`DoseBasis`, for example per dose or per day; the vocabulary belongs to the KB adapter and the medications specification, and the kernel compares codes exactly). The caller passes the ordered dose's basis.
1. A basis different from the ordered basis gives `DoseCheckUnavailable(KB_BASIS_MISMATCH)`.
2. **Ratio** is the ordered dose divided by the KB maximum on that basis, as a plain decimal multiple (1.5 means 150 %), never a percentage. The KB adapter's contract test proves it delivers that (medications specification). A ratio that is zero or negative gives `DoseCheckUnavailable(KB_RESULT_INVALID)`. Otherwise `ratio >= factor` is `AtOrAboveThreshold`, else `BelowThreshold`.
3. **Maximum** must be in exactly the ordered unit, else `DoseCheckUnavailable(KB_MAXIMUM_NOT_IN_THE_ORDERED_UNIT)`. Then `ordered >= factor × maximum`, computed exactly inside the API and never returned (DN-KN3), decides.
4. **Flag** carries the multiple of the KB maximum at which the KB raises it (`kbMultiple`, set by the KB adapter from the KB's documentation). A raised flag proves `dose >= kbMultiple × maximum`; a flag that is not raised proves `dose < kbMultiple × maximum`. So: raised and `kbMultiple >= factor` gives `AtOrAboveThreshold`; not raised and `kbMultiple <= factor` gives `BelowThreshold`; an unknown `kbMultiple` gives `DoseCheckUnavailable(KB_FLAG_THRESHOLD_UNKNOWN)`; every other case gives `DoseCheckUnavailable(KB_FLAG_NOT_COMPARABLE)`. A flag never becomes a Tier A hard stop that the governed threshold did not decide (SI-14), and a tighter governed factor is never ignored on the flag path (CTRL-0005-1).
5. `NoneReturned` gives `DoseCheckUnavailable(KB_RETURNED_NONE)`.

The governed threshold factor (for example the 10× and 100× of SI-05) is never a kernel constant. It is a vendor-locked, tighten-only setting owned by the medications and CDS configuration (CTRL-0005-1). It reaches the API only as a `GovernedThreshold` built by its `@SafetyParameterFactory` from a resolved setting (section 6.5): factor greater than zero, checked in `init`; a synthetic value is refused in TRAIN and PROD. Whether a factor below 1 is meaningful is part of DN-KN3. KB text is carried verbatim (SI-05 "with the KB output shown verbatim"; CTRL-0005-10).

The `reg-dose` Dose Engine (P2) uses the magnitude accessor, not this API.

```kotlin
package hms.kernel.quantity

class UcumUnit private constructor(val code: String) {
    val hasUnitAtom: Boolean
    // equals and hashCode: exact, case-sensitive code
    companion object {
        @JvmStatic fun parse(code: String): UcumParseResult
    }
}

sealed interface UcumParseResult {
    data class Valid(val unit: UcumUnit) : UcumParseResult
    data class Invalid(val error: UcumSyntaxError, val position: Int) : UcumParseResult
}

enum class UcumSyntaxError {
    EMPTY, ILLEGAL_CHARACTER, UNBALANCED_PARENTHESIS, UNBALANCED_ANNOTATION, MISSING_TERM, BAD_EXPONENT, DANGLING_OPERATOR, TOO_LONG,
}

/** Port: semantic UCUM validation by the terminology service (PLT-CORE-05, WP-1.1). */
fun interface UnitCatalogue {
    fun check(unit: UcumUnit): UnitCheck
}

sealed interface UnitCheck {
    data object Known : UnitCheck
    data object Unknown : UnitCheck
    /** A valid unit that is not metric (SAC-11: weights and doses are metric only). */
    data object NotMetric : UnitCheck
    /** The terminology service is not built or not reachable. */
    data object Unavailable : UnitCheck
}

/** Production binding until WP-1.1: always Unavailable. */
object UnavailableUnitCatalogue : UnitCatalogue

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
annotation class DoseMagnitudeAccess

/** A magnitude with a UCUM unit. No arithmetic operators; not Comparable. */
class Quantity private constructor(magnitude: java.math.BigDecimal, val unit: UcumUnit) {
    /** ArchUnit: only hms.reg.dose.., hms.kernel.quantity.., ..infrastructure.persistence.. */
    @DoseMagnitudeAccess
    fun magnitude(): java.math.BigDecimal
    /** The number as entered (scale kept) plus the unit code, for records. */
    fun asEntered(): String
    /** ISMP display, section 10.4. */
    fun display(): String
    // equals/hashCode: representational (unit code, BigDecimal with scale); toString() = display()
    companion object {
        @JvmStatic fun parse(entered: String, unit: UcumUnit): QuantityParseResult
        @DoseMagnitudeAccess @JvmStatic
        fun ofMagnitude(magnitude: java.math.BigDecimal, unit: UcumUnit): Quantity
    }
}

sealed interface QuantityParseResult {
    data class Valid(val quantity: Quantity) : QuantityParseResult
    data class Invalid(val error: NumberSyntaxError) : QuantityParseResult
}

enum class NumberSyntaxError {
    EMPTY, NOT_A_PLAIN_DECIMAL, NAKED_DECIMAL_POINT, TRAILING_DECIMAL_POINT, EXPONENT_NOT_ALLOWED, GROUPING_SEPARATOR, NON_ASCII_DIGIT, TOO_MANY_DIGITS,
}

/** A medication amount, concentration or volume. Cannot exist without a unit (§6.2). Magnitude > 0. */
class DoseQuantity private constructor(private val quantity: Quantity) {
    val unit: UcumUnit
    @DoseMagnitudeAccess fun magnitude(): java.math.BigDecimal
    fun asEntered(): String
    fun display(): String
    companion object {
        @JvmStatic fun of(quantity: Quantity): DoseQuantityResult
        @JvmStatic fun parse(entered: String, unitCode: String?): DoseQuantityResult
    }
}

/** A dose rate or titration bound. Cannot exist without a unit. Magnitude >= 0. */
class DoseRate private constructor(private val quantity: Quantity) {
    val unit: UcumUnit
    @DoseMagnitudeAccess fun magnitude(): java.math.BigDecimal
    fun asEntered(): String
    fun display(): String
    companion object {
        @JvmStatic fun of(quantity: Quantity): DoseRateResult
        @JvmStatic fun parse(entered: String, unitCode: String?): DoseRateResult
    }
}

sealed interface DoseQuantityResult {
    data class Valid(val dose: DoseQuantity) : DoseQuantityResult
    data class Refused(val reason: DoseQuantityRefusal) : DoseQuantityResult
}

sealed interface DoseRateResult {
    data class Valid(val rate: DoseRate) : DoseRateResult
    data class Refused(val reason: DoseQuantityRefusal) : DoseRateResult
}

enum class DoseQuantityRefusal { MISSING_UNIT, INVALID_UNIT_SYNTAX, UNIT_HAS_NO_UNIT_ATOM, INVALID_NUMBER, NOT_POSITIVE, NEGATIVE }

object ClinicalNumberFormat {
    fun format(quantity: Quantity): String
    fun format(dose: DoseQuantity): String
    fun format(rate: DoseRate): String
}

enum class Si05Clause { B, C, D, E }

class ComparisonRecord(
    val clause: Si05Clause,
    val apiVersion: Int,
    val inputsAsEntered: List<String>,   // what each person typed, scale kept
    val inputsDisplayed: List<String>,   // as ClinicalNumberFormat shows them
    val kbVerbatim: String?,             // (c) only
    val thresholdKey: String?,           // (c) only
    val thresholdSource: String?,        // (c) only: entry id or "definition-default"
    val thresholdProvenance: hms.kernel.time.ContentProvenance?, // (c) only
    val outcome: String,
)

/** The governed SI-05 threshold factor (section 6.5). */
class GovernedThreshold private constructor(
    val factor: java.math.BigDecimal, // > 0, checked in init
    val source: hms.kernel.time.ResolvedParameter<java.math.BigDecimal>,
) {
    companion object {
        @hms.kernel.time.SafetyParameterFactory @JvmStatic
        fun fromResolved(
            factor: hms.kernel.time.ResolvedParameter<java.math.BigDecimal>,
            environment: hms.kernel.time.EnvironmentClass,
        ): hms.kernel.time.SafetyParameterResult<GovernedThreshold>
    }
}

/** A KB dose basis code (vocabulary: the KB adapter and the medications specification); compared exactly. */
@JvmInline value class DoseBasis(val code: String)

sealed interface KbDoseResult {
    /** ordered dose ÷ KB maximum on [basis], as a plain decimal multiple, never a percentage. */
    data class Ratio(val ratio: java.math.BigDecimal, val basis: DoseBasis, val verbatim: String) : KbDoseResult
    /** A KB flag raised at [kbMultiple] × the KB maximum on [basis]; null = unknown. */
    data class Flag(val raised: Boolean, val kbMultiple: java.math.BigDecimal?, val basis: DoseBasis, val verbatim: String) : KbDoseResult
    data class Maximum(val maximum: DoseQuantity, val basis: DoseBasis, val verbatim: String) : KbDoseResult
    data object NoneReturned : KbDoseResult
}

sealed interface FluidEntry {
    data class Measured(val volume: Quantity) : FluidEntry
    data class Medication(val volume: DoseQuantity) : FluidEntry
}

enum class FluidSide { INTAKE, OUTPUT }

object DoseComparisons {
    const val API_VERSION: Int = 2

    /** §2.1 (b). */
    fun matchIndependentEntries(first: DoseQuantity, second: DoseQuantity): IndependentEntryMatch

    /** §2.1 (c). */
    fun checkKbResult(kb: KbDoseResult, ordered: DoseQuantity, orderedBasis: DoseBasis, threshold: GovernedThreshold): KbThresholdOutcome

    /** §2.1 (d). */
    fun checkRateAgainstOrderedRange(entered: DoseRate, orderedMinimum: DoseRate, orderedMaximum: DoseRate): RateRangeOutcome

    /** §2.1 (e). */
    fun fluidBalance(intake: List<FluidEntry>, output: List<FluidEntry>, balanceUnit: UcumUnit): FluidBalanceOutcome
}

sealed interface IndependentEntryMatch {
    val record: ComparisonRecord
    class Match(override val record: ComparisonRecord) : IndependentEntryMatch
    class Mismatch(val reason: MismatchReason, override val record: ComparisonRecord) : IndependentEntryMatch
}

enum class MismatchReason { UNIT_MISMATCH, VALUE_MISMATCH }

sealed interface KbThresholdOutcome {
    val record: ComparisonRecord
    /** The Tier A hard stop of CTRL-0005-10. */
    class AtOrAboveThreshold(override val record: ComparisonRecord) : KbThresholdOutcome
    class BelowThreshold(override val record: ComparisonRecord) : KbThresholdOutcome
    /** "dose check unavailable": the order goes to pharmacist review. */
    class DoseCheckUnavailable(val reason: UnavailableReason, override val record: ComparisonRecord) : KbThresholdOutcome
}

enum class UnavailableReason {
    KB_RETURNED_NONE, KB_MAXIMUM_NOT_IN_THE_ORDERED_UNIT, KB_BASIS_MISMATCH, KB_FLAG_THRESHOLD_UNKNOWN, KB_FLAG_NOT_COMPARABLE, KB_RESULT_INVALID,
}

sealed interface RateRangeOutcome {
    val record: ComparisonRecord
    class Within(override val record: ComparisonRecord) : RateRangeOutcome
    class BelowMinimum(override val record: ComparisonRecord) : RateRangeOutcome
    class AboveMaximum(override val record: ComparisonRecord) : RateRangeOutcome
    class UnitMismatch(override val record: ComparisonRecord) : RateRangeOutcome
    class InvalidOrderedRange(override val record: ComparisonRecord) : RateRangeOutcome
}

sealed interface FluidBalanceOutcome {
    val record: ComparisonRecord
    class Balance(val intake: Quantity, val output: Quantity, val net: Quantity, override val record: ComparisonRecord) :
        FluidBalanceOutcome
    class UnitMismatch(val unitsFound: Set<UcumUnit>, override val record: ComparisonRecord) : FluidBalanceOutcome
    class InvalidEntry(val side: FluidSide, val index: Int, override val record: ComparisonRecord) : FluidBalanceOutcome
}
```

## 11. Architecture rules and the §6.8 #1 fitness function

The existing rules of `HmsArchitectureRules`, as D7 extends them, apply to every kernel project: (a) to (d), the new (e) (`hms.orders`, `hms.medications`, `hms.results` and `hms.platform.tasks` never depend on `hms.platform.workflow`), and the widened `FRAMEWORK_PACKAGES` (adding `io.cloudevents..`, `io.debezium..`, `io.apicurio..`). The kernel has no migrations, so the reusable migration linter (§6.8 #2, D7) does not run here. This spec adds the following to `backend/platform/arch-rules`, each with a violating and a compliant fixture, as the existing rules have (`backend/README.md`, "Fitness functions") [P]. Every rule that restricts a factory matches the static and the `Companion` method (section 3).

| Rule (test name) | What it checks | Source |
|---|---|---|
| `ArchTest:dose-and-quantity-operations-only-in-reg-dose` | No class outside `hms.reg.dose..`, `hms.kernel.quantity..` and `..infrastructure.persistence..` calls `Quantity.magnitude()`, `Quantity.ofMagnitude(...)`, `DoseQuantity.magnitude()` or `DoseRate.magnitude()` | §6.8 #1; CTRL-0005-5 |
| `ArchTest:no-now-in-domain` (extended) | Rule (d) also covers `hms.kernel.ids..`, `hms.kernel.time..`, `hms.kernel.context..`, `hms.kernel.money..`, `hms.kernel.quantity..` and the pure model of `hms.kernel.journal` | §6.2; CTRL-0010-3 |
| `ArchTest:no-system-default-zone-or-locale` | No call to `ZoneId.systemDefault()`, `TimeZone.getDefault()`, `Locale.getDefault()`, nor to the overloads that use the default implicitly (`String.format` without a `Locale`, Java `String.toUpperCase()`/`toLowerCase()` without a `Locale`, `NumberFormat.get*Instance()` without a `Locale`, `DecimalFormat(String)`, `DateTimeFormatter.ofPattern(String)` without a `Locale`, `java.util.Formatter()` without a `Locale`) in `..domain..` and in the kernel libraries | §4.1; §6.5; §8.1 P10 [P] |
| `ArchTest:persistence-only-factories` | `@PersistenceOnly` functions (`RecordedTime.restore`) are called only from `..infrastructure.persistence..` (every module's own persistence adapters, for example the tenancy, config, tasks and workflow `recorded_at` columns), `hms.kernel.journal.infrastructure..` and `hms.kernel.journal.inmemory..`. The violating fixtures include an inbound adapter in `..infrastructure.inbound..` and a class in `..infrastructure..` outside `..persistence..` | SI-10; CTRL-0010-3; D7 [P] |
| `ArchTest:safety-parameter-factories-only-in-resolvers` | `@SafetyParameterFactory` functions are called only from the `SAFETY_PARAMETER_RESOLVERS` allow-list and test sources (section 6.5) | D11; CTRL-0010-1; CTRL-0005-1 [P] |
| `ArchTest:actor-kinds-only-from-allowed-packages` | `@ActorKindRestricted` functions (non-user `ActorRef` kinds, `CaptureChannel.OfflineQueued.of`) are called only from their allow-lists and test sources (section 7.2) | D10; CTRL-0010-4 [P] |
| `ArchTest:back-entry-authority-only-from-back-entry-tooling` | `@BackEntryToolingOnly` and `@EpisodeRegistryOnly` functions are called only from their allow-lists (empty in WP-0.3) and test sources | D10; CTRL-0010-5 [P] |
| `ArchTest:production-never-binds-test-adapters` | No main class outside `..testing..` and `..inmemory..` packages depends on `hms.kernel.testing..` or on any `..testing..` or `..inmemory..` package, except `app-hms`'s dev and test wiring package named by the `app-hms` specification | D8; SI-03 [P] |
| `ArchTest:kernel-libraries-framework-free` | The widened framework list applies to all of `hms.kernel.ids`, `hms.kernel.time`, `hms.kernel.context`, `hms.kernel.money` and `hms.kernel.quantity` | §6.1; D7 [P] |
| `UnitTest:quantity-has-no-operators` (reflection) | `Quantity`, `DoseQuantity` and `DoseRate` declare no operator functions and do not implement `Comparable` | SI-05; §6.8 #1 |
| `UnitTest:money-api-has-no-floating-point` (reflection) | No public member of `hms.kernel.money` takes or returns `Double`, `Float` or their boxed forms | §6.2 |
| `UnitTest:app-hms-production-clock-is-system-utc` (in `app-hms`) | The production wiring provides `Clock.systemUTC()` and no other `Clock` | D8; CTRL-0003-5 [P] |

**The detekt half.** A custom detekt rule set holds three rules [P]:
- `NoDoseArithmetic` (`StaticAnalysis:no-dose-arithmetic-outside-reg-dose`) encodes exactly the §2.1 definition ("multiplying or dividing by weight, BSA, concentration or time; converting a dose or rate between units; summing or rounding doses") for all code outside `hms.reg.dose..` and outside the mock-KB test fixtures ("The mock KB's arithmetic lives only in test fixtures", §2.1). It flags at least: arithmetic operators and `BigDecimal` arithmetic or rounding methods applied to a value obtained from a `magnitude()` accessor; parsing a `display()` or `asEntered()` result back into a number; any arithmetic in `..infrastructure.persistence..` on a magnitude beyond mapping it to or from a column.
- `NoClinicalTimeFromRecordedTime` (`StaticAnalysis:no-clinical-time-from-recorded-time`) flags a `ClinicalTime` built from a value derived from `RecordedTime` in the same function.
- `NoLiteralChangeReason` (`StaticAnalysis:no-literal-change-reason`) flags a string literal passed to `ChangeReason.entered` outside test sources.

Without type resolution a rule can only approximate this, so the slice decides whether detekt runs with the classpath. Today the `detekt` task passes no classpath to detekt-cli 1.23.8 (`backend/build-logic/src/main/kotlin/hms.quality-conventions.gradle.kts`), and detekt's embedded Kotlin 2.0.21 compiler is older than the project's Kotlin, so type resolution has to be proven on this code before it is relied on (`backend/README.md`, "Quality gates"). A suppression needs a reason and a safety code owner [P]. If the rules are not built in WP-0.3, KA-KN2 records it; `NoDoseArithmetic` must exist before the medications module (§9.10 acceptance 6; `backend/README.md`).

**What ArchUnit cannot see** (KA-KN3): arithmetic on a magnitude inside an allowed persistence package; laundering through strings (`display()` parsed back to a number); a `ClinicalTime` built from `RecordedTime.instant`; and package allow-lists are a convention until the Trust Plane SDK binds the context to the authenticated principal (KA-KN7). The detekt rules and code-owner review cover the first three.

## 12. Configuration, permissions and audit

### 12.1 Configuration the kernel types are built from

The kernel reads no configuration itself. `platform-tenancy` defines the settings (§6.6; D2) and the modules that build these values read them through `hms.platform.tenancy.api` (D5). Keys marked [P] are proposed names. `kri.*` names are the Kurdistan pack's item names from `docs/program/ASSUMPTIONS.md`, never setting keys (D3).

| Key | Builds | Levels (§6.6 chain) | Lock | Value shipped | Source |
|---|---|---|---|---|---|
| facility zone (not a setting: the `FACILITY.zone` node attribute of `platform-tenancy`, required at creation) | `ClinicalTime.atZone`, `resolveLocal`, `BusinessCalendar.zone` | FACILITY node | — | none in code; §4.1's "default `Asia/Baghdad`, configurable per tenant" is honoured by a pack or tenant default that pre-fills the attribute at creation (OQ-KN15) | §4.1; §8.1 P10 (facility time zone); `platform-tenancy` specification |
| `calendar.weekend-days` | `BusinessCalendar.weekend` | COUNTRY_PACK, TENANT (a facility override is OQ-KN9) | not lockable (`platform-tenancy` §5.10: a pack lock would stop tenant additions) | none (configuration required); the Kurdistan pack supplies `[FRIDAY, SATURDAY]` ([L] L-20, item `kri.calendar.weekend`) | D3; L-20; §7 item 1; §11.7 |
| `calendar.holidays` | `BusinessCalendar.holidays` | COUNTRY_PACK, TENANT (OQ-KN9) | not lockable | none (configuration required); the Kurdistan pack supplies Newroz on 21 March and the yearly dates of the Eids and others ([L] L-20, item `kri.calendar.holidays`) | D3; L-20 |
| `platform.time.entry.<timing-class>.contemporaneous-tolerance` [P] | `EntryTimePolicy` | VENDOR_FOUNDATION and below; never USER | vendor-locked, tighten-only (direction: DN-KN1) | none: definitions registered `configurationRequired = RequiredBecause("CTRL-0010-1")`, `GOVERNED`, no vendor default; no value until DN-KN1 | SI-10; CTRL-0010-1 |
| `platform.time.entry.<timing-class>.future-tolerance` [P] | `EntryTimePolicy` | as above | as above | none: DN-KN1 | SI-10; CTRL-0010-1 |
| `platform.time.entry.<timing-class>.interface-lateness-tolerance` [P] | `EntryTimePolicy` | as above | as above | none: DN-KN1 | SI-10; CTRL-0010-1 |
| `platform.time.entry.<timing-class>.offline-capture-tolerance` [P] | `EntryTimePolicy` | as above | as above | none: DN-KN1, DN-KN6 | SI-10; SI-15 |
| `rcm` to name (generic key); `kri.*` = pack item `kri.rcm.cash-rounding.iqd` [L] | `CashRoundingPolicy` increment for IQD | TENANT | none | none: configuration required ("IQD 250" is an example) | L-14; K §8; §9.21 |
| `rcm` to name (generic key); `kri.*` = pack item `kri.rcm.cash-rounding.mode` [P] | `CashRoundingPolicy` rounding mode | TENANT | none | none: configuration required | OQ-KN7 |
| `rcm` to name (generic key); `kri.*` = pack item `kri.rcm.exchange-rates` [L] | `ExchangeRateTable` (an effective-dated table in `rcm`, not a single setting) | TENANT | none | none: configuration required (≈IQD 1,300 is a planning figure only) | L-14; §9.21 |

The `rcm` rows show their ASSUMPTIONS.md pack item names; the `rcm` specification names the generic keys under D3's rule.

Not kernel settings, but consumed through kernel types: the SI-05 hard-stop factors (`GovernedThreshold`, owned by medications and CDS configuration, CTRL-0005-1) and the intake-and-output balance unit (`fluidBalance`, owned by nursing).

### 12.2 Permissions and audit

The kernel defines no permission and writes no audit; the Trust Plane SDK arrives in WP-0.4 (§21). It names what the command layer must do with a timing classification (section 6.2):
- `BackDated` needs a policy decision for the back-dating privilege, verified by the journal through its `BackDatingAuthorization` port; in WP-0.3 the production binding refuses every back-dated append (D10). Proposed permission name [P]: `clinical-time.back-date`, scoped per timing class. ADT back-dating needs supervisor rights (CTRL-0010-4, §9.12).
- Back-entry is done only through the back-entry tooling (`TRU-BCP-03`), which checks its own permission (proposed [P]: `clinical-time.back-entry`) before it issues a `BackEntryAuthority`.
- Migration runs only under the migration loader identity, with its own permission (proposed [P]: `migration.load`).
- Every accepted entry whose code is labelled is audited with actor, reason where required, clinical time with offset, its source, recorded time and the code (CTRL-0010-4, CTRL-0010-5; R07 §5.4 AU-1).
- Every `DoseComparisons` outcome's `ComparisonRecord` is stored with the command's journal row and audit event (section 10.5).

Until WP-0.4, modules call these through their own ports (for example `platform-workflow`'s `WorkflowAuditPort` pattern) and the journal's `BackDatingAuthorization`; no kernel port is needed.

## 13. Events

None. The kernel libraries publish no domain events. Event envelopes, naming and the CloudEvents id rules are in the `hms.kernel.events` specification. They use `UuidV7` for event ids. The envelope's `entrytiming` extension carries an `EntryTimingCode` name, and `validfrom`/`validto` carry the `ValidTime` bounds with their offsets. The CloudEvents `time` attribute is an `Instant` at the wire boundary, taken from the journal row's `RecordedTime.instant`; inside the platform the journal's `JournalEntry.recordedAt` is a `RecordedTime`, rebuilt with `restore` in `hms.kernel.journal.infrastructure` [P].

## 14. Persistence mapping

The kernel libraries have no schema. Each module's infrastructure maps them as follows [P], starting with the journal adapter (§6.4):

| Type | PostgreSQL | Note |
|---|---|---|
| UUIDv7, typed ids | `uuid` | made by the application, never by `uuidv7()` |
| `RecordedTime` | `timestamptz` (for example `recorded_at`) | microseconds |
| `ClinicalTime` | `timestamptz` plus `integer` offset seconds (for example `valid_at`, `valid_at_offset_s`) | §5.3 "UTC with the original offset"; offsets are whole minutes |
| `ValidTime` | `valid_from` and `valid_from_offset_s`, `valid_to` and `valid_to_offset_s` (null when open), and the derived `valid_period tstzrange '[)'` | §6.4 |
| `ValidPeriod` | `tstzrange` with `'[)'` bounds (`valid_period`) | §6.4 |
| `EntryTimingCode` | `text` with a `CHECK` equal to the enum's names | kept equal by the journal's schema test |
| `ClinicalTimeSource` | `text` with a `CHECK` equal to the enum's names | stored with each journal row |
| `Money` | `numeric` plus `char(3)` ISO 4217 code | never the PostgreSQL `money` type, never floating point |
| `Quantity`, `DoseQuantity`, `DoseRate` | `numeric` (scale as entered) plus `text` UCUM code | the mapping code in `..infrastructure.persistence..` is the only infrastructure use of the magnitude accessors and `ofMagnitude()` |

## 15. Hazards and controls this library implements

Kernel tests verify only the kernel's **part** of a control. They carry their own `kernel-` names, so CI never counts a kernel test as the control's `planned_verification` (`docs/safety/README.md`, "Test names"; §22.1 item 6). The integrator lists them in the control's notes as parts; a control stays `planned` until its own named verification passes.

| Hazard and control | What the kernel provides (its part only) | Kernel-part tests | Rest of the control |
|---|---|---|---|
| HAZ-0005 CTRL-0005-4 (UCUM unit on every quantity; no unit-less dose on any channel) | `Quantity` needs a `UcumUnit`; `DoseQuantity` and `DoseRate` refuse a missing unit, unity and unit-less forms; dose fields are `DoseQuantity` or `DoseRate`. Metric-only and atom validity are not covered (KA-KN1) | `UnitTest:quantity-requires-ucum-unit`; `PropertyTest:kernel-dose-quantity-refuses-unitless` | `PropertyTest:SI-05-no-unitless-dose-on-any-channel` and the `UnitCatalogue` check, medications (Phase 1) |
| HAZ-0005 CTRL-0005-5 (static analysis plus ArchUnit; one audited comparison API) | no operators; restricted magnitude accessors; `DoseComparisons` for (b) to (e); the `NoDoseArithmetic` rule | `ArchTest:dose-and-quantity-operations-only-in-reg-dose`; `UnitTest:quantity-has-no-operators`; `UnitTest:kernel-comparison-api-b-to-e`; `StaticAnalysis:no-dose-arithmetic-outside-reg-dose` (KA-KN2 if not built) | code-owner review (KA-KN3) |
| HAZ-0005 CTRL-0005-6 (never round, convert or recalculate before `reg-dose`) | the parser keeps what was entered; the formatter never rounds; no conversion in the kernel | `PropertyTest:kernel-display-never-changes-value` | `PropertyTest:SI-05-no-rounding-or-recalculation-before-dose-engine` |
| HAZ-0005 CTRL-0005-9 (exact comparison of independently entered doses) | `DoseComparisons.matchIndependentEntries` | `PropertyTest:kernel-independent-entry-match-exact` | the double-check workflows (medications) |
| HAZ-0005 CTRL-0005-10, CTRL-0005-7 (KB ≥10× Tier A hard stop or "dose check unavailable") | `DoseComparisons.checkKbResult` with basis checks and the flag rule (section 10.5) | `UnitTest:kernel-kb-check-returns-dose-check-unavailable`; `PropertyTest:kernel-kb-threshold-comparison` | routing to pharmacist review and the hard stop itself (medications); the KB adapter's contract test |
| HAZ-0005 CTRL-0005-1 (threshold vendor-locked, tighten-only) | `GovernedThreshold` only from a resolved setting; synthetic refused in TRAIN and PROD | `ArchTest:safety-parameter-factories-only-in-resolvers`; `UnitTest:synthetic-safety-parameters-refused-in-train-and-prod` | the setting definition and its chain test (medications, CDS; tenancy) |
| HAZ-0005 CTRL-0005-17 (ISMP display) | numbers only: `ClinicalNumberFormat`. Unit display names, tall-man lettering, prints and locales are not the kernel's (KA-KN5) | `UnitTest:kernel-clinical-number-display-rules` | `UnitTest:clinical-number-ismp-display-rules` and the frontend `ClinicalNumber` |
| HAZ-0010 CTRL-0010-3 (separate time fields; injected clock) | `RecordedTime` only from a `Clock`; no kernel path from recorded to clinical time; `AtRecording` only where declared, and stored as such; restricted `restore` | `ArchTest:no-now-in-domain` (extended); `ArchTest:persistence-only-factories`; `PropertyTest:kernel-at-recording-only-where-declared`; `StaticAnalysis:no-clinical-time-from-recorded-time` | `PropertyTest:SI-10-clinical-time-distinct-from-system-time` (journal and modules) |
| HAZ-0010 CTRL-0010-4 (back-dating privileged and audited) | the mode is derived; `BackDated` carries its four requirements | `PropertyTest:kernel-entry-mode-derived-from-context`; `PropertyTest:kernel-entry-timing-back-dated-requirements`; `ArchTest:actor-kinds-only-from-allowed-packages` | the journal's `BackDatingAuthorization` and `PropertyTest:SI-10-back-dating-is-privileged-and-audited` |
| HAZ-0010 CTRL-0010-5 (back-entry keeps clinical time and is labelled) | `BackEntry` keeps the given time and carries `BACK_ENTRY`; the episode and authority come only from the registry and tooling | `PropertyTest:kernel-entry-timing-back-entry-keeps-clinical-time`; `ArchTest:back-entry-authority-only-from-back-entry-tooling` | `PropertyTest:SI-10-back-entry-keeps-clinical-time-and-label` (journal; `TRU-BCP-03`) |
| HAZ-0010 CTRL-0010-1 (vendor-locked, tighten-only) | tolerances only through `EntryTimePolicy` from resolved settings; no policy, no clinical entry | `UnitTest:kernel-entry-timing-refused-without-policy`; `ArchTest:safety-parameter-factories-only-in-resolvers`; `PropertyTest:entry-time-tolerance-strictness-direction` (when definitions exist) | `PropertyTest:config-chain-vendor-lock-SI-10` (`platform-tenancy`), which has nothing to test until DN-KN1 is answered |
| HAZ-0010 CTRL-0010-2 (clock skew, out-of-order, back-entry) | `TestClock` with `setTo` backwards | `UnitTest:test-clock-controllable` | `PropertyTest:SI-10-*` (WP-0.5 and the journal) |
| HAZ-0003 CTRL-0003-5 (`TaskOrphaned` within 5 minutes, simulated clock) | `TestClock`; `Instant` plus `Duration` elapsed time; `TestClock` never in production | `ArchTest:production-never-binds-test-adapters`; `UnitTest:app-hms-production-clock-is-system-utc` | `PropertyTest:SI-03-orphan-alarm-within-5-minutes (simulated clock)` with a backward clock step (`platform-tasks`) |

When a control's kernel part is verified, the integrator adds the kernel source files to its `implemented_in` and records the kernel tests as parts.

**Proposed hazard causes (to be numbered), for existing hazards:**
- **HC-KN1 (HAZ-0010):** the entry mode or the downtime episode is asserted by the caller, so a back-dated entry escapes the privilege. Controls: derived mode, restricted actor kinds, back-entry authority and episode factories (sections 6.2, 7.2).
- **HC-KN2 (HAZ-0010):** an offline-captured act is stamped with its sync time, so the next dose is timed wrongly. Controls: no clinical time from recorded time; `AtRecording` refused offline; offline capture needs the device capture time; `ClinicalTimeSource` stored.
- **HC-KN3 (HAZ-0010, HAZ-0003):** a device or interface clock ahead of the server makes an observation be refused as in the future and lost. Controls: refused channel entries go to an owned, alarmed queue (section 6.2).
- **HC-KN4 (HAZ-0003):** the whole cell's clock steps backwards (an NTP step or GPS reacquisition), so every pending safety timer is delayed by the step. Controls (`platform-tasks` specification §4.5): detect a backward step against the last observed instant and the journal's `RecordedTimeRegression`, alarm, and evaluate due timers as if no time was lost (`UnitTest:backward-clock-step-detected-and-alarmed`); `PropertyTest:SI-03-orphan-alarm-within-5-minutes` gains a `TestClock.setTo`-backwards case (KA-KN6).
- **HC-KN5 (HAZ-0005):** a KB result on a different basis (per dose against per day), a ratio in another form, or a flag set at another multiple than the governed factor hides a ≥10× dose. Controls: section 10.5 rules; the KB adapter's contract test.
- **HC-KN6 (HAZ-0005, HAZ-0010):** a safety parameter is hand-made in code or synthetic content reaches TRAIN or PROD. Controls: section 6.5.

**Tightenings (to be recorded in `docs/safety/README.md` and the controls' notes; the CSO confirms or removes them) [P]:**
- CTRL-0005-4: a dose unit must contain a unit atom; a dose magnitude is positive; a rate is non-negative (DN-KN4).
- CTRL-0005-10: the KB basis must match the ordered basis; a ratio is a decimal multiple; a flag decides only through its declared multiple; everything else is "dose check unavailable" (DN-KN3).
- CTRL-0010-3: no clinical time from recorded time; `AtRecording` only for declared event types and never offline or from a device, interface, back-entry or migration.
- CTRL-0010-4: the entry mode is derived from the authenticated context; a reason is never defaulted.
- CTRL-0010-5: a back-entry needs an episode from the registry and falls inside its window; `LATE_ARRIVAL`, `OFFLINE_CAPTURE` and `MIGRATED` are labelled too (DN-KN6).
- CTRL-0010-1: the tolerance definitions are `configurationRequired` with no value before DN-KN1; every entry that needs a policy is refused until then.

The continuous-time reading for safety timers is `platform-tasks`' proposed tightening (its CSO decision), not this spec's.

## 16. What "fails closed" means here (D16)

Each claim names its mechanism and the test that proves it. A placeholder is never described as a control.

| Claim | Mechanism | Test |
|---|---|---|
| An entry that needs a timing policy is refused while no policy exists | `EntryTimeClassifier` returns `Refused(TIMING_POLICY_NOT_CONFIGURED)` for `NotConfigured`, `Unavailable` and `NotLookedUp`; no tolerance has a value before DN-KN1, so the resolver answers `NotConfigured` | `UnitTest:kernel-entry-timing-refused-without-policy`; `UnitTest:clinical-append-refused-without-entry-time-policy` (journal specification); `UnitTest:entry-time-policy-resolver-answers-not-configured` (tenancy specification) |
| No back-entry in WP-0.3 production | the `BACK_ENTRY_TOOLING` and episode-registry allow-lists are empty, so no `BackEntryAuthority` or `BackEntryEpisode` exists; without one the mode is never `BACK_ENTRY` | `ArchTest:back-entry-authority-only-from-back-entry-tooling`; `PropertyTest:kernel-entry-mode-derived-from-context` |
| No migration, device, interface or offline-capture mode in WP-0.3 production | their allow-lists hold only test sources | `ArchTest:actor-kinds-only-from-allowed-packages` |
| No back-dated append in WP-0.3 production | the journal's `BackDatingAuthorization` production binding refuses every request (D10); the kernel only names the requirement | `UnitTest:back-dated-append-refused-by-production-authorization` (journal specification) |
| No synthetic safety parameter in TRAIN or PROD | the factories refuse it | `UnitTest:synthetic-safety-parameters-refused-in-train-and-prod` |
| No hand-made safety parameter | private constructors; factory allow-list | `ArchTest:safety-parameter-factories-only-in-resolvers`; `UnitTest:safety-parameters-validated` |
| `TestClock` never runs production | ArchUnit on main classes; production wiring check | `ArchTest:production-never-binds-test-adapters`; `UnitTest:app-hms-production-clock-is-system-utc` |
| A KB result that cannot be compared goes to pharmacist review | `DoseCheckUnavailable` with its reason; the routing is medications' | `UnitTest:kernel-kb-check-returns-dose-check-unavailable` |
| Calendar gaps never make a deadline later | unknown days count as business days; uncovered years reported | `UnitTest:business-calendar-uncovered-years-reported` |

Not claimed by the kernel: the `UnitCatalogue` binding only answers `Unavailable` (`UnitTest:unavailable-unit-catalogue-answers-unavailable`); refusing on that answer is the medications module's control. `CashRoundingPolicy.NotConfigured` is a value; refusing on it is `rcm`'s control.

## 17. Tests

All names follow the `<Kind>:<name>` convention (`docs/safety/README.md`, "Test names"). Fast tier unless stated; property tests use `PropertyTestBudget.sequences()` (1,000 fast, 10⁶ nightly). Synthetic configuration values in tests are marked `ContentProvenance.SYNTHETIC` (§19.4). No kernel test name falls in a control's `PropertyTest:SI-nn-*` family.

| Test | Library | Checks |
|---|---|---|
| `UnitTest:uuidv7-layout-rfc9562` | ids | version nibble 7, variant `10`, timestamp bits equal the clock's milliseconds, canonical lower-case text |
| `PropertyTest:uuidv7-monotonic-and-unique` | ids | for random call sequences with the clock advancing by random steps (including many ids in one millisecond and counter overflow), and from several threads sharing one generator with a `SplittableRandom`, every id is strictly greater than the last under `UuidV7.compare` per thread, and all are distinct |
| `PropertyTest:uuidv7-monotonic-when-clock-goes-backwards` | ids | with `TestClock.setTo` moving back by random amounts, ids stay strictly increasing |
| `PropertyTest:uuidv7-compare-matches-byte-order` | ids | `UuidV7.compare` equals unsigned byte-wise comparison |
| `UnitTest:uuidv7-parse-rejects-non-v7` | ids | malformed text, short groups that `UUID.fromString` would accept, other versions, other variants |
| `UnitTest:uuidv7-clock-out-of-range-throws` | ids | a clock before 1970 or beyond 48 bits throws `IllegalStateException` |
| `UnitTest:kernel-typed-ids-require-v7` | ids | `TenantId`, `FacilityId`, `PatientId`, `UserId` refuse a non-v7 UUID |
| `PropertyTest:recorded-and-clinical-time-round-trip-microseconds` | time | values survive truncation; `restore(instant)` equals `now(clock)` at that instant |
| `UnitTest:clinical-time-offset-round-trip` | time | a `ClinicalTime` and a `ValidTime` keep their offsets through `toOffsetDateTime`, parse and the persistence mapping fixture |
| `UnitTest:clinical-time-parse-strict` | time | offset required; offsets with seconds refused; malformed text refused |
| `UnitTest:clinical-time-dst-gap-and-overlap-not-guessed` | time | `resolveLocal` returns `InGap` and `Ambiguous` on a zone with DST transitions in the JDK data (a test fixture zone, not a claim about any Kurdistan rule) and `Resolved` elsewhere |
| `PropertyTest:valid-period-half-open` | time | `contains(start)`, not `contains(end)`; `overlaps` symmetric; adjacent periods do not overlap; empty and reversed refused, after truncation |
| `PropertyTest:valid-time-keeps-offsets-and-maps-to-period` | time | `ValidTime.toValidPeriod()` keeps the instants; empty and reversed refused |
| `UnitTest:as-of-query-coordinates` | time | an `AsOf` is built from any `Instant` without a persistence-only factory; `AsOf.knownAt(validAt, recorded)` equals the recorded instant |
| `PropertyTest:kernel-entry-timing-table` | time | every row of the section 6.2 table, first match wins, inclusive boundaries |
| `PropertyTest:kernel-entry-timing-back-dated-requirements` | time | every `USER` entry later than the tolerance is `BackDated` with its four requirements |
| `PropertyTest:kernel-entry-timing-back-entry-keeps-clinical-time` | time | `BackEntry` keeps the given clinical time; refused without an episode or outside its window |
| `PropertyTest:kernel-entry-timing-future-refused` | time | every mode refuses a clinical start or end beyond its future bound |
| `PropertyTest:kernel-entry-timing-interface-late-arrival` | time | `DEVICE` and `INTERFACE` within the lateness tolerance are `Contemporaneous` with the matching source, beyond it `LateArrival` |
| `PropertyTest:kernel-entry-timing-migration-keeps-original-times` | time | `MIGRATION` keeps the given times and is `Migrated` for any past lag |
| `PropertyTest:kernel-entry-timing-offline-capture` | time | `OFFLINE_CAPTURE` within its tolerance is `OfflineCapture`, beyond it `Refused(OFFLINE_CAPTURE_TOO_LATE)` |
| `PropertyTest:kernel-at-recording-only-where-declared` | time | `AtRecording` is refused for `CLINICAL_CAPTURED` and for `OFFLINE_CAPTURE`, `BACK_ENTRY`, `DEVICE`, `INTERFACE` and `MIGRATION`; `SYSTEM` with a given clinical time is refused; an accepted `AtRecording` has start equal to the recorded instant and source `AT_RECORDING` |
| `UnitTest:kernel-entry-timing-requirements` | time | the requirement set of every accepted result is the section 6.2 table's |
| `UnitTest:kernel-entry-timing-refused-without-policy` | time | `NotConfigured`, `Unavailable` and `NotLookedUp` give `TIMING_POLICY_NOT_CONFIGURED` wherever a policy is needed; `needsPolicy` agrees with the table |
| `UnitTest:kernel-entry-timing-codes-closed` | time | `EntryTimingCode` has exactly the seven values; the journal's schema test and the envelope's value list use this list |
| `PropertyTest:entry-time-tolerance-strictness-direction` | time (with tenancy) | each tolerance definition's `Strictness` agrees with "smaller is stricter" on synthetic pairs; runs when definitions exist (DN-KN1) |
| `UnitTest:synthetic-safety-parameters-refused-in-train-and-prod` | time, quantity | `EntryTimePolicy.fromResolved` and `GovernedThreshold.fromResolved` refuse synthetic values for `TRAIN` and `PROD` and accept them for `BUILD`, `TEST` and `PLAY` |
| `UnitTest:safety-parameters-validated` | time, quantity | negative durations, a factor of zero or less, and wrong keys are refused; reflective construction with invalid values throws |
| `PropertyTest:business-calendar-monotonic` | time | `plusBusinessDays` strictly increasing in `days` (≥ 1), non-decreasing in the start date, result a business day; `businessDaysBetween` agrees with it; negative days throw |
| `PropertyTest:business-days-at-local-time` | time | the result's local time equals the start's except in a DST gap (the transition instant) or overlap (the earlier offset), checked on a fixture zone; a start on a non-business day counts from its date; `days = 0` returns the start |
| `UnitTest:business-calendar-uncovered-years-reported` | time | answers that touch an unconfirmed year list it; `of` refuses a holiday dated outside `confirmedYears` (`HolidayOutsideConfirmedYears`), including a synthetic 21 March entry in an unconfirmed year |
| `PropertyTest:kernel-entry-mode-derived-from-context` | context | for every combination of actor kind, capture channel and back-entry authority, the mode is the section 7.3 table's; a `USER` actor without the allowed objects never gets `LateArrival`, `Migrated`, `BackEntry` or `OfflineCapture`; invalid combinations are refused |
| `UnitTest:command-context-invariants` | context | every `CommandContextRefusal`; idempotency key, purpose-of-use and system-process formats |
| `UnitTest:in-memory-transaction-runner-hooks` | context | `InMemoryTransactionRunner`: before-commit checks run before commit and a throwing check rolls back; completion hooks get `committed` true or false; a rollback-only transaction whose block returns `Commit` rolls back and throws |
| `UnitTest:change-reason-never-blank-never-defaulted` | context | null, blank and over-long reasons refused; no default exists (reflection: no constant or default parameter of type `ChangeReason`) |
| `UnitTest:test-clock-controllable` | testing | `advanceBy`, `setTo` backwards, `withZone` views share time, thread safety |
| `UnitTest:money-minor-units-from-iso4217` | money | scale from the JDK for IQD and USD; currency without minor units refused or thrown as section 9 says; `ofExact` pads a shorter scale |
| `UnitTest:money-api-has-no-floating-point` | money | section 11 |
| `PropertyTest:money-arithmetic-exact` | money | `plus` and `minus` are exact and associative; `times(count)` equals repeated `plus` |
| `PropertyTest:money-allocation-sums-exactly` | money | for random amounts (negative included) and weights, shares sum to the amount, each share differs from its exact proportion by less than one minor unit, the result is deterministic |
| `PropertyTest:cash-rounding-multiple-of-increment` | money | the payable amount is a whole multiple of the increment and `payable = amount + difference`; `NotConfigured` returns `NotConfigured`; a non-positive increment is refused; another currency throws |
| `UnitTest:exchange-rate-effective-at-instant` | money | `rateAt` picks the period containing the instant (half-open); no rate gives `NoRateEffective`; overlaps refused; conversion uses the explicit rounding mode and the target currency's scale |
| `UnitTest:ucum-syntax-accepts-and-rejects` | quantity | valid and invalid vectors taken from the UCUM specification in `docs/content-sources/` (OQ-KN5); the length limit |
| `UnitTest:quantity-requires-ucum-unit` | quantity | no factory makes a `Quantity` without a parsed `UcumUnit` |
| `PropertyTest:kernel-dose-quantity-refuses-unitless` | quantity | for random inputs, `DoseQuantity` is valid only with a syntactically valid unit that has a unit atom and a positive magnitude; `DoseRate` the same with a non-negative magnitude |
| `UnitTest:quantity-has-no-operators` | quantity | section 11 |
| `UnitTest:kernel-clinical-number-display-rules` | quantity | leading zero, no trailing zero after the point, integer zeros kept, no exponent, ASCII digits, no rounding; the shared vectors; the same output with the JVM default locale set to `ar` and to `ckb` |
| `PropertyTest:kernel-display-never-changes-value` | quantity | `parse(format(q))` is numerically equal to `q` |
| `UnitTest:kernel-comparison-api-b-to-e` | quantity | each of (b) to (e), with unit mismatch, exact boundaries, a titration minimum of 0, a negative fluid entry, medication volumes in intake, and the record contents (as entered and as displayed, KB text, threshold provenance) |
| `PropertyTest:kernel-independent-entry-match-exact` | quantity | match exactly when the units are equal and the values numerically equal |
| `PropertyTest:kernel-kb-threshold-comparison` | quantity | ratio and maximum: at-or-above exactly when `ratio >= factor` or `ordered >= factor × maximum`; flag: the section 10.5 rule for every combination of raised, `kbMultiple` and factor; basis mismatch, a maximum in another unit and `NoneReturned` give `DoseCheckUnavailable` |
| `UnitTest:kernel-kb-check-returns-dose-check-unavailable` | quantity | every `UnavailableReason` |
| `UnitTest:unavailable-unit-catalogue-answers-unavailable` | quantity | the WP-0.3 binding answers `Unavailable` for every unit |
| `ArchTest:*` of section 11 | arch-rules | each with violating and compliant fixtures, including calls through the companion and from Java |
| `StaticAnalysis:*` of section 11 | detekt | each rule with flagged and clean fixtures (KA-KN2 if not built) |

## 18. Acceptance criteria

1. Every public signature in sections 5 to 10 exists as written, or the difference is recorded in this spec before WP-0.5 merges it.
2. No kernel library reads the system clock, the default zone or the default locale, explicitly or implicitly; the extended architecture rules pass on the kernel projects and fail on their fixtures.
3. A UUIDv7 generator driven by a `TestClock` produces strictly increasing, unique ids under `UuidV7.compare` across millisecond boundaries, within one millisecond beyond 4,096 ids, with the clock moved backwards, and under concurrent use.
4. `RecordedTime` cannot be built from anything but a `Clock` outside persistence-mapping code; no kernel function makes a `ClinicalTime` from a `RecordedTime`; `ClinicalTime` and `ValidTime` keep their original offsets through a round trip.
5. The entry-time classifier returns the result of the section 6.2 table for every mode, input and kind, with inclusive tolerance boundaries; `EntryTiming` holds accepted results only; `EntryTimingCode` is the only stored vocabulary.
6. The entry mode is derived from the command context only; the objects that select privileged modes can be built only from their allow-lists, which hold no WP-0.3 production package.
7. Safety parameters (`EntryTimePolicy`, `GovernedThreshold`) can be built only by their factories from resolved settings, in allow-listed packages; synthetic values are refused in TRAIN and PROD.
8. `ClinicalTime.resolveLocal` never picks a side of a DST gap or overlap by itself; `plusBusinessDaysAtLocalTime` follows its fixed earlier-instant rule.
9. `BusinessCalendar` reports every unconfirmed year it touched. Safety timers on continuous time are checked by `platform-tasks` (`UnitTest:safety-timers-run-through-weekends-and-holidays`, `UnitTest:safety-relevant-kind-refuses-business-calendar-clock`).
10. `Money` has no floating point in its API; allocation never loses or gains a minor unit; cash rounding and exchange conversion always take an explicit rounding mode.
11. A `DoseQuantity` or `DoseRate` cannot exist without a syntactically valid UCUM unit that contains a unit atom; none of the quantity types has operators; the magnitude accessors are called only from the allowed packages.
12. `DoseComparisons` implements (b) to (e) as in section 10.5, never decides a KB check it cannot prove, and every outcome carries its `ComparisonRecord`.
13. The ISMP display rules hold for every formatted quantity, on every default locale.
14. Each fast-tier test in section 17 has run and passed in the session that claims it (§3.5); the property tests ran with the recorded budget.
15. The open items of section 19 are recorded in the programme files by the integrator, with numbers.

## 19. Open questions, decisions needed and known anomalies (to be numbered)

### Decisions for the CSO [HUMAN]

Each is a reading or a tightening of a safety invariant, so it is not the agent's to decide (§3.4 items 1, 3 and 8). Approval fields stay empty until a human decides.

**DN-KN1 (to be numbered), for the CSO [HUMAN]: values and direction of the SI-10 entry-time tolerances.**
- Status: requested. Decided by: (empty). Date: (empty).
- Blocks: every clinical entry that needs a timing policy (section 6.3), from Phase 1.
- Default in use: the definitions are `configurationRequired` with no vendor value; the resolver answers `NotConfigured`; every entry that needs a policy is refused; tests use synthetic policies.
- Context: SI-10 makes back-dating privileged and audited. The kernel separates a contemporaneous entry from a back-dated one by a tolerance, refuses clinical times beyond a future tolerance (device and client clock skew), labels late interface data beyond a lateness tolerance, and bounds how old an offline capture may be. These are parameters of a safety invariant, vendor-locked and tighten-only (CTRL-0010-1), per timing class (a vital sign, an ADT event, a note).
- Options: (1) the CSO sets each value per timing class before Phase 1, and confirms "smaller is stricter" for all four (default proposal); (2) one vendor value per tolerance for all timing classes, tightened per tenant; (3) zero for all, so every late entry is back-dated (strictest, heavy given that "back-entry after outages will be frequent"). For the future, lateness and offline tolerances, also confirm that a smaller value is stricter even though it refuses more device data into the owned exception queue.

**DN-KN2 (to be numbered), for the CSO [HUMAN]: what "audited" means in "one audited comparison API" (§6.8 #1; CTRL-0005-5).** (Revision 1's OQ-KN1.)
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: a single, small, code-owner-reviewed API whose every outcome carries a `ComparisonRecord` that the caller stores with its journal row and audit event; the kernel writes nothing [P].
- Options: (1) the default; (2) each call must itself emit an audit event (needs a port and the Trust Plane SDK, WP-0.4).

**DN-KN3 (to be numbered), for the CSO [HUMAN]: the KB comparisons of §2.1 (c).** (Revision 1's OQ-KN2, widened.)
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: section 10.5 as written, because the alternative (no comparison with a maximum) would remove a Tier A hard stop.
- Context: (1) with a KB maximum in exactly the ordered unit, `checkKbResult` decides by the exact comparison `ordered >= factor × maximum`, computed inside the API and never returned or stored; CTRL-0005-7 describes the stop as firing when "the dose is at least 10× the KB maximum dose". Is this internal product a comparison allowed by (c), not dose arithmetic? (2) Is "exactly the ordered unit" correctly read to include the dose basis (per dose, per day, per kilogram)? (3) Is the flag rule (a flag decides only through its declared multiple, otherwise "dose check unavailable") right? (4) Is a ratio a decimal multiple of ordered over maximum? (5) Must a governed factor be at least 1?
- Options: confirm each, or name the reading to build.

**DN-KN4 (to be numbered), for the CSO [HUMAN]: what counts as a unit-less dose, and zero rates.** (Revision 1's OQ-KN3.)
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: `DoseQuantity` and `DoseRate` refuse the unity `1`, numbers and factors without an atom, and annotation-only units; a dose is positive; a rate or titration bound may be zero, never negative [P].
- Context: this tightens SI-05's "no unit-less doses" and must be recorded as a tightening (§3.4 item 1). It leaves open how counted doses (tablets, puffs and similar) are expressed: as UCUM annotations, as a coded dose form, or otherwise. Until answered, counted doses cannot be expressed, which no Phase 0 work needs.
- Options: confirm; or allow named annotation forms for counted doses (medications and terminology specifications propose them).

**DN-KN5 (to be numbered), for the CSO [HUMAN]: clinical number and unit display beyond the stated ISMP rules.** (Revision 1's OQ-KN4.)
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: `.` as the decimal separator, no grouping, ASCII-only input, the UCUM code as the unit.
- Context: §2.1, §6.5 and SAC-50 state a leading zero, no trailing zeros and Western digits. They do not state digit grouping for large numbers, the decimal separator in `ar` and `ckb`, whether Eastern Arabic-Indic digits typed into a clinical field are accepted and normalised, or unit display names (some unit abbreviations are error-prone on clinical displays). A CSO-approved source (the ISMP list placed in `docs/content-sources/`, §3.5) and the localisation decisions answer. Clinical-safety relevant (SI-05, SAC-50).
- Options: name the source and the rules for each point.

**DN-KN6 (to be numbered), for the CSO [HUMAN]: entry-timing labels, windows, back-entry privilege and offline capture.** (Revision 1's OQ-KN10, merged with the journal specification's open question on back-entry privilege.)
- Status: requested. Decided by: (empty). Date: (empty).
- Default in use: section 6.2 as written: `BACK_DATED`, `BACK_ENTRY`, `OFFLINE_CAPTURE`, `LATE_ARRIVAL` and `MIGRATED` are labelled; a back-entry needs a registry episode and falls inside its window; back-entry needs the tooling's own permission but not the back-dating privilege; an offline capture older than its tolerance is refused into an owned queue; `AtRecording` is allowed only for declared event types and online.
- Context: CTRL-0010-5 names "late or downtime entry" labels; the other labels, the episode window and the offline mode are this build's additions. Offline capture uses the device's clock; whether the sync endpoint must check that clock's offset at sync (ADR-026) and refuse beyond a skew is part of this decision, with the mobile, edge-agent and `TRU-BCP-03` specifications.
- Options: (1) the default; (2) back-entry also needs the back-dating privilege (the journal can enforce it); (3) an offline capture beyond its tolerance becomes `BackDated` under the capturing user's privilege instead of being refused.

### Open questions

**OQ-KN5 (to be numbered): the UCUM specification as a content source.** The syntax validator and its test vectors are coded from the UCUM specification. A copy and its terms of use need to be placed in `docs/content-sources/` (by a human if fetching it is outward-facing, §3.7), and the semantic tables arrive with the terminology service (WP-1.1, §21 "loads LOINC, UCUM and ICD-10 from licensed files when a human supplies them"). Until the copy is present, the validator's test vectors are limited to grammar cases that need no atom table.

**OQ-KN6 (to be numbered): non-dose quantities.** SI-05 restricts dose arithmetic, not every measurement. Results (critical-value and reference-range comparisons, §9.7), nursing (vital-sign ranges), `reg-ews` (scoring bands) and `reg-lis-rules` (delta checks) will need same-unit comparisons, and the Tier 2 calculators arithmetic, on non-dose quantities. The magnitude rule now allows only `hms.reg.dose..`, `hms.kernel.quantity..` and `..infrastructure.persistence..`. Before the first such module (Phase 1), decide between widening the allow-list (for example to `hms.reg..`) and adding a separate measurement comparison API in `hms.kernel.quantity` for non-dose values. Either way a `DoseQuantity` or `DoseRate` never reaches a non-dose comparison.

**OQ-KN7 (to be numbered): IQD scale and cash rounding settings.** Whether the tenant ledger keeps IQD at the ISO 4217 minor unit given by the JDK or at whole dinars ("reconciliation to the dinar", §9.21); the cash-rounding rounding mode per tenant (proposed key `kri.rcm.cash-rounding.mode`); and whether USD cash rounding needs its own key (`kri.rcm.cash-rounding.usd`) while USD stays behind L-33. For the `rcm` specification and the CFO (L-14, L-33).

**OQ-KN8 (to be numbered): exchange-rate direction.** Whether change given in the other currency uses the inverse of one posted rate (`ExchangeRate.convertBack`) or a separately posted rate for the other direction (buy and sell rates), and how a corrected rate supersedes a wrong one. For the `rcm` specification (§9.21, §11.4).

**OQ-KN9 (to be numbered): business hours and facility calendars.** WP-0.3 counts whole business days in the facility zone. Whether administrative SLAs need business hours (and part days such as the eve of a holiday), and whether a facility may override the tenant's weekend or holidays (for example a hospital in another governorate of a group tenant), is for the `platform-tasks` and `platform-tenancy` specifications and the tenant (§7 item 1; L-20).

**OQ-KN11 (to be numbered): offset of recorded time.** §5.3 says "instants stored in UTC with the original offset". This build applies "original offset" to clinical time (user- or device-supplied) and stores recorded time as a UTC instant, displayed in the facility zone [P]. Confirm. This stays an open question, not a CSO decision: it is a reading of a storage convention, and recorded time's display zone changes no clinical meaning.

**OQ-KN12 (to be numbered): feature ID for the kernel libraries.** Appendix A has no row for UUIDv7, `Clock`, the command context, `Money` and `Quantity`; traceability (§18.1) needs one, or a recorded mapping to `PLT-CORE-01`, `PLT-CORE-02`, `PLT-CORE-07` and `PLT-CFG-01` (the sibling `platform-workflow` specification raises the same question, its OQ-W1).

**OQ-KN13 (to be numbered): purpose-of-use vocabulary.** `CommandContext` requires a purpose of use (§6.2; R07 AZ-7). The vocabulary belongs to the Trust Plane (WP-0.4). Until then, which code do WP-0.3 `SYSTEM` processes and tests carry? Proposal: tests use synthetic codes; no production deployment exists before WP-0.4.

**OQ-KN14 (to be numbered): approximate clinical times on paper.** Paper downtime records often give a date only or "morning". `ClinicalTime` is an exact instant, so a back-entry would carry an invented precision. Should `ValidTime` carry a precision (exact, minute, hour, day, approximate), or does the `TRU-BCP-03` tooling record the stated time as text beside the instant? For the `TRU-BCP-03` specification and the CSO.

**OQ-KN15 (to be numbered): calendar and zone ownership in tenancy.** Three points for the `platform-tenancy` specification: (1) §5.2 gives "calendars and holidays" to `platform-i18n`, while this build keeps the calendar data in tenancy's chain and the type in the kernel (tenancy's OQ-T4); (2) closed: coverage uses the years listed in the `calendar.holidays` value as `confirmedYears` (tenancy specification §5.10), so no `calendar.confirmed-years` setting exists; (3) §4.1's "Default time zone `Asia/Baghdad`, configurable per tenant", honoured by a COUNTRY_PACK or TENANT setting (proposed `platform.tenancy.facility.default-zone`) that pre-fills the facility's `zone` at creation, with the Kurdistan pack supplying `Asia/Baghdad`.

### Known anomalies

**KA-KN1 (to be numbered): UCUM validation is syntactic only.** `UcumUnit.parse` accepts any code that fits the UCUM grammar, including unknown atoms, misspellings that are still grammatical, and non-metric units; no atom table, dimension check, metric check (SAC-11) or conversion exists until the terminology service (`PLT-CORE-05`, WP-1.1). The `UnitCatalogue` binding answers `Unavailable`; the refusal on that answer is the medications module's control (Phase 1). Hazard references: HAZ-0005 (CTRL-0005-4). Backlog ID: `PLT-CORE-05`. Closes with: WP-1.1 and a human placing the UCUM files.

**KA-KN2 (to be numbered, only if the detekt rules are not built in WP-0.3): the detekt half of §6.8 #1 and the time and reason rules are missing.** Only the ArchUnit rules and the operator-free quantity types guard against dose arithmetic; nothing static flags a clinical time rebuilt from a recorded time or a literal change reason. Hazard references: HAZ-0005 (CTRL-0005-5), HAZ-0010 (CTRL-0010-3, CTRL-0010-4). Backlog ID: `PLT-CORE-03` or the medications feature that first needs it. Closes with: the three rules, `NoDoseArithmetic` before the medications module (§9.10 acceptance 6).

**KA-KN3 (to be numbered): limits of the ArchUnit rules.** They cannot see arithmetic on a magnitude inside an allowed persistence package, a value laundered through `display()` or `asEntered()` and parsed back into a number, or a `ClinicalTime` built from `RecordedTime.instant`. Compensating controls: the detekt rules and safety code-owner review of persistence and time-handling changes. Hazard references: HAZ-0005 (CTRL-0005-5), HAZ-0010 (CTRL-0010-3). Closes with: the detekt rules with type resolution, or `mitigated` while review stands in.

**KA-KN4 (to be numbered): calendar data and entry-time tolerances are not configured.** No holiday dates beyond the pack's Newroz item and no confirmed years exist (L-20), and no SI-10 tolerances exist (DN-KN1). Calendar answers flag uncovered years and treat unknown days as business days (deadlines come earlier, never later); every entry that needs a timing policy is refused. Hazard references: HAZ-0010, HAZ-0003. Closes with: the Kurdistan pack (WP-1.1) and DN-KN1.

**KA-KN5 (to be numbered): unit display names are not approved content.** `display()` shows the raw UCUM code. The kernel's part of CTRL-0005-17 covers numbers only. Raw unit codes must not be shown to clinicians in TRAIN or PROD until approved display names and the ISMP list are placed and checked; the mechanism and its test belong to the frontend `ClinicalNumber` and medications specifications (Phase 1), and no clinical display exists before then. Hazard references: HAZ-0005 (CTRL-0005-17). Closes with: DN-KN5 and the approved content.

**KA-KN6 (to be numbered): safety timers run on wall-clock time.** A cell-wide backward clock step delays every pending safety timer by the size of the step (HC-KN4). Compensating controls: ADR-026's time source and alarms; the step detection that `platform-tasks` specifies (its §4.5, `UnitTest:backward-clock-step-detected-and-alarmed`). Hazard references: HAZ-0003 (CTRL-0003-5). Closes with: the step detection and its property test passing.

**KA-KN7 (to be numbered): the command context is not yet bound to the authenticated principal.** Until the Trust Plane SDK (WP-0.4), any code can build a `USER` actor, and the other actor kinds, offline capture and back-entry authority are guarded by package allow-lists only. In WP-0.3 those lists hold no production package, so the privileged modes cannot occur. Hazard references: HAZ-0010 (CTRL-0010-4, CTRL-0010-5). Closes with: WP-0.4 building `CommandContext` from the authenticated session.

No ADR is proposed: these choices sit inside ADR-004, ADR-016 and the §6.2 conventions.

## 20. Where this spec differs from or extends the shared architecture

- **Non-dose quantities (OQ-KN6).** The shared rule restricts the `Quantity` magnitude to `hms.reg.dose..`, `hms.kernel.quantity..` and persistence mapping. That is right for doses, but it would also block legitimate non-dose comparisons and Tier 2 arithmetic on results and vital signs in Phase 1. This spec keeps the rule for WP-0.3 and asks for the decision before Phase 1.
- **`DoseComparisons` takes `DoseQuantity` for (b) and (c), `DoseRate` for (d), and measured or medication volumes for (e)**, because intake and output volumes are not all medication doses, and titration needs zero.
- **The entry-time classifier has seven modes and seven codes**, beyond the shared "back-dating vs back-entry" pair, so that device, offline, migrated, system and effective-dated data are classified without a user privilege that they cannot hold (§8.3; DN-KN6).
- **`AsOf.knownAt` is an `Instant` (D4's alternative)**, so a user's as-was question needs no recorded time; written rows keep `RecordedTime`.
- **`RecordedTime` carries no offset (OQ-KN11)**, and every kernel instant is truncated to microseconds to match PostgreSQL.
- **Calendar data sits in tenancy's chain and the type in the kernel**, although §5.2 gives "calendars and holidays" to `platform-i18n`, which does not exist in WP-0.3 (OQ-KN15; tenancy's OQ-T4). §7 item 1 asks for tenant calendars in WP-0.3.
- **The facility zone is a facility attribute, never defaulted in code.** §4.1 says "Default time zone `Asia/Baghdad`, configurable per tenant"; this build honours the per-tenant default through a pack or tenant setting that pre-fills the attribute at creation (OQ-KN15), because §8.1 P10 displays in "the facility time zone".
- **Configuration may be read by every module through `hms.platform.tenancy.api`** (D5), which §5.2's dependency column does not list for every module.

## 21. Interfaces this spec assumes of its siblings

| Sibling | What this spec assumes |
|---|---|
| `platform-journal` | `JournalAppender.append` takes the `CommandContext` and entries that carry a `ValidTimeInput`, an expected `EntryTimingCode` and a `ChangeReason?`. It reads the clock once per append, derives the mode from `context.entryMode`, looks up the policy through `EntryTimePolicySource` when `needsPolicy` says so, classifies with `EntryTimeClassifier`, refuses on a differing expectation, and enforces the requirements: `BackDatingAuthorization` (production binding refuses all), `BACK_ENTRY_AUTHORITY`, `ChangeReason.Entered` where required, `SystemGenerated` only for `SYSTEM`. It stores `entry_timing` (an `EntryTimingCode` name), the clinical time source, the `ValidTime` with offsets and the policy sources. `JournalEntry.recordedAt` is a `RecordedTime`. `TransactionContext` (with `markRollbackOnly`, `isRollbackOnly`, `onBeforeCommit` and `onCompletion`, section 7.5), `TransactionRunner`, `InMemoryTransactionRunner`, `TxOutcome`, `IdempotencyKey` and `CausationId` come from `hms.kernel.context`; tenant, facility, patient and user ids are the kernel's typed ids; `AsOf` replaces bare `knownAt` instants |
| `docs/specs/events/catalogue.md` and `envelope.md` | Each event type's catalogue entry declares its `ValidTimeKind` and, where entries can be given a clinical time, its `TimingClass`. `EFFECTIVE` is allowed only for non-clinical owners (tenancy, config), checked by a catalogue test under safety code-owner review. The `entrytiming` value list is `EntryTimingCode`. The CloudEvents `time` is an `Instant` at the wire boundary |
| `platform-tenancy` | Uses the kernel's `TenantId`, `FacilityId`, `UserId`, `AsOf`, `ContentProvenance` and `CommandContext`. Declares `calendar.weekend-days` and `calendar.holidays` (not lockable), and builds `BusinessCalendar.of(zone, weekend, holidays, confirmedYears)` with the holiday value's covered years as `confirmedYears`. Implements `EntryTimePolicySource` with `EntryTimePolicyResolver` in the allow-listed package `hms.platform.tenancy.application.settings`, which resolves the four keys at `AsOf.latest(recorded)`, converts each resolved value and its provenance into a `ResolvedParameter`, and calls `EntryTimePolicy.fromResolved(..., environment)`; it answers `NotConfigured` when a definition or value is missing (`UnitTest:entry-time-policy-resolver-answers-not-configured`). Reserves `platform.time.entry` in its key grammar and accepts `configurationRequired` + `GOVERNED` definitions with no vendor default (D-2). Checks each tighten-only comparator against the declared direction (D12). Considers the facility default-zone setting (OQ-KN15) |
| `platform-config` | Its `Environment` is `typealias Environment = hms.kernel.time.EnvironmentClass`; the deployment parameter `platform.config.environment` gives the class to `app-hms`; its `SYNTHETIC`/`APPROVED` provenance is `ContentProvenance`; gate G8 stays the first synthetic gate |
| `platform-tasks` | Uses `UserId` (not `UserRef`) and the kernel's tenant and facility ids. Computes business-calendar due times by calling `BusinessCalendar.plusBusinessDaysAtLocalTime` (never re-implementing it with `ClinicalTime.resolveLocal`) and raises its owned configuration alarm when a `CalendarAnswer` is incomplete. Runs its alarm paths as `ActorRef.system(...)` from `hms.platform.tasks.application.system`. Detects a backward clock step (HC-KN4) and adds a backward-step case to `PropertyTest:SI-03-orphan-alarm-within-5-minutes`. Keeps the CSO decision on continuous safety timers. Every Task row uses `ValidTimeInput.AtRecording`; `workBeganAt` and `performedAt` are payload fields, so no task entry needs a timing policy. Its safety policies (and `DeadLetterAlarmPolicy`) have private constructors and `@SafetyParameterFactory` factories taking `ResolvedParameter`s and the `EnvironmentClass`, called only from `hms.platform.tasks.infrastructure.config` (section 6.5) |
| `platform-workflow` | Every `WorkflowPort` operation takes the kernel's `CommandContext` (with `TenantId`, `ActorRef` and `CorrelationId`); it defines no copy (its OQ-W2 is closed). Its Temporal status mapping, which restores `RecordedTime`, lives in `hms.platform.workflow.infrastructure.persistence` (section 11). A signal relay acts as the actor of the event that caused it; a relay package joins `SYSTEM_PROCESSES` only through a revision of this spec with safety review (section 7.2) |
| `app-hms` | Binds `Clock.systemUTC()`, `UuidV7Generator(clock, SecureRandom())` and the `EnvironmentClass`; binds no test or in-memory adapter in production (D8) |
| Build files (integrator) | `:platform:quantity` gains `api(project(":platform:time"))` |
