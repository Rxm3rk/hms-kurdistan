---
name: project-phase
description: "HMS build state — WP-0.1 DONE 19 Oct 2026 (09afa41, all 21 review findings resolved); WP-0.7 in progress on wp/0.7-design-system (worktree); WP-0.2 next on wp/0.2-environments; read docs/program/STATUS.md first"
metadata:
  node_type: memory
  type: project
  originSessionId: 6d6b022e-1898-4cd8-a306-06a4b2630a1e
  modified: 2026-10-18T15:49:55.779Z
---

Phase history:
- Research and planning finished in October 2026: BLUEPRINT.md v1.2.1 (master) and BLUEPRINT-KURDISTAN.md v1.1 (plan of record for Kurdistan). BUILD-PROMPT.md v1.0 (≈57,000 words) in the repo root.
- **18 Oct 2026: the user started the build** ("lets build this"). First commit `ed023b6 chore: import plan of record` on `main`; branch `wp/0.1-programme-bootstrap`.
- **18 Oct 2026, later:** WP-0.1 committed: `1b4415e` (bootstrap), `b24f94e` (bootstrap installs frontend packages), `d3e14de` (doctor counts C: behind the WSL2 disk), `adb631c` (evidence of record: fast tier PASS at d3e14de in the WSL clone, 972 tests; doctor recorded). WP-0.1 state: review (`docs/program/reviews/WP-0.1.md`, written by a separate reviewer session). Next: fix critical/major findings, then WP-0.2 branched from the unmerged WP-0.1 branch.
- **18 Oct 2026, evening (a7a profile):** the WP-0.1 review was relaunched after the limit cut it off (lead + 6 sub-reviewers; partial outputs recovered from their transcripts) and finished: `docs/program/reviews/WP-0.1.md` committed as `6ca3e3a`; 0 critical, 4 major (R-01 sign-off gate trusts self-made GPG keys; R-02 entry scripts not executable on Linux; R-03 tools/host/README says the human ran provisioning; R-04 CTRL-0014-4 drops SI-14's measured PPV), 17 minor. Fixing them on wp/0.1 with three parallel agents (safety / tooling / programme docs), then the lead sets exec bits, commits, fills each Resolution with its commit. WP-0.2 started on `wp/0.2-environments` (stacked): `a1d5fd6` WORM test + ADR-029 SeaweedFS 4.48 chosen (RustFS 1.0.3 alternative; versitygw v1.4.1 FAILS W06 shortened retention), `c1c2ea9` evidence dirty-flag fix, `051d083` CLI syntax fix + compile-all-tools test. New OQ-106/107 live on wp/0.2 only (wp/0.1 numbers new OQs from OQ-108). After fixes: rebase wp/0.2 onto wp/0.1.
- **19 Oct 2026, night (waybaba profile, user asleep):** WP-0.1 closed. Commits on wp/0.1: `05f159a` (review fixes R-01..R-21), `7f42564` (records of record at 05f159a: fast 1253 tests, merge/nightly NOT-BUILT, gates-bite 78 plants, spot check, doctor, licence), `a9d5725` (sign-off gate: 8 more bypasses fixed after an independent verification, 336 safety tests), `09afa41` (every Resolution filled; WP-0.1 `done`). `tools/ci/gates-bite/` now scripts the plant matrix (run from a copy, in a scratch clone `~/src/hms-plant`). ID ranges in STATUS: WP-0.2 DN-015..019, OQ-122..139, KA-014..024, HAZ-0028..29, ADR-030; WP-0.7 DN-020..039, OQ-140..159, KA-025..044, HAZ-0030..34. Branches stack; bring wp/0.1 changes into wp/0.2 and wp/0.7 by MERGE, never rebase (§3.6 stop-and-ask 6).
- Programme state lives in the repo: `docs/program/STATUS.md` (read it first in every session), WORK-PACKAGES.md, DECISIONS-NEEDED.md (DN-001…DN-013), OPEN-QUESTIONS.md (OQ-001…OQ-105), KNOWN-ANOMALIES.md, COMMANDS.md, evidence under `docs/program/evidence/`.

**Why:** BUILD-PROMPT.md §3 governs the work (stop-and-ask list, honesty rules, git rules); the user wants it run end to end at top quality.

**How to apply:**
- Commit locally after each verified slice; every commit must pass `sh tools/ci/run fast`; never push. Merging to main needs the merge tier to pass, which is NOT-BUILT until WP-1.12, so branches stack (DN-011 asks the user whether to relax this).
- Open user decisions at 18 Oct 2026: DN-005 (lite cell cannot show WP-0.2's 3-node failover), DN-011 (merge rule), DN-013 (C: ~35 GiB free, below the 50 GiB guide; stop pulling images below 15 GiB).
- Host: Windows 11 + WSL2 Ubuntu-24.04 (user `surface`), provisioned by `tools/host/provision-ubuntu.sh` at the user's instruction; `.wslconfig` 10 GB / 8 cores / 8 GB swap → lite cell only.
- Working model: edit in the Windows checkout (T3 Code binds it); gates of record run in the WSL clone `~/src/hospitalmanagementsystem` at a committed SHA via `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc '...'` (login shell, so rustup's ~/.cargo/bin is on PATH). A clone with modified tracked files gives a `-dirty` record: `git reset --hard && git clean -fd` it. Copy evidence back to the Windows checkout and commit there.
- Run frontend pnpm commands from `frontend/` (from the root, Corepack picks the wrong pnpm). `eval "$(sh tools/bootstrap env)"` sets JAVA_HOME, GRADLE_USER_HOME, COREPACK_HOME.
- Git identity is repo-local "Ahmad" with the previous profile's e-mail (DN-008, to confirm).
- Keep helper scripts outside the repo, in %TEMP% ([[pdf-build-tooling]], [[resuming-killed-work]]). See [[slow-github-downloads]].

**PAUSED 19 Oct ~13:45: the user said "please stop everything for now".**
- Stopped: all child threads and prototype builders (task_cancel), the switch-back cron, every leftover Gradle, test and tsc process, the :5200 preview and the WSL keep-alive. WSL was shut down (the k3d-hms-registry container stops with it; its data is kept).
- Already disabled by the user: the heartbeat scheduled task.
- Left running on purpose: the Windows "HMS auto-save" task (10-minute saves and upload; last 13:37).
- Don't restart anything until the user asks.

Resume points:
- **WP-0.2 (wp02):** still at 889beec, with S0+S1+S2 uncommitted (46 files). The commit workflow wf_24ea1940-040 was killed mid-run: check `git diff` for partial DN-017 policy edits before re-running. The decisions are in `%TEMP%\hms-wp02\dn017-decision.md`.
- **WP-0.7:** S6 committed (68d222c). S7 (E2E) has not been built; the script is `%TEMP%\hms-wp07\wf-s6-commit-s7.js` (the S6 step is now done).
- **WP-0.3 (A7a):** libraries committed (7e1cfe7). context, quantity and arch-rules are uncommitted (44 files).
- **WP-0.5:** nothing committed since 09afa41 (53 files); S1 is pending a fast tier. Move it to Ahmad@ when resuming.
- **WP-0.8 (mi):** S1–S3 committed (7276a39); S7 templates are next (43 files uncommitted).
- **Prototype ([[boss-demo]]):** all 28 screens are built and render.
  - Still to do: 1 tsc error in reports; KPI tiles overflow on dashboard, cashier and inventory; duplicate key warning in orders; a 404 on home; checking the chart via a direct link; the README demo script.
  - The screenshots and the contact sheet are in `%TEMP%\hms-demo\all\` and `all-screens.jpg`.
