---
name: feedback-no-drive-wide-search
description: "Never run find / or any whole-drive search on this host, and tell every subagent; search only named folders (repo, pnpm store, Gradle cache, build/)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 57a97e58-5cfe-4f94-93d8-88a189476d5f
  modified: 2026-10-19T06:58:16.046Z
---

Never run `find /`, `find /c`, `dir /s C:\` or any search over a whole drive, and put that rule in every subagent brief. Search only specific folders: the repository, `git show <branch>:<path>`, the pnpm store `C:\Users\Surface\.t3\projects\hospitalmanagementsystem\.tools\pnpm-store\`, Gradle jars under `.tools\gradle-home\caches\modules-2\files-2.1\`, and the worktree's `build/`.

**Why:** on 19 Oct 2026 an orphaned `find / -iname NotoSansArabic*.ttf` left behind by a WP-0.8 subagent that was killed at the usage limit ran for 3 hours at full CPU on the shared 8-core laptop. The lead killed it at 09:58.

**How to apply:** add this rule to every agent brief or rules file. When resuming after a usage-limit stop, look for leftover processes from killed agents (by command line) and report them. Related: [[resuming-killed-work]], [[parallel-streams]].
