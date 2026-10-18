# WP-0.1: Programme bootstrap
Phase / release: Phase 0 Foundation / no clinical go-live (business plan M0–M9)   Features: none listed in §21
Read first: BUILD-PROMPT top through §4; §6; §10.1; §19.1; §21 (Phase 0); §22; §23; Appendix A (through the generator script and a ten-row spot check, not line by line); Appendix B. K Part 0, §1, §19 and Appendix B. Research: none
Depends on: — (first work package)   Simulators needed: none
Entry criteria:
- The plan of record is committed on `main` as `chore: import plan of record` before any build file (§3.6): done, `ed023b6`.
- Branch `wp/0.1-programme-bootstrap` cut from `main` (§3.6): done.
- The build host checked against "Before the first session" with version commands only, and every missing item written with its install commands into `DECISIONS-NEEDED.md` (kickoff step 4): done, DN-001 to DN-010.
- On this host: at the start, Windows without WSL2, a container engine or k3d. On the human's instruction the Linux build host was provisioned during WP-0.1 (WSL2 with Ubuntu 24.04; DN-001 to DN-004 closed). The work is edited in the Windows checkout with the project-local toolchain in `.tools/` (DN-006, KA-002), and the gates of record run in the WSL clone at committed SHAs (KA-001).
Deliverables:
- Monorepo layout (§6.1): `docs/` (`program/`, `adr/`, `safety/`, `specs/`, `runbooks/`, `user/`), `backend/`, `frontend/`, `content/`, `deploy/`, `tools/`, `tests/`. Directories that hold no content yet carry a README naming the work package that fills them.
- Programme control files (§3.1): `STATUS.md` (template B.5, under 150 lines); `BACKLOG.md` generated from `backlog.yaml`; `WORK-PACKAGES.md` and `work-packages/WP-0.1.md` to `WP-0.9.md` (template B.4); `DECISIONS-NEEDED.md`; `OPEN-QUESTIONS.md` (Q-K1…Q-K19, the A.20 conflicts, the Appendix A placements awaiting confirmation, recorded differences, content requests); `ASSUMPTIONS.md` (L-1…L-37 with K's defaults and configuration keys); `COMMANDS.md`; `KNOWN-ANOMALIES.md`; `evidence/` and `reviews/` with their READMEs; `CHANGELOG.md`.
- `docs/program/backlog.yaml` generated from Appendix A by a script, with a ten-row spot check; `sh tools/hms backlog check [--json]` (CheckResult contract in `tools/hmstools/common.py`).
- Baseline ADR files ADR-001…ADR-028 in `docs/adr/` from §4.2 (template B.1), each with status, context, decision, consequences, the fitness test that guards it and its reopen trigger; ADR-001 and ADR-009 `accepted-provisional` until their spike criteria pass on the reference cell (WP-0.6).
- `docs/safety/hazard-log.yaml` seeded with H1–H15 and one entry per SI-01…SI-21 (template B.2), every control `state: planned`, every human field empty or null (`accepted_by`, `cso_triage`); `sh tools/hms safety check [--json]`, which fails if a human field is filled without a matching sign-off record under `docs/safety/signoffs/` (§3.5).
- `tools/doctor`: checks every prerequisite and resource limit from "Before the first session" and prints what is missing.
- `.gitattributes` (`* text=auto eol=lf`; images and fonts binary) and `.gitignore` (covering `.tools/`, build outputs, `node_modules/`, `frontend/reports/`, `content/licensed/*` except its README, keys, `.env` files, IDE folders, logs).
- Gradle workspace rooted at `backend/` with the wrapper `backend/gradlew`, a version catalogue and convention plugins in `backend/build-logic/` (§4.1, §6.1); `backend/gradlew -p backend fastTier` runs compilation, detekt, ktlintCheck, unit tests, short property-based tests (`hms.pbt.sequences`, default 1000) and architecture tests for every project, writing JUnit XML under each project's `build/test-results/`. Base package `hms` [P].
- pnpm workspace rooted at `frontend/`; `corepack pnpm --dir frontend run fast` runs ESLint, TypeScript type-checking, Vitest unit tests (JUnit XML in `frontend/reports/junit/`) and the localisation lint.
- `tools/ci/run <fast|merge|nightly|release> [--no-evidence]` with the fast tier and evidence records in `docs/program/evidence/ci/` (§19.1). Tiers not built yet fail closed as NOT-BUILT, naming the work package that builds them (§3.5; KA-003).
- `sh tools/hms repo check [--json]` for repository conventions.
- Licence policy, ORT configuration and curations encoding §4.3 (allowlist, denylist, the unmodified-component rules, build-only tool checks).
- Secret scanning in the fast tier (§19.1).
- Pull-request template [P] with the §3.6 fields.
- CODEOWNERS by module, with placeholder handles until DN-010 is answered (KA-004).
Exit criteria (evidence required):
- `tools/ci/run fast` green on an empty skeleton with stored evidence in `docs/program/evidence/ci/`, run in the WSL clone at the committed SHA (KA-001).
- `tools/doctor` output recorded in `docs/program/evidence/doctor/`.
- Every ADR file present (ADR-001…ADR-028).
- The hazard log parses in CI.
- The backlog renders all 234 feature IDs.
- §22.2: `STATUS.md`, `BACKLOG.md`, `KNOWN-ANOMALIES.md` and the hazard log are current, and a reviewer report exists (`docs/program/reviews/WP-0.1.md`) with no unresolved critical or major findings.
Hazards touched:
- None directly: no product behaviour is built (safety impact: none).
- The work package seeds the hazard log for H1–H15 and SI-01…SI-21 with planned controls only (KA-006).
[HUMAN] gates:
- None in §21 for WP-0.1.
- Human decisions this work package raised: DN-001 to DN-004 and DN-006 (closed on 18 October 2026); DN-005 and DN-011 ("Blocking now"); DN-007, DN-008, DN-010 and DN-012 (later).
- The automated review after this work package is not a human code review (§3.5).
