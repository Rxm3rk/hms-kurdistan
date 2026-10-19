package hms.kernel.archrules.migration

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** `StaticAnalysis:no-update-or-delete-on-fact-tables`: the fact-table migration linter (platform-journal.md §9.3; CTRL-0006-3). */
class FactTableMigrationLinterTest {
    @Test
    fun `no-update-or-delete-on-fact-tables passes on the clean tree read from its directory`() {
        val report = FactTableMigrationLinter.lintDirectory(MigrationFixtures.cleanDirectory)
        assertTrue(report.passed, report.toString())
        assertEquals(MigrationFixtures.clean.size, report.scripts.size)
        report.requirePassed()
    }

    @TestFactory
    fun `no-update-or-delete-on-fact-tables fails on a planted fixture for every statement kind`(): List<DynamicTest> =
        MigrationFixtures.plants.map { plant ->
            dynamicTest(plant.name) {
                val report = FactTableMigrationLinter.lint(plant.tree())
                assertFalse(report.passed, "the plant passed: ${plant.sql}")
                assertTrue(report.findings.any { it.rule == plant.rule }, "expected ${plant.rule}, got:\n$report")
                assertThrows(IllegalStateException::class.java) { report.requirePassed() }
            }
        }

    @Test
    fun `no-update-or-delete-on-fact-tables reports the script and line of a finding`() {
        val plant = MigrationScript("V0004__plant.sql", "SELECT 1;\n\nUPDATE \${journalSchema}.entry\n  SET reason = 'x';")
        val finding = FactTableMigrationLinter.lint(MigrationFixtures.clean + plant).findings.single()
        assertEquals("V0004__plant.sql", finding.script)
        assertEquals(3, finding.line)
        assertEquals(MigrationRule.FACT_TABLE_ROWS_CHANGED, finding.rule)
    }

    @Test
    fun `no-update-or-delete-on-fact-tables orders migrations by Flyway version, not by name`() {
        val create = MigrationFixtures.clean.first()
        val replace =
            "CREATE OR REPLACE FUNCTION \${journalSchema}.refuse_change() RETURNS trigger LANGUAGE plpgsql " +
                "AS \$\$ BEGIN RETURN NULL; END \$\$;"
        val scripts = listOf(MigrationScript("V10__replace.sql", replace), MigrationScript("V2__create.sql", create.sql))
        val report = FactTableMigrationLinter.lint(scripts)
        assertTrue(report.findings.any { it.rule == MigrationRule.TRIGGER_FUNCTION_CHANGED }, report.toString())
        val names = listOf("notes.sql", "R__c.sql", "V10__b.sql", "V2__a.sql", "V1_2__e.sql", "V1.1__d.sql", "db/V3__f.sql")
        assertEquals(
            listOf("V1.1__d.sql", "V1_2__e.sql", "V2__a.sql", "db/V3__f.sql", "V10__b.sql", "R__c.sql", "notes.sql"),
            FlywayOrder.sort(names.map { MigrationScript(it, "") }).map { it.name },
        )
    }

    @Test
    fun `no-update-or-delete-on-fact-tables allows replacing the trigger function in the migration that creates it`() {
        val create = MigrationFixtures.clean.first()
        val sql =
            create.sql + "\nCREATE OR REPLACE FUNCTION \${journalSchema}.refuse_change() RETURNS trigger LANGUAGE plpgsql AS \$\$\n" +
                "BEGIN RAISE EXCEPTION 'never'; END \$\$;\n"
        val report = FactTableMigrationLinter.lint(listOf(MigrationScript(create.name, sql)))
        assertTrue(report.passed, report.toString())
    }

    @Test
    fun `no-update-or-delete-on-fact-tables fails closed on a missing directory`() {
        assertThrows(IllegalArgumentException::class.java) {
            FactTableMigrationLinter.lintDirectory(MigrationFixtures.cleanDirectory.resolve("missing"))
        }
    }

    @Test
    fun `no-update-or-delete-on-fact-tables finds nothing in an empty tree`() {
        assertTrue(FactTableMigrationLinter.lint(emptyList()).passed)
    }
}
