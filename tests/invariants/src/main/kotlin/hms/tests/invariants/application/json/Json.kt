package hms.tests.invariants.application.json

/**
 * A small strict JSON reader and writer for the SI register and the SI status files, so the scaffold needs no JSON
 * library. Objects read as maps in document order (a duplicate key is an error), arrays as lists, numbers as [Long]
 * (the files hold integers only; a fraction or an exponent is an error), and `true`, `false` and `null` as themselves.
 */
object Json {
    private const val INDENT = "  "

    /** Parses [text] as one JSON value; anything after it but whitespace is an error. */
    fun parse(text: String): Any? {
        val reader = JsonReader(Cursor(text))
        val value = reader.value()
        reader.end()
        return value
    }

    /** Writes [value] (maps with string keys, lists, strings, integers, booleans and null) as text with two-space indents. */
    fun render(value: Any?): String = StringBuilder().also { write(it, value, 0) }.append('\n').toString()

    private fun write(
        out: StringBuilder,
        value: Any?,
        depth: Int,
    ) {
        when (value) {
            null -> out.append("null")
            is String -> JsonStrings.quote(out, value)
            is Boolean, is Int, is Long -> out.append(value.toString())
            is Map<*, *> -> container(out, value.entries.toList(), depth, '{', '}') { writeEntry(out, it, depth) }
            is List<*> -> container(out, value, depth, '[', ']') { write(out, it, depth + 1) }
            else -> throw IllegalArgumentException("cannot write ${value.javaClass.name} as JSON")
        }
    }

    private fun writeEntry(
        out: StringBuilder,
        entry: Map.Entry<*, *>,
        depth: Int,
    ) {
        val key = entry.key as? String ?: throw IllegalArgumentException("JSON object keys must be strings, got ${entry.key}")
        JsonStrings.quote(out, key)
        out.append(": ")
        write(out, entry.value, depth + 1)
    }

    private fun <T> container(
        out: StringBuilder,
        items: List<T>,
        depth: Int,
        open: Char,
        close: Char,
        item: (T) -> Unit,
    ) {
        out.append(open)
        if (items.isEmpty()) {
            out.append(close)
            return
        }
        items.forEachIndexed { index, element ->
            out.append(if (index == 0) "\n" else ",\n").append(INDENT.repeat(depth + 1))
            item(element)
        }
        out.append('\n').append(INDENT.repeat(depth)).append(close)
    }
}

/** JSON string quoting and unquoting. */
private object JsonStrings {
    const val CONTROL_LIMIT = 0x20
    const val HEX = 16
    const val UNICODE_DIGITS = 4

    fun quote(
        out: StringBuilder,
        value: String,
    ) {
        out.append('"')
        for (char in value) {
            when {
                char == '"' -> out.append("\\\"")
                char == '\\' -> out.append("\\\\")
                char == '\n' -> out.append("\\n")
                char == '\r' -> out.append("\\r")
                char == '\t' -> out.append("\\t")
                char.code < CONTROL_LIMIT -> out.append("\\u").append(char.code.toString(HEX).padStart(UNICODE_DIGITS, '0'))
                else -> out.append(char)
            }
        }
        out.append('"')
    }

    /** Reads a string literal at the cursor (the opening quote included). */
    fun unquote(cursor: Cursor): String {
        cursor.expect('"')
        val out = StringBuilder()
        while (true) {
            val char = cursor.next()
            when {
                char == '"' -> return out.toString()
                char == '\\' -> out.append(escape(cursor))
                char.code < CONTROL_LIMIT -> cursor.fail("unescaped control character in a string")
                else -> out.append(char)
            }
        }
    }

    private fun escape(cursor: Cursor): Char =
        when (val char = cursor.next()) {
            '"', '\\', '/' -> char
            'b' -> '\b'
            'f' -> '\u000C'
            'n' -> '\n'
            'r' -> '\r'
            't' -> '\t'
            'u' -> cursor.take(UNICODE_DIGITS).let { it.toIntOrNull(HEX) ?: cursor.fail("invalid \\u escape '$it'") }.toChar()
            else -> cursor.fail("invalid escape '\\$char'")
        }
}

/** The values of a JSON document, read at a [Cursor]. */
private class JsonReader(
    private val cursor: Cursor,
) {
    private val integer = Regex("-?(0|[1-9][0-9]*)")

    fun value(): Any? {
        cursor.skipWhitespace()
        return when (val char = cursor.peek()) {
            '{' -> objectValue()
            '[' -> arrayValue()
            '"' -> JsonStrings.unquote(cursor)
            't' -> literal("true", true)
            'f' -> literal("false", false)
            'n' -> literal("null", null)
            else -> if (char == '-' || char.isDigit()) numberValue() else cursor.fail("unexpected '$char'")
        }
    }

    fun end() {
        cursor.skipWhitespace()
        if (!cursor.atEnd()) cursor.fail("unexpected content after the JSON value")
    }

    private fun objectValue(): Map<String, Any?> {
        cursor.expect('{')
        val result = LinkedHashMap<String, Any?>()
        if (cursor.consume('}')) return result
        do {
            cursor.skipWhitespace()
            val key = JsonStrings.unquote(cursor)
            if (result.containsKey(key)) cursor.fail("duplicate key \"$key\"")
            cursor.skipWhitespace()
            cursor.expect(':')
            result[key] = value()
        } while (cursor.consume(','))
        cursor.skipWhitespace()
        cursor.expect('}')
        return result
    }

    private fun arrayValue(): List<Any?> {
        cursor.expect('[')
        val result = mutableListOf<Any?>()
        if (cursor.consume(']')) return result
        do {
            result += value()
        } while (cursor.consume(','))
        cursor.skipWhitespace()
        cursor.expect(']')
        return result
    }

    private fun numberValue(): Long {
        val raw = cursor.takeWhile { it == '-' || it.isDigit() }
        if (!cursor.atEnd() && cursor.peek() in ".eE") cursor.fail("only integers are allowed")
        if (!integer.matches(raw)) cursor.fail("invalid number '$raw'")
        return raw.toLongOrNull() ?: cursor.fail("number out of range '$raw'")
    }

    private fun literal(
        word: String,
        value: Any?,
    ): Any? {
        if (cursor.take(word.length) != word) cursor.fail("unexpected token")
        return value
    }
}

/** A position in a JSON text; every error names the offset. */
private class Cursor(
    private val text: String,
) {
    private var position = 0

    fun atEnd(): Boolean = position >= text.length

    fun peek(): Char = if (atEnd()) fail("unexpected end of input") else text[position]

    fun next(): Char = peek().also { position++ }

    fun take(count: Int): String {
        if (position + count > text.length) fail("unexpected end of input")
        return text.substring(position, position + count).also { position += count }
    }

    fun takeWhile(predicate: (Char) -> Boolean): String {
        val start = position
        while (!atEnd() && predicate(text[position])) position++
        return text.substring(start, position)
    }

    fun skipWhitespace() {
        takeWhile { it == ' ' || it == '\t' || it == '\r' || it == '\n' }
    }

    /** Skips whitespace, then consumes [char] if it comes next. */
    fun consume(char: Char): Boolean {
        skipWhitespace()
        if (!atEnd() && text[position] == char) {
            position++
            return true
        }
        return false
    }

    fun expect(char: Char) {
        if (peek() != char) fail("expected '$char'")
        position++
    }

    fun fail(message: String): Nothing = throw IllegalArgumentException("JSON: $message at offset $position")
}
