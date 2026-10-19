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

    # py-01: every way to a second implementation that the first scan missed.

    def implemented_twice(self, extra: str) -> None:
        self.assertFailsWith(self.box.check(), "rule 12: ToyLightPredicates is implemented 2 times", extra)

    def test_a_second_implementation_through_a_sub_interface(self) -> None:
        self.box.write(f"{MAIN}/Loose.kt", "package hms.adt.domain.toylight\n\ninterface Loose : ToyLightPredicates {\n"
                       "    override fun lampIntact(facts: ToyLightFacts) = true\n}\n\nobject LooseGuards : Loose {\n}\n")
        result = self.box.check()
        self.assertFailsWith(result, f"rule 12: interface Loose in {MAIN}/Loose.kt extends ToyLightPredicates",
                             f"object LooseGuards in {MAIN}/Loose.kt")
        self.implemented_twice("object LooseGuards")

    def test_an_interface_extending_it_fails_even_with_no_implementation(self) -> None:
        self.box.write(f"{MAIN}/Loose.kt", "package hms.adt.domain.toylight\n\nsealed interface Loose : ToyLightPredicates\n")
        self.assertFailsWith(self.box.check(), f"rule 12: interface Loose in {MAIN}/Loose.kt extends ToyLightPredicates")

    def test_a_second_implementation_through_a_type_alias(self) -> None:
        self.box.write(f"{MAIN}/Alias.kt", "package hms.adt.domain.toylight\n\ntypealias P = ToyLightPredicates\n\n"
                       "typealias Q = P\n\nobject AliasGuards : Q {\n}\n")
        self.implemented_twice(f"object AliasGuards in {MAIN}/Alias.kt")

    def test_a_second_implementation_through_an_import_alias(self) -> None:
        self.box.write(f"{MAIN}/Imp.kt", "package hms.adt.domain.toylight\n\nimport hms.adt.domain.toylight.ToyLightPredicates as Q\n\n"
                       "object Q2 : Q {\n}\n")
        self.implemented_twice(f"object Q2 in {MAIN}/Imp.kt")

    def test_a_second_implementation_through_an_open_class(self) -> None:
        self.box.write(f"{MAIN}/Base.kt", "package hms.adt.domain.toylight\n\nabstract class Base : ToyLightPredicates\n\n"
                       "object Derived : Base() {\n}\n")
        self.assertFailsWith(self.box.check(), "rule 12: ToyLightPredicates is implemented 3 times", f"class Base in {MAIN}/Base.kt",
                             f"object Derived in {MAIN}/Base.kt")

    def test_delegation_and_a_companion_object_are_implementations(self) -> None:
        self.box.write(f"{MAIN}/Deleg.kt", "package hms.adt.domain.toylight\n\nobject Wrapped : ToyLightPredicates by ToyLightGuards\n\n"
                       "class Holder {\n    companion object : `ToyLightPredicates` by ToyLightGuards\n}\n")
        self.assertFailsWith(self.box.check(), "rule 12: ToyLightPredicates is implemented 3 times", f"object Wrapped in {MAIN}/Deleg.kt",
                             f"companion object (anonymous) in {MAIN}/Deleg.kt")

    def test_a_fake_in_every_other_source_set_and_in_the_tests_projects(self) -> None:
        fake = "package hms.adt.domain.toylight\n\nobject FakeGuards : ToyLightPredicates {\n}\n"
        for rel in ("backend/modules/adt/src/testFixtures/kotlin/hms/adt/domain/toylight/FakeGuards.kt",
                    "backend/modules/adt/src/propertyTest/kotlin/hms/adt/domain/toylight/FakeGuards.kt",
                    "backend/modules/adt/src/test/kotlin/hms/adt/domain/toylight/FakeGuards.kt",
                    "tests/invariants/src/test/kotlin/hms/tests/invariants/FakeGuards.kt",
                    "tests/scenarios/src/main/kotlin/hms/tests/scenarios/FakeGuards.kt"):
            with self.subTest(rel=rel):
                path = self.box.write(rel, fake)
                self.implemented_twice(f"object FakeGuards in {rel}")
                path.unlink()
        self.box.write("tests/invariants/build/generated/FakeGuards.kt", fake)  # build output is not source
        self.assertPasses(self.box.check())

    def test_the_one_implementation_is_named_guards(self) -> None:
        guards = self.box.root / MAIN / "ToyLightGuards.kt"
        guards.write_text(guards.read_text(encoding="utf-8").replace("object ToyLightGuards :", "object LampRules :"), encoding="utf-8")
        self.assertFailsWith(self.box.check(), f"rule 12: ToyLightPredicates is implemented by object LampRules in {MAIN}/ToyLightGuards.kt; "
                             "the one implementation is named ToyLightGuards")

    def test_the_one_implementation_lives_in_src_main(self) -> None:
        guards = self.box.root / MAIN / "ToyLightGuards.kt"
        text = guards.read_text(encoding="utf-8")
        guards.unlink()
        moved = "backend/modules/adt/src/testFixtures/kotlin/hms/adt/domain/toylight/ToyLightGuards.kt"
        self.box.write(moved, text)
        self.assertFailsWith(self.box.check(), f"rule 12: object ToyLightGuards in {moved} is not in backend/modules/adt/src/main/kotlin")

    # py-02: every Kotest skip mechanism fails the file.

    def test_every_skip_mechanism_fails(self) -> None:
        leaf = 'test("powerAvailable holds on mains power")'
        for old, new, message in (
            (leaf, 'test("!powerAvailable holds on mains power")', "the test name '!powerAvailable holds on mains power' starts with '!'"),
            ('context("lampIntact")', 'context("f:lampIntact")', "the test name 'f:lampIntact' starts with 'f:'"),
            ("class ToyLightGuardsTest :", "@EnabledIf(Never::class)\nclass ToyLightGuardsTest :", "'@EnabledIf'"),
            ("class ToyLightGuardsTest :", "@enabledif(Never::class)\nclass ToyLightGuardsTest :", "'@enabledif'"),
            ("class ToyLightGuardsTest :", "@DisabledIf(Always::class)\nclass ToyLightGuardsTest :", "'@DisabledIf'"),
            ("class ToyLightGuardsTest :", "@Ignored\nclass ToyLightGuardsTest :", "'@Ignored'"),
            (leaf, f"{leaf}.config(enabled = off.mainsOn)", "'enabled ='"),
            (leaf, f"{leaf}.config(enabled = true && off.mainsOn)", "'enabled ='"),
            (leaf, f"{leaf}.config(enabledIf = {{ false }})", "'enabledIf'"),
            (leaf, f"{leaf}.config(invocations = 0)", "'invocations = 0'"),
            ('context("lampIntact")', 'xContext("lampIntact")', "'xContext('"),
        ):
            with self.subTest(new=new):
                text = self.guards_test().replace(old, new, 1)
                self.assertNotEqual(text, self.guards_test())
                self.box.write(f"{TEST}/ToyLightGuardsTest.kt", text)
                self.assertFailsWith(self.box.check(), f"rule 12: {TEST}/ToyLightGuardsTest.kt disables or skips a test", message)

    def test_enabled_true_is_not_a_skip(self) -> None:
        text = self.guards_test().replace('test("powerAvailable holds on mains power")',
                                          'test("powerAvailable holds on mains power").config(enabled = true)')
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", text)
        self.assertPasses(self.box.check())

    # py-07: only names that run count.

    def test_an_empty_container_does_not_count(self) -> None:
        text = self.guards_test().replace(
            'test("powerAvailable holds on mains power") {\n            ToyLightGuards.powerAvailable(off.copy(mainsOn = true)) shouldBe true\n        }',
            'context("powerAvailable") { }',
        )
        self.assertNotEqual(text, self.guards_test())
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", text)
        self.assertFailsWith(self.box.check(), "rule 12: predicate 'powerAvailable' is named in no test name")

    def test_a_name_outside_the_spec_class_does_not_count(self) -> None:
        text = self.guards_test().replace('test("powerAvailable holds on mains power")', 'test("power holds")')
        text = text.replace("class ToyLightGuardsTest :", 'fun neverRun() = FunSpec({ test("powerAvailable x") { } })\n\nclass ToyLightGuardsTest :')
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", text)
        self.assertFailsWith(self.box.check(), "rule 12: predicate 'powerAvailable' is named in no test name")

    def test_the_spec_class_must_exist(self) -> None:
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", self.guards_test().replace("class ToyLightGuardsTest", "class LampTest"))
        self.assertFailsWith(self.box.check(), f"rule 12: {TEST}/ToyLightGuardsTest.kt declares no class ToyLightGuardsTest")

    def test_a_class_body_and_behavior_spec_containers_count(self) -> None:
        self.box.write(f"{TEST}/ToyLightGuardsTest.kt", "package hms.adt.domain.toylight\n\nclass ToyLightGuardsTest : BehaviorSpec() {\n"
                       "    init {\n        Given(\"powerAvailable\") {\n            Then(\"holds\") { }\n        }\n"
                       "        When(\"lampIntact\") {\n            then(\"holds\") { }\n        }\n"
                       "        \"privilegedAndAudited\" - {\n            \"holds\" { }\n        }\n    }\n}\n")
        self.assertPasses(self.box.check())

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

    def test_unterminated_comment_string_and_trailing_backslash(self) -> None:
        self.assertEqual(scan("a /* never closed").code, "a  ")
        self.assertEqual(scan('a "open \\').strings, ["open \\"])
        self.assertEqual(scan('x = """raw ${"$"} end""""" + 1').strings, ['raw ${"$"} end""'])


if __name__ == "__main__":
    unittest.main()
