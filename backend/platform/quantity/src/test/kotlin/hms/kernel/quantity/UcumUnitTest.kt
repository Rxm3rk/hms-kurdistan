package hms.kernel.quantity

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.InvocationTargetException

/**
 * `UnitTest:ucum-syntax-accepts-and-rejects` (platform-kernel.md §10.2, §17). The UCUM specification is not yet in
 * docs/content-sources/ (OQ-KN5), so the vectors are grammar cases that need no atom table: atoms are the few codes
 * BUILD-PROMPT uses or obviously synthetic symbols, which pass because unknown atoms pass the syntax check.
 */
class UcumUnitTest :
    FunSpec({
        // code to hasUnitAtom
        val valid =
            listOf(
                "mg" to true,
                "mL" to true,
                "mL/h" to true,
                "xa2" to true,
                "xa-2" to true,
                "xa+2" to true,
                "xa0" to true,
                "/h" to true,
                "/(xa.xb)" to true,
                "xa.xb.xc/xd/xe" to true,
                "(xa)" to true,
                "((xa))" to true,
                "(xa.xb)/xc" to true,
                "xa{note}" to true,
                "xa{a-b_c.d/e(f)}" to true,
                "xa2{note}" to true,
                "10*3/mL" to true,
                "[xa]" to true,
                "[x_a]2" to true,
                "xa[b]c" to true,
                "[a.b/c]" to true,
                "%" to true,
                "'" to true,
                "1" to false,
                "123" to false,
                "007" to false,
                "10*3" to false,
                "10*-3" to false,
                "10^3" to false,
                "10*" to false,
                "10*3.10^2" to false,
                "1/10*3" to false,
                "(1)" to false,
                "{note}" to false,
                "{}" to false,
                "1{note}" to false,
                "/{note}" to false,
            )

        test("ucum-syntax-accepts-and-rejects: valid codes are accepted, kept verbatim and report hasUnitAtom") {
            valid.forEach { (code, hasAtom) ->
                withClue(code) {
                    val unit = UcumUnit.parse(code).shouldBeInstanceOf<UcumParseResult.Valid>().unit
                    unit.code shouldBe code
                    unit.hasUnitAtom shouldBe hasAtom
                    unit.toString() shouldBe code
                }
            }
        }

        val invalid =
            listOf(
                Triple("", UcumSyntaxError.EMPTY, 0),
                Triple(" mg", UcumSyntaxError.ILLEGAL_CHARACTER, 0),
                Triple("mg ", UcumSyntaxError.ILLEGAL_CHARACTER, 2),
                Triple("m g", UcumSyntaxError.ILLEGAL_CHARACTER, 1),
                Triple("m\tg", UcumSyntaxError.ILLEGAL_CHARACTER, 1),
                Triple("\u00B5g", UcumSyntaxError.ILLEGAL_CHARACTER, 0),
                Triple("xa{a b}", UcumSyntaxError.ILLEGAL_CHARACTER, 4),
                Triple("[xa", UcumSyntaxError.ILLEGAL_CHARACTER, 0),
                Triple("xa]", UcumSyntaxError.ILLEGAL_CHARACTER, 2),
                Triple("[a[b]]", UcumSyntaxError.ILLEGAL_CHARACTER, 0),
                Triple("(xa)xb", UcumSyntaxError.ILLEGAL_CHARACTER, 4),
                Triple("{a}xa", UcumSyntaxError.ILLEGAL_CHARACTER, 3),
                Triple("xa(xb)", UcumSyntaxError.ILLEGAL_CHARACTER, 2),
                Triple("xa{a}{b}", UcumSyntaxError.ILLEGAL_CHARACTER, 5),
                Triple("(", UcumSyntaxError.UNBALANCED_PARENTHESIS, 0),
                Triple(")", UcumSyntaxError.UNBALANCED_PARENTHESIS, 0),
                Triple("(xa", UcumSyntaxError.UNBALANCED_PARENTHESIS, 0),
                Triple("xa)", UcumSyntaxError.UNBALANCED_PARENTHESIS, 2),
                Triple("(xa))", UcumSyntaxError.UNBALANCED_PARENTHESIS, 4),
                Triple("xa.(", UcumSyntaxError.UNBALANCED_PARENTHESIS, 3),
                Triple("((xa)", UcumSyntaxError.UNBALANCED_PARENTHESIS, 0),
                Triple("{xa", UcumSyntaxError.UNBALANCED_ANNOTATION, 0),
                Triple("xa{b", UcumSyntaxError.UNBALANCED_ANNOTATION, 2),
                Triple("xa}", UcumSyntaxError.UNBALANCED_ANNOTATION, 2),
                Triple("}", UcumSyntaxError.UNBALANCED_ANNOTATION, 0),
                Triple("{a{b}}", UcumSyntaxError.UNBALANCED_ANNOTATION, 2),
                Triple("()", UcumSyntaxError.MISSING_TERM, 1),
                Triple("xa.()", UcumSyntaxError.MISSING_TERM, 4),
                Triple("xa-", UcumSyntaxError.BAD_EXPONENT, 2),
                Triple("xa+", UcumSyntaxError.BAD_EXPONENT, 2),
                Triple("xa-b", UcumSyntaxError.BAD_EXPONENT, 2),
                Triple("xa-2b", UcumSyntaxError.BAD_EXPONENT, 2),
                Triple("xa2-3", UcumSyntaxError.BAD_EXPONENT, 3),
                Triple("-2", UcumSyntaxError.BAD_EXPONENT, 0),
                Triple("2-3", UcumSyntaxError.BAD_EXPONENT, 1),
                Triple("(xa)2", UcumSyntaxError.BAD_EXPONENT, 4),
                Triple("xa{b}2", UcumSyntaxError.BAD_EXPONENT, 5),
                Triple("/", UcumSyntaxError.DANGLING_OPERATOR, 0),
                Triple(".", UcumSyntaxError.DANGLING_OPERATOR, 0),
                Triple("xa.", UcumSyntaxError.DANGLING_OPERATOR, 2),
                Triple("xa/", UcumSyntaxError.DANGLING_OPERATOR, 2),
                Triple(".xa", UcumSyntaxError.DANGLING_OPERATOR, 0),
                Triple("//xa", UcumSyntaxError.DANGLING_OPERATOR, 0),
                Triple("xa..xb", UcumSyntaxError.DANGLING_OPERATOR, 2),
                Triple("xa./xb", UcumSyntaxError.DANGLING_OPERATOR, 2),
                Triple("(/xa)", UcumSyntaxError.DANGLING_OPERATOR, 1),
                Triple("(xa/)", UcumSyntaxError.DANGLING_OPERATOR, 3),
            )

        test("ucum-syntax-accepts-and-rejects: invalid codes are refused with the error and its position") {
            invalid.forEach { (code, error, position) ->
                withClue(code) { UcumUnit.parse(code) shouldBe UcumParseResult.Invalid(error, position) }
            }
        }

        test("ucum-syntax-accepts-and-rejects: a code of 256 characters is accepted, 257 is TOO_LONG") {
            val longest = "xa." + "xb.".repeat((UcumUnit.MAX_LENGTH - 4) / 3) + "x"
            longest.length shouldBe UcumUnit.MAX_LENGTH
            UcumUnit.parse(longest).shouldBeInstanceOf<UcumParseResult.Valid>()
            UcumUnit.parse(longest + "c") shouldBe UcumParseResult.Invalid(UcumSyntaxError.TOO_LONG, UcumUnit.MAX_LENGTH)
            UcumUnit.parse("x".repeat(10_000)) shouldBe UcumParseResult.Invalid(UcumSyntaxError.TOO_LONG, UcumUnit.MAX_LENGTH)
            // The length check comes before the character check.
            UcumUnit.parse(" ".repeat(UcumUnit.MAX_LENGTH + 1)) shouldBe
                UcumParseResult.Invalid(UcumSyntaxError.TOO_LONG, UcumUnit.MAX_LENGTH)
        }

        test("ucum-syntax-accepts-and-rejects: nesting up to the length limit is accepted") {
            val depth = UcumUnit.MAX_LENGTH / 2 - 1
            val nested = "(".repeat(depth) + "xa" + ")".repeat(depth)
            UcumUnit.parse(nested).shouldBeInstanceOf<UcumParseResult.Valid>().unit.hasUnitAtom shouldBe true
        }

        test("unit equality is exact, case-sensitive code equality") {
            QuantityFixtures.unit("mL") shouldBe QuantityFixtures.unit("mL")
            QuantityFixtures.unit("mL").hashCode() shouldBe QuantityFixtures.unit("mL").hashCode()
            QuantityFixtures.unit("mL") shouldNotBe QuantityFixtures.unit("ml")
            QuantityFixtures.unit("mL/h") shouldNotBe QuantityFixtures.unit("(mL)/h")
            QuantityFixtures.unit("10*3") shouldNotBe QuantityFixtures.unit("10^3")
        }

        test("reflective construction with an invalid code throws IllegalArgumentException") {
            val constructor = UcumUnit::class.java.declaredConstructors.single { it.parameterCount == 1 }.apply { isAccessible = true }
            constructor.newInstance("xa").shouldBeInstanceOf<UcumUnit>().hasUnitAtom shouldBe true
            listOf("", "x a", "(xa", "xa/").forEach { code ->
                withClue(code) {
                    shouldThrow<InvocationTargetException> { constructor.newInstance(code) }
                        .cause
                        .shouldBeInstanceOf<IllegalArgumentException>()
                }
            }
        }
    })
