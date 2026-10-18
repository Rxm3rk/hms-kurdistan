package hms.kernel.testing

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

/** Parsing of the property-test budget (BUILD-PROMPT §19.1). In src/test: runs in the test task. */
class PropertyTestBudgetTest :
    FunSpec({
        test("an absent property means the fast-tier default of 1000") {
            PropertyTestBudget.parse(null) shouldBe PropertyTestBudget.DEFAULT_SEQUENCES
            PropertyTestBudget.DEFAULT_SEQUENCES shouldBe 1000
        }

        test("a positive integer is used as given, ignoring surrounding spaces") {
            PropertyTestBudget.parse("137") shouldBe 137
            PropertyTestBudget.parse(" 42 ") shouldBe 42
            PropertyTestBudget.parse("1000000") shouldBe 1_000_000
        }

        listOf("0", "-1", "", " ", "ten", "1.5", "99999999999").forEach { raw ->
            test("the value '$raw' is rejected with a message naming the property") {
                shouldThrow<IllegalArgumentException> { PropertyTestBudget.parse(raw) }
                    .message
                    .shouldNotBeNull()
                    .shouldContain(PropertyTestBudget.SYSTEM_PROPERTY)
            }
        }

        test("Gradle passes the budget to the test JVM") {
            System.getProperty(PropertyTestBudget.SYSTEM_PROPERTY).shouldNotBeNull()
        }
    })
