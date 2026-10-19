# STATUS (updated 2026-10-19 10:20 Asia/Baghdad, on `wp/0.3-platform-kernel`)
Phase: 0   Work package: WP-0.3 Platform kernel, the cluster-free parts (DN-040)
Branch: wp/0.3-platform-kernel, stacked on `wp/0.1-programme-bootstrap` at `09afa41`; first commit = the module specifications (this file's commit)
Last green: fast @ a9d5725, WSL build host, no cell (the WP-0.1 record of record). WP-0.3 runs only on the Windows host so far (not evidence of record); the lead runs the records of record at the final SHA
In-flight slice: kernel libraries `:platform:ids` with `TestClock`, `:platform:time` and `:platform:money` (uncommitted, being built by slice agents in this worktree)
Open review findings: the six module specs, the envelope, the catalogue and `task.yaml` had two automated review lenses each (correctness; clinical safety and hazard): 28 critical and about 170 major findings fixed, then a cross-spec check (39 mismatches, all fixed in two alignment rounds and checked by a stale-name grep); no unresolved finding is known
Blocking decisions: DN-005, DN-011 (unchanged). DN-040 answered; DN-041 resolved by the lead (the `t3/*` branches were deleted at 08:05)
ID ranges for WP-0.3: DN-040…DN-049, OQ-170…OQ-199, KA-045…KA-059, HAZ-0035…HAZ-0039, ADR-031…ADR-034. Used so far: DN-040, DN-041

## Last session
- WP-0.3 started on the human lead's approval (DN-040, 19 October 2026): the cluster-free parts only. `WORK-PACKAGES.md` and `work-packages/WP-0.3.md` say `in-progress` with the deviation.
- Specified first (§3.2), all drafts with approval requested where a spec carries one:
  - `docs/specs/modules/platform-kernel.md` (ids, time, context, money, quantity, `TestClock`; kernel API 1 for WP-0.5),
  - `platform-journal.md`, `platform-tenancy.md`, `platform-config.md`, `platform-tasks.md`, `platform-workflow.md`,
  - `docs/specs/events/envelope.md` (CloudEvents 1.0 rules) and `catalogue.md` (§8.5),
  - `docs/specs/state-machines/task.yaml` (`approval: status requested`, `approved_by: []`).
- Each spec keeps its open items under local labels (DN-KN1, OQ-TK1, KA-J1, HC-KN1 and so on), "to be numbered". The specs hold 18 local DNs, 58 OQs, 27 KAs, 15 hazard candidates and 5 ADR notes, more than WP-0.3's ranges; they are numbered in grouped programme entries, not one number each (next step 2).
- DN-041 resolved: the lead deleted the `t3/*` branches at 08:05; WP-0.3 no longer needs its scratch clone for branch names.
- Windows host, not evidence of record (09afa41 plus the uncommitted specs, earlier this morning): `tools/ci/run fast` 6 of 8 steps passed (backend 66 tests, frontend 514 tests); `doctor-fast` timed out on `gitleaks` after 30 s and `python-unit-tests` hit its 900 s limit under the load of five parallel streams; the same Python suite run on its own passed, 699 tests in 1304 s.
- Spec commit check: see the commit message for its fast-tier run.

## Next exact step
1. Kernel libraries, one commit per slice once the fast tier passes: `:platform:ids` and `TestClock` (`hms.kernel.testing`), `:platform:time`, `:platform:money` are in progress in this worktree (uncommitted files under `backend/platform/`). Then `:platform:context` and `:platform:quantity`, then the section 11 kernel rules in `:platform:arch-rules`. Each patient-safety slice (time, context, quantity, `TestClock`) gets two review lenses before its commit; ids and money one. Build only through `sh /c/Users/Surface/AppData/Local/Temp/hms-wp03/gradle.sh <tasks>` (worktree lock plus the host limiter).
2. Number the specs' open items into WP-0.3's ranges in grouped entries: one DN per spec for its [HUMAN] decisions (kernel DN-KN1…KN6 for the CSO; config DN-CFG-1…3; tenancy DN-T1, DN-T2; tasks DN-TK1…TK7; workflow DN-W1, DN-W2, stop-and-ask item 2; journal DN-J1 for WP-0.2), one OQ per spec pointing to its list, KAs as code makes them true; hazard candidates go to the CSO as one OQ.
3. Then `:platform:events`, `:platform:journal` (schema, migrations, jOOQ repository; PostgreSQL tests written and recorded as waiting for the cell), `platform-tenancy`, `platform-config`, `platform-tasks`, `platform-workflow` (port only), `app-hms` with the Spring Modulith verification.
4. Uncommitted Gradle wiring waits for its slice: `backend/settings.gradle.kts`, `backend/gradle/libs.versions.toml` (`spring-modulith-core`), the empty project skeletons under `backend/platform/`, `backend/modules/` and `backend/app-hms/`.

## Blocked / waiting on humans
- DN-005, DN-011 as before.
- For the CSO, filed in the specs and to be numbered (step 2): the SI-10 entry-time tolerances (DN-KN1; until answered every entry that needs a timing policy is refused), "audited" comparison API, the KB comparisons, unit-less doses, clinical number display, entry-timing labels and offline capture (DN-KN2…KN6); kill-switch engagement without an authorisation decision and the meaning of "vendor-locked" for SI-19 (DN-CFG-2, -3); calendar-aware safety timers and the other task-engine readings (DN-TK1…TK7); the CTRL-0018-1 reading (DN-T1).
- Waiting on WP-0.2 (the cell): the Debezium → Kafka pipeline with Apicurio, the Temporal adapter, the journal-rebuild and per-patient-ordering exit tests, the `TaskOrphaned` chaos test, persistence-backed lock evidence.

## Read next: BUILD-PROMPT top through §3; §5.2, §5.3, §6.1 to §6.8, §7 items 1, 3, 4, 6, 9; §8.1, §8.3, §8.5; §21 (WP-0.3) and §22; `docs/specs/modules/platform-*.md` and `docs/specs/events/*.md`
