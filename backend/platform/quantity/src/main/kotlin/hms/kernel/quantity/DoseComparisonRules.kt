// Helpers of the one audited comparison API (platform-kernel.md §10.5); they read magnitudes.
@file:OptIn(DoseMagnitudeAccess::class)

package hms.kernel.quantity

import java.math.BigDecimal

/** An exact sum, no rounding. */
internal fun sum(volumes: List<Quantity>): BigDecimal = volumes.fold(BigDecimal.ZERO) { total, volume -> total.add(volume.magnitude()) }

/** The (c) decision once the basis matches. */
internal fun decide(
    kb: KbDoseResult,
    ordered: DoseQuantity,
    factor: BigDecimal,
): KbDecision =
    when (kb) {
        is KbDoseResult.Ratio ->
            when {
                kb.ratio.signum() <= 0 -> KbDecision.Unavailable(UnavailableReason.KB_RESULT_INVALID)
                else -> KbDecision.of(kb.ratio >= factor)
            }
        is KbDoseResult.Maximum ->
            when {
                kb.maximum.unit != ordered.unit -> KbDecision.Unavailable(UnavailableReason.KB_MAXIMUM_NOT_IN_THE_ORDERED_UNIT)
                else -> KbDecision.of(ordered.magnitude() >= factor.multiply(kb.maximum.magnitude()))
            }
        is KbDoseResult.Flag -> decideFlag(kb, factor)
        KbDoseResult.NoneReturned -> KbDecision.Unavailable(UnavailableReason.KB_RETURNED_NONE)
    }

/**
 * A raised flag proves `dose >= kbMultiple × maximum`, a flag not raised proves `dose < kbMultiple × maximum`;
 * only those decide. A multiple of zero or less proves nothing, so it is `KB_RESULT_INVALID`.
 */
internal fun decideFlag(
    flag: KbDoseResult.Flag,
    factor: BigDecimal,
): KbDecision {
    val multiple = flag.kbMultiple
    return when {
        multiple == null -> KbDecision.Unavailable(UnavailableReason.KB_FLAG_THRESHOLD_UNKNOWN)
        multiple.signum() <= 0 -> KbDecision.Unavailable(UnavailableReason.KB_RESULT_INVALID)
        flag.raised && multiple >= factor -> KbDecision.AtOrAbove
        !flag.raised && multiple <= factor -> KbDecision.Below
        else -> KbDecision.Unavailable(UnavailableReason.KB_FLAG_NOT_COMPARABLE)
    }
}

internal fun kbInput(
    kb: KbDoseResult,
    displayed: Boolean,
): String {
    fun number(value: BigDecimal) = if (displayed) ClinicalNumberFormat.formatNumber(value) else value.toPlainString()
    return when (kb) {
        is KbDoseResult.Ratio -> "ratio ${number(kb.ratio)} basis ${kb.basis.code}"
        is KbDoseResult.Maximum -> {
            val maximum = if (displayed) kb.maximum.display() else kb.maximum.asEntered()
            "maximum $maximum basis ${kb.basis.code}"
        }
        is KbDoseResult.Flag -> {
            val state = if (kb.raised) "raised" else "not raised"
            "flag $state at multiple ${kb.kbMultiple?.let(::number) ?: "unknown"} basis ${kb.basis.code}"
        }
        KbDoseResult.NoneReturned -> "none returned"
    }
}

internal fun KbDoseResult.basis(): DoseBasis? =
    when (this) {
        is KbDoseResult.Ratio -> basis
        is KbDoseResult.Flag -> basis
        is KbDoseResult.Maximum -> basis
        KbDoseResult.NoneReturned -> null
    }

internal fun KbDoseResult.verbatim(): String? =
    when (this) {
        is KbDoseResult.Ratio -> verbatim
        is KbDoseResult.Flag -> verbatim
        is KbDoseResult.Maximum -> verbatim
        KbDoseResult.NoneReturned -> null
    }

internal fun FluidEntry.volume(): Quantity =
    when (this) {
        is FluidEntry.Measured -> volume
        is FluidEntry.Medication -> volume.asQuantity()
    }

internal fun FluidEntry.kind(): String =
    when (this) {
        is FluidEntry.Measured -> "measured"
        is FluidEntry.Medication -> "medication"
    }

/** One labelled input of a [ComparisonRecord]. */
internal class ComparisonInput(
    private val label: String,
    private val quantity: Quantity,
) {
    fun asEntered(): String = "$label ${quantity.asEntered()}"

    fun displayed(): String = "$label ${quantity.display()}"
}

/** The (c) decisions. */
internal sealed interface KbDecision {
    data object AtOrAbove : KbDecision

    data object Below : KbDecision

    data class Unavailable(
        val reason: UnavailableReason,
    ) : KbDecision

    companion object {
        fun of(atOrAbove: Boolean): KbDecision = if (atOrAbove) AtOrAbove else Below
    }
}

/** The (d) decisions, with their record outcome names. */
internal enum class RateDecision(
    val outcome: String,
) {
    UNIT_MISMATCH("UnitMismatch"),
    INVALID_ORDERED_RANGE("InvalidOrderedRange"),
    BELOW_MINIMUM("BelowMinimum"),
    ABOVE_MAXIMUM("AboveMaximum"),
    WITHIN("Within"),
}
