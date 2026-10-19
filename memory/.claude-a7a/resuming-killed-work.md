---
name: resuming-killed-work
description: "How to resume HMS work after a usage-limit stop or account switch: two Claude profiles with separate memory dirs; where killed workflow scripts and agent transcripts live"
metadata:
  node_type: memory
  type: reference
  originSessionId: 1382e398-fc29-4e7f-ae0c-3028d2d6ede9
  modified: 2026-10-18T15:50:02.128Z
---

The user runs this project from T3 Code with more than one Claude account profile. On 18 Oct 2026 the profile `claudeAgent_a7a` hit its 5-hour limit mid-build and the thread continued on `claudeAgent` ("mi").

- Each profile has its own memory directory: `C:\Users\Surface\.claude-a7a\projects\C--Users-Surface--t3-projects-hospitalmanagementsystem\memory\` and `C:\Users\Surface\.claude\projects\...\memory\`. If this session's memory is empty or stale, read the other one; on 18 Oct 2026 the a7a files were copied into the `.claude` one, and later updates were made there only.
- A workflow killed by the limit leaves its script at `<profile>\projects\<project>\<session-id>\workflows\scripts\*.js` (each agent's full brief) and per-agent transcripts plus `journal.jsonl` (started/result/failed per agent) at `<session-id>\subagents\workflows\<wf-id>\`. Tail the transcripts (last assistant texts and tool calls) to see how far each agent got; their files on disk are partial work to finish and verify, not to trust.
- Workflow resume (`resumeFromRunId`) only works in the same session; after a profile switch, finish the work with fresh agents given the original brief plus "resume: inspect what exists, finish, verify".
- `t3_thread_read` (view activity) on the thread recovers earlier history that a context handoff dropped.

Related: [[project-phase]].
