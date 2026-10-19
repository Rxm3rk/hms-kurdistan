package hms.results.domain.result

import io.kotest.property.Arb
import io.kotest.property.RandomSource
import io.kotest.property.Sample
import java.time.Duration
import java.time.Instant
import kotlin.random.Random

/**
 * The facts generator of the result machine (docs/specs/modules/state-machines-and-invariants.md §2.3, §3.3). Synthetic
 * `SYN-` facts only, NOT FOR CLINICAL USE.
 *
 * Each draw starts from parts under which every positive predicate holds ([ResultSamples]) and replaces each part, with a
 * small probability, by one of its failing or boundary variants: a validation for another version, one recorded a second
 * before the last change or after now, a system, integration or AI account, a rejected, lost, cancelled, entered-in-error
 * or unknown specimen, failed, unknown or overdue QC (including validity ending exactly at the measurement or at now), a
 * missing reference-laboratory identification, an unresolved encounter link, a defaulted or text-only reason, a Register
 * entry with another status, an expired opinion (expiry exactly at now), another scope, purpose or rule-set version.
 * Whether a value is critical and whether the patient is discharged are each a fair coin over several variants, so both
 * alternatives of every split fire. The probabilities are tuned so that every transition fires at least once in 1,000
 * sequences (property P7) while refusals stay common.
 */
object ResultArbs {
    /** Facts for one step of a result sequence. */
    val facts: Arb<ResultFacts> =
        object : Arb<ResultFacts>() {
            override fun edgecase(rs: RandomSource): Sample<ResultFacts> = sample(rs)

            override fun sample(rs: RandomSource): Sample<ResultFacts> = Sample(FactsDraw(rs.random).facts())
        }
}

/** One draw of [ResultArbs.facts] from one random source. */
@Suppress("TooManyFunctions") // One small function per part of the facts keeps each variant list readable.
private class FactsDraw(
    private val random: Random,
) {
    private val now: Instant = ResultSamples.NOW

    fun facts(): ResultFacts {
        val user = user()
        val version = if (chance(P_VERSION)) version() else null
        val currentVersionId = if (chance(P_CURRENT_VERSION)) ResultSamples.CURRENT_VERSION_ID else null
        return ResultFacts(
            now = now,
            resultId = ResultSamples.RESULT_ID,
            test = ResultSamples.TEST,
            currentVersionId = currentVersionId,
            versionBeingFiled = version,
            actingUser = user,
            validation = validation(version),
            validationPrivilege = validationPrivilege(),
            actionPrivilege = actionPrivilege(),
            audit = audit(currentVersionId),
            specimens = specimens(version),
            encounter = encounter(),
            correctionReason = reason(P_CORRECTION_REASON, ResultSamples.CORRECTION_REASON, ResultSamples.CANCELLATION_CODE),
            cancellationReason = reason(P_CANCELLATION_REASON, ResultSamples.CANCELLATION_REASON, ResultSamples.ERROR_CODE),
            errorReason = reason(P_ERROR_REASON, ResultSamples.ERROR_REASON, ResultSamples.CORRECTION_CODE),
            governedReasons = ResultSamples.GOVERNED_REASONS,
            autoverification = autoverification(version),
        )
    }

    private fun chance(probability: Double): Boolean = random.nextDouble() < probability

    private fun <T> pick(vararg choices: T): T = choices[random.nextInt(choices.size)]

    private fun <T> pickOf(choices: List<T>): T = choices[random.nextInt(choices.size)]

    private fun user(): ActingUser? =
        if (chance(P_GOOD)) {
            ResultSamples.USER
        } else {
            pick(
                ActingUser(ResultSamples.USER_ID, AccountKind.SYSTEM, authenticated = true),
                ActingUser(ResultSamples.USER_ID, AccountKind.INTEGRATION, authenticated = true),
                ActingUser(ResultSamples.USER_ID, AccountKind.AI_AGENT, authenticated = true),
                ActingUser(ResultSamples.USER_ID, AccountKind.HUMAN, authenticated = false),
                null,
            )
        }

    private fun version(): FiledVersion {
        val count = random.nextInt(1, MAX_VALUES + 1)
        val critical = if (chance(P_CRITICAL)) random.nextInt(count) else NONE
        val values = List(count) { index -> value(index, critical = index == critical) }
        return FiledVersion(ResultSamples.FILED_VERSION_ID, ResultSamples.LAST_VALUE_CHANGE, values)
    }

    private fun value(
        index: Int,
        critical: Boolean,
    ): ResultValue {
        val change =
            pick(
                ValueChange.NEW_MEASUREMENT,
                ValueChange.NEW_MEASUREMENT,
                ValueChange.CHANGED_WITHOUT_NEW_MEASUREMENT,
                ValueChange.CARRIED_UNCHANGED,
            )
        val performer = if (chance(P_IN_HOUSE)) inHouse() else referenceLaboratory()
        val verdict =
            if (critical) {
                pick(
                    CriticalVerdict.CRITICAL,
                    CriticalVerdict.CRITICAL,
                    CriticalVerdict.NOT_EVALUATED_TEST_NOT_IN_POLICY,
                    CriticalVerdict.NOT_EVALUATED_CONTEXT_MISSING,
                    CriticalVerdict.NOT_CRITICAL,
                )
            } else {
                pick(CriticalVerdict.NOT_CRITICAL, CriticalVerdict.NO_CRITICAL_LIMITS)
            }
        // A critical value whose verdict is not critical is one the technologist marked critical.
        val marked = critical && verdict == CriticalVerdict.NOT_CRITICAL
        val specimenId = if (chance(P_GOOD_PART)) "${ResultSamples.SPECIMEN_ID}-$index" else pick(null, " ")
        return ResultValue("SYN-VAL-$index", change, specimenId, performer, verdict, marked)
    }

    private fun inHouse(): Performer.InHouse {
        val measuredAt = ResultSamples.MEASURED_AT
        return Performer.InHouse(measuredAt, qc(measuredAt), qc(now))
    }

    /** QC that covers [instant], or one of its failing or boundary variants. */
    private fun qc(instant: Instant): QcRecord? {
        val hour = Duration.ofHours(1)
        return if (chance(P_GOOD_PART)) {
            pick(
                QcRecord(QcStatus.PASSED, instant.minus(hour), instant.plus(hour)),
                QcRecord(QcStatus.PASSED, instant, instant.plusSeconds(1)),
            )
        } else {
            pick(
                QcRecord(QcStatus.PASSED, instant.minus(hour), instant),
                QcRecord(QcStatus.PASSED, instant.plusSeconds(1), instant.plus(hour)),
                QcRecord(QcStatus.FAILED, instant.minus(hour), instant.plus(hour)),
                QcRecord(QcStatus.UNKNOWN, instant.minus(hour), instant.plus(hour)),
                QcRecord(QcStatus.PASSED, null, instant.plus(hour)),
                QcRecord(QcStatus.PASSED, instant.minus(hour), null),
                null,
            )
        }
    }

    private fun referenceLaboratory(): Performer.ReferenceLaboratory =
        Performer.ReferenceLaboratory(
            laboratoryId = if (chance(P_GOOD_PART)) "SYN-REFLAB-01" else pick(null, ""),
            laboratorySpecimenRef = if (chance(P_GOOD_PART)) "SYN-REFLAB-SPEC-01" else pick(null, ""),
        )

    private fun specimens(version: FiledVersion?): Map<String, SpecimenStatus> =
        version
            ?.values
            ?.mapNotNull { it.specimenId }
            ?.filter { chance(P_GOOD_PART) || chance(HALF) }
            ?.associateWith { if (chance(P_GOOD_PART)) pickOf(USABLE_SPECIMEN_STATES) else pickOf(UNUSABLE_SPECIMEN_STATES) }
            .orEmpty()

    private fun validation(version: FiledVersion?): TechnologistValidation? {
        val versionId = version?.versionId ?: ResultSamples.FILED_VERSION_ID
        val changed = version?.lastValueChangeAt ?: ResultSamples.LAST_VALUE_CHANGE
        return if (chance(P_GOOD)) {
            TechnologistValidation(versionId, ResultSamples.USER_ID, pick(changed, now, now.minusSeconds(1)))
        } else {
            pick(
                TechnologistValidation(ResultSamples.CURRENT_VERSION_ID, ResultSamples.USER_ID, now),
                TechnologistValidation(versionId, ResultSamples.USER_ID, changed.minusSeconds(1)),
                TechnologistValidation(versionId, ResultSamples.USER_ID, now.plusSeconds(1)),
                TechnologistValidation(versionId, ResultSamples.OTHER_USER_ID, now),
                null,
            )
        }
    }

    private fun validationPrivilege(): ValidationPrivilege? {
        val section = ResultSamples.TEST.laboratorySection
        return if (chance(P_GOOD)) {
            ValidationPrivilege(ResultSamples.USER_ID, section, granted = true)
        } else {
            pick(
                ValidationPrivilege(ResultSamples.USER_ID, section, granted = false),
                ValidationPrivilege(ResultSamples.USER_ID, "SYN-SECTION-HAEM", granted = true),
                ValidationPrivilege(ResultSamples.OTHER_USER_ID, section, granted = true),
                null,
            )
        }
    }

    private fun actionPrivilege(): ActionPrivilege? =
        if (chance(P_GOOD)) {
            ActionPrivilege(ResultSamples.USER_ID, ResultSamples.RESULT_ID, granted = true)
        } else {
            pick(
                ActionPrivilege(ResultSamples.USER_ID, ResultSamples.RESULT_ID, granted = false),
                ActionPrivilege(ResultSamples.USER_ID, "SYN-RES-0002", granted = true),
                ActionPrivilege(ResultSamples.OTHER_USER_ID, ResultSamples.RESULT_ID, granted = true),
                null,
            )
        }

    private fun audit(currentVersionId: String?): AuditContext? {
        val user = ResultSamples.USER_ID
        val result = ResultSamples.RESULT_ID
        return if (chance(P_GOOD)) {
            AuditContext(user, pick(now, now.minusSeconds(1)), result, currentVersionId)
        } else {
            pick(
                AuditContext(user, now.plusSeconds(1), result, currentVersionId),
                AuditContext(null, now, result, currentVersionId),
                AuditContext(ResultSamples.OTHER_USER_ID, now, result, currentVersionId),
                AuditContext(user, null, result, currentVersionId),
                AuditContext(user, now, null, currentVersionId),
                AuditContext(user, now, result, if (currentVersionId == null) ResultSamples.CURRENT_VERSION_ID else null),
                null,
            )
        }
    }

    private fun encounter(): EncounterLink =
        if (chance(HALF)) {
            pick(
                EncounterLink.NoEncounterRecorded,
                EncounterLink.Resolved(EncounterClass.OUTPATIENT, pickOf(EncounterStatus.entries)),
                EncounterLink.Resolved(pickOf(ADMITTING_CLASSES), pickOf(ACTIVE_ENCOUNTER_STATES)),
            )
        } else {
            pick(
                EncounterLink.Missing,
                EncounterLink.Unresolved,
                EncounterLink.Resolved(EncounterClass.UNKNOWN, pickOf(EncounterStatus.entries)),
                EncounterLink.Resolved(pickOf(ADMITTING_CLASSES), pickOf(ENDED_ENCOUNTER_STATES)),
            )
        }

    /** A chosen reason ([good]) with probability [probability], else a variant that must not count. */
    private fun reason(
        probability: Double,
        good: ReasonEntry,
        codeFromAnotherList: String,
    ): ReasonEntry? =
        if (chance(probability)) {
            good
        } else {
            pick(
                good.copy(selection = ReasonSelection.PRESELECTED),
                good.copy(selection = ReasonSelection.DEFAULTED),
                ReasonEntry(code = null, ReasonSelection.USER_SELECTED, text = "SYN free text only"),
                ReasonEntry(code = " ", ReasonSelection.USER_SELECTED, text = null),
                ReasonEntry(codeFromAnotherList, ReasonSelection.USER_SELECTED, text = null),
                null,
            )
        }

    private fun autoverification(version: FiledVersion?): AutoverificationFacts {
        val good = ResultSamples.AUTOVERIFICATION
        val verdict = verdict(version)
        val entry = if (chance(P_REGISTER_ENTRY_GOOD)) good.registerEntry else registerEntryVariant()
        return good.copy(tenantFlagOn = chance(P_FLAG_ON), registerEntry = entry, verdict = verdict)
    }

    private fun verdict(version: FiledVersion?): RulesVerdict? {
        val good = ResultSamples.VERDICT.copy(versionId = version?.versionId ?: ResultSamples.FILED_VERSION_ID)
        return if (chance(P_VERDICT_GOOD)) {
            good
        } else {
            pick(
                good.copy(outcome = RulesOutcome.HOLD),
                good.copy(versionId = ResultSamples.CURRENT_VERSION_ID),
                good.copy(ruleSetVersion = null),
                good.copy(ruleSetVersion = "SYN-RULESET-8"),
                good.copy(rulesRun = AutoverificationRule.entries.dropLast(1)),
                good.copy(rulesRun = AutoverificationRule.entries.reversed()),
                null,
            )
        }
    }

    private fun registerEntryVariant(): RegisterEntry? {
        val entry = ResultSamples.REGISTER_ENTRY
        val opinion = checkNotNull(entry.opinion)
        return pick(
            null,
            entry.copy(function = "SYN-reg-other-function"),
            entry.copy(functionVersion = "SYN-REG-LIS-RULES-1.2.0"),
            entry.copy(jurisdiction = "SYN-JURISDICTION-OTHER"),
            entry.copy(status = RegisterStatus.NOT_ASSESSED),
            entry.copy(status = RegisterStatus.REQUIRED),
            entry.copy(status = RegisterStatus.WITHDRAWN),
            entry.copy(status = RegisterStatus.NOT_REQUIRED),
            entry.copy(opinion = null),
            entry.copy(opinion = opinion.copy(documentRef = null)),
            entry.copy(opinion = opinion.copy(expiresAt = now)),
            entry.copy(opinion = opinion.copy(expiresAt = null)),
            entry.copy(opinion = opinion.copy(scope = setOf(ResultSamples.TEST.copy(analyser = "SYN-ANALYSER-02")))),
            entry.copy(opinion = opinion.copy(intendedPurpose = OpinionPurpose.OTHER)),
            entry.copy(opinion = opinion.copy(validatedRuleSetVersion = "SYN-RULESET-6")),
        )
    }

    private companion object {
        const val NONE = -1
        const val MAX_VALUES = 3
        const val HALF = 0.5
        const val P_GOOD = 0.95
        const val P_GOOD_PART = 0.97
        const val P_VERSION = 0.97
        const val P_CURRENT_VERSION = 0.7
        const val P_CRITICAL = 0.5
        const val P_IN_HOUSE = 0.85
        const val P_CORRECTION_REASON = 0.75
        const val P_CANCELLATION_REASON = 0.55
        const val P_ERROR_REASON = 0.45
        const val P_FLAG_ON = 0.9
        const val P_REGISTER_ENTRY_GOOD = 0.65
        const val P_VERDICT_GOOD = 0.8

        val USABLE_SPECIMEN_STATES: List<SpecimenStatus> =
            listOf(SpecimenStatus.RECEIVED, SpecimenStatus.IN_PROCESS, SpecimenStatus.RESULTED, SpecimenStatus.STORED)
        val UNUSABLE_SPECIMEN_STATES: List<SpecimenStatus> =
            listOf(
                SpecimenStatus.REJECTED,
                SpecimenStatus.LOST,
                SpecimenStatus.CANCELLED,
                SpecimenStatus.ENTERED_IN_ERROR,
                SpecimenStatus.UNKNOWN,
            )
        val ADMITTING_CLASSES: List<EncounterClass> = listOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.DAY_CASE)
        val ACTIVE_ENCOUNTER_STATES: List<EncounterStatus> =
            listOf(
                EncounterStatus.PLANNED,
                EncounterStatus.ARRIVED,
                EncounterStatus.TRIAGED,
                EncounterStatus.IN_PROGRESS,
                EncounterStatus.ON_LEAVE,
            )
        val ENDED_ENCOUNTER_STATES: List<EncounterStatus> =
            listOf(
                EncounterStatus.DISCHARGED_NOT_CLOSED,
                EncounterStatus.FINISHED,
                EncounterStatus.CANCELLED,
                EncounterStatus.ENTERED_IN_ERROR,
                EncounterStatus.UNKNOWN,
            )
    }
}
