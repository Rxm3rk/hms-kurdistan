// This package is allowed to read magnitudes (platform-kernel.md §10.1, §11).
@file:OptIn(DoseMagnitudeAccess::class)

package hms.kernel.quantity

import java.math.BigDecimal

/**
 * A medication amount, concentration or volume (platform-kernel.md §10.3; SI-05; §6.2; CTRL-0005-4). It cannot
 * exist without a syntactically valid UCUM unit that contains a unit atom, and its magnitude is greater than zero.
 * No arithmetic operators and not [Comparable]; equality is the wrapped [Quantity]'s (representational).
 * `init` re-checks both rules, so a reflective construction with an invalid value throws.
 */
class DoseQuantity private constructor(
    private val quantity: Quantity,
) {
    init {
        require(quantity.unit.hasUnitAtom) { "DoseQuantity unit must contain a unit atom, got ${quantity.unit.code}" }
        require(quantity.magnitude().signum() > 0) { "DoseQuantity magnitude must be greater than zero" }
    }

    val unit: UcumUnit get() = quantity.unit

    /** ArchUnit: callable only from `hms.reg.dose..`, `hms.kernel.quantity..` and `..infrastructure.persistence..`. */
    @DoseMagnitudeAccess
    fun magnitude(): BigDecimal = quantity.magnitude()

    /** The number as entered (scale kept) plus the unit code, for records. */
    fun asEntered(): String = quantity.asEntered()

    /** ISMP display (platform-kernel.md §10.4). */
    fun display(): String = quantity.display()

    /** The wrapped quantity, for the comparison API in this package. */
    internal fun asQuantity(): Quantity = quantity

    override fun equals(other: Any?): Boolean = other is DoseQuantity && quantity == other.quantity

    override fun hashCode(): Int = quantity.hashCode()

    override fun toString(): String = display()

    companion object {
        /** Wraps [quantity], refusing a unit without a unit atom or a magnitude that is zero or negative. */
        @JvmStatic
        fun of(quantity: Quantity): DoseQuantityResult =
            when (val refusal = doseRefusal(quantity.unit, quantity.magnitude(), zeroAllowed = false)) {
                null -> DoseQuantityResult.Valid(DoseQuantity(quantity))
                else -> DoseQuantityResult.Refused(refusal)
            }

        /** Parses a dose as entered on any channel: the unit first (missing, syntax, unit atom), then the number. */
        @JvmStatic
        fun parse(
            entered: String,
            unitCode: String?,
        ): DoseQuantityResult =
            when (val parsed = parseDoseInput(entered, unitCode)) {
                is DoseInput.Refused -> DoseQuantityResult.Refused(parsed.reason)
                is DoseInput.Parsed -> of(parsed.quantity)
            }
    }
}

/**
 * A dose rate or a titration bound (platform-kernel.md §10.3; SI-05 §2.1 (d)). It cannot exist without a
 * syntactically valid UCUM unit that contains a unit atom; its magnitude is zero or more, so a titration minimum
 * of 0 and a paused rate stay inside the unit-mandatory types. No arithmetic operators and not [Comparable].
 */
class DoseRate private constructor(
    private val quantity: Quantity,
) {
    init {
        require(quantity.unit.hasUnitAtom) { "DoseRate unit must contain a unit atom, got ${quantity.unit.code}" }
        require(quantity.magnitude().signum() >= 0) { "DoseRate magnitude must not be negative" }
    }

    val unit: UcumUnit get() = quantity.unit

    /** ArchUnit: callable only from `hms.reg.dose..`, `hms.kernel.quantity..` and `..infrastructure.persistence..`. */
    @DoseMagnitudeAccess
    fun magnitude(): BigDecimal = quantity.magnitude()

    /** The number as entered (scale kept) plus the unit code, for records. */
    fun asEntered(): String = quantity.asEntered()

    /** ISMP display (platform-kernel.md §10.4). */
    fun display(): String = quantity.display()

    /** The wrapped quantity, for the comparison API in this package. */
    internal fun asQuantity(): Quantity = quantity

    override fun equals(other: Any?): Boolean = other is DoseRate && quantity == other.quantity

    override fun hashCode(): Int = quantity.hashCode()

    override fun toString(): String = display()

    companion object {
        /** Wraps [quantity], refusing a unit without a unit atom or a negative magnitude. */
        @JvmStatic
        fun of(quantity: Quantity): DoseRateResult =
            when (val refusal = doseRefusal(quantity.unit, quantity.magnitude(), zeroAllowed = true)) {
                null -> DoseRateResult.Valid(DoseRate(quantity))
                else -> DoseRateResult.Refused(refusal)
            }

        /** Parses a rate as entered on any channel: the unit first (missing, syntax, unit atom), then the number. */
        @JvmStatic
        fun parse(
            entered: String,
            unitCode: String?,
        ): DoseRateResult =
            when (val parsed = parseDoseInput(entered, unitCode)) {
                is DoseInput.Refused -> DoseRateResult.Refused(parsed.reason)
                is DoseInput.Parsed -> of(parsed.quantity)
            }
    }
}

/** The result of [DoseQuantity.of] and [DoseQuantity.parse]. */
sealed interface DoseQuantityResult {
    data class Valid(
        val dose: DoseQuantity,
    ) : DoseQuantityResult

    data class Refused(
        val reason: DoseQuantityRefusal,
    ) : DoseQuantityResult
}

/** The result of [DoseRate.of] and [DoseRate.parse]. */
sealed interface DoseRateResult {
    data class Valid(
        val rate: DoseRate,
    ) : DoseRateResult

    data class Refused(
        val reason: DoseQuantityRefusal,
    ) : DoseRateResult
}

/**
 * Why a dose or rate is refused (platform-kernel.md §10.3). A dose of zero or less is `NOT_POSITIVE`; a negative
 * rate is `NEGATIVE`.
 */
enum class DoseQuantityRefusal { MISSING_UNIT, INVALID_UNIT_SYNTAX, UNIT_HAS_NO_UNIT_ATOM, INVALID_NUMBER, NOT_POSITIVE, NEGATIVE }

private sealed interface DoseInput {
    data class Parsed(
        val quantity: Quantity,
    ) : DoseInput

    data class Refused(
        val reason: DoseQuantityRefusal,
    ) : DoseInput
}

private fun parseDoseInput(
    entered: String,
    unitCode: String?,
): DoseInput =
    when (val parsedUnit = unitCode?.takeIf { it.isNotBlank() }?.let(UcumUnit::parse)) {
        null -> DoseInput.Refused(DoseQuantityRefusal.MISSING_UNIT)
        is UcumParseResult.Invalid -> DoseInput.Refused(DoseQuantityRefusal.INVALID_UNIT_SYNTAX)
        is UcumParseResult.Valid -> parseDoseNumber(entered, parsedUnit.unit)
    }

private fun parseDoseNumber(
    entered: String,
    unit: UcumUnit,
): DoseInput =
    if (!unit.hasUnitAtom) {
        DoseInput.Refused(DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM)
    } else {
        when (val number = Quantity.parse(entered, unit)) {
            is QuantityParseResult.Invalid -> DoseInput.Refused(DoseQuantityRefusal.INVALID_NUMBER)
            is QuantityParseResult.Valid -> DoseInput.Parsed(number.quantity)
        }
    }

private fun doseRefusal(
    unit: UcumUnit,
    magnitude: BigDecimal,
    zeroAllowed: Boolean,
): DoseQuantityRefusal? =
    when {
        !unit.hasUnitAtom -> DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM
        zeroAllowed && magnitude.signum() < 0 -> DoseQuantityRefusal.NEGATIVE
        !zeroAllowed && magnitude.signum() <= 0 -> DoseQuantityRefusal.NOT_POSITIVE
        else -> null
    }
