package hms.adt.domain.bed

import hms.adt.domain.common.Answer
import hms.adt.domain.common.BedAttributes
import hms.adt.domain.common.Chosen
import hms.adt.domain.common.CommandChannel
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.EntrySource
import hms.adt.domain.common.FinanceFacts
import hms.adt.domain.common.GenderRule
import hms.adt.domain.common.LocationPeriod
import hms.adt.domain.common.OverrideReason
import hms.adt.domain.common.OverrideRequest
import hms.adt.domain.common.PatientPlacement
import hms.adt.domain.common.PreApprovalStatus
import hms.adt.domain.common.PressureSignal
import hms.adt.domain.common.RecordedSex
import hms.adt.domain.common.RestrictionKind
import hms.adt.domain.encounter.EncounterState
import java.time.Duration
import java.time.Instant

/**
 * Deterministic synthetic bed facts for the unit tests and the facts generator (NOT FOR CLINICAL USE; `SYN-`
 * identifiers only). [world] builds one consistent picture of the bed [BED]: an earlier occupant's period from -5 h to
 * -3 h; the named encounter's own period from [T0] to +2 h, closed by the discharge a Reoccupy would cancel; no open
 * period; the new occupancy (Occupy, Reoccupy or back-entry) starting at +2 h. Every predicate that can hold together
 * with the others holds; tests and generators break one fact at a time.
 */
object BedSamples {
    /** The start of the named encounter's last period on the bed. */
    val T0: Instant = Instant.parse("2026-03-01T08:00:00Z")

    const val BED: String = "SYN-BED-B"
    const val ENCOUNTER: String = "SYN-ENC-0001"
    const val OTHER: String = "SYN-ENC-0009"
    const val OWN_PERIOD: String = "SYN-PER-E-B"
    const val GENDER_RESTRICTION: String = "SYN-GENDER-RESTRICTION-1"
    const val SEX_ADMITTED: String = "SYN-SEX-1"
    const val SEX_EXCLUDED: String = "SYN-SEX-2"
    const val SEX_NOT_COVERED: String = "SYN-SEX-3"
    const val ISOLATION_KIND: String = "SYN-ISOLATION-1"

    /** [T0] plus [minutes]. */
    fun at(minutes: Long): Instant = T0.plus(Duration.ofMinutes(minutes))

    /** A patient with an admitted recorded sex and no isolation requirement. */
    val UNRESTRICTED_PATIENT: PatientPlacement = PatientPlacement(RecordedSex.Recorded(SEX_ADMITTED), false, null)

    /** A bed with no restriction, no isolation capability and no pressure monitoring. */
    val UNRESTRICTED_BED: BedAttributes = BedAttributes(null, emptySet(), emptySet(), PressureSignal.NOT_MONITORED)

    /** The synthetic gender rule (NOT FOR CLINICAL USE). */
    val GENDER_RULES: Map<String, GenderRule> =
        mapOf(GENDER_RESTRICTION to GenderRule(admitted = setOf(SEX_ADMITTED), excluded = setOf(SEX_EXCLUDED)))

    /** The location periods on the bed: an earlier occupant's and the named encounter's, both closed. */
    val PERIODS: List<LocationPeriod> =
        listOf(
            LocationPeriod("SYN-PER-O-B", OTHER, BED, at(-300), at(-180)),
            LocationPeriod(OWN_PERIOD, ENCOUNTER, BED, T0, at(120)),
        )

    /** Facts in which every predicate holds that can hold together with the others. */
    fun world(
        reservationEncounterState: EncounterState = EncounterState.IN_PROGRESS,
        requiredClean: CleanType? = CleanType.STANDARD,
        spell: OutOfUseSpell = OutOfUseSpell(BedState.AVAILABLE, listOf(BlockReason.STAFFING)),
    ): BedFacts =
        BedFacts(
            bedId = BED,
            channel = CommandChannel.CLIENT,
            clientModeAtIssue = ConnectivityMode.ON_SITE_CELL,
            wanReachable = true,
            commandEncounterId = ENCOUNTER,
            commandEncounterState = EncounterState.ARRIVED,
            reservationEncounterId = ENCOUNTER,
            reservationEncounterState = reservationEncounterState,
            patientPlacement = UNRESTRICTED_PATIENT,
            attributes = UNRESTRICTED_BED,
            genderRules = GENDER_RULES,
            override = OverrideRequest(Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.USER), RestrictionKind.entries.toSet()),
            periods = PERIODS,
            occupancyStart = at(120),
            cancelledClosure = CancelledClosure(ClosureKind.DISCHARGE, OWN_PERIOD),
            backEnteredOccupancy =
                BackEnteredOccupancy(ENCOUNTER, BED, at(120), null, lastOfBackEntry = true, appliedInSameTransaction = true),
            cleaningJob = CleaningJob(requiredClean, requiredClean ?: CleanType.TERMINAL),
            blockReason = Chosen(BlockReason.STAFFING, EntrySource.USER),
            reason = Chosen("SYN reason text", EntrySource.USER),
            outOfUseSpell = spell,
            commandPrivilege = Answer.YES,
            auditAccepted = Answer.YES,
            finance = FinanceFacts(outstandingBalanceMinor = 0, depositPaid = Answer.YES, preApproval = PreApprovalStatus.NOT_REQUIRED),
        )
}
