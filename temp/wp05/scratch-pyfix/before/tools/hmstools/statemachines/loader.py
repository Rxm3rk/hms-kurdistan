"""Reading a state-machine spec: the reading rules of §1.2 and the canonical content of §2.2.

docs/specs/modules/state-machines-and-invariants.md §1.2: keys are read as written. A YAML 1.1 parser
(PyYAML's default) reads the transition key ``on`` as the boolean true, and ``off``, ``yes`` and ``no``
likewise. This loader resolves only ``true`` and ``false`` as booleans; the lower-case words ``on``,
``off``, ``yes``, ``no``, ``y`` and ``n`` stay strings (a state may be called ``on``). Every other plain
scalar that YAML 1.1 reads as a boolean (``True``, ``YES``, ``On``, ``N`` ...) fails, because the writer's
intent is unclear: write ``true``/``false`` or quote it. Dates stay strings as written. Duplicate keys,
non-string keys and merge keys (``<<``) fail. The checks and the generator both read specs only through
``load_spec_text``, so they read the same document.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import yaml

from hmstools.safety import signoffs as so

_BOOL_TAG = "tag:yaml.org,2002:bool"
_TIMESTAMP_TAG = "tag:yaml.org,2002:timestamp"
_MERGE_TAG = "tag:yaml.org,2002:merge"
_AMBIGUOUS_TAG = "tag:hms.invalid,2026:ambiguous-boolean"
# The YAML 1.1 booleans that are neither true/false nor the lower-case words read as strings.
_AMBIGUOUS = re.compile(r"^(?:True|TRUE|False|FALSE|Yes|YES|No|NO|On|ON|Off|OFF|Y|N)$")


class SpecLoadError(Exception):
    """The text does not parse under the reading rules of §1.2."""


_BASE = getattr(yaml, "CSafeLoader", yaml.SafeLoader)  # libyaml's parser when present; the resolver is Python's


class SpecLoader(_BASE):  # type: ignore[misc, valid-type]
    """PyYAML's safe loader with the §1.2 reading rules."""

    yaml_implicit_resolvers = {
        first: [(tag, regexp) for tag, regexp in resolvers if tag not in (_BOOL_TAG, _TIMESTAMP_TAG)]
        for first, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
    }


SpecLoader.add_implicit_resolver(_BOOL_TAG, re.compile(r"^(?:true|false)$"), list("tf"))
SpecLoader.add_implicit_resolver(_AMBIGUOUS_TAG, _AMBIGUOUS, list("TFYNO"))


def _ambiguous(loader: SpecLoader, node: yaml.Node) -> Any:
    raise yaml.constructor.ConstructorError(
        None, None,
        f"found the unquoted value {node.value!r}, which YAML 1.1 reads as a boolean; write true or false, or quote it",
        node.start_mark,
    )


def _mapping(loader: SpecLoader, node: yaml.MappingNode) -> dict[str, Any]:
    seen: set[str] = set()
    result: dict[str, Any] = {}
    for key_node, value_node in node.value:
        if key_node.tag == _MERGE_TAG:
            raise yaml.constructor.ConstructorError(
                "while reading a mapping", node.start_mark, "merge keys (<<) are not allowed in a spec", key_node.start_mark
            )
        key = loader.construct_object(key_node, deep=True)
        if not isinstance(key, str):
            raise yaml.constructor.ConstructorError(
                "while reading a mapping", node.start_mark, f"found the key {key!r}, which is not a string", key_node.start_mark
            )
        if key in seen:
            raise yaml.constructor.ConstructorError(
                "while reading a mapping", node.start_mark, f"found duplicate key {key!r}", key_node.start_mark
            )
        seen.add(key)
        result[key] = loader.construct_object(value_node, deep=True)
    return result


SpecLoader.add_constructor(_AMBIGUOUS_TAG, _ambiguous)
SpecLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)


def load_spec_text(text: str) -> Any:
    """Parse a spec's text with the §1.2 reading rules. Raises SpecLoadError."""
    try:
        return yaml.load(text, Loader=SpecLoader)  # noqa: S506 - a SafeLoader subclass
    except yaml.YAMLError as exc:
        raise SpecLoadError(" ".join(str(exc).split())) from exc


def load_spec(path: Path) -> Any:
    """Read and parse a spec file (UTF-8). Raises SpecLoadError, also for an unreadable file."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise SpecLoadError(f"cannot be read: {exc}") from exc
    return load_spec_text(text)


def canonical_text(document: Any) -> str:
    """The canonical content of §2.2: canonical JSON (sorted keys, no spaces) of the parsed document without
    the approval block's human fields (status, approved_by, record).

    It is the reduction the sign-off gate uses for a subject's content version (hmstools.safety.signoffs,
    content_version), so ``"sha256:" + canonical_sha256(doc)`` equals ``content_version(doc, "approved")``.
    """
    plain = so._plain(document, so._HUMAN_FIELDS, so._status_is_human(document))  # noqa: SLF001 - the shared reduction
    return json.dumps(plain, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def canonical_sha256(document: Any) -> str:
    """The SHA-256 (64 hex digits) of the canonical content, UTF-8 encoded."""
    return hashlib.sha256(canonical_text(document).encode("utf-8")).hexdigest()
