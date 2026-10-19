"""Rule 12 of spec §2.1: each predicate implemented once (one object) and named in a unit-test name."""

from __future__ import annotations

import unittest

from hmstools.statemachines.implementation import scan
from hmstools.statemachines.tests.harness import FIXTURES, TOY_TARGETS, SandboxCase

MAIN = "backend/modules/adt/src/main/kotlin/hms/adt/domain/toylight"
TEST = "backend/modules/adt/src/test/kotlin/hms/adt/domain/toylight"


class Rule12(SandboxCase):
    def setUp(self) -> None:
        super().setUp()
        self.box.add("clean", "toy-light.yaml", "toy-light.md")
        self.box.install_kotlin("toy-light")
        self.assertPasses(self.box.generate())

    def guards_test(self) -> str:
        return (FIXTURES / "kotlin" / "ToyLightGuardsTest.kt.txt").read_text(encoding="utf-8")

    def test_the_fixture_passes(self) -> None:
        self.assertPasses(self.box.check())

    def test_no_kotlin_yet_fails_closed(self) -> None:
        (self.box.root / MAIN / "ToyLightGuards.kt").unlink()
        (self.box.root / TEST / "ToyLightGuardsTest.kt").unlink()
        self.assertFailsWith(
            self.box.check(),
            "rule 12: no object implements ToyLightPredicates under backend/modules/adt/src/main/kotlin (expected object "
            "ToyLightGuards : ToyLightPredicates in package hms.adt.domain.toylight)",
            "rule 12: no unit-test file ToyLightGuardsTest.kt under backend/modules/adt/src/test/kotlin",
        )

    def test_a_second_implementation(self) -> None:
        self.box.write(f"{MAIN}/Other.kt", "package hms.adt.domain.toylight\n\nclass LooseGuards(\n    val x: Int = 1,\n) : Any(),\n"
                       "    ToyLightPredicates {\n}\n\nval anonymous = object : hms.adt.domain.toylight.ToyLightPredicates {}\n")
        self.assertFailsWith(
            self.box.check(),
            f"rule 12: ToyLightPredicates is implemented 3 times (class LooseGuards in {MAIN}/Other.kt; anonymous object "
            f"(anonymous) in {MAIN}/Other.kt; object ToyLightGuards in {MAIN}/ToyLightGuards.kt); exactly one object implements it",
        )

    def test_a_class_is_not_the_implementation(self) -> None:
        guards = self.box.root / MAIN / "ToyLightGuards.kt"
        guards.write_text(guards.read_text(encoding="utf-8").replace("object ToyLightGuards :", "class ToyLightGuards :"), encoding="utf-8")
        self.assertFailsWith(self.box.check(), "rule 12: ToyLightPredicates is implemented by the class ToyLightGuards")

    def test_the_wrong_package(self) -> None:
        guards = self.box.root / MAIN / "ToyLightGuards.kt"
        guards.write_text(guards.read_text(encoding="utf-8").replace("package hms.adt.domain.toylight", "package hms.adt.domain.other"),
                          encoding="utf-8")
        self.assertFailsWith(self.box.check(), "is in package hms.adt.domain.other, not in the machine's domain package hms.adt.domain.toylight")

    def test_a_predicate_named_in_no_test_name(self) -> None:
        text = self.guards_test().replace('test("powerAvailable holds on mains power")', 'test("power holds on mains")')
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", text)
        self.assertFailsWith(self.box.check(), f"rule 12: predicate 'powerAvailable' is named in no test name of {TEST}/ToyLightGuardsTest.kt")

    def test_a_name_in_a_comment_or_in_code_does_not_count(self) -> None:
        text = self.guards_test().replace('context("lampIntact")', 'context("the lamp") // lampIntact')
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", text)
        self.assertFailsWith(self.box.check(), "rule 12: predicate 'lampIntact' is named in no test name")

    def test_a_longer_word_does_not_count(self) -> None:
        text = self.guards_test().replace('test("powerAvailable holds on mains power")', 'test("powerAvailableNow holds")')
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", text)
        self.assertFailsWith(self.box.check(), "rule 12: predicate 'powerAvailable' is named in no test name")

    def test_a_disabled_test_fails(self) -> None:
        for disabled in ('xtest("powerAvailable holds on mains power")', 'test("powerAvailable holds on mains power").config(enabled = false)'):
            text = self.guards_test().replace('test("powerAvailable holds on mains power")', disabled)
            self.box.write(f"{TEST}/ToyLightGuardsTest.kt", text)
            self.assertFailsWith(self.box.check(), "disables or skips a test")

    def test_two_test_files(self) -> None:
        self.box.write(f"{TEST}/more/ToyLightGuardsTest.kt", self.guards_test())
        self.assertFailsWith(self.box.check(), "rule 12: 2 files named ToyLightGuardsTest.kt")

    def test_string_spec_names_count(self) -> None:
        names = "\n".join(f'    "{n} holds" {{ }}' for n in ("powerAvailable", "lampIntact", "privilegedAndAudited"))
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", f"package hms.adt.domain.toylight\n\nclass ToyLightGuardsTest : StringSpec({{\n{names}\n}})\n")
        self.assertPasses(self.box.check())

    def test_the_generated_interface_is_not_an_implementation(self) -> None:
        # The generated file lives in the same source set and names ToyLightPredicates in KDoc and code.
        target = TOY_TARGETS["toy-light"]
        self.assertTrue((self.box.root / target.main_file).is_file())
        self.assertPasses(self.box.check())


class Scanner(unittest.TestCase):
    def test_comments_strings_templates_and_chars(self) -> None:
        source = scan('val a = "x \\" ${f("in")} y" /* c /* nested */ still */ val b = \'"\' // "no"\nval c = """raw "q" """')
        self.assertEqual(source.strings, ['x \\" ${f("in")} y', 'raw "q" '])
        self.assertNotIn("nested", source.code)
        self.assertNotIn("no", source.code)
        self.assertIn("val b", source.code)
        self.assertIn("val c", source.code)


if __name__ == "__main__":
    unittest.main()
