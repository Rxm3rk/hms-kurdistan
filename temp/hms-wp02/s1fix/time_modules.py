"""Time each test module of tools/ (scratch measurement; run from the tree's tools/ directory)."""
import sys, time, unittest
loader = unittest.TestLoader()
suite = loader.discover("hmstools", pattern="test_*.py", top_level_dir=".")
rows = []
def walk(s):
    for t in s:
        if isinstance(t, unittest.TestSuite) and any(isinstance(x, unittest.TestCase) for x in t):
            yield t
        elif isinstance(t, unittest.TestSuite):
            yield from walk(t)
for case_suite in walk(suite):
    first = next(iter(case_suite))
    name = type(first).__module__ + "." + type(first).__name__
    start = time.monotonic()
    result = unittest.TestResult()
    case_suite.run(result)
    rows.append((time.monotonic() - start, name, case_suite.countTestCases(), len(result.failures) + len(result.errors)))
for secs, name, n, bad in sorted(rows, reverse=True)[:15]:
    print(f"{secs:8.1f} s  {n:4} tests  {bad} bad  {name}")
print(f"total {sum(r[0] for r in rows):.1f} s")
