package hms.kernel.archrules.migration

import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.extension
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile
import kotlin.io.path.readText

/**
 * The fact-table migration linter, `StaticAnalysis:no-update-or-delete-on-fact-tables` (BUILD-PROMPT §6.8 #2;
 * platform-journal.md §9.3 item 3; CTRL-0006-3; D7). Pure Kotlin: it reads SQL text and never connects to a
 * database.
 *
 * Every project with migrations runs it over its own `db/migration` tree in its fast tier. It fails closed:
 * - every `CREATE TABLE` carries exactly one marker in the same file: `-- hms:fact-table <table>`,
 *   `-- hms:aggregate-table <table>` or `-- hms:read-model <table>`; a malformed or stray marker fails;
 * - a migration that marks a fact table creates its BEFORE UPDATE, DELETE and TRUNCATE refuse-change triggers;
 * - the statements of [FactTableChecks], [DataChangeScan] and [MigrationWideChecks] are refused;
 * - a statement it cannot lex or does not recognise fails the build.
 *
 * Fact tables are matched on their last name part, so neither a schema nor a placeholder can hide one; two
 * tables with the same name in one tree are treated alike, which can only fail more often.
 */
object FactTableMigrationLinter {
    private val markerLine = Regex("""^\s*--\s*hms:(\S*)\s*(.*?)\s*$""")

    /** Lints [scripts] as one migration tree, in Flyway order. */
    fun lint(scripts: List<MigrationScript>): MigrationLintReport {
        val findings = mutableListOf<MigrationFinding>()
        val parsed = FlywayOrder.sort(scripts).mapIndexed { index, script -> parse(index, script, findings) }
        val catalogue = FactTableCatalogue(parsed)
        findings += catalogue.findings
        val factChecks = FactTableChecks(catalogue)
        val scan = DataChangeScan(catalogue)
        for (script in parsed) {
            for (statement in script.statements) {
                val violations =
                    unrecognised(statement) +
                        MigrationWideChecks.check(statement) +
                        factChecks.check(statement, script) +
                        scan.scan(statement.tokens)
                findings += violations.map { MigrationFinding(script.name, statement.line, it.rule, it.detail) }
                findings += bodyFindings(script, statement, scan)
            }
        }
        return MigrationLintReport(parsed.map { it.name }, findings.sortedWith(compareBy({ it.script }, { it.line })))
    }

    /**
     * Lints every `.sql` file below [directory]. Fails with [IllegalArgumentException] when the directory does not
     * exist, so a wrong path can never pass as "no migrations".
     */
    fun lintDirectory(directory: Path): MigrationLintReport {
        require(directory.isDirectory()) { "migration directory $directory does not exist" }
        val files = Files.walk(directory).use { paths -> paths.filter { it.isRegularFile() && it.extension == "sql" }.toList() }
        return lint(files.map { MigrationScript(directory.relativize(it).toString().replace('\\', '/'), it.readText()) })
    }

    private fun parse(
        index: Int,
        script: MigrationScript,
        findings: MutableList<MigrationFinding>,
    ): ParsedScript {
        val markers = markers(script, findings)
        val statements =
            when (val lexed = SqlLexer.tokenize(script.sql)) {
                is LexResult.Failed -> {
                    findings += MigrationFinding(script.name, lexed.line, MigrationRule.UNPARSEABLE_STATEMENT, lexed.reason)
                    emptyList()
                }
                is LexResult.Tokens -> SqlStatement.split(lexed.tokens)
            }
        val (balanced, unbalanced) = statements.partition { it.balanced() }
        unbalanced.forEach {
            findings += MigrationFinding(script.name, it.line, MigrationRule.UNPARSEABLE_STATEMENT, "unbalanced parentheses")
        }
        return ParsedScript(index, script.name, balanced, markers)
    }

    private fun markers(
        script: MigrationScript,
        findings: MutableList<MigrationFinding>,
    ): List<TableMarker> =
        script.sql.lines().withIndex().mapNotNull { (index, text) ->
            markerLine.matchEntire(text)?.let { match ->
                val (kind, table) = match.destructured
                val name = (SqlLexer.tokenize(table) as? LexResult.Tokens)?.tokens?.let { tokens -> wholeName(tokens) }
                if (kind !in FactTableCatalogue.CLASSES || name == null) {
                    findings += MigrationFinding(script.name, index + 1, MigrationRule.INVALID_MARKER, text.trim())
                }
                name?.takeIf { kind in FactTableCatalogue.CLASSES }?.let { TableMarker(kind, it, index + 1) }
            }
        }

    private fun wholeName(tokens: List<SqlToken>): SqlName? = SqlNames.read(tokens, 0)?.takeIf { it.next == tokens.size }?.name

    private fun unrecognised(statement: SqlStatement): List<Violation> =
        if (MigrationWideChecks.recognised(statement)) {
            emptyList()
        } else {
            listOf(Violation(MigrationRule.UNRECOGNISED_STATEMENT, statement.tokens.take(HEAD_TOKENS).joinToString(" ")))
        }

    /** Lexes and scans the bodies of CREATE FUNCTION and CREATE PROCEDURE statements. */
    private fun bodyFindings(
        script: ParsedScript,
        statement: SqlStatement,
        scan: DataChangeScan,
    ): List<MigrationFinding> {
        val routine = statement.verb == "CREATE" && statement.objectType in ROUTINES
        val bodies = if (routine) bodies(statement) else emptyList()
        return bodies.flatMap { body ->
            when (val lexed = SqlLexer.tokenize(body.text)) {
                is LexResult.Failed ->
                    listOf(MigrationFinding(script.name, body.line + lexed.line - 1, MigrationRule.UNPARSEABLE_STATEMENT, lexed.reason))
                is LexResult.Tokens ->
                    scan.scanBody(lexed.tokens).map { MigrationFinding(script.name, body.line, it.rule, it.detail) }
            }
        }
    }

    /** The dollar-quoted strings of a routine, and a string constant right after AS: its body. */
    private fun bodies(statement: SqlStatement): List<SqlToken> =
        statement.tokens.filterIndexed { index, token ->
            token.kind == TokenKind.DOLLAR_STRING || (token.kind == TokenKind.STRING && statement.keywordAt(index - 1) == "AS")
        }

    private const val HEAD_TOKENS = 4
    private val ROUTINES = setOf("FUNCTION", "PROCEDURE")
}
