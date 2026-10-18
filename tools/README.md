# Programme tools

Python packages under `tools/hmstools/<area>/`, run as `sh tools/hms <area> <args>` with the project
venv (`.tools/venv`). Stdlib plus PyYAML and jsonschema only. Every `check` follows the CheckResult
contract in `tools/hmstools/common.py`: exit 0 pass, 1 fail, 2 usage or environment error; with `--json`
the last stdout line is one JSON object `{check, ok, counts, errors, warnings}`.

| Command | What it does |
|---|---|
| `sh tools/doctor [--tier fast] [--json]` | Checks the build host against BUILD-PROMPT.md "Before the first session" and prints the install commands for anything missing. Stdlib only (runs before the venv exists). Never installs anything |
| `sh tools/bootstrap [all\|jdk\|gradle\|gitleaks\|venv\|frontend\|env\|requirements-lock]` | Fetches the project-local toolchain into `.tools/` (`jdk`, `gradle`, `gitleaks`, `venv`) and installs `frontend/node_modules` from the lockfile (`frontend`); `all`, the default, runs those five. Every download is checked against a checksum before use; `--help` says which checksum each step uses and explains `--gradle-mirror`. `eval "$(sh tools/bootstrap env)"` sets JAVA_HOME, GRADLE_USER_HOME, COREPACK_HOME and PATH. `requirements-lock` regenerates `tools/requirements.txt`. Stdlib only |
| `sh tools/ci/run <tier>` | The local CI runner (see `tools/ci/README.md`) |
| `sh <copy>/tools/ci/gates-bite/gates-bite.sh --clone <scratch clone> --out /tmp <sha>` | The plant matrix: in a scratch clone on the WSL build host, plants a violation for each fast-tier gate, records that the gate fails and passes again once the violation is removed, then runs the fast tier on the clean tree. It destroys uncommitted work in the clone, so it refuses a clone not marked as scratch and runs from a copy of the scripts taken out of the commit under test (see `tools/ci/gates-bite/README.md`) |
| `sh tools/hms repo check` | Repository rules: no CRLF, programme files and ADRs present, tenant-identifier and branch-per-tenant detectors, size limits, entry scripts in git's index and stored as executable |
| `sh tools/hms licence check --sbom F \| --pnpm F` | The licence policy (see `tools/licence/README.md`) |
| `sh tools/hms backlog check`, `sh tools/hms safety check` | Backlog and hazard-log checks (their own packages) |

Unit tests: `.tools/venv/Scripts/python.exe -I -m unittest discover -s tools -t tools -p "test_*.py"`
(on Linux `.tools/venv/bin/python`). Configuration data lives in `tools/config/` (tenant identifiers) and
`tools/licence/` (licence policy). Python dependencies are pinned with hashes in `tools/requirements.txt`,
generated from `tools/requirements.in` by `sh tools/bootstrap requirements-lock`.
