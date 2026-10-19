package hms.kernel.quantity

/**
 * A UCUM unit code that passed the syntactic check (platform-kernel.md §10.2; SI-05). WP-0.3 validates syntax only:
 * unknown atoms pass, and semantic validation is the [UnitCatalogue]'s (KA-KN1). Equality is exact,
 * case-sensitive code equality, so two codes UCUM might treat as equivalent are different units.
 * `init` re-checks the code, so a reflective construction with an invalid code throws.
 */
class UcumUnit private constructor(
    val code: String,
) {
    /**
     * True when the code contains at least one unit atom, rather than only the unity `1`, numbers, factors
     * such as `10*3`, or annotations (platform-kernel.md §10.2).
     */
    val hasUnitAtom: Boolean

    init {
        val outcome = UcumSyntax.check(code)
        require(outcome is UcumSyntax.Outcome.Valid) { "UcumUnit code is not valid UCUM syntax: $outcome" }
        hasUnitAtom = outcome.hasUnitAtom
    }

    override fun equals(other: Any?): Boolean = other is UcumUnit && code == other.code

    override fun hashCode(): Int = code.hashCode()

    override fun toString(): String = code

    companion object {
        /** The longest code accepted (platform-kernel.md §10.2). */
        const val MAX_LENGTH: Int = 256

        /** Checks [code] against the UCUM case-sensitive grammar; never trims or rewrites it. */
        @JvmStatic
        fun parse(code: String): UcumParseResult =
            when (val outcome = UcumSyntax.check(code)) {
                is UcumSyntax.Outcome.Valid -> UcumParseResult.Valid(UcumUnit(code))
                is UcumSyntax.Outcome.Invalid -> UcumParseResult.Invalid(outcome.error, outcome.position)
            }
    }
}

/** The result of [UcumUnit.parse]; [Invalid.position] is the zero-based index in the code where the error was found. */
sealed interface UcumParseResult {
    data class Valid(
        val unit: UcumUnit,
    ) : UcumParseResult

    data class Invalid(
        val error: UcumSyntaxError,
        val position: Int,
    ) : UcumParseResult
}

/** Why a code is not UCUM syntax (platform-kernel.md §10.2). */
enum class UcumSyntaxError {
    EMPTY,
    ILLEGAL_CHARACTER,
    UNBALANCED_PARENTHESIS,
    UNBALANCED_ANNOTATION,
    MISSING_TERM,
    BAD_EXPONENT,
    DANGLING_OPERATOR,
    TOO_LONG,
}

/**
 * The UCUM case-sensitive grammar, syntax only (platform-kernel.md §10.2):
 *
 * ```
 * main-term   := "/" term | term
 * term        := component (("." | "/") component)*
 * component   := annotatable annotation? | factor annotation? | annotation | "(" term ")"
 * annotatable := simple-unit exponent?
 * exponent    := ("+" | "-")? digit+
 * factor      := digit+
 * annotation  := "{" (printable ASCII except "{" and "}")* "}"
 * ```
 *
 * A simple unit is a prefixed or plain atom; without the atom table the two cannot be told apart, so any run of
 * printable ASCII that is not an operator, parenthesis, brace or sign is accepted as one. Square brackets belong to
 * the atom and may enclose any printable ASCII except brackets. Digits that end a run (outside brackets) are its
 * exponent. The `10*` and `10^` stems (the `10*n` style factors) are numbers, not unit atoms. Every character must be
 * printable ASCII (33 to 126), so a space is illegal everywhere, inside annotations too.
 */
internal object UcumSyntax {
    private const val FIRST_PRINTABLE = '!'
    private const val LAST_PRINTABLE = '~'
    private val NUMBER_STEMS = setOf("10*", "10^")

    sealed interface Outcome {
        data class Valid(
            val hasUnitAtom: Boolean,
        ) : Outcome

        data class Invalid(
            val error: UcumSyntaxError,
            val position: Int,
        ) : Outcome
    }

    fun check(code: String): Outcome {
        val illegal = code.indexOfFirst { it !in FIRST_PRINTABLE..LAST_PRINTABLE }
        return when {
            code.isEmpty() -> Outcome.Invalid(UcumSyntaxError.EMPTY, 0)
            code.length > UcumUnit.MAX_LENGTH -> Outcome.Invalid(UcumSyntaxError.TOO_LONG, UcumUnit.MAX_LENGTH)
            illegal >= 0 -> Outcome.Invalid(UcumSyntaxError.ILLEGAL_CHARACTER, illegal)
            else ->
                try {
                    Outcome.Valid(Parser(code).parseMainTerm())
                } catch (failure: SyntaxFailure) {
                    Outcome.Invalid(failure.error, failure.position)
                }
        }
    }

    fun isNumberStem(stem: String): Boolean = stem in NUMBER_STEMS

    private class SyntaxFailure(
        val error: UcumSyntaxError,
        val position: Int,
    ) : RuntimeException("$error at $position")

    private fun fail(
        error: UcumSyntaxError,
        position: Int,
    ): Nothing = throw SyntaxFailure(error, position)

    private fun isOperator(char: Char?): Boolean = char == '.' || char == '/'

    private fun isSign(char: Char?): Boolean = char == '+' || char == '-'

    /** Characters that end a simple unit or factor run. */
    private fun endsRun(char: Char): Boolean = isOperator(char) || isSign(char) || char in "(){}"

    /** A recursive-descent parser over one code; [hasUnitAtom] is set as atoms are found. */
    private class Parser(
        private val code: String,
    ) {
        private var pos = 0
        private var hasUnitAtom = false

        private fun peek(): Char? = code.getOrNull(pos)

        fun parseMainTerm(): Boolean {
            val leadingSolidus = if (peek() == '/') 0.also { pos++ } else null
            parseTerm(precedingOperator = leadingSolidus, openParenthesis = null)
            // A top-level term stops only at the end or at a ')' that has no '('.
            if (pos < code.length) fail(UcumSyntaxError.UNBALANCED_PARENTHESIS, pos)
            return hasUnitAtom
        }

        private fun parseTerm(
            precedingOperator: Int?,
            openParenthesis: Int?,
        ) {
            parseComponent(precedingOperator, openParenthesis)
            while (isOperator(peek())) {
                val operator = pos
                pos++
                parseComponent(operator, openParenthesis)
            }
        }

        private fun parseComponent(
            precedingOperator: Int?,
            openParenthesis: Int?,
        ) {
            val char = peek() ?: missingComponent(null, precedingOperator, openParenthesis)
            when {
                isOperator(char) || char == ')' -> missingComponent(char, precedingOperator, openParenthesis)
                char == '(' -> parseParenthesised()
                char == '{' -> parseAnnotation()
                char == '}' -> fail(UcumSyntaxError.UNBALANCED_ANNOTATION, pos)
                isSign(char) -> fail(UcumSyntaxError.BAD_EXPONENT, pos)
                else -> parseRun()
            }
            checkComponentEnd()
        }

        private fun missingComponent(
            char: Char?,
            precedingOperator: Int?,
            openParenthesis: Int?,
        ): Nothing =
            when {
                precedingOperator != null -> fail(UcumSyntaxError.DANGLING_OPERATOR, precedingOperator)
                isOperator(char) -> fail(UcumSyntaxError.DANGLING_OPERATOR, pos)
                char == ')' && openParenthesis != null -> fail(UcumSyntaxError.MISSING_TERM, pos)
                else -> fail(UcumSyntaxError.UNBALANCED_PARENTHESIS, openParenthesis ?: pos)
            }

        /** After a component only an operator, a ')' or the end may follow. */
        private fun checkComponentEnd() {
            val char = peek() ?: return
            when {
                isOperator(char) || char == ')' -> Unit
                char == '}' -> fail(UcumSyntaxError.UNBALANCED_ANNOTATION, pos)
                char.isAsciiDigit() || isSign(char) -> fail(UcumSyntaxError.BAD_EXPONENT, pos)
                else -> fail(UcumSyntaxError.ILLEGAL_CHARACTER, pos)
            }
        }

        private fun parseParenthesised() {
            val open = pos
            pos++
            parseTerm(precedingOperator = null, openParenthesis = open)
            if (peek() != ')') fail(UcumSyntaxError.UNBALANCED_PARENTHESIS, open)
            pos++
        }

        private fun parseAnnotation() {
            val open = pos
            pos++
            while (peek() != '}') {
                when (peek()) {
                    null -> fail(UcumSyntaxError.UNBALANCED_ANNOTATION, open)
                    '{' -> fail(UcumSyntaxError.UNBALANCED_ANNOTATION, pos)
                    else -> pos++
                }
            }
            pos++
        }

        /** A simple unit with its exponent, or a factor; either may carry an annotation. */
        private fun parseRun() {
            val start = pos
            var stemFloor = start
            while (true) {
                val char = peek()
                if (char == null || endsRun(char)) break
                when (char) {
                    '[' -> stemFloor = skipBracketed()
                    ']' -> fail(UcumSyntaxError.ILLEGAL_CHARACTER, pos)
                    else -> pos++
                }
            }
            val run = code.substring(start, pos)
            // Digits that end the run, after any bracketed part, are its exponent.
            val stemLength = run.length - run.substring(stemFloor - start).takeLastWhile { it.isAsciiDigit() }.length
            if (isSign(peek())) {
                if (stemLength < run.length) fail(UcumSyntaxError.BAD_EXPONENT, pos)
                parseSignedExponent()
            }
            val stem = run.substring(0, stemLength)
            if (stem.isNotEmpty() && !isNumberStem(stem)) hasUnitAtom = true
            if (peek() == '{') parseAnnotation()
        }

        /** Skips `[...]` and returns the index after the closing bracket. */
        private fun skipBracketed(): Int {
            val open = pos
            pos++
            while (peek() != ']') {
                val char = peek()
                if (char == null || char == '[') fail(UcumSyntaxError.ILLEGAL_CHARACTER, open)
                pos++
            }
            pos++
            return pos
        }

        private fun parseSignedExponent() {
            val sign = pos
            pos++
            val digitsStart = pos
            while (peek()?.isAsciiDigit() == true) pos++
            val next = peek()
            val endsCleanly = next == null || isOperator(next) || next == ')' || next == '{'
            if (pos == digitsStart || !endsCleanly) fail(UcumSyntaxError.BAD_EXPONENT, sign)
        }
    }
}

internal fun Char.isAsciiDigit(): Boolean = this in '0'..'9'
