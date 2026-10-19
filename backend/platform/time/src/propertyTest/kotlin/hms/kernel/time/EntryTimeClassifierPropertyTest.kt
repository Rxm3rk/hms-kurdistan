// Generator weights and ranges are test data, not domain values; the case generator has one branch per input shape.
@file:Suppress("MagicNumber", "CyclomaticComplexMethod")

package hms.kernel.time

import hms.kernel.testing.PropertyTestBudget
import hms.kernel.time.EntryMode.BACK_ENTRY
import hms.kernel.time.EntryMode.DEVICE
import hms.kernel.time.EntryMode.INTERFACE
import hms.kernel.time.EntryMode.MIGRATION
import hms.kernel.time.EntryMode.OFFLINE_CAPTURE
import hms.kernel.time.EntryMode.SYSTEM
import hms.kernel.time.EntryMode.USER
import hms.kernel.time.ValidTimeKind.CLINICAL_AT_RECORDING
import hms.kernel.time.ValidTimeKind.CLINICAL_CAPTURED
import hms.kernel.time.ValidTimeKind.EFFECTIVE
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.enum
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.long
import io.kotest.property.arbitrary.map
import io.kotest.property.checkAll
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

private const val MIN_RECORDED_SECOND = 1_600_000_000L
private const val MAX_RECORDED_SECOND = 1_900_000_000L
private const val MAX_MICRO = 999_999L
private const val MAX_TOLERANCE_MICROS = 2L * 24 * 3600 * 1_000_000
private const val MAX_RANDOM_LAG_MICROS = 4L * 24 * 3600 * 1_000_000
private const val MAX_OFFSET_QUARTERS = 56
private const val SECONDS_PER_QUARTER_HOUR = 900
private const val SELECTOR_CHOICES = 10

private fun micros(count: Long): Duration = Duration.ofNanos(count * 1_000)

private val MICRO: Duration = micros(1)

/** One classifier input. */
private data class Case(
    val input: ValidTimeInput,
    val kind: ValidTimeKind,
    val recorded: RecordedTime,
    val mode: EntryMode,
    val lookup: EntryTimePolicyLookup,
    val episode: BackEntryEpisode?,
) {
    fun classify(): EntryTimingResult = EntryTimeClassifier.classify(input, kind, recorded, mode, lookup, episode)

    val given: ValidTime? get() = (input as? ValidTimeInput.Given)?.validTime

    /** The policy where the lookup has one; the table reaches the tolerance rows only then. */
    val policy: EntryTimePolicy get() = (lookup as EntryTimePolicyLookup.Available).policy

    /** The §6.2 lag: recorded instant minus clinical start instant. */
    val lag: Duration get() = Duration.between(requireNotNull(given).start.instant, recorded.instant)

    /** True when the start or the end is later than the recorded time by more than [bound]. */
    fun laterThan(bound: Duration): Boolean {
        val limit = recorded.instant.plus(bound)
        val validTime = requireNotNull(given)
        return validTime.start.instant.isAfter(limit) || validTime.endExclusive?.instant?.isAfter(limit) == true
    }
}

private enum class InputMatch { GIVEN, AT_RECORDING, ANY }

/** What a row decides: a refusal, or an accepted timing with or without the policy. */
private sealed interface Outcome {
    data class Refuse(
        val reason: EntryTimeRefusal,
    ) : Outcome

    data class Accept(
        val timing: (Case) -> EntryTiming,
        val policyNeeded: Boolean,
    ) : Outcome
}

/** One row of the platform-kernel.md §6.2 table, written out independently of the classifier. */
private class Row(
    val number: Int,
    val modes: Set<EntryMode>,
    val input: InputMatch,
    val kinds: Set<ValidTimeKind>,
    val condition: (Case) -> Boolean,
    val outcome: Outcome,
) {
    fun matches(case: Case): Boolean {
        val inputMatches =
            when (input) {
                InputMatch.GIVEN -> case.input is ValidTimeInput.Given
                InputMatch.AT_RECORDING -> case.input == ValidTimeInput.AtRecording
                InputMatch.ANY -> true
            }
        return case.mode in modes && inputMatches && case.kind in kinds && condition(case)
    }
}

private val ANY_MODE = EntryMode.entries.toSet()
private val ANY_KIND = ValidTimeKind.entries.toSet()
private val CLINICAL = setOf(CLINICAL_CAPTURED, CLINICAL_AT_RECORDING)
private val POLICY_MODES = setOf(USER, OFFLINE_CAPTURE, DEVICE, INTERFACE)
private val FUTURE = EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE

private fun refuse(reason: EntryTimeRefusal) = Outcome.Refuse(reason)

private fun accept(
    policyNeeded: Boolean,
    timing: (Case) -> EntryTiming,
) = Outcome.Accept(timing, policyNeeded)

private fun channelSource(mode: EntryMode) = if (mode == DEVICE) ClinicalTimeSource.DEVICE else ClinicalTimeSource.INTERFACE

/** The §6.2 table, top to bottom; the first matching row decides. */
private val TABLE: List<Row> =
    listOf(
        Row(
            1,
            ANY_MODE,
            InputMatch.GIVEN,
            setOf(EFFECTIVE),
            { it.lag > Duration.ZERO },
            accept(false) {
                EntryTiming.BackDated(it.lag, ClinicalTimeSource.EFFECTIVE_DATE)
            },
        ),
        Row(2, ANY_MODE, InputMatch.ANY, setOf(EFFECTIVE), { true }, accept(false) { EntryTiming.EffectiveDated }),
        Row(3, ANY_MODE, InputMatch.AT_RECORDING, setOf(CLINICAL_CAPTURED), { true }, refuse(EntryTimeRefusal.CAPTURE_TIME_REQUIRED)),
        Row(
            4,
            setOf(OFFLINE_CAPTURE, BACK_ENTRY, DEVICE, INTERFACE, MIGRATION),
            InputMatch.AT_RECORDING,
            CLINICAL,
            { true },
            refuse(EntryTimeRefusal.CAPTURE_TIME_REQUIRED),
        ),
        Row(
            5,
            setOf(USER, SYSTEM),
            InputMatch.AT_RECORDING,
            setOf(CLINICAL_AT_RECORDING),
            { true },
            accept(false) {
                EntryTiming.Contemporaneous(ClinicalTimeSource.AT_RECORDING)
            },
        ),
        Row(6, setOf(SYSTEM), InputMatch.GIVEN, CLINICAL, { true }, refuse(EntryTimeRefusal.SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME)),
        Row(
            7,
            POLICY_MODES,
            InputMatch.GIVEN,
            CLINICAL,
            { it.lookup !is EntryTimePolicyLookup.Available },
            refuse(EntryTimeRefusal.TIMING_POLICY_NOT_CONFIGURED),
        ),
        Row(8, POLICY_MODES, InputMatch.GIVEN, CLINICAL, { it.laterThan(it.policy.futureTolerance) }, refuse(FUTURE)),
        Row(9, setOf(BACK_ENTRY, MIGRATION), InputMatch.GIVEN, CLINICAL, { it.laterThan(Duration.ZERO) }, refuse(FUTURE)),
        Row(
            10,
            setOf(USER),
            InputMatch.GIVEN,
            ANY_KIND,
            { it.lag <= it.policy.contemporaneousTolerance },
            accept(true) {
                EntryTiming.Contemporaneous(ClinicalTimeSource.ENTERED)
            },
        ),
        Row(
            11,
            setOf(USER),
            InputMatch.GIVEN,
            ANY_KIND,
            { it.lag > it.policy.contemporaneousTolerance },
            accept(true) {
                EntryTiming.BackDated(it.lag, ClinicalTimeSource.ENTERED)
            },
        ),
        Row(
            12,
            setOf(OFFLINE_CAPTURE),
            InputMatch.GIVEN,
            ANY_KIND,
            { it.lag <= it.policy.offlineCaptureTolerance },
            accept(true) {
                EntryTiming.OfflineCapture(it.lag)
            },
        ),
        Row(
            13,
            setOf(OFFLINE_CAPTURE),
            InputMatch.GIVEN,
            ANY_KIND,
            { it.lag > it.policy.offlineCaptureTolerance },
            refuse(EntryTimeRefusal.OFFLINE_CAPTURE_TOO_LATE),
        ),
        Row(14, setOf(BACK_ENTRY), InputMatch.GIVEN, ANY_KIND, { it.episode == null }, refuse(EntryTimeRefusal.BACK_ENTRY_WITHOUT_EPISODE)),
        Row(
            15,
            setOf(BACK_ENTRY),
            InputMatch.GIVEN,
            ANY_KIND,
            { insideWindow(it) },
            accept(false) {
                EntryTiming.BackEntry(it.lag, requireNotNull(it.episode).episodeId)
            },
        ),
        Row(16, setOf(BACK_ENTRY), InputMatch.GIVEN, ANY_KIND, { !insideWindow(it) }, refuse(EntryTimeRefusal.OUTSIDE_BACK_ENTRY_WINDOW)),
        Row(
            17,
            setOf(DEVICE, INTERFACE),
            InputMatch.GIVEN,
            ANY_KIND,
            { it.lag <= it.policy.interfaceLatenessTolerance },
            accept(true) {
                EntryTiming.Contemporaneous(channelSource(it.mode))
            },
        ),
        Row(
            18,
            setOf(DEVICE, INTERFACE),
            InputMatch.GIVEN,
            ANY_KIND,
            { it.lag > it.policy.interfaceLatenessTolerance },
            accept(true) {
                EntryTiming.LateArrival(it.lag, channelSource(it.mode))
            },
        ),
        Row(
            19,
            setOf(MIGRATION),
            InputMatch.GIVEN,
            ANY_KIND,
            { !it.laterThan(Duration.ZERO) },
            accept(false) {
                EntryTiming.Migrated(it.lag)
            },
        ),
    )

/** Inside the half-open episode window, checked here with plain instant comparisons. */
private fun insideWindow(case: Case): Boolean {
    val window = requireNotNull(case.episode).window
    val start = requireNotNull(case.given).start.instant
    return !start.isBefore(window.start) && (window.endExclusive == null || start.isBefore(window.endExclusive))
}

/** The result the table gives for [case]: its row number and the expected classifier result. */
private fun expected(case: Case): Pair<Int, EntryTimingResult> {
    val row = TABLE.first { it.matches(case) }
    val result =
        when (val outcome = row.outcome) {
            is Outcome.Refuse -> {
                EntryTimingResult.Refused(outcome.reason)
            }

            is Outcome.Accept -> {
                val validTime = case.given ?: ValidTime.from(ClinicalTime.of(case.recorded.instant, ZoneOffset.UTC))
                EntryTimingResult.Accepted(outcome.timing(case), validTime, if (outcome.policyNeeded) case.policy else null)
            }
        }
    return row.number to result
}

/**
 * The SI-10 classifier against the §6.2 table on random inputs, with lags and ends placed on every tolerance
 * boundary and one microsecond either side (platform-kernel.md §6.2, §17; CTRL-0010-1, -3, -4, -5).
 */
@OptIn(EpisodeRegistryOnly::class)
class EntryTimeClassifierPropertyTest :
    FunSpec({
        val budget = PropertyTestBudget.sequences()
        val tolerances =
            arbitrary {
                when (Arb.int(0..3).bind()) {
                    0 -> Duration.ZERO
                    1 -> micros(Arb.long(1L..1_000L).bind())
                    else -> micros(Arb.long(0L..MAX_TOLERANCE_MICROS).bind())
                }
            }
        val policies = arbitrary { TimeFixtures.policy(tolerances.bind(), tolerances.bind(), tolerances.bind(), tolerances.bind()) }
        val recordedTimes =
            arbitrary {
                TimeFixtures.recordedAt(
                    Instant.ofEpochSecond(
                        Arb.long(MIN_RECORDED_SECOND..MAX_RECORDED_SECOND).bind(),
                        Arb.long(0L..MAX_MICRO).bind() * 1_000,
                    ),
                )
            }
        val offsets = Arb.int(-MAX_OFFSET_QUARTERS..MAX_OFFSET_QUARTERS).map { ZoneOffset.ofTotalSeconds(it * SECONDS_PER_QUARTER_HOUR) }
        val nudges = Arb.element(MICRO.negated(), Duration.ZERO, MICRO)

        /** A lag on a boundary of [policy] (give or take a microsecond), or anywhere within four days either way. */
        fun lags(policy: EntryTimePolicy) =
            arbitrary {
                val boundary =
                    listOf(
                        Duration.ZERO,
                        policy.contemporaneousTolerance,
                        policy.futureTolerance.negated(),
                        policy.interfaceLatenessTolerance,
                        policy.offlineCaptureTolerance,
                    )
                if (Arb.int(0..2).bind() == 0) {
                    micros(Arb.long(-MAX_RANDOM_LAG_MICROS..MAX_RANDOM_LAG_MICROS).bind())
                } else {
                    Arb.element(boundary).bind().plus(nudges.bind())
                }
            }

        fun cases(
            modes: Arb<EntryMode> = Arb.enum<EntryMode>(),
            kinds: Arb<ValidTimeKind> = Arb.enum<ValidTimeKind>(),
            givenOnly: Boolean = false,
            lagOf: ((EntryTimePolicy) -> Arb<Duration>)? = null,
            alwaysAvailable: Boolean = false,
        ) = arbitrary {
            val recorded = recordedTimes.bind()
            val policy = policies.bind()
            val lag = (lagOf ?: ::lags)(policy).bind()
            val start = ClinicalTime.of(recorded.instant.minus(lag), offsets.bind())
            val endCandidate =
                when (Arb.int(0..SELECTOR_CHOICES).bind()) {
                    in 0..4 -> null
                    in 5..6 -> start.instant.plus(micros(Arb.long(1L..MAX_TOLERANCE_MICROS).bind()))
                    in 7..8 -> recorded.instant.plus(policy.futureTolerance).plus(nudges.bind())
                    else -> recorded.instant.plus(nudges.bind())
                }
            val validTime =
                endCandidate
                    ?.takeIf { it.isAfter(start.instant) }
                    ?.let { (ValidTime.of(start, ClinicalTime.of(it, offsets.bind())) as ValidTimeResult.Valid).validTime }
                    ?: ValidTime.from(start)
            val input = if (!givenOnly && Arb.int(0..4).bind() == 0) ValidTimeInput.AtRecording else ValidTimeInput.Given(validTime)
            val lookup =
                when (if (alwaysAvailable) 0 else Arb.int(0..5).bind()) {
                    in 0..2 -> EntryTimePolicyLookup.Available(policy)
                    3 -> EntryTimePolicyLookup.NotConfigured(policy.timingClass, EntryTimePolicy.keys(policy.timingClass))
                    4 -> EntryTimePolicyLookup.Unavailable
                    else -> EntryTimePolicyLookup.NotLookedUp
                }
            val id = UUID(Arb.long().bind(), Arb.long().bind())
            val before = micros(Arb.long(0L..MAX_TOLERANCE_MICROS).bind())
            val after = micros(Arb.long(1L..MAX_TOLERANCE_MICROS).bind())
            val s = start.instant
            val episode =
                when (Arb.int(0..5).bind()) {
                    0 -> null

                    1 -> TimeFixtures.episode(s.minus(before), s.plus(after), id)

                    2 -> TimeFixtures.episode(s.minus(before), null, id)

                    // Ends at, just before or just after the start.
                    3 -> TimeFixtures.episode(s.minus(before).minus(after), s.minus(before).plus(nudges.bind()).plus(MICRO), id)

                    // Starts at, or just after the start.
                    4 -> TimeFixtures.episode(s.plus(nudges.bind()).plus(MICRO), s.plus(after).plus(MICRO).plus(MICRO), id)

                    else -> TimeFixtures.episode(s, s.plus(after), id)
                }
            Case(input, kinds.bind(), recorded, modes.bind(), lookup, episode)
        }

        test("kernel-entry-timing-table: every input gets the result of the first matching §6.2 row, inclusive boundaries") {
            val rowsHit = mutableSetOf<Int>()
            checkAll(budget, cases()) { case ->
                val (row, expectedResult) = expected(case)
                rowsHit += row
                withClue("row $row for $case") { case.classify() shouldBe expectedResult }
            }
            if (budget >= PropertyTestBudget.DEFAULT_SEQUENCES) rowsHit shouldBe (1..TABLE.size).toSet()
        }

        test("kernel-entry-timing-table: needsPolicy is true exactly where the first matching row needs a policy") {
            checkAll(budget, cases()) { case ->
                val needed = EntryTimeClassifier.needsPolicy(case.input, case.kind, case.mode)
                val row = TABLE.first { it.matches(case) }
                val rowNeedsPolicy = row.number in setOf(7, 8, 10, 11, 12, 13, 17, 18)
                needed shouldBe rowNeedsPolicy
            }
        }

        test("kernel-entry-timing-back-dated-requirements: every USER entry beyond the tolerance is BackDated with four requirements") {
            val lateLags = { policy: EntryTimePolicy ->
                arbitrary { policy.contemporaneousTolerance.plus(micros(Arb.long(1L..MAX_RANDOM_LAG_MICROS).bind())) }
            }
            checkAll(budget, cases(Arb.element(USER), Arb.element(CLINICAL.toList()), true, lateLags, true)) { case ->
                val result = case.classify()
                if (!case.laterThan(case.policy.futureTolerance)) {
                    val accepted = result.shouldBeInstanceOf<EntryTimingResult.Accepted>()
                    accepted.timing shouldBe EntryTiming.BackDated(case.lag, ClinicalTimeSource.ENTERED)
                    accepted.timing.code shouldBe EntryTimingCode.BACK_DATED
                    accepted.timing.requirements shouldBe
                        setOf(
                            TimingRequirement.BACK_DATING_AUTHORIZATION,
                            TimingRequirement.USER_ENTERED_REASON,
                            TimingRequirement.AUDIT_BOTH_TIMES,
                            TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT,
                        )
                    accepted.validTime shouldBe case.given
                    accepted.policy shouldBe case.policy
                }
            }
        }

        test("kernel-entry-timing-back-entry-keeps-clinical-time: kept; refused without an episode or outside its window") {
            val pastLags = { _: EntryTimePolicy -> arbitrary { micros(Arb.long(0L..MAX_RANDOM_LAG_MICROS).bind()) } }
            checkAll(budget, cases(Arb.element(BACK_ENTRY), Arb.element(CLINICAL.toList()), true, pastLags)) { case ->
                val result = case.classify()
                when {
                    case.laterThan(Duration.ZERO) -> {
                        result shouldBe EntryTimingResult.Refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)
                    }

                    case.episode == null -> {
                        result shouldBe EntryTimingResult.Refused(EntryTimeRefusal.BACK_ENTRY_WITHOUT_EPISODE)
                    }

                    case.episode.window.contains(requireNotNull(case.given).start.instant) -> {
                        val accepted = result.shouldBeInstanceOf<EntryTimingResult.Accepted>()
                        accepted.validTime shouldBe case.given
                        accepted.validTime.start.offset shouldBe requireNotNull(case.given).start.offset
                        accepted.timing shouldBe EntryTiming.BackEntry(case.lag, case.episode.episodeId)
                        accepted.timing.code shouldBe EntryTimingCode.BACK_ENTRY
                        accepted.timing.code.labelled shouldBe true
                        accepted.policy shouldBe null
                    }

                    else -> {
                        result shouldBe EntryTimingResult.Refused(EntryTimeRefusal.OUTSIDE_BACK_ENTRY_WINDOW)
                    }
                }
            }
        }

        test("kernel-entry-timing-future-refused: every mode refuses a clinical start or end beyond its future bound") {
            checkAll(budget, cases(kinds = Arb.element(CLINICAL.toList()), givenOnly = true, alwaysAvailable = true)) { case ->
                val bound = if (case.mode in POLICY_MODES) case.policy.futureTolerance else Duration.ZERO
                val result = case.classify()
                if (case.laterThan(bound)) {
                    val reason = if (case.mode == SYSTEM) EntryTimeRefusal.SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME else FUTURE
                    result shouldBe EntryTimingResult.Refused(reason)
                } else {
                    (result == EntryTimingResult.Refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)) shouldBe false
                }
            }
        }

        test("kernel-entry-timing-interface-late-arrival: within lateness Contemporaneous with the channel source, beyond it LateArrival") {
            checkAll(budget, cases(Arb.element(DEVICE, INTERFACE), Arb.element(CLINICAL.toList()), true, alwaysAvailable = true)) { case ->
                if (!case.laterThan(case.policy.futureTolerance)) {
                    val source = channelSource(case.mode)
                    val timing = case.classify().shouldBeInstanceOf<EntryTimingResult.Accepted>().timing
                    if (case.lag <= case.policy.interfaceLatenessTolerance) {
                        timing shouldBe EntryTiming.Contemporaneous(source)
                    } else {
                        timing shouldBe EntryTiming.LateArrival(case.lag, source)
                        timing.requirements shouldBe
                            setOf(
                                TimingRequirement.CHANNEL_IDENTITY,
                                TimingRequirement.AUDIT_BOTH_TIMES,
                                TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT,
                            )
                    }
                }
            }
        }

        test("kernel-entry-timing-migration-keeps-original-times: MIGRATION keeps the given times and is Migrated for any past lag") {
            val pastLags = { _: EntryTimePolicy -> arbitrary { micros(Arb.long(0L..MAX_RANDOM_LAG_MICROS * 1_000).bind()) } }
            checkAll(budget, cases(Arb.element(MIGRATION), Arb.element(CLINICAL.toList()), true, pastLags)) { case ->
                if (!case.laterThan(Duration.ZERO)) {
                    val accepted = case.classify().shouldBeInstanceOf<EntryTimingResult.Accepted>()
                    accepted.validTime shouldBe case.given
                    accepted.timing shouldBe EntryTiming.Migrated(case.lag)
                    accepted.timing.source shouldBe ClinicalTimeSource.MIGRATED
                    accepted.policy shouldBe null
                }
            }
        }

        test("kernel-entry-timing-offline-capture: within its tolerance OfflineCapture, beyond it Refused(OFFLINE_CAPTURE_TOO_LATE)") {
            checkAll(budget, cases(Arb.element(OFFLINE_CAPTURE), Arb.element(CLINICAL.toList()), true, alwaysAvailable = true)) { case ->
                if (!case.laterThan(case.policy.futureTolerance)) {
                    val result = case.classify()
                    if (case.lag <= case.policy.offlineCaptureTolerance) {
                        val accepted = result.shouldBeInstanceOf<EntryTimingResult.Accepted>()
                        accepted.timing shouldBe EntryTiming.OfflineCapture(case.lag)
                        accepted.validTime shouldBe case.given
                    } else {
                        result shouldBe EntryTimingResult.Refused(EntryTimeRefusal.OFFLINE_CAPTURE_TOO_LATE)
                    }
                }
            }
        }

        test("kernel-at-recording-only-where-declared: only for declared kinds and USER or SYSTEM; stamped with the recorded time") {
            checkAll(budget, cases()) { case ->
                val result = case.classify()
                when {
                    case.input == ValidTimeInput.AtRecording && case.kind == CLINICAL_CAPTURED -> {
                        result shouldBe EntryTimingResult.Refused(EntryTimeRefusal.CAPTURE_TIME_REQUIRED)
                    }

                    case.input == ValidTimeInput.AtRecording && case.kind == CLINICAL_AT_RECORDING && case.mode !in setOf(USER, SYSTEM) -> {
                        result shouldBe EntryTimingResult.Refused(EntryTimeRefusal.CAPTURE_TIME_REQUIRED)
                    }

                    case.input == ValidTimeInput.AtRecording -> {
                        val accepted = result.shouldBeInstanceOf<EntryTimingResult.Accepted>()
                        accepted.validTime.start.instant shouldBe case.recorded.instant
                        accepted.validTime.start.offset shouldBe ZoneOffset.UTC
                        accepted.validTime.endExclusive shouldBe null
                        accepted.timing.source shouldBe
                            if (case.kind == EFFECTIVE) ClinicalTimeSource.EFFECTIVE_DATE else ClinicalTimeSource.AT_RECORDING
                    }

                    case.mode == SYSTEM && case.kind in CLINICAL -> {
                        result shouldBe EntryTimingResult.Refused(EntryTimeRefusal.SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME)
                    }

                    result is EntryTimingResult.Accepted -> {
                        result.validTime shouldBe case.given
                        (result.timing.source == ClinicalTimeSource.AT_RECORDING) shouldBe false
                    }
                }
            }
        }
    })
