-- Clean fixture for the fact-table migration linter: the journal migration sketched in
-- docs/specs/modules/platform-journal.md §9.1 (synthetic; the journal slice owns the real file).
-- V0001__create_journal_entry.sql
-- hms:fact-table ${journalSchema}.entry
-- hms:aggregate-table ${journalSchema}.key_sequence
CREATE SCHEMA IF NOT EXISTS ${journalSchema};

CREATE TABLE ${journalSchema}.entry (
    id                    uuid        NOT NULL,
    tenant_id             uuid        NOT NULL,
    facility_id           uuid,
    producer_module       text        NOT NULL,
    aggregate_type        text        NOT NULL,
    aggregate_id          uuid        NOT NULL,
    version               integer     NOT NULL,
    previous_version      integer,
    patient_id            uuid,
    partition_scope       text        NOT NULL,
    partition_key         text        NOT NULL,
    key_seq               bigint      NOT NULL,
    event_stream          text        GENERATED ALWAYS AS (CASE WHEN partition_scope = 'patient' THEN 'patient' ELSE 'platform' END) STORED,
    event_type            text        NOT NULL,
    event_major           integer     NOT NULL,
    change_kind           text        NOT NULL,
    supersedes_version    integer,
    valid_from            timestamptz NOT NULL,
    valid_from_offset_s   integer     NOT NULL,
    valid_to              timestamptz,
    valid_to_offset_s     integer,
    valid_period          tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from, valid_to, '[)')) STORED,
    recorded_at           timestamptz NOT NULL,
    entry_timing          text        NOT NULL,
    clinical_time_source  text        NOT NULL,
    back_entry_episode_id uuid,
    entry_policy_ref      text,
    actor_id              uuid        NOT NULL,
    actor_kind            text        NOT NULL,
    on_behalf_of_id       uuid,
    device_id             uuid,
    source                text        NOT NULL,
    purpose_of_use        text        NOT NULL,
    reason                text,
    policy_decision_id    uuid,
    idempotency_scope     uuid        NOT NULL,
    idempotency_key       text        NOT NULL,
    request_fingerprint   bytea       NOT NULL,
    command_seq           smallint    NOT NULL,
    correlation_id        uuid        NOT NULL,
    causation_id          uuid,
    payload               jsonb       NOT NULL,
    event_data            jsonb       NOT NULL,
    tx_id                 xid8        NOT NULL DEFAULT pg_current_xact_id(),
    db_inserted_at        timestamptz NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT entry_pk PRIMARY KEY (id),
    CONSTRAINT entry_id_is_v7 CHECK (uuid_extract_version(id) = 7),
    CONSTRAINT entry_aggregate_version_uq UNIQUE (tenant_id, aggregate_type, aggregate_id, version),
    CONSTRAINT entry_command_uq UNIQUE (tenant_id, idempotency_scope, idempotency_key, command_seq),
    CONSTRAINT entry_key_seq_uq UNIQUE (tenant_id, partition_key, key_seq),
    CONSTRAINT entry_version_chain CHECK (version >= 1 AND (
        (version = 1 AND previous_version IS NULL) OR previous_version = version - 1)),
    CONSTRAINT entry_key_seq_positive CHECK (key_seq >= 1),
    CONSTRAINT entry_partition CHECK (
        (partition_scope = 'patient'   AND patient_id IS NOT NULL AND partition_key = patient_id::text) OR
        (partition_scope = 'tenant'    AND patient_id IS NULL     AND partition_key = tenant_id::text) OR
        (partition_scope = 'aggregate' AND patient_id IS NULL     AND partition_key = aggregate_id::text)),
    CONSTRAINT entry_change_kind CHECK (change_kind IN ('CHANGE', 'AMENDMENT', 'ENTERED_IN_ERROR')),
    CONSTRAINT entry_supersedes CHECK (
        (change_kind = 'CHANGE' AND supersedes_version IS NULL) OR
        (change_kind <> 'CHANGE' AND supersedes_version IS NOT NULL AND supersedes_version < version
         AND reason IS NOT NULL)),
    CONSTRAINT entry_supersedes_same_aggregate FOREIGN KEY (tenant_id, aggregate_type, aggregate_id, supersedes_version)
        REFERENCES ${journalSchema}.entry (tenant_id, aggregate_type, aggregate_id, version),
    CONSTRAINT entry_timing CHECK (entry_timing IN ('CONTEMPORANEOUS', 'BACK_DATED', 'BACK_ENTRY', 'OFFLINE_CAPTURE',
        'LATE_ARRIVAL', 'MIGRATED', 'EFFECTIVE_DATED')),
    CONSTRAINT entry_clinical_time_source CHECK (clinical_time_source IN ('ENTERED', 'DEVICE', 'INTERFACE', 'AT_RECORDING',
        'MIGRATED', 'EFFECTIVE_DATE')),
    CONSTRAINT entry_back_dating_privileged CHECK (
        (entry_timing = 'BACK_DATED') = (policy_decision_id IS NOT NULL) AND
        (entry_timing <> 'BACK_DATED' OR (reason IS NOT NULL AND actor_kind = 'USER'))),
    CONSTRAINT entry_back_entry_episode CHECK (
        (entry_timing = 'BACK_ENTRY') = (back_entry_episode_id IS NOT NULL) AND
        (entry_timing <> 'BACK_ENTRY' OR reason IS NOT NULL)),
    CONSTRAINT entry_migrated_together CHECK (
        (entry_timing = 'MIGRATED') = (actor_kind = 'MIGRATION_LOADER') AND
        (actor_kind = 'MIGRATION_LOADER') = (source = 'migrated')),
    CONSTRAINT entry_system_actor CHECK (
        (actor_kind = 'SYSTEM') = (source = 'system') AND
        (actor_kind <> 'SYSTEM' OR entry_timing IN ('CONTEMPORANEOUS', 'EFFECTIVE_DATED'))),
    CONSTRAINT entry_actor_kind CHECK (actor_kind IN ('USER', 'DEVICE', 'INTERFACE', 'MIGRATION_LOADER', 'SYSTEM')),
    CONSTRAINT entry_reason_not_blank CHECK (reason IS NULL OR btrim(reason) <> ''),
    CONSTRAINT entry_source CHECK (source IN ('user', 'device', 'ai-draft', 'migrated', 'interface', 'system')),
    CONSTRAINT entry_valid_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT entry_offsets CHECK (
        valid_from_offset_s BETWEEN -64800 AND 64800 AND
        (valid_to IS NULL) = (valid_to_offset_s IS NULL) AND
        (valid_to_offset_s IS NULL OR valid_to_offset_s BETWEEN -64800 AND 64800)),
    CONSTRAINT entry_event_major CHECK (event_major >= 1),
    CONSTRAINT entry_fingerprint_length CHECK (octet_length(request_fingerprint) = 32),
    CONSTRAINT entry_payload_object CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT entry_event_data_object CHECK (jsonb_typeof(event_data) = 'object' AND event_data ? 'meta')
);

CREATE TABLE ${journalSchema}.key_sequence (
    tenant_id     uuid   NOT NULL,
    partition_key text   NOT NULL,
    last_seq      bigint NOT NULL CHECK (last_seq >= 1),
    CONSTRAINT key_sequence_pk PRIMARY KEY (tenant_id, partition_key)
);

CREATE FUNCTION ${journalSchema}.refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'journal rows are never updated, deleted or truncated (SI-06, SI-10; BUILD-PROMPT §2.2 rule 2, §5.3 C)'
        USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER entry_no_update_delete BEFORE UPDATE OR DELETE ON ${journalSchema}.entry
    FOR EACH ROW EXECUTE FUNCTION ${journalSchema}.refuse_change();
CREATE TRIGGER entry_no_truncate BEFORE TRUNCATE ON ${journalSchema}.entry
    FOR EACH STATEMENT EXECUTE FUNCTION ${journalSchema}.refuse_change();

REVOKE ALL ON ${journalSchema}.entry, ${journalSchema}.key_sequence FROM PUBLIC;
GRANT USAGE ON SCHEMA ${journalSchema} TO ${appRole};
GRANT INSERT, SELECT ON ${journalSchema}.entry TO ${appRole};
GRANT INSERT, SELECT, UPDATE ON ${journalSchema}.key_sequence TO ${appRole};

ALTER TABLE ${journalSchema}.entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${journalSchema}.entry FORCE ROW LEVEL SECURITY;
CREATE POLICY entry_tenant ON ${journalSchema}.entry
    USING (tenant_id = current_setting('hms.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('hms.tenant_id')::uuid);
-- (the same policy on key_sequence and the indexes of §9.5 follow in the real migration)
