# Localisation lint fixtures

Synthetic catalogues for the lint tests. Every message is a `SYN-` placeholder, never a translation.

- `valid/`: three catalogues the lint accepts (different plural branches per locale are allowed; the
  clinical key `clinical.fixtureCount` keeps `#` in every branch), and `review/` marking every `ckb` and `ar`
  message `unreviewed`.
- `invalid/`: one catalogue per problem class: a duplicate key (`en.json`), an ICU syntax error and a
  missing key (`ckb.json`), an empty message, a placeholder mismatch, a clinical message left equal to the
  English one and a clinical plural branch without `#` (`ar.json`), and a stray catalogue for a template-only
  locale (`ku-Arab.json`). In `review/`: an unknown review status (`ckb.json`), a key with no status and a
  status for a key the catalogue lacks (`ar.json`), and a review file for the source locale (`en.json`).
