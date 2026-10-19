# Your assignment: WP-0.3 Platform kernel, the cluster-free parts (MacBook, account A7a)

- **Branch:** `wp/0.3-platform-kernel`.
- **Worktree:** `~/src/hms-wp03`. You create it at the hand-over (step 3).
- **Limiter label:** `wp03`.
- **ID ranges:** DN-040…DN-049, OQ-170…OQ-199, KA-045…KA-059, HAZ-0035…HAZ-0039, ADR-031…ADR-034. Some are already used on the branch; check before numbering.
- **Work package file:** `docs/program/work-packages/WP-0.3.md`. Read its "Read first" list in full.
- **Backend conventions:** the backend is Kotlin on the JVM with Gradle under `backend/`. Follow its conventions: convention plugins in `backend/build-logic`, existing modules `:platform:arch-rules` and `:platform:testing`.

## Hand-over from the Windows laptop (do this first)
1. **Signal that the Mac is ready.** Do this after setup (SETUP.md) is done:
   ```
   cd ~/src/hms-kurdistan && git fetch origin
   git push origin refs/remotes/origin/wp/0.3-platform-kernel:refs/hms/mac-ready/wp-0.3
   ```
   If the push is rejected because the ref already exists, that's fine.
2. **Wait for the hand-over ref** `refs/hms/handover/wp-0.3` on GitHub. The Windows lead creates it after its stream has stopped at a checkpoint and its last state is uploaded; that can take an hour or more. Wait in the background:
   ```
   until git ls-remote --exit-code origin refs/hms/handover/wp-0.3 >/dev/null 2>&1; do sleep 60; done
   ```
   Re-arm the wait if it times out. While waiting, read only (never edit):
   - BUILD-PROMPT §1–§3, §21 and §22 and the WP file's "Read first" sections;
   - the branch, with `git show origin/wp/0.3-platform-kernel:<path>`;
   - the Windows side's latest uncommitted save:
     ```
     git fetch origin refs/wip/windows/wp/0.3-platform-kernel:refs/hms/windows-wip/wp-0.3
     git show refs/hms/windows-wip/wp-0.3:docs/program/STATUS.md
     ```
     Don't start any work from that save; the Windows side may still change it.
3. **Take over:**
   ```
   cd ~/src/hms-kurdistan
   git fetch origin
   git fetch origin refs/hms/handover/wp-0.3:refs/hms/handover/wp-0.3 +refs/hms/mac-handoff:refs/hms/mac-handoff
   git show refs/hms/mac-handoff:NOTE-wp-0.3.md
   ```
   NOTE-wp-0.3.md is the Windows lead's hand-over note. Read it, and the Windows stream's working notes under `notes-wp-0.3/` in the same ref. Then:
   ```
   git worktree add ~/src/hms-wp03 wp/0.3-platform-kernel
   H=$(git rev-parse refs/hms/handover/wp-0.3); B=$(git -C ~/src/hms-wp03 rev-parse HEAD)
   ```
   - If `$H` = `$B`, there is no uncommitted work to restore.
   - Else, if `$(git rev-parse $H^1)` = `$B`, restore the uncommitted work:
     ```
     git -C ~/src/hms-wp03 restore --source=$H --worktree -- .
     ```
   - Otherwise STOP. Don't guess. Push a report saying the hand-over ref doesn't match the branch.

   Then link the toolchain, install the frontend and claim the branch for the auto-save:
   ```
   ln -s ~/src/hms-kurdistan/.tools ~/src/hms-wp03/.tools
   cd ~/src/hms-wp03/frontend && COREPACK_HOME=~/src/hms-kurdistan/.tools/corepack corepack pnpm install --frozen-lockfile --offline
   echo wp/0.3-platform-kernel >> ~/.hms-snapshot/branches
   ```
   From now on the branch is yours. Run `git -C ~/src/hms-wp03 status` and compare it with the note's list of what was uncommitted on Windows.
4. **Continue** from STATUS.md's "Next exact step" and the note.

## In scope now (no cluster needed). These are the original assignment's points.
1. **Module specifications first:** `docs/specs/modules/platform-*.md` for the kernel libraries, the journal, events, the enterprise hierarchy and configuration chain, configuration bundles, flags and kill switches, and the task engine (§3.2).
2. **Platform libraries** under `backend/platform/` (package `hms.kernel.<lib>`):
   - UUIDv7 identifiers;
   - the injected `Clock` (never `now()` inside the domain);
   - clinical (valid) time distinct from recorded time;
   - `Money` (BigDecimal plus ISO 4217, explicit rounding, never floating point);
   - `Quantity` with UCUM units, so a unit-less dose cannot form a valid command (§6.2).

   Add property tests where they fit.
3. **The enterprise hierarchy and the configuration chain with locks:** vendor foundation → Kurdistan pack → tenant → legal entity → facility → department → unit → user.
   - The most specific level wins unless a parent locked the setting.
   - Safety invariants and Tier 2 activation are vendor-locked.
   - The exit criterion "a locked setting cannot be overridden below its lock" can be evidenced at domain level now; persistence-backed evidence may wait.
4. **Signed configuration bundles** (ADR-020): a typed registry, change sets, signing with test-only keys generated at test time, promotion BUILD → TEST → TRAIN → PROD, three-way merge, and no customer branches.
5. **Flags and kill switches (SI-19):** every CDS rule and clinical-behaviour flag has a kill switch, safety-relevant changes default to off, and flag changes are audited.
6. **The task engine domain** (`platform-tasks`, Safety Kernel, SI-03):
   - owner, SLA, escalation chain and state;
   - `TaskOrphaned` within 5 minutes for unowned or unroutable work, driven by the injected Clock so unit tests prove the timing;
   - calendar-aware SLA timers where a tenant calendar applies.

   The chaos-test exit criterion waits for the cell.
7. **`WorkflowPort`:** the port only. The Temporal adapter waits for the cell, and no Temporal types appear outside the adapter (ADR-010).
8. **The journal-as-outbox** (`PLT-CORE-01`, ADR-004): the module spec, the schema and migrations, and the domain and repository code. It is append-only, written in the same transaction, never updated, supports as-was queries and has rebuildable read models. Tests that need a real PostgreSQL are written and recorded as waiting for the cell.
9. **The domain-event catalogue** starts in `docs/specs/events/` (§8.5), with the CloudEvents 1.0 envelope rules. The Debezium, Kafka and Apicurio wiring waits for the cell.
10. **Architecture tests** for the new modules: Spring Modulith verification, ArchUnit layering, and `domain` free of framework types (§6.8 item 3).

## Waits (record it, do not build it now)
- the Debezium → Kafka pipeline;
- the Temporal adapter;
- the journal-rebuild and per-patient ordering exit tests against real infrastructure;
- the `TaskOrphaned` chaos test.

## Coordination
The clinical state machines stream (`wp/0.5-state-machines`, the other Mac thread) needs your `Clock`, identifier and `Quantity` types. Keep their public API small and stable, described in the module spec, and commit the specs early.

## Safety classification for the review policy
- **Full review:** time (Clock, clinical vs recorded time), Quantity/UCUM, the journal, the task engine (SI-03) and kill switches (SI-19).
- **One pass:** Gradle wiring, the ID helpers' plumbing and docs scaffolding.
