"""The generate, render and spot-check commands (check lives in check.py)."""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from typing import Any

from hmstools.backlog.hazards import HazardLinks, HazardLogError, load_hazard_links
from hmstools.backlog.paths import BacklogPaths, EnvironmentProblem
from hmstools.backlog.plan import Plan, build_records, load_plan, map_references
from hmstools.backlog.records import (
    BacklogFileError,
    FeatureDisappeared,
    dump_records,
    key_of,
    load_records,
    merge_records,
)
from hmstools.backlog.render import render_markdown
from hmstools.backlog.source import FEATURE_HEADER, size_reading, split_row
from hmstools.common import write_text_lf


class CommandFailed(RuntimeError):
    """The command could not do its job (exit code 1); the message says why."""


@dataclass
class GenerateReport:
    rows: int = 0
    features: int = 0
    kept: int = 0
    added: list[str] = field(default_factory=list)
    extra_work_packages: dict[str, list[str]] = field(default_factory=dict)
    refreshed: dict[str, list[str]] = field(default_factory=dict)  # parsed fields overwritten from the plan
    hazards_refreshed: dict[str, tuple[Any, list[str]]] = field(default_factory=dict)  # old -> derived hazards
    wildcards: list[str] = field(default_factory=list)


@dataclass
class RenderReport:
    rows: int = 0
    hazards_refreshed: dict[str, tuple[Any, list[str]]] = field(default_factory=dict)  # rewritten in backlog.yaml


def _plan(paths: BacklogPaths) -> Plan:
    if not paths.source.is_file():
        raise EnvironmentProblem(f"{paths.show(paths.source)} not found")
    try:
        return load_plan(paths.source)
    except ValueError as exc:  # SourceError, WorkPackageError
        raise CommandFailed(f"{paths.show(paths.source)} does not parse: {exc}") from None


def _hazard_links(paths: BacklogPaths, plan: Plan) -> HazardLinks:
    """The hazard log's feature links; fails if the log is unreadable or names a feature Appendix A lacks."""
    shown = paths.show(paths.hazard_log)
    if not paths.hazard_log.is_file():
        raise EnvironmentProblem(f"{shown} not found; the backlog's hazards are derived from it")
    try:
        links = load_hazard_links(paths.hazard_log)
    except HazardLogError as exc:
        raise CommandFailed(f"{shown}: {exc}") from None
    unknown = links.unknown_features({f.id for f in plan.features if f.part is None})
    if unknown:
        raise CommandFailed(
            f"{shown} names feature IDs that are not in BUILD-PROMPT.md Appendix A: "
            + "; ".join(f"{feature} ({', '.join(ids)})" for feature, ids in unknown.items())
            + ". Nothing was written."
        )
    return links


def refresh_hazards(records: list[dict[str, Any]], links: HazardLinks) -> dict[str, tuple[Any, list[str]]]:
    """Set each row's hazards from the hazard log; returns the rows whose value changed (old, new)."""
    changed = {}
    for record in records:
        derived = links.hazards_of(str(record.get("id")))
        if record.get("hazards") != derived:
            changed[key_of(record)] = (record.get("hazards"), derived)
            record["hazards"] = derived
    return changed


def generate(paths: BacklogPaths) -> GenerateReport:
    """Write backlog.yaml from Appendix A and §21, with the hazards the hazard log links to each feature,
    keeping hand-edited fields of rows already in the file."""
    plan = _plan(paths)
    mapping = map_references(plan)
    links = _hazard_links(paths, plan)
    fresh = build_records(plan, mapping, links)
    existing: list[dict[str, Any]] = []
    if paths.backlog.exists():
        try:
            existing = load_records(paths.backlog)
        except BacklogFileError as exc:
            raise CommandFailed(f"{paths.show(paths.backlog)}: {exc}; not overwritten") from None
    try:
        merged = merge_records(fresh, existing)
    except FeatureDisappeared as exc:
        raise CommandFailed(
            f"{len(exc.keys)} row(s) in {paths.show(paths.backlog)} are no longer in BUILD-PROMPT.md Appendix A: "
            f"{', '.join(exc.keys)}. Nothing was written. A feature never disappears silently: confirm the change "
            "with the lead, remove the row(s) from backlog.yaml by hand, then run generate again."
        ) from None
    except BacklogFileError as exc:
        raise CommandFailed(f"{paths.show(paths.backlog)}: {exc}; not overwritten") from None
    if mapping.unknown:
        raise CommandFailed(
            "§21 names feature IDs that are not in Appendix A: "
            + ", ".join(f"{r.target} ({r.wp}, line {r.line})" for r in mapping.unknown)
            + ". Nothing was written."
        )
    write_text_lf(paths.backlog, dump_records(merged.records))
    return GenerateReport(
        rows=len(merged.records),
        features=len({r["id"] for r in merged.records if r.get("part") is None}),
        kept=len(merged.kept),
        added=merged.added if existing else [],
        extra_work_packages=merged.extra_work_packages,
        refreshed=merged.refreshed,
        hazards_refreshed=merged.hazards_refreshed if existing else {},
        wildcards=[f"{r.wp}: {r.target} {r.qualifier or ''}".strip() for r in mapping.wildcards],
    )


def render(paths: BacklogPaths) -> RenderReport:
    """Derive every row's hazards from the hazard log again (rewriting backlog.yaml if one changed), then write
    BACKLOG.md from backlog.yaml. Nothing is written if either step fails."""
    plan = _plan(paths)
    links = _hazard_links(paths, plan)
    try:
        records = load_records(paths.backlog)
        changed = refresh_hazards(records, links)
        yaml_text = dump_records(records) if changed else None
        text = render_markdown(records, plan, map_references(plan))
    except BacklogFileError as exc:
        raise CommandFailed(f"{paths.show(paths.backlog)}: {exc}") from None
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        raise CommandFailed(f"{paths.show(paths.backlog)} cannot be rendered: {exc}") from None
    if yaml_text is not None:
        write_text_lf(paths.backlog, yaml_text)
    write_text_lf(paths.markdown, text)
    return RenderReport(rows=len(records), hazards_refreshed=changed)


def _value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def spot_check(paths: BacklogPaths, seed: int, count: int) -> str:
    """Seeded random Appendix A rows, each raw cell beside the backlog.yaml fields parsed from it."""
    plan = _plan(paths)
    if count < 1 or count > len(plan.features):
        raise EnvironmentProblem(f"--count must be between 1 and {len(plan.features)}")
    records: dict[str, dict[str, Any]] = {}
    source_note = f"records read from {paths.show(paths.backlog)}"
    try:
        for record in load_records(paths.backlog):
            records.setdefault(key_of(record), record)
    except BacklogFileError as exc:
        source_note = f"{paths.show(paths.backlog)} unavailable ({exc}); records parsed in memory instead"
        records = {key_of(r): r for r in build_records(plan)}
    sample = random.Random(seed).sample(list(plan.features), count)
    width = max(len(h) for h in FEATURE_HEADER)
    out = [
        f"Spot check: seed {seed}, {count} of {len(plan.features)} Appendix A rows (Python random.Random(seed).sample "
        f"over the rows in source order); {source_note}.",
        "",
    ]
    for n, feature in enumerate(sample, 1):
        record = records.get(feature.key)
        out.append(f"[{n}/{count}] {feature.key}  BUILD-PROMPT.md line {feature.row.line}, {feature.section} {feature.group}")
        out.append(f"  raw row: {feature.row.text}")
        if record is None:
            out.append("  parsed : NOT IN backlog.yaml")
            out.append("")
            continue
        cells = split_row(feature.row.text)
        parsed = {
            "ID": ["id"] + (["part"] if "part" in record else []),
            "Feature": ["title"],
            "Size": ["size"],
            "Phase": ["phase"],
            "Stance": ["stance", "domain_level"],
            "Scope · Kurdistan note": ["scope", "kurdistan_note", "placement_marked"],
        }
        for header, cell in zip(FEATURE_HEADER, cells):
            out.append(f"  {header:<{width}} | {cell}")
            for name in parsed[header]:
                out.append(f"  {'':<{width}} |   -> {name}: {_value(record.get(name))}")
            if header == "Size":
                try:
                    reading = size_reading(str(record.get("size")))
                    out.append(f"  {'':<{width}} |   (counts {reading.ew} engineer-weeks: {reading.reading})")
                except ValueError as exc:
                    out.append(f"  {'':<{width}} |   (size unreadable: {exc})")
        out.append(f"  {'§21':<{width}} |   -> work_packages: {_value(record.get('work_packages'))}")
        out.append(f"  {'hazard log':<{width}} |   -> hazards: {_value(record.get('hazards'))}")
        hand = "; ".join(f"{name}: {_value(record.get(name))}" for name in ("status", "tests", "notes"))
        out.append(f"  {'hand-edited':<{width}} |   -> {hand}")
        out.append("")
    out.append("Sampled rows: " + ", ".join(f.key for f in sample))
    return "\n".join(out) + "\n"
