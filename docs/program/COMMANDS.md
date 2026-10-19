# Commands

The exact commands for working in this repository (BUILD-PROMPT §3.1). Every command below was run, on 18 October 2026 or later, except those whose **Checked** cell says "not run"; the **Checked** column says where each was run. "Windows" is the Windows checkout (Git Bash), "WSL" the Linux build host or its clone. "WSL at `05f159a`" names a run on 19 October in the WSL clone at `05f159a`, the commit that resolves the WP-0.1 review findings (`docs/program/reviews/WP-0.1.md`), on a clean tree (WSL build host, no cell), with its record stored under `docs/program/evidence/`: these are the records of record. A WSL cell that says its run has no stored record is not a record of record. A Windows cell that says "19 October" names a run on the Windows checkout's uncommitted tree before that commit, of the command as this file now describes it. The 18 October files that the review cites (the Windows gates-bite and spot-check runs, and the WSL records at `d3e14de`, which ran earlier versions of the tools) are kept as earlier runs and are not the record for the commands as they stand. A row checked on Windows only has not been run as written on the Linux build host (rows run there through `tools/ci/run fast` say so), and only a WSL run at a committed SHA with a stored record under `docs/program/evidence/` is evidence of record (KA-001). Run commands from the repository root unless a block says otherwise. Each tool's `--help` gives the full options.

## Hosts and checkouts

| Checkout | Where | Used for | Shell |
|---|---|---|---|
| Windows checkout | `C:\Users\Surface\.t3\projects\hospitalmanagementsystem` (Git Bash: `/c/Users/Surface/.t3/projects/hospitalmanagementsystem`) | Editing and the inner loop. Its runs are labelled "Windows host" and are never evidence of record (KA-001) | Git Bash |
| WSL clone | `~/src/hospitalmanagementsystem` in the `Ubuntu-24.04` distribution | The gates of record, at a committed SHA | bash |

The project venv's Python is `.tools/venv/Scripts/python.exe` on Windows and `.tools/venv/bin/python` on Linux; `PY` below stands for it. From Git Bash, run a command in the WSL clone with `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc '<command>'` (the variable stops Git Bash rewriting Linux paths).

Scripts are run through `sh` (or `bash`), as `tools/ci/run` does, so a command works whatever file mode a checkout gives the script. Git stores the entry scripts (`tools/bootstrap`, `tools/doctor`, `tools/hms`, `tools/ci/run`, `tools/host/provision-ubuntu.sh`) and `backend/gradlew` as executable (review finding R-02), and `sh tools/hms repo check` fails if one loses the bit or leaves git's index. Before that they were stored without the executable bit, and the WP-0.1 review found `backend/gradlew`, `tools/ci/run` and `tools/doctor`, run directly, failing with `Permission denied` on the Linux build host at `adb631c`.

## 1. Prepare a host (once per machine)

| Command | What it does | Checked |
|---|---|---|
| `sudo bash tools/host/provision-ubuntu.sh` | Ubuntu 24.04 (WSL2) only, as root: Docker Engine, kubectl, Helm, k3d, OpenJDK 25, Node.js 24, Python 3.12 tooling, Rust and the Tauri 2 Linux prerequisites. The build does not use this system OpenJDK: `tools/ci/run` and `tools/bootstrap env` put the pinned JDK in `.tools/` first, and `tools/doctor` passes only the pinned release (ADR-002). Helm, k3d and Node.js are pinned and checked against a SHA-256 before install; kubectl follows its 1.37 apt channel; the other packages are whatever the apt repositories serve that day. apt checks every package against its repository's key, but the Docker, Kubernetes and Corretto keys are themselves trusted on TLS alone; `rustup-init.sh` is fetched over TLS and run unverified, installing that day's stable Rust; `apt-get upgrade` upgrades the whole distribution (`tools/host/README.md`; DN-001 lists every system-wide change). Idempotent | WSL, twice (the second run changed nothing; no stored record) |
| `mkdir -p ~/src && git clone /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem ~/src/hospitalmanagementsystem && git -C ~/src/hospitalmanagementsystem config core.autocrlf false` | Creates the WSL clone in the Linux file system (never under `/mnt/c`) | WSL |
| `sh tools/bootstrap` | Fetches the project-local toolchain into `.tools/` (git-ignored): the pinned JDK (Eclipse Temurin 25.0.4.1+1, ADR-002, checked against the SHA-256 recorded in `tools/hmstools/bootstrap/steps.py`, with no other release or vendor as a fallback), the Gradle distribution, gitleaks, the venv, and the frontend packages (`frontend/node_modules`, installed from the lockfile, with Corepack's cache in `.tools/corepack` and the pnpm store in `.tools/pnpm-store`). Every other download is checked against its vendor's SHA-256 or the lockfile's sha512; anything already present and verified is reused | Windows (reused everything, 1.5 s, before the frontend step existed; on 19 October `sh tools/bootstrap jdk` reused the pinned JDK, 1 s); WSL clone at `05f159a`, no stored record (so not a record of record), before the records of record: reused the pinned JDK (Temurin 25.0.4.1+1), Gradle, gitleaks and the venv and installed the frontend packages from the lockfile (its log is not stored under `docs/program/evidence/`); the gates-bite record at `05f159a` (`evidence/ci/2026-10-19-gates-bite-05f159a.md`) records the same command in its scratch clone, exit 0 in 2 s. The first WSL run (fetched everything, 7.5 min) was the version before the pin, which fetched whatever JDK 25 Adoptium's API called latest, with Amazon Corretto as a fallback (review finding R-14); the run that first fetched the pinned JDK on the build host has no stored record |
| `sh tools/bootstrap --gradle-mirror https://mirrors.aliyun.com/gradle/distributions/v9.8.1/` | The same, fetching the Gradle zip from a mirror because services.gradle.org is slow from this network; the zip is still verified against the official checksum. A mirror is not an official source: each use is a §3.7 deviation, recorded in DN-006 | WSL |
| `sh tools/bootstrap jdk` (or `gradle`, `gitleaks`, `venv`, `frontend`) | One step only. `frontend` runs `corepack pnpm install --frozen-lockfile` in `frontend/` | Windows (each step on its own; `frontend` reinstalled `node_modules` in 20 s) |
| `eval "$(sh tools/bootstrap env)"` | Sets `JAVA_HOME`, `GRADLE_USER_HOME`, `COREPACK_HOME` and `PATH` for the project-local toolchain in the current shell. Needed before any Gradle or pnpm command | Windows |
| `sh tools/bootstrap requirements-lock` | Regenerates `tools/requirements.txt` with hashes from `tools/requirements.in` through the PyPI JSON API | Windows (reproduced the committed file byte for byte) |
| `sh tools/doctor` | Checks the host against "Before the first session" and prints what is missing with the commands to fix it; never installs anything; exit 1 if a required item is missing | Windows (fails, as it should: Windows is not the build host); WSL at `05f159a` (`evidence/doctor/2026-10-19-doctor-05f159a.txt`: FAIL, 18 OK, 2 required missing: RAM, 9.7 GiB, and free disk, 26.2 GiB on C:, which holds the WSL2 disk) |
| `sh tools/doctor --json` | The same, with one JSON object as the last line (evidence) | Windows; WSL at `05f159a` (`evidence/doctor/2026-10-19-doctor-05f159a.json`) |
| `sh tools/doctor --tier fast` | Only what the fast tier needs: the pinned JDK 25 (Temurin 25.0.4.1+1), Node.js 24, pnpm through Corepack, the venv, gitleaks | Windows (through `tools/ci/run fast`; on 19 October on its own, PASS with the pinned JDK); WSL at `05f159a` through `tools/ci/run fast` (step `doctor-fast`, 5 of 5 OK; `evidence/ci/2026-10-19-fast-05f159a.json`, whose `java_identity` names Temurin-25.0.4.1+1, `pinned: true`) |

## 2. CI tiers (`tools/ci/run`, BUILD-PROMPT §19.1)

| Command | What it does | Checked |
|---|---|---|
| `sh tools/ci/run fast` | The fast tier: doctor (fast), repo check, Python unit tests, safety check, backlog check, backend `fastTier`, frontend `fast`, secret scan. Runs every step even after a failure, exits 1 if any failed, and writes `docs/program/evidence/ci/<date>-fast-<shortsha>[-dirty].json` and full logs under `build/ci-logs/<run_id>/` | Windows (with `--no-evidence`); WSL at `05f159a`, the record (`evidence/ci/2026-10-19-fast-05f159a.json`: PASS, 8 of 8 steps, 1253 tests, 0 failures) |
| `sh tools/ci/run fast --no-evidence` | The same without the evidence record | Windows |
| `sh tools/ci/run <tier> --list` | Lists a tier's steps, and for each step not built yet the work package that builds it | Windows (all four tiers) |
| `sh tools/ci/run fast --only safety-check,backlog-check --no-evidence` | Runs only the named steps. The result is PARTIAL (exit 3), never a gate result | Windows |
| `sh tools/ci/run merge --no-evidence` | The merge tier: the fast steps plus 15 steps not built yet, each NOT-BUILT and counted as a failure (fail closed, KA-003) | Windows (FAIL as expected); WSL at `05f159a` without `--no-evidence`, the record (`evidence/ci/2026-10-19-merge-05f159a.json`: FAIL, 8 passed, 0 failed, 15 NOT-BUILT) |
| `sh tools/ci/run nightly --no-evidence`, `sh tools/ci/run release --no-evidence` | The nightly and release tiers, failing closed the same way | Windows (FAIL as expected); the nightly tier also WSL at `05f159a` without `--no-evidence`, the record (`evidence/ci/2026-10-19-nightly-05f159a.json`: FAIL, 8 passed, 0 failed, 12 NOT-BUILT); the release tier has no WSL run |

**The gate of record** runs in the WSL clone at a committed SHA (KA-001). From Git Bash:

```sh
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && git fetch origin && git checkout --detach origin/wp/0.1-programme-bootstrap && sh tools/bootstrap && sh tools/ci/run fast'
```

Checked from Git Bash at `d3e14de`. Use `bash -lc` (a login shell): it puts rustup's `~/.cargo/bin` on PATH. A clone whose tracked files differ from the commit gives a `-dirty` record, which is never the gate; `git reset --hard` cleans a scratch clone.

## 3. Programme checks, one at a time

| Command | What it checks | Checked |
|---|---|---|
| `sh tools/hms repo check` (add `--json` for evidence) | No CRLF outside the plan of record; the programme control files exist; every ADR follows template B.1, the ADR numbers have no gap and the index links each one; no registered tenant identifier in source or configuration; branch names (§3.6); "Blocking now" ≤10 items; `STATUS.md` ≤150 lines; git's index holds the entry scripts and `backend/gradlew` and stores them as executable (100755) | Windows (19 October); WSL at `05f159a` with `--json` through `tools/ci/run fast` (the record, `evidence/ci/2026-10-19-fast-05f159a.json`: PASS, `executables_checked=6`, 0 errors, 4 warnings); the gates-bite record at `05f159a` shows it failing on 11 of 11 plants |
| `sh tools/hms safety check` (add `--json`) | The hazard log against its schema; H1–H15 and SI-01…SI-21 covered; control states consistent; feature IDs exist in the backlog; every filled approval field has a matching human sign-off record, committed in commits signed by a key that `docs/safety/signoffs/allowed-signers.yaml` lists, as far as that list's history allows (§3.5). While the list holds no key, every run warns that no sign-off record can authorise any approval field (KA-011) | Windows (19 October); WSL at `05f159a` with `--json` through `tools/ci/run fast` (the record: PASS, `hazards=27`, `controls=193`, `allowed_signers=0`, 0 errors, 3 warnings); the gates-bite record at `05f159a` has 46 plants on it, 42 failing and the 4 expected to pass passing |
| `sh tools/hms backlog check` (add `--json`) | `backlog.yaml` against Appendix A (234 IDs), `BACKLOG.md` up to date, the A.18 totals, and each row's `hazards` against the `features` lists of `docs/safety/hazard-log.yaml` | Windows (19 October); WSL at `05f159a` with `--json` through `tools/ci/run fast` (the record: PASS, `rows=236`, `features_with_hazards=101`, `hazard_links=237`, 0 errors, 1 warning); the gates-bite record at `05f159a` shows it failing on 5 of 5 plants |
| `sh tools/hms licence check --pnpm <file> [--scope build-only]` (or `--sbom <cyclonedx.json>`) | Applies `tools/licence/policy.yaml`. Denied, excluded and unmapped licences fail, and so does a conditional licence until `tools/licence/register.yaml` has an entry that records it as unmodified, under the rule and licence the policy applies, and a register entry that does not follow the fields in the register's header | Windows (see below; on 19 October both frontend lists again, the same counts); WSL at `05f159a` with `--json`, both frontend lists (`evidence/licence/2026-10-19-licence-05f159a.txt` and its two inputs: PASS, 2 components in the shipped scope, 124 build-only, exit 0 each) |

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
| `$PY -I -m unittest discover -s tools -t tools -p "test_*.py"` (every tools test; 673 at `05f159a`) | Windows; WSL at `05f159a` through `tools/ci/run fast` (673 tests, 0 failures, the record) |
| `$PY -I -m unittest discover -s tools/hmstools/<area>/tests -t tools` (one package: `backlog`, `bootstrap`, `ci`, `doctor`, `licence`, `repo`, `safety`) | Windows (`backlog`, `doctor`, `licence`, `repo`) |

**Backend** (Gradle; first `eval "$(sh tools/bootstrap env)"`):

| Command | What it does | Checked |
|---|---|---|
| `sh backend/gradlew -p backend fastTier` | Compiles every source set; detekt; ktlint; unit and architecture tests (`test`); property tests (`propertyTest`, 1,000 sequences); checks each project ran its `ArchitectureTest` | Windows; WSL at `05f159a` through `tools/ci/run fast` (with `-Phms.pbt.sequences=1000 --no-build-cache`; 66 tests, 0 failures), the record (`evidence/ci/2026-10-19-fast-05f159a.json`) |
| `sh backend/gradlew -p backend fastTier -Phms.pbt.sequences=1000000` | The same with 10⁶ sequences per property (nightly size) | Windows (`:platform:testing:propertyTest`: 1,000,000 iterations, 5 s; no stored record); WSL at `adb631c` by the automated review, with `--no-build-cache` (review report section 2; no stored record) |
| `sh backend/gradlew -p backend test` / `propertyTest` / `detekt` / `ktlintCheck` | One gate across every project | Windows (through `fastTier`); WSL at `05f159a` through `fastTier` in `tools/ci/run fast` (the record) |
| `sh backend/gradlew -p backend :platform:arch-rules:test` | One project's tests | Windows |
| `sh backend/gradlew -p backend ktlintFormat` | Rewrites Kotlin files to the ktlint style; review the diff before committing | not run (it changes files) |

On Windows these rows were run as `backend/gradlew …`, which Git Bash runs with the same `sh`. On the Linux build host that direct form failed with `Permission denied` at `adb631c` (review finding R-02), because git then stored the wrapper without its executable bit; the `sh` form does not depend on the bit.

JUnit XML lands in each project's `build/test-results/<task>/`. `tools/ci/run` runs the backend with `-Phms.pbt.sequences=1000 --no-build-cache` after deleting old results, so every count comes from that run.

**Frontend** (pnpm through Corepack, after `eval "$(sh tools/bootstrap env)"` so that Corepack uses the project-local cache; **run from `frontend/`**: Corepack picks the pnpm version from the `package.json` in the current directory, and from the repository root `corepack pnpm --dir frontend ...` starts the wrong pnpm and stops with `ERR_PNPM_BAD_PM_VERSION`):

| Command (in `frontend/`) | What it does | Checked |
|---|---|---|
| `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install --frozen-lockfile` | Installs exactly the lockfile (what `sh tools/bootstrap frontend` runs) | Windows |
| `corepack pnpm run fast` | ESLint, the CSS check, type-checking, the Vitest suites (JUnit XML in `frontend/reports/junit/`) and the localisation lint; stops at the first failure | Windows (514 tests); WSL at `05f159a` through `tools/ci/run fast` (514 tests, 0 failures, the record) |
| `corepack pnpm run lint`, `lint:es`, `lint:css`, `typecheck`, `test`, `i18n:lint` | One part of `fast` | Windows (`lint:es`, `lint:css`; the rest through `fast`); WSL at `05f159a` through `fast` in `tools/ci/run fast` (`lint`, `typecheck`, `test`, `i18n:lint`; the record) |
| `corepack pnpm run format:check` | Prettier check (not part of `fast`) | Windows |

**Secret scan** (gitleaks 8.30.1 from `.tools/bin/`, configuration `.gitleaks.toml`):

| Command | Checked |
|---|---|
| `sh tools/ci/run fast --only secret-scan --no-evidence` (history and working tree, redacted) | Windows; on WSL the same `secret-scan` step ran at `05f159a` inside the full `tools/ci/run fast` (the record: 0 findings in the history and the working tree), and this command as written ran among the clean runs of the gates-bite record at `05f159a` (PASS) |
| `.tools/bin/gitleaks git --config .gitleaks.toml --redact --no-banner --log-opts="--full-history --branches --tags --remotes" .` (history only; `gitleaks.exe` on Windows) | Windows |

## 5. Backlog

| Command | What it does | Checked |
|---|---|---|
| `sh tools/hms backlog generate` | Rewrites `docs/program/backlog.yaml` from Appendix A and §21, with each feature's `hazards` derived from `docs/safety/hazard-log.yaml`, keeping the hand-edited fields (`status`, `work_packages`, `tests`, `notes`); refuses if a feature disappears, the hazard log names a feature ID that Appendix A does not hold, or an unknown field is present | Windows (byte-identical output) |
| `sh tools/hms backlog render` | Derives each row's `hazards` from `docs/safety/hazard-log.yaml` again (rewriting `backlog.yaml` only if one changed), then rewrites `docs/program/BACKLOG.md` from `backlog.yaml` | Windows (byte-identical output) |
| `sh tools/hms backlog spot-check --seed 20261018 --count 10` | Prints ten seeded random Appendix A rows beside their parsed records | Windows; WSL at `05f159a` (exit 0 as reported by the lead who ran it, not printed in the stored output; the record `evidence/backlog/2026-10-19-spot-check-05f159a.md`) |

## 6. Reproducing the evidence

| Evidence | How to reproduce it |
|---|---|
| `docs/program/evidence/ci/<date>-fast-<shortsha>.json` | In the WSL clone at that SHA: `git checkout --detach <sha> && sh tools/bootstrap && sh tools/ci/run fast`. The record at `05f159a` is `2026-10-19-fast-05f159a.json` (PASS, 8 of 8 steps, 1253 tests) |
| `docs/program/evidence/ci/<date>-merge-<shortsha>.json` | The same with `sh tools/ci/run merge`. It exits 1 while steps are NOT-BUILT (KA-003). The record at `05f159a` is `2026-10-19-merge-05f159a.json` (FAIL: the 8 fast steps pass, 15 steps NOT-BUILT) |
| `docs/program/evidence/ci/<date>-nightly-<shortsha>.json` | The same with `sh tools/ci/run nightly`, at the last commit of every session that changes code (§19.1). It exits 1 while steps are NOT-BUILT (KA-003). The record at `05f159a` is `2026-10-19-nightly-05f159a.json` (FAIL: the 8 fast steps pass, 12 steps NOT-BUILT) |
| `docs/program/evidence/doctor/<date>-doctor-<shortsha>.txt` and `.json` | In the WSL clone at that SHA: `sh tools/doctor > <file>.txt; sh tools/doctor --json \| tail -n 1 > <file>.json` (exit 1 is expected while an item is missing; the record says which). The records at `05f159a` are `2026-10-19-doctor-05f159a.txt` and `.json` (FAIL: 18 OK, RAM and free disk missing). The earlier records at `d3e14de` are named `2026-10-18-d3e14de.*`, without the test name that `evidence/README.md` asks for; they keep that name because the review cites them |
| `docs/program/evidence/backlog/<date>-spot-check-<shortsha>.md` | In the WSL clone at that SHA: `sh tools/hms backlog spot-check --seed 20261018 --count 10`, then compare each row with BUILD-PROMPT.md, §21 and the hazard log by hand, against the committed files. The record at `05f159a` is `2026-10-19-spot-check-05f159a.md` (ten of ten match; a cross-check of all 236 rows, 0 mismatches). The earlier `2026-10-18-spot-check.md` is a Windows run before the first commit, not evidence of record (review finding R-06); it stays because the review cites it |
| `docs/program/evidence/ci/<date>-gates-bite-<shortsha>.md` | The record at `05f159a` is `2026-10-19-gates-bite-05f159a.md` (WSL build host, no cell: 78 plants, 73 FAIL and the 5 expected to pass passing; 11 of 11 clean runs PASS; the fast tier on the clean tree PASS). The earlier `2026-10-18-gates-bite.md` was planted by hand on the Windows checkout before the first commit, not evidence of record (review finding R-06); it stays because the review cites it. The record comes from `tools/ci/gates-bite/gates-bite.sh` in a scratch clone on the WSL build host: `sh <copy>/tools/ci/gates-bite/gates-bite.sh --clone <scratch clone> --out /tmp <sha>`, with the copy of the scripts taken from the commit under test (`tools/ci/gates-bite/README.md`, "How to run it"); it writes `<date>-gates-bite-<shortsha>.md`, which is copied to `docs/program/evidence/ci/` |
| `docs/program/evidence/licence/<date>-licence-<shortsha>.txt` and its inputs `-shipped-input.json` and `-all-input.json` | In the WSL clone at that SHA, after `sh tools/bootstrap`: the two `licenses list` commands of section 3, then `sh tools/hms licence check --pnpm build/licences-shipped.json --json` and `sh tools/hms licence check --pnpm build/licences-all.json --scope build-only --json`; store both outputs in the `.txt` and the two lists beside it. The record at `05f159a` is `2026-10-19-licence-05f159a.txt` (PASS: 2 components shipped, 124 build-only) |
