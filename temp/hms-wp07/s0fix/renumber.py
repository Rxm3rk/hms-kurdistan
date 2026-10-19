import re, sys
from pathlib import Path
M = {1: "DN-new-7", 2: "OQ-new-1", 3: "OQ-new-2", 4: "OQ-new-3", 5: "OQ-new-4", 6: "OQ-new-5", 7: "OQ-new-6", 8: "OQ-new-7",
     9: "OQ-new-8", 10: "OQ-new-9", 11: "DN-new-8", 12: "DN-new-9", 13: "DN-new-10", 14: "OQ-new-10", 15: "OQ-new-11",
     16: "DN-new-11", 17: "OQ-new-12", 18: "DN-new-13"}
for f in sys.argv[1:]:
    p = Path(f); t = p.read_text(encoding="utf-8")
    t2 = re.sub(r"OQ-new-(\d+)\b", lambda m: M[int(m.group(1))], t)
    p.write_text(t2, encoding="utf-8", newline="\n"); print(f, t != t2)
