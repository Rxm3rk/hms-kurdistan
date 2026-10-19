package hms.rcm.domain.creditclaim

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate

// The facts the credit-claim predicates read (docs/specs/state-machines/credit-claim.yaml; WP-0.5 spec §3.1 "Facts,
// not aggregates"). Pure values: time arrives as data (now), never from the system clock. Answers owned by another
// module are facts here because that module owns them: adt's encounter state, terminology's code validity, the order
// catalogue's procedure codes, record's signed discharge summary, the Trust Plane's privileges and rcm's own ledger
// totals and balances. Every comparison of these values is made by CreditClaimGuards.
//
// Money: an amount with its ISO 4217 currency ([Money]). The predicates compare amounts only exactly and only in the
// same currency; there is no conversion and no money arithmetic in any predicate (credit-claim.yaml header).

/**
 * An amount with its ISO 4217 currency code. Compared only exactly, and only with an amount in the same currency.
 *
 * @property amount The amount (exact decimal).
 * @property currency The ISO 4217 code, for example IQD or USD.
 */
data class Money(
    val amount: BigDecimal,
    val currency: String,
)

/**
 * Everything the credit-claim aggregate knows when it decides one command (credit-claim.yaml header).
 *
 * @property now The clock reading for this decision.
 * @property config The tenant's governed lists [HUMAN].
 * @property claimCurrency The claim's currency (from the credit contract).
 * @property episode The credited episode as adt reports it.
 * @property coverage The coverage under the credit contract.
 * @property preApprovalRequest The pre-approval request the command carries.
 * @property raisedQuery The payer query the command records (RaiseQuery).
 * @property openQuery The open query with its answers (RespondToQuery).
 * @property currentQueryStage The current query's stage: the open query's, otherwise the most recently answered
 *   query's; null when there was no query (credit-claim.yaml header "Query stage").
 * @property approval The payer's latest approval terms: the one this command records, or the one in force.
 * @property approvedEnhancementCount How many enhancements of this claim have been approved (rcm's answer).
 * @property enhancementRequest The enhancement request the command carries.
 * @property dischargeAuthRequest The discharge-authorisation request the command carries, or the one sent.
 * @property lines The lines of the claim being built, with their ledger dispositions.
 * @property finalApproval The payer's final approval: the one this command records, or the one in force.
 * @property claimPack The claim document pack (SubmitClaimDocs).
 * @property settlement The payer's remittance this command records.
 * @property denial The payer's denial this command records.
 * @property appeal The appeal: the one this command files, or the one filed.
 * @property appealDeadline The appeal deadline the contract sets for this claim; null when it sets none [HUMAN].
 * @property payerBucketBalance The claim's payer-bucket balance (rcm's ledger answer).
 * @property withdrawal The withdrawal the command carries.
 * @property correction The correction the command carries (ReopenClaim).
 */
data class CreditClaimFacts(
    val now: Instant,
    val config: CreditClaimConfig,
    val claimCurrency: String?,
    val episode: EpisodeFacts,
    val coverage: CoverageFacts?,
    val preApprovalRequest: PreApprovalRequestFacts?,
    val raisedQuery: PayerQueryFacts?,
    val openQuery: OpenQueryFacts?,
    val currentQueryStage: QueryStage?,
    val approval: ApprovalTermsFacts?,
    val approvedEnhancementCount: Int,
    val enhancementRequest: EnhancementRequestFacts?,
    val dischargeAuthRequest: DischargeAuthRequestFacts?,
    val lines: List<ClaimLineFacts>,
    val finalApproval: FinalApprovalFacts?,
    val claimPack: ClaimPackFacts?,
    val settlement: SettlementFacts?,
    val denial: DenialFacts?,
    val appeal: AppealFacts?,
    val appealDeadline: Instant?,
    val payerBucketBalance: Money?,
    val withdrawal: WithdrawalFacts?,
    val correction: CorrectionFacts?,
)

/**
 * The tenant's governed lists [HUMAN] that the predicates read.
 *
 * @property deductionReasons The governed deduction-reason codes (including "no reason given").
 * @property exchangeDifferenceReason The governed code "settled in another currency (reconcile the exchange difference)".
 * @property denialReasons The governed denial-reason codes.
 * @property exceptionReasons The governed exception-reason codes for a line outside its pre-approval.
 * @property withdrawalReasons The governed withdrawal-reason codes.
 */
data class CreditClaimConfig(
    val deductionReasons: Set<String>,
    val exchangeDifferenceReason: String,
    val denialReasons: Set<String>,
    val exceptionReasons: Set<String>,
    val withdrawalReasons: Set<String>,
)

/** The encounter machine's states (docs/specs/state-machines/encounter.yaml), as adt reports them. */
enum class EncounterStatus {
    PLANNED,
    ARRIVED,
    TRIAGED,
    IN_PROGRESS,
    ON_LEAVE,
    DISCHARGED_NOT_CLOSED,
    FINISHED,
    CANCELLED,
    ENTERED_IN_ERROR,
}

/**
 * The credited episode.
 *
 * @property startDate The episode's start date (admission or visit date).
 * @property encounterStatus adt's answer for the episode's encounter state (an event fact); null when unknown.
 */
data class EpisodeFacts(
    val startDate: LocalDate?,
    val encounterStatus: EncounterStatus?,
)

/**
 * The coverage under the credit contract and its captured eligibility letter (§9.23 "no eligibility rail").
 *
 * @property contractActiveFrom The first date the contract is active.
 * @property contractActiveTo The last date the contract is active; null when open-ended.
 * @property contractSuspended The contract is suspended.
 * @property letterCaptured An eligibility letter is captured.
 * @property letterValidFrom The letter's valid-from date.
 * @property letterValidTo The letter's valid-to date.
 */
data class CoverageFacts(
    val contractActiveFrom: LocalDate?,
    val contractActiveTo: LocalDate?,
    val contractSuspended: Boolean,
    val letterCaptured: Boolean,
    val letterValidFrom: LocalDate?,
    val letterValidTo: LocalDate?,
)

/**
 * A request's document checklist: the payer's governed mandatory documents [HUMAN] and those attached.
 *
 * @property mandatory The document types the payer's checklist marks mandatory for this step.
 * @property attached The document types attached.
 */
data class DocumentChecklist(
    val mandatory: Set<String>,
    val attached: Set<String>,
)

/**
 * The pre-approval request (§9.23 PreApprovalRequested).
 *
 * @property diagnosisCode The ICD-10 diagnosis code, as entered (never checked here from a list).
 * @property diagnosisValidForStartDate terminology's answer: the code is valid for the episode's start date.
 * @property procedureCode The proposed procedure (a local procedure code).
 * @property procedureInCatalogue The order catalogue's answer: the procedure code is in the catalogue (§9.24).
 * @property estimate The written estimate.
 * @property roomCategory The requested room category.
 * @property documents The pre-approval checklist.
 */
data class PreApprovalRequestFacts(
    val diagnosisCode: String?,
    val diagnosisValidForStartDate: Boolean?,
    val procedureCode: String?,
    val procedureInCatalogue: Boolean?,
    val estimate: Money?,
    val roomCategory: String?,
    val documents: DocumentChecklist,
)

/**
 * A payer query being recorded.
 *
 * @property payerReference The payer's reference.
 * @property receivedAt When the query was received.
 * @property itemCount The number of query items (questions or requested documents).
 */
data class PayerQueryFacts(
    val payerReference: String?,
    val receivedAt: Instant?,
    val itemCount: Int,
)

/**
 * One item of an open query with its answer.
 *
 * @property answerText The answer text.
 * @property attachedDocument The attached document's reference.
 */
data class QueryItemFacts(
    val answerText: String?,
    val attachedDocument: String?,
)

/**
 * The open query and the response being recorded.
 *
 * @property items The query's items with their answers.
 * @property responderId The desk user recording the response.
 * @property responderAuthenticatedDeskUser The Trust Plane's answer: an authenticated corporate/insurer desk user.
 */
data class OpenQueryFacts(
    val items: List<QueryItemFacts>,
    val responderId: String?,
    val responderAuthenticatedDeskUser: Boolean,
)

/** The stage of the request a query answers (credit-claim.yaml header "Query stage"). */
enum class QueryStage { PRE_APPROVAL, ENHANCEMENT, DISCHARGE_AUTH, CLAIM }

/**
 * A term of an approval: a value, or an explicit "none".
 *
 * @property value The recorded value.
 * @property explicitlyNone Recorded explicitly as "none".
 */
data class ApprovalTerm(
    val value: String?,
    val explicitlyNone: Boolean,
)

/**
 * The payer's approval terms (§9.23 PreApprovalApproved; an enhancement approval has the same shape).
 *
 * @property payerReference The payer's reference.
 * @property approvedAmount The approved amount.
 * @property roomRentCap The room-rent cap.
 * @property coPay The co-pay.
 * @property subLimits The sub-limits.
 * @property validFrom The validity start.
 * @property validTo The validity end.
 * @property approvedUnits The approved services, by service code, with their approved integer units.
 */
data class ApprovalTermsFacts(
    val payerReference: String?,
    val approvedAmount: Money?,
    val roomRentCap: ApprovalTerm?,
    val coPay: ApprovalTerm?,
    val subLimits: ApprovalTerm?,
    val validFrom: LocalDate?,
    val validTo: LocalDate?,
    val approvedUnits: Map<String, Int>,
)

/**
 * The enhancement request.
 *
 * @property revisedEstimate The revised estimate.
 * @property reason The reason for the enhancement.
 * @property documents The enhancement checklist.
 */
data class EnhancementRequestFacts(
    val revisedEstimate: Money?,
    val reason: String?,
    val documents: DocumentChecklist,
)

/**
 * The discharge-authorisation request (§9.23 DischargeAuthRequested).
 *
 * @property finalBillReference The final bill's reference.
 * @property dischargeSummaryReference The discharge summary's reference.
 * @property dischargeSummarySigned record's answer: the referenced summary is a signed document.
 * @property episodeInvestigations The episode's investigation results (the record's answer).
 * @property referencedInvestigations The investigation results the request references.
 * @property investigationsRecordedAsNone The request records that the episode has no investigation result.
 * @property pharmacyReturnsProcessed The pharmacy returns are processed.
 * @property pharmacyReturnsRecordedAsNone The request records that there are no pharmacy returns.
 * @property amountRequested The amount requested in the discharge authorisation.
 * @property documents The discharge-authorisation checklist.
 */
data class DischargeAuthRequestFacts(
    val finalBillReference: String?,
    val dischargeSummaryReference: String?,
    val dischargeSummarySigned: Boolean?,
    val episodeInvestigations: Set<String>,
    val referencedInvestigations: Set<String>,
    val investigationsRecordedAsNone: Boolean,
    val pharmacyReturnsProcessed: Boolean,
    val pharmacyReturnsRecordedAsNone: Boolean,
    val amountRequested: Money?,
    val documents: DocumentChecklist,
)

/** How a reason or code was entered: only USER is chosen by the acting user. */
enum class ReasonOrigin { USER, PREFILLED, DEFAULTED, CARRIED_OVER }

/**
 * A flagged exception on a claim line outside its pre-approval.
 *
 * @property lineId The line it names.
 * @property reasonCode The governed exception-reason code.
 * @property reasonOrigin How the code was entered.
 * @property flaggedBy The desk user who flagged it.
 * @property flaggedByAuthenticated The Trust Plane's answer for that user.
 */
data class FlaggedException(
    val lineId: String,
    val reasonCode: String?,
    val reasonOrigin: ReasonOrigin?,
    val flaggedBy: String?,
    val flaggedByAuthenticated: Boolean,
)

/** A line's final disposition in the ledger (§9.21). */
enum class LineDisposition { PAID_BY_PAYER, TRANSFERRED_TO_PATIENT, TRANSFERRED_TO_OTHER_COVERAGE, WRITTEN_OFF_BY_APPROVED_ADJUSTMENT }

/**
 * One line of the claim.
 *
 * @property lineId The line's identifier.
 * @property serviceCode Its service code.
 * @property serviceDate Its service date.
 * @property units Its integer units.
 * @property exception Its flagged exception, if any.
 * @property disposition Its final disposition posted in the ledger, if any (rcm's answer).
 */
data class ClaimLineFacts(
    val lineId: String,
    val serviceCode: String,
    val serviceDate: LocalDate,
    val units: Int,
    val exception: FlaggedException?,
    val disposition: LineDisposition?,
)

/**
 * A deduction of the final approval.
 *
 * @property reasonCode The governed deduction-reason code.
 * @property amount The deducted amount.
 */
data class FinalDeduction(
    val reasonCode: String?,
    val amount: Money?,
)

/**
 * The payer's final approval (§9.23 FinalApproved).
 *
 * @property payerReference The payer's reference.
 * @property payerPayable The payer-payable amount.
 * @property deductions The deductions with their reasons.
 * @property patientPayable The patient-payable amount.
 */
data class FinalApprovalFacts(
    val payerReference: String?,
    val payerPayable: Money?,
    val deductions: List<FinalDeduction>,
    val patientPayable: Money?,
)

/**
 * The claim document pack.
 *
 * @property finalApprovalReference The final-approval reference the pack holds.
 * @property documents The claim-submission checklist.
 */
data class ClaimPackFacts(
    val finalApprovalReference: String?,
    val documents: DocumentChecklist,
)

/**
 * A deduction the payer made on a settlement.
 *
 * @property reasonCode The governed deduction-reason code.
 * @property reasonOrigin How the code was entered.
 */
data class SettlementDeduction(
    val reasonCode: String?,
    val reasonOrigin: ReasonOrigin?,
)

/**
 * The payer's remittance.
 *
 * @property paymentReference The payment reference.
 * @property valueDate The value date.
 * @property totalSettled The total settled for this claim (rcm's ledger answer over the claim's remittances).
 * @property deductions The deductions the payer made on this settlement.
 */
data class SettlementFacts(
    val paymentReference: String?,
    val valueDate: LocalDate?,
    val totalSettled: Money?,
    val deductions: List<SettlementDeduction>,
)

/** The root-cause categories of §9.23 "Denials". */
enum class DenialRootCause {
    ELIGIBILITY,
    AUTHORISATION,
    CODING,
    MEDICAL_NECESSITY,
    TIMELY_FILING,
    DUPLICATE,
    BUNDLING,
    CLINICAL_VALIDATION,
}

/**
 * One reason of a denial.
 *
 * @property code The governed denial-reason code.
 * @property rootCause Its root-cause category.
 * @property origin How it was entered.
 */
data class DenialReason(
    val code: String?,
    val rootCause: DenialRootCause?,
    val origin: ReasonOrigin?,
)

/**
 * The payer's denial.
 *
 * @property payerReference The payer's reference.
 * @property reasons Its reasons.
 */
data class DenialFacts(
    val payerReference: String?,
    val reasons: List<DenialReason>,
)

/**
 * The appeal.
 *
 * @property templateId The appeal template its grounds come from (§9.23 "appeal templates").
 * @property grounds The grounds text.
 * @property appealedItems The lines or deductions appealed.
 * @property amountAppealed The amount appealed.
 * @property supportingDocuments The supporting documents.
 */
data class AppealFacts(
    val templateId: String?,
    val grounds: String?,
    val appealedItems: Set<String>,
    val amountAppealed: Money?,
    val supportingDocuments: Set<String>,
)

/**
 * The withdrawal a command carries.
 *
 * @property reasonCode The governed withdrawal-reason code.
 * @property reasonOrigin How it was entered.
 */
data class WithdrawalFacts(
    val reasonCode: String?,
    val reasonOrigin: ReasonOrigin?,
)

/**
 * The correction a command carries (ReopenClaim).
 *
 * @property holdsCorrectionPrivilege The Trust Plane's answer: the user holds the privilege for this correction.
 * @property auditWritable The audit record can be written with it.
 * @property reason The correction reason.
 * @property reasonOrigin How it was entered.
 */
data class CorrectionFacts(
    val holdsCorrectionPrivilege: Boolean,
    val auditWritable: Boolean,
    val reason: String?,
    val reasonOrigin: ReasonOrigin?,
)
