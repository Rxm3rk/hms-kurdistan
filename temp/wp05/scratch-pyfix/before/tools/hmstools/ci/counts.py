"""Parse test and check counts from step output: unittest, JUnit XML, CheckResult JSON, gitleaks reports."""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable, Optional

TEST_KEYS = ("tests", "failures", "errors", "skipped")


def unittest_counts(text: str) -> Optional[dict[str, int]]:
    """Counts from the summary that 'python -m unittest' prints, or None if there is none."""
    text = text.replace("\r\n", "\n")
    ran = re.findall(r"^Ran (\d+) tests? in [\d.]+s$", text, re.M)
    if not ran:
        return None
    counts = {"tests": int(ran[-1]), "failures": 0, "errors": 0, "skipped": 0}
    summary = re.findall(r"^(OK|FAILED)(?: \(([^)]*)\))?\s*$", text, re.M)
    if summary:
        status, detail = summary[-1]
        for key, value in re.findall(r"(failures|errors|skipped)=(\d+)", detail or ""):
            counts[key] = int(value)
        counts["ok"] = 1 if status == "OK" else 0
    return counts


def junit_files(patterns: Iterable[tuple[Path, str]]) -> list[Path]:
    files: set[Path] = set()
    for base, pattern in patterns:
        if base.is_dir():
            files.update(p for p in base.glob(pattern) if p.is_file())
    return sorted(files)


def junit_counts(files: Iterable[Path]) -> dict[str, int]:
    """Sum test cases over JUnit XML files: a case with <failure> is a failure, <error> an error, <skipped> skipped.

    Counting <testcase> elements (rather than suite attributes) gives the same answer for Gradle, Vitest
    and other writers, and never double-counts nested suites.
    """
    totals = {key: 0 for key in TEST_KEYS}
    totals["files"] = 0
    totals["unparseable_files"] = 0
    for path in files:
        totals["files"] += 1
        try:
            tree = ET.parse(path)
        except (ET.ParseError, OSError):
            totals["unparseable_files"] += 1
            continue
        for case in tree.getroot().iter("testcase"):
            totals["tests"] += 1
            if case.find("failure") is not None:
                totals["failures"] += 1
            elif case.find("error") is not None:
                totals["errors"] += 1
            elif case.find("skipped") is not None:
                totals["skipped"] += 1
    return totals


def last_json_line(text: str) -> Optional[dict[str, Any]]:
    """The CheckResult object printed as the last non-empty stdout line (common.py contract)."""
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return None
    try:
        data = json.loads(lines[-1])
    except ValueError:
        return None
    if not isinstance(data, dict) or "ok" not in data or "check" not in data:
        return None
    return data


def check_counts(data: dict[str, Any]) -> dict[str, int]:
    counts = {k: v for k, v in (data.get("counts") or {}).items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
    counts["errors_reported"] = len(data.get("errors") or [])
    counts["warnings_reported"] = len(data.get("warnings") or [])
    return counts


def gitleaks_findings(report: Path) -> Optional[int]:
    """Number of findings in a gitleaks JSON report, or None if the report is missing or unreadable."""
    try:
        with open(report, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return None
    return len(data) if isinstance(data, list) else None


def gitleaks_summary(report: Path, strip_prefix: str = "") -> list[str]:
    """One redacted line per finding: rule, file and line (gitleaks already redacts the secret)."""
    try:
        with open(report, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return []
    lines = []
    for finding in data if isinstance(data, list) else []:
        file = str(finding.get("File", "?")).replace("\\", "/")
        if strip_prefix and file.startswith(strip_prefix):
            file = file[len(strip_prefix):]
        where = f"{file}:{finding.get('StartLine', '?')}"
        commit = finding.get("Commit")
        lines.append(f"{finding.get('RuleID', '?')} at {where}" + (f" (commit {commit[:12]})" if commit else ""))
    return lines
