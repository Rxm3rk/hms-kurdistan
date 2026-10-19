---
name: wp07-human-decisions
description: "Two human-lead decisions for WP-0.7 (2026-10-18), translations and licences, to record as closed DN entries on the WP-0.7 branch"
metadata:
  node_type: memory
  type: project
  originSessionId: ce038d0b-901a-4e62-be7b-a3a64cef134f
  modified: 2026-10-18T19:13:06.660Z
---

On 2026-10-18 the human lead answered two WP-0.7 questions (in chat, via the question tool):
1. Sorani and Arabic UI text: "AI drafts, you check". The agent drafts ckb and ar catalogue strings, each marked unreviewed. The human or a clinician corrects them, and the clinician review (§11.1) stays a gate before any hospital use. This is a recorded deviation from the `packages/i18n/README.md` rule against invented or machine translation.
2. Licences: "Approve all three". 0BSD, Unicode-3.0 and Zlib are added to the shipped-code allowlist as the human's decision (§3.4 stop-and-ask item 2).

**Why:** these are human decisions the plan requires to be on record, but they were not yet in DECISIONS-NEEDED.md when made, because the WP-0.1 fix workflow was editing that file.

**How to apply:** in WP-0.7's S0 slice, write both as DN entries closed by the human lead with the date and the chosen option quoted. Then delete this memory, since the repository will hold the record.
