# STATUS (updated 2026-10-19 06:40 Asia/Baghdad)
Phase: 0   Work package: WP-0.2 Environments
Branch: wp/0.2-environments @ `889beec`, the `--no-ff` merge of `wp/0.1-programme-bootstrap` at `09afa41` into the three WP-0.2 commits (`a1d5fd6`, `c1c2ea9`, `051d083`, SHAs unchanged); slice S0's programme entries are uncommitted, for the checkpoint commit
Last green: fast @ a9d5725 on `wp/0.1-programme-bootstrap`, WSL build host, no cell (`docs/program/evidence/ci/2026-10-19-fast-a9d5725.json`: PASS, 8 of 8 steps, 1279 tests). On this branch no record of record yet: the fast tier passed on the Windows host on the merge tree (`--no-evidence`; not evidence of record)
In-flight slice: S0 (ready: merge, programme entries, prototype cleared): impl done; the independent review's nine findings fixed; verified on the Windows host only
Open review findings: none for WP-0.2 (not reviewed yet); `reviews/WP-0.1.md`: all 21 resolved
Blocking decisions: DN-005 (WP-0.2 runs on its option 4, three PostgreSQL instances in the lite cell, pending), DN-011 (merging before the merge tier exists)
ID ranges for the stacked branches [P]: WP-0.1 is done and takes no more IDs; WP-0.2 takes DN-015…DN-019, OQ-122…OQ-139, KA-014…KA-024, HAZ-0028…HAZ-0029 and ADR-030; WP-0.7 takes DN-020…DN-039, OQ-140…OQ-159, KA-025…KA-044 and HAZ-0030…HAZ-0034, and no ADR. Used by WP-0.2 so far: DN-015, DN-016; OQ-122…OQ-134; KA-014…KA-024; HAZ-0028, HAZ-0029; ADR-030

## Last session
- Built (slice S0 of the WP-0.2 plan; programme files only, no cell code):
  - Merged `wp/0.1-programme-bootstrap` at `09afa41` into this branch with `--no-ff` (`889beec`); one conflict, `OPEN-QUESTIONS.md`, resolved by keeping both sides (WP-0.1's OQ-121, then WP-0.2's section (g)).
  - DN-005: the default in use is now option 4 (three small PostgreSQL instances in the lite cell); the third exit criterion is reported "shown on the lite cell, pending", never "met". DN-013: the measured disk figures. New: DN-015 (WSL idle termination), DN-016 (inotify instances).
  - OQ-122…OQ-134 (topology, Kyverno, mirroring, pins, the meaning of "committed", the chaos split, parking the cell, evidence naming, the cosign passphrase, OpenTelemetry, egress, UBI, `deploy/compose/`); updates to OQ-084, OQ-094 and OQ-104.
  - KA-014…KA-024; KA-003, KA-006, KA-008 and KA-009 updated.
  - Hazard log: HAZ-0028 (committed data lost, or writes accepted unsafely, after losing cell nodes; H6, H7; CTRL-0028-1…5) and HAZ-0029 (a locked object deleted or its retention shortened; H6, H14; CTRL-0029-1…2), every control `planned`; the backlog's hazard links derived again.
  - ADR-030 (Kyverno admission control verifies locally signed images offline), proposed; the ADR index and next free number (ADR-031).
  - `work-packages/WP-0.2.md`: the lite design and the test names; `WORK-PACKAGES.md`: WP-0.2 in progress; the evidence README: a `cell/` row, the compose label and the qualifier rule.
- Cleared the WP-0.2 prototype in WSL (not evidence; none of its numbers is used): `k3d cluster delete hms-proto`, and removed the five images no pin uses (RustFS 1.0.3, versitygw v1.4.1, CloudNativePG 1.27.1, Strimzi operator 0.48.0, Valkey 8.1). `docker system df`: images 2.533 GB → 1.134 GB, volumes 3.766 GB → 0; `df -h /mnt/c`: 30G available before and after (DN-013).
- Two WP-0.1 tests assumed the seeded log only and failed on the new entries: `test_hazard_log_rules.py` now expects 29 entries, and `test_seeded_content.py` asks the §18.3 property control (10⁶ and at least 10⁴ sequences) of every entry that lists an SI, and checks that all 27 seeded entries do; HAZ-0028 and HAZ-0029 have no SI.
- Verified on the Windows host only (not evidence of record; the fast tier of record in the WSL clone is still owed):
  - `sh tools/ci/run fast --no-evidence` on the merge tree `889beec` → PASS, 8 of 8 steps, 1294 tests (714 Python, 66 backend, 514 frontend), 0 failures.
  - On the S0 working tree: `sh tools/hms repo check`, `safety check` (hazards=29, controls=200, all `planned`) and `backlog check` (hazard_links=243) → PASS; `sh tools/ci/run fast --no-evidence` → PASS, 8 of 8 steps, 1294 tests, 0 failures, and after the review fixes PASS, 8 of 8 steps, 1296 tests (716 Python), 0 failures; the cell unit tests (14, then 15) → OK.
- `cell/evidence.py` now calls the runner's `git_info` with `ignore_untracked_under` (the runner at `09afa41` had no helper for the untracked-evidence rule); `ci/` records keep counting every untracked file, so the two writers' rules differ until the lead decides (KA-024, review observation O-5). A cell rerun with the same record name adds `-2`, `-3` instead of overwriting (OQ-129). Tests: `test_untracked_evidence_counts_unless_the_caller_ignores_it` (ci), `test_a_rerun_with_the_same_name_never_overwrites` (cell).
- Not done in S0: the keeper process (it is started by the cell owner at the start of the first cell session, DN-015).

## Next exact step
1. The checkpoint commit of S0's programme entries; then the fast tier of record in the WSL clone at that SHA.
2. S1 (pins, image lock, registry and keys), then S2 (the substrate with fixed addresses and the restart test R1), by the one cell owner, never while another heavy job runs in WSL (`cell up` needs 6.5 GiB available) and never below 15 GiB free on C:.
3. WP-0.7 continues on `wp/0.7-design-system` (its own worktree); it starts its IDs at DN-020, OQ-140, KA-025 and HAZ-0030.

## Blocked / waiting on humans
- DN-005: whether the three-instance lite cell's evidence meets WP-0.2's single-node-loss criterion (default in use: option 4, pending).
- DN-011: §3.6 merges a branch only after the merge tier passes, and its last steps arrive in WP-1.12; the default stacks the branches.
- Host settings, not blocking yet: DN-013 (free disk on C:, 29.3 GiB), DN-015 (WSL idle termination), DN-016 (inotify instances at 128).
- Later: DN-007 (Windows Git `core.autocrlf`), DN-008 (Git identity), DN-009 (reference cell), DN-010 (remote, hosted CI, CODEOWNERS handles; also KA-004 and KA-011: until a protected branch exists, verify every listed signer and every trust anchor out of band), DN-012 (four plan-of-record files committed with CRLF), DN-014 (the CSO's reading of SI-14's "a measured PPV" for the day-0 CDS baseline; before WP-1.5).
- For the lead, not blocking yet: KA-024 (whether `ci/` records take the cell's untracked-evidence rule); OQ-133 [HUMAN] (whether the Red Hat UBI terms allow the Keycloak and Strimzi images to ship to sites).
- For the CSO, not blocking yet: OQ-120 (the SI-05 clause d gap of control set A before the Dose Engine; before R2b go-live at the latest), OQ-121 (whether a risk acceptance survives a linked release or incident), KA-013 (a state-machine spec changed without a version bump keeps its approval; WP-0.5); the initial risks of HAZ-0028 and HAZ-0029 are proposals awaiting triage.
- Q-K1…Q-K19, the A.20 conflicts, the Appendix A placements and notes (OQ-040…OQ-082, OQ-108…OQ-116), the engineering choices [P] (OQ-094…OQ-100, OQ-106, OQ-107, OQ-122…OQ-134), the ADR gaps (OQ-101…OQ-105) and the ADR differences from BP and the C9 reading (OQ-117…OQ-119) wait in `OPEN-QUESTIONS.md`; L-1…L-37 in `ASSUMPTIONS.md`.

## Read next: BUILD-PROMPT §3, §4.1 (versions; on-site substrate; Kubernetes packaging), §4.3 (signing in development and CI), §5.1, §16.1–§16.2, §18.7, §19.1, §21 (WP-0.2), §22; K §7.6, §7.8; the WP-0.2 plan (S1 and S2)
