package hms.kernel.time

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
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

/**
 * Every row of the platform-kernel.md §6.2 classification table, with its boundaries (SI-10; CTRL-0010-3,
 * CTRL-0010-4, CTRL-0010-5, CTRL-0010-1). The property tests check the same table on random inputs.
 */
class EntryTimeClassifierTest :
    FunSpec({
        val recordedInstant = Instant.parse("2026-10-19T05:00:00Z")
        val recorded = TimeFixtures.recordedAt(recordedInstant)
        val micro = Duration.ofNanos(1000)
        val contemporaneous = Duration.ofMinutes(5)
        val future = Duration.ofMinutes(2)
        val lateness = Duration.ofMinutes(15)
        val offline = Duration.ofHours(24)
        val policy = TimeFixtures.policy(contemporaneous, future, lateness, offline)
        val available = EntryTimePolicyLookup.Available(policy)
        val notConfigured = EntryTimePolicyLookup.NotConfigured(TimeFixtures.VITAL_SIGN, EntryTimePolicy.keys(TimeFixtures.VITAL_SIGN))
        val episodeId = UUID.fromString("01890a5d-ac96-7a4b-8cce-b302099a8057")
        val windowStart = recordedInstant.minus(Duration.ofHours(6))
        val windowEnd = recordedInstant.minus(Duration.ofHours(1))
        val episode = TimeFixtures.episode(windowStart, windowEnd, episodeId)
        val stamped = ValidTime.from(ClinicalTime.of(recordedInstant, ZoneOffset.UTC))
        val clinicalKinds = listOf(CLINICAL_CAPTURED, CLINICAL_AT_RECORDING)

        /** A given open valid time starting [lag] before the recorded time (negative: after). */
        fun lagged(lag: Duration): ValidTimeInput.Given = TimeFixtures.given(TimeFixtures.clinical(recordedInstant.minus(lag)))

        fun classify(
            input: ValidTimeInput,
            kind: ValidTimeKind,
            mode: EntryMode,
            lookup: EntryTimePolicyLookup = available,
            backEntryEpisode: BackEntryEpisode? = episode,
        ): EntryTimingResult = EntryTimeClassifier.classify(input, kind, recorded, mode, lookup, backEntryEpisode)

        fun accepted(
            timing: EntryTiming,
            input: ValidTimeInput.Given,
            withPolicy: Boolean,
        ) = EntryTimingResult.Accepted(timing, input.validTime, if (withPolicy) policy else null)

        fun refused(reason: EntryTimeRefusal) = EntryTimingResult.Refused(reason)

        test("kernel-entry-timing-table row 1: a retroactive EFFECTIVE start is BackDated(EFFECTIVE_DATE) in every mode") {
            EntryMode.entries.forEach { mode ->
                val input = lagged(micro)
                withClue(mode) {
                    classify(input, EFFECTIVE, mode, EntryTimePolicyLookup.NotLookedUp, null) shouldBe
                        accepted(EntryTiming.BackDated(micro, ClinicalTimeSource.EFFECTIVE_DATE), input, false)
                }
            }
        }

        test("kernel-entry-timing-table row 2: EFFECTIVE not earlier than recorded, or AtRecording, is EffectiveDated") {
            EntryMode.entries.forEach { mode ->
                withClue(mode) {
                    listOf(lagged(Duration.ZERO), lagged(Duration.ofDays(-30))).forEach { input ->
                        classify(input, EFFECTIVE, mode, EntryTimePolicyLookup.Unavailable, null) shouldBe
                            accepted(EntryTiming.EffectiveDated, input, false)
                    }
                    classify(ValidTimeInput.AtRecording, EFFECTIVE, mode) shouldBe
                        EntryTimingResult.Accepted(EntryTiming.EffectiveDated, stamped, null)
                }
            }
        }

        test("kernel-entry-timing-table row 3: AtRecording on CLINICAL_CAPTURED is refused in every mode") {
            EntryMode.entries.forEach { mode ->
                withClue(mode) {
                    classify(ValidTimeInput.AtRecording, CLINICAL_CAPTURED, mode) shouldBe refused(EntryTimeRefusal.CAPTURE_TIME_REQUIRED)
                }
            }
        }

        test("kernel-entry-timing-table row 4: AtRecording is refused for offline, back-entry, device, interface and migration") {
            listOf(OFFLINE_CAPTURE, BACK_ENTRY, DEVICE, INTERFACE, MIGRATION).forEach { mode ->
                withClue(mode) {
                    classify(ValidTimeInput.AtRecording, CLINICAL_AT_RECORDING, mode) shouldBe
                        refused(EntryTimeRefusal.CAPTURE_TIME_REQUIRED)
                }
            }
        }

        test("kernel-entry-timing-table row 5: USER or SYSTEM AtRecording on CLINICAL_AT_RECORDING is stamped and Contemporaneous") {
            listOf(USER, SYSTEM).forEach { mode ->
                withClue(mode) {
                    classify(ValidTimeInput.AtRecording, CLINICAL_AT_RECORDING, mode, EntryTimePolicyLookup.NotLookedUp) shouldBe
                        EntryTimingResult.Accepted(EntryTiming.Contemporaneous(ClinicalTimeSource.AT_RECORDING), stamped, null)
                }
            }
        }

        test("kernel-entry-timing-table row 6: SYSTEM with a given clinical time is refused, even with a policy") {
            clinicalKinds.forEach { kind ->
                classify(lagged(Duration.ZERO), kind, SYSTEM) shouldBe refused(EntryTimeRefusal.SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME)
            }
        }

        test("kernel-entry-timing-table row 7: no policy refuses USER, offline, device and interface, before the future check") {
            listOf(USER, OFFLINE_CAPTURE, DEVICE, INTERFACE).forEach { mode ->
                clinicalKinds.forEach { kind ->
                    listOf(notConfigured, EntryTimePolicyLookup.Unavailable, EntryTimePolicyLookup.NotLookedUp).forEach { lookup ->
                        listOf(lagged(Duration.ZERO), lagged(Duration.ofDays(-1))).forEach { input ->
                            withClue("$mode $kind $lookup") {
                                classify(input, kind, mode, lookup) shouldBe refused(EntryTimeRefusal.TIMING_POLICY_NOT_CONFIGURED)
                            }
                        }
                    }
                }
            }
        }

        test("kernel-entry-timing-table row 8: a start or end beyond the future tolerance is refused; at the tolerance it is accepted") {
            listOf(USER, OFFLINE_CAPTURE, DEVICE, INTERFACE).forEach { mode ->
                withClue(mode) {
                    classify(lagged(future.negated().minus(micro)), CLINICAL_CAPTURED, mode) shouldBe
                        refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)
                    (classify(lagged(future.negated()), CLINICAL_CAPTURED, mode) is EntryTimingResult.Accepted) shouldBe true
                    val endTooLate =
                        TimeFixtures.given(
                            TimeFixtures.clinical(recordedInstant.minusSeconds(60)),
                            TimeFixtures.clinical(recordedInstant.plus(future).plus(micro)),
                        )
                    classify(endTooLate, CLINICAL_AT_RECORDING, mode) shouldBe refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)
                    val endAtBound =
                        TimeFixtures.given(
                            TimeFixtures.clinical(recordedInstant.minusSeconds(60)),
                            TimeFixtures.clinical(recordedInstant.plus(future)),
                        )
                    (classify(endAtBound, CLINICAL_AT_RECORDING, mode) is EntryTimingResult.Accepted) shouldBe true
                }
            }
        }

        test("kernel-entry-timing-table row 9: back-entry and migration refuse a start or end later than recorded by any amount") {
            listOf(BACK_ENTRY, MIGRATION).forEach { mode ->
                withClue(mode) {
                    classify(lagged(micro.negated()), CLINICAL_CAPTURED, mode, backEntryEpisode = null) shouldBe
                        refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)
                    val endLater =
                        TimeFixtures.given(TimeFixtures.clinical(windowStart), TimeFixtures.clinical(recordedInstant.plus(micro)))
                    classify(endLater, CLINICAL_CAPTURED, mode) shouldBe refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)
                    val endAtRecorded = TimeFixtures.given(TimeFixtures.clinical(windowStart), TimeFixtures.clinical(recordedInstant))
                    (classify(endAtRecorded, CLINICAL_CAPTURED, mode) is EntryTimingResult.Accepted) shouldBe true
                }
            }
        }

        test("kernel-entry-timing-table rows 10 and 11: USER within the contemporaneous tolerance, then BackDated(ENTERED)") {
            listOf(Duration.ZERO, contemporaneous, future.negated(), Duration.ofSeconds(1)).forEach { lag ->
                val input = lagged(lag)
                classify(input, CLINICAL_CAPTURED, USER) shouldBe
                    accepted(EntryTiming.Contemporaneous(ClinicalTimeSource.ENTERED), input, true)
            }
            val late = contemporaneous.plus(micro)
            val input = lagged(late)
            classify(input, CLINICAL_AT_RECORDING, USER) shouldBe
                accepted(EntryTiming.BackDated(late, ClinicalTimeSource.ENTERED), input, true)
        }

        test("kernel-entry-timing-table rows 12 and 13: offline capture within its tolerance, then refused as too late") {
            listOf(Duration.ZERO, offline, future.negated(), Duration.ofHours(3)).forEach { lag ->
                val input = lagged(lag)
                classify(input, CLINICAL_CAPTURED, OFFLINE_CAPTURE) shouldBe accepted(EntryTiming.OfflineCapture(lag), input, true)
            }
            classify(lagged(offline.plus(micro)), CLINICAL_CAPTURED, OFFLINE_CAPTURE) shouldBe
                refused(EntryTimeRefusal.OFFLINE_CAPTURE_TOO_LATE)
        }

        test("kernel-entry-timing-table rows 14 to 16: back-entry needs an episode and a start inside its window") {
            classify(lagged(Duration.ofHours(2)), CLINICAL_CAPTURED, BACK_ENTRY, backEntryEpisode = null) shouldBe
                refused(EntryTimeRefusal.BACK_ENTRY_WITHOUT_EPISODE)
            listOf(Duration.ofHours(6), Duration.ofHours(2), Duration.ofHours(1).plus(micro)).forEach { lag ->
                val input = lagged(lag)
                classify(input, CLINICAL_CAPTURED, BACK_ENTRY, EntryTimePolicyLookup.NotLookedUp) shouldBe
                    accepted(EntryTiming.BackEntry(lag, episodeId), input, false)
            }
            listOf(Duration.ofHours(1), Duration.ofHours(6).plus(micro), Duration.ZERO).forEach { lag ->
                classify(lagged(lag), CLINICAL_AT_RECORDING, BACK_ENTRY) shouldBe refused(EntryTimeRefusal.OUTSIDE_BACK_ENTRY_WINDOW)
            }
        }

        test("kernel-entry-timing-table rows 17 and 18: device and interface within the lateness tolerance, then LateArrival") {
            mapOf(DEVICE to ClinicalTimeSource.DEVICE, INTERFACE to ClinicalTimeSource.INTERFACE).forEach { (mode, source) ->
                listOf(Duration.ZERO, lateness, future.negated()).forEach { lag ->
                    val input = lagged(lag)
                    classify(input, CLINICAL_CAPTURED, mode) shouldBe accepted(EntryTiming.Contemporaneous(source), input, true)
                }
                val late = lateness.plus(micro)
                val input = lagged(late)
                classify(input, CLINICAL_CAPTURED, mode) shouldBe accepted(EntryTiming.LateArrival(late, source), input, true)
            }
        }

        test("kernel-entry-timing-table row 19: migration keeps the original time for any past lag, without a policy") {
            listOf(Duration.ZERO, micro, Duration.ofDays(3650)).forEach { lag ->
                val input = lagged(lag)
                classify(input, CLINICAL_CAPTURED, MIGRATION, EntryTimePolicyLookup.Unavailable) shouldBe
                    accepted(EntryTiming.Migrated(lag), input, false)
            }
        }

        test("kernel-entry-timing-requirements: the requirement set of every accepted result is the §6.2 table's") {
            val audited = setOf(TimingRequirement.AUDIT_BOTH_TIMES, TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT)
            EntryTiming.Contemporaneous(ClinicalTimeSource.ENTERED).requirements shouldBe emptySet()
            EntryTiming.EffectiveDated.requirements shouldBe emptySet()
            listOf(ClinicalTimeSource.ENTERED, ClinicalTimeSource.EFFECTIVE_DATE).forEach { source ->
                EntryTiming.BackDated(micro, source).requirements shouldBe
                    audited + setOf(TimingRequirement.BACK_DATING_AUTHORIZATION, TimingRequirement.USER_ENTERED_REASON)
            }
            EntryTiming.BackEntry(micro, episodeId).requirements shouldBe audited + TimingRequirement.BACK_ENTRY_AUTHORITY
            EntryTiming.OfflineCapture(micro).requirements shouldBe audited + TimingRequirement.CHANNEL_IDENTITY
            EntryTiming.LateArrival(micro, ClinicalTimeSource.DEVICE).requirements shouldBe audited + TimingRequirement.CHANNEL_IDENTITY
            EntryTiming.Migrated(micro).requirements shouldBe audited + TimingRequirement.MIGRATION_PROVENANCE
        }

        test("kernel-entry-timing-requirements: codes and stored sources are fixed per result") {
            EntryTiming.Contemporaneous(ClinicalTimeSource.DEVICE).code shouldBe EntryTimingCode.CONTEMPORANEOUS
            EntryTiming.BackDated(micro, ClinicalTimeSource.ENTERED).code shouldBe EntryTimingCode.BACK_DATED
            EntryTiming.BackEntry(micro, episodeId).let { it.code to it.source } shouldBe
                (EntryTimingCode.BACK_ENTRY to ClinicalTimeSource.ENTERED)
            EntryTiming.OfflineCapture(micro).let { it.code to it.source } shouldBe
                (EntryTimingCode.OFFLINE_CAPTURE to ClinicalTimeSource.ENTERED)
            EntryTiming.LateArrival(micro, ClinicalTimeSource.INTERFACE).code shouldBe EntryTimingCode.LATE_ARRIVAL
            EntryTiming.Migrated(micro).let { (it.code to it.source) shouldBe (EntryTimingCode.MIGRATED to ClinicalTimeSource.MIGRATED) }
            EntryTiming.EffectiveDated.let {
                (it.code to it.source) shouldBe (EntryTimingCode.EFFECTIVE_DATED to ClinicalTimeSource.EFFECTIVE_DATE)
            }
        }

        test("kernel-entry-timing-requirements: a result with a source or lag the table does not allow cannot be built") {
            listOf(ClinicalTimeSource.MIGRATED, ClinicalTimeSource.EFFECTIVE_DATE).forEach {
                shouldThrow<IllegalArgumentException> { EntryTiming.Contemporaneous(it) }
            }
            shouldThrow<IllegalArgumentException> { EntryTiming.BackDated(micro, ClinicalTimeSource.DEVICE) }
            shouldThrow<IllegalArgumentException> { EntryTiming.BackDated(Duration.ZERO, ClinicalTimeSource.ENTERED) }
            shouldThrow<IllegalArgumentException> { EntryTiming.LateArrival(micro, ClinicalTimeSource.ENTERED) }
            shouldThrow<IllegalArgumentException> { EntryTiming.LateArrival(Duration.ZERO, ClinicalTimeSource.DEVICE) }
            shouldThrow<IllegalArgumentException> { EntryTiming.BackEntry(micro.negated(), episodeId) }
            shouldThrow<IllegalArgumentException> { EntryTiming.Migrated(micro.negated()) }
        }

        test("kernel-entry-timing-refused-without-policy: NotConfigured, Unavailable and NotLookedUp refuse wherever a policy is needed") {
            val lookups = listOf(notConfigured, EntryTimePolicyLookup.Unavailable, EntryTimePolicyLookup.NotLookedUp)
            val inputs =
                listOf(lagged(Duration.ZERO), lagged(Duration.ofHours(1)), lagged(Duration.ofMinutes(-1)), ValidTimeInput.AtRecording)
            EntryMode.entries.forEach { mode ->
                ValidTimeKind.entries.forEach { kind ->
                    inputs.forEach { input ->
                        lookups.forEach { lookup ->
                            val result = classify(input, kind, mode, lookup)
                            val policyRefusal = result == refused(EntryTimeRefusal.TIMING_POLICY_NOT_CONFIGURED)
                            withClue("$mode $kind $input $lookup -> $result") {
                                policyRefusal shouldBe EntryTimeClassifier.needsPolicy(input, kind, mode)
                            }
                        }
                    }
                }
            }
        }

        test("kernel-entry-timing-refused-without-policy: needsPolicy agrees with the table's Policy column") {
            val needed = setOf(USER, OFFLINE_CAPTURE, DEVICE, INTERFACE)
            EntryMode.entries.forEach { mode ->
                ValidTimeKind.entries.forEach { kind ->
                    withClue("$mode $kind") {
                        EntryTimeClassifier.needsPolicy(lagged(Duration.ZERO), kind, mode) shouldBe (kind != EFFECTIVE && mode in needed)
                        EntryTimeClassifier.needsPolicy(ValidTimeInput.AtRecording, kind, mode) shouldBe false
                    }
                }
            }
        }

        test("kernel-entry-timing-refused-without-policy: an accepted result carries the policy only where one was needed") {
            val result = classify(lagged(Duration.ZERO), CLINICAL_CAPTURED, USER) as EntryTimingResult.Accepted
            result.policy shouldBe policy
            result.policy?.sources?.map { it.key } shouldBe EntryTimePolicy.keys(TimeFixtures.VITAL_SIGN)
            (classify(lagged(Duration.ZERO), CLINICAL_CAPTURED, MIGRATION) as EntryTimingResult.Accepted).policy shouldBe null
        }

        test("kernel-entry-timing-codes-closed: EntryTimingCode has exactly the seven stored values") {
            EntryTimingCode.entries.associate { it.name to it.labelled } shouldBe
                linkedMapOf(
                    "CONTEMPORANEOUS" to false,
                    "BACK_DATED" to true,
                    "BACK_ENTRY" to true,
                    "OFFLINE_CAPTURE" to true,
                    "LATE_ARRIVAL" to true,
                    "MIGRATED" to true,
                    "EFFECTIVE_DATED" to false,
                )
            ClinicalTimeSource.entries.map { it.name } shouldBe
                listOf("ENTERED", "DEVICE", "INTERFACE", "AT_RECORDING", "MIGRATED", "EFFECTIVE_DATE")
        }

        test("TimingClass names follow [a-z][a-z0-9-]*") {
            TimingClass("vital-sign-2").name shouldBe "vital-sign-2"
            listOf("", "Vital", "1vital", "vital_sign", "vital sign", "-vital").forEach {
                shouldThrow<IllegalArgumentException> { TimingClass(it) }
            }
        }
    })
