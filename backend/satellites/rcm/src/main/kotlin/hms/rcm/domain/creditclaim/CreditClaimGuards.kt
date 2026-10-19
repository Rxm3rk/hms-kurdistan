package hms.rcm.domain.creditclaim

import java.time.LocalDate

/**
 * The only implementation of the credit-claim machine's guard predicates (docs/specs/state-machines/credit-claim.yaml;
 * WP-0.5 spec §2.1 rule 12, §3.1). Each predicate is a pure, total function of [CreditClaimFacts] implementing its YAML
 * description; each exact-complement pair is the literal negation of one private function. Amounts are compared only
 * exactly and only in the same currency ([sameCurrency]); there is no conversion and no money arithmetic. Unknown
 * values fail closed: a missing fact never satisfies a "recorded", "complete" or "within" predicate.
 */
@Suppress("TooManyFunctions") // One function per predicate of the generated interface, plus their private helpers.
object CreditClaimGuards : CreditClaimPredicates {
    /** Encounter states in which adt has recorded the clinical discharge (encounter.yaml). */
    private val dischargedStates = setOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED)

    // ---- Requests.

    /**
     * The episode's start date is known; the contract is active on it (not suspended, on or after its first active
     * date, on or before its last when it has one); an eligibility letter is captured and valid on that date.
     */
    override fun coverageActive(facts: CreditClaimFacts): Boolean {
        val date = facts.episode.startDate
        val coverage = facts.coverage
        return date != null &&
            coverage != null &&
            contractActive(coverage, date) &&
            coverage.letterCaptured &&
            within(date, coverage.letterValidFrom, coverage.letterValidTo)
    }

    private fun contractActive(
        coverage: CoverageFacts,
        date: LocalDate,
    ): Boolean {
        val from = coverage.contractActiveFrom
        val to = coverage.contractActiveTo
        return !coverage.contractSuspended && from != null && !date.isBefore(from) && (to == null || !date.isAfter(to))
    }

    /**
     * The request holds a diagnosis code terminology reports valid for the start date, a catalogue procedure code, an
     * estimate with amount and currency, the room category, and every mandatory pre-approval document.
     */
    override fun preApprovalRequestComplete(facts: CreditClaimFacts): Boolean {
        val request = facts.preApprovalRequest ?: return false
        return !request.diagnosisCode.isNullOrBlank() &&
            request.diagnosisValidForStartDate == true &&
            !request.procedureCode.isNullOrBlank() &&
            request.procedureInCatalogue == true &&
            hasCurrency(request.estimate) &&
            !request.roomCategory.isNullOrBlank() &&
            complete(request.documents)
    }

    // ---- Queries.

    /** The query has a payer reference, a received instant and at least one item. */
    override fun payerQueryRecorded(facts: CreditClaimFacts): Boolean {
        val query = facts.raisedQuery ?: return false
        return !query.payerReference.isNullOrBlank() && query.receivedAt != null && query.itemCount >= 1
    }

    /**
     * Every item of the open query has an answer text or a document, recorded by an authenticated desk user. An open
     * query with no item cannot be answered (a recorded query has at least one, payerQueryRecorded).
     */
    override fun queryResponseComplete(facts: CreditClaimFacts): Boolean {
        val query = facts.openQuery ?: return false
        return query.items.isNotEmpty() &&
            query.items.all { !it.answerText.isNullOrBlank() || !it.attachedDocument.isNullOrBlank() } &&
            !query.responderId.isNullOrBlank() &&
            query.responderAuthenticatedDeskUser
    }

    /** The current query's stage is the pre-approval. */
    override fun queryOnPreApproval(facts: CreditClaimFacts): Boolean = facts.currentQueryStage == QueryStage.PRE_APPROVAL

    /** The current query's stage is an enhancement. */
    override fun queryOnEnhancement(facts: CreditClaimFacts): Boolean = facts.currentQueryStage == QueryStage.ENHANCEMENT

    /** The current query's stage is the discharge authorisation. */
    override fun queryOnDischargeAuth(facts: CreditClaimFacts): Boolean = facts.currentQueryStage == QueryStage.DISCHARGE_AUTH

    /** The current query's stage is the submitted claim. */
    override fun queryOnClaim(facts: CreditClaimFacts): Boolean = isQueryOnClaim(facts)

    /** The exact complement of [queryOnClaim]. */
    override fun queryNotOnClaim(facts: CreditClaimFacts): Boolean = !isQueryOnClaim(facts)

    private fun isQueryOnClaim(facts: CreditClaimFacts): Boolean = facts.currentQueryStage == QueryStage.CLAIM

    // ---- Approvals and enhancements.

    /**
     * The approval has a payer reference, an approved amount with its currency, the room-rent cap, co-pay and
     * sub-limits each as a value or explicitly "none", valid-from on or before valid-to, and at least one approved
     * service, each with a positive number of approved units.
     */
    override fun approvalTermsRecorded(facts: CreditClaimFacts): Boolean {
        val approval = facts.approval ?: return false
        val from = approval.validFrom
        val to = approval.validTo
        return !approval.payerReference.isNullOrBlank() &&
            hasCurrency(approval.approvedAmount) &&
            listOf(approval.roomRentCap, approval.coPay, approval.subLimits).all(::termRecorded) &&
            from != null &&
            to != null &&
            !from.isAfter(to) &&
            approval.approvedUnits.isNotEmpty() &&
            approval.approvedUnits.values.all { it >= 1 }
    }

    private fun termRecorded(term: ApprovalTerm?): Boolean = term != null && (!term.value.isNullOrBlank() || term.explicitlyNone)

    /**
     * The revised estimate is in the currency of the current approved amount and strictly greater (exact), with a
     * reason and every mandatory enhancement document. No current approved amount fails.
     */
    override fun enhancementRequestComplete(facts: CreditClaimFacts): Boolean {
        val request = facts.enhancementRequest ?: return false
        val revised = request.revisedEstimate
        val current = facts.approval?.approvedAmount
        val greater = revised != null && current != null && sameCurrency(revised, current) && revised.amount > current.amount
        return greater && !request.reason.isNullOrBlank() && complete(request.documents)
    }

    /** At least one enhancement of this claim has been approved. */
    override fun enhancementApprovedBefore(facts: CreditClaimFacts): Boolean = anyEnhancementApproved(facts)

    /** The exact complement of [enhancementApprovedBefore]. */
    override fun noEnhancementApprovedBefore(facts: CreditClaimFacts): Boolean = !anyEnhancementApproved(facts)

    private fun anyEnhancementApproved(facts: CreditClaimFacts): Boolean = facts.approvedEnhancementCount >= 1

    // ---- Discharge authorisation and the claim build.

    /** adt reports the episode's encounter discharged-not-closed or finished; unknown, cancelled or entered in error do not count. */
    override fun clinicalDischargeRecorded(facts: CreditClaimFacts): Boolean = facts.episode.encounterStatus in dischargedStates

    /**
     * The request references the final bill and a signed discharge summary (record's answer), references every
     * investigation result of the episode (or, when the episode has none, records "none" explicitly), has the pharmacy
     * returns processed or recorded as none, and every mandatory discharge-authorisation document.
     */
    override fun dischargeAuthRequestComplete(facts: CreditClaimFacts): Boolean {
        val request = facts.dischargeAuthRequest ?: return false
        val investigations =
            if (request.episodeInvestigations.isEmpty()) {
                request.investigationsRecordedAsNone
            } else {
                request.referencedInvestigations.containsAll(request.episodeInvestigations)
            }
        return !request.finalBillReference.isNullOrBlank() &&
            !request.dischargeSummaryReference.isNullOrBlank() &&
            request.dischargeSummarySigned == true &&
            investigations &&
            (request.pharmacyReturnsProcessed || request.pharmacyReturnsRecordedAsNone) &&
            complete(request.documents)
    }

    /**
     * Every line is within the approval in force (service code approved, service date within the validity dates, the
     * units of its service code over all lines not above the approved units, integers only), or carries a valid
     * flagged exception. Without an approval in force, only flagged lines pass.
     */
    override fun everyLineWithinPreApprovalOrFlagged(facts: CreditClaimFacts): Boolean {
        val unitsByCode = facts.lines.groupBy { it.serviceCode }.mapValues { (_, lines) -> lines.sumOf { it.units } }
        return facts.lines.all { line -> withinApproval(line, facts.approval, unitsByCode) || validException(line, facts.config) }
    }

    private fun withinApproval(
        line: ClaimLineFacts,
        approval: ApprovalTermsFacts?,
        unitsByCode: Map<String, Int>,
    ): Boolean {
        val approvedUnits = approval?.approvedUnits?.get(line.serviceCode) ?: return false
        val claimed = unitsByCode[line.serviceCode] ?: line.units
        return within(line.serviceDate, approval.validFrom, approval.validTo) && claimed <= approvedUnits
    }

    private fun validException(
        line: ClaimLineFacts,
        config: CreditClaimConfig,
    ): Boolean {
        val exception = line.exception ?: return false
        return exception.lineId == line.lineId &&
            exception.reasonCode != null &&
            exception.reasonCode in config.exceptionReasons &&
            exception.reasonOrigin == ReasonOrigin.USER &&
            !exception.flaggedBy.isNullOrBlank() &&
            exception.flaggedByAuthenticated
    }

    /**
     * The final approval has a payer reference, the payer-payable amount, every deduction with a governed reason and an
     * amount, and the patient-payable amount, all in the claim's currency. An unknown claim currency fails.
     */
    override fun finalApprovalTermsRecorded(facts: CreditClaimFacts): Boolean {
        val approval = facts.finalApproval ?: return false
        val currency = facts.claimCurrency
        val inClaimCurrency = { money: Money? -> money != null && currency != null && money.currency == currency }
        return !approval.payerReference.isNullOrBlank() &&
            inClaimCurrency(approval.payerPayable) &&
            inClaimCurrency(approval.patientPayable) &&
            approval.deductions.all { deduction ->
                deduction.reasonCode != null && deduction.reasonCode in facts.config.deductionReasons && inClaimCurrency(deduction.amount)
            }
    }

    /** The pack holds the final approval's reference and every mandatory claim-submission document. */
    override fun claimPackComplete(facts: CreditClaimFacts): Boolean {
        val pack = facts.claimPack ?: return false
        val reference = facts.finalApproval?.payerReference
        return !reference.isNullOrBlank() && pack.finalApprovalReference == reference && complete(pack.documents)
    }

    // ---- Settlement, denial, appeal and reconciliation.

    /** The remittance has a payment reference, a value date and the total settled with its currency. */
    override fun settlementRecorded(facts: CreditClaimFacts): Boolean {
        val settlement = facts.settlement ?: return false
        return !settlement.paymentReference.isNullOrBlank() && settlement.valueDate != null && hasCurrency(settlement.totalSettled)
    }

    /**
     * The total settled is in the reference amount's currency and not less than it (exact). The reference is the
     * final-approved payer-payable amount when a final approval exists, otherwise the amount appealed when an appeal
     * exists, otherwise the discharge-authorisation amount requested; with none, never in full.
     */
    override fun settledInFull(facts: CreditClaimFacts): Boolean = inFull(facts)

    /** The exact complement of [settledInFull]. */
    override fun settledShort(facts: CreditClaimFacts): Boolean = !inFull(facts)

    private fun inFull(facts: CreditClaimFacts): Boolean {
        val total = facts.settlement?.totalSettled
        val reference = referenceAmount(facts)
        return total != null && reference != null && sameCurrency(total, reference) && total.amount >= reference.amount
    }

    private fun referenceAmount(facts: CreditClaimFacts): Money? =
        when {
            facts.finalApproval != null -> facts.finalApproval.payerPayable
            facts.appeal != null -> facts.appeal.amountAppealed
            else -> facts.dischargeAuthRequest?.amountRequested
        }

    /**
     * The settlement records at least one deduction, every one with a governed code chosen by the user; when the
     * settlement's currency differs from the reference amount's, the governed exchange-difference reason is among them.
     */
    override fun deductionReasonsRecorded(facts: CreditClaimFacts): Boolean {
        val settlement = facts.settlement ?: return false
        val governed = facts.config.deductionReasons
        val coded =
            settlement.deductions.isNotEmpty() &&
                settlement.deductions.all { it.reasonCode != null && it.reasonCode in governed && it.reasonOrigin == ReasonOrigin.USER }
        val total = settlement.totalSettled
        val reference = referenceAmount(facts)
        val otherCurrency = total != null && reference != null && !sameCurrency(total, reference)
        val exchange = !otherCurrency || settlement.deductions.any { it.reasonCode == facts.config.exchangeDifferenceReason }
        return coded && exchange
    }

    /** The denial has a payer reference and at least one reason, each a governed code with a root cause, chosen by the user. */
    override fun denialReasonsRecorded(facts: CreditClaimFacts): Boolean {
        val denial = facts.denial ?: return false
        return !denial.payerReference.isNullOrBlank() &&
            denial.reasons.isNotEmpty() &&
            denial.reasons.all { reason ->
                reason.code != null &&
                    reason.code in facts.config.denialReasons &&
                    reason.rootCause != null &&
                    reason.origin == ReasonOrigin.USER
            }
    }

    /** The appeal holds a template and grounds, the items appealed, the amount appealed with its currency, and supporting documents. */
    override fun appealGroundsRecorded(facts: CreditClaimFacts): Boolean {
        val appeal = facts.appeal ?: return false
        return !appeal.templateId.isNullOrBlank() &&
            !appeal.grounds.isNullOrBlank() &&
            appeal.appealedItems.isNotEmpty() &&
            hasCurrency(appeal.amountAppealed) &&
            appeal.supportingDocuments.isNotEmpty()
    }

    /** The contract sets no appeal deadline, or now is strictly before it. */
    override fun appealWithinDeadline(facts: CreditClaimFacts): Boolean {
        val deadline = facts.appealDeadline ?: return true
        return facts.now.isBefore(deadline)
    }

    /**
     * Every line has a final disposition in the ledger, and the payer-bucket balance is exactly zero in the claim's
     * currency. An unknown balance or currency fails.
     */
    override fun reconciliationComplete(facts: CreditClaimFacts): Boolean {
        val balance = facts.payerBucketBalance
        return facts.lines.all { it.disposition != null } &&
            balance != null &&
            balance.currency == facts.claimCurrency &&
            balance.amount.signum() == 0
    }

    // ---- Withdrawal and correction.

    /** A governed withdrawal reason chosen by the desk user. */
    override fun withdrawalReasonRecorded(facts: CreditClaimFacts): Boolean {
        val withdrawal = facts.withdrawal ?: return false
        return withdrawal.reasonCode != null &&
            withdrawal.reasonCode in facts.config.withdrawalReasons &&
            withdrawal.reasonOrigin == ReasonOrigin.USER
    }

    /** The user holds the correction privilege and the audit record can be written (an audit outage refuses). */
    override fun privilegedAndAudited(facts: CreditClaimFacts): Boolean {
        val correction = facts.correction ?: return false
        return correction.holdsCorrectionPrivilege && correction.auditWritable
    }

    /** A non-blank correction reason entered by the user. */
    override fun correctionReasonEntered(facts: CreditClaimFacts): Boolean {
        val correction = facts.correction ?: return false
        return !correction.reason.isNullOrBlank() && correction.reasonOrigin == ReasonOrigin.USER
    }

    // ---- Shared helpers.

    /** Two amounts are comparable only in the same currency. */
    private fun sameCurrency(
        first: Money,
        second: Money,
    ): Boolean = first.currency == second.currency

    private fun hasCurrency(money: Money?): Boolean = money != null && money.currency.isNotBlank()

    private fun complete(documents: DocumentChecklist): Boolean = documents.attached.containsAll(documents.mandatory)

    private fun within(
        date: LocalDate,
        from: LocalDate?,
        to: LocalDate?,
    ): Boolean = from != null && to != null && !date.isBefore(from) && !date.isAfter(to)
}
