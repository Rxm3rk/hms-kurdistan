"""docs/program/backlog.yaml: reading, writing, and the merge that keeps hand-edited fields on regeneration."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from hmstools.backlog.plan import FIELD_ORDER, HAND_FIELDS, PARSED_FIELDS
from hmstools.backlog.source import record_key

HEADER = """\
# Backlog of record for HMS Kurdistan (BUILD-PROMPT.md §3.1; WP-0.1).
#
# GENERATED from BUILD-PROMPT.md Appendix A (feature tables A.1 to A.17) by 'tools/hms backlog generate';
# work_packages are derived from the BUILD-PROMPT.md §21 work packages; hazards from docs/safety/hazard-log.yaml,
# the record: the IDs of the entries whose 'features' list names the feature (a part row shares its feature's).
# Only these fields are edited, by hand or by tools: status, work_packages, tests, notes. hazards is never
# edited here: change the hazard log and run 'tools/hms backlog render'. Every other field is refreshed from
# BUILD-PROMPT.md on each generate, and 'tools/hms backlog check' fails if a field differs from the plan or
# hazards differs from the hazard log.
#
# On regeneration status, tests and notes are kept; hazards is derived again; the §21 entries of work_packages
# are refreshed and entries added by hand or by tools are kept after them. If a feature disappears from
# Appendix A, the hazard log names a feature ID that Appendix A does not hold, or a row carries an unknown
# field, generate stops without writing.
#
# status: todo | spec | in-progress | built | verified (BUILD-PROMPT.md §3.1). built and verified need tests.
# stance: B build, I integrate, P partner or licence; domain_level: true is the dagger (†) in Appendix A.
# placement_marked: the Appendix A note carries [P] (keep the placement open until a human confirms, §1).
# A row with 'part' is a sub-scope of a feature ID: A.18 counts its engineer-weeks, not a feature ID.
#
# After any edit here or in the hazard log run 'tools/hms backlog render': it derives hazards here again and
# refreshes docs/program/BACKLOG.md.
"""


class BacklogFileError(ValueError):
    """backlog.yaml is missing, does not parse, or does not have the expected shape."""


class FeatureDisappeared(RuntimeError):
    """Rows in backlog.yaml have no counterpart in BUILD-PROMPT.md Appendix A any more."""

    def __init__(self, keys: list[str]) -> None:
        super().__init__(", ".join(keys))
        self.keys = keys


def key_of(record: dict[str, Any]) -> str:
    feature_id = record.get("id")
    part = record.get("part")
    if not isinstance(feature_id, str) or not feature_id:
        raise BacklogFileError(f"entry without a string 'id': {record!r}")
    if part is not None and not isinstance(part, str):
        raise BacklogFileError(f"{feature_id}: 'part' is not a string")
    return record_key(feature_id, part)


def _safe_load(text: str) -> Any:
    """yaml.safe_load, through libyaml when it is available (same objects, much faster than pure Python)."""
    import yaml  # PyYAML, pinned in tools/requirements.txt

    loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
    return yaml.load(text, Loader=loader)  # noqa: S506 - a safe loader in both cases


def load_records(path: Path) -> list[dict[str, Any]]:
    import yaml

    if not path.is_file():
        raise BacklogFileError(f"{path.name} not found")
    try:
        data = _safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise BacklogFileError(f"{path.name} does not parse as YAML: {exc}") from None
    if data is None:
        return []
    if not isinstance(data, list) or not all(isinstance(entry, dict) for entry in data):
        raise BacklogFileError(f"{path.name} is not a list of mappings")
    return data


def dump_records(records: list[dict[str, Any]]) -> str:
    """The backlog.yaml text: header, then one block per row in a fixed field order, blank line between rows.

    Written with the pure-Python SafeDumper so the bytes do not depend on whether libyaml is installed.
    """
    import yaml

    blocks = []
    for record in records:
        ordered = {name: record[name] for name in FIELD_ORDER if name in record}
        extra = [name for name in record if name not in FIELD_ORDER]
        if extra:
            raise BacklogFileError(f"{key_of(record)}: unknown fields {extra}")
        blocks.append(
            yaml.safe_dump(
                [ordered], allow_unicode=True, sort_keys=False, default_flow_style=False, width=100000
            )
        )
    text = HEADER + "\n" + "\n".join(blocks)
    if _safe_load(text) != [{n: r[n] for n in FIELD_ORDER if n in r} for r in records]:
        raise BacklogFileError("internal error: the YAML written does not read back to the same records")
    return text


@dataclass
class MergeResult:
    records: list[dict[str, Any]]
    kept: list[str] = field(default_factory=list)  # rows whose hand-edited fields came from the old file
    added: list[str] = field(default_factory=list)  # rows new in this generation
    extra_work_packages: dict[str, list[str]] = field(default_factory=dict)  # kept non-§21 entries
    refreshed: dict[str, list[str]] = field(default_factory=dict)  # parsed fields whose old value was replaced
    hazards_refreshed: dict[str, tuple[Any, list[str]]] = field(default_factory=dict)  # old and derived hazards


def merge_records(fresh: list[dict[str, Any]], existing: list[dict[str, Any]]) -> MergeResult:
    """Refresh parsed fields from ``fresh`` and keep the hand-edited fields of ``existing``; hazards always
    comes from ``fresh`` (derived from the hazard log), and a changed value is reported.

    Raises FeatureDisappeared (and changes nothing) when an existing row is absent from ``fresh``, and
    BacklogFileError when ``existing`` holds the same row twice or a row carries a field that is neither
    parsed nor hand-edited (writing would drop it silently).
    """
    old: dict[str, dict[str, Any]] = {}
    duplicates: list[str] = []
    unknown: list[str] = []
    for record in existing:
        key = key_of(record)
        if key in old:
            duplicates.append(key)
        old[key] = record
        extra = [str(name) for name in record if name not in FIELD_ORDER]
        if extra:
            unknown.append(f"{key} ({', '.join(extra)})")
    if duplicates:
        raise BacklogFileError("rows appear more than once: " + ", ".join(sorted(set(duplicates))))
    if unknown:
        raise BacklogFileError(
            "rows carry fields that are neither parsed nor hand-edited, and generate would drop them: "
            + "; ".join(unknown)
            + ". Move their content into 'notes' or remove them"
        )
    fresh_keys = {key_of(r) for r in fresh}
    gone = [key for key in old if key not in fresh_keys]
    if gone:
        raise FeatureDisappeared(gone)

    result = MergeResult(records=[])
    for record in fresh:
        key = key_of(record)
        merged = dict(record)
        previous = old.get(key)
        if previous is None:
            result.added.append(key)
        else:
            result.kept.append(key)
            changed = [name for name in PARSED_FIELDS if previous.get(name) != record.get(name)]
            if changed:
                result.refreshed[key] = changed
            for name in HAND_FIELDS:
                if name in previous:
                    merged[name] = previous[name]
            if previous.get("hazards") != record["hazards"]:
                result.hazards_refreshed[key] = (previous.get("hazards"), list(record["hazards"]))
            derived = list(record["work_packages"])
            prior = previous.get("work_packages") or []
            if not isinstance(prior, list):
                raise BacklogFileError(f"{key}: work_packages is not a list")
            extras = [entry for entry in prior if entry not in derived]
            if extras:
                result.extra_work_packages[key] = extras
            merged["work_packages"] = derived + extras
        result.records.append(merged)
    return result
