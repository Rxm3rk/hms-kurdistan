# Commands

The exact commands for working in this repository (BUILD-PROMPT §3.1). Every command below was run on 18 October 2026; the **Checked** column says where. Run commands from the repository root unless a block says otherwise. Each tool's `--help` gives the full options.

## Hosts and checkouts

| Checkout | Where | Used for | Shell |
|---|---|---|---|
| Windows checkout | `C:\Users\Surface\.t3\projects\hospitalmanagementsystem` (Git Bash: `/c/Users/Surface/.t3/projects/hospitalmanagementsystem`) | Editing and the inner loop. Its runs are labelled "Windows host" and are never evidence of record (KA-001) | Git Bash |
| WSL clone | `~/src/hospitalmanagementsystem` in the `Ubuntu-24.04` distribution | The gates of record, at a committed SHA | bash |

The project venv's Python is `.tools/venv/Scripts/python.exe` on Windows and `.tools/venv/bin/python` on Linux; `PY` below stands for it. From Git Bash, run a command in the WSL clone with `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc '<command>'` (the variable stops Git Bash rewriting Linux paths).

## 1. Prepare a host (once per machine)

| Command | What it does | Checked |
|---|---|---|
| `sudo bash tools/host/provision-ubuntu.sh` | Ubuntu 24.04 (WSL2) only, as root: Docker Engine, kubectl, Helm, k3d, OpenJDK 25, Node.js 24, Python 3.12 tooling, Rust and the Tauri 2 Linux prerequisites, pinned and checksum-verified. Idempotent | WSL, twice (the second run changed nothing) |
| `mkdir -p ~/src && git clone /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem ~/src/hospitalmanagementsystem && git -C ~/src/hospitalmanagementsystem config core.autocrlf false` | Creates the WSL clone in the Linux file system (never under `/mnt/c`) | WSL |
| `sh tools/bootstrap` | Fetches the project-local toolchain into `.tools/` (git-ignored): JDK 25, the Gradle distribution, gitleaks, the venv, and the frontend packages (`frontend/node_modules`, installed from the lockfile, with Corepack's cache in `.tools/corepack` and the pnpm store in `.tools/pnpm-store`). Every download is checked against its vendor's SHA-256 or the lockfile's sha512; anything already present and verified is reused | Windows (reused everything, 1.5 s, before the frontend step existed); WSL (fetched everything, 7.5 min) |
| `sh tools/bootstrap --gradle-mirror https://mirrors.aliyun.com/gradle/distributions/v9.8.1/` | The same, fetching the Gradle zip from a mirror because services.gradle.org is slow from this network; the zip is still verified against the official checksum | WSL |
| `sh tools/bootstrap jdk` (or `gradle`, `gitleaks`, `venv`, `frontend`) | One step only. `frontend` runs `corepack pnpm install --frozen-lockfile` in `frontend/` | Windows (each step on its own; `frontend` reinstalled `node_modules` in 20 s) |
| `eval "$(sh tools/bootstrap env)"` | Sets `JAVA_HOME`, `GRADLE_USER_HOME`, `COREPACK_HOME` and `PATH` for the project-local toolchain in the current shell. Needed before any Gradle or pnpm command | Windows |
| `sh tools/bootstrap requirements-lock` | Regenerates `tools/requirements.txt` with hashes from `tools/requirements.in` through the PyPI JSON API | Windows (reproduced the committed file byte for byte) |
| `sh tools/doctor` | Checks the host against "Before the first session" and prints what is missing with the commands to fix it; never installs anything; exit 1 if a required item is missing | Windows (fails, as it should: Windows is not the build host) |
| `sh tools/doctor --json` | The same, with one JSON object as the last line (evidence) | Windows |
| `sh tools/doctor --tier fast` | Only what the fast tier needs: JDK 25, Node.js 24, pnpm through Corepack, the venv, gitleaks | Windows (through `tools/ci/run fast`) |

## 2. CI tiers (`tools/ci/run`, BUILD-PROMPT §19.1)

| Command | What it does | Checked |
|---|---|---|
| `sh tools/ci/run fast` | The fast tier: doctor (fast), repo check, Python unit tests, safety check, backlog check, backend `fastTier`, frontend `fast`, secret scan. Runs every step even after a failure, exits 1 if any failed, and writes `docs/program/evidence/ci/<date>-fast-<shortsha>[-dirty].json` and full logs under `build/ci-logs/<run_id>/` | Windows (with `--no-evidence`) |
| `sh tools/ci/run fast --no-evidence` | The same without the evidence record | Windows |
| `sh tools/ci/run <tier> --list` | Lists a tier's steps, and for each step not built yet the work package that builds it | Windows (all four tiers) |
| `sh tools/ci/run fast --only safety-check,backlog-check --no-evidence` | Runs only the named steps. The result is PARTIAL (exit 3), never a gate result | Windows |
| `sh tools/ci/run merge --no-evidence` | The merge tier: the fast steps plus 15 steps not built yet, each NOT-BUILT and counted as a failure (fail closed, KA-003) | Windows (FAIL as expected) |
| `sh tools/ci/run nightly --no-evidence`, `sh tools/ci/run release --no-evidence` | The nightly and release tiers, failing closed the same way | Windows (FAIL as expected) |

**The gate of record** runs in the WSL clone at a committed SHA (KA-001). From Git Bash:

```sh
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && git fetch origin && git checkout --detach origin/wp/0.1-programme-bootstrap && sh tools/bootstrap && sh tools/ci/run fast'
```

## 3. Programme checks, one at a time

| Command | What it checks | Checked |
|---|---|---|
| `sh tools/hms repo check` (add `--json` for evidence) | No CRLF outside the plan of record; the programme control files exist; every ADR follows template B.1, the ADR numbers have no gap and the index links each one; no registered tenant identifier in source or configuration; branch names (§3.6); "Blocking now" ≤10 items; `STATUS.md` ≤150 lines | Windows |
| `sh tools/hms safety check` (add `--json`) | The hazard log against its schema; H1–H15 and SI-01…SI-21 covered; control states consistent; feature IDs exist in the backlog; every filled approval field has a human sign-off record (§3.5) | Windows |
| `sh tools/hms backlog check` (add `--json`) | `backlog.yaml` against Appendix A (234 IDs), `BACKLOG.md` up to date, the A.18 totals | Windows |
| `sh tools/hms licence check --pnpm <file> [--scope build-only]` (or `--sbom <cyclonedx.json>`) | Applies `tools/licence/policy.yaml`. Denied, excluded and unmapped licences fail | Windows (see below) |

The frontend licence check, run from `frontend/` (lists written to the git-ignored `build/`):

```sh
cd frontend
corepack pnpm --filter @hms/i18n licenses list --prod --json > ../build/licences-shipped.json   # what ships today
corepack pnpm -r licenses list --json > ../build/licences-all.json                             # every dependency
cd ..
sh tools/hms licence check --pnpm build/licences-shipped.json                    # PASS: 2 components, shipped scope
sh tools/hms licence check --pnpm build/licences-all.json --scope build-only     # PASS: 124 components, build-only scope
```

Only `@hms/i18n` ships today; the ESLint plugin and every development dependency are build-only (§4.3 scope rule). Add each app to the first command's `--filter` as it is built. Do not use `licenses list --prod` at the workspace root: it lists nothing, because the root has only development dependencies.

## 4. Tests and builds per part

**Python programme tools** (unittest, stdlib plus PyYAML and jsonschema):

| Command | Checked |
|---|---|
| `$PY -I -m unittest discover -s tools -t tools -p "test_*.py"` (every tools test: 389) | Windows |
| `$PY -I -m unittest discover -s tools/hmstools/<area>/tests -t tools` (one package: `backlog`, `bootstrap`, `ci`, `doctor`, `licence`, `repo`, `safety`) | Windows (`backlog`, `doctor`, `licence`, `repo`) |

**Backend** (Gradle; first `eval "$(sh tools/bootstrap env)"`):

| Command | What it does | Checked |
|---|---|---|
| `backend/gradlew -p backend fastTier` | Compiles every source set; detekt; ktlint; unit and architecture tests (`test`); property tests (`propertyTest`, 1,000 sequences); checks each project ran its `ArchitectureTest` | Windows |
| `backend/gradlew -p backend fastTier -Phms.pbt.sequences=1000000` | The same with 10⁶ sequences per property (nightly size) | Windows (`:platform:testing:propertyTest`: 1,000,000 iterations, 5 s) |
| `backend/gradlew -p backend test` / `propertyTest` / `detekt` / `ktlintCheck` | One gate across every project | Windows (through `fastTier`) |
| `backend/gradlew -p backend :platform:arch-rules:test` | One project's tests | Windows |
| `backend/gradlew -p backend ktlintFormat` | Rewrites Kotlin files to the ktlint style; review the diff before committing | not run (it changes files) |

JUnit XML lands in each project's `build/test-results/<task>/`. `tools/ci/run` runs the backend with `-Phms.pbt.sequences=1000 --no-build-cache` after deleting old results, so every count comes from that run.

**Frontend** (pnpm through Corepack, after `eval "$(sh tools/bootstrap env)"` so that Corepack uses the project-local cache; **run from `frontend/`**: Corepack picks the pnpm version from the `package.json` in the current directory, and from the repository root `corepack pnpm --dir frontend ...` starts the wrong pnpm and stops with `ERR_PNPM_BAD_PM_VERSION`):

| Command (in `frontend/`) | What it does | Checked |
|---|---|---|
| `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install --frozen-lockfile` | Installs exactly the lockfile (what `sh tools/bootstrap frontend` runs) | Windows |
| `corepack pnpm run fast` | ESLint, the CSS check, type-checking, the Vitest suites (JUnit XML in `frontend/reports/junit/`) and the localisation lint; stops at the first failure | Windows (514 tests) |
| `corepack pnpm run lint`, `lint:es`, `lint:css`, `typecheck`, `test`, `i18n:lint` | One part of `fast` | Windows (`lint:es`, `lint:css`; the rest through `fast`) |
| `corepack pnpm run format:check` | Prettier check (not part of `fast`) | Windows |

**Secret scan** (gitleaks 8.30.1 from `.tools/bin/`, configuration `.gitleaks.toml`):

| Command | Checked |
|---|---|
| `sh tools/ci/run fast --only secret-scan --no-evidence` (history and working tree, redacted) | Windows |
| `.tools/bin/gitleaks git --config .gitleaks.toml --redact --no-banner --log-opts="--full-history --branches --tags --remotes" .` (history only; `gitleaks.exe` on Windows) | Windows |

## 5. Backlog

| Command | What it does | Checked |
|---|---|---|
| `sh tools/hms backlog generate` | Rewrites `docs/program/backlog.yaml` from Appendix A, keeping the hand-edited fields (`status`, `work_packages`, `tests`, `hazards`, `notes`); refuses if a feature disappears or an unknown field is present | Windows (byte-identical output) |
| `sh tools/hms backlog render` | Rewrites `docs/program/BACKLOG.md` from `backlog.yaml` | Windows (byte-identical output) |
| `sh tools/hms backlog spot-check --seed 20261018 --count 10` | Prints ten seeded random Appendix A rows beside their parsed records | Windows |

## 6. Reproducing the evidence

| Evidence | How to reproduce it |
|---|---|
| `docs/program/evidence/ci/<date>-fast-<shortsha>.json` | In the WSL clone at that SHA: `git checkout --detach <sha> && sh tools/bootstrap && sh tools/ci/run fast` |
| `docs/program/evidence/doctor/<date>-<shortsha>.txt` and `.json` | In the WSL clone at that SHA: `sh tools/doctor > <file>.txt; sh tools/doctor --json \| tail -n 1 > <file>.json` (exit 1 is expected while an item is missing; the record says which) |
| `docs/program/evidence/backlog/2026-10-18-spot-check.md` | `sh tools/hms backlog spot-check --seed 20261018 --count 10`, then compare each row with BUILD-PROMPT.md by hand |
| `docs/program/evidence/ci/2026-10-18-gates-bite.md` | Plant each listed violation, run the listed command, check that it fails, remove the violation, check that it passes; the file gives each violation and command |
