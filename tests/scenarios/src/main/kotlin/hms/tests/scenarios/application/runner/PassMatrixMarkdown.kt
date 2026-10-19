package hms.tests.scenarios.application.runner

/** The human-readable pass matrix, `pass-matrix.md`: a summary, one row per suite, one row per scenario. */
internal object PassMatrixMarkdown {
    fun render(
        report: RunReport,
        host: String,
    ): String =
        buildString {
            appendLine("# Clinical scenario suites: pass matrix")
            appendLine()
            appendLine(
                "Written by `${PassMatrix.PRODUCER}` (BUILD-PROMPT §18.2, §18.5; " +
                    "docs/specs/modules/state-machines-and-invariants.md §5). " +
                    "Synthetic data only (§18.10). A suite with no binding is NOT-BUILT; a mock-KB suite's every line reads " +
                    "\"${SuiteReport.MOCK_KB_LABEL}\" (§18.5 #1). Evidence status comes from the CI record of the run that wrote " +
                    "this file (§19.1).",
            )
            appendLine()
            appendLine("- Result: **${report.result.label}** (exit code ${report.exitCode})")
            appendLine("- Suites: ${countLine(report.suites.size, report::suiteCount)}")
            appendLine("- Scenarios: ${countLine(report.scenarioTotal(), report::scenarioCount)}")
            appendLine("- Run: ${report.startedAt} to ${report.finishedAt} (${report.durationMillis} ms) on $host")
            appendLine()
            suiteTable(report)
            appendLine()
            scenarioTable(report)
        }

    private fun countLine(
        total: Int,
        count: (Result) -> Int,
    ): String = "$total: " + Result.entries.joinToString(", ") { "${count(it)} ${it.label}" }

    private fun StringBuilder.suiteTable(report: RunReport) {
        appendLine("## Suites")
        appendLine()
        appendLine("| § | Suite | Result | Hazards | Seeded hazards | SIs | KB | Waits on | Run time |")
        appendLine("|---|---|---|---|---|---|---|---|---|")
        report.suites.forEach { suiteReport ->
            val suite = suiteReport.suite
            val seeded =
                (suite.seededHazards + suite.unlinkedSeededHazards.map { "$it (proposed [P], not linked in the hazard log)" })
                    .joinToString(", ")
            val waits = if (suiteReport.result == Result.NOT_BUILT) suite.waitsOn.describe() else ""
            row(
                PassMatrix.section(suite),
                "`${suite.id}` ${suite.title}",
                "**${suiteReport.result.label}**",
                suite.hazards.joinToString(", "),
                seeded,
                suite.invariants.joinToString(", "),
                if (suite.mockKb) "mock" else "",
                waits,
                "${suiteReport.durationMillis} ms",
            )
        }
    }

    private fun StringBuilder.scenarioTable(report: RunReport) {
        appendLine("## Scenarios")
        appendLine()
        appendLine("| Suite | Scenario | Title | Result | Evidence | Hazards | SIs | Detail |")
        appendLine("|---|---|---|---|---|---|---|---|")
        report.suites.forEach { suiteReport ->
            suiteReport.scenarios.forEach { scenario ->
                row(
                    "`${suiteReport.suite.id}`",
                    "`${scenario.id}`",
                    scenario.title,
                    scenario.outcome.result.label,
                    suiteReport.evidenceOf(scenario),
                    scenario.hazards.joinToString(", "),
                    suiteReport.suite.invariants.joinToString(", "),
                    PassMatrix.detail(scenario.outcome).orEmpty(),
                )
            }
        }
    }

    private fun StringBuilder.row(vararg cells: String) {
        appendLine(cells.joinToString(" | ", prefix = "| ", postfix = " |") { cell(it) })
    }

    private fun cell(text: String): String = text.replace("|", "\\|").replace("\r", " ").replace("\n", " ")
}
