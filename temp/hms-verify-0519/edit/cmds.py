import sys
p = sys.argv[1]
s = open(p, encoding='utf-8', newline='').read()
R = []
def rep(old, new):
    assert s.count(old) == 1, old[:80]
    R.append((old, new))

rep('''Every command below was run on 18 October 2026 except those whose **Checked** cell says "not run"; the **Checked** column says where each was run. A cell that says "19 October" names a run on the Windows checkout's uncommitted tree that resolves the WP-0.1 review findings (`docs/program/reviews/WP-0.1.md`), of the command as this file now describes it; a WSL record at `d3e14de` cited beside it ran an earlier version of the command, and the cell says what that version lacked. "Windows" is the Windows checkout (Git Bash), "WSL" the Linux build host or its clone.''',
'''Every command below was run, on 18 October 2026 or later, except those whose **Checked** cell says "not run"; the **Checked** column says where each was run. "Windows" is the Windows checkout (Git Bash), "WSL" the Linux build host or its clone. "WSL at `05f159a`" names a run on 19 October in the WSL clone at `05f159a`, the commit that resolves the WP-0.1 review findings (`docs/program/reviews/WP-0.1.md`), on a clean tree (WSL build host, no cell), with its record stored under `docs/program/evidence/`: these are the records of record. A Windows cell that says "19 October" names a run on the Windows checkout's uncommitted tree before that commit, of the command as this file now describes it. The 18 October files that the review cites (the Windows gates-bite and spot-check runs, and the WSL records at `d3e14de`, which ran earlier versions of the tools) are kept as earlier runs and are not the record for the commands as they stand.''')

rep('''| Windows (reused everything, 1.5 s, before the frontend step existed; on 19 October `sh tools/bootstrap jdk` reused the pinned JDK, 1 s); WSL (fetched everything, 7.5 min) with the version before the pin, which fetched whatever JDK 25 Adoptium's API called latest, with Amazon Corretto as a fallback (review finding R-14): the pinned download has not yet run on the build host |''',
'''| Windows (reused everything, 1.5 s, before the frontend step existed; on 19 October `sh tools/bootstrap jdk` reused the pinned JDK, 1 s); WSL at `05f159a`, before the records of record: reused the pinned JDK (Temurin 25.0.4.1+1), Gradle, gitleaks and the venv and installed the frontend packages from the lockfile (its log is not stored under `docs/program/evidence/`); the gates-bite record at `05f159a` (`evidence/ci/2026-10-19-gates-bite-05f159a.md`) records the same command in its scratch clone, exit 0 in 2 s. The first WSL run (fetched everything, 7.5 min) was the version before the pin, which fetched whatever JDK 25 Adoptium's API called latest, with Amazon Corretto as a fallback (review finding R-14); the run that first fetched the pinned JDK on the build host has no stored record |''')

rep('''| Windows (fails, as it should: Windows is not the build host); WSL at `d3e14de` (fails on RAM and free disk only; recorded) |''',
'''| Windows (fails, as it should: Windows is not the build host); WSL at `05f159a` (`evidence/doctor/2026-10-19-doctor-05f159a.txt`: FAIL, 18 OK, 2 required missing: RAM, 9.7 GiB, and free disk, 26.2 GiB on C:, which holds the WSL2 disk) |''')

rep('''| `sh tools/doctor --json` | The same, with one JSON object as the last line (evidence) | Windows; WSL at `d3e14de` (recorded) |''',
'''| `sh tools/doctor --json` | The same, with one JSON object as the last line (evidence) | Windows; WSL at `05f159a` (`evidence/doctor/2026-10-19-doctor-05f159a.json`) |''')

rep('''| Windows (through `tools/ci/run fast`; on 19 October on its own, PASS with the pinned JDK); WSL at `d3e14de` through `tools/ci/run fast` (`evidence/ci/2026-10-18-fast-d3e14de.json`), an earlier version that accepted any JDK 25 |''',
'''| Windows (through `tools/ci/run fast`; on 19 October on its own, PASS with the pinned JDK); WSL at `05f159a` through `tools/ci/run fast` (step `doctor-fast`, 5 of 5 OK; `evidence/ci/2026-10-19-fast-05f159a.json`, whose `java_identity` names Temurin-25.0.4.1+1, `pinned: true`) |''')

rep('''`build/ci-logs/<run_id>/` | Windows (with `--no-evidence`); WSL at `d3e14de`, the record (`evidence/ci/2026-10-18-fast-d3e14de.json`) |''',
'''`build/ci-logs/<run_id>/` | Windows (with `--no-evidence`); WSL at `05f159a`, the record (`evidence/ci/2026-10-19-fast-05f159a.json`: PASS, 8 of 8 steps, 1253 tests, 0 failures) |''')

rep('''each NOT-BUILT and counted as a failure (fail closed, KA-003) | Windows (FAIL as expected) |''',
'''each NOT-BUILT and counted as a failure (fail closed, KA-003) | Windows (FAIL as expected); WSL at `05f159a` without `--no-evidence`, the record (`evidence/ci/2026-10-19-merge-05f159a.json`: FAIL, 8 passed, 0 failed, 15 NOT-BUILT) |''')

rep('''| The nightly and release tiers, failing closed the same way | Windows (FAIL as expected) |''',
'''| The nightly and release tiers, failing closed the same way | Windows (FAIL as expected); the nightly tier also WSL at `05f159a` without `--no-evidence`, the record (`evidence/ci/2026-10-19-nightly-05f159a.json`: FAIL, 8 passed, 0 failed, 12 NOT-BUILT); the release tier has no WSL run |''')

rep('''| Windows (19 October); WSL at `d3e14de` with `--json` through `tools/ci/run fast` (the record), an earlier version without the 100755 rule (`executables_checked`) and with a looser ADR template rule (review findings R-02, R-17) |''',
'''| Windows (19 October); WSL at `05f159a` with `--json` through `tools/ci/run fast` (the record, `evidence/ci/2026-10-19-fast-05f159a.json`: PASS, `executables_checked=6`, 0 errors, 4 warnings); the gates-bite record at `05f159a` shows it failing on 11 of 11 plants |''')

rep('''| Windows (19 October); WSL at `d3e14de` with `--json` through `tools/ci/run fast` (the record), an earlier version without `allowed-signers.yaml`, which accepted a record signed by any key the host could verify (review findings R-01, R-20) |''',
'''| Windows (19 October); WSL at `05f159a` with `--json` through `tools/ci/run fast` (the record: PASS, `hazards=27`, `controls=193`, `allowed_signers=0`, 0 errors, 3 warnings); the gates-bite record at `05f159a` has 46 plants on it, 42 failing and the 4 expected to pass passing |''')

rep('''| Windows (19 October); WSL at `d3e14de` with `--json` through `tools/ci/run fast` (the record), an earlier version without the hazards cross-check (review finding R-05) |''',
'''| Windows (19 October); WSL at `05f159a` with `--json` through `tools/ci/run fast` (the record: PASS, `rows=236`, `features_with_hazards=101`, `hazard_links=237`, 0 errors, 1 warning); the gates-bite record at `05f159a` shows it failing on 5 of 5 plants |''')

rep('''| Windows (see below; on 19 October both frontend lists again, the same counts) |''',
'''| Windows (see below; on 19 October both frontend lists again, the same counts); WSL at `05f159a` with `--json`, both frontend lists (`evidence/licence/2026-10-19-licence-05f159a.txt` and its two inputs: PASS, 2 components in the shipped scope, 124 build-only, exit 0 each) |''')

rep('''| `$PY -I -m unittest discover -s tools -t tools -p "test_*.py"` (every tools test; 392 at `d3e14de`) | Windows; WSL at `d3e14de` through `tools/ci/run fast` (392 tests, the record) |''',
'''| `$PY -I -m unittest discover -s tools -t tools -p "test_*.py"` (every tools test; 673 at `05f159a`) | Windows; WSL at `05f159a` through `tools/ci/run fast` (673 tests, 0 failures, the record) |''')

rep('''| Windows; WSL at `d3e14de` through `tools/ci/run fast` (with `-Phms.pbt.sequences=1000 --no-build-cache`), the record (`evidence/ci/2026-10-18-fast-d3e14de.json`) |''',
'''| Windows; WSL at `05f159a` through `tools/ci/run fast` (with `-Phms.pbt.sequences=1000 --no-build-cache`; 66 tests, 0 failures), the record (`evidence/ci/2026-10-19-fast-05f159a.json`) |''')

rep('''| One gate across every project | Windows (through `fastTier`); WSL at `d3e14de` through `fastTier` in `tools/ci/run fast` (the record) |''',
'''| One gate across every project | Windows (through `fastTier`); WSL at `05f159a` through `fastTier` in `tools/ci/run fast` (the record) |''')

rep('''| Windows (514 tests); WSL at `d3e14de` through `tools/ci/run fast` (514 tests, the record) |''',
'''| Windows (514 tests); WSL at `05f159a` through `tools/ci/run fast` (514 tests, 0 failures, the record) |''')

rep('''WSL at `d3e14de` through `fast` in `tools/ci/run fast` (`lint`, `typecheck`, `test`, `i18n:lint`; the record) |''',
'''WSL at `05f159a` through `fast` in `tools/ci/run fast` (`lint`, `typecheck`, `test`, `i18n:lint`; the record) |''')

rep('''| Windows; on WSL the same `secret-scan` step ran at `d3e14de` inside the full `tools/ci/run fast` (the record) |''',
'''| Windows; on WSL the same `secret-scan` step ran at `05f159a` inside the full `tools/ci/run fast` (the record: 0 findings in the history and the working tree), and this command as written ran among the clean runs of the gates-bite record at `05f159a` (PASS) |''')

rep('''| `sh tools/hms backlog spot-check --seed 20261018 --count 10` | Prints ten seeded random Appendix A rows beside their parsed records | Windows |''',
'''| `sh tools/hms backlog spot-check --seed 20261018 --count 10` | Prints ten seeded random Appendix A rows beside their parsed records | Windows; WSL at `05f159a` (exit 0; the record `evidence/backlog/2026-10-19-spot-check-05f159a.md`) |''')

rep('''| `docs/program/evidence/ci/<date>-fast-<shortsha>.json` | In the WSL clone at that SHA: `git checkout --detach <sha> && sh tools/bootstrap && sh tools/ci/run fast` |''',
'''| `docs/program/evidence/ci/<date>-fast-<shortsha>.json` | In the WSL clone at that SHA: `git checkout --detach <sha> && sh tools/bootstrap && sh tools/ci/run fast`. The record at `05f159a` is `2026-10-19-fast-05f159a.json` (PASS, 8 of 8 steps, 1253 tests) |
| `docs/program/evidence/ci/<date>-merge-<shortsha>.json` | The same with `sh tools/ci/run merge`. It exits 1 while steps are NOT-BUILT (KA-003). The record at `05f159a` is `2026-10-19-merge-05f159a.json` (FAIL: the 8 fast steps pass, 15 steps NOT-BUILT) |
| `docs/program/evidence/ci/<date>-nightly-<shortsha>.json` | The same with `sh tools/ci/run nightly`, at the last commit of every session that changes code (§19.1). It exits 1 while steps are NOT-BUILT (KA-003). The record at `05f159a` is `2026-10-19-nightly-05f159a.json` (FAIL: the 8 fast steps pass, 12 steps NOT-BUILT) |''')

rep('''(exit 1 is expected while an item is missing; the record says which). The records at `d3e14de` are named `2026-10-18-d3e14de.*`, without the test name that `evidence/README.md` asks for; they keep that name because the review cites them |''',
'''(exit 1 is expected while an item is missing; the record says which). The records at `05f159a` are `2026-10-19-doctor-05f159a.txt` and `.json` (FAIL: 18 OK, RAM and free disk missing). The earlier records at `d3e14de` are named `2026-10-18-d3e14de.*`, without the test name that `evidence/README.md` asks for; they keep that name because the review cites them |''')

rep('''| `docs/program/evidence/backlog/2026-10-18-spot-check.md` | `sh tools/hms backlog spot-check --seed 20261018 --count 10`, then compare each row with BUILD-PROMPT.md by hand. A Windows run before the first commit, not evidence of record (review finding R-06); its record of record is `<date>-spot-check-<shortsha>.md` from the WSL clone |''',
'''| `docs/program/evidence/backlog/<date>-spot-check-<shortsha>.md` | In the WSL clone at that SHA: `sh tools/hms backlog spot-check --seed 20261018 --count 10`, then compare each row with BUILD-PROMPT.md, §21 and the hazard log by hand, against the committed files. The record at `05f159a` is `2026-10-19-spot-check-05f159a.md` (ten of ten match; a cross-check of all 236 rows, 0 mismatches). The earlier `2026-10-18-spot-check.md` is a Windows run before the first commit, not evidence of record (review finding R-06); it stays because the review cites it |''')

rep('''| `docs/program/evidence/ci/2026-10-18-gates-bite.md` | Planted by hand on the Windows checkout before the first commit, not evidence of record (review finding R-06). Its record of record comes from''',
'''| `docs/program/evidence/ci/<date>-gates-bite-<shortsha>.md` | The record at `05f159a` is `2026-10-19-gates-bite-05f159a.md` (WSL build host, no cell: 78 plants, 73 FAIL and the 5 expected to pass passing; 11 of 11 clean runs PASS; the fast tier on the clean tree PASS). The earlier `2026-10-18-gates-bite.md` was planted by hand on the Windows checkout before the first commit, not evidence of record (review finding R-06); it stays because the review cites it. The record comes from''')

rep('''it writes `<date>-gates-bite-<shortsha>.md`, which is copied to `docs/program/evidence/ci/` |''',
'''it writes `<date>-gates-bite-<shortsha>.md`, which is copied to `docs/program/evidence/ci/` |
| `docs/program/evidence/licence/<date>-licence-<shortsha>.txt` and its inputs `-shipped-input.json` and `-all-input.json` | In the WSL clone at that SHA, after `sh tools/bootstrap`: the two `licenses list` commands of section 3, then `sh tools/hms licence check --pnpm build/licences-shipped.json --json` and `sh tools/hms licence check --pnpm build/licences-all.json --scope build-only --json`; store both outputs in the `.txt` and the two lists beside it. The record at `05f159a` is `2026-10-19-licence-05f159a.txt` (PASS: 2 components shipped, 124 build-only) |''')

for o, n in R:
    s = s.replace(o, n)
open(p, 'w', encoding='utf-8', newline='').write(s)
print('replacements', len(R))
