// MagicNumber: the shares, offsets and minutes are the generator's tuning table (P7).
@file:Suppress("MagicNumber")

package hms.adt.domain.bed

import hms.adt.domain.bed.BedSamples.BED
import hms.adt.domain.bed.BedSamples.OTHER
import hms.adt.domain.bed.BedSamples.at
import hms.adt.domain.common.Answer
import hms.adt.domain.common.Chosen
import hms.adt.domain.common.CommandChannel
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.EntrySource
import hms.adt.domain.common.FinanceFacts
import hms.adt.domain.common.IsolationRequirement
import hms.adt.domain.common.LocationPeriod
import hms.adt.domain.common.OverrideReason
import hms.adt.domain.common.OverrideRequest
import hms.adt.domain.common.PreApprovalStatus
import hms.adt.domain.common.PressureSignal
import hms.adt.domain.common.RecordedSex
import hms.adt.domain.common.RestrictionKind
import hms.adt.domain.encounter.EncounterState
import io.kotest.property.Arb
import io.kotest.property.RandomSource
import io.kotest.property.Sample
import kotlin.random.Random

/**
 * The facts generator of the bed machine (docs/specs/modules/state-machines-and-invariants.md §2.3, §3.3): synthetic
 * facts only (NOT FOR CLINICAL USE; `SYN-` identifiers).
 *
 * Each sample starts from [BedSamples.world] with the exclusive situations drawn at random (the reserved encounter open
 * or ended, the required clean type, the out-of-use spell clean or not), adds harmless variation (in-cell channels,
 * internet loss, payment facts, unknown sex, unknown pressure signal, cohort declarations), and then breaks none, one,
 * two or three facts. Unbroken samples make every guard hold often enough for property P7; the breakers make every
 * predicate fail often and cover every fail-closed unknown and the half-open boundaries.
 */
object BedArbs {
    /** The facts generator the generated and hand-written property tests use. */
    val facts: Arb<BedFacts> =
        object : Arb<BedFacts>() {
            override fun edgecase(rs: RandomSource): Sample<BedFacts> = sample(rs)

            override fun sample(rs: RandomSource): Sample<BedFacts> = Sample(generate(rs.random))
        }

    private val RESERVATION_STATES =
        listOf(EncounterState.PLANNED, EncounterState.IN_PROGRESS, EncounterState.DISCHARGED_NOT_CLOSED, EncounterState.CANCELLED)
    private val SPELLS =
        listOf(
            OutOfUseSpell(BedState.AVAILABLE, listOf(BlockReason.STAFFING)),
            OutOfUseSpell(BedState.AVAILABLE, emptyList()),
            OutOfUseSpell(BedState.DIRTY, listOf(BlockReason.STAFFING)),
            OutOfUseSpell(BedState.AVAILABLE, listOf(BlockReason.STAFFING, BlockReason.ISOLATION)),
            OutOfUseSpell(BedState.CLEANING, emptyList()),
            OutOfUseSpell(null, emptyList()),
            OutOfUseSpell(BedState.AVAILABLE, null),
        )
    private val ALL_RESTRICTIONS = RestrictionKind.entries.toSet()
    private val NOT_COVERED = RecordedSex.Recorded(BedSamples.SEX_NOT_COVERED)

    private const val NO_BREAK = 0.45
    private const val ONE_BREAK = 0.8
    private const val TWO_BREAKS = 0.95

    /** One sample, drawn from [random] alone. */
    fun generate(random: Random): BedFacts {
        val world =
            BedSamples.world(
                reservationEncounterState = RESERVATION_STATES.random(random),
                requiredClean = random.pick(CleanType.STANDARD, CleanType.TERMINAL, null),
                spell = SPELLS.random(random),
            )
        val varied = variations.fold(world) { facts, vary -> if (random.nextBoolean()) vary(facts, random) else facts }
        val breaks =
            random.nextDouble().let {
                when {
                    it < NO_BREAK -> 0
                    it < ONE_BREAK -> 1
                    it < TWO_BREAKS -> 2
                    else -> 3
                }
            }
        return (1..breaks).fold(varied) { facts, _ -> breakers.random(random)(facts, random) }
    }

    private fun <T> Random.pick(vararg values: T): T = values[nextInt(values.size)]

    private fun period(
        start: Long,
        end: Long?,
        encounterId: String = OTHER,
        enteredInError: Boolean = false,
    ) = LocationPeriod("SYN-PER-X$start", encounterId, BED, at(start), end?.let { at(it) }, enteredInError)

    private fun BedFacts.plus(period: LocationPeriod) = copy(periods = periods + period)

    /** Changes that keep every guard's verdict. */
    private val variations: List<(BedFacts, Random) -> BedFacts> =
        listOf(
            { f, _ -> f.copy(channel = CommandChannel.IN_CELL, clientModeAtIssue = null) },
            { f, r -> f.copy(wanReachable = r.pick(true, false, null)) },
            { f, r ->
                f.copy(
                    finance =
                        FinanceFacts(
                            outstandingBalanceMinor = r.pick(null, 0L, 1_500_000L, Long.MAX_VALUE),
                            depositPaid = Answer.entries.random(r),
                            preApproval = PreApprovalStatus.entries.random(r),
                        ),
                )
            },
            { f, r ->
                f.copy(commandEncounterState = r.pick(EncounterState.PLANNED, EncounterState.TRIAGED, EncounterState.IN_PROGRESS))
            },
            { f, r -> f.copy(blockReason = Chosen(BlockReason.entries.random(r), EntrySource.USER)) },
            { f, r -> f.copy(override = f.override?.copy(reason = Chosen(OverrideReason.entries.random(r), EntrySource.USER))) },
            { f, r ->
                f.copy(
                    attributes = f.attributes.copy(genderRestriction = BedSamples.GENDER_RESTRICTION),
                    patientPlacement =
                        f.patientPlacement.copy(
                            sex = r.pick(RecordedSex.NotRecorded, RecordedSex.RecordedUnknown, NOT_COVERED),
                        ),
                )
            },
            { f, r -> f.copy(attributes = f.attributes.copy(pressureSignal = r.pick(PressureSignal.UNKNOWN, PressureSignal.NORMAL))) },
            { f, _ ->
                f.copy(
                    patientPlacement = f.patientPlacement.copy(isolation = IsolationRequirement(BedSamples.ISOLATION_KIND)),
                    attributes = f.attributes.copy(activeCohortKinds = setOf(BedSamples.ISOLATION_KIND)),
                )
            },
            // An entered-in-error open period of another encounter: ignored by every occupancy check.
            { f, _ -> f.plus(period(130, null, enteredInError = true)) },
            { f, _ -> f.copy(cancelledClosure = f.cancelledClosure?.copy(kind = ClosureKind.TRANSFER)) },
        )

    /** Each breaker makes at least one predicate fail, including every unknown and boundary. */
    private val breakers: List<(BedFacts, Random) -> BedFacts> =
        listOf(
            // onSiteCellConnected
            { f, r ->
                val mode = r.pick(ConnectivityMode.CELL_LOST, ConnectivityMode.EDGE_AGENT, ConnectivityMode.MOBILE_OFFLINE)
                f.copy(channel = CommandChannel.CLIENT, clientModeAtIssue = mode)
            },
            { f, _ -> f.copy(channel = CommandChannel.CLIENT, clientModeAtIssue = null) },
            // reservationEncounterOpen
            { f, r -> f.copy(commandEncounterState = r.pick(EncounterState.ON_LEAVE, EncounterState.FINISHED, null)) },
            { f, _ -> f.copy(commandEncounterId = null) },
            // bedRestrictionsAdmitPatient, overrideReasonChosen
            { f, _ ->
                f.copy(
                    attributes = f.attributes.copy(genderRestriction = BedSamples.GENDER_RESTRICTION),
                    patientPlacement = f.patientPlacement.copy(sex = RecordedSex.Recorded(BedSamples.SEX_EXCLUDED)),
                )
            },
            { f, _ -> f.copy(patientPlacement = f.patientPlacement.copy(isolation = IsolationRequirement(null))) },
            { f, _ ->
                f.copy(
                    patientPlacement = f.patientPlacement.copy(isolation = IsolationRequirement(BedSamples.ISOLATION_KIND)),
                    attributes = f.attributes.copy(isolationCapabilities = null),
                )
            },
            // noActivePressureAlarm
            { f, _ -> f.copy(attributes = f.attributes.copy(pressureSignal = PressureSignal.ALARM_ACTIVE)) },
            { f, _ ->
                f.copy(override = OverrideRequest(Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.DEFAULTED), ALL_RESTRICTIONS))
            },
            { f, _ ->
                val user = Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.USER)
                f.copy(override = OverrideRequest(user, setOf(RestrictionKind.GENDER)))
            },
            { f, _ -> f.copy(override = null) },
            // occupantMatchesReservation, reservedEncounterEnded
            { f, _ -> f.copy(reservationEncounterId = OTHER) },
            { f, _ -> f.copy(reservationEncounterId = null) },
            { f, _ -> f.copy(reservationEncounterState = null) },
            // noOverlappingOccupancy, noOpenOccupancy, returningOccupantWasLastOccupant
            { f, _ -> f.plus(period(100, 121)) },
            { f, _ -> f.plus(period(200, null)) },
            { f, _ -> f.plus(period(-60, null, encounterId = BedSamples.ENCOUNTER)) },
            { f, _ -> f.copy(occupancyStart = null) },
            { f, _ -> f.copy(cancelledClosure = f.cancelledClosure?.copy(closedPeriodId = "SYN-PER-OTHER")) },
            { f, _ -> f.copy(cancelledClosure = null) },
            { f, _ -> f.plus(period(150, 160)) },
            // backEnteredOccupantMatches
            { f, _ -> f.copy(backEnteredOccupancy = f.backEnteredOccupancy?.copy(appliedInSameTransaction = false)) },
            { f, _ -> f.copy(backEnteredOccupancy = f.backEnteredOccupancy?.copy(lastOfBackEntry = false, end = at(180))) },
            { f, _ -> f.copy(backEnteredOccupancy = f.backEnteredOccupancy?.copy(bedId = "SYN-BED-OTHER")) },
            { f, _ -> f.copy(backEnteredOccupancy = null) },
            // requiredCleanRecorded
            { f, _ -> f.copy(cleaningJob = f.cleaningJob?.copy(completedClean = null)) },
            { f, _ -> f.copy(cleaningJob = CleaningJob(null, CleanType.STANDARD)) },
            { f, _ -> f.copy(cleaningJob = CleaningJob(CleanType.TERMINAL, CleanType.STANDARD)) },
            { f, _ -> f.copy(cleaningJob = null) },
            // blockReasonValid, reasonEntered
            { f, _ -> f.copy(blockReason = f.blockReason?.copy(source = EntrySource.DEFAULTED)) },
            { f, _ -> f.copy(blockReason = null) },
            { f, _ -> f.copy(reason = Chosen(" ", EntrySource.USER)) },
            { f, _ -> f.copy(reason = Chosen("SYN reason text", EntrySource.DEFAULTED)) },
            { f, _ -> f.copy(reason = null) },
            // cleaningNeededOnReturn / noCleaningNeededOnReturn
            { f, _ -> f.copy(outOfUseSpell = null) },
            // privilegedAndAudited
            { f, r -> f.copy(commandPrivilege = r.pick(Answer.NO, Answer.UNKNOWN)) },
            { f, r -> f.copy(auditAccepted = r.pick(Answer.NO, Answer.UNKNOWN)) },
        )
}
