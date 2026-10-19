package hms.kernel.archrules.migration

/**
 * Grants that would let a role change a fact table (platform-journal.md §9.3: `GRANT` of `UPDATE`, `DELETE`,
 * `TRUNCATE` or `TRIGGER` on it). Tightened, fail closed: `ALL [PRIVILEGES]` counts as all of them, and a grant
 * on `ALL TABLES IN SCHEMA` or through `ALTER DEFAULT PRIVILEGES ... ON TABLES` is refused whatever the schema,
 * because the linter cannot prove the fact tables are outside it.
 */
internal object GrantChecks {
    private val refused = setOf("UPDATE", "DELETE", "TRUNCATE", "TRIGGER", "ALL")

    /** Object types a GRANT can name other than tables. */
    private val notTables =
        setOf(
            "SEQUENCE",
            "SCHEMA",
            "FUNCTION",
            "PROCEDURE",
            "ROUTINE",
            "DATABASE",
            "DOMAIN",
            "TYPE",
            "LANGUAGE",
            "LARGE",
            "FOREIGN",
            "TABLESPACE",
            "PARAMETER",
        )

    /** The violations of a GRANT or ALTER DEFAULT PRIVILEGES statement; none for any other statement. */
    fun check(
        statement: SqlStatement,
        catalogue: FactTableCatalogue,
    ): List<Violation> {
        val grant =
            when {
                statement.verb == "GRANT" -> 0
                statement.verb == "ALTER" && statement.objectType == "DEFAULT" -> statement.indexOf("GRANT")
                else -> -1
            }
        val on = if (grant < 0) -1 else statement.indexOf("ON", grant + 1)
        val privileges = if (on < 0) emptySet() else statement.tokens.subList(grant + 1, on).map { it.keyword }.toSet()
        val dangerous = privileges.intersect(refused)
        val target = if (dangerous.isEmpty()) null else targetOf(statement, on + 1, catalogue)
        return listOfNotNull(target?.let { Violation(MigrationRule.FACT_TABLE_PROTECTION_CHANGED, "GRANT ${dangerous.sorted()} ON $it") })
    }

    /** What the grant at [index] names, when it may include a fact table; null otherwise. */
    private fun targetOf(
        statement: SqlStatement,
        index: Int,
        catalogue: FactTableCatalogue,
    ): String? {
        val first = statement.keywordAt(index)
        val all = first == "ALL" || first == "TABLES"
        val tables = statement.keywordAt(index + 1) == "TABLES" || first == "TABLES"
        return when {
            all && tables -> "all tables (a fact table may be among them)"
            all || first in notTables -> null
            else -> {
                val to = statement.indexOf("TO", index).let { if (it < 0) statement.tokens.size else it }
                val names = SqlNames.readList(statement.tokens.subList(0, to), statement.skip(index, setOf("TABLE")))
                names.filter { catalogue.isFact(it) }.joinToString(", ").ifEmpty { null }
            }
        }
    }
}
