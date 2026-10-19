package hms.tests.scenarios.application.catalogue

import hms.tests.scenarios.api.ScenarioSuite
import hms.tests.scenarios.application.runner.Result
import hms.tests.scenarios.application.runner.ScenarioRunner
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/**
 * The catalogue against its sources: the hazard log's planned `ScenarioSuite:` names (hazards, SIs, seeded hazards),
 * §18.5's text (suite names and scenario titles verbatim), §21 (work packages) and the backlog (feature ids).
 * The Gradle test task passes the paths of the hazard log and BUILD-PROMPT.md.
 */
class SuiteCatalogueTest :
    FunSpec({
        val hazardLog = HazardLogSuites.read(sourcePath("hms.scenarios.hazardLog"))
        val buildPrompt = Files.readAllLines(sourcePath("hms.scenarios.buildPrompt"))
        val backlog = Backlog.read(sourcePath("hms.scenarios.backlog"))
        val section185 = buildPrompt.dropWhile { !it.startsWith("### 18.5 ") }.drop(1).takeWhile { !it.startsWith("### ") }
        val workPackages21 =
            buildPrompt
                .dropWhile { !it.startsWith("## 21. ") }
                .takeWhile { !it.startsWith("## 22. ") }
                .mapNotNull { Regex("""^\| \*\*(\d+\.\d+[a-z]?) """).find(it)?.groupValues?.get(1) }
                .map { "WP-$it" }
                .toSet()
        val suites = SuiteCatalogue.suites

        test("the catalogue holds the ten §18.5 suites, numbered 1 to 10 in order") {
            suites.map { it.number } shouldContainExactly (1..ScenarioSuite.SECTION_18_5_SUITES).toList()
            suites.map { it.id }.toSet().size shouldBe ScenarioSuite.SECTION_18_5_SUITES
        }

        test("every suite name the hazard log plans (other than proposed suites) is catalogued, and nothing else") {
            suites.map { it.area } shouldContainExactlyInAnyOrder hazardLog.plannedSuites()
        }

        suites.forEach { suite ->
            context("${suite.verificationName} (§18.5 #${suite.number})") {
                test("its hazards are exactly the hazard-log entries with a control that plans it") {
                    suite.hazards shouldContainExactlyInAnyOrder hazardLog.hazardsPlanning(suite.area)
                }

                test("its SIs and seeded hazards are exactly those entries'") {
                    val entries = hazardLog.hazardsPlanning(suite.area).map { hazardLog.entry(it) }
                    suite.invariants shouldContainExactlyInAnyOrder entries.flatMap { it.invariants }.distinct()
                    suite.seededHazards shouldContainExactlyInAnyOrder entries.flatMap { it.seededHazards }.distinct()
                }

                test("an unlinked seeded hazard is one that no linked entry carries") {
                    suite.unlinkedSeededHazards.forEach { seeded -> withClue(seeded) { (seeded in suite.seededHazards) shouldBe false } }
                }

                test("its title and every scenario title are §18.5's words") {
                    val line = section185.single { it.startsWith("${suite.number}. **") }
                    line shouldContain "**${suite.title}"
                    suite.scenarios.forEach { scenario -> line shouldContain scenario.title }
                }

                test("it is NOT-BUILT, waiting on §21 work packages, backlog features of those packages and KA-064") {
                    val waits = suite.waitsOn
                    waits.knownAnomaly shouldBe "KA-064"
                    waits.workPackages.shouldNotBeEmpty()
                    waits.workPackages.filterNot { it in workPackages21 }.shouldBeEmpty()
                    waits.backlog.forEach { feature ->
                        withClue("backlog $feature") {
                            val planned = backlog.getValue(feature)
                            planned.any { wp -> waits.workPackages.any { wp == it || wp.startsWith("$it ") } } shouldBe true
                        }
                    }
                }

                test("every registered scenario id is SCN-${suite.area}-nnn, numbered from 001") {
                    suite.scenarios.mapIndexed { index, scenario -> scenario.id shouldBe "SCN-${suite.area}-%03d".format(index + 1) }
                }
            }
        }

        test("only the CPOE harness (§18.5 #1) and, on the stricter reading, ISMP carry the mock-KB label") {
            suites.filter { it.mockKb }.map { it.area } shouldContainExactly listOf("cpoe-error-category-harness", "ismp")
        }

        test("no suite has a binding: a run reports all ten NOT-BUILT and never a pass") {
            val report = ScenarioRunner(suites, emptyList(), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC)).run()
            report.suites.map { it.result }.toSet() shouldBe setOf(Result.NOT_BUILT)
            report.scenarioCount(Result.PASS) shouldBe 0
            report.exitCode shouldBe 1
        }
    })

private fun sourcePath(property: String): Path {
    val value = checkNotNull(System.getProperty(property)) { "$property is not set: run this test through Gradle" }
    return Path.of(value)
}

/** The parts of docs/safety/hazard-log.yaml the catalogue links to, read as text (the file's layout is fixed by its schema). */
private class HazardLogSuites(
    private val entries: Map<String, Entry>,
    private val planned: Map<String, Set<String>>,
) {
    class Entry(
        val invariants: List<String>,
        val seededHazards: List<String>,
    )

    fun plannedSuites(): Set<String> = planned.keys

    fun hazardsPlanning(area: String): Set<String> = planned[area].orEmpty()

    fun entry(id: String): Entry = entries.getValue(id)

    companion object {
        private val hazardStart = Regex("""^ {2}- id: (HAZ-\d{4})\s*$""")
        private val seeded = Regex("""^ {4}seeded_hazard: (.*)$""")
        private val invariants = Regex("""^ {4}invariants: \[(.*)]\s*$""")
        private val suite = Regex(""""ScenarioSuite:([a-z0-9-]+)(?: \(([^)]*)\))?"""")

        fun read(path: Path): HazardLogSuites {
            val entries = mutableMapOf<String, Entry>()
            val planned = mutableMapOf<String, MutableSet<String>>()
            var current: String? = null
            var currentInvariants = emptyList<String>()
            var currentSeeded = emptyList<String>()

            fun close() {
                current?.let { entries[it] = Entry(currentInvariants, currentSeeded) }
            }
            for (line in Files.readAllLines(path)) {
                hazardStart.find(line)?.let {
                    close()
                    current = it.groupValues[1]
                    currentInvariants = emptyList()
                    currentSeeded = emptyList()
                }
                seeded.find(line)?.let { currentSeeded = list(it.groupValues[1]) }
                invariants.find(line)?.let { currentInvariants = list(it.groupValues[1]) }
                val id = current ?: continue
                suite.find(line)?.let { match ->
                    val qualifier = match.groupValues[2]
                    if (!qualifier.startsWith("proposed")) planned.getOrPut(match.groupValues[1]) { mutableSetOf() } += id
                }
            }
            close()
            return HazardLogSuites(entries, planned)
        }

        private fun list(raw: String): List<String> =
            raw
                .trim()
                .removePrefix("[")
                .removeSuffix("]")
                .split(',')
                .map { it.trim() }
                .filter { it.isNotEmpty() && it != "null" }
    }
}

/** Feature id → its work_packages entries in docs/program/backlog.yaml (the generated backlog, read as text). */
private object Backlog {
    fun read(path: Path): Map<String, List<String>> {
        val result = mutableMapOf<String, MutableList<String>>()
        var feature: String? = null
        var inWorkPackages = false
        for (line in Files.readAllLines(path)) {
            when {
                line.startsWith("- id: ") -> {
                    feature = line.removePrefix("- id: ").trim()
                    result.getOrPut(feature) { mutableListOf() }
                    inWorkPackages = false
                }

                line == "  work_packages:" -> {
                    inWorkPackages = true
                }

                inWorkPackages && line.startsWith("  - ") -> {
                    feature?.let { result.getValue(it) += line.removePrefix("  - ").trim() }
                }

                else -> {
                    inWorkPackages = false
                }
            }
        }
        return result
    }
}
