package hms.kernel.quantity

import hms.kernel.testing.PropertyTestBudget
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.kotest.property.Arb
import io.kotest.property.arbitrary.element
import io.kotest.property.checkAll
import java.math.BigDecimal

/**
 * Units, doses and the clinical number display (platform-kernel.md §10.2 to §10.4, §17):
 * `PropertyTest:kernel-dose-quantity-refuses-unitless` and `PropertyTest:kernel-display-never-changes-value`.
 */
class QuantityPropertyTest :
    FunSpec({
        val budget = PropertyTestBudget.sequences()

        test("kernel-dose-quantity-refuses-unitless: a dose is valid only with a unit atom and a positive magnitude, a rate non-negative") {
            checkAll(budget, QuantityArbs.enteredNumbers, QuantityArbs.unitCodes) { entered, unitCode ->
                val expected = Oracle.refusal(entered, unitCode)
                val dose = DoseQuantity.parse(entered, unitCode)
                val rate = DoseRate.parse(entered, unitCode)
                withClue("'$entered' '$unitCode'") {
                    when (expected) {
                        null -> {
                            val valid = dose.shouldBeInstanceOf<DoseQuantityResult.Valid>().dose
                            valid.unit.code shouldBe unitCode
                            valid.unit.hasUnitAtom shouldBe true
                            rate.shouldBeInstanceOf<DoseRateResult.Valid>()
                        }
                        DoseQuantityRefusal.NOT_POSITIVE -> {
                            dose shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.NOT_POSITIVE)
                            if (BigDecimal(entered).signum() < 0) {
                                rate shouldBe DoseRateResult.Refused(DoseQuantityRefusal.NEGATIVE)
                            } else {
                                rate.shouldBeInstanceOf<DoseRateResult.Valid>()
                            }
                        }
                        else -> {
                            dose shouldBe DoseQuantityResult.Refused(expected)
                            rate shouldBe DoseRateResult.Refused(expected)
                        }
                    }
                }
            }
        }

        test("kernel-dose-quantity-refuses-unitless: no unit-less unit code ever makes a dose or a rate") {
            checkAll(budget, QuantityArbs.plainDecimals, Arb.element(QuantityArbs.unitsWithoutAtom)) { entered, unitCode ->
                DoseQuantity.parse(entered, unitCode) shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM)
                DoseRate.parse(entered, unitCode) shouldBe DoseRateResult.Refused(DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM)
                val quantity = (Quantity.parse(entered, QuantityFixtures.unit(unitCode)) as QuantityParseResult.Valid).quantity
                DoseQuantity.of(quantity) shouldBe DoseQuantityResult.Refused(DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM)
                DoseRate.of(quantity) shouldBe DoseRateResult.Refused(DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM)
            }
        }

        test("kernel-display-never-changes-value: parsing the displayed number gives the same value, for any entered decimal") {
            checkAll(budget, QuantityArbs.plainDecimals) { entered ->
                val quantity = QuantityFixtures.quantity(entered, "mL")
                quantity.asEntered() shouldBe "${BigDecimal(entered).toPlainString()} mL"
                assertDisplayKeepsValue(quantity, BigDecimal(entered))
            }
        }

        test("kernel-display-never-changes-value: the same for any stored magnitude, through doses and rates too") {
            checkAll(budget, QuantityArbs.decimals) { value ->
                @OptIn(DoseMagnitudeAccess::class)
                val quantity = Quantity.ofMagnitude(value, QuantityFixtures.unit("mg"))
                assertDisplayKeepsValue(quantity, value)
                when (val dose = DoseQuantity.of(quantity)) {
                    is DoseQuantityResult.Valid -> dose.dose.display() shouldBe quantity.display()
                    is DoseQuantityResult.Refused -> (value.signum() <= 0) shouldBe true
                }
                when (val rate = DoseRate.of(quantity)) {
                    is DoseRateResult.Valid -> ClinicalNumberFormat.format(rate.rate) shouldBe quantity.display()
                    is DoseRateResult.Refused -> (value.signum() < 0) shouldBe true
                }
            }
        }

        test("ucum-syntax-accepts-and-rejects: the parser is total and keeps a valid code verbatim") {
            checkAll(budget, QuantityArbs.grammarStrings()) { code ->
                when (val result = UcumUnit.parse(code)) {
                    is UcumParseResult.Valid -> result.unit.code shouldBe code
                    is UcumParseResult.Invalid -> (result.position in 0..code.length) shouldBe true
                }
            }
        }
    })

/** Display rules and value preservation for one quantity (platform-kernel.md §10.4). */
private fun assertDisplayKeepsValue(
    quantity: Quantity,
    value: BigDecimal,
) {
    val shown = quantity.display()
    shown shouldBe ClinicalNumberFormat.format(quantity)
    val number = shown.substringBeforeLast(' ')
    shown.substringAfterLast(' ') shouldBe quantity.unit.code
    number.all { it in '0'..'9' || it == '.' || it == '-' } shouldBe true
    number.startsWith(".") shouldBe false
    number.startsWith("-.") shouldBe false
    number.endsWith(".") shouldBe false
    if ('.' in number) number.endsWith("0") shouldBe false
    val reparsed = Quantity.parse(number, quantity.unit).shouldBeInstanceOf<QuantityParseResult.Valid>().quantity
    @OptIn(DoseMagnitudeAccess::class)
    val same = reparsed.magnitude().compareTo(value) == 0
    same shouldBe true
}

/** An independent statement of the refusal order of platform-kernel.md §10.3 and the input rule of §10.4. */
private object Oracle {
    private val plain = Regex("-?[0-9]+(\\.[0-9]+)?")

    fun refusal(
        entered: String,
        unitCode: String?,
    ): DoseQuantityRefusal? {
        val unit = unitCode?.takeIf { it.isNotBlank() }?.let(UcumUnit::parse)
        // The pools are classified by hand, so the parser is checked against them, not against itself.
        when (unitCode) {
            in QuantityArbs.unitsWithAtom -> (unit as UcumParseResult.Valid).unit.hasUnitAtom shouldBe true
            in QuantityArbs.unitsWithoutAtom -> (unit as UcumParseResult.Valid).unit.hasUnitAtom shouldBe false
            in QuantityArbs.invalidUnits -> unit.shouldBeInstanceOf<UcumParseResult.Invalid>()
        }
        return when {
            unit == null -> DoseQuantityRefusal.MISSING_UNIT
            unit !is UcumParseResult.Valid -> DoseQuantityRefusal.INVALID_UNIT_SYNTAX
            !unit.unit.hasUnitAtom -> DoseQuantityRefusal.UNIT_HAS_NO_UNIT_ATOM
            !numberIsValid(entered) -> DoseQuantityRefusal.INVALID_NUMBER
            BigDecimal(entered).signum() <= 0 -> DoseQuantityRefusal.NOT_POSITIVE
            else -> null
        }
    }

    private fun numberIsValid(entered: String): Boolean =
        plain.matches(entered) &&
            BigDecimal(entered).let { it.precision() <= Quantity.MAX_SIGNIFICANT_DIGITS && it.scale() <= Quantity.MAX_FRACTION_DIGITS }
}
