# WP-0.3 library slice brief (shared by every library slice agent)

Worktree (absolute, your only writable area): C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03
Branch wp/0.3-platform-kernel. The governing document is BUILD-PROMPT.md at the worktree root. The module spec for the kernel libraries is docs/specs/modules/platform-kernel.md (read §1-§4, your library's section, §11, §15-§18 and anything they reference; it is large, read in ranges). It is BINDING: implement the signatures it gives, exactly; where the spec is silent, choose the simplest thing and say so in your report.

Conventions (read these files first): backend/README.md; backend/build-logic/src/main/kotlin/*.gradle.kts; backend/platform/testing (PropertyTestBudget and its tests show the property-test style); backend/platform/arch-rules (HmsArchitectureRules, ProjectArchitecture; the ArchitectureTest in backend/platform/testing/src/test shows the pattern every project needs). Kotlin, Kotest FunSpec, ktlint_official style, detekt default rules plus backend/config/detekt/detekt.yml, warnings are errors. Unit tests in src/test, property tests in src/propertyTest using PropertyTestBudget.sequences() (never a literal count). No framework types in kernel libraries. No `now()` and no system default zone/locale. Synthetic data only. KDoc on public types citing the spec section, in the repository's short plain style.

Test names: the spec names tests like `UnitTest:foo-bar` / `PropertyTest:foo-bar`. Make each named test for your library exist with a test name that contains the slug (for example `test("foo-bar: ...")`), so a grep for the slug finds it.

Building: NEVER run gradle directly. Use only:
  sh /c/Users/Surface/AppData/Local/Temp/hms-wp03/gradle.sh <tasks>
for example `sh /c/Users/Surface/AppData/Local/Temp/hms-wp03/gradle.sh :platform:ids:test :platform:ids:propertyTest :platform:ids:detekt :platform:ids:ktlintCheck :platform:ids:verifyArchitectureTest`
(use `:platform:<lib>:tasks --all` once if unsure of names). It takes a worktree lock and a host-wide slot, so it may wait several minutes: be patient, run it with a long timeout (up to 10 min; use run_in_background for longer and wait). Other slices build in the same worktree; never delete build directories, never kill other Gradle processes. Batch your fixes so you build few times. `ktlintFormat` on your own project is allowed.

Rules: edit ONLY the paths your slice owns (named in your prompt). Do not edit settings.gradle.kts, libs.versions.toml, docs/program/*, the specs, or other projects. If you need a dependency not in backend/gradle/libs.versions.toml, do not add it: report it. Never run git commands that change state (no add/commit/stash/checkout/reset). Never start Docker or anything in WSL. Do not run the full fast tier (tools/ci/run); the integrator does.

Finish when your project's test, propertyTest, detekt, ktlintCheck and verifyArchitectureTest tasks all pass (Windows host). Final message (under 500 words): files created; the spec's named tests implemented (slugs) and any it names that you did not implement and why; test counts per task from the final run; every place you deviated from or had to interpret the spec; anything another slice or the integrator must do.

Search rule (from the lead, 10:00): never run `find /` or any search over a whole drive or home directory. Search only specific folders. Gradle jars are under C:/Users/Surface/.t3/projects/hospitalmanagementsystem/.tools/gradle-home/caches/modules-2/files-2.1/ ; other tools are under .tools/ in the worktree.
