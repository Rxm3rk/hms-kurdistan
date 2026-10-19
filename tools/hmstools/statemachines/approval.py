"""Rule 13 of spec §2.1 (KA-013): a changed spec keeps no approval.

For every sign-off record under docs/safety/signoffs/ whose ``subject`` is the machine and whose
``subject_version`` equals the spec's current ``version``, the spec's canonical content (§2.2) at each commit
that added the record must equal its canonical content now. A record that no commit has added fails ("record
not committed"); so does a spec that did not exist at that commit, or that does not parse there. The
records are read as the safety gate reads them (hmstools.safety); whether a record is valid and authentic is
the safety gate's rule, not this one. Git runs without replace refs, and the history read is that of the
record's own path (``--no-renames``: a record moved into place counts as added where it was moved).
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


def run_git(root: Path, args: list[str]) -> tuple[int, str, str]:
    env = {**os.environ, "GIT_NO_REPLACE_OBJECTS": "1", "GIT_TERMINAL_PROMPT": "0"}
    try:
        done = subprocess.run(
            ["git", "-c", "core.quotepath=off", "-C", str(root), *args],
            capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, check=False,
        )
    except OSError as exc:
        return 127, "", str(exc)
    return done.returncode, done.stdout, done.stderr


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
