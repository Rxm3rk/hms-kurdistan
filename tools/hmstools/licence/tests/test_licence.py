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
    load_register,
    read_cyclonedx,
    read_pnpm,
    register_problems,
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

    def test_canonical_form_ignores_operand_order_and_nesting(self) -> None:
        self.assertEqual(spdx.canonical(spdx.parse("MIT AND ISC")), "ISC AND MIT")
        self.assertEqual(spdx.canonical(spdx.parse("ISC AND (MIT AND ISC)")), "ISC AND MIT")
        self.assertEqual(spdx.canonical(spdx.parse("(MIT OR ISC) AND BSD-3-Clause")), "(ISC OR MIT) AND BSD-3-Clause")
        self.assertEqual(spdx.canonical(spdx.parse("GPL-2.0-only WITH Classpath-exception-2.0")),
                         "GPL-2.0-only WITH Classpath-exception-2.0")
        self.assertNotEqual(spdx.canonical(spdx.parse("MIT AND ISC")), spdx.canonical(spdx.parse("MIT OR ISC")))

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

    def test_a_conditional_verdict_names_the_rule_and_the_licence_a_register_entry_must_record(self) -> None:
        cases = [
            ((["MPL-1.1"], {}), ("MPL-1.1", "MPL-1.1")),
            ((["MPL-1.1 AND MIT"], {}), ("MPL-1.1", "MPL-1.1")),
            ((["MPL-1.1 OR GPL-2.0-only OR LGPL-2.1-only"], {"purl": "pkg:maven/org.dcm4che/dcm4che-core@5.33.1"}),
             ("dcm4che-lgpl-option", "LGPL-2.1-only")),
            ((["GPL-2.0-only WITH Classpath-exception-2.0"], {"name": "eclipse-temurin"}),
             ("openjdk-runtime", "GPL-2.0-only WITH Classpath-exception-2.0")),
            ((["GPL-2.0-or-later", "LGPL-2.1-only"], {"name": "bash", "purl": "pkg:deb/debian/bash@5.2"}),
             ("os-packages", "GPL-2.0-or-later AND LGPL-2.1-only")),
            ((["AGPL-3.0-only"], {"name": "orthanc", "type": "container", "purl": "pkg:docker/orthancteam/orthanc@1"}),
             ("gpl-separate-container", "AGPL-3.0-only")),
        ]
        for (licences, fields), expected in cases:
            result = verdict(licences, **fields)
            self.assertEqual(result.level, CONDITIONAL, licences)
            self.assertEqual((result.rule, result.licence), expected, licences)
        self.assertEqual((verdict(["MIT"]).rule, verdict(["MIT"]).licence), (None, None))

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

    HAPI = {"name": "hapi-base", "version": "2.6", "purl": "pkg:maven/ca.uhn.hapi/hapi-base@2.6",
            "licenses": [{"license": {"id": "MPL-1.1"}}]}
    HAPI_ENTRY = {"component": "^pkg:maven/ca\\.uhn\\.hapi/", "licence": "MPL-1.1", "rule": "MPL-1.1",
                  "unmodified": True, "source_offer": None, "added_in": "WP-1.1b", "notes": "fixture"}

    def write_register(self, tmp: str, entries: list) -> str:
        path = Path(tmp) / "register.yaml"
        path.write_text(yaml.safe_dump({"schema_version": 1, "entries": entries}), encoding="utf-8")
        return str(path)

    def check_json(self, *argv: str) -> tuple[int, dict]:
        code, out = self.run_cli("check", *argv, "--json")
        return code, json.loads(out.strip().splitlines()[-1])

    def test_conditional_fails_until_registered(self) -> None:
        # §4.3: conditional licences are allowed only "unmodified and recorded in the licence register" (R-18).
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI])
            for argv in ([], ["--register", self.write_register(tmp, [])]):  # the real register, then an empty one
                code, data = self.check_json("--sbom", bom, *argv)
                self.assertEqual(code, 1, argv)
                self.assertFalse(data["ok"])
                self.assertEqual((data["counts"]["conditional"], data["counts"]["conditional_registered"]), (1, 0))
                self.assertEqual(len(data["errors"]), 1, data["errors"])
                self.assertIn("conditional: hapi-base@2.6 [shipped, bom.json]: MPL-1.1 is conditional", data["errors"][0])
                self.assertIn("allowed only with an entry in", data["errors"][0])
                self.assertIn("(rule 'MPL-1.1', licence 'MPL-1.1'), which has none for it", data["errors"][0])
                self.assertEqual(data["warnings"], [])

    def test_conditional_component_recorded_in_the_register_passes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI])
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [self.HAPI_ENTRY]))
            self.assertEqual(code, 0)
            self.assertTrue(data["ok"])
            self.assertEqual(data["counts"]["conditional_registered"], 1)
            self.assertEqual(data["counts"]["conditional"], 0)
            self.assertEqual(data["counts"]["register_entries"], 1)
            self.assertEqual((data["errors"], data["warnings"]), ([], []))

    def test_a_conditional_component_rule_needs_an_entry_too(self) -> None:
        dcm4che = {"name": "dcm4che-core", "version": "5.33.1", "purl": "pkg:maven/org.dcm4che/dcm4che-core@5.33.1",
                   "licenses": [{"expression": "MPL-1.1 OR GPL-2.0-only OR LGPL-2.1-only"}]}
        entry = {"component": "^pkg:maven/org\\.dcm4che/", "licence": "LGPL-2.1-only", "rule": "dcm4che-lgpl-option",
                 "unmodified": True, "source_offer": None, "added_in": "WP-3.6", "notes": None}
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [dcm4che])
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, []))
            self.assertEqual(code, 1)
            self.assertIn("dcm4che-lgpl-option", data["errors"][0])
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [entry]))
            self.assertEqual((code, data["counts"]["conditional_registered"]), (0, 1))

    def test_an_entry_that_does_not_record_unmodified_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI])
            modified = dict(self.HAPI_ENTRY, unmodified=False)
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [modified]))
            self.assertEqual(code, 1)
            self.assertIn("does not record 'unmodified: true'", data["errors"][0])
            self.assertEqual(data["counts"]["conditional_registered"], 0)

    def test_an_entry_for_another_component_does_not_count(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI])
            other = dict(self.HAPI_ENTRY, component="^pkg:maven/org\\.dcm4che/")
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [other]))
            self.assertEqual(code, 1)
            self.assertIn("which has none for it", data["errors"][0])

    DCM4CHE = {"name": "dcm4che-core", "version": "5.33.1", "purl": "pkg:maven/org.dcm4che/dcm4che-core@5.33.1",
               "licenses": [{"expression": "MPL-1.1 OR GPL-2.0-only OR LGPL-2.1-only"}]}

    def test_an_entry_under_another_rule_does_not_count(self) -> None:
        # An entry records the rule the policy applies; MPL-1.1 recorded as an OS package is not the §4.3 record.
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI])
            for rule in ("os-packages", "dcm4che-lgpl-option"):
                wrong = dict(self.HAPI_ENTRY, rule=rule)
                code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [wrong]))
                self.assertEqual(code, 1, rule)
                self.assertEqual(data["counts"]["conditional_registered"], 0, rule)
                self.assertEqual(len(data["errors"]), 1, data["errors"])
                self.assertIn("the policy applies rule 'MPL-1.1', licence 'MPL-1.1', and no entry in", data["errors"][0])
                self.assertIn(f"records rule '{rule}', licence 'MPL-1.1'", data["errors"][0])

    def test_an_entry_under_another_licence_does_not_count(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.DCM4CHE])
            entry = {"component": "^pkg:maven/org\\.dcm4che/", "licence": "LGPL-2.1-only", "rule": "dcm4che-lgpl-option",
                     "unmodified": True, "source_offer": None, "added_in": "WP-3.6", "notes": None}
            for licence in ("MPL-1.1", "MIT", "LGPL-2.1-only OR MPL-1.1"):
                wrong = dict(entry, licence=licence)
                code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [wrong]))
                self.assertEqual(code, 1, licence)
                self.assertIn("the policy applies rule 'dcm4che-lgpl-option', licence 'LGPL-2.1-only'", data["errors"][0])
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [entry]))
            self.assertEqual((code, data["counts"]["conditional_registered"]), (0, 1))

    def test_a_blanket_entry_records_no_component(self) -> None:
        # The review verifier's plant: one '.*' entry under the wrong rule and licence passed every conditional
        # component. It is now a malformed entry (it matches the empty string), and a broad pattern that is
        # well formed still records only components under its own rule and licence.
        blanket = {"component": ".*", "licence": "MIT", "rule": "os-packages", "unmodified": True,
                   "source_offer": None, "added_in": "WP-0.1"}
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI, self.DCM4CHE])
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [blanket]))
            self.assertEqual(code, 1)
            self.assertEqual((data["counts"]["conditional"], data["counts"]["conditional_registered"]), (2, 0))
            self.assertEqual(data["counts"]["register_entries"], 0)
            self.assertTrue(any("matches the empty string" in e for e in data["errors"]), data["errors"])
            broad = dict(blanket, component="(hapi|dcm4che)")
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [broad]))
            self.assertEqual(code, 1)
            self.assertEqual((data["counts"]["conditional"], data["counts"]["conditional_registered"]), (2, 0))
            self.assertEqual(data["counts"]["register_entries"], 1)
            self.assertEqual(len(data["errors"]), 2, data["errors"])
            for error in data["errors"]:
                self.assertIn("records rule 'os-packages', licence 'MIT'", error)

    def test_licences_compare_as_spdx_expressions(self) -> None:
        bash = {"name": "bash", "version": "5.2", "purl": "pkg:deb/debian/bash@5.2",
                "licenses": [{"license": {"id": "GPL-2.0-or-later"}}, {"license": {"id": "LGPL-2.1-only"}}]}
        entry = {"component": "^pkg:deb/debian/bash@", "licence": "LGPL-2.1-only AND GPL-2.0-or-later",
                 "rule": "os-packages", "unmodified": True, "source_offer": None, "added_in": "WP-0.9"}
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [bash])
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [entry]))
            self.assertEqual((code, data["counts"]["conditional_registered"]), (0, 1), data["errors"])
            part = dict(entry, licence="GPL-2.0-or-later")  # only part of what the package declares
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [part]))
            self.assertEqual(code, 1)
            self.assertIn("licence 'GPL-2.0-or-later AND LGPL-2.1-only'", data["errors"][0])

    def test_entries_that_disagree_about_unmodified_fail(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI])
            entries = [self.HAPI_ENTRY, dict(self.HAPI_ENTRY, component="hapi-base", unmodified=False)]
            for order in (entries, entries[::-1]):
                code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, order))
                self.assertEqual(code, 1)
                self.assertIn("('hapi-base') does not record 'unmodified: true'", data["errors"][0])

    def test_a_malformed_register_entry_fails_and_is_not_used(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI])
            bad = dict(self.HAPI_ENTRY, approved_by="someone")  # an entry records facts, never an approval
            code, data = self.check_json("--sbom", bom, "--register", self.write_register(tmp, [bad]))
            self.assertEqual(code, 1)
            self.assertTrue(any(e.startswith("register: ") and "unknown fields ['approved_by']" in e
                                for e in data["errors"]), data["errors"])
            self.assertTrue(any("which has none for it" in e for e in data["errors"]), data["errors"])
            self.assertEqual(data["counts"]["register_entries"], 0)

    def test_an_unparsable_register_is_an_environment_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bom = self.write_bom(tmp, [self.HAPI])
            register = Path(tmp) / "register.yaml"
            register.write_text("entries: [unclosed\n", encoding="utf-8")
            code, _ = self.run_cli("check", "--sbom", bom, "--register", str(register))
            self.assertEqual(code, 2)

    def test_no_input_is_a_usage_error(self) -> None:
        code, _ = self.run_cli("check")
        self.assertEqual(code, 2)


class RegisterSchema(unittest.TestCase):
    """tools/licence/register.yaml against the fields its header documents (register_problems)."""

    GOOD = {"component": "^pkg:maven/ca\\.uhn\\.hapi/", "licence": "MPL-1.1", "rule": "MPL-1.1", "unmodified": True,
            "source_offer": None, "added_in": "WP-1.1b", "notes": "fixture"}
    DROP = object()  # remove the field

    def problems(self, **changes) -> list[str]:
        entry = {k: v for k, v in dict(self.GOOD, **changes).items() if v is not self.DROP}
        return register_problems({"schema_version": 1, "entries": [entry]}, POLICY)

    def assert_problem(self, fragment: str, **changes) -> None:
        found = self.problems(**changes)
        self.assertTrue(any(fragment in p for p in found), f"no problem containing {fragment!r}: {found}")

    def test_the_real_register_is_well_formed(self) -> None:
        with open(ROOT / "tools/licence/register.yaml", encoding="utf-8") as handle:
            data = yaml.safe_load(handle)
        self.assertEqual(register_problems(data, POLICY), [])
        self.assertEqual(load_register(ROOT / "tools/licence/register.yaml", POLICY), (data["entries"], []))

    def test_a_good_entry_and_an_empty_register_pass(self) -> None:
        self.assertEqual(self.problems(), [])
        self.assertEqual(self.problems(notes=self.DROP), [])  # notes is optional
        self.assertEqual(register_problems({"schema_version": 1, "entries": []}, POLICY), [])
        self.assertEqual(register_problems(None, POLICY), [])

    def test_top_level_shape(self) -> None:
        self.assertIn("schema_version is 2, expected 1", register_problems({"schema_version": 2, "entries": []}, POLICY))
        self.assertIn("'entries' is not a list", register_problems({"schema_version": 1, "entries": {}}, POLICY))
        self.assertTrue(register_problems(["not", "a", "mapping"], POLICY))
        found = register_problems({"schema_version": 1, "entries": [], "approvals": []}, POLICY)
        self.assertIn("unknown top-level keys ['approvals']", found)

    def test_required_fields(self) -> None:
        for name in ("component", "licence", "rule", "unmodified", "source_offer", "added_in"):
            self.assert_problem(f"missing fields ['{name}']", **{name: self.DROP})

    def test_unknown_fields_such_as_an_approver_are_refused(self) -> None:
        self.assert_problem("unknown fields ['approved_by']", approved_by="the CSO")

    def test_field_values(self) -> None:
        self.assert_problem("'component' must be a non-empty string", component="")
        self.assert_problem("'component' is not a regular expression", component="^pkg:maven/(unclosed")
        for blanket in (".*", "(?i)hapi|", "x?"):
            self.assert_problem(f"'component' {blanket!r} matches the empty string", component=blanket)
        self.assert_problem("'licence' 'MPL-1.1 OR' is not an SPDX expression", licence="MPL-1.1 OR")
        self.assert_problem("'rule' 'mpl' is not a conditional rule of the policy", rule="mpl")
        self.assert_problem("'unmodified' must be true or false", unmodified="yes")
        self.assert_problem("'source_offer' must be a non-empty string or null", source_offer="")
        self.assert_problem("'added_in' 'phase 1' is not a work package ID", added_in="phase 1")
        self.assert_problem("'notes' must be text or null", notes=["a list"])

    def test_a_pattern_that_matches_a_package_it_does_not_name_is_refused(self) -> None:
        # The review found that '.' passed (it matches no empty string) and recorded every MPL-1.1 package.
        for blanket in (".", "pkg", "^pkg:", "^pkg:npm/", "^pkg:(deb|rpm)/", "e", "[a-z]", "(?i)PKG:", "^zz"):
            with self.subTest(component=blanket):
                self.assert_problem(f"'component' {blanket!r} also matches", component=blanket)
        for named in ("^pkg:maven/ca\\.uhn\\.hapi/", "^pkg:maven/org\\.dcm4che/", "^pkg:deb/debian/bash@",
                      "(?i)^(temurin|openjdk)([-_ ].*)?$", "hapi-base"):
            with self.subTest(component=named):
                self.assertEqual(self.problems(component=named), [])

    def test_a_broad_entry_records_nothing_and_the_check_fails(self) -> None:
        register = Path(self.tmp.name) / "register.yaml"
        register.write_text(yaml.safe_dump({"schema_version": 1, "entries": [dict(self.GOOD, component=".")]}), encoding="utf-8")
        entries, problems = load_register(register, POLICY)
        self.assertEqual(entries, [])
        self.assertTrue(any("'component' '.' also matches" in p for p in problems), problems)

    def test_a_rule_that_is_not_text_is_reported_not_raised(self) -> None:
        # The review found that a list here raised TypeError (unhashable) instead of being reported.
        for value in (["MPL-1.1"], {"id": "MPL-1.1"}, 3):
            with self.subTest(rule=value):
                self.assert_problem("'rule' must be a non-empty string", rule=value)

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def test_every_conditional_rule_of_the_policy_is_a_valid_rule(self) -> None:
        for rule in [*POLICY.conditional_licences(), *(r["id"] for r in POLICY.conditional_components())]:
            self.assertEqual(self.problems(rule=rule, source_offer="https://example.invalid/source"), [], rule)

    def test_a_separate_gpl_container_needs_its_source_offer(self) -> None:
        # §4.3: "GPL and AGPL only as unmodified, separate containers with a source offer".
        self.assert_problem("rule 'gpl-separate-container' needs 'source_offer'", rule="gpl-separate-container")
        self.assertEqual(self.problems(rule="gpl-separate-container", source_offer="https://example.invalid/src"), [])


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

    def test_conditional_rules_stay_warnings_only_while_the_ort_step_is_not_built(self) -> None:
        # The decision recorded for R-18 (tools/licence/README.md, "Conditional licences"): the ORT rules for
        # conditional licences and components are WARNINGs until WP-0.9 builds the ORT step, then ERRORs for any
        # package the register does not record. When the step is built, this test fails until both change.
        from hmstools.ci.tiers import MERGE_NOT_BUILT

        self.assertIn("licence-scan-ort", [step[0] for step in MERGE_NOT_BUILT])
        rules = (ROOT / "tools/licence/ort/evaluator.rules.kts").read_text(encoding="utf-8")
        for name in ("conditionalLicenseRule", "conditionalComponentRule"):
            body = rules.split(f"fun RuleSet.{name}()", 1)[1].split("\nfun ", 1)[0]
            self.assertIn("warning(", body, name)
            self.assertNotIn("error(", body, name)
        readme = " ".join((ROOT / "tools/licence/README.md").read_text(encoding="utf-8").split())
        self.assertIn("stay WARNINGs until the ORT step exists (WP-0.9)", readme)
        self.assertIn("fails on a conditional component without one", readme)

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
