package hms.kernel.archrules.migration

/** The kinds of token the migration linter reads (platform-journal.md §9.3). */
internal enum class TokenKind { WORD, QUOTED_IDENTIFIER, STRING, DOLLAR_STRING, PLACEHOLDER, PARAMETER, NUMBER, SYMBOL }

/**
 * One SQL token. [text] is the token as written for words, symbols, numbers, placeholders and parameters, and
 * the unescaped content for strings, dollar-quoted strings and quoted identifiers. [start] and [end] are offsets
 * in the source, so that adjacent tokens (`audit_${suffix}`) can be joined into one identifier.
 */
internal class SqlToken(
    val kind: TokenKind,
    val text: String,
    val line: Int,
    val start: Int,
    val end: Int,
) {
    /** The upper-case keyword of a word; empty for every other kind. */
    val keyword: String = if (kind == TokenKind.WORD) text.uppercase() else ""

    /** True for the symbol [symbol]. */
    fun isSymbol(symbol: String): Boolean = kind == TokenKind.SYMBOL && text == symbol

    override fun toString(): String = text
}

/** The result of lexing a migration: its tokens, or the line where lexing failed and why. */
internal sealed interface LexResult {
    class Tokens(
        val tokens: List<SqlToken>,
    ) : LexResult

    class Failed(
        val line: Int,
        val reason: String,
    ) : LexResult
}

/**
 * A PostgreSQL lexer for migrations: comments (`--`, nested `/* */`), string constants (with `''` and, for
 * `E'...'`, backslash escapes), dollar-quoted strings (`$$`, `$tag$`), quoted identifiers, positional parameters
 * and Flyway placeholders (`${name}`). An unterminated string, comment, identifier or placeholder fails the
 * lex, so the linter never guesses where a statement ends (fails closed, platform-journal.md §9.3).
 */
@Suppress("TooManyFunctions") // One small reader per token kind keeps each of them simple.
internal class SqlLexer private constructor(
    private val sql: String,
) {
    private var pos = 0
    private var line = 1
    private val tokens = mutableListOf<SqlToken>()

    private class LexFailure(
        val line: Int,
        override val message: String,
    ) : RuntimeException(message)

    private fun run(): LexResult =
        try {
            while (pos < sql.length) next()
            LexResult.Tokens(tokens.toList())
        } catch (failure: LexFailure) {
            LexResult.Failed(failure.line, failure.message)
        }

    private fun next() {
        val c = sql[pos]
        when {
            c == NEWLINE -> advance(1)
            c.isWhitespace() -> pos++
            sql.startsWith("--", pos) -> skipWhile { it != NEWLINE }
            sql.startsWith("/*", pos) -> blockComment()
            else -> token(c)
        }
    }

    private fun token(c: Char) {
        when {
            c == QUOTE -> string(escapes = false)
            c.uppercaseChar() == 'E' && sql.getOrNull(pos + 1) == QUOTE -> escapeString()
            c == DOUBLE_QUOTE -> quotedIdentifier()
            c == DOLLAR -> dollar()
            c.isLetter() || c == '_' -> emitWhile(TokenKind.WORD, ::isWordChar)
            c.isDigit() -> emitWhile(TokenKind.NUMBER, ::isNumberChar)
            else -> emit(TokenKind.SYMBOL, c.toString(), pos + 1)
        }
    }

    private fun isWordChar(c: Char): Boolean = c.isLetterOrDigit() || c == '_'

    private fun isNumberChar(c: Char): Boolean = c.isLetterOrDigit() || c == '.'

    private fun advance(count: Int) {
        repeat(count) {
            if (sql[pos] == NEWLINE) line++
            pos++
        }
    }

    private fun skipWhile(predicate: (Char) -> Boolean) {
        while (pos < sql.length && predicate(sql[pos])) advance(1)
    }

    /** Emits a token that starts at [pos] and ends before [end], then moves past it. */
    private fun emit(
        kind: TokenKind,
        text: String,
        end: Int,
    ) {
        tokens += SqlToken(kind, text, line, pos, end)
        advance(end - pos)
    }

    private fun emitWhile(
        kind: TokenKind,
        predicate: (Char) -> Boolean,
    ) {
        var end = pos
        while (end < sql.length && predicate(sql[end])) end++
        emit(kind, sql.substring(pos, end), end)
    }

    private fun blockComment() {
        val startLine = line
        var depth = 0
        do {
            when {
                sql.startsWith("/*", pos) -> {
                    depth++
                    advance(2)
                }
                sql.startsWith("*/", pos) -> {
                    depth--
                    advance(2)
                }
                pos >= sql.length -> throw LexFailure(startLine, "unterminated block comment")
                else -> advance(1)
            }
        } while (depth > 0)
    }

    private fun escapeString() {
        advance(1)
        string(escapes = true)
    }

    private fun string(escapes: Boolean) {
        val (content, end) = quoted(QUOTE, escapes, "unterminated string constant")
        emit(TokenKind.STRING, content, end)
    }

    private fun quotedIdentifier() {
        val (content, end) = quoted(DOUBLE_QUOTE, escapes = false, error = "unterminated quoted identifier")
        emit(TokenKind.QUOTED_IDENTIFIER, content, end)
    }

    /** Reads a constant delimited by [quote] from [pos]; returns its unescaped content and the offset after it. */
    private fun quoted(
        quote: Char,
        escapes: Boolean,
        error: String,
    ): Pair<String, Int> {
        val content = StringBuilder()
        var i = pos + 1
        var end = -1
        while (end < 0) {
            val c = sql.getOrNull(i) ?: throw LexFailure(line, error)
            val doubled = c == quote && sql.getOrNull(i + 1) == quote
            val escaped = escapes && c == BACKSLASH && i + 1 < sql.length
            when {
                doubled || escaped -> {
                    content.append(sql[i + 1])
                    i += 2
                }
                c == quote -> end = i + 1
                else -> {
                    content.append(c)
                    i++
                }
            }
        }
        return content.toString() to end
    }

    private fun dollar() {
        val next = sql.getOrNull(pos + 1)
        when {
            next == '{' -> placeholder()
            next != null && next.isDigit() -> emitParameter()
            else -> dollarQuoted()
        }
    }

    private fun placeholder() {
        val close = sql.indexOf('}', pos)
        val newline = sql.indexOf(NEWLINE, pos).let { if (it < 0) sql.length else it }
        if (close < 0 || close > newline) throw LexFailure(line, "unterminated Flyway placeholder")
        emit(TokenKind.PLACEHOLDER, sql.substring(pos, close + 1), close + 1)
    }

    private fun emitParameter() {
        var end = pos + 1
        while (end < sql.length && sql[end].isDigit()) end++
        emit(TokenKind.PARAMETER, sql.substring(pos, end), end)
    }

    private fun dollarQuoted() {
        var tagEnd = pos + 1
        while (tagEnd < sql.length && isWordChar(sql[tagEnd])) tagEnd++
        if (sql.getOrNull(tagEnd) != DOLLAR) {
            emit(TokenKind.SYMBOL, DOLLAR.toString(), pos + 1)
            return
        }
        val delimiter = sql.substring(pos, tagEnd + 1)
        val close = sql.indexOf(delimiter, tagEnd + 1)
        if (close < 0) throw LexFailure(line, "unterminated dollar-quoted string $delimiter")
        emit(TokenKind.DOLLAR_STRING, sql.substring(tagEnd + 1, close), close + delimiter.length)
    }

    companion object {
        private const val NEWLINE = '\n'
        private const val QUOTE = '\''
        private const val DOUBLE_QUOTE = '"'
        private const val DOLLAR = '$'
        private const val BACKSLASH = '\\'

        /** Lexes [sql]. */
        fun tokenize(sql: String): LexResult = SqlLexer(sql).run()
    }
}
