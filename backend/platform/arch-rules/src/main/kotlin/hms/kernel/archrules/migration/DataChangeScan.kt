package hms.kernel.archrules.migration

/**
 * Finds row changes on fact tables anywhere in a token stream: a top-level statement, a data-modifying CTE
 * (`WITH ... DELETE FROM ...`), a rule action, or a function or procedure body (platform-journal.md §9.3).
 *
 * Patterns: `UPDATE [ONLY] t`, `DELETE FROM [ONLY] t`, `TRUNCATE [TABLE] [ONLY] t, ...`, `MERGE INTO [ONLY] t`
 * and `INSERT INTO t ... ON CONFLICT ... DO UPDATE`. In a body it also finds `TRUNCATE ... CASCADE`, any
 * `EXECUTE` (dynamic SQL), and `ALTER TABLE`, `DROP TABLE` and `DROP TRIGGER ... ON` a fact table.
 */
internal class DataChangeScan(
    private val catalogue: FactTableCatalogue,
) {
    private val only = setOf("ONLY")

    /** The row changes on fact tables in [tokens]. */
    fun scan(tokens: List<SqlToken>): List<Violation> = tokens.indices.flatMap { rowChangeAt(tokens, it) }

    /** Everything refused in a function, procedure or DO body. */
    fun scanBody(tokens: List<SqlToken>): List<Violation> =
        scan(tokens) + tokens.indices.flatMap { bodyStatementAt(tokens, it) }

    private fun rowChangeAt(
        tokens: List<SqlToken>,
        index: Int,
    ): List<Violation> {
        val next = keyword(tokens, index + 1)
        val targets =
            when (tokens[index].keyword) {
                "UPDATE" -> listOfNotNull(name(tokens, index + 1, only))
                "DELETE" -> if (next == "FROM") listOfNotNull(name(tokens, index + 2, only)) else emptyList()
                "MERGE" -> if (next == "INTO") listOfNotNull(name(tokens, index + 2, only)) else emptyList()
                "TRUNCATE" -> SqlNames.readList(tokens, skip(tokens, index + 1, setOf("TABLE", "ONLY")))
                "INSERT" -> upsertTarget(tokens, index)
                else -> emptyList()
            }
        return targets
            .filter { catalogue.isFact(it) }
            .map { Violation(MigrationRule.FACT_TABLE_ROWS_CHANGED, "${tokens[index].keyword} $it") }
    }

    /** `INSERT INTO t ... DO UPDATE` up to the end of the statement. */
    private fun upsertTarget(
        tokens: List<SqlToken>,
        index: Int,
    ): List<SqlName> {
        val target = if (keyword(tokens, index + 1) == "INTO") name(tokens, index + 2, emptySet()) else null
        val end = statementEnd(tokens, index)
        val doUpdate = (index until end - 1).any { tokens[it].keyword == "DO" && tokens[it + 1].keyword == "UPDATE" }
        return if (doUpdate) listOfNotNull(target) else emptyList()
    }

    private fun bodyStatementAt(
        tokens: List<SqlToken>,
        index: Int,
    ): List<Violation> {
        val word = tokens[index].keyword
        val next = keyword(tokens, index + 1)
        val end = statementEnd(tokens, index)
        val cascade = word == "TRUNCATE" && (index until end).any { tokens[it].keyword == "CASCADE" }
        val tables =
            when {
                word == "ALTER" && next == "TABLE" -> listOfNotNull(name(tokens, index + 2, SqlStatement.IF_EXISTS + "ONLY"))
                word == "DROP" && next == "TABLE" -> SqlNames.readList(tokens, skip(tokens, index + 2, SqlStatement.IF_EXISTS))
                word == "DROP" && next == "TRIGGER" -> triggerTable(tokens, index, end)
                else -> emptyList()
            }
        return listOfNotNull(
            Violation(MigrationRule.FORBIDDEN_STATEMENT, "EXECUTE (dynamic SQL) in a function body").takeIf { word == "EXECUTE" },
            Violation(MigrationRule.FORBIDDEN_STATEMENT, "TRUNCATE ... CASCADE").takeIf { cascade },
        ) +
            tables
                .filter { catalogue.isFact(it) }
                .map { Violation(MigrationRule.FACT_TABLE_PROTECTION_CHANGED, "$word $next $it in a function body") }
    }

    private fun triggerTable(
        tokens: List<SqlToken>,
        index: Int,
        end: Int,
    ): List<SqlName> {
        val on = (index until end).firstOrNull { tokens[it].keyword == "ON" }
        return listOfNotNull(on?.let { name(tokens, it + 1, only) })
    }

    private fun keyword(
        tokens: List<SqlToken>,
        index: Int,
    ): String = tokens.getOrNull(index)?.keyword.orEmpty()

    private fun skip(
        tokens: List<SqlToken>,
        index: Int,
        optional: Set<String>,
    ): Int {
        var i = index
        while (i < tokens.size && tokens[i].keyword in optional) i++
        return i
    }

    private fun name(
        tokens: List<SqlToken>,
        index: Int,
        optional: Set<String>,
    ): SqlName? = SqlNames.read(tokens, skip(tokens, index, optional))?.name

    /** The index of the next `;` after [index], or the end of [tokens]. */
    private fun statementEnd(
        tokens: List<SqlToken>,
        index: Int,
    ): Int = (index until tokens.size).firstOrNull { tokens[it].isSymbol(";") } ?: tokens.size
}
