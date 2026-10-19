"""Rules 2 to 10 of spec §2.1, on one machine that has passed rule 1 (parse and schema).

Each function returns failure messages; none of them is a warning. Every message names the rule, and where it
applies the transition (its index in ``transitions`` and its edge) and the item (state, predicate, effect,
role, hazard) at fault. The caller prefixes the spec's path and the machine.
"""

from __future__ import annotations

from collections import deque
from typing import Iterable

from hmstools.statemachines.model import PRIVILEGED, STAR, Machine
from hmstools.statemachines.targets import APPROVERS, Target

SI_IDS = frozenset(f"SI-{n:02d}" for n in range(1, 22))


def _quoted(items: Iterable[str]) -> str:
    return ", ".join(sorted(items))


def rule_2(machine: Machine, file_stem: str, modules: set[str], target: Target | None) -> list[str]:
    errors = []
    if machine.name != file_stem:
        errors.append(f"rule 2: machine is {machine.name!r} but the file is {file_stem}.yaml; they must be equal")
    if machine.owner not in modules:
        errors.append(f"rule 2: owner {machine.owner!r} is not a module of BUILD-PROMPT §5.2")
    if target is not None and machine.owner != target.owner:
        errors.append(
            f"rule 2: owner {machine.owner!r} differs from the owner module of its generation target, {target.owner!r} "
            f"({target.project}, spec §3.1)"
        )
    return errors


def rule_3(machine: Machine) -> list[str]:
    errors = []
    states = set(machine.states)
    for name in machine.terminal:
        if name not in states:
            errors.append(f"rule 3: terminal state {name!r} is not one of the states")
    if machine.initial not in states:
        errors.append(f"rule 3: initial state {machine.initial!r} is not one of the states")
    for transition in machine.transitions:
        written = transition.written_from
        sources = [] if written == STAR else (written if isinstance(written, list) else [written])
        for source in sources:
            if source not in states:
                errors.append(f"rule 3: {transition.label()}: from state {source!r} is not one of the states")
        if transition.to not in states:
            errors.append(f"rule 3: {transition.label()}: to state {transition.to!r} is not one of the states")
        if transition.on in machine.created_by:
            errors.append(
                f"rule 3: {transition.label()}: {transition.on} is a creation command (created_by), and a creation command "
                f"has no transition: an instance starts in the initial state {machine.initial!r} (§1.1)"
            )
    if machine.initial in states:
        reached = reachable(machine, machine.initial)
        for name in machine.states:
            if name not in reached:
                errors.append(f"rule 3: state {name!r} is not reachable from the initial state {machine.initial!r}")
    return errors


def _successors(machine: Machine) -> dict[str, set[str]]:
    graph: dict[str, set[str]] = {s: set() for s in machine.states}
    for transition in machine.transitions:
        for source in transition.sources:
            graph.setdefault(source, set()).add(transition.to)
    return graph


def reachable(machine: Machine, start: str) -> set[str]:
    graph = _successors(machine)
    seen = {start}
    queue = deque([start])
    while queue:
        for successor in graph.get(queue.popleft(), ()):
            if successor not in seen:
                seen.add(successor)
                queue.append(successor)
    return seen


def rule_4(machine: Machine) -> list[str]:
    errors = []
    for kind, declared, used_of in (
        ("predicate", machine.predicates, lambda t: t.guard),
        ("effect", machine.effects, lambda t: t.effects),
    ):
        section = "predicates" if kind == "predicate" else "effects"
        part = "guard" if kind == "predicate" else "effects"
        used: set[str] = set()
        for transition in machine.transitions:
            for name in used_of(transition):
                used.add(name)
                if name not in declared:
                    errors.append(
                        f"rule 4: unknown {kind}: {transition.label()}: {part} names {name!r}, which {section} does not declare"
                    )
        for name in declared:
            if name not in used:
                errors.append(f"rule 4: {kind} {name!r} is declared in {section} but no transition's {part} uses it")
    return errors


def rule_5(machine: Machine) -> list[str]:
    errors = []
    transitions = machine.transitions
    for i, first in enumerate(transitions):
        for second in transitions[i + 1:]:
            if first.on != second.on:
                continue
            shared = [s for s in machine.states if s in first.sources and s in second.sources]
            if not shared:
                continue
            a, b = set(first.guard), set(second.guard)
            if a <= b or b <= a:
                smaller, larger = (first, second) if a <= b else (second, first)
                shown = "the empty guard" if not smaller.guard else "guard [" + ", ".join(smaller.guard) + "]"
                errors.append(
                    f"rule 5: static determinism: {first.label()} and {second.label()} share the from state(s) "
                    f"{', '.join(shared)} and the command {first.on}, and {shown} of {smaller.label().split(' ')[0]} is a "
                    f"subset of the guard of {larger.label().split(' ')[0]}, so both can hold at once"
                )
    return errors


def rule_6(machine: Machine) -> list[str]:
    if machine.initial not in machine.states:
        return []
    errors = []
    terminal = set(machine.terminal)
    for name in sorted(reachable(machine, machine.initial), key=machine.states.index):
        ahead = reachable(machine, name)
        if terminal:
            if not ahead & terminal:
                errors.append(f"rule 6: liveness: no terminal state ({_quoted(terminal)}) is reachable from state {name!r}")
        elif machine.initial not in ahead:
            errors.append(
                f"rule 6: liveness: the machine has no terminal state, and the initial state {machine.initial!r} is not "
                f"reachable from state {name!r}"
            )
    return errors


def rule_7(machine: Machine) -> list[str]:
    errors = []
    terminal = set(machine.terminal)
    for transition in machine.transitions:
        leaving = [s for s in transition.sources if s in terminal]
        if leaving and PRIVILEGED not in transition.guard:
            errors.append(
                f"rule 7: terminal exit: {transition.label()} leaves the terminal state(s) {', '.join(leaving)} but its "
                f"guard does not carry {PRIVILEGED} (§1.2)"
            )
    return errors


def rule_8(machine: Machine) -> list[str]:
    edges = {edge for t in machine.transitions for edge in t.edges}
    return [
        f"rule 8: proposed edge {edge!r} is not the edge of any transition (a \"*\" transition's edge is \"*→<to>\")"
        for edge in machine.proposed
        if edge not in edges
    ]


def rule_9(machine: Machine, gate_errors: list[str] | None = None) -> list[str]:
    """Rule 9. The approval block reads requested, [] and null "until a sign-off record exists, which the safety
    gate checks" (§2.1, §1.1): ``gate_errors`` is the safety gate's verdict on the spec's filled fields
    (approval.gate_verdict), computed only when a field is filled. Only an empty verdict (every filled field backed
    by a record the gate accepts) releases the three human fields; None or any gate error keeps them failing."""
    errors = []
    approval = machine.approval
    if gate_errors is None or gate_errors:
        if approval.get("status") != "requested":
            errors.append(f"rule 9: approval.status is {approval.get('status')!r}; it reads requested until a sign-off record exists")
        if approval.get("approved_by") != []:
            errors.append(f"rule 9: approval.approved_by is {approval.get('approved_by')!r}; it stays [] (BUILD-PROMPT §3.5)")
        if approval.get("record") is not None:
            errors.append(f"rule 9: approval.record is {approval.get('record')!r}; it stays null (BUILD-PROMPT §3.5)")
        for problem in gate_errors or []:
            errors.append(f"rule 9: the safety gate backs no filled approval field with a sign-off record: {problem}")
    expected = APPROVERS.get(machine.name)
    if expected is not None:
        required = set(approval.get("required") or [])
        missing, extra = expected - required, required - expected
        if missing or extra:
            parts = []
            if missing:
                parts.append(f"missing {_quoted(missing)}")
            if extra:
                parts.append(f"not a §8.4 approver of this machine: {_quoted(extra)}")
            errors.append(
                f"rule 9: approval.required must name exactly the §8.4 approvers ({_quoted(expected)}; OQ-083): "
                + "; ".join(parts)
            )
    # A machine §8.4 does not list (patient-context) may name any roles.
    return errors


def rule_10(machine: Machine, hazard_ids: set[str] | None, hazard_problem: str | None) -> list[str]:
    errors = []
    for si in machine.invariants:
        if si not in SI_IDS:
            errors.append(f"rule 10: invariant {si!r} is not one of SI-01 to SI-21")
    for hazard in machine.hazards:
        if hazard_ids is None:
            errors.append(f"rule 10: hazard {hazard!r} cannot be checked: {hazard_problem}")
        elif hazard not in hazard_ids:
            errors.append(f"rule 10: hazard {hazard!r} does not exist in docs/safety/hazard-log.yaml")
    return errors


def approval_fields_filled(machine: Machine) -> int:
    """How many of the approval block's human fields are filled (0 while it reads requested, [] and null)."""
    approval = machine.approval
    return sum((
        approval.get("status") not in (None, "requested"),
        bool(approval.get("approved_by")),
        approval.get("record") is not None,
    ))
