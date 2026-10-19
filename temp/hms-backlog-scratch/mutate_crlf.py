import pathlib
import sys

p = pathlib.Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
needle = '    text = text.replace("' + "\\" + 'r' + "\\" + 'n", "' + "\\" + 'n")\n'
print(repr(needle), needle in t)
t2 = t.replace(needle, "")
assert t2 != t
p.write_text(t2, encoding="utf-8", newline="\n")
print("mutated: parse_plan no longer normalises CRLF")
