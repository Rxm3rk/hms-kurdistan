# tools/ci/run: the local CI runner

Until a human provides a remote and a CI service, CI is `sh tools/ci/run <tier>` (BUILD-PROMPT.md §19.1).
It needs the project venv: run `sh tools/bootstrap` first.

```sh
sh tools/ci/run fast                  # every commit (budget 10 min)
sh tools/ci/run merge                 # every merge candidate
sh tools/ci/run nightly [--cell dev|lite|reference]
sh tools/ci/run release [--cell ...]
sh tools/ci/run fast --list           # show the steps and which are not built yet
sh tools/ci/run fast --only repo-check --no-evidence   # debugging: result PARTIAL, never PASS
```

## Tiers

| Tier | Steps |
|---|---|
| fast | `doctor-fast` (tools/doctor --tier fast), `repo-check`, `python-unit-tests`, `safety-check`, `backlog-check`, `backend-fast` (Gradle `fastTier` with `-Phms.pbt.sequences=1000`), `frontend-fast` (`corepack pnpm run fast` in `frontend/`), `secret-scan` (gitleaks over the history of every branch, tag and remote-tracking branch, and over the working tree including untracked files, with `.gitleaks.toml` and redacted output) |
| merge | the fast steps, then the §19.1 merge contents |
| nightly | the fast steps, then the §19.1 nightly contents |
| release | the fast and merge steps, then the §19.1 release contents |

Every step runs, even after a failure; the tier exits 1 if any step failed. A step that a later work
package builds reports `NOT-BUILT`, names that work package and counts as a failure, so merge, nightly
and release fail until they are complete. Never report a shortened run as the gate.

Test counts come from this run only: the runner deletes stale JUnit XML before the backend and frontend
steps, ignores any XML older than the step, and fails a step that wrote no test results. The backend
step adds `--no-build-cache` so Gradle cannot restore test results from its cache instead of running
the tests.

## Exit codes

0 PASS · 1 FAIL · 2 usage or environment error · 3 PARTIAL (an `--only` run whose selected steps passed)

## Evidence

Each run writes `docs/program/evidence/ci/<yyyy-mm-dd>-<tier>-<shortsha>[-dirty].json` (an `--only`
run adds `-partial`; `--no-evidence` writes none): `schema_version`, `run_id`, `tier`, `started_at`,
`finished_at`, `duration_s`, `git` (sha, short_sha, branch, dirty, dirty_files), `host` (os,
os_version, arch, cpu_count, ram_gb, python, java, node), `cell` (`none` for fast), `steps` (name,
command, cwd, started_at, duration_s, exit_code, result, counts, log_tail on failure), `totals` and
`result`. A second run with the same name on the same day replaces the record. Full step logs go to
`build/ci-logs/<run_id>/` (git-ignored).
