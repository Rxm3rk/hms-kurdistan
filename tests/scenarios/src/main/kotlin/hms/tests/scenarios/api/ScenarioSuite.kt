package hms.tests.scenarios.api

/**
 * A clinical scenario suite of BUILD-PROMPT §18.5 (docs/specs/modules/state-machines-and-invariants.md §5).
 *
 * The suite's [area] is the name the hazard log plans for it (`ScenarioSuite:<area>` in a control's
 * `planned_verification`), so [verificationName] links the pass matrix to the hazard log (§18.1, §18.2).
 * A suite runs only through a [SuiteBinding]; without one every planned scenario is NOT-BUILT and waits on [waitsOn].
 */
@Suppress("LongParameterList") // One parameter per catalogue field; the catalogue passes every one by name.
class ScenarioSuite(
    /** Kebab-case area: the hazard log's planned suite name, for example `closed-loop-medication`. */
    val area: String,
    /** The suite's number in the §18.5 list (1 to 10); 0 for a fixture suite outside §18.5. */
    val number: Int,
    /** The suite's name as §18.5 writes it, for example `Closed-loop medication`. */
    val title: String,
    /** Hazard-log entries (`HAZ-nnnn`) whose controls plan this suite as their verification. */
    val hazards: List<String>,
    /** Seeded hazards (§2.4, `H1`..`H15`) of those hazard-log entries. */
    val seededHazards: List<String>,
    /** SIs (`SI-nn`) of those hazard-log entries. */
    val invariants: List<String>,
    /**
     * True while the suite runs on the mock drug knowledge base: every result line of the suite then reads
     * "mock-KB run, not clinical evidence" (§18.5 #1). Clearing it needs the licensed KB and CSO-approved
     * scenarios [HUMAN].
     */
    val mockKb: Boolean,
    /** What the suite waits on while it has no binding. */
    val waitsOn: WaitsOn,
    /** The scenarios registered for this suite. Their ids never change; new scenarios are appended. */
    val scenarios: List<PlannedScenario>,
    /**
     * Seeded hazards that the suite's §18.5 text exercises but that no hazard-log entry linked to the suite
     * carries yet. An engineering proposal [P] for the hazard log, awaiting CSO triage [HUMAN]; never a link.
     */
    val unlinkedSeededHazards: List<String> = emptyList(),
    /** Citations for the suite's content and links (BUILD-PROMPT, hazard-log controls). */
    val sources: List<String> = emptyList(),
) {
    /** Suite id, `SCN-<area>`. */
    val id: String = "$ID_PREFIX$area"

    /** The name the hazard log uses in `planned_verification`. */
    val verificationName: String = "$VERIFICATION_PREFIX$area"

    init {
        require(AREA.matches(area)) { "suite area '$area' must be kebab-case" }
        require(number in 0..SECTION_18_5_SUITES) { "suite $id: number $number is outside 0..$SECTION_18_5_SUITES" }
        require(title.isNotBlank()) { "suite $id has no title" }
        requireAll(hazards, HAZARD, "hazard")
        requireAll(seededHazards, SEEDED_HAZARD, "seeded hazard")
        requireAll(unlinkedSeededHazards, SEEDED_HAZARD, "unlinked seeded hazard")
        requireAll(invariants, INVARIANT, "SI")
        require(scenarios.isNotEmpty()) { "suite $id registers no scenario" }
        scenarios.forEach { scenario ->
            require(scenario.id.startsWith("$id-")) { "scenario ${scenario.id} does not belong to suite $id" }
        }
        require(scenarios.map { it.id }.toSet().size == scenarios.size) { "suite $id registers a scenario id twice" }
    }

    private fun requireAll(
        values: List<String>,
        pattern: Regex,
        what: String,
    ) {
        values.forEach { value -> require(pattern.matches(value)) { "suite $id: '$value' is not a $what id" } }
        require(values.toSet().size == values.size) { "suite $id lists a $what twice" }
    }

    companion object {
        /** Prefix of every suite and scenario id. */
        const val ID_PREFIX: String = "SCN-"

        /** Prefix of the hazard log's planned suite names. */
        const val VERIFICATION_PREFIX: String = "ScenarioSuite:"

        /** The number of suites §18.5 lists. */
        const val SECTION_18_5_SUITES: Int = 10

        internal val AREA = Regex("[a-z0-9]+(-[a-z0-9]+)*")
        internal val HAZARD = Regex("HAZ-\\d{4}")
        internal val SEEDED_HAZARD = Regex("H([1-9]|1[0-5])")
        internal val INVARIANT = Regex("SI-(0[1-9]|1\\d|2[01])")
    }
}

/** A scenario registered in the catalogue by id and title. A binding supplies its executable [Scenario]. */
class PlannedScenario(
    /** `SCN-<area>-nnn`. */
    val id: String,
    /** The scenario's title; for the §18.5 suites it is taken verbatim from §18.5. */
    val title: String,
    /** Hazard-log entries the scenario serves; empty means the suite's hazards. */
    val hazards: List<String> = emptyList(),
) {
    init {
        require(Scenario.ID.matches(id)) { "scenario id '$id' must read SCN-<area>-nnn" }
        require(title.isNotBlank()) { "scenario $id has no title" }
        hazards.forEach { require(ScenarioSuite.HAZARD.matches(it)) { "scenario $id: '$it' is not a hazard id" } }
    }

    companion object {
        /** Registers [titles] as the scenarios `SCN-<area>-001`, `-002`, ... of the suite with [area], in order. */
        fun numbered(
            area: String,
            titles: List<String>,
        ): List<PlannedScenario> = titles.mapIndexed { index, title -> PlannedScenario(Scenario.idOf(area, index + 1), title) }
    }
}

/**
 * What an unbound suite waits on (BUILD-PROMPT §3.5: an unimplemented path names its backlog IDs and its known
 * anomaly). Work packages are §21 ids, backlog ids are Appendix A feature ids.
 */
class WaitsOn(
    val workPackages: List<String>,
    val backlog: List<String>,
    val knownAnomaly: String,
    /** Gates only a human can pass, each marked [HUMAN]. */
    val human: List<String> = emptyList(),
) {
    init {
        require(workPackages.isNotEmpty()) { "a NOT-BUILT entry must name the work packages it waits on" }
        workPackages.forEach { require(WORK_PACKAGE.matches(it)) { "'$it' is not a §21 work package id" } }
        backlog.forEach { require(BACKLOG.matches(it)) { "'$it' is not an Appendix A feature id" } }
        require(KNOWN_ANOMALY.matches(knownAnomaly)) { "'$knownAnomaly' is not a known-anomaly id" }
        human.forEach { require(it.contains("[HUMAN]")) { "human gate '$it' must be marked [HUMAN]" } }
    }

    /** One line for the matrix and the console. */
    fun describe(): String =
        buildString {
            append("waits on ").append(workPackages.joinToString(", "))
            if (backlog.isNotEmpty()) append(" (backlog ").append(backlog.joinToString(", ")).append(')')
            if (human.isNotEmpty()) append("; ").append(human.joinToString("; "))
            append("; ").append(knownAnomaly)
        }

    private companion object {
        val WORK_PACKAGE = Regex("WP-\\d+\\.\\d+[a-z]?")
        val BACKLOG = Regex("[A-Z]+(-[A-Z0-9]+)+")
        val KNOWN_ANOMALY = Regex("KA-\\d{3}")
    }
}
