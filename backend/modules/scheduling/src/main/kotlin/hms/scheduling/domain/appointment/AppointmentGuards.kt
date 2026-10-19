package hms.scheduling.domain.appointment

import java.time.Duration
import java.time.Instant
import java.time.LocalDate

/**
 * The only implementation of the appointment machine's guard predicates (docs/specs/state-machines/appointment.yaml;
 * WP-0.5 spec §2.1 rule 12, §3.1). Each predicate is a pure, total function of [AppointmentFacts] implementing its
 * YAML description; each exact-complement pair is the literal negation of one private function, so the two can
 * never hold together (spec §1.2). Unknown values fail closed where the description says so, and the readings this
 * file adds for unknowns are named in each function's KDoc. No predicate reads a financial fact (SI-12).
 */
@Suppress("TooManyFunctions") // One function per predicate of the generated interface, plus their private helpers.
object AppointmentGuards : AppointmentPredicates {
    /** Encounter states in which adt reports an encounter as no longer open (patientInHospital). */
    private val closedEncounterStates =
        setOf(
            EncounterStatus.DISCHARGED_NOT_CLOSED,
            EncounterStatus.FINISHED,
            EncounterStatus.CANCELLED,
            EncounterStatus.ENTERED_IN_ERROR,
        )

    /** Encounter states in which an OPD visit has ended (encounter.md Q-E2). */
    private val endedEncounterStates = setOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED)

    /** Encounter states that never fulfil an appointment. */
    private val voidEncounterStates = setOf(EncounterStatus.CANCELLED, EncounterStatus.ENTERED_IN_ERROR)

    /** Attributes whose change is a reschedule, never a modification (modificationKeepsSlot). */
    private val slotAttributes =
        setOf(
            AppointmentAttribute.SLOT,
            AppointmentAttribute.START,
            AppointmentAttribute.END,
            AppointmentAttribute.SCHEDULED_RESOURCE,
            AppointmentAttribute.LOCATION,
            AppointmentAttribute.SERVICE_TYPE_OUTSIDE_SLOT_SERVICE,
        )

    /** MRN sources that come from what the patient presents or states (patientIdentifiedByTwoIdentifiers, item 2). */
    private val presentedMrnSources =
        setOf(IdentifierSource.CARD_SCAN, IdentifierSource.WRISTBAND_SCAN, IdentifierSource.PATIENT_STATED)

    /** Encounter classes that keep a patient from attending (patientInHospital). */
    private val inHospitalClasses = setOf(EncounterClass.EMERGENCY, EncounterClass.INPATIENT)

    // ---- Slots and participants.

    /**
     * The target slot exists, is not entered in error or busy-unavailable, ends strictly after now, and is free, or
     * held or booked by this appointment, or overbookable with fewer overbooked appointments than its cap (a missing
     * cap counts as zero; integers, exact comparison).
     */
    override fun slotAvailable(facts: AppointmentFacts): Boolean {
        val slot = facts.targetSlot ?: return false
        val usable =
            slot.status != SlotStatus.ENTERED_IN_ERROR &&
                slot.status != SlotStatus.BUSY_UNAVAILABLE &&
                slot.end.isAfter(facts.now)
        return usable && (slot.status == SlotStatus.FREE || heldByThisAppointment(slot, facts) || overbookingAllowed(slot))
    }

    private fun heldByThisAppointment(
        slot: SlotFacts,
        facts: AppointmentFacts,
    ): Boolean =
        (slot.status == SlotStatus.BUSY_TENTATIVE || slot.status == SlotStatus.BUSY) &&
            slot.heldByAppointmentId == facts.appointmentId

    private fun overbookingAllowed(slot: SlotFacts): Boolean = slot.overbookable && slot.overbookedCount < (slot.overbookCap ?: 0)

    /** The target slot exists and is not the slot the appointment currently holds or books. */
    override fun differentSlotRequested(facts: AppointmentFacts): Boolean {
        val target = facts.targetSlot ?: return false
        return target.slotId != facts.appointmentSlot?.slotId
    }

    /**
     * Every required participant accepted the command's target slot; a response for another slot does not count. No
     * target slot means nothing was accepted for it.
     */
    override fun requiredParticipantsAccepted(facts: AppointmentFacts): Boolean = allRequiredAccepted(facts)

    /** The exact complement of [requiredParticipantsAccepted]. */
    override fun participantAcceptanceAwaited(facts: AppointmentFacts): Boolean = !allRequiredAccepted(facts)

    private fun allRequiredAccepted(facts: AppointmentFacts): Boolean {
        val target = facts.targetSlot ?: return false
        return facts.participants
            .filter { it.required }
            .all { it.response == ParticipantResponse.ACCEPTED && it.responseSlotId == target.slotId }
    }

    // ---- Waitlist.

    /**
     * The entry has a non-blank service type, provider and location sets (empty means any), an earliest and a latest
     * date with earliest on or before latest and latest on or after today, and a priority code of the governed list
     * chosen by the user (never defaulted).
     */
    override fun waitlistEntryComplete(facts: AppointmentFacts): Boolean {
        val entry = facts.waitlistEntry ?: return false
        val earliest = entry.earliest
        val latest = entry.latest
        val datesValid = earliest != null && latest != null && !earliest.isAfter(latest) && !latest.isBefore(facts.today)
        return !entry.serviceType.isNullOrBlank() && datesValid && priorityChosen(entry, facts)
    }

    private fun priorityChosen(
        entry: WaitlistEntryFacts,
        facts: AppointmentFacts,
    ): Boolean =
        entry.priorityCode != null &&
            entry.priorityCode in facts.config.waitlistPriorityRanks &&
            entry.priorityOrigin == ReasonOrigin.USER

    /** The target slot satisfies this entry's constraints and was never declined, nor lapsed after confirmed delivery. */
    override fun offeredSlotMatchesConstraints(facts: AppointmentFacts): Boolean {
        val entry = facts.waitlistEntry
        val slot = facts.targetSlot
        return entry != null && slot != null && matches(entry, slot)
    }

    private fun matches(
        entry: WaitlistEntryFacts,
        slot: SlotFacts,
    ): Boolean {
        val earliest = entry.earliest
        val latest = entry.latest
        val provider = entry.providers.isEmpty() || slot.providerId in entry.providers
        val location = entry.locations.isEmpty() || slot.locationId in entry.locations
        val dates = earliest != null && latest != null && !slot.date.isBefore(earliest) && !slot.date.isAfter(latest)
        return entry.serviceType == slot.serviceType && provider && location && dates && !excludedSlot(entry, slot)
    }

    private fun excludedSlot(
        entry: WaitlistEntryFacts,
        slot: SlotFacts,
    ): Boolean =
        entry.pastOffers.any { offer ->
            offer.slotId == slot.slotId &&
                (offer.outcome == OfferOutcome.DECLINED || (offer.outcome == OfferOutcome.LAPSED && offer.deliveryConfirmed))
        }

    /**
     * No other entry whose constraints match the target slot ranks before this entry (lower priority rank, then the
     * earlier waitlisting, then the entry id). Reading for unknowns: this entry without a governed rank is never top
     * ranked, and a matching competitor without a governed rank ranks before it, so an entry whose priority is not
     * known is never passed over silently (the desk resolves it).
     */
    override fun topRankedForSlot(facts: AppointmentFacts): Boolean {
        val entry = facts.waitlistEntry
        val slot = facts.targetSlot
        val ranks = facts.config.waitlistPriorityRanks
        val rank = entry?.let { ranks[it.priorityCode] }
        return entry != null &&
            slot != null &&
            rank != null &&
            facts.competingEntries
                .filter { it.entryId != entry.entryId && matches(it, slot) }
                .none { competitor -> ranksBefore(competitor, ranks[competitor.priorityCode], entry, rank) }
    }

    private fun ranksBefore(
        competitor: WaitlistEntryFacts,
        competitorRank: Int?,
        entry: WaitlistEntryFacts,
        rank: Int,
    ): Boolean =
        when {
            competitorRank == null -> true
            competitorRank != rank -> competitorRank < rank
            competitor.waitlistedAt != entry.waitlistedAt -> competitor.waitlistedAt.isBefore(entry.waitlistedAt)
            else -> competitor.entryId < entry.entryId
        }

    /** The appointment is in pending because of a waitlist offer; an unknown reason is not a waitlist offer. */
    override fun waitlistOffer(facts: AppointmentFacts): Boolean = isWaitlistOffer(facts)

    /** The exact complement of [waitlistOffer]. */
    override fun notWaitlistOffer(facts: AppointmentFacts): Boolean = !isWaitlistOffer(facts)

    private fun isWaitlistOffer(facts: AppointmentFacts): Boolean = facts.hold?.reason == PendingReason.WAITLIST_OFFER

    /** The hold has a respond-by instant and now is strictly before it. */
    override fun holdResponseWindowOpen(facts: AppointmentFacts): Boolean = holdOpen(facts)

    /** The exact complement of [holdResponseWindowOpen]: a missing hold or deadline lapses it. */
    override fun holdResponseWindowElapsed(facts: AppointmentFacts): Boolean = !holdOpen(facts)

    private fun holdOpen(facts: AppointmentFacts): Boolean {
        val respondBy = facts.hold?.respondBy ?: return false
        return facts.now.isBefore(respondBy)
    }

    /** The entry's latest acceptable date is strictly before today; an entry without a latest date has not ended. */
    override fun waitlistWindowEnded(facts: AppointmentFacts): Boolean {
        val latest = facts.waitlistEntry?.latest ?: return false
        return latest.isBefore(facts.today)
    }

    // ---- Check-in (SI-01).

    /**
     * Two identifiers confirmed from what the patient or companion states or presents (SI-01 clauses a and d;
     * CTRL-0001-3; DN-057 items 3 and 4): (1) the stated name matches by empi's answer, (2) the MRN with a valid check
     * digit equals the record's MRN and came from a card or wristband scan, from the patient, or from an empi search
     * on the stated name and DOB with exactly one candidate (this patient), and (3) the stated DOB equals the record's
     * at its precision, or, for an approximate-DOB record, the stated age or birth year matches by empi's answer. A
     * missing record MRN, DOB or approximate-DOB flag fails; a screen-confirmed value, or a room, bed, token or
     * appointment number, never counts.
     */
    override fun patientIdentifiedByTwoIdentifiers(facts: AppointmentFacts): Boolean {
        val checkIn = facts.checkIn ?: return false
        return nameConfirmed(checkIn) && mrnConfirmed(checkIn, facts.patientId) && dobConfirmed(checkIn)
    }

    private fun nameConfirmed(checkIn: CheckInFacts): Boolean =
        !checkIn.statedName.isNullOrBlank() &&
            checkIn.nameSource == IdentifierSource.PATIENT_STATED &&
            checkIn.nameMatch == EmpiMatch.MATCH

    private fun mrnConfirmed(
        checkIn: CheckInFacts,
        patientId: String,
    ): Boolean {
        val recordMrn = checkIn.recordMrn ?: return false
        val valid = checkIn.mrnCheckDigitValid == true && checkIn.presentedMrn == recordMrn
        val source =
            when (checkIn.mrnSource) {
                in presentedMrnSources -> true
                IdentifierSource.EMPI_SEARCH -> singleCandidateSearch(checkIn, patientId)
                else -> false
            }
        return valid && source
    }

    // The search ran on the stated name and the stated DOB and returned exactly this patient.
    private fun singleCandidateSearch(
        checkIn: CheckInFacts,
        patientId: String,
    ): Boolean =
        checkIn.empiSearchCandidates == listOf(patientId) &&
            checkIn.statedDob != null &&
            checkIn.dobSource == IdentifierSource.PATIENT_STATED &&
            !checkIn.statedName.isNullOrBlank()

    private fun dobConfirmed(checkIn: CheckInFacts): Boolean {
        val recordDob = checkIn.recordDob ?: return false
        return when (checkIn.recordApproximateDob) {
            null -> false
            true -> checkIn.statedApproximateAgeMatch == EmpiMatch.MATCH
            false -> exactDobConfirmed(checkIn, recordDob)
        }
    }

    private fun exactDobConfirmed(
        checkIn: CheckInFacts,
        recordDob: LocalDate,
    ): Boolean {
        val stated = checkIn.statedDob ?: return false
        val equalAtPrecision =
            when (checkIn.recordDobPrecision) {
                null -> false
                DobPrecision.DAY -> stated == recordDob
                DobPrecision.MONTH -> stated.year == recordDob.year && stated.month == recordDob.month
                DobPrecision.YEAR -> stated.year == recordDob.year
            }
        return checkIn.dobSource == IdentifierSource.PATIENT_STATED && equalAtPrecision
    }

    /**
     * Now is at or after the slot start minus the early check-in window (missing counts as zero) and strictly before
     * the end of the slot's session. A missing slot start or session end fails.
     */
    override fun withinCheckInWindow(facts: AppointmentFacts): Boolean {
        val start = facts.appointmentSlot?.start
        val sessionEnd = facts.appointmentSlot?.sessionEnd
        return start != null &&
            sessionEnd != null &&
            !facts.now.isBefore(start.minus(window(facts.config.earlyCheckInWindow))) &&
            facts.now.isBefore(sessionEnd)
    }

    /**
     * A session of the requested service (and the requested provider, when one is requested) that accepts walk-ins is
     * running now: start at or before now, end strictly after now. No requested service fails.
     */
    override fun walkInSessionOpen(facts: AppointmentFacts): Boolean {
        val walkIn = facts.walkIn ?: return false
        val service = walkIn.requestedService
        return service != null &&
            walkIn.sessions.any { session ->
                session.serviceType == service &&
                    (walkIn.requestedProvider == null || session.providerId == walkIn.requestedProvider) &&
                    session.acceptsWalkIns &&
                    running(session, facts.now)
            }
    }

    private fun running(
        session: SessionFacts,
        now: Instant,
    ): Boolean = !now.isBefore(session.start) && now.isBefore(session.end)

    // ---- Fulfilment and visits that ended without a consultation.

    /**
     * The linked encounter is not cancelled or entered in error, and record reports a consultation, or adt reports it
     * discharged-not-closed or finished with a known disposition other than left-without-being-seen. Unknown state or
     * disposition does not fulfil.
     */
    override fun consultationCompleted(facts: AppointmentFacts): Boolean {
        val encounter = facts.linkedEncounter ?: return false
        val status = encounter.status
        val endedSeen = status in endedEncounterStates && encounter.leftWithoutBeingSeen == false
        return status != null && status !in voidEncounterStates && (encounter.consultationRecorded == true || endedSeen)
    }

    /**
     * The linked encounter is cancelled or entered in error, or discharged-not-closed or finished as left without
     * being seen, and record reports no consultation (an unknown answer is not "no consultation"). Disjoint from
     * [consultationCompleted].
     */
    override fun linkedEncounterEndedWithoutConsultation(facts: AppointmentFacts): Boolean {
        val encounter = facts.linkedEncounter ?: return false
        val status = encounter.status
        val ended = status in voidEncounterStates || (status in endedEncounterStates && encounter.leftWithoutBeingSeen == true)
        return status != null && ended && encounter.consultationRecorded == false
    }

    // ---- Cancellation.

    /** A governed cancellation reason chosen by the user; a code that requires text has non-blank text. */
    override fun cancellationReasonGiven(facts: AppointmentFacts): Boolean {
        val cancellation = facts.cancellation ?: return false
        val rule = facts.config.cancellationReasons[cancellation.reasonCode]
        val text = rule != null && (!rule.requiresText || !cancellation.reasonText.isNullOrBlank())
        return cancellation.reasonOrigin == ReasonOrigin.USER && text
    }

    /**
     * The requesting party and an authenticated entrant are recorded: a desk user, or, for the patient's own
     * cancellation, the front-door link's verified patient session.
     */
    override fun cancellingPartyRecorded(facts: AppointmentFacts): Boolean {
        val cancellation = facts.cancellation ?: return false
        val party = cancellation.requestingParty
        val channel =
            when (cancellation.channel) {
                null -> false
                EntryChannel.DESK_USER -> true
                EntryChannel.FRONT_DOOR_LINK -> party == CancellingParty.PATIENT
            }
        return party != null && channel && !cancellation.entrantId.isNullOrBlank() && cancellation.entrantAuthenticated
    }

    /**
     * The requesting party is the patient or their representative, or the governed list marks the reason as ending
     * the need. Unknown party and reason do not end the need.
     */
    override fun cancellationEndsNeed(facts: AppointmentFacts): Boolean = endsNeed(facts)

    /** The exact complement of [cancellationEndsNeed]. */
    override fun cancellationNeedsRebooking(facts: AppointmentFacts): Boolean = !endsNeed(facts)

    private fun endsNeed(facts: AppointmentFacts): Boolean {
        val cancellation = facts.cancellation ?: return false
        val partyEnds =
            cancellation.requestingParty == CancellingParty.PATIENT || cancellation.requestingParty == CancellingParty.REPRESENTATIVE
        return partyEnds || facts.config.cancellationReasons[cancellation.reasonCode]?.endsNeed == true
    }

    /** The late-cancel window is greater than zero, the appointment has a start, and now is at or after start minus window. */
    override fun lateCancellation(facts: AppointmentFacts): Boolean = isLate(facts)

    /** The exact complement of [lateCancellation]. */
    override fun timelyCancellation(facts: AppointmentFacts): Boolean = !isLate(facts)

    private fun isLate(facts: AppointmentFacts): Boolean {
        val window = window(facts.config.lateCancelWindow)
        val start = facts.appointmentSlot?.start ?: return false
        return !window.isZero && !facts.now.isBefore(start.minus(window))
    }

    // ---- No-show.

    /** The slot has an end and now is at or after the end plus the grace period (missing counts as zero). */
    override fun noShowGraceElapsed(facts: AppointmentFacts): Boolean {
        val end = facts.appointmentSlot?.end ?: return false
        return !facts.now.isBefore(end.plus(window(facts.config.noShowGrace)))
    }

    /** A governed no-show reason chosen by an authenticated user. */
    override fun noShowReasonGiven(facts: AppointmentFacts): Boolean {
        val noShow = facts.noShow ?: return false
        return noShow.reasonCode != null &&
            noShow.reasonCode in facts.config.noShowReasons &&
            noShow.reasonOrigin == ReasonOrigin.USER &&
            !noShow.enteredBy.isNullOrBlank() &&
            noShow.enteredByAuthenticated
    }

    /**
     * adt reports an open ED or inpatient encounter of the patient that overlaps the slot time. Reading for unknowns:
     * when the appointment's slot start or end is unknown, any open ED or inpatient encounter counts, so an unknown
     * never allows a no-show.
     */
    override fun patientInHospital(facts: AppointmentFacts): Boolean = inHospital(facts)

    /** The exact complement of [patientInHospital]. */
    override fun patientNotInHospital(facts: AppointmentFacts): Boolean = !inHospital(facts)

    private fun inHospital(facts: AppointmentFacts): Boolean {
        val slotStart = facts.appointmentSlot?.start
        val slotEnd = facts.appointmentSlot?.end
        return facts.patientEncounters.any { encounter ->
            encounter.status !in closedEncounterStates &&
                encounter.encounterClass in inHospitalClasses &&
                overlaps(encounter, slotStart, slotEnd)
        }
    }

    private fun overlaps(
        encounter: PatientEncounterFacts,
        slotStart: Instant?,
        slotEnd: Instant?,
    ): Boolean {
        if (slotStart == null || slotEnd == null) return true
        val endsAfterStart = encounter.end?.isAfter(slotStart) ?: true
        return encounter.start.isBefore(slotEnd) && endsAfterStart
    }

    // ---- Modification and corrections.

    /** The modification changes no slot attribute and at least one other attribute. */
    override fun modificationKeepsSlot(facts: AppointmentFacts): Boolean {
        val changed = facts.modification?.changedAttributes ?: return false
        return changed.none { it in slotAttributes } && changed.any { it !in slotAttributes }
    }

    /**
     * The user holds the correction privilege, or, for a ReverseNoShow on the slot's own date, the front-desk reversal
     * privilege (DN-057 item 9); and the audit record can be written (an audit outage refuses).
     */
    override fun privilegedAndAudited(facts: AppointmentFacts): Boolean {
        val correction = facts.correction ?: return false
        val sameDayReversal =
            correction.command == AppointmentCommand.ReverseNoShow &&
                correction.holdsFrontDeskReversalPrivilege &&
                facts.appointmentSlot?.date == facts.today
        return (correction.holdsCorrectionPrivilege || sameDayReversal) && correction.auditWritable
    }

    /** A non-blank correction reason entered by the user (never prefilled or defaulted). */
    override fun correctionReasonEntered(facts: AppointmentFacts): Boolean {
        val correction = facts.correction ?: return false
        return !correction.reason.isNullOrBlank() && correction.reasonOrigin == ReasonOrigin.USER
    }

    /** A configured window: missing or negative reads as zero. */
    private fun window(configured: Duration?): Duration = configured?.takeUnless { it.isNegative } ?: Duration.ZERO
}
