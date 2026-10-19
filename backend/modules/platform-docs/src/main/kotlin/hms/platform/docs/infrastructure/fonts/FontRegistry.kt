package hms.platform.docs.infrastructure.fonts

import hms.platform.docs.domain.layout.FontSpec
import tools.jackson.core.JacksonException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.awt.Font
import java.awt.FontFormatException
import java.io.ByteArrayInputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.HexFormat

/**
 * The four print fonts, loaded once from the classpath and verified against their pins
 * (docs/specs/modules/platform-docs.md §9; BUILD-PROMPT §4.1 "Fonts", §11.1).
 *
 * At load the registry reads `fonts.json`, requires exactly one pin per [PrintFont] (licence `OFL-1.1`),
 * hashes each file with SHA-256 and compares it with the pin, checks the font's version string (name ID 5)
 * against the pinned version, then creates the `java.awt.Font` and parses the `head`, `hhea`, `cmap` and
 * `name` tables from the same bytes ([TrueTypeTables]).
 *
 * **Failure is thrown, not returned.** A missing, altered or unparseable font file is an infrastructure
 * misconfiguration (the fonts are pinned build inputs, not content), so [load] throws a
 * [FontIntegrityException] and nothing that needs the registry can start: no print is shaped, measured
 * or rasterised with a font other than the pinned one. The satellite applies the same check to the same
 * directory (spec §7.5). Business refusals stay values (spec §3.2).
 */
class FontRegistry private constructor(
    private val fonts: Map<PrintFont, LoadedFont>,
) {
    /** The loaded font for [font]. */
    fun font(font: PrintFont): LoadedFont = fonts.getValue(font)

    /** The loaded font a role and weight resolve to (spec §9). */
    fun font(spec: FontSpec): LoadedFont = font(PrintFont.of(spec))

    /** Every loaded font, in [PrintFont] order. */
    val all: List<LoadedFont> get() = PrintFont.entries.map { fonts.getValue(it) }

    companion object {
        private const val PINS_FILE = "fonts.json"
        private const val LICENCE = "OFL-1.1"
        private val VERSION_STRING = Regex("""^Version (\d+\.\d+)(;.*)?$""")

        private val classpath: FontRegistry by lazy { load(::readClasspathResource) }

        /** The registry over the fonts on the classpath, loaded and verified once per JVM. */
        fun fromClasspath(): FontRegistry = classpath

        /**
         * Loads and verifies the fonts, reading each file of the font directory (`fonts.json`, the four
         * `.ttf` files) through [read], which returns null for a missing file. Tests pass a reader that
         * alters a file to prove the refusal.
         *
         * @throws FontIntegrityException when a file is missing, unpinned, altered or unparseable
         */
        fun load(read: (fileName: String) -> ByteArray?): FontRegistry {
            val pins = readPins(read(PINS_FILE) ?: fail("$PINS_FILE is missing"))
            val fonts = PrintFont.entries.associateWith { loadOne(it, pins, read) }
            return FontRegistry(fonts)
        }

        private fun loadOne(
            font: PrintFont,
            pins: Map<String, FontPin>,
            read: (String) -> ByteArray?,
        ): LoadedFont {
            val pin = pins[font.fileName] ?: fail("${font.fileName} has no pin in $PINS_FILE")
            val bytes = read(font.fileName) ?: fail("${font.fileName} is missing")
            val sha256 = sha256Hex(bytes)
            integrity(sha256 == pin.sha256) { "${font.fileName}: SHA-256 $sha256 does not match the pinned ${pin.sha256}" }
            val tables = TrueTypeTables.parse(bytes)
            val version = VERSION_STRING.find(tables.versionString)?.groupValues?.get(1)
            integrity(version == pin.version) {
                "${font.fileName}: version '${tables.versionString}' does not match the pinned ${pin.version}"
            }
            val awtFont =
                try {
                    Font.createFont(Font.TRUETYPE_FONT, ByteArrayInputStream(bytes))
                } catch (e: FontFormatException) {
                    fail("${font.fileName}: Java2D cannot read the font", e)
                } catch (e: IOException) {
                    fail("${font.fileName}: Java2D cannot read the font", e)
                }
            return LoadedFont(font, awtFont, bytes, sha256, pin.version, tables)
        }

        private fun readPins(json: ByteArray): Map<String, FontPin> {
            val root =
                try {
                    JsonMapper.shared().readTree(json)
                } catch (e: JacksonException) {
                    fail("$PINS_FILE is not valid JSON", e)
                }
            integrity(root.isArray) { "$PINS_FILE is not an array" }
            val pins = (0 until root.size()).map { toPin(root.get(it)) }
            val byFile = pins.associateBy { it.file }
            integrity(byFile.size == pins.size) { "$PINS_FILE pins a file twice" }
            val expected = PrintFont.entries.map { it.fileName }.toSet()
            integrity(byFile.keys == expected) { "$PINS_FILE pins ${byFile.keys}, expected $expected" }
            return byFile
        }

        private fun toPin(node: JsonNode): FontPin {
            fun field(name: String): String =
                node.get(name)?.takeIf { it.isString }?.stringValue() ?: fail("$PINS_FILE: an entry has no '$name'")
            val pin = FontPin(file = field("file"), sha256 = field("sha256"), version = field("version"), licence = field("licence"))
            integrity(pin.licence == LICENCE) { "$PINS_FILE: ${pin.file} has licence '${pin.licence}', expected $LICENCE" }
            return pin
        }

        private fun readClasspathResource(fileName: String): ByteArray? =
            FontRegistry::class.java.getResourceAsStream(PrintFont.RESOURCE_DIR + fileName)?.use { it.readAllBytes() }

        private fun fail(
            message: String,
            cause: Throwable? = null,
        ): Nothing = throw FontIntegrityException(message, cause)

        private inline fun integrity(
            condition: Boolean,
            message: () -> String,
        ) {
            if (!condition) fail(message())
        }

        /** Lower-case hexadecimal SHA-256 of [bytes]. */
        fun sha256Hex(bytes: ByteArray): String = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))
    }

    private data class FontPin(
        val file: String,
        val sha256: String,
        val version: String,
        val licence: String,
    )
}

/**
 * One verified print font: the Java2D font (at size 1; derive the size you need), the exact file bytes,
 * its SHA-256 and pinned version, its `hhea` metrics and its character map (spec §5.3, §9).
 */
class LoadedFont internal constructor(
    val printFont: PrintFont,
    /** The font as Java2D created it from [bytes]; immutable and safe to share between threads. */
    val awtFont: Font,
    private val bytes: ByteArray,
    /** Lower-case hexadecimal SHA-256 of the file, equal to its pin in `fonts.json`. */
    val sha256: String,
    /** The pinned font version, equal to the version in name ID 5 (for example "2.013"). */
    val version: String,
    tables: TrueTypeTables,
) {
    /** `hhea` ascender, descender and line gap with `head.unitsPerEm`, read from the file. */
    val hhea: HheaMetrics = tables.hhea

    private val cmap: Map<Int, Int> = tables.cmap

    /** A copy of the TrueType file. */
    fun bytes(): ByteArray = bytes.copyOf()

    /** True when the font's character map maps [codePoint] to a glyph other than glyph 0. */
    fun covers(codePoint: Int): Boolean = cmap.containsKey(codePoint)

    /** The glyph id the character map gives [codePoint], or 0 (the missing glyph) when it has none. */
    fun cmapGlyph(codePoint: Int): Int = cmap[codePoint] ?: 0

    /** The code points of [text] that the character map does not cover, in order of first appearance. */
    fun uncovered(text: String): List<Int> =
        text
            .codePoints()
            .filter { !covers(it) }
            .distinct()
            .toArray()
            .toList()

    override fun toString(): String = "LoadedFont(${printFont.fileName}, $version, $sha256)"
}
