"""``tools/hms backlog check``: backlog.yaml and BACKLOG.md against BUILD-PROMPT.md, and backlog.yaml's hazards
against docs/safety/hazard-log.yaml (CheckResult contract)."""

from __future__ import annotations

from collections import Counter
from typing import Any

from hmstools.backlog.hazards import HazardLogError, load_hazard_links
from hmstools.backlog.paths import BacklogPaths, EnvironmentProblem
from hmstools.backlog.plan import (
    FIELD_ORDER,
    PARSED_FIELDS,
    STATUSES,
    Mapping,
    Plan,
    build_records,
    load_plan,
    map_references,
)
from hmstools.backlog.records import BacklogFileError, key_of, load_records
from hmstools.backlog.render import render_markdown
from hmstools.backlog.source import PHASES, SourceError
from hmstools.backlog.totals import (
    a18_internal_problems,
    compare_a18,
    features_only,
    phase_counts,
    status_counts,
    without_work_package,
)
from hmstools.backlog.workpackages import WorkPackageError
from hmstools.common import CheckResult

CHECK_NAME = "backlog"
# BUILD-PROMPT.md §21 WP-0.1 exit evidence ("the backlog renders all 234 feature IDs") and A.18 "All".
EXPECTED_FEATURE_IDS = 234
LIST_FIELDS = ("work_packages", "tests", "hazards", "notes")


def _load(paths: BacklogPaths) -> Plan:
    if not paths.source.is_file():
        raise EnvironmentProblem(f"{paths.show(paths.source)} not found")
    try:
        import yaml  # noqa: F401  (PyYAML, pinned in tools/requirements.txt)
    except ImportError as exc:
        raise EnvironmentProblem(f"PyYAML is not installed in this interpreter: {exc}") from None
    return load_plan(paths.source)


def _shape_errors(record: dict[str, Any], key: str) -> list[str]:
    errors = []
    for name in FIELD_ORDER:
        if name != "part" and name not in record:
            errors.append(f"{key}: field '{name}' is missing")
    unknown = [name for name in record if name not in FIELD_ORDER]
    if unknown:
        errors.append(f"{key}: unknown fields {unknown}")
    status = record.get("status")
    if "status" in record and status not in STATUSES:
        errors.append(f"{key}: status {status!r} is not one of {', '.join(STATUSES)}")
    for name in LIST_FIELDS:
        value = record.get(name)
        if name in record and (not isinstance(value, list) or not all(isinstance(v, str) and v for v in value)):
            errors.append(f"{key}: '{name}' must be a list of non-empty strings")
    if status in ("built", "verified") and not record.get("tests"):
        errors.append(f"{key}: status '{status}' needs at least one test in 'tests' (§3.1, §3.5)")
    return errors


def run_check(paths: BacklogPaths, expected_ids: int = EXPECTED_FEATURE_IDS) -> CheckResult:
    result = CheckResult(CHECK_NAME)
    try:
        plan = _load(paths)
    except (SourceError, WorkPackageError) as exc:
        result.errors.append(f"{paths.show(paths.source)} does not parse: {exc}")
        return result
    mapping = map_references(plan)
    _check_plan(plan, mapping, expected_ids, result)

    try:
        records = load_records(paths.backlog)
    except BacklogFileError as exc:
        result.errors.append(f"{paths.show(paths.backlog)}: {exc}")
        return result

    keys: list[str] = []
    usable: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        try:
            key = key_of(record)
        except BacklogFileError as exc:
            result.errors.append(f"{paths.show(paths.backlog)} entry {index + 1}: {exc}")
            continue
        keys.append(key)
        usable.append(record)
        result.errors.extend(_shape_errors(record, key))

    _check_identity(plan, mapping, usable, keys, expected_ids, result)
    _check_hazards(paths, plan, usable, keys, result)
    _check_markdown(paths, plan, mapping, usable, result)
    _check_a18(plan, usable, result)
    _counts(usable, mapping, result)
    return result


def _check_plan(plan: Plan, mapping: Mapping, expected_ids: int, result: CheckResult) -> None:
    source_ids = [f.id for f in plan.features if f.part is None]
    repeated = sorted(k for k, n in Counter(f.key for f in plan.features).items() if n > 1)
    for key in repeated:
        result.errors.append(f"Appendix A lists {key} more than once")
    if len(set(source_ids)) != expected_ids:
        result.errors.append(f"Appendix A has {len(set(source_ids))} unique feature IDs; expected {expected_ids}")
    if plan.a18.all[0] != expected_ids:
        result.errors.append(f"A.18 'All' reads {plan.a18.all[0]} feature IDs; expected {expected_ids}")
    for feature in plan.features:
        if feature.part is not None and feature.id not in source_ids:
            result.errors.append(f"Appendix A line {feature.row.line}: part row of unknown feature {feature.id}")
    for ref in mapping.unknown:
        result.errors.append(f"§21 {ref.wp} (line {ref.line}) names {ref.target}, which is not in Appendix A")
    for ref in mapping.wildcards:
        result.warnings.append(
            f"§21 {ref.wp} (line {ref.line}) names the wildcard {ref.target} ({ref.qualifier or 'no qualifier'}); "
            "it is not attached to any feature"
        )


def _check_identity(
    plan: Plan,
    mapping: Mapping,
    records: list[dict[str, Any]],
    keys: list[str],
    expected_ids: int,
    result: CheckResult,
) -> None:
    for key, n in sorted(Counter(keys).items()):
        if n > 1:
            result.errors.append(f"backlog.yaml lists {key} {n} times")
    unique_ids = {r["id"] for r in records if r.get("part") is None}
    if len(unique_ids) != expected_ids:
        result.errors.append(f"backlog.yaml has {len(unique_ids)} unique feature IDs; expected exactly {expected_ids}")

    fresh = {key_of(r): r for r in build_records(plan, mapping)}
    lines = {f.key: f.row.line for f in plan.features}
    by_key = {}
    for key, record in zip(keys, records):
        by_key.setdefault(key, record)
    for key in fresh:
        if key not in by_key:
            result.errors.append(f"{key} (BUILD-PROMPT.md line {lines[key]}) is missing from backlog.yaml")
    for key, record in by_key.items():
        expected = fresh.get(key)
        if expected is None:
            result.errors.append(f"{key} is in backlog.yaml but not in BUILD-PROMPT.md Appendix A")
            continue
        for name in PARSED_FIELDS:
            if record.get(name) != expected.get(name):
                result.errors.append(
                    f"{key}: '{name}' is {record.get(name)!r} in backlog.yaml but {expected.get(name)!r} in "
                    f"Appendix A (line {lines[key]}); run 'tools/hms backlog generate'"
                )
        listed = record.get("work_packages") if isinstance(record.get("work_packages"), list) else []
        for label in expected["work_packages"]:
            if label not in listed:
                result.errors.append(f"{key}: work package '{label}' from §21 is missing from work_packages")
        for label in listed:
            if label not in expected["work_packages"]:
                result.warnings.append(f"{key}: work package '{label}' is not derived from §21 (hand or tool entry)")


def _check_hazards(
    paths: BacklogPaths, plan: Plan, records: list[dict[str, Any]], keys: list[str], result: CheckResult
) -> None:
    """backlog.yaml's hazards must be exactly what the hazard log, the record, links to each feature (BUILD-PROMPT.md
    §3.1: every feature "with status, work package, tests and hazards")."""
    shown = paths.show(paths.hazard_log)
    if not paths.hazard_log.is_file():
        result.errors.append(f"{shown} not found; the backlog's hazards cannot be checked against it")
        return
    try:
        links = load_hazard_links(paths.hazard_log)
    except HazardLogError as exc:
        result.errors.append(f"{shown}: {exc}")
        return
    for feature, ids in links.unknown_features({f.id for f in plan.features if f.part is None}).items():
        result.errors.append(f"{shown}: {feature}, named by {', '.join(ids)}, is not in BUILD-PROMPT.md Appendix A")
    for key, record in zip(keys, records):
        expected = links.hazards_of(str(record.get("id")))
        if record.get("hazards") != expected:
            result.errors.append(
                f"{key}: 'hazards' is {record.get('hazards')!r} in backlog.yaml but {expected!r} in {shown} (the "
                f"entries whose 'features' list names {record.get('id')}); run 'tools/hms backlog render'"
            )
    result.counts["hazard_log_entries"] = links.entries
    result.counts["features_with_hazards"] = len({r.get("id") for r in records if links.hazards_of(str(r.get("id")))})
    result.counts["hazard_links"] = links.links


def _check_markdown(
    paths: BacklogPaths, plan: Plan, mapping: Mapping, records: list[dict[str, Any]], result: CheckResult
) -> None:
    shown = paths.show(paths.markdown)
    try:
        expected = render_markdown(records, plan, mapping).encode("utf-8")
    except (ValueError, KeyError, TypeError, AttributeError) as exc:  # SourceError, BacklogFileError
        result.errors.append(f"{shown} cannot be rendered from backlog.yaml: {exc}")
        return
    if not paths.markdown.is_file():
        result.errors.append(f"{shown} not found; run 'tools/hms backlog render'")
        return
    actual = paths.markdown.read_bytes()
    if actual != expected:
        got, want = actual.decode("utf-8", "replace").split("\n"), expected.decode("utf-8").split("\n")
        line = next((i + 1 for i, (a, b) in enumerate(zip(got, want)) if a != b), min(len(got), len(want)) + 1)
        result.errors.append(
            f"{shown} is not up to date with backlog.yaml (first difference at line {line}); "
            "run 'tools/hms backlog render'"
        )


def _check_a18(plan: Plan, records: list[dict[str, Any]], result: CheckResult) -> None:
    try:
        rows = compare_a18(records, plan.a18)
    except SourceError as exc:
        result.errors.append(f"A.18 comparison impossible: {exc}")
        return
    for row in rows:
        if row.count_diff:
            result.errors.append(
                f"A.18 {row.label}: {row.a18_count} feature IDs in A.18, {row.count} in backlog.yaml "
                f"(difference {row.count_diff:+d})"
            )
        if row.ew_diff:
            message = (
                f"A.18 {row.label}: {row.a18_ew} engineer-weeks in A.18, {row.ew} in backlog.yaml "
                f"(difference {row.ew_diff:+d})"
            )
            if row.explanation:
                result.warnings.append(f"{message}; explained by {row.explanation}")
            else:
                result.errors.append(f"{message}; not explained by A.18's note")
    result.warnings.extend(a18_internal_problems(plan.a18))


def _counts(records: list[dict[str, Any]], mapping: Mapping, result: CheckResult) -> None:
    features = features_only(records)
    counts = result.counts
    counts["rows"] = len(records)
    counts["features"] = len({r.get("id") for r in features})
    counts["part_rows"] = len(records) - len(features)
    by_phase = phase_counts(records)
    for phase in PHASES:
        counts[f"phase_{phase}"] = by_phase.get(phase, 0)
    by_status = status_counts(records)
    for status in STATUSES:
        counts[f"status_{status}"] = by_status.get(status, 0)
    no_wp = without_work_package(features)
    counts["features_without_work_package"] = len(no_wp)
    counts["features_without_work_package_not_dropped"] = sum(1 for r in no_wp if r.get("phase") != "DROPPED-K")
    counts["wp_references_not_mapped"] = len(mapping.wildcards) + len(mapping.unknown)
