package hms.kernel.archrules.migration

/**
 * A qualified SQL name. Unquoted words are folded to lower case, as PostgreSQL does; quoted identifiers and
 * Flyway placeholders stay as written.
 */
internal class SqlName(
    val parts: List<String>,
) {
    /** The last part: the table, function, trigger or policy name itself. */
    val table: String get() = parts.last()

    /** The part before the last, usually the schema; null for an unqualified name. */
    val schema: String? get() = parts.getOrNull(parts.size - 2)

    override fun toString(): String = parts.joinToString(".")
}

/** A name read from a token list, and the index of the first token after it. */
internal class NameRead(
    val name: SqlName,
    val next: Int,
)

/** Reads qualified names from tokens. */
internal object SqlNames {
    private val nameParts = setOf(TokenKind.WORD, TokenKind.PLACEHOLDER, TokenKind.NUMBER)

    /** Reads a qualified name (`a`, `a.b`, `"A".b`, `${schema}.b`, `audit_${suffix}`) at [start]; null when there is none. */
    fun read(
        tokens: List<SqlToken>,
        start: Int,
    ): NameRead? {
        val parts = mutableListOf<String>()
        var index = start
        var part = part(tokens, index)
        while (part != null) {
            parts += part.first
            index = part.second
            part = if (tokens.getOrNull(index)?.isSymbol(".") == true) part(tokens, index + 1) else null
        }
        return if (parts.isEmpty()) null else NameRead(SqlName(parts), index)
    }

    /** Reads a comma-separated list of names at [start], skipping an argument list after each (for functions). */
    fun readList(
        tokens: List<SqlToken>,
        start: Int,
    ): List<SqlName> {
        val names = mutableListOf<SqlName>()
        var read = read(tokens, start)
        while (read != null) {
            names += read.name
            val after = skipParentheses(tokens, read.next)
            read = if (tokens.getOrNull(after)?.isSymbol(",") == true) read(tokens, after + 1) else null
        }
        return names
    }

    /** The index after a parenthesised group at [start], or [start] when there is none there. */
    fun skipParentheses(
        tokens: List<SqlToken>,
        start: Int,
    ): Int {
        if (tokens.getOrNull(start)?.isSymbol("(") != true) return start
        var depth = 0
        var index = start
        do {
            val token = tokens.getOrNull(index)
            depth += depthChange(token)
            index++
        } while (depth > 0 && token != null)
        return index
    }

    /** +1 for `(`, -1 for `)`, 0 otherwise. */
    fun depthChange(token: SqlToken?): Int =
        when {
            token == null -> 0
            token.isSymbol("(") -> 1
            token.isSymbol(")") -> -1
            else -> 0
        }

    private fun part(
        tokens: List<SqlToken>,
        start: Int,
    ): Pair<String, Int>? {
        val first = tokens.getOrNull(start)
        return when {
            first == null -> null
            first.kind == TokenKind.QUOTED_IDENTIFIER -> first.text to start + 1
            first.kind == TokenKind.WORD || first.kind == TokenKind.PLACEHOLDER -> joinAdjacent(tokens, start)
            else -> null
        }
    }

    /** Joins the adjacent word, placeholder and number tokens from [start] into one identifier. */
    private fun joinAdjacent(
        tokens: List<SqlToken>,
        start: Int,
    ): Pair<String, Int> {
        val text = StringBuilder(normalise(tokens[start]))
        var index = start + 1
        while (index < tokens.size && tokens[index].kind in nameParts && tokens[index].start == tokens[index - 1].end) {
            text.append(normalise(tokens[index]))
            index++
        }
        return text.toString() to index
    }

    private fun normalise(token: SqlToken): String = if (token.kind == TokenKind.PLACEHOLDER) token.text else token.text.lowercase()
}

/** One statement of a migration (its tokens without the closing semicolon), with helpers to read it. */
internal class SqlStatement(
    val tokens: List<SqlToken>,
) {
    /** The line the statement starts on. */
    val line: Int get() = tokens.first().line

    /** The first keyword: CREATE, ALTER, DROP, GRANT, UPDATE and so on. */
    val verb: String get() = tokens.first().keyword

    /** For CREATE, ALTER and DROP, the index of the object type after modifiers such as OR REPLACE or UNIQUE. */
    val objectIndex: Int =
        if (verb in OBJECT_VERBS) {
            (1 until tokens.size).firstOrNull { tokens[it].keyword !in MODIFIERS } ?: tokens.size
        } else {
            -1
        }

    /** For CREATE, ALTER and DROP, the object type (TABLE, TRIGGER, FUNCTION, ...); empty otherwise. */
    val objectType: String get() = keywordAt(objectIndex)

    /** The keyword at [index], or an empty string. */
    fun keywordAt(index: Int): String = tokens.getOrNull(index)?.keyword.orEmpty()

    /** The index of the first [keyword] at or after [from], or -1. */
    fun indexOf(
        keyword: String,
        from: Int = 0,
    ): Int = (from until tokens.size).firstOrNull { tokens[it].keyword == keyword } ?: -1

    /** True when [keyword] occurs anywhere in the statement. */
    fun has(keyword: String): Boolean = tokens.any { it.keyword == keyword }

    /** Skips the optional keywords [optional] from [index]; returns the index of the first other token. */
    fun skip(
        index: Int,
        optional: Set<String>,
    ): Int {
        var i = index
        while (keywordAt(i) in optional && keywordAt(i).isNotEmpty()) i++
        return i
    }

    /** The name at [index] after the optional keywords [optional]; null when there is none. */
    fun nameAfter(
        index: Int,
        optional: Set<String> = emptySet(),
    ): NameRead? = SqlNames.read(tokens, skip(index, optional))

    /** True when the parentheses balance. */
    fun balanced(): Boolean {
        val depths = tokens.runningFold(0) { depth, token -> depth + SqlNames.depthChange(token) }
        return depths.none { it < 0 } && depths.last() == 0
    }

    companion object {
        private val OBJECT_VERBS = setOf("CREATE", "ALTER", "DROP")
        private val MODIFIERS =
            setOf(
                "OR",
                "REPLACE",
                "UNIQUE",
                "TEMP",
                "TEMPORARY",
                "UNLOGGED",
                "GLOBAL",
                "LOCAL",
                "CONSTRAINT",
                "MATERIALIZED",
                "RECURSIVE",
                "TRUSTED",
                "PROCEDURAL",
            )

        /** Optional `IF EXISTS` / `IF NOT EXISTS`. */
        val IF_EXISTS: Set<String> = setOf("IF", "NOT", "EXISTS")

        /** Splits [tokens] into statements at top-level semicolons; a `BEGIN ATOMIC ... END` body is kept whole. */
        fun split(tokens: List<SqlToken>): List<SqlStatement> {
            val statements = mutableListOf<SqlStatement>()
            var current = mutableListOf<SqlToken>()
            var atomicDepth = 0
            for (token in tokens) {
                if (token.isSymbol(";") && atomicDepth == 0) {
                    if (current.isNotEmpty()) statements += SqlStatement(current)
                    current = mutableListOf()
                } else {
                    atomicDepth = atomicDepthAfter(current.lastOrNull(), token, atomicDepth)
                    current += token
                }
            }
            if (current.isNotEmpty()) statements += SqlStatement(current)
            return statements
        }

        private fun atomicDepthAfter(
            previous: SqlToken?,
            token: SqlToken,
            depth: Int,
        ): Int =
            when {
                depth == 0 -> if (token.keyword == "ATOMIC" && previous?.keyword == "BEGIN") 1 else 0
                token.keyword == "BEGIN" || token.keyword == "CASE" -> depth + 1
                token.keyword == "END" -> depth - 1
                else -> depth
            }
    }
}
