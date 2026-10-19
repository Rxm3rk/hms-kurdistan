package hms.orders.domain.order

import hms.orders.domain.order.OrderSamples.NOW
import io.kotest.property.Arb
import io.kotest.property.RandomSource
import io.kotest.property.Sample
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import kotlin.random.Random

// The facts generator of the order machine (WP-0.5 spec §2.3, §3.3; NOT FOR CLINICAL USE: synthetic SYN- values only).
// Each draw starts from clean facts (OrderSamples.clean) with random choices for the exact complements (order kind,
// verification status, control set A outcome, replacement reason, issuer persona), then applies zero to three random
// faults. A fault breaks one fact, often at a boundary (an SI-16 window edge, a licence expiring at the server's time,
// a timer due exactly now, an unknown flag), so every transition fires often (property P7) while refusals, unknown
// values and edge values stay common, and every predicate both holds and fails.

private const val MEDICATION_SHARE = 0.55
private const val VERBAL_SHARE = 0.15
private const val REPLACEMENT_DRAFT_SHARE = 0.2
private const val REPLACED_REASON_SHARE = 0.2
private const val SYSTEM_PERSONA_SHARE = 0.12
private const val NO_FAULT_SHARE = 0.5
private const val ONE_FAULT_SHARE = 0.8
private const val TWO_FAULT_SHARE = 0.95
private const val THREE_FAULTS = 3
private const val PENDING_SHARE = 0.4
private const val RETURNED_SHARE = 0.65
private const val NO_CALCULATION_SHARE = 0.5
private const val MATCHING_CALCULATION_SHARE = 0.8
private const val WINDOW_MILLIS = 60_000L
private const val TEN = 10L
private const val LONG_WINDOW_MINUTES = 15L
private const val REVIEW_SET_MINUTES = 30L

/**
 * The order machine's facts generator (WP-0.5 spec §3.3), shared by the property tests and tests/invariants. One small
 * builder per family of faults keeps each fault readable; together they exceed detekt's per-object function count.
 */
@Suppress("TooManyFunctions")
object OrderArbs {
    /** Facts biased so that every transition fires in 1,000 sequences while refusals and edge values stay common. */
    val facts: Arb<OrderFacts> =
        object : Arb<OrderFacts>() {
            override fun edgecase(rs: RandomSource): Sample<OrderFacts> = Sample(OrderSamples.clean())

            override fun sample(rs: RandomSource): Sample<OrderFacts> = Sample(draw(rs.random))
        }

    /** One draw: clean facts with random complements and persona, then zero to three faults. */
    fun draw(random: Random): OrderFacts {
        var facts = baseline(random)
        repeat(faultCount(random)) { facts = FAULTS[random.nextInt(FAULTS.size)](facts, random) }
        return facts
    }

    private fun faultCount(random: Random): Int {
        val roll = random.nextDouble()
        return when {
            roll < NO_FAULT_SHARE -> 0
            roll < ONE_FAULT_SHARE -> 1
            roll < TWO_FAULT_SHARE -> 2
            else -> THREE_FAULTS
        }
    }

    private fun baseline(random: Random): OrderFacts {
        val kind = if (random.nextDouble() < MEDICATION_SHARE) OrderKind.MEDICATION else OTHER_KINDS.random(random)
        val roll = random.nextDouble()
        val status =
            when {
                roll < PENDING_SHARE -> VerificationStatus.PENDING
                roll < RETURNED_SHARE -> VerificationStatus.RETURNED
                else -> VerificationStatus.VERIFIED
            }
        var facts = OrderSamples.clean(kind, status)
        val calculation = random.nextDouble()
        facts =
            when {
                calculation < NO_CALCULATION_SHARE -> facts
                calculation < MATCHING_CALCULATION_SHARE -> facts.copy(calculations = listOf(OrderSamples.matchingCalculation()))
                else -> facts.copy(calculations = listOf(mismatch(random)))
            }
        if (random.nextDouble() < VERBAL_SHARE) facts = facts.copy(verbal = OrderSamples.verbalOrder())
        if (random.nextDouble() < REPLACEMENT_DRAFT_SHARE) facts = facts.withOrder { copy(replaces = replacedActiveOrder()) }
        if (random.nextDouble() < SYSTEM_PERSONA_SHARE) {
            facts = facts.copy(issuer = OrderSamples.systemPrincipal(), reason = GivenReason(OrderSamples.SYSTEM_REASON, null, false))
        }
        if (random.nextDouble() < REPLACED_REASON_SHARE) {
            facts = facts.copy(reason = GivenReason(OrderGuards.REPLACED_REASON, null, chosenByUser = false))
        }
        return facts
    }

    private fun replacedActiveOrder(): ReplacedOrder =
        ReplacedOrder(OrderState.ACTIVE, alreadyReplacedBySignedOrder = false, StopPrivilege(OrderSamples.PRIV_DISCONTINUE, true))

    private fun mismatch(random: Random): IndependentDose {
        val ordered = OrderSamples.ORDERED
        val dose =
            listOf(
                ordered.copy(unit = OrderSamples.OTHER_UNIT),
                ordered.copy(lower = ordered.lower.multiply(BigDecimal.TEN)),
                ordered.copy(upper = ordered.lower),
            ).random(random)
        return OrderSamples.matchingCalculation().copy(dose = dose)
    }

    private val OTHER_KINDS: List<OrderKind> = OrderKind.entries - OrderKind.MEDICATION

    private fun OrderFacts.withOrder(change: OrderRecord.() -> OrderRecord): OrderFacts = copy(order = order.change())

    private fun OrderFacts.withIssuer(change: Actor.() -> Actor): OrderFacts = copy(issuer = issuer.change())

    private fun OrderFacts.withConfiguration(change: OrderConfiguration.() -> OrderConfiguration): OrderFacts =
        copy(configuration = configuration.change())

    private fun OrderFacts.withCds(change: CdsEvaluation.() -> CdsEvaluation): OrderFacts = copy(cds = cds.change())

    private fun OrderFacts.withIdentity(
        change: Instant?,
        vararg answers: ReverificationAnswer,
    ): OrderFacts = copy(identity = identity.copy(lastChangeAt = change, answers = answers.toList()))

    private fun OrderFacts.withVerbal(change: VerbalOrder.() -> VerbalOrder): OrderFacts =
        copy(verbal = (verbal ?: OrderSamples.verbalOrder()).change())

    private fun OrderFacts.withFormulary(change: FormularyFlags.() -> FormularyFlags): OrderFacts =
        withOrder { copy(formulary = (formulary ?: FormularyFlags(false, false, false, false, false)).change()) }

    private fun confirmation(
        user: String?,
        at: Instant?,
        forThisCommand: Boolean = false,
    ) = ReverificationAnswer(user, ReverificationOutcome.CONFIRMED, at, forThisCommand)

    private fun dispute(at: Instant) = ReverificationAnswer(OrderSamples.ISSUER, ReverificationOutcome.NOT_THIS_PATIENT, at, false)

    private val windowEdge: Instant = NOW.minusMillis(WINDOW_MILLIS)
    private val recently: Instant = NOW.minusSeconds(TEN)
    private val muchLater: Instant = NOW.plus(Duration.ofDays(TEN))

    /** Each fault changes one fact; many sit exactly at a boundary of a predicate's description. */
    private val FAULTS: List<(OrderFacts, Random) -> OrderFacts> =
        listOf(
            // ---- the issuer
            { f, r -> f.withIssuer { copy(kind = (PrincipalKind.entries - PrincipalKind.HUMAN + listOf(null)).random(r)) } },
            { f, _ -> f.withIssuer { copy(authenticatedForThisCommand = false) } },
            { f, _ -> f.withIssuer { copy(userId = null) } },
            { f, _ -> f.withIssuer { copy(licences = licences.map { it.copy(expiresAt = NOW) }) } },
            { f, _ -> f.withIssuer { copy(licences = licences.map { it.copy(expiresAt = null) }) } },
            { f, _ -> f.withIssuer { copy(licences = emptyList()) } },
            { f, _ -> f.withIssuer { copy(privileges = emptySet()) } },
            { f, r -> f.withIssuer { copy(privileges = privileges - OrderSamples.ALL_PRIVILEGES.random(r)) } },
            { f, _ -> f.withIssuer { copy(roles = setOf(StaffRole.NURSE), onPatientCareTeam = false) } },
            { f, _ -> f.withIssuer { copy(onPatientCareTeam = false) } },
            { f, _ -> f.withIssuer { copy(roles = setOf(StaffRole.PHARMACIST)) } },
            {
                f,
                r,
                ->
                f.withIssuer { copy(userId = listOf(OrderSamples.SIGNER, OrderSamples.AUTHOR, OrderSamples.RETURNER).random(r)) }
            },
            { f, _ -> f.withIssuer { copy(registrations = emptySet()) } },
            { f, _ -> f.withIssuer { copy(registeredSystemReasons = emptySet()) } },
            // ---- governed configuration (stop configuration missing or naming nobody brings in the baseline)
            { f, _ -> f.withConfiguration { copy(holdPrivilege = null, discontinuePrivilege = null) } },
            {
                f,
                _,
                ->
                f.withConfiguration {
                    copy(holdPrivilege = holdPrivilege?.copy(grantedToAnyone = false), discontinuePrivilege = null)
                }
            },
            { f, _ -> f.withConfiguration { copy(commandRequirement = null) } },
            { f, _ -> f.withConfiguration { copy(commandRequirement = commandRequirement?.copy(licence = null)) } },
            { f, _ -> f.withConfiguration { copy(orderingPrivilege = null) } },
            { f, _ -> f.withConfiguration { copy(verificationPrivilege = null) } },
            { f, _ -> f.withConfiguration { copy(enteredInErrorPrivilege = null) } },
            { f, _ -> f.withConfiguration { copy(verbalReceiptPrivilege = null) } },
            {
                f,
                _,
                ->
                f.withConfiguration {
                    copy(
                        holdReasons = emptySet(),
                        discontinueReasons = emptySet(),
                        returnReasons = emptySet(),
                        responseReasons = emptySet(),
                        errorReasons = emptySet(),
                    )
                }
            },
            { f, r -> f.withConfiguration { copy(offlineModesWithFullCds = setOf(ConnectivityMode.entries.random(r))) } },
            {
                f,
                _,
                ->
                f.withConfiguration { copy(draftReviewInterval = null, prebuildReviewInterval = Duration.ZERO, holdReviewInterval = null) }
            },
            // ---- SI-16 (DN-026, DN-027, DN-028)
            { f, _ -> f.withIdentity(windowEdge) },
            { f, _ -> f.withIdentity(windowEdge.minusMillis(1)) },
            { f, _ -> f.withIdentity(NOW.plusSeconds(1)) },
            { f, _ -> f.withIdentity(null) },
            { f, _ -> f.withIdentity(null, confirmation(f.issuer.userId, null, forThisCommand = true)) },
            { f, _ -> f.withIdentity(null, confirmation(f.issuer.userId, recently, forThisCommand = false)) },
            { f, _ -> f.withIdentity(recently, confirmation(f.issuer.userId, NOW)) },
            { f, _ -> f.withIdentity(recently, confirmation(OrderSamples.OTHER_USER, NOW)) },
            { f, _ -> f.withIdentity(recently, confirmation(f.issuer.userId, recently)) },
            { f, _ -> f.withIdentity(windowEdge.minusSeconds(TEN), dispute(NOW)) },
            { f, _ -> f.withIdentity(recently, dispute(NOW.minusSeconds(1)), confirmation(f.issuer.userId, NOW)) },
            {
                f,
                _,
                ->
                f.copy(
                    identity =
                        f.identity.copy(
                            lastChangeAt = NOW.minus(Duration.ofMinutes(TEN)),
                            tenantWindow = Duration.ofMinutes(LONG_WINDOW_MINUTES),
                        ),
                )
            },
            { f, _ -> f.copy(identity = f.identity.copy(lastChangeAt = recently, tenantWindow = Duration.ofSeconds(1))) },
            // ---- SI-15
            { f, r -> f.copy(issuedInMode = (ConnectivityMode.entries + listOf(null)).random(r)) },
            // ---- CDS
            { f, _ -> f.withCds { copy(localRules = listOf(LocalRuleOutcome.NOT_FIRED, LocalRuleOutcome.FIRED)) } },
            { f, _ -> f.withCds { copy(localRules = listOf(LocalRuleOutcome.COULD_NOT_RUN)) } },
            { f, _ -> f.withCds { copy(localRules = null) } },
            { f, _ -> f.withCds { copy(localRules = emptyList()) } },
            { f, _ -> f.withOrder { copy(priority = OrderPriority.STAT) } },
            { f, _ -> f.withOrder { copy(priority = null) } },
            { f, _ -> f.withFormulary { copy(onEmergencyOverrideList = true) } },
            { f, _ -> f.withCds { copy(kbDoseCheck = KbDoseCheck(true, KbAnswer(OrderSamples.UNIT, true, tierAHardStopFired = true))) } },
            { f, r -> f.withCds { copy(kbDoseCheck = unusableFiredKb(r)) } },
            { f, r -> f.withCds { copy(tierBAlerts = listOf(alert(r))) } },
            { f, r -> f.withCds { copy(gaps = listOf(gap(r))) } },
            // ---- ordering rules
            { f, r -> f.copy(coSign = coSign(r)) },
            { f, _ -> f.withVerbal { copy(situationAllowed = false) } },
            { f, _ -> f.withVerbal { copy(receiver = receiver.copy(privileges = emptySet())) } },
            { f, _ -> f.withVerbal { copy(readBack = null) } },
            { f, _ -> f.withVerbal { copy(readBack = readBack?.copy(sourceId = OrderSamples.OTHER_USER)) } },
            { f, _ -> f.withVerbal { copy(coSignDueAt = receivedAt) } },
            { f, _ -> f.withVerbal { copy(coSignDueAt = receivedAt?.plus(f.configuration.coSignLimit ?: Duration.ZERO)) } },
            { f, _ -> f.withVerbal { copy(coSignDueAt = muchLater) } },
            { f, _ -> f.withVerbal { copy(receivedAt = null) } },
            { f, _ -> f.withConfiguration { copy(coSignLimit = null) } },
            { f, _ -> f.withFormulary { copy(antineoplastic = true) } },
            { f, _ -> f.withFormulary { copy(antineoplastic = null, antimicrobial = null, restricted = null, highAlert = null) } },
            { f, _ -> f.withOrder { copy(formulary = null) } },
            { f, r -> antimicrobial(f, r) },
            { f, _ -> f.withFormulary { copy(antimicrobial = true) }.withOrder { copy(stopDate = null, reviewDate = null) } },
            { f, _ -> f.withFormulary { copy(antimicrobial = true) }.withOrder { copy(stopDate = null, reviewDate = NOW) } },
            { f, _ -> f.withOrder { copy(prn = true, indication = null) } },
            { f, _ -> f.withOrder { copy(indication = " ") } },
            { f, r -> weight(f, r) },
            {
                f,
                r,
                ->
                f.withOrder {
                    copy(
                        replaces =
                            ReplacedOrder(
                                OrderState.entries.random(r),
                                r.nextBoolean(),
                                StopPrivilege("SYN-PRIV-NONE", r.nextBoolean()),
                            ),
                    )
                }
            },
            // ---- verification
            { f, _ -> f.withOrder { copy(verificationStatus = null) } },
            { f, _ -> f.withOrder { copy(returnedBy = null) } },
            { f, r -> calculation(f, r) },
            { f, r -> controlSetAApplies(f, r) },
            { f, _ -> f.withOrder { copy(orderedDose = null) } },
            // ---- reasons
            { f, r -> f.copy(reason = reason(r)) },
            { f, r -> f.copy(replacingOrder = replacing(r)) },
            // ---- timers
            { f, _ -> f.withOrder { copy(draftReview = draftReview.copy(ownerTaskOpen = true)) } },
            { f, _ -> f.withOrder { copy(createdAt = NOW.minus(Duration.ofMinutes(TEN))) } },
            { f, _ -> f.withOrder { copy(createdAt = NOW.minus(Duration.ofHours(1))) } },
            { f, _ -> f.withOrder { copy(prebuild = true, createdAt = NOW.minus(Duration.ofMinutes(TEN))) } },
            { f, _ -> f.withOrder { copy(draftReview = draftReview.copy(previousReviewDueAt = NOW.minus(Duration.ofMinutes(TEN)))) } },
            { f, _ -> f.withOrder { copy(holdReview = holdReview?.copy(reviewTaskOpen = true)) } },
            { f, _ -> f.withOrder { copy(holdReview = HoldReviewTimer(NOW.minus(Duration.ofMinutes(TEN)), null, null, false)) } },
            {
                f,
                _,
                ->
                f.withOrder {
                    copy(holdReview = HoldReviewTimer(NOW.minus(Duration.ofMinutes(REVIEW_SET_MINUTES)), NOW, null, false))
                }
            },
            { f, _ -> f.withOrder { copy(holdReview = holdReview?.copy(previousReviewDueAt = NOW.minus(Duration.ofMinutes(TEN)))) } },
            { f, _ -> f.withOrder { copy(holdReview = null) } },
            // ---- fulfilment
            { f, r -> fulfilment(f, r) },
            // ---- correction
            { f, _ -> f.copy(auditWritable = false) },
        )

    private fun unusableFiredKb(random: Random): KbDoseCheck =
        listOf(
            KbDoseCheck(true, null),
            KbDoseCheck(true, KbAnswer(null, true, tierAHardStopFired = true)),
            KbDoseCheck(true, KbAnswer(OrderSamples.OTHER_UNIT, true, tierAHardStopFired = true)),
            KbDoseCheck(true, KbAnswer(OrderSamples.UNIT, false, tierAHardStopFired = true)),
            KbDoseCheck(false, KbAnswer(OrderSamples.UNIT, true, tierAHardStopFired = true)),
        ).random(random)

    private fun alert(random: Random): TierBAlert =
        listOf(
            TierBAlert(AlertResolution.UNRESOLVED, null),
            TierBAlert(AlertResolution.RESOLVED_BY_CHANGE, null),
            TierBAlert(AlertResolution.OVERRIDDEN, GivenReason(OrderSamples.REASON, null, chosenByUser = true)),
            TierBAlert(AlertResolution.OVERRIDDEN, GivenReason(OrderSamples.REASON, null, chosenByUser = false)),
            TierBAlert(AlertResolution.OVERRIDDEN, null),
        ).random(random)

    private fun gap(random: Random): CdsGap =
        listOf(
            CdsGap(answeredWithoutFiring = false, manualCheck = null),
            CdsGap(answeredWithoutFiring = true, manualCheck = null),
            CdsGap(answeredWithoutFiring = false, manualCheck = ManualCheck(OrderSamples.ISSUER, attested = true)),
            CdsGap(answeredWithoutFiring = false, manualCheck = ManualCheck(OrderSamples.OTHER_USER, attested = true)),
            CdsGap(answeredWithoutFiring = false, manualCheck = ManualCheck(OrderSamples.ISSUER, attested = false)),
        ).random(random)

    private fun coSign(random: Random): CoSign {
        val cosigner = OrderSamples.clinician(OrderSamples.COSIGNER)
        val signature =
            listOf(
                null,
                CoSignature(cosigner),
                CoSignature(OrderSamples.clinician()),
                CoSignature(cosigner.copy(authenticatedForThisCommand = false)),
                CoSignature(cosigner.copy(licences = listOf(Licence(LicenceKind.PRACTITIONER, NOW)))),
            ).random(random)
        return CoSign(requiredBeforeActivation = true, coSignature = signature)
    }

    private fun antimicrobial(
        facts: OrderFacts,
        random: Random,
    ): OrderFacts {
        val approver = OrderSamples.clinician(OrderSamples.APPROVER).copy(roles = setOf(StaffRole.ANTIMICROBIAL_APPROVER))
        val restricted =
            facts.withFormulary {
                copy(
                    antimicrobial = true,
                    restricted = random.nextBoolean().takeIf { random.nextBoolean() },
                )
            }
        return restricted.copy(
            antimicrobialApprover =
                listOf(
                    null,
                    approver,
                    approver.copy(userId = facts.issuer.userId),
                    approver.copy(roles = emptySet()),
                ).random(random),
            order =
                restricted.order.copy(
                    priority = OrderPriority.entries.random(random),
                    indication = if (random.nextBoolean()) "SYN-INDICATION" else null,
                ),
        )
    }

    private fun weight(
        facts: OrderFacts,
        random: Random,
    ): OrderFacts {
        val dosingWeight =
            listOf(
                null,
                DosingWeight(null, WeightSource.MEASURED),
                DosingWeight(NOW, null),
                DosingWeight(NOW, WeightSource.ESTIMATED),
                DosingWeight(NOW, WeightSource.STATED),
            ).random(random)
        val basis = listOf(DoseBasis.PER_BODY_WEIGHT, DoseBasis.PER_BODY_SURFACE_AREA).random(random)
        return facts.copy(patient = facts.patient.copy(dosingWeight = dosingWeight)).withOrder { copy(doseBasis = basis) }
    }

    private fun calculation(
        facts: OrderFacts,
        random: Random,
    ): OrderFacts {
        val matching = OrderSamples.matchingCalculation()
        val submitted = facts.order.lastSubmittedAt ?: NOW
        val ordered = OrderSamples.ORDERED
        val variant =
            listOf(
                matching.copy(recordedBy = OrderSamples.OTHER_USER),
                matching.copy(recordedBy = null),
                matching.copy(attestedMatches = false),
                matching.copy(recordedAt = submitted),
                matching.copy(dose = ordered.copy(lower = BigDecimal("5.00"))),
                matching.copy(dose = ordered.copy(upper = BigDecimal.TEN)),
            ).random(random)
        val earlierMismatch = mismatch(random).copy(recordedAt = submitted.minusSeconds(1))
        val calculations = if (random.nextBoolean()) listOf(earlierMismatch, variant) else listOf(variant, matching)
        return facts.copy(calculations = calculations)
    }

    private fun controlSetAApplies(
        facts: OrderFacts,
        random: Random,
    ): OrderFacts =
        when (random.nextInt(THREE_FAULTS)) {
            0 -> facts.withOrder { copy(doseBasis = DoseBasis.PER_BODY_WEIGHT) }
            1 -> facts.withOrder { copy(infusion = true) }.withFormulary { copy(highAlert = null) }
            else -> facts.copy(patient = facts.patient.copy(neonatal = null))
        }

    private fun reason(random: Random): GivenReason? =
        listOf(
            null,
            GivenReason(null, null, chosenByUser = true),
            GivenReason(OrderSamples.REASON, null, chosenByUser = false),
            GivenReason(OrderSamples.UNLISTED_REASON, null, chosenByUser = true),
            GivenReason(OrderGuards.OTHER_REASON, "SYN free text", chosenByUser = true),
            GivenReason(OrderGuards.OTHER_REASON, " ", chosenByUser = true),
            GivenReason(OrderGuards.REPLACED_REASON, null, chosenByUser = true),
            GivenReason(OrderSamples.SYSTEM_REASON, null, chosenByUser = false),
        ).random(random)

    private fun replacing(random: Random): ReplacingOrder? =
        listOf(
            null,
            ReplacingOrder(null, OrderSamples.COMMAND_ID),
            ReplacingOrder("SYN-ORD-0002", OrderSamples.COMMAND_ID),
            ReplacingOrder(OrderSamples.ORDER_ID, null),
            ReplacingOrder(OrderSamples.ORDER_ID, "SYN-CMD-0002"),
        ).random(random)

    private fun fulfilment(
        facts: OrderFacts,
        random: Random,
    ): OrderFacts {
        val clean = facts.fulfilment
        val report =
            listOf(
                clean.copy(medication = null, diagnosticResults = null, otherTasksDone = null),
                clean.copy(medication = MedicationFulfilment(false, null, listOf(DoseProgress.TERMINAL, DoseProgress.SCHEDULED))),
                clean.copy(medication = MedicationFulfilment(false, null, listOf(DoseProgress.IN_PROGRESS))),
                clean.copy(medication = MedicationFulfilment(true, null, emptyList())),
                clean.copy(medication = MedicationFulfilment(true, NOW, listOf(DoseProgress.TERMINAL))),
                clean.copy(medication = MedicationFulfilment(true, NOW.minusSeconds(1), listOf(DoseProgress.TERMINAL))),
                clean.copy(diagnosticResults = listOf(ResultState.FINAL, null)),
                clean.copy(diagnosticResults = listOf(ResultState.AMENDED, ResultState.CORRECTED)),
                clean.copy(diagnosticResults = listOf(ResultState.CANCELLED)),
                clean.copy(diagnosticResults = emptyList()),
                clean.copy(otherTasksDone = false),
            ).random(random)
        val stop = listOf(facts.order.stopDate, NOW, muchLater, null).random(random)
        return facts.copy(fulfilment = report).withOrder { copy(stopDate = stop) }
    }
}
