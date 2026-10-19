package hms.tests.scenarios.application.runner

import hms.tests.scenarios.api.SuiteBinding
import hms.tests.scenarios.application.catalogue.SuiteCatalogue
import java.io.PrintStream
import java.nio.file.Path
import java.time.Clock
import java.util.ServiceLoader
import kotlin.system.exitProcess

/**
 * The `scenarioSuites` task's main class: runs the catalogue with the bindings found by `ServiceLoader`, writes the
 * pass matrix into the directory given by `--output`, and exits non-zero unless every suite is bound and passes
 * (fail closed: ten NOT-BUILT suites today, KA-064). The matrix is written before the exit, so the nightly step can
 * read it either way.
 */
object ScenarioSuitesMain {
    /** Usage errors (no matrix written). */
    const val USAGE_EXIT: Int = 2

    /** Runs [runner] when [args] name the output directory, writes the matrix there and returns the exit code. */
    fun run(
        args: List<String>,
        runner: ScenarioRunner,
        host: String,
        out: PrintStream,
    ): Int {
        val output = outputOf(args)
        if (output == null) {
            out.println("usage: ScenarioSuitesMain --output <directory>")
            return USAGE_EXIT
        }
        val report = runner.run()
        val written = PassMatrix.write(report, output, host)
        report.suites.forEach { suite ->
            val waits = if (suite.result == Result.NOT_BUILT) " (" + suite.suite.waitsOn.describe() + ")" else ""
            out.println("${suite.result.label.padEnd(RESULT_WIDTH)} ${suite.suite.id}$waits")
        }
        out.println(
            "scenario suites: ${report.result.label}: ${report.suites.size} suites (" +
                Result.entries.joinToString(", ") { "${report.suiteCount(it)} ${it.label}" } +
                "), ${report.scenarioTotal()} scenarios (" +
                Result.entries.joinToString(", ") { "${report.scenarioCount(it)} ${it.label}" } + ")",
        )
        written.forEach { out.println("pass matrix: $it") }
        return report.exitCode
    }

    private fun outputOf(args: List<String>): Path? {
        val index = args.indexOf("--output")
        return if (index >= 0 && index + 1 < args.size && args.size == 2) Path.of(args[index + 1]) else null
    }

    /** The bindings on the class path; none exist yet. */
    fun discoverBindings(): List<SuiteBinding> = ServiceLoader.load(SuiteBinding::class.java).toList()

    private const val RESULT_WIDTH = 9

    @JvmStatic
    fun main(args: Array<String>) {
        val host = "${System.getProperty("os.name")} ${System.getProperty("os.arch")}"
        val runner = ScenarioRunner(SuiteCatalogue.suites, discoverBindings(), Clock.systemUTC())
        val code = run(args.toList(), runner, host, System.out)
        exitProcess(code)
    }
}
