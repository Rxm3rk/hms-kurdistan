package hms.platform.docs.infrastructure.template

import tools.jackson.databind.JsonNode

/**
 * Strict reading of a parsed YAML tree for the template loader (docs/specs/modules/platform-docs.md §4.1): every
 * mapping is checked against its closed set of keys, every value against its type, and each problem is collected
 * with its path (for example `elements[3].size_pt.min`), so one load reports every problem of a file at once. A
 * template holds no patient data, so problems may quote keys and values.
 */
internal class YamlNodes {
    private val found = mutableListOf<String>()

    /** Every problem found so far, in the order found. */
    val problems: List<String> get() = found.toList()

    fun problem(
        path: String,
        message: String,
    ) {
        found += "$path: $message"
    }

    /** The mapping at [path], with any key outside [allowed] reported; null (and reported) when it is not a mapping. */
    fun mapping(
        node: JsonNode?,
        path: String,
        allowed: Set<String>,
    ): JsonNode? {
        if (node == null || !node.isObject) {
            problem(path, "must be a mapping")
            return null
        }
        node.propertyNames().filter { it !in allowed }.sorted().forEach { problem(childPath(path, it), "unknown key") }
        return node
    }

    fun string(
        parent: JsonNode,
        path: String,
        key: String,
    ): String? {
        val node = parent.get(key)
        return when {
            node == null || node.isNull -> missing(path, key)
            !node.isString || node.asString().isBlank() -> invalid(path, key, "must be a non-blank string")
            else -> node.asString()
        }
    }

    fun integer(
        parent: JsonNode,
        path: String,
        key: String,
    ): Int? {
        val node = parent.get(key)
        return when {
            node == null || node.isNull -> missing(path, key)
            !node.isIntegralNumber || !node.canConvertToInt() -> invalid(path, key, "must be an integer")
            else -> node.intValue()
        }
    }

    fun number(
        parent: JsonNode,
        path: String,
        key: String,
    ): Double? {
        val node = parent.get(key)
        return when {
            node == null || node.isNull -> missing(path, key)
            !node.isNumber || !node.doubleValue().isFinite() -> invalid(path, key, "must be a number")
            else -> node.doubleValue()
        }
    }

    /** A value of a closed vocabulary, by its YAML name; null (and reported) when absent or unknown. */
    fun <T> choice(
        parent: JsonNode,
        path: String,
        key: String,
        values: Map<String, T>,
    ): T? =
        string(parent, path, key)?.let { name ->
            values[name] ?: invalid(path, key, "'$name' is not one of ${values.keys.sorted()}")
        }

    /** [read] when [key] is present, [default] (without a problem) when it is absent. */
    fun <T> optional(
        parent: JsonNode,
        key: String,
        default: T?,
        read: () -> T?,
    ): T? = if (parent.has(key)) read() else default

    fun list(
        parent: JsonNode,
        path: String,
        key: String,
    ): List<JsonNode>? {
        val node = parent.get(key)
        return when {
            node == null || node.isNull -> missing(path, key)
            !node.isArray -> invalid(path, key, "must be a list")
            else -> node.toList()
        }
    }

    private fun <T> missing(
        path: String,
        key: String,
    ): T? {
        problem(childPath(path, key), "required")
        return null
    }

    private fun <T> invalid(
        path: String,
        key: String,
        message: String,
    ): T? {
        problem(childPath(path, key), message)
        return null
    }

    companion object {
        fun childPath(
            path: String,
            key: String,
        ): String = if (path.isEmpty()) key else "$path.$key"
    }
}
