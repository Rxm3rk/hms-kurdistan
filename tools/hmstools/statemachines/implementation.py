"""Rule 12 of spec §2.1: each predicate is implemented once and unit-tested.

A textual scan of Kotlin source (the compiler is the real check that the object implements every predicate, the
second half of rule 4). The scan covers every source set (``src/*/kotlin``) of every generation target's Gradle
project and every Kotlin file of the cross-module test projects under ``tests/`` (``tests/invariants``,
``tests/scenarios``: their ``build`` directories excepted), so a second implementation in ``src/testFixtures``
(where ``<P>Arbs`` lives), in ``src/propertyTest`` or in ``tests/invariants`` is seen. The generated files of the
targets are not scanned: rule 11 pins their exact content.

Implementations of ``<P>Predicates`` are collected to a fixpoint. A type denotes the interface when it is the
interface itself, an import alias of it (``import ...<P>Predicates as Q``), a type alias of it
(``typealias Q = <P>Predicates``), or a class or interface already collected (so ``object W : Loose`` counts when
``interface Loose : <P>Predicates``, and ``object V : Base()`` when ``open class Base : <P>Predicates``). Any
declaration whose supertypes name such a type implements the interface: an ``object``, a ``companion object``, a
``class``, an anonymous ``object :`` and delegation (``: <P>Predicates by X``) included. Then:

- no interface may extend ``<P>Predicates`` (directly or through another): each one fails;
- exactly one implementation exists, and it is ``object <P>Guards``, in ``src/main/kotlin`` of the owner project,
  in the machine's package.

The unit-test file: ``src/test/kotlin`` of the owner project holds exactly one ``<P>GuardsTest.kt``, it declares
``class <P>GuardsTest``, and every predicate's camelCase name appears, as a whole word, in at least one counted
test name inside that class (its constructor lambda or its body). A test name is the first string literal of a
Kotest call. It counts when the call is a leaf test (``test``, ``should``, ``it``, ``expect``, ``scenario``,
``then``/``Then``, a string-spec leaf ``"..." {``), or a container (``context``, ``describe``, ``feature``,
``given``/``Given``, ``when``/``When``, ``and``/``And``, a free-spec container ``"..." - {``) whose body holds at
least one leaf test. A container with no test in it, and a name outside the spec class (a helper that nothing
runs), do not count. A file that disables or skips a test fails: an ``x``-prefixed call (``xtest``, ``xGiven``
...), any test name starting with ``!`` (Kotest disables it) or ``f:`` (Kotest focuses it and silently skips every
other test of the spec), ``enabled = `` with anything but the literal ``true``, ``enabledIf``,
``enabledOrReasonIf``, ``invocations = 0``, and the annotations ``@EnabledIf``, ``@DisabledIf``, ``@Ignored``,
``@Disabled`` and their kin in any letter case.

What a text scan cannot check is left to review: contracts §4 asks, for every predicate, for one case where it
holds and one where it does not.

Comments and string contents are removed before the code is scanned, so a KDoc or a string that names the
interface is not an implementation.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from hmstools.statemachines.model import Machine
from hmstools.statemachines.targets import Target

# Kotest test functions: a leaf is a test; a container counts only if it holds a leaf.
_LEAF_FUNCTIONS = ("test", "should", "it", "expect", "scenario", "then", "Then")
_CONTAINER_FUNCTIONS = ("context", "describe", "feature", "given", "Given", "`when`", "when", "When", "and", "And")
_DISABLING = re.compile(
    r"\bx(?i:test|context|should|describe|it|expect|feature|scenario|given|when|then|and)\s*\(|"
    r"\benabled\s*=\s*(?!true\s*(?:[,)}]|$))|\benabledIf\b|\benabledOrReasonIf\b|\binvocations\s*=\s*0\b|"
    r"(?i:@(?:enabled|disabled|ignored?)\w*)",
    re.MULTILINE,
)
_SKIPPING_PREFIXES = (("!", "Kotest disables a test whose name starts with '!'"),
                      ("f:", "Kotest runs only the focused tests of a spec whose test name starts with 'f:', and skips every other one"))


@dataclass
class KotlinSource:
    code: str  # comments removed, each string literal replaced by a placeholder \x01<n>\x02
    strings: list[str]  # the literals' contents, as written


_CODE_SPECIAL = re.compile(r"//|/\*|[\"']")
_COMMENT_SPECIAL = re.compile(r"/\*|\*/")
_STRING_SPECIAL = re.compile(r"\"|\\.|\$\{", re.DOTALL)
_RAW_SPECIAL = re.compile(r"\"\"\"|\$\{")
_CHAR_LITERAL = re.compile(r"'(?:\\u[0-9A-Fa-f]{4}|\\.|[^'\\])'")


def scan(text: str) -> KotlinSource:
    """Split Kotlin source into code and string literals (nested comments, raw strings, templates, char literals)."""
    code: list[str] = []
    strings: list[str] = []
    n = len(text)

    def read_string(start: int) -> int:
        """Read the literal starting at ``start``; append its content; return the index after it."""
        raw = text.startswith('"""', start)
        special = _RAW_SPECIAL if raw else _STRING_SPECIAL
        j = start + (3 if raw else 1)
        content: list[str] = []
        while j < n:
            match = special.search(text, j)
            if match is None:
                content.append(text[j:])
                j = n
                break
            content.append(text[j:match.start()])
            j = match.start()
            token = match.group(0)
            if raw and token == '"""':
                j += 3
                while j < n and text[j] == '"':  # """"" ends with the last three quotes
                    content.append('"')
                    j += 1
                break
            if token == '"':
                j += 1
                break
            if token.startswith("\\"):
                content.append(token)
                j += 2
                continue
            depth, k = 1, j + 2  # a template ${...}: its literals are part of this literal
            while k < n and depth:
                if text[k] == '"':
                    k = read_string(k)
                    strings.pop()
                    continue
                depth += {"{": 1, "}": -1}.get(text[k], 0)
                k += 1
            content.append(text[j:k])
            j = k
        strings.append("".join(content))
        return j

    i = 0
    while i < n:
        match = _CODE_SPECIAL.search(text, i)
        if match is None:
            code.append(text[i:])
            break
        code.append(text[i:match.start()])
        i = match.start()
        token = match.group(0)
        if token == "//":
            end = text.find("\n", i)
            i = n if end < 0 else end
        elif token == "/*":
            depth, i = 1, i + 2
            while depth:
                inner = _COMMENT_SPECIAL.search(text, i)
                if inner is None:
                    i = n
                    break
                depth += 1 if inner.group(0) == "/*" else -1
                i = inner.end()
            code.append(" ")
        elif token == '"':
            i = read_string(i)
            code.append(f"\x01{len(strings) - 1}\x02")
        else:
            literal = _CHAR_LITERAL.match(text, i)
            length = literal.end() - i if literal else 1
            code.append(" " * length)
            i += length
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
    kind: str  # "object", "companion object", "class", "interface" or "anonymous object"
    name: str
    package: str
    position: int = 0

    @property
    def label(self) -> str:
        return f"{self.kind} {self.name} in {self.file}"


@dataclass(frozen=True)
class _Declaration:
    kind: str
    name: str
    supertypes: str  # the header after its ':' (parenthesised and angle-bracketed parts removed); "" if none
    position: int


@dataclass
class KotlinFile:
    rel: str
    package: str
    imports: list[tuple[str, str]]  # (qualified name, alias) for each ``import X as Y``
    typealiases: list[tuple[str, str]]  # (alias, the aliased type's qualified name)
    declarations: list[_Declaration]


_DECLARATION = re.compile(r"\b(?:(companion)\s+)?(object|class|interface)\b(\s+[A-Za-z_]\w*)?")
_PACKAGE = re.compile(r"^\s*package\s+([A-Za-z_][\w.]*)", re.MULTILINE)
_IMPORT_ALIAS = re.compile(r"^\s*import\s+([A-Za-z_][\w.]*)\s+as\s+([A-Za-z_]\w*)", re.MULTILINE)
_TYPEALIAS = re.compile(r"\btypealias\s+([A-Za-z_]\w*)\s*(?:<[^=]*>)?\s*=\s*([A-Za-z_][\w.]*)")


def parse_file(rel: str, text: str) -> KotlinFile:
    code = scan(text).code.replace("`", "")
    package_match = _PACKAGE.search(code)
    declarations = []
    for match in _DECLARATION.finditer(code):
        companion, kind, name = match.group(1), match.group(2), (match.group(3) or "").strip()
        if kind != "object" and not name:
            continue  # ``::class``, ``class`` or ``interface`` as a word
        header = _header(code, match.end())
        colon = header.find(":")
        if companion:
            kind = "companion object"
        elif kind == "object" and not name:
            kind = "anonymous object"
        declarations.append(_Declaration(kind, name or "(anonymous)", header[colon + 1:] if colon >= 0 else "", match.start()))
    return KotlinFile(
        rel=rel,
        package=package_match.group(1) if package_match else "",
        imports=[(m.group(1), m.group(2)) for m in _IMPORT_ALIAS.finditer(code)],
        typealiases=[(m.group(1), m.group(2)) for m in _TYPEALIAS.finditer(code)],
        declarations=declarations,
    )


_PRUNED = frozenset(("build", ".gradle", "node_modules"))


def _simple(name: str) -> str:
    return name.rsplit(".", 1)[-1]


def _names_pattern(names: Iterable[str]) -> re.Pattern[str]:
    alternatives = "|".join(re.escape(n) for n in sorted(names))
    return re.compile(rf"(?<![\w.])(?:[\w.]+\.)?(?:{alternatives})\b")


@dataclass
class KotlinIndex:
    """The parsed Kotlin files rule 12 reads, each file read and parsed once per run."""

    root: Path
    files: list[KotlinFile] = field(default_factory=list)

    @classmethod
    def build(cls, root: Path, projects: Iterable[str], skip: Iterable[str] = ()) -> "KotlinIndex":
        """Every ``*.kt`` under ``<project>/src`` and under ``tests/`` (``build`` and ``.gradle`` directories
        excepted), without the repository paths in ``skip`` (the generated files)."""
        skipped = set(skip)
        paths: set[Path] = set()
        for base in [*(root / p / "src" for p in sorted(set(projects))), root / "tests"]:
            for directory, subdirectories, names in os.walk(base):
                subdirectories[:] = sorted(d for d in subdirectories if d not in _PRUNED)
                paths.update(Path(directory) / n for n in names if n.endswith(".kt"))
        index = cls(root)
        for path in sorted(paths):
            rel = path.relative_to(root).as_posix()
            if rel in skipped or not path.is_file():
                continue
            index.files.append(parse_file(rel, path.read_text(encoding="utf-8", errors="replace")))
        return index

    def implementations(self, interface: str) -> list[Implementation]:
        """Every declaration that implements ``interface``, directly or through an alias or a collected subtype."""
        names = {interface}
        found: dict[tuple[str, int], Implementation] = {}
        changed = True
        while changed:
            changed = False
            for kotlin in self.files:
                local = set(names)
                local.update(alias for qualified, alias in kotlin.imports if _simple(qualified) in names)
                for alias, aliased in kotlin.typealiases:
                    if _simple(aliased) in local and alias not in names:
                        names.add(alias)
                        local.add(alias)
                        changed = True
                pattern = _names_pattern(local)
                for declaration in kotlin.declarations:
                    if not declaration.supertypes or not pattern.search(declaration.supertypes):
                        continue
                    key = (kotlin.rel, declaration.position)
                    if key not in found:
                        found[key] = Implementation(kotlin.rel, declaration.kind, declaration.name, kotlin.package, declaration.position)
                        changed = True
                    if declaration.kind in ("class", "interface") and declaration.name not in names:
                        names.add(declaration.name)
                        changed = True
        return [found[key] for key in sorted(found)]


def implementations(root: Path, project: str, interface: str) -> list[Implementation]:
    """The implementations of ``interface`` in ``project``'s source sets and under ``tests/``."""
    return KotlinIndex.build(root, [project]).implementations(interface)


# --------------------------------------------------------------------------------------------- the test file


_BRACE = re.compile(r"[{}]")
_CALL_TOKEN = re.compile(r"[(){};]")


def _block_end(code: str, opening: int) -> int:
    """The index of the ``}`` that closes the ``{`` at ``opening`` (len(code) if it is not closed)."""
    depth = 0
    for match in _BRACE.finditer(code, opening):
        depth += 1 if match.group(0) == "{" else -1
        if depth == 0:
            return match.start()
    return len(code)


def spec_region(code: str, class_name: str) -> tuple[int, int] | None:
    """The span of the spec class's tests: its constructor lambda (``: FunSpec({ ... })``) and its body
    (``{ init { ... } }``), from the first ``{`` after the class name to the end of the class."""
    match = re.search(rf"\bclass\s+{re.escape(class_name)}\b", code)
    if match is None:
        return None
    opening = code.find("{", match.end())
    if opening < 0:
        return None
    end = _block_end(code, opening)
    after = re.match(r"\s*\)\s*\{", code[end + 1:])
    if after is not None:  # the lambda was a constructor argument; a class body may follow
        end = _block_end(code, end + after.end())
    return opening, end


def _body_after(code: str, start: int) -> tuple[int, int] | None:
    """The block of a test call whose argument list is open at ``start``: the first ``{`` after the call's ``)``
    (a ``.config(...)`` in between is skipped), and its closing brace."""
    depth = 1
    for match in _CALL_TOKEN.finditer(code, start):
        char = match.group(0)
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "{" and depth == 0:
            return match.start(), _block_end(code, match.start())
        elif char in "};" and depth == 0:
            return None
    return None


def _calls(names: Iterable[str]) -> str:
    return "|".join(re.escape(f) for f in names)


_LEAF_CALL = re.compile(rf"(?<![\w.`])(?:{_calls(_LEAF_FUNCTIONS)})\s*\(\s*\x01\d+\x02")
_CONTAINER_CALL = re.compile(rf"(?<![\w.`])(?:{_calls(_CONTAINER_FUNCTIONS)})\s*\(\s*\x01(\d+)\x02")
_ANY_CALL = re.compile(rf"(?<![\w.`])(?:{_calls((*_LEAF_FUNCTIONS, *_CONTAINER_FUNCTIONS))})\s*\(\s*\x01(\d+)\x02")
_STRING_LEAF = re.compile(r"\x01(\d+)\x02\s*\{")
_STRING_CONTAINER = re.compile(r"\x01(\d+)\x02\s*-\s*\{")


def _holds_a_leaf(code: str) -> bool:
    return bool(_LEAF_CALL.search(code) or _STRING_LEAF.search(code))


def all_test_names(source: KotlinSource) -> list[str]:
    """Every test or container name in the file, wherever it is (for the disabling prefixes)."""
    code = source.code
    numbers = [m.group(1) for m in _ANY_CALL.finditer(code)]
    numbers += [m.group(1) for m in _STRING_LEAF.finditer(code)] + [m.group(1) for m in _STRING_CONTAINER.finditer(code)]
    return [source.strings[int(n)] for n in numbers]


def counted_test_names(source: KotlinSource, region: tuple[int, int]) -> list[str]:
    """The names that count for rule 12: leaf tests, and containers holding a leaf, inside ``region``."""
    code = source.code
    start, end = region
    names: list[str] = []
    for match in _LEAF_CALL.finditer(code, start, end):
        names.append(source.strings[int(re.search(r"\x01(\d+)\x02", match.group(0)).group(1))])
    for match in _STRING_LEAF.finditer(code, start, end):
        names.append(source.strings[int(match.group(1))])
    for pattern in (_CONTAINER_CALL, _STRING_CONTAINER):
        for match in pattern.finditer(code, start, end):
            body = _body_after(code, match.end()) if pattern is _CONTAINER_CALL else (match.end() - 1, _block_end(code, match.end() - 1))
            if body is not None and _holds_a_leaf(code[body[0] + 1:body[1]]):
                names.append(source.strings[int(match.group(1))])
    return names


def _test_file_errors(machine: Machine, p: str, rel: str, text: str) -> list[str]:
    errors = []
    source = scan(text)
    disabled = _DISABLING.search(source.code)
    if disabled:
        errors.append(f"rule 12: {rel} disables or skips a test ({disabled.group(0).strip()!r}); a predicate's tests always run")
    for name in all_test_names(source):
        for prefix, why in _SKIPPING_PREFIXES:
            if name.lstrip().startswith(prefix):
                errors.append(f"rule 12: {rel} disables or skips a test: the test name {name!r} starts with {prefix!r} ({why})")
    region = spec_region(source.code, f"{p}GuardsTest")
    if region is None:
        errors.append(f"rule 12: {rel} declares no class {p}GuardsTest, so none of its test names count")
        names: list[str] = []
    else:
        names = counted_test_names(source, region)
    for predicate in machine.predicates:
        pattern = re.compile(rf"(?<![A-Za-z0-9_]){re.escape(predicate)}(?![A-Za-z0-9_])")
        if not any(pattern.search(name) for name in names):
            errors.append(
                f"rule 12: predicate {predicate!r} is named in no test name of {rel} (a leaf test, or a container that "
                f"holds one, inside class {p}GuardsTest)"
            )
    return errors


# --------------------------------------------------------------------------------------------- the rule


def rule_12(machine: Machine, target: Target, root: Path, index: KotlinIndex | None = None) -> list[str]:
    errors = []
    p = target.prefix
    interface = f"{p}Predicates"
    guards = f"{p}Guards"
    main = f"{target.project}/src/main/kotlin/"
    found = (index or KotlinIndex.build(root, [target.project])).implementations(interface)
    for sub in (i for i in found if i.kind == "interface"):
        errors.append(
            f"rule 12: {sub.label} extends {interface} (directly or through an alias or another type); no interface may "
            f"extend it, so that its one implementation is object {guards}"
        )
    implementors = [i for i in found if i.kind != "interface"]
    if not implementors:
        errors.append(
            f"rule 12: no object implements {interface} under {main.rstrip('/')} (expected object {guards} : {interface} "
            f"in package {target.package}); each predicate is implemented once in the owner's domain package"
        )
    elif len(implementors) > 1:
        listed = "; ".join(i.label for i in implementors)
        errors.append(
            f"rule 12: {interface} is implemented {len(implementors)} times ({listed}); exactly one object implements it, "
            f"{guards} in {main.rstrip('/')}"
        )
    else:
        only = implementors[0]
        if only.kind != "object":
            errors.append(f"rule 12: {interface} is implemented by the {only.kind} {only.name} in {only.file}; the one implementation is a named object ({guards})")
        elif only.name != guards:
            errors.append(f"rule 12: {interface} is implemented by object {only.name} in {only.file}; the one implementation is named {guards}")
        if not only.file.startswith(main):
            errors.append(f"rule 12: {only.label} is not in {main.rstrip('/')}; the one implementation is domain code (src/main)")
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
    return errors + _test_file_errors(machine, p, rel, tests[0].read_text(encoding="utf-8", errors="replace"))
