"""`tools/hms statemachines si-status` (spec §4 reporting rule, §7 nightly step si-domain-layer).

Each test writes a synthetic register (and status files) into a temporary root; the last class reads the real
tests/invariants/si-register.json, so the reader follows the key names the SI scaffold writes.
"""

from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from hmstools.statemachines import sistatus
from hmstools.statemachines.__main__ import main
from hmstools.statemachines.check import Paths
from hmstools.statemachines.tests.harness import REPO


def entry(number: int, domain: str = "NOT-BUILT", spec_layer: list | None = None) -> dict:
    si = f"SI-{number:02d}"
    return {
        "si": si, "title": f"synthetic {si}, NOT FOR CLINICAL USE", "domain_layer": domain, "waits_on": "WP-9.9", "ka": "KA-060",
        "hazards": ["HAZ-0001"], "backlog": ["SYN-01"], "domain_marker": f"backend/modules/syn/src/main/kotlin/hms/syn{number}/domain",
        "spec_layer": spec_layer or [], "planned_test": f"PropertyTest:{si}-*",
    }


PROPERTY = [{"machine": "toy-light", "property": "never on without power", "clauses": ["synthetic clause"]}]


class SiStatus(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="hms-si-status-test-")
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.entries = [entry(n) for n in range(1, 22)]

    def write_register(self, document: object = None) -> None:
        path = self.root / sistatus.REGISTER
        path.parent.mkdir(parents=True, exist_ok=True)
        text = document if isinstance(document, str) else json.dumps(document or {"version": 1, "entries": self.entries})
        path.write_text(text, encoding="utf-8")

    def write_status(self, name: str, **values: object) -> Path:
        data = {"si": name, "spec_layer": "NONE", "spec_layer_properties": [], "domain_layer": "NOT-BUILT", "sequences": 0, **values}
        path = self.root / sistatus.STATUS_DIR / f"{name}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def run_main(self, *argv: str) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = main(["si-status", *argv], paths=Paths.for_root(self.root))
        return code, out.getvalue()

    def result(self, require_domain: bool = False):  # noqa: ANN201
        return sistatus.run_si_status(self.root, require_domain)[0]

    def test_a_missing_register_fails_closed(self) -> None:
        code, out = self.run_main("--json")
        self.assertEqual(code, 1)
        data = json.loads(out.strip().splitlines()[-1])
        self.assertFalse(data["ok"])
        self.assertIn("tests/invariants/si-register.json does not exist: the SI register is missing", data["errors"][0])

    def test_a_report_passes_and_lists_every_not_built_domain_layer(self) -> None:
        self.write_register()
        code, out = self.run_main("--json")
        self.assertEqual(code, 0)
        self.assertIn("SI-01: spec layer not run in this build (0 properties registered); domain layer NOT-BUILT (waits on WP-9.9; KA-060)", out)
        data = json.loads(out.strip().splitlines()[-1])
        self.assertEqual((data["counts"]["entries"], data["counts"]["domain_not_built"]), (21, 21))
        self.assertTrue(any("21 SI domain layer(s) NOT-BUILT" in w for w in data["warnings"]))

    def test_require_domain_fails_while_any_is_not_built(self) -> None:
        self.write_register()
        code, out = self.run_main("--require-domain", "--json")
        self.assertEqual(code, 1)
        errors = json.loads(out.strip().splitlines()[-1])["errors"]
        self.assertEqual(len(errors), 1)
        self.assertIn("21 SI domain layer(s) NOT-BUILT, so C2 ('across all invariants') is not met: SI-01 (waits on WP-9.9; KA-060); ", errors[0])
        self.assertIn("SI-21 (waits on WP-9.9; KA-060)", errors[0])
        self.entries = [entry(n, "BUILT") for n in range(1, 21)] + [entry(21)]
        self.write_register()
        errors = self.result(require_domain=True).errors
        self.assertEqual(len(errors), 1)
        self.assertIn("1 SI domain layer(s) NOT-BUILT, so C2 ('across all invariants') is not met: SI-21 (waits on WP-9.9; KA-060)", errors[0])

    def test_require_domain_passes_when_every_domain_layer_is_built(self) -> None:
        self.entries = [entry(n, "BUILT") for n in range(1, 22)]
        self.write_register()
        self.assertEqual(self.run_main("--require-domain", "--json")[0], 0)

    def test_a_malformed_register_fails(self) -> None:
        broken = [entry(n) for n in range(1, 21)]
        broken[0]["domain_layer"] = "HOLDS"
        broken[1]["waits_on"] = ""
        broken[2]["spec_layer"] = [{"machine": "toy-light"}]
        broken[3]["backlog"] = []
        broken[4]["domain_marker"] = None
        broken.append(dict(broken[5]))
        for document, fragment in (
            ({"version": 1, "entries": broken}, "SI-01: domain_layer is 'HOLDS', not one of NOT-BUILT, BUILT"),
            ({"version": 1, "entries": broken}, "SI-02: a NOT-BUILT domain layer names the work package it waits on"),
            ({"version": 1, "entries": broken}, "SI-03: spec_layer[0] is not {machine, property, clauses}"),
            ({"version": 1, "entries": broken}, "SI-04: backlog is not a non-empty list of ids"),
            ({"version": 1, "entries": broken}, "SI-05: a NOT-BUILT domain layer names its domain_marker"),
            ({"version": 1, "entries": broken}, "SI-06 is listed twice"),
            ({"version": 1, "entries": broken}, "no entry for SI-21"),
            ({"version": 2, "entries": self.entries}, "version is 2; this reader knows version 1"),
            ({"version": 1.0, "entries": self.entries}, "version is 1.0"),
            ({"version": 1, "entries": {}}, "entries is not a list"),
            ("[", "is not JSON"),
        ):
            with self.subTest(fragment=fragment):
                self.write_register(document)
                result = self.result()
                self.assertFalse(result.ok)
                self.assertIn(fragment, "\n".join(result.errors))

    def test_status_files_are_counted(self) -> None:
        self.entries[1] = entry(2, spec_layer=PROPERTY)
        self.write_register()
        self.write_status("SI-01")
        self.write_status("SI-02", spec_layer="HOLDS", spec_layer_properties=["never on without power"], sequences=1000)
        code, out = self.run_main("--json")
        self.assertEqual(code, 0, out)
        self.assertIn("SI-02: spec layer HOLDS, 1 property, 1000 sequences; domain layer NOT-BUILT (waits on WP-9.9; KA-060)", out)
        counts = json.loads(out.strip().splitlines()[-1])["counts"]
        self.assertEqual({k: counts[k] for k in ("status_files", "si_spec_layer_holds", "si_spec_layer_none", "si_domain_not_built",
                                                 "spec_layer_sequences", "spec_layer_entries")},
                         {"status_files": 2, "si_spec_layer_holds": 1, "si_spec_layer_none": 1, "si_domain_not_built": 2,
                          "spec_layer_sequences": 1000, "spec_layer_entries": 1})

    def test_a_failed_or_inconsistent_status_fails(self) -> None:
        self.entries[1] = entry(2, spec_layer=PROPERTY)
        self.write_register()
        for values, fragment in (
            ({"spec_layer": "FAILED"}, "SI-02: the specification-layer property failed"),
            ({"spec_layer": "HOLDS", "domain_layer": "BUILT"}, "domain_layer is BUILT but the register says NOT-BUILT"),
            ({"spec_layer": "PASS"}, "spec_layer is 'PASS', not one of HOLDS, NONE, FAILED"),
            ({"spec_layer": "HOLDS", "si": "SI-03"}, "si is 'SI-03', not SI-02"),
            ({"spec_layer": "NONE"}, "spec_layer NONE, but the register lists 1 specification-layer properties"),
            ({"spec_layer": "HOLDS", "sequences": -1}, "sequences is -1, not a count"),
        ):
            with self.subTest(fragment=fragment):
                self.write_status("SI-02", **values)
                result = self.result()
                self.assertFalse(result.ok)
                self.assertIn(fragment, "\n".join(result.errors))
        self.write_status("SI-02", spec_layer="HOLDS")
        self.write_status("SI-01", spec_layer="HOLDS")
        self.assertIn("SI-01.json: spec_layer HOLDS, but the register lists no specification-layer property", "\n".join(self.result().errors))
        (self.root / sistatus.STATUS_DIR / "SI-01.json").unlink()
        (self.root / sistatus.STATUS_DIR / "notes.json").write_text("{}", encoding="utf-8")
        self.assertIn("notes.json: not the status file of an SI in the register", "\n".join(self.result().errors))


class RealRegister(unittest.TestCase):
    def test_the_register_of_the_si_scaffold_reads_without_errors(self) -> None:
        entries, errors = sistatus.read_register(REPO)
        self.assertEqual(errors, [])
        self.assertEqual([e.si for e in entries], list(sistatus.SI_IDS))


if __name__ == "__main__":
    unittest.main()
