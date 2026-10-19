package hms.kernel.quantity

import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.choice
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.long
import io.kotest.property.arbitrary.orNull
import io.kotest.property.arbitrary.string
import io.kotest.property.arbitrary.stringPattern
import java.math.BigDecimal

private const val MAX_INTEGER_DIGITS = 12
private const val MAX_RANDOM_CODE_LENGTH = 12
private const val MAX_UNSCALED = 10_000_000_000L
private const val SMALL_VALUES = 30L

/** Generators for the quantity property tests (platform-kernel.md §17). Synthetic values only. */
object QuantityArbs {
    /** Unit codes with a unit atom, without one, and invalid ones; BUILD-PROMPT's own codes or synthetic symbols. */
    val unitsWithAtom: List<String> = listOf("mg", "mL", "mL/h", "xa", "xa2", "/h", "(xa.xb)/xc", "xa{note}", "10*3/mL", "[xa]")
    val unitsWithoutAtom: List<String> = listOf("1", "100", "10*3", "10^-2", "{tablet}", "1{tablet}", "(1)/10*3", "{}")
    val invalidUnits: List<String> = listOf(" mg", "m g", "mg/", "(mg", "xa)", "{xa", "xa-", "//xa", "µg", "xa..xb")

    /** Any unit code: the pools, null, blanks, and random strings over the grammar's characters. */
    val unitCodes: Arb<String?> =
        Arb.choice(
            Arb.element(unitsWithAtom),
            Arb.element(unitsWithoutAtom),
            Arb.element(invalidUnits),
            Arb.element("", " ", "\t"),
            grammarStrings(),
        ).orNull(nullProbability = 0.1)

    /** Random strings over the UCUM grammar's characters plus a few illegal ones. */
    fun grammarStrings(): Arb<String> =
        Arb.string(0..MAX_RANDOM_CODE_LENGTH, Arb.element("xm1023./()[]{}+-*^%' _µ".toList()).toCodepoints())

    /** Plain decimal strings as a person would type them: optional sign, digits, optional point and up to 15 digits. */
    val plainDecimals: Arb<String> =
        arbitrary {
            val sign = if (Arb.int(0..4).bind() == 0) "-" else ""
            val integer = Arb.stringPattern("[0-9]{1,$MAX_INTEGER_DIGITS}").bind()
            val fraction = Arb.int(0..Quantity.MAX_FRACTION_DIGITS).bind()
            val fractionDigits = if (fraction == 0) "" else "." + Arb.stringPattern("[0-9]{$fraction}").bind()
            sign + integer + fractionDigits
        }

    /** Entered numbers: mostly plain decimals, some malformed. */
    val enteredNumbers: Arb<String> =
        Arb.choice(
            plainDecimals,
            plainDecimals,
            Arb.element("", ".5", "5.", "1e3", "1,000", "٥", "+1", "abc", "1 000", "0x1"),
        )

    /** Decimals with a scale of 0 to 15, positive, zero and negative. */
    val decimals: Arb<BigDecimal> =
        arbitrary {
            BigDecimal.valueOf(Arb.long(-MAX_UNSCALED..MAX_UNSCALED).bind(), Arb.int(0..Quantity.MAX_FRACTION_DIGITS).bind())
        }

    /** Small positive decimals whose values collide often, with random trailing zeros. */
    val collidingPositives: Arb<BigDecimal> =
        arbitrary {
            val value = BigDecimal.valueOf(Arb.long(1L..SMALL_VALUES).bind(), Arb.int(0..1).bind())
            if (Arb.boolean().bind()) value.setScale(value.scale() + Arb.int(0..2).bind()) else value
        }
}

private fun Arb<Char>.toCodepoints(): Arb<io.kotest.property.arbitrary.Codepoint> =
    arbitrary { io.kotest.property.arbitrary.Codepoint(this@toCodepoints.bind().code) }
