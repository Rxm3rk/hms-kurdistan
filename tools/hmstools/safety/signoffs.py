"""Human sign-off records and the approval-field gate (BUILD-PROMPT.md §3.5).

A sign-off record is a YAML file under docs/safety/signoffs/ that a named human adds in a git commit
signed with a key listed for them in docs/safety/signoffs/allowed-signers.yaml
(docs/safety/signoffs/README.md). Any approval, sign-off, triage or acceptance field that is filled
must be backed by a record with the same subject and field, the decision that field needs, the
subject's current version and a role the field accepts, which no other record has withdrawn (a record
that names it in ``supersedes``, or a rejection or return of the same subject version and field);
otherwise the check fails.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re
import subprocess
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Callable, Iterator

# Keys whose non-empty value always needs a sign-off record, wherever they appear.
GATE_KEYS = ("approved_by", "accepted_by", "signed_by", "triaged_by")

# Decisions that authorise a field, each only the fields of its own kind (decision_for); "rejected" and
# "returned" authorise nothing, and withdraw the records of the same subject version and field (withdrawals).
AUTHORISING_DECISIONS = ("approved", "accepted", "triaged")
WITHDRAWING_DECISIONS = ("rejected", "returned")

# Risk acceptance and CSO triage are the CSO's (Appendix B.2: "[HUMAN] CSO only"; §10.1).
CSO_ROLE = "cso"
# The subject id of the hazard log's risk vocabulary and matrix, a CSO decision.
RISK_VOCABULARY = "risk-vocabulary"

# The human-maintained list of the keys whose holders may sign records, and its schema. They live
# beside the records but are not records.
ALLOWED_SIGNERS_FILE = "allowed-signers.yaml"
ALLOWED_SIGNERS_SCHEMA_FILE = "allowed-signers.schema.json"

# A subject's content version leaves out the fields that the records themselves authorise: the GATE_KEYS
# and every cso_triage block anywhere, and in an approval block its status, approvers and record. The
# block's required roles stay in the content, so narrowing them is a change of the subject ...
_HUMAN_FIELDS = frozenset((*GATE_KEYS, "cso_triage"))
_APPROVAL_HUMAN_FIELDS = frozenset(("status", "approved_by", "record"))
# ... and a triage's version also leaves out the evidence of progress, which does not change what the
# CSO triaged: a control's state, implementation and verification, and the residual risk.
_PROGRESS_FIELDS = frozenset(("state", "implemented_in", "verified_by", "residual_risk"))

# Commit trailers that mark AI-assisted commits; a sign-off record must not be added by one.
_AI_TRAILER = re.compile(
    r"(?im)^co-authored-by:.*(anthropic|claude|openai|chatgpt|copilot|gemini|\[bot\]|\bbot\b)"
)

# What git's %G? means when it is not G, for the error message.
_SIGNATURE_HINTS = {
    "U": "a good signature, but this host does not trust the key: GPG needs the key valid in the local "
    "keyring, SSH needs it in the file named by gpg.ssh.allowedSignersFile",
    "N": "no signature, or one this host cannot check (SSH needs gpg.ssh.allowedSignersFile)",
    "E": "the signature cannot be checked: the key is not in this host's keyring",
    "B": "a bad signature",
    "X": "the signature has expired",
    "Y": "the key has expired",
    "R": "the key is revoked",
}

# Runs git with the given arguments (and, as the keyword ``input``, its standard input).
GitRunner = Callable[..., "subprocess.CompletedProcess[str]"]
Authenticator = Callable[["SignoffRecord"], list[str]]
# Reads an allowed-signers text, with a label for messages, against the text of a schema (None: the
# working-tree schema): the signers, or None if the text is invalid, and the errors.
SignersReader = Callable[[str, str, "str | None"], "tuple[list[AllowedSigner] | None, list[str]]"]


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
    def role(self) -> str:
        return str(self.data.get("role"))

    @property
    def name(self) -> str:
        return str(self.data.get("name"))

    @property
    def date(self) -> str:
        return str(self.data.get("date"))

    @property
    def decision(self) -> str | None:
        value = self.data.get("decision")
        return None if value is None else str(value)

    @property
    def subject_version(self) -> str | None:
        value = self.data.get("subject_version")
        return None if value is None else str(value)

    @property
    def signer_key(self) -> str | None:
        authentication = self.data.get("authentication")
        value = authentication.get("signer_key") if isinstance(authentication, dict) else None
        return None if value is None else str(value)

    @property
    def supersedes(self) -> str | None:
        value = self.data.get("supersedes")
        return None if value is None else str(value)

    @property
    def authorises(self) -> bool:
        return self.decision in AUTHORISING_DECISIONS


@dataclass
class GateField:
    """One filled approval field found in a scanned file."""

    file: str
    subject: str
    path: str
    value: Any
    authorising_fields: set[str]
    kind: str  # "by" (a person), "date", "record" (a record id), "state" (a status value) or "block" (an approval or triage that is not a block)
    decision: str  # the decision a backing record must carry (decision_for)
    version: str  # the subject's current version (subject_version)
    roles: tuple[str, ...] | None  # the roles a backing record may sign as; None when the field names none


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


def decision_for(path: str) -> str:
    """The decision a record must carry to back the field at ``path``.

    accepted backs ``…accepted_by``; triaged backs ``cso_triage`` and ``…triaged_by``; approved backs
    an approval block, ``…approved_by`` and ``…signed_by``. A hazard status ``accepted`` needs
    accepted and a risk-vocabulary status needs approved (scan_gate_fields sets both).
    """
    parts = path.split(".")
    if "cso_triage" in parts or parts[-1] == "triaged_by":
        return "triaged"
    if parts[-1] == "accepted_by":
        return "accepted"
    return "approved"


def _role_list(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,) if value else ()
    if isinstance(value, list):
        return tuple(item for item in value if isinstance(item, str) and item)
    return ()


def _approval_roles(subject: str, required: Any) -> tuple[str, ...]:
    """The roles an approval block accepts: those its ``required`` lists. Risk-vocabulary always needs the
    CSO, with any other role its ``required`` lists, because changing the vocabulary or the matrix is a CSO
    decision (hazard-log.yaml, risk_vocabulary.note); a ``required`` list cannot drop the CSO."""
    roles = _role_list(required)
    if subject == RISK_VOCABULARY:
        return (CSO_ROLE, *(role for role in roles if role != CSO_ROLE))
    return roles


def _status_is_human(subject: Any) -> bool:
    """True for the subjects whose own ``status`` is an approval field (a hazard, risk-vocabulary)."""
    if not isinstance(subject, dict) or not isinstance(subject.get("id"), str):
        return False
    return subject["id"].startswith("HAZ-") or subject["id"] == RISK_VOCABULARY


def _plain(value: Any, drop: frozenset[str], drop_status: bool) -> Any:
    if isinstance(value, dict):
        return {
            str(k): _plain(_approval_content(v) if str(k) == "approval" else v, drop, False)
            for k, v in value.items()
            if str(k) not in drop and not (drop_status and str(k) == "status")
        }
    if isinstance(value, (list, tuple)):
        return [_plain(v, drop, False) for v in value]
    if isinstance(value, (_dt.datetime, _dt.date)):
        return value.isoformat()
    return value


def _approval_content(block: Any) -> Any:
    """An approval block without its human fields (status, approvers, record); its required roles stay."""
    if not isinstance(block, dict):
        return block
    return {k: v for k, v in block.items() if str(k) not in _APPROVAL_HUMAN_FIELDS}


def content_version(subject: Any, decision: str) -> str:
    """The version of a subject that has no ``version`` field: ``sha256:`` and 64 hex digits.

    It is the SHA-256 of the subject's canonical JSON (sorted keys, no spaces, UTF-8) without the human
    fields: every key in GATE_KEYS and every ``cso_triage`` at any depth, the ``status``, ``approved_by``
    and ``record`` of every ``approval`` block (its ``required`` roles stay), and the subject's own
    ``status`` where that is an approval field. For a triage it also leaves out the evidence of progress
    (``state``, ``implemented_in``, ``verified_by`` and ``residual_risk``), so building and verifying
    the triaged controls keeps the triage; any other change gives a new version.
    """
    drop = _HUMAN_FIELDS | (_PROGRESS_FIELDS if decision == "triaged" else frozenset())
    plain = _plain(subject, drop, _status_is_human(subject))
    text = json.dumps(plain, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def subject_version(subject: Any, decision: str) -> str:
    """The current version of a subject: its own ``version`` field (a state-machine spec, Appendix B.3)
    or, when it has none (a hazard entry, a control, risk-vocabulary), its content version."""
    if isinstance(subject, dict):
        declared = subject.get("version")
        if isinstance(declared, (int, str)) and not isinstance(declared, bool) and str(declared):
            return str(declared)
    return content_version(subject, decision)


def scan_gate_fields(document: Any, file_label: str, default_subject: str, hazard_log: bool = False) -> GateScan:
    """Find every filled approval field in a loaded YAML document.

    The subject of a field is the nearest enclosing mapping with an ``id`` (or, for state-machine
    specs, ``machine``); the field path is the dotted key path from that mapping to the field. Each
    field also gets the decision, the roles and the subject version that a backing record must match.
    """
    scan = GateScan()

    def add(
        subject: str, node: Any, path: str, value: Any, kind: str, decision: str,
        roles: tuple[str, ...] | None, extra: set[str] | None = None,
    ) -> None:
        authorising = {path} | _parents(path) | (extra or set())
        version = subject_version(node, decision)
        scan.fields.append(GateField(file_label, subject, path, value, authorising, kind, decision, version, roles))

    def walk(node: Any, subject: str, subject_node: Any, prefix: list[str]) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item, subject, subject_node, prefix)
            return
        if not isinstance(node, dict):
            return
        own = _subject_of(node)
        if own is not None:
            subject, subject_node, prefix = own, node, []
        is_hazard = hazard_log and isinstance(node.get("id"), str) and str(node.get("id")).startswith("HAZ-")
        in_approval = bool(prefix) and prefix[-1] == "approval"
        for key, value in node.items():
            key = str(key)
            path = ".".join([*prefix, key])
            if key in GATE_KEYS and is_filled(value):
                if in_approval:
                    roles: tuple[str, ...] | None = _approval_roles(subject, node.get("required"))
                elif path == "residual_risk.accepted_by":
                    roles = (CSO_ROLE,)
                else:
                    roles = None
                add(subject, subject_node, path, value, "by", decision_for(path), roles)
            elif key in ("cso_triage", "approval") and is_filled(value) and not isinstance(value, dict):
                # A triage or an approval written as text or a list: no record can back a field that has no
                # by, date, status or record, so it fails closed.
                add(subject, subject_node, path, value, "block", "triaged" if key == "cso_triage" else "approved", None)
            elif key == "cso_triage" and isinstance(value, dict):
                for part in ("by", "date"):
                    if is_filled(value.get(part)):
                        add(subject, subject_node, f"{path}.{part}", value.get(part), part, "triaged", (CSO_ROLE,))
            elif key == "approval" and isinstance(value, dict):
                roles = _approval_roles(subject, value.get("required"))
                extra = {f"{path}.approved_by"}
                if is_filled(value.get("record")):
                    add(subject, subject_node, f"{path}.record", value.get("record"), "record", "approved", roles, extra)
                status = value.get("status")
                if status not in (None, "requested"):
                    add(subject, subject_node, f"{path}.status", status, "state", "approved", roles, extra)
            elif key == "status" and is_hazard and value == "accepted":
                add(subject, subject_node, path, value, "state", "accepted", (CSO_ROLE,), {"residual_risk.accepted_by"})
            elif key == "status" and node.get("id") == RISK_VOCABULARY and value not in (None, "proposed"):
                approval = node.get("approval")
                roles = _approval_roles(subject, approval.get("required") if isinstance(approval, dict) else None)
                add(subject, subject_node, path, value, "state", "approved", roles, {"approval", "approval.approved_by"})
            if isinstance(value, (dict, list)):
                walk(value, subject, subject_node, [*prefix, key])

    walk(document, default_subject, document, [])
    return scan


def _values(value: Any) -> list[Any]:
    return list(value) if isinstance(value, (list, tuple)) else [value]


def _listing(records: list[SignoffRecord], what: Callable[[SignoffRecord], Any]) -> str:
    return ", ".join(f"{r.id} ({what(r)})" for r in sorted(records, key=lambda r: r.id))


def _overlaps(first: str, second: str) -> bool:
    """True if one dotted field path is the other or lies under it."""
    return first == second or first.startswith(second + ".") or second.startswith(first + ".")


def withdrawals(
    records: list[SignoffRecord], label: Callable[[SignoffRecord], str] = lambda r: r.path.name,
) -> tuple[dict[str, str], list[str]]:
    """The records that authorise nothing any more, each with the reason, and the errors in ``supersedes``.

    A record withdraws the record its ``supersedes`` names, whatever either of them decides; a record
    replaced this way stays withdrawn even if its replacement is replaced in turn. A ``rejected`` or
    ``returned`` record that no record supersedes withdraws every record for the same subject at the same
    subject_version whose field is its field, a parent or a child of it, whatever their role or date: a
    rejection or a return stands until a record supersedes it, or until the subject changes. ``supersedes``
    must name another valid record; a record whose ``supersedes`` does not is an error until a later record
    supersedes it.
    """
    ids = {r.id for r in records}
    ordered = sorted(records, key=lambda r: r.id)
    withdrawn: dict[str, str] = {}
    for record in ordered:
        target = record.supersedes
        if target is not None and target != record.id and target in ids:
            withdrawn.setdefault(target, f"superseded by {record.id}")
    errors = []
    for record in ordered:
        target = record.supersedes
        if target is None or record.id in withdrawn:
            continue
        if target == record.id:
            errors.append(f"{label(record)}: supersedes itself; 'supersedes' names the earlier record this one replaces")
        elif target not in ids:
            errors.append(
                f"{label(record)}: supersedes {target}, but no valid sign-off record has that id, so nothing is "
                "withdrawn; a later record that supersedes this one ends the error"
            )
    for record in ordered:
        if record.decision not in WITHDRAWING_DECISIONS or record.id in withdrawn:
            continue
        for other in ordered:
            if other.id in withdrawn or not other.authorises:
                continue
            if (other.subject == record.subject and other.subject_version == record.subject_version
                    and _overlaps(other.field, record.field)):
                withdrawn[other.id] = f"withdrawn by {record.id} ({record.decision}) at the same subject version"
    return withdrawn, errors


def match_gate_field(gate: GateField, records: list[SignoffRecord], withdrawn: dict[str, str] | None = None) -> str | None:
    """Return an error message if the filled field is not backed by a sign-off record, else None.

    A record backs the field when its subject is the field's subject, its field is the field's path
    (or a parent of it), its decision is the one the field needs, its subject_version is the subject's
    current version, no record has withdrawn it (withdrawals) and, where the field names roles, its role
    is one of them; the field's value must then agree with it. A filled approval status needs such a
    record for every required role. ``withdrawn`` is withdrawals(records)[0], computed here if not given.
    """
    if withdrawn is None:
        withdrawn = withdrawals(records)[0]
    shown = gate.value if not isinstance(gate.value, str) else repr(gate.value)
    where = f"{gate.file}: {gate.subject} {gate.path} is filled ({shown})"
    if gate.kind == "block":
        parts = "by and date, Appendix B.2" if gate.decision == "triaged" else "status, required, approved_by and record, Appendix B.3"
        return (
            f"{where} but it is not a block with its own fields ({parts}), so no sign-off record can authorise it; "
            "only the block's fields can be filled, each from a record"
        )
    same = [r for r in records if r.subject == gate.subject and r.field in gate.authorising_fields]
    if not same:
        return (
            f"{where} but no sign-off record under docs/safety/signoffs/ has subject {gate.subject!r} "
            f"and field {gate.path!r}; approval fields stay empty until a human adds one (BUILD-PROMPT §3.5), "
            f"with decision {gate.decision!r} and subject_version {gate.version!r}"
        )
    decided = [r for r in same if r.decision == gate.decision]
    if not decided:
        return (
            f"{where} but no sign-off record with decision {gate.decision!r} backs it "
            f"({_listing(same, lambda r: r.decision)}); only {gate.decision!r} authorises {gate.path}"
        )
    current = [r for r in decided if r.subject_version == gate.version]
    if not current:
        return (
            f"{where} but sign-off record(s) {_listing(decided, lambda r: r.subject_version)} are for "
            f"another version of {gate.subject}, whose current version is {gate.version!r}; a record "
            "authorises only the version it names, so a changed subject needs a new record (supersedes)"
        )
    dead = [r for r in current if r.id in withdrawn]
    current = [r for r in current if r.id not in withdrawn]
    if not current:
        return (
            f"{where} but sign-off record(s) {_listing(dead, lambda r: withdrawn[r.id])} are withdrawn, so they "
            "authorise nothing; it needs a new record for the current version (one that supersedes the rejection "
            "or return, where one withdrew them)"
        )
    candidates = current
    if gate.roles is not None:
        if not gate.roles:
            return f"{where} but its approval block lists no required roles, so no sign-off record can authorise it"
        candidates = [r for r in current if r.role in gate.roles]
        if not candidates:
            return (
                f"{where} but sign-off record(s) {_listing(current, lambda r: r.role)} do not sign as "
                f"{' or '.join(gate.roles)}, which the field needs"
            )
    ids = ", ".join(sorted(r.id for r in candidates))
    if gate.kind == "state" and gate.roles:
        missing = [role for role in gate.roles if not any(r.role == role for r in candidates)]
        if missing:
            return (
                f"{where} but no sign-off record signs as {', '.join(missing)}; every required role "
                f"({', '.join(gate.roles)}) needs its own record (found {ids})"
            )
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
            also = f"; {_listing(dead, lambda r: withdrawn[r.id])} withdrawn" if dead else ""
            return f"{where} but the value {item!r} does not match the sign-off record(s) {ids} (name, id or date){also}"
    return None


# --------------------------------------------------------------------------------------------- signers

# Full fingerprints as allowed-signers.schema.json writes them: GPG v4 or v5, and SSH.
_GPG_FINGERPRINT = re.compile(r"[0-9A-F]{40}(?:[0-9A-F]{24})?")
_SSH_FINGERPRINT = re.compile(r"SHA256:[A-Za-z0-9+/]{43}")


def normalise_fingerprint(value: str) -> str:
    """GPG fingerprints compare as upper-case hex without spaces; SSH ones (``SHA256:…``) exactly."""
    compact = "".join(str(value).split())
    return compact if compact.startswith("SHA256:") else compact.upper()


def _key_type(fingerprint: str) -> str:
    return "ssh" if fingerprint.startswith("SHA256:") else "gpg"


@dataclass(frozen=True)
class AllowedSigner:
    """One entry of allowed-signers.yaml: a person, the roles they sign in, and one of their keys."""

    name: str
    roles: tuple[str, ...]
    key_type: str  # "gpg" or "ssh"
    fingerprint: str
    added: str

    def signed(self, fingerprint: str, primary: str = "") -> bool:
        """True if git's %GF (the signing key) or %GP (its primary key, for a GPG subkey) is this key."""
        seen = {normalise_fingerprint(f) for f in (fingerprint, primary) if f}
        own = normalise_fingerprint(self.fingerprint)
        return own in seen and self.key_type == _key_type(own)


def signers_from(document: Any) -> list[AllowedSigner]:
    """The signers of an allowed-signers document that has passed its schema.

    It checks each entry's shape again, because a committed version is validated against the schema
    committed with it, which any commit can change: an entry without a name, a role, a key type, a full
    fingerprint of that type or an added date raises ValueError, and then that version trusts no one.
    """
    items = document.get("signers") if isinstance(document, dict) else None
    if not isinstance(items, list):
        raise ValueError("signers is not a list")
    signers = []
    for number, item in enumerate(items):
        item = item if isinstance(item, dict) else {}
        name, roles, key_type, fingerprint, added = (item.get(k) for k in ("name", "roles", "key_type", "fingerprint", "added"))
        pattern = {"gpg": _GPG_FINGERPRINT, "ssh": _SSH_FINGERPRINT}.get(key_type) if isinstance(key_type, str) else None
        complete = (
            isinstance(name, str) and bool(name)
            and isinstance(roles, list) and bool(roles) and all(isinstance(r, str) and r for r in roles)
            and pattern is not None and isinstance(fingerprint, str) and pattern.fullmatch(fingerprint) is not None
            and isinstance(added, str) and bool(added)
        )
        if not complete:
            raise ValueError(f"signers/{number} is not a complete entry (name, roles, key_type, a full fingerprint of that type, added)")
        signers.append(AllowedSigner(name, tuple(roles), str(key_type), fingerprint, added))
    return signers


@dataclass
class SignerTrust:
    """What the history of allowed-signers.yaml lets the gate trust on this run."""

    signers: list[AllowedSigner] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    anchors: list[str] = field(default_factory=list)  # commits that added keys to a list that held none


# ---------------------------------------------------------------------------------------- authentication

# A commit id as git prints it: SHA-1, or SHA-256 in a repository that uses it.
_COMMIT_ID = re.compile(r"[0-9a-f]{40}(?:[0-9a-f]{24})?")
# What git's %G? can print.
_SIGNATURE_CODES = frozenset("GBUXYREN")

# Trusted "versions" that are not one version of the file (they never equal a blob id or None):
_CONFLICT = object()  # merged lines of history that trust different versions, until every side approves one
_AGREED = object()  # merged lines whose versions list the same signers in different texts
_UNKNOWN = object()  # the history before a commit cannot be read
_BLANK = object()  # a merge of lines on which the list has never held a key

# The signers a version lists as the trust rules read them: the name, roles, key type, fingerprint and
# added date of each entry, whatever their order, the comments or the layout of the text.
_Signers = frozenset[tuple[str, tuple[str, ...], str, str, str]]


def _signers_of(listed: tuple[AllowedSigner, ...] | None) -> _Signers | None:
    """The signer content of a version (None for a version that does not validate)."""
    if listed is None:
        return None
    return frozenset((s.name, tuple(sorted(s.roles)), s.key_type, normalise_fingerprint(s.fingerprint), s.added) for s in listed)


@dataclass(frozen=True)
class _Commit:
    """What the gate reads of one commit: git's verdict on its signature, the key, and the message."""

    signature: str  # %G?
    key: str  # %GF: the fingerprint of the signing key
    primary: str  # %GP: the fingerprint of its primary key, for a GPG subkey
    message: str  # %B, read only to look for an AI co-author trailer


@dataclass(frozen=True)
class _Trusted:
    """The trusted version of allowed-signers.yaml at one commit of its history, or the conflict between
    the trusted versions of merged lines of history (``sides``) that no version has settled yet."""

    blob: Any  # its blob id, None for no file, or one of the sentinels above
    listed: tuple[AllowedSigner, ...] | None  # the signers it lists; None if it does not validate or is not one version
    keepers: tuple[AllowedSigner, ...] | None  # the signers who may change it next; None if unknown
    since: str | None  # the commit that made it the trusted version (or the conflict's latest state); None before the file's history
    keyed: bool  # True once this line of history has trusted a key
    # Only in a conflict (blob _CONFLICT):
    sides: tuple[_Trusted, ...] = ()  # the trusted version of each side; every one must approve the version that settles it
    approvals: frozenset[tuple[_Signers, str]] = frozenset()  # (signer content, side's since): who has approved what
    opened: str | None = None  # the merge that brought these sides together
    notes: tuple[str, ...] = ()  # what each commit since then did, for the error messages

    @property
    def holds_no_key(self) -> bool:
        return self.keepers == () and not self.sides


_NO_FILE = _Trusted(None, (), (), None, False)


def _may_change(keepers: tuple[AllowedSigner, ...] | None, commit: _Commit) -> bool:
    """True if a commit has a good signature by a key that ``keepers`` lists. The list carries no role
    rule for its own changes: a listed key changes it whatever roles its holder signs records in."""
    return commit.signature == "G" and any(s.signed(commit.key, commit.primary) for s in keepers or ())


def _same_text(left: str | None, right: str | None) -> bool:
    """Compare two texts as YAML reads them, whatever line endings a checkout gave them."""

    def lines(text: str | None) -> str | None:
        return None if text is None else text.replace("\r\n", "\n").replace("\r", "\n")

    return lines(left) == lines(right)


class GitAuthenticator:
    """Authenticate sign-off records by git, against the allowed-signers list that git history supports.

    A record counts only if the working-tree file is the committed one, with no change that git status
    shows or that a flag (assume-unchanged, skip-worktree) hides, and every commit in its history
    (``git rev-list HEAD -- <record>``: the commits that wrote the committed content and every earlier
    version on that line of history) has a good signature (git %G? = G) by a key that the trusted list
    holds, for a signer whose name is the record's name and whose roles include the record's role, with
    no AI co-author trailer.

    The trusted list is the committed allowed-signers.yaml, as far as its history allows (trust()). The
    walk reads that history with ``git rev-list --full-history --parents``, so every merge is seen, and
    reads each commit's signature and message on its own, so a message cannot pose as another commit.
    Each version is validated against the schema committed with it. Then:

    - a commit that keeps the trusted version (a revert, a merge that keeps the newest side) needs nothing;
    - a commit that changes a trusted version holding no key needs no signature, and if it adds a key it
      is a trust anchor: reported as a warning, verified out of band (KA-011), and rejected if it carries
      an AI co-author trailer;
    - every other change needs a good signature by a key the trusted version before it lists, and no AI
      co-author trailer. The list carries no role rule for its own changes: a listed key counts whatever
      roles its holder signs records in;
    - a version that does not validate trusts no one, and the signers of the version before it stay in
      charge of the next change.

    A change that fails this is not trusted, and the trusted version stays the one before it; the gate
    fails until the committed list is the trusted version again (a revert) or a listed signer signs a new
    version.

    For a merge, the trusted version before it is the newest side's: that of the side whose trusted
    version was set by a commit that descends from every other side's. Lines on which the list never held
    a key do not count, and neither does a side whose version a trusted change on another side's line has
    replaced. A merge that keeps the newest side's version needs nothing; one that keeps an older side's
    version is a change like any other, so a removed key does not come back without a signature. Where no
    side is the newest, the merge is judged against the version every side holds, if they hold the same
    one; if they list the same signers in different texts, the merged text needs a signature by a key
    they list (or, if they list none, is a trust anchor when it adds a key). Otherwise the sides are in
    conflict.

    A conflict is settled, by the merge or by any later commit that changes the list, once every side has
    approved the signers of one version: a side approves the signers it already trusts, and any other
    signers through a commit with a good signature by a key that side lists and no AI co-author trailer.
    Approvals count for the signers, not the text, so a comment-only edit can carry a further one, and a
    change of signers starts them again; a commit with an AI co-author trailer or with a version that does
    not validate approves nothing. So the keys of one side cannot make a signer trusted that another side
    does not already trust, a side that lists no key approves only a list without keys, and a key listed
    on every side settles a conflict in one commit. Until it is settled, no signer is trusted, and the
    error names the sides whose approval the committed version lacks; a revert of the merge is a change
    like any other. A later merge with a third line that changed the list on its own makes that line one
    more side: of the open conflict, whose approvals so far stand, or of a new conflict with the version
    that settled it. Criss-cross and octopus merges follow the same rules, and the approvals given on each
    line count.

    ``runner`` replaces the git call in tests; ``trust`` replaces the history walk.
    """

    def __init__(
        self, root: Path, signers_path: Path, read_signers: SignersReader,
        runner: GitRunner | None = None, trust: SignerTrust | None = None, schema_path: Path | None = None,
    ) -> None:
        self.root = root
        self.signers_path = signers_path
        self.schema_path = schema_path or signers_path.with_name(ALLOWED_SIGNERS_SCHEMA_FILE)
        self.read_signers = read_signers
        self.run = runner or self._default_run
        self._trust = trust
        self._texts: dict[str, str | None] = {}
        self._versions: dict[tuple[str, str | None], tuple[tuple[AllowedSigner, ...] | None, list[str]]] = {}
        rel = self._relative(signers_path)
        self.signers_label = rel or signers_path.as_posix()

    def _default_run(self, *args: str, input: str | None = None) -> subprocess.CompletedProcess[str]:  # noqa: A002 - as subprocess
        # Bytes in and out, decoded here, so that no platform translates line endings on the way.
        completed = subprocess.run(
            ["git", "--no-replace-objects", "-C", str(self.root), *args],
            input=None if input is None else input.encode("utf-8"),
            capture_output=True,
            check=False,
        )
        return subprocess.CompletedProcess(
            completed.args, completed.returncode,
            completed.stdout.decode("utf-8", "replace"), completed.stderr.decode("utf-8", "replace"),
        )

    def _relative(self, path: Path) -> str | None:
        try:
            return path.resolve().relative_to(self.root.resolve()).as_posix()
        except ValueError:
            return None

    # ------------------------------------------------------------------ reading git

    def _blob(self, rev: str, rel: str) -> str | None:
        found = self.run("rev-parse", "--verify", "--quiet", f"{rev}:{rel}")
        if found.returncode != 0:
            return None
        return found.stdout.strip() or None

    def _text(self, blob: str) -> str | None:
        if blob not in self._texts:
            shown = self.run("cat-file", "blob", blob)
            self._texts[blob] = shown.stdout if shown.returncode == 0 else None
        return self._texts[blob]

    def _differs_from(self, blob: str | None, path: Path) -> bool:
        """True if the working-tree file is not the committed blob (None: no committed file)."""
        committed = None if blob is None else self._text(blob)
        if blob is not None and committed is None:
            return True
        try:
            current = path.read_text(encoding="utf-8") if path.is_file() else None
        except (OSError, UnicodeDecodeError):
            return True
        return not _same_text(current, committed)

    def _commit(self, sha: str) -> _Commit | None:
        """Read one commit on its own: NUL ends each field git computes, and the message comes last."""
        shown = self.run("log", "-1", "--no-show-signature", "--format=%G?%x00%GF%x00%GP%x00%B", sha, "--")
        fields = shown.stdout.split("\x00", 3) if shown.returncode == 0 else []
        if len(fields) != 4:
            return None
        signature = fields[0].strip()
        return _Commit(signature if signature in _SIGNATURE_CODES else "?", fields[1].strip(), fields[2].strip(), fields[3])

    @staticmethod
    def _history(text: str) -> list[tuple[str, tuple[str, ...]]] | None:
        """Parse ``rev-list --parents`` output: one commit and its parents per line; None if it is not that."""
        history = []
        for line in text.splitlines():
            ids = line.split()
            if not ids:
                continue
            if not all(_COMMIT_ID.fullmatch(i) for i in ids):
                return None
            history.append((ids[0], tuple(ids[1:])))
        return history

    def _paths_at(self, commits: list[str], rels: tuple[str, ...]) -> dict[tuple[str, str], str | None] | None:
        """The object id of each path at each commit (None where it does not exist), in one git call."""
        wanted = [(sha, rel) for sha in commits for rel in rels]
        found = self.run("cat-file", "--batch-check=%(objectname) %(objecttype)", input="".join(f"{s}:{r}\n" for s, r in wanted))
        lines = found.stdout.splitlines() if found.returncode == 0 else []
        if len(lines) != len(wanted):
            return None
        objects: dict[tuple[str, str], str | None] = {}
        for (sha, rel), line in zip(wanted, lines):
            parts = line.split()
            if line == f"{sha}:{rel} missing":
                objects[sha, rel] = None
            elif len(parts) == 2 and _COMMIT_ID.fullmatch(parts[0]):
                objects[sha, rel] = parts[0]  # a tree here is not a file: cat-file blob fails, so it does not validate
            else:
                return None
        return objects

    def _signers_in(self, blob: str | None, schema_blob: str | None, label: str) -> tuple[tuple[AllowedSigner, ...] | None, list[str]]:
        """The signers a committed version lists (() for no file), or None when it does not validate
        against the schema committed with it, and why."""
        if blob is None:
            return (), []
        key = (blob, schema_blob)
        if key not in self._versions:
            text = self._text(blob)
            schema = None if schema_blob is None else self._text(schema_blob)
            if text is None:
                self._versions[key] = None, [f"{label}: git cannot read it"]
            elif schema is None:
                self._versions[key] = None, [f"{label}: no {ALLOWED_SIGNERS_SCHEMA_FILE} is committed with it, so it cannot be validated"]
            else:
                signers, errors = self.read_signers(text, label, schema)
                self._versions[key] = (None if signers is None else tuple(signers)), errors
        return self._versions[key]

    # ------------------------------------------------------------------ the allowed-signers history

    def trust(self) -> SignerTrust:
        if self._trust is None:
            self._trust = self._walk()
        return self._trust

    def _walk(self) -> SignerTrust:
        trust = SignerTrust()
        rel, schema_rel = self._relative(self.signers_path), self._relative(self.schema_path)
        if rel is None or schema_rel is None:
            trust.errors.append(f"{self.signers_label}: the allowed-signers list or its schema is outside the repository; no signer is trusted")
            return trust
        try:
            probe = self.run("rev-parse", "--is-shallow-repository")
        except FileNotFoundError:
            trust.warnings.append(f"{rel}: git is not available, so the history of the list cannot be checked; no signer is trusted")
            return trust
        if probe.returncode != 0:
            reason = probe.stderr.strip() or "not a git repository"
            trust.warnings.append(f"{rel}: git cannot read the history of the list ({reason}); no signer is trusted")
            return trust
        head = self._blob("HEAD", rel)
        if self._differs_from(head, self.signers_path):
            trust.warnings.append(f"{rel}: has uncommitted changes or is not committed; the check trusts only the committed version")
        if probe.stdout.strip() == "true":
            listed, _errors = self._signers_in(head, self._blob("HEAD", schema_rel), f"{rel} at HEAD")
            message = f"{rel}: this is a shallow clone, so the history of the list cannot be checked; no signer is trusted (fetch the full history)"
            (trust.errors if listed is None or listed else trust.warnings).append(message)
            return trust

        listing = self.run("rev-list", "--full-history", "--parents", "--topo-order", "--reverse", "HEAD", "--", rel)
        if listing.returncode != 0:
            if head is not None:
                trust.errors.append(f"{rel}: git rev-list failed ({listing.stderr.strip()}); no signer is trusted")
            return trust
        history = self._history(listing.stdout)
        if history == [] and head is None:
            return trust  # the list has never been committed
        objects = None if not history else self._paths_at([sha for sha, _ in history], (rel, schema_rel))
        if not history or objects is None:
            trust.errors.append(f"{rel}: git did not list the history of the list as expected; no signer is trusted")
            return trust
        graph = dict(history)
        state: dict[str, _Trusted] = {}
        rejected: list[str] = []
        for sha, parents in history:
            before = self._before(sha, [state.get(p) for p in parents], graph) if parents else _NO_FILE
            blob = objects[sha, rel]
            if before.sides:  # merged lines of history trust different versions: this commit may approve one
                listed, _errors = self._signers_in(blob, objects[sha, schema_rel], f"{rel} at {sha[:12]}")
                state[sha] = self._approve(sha, len(parents) > 1, before, blob, listed)
                if not state[sha].sides:
                    keys = ", ".join(s.fingerprint for s in listed or ()) or "no key"
                    settled = (
                        f"merge {sha[:12]} settled the conflict between the lines it merged" if before.opened == sha
                        else f"commit {sha[:12]} settled the conflict that merge {str(before.opened)[:12]} opened"
                    )
                    trust.warnings.append(
                        f"{rel}: {settled}: every side of it has approved the signers this version lists ({keys})"
                    )
                continue
            if blob == before.blob:  # the trusted version, kept or restored (a sentinel never matches)
                state[sha] = before
                continue
            listed, _errors = self._signers_in(blob, objects[sha, schema_rel], f"{rel} at {sha[:12]}")
            problem, anchor = self._judge(sha, before, listed)
            if problem is not None:
                state[sha] = before
                rejected.append(f"commit {sha[:12]} {problem}")
                continue
            keepers = before.keepers if listed is None else listed
            state[sha] = _Trusted(blob, listed, keepers, sha, before.keyed or bool(listed))
            if anchor and listed:
                trust.anchors.append(sha)
                trust.warnings.append(
                    f"{rel}: commit {sha[:12]} is a trust anchor: it lists {', '.join(s.fingerprint for s in listed)} "
                    "where the trusted list held no key, and nothing in the repository shows who made it; the reviewer "
                    "and the human verify each fingerprint with its holder out of band (KA-011)"
                )
        trusted = state[history[-1][0]]
        if trusted.sides:
            trust.errors.extend(f"{rel}: {note}" for note in trusted.notes)
            trust.errors.append(self._conflict_error(rel, trusted))
            trust.warnings.extend(f"{rel}: {item}; that change is not trusted" for item in rejected)
            return trust
        if trusted.blob != head:
            for item in rejected or ["the committed version is not the one its history supports"]:
                trust.errors.append(
                    f"{rel}: {item}; after the trust anchor every change must be signed by a key that the trusted version "
                    "before it lists. No signer is trusted until the list is back at its trusted version (a revert) or a "
                    "listed signer signs a new one"
                )
            return trust
        if trusted.listed is None:
            _listed, reasons = self._signers_in(head, objects[trusted.since, schema_rel], f"{rel} at HEAD") if trusted.since else (None, [])
            trust.errors.append(
                f"{rel}: the committed version does not validate against the schema committed with it; no signer is trusted"
                + (f" ({'; '.join(reasons)[:600]})" if reasons else "")
            )
            return trust
        for item in rejected:
            trust.warnings.append(f"{rel}: {item}; that change is not trusted, and the committed version is the last trusted one")
        trust.signers = list(trusted.listed)
        return trust

    def _before(self, sha: str, states: list[_Trusted | None], graph: dict[str, tuple[str, ...]]) -> _Trusted:
        """The trusted version that a commit changes: its parent's; for a merge, the newest side's, the
        version every side holds, or the conflict between the sides' versions."""
        if any(s is None or s.keepers is None for s in states):
            return _Trusted(_UNKNOWN, None, None, sha, True)
        distinct = list({s.since: s for s in states}.values())
        keyed = [s for s in distinct if s.keyed]
        if not keyed:  # the list has never held a key on any side
            return self._newest(distinct, graph) or _Trusted(_BLANK, (), (), sha, False)
        newest = self._newest(keyed, graph)
        if newest is not None:
            return newest
        # The sides: the trusted version of each line (a conflict brings its own sides, and the approvals
        # they have given), less any version that a trusted change on another side's line has replaced.
        found = {side.since: side for s in keyed for side in (s.sides or (s,))}
        sides = [s for s in found.values() if not any(o is not s and self._descends(graph, s.since, o.since) for o in found.values())]
        first = sides[0]
        if len(sides) == 1:
            return first
        if all(s.listed is not None for s in sides):
            if all(s.blob == first.blob for s in sides):
                return _Trusted(first.blob, first.listed, first.listed, sha, True)  # the same version on every side
            if len({_signers_of(s.listed) for s in sides}) == 1:
                return _Trusted(_AGREED, first.listed, first.listed, sha, True)  # the same signers in different texts
        current = {s.since for s in sides}
        approvals = frozenset(a for s in keyed for a in s.approvals if a[1] in current)
        notes = tuple(dict.fromkeys(note for s in keyed for note in s.notes))
        return _Trusted(_CONFLICT, None, (), sha, True, tuple(sides), approvals, sha, notes)

    def _newest(self, sides: list[_Trusted], graph: dict[str, tuple[str, ...]]) -> _Trusted | None:
        """The side whose trusted version was set by a commit that descends from every other side's, if any."""
        for side in sides:
            if all(self._descends(graph, other.since, side.since) for other in sides if other is not side):
                return side
        return None

    @staticmethod
    def _descends(graph: dict[str, tuple[str, ...]], older: str | None, newer: str | None) -> bool:
        """True if ``newer`` is ``older`` or one of its descendants (None: before the history of the list)."""
        if older is None or older == newer:
            return True
        if newer is None:
            return False
        seen, todo = {newer}, [newer]
        while todo:
            for parent in graph.get(todo.pop(), ()):
                if parent == older:
                    return True
                if parent not in seen:
                    seen.add(parent)
                    todo.append(parent)
        return False

    def _judge(self, sha: str, before: _Trusted, listed: tuple[AllowedSigner, ...] | None) -> tuple[str | None, bool]:
        """Why a change from the trusted version ``before`` is not trusted (None if it is), and whether it
        is a trust anchor (it adds a key where the trusted list held none)."""
        if before.keepers is None:
            return "changed the list but the history before it cannot be read", False
        if before.holds_no_key and not listed:
            return None, False  # from a list with no key to another one (or to an invalid one): it trusts no one
        commit = self._commit(sha)
        if commit is None:
            return "changed the list but git cannot show the commit", False
        trailer = _AI_TRAILER.search(commit.message) is not None
        if before.holds_no_key:
            if trailer:
                return "changed the list to add a key in a commit that carries an AI co-author trailer; only a human adds a signer", False
            return None, True
        if trailer:
            return "changed the list in a commit that carries an AI co-author trailer", False
        if commit.signature != "G":
            return f"changed the list without a good signature (git %G? = {commit.signature or '?'})", False
        if not _may_change(before.keepers, commit):
            return f"changed the list in a commit signed by key {commit.key or '?'}, which the version before it does not list", False
        return None, False

    def _approve(self, sha: str, merge: bool, before: _Trusted, blob: str | None, listed: tuple[AllowedSigner, ...] | None) -> _Trusted:
        """A commit while merged lines of history trust different versions of the list (``before.sides``):
        the approvals it gives the signers of its version, and the trusted version it makes once every side
        has approved those signers.

        A side approves the signers it already trusts (its own version's), and any other signers through a
        commit with a good signature by a key the side lists and no AI co-author trailer; a side that lists
        no key therefore approves only a list without keys. Approvals count for one signer content: a
        commit that changes the signers starts them again, and a comment-only edit keeps them. A commit
        with an AI co-author trailer, or with a version that does not validate, approves nothing.
        """
        what = "merged lines of history that trust different versions of the list" if merge else "changed the list while its history is in conflict"
        signers = _signers_of(listed)
        approved = {side for content, side in before.approvals if content == signers} if signers is not None else set()
        commit = self._commit(sha)
        if signers is None:
            note = f"{what}, to a version that does not validate, which no side can approve"
        elif commit is None:
            note = f"{what}, but git cannot show the commit, so it approves nothing"
        elif _AI_TRAILER.search(commit.message):
            note = f"{what} in a commit that carries an AI co-author trailer, which approves nothing"
        else:
            by_key = {s.since for s in before.sides if _may_change(s.keepers, commit)}
            approved |= by_key | {s.since for s in before.sides if _signers_of(s.listed) == signers}
            if approved >= {s.since for s in before.sides}:
                return _Trusted(blob, listed, listed, sha, True)
            if commit.signature != "G":
                note = f"{what} without a good signature (git %G? = {commit.signature or '?'})"
            elif not by_key:
                note = f"{what} in a commit signed by key {commit.key or '?'}, which no side lists"
            else:
                note = (
                    f"{what} in a commit signed by key {commit.key or '?'}, which not every side lists: it approves "
                    "this version only for the sides that list that key"
                )
        return replace(
            before, since=sha, notes=(*before.notes, f"commit {sha[:12]} {note}"),
            approvals=frozenset((signers, side) for side in approved) if signers is not None else frozenset(),
        )

    def _conflict_error(self, rel: str, conflict: _Trusted) -> str:
        """What a conflict at HEAD means, and exactly what settles it."""

        def side(s: _Trusted) -> str:
            keys = ", ".join(k.fingerprint for k in s.keepers or ())
            if s.listed is None:
                return f"the version of commit {str(s.since)[:12]}, which does not validate (the keys of the version before it approve for it: {keys or 'none'})"
            if not keys:
                return f"the version of commit {str(s.since)[:12]}, which lists no key"
            return f"the version of commit {str(s.since)[:12]}, which lists {keys}"

        approved = {s for _content, s in conflict.approvals}
        missing = [side(s) for s in conflict.sides if s.since not in approved]
        return (
            f"{rel}: no signer is trusted, because merge {str(conflict.opened)[:12]} joined lines of history that trust "
            f"different versions of the list ({'; '.join(side(s) for s in conflict.sides)}), and no version since has "
            "the approval of every side. Short of rewriting history, only that approval restores trust; a revert of the "
            "merge is a change like any other. A side approves the signers it already trusts, and other signers through "
            "a commit that sets the list to them with a good signature by a key that side lists and no AI co-author "
            "trailer (a commit that edits only a comment is enough); a side that lists no key approves only a list "
            f"without keys. The committed version still needs the approval of: {'; '.join(missing)}"
        )

    # ------------------------------------------------------------------ records

    def __call__(self, record: SignoffRecord) -> list[str]:
        rel = self._relative(record.path)
        if rel is None:
            return [f"{record.path}: sign-off record is outside the repository; it cannot be authenticated"]
        try:
            status = self.run("status", "--porcelain", "--", rel)
        except FileNotFoundError:
            return [f"{rel}: git is not available, so the sign-off record cannot be authenticated"]
        if status.returncode != 0:
            return [f"{rel}: git cannot inspect the record ({status.stderr.strip() or 'not a git repository'})"]
        if status.stdout.strip():
            return [f"{rel}: sign-off record is untracked or has uncommitted changes; only a committed, signed record counts"]
        committed = self._blob("HEAD", rel)
        if committed is None:
            return [f"{rel}: sign-off record is not in any commit; it must be added in a signed commit"]
        if self._differs_from(committed, record.path):
            return [
                f"{rel}: sign-off record differs from the committed one although git status shows no change "
                "(assume-unchanged or skip-worktree hides it); only the committed, signed record counts"
            ]
        listing = self.run("rev-list", "HEAD", "--", rel)
        history = self._history(listing.stdout) if listing.returncode == 0 else None
        if not history:
            return [f"{rel}: git did not list the commits of the record ({listing.stderr.strip() or 'no commit'})"]
        signers = self.trust().signers
        if not signers:
            return [
                f"{rel}: no signer is trusted in {self.signers_label} (it lists none, or its history does not allow "
                "the list), so no sign-off record can authorise anything; only a human adds a signer (KA-011)"
            ]
        errors = []
        for sha, _parents in history:
            short = sha[:12]
            commit = self._commit(sha)
            if commit is None:
                errors.append(f"{rel}: git cannot show commit {short}, which touches the sign-off record")
                continue
            if _AI_TRAILER.search(commit.message):
                errors.append(f"{rel}: commit {short} carries an AI co-author trailer; the agent never writes sign-off records")
            if commit.signature != "G":
                hint = _SIGNATURE_HINTS.get(commit.signature, "no valid signature")
                errors.append(
                    f"{rel}: commit {short} touching the sign-off record has no good signature (git %G? = {commit.signature}: "
                    f"{hint}); records must be added in a commit signed by the named person with a key listed in "
                    f"{self.signers_label}"
                )
                continue
            signer = next((s for s in signers if s.signed(commit.key, commit.primary)), None)
            if signer is None:
                errors.append(
                    f"{rel}: commit {short} touching the sign-off record is signed by key {commit.key}, which {self.signers_label} "
                    "does not list; only a listed signer's key authenticates a record"
                )
                continue
            if record.name != signer.name:
                errors.append(
                    f"{rel}: commit {short} is signed by the key of {signer.name!r}, but the record names {record.name!r}; "
                    "a person signs only records in their own name"
                )
            if record.role not in signer.roles:
                errors.append(
                    f"{rel}: commit {short} is signed by {signer.name!r}, who is listed for {', '.join(signer.roles)}, "
                    f"not for the record's role {record.role!r}"
                )
            if record.signer_key and normalise_fingerprint(record.signer_key) not in {
                normalise_fingerprint(f) for f in (commit.key, commit.primary, signer.fingerprint) if f
            }:
                errors.append(f"{rel}: authentication.signer_key {record.signer_key!r} is not the key that signed commit {short}")
        return errors


def iter_record_files(directory: Path) -> Iterator[Path]:
    """The sign-off records in a directory: its YAML files except allowed-signers.yaml."""
    if not directory.is_dir():
        return iter(())
    return iter(
        sorted(
            p for p in directory.iterdir()
            if p.is_file() and p.suffix in (".yaml", ".yml") and p.name != ALLOWED_SIGNERS_FILE
        )
    )
