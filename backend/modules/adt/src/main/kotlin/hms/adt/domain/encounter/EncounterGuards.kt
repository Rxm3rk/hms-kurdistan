package hms.adt.domain.encounter

import hms.adt.domain.bed.BedState
import hms.adt.domain.common.Answer
import hms.adt.domain.common.BedAttributes
import hms.adt.domain.common.BedRestrictions
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.LeaveEntry
import hms.adt.domain.common.LocationPeriod
import hms.adt.domain.common.Occupancy
import hms.adt.domain.common.OfflineMatrix
import hms.adt.domain.common.RestrictionKind
import hms.adt.domain.common.isUserReason
import java.time.Instant

/**
 * The single implementation of the encounter machine's guard predicates (docs/specs/state-machines/encounter.yaml;
 * docs/specs/modules/state-machines-and-invariants.md §2.1 rule 12, §3.1). Each function is pure and total and
 * implements its predicate's YAML description; the KDoc of [EncounterPredicates] carries that text. Unknown answers fail
 * where the description says so. Exact-complement pairs are literal negations of one private function, so they never
 * both hold. No predicate reads [EncounterFacts.finance] or [EncounterFacts.wanReachable] (SI-12, SI-15 clause h).
 */
// One function per predicate of encounter.yaml, as the generated interface requires; each unknown fact is an early
// "return false" guard clause, the plainest form of "an unknown answer fails".
@Suppress("TooManyFunctions", "ReturnCount")
object EncounterGuards : EncounterPredicates {
    /** The vendor baseline disposition list, used when the tenant's list is missing or empty (encounter.yaml). */
    val BASELINE_DISPOSITIONS: Set<String> =
        setOf("home", "died", "left-without-being-seen", "against-medical-advice", "transfer-out", "admitted-elsewhere")

    private val SWAP_PARTNER_STATES = setOf(EncounterState.IN_PROGRESS)
    private val REPLACEMENT_STATES = setOf(EncounterState.ARRIVED, EncounterState.TRIAGED)
    private val RELEASED_BED_STATES = setOf(BedState.DIRTY, BedState.CLEANING)
    private val BACK_ENTRY_BLOCKING_STATES = setOf(BedState.BLOCKED, BedState.CLOSED)

    override fun patientIdentityConfirmed(facts: EncounterFacts): Boolean = identityConfirmed(facts.patientIdentification)

    override fun swapPartnerIdentityConfirmed(facts: EncounterFacts): Boolean = identityConfirmed(facts.swap?.identification)

    override fun triageRecordComplete(facts: EncounterFacts): Boolean {
        val configuration = facts.triageConfiguration ?: return false
        val record = facts.commandTriageRecord ?: return false
        val described =
            record.scale == configuration.scale &&
                record.level in configuration.levels &&
                !record.chiefComplaint.isNullOrBlank() &&
                record.triageTime != null &&
                !record.triagingUser.isNullOrBlank()
        return described && configuration.requiredVitals.all { vital -> vitalRecorded(record.vitals[vital], configuration) }
    }

    override fun onSiteCellConnected(facts: EncounterFacts): Boolean =
        OfflineMatrix.allowsBedAllocation(facts.channel, facts.clientModeAtIssue)

    override fun targetBedAssignedToEncounter(facts: EncounterFacts): Boolean {
        val bed = facts.targetBedId?.let { facts.beds[it] } ?: return false
        return bed.state == BedState.RESERVED && bed.reservedForEncounterId == facts.encounterId
    }

    override fun targetBedFreeForNewPeriod(facts: EncounterFacts): Boolean {
        val bedId = facts.targetBedId ?: return false
        val from = facts.effectiveTime ?: return false
        return freeFrom(facts, bedId, from)
    }

    override fun bedSwapPairValid(facts: EncounterFacts): Boolean {
        val partner = facts.swap ?: return false
        val target = facts.targetBedId ?: return false
        val at = facts.effectiveTime ?: return false
        val current = Occupancy.openPeriodsOf(facts.periods, facts.encounterId).singleOrNull() ?: return false
        val partnerOpen = Occupancy.openPeriodsOf(facts.periods, partner.encounterId).singleOrNull() ?: return false
        val partnerOnLeave =
            facts.leaveEntries.any { it.encounterId == partner.encounterId && !it.enteredInError && it.end == null }
        val bothEncounters = setOf(facts.encounterId, partner.encounterId)
        return partner.encounterId != facts.encounterId &&
            partner.state in SWAP_PARTNER_STATES &&
            !partnerOnLeave &&
            partnerOpen.bedId == target &&
            target != current.bedId &&
            at > partnerOpen.start &&
            Occupancy.conflicts(facts.periods, target, bothEncounters, at, null).isEmpty() &&
            Occupancy.conflicts(facts.periods, current.bedId, bothEncounters, at, null).isEmpty()
    }

    override fun swappedBedsAdmitBothPatients(facts: EncounterFacts): Boolean {
        val failing = swapFailingRestrictions(facts) ?: return false
        return failing.isEmpty()
    }

    override fun overrideReasonChosen(facts: EncounterFacts): Boolean {
        // With no swap to evaluate, the restrictions being overridden are unknown: the predicate fails.
        val failing = swapFailingRestrictions(facts) ?: return false
        return BedRestrictions.overrideChosen(facts.override, failing)
    }

    override fun effectiveTimeAfterLocationStart(facts: EncounterFacts): Boolean {
        val at = commandEffectiveTime(facts) ?: return false
        val openStarts =
            Occupancy.openPeriodsOf(facts.periods, facts.encounterId).map { it.start } +
                facts.leaveEntries
                    .filter { it.encounterId == facts.encounterId && !it.enteredInError && it.end == null }
                    .map { it.start }
        return openStarts.isNotEmpty() && openStarts.all { at > it }
    }

    override fun dispositionChosen(facts: EncounterFacts): Boolean {
        val chosen = facts.disposition ?: return false
        val governed = facts.tenantDispositions
        val list = if (governed.isNullOrEmpty()) BASELINE_DISPOSITIONS else governed
        return chosen.byUser && chosen.value in list
    }

    override fun returnBedAvailable(facts: EncounterFacts): Boolean {
        val discharge = facts.dischargeBeingCancelled ?: return false
        val target = facts.targetBedId ?: return false
        val bed = facts.beds[target] ?: return false
        return if (target == discharge.closedBedId) {
            val closedAt = discharge.effectiveTime ?: return false
            bed.state in RELEASED_BED_STATES && freeFrom(facts, target, closedAt)
        } else {
            targetBedAssignedToEncounter(facts) && targetBedFreeForNewPeriod(facts)
        }
    }

    override fun dischargedFromBed(facts: EncounterFacts): Boolean = dischargeOrigin(facts) == DischargeOrigin.BED

    override fun dischargedFromLeave(facts: EncounterFacts): Boolean = dischargeOrigin(facts) == DischargeOrigin.LEAVE

    override fun dischargedBeforeAdmission(facts: EncounterFacts): Boolean =
        dischargeOrigin(facts) == DischargeOrigin.BEFORE_ADMISSION

    override fun triageRecorded(facts: EncounterFacts): Boolean = holdsTriageRecord(facts)

    override fun noTriageRecorded(facts: EncounterFacts): Boolean = !holdsTriageRecord(facts)

    override fun previousBedAvailable(facts: EncounterFacts): Boolean {
        val transfer = facts.lastTransfer ?: return false
        val bedId = transfer.previousBedId ?: return false
        val at = transfer.effectiveTime ?: return false
        val bed = facts.beds[bedId] ?: return false
        val usedSince =
            facts.periods.any {
                it.bedId == bedId &&
                    !it.enteredInError &&
                    it.encounterId != facts.encounterId &&
                    (it.start >= at || Occupancy.overlaps(at, null, it.start, it.end))
            }
        return bed.state in RELEASED_BED_STATES && !usedSince
    }

    override fun correctedTimesConsistent(facts: EncounterFacts): Boolean = LocationCorrection.consistent(facts)

    override fun backEntryPeriodsWellFormed(facts: EncounterFacts): Boolean = BackEntry.wellFormed(facts)

    override fun backEntryPeriodsFree(facts: EncounterFacts): Boolean = !BackEntry.conflicts(facts)

    override fun backEntryPeriodsConflict(facts: EncounterFacts): Boolean = BackEntry.conflicts(facts)

    override fun errorReasonChosen(facts: EncounterFacts): Boolean = facts.errorReason?.byUser == true

    override fun wrongPatientError(facts: EncounterFacts): Boolean = isWrongPatient(facts)

    override fun notWrongPatientError(facts: EncounterFacts): Boolean = !isWrongPatient(facts)

    override fun replacementEncounterReady(facts: EncounterFacts): Boolean {
        val replacement = facts.replacement ?: return false
        val ownPeriods = facts.periods.filter { it.encounterId == facts.encounterId && !it.enteredInError }
        val recreatable =
            ownPeriods.all { period ->
                Occupancy.conflicts(facts.periods, period.bedId, setOf(facts.encounterId), period.start, period.end).isEmpty()
            }
        return replacement.encounterId != facts.encounterId &&
            replacement.patientId != facts.patientId &&
            replacement.state in REPLACEMENT_STATES &&
            identityConfirmed(replacement.identification) &&
            Occupancy.openPeriodsOf(facts.periods, replacement.encounterId).isEmpty() &&
            recreatable
    }

    override fun handOverPeriodValid(facts: EncounterFacts): Boolean {
        val handOver = facts.handOver ?: return false
        val sourcePeriods =
            facts.periods
                .filter { it.encounterId == handOver.sourceEncounterId && !it.enteredInError }
                .map { HandedOverPeriod(it.bedId, it.start, it.end) }
        val excluded = setOf(facts.encounterId, handOver.sourceEncounterId)
        val noOverlap =
            handOver.receivedPeriods.all { period ->
                Occupancy.conflicts(facts.periods, period.bedId, excluded, period.start, period.end).isEmpty()
            }
        return handOver.sourceEncounterId != facts.encounterId &&
            handOver.inSameTransaction &&
            handOver.sourceErrorReason == ErrorReason.WRONG_PATIENT &&
            handOver.sourceReplacementEncounterId == facts.encounterId &&
            handOver.receivedPeriods.isNotEmpty() &&
            sameMultiset(handOver.receivedPeriods, sourcePeriods) &&
            noOverlap
    }

    override fun codingAndChargingComplete(facts: EncounterFacts): Boolean =
        facts.codingComplete == Answer.YES && facts.chargeCaptureComplete == Answer.YES

    override fun reasonEntered(facts: EncounterFacts): Boolean = facts.reason.isUserReason()

    override fun privilegedAndAudited(facts: EncounterFacts): Boolean {
        val authorisation = facts.authorisation
        // Cancelling a discharge whose disposition was (or may have been) a death needs the death-reversal privilege.
        val deathReversalNeeded = facts.dischargeBeingCancelled?.let { it.died != Answer.NO } ?: false
        return authorisation.commandPrivilege == Answer.YES &&
            authorisation.auditAccepted == Answer.YES &&
            (!deathReversalNeeded || authorisation.deathReversalPrivilege == Answer.YES)
    }

    /** SI-01: an MRN and a date of birth or approximate-DOB flag, both confirmed by the identity service, and no location. */
    private fun identityConfirmed(identification: PatientIdentification?): Boolean {
        if (identification == null) return false
        val presented = identification.presented
        return IdentifierKind.MRN in presented &&
            (IdentifierKind.DATE_OF_BIRTH in presented || IdentifierKind.APPROXIMATE_DOB_FLAG in presented) &&
            presented.none { it.isLocation } &&
            identification.mrnCheckDigitValid == Answer.YES &&
            identification.secondIdentifierConfirmed == Answer.YES
    }

    private fun vitalRecorded(
        entry: VitalEntry?,
        configuration: TriageConfiguration,
    ): Boolean =
        when (entry) {
            null -> false
            is VitalEntry.Measured -> entry.value.isNotBlank() && entry.time != null
            is VitalEntry.NotObtained -> entry.reason.isUserReason() && entry.reason?.value in configuration.notObtainedReasons
        }

    /** No valid period of another encounter on [bedId] overlaps `[from, ∞)`. */
    private fun freeFrom(
        facts: EncounterFacts,
        bedId: String,
        from: Instant,
    ): Boolean = Occupancy.conflicts(facts.periods, bedId, setOf(facts.encounterId), from, null).isEmpty()

    /**
     * The restrictions the swap fails: this patient into the target bed, the partner into this encounter's current bed,
     * and an active pressure alarm in either room. Null when the swap cannot be evaluated (no partner, no target or no
     * single current bed).
     */
    private fun swapFailingRestrictions(facts: EncounterFacts): Set<RestrictionKind>? {
        val partner = facts.swap ?: return null
        val target = facts.targetBedId ?: return null
        val current = Occupancy.openPeriodsOf(facts.periods, facts.encounterId).singleOrNull()?.bedId ?: return null
        val targetBed = facts.bedAttributes[target] ?: BedAttributes.NOT_RECORDED
        val currentBed = facts.bedAttributes[current] ?: BedAttributes.NOT_RECORDED
        return BedRestrictions.failing(targetBed, facts.patientPlacement, facts.genderRules) +
            BedRestrictions.failing(currentBed, partner.placement, facts.genderRules)
    }

    /** The command's effective time; for a back-entry (paper periods present), the start of its first paper period. */
    private fun commandEffectiveTime(facts: EncounterFacts): Instant? =
        if (facts.backEntry.isNotEmpty()) facts.backEntry.first().start else facts.effectiveTime

    private fun dischargeOrigin(facts: EncounterFacts): DischargeOrigin? =
        when (facts.dischargeBeingCancelled?.firedFrom) {
            EncounterState.IN_PROGRESS -> DischargeOrigin.BED
            EncounterState.ON_LEAVE -> DischargeOrigin.LEAVE
            EncounterState.ARRIVED, EncounterState.TRIAGED -> DischargeOrigin.BEFORE_ADMISSION
            else -> null
        }

    private fun holdsTriageRecord(facts: EncounterFacts): Boolean = facts.heldTriageRecords.any { !it.enteredInError }

    private fun isWrongPatient(facts: EncounterFacts): Boolean = facts.errorReason?.value == ErrorReason.WRONG_PATIENT

    private fun sameMultiset(
        a: List<HandedOverPeriod>,
        b: List<HandedOverPeriod>,
    ): Boolean = a.groupingBy { it }.eachCount() == b.groupingBy { it }.eachCount()

    /** The mutually exclusive origins of a cancelled discharge; an unknown origin is none of them. */
    private enum class DischargeOrigin { BED, LEAVE, BEFORE_ADMISSION }

    /** encounter.yaml `backEntryPeriodsWellFormed`, `backEntryPeriodsFree` and `backEntryPeriodsConflict`. */
    private object BackEntry {
        private val DOWNTIME_KINDS =
            setOf(ConnectivityMode.CELL_LOST, ConnectivityMode.EDGE_AGENT, ConnectivityMode.MOBILE_OFFLINE)

        fun wellFormed(facts: EncounterFacts): Boolean {
            val paper = facts.backEntry
            val recorded = facts.recordedTime
            val arrival = facts.arrivalTime
            if (paper.isEmpty() || recorded == null || arrival == null) return false
            if (!paper.withIndex().all { (index, period) -> complete(period, last = index == paper.lastIndex) }) return false
            val starts = paper.map { requireNotNull(it.start) }
            // Consecutive: each bounded period has start before end, and the next one starts where it ends.
            val ordered =
                paper.zipWithNext().all { (previous, next) ->
                    requireNotNull(previous.start) < requireNotNull(previous.end) && previous.end == next.start
                }
            val beforeRecorded = paper.all { requireNotNull(it.start) < recorded && (it.end == null || it.end < recorded) }
            val inOneSpell =
                facts.downtimeSpells.any { spell -> spell.kind in DOWNTIME_KINDS && paper.all { within(it, spell) } }
            return ordered && beforeRecorded && inOneSpell && starts.first() >= arrival
        }

        /** A bed, a start, an end except for the last period (which has none), the downtime label and a paper reference. */
        private fun complete(
            period: PaperPeriod,
            last: Boolean,
        ): Boolean {
            val endAsRequired = if (last) period.end == null else period.end != null
            return !period.bedId.isNullOrBlank() &&
                period.start != null &&
                endAsRequired &&
                period.downtimeLabel &&
                !period.paperSourceReference.isNullOrBlank()
        }

        /** True when the back-entry cannot be applied as it stands (a conflict, or periods that cannot be checked). */
        fun conflicts(facts: EncounterFacts): Boolean {
            val paper = facts.backEntry
            if (paper.isEmpty() || paper.any { it.bedId == null || it.start == null }) return true
            val overlap =
                paper.any { period ->
                    val bedId = requireNotNull(period.bedId)
                    val start = requireNotNull(period.start)
                    Occupancy.conflicts(facts.periods, bedId, setOf(facts.encounterId), start, period.end).isNotEmpty()
                }
            val lastBed = facts.beds[requireNotNull(paper.last().bedId)]
            val lastBedUnavailable =
                lastBed == null ||
                    lastBed.state == null ||
                    lastBed.state in BACK_ENTRY_BLOCKING_STATES ||
                    (lastBed.state == BedState.RESERVED && lastBed.reservedForEncounterId != facts.encounterId)
            return overlap || lastBedUnavailable
        }

        private fun within(
            period: PaperPeriod,
            spell: DowntimeSpell,
        ): Boolean {
            val start = requireNotNull(period.start)
            val spellEnd = spell.end
            val startInside = start >= spell.start && (spellEnd == null || start < spellEnd)
            val end = period.end
            return startInside && (end == null || spellEnd == null || end <= spellEnd)
        }
    }

    /** encounter.yaml `correctedTimesConsistent`. */
    private object LocationCorrection {
        fun consistent(facts: EncounterFacts): Boolean {
            val correction = facts.boundaryCorrection ?: return false
            val entryId = correction.entryId ?: return false
            val newTime = correction.newTime ?: return false
            val arrival = facts.arrivalTime ?: return false
            val beds = facts.periods.filter { it.encounterId == facts.encounterId && !it.enteredInError }.sortedBy { it.start }
            val leaves =
                facts.leaveEntries.filter { it.encounterId == facts.encounterId && !it.enteredInError }.sortedBy { it.start }
            val bedIndex = beds.indexOfFirst { it.id == entryId }
            val leaveIndex = leaves.indexOfFirst { it.id == entryId }
            return when {
                bedIndex >= 0 -> correctBedPeriod(facts, beds, bedIndex, correction.end, newTime, arrival, leaves)
                leaveIndex >= 0 -> correctLeave(beds, leaves, leaveIndex, correction.end, newTime, arrival)
                else -> false
            }
        }

        @Suppress("LongParameterList") // The parts of one correction, computed once by consistent().
        private fun correctBedPeriod(
            facts: EncounterFacts,
            beds: List<LocationPeriod>,
            index: Int,
            end: BoundaryEnd,
            newTime: Instant,
            arrival: Instant,
            leaves: List<LeaveEntry>,
        ): Boolean {
            val changed = beds.toMutableList()
            val entry = beds[index]
            when (end) {
                BoundaryEnd.END -> {
                    val old = entry.end ?: return false
                    changed[index] = entry.copy(end = newTime)
                    // A boundary shared with the next bed period (a transfer) moves for both.
                    beds.getOrNull(index + 1)?.takeIf { it.start == old }?.let {
                        changed[index + 1] = it.copy(start = newTime)
                    }
                }

                BoundaryEnd.START -> {
                    val old = entry.start
                    changed[index] = entry.copy(start = newTime)
                    beds.getOrNull(index - 1)?.takeIf { it.end == old }?.let {
                        changed[index - 1] = it.copy(end = newTime)
                    }
                }
            }
            val moved = changed.filterIndexed { i, period -> period != beds[i] }
            val othersClear =
                moved.all { period ->
                    Occupancy.conflicts(facts.periods, period.bedId, setOf(facts.encounterId), period.start, period.end).isEmpty()
                }
            return historyConsistent(changed, leaves.map { it.start to it.end }, arrival) && othersClear
        }

        @Suppress("LongParameterList") // The parts of one correction, computed once by consistent().
        private fun correctLeave(
            beds: List<LocationPeriod>,
            leaves: List<LeaveEntry>,
            index: Int,
            end: BoundaryEnd,
            newTime: Instant,
            arrival: Instant,
        ): Boolean {
            val entry = leaves[index]
            if (end == BoundaryEnd.END && entry.end == null) return false
            val intervals = leaves.map { it.start to it.end }.toMutableList()
            intervals[index] = if (end == BoundaryEnd.START) newTime to entry.end else entry.start to newTime
            return historyConsistent(beds, intervals, arrival)
        }

        /**
         * Every entry has start before end and starts no earlier than the arrival; bed periods and leave entries each keep
         * their order with no overlap between consecutive ones.
         */
        private fun historyConsistent(
            beds: List<LocationPeriod>,
            leaves: List<Pair<Instant, Instant?>>,
            arrival: Instant,
        ): Boolean {
            val intervals = beds.map { it.start to it.end }
            return orderedWithoutOverlap(intervals, arrival) && orderedWithoutOverlap(leaves, arrival)
        }

        private fun orderedWithoutOverlap(
            intervals: List<Pair<Instant, Instant?>>,
            arrival: Instant,
        ): Boolean {
            val wellFormed = intervals.all { (start, end) -> start >= arrival && (end == null || start < end) }
            val ordered =
                intervals.zipWithNext().all { (previous, next) ->
                    val previousEnd = previous.second
                    previousEnd != null && previousEnd <= next.first
                }
            return wellFormed && ordered
        }
    }
}
