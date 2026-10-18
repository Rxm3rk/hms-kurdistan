"""Apply tools/licence/policy.yaml to components (BUILD-PROMPT.md §4.3)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional

from .spdx import Leaf, Node, Op, SpdxError, looks_like_expression, parse

# Verdicts, best first. OR takes the best operand, AND the worst.
ALLOWED, CONDITIONAL, UNMAPPED, DENIED = 0, 1, 2, 3
NAMES = {ALLOWED: "allowed", CONDITIONAL: "conditional", UNMAPPED: "unmapped", DENIED: "denied"}


@dataclass
class Component:
    name: str
    version: str = ""
    purl: str = ""
    type: str = ""
    scope: Optional[str] = None  # "shipped" or "build-only"; None means the policy default
    licences: list[str] = field(default_factory=list)  # each an SPDX expression or a licence name
    source: str = ""

    @property
    def label(self) -> str:
        return f"{self.name}@{self.version}" if self.version else self.name


@dataclass
class Verdict:
    level: int
    reason: str
    condition: Optional[str] = None
    hard: bool = False  # denylisted or excluded by name: no conditional rule can lift it

    @property
    def name(self) -> str:
        return NAMES[self.level]


@dataclass
class Policy:
    data: dict[str, Any]

    @classmethod
    def load(cls, path: Path) -> "Policy":
        import yaml  # PyYAML, pinned in tools/requirements.txt

        with open(path, encoding="utf-8") as handle:
            return cls(yaml.safe_load(handle))

    @property
    def default_scope(self) -> str:
        return str(self.data["scopes"].get("default", "shipped"))

    def allowed(self) -> set[str]:
        return set(self.data.get("allowed") or [])

    def conditional_licences(self) -> dict[str, str]:
        return {e["id"]: e["condition"] for e in (self.data.get("conditional") or {}).get("licences") or []}

    def conditional_components(self) -> list[dict[str, Any]]:
        return list((self.data.get("conditional") or {}).get("components") or [])

    def denied(self) -> set[str]:
        return set((self.data.get("denied") or {}).get("licences") or [])

    def denied_patterns(self) -> list[re.Pattern[str]]:
        return [re.compile(p) for p in (self.data.get("denied") or {}).get("name_patterns") or []]

    def build_only_acceptable(self) -> set[str]:
        return set(self.data.get("build_only_acceptable") or [])

    def copyleft_restricted(self) -> re.Pattern[str]:
        return re.compile((self.data.get("copyleft_restricted") or {}).get("pattern", r"^(A?GPL-\d)"))

    def exclusions(self) -> list[dict[str, Any]]:
        return list(self.data.get("excluded_components") or [])

    def aliases(self) -> dict[str, str]:
        return {k.lower(): v for k, v in (self.data.get("aliases") or {}).items()}


def version_tuple(text: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", text)[:4])


def matches(rule: dict[str, Any], component: Component) -> bool:
    """A match block matches if any of its keys (purl, name, type) matches."""
    fields = {"purl": component.purl, "name": component.name, "type": component.type}
    for key, pattern in (rule.get("match") or {}).items():
        value = fields.get(key, "")
        if value and re.search(str(pattern), value):
            return True
    return False


class Evaluator:
    def __init__(self, policy: Policy, register: Optional[list[dict[str, Any]]] = None):
        self.policy = policy
        self.register = register or []
        self._allowed = policy.allowed()
        self._conditional = policy.conditional_licences()
        self._denied = policy.denied()
        self._denied_patterns = policy.denied_patterns()
        self._build_only = policy.build_only_acceptable()
        self._copyleft = policy.copyleft_restricted()
        self._aliases = policy.aliases()

    # --- licence text -> expression tree
    def to_node(self, text: str) -> Optional[Node]:
        text = text.strip()
        if not text:
            return None
        alias = self._aliases.get(text.lower())
        if alias:
            return parse(alias)
        if looks_like_expression(text):
            try:
                node = parse(text)
            except SpdxError:
                return Leaf(text)
            return self._apply_aliases(node)
        return Leaf(text)  # a free-form name; classified (and usually unmapped) below

    def _apply_aliases(self, node: Node) -> Node:
        if isinstance(node, Leaf):
            alias = self._aliases.get(node.licence.lower())
            if alias and not node.exception:
                return parse(alias)
            if alias and node.exception:
                return Leaf(alias, node.exception)
            return node
        return Op(node.operator, tuple(self._apply_aliases(o) for o in node.operands))

    # --- leaves
    def leaf(self, leaf: Leaf, scope: str) -> Verdict:
        text = str(leaf)
        if text in self._denied or leaf.licence in self._denied or (leaf.exception or "") in self._denied:
            return Verdict(DENIED, f"{text} is on the denylist (§4.3)", hard=True)
        for pattern in self._denied_patterns:
            if pattern.search(text):
                return Verdict(DENIED, f"'{text}' matches denylisted licence wording {pattern.pattern!r} (§4.3)", hard=True)
        if scope == "build-only":
            if text in self._allowed or text in self._conditional or text in self._build_only:
                return Verdict(ALLOWED, f"{text} has no use restriction (build-only scope)")
            if not leaf.exception and leaf.licence in self._allowed:
                return Verdict(ALLOWED, f"{text} (build-only scope)")
            return Verdict(UNMAPPED, f"'{text}' is not classified in tools/licence/policy.yaml")
        if leaf.exception is None and text in self._allowed:
            return Verdict(ALLOWED, f"{text} is on the allowlist")
        if text in self._conditional:
            return Verdict(CONDITIONAL, f"{text} is conditional", self._conditional[text])
        if self._copyleft.search(leaf.licence):
            if leaf.exception == "Classpath-exception-2.0":
                return Verdict(
                    UNMAPPED,
                    f"{text} is allowed only for the OpenJDK runtime (§4.3); for any other component record a "
                    "decision in DECISIONS-NEEDED.md (§3.4 item 2)",
                )
            return Verdict(
                DENIED,
                f"{text} in shipped code is allowed only as an unmodified, separate container with a source offer (§4.3)",
            )
        if leaf.exception is None and leaf.licence in self._allowed:
            return Verdict(ALLOWED, f"{text} is on the allowlist")
        return Verdict(UNMAPPED, f"'{text}' is not classified in tools/licence/policy.yaml")

    def node(self, node: Node, scope: str) -> Verdict:
        if isinstance(node, Leaf):
            return self.leaf(node, scope)
        verdicts = [self.node(o, scope) for o in node.operands]
        if node.operator == "OR":
            return min(verdicts, key=lambda v: (v.level, v.hard))
        return max(verdicts, key=lambda v: (v.level, v.hard))

    # --- components
    def registered(self, component: Component) -> bool:
        for entry in self.register:
            pattern = str(entry.get("component", ""))
            if pattern and (re.search(pattern, component.purl or "") or re.search(pattern, component.name)):
                return True
        return False

    def evaluate(self, component: Component) -> Verdict:
        scope = component.scope or self.policy.default_scope
        for rule in self.policy.exclusions():
            if not matches(rule, component):
                continue
            minimum = rule.get("min_version")
            if minimum and component.version and version_tuple(component.version) < version_tuple(str(minimum)):
                continue
            when = rule.get("when_licence")
            if when and not any(re.search(str(when), text) for text in component.licences):
                continue
            return Verdict(DENIED, f"excluded by name: {rule['reason']}", hard=True)
        nodes = []
        for text in component.licences:
            node = self.to_node(text)
            if node is not None:
                nodes.append(node)
        if not nodes:
            return Verdict(UNMAPPED, "no licence declared; a human must classify it (§4.3)")
        # Several declared licences are combined with AND (as ORT does); a curation or licence
        # choice resolves genuine dual licensing.
        tree: Node = nodes[0] if len(nodes) == 1 else Op("AND", tuple(nodes))
        if scope == "shipped":
            special = self.component_rule(component, tree)
            if special is not None:
                return special
        return self.node(tree, scope)

    def component_rule(self, component: Component, tree: Node) -> Optional[Verdict]:
        """Conditional rules for named kinds of component (dcm4che, the OpenJDK runtime, OS packages,
        GPL/AGPL separate containers). A denylisted licence is never lifted by such a rule."""
        base = self.node(tree, "shipped")
        if base.hard:
            return base
        leaves = [str(leaf) for leaf in iter_leaves(tree)]
        families = [leaf.licence for leaf in iter_leaves(tree)]
        for rule in self.policy.conditional_components():
            if not matches(rule, component):
                continue
            choose, licence, family = rule.get("choose"), rule.get("licence"), rule.get("licence_family")
            if choose and choose not in leaves:
                continue
            if licence and licence not in leaves:
                continue
            if family and not any(re.search(str(family), name) for name in families):
                continue
            detail = f"uses the {choose} option" if choose else str(tree)
            return Verdict(CONDITIONAL, f"{rule['id']}: {detail}", rule["condition"])
        return None


def iter_leaves(node: Node) -> Iterable[Leaf]:
    if isinstance(node, Leaf):
        yield node
    else:
        for operand in node.operands:
            yield from iter_leaves(operand)


# --------------------------------------------------------------------------- inputs


def _cyclonedx_licences(entry: dict[str, Any]) -> list[str]:
    out = []
    for item in entry.get("licenses") or []:
        if "expression" in item:
            out.append(str(item["expression"]))
        elif isinstance(item.get("license"), dict):
            lic = item["license"]
            if lic.get("id"):
                out.append(str(lic["id"]))
            elif lic.get("name"):
                out.append(str(lic["name"]))
    return out


def read_cyclonedx(path: Path, scope_override: Optional[str] = None) -> list[Component]:
    with open(path, encoding="utf-8") as handle:
        bom = json.load(handle)
    if bom.get("bomFormat") != "CycloneDX":
        raise ValueError(f"{path} is not a CycloneDX JSON document (bomFormat is {bom.get('bomFormat')!r})")
    found: list[Component] = []

    def walk(entries: list[dict[str, Any]]) -> None:
        for entry in entries or []:
            group = entry.get("group")
            name = f"{group}:{entry.get('name')}" if group else str(entry.get("name", "?"))
            scope = scope_override or ("build-only" if entry.get("scope") == "excluded" else None)
            found.append(
                Component(
                    name=name,
                    version=str(entry.get("version", "")),
                    purl=str(entry.get("purl", "")),
                    type=str(entry.get("type", "")),
                    scope=scope,
                    licences=_cyclonedx_licences(entry),
                    source=path.name,
                )
            )
            walk(entry.get("components") or [])

    walk(bom.get("components") or [])
    return found


def read_pnpm(path: Path, scope: Optional[str] = None) -> list[Component]:
    """Output of 'pnpm licenses list --json': {licence: [{name, versions|version, ...}]}."""
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    rows: list[tuple[str, dict[str, Any]]] = []
    if isinstance(data, dict):
        for licence, packages in data.items():
            for package in packages or []:
                rows.append((str(package.get("license") or licence), package))
    elif isinstance(data, list):
        rows = [(str(p.get("license", "")), p) for p in data]
    else:
        raise ValueError(f"{path} is not 'pnpm licenses list --json' output")
    found = []
    for licence, package in rows:
        versions = package.get("versions") or ([package["version"]] if package.get("version") else [""])
        for version in versions:
            name = str(package.get("name", "?"))
            licences = [] if licence.strip().lower() in {"", "unknown", "unlicensed", "see license in license"} else [licence]
            found.append(
                Component(
                    name=name,
                    version=str(version),
                    purl=f"pkg:npm/{name.replace('@', '%40', 1) if name.startswith('@') else name}@{version}",
                    type="library",
                    scope=scope,
                    licences=licences,
                    source=path.name,
                )
            )
    return found
