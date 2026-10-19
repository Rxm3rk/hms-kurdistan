"""Parse BUILD-PROMPT.md §21: which work packages name which Appendix A features.

Sources, as WP-0.1 asks:
- the Phase 0 to Phase 3 tables: the WP column (Phase 0 lists its feature IDs there, in brackets after the
  WP name) and the Scope or Features column. The Depends-on and Exit-evidence columns are not read;
- the Phase 1.1, 4, 5 and 6 sections, which have no table: their first paragraph, labelled "Phase 1.1",
  "Phase 4" and so on (not "WP-1.1", which is a different package).

A reference is a code span holding a feature ID (`PLT-CORE-02`) or a group wildcard (`RCM-*`). Its
qualifier is the wording the plan attaches to it, kept verbatim apart from removing bold markers:
- after the ID: `PLT-CORE-02` (full) -> "full"; `TRU-KEY-01` base -> "base";
  `CLN-CDS-05` (`reg-ews`) and its fallback -> "(`reg-ews`) and its fallback";
- before a bracket holding the ID: document-pack automation (`RCM-INS-01`) -> "document-pack automation",
  with any remark after a semicolon inside the bracket appended;
- before the ID: the scheme part of `RCM-SCH-01` -> "the scheme part".
Items are split at top level (outside brackets and code spans) on semicolons when the sentence has any,
otherwise on commas.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from hmstools.backlog.source import split_row

TOKEN_RE = re.compile(r"`(?P<tok>[A-Z][A-Z0-9]*(?:-[A-Z0-9]+[a-z]?)+|[A-Z][A-Z0-9]*-\*)`")
_WP_CELL_RE = re.compile(r"^\*\*(?P<num>\d+\.\d+[a-z]?) (?P<title>[^*]+)\*\*\s*(?P<rest>.*)$")
_PHASE_HEADING_RE = re.compile(r"^### (?P<label>Phase \d+(?:\.\d+)?)(?=[:\s])")
_LABEL_RE = re.compile(r"^(?P<label>[^`():;,.]{1,40}):\s+")
_CONNECTORS = ("then ", "and ", "or ")
SCOPE_COLUMNS = ("Scope", "Features")


class WorkPackageError(ValueError):
    """§21 does not have the shape this parser expects."""


@dataclass(frozen=True)
class Reference:
    wp: str  # "WP-0.3", "WP-1.1b", "Phase 1.1"
    target: str  # a feature ID or a wildcard such as "RCM-*"
    qualifier: str | None
    line: int  # 1-based line in BUILD-PROMPT.md

    @property
    def is_wildcard(self) -> bool:
        return self.target.endswith("-*")

    @property
    def label(self) -> str:
        """The string stored in backlog.yaml: 'WP-1.1 (full)', or the WP alone."""
        if not self.qualifier:
            return self.wp
        if self.qualifier.startswith("("):
            return f"{self.wp} {self.qualifier}"
        return f"{self.wp} ({self.qualifier})"


# --- text scanning -----------------------------------------------------------------------------------------


def _depths(text: str) -> tuple[list[int], list[bool]]:
    """Bracket depth before each character (outside code spans) and whether the character is in a code span.

    Both brackets of a top-level pair report depth 0.
    """
    depth = 0
    in_code = False
    depths: list[int] = []
    code: list[bool] = []
    for ch in text:
        if ch == "`":
            in_code = not in_code
            depths.append(depth)
            code.append(True)
            continue
        if in_code:
            depths.append(depth)
            code.append(True)
            continue
        if ch == ")":
            depth = max(depth - 1, 0)
        depths.append(depth)
        code.append(False)
        if ch == "(":
            depth += 1
    return depths, code


def _top_positions(text: str, chars: str) -> list[int]:
    depths, code = _depths(text)
    return [i for i, ch in enumerate(text) if ch in chars and depths[i] == 0 and not code[i]]


def _split_at(text: str, positions: list[int]) -> list[tuple[int, str]]:
    """Split text at the given separator positions; returns (offset, piece) pairs."""
    pieces: list[tuple[int, str]] = []
    start = 0
    for pos in positions:
        pieces.append((start, text[start:pos]))
        start = pos + 1
    pieces.append((start, text[start:]))
    return pieces


def _matching_close(text: str, open_index: int) -> int | None:
    depths, code = _depths(text)
    target = depths[open_index]
    for i in range(open_index + 1, len(text)):
        if text[i] == ")" and not code[i] and depths[i] == target:
            return i
    return None


def sentences(text: str) -> list[str]:
    """Split at top-level full stops that end the text or are followed by a space and a capital letter."""
    depths, code = _depths(text)
    cuts: list[int] = []
    for i, ch in enumerate(text):
        if ch != "." or depths[i] != 0 or code[i]:
            continue
        rest = text[i + 1 :]
        if not rest.strip() or (rest.startswith(" ") and rest.lstrip()[:1].isupper()):
            cuts.append(i)
    return [piece.strip() for _, piece in _split_at(text, cuts) if piece.strip()]


def items(sentence: str) -> list[str]:
    """Top-level items of a sentence: split on semicolons if it has any at top level, else on commas."""
    semicolons = _top_positions(sentence, ";")
    positions = semicolons if semicolons else _top_positions(sentence, ",")
    return [piece for _, piece in _split_at(sentence, positions)]


def _clean(phrase: str) -> str:
    text = phrase.replace("**", "").strip().strip(",;:").strip()
    changed = True
    while changed:
        changed = False
        for connector in _CONNECTORS:
            if text.lower().startswith(connector):
                text = text[len(connector) :].strip()
                changed = True
    if text.endswith(" of"):
        text = text[: -len(" of")].strip()
    return text


def _tail_qualifier(tail: str) -> str:
    text = tail.strip()
    if text.startswith("("):
        close = _matching_close(text, 0)
        if close is not None:
            rest = text[close + 1 :].strip()
            if not rest or rest.startswith(":"):
                return text[1:close].strip()
    return text.replace("**", "").strip()


def _join(parts: list[str], sep: str) -> str:
    return sep.join(p for p in parts if p)


def item_references(item: str) -> list[tuple[str, str]]:
    """(target, qualifier) for every feature reference in one item, in order."""
    tokens = list(TOKEN_RE.finditer(item))
    if not tokens:
        return []
    depths, code = _depths(item)
    top_tokens = [t for t in tokens if depths[t.start()] == 0]
    top_closes = [i for i, ch in enumerate(item) if ch == ")" and depths[i] == 0 and not code[i]]
    result: dict[int, str] = {}

    def boundary_before(index: int) -> int:
        """End of the last top-level token or top-level closing bracket before index."""
        ends = [t.end() for t in top_tokens if t.end() <= index] + [c + 1 for c in top_closes if c < index]
        return max(ends, default=0)

    # Top-level references: chains joined by "and" or "," share the head of the first and the tail of the last.
    k = 0
    while k < len(top_tokens):
        chain = [top_tokens[k]]
        while k + 1 < len(top_tokens):
            between = item[chain[-1].end() : top_tokens[k + 1].start()].strip()
            if between in ("", "and", ",", "or"):
                chain.append(top_tokens[k + 1])
                k += 1
            else:
                break
        first, last = chain[0], chain[-1]
        head = _clean(item[boundary_before(first.start()) : first.start()])
        next_top = next((t.start() for t in top_tokens if t.start() > last.start()), len(item))
        tail = _tail_qualifier(item[last.end() : next_top])
        qualifier = _join([head, tail], " ")
        for token in chain:
            result[token.start()] = qualifier
        k += 1

    # References inside a top-level bracket: the phrase before the bracket, the token's own words inside it,
    # and any remark after a semicolon inside it.
    for token in tokens:
        if depths[token.start()] == 0:
            continue
        open_index = max(
            i for i in range(token.start()) if item[i] == "(" and depths[i] == 0 and not code[i]
        )
        close_index = _matching_close(item, open_index)
        if close_index is None:
            raise WorkPackageError(f"unbalanced bracket in {item!r}")
        lead = _clean(item[boundary_before(open_index) : open_index])
        content = item[open_index + 1 : close_index]
        offset = open_index + 1
        semicolons = _top_positions(content, ";")
        list_part = content[: semicolons[0]] if semicolons else content
        remark = content[semicolons[0] + 1 :].strip() if semicolons else ""
        inner = ""
        for start, piece in _split_at(list_part, _top_positions(list_part, ",")):
            if offset + start <= token.start() < offset + start + len(piece):
                inner = _clean(TOKEN_RE.sub("", piece))
                if inner in ("and", "or"):
                    inner = ""
        result[token.start()] = _join([lead, inner, remark], "; ")

    return [(t.group("tok"), result[t.start()]) for t in tokens]


def text_references(text: str) -> list[tuple[str, str]]:
    """References in a free-text fragment: sentences, then items, with a leading 'Label: ' removed."""
    found: list[tuple[str, str]] = []
    for sentence in sentences(text):
        sentence = _LABEL_RE.sub("", sentence, count=1)
        for item in items(sentence):
            found.extend(item_references(item))
    return found


# --- §21 structure -----------------------------------------------------------------------------------------


def parse_section_21(text: str) -> list[Reference]:
    """Every feature reference in §21, in document order."""
    lines = text.split("\n")
    start = next((i for i, line in enumerate(lines) if line.startswith("## 21.")), None)
    if start is None:
        raise WorkPackageError("heading '## 21.' not found")
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    headings = [i for i in range(start, end) if _PHASE_HEADING_RE.match(lines[i])]
    if not headings:
        raise WorkPackageError("no '### Phase n' sections in §21")
    references: list[Reference] = []
    for n, heading in enumerate(headings):
        label = _PHASE_HEADING_RE.match(lines[heading])["label"]
        stop = headings[n + 1] if n + 1 < len(headings) else end
        stop = next((i for i in range(heading + 1, stop) if lines[i].startswith("### ")), stop)
        table = next(
            (
                i
                for i in range(heading + 1, stop - 1)
                if lines[i].startswith("| WP |") and lines[i + 1].startswith("|---")
            ),
            None,
        )
        if table is not None:
            references.extend(_table_references(lines, table, stop))
        else:
            references.extend(_paragraph_references(lines, heading, stop, label))
    return references


def _table_references(lines: list[str], header_index: int, stop: int) -> list[Reference]:
    header = split_row(lines[header_index])
    scope_columns = [i for i, name in enumerate(header) if name in SCOPE_COLUMNS]
    if len(scope_columns) != 1:
        raise WorkPackageError(f"line {header_index + 1}: expected one of {SCOPE_COLUMNS} in the WP table header")
    scope_col = scope_columns[0]
    found: list[Reference] = []
    i = header_index + 2
    while i < stop and lines[i].startswith("|"):
        cells = split_row(lines[i])
        if len(cells) != len(header):
            raise WorkPackageError(f"line {i + 1}: expected {len(header)} cells, found {len(cells)}")
        match = _WP_CELL_RE.match(cells[0])
        if not match:
            raise WorkPackageError(f"line {i + 1}: WP cell is not '**n.m Title**': {cells[0]!r}")
        wp = f"WP-{match['num']}"
        rest = match["rest"].strip()
        pairs: list[tuple[str, str]] = []
        if rest:
            if not (rest.startswith("(") and rest.endswith(")")):
                raise WorkPackageError(f"line {i + 1}: text after the WP name is not in brackets: {rest!r}")
            pairs.extend(text_references(rest[1:-1]))
        elif TOKEN_RE.search(cells[0]):
            raise WorkPackageError(f"line {i + 1}: feature reference inside the WP name")
        pairs.extend(text_references(cells[scope_col]))
        found.extend(Reference(wp, target, qualifier or None, i + 1) for target, qualifier in pairs)
        i += 1
    return found


def _paragraph_references(lines: list[str], heading: int, stop: int, label: str) -> list[Reference]:
    i = heading + 1
    while i < stop and not lines[i].strip():
        i += 1
    first = i
    paragraph: list[str] = []
    while i < stop and lines[i].strip() and not lines[i].startswith(("#", "|")):
        paragraph.append(lines[i].strip())
        i += 1
    if not paragraph:
        raise WorkPackageError(f"line {heading + 1}: {label} has neither a WP table nor a paragraph")
    return [
        Reference(label, target, qualifier or None, first + 1)
        for target, qualifier in text_references(" ".join(paragraph))
    ]
