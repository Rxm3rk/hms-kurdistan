package hms.tests.scenarios.application.runner

import hms.tests.scenarios.api.ScenarioSuite
import hms.tests.scenarios.api.WaitsOn
import java.time.Instant

/** The result of one scenario or suite in the pass matrix (§18.2: "pass matrix linked to hazards"). */
enum class Result(
    val label: String,
) {
    PASS("PASS"),
    FAIL("FAIL"),
    NOT_BUILT("NOT-BUILT"),
}

/** What happened to one scenario. */
sealed interface ScenarioOutcome {
    val result: Result

    /** Every step ran and every assertion held. */
    data object Passed : ScenarioOutcome {
        override val result: Result = Result.PASS
    }

    /** A step failed; [message] is the assertion or error message, with the step that raised it. */
    data class Failed(
        val message: String,
    ) : ScenarioOutcome {
        override val result: Result = Result.FAIL
    }

    /** The scenario did not run because its domain is not built; [reason] says why. */
    data class NotBuilt(
        val reason: String,
        val waitsOn: WaitsOn,
    ) : ScenarioOutcome {
        override val result: Result = Result.NOT_BUILT
    }
}

/** One line of the pass matrix: a scenario of a suite with its outcome. */
class ScenarioReport(
    val id: String,
    val title: String,
    val hazards: List<String>,
    val outcome: ScenarioOutcome,
    val durationMillis: Long,
)

/** One suite's results. */
class SuiteReport(
    val suite: ScenarioSuite,
    val bound: Boolean,
    val scenarios: List<ScenarioReport>,
    val durationMillis: Long,
) {
    /** FAIL if any scenario failed (or none ran), else NOT-BUILT if any is not built, else PASS. */
    val result: Result =
        when {
            scenarios.isEmpty() || scenarios.any { it.outcome.result == Result.FAIL } -> Result.FAIL
            !bound || scenarios.any { it.outcome.result == Result.NOT_BUILT } -> Result.NOT_BUILT
            else -> Result.PASS
        }

    /** The evidence label of every result line of this suite (§18.5 #1, §18.10). */
    fun evidenceOf(scenario: ScenarioReport): String =
        when {
            suite.mockKb -> MOCK_KB_LABEL
            scenario.outcome.result == Result.NOT_BUILT -> NOT_RUN_LABEL
            else -> SYNTHETIC_LABEL
        }

    companion object {
        /** §18.5 #1, verbatim: every result line of a suite that runs on the mock KB. */
        const val MOCK_KB_LABEL: String = "mock-KB run, not clinical evidence"

        /** A scenario that did not run. */
        const val NOT_RUN_LABEL: String = "not run"

        /** §18.10: synthetic data is for development and testing only, never for clinical validation. */
        const val SYNTHETIC_LABEL: String = "synthetic data, not clinical validation"
    }
}

/** A whole run of the catalogue. */
class RunReport(
    val startedAt: Instant,
    val finishedAt: Instant,
    val suites: List<SuiteReport>,
) {
    /** PASS only when there is at least one suite and every suite passed; otherwise FAIL (fail closed). */
    val result: Result = if (suites.isNotEmpty() && suites.all { it.result == Result.PASS }) Result.PASS else Result.FAIL

    /**
     * The process exit code: 0 only when every suite is bound and every scenario passed. Any NOT-BUILT suite or
     * scenario, any failure, or an empty catalogue gives 1. The nightly step reads the matrix either way.
     */
    val exitCode: Int = if (result == Result.PASS) 0 else 1

    /** Elapsed wall time of the run. */
    val durationMillis: Long = finishedAt.toEpochMilli() - startedAt.toEpochMilli()

    /** Suites per result. */
    fun suiteCount(result: Result): Int = suites.count { it.result == result }

    /** Scenarios per result, over every suite. */
    fun scenarioCount(result: Result): Int = suites.sumOf { suite -> suite.scenarios.count { it.outcome.result == result } }

    /** Every scenario of every suite. */
    fun scenarioTotal(): Int = suites.sumOf { it.scenarios.size }
}
