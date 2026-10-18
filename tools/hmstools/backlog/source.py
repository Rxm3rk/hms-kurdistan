"""Parse BUILD-PROMPT.md Appendix A: the feature tables (A.1 to A.17) and the A.18 totals.

A feature table is any table under a ``### A.n GRP: Name`` heading inside Appendix A whose header row is
exactly ``ID | Feature | Size | Phase | Stance | Scope · Kurdistan note``. Every row must parse; anything
unexpected raises SourceError naming the line, so a change in the plan's shape is never silently skipped.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

FEATURE_HEADER = ("ID", "Feature", "Size", "Phase", "Stance", "Scope · Kurdistan note")
A18_HEADER = ("Phase", "Feature IDs", "Engineer-weeks")
PHASES = ("R1", "R1.1", "R2a", "R2b", "R2.1", "P2", "P3", "DROPPED-K")
SIZE_CODES = {"S": 3, "M": 8, "L": 20, "XL": 50}  # engineer-weeks (Appendix A preamble)

FEATURE_ID_RE = re.compile(r"[A-Z][A-Z0-9]*(?:-[A-Z0-9]+[a-z]?)+")  # PLT-CORE-01, AI-DAT-02a, DX-BB-KRI-01
_SECTION_RE = re.compile(r"^### (?P<section>A\.\d+) (?P<group>[A-Z]+): (?P<name>.+?)\s*$")
_ID_CELL_RE = re.compile(r"^`(?P<inner>[^`]+)`$")
_PART_RE = re.compile(r"^(?P<id>\S+) · part: (?P<part>.+)$")
_STANCE_RE = re.compile(r"^(?P<stance>[BIP](?:\+[BIP])*)(?P<dagger>†?)$")
_NOTE_RE = re.compile(r"^(?P<scope>.*?) · \*(?P<note>[^*]+)\*$")
_SIZE_RE = re.compile(r"^(?P<codes>(?:XL|S|M|L)(?:\+(?:XL|S|M|L))*)(?: \((?P<annotation>[^()]+)\))?$")
_APPROX_RE = re.compile(r"^≈(?P<n>\d+) ew$")
_MINUS_RE = re.compile(r"^[−-](?P<n>\d+)$")
_NET_RE = re.compile(r"^\+(?P<n>\d+) net$")
_MVP_RE = re.compile(r"^MVP \((?P<first>\S+) to (?P<last>\S+)\)$")
_AI_NOTE_RE = re.compile(
    r"costs the AI gateway and control plane at (?P<k>\d+) engineer-weeks where R14 sizes them at (?P<r14>\d+)"
)


class SourceError(ValueError):
    """The plan text does not have the shape this parser expects."""


def record_key(feature_id: str, part: str | None) -> str:
    """The unique key of a backlog row: the feature ID, or 'ID · part: name' for a part row."""
    return feature_id if part is None else f"{feature_id} · part: {part}"


def split_row(line: str) -> list[str]:
    """Split a Markdown table row into stripped cell texts. ``\\|`` is an escaped pipe inside a cell."""
    text = line.strip()
    if not text.startswith("|"):
        raise SourceError(f"not a table row: {line!r}")
    body = text[1:]
    cells: list[str] = []
    buf: list[str] = []
    i = 0
    closed = False
    while i < len(body):
        ch = body[i]
        if ch == "\\" and i + 1 < len(body) and body[i + 1] == "|":
            buf.append("|")
            i += 2
            continue
        if ch == "|":
            cells.append("".join(buf).strip())
            buf = []
            closed = i == len(body) - 1
        else:
            buf.append(ch)
        i += 1
    if not closed:
        cells.append("".join(buf).strip())
    return cells


def split_note(cell: str) -> tuple[str, str | None]:
    """Split 'scope · *note*' into (scope, note). A cell without an italic note returns (cell, None)."""
    if " · *" not in cell:
        return cell, None
    match = _NOTE_RE.match(cell)
    if not match:
        raise SourceError(f"italic note after ' · ' is not of the form '*note*' at the end of the cell: {cell!r}")
    return match.group("scope"), match.group("note")


@dataclass(frozen=True)
class SizeReading:
    """How a size cell turns into engineer-weeks."""

    ew: int  # the count used for the A.18 comparison
    face_value: int  # the size code(s) alone, ignoring any bracketed annotation
    plain: bool  # True for a bare S, M, L or XL
    reading: str  # one line explaining the count


def size_reading(size: str) -> SizeReading:
    """Engineer-weeks for a size cell: S=3, M=8, L=20, XL=50; 'L+M' sums; '≈n ew' is n.

    Bracketed annotations: '(BP ...)' records BP's size history and does not change the count; '(−n)'
    subtracts n; '(+n net)' counts n, the net addition over the feature the row extends. Anything else
    raises SourceError (fail closed).
    """
    approx = _APPROX_RE.match(size)
    if approx:
        n = int(approx.group("n"))
        return SizeReading(n, n, False, f"≈{n} ew counts {n}")
    match = _SIZE_RE.match(size)
    if not match:
        raise SourceError(f"unknown size {size!r}")
    codes = match.group("codes").split("+")
    face = sum(SIZE_CODES[c] for c in codes)
    if len(codes) == 1:
        face_text = f"{codes[0]} = {face}"
    else:
        face_text = " + ".join(codes) + " = " + " + ".join(str(SIZE_CODES[c]) for c in codes) + f" = {face}"
    annotation = match.group("annotation")
    if annotation is None:
        return SizeReading(face, face, len(codes) == 1, face_text)
    minus = _MINUS_RE.match(annotation)
    if minus:
        n = int(minus.group("n"))
        return SizeReading(face - n, face, False, f"{face_text}, less {n} = {face - n}")
    net = _NET_RE.match(annotation)
    if net:
        n = int(net.group("n"))
        return SizeReading(n, face, False, f"+{n} net counts {n} (the code alone is {face_text})")
    if annotation.startswith("BP "):
        return SizeReading(face, face, False, f"{face_text}; ({annotation}) is BP's size history")
    raise SourceError(f"unknown size annotation in {size!r}")


@dataclass(frozen=True)
class SourceRow:
    line: int  # 1-based line number in BUILD-PROMPT.md
    text: str  # the raw table row
    section: str
    group: str


@dataclass(frozen=True)
class Feature:
    id: str
    part: str | None
    group: str
    section: str
    title: str
    size: str
    phase: str
    stance: str
    domain_level: bool
    scope: str
    kurdistan_note: str | None
    placement_marked: bool
    row: SourceRow

    @property
    def key(self) -> str:
        return record_key(self.id, self.part)


@dataclass(frozen=True)
class Section:
    section: str  # A.1
    group: str  # PLT
    name: str  # Platform/NFR
    line: int


def _appendix_a_bounds(lines: list[str]) -> tuple[int, int]:
    start = next((i for i, line in enumerate(lines) if line.startswith("## Appendix A.")), None)
    if start is None:
        raise SourceError("heading '## Appendix A.' not found")
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    return start, end


def parse_feature_row(cells: list[str], row: SourceRow) -> Feature:
    where = f"line {row.line}"
    if len(cells) != len(FEATURE_HEADER):
        raise SourceError(f"{where}: expected {len(FEATURE_HEADER)} cells, found {len(cells)}")
    id_cell, title, size, phase, stance_cell, scope_cell = cells
    id_match = _ID_CELL_RE.match(id_cell)
    if not id_match:
        raise SourceError(f"{where}: the ID cell is not one code span: {id_cell!r}")
    inner = id_match.group("inner")
    part_match = _PART_RE.match(inner)
    feature_id, part = (part_match.group("id"), part_match.group("part")) if part_match else (inner, None)
    if not FEATURE_ID_RE.fullmatch(feature_id):
        raise SourceError(f"{where}: {feature_id!r} is not a feature ID")
    if feature_id.split("-")[0] != row.group:
        raise SourceError(f"{where}: {feature_id} does not belong to group {row.group} ({row.section})")
    if not title:
        raise SourceError(f"{where}: empty Feature cell")
    size_reading(size)  # validates
    if phase not in PHASES:
        raise SourceError(f"{where}: unknown phase {phase!r}")
    stance_match = _STANCE_RE.match(stance_cell)
    if not stance_match:
        raise SourceError(f"{where}: unknown stance {stance_cell!r}")
    try:
        scope, note = split_note(scope_cell)
    except SourceError as exc:
        raise SourceError(f"{where}: {exc}") from None
    return Feature(
        id=feature_id,
        part=part,
        group=row.group,
        section=row.section,
        title=title,
        size=size,
        phase=phase,
        stance=stance_match.group("stance"),
        domain_level=stance_match.group("dagger") == "†",
        scope=scope,
        kurdistan_note=note,
        placement_marked=note is not None and "[P]" in note,
        row=row,
    )


def parse_features(text: str) -> tuple[list[Feature], list[Section]]:
    """Every feature row of A.1 to A.17, in source order, and the feature sections."""
    lines = text.split("\n")
    start, end = _appendix_a_bounds(lines)
    features: list[Feature] = []
    sections: list[Section] = []
    current: Section | None = None
    rows_in_current = 0
    i = start
    while i < end:
        line = lines[i]
        if line.startswith("### "):
            if current is not None and rows_in_current == 0:
                raise SourceError(f"line {current.line}: section {current.section} has no feature rows")
            match = _SECTION_RE.match(line)
            current = Section(match["section"], match["group"], match["name"], i + 1) if match else None
            if current is not None:
                sections.append(current)
            rows_in_current = 0
            i += 1
            continue
        if line.startswith("|") and i + 1 < end and lines[i + 1].startswith("|---"):
            header = tuple(split_row(line))
            j = i + 2
            if header == FEATURE_HEADER:
                if current is None:
                    raise SourceError(f"line {i + 1}: feature table outside an 'A.n GRP: Name' section")
                while j < end and lines[j].startswith("|"):
                    row = SourceRow(j + 1, lines[j], current.section, current.group)
                    features.append(parse_feature_row(split_row(lines[j]), row))
                    rows_in_current += 1
                    j += 1
            else:
                while j < end and lines[j].startswith("|"):
                    j += 1
            i = j
            continue
        i += 1
    if current is not None and rows_in_current == 0:
        raise SourceError(f"line {current.line}: section {current.section} has no feature rows")
    if not features:
        raise SourceError("no feature tables found in Appendix A")
    return features, sections


@dataclass(frozen=True)
class A18Totals:
    phases: dict[str, tuple[int, int]]  # phase -> (feature IDs, engineer-weeks)
    mvp_label: str
    mvp_phases: tuple[str, ...]
    mvp: tuple[int, int]
    all: tuple[int, int]
    note: str
    ai_gateway_ew: tuple[int, int] | None  # (K, R14) engineer-weeks for the AI gateway and control plane
    line: int  # the A.18 heading
    note_line: int  # the note paragraph after the table (0 when there is none)


def _int_cell(cell: str, where: str) -> int:
    value = cell.replace("**", "").replace(",", "").strip()
    if not value.isdigit():
        raise SourceError(f"{where}: {cell!r} is not a whole number")
    return int(value)


def parse_a18(text: str) -> A18Totals:
    lines = text.split("\n")
    start, end = _appendix_a_bounds(lines)
    heading = next((i for i in range(start, end) if lines[i].startswith("### A.18 ")), None)
    if heading is None:
        raise SourceError("heading '### A.18' not found in Appendix A")
    i = heading + 1
    while i < end and not lines[i].startswith("|"):
        i += 1
    if i >= end or tuple(split_row(lines[i])) != A18_HEADER:
        raise SourceError(f"line {i + 1}: A.18 table header is not {' | '.join(A18_HEADER)}")
    phases: dict[str, tuple[int, int]] = {}
    mvp_label, mvp_phases, mvp, total = "", (), None, None
    j = i + 2
    while j < end and lines[j].startswith("|"):
        where = f"line {j + 1}"
        cells = split_row(lines[j])
        if len(cells) != 3:
            raise SourceError(f"{where}: expected 3 cells in the A.18 table")
        label = cells[0].replace("**", "").strip()
        values = (_int_cell(cells[1], where), _int_cell(cells[2], where))
        mvp_match = _MVP_RE.match(label)
        if label in PHASES:
            phases[label] = values
        elif mvp_match:
            first, last = mvp_match["first"], mvp_match["last"]
            if first not in PHASES or last not in PHASES:
                raise SourceError(f"{where}: unknown phase in {label!r}")
            mvp_label = label
            mvp_phases = PHASES[PHASES.index(first) : PHASES.index(last) + 1]
            mvp = values
        elif label == "All":
            total = values
        else:
            raise SourceError(f"{where}: unknown A.18 row {label!r}")
        j += 1
    missing = [p for p in PHASES if p not in phases]
    if missing or mvp is None or total is None:
        raise SourceError(f"line {heading + 1}: A.18 lacks rows for {missing or ['MVP' if mvp is None else 'All']}")
    note, note_line = "", 0
    while j < end:
        if lines[j].strip() and not lines[j].startswith("#"):
            note, note_line = lines[j].strip(), j + 1
            break
        if lines[j].startswith("#"):
            break
        j += 1
    ai = _AI_NOTE_RE.search(note)
    return A18Totals(
        phases=phases,
        mvp_label=mvp_label,
        mvp_phases=mvp_phases,
        mvp=mvp,
        all=total,
        note=note,
        ai_gateway_ew=(int(ai["k"]), int(ai["r14"])) if ai else None,
        line=heading + 1,
        note_line=note_line,
    )
