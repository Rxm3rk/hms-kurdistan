-- Clean fixture: changes a fact table may receive (a new nullable column, a constraint, an index), a SQL-standard
-- function body, an upsert on the aggregate counter table and an escape string with a semicolon in it.
ALTER TABLE ${journalSchema}.entry ADD COLUMN note text;
ALTER TABLE ONLY ${journalSchema}.entry ADD CONSTRAINT entry_note_not_blank CHECK (note IS NULL OR btrim(note) <> ''), VALIDATE CONSTRAINT entry_note_not_blank;
ALTER TABLE ${journalSchema}.entry DROP CONSTRAINT IF EXISTS entry_note_not_blank;
CREATE INDEX IF NOT EXISTS entry_tx ON ${journalSchema}.entry (tenant_id, tx_id, id);
SET search_path = ${journalSchema}, public;
CREATE FUNCTION ${journalSchema}.entry_count(p_tenant uuid) RETURNS bigint LANGUAGE sql STABLE
BEGIN ATOMIC
    SELECT count(*) FROM ${journalSchema}.entry WHERE tenant_id = p_tenant;
END;
INSERT INTO ${journalSchema}.key_sequence (tenant_id, partition_key, last_seq)
    VALUES ('00000000-0000-7000-8000-000000000001', 'p', 1)
    ON CONFLICT (tenant_id, partition_key) DO UPDATE SET last_seq = EXCLUDED.last_seq;
SELECT E'it\'s; not a statement end' AS note;
