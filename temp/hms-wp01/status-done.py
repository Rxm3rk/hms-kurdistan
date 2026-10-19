from pathlib import Path
def edit(path, pairs):
    p=Path(path); t=p.read_text(encoding="utf-8")
    for old,new in pairs:
        assert t.count(old)==1,(path,old[:70]); t=t.replace(old,new)
    p.write_text(t,encoding="utf-8",newline="\n")
edit("docs/program/WORK-PACKAGES.md",[(
"| **review**: fast tier green in the WSL clone at `d3e14de` (`evidence/ci/2026-10-18-fast-d3e14de.json`), doctor recorded (`evidence/doctor/2026-10-18-d3e14de.txt`); awaiting the automated review |",
"| **done** (§22.2): fast tier green in the WSL clone at `a9d5725` (`evidence/ci/2026-10-19-fast-a9d5725.json`), doctor recorded (`evidence/doctor/2026-10-19-doctor-05f159a.txt`); review `reviews/WP-0.1.md` with all 21 findings resolved (`05f159a`, `7f42564`, `a9d5725`); not merged into `main` until the merge tier passes (DN-011) |")])
edit("docs/program/STATUS.md",[
("# STATUS (updated 2026-10-19 03:35 Asia/Baghdad)","# STATUS (updated 2026-10-19 05:05 Asia/Baghdad)"),
("Branch: wp/0.1-programme-bootstrap @ the evidence commit on top of `05f159a` (the review-fix commit; the records of record at `05f159a` are stored by this commit)",
 "Branch: wp/0.1-programme-bootstrap @ the commit that fills the review's Resolution fields, on top of `a9d5725` (the sign-off gate fixes) and `7f42564` (the records of record at `05f159a`)"),
("Last green: fast @ 05f159a, WSL build host, no cell (`docs/program/evidence/ci/2026-10-19-fast-05f159a.json`: PASS, 8 of 8 steps, 1253 tests, 0 failures); merge and nightly @ 05f159a fail closed on NOT-BUILT steps only (15 and 12; KA-003)",
 "Last green: fast @ a9d5725, WSL build host, no cell (`docs/program/evidence/ci/2026-10-19-fast-a9d5725.json`: PASS, 8 of 8 steps, 1279 tests, 0 failures); nightly @ a9d5725 and merge @ 05f159a fail closed on NOT-BUILT steps only (12 and 15; KA-003)"),
("In-flight slice: WP-0.1 bootstrap: impl; review fixes committed (`05f159a`) and their records of record stored; Resolution fields and the sign-off verification pending",
 "In-flight slice: none on this branch; WP-0.1 is done (§22.2); WP-0.7 is in progress on `wp/0.7-design-system`, WP-0.2 on `wp/0.2-environments`"),
("R-01…R-05 and R-08…R-21 resolved in `05f159a`; R-06 and R-07 resolved by the records of record this commit stores; the Resolution fields are filled in the next commit, R-01's after an independent verification of the sign-off gate; 0 critical or major unresolved",
 "all 21 resolved, each Resolution field naming its commit (`05f159a`; R-06 and R-07 `7f42564`; R-01 and R-20 also `a9d5725`); 0 unresolved"),
])
p=Path("docs/program/STATUS.md"); t=p.read_text(encoding="utf-8")
anchor="- Work started on other branches"
add=("- Verified the sign-off gate independently after `05f159a`: two verifiers built 124 scratch cases with real GPG keys and found nine defects "
"(the worst: deleting a committed, signed rejection brought back the acceptance it withdrew). `a9d5725` fixes eight, documents the ninth (D5, KA-011) "
"and closes a repository-local `gpg.program` override found while fixing them; 26 regression tests, each failing on `05f159a`. Records of record at `a9d5725` "
"(WSL build host, no cell, clean tree): `ci/2026-10-19-fast-a9d5725.json` (PASS, 1279 tests), `ci/2026-10-19-nightly-a9d5725.json` (FAIL, 12 NOT-BUILT) "
"and `ci/2026-10-19-gates-bite-a9d5725.md` (78 plants, 73 FAIL and the 5 expected PASS; 11 of 11 clean runs PASS).\n")
assert t.count(anchor)==1; t=t.replace(anchor, add+anchor)
s=t.index("## Next exact step"); e=t.index("## Blocked / waiting on humans")
wt="C:" + chr(92) + chr(92).join(["Users","Surface",".t3","worktrees","hospitalmanagementsystem","wp07"])
new_next=("## Next exact step\n"
"1. WP-0.7 on `wp/0.7-design-system` (worktree `"+wt+"`): slices S1 to S7 up to the demo route and its E2E evidence; merge this branch into it before its close-out (never rebase, §3.6).\n"
"2. WP-0.2 on `wp/0.2-environments`: merge this branch into it (its three commits keep their SHAs), then the lite cell from its plan (fixed node addresses, signed images, PostgreSQL failover tests; DN-005, DN-013).\n\n")
t=t[:s]+new_next+t[e:]
p.write_text(t,encoding="utf-8",newline="\n"); print(len(t.splitlines()))
