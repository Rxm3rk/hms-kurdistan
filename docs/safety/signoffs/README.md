# Human sign-off records

A sign-off record is the only thing that allows an approval, sign-off, triage or risk-acceptance field to be filled anywhere in the safety artefacts or the state-machine specs (BUILD-PROMPT.md §3.5, §10.1). **Only a named person writes a record. The build agent never writes, edits or commits these files**, and never fills the fields they authorise; it asks for the decision in `docs/program/DECISIONS-NEEDED.md` with status `requested` and stops at the [HUMAN] gate.

`sh tools/hms safety check` fails when a filled field has no matching record, when a record is invalid, or when a record cannot be authenticated.

## The record

One YAML file per decision, in this directory, named `<id>.yaml`. The format is `signoff.schema.json`.

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | `SO-<year>-<nnnn>`, for example `SO-2027-0001`; equal to the file name |
| `subject` | yes | The artefact the decision is about: a hazard id (`HAZ-0005`), a control id (`CTRL-0005-9`), a state-machine name (`medication-administration`, the spec's `machine` value), `risk-vocabulary`, or another artefact's id |
| `field` | yes | The approval field it authorises, as a dotted path inside the subject: `residual_risk.accepted_by`, `cso_triage`, `approval.approved_by`, `approval` … A record for a parent path authorises the fields under it (`cso_triage` covers `cso_triage.by` and `cso_triage.date`) |
| `role` | yes | The role in which the person signs (for example Clinical Safety Officer, Chief CSO, pharmacist panel member, laboratory CSO) |
| `name` | yes | The signer's full name. The value written into a `…_by` field must equal this name (or the record id) |
| `date` | yes | Date of the decision, `YYYY-MM-DD`. A filled `cso_triage.date` must equal it |
| `statement` | yes | What exactly is approved, accepted or triaged, in the signer's words, with any conditions |
| `authentication` | yes | `{method: signed-git-commit}` in the MVP; optional `signer_key` (fingerprint) for the reviewer's cross-check |
| `decision` | no | `approved`, `accepted`, `triaged`, `rejected` or `returned`. A record with no decision or with `approved`, `accepted` or `triaged` authorises its field; `rejected` and `returned` are history and authorise nothing |
| `subject_version` | no | The version of the subject that was reviewed (a state-machine spec version, a commit SHA) |
| `evidence` | no | Paths or references to the evidence reviewed |
| `supersedes` | no | The id of an earlier record this one replaces |
| `notes` | no | Free text |

Shape only (placeholders in angle brackets; this is not a record):

```yaml
id: SO-<yyyy>-<nnnn>
subject: <HAZ-nnnn | CTRL-nnnn-k | state-machine name | risk-vocabulary | artefact id>
field: <residual_risk.accepted_by | cso_triage | approval.approved_by | …>
role: <role in which the person signs>
name: <signer's full name>
date: <yyyy-mm-dd>
statement: >-
  <what is approved, accepted or triaged, and any conditions>
decision: <approved | accepted | triaged | rejected | returned>
subject_version: <optional>
evidence:
  - <optional reference>
authentication:
  method: signed-git-commit
```

## How a record is authenticated (MVP)

The record counts only together with the signed git commit that adds it:

1. The named person writes the record and, in the same or a later commit, fills the field it authorises (for example `residual_risk.accepted_by: <name>` in `hazard-log.yaml`, or `approval.approved_by` and `approval.record: SO-…` in a state-machine spec).
2. They commit it with their own signing key (`git commit -S`, GPG or SSH signing). The commit carries no AI co-author trailer.
3. The check verifies, with git on the machine where it runs, that the record file is committed with no uncommitted changes, that **every** commit touching it has a valid signature (`git log --format=%G?` is `G` or `U`), and that none carries an AI co-author trailer. Git must be able to verify the signature there (the signer's public key, or `gpg.ssh.allowedSignersFile`); otherwise the record does not count.

A committed record is never edited. A correction is a new record with `supersedes`. A record whose field is not filled yet raises a warning, not an error.

Stronger authentication (a qualified electronic signature, a signature-provider port, Q-K5) needs an ADR. Who may sign which field (the CSO for risk acceptance and triage; the panels named in a state machine's `approval.required`) is checked by the reviewer and the CSO; the tool checks that a record exists, matches and is authenticated.

## How the check matches a field to a record

For every filled field it finds (the list is in `../README.md`, "Approval fields stay empty without a sign-off record"):

- the **subject** is the nearest enclosing object with an `id` (a hazard, a control, `risk-vocabulary`) or, in a state-machine spec, its `machine` name (else the file name);
- the **field** is the dotted path from that object (`residual_risk.accepted_by`, `cso_triage.by`, `approval.approved_by`);
- a record matches when its `subject` equals the subject, its `field` equals the path or a parent of it, and its decision authorises. A hazard `status: accepted` needs a record for `residual_risk.accepted_by`; `approval.record` and `approval.status` are also authorised by a record for `approval.approved_by`;
- the value must agree with the record: a `…_by` value equals the record's `name` or `id`, a date equals its `date`, and `approval.record` equals its `id`.

A record for a different subject or a different field authorises nothing.
