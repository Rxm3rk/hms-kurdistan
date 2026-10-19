"""Scratch: list invisible characters and backslash-u escapes in the i18n sources."""
import pathlib
import sys
import unicodedata

root = pathlib.Path(sys.argv[1])
for p in sorted(list(root.joinpath("src").rglob("*.ts")) + list(root.joinpath("test").rglob("*.ts"))):
    text = p.read_text(encoding="utf-8")
    for number, line in enumerate(text.splitlines(), 1):
        bad = [c for c in line if unicodedata.category(c) in ("Cf", "Zs", "Cc", "Mn") and c != " "]
        escape = "\\u" in line
        if bad or escape:
            print(p.relative_to(root), number, ["U+%04X" % ord(c) for c in bad], "ESC" if escape else "")
