package hms.scheduling.domain.appointment

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant
import java.time.LocalDate

// Unit tests of every appointment predicate (docs/specs/state-machines/appointment.yaml; WP-0.5 spec §2.1 rule 12).
// Synthetic data only (SYN- identifiers); the configured windows and governed lists are samples, NOT FOR CLINICAL USE.

private val NOW: Instant = Instant.parse("2026-03-01T09:00:00Z")
private val TODAY: LocalDate = LocalDate.parse("2026-03-01")
private const val APPOINTMENT = "SYN-APT-0001"
private const val PATIENT = "SYN-PAT-0001"
private const val SERVICE = "SYN-SVC-CARDIO"
private const val PROVIDER = "SYN-PRV-01"
private const val LOCATION = "SYN-LOC-01"
private const val MRN = "SYN-MRN-00017"
private const val ROUTINE = "SYN-PRIO-ROUTINE"
private const val URGENT = "SYN-PRIO-URGENT"
private const val PATIENT_REQUEST = "SYN-CXL-PATIENT-REQUEST"
private const val CLINIC_CANCELLED = "SYN-CXL-CLINIC-CANCELLED"
private const val NOT_REQUIRED = "SYN-CXL-NOT-REQUIRED"
private const val OTHER = "SYN-CXL-OTHER"
private const val NO_SHOW_REASON = "SYN-NOSHOW-NOT-CONTACTED"
private const val DESK_USER = "SYN-USR-DESK-01"
private val DOB: LocalDate = LocalDate.parse("1980-05-17")

private fun minutes(value: Long): Duration = Duration.ofMinutes(value)

private val config =
    AppointmentConfig(
        earlyCheckInWindow = minutes(30),
        lateCancelWindow = Duration.ofHours(24),
        noShowGrace = minutes(15),
        waitlistPriorityRanks = mapOf(URGENT to 1, ROUTINE to 2),
        cancellationReasons =
            mapOf(
                PATIENT_REQUEST to CancellationReasonRule(requiresText = false, endsNeed = false),
                CLINIC_CANCELLED to CancellationReasonRule(requiresText = false, endsNeed = false),
                NOT_REQUIRED to CancellationReasonRule(requiresText = false, endsNeed = true),
                OTHER to CancellationReasonRule(requiresText = true, endsNeed = false),
            ),
        noShowReasons = setOf(NO_SHOW_REASON),
    )

private val targetSlot =
    SlotFacts(
        slotId = "SYN-SLOT-0002",
        status = SlotStatus.FREE,
        heldByAppointmentId = null,
        overbookable = false,
        overbookedCount = 0,
        overbookCap = null,
        start = NOW.plus(Duration.ofDays(1)),
        end = NOW.plus(Duration.ofDays(1)).plus(minutes(15)),
        date = TODAY.plusDays(1),
        serviceType = SERVICE,
        providerId = PROVIDER,
        locationId = LOCATION,
    )

private val entry =
    WaitlistEntryFacts(
        entryId = "SYN-WL-0005",
        serviceType = SERVICE,
        providers = emptySet(),
        locations = setOf(LOCATION),
        earliest = TODAY,
        latest = TODAY.plusDays(30),
        priorityCode = ROUTINE,
        priorityOrigin = ReasonOrigin.USER,
        waitlistedAt = NOW.minus(Duration.ofDays(10)),
        pastOffers = emptyList(),
    )

private val checkIn =
    CheckInFacts(
        statedName = "Syn Patient Alpha",
        nameSource = IdentifierSource.PATIENT_STATED,
        nameMatch = EmpiMatch.MATCH,
        presentedMrn = MRN,
        mrnSource = IdentifierSource.CARD_SCAN,
        mrnCheckDigitValid = true,
        empiSearchCandidates = emptyList(),
        statedDob = DOB,
        dobSource = IdentifierSource.PATIENT_STATED,
        statedApproximateAgeMatch = null,
        recordMrn = MRN,
        recordDob = DOB,
        recordDobPrecision = DobPrecision.DAY,
        recordApproximateDob = false,
    )

private val base =
    AppointmentFacts(
        appointmentId = APPOINTMENT,
        patientId = PATIENT,
        now = NOW,
        today = TODAY,
        config = config,
        appointmentSlot =
            AppointmentSlot(
                slotId = "SYN-SLOT-0001",
                start = NOW.plus(minutes(10)),
                end = NOW.plus(minutes(25)),
                sessionEnd = NOW.plus(Duration.ofHours(4)),
                date = TODAY,
            ),
        targetSlot = targetSlot,
        participants =
            listOf(
                ParticipantFacts(PATIENT, required = true, response = ParticipantResponse.ACCEPTED, responseSlotId = "SYN-SLOT-0002"),
                ParticipantFacts(PROVIDER, required = true, response = ParticipantResponse.ACCEPTED, responseSlotId = "SYN-SLOT-0002"),
                ParticipantFacts("SYN-EQP-01", required = false, response = ParticipantResponse.NEEDS_ACTION, responseSlotId = null),
            ),
        hold = HoldFacts(PendingReason.WAITLIST_OFFER, NOW.plus(Duration.ofHours(1))),
        waitlistEntry = entry,
        competingEntries = emptyList(),
        checkIn = checkIn,
        walkIn =
            WalkInFacts(
                requestedService = SERVICE,
                requestedProvider = null,
                sessions =
                    listOf(
                        SessionFacts(SERVICE, PROVIDER, acceptsWalkIns = true, start = NOW.minus(minutes(60)), end = NOW.plus(minutes(9))),
                    ),
            ),
        linkedEncounter = LinkedEncounterFacts(EncounterStatus.ARRIVED, leftWithoutBeingSeen = null, consultationRecorded = true),
        patientEncounters = emptyList(),
        cancellation =
            CancellationFacts(
                reasonCode = PATIENT_REQUEST,
                reasonOrigin = ReasonOrigin.USER,
                reasonText = null,
                requestingParty = CancellingParty.PATIENT,
                channel = EntryChannel.DESK_USER,
                entrantId = DESK_USER,
                entrantAuthenticated = true,
            ),
        noShow = NoShowFacts(NO_SHOW_REASON, ReasonOrigin.USER, DESK_USER, enteredByAuthenticated = true),
        modification = ModificationFacts(setOf(AppointmentAttribute.NOTES)),
        correction =
            CorrectionFacts(
                command = AppointmentCommand.UndoCheckIn,
                holdsCorrectionPrivilege = true,
                holdsFrontDeskReversalPrivilege = false,
                auditWritable = true,
                reason = "checked in against the wrong appointment",
                reasonOrigin = ReasonOrigin.USER,
            ),
    )

private val guards = AppointmentGuards

private fun AppointmentFacts.withSlot(transform: SlotFacts.() -> SlotFacts) = copy(targetSlot = targetSlot?.transform())

private fun AppointmentFacts.withCheckIn(transform: CheckInFacts.() -> CheckInFacts) = copy(checkIn = checkIn?.transform())

private fun AppointmentFacts.withEntry(transform: WaitlistEntryFacts.() -> WaitlistEntryFacts) =
    copy(waitlistEntry = waitlistEntry?.transform())

private fun AppointmentFacts.withAppointmentSlot(transform: AppointmentSlot.() -> AppointmentSlot) =
    copy(appointmentSlot = appointmentSlot?.transform())

private fun AppointmentFacts.withWalkIn(transform: WalkInFacts.() -> WalkInFacts) = copy(walkIn = walkIn?.transform())

private fun AppointmentFacts.withConfig(transform: AppointmentConfig.() -> AppointmentConfig) = copy(config = config.transform())

private fun AppointmentFacts.withCancellation(transform: CancellationFacts.() -> CancellationFacts) =
    copy(cancellation = cancellation?.transform())

private fun AppointmentFacts.withCorrection(transform: CorrectionFacts.() -> CorrectionFacts) = copy(correction = correction?.transform())

private fun AppointmentFacts.withEncounter(
    status: EncounterStatus?,
    leftWithoutBeingSeen: Boolean?,
    consultationRecorded: Boolean?,
) = copy(linkedEncounter = LinkedEncounterFacts(status, leftWithoutBeingSeen, consultationRecorded))

private fun encounter(
    status: EncounterStatus = EncounterStatus.IN_PROGRESS,
    encounterClass: EncounterClass = EncounterClass.INPATIENT,
    start: Instant = NOW.minus(Duration.ofDays(2)),
    end: Instant? = null,
) = PatientEncounterFacts(status, encounterClass, start, end)

class AppointmentGuardsTest :
    FunSpec({
        // ---- slotAvailable
        test("slotAvailable holds for a free slot that ends after now") { guards.slotAvailable(base) shouldBe true }
        test("slotAvailable holds for a running slot that has started but ends after now (same-day booking)") {
            guards.slotAvailable(base.withSlot { copy(start = NOW.minus(minutes(5)), end = NOW.plus(minutes(1))) }) shouldBe true
        }
        test("slotAvailable fails when the slot ends exactly now (boundary)") {
            guards.slotAvailable(base.withSlot { copy(start = NOW.minus(minutes(15)), end = NOW) }) shouldBe false
        }
        test("slotAvailable fails when the target slot does not exist") {
            guards.slotAvailable(base.copy(targetSlot = null)) shouldBe false
        }
        test("slotAvailable fails for a busy-unavailable slot even when overbookable") {
            guards.slotAvailable(
                base.withSlot { copy(status = SlotStatus.BUSY_UNAVAILABLE, overbookable = true, overbookCap = 3) },
            ) shouldBe false
        }
        test("slotAvailable fails for a slot entered in error") {
            guards.slotAvailable(base.withSlot { copy(status = SlotStatus.ENTERED_IN_ERROR) }) shouldBe false
        }
        test("slotAvailable holds for a slot held or booked by this same appointment") {
            guards.slotAvailable(
                base.withSlot { copy(status = SlotStatus.BUSY_TENTATIVE, heldByAppointmentId = APPOINTMENT) },
            ) shouldBe true
            guards.slotAvailable(base.withSlot { copy(status = SlotStatus.BUSY, heldByAppointmentId = APPOINTMENT) }) shouldBe true
        }
        test("slotAvailable fails for a slot booked by another appointment and not overbookable") {
            guards.slotAvailable(base.withSlot { copy(status = SlotStatus.BUSY, heldByAppointmentId = "SYN-APT-0099") }) shouldBe false
        }
        test("slotAvailable applies the overbook cap exactly: count strictly below the cap") {
            val busy = base.withSlot { copy(status = SlotStatus.BUSY, heldByAppointmentId = "SYN-APT-0099", overbookable = true) }
            guards.slotAvailable(busy.withSlot { copy(overbookedCount = 1, overbookCap = 2) }) shouldBe true
            guards.slotAvailable(busy.withSlot { copy(overbookedCount = 2, overbookCap = 2) }) shouldBe false
        }
        test("slotAvailable reads a missing overbook cap as zero") {
            guards.slotAvailable(
                base.withSlot {
                    copy(status = SlotStatus.BUSY, heldByAppointmentId = "SYN-APT-0099", overbookable = true, overbookCap = null)
                },
            ) shouldBe false
        }

        // ---- differentSlotRequested
        test("differentSlotRequested holds when the target slot is not the current slot") {
            guards.differentSlotRequested(base) shouldBe true
        }
        test("differentSlotRequested fails when the target slot is the current slot") {
            guards.differentSlotRequested(base.withSlot { copy(slotId = "SYN-SLOT-0001") }) shouldBe false
        }
        test("differentSlotRequested fails without a target slot") {
            guards.differentSlotRequested(base.copy(targetSlot = null)) shouldBe false
        }

        // ---- requiredParticipantsAccepted / participantAcceptanceAwaited (exact complements)
        test("requiredParticipantsAccepted holds and participantAcceptanceAwaited fails when every required participant accepted") {
            guards.requiredParticipantsAccepted(base) shouldBe true
            guards.participantAcceptanceAwaited(base) shouldBe false
        }
        test("requiredParticipantsAccepted fails and participantAcceptanceAwaited holds when a required participant has not answered") {
            val awaiting =
                base.copy(
                    participants =
                        base.participants.map {
                            if (it.participantId == PROVIDER) it.copy(response = ParticipantResponse.NEEDS_ACTION) else it
                        },
                )
            guards.requiredParticipantsAccepted(awaiting) shouldBe false
            guards.participantAcceptanceAwaited(awaiting) shouldBe true
        }
        test("requiredParticipantsAccepted does not count an acceptance given for an earlier slot (participantAcceptanceAwaited holds)") {
            val earlier =
                base.copy(participants = base.participants.map { if (it.required) it.copy(responseSlotId = "SYN-SLOT-0001") else it })
            guards.requiredParticipantsAccepted(earlier) shouldBe false
            guards.participantAcceptanceAwaited(earlier) shouldBe true
        }
        test("requiredParticipantsAccepted fails without a target slot; participantAcceptanceAwaited is its complement") {
            guards.requiredParticipantsAccepted(base.copy(targetSlot = null)) shouldBe false
            guards.participantAcceptanceAwaited(base.copy(targetSlot = null)) shouldBe true
        }

        // ---- waitlistEntryComplete
        test("waitlistEntryComplete holds for a complete entry with a user-chosen governed priority") {
            guards.waitlistEntryComplete(base) shouldBe true
        }
        test("waitlistEntryComplete fails for a defaulted priority") {
            guards.waitlistEntryComplete(base.withEntry { copy(priorityOrigin = ReasonOrigin.DEFAULTED) }) shouldBe false
        }
        test("waitlistEntryComplete fails for a priority outside the governed list or missing") {
            guards.waitlistEntryComplete(base.withEntry { copy(priorityCode = "SYN-PRIO-UNKNOWN") }) shouldBe false
            guards.waitlistEntryComplete(base.withEntry { copy(priorityCode = null) }) shouldBe false
        }
        test("waitlistEntryComplete fails without a service type, earliest or latest date") {
            guards.waitlistEntryComplete(base.withEntry { copy(serviceType = " ") }) shouldBe false
            guards.waitlistEntryComplete(base.withEntry { copy(earliest = null) }) shouldBe false
            guards.waitlistEntryComplete(base.withEntry { copy(latest = null) }) shouldBe false
        }
        test("waitlistEntryComplete date boundaries: earliest equal to latest and latest equal to today hold; latest before today fails") {
            guards.waitlistEntryComplete(base.withEntry { copy(earliest = TODAY, latest = TODAY) }) shouldBe true
            guards.waitlistEntryComplete(base.withEntry { copy(earliest = TODAY.minusDays(3), latest = TODAY.minusDays(1)) }) shouldBe false
            guards.waitlistEntryComplete(base.withEntry { copy(earliest = TODAY.plusDays(2), latest = TODAY.plusDays(1)) }) shouldBe false
        }
        test("waitlistEntryComplete fails without an entry") {
            guards.waitlistEntryComplete(base.copy(waitlistEntry = null)) shouldBe false
        }

        // ---- offeredSlotMatchesConstraints
        test("offeredSlotMatchesConstraints holds for a slot within the entry's service, locations and dates (no providers means any)") {
            guards.offeredSlotMatchesConstraints(base) shouldBe true
        }
        test("offeredSlotMatchesConstraints fails for another service, provider outside the set or location outside the set") {
            guards.offeredSlotMatchesConstraints(base.withSlot { copy(serviceType = "SYN-SVC-DERM") }) shouldBe false
            guards.offeredSlotMatchesConstraints(base.withEntry { copy(providers = setOf("SYN-PRV-02")) }) shouldBe false
            guards.offeredSlotMatchesConstraints(base.withSlot { copy(locationId = "SYN-LOC-09") }) shouldBe false
        }
        test("offeredSlotMatchesConstraints date boundaries: the earliest and latest dates are included") {
            guards.offeredSlotMatchesConstraints(
                base.withEntry { copy(earliest = TODAY.plusDays(1), latest = TODAY.plusDays(1)) },
            ) shouldBe true
            guards.offeredSlotMatchesConstraints(base.withEntry { copy(earliest = TODAY.plusDays(2)) }) shouldBe false
            guards.offeredSlotMatchesConstraints(base.withEntry { copy(earliest = TODAY.minusDays(1), latest = TODAY) }) shouldBe false
        }
        test("offeredSlotMatchesConstraints fails for a slot the entry declined, or let lapse after confirmed delivery") {
            val declined = PastOffer(targetSlot.slotId, OfferOutcome.DECLINED, deliveryConfirmed = false)
            val lapsedDelivered = PastOffer(targetSlot.slotId, OfferOutcome.LAPSED, deliveryConfirmed = true)
            guards.offeredSlotMatchesConstraints(base.withEntry { copy(pastOffers = listOf(declined)) }) shouldBe false
            guards.offeredSlotMatchesConstraints(base.withEntry { copy(pastOffers = listOf(lapsedDelivered)) }) shouldBe false
        }
        test("offeredSlotMatchesConstraints holds again after a lapse without confirmed delivery") {
            val lapsedUndelivered = PastOffer(targetSlot.slotId, OfferOutcome.LAPSED, deliveryConfirmed = false)
            guards.offeredSlotMatchesConstraints(base.withEntry { copy(pastOffers = listOf(lapsedUndelivered)) }) shouldBe true
        }
        test("offeredSlotMatchesConstraints fails without an entry or a target slot") {
            guards.offeredSlotMatchesConstraints(base.copy(waitlistEntry = null)) shouldBe false
            guards.offeredSlotMatchesConstraints(base.copy(targetSlot = null)) shouldBe false
        }

        // ---- topRankedForSlot
        val competitor = entry.copy(entryId = "SYN-WL-0003")
        test("topRankedForSlot holds with no competing entry") { guards.topRankedForSlot(base) shouldBe true }
        test("topRankedForSlot fails when a matching competitor has a lower priority rank") {
            guards.topRankedForSlot(base.copy(competingEntries = listOf(competitor.copy(priorityCode = URGENT)))) shouldBe false
        }
        test("topRankedForSlot holds when the competitor has a higher rank") {
            guards.topRankedForSlot(
                base.withEntry { copy(priorityCode = URGENT) }.copy(competingEntries = listOf(competitor.copy(priorityCode = ROUTINE))),
            ) shouldBe true
        }
        test("topRankedForSlot breaks equal ranks by the earlier waitlisting, then by the entry id") {
            val earlier = competitor.copy(waitlistedAt = entry.waitlistedAt.minusSeconds(1))
            val later = competitor.copy(waitlistedAt = entry.waitlistedAt.plusSeconds(1))
            guards.topRankedForSlot(base.copy(competingEntries = listOf(earlier))) shouldBe false
            guards.topRankedForSlot(base.copy(competingEntries = listOf(later))) shouldBe true
            guards.topRankedForSlot(base.copy(competingEntries = listOf(competitor))) shouldBe false
            guards.topRankedForSlot(base.copy(competingEntries = listOf(competitor.copy(entryId = "SYN-WL-0009")))) shouldBe true
        }
        test("topRankedForSlot ignores a competitor whose constraints do not match the slot, and the entry itself") {
            val elsewhere = competitor.copy(priorityCode = URGENT, locations = setOf("SYN-LOC-09"))
            guards.topRankedForSlot(base.copy(competingEntries = listOf(elsewhere, entry))) shouldBe true
        }
        test("topRankedForSlot fails closed on unknown ranks: this entry without a governed rank, or a competitor without one") {
            guards.topRankedForSlot(base.withEntry { copy(priorityCode = "SYN-PRIO-UNKNOWN") }) shouldBe false
            guards.topRankedForSlot(base.copy(competingEntries = listOf(competitor.copy(priorityCode = null)))) shouldBe false
        }

        // ---- waitlistOffer / notWaitlistOffer (exact complements)
        test("waitlistOffer holds and notWaitlistOffer fails for a waitlist-offer hold") {
            guards.waitlistOffer(base) shouldBe true
            guards.notWaitlistOffer(base) shouldBe false
        }
        test("waitlistOffer fails and notWaitlistOffer holds for an acceptance hold, an unknown reason or no hold") {
            listOf(
                base.copy(hold = HoldFacts(PendingReason.AWAITING_ACCEPTANCE, NOW.plusSeconds(60))),
                base.copy(hold = HoldFacts(null, NOW.plusSeconds(60))),
                base.copy(hold = null),
            ).forEach { facts ->
                guards.waitlistOffer(facts) shouldBe false
                guards.notWaitlistOffer(facts) shouldBe true
            }
        }

        // ---- holdResponseWindowOpen / holdResponseWindowElapsed (exact complements)
        test("holdResponseWindowOpen holds and holdResponseWindowElapsed fails strictly before the respond-by instant") {
            val facts = base.copy(hold = HoldFacts(PendingReason.AWAITING_ACCEPTANCE, NOW.plusNanos(1)))
            guards.holdResponseWindowOpen(facts) shouldBe true
            guards.holdResponseWindowElapsed(facts) shouldBe false
        }
        test("holdResponseWindowOpen fails and holdResponseWindowElapsed holds at exactly the respond-by instant (boundary)") {
            val facts = base.copy(hold = HoldFacts(PendingReason.WAITLIST_OFFER, NOW))
            guards.holdResponseWindowOpen(facts) shouldBe false
            guards.holdResponseWindowElapsed(facts) shouldBe true
        }
        test("holdResponseWindowElapsed holds when the hold has no respond-by instant or there is no hold (holdResponseWindowOpen fails)") {
            listOf(base.copy(hold = HoldFacts(PendingReason.AWAITING_ACCEPTANCE, null)), base.copy(hold = null)).forEach { facts ->
                guards.holdResponseWindowOpen(facts) shouldBe false
                guards.holdResponseWindowElapsed(facts) shouldBe true
            }
        }

        // ---- waitlistWindowEnded
        test("waitlistWindowEnded holds when the latest acceptable date is strictly before today") {
            guards.waitlistWindowEnded(base.withEntry { copy(latest = TODAY.minusDays(1)) }) shouldBe true
        }
        test("waitlistWindowEnded fails when the latest date is today (boundary) or later") {
            guards.waitlistWindowEnded(base.withEntry { copy(latest = TODAY) }) shouldBe false
            guards.waitlistWindowEnded(base) shouldBe false
        }
        test("waitlistWindowEnded fails without an entry or a latest date") {
            guards.waitlistWindowEnded(base.copy(waitlistEntry = null)) shouldBe false
            guards.waitlistWindowEnded(base.withEntry { copy(latest = null) }) shouldBe false
        }

        // ---- patientIdentifiedByTwoIdentifiers (SI-01)
        test("patientIdentifiedByTwoIdentifiers holds for a stated name matched by empi, a scanned valid MRN and the stated DOB") {
            guards.patientIdentifiedByTwoIdentifiers(base) shouldBe true
        }
        test("patientIdentifiedByTwoIdentifiers holds for an MRN from a wristband scan or stated by the patient") {
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(mrnSource = IdentifierSource.WRISTBAND_SCAN) }) shouldBe true
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(mrnSource = IdentifierSource.PATIENT_STATED) }) shouldBe true
        }
        test("patientIdentifiedByTwoIdentifiers fails for an unconfirmed name: no match, empi unavailable, blank, or screen-read") {
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(nameMatch = EmpiMatch.NO_MATCH) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(nameMatch = EmpiMatch.UNAVAILABLE) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(nameMatch = null) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(statedName = "") }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(nameSource = IdentifierSource.SCREEN_CONFIRMED) },
            ) shouldBe false
        }
        test("patientIdentifiedByTwoIdentifiers fails for an invalid or unknown check digit, or another patient's MRN") {
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(mrnCheckDigitValid = false) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(mrnCheckDigitValid = null) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(presentedMrn = "SYN-MRN-00018") }) shouldBe false
        }
        test("patientIdentifiedByTwoIdentifiers never accepts a screen-confirmed MRN or a room, bed, token or appointment number") {
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(mrnSource = IdentifierSource.SCREEN_CONFIRMED) },
            ) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(mrnSource = IdentifierSource.LOCATION_TOKEN_OR_APPOINTMENT_NUMBER) },
            ) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(mrnSource = null) }) shouldBe false
        }
        test("patientIdentifiedByTwoIdentifiers without a card: an empi search on stated name and DOB with exactly this patient holds") {
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(mrnSource = IdentifierSource.EMPI_SEARCH, empiSearchCandidates = listOf(PATIENT)) },
            ) shouldBe true
        }
        test("patientIdentifiedByTwoIdentifiers without a card fails for several, no or another candidate, or no stated DOB") {
            val search = base.withCheckIn { copy(mrnSource = IdentifierSource.EMPI_SEARCH) }
            guards.patientIdentifiedByTwoIdentifiers(
                search.withCheckIn { copy(empiSearchCandidates = listOf(PATIENT, "SYN-PAT-0002")) },
            ) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(search.withCheckIn { copy(empiSearchCandidates = emptyList()) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(
                search.withCheckIn { copy(empiSearchCandidates = listOf("SYN-PAT-0002")) },
            ) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(
                search.withCheckIn {
                    copy(
                        empiSearchCandidates = listOf(PATIENT),
                        statedDob = null,
                        recordApproximateDob = true,
                        statedApproximateAgeMatch = EmpiMatch.MATCH,
                    )
                },
            ) shouldBe false
        }
        test("patientIdentifiedByTwoIdentifiers fails for a stated DOB that differs, is missing, or was read from the screen") {
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(statedDob = DOB.plusDays(1)) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(statedDob = null) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(dobSource = IdentifierSource.SCREEN_CONFIRMED) },
            ) shouldBe false
        }
        test("patientIdentifiedByTwoIdentifiers compares the DOB at the record's precision (month, year); unknown precision fails") {
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(recordDobPrecision = DobPrecision.MONTH, statedDob = DOB.withDayOfMonth(1)) },
            ) shouldBe true
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(recordDobPrecision = DobPrecision.MONTH, statedDob = DOB.plusMonths(1)) },
            ) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(recordDobPrecision = DobPrecision.YEAR, statedDob = DOB.withDayOfYear(1)) },
            ) shouldBe true
            guards.patientIdentifiedByTwoIdentifiers(
                base.withCheckIn { copy(recordDobPrecision = DobPrecision.YEAR, statedDob = DOB.plusYears(1)) },
            ) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(recordDobPrecision = null) }) shouldBe false
        }
        test("patientIdentifiedByTwoIdentifiers for an approximate-DOB record needs empi's match of the stated age or birth year") {
            val approximate = base.withCheckIn { copy(recordApproximateDob = true, statedDob = null) }
            guards.patientIdentifiedByTwoIdentifiers(
                approximate.withCheckIn { copy(statedApproximateAgeMatch = EmpiMatch.MATCH) },
            ) shouldBe true
            guards.patientIdentifiedByTwoIdentifiers(
                approximate.withCheckIn { copy(statedApproximateAgeMatch = EmpiMatch.NO_MATCH) },
            ) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(approximate.withCheckIn { copy(statedApproximateAgeMatch = null) }) shouldBe false
        }
        test("patientIdentifiedByTwoIdentifiers fails for a record without MRN, DOB or approximate-DOB flag, or no check-in facts") {
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(recordMrn = null) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(recordDob = null) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.withCheckIn { copy(recordApproximateDob = null) }) shouldBe false
            guards.patientIdentifiedByTwoIdentifiers(base.copy(checkIn = null)) shouldBe false
        }

        // ---- withinCheckInWindow
        test("withinCheckInWindow holds from exactly the slot start minus the early window (boundary)") {
            guards.withinCheckInWindow(base.withAppointmentSlot { copy(start = NOW.plus(minutes(30))) }) shouldBe true
        }
        test("withinCheckInWindow fails one nanosecond before the early window opens") {
            guards.withinCheckInWindow(base.withAppointmentSlot { copy(start = NOW.plus(minutes(30)).plusNanos(1)) }) shouldBe false
        }
        test("withinCheckInWindow fails at exactly the session end (boundary) and holds just before it, past midnight included") {
            val evening = base.withAppointmentSlot { copy(start = NOW.minus(Duration.ofHours(3)), sessionEnd = NOW) }
            guards.withinCheckInWindow(evening) shouldBe false
            guards.withinCheckInWindow(evening.withAppointmentSlot { copy(sessionEnd = NOW.plusNanos(1)) }) shouldBe true
        }
        test("withinCheckInWindow reads a missing or negative early window as zero") {
            val atStart = base.withAppointmentSlot { copy(start = NOW) }
            val early = base.withAppointmentSlot { copy(start = NOW.plusSeconds(1)) }
            guards.withinCheckInWindow(atStart.withConfig { copy(earlyCheckInWindow = null) }) shouldBe true
            guards.withinCheckInWindow(early.withConfig { copy(earlyCheckInWindow = null) }) shouldBe false
            guards.withinCheckInWindow(early.withConfig { copy(earlyCheckInWindow = minutes(-60)) }) shouldBe false
        }
        test("withinCheckInWindow fails without a slot start, a session end or a slot") {
            guards.withinCheckInWindow(base.withAppointmentSlot { copy(start = null) }) shouldBe false
            guards.withinCheckInWindow(base.withAppointmentSlot { copy(sessionEnd = null) }) shouldBe false
            guards.withinCheckInWindow(base.copy(appointmentSlot = null)) shouldBe false
        }

        // ---- walkInSessionOpen
        test("walkInSessionOpen holds for a running walk-in session of the requested service") {
            guards.walkInSessionOpen(base) shouldBe true
        }
        test("walkInSessionOpen boundaries: holds at exactly the session start, fails at exactly its end") {
            val session = SessionFacts(SERVICE, PROVIDER, acceptsWalkIns = true, start = NOW, end = NOW.plus(minutes(60)))
            val ended = session.copy(start = NOW.minus(minutes(60)), end = NOW)
            guards.walkInSessionOpen(base.withWalkIn { copy(sessions = listOf(session)) }) shouldBe true
            guards.walkInSessionOpen(base.withWalkIn { copy(sessions = listOf(ended)) }) shouldBe false
        }
        test("walkInSessionOpen fails for a session that accepts no walk-ins, another service, or another requested provider") {
            guards.walkInSessionOpen(base.withWalkIn { copy(sessions = sessions.map { it.copy(acceptsWalkIns = false) }) }) shouldBe false
            guards.walkInSessionOpen(base.withWalkIn { copy(requestedService = "SYN-SVC-DERM") }) shouldBe false
            guards.walkInSessionOpen(base.withWalkIn { copy(requestedProvider = "SYN-PRV-02") }) shouldBe false
            guards.walkInSessionOpen(base.withWalkIn { copy(requestedProvider = PROVIDER) }) shouldBe true
        }
        test("walkInSessionOpen fails without a requested service or walk-in facts") {
            guards.walkInSessionOpen(base.withWalkIn { copy(requestedService = null) }) shouldBe false
            guards.walkInSessionOpen(base.copy(walkIn = null)) shouldBe false
        }

        // ---- consultationCompleted / linkedEncounterEndedWithoutConsultation (disjoint)
        test("consultationCompleted holds when record reports a consultation, whatever the open encounter state") {
            val open = EncounterStatus.entries.filterNot { it == EncounterStatus.CANCELLED || it == EncounterStatus.ENTERED_IN_ERROR }
            open.forEach { status ->
                guards.consultationCompleted(
                    base.withEncounter(status, leftWithoutBeingSeen = null, consultationRecorded = true),
                ) shouldBe true
            }
        }
        test("consultationCompleted holds for discharged-not-closed or finished with a disposition other than left-without-being-seen") {
            listOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED).forEach { status ->
                guards.consultationCompleted(
                    base.withEncounter(status, leftWithoutBeingSeen = false, consultationRecorded = false),
                ) shouldBe true
            }
        }
        test("consultationCompleted fails for every encounter state without a consultation and without an ended, seen disposition") {
            EncounterStatus.entries.forEach { status ->
                guards.consultationCompleted(
                    base.withEncounter(status, leftWithoutBeingSeen = null, consultationRecorded = false),
                ) shouldBe false
                guards.consultationCompleted(
                    base.withEncounter(status, leftWithoutBeingSeen = true, consultationRecorded = null),
                ) shouldBe false
            }
        }
        test("consultationCompleted fails for a cancelled or entered-in-error encounter even with a consultation, and for unknown state") {
            guards.consultationCompleted(base.withEncounter(EncounterStatus.CANCELLED, null, true)) shouldBe false
            guards.consultationCompleted(base.withEncounter(EncounterStatus.ENTERED_IN_ERROR, null, true)) shouldBe false
            guards.consultationCompleted(base.withEncounter(null, false, true)) shouldBe false
            guards.consultationCompleted(base.copy(linkedEncounter = null)) shouldBe false
        }
        test("linkedEncounterEndedWithoutConsultation holds for cancelled, entered in error, or left without being seen, unconsulted") {
            guards.linkedEncounterEndedWithoutConsultation(base.withEncounter(EncounterStatus.CANCELLED, null, false)) shouldBe true
            guards.linkedEncounterEndedWithoutConsultation(base.withEncounter(EncounterStatus.ENTERED_IN_ERROR, null, false)) shouldBe true
            guards.linkedEncounterEndedWithoutConsultation(
                base.withEncounter(EncounterStatus.DISCHARGED_NOT_CLOSED, true, false),
            ) shouldBe true
            guards.linkedEncounterEndedWithoutConsultation(base.withEncounter(EncounterStatus.FINISHED, true, false)) shouldBe true
        }
        test("linkedEncounterEndedWithoutConsultation fails with a consultation, an unknown consultation answer, or an open encounter") {
            guards.linkedEncounterEndedWithoutConsultation(base.withEncounter(EncounterStatus.CANCELLED, null, true)) shouldBe false
            guards.linkedEncounterEndedWithoutConsultation(base.withEncounter(EncounterStatus.CANCELLED, null, null)) shouldBe false
            guards.linkedEncounterEndedWithoutConsultation(base.withEncounter(EncounterStatus.FINISHED, false, false)) shouldBe false
            guards.linkedEncounterEndedWithoutConsultation(base.withEncounter(EncounterStatus.ARRIVED, true, false)) shouldBe false
            guards.linkedEncounterEndedWithoutConsultation(base.withEncounter(null, true, false)) shouldBe false
            guards.linkedEncounterEndedWithoutConsultation(base.copy(linkedEncounter = null)) shouldBe false
        }
        test("consultationCompleted and linkedEncounterEndedWithoutConsultation never both hold, for every encounter state and answer") {
            val answers = listOf(true, false, null)
            (EncounterStatus.entries + listOf(null)).forEach { status ->
                answers.forEach { lwbs ->
                    answers.forEach { consultation ->
                        val facts = base.withEncounter(status, lwbs, consultation)
                        (guards.consultationCompleted(facts) && guards.linkedEncounterEndedWithoutConsultation(facts)) shouldBe false
                    }
                }
            }
        }

        // ---- cancellationReasonGiven
        test("cancellationReasonGiven holds for a governed reason chosen by the user") {
            guards.cancellationReasonGiven(base) shouldBe true
        }
        test("cancellationReasonGiven fails for a prefilled, defaulted or carried-over reason") {
            listOf(ReasonOrigin.PREFILLED, ReasonOrigin.DEFAULTED, ReasonOrigin.CARRIED_OVER, null).forEach { origin ->
                guards.cancellationReasonGiven(base.withCancellation { copy(reasonOrigin = origin) }) shouldBe false
            }
        }
        test("cancellationReasonGiven fails for a code outside the governed list or no code") {
            guards.cancellationReasonGiven(base.withCancellation { copy(reasonCode = "SYN-CXL-UNKNOWN") }) shouldBe false
            guards.cancellationReasonGiven(base.withCancellation { copy(reasonCode = null) }) shouldBe false
            guards.cancellationReasonGiven(base.copy(cancellation = null)) shouldBe false
        }
        test("cancellationReasonGiven needs non-blank text for a code that requires it") {
            guards.cancellationReasonGiven(base.withCancellation { copy(reasonCode = OTHER, reasonText = "  ") }) shouldBe false
            guards.cancellationReasonGiven(base.withCancellation { copy(reasonCode = OTHER, reasonText = "moved abroad") }) shouldBe true
        }

        // ---- cancellingPartyRecorded
        test("cancellingPartyRecorded holds for a requesting party entered by an authenticated desk user") {
            guards.cancellingPartyRecorded(base) shouldBe true
        }
        test("cancellingPartyRecorded holds for the patient's own cancellation through a verified front-door session") {
            guards.cancellingPartyRecorded(
                base.withCancellation { copy(channel = EntryChannel.FRONT_DOOR_LINK, entrantId = PATIENT) },
            ) shouldBe true
        }
        test("cancellingPartyRecorded fails for a front-door entry on behalf of anyone but the patient") {
            guards.cancellingPartyRecorded(
                base.withCancellation { copy(channel = EntryChannel.FRONT_DOOR_LINK, requestingParty = CancellingParty.HOSPITAL) },
            ) shouldBe false
        }
        test("cancellingPartyRecorded fails without a party, a channel, an entrant, or authentication") {
            guards.cancellingPartyRecorded(base.withCancellation { copy(requestingParty = null) }) shouldBe false
            guards.cancellingPartyRecorded(base.withCancellation { copy(channel = null) }) shouldBe false
            guards.cancellingPartyRecorded(base.withCancellation { copy(entrantId = " ") }) shouldBe false
            guards.cancellingPartyRecorded(base.withCancellation { copy(entrantAuthenticated = false) }) shouldBe false
            guards.cancellingPartyRecorded(base.copy(cancellation = null)) shouldBe false
        }

        // ---- cancellationEndsNeed / cancellationNeedsRebooking (exact complements)
        test("cancellationEndsNeed holds and cancellationNeedsRebooking fails when the patient or representative cancels") {
            listOf(CancellingParty.PATIENT, CancellingParty.REPRESENTATIVE).forEach { party ->
                val facts = base.withCancellation { copy(requestingParty = party, reasonCode = CLINIC_CANCELLED) }
                guards.cancellationEndsNeed(facts) shouldBe true
                guards.cancellationNeedsRebooking(facts) shouldBe false
            }
        }
        test("cancellationEndsNeed holds for a hospital cancellation whose governed reason ends the need") {
            val facts = base.withCancellation { copy(requestingParty = CancellingParty.PRACTITIONER, reasonCode = NOT_REQUIRED) }
            guards.cancellationEndsNeed(facts) shouldBe true
            guards.cancellationNeedsRebooking(facts) shouldBe false
        }
        test("cancellationNeedsRebooking holds and cancellationEndsNeed fails for a hospital or practitioner capacity reason") {
            listOf(CancellingParty.HOSPITAL, CancellingParty.PRACTITIONER).forEach { party ->
                val facts = base.withCancellation { copy(requestingParty = party, reasonCode = CLINIC_CANCELLED) }
                guards.cancellationEndsNeed(facts) shouldBe false
                guards.cancellationNeedsRebooking(facts) shouldBe true
            }
        }
        test("cancellationNeedsRebooking holds for unknown party and reason: an unknown never ends the need (cancellationEndsNeed fails)") {
            val unknown = base.withCancellation { copy(requestingParty = null, reasonCode = null) }
            guards.cancellationEndsNeed(unknown) shouldBe false
            guards.cancellationNeedsRebooking(unknown) shouldBe true
            guards.cancellationEndsNeed(base.copy(cancellation = null)) shouldBe false
            guards.cancellationNeedsRebooking(base.copy(cancellation = null)) shouldBe true
        }

        // ---- lateCancellation / timelyCancellation (exact complements)
        test("lateCancellation holds and timelyCancellation fails at exactly start minus the window (boundary)") {
            val facts = base.withAppointmentSlot { copy(start = NOW.plus(Duration.ofHours(24))) }
            guards.lateCancellation(facts) shouldBe true
            guards.timelyCancellation(facts) shouldBe false
        }
        test("lateCancellation fails and timelyCancellation holds just before the window opens") {
            val facts = base.withAppointmentSlot { copy(start = NOW.plus(Duration.ofHours(24)).plusNanos(1)) }
            guards.lateCancellation(facts) shouldBe false
            guards.timelyCancellation(facts) shouldBe true
        }
        test("lateCancellation holds after the start") {
            guards.lateCancellation(base.withAppointmentSlot { copy(start = NOW.minus(minutes(5))) }) shouldBe true
        }
        test("lateCancellation fails for a window of zero, missing or negative, even after the start (timelyCancellation holds)") {
            val started = base.withAppointmentSlot { copy(start = NOW.minus(minutes(5))) }
            listOf(Duration.ZERO, null, minutes(-10)).forEach { window ->
                val facts = started.withConfig { copy(lateCancelWindow = window) }
                guards.lateCancellation(facts) shouldBe false
                guards.timelyCancellation(facts) shouldBe true
            }
        }
        test("lateCancellation fails without a start instant (timelyCancellation holds)") {
            listOf(base.withAppointmentSlot { copy(start = null) }, base.copy(appointmentSlot = null)).forEach { facts ->
                guards.lateCancellation(facts) shouldBe false
                guards.timelyCancellation(facts) shouldBe true
            }
        }

        // ---- noShowGraceElapsed
        test("noShowGraceElapsed holds at exactly the slot end plus the grace period (boundary)") {
            guards.noShowGraceElapsed(base.withAppointmentSlot { copy(end = NOW.minus(minutes(15))) }) shouldBe true
        }
        test("noShowGraceElapsed fails just before the slot end plus the grace period, and is measured from the end, not the start") {
            guards.noShowGraceElapsed(base.withAppointmentSlot { copy(end = NOW.minus(minutes(15)).plusNanos(1)) }) shouldBe false
            guards.noShowGraceElapsed(
                base.withAppointmentSlot { copy(start = NOW.minus(Duration.ofHours(2)), end = NOW.plus(minutes(1))) },
            ) shouldBe false
        }
        test("noShowGraceElapsed reads a missing grace period as zero") {
            guards.noShowGraceElapsed(base.withAppointmentSlot { copy(end = NOW) }.withConfig { copy(noShowGrace = null) }) shouldBe true
            guards.noShowGraceElapsed(
                base.withAppointmentSlot { copy(end = NOW.plusNanos(1)) }.withConfig { copy(noShowGrace = null) },
            ) shouldBe false
        }
        test("noShowGraceElapsed fails without a slot end") {
            guards.noShowGraceElapsed(base.withAppointmentSlot { copy(end = null) }) shouldBe false
            guards.noShowGraceElapsed(base.copy(appointmentSlot = null)) shouldBe false
        }

        // ---- noShowReasonGiven
        test("noShowReasonGiven holds for a governed reason chosen by an authenticated user") {
            guards.noShowReasonGiven(base) shouldBe true
        }
        test("noShowReasonGiven fails for a defaulted reason, a code outside the list, no user, or an unauthenticated user") {
            guards.noShowReasonGiven(base.copy(noShow = base.noShow?.copy(reasonOrigin = ReasonOrigin.DEFAULTED))) shouldBe false
            guards.noShowReasonGiven(base.copy(noShow = base.noShow?.copy(reasonCode = "SYN-NOSHOW-OTHER"))) shouldBe false
            guards.noShowReasonGiven(base.copy(noShow = base.noShow?.copy(reasonCode = null))) shouldBe false
            guards.noShowReasonGiven(base.copy(noShow = base.noShow?.copy(enteredBy = null))) shouldBe false
            guards.noShowReasonGiven(base.copy(noShow = base.noShow?.copy(enteredByAuthenticated = false))) shouldBe false
            guards.noShowReasonGiven(base.copy(noShow = null)) shouldBe false
        }

        // ---- patientInHospital / patientNotInHospital (exact complements)
        test("patientInHospital holds and patientNotInHospital fails for an open inpatient or ED encounter overlapping the slot") {
            listOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY).forEach { encounterClass ->
                val facts = base.copy(patientEncounters = listOf(encounter(encounterClass = encounterClass)))
                guards.patientInHospital(facts) shouldBe true
                guards.patientNotInHospital(facts) shouldBe false
            }
        }
        test("patientInHospital fails and patientNotInHospital holds with no encounter, an outpatient encounter, or a closed one") {
            val cases =
                listOf(emptyList(), listOf(encounter(encounterClass = EncounterClass.OUTPATIENT))) +
                    listOf(
                        EncounterStatus.DISCHARGED_NOT_CLOSED,
                        EncounterStatus.FINISHED,
                        EncounterStatus.CANCELLED,
                        EncounterStatus.ENTERED_IN_ERROR,
                    ).map { listOf(encounter(status = it)) }
            cases.forEach { encounters ->
                val facts = base.copy(patientEncounters = encounters)
                guards.patientInHospital(facts) shouldBe false
                guards.patientNotInHospital(facts) shouldBe true
            }
        }
        test("patientInHospital overlap boundaries: ending exactly at the slot start or starting exactly at its end does not overlap") {
            val slot = base.appointmentSlot
            val start = slot?.start ?: NOW
            val end = slot?.end ?: NOW
            guards.patientInHospital(
                base.copy(patientEncounters = listOf(encounter(start = start.minus(minutes(60)), end = start))),
            ) shouldBe false
            guards.patientInHospital(base.copy(patientEncounters = listOf(encounter(start = end)))) shouldBe false
            guards.patientInHospital(base.copy(patientEncounters = listOf(encounter(start = end.minusNanos(1))))) shouldBe true
            guards.patientNotInHospital(base.copy(patientEncounters = listOf(encounter(start = end)))) shouldBe true
        }
        test("patientInHospital counts any open ED or inpatient encounter when the slot time is unknown (patientNotInHospital fails)") {
            val facts =
                base
                    .withAppointmentSlot { copy(start = null) }
                    .copy(patientEncounters = listOf(encounter(start = NOW.plus(Duration.ofDays(9)))))
            guards.patientInHospital(facts) shouldBe true
            guards.patientNotInHospital(facts) shouldBe false
        }

        // ---- modificationKeepsSlot
        test("modificationKeepsSlot holds for changes that leave the slot, times, resource and location alone") {
            listOf(
                AppointmentAttribute.REASON,
                AppointmentAttribute.SERVICE_TYPE_WITHIN_SLOT_SERVICE,
                AppointmentAttribute.NOTES,
                AppointmentAttribute.INTERPRETER_NEED,
                AppointmentAttribute.NON_SCHEDULED_PARTICIPANTS,
                AppointmentAttribute.WAITLIST_PRIORITY,
                AppointmentAttribute.WAITLIST_CONSTRAINTS,
            ).forEach { attribute ->
                guards.modificationKeepsSlot(base.copy(modification = ModificationFacts(setOf(attribute)))) shouldBe true
            }
        }
        test("modificationKeepsSlot fails when any slot attribute changes, even with other changes") {
            listOf(
                AppointmentAttribute.SLOT,
                AppointmentAttribute.START,
                AppointmentAttribute.END,
                AppointmentAttribute.SCHEDULED_RESOURCE,
                AppointmentAttribute.LOCATION,
                AppointmentAttribute.SERVICE_TYPE_OUTSIDE_SLOT_SERVICE,
            ).forEach { attribute ->
                guards.modificationKeepsSlot(
                    base.copy(modification = ModificationFacts(setOf(attribute, AppointmentAttribute.NOTES))),
                ) shouldBe false
            }
        }
        test("modificationKeepsSlot fails for an empty modification or none") {
            guards.modificationKeepsSlot(base.copy(modification = ModificationFacts(emptySet()))) shouldBe false
            guards.modificationKeepsSlot(base.copy(modification = null)) shouldBe false
        }

        // ---- privilegedAndAudited
        test("privilegedAndAudited holds with the correction privilege and a writable audit record") {
            guards.privilegedAndAudited(base) shouldBe true
        }
        test("privilegedAndAudited fails when the audit record cannot be written (an audit outage refuses)") {
            guards.privilegedAndAudited(base.withCorrection { copy(auditWritable = false) }) shouldBe false
        }
        test("privilegedAndAudited fails without the correction privilege") {
            guards.privilegedAndAudited(base.withCorrection { copy(holdsCorrectionPrivilege = false) }) shouldBe false
            guards.privilegedAndAudited(base.copy(correction = null)) shouldBe false
        }
        test("privilegedAndAudited accepts the front-desk reversal privilege only for a same-day ReverseNoShow") {
            val frontDesk = base.withCorrection { copy(holdsCorrectionPrivilege = false, holdsFrontDeskReversalPrivilege = true) }
            guards.privilegedAndAudited(frontDesk.withCorrection { copy(command = AppointmentCommand.ReverseNoShow) }) shouldBe true
            guards.privilegedAndAudited(
                frontDesk
                    .withCorrection { copy(command = AppointmentCommand.ReverseNoShow) }
                    .withAppointmentSlot { copy(date = TODAY.minusDays(1)) },
            ) shouldBe false
            guards.privilegedAndAudited(frontDesk.withCorrection { copy(command = AppointmentCommand.MarkEnteredInError) }) shouldBe false
            guards.privilegedAndAudited(frontDesk.withCorrection { copy(command = AppointmentCommand.UndoCheckIn) }) shouldBe false
            guards.privilegedAndAudited(
                frontDesk.withCorrection { copy(command = AppointmentCommand.ReverseNoShow, auditWritable = false) },
            ) shouldBe false
        }

        // ---- correctionReasonEntered
        test("correctionReasonEntered holds for a reason the user entered") { guards.correctionReasonEntered(base) shouldBe true }
        test("correctionReasonEntered fails for a blank, prefilled or defaulted reason, or no correction") {
            guards.correctionReasonEntered(base.withCorrection { copy(reason = " ") }) shouldBe false
            guards.correctionReasonEntered(base.withCorrection { copy(reasonOrigin = ReasonOrigin.PREFILLED) }) shouldBe false
            guards.correctionReasonEntered(base.withCorrection { copy(reasonOrigin = ReasonOrigin.DEFAULTED) }) shouldBe false
            guards.correctionReasonEntered(base.copy(correction = null)) shouldBe false
        }
    })
