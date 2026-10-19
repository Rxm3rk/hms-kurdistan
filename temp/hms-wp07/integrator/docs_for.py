"""Write OPEN-QUESTIONS.md and KNOWN-ANOMALIES.md holding only the entries of the given slices."""
import sys
from pathlib import Path
final, out, slices = Path(sys.argv[1]), Path(sys.argv[2]), set(sys.argv[3].split(","))
OQ_SECTIONS = {"OQ-157": "S8", "OQ-158": "S3", "OQ-159": "S2", "OQ-160": "S4"}
KA_ROWS = {"KA-038": "S4", "KA-039": "S4", "KA-040": "S8", "KA-041": "S3", "KA-042": "S4"}
t = (final / "docs/program/OPEN-QUESTIONS.md").read_bytes().decode("utf-8")
if "S2" not in slices:
    start = t.index("- **Points the build agent raised for the reviewer**")
    end = t.index("- **Needed by:** before any hospital use; it is part of the release translation gate")
    t = t[:start] + t[end:]
i = t.index("\n\n### OQ-157:")
head, tail = t[:i], t[i + 2:]
secs = [s.rstrip("\n") for s in tail.split("\n\n### ")]
secs[0] = secs[0][4:]
keep = [s for s in secs if OQ_SECTIONS[s.split(":")[0]] in slices]
t = head + "".join("\n\n### " + s for s in keep) + "\n"
(out / "docs/program/OPEN-QUESTIONS.md").write_bytes(t.encode("utf-8"))
k = (final / "docs/program/KNOWN-ANOMALIES.md").read_bytes().decode("utf-8")
lines = k.split("\n")
lines = [l for l in lines if not (l.startswith("| KA-0") and l[2:8] in KA_ROWS and KA_ROWS[l[2:8]] not in slices)]
(out / "docs/program/KNOWN-ANOMALIES.md").write_bytes("\n".join(lines).encode("utf-8"))
