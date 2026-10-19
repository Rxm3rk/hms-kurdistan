1. STILL OPEN BEFORE YOU WRITE THE R-01 RESOLUTION
- Nobody has run the adversarial "signoff-attack" pass on the sign-off group's merge and conflict rule (`_approve` and `_before` in `signoffs.py`). That reviewer stopped before starting, and I did not run it.
- My own gate changes cannot loosen it: withdrawals only remove records from matching, the risk-vocabulary roles only add the CSO, the content version now covers more fields, and text approvals and specs in subdirectories only add failures.
- One change does accept more than before: a CSO record for field `approval` now backs `risk_vocabulary.status`, because a parent path authorises its children.
- Either assign the attack pass to another reviewer, or rely on the full gates-bite sign-off section at the fix SHA (step 4).
- A recorded residual stays (plant 78; KA-011): a human who signs a merged list that holds another line's key approves that key.

2. COMMIT (yours)
- Keep the index as it is: six 100755 mode entries and A `tools/hmstools/backlog/hazards.py`.
- Also add the unstaged edits, including `tools/bootstrap` and `tools/host/provision-ubuntu.sh`.
- Add the untracked files and directories:
  - `docs/safety/signoffs/allowed-signers.yaml`
  - `docs/safety/signoffs/allowed-signers.schema.json`
  - `tools/ci/gates-bite/` (100644 is intended)
  - fixtures `filled-version-2/` and `no-required/`
  - `test_seeded_content.py`, `test_signed_commits.py` and `test_template_b2.py`
- Include the six deleted static sign-off fixtures.
- Files I changed this session:
  - `tools/hmstools/safety/{signoffs,check}.py`
  - `tools/hmstools/safety/tests/{test_signoff_gate,test_signed_commits,test_git_authentication,test_seeded_content}.py`
  - `tools/hmstools/licence/policy.py` and its `tests/test_licence.py`
  - `tools/hmstools/repo/{rules,__main__}.py` and its `tests/test_repo.py`
  - `tools/licence/{README.md,register.yaml}`
  - `tools/ci/gates-bite/gates-bite.sh`
  - `tools/README.md`, `tools/ci/README.md`, `backend/README.md`
  - `docs/safety/README.md`, `docs/safety/signoffs/{README.md,signoff.schema.json,allowed-signers.yaml}`, `docs/safety/hazard-log.yaml` (CTRL-0014-4 notes only)
  - `docs/program/{COMMANDS,DECISIONS-NEEDED,KNOWN-ANOMALIES}.md` (DN-001 phrase, DN-014 default, KA-010, KA-013)
- If the index is ever lost, restore it with `git update-index --chmod=+x backend/gradlew tools/ci/run tools/hms tools/doctor tools/bootstrap tools/host/provision-ubuntu.sh`. Repo rule (f) now fails both on a lost bit and on a script missing from the index.
- Then rewrite STATUS.md from status_draft (about 50 lines) and fill the Resolution fields from resolution_notes.

3. FAST AND NIGHTLY RECORDS IN THE WSL CLONE (from Git Bash)
- Run the scripts directly first:
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && git fetch origin && git checkout --detach origin/wp/0.1-programme-bootstrap && git ls-files -s backend/gradlew tools/bootstrap tools/ci/run tools/doctor tools/hms tools/host/provision-ubuntu.sh && ls -l backend/gradlew tools/bootstrap tools/ci/run tools/doctor tools/hms tools/host/provision-ubuntu.sh && sh tools/bootstrap && tools/ci/run fast --list && tools/doctor --tier fast; backend/gradlew -p backend --version'
  The bootstrap run is also the first build-host run of the pinned JDK download.
- The fast record:
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && sh tools/ci/run fast'
  - It writes `docs/program/evidence/ci/<date>-fast-<shortsha>.json` in the clone.
  - Expect PASS, the safety counts above with `allowed_signers=0`, the repo count `executables_checked=6`, and `host.java_identity.pinned` true.
  - The Python count is about 673 if every untracked test file is committed.
  - Watch `test_signed_commits` for "failed to write commit object"; the clock fix should prevent it.
- The doctor record:
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && S=$(git rev-parse --short HEAD); D=$(date +%F); sh tools/doctor > /tmp/$D-doctor-$S.txt; sh tools/doctor --json | tail -n 1 > /tmp/$D-doctor-$S.json'
  Exit 1 is expected for RAM and disk.
- The nightly record (R-07):
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && sh tools/ci/run nightly'
  Expect FAIL with NOT-BUILT steps; it writes `<date>-nightly-<shortsha>.json`.
- The licence checks:
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && eval "$(sh tools/bootstrap env)" && mkdir -p build && cd frontend && corepack pnpm --filter @hms/i18n licenses list --prod --json > ../build/licences-shipped.json && corepack pnpm -r licenses list --json > ../build/licences-all.json && cd .. && { sh tools/hms licence check --pnpm build/licences-shipped.json --json; sh tools/hms licence check --pnpm build/licences-all.json --scope build-only --json; } | tee /tmp/$(date +%F)-licence-$(git rev-parse --short HEAD).txt'
  Expect PASS with 2 components and PASS with 124. `evidence/README.md` has no `licence/` directory yet, so decide where this record goes (and amend that README's layout) before storing it.
- The spot check:
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && sh tools/hms backlog spot-check --seed 20261018 --count 10'
  Write `<date>-spot-check-<shortsha>.md` in the format of the 18 October file. Note that `hazards` is now derived, so compare it with the hazard log's `features` lists rather than expecting it empty.

4. GATES-BITE RECORD (WSL, about 15 minutes, after the commit)
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec bash -lc 'set -e; SHA=<fix sha>; SRC=/mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem; PLANT=$HOME/src/hms-plant; sh "$SRC/tools/ci/gates-bite/setup-clone.sh" "$SRC" "$PLANT"; COPY=$(mktemp -d); git -C "$PLANT" archive "$SHA" tools/ci/gates-bite | tar -x -C "$COPY"; sh "$COPY/tools/ci/gates-bite/gates-bite.sh" --clone "$PLANT" --out /tmp "$SHA"'
- Expect 78 plants: 73 FAIL and 5 PASS (39 control, 40 KA-011, 51 scope note, 77 merge control, 78 merge known PASS); 11 of 11 clean runs PASS; the fast tier PASS.
- The record must say "identical" and carry no PARTIAL note.
- I checked that my changes touch no plant's target: no plant uses supersedes, risk-vocabulary, spec subdirectories or text approvals. The naming text "settled the conflict" is unchanged. The `gates-bite.sh` keyring now also sets `ignore-time-conflict`.

5. AFTER THE RECORDS (evidence commit)
- Copy the records into `docs/program/evidence/{ci,doctor,backlog}/`. Do not delete the 18 October files: the review cites them.
- Point these at the new records:
  - COMMANDS.md §1 (bootstrap, doctor), §3 (repo, safety, backlog, licence), §4 (Python count) and §6;
  - `backend/README.md:54`;
  - STATUS.md "Last green" and the R-06 bullet;
  - the comment in `test_real_plan.py:18`.
- Fill R-06 and R-07 with the evidence SHA.
- Optionally replace KA-010's pointer with the backticked R-05 SHA. Update KA-005 if the licence output is stored.

6. HUMAN DECISIONS (none taken here)
- DN-014, OQ-120 and OQ-121 (CSO).
- Out-of-band verification of any signer or trust anchor added to `allowed-signers.yaml` (KA-011, DN-010).
- Whether a change to the list itself should need a particular role (today any listed key counts; the sign-off group assumed nothing).
- The provisioning hardening suggestions (§3.4 item 9).

7. LEFTOVERS AND SCRATCH
- STATUS.md is unchanged; I did not edit any read-only file.
- Scratch in %TEMP%: `edit1.py`…`edit14.py`, `clockprobe.sh`, `clockprobe2.sh`, `hms-fix-suite.log`. All can be deleted.
- `build/licences-*.json` in the checkout are git-ignored.