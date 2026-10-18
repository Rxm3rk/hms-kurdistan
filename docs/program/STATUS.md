# STATUS (updated 2026-10-18 18:50 Asia/Baghdad)
Phase: 0   Work package: WP-0.1 Programme bootstrap
Branch: wp/0.1-programme-bootstrap @ d3e14de (WP-0.1 commits 1b4415e, b24f94e, d3e14de; this file is updated by the evidence commit that follows)
Last green: fast @ d3e14de, WSL build host, no cell (`docs/program/evidence/ci/2026-10-18-fast-d3e14de.json`)
In-flight slice: WP-0.1 bootstrap: verified; handed over for the automated review
Open review findings: none yet (review in progress: `docs/program/reviews/WP-0.1.md`)
Blocking decisions: DN-005 (lite cell and WP-0.2's failover criterion), DN-011 (merging before the merge tier exists)

## Last session
- Built: the WP-0.1 deliverables (WORK-PACKAGES.md lists them): programme control files; `backlog.yaml` and `BACKLOG.md` generated from Appendix A with the ten-row spot check; ADR-001…ADR-028 and the ADR index; the hazard log (H1–H15, HAZ-0001…HAZ-0021 for SI-01…SI-21, every control `planned`) with its schema and the sign-off gate; `tools/doctor`, `tools/bootstrap` (now also the frontend packages, with Corepack's cache and the pnpm store in `.tools/`), `tools/ci/run` (fast tier built, the other tiers fail closed); the repo, safety, backlog and licence checks; the Gradle workspace (convention plugins, test tiers as source sets, detekt, ktlint, the ArchUnit rule library) and the pnpm workspace (ESLint rules for JSX literals and physical CSS, the CSS checker, ICU catalogues in `en`, `ckb`, `ar` with the localisation lint); licence policy and ORT configuration; `.gitattributes`, `.gitignore`, `.editorconfig`, `.gitleaks.toml`, the PR template and CODEOWNERS; `tools/host/provision-ubuntu.sh`.
- Host: on the human's instruction the Linux build host was provisioned (WSL 2.6.3 repaired; Ubuntu 24.04.5 with Docker Engine, kubectl, Helm, k3d, JDK 25, Node.js 24, Rust; DN-001 to DN-004 and DN-006 closed). Gates of record run in the WSL clone `~/src/hospitalmanagementsystem` at committed SHAs (KA-001).
- Resumed after a usage-limit stop: six of the seven parallel builders were cut off mid-task; their work was finished and checked. Defects found and fixed: wrong backend test counts from tag filtering (one source set per tier now, OQ-096); the backlog generator dropping hand-added fields; a stale ktlint result after a file deletion; ADR-002's pinned set out of step with the catalogue; a fresh clone missing `frontend/node_modules`; the doctor reading the WSL2 virtual disk's size as free space.
- Verified:
  - WSL build host at `d3e14de`, clean tree: `sh tools/ci/run fast` → PASS, 8 of 8 steps, 972 tests (392 Python, 66 backend, 514 frontend), 0 failures, 0 skipped, secret scan with no findings, 69 s (`docs/program/evidence/ci/2026-10-18-fast-d3e14de.json`).
  - WSL build host at `d3e14de`: `sh tools/doctor` → 18 items OK; RAM (9.7 GiB) and free disk (36.4 GiB on C:) below the [P] guides, so no cell profile yet (DN-005, DN-013; `docs/program/evidence/doctor/2026-10-18-d3e14de.txt` and `.json`).
  - Windows checkout: the merge, nightly and release tiers fail closed, every NOT-BUILT step naming its work package; each gate fails on a planted violation and passes once it is removed (`docs/program/evidence/ci/2026-10-18-gates-bite.md`); `sh tools/hms backlog spot-check --seed 20261018 --count 10` → ten of ten rows match (`docs/program/evidence/backlog/2026-10-18-spot-check.md`); frontend licence checks pass (shipped: 2 components; build-only: 124).

## Next exact step
1. The automated review of WP-0.1 (the review prompt of BUILD-PROMPT "How to use", in a separate session) writes `docs/program/reviews/WP-0.1.md`. Fix every critical and major finding, mark each resolved with its commit, and re-run the fast tier of record.
2. Then WP-0.2 (environments, lite cell, DN-005, DN-013), branched from `wp/0.1-programme-bootstrap` (stacked, DN-011).

## Blocked / waiting on humans
- DN-005: the lite cell (the WSL VM has 10 GB) cannot show WP-0.2's single-node-loss criterion with two PostgreSQL instances.
- DN-011: §3.6 merges a branch only after the merge tier passes, and its last steps arrive in WP-1.12; the default stacks the branches.
- Next: DN-013 (C: has about 35 GiB free, below the [P] 50 GiB guide) when WP-0.2 pulls images.
- Later: DN-007 (Windows Git `core.autocrlf`), DN-008 (Git identity), DN-009 (reference cell), DN-010 (remote, hosted CI, CODEOWNERS handles), DN-012 (four plan-of-record files committed with CRLF).
- Q-K1…Q-K19, the A.20 conflicts, the Appendix A placements, the engineering choices [P] (OQ-094…OQ-100) and the gaps found while writing the ADRs (OQ-101…OQ-105) wait in `OPEN-QUESTIONS.md`; L-1…L-37 in `ASSUMPTIONS.md`.

## Read next: BUILD-PROMPT top through §3; §21 (Phase 0) and §22 for the WP-0.1 review; for WP-0.2: §5.1, §4.1, §4.3 (signing), §16, §18.7; K §7.6, §7.8
