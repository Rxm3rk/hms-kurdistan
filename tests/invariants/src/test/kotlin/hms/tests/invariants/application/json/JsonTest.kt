package hms.tests.invariants.application.json

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

/** The scaffold's JSON reader and writer: strict, so a malformed register never reads as something else. */
class JsonTest :
    FunSpec({
        test("objects keep document order; arrays, strings, integers, booleans and null read as themselves") {
            Json.parse("""{"b": [1, -2, 0], "a": "x\"y\\zé\n", "t": true, "f": false, "n": null, "o": {}}""") shouldBe
                linkedMapOf("b" to listOf(1L, -2L, 0L), "a" to "x\"y\\zé\n", "t" to true, "f" to false, "n" to null, "o" to emptyMap<String, Any?>())
        }

        test("render then parse gives the value back") {
            val value = linkedMapOf("si" to "SI-02", "count" to 3L, "list" to listOf("a", null, true), "empty" to emptyList<Any?>(), "text" to "§ ↔ \t")
            Json.parse(Json.render(value)) shouldBe value
        }

        test("render writes two-space indents and a final newline") {
            Json.render(linkedMapOf("a" to listOf(1L))) shouldBe "{\n  \"a\": [\n    1\n  ]\n}\n"
        }

        listOf(
            """{"a": 1, "a": 2}""" to "duplicate key",
            """{"a": 1.5}""" to "only integers",
            """{"a": 1e3}""" to "only integers",
            """{"a": 01}""" to "invalid number",
            """[1, 2,]""" to "unexpected",
            """{"a": 1} x""" to "after the JSON value",
            """{"a" 1}""" to "expected ':'",
            """["\x"]""" to "invalid escape",
            "[\"a\nb\"]" to "control character",
            """{"a": tru}""" to "unexpected token",
            """[""" to "end of input",
        ).forEach { (text, message) ->
            test("rejects $text ($message)") {
                shouldThrow<IllegalArgumentException> { Json.parse(text) }.message shouldContain message
            }
        }

        test("render refuses a value it cannot write") {
            shouldThrow<IllegalArgumentException> { Json.render(listOf(1.5)) }
        }
    })
