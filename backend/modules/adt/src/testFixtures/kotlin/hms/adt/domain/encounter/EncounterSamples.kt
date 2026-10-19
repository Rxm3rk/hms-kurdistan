// MagicNumber: the synthetic timeline is written in minutes from T0.
@file:Suppress("MagicNumber")

package hms.adt.domain.encounter

import hms.adt.domain.bed.BedState
import hms.adt.domain.common.Answer
import hms.adt.domain.common.BedAttributes
import hms.adt.domain.common.Chosen
import hms.adt.domain.common.CommandChannel
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.EntrySource
import hms.adt.domain.common.FinanceFacts
import hms.adt.domain.common.GenderRule
import hms.adt.domain.common.LeaveEntry
import hms.adt.domain.common.LocationPeriod
import hms.adt.domain.common.OverrideReason
import hms.adt.domain.common.OverrideRequest
import hms.adt.domain.common.PatientPlacement
import hms.adt.domain.common.PreApprovalStatus
import hms.adt.domain.common.PressureSignal
import hms.adt.domain.common.RecordedSex
import hms.adt.domain.common.RestrictionKind
import java.time.Duration
import java.time.Instant

/**
 * Deterministic synthetic encounter facts for the unit tests and the facts generator (NOT FOR CLINICAL USE; `SYN-`
 * identifiers only). [world] builds one consistent timeline in which every predicate that can hold together with the
 * others holds; the scenario arguments choose between the facts that exclude one another (the target bed is free, holds
 * the swap partner, or is the bed the cancelled discharge released). Tests and generators break one fact at a time.
 *
 * The timeline, from [T0] (the arrival): the encounter's bed period on [BED_PREVIOUS] from +30 min to +1 h, closed by a
 * transfer; its open period on [BED_CURRENT] from +1 h; a downtime spell from +2 h to +4 h with paper periods on
 * [BED_PAPER_1] (+2 h to +3 h) and [BED_PAPER_2] (from +3 h); the cancelled discharge at +4 h 30 min; the command's
 * effective time at +5 h and its recorded time at +5 h 10 min.
 */
object EncounterSamples {
    /** The arrival of the sample encounter. */
    val T0: Instant = Instant.parse("2026-03-01T08:00:00Z")

    const val ENCOUNTER: String = "SYN-ENC-0001"
    const val PATIENT: String = "SYN-PAT-0001"
    const val PARTNER: String = "SYN-ENC-0002"
    const val REPLACEMENT: String = "SYN-ENC-0003"
    const val REPLACEMENT_PATIENT: String = "SYN-PAT-0003"
    const val HAND_OVER_SOURCE: String = "SYN-ENC-0004"
    const val OTHER: String = "SYN-ENC-0009"

    const val BED_PREVIOUS: String = "SYN-BED-C"
    const val BED_CURRENT: String = "SYN-BED-A"
    const val BED_TARGET: String = "SYN-BED-B"
    const val BED_DISCHARGED: String = "SYN-BED-D"
    const val BED_HAND_OVER: String = "SYN-BED-H"
    const val BED_PAPER_1: String = "SYN-BED-P"
    const val BED_PAPER_2: String = "SYN-BED-Q"

    const val PERIOD_PREVIOUS: String = "SYN-PER-E0"
    const val PERIOD_CURRENT: String = "SYN-PER-E1"
    const val LEAVE: String = "SYN-LOA-E1"

    const val GENDER_RESTRICTION: String = "SYN-GENDER-RESTRICTION-1"
    const val SEX_ADMITTED: String = "SYN-SEX-1"
    const val SEX_EXCLUDED: String = "SYN-SEX-2"
    const val SEX_NOT_COVERED: String = "SYN-SEX-3"
    const val ISOLATION_KIND: String = "SYN-ISOLATION-1"

    const val SCALE: String = "SYN-TRIAGE-SCALE"
    const val VITAL_MEASURED: String = "SYN-VITAL-A"
    const val VITAL_NOT_OBTAINED: String = "SYN-VITAL-B"
    const val NOT_OBTAINED_REASON: String = "SYN-NOT-OBTAINED-REASON-1"

    /** Which of the mutually exclusive target-bed situations the sample world is in. */
    enum class Target {
        /** The target bed is reserved for this encounter and free from the effective time. */
        RESERVED_FREE,

        /** The target bed holds the swap partner. */
        SWAP_PARTNER,

        /** The target bed is the bed the cancelled discharge released, now dirty (returnBedAvailable case (a)). */
        RELEASED_BY_DISCHARGE,
    }

    /** [T0] plus [minutes]. */
    fun at(minutes: Long): Instant = T0.plus(Duration.ofMinutes(minutes))

    /** Two identifiers, both confirmed by the identity service, and no location. */
    val CONFIRMED: PatientIdentification =
        PatientIdentification(setOf(IdentifierKind.MRN, IdentifierKind.DATE_OF_BIRTH), Answer.YES, Answer.YES)

    /** A patient with an admitted recorded sex and no isolation requirement. */
    val UNRESTRICTED_PATIENT: PatientPlacement = PatientPlacement(RecordedSex.Recorded(SEX_ADMITTED), false, null)

    /** A bed with no restriction, no isolation capability and no pressure monitoring. */
    val UNRESTRICTED_BED: BedAttributes = BedAttributes(null, emptySet(), emptySet(), PressureSignal.NOT_MONITORED)

    /** The synthetic gender rule (NOT FOR CLINICAL USE). */
    val GENDER_RULES: Map<String, GenderRule> =
        mapOf(GENDER_RESTRICTION to GenderRule(admitted = setOf(SEX_ADMITTED), excluded = setOf(SEX_EXCLUDED)))

    /** The synthetic triage configuration (NOT FOR CLINICAL USE). */
    val TRIAGE_CONFIGURATION: TriageConfiguration =
        TriageConfiguration(
            scale = SCALE,
            levels = setOf("SYN-LEVEL-1", "SYN-LEVEL-2", "SYN-LEVEL-3"),
            requiredVitals = setOf(VITAL_MEASURED, VITAL_NOT_OBTAINED),
            notObtainedReasons = setOf(NOT_OBTAINED_REASON),
        )

    /** A complete synthetic triage record for [TRIAGE_CONFIGURATION]. */
    val TRIAGE_RECORD: TriageRecord =
        TriageRecord(
            scale = SCALE,
            level = "SYN-LEVEL-2",
            chiefComplaint = "SYN complaint text",
            triageTime = at(10),
            triagingUser = "SYN-USER-TRIAGE",
            vitals =
                mapOf(
                    VITAL_MEASURED to VitalEntry.Measured("SYN-VALUE", at(10)),
                    VITAL_NOT_OBTAINED to VitalEntry.NotObtained(Chosen(NOT_OBTAINED_REASON, EntrySource.USER)),
                ),
        )

    /** The paper periods of a well-formed, conflict-free back-entry. */
    val PAPER: List<PaperPeriod> =
        listOf(
            PaperPeriod(BED_PAPER_1, at(120), at(180), true, "SYN-PAPER-1"),
            PaperPeriod(BED_PAPER_2, at(180), null, true, "SYN-PAPER-2"),
        )

    /** The encounter's own bed periods: previous (closed by the last transfer) and current (open). */
    val OWN_PERIODS: List<LocationPeriod> =
        listOf(
            LocationPeriod(PERIOD_PREVIOUS, ENCOUNTER, BED_PREVIOUS, at(30), at(60)),
            LocationPeriod(PERIOD_CURRENT, ENCOUNTER, BED_CURRENT, at(60), null),
        )

    /** An open leave entry of the encounter from +1 h 40 min. */
    val OPEN_LEAVE: LeaveEntry = LeaveEntry(LEAVE, ENCOUNTER, at(100), null)

    /** Facts in which every predicate holds that can hold together with the others, for the given scenario. */
    fun world(
        target: Target = Target.RESERVED_FREE,
        withBackEntry: Boolean = false,
        onLeave: Boolean = false,
        triageRecorded: Boolean = false,
        errorReason: ErrorReason = ErrorReason.DUPLICATE_ENCOUNTER,
        dischargedFrom: EncounterState = EncounterState.IN_PROGRESS,
    ): EncounterFacts =
        EncounterFacts(
            encounterId = ENCOUNTER,
            patientId = PATIENT,
            patientIdentification = CONFIRMED,
            channel = CommandChannel.CLIENT,
            clientModeAtIssue = ConnectivityMode.ON_SITE_CELL,
            wanReachable = true,
            effectiveTime = at(300),
            recordedTime = at(310),
            arrivalTime = T0,
            triageConfiguration = TRIAGE_CONFIGURATION,
            commandTriageRecord = TRIAGE_RECORD,
            heldTriageRecords = if (triageRecorded) listOf(HeldTriageRecord("SYN-TRI-1", false)) else emptyList(),
            targetBedId = BED_TARGET,
            beds = beds(target),
            bedAttributes = mapOf(BED_TARGET to UNRESTRICTED_BED, BED_CURRENT to UNRESTRICTED_BED),
            genderRules = GENDER_RULES,
            periods = periods(target),
            leaveEntries = if (onLeave) listOf(OPEN_LEAVE) else emptyList(),
            patientPlacement = UNRESTRICTED_PATIENT,
            swap =
                if (target == Target.SWAP_PARTNER) {
                    SwapPartner(PARTNER, EncounterState.IN_PROGRESS, CONFIRMED, UNRESTRICTED_PATIENT)
                } else {
                    null
                },
            override = OverrideRequest(Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.USER), RestrictionKind.entries.toSet()),
            disposition = Chosen("home", EntrySource.USER),
            tenantDispositions = null,
            dischargeBeingCancelled =
                DischargeRecord(
                    firedFrom = dischargedFrom,
                    effectiveTime = at(270),
                    closedBedId = if (target == Target.RELEASED_BY_DISCHARGE) BED_TARGET else BED_DISCHARGED,
                    died = Answer.NO,
                ),
            lastTransfer = TransferRecord(at(60), BED_PREVIOUS),
            boundaryCorrection = BoundaryCorrection(PERIOD_CURRENT, BoundaryEnd.START, at(75)),
            backEntry = if (withBackEntry) PAPER else emptyList(),
            downtimeSpells = listOf(DowntimeSpell(ConnectivityMode.CELL_LOST, at(120), at(240))),
            errorReason = Chosen(errorReason, EntrySource.USER),
            replacement = ReplacementEncounter(REPLACEMENT, REPLACEMENT_PATIENT, EncounterState.ARRIVED, CONFIRMED),
            handOver =
                HandOver(
                    sourceEncounterId = HAND_OVER_SOURCE,
                    inSameTransaction = true,
                    sourceErrorReason = ErrorReason.WRONG_PATIENT,
                    sourceReplacementEncounterId = ENCOUNTER,
                    receivedPeriods = listOf(HandedOverPeriod(BED_HAND_OVER, at(60), null)),
                ),
            codingComplete = Answer.YES,
            chargeCaptureComplete = Answer.YES,
            reason = Chosen("SYN reason text", EntrySource.USER),
            authorisation = Authorisation(Answer.YES, Answer.YES, Answer.YES),
            finance = FinanceFacts(outstandingBalanceMinor = 0, depositPaid = Answer.YES, preApproval = PreApprovalStatus.NOT_REQUIRED),
        )

    private fun beds(target: Target): Map<String, BedView> =
        mapOf(
            BED_PREVIOUS to BedView(BedState.DIRTY, null),
            BED_CURRENT to BedView(BedState.OCCUPIED, null),
            BED_TARGET to
                when (target) {
                    Target.RESERVED_FREE -> BedView(BedState.RESERVED, ENCOUNTER)
                    Target.SWAP_PARTNER -> BedView(BedState.OCCUPIED, null)
                    Target.RELEASED_BY_DISCHARGE -> BedView(BedState.DIRTY, null)
                },
            BED_PAPER_1 to BedView(BedState.AVAILABLE, null),
            BED_PAPER_2 to BedView(BedState.AVAILABLE, null),
            BED_HAND_OVER to BedView(BedState.OCCUPIED, null),
        )

    private fun periods(target: Target): List<LocationPeriod> =
        OWN_PERIODS +
            listOf(
                // A previous occupant of the target bed, gone before the timeline matters.
                LocationPeriod("SYN-PER-O1", OTHER, BED_TARGET, at(-120), at(120)),
                // The wrong-patient encounter whose periods a hand-over receives.
                LocationPeriod("SYN-PER-S1", HAND_OVER_SOURCE, BED_HAND_OVER, at(60), null),
            ) +
            if (target == Target.SWAP_PARTNER) {
                listOf(LocationPeriod("SYN-PER-F1", PARTNER, BED_TARGET, at(150), null))
            } else {
                emptyList()
            }
}
