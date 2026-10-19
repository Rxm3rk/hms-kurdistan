package hms.platform.docs.infrastructure.zpl

/**
 * ZPL field-data escaping (docs/specs/modules/platform-docs.md §7.1, HAZ-0046,
 * `PropertyTest:zpl-field-data-cannot-inject`).
 *
 * Every field this module writes is preceded by `^FH\`, which makes `\` the hexadecimal escape indicator
 * of that field: `\hh` is the byte 0xhh. The printer ends field data at the next `^` or `~` (the command
 * prefixes), so each of `^`, `~` and `\` is written as its escape (`\5E`, `\7E`, `\5C`) and no content can
 * end a field or start a command. Control characters (Unicode Cc, which includes CR, LF, DEL and the C1
 * controls), the line and paragraph separators (U+2028, U+2029) and unpaired surrogates are refused: a
 * printer may act on a control byte, and an unpaired surrogate has no UTF-8 form (Kotlin would silently
 * write `?`). The content rules refuse them earlier (spec §3.2 R7); this is the writer's own defence.
 *
 * The escaped text is UTF-8 field data for `^CI28`, in logical order.
 */
object ZplText {
    /** The escape indicator set by `^FH\`. */
    const val ESCAPE: Char = '\\'

    private const val LINE_SEPARATOR = 0x2028
    private const val PARAGRAPH_SEPARATOR = 0x2029

    /** Escapes [text] for a `^FH\^FD … ^FS` field, or rejects it. */
    fun fieldData(text: String): ZplFieldData {
        val out = StringBuilder(text.length + ESCAPE_HEADROOM)
        var i = 0
        while (i < text.length) {
            val codePoint = text.codePointAt(i)
            val problem = problemOf(codePoint)
            if (problem != null) return ZplFieldData.Rejected(i, problem)
            when (codePoint) {
                '^'.code -> out.append("\\5E")
                '~'.code -> out.append("\\7E")
                ESCAPE.code -> out.append("\\5C")
                else -> out.appendCodePoint(codePoint)
            }
            i += Character.charCount(codePoint)
        }
        return ZplFieldData.Escaped(out.toString())
    }

    /** Why [codePoint] cannot be field data, or null. `codePointAt` returns an unpaired surrogate as itself. */
    private fun problemOf(codePoint: Int): String? =
        when {
            Character.getType(codePoint) == Character.SURROGATE.toInt() -> "unpaired surrogate"
            Character.getType(codePoint) == Character.CONTROL.toInt() -> "control character (Cc)"
            codePoint == LINE_SEPARATOR || codePoint == PARAGRAPH_SEPARATOR -> "line separator (Zl/Zp)"
            else -> null
        }

    private const val ESCAPE_HEADROOM = 8
}

/** The result of [ZplText.fieldData]. */
sealed interface ZplFieldData {
    /** Field data safe to place between `^FD` and `^FS` under `^FH\`. */
    data class Escaped(
        val value: String,
    ) : ZplFieldData

    /** The character at [index] (a UTF-16 index) cannot be written; [category] names its kind, never the text. */
    data class Rejected(
        val index: Int,
        val category: String,
    ) : ZplFieldData
}
