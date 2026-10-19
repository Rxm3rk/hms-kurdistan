package hms.kernel.archrules.migration

/** The order in which Flyway applies a migration tree; the linter needs it to tell "after the creating migration". */
internal object FlywayOrder {
    private val flywayName = Regex("""^([VR])(.*?)__.*""")

    /** Versioned migrations by version, then repeatable ones by name, then any other file by name. */
    fun sort(scripts: List<MigrationScript>): List<MigrationScript> =
        scripts.sortedWith(
            compareBy<MigrationScript> { orderGroup(it) }
                .thenComparator { a, b -> compareVersions(versionOf(a), versionOf(b)) }
                .thenBy { it.name },
        )

    private fun fileName(script: MigrationScript): String = script.name.substringAfterLast('/')

    private fun orderGroup(script: MigrationScript): Int =
        when (flywayName.matchEntire(fileName(script))?.groupValues?.get(1)) {
            "V" -> 0
            "R" -> 1
            else -> 2
        }

    private fun versionOf(script: MigrationScript): List<Long> {
        val groups = flywayName.matchEntire(fileName(script))?.groupValues.orEmpty()
        val version = if (groups.getOrNull(1) == "V") groups[2] else ""
        return version.split('.', '_').mapNotNull { it.toLongOrNull() }
    }

    private fun compareVersions(
        a: List<Long>,
        b: List<Long>,
    ): Int {
        val first = a.zip(b).firstOrNull { (x, y) -> x != y }
        return first?.let { (x, y) -> x.compareTo(y) } ?: a.size.compareTo(b.size)
    }
}
