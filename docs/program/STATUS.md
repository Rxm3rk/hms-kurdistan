# STATUS (updated 2026-10-19 12:35 Asia/Baghdad, on `wp/0.3-platform-kernel`)
Phase: 0   Work package: WP-0.3 Platform kernel, the cluster-free parts (DN-040)
Branch: wp/0.3-platform-kernel @ `1b00abe` (the module specifications), stacked on `wp/0.1-programme-bootstrap` at `09afa41`. Worktree: `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03`. Limiter label: `wp03`
Last green: fast @ a9d5725, WSL build host, no cell (the WP-0.1 record of record). WP-0.3 has run only on the Windows host (not evidence of record); the lead runs the records of record at the final SHA
In-flight slice: the commit after `1b00abe` holds the kernel libraries `:platform:ids` with `TestClock`, `:platform:time` and `:platform:money`, and the Gradle wiring of every WP-0.3 project (empty skeletons for the projects not built yet). Next: number the specs' open items, then `:platform:context` and `:platform:quantity` (see "Next exact step")
Review policy: DN-040 decision 4 (19 October 2026, about 12:15; replaces decision 2; a deviation from §3.2 step 7): no reviews by this stream or its helpers; the gates still run; the lead runs one review of the whole package at its end (critical and major findings only)
Open review findings: none. The specs at `1b00abe` were reviewed under the earlier policy (two automated lenses per spec, 28 critical and about 170 major findings fixed, then 39 cross-spec mismatches fixed and checked by a stale-name grep); no critical or major finding is open
Blocking decisions: DN-005, DN-011 (unchanged). DN-040 answered; DN-041 resolved by the lead (the `t3/*` branches were deleted at 08:05)
ID ranges for WP-0.3: DN-040…DN-049, OQ-170…OQ-199, KA-045…KA-059, HAZ-0035…HAZ-0039, ADR-031…ADR-034. Used so far: DN-040, DN-041

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
- Spec gaps the slices found, to fix in the kernel spec with the library commit: ids at clock 2⁴⁸−1 with a counter rollover must throw (the spec says the generator never fails in range); `PropertyTest:entry-time-tolerance-strictness-direction` waits for tenancy's `Strictness` and DN-KN1.

## Next exact step
1. **Done when the commit after `1b00abe` exists** (`git log --oneline -3`): the three library slices and the wiring, with the two kernel-spec gaps fixed (§5 rollover at 2⁴⁸ − 1 throws; §17 strictness-direction property waits for definitions). If that commit is missing, run `sh /c/Users/Surface/AppData/Local/Temp/hms-wp03/commitclone.sh backend docs/program docs/specs` and commit what passes. Gradle only through `sh /c/Users/Surface/AppData/Local/Temp/hms-wp03/gradle.sh <tasks>`.
2. **Number the specs' open items** in `DECISIONS-NEEDED.md`, `OPEN-QUESTIONS.md` and `KNOWN-ANOMALIES.md`. The draft of DN-042 (kernel CSO decisions DN-KN1…KN6), DN-043 (config DN-CFG-1…3) and DN-044 (tasks DN-TK1…TK7, tenancy DN-T1/T2, workflow DN-W1/W2) is in `C:\Users\Surface\AppData\Local\Temp\hms-wp03\dn-draft.md`. Then OQ-170…OQ-176 (one per spec, pointing to its list; journal DN-J1 is an OQ for WP-0.2), OQ-177 (the hazard candidates, for the CSO), and KAs only as code makes them true. Add the new DNs to the top list of `DECISIONS-NEEDED.md` (at most ten items).
3. **Next slices,** each built only in the paths it owns: `:platform:context` (kernel §7; needs ids and time); `:platform:quantity` (§10; add `api(project(":platform:time"))` to its build file); then the §11 kernel rules in `:platform:arch-rules` (rules match annotations by name), wired into every kernel `ArchitectureTest`. Then `:platform:events`, `:platform:journal` (schema, migrations, jOOQ repository; PostgreSQL tests written in `src/integrationTest` and recorded as waiting for the cell), `platform-tenancy`, `platform-config`, `platform-tasks`, `platform-workflow` (port only) and `app-hms` with the Spring Modulith verification. Slice-agent brief: `C:\Users\Surface\AppData\Local\Temp\hms-wp03\libs-brief.md`.
4. Host rules from the lead: never run `find /` or any search over a whole drive or home directory. Gradle jars are under `C:\Users\Surface\.t3\projects\hospitalmanagementsystem\.tools\gradle-home\caches\modules-2\files-2.1\`. No Docker, k3d or WSL. Never push, rebase or amend.

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
