package hms.rcm.domain.creditclaim

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import java.time.LocalDate

// Unit tests of every credit-claim predicate (docs/specs/state-machines/credit-claim.yaml; WP-0.5 spec §2.1 rule 12).
// Synthetic data only (SYN- identifiers); amounts, governed lists and checklists are samples, NOT FOR CLINICAL USE.
// The diagnosis code is a placeholder string, never a real ICD-10 code: its validity is terminology's answer.

private val NOW: Instant = Instant.parse("2026-03-10T09:00:00Z")
private val START: LocalDate = LocalDate.parse("2026-03-01")
private const val IQD = "IQD"
private const val USD = "USD"
private const val NO_REASON = "SYN-DED-NO-REASON-GIVEN"
private const val FX = "SYN-DED-OTHER-CURRENCY"
private const val ROOM_RENT = "SYN-DED-ROOM-RENT"
private const val SERVICE = "SYN-SVC-WARD-DAY"
private const val FINAL_REF = "SYN-PAYER-FA-0001"

private fun iqd(value: Long) = Money(BigDecimal.valueOf(value), IQD)

private fun usd(value: Long) = Money(BigDecimal.valueOf(value), USD)

private val checklist =
    DocumentChecklist(mandatory = setOf("SYN-DOC-A", "SYN-DOC-B"), attached = setOf("SYN-DOC-A", "SYN-DOC-B", "SYN-DOC-C"))

private val config =
    CreditClaimConfig(
        deductionReasons = setOf(NO_REASON, FX, ROOM_RENT),
        exchangeDifferenceReason = FX,
        denialReasons = setOf("SYN-DEN-NOT-COVERED"),
        exceptionReasons = setOf("SYN-EXC-EMERGENCY-UPGRADE"),
        withdrawalReasons = setOf("SYN-WDR-PATIENT-PAYS"),
    )

private val approval =
    ApprovalTermsFacts(
        payerReference = "SYN-PAYER-PA-0001",
        approvedAmount = iqd(1_000_000),
        roomRentCap = ApprovalTerm("SYN-ROOM-STANDARD", explicitlyNone = false),
        coPay = ApprovalTerm(null, explicitlyNone = true),
        subLimits = ApprovalTerm(null, explicitlyNone = true),
        validFrom = START,
        validTo = START.plusDays(14),
        approvedUnits = mapOf(SERVICE to 5),
    )

private val line =
    ClaimLineFacts("SYN-LINE-1", SERVICE, START.plusDays(1), units = 3, exception = null, disposition = LineDisposition.PAID_BY_PAYER)

private val base =
    CreditClaimFacts(
        now = NOW,
        config = config,
        claimCurrency = IQD,
        episode = EpisodeFacts(START, EncounterStatus.DISCHARGED_NOT_CLOSED),
        coverage =
            CoverageFacts(
                contractActiveFrom = START.minusDays(100),
                contractActiveTo = null,
                contractSuspended = false,
                letterCaptured = true,
                letterValidFrom = START.minusDays(10),
                letterValidTo = START.plusDays(20),
            ),
        preApprovalRequest =
            PreApprovalRequestFacts(
                diagnosisCode = "SYN-DX-PLACEHOLDER",
                diagnosisValidForStartDate = true,
                procedureCode = "SYN-PROC-0001",
                procedureInCatalogue = true,
                estimate = iqd(900_000),
                roomCategory = "SYN-ROOM-STANDARD",
                documents = checklist,
            ),
        raisedQuery = PayerQueryFacts("SYN-PAYER-Q-0001", NOW.minusSeconds(60), itemCount = 2),
        openQuery =
            OpenQueryFacts(
                items = listOf(QueryItemFacts("synthetic answer", null), QueryItemFacts(null, "SYN-DOC-D")),
                responderId = "SYN-USR-DESK-01",
                responderAuthenticatedDeskUser = true,
            ),
        currentQueryStage = QueryStage.PRE_APPROVAL,
        approval = approval,
        approvedEnhancementCount = 0,
        enhancementRequest = EnhancementRequestFacts(iqd(1_200_000), "longer stay", checklist),
        dischargeAuthRequest =
            DischargeAuthRequestFacts(
                finalBillReference = "SYN-BILL-0001",
                dischargeSummaryReference = "SYN-DOCREF-0001",
                dischargeSummarySigned = true,
                episodeInvestigations = setOf("SYN-RES-1", "SYN-RES-2"),
                referencedInvestigations = setOf("SYN-RES-1", "SYN-RES-2"),
                investigationsRecordedAsNone = false,
                pharmacyReturnsProcessed = true,
                pharmacyReturnsRecordedAsNone = false,
                amountRequested = iqd(950_000),
                documents = checklist,
            ),
        lines = listOf(line),
        finalApproval =
            FinalApprovalFacts(
                payerReference = FINAL_REF,
                payerPayable = iqd(800_000),
                deductions = listOf(FinalDeduction(ROOM_RENT, iqd(50_000))),
                patientPayable = iqd(100_000),
            ),
        claimPack = ClaimPackFacts(FINAL_REF, checklist),
        settlement =
            SettlementFacts("SYN-PAY-0001", START.plusDays(30), iqd(800_000), listOf(SettlementDeduction(NO_REASON, ReasonOrigin.USER))),
        denial =
            DenialFacts("SYN-PAYER-D-0001", listOf(DenialReason("SYN-DEN-NOT-COVERED", DenialRootCause.ELIGIBILITY, ReasonOrigin.USER))),
        appeal =
            AppealFacts("SYN-APL-TPL-1", "the deduction contradicts the contract", setOf("SYN-LINE-1"), iqd(50_000), setOf("SYN-DOC-E")),
        appealDeadline = NOW.plus(Duration.ofDays(30)),
        payerBucketBalance = iqd(0),
        withdrawal = WithdrawalFacts("SYN-WDR-PATIENT-PAYS", ReasonOrigin.USER),
        correction =
            CorrectionFacts(holdsCorrectionPrivilege = true, auditWritable = true, reason = "late", reasonOrigin = ReasonOrigin.USER),
    )

private val guards = CreditClaimGuards

private fun CreditClaimFacts.withCoverage(transform: CoverageFacts.() -> CoverageFacts) = copy(coverage = coverage?.transform())

private fun CreditClaimFacts.withPreApproval(transform: PreApprovalRequestFacts.() -> PreApprovalRequestFacts) =
    copy(preApprovalRequest = preApprovalRequest?.transform())

private fun CreditClaimFacts.withApproval(transform: ApprovalTermsFacts.() -> ApprovalTermsFacts) = copy(approval = approval?.transform())

private fun CreditClaimFacts.withDischargeAuth(transform: DischargeAuthRequestFacts.() -> DischargeAuthRequestFacts) =
    copy(dischargeAuthRequest = dischargeAuthRequest?.transform())

private fun CreditClaimFacts.withSettlement(transform: SettlementFacts.() -> SettlementFacts) = copy(settlement = settlement?.transform())

private fun CreditClaimFacts.withFinal(transform: FinalApprovalFacts.() -> FinalApprovalFacts) =
    copy(finalApproval = finalApproval?.transform())

private val missingDocs = DocumentChecklist(mandatory = setOf("SYN-DOC-A", "SYN-DOC-B"), attached = setOf("SYN-DOC-A"))

private val exception =
    FlaggedException("SYN-LINE-1", "SYN-EXC-EMERGENCY-UPGRADE", ReasonOrigin.USER, "SYN-USR-DESK-01", flaggedByAuthenticated = true)

class CreditClaimGuardsTest :
    FunSpec({
        // ---- coverageActive
        test("coverageActive holds for an active open-ended contract and a captured letter valid on the start date") {
            guards.coverageActive(base) shouldBe true
        }
        test("coverageActive letter boundaries: valid-from and valid-to are included, a day outside fails") {
            guards.coverageActive(base.withCoverage { copy(letterValidFrom = START, letterValidTo = START) }) shouldBe true
            guards.coverageActive(base.withCoverage { copy(letterValidFrom = START.plusDays(1)) }) shouldBe false
            guards.coverageActive(base.withCoverage { copy(letterValidTo = START.minusDays(1)) }) shouldBe false
        }
        test("coverageActive contract boundaries: the first and last active dates are included") {
            guards.coverageActive(base.withCoverage { copy(contractActiveFrom = START, contractActiveTo = START) }) shouldBe true
            guards.coverageActive(base.withCoverage { copy(contractActiveFrom = START.plusDays(1)) }) shouldBe false
            guards.coverageActive(base.withCoverage { copy(contractActiveTo = START.minusDays(1)) }) shouldBe false
        }
        test("coverageActive fails for a suspended contract, no letter, unknown dates or no coverage") {
            guards.coverageActive(base.withCoverage { copy(contractSuspended = true) }) shouldBe false
            guards.coverageActive(base.withCoverage { copy(letterCaptured = false) }) shouldBe false
            guards.coverageActive(base.withCoverage { copy(contractActiveFrom = null) }) shouldBe false
            guards.coverageActive(base.withCoverage { copy(letterValidTo = null) }) shouldBe false
            guards.coverageActive(base.copy(episode = EpisodeFacts(null, EncounterStatus.ARRIVED))) shouldBe false
            guards.coverageActive(base.copy(coverage = null)) shouldBe false
        }

        // ---- preApprovalRequestComplete
        test("preApprovalRequestComplete holds for a complete request") { guards.preApprovalRequestComplete(base) shouldBe true }
        test("preApprovalRequestComplete fails when terminology does not report the diagnosis valid, or it is missing") {
            guards.preApprovalRequestComplete(base.withPreApproval { copy(diagnosisValidForStartDate = false) }) shouldBe false
            guards.preApprovalRequestComplete(base.withPreApproval { copy(diagnosisValidForStartDate = null) }) shouldBe false
            guards.preApprovalRequestComplete(base.withPreApproval { copy(diagnosisCode = " ") }) shouldBe false
        }
        test("preApprovalRequestComplete fails without a catalogue procedure, an estimate, a room category or a mandatory document") {
            guards.preApprovalRequestComplete(base.withPreApproval { copy(procedureInCatalogue = null) }) shouldBe false
            guards.preApprovalRequestComplete(base.withPreApproval { copy(procedureCode = null) }) shouldBe false
            guards.preApprovalRequestComplete(base.withPreApproval { copy(estimate = null) }) shouldBe false
            guards.preApprovalRequestComplete(base.withPreApproval { copy(estimate = Money(BigDecimal.TEN, " ")) }) shouldBe false
            guards.preApprovalRequestComplete(base.withPreApproval { copy(roomCategory = null) }) shouldBe false
            guards.preApprovalRequestComplete(base.withPreApproval { copy(documents = missingDocs) }) shouldBe false
            guards.preApprovalRequestComplete(base.copy(preApprovalRequest = null)) shouldBe false
        }

        // ---- payerQueryRecorded
        test("payerQueryRecorded holds for a query with a reference, a received instant and an item") {
            guards.payerQueryRecorded(base) shouldBe true
        }
        test("payerQueryRecorded fails with no item, no reference or no received instant") {
            guards.payerQueryRecorded(base.copy(raisedQuery = base.raisedQuery?.copy(itemCount = 0))) shouldBe false
            guards.payerQueryRecorded(base.copy(raisedQuery = base.raisedQuery?.copy(payerReference = ""))) shouldBe false
            guards.payerQueryRecorded(base.copy(raisedQuery = base.raisedQuery?.copy(receivedAt = null))) shouldBe false
            guards.payerQueryRecorded(base.copy(raisedQuery = null)) shouldBe false
        }

        // ---- queryResponseComplete
        test("queryResponseComplete holds when every item has an answer or a document from an authenticated desk user") {
            guards.queryResponseComplete(base) shouldBe true
        }
        test("queryResponseComplete fails for an unanswered item, an unauthenticated responder, or no item at all") {
            val open = checkNotNull(base.openQuery)
            guards.queryResponseComplete(base.copy(openQuery = open.copy(items = open.items + QueryItemFacts(" ", null)))) shouldBe false
            guards.queryResponseComplete(base.copy(openQuery = open.copy(responderAuthenticatedDeskUser = false))) shouldBe false
            guards.queryResponseComplete(base.copy(openQuery = open.copy(responderId = null))) shouldBe false
            guards.queryResponseComplete(base.copy(openQuery = open.copy(items = emptyList()))) shouldBe false
            guards.queryResponseComplete(base.copy(openQuery = null)) shouldBe false
        }

        // ---- queryOnPreApproval / queryOnEnhancement / queryOnDischargeAuth / queryOnClaim / queryNotOnClaim
        test("queryOnPreApproval, queryOnEnhancement, queryOnDischargeAuth and queryOnClaim partition the current query stage") {
            QueryStage.entries.forEach { stage ->
                val facts = base.copy(currentQueryStage = stage)
                guards.queryOnPreApproval(facts) shouldBe (stage == QueryStage.PRE_APPROVAL)
                guards.queryOnEnhancement(facts) shouldBe (stage == QueryStage.ENHANCEMENT)
                guards.queryOnDischargeAuth(facts) shouldBe (stage == QueryStage.DISCHARGE_AUTH)
                guards.queryOnClaim(facts) shouldBe (stage == QueryStage.CLAIM)
            }
        }
        test("queryOnPreApproval, queryOnEnhancement, queryOnDischargeAuth and queryOnClaim all fail when there was no query") {
            val none = base.copy(currentQueryStage = null)
            guards.queryOnPreApproval(none) shouldBe false
            guards.queryOnEnhancement(none) shouldBe false
            guards.queryOnDischargeAuth(none) shouldBe false
            guards.queryOnClaim(none) shouldBe false
        }
        test("queryNotOnClaim is the exact complement of queryOnClaim for every stage and none") {
            (QueryStage.entries + listOf(null)).forEach { stage ->
                val facts = base.copy(currentQueryStage = stage)
                guards.queryNotOnClaim(facts) shouldBe !guards.queryOnClaim(facts)
            }
            guards.queryNotOnClaim(base.copy(currentQueryStage = QueryStage.CLAIM)) shouldBe false
            guards.queryNotOnClaim(base.copy(currentQueryStage = QueryStage.ENHANCEMENT)) shouldBe true
        }

        // ---- approvalTermsRecorded
        test("approvalTermsRecorded holds for recorded terms, with 'none' recorded explicitly") {
            guards.approvalTermsRecorded(base) shouldBe true
        }
        test("approvalTermsRecorded holds for a partial approval (an approved amount below the request)") {
            guards.approvalTermsRecorded(base.withApproval { copy(approvedAmount = iqd(1)) }) shouldBe true
        }
        test("approvalTermsRecorded fails for an unrecorded term, no amount, inverted validity, or no approved service") {
            guards.approvalTermsRecorded(base.withApproval { copy(coPay = ApprovalTerm(null, explicitlyNone = false)) }) shouldBe false
            guards.approvalTermsRecorded(base.withApproval { copy(subLimits = null) }) shouldBe false
            guards.approvalTermsRecorded(base.withApproval { copy(approvedAmount = null) }) shouldBe false
            guards.approvalTermsRecorded(base.withApproval { copy(validFrom = START.plusDays(20)) }) shouldBe false
            guards.approvalTermsRecorded(base.withApproval { copy(validTo = null) }) shouldBe false
            guards.approvalTermsRecorded(base.withApproval { copy(approvedUnits = emptyMap()) }) shouldBe false
            guards.approvalTermsRecorded(base.withApproval { copy(approvedUnits = mapOf(SERVICE to 0)) }) shouldBe false
            guards.approvalTermsRecorded(base.withApproval { copy(payerReference = null) }) shouldBe false
            guards.approvalTermsRecorded(base.copy(approval = null)) shouldBe false
        }
        test("approvalTermsRecorded validity boundary: valid-from equal to valid-to holds") {
            guards.approvalTermsRecorded(base.withApproval { copy(validFrom = START, validTo = START) }) shouldBe true
        }

        // ---- enhancementRequestComplete
        test("enhancementRequestComplete holds for a larger revised estimate in the same currency") {
            guards.enhancementRequestComplete(base) shouldBe true
        }
        test("enhancementRequestComplete fails for an equal estimate (strictly greater, exact) or another currency") {
            val equal = base.copy(enhancementRequest = base.enhancementRequest?.copy(revisedEstimate = iqd(1_000_000)))
            guards.enhancementRequestComplete(equal) shouldBe false
            guards.enhancementRequestComplete(
                base.copy(enhancementRequest = base.enhancementRequest?.copy(revisedEstimate = usd(5_000_000))),
            ) shouldBe false
        }
        test("enhancementRequestComplete fails without a reason, a mandatory document, a current approval or a request") {
            guards.enhancementRequestComplete(base.copy(enhancementRequest = base.enhancementRequest?.copy(reason = null))) shouldBe false
            guards.enhancementRequestComplete(
                base.copy(enhancementRequest = base.enhancementRequest?.copy(documents = missingDocs)),
            ) shouldBe false
            guards.enhancementRequestComplete(base.copy(approval = null)) shouldBe false
            guards.enhancementRequestComplete(base.copy(enhancementRequest = null)) shouldBe false
        }

        // ---- enhancementApprovedBefore / noEnhancementApprovedBefore (exact complements)
        test("enhancementApprovedBefore holds and noEnhancementApprovedBefore fails after one approved enhancement") {
            val facts = base.copy(approvedEnhancementCount = 1)
            guards.enhancementApprovedBefore(facts) shouldBe true
            guards.noEnhancementApprovedBefore(facts) shouldBe false
        }
        test("enhancementApprovedBefore fails and noEnhancementApprovedBefore holds with no approved enhancement") {
            guards.enhancementApprovedBefore(base) shouldBe false
            guards.noEnhancementApprovedBefore(base) shouldBe true
        }

        // ---- clinicalDischargeRecorded
        test("clinicalDischargeRecorded holds for discharged-not-closed and finished") {
            listOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED).forEach { status ->
                guards.clinicalDischargeRecorded(base.copy(episode = EpisodeFacts(START, status))) shouldBe true
            }
        }
        test("clinicalDischargeRecorded fails for every other encounter state, cancelled and entered in error included, and unknown") {
            val discharged = setOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED)
            val notDischarged = EncounterStatus.entries.filterNot { it in discharged }
            (notDischarged + listOf(null))
                .forEach { status -> guards.clinicalDischargeRecorded(base.copy(episode = EpisodeFacts(START, status))) shouldBe false }
        }

        // ---- dischargeAuthRequestComplete
        test("dischargeAuthRequestComplete holds for a complete request") { guards.dischargeAuthRequestComplete(base) shouldBe true }
        test("dischargeAuthRequestComplete holds when the episode has no investigation and the request records none") {
            guards.dischargeAuthRequestComplete(
                base.withDischargeAuth {
                    copy(episodeInvestigations = emptySet(), referencedInvestigations = emptySet(), investigationsRecordedAsNone = true)
                },
            ) shouldBe true
        }
        test("dischargeAuthRequestComplete fails for an unreferenced investigation, or no investigation without 'none' recorded") {
            guards.dischargeAuthRequestComplete(
                base.withDischargeAuth { copy(referencedInvestigations = setOf("SYN-RES-1")) },
            ) shouldBe false
            guards.dischargeAuthRequestComplete(
                base.withDischargeAuth { copy(episodeInvestigations = emptySet(), referencedInvestigations = emptySet()) },
            ) shouldBe false
        }
        test("dischargeAuthRequestComplete fails without the final bill, a signed summary, pharmacy returns or a mandatory document") {
            guards.dischargeAuthRequestComplete(base.withDischargeAuth { copy(finalBillReference = null) }) shouldBe false
            guards.dischargeAuthRequestComplete(base.withDischargeAuth { copy(dischargeSummarySigned = false) }) shouldBe false
            guards.dischargeAuthRequestComplete(base.withDischargeAuth { copy(dischargeSummarySigned = null) }) shouldBe false
            guards.dischargeAuthRequestComplete(base.withDischargeAuth { copy(dischargeSummaryReference = " ") }) shouldBe false
            guards.dischargeAuthRequestComplete(base.withDischargeAuth { copy(pharmacyReturnsProcessed = false) }) shouldBe false
            guards.dischargeAuthRequestComplete(base.withDischargeAuth { copy(documents = missingDocs) }) shouldBe false
            guards.dischargeAuthRequestComplete(base.copy(dischargeAuthRequest = null)) shouldBe false
        }
        test("dischargeAuthRequestComplete holds with pharmacy returns recorded as none") {
            guards.dischargeAuthRequestComplete(
                base.withDischargeAuth { copy(pharmacyReturnsProcessed = false, pharmacyReturnsRecordedAsNone = true) },
            ) shouldBe true
        }

        // ---- everyLineWithinPreApprovalOrFlagged
        test("everyLineWithinPreApprovalOrFlagged holds for a line within the approved service, dates and units") {
            guards.everyLineWithinPreApprovalOrFlagged(base) shouldBe true
        }
        test("everyLineWithinPreApprovalOrFlagged counts units over all lines of a service: equal to approved holds, more fails") {
            val two = line.copy(lineId = "SYN-LINE-2", units = 2)
            guards.everyLineWithinPreApprovalOrFlagged(base.copy(lines = listOf(line, two))) shouldBe true
            guards.everyLineWithinPreApprovalOrFlagged(base.copy(lines = listOf(line, two.copy(units = 3)))) shouldBe false
        }
        test("everyLineWithinPreApprovalOrFlagged fails for an unapproved service or a date outside validity; boundaries included") {
            guards.everyLineWithinPreApprovalOrFlagged(base.copy(lines = listOf(line.copy(serviceCode = "SYN-SVC-OTHER")))) shouldBe false
            guards.everyLineWithinPreApprovalOrFlagged(
                base.copy(lines = listOf(line.copy(serviceDate = START.plusDays(15)))),
            ) shouldBe false
            guards.everyLineWithinPreApprovalOrFlagged(
                base.copy(lines = listOf(line.copy(serviceDate = START.minusDays(1)))),
            ) shouldBe false
            guards.everyLineWithinPreApprovalOrFlagged(base.copy(lines = listOf(line.copy(serviceDate = START.plusDays(14))))) shouldBe true
            guards.everyLineWithinPreApprovalOrFlagged(base.copy(lines = listOf(line.copy(serviceDate = START)))) shouldBe true
        }
        test("everyLineWithinPreApprovalOrFlagged holds for a line outside the approval with a valid flagged exception") {
            val outside = line.copy(serviceCode = "SYN-SVC-OTHER", exception = exception)
            guards.everyLineWithinPreApprovalOrFlagged(base.copy(lines = listOf(outside))) shouldBe true
            guards.everyLineWithinPreApprovalOrFlagged(base.copy(approval = null, lines = listOf(outside))) shouldBe true
        }
        test("everyLineWithinPreApprovalOrFlagged fails for an exception naming another line, an ungoverned reason, or no user") {
            val outside = line.copy(serviceCode = "SYN-SVC-OTHER")
            listOf(
                exception.copy(lineId = "SYN-LINE-9"),
                exception.copy(reasonCode = "SYN-EXC-UNKNOWN"),
                exception.copy(reasonOrigin = ReasonOrigin.DEFAULTED),
                exception.copy(flaggedBy = null),
                exception.copy(flaggedByAuthenticated = false),
            ).forEach { bad ->
                guards.everyLineWithinPreApprovalOrFlagged(base.copy(lines = listOf(outside.copy(exception = bad)))) shouldBe false
            }
        }
        test("everyLineWithinPreApprovalOrFlagged fails for an unflagged line when no approval is in force") {
            guards.everyLineWithinPreApprovalOrFlagged(base.copy(approval = null)) shouldBe false
        }

        // ---- finalApprovalTermsRecorded
        test("finalApprovalTermsRecorded holds for recorded terms in the claim's currency") {
            guards.finalApprovalTermsRecorded(base) shouldBe true
        }
        test("finalApprovalTermsRecorded fails for an amount in another currency, an ungoverned deduction, or an unknown claim currency") {
            guards.finalApprovalTermsRecorded(base.withFinal { copy(payerPayable = usd(800)) }) shouldBe false
            guards.finalApprovalTermsRecorded(
                base.withFinal { copy(deductions = listOf(FinalDeduction("SYN-DED-UNKNOWN", iqd(1)))) },
            ) shouldBe false
            guards.finalApprovalTermsRecorded(
                base.withFinal { copy(deductions = listOf(FinalDeduction(ROOM_RENT, usd(1)))) },
            ) shouldBe false
            guards.finalApprovalTermsRecorded(base.copy(claimCurrency = null)) shouldBe false
        }
        test("finalApprovalTermsRecorded fails without a reference, a payer-payable or patient-payable amount, or a final approval") {
            guards.finalApprovalTermsRecorded(base.withFinal { copy(payerReference = null) }) shouldBe false
            guards.finalApprovalTermsRecorded(base.withFinal { copy(payerPayable = null) }) shouldBe false
            guards.finalApprovalTermsRecorded(base.withFinal { copy(patientPayable = null) }) shouldBe false
            guards.finalApprovalTermsRecorded(base.copy(finalApproval = null)) shouldBe false
        }

        // ---- claimPackComplete
        test("claimPackComplete holds for a pack with the final-approval reference and every mandatory document") {
            guards.claimPackComplete(base) shouldBe true
        }
        test("claimPackComplete fails for another reference, a missing document, or no final approval") {
            guards.claimPackComplete(base.copy(claimPack = ClaimPackFacts("SYN-PAYER-FA-0002", checklist))) shouldBe false
            guards.claimPackComplete(base.copy(claimPack = ClaimPackFacts(FINAL_REF, missingDocs))) shouldBe false
            guards.claimPackComplete(base.copy(finalApproval = null)) shouldBe false
            guards.claimPackComplete(base.copy(claimPack = null)) shouldBe false
        }

        // ---- settlementRecorded
        test("settlementRecorded holds for a remittance with a reference, a value date and a total") {
            guards.settlementRecorded(base) shouldBe true
        }
        test("settlementRecorded fails without a reference, a value date or a total") {
            guards.settlementRecorded(base.withSettlement { copy(paymentReference = null) }) shouldBe false
            guards.settlementRecorded(base.withSettlement { copy(valueDate = null) }) shouldBe false
            guards.settlementRecorded(base.withSettlement { copy(totalSettled = null) }) shouldBe false
            guards.settlementRecorded(base.copy(settlement = null)) shouldBe false
        }

        // ---- settledInFull / settledShort (exact complements)
        test("settledInFull holds and settledShort fails at exactly the final payer-payable amount (boundary) and above") {
            listOf(iqd(800_000), iqd(800_001)).forEach { total ->
                val facts = base.withSettlement { copy(totalSettled = total) }
                guards.settledInFull(facts) shouldBe true
                guards.settledShort(facts) shouldBe false
            }
        }
        test("settledInFull fails and settledShort holds one unit below, or in another currency") {
            listOf(iqd(799_999), usd(10_000_000)).forEach { total ->
                val facts = base.withSettlement { copy(totalSettled = total) }
                guards.settledInFull(facts) shouldBe false
                guards.settledShort(facts) shouldBe true
            }
        }
        test("settledInFull compares exact decimals: 800000.00 equals 800000") {
            guards.settledInFull(base.withSettlement { copy(totalSettled = Money(BigDecimal("800000.00"), IQD)) }) shouldBe true
        }
        test("settledInFull without a final approval uses the amount appealed, else the amount requested (settledShort complements)") {
            val appealed = base.copy(finalApproval = null)
            guards.settledInFull(appealed.withSettlement { copy(totalSettled = iqd(50_000)) }) shouldBe true
            guards.settledShort(appealed.withSettlement { copy(totalSettled = iqd(49_999)) }) shouldBe true
            val requested = appealed.copy(appeal = null)
            guards.settledInFull(requested.withSettlement { copy(totalSettled = iqd(950_000)) }) shouldBe true
            guards.settledInFull(requested.withSettlement { copy(totalSettled = iqd(949_999)) }) shouldBe false
        }
        test("settledInFull fails and settledShort holds with no reference amount, or no settlement") {
            val none = base.copy(finalApproval = null, appeal = null, dischargeAuthRequest = null)
            guards.settledInFull(none) shouldBe false
            guards.settledShort(none) shouldBe true
            guards.settledInFull(base.withFinal { copy(payerPayable = null) }) shouldBe false
            guards.settledInFull(base.copy(settlement = null)) shouldBe false
            guards.settledShort(base.copy(settlement = null)) shouldBe true
        }

        // ---- deductionReasonsRecorded
        test("deductionReasonsRecorded holds for governed codes chosen by the user (including 'no reason given')") {
            guards.deductionReasonsRecorded(base) shouldBe true
        }
        test("deductionReasonsRecorded fails for an ungoverned or defaulted code, or no deduction recorded") {
            guards.deductionReasonsRecorded(
                base.withSettlement { copy(deductions = listOf(SettlementDeduction("SYN-DED-X", ReasonOrigin.USER))) },
            ) shouldBe false
            guards.deductionReasonsRecorded(
                base.withSettlement { copy(deductions = listOf(SettlementDeduction(NO_REASON, ReasonOrigin.DEFAULTED))) },
            ) shouldBe false
            guards.deductionReasonsRecorded(base.withSettlement { copy(deductions = emptyList()) }) shouldBe false
            guards.deductionReasonsRecorded(base.copy(settlement = null)) shouldBe false
        }
        test("deductionReasonsRecorded in another currency needs the governed exchange-difference reason") {
            val other = base.withSettlement { copy(totalSettled = usd(600)) }
            guards.deductionReasonsRecorded(other) shouldBe false
            guards.deductionReasonsRecorded(
                other.withSettlement { copy(deductions = deductions + SettlementDeduction(FX, ReasonOrigin.USER)) },
            ) shouldBe true
        }

        // ---- denialReasonsRecorded
        test("denialReasonsRecorded holds for a governed reason with a root cause chosen by the user") {
            guards.denialReasonsRecorded(base) shouldBe true
        }
        test("denialReasonsRecorded fails without a root cause, with an ungoverned or defaulted code, no reason or no reference") {
            val denial = base.denial
            val reason = DenialReason("SYN-DEN-NOT-COVERED", DenialRootCause.CODING, ReasonOrigin.USER)
            guards.denialReasonsRecorded(base.copy(denial = denial?.copy(reasons = listOf(reason.copy(rootCause = null))))) shouldBe false
            guards.denialReasonsRecorded(base.copy(denial = denial?.copy(reasons = listOf(reason.copy(code = "SYN-DEN-X"))))) shouldBe false
            guards.denialReasonsRecorded(
                base.copy(denial = denial?.copy(reasons = listOf(reason.copy(origin = ReasonOrigin.PREFILLED)))),
            ) shouldBe false
            guards.denialReasonsRecorded(base.copy(denial = denial?.copy(reasons = emptyList()))) shouldBe false
            guards.denialReasonsRecorded(base.copy(denial = denial?.copy(payerReference = null))) shouldBe false
            guards.denialReasonsRecorded(base.copy(denial = null)) shouldBe false
        }

        // ---- appealGroundsRecorded
        test("appealGroundsRecorded holds for a templated appeal with items, an amount and documents") {
            guards.appealGroundsRecorded(base) shouldBe true
        }
        test("appealGroundsRecorded fails without a template, grounds, items, amount or documents") {
            val appeal = base.appeal
            guards.appealGroundsRecorded(base.copy(appeal = appeal?.copy(templateId = null))) shouldBe false
            guards.appealGroundsRecorded(base.copy(appeal = appeal?.copy(grounds = " "))) shouldBe false
            guards.appealGroundsRecorded(base.copy(appeal = appeal?.copy(appealedItems = emptySet()))) shouldBe false
            guards.appealGroundsRecorded(base.copy(appeal = appeal?.copy(amountAppealed = null))) shouldBe false
            guards.appealGroundsRecorded(base.copy(appeal = appeal?.copy(supportingDocuments = emptySet()))) shouldBe false
            guards.appealGroundsRecorded(base.copy(appeal = null)) shouldBe false
        }

        // ---- appealWithinDeadline
        test("appealWithinDeadline holds before the deadline and when the contract sets none") {
            guards.appealWithinDeadline(base) shouldBe true
            guards.appealWithinDeadline(base.copy(appealDeadline = null)) shouldBe true
            guards.appealWithinDeadline(base.copy(appealDeadline = NOW.plusNanos(1))) shouldBe true
        }
        test("appealWithinDeadline fails at exactly the deadline (boundary) and after it") {
            guards.appealWithinDeadline(base.copy(appealDeadline = NOW)) shouldBe false
            guards.appealWithinDeadline(base.copy(appealDeadline = NOW.minusSeconds(1))) shouldBe false
        }

        // ---- reconciliationComplete
        test("reconciliationComplete holds when every line has a disposition and the payer balance is exactly zero") {
            guards.reconciliationComplete(base) shouldBe true
            guards.reconciliationComplete(base.copy(payerBucketBalance = Money(BigDecimal("0.00"), IQD))) shouldBe true
        }
        test("reconciliationComplete fails for a line without disposition, a non-zero or foreign-currency balance, or an unknown balance") {
            guards.reconciliationComplete(base.copy(lines = listOf(line.copy(disposition = null)))) shouldBe false
            guards.reconciliationComplete(base.copy(payerBucketBalance = iqd(1))) shouldBe false
            guards.reconciliationComplete(base.copy(payerBucketBalance = iqd(-1))) shouldBe false
            guards.reconciliationComplete(base.copy(payerBucketBalance = usd(0))) shouldBe false
            guards.reconciliationComplete(base.copy(payerBucketBalance = null)) shouldBe false
        }

        // ---- withdrawalReasonRecorded
        test("withdrawalReasonRecorded holds for a governed reason chosen by the desk user") {
            guards.withdrawalReasonRecorded(base) shouldBe true
        }
        test("withdrawalReasonRecorded fails for an ungoverned or defaulted reason, or none") {
            guards.withdrawalReasonRecorded(base.copy(withdrawal = WithdrawalFacts("SYN-WDR-X", ReasonOrigin.USER))) shouldBe false
            guards.withdrawalReasonRecorded(
                base.copy(withdrawal = WithdrawalFacts("SYN-WDR-PATIENT-PAYS", ReasonOrigin.DEFAULTED)),
            ) shouldBe false
            guards.withdrawalReasonRecorded(base.copy(withdrawal = WithdrawalFacts(null, ReasonOrigin.USER))) shouldBe false
            guards.withdrawalReasonRecorded(base.copy(withdrawal = null)) shouldBe false
        }

        // ---- privilegedAndAudited
        test("privilegedAndAudited holds with the privilege and a writable audit record") {
            guards.privilegedAndAudited(base) shouldBe true
        }
        test("privilegedAndAudited fails without the privilege, when the audit record cannot be written, or without a correction") {
            guards.privilegedAndAudited(base.copy(correction = base.correction?.copy(holdsCorrectionPrivilege = false))) shouldBe false
            guards.privilegedAndAudited(base.copy(correction = base.correction?.copy(auditWritable = false))) shouldBe false
            guards.privilegedAndAudited(base.copy(correction = null)) shouldBe false
        }

        // ---- correctionReasonEntered
        test("correctionReasonEntered holds for a reason the user entered") { guards.correctionReasonEntered(base) shouldBe true }
        test("correctionReasonEntered fails for a blank or prefilled reason, or no correction") {
            guards.correctionReasonEntered(base.copy(correction = base.correction?.copy(reason = ""))) shouldBe false
            guards.correctionReasonEntered(
                base.copy(correction = base.correction?.copy(reasonOrigin = ReasonOrigin.PREFILLED)),
            ) shouldBe false
            guards.correctionReasonEntered(base.copy(correction = null)) shouldBe false
        }
    })
