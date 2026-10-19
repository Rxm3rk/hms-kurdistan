# Human lead decisions for the WP-0.2 commit (recorded by the lead, 19 Oct 2026 ~12:40)

## DN-017: answered, option 1
Asked in chat with AskUserQuestion. The human lead (Ahmad) answered:
- **PostgreSQL.** Question: "...the database we chose, PostgreSQL, uses its own free licence (similar to MIT/BSD). Our build plan already names it, but the licence list doesn't include it yet. Add it to the approved list?" Answer: **"Approve it (Recommended)"** (option text: "Add the PostgreSQL licence to the allowed list. It's a permissive open-source licence, and the plan and architecture decision already assume it.").
- **BusyBox.** Question: "...k3s uses a tiny helper tool called BusyBox to create storage folders. It's under the GPL licence. Our rules allow GPL only as an unchanged, separate container, and only if we offer its source code. How should we handle it?" Answer: **"Allow, with source offer (Recommended)"** (option text: "Record it in the licence register as an unmodified separate container, and publish where customers can get BusyBox's source code. This is the standard way everyone ships k3s.").

**Apply DN-017 option 1 exactly as DECISIONS-NEEDED.md words it:**
- Add `PostgreSQL` to `allowed` in `tools/licence/policy.yaml` and to `tools/licence/ort/license-classifications.yml`.
- Add the licence-register entry for `rancher/mirrored-library-busybox`: GPL-2.0-only, rule `gpl-separate-container`, `unmodified: true`, and a `source_offer` as the option describes.
- Mark DN-017 closed, quoting the answers above.

## Other human decisions the lead must record as DNs (use DN-075 and DN-076; they are allocated to the lead / WP-0.2)
- **DN-075, review policy (decision 4).** On 19 Oct ~12:15 the human said, unprompted: "I want you to abolish most of the reviews just too many of them not needed so we accelerate further work".
  - This is a deviation from BUILD-PROMPT §3.2 step 7: there are no per-slice, spec or multi-lens reviews.
  - There is one automated review per work package, at its end, before the merge to main (§22 item 10).
  - Automated gates (tests, lints, repo check, fast tier, gitleaks) are unchanged, and so is the [HUMAN] code review for Tier 1/2.
  - This replaces the earlier decision "Lighter on low-risk only".
- **DN-076, MacBook split, postponed.** On 19 Oct ~10:40 the human chose to split work with a MacBook through the private GitHub repo Rxm3rk/hms-kurdistan: "Private GitHub repo (Recommended)", "M-series, 24-36 GB", "A7a and Ahmad@ (Recommended)", "Rxm3rk/hms-kurdistan (Recommended)".
  - Since then the auto-save uploads every 10 minutes to that private repo (approved upload; never forced).
  - On 19 Oct ~12:15 the human said "the mac is not gonna join yet"; all streams stay on the Windows laptop for now.

## Lead decisions (the lead's own authority)
- **KA-090.** Allocated to WP-0.2 for the fast-tier time-budget anomaly: python-unit-tests take 880 s of the 900 s timeout on the Windows host, and the whole tier takes about 1049 s against §19.1's 10 minutes. WP-0.2's KA range is used up. The WSL tier takes about 150 s.
