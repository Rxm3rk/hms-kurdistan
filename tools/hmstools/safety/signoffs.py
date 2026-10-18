"""Human sign-off records and the approval-field gate (BUILD-PROMPT.md §3.5).

A sign-off record is a YAML file under docs/safety/signoffs/ that a named human adds in a signed git
commit (docs/safety/signoffs/README.md). Any approval, sign-off, triage or acceptance field that is
filled must be backed by a record with the same subject and field; otherwise the check fails.
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterator

# Keys whose non-empty value always needs a sign-off record, wherever they appear.
GATE_KEYS = ("approved_by", "accepted_by", "signed_by", "triaged_by")

# Decisions that authorise filling a field; "rejected" and "returned" authorise nothing.
AUTHORISING_DECISIONS = {None, "approved", "accepted", "triaged"}

# Commit trailers that mark AI-assisted commits; a sign-off record must not be added by one.
_AI_TRAILER = re.compile(
    r"(?im)^co-authored-by:.*(anthropic|claude|openai|chatgpt|copilot|gemini|\[bot\]|\bbot\b)"
)

Authenticator = Callable[[Path], list[str]]


@dataclass
class SignoffRecord:
    path: Path
    data: dict[str, Any]

    @property
    def id(self) -> str:
        return str(self.data.get("id"))

    @property
    def subject(self) -> str:
        return str(self.data.get("subject"))

    @property
    def field(self) -> str:
        return str(self.data.get("field"))

    @property
    def name(self) -> str:
        return str(self.data.get("name"))

    @property
    def date(self) -> str:
        return str(self.data.get("date"))

    @property
    def authorises(self) -> bool:
        return self.data.get("decision") in AUTHORISING_DECISIONS


@dataclass
class GateField:
    """One filled approval field found in a scanned file."""

    file: str
    subject: str
    path: str
    value: Any
    authorising_fields: set[str]
    kind: str  # "by" (a person), "date", "record" (a record id) or "state" (a status value)


@dataclass
class GateScan:
    fields: list[GateField] = field(default_factory=list)


def is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, (str, list, dict, tuple, set)):
        return len(value) > 0
    return True


def _parents(path: str) -> set[str]:
    parts = path.split(".")
    return {".".join(parts[:i]) for i in range(1, len(parts))}


def _subject_of(mapping: dict[str, Any]) -> str | None:
    for key in ("id", "machine"):
        value = mapping.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def scan_gate_fields(document: Any, file_label: str, default_subject: str, hazard_log: bool = False) -> GateScan:
    """Find every filled approval field in a loaded YAML document.

    The subject of a field is the nearest enclosing mapping with an ``id`` (or, for state-machine
    specs, ``machine``); the field path is the dotted key path from that mapping to the field.
    """
    scan = GateScan()

    def add(subject: str, path: str, value: Any, kind: str, extra: set[str] | None = None) -> None:
        authorising = {path} | _parents(path) | (extra or set())
        scan.fields.append(GateField(file_label, subject, path, value, authorising, kind))

    def walk(node: Any, subject: str, prefix: list[str]) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item, subject, prefix)
            return
        if not isinstance(node, dict):
            return
        own = _subject_of(node)
        if own is not None:
            subject, prefix = own, []
        is_hazard = hazard_log and isinstance(node.get("id"), str) and str(node.get("id")).startswith("HAZ-")
        for key, value in node.items():
            key = str(key)
            path = ".".join([*prefix, key])
            if key in GATE_KEYS and is_filled(value):
                add(subject, path, value, "by")
            elif key == "cso_triage" and isinstance(value, dict):
                if is_filled(value.get("by")):
                    add(subject, f"{path}.by", value.get("by"), "by")
                if is_filled(value.get("date")):
                    add(subject, f"{path}.date", value.get("date"), "date")
            elif key == "approval" and isinstance(value, dict):
                if is_filled(value.get("record")):
                    add(subject, f"{path}.record", value.get("record"), "record", {f"{path}.approved_by"})
                status = value.get("status")
                if status not in (None, "requested"):
                    add(subject, f"{path}.status", status, "state", {f"{path}.approved_by"})
            elif key == "status" and is_hazard and value == "accepted":
                add(subject, path, value, "state", {"residual_risk.accepted_by"})
            elif key == "status" and node.get("id") == "risk-vocabulary" and value not in (None, "proposed"):
                add(subject, path, value, "state", {"approval.approved_by"})
            if isinstance(value, (dict, list)):
                walk(value, subject, [*prefix, key])

    walk(document, default_subject, [])
    return scan


def _values(value: Any) -> list[Any]:
    return list(value) if isinstance(value, (list, tuple)) else [value]


def match_gate_field(gate: GateField, records: list[SignoffRecord]) -> str | None:
    """Return an error message if the filled field is not backed by a sign-off record, else None."""
    candidates = [
        r for r in records if r.authorises and r.subject == gate.subject and r.field in gate.authorising_fields
    ]
    shown = gate.value if not isinstance(gate.value, str) else repr(gate.value)
    where = f"{gate.file}: {gate.subject} {gate.path} is filled ({shown})"
    if not candidates:
        return (
            f"{where} but no sign-off record under docs/safety/signoffs/ has subject {gate.subject!r} "
            f"and field {gate.path!r}; approval fields stay empty until a human adds one (BUILD-PROMPT §3.5)"
        )
    ids = ", ".join(sorted(r.id for r in candidates))
    for item in _values(gate.value):
        if gate.kind == "by":
            ok = isinstance(item, str) and any(item in (r.name, r.id) for r in candidates)
        elif gate.kind == "date":
            ok = any(str(item) == r.date for r in candidates)
        elif gate.kind == "record":
            ok = isinstance(item, str) and any(item == r.id for r in candidates)
        else:
            ok = True
        if not ok:
            return f"{where} but the value {item!r} does not match the sign-off record(s) {ids} (name, id or date)"
    return None


GitRunner = Callable[..., "subprocess.CompletedProcess[str]"]


def git_authenticator(root: Path, runner: GitRunner | None = None) -> Authenticator:
    """Authenticate a record by git: committed, unmodified, every commit touching it signed, no AI trailer.

    ``runner`` replaces the git call in tests; it receives the git arguments and returns a CompletedProcess.
    """

    def default_run(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", "-C", str(root), *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )

    run = runner or default_run

    def authenticate(record_path: Path) -> list[str]:
        try:
            rel = record_path.resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            return [f"{record_path}: sign-off record is outside the repository; it cannot be authenticated"]
        try:
            status = run("status", "--porcelain", "--", rel)
        except FileNotFoundError:
            return [f"{rel}: git is not available, so the sign-off record cannot be authenticated"]
        if status.returncode != 0:
            return [f"{rel}: git cannot inspect the record ({status.stderr.strip() or 'not a git repository'})"]
        if status.stdout.strip():
            return [f"{rel}: sign-off record is untracked or has uncommitted changes; only a committed, signed record counts"]
        log = run("log", "--format=%H%x1f%G?%x1f%B%x1e", "--", rel)
        if log.returncode != 0:
            return [f"{rel}: git log failed ({log.stderr.strip()})"]
        commits = [c.strip() for c in log.stdout.split("\x1e") if c.strip()]
        if not commits:
            return [f"{rel}: sign-off record is not in any commit; it must be added in a signed commit"]
        errors = []
        for entry in commits:
            sha, sig, body = (entry.split("\x1f") + ["", "", ""])[:3]
            if sig not in ("G", "U"):
                errors.append(
                    f"{rel}: commit {sha[:12]} touching the sign-off record has no valid signature "
                    f"(git %G? = {sig or '?'}); records must be added in a commit signed by the named person"
                )
            if _AI_TRAILER.search(body):
                errors.append(f"{rel}: commit {sha[:12]} carries an AI co-author trailer; the agent never writes sign-off records")
        return errors

    return authenticate


def iter_record_files(directory: Path) -> Iterator[Path]:
    if not directory.is_dir():
        return iter(())
    return iter(sorted(p for p in directory.iterdir() if p.is_file() and p.suffix in (".yaml", ".yml")))
