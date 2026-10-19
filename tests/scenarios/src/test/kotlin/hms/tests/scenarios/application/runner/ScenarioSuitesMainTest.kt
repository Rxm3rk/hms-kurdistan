package hms.tests.scenarios.application.runner

import hms.tests.scenarios.api.ScenarioSuite
import hms.tests.scenarios.api.SuiteBinding
import hms.tests.scenarios.application.catalogue.SuiteCatalogue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/** The main class: writes the matrix first, then exits non-zero unless every suite is bound and passes (fail closed). */
class ScenarioSuitesMainTest :
    FunSpec({
        val hostClock = Clock.fixed(Instant.parse("2026-10-19T00:00:00Z"), ZoneOffset.UTC)

        fun runMain(
            args: (Path) -> List<String>,
            suites: List<ScenarioSuite>,
            bindings: List<SuiteBinding>,
        ): Triple<Int, Path, String> {
            val directory = Files.createTempDirectory("scenario-main").resolve("out")
            val bytes = ByteArrayOutputStream()
            val code =
                PrintStream(bytes, true, Charsets.UTF_8).use {
                    ScenarioSuitesMain.run(args(directory), ScenarioRunner(suites, bindings, hostClock), "toy-host", it)
                }
            return Triple(code, directory, bytes.toString(Charsets.UTF_8))
        }

        test("the real catalogue exits 1 with ten NOT-BUILT suites and still writes both matrix files") {
            val (code, directory, console) =
                runMain({
                    listOf("--output", it.toString())
                }, SuiteCatalogue.suites, ScenarioSuitesMain.discoverBindings())
            code shouldBe 1
            Files.exists(directory.resolve(PassMatrix.JSON_FILE)) shouldBe true
            Files.exists(directory.resolve(PassMatrix.MARKDOWN_FILE)) shouldBe true
            Files.readString(directory.resolve(PassMatrix.JSON_FILE)) shouldContain "\"suites_not_built\": 10"
            console shouldContain "scenario suites: FAIL: 10 suites (0 PASS, 0 FAIL, 10 NOT-BUILT)"
            console shouldContain "NOT-BUILT SCN-closed-loop-medication (waits on WP-2.4, WP-3.1, WP-3.2, WP-3.3, WP-3.13"
        }

        test("no binding is on the class path yet") {
            ScenarioSuitesMain.discoverBindings() shouldBe emptyList()
        }

        test("a fully bound, passing catalogue exits 0") {
            val passing = listOf(ToyFixture.defaultScenarios().first())
            val (code, _, console) =
                runMain(
                    { listOf("--output", it.toString()) },
                    listOf(ToyFixture.suite(titles = listOf("lamp switches on"))),
                    listOf(ToyFixture.Binding(scenarios = passing)),
                )
            code shouldBe 0
            console shouldContain "scenario suites: PASS"
        }

        test("a failing scenario exits 1 after writing the matrix") {
            val (code, directory, _) =
                runMain(
                    { listOf("--output", it.toString()) },
                    listOf(ToyFixture.suite()),
                    listOf(ToyFixture.Binding()),
                )
            code shouldBe 1
            Files.readString(directory.resolve(PassMatrix.MARKDOWN_FILE)) shouldContain "lamp assertion fails"
        }

        test("without --output it prints the usage, writes nothing and exits ${ScenarioSuitesMain.USAGE_EXIT}") {
            val (code, directory, console) = runMain({ emptyList() }, SuiteCatalogue.suites, emptyList())
            code shouldBe ScenarioSuitesMain.USAGE_EXIT
            console shouldContain "usage:"
            Files.exists(directory) shouldBe false
            runMain({ listOf("--output") }, SuiteCatalogue.suites, emptyList()).first shouldBe ScenarioSuitesMain.USAGE_EXIT
            runMain({ listOf("--output", it.toString(), "extra") }, SuiteCatalogue.suites, emptyList()).first shouldBe
                ScenarioSuitesMain.USAGE_EXIT
        }
    })
