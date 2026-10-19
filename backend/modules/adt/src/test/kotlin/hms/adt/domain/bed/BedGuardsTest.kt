package hms.adt.domain.bed

import hms.adt.domain.bed.BedSamples.BED
import hms.adt.domain.bed.BedSamples.ENCOUNTER
import hms.adt.domain.bed.BedSamples.OTHER
import hms.adt.domain.bed.BedSamples.OWN_PERIOD
import hms.adt.domain.bed.BedSamples.at
import hms.adt.domain.bed.BedSamples.world
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
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

/**
 * Unit tests of every bed predicate (docs/specs/state-machines/bed.yaml; spec §2.1 rule 12): for each, at least one
 * case where it holds and one where it does not, the half-open boundaries, every fail-closed unknown, and the
 * exact-complement pair tested as complements. Synthetic facts only (NOT FOR CLINICAL USE).
 */
class BedGuardsTest :
    FunSpec({
        val guards = BedGuards
        val base = world()
        val patientOk = BedSamples.UNRESTRICTED_PATIENT
        val restricted = BedSamples.UNRESTRICTED_BED.copy(genderRestriction = BedSamples.GENDER_RESTRICTION)
        val isolated = patientOk.copy(isolation = IsolationRequirement(BedSamples.ISOLATION_KIND))

        fun BedFacts.plus(period: LocationPeriod) = copy(periods = periods + period)

        fun other(
            start: Long,
            end: Long?,
            enteredInError: Boolean = false,
        ) = LocationPeriod("SYN-PER-X", OTHER, BED, at(start), end?.let { at(it) }, enteredInError)

        context("onSiteCellConnected") {
            test("onSiteCellConnected holds for a client in the on-site-cell mode and for an in-cell channel") {
                guards.onSiteCellConnected(base) shouldBe true
                guards.onSiteCellConnected(
                    base.copy(channel = CommandChannel.IN_CELL, clientModeAtIssue = ConnectivityMode.CELL_LOST),
                ) shouldBe true
            }
            test("onSiteCellConnected holds with the internet lost: WAN state is never read") {
                guards.onSiteCellConnected(base.copy(wanReachable = false)) shouldBe true
            }
            test("onSiteCellConnected fails offline and when the mode at issue is unknown") {
                listOf(ConnectivityMode.CELL_LOST, ConnectivityMode.EDGE_AGENT, ConnectivityMode.MOBILE_OFFLINE, null).forEach { mode ->
                    guards.onSiteCellConnected(base.copy(clientModeAtIssue = mode)) shouldBe false
                }
            }
        }

        context("reservationEncounterOpen") {
            test("reservationEncounterOpen holds for an encounter in planned, arrived, triaged or in-progress") {
                val open = listOf(EncounterState.PLANNED, EncounterState.ARRIVED, EncounterState.TRIAGED, EncounterState.IN_PROGRESS)
                open.forEach { state ->
                    guards.reservationEncounterOpen(base.copy(commandEncounterState = state)) shouldBe true
                }
            }
            test("reservationEncounterOpen fails for an encounter on leave, ended, of unknown state, or none named") {
                listOf(
                    EncounterState.ON_LEAVE,
                    EncounterState.DISCHARGED_NOT_CLOSED,
                    EncounterState.FINISHED,
                    EncounterState.CANCELLED,
                    EncounterState.ENTERED_IN_ERROR,
                    null,
                ).forEach { state ->
                    guards.reservationEncounterOpen(base.copy(commandEncounterState = state)) shouldBe false
                }
                guards.reservationEncounterOpen(base.copy(commandEncounterId = null)) shouldBe false
            }
        }

        context("bedRestrictionsAdmitPatient") {
            test("bedRestrictionsAdmitPatient holds for an unrestricted bed") {
                guards.bedRestrictionsAdmitPatient(base) shouldBe true
            }
            test("bedRestrictionsAdmitPatient fails for a known gender mismatch under a configured rule") {
                val excluded = patientOk.copy(sex = RecordedSex.Recorded(BedSamples.SEX_EXCLUDED))
                val facts = base.copy(attributes = restricted, patientPlacement = excluded)
                guards.bedRestrictionsAdmitPatient(facts) shouldBe false
            }
            test("bedRestrictionsAdmitPatient holds for an unknown sex, an uncovered sex, an alias or a restriction with no rule") {
                listOf(
                    base.copy(attributes = restricted, patientPlacement = patientOk.copy(sex = RecordedSex.NotRecorded)),
                    base.copy(attributes = restricted, patientPlacement = patientOk.copy(sex = RecordedSex.RecordedUnknown)),
                    base.copy(
                        attributes = restricted,
                        patientPlacement = patientOk.copy(sex = RecordedSex.Recorded(BedSamples.SEX_NOT_COVERED)),
                    ),
                    base.copy(
                        attributes = restricted,
                        patientPlacement = patientOk.copy(sex = RecordedSex.Recorded(BedSamples.SEX_EXCLUDED), onUnidentifiedAlias = true),
                    ),
                    base.copy(
                        attributes = restricted,
                        patientPlacement = patientOk.copy(sex = RecordedSex.Recorded(BedSamples.SEX_EXCLUDED)),
                        genderRules = emptyMap(),
                    ),
                ).forEach { facts -> guards.bedRestrictionsAdmitPatient(facts) shouldBe true }
            }
            test("bedRestrictionsAdmitPatient holds when the isolation requirement is met by capability or by a cohort declaration") {
                val capable = BedSamples.UNRESTRICTED_BED.copy(isolationCapabilities = setOf(BedSamples.ISOLATION_KIND))
                val cohort = BedSamples.UNRESTRICTED_BED.copy(activeCohortKinds = setOf(BedSamples.ISOLATION_KIND))
                guards.bedRestrictionsAdmitPatient(base.copy(patientPlacement = isolated, attributes = capable)) shouldBe true
                guards.bedRestrictionsAdmitPatient(base.copy(patientPlacement = isolated, attributes = cohort)) shouldBe true
            }
            test("bedRestrictionsAdmitPatient fails for an unmet isolation requirement, one of unknown kind, or an unknown capability") {
                guards.bedRestrictionsAdmitPatient(base.copy(patientPlacement = isolated)) shouldBe false
                guards.bedRestrictionsAdmitPatient(
                    base.copy(patientPlacement = patientOk.copy(isolation = IsolationRequirement(null))),
                ) shouldBe false
                val unknownWithCohort =
                    BedSamples.UNRESTRICTED_BED.copy(isolationCapabilities = null, activeCohortKinds = setOf(BedSamples.ISOLATION_KIND))
                guards.bedRestrictionsAdmitPatient(base.copy(patientPlacement = isolated, attributes = unknownWithCohort)) shouldBe false
            }
            test("bedRestrictionsAdmitPatient holds for an unknown capability when the patient has no isolation requirement") {
                guards.bedRestrictionsAdmitPatient(
                    base.copy(attributes = BedSamples.UNRESTRICTED_BED.copy(isolationCapabilities = null)),
                ) shouldBe true
            }
        }

        context("noActivePressureAlarm") {
            test("noActivePressureAlarm holds for an unmonitored room, a normal signal and an unknown or stale signal") {
                listOf(PressureSignal.NOT_MONITORED, PressureSignal.NORMAL, PressureSignal.UNKNOWN).forEach { signal ->
                    guards.noActivePressureAlarm(base.copy(attributes = base.attributes.copy(pressureSignal = signal))) shouldBe true
                }
            }
            test("noActivePressureAlarm fails for an active alarm") {
                guards.noActivePressureAlarm(
                    base.copy(attributes = base.attributes.copy(pressureSignal = PressureSignal.ALARM_ACTIVE)),
                ) shouldBe false
            }
        }

        context("overrideReasonChosen") {
            val alarm = base.copy(attributes = base.attributes.copy(pressureSignal = PressureSignal.ALARM_ACTIVE))
            val user = Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.USER)
            test("overrideReasonChosen holds for a user-chosen reason naming every failing restriction") {
                guards.overrideReasonChosen(alarm) shouldBe true
                guards.overrideReasonChosen(
                    alarm.copy(override = OverrideRequest(user, setOf(RestrictionKind.PRESSURE_ALARM))),
                ) shouldBe true
            }
            test("overrideReasonChosen holds whatever the bed attributes when every restriction is named") {
                val unknownKind = patientOk.copy(isolation = IsolationRequirement(null))
                val unknownEverything = base.copy(patientPlacement = unknownKind, attributes = restricted)
                guards.overrideReasonChosen(unknownEverything) shouldBe true
            }
            test("overrideReasonChosen fails for a defaulted or missing reason") {
                val defaultedReason = Chosen(OverrideReason.CLINICAL_EMERGENCY, EntrySource.DEFAULTED)
                val defaulted = OverrideRequest(defaultedReason, RestrictionKind.entries.toSet())
                guards.overrideReasonChosen(alarm.copy(override = defaulted)) shouldBe false
                guards.overrideReasonChosen(alarm.copy(override = OverrideRequest(null, RestrictionKind.entries.toSet()))) shouldBe false
                guards.overrideReasonChosen(alarm.copy(override = null)) shouldBe false
            }
            test("overrideReasonChosen fails when a failing restriction is not named or nothing is named") {
                guards.overrideReasonChosen(alarm.copy(override = OverrideRequest(user, setOf(RestrictionKind.GENDER)))) shouldBe false
                guards.overrideReasonChosen(base.copy(override = OverrideRequest(user, emptySet()))) shouldBe false
            }
        }

        context("occupantMatchesReservation") {
            test("occupantMatchesReservation holds when the placed encounter is the reserved one") {
                guards.occupantMatchesReservation(base) shouldBe true
            }
            test("occupantMatchesReservation fails for another encounter, no reservation or no encounter named") {
                guards.occupantMatchesReservation(base.copy(reservationEncounterId = OTHER)) shouldBe false
                guards.occupantMatchesReservation(base.copy(reservationEncounterId = null)) shouldBe false
                guards.occupantMatchesReservation(base.copy(commandEncounterId = null, reservationEncounterId = null)) shouldBe false
            }
        }

        context("noOverlappingOccupancy") {
            test("noOverlappingOccupancy holds when another encounter's period ended exactly at the new start (half-open)") {
                guards.noOverlappingOccupancy(base.plus(other(100, 120))) shouldBe true
            }
            test("noOverlappingOccupancy fails when another encounter's period ends one second after the new start") {
                guards.noOverlappingOccupancy(base.plus(other(100, 120).copy(end = at(120).plusSeconds(1)))) shouldBe false
            }
            test("noOverlappingOccupancy fails for another encounter's open period or one starting later") {
                guards.noOverlappingOccupancy(base.plus(other(60, null))) shouldBe false
                guards.noOverlappingOccupancy(base.plus(other(300, 400))) shouldBe false
            }
            test("noOverlappingOccupancy ignores entered-in-error periods, the encounter's own periods and other beds") {
                guards.noOverlappingOccupancy(base.plus(other(60, null, enteredInError = true))) shouldBe true
                guards.noOverlappingOccupancy(base.plus(LocationPeriod("SYN-PER-OWN", ENCOUNTER, BED, at(60), null))) shouldBe true
                guards.noOverlappingOccupancy(base.plus(other(60, null).copy(bedId = "SYN-BED-OTHER"))) shouldBe true
            }
            test("noOverlappingOccupancy fails with an unknown start or no encounter named") {
                guards.noOverlappingOccupancy(base.copy(occupancyStart = null)) shouldBe false
                guards.noOverlappingOccupancy(base.copy(commandEncounterId = null)) shouldBe false
            }
        }

        context("noOpenOccupancy") {
            test("noOpenOccupancy holds when every period on the bed is closed or entered in error") {
                guards.noOpenOccupancy(base) shouldBe true
                guards.noOpenOccupancy(base.plus(other(60, null, enteredInError = true))) shouldBe true
            }
            test("noOpenOccupancy fails for an open period, the held bed of a patient on leave included") {
                guards.noOpenOccupancy(base.plus(other(60, null))) shouldBe false
                guards.noOpenOccupancy(base.plus(LocationPeriod("SYN-PER-LEAVE", ENCOUNTER, BED, at(130), null))) shouldBe false
            }
        }

        context("requiredCleanRecorded") {
            test("requiredCleanRecorded holds when the completed clean is of the required type") {
                guards.requiredCleanRecorded(base) shouldBe true
                guards.requiredCleanRecorded(world(requiredClean = CleanType.TERMINAL)) shouldBe true
            }
            test("requiredCleanRecorded treats an unknown required type as terminal") {
                guards.requiredCleanRecorded(base.copy(cleaningJob = CleaningJob(null, CleanType.TERMINAL))) shouldBe true
                guards.requiredCleanRecorded(base.copy(cleaningJob = CleaningJob(null, CleanType.STANDARD))) shouldBe false
            }
            test("requiredCleanRecorded fails for a standard clean when terminal is required, no clean, or no job") {
                guards.requiredCleanRecorded(base.copy(cleaningJob = CleaningJob(CleanType.TERMINAL, CleanType.STANDARD))) shouldBe false
                guards.requiredCleanRecorded(base.copy(cleaningJob = CleaningJob(CleanType.STANDARD, null))) shouldBe false
                guards.requiredCleanRecorded(base.copy(cleaningJob = null)) shouldBe false
            }
        }

        context("blockReasonValid") {
            test("blockReasonValid holds for every user-chosen block reason") {
                BlockReason.entries.forEach { reason ->
                    guards.blockReasonValid(base.copy(blockReason = Chosen(reason, EntrySource.USER))) shouldBe true
                }
            }
            test("blockReasonValid fails for a defaulted or missing reason") {
                guards.blockReasonValid(base.copy(blockReason = Chosen(BlockReason.MAINTENANCE, EntrySource.DEFAULTED))) shouldBe false
                guards.blockReasonValid(base.copy(blockReason = null)) shouldBe false
            }
        }

        context("reasonEntered") {
            test("reasonEntered holds for a typed reason") {
                guards.reasonEntered(base) shouldBe true
            }
            test("reasonEntered fails for a blank, defaulted or missing reason") {
                guards.reasonEntered(base.copy(reason = Chosen(" ", EntrySource.USER))) shouldBe false
                guards.reasonEntered(base.copy(reason = Chosen("SYN reason", EntrySource.DEFAULTED))) shouldBe false
                guards.reasonEntered(base.copy(reason = null)) shouldBe false
            }
        }

        context("reservedEncounterEnded") {
            test("reservedEncounterEnded holds when the reserved encounter is discharged, finished, cancelled or entered in error") {
                listOf(
                    EncounterState.DISCHARGED_NOT_CLOSED,
                    EncounterState.FINISHED,
                    EncounterState.CANCELLED,
                    EncounterState.ENTERED_IN_ERROR,
                ).forEach { state -> guards.reservedEncounterEnded(world(reservationEncounterState = state)) shouldBe true }
            }
            test("reservedEncounterEnded fails for an open encounter, an unknown state or no reservation") {
                guards.reservedEncounterEnded(base) shouldBe false
                guards.reservedEncounterEnded(world(reservationEncounterState = EncounterState.ON_LEAVE)) shouldBe false
                guards.reservedEncounterEnded(base.copy(reservationEncounterState = null)) shouldBe false
                guards.reservedEncounterEnded(
                    world(reservationEncounterState = EncounterState.FINISHED).copy(reservationEncounterId = null),
                ) shouldBe false
            }
        }

        context("cleaningNeededOnReturn and noCleaningNeededOnReturn") {
            fun spell(
                from: BedState?,
                reasons: List<BlockReason>?,
            ) = base.copy(outOfUseSpell = OutOfUseSpell(from, reasons))
            test("noCleaningNeededOnReturn holds, cleaningNeededOnReturn fails: clean bed blocked only for staffing or only closed") {
                listOf(spell(BedState.AVAILABLE, listOf(BlockReason.STAFFING)), spell(BedState.AVAILABLE, emptyList())).forEach { facts ->
                    guards.noCleaningNeededOnReturn(facts) shouldBe true
                    guards.cleaningNeededOnReturn(facts) shouldBe false
                }
            }
            test("cleaningNeededOnReturn holds, noCleaningNeededOnReturn fails: dirty or cleaning, non-staffing block, unknowns") {
                listOf(
                    spell(BedState.DIRTY, emptyList()),
                    spell(BedState.CLEANING, listOf(BlockReason.STAFFING)),
                    spell(BedState.AVAILABLE, listOf(BlockReason.STAFFING, BlockReason.ISOLATION)),
                    spell(BedState.AVAILABLE, listOf(BlockReason.CONTAMINATION)),
                    spell(BedState.AVAILABLE, listOf(BlockReason.MAINTENANCE)),
                    spell(null, emptyList()),
                    spell(BedState.AVAILABLE, null),
                    base.copy(outOfUseSpell = null),
                ).forEach { facts ->
                    guards.cleaningNeededOnReturn(facts) shouldBe true
                    guards.noCleaningNeededOnReturn(facts) shouldBe false
                }
            }
        }

        context("privilegedAndAudited") {
            test("privilegedAndAudited holds with the privilege and an accepted audit") {
                guards.privilegedAndAudited(base) shouldBe true
            }
            test("privilegedAndAudited fails without the privilege or when the audit cannot be written") {
                listOf(Answer.NO, Answer.UNKNOWN).forEach { answer ->
                    guards.privilegedAndAudited(base.copy(commandPrivilege = answer)) shouldBe false
                    guards.privilegedAndAudited(base.copy(auditAccepted = answer)) shouldBe false
                }
            }
        }

        context("returningOccupantWasLastOccupant") {
            test("returningOccupantWasLastOccupant holds for the last occupant whose period the cancelled discharge closed") {
                guards.returningOccupantWasLastOccupant(base) shouldBe true
                guards.returningOccupantWasLastOccupant(
                    base.copy(cancelledClosure = CancelledClosure(ClosureKind.TRANSFER, OWN_PERIOD)),
                ) shouldBe true
            }
            test("returningOccupantWasLastOccupant fails when another encounter's period started at or after that end") {
                guards.returningOccupantWasLastOccupant(base.plus(other(120, 130))) shouldBe false
                guards.returningOccupantWasLastOccupant(base.plus(other(150, null))) shouldBe false
            }
            test("returningOccupantWasLastOccupant fails when another encounter's period ended later") {
                guards.returningOccupantWasLastOccupant(base.plus(other(60, 121))) shouldBe false
            }
            test("returningOccupantWasLastOccupant fails when the cancelled closure names another period, or none") {
                guards.returningOccupantWasLastOccupant(
                    base.copy(cancelledClosure = CancelledClosure(ClosureKind.DISCHARGE, "SYN-PER-OTHER")),
                ) shouldBe false
                guards.returningOccupantWasLastOccupant(base.copy(cancelledClosure = null)) shouldBe false
            }
            test("returningOccupantWasLastOccupant fails for another returning encounter or no closed period") {
                guards.returningOccupantWasLastOccupant(base.copy(commandEncounterId = OTHER)) shouldBe false
                guards.returningOccupantWasLastOccupant(base.copy(periods = emptyList())) shouldBe false
            }
            test("returningOccupantWasLastOccupant ignores entered-in-error periods") {
                guards.returningOccupantWasLastOccupant(base.plus(other(150, null, enteredInError = true))) shouldBe true
            }
        }

        context("backEnteredOccupantMatches") {
            val occupancy = requireNotNull(base.backEnteredOccupancy)
            test("backEnteredOccupantMatches holds for the open last period of a back-entry applied in the same transaction") {
                guards.backEnteredOccupantMatches(base) shouldBe true
            }
            test("backEnteredOccupantMatches fails outside the same transaction, for a bounded or non-last period, or none") {
                guards.backEnteredOccupantMatches(
                    base.copy(backEnteredOccupancy = occupancy.copy(appliedInSameTransaction = false)),
                ) shouldBe false
                guards.backEnteredOccupantMatches(base.copy(backEnteredOccupancy = occupancy.copy(end = at(180)))) shouldBe false
                guards.backEnteredOccupantMatches(base.copy(backEnteredOccupancy = occupancy.copy(lastOfBackEntry = false))) shouldBe false
                guards.backEnteredOccupantMatches(base.copy(backEnteredOccupancy = null)) shouldBe false
            }
            test("backEnteredOccupantMatches fails for another bed or another encounter") {
                guards.backEnteredOccupantMatches(base.copy(backEnteredOccupancy = occupancy.copy(bedId = "SYN-BED-OTHER"))) shouldBe false
                guards.backEnteredOccupantMatches(base.copy(commandEncounterId = OTHER)) shouldBe false
            }
        }

        context("SI-12: no bed predicate reads payment") {
            test("reservationEncounterOpen, bedRestrictionsAdmitPatient and occupantMatchesReservation ignore an unpaid deposit") {
                val unpaid = base.copy(finance = FinanceFacts(Long.MAX_VALUE, Answer.NO, PreApprovalStatus.DENIED))
                guards.reservationEncounterOpen(unpaid) shouldBe true
                guards.bedRestrictionsAdmitPatient(unpaid) shouldBe true
                guards.occupantMatchesReservation(unpaid) shouldBe true
            }
        }
    })
