package hms.platform.docs.domain.rules

import java.text.Normalizer

/**
 * The character checks of print text (docs/specs/modules/platform-docs.md §3.2 R4, R7 and R8; BUILD-PROMPT
 * §2.1 SI-01, §12.8). Each check returns null when the text passes, or a short detail naming the Unicode
 * general category of the first offending code point. The detail never contains the text itself (spec §3.2:
 * "the refusal names the field and a code-point category, never the text").
 */
object TextChecks {
    /** ZERO WIDTH SPACE: a permitted format character and a line-break opportunity (spec §5.2). */
    const val ZWSP: Int = 0x200B

    /** ZERO WIDTH NON-JOINER: permitted, Sorani and Persian spelling needs it. */
    const val ZWNJ: Int = 0x200C

    /** ZERO WIDTH JOINER: permitted. */
    const val ZWJ: Int = 0x200D

    private const val REVERSE_SOLIDUS: Int = '\\'.code
    private const val ARABIC_INDIC_ZERO: Int = 0x0660
    private const val ARABIC_INDIC_NINE: Int = 0x0669
    private const val EXTENDED_ARABIC_INDIC_ZERO: Int = 0x06F0
    private const val EXTENDED_ARABIC_INDIC_NINE: Int = 0x06F9

    private val permittedFormatCharacters: Set<Int> = setOf(ZWSP, ZWNJ, ZWJ)

    /**
     * Categories R7 refuses outright. Cc and Cf are the spec's list (Cf other than ZWNJ, ZWJ and ZWSP, so no
     * bidi embedding, override, isolate or mark can reorder a printed name); Cs is an unpaired surrogate.
     * Co (private use) and Cn (unassigned) have no glyph in the print fonts, and Zl and Zp would break a line
     * where the fit rule did not (spec §5.2): refusing them here is part of R7's "every character has a glyph".
     */
    private val refusedCategories: Set<Int> =
        setOf(
            Character.CONTROL.toInt(),
            Character.SURROGATE.toInt(),
            Character.PRIVATE_USE.toInt(),
            Character.UNASSIGNED.toInt(),
            Character.LINE_SEPARATOR.toInt(),
            Character.PARAGRAPH_SEPARATOR.toInt(),
        )

    private val categoryCodes: Map<Int, String> =
        mapOf(
            Character.UNASSIGNED to "Cn",
            Character.UPPERCASE_LETTER to "Lu",
            Character.LOWERCASE_LETTER to "Ll",
            Character.TITLECASE_LETTER to "Lt",
            Character.MODIFIER_LETTER to "Lm",
            Character.OTHER_LETTER to "Lo",
            Character.NON_SPACING_MARK to "Mn",
            Character.ENCLOSING_MARK to "Me",
            Character.COMBINING_SPACING_MARK to "Mc",
            Character.DECIMAL_DIGIT_NUMBER to "Nd",
            Character.LETTER_NUMBER to "Nl",
            Character.OTHER_NUMBER to "No",
            Character.SPACE_SEPARATOR to "Zs",
            Character.LINE_SEPARATOR to "Zl",
            Character.PARAGRAPH_SEPARATOR to "Zp",
            Character.CONTROL to "Cc",
            Character.FORMAT to "Cf",
            Character.PRIVATE_USE to "Co",
            Character.SURROGATE to "Cs",
            Character.DASH_PUNCTUATION to "Pd",
            Character.START_PUNCTUATION to "Ps",
            Character.END_PUNCTUATION to "Pe",
            Character.CONNECTOR_PUNCTUATION to "Pc",
            Character.OTHER_PUNCTUATION to "Po",
            Character.MATH_SYMBOL to "Sm",
            Character.CURRENCY_SYMBOL to "Sc",
            Character.MODIFIER_SYMBOL to "Sk",
            Character.INITIAL_QUOTE_PUNCTUATION to "Pi",
            Character.FINAL_QUOTE_PUNCTUATION to "Pf",
        ).mapKeys { (type, _) -> type.toInt() }

    /** The two-letter Unicode general category of [codePoint] (for example `Cf`). */
    fun category(codePoint: Int): String = categoryCodes[Character.getType(codePoint)] ?: "Cn"

    /**
     * R7, the character part (the glyph part is the shaper's, spec §5.1): refuses control characters (Cc),
     * format characters (Cf) other than ZWNJ, ZWJ and ZWSP, unpaired surrogates, private-use, unassigned,
     * line- and paragraph-separator code points, the reverse solidus `\` (ZPL `^FB` reads `\&` as a line
     * break; refused in every text, not only ZPL field blocks), and text that is not in Unicode NFC.
     */
    fun unrenderable(text: String): String? =
        text
            .codePoints()
            .toArray()
            .asSequence()
            .firstNotNullOfOrNull(::codePointViolation)
            ?: if (Normalizer.isNormalized(text, Normalizer.Form.NFC)) null else "not in Unicode NFC"

    /** R8: Arabic-Indic (U+0660–0669) or Extended Arabic-Indic (U+06F0–06F9) digits are refused, never converted. */
    fun easternDigit(text: String): String? =
        text.codePoints().toArray().asSequence().firstNotNullOfOrNull { codePoint ->
            when (codePoint) {
                in ARABIC_INDIC_ZERO..ARABIC_INDIC_NINE -> "category=Nd (Arabic-Indic digit)"
                in EXTENDED_ARABIC_INDIC_ZERO..EXTENDED_ARABIC_INDIC_NINE -> "category=Nd (Extended Arabic-Indic digit)"
                else -> null
            }
        }

    /**
     * R4: an identifier is non-empty and uses only `A-Z a-z 0-9 -`, so it can carry no barcode payload
     * separator (`|`), no ZPL command or escape character (`^ ~ \`) and no space.
     */
    fun outsideIdentifierAlphabet(text: String): String? =
        if (text.isEmpty()) {
            "empty"
        } else {
            text.codePoints().toArray().firstOrNull { !isIdentifierCharacter(it) }?.let { codePoint ->
                "category=${category(codePoint)} outside [A-Za-z0-9-]"
            }
        }

    /** True for the characters of R4's identifier alphabet. */
    fun isIdentifierCharacter(codePoint: Int): Boolean =
        codePoint in 'A'.code..'Z'.code ||
            codePoint in 'a'.code..'z'.code ||
            codePoint in '0'.code..'9'.code ||
            codePoint == '-'.code

    private fun codePointViolation(codePoint: Int): String? {
        val type = Character.getType(codePoint)
        return when {
            codePoint == REVERSE_SOLIDUS -> "category=Po (reverse solidus)"
            type == Character.FORMAT.toInt() && codePoint !in permittedFormatCharacters -> "category=Cf"
            type == Character.SURROGATE.toInt() -> "category=Cs (unpaired surrogate)"
            type in refusedCategories -> "category=${category(codePoint)}"
            else -> null
        }
    }
}
