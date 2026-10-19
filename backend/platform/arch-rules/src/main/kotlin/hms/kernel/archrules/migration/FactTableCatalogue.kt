package hms.kernel.archrules.migration

/** A rule broken by one statement, before it is placed in a script and a line. */
internal class Violation(
    val rule: MigrationRule,
    val detail: String,
)

/** A table classification marker: `-- hms:fact-table <table>` (or `aggregate-table`, `read-model`). */
internal class TableMarker(
    val kind: String,
    val table: SqlName,
    val line: Int,
)

/** A lexed migration script, in Flyway order ([index]). */
internal class ParsedScript(
    val index: Int,
    val name: String,
    val statements: List<SqlStatement>,
    val markers: List<TableMarker>,
)

/** A `CREATE TRIGGER` statement as the linter reads it. */
internal class TriggerDefinition(
    val table: SqlName,
    val timing: String,
    val events: Set<String>,
    val function: SqlName?,
) {
    /** True for a BEFORE trigger that fires only on UPDATE, DELETE or TRUNCATE (a refuse-change trigger). */
    val refusesChange: Boolean get() = timing == "BEFORE" && events.isNotEmpty() && REFUSED_EVENTS.containsAll(events)

    companion object {
        /** The events a fact table's triggers must refuse (platform-journal.md §9.3 item 1). */
        val REFUSED_EVENTS: Set<String> = setOf("UPDATE", "DELETE", "TRUNCATE")
        private val EVENTS = setOf("INSERT", "UPDATE", "DELETE", "TRUNCATE")

        /** Reads a CREATE TRIGGER statement; null when it names no table. */
        fun read(statement: SqlStatement): TriggerDefinition? {
            val name = statement.nameAfter(statement.objectIndex + 1, SqlStatement.IF_EXISTS)
            val on = statement.indexOf("ON", name?.next ?: 0)
            val table = if (on < 0) null else statement.nameAfter(on + 1, setOf("ONLY"))
            val execute = statement.indexOf("EXECUTE", on.coerceAtLeast(0))
            val function = if (execute < 0) null else statement.nameAfter(execute + 1, setOf("FUNCTION", "PROCEDURE"))
            val head = if (name == null || on < 0) emptyList() else statement.tokens.subList(name.next, on)
            return table?.let {
                TriggerDefinition(
                    table = it.name,
                    timing = head.firstOrNull()?.keyword.orEmpty(),
                    events = head.map { token -> token.keyword }.filter { keyword -> keyword in EVENTS }.toSet(),
                    function = function?.name,
                )
            }
        }
    }
}

/**
 * Everything the linter learns about the tables of one migration tree before it checks statements: the
 * classification of every created table, the fact tables with the script that creates each, and each fact
 * table's refuse-change trigger functions with the script that creates each (platform-journal.md §9.3).
 */
internal class FactTableCatalogue(
    scripts: List<ParsedScript>,
) {
    /** Findings about classification and the creation rule, with the script and line they belong to. */
    val findings: List<MigrationFinding>

    /** Fact table names (the last name part) and the index of the script that creates each. */
    val factTables: Map<String, Int>

    /** Fact table names with their schema part as written (null when unqualified). */
    val factSchemas: Set<String?>

    /** The refuse-change trigger functions of the fact tables (last name part) and the script index that creates each. */
    val triggerFunctions: Map<String, Int>

    init {
        val found = mutableListOf<MigrationFinding>()
        val facts = mutableMapOf<String, Pair<SqlName, Int>>()
        for (script in scripts) {
            val created = script.statements.filter { it.verb == "CREATE" && it.objectType == "TABLE" }
            for (statement in created) {
                val table = statement.nameAfter(statement.objectIndex + 1, SqlStatement.IF_EXISTS)?.name
                val kind = table?.let { classify(script, it, statement.line, found) }
                if (kind == FACT && table != null) facts[table.table] = table to script.index
            }
            unmatchedMarkers(script, created).forEach { marker ->
                found += MigrationFinding(script.name, marker.line, MigrationRule.MISPLACED_MARKER, "${marker.kind} ${marker.table}")
            }
        }
        factTables = facts.mapValues { it.value.second }
        factSchemas = facts.values.map { it.first.schema }.toSet()
        triggerFunctions = refuseChangeTriggers(scripts, facts.mapValues { it.value.second }, found)
        findings = found
    }

    /** True when [name] is a fact table (matched on its last part, so a schema cannot hide it). */
    fun isFact(name: SqlName?): Boolean = name != null && name.table in factTables

    private fun classify(
        script: ParsedScript,
        table: SqlName,
        line: Int,
        found: MutableList<MigrationFinding>,
    ): String? {
        val markers = script.markers.filter { sameTable(it.table, table) }
        if (markers.size != 1) {
            val rule = if (markers.isEmpty()) MigrationRule.UNCLASSIFIED_TABLE else MigrationRule.MISPLACED_MARKER
            found += MigrationFinding(script.name, line, rule, "table $table has ${markers.size} classification markers")
        }
        return markers.singleOrNull()?.kind
    }

    private fun unmatchedMarkers(
        script: ParsedScript,
        created: List<SqlStatement>,
    ): List<TableMarker> {
        val tables = created.mapNotNull { it.nameAfter(it.objectIndex + 1, SqlStatement.IF_EXISTS)?.name }
        return script.markers.filter { marker -> tables.none { sameTable(marker.table, it) } }
    }

    /** Checks the creation rule and returns the refuse-change trigger functions with the script that creates each. */
    private fun refuseChangeTriggers(
        scripts: List<ParsedScript>,
        facts: Map<String, Int>,
        found: MutableList<MigrationFinding>,
    ): Map<String, Int> {
        val functions = mutableMapOf<String, Int>()
        for ((table, index) in facts) {
            val script = scripts.first { it.index == index }
            val triggers =
                script.statements
                    .filter { it.verb == "CREATE" && it.objectType == "TRIGGER" }
                    .mapNotNull { TriggerDefinition.read(it) }
                    .filter { it.table.table == table && it.refusesChange }
            if (!triggers.flatMap { it.events }.toSet().containsAll(TriggerDefinition.REFUSED_EVENTS)) {
                val line = script.markers.firstOrNull { it.table.table == table }?.line ?: 1
                found += MigrationFinding(script.name, line, MigrationRule.MISSING_REFUSE_CHANGE_TRIGGERS, "fact table $table")
            }
            triggers.mapNotNull { it.function?.table }.forEach { function ->
                functions.putIfAbsent(function, firstCreation(scripts, function) ?: index)
            }
        }
        return functions
    }

    private fun firstCreation(
        scripts: List<ParsedScript>,
        function: String,
    ): Int? =
        scripts.firstOrNull { script ->
            script.statements.any {
                it.verb == "CREATE" && it.objectType == "FUNCTION" && it.nameAfter(it.objectIndex + 1)?.name?.table == function
            }
        }?.index

    companion object {
        private const val FACT = "fact-table"

        /** The table classes of platform-journal.md §9.3. */
        val CLASSES: Set<String> = setOf(FACT, "aggregate-table", "read-model")

        /** Same table: equal names, or equal last parts when either name is unqualified. */
        fun sameTable(
            a: SqlName,
            b: SqlName,
        ): Boolean = a.parts == b.parts || (a.table == b.table && (a.schema == null || b.schema == null))
    }
}
