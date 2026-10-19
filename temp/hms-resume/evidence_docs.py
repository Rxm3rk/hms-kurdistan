"""Records the WP-0.1 evidence of record: DN-013, STATUS, WORK-PACKAGES state, COMMANDS checked column."""
import sys
from pathlib import Path

root = Path(sys.argv[1])


def rep(rel, old, new):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, (rel, old[:90])
    p.write_text(s.replace(old, new), encoding="utf-8", newline="\n")


# --- DN-013 -----------------------------------------------------------------------------------
D = "docs/program/DECISIONS-NEEDED.md"
rep(D, "Next to block (not \"now\"): DN-009 for reference-cell runs (WP-0.6 and the Phase 0 exit); DN-010 for pushing, pull requests and human review routing.",
    "Next to block (not \"now\"): DN-013 when WP-0.2 pulls the cell's images; DN-009 for reference-cell runs (WP-0.6 and the Phase 0 exit); DN-010 for pushing, pull requests and human review routing.")
p = root / D
s = p.read_text(encoding="utf-8").rstrip("\n") + """

## DN-013: Free disk on C: is below the guide

- **Status:** open
- **Blocks:** WP-0.2 (container images, the k3d cell's volumes, build caches)
- **Default in use:** continue. WP-0.2 records how much space the lite cell takes, and stops pulling images or creating volumes if C: falls below 15 GiB free [P], so the Windows system drive never fills.
- **Who decides:** the host owner.
- **Context:** the WSL2 virtual disk (`ext4.vhdx`, 8.9 GB on 18 October 2026) lives on C:, which has about 35 GiB free (86% used); inside WSL the virtual disk reports about 950 GiB, which is only its maximum size. `tools/doctor` therefore counts the Windows drive too and reports 36.4 GiB free on C: against its [P] guide of 50 GiB (OQ-094; `docs/program/evidence/doctor/2026-10-18-d3e14de.txt`). The only other drive, G:, has about 33 GB free, so moving the distribution there gains nothing.
- **Options:**
  1. Free space on C: (for example old downloads, temporary files, and, if Docker Desktop is no longer used, the leftover `docker-desktop` WSL distribution that `wsl -l -v` still lists).
  2. Add a larger drive and move the distribution to it (`wsl --manage Ubuntu-24.04 --move <folder>` in Windows).
  3. Continue with the default and watch the figure; the doctor reports it on every run.
"""
p.write_text(s, encoding="utf-8", newline="\n")

# --- WORK-PACKAGES: WP-0.1 handed over for review --------------------------------------------
rep("docs/program/WORK-PACKAGES.md",
    "| **in-progress**: built on the Windows checkout with the project-local toolchain (KA-002); gates of record run in the WSL clone (KA-001) |",
    "| **review**: fast tier green in the WSL clone at `d3e14de` (`evidence/ci/2026-10-18-fast-d3e14de.json`), doctor recorded (`evidence/doctor/2026-10-18-d3e14de.txt`); awaiting the automated review |")

# --- COMMANDS.md checked column ---------------------------------------------------------------
C = "docs/program/COMMANDS.md"
rep(C, "| `sh tools/doctor` | Checks the host against \"Before the first session\" and prints what is missing with the commands to fix it; never installs anything; exit 1 if a required item is missing | Windows (fails, as it should: Windows is not the build host) |",
    "| `sh tools/doctor` | Checks the host against \"Before the first session\" and prints what is missing with the commands to fix it; never installs anything; exit 1 if a required item is missing | Windows (fails, as it should: Windows is not the build host); WSL at `d3e14de` (fails on RAM and free disk only; recorded) |")
rep(C, "| `sh tools/doctor --json` | The same, with one JSON object as the last line (evidence) | Windows |",
    "| `sh tools/doctor --json` | The same, with one JSON object as the last line (evidence) | Windows; WSL at `d3e14de` (recorded) |")
rep(C, "| `sh tools/ci/run fast` | The fast tier: doctor (fast), repo check, Python unit tests, safety check, backlog check, backend `fastTier`, frontend `fast`, secret scan. Runs every step even after a failure, exits 1 if any failed, and writes `docs/program/evidence/ci/<date>-fast-<shortsha>[-dirty].json` and full logs under `build/ci-logs/<run_id>/` | Windows (with `--no-evidence`) |",
    "| `sh tools/ci/run fast` | The fast tier: doctor (fast), repo check, Python unit tests, safety check, backlog check, backend `fastTier`, frontend `fast`, secret scan. Runs every step even after a failure, exits 1 if any failed, and writes `docs/program/evidence/ci/<date>-fast-<shortsha>[-dirty].json` and full logs under `build/ci-logs/<run_id>/` | Windows (with `--no-evidence`); WSL at `d3e14de`, the record (`evidence/ci/2026-10-18-fast-d3e14de.json`) |")
rep(C, "```sh\nMSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && git fetch origin && git checkout --detach origin/wp/0.1-programme-bootstrap && sh tools/bootstrap && sh tools/ci/run fast'\n```\n",
    "```sh\nMSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && git fetch origin && git checkout --detach origin/wp/0.1-programme-bootstrap && sh tools/bootstrap && sh tools/ci/run fast'\n```\n\nChecked from Git Bash at `d3e14de`. Use `bash -lc` (a login shell): it puts rustup's `~/.cargo/bin` on PATH. A clone whose tracked files differ from the commit gives a `-dirty` record, which is never the gate; `git reset --hard` cleans a scratch clone.\n")
rep(C, "| `$PY -I -m unittest discover -s tools -t tools -p \"test_*.py\"` (every tools test: 389) | Windows |",
    "| `$PY -I -m unittest discover -s tools -t tools -p \"test_*.py\"` (every tools test: 392) | Windows; WSL (through `tools/ci/run fast`) |")

# --- STATUS.md ----------------------------------------------------------------------------------
S = root / "docs/program/STATUS.md"
S.write_text("""# STATUS (updated 2026-10-18 18:50 Asia/Baghdad)
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
""", encoding="utf-8", newline="\n")
print("ok")
