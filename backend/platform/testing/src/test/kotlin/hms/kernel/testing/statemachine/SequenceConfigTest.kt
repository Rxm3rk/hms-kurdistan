package hms.kernel.testing.statemachine

import hms.kernel.testing.PropertyTestBudget
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

/** Runs [block] with the system property [name] set to [value] (cleared when null), restoring the previous value after. */
private fun <T> withSystemProperty(
    name: String,
    value: String?,
    block: () -> T,
): T {
    val previous = System.getProperty(name)
    if (value == null) System.clearProperty(name) else System.setProperty(name, value)
    try {
        return block()
    } finally {
        if (previous == null) System.clearProperty(name) else System.setProperty(name, previous)
    }
}

/** The sequence configuration (docs/specs/modules/state-machines-and-invariants.md §3.3). In src/test. */
class SequenceConfigTest :
    FunSpec({
        test("the defaults are those of spec §3.3, and the budget and master seed are the configured ones") {
            val config = SequenceConfig()
            config.budget shouldBe PropertyTestBudget.sequences()
            config.maxSteps shouldBe 32
            config.applicableBias shouldBe 0.85
            config.coverageFromBudget shouldBe 1000
            config.masterSeed shouldBe SequenceConfig.configuredMasterSeed()
        }

        test("hms.pbt.seed fixes the default master seed, so a failed run can be replayed from Gradle") {
            withSystemProperty(SequenceConfig.SEED_PROPERTY, " -42 ") { SequenceConfig(budget = 1).masterSeed } shouldBe -42L
            withSystemProperty(SequenceConfig.SEED_PROPERTY, null) { SequenceConfig(budget = 1).masterSeed }.shouldBeNull()
            withSystemProperty(SequenceConfig.SEED_PROPERTY, "") { SequenceConfig(budget = 1).masterSeed }.shouldBeNull()
        }

        test("a seed that is not a whole number is rejected with a message naming the property") {
            shouldThrow<IllegalArgumentException> { SequenceConfig.parseSeed("12x") }.message shouldContain "hms.pbt.seed"
            shouldThrow<IllegalArgumentException> { SequenceConfig.parseSeed("1.5") }
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
