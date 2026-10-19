package hms.tests.scenarios.application.runner

/**
 * A minimal JSON writer for the pass matrix: maps with string keys (in insertion order), lists, strings, numbers,
 * booleans and null. It keeps the framework free of a JSON library; the output is UTF-8 text with two-space indents.
 */
internal object Json {
    private const val INDENT = "  "
    private const val CONTROL_LIMIT = 0x20

    fun render(value: Any?): String = StringBuilder().also { write(it, value, 0) }.append('\n').toString()

    private fun write(
        out: StringBuilder,
        value: Any?,
        depth: Int,
    ) {
        when (value) {
            null -> {
                out.append("null")
            }

            is String -> {
                string(out, value)
            }

            is Boolean, is Int, is Long -> {
                out.append(value.toString())
            }

            is Map<*, *> -> {
                out.container(value.entries.toList(), depth, '{', '}') { entry ->
                    string(out, entry.key as String)
                    out.append(": ")
                    write(out, entry.value, depth + 1)
                }
            }

            is List<*> -> {
                out.container(value, depth, '[', ']') { write(out, it, depth + 1) }
            }

            else -> {
                throw IllegalArgumentException("cannot write ${value.javaClass.name} as JSON")
            }
        }
    }

    private fun <T> StringBuilder.container(
        items: List<T>,
        depth: Int,
        open: Char,
        close: Char,
        item: (T) -> Unit,
    ) {
        append(open)
        if (items.isEmpty()) {
            append(close)
            return
        }
        items.forEachIndexed { index, element ->
            append(if (index == 0) "\n" else ",\n").append(INDENT.repeat(depth + 1))
            item(element)
        }
        append('\n').append(INDENT.repeat(depth)).append(close)
    }

    private fun string(
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

    private const val HEX = 16
    private const val UNICODE_DIGITS = 4
}
