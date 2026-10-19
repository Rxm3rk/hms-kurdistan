package hms.lis.domain.specimen

import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition
import hms.kernel.testing.statemachine.RunStats
import hms.kernel.testing.statemachine.SequenceConfig
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import java.time.Duration

// The specimen machine's own properties (docs/specs/state-machines/specimen.yaml and .md; WP-0.5 spec §3.3), beside the
// generic P1 to P7 of SpecimenGeneratedPropertyTest. Each check restates its rule from the facts themselves, not through
// SpecimenGuards, so a guard that drifted from its description fails here. Each check has a precise `appliesTo`, and
// each test requires the transitions it is about to have fired, so no property passes vacuously.

private typealias SpecimenStep = Step<SpecimenState, SpecimenCommand, SpecimenPredicate, SpecimenEffect, SpecimenFacts>
private typealias SpecimenCheck = StepCheck<SpecimenState, SpecimenCommand, SpecimenPredicate, SpecimenEffect, SpecimenFacts>
private typealias SpecimenTransition = Transition<SpecimenState, SpecimenCommand, SpecimenPredicate, SpecimenEffect>

private val spec = SpecimenMachine.spec

/** The index of the one transition on [command] into [to] (from [from], when several share the command and target). */
private fun index(
    command: SpecimenCommand,
    to: SpecimenState,
    from: SpecimenState? = null,
): Int =
    spec.transitions
        .single { it.on == command && it.to == to && (from == null || from in it.from) }
        .index

private val printLabels = index(SpecimenCommand.PrintLabels, SpecimenState.LABEL_PRINTED)
private val printWithOverride = index(SpecimenCommand.PrintLabelsWithIdentityOverride, SpecimenState.LABEL_PRINTED)
private val assignKit = index(SpecimenCommand.AssignKitLabels, SpecimenState.LABEL_PRINTED)
private val reprint = index(SpecimenCommand.ReprintLabels, SpecimenState.LABEL_PRINTED)
private val collect = index(SpecimenCommand.Collect, SpecimenState.COLLECTED)
private val collectWithOverride = index(SpecimenCommand.CollectWithIdentityOverride, SpecimenState.COLLECTED)
private val backEnter = index(SpecimenCommand.BackEnterDowntimeCollection, SpecimenState.IN_TRANSIT)
private val dispatch = index(SpecimenCommand.Dispatch, SpecimenState.IN_TRANSIT)
private val startAll =
    spec.transitions.single { it.on == SpecimenCommand.StartProcessing && SpecimenPredicate.ACCEPTABLE_FOR_EVERY_TEST in it.guard }.index
private val startPartial =
    spec.transitions.single { it.on == SpecimenCommand.StartProcessing && SpecimenPredicate.ACCEPTABLE_FOR_SOME_TEST in it.guard }.index
private val acceptWithCaveat = index(SpecimenCommand.AcceptWithCaveat, SpecimenState.IN_PROCESS)
private val resultedWithRecollection =
    spec.transitions.single { it.on == SpecimenCommand.MarkResulted && SpecimenPredicate.TEST_NEEDS_RECOLLECTION in it.guard }.index
private val disposeResulted = index(SpecimenCommand.Dispose, SpecimenState.DISPOSED, SpecimenState.RESULTED)
private val disposeStored = index(SpecimenCommand.Dispose, SpecimenState.DISPOSED, SpecimenState.STORED)
private val reject = index(SpecimenCommand.Reject, SpecimenState.REJECTED, SpecimenState.RECEIVED)
private val rejectInTransit = index(SpecimenCommand.Reject, SpecimenState.REJECTED, SpecimenState.IN_TRANSIT)
private val cancelBeforeDraw = index(SpecimenCommand.Cancel, SpecimenState.CANCELLED, SpecimenState.ORDERED)
private val cancelAfterDraw = index(SpecimenCommand.Cancel, SpecimenState.CANCELLED, SpecimenState.COLLECTED)
private val reportLost = index(SpecimenCommand.ReportLost, SpecimenState.LOST, SpecimenState.COLLECTED)
private val reportLostStored = index(SpecimenCommand.ReportLost, SpecimenState.LOST, SpecimenState.STORED)
private val enteredInError = index(SpecimenCommand.MarkEnteredInError, SpecimenState.ENTERED_IN_ERROR)

/** The transitions that act on the patient's identity: printing, binding kit labels, collecting. */
private val wristbandPath = setOf(printLabels, assignKit, collect)
private val overridePath = setOf(printWithOverride, collectWithOverride)
private val identifying = wristbandPath + overridePath

/** The transition the step fired, if it fired one. */
private val SpecimenStep.fired: SpecimenTransition? get() = (outcome as? Outcome.Fired)?.transition

private fun SpecimenStep.firedAny(indexes: Set<Int>): Boolean = fired?.index?.let { it in indexes } ?: false

private fun SpecimenStep.firedInto(state: SpecimenState): Boolean = fired?.to == state

/** A check named [name], applied to the steps for which [appliesTo] holds. */
private fun stepCheck(
    name: String,
    appliesTo: (SpecimenStep) -> Boolean,
    check: (SpecimenStep) -> Unit,
): SpecimenCheck = StepCheck(name, appliesTo, check)

/** Runs [checks] over the property budget and, at the coverage budget, requires [transitions] to have fired. */
private fun runChecks(
    name: String,
    checks: List<SpecimenCheck>,
    vararg transitions: Int,
): RunStats {
    val config = SequenceConfig()
    val stats =
        runSequences(
            name = name,
            spec = spec,
            holds = { predicate, facts -> SpecimenMachine.holds(predicate, SpecimenGuards, facts) },
            facts = SpecimenArbs.facts,
            config = config,
            checks = checks,
        )
    stats.ambiguous shouldBe 0L
    if (config.budget >= config.coverageFromBudget) stats.requireFired(*transitions)
    return stats
}

// --- Independent restatements of the rules, from the facts ------------------------------------------------------------

private val SpecimenFacts.servedTests: List<ServedTest> get() = servedOrders.flatMap { it.tests }

private fun SpecimenFacts.mrnValidAndCurrent(): Boolean =
    patient.mrnIdentity.checkDigitValid == true && patient.mrnIdentity.status == MrnStatus.CURRENT

/** The session's last wristband read is a scanned patient wristband of this patient, confirmed. */
private fun SpecimenFacts.matchingWristband(): Boolean {
    val scan = session?.wristbandScans?.lastOrNull() ?: return false
    return scan.entry == EntryMethod.SCANNED &&
        scan.source == IdentifierSource.PATIENT_WRISTBAND &&
        scan.decodedMrn == patient.mrn &&
        scan.confirmation?.confirmedByUser == true &&
        mrnValidAndCurrent()
}

/** No band decoded in the session, a chosen override reason, and an active two-identifier check that is not a location. */
private fun SpecimenFacts.reportableOverride(): Boolean {
    val current = session ?: return false
    val check = current.twoIdentifierCheck
    return current.wristbandScans.none { it.decodedMrn != null } &&
        overrideReason?.chosenByUser == true &&
        check != null &&
        check.method != TwoIdentifierMethod.ROOM_BED_OR_LOCATION &&
        mrnValidAndCurrent()
}

/** The source of the session's last wristband read, if any. */
private fun SpecimenFacts.lastBandSource(): IdentifierSource? = session?.wristbandScans?.lastOrNull()?.source

/** Some band in the session decoded an MRN other than the specimen patient's. */
private fun SpecimenFacts.anotherPatientsBand(): Boolean =
    session?.wristbandScans.orEmpty().any { it.decodedMrn != null && it.decodedMrn != patient.mrn }

/** The tube label of this specimen was scanned in the session, on the device that identified the patient, after that. */
private fun SpecimenFacts.labelScannedAfterIdentification(): Boolean {
    val band = session?.wristbandScans?.firstOrNull { it.decodedMrn != null }
    val check = session?.twoIdentifierCheck
    val identified =
        when {
            band != null -> band.at to band.deviceId
            check != null -> check.at to check.deviceId
            else -> null
        }
    return identified != null &&
        accession != null &&
        session?.labelScans.orEmpty().any {
            it.entry == EntryMethod.SCANNED &&
                it.accession == accession &&
                it.deviceId == identified.second &&
                it.at.isAfter(identified.first)
        }
}

private fun SpecimenFacts.everyTestNotForTransfusion(): Boolean =
    servedTests.isNotEmpty() && servedTests.all { it.preTransfusionSample == false }

class SpecimenPropertyTest :
    FunSpec({
        test("SI-01 (specimen): collected only with a matching wristband or the reported identity override, label scanned at the bedside") {
            runChecks(
                "SI-01 (specimen): two identifiers on every patient-affecting command",
                listOf(
                    stepCheck(
                        "a collection had a matching wristband or a reportable override, never both and never neither",
                        appliesTo = { it.firedAny(setOf(collect, collectWithOverride)) },
                    ) { step ->
                        val facts = step.facts
                        withClue("wristband ${facts.matchingWristband()}, override ${facts.reportableOverride()}") {
                            (facts.matchingWristband() != facts.reportableOverride()) shouldBe true
                        }
                        facts.labelScannedAfterIdentification() shouldBe true
                        facts.collector?.userId shouldBe facts.authenticatedUserId
                        facts.collector?.entry shouldBe CollectorEntry.SESSION_USER
                    },
                    stepCheck(
                        "the wristband path used a matching wristband; the override path a reportable override",
                        appliesTo = { it.firedAny(identifying) },
                    ) { step ->
                        if (step.firedAny(wristbandPath)) step.facts.matchingWristband() shouldBe true
                        if (step.firedAny(overridePath)) {
                            step.facts.reportableOverride() shouldBe true
                            step.fired?.effects.orEmpty() shouldContain SpecimenEffect.IDENTITY_OVERRIDE_REPORTED
                        }
                    },
                    stepCheck(
                        "a band decoded to another patient is a hard stop: no identifying transition fires",
                        appliesTo = { it.facts.anotherPatientsBand() },
                    ) { step -> step.firedAny(identifying) shouldBe false },
                    stepCheck(
                        "a room, bed or location never identifies the patient",
                        appliesTo = {
                            it.facts.lastBandSource().let { source -> source != null && source != IdentifierSource.PATIENT_WRISTBAND } ||
                                it.facts.session
                                    ?.twoIdentifierCheck
                                    ?.method == TwoIdentifierMethod.ROOM_BED_OR_LOCATION
                        },
                    ) { step ->
                        if (step.firedAny(wristbandPath)) step.facts.matchingWristband() shouldBe true
                        if (step.firedAny(overridePath)) step.facts.reportableOverride() shouldBe true
                    },
                    stepCheck(
                        "labels carry both identifiers of this patient and never a room or bed",
                        appliesTo = { it.firedAny(setOf(printLabels, printWithOverride, assignKit, reprint)) },
                    ) { step ->
                        val facts = step.facts
                        val label = facts.labelContent
                        withClue("label $label for ${facts.patient}") {
                            label?.nameInScript shouldBe facts.patient.nameInScript
                            label?.nameLatin shouldBe facts.patient.nameLatin
                            label?.mrn shouldBe facts.patient.mrn
                            label?.roomOrBedInIdentifierSlot shouldBe false
                            label?.accession shouldBe facts.accession
                            val approximate = facts.patient.dateOfBirthApproximate && label?.approximateDobFlag == true
                            (label?.dateOfBirth == facts.patient.dateOfBirth || approximate) shouldBe
                                true
                        }
                    },
                ),
                printLabels,
                printWithOverride,
                assignKit,
                reprint,
                collect,
                collectWithOverride,
            )
        }

        test("SI-11 (specimen): the identity override never applies to a pre-transfusion sample or an unknown flag") {
            runChecks(
                "SI-11 (specimen): no identity override for a pre-transfusion sample",
                listOf(
                    stepCheck(
                        "an override fired only when every served test is known not to be a transfusion sample",
                        appliesTo = { it.firedAny(overridePath) },
                    ) { step ->
                        step.facts.everyTestNotForTransfusion() shouldBe true
                    },
                    stepCheck(
                        "a possible transfusion sample never takes the override",
                        appliesTo = { !it.facts.everyTestNotForTransfusion() },
                    ) { step ->
                        step.firedAny(overridePath) shouldBe false
                    },
                ),
                printWithOverride,
                collectWithOverride,
            )
        }

        test("SI-15 (specimen): accession numbers come from the cell online and only from the device's pre-allocated block offline") {
            runChecks(
                "SI-15 (specimen): identifiers only from pre-allocated blocks offline",
                listOf(
                    stepCheck(
                        "an offline print used an unused number in this device's site-prefixed block",
                        appliesTo = { step ->
                            step.firedAny(setOf(printLabels, printWithOverride)) && step.facts.commandMode?.offline == true
                        },
                    ) { step ->
                        val facts = step.facts
                        val number = facts.accession
                        withClue("accession $number on ${facts.commandDeviceId}") {
                            (number != null && number !in facts.usedAccessionNumbers) shouldBe true
                            facts.downtimeBlocks.any {
                                it.assignedTo == facts.commandDeviceId &&
                                    it.sitePrefix == facts.siteAccessionPrefix &&
                                    number != null &&
                                    it.contains(number)
                            } shouldBe true
                        }
                    },
                    stepCheck(
                        "an online print (losing only the internet is online) used a number the cell issued",
                        appliesTo = { step ->
                            step.firedAny(setOf(printLabels, printWithOverride)) && step.facts.commandMode?.offline == false
                        },
                    ) { step -> step.facts.accessionIssuedByCellService shouldBe true },
                    stepCheck(
                        "a print in an unknown mode never fires",
                        appliesTo = { it.facts.commandMode == null },
                    ) { step ->
                        step.firedAny(setOf(printLabels, printWithOverride)) shouldBe false
                    },
                ),
                printLabels,
                printWithOverride,
            )
        }

        test("SI-10 (specimen): clinical collection time is distinct from and never later than the recording time; back-entry keeps it") {
            runChecks(
                "SI-10 (specimen): back-entry keeps clinical time and label",
                listOf(
                    stepCheck(
                        "a bedside collection's clinical time lies in the session, confirmed, not after the recording time",
                        appliesTo = { step ->
                            step.firedAny(setOf(collect, collectWithOverride))
                        },
                    ) { step ->
                        val facts = step.facts
                        val time = facts.collectionTime
                        withClue("collection time $time at ${facts.now}") {
                            time?.confirmedByCollector shouldBe true
                            (time != null && !time.clinical.isAfter(facts.now)) shouldBe true
                        }
                    },
                    stepCheck(
                        "a back-entry keeps the paper time as clinical time, labelled, privileged, audited, inside an episode",
                        appliesTo = { step ->
                            step.firedAny(setOf(backEnter))
                        },
                    ) { step ->
                        val facts = step.facts
                        val paper = facts.paperCollection
                        val clinical = paper?.clinicalTime
                        withClue("paper $paper") {
                            (clinical != null && clinical == paper?.paperTime && !clinical.isAfter(facts.now)) shouldBe true
                            paper?.labelledAsBackEntry shouldBe true
                            facts.downtimeEpisodes.any { clinical != null && it.covers(clinical) } shouldBe true
                            facts.privileges shouldContain SpecimenPrivilege.DOWNTIME_BACK_ENTRY_LAB_COLLECTION
                            facts.auditWritable shouldBe true
                            facts.backEntryLabel?.scan?.entry shouldBe EntryMethod.SCANNED
                        }
                    },
                ),
                collect,
                collectWithOverride,
                backEnter,
            )
        }

        test("SI-03 (specimen): every rejection, loss and unusable test raises an owned task; a drawn specimen is watched in transport") {
            runChecks(
                "SI-03 (specimen): every order reaches a terminal state",
                listOf(
                    stepCheck(
                        "a rejection, or a loss before storage, raises a recollection task",
                        appliesTo = { step ->
                            step.firedInto(SpecimenState.REJECTED) ||
                                (step.firedInto(SpecimenState.LOST) && step.from != SpecimenState.STORED)
                        },
                    ) { step -> step.fired?.effects.orEmpty() shouldContain SpecimenEffect.RECOLLECTION_TASK_RAISED },
                    stepCheck(
                        "a loss from storage raises a quality incident",
                        appliesTo = { it.firedAny(setOf(reportLostStored)) },
                    ) { step ->
                        step.fired?.effects.orEmpty() shouldContain SpecimenEffect.STORED_LOSS_INCIDENT_RAISED
                    },
                    stepCheck(
                        "partial acceptance rejects the failed tests with a recollection; a cancelled result raises one",
                        appliesTo = { step ->
                            step.firedAny(setOf(startPartial, resultedWithRecollection))
                        },
                    ) { step ->
                        val effects = step.fired?.effects.orEmpty()
                        if (step.firedAny(setOf(startPartial))) {
                            effects shouldContainAll
                                listOf(SpecimenEffect.UNACCEPTABLE_TESTS_REJECTED, SpecimenEffect.EMIT_SPECIMEN_REJECTED)
                        } else {
                            effects shouldContain SpecimenEffect.RECOLLECTION_TASK_RAISED
                        }
                    },
                    stepCheck(
                        "a collection, back-entry or dispatch starts the transport watch",
                        appliesTo = { step ->
                            step.firedAny(setOf(collect, collectWithOverride, backEnter, dispatch))
                        },
                    ) { step -> step.fired?.effects.orEmpty() shouldContain SpecimenEffect.TRANSPORT_OVERDUE_WATCH },
                    stepCheck(
                        "a cancel fires only when every served order is revoked, in error, or completed without this specimen",
                        appliesTo = { step ->
                            step.firedInto(SpecimenState.CANCELLED)
                        },
                    ) { step ->
                        val orders = step.facts.servedOrders
                        orders.isNotEmpty() shouldBe true
                        orders.all {
                            it.state == OrderState.REVOKED ||
                                it.state == OrderState.ENTERED_IN_ERROR ||
                                (it.state == OrderState.COMPLETED && it.resultDerivedFromThisSpecimen == false)
                        } shouldBe true
                    },
                    stepCheck(
                        "a rejection from in-transit is only for an unlabelled or mislabelled tube",
                        appliesTo = { it.firedAny(setOf(rejectInTransit)) },
                    ) { step ->
                        step.facts.rejectionReason
                            ?.value
                            ?.labelDefect shouldBe true
                    },
                ),
                reject,
                rejectInTransit,
                reportLost,
                reportLostStored,
                startPartial,
                resultedWithRecollection,
                cancelBeforeDraw,
                cancelAfterDraw,
                dispatch,
            )
        }

        test("H3 (specimen): processing starts only after a matched receipt and a recorded check; a caveat never waives the label") {
            runChecks(
                "H3 (specimen): acceptability before processing",
                listOf(
                    stepCheck(
                        "processing starts after a scanned, matching receipt label and a check recorded at or after it",
                        appliesTo = { step ->
                            step.firedInto(SpecimenState.IN_PROCESS)
                        },
                    ) { step ->
                        val facts = step.facts
                        val receipt = facts.receiptScan
                        val checked = facts.acceptabilityCheck
                        withClue("receipt $receipt, check $checked") {
                            receipt?.entry shouldBe EntryMethod.SCANNED
                            (receipt?.accession != null && receipt.accession == facts.accession) shouldBe true
                            (receipt != null && checked != null && !checked.at.isBefore(receipt.at)) shouldBe true
                        }
                    },
                    stepCheck(
                        "an accepted caveat is privileged, audited, chosen, and carried on every result",
                        appliesTo = { it.firedAny(setOf(acceptWithCaveat)) },
                    ) { step ->
                        val facts = step.facts
                        facts.privileges shouldContain SpecimenPrivilege.ACCEPT_WITH_CAVEAT
                        facts.auditWritable shouldBe true
                        facts.caveatReason?.chosenByUser shouldBe true
                        step.fired?.effects.orEmpty() shouldContain SpecimenEffect.CAVEAT_CARRIED_ON_RESULTS
                    },
                    stepCheck(
                        "a stability limit is measured from the clinical collection time",
                        appliesTo = { step ->
                            step.firedAny(setOf(startAll))
                        },
                    ) { step ->
                        val facts = step.facts
                        val clinical = facts.collectionTime?.clinical
                        facts.servedOrders
                            .filter { it.state != OrderState.REVOKED && it.state != OrderState.ENTERED_IN_ERROR }
                            .flatMap { it.tests }
                            .forEach { test ->
                                val limit = test.limits.stabilityLimit
                                withClue("test ${test.testCode}: collected $clinical, limit $limit, now ${facts.now}") {
                                    (clinical != null && limit != null && Duration.between(clinical, facts.now) <= limit) shouldBe true
                                }
                            }
                    },
                ),
                startAll,
                startPartial,
                acceptWithCaveat,
            )
        }

        test("SI-21 (specimen): never disposed under a legal hold, an unknown hold, or before retention ends (§13 DP-9)") {
            runChecks(
                "SI-21 (specimen): disposal respects retention and legal hold",
                listOf(
                    stepCheck(
                        "a disposal had no hold of either kind, both known",
                        appliesTo = { it.firedInto(SpecimenState.DISPOSED) },
                    ) { step ->
                        step.facts.retentionEngineHold shouldBe false
                        step.facts.forensicMlcHold shouldBe false
                    },
                    stepCheck(
                        "a held or unknown-hold specimen is never disposed",
                        appliesTo = { step ->
                            step.facts.retentionEngineHold != false || step.facts.forensicMlcHold != false
                        },
                    ) { step -> step.firedInto(SpecimenState.DISPOSED) shouldBe false },
                    stepCheck(
                        "a direct disposal needs no retention on any test; a stored one needs its period elapsed",
                        appliesTo = { step ->
                            step.firedInto(SpecimenState.DISPOSED)
                        },
                    ) { step ->
                        val facts = step.facts
                        val tests = facts.servedTests
                        tests.isNotEmpty() shouldBe true
                        if (step.firedAny(setOf(disposeResulted))) {
                            tests.all { it.retention == RetentionRule.NoneSet } shouldBe true
                        } else {
                            val stored = facts.storedAt
                            val periods = tests.map { it.retention }
                            periods.none { it == null } shouldBe true
                            val longest = periods.filterIsInstance<RetentionRule.Period>().maxOfOrNull { it.duration } ?: Duration.ZERO
                            (stored != null && !facts.now.isBefore(stored.plus(longest))) shouldBe true
                        }
                    },
                ),
                disposeResulted,
                disposeStored,
            )
        }

        test("H6 (specimen): entered in error only with the privilege and a writable audit; derived results flagged, never deleted") {
            runChecks(
                "H6 (specimen): entered-in-error replaces delete",
                listOf(
                    stepCheck(
                        "entered in error is privileged, audited, with a governed chosen reason, and flags derived results",
                        appliesTo = { step ->
                            step.firedAny(setOf(enteredInError))
                        },
                    ) { step ->
                        val facts = step.facts
                        facts.privileges shouldContain SpecimenPrivilege.SPECIMEN_ENTERED_IN_ERROR
                        facts.auditWritable shouldBe true
                        facts.errorReason?.chosenByUser shouldBe true
                        (facts.errorReason?.value in facts.governedErrorReasons.orEmpty()) shouldBe true
                        step.fired?.effects.orEmpty() shouldContainAll
                            listOf(SpecimenEffect.ERROR_REVIEW_TASK_RAISED, SpecimenEffect.DERIVED_RESULTS_FLAGGED)
                    },
                    stepCheck(
                        "a terminal specimen leaves its state only by entered in error",
                        appliesTo = { it.from in spec.terminal && it.fired != null },
                    ) { step ->
                        step.fired?.index shouldBe enteredInError
                    },
                ),
                enteredInError,
            )
        }

        test("SI-01 (specimen): every override, reprint, rejection, caveat and error reason was chosen by the user, never defaulted") {
            runChecks(
                "SI-01 (specimen): reasons never defaulted",
                listOf(
                    stepCheck(
                        "every reason a fired guard read was chosen by the user",
                        appliesTo = { step ->
                            step.fired
                                ?.guard
                                .orEmpty()
                                .any { it in reasonPredicates }
                        },
                    ) { step ->
                        val facts = step.facts
                        val guard = step.fired?.guard.orEmpty()
                        if (SpecimenPredicate.IDENTITY_OVERRIDE_REASON_CHOSEN in guard) facts.overrideReason?.chosenByUser shouldBe true
                        if (SpecimenPredicate.REPRINT_REASON_CHOSEN in guard) facts.reprint?.reason?.chosenByUser shouldBe true
                        if (SpecimenPredicate.REJECTION_REASON_CHOSEN in guard || SpecimenPredicate.LABEL_DEFECT_REASON_CHOSEN in guard) {
                            facts.rejectionReason?.chosenByUser shouldBe true
                        }
                        if (SpecimenPredicate.CAVEAT_REASON_CHOSEN in guard) facts.caveatReason?.chosenByUser shouldBe true
                        if (SpecimenPredicate.ERROR_REASON_ENTERED in guard) facts.errorReason?.chosenByUser shouldBe true
                    },
                ),
                printWithOverride,
                reprint,
                reject,
                acceptWithCaveat,
                enteredInError,
            )
        }
    })

/** The predicates that read a reason the user must have chosen. */
private val reasonPredicates: Set<SpecimenPredicate> =
    setOf(
        SpecimenPredicate.IDENTITY_OVERRIDE_REASON_CHOSEN,
        SpecimenPredicate.REPRINT_REASON_CHOSEN,
        SpecimenPredicate.REJECTION_REASON_CHOSEN,
        SpecimenPredicate.LABEL_DEFECT_REASON_CHOSEN,
        SpecimenPredicate.CAVEAT_REASON_CHOSEN,
        SpecimenPredicate.ERROR_REASON_ENTERED,
    )
