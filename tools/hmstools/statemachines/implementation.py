"""Rule 12 of spec §2.1: each predicate is implemented once and unit-tested.

A textual scan of the owner's Gradle project (the compiler is the real check that the object implements every
predicate, the second half of rule 4):

- ``src/main/kotlin`` holds exactly one implementation of ``<P>Predicates``, and it is a named ``object``
  (convention ``<P>Guards``) declared in the machine's package. A ``class`` or an anonymous ``object :`` that
  implements the interface counts as a further implementation.
- ``src/test/kotlin`` holds exactly one ``<P>GuardsTest.kt``, and every predicate's camelCase name appears, as a
  whole word, in at least one test name: the first string literal of a Kotest call ``test(...)``,
  ``context(...)``, ``should(...)``, ``describe(...)``, ``it(...)``, ``expect(...)``, ``feature(...)``,
  ``scenario(...)``, ``given(...)``, ``when(...)``, ``then(...)`` or ``and(...)``, or a string-spec name
  ``"..." {`` / ``"..." - {``. A disabled or skipped test does not count, and a file that disables one
  (``xtest``, ``enabled = false``, ``enabledIf``, ``@Ignored``, ``@Disabled``) fails.

Comments and string contents are removed before the code is scanned, so a KDoc that names the interface is
not an implementation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from hmstools.statemachines.model import Machine
from hmstools.statemachines.targets import Target

_TEST_FUNCTIONS = ("test", "context", "should", "describe", "it", "expect", "feature", "scenario", "given", "`when`",
                   "when", "then", "and")
_DISABLING = re.compile(
    r"\bx(?:test|context|should|describe|it|expect|feature|scenario|given|when|then|and)\s*\(|"
    r"\benabled\s*=\s*false\b|\benabledIf\b|\benabledOrReasonIf\b|@Ignored\b|@Disabled\b"
)


@dataclass
class KotlinSource:
    code: str  # comments removed, each string literal replaced by a placeholder \x01<n>\x02
    strings: list[str]  # the literals' contents, as written


def scan(text: str) -> KotlinSource:
    """Split Kotlin source into code and string literals (nested comments, raw strings, templates, char literals)."""
    code: list[str] = []
    strings: list[str] = []
    i, n = 0, len(text)

    def read_string(start: int) -> int:
        """Read the literal starting at ``start``; append its content; return the index after it."""
        raw = text.startswith('"""', start)
        j = start + (3 if raw else 1)
        content: list[str] = []
        while j < n:
            if raw and text.startswith('"""', j):
                j += 3
                while j < n and text[j] == '"':  # """"" ends with the last three quotes
                    content.append('"')
                    j += 1
                break
            if not raw and text[j] == '"':
                j += 1
                break
            if not raw and text[j] == "\\" and j + 1 < n:
                content.append(text[j:j + 2])
                j += 2
                continue
            if text.startswith("${", j):
                depth, k = 1, j + 2
                while k < n and depth:
                    if text[k] == '"':
                        k = read_string(k)
                        strings.pop()  # a literal inside a template is part of this literal
                        continue
                    depth += {"{": 1, "}": -1}.get(text[k], 0)
                    k += 1
                content.append(text[j:k])
                j = k
                continue
            content.append(text[j])
            j += 1
        strings.append("".join(content))
        return j

    while i < n:
        if text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end < 0 else end
        elif text.startswith("/*", i):
            depth, i = 1, i + 2
            while i < n and depth:
                if text.startswith("/*", i):
                    depth, i = depth + 1, i + 2
                elif text.startswith("*/", i):
                    depth, i = depth - 1, i + 2
                else:
                    i += 1
            code.append(" ")
        elif text[i] == '"':
            i = read_string(i)
            code.append(f"\x01{len(strings) - 1}\x02")
        elif text[i] == "'":
            match = re.match(r"'(?:\\u[0-9A-Fa-f]{4}|\\.|[^'\\])'", text[i:])
            length = match.end() if match else 1
            code.append(" " * length)
            i += length
        else:
            code.append(text[i])
            i += 1
    return KotlinSource("".join(code), strings)


def _header(code: str, start: int) -> str:
    """The declaration header from ``start`` to its body: up to the first ``{`` (or ``=``/``;``/blank line) outside
    parentheses and angle brackets, with parenthesised parts (constructor parameters, call arguments) removed."""
    depth = 0
    out: list[str] = []
    i = start
    while i < len(code):
        char = code[i]
        if char in "(<":
            depth += 1
        elif char in ")>" and depth:
            depth -= 1
        elif depth == 0 and (char in "{;=}" or code.startswith("\n\n", i)):
            break
        elif depth == 0:
            out.append(char)
        i += 1
    return "".join(out)


@dataclass(frozen=True)
class Implementation:
    file: str
    kind: str  # "object", "class" or "anonymous object"
    name: str
    package: str


_DECLARATION = re.compile(r"\b(object|class)\b(\s+[A-Za-z_]\w*)?")
_PACKAGE = re.compile(r"^\s*package\s+([A-Za-z_][\w.]*)", re.MULTILINE)


def implementations(root: Path, project: str, interface: str) -> list[Implementation]:
    found = []
    base = root / project / "src" / "main" / "kotlin"
    word = re.compile(rf"(?<![\w.])(?:[\w.]+\.)?{re.escape(interface)}\b")
    for path in sorted(base.rglob("*.kt")) if base.is_dir() else []:
        source = scan(path.read_text(encoding="utf-8", errors="replace"))
        package_match = _PACKAGE.search(source.code)
        package = package_match.group(1) if package_match else ""
        rel = path.relative_to(root).as_posix()
        for match in _DECLARATION.finditer(source.code):
            kind, name = match.group(1), (match.group(2) or "").strip()
            if kind == "class" and not name:
                continue  # ``::class``, ``class`` as a word
            header = _header(source.code, match.end())
            colon = header.find(":")
            if colon >= 0 and word.search(header[colon:]):
                found.append(Implementation(rel, kind if name else "anonymous object", name or "(anonymous)", package))
    return found


def _test_names(source: KotlinSource) -> list[str]:
    calls = "|".join(re.escape(f) for f in _TEST_FUNCTIONS)
    names = []
    for match in re.finditer(rf"(?<![\w.`])(?:{calls})\s*\(\s*\x01(\d+)\x02", source.code):
        names.append(source.strings[int(match.group(1))])
    for match in re.finditer(r"\x01(\d+)\x02\s*(?:-\s*)?\{", source.code):
        names.append(source.strings[int(match.group(1))])
    return names


def rule_12(machine: Machine, target: Target, root: Path) -> list[str]:
    errors = []
    p = target.prefix
    interface = f"{p}Predicates"
    found = implementations(root, target.project, interface)
    where = f"{target.project}/src/main/kotlin"
    if not found:
        errors.append(
            f"rule 12: no object implements {interface} under {where} (expected object {p}Guards : {interface} "
            f"in package {target.package}); each predicate is implemented once in the owner's domain package"
        )
    elif len(found) > 1:
        listed = "; ".join(f"{i.kind} {i.name} in {i.file}" for i in found)
        errors.append(f"rule 12: {interface} is implemented {len(found)} times ({listed}); exactly one object implements it")
    else:
        only = found[0]
        if only.kind != "object":
            errors.append(f"rule 12: {interface} is implemented by the {only.kind} {only.name} in {only.file}; the one implementation is a named object ({p}Guards)")
        if only.package != target.package:
            errors.append(
                f"rule 12: {only.kind} {only.name} in {only.file} is in package {only.package or '(none)'!s}, not in the "
                f"machine's domain package {target.package}"
            )
    test_base = root / target.project / "src" / "test" / "kotlin"
    tests = sorted(test_base.rglob(f"{p}GuardsTest.kt")) if test_base.is_dir() else []
    if not tests:
        errors.append(f"rule 12: no unit-test file {p}GuardsTest.kt under {target.project}/src/test/kotlin")
        return errors
    if len(tests) > 1:
        errors.append(
            f"rule 12: {len(tests)} files named {p}GuardsTest.kt under {target.project}/src/test/kotlin "
            f"({', '.join(t.relative_to(root).as_posix() for t in tests)}); keep one"
        )
        return errors
    rel = tests[0].relative_to(root).as_posix()
    source = scan(tests[0].read_text(encoding="utf-8", errors="replace"))
    disabled = _DISABLING.search(source.code)
    if disabled:
        errors.append(f"rule 12: {rel} disables or skips a test ({disabled.group(0).strip()!r}); a predicate's tests always run")
    names = _test_names(source)
    for predicate in machine.predicates:
        pattern = re.compile(rf"(?<![A-Za-z0-9_]){re.escape(predicate)}(?![A-Za-z0-9_])")
        if not any(pattern.search(name) for name in names):
            errors.append(f"rule 12: predicate {predicate!r} is named in no test name of {rel}")
    return errors
