# WP-0.3 library slice reports (19 Oct 2026, ~11:00-12:00), summarised by the integrator

All three built by subagents in the worktree; each passed its own project's test, propertyTest, detekt,
ktlintCheck and verifyArchitectureTest on the Windows host (not evidence of record). NOT yet reviewed,
NOT yet run in a full fast tier, NOT committed.

## :platform:ids + TestClock (backend/platform/ids/**, backend/platform/testing/src/{main,test}/kotlin/hms/kernel/testing/TestClock*.kt)
- Counts: ids test 76 (Architecture 4, TypedId 25, UuidV7Generator 11, UuidV7 36), ids propertyTest 7; testing test 21 (TestClock 7), testing propertyTest 1. Log: %TEMP%/hms-wp03/ids-run2.log.
- All spec slugs: uuidv7-layout-rfc9562, uuidv7-monotonic-and-unique, uuidv7-monotonic-when-clock-goes-backwards, uuidv7-compare-matches-byte-order, uuidv7-parse-rejects-non-v7, uuidv7-clock-out-of-range-throws, kernel-typed-ids-require-v7, test-clock-controllable (+ extras uuidv7-parse-strict, format-parse round trip).
- Interpretations to review: (1) at clock 2^48-1 a counter rollover throws IllegalStateException (spec says "never fails in range"; impossible at the last ms) -> spec wording fix; (2) Instant.MAX/MIN clock -> ArithmeticException rethrown as IllegalStateException; (3) counter seed nextInt() and 0x7FF, ReentrantLock; (4) requireV7 messages never print the UUID; (5) TestClock private primary ctor with shared AtomicReference, withZone shares time; (6) nightly 10^6 run of UuidV7GeneratorPropertyTest will be slow (rollover bursts).

## :platform:time (backend/platform/time/**)
- Counts: test 60 (Architecture 4), propertyTest 17 properties at 1,000.
- Classifier: one unit test per row of the §6.2 table (19 rows), at each tolerance and +/- 1 microsecond; property kernel-entry-timing-table checks against an independent data copy of the table and asserts all 19 rows reached.
- Slugs implemented: all time slugs of kernel spec §17 except PropertyTest:entry-time-tolerance-strictness-direction (needs tenancy's Strictness; waits for platform-tenancy and DN-KN1).
- Interpretations to review: ClinicalTime.parse error mapping (leap second/offset > 18:00 OUT_OF_RANGE; impossible fields MALFORMED; -00:00 OFFSET_MISSING; offset seconds OFFSET_HAS_SECONDS; any fraction length truncated to microseconds); toString always prints seconds; resolveLocal throws for offsets with seconds (historic LMT); AtRecording stamps recorded instant, UTC offset, open end; EntryTiming subtypes check source and lag sign in init (OfflineCapture lag may be negative within future tolerance); EntryTimePolicy adds keys(timingClass) and KEY_PREFIX, fromResolved refusal order key mismatch > synthetic > out of range; ResolvedParameter refuses blank key/source; BusinessCalendar plusBusinessDays(0) touches nothing, plusBusinessDaysAtLocalTime(days=0) returns start, Int overflow throws. Detekt suppressions: LongParameterList on classify and fromResolved; file-level MagicNumber/CyclomaticComplexMethod in two propertyTest files.
- Markers @PersistenceOnly, @SafetyParameterFactory, @EpisodeRegistryOnly have runtime retention (for the §11 arch rules).
- Build scripts: %TEMP%/hms-wp03/time-slice-scripts/.

## :platform:money (backend/platform/money/**)
- Counts: test 36 (Architecture 4, Money 15, MoneyApi 2, CashRounding 6, ExchangeRate 9), propertyTest 8.
- Slugs: money-minor-units-from-iso4217, money-api-has-no-floating-point (reflection, with a violating fixture), exchange-rate-effective-at-instant, money-arithmetic-exact, money-allocation-sums-exactly, cash-rounding-multiple-of-increment.
- ISO 4217 values (IQD 3, USD 2, XXX none) checked against the maintenance agency's list one, published 2026-09-17, downloaded once to %TEMP%/hms-wp03/money-iso (outside the repo; record its source/checksum in the review if it is cited).
- Interpretations to review: ofExact refuses extra decimals even if zeros (USD "1.500"); ofRounded(UNNECESSARY) refuses with MORE_DECIMALS_THAN_THE_CURRENCY_HAS, elsewhere UNNECESSARY throws ArithmeticException; internal helpers Money.rounded and CashRoundingPolicy.ToIncrement factory; directed rate pairs (USD->IQD and IQD->USD separate; OQ-KN8); first overlapping pair reported; ExchangeRate identity equality; detekt TooManyFunctions on Money, LongParameterList on ExchangeRate.of.

## Common follow-ups
- Every ArchitectureTest applies HmsArchitectureRules.all() only; add the kernel §11 rules when the arch-rules slice builds them.
- backend/platform/quantity/build.gradle.kts needs api(project(":platform:time")) (kernel spec §4).
