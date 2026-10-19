package hms.platform.docs.infrastructure.zpl

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

/** `^FH\` field-data escaping (docs/specs/modules/platform-docs.md §7.1, HAZ-0046). */
class ZplTextTest :
    FunSpec({
        fun escaped(text: String) = ZplText.fieldData(text).shouldBeInstanceOf<ZplFieldData.Escaped>().value

        test("^, ~ and \\ become the hex escapes \\5E, \\7E and \\5C") {
            escaped("^") shouldBe "\\5E"
            escaped("~") shouldBe "\\7E"
            escaped("\\") shouldBe "\\5C"
            escaped("a^b~c\\d") shouldBe "a\\5Eb\\7Ec\\5Cd"
        }

        test("a command spelt in content cannot end the field: ^XZ and ~JA are escaped") {
            escaped("^FS^XZ~JA") shouldBe "\\5EFS\\5EXZ\\7EJA"
        }

        test("Sorani, Arabic, Latin and supplementary characters pass unchanged") {
            escaped("ئارام ڕێبوار") shouldBe "ئارام ڕێبوار"
            escaped("Çiya Şêx") shouldBe "Çiya Şêx"
            escaped("SYN-000123-7 | _ :") shouldBe "SYN-000123-7 | _ :"
            escaped("a😀b") shouldBe "a😀b"
            escaped("") shouldBe ""
        }

        test("control characters, separators and unpaired surrogates are rejected with their position, never written") {
            mapOf(
                "ab\ncd" to 2,
                "\r" to 0,
                "x\u0000" to 1,
                "x\u007F" to 1,
                "x\u0085" to 1,
                "ab " to 2,
                " " to 0,
                "a\uD800b" to 1,
                "ab\uDC00" to 2,
            ).forEach { (text, index) ->
                ZplText.fieldData(text).shouldBeInstanceOf<ZplFieldData.Rejected>().index shouldBe index
            }
        }
    })
