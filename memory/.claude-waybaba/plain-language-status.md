---
name: plain-language-status
description: "User wants status updates in plain language about the product, not the build plan's internal codes (WP, R-xx, DN, KA, OQ)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: ce038d0b-901a-4e62-be7b-a3a64cef134f
  modified: 2026-10-18T18:33:33.055Z
---

When reporting progress, lead with what the hospital system can or can't do yet, in plain words. Don't use the plan's internal IDs (WP-0.x, R-01, DN-005, KA-011, OQ-084, §21) unless you explain them right there, and keep them to a minimum.

**Why:** On 2026-10-18, after a status page full of work-package and finding codes, the user asked "what are we actually building, wtf is WP and stuff?" The jargon hid what was going on.

**How to apply:** Start with the product (a hospital system for private hospitals in Kurdistan) and what works today. Translate each plan item into what it delivers ("the database cluster that survives a server dying", not "WP-0.2 failover criterion"). Codes go at the end, only if they help.
