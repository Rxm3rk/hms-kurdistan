import sys, xml.etree.ElementTree as ET
from pathlib import Path
root = Path(sys.argv[1])
for xml in sorted(root.glob("**/build/test-results/**/*.xml")):
    t = ET.parse(xml).getroot()
    suites = [t] if t.tag == "testsuite" else t.findall("testsuite")
    for s in suites:
        tests, sk = int(s.get("tests", 0)), int(s.get("skipped", 0))
        rel = xml.relative_to(root)
        print(f"{str(rel.parent):55} {s.get('name'):70} tests={tests} skipped={sk}")
        for tc in s.findall("testcase"):
            if tc.find("skipped") is not None:
                print("    SKIPPED:", tc.get("classname"), "::", tc.get("name"))
