# STATUS (updated 2026-10-18 18:30 Asia/Baghdad)
Phase: 0   Work package: WP-0.1 Programme bootstrap
Branch: wp/0.1-programme-bootstrap @ the commit that carries this file (parent `ed023b6`, "chore: import plan of record" on `main`)
Last green: none of record yet. The fast tier passes on the Windows checkout (labelled "Windows host", KA-001); the run of record happens in the WSL clone at this commit
In-flight slice: WP-0.1 bootstrap: verified on the Windows checkout; Linux run of record and review next
Open review findings: none (no review report yet)
Blocking decisions: DN-005 (lite cell and WP-0.2's failover criterion), DN-011 (merging before the merge tier exists)

## Last session
- Built: the WP-0.1 deliverables (WORK-PACKAGES.md lists them): programme control files; `backlog.yaml` and `BACKLOG.md` generated from Appendix A with the ten-row spot check; ADR-001…ADR-028 and the ADR index; the hazard log (H1–H15, HAZ-0001…HAZ-0021 for SI-01…SI-21, every control `planned`) with its schema and the sign-off gate; `tools/doctor`, `tools/bootstrap`, `tools/ci/run` (fast tier built, the other tiers fail closed); the repo, safety, backlog and licence checks; the Gradle workspace (convention plugins, test tiers as source sets, detekt, ktlint, the ArchUnit rule library) and the pnpm workspace (ESLint rules for JSX literals and physical CSS, the CSS checker, ICU catalogues in `en`, `ckb`, `ar` with the localisation lint); licence policy and ORT configuration; `.gitattributes`, `.gitignore`, `.editorconfig`, `.gitleaks.toml`, the PR template and CODEOWNERS; `tools/host/provision-ubuntu.sh`.
- Host: on the human's instruction (18 October 2026) the Linux build host was provisioned: WSL 2.6.3 repaired, Ubuntu 24.04.5 with Docker Engine, kubectl, Helm, k3d, JDK 25, Node.js 24 and Rust (DN-001 to DN-004 and DN-006 closed). The WSL clone `~/src/hospitalmanagementsystem` has its own project-local toolchain.
- Resumed after a usage-limit stop: six of the seven parallel builders were cut off mid-task; their work was finished and checked. Defects found and fixed: wrong backend test counts from tag filtering (now one source set per tier, OQ-096); the backlog generator dropping hand-added fields on regeneration; a stale ktlint result after a file deletion; ADR-002's pinned set out of step with the version catalogue.
- Verified (Windows checkout, labelled "Windows host"):
  - `sh tools/ci/run fast --no-evidence` → every step passes once COMMANDS.md existed (repo, safety and backlog checks; 384 Python tests; backend 66 tests; frontend 514 tests; secret scan with no findings). Merge, nightly and release fail closed (`--list` names the work package for each NOT-BUILT step).
  - Each gate fails on a planted violation and passes once it is removed: `docs/program/evidence/ci/2026-10-18-gates-bite.md`.
  - `sh tools/hms backlog spot-check --seed 20261018 --count 10` → ten of ten rows match: `docs/program/evidence/backlog/2026-10-18-spot-check.md`.
  - Licence checks on the frontend dependencies pass (shipped: 2 components; build-only: 124).

## Next exact step
1. In the WSL clone, at this commit: `sh tools/bootstrap`, `sh tools/doctor` and `sh tools/doctor --json` (store under `docs/program/evidence/doctor/`), then `sh tools/ci/run fast` (evidence under `docs/program/evidence/ci/`). Commit the evidence and this file.
2. Hand WP-0.1 over for the automated review: the review prompt (BUILD-PROMPT "How to use") in a separate session, report in `docs/program/reviews/WP-0.1.md`. Fix every critical and major finding and mark each resolved with its commit.
3. Then WP-0.2 (environments, lite cell, DN-005), branched from `wp/0.1-programme-bootstrap` (stacked, DN-011).

## Blocked / waiting on humans
- DN-005: the lite cell (the WSL VM has 10 GB) cannot show WP-0.2's single-node-loss criterion with two PostgreSQL instances.
- DN-011: §3.6 merges a branch only after the merge tier passes, and its last steps arrive in WP-1.12; the default stacks the branches.
- Later: DN-007 (Windows Git `core.autocrlf`), DN-008 (Git identity), DN-009 (reference cell), DN-010 (remote, hosted CI, CODEOWNERS handles), DN-012 (four plan-of-record files committed with CRLF).
- Q-K1…Q-K19, the A.20 conflicts, the Appendix A placements and the engineering choices [P] (OQ-094…OQ-100) wait in `OPEN-QUESTIONS.md`; L-1…L-37 in `ASSUMPTIONS.md`.

## Read next: BUILD-PROMPT top through §3; §21 (Phase 0) and §22 for the WP-0.1 review; for WP-0.2: §5.1, §4.1, §4.3 (signing), §16, §18.7; K §7.6, §7.8
