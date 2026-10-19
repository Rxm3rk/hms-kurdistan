package hms.kernel.archrules.migration

import java.nio.file.Path
import kotlin.io.path.readText

/** The SQL fixtures of the fact-table migration linter (platform-journal.md §9.3; synthetic only). */
object MigrationFixtures {
    /** The clean tree: the journal migration sketched in platform-journal.md §9.1, a read model, an extension. */
    val cleanDirectory: Path by lazy {
        Path.of(checkNotNull(MigrationFixtures::class.java.getResource("/migrations/clean")) { "clean fixtures missing" }.toURI())
    }

    /** The clean tree as scripts. */
    val clean: List<MigrationScript> by lazy {
        listOf(
            "V0001__create_journal_entry.sql",
            "V0002__create_entry_by_patient.sql",
            "V0003__extend_entry.sql",
            "R__reader_grants.sql",
        ).map { MigrationScript(it, cleanDirectory.resolve(it).readText()) }
    }

    /** A planted violation: a migration added after the clean tree, and the rule it must break. */
    class Plant(
        val name: String,
        val sql: String,
        val rule: MigrationRule,
    ) {
        /** The clean tree plus this plant as `V0004__plant.sql`. */
        fun tree(): List<MigrationScript> = clean + MigrationScript("V0004__plant.sql", sql)

        override fun toString(): String = name
    }

    private const val E = "\${journalSchema}.entry"
    private const val S = "\${journalSchema}"
    private const val APP = "\${appRole}"

    private fun rows(
        name: String,
        sql: String,
    ) = Plant(name, sql, MigrationRule.FACT_TABLE_ROWS_CHANGED)

    private fun protection(
        name: String,
        sql: String,
    ) = Plant(name, sql, MigrationRule.FACT_TABLE_PROTECTION_CHANGED)

    private fun forbidden(
        name: String,
        sql: String,
    ) = Plant(name, sql, MigrationRule.FORBIDDEN_STATEMENT)

    /** One plant per statement kind of platform-journal.md §9.3 item 3, plus the tightenings. */
    val plants: List<Plant> =
        listOf(
            // Row changes on a fact table, anywhere.
            rows("UPDATE", "UPDATE $E SET reason = 'x' WHERE id IS NULL;"),
            rows("UPDATE ONLY, mixed case, quoted", "update ONLY \"entry\" set reason = 'x';"),
            rows("DELETE with a literal schema", "DELETE FROM journal.entry WHERE id IS NULL;"),
            rows("TRUNCATE", "TRUNCATE TABLE $E;"),
            rows("TRUNCATE in a list", "TRUNCATE $S.entry_by_patient, $E;"),
            rows("MERGE", "MERGE INTO $E e USING $S.entry_by_patient p ON e.id = p.last_entry WHEN MATCHED THEN DELETE;"),
            rows("INSERT ON CONFLICT DO UPDATE", "INSERT INTO $E (id) VALUES ('x') ON CONFLICT (id) DO UPDATE SET reason = 'y';"),
            rows("data-modifying CTE", "WITH gone AS (DELETE FROM $E RETURNING id) SELECT count(*) FROM gone;"),
            rows(
                "function body that deletes",
                "CREATE FUNCTION $S.purge() RETURNS void LANGUAGE plpgsql AS \$body\$ BEGIN DELETE FROM $E; END \$body\$;",
            ),
            rows(
                "single-quoted function body that updates",
                "CREATE FUNCTION $S.fix() RETURNS void LANGUAGE sql AS 'UPDATE $E SET reason = ''x''';",
            ),
            // Structure and protection of a fact table.
            protection("DROP TABLE", "DROP TABLE $E;"),
            protection("DROP TABLE in a list", "DROP TABLE IF EXISTS $S.entry_by_patient, $E;"),
            protection("ALTER TABLE RENAME", "ALTER TABLE $E RENAME TO entry_old;"),
            protection("ALTER TABLE RENAME COLUMN", "ALTER TABLE $E RENAME COLUMN reason TO why;"),
            protection("DROP COLUMN", "ALTER TABLE $E DROP COLUMN reason;"),
            protection("DROP without COLUMN", "ALTER TABLE $E DROP reason;"),
            protection("DROP COLUMN as a second action", "ALTER TABLE $E ADD COLUMN extra text, DROP COLUMN reason;"),
            protection("ALTER COLUMN TYPE", "ALTER TABLE $E ALTER COLUMN reason TYPE varchar(10);"),
            protection("ALTER SET DATA TYPE", "ALTER TABLE $E ALTER reason SET DATA TYPE varchar(10);"),
            protection("SET EXPRESSION", "ALTER TABLE $E ALTER COLUMN event_stream SET EXPRESSION AS ('platform');"),
            protection("OWNER TO", "ALTER TABLE $E OWNER TO $APP;"),
            protection("SET UNLOGGED", "ALTER TABLE $E SET UNLOGGED;"),
            protection("SET SCHEMA", "ALTER TABLE $E SET SCHEMA archive;"),
            protection("INHERIT", "ALTER TABLE $E INHERIT archive.parent;"),
            protection("DISABLE TRIGGER", "ALTER TABLE $E DISABLE TRIGGER entry_no_update_delete;"),
            protection("DISABLE TRIGGER ALL", "ALTER TABLE IF EXISTS ONLY $E DISABLE TRIGGER ALL;"),
            protection("ENABLE REPLICA TRIGGER", "ALTER TABLE $E ENABLE REPLICA TRIGGER entry_no_update_delete;"),
            protection("ENABLE ALWAYS TRIGGER", "ALTER TABLE $E ENABLE ALWAYS TRIGGER entry_no_update_delete;"),
            protection("ATTACH PARTITION", "ALTER TABLE $E ATTACH PARTITION archive.part FOR VALUES IN (1);"),
            protection("DETACH PARTITION", "ALTER TABLE $E DETACH PARTITION archive.part;"),
            protection("attach the fact table as a partition", "ALTER TABLE archive.parent ATTACH PARTITION $E FOR VALUES IN (1);"),
            protection("NO FORCE ROW LEVEL SECURITY", "ALTER TABLE $E NO FORCE ROW LEVEL SECURITY;"),
            protection("DISABLE ROW LEVEL SECURITY", "ALTER TABLE $E DISABLE ROW LEVEL SECURITY;"),
            protection(
                "foreign key that cascades deletes",
                "ALTER TABLE $E ADD CONSTRAINT entry_patient_fk FOREIGN KEY (patient_id) REFERENCES $S.patients (id) ON DELETE CASCADE;",
            ),
            protection("DROP TRIGGER", "DROP TRIGGER entry_no_update_delete ON $E;"),
            protection("ALTER TRIGGER", "ALTER TRIGGER entry_no_truncate ON $E RENAME TO entry_quiet;"),
            protection(
                "further CREATE TRIGGER (BEFORE INSERT drops rows)",
                "CREATE TRIGGER entry_drop_rows BEFORE INSERT ON $E FOR EACH ROW EXECUTE FUNCTION $S.drop_row();",
            ),
            protection(
                "further refuse-change trigger outside the creating migration",
                "CREATE OR REPLACE TRIGGER entry_no_update_delete BEFORE UPDATE OR DELETE ON $E FOR EACH ROW EXECUTE FUNCTION $S.other();",
            ),
            protection("CREATE RULE", "CREATE RULE entry_no_delete AS ON DELETE TO $E DO INSTEAD NOTHING;"),
            protection("DROP POLICY", "DROP POLICY entry_tenant ON $E;"),
            protection("ALTER POLICY", "ALTER POLICY entry_tenant ON $E USING (true);"),
            protection("GRANT UPDATE", "GRANT UPDATE ON $E TO $APP;"),
            protection("GRANT DELETE ON TABLE", "GRANT DELETE ON TABLE $E TO $APP;"),
            protection("GRANT TRUNCATE", "GRANT TRUNCATE ON $E TO $APP;"),
            protection("GRANT TRIGGER", "GRANT TRIGGER ON $E TO $APP;"),
            protection("GRANT ALL PRIVILEGES", "GRANT ALL PRIVILEGES ON $E TO $APP;"),
            protection("GRANT UPDATE on a column", "GRANT UPDATE (reason) ON $E TO $APP;"),
            protection("GRANT on all tables in the schema", "GRANT UPDATE ON ALL TABLES IN SCHEMA $S TO $APP;"),
            protection("default privileges", "ALTER DEFAULT PRIVILEGES IN SCHEMA $S GRANT DELETE ON TABLES TO $APP;"),
            protection("rename the schema", "ALTER SCHEMA $S RENAME TO journal_old;"),
            protection(
                "partition of the fact table",
                "-- hms:read-model $S.entry_part\nCREATE TABLE $S.entry_part PARTITION OF $E FOR VALUES IN (1);",
            ),
            protection(
                "function body that disables the triggers",
                "CREATE FUNCTION $S.quiet() RETURNS void LANGUAGE plpgsql AS \$\$ BEGIN ALTER TABLE $E DISABLE TRIGGER ALL; END \$\$;",
            ),
            // The trigger function after the migration that creates it.
            Plant(
                "CREATE OR REPLACE the trigger function",
                "CREATE OR REPLACE FUNCTION $S.refuse_change() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN RETURN NEW; END \$\$;",
                MigrationRule.TRIGGER_FUNCTION_CHANGED,
            ),
            Plant("ALTER FUNCTION", "ALTER FUNCTION $S.refuse_change() OWNER TO $APP;", MigrationRule.TRIGGER_FUNCTION_CHANGED),
            Plant("DROP FUNCTION", "DROP FUNCTION $S.refuse_change();", MigrationRule.TRIGGER_FUNCTION_CHANGED),
            Plant(
                "DROP FUNCTION CASCADE in a list",
                "DROP FUNCTION IF EXISTS $S.other(int), $S.refuse_change() CASCADE;",
                MigrationRule.TRIGGER_FUNCTION_CHANGED,
            ),
            // Refused in every migration.
            forbidden("DROP SCHEMA", "DROP SCHEMA $S;"),
            forbidden("DROP OWNED", "DROP OWNED BY $APP;"),
            forbidden("REASSIGN OWNED", "REASSIGN OWNED BY \${ownerRole} TO $APP;"),
            forbidden("TRUNCATE CASCADE of any table", "TRUNCATE $S.entry_by_patient CASCADE;"),
            forbidden("SET session_replication_role", "SET session_replication_role = replica;"),
            forbidden("set_config session_replication_role", "SELECT set_config('session_replication_role', 'replica', false);"),
            forbidden("CREATE ROLE SUPERUSER", "CREATE ROLE breakglass WITH LOGIN SUPERUSER;"),
            forbidden("ALTER ROLE BYPASSRLS", "ALTER ROLE $APP BYPASSRLS;"),
            forbidden("DO block", "DO \$\$ BEGIN PERFORM 1; END \$\$;"),
            forbidden(
                "EXECUTE in a function body",
                "CREATE FUNCTION $S.dynamic() RETURNS void LANGUAGE plpgsql AS \$\$ BEGIN EXECUTE 'SELECT 1'; END \$\$;",
            ),
            forbidden("DROP CASCADE (tightening)", "DROP TYPE $S.entry_kind CASCADE;"),
            // Classification.
            Plant("unclassified table", "CREATE TABLE $S.notes (id uuid);", MigrationRule.UNCLASSIFIED_TABLE),
            Plant("SELECT INTO", "SELECT * INTO $S.entry_copy FROM $S.entry_by_patient;", MigrationRule.UNCLASSIFIED_TABLE),
            Plant("stray marker", "-- hms:read-model $S.ghost\nCREATE INDEX ghost_idx ON $E (id);", MigrationRule.MISPLACED_MARKER),
            Plant(
                "two markers for one table",
                "-- hms:read-model $S.twice\n-- hms:aggregate-table $S.twice\nCREATE TABLE $S.twice (id uuid);",
                MigrationRule.MISPLACED_MARKER,
            ),
            Plant("misspelt marker", "-- hms:fact-tabel $S.notes\nCREATE TABLE $S.notes (id uuid);", MigrationRule.INVALID_MARKER),
            Plant("marker without a table", "-- hms:read-model\nCREATE TABLE $S.notes (id uuid);", MigrationRule.INVALID_MARKER),
            Plant(
                "fact table without refuse-change triggers",
                "-- hms:fact-table audit.events\nCREATE TABLE audit.events (id uuid);",
                MigrationRule.MISSING_REFUSE_CHANGE_TRIGGERS,
            ),
            Plant(
                "fact table without a TRUNCATE trigger",
                "-- hms:fact-table audit.events\nCREATE TABLE audit.events (id uuid);\n" +
                    "CREATE TRIGGER events_no_change BEFORE UPDATE OR DELETE ON audit.events FOR EACH ROW EXECUTE FUNCTION audit.refuse();",
                MigrationRule.MISSING_REFUSE_CHANGE_TRIGGERS,
            ),
            Plant(
                "unlogged fact table",
                "-- hms:fact-table audit.events\nCREATE UNLOGGED TABLE audit.events (id uuid);",
                MigrationRule.FACT_TABLE_PROTECTION_CHANGED,
            ),
            // Fail closed on what the linter cannot read.
            Plant("unterminated string", "UPDATE $S.entry_by_patient SET last_entry = 'x;", MigrationRule.UNPARSEABLE_STATEMENT),
            Plant("unterminated block comment", "/* never closed\nSELECT 1;", MigrationRule.UNPARSEABLE_STATEMENT),
            Plant(
                "unterminated dollar quote",
                "CREATE FUNCTION $S.f() RETURNS void AS \$body\$ BEGIN",
                MigrationRule.UNPARSEABLE_STATEMENT,
            ),
            Plant("unbalanced parentheses", "SELECT (1;", MigrationRule.UNPARSEABLE_STATEMENT),
            Plant("unknown statement: CALL", "CALL $S.purge();", MigrationRule.UNRECOGNISED_STATEMENT),
            Plant(
                "unknown statement: event trigger",
                "CREATE EVENT TRIGGER quiet ON ddl_command_start EXECUTE FUNCTION $S.f();",
                MigrationRule.UNRECOGNISED_STATEMENT,
            ),
            Plant("unknown statement: COPY", "COPY $E FROM STDIN;", MigrationRule.UNRECOGNISED_STATEMENT),
        )
}
