"""Rules 1 to 10 of spec §2.1, the targets table, the clean fixture set and the foreign patient-context spec."""

from __future__ import annotations

import hashlib
import unittest

from hmstools.statemachines.tests.harness import FIXTURES, SandboxCase


def _blob_id(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()  # noqa: S324 - git's object id


class CleanSet(SandboxCase):
    def test_the_clean_set_passes_every_rule(self) -> None:
        self.box.clean_set()
        result = self.box.check()
        self.assertPasses(result)
        self.assertEqual(result.counts["specs"], 3)
        self.assertEqual(result.counts["machines_generated"], 2)
        self.assertEqual(result.counts["client_side_machines"], 1)
        self.assertEqual(result.counts["generated_files"], 4)
        self.assertEqual(result.counts["approval_fields_filled"], 0)
        self.assertEqual(result.counts["approval_records"], 0)

    def test_counts(self) -> None:
        self.box.add("clean", "toy-light.yaml", "toy-light.md")
        self.box.install_kotlin("toy-light")
        self.box.generate()
        counts = self.box.check().counts
        self.assertEqual(
            {k: counts[k] for k in ("transitions", "predicates", "effects", "proposed_edges", "proposed_transitions")},
            {"transitions": 4, "predicates": 3, "effects": 1, "proposed_edges": 1, "proposed_transitions": 2},
        )

    def test_one_machine_only(self) -> None:
        self.box.clean_set()
        self.box.write("docs/specs/state-machines/toy-broken.yaml", "machine: [")
        result = self.box.check(only="toy-light")
        self.assertPasses(result)
        self.assertEqual(result.counts["specs"], 1)
        self.assertFailsWith(self.box.check(), "toy-broken.yaml", "rule 1: does not parse")
        self.assertFailsWith(self.box.check(only="no-such-machine"), "no such spec (--machine no-such-machine)")


class ForeignSpec(SandboxCase):
    def test_the_fixture_is_the_reviewed_file_unchanged(self) -> None:
        # fixtures/foreign/SOURCE.txt: the blobs of fcadc88 (wp/0.7-design-system).
        self.assertEqual(_blob_id((FIXTURES / "foreign" / "patient-context.yaml").read_bytes()), "0c17a51c0850e84a9df701528361a530999eaa0e")
        self.assertEqual(_blob_id((FIXTURES / "foreign" / "patient-context.md").read_bytes()), "40508b4fa9e581c317df9d5e5643b908c1bc9d0e")

    def test_patient_context_passes_and_is_not_generated(self) -> None:
        self.box.add("foreign")
        result = self.box.check()
        self.assertPasses(result)
        self.assertEqual(result.counts["client_side_machines"], 1)
        self.assertEqual(result.counts["machines_generated"], 0)
        self.assertEqual(result.counts["transitions"], 24)
        generated = self.box.generate()
        self.assertPasses(generated)
        self.assertEqual(generated.counts["generated_files_written"], 0)
        self.assertFalse((self.box.root / "backend").exists())
        self.assertFalse((self.box.root / "frontend").exists())


class Violations(SandboxCase):
    def fails(self, fixture: str, *fragments: str, toy_targets: bool = True) -> None:
        self.box.add(f"violations/{fixture}")
        self.box.toy_targets = toy_targets
        self.assertFailsWith(self.box.check(), *fragments)

    def test_rule_1_ambiguous_boolean(self) -> None:
        self.fails("rule-01-ambiguous-boolean", "toy-light.yaml: machine toy-light: rule 1: does not parse",
                   "found the unquoted value 'YES', which YAML 1.1 reads as a boolean")

    def test_rule_1_duplicate_key(self) -> None:
        self.fails("rule-01-duplicate-key", "rule 1: does not parse", "found duplicate key 'version'")

    def test_rule_1_schema(self) -> None:
        self.fails("rule-01-schema", "rule 1: schema: (top level): 'events' is a required property")

    def test_rule_1_explanation(self) -> None:
        self.fails("rule-01-no-explanation", "rule 1: toy-light.md (the machine's explanation) does not exist beside it")

    def test_rule_1_file_names_and_places(self) -> None:
        self.box.add("clean", "toy-light.yaml", "toy-light.md")
        self.box.write("docs/specs/state-machines/other.yml", "machine: other\n")
        self.box.write("docs/specs/state-machines/old/toy-old.yaml", "machine: toy-old\n")
        self.assertFailsWith(
            self.box.check(),
            "docs/specs/state-machines/other.yml: rule 1: a spec is named <machine>.yaml",
            "docs/specs/state-machines/old/toy-old.yaml: rule 1: a spec lives directly in docs/specs/state-machines",
        )

    def test_rule_2_owner(self) -> None:
        self.fails("rule-02-owner", "rule 2: owner 'lighting' is not a module of BUILD-PROMPT §5.2",
                   "rule 2: owner 'lighting' differs from the owner module of its generation target, 'adt'")

    def test_rule_2_name(self) -> None:
        self.fails("rule-02-name", "toy-lamp.yaml: machine toy-light: rule 2: machine is 'toy-light' but the file is toy-lamp.yaml")

    def test_rule_3(self) -> None:
        self.fails("rule-03-states", "rule 3: terminal state 'scrapped' is not one of the states",
                   "rule 3: state 'spare' is not reachable from the initial state 'off'")

    def test_rule_3_from_and_to(self) -> None:
        text = (FIXTURES / "clean" / "toy-light.yaml").read_text(encoding="utf-8")
        text = text.replace("{from: on, on: SwitchOff", "{from: dim, on: SwitchOff").replace("to: retired}", "to: gone}")
        text = text.replace("initial: off", "initial: dark")
        self.box.write("docs/specs/state-machines/toy-light.yaml", text)
        self.box.add("clean", "toy-light.md")
        self.assertFailsWith(
            self.box.check(),
            "rule 3: transitions[1] (dim -SwitchOff-> off): from state 'dim' is not one of the states",
            "rule 3: transitions[2] (* -Retire-> gone): to state 'gone' is not one of the states",
            "rule 3: initial state 'dark' is not one of the states",
        )

    def test_rule_4(self) -> None:
        self.fails(
            "rule-04-unknown",
            "rule 4: unknown predicate: transitions[0] (off -SwitchOn-> on): guard names 'bulbFitted', which predicates does not declare",
            "rule 4: predicate 'lampIntact' is declared in predicates but no transition's guard uses it",
            "rule 4: unknown effect: transitions[1] (on -SwitchOff-> off): effects names 'ringsBell', which effects does not declare",
        )

    def test_rule_4_unused_effect(self) -> None:
        text = (FIXTURES / "clean" / "toy-light.yaml").read_text(encoding="utf-8").replace("effects: [logsSwitch], ", "")
        self.box.write("docs/specs/state-machines/toy-light.yaml", text)
        self.box.add("clean", "toy-light.md")
        self.assertFailsWith(self.box.check(), "rule 4: effect 'logsSwitch' is declared in effects but no transition's effects uses it")

    def test_rule_5(self) -> None:
        self.fails(
            "rule-05-determinism",
            "rule 5: static determinism: transitions[0] (off -SwitchOn-> on) and transitions[1] (off -SwitchOn-> retired) share "
            "the from state(s) off and the command SwitchOn, and guard [powerAvailable] of transitions[1] is a subset of the guard "
            "of transitions[0]",
        )

    def test_rule_5_star_and_empty_guard(self) -> None:
        text = (FIXTURES / "clean" / "toy-light.yaml").read_text(encoding="utf-8").replace(
            "  - {from: \"*\", on: Retire, to: retired}", "  - {from: \"*\", on: Retire, to: retired}\n  - {from: on, on: Retire, to: off}"
        )
        self.box.write("docs/specs/state-machines/toy-light.yaml", text)
        self.box.add("clean", "toy-light.md")
        self.assertFailsWith(self.box.check(), "transitions[2] (* -Retire-> retired) and transitions[3] (on -Retire-> off) share the from "
                             "state(s) on and the command Retire, and the empty guard")

    def test_rule_5_disjoint_guards_pass(self) -> None:
        # patient-context's five OpenSign alternatives share a from state and a command; no guard is a subset of another.
        self.box.add("foreign")
        self.assertPasses(self.box.check())

    def test_rule_6_terminal(self) -> None:
        self.fails("rule-06-liveness", "rule 6: liveness: no terminal state (retired) is reachable from state 'stuck'")

    def test_rule_6_recurrent(self) -> None:
        self.fails("rule-06-recurrent", "rule 6: liveness: the machine has no terminal state, and the initial state 'off' is not "
                   "reachable from state 'stuck'")

    def test_rule_7(self) -> None:
        self.fails("rule-07-terminal-exit", "rule 7: terminal exit: transitions[3] ([retired] -Reinstate-> off) leaves the terminal "
                   "state(s) retired but its guard does not carry privilegedAndAudited")

    def test_rule_7_star_includes_terminal_states(self) -> None:
        # "*" -> to includes every terminal state except to (§1.2), so it needs privilegedAndAudited.
        self.box.add("clean", "toy-wrapping-demonstration.yaml", "toy-wrapping-demonstration.md")
        path = self.box.specs / "toy-wrapping-demonstration.yaml"
        path.write_text(path.read_text(encoding="utf-8").replace("guard: [privilegedAndAudited], to: finished-in-error",
                                                                 "to: finished-in-error"), encoding="utf-8")
        self.assertFailsWith(self.box.check(), "rule 7: terminal exit: transitions[4] (* -MarkEnteredInError-> finished-in-error) leaves "
                             "the terminal state(s) finished-normally")

    def test_rule_8(self) -> None:
        self.fails("rule-08-proposed", "rule 8: proposed edge 'on→retired' is not the edge of any transition",
                   "rule 8: proposed edge 'off→off' is not the edge of any transition")

    def test_rule_9_human_fields(self) -> None:
        self.fails("rule-09-approval", "rule 9: approval.status is 'approved'", "rule 9: approval.approved_by is ['SYN-NOBODY']",
                   "rule 9: approval.record is 'SO-2026-0001'")

    def test_rule_9_approvers(self) -> None:
        self.fails("rule-09-approvers", "bed.yaml: machine bed: rule 9: approval.required must name exactly the §8.4 approvers "
                   "(bed-manager, nurse-panel; OQ-083): missing bed-manager; not a §8.4 approver of this machine: cso")

    def test_rule_9_every_section_8_4_machine_has_its_list(self) -> None:
        from hmstools.statemachines.targets import APPROVERS, TARGETS

        self.assertEqual(set(APPROVERS), set(TARGETS))

    def test_rule_10_hazard(self) -> None:
        self.fails("rule-10-hazard", "rule 10: hazard 'HAZ-9999' does not exist in docs/safety/hazard-log.yaml")

    def test_rule_10_existing_hazard_passes(self) -> None:
        text = (FIXTURES / "clean" / "toy-light.yaml").read_text(encoding="utf-8").replace("invariants: []", "invariants: [SI-16]\nhazards: [HAZ-0016]")
        self.box.write("docs/specs/state-machines/toy-light.yaml", text)
        self.box.add("clean", "toy-light.md")
        self.box.install_kotlin("toy-light")
        self.assertPasses(self.box.generate())
        self.assertPasses(self.box.check())

    def test_no_target(self) -> None:
        self.fails("targets-none", "machine toy-light: no generation target: 'toy-light' is neither a generated machine nor a "
                   "client-side one; add one to targets", toy_targets=False)


if __name__ == "__main__":
    unittest.main()
