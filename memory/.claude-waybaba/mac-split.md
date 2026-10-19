---
name: mac-split
description: "19 Oct 2026: work split across the MacBook and the Windows laptop through the private GitHub repo Rxm3rk/hms-kurdistan; core libraries and state machines move to the Mac; the exact hand-over procedure and refs"
metadata:
  node_type: memory
  type: project
  originSessionId: a7252630-2217-4120-a4d4-d624bcd2935a
  modified: 2026-10-19T09:13:49.603Z
---

**POSTPONED 2026-10-19 ~12:15:** the user said "the mac is not gonna join yet". WP-0.3 and WP-0.5 stay on Windows and switch back to A7a and Ahmad@. I stopped the 2-minute watcher; the hourly heartbeat still checks the refs. The hand-over pack stays on GitHub for later. Don't remind the user about the Mac setup unless they bring it up.

On 2026-10-19 around 10:40 the human lead (Ahmad) decided, via AskUserQuestion:
- Split the remaining work between their MacBook and this Windows laptop, exchanging work through a "Private GitHub repo (Recommended)".
- The MacBook is "M-series, 24-36 GB".
- "A7a and Ahmad@ (Recommended)" run on the Mac. WayBaba and mi stay on Windows.
- The repo is "Rxm3rk/hms-kurdistan (Recommended)", private, created 10:45 under the GitHub login Rxm3rk (stored in Git Credential Manager). GitHub Actions is disabled on it. The remote is `origin`.

**Why:** the user was furious about lost progress and wanted the remaining work split across two machines. The Mac runs Unix, so tests run at Linux speed, and the repo doubles as the off-laptop backup.

**Already done on Windows:**
- **First upload:** all 7 branches went up at 10:51, plus the auto-saves as `refs/wip/windows/*`.
- **Auto-upload:** the "HMS auto-save" task now saves, secret-scans and uploads every 10 minutes (see [[autosave]]).
- **Hand-over pack:** on GitHub as `refs/hms/mac-handoff` (not a branch), first commit `fb1431a`. Its files are README.md (the human's setup steps and Prompt 1/2), SETUP.md, COMMON.md, WP-0.3.md, WP-0.5.md, heavy.sh, snapshot-mac.sh and com.hms.autosave.plist. Draft copies are in `%TEMP%\hms-mac\`. To add files, make a new commit whose parent is the previous pack commit and push it as a fast-forward, never forced.
- **Watcher:** a background `git ls-remote` loop polls `refs/hms/mac-ready/*` and `refs/hms/report/*` every 2 minutes. Re-arm it when it ends.

**Hand-over procedure** (Windows to Mac, per stream `wp-0.3` and `wp-0.5`), once `refs/hms/mac-ready/wp-0.X` appears:
1. Steer the Windows child thread for that stream (`hms-accel-wp03-r1` or `hms-accel-wp05-r1`):
   - finish the current step and commit what passes the fast tier;
   - update STATUS.md's "Next exact step";
   - wait for running subagents;
   - write a hand-over note to `%TEMP%\hms-mac\NOTE-wp-0.X.md` covering what's done, what's uncommitted and its state, what was killed or is half-done, the next steps and any gotchas;
   - end its turn.
2. Run `snapshot.sh` once by hand for the final save and upload. Check that `git ls-remote origin refs/wip/windows/<branch>` equals the local `refs/wip/<branch>`, or that there's no uncommitted work.
3. Add the note and the stream's working notes to the pack under `notes-wp-0.X/`. For WP-0.5 that's the .md files from `%TEMP%\wp05\`: contracts, phase2, phase2-resume, agent-common, reviewer-common, notes-dn, review2 and s1-files. For WP-0.3 it's from `%TEMP%\hms-wp03\`: libs-brief, dn-draft and consistency. Commit with the previous pack as parent, secret-scan, push.
4. Push `refs/hms/handover/wp-0.X` pointing at the final save commit, or at the branch head if there was nothing uncommitted. The Mac checks that the commit equals the branch head or its first parent equals the branch head; otherwise it stops.
5. Run `git -C <windows worktree> switch --detach`, so the Windows auto-save stops saving and uploading that branch. Keep the folder as a backup. Don't send that child thread any more work.

**Afterwards:**
- The Mac uploads its branch (never forced) and its saves as `refs/wip/mac/*`, and pushes reports as `refs/hms/report/<wp>/<UTC time>` (a one-file commit with REPORT.md).
- The lead here does `git fetch origin`, runs the records of record in WSL at the Mac's SHAs, and does all merges with --no-ff.
- Still to do: record the human decision as a DN on the lead's side.

Related: [[parallel-streams]], [[autosave]], [[overnight-run]].
