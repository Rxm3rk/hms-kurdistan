"""A small SPDX licence-expression parser: OR, AND, WITH and parentheses (SPDX 2.3 Annex D)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Union


@dataclass(frozen=True)
class Leaf:
    licence: str
    exception: str | None = None

    def __str__(self) -> str:
        return f"{self.licence} WITH {self.exception}" if self.exception else self.licence


@dataclass(frozen=True)
class Op:
    operator: str  # "AND" or "OR"
    operands: tuple["Node", ...]

    def __str__(self) -> str:
        return "(" + f" {self.operator} ".join(str(o) for o in self.operands) + ")"


Node = Union[Leaf, Op]

_TOKEN = re.compile(r"\s*(\(|\)|[A-Za-z0-9.+\-:_]+)")


class SpdxError(ValueError):
    pass


def tokenize(text: str) -> list[str]:
    tokens, pos = [], 0
    text = text.strip()
    while pos < len(text):
        match = _TOKEN.match(text, pos)
        if not match:
            raise SpdxError(f"cannot parse licence expression {text!r} at {text[pos:]!r}")
        tokens.append(match.group(1))
        pos = match.end()
        while pos < len(text) and text[pos].isspace():
            pos += 1
    return tokens


class _Parser:
    def __init__(self, tokens: list[str], source: str):
        self.tokens, self.pos, self.source = tokens, 0, source

    def peek(self) -> str | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def take(self) -> str:
        token = self.peek()
        if token is None:
            raise SpdxError(f"unexpected end of licence expression {self.source!r}")
        self.pos += 1
        return token

    def expression(self) -> Node:
        operands = [self.conjunction()]
        while (self.peek() or "").upper() == "OR":
            self.take()
            operands.append(self.conjunction())
        return operands[0] if len(operands) == 1 else Op("OR", tuple(operands))

    def conjunction(self) -> Node:
        operands = [self.term()]
        while (self.peek() or "").upper() == "AND":
            self.take()
            operands.append(self.term())
        return operands[0] if len(operands) == 1 else Op("AND", tuple(operands))

    def term(self) -> Node:
        token = self.take()
        if token == "(":
            node = self.expression()
            if self.take() != ")":
                raise SpdxError(f"missing ')' in {self.source!r}")
            return node
        if token == ")" or token.upper() in {"AND", "OR", "WITH"}:
            raise SpdxError(f"unexpected {token!r} in {self.source!r}")
        if (self.peek() or "").upper() == "WITH":
            self.take()
            return Leaf(token, self.take())
        return Leaf(token)


def parse(text: str) -> Node:
    parser = _Parser(tokenize(text), text)
    node = parser.expression()
    if parser.peek() is not None:
        raise SpdxError(f"unexpected {parser.peek()!r} in {text!r}")
    return node


def canonical(node: Node) -> str:
    """The expression as text with nested AND and OR operands flattened, de-duplicated and sorted, so that two
    spellings of one expression ("ISC AND (MIT AND ISC)" and "MIT AND ISC") give the same text."""

    def operands(op: Op) -> list[Node]:
        out: list[Node] = []
        for operand in op.operands:
            if isinstance(operand, Op) and operand.operator == op.operator:
                out += operands(operand)
            else:
                out.append(operand)
        return out

    def text(item: Node, nested: bool) -> str:
        if isinstance(item, Leaf):
            return str(item)
        parts = sorted({text(operand, True) for operand in operands(item)})
        if len(parts) == 1:
            return parts[0]
        joined = f" {item.operator} ".join(parts)
        return f"({joined})" if nested else joined

    return text(node, False)


def looks_like_expression(text: str) -> bool:
    """True if the text is an SPDX identifier or expression rather than a free-form licence name."""
    try:
        tokens = tokenize(text)
    except SpdxError:
        return False
    words = [t for t in tokens if t not in {"(", ")"} and t.upper() not in {"AND", "OR", "WITH"}]
    if not words:
        return False
    # A free-form name such as "Apache License Version 2.0" has words joined by plain spaces.
    operators = [t for t in tokens if t.upper() in {"AND", "OR", "WITH"}]
    return len(words) == len(operators) + 1 or (len(words) == 1)
