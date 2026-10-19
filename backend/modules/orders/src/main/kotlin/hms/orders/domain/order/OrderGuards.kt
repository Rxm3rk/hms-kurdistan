package hms.orders.domain.order

import java.time.Duration
import java.time.Instant

/**
 * The single implementation of the order machine's guard predicates (docs/specs/state-machines/order.yaml; WP-0.5 spec
 * docs/specs/modules/state-machines-and-invariants.md §2.1 rule 12, §3.1). Each function implements its predicate's
 * YAML description; the description is its KDoc in [OrderPredicates]. Every function is pure and total: it reads only
 * [OrderFacts], never the system clock, and an unknown value fails wherever the description says so.
 *
 * Exact complements (medicationOrder / notMedicationOrder, notReturned / verificationReturned, verifiedOrNotMedication /
 * medicationAwaitingVerification, reasonIsReplacement / reasonIsNotReplacement) are literal negations of one private
 * function, so the two can never both hold. SI-05: no predicate does dose arithmetic; the only quantity comparison is
 * control set A's exact comparison in the same unit ([exactlyEquals]). SI-12: no predicate reads a financial fact.
 *
 * Stops never fail for a missing re-verification, a missing privilege configuration, an expired licence or a missing
 * reason list (DN-052 items 2 and 14): [mayHoldOrder] and [mayDiscontinueOrder] fall back on the vendor-locked baseline
 * and read no licence, no stop guard reads the patient context or the connectivity mode, and [holdReasonEntered] and
 * [discontinueReasonEntered] always accept "other" with free text.
 *
 * The one object implements all 42 predicates of the generated interface (spec §2.1 rule 12), hence detekt's
 * TooManyFunctions is suppressed here.
 */
@Suppress("TooManyFunctions")
object OrderGuards : OrderPredicates {
    /** SI-16: the server-side re-verification window is never shorter than 60 000 ms (DN-026; CTRL-0016-1). */
    val MINIMUM_REVERIFICATION_WINDOW: Duration = Duration.ofMillis(60_000)

    /** The reason code "other", always offered with free text for a hold or a discontinue (DN-052 item 9). */
    const val OTHER_REASON: String = "other"

    /** The system discontinue reason that only the signing of a replacing order sets; never offered to a user. */
    const val REPLACED_REASON: String = "replaced"

    // ---- Order kind

    override fun medicationOrder(facts: OrderFacts): Boolean = isMedication(facts)

    override fun notMedicationOrder(facts: OrderFacts): Boolean = !isMedication(facts)

    // ---- Who acts

    override fun signerAuthenticatedHuman(facts: OrderFacts): Boolean =
        facts.issuer.kind == PrincipalKind.HUMAN && facts.issuer.authenticatedForThisCommand

    override fun ordererPrivileged(facts: OrderFacts): Boolean = practitionerPrivileged(orderingPractitioner(facts), facts)

    override fun actorPrivileged(facts: OrderFacts): Boolean {
        val issuer = facts.issuer
        val requirement = facts.configuration.commandRequirement
        return issuer.kind == PrincipalKind.HUMAN &&
            issuer.userId != null &&
            requirement != null &&
            requirement.privilege in issuer.privileges &&
            (requirement.licence == null || holdsValidLicence(issuer, requirement.licence, facts.serverTime))
    }

    override fun mayHoldOrder(facts: OrderFacts): Boolean {
        val issuer = facts.issuer
        return when (issuer.kind) {
            PrincipalKind.HUMAN -> {
                humanMayStop(issuer, facts.configuration.holdPrivilege) {
                    isCareTeamPrescriber(issuer) || StaffRole.PHARMACIST in issuer.roles
                }
            }

            PrincipalKind.SYSTEM, PrincipalKind.INTERFACE -> {
                registeredSystemMay(issuer, SystemRegistration.HOLD_ORDERS)
            }

            PrincipalKind.SERVICE, PrincipalKind.AI_AGENT, PrincipalKind.MIGRATION_LOADER, null -> {
                false
            }
        }
    }

    override fun mayDiscontinueOrder(facts: OrderFacts): Boolean = mayDiscontinue(facts.issuer, facts.configuration.discontinuePrivilege)

    override fun verifierIsPharmacist(facts: OrderFacts): Boolean {
        val issuer = facts.issuer
        val privilege = facts.configuration.verificationPrivilege
        return issuer.kind == PrincipalKind.HUMAN &&
            privilege != null &&
            privilege in issuer.privileges &&
            holdsValidLicence(issuer, LicenceKind.PHARMACIST, facts.serverTime)
    }

    override fun verifierIndependentOfOrderer(facts: OrderFacts): Boolean {
        val verifier = facts.issuer.userId ?: return false
        val verbalReceiver = if (facts.verbal != null) listOf(facts.verbal.receiver.userId) else emptyList()
        val excluded = listOf(orderingPractitionerId(facts), facts.order.signerId, facts.order.createdBy) + verbalReceiver
        // An unknown orderer, signer, creator or verbal receiver cannot be shown to differ from the verifier.
        return excluded.all { it != null && it != verifier }
    }

    // ---- SI-16

    override fun identityReverificationSatisfied(facts: OrderFacts): Boolean {
        val context = facts.identity
        val change = context.lastChangeAt
        val withinWindow = change == null || changedWithinWindow(change, facts.serverTime, context.tenantWindow)
        val relevant =
            if (change == null) {
                context.answers.filter { it.forThisCommand }
            } else {
                context.answers.filter { it.recordedAt != null && it.recordedAt.isAfter(change) }
            }
        val notDisputed = relevant.none { it.outcome == ReverificationOutcome.NOT_THIS_PATIENT }
        val latest = relevant.lastOrNull()
        val confirmedByIssuer =
            latest != null &&
                latest.outcome == ReverificationOutcome.CONFIRMED &&
                facts.issuer.userId != null &&
                latest.userId == facts.issuer.userId
        return (!withinWindow && notDisputed) || confirmedByIssuer
    }

    // ---- SI-15

    override fun notOfflineWithoutFullCds(facts: OrderFacts): Boolean {
        val mode = facts.issuedInMode ?: return false
        return mode in ONLINE_MODES || mode in facts.configuration.offlineModesWithFullCds
    }

    // ---- CDS

    override fun localHardStopsSatisfied(facts: OrderFacts): Boolean {
        val rules = facts.cds.localRules
        val fired = rules != null && LocalRuleOutcome.FIRED in rules
        val couldNotRun = rules == null || LocalRuleOutcome.COULD_NOT_RUN in rules
        return !fired && (!couldNotRun || emergencyListedOrStat(facts))
    }

    override fun kbHardStopNotFired(facts: OrderFacts): Boolean {
        val check = facts.cds.kbDoseCheck
        val answer = check.answer
        // Only a usable answer can fire: one with a ratio, flag or maximum in exactly the ordered unit, in time.
        val usable =
            check.covered &&
                answer != null &&
                answer.withinTimeBudget &&
                answer.referenceUnit != null &&
                answer.referenceUnit == facts.order.orderedDose?.unit
        return !(usable && answer?.tierAHardStopFired == true)
    }

    override fun interruptiveAlertsAnswered(facts: OrderFacts): Boolean =
        facts.cds.tierBAlerts.all { alert ->
            when (alert.resolution) {
                AlertResolution.UNRESOLVED -> false
                AlertResolution.RESOLVED_BY_CHANGE -> true
                AlertResolution.OVERRIDDEN -> alert.overrideReason.let { it != null && it.chosenByUser && !it.code.isNullOrBlank() }
            }
        }

    override fun cdsGapsReviewed(facts: OrderFacts): Boolean {
        val verifier = facts.issuer.userId
        return facts.cds.gaps.all { gap ->
            gap.answeredWithoutFiring ||
                gap.manualCheck.let { it != null && it.attested && verifier != null && it.recordedBy == verifier }
        }
    }

    // ---- Ordering rules

    override fun coSignRuleSatisfied(facts: OrderFacts): Boolean {
        if (!facts.coSign.requiredBeforeActivation) return true
        val cosigner = facts.coSign.coSignature?.cosigner
        return cosigner != null &&
            cosigner.userId != null &&
            facts.issuer.userId != null &&
            cosigner.userId != facts.issuer.userId &&
            cosigner.authenticatedForThisCommand &&
            practitionerPrivileged(cosigner, facts)
    }

    override fun verbalOrderPermitted(facts: OrderFacts): Boolean {
        val verbal = facts.verbal ?: return true
        val privilege = facts.configuration.verbalReceiptPrivilege
        return verbal.situationAllowed && privilege != null && privilege in verbal.receiver.privileges
    }

    override fun verbalOrderDocumented(facts: OrderFacts): Boolean {
        val verbal = facts.verbal ?: return true
        val readBack = verbal.readBack
        val readBackRecorded =
            readBack != null &&
                readBack.at != null &&
                readBack.sourceId != null &&
                readBack.sourceId == verbal.source.userId &&
                readBack.receiverId != null &&
                readBack.receiverId == verbal.receiver.userId
        return readBackRecorded && coSignDueInLimit(verbal, facts.configuration.coSignLimit)
    }

    override fun notVerbalAntineoplastic(facts: OrderFacts): Boolean = facts.verbal == null || !flagged(facts) { it.antineoplastic }

    override fun restrictedAntimicrobialApproved(facts: OrderFacts): Boolean {
        if (!isRestrictedAntimicrobial(facts)) return true
        val approver = facts.antimicrobialApprover
        val approved =
            approver != null &&
                StaffRole.ANTIMICROBIAL_APPROVER in approver.roles &&
                approver.userId != null &&
                facts.issuer.userId != null &&
                approver.userId != facts.issuer.userId
        val timeCritical = facts.order.priority == OrderPriority.STAT || facts.order.priority == OrderPriority.ASAP
        return hasIndication(facts) && (approved || timeCritical)
    }

    override fun antimicrobialStopOrReviewDateSet(facts: OrderFacts): Boolean =
        !isAntimicrobial(facts) || facts.order.stopDate != null || facts.order.reviewDate != null

    override fun indicationRecordedWhereRequired(facts: OrderFacts): Boolean {
        val required = isAntimicrobial(facts) || facts.order.prn || facts.order.kind == OrderKind.IMAGING
        return !required || hasIndication(facts)
    }

    override fun datedWeightRecordedIfWeightBased(facts: OrderFacts): Boolean {
        val weightBased =
            facts.order.doseBasis == DoseBasis.PER_BODY_WEIGHT || facts.order.doseBasis == DoseBasis.PER_BODY_SURFACE_AREA
        val weight = facts.patient.dosingWeight
        return !weightBased || (weight != null && weight.recordedAt != null && weight.source != null)
    }

    override fun replacedOrderDiscontinuable(facts: OrderFacts): Boolean {
        val replaced = facts.order.replaces ?: return true
        return replaced.state in DISCONTINUABLE_STATES &&
            !replaced.alreadyReplacedBySignedOrder &&
            mayDiscontinue(facts.issuer, replaced.discontinuePrivilege)
    }

    // ---- Pharmacist verification

    override fun notReturned(facts: OrderFacts): Boolean = !isReturned(facts)

    override fun verificationReturned(facts: OrderFacts): Boolean = isReturned(facts)

    override fun controlSetASatisfied(facts: OrderFacts): Boolean {
        val latest = latestCalculation(facts)
        if (latest == null) return !controlSetAApplies(facts)
        val ordered = facts.order.orderedDose
        val verifier = facts.issuer.userId
        return verifier != null &&
            latest.recordedBy == verifier &&
            latest.attestedMatches &&
            ordered != null &&
            exactlyEquals(latest.dose, ordered)
    }

    override fun controlSetAMismatch(facts: OrderFacts): Boolean {
        val latest = latestCalculation(facts) ?: return false
        val ordered = facts.order.orderedDose
        return ordered == null || !exactlyEquals(latest.dose, ordered)
    }

    override fun returnReasonEntered(facts: OrderFacts): Boolean = chosenFromList(facts.reason, facts.configuration.returnReasons)

    override fun prescriberResponseRecorded(facts: OrderFacts): Boolean {
        val issuer = facts.issuer
        val issuerId = issuer.userId ?: return false
        val returnedBy = facts.order.returnedBy
        val mayRespond = issuerId == orderingPractitionerId(facts) || practitionerPrivileged(issuer, facts)
        return chosenFromList(facts.reason, facts.configuration.responseReasons) &&
            mayRespond &&
            returnedBy != null &&
            returnedBy != issuerId
    }

    // ---- Hold and resume

    override fun holdReasonEntered(facts: OrderFacts): Boolean = stopReasonGiven(facts, facts.configuration.holdReasons)

    override fun verifiedOrNotMedication(facts: OrderFacts): Boolean = isVerifiedOrNotMedication(facts)

    override fun medicationAwaitingVerification(facts: OrderFacts): Boolean = !isVerifiedOrNotMedication(facts)

    // ---- SI-03 timers

    override fun draftReviewDue(facts: OrderFacts): Boolean {
        val timer = facts.order.draftReview
        val configuration = facts.configuration
        val tenantInterval = if (facts.order.prebuild) configuration.prebuildReviewInterval else configuration.draftReviewInterval
        val nextDue = (timer.previousReviewDueAt ?: facts.order.createdAt).plus(effectiveInterval(tenantInterval, configuration))
        return !facts.serverTime.isBefore(nextDue) && !timer.ownerTaskOpen
    }

    override fun holdReviewDue(facts: OrderFacts): Boolean {
        val timer = facts.order.holdReview ?: return false
        val interval = effectiveInterval(facts.configuration.holdReviewInterval, facts.configuration)
        val previous = timer.previousReviewDueAt
        val nextDue =
            if (previous != null) {
                previous.plus(interval)
            } else {
                earlier(timer.heldAt.plus(interval), timer.issuerReviewAt)
            }
        return !facts.serverTime.isBefore(nextDue) && !timer.reviewTaskOpen
    }

    // ---- Completion

    override fun fulfilmentComplete(facts: OrderFacts): Boolean {
        val report = facts.fulfilment
        return when (facts.order.kind) {
            OrderKind.MEDICATION -> report.medication.let { it != null && medicationFulfilled(it, facts) }
            OrderKind.LABORATORY, OrderKind.IMAGING -> diagnosticFulfilled(report.diagnosticResults)
            else -> report.otherTasksDone == true
        }
    }

    // ---- Discontinue and replacement

    override fun reasonIsReplacement(facts: OrderFacts): Boolean = isReplacementReason(facts)

    override fun reasonIsNotReplacement(facts: OrderFacts): Boolean = !isReplacementReason(facts)

    override fun discontinueReasonEntered(facts: OrderFacts): Boolean =
        !isReplacementReason(facts) && stopReasonGiven(facts, facts.configuration.discontinueReasons - REPLACED_REASON)

    override fun replacingOrderSignedTogether(facts: OrderFacts): Boolean {
        val replacing = facts.replacingOrder ?: return false
        return replacing.replacesOrderId == facts.order.orderId && replacing.signedByCommandId == facts.commandId
    }

    // ---- Correction

    override fun privilegedAndAudited(facts: OrderFacts): Boolean {
        val privilege = facts.configuration.enteredInErrorPrivilege
        return privilege != null && privilege in facts.issuer.privileges && facts.auditWritable
    }

    override fun errorReasonEntered(facts: OrderFacts): Boolean = chosenFromList(facts.reason, facts.configuration.errorReasons)

    // ---- Shared rules (each the one place its rule lives)

    /** Losing the internet or the WAN alone leaves the on-site cell reachable: still online (SI-15 last sentence). */
    private val ONLINE_MODES = setOf(ConnectivityMode.ONLINE, ConnectivityMode.INTERNET_LOST, ConnectivityMode.WAN_LOST)

    /** The states from which an order can still be discontinued (order.yaml Discontinue transitions). */
    private val DISCONTINUABLE_STATES = setOf(OrderState.PENDING_VERIFICATION, OrderState.ACTIVE, OrderState.ON_HOLD)

    /** The result states that complete a diagnostic item (result.yaml). */
    private val COMPLETING_RESULTS = setOf(ResultState.FINAL, ResultState.AMENDED, ResultState.CORRECTED)

    private fun isMedication(facts: OrderFacts): Boolean = facts.order.kind == OrderKind.MEDICATION

    /** "pending or verified; absent for a non-medication order": anything else, an absent status on a medication order included, is returned. */
    private fun isReturned(facts: OrderFacts): Boolean {
        val status = facts.order.verificationStatus
        val notReturned =
            status == VerificationStatus.PENDING ||
                status == VerificationStatus.VERIFIED ||
                (status == null && !isMedication(facts))
        return !notReturned
    }

    private fun isVerifiedOrNotMedication(facts: OrderFacts): Boolean =
        !isMedication(facts) || facts.order.verificationStatus == VerificationStatus.VERIFIED

    private fun isReplacementReason(facts: OrderFacts): Boolean = facts.reason?.code == REPLACED_REASON

    /** The ordering practitioner of a command being signed: the source of a verbal order, otherwise the signer (the issuer). */
    private fun orderingPractitioner(facts: OrderFacts): Actor = facts.verbal?.source ?: facts.issuer

    /** The ordering practitioner of a signed order: the source of a verbal order, otherwise the user who signed it. */
    private fun orderingPractitionerId(facts: OrderFacts): String? =
        if (facts.verbal != null) facts.verbal.source.userId else facts.order.signerId

    /** ordererPrivileged's licence and privilege conditions for this orderable (§9.26). */
    private fun practitionerPrivileged(
        practitioner: Actor,
        facts: OrderFacts,
    ): Boolean {
        val privilege = facts.configuration.orderingPrivilege
        return privilege != null &&
            privilege in practitioner.privileges &&
            holdsValidLicence(practitioner, LicenceKind.PRACTITIONER, facts.serverTime)
    }

    /** A licence of [kind] whose known expiry is strictly after the server's time of the command. */
    private fun holdsValidLicence(
        actor: Actor,
        kind: LicenceKind,
        serverTime: Instant,
    ): Boolean = actor.licences.any { it.kind == kind && it.expiresAt != null && it.expiresAt.isAfter(serverTime) }

    private fun isCareTeamPrescriber(actor: Actor): Boolean = StaffRole.PRESCRIBER in actor.roles && actor.onPatientCareTeam

    /**
     * A human may stop when they hold the configured privilege; when the configuration is missing or names nobody, the
     * vendor-locked [baseline] applies. Licence expiry is never read (§9.26 blocks new orders, not stops).
     */
    private fun humanMayStop(
        actor: Actor,
        configured: StopPrivilege?,
        baseline: () -> Boolean,
    ): Boolean =
        if (configured != null && configured.grantedToAnyone) {
            configured.code in actor.privileges
        } else {
            baseline()
        }

    private fun registeredSystemMay(
        actor: Actor,
        registration: SystemRegistration,
    ): Boolean = actor.userId != null && actor.authenticatedForThisCommand && registration in actor.registrations

    /** mayDiscontinueOrder for [actor] with [configured] (also read for a replaced order, replacedOrderDiscontinuable). */
    private fun mayDiscontinue(
        actor: Actor,
        configured: StopPrivilege?,
    ): Boolean =
        when (actor.kind) {
            PrincipalKind.HUMAN -> humanMayStop(actor, configured) { isCareTeamPrescriber(actor) }
            PrincipalKind.SYSTEM, PrincipalKind.INTERFACE -> registeredSystemMay(actor, SystemRegistration.DISCONTINUE_ORDERS)
            PrincipalKind.SERVICE, PrincipalKind.AI_AGENT, PrincipalKind.MIGRATION_LOADER, null -> false
        }

    /**
     * SI-16 window (DN-026): within when the elapsed time from the change to the receipt is negative or at most the
     * window, inclusive. The window is the tenant's value, never less than 60 000 ms.
     */
    private fun changedWithinWindow(
        change: Instant,
        receipt: Instant,
        tenantWindow: Duration?,
    ): Boolean {
        val window = maxOf(tenantWindow ?: MINIMUM_REVERIFICATION_WINDOW, MINIMUM_REVERIFICATION_WINDOW)
        val elapsed = Duration.between(change, receipt)
        return elapsed.isNegative || elapsed <= window
    }

    private fun emergencyListedOrStat(facts: OrderFacts): Boolean =
        facts.order.priority == OrderPriority.STAT ||
            (isMedication(facts) && facts.order.formulary?.onEmergencyOverrideList == true)

    /**
     * A formulary flag of a medication order: an unknown flag (or no formulary entry) counts as set (DN-052 item 13).
     * Other order kinds are not formulary medicines and carry none of these flags.
     */
    private fun flagged(
        facts: OrderFacts,
        flag: (FormularyFlags) -> Boolean?,
    ): Boolean = isMedication(facts) && facts.order.formulary.let { it == null || flag(it) != false }

    private fun isAntimicrobial(facts: OrderFacts): Boolean = flagged(facts) { it.antimicrobial }

    private fun isRestrictedAntimicrobial(facts: OrderFacts): Boolean = isAntimicrobial(facts) && flagged(facts) { it.restricted }

    private fun hasIndication(facts: OrderFacts): Boolean = !facts.order.indication.isNullOrBlank()

    /** After the receipt time and no later than the receipt time plus the governed limit; time comparison only. */
    private fun coSignDueInLimit(
        verbal: VerbalOrder,
        limit: Duration?,
    ): Boolean {
        val received = verbal.receivedAt
        val due = verbal.coSignDueAt
        return received != null && due != null && limit != null && due.isAfter(received) && !due.isAfter(received.plus(limit))
    }

    /**
     * Control set A applies (§10.3 A.1) to every dose based on weight or body-surface area, every high-alert infusion and
     * every neonatal order; an unknown flag counts as applying. The Dose Engine is not active in any site of the MVP
     * (reg-dose is P2), so this reads no Dose Engine fact.
     */
    private fun controlSetAApplies(facts: OrderFacts): Boolean {
        val order = facts.order
        val weightOrAreaBased = order.doseBasis == DoseBasis.PER_BODY_WEIGHT || order.doseBasis == DoseBasis.PER_BODY_SURFACE_AREA
        val highAlertInfusion = order.infusion && flagged(facts) { it.highAlert }
        val neonatal = facts.patient.neonatal != false
        return isMedication(facts) && (weightOrAreaBased || highAlertInfusion || neonatal)
    }

    /**
     * The latest independent calculation recorded since the last submission (strictly after it; an unknown submission
     * time counts every calculation). Among calculations recorded at the same time, the one recorded later in the list.
     */
    private fun latestCalculation(facts: OrderFacts): IndependentDose? {
        val submitted = facts.order.lastSubmittedAt
        return facts.calculations
            .filter { submitted == null || it.recordedAt.isAfter(submitted) }
            .sortedBy { it.recordedAt }
            .lastOrNull()
    }

    /** §2.1 clause b: an exact comparison of every bound, value and UCUM unit; no conversion, no rounding. */
    private fun exactlyEquals(
        recorded: DoseAmount,
        ordered: DoseAmount,
    ): Boolean {
        val sameUpper =
            if (recorded.upper == null || ordered.upper == null) {
                recorded.upper == null && ordered.upper == null
            } else {
                recorded.upper.compareTo(ordered.upper) == 0
            }
        return recorded.unit == ordered.unit && recorded.lower.compareTo(ordered.lower) == 0 && sameUpper
    }

    /** A code from the governed [list], chosen by the user, never defaulted (§6.5). */
    private fun chosenFromList(
        reason: GivenReason?,
        list: Set<String>,
    ): Boolean = reason != null && reason.chosenByUser && reason.code != null && reason.code in list

    /**
     * A hold or discontinue reason: a chosen code from the governed list, or the always-offered "other" with free text;
     * a registered system or interface principal gives a system reason it is registered for.
     */
    private fun stopReasonGiven(
        facts: OrderFacts,
        list: Set<String>,
    ): Boolean {
        val reason = facts.reason
        val code = reason?.code
        if (reason == null || code == null) return false
        val systemPrincipal = facts.issuer.kind == PrincipalKind.SYSTEM || facts.issuer.kind == PrincipalKind.INTERFACE
        val userChose = reason.chosenByUser && (code in list || (code == OTHER_REASON && !reason.freeText.isNullOrBlank()))
        return if (systemPrincipal) code in facts.issuer.registeredSystemReasons else userChose
    }

    /** The tenant's interval when it is set and positive, otherwise the vendor default (never zero). */
    private fun effectiveInterval(
        tenant: Duration?,
        configuration: OrderConfiguration,
    ): Duration = if (tenant != null && tenant > Duration.ZERO) tenant else configuration.vendorDefaultReviewInterval

    private fun earlier(
        first: Instant,
        second: Instant?,
    ): Instant = if (second != null && second.isBefore(first)) second else first

    /**
     * The stop date has passed (for a once-only or fixed-count order, the due time of its last scheduled dose) and every
     * dose is terminal. An unknown stop time fails.
     */
    private fun medicationFulfilled(
        report: MedicationFulfilment,
        facts: OrderFacts,
    ): Boolean {
        val stop = if (report.onceOnlyOrFixedCount) report.lastScheduledDoseDueAt else facts.order.stopDate
        return stop != null && facts.serverTime.isAfter(stop) && report.doses.all { it == DoseProgress.TERMINAL }
    }

    /** Every requested item has a final, amended or corrected result; an unknown or empty report fails. */
    private fun diagnosticFulfilled(results: List<ResultState?>?): Boolean =
        !results.isNullOrEmpty() && results.all { it != null && it in COMPLETING_RESULTS }
}
