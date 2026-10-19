package hms.tests.invariants.application.register

/**
 * Whether a register entry is complete and true to its sources (docs/specs/modules/state-machines-and-invariants.md
 * §4 rule 2): the SI's text is §2.1's, its hazards are exactly the hazard-log entries that name it, its planned test
 * names are the hazard log's, its backlog IDs exist and belong to the work package it waits on, its known anomaly
 * exists and is open, and every specification-layer claim names a machine that serves the SI and clauses that exist.
 * Each function returns the problems found; an empty list means the entry is complete.
 */
object RegisterChecks {
    /** The known anomaly that lists the not-built SI domain layers (spec §4 rule 4, §8). */
    const val NOT_BUILT_ANOMALY: String = "KA-060"

    private val propertyTestName = Regex("""^PropertyTest:\S+$""")
    private val relativePath = Regex("""^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$""")

    /** Problems of the register as a whole: one entry per SI-01…SI-21, in order, each complete. */
    fun problems(
        register: SiRegister,
        sources: SiSources,
    ): List<String> {
        val order =
            if (register.entries.map { it.si } == SiRegister.SI_IDS) {
                emptyList()
            } else {
                listOf("the register must hold SI-01…SI-21 once each, in order; it holds ${register.entries.map { it.si }}")
            }
        return order + register.entries.flatMap { entry -> problems(entry, sources).map { "${entry.si}: $it" } }
    }

    /** Problems of one entry. */
    fun problems(
        entry: SiEntry,
        sources: SiSources,
    ): List<String> =
        text(entry, sources) + hazards(entry, sources) + backlog(entry, sources) + domain(entry, sources) + specLayer(entry, sources)

    private fun text(
        entry: SiEntry,
        sources: SiSources,
    ): List<String> {
        val row = sources.invariants[entry.si] ?: return listOf("BUILD-PROMPT §2.1 has no row for ${entry.si}")
        return listOfNotNull(
            "title is not §2.1's text, verbatim".takeIf { entry.title != row.text },
            "enforced_in is not §2.1's 'Enforced in' column, verbatim".takeIf { entry.enforcedIn != row.enforcedIn },
        )
    }

    private fun hazards(
        entry: SiEntry,
        sources: SiSources,
    ): List<String> {
        val naming =
            sources.hazards.values
                .filter { entry.si in it.invariants }
                .map { it.id }
        val planned =
            entry.hazards
                .mapNotNull { sources.hazards[it] }
                .flatMap { it.plannedPropertyTests }
                .distinct()
        return listOfNotNull(
            "hazards must be exactly the hazard-log entries whose invariants name ${entry.si}: $naming".takeIf { entry.hazards != naming },
            "hazards is empty".takeIf { entry.hazards.isEmpty() },
            "planned_test must be PropertyTest:${entry.si}-*".takeIf { entry.plannedTest != "PropertyTest:${entry.si}-*" },
            "the hazard log does not plan ${entry.plannedTest}".takeIf { entry.plannedTest !in planned },
            "planned_tests must be exactly the hazard log's PropertyTest names for ${entry.hazards}: $planned".takeIf {
                entry.plannedTests !=
                    planned
            },
        )
    }

    private fun backlog(
        entry: SiEntry,
        sources: SiSources,
    ): List<String> {
        val own = if (entry.backlog.isEmpty()) listOf("backlog is empty: a NOT-BUILT layer carries backlog IDs (§3.5)") else emptyList()
        return own +
            entry.backlog.flatMap { id ->
                val feature = sources.backlog[id] ?: return@flatMap listOf("backlog ID $id does not exist in docs/program/backlog.yaml")
                listOfNotNull(
                    "backlog ID $id is not planned in ${entry.waitsOn} (its work packages: ${feature.workPackages})"
                        .takeIf { feature.workPackages.none { plannedIn(it, entry.waitsOn) } },
                    "backlog ID $id is not linked to any of ${entry.hazards} (its hazards: ${feature.hazards})"
                        .takeIf { feature.hazards.none { it in entry.hazards } },
                )
            }
    }

    private fun domain(
        entry: SiEntry,
        sources: SiSources,
    ): List<String> {
        val status = sources.knownAnomalies[entry.knownAnomaly]
        return listOfNotNull(
            "waits_on ${entry.waitsOn} is not a §21 work package or phase".takeIf { entry.waitsOn !in sources.workPackages },
            "ka must be $NOT_BUILT_ANOMALY, the known anomaly that lists the not-built domain layers"
                .takeIf { entry.domainLayer == DomainLayer.NOT_BUILT && entry.knownAnomaly != NOT_BUILT_ANOMALY },
            "known anomaly ${entry.knownAnomaly} does not exist in KNOWN-ANOMALIES.md".takeIf { status == null },
            "known anomaly ${entry.knownAnomaly} is '$status', not open".takeIf { status != null && status != "open" },
            "domain_watch is empty".takeIf { entry.domainWatch.isEmpty() },
            "domain_marker must be the first domain_watch path".takeIf { entry.domainWatch.firstOrNull()?.path != entry.domainMarker },
            "a domain_watch path must be repository-relative, with forward slashes, without '..'"
                .takeIf { entry.domainWatch.any { !relative(it.path) } },
        )
    }

    private fun specLayer(
        entry: SiEntry,
        sources: SiSources,
    ): List<String> {
        val clauses =
            entry.hazards
                .mapNotNull { sources.hazards[it] }
                .flatMap { it.clauses }
                .toSet()
        val duplicates =
            entry.specLayer
                .groupBy { it.machine to it.property }
                .filterValues { it.size > 1 }
                .keys
        return duplicates.map { "spec_layer lists ${it.second} on ${it.first} twice" } +
            entry.specLayer.flatMap { property ->
                val machine = sources.machines[property.machine]
                listOfNotNull(
                    "spec_layer machine ${property.machine} does not exist".takeIf { machine == null },
                    "machine ${property.machine} does not list ${entry.si} in its invariants".takeIf {
                        machine != null &&
                            entry.si !in machine.invariants
                    },
                    "machine ${property.machine} lists none of ${entry.hazards} in its hazards"
                        .takeIf { machine != null && machine.hazards.none { it in entry.hazards } },
                    "${property.property} is not a planned PropertyTest name of ${entry.si} (the hazard log's names only)"
                        .takeIf { !propertyTestName.matches(property.property) || property.property !in entry.plannedTests },
                    "${property.property}: clauses is empty".takeIf { property.clauses.isEmpty() },
                    "${property.property}: clauses ${property.clauses - clauses} are not clauses of ${entry.hazards}"
                        .takeIf { !clauses.containsAll(property.clauses) },
                )
            }
    }

    /** A backlog work_packages item ("WP-0.4 (base)", "Phase 5 (...)") is planned in [waitsOn] ("WP-0.4", "Phase 5"). */
    private fun plannedIn(
        item: String,
        waitsOn: String,
    ): Boolean = item == waitsOn || item.startsWith("$waitsOn ")

    private fun relative(path: String): Boolean = relativePath.matches(path) && path.split('/').none { it == ".." || it == "." }
}
