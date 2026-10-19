-- Clean fixture: a read model of the journal. Read-model rows may be rebuilt, so truncating and updating them is
-- allowed; the aggregate counter table may be updated. Words in strings and comments are not statements:
-- DELETE FROM ${journalSchema}.entry;
-- hms:read-model ${journalSchema}.entry_by_patient
CREATE TABLE ${journalSchema}.entry_by_patient (
    tenant_id  uuid NOT NULL,
    patient_id uuid NOT NULL,
    last_entry uuid NOT NULL,
    CONSTRAINT entry_by_patient_pk PRIMARY KEY (tenant_id, patient_id)
);
CREATE INDEX entry_by_patient_last ON ${journalSchema}.entry_by_patient (last_entry);
COMMENT ON TABLE ${journalSchema}.entry_by_patient IS 'Rebuilt from the journal; DELETE FROM entry and TRUNCATE entry are only words here.';
TRUNCATE ${journalSchema}.entry_by_patient;
UPDATE ${journalSchema}.key_sequence SET last_seq = last_seq WHERE false;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ${journalSchema}.entry_by_patient TO ${appRole};
