package hms.tests.scenarios.application.runner

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import java.nio.file.Files
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/** The pass matrix linked to hazards (§18.2) and the mock-KB labelling of §18.5 #1, on the toy fixture. */
class PassMatrixTest :
    FunSpec({
        val hostClock = Clock.fixed(Instant.parse("2026-10-19T00:00:00Z"), ZoneOffset.UTC)
        val host = "toy-host"

        fun report(mockKb: Boolean = false): RunReport =
            ScenarioRunner(
                listOf(ToyFixture.suite(mockKb = mockKb), ToyFixture.suite(ToyFixture.UNBOUND_AREA)),
                listOf(ToyFixture.Binding()),
                hostClock,
            ).run()

        test("the JSON matrix holds every suite and scenario with result, hazards, SIs, counts and run time") {
            val json = PassMatrix.json(report(), host)
            json shouldContain "\"schema\": \"${PassMatrix.SCHEMA}\""
            json shouldContain "\"result\": \"FAIL\""
            json shouldContain "\"exit_code\": 1"
            json shouldContain "\"started_at\": \"2026-10-19T00:00:00Z\""
            json shouldContain "\"duration_ms\": 0"
            json shouldContain "\"host\": \"toy-host\""
            json shouldContain "\"suites_not_built\": 1"
            json shouldContain "\"suites_fail\": 1"
            json shouldContain "\"scenarios\": 8"
            json shouldContain "\"scenarios_pass\": 1"
            json shouldContain "\"scenarios_fail\": 1"
            json shouldContain "\"scenarios_not_built\": 6"
            json shouldContain "\"verification_name\": \"ScenarioSuite:toy-fixture\""
            json shouldContain "\"id\": \"SCN-toy-fixture-001\""
            json shouldContain "\"hazards\": [\n"
            json shouldContain "\"HAZ-0001\""
            json shouldContain "\"SI-01\""
            json shouldContain "\"known_anomaly\": \"KA-064\""
            json shouldContain "\"evidence\": \"${SuiteReport.SYNTHETIC_LABEL}\""
            json shouldContain "\"evidence\": \"${SuiteReport.NOT_RUN_LABEL}\""
        }

        test("a failed scenario's assertion message is kept in the matrix") {
            val json = PassMatrix.json(report(), host)
            json shouldContain "then the lamp is on although nobody switched it on"
            PassMatrix.markdown(report(), host) shouldContain "then the lamp is on although nobody switched it on"
        }

        test("a mock-KB suite labels every one of its result lines, whatever the result, and no other suite's lines") {
            val run = report(mockKb = true)
            val mock = run.suites.first()
            mock.scenarios.map { it.outcome.result }.toSet() shouldBe setOf(Result.PASS, Result.FAIL, Result.NOT_BUILT)
            mock.scenarios.map { mock.evidenceOf(it) } shouldContainExactly List(4) { SuiteReport.MOCK_KB_LABEL }
            val other = run.suites.last()
            other.scenarios.map { other.evidenceOf(it) }.toSet() shouldBe setOf(SuiteReport.NOT_RUN_LABEL)
            val markdownLines = PassMatrix.markdown(run, host).lines()
            markdownLines.filter { it.startsWith("| `SCN-toy-fixture` |") }.forEach { it shouldContain SuiteReport.MOCK_KB_LABEL }
            markdownLines.filter { it.startsWith("| `SCN-toy-unbound` |") }.forEach { it shouldNotContain SuiteReport.MOCK_KB_LABEL }
            SuiteReport.MOCK_KB_LABEL shouldBe "mock-KB run, not clinical evidence"
        }

        test("the Markdown matrix has the summary, one row per suite and one row per scenario") {
            val markdown = PassMatrix.markdown(report(), host)
            markdown shouldContain "- Result: **FAIL** (exit code 1)"
            markdown shouldContain "- Suites: 2: 0 PASS, 1 FAIL, 1 NOT-BUILT"
            markdown shouldContain "- Scenarios: 8: 1 PASS, 1 FAIL, 6 NOT-BUILT"
            markdown shouldContain "| fixture | `SCN-toy-unbound` Toy fixture | **NOT-BUILT** | HAZ-0001 | H1 | SI-01 |  | waits on WP-0.5"
            markdown.lines().count { it.startsWith("| `SCN-toy-") } shouldBe 8
        }

        test("the Markdown cells escape the table separator") {
            val run =
                ScenarioRunner(listOf(ToyFixture.suite(titles = listOf("a | b"))), emptyList(), hostClock).run()
            PassMatrix.markdown(run, host) shouldContain "a \\| b"
        }

        test("write() creates the directory and both files") {
            val directory = Files.createTempDirectory("pass-matrix").resolve("reports/scenarios")
            val written = PassMatrix.write(report(), directory, host)
            written.map { it.fileName.toString() } shouldContainExactly listOf(PassMatrix.JSON_FILE, PassMatrix.MARKDOWN_FILE)
            written.forEach { Files.readString(it) shouldContain "SCN-toy-fixture-001" }
        }

        test("JSON strings are escaped") {
            Json.render(mapOf("k" to "a\"b\\c\nd\u0001")) shouldBe "{\n  \"k\": \"a\\\"b\\\\c\\nd\\u0001\"\n}\n"
            Json.render(listOf<Any?>()) shouldBe "[]\n"
            Json.render(mapOf("n" to null, "b" to true, "l" to 2L)) shouldBe "{\n  \"n\": null,\n  \"b\": true,\n  \"l\": 2\n}\n"
        }
    })
