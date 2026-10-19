package hms.kernel.quantity

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

/** `UnitTest:unavailable-unit-catalogue-answers-unavailable` (platform-kernel.md §10.2, §16, §17; KA-KN1). */
class UnitCatalogueTest :
    FunSpec({
        test("unavailable-unit-catalogue-answers-unavailable: the WP-0.3 binding answers Unavailable for every unit") {
            listOf("mg", "mL", "mL/h", "1", "10*3", "{tablet}", "xa", "[xa]2", "/h").forEach { code ->
                withClue(code) { UnavailableUnitCatalogue.check(QuantityFixtures.unit(code)) shouldBe UnitCheck.Unavailable }
            }
        }

        test("the port is a functional interface a later binding implements") {
            val known = UnitCatalogue { UnitCheck.Known }
            known.check(QuantityFixtures.unit("mg")) shouldBe UnitCheck.Known
        }
    })
