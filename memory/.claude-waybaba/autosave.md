---
name: autosave
description: "HMS auto-save: a Windows scheduled task saves every worktree's uncommitted work to refs/wip/<branch> every 10 minutes; how to list and restore saves"
metadata:
  node_type: memory
  type: reference
  originSessionId: a7252630-2217-4120-a4d4-d624bcd2935a
  modified: 2026-10-19T08:17:44.398Z
---

On 19 Oct 2026 the user asked angrily that progress never be lost ("losing progress is a never must"). Since 10:36 the Windows scheduled task **"HMS auto-save"** runs every 10 minutes, including on battery.

- **What runs:** `conhost.exe --headless "C:\Program Files\Git\bin\bash.exe" /c/Users/Surface/AppData/Local/hms-snapshot/snapshot.sh`. The script and its `snapshot.log` live in `C:\Users\Surface\AppData\Local\hms-snapshot\`, outside the repo.
- **Do not use a VBScript wrapper.** wscript and cscript hang on this Windows build. `conhost --headless` works.
- **What it saves:** for every worktree that is on a branch, tracked changes plus new non-ignored files. It skips key-like files (*.key, *.pem, *.p12, .env, id_*).
- **Where saves go:** a commit under `refs/wip/<branch>`. Its parents are the branch HEAD and the previous save, so git gc keeps every save.
- **What it never touches:** the branch, the index or any file. It never pushes.
- **Why the repo checks don't see it:** the branch-name check only reads refs/heads and refs/remotes, and gitleaks' history scan covers branches, tags and remotes, not `--all`.
- **List saves:** `git -C <wt> log --oneline refs/wip/<branch>`.
- **Diff against the branch:** `git -C <wt> diff HEAD refs/wip/<branch> --stat`.
- **Restore:** `git -C <wt> restore --source=refs/wip/<branch> --worktree -- <path>`.
- **Cost:** a run takes about 1 minute on the loaded host (all five worktrees, about 3 MB of untracked files each).
- **Upload (since 10:55):** after saving, the script secret-scans every commit GitHub doesn't have yet. It runs gitleaks with `-m`, because plain `git log -p` skips the content of the two-parent save commits. It scans against `--not --remotes=origin --glob=refs/hms-pushed/*`. Then it pushes main, the worktree branches (never forced) and `refs/wip/*` as `refs/wip/windows/*` to origin. A failed scan blocks the upload and is logged. `refs/hms-pushed/wip/*` records what has been uploaded.
- **The boss demo:** `C:\Users\Surface\hms-demo` is its own local git repo (identity Ahmad; autocrlf off; .gitignore excludes node_modules and .tools). snapshot.sh commits any change there as "auto-save <time>". It is not uploaded. See [[boss-demo]].
- **HTTP settings:** big pushes need `-c http.postBuffer=524288000 -c http.version=HTTP/1.1`; without them the first push got "Connection was reset".
- **Was missing:** the saves live in the same `.git` on the same disk. An off-machine copy needs a second machine or a private remote, which ties to the MacBook question in [[parallel-streams]].
- **Removal, if ever needed:** `Unregister-ScheduledTask -TaskName 'HMS auto-save'`.

**How to apply:** when a child is killed or work looks lost, first check `refs/wip/<branch>` for the latest save before redoing anything. Tell resumed children the saves exist.
