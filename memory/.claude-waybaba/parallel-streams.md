---
name: parallel-streams
description: "19 Oct 2026 human-approved acceleration - extra Claude accounts, cluster-free WP-0.3/0.5/0.8 started early, lighter review on low-risk work; task IDs, ID ranges and the heavy-run limiter"
metadata:
  node_type: memory
  type: project
  originSessionId: a7252630-2217-4120-a4d4-d624bcd2935a
  modified: 2026-10-19T09:23:13.081Z
---

On 2026-10-19 ~06:30 the human lead (Ahmad) said "keep going and catalyze this process" and answered three questions:
1. Use the other subscription accounts A7a (`claudeAgent_a7a`), Ahmad@ (`claudeAgent_ahmad`) and mi (`claudeAgent`) for parallel agents: "Yes, use all three". API_ahmad (pay-per-use) stays OFF.
2. Start the cluster-free parts of later packages before WP-0.2 finishes, recorded as an approved deviation from §21: "Yes, start the cluster-free parts".
3. (SUPERSEDED 12:15 by [[review-policy]]) Lighter review on low-risk work: "Lighter on low-risk only".

**Why:** the user felt months was too long; the critical path WP-0.2 → 0.3 → {0.4, 0.5, 0.8} → 0.6 → 0.9 serialised everything.

**How to apply:**
- Delegated tasks (T3 delegate_task, isolation worktree, opus-5-5 high), briefs in `%TEMP%\hms-accel\{common,wp03,wp05,wp08}.md`:
  - WP-0.3 platform kernel on A7a, branch `wp/0.3-platform-kernel`, clientRequestId `hms-accel-wp03-r1`; IDs DN-040…049, OQ-170…199, KA-045…059, HAZ-0035…0039, ADR-031…034.
  - WP-0.5 state machines on Ahmad@, branch `wp/0.5-state-machines`, `hms-accel-wp05-r1`; DN-050…064, OQ-200…229, KA-060…074, HAZ-0040…0044, ADR-035…037.
  - WP-0.8 documents/printing on mi, branch `wp/0.8-documents-printing`, `hms-accel-wp08-r1`; DN-065…074, OQ-230…259, KA-075…089, HAZ-0045…0049, ADR-038…040.
  - Worktrees (T3-created): wp/0.3 → `worktrees\hospitalmanagementsystem\t3-4f6f2a03`, wp/0.5 → `t3-5dcdaa39`, wp/0.8 → `t3-406132fc` (each has the .tools junction and frontend node_modules).
  - Next free after these: DN-077, OQ-260, KA-091, HAZ-0050, ADR-041 (DN-075, DN-076 and KA-090 went to the lead / WP-0.2 on 19 Oct).
- All branch from wp/0.1 `09afa41`; they merge wp/0.2 / wp/0.3 / wp/0.7 later with --no-ff (never rebase). Children may not touch WSL/Docker; the lead (WayBaba thread) runs records of record in WSL at their final SHAs.
- Host limiter `%TEMP%\hms-lock\heavy.sh <label> <cmd>`: two slots (second only with ≥3.5 GB free) for full fast tiers and all Gradle runs.
- delegate_task isolation:"worktree" creates `t3/*` branches; `tools/hms repo check` (fast tier) FAILS on any branch not named main / wp/<n.m>-<slug> / release/ / hotfix/. After each such launch, once the child has switched to its wp/* branch, delete the t3/* branch if it still points at the start commit (done 08:05 on 19 Oct for all three).
- 07:55 19 Oct: the WP-0.3 child (A7a) stopped at "session limit · resets 11:20am (Asia/Baghdad)" with six specs written, reviewed (28 critical/~170 major findings fixed) and mid-alignment (39 cross-spec mismatches), all UNCOMMITTED in `t3-4f6f2a03`; it filed DN-040 (deviation) and DN-041 (t3 branch names; now resolved by the lead). Resume after 11:20 with t3_thread_send to its childThreadId `thread:delegated-task:command%3Amcp%3Adb466c54-6560-4bf1-a83c-b4fa263481ab%3Adelegate-task%3Ahms-accel-wp03-r1` (keeps its context): tell it to re-check the alignment, commit the specs, mark DN-041 resolved, continue.
- 08:50 19 Oct: WP-0.8 (mi) and WP-0.5 (Ahmad@) also hit "session limit · resets 11:20am" (all three were launched ~06:20, so their 5-hour windows end together). WP-0.8 had nothing committed: specs staged, ~200 code files untracked in `t3-406132fc`; the limit killed slices A, B, F, a review and its final test run. One-shot session cron 6860a383 at 11:23 resumes all three via t3_thread_send (the hourly heartbeat at :46 is the fallback if the session restarted). Later launches should be staggered so the accounts don't all stall at once.
- 09:20 19 Oct: the user asked "you're still on the API account, right? we have plenty of credits". This thread runs on WayBaba, an OAuth subscription; `.claude-api` uses apiKeyHelper. Asked which account to use, they chose "WayBaba now, no extra cost". API_ahmad stays off.
  - Steps taken: all three child threads were moved to `claudeAgent_waybaba` with `t3_thread_configure` (opus-5-5, effort high) and resumed with t3_thread_send (`hms-accel-wp0X-resume-waybaba-1`). After the switch, the WP-0.8 child began by re-reading its briefs and the disk state, so the earlier conversation may not have carried over in full. That is why resume messages must stand on their own.
  - WP-0.5 first had a queued "Background task completed" run that would have waited for the reset; it was cancelled with `t3_queue_cancel`.
  - Each child was told to end its turn at a checkpoint after 11:20. Cron 6860a383 was replaced by one-shot e19d6457 at 11:27, which moves them back to a7a, ahmad and claudeAgent and sends "continue".
- 09:58 19 Oct: CPU was at 100%. The cause was runaway Git Bash `find /` whole-drive searches started by children. One was orphaned by the limit (NotoSansArabic, running 3 h); another was looking for a kotest jar. I killed both and told all three children never to use `find /`, pointing them at `.tools\gradle-home\caches\modules-2\files-2.1\` and `.tools\pnpm-store\`. Check `Get-CimInstance Win32_Process -Filter "Name='find.exe'"` whenever the host is slow.
- Switch-back cron is now 604f214e (11:27). It moves a child back only if its last message is the checkpoint report and not "waiting for agents", because switching accounts would orphan that child's background subagents.
- 11:37 19 Oct: the switch-back cron fired. All three children were "completed" but their last messages were "waiting for …" (WP-0.3: the Python suite and library slices; WP-0.5: the harness-fix agent before the S1 commit; WP-0.8: slices A/B/C/F and the kit's fast tier). Their background subagents are still running, so nothing was switched. They stay on WayBaba.
  - When a child's next completion notification brings the checkpoint report, switch it back to its own account.
  - For WP-0.3 and WP-0.5, if `refs/hms/mac-ready/wp-0.X` exists on GitHub by then, run the Mac hand-over in [[mac-split]] instead of switching back.
- 11:55 19 Oct: the user said the other accounts were back and asked me to set them up. Findings:
  - T3 had flagged A7a and mi as "CLI failed to run, timed out". That was only host load (CPU 100%, 1.7 GB RAM free, Defender heavy).
  - `claude auth status` and a haiku test prompt worked on all three (config dirs: A7a `~/.claude-a7a`, Ahmad@ `~/.claude-sub`, mi `~/.claude`).
  - Each child was asked (`hms-accel-wp0X-checkpoint-req-1`) to let its running helpers finish, start no new ones, commit what's verified, then end with "CHECKPOINT READY".
  - Recurring session cron 1424763a (:07/:22/:37/:52) switches each child back once it reports CHECKPOINT READY, or runs the Mac hand-over for 0.3/0.5 if mac-ready exists. It deletes itself when all three are done.
  - The laptop, not the accounts, is now the limit: don't add new work streams here; extra capacity should go to the Mac.
- ~12:30 19 Oct: the user, angry, said "JOIN THE OTHER ACCOUNTS TOO" and "finish the frontend from A to Z right now". The Mac is postponed ([[mac-split]]).
  - The three spare accounts now also each run a prototype-screens task in hms-demo ([[boss-demo]]).
  - WP-0.3 → A7a and WP-0.8 → mi switched back at their CHECKPOINT READY (last commits 1b00abe and a0c4e73; library slices still uncommitted, but protected by the auto-save). Resumed with `hms-accel-wp0X-switchback-1`.
  - WP-0.5 is still on WayBaba, waiting on its order-machine Gradle run. Cron 1424763a will switch it to Ahmad@.
- If a child stops at its account's usage limit, resume with a new delegate_task round (new clientRequestId, e.g. `-r2`) pointing at the same branch and STATUS.md "Next exact step".
- Related: [[overnight-run]], [[project-phase]].
