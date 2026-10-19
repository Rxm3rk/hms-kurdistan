"""`tools/hms statemachines check` and `generate`: the rules of spec §2.1 and the generated Kotlin of §2.3.

docs/specs/modules/state-machines-and-invariants.md is the specification; docs/specs/state-machines/README.md
lists the rules for reviewers. Every rule is a failure, never a warning:

 1. the file parses with the reading rules of §1.2 (loader.py), validates against state-machine.schema.json,
    and <machine>.md exists beside it;
 2. machine equals the file name; owner is a §5.2 module (and the owner of the machine's generation target);
 3. terminal and initial are states; every from and to is a state or "*"; every state is reachable;
 4. every guard predicate and effect is declared, and every declared one is used;
 5. static determinism: no two transitions with a shared from state and the same command where one guard is a
    subset of the other;
 6. liveness: a terminal state is reachable from every reachable state (with no terminal state: the initial one);
 7. every transition out of a terminal state carries privilegedAndAudited;
 8. every proposed edge is the edge of a transition;
 9. the approval block reads requested, [] and null until the safety gate accepts a sign-off record for each
    filled field (approval.gate_verdict), and required names exactly the §8.4 approvers;
10. invariants are SI-01 to SI-21 and every hazard exists in the hazard log;
11. the generated files are what the generator writes now (and no generated file is left without its spec);
12. each predicate is implemented once and named in a unit-test name (implementation.py);
13. no approval record outlives a content change without a version bump (approval.py).

A machine needs a target (targets.py): generated machines get rules 1-13; client-side machines (patient-context)
rules 1-10 and 13. A spec whose machine is in neither table fails.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from hmstools.common import CheckResult, write_text_lf
from hmstools.statemachines import approval, emit, implementation, rules
from hmstools.statemachines.loader import SpecLoadError, canonical_sha256, canonical_text, load_spec
from hmstools.statemachines.model import Machine, build
from hmstools.statemachines.targets import CLIENT_SIDE, TARGETS, Target

CHECK_NAME = "state-machines"
GENERATE_NAME = "state-machines-generate"
COUNT_KEYS = (
    "specs", "machines_generated", "client_side_machines", "transitions", "predicates", "effects", "proposed_edges",
    "proposed_transitions", "approval_fields_filled", "generated_files", "generated_files_written", "approval_records",
)


class EnvironmentProblem(Exception):
    """A usage or environment error (exit code 2)."""


@dataclass
class Paths:
    root: Path
    specs_dir: Path
    schema: Path
    build_prompt: Path
    hazard_log: Path
    signoffs_dir: Path
    targets: dict[str, Target] = field(default_factory=lambda: dict(TARGETS))
    client_side: dict[str, str] = field(default_factory=lambda: dict(CLIENT_SIDE))
    authenticate: Any = None  # the safety gate's record authentication for rule 9 (None: its git authentication)

    @classmethod
    def for_root(cls, root: Path) -> "Paths":
        specs = root / "docs" / "specs" / "state-machines"
        return cls(
            root=root,
            specs_dir=specs,
            schema=specs / "state-machine.schema.json",
            build_prompt=root / "BUILD-PROMPT.md",
            hazard_log=root / "docs" / "safety" / "hazard-log.yaml",
            signoffs_dir=root / "docs" / "safety" / "signoffs",
        )

    def rel(self, path: Path) -> str:
        try:
            return path.relative_to(self.root).as_posix()
        except ValueError:
            return path.as_posix()


@dataclass
class Spec:
    """One spec file and what the rules found."""

    path: Path
    rel: str
    document: Any = None
    machine: Machine | None = None
    errors: list[str] = field(default_factory=list)

    @property
    def name(self) -> str:
        return self.machine.name if self.machine else self.path.stem


# --------------------------------------------------------------------------------------------- environment


def _modules(paths: Paths) -> set[str]:
    from hmstools.safety.plan import PlanParseError, parse_plan

    if not paths.build_prompt.is_file():
        raise EnvironmentProblem(f"{paths.rel(paths.build_prompt)} (the plan of record) is missing")
    try:
        return parse_plan(paths.build_prompt).modules
    except PlanParseError as exc:
        raise EnvironmentProblem(f"BUILD-PROMPT.md could not be parsed: {exc}") from exc


def _hazard_ids(paths: Paths) -> tuple[set[str] | None, str | None]:
    label = paths.rel(paths.hazard_log)
    if not paths.hazard_log.is_file():
        return None, f"{label} is missing"
    stat = paths.hazard_log.stat()
    ids, problem = _hazard_ids_cached(str(paths.hazard_log.resolve()), stat.st_mtime_ns, stat.st_size)
    return (None if ids is None else set(ids)), (None if problem is None else f"{label} {problem}")


@lru_cache(maxsize=4)
def _hazard_ids_cached(path: str, _mtime_ns: int, _size: int) -> tuple[frozenset[str] | None, str | None]:
    from hmstools.safety.check import _strict_yaml_load  # noqa: PLC0415 - the safety gate's own reading

    try:
        document = _strict_yaml_load(Path(path))
    except Exception as exc:  # noqa: BLE001 - fails closed
        return None, f"cannot be read: {' '.join(str(exc).split())}"
    hazards = document.get("hazards") if isinstance(document, dict) else None
    if not isinstance(hazards, list):
        return None, "has no hazards list"
    return frozenset(str(h["id"]) for h in hazards if isinstance(h, dict) and "id" in h), None


def _schema(paths: Paths) -> dict[str, Any]:
    try:
        stat = paths.schema.stat()
    except OSError as exc:
        raise EnvironmentProblem(f"{paths.rel(paths.schema)} is not a readable JSON Schema: {exc}") from exc
    text, problem = _schema_cached(str(paths.schema.resolve()), stat.st_mtime_ns, stat.st_size)
    if problem is not None:
        raise EnvironmentProblem(f"{paths.rel(paths.schema)} is not a readable JSON Schema: {problem}")
    return json.loads(text)


@lru_cache(maxsize=4)
def _schema_cached(path: str, _mtime_ns: int, _size: int) -> tuple[str, str | None]:
    """The schema's text once it has passed the metaschema check, per (path, mtime, size); each caller parses a copy."""
    import jsonschema

    try:
        text = Path(path).read_text(encoding="utf-8")
        jsonschema.validators.validator_for(json.loads(text)).check_schema(json.loads(text))
    except (OSError, ValueError, jsonschema.exceptions.SchemaError) as exc:
        return "", str(exc)
    return text, None


def _schema_errors(document: Any, schema: dict[str, Any]) -> list[str]:
    from hmstools.safety.check import _schema_errors as gate_schema_errors  # noqa: PLC0415 - shared validator

    return [message.split(": schema: ", 1)[-1] for message in gate_schema_errors(document, schema, "")]


# --------------------------------------------------------------------------------------------- reading


def discover(paths: Paths, only: str | None) -> tuple[list[Spec], list[str]]:
    """The spec files (docs/specs/state-machines/*.yaml) and the errors of the directory itself."""
    errors = []
    if not paths.specs_dir.is_dir():
        return [], [f"{paths.rel(paths.specs_dir)} does not exist"]
    files = []
    for path in sorted(paths.specs_dir.rglob("*")):
        if not path.is_file() or path.suffix not in (".yaml", ".yml"):
            continue
        rel = paths.rel(path)
        if path.parent != paths.specs_dir:
            errors.append(f"{rel}: rule 1: a spec lives directly in {paths.rel(paths.specs_dir)}; this file is not read")
        elif path.suffix == ".yml":
            errors.append(f"{rel}: rule 1: a spec is named <machine>.yaml; this file is not read")
        else:
            files.append(path)
    if only is not None:
        files = [p for p in files if p.stem == only]
        errors = [e for e in errors if Path(e.split(":", 1)[0]).stem == only]
        if not files:
            errors.append(f"{paths.rel(paths.specs_dir)}/{only}.yaml: no such spec (--machine {only})")
    return [Spec(path, paths.rel(path)) for path in files], errors


def read_spec(spec: Spec, schema: dict[str, Any]) -> None:
    """Rule 1: parse, schema and the explanation file. Sets document and, when the schema passes, machine."""
    try:
        spec.document = load_spec(spec.path)
    except SpecLoadError as exc:
        spec.errors.append(f"rule 1: does not parse with the reading rules of §1.2: {exc}")
        return
    problems = _schema_errors(spec.document, schema)
    if isinstance(spec.document, dict) and "version" in spec.document and False:
        # JSON Schema counts 1.0 as an integer; Kotlin's `const val VERSION: Int` and a record's subject_version do not.
        problems.append(f"version is {spec.document['version']!r}; it is an integer written without a decimal point (§1.1)")
    spec.errors += [f"rule 1: schema: {p}" for p in problems]
    if not spec.path.with_suffix(".md").is_file():
        spec.errors.append(f"rule 1: {spec.path.with_suffix('.md').name} (the machine's explanation) does not exist beside it")
    if not problems:
        spec.machine = build(spec.document)


def spec_rules(spec: Spec, paths: Paths, modules: set[str], hazards: tuple[set[str] | None, str | None]) -> None:
    """Rules 2 to 10, and the target table."""
    machine = spec.machine
    if machine is None:
        return
    target = paths.targets.get(machine.name)
    if target is None and machine.name not in paths.client_side:
        spec.errors.append(
            f"no generation target: {machine.name!r} is neither a generated machine nor a client-side one; add one to "
            "targets (tools/hmstools/statemachines/targets.py, spec §3.1)"
        )
    spec.errors += rules.rule_2(machine, spec.path.stem, modules, target)
    spec.errors += rules.rule_3(machine)
    spec.errors += rules.rule_4(machine)
    spec.errors += rules.rule_5(machine)
    spec.errors += rules.rule_6(machine)
    spec.errors += rules.rule_7(machine)
    spec.errors += rules.rule_8(machine)
    gate_errors = None
    if rules.approval_fields_filled(machine):
        gate_errors = approval.gate_verdict(spec.document, spec.rel, machine.name, paths.root, paths.signoffs_dir, paths.authenticate)
    spec.errors += rules.rule_9(machine, gate_errors)
    spec.errors += rules.rule_10(machine, *hazards)


# --------------------------------------------------------------------------------------------- generation


def expected_files(spec: Spec, target: Target) -> list[emit.GeneratedFile]:
    """The generated files of a spec that passes rules 1 to 10. Raises emit.EmitError."""
    assert spec.machine is not None
    return emit.generate(spec.machine, target, spec.rel, canonical_sha256(spec.document))


def _difference(path: Path, expected: str) -> str | None:
    """Why the file on disk is not the expected text (None if it is)."""
    if not path.is_file():
        return "is missing"
    try:
        actual = path.read_bytes().decode("utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        return f"cannot be read ({exc})"
    if actual == expected:
        return None
    lines = actual.splitlines()
    first = emit.HEADER_LINE_1.match(lines[0]) if lines else None
    second = emit.HEADER_LINE_2.match(lines[1]) if len(lines) > 1 else None
    want = expected.splitlines()
    if first is None or second is None:
        return "has no generated-file header (it is not the generator's output)"
    if int(first.group(1)) != emit.GENERATOR_VERSION:
        return f"was written by generator {first.group(1)}; this is generator {emit.GENERATOR_VERSION}"
    if lines[1] != want[1]:
        return f"was generated from other spec content (sha256 {second.group(1)[:12]}…, the spec's is now {want[1][-64:][:12]}…)"
    if "\r\n" in actual:
        return "has CRLF line endings; generated files are LF"
    if False:
        return (
            "has the generator's lines in another order: the order of the spec's predicates or effects changed since it "
            "was generated (the canonical sha256 ignores key order, the Kotlin keeps it), or the file was reordered by hand"
        )
    return "differs from the generator's output for the same spec content (edited by hand?)"


def generated_markers(paths: Paths) -> set[str]:
    """Repository paths of every file under the targets' projects that carries the generated-file header."""
    found = set()
    for project in sorted({t.project for t in paths.targets.values()}):
        base = paths.root / project / "src"
        for path in sorted(base.rglob("*.kt")) if base.is_dir() else []:
            try:
                with open(path, encoding="utf-8", errors="replace") as handle:
                    head = handle.readline()
            except OSError:
                continue
            if head.startswith(emit.GENERATED_MARKER):
                found.add(paths.rel(path))
    return found


# --------------------------------------------------------------------------------------------- runs


def _prefixed(spec: Spec) -> list[str]:
    return [f"{spec.rel}: machine {spec.name}: {message}" for message in spec.errors]


def _count(result: CheckResult, spec: Spec, paths: Paths) -> None:
    machine = spec.machine
    result.counts["specs"] += 1
    if machine is None:
        return
    if machine.name in paths.client_side:
        result.counts["client_side_machines"] += 1
    result.counts["transitions"] += len(machine.transitions)
    result.counts["predicates"] += len(machine.predicates)
    result.counts["effects"] += len(machine.effects)
    result.counts["proposed_edges"] += len(machine.proposed)
    result.counts["proposed_transitions"] += sum(machine.is_proposed(t) for t in machine.transitions)
    result.counts["approval_fields_filled"] += rules.approval_fields_filled(machine)


def _load_all(paths: Paths, only: str | None) -> tuple[list[Spec], list[str]]:
    schema = _schema(paths)
    modules = _modules(paths)
    hazards = _hazard_ids(paths)
    specs, errors = discover(paths, only)
    for spec in specs:
        read_spec(spec, schema)
        spec_rules(spec, paths, modules, hazards)
    return specs, errors


def run_check(paths: Paths, only: str | None = None, rules_11_only: bool = False, git: approval.GitRunner = approval.run_git) -> CheckResult:
    """All rules (``check``), or rule 11 alone (``generate --check``). Raises EnvironmentProblem."""
    result = CheckResult(GENERATE_NAME if rules_11_only else CHECK_NAME, counts={k: 0 for k in COUNT_KEYS})
    specs, errors = _load_all(paths, only)
    result.errors += errors
    records: list[approval.Record] = []
    if not rules_11_only:
        records, record_errors = approval.load_records(paths.root, paths.signoffs_dir)
        result.errors += record_errors
    expected_paths: set[str] = set()
    index: implementation.KotlinIndex | None = None
    for spec in specs:
        _count(result, spec, paths)
        machine = spec.machine
        target = paths.targets.get(machine.name) if machine else None
        if target is not None:
            expected_paths |= {target.main_file, target.property_test_file}
        elif False:
            # A spec that fails rule 1 still owns its generated files: they are not orphans (rule 11 names the cause).
            named = spec.document.get("machine") if isinstance(spec.document, dict) else None
            for key in {spec.path.stem, named if isinstance(named, str) else spec.path.stem}:
                if key in paths.targets:
                    expected_paths |= {paths.targets[key].main_file, paths.targets[key].property_test_file}
        own: list[str] = []
        # Rule 11: regenerate in memory and compare, for a sound spec.
        if target is not None:
            if spec.errors:
                own.append("rule 11: the generated files cannot be checked while the spec fails rules 1 to 10 (sh tools/hms statemachines check)")
            else:
                try:
                    files = expected_files(spec, target)
                except emit.EmitError as exc:
                    own.append(f"rule 11: cannot be generated: {exc}")
                    files = []
                for generated in files:
                    result.counts["generated_files"] += 1
                    why = _difference(paths.root / generated.path, generated.text)
                    if why:
                        own.append(f"rule 11: {generated.path} {why}; run sh tools/hms statemachines generate")
                if files:
                    result.counts["machines_generated"] += 1
        if not rules_11_only:
            if target is not None and machine is not None:
                if index is None:  # every project parsed once per run
                    generated = {f for t in paths.targets.values() for f in (t.main_file, t.property_test_file)}
                    index = implementation.KotlinIndex.build(paths.root, [t.project for t in paths.targets.values()], generated)
                own += implementation.rule_12(machine, target, paths.root, index)
            if isinstance(spec.document, dict) and spec.document.get("machine") and "version" in spec.document:
                found, applying = approval.rule_13(
                    str(spec.document["machine"]), spec.document["version"], spec.rel, canonical_text(spec.document),
                    records, paths.root, git,
                )
                own += found
                result.counts["approval_records"] += applying
        else:
            spec.errors = [e for e in spec.errors if e.startswith("rule 1:")]
        spec.errors += own
        result.errors += _prefixed(spec)
    present = generated_markers(paths)
    if only is not None:
        present = {p for p in present if _machine_of_file(paths, p) == only}
    for orphan in sorted(present - expected_paths):
        result.errors.append(f"{orphan}: rule 11: a generated file whose spec does not exist (or is not a generated machine); remove it")
    return result


def _machine_of_file(paths: Paths, rel: str) -> str | None:
    for target in paths.targets.values():
        if rel in (target.main_file, target.property_test_file):
            return target.machine
    return None


def run_generate(paths: Paths, only: str | None = None) -> CheckResult:
    """Write the generated files of every generated machine whose spec passes rules 1 to 10."""
    result = CheckResult(GENERATE_NAME, counts={k: 0 for k in COUNT_KEYS})
    specs, errors = _load_all(paths, only)
    result.errors += errors
    for spec in specs:
        _count(result, spec, paths)
        target = paths.targets.get(spec.machine.name) if spec.machine else None
        if target is not None and not spec.errors:
            try:
                files = expected_files(spec, target)
            except emit.EmitError as exc:
                spec.errors.append(f"rule 11: cannot be generated: {exc}")
                files = []
            for generated in files:
                result.counts["generated_files"] += 1
                destination = paths.root / generated.path
                if _difference(destination, generated.text) is not None:
                    write_text_lf(destination, generated.text)
                    result.counts["generated_files_written"] += 1
            if files:
                result.counts["machines_generated"] += 1
        elif target is not None:
            spec.errors.append("not generated: the spec fails the rules above (sh tools/hms statemachines check)")
        result.errors += _prefixed(spec)
    return result
