package hms.tests.scenarios.application.runner

import hms.tests.scenarios.api.ScenarioSuite
import hms.tests.scenarios.api.WaitsOn
import java.nio.file.Files
import java.nio.file.Path

/**
 * The pass matrix linked to hazards (BUILD-PROMPT §18.2, "Clinical scenarios" row): suite × scenario × result with
 * hazards, seeded hazards and SIs, written as `pass-matrix.json` (read by the nightly step) and `pass-matrix.md`
 * (read by people). docs/specs/modules/state-machines-and-invariants.md §5.
 */
object PassMatrix {
    /** File name of the machine-readable matrix. */
    const val JSON_FILE: String = "pass-matrix.json"

    /** File name of the human-readable matrix. */
    const val MARKDOWN_FILE: String = "pass-matrix.md"

    /** Schema id written into the JSON. */
    const val SCHEMA: String = "hms.scenario-pass-matrix/1"

    /** The task that writes the matrix. */
    const val PRODUCER: String = ":tests:scenarios:scenarioSuites"

    /** Writes both files into [directory], creating it, and returns their paths. */
    fun write(
        report: RunReport,
        directory: Path,
        host: String,
    ): List<Path> {
        Files.createDirectories(directory)
        val json = directory.resolve(JSON_FILE)
        val markdown = directory.resolve(MARKDOWN_FILE)
        Files.writeString(json, json(report, host))
        Files.writeString(markdown, markdown(report, host))
        return listOf(json, markdown)
    }

    /** The JSON matrix. */
    fun json(
        report: RunReport,
        host: String,
    ): String =
        Json.render(
            linkedMapOf(
                "schema" to SCHEMA,
                "producer" to PRODUCER,
                "source" to "docs/specs/modules/state-machines-and-invariants.md §5; BUILD-PROMPT §18.2, §18.5",
                "host" to host,
                "started_at" to report.startedAt.toString(),
                "finished_at" to report.finishedAt.toString(),
                "duration_ms" to report.durationMillis,
                "result" to report.result.label,
                "exit_code" to report.exitCode,
                "counts" to counts(report),
                "suites" to report.suites.map(::suiteJson),
            ),
        )

    private fun counts(report: RunReport): Map<String, Any> =
        linkedMapOf(
            "suites" to report.suites.size,
            "suites_pass" to report.suiteCount(Result.PASS),
            "suites_fail" to report.suiteCount(Result.FAIL),
            "suites_not_built" to report.suiteCount(Result.NOT_BUILT),
            "scenarios" to report.scenarioTotal(),
            "scenarios_pass" to report.scenarioCount(Result.PASS),
            "scenarios_fail" to report.scenarioCount(Result.FAIL),
            "scenarios_not_built" to report.scenarioCount(Result.NOT_BUILT),
        )

    private fun suiteJson(report: SuiteReport): Map<String, Any?> {
        val suite = report.suite
        return linkedMapOf(
            "id" to suite.id,
            "verification_name" to suite.verificationName,
            "section" to section(suite),
            "title" to suite.title,
            "result" to report.result.label,
            "bound" to report.bound,
            "mock_kb" to suite.mockKb,
            "hazards" to suite.hazards,
            "seeded_hazards" to suite.seededHazards,
            "unlinked_seeded_hazards_proposed" to suite.unlinkedSeededHazards,
            "invariants" to suite.invariants,
            "waits_on" to if (report.result == Result.NOT_BUILT) waitsOnJson(suite.waitsOn) else null,
            "duration_ms" to report.durationMillis,
            "sources" to suite.sources,
            "scenarios" to report.scenarios.map { scenarioJson(report, it) },
        )
    }

    private fun scenarioJson(
        suite: SuiteReport,
        scenario: ScenarioReport,
    ): Map<String, Any?> {
        val outcome = scenario.outcome
        return linkedMapOf(
            "id" to scenario.id,
            "title" to scenario.title,
            "result" to outcome.result.label,
            "evidence" to suite.evidenceOf(scenario),
            "hazards" to scenario.hazards,
            "invariants" to suite.suite.invariants,
            "message" to detail(outcome),
            "waits_on" to (outcome as? ScenarioOutcome.NotBuilt)?.let { waitsOnJson(it.waitsOn) },
            "duration_ms" to scenario.durationMillis,
        )
    }

    private fun waitsOnJson(waitsOn: WaitsOn): Map<String, Any> =
        linkedMapOf(
            "work_packages" to waitsOn.workPackages,
            "backlog" to waitsOn.backlog,
            "human" to waitsOn.human,
            "known_anomaly" to waitsOn.knownAnomaly,
        )

    internal fun detail(outcome: ScenarioOutcome): String? =
        when (outcome) {
            ScenarioOutcome.Passed -> null
            is ScenarioOutcome.Failed -> outcome.message
            is ScenarioOutcome.NotBuilt -> outcome.reason
        }

    internal fun section(suite: ScenarioSuite): String = if (suite.number == 0) "fixture" else "§18.5 #${suite.number}"

    /** The Markdown matrix. */
    fun markdown(
        report: RunReport,
        host: String,
    ): String = PassMatrixMarkdown.render(report, host)
}
