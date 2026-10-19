package hms.kernel.testing.statemachine

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldEndWith
import java.io.File

/** The counts file of a sequence run (docs/specs/modules/state-machines-and-invariants.md §3.3; BUILD-PROMPT §19.1). In src/test. */
class SequenceCountsTest :
    FunSpec({
        val stats =
            RunStats(
                name = "toy \"door\"\\run\n",
                machine = "toy-door",
                budget = 1000,
                sequences = 1000,
                steps = 16_500,
                fired = 9000,
                refused = 6000,
                notApplicable = 1500,
                ambiguous = 0,
                transitionsCovered = 9,
                transitionsTotal = 10,
                firedPerTransition = listOf(1, 2, 3, 4, 5, 6, 7, 8, 0, 8964),
            )

        test("the file name keeps [A-Za-z0-9._-] and turns every other character into _") {
            SequenceCounts.fileName("toy-door") shouldBe "toy-door.json"
            SequenceCounts.fileName("SI-02 medication: P1-P7 (spec)") shouldBe "SI-02_medication__P1-P7__spec_.json"
            SequenceCounts.fileName("a.b_c/d\\e é") shouldBe "a.b_c_d_e__.json"
        }

        test("the JSON holds the keys of spec §3.3 in order, with the name escaped") {
            SequenceCounts.json(stats) shouldBe
                """
                {
                  "name": "toy \"door\"\\run\n",
                  "machine": "toy-door",
                  "budget": 1000,
                  "sequences": 1000,
                  "steps": 16500,
                  "fired": 9000,
                  "refused": 6000,
                  "not_applicable": 1500,
                  "ambiguous": 0,
                  "transitions_covered": 9,
                  "transitions_total": 10
                }
                """.trimIndent() + "\n"
        }

        test("control characters are escaped as \\u sequences") {
            SequenceCounts.quote("a\u0001b\tc\r") shouldBe "\"a\\u0001b\\tc\\r\""
        }

        test("Gradle passes the counts directory, <project build dir>/pbt-counts, to the test JVM") {
            val directory = System.getProperty(SequenceCounts.SYSTEM_PROPERTY).shouldNotBeNull()
            File(directory).isAbsolute shouldBe true
            directory.replace('\\', '/') shouldEndWith "/platform/testing/build/pbt-counts"
        }
    })
