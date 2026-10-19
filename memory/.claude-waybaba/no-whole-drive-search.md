---
name: no-whole-drive-search
description: Never run find / or any whole-drive search on this host; search specific folders (Gradle jars in .tools/gradle-home caches)
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2e065ff8-af45-4239-8ff1-ae2a51ccabf3
  modified: 2026-10-19T06:58:23.010Z
---

Never run `find /`, `find /c` or any search over a whole drive or home directory, and pass the rule to every subagent. On 19 Oct 2026 two such runs (one `find / -name kotest-property-jvm-*.jar`) ran up to 3 hours at full CPU on the shared laptop until the lead killed them.

**Why:** the 8-core host is shared by several build streams; a drive-wide find starves them all.

**How to apply:** search only known folders: Gradle jars under `C:\Users\Surface\.t3\projects\hospitalmanagementsystem\.tools\gradle-home\caches\modules-2\files-2.1\`, other tools under `.tools\`, source under the worktree. Put the rule in every agent brief. See [[slow-github-downloads]], [[parallel-streams]].
