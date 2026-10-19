"""Apply tools/licence/policy.yaml to components (BUILD-PROMPT.md §4.3)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional

from .spdx import Leaf, Node, Op, SpdxError, canonical, looks_like_expression, parse

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
    # Conditional verdicts only: the policy rule applied (a conditional licence id or a component rule id) and
    # the SPDX expression it applies to, which are what a licence-register entry for the component must record.
    rule: Optional[str] = None
    licence: Optional[str] = None

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


# --------------------------------------------------------------------------- the licence register

# The entry fields that tools/licence/register.yaml documents in its header. Every field but 'notes' is required.
REGISTER_FIELDS = ("component", "licence", "rule", "unmodified", "source_offer", "added_in", "notes")
REGISTER_REQUIRED = REGISTER_FIELDS[:-1]
WORK_PACKAGE_ID = re.compile(r"^WP-\d+\.\d+[a-z]?$")
# §4.3: "GPL and AGPL only as unmodified, separate containers with a source offer", so an entry under this rule
# names where the offer is published.
SOURCE_OFFER_RULES = frozenset({"gpl-separate-container"})
# Package URLs and a name that no component has: a register pattern that matches one of them does not name
# the component it records (it would match any package of that type, or any package at all).
UNRELATED_PACKAGES = (
    "pkg:npm/zz-hms-unrelated-probe@0.0.0",
    "pkg:maven/zz.hms.unrelated/zz-hms-unrelated-probe@0.0.0",
    "pkg:deb/zz-hms-unrelated/zz-hms-unrelated-probe@0.0.0",
    "pkg:oci/zz-hms-unrelated-probe@sha256%3A0",
    "zz-hms-unrelated-probe",
)


def _register_rules(policy: Policy) -> set[str]:
    return set(policy.conditional_licences()) | {str(r.get("id")) for r in policy.conditional_components()}


def same_expression(first: str, second: str) -> bool:
    """True if two licence expressions are the same SPDX expression, whatever the order of their AND and OR
    operands. Text that does not parse is compared as written."""

    def key(text: str) -> str:
        try:
            return canonical(parse(text))
        except SpdxError:
            return text.strip()

    return bool(first.strip()) and key(first) == key(second)


def register_entry_problems(entry: Any, rules: set[str]) -> list[str]:
    """The problems of one register entry against the schema in the register's header (none if well formed)."""
    if not isinstance(entry, dict):
        return ["not a mapping"]
    problems = []
    unknown = sorted(str(k) for k in set(entry) - set(REGISTER_FIELDS))
    if unknown:
        problems.append(f"unknown fields {unknown} (the fields are {', '.join(REGISTER_FIELDS)})")
    missing = [name for name in REGISTER_REQUIRED if name not in entry]
    if missing:
        problems.append(f"missing fields {missing}")
    for name in ("component", "licence", "rule", "added_in"):
        if name in entry and (not isinstance(entry[name], str) or not entry[name].strip()):
            problems.append(f"'{name}' must be a non-empty string")
    if isinstance(entry.get("component"), str) and entry["component"].strip():
        try:
            pattern = re.compile(entry["component"])
        except re.error as exc:
            problems.append(f"'component' is not a regular expression ({exc})")
        else:
            # A pattern such as '.*', '.' or '^pkg:' matches every package, so it would stand as the record of
            # components nobody looked at; an entry names the component it records.
            if pattern.search(""):
                problems.append(
                    f"'component' {entry['component']!r} matches the empty string, so it can match any component; "
                    "name the component (for example ^pkg:maven/ca\\.uhn\\.hapi/)"
                )
            else:
                unrelated = next((probe for probe in UNRELATED_PACKAGES if pattern.search(probe)), None)
                if unrelated is not None:
                    problems.append(
                        f"'component' {entry['component']!r} also matches {unrelated!r}, a package it does not name, so "
                        "it can match components nobody looked at; name the component (for example ^pkg:maven/ca\\.uhn\\.hapi/)"
                    )
    if isinstance(entry.get("licence"), str) and entry["licence"].strip():
        try:
            parse(entry["licence"])
        except SpdxError as exc:
            problems.append(f"'licence' {entry['licence']!r} is not an SPDX expression ({exc})")
    if isinstance(entry.get("rule"), str) and entry["rule"].strip() and entry["rule"] not in rules:
        known = ", ".join(sorted(rules))
        problems.append(f"'rule' {entry['rule']!r} is not a conditional rule of the policy ({known})")
    if "unmodified" in entry and not isinstance(entry["unmodified"], bool):
        problems.append("'unmodified' must be true or false")
    offer = entry.get("source_offer")
    if offer is not None and (not isinstance(offer, str) or not offer.strip()):
        problems.append("'source_offer' must be a non-empty string or null")
    if isinstance(entry.get("rule"), str) and entry["rule"] in SOURCE_OFFER_RULES and not (isinstance(offer, str) and offer.strip()):
        problems.append(f"rule {entry['rule']!r} needs 'source_offer', where the source offer is published (§4.3)")
    added_in = entry.get("added_in")
    if isinstance(added_in, str) and added_in.strip() and not WORK_PACKAGE_ID.match(added_in):
        problems.append(f"'added_in' {added_in!r} is not a work package ID such as WP-1.1b")
    if entry.get("notes") is not None and not isinstance(entry.get("notes"), str):
        problems.append("'notes' must be text or null")
    return problems


def register_problems(data: Any, policy: Policy) -> list[str]:
    """Check the licence register against the schema its header documents; one message per problem, none if
    it is well formed. An entry records facts; it is not an approval, so it has no field that names a person."""
    if data is None:
        return []
    if not isinstance(data, dict):
        return ["the register is not a mapping with 'schema_version' and 'entries'"]
    problems = []
    if data.get("schema_version") != 1:
        problems.append(f"schema_version is {data.get('schema_version')!r}, expected 1")
    unknown_top = sorted(str(k) for k in set(data) - {"schema_version", "entries"})
    if unknown_top:
        problems.append(f"unknown top-level keys {unknown_top}")
    entries = data.get("entries")
    if entries is None:
        return problems
    if not isinstance(entries, list):
        return problems + ["'entries' is not a list"]
    rules = _register_rules(policy)
    for index, entry in enumerate(entries, 1):
        label = f"entry {index} ({entry.get('component')!r})" if isinstance(entry, dict) else f"entry {index}"
        problems += [f"{label}: {problem}" for problem in register_entry_problems(entry, rules)]
    return problems


def load_register(path: Path, policy: Policy) -> tuple[list[dict[str, Any]], list[str]]:
    """The well-formed entries of the licence register, and the problems found in it. A missing file is an
    empty register; a malformed entry is reported and not used. Raises ValueError if the file is not YAML."""
    import yaml  # PyYAML, pinned in tools/requirements.txt

    if not path.is_file():
        return [], []
    try:
        with open(path, encoding="utf-8") as handle:
            data = yaml.safe_load(handle)
    except yaml.YAMLError as exc:
        raise ValueError(f"{path.name} does not parse as YAML: {exc}") from None
    problems = register_problems(data, policy)
    entries = data.get("entries") if isinstance(data, dict) else None
    if not isinstance(entries, list):
        return [], problems
    rules = _register_rules(policy)
    return [entry for entry in entries if not register_entry_problems(entry, rules)], problems


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
            return Verdict(CONDITIONAL, f"{text} is conditional", self._conditional[text], rule=text, licence=text)
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
    def register_entries(self, component: Component) -> list[dict[str, Any]]:
        """The licence-register entries whose 'component' pattern matches the package URL or the name."""
        found = []
        for entry in self.register:
            pattern = str(entry.get("component", "") or "")
            if pattern and (re.search(pattern, component.purl or "") or re.search(pattern, component.name)):
                found.append(entry)
        return found

    @staticmethod
    def records(entry: dict[str, Any], verdict: Verdict) -> bool:
        """True if the entry records the rule the policy applied in this verdict and the licence that rule
        applies to (as SPDX expressions, so operand order does not matter). An entry under another rule or
        licence is not the record of this component, however broad its pattern."""
        return (
            verdict.rule is not None
            and entry.get("rule") == verdict.rule
            and same_expression(str(entry.get("licence") or ""), verdict.licence or "")
        )

    def recording_entries(self, component: Component, verdict: Optional[Verdict] = None) -> list[dict[str, Any]]:
        """The register entries that record this conditional component: their pattern matches it and they
        record the rule and the licence the policy applies to it."""
        verdict = verdict or self.evaluate(component)
        return [entry for entry in self.register_entries(component) if self.records(entry, verdict)]

    def registered(self, component: Component, verdict: Optional[Verdict] = None) -> bool:
        """True if the register records the component, under the rule and licence the policy applies to it, as
        used unmodified (§4.3: "unmodified and recorded in the licence register"). An entry under another rule
        or licence does not count, and one recording entry without 'unmodified: true' makes it False."""
        recording = self.recording_entries(component, verdict)
        return bool(recording) and all(entry.get("unmodified") is True for entry in recording)

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
            # The licence the rule applies to: the chosen option, the rule's licence, or (for OS packages and
            # GPL/AGPL containers) the component's declared expression.
            used = str(choose or licence or canonical(tree))
            return Verdict(CONDITIONAL, f"{rule['id']}: {detail}", rule["condition"], rule=str(rule["id"]), licence=used)
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
