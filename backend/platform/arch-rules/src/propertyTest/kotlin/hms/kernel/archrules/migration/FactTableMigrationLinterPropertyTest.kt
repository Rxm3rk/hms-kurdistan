package hms.kernel.archrules.migration

import hms.kernel.testing.PropertyTestBudget
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import kotlin.random.Random

/**
 * `StaticAnalysis:no-update-or-delete-on-fact-tables` does not depend on layout: keyword case, whitespace, line
 * breaks and comments between tokens never turn a refused statement into an accepted one, nor a clean migration into a
 * failing one (platform-journal.md §9.3). Synthetic SQL only.
 */
class FactTableMigrationLinterPropertyTest :
    FunSpec({
        val clean =
            """
            -- hms:fact-table audit.events
            CREATE TABLE audit.events (id uuid NOT NULL, note text, CONSTRAINT events_pk PRIMARY KEY (id));
            CREATE FUNCTION audit.refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'no'; END $$;
            CREATE TRIGGER events_no_change BEFORE UPDATE OR DELETE ON audit.events FOR EACH ROW EXECUTE FUNCTION audit.refuse();
            CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON audit.events FOR EACH STATEMENT EXECUTE FUNCTION audit.refuse();
            GRANT INSERT, SELECT ON audit.events TO app;
            ALTER TABLE audit.events ADD COLUMN extra text;
            """.trimIndent()
        val plants =
            listOf(
                "UPDATE audit.events SET note = 'x';" to MigrationRule.FACT_TABLE_ROWS_CHANGED,
                "DELETE FROM ONLY audit.events WHERE id IS NULL;" to MigrationRule.FACT_TABLE_ROWS_CHANGED,
                "TRUNCATE TABLE audit.events;" to MigrationRule.FACT_TABLE_ROWS_CHANGED,
                "WITH gone AS (DELETE FROM audit.events RETURNING id) SELECT count(*) FROM gone;" to MigrationRule.FACT_TABLE_ROWS_CHANGED,
                "ALTER TABLE audit.events DISABLE TRIGGER ALL;" to MigrationRule.FACT_TABLE_PROTECTION_CHANGED,
                "GRANT DELETE ON audit.events TO app;" to MigrationRule.FACT_TABLE_PROTECTION_CHANGED,
                "DROP TABLE audit.events;" to MigrationRule.FACT_TABLE_PROTECTION_CHANGED,
                "DO $$ BEGIN PERFORM 1; END $$;" to MigrationRule.FORBIDDEN_STATEMENT,
            )

        test("no-update-or-delete-on-fact-tables: a clean migration passes in any layout") {
            checkAll(PropertyTestBudget.sequences(), Arb.long()) { seed ->
                val report = FactTableMigrationLinter.lint(listOf(MigrationScript("V1__create.sql", relayout(clean, Random(seed)))))
                withClue(report.toString()) { report.passed shouldBe true }
            }
        }

        test("no-update-or-delete-on-fact-tables: a planted statement is refused in any layout") {
            checkAll(PropertyTestBudget.sequences(), Arb.long(), Arb.element(plants)) { seed, (plant, rule) ->
                val random = Random(seed)
                val scripts =
                    listOf(
                        MigrationScript("V1__create.sql", relayout(clean, random)),
                        MigrationScript("V2__plant.sql", relayout(plant, random)),
                    )
                val report = FactTableMigrationLinter.lint(scripts)
                withClue(report.toString()) { report.findings.any { it.rule == rule } shouldBe true }
            }
        }
    })

private val separators = listOf(" ", "  ", "\t", "\n", " /* note */ ", "\n-- note\n", "\r\n")

/** Re-cases letters at random and replaces each space by random whitespace or a comment; marker lines stay as written. */
private fun relayout(
    sql: String,
    random: Random,
): String =
    sql.lines().joinToString("\n") { line ->
        if (line.trimStart().startsWith("--")) {
            line
        } else {
            line
                .map { c ->
                    when {
                        c == ' ' -> separators[random.nextInt(separators.size)]
                        c.isLetter() && random.nextBoolean() -> c.uppercaseChar().toString()
                        c.isLetter() -> c.lowercaseChar().toString()
                        else -> c.toString()
                    }
                }.joinToString("")
        }
    }
