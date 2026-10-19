package hms.tests.scenarios.application.runner

import hms.tests.scenarios.api.BoundPorts
import hms.tests.scenarios.api.Scenario
import hms.tests.scenarios.api.ScenarioSuite
import hms.tests.scenarios.api.SimulatedClock
import hms.tests.scenarios.api.SuiteBinding
import hms.tests.scenarios.api.SyntheticPatients
import hms.tests.scenarios.api.given
import hms.tests.scenarios.api.then
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/** The runner on the toy fixture: PASS, FAIL and NOT-BUILT results and the fail-closed exit-code rule (§3.5, §18.5). */
class ScenarioRunnerTest :
    FunSpec({
        val hostClock = Clock.fixed(Instant.parse("2026-10-19T00:00:00Z"), ZoneOffset.UTC)

        fun run(
            suites: List<ScenarioSuite>,
            bindings: List<SuiteBinding>,
        ): RunReport = ScenarioRunner(suites, bindings, hostClock).run()

        fun outcomes(report: SuiteReport): List<Result> = report.scenarios.map { it.outcome.result }

        test("a bound suite reports PASS, FAIL and NOT-BUILT per scenario, and a catalogued scenario left out stays NOT-BUILT") {
            val report = run(listOf(ToyFixture.suite()), listOf(ToyFixture.Binding()))
            val suite = report.suites.single()
            suite.bound shouldBe true
            suite.scenarios.map { it.id } shouldContainExactly (1..4).map { Scenario.idOf(ToyFixture.AREA, it) }
            outcomes(suite) shouldContainExactly listOf(Result.PASS, Result.FAIL, Result.NOT_BUILT, Result.NOT_BUILT)
            suite.result shouldBe Result.FAIL
        }

        test("a failed assertion keeps its message and names the step") {
            val failed =
                run(listOf(ToyFixture.suite()), listOf(ToyFixture.Binding()))
                    .suites
                    .single()
                    .scenarios[1]
                    .outcome
            failed.shouldBeInstanceOf<ScenarioOutcome.Failed>()
            failed.message shouldContain "then the lamp is on although nobody switched it on"
            failed.message shouldContain "SYN-000001"
        }

        test("a step that throws ScenarioNotBuiltException is NOT-BUILT with what it waits on, and later steps do not run") {
            val notBuilt =
                run(listOf(ToyFixture.suite()), listOf(ToyFixture.Binding()))
                    .suites
                    .single()
                    .scenarios[2]
                    .outcome
            notBuilt.shouldBeInstanceOf<ScenarioOutcome.NotBuilt>()
            notBuilt.waitsOn shouldBe ToyFixture.notBuiltWaitsOn
            notBuilt.reason shouldContain "toy path"
            notBuilt.reason shouldContain "WP-9.9"
        }

        test("the catalogued scenario the binding does not implement is NOT-BUILT with the suite's waits-on") {
            val missing =
                run(listOf(ToyFixture.suite()), listOf(ToyFixture.Binding()))
                    .suites
                    .single()
                    .scenarios[3]
                    .outcome
            missing.shouldBeInstanceOf<ScenarioOutcome.NotBuilt>()
            missing.waitsOn shouldBe ToyFixture.waitsOn
            missing.reason shouldContain "does not implement"
        }

        test("a suite without a binding is NOT-BUILT in every registered scenario, and nothing runs") {
            val report = run(listOf(ToyFixture.suite(ToyFixture.UNBOUND_AREA)), emptyList())
            val suite = report.suites.single()
            suite.bound shouldBe false
            suite.result shouldBe Result.NOT_BUILT
            outcomes(suite) shouldContainExactly List(4) { Result.NOT_BUILT }
            suite.scenarios.forEach { (it.outcome as ScenarioOutcome.NotBuilt).reason shouldContain "no SuiteBinding" }
            report.exitCode shouldBe 1
        }

        test("exit code 0 only when every suite is bound and every scenario passes") {
            val passing = listOf(ToyFixture.defaultScenarios().first())
            val report = run(listOf(ToyFixture.suite(titles = listOf("lamp switches on"))), listOf(ToyFixture.Binding(scenarios = passing)))
            report.suites.single().result shouldBe Result.PASS
            report.result shouldBe Result.PASS
            report.exitCode shouldBe 0
        }

        test("exit code 1 when any scenario fails, when any suite is NOT-BUILT, and for an empty catalogue") {
            run(listOf(ToyFixture.suite()), listOf(ToyFixture.Binding())).exitCode shouldBe 1
            val passing = listOf(ToyFixture.defaultScenarios().first())
            val oneUnbound =
                run(
                    listOf(ToyFixture.suite(titles = listOf("lamp switches on")), ToyFixture.suite(ToyFixture.UNBOUND_AREA)),
                    listOf(ToyFixture.Binding(scenarios = passing)),
                )
            oneUnbound.suites.map { it.result } shouldContainExactly listOf(Result.PASS, Result.NOT_BUILT)
            oneUnbound.exitCode shouldBe 1
            run(emptyList(), emptyList()).exitCode shouldBe 1
        }

        test("a scenario with no then step asserts nothing and FAILS") {
            val noThen = Scenario(Scenario.idOf(ToyFixture.AREA, 1), "lamp switches on", listOf(given("nothing") { }))
            val outcome =
                run(listOf(ToyFixture.suite(titles = listOf("lamp switches on"))), listOf(ToyFixture.Binding(scenarios = listOf(noThen))))
                    .suites
                    .single()
                    .scenarios
                    .single()
                    .outcome
            outcome.shouldBeInstanceOf<ScenarioOutcome.Failed>()
            outcome.message shouldContain "asserts nothing"
        }

        test("a scenario of another suite, or an id given twice, FAILS") {
            val foreign = Scenario(Scenario.idOf("other", 1), "foreign", listOf(then("holds") { }))
            val twice = ToyFixture.defaultScenarios().first()
            val report =
                run(
                    listOf(ToyFixture.suite(titles = listOf("lamp switches on"))),
                    listOf(ToyFixture.Binding(scenarios = listOf(foreign, twice, twice))),
                )
            val messages =
                report.suites
                    .single()
                    .scenarios
                    .map { (it.outcome as ScenarioOutcome.Failed).message }
            messages.count { it.contains("does not belong") } shouldBe 1
            messages.count { it.contains("appears 2 times") } shouldBe 2
        }

        test("an error other than an assertion FAILS with its type and message; so does an unbound port") {
            val throwing = Scenario(Scenario.idOf(ToyFixture.AREA, 1), "t", listOf(then("throws") { error("toy failure") }))
            val noPort =
                Scenario(Scenario.idOf(ToyFixture.AREA, 2), "p", listOf(then("asks for a missing port") { it.ports.get<Runnable>() }))
            val report =
                run(listOf(ToyFixture.suite(titles = listOf("t", "p"))), listOf(ToyFixture.Binding(scenarios = listOf(throwing, noPort))))
            val (first, second) =
                report.suites
                    .single()
                    .scenarios
                    .map { (it.outcome as ScenarioOutcome.Failed).message }
            first shouldContain "IllegalStateException: toy failure"
            second shouldContain "port java.lang.Runnable is not bound"
            second shouldContain ToyLampPort::class.java.name
        }

        test("a binding whose ports() throws FAILS its scenarios") {
            val broken =
                object : SuiteBinding {
                    override val suiteId = "SCN-${ToyFixture.AREA}"
                    override val scenarios = listOf(ToyFixture.defaultScenarios().first())

                    override fun ports(
                        clock: SimulatedClock,
                        patients: SyntheticPatients,
                    ): BoundPorts = error("adapter unavailable")
                }
            val outcome =
                run(
                    listOf(ToyFixture.suite(titles = listOf("lamp switches on"))),
                    listOf(broken),
                ).suites.single().scenarios.single().outcome
            outcome.shouldBeInstanceOf<ScenarioOutcome.Failed>()
            outcome.message shouldContain "ports(): java.lang.IllegalStateException: adapter unavailable"
        }

        test("every scenario gets a fresh world: its own clock from the start instant and its own patients") {
            val first = ToyFixture.defaultScenarios().first()
            val again = Scenario(Scenario.idOf(ToyFixture.AREA, 2), "again", first.steps)
            val report =
                run(listOf(ToyFixture.suite(titles = listOf("a", "b"))), listOf(ToyFixture.Binding(scenarios = listOf(first, again))))
            report.suites
                .single()
                .scenarios
                .map { it.outcome.result } shouldContainExactly listOf(Result.PASS, Result.PASS)
        }

        test("bindings for an unknown suite, or two bindings for one suite, are refused") {
            shouldThrow<IllegalArgumentException> { ScenarioRunner(emptyList(), listOf(ToyFixture.Binding()), hostClock) }
                .message shouldContain "does not hold"
            shouldThrow<IllegalArgumentException> {
                ScenarioRunner(listOf(ToyFixture.suite()), listOf(ToyFixture.Binding(), ToyFixture.Binding()), hostClock)
            }.message shouldContain "more than one binding"
        }
    })
