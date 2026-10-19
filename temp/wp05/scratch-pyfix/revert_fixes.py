"""Scratch helper: revert py-03..py-09 in the BEFORE copy (outside the repository), by exact text."""

import sys
from pathlib import Path

base = Path(sys.argv[1]) / "tools" / "hmstools" / "statemachines"


def revert(name: str, old: str, new: str) -> None:
    path = base / name
    text = path.read_text(encoding="utf-8")
    assert text.count(old) == 1, (name, old[:60])
    path.write_text(text.replace(old, new), encoding="utf-8", newline="\n")


# py-03: no shallow probe, and the old git settings.
revert("approval.py", "    if applying:\n        code, out, err = git(root, [\"rev-parse\", \"--is-shallow-repository\"])", "    if False:\n        code, out, err = git(root, [\"rev-parse\", \"--is-shallow-repository\"])")
revert("approval.py", 'GIT_ARGS = ("git", "--no-replace-objects", "-c", "core.commitGraph=false", "-c", "core.quotepath=off")',
       'GIT_ARGS = ("git", "-c", "core.quotepath=off")')
revert("approval.py", 'GIT_ENV = {"GIT_GRAFT_FILE": os.devnull, "GIT_NO_REPLACE_OBJECTS": "1", "GIT_TERMINAL_PROMPT": "0"}',
       'GIT_ENV = {"GIT_NO_REPLACE_OBJECTS": "1", "GIT_TERMINAL_PROMPT": "0"}')
# py-04: no integer check.
revert("check.py", 'and type(spec.document["version"]) is not int:', 'and False:')
# py-05: no owner lookup for a spec that fails rule 1.
revert("check.py", "        elif machine is None:\n            # A spec that fails rule 1", "        elif False:\n            # A spec that fails rule 1")
# py-06: rule 9 ignores the gate.
revert("rules.py", "    if gate_errors is None or gate_errors:", "    if True:")
# py-08: no creation-command check.
revert("rules.py", "        if transition.on in machine.created_by:", "        if False:")
# py-09: no order-aware message.
revert("check.py", "    if sorted(lines) == sorted(want):", "    if False:")
print("reverted")
