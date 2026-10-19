package hms.kernel.archrules.migration

/**
 * The statements refused against a fact table and against its trigger function (platform-journal.md §9.3 item 3):
 * `DROP TABLE`; `ALTER TABLE ... RENAME`, `DROP COLUMN`, `ALTER COLUMN ... TYPE`, `OWNER TO`, `SET UNLOGGED`,
 * `DISABLE TRIGGER`, `ENABLE REPLICA|ALWAYS TRIGGER`, `ATTACH|DETACH PARTITION`, `NO FORCE` and `DISABLE ROW LEVEL
 * SECURITY`; `DROP TRIGGER`, `ALTER TRIGGER` and any further `CREATE TRIGGER`; `CREATE RULE`; `DROP POLICY` and
 * `ALTER POLICY`; `GRANT` of `UPDATE`, `DELETE`, `TRUNCATE` or `TRIGGER`; and, after the migration that creates
 * it, `CREATE OR REPLACE`, `ALTER` or `DROP` of a trigger function.
 *
 * Tightenings (fail closed): `ALTER TABLE ... SET SCHEMA`, `INHERIT`, `SET EXPRESSION` and `DROP EXPRESSION` (each
 * moves or rewrites rows), `GRANT ALL`, grants on `ALL TABLES IN SCHEMA` and default privileges that hand out the
 * refused privileges, `CREATE UNLOGGED TABLE` and `CREATE TABLE ... PARTITION OF` for a fact table, attaching a fact
 * table as another table's partition, a fact table's foreign key with `ON DELETE|UPDATE CASCADE|SET ...`, and
 * renaming or re-owning a schema that may hold a fact table.
 */
internal class FactTableChecks(
    private val catalogue: FactTableCatalogue,
) {
    private val checks: Map<String, (SqlStatement, ParsedScript) -> List<Violation>> =
        mapOf(
            "ALTER TABLE" to { statement, _ -> alterTable(statement) },
            "DROP TABLE" to { statement, _ -> dropTable(statement) },
            "CREATE TABLE" to { statement, _ -> createTable(statement) },
            "CREATE TRIGGER" to ::createTrigger,
            "DROP TRIGGER" to { statement, _ -> onFactTable(statement, "ON") },
            "ALTER TRIGGER" to { statement, _ -> onFactTable(statement, "ON") },
            "CREATE RULE" to { statement, _ -> onFactTable(statement, "TO") },
            "DROP POLICY" to { statement, _ -> onFactTable(statement, "ON") },
            "ALTER POLICY" to { statement, _ -> onFactTable(statement, "ON") },
            "ALTER SCHEMA" to { statement, _ -> alterSchema(statement) },
        )

    /** Every violation [statement] of [script] makes against a fact table or its protection. */
    fun check(
        statement: SqlStatement,
        script: ParsedScript,
    ): List<Violation> {
        val key = "${statement.verb} ${statement.objectType}"
        return checks[key]?.invoke(statement, script).orEmpty() +
            GrantChecks.check(statement, catalogue) +
            triggerFunction(statement, script)
    }

    private fun protection(detail: String) = Violation(MigrationRule.FACT_TABLE_PROTECTION_CHANGED, detail)

    private fun alterTable(statement: SqlStatement): List<Violation> {
        val read = statement.nameAfter(statement.objectIndex + 1, SqlStatement.IF_EXISTS + "ONLY")
        val start = read?.next?.let { if (statement.tokens.getOrNull(it)?.isSymbol("*") == true) it + 1 else it } ?: 0
        val actions = AlterTableActions.split(statement.tokens.drop(start))
        val fact = catalogue.isFact(read?.name)
        return actions.mapNotNull { action ->
            val refused = if (fact) AlterTableActions.refusedOnFactTable(action) else null
            (refused ?: AlterTableActions.attachesFactTable(action, catalogue))?.let { protection("ALTER TABLE ${read?.name} $it") }
        } + referentialActions(statement, read?.name)
    }

    /** `ON DELETE|UPDATE CASCADE|SET ...` in a fact table's own foreign keys would change its rows (tightening). */
    private fun referentialActions(
        statement: SqlStatement,
        table: SqlName?,
    ): List<Violation> {
        val words = statement.tokens.map { it.keyword }
        val changesRows =
            words.indices.any { i ->
                words[i] == "ON" && words.getOrNull(i + 1) in REFERENTIAL_EVENTS && words.getOrNull(i + 2) in ROW_CHANGING_ACTIONS
            }
        val refused = catalogue.isFact(table) && changesRows
        return if (refused) listOf(protection("foreign key action that changes rows of $table")) else emptyList()
    }

    private fun dropTable(statement: SqlStatement): List<Violation> =
        SqlNames
            .readList(statement.tokens, statement.skip(statement.objectIndex + 1, SqlStatement.IF_EXISTS))
            .filter { catalogue.isFact(it) }
            .map { protection("DROP TABLE $it") }

    private fun createTable(statement: SqlStatement): List<Violation> {
        val table = statement.nameAfter(statement.objectIndex + 1, SqlStatement.IF_EXISTS)?.name
        val unlogged = statement.tokens.take(statement.objectIndex).any { it.keyword == "UNLOGGED" }
        val partitionOf = statement.indexOf("PARTITION").takeIf { statement.keywordAt(it + 1) == "OF" }
        val parent = partitionOf?.let { statement.nameAfter(it + 2)?.name }
        return listOfNotNull(
            protection("CREATE UNLOGGED TABLE $table").takeIf { unlogged && catalogue.isFact(table) },
            protection("CREATE TABLE $table PARTITION OF $parent").takeIf { catalogue.isFact(parent) },
        ) + referentialActions(statement, table)
    }

    private fun createTrigger(
        statement: SqlStatement,
        script: ParsedScript,
    ): List<Violation> {
        val trigger = TriggerDefinition.read(statement)
        val table = trigger?.table
        val inCreatingScript = table != null && catalogue.factTables[table.table] == script.index
        val allowed = inCreatingScript && trigger.refusesChange
        return if (catalogue.isFact(table) && !allowed) {
            listOf(protection("CREATE TRIGGER on $table (only the refuse-change triggers, in the creating migration)"))
        } else {
            emptyList()
        }
    }

    /** DROP or ALTER TRIGGER and POLICY (`... ON table`) and CREATE RULE (`... TO table`). */
    private fun onFactTable(
        statement: SqlStatement,
        keyword: String,
    ): List<Violation> {
        val index = statement.indexOf(keyword, statement.objectIndex + 1)
        val table = if (index < 0) null else statement.nameAfter(index + 1, setOf("ONLY"))?.name
        return if (catalogue.isFact(table)) listOf(protection("${statement.verb} ${statement.objectType} on $table")) else emptyList()
    }

    private fun alterSchema(statement: SqlStatement): List<Violation> {
        val schema = statement.nameAfter(statement.objectIndex + 1)
        val action = statement.keywordAt(schema?.next ?: 0)
        val holdsFact = catalogue.factSchemas.any { it == null || it == schema?.name?.table }
        val refused = holdsFact && (action == "RENAME" || action == "OWNER")
        return if (refused) listOf(protection("ALTER SCHEMA ${schema?.name} $action (it may hold a fact table)")) else emptyList()
    }

    private fun triggerFunction(
        statement: SqlStatement,
        script: ParsedScript,
    ): List<Violation> {
        val isFunction = statement.objectType in FUNCTION_TYPES && statement.verb in setOf("CREATE", "ALTER", "DROP")
        val start = statement.skip(statement.objectIndex + 1, SqlStatement.IF_EXISTS)
        val names = if (isFunction) SqlNames.readList(statement.tokens, start) else emptyList()
        return names
            .filter { name -> catalogue.triggerFunctions[name.table]?.let { script.index > it } == true }
            .map { Violation(MigrationRule.TRIGGER_FUNCTION_CHANGED, "${statement.verb} ${statement.objectType} $it") }
    }

    private companion object {
        val FUNCTION_TYPES = setOf("FUNCTION", "ROUTINE")
        val REFERENTIAL_EVENTS = setOf("DELETE", "UPDATE")
        val ROW_CHANGING_ACTIONS = setOf("CASCADE", "SET")
    }
}

/** Reads the actions of an `ALTER TABLE` statement. */
internal object AlterTableActions {
    private val refusedPrefixes: List<List<String>> =
        listOf(
            listOf("RENAME"),
            listOf("OWNER", "TO"),
            listOf("SET", "UNLOGGED"),
            listOf("SET", "SCHEMA"),
            listOf("DISABLE", "TRIGGER"),
            listOf("ENABLE", "REPLICA", "TRIGGER"),
            listOf("ENABLE", "ALWAYS", "TRIGGER"),
            listOf("ATTACH", "PARTITION"),
            listOf("DETACH", "PARTITION"),
            listOf("NO", "FORCE", "ROW", "LEVEL", "SECURITY"),
            listOf("DISABLE", "ROW", "LEVEL", "SECURITY"),
            listOf("INHERIT"),
            listOf("DROP", "COLUMN"),
        )

    /** Splits the action list of ALTER TABLE at top-level commas. */
    fun split(tokens: List<SqlToken>): List<List<SqlToken>> {
        val actions = mutableListOf<List<SqlToken>>()
        var current = mutableListOf<SqlToken>()
        var depth = 0
        for (token in tokens) {
            depth += SqlNames.depthChange(token)
            if (depth == 0 && token.isSymbol(",")) {
                actions += current
                current = mutableListOf()
            } else {
                current += token
            }
        }
        actions += current
        return actions.filter { it.isNotEmpty() }
    }

    /** The refused part of [action] on a fact table, or null when it is allowed. */
    fun refusedOnFactTable(action: List<SqlToken>): String? {
        val words = action.map { it.keyword }
        val prefix = refusedPrefixes.firstOrNull { words.take(it.size) == it }
        return prefix?.joinToString(" ") ?: implicitColumnDrop(words) ?: columnRewrite(words)
    }

    /** `ATTACH PARTITION <fact table>` on any table: the fact table would become droppable with its parent. */
    fun attachesFactTable(
        action: List<SqlToken>,
        catalogue: FactTableCatalogue,
    ): String? {
        val attaches = action.getOrNull(0)?.keyword == "ATTACH" && action.getOrNull(1)?.keyword == "PARTITION"
        val partition = if (attaches) SqlNames.read(action, 2)?.name else null
        return if (catalogue.isFact(partition)) "ATTACH PARTITION $partition" else null
    }

    /** `DROP <column>`: COLUMN is optional in PostgreSQL; only DROP CONSTRAINT is allowed. */
    private fun implicitColumnDrop(words: List<String>): String? =
        if (words.firstOrNull() == "DROP" && words.getOrNull(1) != "CONSTRAINT") "DROP (column)" else null

    /** `ALTER [COLUMN] c TYPE`, `SET DATA TYPE`, `SET EXPRESSION` or `DROP EXPRESSION`. */
    private fun columnRewrite(words: List<String>): String? {
        if (words.firstOrNull() != "ALTER") return null
        val rest = words.drop(if (words.getOrNull(1) == "COLUMN") 3 else 2)
        val rewrites = columnRewrites.any { rest.take(it.size) == it }
        return if (rewrites) "ALTER COLUMN ${rest.joinToString(" ")}" else null
    }

    private val columnRewrites: List<List<String>> =
        listOf(
            listOf("TYPE"),
            listOf("SET", "DATA", "TYPE"),
            listOf("SET", "EXPRESSION"),
            listOf("DROP", "EXPRESSION"),
        )
}
