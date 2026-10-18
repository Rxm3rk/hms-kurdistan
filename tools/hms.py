"""Launcher for the HMS programme tools: ``python -I tools/hms.py <area> [args...]``.

Runs ``hmstools.<area>`` as ``__main__``. Isolated mode (-I) drops the script
directory from sys.path, so the tools directory is added explicitly.
"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        print("usage: tools/hms <area> [args...]   (areas: packages under tools/hmstools/)")
        sys.exit(0 if len(sys.argv) >= 2 else 2)
    area = sys.argv[1]
    sys.argv = [f"tools/hms {area}", *sys.argv[2:]]
    runpy.run_module(f"hmstools.{area}", run_name="__main__", alter_sys=True)


if __name__ == "__main__":
    main()
