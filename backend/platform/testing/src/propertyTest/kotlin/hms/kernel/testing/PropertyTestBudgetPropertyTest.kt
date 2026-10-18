package hms.kernel.testing

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll

/**
 * Proves that a property runs exactly the configured number of iterations (BUILD-PROMPT §19.1).
 * In src/propertyTest: runs in the propertyTest task with -Phms.pbt.sequences=N (default 1000).
 */
class PropertyTestBudgetPropertyTest :
    FunSpec({
        val budget = PropertyTestBudget.sequences()

        test("a trivial property runs exactly the configured $budget iterations") {
            var runs = 0
            val context =
                checkAll(PropertyTestBudget.sequences(), Arb.int()) { value ->
                    runs += 1
                    (value xor value) shouldBe 0
                }
            runs shouldBe budget
            context.evals() shouldBe budget
        }
    })
