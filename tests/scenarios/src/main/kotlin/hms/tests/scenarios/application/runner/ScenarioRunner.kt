package hms.tests.scenarios.application.runner

import hms.tests.scenarios.api.Scenario
import hms.tests.scenarios.api.ScenarioNotBuiltException
import hms.tests.scenarios.api.ScenarioSuite
import hms.tests.scenarios.api.ScenarioWorld
import hms.tests.scenarios.api.SimulatedClock
import hms.tests.scenarios.api.StepKind
import hms.tests.scenarios.api.SuiteBinding
import hms.tests.scenarios.api.SyntheticPatients
import java.time.Clock
import java.time.Instant

/**
 * Runs every catalogued suite through its binding (docs/specs/modules/state-machines-and-invariants.md §5).
 *
 * - A suite with no binding: every registered scenario is NOT-BUILT with the suite's [ScenarioSuite.waitsOn]; nothing runs.
 * - A bound suite: each of the binding's scenarios runs in a fresh [ScenarioWorld] (its own simulated clock from
 *   [worldStart], its own synthetic patients, its own ports). A registered scenario the binding does not implement
 *   is NOT-BUILT.
 * - A scenario passes only if it has a `then` step and every step returns normally. An assertion error or any other
 *   error is FAIL with its message; a [ScenarioNotBuiltException] is NOT-BUILT.
 *
 * [clock] times the run (the host's clock in the main class); scenario time is the simulated clock only.
 */
class ScenarioRunner(
    private val catalogue: List<ScenarioSuite>,
    bindings: List<SuiteBinding>,
    private val clock: Clock,
    private val worldStart: Instant = SimulatedClock.DEFAULT_START,
) {
    private val bindingsBySuite: Map<String, SuiteBinding>

    init {
        val suiteIds = catalogue.map { it.id }
        require(suiteIds.toSet().size == suiteIds.size) { "the catalogue lists a suite twice" }
        val duplicates = bindings.groupBy { it.suiteId }.filterValues { it.size > 1 }.keys
        require(duplicates.isEmpty()) { "more than one binding for ${duplicates.sorted()}" }
        val unknown = bindings.map { it.suiteId }.filterNot { it in suiteIds }
        require(unknown.isEmpty()) { "bindings for suites the catalogue does not hold: ${unknown.sorted()}" }
        bindingsBySuite = bindings.associateBy { it.suiteId }
    }

    /** Runs the catalogue and returns the report. */
    fun run(): RunReport {
        val startedAt = clock.instant()
        val suites = catalogue.map { suite -> runSuite(suite, bindingsBySuite[suite.id]) }
        return RunReport(startedAt, clock.instant(), suites)
    }

    private fun runSuite(
        suite: ScenarioSuite,
        binding: SuiteBinding?,
    ): SuiteReport {
        val start = clock.millis()
        val reports =
            if (binding == null) {
                suite.scenarios.map { planned ->
                    val reason = "no SuiteBinding for ${suite.verificationName}"
                    ScenarioReport(planned.id, planned.title, planned.hazards.ifEmpty { suite.hazards }, notBuilt(suite, reason), 0)
                }
            } else {
                runBound(suite, binding)
            }
        return SuiteReport(suite, binding != null, reports, clock.millis() - start)
    }

    private fun runBound(
        suite: ScenarioSuite,
        binding: SuiteBinding,
    ): List<ScenarioReport> {
        val implemented = binding.scenarios.groupBy { it.id }
        val ran =
            binding.scenarios.map { scenario ->
                val start = clock.millis()
                val outcome =
                    checkWellFormed(suite, scenario, implemented.getValue(scenario.id).size)
                        ?: runScenario(scenario, binding)
                ScenarioReport(scenario.id, scenario.title, scenario.hazards.ifEmpty { suite.hazards }, outcome, clock.millis() - start)
            }
        val missing =
            suite.scenarios.filterNot { it.id in implemented }.map { planned ->
                val reason = "catalogued, but the binding does not implement it"
                ScenarioReport(planned.id, planned.title, planned.hazards.ifEmpty { suite.hazards }, notBuilt(suite, reason), 0)
            }
        return (ran + missing).sortedBy { it.id }
    }

    private fun checkWellFormed(
        suite: ScenarioSuite,
        scenario: Scenario,
        occurrences: Int,
    ): ScenarioOutcome? =
        when {
            !scenario.id.startsWith("${suite.id}-") -> "scenario ${scenario.id} does not belong to suite ${suite.id}"
            occurrences > 1 -> "scenario id ${scenario.id} appears $occurrences times in the binding"
            scenario.steps.none { it.kind == StepKind.THEN } -> "scenario ${scenario.id} has no then step: it asserts nothing"
            else -> null
        }?.let { ScenarioOutcome.Failed(it) }

    private fun runScenario(
        scenario: Scenario,
        binding: SuiteBinding,
    ): ScenarioOutcome {
        val worldClock = SimulatedClock(worldStart)
        val patients = SyntheticPatients()
        return when (val ports = attempt("binding ${binding.suiteId}: ports()") { binding.ports(worldClock, patients) }) {
            is Attempt.Stopped -> ports.outcome
            is Attempt.Done -> runSteps(scenario, ScenarioWorld(worldClock, patients, ports.value))
        }
    }

    /** Runs the steps in order and stops at the first that does not return normally. */
    private fun runSteps(
        scenario: Scenario,
        world: ScenarioWorld,
    ): ScenarioOutcome =
        scenario.steps.firstNotNullOfOrNull { step ->
            (attempt("${step.kind.keyword} ${step.text}") { step.action(world) } as? Attempt.Stopped)?.outcome
        } ?: ScenarioOutcome.Passed

    private fun notBuilt(
        suite: ScenarioSuite,
        reason: String,
    ): ScenarioOutcome = ScenarioOutcome.NotBuilt(reason, suite.waitsOn)

    private sealed interface Attempt<out T> {
        class Done<T>(
            val value: T,
        ) : Attempt<T>

        class Stopped(
            val outcome: ScenarioOutcome,
        ) : Attempt<Nothing>
    }

    private fun <T> attempt(
        where: String,
        block: () -> T,
    ): Attempt<T> {
        val result = runCatching(block)
        val error = result.exceptionOrNull() ?: return Attempt.Done(result.getOrThrow())
        if (error is VirtualMachineError) throw error
        val outcome =
            when (error) {
                is ScenarioNotBuiltException -> ScenarioOutcome.NotBuilt("$where: ${error.message}", error.waitsOn)
                is AssertionError -> ScenarioOutcome.Failed("$where: ${error.message ?: error.javaClass.name}")
                else -> ScenarioOutcome.Failed("$where: ${error.javaClass.name}: ${error.message}")
            }
        return Attempt.Stopped(outcome)
    }
}
