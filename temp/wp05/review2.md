# WP-0.5 second review: spec plus Kotlin (binding)

Read `C:\Users\Surface\AppData\Local\Temp\wp05\reviewer-common.md` first (READ-ONLY on the repository; report only to your file; never run Gradle; never search a whole drive).

Round 1 reviewed the YAML/md drafts; its reports are in `C:\Users\Surface\AppData\Local\Temp\wp05\reviews\` (`safety-*.md`, `correctness-*.md`). The authors claim every critical and major finding is fixed. Round 2 reviews, for your machine(s):
1. the spec `docs/specs/state-machines/<machine>.yaml` and `.md` as they are now: confirm or reopen each round-1 critical/major finding (cite its id), and find new ones;
2. the hand-written Kotlin in the machine's package (see `C:\Users\Surface\AppData\Local\Temp\wp05\contracts.md` §1 for packages and projects): `<P>Facts.kt`, `<P>Guards.kt` (each predicate against its YAML `description`, exactly: totality, fail-closed unknowns, complement pairs as literal negations, time-window boundaries inclusive/exclusive as written, no dose arithmetic, no system clock, no finance fact read by a clinical guard unless a property shows it is inert), `<P>GuardsTest.kt` (every predicate has a holding and a failing case; boundaries; tests actually assert what their names say), `<P>Arbs.kt` (synthetic only; not so biased that refusals and edge values vanish; not so narrow that a safety property is vacuous), `<P>PropertyTest.kt` (each safety property really checks what its name claims, cannot pass vacuously, uses `runSequences` with the `PropertyTestBudget` budget, names start with the SI/hazard; compare with the planned `PropertyTest:SI-nn-...` names in `docs/safety/hazard-log.yaml`);
3. the generated `<P>Machine.kt` only for agreement with the YAML (do not review its style).
The agent's report is in `C:\Users\Surface\AppData\Local\Temp\wp05\reports\` (its runs, spec changes and open points): check its claimed spec changes and its proposed CSO decisions.

Lens: your task names one lens (correctness, or clinical safety). Clinical safety walks every transition and guard against BUILD-PROMPT §8.4, §2.1 (SI-01…SI-21), R11 §10, A.20 and the hazard log: what facts let a wrong or unsafe action through, and what legitimate urgent action is wrongly blocked (over-blocking is a defect). Correctness checks the code against the spec and contracts, the tests against the code, and vacuity.

Severity and format per reviewer-common.md; ids `<lens>2-<machine>-nn`. Write the report to the file your task names. Final message: counts and every critical and major finding in full, each with a concrete fix.
