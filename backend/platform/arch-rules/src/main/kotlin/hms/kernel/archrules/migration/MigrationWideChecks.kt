package hms.kernel.archrules.migration

/**
 * The statements refused in every migration (platform-journal.md §9.3): `DROP SCHEMA`, `DROP OWNED`,
 * `REASSIGN OWNED`, `TRUNCATE ... CASCADE`, `SET session_replication_role` (in any form, including
 * `set_config`), `CREATE|ALTER ROLE` (or `USER`, `GROUP`) with `SUPERUSER` or `BYPASSRLS`, and `DO` blocks.
 * Tightened: `DROP ... CASCADE` of any object, because a cascade can drop a fact table's column, trigger or
 * function without naming it, and `SELECT ... INTO`, which creates a table that no marker classifies.
 *
 * It also decides whether the linter knows a statement at all: an unknown statement kind fails the build
 * rather than pass unread (fails closed).
 */
internal object MigrationWideChecks {
    private val simpleVerbs =
        setOf(
            "INSERT",
            "UPDATE",
            "DELETE",
            "TRUNCATE",
            "MERGE",
            "SELECT",
            "WITH",
            "DO",
            "SET",
            "RESET",
            "GRANT",
            "REVOKE",
            "COMMENT",
            "ANALYZE",
            "REFRESH",
            "REASSIGN",
        )
    private val objectVerbs = setOf("CREATE", "ALTER", "DROP")
    private val objectTypes =
        setOf(
            "TABLE",
            "INDEX",
            "SCHEMA",
            "FUNCTION",
            "PROCEDURE",
            "ROUTINE",
            "TRIGGER",
            "RULE",
            "POLICY",
            "EXTENSION",
            "TYPE",
            "DOMAIN",
            "SEQUENCE",
            "VIEW",
            "ROLE",
            "USER",
            "GROUP",
            "OWNED",
            "DEFAULT",
            "PUBLICATION",
            "STATISTICS",
            "AGGREGATE",
            "CAST",
            "COLLATION",
        )
    private val roleTypes = setOf("ROLE", "USER", "GROUP")
    private const val REPLICATION_ROLE = "session_replication_role"

    /** True when the linter knows the kind of [statement]. */
    fun recognised(statement: SqlStatement): Boolean =
        statement.verb in simpleVerbs || (statement.verb in objectVerbs && statement.objectType in objectTypes)

    /** The violations of [statement] that apply in every migration. */
    fun check(statement: SqlStatement): List<Violation> {
        val verb = statement.verb
        val type = statement.objectType
        val refused =
            listOf(
                "DO block" to (verb == "DO"),
                "DROP SCHEMA" to (verb == "DROP" && type == "SCHEMA"),
                "DROP OWNED" to (verb == "DROP" && type == "OWNED"),
                "REASSIGN OWNED" to (verb == "REASSIGN"),
                "DROP ... CASCADE" to (verb == "DROP" && statement.has("CASCADE")),
                "TRUNCATE ... CASCADE" to (verb == "TRUNCATE" && statement.has("CASCADE")),
                REPLICATION_ROLE to touchesReplicationRole(statement),
                "role with SUPERUSER or BYPASSRLS" to (verb in objectVerbs && type in roleTypes && privilegedRole(statement)),
            )
        val selectInto = verb == "SELECT" && selectsInto(statement)
        return refused.filter { it.second }.map { Violation(MigrationRule.FORBIDDEN_STATEMENT, it.first) } +
            listOfNotNull(
                Violation(MigrationRule.UNCLASSIFIED_TABLE, "SELECT ... INTO creates an unclassified table").takeIf { selectInto },
            )
    }

    private fun touchesReplicationRole(statement: SqlStatement): Boolean =
        statement.tokens.any { it.text.lowercase().contains(REPLICATION_ROLE) }

    private fun privilegedRole(statement: SqlStatement): Boolean = statement.has("SUPERUSER") || statement.has("BYPASSRLS")

    /** `SELECT ... INTO t` at the top level of the statement (not inside parentheses). */
    private fun selectsInto(statement: SqlStatement): Boolean {
        var depth = 0
        return statement.tokens.any { token ->
            depth += SqlNames.depthChange(token)
            depth == 0 && token.keyword == "INTO"
        }
    }
}
