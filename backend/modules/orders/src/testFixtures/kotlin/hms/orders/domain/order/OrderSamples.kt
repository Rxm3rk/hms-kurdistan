package hms.orders.domain.order

import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

// Synthetic sample facts for the order machine (docs/specs/state-machines/order.yaml). NOT FOR CLINICAL USE: every
// identifier is a SYN- value, every privilege, reason and unit code is synthetic, and every interval and dose is an
// arbitrary test value, never governed content (BUILD-PROMPT §3.4 item 3, §3.5).

private const val LICENCE_DAYS = 365L
private const val DRAFT_AGE_HOURS = 2L
private const val HOLD_AGE_HOURS = 3L
private const val STOPPED_MINUTES_AGO = 10L
private const val CONTEXT_CHANGED_MINUTES_AGO = 10L
private const val VERBAL_RECEIVED_MINUTES_AGO = 5L
private const val CO_SIGN_LIMIT_HOURS = 24L
private const val PREBUILD_INTERVAL_MINUTES = 30L
private const val VENDOR_DEFAULT_HOURS = 4L
private const val ORDERED_DOSE = "5"

/**
 * Synthetic order facts in which every guard predicate of order.yaml that does not conflict with another holds (NOT FOR
 * CLINICAL USE). The exact-complement predicates take the values the arguments choose. The unit tests and OrderArbs
 * start from [clean] and change one thing at a time.
 */
object OrderSamples {
    /** The server's clock reading of every sample. */
    val NOW: Instant = Instant.parse("2030-01-01T12:00:00Z")

    /** The issuer of the sample command: a clinician who holds every synthetic privilege. */
    const val ISSUER: String = "SYN-USR-ISSUER"

    /** The user who created the sample draft. */
    const val AUTHOR: String = "SYN-USR-AUTHOR"

    /** The user who signed the sample order. */
    const val SIGNER: String = "SYN-USR-SIGNER"

    /** The pharmacist who last returned the sample order. */
    const val RETURNER: String = "SYN-USR-RETURNER"

    /** A verbal order's source practitioner. */
    const val SOURCE: String = "SYN-USR-SOURCE"

    /** A verbal order's receiving user. */
    const val RECEIVER: String = "SYN-USR-RECEIVER"

    /** A co-signer. */
    const val COSIGNER: String = "SYN-USR-COSIGNER"

    /** A stewardship approver. */
    const val APPROVER: String = "SYN-USR-APPROVER"

    /** Another user, for "someone else" cases. */
    const val OTHER_USER: String = "SYN-USR-OTHER"

    /** A registered system principal. */
    const val SYSTEM_PRINCIPAL: String = "SYN-SYS-ADT"

    /** The sample order. */
    const val ORDER_ID: String = "SYN-ORD-0001"

    /** The sample command. */
    const val COMMAND_ID: String = "SYN-CMD-0001"

    /** Synthetic privilege codes. */
    const val PRIV_ORDER: String = "SYN-PRIV-ORDER"

    /** Synthetic privilege code required by the command (actorPrivileged). */
    const val PRIV_COMMAND: String = "SYN-PRIV-COMMAND"

    /** Synthetic hold privilege code. */
    const val PRIV_HOLD: String = "SYN-PRIV-HOLD"

    /** Synthetic discontinue privilege code. */
    const val PRIV_DISCONTINUE: String = "SYN-PRIV-DISCONTINUE"

    /** Synthetic pharmacist verification privilege code. */
    const val PRIV_VERIFY: String = "SYN-PRIV-VERIFY"

    /** Synthetic entered-in-error privilege code. */
    const val PRIV_ERROR: String = "SYN-PRIV-ERROR"

    /** Synthetic verbal-order receipt privilege code. */
    const val PRIV_VERBAL: String = "SYN-PRIV-VERBAL"

    /** A synthetic reason code on every governed reason list. */
    const val REASON: String = "SYN-REASON-01"

    /** A synthetic reason code on no list. */
    const val UNLISTED_REASON: String = "SYN-REASON-99"

    /** A synthetic system reason a registered system principal gives. */
    const val SYSTEM_REASON: String = "SYN-SYSREASON-01"

    /** A synthetic dose unit. */
    const val UNIT: String = "SYN-UNIT-A"

    /** Another synthetic dose unit. */
    const val OTHER_UNIT: String = "SYN-UNIT-B"

    /** The sample prescriber-entered dose (synthetic). */
    val ORDERED: DoseAmount = DoseAmount(BigDecimal(ORDERED_DOSE), null, UNIT)

    /** Every synthetic privilege code. */
    val ALL_PRIVILEGES: Set<String> = setOf(PRIV_ORDER, PRIV_COMMAND, PRIV_HOLD, PRIV_DISCONTINUE, PRIV_VERIFY, PRIV_ERROR, PRIV_VERBAL)

    /** A licence of [kind] valid well past [NOW]. */
    fun validLicence(kind: LicenceKind): Licence = Licence(kind, NOW.plus(Duration.ofDays(LICENCE_DAYS)))

    /** A human clinician with every synthetic privilege, prescriber and pharmacist licences, on the care team. */
    fun clinician(userId: String = ISSUER): Actor =
        Actor(
            userId = userId,
            kind = PrincipalKind.HUMAN,
            authenticatedForThisCommand = true,
            licences = listOf(validLicence(LicenceKind.PRACTITIONER), validLicence(LicenceKind.PHARMACIST)),
            privileges = ALL_PRIVILEGES,
            roles = setOf(StaffRole.PRESCRIBER, StaffRole.PHARMACIST),
            onPatientCareTeam = true,
            registrations = emptySet(),
            registeredSystemReasons = emptySet(),
        )

    /** A registered system principal (for example ADT), authenticated as itself, registered to hold and discontinue. */
    fun systemPrincipal(): Actor =
        Actor(
            userId = SYSTEM_PRINCIPAL,
            kind = PrincipalKind.SYSTEM,
            authenticatedForThisCommand = true,
            licences = emptyList(),
            privileges = emptySet(),
            roles = emptySet(),
            onPatientCareTeam = false,
            registrations = setOf(SystemRegistration.HOLD_ORDERS, SystemRegistration.DISCONTINUE_ORDERS),
            registeredSystemReasons = setOf(SYSTEM_REASON),
        )

    /** A documented verbal order from [SOURCE], received by [RECEIVER], co-sign due within the limit. */
    fun verbalOrder(): VerbalOrder {
        val received = NOW.minus(Duration.ofMinutes(VERBAL_RECEIVED_MINUTES_AGO))
        return VerbalOrder(
            source = clinician(SOURCE),
            receiver = clinician(RECEIVER),
            situationAllowed = true,
            receivedAt = received,
            readBack = ReadBack(SOURCE, RECEIVER, received),
            coSignDueAt = received.plus(Duration.ofHours(1)),
        )
    }

    /** The synthetic governed configuration: every privilege named, every reason list holding [REASON]. */
    fun configuration(): OrderConfiguration =
        OrderConfiguration(
            orderingPrivilege = PRIV_ORDER,
            commandRequirement = CommandRequirement(PRIV_COMMAND, LicenceKind.PRACTITIONER),
            holdPrivilege = StopPrivilege(PRIV_HOLD, grantedToAnyone = true),
            discontinuePrivilege = StopPrivilege(PRIV_DISCONTINUE, grantedToAnyone = true),
            verificationPrivilege = PRIV_VERIFY,
            enteredInErrorPrivilege = PRIV_ERROR,
            verbalReceiptPrivilege = PRIV_VERBAL,
            coSignLimit = Duration.ofHours(CO_SIGN_LIMIT_HOURS),
            offlineModesWithFullCds = emptySet(),
            holdReasons = setOf(REASON),
            discontinueReasons = setOf(REASON),
            returnReasons = setOf(REASON),
            responseReasons = setOf(REASON),
            errorReasons = setOf(REASON),
            draftReviewInterval = Duration.ofHours(1),
            prebuildReviewInterval = Duration.ofMinutes(PREBUILD_INTERVAL_MINUTES),
            holdReviewInterval = Duration.ofHours(1),
            vendorDefaultReviewInterval = Duration.ofHours(VENDOR_DEFAULT_HOURS),
        )

    /** A clean order of [kind]; a medication order carries [status] (other kinds none). */
    fun order(
        kind: OrderKind = OrderKind.MEDICATION,
        status: VerificationStatus = VerificationStatus.PENDING,
    ): OrderRecord {
        val medication = kind == OrderKind.MEDICATION
        return OrderRecord(
            orderId = ORDER_ID,
            kind = kind,
            priority = OrderPriority.ROUTINE,
            createdAt = NOW.minus(Duration.ofHours(DRAFT_AGE_HOURS)),
            createdBy = AUTHOR,
            prebuild = false,
            signerId = SIGNER,
            verificationStatus = if (medication) status else null,
            returnedBy = RETURNER,
            lastSubmittedAt = NOW.minus(Duration.ofHours(1)),
            formulary = FormularyFlags(false, false, false, false, false),
            doseBasis = if (medication) DoseBasis.ABSOLUTE else DoseBasis.NOT_DOSED,
            orderedDose = if (medication) ORDERED else null,
            infusion = false,
            prn = false,
            indication = "SYN-INDICATION",
            stopDate = NOW.minus(Duration.ofMinutes(STOPPED_MINUTES_AGO)),
            reviewDate = null,
            replaces = null,
            draftReview = DraftReviewTimer(previousReviewDueAt = null, ownerTaskOpen = false),
            holdReview = HoldReviewTimer(NOW.minus(Duration.ofHours(HOLD_AGE_HOURS)), null, null, reviewTaskOpen = false),
        )
    }

    /** An independent calculation recorded by [ISSUER] after the last submission, equal to [ORDERED] and attested. */
    fun matchingCalculation(): IndependentDose = IndependentDose(ISSUER, NOW.minus(Duration.ofMinutes(1)), ORDERED, attestedMatches = true)

    /** Clean facts for an order of [kind] with verification [status], issued by [clinician]. */
    fun clean(
        kind: OrderKind = OrderKind.MEDICATION,
        status: VerificationStatus = VerificationStatus.PENDING,
    ): OrderFacts =
        OrderFacts(
            commandId = COMMAND_ID,
            serverTime = NOW,
            issuer = clinician(),
            order = order(kind, status),
            patient = PatientFacts(DosingWeight(NOW.minus(Duration.ofDays(1)), WeightSource.MEASURED), neonatal = false),
            verbal = null,
            identity = IdentityContext(NOW.minus(Duration.ofMinutes(CONTEXT_CHANGED_MINUTES_AGO)), null, emptyList()),
            issuedInMode = ConnectivityMode.ONLINE,
            cds =
                CdsEvaluation(
                    localRules = listOf(LocalRuleOutcome.NOT_FIRED),
                    kbDoseCheck = KbDoseCheck(covered = true, answer = KbAnswer(UNIT, withinTimeBudget = true, tierAHardStopFired = false)),
                    tierBAlerts = emptyList(),
                    gaps = emptyList(),
                ),
            calculations = emptyList(),
            coSign = CoSign(requiredBeforeActivation = false, coSignature = null),
            antimicrobialApprover = null,
            reason = GivenReason(REASON, null, chosenByUser = true),
            replacingOrder = ReplacingOrder(ORDER_ID, COMMAND_ID),
            fulfilment =
                FulfilmentReport(
                    medication = MedicationFulfilment(false, null, listOf(DoseProgress.TERMINAL)),
                    diagnosticResults = listOf(ResultState.FINAL),
                    otherTasksDone = true,
                ),
            configuration = configuration(),
            auditWritable = true,
        )
}
