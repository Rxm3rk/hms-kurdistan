---
name: feedback-derive-from-existing-research
description: "For new editions, variants or derived documents of the HMS plan, rework the existing research pack instead of starting fresh web research"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8cdad8bc-affa-4f2f-8180-72c1832ed26b
  modified: 2026-10-18T05:50:03.799Z
---

When the user wants a regional edition, a variant or a derived document (such as the build prompt), build it from BLUEPRINT.md, BLUEPRINT-KURDISTAN.md and research/ (R01–R16 plus the reconciliation log). Don't start new web research.

**Why:** when asking for the Kurdistan edition (October 2026), the user said: "no we already have a very good research, your task is to go through it and basically make another one from it".

**How to apply:**
- If a claim needs facts the pack doesn't cover, tag it as a local assumption ([L]) and list it for verification, as BLUEPRINT-KURDISTAN.md's Appendix B does.
- Research only if the user asks for it.
- Parallel read-only extraction subagents (one per research area, digests written to %TEMP%) worked well for digesting the 1.9 MB pack: see [[pdf-build-tooling]] for where the build-prompt digests live.
