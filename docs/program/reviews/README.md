# Reviews

Reviewer reports, one per work package (BUILD-PROMPT §3.1, §3.2 step 7, "Review prompt").

**Naming.** `<work-package-id>.md` for the first review (for example `WP-0.1.md`); `<work-package-id>-r2.md` for a re-review, `-r3.md` after that.

**Who reviews.** A separate agent session run with the review prompt from BUILD-PROMPT "How to use". The reviewer is recorded as **"automated review (AI)"**, never as a person. An automated review is not a human code review: the SD-2 two-person review and the IEC 62304 code-review records for Tier 1 and Tier 2 changes are [HUMAN], and such changes stay "awaiting human code review" until a named person signs (§3.5).

**What each report contains.**
- The work package, the branch and the commit SHA reviewed.
- The commands the reviewer ran from `docs/program/COMMANDS.md` (at least `tools/ci/run merge` and the work package's performance checks) and their results.
- Findings ranked **critical**, **major** or **minor**, each with:
  - an ID within the report (for example `F-01`);
  - file and line;
  - the rule it breaks (exit criterion in §21, Definition of Done in §22, a safety invariant in §2.1, a constitution rule in §2.2, the ADR baseline in §4.2, the licence policy in §4.3, or another cited section);
  - a concrete failure scenario.
- A resolution field per finding, left empty by the reviewer.

**Resolution.** The next build session fixes unresolved critical and major findings first (continue prompt; §3.2 step 2) and records, under each finding, `resolved in <commit SHA>` with a one-line note. A work package counts as done only when its review has no unresolved critical or major findings (§22.2). Reviewers do not fix anything unless the human asks. A commit that a review report cites is never rebased or amended (§3.6).
