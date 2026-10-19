package hms.tests.invariants.application.register

import java.nio.file.Files
import java.nio.file.Path

/**
 * The records an SI register entry is checked against (docs/specs/modules/state-machines-and-invariants.md §4 rule 2):
 * BUILD-PROMPT §2.1 (the SI text) and §21 (work packages and phases), the hazard log, the backlog and the known
 * anomalies. Each is read as text, the way its layout is fixed by its generator or schema.
 */
class SiSources(
    val invariants: Map<String, SectionTwoOneRow>,
    val workPackages: Set<String>,
    val hazards: Map<String, HazardEntry>,
    val backlog: Map<String, BacklogFeature>,
    val knownAnomalies: Map<String, String>,
    val machines: Map<String, MachineSpecFile>,
) {
    companion object {
        /** Reads the sources from their files. */
        fun read(files: SourceFiles): SiSources {
            val buildPrompt = Files.readAllLines(files.buildPrompt)
            return SiSources(
                invariants = SourceParsers.sectionTwoOne(buildPrompt),
                workPackages = SourceParsers.sectionTwentyOne(buildPrompt),
                hazards = SourceParsers.hazardLog(Files.readAllLines(files.hazardLog)),
                backlog = SourceParsers.backlog(Files.readAllLines(files.backlog)),
                knownAnomalies = SourceParsers.knownAnomalies(Files.readAllLines(files.knownAnomalies)),
                machines = SourceParsers.machines(files.stateMachines),
            )
        }
    }
}

/** One row of the BUILD-PROMPT §2.1 table: the invariant's text, where it is enforced and its seeded hazards. */
data class SectionTwoOneRow(
    val text: String,
    val enforcedIn: String,
    val hazard: String,
)

/** The parts of one hazard-log entry an SI register entry refers to. */
data class HazardEntry(
    val id: String,
    val invariants: List<String>,
    val clauses: List<String>,
    val plannedPropertyTests: List<String>,
)

/** A backlog feature: the work packages that build it and the hazard entries that name it. */
data class BacklogFeature(
    val id: String,
    val workPackages: List<String>,
    val hazards: List<String>,
)

/** The parts of a state-machine spec the register refers to: its `invariants` and `hazards` lists. */
data class MachineSpecFile(
    val machine: String,
    val invariants: List<String>,
    val hazards: List<String>,
)

/** The files behind [SiSources], plus the repository root that domain-watch paths are relative to. */
data class SourceFiles(
    val repositoryRoot: Path,
    val register: Path,
    val buildPrompt: Path,
    val hazardLog: Path,
    val backlog: Path,
    val knownAnomalies: Path,
    val stateMachines: Path,
) {
    companion object {
        /** System property prefix: the Gradle test tasks pass every path as `hms.invariants.<name>`. */
        const val PROPERTY_PREFIX: String = "hms.invariants."

        /** The paths the Gradle test task passed; fails when one is missing (an IDE run without Gradle). */
        fun fromSystemProperties(): SourceFiles {
            fun path(name: String): Path {
                val key = PROPERTY_PREFIX + name
                val value = checkNotNull(System.getProperty(key)) { "$key is not set: run this test through Gradle" }
                return Path.of(value)
            }
            return SourceFiles(
                repositoryRoot = path("repositoryRoot"),
                register = path("register"),
                buildPrompt = path("buildPrompt"),
                hazardLog = path("hazardLog"),
                backlog = path("backlog"),
                knownAnomalies = path("knownAnomalies"),
                stateMachines = path("stateMachines"),
            )
        }
    }
}

/** Text parsers for the sources; public so the self-tests can feed them fixtures. */
object SourceParsers {
    private val siRow = Regex("""^\| (\d\d) \| """)
    private val workPackageRow = Regex("""^\| \*\*(\d+\.\d+[a-z]?) """)
    private val phaseHeading = Regex("""^### (Phase \d+(?:\.\d+)?):""")
    private val hazardStart = Regex("""^ {2}- id: (HAZ-\d{4})\s*$""")
    private val hazardInvariants = Regex("""^ {4}invariants: \[(.*)]\s*$""")
    private val hazardClause = Regex("""^ {6}- \{id: ([a-z]+), text: """)
    private val plannedPropertyTest = Regex("""^ {10}- "(PropertyTest:[^" ]+)""")
    private val knownAnomalyRow = Regex("""^\| (KA-\d{3}) \| """)
    private val listKey = Regex("""^([a-z]+): \[([^\]]*)]""")

    /** The §2.1 table rows by SI ("SI-01"). A row whose cells do not split into exactly four is an error. */
    fun sectionTwoOne(lines: List<String>): Map<String, SectionTwoOneRow> =
        section(lines, "### 2.1 ", "### ")
            .filter { siRow.containsMatchIn(it) }
            .associate { line ->
                val cells = line.removePrefix("| ").removeSuffix(" |").split(" | ")
                require(cells.size == SECTION_TWO_ONE_COLUMNS) { "BUILD-PROMPT §2.1 row does not have four cells: $line" }
                "SI-${cells[0]}" to SectionTwoOneRow(cells[1], cells[2], cells[3])
            }

    /** The §21 work package ids ("WP-0.4", "WP-1.1b") and phase names ("Phase 5"). */
    fun sectionTwentyOne(lines: List<String>): Set<String> {
        val section = section(lines, "## 21. ", "## ")
        val packages = section.mapNotNull { workPackageRow.find(it)?.groupValues?.get(1) }.map { "WP-$it" }
        val phases = section.mapNotNull { phaseHeading.find(it)?.groupValues?.get(1) }
        return (packages + phases).toSet()
    }

    /** The hazard-log entries by id, with their SIs, clause ids and planned `PropertyTest:` names (qualifiers removed). */
    fun hazardLog(lines: List<String>): Map<String, HazardEntry> {
        val result = linkedMapOf<String, HazardEntry>()
        var current: HazardEntry? = null
        for (line in lines) {
            val start = hazardStart.find(line)
            if (start != null) {
                current?.let { result[it.id] = it }
                current = HazardEntry(start.groupValues[1], emptyList(), emptyList(), emptyList())
                continue
            }
            current = current?.read(line)
        }
        current?.let { result[it.id] = it }
        return result
    }

    /** The backlog features by id, with their work packages and hazards (docs/program/backlog.yaml, generated layout). */
    fun backlog(lines: List<String>): Map<String, BacklogFeature> {
        val result = linkedMapOf<String, BacklogFeature>()
        var feature: BacklogFeature? = null
        var list: String? = null
        for (line in lines) {
            when {
                line.startsWith("- id: ") -> {
                    feature?.let { result[it.id] = it }
                    feature = BacklogFeature(line.removePrefix("- id: ").trim(), emptyList(), emptyList())
                    list = null
                }
                line == "  work_packages:" || line == "  hazards:" -> list = line.trim().removeSuffix(":")
                line.startsWith("  - ") && list == "hazards" -> feature = feature?.let { it.copy(hazards = it.hazards + line.drop(LIST_ITEM)) }
                line.startsWith("  - ") && list != null -> feature = feature?.let { it.copy(workPackages = it.workPackages + line.drop(LIST_ITEM)) }
                else -> list = null
            }
        }
        feature?.let { result[it.id] = it }
        return result
    }

    /** The known-anomaly rows by id → their status column (`open`, `mitigated`, `closed ...`). */
    fun knownAnomalies(lines: List<String>): Map<String, String> =
        lines
            .filter { knownAnomalyRow.containsMatchIn(it) }
            .associate { line ->
                val cells = line.removePrefix("| ").removeSuffix(" |").split(" | ")
                require(cells.size >= KNOWN_ANOMALY_COLUMNS) { "KNOWN-ANOMALIES.md row has fewer than seven cells: ${cells.first()}" }
                cells.first() to cells[cells.size - 2].trim()
            }

    /** The state-machine specs in [directory] by machine name, with their top-level `invariants` and `hazards` lists. */
    fun machines(directory: Path): Map<String, MachineSpecFile> =
        Files.list(directory).use { paths ->
            paths
                .filter { it.fileName.toString().endsWith(".yaml") }
                .map { path -> machine(path.fileName.toString().removeSuffix(".yaml"), Files.readAllLines(path)) }
                .toList()
                .associateBy { it.machine }
        }

    /** One spec's top-level `invariants` and `hazards` (flow lists, as every spec writes them). */
    fun machine(
        name: String,
        lines: List<String>,
    ): MachineSpecFile {
        val lists = lines.mapNotNull { listKey.find(it) }.associate { it.groupValues[1] to items(it.groupValues[2]) }
        return MachineSpecFile(name, lists["invariants"].orEmpty(), lists["hazards"].orEmpty())
    }

    private fun section(
        lines: List<String>,
        heading: String,
        nextHeading: String,
    ): List<String> = lines.dropWhile { !it.startsWith(heading) }.drop(1).takeWhile { !it.startsWith(nextHeading) }

    private fun HazardEntry.read(line: String): HazardEntry {
        val invariantsMatch = hazardInvariants.find(line)
        val clauseMatch = hazardClause.find(line)
        val plannedMatch = plannedPropertyTest.find(line)
        return when {
            invariantsMatch != null -> copy(invariants = items(invariantsMatch.groupValues[1]))
            clauseMatch != null -> copy(clauses = clauses + clauseMatch.groupValues[1])
            plannedMatch != null -> copy(plannedPropertyTests = (plannedPropertyTests + plannedMatch.groupValues[1]).distinct())
            else -> this
        }
    }

    private fun items(raw: String): List<String> = raw.split(',').map { it.trim() }.filter { it.isNotEmpty() }

    private const val SECTION_TWO_ONE_COLUMNS = 4
    private const val KNOWN_ANOMALY_COLUMNS = 7
    private const val LIST_ITEM = 4
}
