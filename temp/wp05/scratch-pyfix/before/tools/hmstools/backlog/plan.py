"""The plan as the backlog sees it: Appendix A features, A.18 totals and §21 references, joined into records
(with the hazards that docs/safety/hazard-log.yaml links to each feature)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from hmstools.backlog.hazards import HazardLinks
from hmstools.backlog.source import A18Totals, Feature, Section, parse_a18, parse_features
from hmstools.backlog.workpackages import Reference, parse_section_21

STATUSES = ("todo", "spec", "in-progress", "built", "verified")  # BUILD-PROMPT.md §3.1
DEFAULT_STATUS = "todo"
# Fields refreshed from the plan on every generate and compared by check. "part" exists only on part rows.
PARSED_FIELDS = (
    "id",
    "part",
    "group",
    "section",
    "title",
    "size",
    "phase",
    "stance",
    "domain_level",
    "scope",
    "kurdistan_note",
    "placement_marked",
)
# Kept on regeneration. work_packages is derived from §21 (entries added by hand or by tools are kept after the
# derived ones); hazards is derived from docs/safety/hazard-log.yaml and never edited in backlog.yaml.
HAND_FIELDS = ("status", "tests", "notes")
FIELD_ORDER = (*PARSED_FIELDS, "status", "work_packages", "tests", "hazards", "notes")


@dataclass(frozen=True)
class Plan:
    features: tuple[Feature, ...]
    sections: tuple[Section, ...]
    a18: A18Totals
    references: tuple[Reference, ...]


@dataclass
class Mapping:
    """§21 references resolved to backlog rows."""

    derived: dict[str, list[str]] = field(default_factory=dict)  # row key -> WP labels, in §21 order
    wildcards: list[Reference] = field(default_factory=list)  # e.g. `RCM-*`: names no single feature
    unknown: list[Reference] = field(default_factory=list)  # looks like a feature ID, absent from Appendix A


def parse_plan(text: str) -> Plan:
    text = text.replace("\r\n", "\n")
    features, sections = parse_features(text)
    return Plan(tuple(features), tuple(sections), parse_a18(text), tuple(parse_section_21(text)))


def load_plan(path: Path) -> Plan:
    return parse_plan(path.read_text(encoding="utf-8"))


def map_references(plan: Plan) -> Mapping:
    """Attach each §21 reference to its row. A qualifier naming a part ('the scheme part') goes to that part row."""
    mapping = Mapping(derived={f.key: [] for f in plan.features})
    ids = {f.id for f in plan.features if f.part is None}
    parts: dict[str, list[Feature]] = {}
    for feature in plan.features:
        if feature.part is not None:
            parts.setdefault(feature.id, []).append(feature)
    for ref in plan.references:
        if ref.is_wildcard:
            mapping.wildcards.append(ref)
            continue
        if ref.target not in ids:
            mapping.unknown.append(ref)
            continue
        key = ref.target
        for part in parts.get(ref.target, []):
            if ref.qualifier and re.search(rf"\b{re.escape(part.part or '')} part\b", ref.qualifier, re.IGNORECASE):
                key = part.key
        labels = mapping.derived[key]
        if ref.label not in labels:
            labels.append(ref.label)
    return mapping


def feature_record(feature: Feature, work_packages: list[str], hazards: list[str] | None = None) -> dict[str, Any]:
    record: dict[str, Any] = {"id": feature.id}
    if feature.part is not None:
        record["part"] = feature.part
    record.update(
        {
            "group": feature.group,
            "section": feature.section,
            "title": feature.title,
            "size": feature.size,
            "phase": feature.phase,
            "stance": feature.stance,
            "domain_level": feature.domain_level,
            "scope": feature.scope,
            "kurdistan_note": feature.kurdistan_note,
            "placement_marked": feature.placement_marked,
            "status": DEFAULT_STATUS,
            "work_packages": list(work_packages),
            "tests": [],
            "hazards": list(hazards or []),
            "notes": [],
        }
    )
    return record


def build_records(
    plan: Plan, mapping: Mapping | None = None, links: HazardLinks | None = None
) -> list[dict[str, Any]]:
    """Fresh records in source order, with default hand-edited fields and, given the hazard log's links, the
    derived hazards (a part row shares its feature's)."""
    mapping = mapping or map_references(plan)
    return [
        feature_record(f, mapping.derived[f.key], links.hazards_of(f.id) if links else []) for f in plan.features
    ]
