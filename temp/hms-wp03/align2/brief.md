# Alignment round 2 brief (WP-0.3 specs)

Worktree (absolute): C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03
Specs: docs/specs/modules/platform-{kernel,journal,tenancy,config,tasks,workflow}.md, docs/specs/events/{envelope,catalogue}.md, docs/specs/state-machines/task.yaml

A cross-spec consistency check found 39 mismatches: C:\Users\Surface\AppData\Local\Temp\hms-wp03\consistency.md (read it IN FULL).
An earlier alignment round died mid-way; some fixes are applied, some are not, some may be half-applied. Treat the files on disk as partial work.

Your job: for EVERY item in consistency.md whose fix touches YOUR file(s), check the current text of your file(s) and apply whatever part of the fix is still missing. Search your whole file for every stale name the item mentions (not only the cited line numbers; lines have moved). Read the other specs (read-only) when you need the owner's exact names and signatures; the owner's current text wins over the consistency report if the owner has already moved on.

Decisions the integrator made for items that offered a choice (apply these, consistently):
- Item 7: keep the key prefix `platform.time.entry.<timing-class>.*`; tenancy already reserves it as a shared namespace. Kernel: definitions are SafetyInvariant, TightenOnly, configurationRequired = RequiredBecause("CTRL-0010-1"), GOVERNED, no vendor default; resolver answers NotConfigured.
- Item 13: kernel SYSTEM_PROCESSES adds `hms.kernel.journal..`, `hms.kernel.events..`, `hms.platform.config.application.system..`, `hms.platform.tasks.application.system..`. Workflow: each signal relay lives in its owning module's `application.system` package, and that owning module's spec adds the package to SYSTEM_PROCESSES; no relay exists in WP-0.3.
- Item 20: tenancy adds `RestrictsTier2Function(function)` (already done there); config backing settings use it.
- Item 21: fixed keys whose value type is `CONTENT_REF(contentTypeId)` (no open key families). Approver roles `SET(STRING(role pattern))`; review queue `STRING([a-z][a-z0-9-]{0,62}, 63)`; fallback queue key `platform.tasks.orphan-alarm.fallback-queue`.
- Item 23: platform-tasks owns and declares the dead-letter alarm setting.
- Item 37: every module uses the shared `VolatileStore` marker (config's); volatile stores are refused at start-up in every environment class (BUILD, TEST, TRAIN, PROD, PLAY); allowed only in the dev profile with no environment class.
- Item 36: everyone uses the kernel's name `ArchTest:production-never-binds-test-adapters` with the kernel's exception clause.

Rules:
- Edit ONLY your assigned file(s), inside the worktree above. Never edit any other file, never run git commands that change state, never run Gradle or the test suites.
- House style: short plain sentences; keep existing citations; do not invent new BUILD-PROMPT citations; do not add new DN/OQ/KA/HAZ/ADR numbers from the programme ranges (spec-local IDs like OQ-J5, KA-T5, DN-KN1 that already exist may be closed or edited).
- Keep edits surgical; do not rewrite sections that are already consistent.
- When you finish, grep your file(s) for each stale name listed in consistency.md that should no longer appear, and confirm zero hits (or explain why a hit is legitimate, e.g. a "replaces X" note).

Final message (under 400 words): per item number touching your file: APPLIED-NOW / ALREADY-DONE / NOT-APPLICABLE / NOT-APPLIED(reason). Then any cross-file mismatch you noticed that another file must fix.

Search rule (from the lead, 10:00): never run `find /` or any search over a whole drive or home directory. Search only specific folders. Gradle jars are under C:/Users/Surface/.t3/projects/hospitalmanagementsystem/.tools/gradle-home/caches/modules-2/files-2.1/ ; other tools are under .tools/ in the worktree.
