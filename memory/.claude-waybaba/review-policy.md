---
name: review-policy
description: "19 Oct 2026 ~12:15: the user abolished most reviews to go faster; only one automated review per work package at its end; tests and gates stay"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a7252630-2217-4120-a4d4-d624bcd2935a
  modified: 2026-10-19T09:13:56.466Z
---

On 2026-10-19 around 12:15 the user said: "I want you to abolish most of the reviews just too many of them not needed so we accelerate further work". This replaces the earlier "lighter on low-risk only" decision recorded in [[parallel-streams]].

**Why:** the multi-lens spec, slice and fix-verification reviews were costing hours per work package. For example, WP-0.3's spec review raised 28 critical and about 170 major findings, which then needed fix and alignment rounds. The user wants speed.

**How to apply:**
- No spec reviews, per-slice reviews, multi-lens panels, review-of-fix rounds or "every five sessions" reviews, in workflows or in child threads.
- Keep every automated gate: unit and property tests, lints, `tools/hms repo check`, the fast tier, gitleaks, and the records of record in WSL. These are tests, not reviews.
- Keep ONE automated review per work package, at its end, before the merge to main (BUILD-PROMPT §22 item 10). The lead runs it as a single pass covering correctness and clinical safety together, reporting critical and major findings only, and those get fixed.
- [HUMAN] code review for Tier 1 and 2 changes is unchanged: it stays "awaiting human code review" in the evidence pack.
- Record the decision as a DN deviating from BUILD-PROMPT §3.2 step 7. The children add it to their first DN; the lead adds it on the WP-0.2 and WP-0.7 side.
- Child brief: `%TEMP%\hms-accel\common.md`, decision 4 and Process 1 and 4.
- The workflow scripts for WP-0.2 (S2) and WP-0.7 (S7) were edited with a `NO_REVIEW` set.
