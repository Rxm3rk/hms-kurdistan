"""Text edits for the gates-bite plants. Run with: python3 -I plant_edit.py <command> <args...>

Every command exits 1 (and changes nothing) when its anchor or target is not found, so a plant can
never silently do nothing. Files are read and written as UTF-8 bytes with their line endings kept.

Commands:
  replace FILE OLD NEW [ANCHOR]   replace the first OLD after the first ANCHOR (or from the start)
  replace-line FILE REGEX NEW     replace the first whole line matching REGEX with NEW
  delete-block FILE FIRST_LINE    delete from the line equal to FIRST_LINE up to and including the
                                  next empty line (one YAML record of backlog.yaml)
  pad-lines FILE N                append numbered filler lines until the file has N lines (N > current)
  insert-after FILE REGEX TEXT    insert TEXT (with \\n for newlines) after the first line matching REGEX
  json-del-key FILE KEY           delete KEY from a flat JSON object (2-space indent, as the catalogues)
  signers-add FILE NAME ROLE FPR DATE   add a gpg entry to allowed-signers.yaml (its last block)
  signers-clear FILE              set the signers list of allowed-signers.yaml to []
  count-lines FILE                print the number of lines
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def fail(message: str) -> None:
    print(f"plant_edit: {message}", file=sys.stderr)
    sys.exit(1)


def read(path: str) -> str:
    p = Path(path)
    if not p.is_file():
        fail(f"{path}: no such file")
    return p.read_bytes().decode("utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_bytes(text.encode("utf-8"))


def cmd_replace(path: str, old: str, new: str, anchor: str = "") -> None:
    text = read(path)
    start = 0
    if anchor:
        start = text.find(anchor)
        if start < 0:
            fail(f"{path}: anchor {anchor!r} not found")
    index = text.find(old, start)
    if index < 0:
        fail(f"{path}: {old!r} not found" + (f" after {anchor!r}" if anchor else ""))
    write(path, text[:index] + new + text[index + len(old):])


def cmd_replace_line(path: str, pattern: str, new: str) -> None:
    lines = read(path).split("\n")
    regex = re.compile(pattern)
    for i, line in enumerate(lines):
        if regex.search(line):
            lines[i] = new
            write(path, "\n".join(lines))
            return
    fail(f"{path}: no line matches {pattern!r}")


def cmd_delete_block(path: str, first: str) -> None:
    lines = read(path).split("\n")
    try:
        start = lines.index(first)
    except ValueError:
        fail(f"{path}: no line equal to {first!r}")
    end = start
    while end < len(lines) and lines[end].strip() != "":
        end += 1
    del lines[start:end + 1]
    write(path, "\n".join(lines))


def cmd_pad_lines(path: str, n: str) -> None:
    text = read(path)
    target = int(n)
    current = len(text.splitlines())
    if current >= target:
        fail(f"{path}: already has {current} lines (target {target})")
    if not text.endswith("\n"):
        text += "\n"
    for i in range(current + 1, target + 1):
        text += f"Scratch filler line {i} planted by the gates-bite script.\n"
    write(path, text)


def cmd_insert_after(path: str, pattern: str, insert: str) -> None:
    lines = read(path).split("\n")
    regex = re.compile(pattern)
    for i, line in enumerate(lines):
        if regex.search(line):
            lines[i + 1:i + 1] = insert.replace("\\n", "\n").split("\n")
            write(path, "\n".join(lines))
            return
    fail(f"{path}: no line matches {pattern!r}")


def cmd_json_del_key(path: str, key: str) -> None:
    data = json.loads(read(path))
    if not isinstance(data, dict) or key not in data:
        fail(f"{path}: key {key!r} not found")
    del data[key]
    write(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def cmd_signers_add(path: str, name: str, role: str, fingerprint: str, added: str) -> None:
    """Add one gpg entry to allowed-signers.yaml. The signers list must be the file's last block
    (as shipped): either 'signers: []' or 'signers:' followed only by its entries."""
    entry = (
        f"  - name: {name}\n    roles: [{role}]\n    key_type: gpg\n    fingerprint: {fingerprint}\n"
        f"    added: \"{added}\"\n"
    )
    lines = read(path).split("\n")
    for i, line in enumerate(lines):
        if re.fullmatch(r"signers:\s*\[\s*\]\s*", line):
            lines[i] = "signers:\n" + entry.rstrip("\n")
            write(path, "\n".join(lines))
            return
    starts = [i for i, line in enumerate(lines) if re.fullmatch(r"signers:\s*", line)]
    if len(starts) != 1:
        fail(f"{path}: no 'signers:' block found")
    rest = [line for line in lines[starts[0] + 1:] if line.strip()]
    if not all(line.startswith((" ", "-")) for line in rest):
        fail(f"{path}: the signers list is not the last block of the file")
    text = "\n".join(lines).rstrip("\n") + "\n" + entry
    write(path, text)


def cmd_signers_clear(path: str) -> None:
    """Replace the signers list (the file's last block) by 'signers: []'."""
    lines = read(path).split("\n")
    starts = [i for i, line in enumerate(lines) if re.fullmatch(r"signers:.*", line)]
    if len(starts) != 1:
        fail(f"{path}: no 'signers:' line found")
    write(path, "\n".join(lines[: starts[0]] + ["signers: []", ""]))


def cmd_count_lines(path: str) -> None:
    print(len(read(path).splitlines()))


COMMANDS = {
    "replace": cmd_replace,
    "replace-line": cmd_replace_line,
    "delete-block": cmd_delete_block,
    "pad-lines": cmd_pad_lines,
    "insert-after": cmd_insert_after,
    "json-del-key": cmd_json_del_key,
    "signers-add": cmd_signers_add,
    "signers-clear": cmd_signers_clear,
    "count-lines": cmd_count_lines,
}

if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in COMMANDS:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    COMMANDS[sys.argv[1]](*sys.argv[2:])
