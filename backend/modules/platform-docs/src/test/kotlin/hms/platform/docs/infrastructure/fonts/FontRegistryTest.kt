package hms.platform.docs.infrastructure.fonts

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

/**
 * The font registry (docs/specs/modules/platform-docs.md §5.3, §9): pinned files, verified hashes and
 * versions, and the `hhea`, `head` and `cmap` values read from the bytes. The expected values were read
 * independently with fontTools 4 from the same files (`hhea.ascent`, `hhea.descent`, `hhea.lineGap`,
 * `head.unitsPerEm`, `len(getBestCmap())`).
 */
class FontRegistryTest :
    FunSpec({
        val registry = FontRegistry.fromClasspath()

        fun resource(name: String): ByteArray? =
            FontRegistry::class.java.getResourceAsStream(PrintFont.RESOURCE_DIR + name)?.use { it.readAllBytes() }

        /** The classpath files, with [name] replaced by [change] of its bytes (null: the file is missing). */
        fun altered(
            name: String,
            change: (ByteArray) -> ByteArray?,
        ): (String) -> ByteArray? = { file -> resource(file)?.let { if (file == name) change(it) else it } }

        fun ByteArray.replaceText(
            old: String,
            new: String,
        ): ByteArray = decodeToString().replaceFirst(old, new).encodeToByteArray()

        test("every print font loads with the pinned SHA-256 and version") {
            val expected =
                mapOf(
                    PrintFont.ARABIC_REGULAR to ("bdff3e5659d67e67def05b33f749683b9376ae819d65d3dd62ac4640b3aaef48" to "2.013"),
                    PrintFont.ARABIC_BOLD to ("4e5462d2e8be880317b9f49b5b2da109ddb6a3563d91cc604b67f3535832a555" to "2.013"),
                    PrintFont.LATIN_REGULAR to ("478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823" to "2.015"),
                    PrintFont.LATIN_BOLD to ("1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913" to "2.015"),
                )
            expected.forEach { (pf, pin) ->
                val font = registry.font(pf)
                font.sha256 shouldBe pin.first
                FontRegistry.sha256Hex(font.bytes()) shouldBe pin.first
                font.version shouldBe pin.second
                registry.font(pf.spec) shouldBe font
            }
        }

        test("hhea and head metrics are read from the font bytes") {
            PrintFont.entries.forEach { pf ->
                val expected =
                    if (pf.role.yamlName == "arabic") HheaMetrics(1000, 1374, -738, 0) else HheaMetrics(1000, 1069, -293, 0)
                registry.font(pf).hhea shouldBe expected
            }
            registry.font(PrintFont.ARABIC_REGULAR).hhea.ascentPt(10.0) shouldBe 13.74
            registry.font(PrintFont.ARABIC_REGULAR).hhea.descentPt(10.0) shouldBe 7.38
        }

        test("the parsed character maps have the size fontTools reports and agree with Java2D on the BMP") {
            val sizes = mapOf(PrintFont.ARABIC_REGULAR to 1250, PrintFont.LATIN_REGULAR to 2965)
            sizes.forEach { (pf, size) ->
                val font = registry.font(pf)
                (0..0x10FFFF).count(font::covers) shouldBe size
            }
            PrintFont.entries.forEach { pf ->
                val font = registry.font(pf)
                val bmp = (0x20..0xFFFD).filter { !Character.isSurrogate(it.toChar()) }
                // Every character our cmap covers, Java2D can display from the same file.
                bmp.filter { font.covers(it) && !font.awtFont.canDisplay(it) } shouldBe emptyList()
                // Java2D's canDisplay is also true for characters it maps to an invisible glyph, so the
                // converse is checked only where Java2D answers false: then our cmap must not cover it.
                bmp.filter { !font.awtFont.canDisplay(it) }.filter(font::covers) shouldBe emptyList()
            }
        }

        test("cmapGlyph and uncovered") {
            val arabic = registry.font(PrintFont.ARABIC_REGULAR)
            arabic.cmapGlyph(0x0644) shouldBe 68
            arabic.cmapGlyph(0x0041) shouldBe 0
            arabic.uncovered("SYN-1 ب") shouldBe listOf('S'.code, 'Y'.code, 'N'.code)
        }

        test("a font file whose hash differs from its pin is refused at load") {
            val e =
                shouldThrow<FontIntegrityException> {
                    FontRegistry.load(
                        altered(PrintFont.LATIN_BOLD.fileName) { bytes ->
                            bytes.copyOf().also { it[it.size - 1] = (it[it.size - 1] + 1).toByte() }
                        },
                    )
                }
            e.message shouldContain "NotoSans-Bold.ttf"
            e.message shouldContain "does not match"
        }

        test("a missing font file, a missing fonts.json and a wrong licence are refused at load") {
            shouldThrow<FontIntegrityException> {
                FontRegistry.load(altered(PrintFont.ARABIC_REGULAR.fileName) { null })
            }.message shouldContain "NotoSansArabic-Regular.ttf is missing"
            shouldThrow<FontIntegrityException> {
                FontRegistry.load(altered("fonts.json") { null })
            }.message shouldContain "fonts.json is missing"
            shouldThrow<FontIntegrityException> {
                FontRegistry.load(altered("fonts.json") { it.replaceText("OFL-1.1", "proprietary") })
            }.message shouldContain "licence"
            shouldThrow<FontIntegrityException> {
                FontRegistry.load(altered("fonts.json") { it.replaceText("\"NotoSans-Bold.ttf\"", "\"NotoSans-Black.ttf\"") })
            }.message shouldContain "expected"
        }

        test("a pinned version that differs from the font's name ID 5 is refused at load") {
            shouldThrow<FontIntegrityException> {
                FontRegistry.load(altered("fonts.json") { it.replaceText("\"2.013\"", "\"2.014\"") })
            }.message shouldContain "version"
        }

        test("a truncated font is refused by the parser") {
            val bytes = resource(PrintFont.ARABIC_REGULAR.fileName)!!
            shouldThrow<FontIntegrityException> { TrueTypeTables.parse(bytes.copyOf(2000)) }
            shouldThrow<FontIntegrityException> { TrueTypeTables.parse(bytes.copyOf(8)) }
            // Not a TrueType file at all (an OpenType/CFF or woff2 signature is refused the same way).
            shouldThrow<FontIntegrityException> { TrueTypeTables.parse("wOF2".encodeToByteArray() + ByteArray(64)) }
        }

        test("the classpath registry is loaded once") {
            (FontRegistry.fromClasspath() === registry) shouldBe true
        }

        test("OFL.txt is the SIL Open Font License 1.1") {
            val text = resource("OFL.txt")!!.decodeToString()
            text shouldContain "SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007"
            text shouldContain "Copyright 2022 The Noto Project Authors"
        }
    })
