"""Print a hazard's current subject_version as the clone's own safety check computes it.

  <venv python> -I so_version.py <clone> <hazard id> <decision>

Prints nothing (exit 0) when the check at that commit has no notion of a subject version (6ca3e3a), so
the plant's sign-off record then carries no subject_version, as the review's record did.
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    root, subject_id, decision = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    sys.path.insert(0, str(root / "tools"))
    try:
        from hmstools.safety import check, signoffs
    except Exception as exc:  # noqa: BLE001 - report and print nothing
        print(f"so_version: cannot import the safety check: {exc}", file=sys.stderr)
        return 0
    version_of = getattr(signoffs, "subject_version", None)
    if version_of is None:
        return 0
    path = root / "docs" / "safety" / "hazard-log.yaml"
    loader = getattr(check, "_strict_yaml_load", None)
    normalise = getattr(check, "_normalise", lambda node: node)
    if loader is not None:
        document = normalise(loader(path))
    else:
        import yaml

        document = normalise(yaml.safe_load(path.read_text(encoding="utf-8")))
    for hazard in document.get("hazards", []):
        if isinstance(hazard, dict) and hazard.get("id") == subject_id:
            print(version_of(hazard, decision))
            return 0
    print(f"so_version: {subject_id} not found in {path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
