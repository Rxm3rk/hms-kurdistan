package hms.adt.domain.bed

import hms.adt.domain.common.Answer
import hms.adt.domain.common.BedRestrictions
import hms.adt.domain.common.Occupancy
import hms.adt.domain.common.OfflineMatrix
import hms.adt.domain.common.isUserReason
import hms.adt.domain.encounter.EncounterState

/**
 * The single implementation of the bed machine's guard predicates (docs/specs/state-machines/bed.yaml;
 * docs/specs/modules/state-machines-and-invariants.md §2.1 rule 12, §3.1). Each function is pure and total and
 * implements its predicate's YAML description (the KDoc of [BedPredicates]). The restriction rules and the offline
 * matrix are shared with the encounter machine (hms.adt.domain.common). The exact-complement pair
 * cleaningNeededOnReturn / noCleaningNeededOnReturn is the literal negation of one private function. No predicate reads
 * [BedFacts.finance] or [BedFacts.wanReachable] (SI-12, SI-15 clause h).
 */
// One function per predicate of bed.yaml, as the generated interface requires; each unknown fact is an early
// "return false" guard clause, the plainest form of "an unknown answer fails".
@Suppress("TooManyFunctions", "ReturnCount")
object BedGuards : BedPredicates {
    private val BED_TAKING_STATES =
        setOf(EncounterState.PLANNED, EncounterState.ARRIVED, EncounterState.TRIAGED, EncounterState.IN_PROGRESS)
    private val ENDED_STATES =
        setOf(EncounterState.DISCHARGED_NOT_CLOSED, EncounterState.FINISHED, EncounterState.CANCELLED, EncounterState.ENTERED_IN_ERROR)
    private val CLEAN_SPELL_ENTRY = setOf(BedState.AVAILABLE)

    override fun onSiteCellConnected(facts: BedFacts): Boolean = OfflineMatrix.allowsBedAllocation(facts.channel, facts.clientModeAtIssue)

    override fun reservationEncounterOpen(facts: BedFacts): Boolean =
        facts.commandEncounterId != null && facts.commandEncounterState in BED_TAKING_STATES

    override fun bedRestrictionsAdmitPatient(facts: BedFacts): Boolean =
        BedRestrictions.admits(facts.attributes, facts.patientPlacement, facts.genderRules)

    override fun noActivePressureAlarm(facts: BedFacts): Boolean = !BedRestrictions.pressureAlarmActive(facts.attributes)

    override fun overrideReasonChosen(facts: BedFacts): Boolean =
        BedRestrictions.overrideChosen(
            facts.override,
            BedRestrictions.failing(facts.attributes, facts.patientPlacement, facts.genderRules),
        )

    override fun occupantMatchesReservation(facts: BedFacts): Boolean =
        facts.commandEncounterId != null && facts.commandEncounterId == facts.reservationEncounterId

    override fun noOverlappingOccupancy(facts: BedFacts): Boolean {
        val encounter = facts.commandEncounterId ?: return false
        val start = facts.occupancyStart ?: return false
        return Occupancy.conflicts(facts.periods, facts.bedId, setOf(encounter), start, null).isEmpty()
    }

    override fun noOpenOccupancy(facts: BedFacts): Boolean =
        facts.periods.none { it.bedId == facts.bedId && !it.enteredInError && it.end == null }

    override fun requiredCleanRecorded(facts: BedFacts): Boolean {
        val job = facts.cleaningJob ?: return false
        val required = job.requiredType ?: CleanType.TERMINAL
        return job.completedClean == required
    }

    override fun blockReasonValid(facts: BedFacts): Boolean = facts.blockReason?.byUser == true

    override fun reasonEntered(facts: BedFacts): Boolean = facts.reason.isUserReason()

    override fun reservedEncounterEnded(facts: BedFacts): Boolean =
        facts.reservationEncounterId != null && facts.reservationEncounterState in ENDED_STATES

    override fun cleaningNeededOnReturn(facts: BedFacts): Boolean = cleaningNeeded(facts)

    override fun noCleaningNeededOnReturn(facts: BedFacts): Boolean = !cleaningNeeded(facts)

    override fun privilegedAndAudited(facts: BedFacts): Boolean = facts.commandPrivilege == Answer.YES && facts.auditAccepted == Answer.YES

    override fun returningOccupantWasLastOccupant(facts: BedFacts): Boolean {
        val encounter = facts.commandEncounterId ?: return false
        val closure = facts.cancelledClosure ?: return false
        val ended = facts.periods.filter { it.bedId == facts.bedId && !it.enteredInError && it.end != null }
        val lastEnd = ended.maxOfOrNull { requireNotNull(it.end) } ?: return false
        val last = ended.filter { it.end == lastEnd }.singleOrNull() ?: return false
        val usedSince =
            facts.periods.any { it.bedId == facts.bedId && !it.enteredInError && it.encounterId != encounter && it.start >= lastEnd }
        return last.encounterId == encounter && last.id == closure.closedPeriodId && !usedSince
    }

    override fun backEnteredOccupantMatches(facts: BedFacts): Boolean {
        val occupancy = facts.backEnteredOccupancy ?: return false
        return occupancy.appliedInSameTransaction &&
            occupancy.lastOfBackEntry &&
            occupancy.end == null &&
            occupancy.bedId == facts.bedId &&
            occupancy.encounterId == facts.commandEncounterId
    }

    /**
     * Cleaning is needed unless the spell is known to have started from available and every block reason in it was
     * staffing (an empty list: closed only, never blocked). An unknown spell, entry state or reason list needs cleaning.
     */
    private fun cleaningNeeded(facts: BedFacts): Boolean {
        val spell = facts.outOfUseSpell ?: return true
        val reasons = spell.blockReasons ?: return true
        return spell.enteredFrom !in CLEAN_SPELL_ENTRY || reasons.any { it != BlockReason.STAFFING }
    }
}
