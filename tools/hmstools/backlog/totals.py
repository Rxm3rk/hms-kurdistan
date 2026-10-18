"""Counts and engineer-week sums of the backlog, compared with BUILD-PROMPT.md A.18."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any

from hmstools.backlog.source import PHASES, A18Totals, size_reading

# The AI gateway and control plane named in A.18's note and the first A.20 row (K costs them at 20 ew, R14 at 40).
AI_GATEWAY_IDS = ("AI-GW-01", "AI-GOV-01")


def is_part(record: dict[str, Any]) -> bool:
    return record.get("part") is not None


def features_only(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [r for r in records if not is_part(r)]


@dataclass(frozen=True)
class TotalsRow:
    label: str
    phases: tuple[str, ...]
    a18_count: int
    count: int
    a18_ew: int
    ew: int
    face_ew: int
    explanation: str | None  # set when A.18's own note accounts for an engineer-week difference

    @property
    def count_diff(self) -> int:
        return self.count - self.a18_count

    @property
    def ew_diff(self) -> int:
        return self.ew - self.a18_ew

    @property
    def face_diff(self) -> int:
        return self.face_ew - self.a18_ew


def _explain(records: list[dict[str, Any]], phases: tuple[str, ...], ew_diff: int, a18: A18Totals) -> str | None:
    """A.18's note says K costs the AI gateway and control plane lower than R14. Only a difference of exactly
    that amount, in a row that holds those features, counts as explained."""
    if ew_diff == 0 or a18.ai_gateway_ew is None:
        return None
    k_ew, r14_ew = a18.ai_gateway_ew
    holds = any(r.get("id") in AI_GATEWAY_IDS and r.get("phase") in phases for r in features_only(records))
    if holds and ew_diff == r14_ew - k_ew:
        return (
            f"A.18's note: K costs the AI gateway and control plane at {k_ew} engineer-weeks where R14 sizes them "
            f"at {r14_ew}"
        )
    return None


def compare_a18(records: list[dict[str, Any]], a18: A18Totals) -> list[TotalsRow]:
    """One row per phase, then the MVP row and the All row. Raises SourceError for an unreadable size."""
    rows: list[TotalsRow] = []
    groups = [(p, (p,), a18.phases[p]) for p in PHASES]
    groups.append((a18.mvp_label, a18.mvp_phases, a18.mvp))
    groups.append(("All", PHASES, a18.all))
    for label, phases, (a18_count, a18_ew) in groups:
        in_scope = [r for r in records if r.get("phase") in phases]
        count = len(features_only(in_scope))
        ew = sum(size_reading(str(r.get("size"))).ew for r in in_scope)
        face = sum(size_reading(str(r.get("size"))).face_value for r in in_scope)
        rows.append(TotalsRow(label, phases, a18_count, count, a18_ew, ew, face, _explain(records, phases, ew - a18_ew, a18)))
    return rows


def a18_internal_problems(a18: A18Totals) -> list[str]:
    """Where A.18's MVP and All rows are not the sums of its phase rows."""
    problems = []
    for label, phases, values in ((a18.mvp_label, a18.mvp_phases, a18.mvp), ("All", PHASES, a18.all)):
        count = sum(a18.phases[p][0] for p in phases)
        ew = sum(a18.phases[p][1] for p in phases)
        if (count, ew) != values:
            problems.append(
                f"A.18 row '{label}' reads {values[0]} feature IDs / {values[1]} engineer-weeks, but its phase rows "
                f"sum to {count} / {ew}"
            )
    return problems


def status_counts(records: list[dict[str, Any]]) -> Counter:
    return Counter(str(r.get("status")) for r in features_only(records))


def phase_counts(records: list[dict[str, Any]]) -> Counter:
    return Counter(str(r.get("phase")) for r in features_only(records))


def without_work_package(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [r for r in records if not r.get("work_packages")]
