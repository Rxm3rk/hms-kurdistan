// MagicNumber: the shares, offsets and minutes are the generator's tuning table (P7).
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
import hms.adt.domain.common.IsolationRequirement
import hms.adt.domain.common.LeaveEntry
import hms.adt.domain.common.LocationPeriod
import hms.adt.domain.common.OverrideReason
import hms.adt.domain.common.OverrideRequest
import hms.adt.domain.common.PreApprovalStatus
import hms.adt.domain.common.PressureSignal
import hms.adt.domain.common.RecordedSex
import hms.adt.domain.common.RestrictionKind
import hms.adt.domain.encounter.EncounterSamples.BED_CURRENT
import hms.adt.domain.encounter.EncounterSamples.BED_PAPER_1
import hms.adt.domain.encounter.EncounterSamples.BED_PAPER_2
import hms.adt.domain.encounter.EncounterSamples.BED_PREVIOUS
import hms.adt.domain.encounter.EncounterSamples.BED_TARGET
import hms.adt.domain.encounter.EncounterSamples.CONFIRMED
import hms.adt.domain.encounter.EncounterSamples.OTHER
import hms.adt.domain.encounter.EncounterSamples.PARTNER
import hms.adt.domain.encounter.EncounterSamples.at
import io.kotest.property.Arb
import io.kotest.property.RandomSource
import io.kotest.property.Sample
import kotlin.random.Random

/**
 * The facts generator of the encounter machine (docs/specs/modules/state-machines-and-invariants.md §2.3, §3.3):
 * synthetic facts only (NOT FOR CLINICAL USE; `SYN-` identifiers).
 *
 * Each sample starts from [EncounterSamples.world] with the mutually exclusive situations drawn at random (the target
 * bed's situation, a back-entry or none, leave, a held triage record, the error reason, the cancelled discharge's
 * origin), adds harmless variation (in-cell channels, internet loss, payment facts, unknown sex, unknown pressure
 * signal, cohort declarations, edge times that still hold), and then breaks none, one, two or three facts with the
 * [breakers]. Unbroken samples make every guard hold often enough for property P7 (every transition fires in 1,000
 * sequences); the breakers make every predicate fail often and cover every fail-closed unknown and time boundary.
 */
object EncounterArbs {
    /** The facts generator the generated and hand-written property tests use. */
    val facts: Arb<EncounterFacts> =
        object : Arb<EncounterFacts>() {
            override fun edgecase(rs: RandomSource): Sample<EncounterFacts> = sample(rs)

            override fun sample(rs: RandomSource): Sample<EncounterFacts> = Sample(generate(rs.random))
        }

    private val DISCHARGE_ORIGINS =
        listOf(EncounterState.IN_PROGRESS, EncounterState.ON_LEAVE, EncounterState.ARRIVED, EncounterState.TRIAGED)

    private val RESTRICTED_BED = EncounterSamples.UNRESTRICTED_BED.copy(genderRestriction = EncounterSamples.GENDER_RESTRICTION)
    private val APPROXIMATE_DOB = CONFIRMED.copy(presented = setOf(IdentifierKind.MRN, IdentifierKind.APPROXIMATE_DOB_FLAG))
    private val ALL_RESTRICTIONS = RestrictionKind.entries.toSet()

    private const val BACK_ENTRY_SHARE = 0.6
    private const val NO_BREAK = 0.45
    private const val ONE_BREAK = 0.8
    private const val TWO_BREAKS = 0.95

    /** One sample, drawn from [random] alone. */
    fun generate(random: Random): EncounterFacts {
        val world =
            EncounterSamples.world(
                target = EncounterSamples.Target.entries.random(random),
                withBackEntry = random.nextDouble() < BACK_ENTRY_SHARE,
                onLeave = random.nextBoolean(),
                triageRecorded = random.nextBoolean(),
                errorReason = ErrorReason.entries.random(random),
                dischargedFrom = DISCHARGE_ORIGINS.random(random),
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

    private fun period(
        bedId: String,
        start: Long,
        end: Long?,
        encounterId: String = OTHER,
    ) = LocationPeriod("SYN-PER-X${start}_$bedId", encounterId, bedId, at(start), end?.let { at(it) })

    private fun EncounterFacts.plus(period: LocationPeriod) = copy(periods = periods + period)

    private fun EncounterFacts.bed(
        bedId: String,
        state: BedState?,
        reservedFor: String? = null,
    ) = copy(beds = beds + (bedId to BedView(state, reservedFor)))

    private fun EncounterFacts.attributes(
        bedId: String,
        attributes: BedAttributes,
    ) = copy(bedAttributes = bedAttributes + (bedId to attributes))

    private fun <T> Random.pick(vararg values: T): T = values[nextInt(values.size)]

    /** Changes that keep every guard's verdict for the scenario (they hold on the same side of every rule). */
    private val variations: List<(EncounterFacts, Random) -> EncounterFacts> =
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
            { f, _ -> f.copy(patientIdentification = APPROXIMATE_DOB) },
            { f, r -> f.copy(disposition = Chosen(EncounterGuards.BASELINE_DISPOSITIONS.random(r), EntrySource.USER)) },
            { f, _ ->
                f.copy(tenantDispositions = setOf("SYN-DISPOSITION-1"), disposition = Chosen("SYN-DISPOSITION-1", EntrySource.USER))
            },
            { f, r -> f.copy(override = f.override?.copy(reason = Chosen(OverrideReason.entries.random(r), EntrySource.USER))) },
            { f, _ ->
                f.copy(
                    dischargeBeingCancelled = f.dischargeBeingCancelled?.copy(died = Answer.YES),
                    authorisation = f.authorisation.copy(deathReversalPrivilege = Answer.YES),
                )
            },
            { f, r ->
                val kind = r.pick(ConnectivityMode.EDGE_AGENT, ConnectivityMode.MOBILE_OFFLINE)
                f.copy(downtimeSpells = listOf(DowntimeSpell(kind, at(120), at(240))))
            },
            { f, r ->
                f.copy(patientPlacement = f.patientPlacement.copy(sex = r.pick(RecordedSex.NotRecorded, RecordedSex.RecordedUnknown)))
            },
            { f, _ -> f.attributes(BED_TARGET, RESTRICTED_BED) },
            { f, _ -> f.attributes(BED_CURRENT, EncounterSamples.UNRESTRICTED_BED.copy(pressureSignal = PressureSignal.UNKNOWN)) },
            { f, _ ->
                val cohort = EncounterSamples.UNRESTRICTED_BED.copy(activeCohortKinds = setOf(EncounterSamples.ISOLATION_KIND))
                f
                    .copy(patientPlacement = f.patientPlacement.copy(isolation = IsolationRequirement(EncounterSamples.ISOLATION_KIND)))
                    .attributes(BED_TARGET, cohort)
            },
            // An earlier occupant of the target bed whose period ended exactly at the effective time (half-open: still free).
            { f, _ -> if (f.beds[BED_TARGET]?.state == BedState.RESERVED) f.plus(period(BED_TARGET, 200, 300)) else f },
            { f, _ -> f.bed(BED_PREVIOUS, BedState.CLEANING) },
            { f, _ -> f.copy(boundaryCorrection = BoundaryCorrection(EncounterSamples.PERIOD_PREVIOUS, BoundaryEnd.END, at(45))) },
            { f, _ -> f.copy(heldTriageRecords = f.heldTriageRecords + HeldTriageRecord("SYN-TRI-VOID", true)) },
            { f, _ -> f.copy(replacement = f.replacement?.copy(state = EncounterState.TRIAGED)) },
            { f, _ -> f.copy(triageConfiguration = f.triageConfiguration?.copy(requiredVitals = emptySet())) },
        )

    /** Each breaker makes at least one predicate fail (or one alternative switch), including every unknown and boundary. */
    private val breakers: List<(EncounterFacts, Random) -> EncounterFacts> =
        listOf(
            // onSiteCellConnected
            { f, r ->
                f.copy(channel = CommandChannel.CLIENT, clientModeAtIssue = r.pick(ConnectivityMode.CELL_LOST, ConnectivityMode.EDGE_AGENT))
            },
            { f, _ -> f.copy(channel = CommandChannel.CLIENT, clientModeAtIssue = ConnectivityMode.MOBILE_OFFLINE) },
            { f, _ -> f.copy(channel = CommandChannel.CLIENT, clientModeAtIssue = null) },
            // patientIdentityConfirmed, swapPartnerIdentityConfirmed
            { f, r -> f.copy(patientIdentification = CONFIRMED.copy(mrnCheckDigitValid = r.pick(Answer.NO, Answer.UNKNOWN))) },
            { f, _ -> f.copy(patientIdentification = CONFIRMED.copy(presented = setOf(IdentifierKind.MRN, IdentifierKind.BED))) },
            { f, _ -> f.copy(patientIdentification = CONFIRMED.copy(secondIdentifierConfirmed = Answer.UNKNOWN)) },
            { f, _ -> f.copy(patientIdentification = null) },
            { f, _ ->
                f.copy(swap = f.swap?.copy(identification = CONFIRMED.copy(presented = setOf(IdentifierKind.MRN, IdentifierKind.ROOM))))
            },
            // triageRecordComplete
            { f, _ -> f.copy(triageConfiguration = null) },
            { f, _ -> f.copy(commandTriageRecord = f.commandTriageRecord?.copy(level = "SYN-LEVEL-9")) },
            { f, _ -> f.copy(commandTriageRecord = f.commandTriageRecord?.copy(vitals = emptyMap())) },
            { f, _ ->
                val defaulted = VitalEntry.NotObtained(Chosen(EncounterSamples.NOT_OBTAINED_REASON, EntrySource.DEFAULTED))
                f.copy(
                    commandTriageRecord =
                        f.commandTriageRecord?.let { it.copy(vitals = it.vitals + (EncounterSamples.VITAL_NOT_OBTAINED to defaulted)) },
                )
            },
            // targetBedAssignedToEncounter, targetBedFreeForNewPeriod, returnBedAvailable
            { f, _ -> f.bed(BED_TARGET, BedState.RESERVED, OTHER) },
            { f, r -> f.bed(BED_TARGET, r.pick(BedState.AVAILABLE, null)) },
            { f, _ -> f.copy(targetBedId = null) },
            { f, _ -> f.plus(period(BED_TARGET, 200, 301)) },
            { f, _ -> f.plus(period(BED_TARGET, 400, null)) },
            // bedSwapPairValid
            { f, _ -> f.copy(swap = f.swap?.copy(state = EncounterState.ON_LEAVE)) },
            { f, _ -> f.copy(swap = f.swap?.copy(state = null)) },
            { f, _ -> f.copy(leaveEntries = f.leaveEntries + LeaveEntry("SYN-LOA-F", PARTNER, at(200), null)) },
            { f, _ -> f.plus(period(BED_CURRENT, 400, null)) },
            { f, _ -> f.copy(effectiveTime = at(150)) },
            // swappedBedsAdmitBothPatients, overrideReasonChosen
            { f, _ ->
                f
                    .attributes(BED_TARGET, RESTRICTED_BED)
                    .copy(patientPlacement = f.patientPlacement.copy(sex = RecordedSex.Recorded(EncounterSamples.SEX_EXCLUDED)))
            },
            { f, _ -> f.copy(swap = f.swap?.let { it.copy(placement = it.placement.copy(isolation = IsolationRequirement(null))) }) },
            { f, _ -> f.attributes(BED_CURRENT, EncounterSamples.UNRESTRICTED_BED.copy(pressureSignal = PressureSignal.ALARM_ACTIVE)) },
            { f, _ ->
                f.copy(override = OverrideRequest(Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.DEFAULTED), ALL_RESTRICTIONS))
            },
            { f, _ -> f.copy(override = OverrideRequest(Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.USER), emptySet())) },
            { f, _ -> f.copy(override = null) },
            // effectiveTimeAfterLocationStart
            { f, _ -> f.copy(effectiveTime = at(60), backEntry = emptyList()) },
            { f, _ -> f.copy(effectiveTime = null, backEntry = emptyList()) },
            { f, _ -> f.copy(periods = f.periods.filter { it.id != EncounterSamples.PERIOD_CURRENT }, leaveEntries = emptyList()) },
            // dispositionChosen
            { f, _ -> f.copy(disposition = f.disposition?.copy(source = EntrySource.DEFAULTED)) },
            { f, _ -> f.copy(disposition = Chosen("SYN-NOT-A-DISPOSITION", EntrySource.USER)) },
            { f, _ -> f.copy(disposition = null) },
            // dischargedFrom*, returnBedAvailable, privilegedAndAudited (death reversal)
            { f, r ->
                f.copy(dischargeBeingCancelled = f.dischargeBeingCancelled?.copy(firedFrom = r.pick(null, EncounterState.PLANNED)))
            },
            { f, _ -> f.copy(dischargeBeingCancelled = null) },
            { f, _ -> f.copy(dischargeBeingCancelled = f.dischargeBeingCancelled?.copy(died = Answer.UNKNOWN)) },
            // previousBedAvailable
            { f, r -> f.bed(BED_PREVIOUS, r.pick(BedState.AVAILABLE, BedState.OCCUPIED, null)) },
            { f, _ -> f.plus(period(BED_PREVIOUS, 60, 70)) },
            { f, _ -> f.copy(lastTransfer = null) },
            // correctedTimesConsistent
            { f, _ -> f.copy(boundaryCorrection = BoundaryCorrection(EncounterSamples.PERIOD_CURRENT, BoundaryEnd.START, at(30))) },
            { f, _ -> f.copy(boundaryCorrection = BoundaryCorrection(EncounterSamples.PERIOD_PREVIOUS, BoundaryEnd.START, at(-1))) },
            { f, _ -> f.copy(boundaryCorrection = BoundaryCorrection(EncounterSamples.PERIOD_CURRENT, BoundaryEnd.END, at(400))) },
            { f, _ -> f.copy(boundaryCorrection = BoundaryCorrection("SYN-PER-UNKNOWN", BoundaryEnd.START, at(40))) },
            { f, _ -> f.copy(arrivalTime = null) },
            // backEntryPeriodsWellFormed
            { f, _ -> f.copy(backEntry = f.backEntry.map { it.copy(paperSourceReference = null) }) },
            { f, _ -> f.copy(backEntry = f.backEntry.map { it.copy(start = it.start?.minusSeconds(SPELL_SLACK_SECONDS)) }) },
            { f, _ -> f.copy(recordedTime = at(180)) },
            { f, _ -> f.copy(downtimeSpells = emptyList()) },
            { f, _ -> f.copy(backEntry = f.backEntry.take(1)) },
            // backEntryPeriodsFree / backEntryPeriodsConflict
            { f, _ -> f.plus(period(BED_PAPER_1, 150, 160)) },
            { f, _ -> f.plus(period(BED_PAPER_2, 400, null)) },
            { f, r -> f.bed(BED_PAPER_2, r.pick(BedState.BLOCKED, BedState.CLOSED)) },
            { f, _ -> f.bed(BED_PAPER_2, BedState.RESERVED, OTHER) },
            // errorReasonChosen, wrongPatientError
            { f, _ -> f.copy(errorReason = f.errorReason?.copy(source = EntrySource.DEFAULTED)) },
            { f, _ -> f.copy(errorReason = null) },
            // replacementEncounterReady
            { f, _ -> f.copy(replacement = f.replacement?.copy(patientId = EncounterSamples.PATIENT)) },
            { f, r -> f.copy(replacement = f.replacement?.copy(state = r.pick(EncounterState.IN_PROGRESS, null))) },
            { f, _ -> f.copy(replacement = f.replacement?.copy(identification = null)) },
            { f, _ -> f.plus(period(BED_PREVIOUS, 40, 50)) },
            // handOverPeriodValid
            { f, _ -> f.copy(handOver = f.handOver?.copy(inSameTransaction = false)) },
            { f, _ -> f.copy(handOver = f.handOver?.copy(sourceErrorReason = ErrorReason.DUPLICATE_ENCOUNTER)) },
            { f, _ -> f.copy(handOver = f.handOver?.copy(receivedPeriods = emptyList())) },
            { f, _ -> f.copy(handOver = f.handOver?.copy(sourceReplacementEncounterId = OTHER)) },
            // codingAndChargingComplete
            { f, r -> f.copy(codingComplete = r.pick(Answer.NO, Answer.UNKNOWN)) },
            { f, r -> f.copy(chargeCaptureComplete = r.pick(Answer.NO, Answer.UNKNOWN)) },
            // reasonEntered
            { f, _ -> f.copy(reason = Chosen(" ", EntrySource.USER)) },
            { f, _ -> f.copy(reason = Chosen("SYN reason text", EntrySource.DEFAULTED)) },
            { f, _ -> f.copy(reason = null) },
            // privilegedAndAudited
            { f, r -> f.copy(authorisation = f.authorisation.copy(commandPrivilege = r.pick(Answer.NO, Answer.UNKNOWN))) },
            { f, r -> f.copy(authorisation = f.authorisation.copy(auditAccepted = r.pick(Answer.NO, Answer.UNKNOWN))) },
            // Switches the error-reason alternative to wrong-patient.
            { f, _ -> f.copy(errorReason = Chosen(ErrorReason.WRONG_PATIENT, EntrySource.USER)) },
        )

    private const val SPELL_SLACK_SECONDS = 3_600L
}
