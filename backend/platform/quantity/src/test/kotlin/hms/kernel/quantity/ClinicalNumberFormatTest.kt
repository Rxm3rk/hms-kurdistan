package hms.kernel.quantity

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.util.Locale

/**
 * `UnitTest:kernel-clinical-number-display-rules` (platform-kernel.md §10.4, §17; §2.1 (a); SAC-50; CTRL-0005-17):
 * leading zero, no trailing zero after the point, integer zeros kept, no exponent, ASCII digits, no rounding, the
 * same text on every JVM default locale.
 */
class ClinicalNumberFormatTest :
    FunSpec({
        // The shared vectors of §10.4 (with the frontend ClinicalNumber component), then the other rules.
        val vectors =
            listOf(
                "10" to "10",
                "100" to "100",
                "1000" to "1000",
                "0.05" to "0.05",
                "10.50" to "10.5",
                "100.0" to "100",
                "0.5" to "0.5",
                "0.250" to "0.25",
                "5.0" to "5",
                "5.000" to "5",
                "0" to "0",
                "0.0" to "0",
                "1000000" to "1000000",
                "10.01" to "10.01",
                "100.0010" to "100.001",
                "0.000000000000001" to "0.000000000000001",
                "1234567890123456789.123456789012345" to "1234567890123456789.123456789012345",
                "007" to "7",
                "-0.50" to "-0.5",
                "-10" to "-10",
                "-0.0" to "0",
            )

        fun formatAll(): List<String> = vectors.map { (entered, _) -> ClinicalNumberFormat.format(QuantityFixtures.quantity(entered, "mL")) }

        test("kernel-clinical-number-display-rules: the shared vectors and the ISMP rules") {
            vectors.forEach { (entered, shown) ->
                withClue(entered) {
                    val quantity = QuantityFixtures.quantity(entered, "mL")
                    ClinicalNumberFormat.format(quantity) shouldBe "$shown mL"
                    quantity.display() shouldBe "$shown mL"
                }
            }
        }

        test("kernel-clinical-number-display-rules: doses and rates use the same format, unit code after one space") {
            ClinicalNumberFormat.format(QuantityFixtures.dose("0.50", "mg")) shouldBe "0.5 mg"
            ClinicalNumberFormat.format(QuantityFixtures.rate("10.0", "mL/h")) shouldBe "10 mL/h"
            ClinicalNumberFormat.format(QuantityFixtures.rate("0", "mL/h")) shouldBe "0 mL/h"
            ClinicalNumberFormat.format(QuantityFixtures.quantity("2", "10*3/mL")) shouldBe "2 10*3/mL"
        }

        test("kernel-clinical-number-display-rules: no exponent, only ASCII digits, '-' and '.', and never a naked point") {
            formatAll().forEach { shown ->
                withClue(shown) {
                    val number = shown.substringBefore(' ')
                    number.all { it in '0'..'9' || it == '.' || it == '-' } shouldBe true
                    (number.startsWith(".") || number.startsWith("-.")) shouldBe false
                    number.endsWith(".") shouldBe false
                    if ('.' in number) number.endsWith("0") shouldBe false
                }
            }
        }

        test("kernel-clinical-number-display-rules: the same text with the JVM default locale set to ar and ckb") {
            val expected = formatAll()
            val original = Locale.getDefault()
            try {
                listOf("ar", "ar-IQ", "ar-EG-u-nu-arab", "ckb", "ckb-IQ", "fa-IR").forEach { tag ->
                    Locale.setDefault(Locale.forLanguageTag(tag))
                    withClue(tag) { formatAll() shouldBe expected }
                }
            } finally {
                Locale.setDefault(original)
            }
        }
    })
