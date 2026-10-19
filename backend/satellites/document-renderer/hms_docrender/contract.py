"""The render request and result of contract version 1 (docs/specs/modules/platform-docs.md §7.5).

The request is validated against ``contract/render-request.schema.json`` (JSON Schema 2020-12) by a small
validator in this module, so that validation needs neither WeasyPrint nor a third-party schema library. The
validator implements exactly the keywords the contract schemas use and refuses a schema that uses any other
keyword, so the schema and the validator cannot drift apart silently.
"""

from __future__ import annotations

import datetime
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from . import CONTRACT_VERSION

SATELLITE_DIR = Path(__file__).resolve().parents[1]
CONTRACT_DIR = SATELLITE_DIR / "contract"
REQUEST_SCHEMA = CONTRACT_DIR / "render-request.schema.json"
RESULT_SCHEMA = CONTRACT_DIR / "render-result.schema.json"

PDF_VARIANT = "pdf/a-2b"

# Keywords the validator implements. Annotations ($schema, $id, title, description) have no effect.
_ANNOTATIONS = {"$schema", "$id", "title", "description"}
_KEYWORDS = _ANNOTATIONS | {
    "type", "properties", "required", "additionalProperties", "items",
    "const", "enum", "minLength", "maxLength", "pattern", "minimum", "maximum",
}
_TYPES = {"object", "array", "string", "integer", "boolean"}


class SchemaError(Exception):
    """The schema uses something this validator does not implement (a programming error, never a request error)."""


class InvalidRequest(Exception):
    """The request breaks the contract; ``errors`` lists every violation found."""

    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


def load_schema(path: Path) -> dict[str, Any]:
    schema = json.loads(path.read_text(encoding="utf-8"))
    check_schema(schema)
    return schema


def check_schema(schema: Any, where: str = "#") -> None:
    if not isinstance(schema, dict):
        raise SchemaError(f"{where}: a schema must be an object")
    unknown = sorted(set(schema) - _KEYWORDS)
    if unknown:
        raise SchemaError(f"{where}: unsupported keyword(s) {unknown}")
    if "type" in schema and schema["type"] not in _TYPES:
        raise SchemaError(f"{where}: unsupported type {schema['type']!r}")
    if "additionalProperties" in schema and schema["additionalProperties"] is not False:
        raise SchemaError(f"{where}: only 'additionalProperties: false' is supported")
    for name, sub in (schema.get("properties") or {}).items():
        check_schema(sub, f"{where}/properties/{name}")
    if "items" in schema:
        check_schema(schema["items"], f"{where}/items")


def _type_ok(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    raise SchemaError(f"unsupported type {expected!r}")


def _same(a: Any, b: Any) -> bool:
    """JSON equality: 1 and True differ (Python's == says they are equal)."""
    return type(a) is type(b) and a == b


def validate(value: Any, schema: Mapping[str, Any], where: str = "$") -> list[str]:
    """Every violation of ``schema`` by ``value``, as messages that name the location (never the value)."""
    errors: list[str] = []
    expected = schema.get("type")
    if expected is not None and not _type_ok(value, expected):
        return [f"{where}: must be of type {expected}"]
    if "const" in schema and not _same(value, schema["const"]):
        errors.append(f"{where}: must equal {json.dumps(schema['const'])}")
    if "enum" in schema and not any(_same(value, option) for option in schema["enum"]):
        errors.append(f"{where}: must be one of {json.dumps(schema['enum'])}")
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{where}: must be at least {schema['minLength']} characters")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(f"{where}: must be at most {schema['maxLength']} characters")
        if "pattern" in schema and re.search(schema["pattern"], value) is None:
            errors.append(f"{where}: does not match the pattern {schema['pattern']}")
    if isinstance(value, int) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{where}: must be at least {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{where}: must be at most {schema['maximum']}")
    if isinstance(value, dict):
        properties = schema.get("properties") or {}
        for name in schema.get("required") or []:
            if name not in value:
                errors.append(f"{where}: the required property '{name}' is missing")
        if schema.get("additionalProperties") is False:
            for name in sorted(set(value) - set(properties)):
                errors.append(f"{where}: the property '{name}' is not allowed")
        for name, sub in properties.items():
            if name in value:
                errors.extend(validate(value[name], sub, f"{where}.{name}"))
    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            errors.extend(validate(item, schema["items"], f"{where}[{index}]"))
    return errors


@dataclass(frozen=True)
class RenderRequest:
    """One document to render (contract version 1). Field names follow the JSON contract in snake case."""

    html: str
    title: str
    template_id: str
    template_version: int
    template_content_hash: str
    provenance: str
    language: str
    created_at: str
    pdf_variant: str = PDF_VARIANT
    contract_version: int = CONTRACT_VERSION

    @classmethod
    def from_json(cls, data: Any) -> "RenderRequest":
        """Validate a decoded JSON request and build it; raises InvalidRequest listing every violation."""
        errors = validate(data, load_schema(REQUEST_SCHEMA))
        if not errors:
            try:
                datetime.datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00"))
            except ValueError:
                errors.append("$.createdAt: is not a valid date and time")
        if errors:
            raise InvalidRequest(errors)
        return cls(
            html=data["html"],
            title=data["title"],
            template_id=data["templateId"],
            template_version=data["templateVersion"],
            template_content_hash=data["templateContentHash"],
            provenance=data["provenance"],
            language=data["language"],
            created_at=data["createdAt"],
            pdf_variant=data["pdfVariant"],
            contract_version=data["contractVersion"],
        )

    @classmethod
    def from_text(cls, text: str) -> "RenderRequest":
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise InvalidRequest([f"$: not valid JSON ({exc.msg} at line {exc.lineno} column {exc.colno})"]) from None
        return cls.from_json(data)

    def to_json(self) -> dict[str, Any]:
        return {
            "contractVersion": self.contract_version,
            "html": self.html,
            "pdfVariant": self.pdf_variant,
            "title": self.title,
            "templateId": self.template_id,
            "templateVersion": self.template_version,
            "templateContentHash": self.template_content_hash,
            "provenance": self.provenance,
            "language": self.language,
            "createdAt": self.created_at,
        }


def result_errors(result: Mapping[str, Any]) -> list[str]:
    """Violations of the command-line result schema (used by the tests and by callers that want to check)."""
    return validate(result, load_schema(RESULT_SCHEMA))
