# tools/ci/gates-bite: gates fail on planted violations

`gates-bite.sh` shows that each gate of the fast tier of `tools/ci/run` fails when a violation is planted,
and passes again once the violation is removed. A gate that never fails proves nothing (BUILD-PROMPT.md
§3.5, §19.1). It plants one violation at a time in a scratch clone, runs only the gate concerned with the
command `tools/ci/run` uses for that step, records FAIL or PASS with the output line that names the
violation, then resets the clone before the next plant. After the plants it runs every gate once more on
the clean tree, then the whole fast tier.

It writes the plant matrix that WP-0.1's exit evidence and review finding R-06 ask for: a Markdown record
of record, taken at a committed SHA in a scratch clone on the WSL build host (KA-001).

## Files

| File | What it does |
|---|---|
| `gates-bite.sh` | The plants, the gate runs and the resets |
| `gb_record.py` | Writes one result row per gate run and renders the Markdown record |
| `plant_edit.py` | The text edits of the plants; each fails (and changes nothing) when its target is not found, so a plant never silently does nothing |
| `so_version.py` | Prints a hazard's `subject_version` as the clone's own safety check computes it, for the scratch sign-off records |
| `setup-clone.sh` | Makes or refreshes a scratch clone and marks it as scratch |
| `snapshot.sh` | Dry runs only: commits a snapshot of a working tree (uncommitted work included) as an unreferenced commit of the scratch clone |
| `watch-run.sh`, `show-errors.sh` | Follow a run's result lines; show the first error lines of each gate log |
| `stop-run.sh` | Stops a run and returns the scratch clone to a clean detached commit, deleting the run's temporary GPG home |

Every script runs with `sh` or `bash` named on the command line, so no exec bit is needed; under `sh` each
re-runs itself with `bash`. The scripts need `git`, `python3`, `gpg` (for the sign-off plants), `timeout`,
`pgrep` and the project toolchain, which the script installs in the clone with `sh tools/bootstrap`.

## Where it runs, and where it never runs

The script destroys uncommitted work in the clone it plants in (`git checkout -f`, `git reset --hard`,
`git clean -fdx` except `.tools/` and `node_modules/`), and it creates and deletes branches there. So it
refuses, with exit 2, a clone that:

- is not marked as a scratch clone (`git -C <clone> config hms.scratchClone true`; `setup-clone.sh` sets it);
- has uncommitted or untracked changes (`git status --short` not empty);
- is under `/mnt/` (a Windows checkout, KA-001);
- is the checkout the script itself lives in. Bash reads a script while it runs it, and the resets would
  rewrite it, so the script always runs from outside the clone: from a copy taken out of the commit
  under test (below), or from the developer's checkout against a separate scratch clone.

It also refuses a record path inside the clone. Never mark the developer's checkout as a scratch clone.

## How to run it

On the WSL build host, at a committed SHA that a branch of the source repository holds. Fill in the three
values; the source may be the developer's WSL checkout or the Windows checkout under `/mnt/` (it is only
read), and the scratch clone and the copy of the scripts can be anywhere outside it.

```sh
SRC=<the repository that holds the commit>
PLANT=<a directory for the scratch clone>
SHA=<the commit under test>
# 1. A scratch clone that holds the commit, marked as scratch (later runs refresh it).
sh "$SRC/tools/ci/gates-bite/setup-clone.sh" "$SRC" "$PLANT"
# 2. The scripts as committed at that SHA, outside the clone.
COPY=$(mktemp -d)
git -C "$PLANT" archive "$SHA" tools/ci/gates-bite | tar -x -C "$COPY"
# 3. The run; the record goes to /tmp/<yyyy-mm-dd>-gates-bite-<shortsha>.md.
sh "$COPY/tools/ci/gates-bite/gates-bite.sh" --clone "$PLANT" --out /tmp "$SHA"
```

`bash gates-bite.sh [--clone DIR] [--out PATH] <commit>`:

| Argument | Meaning | Default |
|---|---|---|
| `<commit>` | The commit to test; the clone is checked out at it, detached | none |
| `--clone DIR` | The scratch clone to plant in | the git top level of the current directory |
| `--out PATH` | A directory for the record, or a file name ending in `.md` | `${TMPDIR:-/tmp}` |

Environment: `HMS_GB_SECTIONS` (space-separated sections to run; default all: `repo unittest signoff
hazards backlog ci secrets frontend backend clean final`), `HMS_GB_WAIT_PATTERN` (before the Gradle plants,
wait while `pgrep -f` finds this pattern, for a host whose memory another heavy job shares; default empty,
no wait) and `HMS_GB_WAIT_MAX` (the longest wait in seconds, default 1200). A run with fewer sections is a
debugging run: its record says "PARTIAL" in its notes, its default name ends in `-partial`, and it is never
a record of record.

The script records whether the files that ran are identical to `tools/ci/gates-bite/` at the commit under
test. A record of record needs "identical": run the copy taken out of that commit, as above. While a run is
going, `sh watch-run.sh <record without .md>.logs/run.log` prints its result lines; `sh stop-run.sh <clone> <commit>`
stops it and cleans the clone.

Dry runs of uncommitted work: `sh snapshot.sh <worktree> <clone>` prints an unreferenced commit of the
scratch clone that holds the worktree's tracked and untracked files (not the ignored ones) with the modes of
its index; run the script at that commit. Such a record names a snapshot commit, so it is never evidence of
record.

## What it writes

The record is a Markdown file named as `docs/program/evidence/README.md` requires,
`<yyyy-mm-dd>-gates-bite-<shortsha>.md` (the date the run started), written to `--out`. The script refuses
a clone with changes, so a record never needs `-dirty`. The lead copies a record of record to
`docs/program/evidence/ci/`. Next to it, `<record without .md>.logs/` holds the full log of every gate run,
`run.log`, `results.jsonl` and `meta.json`; the logs are not evidence files and are not committed.

The record names the commit and its subject, the cell ("WSL build host, no cell"), the host and the tool
versions, the script's sha256 and the exact invocation, and for each plant the planted violation, the
command, the exit code, the duration and the line that names the violation. It counts the plants by result,
lists every result that differs from what is expected, and ends with the clean runs, the fast tier on the
clean tree and its notes. The clone ends clean, detached at the commit under test, with no scratch branch.

## How long it takes

Measured on the WSL build host (8 CPUs, 9.7 GiB RAM), with the toolchain already in the clone's `.tools/`
(dry runs, not records): every section at `6ca3e3a` (44 plants) took 10 min 52 s; every section at a
snapshot of the WP-0.1 fix with the merge plants (78 plants) took 15 min 17 s. Each Gradle plant and the
Gradle clean run take about 1 min, the Python unit tests about 1 min, the fast tier at the end 2 to 4 min,
and every other plant a few seconds (the 41 `signoff` plants take about 1 s each). Expect about 15
minutes for a whole run. The first run in a new clone adds the toolchain download of `sh tools/bootstrap`.

## The plants

Each plant is expected to FAIL unless this table says otherwise.

| Section | Gate (`tools/ci/run` step) | Plants |
|---|---|---|
| `repo` | `repo-check` | An untracked CRLF file; a tenant identifier and its hostname in backend configuration; branches `wp/9.9-syn-tenant-0001`, `customer-acme` and `feature/scratch`; `STATUS.md` over 150 lines; ADR-010 deleted; ADR-001 `accepted`; ADR-002 without `## Reopen if`; a broken ADR index link; 13 "Blocking now" items |
| `unittest` | `python-unit-tests` | A failing unit test |
| `signoff` | `safety-check` | `residual_risk.accepted_by` filled with no record; with an untracked record; committed unsigned; signed with an AI co-author trailer; signed with no trailer by an unlisted key (the R-01 plant); `cso_triage` filled with no record; a state-machine spec with `approval.approved_by` filled. Then, behind a scratch trust anchor that lists key A: a record signed by unlisted key B; unsigned; with a trailer; `decision: triaged`; a stale `subject_version`; key B added in an unsigned commit; key B added by a commit signed by key B; the list emptied and re-anchored; an anchor commit with a trailer; the wrong role; the wrong name; the wrong `signer_key`; a signed record edited later; key B listed only in the working tree; the control plant; the KA-011 plant |
| `signoff` (merges) | `safety-check` | Two lines of history from the commit under test: the main line anchors key A, and a side line forked before that anchor anchors the agent's key B under the same name and role. Then the rogue merges, each followed by a record signed by key B: the side line merged into the main line, and the main line into the side line, each without a signature and signed by key B, each keeping key A, key B or both (12 plants); the merge signed by key A, keeping key A or both keys (2); the agent's attempt to settle the conflict alone, with a comment-only edit signed by key B and an unsigned one; a revert of the merge signed by key A, then a record signed by key A; the control plant for merges; the known PASS of a merge signed by key A that keeps key B. These run after the `backend` plants, so that the plant numbers of the earlier records stay the same |
| `hazards` | `safety-check` | A hazard `accepted`; a control `verified` with no `verified_by`; one word of an SI's `invariant_text` changed; a control's `covers` emptied; an unparsable hazard log |
| `backlog` | `backlog-check` | A feature `built` with no tests; `verified` with no tests; a hand-edited title; a record deleted; `BACKLOG.md` hand-edited |
| `ci` | `tools/ci/run` itself | A check that exits 0 but prints `ok: false` |
| `secrets` | `secret-scan` | A GitHub token in an untracked file; the same token only in a branch's history; an AWS access key id; a PEM private-key block; the scope note (below) |
| `frontend` | `frontend-fast` | JSX literals and physical CSS in a component; physical CSS in a stylesheet; a catalogue key deleted; an ICU syntax error |
| `backend` | `backend-fast` | A ktlint violation; a detekt violation; a false property; domain code reading the system clock; a module boundary crossed outside the api package |

Every planted secret, AI co-author trailer and private-key label is put together at run time, and none is
written literally in these files, so the repository's own gates never flag them.

## Known PASS rows, and why they pass

- **The control plant** (`signoff`, expected PASS). A record signed by the anchored key A that matches its
  field, decision, role and `subject_version` is accepted. It shows that the sign-off gate is not simply
  closed: a FAIL here would mean no human could ever sign.
- **The KA-011 plant** (`signoff`, expected PASS). With the shipped empty allowed-signers list, a commit by
  the agent identity without an AI co-author trailer anchors the agent's own key B under a human's name and
  role, and a record signed by key B then passes. This is known limitation KA-011, not a gate failure: the
  check reports the trust anchor as a warning, which must be verified out of band, until DN-010 [HUMAN]
  closes it. A FAIL here would mean the gate changed and KA-011 needs review.
- **The control plant for merges** (`signoff`, expected PASS). Key A's line and key B's line are merged
  in a merge signed by key A that keeps key A, and a later comment-only edit of the list signed by key B
  approves the same signers for key B's line; a record signed by key A is then accepted, and the check
  warns that the conflict was settled. It shows that the rule for merged lines (`docs/safety/signoffs/README.md`,
  "Who may sign") does not lock the gate for good: once every side has approved the signers of one
  version, trust is restored. A FAIL here would mean no human could sign after such a merge.
- **The known PASS of a merge signed by key A that keeps key B** (`signoff`, expected PASS). The merge
  keeps both keys and is signed by key A; a comment-only edit signed by key B then approves the merged
  list for key B's line, and a record signed by key B passes. Key A's signature on a list that holds key
  B approves key B, as a signed change on one line would: a key anchored on another line becomes
  trusted only if a key of the human's line approves it (KA-011). The check warns of both anchors and
  of the settled conflict. A FAIL here would mean the merge rule changed and KA-011 needs review.
- **The secret-scan scope note** (`secrets`, expected PASS). A plain `password = "..."` assignment matches no
  default gitleaks rule. It is not a gate violation; it records the scan's scope, as the WP-0.1 review did.
  It FAILs whenever the tree already holds another finding, so a FAIL here means: read the finding it names.

At a commit before the R-01 fix (no `docs/safety/signoffs/allowed-signers.yaml`), the R-01 plant passes (the
known defect R-01, reported as it is) and the plants behind a trust anchor, merges included, are recorded as
not applicable.
