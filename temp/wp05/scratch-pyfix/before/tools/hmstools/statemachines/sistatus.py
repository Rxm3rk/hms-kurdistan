"""`tools/hms statemachines si-status [--require-domain] [--json]`: how each SI test reports (spec §4, §7).

Reads the SI register ``tests/invariants/si-register.json`` and, when present, the status files the SI tests write,
``tests/invariants/build/si-status/SI-nn.json``. It prints one line per SI: the specification layer (HOLDS, NONE
or FAILED, with its properties and sequences) and the domain layer (BUILT or NOT-BUILT, with what it waits on).

- Without ``--require-domain`` (a report): exit 0, unless the register is missing or malformed, a status file is
  malformed or contradicts the register, or a status says FAILED (exit 1).
- With ``--require-domain`` (the nightly step ``si-domain-layer``): also exit 1 while any SI's domain layer is
  NOT-BUILT, listing every one (§4 reporting rule 5: "fails the nightly tier ... listing them").

No green result here claims an SI holds at a layer it did not run at: a NOT-BUILT domain layer is declared and
tracked (KA-060), never enforced. The register's completeness against the backlog, the hazard log and the known
anomalies is the SI tests' own check (tests/invariants); this command checks the shape it reads.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from hmstools.common import CheckResult

CHECK_NAME = "si-status"
REGISTER = "tests/invariants/si-register.json"
STATUS_DIR = "tests/invariants/build/si-status"
SI_IDS = tuple(f"SI-{n:02d}" for n in range(1, 22))
DOMAIN_LAYERS = ("NOT-BUILT", "BUILT")
SPEC_LAYERS = ("HOLDS", "NONE", "FAILED")
COUNT_KEYS = (
    "entries", "domain_built", "domain_not_built", "spec_layer_entries", "status_files", "si_spec_layer_holds",
    "si_spec_layer_none", "si_spec_layer_failed", "si_domain_not_built", "spec_layer_sequences",
)
_NAME = re.compile(r"^SI-\d{2}\.json$")


@dataclass
class Entry:
    si: str
    title: str
    domain_layer: str
    waits_on: str
    ka: str
    spec_layer: list[dict[str, Any]] = field(default_factory=list)
    status: dict[str, Any] | None = None


def _text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _read_json(path: Path) -> tuple[Any, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except (OSError, UnicodeDecodeError) as exc:
        return None, f"cannot be read ({exc})"
    except ValueError as exc:
        return None, f"is not JSON ({exc})"


def read_register(root: Path) -> tuple[list[Entry], list[str]]:
    """The register's entries and its errors (each a failure: the register is the record of what is declared)."""
    path = root / REGISTER
    if not path.is_file():
        return [], [
            f"{REGISTER} does not exist: the SI register is missing, so no SI's layers can be reported (spec §4; fails closed)"
        ]
    document, problem = _read_json(path)
    if problem:
        return [], [f"{REGISTER} {problem}"]
    if not isinstance(document, dict):
        return [], [f"{REGISTER} is not a JSON object"]
    errors = []
    if document.get("version") != 1 or type(document.get("version")) is not int:
        errors.append(f"{REGISTER}: version is {document.get('version')!r}; this reader knows version 1")
    raw = document.get("entries")
    if not isinstance(raw, list):
        return [], [*errors, f"{REGISTER}: entries is not a list"]
    entries: list[Entry] = []
    seen: set[str] = set()
    for number, item in enumerate(raw):
        where = f"{REGISTER}: entries[{number}]"
        if not isinstance(item, dict):
            errors.append(f"{where} is not an object")
            continue
        si = item.get("si")
        if si not in SI_IDS:
            errors.append(f"{where}: si is {si!r}, not one of SI-01 to SI-21")
            continue
        where = f"{REGISTER}: {si}"
        if si in seen:
            errors.append(f"{where} is listed twice")
            continue
        seen.add(si)
        problems = []
        for key in ("title", "ka"):
            if not _text(item.get(key)):
                problems.append(f"{key} is missing or empty")
        domain = item.get("domain_layer")
        if domain not in DOMAIN_LAYERS:
            problems.append(f"domain_layer is {domain!r}, not one of {', '.join(DOMAIN_LAYERS)}")
        if domain == "NOT-BUILT":
            if not _text(item.get("waits_on")):
                problems.append("a NOT-BUILT domain layer names the work package it waits on (waits_on)")
            if not _text(item.get("domain_marker")):
                problems.append("a NOT-BUILT domain layer names its domain_marker (§4 reporting rule 3)")
            for key in ("backlog", "hazards"):
                value = item.get(key)
                if not isinstance(value, list) or not value or not all(_text(v) for v in value):
                    problems.append(f"{key} is not a non-empty list of ids")
        spec_layer = item.get("spec_layer")
        if not isinstance(spec_layer, list):
            problems.append("spec_layer is not a list")
            spec_layer = []
        for index, prop in enumerate(spec_layer):
            if not isinstance(prop, dict) or not _text(prop.get("machine")) or not _text(prop.get("property")) \
                    or not isinstance(prop.get("clauses"), list) or not prop.get("clauses"):
                problems.append(f"spec_layer[{index}] is not {{machine, property, clauses}} with at least one clause")
        if not _text(item.get("planned_test")):
            problems.append("planned_test is missing or empty")
        errors += [f"{where}: {p}" for p in problems]
        entries.append(Entry(si, str(item.get("title", "")), str(domain), str(item.get("waits_on") or ""), str(item.get("ka") or ""),
                             [p for p in spec_layer if isinstance(p, dict)]))
    missing = [si for si in SI_IDS if si not in seen]
    if missing:
        errors.append(f"{REGISTER}: no entry for {', '.join(missing)}; the register lists every SI (§4)")
    return entries, errors


def read_statuses(root: Path, entries: list[Entry]) -> tuple[int, list[str], list[str]]:
    """Attach each status file to its entry. Returns (files read, errors, warnings)."""
    directory = root / STATUS_DIR
    if not directory.is_dir():
        return 0, [], [f"{STATUS_DIR} does not exist: no SI test has run in this build (run the fast tier), so only the register is reported"]
    by_si = {e.si: e for e in entries}
    errors: list[str] = []
    files = sorted(p for p in directory.iterdir() if p.is_file() and p.suffix == ".json")
    for path in files:
        rel = f"{STATUS_DIR}/{path.name}"
        if not _NAME.match(path.name) or path.stem not in by_si:
            errors.append(f"{rel}: not the status file of an SI in the register (SI-nn.json)")
            continue
        data, problem = _read_json(path)
        if problem:
            errors.append(f"{rel} {problem}")
            continue
        entry = by_si[path.stem]
        problems = []
        if not isinstance(data, dict):
            errors.append(f"{rel} is not a JSON object")
            continue
        if data.get("si") != entry.si:
            problems.append(f"si is {data.get('si')!r}, not {entry.si}")
        if data.get("spec_layer") not in SPEC_LAYERS:
            problems.append(f"spec_layer is {data.get('spec_layer')!r}, not one of {', '.join(SPEC_LAYERS)}")
        if data.get("domain_layer") not in DOMAIN_LAYERS:
            problems.append(f"domain_layer is {data.get('domain_layer')!r}, not one of {', '.join(DOMAIN_LAYERS)}")
        elif data.get("domain_layer") != entry.domain_layer:
            problems.append(f"domain_layer is {data['domain_layer']} but the register says {entry.domain_layer}")
        sequences = data.get("sequences", 0)
        if type(sequences) is not int or sequences < 0:
            problems.append(f"sequences is {sequences!r}, not a count")
        if data.get("spec_layer") == "HOLDS" and not entry.spec_layer:
            problems.append("spec_layer HOLDS, but the register lists no specification-layer property for it")
        if data.get("spec_layer") == "NONE" and entry.spec_layer:
            problems.append(f"spec_layer NONE, but the register lists {len(entry.spec_layer)} specification-layer properties; none ran")
        if problems:
            errors += [f"{rel}: {p}" for p in problems]
            continue
        entry.status = data
        if data["spec_layer"] == "FAILED":
            errors.append(f"{entry.si}: the specification-layer property failed ({rel}); see the :tests:invariants test report")
    return len(files), errors, []


def _line(entry: Entry) -> str:
    status = entry.status
    if status is None:
        spec = f"spec layer not run in this build ({len(entry.spec_layer)} propert{'y' if len(entry.spec_layer) == 1 else 'ies'} registered)"
    else:
        properties = status.get("spec_layer_properties")
        shown = f", {len(properties)} propert{'y' if len(properties) == 1 else 'ies'}" if isinstance(properties, list) else ""
        spec = f"spec layer {status['spec_layer']}{shown}, {status.get('sequences', 0)} sequences"
    if entry.domain_layer == "NOT-BUILT":
        domain = f"domain layer NOT-BUILT (waits on {entry.waits_on}; {entry.ka})"
    else:
        domain = "domain layer BUILT"
    return f"{entry.si}: {spec}; {domain}"


def run_si_status(root: Path, require_domain: bool = False) -> tuple[CheckResult, list[str]]:
    """The result and the report lines (one per SI)."""
    result = CheckResult(CHECK_NAME, counts={k: 0 for k in COUNT_KEYS})
    entries, errors = read_register(root)
    result.errors += errors
    if not entries:
        return result, []
    files, status_errors, warnings = read_statuses(root, entries)
    result.errors += status_errors
    result.warnings += warnings
    counts = result.counts
    counts["entries"] = len(entries)
    counts["status_files"] = files
    for entry in entries:
        counts["domain_built" if entry.domain_layer == "BUILT" else "domain_not_built"] += entry.domain_layer in DOMAIN_LAYERS
        counts["spec_layer_entries"] += bool(entry.spec_layer)
        if entry.status is not None:
            key = {"HOLDS": "si_spec_layer_holds", "NONE": "si_spec_layer_none", "FAILED": "si_spec_layer_failed"}[entry.status["spec_layer"]]
            counts[key] += 1
            counts["si_domain_not_built"] += entry.status["domain_layer"] == "NOT-BUILT"
            counts["spec_layer_sequences"] += int(entry.status.get("sequences", 0))
    not_built = [e for e in entries if e.domain_layer == "NOT-BUILT"]
    if not_built:
        listed = "; ".join(f"{e.si} (waits on {e.waits_on}; {e.ka})" for e in not_built)
        message = (
            f"{len(not_built)} SI domain layer(s) NOT-BUILT, so C2 ('across all invariants') is not met: {listed}. "
            "A NOT-BUILT layer is declared and tracked, never enforced (spec §4)"
        )
        (result.errors if require_domain else result.warnings).append(message)
    return result, [_line(e) for e in entries]
