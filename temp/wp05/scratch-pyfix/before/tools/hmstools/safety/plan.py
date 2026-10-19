"""Facts read from the plan of record (BUILD-PROMPT.md), used to check that the hazard log quotes it faithfully.

Parsed sections:
- §2.1 the safety-invariant table: SI number, invariant text, "Enforced in", mapped seeded hazards;
- §2.4 the seeded hazards H1 to H15;
- §5.2 the module map (module names, for owners and module lists);
- §18.4 the SAC table (SAC number and the SIs it maps to);
- Appendix A feature IDs (rows of the form ``| `ID` |``), the fallback when docs/program/backlog.yaml is absent.

BUILD-PROMPT.md is read-only for the build; nothing here writes to it.
"""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


class PlanParseError(Exception):
    """A section of BUILD-PROMPT.md could not be parsed in the expected shape."""


@dataclass
class PlanFacts:
    si_text: dict[str, str] = field(default_factory=dict)
    si_enforced_in: dict[str, str] = field(default_factory=dict)
    si_seeded: dict[str, list[str]] = field(default_factory=dict)
    seeded_hazards: dict[str, str] = field(default_factory=dict)
    modules: set[str] = field(default_factory=set)
    sac_to_si: dict[str, list[str]] = field(default_factory=dict)
    appendix_a_features: set[str] = field(default_factory=set)


def _section(lines: list[str], start_prefix: str, stop: re.Pattern[str]) -> list[str]:
    out: list[str] = []
    inside = False
    for line in lines:
        if not inside:
            if line.startswith(start_prefix):
                inside = True
            continue
        if stop.match(line):
            break
        out.append(line)
    if not inside:
        raise PlanParseError(f"section starting with {start_prefix!r} not found")
    return out


_NEXT_HEADING = re.compile(r"^#{2,3} ")
_NEXT_TOP_HEADING = re.compile(r"^## ")
_SI_ROW = re.compile(r"^\| (\d\d) \| (.*) \| (.*) \| (.*) \|$")
_SAC_ROW = re.compile(r"^\| (\d\d) \| (.*) \| (.*) \|$")
_FEATURE_ROW = re.compile(r"^\| `([^`]+)` \|")
_H_ITEM = re.compile(r"^H(\d+) (.+)$")


def parse_plan(path: Path) -> PlanFacts:
    """Parse the sections of BUILD-PROMPT.md the safety check relies on (cached per file version)."""
    stat = path.stat()
    return copy.deepcopy(_parse_cached(str(path.resolve()), stat.st_mtime_ns, stat.st_size))


@lru_cache(maxsize=4)
def _parse_cached(path_str: str, _mtime_ns: int, _size: int) -> PlanFacts:
    lines = Path(path_str).read_text(encoding="utf-8").splitlines()
    facts = PlanFacts()

    for line in _section(lines, "### 2.1 ", _NEXT_HEADING):
        match = _SI_ROW.match(line)
        if match:
            si = f"SI-{match.group(1)}"
            facts.si_text[si] = match.group(2)
            facts.si_enforced_in[si] = match.group(3)
            facts.si_seeded[si] = re.findall(r"H\d+", match.group(4))
    expected = {f"SI-{n:02d}" for n in range(1, 22)}
    if set(facts.si_text) != expected:
        raise PlanParseError("§2.1: expected rows SI-01 to SI-21, found " + ", ".join(sorted(facts.si_text)))

    seeded_line = next((ln for ln in _section(lines, "### 2.4 ", _NEXT_HEADING) if ln.startswith("H1 ")), None)
    if seeded_line is None:
        raise PlanParseError("§2.4: the line listing H1 to H15 was not found")
    seeded_line = re.sub(r"\s*\(BP §5\.1\)\.?\s*$", "", seeded_line)
    for item in seeded_line.split(" · "):
        match = _H_ITEM.match(item.strip())
        if not match:
            raise PlanParseError(f"§2.4: cannot parse seeded hazard item {item!r}")
        facts.seeded_hazards[f"H{match.group(1)}"] = match.group(2).strip()
    if set(facts.seeded_hazards) != {f"H{n}" for n in range(1, 16)}:
        raise PlanParseError("§2.4: expected H1 to H15, found " + ", ".join(sorted(facts.seeded_hazards)))

    for line in _section(lines, "### 5.2 ", _NEXT_HEADING):
        if not line.startswith("|") or line.startswith("|---") or "| Module |" in line:
            continue
        cells = line.split("|")
        if len(cells) > 3:
            facts.modules.update(re.findall(r"`([a-z][a-z0-9-]*)`", cells[2]))
    if "medications" not in facts.modules or "safety-registry" not in facts.modules:
        raise PlanParseError("§5.2: the module map was not parsed (medications or safety-registry missing)")

    for line in _section(lines, "### 18.4 ", _NEXT_HEADING):
        match = _SAC_ROW.match(line)
        if match:
            facts.sac_to_si[f"SAC-{match.group(1)}"] = re.findall(r"SI-\d\d", match.group(3))
    if set(facts.sac_to_si) != {f"SAC-{n:02d}" for n in range(1, 54)}:
        raise PlanParseError("§18.4: expected SAC-01 to SAC-53")

    for line in _section(lines, "## Appendix A", _NEXT_TOP_HEADING):
        match = _FEATURE_ROW.match(line)
        if match:
            facts.appendix_a_features.add(match.group(1))
    if len(facts.appendix_a_features) < 200:
        raise PlanParseError(f"Appendix A: only {len(facts.appendix_a_features)} feature rows found")

    return facts
