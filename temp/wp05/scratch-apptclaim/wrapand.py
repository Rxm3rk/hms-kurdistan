"""Wrap over-long lines that are `&&` chains (optionally after `appliesTo = { `) at the && operators."""
import pathlib
import re
import sys

p = pathlib.Path(sys.argv[1])
out = []
for line in p.read_text(encoding="utf-8").splitlines():
    if len(line) <= 140 or " && " not in line:
        out.append(line)
        continue
    indent = re.match(r"^\s*", line).group(0)
    m = re.match(r"^(\s*)(appliesTo = \{ )(.*) \},?$", line)
    if m:
        parts = m.group(3).split(" && ")
        out.append(f"{indent}appliesTo = {{")
        out.append(f"{indent}    {parts[0]} &&")
        for part in parts[1:-1]:
            out.append(f"{indent}        {part} &&")
        out.append(f"{indent}        {parts[-1]}")
        out.append(f"{indent}}},")
        continue
    parts = line.strip().split(" && ")
    out.append(f"{indent}{parts[0]} &&")
    for part in parts[1:-1]:
        out.append(f"{indent}    {part} &&")
    out.append(f"{indent}    {parts[-1]}")
text = "\n".join(out) + "\n"
p.write_text(text, encoding="utf-8", newline="\n")
for n, line in enumerate(text.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
