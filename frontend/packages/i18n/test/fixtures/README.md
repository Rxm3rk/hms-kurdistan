# Localisation lint fixtures

Synthetic catalogues for the lint tests. Every message is a `SYN-` placeholder, never a translation.

- `valid/`: three catalogues the lint accepts (different plural branches per locale are allowed).
- `invalid/`: one catalogue per problem class: a duplicate key (`en.json`), an ICU syntax error and a
  missing key (`ckb.json`), an empty message and a placeholder mismatch (`ar.json`), and a stray
  catalogue for a template-only locale (`ku-Arab.json`).
