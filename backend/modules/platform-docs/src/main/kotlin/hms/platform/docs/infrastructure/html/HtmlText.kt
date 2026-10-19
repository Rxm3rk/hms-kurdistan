package hms.platform.docs.infrastructure.html

import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.infrastructure.fonts.PrintFont
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * The pieces both HTML writers share (docs/specs/modules/platform-docs.md §7.4): text escaping, number
 * formatting, the document metadata and the `@font-face` rules. Everything here is deterministic: no
 * clock, no locale, no hash-ordered collection.
 */
internal object HtmlText {
    private const val MM_DECIMALS = 3
    private const val POINTS_PER_MM = 72.0 / 25.4
    private const val LINE_SEPARATOR = 0x2028
    private const val PARAGRAPH_SEPARATOR = 0x2029

    /**
     * Escapes [text] for element content or a double-quoted attribute: `&`, `<`, `>`, `"` and `'`. Returns
     * null for text that HTML cannot carry as print text: a control character (Cc), a line or paragraph
     * separator, or an unpaired surrogate (the content rules refuse these first, spec §3.2 R7).
     */
    fun escape(text: String): String? {
        val out = StringBuilder(text.length)
        var i = 0
        while (i < text.length) {
            val codePoint = text.codePointAt(i)
            val type = Character.getType(codePoint)
            val unwritable =
                type == Character.CONTROL.toInt() ||
                    type == Character.SURROGATE.toInt() ||
                    codePoint == LINE_SEPARATOR ||
                    codePoint == PARAGRAPH_SEPARATOR
            if (unwritable) return null
            when (codePoint) {
                '&'.code -> out.append("&amp;")
                '<'.code -> out.append("&lt;")
                '>'.code -> out.append("&gt;")
                '"'.code -> out.append("&quot;")
                '\''.code -> out.append("&#39;")
                else -> out.appendCodePoint(codePoint)
            }
            i += Character.charCount(codePoint)
        }
        return out.toString()
    }

    /** A length in millimetres: at most three decimals, half up, no trailing zeros, no exponent (`12.5`, `0.125`, `3`). */
    fun mm(value: Double): String = decimal(value)

    /** Millimetres as points, in the same form. */
    fun pt(valueMm: Double): String = decimal(valueMm * POINTS_PER_MM)

    /** A number in the same form. */
    fun decimal(value: Double): String {
        val text =
            BigDecimal
                .valueOf(value)
                .setScale(MM_DECIMALS, RoundingMode.HALF_UP)
                .stripTrailingZeros()
                .toPlainString()
        return if (text == "-0") "0" else text
    }

    /** The `@font-face` rules: one family per print font, named by its `hms-font:` name (resolved offline by the satellite). */
    fun fontFaces(): String =
        PrintFont.entries.joinToString(separator = "") { font ->
            "@font-face { font-family: \"${font.hmsFontName}\"; src: url(hms-font:${font.hmsFontName}); }\n"
        }

    /**
     * The `<title>` and `<meta>` elements every print carries: creation and modification time (from the
     * request, never the clock), the template id, version and content hash, the provenance and, for
     * synthetic content, the notice. Null when a value holds text HTML cannot carry.
     */
    fun head(meta: HtmlMetadata): String? {
        val entries =
            buildList {
                add("dcterms.created" to meta.createdAt)
                add("dcterms.modified" to meta.createdAt)
                add("generator" to "hms platform-docs")
                add("hms.template.id" to meta.templateId)
                add("hms.template.version" to meta.templateVersion.toString())
                add("hms.template.hash" to meta.templateHash)
                add("hms.provenance" to if (meta.synthetic) "synthetic" else "approved")
                if (meta.synthetic) add("hms.notice" to SYNTHETIC_NOTICE)
            }
        val title = escape(meta.title)
        val values = entries.map { (name, content) -> name to escape(content) }
        return if (title == null || values.any { it.second == null }) {
            null
        } else {
            buildString {
                append("<title>").append(title).append("</title>\n")
                for ((name, value) in values) append("<meta name=\"").append(name).append("\" content=\"").append(value).append("\">\n")
            }
        }
    }

    /** The synthetic-content notice (§19.4); printed visibly by the layout's `notice.synthetic` element too. */
    const val SYNTHETIC_NOTICE: String = "SYNTHETIC – NOT FOR CLINICAL USE"

    /** A refusal for text the HTML cannot carry. */
    fun unwritable(subject: String): Refusal =
        Refusal(RefusalReason.UNRENDERABLE_TEXT, subject = subject, detail = "control, separator or unpaired surrogate in HTML text")
}

/**
 * The document metadata of an HTML print. [createdAt] is the fixed creation time of the request (ISO 8601
 * with offset), injected so the same input gives the same bytes (spec §7.5 determinism).
 */
data class HtmlMetadata(
    val templateId: String,
    val templateVersion: Int,
    val templateHash: String,
    val synthetic: Boolean,
    val language: LabelLanguage,
    val title: String,
    val createdAt: String,
)
