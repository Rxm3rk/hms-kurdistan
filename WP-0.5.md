# Your assignment: WP-0.5 State machines and invariants (MacBook, account Ahmad@)

- **Branch:** `wp/0.5-state-machines`.
- **Worktree:** `~/src/hms-wp05`. You create it at the hand-over (step 3).
- **Limiter label:** `wp05`.
- **ID ranges:** DN-050…DN-064 (one approval-request DN per machine, eight machines), OQ-200…OQ-229, KA-060…KA-074, HAZ-0040…HAZ-0044, ADR-035…ADR-037. Some are already used on the branch; check before numbering.
- **Work package file:** `docs/program/work-packages/WP-0.5.md`. Read its "Read first" list in full: §2.1, §2.4, §3.5, §8.4, §18.1–§18.3, §18.5, §19.1, Appendix B.2, B.3, A.20; research R11 §10 and §15; K §5.

## Hand-over from the Windows laptop (do this first)
1. **Signal that the Mac is ready.** Do this after setup (SETUP.md) is done:
   ```
   cd ~/src/hms-kurdistan && git fetch origin
   git push origin refs/remotes/origin/wp/0.5-state-machines:refs/hms/mac-ready/wp-0.5
   ```
   If the push is rejected because the ref already exists, that's fine.
2. **Wait for the hand-over ref** `refs/hms/handover/wp-0.5` on GitHub. The Windows lead creates it after its stream has stopped at a checkpoint and its last state is uploaded; that can take an hour or more. Wait in the background:
   ```
   until git ls-remote --exit-code origin refs/hms/handover/wp-0.5 >/dev/null 2>&1; do sleep 60; done
   ```
   Re-arm the wait if it times out. While waiting, read only (never edit):
   - BUILD-PROMPT and the WP file's "Read first" sections;
   - the branch, with `git show origin/wp/0.5-state-machines:<path>`;
   - the Windows side's latest uncommitted save:
     ```
     git fetch origin refs/wip/windows/wp/0.5-state-machines:refs/hms/windows-wip/wp-0.5
     git show refs/hms/windows-wip/wp-0.5:docs/program/STATUS.md
     ```
     Don't start any work from that save; the Windows side may still change it.
3. **Take over:**
   ```
   cd ~/src/hms-kurdistan
   git fetch origin
   git fetch origin refs/hms/handover/wp-0.5:refs/hms/handover/wp-0.5 +refs/hms/mac-handoff:refs/hms/mac-handoff
   git show refs/hms/mac-handoff:NOTE-wp-0.5.md
   ```
   NOTE-wp-0.5.md is the Windows lead's hand-over note. Read it, and the Windows stream's working notes under `notes-wp-0.5/` in the same ref: the phase-2 brief, contracts, agent and reviewer rules, and DN notes. They were in `%TEMP%\wp05\` on Windows. Put a working copy at `~/.hms-snapshot/wp05-notes/` and use that path wherever the notes say `%TEMP%\wp05\`. Then:
   ```
   git worktree add ~/src/hms-wp05 wp/0.5-state-machines
   H=$(git rev-parse refs/hms/handover/wp-0.5); B=$(git -C ~/src/hms-wp05 rev-parse HEAD)
   ```
   - If `$H` = `$B`, there is no uncommitted work to restore.
   - Else, if `$(git rev-parse $H^1)` = `$B`, restore the uncommitted work:
     ```
     git -C ~/src/hms-wp05 restore --source=$H --worktree -- .
     ```
   - Otherwise STOP. Don't guess. Push a report saying the hand-over ref doesn't match the branch.

   Then link the toolchain, install the frontend and claim the branch for the auto-save:
   ```
   ln -s ~/src/hms-kurdistan/.tools ~/src/hms-wp05/.tools
   cd ~/src/hms-wp05/frontend && COREPACK_HOME=~/src/hms-kurdistan/.tools/corepack corepack pnpm install --frozen-lockfile --offline
   echo wp/0.5-state-machines >> ~/.hms-snapshot/branches
   ```
   From now on the branch is yours. Regenerate with `sh tools/hms statemachines generate` and check that the result matches the restored generated files. Compare `git status` with the note.
4. **Continue** from STATUS.md's "Next exact step" and the note.

## Scope (almost all of it needs no cluster). These are the original assignment's points.
1. **Executable specifications** `docs/specs/state-machines/<name>.yaml`, each with a `.md` explanation (template B.3), for: encounter, order, medication administration, specimen, result, bed, appointment and credit claim (§8.4).
   - Guards are lists of named predicates, with prose in a `description` field.
   - Transitions R11 leaves undrawn are marked "proposed" (A.20): medication administration scheduled → completed and scheduled → not-done; specimen rejection from received and in process; the bed's blocked and closed entry and exit paths.
2. **Align the YAML format** with the patient-context machine on the design-system branch: `git show origin/wp/0.7-design-system:docs/specs/state-machines/patient-context.yaml` and its `.md`. Record any difference as a decision. A shared schema must also validate the patient-context spec.
3. **The generator.** The YAML drives generated Kotest property-test models.
   - The generator FAILS on an unknown predicate.
   - Each predicate is implemented once in the module's domain package and unit-tested.
4. **Property tests:**
   - about 1,000 sequences per machine in the fast tier;
   - the 10⁶-sequence nightly run wired into the nightly tier (`tools/ci/run nightly --list` shows the NOT-BUILT step);
   - record the actual sequence counts.
5. **A test scaffold per SI** (SI-01…SI-21), with a named test for each. How an SI test whose domain does not exist yet reports is decided under §3.5: no silent stubs, never skipped, quarantined or weakened.
6. **The scenario-suite framework** (§18.5) under `tests/`, for the nightly tier.
7. **Approval requests** in `DECISIONS-NEEDED.md`, one per machine, naming the approvers §8.4 gives (OQ-083). Every approval block reads `status: requested`, `approved_by: []`, `record: null`.

## Coordination
WP-0.3 (platform kernel: Clock, UUIDv7, Quantity) is built on `wp/0.3-platform-kernel` by the other Mac thread. Don't create competing kernel types: use `java.time` types or a minimal interface of your own inside the generated-model test code. Note in STATUS.md that the predicates move onto the kernel types when `wp/0.3-platform-kernel` is merged in (with `--no-ff`, at a committed SHA).

## Safety classification for the review policy
These machines are the core of H1 wrong patient, H2 wrong drug/dose/route/time, H3 missed or late result, H5 orphaned work and H6 data loss.
- **Full review:** every machine spec, every predicate and the SI scaffold get a correctness lens plus a clinical-safety lens that checks every transition against §8.4, R11 §10 and A.20.
- **One pass:** the generator plumbing and the CI wiring.
