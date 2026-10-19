"""Scratch: turn invisible or ambiguous characters in string and regex literals into JS escapes."""
import pathlib
import sys

BS = chr(92)
root = pathlib.Path(sys.argv[1])


def esc(code: int) -> str:
    return BS + "u" + format(code, "04X")


COMMON = [0xFEFF, 0x202E, 0x202C, 0x00A0, 0x202F, 0x0301, 0x0600, 0x06FF]
FILES = {
    "src/lint/json-object.ts": COMMON,
    "src/pseudo.ts": COMMON,
    "src/ui-intl.ts": [0x0660, 0x0669, 0x06F0, 0x06F9],
    "test/pseudo.property.test.ts": COMMON,
    "test/review-marking.test.ts": COMMON,
    "test/clinical-keys.test.ts": COMMON + [0x00E9],
    "test/sorani-letters.test.ts": COMMON,
}
for name, codes in FILES.items():
    path = root / name
    text = path.read_text(encoding="utf-8")
    new = text
    for code in codes:
        new = new.replace(chr(code), esc(code))
    if new != text:
        path.write_text(new, encoding="utf-8", newline="\n")
        print("fixed", name)
