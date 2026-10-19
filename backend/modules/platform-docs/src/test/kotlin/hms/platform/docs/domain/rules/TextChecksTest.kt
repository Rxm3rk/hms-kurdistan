package hms.platform.docs.domain.rules

import hms.platform.docs.domain.testing.cp
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

class TextChecksTest :
    FunSpec({
        test("plain Sorani, Arabic and Latin text with Western digits passes R7 and R8") {
            listOf("شیلان ئەحمەد", "كريم محمد", "Shilan Ahmad", "SYN-0001", "~1985-07", "25,000 IQD", "ڕ ڵ ێ ۆ ە پ چ ژ گ ڤ").forEach {
                TextChecks.unrenderable(it).shouldBeNull()
                TextChecks.easternDigit(it).shouldBeNull()
            }
        }

        test("the empty string is renderable (blankness is the content rules' concern)") {
            TextChecks.unrenderable("").shouldBeNull()
        }

        test("every bidi control is refused as Cf") {
            ((0x202A..0x202E) + (0x2066..0x2069) + listOf(0x200E, 0x200F, 0x061C)).forEach {
                TextChecks.unrenderable("a${cp(it)}b") shouldBe "category=Cf"
            }
        }

        test("ZWSP, ZWNJ and ZWJ are allowed format characters") {
            listOf(TextChecks.ZWSP, TextChecks.ZWNJ, TextChecks.ZWJ).forEach { TextChecks.unrenderable("a${cp(it)}b").shouldBeNull() }
        }

        test("a lone low surrogate is refused") {
            TextChecks.unrenderable("a" + Char(0xDC00)) shouldBe "category=Cs (unpaired surrogate)"
        }

        test("a supplementary-plane character with a glyph-bearing category passes the character check") {
            TextChecks.unrenderable("a" + cp(0x1D400)).shouldBeNull()
        }

        test("an unassigned code point is refused") {
            TextChecks.unrenderable("a" + cp(0x0378)) shouldBe "category=Cn"
        }

        test("Eastern digit ranges are exact") {
            TextChecks.easternDigit(cp(0x065F)).shouldBeNull()
            TextChecks.easternDigit(cp(0x066A)).shouldBeNull()
            TextChecks.easternDigit(cp(0x06EF)).shouldBeNull()
            TextChecks.easternDigit(cp(0x06FA)).shouldBeNull()
            TextChecks.easternDigit(cp(0x0660)) shouldBe "category=Nd (Arabic-Indic digit)"
            TextChecks.easternDigit(cp(0x06F9)) shouldBe "category=Nd (Extended Arabic-Indic digit)"
        }

        test("identifier alphabet") {
            TextChecks.outsideIdentifierAlphabet("Az09-").shouldBeNull()
            TextChecks.outsideIdentifierAlphabet("") shouldBe "empty"
            TextChecks.outsideIdentifierAlphabet("A" + cp(0x0661)) shouldBe "category=Nd outside [A-Za-z0-9-]"
            TextChecks.outsideIdentifierAlphabet("A\\") shouldBe "category=Po outside [A-Za-z0-9-]"
        }
    })
