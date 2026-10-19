package hms.kernel.quantity

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.InvocationTargetException
import java.math.BigDecimal

/** `DoseQuantity` and `DoseRate` cannot exist without a unit (platform-kernel.md §10.3; SI-05; CTRL-0005-4). */
class DoseQuantityTest :
    FunSpec({
        val unitRefusals =
            listOf(
                null to DoseQuantityRefusal.MISSING_UNIT,
                "" to DoseQuantityRefusal.MISSING_UNIT,
                "   " to DoseQuantityRefusal.MISSING_UNIT,
                "\t" to DoseQuantityRefusal.MISSING_UNIT,
                " mg" to DoseQuantityRefusal.INVALID_UNIT_SYNTAX,
                "m g" to DoseQuantityRefusal.INVALID_UNIT_SYNTAX,
                "mg/" to DoseQuantityRefusal.INVALID_UNIT_SYNTAX,
                "(mg" to DoseQuantityRefusal.INVALID_UNIT_SYNTAX,
                "1" to DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM,
                "100" to DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM,
                "10*3" to DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM,
                "10^3" to DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM,
                "{tablet}" to DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM,
                "1{tablet}" to DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM,
                "(1)/10*3" to DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM,
            )

        test("kernel-dose-quantity-refuses-unitless: a missing, invalid or atom-less unit is refused for doses and rates") {
            unitRefusals.forEach { (unitCode, refusal) ->
                withClue(unitCode) {
                    DoseQuantity.parse("5", unitCode) shouldBe DoseQuantityResult.Refused(refusal)
                    DoseRate.parse("5", unitCode) shouldBe DoseRateResult.Refused(refusal)
                }
            }
        }

        test("the unit is checked before the number") {
            DoseQuantity.parse("abc", null) shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.MISSING_UNIT)
            DoseQuantity.parse("-1", "1") shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM)
            DoseRate.parse(".5", "x y") shouldBe DoseRateResult.Refused(DoseQuantityRefusal.INVALID_UNIT_SYNTAX)
        }

        test("an invalid number is INVALID_NUMBER") {
            listOf("", ".5", "5.", "1e3", "1,000", "٥", "five").forEach { entered ->
                withClue(entered) {
                    DoseQuantity.parse(entered, "mg") shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.INVALID_NUMBER)
                    DoseRate.parse(entered, "mL/h") shouldBe DoseRateResult.Refused(DoseQuantityRefusal.INVALID_NUMBER)
                }
            }
        }

        test("a dose must be greater than zero; a rate may be zero but never negative") {
            listOf("0", "0.00", "-0", "-1", "-0.001").forEach { entered ->
                withClue(entered) {
                    DoseQuantity.parse(entered, "mg") shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.NOT_POSITIVE)
                }
            }
            listOf("-1", "-0.001").forEach { entered ->
                withClue(entered) { DoseRate.parse(entered, "mL/h") shouldBe DoseRateResult.Refused(DoseQuantityRefusal.NEGATIVE) }
            }
            listOf("0", "0.0", "-0").forEach { entered ->
                withClue(entered) { DoseRate.parse(entered, "mL/h").shouldBeInstanceOf<DoseRateResult.Valid>() }
            }
            DoseQuantity.parse("0.001", "mg").shouldBeInstanceOf<DoseQuantityResult.Valid>()
        }

        test("a valid dose keeps the unit, the number as entered and the ISMP display") {
            val dose = DoseQuantity.parse("0.50", "mg").shouldBeInstanceOf<DoseQuantityResult.Valid>().dose
            dose.unit shouldBe QuantityFixtures.unit("mg")
            dose.asEntered() shouldBe "0.50 mg"
            dose.display() shouldBe "0.5 mg"
            dose.toString() shouldBe "0.5 mg"

            @OptIn(DoseMagnitudeAccess::class)
            val magnitude = dose.magnitude()
            magnitude shouldBe BigDecimal("0.50")
            val rate = QuantityFixtures.rate("2.50", "mL/h")
            rate.unit shouldBe QuantityFixtures.unit("mL/h")
            rate.asEntered() shouldBe "2.50 mL/h"
            rate.display() shouldBe "2.5 mL/h"
        }

        test("of wraps a quantity with the same rules") {
            DoseQuantity.of(QuantityFixtures.quantity("5", "mg")).shouldBeInstanceOf<DoseQuantityResult.Valid>().dose.asEntered() shouldBe
                "5 mg"
            DoseQuantity.of(QuantityFixtures.quantity("5", "1")) shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM)
            DoseQuantity.of(QuantityFixtures.quantity("0", "mg")) shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.NOT_POSITIVE)
            DoseRate.of(QuantityFixtures.quantity("0", "mL/h")).shouldBeInstanceOf<DoseRateResult.Valid>()
            DoseRate.of(QuantityFixtures.quantity("-2", "mL/h")) shouldBe DoseRateResult.Refused(DoseQuantityRefusal.NEGATIVE)
            DoseRate.of(QuantityFixtures.quantity("2", "{drop}")) shouldBe DoseRateResult.Refused(DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM)
        }

        test("a stored dose is rebuilt through ofMagnitude and of, which validate again") {
            @OptIn(DoseMagnitudeAccess::class)
            fun stored(value: String) = Quantity.ofMagnitude(BigDecimal(value), QuantityFixtures.unit("mg"))
            DoseQuantity.of(stored("2.50")) shouldBe DoseQuantityResult.Valid(QuantityFixtures.dose("2.50", "mg"))
            DoseQuantity.of(stored("-2.50")) shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.NOT_POSITIVE)
        }

        test("dose and rate equality is representational and never crosses types") {
            QuantityFixtures.dose("0.5", "mg") shouldBe QuantityFixtures.dose("0.5", "mg")
            QuantityFixtures.dose("0.5", "mg").hashCode() shouldBe QuantityFixtures.dose("0.5", "mg").hashCode()
            QuantityFixtures.dose("0.5", "mg") shouldNotBe QuantityFixtures.dose("0.50", "mg")
            QuantityFixtures.rate("0.5", "mg") shouldNotBe QuantityFixtures.dose("0.5", "mg")
            QuantityFixtures.rate("1", "mL/h") shouldBe QuantityFixtures.rate("1", "mL/h")
        }

        test("reflective construction of a unit-less or out-of-range dose or rate throws IllegalArgumentException") {
            fun construct(
                type: Class<*>,
                quantity: Quantity,
            ): Any = type.declaredConstructors.single { it.parameterCount == 1 }.apply { isAccessible = true }.newInstance(quantity)

            construct(DoseQuantity::class.java, QuantityFixtures.quantity("1", "mg")).shouldBeInstanceOf<DoseQuantity>()
            construct(DoseRate::class.java, QuantityFixtures.quantity("0", "mL/h")).shouldBeInstanceOf<DoseRate>()
            listOf(
                DoseQuantity::class.java to QuantityFixtures.quantity("1", "1"),
                DoseQuantity::class.java to QuantityFixtures.quantity("0", "mg"),
                DoseRate::class.java to QuantityFixtures.quantity("1", "{drop}"),
                DoseRate::class.java to QuantityFixtures.quantity("-1", "mL/h"),
            ).forEach { (type, quantity) ->
                withClue("$type $quantity") {
                    shouldThrow<InvocationTargetException> { construct(type, quantity) }.cause.shouldBeInstanceOf<IllegalArgumentException>()
                }
            }
        }
    })
