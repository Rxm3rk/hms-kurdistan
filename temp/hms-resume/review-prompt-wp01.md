You are the independent reviewer for HMS Kurdistan. Do not build features. Read
BUILD-PROMPT.md §2, §3, §4.3, §6.8 and §22, then docs/program/STATUS.md to find the work
package under review and the branch and commit to check. Read that work package's exit
criteria in §21. Check out the commit and record its SHA. Check the work against its exit
criteria, the Definition of Done (§22), the safety invariants (§2.1), the architectural
constitution (§2.2), the ADR baseline (§4.2) and the licence policy (§4.3). Run the
commands in docs/program/COMMANDS.md yourself: at least `tools/ci/run merge` and the work
package's performance checks. Report findings ranked critical, major or minor, each with
file and line, the rule it breaks, and a concrete failure scenario. Write the report to
docs/program/reviews/WP-0.1.md (a re-review is WP-0.1-r2.md). Record
yourself as "automated review (AI)", never as a person. Do not fix anything unless I ask.

----------------------------------------------------------------------------------------
Notes for this host (from the lead; they do not change the instructions above):

- Repository (Windows checkout, where you read files and write the report):
  C:\Users\Surface\.t3\projects\hospitalmanagementsystem (Git Bash: /c/Users/Surface/.t3/projects/hospitalmanagementsystem).
  Do not change its branch, its git state or any file in it except docs/program/reviews/WP-0.1.md.
  Do not commit; the lead commits your report unchanged.
- The work package under review is WP-0.1 Programme bootstrap on branch wp/0.1-programme-bootstrap.
  Review the branch tip (see `git log --oneline -5`): it holds the WP-0.1 commits after `ed023b6`
  (the plan of record on main). Record the SHA you reviewed.
- "Check out the commit": use the Linux clone in WSL, which has the project-local toolchain ready:
  from Git Bash run Linux commands as
    MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/src/hospitalmanagementsystem && <command>'
  and check out with: git fetch origin && git checkout --detach origin/wp/0.1-programme-bootstrap
  (then `sh tools/bootstrap` reuses or completes the toolchain). The gates of record run there
  (KA-001). You may also run commands on the Windows checkout; say which host each result is from.
- WP-0.1 has no performance checks (its §21 exit evidence has none); say so in the report.
- docs/program/reviews/README.md gives the report format the programme uses.
- The work is large (about 330 files): programme control files, backlog generator, ADR-001..028,
  hazard log and safety check, tools/doctor, tools/bootstrap, tools/ci/run, repo and licence checks,
  Gradle and pnpm skeletons, CI hygiene files. Be thorough: use parallel subagents for breadth if
  you have them (for example one per area), but you own the report and every finding in it.
  Verify each finding before reporting it (reproduce it, or cite the exact lines); say plainly what
  you reviewed and what you did not.
- Things worth adversarial attention in a safety-critical programme: anything that can report a
  pass without having run (vacuous passes, stale results, shortened runs); any weakening or
  narrowing of an SI-01..SI-21 invariant in the hazard log; approval, sign-off, triage or
  risk-acceptance fields and the gate that guards them; fail-closed behaviour of the unbuilt
  tiers; claims in STATUS.md, COMMANDS.md, the evidence files and the ADRs that do not match
  what the code or a re-run shows; fidelity to BUILD-PROMPT.md and the blueprints (never invented
  facts, clinical content or codes); the licence policy and the pinned versions against §4.1 and
  §4.3; secrets; line endings; and the host deviation recorded in DECISIONS-NEEDED DN-001.
- Your final answer: the SHA you reviewed, the counts of findings by severity, the report path, and
  the commands you ran with their results.
