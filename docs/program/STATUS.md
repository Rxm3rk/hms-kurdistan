# STATUS (updated 2026-10-19 13:30 Asia/Baghdad, on `wp/0.3-platform-kernel`)
Phase: 0   Work package: WP-0.3 Platform kernel, the cluster-free parts (DN-040)
Branch: wp/0.3-platform-kernel @ `7e1cfe7` (kernel libraries ids, time, money and TestClock; before it `1b00abe`, the module specifications), stacked on `wp/0.1-programme-bootstrap` at `09afa41`. Worktree: `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03`. Limiter label: `wp03`
Last green: fast @ a9d5725, WSL build host, no cell (the WP-0.1 record of record). WP-0.3 has run only on the Windows host (not evidence of record); the lead runs the records of record at the final SHA
In-flight slice: `:platform:context`, `:platform:quantity` and the kernel architecture rules in `:platform:arch-rules`, built by helpers in the worktree, uncommitted. Then the journal and events, tenancy and the workflow port; then config, tasks and app-hms
Review policy: DN-040 decision 4 (19 October 2026, about 12:15; replaces decision 2; a deviation from §3.2 step 7): no reviews by this stream or its helpers; the gates still run; the lead runs one review of the whole package at its end (critical and major findings only)
Open review findings: none. The specs at `1b00abe` were reviewed under the earlier policy (two automated lenses per spec, 28 critical and about 170 major findings fixed, then 39 cross-spec mismatches fixed and checked by a stale-name grep); no critical or major finding is open
Blocking decisions: DN-005, DN-011 (unchanged). DN-040 answered; DN-041 resolved by the lead (the `t3/*` branches were deleted at 08:05)
ID ranges for WP-0.3: DN-040…DN-049, OQ-170…OQ-199, KA-045…KA-059, HAZ-0035…HAZ-0039, ADR-031…ADR-034. Used so far: DN-040 to DN-044, OQ-170 to OQ-178

## Last session
- WP-0.3 started on the human lead's approval (DN-040, 19 October 2026): the cluster-free parts only. `WORK-PACKAGES.md` and `work-packages/WP-0.3.md` say `in-progress`, with the deviation noted.
- `1b00abe` `docs(specs): WP-0.3 platform kernel module specifications`. It holds `docs/specs/modules/platform-{kernel,journal,tenancy,config,tasks,workflow}.md`, `docs/specs/events/{envelope,catalogue}.md` and `docs/specs/state-machines/task.yaml` (approval requested, `approved_by: []`). Kernel API 1 for WP-0.5 (ids, time, context, `TestClock`) is kernel spec §5 to §8. The open items keep local labels (DN-KN1, OQ-TK1, KA-J1, HC-KN1 and so on): 18 DNs, 58 OQs, 27 KAs, 15 hazard candidates and 5 ADR notes. That is more than WP-0.3's ranges hold, so they are numbered in grouped entries (next step 2).
- Fast tier for `1b00abe` (Windows host, not evidence of record), run in a scratch clone holding exactly that commit's content:
  - The full `tools/ci/run fast --no-evidence` run passed doctor, the repo, safety and backlog checks, backend-fast (66 tests) and the secret scan.
  - python-unit-tests timed out at its 900 s cap under the load of five parallel streams.
  - frontend-fast failed because the scratch-clone script's `git clean -x` had deleted the nested `node_modules`. The script is fixed.
  - Re-runs in the same clone: frontend-fast alone PASS (514 tests); the same Python suite alone, without the cap, PASS (699 tests in 1167 s).
- Library slices, built by subagents in the worktree. Each passed test, propertyTest, detekt, ktlintCheck and verifyArchitectureTest for its own project (Windows host):
  - `:platform:ids`: 76 unit tests and 7 properties.
  - `:platform:testing` (with `TestClock`): 21 unit tests and 1 property.
  - `:platform:time`: 60 unit tests and 17 properties. Every row of the SI-10 classification table is tested at each tolerance and 1 µs either side.
  - `:platform:money`: 36 unit tests and 8 properties.
  - Their reports, with every interpretation of the spec they made, are in `C:\Users\Surface\AppData\Local\Temp\hms-wp03\slice-reports.md`, outside the repository.
- `7e1cfe7` `feat(kernel): UUIDv7 ids, clinical and recorded time, money, TestClock`: fast tier PASS in a scratch clone holding exactly that commit (Windows host, not evidence of record): 8 of 8 steps, 1490 tests (699 Python, 277 backend, 514 frontend). It also numbers the specs' open items (DN-042 to DN-044, OQ-170 to OQ-178).
- Spec gaps the slices found, fixed in the kernel spec in `7e1cfe7`: ids at clock 2⁴⁸−1 with a counter rollover must throw (the spec says the generator never fails in range); `PropertyTest:entry-time-tolerance-strictness-direction` waits for tenancy's `Strictness` and DN-KN1.

## Next exact step
1. When `:platform:context`, `:platform:quantity` and the arch-rules slice pass their project gates: number the known anomalies their code makes true (KA-045 onwards; for example kernel spec KA-KN1, UCUM validation is syntactic only), then run `sh /c/Users/Surface/AppData/Local/Temp/hms-wp03/commitclone.sh backend docs` (the fast tier on exactly the commit's content, Windows host scratch clone). Commit in the clone with `git -c user.name=Ahmad -c user.email=ahmad@digitalvision2.store commit -F <msg>`, then in the worktree `git fetch /c/Users/Surface/AppData/Local/Temp/hms-wp03/fastclone wp/0.3-platform-kernel && git merge-base --is-ancestor HEAD FETCH_HEAD && git reset --mixed FETCH_HEAD`. That is a fast-forward of the branch; never rebase or amend.
2. Next helpers, at most 3 at once (brief `C:/Users/Surface/AppData/Local/Temp/hms-wp03/modules-brief.md`): `:platform:events` with `:platform:journal`, `platform-tenancy`, `platform-workflow` (port only); then `platform-config`, `platform-tasks` and `app-hms` (Spring Modulith verification).
3. Host rules from the lead: never run `find /` or any search over a whole drive or home directory. Gradle jars are under `C:\Users\Surface\.t3\projects\hospitalmanagementsystem\.tools\gradle-home\caches\modules-2\files-2.1\`. No Docker, k3d or WSL. Never push, rebase or amend.

## Blocked / waiting on humans
- DN-005, DN-011 as before.
- For the CSO, filed in the specs and to be numbered (step 2):
  - DN-KN1, the SI-10 entry-time tolerances: until answered, every entry that needs a timing policy is refused.
  - DN-KN2 to KN6: the "audited" comparison API, the KB comparisons, unit-less doses, clinical number display, and entry-timing labels with offline capture.
  - DN-CFG-2 and -3: kill-switch engagement without an authorisation decision, and what "vendor-locked" means for SI-19.
  - DN-TK1 to TK6: the task-engine readings.
  - DN-T1: the reading of CTRL-0018-1.
- For the human lead: DN-CFG-1 (custody of the configuration-signing keys), DN-TK7 (tasks as their own aggregate), DN-W1 and DN-W2 (ADR-010's guard and §5.2's dependency column).
- Waiting on WP-0.2 (the cell): the Debezium → Kafka pipeline with Apicurio, the Temporal adapter, the journal-rebuild and per-patient-ordering exit tests, the `TaskOrphaned` chaos test, and persistence-backed lock evidence.

## Read next: BUILD-PROMPT top through §3; §5.2, §5.3, §6.1 to §6.8, §7 items 1, 3, 4, 6, 9; §8.1, §8.3, §8.5; §21 (WP-0.3) and §22; `docs/specs/modules/platform-kernel.md` first, then the other specs under `docs/specs/`
