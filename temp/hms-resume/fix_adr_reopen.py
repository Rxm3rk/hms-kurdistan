"""Adds the stop-and-ask sentence to ADR Reopen sections that lack it; fixes the licence README host line."""
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
SENTENCE = "Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4)."
changed = []
for f in sorted((root / "docs/adr").glob("ADR-0*.md")):
    s = f.read_text(encoding="utf-8")
    i = s.index("\n## Reopen if")
    rest = s[i + 1:]
    nxt = re.search(r"\n## ", rest[3:])
    assert nxt is None, f"{f.name}: Reopen if is not the last section"
    if "stop-and-ask item 2" in rest:
        continue
    s = s.rstrip("\n") + "\n\n" + SENTENCE + "\n"
    f.write_text(s, encoding="utf-8", newline="\n")
    changed.append(f.name[:7])
print("added to:", ", ".join(changed))

lic = root / "tools/licence/README.md"
s = lic.read_text(encoding="utf-8")
old = """build host (WP-0.2 for the engine, WP-0.9 for the release pipeline). This host has no container engine
(DECISIONS-NEEDED, KA-001), so **ORT has not been run** and the ORT files above are unvalidated: the"""
new = """build host (WP-0.2 for the engine, WP-0.9 for the release pipeline). The WSL build host has had Docker
Engine since 18 October 2026 (DN-002), but the merge-tier ORT step is built in WP-0.9, so **ORT has not
been run** and the ORT files above are unvalidated: the"""
assert s.count(old) == 1
lic.write_text(s.replace(old, new), encoding="utf-8", newline="\n")
print("licence README fixed")
