"""A spec read into plain values: states, commands, predicates, effects and transitions with ``"*"`` expanded.

Built only from a document that has passed the schema (rule 1); the semantic rules (rules.py) and the
emitter (emit.py) both work on this model, so they read the spec the same way (§1.2).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

STAR = "*"
ARROW = "→"
PRIVILEGED = "privilegedAndAudited"  # §1.2: B.3's name for "the user holds the privilege and the action is audited"


def constant_name(identifier: str) -> str:
    """SCREAMING_SNAKE_CASE of a kebab or camel id: ``in-progress`` -> ``IN_PROGRESS``,
    ``activeVerifiedOrder`` -> ``ACTIVE_VERIFIED_ORDER`` (contracts §1). An underscore goes before every
    upper-case letter, so two different ids never give one name (``aBC`` -> ``A_B_C``, ``aBc`` -> ``A_BC``)."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", identifier).replace("-", "_").upper()


@dataclass(frozen=True)
class Transition:
    index: int
    written_from: Any  # as written: a state, a list of states, or "*"
    sources: tuple[str, ...]  # the from states, "*" expanded to every state except ``to``
    on: str
    guard: tuple[str, ...]
    effects: tuple[str, ...]
    to: str
    description: str | None
    flagged: bool = False  # the transition's own ``proposed: true``

    @property
    def star(self) -> bool:
        return self.written_from == STAR

    @property
    def edges(self) -> tuple[str, ...]:
        """The edges as ``proposed`` writes them: ``"*→<to>"`` for a "*" transition, else ``"<from>→<to>"`` per state."""
        if self.star:
            return (f"{STAR}{ARROW}{self.to}",)
        return tuple(f"{source}{ARROW}{self.to}" for source in self.sources)

    def label(self) -> str:
        """``transitions[3] (signing -SubmitSign-> submitting)``, for messages."""
        written = self.written_from
        shown = "[" + ", ".join(written) + "]" if isinstance(written, list) else str(written)
        return f"transitions[{self.index}] ({shown} -{self.on}-> {self.to})"


@dataclass(frozen=True)
class Machine:
    name: str
    version: int
    owner: str
    states: tuple[str, ...]
    terminal: tuple[str, ...]
    initial: str
    created_by: tuple[str, ...]
    predicates: dict[str, str]
    effects: dict[str, str]
    transitions: tuple[Transition, ...]
    proposed: tuple[str, ...]
    invariants: tuple[str, ...]
    events: tuple[str, ...]
    hazards: tuple[str, ...]
    approval: dict[str, Any]

    @property
    def commands(self) -> tuple[str, ...]:
        """Every command: the creation commands first, then each transition's command in first-appearance order."""
        return tuple(dict.fromkeys([*self.created_by, *(t.on for t in self.transitions)]))

    def is_proposed(self, transition: Transition) -> bool:
        """A transition is proposed when its own ``proposed: true`` is set or any of its edges is listed in the
        top-level ``proposed`` (any edge: the stricter reading for a transition with several from states, which
        then carries an edge that awaits approval)."""
        listed = set(self.proposed)
        return transition.flagged or any(edge in listed for edge in transition.edges)


def build(document: dict[str, Any]) -> Machine:
    """The model of a schema-valid document."""
    states = tuple(document["states"])
    transitions = []
    for index, item in enumerate(document["transitions"]):
        written = item["from"]
        to = item["to"]
        if written == STAR:
            sources = tuple(s for s in states if s != to)
        elif isinstance(written, list):
            sources = tuple(written)
        else:
            sources = (written,)
        transitions.append(
            Transition(
                index=index,
                written_from=written,
                sources=sources,
                on=item["on"],
                guard=tuple(item.get("guard") or ()),
                effects=tuple(item.get("effects") or ()),
                to=to,
                description=item.get("description"),
                flagged=item.get("proposed") is True,
            )
        )
    return Machine(
        name=document["machine"],
        version=document["version"],
        owner=document["owner"],
        states=states,
        terminal=tuple(document["terminal"]),
        initial=document.get("initial", states[0]),
        created_by=tuple(document.get("created_by") or ()),
        predicates=dict(document["predicates"]),
        effects=dict(document.get("effects") or {}),
        transitions=tuple(transitions),
        proposed=tuple(document.get("proposed") or ()),
        invariants=tuple(document["invariants"]),
        events=tuple(document["events"]),
        hazards=tuple(document.get("hazards") or ()),
        approval=dict(document["approval"]),
    )
