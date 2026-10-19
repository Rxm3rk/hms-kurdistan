package hms.rcm.domain.creditclaim

import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import kotlin.random.Random

// Facts generator for the credit-claim machine (WP-0.5 spec §2.3, §3.3; contracts §4). Synthetic data only (SYN-
// identifiers); amounts, governed lists and checklists are samples, NOT FOR CLINICAL USE, and the diagnosis code is a
// placeholder, never a real ICD-10 code. The machine is deep (nine successful steps from intimation to a reopened
// claim), so each part is good with a high probability and perturbed otherwise: every transition fires in 1,000
// sequences (P7), while refusals, unknowns, other currencies and boundary values stay common, and every predicate both
// holds and fails. A withdrawal reason is valid only rarely, so that few sequences end early in withdrawn.

private val NOW: Instant = Instant.parse("2026-03-10T09:00:00Z")
private val START: LocalDate = LocalDate.parse("2026-03-01")
private const val IQD = "IQD"
private const val USD = "USD"
private const val NO_REASON = "SYN-DED-NO-REASON-GIVEN"
private const val FX = "SYN-DED-OTHER-CURRENCY"
private const val ROOM_RENT = "SYN-DED-ROOM-RENT"
private const val DENIAL = "SYN-DEN-NOT-COVERED"
private const val EXCEPTION = "SYN-EXC-EMERGENCY-UPGRADE"
private const val WITHDRAWAL = "SYN-WDR-PATIENT-PAYS"
private const val SERVICE = "SYN-SVC-WARD-DAY"
private const val FINAL_REF = "SYN-PAYER-FA-0001"
private const val DESK_USER = "SYN-USR-DESK-01"
private const val LINE = "SYN-LINE-1"

// Probabilities (tuned for P7 at 1,000 sequences with a scratch simulation of the YAML).
private const val GOOD = 0.88
private const val HALF = 0.5
private const val DENIAL_GOOD = 0.3
private const val APPEAL_GOOD = 0.75
private const val WITHDRAWAL_GOOD = 0.12
private const val CORRECTION_GOOD = 0.8

private fun Random.chance(probability: Double): Boolean = nextDouble() < probability

private fun <T> Random.pick(options: List<T>): T = options[nextInt(options.size)]

private fun <T> Random.goodOr(
    good: T,
    probability: Double,
    variants: List<T>,
): T = if (chance(probability)) good else pick(variants)

/** The credit-claim machine's facts generator (synthetic, NOT FOR CLINICAL USE). */
@Suppress("MagicNumber", "TooManyFunctions") // The amounts and weights are the generator's tuning table (P7); one function per part.
object CreditClaimArbs {
    /** One decision's facts per draw, biased so that every credit-claim transition fires in 1,000 sequences. */
    val facts: Arb<CreditClaimFacts> = arbitrary { source -> draw(source.random) }

    private fun iqd(value: Long) = Money(BigDecimal.valueOf(value), IQD)

    private fun usd(value: Long) = Money(BigDecimal.valueOf(value), USD)

    private val checklist = DocumentChecklist(setOf("SYN-DOC-A", "SYN-DOC-B"), setOf("SYN-DOC-A", "SYN-DOC-B"))
    private val missingDocs = DocumentChecklist(setOf("SYN-DOC-A", "SYN-DOC-B"), setOf("SYN-DOC-A"))

    private val config =
        CreditClaimConfig(
            deductionReasons = setOf(NO_REASON, FX, ROOM_RENT),
            exchangeDifferenceReason = FX,
            denialReasons = setOf(DENIAL),
            exceptionReasons = setOf(EXCEPTION),
            withdrawalReasons = setOf(WITHDRAWAL),
        )

    /** Draws one world of facts from [random]. */
    fun draw(random: Random): CreditClaimFacts {
        val finalApproval = random.goodOr(goodFinal, GOOD, finalVariants)
        return CreditClaimFacts(
            now = NOW,
            config = config,
            claimCurrency = random.goodOr(IQD, GOOD + 0.1, listOf(USD, null)),
            episode = EpisodeFacts(random.goodOr(START, GOOD + 0.1, listOf(null)), encounterStatus(random)),
            coverage = random.goodOr(goodCoverage, GOOD, coverageVariants),
            preApprovalRequest = random.goodOr(goodPreApproval, GOOD, preApprovalVariants),
            raisedQuery = random.goodOr(PayerQueryFacts("SYN-PAYER-Q-0001", NOW.minusSeconds(60), 2), GOOD, queryVariants),
            openQuery = random.goodOr(goodOpenQuery, GOOD, openQueryVariants),
            currentQueryStage = random.pick(QueryStage.entries + QueryStage.entries + listOf(null)),
            approval = random.goodOr(goodApproval, GOOD, approvalVariants),
            approvedEnhancementCount = random.pick(listOf(0, 0, 1, 2)),
            enhancementRequest = random.goodOr(goodEnhancement, GOOD, enhancementVariants),
            dischargeAuthRequest = random.goodOr(goodDischargeAuth, GOOD, dischargeAuthVariants),
            lines = random.goodOr(listOf(goodLine), GOOD, lineVariants),
            finalApproval = finalApproval,
            claimPack = random.goodOr(ClaimPackFacts(FINAL_REF, checklist), GOOD + 0.05, packVariants),
            settlement = settlement(random),
            denial = random.goodOr(goodDenial, DENIAL_GOOD, denialVariants),
            appeal = random.goodOr(goodAppeal, APPEAL_GOOD, appealVariants),
            appealDeadline = random.pick(deadlines),
            payerBucketBalance = random.goodOr(iqd(0), GOOD, listOf(iqd(1), usd(0), null)),
            withdrawal = random.goodOr(WithdrawalFacts(WITHDRAWAL, ReasonOrigin.USER), WITHDRAWAL_GOOD, withdrawalVariants),
            correction = random.goodOr(goodCorrection, CORRECTION_GOOD, correctionVariants),
        )
    }

    private val deadlines = listOf(null, null, NOW.plus(Duration.ofDays(30)), NOW.plus(Duration.ofDays(30)), NOW, NOW.minusSeconds(1))

    private fun encounterStatus(random: Random): EncounterStatus? =
        if (random.chance(GOOD)) {
            random.pick(listOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED))
        } else {
            random.pick(EncounterStatus.entries + listOf(null))
        }

    private val goodCoverage =
        CoverageFacts(
            contractActiveFrom = START.minusDays(100),
            contractActiveTo = null,
            contractSuspended = false,
            letterCaptured = true,
            letterValidFrom = START,
            letterValidTo = START.plusDays(20),
        )

    private val coverageVariants =
        listOf(
            goodCoverage.copy(contractSuspended = true),
            goodCoverage.copy(letterCaptured = false),
            goodCoverage.copy(letterValidTo = START.minusDays(1)),
            goodCoverage.copy(contractActiveTo = START),
            null,
        )

    private val goodPreApproval =
        PreApprovalRequestFacts(
            diagnosisCode = "SYN-DX-PLACEHOLDER",
            diagnosisValidForStartDate = true,
            procedureCode = "SYN-PROC-0001",
            procedureInCatalogue = true,
            estimate = iqd(900_000),
            roomCategory = "SYN-ROOM-STANDARD",
            documents = checklist,
        )

    private val preApprovalVariants =
        listOf(
            goodPreApproval.copy(diagnosisValidForStartDate = null),
            goodPreApproval.copy(procedureInCatalogue = false),
            goodPreApproval.copy(estimate = null),
            goodPreApproval.copy(documents = missingDocs),
            null,
        )

    private val queryVariants =
        listOf(
            PayerQueryFacts("SYN-PAYER-Q-0001", NOW, 0),
            PayerQueryFacts(null, NOW, 1),
            PayerQueryFacts("SYN-PAYER-Q-0001", null, 1),
            null,
        )

    private val goodOpenQuery = OpenQueryFacts(listOf(QueryItemFacts("synthetic answer", null)), DESK_USER, true)

    private val openQueryVariants =
        listOf(
            goodOpenQuery.copy(items = listOf(QueryItemFacts(null, null))),
            goodOpenQuery.copy(responderAuthenticatedDeskUser = false),
            goodOpenQuery.copy(items = emptyList()),
            null,
        )

    private val goodApproval =
        ApprovalTermsFacts(
            payerReference = "SYN-PAYER-PA-0001",
            approvedAmount = iqd(1_000_000),
            roomRentCap = ApprovalTerm("SYN-ROOM-STANDARD", false),
            coPay = ApprovalTerm(null, true),
            subLimits = ApprovalTerm(null, true),
            validFrom = START,
            validTo = START.plusDays(14),
            approvedUnits = mapOf(SERVICE to 5),
        )

    private val approvalVariants =
        listOf(
            goodApproval.copy(coPay = ApprovalTerm(null, false)),
            goodApproval.copy(validFrom = START.plusDays(30)),
            goodApproval.copy(approvedUnits = emptyMap()),
            goodApproval.copy(approvedAmount = null),
            null,
        )

    private val goodEnhancement = EnhancementRequestFacts(iqd(1_200_000), "longer stay", checklist)

    private val enhancementVariants =
        listOf(
            goodEnhancement.copy(revisedEstimate = iqd(1_000_000)),
            goodEnhancement.copy(revisedEstimate = usd(2_000_000)),
            goodEnhancement.copy(reason = null),
            null,
        )

    private val goodDischargeAuth =
        DischargeAuthRequestFacts(
            finalBillReference = "SYN-BILL-0001",
            dischargeSummaryReference = "SYN-DOCREF-0001",
            dischargeSummarySigned = true,
            episodeInvestigations = setOf("SYN-RES-1"),
            referencedInvestigations = setOf("SYN-RES-1"),
            investigationsRecordedAsNone = false,
            pharmacyReturnsProcessed = true,
            pharmacyReturnsRecordedAsNone = false,
            amountRequested = iqd(950_000),
            documents = checklist,
        )

    private val dischargeAuthVariants =
        listOf(
            goodDischargeAuth.copy(dischargeSummarySigned = null),
            goodDischargeAuth.copy(referencedInvestigations = emptySet()),
            goodDischargeAuth.copy(pharmacyReturnsProcessed = false),
            goodDischargeAuth.copy(finalBillReference = null),
            null,
        )

    private val goodLine = ClaimLineFacts(LINE, SERVICE, START.plusDays(1), 3, null, LineDisposition.PAID_BY_PAYER)
    private val flagged = FlaggedException(LINE, EXCEPTION, ReasonOrigin.USER, DESK_USER, true)

    private val lineVariants =
        listOf(
            listOf(goodLine.copy(serviceCode = "SYN-SVC-OTHER")),
            listOf(goodLine.copy(serviceCode = "SYN-SVC-OTHER", exception = flagged)),
            listOf(goodLine.copy(units = 6)),
            listOf(goodLine.copy(serviceDate = START.plusDays(15), exception = flagged.copy(reasonOrigin = ReasonOrigin.DEFAULTED))),
            listOf(goodLine.copy(disposition = null)),
        )

    private val goodFinal =
        FinalApprovalFacts(FINAL_REF, iqd(800_000), listOf(FinalDeduction(ROOM_RENT, iqd(50_000))), iqd(100_000))

    private val finalVariants =
        listOf(
            goodFinal.copy(payerPayable = usd(800)),
            goodFinal.copy(deductions = listOf(FinalDeduction("SYN-DED-UNKNOWN", iqd(1)))),
            goodFinal.copy(payerReference = null),
            null,
        )

    private val packVariants = listOf(ClaimPackFacts("SYN-PAYER-FA-0002", checklist), ClaimPackFacts(FINAL_REF, missingDocs), null)

    private fun settlement(random: Random): SettlementFacts? {
        val total = random.pick(listOf(iqd(800_000), iqd(800_001), iqd(799_999), iqd(600_000), usd(600)))
        val deductions =
            when {
                random.chance(HALF) -> listOf(SettlementDeduction(NO_REASON, ReasonOrigin.USER), SettlementDeduction(FX, ReasonOrigin.USER))
                random.chance(GOOD) -> listOf(SettlementDeduction(ROOM_RENT, ReasonOrigin.USER))
                else -> random.pick(listOf(emptyList(), listOf(SettlementDeduction(NO_REASON, ReasonOrigin.DEFAULTED))))
            }
        val good = SettlementFacts("SYN-PAY-0001", START.plusDays(30), total, deductions)
        return random.goodOr(good, GOOD + 0.05, listOf(good.copy(paymentReference = null), good.copy(totalSettled = null), null))
    }

    private val goodDenial = DenialFacts("SYN-PAYER-D-0001", listOf(DenialReason(DENIAL, DenialRootCause.AUTHORISATION, ReasonOrigin.USER)))

    private val denialVariants =
        listOf(
            goodDenial.copy(reasons = emptyList()),
            goodDenial.copy(reasons = listOf(DenialReason(DENIAL, null, ReasonOrigin.USER))),
            goodDenial.copy(reasons = listOf(DenialReason("SYN-DEN-X", DenialRootCause.CODING, ReasonOrigin.USER))),
            goodDenial.copy(reasons = listOf(DenialReason(DENIAL, DenialRootCause.CODING, ReasonOrigin.DEFAULTED))),
            null,
        )

    private val goodAppeal = AppealFacts("SYN-APL-TPL-1", "synthetic grounds", setOf(LINE), iqd(50_000), setOf("SYN-DOC-E"))

    private val appealVariants =
        listOf(
            goodAppeal.copy(templateId = null),
            goodAppeal.copy(appealedItems = emptySet()),
            goodAppeal.copy(amountAppealed = null),
            null,
        )

    private val withdrawalVariants =
        listOf(
            WithdrawalFacts(WITHDRAWAL, ReasonOrigin.DEFAULTED),
            WithdrawalFacts("SYN-WDR-X", ReasonOrigin.USER),
            WithdrawalFacts(null, null),
            null,
        )

    private val goodCorrection = CorrectionFacts(true, true, "synthetic correction reason", ReasonOrigin.USER)

    private val correctionVariants =
        listOf(
            goodCorrection.copy(holdsCorrectionPrivilege = false),
            goodCorrection.copy(auditWritable = false),
            goodCorrection.copy(reason = " "),
            goodCorrection.copy(reasonOrigin = ReasonOrigin.PREFILLED),
            null,
        )
}
