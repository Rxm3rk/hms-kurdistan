package hms.scheduling.domain.appointment

import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import kotlin.random.Random

// Facts generator for the appointment machine (WP-0.5 spec §2.3, §3.3; contracts §4). Synthetic data only (SYN-
// identifiers); the windows, governed lists and priorities are samples, NOT FOR CLINICAL USE. Each draw builds one
// world around a fixed clock reading and then perturbs each part with a modest probability, so every guard holds
// often enough for property P7 (every transition fires in 1,000 sequences) while refusals, unknowns and boundary
// values (exactly now, exactly the window edge) stay common, and every predicate both holds and fails.

private val NOW: Instant = Instant.parse("2026-03-01T09:00:00Z")
private val TODAY: LocalDate = LocalDate.parse("2026-03-01")
private const val APPOINTMENT = "SYN-APT-0001"
private const val PATIENT = "SYN-PAT-0001"
private const val OTHER_PATIENT = "SYN-PAT-0002"
private const val SERVICE = "SYN-SVC-CARDIO"
private const val OTHER_SERVICE = "SYN-SVC-DERM"
private const val PROVIDER = "SYN-PRV-01"
private const val OTHER_PROVIDER = "SYN-PRV-02"
private const val LOCATION = "SYN-LOC-01"
private const val OTHER_LOCATION = "SYN-LOC-02"
private const val CURRENT_SLOT = "SYN-SLOT-0001"
private const val TARGET_SLOT = "SYN-SLOT-0002"
private const val MRN = "SYN-MRN-00017"
private const val ROUTINE = "SYN-PRIO-ROUTINE"
private const val URGENT = "SYN-PRIO-URGENT"
private const val PATIENT_REQUEST = "SYN-CXL-PATIENT-REQUEST"
private const val CLINIC_CANCELLED = "SYN-CXL-CLINIC-CANCELLED"
private const val NOT_REQUIRED = "SYN-CXL-NOT-REQUIRED"
private const val OTHER_REASON = "SYN-CXL-OTHER"
private const val NO_SHOW_REASON = "SYN-NOSHOW-NOT-CONTACTED"
private const val DESK_USER = "SYN-USR-DESK-01"
private const val URGENT_RANK = 1
private const val ROUTINE_RANK = 2
private const val OVERBOOK_CAP = 2
private const val SLOT_MINUTES = 15L
private const val EARLY_MINUTES = 30L
private const val GRACE_MINUTES = 15L
private const val LATE_HOURS = 24L
private const val WAITLIST_DAYS = 30L
private const val SYN_DOB = "1980-05-17"

// Probabilities of the "good" variant of each part (tuned for P7 at 1,000 sequences).
private const val MOSTLY = 0.95
private const val USUALLY = 0.9
private const val LIKELY = 0.85
private const val LIKELY_ACCEPTED = 0.85
private const val OFTEN = 0.75
private const val HALF = 0.5
private const val SELDOM = 0.15
private const val RARELY = 0.1

// Repetitions of the good option in a list, which weight a pick towards it.
private const val FREE_WEIGHT = 8
private const val LATEST_WEIGHT = 8
private const val RESPOND_WEIGHT = 6
private const val DESK_WEIGHT = 5
private const val EARLY_WEIGHT = 3

private val DOB: LocalDate = LocalDate.parse(SYN_DOB)

private fun Random.chance(probability: Double): Boolean = nextDouble() < probability

private fun <T> Random.pick(options: List<T>): T = options[nextInt(options.size)]

private fun minutes(value: Long): Duration = Duration.ofMinutes(value)

/** The appointment machine's facts generator (synthetic, NOT FOR CLINICAL USE). */
@Suppress("MagicNumber", "TooManyFunctions") // The offsets and weights are the generator's tuning table (P7); one function per part.
object AppointmentArbs {
    /** One decision's facts per draw, biased so that every appointment transition fires in 1,000 sequences. */
    val facts: Arb<AppointmentFacts> = arbitrary { source -> draw(source.random) }

    /** Draws one world of facts from [random]. */
    fun draw(random: Random): AppointmentFacts {
        val appointmentSlot = appointmentSlot(random)
        return AppointmentFacts(
            appointmentId = APPOINTMENT,
            patientId = PATIENT,
            now = NOW,
            today = TODAY,
            config = config(random),
            appointmentSlot = appointmentSlot,
            targetSlot = if (random.chance(USUALLY)) targetSlot(random) else null,
            participants = participants(random),
            hold = if (random.chance(MOSTLY)) hold(random) else null,
            waitlistEntry = if (random.chance(MOSTLY)) waitlistEntry(random, "SYN-WL-0005") else null,
            competingEntries = if (random.chance(HALF)) listOf(waitlistEntry(random, random.pick(competitorIds))) else emptyList(),
            checkIn = if (random.chance(USUALLY)) checkIn(random) else null,
            walkIn = if (random.chance(USUALLY)) walkIn(random) else null,
            linkedEncounter = linkedEncounter(random),
            patientEncounters = patientEncounters(random, appointmentSlot),
            cancellation = if (random.chance(USUALLY)) cancellation(random) else null,
            noShow = noShow(random),
            modification = modification(random),
            correction = if (random.chance(MOSTLY)) correction(random) else null,
        )
    }

    private val competitorIds = listOf("SYN-WL-0003", "SYN-WL-0009")

    private fun config(random: Random): AppointmentConfig =
        AppointmentConfig(
            earlyCheckInWindow = random.pick(List(EARLY_WEIGHT) { minutes(EARLY_MINUTES) } + listOf(null, Duration.ZERO)),
            lateCancelWindow = random.pick(listOf(Duration.ofHours(LATE_HOURS), Duration.ofHours(LATE_HOURS), Duration.ZERO, null)),
            noShowGrace = random.pick(listOf(minutes(GRACE_MINUTES), minutes(GRACE_MINUTES), null)),
            waitlistPriorityRanks = mapOf(URGENT to URGENT_RANK, ROUTINE to ROUTINE_RANK),
            cancellationReasons =
                mapOf(
                    PATIENT_REQUEST to CancellationReasonRule(requiresText = false, endsNeed = false),
                    CLINIC_CANCELLED to CancellationReasonRule(requiresText = false, endsNeed = false),
                    NOT_REQUIRED to CancellationReasonRule(requiresText = false, endsNeed = true),
                    OTHER_REASON to CancellationReasonRule(requiresText = true, endsNeed = false),
                ),
            noShowReasons = setOf(NO_SHOW_REASON),
        )

    // Slot start offsets from now (minutes), boundaries included: -150 lets the no-show grace elapse, -45 makes the
    // grace end exactly now, 30 opens check-in exactly now, 1,500 (25 h) is outside every window.
    private val startOffsets = listOf(-150L, -150L, -150L, -45L, -15L, 0L, 10L, 30L, 60L, 1500L)
    private val sessionLengths = listOf(SLOT_MINUTES, 120L, 240L)

    private fun appointmentSlot(random: Random): AppointmentSlot? {
        if (!random.chance(USUALLY)) return null
        val start = NOW.plus(minutes(random.pick(startOffsets)))
        val known = random.chance(USUALLY)
        return AppointmentSlot(
            slotId = CURRENT_SLOT,
            start = if (known) start else null,
            end = if (known) start.plus(minutes(SLOT_MINUTES)) else null,
            sessionEnd = start.plus(minutes(random.pick(sessionLengths))),
            date = if (random.chance(OFTEN)) TODAY else TODAY.minusDays(1),
        )
    }

    private fun targetSlot(random: Random): SlotFacts {
        val status = random.pick(SlotStatus.entries + List(FREE_WEIGHT) { SlotStatus.FREE })
        val start = if (random.chance(MOSTLY)) NOW.plus(Duration.ofDays(1)) else NOW.minus(minutes(SLOT_MINUTES))
        return SlotFacts(
            slotId = if (random.chance(LIKELY)) TARGET_SLOT else CURRENT_SLOT,
            status = status,
            heldByAppointmentId = if (random.chance(HALF)) APPOINTMENT else "SYN-APT-0099",
            overbookable = random.chance(HALF),
            overbookedCount = random.nextInt(OVERBOOK_CAP + 1),
            overbookCap = if (random.chance(OFTEN)) OVERBOOK_CAP else null,
            start = start,
            end = start.plus(minutes(SLOT_MINUTES)),
            date = if (random.chance(USUALLY)) TODAY.plusDays(1) else TODAY.minusDays(1),
            serviceType = if (random.chance(USUALLY)) SERVICE else OTHER_SERVICE,
            providerId = if (random.chance(LIKELY)) PROVIDER else OTHER_PROVIDER,
            locationId = if (random.chance(LIKELY)) LOCATION else OTHER_LOCATION,
        )
    }

    private fun participants(random: Random): List<ParticipantFacts> {
        val accepted = random.chance(LIKELY_ACCEPTED)
        val provider =
            when {
                accepted -> ParticipantResponse.ACCEPTED
                random.chance(HALF) -> ParticipantResponse.NEEDS_ACTION
                else -> random.pick(ParticipantResponse.entries)
            }
        val providerSlot = if (accepted || random.chance(HALF)) TARGET_SLOT else CURRENT_SLOT
        return listOf(
            ParticipantFacts(PATIENT, required = true, response = ParticipantResponse.ACCEPTED, responseSlotId = TARGET_SLOT),
            ParticipantFacts(PROVIDER, required = true, response = provider, responseSlotId = providerSlot),
            ParticipantFacts("SYN-EQP-01", required = false, response = ParticipantResponse.NEEDS_ACTION, responseSlotId = null),
        )
    }

    private val holdReasons =
        listOf(
            PendingReason.WAITLIST_OFFER,
            PendingReason.WAITLIST_OFFER,
            PendingReason.WAITLIST_OFFER,
            PendingReason.AWAITING_ACCEPTANCE,
            PendingReason.AWAITING_ACCEPTANCE,
            null,
        )

    private fun hold(random: Random): HoldFacts =
        HoldFacts(
            reason = random.pick(holdReasons),
            respondBy = random.pick(List(RESPOND_WEIGHT) { NOW.plus(Duration.ofHours(1)) } + listOf(NOW, NOW.minusSeconds(1), null)),
        )

    private fun waitlistEntry(
        random: Random,
        entryId: String,
    ): WaitlistEntryFacts {
        val declined = PastOffer(TARGET_SLOT, random.pick(OfferOutcome.entries), deliveryConfirmed = random.chance(HALF))
        return WaitlistEntryFacts(
            entryId = entryId,
            serviceType = if (random.chance(MOSTLY)) SERVICE else null,
            providers = if (random.chance(HALF)) emptySet() else setOf(PROVIDER),
            locations = if (random.chance(HALF)) emptySet() else setOf(LOCATION),
            earliest = if (random.chance(MOSTLY)) TODAY else null,
            latest = random.pick(List(LATEST_WEIGHT) { TODAY.plusDays(WAITLIST_DAYS) } + listOf(TODAY, TODAY.minusDays(1), null)),
            priorityCode = random.pick(listOf(ROUTINE, ROUTINE, ROUTINE, ROUTINE, URGENT, URGENT, "SYN-PRIO-UNKNOWN", null)),
            priorityOrigin = if (random.chance(MOSTLY)) ReasonOrigin.USER else random.pick(ReasonOrigin.entries),
            waitlistedAt = NOW.minus(Duration.ofDays(random.pick(listOf(1L, 10L, 10L)))),
            pastOffers = if (random.chance(SELDOM)) listOf(declined) else emptyList(),
        )
    }

    private val goodCheckIn =
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

    // Ways a check-in fails SI-01 (and two other ways it passes: wristband scan, card-less empi search, approximate DOB).
    private val checkInVariants: List<(CheckInFacts) -> CheckInFacts> =
        listOf(
            { it.copy(mrnSource = IdentifierSource.WRISTBAND_SCAN) },
            { it.copy(mrnSource = IdentifierSource.EMPI_SEARCH, empiSearchCandidates = listOf(PATIENT)) },
            { it.copy(recordApproximateDob = true, statedDob = null, statedApproximateAgeMatch = EmpiMatch.MATCH) },
            { it.copy(nameMatch = EmpiMatch.NO_MATCH) },
            { it.copy(nameSource = IdentifierSource.SCREEN_CONFIRMED) },
            { it.copy(mrnCheckDigitValid = false) },
            { it.copy(presentedMrn = "SYN-MRN-00018") },
            { it.copy(mrnSource = IdentifierSource.SCREEN_CONFIRMED) },
            { it.copy(mrnSource = IdentifierSource.LOCATION_TOKEN_OR_APPOINTMENT_NUMBER) },
            { it.copy(mrnSource = IdentifierSource.EMPI_SEARCH, empiSearchCandidates = listOf(PATIENT, OTHER_PATIENT)) },
            { it.copy(statedDob = DOB.plusDays(1)) },
            { it.copy(dobSource = IdentifierSource.SCREEN_CONFIRMED) },
            { it.copy(recordApproximateDob = true, statedApproximateAgeMatch = EmpiMatch.UNAVAILABLE) },
            { it.copy(recordApproximateDob = null) },
            { it.copy(recordMrn = null) },
        )

    private fun checkIn(random: Random): CheckInFacts = if (random.chance(HALF)) goodCheckIn else random.pick(checkInVariants)(goodCheckIn)

    private fun walkIn(random: Random): WalkInFacts {
        val running = random.chance(OFTEN)
        val session =
            SessionFacts(
                serviceType = SERVICE,
                providerId = PROVIDER,
                acceptsWalkIns = random.chance(USUALLY),
                start = if (running) NOW.minus(minutes(EARLY_MINUTES)) else NOW.plus(minutes(EARLY_MINUTES)),
                end = NOW.plus(Duration.ofHours(2)),
            )
        return WalkInFacts(
            requestedService = if (random.chance(USUALLY)) SERVICE else random.pick(listOf(OTHER_SERVICE, null)),
            requestedProvider = random.pick(listOf(null, null, PROVIDER, OTHER_PROVIDER)),
            sessions = listOf(session),
        )
    }

    private val encounterVariants =
        listOf(
            LinkedEncounterFacts(EncounterStatus.ARRIVED, leftWithoutBeingSeen = null, consultationRecorded = true),
            LinkedEncounterFacts(EncounterStatus.IN_PROGRESS, leftWithoutBeingSeen = null, consultationRecorded = true),
            LinkedEncounterFacts(EncounterStatus.ENTERED_IN_ERROR, leftWithoutBeingSeen = null, consultationRecorded = false),
            LinkedEncounterFacts(EncounterStatus.DISCHARGED_NOT_CLOSED, leftWithoutBeingSeen = false, consultationRecorded = false),
            LinkedEncounterFacts(EncounterStatus.CANCELLED, leftWithoutBeingSeen = null, consultationRecorded = false),
            LinkedEncounterFacts(EncounterStatus.FINISHED, leftWithoutBeingSeen = true, consultationRecorded = false),
            LinkedEncounterFacts(EncounterStatus.ENTERED_IN_ERROR, leftWithoutBeingSeen = null, consultationRecorded = true),
            LinkedEncounterFacts(EncounterStatus.TRIAGED, leftWithoutBeingSeen = null, consultationRecorded = null),
            LinkedEncounterFacts(null, leftWithoutBeingSeen = null, consultationRecorded = false),
        )

    private fun linkedEncounter(random: Random): LinkedEncounterFacts? =
        if (random.chance(USUALLY)) random.pick(encounterVariants) else null

    private val encounterStates =
        listOf(EncounterStatus.IN_PROGRESS, EncounterStatus.IN_PROGRESS, EncounterStatus.TRIAGED, EncounterStatus.FINISHED)
    private val encounterClasses =
        listOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.EMERGENCY, EncounterClass.OUTPATIENT)

    private fun patientEncounters(
        random: Random,
        slot: AppointmentSlot?,
    ): List<PatientEncounterFacts> {
        if (random.chance(HALF)) return emptyList()
        val around = slot?.start ?: NOW
        return listOf(
            PatientEncounterFacts(
                status = random.pick(encounterStates),
                encounterClass = random.pick(encounterClasses),
                start = around.minus(Duration.ofHours(random.pick(listOf(1L, 48L)))),
                end = random.pick(listOf(null, null, around.minus(minutes(EARLY_MINUTES)))),
            ),
        )
    }

    private val channels =
        List(DESK_WEIGHT) { EntryChannel.DESK_USER } + listOf(EntryChannel.FRONT_DOOR_LINK, null)

    private fun cancellation(random: Random): CancellationFacts {
        val reason = random.pick(listOf(PATIENT_REQUEST, CLINIC_CANCELLED, CLINIC_CANCELLED, NOT_REQUIRED, OTHER_REASON, "SYN-CXL-UNKNOWN"))
        val party = random.pick(CancellingParty.entries + listOf(CancellingParty.HOSPITAL, CancellingParty.PATIENT, null))
        return CancellationFacts(
            reasonCode = reason,
            reasonOrigin = if (random.chance(USUALLY)) ReasonOrigin.USER else random.pick(listOf(ReasonOrigin.DEFAULTED, null)),
            reasonText = if (random.chance(OFTEN)) "synthetic reason text" else null,
            requestingParty = party,
            channel = random.pick(channels),
            entrantId = if (random.chance(MOSTLY)) DESK_USER else null,
            entrantAuthenticated = random.chance(MOSTLY),
        )
    }

    private fun noShow(random: Random): NoShowFacts? =
        if (random.chance(RARELY)) {
            null
        } else {
            NoShowFacts(
                reasonCode = if (random.chance(USUALLY)) NO_SHOW_REASON else "SYN-NOSHOW-OTHER",
                reasonOrigin = if (random.chance(USUALLY)) ReasonOrigin.USER else ReasonOrigin.PREFILLED,
                enteredBy = DESK_USER,
                enteredByAuthenticated = random.chance(USUALLY),
            )
        }

    private val modifications =
        listOf(
            setOf(AppointmentAttribute.NOTES),
            setOf(AppointmentAttribute.REASON, AppointmentAttribute.INTERPRETER_NEED),
            setOf(AppointmentAttribute.WAITLIST_PRIORITY),
            setOf(AppointmentAttribute.SLOT, AppointmentAttribute.NOTES),
            setOf(AppointmentAttribute.SERVICE_TYPE_OUTSIDE_SLOT_SERVICE),
            emptySet(),
        )

    private fun modification(random: Random): ModificationFacts? =
        if (random.chance(RARELY)) null else ModificationFacts(random.pick(modifications))

    private val correctionCommands =
        listOf(AppointmentCommand.UndoCheckIn, AppointmentCommand.ReverseNoShow, AppointmentCommand.MarkEnteredInError, null)

    private fun correction(random: Random): CorrectionFacts =
        CorrectionFacts(
            command = random.pick(correctionCommands),
            holdsCorrectionPrivilege = random.chance(LIKELY),
            holdsFrontDeskReversalPrivilege = random.chance(HALF),
            auditWritable = random.chance(USUALLY),
            reason = if (random.chance(USUALLY)) "synthetic correction reason" else " ",
            reasonOrigin = if (random.chance(USUALLY)) ReasonOrigin.USER else ReasonOrigin.DEFAULTED,
        )
}
