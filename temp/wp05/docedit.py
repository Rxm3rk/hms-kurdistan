from pathlib import Path
def sub(path, old, new):
    p = Path(path); s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, (path, old[:60], s.count(old))
    p.write_text(s.replace(old, new), encoding="utf-8", newline="\n")
S = "docs/specs/modules/state-machines-and-invariants.md"
sub(S, "every state is reachable from `initial`.\n4.", "every state is reachable from `initial`. A creation command (`created_by`) is no transition's `on`.\n4.")
sub(S, "A machine §8.4 does not list (patient-context) may name any roles.",
    "A machine §8.4 does not list (patient-context) may name any roles. When a field is filled, `check` runs the safety gate's own record check on the spec (validity, signed commits against `allowed-signers.yaml`, withdrawals, version, role, value); only when the gate backs every filled field are the three human-field checks released.")
sub(S, "the owner's domain package holds exactly one object implementing the generated predicate interface (`<Prefix>Guards`), and the unit-test file `<Prefix>GuardsTest.kt` names every predicate in at least one test name.",
    "across every source set of the target projects and every Kotlin file under `tests/`, `<Prefix>Predicates` has exactly one implementation, `object <Prefix>Guards` in `src/main/kotlin` of the owner project in the machine package; implementations are found through import and type aliases and through sub-types, and no interface may extend `<Prefix>Predicates`. `<Prefix>GuardsTest.kt` declares `class <Prefix>GuardsTest`, names every predicate in a leaf test name or in a container holding a leaf test inside that class, and disables or focuses no test (`x…`, `!`, `f:`, `enabled` other than `true`, `enabledIf`, `@EnabledIf`/`@DisabledIf`/`@Ignored`/`@Disabled`). The holds/does-not-hold pair per predicate is left to review.")
sub(S, "No sign-off record exists yet; fixture repositories test the rule.",
    "Git runs with the safety gate's settings (no replace refs, grafts or commit-graph file), and a shallow clone fails when a record applies. No sign-off record exists yet; fixture repositories test the rule.")
sub(S, "Each run writes `build/pbt-counts/<test>.json`", "Each run writes `build/pbt-counts/<test task>/<test>.json`")
R = "docs/specs/state-machines/README.md"
sub(R, "every state is reachable from `initial`.\n4.", "every state is reachable from `initial`; no creation command is a transition's `on`.\n4.")
sub(R, "for the eight §8.4 machines `required` names exactly the §8.4 approvers (OQ-083).",
    "for the eight §8.4 machines `required` names exactly the §8.4 approvers (OQ-083). A filled field is released only when the safety gate's record check backs it.")
sub(R, "Comments and other strings do not count, and a file that disables a test fails.",
    "Comments and other strings do not count; the name must be a leaf test, or a container holding one, inside `class <P>GuardsTest`. A second implementation anywhere in the target projects or under `tests/` fails, including one reached through an import alias, a type alias or a sub-interface. A file that disables or focuses a test (`x…`, `!`, `f:`, `enabled` other than `true`, `enabledIf`, `@EnabledIf`, `@DisabledIf`, `@Ignored`, `@Disabled`) fails.")
sub(R, "A record that no commit added fails (\"record not committed\").",
    "A record that no commit added fails (\"record not committed\"). Git runs with the safety gate's settings, and a shallow clone fails when a record applies.")
print("ok")
