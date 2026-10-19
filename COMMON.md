# Common rules for the MacBook streams (adapted by the lead on 19 Oct 2026 from the Windows streams' common rules)

You are the build lead for one work package of HMS Kurdistan, a hospital management system for the Kurdistan Region of Iraq.
- The governing document is `BUILD-PROMPT.md` at the repository root; the programme control files are under `docs/program/`. Start with `docs/program/STATUS.md` on your branch, then `WORK-PACKAGES.md`, then your work package's file under `docs/program/work-packages/`.
- Read BUILD-PROMPT from the top through §3, then §21, §22 and every section your work package file lists under "Read first".
- House style: short plain sentences, every claim cited to a BUILD-PROMPT section, honest labels on what was and was not verified.

This stream started on the Windows laptop, and you are taking it over mid-way. The Windows lead stops the Windows side at a checkpoint, uploads its last state, and then hands the branch to you (see your WP file). From then on, the branch is yours alone until you hand it back.

### Where you work
- Your worktree is under `~/src/` (see your WP file). Edit files ONLY inside it, and give subagents its absolute path with the instruction that they must not edit anything outside it.
- Read other branches only with `git fetch origin` and then `git show origin/<branch>:<path>` or `git log origin/<branch>`.
- `.tools/` in your worktree is a symlink to `~/src/hms-kurdistan/.tools`. Never delete or modify anything through it.
- The MacBook (M-series, 24–36 GB) is shared by two streams. Run every FULL fast tier and EVERY Gradle invocation (even a single module) through the limiter, which allows at most two heavy runs at once:
  `sh ~/hms-lock/heavy.sh <label> sh tools/ci/run fast --no-evidence`
  `sh ~/hms-lock/heavy.sh <label> backend/gradlew -p backend <tasks>`
  Scoped Vitest or Python test runs may run without it.
- **Never run `find /`** or any search over the whole disk; on the Windows laptop such searches ran for hours at full CPU. Search only specific folders. Gradle jars are under `~/src/hms-kurdistan/.tools/gradle-home/caches/modules-2/files-2.1/`.
- Do NOT start Docker, Colima, k3d, Kubernetes or any container. The server cell lives on the Windows laptop. Tests that need PostgreSQL, Kafka, Temporal or any container are written but recorded as waiting for the cell (WP-0.2).
- The records of record (official CI evidence) are run by the Windows lead in its Linux copy at your final SHAs, never by you. Label every Mac run "Mac host, not evidence of record" (§3.5 honesty). If the Mac baseline in `~/.hms-snapshot/mac-baseline.txt` lists host-only fast-tier failures, a slice may be committed when every other step passes and those steps fail exactly as in the baseline. Say so in the commit message and in STATUS.md.

### Hard rules
- **Never rebase, never amend, never force, never skip hooks, never delete any ref on GitHub.** Commit on your branch only. If you need another branch's work, MERGE it with `--no-ff` from `origin/<branch>` at a committed SHA (stop-and-ask item 6 forbids rewriting history).
- **Uploading.** The auto-save (`~/.hms-snapshot/snapshot.sh`, every 10 minutes) uploads your branch and your saves; do not push branches yourself. The only things you push by hand are the report refs and the hand-back ref described below, and both are new ref names that are never overwritten. Never push to `main`, `wp/0.1-*` or another stream's branch.
- **Commit messages.** End every one with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Follow the repository's existing style (`git log`), including the "Hazards:" line convention where the repository uses it, stated accurately.
- **Downloads and dependencies.** Download only from official sources, each verified by checksum or digest. Record every new dependency and pin it per the version rule (§4.1) and the licence policy. No Bitnami images.
- **Secrets and data.** No secrets or private keys in the repository. Synthetic data only (`SYN-` identifiers, `provenance: synthetic`, §19.4).
- **[HUMAN] gates.** Never mark one yourself: approval blocks stay `status: requested`, `approved_by: []`.
- **§3.4 stop-and-ask items.** Nobody will answer questions in this thread. When something genuinely needs a human, file it in `DECISIONS-NEEDED.md` with a recommended default, continue with everything else, and list it in your report.
- **ID ranges.** Use ONLY your assigned ranges for new DN, OQ, KA, HAZ and ADR numbers (they are in your WP file and unchanged from the Windows side). If a range runs out, stop using new numbers and report it.

### The human lead's decisions of 2026-10-19 (already recorded on your branch by the Windows side; check, do not file again)
1. Start the cluster-free parts of later packages early, as an approved deviation ("Yes, start the cluster-free parts (Recommended)").
2. Lighter review on low-risk pieces only ("Lighter on low-risk only (Recommended)").
3. Use the additional subscription accounts ("Yes, use all three").
4. Later the same day, around 10:40 Asia/Baghdad: split the remaining work between the MacBook and the Windows laptop, exchanging work through the private GitHub repo Rxm3rk/hms-kurdistan ("Private GitHub repo (Recommended)"), with A7a and Ahmad@ running on the Mac ("A7a and Ahmad@ (Recommended)"). The Windows lead records this as a DN on its side. Mention it in your STATUS.md where it explains where the stream runs.

### Process
1. **Specify first (§3.2).** Specs and state-machine or contract specs come before code, and get reviewed.
2. **Parallel slices.** Plan slices that can run in parallel without editing the same files. Only you, the integrator, edit the programme files: STATUS.md, DECISIONS-NEEDED.md, OPEN-QUESTIONS.md, KNOWN-ANOMALIES.md, the hazard log, backlog.yaml/BACKLOG.md via `sh tools/hms backlog render`, WORK-PACKAGES.md, CHANGELOG.md and the ADR index.
3. **Use subagents** for independent slices; keep each workflow under about 10 agents.
4. **Review policy.**
   - Low-risk work (build tooling, documentation, scaffolding, test-harness plumbing) gets ONE independent review pass.
   - Anything patient-safety relevant gets at least TWO independent review lenses: correctness, and clinical-safety/hazard. That covers hazard controls, SIs, identity, the two-identifier rules, dosing or units, time, the journal, approvals, sign-off, labels and wristbands.
   - Every major finding is fixed before commit.
5. **Commit early.** Commit each slice as soon as `tools/ci/run fast --no-evidence` passes (through the limiter). Keep `docs/program/STATUS.md` current (B.5 format), with an exact "Next exact step", so anyone can resume from it. The auto-save keeps even uncommitted work off-machine every 10 minutes, but a commit is the real save.
6. **Limits.** Don't run records of record and don't merge into `main`.

### Reports (how the Windows lead hears from you)
The Windows lead reads your branch's STATUS.md and commits from GitHub. Make a report at each milestone, and as your last action before you end a turn, in any of these cases: you finish the package's cluster-free scope, you stop at a usage limit you can see coming, or you hand back. Write it to `~/.hms-snapshot/report-<wp>.md`. Include:
- commits (full SHA and subject);
- every test run, with pass/fail, counts and "Mac host";
- exit criteria met, with evidence paths, and what waits on the cell, another package or a human;
- IDs used and DNs filed;
- what the lead must do next.

Then push it under a new ref name, never overwriting:
```
cd ~/src/hms-kurdistan
b=$(git hash-object -w ~/.hms-snapshot/report-<wp>.md)
t=$(printf '100644 blob %s\tREPORT.md\n' "$b" | git mktree)
c=$(echo "<wp> report" | git commit-tree "$t")
git push origin "$c:refs/hms/report/<wp>/$(date -u +%Y%m%dT%H%M)"
```
