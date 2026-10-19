package hms.kernel.archrules.migration

/** One Flyway migration script: its file name (for ordering and reports) and its SQL. */
class MigrationScript(
    val name: String,
    val sql: String,
) {
    override fun toString(): String = name
}

/** What a [MigrationFinding] breaks (platform-journal.md §9.3, `StaticAnalysis:no-update-or-delete-on-fact-tables`). */
enum class MigrationRule(
    val summary: String,
) {
    /** The linter cannot read the statement: an unterminated string or comment, or unbalanced parentheses. */
    UNPARSEABLE_STATEMENT("the linter cannot parse this statement"),

    /** A statement kind the linter does not know; it fails closed rather than guess. */
    UNRECOGNISED_STATEMENT("statement kind not recognised by the linter"),

    /** A `-- hms:` comment that is not `-- hms:<fact-table|aggregate-table|read-model> <table>`. */
    INVALID_MARKER("malformed table classification marker"),

    /** A created table without exactly one marker in the same file. */
    UNCLASSIFIED_TABLE("table is not classified in the migration that creates it"),

    /** A marker that names no table created in the same file, or a table with two markers. */
    MISPLACED_MARKER("classification marker does not match one table created in this file"),

    /** A fact table whose creating migration does not also create its refuse-change triggers. */
    MISSING_REFUSE_CHANGE_TRIGGERS("fact table created without BEFORE UPDATE, DELETE and TRUNCATE refuse-change triggers"),

    /** UPDATE, DELETE, TRUNCATE, MERGE or an upsert on a fact table, at top level, in a CTE, a rule or a function body. */
    FACT_TABLE_ROWS_CHANGED("rows of a fact table are updated, deleted or truncated"),

    /** A schema, trigger, rule, policy, ownership or grant change that could open a fact table to change. */
    FACT_TABLE_PROTECTION_CHANGED("a fact table's structure or protection is changed"),

    /** CREATE OR REPLACE, ALTER or DROP of a fact table's trigger function after the migration that creates it. */
    TRIGGER_FUNCTION_CHANGED("a fact table's refuse-change trigger function is changed"),

    /** A statement refused in every migration (DROP SCHEMA, DO, dynamic EXECUTE, superuser roles and the like). */
    FORBIDDEN_STATEMENT("statement refused in every migration"),
}

/** One finding: the script, the line where the statement starts, the rule it breaks and what was found. */
class MigrationFinding(
    val script: String,
    val line: Int,
    val rule: MigrationRule,
    val detail: String,
) {
    override fun toString(): String = "$script:$line ${rule.name}: ${rule.summary} ($detail)"
}

/** The result of linting a migration tree. It passes only when there is no finding. */
class MigrationLintReport(
    val scripts: List<String>,
    val findings: List<MigrationFinding>,
) {
    /** True when no finding was made. */
    val passed: Boolean get() = findings.isEmpty()

    /** Throws [IllegalStateException] listing every finding unless the report passed. */
    fun requirePassed() {
        check(passed) {
            "fact-table migration linter (StaticAnalysis:no-update-or-delete-on-fact-tables) failed:\n" +
                findings.joinToString("\n")
        }
    }

    override fun toString(): String = if (passed) "${scripts.size} migrations, no finding" else findings.joinToString("\n")
}
