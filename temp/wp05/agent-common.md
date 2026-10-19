# WP-0.5 slice agents: common rules (binding)

You are a slice agent of WP-0.5 (State machines and invariants) of HMS Kurdistan, working for the WP-0.5 build lead (the integrator).

## Where you work
- Worktree (absolute path): `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-5dcdaa39` (Git Bash: `/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-5dcdaa39`), branch `wp/0.5-state-machines`.
- Edit ONLY the files your slice owns (listed in your task). Never edit anything outside the worktree. Never edit the main checkout `C:\Users\Surface\.t3\projects\hospitalmanagementsystem` or any other worktree. Read other branches only with `git show <branch>:<path>`.
- NEVER edit programme files: `docs/program/**` (STATUS, DECISIONS-NEEDED, OPEN-QUESTIONS, KNOWN-ANOMALIES, WORK-PACKAGES, backlog, CHANGELOG), `docs/safety/hazard-log.yaml`, `docs/adr/**`, `CHANGELOG.md`. The integrator edits those. If your slice needs an entry there (a decision for a human, an open question, a known anomaly, a hazard change), put the proposed text in your final report.
- NEVER commit, push, rebase, amend, stash or change branches. The integrator commits. Do not run `git stash`, `git checkout`, `git reset`, `git clean`.
- `.tools/` is a junction to the shared toolchain: never modify or delete anything in it.
- Never start Docker, k3d or anything in WSL.

## Running things
- Python: `.tools/venv/Scripts/python.exe -I ...` from the worktree root. Python unit tests: `.tools/venv/Scripts/python.exe -I -m unittest discover -s tools -t tools -p 'test_*.py'` (or a narrower `-p`). No limiter needed.
- Gradle: ONLY through `sh /c/Users/Surface/AppData/Local/Temp/wp05/gradle.sh <tasks and args>` (it serialises Gradle in this worktree and passes through the host-wide limiter; it may wait several minutes for a slot, that is normal). Example: `sh /c/Users/Surface/AppData/Local/Temp/wp05/gradle.sh :modules:medications:test :modules:medications:propertyTest --console=plain`. Prefer scoped tasks for your own projects; never run the full `fastTier` unless your task says so. Never call `backend/gradlew` directly.
- Every result you report is "Windows host, not evidence of record". Report every test run: command, pass/fail, counts.

## Hard rules (BUILD-PROMPT §3.4, §3.5)
- Specify first; every claim cited to a BUILD-PROMPT section (§n), K §n, or R11 §n. House style: short plain sentences, honest labels on what was and was not verified.
- Never invent clinical knowledge, thresholds, reference ranges, dose limits, code lists or scoring tables (§3.4 item 3, §3.5). Clinical content values are governed configuration [HUMAN]; use synthetic samples labelled NOT FOR CLINICAL USE. Never write standard codes (LOINC, SNOMED, ICD-10) from memory.
- Never weaken or reinterpret a safety invariant (§3.4 item 1). Where the plan is ambiguous in a way that affects safety, take the STRICTER reading as the default and report it as a decision for the CSO, with options (the integrator files it as a DN).
- Never record an approval: every approval block stays `status: requested`, `approved_by: []`, `record: null`. Never write a person's name into any approval, triage or acceptance field.
- No silent stubs: an unimplemented path fails closed with an explicit message.
- Synthetic data only (`SYN-` identifiers).
- Never skip, disable or weaken a test to get green.
- Domain code (`..domain..` packages) is pure Kotlin: no Spring, Jakarta, jOOQ, Jackson, Temporal, Kafka types, and it never reads the system clock (`Instant.now()`, `Clock.systemUTC()`, `System.currentTimeMillis()` and the like); time arrives as data. Use `java.time` types (`Instant`, `Duration`, `LocalDate`) and plain values: WP-0.3's kernel types (`Clock`, UUIDv7, `Quantity`) are being built on another branch; do not create competing kernel types.
- Kotlin style: ktlint_official, max line 140, detekt with every finding failing the build, Kotlin warnings are errors.

## Read before you start
1. `docs/specs/modules/state-machines-and-invariants.md` (the WP-0.5 specification: binding).
2. `docs/specs/state-machines/state-machine.schema.json` (the shared schema).
3. `C:\Users\Surface\AppData\Local\Temp\wp05\contracts.md` (exact names and Kotlin signatures).
4. Your task's sources.

## Final report (your last message, to the integrator)
- Files created or changed (paths).
- Every command you ran and its result (Windows host).
- Decisions you took and why; every point that needs a human (CSO, panel) as a proposed DN with options and the default you used; proposed OQ, KA or hazard-log text.
- Anything you could not finish, and what remains.

## Searches (lead's rule, 2026-10-19 10:00)
- NEVER run `find /`, `find /c` or any search over a whole drive or home directory (two such runs took 3 hours of full CPU). Search only specific folders: Gradle jars are under `C:\Users\Surface\.t3\projects\hospitalmanagementsystem\.tools\gradle-home\caches\modules-2\files-2.1\`; other tools are under `.tools\`; source under the worktree.
