# ADR-029: Object storage: SeaweedFS with S3 Object Lock, chosen by the dependency scorecard and the WORM test
Status: accepted
Date: 2026-10-18   Source: BUILD-PROMPT §4.1 (Object storage row), §4.3 (dependency scorecard), §5.1, §7 item 15, §13.4, §16.2, §21 (WP-0.2); K §7.6, §7.8; ADR-022

## Context

**What the build prompt fixes.** §4.1 asks for "an S3-compatible server under Apache-2.0 or LGPL that implements Object Lock in compliance mode, chosen through the dependency scorecard and proven by a WORM test (an object cannot be deleted or its retention shortened before expiry). Not MinIO (AGPL, and its community edition no longer ships maintained builds)". The row is marked [P]: the blueprint leaves the product open. `platform-files` keeps documents, scans and photos in object-lock storage (§5.2, §7 item 15); the medico-legal record is never auto-deleted and legal holds override schedules (§2.3, §13.4). WP-0.2's exit evidence includes "the object store refuses to delete a locked object" (§21).

**How it was chosen (WP-0.2, 18 October 2026).** Three Apache-2.0 servers that advertise Object Lock were pulled at the version the §4.1 rule picks and put through the same WORM test, `sh tools/hms cell worm` (`tools/hmstools/cell/worm.py`): create an Object Lock bucket; store an object version under COMPLIANCE retention; read the retention back; then try to delete the version, delete it with `x-amz-bypass-governance-retention`, shorten its retention, downgrade it to GOVERNANCE and delete the bucket, each of which must be refused with a 4xx other than 404 (a 404 means the version is gone); the bytes must be unchanged; a positive control proves an unlocked version in the same bucket can be deleted. A second pass, `worm --recheck`, repeats the delete attempt and the integrity check on the same locked version after the server restarts. The test client signs requests with AWS Signature Version 4 and reproduces the signature of the AWS-documented "GET Object" example (`tools/hmstools/cell/tests/test_s3.py`); the verdict logic is tested against fake servers that do and do not enforce the lock.

| Candidate (version by the §4.1 rule) | WORM test | Memory in use | Scorecard facts (GitHub, 18 Oct 2026) |
|---|---|---|---|
| SeaweedFS 4.48 | PASS: W01–W10 as required | 64 MiB | Apache-2.0 since 2014; 47 releases in the last year; one author holds 74.5% of commits |
| RustFS 1.0.3 | PASS: W01–W10 as required | 101 MiB | Apache-2.0 since November 2023; 62 releases in the last year; two authors hold half the commits |
| versitygw v1.4.1 | **FAIL**: W06, a COMPLIANCE retention could be shortened (HTTP 200) | 12 MiB | Apache-2.0 since 2023; 13 releases in the last year |

The full scorecard, its method and its gaps are in `docs/program/dependency-scorecard.md`. Not evaluated: Ceph RGW (LGPL; too heavy for a lite cell) and Zenko CloudServer (Apache-2.0; not tested in WP-0.2).

## Decision

- **SeaweedFS** is the S3-compatible object store of the compose stack and the dev cell, pinned at **4.48** and run as one unmodified upstream container (`weed server -s3`). SeaweedFS numbers its releases 4.nn without patch releases, so the §4.1 rule ("at least one patch release") is read for it as "the newest release at least 14 days old" [P] (4.48 was published on 2026-09-28; OQ-107).
- **The product reaches object storage only through the S3 API**, behind the `platform-files` port (§5.2). No SeaweedFS-specific API, filer path or metadata store is used by product code.
- **RustFS 1.0.3 is the qualified alternative**: it passed the same WORM test. Switching is a deployment change plus an S3-to-S3 copy of the buckets with their retention settings.
- **versitygw is rejected** at v1.4.1 because it allowed a COMPLIANCE retention to be shortened.
- Every object-store upgrade re-runs the WORM test and its post-restart re-check before the new version is used anywhere.

## Consequences (including safety and licence impact)

- **Licence:** Apache-2.0, on the §4.3 allowlist; it ships to every site as an unmodified container. Recorded in the dependency scorecard.
- **Safety (H6, H14):** COMPLIANCE-mode Object Lock stops deletion and retention shortening through the S3 API, including by the product's own credentials, which protects documents in the legal record against application faults and compromised application accounts. It does not stop an operating-system administrator from destroying the disk itself; that risk is covered by the on-site immutable backup target in a separate fire compartment and the DR copies (§5.1, §16.2), not by this ADR.
- **Steward risk:** one author holds about three quarters of SeaweedFS's commits (bus factor 1). Mitigations: the S3-only port, the proven RustFS alternative and the reopen triggers below.
- **Footprint:** about 64 MiB resident in the WORM run; suitable for the lite cell.
- **Test tooling:** the WORM test and the S3 client are test tools in `tools/hmstools/cell/`, not product code.

## Fitness test that guards it

`sh tools/hms cell worm --endpoint <url> --label <name> --cell <cell> --evidence` and its `--recheck` pass after a restart; both run against the compose stack and inside the dev cell's smoke test (WP-0.2), with records in `docs/program/evidence/cell/`. State on 2026-10-18: the WORM test and its unit tests exist. The results in the Context table come from exploratory runs on the WSL build host before this ADR was committed; the records of record are made at a committed SHA and added under `docs/program/evidence/cell/` by the evidence commit that follows.

## Reopen if

- SeaweedFS fails the WORM test or its post-restart re-check on any version the build would adopt;
- its licence or steward changes (the ADR-022 trigger), or its principal maintainer's activity stops for 90 days [P];
- the lite cell or on-site cell footprint test shows it cannot meet the budget;
- at a phase-boundary review the dependency scorecard ranks RustFS clearly ahead.
