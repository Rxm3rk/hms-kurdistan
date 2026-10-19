package hms.kernel.quantity

import java.math.BigDecimal

/**
 * Kotlin opt-in marker for the dose and quantity magnitude accessors and [Quantity.ofMagnitude]
 * (platform-kernel.md §10.1, §11; SI-05; CTRL-0005-5). The binding check is
 * `ArchTest:dose-and-quantity-operations-only-in-reg-dose`: calls only from `hms.reg.dose..`,
 * `hms.kernel.quantity..` and `..infrastructure.persistence..`.
 */
@RequiresOptIn(
    level = RequiresOptIn.Level.ERROR,
    message = "Dose magnitudes are for reg-dose, hms.kernel.quantity and persistence mapping only (platform-kernel.md §10.1, §11).",
)
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class DoseMagnitudeAccess

/**
 * A magnitude with a UCUM unit (platform-kernel.md §10.1; §6.2). No arithmetic operators and not [Comparable]:
 * a magnitude leaves only through [magnitude], clinical comparisons go through [DoseComparisons]. Equality is
 * representational (the same unit code and the same [BigDecimal], scale included), so `0.5` and `0.50` differ.
 * `init` checks that the scale is between 0 and [MAX_FRACTION_DIGITS].
 */
class Quantity private constructor(
    magnitude: BigDecimal,
    val unit: UcumUnit,
) {
    private val amount: BigDecimal = magnitude

    init {
        require(magnitude.scale() in 0..MAX_FRACTION_DIGITS) {
            "Quantity scale must be between 0 and $MAX_FRACTION_DIGITS, got ${magnitude.scale()}"
        }
    }

    /** ArchUnit: callable only from `hms.reg.dose..`, `hms.kernel.quantity..` and `..infrastructure.persistence..`. */
    @DoseMagnitudeAccess
    fun magnitude(): BigDecimal = amount

    /** The number as entered (scale kept) plus the unit code, for records. */
    fun asEntered(): String = "${amount.toPlainString()} ${unit.code}"

    /** ISMP display (platform-kernel.md §10.4). */
    fun display(): String = ClinicalNumberFormat.format(this)

    override fun equals(other: Any?): Boolean = other is Quantity && unit == other.unit && amount == other.amount

    override fun hashCode(): Int = 31 * unit.hashCode() + amount.hashCode()

    override fun toString(): String = display()

    companion object {
        /** At most this many significant digits are accepted as input (platform-kernel.md §10.4). */
        const val MAX_SIGNIFICANT_DIGITS: Int = 34

        /** At most this many digits after the decimal point (platform-kernel.md §10.4). */
        const val MAX_FRACTION_DIGITS: Int = 15

        /** Parses a number as entered (platform-kernel.md §10.4); the scale as entered is kept. */
        @JvmStatic
        fun parse(
            entered: String,
            unit: UcumUnit,
        ): QuantityParseResult =
            when (val number = PlainDecimal.parse(entered)) {
                is PlainDecimal.Result.Valid -> QuantityParseResult.Valid(Quantity(number.value, unit))
                is PlainDecimal.Result.Invalid -> QuantityParseResult.Invalid(number.error)
            }

        /**
         * Rebuilds a quantity from a stored magnitude. ArchUnit: callable only from `hms.reg.dose..`,
         * `hms.kernel.quantity..` and `..infrastructure.persistence..`. Throws [IllegalArgumentException] for a
         * negative scale or more than [MAX_FRACTION_DIGITS] digits after the point.
         */
        @DoseMagnitudeAccess
        @JvmStatic
        fun ofMagnitude(
            magnitude: BigDecimal,
            unit: UcumUnit,
        ): Quantity = Quantity(magnitude, unit)
    }
}

/** The result of [Quantity.parse]. */
sealed interface QuantityParseResult {
    data class Valid(
        val quantity: Quantity,
    ) : QuantityParseResult

    data class Invalid(
        val error: NumberSyntaxError,
    ) : QuantityParseResult
}

/** Why an entered number is refused (platform-kernel.md §10.4). */
enum class NumberSyntaxError {
    EMPTY,
    NOT_A_PLAIN_DECIMAL,
    NAKED_DECIMAL_POINT,
    TRAILING_DECIMAL_POINT,
    EXPONENT_NOT_ALLOWED,
    GROUPING_SEPARATOR,
    NON_ASCII_DIGIT,
    TOO_MANY_DIGITS,
}

/**
 * The input rule of platform-kernel.md §10.4: optional `-`, ASCII digits, an optional `.` followed by ASCII digits.
 * Checked in the order of [NumberSyntaxError]'s most specific cause first: empty, non-ASCII digit, grouping
 * separator between digits, exponent, naked point, trailing point, anything else, then the digit limits.
 */
internal object PlainDecimal {
    private val PLAIN = Regex("-?[0-9]+(\\.[0-9]+)?")
    private val EXPONENT = Regex("-?([0-9]+(\\.[0-9]*)?|\\.[0-9]+)[eE][+-]?[0-9]+")
    private val NAKED = Regex("-?\\.[0-9]+")
    private val TRAILING = Regex("-?[0-9]+\\.")

    /** Comma, apostrophe, underscore, space, no-break and thin spaces, and the Arabic thousands separator. */
    private const val GROUPING = ",'_    ٬"

    sealed interface Result {
        data class Valid(
            val value: BigDecimal,
        ) : Result

        data class Invalid(
            val error: NumberSyntaxError,
        ) : Result
    }

    fun parse(entered: String): Result {
        val error =
            when {
                entered.isEmpty() -> NumberSyntaxError.EMPTY
                entered.any { Character.isDigit(it) && !it.isAsciiDigit() } -> NumberSyntaxError.NON_ASCII_DIGIT
                hasGroupingBetweenDigits(entered) -> NumberSyntaxError.GROUPING_SEPARATOR
                EXPONENT.matches(entered) -> NumberSyntaxError.EXPONENT_NOT_ALLOWED
                NAKED.matches(entered) -> NumberSyntaxError.NAKED_DECIMAL_POINT
                TRAILING.matches(entered) -> NumberSyntaxError.TRAILING_DECIMAL_POINT
                !PLAIN.matches(entered) -> NumberSyntaxError.NOT_A_PLAIN_DECIMAL
                else -> null
            }
        val value = if (error == null) BigDecimal(entered) else null
        val tooManyDigits =
            value != null &&
                (value.precision() > Quantity.MAX_SIGNIFICANT_DIGITS || value.scale() > Quantity.MAX_FRACTION_DIGITS)
        return when {
            error != null -> Result.Invalid(error)
            value == null || tooManyDigits -> Result.Invalid(NumberSyntaxError.TOO_MANY_DIGITS)
            else -> Result.Valid(value)
        }
    }

    private fun hasGroupingBetweenDigits(entered: String): Boolean =
        entered.indices.any { index ->
            entered[index] in GROUPING &&
                entered.getOrNull(index - 1)?.isAsciiDigit() == true &&
                entered.getOrNull(index + 1)?.isAsciiDigit() == true
        }
}
