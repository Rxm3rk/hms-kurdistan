# STATUS (updated 2026-10-19 05:05 Asia/Baghdad)
Phase: 0   Work package: WP-0.1 Programme bootstrap
Branch: wp/0.1-programme-bootstrap @ the commit that fills the review's Resolution fields, on top of `a9d5725` (the sign-off gate fixes) and `7f42564` (the records of record at `05f159a`)
Last green: fast @ a9d5725, WSL build host, no cell (`docs/program/evidence/ci/2026-10-19-fast-a9d5725.json`: PASS, 8 of 8 steps, 1279 tests, 0 failures); nightly @ a9d5725 and merge @ 05f159a fail closed on NOT-BUILT steps only (12 and 15; KA-003)
In-flight slice: none on this branch; WP-0.1 is done (§22.2); WP-0.7 is in progress on `wp/0.7-design-system`, WP-0.2 on `wp/0.2-environments`
Open review findings: `docs/program/reviews/WP-0.1.md` (automated review (AI) at `adb631c`): all 21 resolved, each Resolution field naming its commit (`05f159a`; R-06 and R-07 `7f42564`; R-01 and R-20 also `a9d5725`); 0 unresolved
Blocking decisions: DN-005 (lite cell and WP-0.2's failover criterion), DN-011 (merging before the merge tier exists)
ID ranges for the stacked branches [P]: WP-0.1 continues from OQ-122, KA-014 and DN-015 only if it needs more; WP-0.2 takes DN-015…DN-019, OQ-122…OQ-139, KA-014…KA-024, HAZ-0028…HAZ-0029 and ADR-030; WP-0.7 takes DN-020…DN-039, OQ-140…OQ-159, KA-025…KA-044 and HAZ-0030…HAZ-0034, and no ADR

## Last session
- Resolved the review findings in the review-fix commit (each Resolution field names it):
  - R-01, R-20: the sign-off gate accepts only committed records signed (`%G?` = `G`) by a key that `docs/safety/signoffs/allowed-signers.yaml` lists for the record's person and role. Each decision counts only for its own kind of field, at the subject's current version, in a role the field accepts. A record that a later record supersedes, or that a rejection or return of the same version and field withdraws, authorises nothing. The list is trusted only as far as its own history allows; where merged lines trust different signers, no signer is trusted until every side approves one version. It lists no signer yet, and the trust-anchor limitation remains (KA-011).
  - R-02: the entry scripts and `backend/gradlew` are stored as 100755; `sh tools/hms repo check` fails if one loses the bit or leaves git's index.
  - R-04: CTRL-0014-4 gates on all four SI-14 items. Only the strict reading of "a measured PPV" is recorded as a tightening; the day-0 exception is DN-014's option 1, for the CSO.
  - R-05: backlog `hazards` are derived from the hazard log and checked (KA-010 closed); KA-007…KA-013 record the other limitations.
  - R-14: the JDK is pinned to Temurin 25.0.4.1+1 by SHA-256 with no fallback, and the doctor passes only the pin; the next fast record names the vendor build (`java_identity`).
  - R-18: a conditional licence fails until the register records it as unmodified, under the rule the policy applies; a register pattern that does not name its component is refused.
  - R-19, R-21: hazard-log overclaims corrected and the tightenings recorded; the SI-05 clause d gap before the Dose Engine goes to the CSO (OQ-120).
  - R-03, R-08…R-13, R-15…R-17: documentation and record fixes, including OQ-108…OQ-119 and DN-001's itemised system changes.
- Host: on the human's instruction the build agent provisioned the Linux build host itself, a recorded deviation from §3.4 item 9. DN-001 lists every system-wide change, what was checked against a SHA-256 and what was trusted on TLS alone. Gates of record run in the WSL clone `~/src/hospitalmanagementsystem` at committed SHAs (KA-001).
- Checked on the Windows host only (uncommitted tree, untracked test files included; not evidence of record):
  - 673 Python tests OK;
  - safety, repo and backlog checks PASS (hazards=27, controls=193, all `planned`; approval_fields_filled=0; allowed_signers=0; executables_checked=6);
  - secret scan: 0 findings in the history and the working tree;
  - frontend licence checks PASS (2 components shipped, 124 build-only);
  - `sh tools/doctor --tier fast` PASS with the pinned JDK.
- In WSL against the Windows checkout (not a committed SHA, not evidence of record): 310 safety tests OK, the real GPG and SSH signature tests included.
- Gates-bite: `tools/ci/gates-bite/` scripts the plant matrix (78 plants, 18 of them merges of `allowed-signers.yaml`). Dry runs only, in a WSL scratch clone at unreferenced snapshots of the working tree taken before the last gate changes:
  - `8bdfdd5` (every section but sign-off): 36 of 37 plants as expected; the scope-note plant, the clean secret scan and the final fast tier failed on a test fixture that has since been fixed;
  - `4d08832` (every section): 78 plants as expected (73 FAIL, 5 PASS); the clean unit tests and the fast tier failed only on a gpg clock problem in `test_signed_commits.py`, since fixed;
  - `a43820e` (sign-off, clean and final sections): 41 plants as expected, 11 of 11 clean runs PASS and the fast tier PASS.
  - The record of record at the review-fix commit is pending.
- Verified (records of record, WSL build host, no cell, at `05f159a`, clean tree; stored under `docs/program/evidence/`):
  - `ci/2026-10-19-fast-05f159a.json`: `sh tools/ci/run fast` → PASS, 8 of 8 steps, 1253 tests (673 Python, 66 backend, 514 frontend), 0 failures, 0 skipped, secret scan with no findings.
  - `ci/2026-10-19-merge-05f159a.json` and `ci/2026-10-19-nightly-05f159a.json` (R-07): FAIL, the 8 fast steps pass and 15 and 12 steps are NOT-BUILT; neither tier can pass before the work packages that build those steps (KA-003).
  - `ci/2026-10-19-gates-bite-05f159a.md` (R-06; scratch clone `hms-plant`): 78 plants, 73 FAIL and the 5 expected to pass passing; 11 of 11 clean runs PASS; fast tier PASS.
  - `backlog/2026-10-19-spot-check-05f159a.md` (R-06): ten of ten rows match, hazards included, checked by the build agent (AI) on the Windows host against the committed files; a 236-row cross-check found 0 mismatches.
  - `doctor/2026-10-19-doctor-05f159a.{txt,json}`: 18 items OK; RAM (9.7 GiB) and free disk (29.8 GiB on C:) below the [P] guides (DN-005, DN-013).
  - `licence/2026-10-19-licence-05f159a.txt` with its input lists (R-06): PASS, 2 shipped components and 124 build-only.
  - Earlier records stay where the review cites them: the fast and doctor records at `d3e14de`; the 18 October gates-bite and spot-check files are Windows runs from before the first commit and not records of record.
  - Still without a record: the 10⁶-sequence run, the second provisioning run and the release tier.
- Deviations from BUILD-PROMPT (§3.5):
  - §3.6: commit `1b4415e` did not pass the fast tier on a fresh clone (no `frontend/node_modules`); fixed from `b24f94e`; never rebased (KA-012).
  - §19.1: the WP-0.1 session has no nightly run of record yet (R-07). The nightly tier cannot pass before its NOT-BUILT steps are built: WP-0.2 (cell check, chaos), WP-0.5 (10⁶ property sequences, ≥10⁴ per channel adapter, scenario suites), WP-0.6 (the scaled day; the 300-bed and 1,000-bed days also need hardware [HUMAN]), WP-0.7 (full end-to-end), WP-0.8 (golden-image print), WP-1.1b (parser fuzzing) and WP-1.13 (restore test) (`sh tools/ci/run nightly --list`). Until then its failing (NOT-BUILT) record is made in the WSL clone at the last commit of every session that changes code, and stored under `docs/program/evidence/ci/`.
  - §3.4 item 9: the host provisioning by the agent (DN-001). §3.7: two files came from mirrors, each matching the official SHA-256 (the Ubuntu WSL image, DN-001; the Gradle zip, DN-006).
- Verified the sign-off gate independently after `05f159a`: two verifiers built 124 scratch cases with real GPG keys and found nine defects (the worst: deleting a committed, signed rejection brought back the acceptance it withdrew). `a9d5725` fixes eight, documents the ninth (D5, KA-011) and closes a repository-local `gpg.program` override found while fixing them; 26 regression tests, each failing on `05f159a`. Records of record at `a9d5725` (WSL build host, no cell, clean tree): `ci/2026-10-19-fast-a9d5725.json` (PASS, 1279 tests), `ci/2026-10-19-nightly-a9d5725.json` (FAIL, 12 NOT-BUILT) and `ci/2026-10-19-gates-bite-a9d5725.md` (78 plants, 73 FAIL and the 5 expected PASS; 11 of 11 clean runs PASS).
- Work started on other branches (not on this one): WP-0.7's specification slice (the design-system module spec, the patient-context state machine with approval requested, the HAL contract and fixtures) is drafted and reviewed in the worktree of `wp/0.7-design-system`, uncommitted; WP-0.2 has an implementation plan for the lite cell. Neither changes WP-0.1.

## Next exact step
1. WP-0.7 on `wp/0.7-design-system` (worktree `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\wp07`): slices S1 to S7 up to the demo route and its E2E evidence; merge this branch into it before its close-out (never rebase, §3.6).
2. WP-0.2 on `wp/0.2-environments`: merge this branch into it (its three commits keep their SHAs), then the lite cell from its plan (fixed node addresses, signed images, PostgreSQL failover tests; DN-005, DN-013).

## Blocked / waiting on humans
- DN-005: the lite cell (the WSL VM has 10 GB) cannot show WP-0.2's single-node-loss criterion with two PostgreSQL instances.
- DN-011: §3.6 merges a branch only after the merge tier passes, and its last steps arrive in WP-1.12; the default stacks the branches.
- Next: DN-013 (free disk on C:) when WP-0.2 pulls images; DN-014 (the CSO's reading of SI-14's "a measured PPV" for the day-0 CDS baseline) before WP-1.5.
- For the CSO, not blocking yet: OQ-120 (the SI-05 clause d gap of control set A before the Dose Engine; before R2b go-live at the latest), OQ-121 (whether a risk acceptance survives a linked release or incident), KA-013 (a state-machine spec changed without a version bump keeps its approval; WP-0.5).
- Later: DN-007 (Windows Git `core.autocrlf`), DN-008 (Git identity), DN-009 (reference cell), DN-010 (remote, hosted CI, CODEOWNERS handles; also KA-004 and KA-011: until a protected branch exists, verify every listed signer and every trust anchor out of band), DN-012 (four plan-of-record files committed with CRLF).
- Q-K1…Q-K19, the A.20 conflicts, the Appendix A placements and notes (OQ-040…OQ-082, OQ-108…OQ-116), the engineering choices [P] (OQ-094…OQ-100), the ADR gaps (OQ-101…OQ-105) and the ADR differences from BP and the C9 reading (OQ-117…OQ-119) wait in `OPEN-QUESTIONS.md`; L-1…L-37 in `ASSUMPTIONS.md`.

## Read next: BUILD-PROMPT top through §3; §19.1, §21 (Phase 0) and §22; for WP-0.2: §5.1, §4.1, §4.3 (signing), §16, §18.7; K §7.6, §7.8; for WP-0.7: §6, SI-16 and `docs/specs/modules/design-system.md` on its branch
