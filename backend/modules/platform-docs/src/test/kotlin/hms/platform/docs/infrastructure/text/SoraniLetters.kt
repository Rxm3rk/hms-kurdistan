package hms.platform.docs.infrastructure.text

/**
 * The Sorani letters the font-coverage test checks (docs/specs/modules/platform-docs.md §9; BUILD-PROMPT
 * §4.1 "Fonts", §11.1). After WP-0.7 is merged this list is checked against
 * `frontend/packages/i18n/src/sorani-letters.json` (spec §9 point 4, OQ-148); until then it is kept here.
 */
object SoraniLetters {
    /** A Sorani letter, its code point and how it joins (Unicode ArabicShaping.txt). */
    data class Letter(
        val char: Char,
        val name: String,
        val dualJoining: Boolean,
    ) {
        val codePoint: Int get() = char.code
    }

    /** پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە (BUILD-PROMPT §4.1, §11.1). */
    val ALL: List<Letter> =
        listOf(
            Letter('پ', "PEH", dualJoining = true),
            Letter('چ', "TCHEH", dualJoining = true),
            Letter('ژ', "JEH", dualJoining = false),
            Letter('گ', "GAF", dualJoining = true),
            Letter('ڤ', "VEH", dualJoining = true),
            Letter('ڕ', "REH WITH SMALL V BELOW", dualJoining = false),
            Letter('ڵ', "LAM WITH SMALL V", dualJoining = true),
            Letter('ۆ', "OE", dualJoining = false),
            Letter('ێ', "YEH WITH SMALL V", dualJoining = true),
            Letter('ە', "AE", dualJoining = false),
        )

    val DUAL_JOINING: List<Letter> = ALL.filter { it.dualJoining }
    val RIGHT_JOINING: List<Letter> = ALL.filterNot { it.dualJoining }

    /** Sorani letters and the Arabic letters they must never print like (spec §9 point 3): ڕ/ر, ڵ/ل, ێ/ی. */
    val LOOKALIKES: List<Pair<Char, Char>> = listOf('ڕ' to 'ر', 'ڵ' to 'ل', 'ێ' to 'ی')

    /** The joining partner of the tests: BEH, dual-joining. */
    const val PARTNER: Char = 'ب'
}
