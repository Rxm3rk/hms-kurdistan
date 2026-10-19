"""Rule 13 of spec §2.1 (KA-013): a changed spec keeps no approval.

For every sign-off record under docs/safety/signoffs/ whose ``subject`` is the machine and whose
``subject_version`` equals the spec's current ``version``, the spec's canonical content (§2.2) at each commit
that added the record must equal its canonical content now. A record that no commit has added fails ("record
not committed"); so does a spec that did not exist at that commit, or that does not parse there. The
records are read as the safety gate reads them (hmstools.safety); whether a record is valid and authentic is
the safety gate's rule, not this one. Git runs as the safety gate runs it (hmstools.safety.signoffs,
GitAuthenticator): without replace refs, grafts or the commit-graph file, so the history read is the one the
commits record. The history read is that of the record's own path (``--no-renames``: a record moved into place
counts as added where it was moved). When any record applies, a shallow clone fails: its boundary commit looks
as if it added every file, so the content each record approved cannot be read.

gate_verdict() reads the safety gate's own verdict on a spec's filled approval fields, for rule 9 (rules.py).
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from hmstools.safety import signoffs as so
from hmstools.statemachines.loader import SpecLoadError, canonical_text, load_spec_text

# Runs git with arguments in the repository root; returns (exit code, stdout, stderr).
GitRunner = Callable[[Path, list[str]], "tuple[int, str, str]"]


# The safety gate's git settings (hmstools.safety.signoffs, GitAuthenticator._default_run): no replace refs, no
# grafts (GIT_GRAFT_FILE names the null device, which holds none) and no commit-graph file, a local cache that
# could give a commit other parents. Each changes the history git shows without changing a commit.
GIT_ARGS = ("git", "--no-replace-objects", "-c", "core.commitGraph=false", "-c", "core.quotepath=off")
GIT_ENV = {"GIT_GRAFT_FILE": os.devnull, "GIT_NO_REPLACE_OBJECTS": "1", "GIT_TERMINAL_PROMPT": "0"}


def run_git(root: Path, args: list[str]) -> tuple[int, str, str]:
    try:
        done = subprocess.run(
            [*GIT_ARGS, "-C", str(root), *args], capture_output=True, env={**os.environ, **GIT_ENV}, check=False,
        )
    except OSError as exc:
        return 127, "", str(exc)
    # Bytes in and out, decoded here, so that no platform translates line endings on the way.
    return done.returncode, done.stdout.decode("utf-8", "replace"), done.stderr.decode("utf-8", "replace")


@dataclass
class Record:
    path: Path
    rel: str
    data: dict[str, Any]

    @property
    def id(self) -> str:
        return str(self.data.get("id", self.path.stem))


def load_records(root: Path, signoffs_dir: Path) -> tuple[list[Record], list[str]]:
    """The records (YAML files except allowed-signers.yaml), read with the safety gate's loader, and the
    files that cannot be read (rule 13 cannot tell which subject such a file approves, so it fails)."""
    from hmstools.safety.check import _normalise, _strict_yaml_load  # noqa: PLC0415 - the gate's own reading

    records, errors = [], []
    for path in so.iter_record_files(signoffs_dir):
        rel = path.relative_to(root).as_posix() if path.is_relative_to(root) else path.as_posix()
        try:
            data = _normalise(_strict_yaml_load(path))
        except Exception as exc:  # noqa: BLE001 - any reading failure fails closed
            errors.append(f"rule 13: {rel} cannot be read ({' '.join(str(exc).split())}), so no spec can show it does not approve it")
            continue
        if not isinstance(data, dict):
            errors.append(f"rule 13: {rel} is not a mapping, so no spec can show it does not approve it")
            continue
        records.append(Record(path, rel, data))
    return records, errors


def rule_13(
    machine: str, version: Any, spec_rel: str, current_canonical: str, records: list[Record], root: Path,
    git: GitRunner = run_git,
) -> tuple[list[str], int]:
    """The failures, and how many records apply to this machine at its current version."""
    errors: list[str] = []
    applying = [
        r for r in records
        if str(r.data.get("subject")) == machine and str(r.data.get("subject_version")) == str(version)
    ]
    if applying:
        code, out, err = git(root, ["rev-parse", "--is-shallow-repository"])
        if code != 0:
            return [
                f"rule 13: {len(applying)} approval record(s) apply to {machine} version {version}, but the git history cannot "
                f"be read: {err.strip() or 'not a git repository'}"
            ], len(applying)
        if out.strip() != "false":  # "true", or anything else this git prints: fail closed
            listed = ", ".join(r.id for r in sorted(applying, key=lambda r: r.rel))
            return [
                f"rule 13: shallow clone: the content each approval record approved cannot be read ({listed} for {machine} "
                f"version {version}); fetch the full history"
            ], len(applying)
    for record in sorted(applying, key=lambda r: r.rel):
        code, out, err = git(root, ["log", "--no-renames", "--diff-filter=A", "--format=%H", "--", record.rel])
        if code != 0:
            errors.append(f"rule 13: approval record {record.id} ({record.rel}): the git history cannot be read: {err.strip()}")
            continue
        commits = [line.strip() for line in out.splitlines() if line.strip()]
        if not commits:
            errors.append(
                f"rule 13: approval record {record.id} ({record.rel}) for {machine} version {version}: record not committed, "
                "so the spec it approved cannot be read"
            )
            continue
        for commit in commits:
            code, text, err = git(root, ["show", f"{commit}:{spec_rel}"])
            if code != 0:
                errors.append(
                    f"rule 13: approval record {record.id}: {spec_rel} did not exist at commit {commit[:12]}, which added the "
                    "record, so the approved content is unknown"
                )
                continue
            try:
                approved = canonical_text(load_spec_text(text))
            except SpecLoadError as exc:
                errors.append(f"rule 13: approval record {record.id}: {spec_rel} at commit {commit[:12]} does not parse: {exc}")
                continue
            if approved != current_canonical:
                errors.append(
                    f"rule 13: content changed since approval record {record.id} without a version bump ({spec_rel} at "
                    f"version {version} differs from its content at commit {commit[:12]}, which added the record)"
                )
    return errors, len(applying)


def gate_verdict(
    document: Any, spec_label: str, machine: str, root: Path, signoffs_dir: Path, authenticate: Any = None,
) -> list[str]:
    """The safety gate's verdict on the filled approval fields of one spec (rule 9 defers to it, spec §2.1).

    Every filled field must be backed by a sign-off record that the gate accepts: valid against the record
    schema, authenticated by its signed commits against allowed-signers.yaml, not withdrawn, for the spec's
    current version, in a required role, and matching the field's value. This runs the gate's own code
    (hmstools.safety.check._load_signoffs, signoffs.withdrawals and signoffs.match_gate_field), so rule 9 and
    ``sh tools/hms safety check`` cannot disagree. Returns the gate's errors (empty when every field is backed).
    ``authenticate`` replaces the gate's git authentication in tests.
    """
    from hmstools.common import CheckResult  # noqa: PLC0415
    from hmstools.safety import check as gate  # noqa: PLC0415 - the gate's own reading

    paths = gate.SafetyPaths.for_root(root)
    paths.signoffs_dir = signoffs_dir
    paths.signoff_schema = signoffs_dir / "signoff.schema.json"
    paths.allowed_signers = signoffs_dir / so.ALLOWED_SIGNERS_FILE
    paths.allowed_signers_schema = signoffs_dir / so.ALLOWED_SIGNERS_SCHEMA_FILE
    if authenticate is None:
        authenticate = so.GitAuthenticator(
            root, paths.allowed_signers, gate._signers_reader(paths), schema_path=paths.allowed_signers_schema,  # noqa: SLF001
        )
    result = CheckResult("safety")
    try:
        records, removed = gate._load_signoffs(paths, authenticate, result)  # noqa: SLF001
    except Exception as exc:  # noqa: BLE001 - any failure of the gate's reading fails closed
        return [f"the sign-off records cannot be read as the safety gate reads them: {' '.join(str(exc).split())}"]
    withdrawn, problems = so.withdrawals([*records, *removed], lambda record: paths.label(record.path))
    errors = [*result.errors, *problems]
    fields = so.scan_gate_fields(document, spec_label, machine).fields
    if not fields:
        errors.append("the safety gate finds no filled approval field in the spec, so it backs none")
    for gate_field in fields:
        error = so.match_gate_field(gate_field, records, withdrawn)
        if error:
            errors.append(error)
    return errors
