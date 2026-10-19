"""Wrap over-long Kotest assertion lines and one-line tests (max 140)."""
import pathlib
import re
import sys

p = pathlib.Path(sys.argv[1])
out = []
call = re.compile(r"^(\s*)(guards\.\w+)\((.*)\) shouldBe (true|false)$")
oneline = re.compile(r'^(\s*)(test\(".*"\)) \{ (.*) \}$')
for line in p.read_text(encoding="utf-8").splitlines():
    if len(line) <= 140:
        out.append(line)
        continue
    m = oneline.match(line)
    if m:
        ind = m.group(1)
        out.append(f"{ind}{m.group(2)} {{")
        inner = f"{ind}    {m.group(3)}"
        lines = [inner]
        if len(inner) > 140:
            m2 = call.match(inner)
            if m2:
                i2 = m2.group(1)
                lines = [f"{i2}{m2.group(2)}(", f"{i2}    {m2.group(3)},", f"{i2}) shouldBe {m2.group(4)}"]
        out.extend(lines)
        out.append(f"{ind}}}")
        continue
    m = call.match(line)
    if m:
        ind = m.group(1)
        out.extend([f"{ind}{m.group(2)}(", f"{ind}    {m.group(3)},", f"{ind}) shouldBe {m.group(4)}"])
        continue
    out.append(line)
text = "\n".join(out) + "\n"
p.write_text(text, encoding="utf-8", newline="\n")
for n, line in enumerate(text.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
