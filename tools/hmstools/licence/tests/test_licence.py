"""Unit tests for 'tools/hms licence check' and the consistency of the ORT configuration with policy.yaml."""

from __future__ import annotations

import contextlib
import io
import json
import re
import tempfile
import unittest
from pathlib import Path

import yaml

from hmstools.licence import spdx
from hmstools.licence.__main__ import main
from hmstools.licence.policy import (
    ALLOWED,
    CONDITIONAL,
    DENIED,
    UNMAPPED,
    Component,
    Evaluator,
    Policy,
    read_cyclonedx,
    read_pnpm,
)

ROOT = Path(__file__).resolve().parents[4]
POLICY = Policy.load(ROOT / "tools/licence/policy.yaml")


def verdict(licences, scope="shipped", **fields):
    component = Component(name=fields.pop("name", "example"), licences=list(licences), scope=scope, **fields)
    return Evaluator(POLICY).evaluate(component)


class Spdx(unittest.TestCase):
    def test_precedence_and_with(self) -> None:
        node = spdx.parse("MIT OR Apache-2.0 AND GPL-2.0-only WITH Classpath-exception-2.0")
        self.assertEqual(str(node), "(MIT OR (Apache-2.0 AND GPL-2.0-only WITH Classpath-exception-2.0))")

    def test_parentheses_and_lower_case_operators(self) -> None:
        self.assertEqual(str(spdx.parse("(MIT or ISC) and BSD-3-Clause")), "((MIT OR ISC) AND BSD-3-Clause)")

    def test_errors(self) -> None:
        for bad in ["MIT OR", "(MIT", "AND MIT", "MIT ) ISC"]:
            with self.assertRaises(spdx.SpdxError, msg=bad):
                spdx.parse(bad)

    def test_free_form_names_are_not_expressions(self) -> None:
        self.assertTrue(spdx.looks_like_expression("MIT"))
        self.assertTrue(spdx.looks_like_expression("(MIT OR Apache-2.0)"))
        self.assertFalse(spdx.looks_like_expression("MIT License"))
        self.assertFalse(spdx.looks_like_expression("Apache License, Version 2.0"))


class Shipped(unittest.TestCase):
    def test_allowlist(self) -> None:
        for licence in ["Apache-2.0", "MIT", "BSD-3-Clause", "ISC", "MPL-2.0", "LGPL-2.1-only", "EPL-2.0", "OFL-1.1"]:
            self.assertEqual(verdict([licence]).level, ALLOWED, licence)

    def test_or_takes_the_best_option_and_takes_the_worst(self) -> None:
        self.assertEqual(verdict(["MIT OR GPL-3.0-only"]).level, ALLOWED)
        self.assertEqual(verdict(["MIT AND GPL-3.0-only"]).level, DENIED)
        self.assertEqual(verdict(["MIT", "GPL-3.0-only"]).level, DENIED)  # several declared licences: AND

    def test_denylist_in_every_scope(self) -> None:
        for licence in ["BUSL-1.1", "SSPL-1.0", "Elastic-2.0", "FSL-1.1-MIT", "Apache-2.0 WITH Commons-Clause"]:
            for scope in ["shipped", "build-only"]:
                result = verdict([licence], scope)
                self.assertEqual(result.level, DENIED, f"{licence} {scope}")
                self.assertTrue(result.hard)

    def test_denylisted_wording_in_licence_names(self) -> None:
        for name in ["Business Source License 1.1", "Server Side Public License", "Functional Source License, Version 1.1",
                     "Elastic License 2.0", "PolyForm Shield License 1.0.0", "Confluent Community License"]:
            self.assertEqual(verdict([name], "build-only").level, DENIED, name)

    def test_boost_bsl_is_not_the_business_source_licence(self) -> None:
        self.assertEqual(verdict(["BSL-1.0"], "build-only").level, ALLOWED)
        self.assertEqual(verdict(["BSL-1.0"], "shipped").level, UNMAPPED)

    def test_gpl_in_shipped_code_is_denied(self) -> None:
        for licence in ["GPL-2.0-only", "GPL-3.0-or-later", "AGPL-3.0-only", "GPL-2.0"]:
            self.assertEqual(verdict([licence]).level, DENIED, licence)

    def test_conditional_licence(self) -> None:
        result = verdict(["MPL-1.1"])
        self.assertEqual(result.level, CONDITIONAL)
        self.assertIn("licence register", result.condition)

    def test_aliases_and_unmapped_names(self) -> None:
        self.assertEqual(verdict(["The Apache Software License, Version 2.0"]).level, ALLOWED)
        self.assertEqual(verdict(["MIT License"]).level, ALLOWED)
        self.assertEqual(verdict(["Some Custom Licence"]).level, UNMAPPED)
        self.assertEqual(verdict([]).level, UNMAPPED)

    def test_build_only_licences_are_not_shipped(self) -> None:
        for licence in ["BlueOak-1.0.0", "0BSD", "CC-BY-4.0", "Python-2.0"]:
            self.assertEqual(verdict([licence], "build-only").level, ALLOWED, licence)
            self.assertEqual(verdict([licence], "shipped").level, UNMAPPED, licence)

    def test_gpl_in_build_only_tools_is_acceptable(self) -> None:
        self.assertEqual(verdict(["GPL-3.0-only"], "build-only").level, ALLOWED)

    def test_unknown_scope_defaults_to_shipped(self) -> None:
        self.assertEqual(POLICY.default_scope, "shipped")
        self.assertEqual(verdict(["BlueOak-1.0.0"], None).level, UNMAPPED)


class ComponentRules(unittest.TestCase):
    def test_dcm4che_lgpl_option_is_conditional(self) -> None:
        result = verdict(["MPL-1.1 OR GPL-2.0-only OR LGPL-2.1-only"], purl="pkg:maven/org.dcm4che/dcm4che-core@5.33.1")
        self.assertEqual(result.level, CONDITIONAL)
        self.assertIn("LGPL-2.1-only", result.reason)

    def test_openjdk_runtime_gpl_with_classpath_exception_is_conditional(self) -> None:
        result = verdict(["GPL-2.0-only WITH Classpath-exception-2.0"], name="eclipse-temurin")
        self.assertEqual(result.level, CONDITIONAL)

    def test_classpath_exception_outside_openjdk_needs_a_decision(self) -> None:
        result = verdict(["GPL-2.0-only WITH Classpath-exception-2.0"], name="some-library")
        self.assertEqual(result.level, UNMAPPED)
        self.assertIn("OpenJDK runtime", result.reason)

    def test_gpl_separate_container_is_conditional(self) -> None:
        result = verdict(["AGPL-3.0-only"], name="orthanc", type="container", purl="pkg:docker/orthancteam/orthanc@1.12")
        self.assertEqual(result.level, CONDITIONAL)
        self.assertIn("source offer", result.condition)

    def test_os_packages_are_conditional(self) -> None:
        result = verdict(["GPL-2.0-or-later"], name="bash", purl="pkg:deb/debian/bash@5.2")
        self.assertEqual(result.level, CONDITIONAL)

    def test_conditional_rules_never_lift_a_denied_licence(self) -> None:
        result = verdict(["SSPL-1.0"], name="db", type="container", purl="pkg:docker/vendor/db@1")
        self.assertEqual(result.level, DENIED)

    def test_named_exclusions(self) -> None:
        cases = [
            ({"purl": "pkg:docker/bitnami/postgresql@17"}, ["Apache-2.0"]),
            ({"purl": "pkg:docker/minio/minio@latest"}, ["AGPL-3.0-only"]),
            ({"name": "@medplum/core", "purl": "pkg:npm/%40medplum/core@4.0.0"}, ["Apache-2.0"]),
            ({"name": "redpanda-console"}, ["Apache-2.0"]),
            ({"purl": "pkg:docker/hashicorp/vault@1.18"}, ["BUSL-1.1"]),
        ]
        for fields, licences in cases:
            result = verdict(licences, **fields)
            self.assertEqual(result.level, DENIED, fields)
            self.assertIn("excluded by name", result.reason)

    def test_version_bounded_exclusions(self) -> None:
        camunda = {"name": "io.camunda:zeebe-client-java", "purl": "pkg:maven/io.camunda/zeebe-client-java@8.5.9"}
        self.assertEqual(verdict(["Apache-2.0"], version="8.5.9", **camunda).level, ALLOWED)
        camunda["purl"] = "pkg:maven/io.camunda/zeebe-client-java@8.6.0"
        self.assertEqual(verdict(["Apache-2.0"], version="8.6.0", **camunda).level, DENIED)

    def test_liquibase_only_under_fsl(self) -> None:
        purl = "pkg:maven/org.liquibase/liquibase-core@4.29.0"
        self.assertEqual(verdict(["Apache-2.0"], purl=purl, name="liquibase-core").level, ALLOWED)
        self.assertEqual(verdict(["FSL-1.1-ALv2"], purl=purl, name="liquibase-core").level, DENIED)


class Inputs(unittest.TestCase):
    def test_cyclonedx_nested_components_and_scope(self) -> None:
        bom = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.6",
            "metadata": {"component": {"name": "hms", "licenses": []}},
            "components": [
                {"group": "org.example", "name": "lib", "version": "1.0", "purl": "pkg:maven/org.example/lib@1.0",
                 "licenses": [{"license": {"id": "Apache-2.0"}}],
                 "components": [{"name": "inner", "version": "2", "licenses": [{"expression": "MIT OR ISC"}]}]},
                {"name": "junit", "version": "6.0.3", "scope": "excluded",
                 "licenses": [{"license": {"name": "Eclipse Public License v2.0"}}]},
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bom.json"
            path.write_text(json.dumps(bom), encoding="utf-8")
            components = read_cyclonedx(path)
        self.assertEqual([c.name for c in components], ["org.example:lib", "inner", "junit"])
        self.assertEqual(components[1].licences, ["MIT OR ISC"])
        self.assertEqual(components[2].scope, "build-only")
        self.assertIsNone(components[0].scope)

    def test_not_cyclonedx_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.json"
            path.write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError):
                read_cyclonedx(path)

    def test_pnpm_output_new_and_old_shapes(self) -> None:
        data = {
            "MIT": [{"name": "react", "versions": ["19.2.0", "19.1.0"], "license": "MIT"}],
            "Unknown": [{"name": "@scope/mystery", "version": "1.0.0", "license": "Unknown"}],
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "pnpm.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            components = read_pnpm(path, "shipped")
        self.assertEqual([c.label for c in components], ["react@19.2.0", "react@19.1.0", "@scope/mystery@1.0.0"])
        self.assertEqual(components[2].licences, [])
        self.assertEqual(components[2].purl, "pkg:npm/%40scope/mystery@1.0.0")


class Cli(unittest.TestCase):
    def run_cli(self, *argv: str) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = main(list(argv))
        return code, out.getvalue()

    def write_bom(self, tmp: str, components: list[dict]) -> str:
        path = Path(tmp) / "bom.json"
        path.write_text(json.dumps({"bomFormat": "CycloneDX", "components": components}), encoding="utf-8")
        return str(path)

    def test_pass_fail_and_json_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            good = self.write_bom(tmp, [{"name": "a", "version": "1", "licenses": [{"license": {"id": "MIT"}}]}])
            code, out = self.run_cli("check", "--sbom", good, "--json")
            self.assertEqual(code, 0)
            data = json.loads(out.strip().splitlines()[-1])
            self.assertEqual(set(data), {"check", "ok", "counts", "errors", "warnings"})
            self.assertTrue(data["ok"])
            bad = self.write_bom(tmp, [{"name": "b", "version": "1", "licenses": [{"license": {"id": "SSPL-1.0"}}]}])
            code, out = self.run_cli("check", "--sbom", bad, "--json")
            self.assertEqual(code, 1)
            self.assertEqual(json.loads(out.strip().splitlines()[-1])["counts"]["denied"], 1)

    def test_conditional_warns_until_registered(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [{"name": "hapi-base", "version": "2.6", "purl": "pkg:maven/ca.uhn.hapi/hapi-base@2.6",
                                        "licenses": [{"license": {"id": "MPL-1.1"}}]}])
            code, out = self.run_cli("check", "--sbom", bom, "--json")
            data = json.loads(out.strip().splitlines()[-1])
            self.assertEqual(code, 0)
            self.assertEqual(data["counts"]["conditional"], 1)
            self.assertTrue(data["warnings"])
            register = Path(tmp) / "register.yaml"
            register.write_text(yaml.safe_dump({"schema_version": 1, "entries": [
                {"component": "^pkg:maven/ca\\.uhn\\.hapi/", "licence": "MPL-1.1", "rule": "MPL-1.1",
                 "unmodified": True, "source_offer": None, "added_in": "WP-1.1b", "notes": "fixture"}]}),
                encoding="utf-8")
            code, out = self.run_cli("check", "--sbom", bom, "--register", str(register), "--json")
            data = json.loads(out.strip().splitlines()[-1])
            self.assertEqual(data["counts"]["conditional_registered"], 1)
            self.assertEqual(data["warnings"], [])

    def test_no_input_is_a_usage_error(self) -> None:
        code, _ = self.run_cli("check")
        self.assertEqual(code, 2)


class OrtConsistency(unittest.TestCase):
    """tools/licence/ort/license-classifications.yml must mirror tools/licence/policy.yaml."""

    @classmethod
    def setUpClass(cls) -> None:
        with open(ROOT / "tools/licence/ort/license-classifications.yml", encoding="utf-8") as handle:
            data = yaml.safe_load(handle)
        cls.categories = {c["name"] for c in data["categories"]}
        cls.by_category: dict[str, set[str]] = {}
        for entry in data["categorizations"]:
            for category in entry["categories"]:
                cls.by_category.setdefault(category, set()).add(entry["id"])
                assert category in cls.categories, category

    def test_allowed_matches(self) -> None:
        self.assertEqual(self.by_category["allowed"], POLICY.allowed())

    def test_conditional_matches(self) -> None:
        self.assertEqual(self.by_category["conditional"], set(POLICY.conditional_licences()))

    def test_denied_matches(self) -> None:
        # "Commons-Clause" is how npm writes the clause; it is not an SPDX id, so ORT uses the LicenseRef forms.
        self.assertEqual(self.by_category["denied"], POLICY.denied() - {"Commons-Clause"})

    def test_build_only_matches(self) -> None:
        self.assertEqual(self.by_category["build-only-acceptable"], POLICY.build_only_acceptable())

    def test_copyleft_category_matches_the_restricted_pattern(self) -> None:
        pattern = POLICY.copyleft_restricted()
        for licence in self.by_category["copyleft-separate-container"]:
            self.assertRegex(licence, pattern)
        self.assertEqual(self.by_category["openjdk-runtime-only"], {"GPL-2.0-only WITH Classpath-exception-2.0"})

    def test_no_licence_is_both_allowed_and_denied(self) -> None:
        self.assertFalse(self.by_category["allowed"] & self.by_category["denied"])

    def test_evaluator_rules_reference_every_category(self) -> None:
        rules = (ROOT / "tools/licence/ort/evaluator.rules.kts").read_text(encoding="utf-8")
        for category in self.categories:
            self.assertIn(f'licensesByCategory["{category}"]', rules)
        self.assertIn("NOT RUN YET", rules)

    def test_ort_yml_excludes_and_readme_states_not_run(self) -> None:
        with open(ROOT / ".ort.yml", encoding="utf-8") as handle:
            ort = yaml.safe_load(handle)
        patterns = {p["pattern"] for p in ort["excludes"]["paths"]}
        for expected in ["research/**", "docs/**", "tools/**", "tests/**"]:
            self.assertIn(expected, patterns)
        reasons = {p["reason"] for p in ort["excludes"]["paths"]} | {s["reason"] for s in ort["excludes"]["scopes"]}
        self.assertTrue(reasons <= {"BUILD_TOOL_OF", "DATA_FILE_OF", "DOCUMENTATION_OF", "EXAMPLE_OF",
                                    "OPTIONAL_COMPONENT_OF", "OTHER", "PROVIDED_BY", "TEST_OF", "TEST_TOOL_OF",
                                    "BUILD_DEPENDENCY_OF", "DEV_DEPENDENCY_OF", "PROVIDED_DEPENDENCY_OF",
                                    "TEST_DEPENDENCY_OF", "RUNTIME_DEPENDENCY_OF"})
        readme = (ROOT / "tools/licence/README.md").read_text(encoding="utf-8")
        self.assertIn("ORT has not been run", readme)
        self.assertTrue(re.search(r"WP-0\.2.*WP-0\.9", readme, re.S))

    def test_curations_parse(self) -> None:
        with open(ROOT / "tools/licence/ort/curations.yml", encoding="utf-8") as handle:
            curations = yaml.safe_load(handle)
        for entry in curations:
            self.assertRegex(entry["id"], r"^Maven:[^:]+:[^:]+:")
            self.assertIn("comment", entry["curations"])


if __name__ == "__main__":
    unittest.main()
