import sys
from pathlib import Path
d = Path(sys.argv[1])
spec = Path(sys.argv[2])
t = spec.read_text(encoding="utf-8")


def between(text, start, end, new):
    i = text.index(start)
    j = text.index(end, i) if end else len(text)
    return text[:i] + new + text[j:]


r = lambda n: (d / n).read_text(encoding="utf-8")
t = between(t, "### 2.1 The banner", "### 2.5 Density modes", r("sec2_1-2_4.md"))
t = between(t, "### 2.6 `ClinicalNumber`", "### 2.7 `Bdi`", r("sec2_6.md"))
t = between(t, "## 4. The web frame and routes", "## 7. The mobile skeleton", r("sec4_6.md"))
t = between(t, "## 9. Hazards, controls and tests", "## 10. Message keys", r("sec9.md"))
s10 = r("sec10.md")
s10 = s10[: s10.index("## 11. ")]
s10 = s10.replace("in three languages (§2.1, OQ-new-4).", "in three languages (§2.1, OQ-new-4). The unit display map of §2.6 is governed content too (OQ-new-13).")
t = between(t, "## 10. Message keys", None, s10 + r("sec11.md"))
spec.write_text(t, encoding="utf-8", newline="\n")
print("ok", len(t.splitlines()))
