"""Summarise JUnit XML reports under each backend project's build/test-results directory."""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(sys.argv[1])
totals = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
for xml in sorted(root.glob("**/build/test-results/*/TEST-*.xml")):
    suite = ET.parse(xml).getroot()
    counts = {k: int(suite.get(k, 0)) for k in totals}
    for k in totals:
        totals[k] += counts[k]
    task = xml.parent.name
    project = xml.parent.parent.parent.parent.relative_to(root)
    print(f"{project}  {task:13} {suite.get('name'):70} tests={counts['tests']} failures={counts['failures']} errors={counts['errors']} skipped={counts['skipped']}")
    if "-v" in sys.argv:
        for case in suite.iter("testcase"):
            print("      -", case.get("name")[:150])
print("TOTAL", totals)
