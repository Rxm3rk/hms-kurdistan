"""`tools/hms safety check`: validate the hazard log and enforce the approval-field gate.

Rules (docs/safety/README.md lists them for reviewers):
 1. hazard-log.yaml parses (no duplicate keys) and validates against hazard-log.schema.json;
 2. ids are unique and well formed: seeded hazards, hazards, controls (CTRL-<hazard number>-k);
 3. H1 to H15 are all defined, with the §2.4 wording;
 4. SI-01 to SI-21 are each covered by at least one hazard entry, and each has exactly one entry
    that quotes it verbatim (invariant_text equal to the §2.1 table), with invariant_clauses that
    rebuild the text and every clause covered by a control, plus a control for the §2.1 preamble;
    enforced_in, the seeded-hazard mapping and the §18.4 SAC mapping match the plan of record;
 5. each SI-21 sensitivity label has its own hazard entry;
 6. every seeded-hazard reference exists;
 7. control states are consistent (implemented needs implemented_in; verified needs implemented_in
    and verified_by); a hazard status needs every control at least at that state; accepted needs a
    proposed residual risk, residual_risk.accepted_by and a sign-off record;
 8. initial and proposed residual risk levels agree with the risk matrix, and the vocabulary in the
    file equals the schema enumerations;
 9. every feature ID exists in docs/program/backlog.yaml, or in BUILD-PROMPT.md Appendix A when the
    backlog file does not exist yet (the source used is reported);
10. owners are <module>-squad and modules are §5.2 module names;
11. the approval-field gate (§3.5): every filled approval, sign-off, triage or acceptance field in the
    hazard log, in docs/safety/**/*.yaml and in docs/specs/state-machines/*.yaml needs a valid,
    authenticated sign-off record with the same subject and field.
"""

from __future__ import annotations

import datetime as _dt
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from hmstools.common import CheckResult
from hmstools.safety import signoffs as so
from hmstools.safety.plan import PlanFacts, PlanParseError, parse_plan

CHECK_NAME = "safety"

SI_IDS = [f"SI-{n:02d}" for n in range(1, 22)]
REQUIRED_SEEDED = [f"H{n}" for n in range(1, 16)]
SI21_LABELS = ["hiv", "mental-health", "reproductive-sexual-health", "gender-based-violence", "forensic-mlc", "vip"]
STATE_RANK = {"planned": 0, "implemented": 1, "verified": 2}
STATUS_NEEDS = {"controls-implemented": 1, "controls-verified": 2, "accepted": 2}
# Reported on every run (0 when a rule could not run), so the JSON shape is stable for tools/ci/run.
COUNT_KEYS = (
    "hazards", "controls", "controls_planned", "controls_implemented", "controls_verified", "sis_covered",
    "seeded_hazards", "sensitivity_label_entries", "sacs_referenced", "feature_ids_known",
    "feature_source_backlog_yaml", "signoff_records", "state_machine_specs", "approval_fields_filled",
)


class EnvironmentProblem(Exception):
    """A usage or environment error (exit code 2): missing dependency or plan of record."""


@dataclass
class SafetyPaths:
    root: Path
    hazard_log: Path
    schema: Path
    signoffs_dir: Path
    signoff_schema: Path
    state_machines_dir: Path
    safety_dir: Path
    backlog: Path
    build_prompt: Path

    @classmethod
    def for_root(cls, root: Path) -> "SafetyPaths":
        safety = root / "docs" / "safety"
        return cls(
            root=root,
            hazard_log=safety / "hazard-log.yaml",
            schema=safety / "hazard-log.schema.json",
            signoffs_dir=safety / "signoffs",
            signoff_schema=safety / "signoffs" / "signoff.schema.json",
            state_machines_dir=root / "docs" / "specs" / "state-machines",
            safety_dir=safety,
            backlog=root / "docs" / "program" / "backlog.yaml",
            build_prompt=root / "BUILD-PROMPT.md",
        )

    def label(self, path: Path) -> str:
        try:
            return path.resolve().relative_to(self.root.resolve()).as_posix()
        except ValueError:
            return path.as_posix()


# --------------------------------------------------------------------------------------------- YAML


_STRICT_LOADER: Any = None


def _strict_loader() -> Any:
    """A safe YAML loader (libyaml-backed when available) that rejects duplicate mapping keys."""
    global _STRICT_LOADER
    if _STRICT_LOADER is not None:
        return _STRICT_LOADER
    import yaml

    base = getattr(yaml, "CSafeLoader", yaml.SafeLoader)

    class StrictLoader(base):  # type: ignore[misc, valid-type]
        pass

    def construct_mapping(loader: Any, node: Any, deep: bool = False) -> Any:
        loader.flatten_mapping(node)
        seen: set[Any] = set()
        for key_node, _ in node.value:
            key = loader.construct_object(key_node, deep=True)
            try:
                duplicate = key in seen
                seen.add(key)
            except TypeError:  # unhashable keys are rejected by the safe constructor below
                duplicate = False
            if duplicate:
                raise yaml.constructor.ConstructorError(
                    "while constructing a mapping", node.start_mark, f"found duplicate key {key!r}", key_node.start_mark
                )
        return yaml.constructor.SafeConstructor.construct_mapping(loader, node, deep=deep)

    StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_mapping)
    _STRICT_LOADER = StrictLoader
    return StrictLoader


def _strict_yaml_load(path: Path) -> Any:
    import yaml

    text = path.read_text(encoding="utf-8")
    return yaml.load(text, Loader=_strict_loader())  # noqa: S506 - a SafeLoader subclass


def _normalise(node: Any) -> Any:
    """Turn YAML dates into ISO strings so JSON Schema sees strings."""
    if isinstance(node, dict):
        return {str(k) if isinstance(k, (_dt.date, _dt.datetime)) else k: _normalise(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_normalise(v) for v in node]
    if isinstance(node, (_dt.datetime, _dt.date)):
        return node.isoformat()
    return node


def _load(path: Path, label: str, result: CheckResult) -> tuple[bool, Any]:
    import yaml

    try:
        return True, _normalise(_strict_yaml_load(path))
    except (yaml.YAMLError, UnicodeDecodeError) as exc:
        result.errors.append(f"{label}: does not parse as YAML: {' '.join(str(exc).split())}")
    except OSError as exc:
        result.errors.append(f"{label}: cannot be read: {exc}")
    return False, None


_VALIDATORS: dict[str, Any] = {}
_MAX_MESSAGE = 300


def _load_schema(path: Path, label: str, result: CheckResult) -> dict[str, Any] | None:
    """Read and check a JSON Schema file; report problems as errors instead of raising."""
    import jsonschema

    if not path.is_file():
        result.errors.append(f"{label}: missing")
        return None
    try:
        schema = json.loads(path.read_text(encoding="utf-8"))
        jsonschema.validators.validator_for(schema).check_schema(schema)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        result.errors.append(f"{label}: cannot be read as JSON: {exc}")
        return None
    except jsonschema.exceptions.SchemaError as exc:
        result.errors.append(f"{label}: is not a valid JSON Schema: {exc.message}")
        return None
    if not isinstance(schema, dict):
        result.errors.append(f"{label}: is not a JSON Schema object")
        return None
    return schema


class _RefCycle(Exception):
    pass


def _inline_local_refs(schema: dict[str, Any]) -> dict[str, Any]:
    """Return the schema with local "#/$defs/..." references replaced by their targets.

    Same validation semantics (a $ref with sibling keywords becomes an allOf), about 2.5 times faster
    with the jsonschema reference resolver. Raises _RefCycle for recursive schemas.
    """
    defs = schema.get("$defs", {})

    def inline(node: Any, stack: tuple[str, ...]) -> Any:
        if isinstance(node, list):
            return [inline(v, stack) for v in node]
        if not isinstance(node, dict):
            return node
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/$defs/") and ref[8:] in defs:
            name = ref[8:]
            if name in stack:
                raise _RefCycle(name)
            target = inline(defs[name], (*stack, name))
            rest = {k: inline(v, stack) for k, v in node.items() if k != "$ref"}
            return {"allOf": [target], **rest} if rest else target
        return {k: inline(v, stack) for k, v in node.items() if k != "$defs"}

    return inline(schema, ())


def _schema_errors(document: Any, schema: dict[str, Any], label: str) -> list[str]:
    import jsonschema

    key = json.dumps(schema, sort_keys=True)
    validator = _VALIDATORS.get(key)
    if validator is None:
        validator_cls = jsonschema.validators.validator_for(schema)
        validator_cls.check_schema(schema)
        try:
            effective = _inline_local_refs(schema)
        except _RefCycle:
            effective = schema
        validator = validator_cls(effective, format_checker=validator_cls.FORMAT_CHECKER)
        _VALIDATORS[key] = validator
    errors = []
    for error in sorted(validator.iter_errors(document), key=lambda e: [str(p) for p in e.absolute_path]):
        where = "/".join(str(p) for p in error.absolute_path) or "(top level)"
        message = error.message if len(error.message) <= _MAX_MESSAGE else error.message[:_MAX_MESSAGE] + " …"
        errors.append(f"{label}: schema: {where}: {message}")
    return errors


# --------------------------------------------------------------------------------------------- features


def _backlog_feature_ids(document: Any) -> set[str]:
    items: Any = document
    if isinstance(document, dict):
        for key in ("features", "items", "backlog"):
            if isinstance(document.get(key), list):
                items = document[key]
                break
    ids: set[str] = set()
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict):
                for key in ("id", "feature_id"):
                    if isinstance(item.get(key), str):
                        ids.add(item[key])
    return ids


def _known_features(paths: SafetyPaths, plan: PlanFacts, result: CheckResult) -> set[str]:
    if paths.backlog.is_file():
        ok, document = _load(paths.backlog, paths.label(paths.backlog), result)
        ids = _backlog_feature_ids(document) if ok else set()
        if ok and not ids:
            result.errors.append(f"{paths.label(paths.backlog)}: no feature ids found (expected a list of items with 'id')")
        result.counts["feature_source_backlog_yaml"] = 1
        result.counts["feature_ids_known"] = len(ids)
        return ids
    result.counts["feature_source_backlog_yaml"] = 0
    result.counts["feature_ids_known"] = len(plan.appendix_a_features)
    result.warnings.append(
        f"{paths.label(paths.backlog)} does not exist yet; feature IDs were checked against BUILD-PROMPT.md "
        f"Appendix A table rows ({len(plan.appendix_a_features)} IDs)"
    )
    return set(plan.appendix_a_features)


# --------------------------------------------------------------------------------------------- semantic checks


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return list(value) if isinstance(value, list) else [value]


def _check_vocabulary(doc: dict[str, Any], schema: dict[str, Any], label: str, result: CheckResult) -> dict[str, Any]:
    vocab = doc["risk_vocabulary"]
    defs = schema.get("$defs", {})
    for key in ("severity", "likelihood", "level"):
        expected = defs.get(key, {}).get("enum")
        if expected is not None and vocab[key] != expected:
            result.errors.append(
                f"{label}: risk_vocabulary.{key} {vocab[key]} differs from the schema enumeration {expected}"
            )
    return vocab["matrix"]


def _check_risk(risk: dict[str, Any] | None, matrix: dict[str, Any], where: str, result: CheckResult) -> None:
    if not risk:
        return
    expected = matrix.get(risk["severity"], {}).get(risk["likelihood"])
    if expected != risk["level"]:
        result.errors.append(
            f"{where}: level {risk['level']!r} disagrees with the risk matrix "
            f"({risk['severity']} x {risk['likelihood']} = {expected!r})"
        )


def _check_seeded(doc: dict[str, Any], plan: PlanFacts, label: str, result: CheckResult) -> set[str]:
    seen: set[str] = set()
    for item in doc["seeded_hazards"]:
        hid = item["id"]
        if hid in seen:
            result.errors.append(f"{label}: seeded hazard {hid} is defined more than once")
        seen.add(hid)
        expected = plan.seeded_hazards.get(hid)
        if expected is not None and item["description"] != expected:
            result.errors.append(
                f"{label}: seeded hazard {hid} description {item['description']!r} differs from BUILD-PROMPT §2.4 {expected!r}"
            )
    missing = [h for h in REQUIRED_SEEDED if h not in seen]
    if missing:
        result.errors.append(f"{label}: seeded hazards missing: {', '.join(missing)} (H1 to H15 must all be defined, §2.4)")
    result.counts["seeded_hazards"] = len(seen)
    return seen


def _check_invariant_entry(hazard: dict[str, Any], plan: PlanFacts, label: str, result: CheckResult) -> str | None:
    """Checks for an entry that quotes an SI. Returns the SI it quotes, if any."""
    hid = hazard["id"]
    if "invariant_text" not in hazard:
        clause_ids: set[str] = set()
    else:
        clause_ids = {c["id"] for c in hazard["invariant_clauses"]}
    for control in hazard["controls"]:
        for cover in control.get("covers", []):
            if cover != "preamble" and cover not in clause_ids:
                result.errors.append(f"{label}: {control['id']} covers unknown clause {cover!r} of {hid}")
    if "invariant_text" not in hazard:
        return None

    invariants = hazard["invariants"]
    if len(invariants) != 1:
        result.errors.append(f"{label}: {hid} quotes an invariant but lists {len(invariants)} invariants; it must list exactly one")
        return None
    si = invariants[0]
    text = hazard["invariant_text"]
    if plan.si_text.get(si) != text:
        result.errors.append(
            f"{label}: {hid} invariant_text is not the verbatim {si} text of BUILD-PROMPT §2.1; "
            "never weaken, narrow or reinterpret an invariant"
        )
    clauses = hazard["invariant_clauses"]
    ids = [c["id"] for c in clauses]
    if len(ids) != len(set(ids)):
        result.errors.append(f"{label}: {hid} has duplicate clause ids")
    rebuilt = " ".join(" ".join(c["text"].split()) for c in clauses)
    if rebuilt != " ".join(text.split()):
        result.errors.append(f"{label}: {hid} invariant_clauses do not rebuild invariant_text word for word")
    covered = {cover for control in hazard["controls"] for cover in control.get("covers", [])}
    uncovered = [cid for cid in ids if cid not in covered]
    if uncovered:
        result.errors.append(
            f"{label}: {hid} ({si}) clauses not covered by any control: {', '.join(uncovered)}"
            " (every word of an invariant needs a control)"
        )
    if "preamble" not in covered:
        result.errors.append(
            f"{label}: {hid} ({si}) has no control covering the §2.1 preamble "
            "(domain enforcement on every channel, vendor lock, property tests and scenario suite)"
        )
    if hazard.get("enforced_in") != plan.si_enforced_in.get(si):
        result.errors.append(
            f"{label}: {hid} enforced_in {hazard.get('enforced_in')!r} differs from BUILD-PROMPT §2.1 "
            f"{plan.si_enforced_in.get(si)!r}"
        )
    expected_seeded = set(plan.si_seeded.get(si, []))
    actual_seeded = set(_as_list(hazard["seeded_hazard"]))
    if actual_seeded != expected_seeded:
        shown = ", ".join(sorted(expected_seeded)) or "none (—)"
        result.errors.append(
            f"{label}: {hid} seeded_hazard {sorted(actual_seeded) or None} differs from the §2.1 mapping for {si}: {shown}"
        )
    expected_sac = sorted(sac for sac, sis in plan.sac_to_si.items() if si in sis)
    missing_sac = [s for s in expected_sac if s not in hazard.get("sac", [])]
    if missing_sac:
        result.errors.append(f"{label}: {hid} ({si}) does not list {', '.join(missing_sac)}, which §18.4 maps to {si}")
    return si


def _check_controls(hazard: dict[str, Any], label: str, result: CheckResult, state_counts: dict[str, int]) -> int:
    hid = hazard["id"]
    number = hid.split("-")[1]
    lowest = 2
    for control in hazard["controls"]:
        cid, state = control["id"], control["state"]
        state_counts[state] += 1
        lowest = min(lowest, STATE_RANK[state])
        if cid.split("-")[1] != number:
            result.errors.append(f"{label}: control {cid} belongs to {hid} but its number does not match (CTRL-{number}-k)")
        implemented_in, verified_by = control["implemented_in"], control["verified_by"]
        if state == "implemented" and not implemented_in:
            result.errors.append(f"{label}: {cid} is 'implemented' but implemented_in is empty")
        if state == "verified":
            if not verified_by:
                result.errors.append(f"{label}: {cid} is 'verified' but verified_by is empty; 'verified' needs passing tests listed")
            if not implemented_in:
                result.errors.append(f"{label}: {cid} is 'verified' but implemented_in is empty")
        if state == "planned" and (implemented_in or verified_by):
            result.warnings.append(f"{label}: {cid} is 'planned' but lists implemented_in or verified_by; update its state with evidence")
    return lowest


def _check_hazards(
    doc: dict[str, Any], plan: PlanFacts, features: set[str], seeded: set[str], matrix: dict[str, Any],
    label: str, result: CheckResult,
) -> None:
    hazard_ids: set[str] = set()
    control_ids: set[str] = set()
    state_counts = {"planned": 0, "implemented": 0, "verified": 0}
    covered_si: set[str] = set()
    quoted: dict[str, list[str]] = {}
    labels_found: set[str] = set()
    sac_seen: set[str] = set()
    seeded_used: set[str] = set()

    for hazard in doc["hazards"]:
        hid = hazard["id"]
        if hid in hazard_ids:
            result.errors.append(f"{label}: hazard id {hid} is used more than once")
        hazard_ids.add(hid)
        for control in hazard["controls"]:
            if control["id"] in control_ids:
                result.errors.append(f"{label}: control id {control['id']} is used more than once")
            control_ids.add(control["id"])

        for ref in _as_list(hazard["seeded_hazard"]) + hazard.get("related_seeded_hazards", []):
            if ref not in seeded:
                result.errors.append(f"{label}: {hid} refers to seeded hazard {ref}, which is not defined in seeded_hazards")
        seeded_used.update(_as_list(hazard["seeded_hazard"]))
        covered_si.update(hazard["invariants"])

        si = _check_invariant_entry(hazard, plan, label, result)
        if si:
            quoted.setdefault(si, []).append(hid)
        if hazard.get("sensitivity_label"):
            if "SI-21" not in hazard["invariants"]:
                result.errors.append(f"{label}: {hid} has a sensitivity_label but does not list SI-21")
            else:
                labels_found.add(hazard["sensitivity_label"])

        for feature in hazard["features"]:
            if feature not in features:
                result.errors.append(f"{label}: {hid} lists unknown feature ID {feature}")
        for sac in hazard.get("sac", []):
            if sac not in plan.sac_to_si:
                result.errors.append(f"{label}: {hid} lists unknown {sac}")
            sac_seen.add(sac)
        owner_module = hazard["owner"][: -len("-squad")]
        if owner_module not in plan.modules:
            result.errors.append(f"{label}: {hid} owner {hazard['owner']!r} is not '<module>-squad' for a §5.2 module")
        for module in hazard.get("modules", []):
            if module not in plan.modules:
                result.errors.append(f"{label}: {hid} lists module {module!r}, which is not in the §5.2 module map")

        _check_risk(hazard["initial_risk"], matrix, f"{label}: {hid} initial_risk", result)
        _check_risk(hazard["residual_risk"]["proposed"], matrix, f"{label}: {hid} residual_risk.proposed", result)

        lowest = _check_controls(hazard, label, result, state_counts)
        status = hazard["status"]
        needed = STATUS_NEEDS.get(status)
        if needed is not None and lowest < needed:
            word = "implemented" if needed == 1 else "verified"
            result.errors.append(f"{label}: {hid} has status {status!r} but not every control is at least {word!r}")
        if status == "accepted":
            if hazard["residual_risk"]["proposed"] is None:
                result.errors.append(f"{label}: {hid} is 'accepted' but residual_risk.proposed is empty")
            if not so.is_filled(hazard["residual_risk"]["accepted_by"]):
                result.errors.append(f"{label}: {hid} is 'accepted' but residual_risk.accepted_by is empty")
        triage = hazard["cso_triage"]
        if so.is_filled(triage["by"]) != so.is_filled(triage["date"]):
            result.errors.append(f"{label}: {hid} cso_triage is partly filled; 'by' and 'date' come together from one sign-off record")

    for si in SI_IDS:
        if si not in covered_si:
            result.errors.append(f"{label}: {si} is not covered by any hazard entry (every SI has a hazard-log entry, §2.1)")
        entries = quoted.get(si, [])
        if not entries:
            result.errors.append(f"{label}: no hazard entry quotes {si} (invariant_text); one entry per SI quotes it verbatim")
        elif len(entries) > 1:
            result.errors.append(f"{label}: {si} is quoted by more than one entry ({', '.join(entries)})")
    for sensitivity in SI21_LABELS:
        if sensitivity not in labels_found:
            result.errors.append(
                f"{label}: SI-21 label {sensitivity!r} has no hazard entry of its own (SI-21: each label has its own hazard entry)"
            )

    unused = [h for h in sorted(seeded, key=lambda h: int(h[1:])) if h not in seeded_used]
    if unused:
        result.warnings.append(f"seeded hazards with no hazard entry yet: {', '.join(unused)}")
    no_entry = [s for s in sorted(plan.sac_to_si) if s not in sac_seen]
    if no_entry:
        result.warnings.append(f"{len(no_entry)} SACs have no hazard entry yet (§18.1): {', '.join(no_entry)}")

    result.counts.update(
        {
            "hazards": len(doc["hazards"]),
            "controls": sum(state_counts.values()),
            "controls_planned": state_counts["planned"],
            "controls_implemented": state_counts["implemented"],
            "controls_verified": state_counts["verified"],
            "sis_covered": len([si for si in SI_IDS if si in covered_si]),
            "sensitivity_label_entries": len(labels_found),
            "sacs_referenced": len(sac_seen),
        }
    )


# --------------------------------------------------------------------------------------------- sign-offs


def _load_signoffs(paths: SafetyPaths, authenticate: so.Authenticator, result: CheckResult) -> list[so.SignoffRecord]:
    records: list[so.SignoffRecord] = []
    files = list(so.iter_record_files(paths.signoffs_dir))
    result.counts["signoff_records"] = len(files)
    if not files:
        return records
    schema = _load_schema(paths.signoff_schema, paths.label(paths.signoff_schema), result)
    if schema is None:
        result.errors.append("sign-off records cannot be validated without their schema; none of them counts")
        return records
    seen: dict[str, str] = {}
    for path in files:
        label = paths.label(path)
        ok, data = _load(path, label, result)
        if not ok:
            continue
        errors = _schema_errors(data, schema, label)
        if errors:
            result.errors.extend(errors)
            continue
        record = so.SignoffRecord(path, data)
        valid = True
        if path.stem != record.id:
            result.errors.append(f"{label}: file name must be {record.id}.yaml")
            valid = False
        if record.id in seen:
            result.errors.append(f"{label}: sign-off id {record.id} is also used by {seen[record.id]}")
            valid = False
        seen[record.id] = label
        try:
            _dt.date.fromisoformat(record.date)
        except ValueError:
            result.errors.append(f"{label}: date {record.date!r} is not a valid calendar date")
            valid = False
        auth_errors = authenticate(path)
        if auth_errors:
            result.errors.extend(auth_errors)
            valid = False
        if valid:
            records.append(record)
    return records


def _gate(paths: SafetyPaths, hazard_doc: Any, records: list[so.SignoffRecord], result: CheckResult) -> None:
    gate_fields: list[so.GateField] = []
    if hazard_doc is not None:
        gate_fields += so.scan_gate_fields(hazard_doc, paths.label(paths.hazard_log), "hazard-log", hazard_log=True).fields

    others = []
    if paths.safety_dir.is_dir():
        for path in sorted(paths.safety_dir.rglob("*")):
            if path.suffix not in (".yaml", ".yml") or not path.is_file():
                continue
            if path.resolve() == paths.hazard_log.resolve():
                continue
            if paths.signoffs_dir.resolve() in path.resolve().parents:
                continue
            others.append(path)
    specs = []
    if paths.state_machines_dir.is_dir():
        specs = sorted(p for p in paths.state_machines_dir.iterdir() if p.is_file() and p.suffix in (".yaml", ".yml"))
    result.counts["state_machine_specs"] = len(specs)

    for path in others + specs:
        ok, document = _load(path, paths.label(path), result)
        if ok:
            gate_fields += so.scan_gate_fields(document, paths.label(path), path.stem).fields

    result.counts["approval_fields_filled"] = len(gate_fields)
    for gate in gate_fields:
        error = so.match_gate_field(gate, records)
        if error:
            result.errors.append(error)

    used = {(g.subject, f) for g in gate_fields for f in g.authorising_fields}
    for record in records:
        if record.authorises and (record.subject, record.field) not in used:
            result.warnings.append(
                f"{paths.label(record.path)}: sign-off record for {record.subject} {record.field} is present but that field is not filled yet"
            )


# --------------------------------------------------------------------------------------------- entry point


def run_check(paths: SafetyPaths, authenticate: so.Authenticator | None = None) -> CheckResult:
    """Run every rule. Raises EnvironmentProblem for usage or environment errors (exit code 2)."""
    try:
        import jsonschema  # noqa: F401
        import yaml  # noqa: F401
    except ImportError as exc:  # pragma: no cover - environment
        raise EnvironmentProblem(f"missing Python dependency: {exc.name} (use the project venv in .tools/venv)") from exc
    if not paths.build_prompt.is_file():
        raise EnvironmentProblem(f"{paths.label(paths.build_prompt)} (the plan of record) is missing")
    try:
        plan = parse_plan(paths.build_prompt)
    except PlanParseError as exc:
        raise EnvironmentProblem(f"BUILD-PROMPT.md could not be parsed: {exc}") from exc

    result = CheckResult(CHECK_NAME, counts={key: 0 for key in COUNT_KEYS})
    authenticate = authenticate or so.git_authenticator(paths.root)
    label = paths.label(paths.hazard_log)

    hazard_doc = None
    schema = _load_schema(paths.schema, paths.label(paths.schema), result)
    if not paths.hazard_log.is_file():
        result.errors.append(f"{label}: missing (WP-0.1 seeds it)")
    elif schema is not None:
        ok, hazard_doc = _load(paths.hazard_log, label, result)
        if ok:
            schema_errors = _schema_errors(hazard_doc, schema, label)
            result.errors.extend(schema_errors)
            if schema_errors:
                result.warnings.append(f"{label}: semantic checks skipped because the schema check failed")
            else:
                features = _known_features(paths, plan, result)
                matrix = _check_vocabulary(hazard_doc, schema, label, result)
                seeded = _check_seeded(hazard_doc, plan, label, result)
                _check_hazards(hazard_doc, plan, features, seeded, matrix, label, result)

    records = _load_signoffs(paths, authenticate, result)
    _gate(paths, hazard_doc, records, result)
    return result


