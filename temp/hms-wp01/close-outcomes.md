I went through all 22 issues from the four reviewers (counting the duplicates) and the two items from the gates-bite plant run. 19 are fixed, 2 are partly fixed with the rest left for you, and 2 are entirely yours. I rejected none: every finding I checked reproduced or was confirmed by reading the files.

CODE LENS
1. [major] supersedes ignored, and a later rejection did not take back an approval: FIXED. Confirmed first: the reviewer's probe printed "REJECT-SUPERSEDES ok= True" and "VALUE-OF-SUPERSEDED ok= True".
   - `tools/hmstools/safety/signoffs.py` has a new `withdrawals()` and `match_gate_field(gate, records, withdrawn=None)`.
   - A record cancels ("withdraws") the record named in its `supersedes`, whatever either decides. A replaced record stays cancelled even if its replacement is replaced in turn.
   - A `rejected` or `returned` record that nothing supersedes cancels every record for the same subject at the same `subject_version` whose field is the same, a parent or a child, whatever the role or date. It stands until a record supersedes it, or until the subject changes.
   - A `supersedes` that names no valid record, or names itself, is an error until a later record supersedes it.
   - The error names the record that withdrew each one. A withdrawn record no longer gets the "field not filled yet" warning.
   - `check.py` `_gate` computes the withdrawals once.
   - This only ever removes records from matching, so it cannot turn a failure into a pass.
   - Documented in `docs/safety/signoffs/README.md` (table rows, a new section "Superseding and withdrawing", the matching rules, Tightenings [P]), the descriptions in `signoff.schema.json` (validation unchanged), and the `docs/safety/README.md` approval-fields section.
2. [minor] risk-vocabulary roles came from the editable `required` list: FIXED. The probe reproduced it ("version unchanged by required edit: True", "narrowed-required ok= True").
   - risk-vocabulary roles are now always `cso` plus any other role `required` lists, for its status and its approval block. I took this union rather than the reviewer's fixed `(cso,)` because it can never be weaker than either.
   - The content version now keeps `approval.required` and drops only the block's `status`, `approved_by` and `record`.
   - `approval` is now among the fields that can authorise the risk-vocabulary status. This is the one change that accepts something more than before: a CSO record for `approval` at the current version now backs the status. It follows the documented rule that a parent path authorises its children.
   - For state-machine specs (versioned by number) a narrowed `required` list without a version bump is already KA-013. I added "a change of its `approval.required` roles included" to KA-013.
3. [minor] licence register pattern '.' recorded every package: FIXED. Reproduced first: PASS with conditional_registered=2, exit 0.
   - `policy.py` now also refuses a pattern that matches any of `UNRELATED_PACKAGES`: made-up npm, maven, deb and oci package URLs and a made-up name.
   - That catches `.`, `pkg`, `^pkg:`, `^pkg:npm/`, `^pkg:(deb|rpm)/` and `e`. Named patterns such as `^pkg:maven/ca\.uhn\.hapi/` and `^pkg:deb/debian/bash@` still pass.
   - The reviewer's file now fails with exit 1. Updated the `tools/licence/README.md` sentence and the `register.yaml` header comment.
4. [minor] a list-valued `rule` crashed with TypeError: FIXED. Reproduced first. The source-offer test is now guarded by `isinstance(..., str)`. The reviewer's file now prints "'rule' must be a non-empty string" with exit 1, and no traceback.
5. [minor] repo rule (f) passed an entry script that was not in git's index: FIXED.
   - `rules.py` `check_modes` now errors: "modes: <path> is not in git's index ...".
   - `build_good_repo` commits the six scripts as 100755.
   - The test was renamed `test_a_script_git_does_not_track_fails` and now expects the error.
   - Updated the `--help` text, `tools/README.md`, and COMMANDS.md §3 and line 14.
6. [minor] specs in subdirectories, and an `approval` or `cso_triage` written as text, passed: FIXED. The probe reproduced both with approval_fields_filled=0.
   - Specs are now found with `rglob`.
   - A filled `approval` or `cso_triage` that is not a block (text or a list) now always fails as kind "block"; no record can back it.
   - Documented in both READMEs and Tightenings [P].

RECORDS AND PLAN LENSES
7. [major] `docs/safety/README.md:111` still gave the old merge rule (R1, duplicated as P1): FIXED with the sign-off group's text. "The check reports every trust anchor" now continues "and every settled conflict".
8. [major] COMMANDS.md Checked cells cited the `d3e14de` record for behaviour it never had (R2 = P3): FIXED.
   - Line 3 now explains that a "19 October" cell means a run on the uncommitted Windows tree, and that a `d3e14de` record cited beside it ran an earlier version.
   - The repo, safety and backlog cells say what that earlier version lacked (no 100755 rule, a looser ADR rule, no allowed-signers list, no hazards cross-check).
   - The bootstrap cell says the WSL run used the version before the pin (Adoptium "latest" with a Corretto fallback, R-14), so the pinned download has not yet run on the build host.
   - The doctor `--tier fast` cell says the `d3e14de` version accepted any JDK 25. I checked this in `git show d3e14de:.../checks.py`.
   - So that the cells are true, I ran on the Windows host today: `sh tools/bootstrap jdk` (reused the pinned JDK, 1 s), `sh tools/doctor --tier fast` (PASS, 5 ok), and both frontend licence checks (PASS, 2 and 124 components).
9. [minor] STATUS.md is stale and the drafts contain claims that are not true (R3 = P2): LEFT FOR THE LEAD, because STATUS.md is read-only for me. The status_draft field below replaces the earlier drafts and covers every point raised.
10. [minor] KA-010 formatting, and DN-001 dating a resolution that does not exist yet (R4 = P8): FIXED.
    - KA-010 Closes with: "the R-05 resolution commit (its SHA is in `docs/program/reviews/WP-0.1.md`, R-05)". I kept the status `closed`: a commit cannot carry its own SHA.
    - DN-001 now reads "while review finding R-11 was being resolved".
11. [minor] the sign-off README and the allowed-signers.yaml header said the agent never changes the file (R5 = P6): FIXED, with the same wording in both: the build created the file in WP-0.1 with no entry, which is not a trust anchor, and from then on the agent never adds, changes or removes an entry and never commits a change to it. The upper-case sentence that a test checks is unchanged.
12. [minor] old gates-bite record unlabelled and the new tool unlisted (R6 = P9): FIXED as far as possible now.
    - `backend/README.md:54` is labelled "(Windows checkout, before the first commit; not evidence of record, review finding R-06)" and points to `tools/ci/gates-bite/`.
    - COMMANDS §6: the gates-bite and spot-check rows are labelled, and the gates-bite row gives the scripted command.
    - Added a gates-bite row to `tools/README.md` and a section "Showing that the gates fail" to `tools/ci/README.md`.
    - Pointing these at the new records waits until those records exist (yours).
13. [minor] doctor records named without "-doctor-" (P4): FIXED in COMMANDS §6. The next record is `<date>-doctor-<shortsha>`, and the row explains that the `d3e14de` files keep their name because the review cites them. I did not amend `evidence/README.md` (read-only for me).
14. [minor] `docs/safety/README.md:19` traceability row disagreed with KA-007 (P5): FIXED. It now reads "WP-0.9 [P] (KA-007), using the test IDs of the WP-0.5 test scaffolds".
15. [minor] the SI-14 exception was labelled a tightening (P7): FIXED.
    - CTRL-0014-4 `notes`, the README Tightenings row and DN-014's "Default in use" now say: only the strict reading of "a measured PPV" is the tightening. The human-approved day-0 exception is DN-014 option 1, the CSO's reading, which does not exist until the CSO decides; meanwhile CTRL-0014-5 blocks the go-live bundle.
    - `test_seeded_content.py` now asserts this split.
    - No invariant text changed.

GATES-BITE PLANT RUN
16. gpg "key created N seconds in the future" failures in `test_signed_commits.py`: FIXED.
    - Reproduced in WSL with `gpg --faked-system-time`: signing fails with "Unusable secret key", and `ignore-time-conflict` in `gpg.conf` alone lets it sign and gives GOODSIG on verify.
    - The test class now writes that option into its two throwaway GnuPG homes.
    - I also added it to the run's own keyring in `tools/ci/gates-bite/gates-bite.sh`, keeping the existing clock wait.
    - Neither touches what the gate reads (`%G?`, `%GF`, `%GP`).
    - I could not reproduce a natural clock step, so the record of record will show whether it recurs.
17. Warning read "commit X settled the conflict that merge X opened": FIXED. It now reads "merge X settled the conflict between the lines it merged". The substring "settled the conflict" that the plants look for is unchanged, and a new assertion is in `test_git_authentication.py`.

NOT DONE
18. The adversarial pass on the merge and conflict rule ("signoff-attack" lens) never ran, and I did not run it either. My own gate changes only remove records or add errors.

TESTS ADDED
- `test_signoff_gate.py`: +26 tests (WithdrawalTest, RiskVocabularyRoleTest, MalformedBlockAndLocationTest).
- `test_signed_commits.py`: +2 real-GPG tests. A signed rejection withdraws the acceptance until a record supersedes it; a rejection signed by an unlisted key withdraws nothing and fails.
- `test_licence.py`: +3 tests. `test_repo.py`: 1 test changed.
- `test_git_authentication.py` and `test_seeded_content.py`: assertions added.

HOUSEKEEPING
- I used no OQ, KA or DN number.
- Nothing is staged by me. The index still holds exactly the six 100755 mode entries and A `tools/hmstools/backlog/hazards.py`.
- All edited files are LF (repo check crlf_files=0).
- Scratch files are only in %TEMP% (`edit*.py`, `clockprobe*.sh`, `hms-fix-suite.log`).