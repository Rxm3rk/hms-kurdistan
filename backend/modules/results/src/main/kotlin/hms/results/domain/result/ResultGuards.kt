package hms.results.domain.result

import java.time.Instant

/**
 * The single implementation of the result machine's guard predicates (docs/specs/state-machines/result.yaml;
 * docs/specs/modules/state-machines-and-invariants.md §2.1 rule 12, §3.1).
 *
 * Each predicate is a pure, total function of [ResultFacts] and implements its YAML description. Unknown or missing facts
 * fail closed where the description says so. The two exact-complement pairs are literal negations of one private function
 * each, so they can never both hold or both fail: [criticalValueFlagged] / [noCriticalValueFlagged] and
 * [patientDischarged] / [patientNotDischarged] (spec §1.2; DN-055 items 4 and 8). No predicate holds a threshold, a
 * reference range or a code list: those are governed content [HUMAN] that arrive in the facts.
 */
@Suppress("TooManyFunctions") // The generated ResultPredicates interface has thirteen predicates; each needs its override.
object ResultGuards : ResultPredicates {
    /** The Register's function id for autoverification (§9.8, A.20 "LIS rules"). */
    const val AUTOVERIFICATION_FUNCTION: String = "reg-lis-rules"

    /** Specimen states that make a value's specimen unusable (result.yaml `specimenUsable`), plus an unknown state. */
    private val UNUSABLE_SPECIMEN_STATES: Set<SpecimenStatus> =
        setOf(
            SpecimenStatus.REJECTED,
            SpecimenStatus.LOST,
            SpecimenStatus.CANCELLED,
            SpecimenStatus.ENTERED_IN_ERROR,
            SpecimenStatus.UNKNOWN,
        )

    /** The verdicts that count as evaluated and not critical (result.yaml `noCriticalValueFlagged`). */
    private val NOT_CRITICAL_VERDICTS: Set<CriticalVerdict> =
        setOf(CriticalVerdict.NOT_CRITICAL, CriticalVerdict.NO_CRITICAL_LIMITS)

    /** The five active encounter states (result.yaml `patientDischarged`). */
    private val ACTIVE_ENCOUNTER_STATES: Set<EncounterStatus> =
        setOf(
            EncounterStatus.PLANNED,
            EncounterStatus.ARRIVED,
            EncounterStatus.TRIAGED,
            EncounterStatus.IN_PROGRESS,
            EncounterStatus.ON_LEAVE,
        )

    /** The Register statuses that allow activation (SI-18 clause a). */
    private val ACTIVATING_REGISTER_STATUSES: Set<RegisterStatus> = setOf(RegisterStatus.CLEARED, RegisterStatus.NOT_REQUIRED)

    /**
     * §8.4 technologist validation (DN-055 item 2): the validation names the version being filed, was recorded at or
     * after its last value change and not after now, by the authenticated human issuing the command, who holds the
     * validation privilege for the test's laboratory section. Any missing fact makes it false.
     */
    override fun technologistValidated(facts: ResultFacts): Boolean {
        val version = facts.versionBeingFiled
        val validation = facts.validation
        val user = facts.actingUser
        return version != null &&
            validation != null &&
            user != null &&
            isAuthenticatedHuman(user) &&
            validation.versionId == version.versionId &&
            !validation.recordedAt.isBefore(version.lastValueChangeAt) &&
            !validation.recordedAt.isAfter(facts.now) &&
            validation.validatedBy == user.userId &&
            holdsValidationPrivilege(facts.validationPrivilege, user, facts.test)
    }

    /**
     * Every specimen behind a new or changed value is known and in none of the states rejected, lost, cancelled or
     * entered-in-error; a reference laboratory's value also carries that laboratory's own specimen reference (DN-055
     * item 11). No version, a value with no specimen reference or an unknown specimen state makes it false.
     */
    override fun specimenUsable(facts: ResultFacts): Boolean {
        val version = facts.versionBeingFiled ?: return false
        return version.values.filter(::isNewOrChanged).all { specimenOf(it, facts.specimens) }
    }

    /**
     * The QC lockout over every new or changed value (§9.8; DN-055 item 6): (a) a new in-house measurement needs its run's
     * QC passed and covering the measurement time, and the analyser's current QC passed and covering now; (b) a changed
     * value with no new measurement needs its original run's QC passed and covering that measurement time; (c) a
     * reference laboratory's value needs that laboratory's identification. Unknown, missing, failed or overdue QC, or no
     * version, makes it false; a version with no new or changed value has nothing to check.
     */
    override fun qcAllowsRelease(facts: ResultFacts): Boolean {
        val version = facts.versionBeingFiled ?: return false
        return version.values.filter(::isNewOrChanged).all { qcAllows(it, facts.now) }
    }

    /** At least one value is critical, not evaluated, or marked critical: the literal negation of [noCriticalValueFlagged]. */
    override fun criticalValueFlagged(facts: ResultFacts): Boolean = !everyValueEvaluatedNotCritical(facts)

    /** Every value's verdict is not critical or no-critical-limits and none is marked critical (DN-055 item 4). */
    override fun noCriticalValueFlagged(facts: ResultFacts): Boolean = everyValueEvaluatedNotCritical(facts)

    /** The result is for a discharged patient, unknowns failing closed into the owned queue (DN-055 item 8). */
    override fun patientDischarged(facts: ResultFacts): Boolean = isDischarged(facts.encounter)

    /** The literal negation of [patientDischarged]. */
    override fun patientNotDischarged(facts: ResultFacts): Boolean = !isDischarged(facts.encounter)

    /** A coded reason the user chose from the governed correction-reason list (DN-055 item 10). */
    override fun correctionReasonEntered(facts: ResultFacts): Boolean =
        chosenFrom(facts.correctionReason, facts.governedReasons.correction)

    /** A coded reason the user chose from the governed cancellation-reason list (DN-055 item 10). */
    override fun cancellationReasonEntered(facts: ResultFacts): Boolean =
        chosenFrom(facts.cancellationReason, facts.governedReasons.cancellation)

    /** A coded reason the user chose from the governed entered-in-error reason list (DN-055 item 10). */
    override fun errorReasonEntered(facts: ResultFacts): Boolean = chosenFrom(facts.errorReason, facts.governedReasons.enteredInError)

    /**
     * B.3's `privilegedAndAudited`: the acting user is an authenticated human holding the privilege for this command on
     * this result, and the audit context names that user, a time not after now, this result and its current version (none
     * when no version is filed yet).
     */
    override fun privilegedAndAudited(facts: ResultFacts): Boolean {
        val user = facts.actingUser
        val privilege = facts.actionPrivilege
        return user != null &&
            isAuthenticatedHuman(user) &&
            privilege != null &&
            privilege.granted &&
            privilege.userId == user.userId &&
            privilege.resultId == facts.resultId &&
            auditComplete(facts.audit, user, facts)
    }

    /**
     * Autoverification is active (SI-18; DN-055 item 3): the tenant's flag AND a reg-lis-rules Register entry for the
     * running version and the tenant's jurisdiction with status cleared or not-required, a stored opinion not expired at
     * now, the result's test in its scope, its purpose the release of results by autoverification, and the verdict's
     * rule-set version the one validated under the entry. The flag alone never makes it true.
     */
    override fun autoverificationActive(facts: ResultFacts): Boolean {
        val auto = facts.autoverification
        val entry = auto.registerEntry
        return auto.tenantFlagOn &&
            entry != null &&
            entryMatchesTenant(entry, auto) &&
            entry.status in ACTIVATING_REGISTER_STATUSES &&
            opinionCovers(entry.opinion, facts, auto.verdict)
    }

    /**
     * reg-lis-rules returned a release verdict for exactly the version being filed, after running every rule of the §9.8
     * stack in order, naming its rule-set version. No verdict, a hold, another version or no rule-set version makes it false.
     */
    override fun autoverificationRulesPassed(facts: ResultFacts): Boolean {
        val version = facts.versionBeingFiled
        val verdict = facts.autoverification.verdict
        return version != null &&
            verdict != null &&
            verdict.versionId == version.versionId &&
            verdict.outcome == RulesOutcome.RELEASE &&
            !verdict.ruleSetVersion.isNullOrBlank() &&
            verdict.rulesRun == AutoverificationRule.entries
    }

    private fun isAuthenticatedHuman(user: ActingUser): Boolean = user.authenticated && user.kind == AccountKind.HUMAN

    private fun holdsValidationPrivilege(
        privilege: ValidationPrivilege?,
        user: ActingUser,
        test: TestIdentity,
    ): Boolean =
        privilege != null &&
            privilege.granted &&
            privilege.userId == user.userId &&
            privilege.laboratorySection == test.laboratorySection

    private fun isNewOrChanged(value: ResultValue): Boolean = value.change != ValueChange.CARRIED_UNCHANGED

    private fun specimenOf(
        value: ResultValue,
        specimens: Map<String, SpecimenStatus>,
    ): Boolean {
        val specimenId = value.specimenId
        val state = if (specimenId.isNullOrBlank()) SpecimenStatus.UNKNOWN else specimens[specimenId] ?: SpecimenStatus.UNKNOWN
        val referenceLabRefPresent =
            when (val performer = value.performer) {
                is Performer.InHouse -> true
                is Performer.ReferenceLaboratory -> !performer.laboratorySpecimenRef.isNullOrBlank()
            }
        return state !in UNUSABLE_SPECIMEN_STATES && referenceLabRefPresent
    }

    private fun qcAllows(
        value: ResultValue,
        now: Instant,
    ): Boolean =
        when (val performer = value.performer) {
            is Performer.InHouse -> {
                val runCovered = passedCovering(performer.runQc, performer.measuredAt)
                when (value.change) {
                    ValueChange.NEW_MEASUREMENT -> runCovered && passedCovering(performer.currentAnalyserQc, now)
                    ValueChange.CHANGED_WITHOUT_NEW_MEASUREMENT -> runCovered
                    ValueChange.CARRIED_UNCHANGED -> true
                }
            }

            is Performer.ReferenceLaboratory -> {
                !performer.laboratoryId.isNullOrBlank()
            }
        }

    /** QC passed and its period covers [instant]: valid from at or before it, valid until after it. */
    private fun passedCovering(
        qc: QcRecord?,
        instant: Instant,
    ): Boolean {
        val from = qc?.validFrom
        val until = qc?.validUntil
        return qc != null &&
            qc.status == QcStatus.PASSED &&
            from != null &&
            until != null &&
            !from.isAfter(instant) &&
            until.isAfter(instant)
    }

    private fun everyValueEvaluatedNotCritical(facts: ResultFacts): Boolean {
        val version = facts.versionBeingFiled ?: return false
        return version.values.all { it.criticalVerdict in NOT_CRITICAL_VERDICTS && !it.markedCriticalByTechnologist }
    }

    private fun isDischarged(link: EncounterLink): Boolean =
        when (link) {
            EncounterLink.NoEncounterRecorded -> {
                false
            }

            EncounterLink.Missing, EncounterLink.Unresolved -> {
                true
            }

            is EncounterLink.Resolved -> {
                when (link.encounterClass) {
                    EncounterClass.OUTPATIENT -> false
                    EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.DAY_CASE ->
                        link.status !in ACTIVE_ENCOUNTER_STATES
                    EncounterClass.UNKNOWN -> true
                }
            }
        }

    private fun chosenFrom(
        reason: ReasonEntry?,
        governed: Set<String>,
    ): Boolean {
        val code = reason?.code
        return reason != null && reason.selection == ReasonSelection.USER_SELECTED && !code.isNullOrBlank() && code in governed
    }

    private fun auditComplete(
        audit: AuditContext?,
        user: ActingUser,
        facts: ResultFacts,
    ): Boolean {
        val at = audit?.at
        return audit != null &&
            audit.userId == user.userId &&
            at != null &&
            !at.isAfter(facts.now) &&
            audit.resultId == facts.resultId &&
            audit.versionActedOn == facts.currentVersionId
    }

    private fun entryMatchesTenant(
        entry: RegisterEntry,
        auto: AutoverificationFacts,
    ): Boolean =
        entry.function == AUTOVERIFICATION_FUNCTION &&
            auto.runningFunctionVersion.isNotBlank() &&
            entry.functionVersion == auto.runningFunctionVersion &&
            auto.tenantJurisdiction.isNotBlank() &&
            entry.jurisdiction == auto.tenantJurisdiction

    private fun opinionCovers(
        opinion: RegisterOpinion?,
        facts: ResultFacts,
        verdict: RulesVerdict?,
    ): Boolean {
        val expiresAt = opinion?.expiresAt
        val ruleSet = verdict?.ruleSetVersion
        return opinion != null &&
            !opinion.documentRef.isNullOrBlank() &&
            expiresAt != null &&
            facts.now.isBefore(expiresAt) &&
            facts.test in opinion.scope &&
            opinion.intendedPurpose == OpinionPurpose.RELEASE_OF_RESULTS_BY_AUTOVERIFICATION &&
            !ruleSet.isNullOrBlank() &&
            ruleSet == opinion.validatedRuleSetVersion
    }
}
