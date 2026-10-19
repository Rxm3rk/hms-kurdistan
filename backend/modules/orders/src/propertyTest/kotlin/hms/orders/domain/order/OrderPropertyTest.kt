package hms.orders.domain.order

import hms.kernel.statemachine.Outcome
import hms.kernel.testing.statemachine.RunStats
import hms.kernel.testing.statemachine.SequenceConfig
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.time.Duration
import java.time.Instant

// Machine-level properties of the order machine (docs/specs/state-machines/order.yaml; WP-0.5 spec §3.3; hazards H2 and
// H5 through HAZ-0002, HAZ-0003, HAZ-0005, HAZ-0007, HAZ-0012, HAZ-0014, HAZ-0015, HAZ-0016). Each test runs random
// command sequences at the property budget (PropertyTestBudget, through SequenceConfig) with StepChecks, and asserts
// with requireFired that the transitions the property is about actually fired. Specification layer only: the order
// aggregate does not exist yet (KA-062). Synthetic facts only (OrderArbs; NOT FOR CLINICAL USE).

private typealias OrderStep = Step<OrderState, OrderCommand, OrderPredicate, OrderEffect, OrderFacts>
private typealias OrderCheck = StepCheck<OrderState, OrderCommand, OrderPredicate, OrderEffect, OrderFacts>
private typealias OrderOutcome = Outcome<OrderState, OrderCommand, OrderPredicate, OrderEffect>

// Transition indexes in order.yaml's transitions list (0-based), named for the properties that need them.
private const val SIGN_MEDICATION = 0
private const val SIGN_OTHER = 1
private const val DISCARD = 2
private const val DRAFT_REVIEW = 3
private const val VERIFY = 4
private const val VERIFY_MISMATCH = 5
private const val RETURN = 6
private const val RESUBMIT = 7
private const val HOLD_ACTIVE = 8
private const val HOLD_PENDING = 9
private const val HOLD_REVIEW = 10
private const val RESUME_ACTIVE = 11
private const val RESUME_PENDING = 12
private const val COMPLETE = 13
private const val DISCONTINUE_ACTIVE = 14
private const val DISCONTINUE_OTHER = 15
private const val DISCONTINUE_REPLACED = 16
private const val ERROR_ACTIVE = 17
private const val ERROR_OPEN = 18
private const val ERROR_TERMINAL = 19

private val SIGNED_OPEN = setOf(OrderState.PENDING_VERIFICATION, OrderState.ACTIVE, OrderState.ON_HOLD)
private val STOPS = setOf(OrderCommand.Hold, OrderCommand.Discontinue)
private val START_THERAPY = setOf(SIGN_MEDICATION, SIGN_OTHER, VERIFY, RESUBMIT, RESUME_ACTIVE, RESUME_PENDING)
private val CORRECTIONS = setOf(ERROR_ACTIVE, ERROR_OPEN, ERROR_TERMINAL)
private val SIGN_OR_VERIFY = setOf(SIGN_MEDICATION, SIGN_OTHER, VERIFY)
private val ONLINE = setOf(ConnectivityMode.ONLINE, ConnectivityMode.INTERNET_LOST, ConnectivityMode.WAN_LOST)
private val OFFLINE = ConnectivityMode.entries - ONLINE
private const val MINIMUM_WINDOW_MILLIS = 60_000L
private val MINIMUM_WINDOW: Duration = Duration.ofMillis(MINIMUM_WINDOW_MILLIS)

/** The facts a KB that cannot answer leaves (outage, no reference, another unit, too late, not covered). */
private val UNUSABLE_KB: List<KbDoseCheck> =
    listOf(
        KbDoseCheck(true, null),
        KbDoseCheck(true, KbAnswer(null, true, tierAHardStopFired = true)),
        KbDoseCheck(true, KbAnswer(OrderSamples.OTHER_UNIT, true, tierAHardStopFired = true)),
        KbDoseCheck(true, KbAnswer(OrderSamples.UNIT, false, tierAHardStopFired = true)),
        KbDoseCheck(false, KbAnswer(OrderSamples.UNIT, true, tierAHardStopFired = true)),
    )

private fun fire(
    state: OrderState,
    command: OrderCommand,
    facts: OrderFacts,
): OrderOutcome = OrderMachine.fire(state, command, OrderGuards, facts)

private fun OrderOutcome.firedIndex(): Int? = if (this is Outcome.Fired) transition.index else null

private fun OrderStep.fired(): Int? = outcome.firedIndex()

private fun check(
    name: String,
    appliesTo: (OrderStep) -> Boolean,
    check: (OrderStep) -> Unit,
): OrderCheck = StepCheck(name, appliesTo, check)

private fun run(
    name: String,
    vararg checks: OrderCheck,
): RunStats =
    runSequences(
        name = name,
        spec = OrderMachine.spec,
        holds = { predicate, facts -> OrderMachine.holds(predicate, OrderGuards, facts) },
        facts = OrderArbs.facts,
        config = SequenceConfig(),
        checks = checks.toList(),
    )

/** A worst case for a stop: unknown context change, offline, expired licence, no stop configuration, no reason list. */
private fun worstCaseForAStop(
    facts: OrderFacts,
    issuer: Actor,
): OrderFacts =
    facts.copy(
        issuer = issuer.copy(licences = issuer.licences.map { it.copy(expiresAt = facts.serverTime) }),
        identity = IdentityContext(null, null, emptyList()),
        issuedInMode = ConnectivityMode.MOBILE_OFFLINE,
        reason = GivenReason(OrderGuards.OTHER_REASON, "SYN free text", chosenByUser = true),
        configuration =
            facts.configuration.copy(
                holdPrivilege = null,
                discontinuePrivilege = null,
                holdReasons = emptySet(),
                discontinueReasons = emptySet(),
                commandRequirement = null,
            ),
    )

/** SI-16 restated independently of OrderGuards: within the window, the issuer confirmed after the change (DN-026, DN-027). */
private fun issuerConfirmedIfRecentChange(facts: OrderFacts): Boolean {
    val change = facts.identity.lastChangeAt
    val window = maxOf(facts.identity.tenantWindow ?: MINIMUM_WINDOW, MINIMUM_WINDOW)
    val elapsed = change?.let { Duration.between(it, facts.serverTime) }
    val recent = elapsed == null || elapsed.isNegative || elapsed <= window
    val confirmations =
        facts.identity.answers.filter { answer ->
            answer.outcome == ReverificationOutcome.CONFIRMED &&
                answer.userId != null &&
                answer.userId == facts.issuer.userId &&
                if (change == null) answer.forThisCommand else answer.recordedAt?.isAfter(change) == true
        }
    return !recent || confirmations.isNotEmpty()
}

/** Control set A restated independently of OrderGuards (§10.3 A.1; §2.1 clause b): the latest calculation is exact. */
private fun controlSetAMet(facts: OrderFacts): Boolean {
    val order = facts.order
    val weightOrArea = order.doseBasis == DoseBasis.PER_BODY_WEIGHT || order.doseBasis == DoseBasis.PER_BODY_SURFACE_AREA
    val highAlertInfusion = order.infusion && order.formulary?.highAlert != false
    val applies = order.kind == OrderKind.MEDICATION && (weightOrArea || highAlertInfusion || facts.patient.neonatal != false)
    val submitted: Instant? = order.lastSubmittedAt
    // The latest by recording time; among equal times the later in the list (OrderGuards' documented tie rule).
    val latest =
        facts.calculations
            .filter { submitted == null || it.recordedAt.isAfter(submitted) }
            .sortedBy { it.recordedAt }
            .lastOrNull()
    return if (latest == null) !applies else exactlyAsOrdered(latest, facts)
}

/** The calculation is the verifier's, attested, and equal to the prescriber-entered dose in every bound and the unit. */
private fun exactlyAsOrdered(
    calculation: IndependentDose,
    facts: OrderFacts,
): Boolean {
    val ordered = facts.order.orderedDose ?: return false
    val dose = calculation.dose
    val upper = dose.upper
    val upperEqual = if (upper == null) ordered.upper == null else ordered.upper?.compareTo(upper) == 0
    return calculation.attestedMatches &&
        calculation.recordedBy == facts.issuer.userId &&
        dose.unit == ordered.unit &&
        dose.lower.compareTo(ordered.lower) == 0 &&
        upperEqual
}

class OrderPropertyTest :
    FunSpec({
        test("H5 (order): no stop is ever refused for a missing re-verification, privilege configuration, licence, mode or reason list") {
            val stats =
                run(
                    "order H5 stops never refused for missing configuration",
                    check(
                        "a Hold or Discontinue decides the same whatever the SI-16 facts, the licence expiry and the mode",
                        { it.command in STOPS && it.from in SIGNED_OPEN },
                    ) { step ->
                        val f = step.facts
                        val variants =
                            listOf(
                                f.copy(identity = IdentityContext(f.serverTime, null, emptyList())),
                                f.copy(identity = IdentityContext(null, null, emptyList())),
                                f.copy(issuer = f.issuer.copy(licences = f.issuer.licences.map { it.copy(expiresAt = f.serverTime) })),
                                f.copy(issuer = f.issuer.copy(licences = emptyList())),
                            ) + (OFFLINE + listOf(null)).map { f.copy(issuedInMode = it) }
                        variants.forEach { variant -> fire(step.from, step.command, variant) shouldBe step.outcome }
                    },
                    check(
                        "a return to the prescriber decides the same whatever the SI-16 facts and the mode",
                        {
                            it.command == OrderCommand.ReturnToPrescriber ||
                                (it.command == OrderCommand.Verify && it.fired() == VERIFY_MISMATCH)
                        },
                    ) { step ->
                        val f = step.facts
                        listOf(
                            f.copy(identity = IdentityContext(f.serverTime, null, emptyList())),
                            f.copy(identity = IdentityContext(null, null, emptyList())),
                            f.copy(issuedInMode = null),
                            f.copy(issuedInMode = ConnectivityMode.MOBILE_OFFLINE),
                        ).forEach { variant -> fire(step.from, step.command, variant).firedIndex() shouldBe step.fired() }
                    },
                    check(
                        "with no stop configuration, a care-team prescriber always discontinues and a pharmacist always holds",
                        { it.from in SIGNED_OPEN },
                    ) { step ->
                        val baseline = OrderSamples.clinician().copy(privileges = emptySet())
                        val prescriber = worstCaseForAStop(step.facts, baseline.copy(roles = setOf(StaffRole.PRESCRIBER)))
                        fire(step.from, OrderCommand.Discontinue, prescriber).state shouldBe OrderState.REVOKED
                        if (step.from != OrderState.ON_HOLD) {
                            val pharmacist =
                                worstCaseForAStop(step.facts, baseline.copy(roles = setOf(StaffRole.PHARMACIST), onPatientCareTeam = false))
                            fire(step.from, OrderCommand.Hold, pharmacist).state shouldBe OrderState.ON_HOLD
                            fire(step.from, OrderCommand.Hold, prescriber).state shouldBe OrderState.ON_HOLD
                        }
                    },
                    check(
                        "a registered system principal's stop fires under its own audited identity",
                        {
                            it.fired() in setOf(HOLD_ACTIVE, HOLD_PENDING, DISCONTINUE_ACTIVE, DISCONTINUE_OTHER) &&
                                it.facts.issuer.kind == PrincipalKind.SYSTEM
                        },
                    ) { step ->
                        step.facts.issuer.authenticatedForThisCommand shouldBe true
                        step.facts.issuer.registrations
                            .isNotEmpty() shouldBe true
                    },
                )
            stats.requireFired(
                HOLD_ACTIVE,
                HOLD_PENDING,
                DISCONTINUE_ACTIVE,
                DISCONTINUE_OTHER,
                DISCONTINUE_REPLACED,
                RETURN,
                VERIFY_MISMATCH,
            )
        }

        test("H5 (order): no stop or return guard reads re-verification, connectivity, a licence or a start-therapy privilege") {
            val neverOnAStop =
                setOf(
                    OrderPredicate.IDENTITY_REVERIFICATION_SATISFIED,
                    OrderPredicate.NOT_OFFLINE_WITHOUT_FULL_CDS,
                    OrderPredicate.ACTOR_PRIVILEGED,
                    OrderPredicate.ORDERER_PRIVILEGED,
                    OrderPredicate.VERIFIER_IS_PHARMACIST,
                    OrderPredicate.PRIVILEGED_AND_AUDITED,
                )
            OrderMachine.spec.transitions.filter { it.on in STOPS }.forEach { transition ->
                withClue("transition ${transition.index}") { transition.guard.filter { it in neverOnAStop }.shouldBeEmpty() }
            }
            listOf(VERIFY_MISMATCH, RETURN).map { OrderMachine.spec.transitions[it] }.forEach { transition ->
                transition.guard shouldNotContain OrderPredicate.IDENTITY_REVERIFICATION_SATISFIED
                transition.guard shouldNotContain OrderPredicate.NOT_OFFLINE_WITHOUT_FULL_CDS
                transition.effects shouldContain OrderEffect.FLAG_IF_IDENTITY_NOT_REVERIFIED
            }
            (START_THERAPY + CORRECTIONS).map { OrderMachine.spec.transitions[it] }.forEach { transition ->
                withClue(
                    "transition ${transition.index}",
                ) { transition.guard shouldContain OrderPredicate.IDENTITY_REVERIFICATION_SATISFIED }
            }
        }

        test(
            "SI-05 (order): before-dose-engine-kb-10x-hard-stop-or-pharmacist-review: a KB that cannot answer never blocks Sign or Verify",
        ) {
            val stats =
                run(
                    "order SI-05 KB outage never blocks Sign or Verify",
                    check(
                        "a Sign or Verify decides the same with any unusable KB answer as with a KB that answered and did not fire",
                        {
                            (it.command == OrderCommand.Sign && it.from == OrderState.DRAFT) ||
                                (it.command == OrderCommand.Verify && it.from == OrderState.PENDING_VERIFICATION)
                        },
                    ) { step ->
                        val answered = step.facts.copy(cds = step.facts.cds.copy(kbDoseCheck = KbDoseCheck(false, null)))
                        val reference = fire(step.from, step.command, answered)
                        UNUSABLE_KB.forEach { kb ->
                            val outage = step.facts.copy(cds = step.facts.cds.copy(kbDoseCheck = kb))
                            fire(step.from, step.command, outage) shouldBe reference
                        }
                    },
                    check(
                        "a KB Tier A hard stop that fired on a usable answer always refuses Sign and verification",
                        {
                            it.command in setOf(OrderCommand.Sign, OrderCommand.Verify) &&
                                OrderPredicate.KB_HARD_STOP_NOT_FIRED !in it.holding
                        },
                    ) { step -> (step.fired() in SIGN_OR_VERIFY) shouldBe false },
                    check(
                        "in an outage the verifier's attested manual check clears the gap; without it Verify never reaches active",
                        {
                            it.command == OrderCommand.Verify && it.from == OrderState.PENDING_VERIFICATION &&
                                it.facts.issuer.userId != null
                        },
                    ) { step ->
                        val f = step.facts
                        val unreviewed = f.copy(cds = f.cds.copy(gaps = f.cds.gaps + CdsGap(false, null)))
                        fire(step.from, step.command, unreviewed).firedIndex() shouldNotBe VERIFY
                        val checked = f.copy(cds = f.cds.copy(gaps = listOf(CdsGap(false, ManualCheck(f.issuer.userId, attested = true)))))
                        OrderGuards.cdsGapsReviewed(checked) shouldBe true
                    },
                )
            stats.requireFired(SIGN_MEDICATION, SIGN_OTHER, VERIFY)
        }

        test(
            "SI-05 (order): double-check-required-for-weight-bsa-high-alert-infusion-neonatal: no returned or mismatched order is verified",
        ) {
            val stats =
                run(
                    "order SI-05 control set A and the returned path",
                    check(
                        "Verify reaches active only with an exact control set A calculation by the verifier",
                        { it.fired() == VERIFY },
                    ) { step ->
                        controlSetAMet(step.facts) shouldBe true
                        step.facts.order.verificationStatus shouldNotBe VerificationStatus.RETURNED
                    },
                    check(
                        "a recorded mismatch returns the order to the prescriber, never to active",
                        {
                            it.command == OrderCommand.Verify &&
                                it.from == OrderState.PENDING_VERIFICATION &&
                                it.holding.containsAll(
                                    listOf(
                                        OrderPredicate.NOT_RETURNED,
                                        OrderPredicate.VERIFIER_IS_PHARMACIST,
                                        OrderPredicate.CONTROL_SET_A_MISMATCH,
                                    ),
                                )
                        },
                    ) { step -> step.fired() shouldBe VERIFY_MISMATCH },
                    check(
                        "a returned order is neither verified nor returned again until the prescriber resubmits it",
                        {
                            it.command == OrderCommand.Verify && it.from == OrderState.PENDING_VERIFICATION &&
                                OrderPredicate.VERIFICATION_RETURNED in it.holding
                        },
                    ) { step -> step.fired() shouldBe null },
                    check(
                        "Resubmit fires only for a returned order, never by the pharmacist who returned it",
                        { it.fired() == RESUBMIT },
                    ) { step ->
                        step.facts.order.verificationStatus shouldNotBe VerificationStatus.PENDING
                        step.facts.order.verificationStatus shouldNotBe VerificationStatus.VERIFIED
                        step.facts.order.returnedBy shouldNotBe null
                        step.facts.order.returnedBy shouldNotBe step.facts.issuer.userId
                    },
                    check("a medication order reaches active only through Verify or Resume of a verified order", {
                        it.outcome.state ==
                            OrderState.ACTIVE &&
                            it.fired() != null
                    }) { step ->
                        if (step.facts.order.kind == OrderKind.MEDICATION) {
                            listOf(VERIFY, RESUME_ACTIVE) shouldContain step.fired()
                            if (step.fired() == RESUME_ACTIVE) step.facts.order.verificationStatus shouldBe VerificationStatus.VERIFIED
                        }
                    },
                    check("Resume never skips verification: an unverified medication order resumes to pending-verification", {
                        it.fired() ==
                            RESUME_PENDING
                    }) { step ->
                        step.facts.order.kind shouldBe OrderKind.MEDICATION
                        step.facts.order.verificationStatus shouldNotBe VerificationStatus.VERIFIED
                    },
                )
            stats.requireFired(VERIFY, VERIFY_MISMATCH, RETURN, RESUBMIT, RESUME_ACTIVE, RESUME_PENDING)
        }

        test("SI-05 (order): no-weight-based-medicine-signed-without-dated-weight") {
            val stats =
                run(
                    "order SI-05 dated weight at Sign",
                    check("every signed weight- or area-based dose has a dated, sourced dosing weight", {
                        it.fired() in
                            setOf(SIGN_MEDICATION, SIGN_OTHER)
                    }) { step ->
                        val basis = step.facts.order.doseBasis
                        if (basis == DoseBasis.PER_BODY_WEIGHT || basis == DoseBasis.PER_BODY_SURFACE_AREA) {
                            val weight = step.facts.patient.dosingWeight
                            weight shouldNotBe null
                            weight?.recordedAt shouldNotBe null
                            weight?.source shouldNotBe null
                        }
                    },
                )
            stats.requireFired(SIGN_MEDICATION, SIGN_OTHER)
        }

        test(
            "SI-07 (order): ai-never-signs-orders: only a human signs, verifies or returns; no AI agent or service ever stops",
        ) {
            val stats =
                run(
                    "order SI-07 ai never signs orders",
                    check("Sign, Verify and the returns fired only for an authenticated human", {
                        it.fired() in
                            setOf(SIGN_MEDICATION, SIGN_OTHER, VERIFY, VERIFY_MISMATCH, RETURN)
                    }) { step ->
                        step.facts.issuer.kind shouldBe PrincipalKind.HUMAN
                        if (step.command == OrderCommand.Sign) step.facts.issuer.authenticatedForThisCommand shouldBe true
                    },
                    check(
                        "a stop fired only for a human or a registered system or interface principal",
                        { it.fired() in setOf(HOLD_ACTIVE, HOLD_PENDING, DISCONTINUE_ACTIVE, DISCONTINUE_OTHER, DISCONTINUE_REPLACED) },
                    ) { step ->
                        setOf(PrincipalKind.HUMAN, PrincipalKind.SYSTEM, PrincipalKind.INTERFACE) shouldContain
                            step.facts.issuer.kind
                    },
                    check("an AI agent, a service or an unknown principal never signs, verifies, stops, resumes, resubmits or discards", {
                        it.facts.issuer.kind !in
                            setOf(PrincipalKind.HUMAN, PrincipalKind.SYSTEM, PrincipalKind.INTERFACE)
                    }) { step ->
                        val fired = step.fired()
                        if (fired !=
                            null
                        ) {
                            (fired in CORRECTIONS || fired == DRAFT_REVIEW || fired == HOLD_REVIEW || fired == COMPLETE) shouldBe true
                        }
                    },
                )
            stats.requireFired(SIGN_MEDICATION, SIGN_OTHER, VERIFY, HOLD_ACTIVE, DISCONTINUE_ACTIVE)
        }

        test("SI-15 (order): no-new-prescribing-without-full-cds-offline: no Sign or Verify from an offline mode without full CDS") {
            val stats =
                run(
                    "order SI-15 no prescribing offline",
                    check("every Sign and Verify that fired was issued online or in a mode the matrix lists with full CDS", {
                        it.fired() in
                            SIGN_OR_VERIFY
                    }) { step ->
                        val mode = step.facts.issuedInMode
                        mode shouldNotBe null
                        (mode in ONLINE || mode in step.facts.configuration.offlineModesWithFullCds) shouldBe true
                    },
                    check(
                        "a Sign or Verify issued offline (mode unknown or not listed) never fires into pending-verification or active",
                        {
                            it.command in setOf(OrderCommand.Sign, OrderCommand.Verify) &&
                                it.facts.issuedInMode.let { mode ->
                                    mode == null ||
                                        (mode !in ONLINE && mode !in it.facts.configuration.offlineModesWithFullCds)
                                }
                        },
                    ) { step -> (step.fired() in SIGN_OR_VERIFY) shouldBe false },
                )
            stats.requireFired(SIGN_MEDICATION, SIGN_OTHER, VERIFY)
        }

        test("SI-16 (order): re-verification-at-signing-after-recent-context-change: start-therapy commands and corrections need it") {
            val stats =
                run(
                    "order SI-16 re-verification after a recent context change",
                    check(
                        "Sign, Verify, Resume, Resubmit and Mark error fire only with the issuer's confirmation after a recent change",
                        { it.fired() in START_THERAPY + CORRECTIONS },
                    ) { step -> issuerConfirmedIfRecentChange(step.facts) shouldBe true },
                )
            stats.requireFired(SIGN_MEDICATION, VERIFY, RESUBMIT, RESUME_ACTIVE, ERROR_ACTIVE, ERROR_TERMINAL)
        }

        test("SI-14 (order): a fired local hard stop always refuses; one that could not run refuses unless STAT or emergency-listed") {
            val stats =
                run(
                    "order SI-14 local hard stops",
                    check(
                        "no Sign or verification fires with a fired local hard stop",
                        {
                            it.command in setOf(OrderCommand.Sign, OrderCommand.Verify) &&
                                it.facts.cds.localRules
                                    ?.contains(LocalRuleOutcome.FIRED) == true
                        },
                    ) { step -> (step.fired() in SIGN_OR_VERIFY) shouldBe false },
                    check(
                        "a Sign or verification that fired with a local rule that could not run is a STAT or emergency-listed order",
                        { it.fired() in SIGN_OR_VERIFY },
                    ) { step ->
                        val rules = step.facts.cds.localRules
                        if (rules == null || LocalRuleOutcome.COULD_NOT_RUN in rules) {
                            val order = step.facts.order
                            val emergencyListed = order.kind == OrderKind.MEDICATION && order.formulary?.onEmergencyOverrideList == true
                            (order.priority == OrderPriority.STAT || emergencyListed) shouldBe true
                        }
                    },
                    check(
                        "every interruptive alert of a fired Sign or verification was answered",
                        { it.fired() in SIGN_OR_VERIFY },
                    ) { step ->
                        step.facts.cds.tierBAlerts
                            .none { it.resolution == AlertResolution.UNRESOLVED } shouldBe true
                    },
                )
            stats.requireFired(SIGN_MEDICATION, SIGN_OTHER, VERIFY)
        }

        test("SI-03 (order): every-order-reaches-a-terminal-state: a stop path is always open and the timers raise owner tasks") {
            val stats =
                run(
                    "order SI-03 every order reaches a terminal state",
                    check("a privileged actor can always discard a draft", { it.from == OrderState.DRAFT }) { step ->
                        val privileged = step.facts.copy(issuer = OrderSamples.clinician(), configuration = OrderSamples.configuration())
                        fire(OrderState.DRAFT, OrderCommand.Discard, privileged).state shouldBe OrderState.REVOKED
                    },
                    check(
                        "a care-team prescriber can always discontinue a signed open order, in the worst case",
                        { it.from in SIGNED_OPEN },
                    ) { step ->
                        val baseline = OrderSamples.clinician().copy(privileges = emptySet(), roles = setOf(StaffRole.PRESCRIBER))
                        fire(step.from, OrderCommand.Discontinue, worstCaseForAStop(step.facts, baseline)).state shouldBe OrderState.REVOKED
                    },
                    check("a due draft or hold review with no open task always raises its owner task", {
                        (
                            it.command == OrderCommand.DraftReviewDue && it.from == OrderState.DRAFT &&
                                OrderPredicate.DRAFT_REVIEW_DUE in it.holding
                        ) ||
                            (
                                it.command == OrderCommand.HoldReviewDue && it.from == OrderState.ON_HOLD &&
                                    OrderPredicate.HOLD_REVIEW_DUE in it.holding
                            )
                    }) { step -> listOf(DRAFT_REVIEW, HOLD_REVIEW) shouldContain step.fired() },
                )
            stats.requireFired(DISCARD, DRAFT_REVIEW, HOLD_REVIEW, COMPLETE, DISCONTINUE_ACTIVE, DISCONTINUE_OTHER)
        }

        test("SI-12 (order): ed-registration-and-emergency-orders-never-blocked: no order fact is financial, so no money rule can refuse") {
            val financial =
                Regex(
                    "bill|deposit|pay|price|charge|cost|coverage|insur|preauth|authoris|tariff|money|fee|balance|credit",
                    RegexOption.IGNORE_CASE,
                )
            val seen = mutableSetOf<Class<*>>()
            val pending = ArrayDeque<Class<*>>(listOf(OrderFacts::class.java))
            val names = mutableListOf<String>()
            while (pending.isNotEmpty()) {
                val type = pending.removeFirst()
                if (!seen.add(type)) continue
                type.declaredFields
                    .filterNot {
                        java.lang.reflect.Modifier
                            .isStatic(it.modifiers)
                    }.forEach { field ->
                        names += "${type.simpleName}.${field.name}"
                        val arguments = (field.genericType as? java.lang.reflect.ParameterizedType)?.actualTypeArguments.orEmpty()
                        (listOf(field.type) + arguments.filterIsInstance<Class<*>>())
                            .filter { it.packageName == OrderFacts::class.java.packageName }
                            .forEach { pending += it }
                    }
            }
            names.filter { financial.containsMatchIn(it) }.shouldBeEmpty()
            (names.size > 0) shouldBe true
        }
    })
