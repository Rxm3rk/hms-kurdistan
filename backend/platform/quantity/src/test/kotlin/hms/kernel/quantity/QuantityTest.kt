package hms.kernel.quantity

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Modifier
import java.math.BigDecimal

/** `Quantity`: the unit is required, input numbers are plain decimals, the scale is kept (platform-kernel.md §10.1, §10.4). */
class QuantityTest :
    FunSpec({
        val mg = QuantityFixtures.unit("mg")

        test("quantity-requires-ucum-unit: every constructor and factory that makes a Quantity takes a parsed UcumUnit") {
            // Kotlin's synthetic accessor constructor cannot be called from source.
            val constructors = Quantity::class.java.declaredConstructors.filterNot { it.isSynthetic }
            constructors.shouldNotBeEmpty()
            constructors.forEach { constructor ->
                withClue(constructor) {
                    Modifier.isPrivate(constructor.modifiers) shouldBe true
                    constructor.parameterTypes.toList().contains(UcumUnit::class.java) shouldBe true
                }
            }
            val factories =
                (Quantity::class.java.declaredMethods.filter { Modifier.isStatic(it.modifiers) } + Quantity.Companion::class.java.declaredMethods)
                    .filter { Modifier.isPublic(it.modifiers) && !it.isSynthetic }
                    .filter { it.returnType == Quantity::class.java || it.returnType == QuantityParseResult::class.java }
            factories.map { it.name }.sorted() shouldBe listOf("ofMagnitude", "ofMagnitude", "parse", "parse")
            factories.forEach { factory ->
                withClue(factory) { factory.parameterTypes.toList().contains(UcumUnit::class.java) shouldBe true }
            }
            // A UcumUnit exists only after the syntax check.
            UcumUnit::class.java.declaredConstructors.filterNot { it.isSynthetic }.all { Modifier.isPrivate(it.modifiers) } shouldBe true
        }

        test("a plain decimal is accepted and its scale kept as entered") {
            listOf("0", "5", "0.5", "0.50", "10", "100.0", "-3", "-0.25", "007", "0.000000000000001").forEach { entered ->
                withClue(entered) {
                    val quantity = Quantity.parse(entered, mg).shouldBeInstanceOf<QuantityParseResult.Valid>().quantity
                    quantity.unit shouldBe mg
                    quantity.asEntered() shouldBe "${BigDecimal(entered).toPlainString()} mg"
                }
            }
            QuantityFixtures.quantity("0.50", "mg").asEntered() shouldBe "0.50 mg"
            QuantityFixtures.quantity("100.0", "mL").asEntered() shouldBe "100.0 mL"
        }

        test("input that is not a plain ASCII decimal is refused with its reason") {
            val vectors =
                listOf(
                    "" to NumberSyntaxError.EMPTY,
                    "abc" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "+5" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "-" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "--5" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "1.2.3" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    " 5" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "5 " to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "5mg" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "0x10" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "1/2" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "NaN" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "Infinity" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    "5\u066B5" to NumberSyntaxError.NOT_A_PLAIN_DECIMAL,
                    ".5" to NumberSyntaxError.NAKED_DECIMAL_POINT,
                    "-.5" to NumberSyntaxError.NAKED_DECIMAL_POINT,
                    "5." to NumberSyntaxError.TRAILING_DECIMAL_POINT,
                    "-5." to NumberSyntaxError.TRAILING_DECIMAL_POINT,
                    "1e3" to NumberSyntaxError.EXPONENT_NOT_ALLOWED,
                    "1E3" to NumberSyntaxError.EXPONENT_NOT_ALLOWED,
                    "1.5e-3" to NumberSyntaxError.EXPONENT_NOT_ALLOWED,
                    "-2E+2" to NumberSyntaxError.EXPONENT_NOT_ALLOWED,
                    ".5e3" to NumberSyntaxError.EXPONENT_NOT_ALLOWED,
                    "1,000" to NumberSyntaxError.GROUPING_SEPARATOR,
                    "1,5" to NumberSyntaxError.GROUPING_SEPARATOR,
                    "1 000" to NumberSyntaxError.GROUPING_SEPARATOR,
                    "1'000" to NumberSyntaxError.GROUPING_SEPARATOR,
                    "1_000" to NumberSyntaxError.GROUPING_SEPARATOR,
                    "1\u00A0000" to NumberSyntaxError.GROUPING_SEPARATOR,
                    "1\u202F000" to NumberSyntaxError.GROUPING_SEPARATOR,
                    "1\u066C000" to NumberSyntaxError.GROUPING_SEPARATOR,
                    "\u0665" to NumberSyntaxError.NON_ASCII_DIGIT,
                    "\u06F5" to NumberSyntaxError.NON_ASCII_DIGIT,
                    "\uFF15" to NumberSyntaxError.NON_ASCII_DIGIT,
                    "1\u0660" to NumberSyntaxError.NON_ASCII_DIGIT,
                    "1".repeat(Quantity.MAX_SIGNIFICANT_DIGITS + 1) to NumberSyntaxError.TOO_MANY_DIGITS,
                    "0." + "1".repeat(Quantity.MAX_FRACTION_DIGITS + 1) to NumberSyntaxError.TOO_MANY_DIGITS,
                    "0." + "0".repeat(Quantity.MAX_FRACTION_DIGITS + 1) to NumberSyntaxError.TOO_MANY_DIGITS,
                )
            vectors.forEach { (entered, error) ->
                withClue(entered) { Quantity.parse(entered, mg) shouldBe QuantityParseResult.Invalid(error) }
            }
        }

        test("the digit limits are inclusive: 34 significant digits and 15 after the point are accepted") {
            val limits =
                listOf(
                    "1".repeat(Quantity.MAX_SIGNIFICANT_DIGITS),
                    "1".repeat(Quantity.MAX_SIGNIFICANT_DIGITS - Quantity.MAX_FRACTION_DIGITS) + "." +
                        "1".repeat(Quantity.MAX_FRACTION_DIGITS),
                    "0." + "0".repeat(Quantity.MAX_FRACTION_DIGITS - 1) + "1",
                    // Leading zeros are not significant.
                    "000" + "1".repeat(Quantity.MAX_SIGNIFICANT_DIGITS),
                )
            limits.forEach { entered ->
                withClue(entered) { Quantity.parse(entered, mg).shouldBeInstanceOf<QuantityParseResult.Valid>() }
            }
        }

        test("equality is representational: unit code and BigDecimal with its scale") {
            QuantityFixtures.quantity("0.5", "mg") shouldBe QuantityFixtures.quantity("0.5", "mg")
            QuantityFixtures.quantity("0.5", "mg").hashCode() shouldBe QuantityFixtures.quantity("0.5", "mg").hashCode()
            QuantityFixtures.quantity("0.5", "mg") shouldNotBe QuantityFixtures.quantity("0.50", "mg")
            QuantityFixtures.quantity("0.5", "mg") shouldNotBe QuantityFixtures.quantity("0.5", "mL")
            QuantityFixtures.quantity("0.50", "mg").toString() shouldBe "0.5 mg"
        }

        test("ofMagnitude rebuilds a stored value with its scale and refuses a scale outside 0 to 15") {
            @OptIn(DoseMagnitudeAccess::class)
            fun rebuild(value: BigDecimal) = Quantity.ofMagnitude(value, mg)

            @OptIn(DoseMagnitudeAccess::class)
            val magnitude = rebuild(BigDecimal("2.50")).magnitude()
            magnitude shouldBe BigDecimal("2.50")
            rebuild(BigDecimal("2.50")) shouldBe QuantityFixtures.quantity("2.50", "mg")
            shouldThrow<IllegalArgumentException> { rebuild(BigDecimal("1E+1")) }
            shouldThrow<IllegalArgumentException> { rebuild(BigDecimal("0." + "0".repeat(Quantity.MAX_FRACTION_DIGITS) + "1")) }
        }

        test("reflective construction with an invalid scale throws IllegalArgumentException") {
            val constructor = Quantity::class.java.declaredConstructors.single { it.parameterCount == 2 }.apply { isAccessible = true }
            shouldThrow<InvocationTargetException> { constructor.newInstance(BigDecimal("1E+2"), mg) }
                .cause
                .shouldBeInstanceOf<IllegalArgumentException>()
        }
    })
