# WP-0.5 Python slice: review fixes py-01 to py-11, and CI wiring S4 (spec §7)

Agent: WP-0.5 Python slice agent (AI). Worktree `t3-5dcdaa39`, branch `wp/0.5-state-machines`, 2026-10-19. Nothing committed. Every result below is from the Windows host and is **not evidence of record**.

## Files changed (all inside my slice)

- `tools/hmstools/statemachines/implementation.py` (rewritten: py-01, py-02, py-07, faster scan)
- `tools/hmstools/statemachines/approval.py` (py-03 shallow probe and the safety gate's git settings; py-06 `gate_verdict`)
- `tools/hmstools/statemachines/rules.py` (py-06 rule 9 deferral; py-08 creation command)
- `tools/hmstools/statemachines/check.py` (py-04, py-05, py-06 wiring, py-09, schema cache, one Kotlin index per run)
- `tools/hmstools/statemachines/emit.py` (`_escape` via `str.translate`: same output, byte-identical; speed only)
- `tools/hmstools/statemachines/sistatus.py` (new: `si-status`)
- `tools/hmstools/statemachines/__main__.py` (new subcommand `si-status [--require-domain] [--json]`)
- `tools/hmstools/statemachines/tests/test_approval.py` (template repositories; Rule13Git, Rule9Gate, CRLF/BOM)
- `tools/hmstools/statemachines/tests/test_implementation.py`, `test_rules.py`, `test_generate.py`, `test_cli.py` (new cases)
- `tools/hmstools/statemachines/tests/test_si_status.py` (new)
- `tools/hmstools/ci/tiers.py`, `tools/hmstools/ci/tests/test_ci.py` (S4)

**Generated Kotlin: unchanged.** `sh tools/hms statemachines generate --check` passes, 16 files current, 0 written. No API change for the machine agents.

## Part A: the findings

| id | fix | test that fails before the fix (shown on a scratch copy with the fix reverted) |
|---|---|---|
| py-01 | Rule 12 scans every `src/*` source set of every target project and every `*.kt` under `tests/` (build, .gradle, node_modules pruned), the generated files excepted (rule 11 pins them). Implementations are collected to a fixpoint through import aliases, type aliases (chains included), sub-interfaces and open/abstract classes; delegation, companion and anonymous objects count. Any interface extending `<P>Predicates` fails on its own. Exactly one implementation is allowed: `object <P>Guards`, in `src/main/kotlin` of the owner project, in the machine package. | `test_a_second_implementation_through_a_sub_interface`, `..._type_alias`, `..._import_alias`, `..._open_class`, `test_an_interface_extending_it_fails_even_with_no_implementation`, `test_delegation_and_a_companion_object_are_implementations`, `test_a_fake_in_every_other_source_set_and_in_the_tests_projects` (testFixtures, propertyTest, test, tests/invariants, tests/scenarios), `test_the_one_implementation_is_named_guards`, `test_the_one_implementation_lives_in_src_main` |
| py-02 | Fails on any test name starting with `!` or `f:`; `x`-prefixed calls in any case (`xContext`, `xGiven`); `enabled =` with anything but the literal `true`; `enabledIf`, `enabledOrReasonIf`, `invocations = 0`; `@EnabledIf`/`@DisabledIf`/`@Ignored`/`@Disabled` and kin in any letter case. `enabled = true` passes. | `test_every_skip_mechanism_fails` (9 of its 11 forms passed before), `test_enabled_true_is_not_a_skip` (guard) |
| py-03 | When at least one record applies, rule 13 runs `git rev-parse --is-shallow-repository` and fails unless it prints `false` ("shallow clone: the content each approval record approved cannot be read (...); fetch the full history"); a failing probe fails too. Git now runs with the safety gate's settings (`--no-replace-objects`, `core.commitGraph=false`, `GIT_GRAFT_FILE=<null device>`, `GIT_NO_REPLACE_OBJECTS=1`), bytes decoded as UTF-8. | `Rule13.test_a_shallow_clone_fails_when_a_record_applies` (real git, `.git/shallow` as `clone --depth 1` writes it), `Rule13Git.test_a_shallow_repository_fails`, `test_a_failing_probe_fails`, `test_an_unknown_answer_fails_closed_and_a_full_clone_passes`, `test_git_runs_with_the_safety_gate_settings`. The reviewer's `shallow.py` now reports 1 rule-13 error in the shallow clone (was 0). |
| py-04 | Rule 1 fails unless `version` is a Python `int` ("version is 1.0; it is an integer written without a decimal point"); the spec then has no model, so `generate` writes nothing. Done in `check.read_spec` (the schema file is outside my slice). | `test_rule_1_version_must_be_an_integer` |
| py-05 | A spec that fails rule 1 still owns its generated files (looked up by file stem and by its `machine` value), so they are not reported as orphans. | `test_rule_1_failure_does_not_call_the_generated_files_orphans` |
| py-06 | **Implemented, as the spec says.** §2.1 rule 9: "reads requested, [] and null (until a sign-off record exists, which the safety gate checks)"; §1.1: the safety gate enforces it. When any human field is filled, rule 9 runs the safety gate's own code on that spec (`approval.gate_verdict`: `safety.check._load_signoffs` with the gate's git authentication against `allowed-signers.yaml`, `signoffs.withdrawals`, `signoffs.match_gate_field`). Only an empty verdict releases the three human-field checks; any gate error keeps them failing and is quoted. With nothing filled, the gate is never read. The §8.4 `required` check always applies, and rule 13 still applies to the record. | `Rule9Gate.test_a_record_the_gate_accepts_releases_the_human_fields`; guards: `..._without_a_record_fail`, `..._does_not_authenticate_...`, `..._for_another_version_...`, `test_the_gate_authentication_fails_closed_here` (default git authentication, no signer: fails), `test_no_filled_field_never_reads_the_records` |
| py-07 | A name counts only from a leaf test (`test`, `should`, `it`, `expect`, `scenario`, `then`/`Then`, string-spec `"..." {`) or a container holding a leaf (`context`, `describe`, `feature`, `given`/`Given`, `when`/`When`, `and`/`And`, free-spec `"..." - {`), inside `class <P>GuardsTest` (constructor lambda or class body). The file must declare that class. The "holds and does not hold" pair of contracts §4 is documented as left to review (a text scan cannot check it). | `test_an_empty_container_does_not_count`, `test_a_name_outside_the_spec_class_does_not_count`, `test_the_spec_class_must_exist`, `test_a_class_body_and_behavior_spec_containers_count` |
| py-08 | Rule 3 fails on a transition whose `on` is a creation command ("SwitchOn is a creation command (created_by), and a creation command has no transition ..."). The 8 real specs pass. | `test_rule_3_a_creation_command_has_no_transition` |
| py-09 | Order-aware message (no SHA change, so no generated file changes): when the file holds exactly the generator's lines in another order, rule 11 says "the order of the spec's predicates or effects changed since it was generated (the canonical sha256 ignores key order, the Kotlin keeps it), or the file was reordered by hand". | `test_reordered_predicates_are_not_called_a_hand_edit` |
| py-10 | Generator left as is. Contract text to change: see "Proposed text" below. | none (documentation) |
| py-11 | No assertion removed or weakened. Rule13: three starting repositories (no commit, spec committed, spec and record committed) built once per class and copied per test (git hooks template empty); the two tests that ran `check` twice now assert errors and counts on one run. Schema read and metaschema-checked once per (path, mtime, size). Kotlin index built once per run with `os.walk` pruning `build/`; supertype matching on identifier sets; brace matching and the scanner jump with regexes; `_escape` via `translate`. New `test_the_templates_are_the_states_they_name` pins the templates to the states they replace. | Timing below |

## Commands run (Windows host, not evidence of record)

| Command | Result |
|---|---|
| `.tools/venv/Scripts/python.exe -I -m unittest discover -s tools/hmstools/statemachines -t tools -p 'test_*.py'` (baseline, before any change) | 88 tests OK, 75.7 s (1 m 19 s wall) |
| same, after all changes | **130 tests OK** in 38.0 s, 47.4 s and 51.3 s on three runs (the last one the final run, after the si-status change). The host is heavily loaded by Gradle in other worktrees: one process spawn costs 0.2-0.5 s now (the reviewer measured 0.14 s). The same host ran the 88-test baseline in 75.7 s and, under load, 143.5 s. |
| same suite, on a scratch copy outside the repo with each fix reverted (`revert_fixes.py` + the original `implementation.py`) | 37 failures + 1 error, all in the new fix tests (plus `RealRegister`, only because the copy has no `tests/invariants`) |
| `.tools/venv/Scripts/python.exe -I -m unittest discover -s tools/hmstools/ci -t tools -p 'test_ci.py'` | 46 tests OK, 77.4 s |
| `.tools/venv/Scripts/python.exe -I -m unittest discover -s tools/hmstools/ci -t tools -p 'test_*.py'` (baseline) | 42 tests OK, 368.6 s (the secret-scan tests dominate) |
| same, final | **52 tests OK, 199.3 s** |
| `sh tools/hms statemachines generate --check` | PASS, 16 generated files current, 0 written |
| `sh tools/hms statemachines check` | **PASS** (exit 0): 8 specs, 228 transitions, 231 predicates, rules 1-13. Rule 12 now passes for all 8 machines: the machine agents' `<P>Guards`/`<P>GuardsTest` files have landed, and the stricter scan finds no false positive in them. |
| `sh tools/hms statemachines si-status` | exit 0; 21 lines; warnings: no status files yet, 21 domain layers NOT-BUILT |
| `sh tools/hms statemachines si-status --require-domain --json` | exit 1; one error listing all 21 SIs with the work package each waits on and KA-060 |
| `sh tools/ci/run nightly --list` | shows `property-1e6`, `si-domain-layer`, `scenario-suites` as built, `property-channels` NOT-BUILT with the §7 waits-on text |
| reviewer probes `scratch/py/probe.py`, `shallow.py` | every bypass (A, B, B2, B3, C1-C7, E, H, I) now fails the check; shallow clone gives 1 rule-13 error |

No Gradle run, no full fast tier (as instructed).

## Part B: CI wiring (spec §7)

- **Nightly** (§19.1 order): `cell-check` (NOT-BUILT), `property-1e6`, `si-domain-layer`, `property-channels` (NOT-BUILT), `scenario-suites`, then the other NOT-BUILT rows. The NOT-BUILT rows `property-1e6` and `scenario-suites` (WP-0.5) are removed.
- `property-1e6`: `sh backend/gradlew -p backend propertyTest -Phms.pbt.sequences=1000000 --no-build-cache --console=plain`, timeout 6 h. Before: stale JUnit and counts files deleted. Passes only when the JUnit XML of this run passes, at least one counts file was written by this run, every counts file is readable, every run says `"result": "pass"` and every run has at least 1,000,000 sequences. The record holds `pbt_runs`, `pbt_sequences`, `pbt_steps` and `pbt_sequences_per_test` (name, machine, file, budget, sequences, steps, result, transitions covered and total, per run). The message always says: "These are specification-layer models and SI properties ... not the 10^6 application-command-layer run of §19.1 (spec §7; KA-062)."
- `si-domain-layer`: `sh tools/hms statemachines si-status --require-domain --json`, CheckResult contract. Fails today, listing 21 SIs.
- `scenario-suites`: `sh backend/gradlew -p backend :tests:scenarios:scenarioSuites --console=plain`; before: the old `pass-matrix.*` deleted. Reads `tests/scenarios/build/reports/scenarios/pass-matrix.json` of this run; passes only with exit 0, matrix result PASS, at least one suite, and every suite PASS. The message lists NOT-BUILT (KA-064) and failing suites, and labels passing mock-KB suites "Mock-KB run, not clinical evidence" (§18.5 #1). Counts: the matrix's counts plus `suites_listed`.
- `property-channels` stays NOT-BUILT: "each channel adapter's work package (UI command layer, API, mobile sync, HL7 inbound, migration loader, plugin effects)" (the §7 text).
- **backend-fast**: passes as before (JUnit). Its prepare also deletes stale counts and SI status files; its record adds `pbt_runs`, `pbt_sequences`, `pbt_steps`, `si_status_files`, `si_spec_layer_holds`, `si_spec_layer_failed`, `si_domain_not_built` (and unreadable/stale counts), from this run's files only.
- **`si-status`** reads the real register (`version`, `entries[]` with `si`, `title`, `domain_layer`, `waits_on`, `ka`, `hazards`, `backlog`, `domain_marker`, `spec_layer[{machine, property, clauses}]`, `planned_test`; the extra keys `title_source`, `enforced_in`, `planned_tests`, `waits_on_source`, `domain_watch` are accepted and not required). The real file reads with no error (`RealRegister` test). Absent register: fails closed. Malformed register, malformed or contradicting status file (wrong `si`, unknown values, domain layer differing from the register, HOLDS with no registered property, NONE with registered properties, a bad `spec_layer_properties` or `domain_test`), a FAILED `spec_layer` or a FAILED `domain_test`: exit 1. `--require-domain`: exit 1 while any entry is NOT-BUILT, one error listing all.

## Decisions taken (and why)

1. **Counts glob.** The task said `**/build/pbt-counts/*.json`; the harness actually writes `<build>/pbt-counts/<test task>/<name>.json` (`SequenceCounts.kt`). I read `**/build/pbt-counts/**/*.json`, which covers both. Spec §3.3 says `build/pbt-counts/<test>.json`; see proposed text.
2. **property-1e6 fails on any run below 10^6 sequences** (stricter reading of §19.1 "10^6 ... sequences" and §7 "the actual sequence count per test"). A test with a fixed smaller budget would otherwise pass the nightly claim. Proposed as a DN below.
3. **py-06 deferral reads the gate's full acceptance** (schema, file name, date, git signature against allowed-signers, withdrawals, version, role, value), not just "a record exists". This is the spec's wording and cannot be weaker than the safety gate, which runs in the same fast tier.
4. **Rule 12 scans every target project plus `tests/`**, wider than "the owner project" (a superset at no extra cost: each file is parsed once per run). Name collisions across packages over-report (fail closed).
5. **`enabled =`** anything but literal `true` fails, as instructed. A facts parameter named `enabled` in a GuardsTest would trip it (fail closed); rename the parameter if that happens. `==` comparisons are not matched.
6. Message changes to existing rules are additive (the old fragments the tests pin are kept).

## Points for a human (proposed DN/OQ text)

- **Proposed DN (CSO / lead): nightly sequence floor per test.** "property-1e6 fails when any sequence run in the nightly propertyTest has fewer than 1,000,000 sequences. Options: (a) floor per run (default in use, stricter); (b) floor on the total only; (c) a per-test floor recorded in each test. Default (a) until decided."
- **Proposed OQ: rule 9 after the first sign-off.** "Rule 9 now defers the three human fields to the safety gate's verdict on the spec (approval.gate_verdict), as §2.1 rule 9 and §1.1 say. No sign-off record exists, so the path is tested only with synthetic records and a stubbed authenticator, plus one fail-closed run with the real git authentication. Verify it with the first real record in the WSL clone."

## Proposed text (files outside my slice)

- **contracts.md §3 (py-10)**, replace the header lines of the example with the three lines the generator writes, and add the suppressions:
  ```
  // GENERATED by tools/hms statemachines generate (generator 1) from docs/specs/state-machines/toy-light.yaml
  // sha256 of the canonical spec: <64 hex>
  // Do not edit: change the spec and run `sh tools/hms statemachines generate`.
  ```
  and: "`interface <P>Predicates` carries `@Suppress("TooManyFunctions")`, `object <P>Machine` carries `@Suppress("LargeClass")` and `holds` carries `@Suppress("CyclomaticComplexMethod")`: the generated shape trips these detekt defaults by design (one function per predicate, one block per transition, one `when` branch per predicate). The two-line header would put line 2 over 140 columns." Same for contracts §5 ("same header": three lines).
- **Spec §2.1 rule 3**, add: "A creation command (`created_by`) is no transition's `on`."
- **Spec §2.1 rule 9**, append: "When a field is filled, `check` runs the safety gate's own record check on the spec (validity, signed commits against `allowed-signers.yaml`, withdrawals, version, role, value); only when the gate backs every filled field are the three human-field checks released."
- **Spec §2.1 rule 12**, replace the first sentence with: "Each predicate is implemented once and unit-tested: across every source set of the target projects and every Kotlin file under `tests/`, `<Prefix>Predicates` has exactly one implementation, `object <Prefix>Guards` in `src/main/kotlin` of the owner project in the machine package; implementations are found through import and type aliases and through sub-types, and no interface may extend `<Prefix>Predicates`. `<Prefix>GuardsTest.kt` declares `class <Prefix>GuardsTest`, names every predicate in a leaf test name or in a container holding a leaf test inside that class, and disables or focuses no test (`x…`, `!`, `f:`, `enabled` other than `true`, `enabledIf`, `@EnabledIf`/`@DisabledIf`/`@Ignored`/`@Disabled`). The holds/does-not-hold pair per predicate is left to review."
- **Spec §2.1 rule 13**, append: "Git runs with the safety gate's settings (no replace refs, grafts or commit-graph file), and a shallow clone fails when a record applies."
- **Spec §3.3**, change "`build/pbt-counts/<test>.json`" to "`build/pbt-counts/<test task>/<test>.json`".
- **docs/specs/state-machines/README.md** rules 3, 9, 12, 13: the same changes in its short form.
- **STATUS.md**: slice S4 (CI wiring) done; `state-machines-check` passes on the Windows host.

## Not finished / remaining

- Nothing in my scope. The nightly steps were exercised only with fake files and fake commands (no Gradle run, as instructed); the first real nightly run in the WSL clone is the evidence.
- The SI status files: `si-status` follows the writer the SI scaffold agent has now written (`tests/invariants/.../status/SiStatus.kt`, `SiStatusRecorder.document()`): `spec_layer_properties` is a count (a list is accepted too), and `domain_test` (`NOT-RUN`/`PASSED`/`FAILED`) is read; a `FAILED` domain test fails `si-status`, quoting `domain_test_message`. No status file exists in this worktree yet (no Gradle run), so the reading of real files is shown only with files of the same shape written by the tests.
