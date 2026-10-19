-- Clean fixture: a repeatable migration, applied after the versioned ones.
GRANT SELECT ON ${journalSchema}.entry TO ${readerRole};
