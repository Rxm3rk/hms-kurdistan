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
import hms.adt.domain.encounter.EncounterSamples.BED_DISCHARGED
import hms.adt.domain.encounter.EncounterSamples.BED_PAPER_1
import hms.adt.domain.encounter.EncounterSamples.BED_PAPER_2
import hms.adt.domain.encounter.EncounterSamples.BED_PREVIOUS
import hms.adt.domain.encounter.EncounterSamples.BED_TARGET
import hms.adt.domain.encounter.EncounterSamples.CONFIRMED
import hms.adt.domain.encounter.EncounterSamples.ENCOUNTER
import hms.adt.domain.encounter.EncounterSamples.OTHER
import hms.adt.domain.encounter.EncounterSamples.PARTNER
import hms.adt.domain.encounter.EncounterSamples.Target
import hms.adt.domain.encounter.EncounterSamples.at
import hms.adt.domain.encounter.EncounterSamples.world
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

/**
 * Unit tests of every encounter predicate (docs/specs/state-machines/encounter.yaml; spec §2.1 rule 12): for each, at
 * least one case where it holds and one where it does not, boundaries of every time comparison, every fail-closed
 * unknown, and the exact-complement pairs tested as complements. Synthetic facts only (NOT FOR CLINICAL USE).
 */
class EncounterGuardsTest :
    FunSpec({
        val guards = EncounterGuards
        val base = world()
        val swapWorld = world(target = Target.SWAP_PARTNER)
        val patientOk = EncounterSamples.UNRESTRICTED_PATIENT
        val allRestrictions = RestrictionKind.entries.toSet()

        fun EncounterFacts.withIdentity(identification: PatientIdentification?) = copy(patientIdentification = identification)

        fun EncounterFacts.withBed(
            bedId: String,
            view: BedView,
        ) = copy(beds = beds + (bedId to view))

        fun EncounterFacts.plusPeriod(period: LocationPeriod) = copy(periods = periods + period)

        context("patientIdentityConfirmed") {
            test("patientIdentityConfirmed holds for an MRN and a date of birth both confirmed") {
                guards.patientIdentityConfirmed(base) shouldBe true
            }
            test("patientIdentityConfirmed holds for an MRN and the approximate-DOB flag (unidentified-patient alias)") {
                val alias = CONFIRMED.copy(presented = setOf(IdentifierKind.MRN, IdentifierKind.APPROXIMATE_DOB_FLAG))
                guards.patientIdentityConfirmed(base.withIdentity(alias)) shouldBe true
            }
            test("patientIdentityConfirmed fails when the command carries no identification") {
                guards.patientIdentityConfirmed(base.withIdentity(null)) shouldBe false
            }
            test("patientIdentityConfirmed fails for an MRN and a bed: a location is never an identifier") {
                val withBed = CONFIRMED.copy(presented = setOf(IdentifierKind.MRN, IdentifierKind.BED))
                guards.patientIdentityConfirmed(base.withIdentity(withBed)) shouldBe false
            }
            test("patientIdentityConfirmed fails when a room is presented beside two valid identifiers") {
                val withRoom = CONFIRMED.copy(presented = CONFIRMED.presented + IdentifierKind.ROOM)
                guards.patientIdentityConfirmed(base.withIdentity(withRoom)) shouldBe false
            }
            test("patientIdentityConfirmed fails without an MRN") {
                val noMrn = CONFIRMED.copy(presented = setOf(IdentifierKind.DATE_OF_BIRTH, IdentifierKind.LOCATION))
                guards.patientIdentityConfirmed(base.withIdentity(noMrn)) shouldBe false
            }
            test("patientIdentityConfirmed fails when the identity service's check-digit answer is unknown or no") {
                guards.patientIdentityConfirmed(base.withIdentity(CONFIRMED.copy(mrnCheckDigitValid = Answer.UNKNOWN))) shouldBe false
                guards.patientIdentityConfirmed(base.withIdentity(CONFIRMED.copy(mrnCheckDigitValid = Answer.NO))) shouldBe false
            }
            test("patientIdentityConfirmed fails when the second identifier is not confirmed or unknown") {
                guards.patientIdentityConfirmed(base.withIdentity(CONFIRMED.copy(secondIdentifierConfirmed = Answer.NO))) shouldBe false
                guards.patientIdentityConfirmed(
                    base.withIdentity(CONFIRMED.copy(secondIdentifierConfirmed = Answer.UNKNOWN)),
                ) shouldBe false
            }
        }

        context("swapPartnerIdentityConfirmed") {
            test("swapPartnerIdentityConfirmed holds when the partner's two identifiers are confirmed") {
                guards.swapPartnerIdentityConfirmed(swapWorld) shouldBe true
            }
            test("swapPartnerIdentityConfirmed fails with no swap partner named") {
                guards.swapPartnerIdentityConfirmed(base) shouldBe false
            }
            test("swapPartnerIdentityConfirmed fails when the partner is identified by bed") {
                val byBed = CONFIRMED.copy(presented = setOf(IdentifierKind.BED, IdentifierKind.MRN))
                guards.swapPartnerIdentityConfirmed(swapWorld.copy(swap = swapWorld.swap?.copy(identification = byBed))) shouldBe false
            }
            test("swapPartnerIdentityConfirmed fails when the partner's identification is missing") {
                guards.swapPartnerIdentityConfirmed(swapWorld.copy(swap = swapWorld.swap?.copy(identification = null))) shouldBe false
            }
        }

        context("triageRecordComplete") {
            val record = EncounterSamples.TRIAGE_RECORD
            val configuration = EncounterSamples.TRIAGE_CONFIGURATION
            test("triageRecordComplete holds with a value for one required vital and 'not obtained' with a chosen reason for the other") {
                guards.triageRecordComplete(base) shouldBe true
            }
            test("triageRecordComplete holds with an empty required vital-sign list and no vitals") {
                val facts =
                    base.copy(
                        triageConfiguration = configuration.copy(requiredVitals = emptySet()),
                        commandTriageRecord = record.copy(vitals = emptyMap()),
                    )
                guards.triageRecordComplete(facts) shouldBe true
            }
            test("triageRecordComplete fails when the scale configuration is absent") {
                guards.triageRecordComplete(base.copy(triageConfiguration = null)) shouldBe false
            }
            test("triageRecordComplete fails with no triage record") {
                guards.triageRecordComplete(base.copy(commandTriageRecord = null)) shouldBe false
            }
            test("triageRecordComplete fails for another scale or a level not on the scale") {
                guards.triageRecordComplete(base.copy(commandTriageRecord = record.copy(scale = "SYN-OTHER-SCALE"))) shouldBe false
                guards.triageRecordComplete(base.copy(commandTriageRecord = record.copy(level = "SYN-LEVEL-9"))) shouldBe false
                guards.triageRecordComplete(base.copy(commandTriageRecord = record.copy(level = null))) shouldBe false
            }
            test("triageRecordComplete fails for a blank chief complaint, a missing time or a missing triaging user") {
                guards.triageRecordComplete(base.copy(commandTriageRecord = record.copy(chiefComplaint = " "))) shouldBe false
                guards.triageRecordComplete(base.copy(commandTriageRecord = record.copy(triageTime = null))) shouldBe false
                guards.triageRecordComplete(base.copy(commandTriageRecord = record.copy(triagingUser = null))) shouldBe false
            }
            test("triageRecordComplete fails when a required vital is missing") {
                val missing = record.copy(vitals = record.vitals - EncounterSamples.VITAL_MEASURED)
                guards.triageRecordComplete(base.copy(commandTriageRecord = missing)) shouldBe false
            }
            test("triageRecordComplete fails for a measured vital with no time or a blank value") {
                val noTime = record.copy(vitals = record.vitals + (EncounterSamples.VITAL_MEASURED to VitalEntry.Measured("SYN", null)))
                val blank = record.copy(vitals = record.vitals + (EncounterSamples.VITAL_MEASURED to VitalEntry.Measured("", at(10))))
                guards.triageRecordComplete(base.copy(commandTriageRecord = noTime)) shouldBe false
                guards.triageRecordComplete(base.copy(commandTriageRecord = blank)) shouldBe false
            }
            test("triageRecordComplete fails for 'not obtained' with a defaulted, missing or ungoverned reason") {
                fun notObtained(reason: Chosen<String>?) =
                    base.copy(
                        commandTriageRecord =
                            record.copy(vitals = record.vitals + (EncounterSamples.VITAL_NOT_OBTAINED to VitalEntry.NotObtained(reason))),
                    )
                guards.triageRecordComplete(notObtained(Chosen(EncounterSamples.NOT_OBTAINED_REASON, EntrySource.DEFAULTED))) shouldBe false
                guards.triageRecordComplete(notObtained(null)) shouldBe false
                guards.triageRecordComplete(notObtained(Chosen("SYN-UNGOVERNED", EntrySource.USER))) shouldBe false
            }
        }

        context("onSiteCellConnected") {
            test("onSiteCellConnected holds for a client in the on-site-cell mode at issue") {
                guards.onSiteCellConnected(base) shouldBe true
            }
            test("onSiteCellConnected holds for an in-cell channel whatever the client mode field says") {
                guards.onSiteCellConnected(base.copy(channel = CommandChannel.IN_CELL, clientModeAtIssue = null)) shouldBe true
            }
            test("onSiteCellConnected holds with the internet lost: WAN state is never read") {
                guards.onSiteCellConnected(base.copy(wanReachable = false)) shouldBe true
            }
            test("onSiteCellConnected fails in cell-lost, edge-agent and mobile-offline mode") {
                listOf(ConnectivityMode.CELL_LOST, ConnectivityMode.EDGE_AGENT, ConnectivityMode.MOBILE_OFFLINE).forEach { mode ->
                    guards.onSiteCellConnected(base.copy(clientModeAtIssue = mode)) shouldBe false
                }
            }
            test("onSiteCellConnected fails when the client's mode at issue is unknown") {
                guards.onSiteCellConnected(base.copy(clientModeAtIssue = null)) shouldBe false
            }
        }

        context("targetBedAssignedToEncounter") {
            test("targetBedAssignedToEncounter holds for a bed reserved for this encounter") {
                guards.targetBedAssignedToEncounter(base) shouldBe true
            }
            test("targetBedAssignedToEncounter fails for a bed reserved for another encounter") {
                guards.targetBedAssignedToEncounter(base.withBed(BED_TARGET, BedView(BedState.RESERVED, OTHER))) shouldBe false
            }
            test("targetBedAssignedToEncounter fails for an available bed, an unknown bed state or no target") {
                guards.targetBedAssignedToEncounter(base.withBed(BED_TARGET, BedView(BedState.AVAILABLE, ENCOUNTER))) shouldBe false
                guards.targetBedAssignedToEncounter(base.withBed(BED_TARGET, BedView(null, ENCOUNTER))) shouldBe false
                guards.targetBedAssignedToEncounter(base.copy(targetBedId = null)) shouldBe false
                guards.targetBedAssignedToEncounter(base.copy(beds = base.beds - BED_TARGET)) shouldBe false
            }
        }

        context("targetBedFreeForNewPeriod") {
            test("targetBedFreeForNewPeriod holds when another encounter's period ended at exactly the effective time (half-open)") {
                val ended = LocationPeriod("SYN-PER-X", OTHER, BED_TARGET, at(200), at(300))
                guards.targetBedFreeForNewPeriod(base.plusPeriod(ended)) shouldBe true
            }
            test("targetBedFreeForNewPeriod fails when another encounter's period ends one second after the effective time") {
                val overlapping = LocationPeriod("SYN-PER-X", OTHER, BED_TARGET, at(200), at(300).plusSeconds(1))
                guards.targetBedFreeForNewPeriod(base.plusPeriod(overlapping)) shouldBe false
            }
            test("targetBedFreeForNewPeriod fails for another encounter's open period or one starting later") {
                guards.targetBedFreeForNewPeriod(
                    base.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_TARGET, at(200), null)),
                ) shouldBe false
                guards.targetBedFreeForNewPeriod(base.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_TARGET, at(400), at(500)))) shouldBe
                    false
            }
            test("targetBedFreeForNewPeriod ignores entered-in-error periods and this encounter's own periods") {
                val voided = LocationPeriod("SYN-PER-X", OTHER, BED_TARGET, at(200), null, enteredInError = true)
                val own = LocationPeriod("SYN-PER-Y", ENCOUNTER, BED_TARGET, at(200), null)
                guards.targetBedFreeForNewPeriod(base.plusPeriod(voided).plusPeriod(own)) shouldBe true
            }
            test("targetBedFreeForNewPeriod fails with no effective time or no target bed") {
                guards.targetBedFreeForNewPeriod(base.copy(effectiveTime = null)) shouldBe false
                guards.targetBedFreeForNewPeriod(base.copy(targetBedId = null)) shouldBe false
            }
        }

        context("bedSwapPairValid") {
            test("bedSwapPairValid holds for an in-progress partner whose only open period is on the target bed") {
                guards.bedSwapPairValid(swapWorld) shouldBe true
            }
            test("bedSwapPairValid fails with no partner, or when the partner is this encounter") {
                guards.bedSwapPairValid(base) shouldBe false
                guards.bedSwapPairValid(swapWorld.copy(swap = swapWorld.swap?.copy(encounterId = ENCOUNTER))) shouldBe false
            }
            test("bedSwapPairValid fails when the partner is not in progress, its state is unknown, or it is on leave") {
                guards.bedSwapPairValid(swapWorld.copy(swap = swapWorld.swap?.copy(state = EncounterState.ON_LEAVE))) shouldBe false
                guards.bedSwapPairValid(swapWorld.copy(swap = swapWorld.swap?.copy(state = null))) shouldBe false
                val leave = LeaveEntry("SYN-LOA-F", PARTNER, at(200), null)
                guards.bedSwapPairValid(swapWorld.copy(leaveEntries = listOf(leave))) shouldBe false
            }
            test("bedSwapPairValid fails when the partner's open period is on another bed or the target is this encounter's bed") {
                guards.bedSwapPairValid(swapWorld.copy(targetBedId = BED_CURRENT)) shouldBe false
                val second = LocationPeriod("SYN-PER-F2", PARTNER, BED_DISCHARGED, at(160), null)
                guards.bedSwapPairValid(swapWorld.plusPeriod(second)) shouldBe false
            }
            test("bedSwapPairValid fails when the effective time is not later than the partner's open period start (boundary)") {
                guards.bedSwapPairValid(swapWorld.copy(effectiveTime = at(150))) shouldBe false
                guards.bedSwapPairValid(swapWorld.copy(effectiveTime = at(150).plusSeconds(1))) shouldBe true
            }
            test("bedSwapPairValid fails when a third encounter's period overlaps either bed from the effective time on") {
                guards.bedSwapPairValid(swapWorld.plusPeriod(LocationPeriod("SYN-PER-Z", OTHER, BED_CURRENT, at(400), null))) shouldBe false
                guards.bedSwapPairValid(
                    swapWorld.plusPeriod(LocationPeriod("SYN-PER-Z", OTHER, BED_TARGET, at(200), at(301))),
                ) shouldBe false
            }
            test("bedSwapPairValid fails when this encounter has no open bed period") {
                guards.bedSwapPairValid(
                    swapWorld.copy(periods = swapWorld.periods.filter { it.id != EncounterSamples.PERIOD_CURRENT }),
                ) shouldBe false
            }
        }

        context("swappedBedsAdmitBothPatients") {
            val restricted = EncounterSamples.UNRESTRICTED_BED.copy(genderRestriction = EncounterSamples.GENDER_RESTRICTION)
            test("swappedBedsAdmitBothPatients holds for unrestricted beds") {
                guards.swappedBedsAdmitBothPatients(swapWorld) shouldBe true
            }
            test("swappedBedsAdmitBothPatients fails for a known gender mismatch of the patient moving into the target bed") {
                val facts =
                    swapWorld.copy(
                        bedAttributes = swapWorld.bedAttributes + (BED_TARGET to restricted),
                        patientPlacement = patientOk.copy(sex = RecordedSex.Recorded(EncounterSamples.SEX_EXCLUDED)),
                    )
                guards.swappedBedsAdmitBothPatients(facts) shouldBe false
            }
            test("swappedBedsAdmitBothPatients holds for an unknown sex, a sex the rule does not cover, or an alias (warning only)") {
                val withRestriction = swapWorld.copy(bedAttributes = swapWorld.bedAttributes + (BED_TARGET to restricted))
                listOf(
                    EncounterSamples.UNRESTRICTED_PATIENT.copy(sex = RecordedSex.NotRecorded),
                    EncounterSamples.UNRESTRICTED_PATIENT.copy(sex = RecordedSex.RecordedUnknown),
                    EncounterSamples.UNRESTRICTED_PATIENT.copy(sex = RecordedSex.Recorded(EncounterSamples.SEX_NOT_COVERED)),
                    patientOk.copy(sex = RecordedSex.Recorded(EncounterSamples.SEX_EXCLUDED), onUnidentifiedAlias = true),
                ).forEach { patient ->
                    guards.swappedBedsAdmitBothPatients(withRestriction.copy(patientPlacement = patient)) shouldBe true
                }
            }
            test("swappedBedsAdmitBothPatients fails for an isolation requirement of unknown kind or a bed of unknown capability") {
                val isolatedPartner = EncounterSamples.UNRESTRICTED_PATIENT.copy(isolation = IsolationRequirement(null))
                guards.swappedBedsAdmitBothPatients(swapWorld.copy(swap = swapWorld.swap?.copy(placement = isolatedPartner))) shouldBe false
                val kindKnown = patientOk.copy(isolation = IsolationRequirement(EncounterSamples.ISOLATION_KIND))
                val unknownCapability = swapWorld.bedAttributes + (BED_CURRENT to BedAttributes.NOT_RECORDED)
                guards.swappedBedsAdmitBothPatients(
                    swapWorld.copy(swap = swapWorld.swap?.copy(placement = kindKnown), bedAttributes = unknownCapability),
                ) shouldBe false
            }
            test("swappedBedsAdmitBothPatients holds when an isolation requirement is met by capability or by a cohort declaration") {
                val isolated = EncounterSamples.UNRESTRICTED_PATIENT.copy(isolation = IsolationRequirement(EncounterSamples.ISOLATION_KIND))
                val capable = EncounterSamples.UNRESTRICTED_BED.copy(isolationCapabilities = setOf(EncounterSamples.ISOLATION_KIND))
                val cohort = EncounterSamples.UNRESTRICTED_BED.copy(activeCohortKinds = setOf(EncounterSamples.ISOLATION_KIND))
                guards.swappedBedsAdmitBothPatients(
                    swapWorld.copy(patientPlacement = isolated, bedAttributes = swapWorld.bedAttributes + (BED_TARGET to capable)),
                ) shouldBe true
                guards.swappedBedsAdmitBothPatients(
                    swapWorld.copy(patientPlacement = isolated, bedAttributes = swapWorld.bedAttributes + (BED_TARGET to cohort)),
                ) shouldBe true
                guards.swappedBedsAdmitBothPatients(swapWorld.copy(patientPlacement = isolated)) shouldBe false
            }
            test("swappedBedsAdmitBothPatients fails for an active pressure alarm in either room and holds for an unknown signal") {
                val alarm = EncounterSamples.UNRESTRICTED_BED.copy(pressureSignal = PressureSignal.ALARM_ACTIVE)
                val unknown = EncounterSamples.UNRESTRICTED_BED.copy(pressureSignal = PressureSignal.UNKNOWN)
                guards.swappedBedsAdmitBothPatients(
                    swapWorld.copy(bedAttributes = swapWorld.bedAttributes + (BED_CURRENT to alarm)),
                ) shouldBe false
                guards.swappedBedsAdmitBothPatients(
                    swapWorld.copy(bedAttributes = swapWorld.bedAttributes + (BED_TARGET to alarm)),
                ) shouldBe false
                guards.swappedBedsAdmitBothPatients(
                    swapWorld.copy(bedAttributes = swapWorld.bedAttributes + (BED_TARGET to unknown)),
                ) shouldBe true
            }
            test("swappedBedsAdmitBothPatients fails when there is no swap to evaluate") {
                guards.swappedBedsAdmitBothPatients(base) shouldBe false
            }
        }

        context("overrideReasonChosen") {
            val alarm = EncounterSamples.UNRESTRICTED_BED.copy(pressureSignal = PressureSignal.ALARM_ACTIVE)
            val alarmWorld = swapWorld.copy(bedAttributes = swapWorld.bedAttributes + (BED_TARGET to alarm))
            test("overrideReasonChosen holds for a user-chosen reason naming every failing restriction") {
                guards.overrideReasonChosen(alarmWorld) shouldBe true
                val cohortReason = Chosen(OverrideReason.IPC_APPROVED_COHORT, EntrySource.USER)
                val justAlarm = OverrideRequest(cohortReason, setOf(RestrictionKind.PRESSURE_ALARM))
                guards.overrideReasonChosen(alarmWorld.copy(override = justAlarm)) shouldBe true
            }
            test("overrideReasonChosen fails for a defaulted reason or no reason") {
                val defaulted = OverrideRequest(Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.DEFAULTED), allRestrictions)
                guards.overrideReasonChosen(alarmWorld.copy(override = defaulted)) shouldBe false
                guards.overrideReasonChosen(
                    alarmWorld.copy(override = OverrideRequest(null, allRestrictions)),
                ) shouldBe false
                guards.overrideReasonChosen(alarmWorld.copy(override = null)) shouldBe false
            }
            test("overrideReasonChosen fails when the failing restriction is not named, or nothing is named") {
                val dataReason = Chosen(OverrideReason.RESTRICTION_DATA_WRONG_OR_UNKNOWN, EntrySource.USER)
                val genderOnly = OverrideRequest(dataReason, setOf(RestrictionKind.GENDER))
                guards.overrideReasonChosen(alarmWorld.copy(override = genderOnly)) shouldBe false
                val none = OverrideRequest(Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.USER), emptySet())
                guards.overrideReasonChosen(swapWorld.copy(override = none)) shouldBe false
            }
            test("overrideReasonChosen fails when there is no swap to evaluate") {
                guards.overrideReasonChosen(base) shouldBe false
            }
        }

        context("effectiveTimeAfterLocationStart") {
            test("effectiveTimeAfterLocationStart holds one second after the open bed period's start and fails at it (boundary)") {
                guards.effectiveTimeAfterLocationStart(base.copy(effectiveTime = at(60).plusSeconds(1))) shouldBe true
                guards.effectiveTimeAfterLocationStart(base.copy(effectiveTime = at(60))) shouldBe false
            }
            test("effectiveTimeAfterLocationStart reads the open leave entry while on leave") {
                val onLeave = world(onLeave = true)
                guards.effectiveTimeAfterLocationStart(onLeave.copy(effectiveTime = at(100))) shouldBe false
                guards.effectiveTimeAfterLocationStart(onLeave.copy(effectiveTime = at(101))) shouldBe true
            }
            test("effectiveTimeAfterLocationStart fails with no open entry or no effective time") {
                guards.effectiveTimeAfterLocationStart(base.copy(periods = EncounterSamples.OWN_PERIODS.take(1))) shouldBe false
                guards.effectiveTimeAfterLocationStart(base.copy(effectiveTime = null)) shouldBe false
            }
            test("effectiveTimeAfterLocationStart uses the first paper period's start for a back-entry") {
                val backEntry = world(withBackEntry = true)
                guards.effectiveTimeAfterLocationStart(backEntry.copy(effectiveTime = at(0))) shouldBe true
                val early = backEntry.copy(backEntry = listOf(EncounterSamples.PAPER[0].copy(start = at(60)), EncounterSamples.PAPER[1]))
                guards.effectiveTimeAfterLocationStart(early) shouldBe false
            }
            test("effectiveTimeAfterLocationStart ignores entered-in-error entries") {
                val voidedLeave = LeaveEntry("SYN-LOA-X", ENCOUNTER, at(400), null, enteredInError = true)
                guards.effectiveTimeAfterLocationStart(base.copy(leaveEntries = listOf(voidedLeave))) shouldBe true
            }
        }

        context("dispositionChosen") {
            test("dispositionChosen holds for a user-chosen baseline disposition when the tenant list is missing or empty") {
                guards.dispositionChosen(base) shouldBe true
                guards.dispositionChosen(
                    base.copy(tenantDispositions = emptySet(), disposition = Chosen("died", EntrySource.USER)),
                ) shouldBe true
            }
            test("dispositionChosen holds for a disposition from the tenant's governed list") {
                guards.dispositionChosen(
                    base.copy(tenantDispositions = setOf("SYN-DISPOSITION-1"), disposition = Chosen("SYN-DISPOSITION-1", EntrySource.USER)),
                ) shouldBe true
            }
            test("dispositionChosen fails for a defaulted or missing disposition") {
                guards.dispositionChosen(base.copy(disposition = Chosen("home", EntrySource.DEFAULTED))) shouldBe false
                guards.dispositionChosen(base.copy(disposition = null)) shouldBe false
            }
            test("dispositionChosen fails for a value outside the list in use") {
                guards.dispositionChosen(base.copy(tenantDispositions = setOf("SYN-DISPOSITION-1"))) shouldBe false
                guards.dispositionChosen(base.copy(disposition = Chosen("SYN-NOT-A-DISPOSITION", EntrySource.USER))) shouldBe false
            }
        }

        context("returnBedAvailable") {
            val released = world(target = Target.RELEASED_BY_DISCHARGE)
            test("returnBedAvailable holds in case (b): another bed reserved for this encounter and free") {
                guards.returnBedAvailable(base) shouldBe true
            }
            test("returnBedAvailable holds in case (a): the released bed, dirty or cleaning, unused since the discharge") {
                guards.returnBedAvailable(released) shouldBe true
                guards.returnBedAvailable(released.withBed(BED_TARGET, BedView(BedState.CLEANING, null))) shouldBe true
            }
            test("returnBedAvailable fails in case (a) when the released bed is available again or someone used it since") {
                guards.returnBedAvailable(released.withBed(BED_TARGET, BedView(BedState.AVAILABLE, null))) shouldBe false
                guards.returnBedAvailable(
                    released.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_TARGET, at(280), at(290))),
                ) shouldBe false
            }
            test("returnBedAvailable in case (a): a period that ended exactly at the discharge time does not count (half-open)") {
                guards.returnBedAvailable(
                    released.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_TARGET, at(200), at(270))),
                ) shouldBe true
            }
            test("returnBedAvailable fails in case (b) for a bed not reserved for this encounter or not free") {
                guards.returnBedAvailable(base.withBed(BED_TARGET, BedView(BedState.RESERVED, OTHER))) shouldBe false
                guards.returnBedAvailable(base.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_TARGET, at(200), null))) shouldBe false
            }
            test("returnBedAvailable fails with no discharge being cancelled, no target, or an unknown target bed") {
                guards.returnBedAvailable(base.copy(dischargeBeingCancelled = null)) shouldBe false
                guards.returnBedAvailable(base.copy(targetBedId = null)) shouldBe false
                guards.returnBedAvailable(released.copy(beds = released.beds - BED_TARGET)) shouldBe false
            }
        }

        context("dischargedFromBed, dischargedFromLeave and dischargedBeforeAdmission") {
            fun origins(facts: EncounterFacts) =
                listOf(guards.dischargedFromBed(facts), guards.dischargedFromLeave(facts), guards.dischargedBeforeAdmission(facts))
            test("dischargedFromBed holds alone for a discharge fired from in-progress") {
                origins(world(dischargedFrom = EncounterState.IN_PROGRESS)) shouldBe listOf(true, false, false)
            }
            test("dischargedFromLeave holds alone for a discharge fired from on-leave") {
                origins(world(dischargedFrom = EncounterState.ON_LEAVE)) shouldBe listOf(false, true, false)
            }
            test("dischargedBeforeAdmission holds alone for a discharge fired from arrived or triaged") {
                origins(world(dischargedFrom = EncounterState.ARRIVED)) shouldBe listOf(false, false, true)
                origins(world(dischargedFrom = EncounterState.TRIAGED)) shouldBe listOf(false, false, true)
            }
            test("dischargedFromBed, dischargedFromLeave and dischargedBeforeAdmission all fail for an unknown origin") {
                origins(base.copy(dischargeBeingCancelled = base.dischargeBeingCancelled?.copy(firedFrom = null))) shouldBe
                    listOf(false, false, false)
                origins(world(dischargedFrom = EncounterState.PLANNED)) shouldBe listOf(false, false, false)
                origins(base.copy(dischargeBeingCancelled = null)) shouldBe listOf(false, false, false)
            }
        }

        context("triageRecorded and noTriageRecorded") {
            test("triageRecorded holds and noTriageRecorded fails when a valid triage record is held") {
                val facts = world(triageRecorded = true)
                guards.triageRecorded(facts) shouldBe true
                guards.noTriageRecorded(facts) shouldBe false
            }
            test("noTriageRecorded holds and triageRecorded fails with no record or only entered-in-error records") {
                guards.triageRecorded(base) shouldBe false
                guards.noTriageRecorded(base) shouldBe true
                val voided = base.copy(heldTriageRecords = listOf(HeldTriageRecord("SYN-TRI-X", true)))
                guards.triageRecorded(voided) shouldBe false
                guards.noTriageRecorded(voided) shouldBe true
            }
        }

        context("previousBedAvailable") {
            test("previousBedAvailable holds for the previous bed dirty or cleaning and unused since the transfer") {
                guards.previousBedAvailable(base) shouldBe true
                guards.previousBedAvailable(base.withBed(BED_PREVIOUS, BedView(BedState.CLEANING, null))) shouldBe true
            }
            test("previousBedAvailable fails when another encounter's period on it starts at or after the transfer") {
                guards.previousBedAvailable(
                    base.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_PREVIOUS, at(60), at(70))),
                ) shouldBe false
            }
            test("previousBedAvailable fails when another encounter's period on it is still open across the transfer") {
                guards.previousBedAvailable(base.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_PREVIOUS, at(10), null))) shouldBe false
            }
            test("previousBedAvailable ignores a period that ended exactly at the transfer (half-open) or was entered in error") {
                guards.previousBedAvailable(base.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_PREVIOUS, at(0), at(60)))) shouldBe true
                guards.previousBedAvailable(
                    base.plusPeriod(LocationPeriod("SYN-PER-Y", OTHER, BED_PREVIOUS, at(90), null, true)),
                ) shouldBe true
            }
            test("previousBedAvailable fails for an available, reserved or unknown previous bed, or no last transfer") {
                guards.previousBedAvailable(base.withBed(BED_PREVIOUS, BedView(BedState.AVAILABLE, null))) shouldBe false
                guards.previousBedAvailable(base.withBed(BED_PREVIOUS, BedView(null, null))) shouldBe false
                guards.previousBedAvailable(base.copy(lastTransfer = null)) shouldBe false
                guards.previousBedAvailable(base.copy(lastTransfer = TransferRecord(null, BED_PREVIOUS))) shouldBe false
            }
        }

        context("correctedTimesConsistent") {
            fun correcting(
                entryId: String?,
                end: BoundaryEnd,
                minutes: Long?,
                facts: EncounterFacts = base,
            ) = facts.copy(boundaryCorrection = BoundaryCorrection(entryId, end, minutes?.let { at(it) }))
            test("correctedTimesConsistent holds when a transfer instant moves for both periods") {
                guards.correctedTimesConsistent(base) shouldBe true
                guards.correctedTimesConsistent(correcting(EncounterSamples.PERIOD_PREVIOUS, BoundaryEnd.END, 45)) shouldBe true
            }
            test("correctedTimesConsistent fails when a period would end at or before its start (boundary)") {
                guards.correctedTimesConsistent(correcting(EncounterSamples.PERIOD_CURRENT, BoundaryEnd.START, 30)) shouldBe false
                guards.correctedTimesConsistent(correcting(EncounterSamples.PERIOD_CURRENT, BoundaryEnd.START, 31)) shouldBe true
            }
            test("correctedTimesConsistent fails when the first period would start before the arrival (boundary)") {
                guards.correctedTimesConsistent(correcting(EncounterSamples.PERIOD_PREVIOUS, BoundaryEnd.START, -1)) shouldBe false
                guards.correctedTimesConsistent(correcting(EncounterSamples.PERIOD_PREVIOUS, BoundaryEnd.START, 0)) shouldBe true
            }
            test("correctedTimesConsistent fails when a changed interval overlaps another encounter's period on the bed") {
                val other = LocationPeriod("SYN-PER-X", OTHER, BED_PREVIOUS, at(0), at(20))
                guards.correctedTimesConsistent(
                    correcting(EncounterSamples.PERIOD_PREVIOUS, BoundaryEnd.START, 10, base.plusPeriod(other)),
                ) shouldBe false
                guards.correctedTimesConsistent(
                    correcting(EncounterSamples.PERIOD_PREVIOUS, BoundaryEnd.START, 20, base.plusPeriod(other)),
                ) shouldBe true
            }
            test("correctedTimesConsistent fails for the end of an open period, an unknown entry, or a missing time or arrival") {
                guards.correctedTimesConsistent(correcting(EncounterSamples.PERIOD_CURRENT, BoundaryEnd.END, 200)) shouldBe false
                guards.correctedTimesConsistent(correcting("SYN-PER-UNKNOWN", BoundaryEnd.START, 40)) shouldBe false
                guards.correctedTimesConsistent(correcting(null, BoundaryEnd.START, 40)) shouldBe false
                guards.correctedTimesConsistent(correcting(EncounterSamples.PERIOD_CURRENT, BoundaryEnd.START, null)) shouldBe false
                guards.correctedTimesConsistent(base.copy(arrivalTime = null)) shouldBe false
                guards.correctedTimesConsistent(base.copy(boundaryCorrection = null)) shouldBe false
            }
            test("correctedTimesConsistent corrects a leave entry and keeps leave entries in order") {
                val closedLeave = LeaveEntry("SYN-LOA-1", ENCOUNTER, at(100), at(110))
                val laterLeave = LeaveEntry("SYN-LOA-2", ENCOUNTER, at(120), null)
                val facts = base.copy(leaveEntries = listOf(closedLeave, laterLeave))
                guards.correctedTimesConsistent(correcting("SYN-LOA-1", BoundaryEnd.END, 115, facts)) shouldBe true
                guards.correctedTimesConsistent(correcting("SYN-LOA-1", BoundaryEnd.END, 121, facts)) shouldBe false
                guards.correctedTimesConsistent(correcting("SYN-LOA-2", BoundaryEnd.END, 130, facts)) shouldBe false
            }
        }

        context("backEntryPeriodsWellFormed") {
            val backEntry = world(withBackEntry = true)
            val paper = EncounterSamples.PAPER
            test("backEntryPeriodsWellFormed holds for consecutive labelled periods inside one downtime spell, last open-ended") {
                guards.backEntryPeriodsWellFormed(backEntry) shouldBe true
            }
            test("backEntryPeriodsWellFormed holds for a single open-ended period") {
                guards.backEntryPeriodsWellFormed(backEntry.copy(backEntry = paper.take(1).map { it.copy(end = null) })) shouldBe true
            }
            test("backEntryPeriodsWellFormed fails with no periods, a bounded last period or an unbounded earlier one") {
                guards.backEntryPeriodsWellFormed(backEntry.copy(backEntry = emptyList())) shouldBe false
                guards.backEntryPeriodsWellFormed(backEntry.copy(backEntry = paper.take(1))) shouldBe false
                guards.backEntryPeriodsWellFormed(backEntry.copy(backEntry = listOf(paper[0].copy(end = null), paper[1]))) shouldBe false
            }
            test("backEntryPeriodsWellFormed fails for a missing label, paper reference, bed or start") {
                listOf(
                    paper[0].copy(downtimeLabel = false),
                    paper[0].copy(paperSourceReference = " "),
                    paper[0].copy(bedId = null),
                    paper[0].copy(start = null),
                ).forEach { broken ->
                    guards.backEntryPeriodsWellFormed(backEntry.copy(backEntry = listOf(broken, paper[1]))) shouldBe false
                }
            }
            test("backEntryPeriodsWellFormed fails for a gap or an overlap between periods") {
                guards.backEntryPeriodsWellFormed(
                    backEntry.copy(backEntry = listOf(paper[0], paper[1].copy(start = at(181)))),
                ) shouldBe false
                guards.backEntryPeriodsWellFormed(
                    backEntry.copy(backEntry = listOf(paper[0], paper[1].copy(start = at(179)))),
                ) shouldBe false
            }
            test("backEntryPeriodsWellFormed fails for a bounded period whose end is not after its start") {
                val empty = listOf(paper[0].copy(end = at(120)), paper[1].copy(start = at(120)))
                guards.backEntryPeriodsWellFormed(backEntry.copy(backEntry = empty)) shouldBe false
            }
            test("backEntryPeriodsWellFormed fails outside the downtime spell (boundaries) or with no spell") {
                guards.backEntryPeriodsWellFormed(
                    backEntry.copy(backEntry = listOf(paper[0].copy(start = at(119)), paper[1])),
                ) shouldBe false
                guards.backEntryPeriodsWellFormed(
                    backEntry.copy(backEntry = listOf(paper[0].copy(end = at(240)), paper[1].copy(start = at(240)))),
                ) shouldBe false
                guards.backEntryPeriodsWellFormed(backEntry.copy(downtimeSpells = emptyList())) shouldBe false
                val onSite = DowntimeSpell(ConnectivityMode.ON_SITE_CELL, at(120), at(240))
                guards.backEntryPeriodsWellFormed(backEntry.copy(downtimeSpells = listOf(onSite))) shouldBe false
            }
            test("backEntryPeriodsWellFormed fails when a period is not before the recorded time or starts before the arrival") {
                guards.backEntryPeriodsWellFormed(backEntry.copy(recordedTime = at(180))) shouldBe false
                guards.backEntryPeriodsWellFormed(backEntry.copy(recordedTime = at(181))) shouldBe true
                guards.backEntryPeriodsWellFormed(backEntry.copy(arrivalTime = at(121))) shouldBe false
                guards.backEntryPeriodsWellFormed(backEntry.copy(arrivalTime = null)) shouldBe false
                guards.backEntryPeriodsWellFormed(backEntry.copy(recordedTime = null)) shouldBe false
            }
        }

        context("backEntryPeriodsFree and backEntryPeriodsConflict") {
            val backEntry = world(withBackEntry = true)
            fun complement(facts: EncounterFacts) {
                guards.backEntryPeriodsConflict(facts) shouldBe !guards.backEntryPeriodsFree(facts)
            }
            test("backEntryPeriodsFree holds and backEntryPeriodsConflict fails when no paper interval overlaps another encounter") {
                guards.backEntryPeriodsFree(backEntry) shouldBe true
                guards.backEntryPeriodsConflict(backEntry) shouldBe false
            }
            test("backEntryPeriodsFree checks a bounded period over its own interval only (half-open)") {
                val afterwards = backEntry.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_PAPER_1, at(180), null))
                guards.backEntryPeriodsFree(afterwards) shouldBe true
                complement(afterwards)
                val inside = backEntry.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_PAPER_1, at(150), at(160)))
                guards.backEntryPeriodsFree(inside) shouldBe false
                guards.backEntryPeriodsConflict(inside) shouldBe true
            }
            test("backEntryPeriodsConflict holds when the last period's bed is used by another encounter later on") {
                val later = backEntry.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_PAPER_2, at(400), at(500)))
                guards.backEntryPeriodsConflict(later) shouldBe true
                complement(later)
            }
            test("backEntryPeriodsConflict holds when the last bed is reserved for another encounter, blocked, closed or unknown") {
                listOf(
                    BedView(BedState.RESERVED, OTHER),
                    BedView(BedState.BLOCKED, null),
                    BedView(BedState.CLOSED, null),
                    BedView(null, null),
                ).forEach { view ->
                    val facts = backEntry.withBed(BED_PAPER_2, view)
                    guards.backEntryPeriodsConflict(facts) shouldBe true
                    complement(facts)
                }
                guards.backEntryPeriodsConflict(backEntry.copy(beds = backEntry.beds - BED_PAPER_2)) shouldBe true
            }
            test("backEntryPeriodsFree ignores entered-in-error periods and accepts a last bed reserved for this encounter") {
                val voided = backEntry.plusPeriod(LocationPeriod("SYN-PER-X", OTHER, BED_PAPER_1, at(150), null, enteredInError = true))
                guards.backEntryPeriodsFree(voided.withBed(BED_PAPER_2, BedView(BedState.RESERVED, ENCOUNTER))) shouldBe true
            }
            test("backEntryPeriodsConflict holds and backEntryPeriodsFree fails when the back-entry cannot be checked") {
                guards.backEntryPeriodsConflict(base) shouldBe true
                guards.backEntryPeriodsFree(base) shouldBe false
                val noBed = backEntry.copy(backEntry = listOf(EncounterSamples.PAPER[0].copy(bedId = null)))
                guards.backEntryPeriodsConflict(noBed) shouldBe true
                complement(noBed)
            }
        }

        context("errorReasonChosen, wrongPatientError and notWrongPatientError") {
            test("errorReasonChosen holds for a user-chosen coded reason") {
                ErrorReason.entries.forEach { reason ->
                    guards.errorReasonChosen(base.copy(errorReason = Chosen(reason, EntrySource.USER))) shouldBe true
                }
            }
            test("errorReasonChosen fails for a defaulted or missing reason") {
                guards.errorReasonChosen(
                    base.copy(errorReason = Chosen(ErrorReason.DUPLICATE_ENCOUNTER, EntrySource.DEFAULTED)),
                ) shouldBe false
                guards.errorReasonChosen(base.copy(errorReason = null)) shouldBe false
            }
            test("wrongPatientError holds and notWrongPatientError fails for the reason wrong-patient") {
                val facts = world(errorReason = ErrorReason.WRONG_PATIENT)
                guards.wrongPatientError(facts) shouldBe true
                guards.notWrongPatientError(facts) shouldBe false
            }
            test("notWrongPatientError holds and wrongPatientError fails for every other reason or none") {
                listOf(
                    world(errorReason = ErrorReason.DUPLICATE_ENCOUNTER),
                    world(errorReason = ErrorReason.REGISTERED_IN_ERROR),
                    base.copy(errorReason = null),
                ).forEach { facts ->
                        guards.wrongPatientError(facts) shouldBe false
                        guards.notWrongPatientError(facts) shouldBe true
                    }
            }
        }

        context("replacementEncounterReady") {
            val replacement = requireNotNull(base.replacement)
            test("replacementEncounterReady holds for another patient's arrived encounter, identified, with no open bed period") {
                guards.replacementEncounterReady(base) shouldBe true
                guards.replacementEncounterReady(base.copy(replacement = replacement.copy(state = EncounterState.TRIAGED))) shouldBe true
            }
            test("replacementEncounterReady fails for the same patient, the same encounter or no replacement") {
                guards.replacementEncounterReady(
                    base.copy(replacement = replacement.copy(patientId = EncounterSamples.PATIENT)),
                ) shouldBe false
                guards.replacementEncounterReady(base.copy(replacement = replacement.copy(encounterId = ENCOUNTER))) shouldBe false
                guards.replacementEncounterReady(base.copy(replacement = null)) shouldBe false
            }
            test("replacementEncounterReady fails for an in-progress, unknown-state or unidentified replacement") {
                guards.replacementEncounterReady(
                    base.copy(replacement = replacement.copy(state = EncounterState.IN_PROGRESS)),
                ) shouldBe false
                guards.replacementEncounterReady(base.copy(replacement = replacement.copy(state = null))) shouldBe false
                guards.replacementEncounterReady(base.copy(replacement = replacement.copy(identification = null))) shouldBe false
            }
            test("replacementEncounterReady fails when the replacement has an open bed period") {
                val open = LocationPeriod("SYN-PER-R", EncounterSamples.REPLACEMENT, BED_DISCHARGED, at(100), null)
                guards.replacementEncounterReady(base.plusPeriod(open)) shouldBe false
            }
            test("replacementEncounterReady fails when this encounter's periods would overlap another encounter's period") {
                val clash = LocationPeriod("SYN-PER-X", OTHER, BED_PREVIOUS, at(40), at(50))
                guards.replacementEncounterReady(base.plusPeriod(clash)) shouldBe false
                val voided = clash.copy(enteredInError = true)
                guards.replacementEncounterReady(base.plusPeriod(voided)) shouldBe true
            }
        }

        context("handOverPeriodValid") {
            val handOver = requireNotNull(base.handOver)
            test("handOverPeriodValid holds for the second half of a wrong-patient cancellation naming this encounter") {
                guards.handOverPeriodValid(base) shouldBe true
            }
            test("handOverPeriodValid fails outside the same transaction, for another reason, or naming another replacement") {
                guards.handOverPeriodValid(base.copy(handOver = handOver.copy(inSameTransaction = false))) shouldBe false
                guards.handOverPeriodValid(
                    base.copy(handOver = handOver.copy(sourceErrorReason = ErrorReason.DUPLICATE_ENCOUNTER)),
                ) shouldBe false
                guards.handOverPeriodValid(base.copy(handOver = handOver.copy(sourceReplacementEncounterId = OTHER))) shouldBe false
                guards.handOverPeriodValid(base.copy(handOver = null)) shouldBe false
            }
            test("handOverPeriodValid fails when the received periods differ from the source's or are empty") {
                val shifted = handOver.copy(receivedPeriods = listOf(HandedOverPeriod(EncounterSamples.BED_HAND_OVER, at(61), null)))
                guards.handOverPeriodValid(base.copy(handOver = shifted)) shouldBe false
                guards.handOverPeriodValid(base.copy(handOver = handOver.copy(receivedPeriods = emptyList()))) shouldBe false
            }
            test("handOverPeriodValid fails when a received period overlaps another encounter's period") {
                val clash = LocationPeriod("SYN-PER-X", OTHER, EncounterSamples.BED_HAND_OVER, at(100), null)
                guards.handOverPeriodValid(base.plusPeriod(clash)) shouldBe false
            }
        }

        context("codingAndChargingComplete") {
            test("codingAndChargingComplete holds when coding and charge capture are both complete") {
                guards.codingAndChargingComplete(base) shouldBe true
            }
            test("codingAndChargingComplete fails when either answer is no or unknown") {
                guards.codingAndChargingComplete(base.copy(codingComplete = Answer.NO)) shouldBe false
                guards.codingAndChargingComplete(base.copy(codingComplete = Answer.UNKNOWN)) shouldBe false
                guards.codingAndChargingComplete(base.copy(chargeCaptureComplete = Answer.NO)) shouldBe false
                guards.codingAndChargingComplete(base.copy(chargeCaptureComplete = Answer.UNKNOWN)) shouldBe false
            }
            test("codingAndChargingComplete never reads payment: an unpaid balance or a denied pre-approval changes nothing") {
                val unpaid = FinanceFacts(Long.MAX_VALUE, Answer.NO, PreApprovalStatus.DENIED)
                guards.codingAndChargingComplete(base.copy(finance = unpaid)) shouldBe true
            }
        }

        context("reasonEntered") {
            test("reasonEntered holds for a typed reason") {
                guards.reasonEntered(base) shouldBe true
            }
            test("reasonEntered fails for a blank, defaulted or missing reason") {
                guards.reasonEntered(base.copy(reason = Chosen("  ", EntrySource.USER))) shouldBe false
                guards.reasonEntered(base.copy(reason = Chosen("SYN reason", EntrySource.DEFAULTED))) shouldBe false
                guards.reasonEntered(base.copy(reason = null)) shouldBe false
            }
        }

        context("privilegedAndAudited") {
            val yes = Authorisation(Answer.YES, Answer.NO, Answer.YES)
            test("privilegedAndAudited holds with the privilege and an accepted audit when no death is reversed") {
                guards.privilegedAndAudited(base.copy(authorisation = yes)) shouldBe true
            }
            test("privilegedAndAudited fails without the privilege or when the audit cannot be written") {
                guards.privilegedAndAudited(base.copy(authorisation = yes.copy(commandPrivilege = Answer.NO))) shouldBe false
                guards.privilegedAndAudited(base.copy(authorisation = yes.copy(commandPrivilege = Answer.UNKNOWN))) shouldBe false
                guards.privilegedAndAudited(base.copy(authorisation = yes.copy(auditAccepted = Answer.NO))) shouldBe false
                guards.privilegedAndAudited(base.copy(authorisation = yes.copy(auditAccepted = Answer.UNKNOWN))) shouldBe false
            }
            test("privilegedAndAudited needs the death-reversal privilege to cancel a discharge whose disposition was died or is unknown") {
                listOf(Answer.YES, Answer.UNKNOWN).forEach { died ->
                    val facts = base.copy(dischargeBeingCancelled = base.dischargeBeingCancelled?.copy(died = died))
                    guards.privilegedAndAudited(facts.copy(authorisation = yes)) shouldBe false
                    guards.privilegedAndAudited(facts.copy(authorisation = yes.copy(deathReversalPrivilege = Answer.YES))) shouldBe true
                }
            }
        }
    })
