"""The repository rules. Each rule takes the repository root and adds to a CheckResult.

(a) no CRLF in text files (tracked and untracked; .gitattributes binary patterns and .gitignore honoured);
(b) the programme control files exist; every ADR file follows template B.1, the numbers run without a gap from
    ADR-001 (the §4.2 baseline is ADR-001 to ADR-028), and the index docs/adr/README.md links every ADR;
(c) no registered tenant identifier, name, hostname or pattern in source or configuration (§6.2, §6.8 #8);
(d) branch names follow §3.6 and never name a tenant (branch-per-tenant detector, §6.8 #8);
(e) DECISIONS-NEEDED.md "Blocking now" has at most ten items; STATUS.md has at most 150 lines (§3.1).
"""

from __future__ import annotations

import fnmatch
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Optional

from ..common import CheckResult, load_yaml

REQUIRED_FILES = [
    "docs/program/STATUS.md",
    "docs/program/BACKLOG.md",
    "docs/program/WORK-PACKAGES.md",
    "docs/program/DECISIONS-NEEDED.md",
    "docs/program/OPEN-QUESTIONS.md",
    "docs/program/ASSUMPTIONS.md",
    "docs/program/COMMANDS.md",
    "docs/program/KNOWN-ANOMALIES.md",
    "docs/program/backlog.yaml",
    "docs/safety/hazard-log.yaml",
    "CHANGELOG.md",
]
ADR_NUMBERS = range(1, 29)  # the §4.2 baseline
ADR_FILE = re.compile(r"^ADR-(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
ADR_INDEX = "docs/adr/README.md"
ADR_PROVISIONAL = {1, 9}  # §4.2: accepted-provisional until the reference-cell spike criteria pass
ADR_HEADINGS = ["Context", "Decision", "Consequences", "Fitness test", "Reopen if"]
ADR_STATUSES = re.compile(r"^(proposed|accepted-provisional|accepted|superseded by ADR-\d{3})\b", re.I)

# The plan of record is read-only for the build (§2, §3.6, §6.1). CRLF found there is reported as a
# warning: the build may not rewrite those files; a human decides whether to renormalise them.
PLAN_OF_RECORD = [
    "BUILD-PROMPT.md",
    "BLUEPRINT.md",
    "BLUEPRINT-KURDISTAN.md",
    "BLUEPRINT-KURDISTAN.pdf",
    "README.md",
    "research/*",
    "assets/*",
]

STATUS_MAX_LINES = 150
BLOCKING_NOW_MAX = 10
TENANT_CONFIG = Path("tools/config/tenant-identifiers.yaml")
BRANCH_PATTERNS = [
    re.compile(r"^main$"),
    re.compile(r"^wp/\d+\.\d+[a-z]?-[a-z0-9]+(?:-[a-z0-9]+)*$"),
    re.compile(r"^release/[vVrR]?\d+(?:\.\d+)*[a-z]?(?:[-+.][0-9A-Za-z]+)*$"),
    re.compile(r"^hotfix/[a-z0-9]+(?:[-.][a-z0-9]+)*$"),
]
BRANCH_FORBIDDEN_WORDS = ["customer", "tenant", "client"]


class RepoError(RuntimeError):
    """The repository could not be inspected (for example git is missing)."""


def git(root: Path, *args: str, stdin: Optional[bytes] = None) -> bytes:
    try:
        proc = subprocess.run(
            ["git", "-C", str(root), *args],
            input=stdin,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError as exc:
        raise RepoError(f"git is not available: {exc}") from exc
    if proc.returncode != 0:
        raise RepoError(f"git {' '.join(args)} failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
    return proc.stdout


def in_plan_of_record(path: str) -> bool:
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in PLAN_OF_RECORD)


# --------------------------------------------------------------------------- (a) CRLF


def working_tree_files(root: Path) -> list[str]:
    """Tracked and untracked files, honouring .gitignore (paths relative to root, '/' separators)."""
    out = git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
    return sorted({p for p in out.decode("utf-8", "surrogateescape").split("\0") if p})


def attributes(root: Path, paths: list[str]) -> dict[str, dict[str, str]]:
    if not paths:
        return {}
    data = "\0".join(paths).encode("utf-8", "surrogateescape") + b"\0"
    out = git(root, "check-attr", "-z", "--stdin", "binary", "text", "eol", stdin=data)
    fields = out.decode("utf-8", "surrogateescape").split("\0")
    result: dict[str, dict[str, str]] = {}
    for i in range(0, len(fields) - 2, 3):
        result.setdefault(fields[i], {})[fields[i + 1]] = fields[i + 2]
    return result


def check_crlf(root: Path, result: CheckResult) -> None:
    files = working_tree_files(root)
    attrs = attributes(root, files)
    checked = binary = crlf_plan = 0
    offenders = []
    for path in files:
        attr = attrs.get(path, {})
        if attr.get("binary") == "set" or attr.get("text") == "unset" or attr.get("eol") == "crlf":
            binary += 1
            continue
        full = root / path
        if not full.is_file() or full.is_symlink():
            continue
        data = full.read_bytes()
        if b"\0" in data[:8000]:  # git's own binary heuristic
            binary += 1
            continue
        checked += 1
        if b"\r\n" in data:
            if in_plan_of_record(path):
                crlf_plan += 1
                result.warnings.append(
                    f"crlf: {path} has CRLF line endings; it is plan of record (read-only for the build), "
                    "so a human decides whether to renormalise it"
                )
            else:
                offenders.append(path)
    for path in offenders:
        result.errors.append(f"crlf: {path} has CRLF line endings (text files must use LF; see .gitattributes)")
    result.counts.update(
        {"text_files_checked": checked, "binary_files_skipped": binary, "crlf_files": len(offenders),
         "crlf_plan_of_record": crlf_plan}
    )


# --------------------------------------------------------------------------- (b) required files and ADRs

_FIELD = r"^\s*(?:[-*]\s+)?(?:\*\*)?{name}(?:\*\*)?\s*:\s*(?:\*\*)?\s*(?P<value>.*?)\s*$"


def adr_problems(number: int, text: str) -> list[str]:
    problems = []
    status = re.search(_FIELD.format(name="Status"), text, re.M | re.I)
    if not status:
        problems.append("no 'Status:' line")
    else:
        value = status.group("value").strip("* ")
        if not ADR_STATUSES.match(value):
            problems.append(f"status {value!r} is not proposed, accepted, accepted-provisional or superseded by ADR-nnn")
        elif number in ADR_PROVISIONAL and not re.match(r"^(accepted-provisional|superseded)", value, re.I):
            problems.append(f"status {value!r}: §4.2 keeps ADR-{number:03d} accepted-provisional until the reference-cell run")
    date = re.search(_FIELD.format(name="Date"), text, re.M | re.I)
    if not date:
        problems.append("no 'Date:' line")
    elif not re.match(r"\d{4}-\d{2}-\d{2}\b", date.group("value").strip("* ")):
        problems.append(f"date {date.group('value')!r} is not yyyy-mm-dd")
    for heading in ADR_HEADINGS:
        if not re.search(rf"^#{{2,6}}\s+{re.escape(heading)}\b", text, re.M | re.I):
            problems.append(f"no '## {heading}' heading")
    return problems


def check_required(root: Path, result: CheckResult) -> None:
    present = 0
    for name in REQUIRED_FILES:
        if (root / name).is_file():
            present += 1
        else:
            result.errors.append(f"required: {name} is missing (§3.1)")
    adr_dir = root / "docs" / "adr"
    found: dict[int, list[Path]] = {}
    for path in sorted(adr_dir.glob("ADR-*.md")) if adr_dir.is_dir() else []:
        match = ADR_FILE.match(path.name)
        if not match:
            result.errors.append(f"adr: docs/adr/{path.name}: the name is not ADR-nnn-<lower-case-slug>.md (template B.1)")
            continue
        found.setdefault(int(match.group(1)), []).append(path)
    highest = max([ADR_NUMBERS[-1], *found])
    index_path = root / ADR_INDEX
    index = index_path.read_text(encoding="utf-8", errors="replace") if index_path.is_file() else None
    if index is None:
        result.errors.append(f"adr: {ADR_INDEX} (the ADR index) is missing")
    good = 0
    for number in range(1, highest + 1):
        matches = found.get(number, [])
        if not matches:
            reason = "§4.2 baseline" if number in ADR_NUMBERS else f"ADR numbers run without a gap up to ADR-{highest:03d}"
            result.errors.append(f"adr: docs/adr/ADR-{number:03d}-*.md is missing ({reason})")
            continue
        if len(matches) > 1:
            result.errors.append(f"adr: more than one file for ADR-{number:03d}: {', '.join(m.name for m in matches)}")
            continue
        problems = [f"{p} (template B.1)" for p in adr_problems(number, matches[0].read_text(encoding="utf-8", errors="replace"))]
        if index is not None and f"({matches[0].name})" not in index:
            problems.append(f"not linked from {ADR_INDEX}")
        for problem in problems:
            result.errors.append(f"adr: docs/adr/{matches[0].name}: {problem}")
        if not problems:
            good += 1
    result.counts.update({"required_files_present": present, "adrs_total": highest, "adrs_valid": good})


# --------------------------------------------------------------------------- (c) tenant identifiers


def load_tenant_config(root: Path) -> dict[str, Any]:
    path = root / TENANT_CONFIG
    if not path.is_file():
        raise RepoError(f"{TENANT_CONFIG.as_posix()} is missing")
    data = load_yaml(path) or {}
    if not isinstance(data, dict) or not isinstance(data.get("scan"), dict):
        raise RepoError(f"{TENANT_CONFIG.as_posix()} has no 'scan' section")
    return data


def tenant_literals(config: dict[str, Any]) -> list[str]:
    literals = []
    for tenant in config.get("tenants") or []:
        literals.append(str(tenant["id"]))
        literals += [str(n) for n in tenant.get("names") or []]
        literals += [str(h) for h in tenant.get("hostnames") or []]
    return [x for x in literals if x.strip()]


def tenant_matchers(config: dict[str, Any]) -> list[tuple[str, re.Pattern[str]]]:
    matchers = []
    for literal in tenant_literals(config):
        words = [re.escape(part) for part in re.split(r"\s+", literal.strip())]
        pattern = r"[\s_-]+".join(words)  # a name matches with spaces, hyphens or underscores between words
        matchers.append((literal, re.compile(rf"(?<![A-Za-z0-9]){pattern}(?![A-Za-z0-9])", re.I)))
    for entry in config.get("patterns") or []:
        matchers.append((f"pattern {entry['id']}", re.compile(str(entry["regex"]))))
    return matchers


def scan_files(root: Path, scan: dict[str, Any]) -> list[Path]:
    excluded = set(scan.get("exclude_dirs") or [])
    extensions = {e.lower() for e in scan.get("extensions") or []}
    filenames = set(scan.get("filenames") or [])
    found = []
    for name in scan.get("roots") or []:
        base = root / name
        if not base.is_dir():
            continue
        for directory, dirnames, files in os.walk(base):
            dirnames[:] = sorted(d for d in dirnames if d not in excluded)
            for file in sorted(files):
                path = Path(directory) / file
                if file in filenames or path.suffix.lower() in extensions or file.lower().startswith(".env"):
                    found.append(path)
    return found


def check_tenants(root: Path, result: CheckResult, config: dict[str, Any]) -> None:
    matchers = tenant_matchers(config)
    allow = [str(x) for x in (config["scan"].get("allow") or [])]
    scanned = hits = 0
    for path in scan_files(root, config["scan"]):
        rel = path.relative_to(root).as_posix()
        if any(fnmatch.fnmatchcase(rel, pattern) for pattern in allow):
            continue
        data = path.read_bytes()
        if b"\0" in data[:8000]:
            continue
        scanned += 1
        text = data.decode("utf-8", errors="replace")
        for label, regex in matchers:
            for match in regex.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                hits += 1
                result.errors.append(
                    f"tenant: {rel}:{line}: '{match.group(0)}' matches registered tenant identifier {label} "
                    "(no tenant-specific code or configuration, §6.2)"
                )
    result.counts.update({"tenant_files_scanned": scanned, "tenant_matches": hits})


# --------------------------------------------------------------------------- (d) branches


def branch_names(root: Path) -> list[tuple[str, str]]:
    """(display name, branch name) for every local and remote-tracking branch."""
    remotes = sorted(git(root, "remote").decode().split(), key=len, reverse=True)
    out = git(root, "for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes").decode("utf-8", "replace")
    names = []
    for ref in out.splitlines():
        if ref.startswith("refs/heads/"):
            name = ref[len("refs/heads/"):]
            names.append((name, name))
        elif ref.startswith("refs/remotes/"):
            rest = ref[len("refs/remotes/"):]
            remote = next((r for r in remotes if rest.startswith(r + "/")), rest.split("/", 1)[0])
            name = rest[len(remote) + 1:]
            if name == "HEAD":
                continue
            names.append((rest, name))
    return names


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def branch_problems(name: str, config: dict[str, Any]) -> list[str]:
    problems = []
    if not any(p.match(name) for p in BRANCH_PATTERNS):
        problems.append("does not match main, wp/<n.m>-<slug>, release/<version> or hotfix/<slug> (§3.6)")
    lowered = name.lower()
    for word in BRANCH_FORBIDDEN_WORDS:
        if word in lowered:
            problems.append(f"contains the word '{word}' (no branch per customer or tenant, §2.3)")
    for literal in tenant_literals(config):
        if literal.lower() in lowered or (slug(literal) and slug(literal) in slug(name)):
            problems.append(f"names registered tenant {literal!r} (§2.2 rule 8)")
    for entry in config.get("patterns") or []:
        if re.search(str(entry["regex"]), name):
            problems.append(f"matches tenant identifier pattern {entry['id']!r} (§2.2 rule 8)")
    return problems


def check_branches(root: Path, result: CheckResult, config: dict[str, Any]) -> None:
    names = branch_names(root)
    for display, name in names:
        for problem in branch_problems(name, config):
            result.errors.append(f"branch: {display}: {problem}")
    result.counts["branches"] = len(names)


# --------------------------------------------------------------------------- (e) size limits

_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
_LIST_ITEM = re.compile(r"^(?:[-*+]|\d+[.)])\s+\S")


def blocking_now_items(text: str) -> Optional[int]:
    """Number of items in the "Blocking now" section (top-level list items or table rows), None if absent."""
    lines = text.splitlines()
    start = None
    for index, line in enumerate(lines):
        heading = _HEADING.match(line)
        bold = re.match(r"^\*\*Blocking now\b.*\*\*:?\s*$|^Blocking now\s*:\s*$", line.strip(), re.I)
        if (heading and re.search(r"\bBlocking now\b", heading.group(2), re.I)) or bold:
            start = index + 1
            break
    if start is None:
        return None
    items = table_rows = 0
    table_header_seen = False
    for line in lines[start:]:
        if _HEADING.match(line):
            break
        if _LIST_ITEM.match(line):
            items += 1
        elif line.lstrip().startswith("|"):
            if re.match(r"^\s*\|?\s*:?-{3,}", line):
                table_header_seen = True
            elif table_header_seen:
                table_rows += 1
    return items + table_rows


def check_limits(root: Path, result: CheckResult) -> None:
    decisions = root / "docs" / "program" / "DECISIONS-NEEDED.md"
    if decisions.is_file():
        count = blocking_now_items(decisions.read_text(encoding="utf-8", errors="replace"))
        if count is None:
            result.errors.append("limits: docs/program/DECISIONS-NEEDED.md has no 'Blocking now' list (§3.1)")
        else:
            result.counts["blocking_now_items"] = count
            if count > BLOCKING_NOW_MAX:
                result.errors.append(
                    f"limits: docs/program/DECISIONS-NEEDED.md 'Blocking now' has {count} items "
                    f"(at most {BLOCKING_NOW_MAX}, §3.1)"
                )
    status = root / "docs" / "program" / "STATUS.md"
    if status.is_file():
        lines = len(status.read_text(encoding="utf-8", errors="replace").splitlines())
        result.counts["status_lines"] = lines
        if lines > STATUS_MAX_LINES:
            result.errors.append(f"limits: docs/program/STATUS.md has {lines} lines (at most {STATUS_MAX_LINES}, §3.1)")


# --------------------------------------------------------------------------- all

RULES = ("crlf", "required", "tenants", "branches", "limits")


def run(root: Path, only: Optional[set[str]] = None) -> CheckResult:
    result = CheckResult(check="repo")
    selected = only or set(RULES)
    try:
        config = load_tenant_config(root) if selected & {"tenants", "branches"} else {}
        if "crlf" in selected:
            check_crlf(root, result)
        if "required" in selected:
            check_required(root, result)
        if "tenants" in selected:
            check_tenants(root, result, config)
        if "branches" in selected:
            check_branches(root, result, config)
        if "limits" in selected:
            check_limits(root, result)
    except (RepoError, KeyError, re.error) as exc:
        result.errors.append(f"environment: {exc}")
        result.counts["environment_error"] = 1
    return result
