package hms.kernel.testing.statemachine

import hms.kernel.testing.PropertyTestBudget
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

/** The sequence configuration (docs/specs/modules/state-machines-and-invariants.md §3.3). In src/test. */
class SequenceConfigTest :
    FunSpec({
        test("the defaults are those of spec §3.3, and the budget is the configured one") {
            val config = SequenceConfig()
            config.budget shouldBe PropertyTestBudget.sequences()
            config.maxSteps shouldBe 32
            config.applicableBias shouldBe 0.85
            config.coverageFromBudget shouldBe 1000
            config.masterSeed.shouldBeNull()
        }

        listOf<Pair<String, () -> SequenceConfig>>(
            "a budget of 0" to { SequenceConfig(budget = 0) },
            "a negative budget" to { SequenceConfig(budget = -1) },
            "maxSteps of 0" to { SequenceConfig(budget = 1, maxSteps = 0) },
            "a bias below 0" to { SequenceConfig(budget = 1, applicableBias = -0.1) },
            "a bias above 1" to { SequenceConfig(budget = 1, applicableBias = 1.1) },
            "a bias that is not a number" to { SequenceConfig(budget = 1, applicableBias = Double.NaN) },
            "coverageFromBudget of 0" to { SequenceConfig(budget = 1, coverageFromBudget = 0) },
        ).forEach { (defect, build) ->
            test("rejects $defect") { shouldThrow<IllegalArgumentException> { build() } }
        }

        test("the bounds themselves are accepted") {
            SequenceConfig(budget = 1, maxSteps = 1, applicableBias = 0.0, coverageFromBudget = 1).maxSteps shouldBe 1
            SequenceConfig(budget = 1, applicableBias = 1.0).applicableBias shouldBe 1.0
        }
    })
