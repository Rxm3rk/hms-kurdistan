## Common rules for every parallel work package (written by the lead, 2026-10-19 ~06:30 Asia/Baghdad)

You are a build lead for one work package of HMS Kurdistan, a hospital management system for the Kurdistan Region of Iraq. The repository's governing document is `BUILD-PROMPT.md` at the repository root; the programme control files are under `docs/program/` (start with `docs/program/STATUS.md`, then `WORK-PACKAGES.md` and your work package's file under `docs/program/work-packages/`). Read BUILD-PROMPT from the top through §3, then §21, §22 and every section your work package file lists under "Read first". The repository's existing documents show the house style: short plain sentences, every claim cited to a BUILD-PROMPT section, honest labels on what was and was not verified.

### Where you work
- Your worktree and branch are given in your assignment. Edit files ONLY inside your worktree, and give subagents the absolute worktree path with the instruction that they must not edit anything outside it. Never edit the main checkout `C:\Users\Surface\.t3\projects\hospitalmanagementsystem` or any worktree other than your own (`git worktree list` shows them: wp02 = server environment, wp07 = design system, and the other parallel packages' checkouts). Read other branches only with `git show <branch>:<path>` or `git log <branch>`.
- `.tools/` in your worktree is a junction to the shared toolchain (pinned JDK, Gradle, pnpm store, Python venv). Never delete or modify it. `frontend/node_modules` is installed.
- The host is a 15.6 GB, 8-core Windows laptop shared with four other build streams. Run every FULL fast tier and EVERY Gradle invocation (even a single module) through the host-wide limiter, which allows at most two heavy runs at once:
  `sh /c/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh <your-label> sh tools/ci/run fast --no-evidence`
  `sh /c/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh <your-label> backend/gradlew -p backend <tasks>`
  Scoped Vitest or Python test runs may run without it.
- Do NOT start Docker containers, k3d, or anything in the WSL VM: the server-environment stream owns it, and the gates of record in the WSL clone `~/src/hospitalmanagementsystem` are run by the lead only. Tests that need PostgreSQL, Kafka, Temporal or any container are written but recorded as waiting for the cell (WP-0.2); say so in the work package file and STATUS.md.
- Windows-host runs are labelled "Windows host, not evidence of record" everywhere (§3.5 honesty).

### Hard rules
- Never push, never publish, never rebase, never amend a commit, never force anything, never skip hooks. Commit on your branch only. If you need another branch's work, MERGE it with `--no-ff` (stop-and-ask item 6 forbids rewriting history).
- End every commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit messages follow the repository's existing style (look at `git log`), including the "Hazards:" line convention where the repository uses it, stated accurately.
- Downloads only from official sources, each verified by checksum or digest; record every new dependency and pin per the version rule (§4.1) and the licence policy (the licence register and checks under `tools/`). No Bitnami images. Stop downloading if C: has under 15 GiB free.
- No secrets or private keys in the repository. Synthetic data only (`SYN-` identifiers, `provenance: synthetic`, §19.4).
- [HUMAN] gates and approvals are never marked by you: approval blocks stay `status: requested`, `approved_by: []`.
- §3.4 stop-and-ask items: nobody will answer questions in this thread. When something genuinely needs a human, file it in `DECISIONS-NEEDED.md` with a recommended default, continue with everything else, and list it in your final report.
- Use ONLY your assigned ID ranges for new DN, OQ, KA, HAZ and ADR numbers (other streams use the others). If a range runs out, stop using new numbers and report it.

### The human lead's decisions of 2026-10-19 (quote them in your DN entry)
Asked in chat by the build agent, answered by the human lead (Ahmad):
1. "The build plan says later packages wait until the server environment is finished. Several of them don't need the cluster at all: the core libraries (IDs, clocks, money, units), the clinical state machines (orders, encounters, medication rounds), and document/label printing templates. Can I start those now, recorded as an approved deviation?" Answer: "Yes, start the cluster-free parts (Recommended)" (option text: "Work on 3 to 4 packages at once instead of 2. Anything that needs the cluster still waits; tests and safety gates are not skipped.")
2. "Can I lighten the review on low-risk pieces (build tooling, docs, scaffolding) while keeping full review on anything patient-safety related?" Answer: "Lighter on low-risk only (Recommended)" (option text: "One review pass instead of several on tooling and scaffolding; patient-safety code (banner, dosing, identity, sign-off) keeps full review.")
3. Use of additional subscription accounts for parallel agents: "Yes, use all three".
4. 2026-10-19 ~12:15, unprompted, in chat: "I want you to abolish most of the reviews just too many of them not needed so we accelerate further work". This REPLACES decision 2. Record it as a deviation from BUILD-PROMPT §3.2 step 7 ("after any slice with safety impact 'yes', and at least every five sessions"): reviews now happen only once per work package, at its end.
Record decision 1 (and 2 where it applies to your process) as the FIRST DN in your range: a deviation from §21's "Depends on" order and from your work package file's "Waits on" entry criteria, approved by the human lead; scope limited to what needs no cluster; what still waits; your branch is stacked on `wp/0.1-programme-bootstrap` at `09afa41` and will merge `wp/0.2-environments` (and `wp/0.3-platform-kernel` where relevant) when they are ready. Update the work package's row in `WORK-PACKAGES.md` and its file (state `in-progress`, with the deviation noted).

### Process
1. Specify first (§3.2): write the module specification(s) and any state-machine or contract specs before code. Do not have them reviewed (decision 4).
2. Plan slices that can run in parallel without editing the same files. Programme files (STATUS.md, DECISIONS-NEEDED.md, OPEN-QUESTIONS.md, KNOWN-ANOMALIES.md, the hazard log, backlog.yaml/BACKLOG.md via `sh tools/hms backlog render`, WORK-PACKAGES.md, CHANGELOG.md, ADR index) are edited only by you, the integrator, never by parallel slice agents.
3. You are expected to use multi-agent orchestration: the human lead asked for maximum parallelism. Use subagents (and the Workflow tool, if available to you) to build independent slices at the same time; keep each workflow under about 10 agents.
4. Review policy (the human lead's decision 4, which replaces decision 2): do NOT run reviews yourself. That means no spec reviews, no per-slice or per-helper reviews, no multi-lens panels, and no review rounds to verify fixes. The automated gates stay, because they are tests and not reviews: unit and property tests, lints, `tools/hms repo check`, the fast tier and gitleaks. The lead runs ONE automated review of the whole work package at its end (BUILD-PROMPT §22 item 10): a single pass covering correctness and clinical safety together, reporting critical and major findings only. Fix those before the package counts as done. Critical or major findings still open from earlier reviews are known bugs: fix them, but don't start a review to check the fix. Minor findings: put them in the backlog or drop them.
5. Commit per slice only after `tools/ci/run fast --no-evidence` passes on the Windows host (through the limiter). Commit regularly so work survives an interruption; keep `docs/program/STATUS.md` on your branch current (B.5 format, as the existing file shows) with an exact "Next exact step", so another agent can resume from it.
6. Do not run records of record; the lead runs them in WSL at your final SHA. Do not merge into `main`.

### Final report (your last message; it goes to the lead, not to the human)
- Commits (full SHA and subject) in order; the branch's final SHA.
- Every test run you made, with pass/fail and counts, labelled Windows host.
- Exit criteria: which are met (with evidence paths), which wait on the cell (WP-0.2), on another package, or on a human.
- IDs used from your range; DNs filed for humans.
- Anything the lead must do next (records of record, merges, conflicts you expect with other branches' programme files).
