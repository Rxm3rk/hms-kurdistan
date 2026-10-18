"""Every Python source under tools/ compiles.

A module that no test imports (a command's __main__.py, for example) would otherwise ship a syntax error
unnoticed: WP-0.2 found one in tools/hmstools/cell/__main__.py that the unit tests never loaded.
"""

import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[2]


class SourcesCompileTest(unittest.TestCase):
    def test_every_tool_source_compiles(self):
        sources = [p for p in TOOLS.rglob("*.py") if "__pycache__" not in p.parts]
        self.assertGreater(len(sources), 20, "the tools tree looks wrong: " + str(TOOLS))
        failures = []
        for path in sources:
            try:
                compile(path.read_text(encoding="utf-8"), str(path), "exec")
            except SyntaxError as exc:
                failures.append(f"{path.relative_to(TOOLS).as_posix()}:{exc.lineno}: {exc.msg}")
        self.assertEqual(failures, [])


if __name__ == "__main__":
    unittest.main()
