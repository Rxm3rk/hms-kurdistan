"""The render request contract, version 1 (docs/specs/modules/platform-docs.md §7.5)."""

from __future__ import annotations

import json
import subprocess
import sys
import unittest

from hms_docrender.contract import (
    REQUEST_SCHEMA, RESULT_SCHEMA, InvalidRequest, RenderRequest, SchemaError, check_schema, load_schema, result_errors,
)
from tests.support import SATELLITE, make_request


def valid() -> dict:
    return make_request().to_json()


class ContractValidationTest(unittest.TestCase):
    """UnitTest:renderer-contract-validation: every request is validated against render-request.schema.json."""

    def test_a_valid_request_round_trips(self) -> None:
        request = RenderRequest.from_json(valid())
        self.assertEqual(request, make_request())
        self.assertEqual(RenderRequest.from_text(json.dumps(valid())).to_json(), valid())

    def assert_invalid(self, data: object, fragment: str) -> None:
        with self.assertRaises(InvalidRequest) as caught:
            RenderRequest.from_json(data)
        self.assertTrue(any(fragment in error for error in caught.exception.errors), caught.exception.errors)

    def test_every_required_field_is_required(self) -> None:
        for name in valid():
            data = valid()
            del data[name]
            self.assert_invalid(data, f"'{name}' is missing")

    def test_unknown_fields_are_refused(self) -> None:
        data = valid()
        data["baseUrl"] = "https://example.invalid/"
        self.assert_invalid(data, "'baseUrl' is not allowed")

    def test_only_pdf_a_2b(self) -> None:
        for variant in ("pdf/a-2u", "pdf/a-3b", "pdf/ua-1", "", None):
            data = valid()
            data["pdfVariant"] = variant
            self.assert_invalid(data, "$.pdfVariant")

    def test_contract_version_is_exactly_one(self) -> None:
        for version in (2, 0, True, "1", 1.0):
            data = valid()
            data["contractVersion"] = version
            self.assert_invalid(data, "$.contractVersion")

    def test_field_formats(self) -> None:
        cases = {
            "createdAt": ["2026-01-01", "2026-01-01T00:00:00", "2026-13-01T00:00:00Z", "2026-01-01T00:00:00.5Z", 0],
            "templateContentHash": ["A" * 64, "a" * 63, "g" * 64, ""],
            "templateVersion": [0, -1, True, "1", 1.5, 2**31],
            "templateId": ["", "-SYN", "SYN TEMPLATE", "x" * 129, "SYN/../X"],
            "provenance": ["draft", "SYNTHETIC", ""],
            "language": ["fr", "ku", "CKB", ""],
            "title": ["", 7],
            "html": ["", None],
        }
        for name, values in cases.items():
            for value in values:
                with self.subTest(field=name, value=value):
                    data = valid()
                    data[name] = value
                    self.assert_invalid(data, f"$.{name}")

    def test_the_title_follows_r7(self) -> None:
        """Review correctness 5: control, bidi, surrogate and noncharacter titles and non-NFC titles are invalid."""
        cases = {
            "SYN\x01 title": "control character",
            "SYN\x0b title": "control character",
            "SYN ‮7-321000-NYS": "format character",
            "SYN ⁦x⁩": "format character",
            "SYN \ud800": "unpaired surrogate",
            "SYN ￾": "noncharacter",
            "SYN é": "NFC",
        }
        for title, fragment in cases.items():
            with self.subTest(title=ascii(title)):
                data = valid()
                data["title"] = title
                self.assert_invalid(data, fragment)
                with self.assertRaises(InvalidRequest) as caught:
                    RenderRequest.from_json(data)
                self.assertNotIn("SYN", " ".join(caught.exception.errors))
        for title in ("SYN شیلان", "SYN پ‌چ", "SYN é"):
            data = valid()
            data["title"] = title
            RenderRequest.from_json(data)

    def test_not_json_and_not_an_object(self) -> None:
        with self.assertRaises(InvalidRequest):
            RenderRequest.from_text("{not json")
        self.assert_invalid([valid()], "must be of type object")

    def test_errors_never_echo_the_html(self) -> None:
        data = valid()
        data["html"] = 12345
        data["templateId"] = "شیلان"
        with self.assertRaises(InvalidRequest) as caught:
            RenderRequest.from_json(data)
        self.assertNotIn("شیلان", " ".join(caught.exception.errors))


class ContractSchemaTest(unittest.TestCase):
    def test_the_schemas_use_only_keywords_the_validator_implements(self) -> None:
        load_schema(REQUEST_SCHEMA)
        load_schema(RESULT_SCHEMA)
        with self.assertRaises(SchemaError):
            check_schema({"type": "object", "properties": {"x": {"format": "date-time"}}})
        with self.assertRaises(SchemaError):
            check_schema({"type": "object", "additionalProperties": True})

    def test_result_schema_accepts_each_status(self) -> None:
        self.assertEqual(result_errors({"contractVersion": 1, "status": "invalid", "errors": ["$.html: x"]}), [])
        self.assertEqual(result_errors({"contractVersion": 1, "status": "refused", "code": "network-attempt", "detail": "x"}), [])
        self.assertNotEqual(result_errors({"contractVersion": 1, "status": "refused", "code": "other"}), [])

    def test_contract_validation_needs_no_weasyprint(self) -> None:
        code = (
            "import sys, json; sys.path.insert(0, sys.argv[1]);"
            "from hms_docrender.contract import RenderRequest;"
            "RenderRequest.from_json(json.loads(sys.argv[2]));"
            "import hms_docrender.fonts, hms_docrender.fetcher;"
            "assert 'weasyprint' not in sys.modules, 'weasyprint imported'"
        )
        result = subprocess.run([sys.executable, "-I", "-c", code, str(SATELLITE), json.dumps(valid())], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
