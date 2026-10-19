"""Feature-to-hazard links read from docs/safety/hazard-log.yaml, the record (BUILD-PROMPT.md §3.1, §10.1).

Each hazard-log entry names the feature IDs it concerns in its 'features' list. A backlog row's 'hazards' is the
sorted list of the IDs of every entry whose 'features' names the row's feature ID; a part row shares its
feature's hazards. The backlog never holds a hazard link that the hazard log does not, and never misses one.
Only 'hazards[].id' and 'hazards[].features' are read here; 'tools/hms safety check' validates the rest.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


class HazardLogError(ValueError):
    """The hazard log does not parse, or its entries do not have the 'id' and 'features' read here."""


@dataclass(frozen=True)
class HazardLinks:
    by_feature: dict[str, tuple[str, ...]]  # feature ID -> hazard-log entry IDs, sorted
    entries: int  # hazard-log entries read

    def hazards_of(self, feature_id: str) -> list[str]:
        return list(self.by_feature.get(feature_id, ()))

    @property
    def links(self) -> int:
        return sum(len(ids) for ids in self.by_feature.values())

    def unknown_features(self, known: set[str]) -> dict[str, list[str]]:
        """Feature IDs the hazard log names that are not in ``known``, each with the entries that name it."""
        return {feature: list(ids) for feature, ids in sorted(self.by_feature.items()) if feature not in known}


def parse_hazard_links(data: Any) -> HazardLinks:
    if not isinstance(data, dict) or not isinstance(data.get("hazards"), list):
        raise HazardLogError("no 'hazards' list")
    found: dict[str, set[str]] = {}
    for index, entry in enumerate(data["hazards"], 1):
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str) or not entry["id"].strip():
            raise HazardLogError(f"hazards entry {index} has no string 'id'")
        features = entry.get("features")
        if features is None:
            continue
        if not isinstance(features, list) or not all(isinstance(f, str) and f.strip() for f in features):
            raise HazardLogError(f"{entry['id']}: 'features' is not a list of feature IDs")
        for feature in features:
            found.setdefault(feature, set()).add(entry["id"])
    return HazardLinks({feature: tuple(sorted(ids)) for feature, ids in found.items()}, len(data["hazards"]))


def load_hazard_links(path: Path) -> HazardLinks:
    """Read the links from the hazard log; the caller checks that the file exists."""
    import yaml  # PyYAML, pinned in tools/requirements.txt

    from hmstools.backlog.records import _safe_load

    try:
        data = _safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise HazardLogError(f"does not parse as YAML: {exc}") from None
    return parse_hazard_links(data)
