# State machines

Executable state-machine specifications, one `<name>.yaml` (template BUILD-PROMPT Appendix B.3) plus a `<name>.md` explanation per machine (§8.4). Guards are lists of named predicates, each implemented once in the owning module's domain package; property-test models are generated from these files, and the generator fails on an unknown predicate. Each machine has an owner module and an approval block that reads `status: requested` with `approved_by` empty until a human sign-off record exists (§3.5); undrawn transitions are marked "proposed". WP-0.5 fills this directory with encounter, order, medication administration, specimen, result and bed, then appointment and credit claim; later work packages add the other lifecycles §8.4 lists before any UI work on them.

The format, the rules and the generated code are specified in `docs/specs/modules/state-machines-and-invariants.md` §1 and §2. The schema is `state-machine.schema.json`.

## Commands

| Command | What it does |
|---|---|
| `sh tools/hms statemachines check [--json] [--machine NAME]` | Runs every rule below on every spec here (or on `NAME.yaml` only). Exit 0 pass, 1 fail, 2 usage or environment error. The fast-tier CI step `state-machines-check` runs it with `--json` |
| `sh tools/hms statemachines generate [--json] [--machine NAME]` | Writes the generated Kotlin of every generated machine whose spec passes rules 1 to 10; a spec that fails them is not generated, and the command fails |
| `sh tools/hms statemachines generate --check [--json]` | Writes nothing; fails if a generated file is not what the generator writes now (rule 11 only) |

With `--json` the last line of the output is one JSON object (`check`, `ok`, `counts`, `errors`, `warnings`). The counts are `specs`, `machines_generated`, `client_side_machines`, `transitions`, `predicates`, `effects`, `proposed_edges`, `proposed_transitions`, `approval_fields_filled` (0 while every approval block reads requested), `generated_files`, `generated_files_written` and `approval_records`.

## Reading the files

The tools read every spec with one loader (`tools/hmstools/statemachines/loader.py`), so the checks and the generator read the same document. Keys are read as written: only `true` and `false` are booleans, and `on`, `off`, `yes`, `no`, `y` and `n` stay strings, so the transition key `on` and a state called `on` mean what they say. Any other value that YAML 1.1 reads as a boolean (`True`, `YES`, `On`, `N` …) fails: quote it or write `true`/`false`. Dates stay strings. Duplicate keys, merge keys (`<<`) and keys that are not strings fail. `"*"` in `from` means every state except the transition's `to`.

## The rules

Each rule is a failure, never a warning. A message names the file, the machine, the rule and, where it applies, the transition (`transitions[3] (signing -SubmitSign-> submitting)`) and the item at fault.

1. The file parses with the reading rules above, validates against the schema, and `<machine>.md` exists beside it. Specs live directly in this directory and end in `.yaml`.
2. `machine` equals the file name; `owner` is a BUILD-PROMPT §5.2 module and the owner of the machine's generation target.
3. `terminal` and `initial` are states; every `from` and `to` is a state or `"*"`; every state is reachable from `initial`.
4. Every guard predicate and every effect is declared, and every declared predicate and effect is used.
5. Static determinism: two transitions with a shared `from` state and the same `on` fail when one guard is a subset of the other (the empty guard included).
6. Liveness: from every reachable state a terminal state is reachable; with no terminal state, `initial` is reachable from every state.
7. Every transition from a terminal state carries `privilegedAndAudited`. A `"*"` transition starts in every terminal state except its `to`.
8. Every `proposed` edge is the edge of a transition (`"*→<to>"` for a `"*"` transition).
9. The approval block reads `status: requested`, `approved_by: []` and `record: null`, and for the eight §8.4 machines `required` names exactly the §8.4 approvers (OQ-083).
10. `invariants` are SI-01 to SI-21, and every `hazards` entry exists in `docs/safety/hazard-log.yaml`.
11. The generated files are current: `check` generates them in memory and compares them byte for byte, and a file with the generated header whose spec is gone fails.
12. The owner's Gradle project holds exactly one implementation of `<P>Predicates` in `src/main/kotlin`, a named object in the machine's package (`object <P>Guards`), and `src/test/kotlin/**/<P>GuardsTest.kt` names every predicate in at least one test name: the first string of `test(…)`, `context(…)`, `should(…)`, `describe(…)`, `it(…)`, `expect(…)`, `feature(…)`, `scenario(…)`, `given(…)`, `when(…)`, `then(…)` or `and(…)`, or a string-spec name `"…" {`. Comments and other strings do not count, and a file that disables a test fails.
13. A changed spec keeps no approval (KA-013): for every record in `docs/safety/signoffs/` whose `subject` is the machine and whose `subject_version` is the spec's `version`, the spec's canonical content at each commit that added the record equals its content now. A record that no commit added fails ("record not committed").

The canonical content is the parsed document as canonical JSON (sorted keys, no spaces, UTF-8) without the approval block's `status`, `approved_by` and `record`: the reduction the sign-off gate uses. Comments and layout do not count; every other key and value does.

## Machines and targets

The generated machines and where their code goes are listed in `tools/hmstools/statemachines/targets.py` (spec §3.1). A machine is generated into its owner's Gradle project: `<project>/src/main/kotlin/<package>/<P>Machine.kt` and `<project>/src/propertyTest/kotlin/<package>/<P>GeneratedPropertyTest.kt`, where `P` is the PascalCase of the machine name. Client-side machines (patient-context, `frontend/packages/ui-core`) are checked by rules 1 to 10 and 13 and are not generated (OQ-200). A spec whose machine is in neither list fails until it is added there.

A transition is proposed, in the generated model, when it carries `proposed: true` or any of its edges is in the top-level `proposed` list.

## The generated code

Generated files are committed, start with a header naming the generator version, the spec and the SHA-256 of its canonical content, and are never edited by hand: change the spec and run `generate`. The output is byte-stable, uses LF line endings and is laid out so that ktlint_official (max line 140) and detekt accept it unchanged. Three detekt rules are suppressed in it where its shape trips them by design: `TooManyFunctions` on the predicate interface, `LargeClass` on the machine object and `CyclomaticComplexMethod` on `holds`.
