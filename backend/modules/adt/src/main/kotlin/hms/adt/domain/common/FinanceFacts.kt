package hms.adt.domain.common

/** A payer's pre-approval as RCM would report it. No adt predicate reads it (SI-12). */
enum class PreApprovalStatus {
    NOT_REQUIRED,
    PENDING,
    APPROVED,
    DENIED,
    MISSING,
    UNKNOWN,
}

/**
 * Payment facts that no predicate of the encounter or bed machine reads, carried on purpose so that a property test can
 * show that changing them never changes any guard (BUILD-PROMPT §2.1 SI-12; HAZ-0012; CTRL-0012-3; encounter.yaml and
 * bed.yaml headers: "no financial predicate may be added to any guard"). Synthetic values only.
 *
 * @property outstandingBalanceMinor The patient's unpaid balance in minor currency units, or null when unknown.
 * @property depositPaid Whether a deposit was paid.
 * @property preApproval The payer's pre-approval status.
 */
data class FinanceFacts(
    val outstandingBalanceMinor: Long?,
    val depositPaid: Answer,
    val preApproval: PreApprovalStatus,
)
