package hms.kernel.testing.statemachine

import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * The counts file of a sequence run: `<hms.pbt.countsDir>/<name>.json` (docs/specs/modules/state-machines-and-invariants.md
 * §3.3; BUILD-PROMPT §19.1 "record the actual sequence counts").
 *
 * Gradle's `hms.test-conventions` sets [SYSTEM_PROPERTY] to `<project build dir>/pbt-counts/<test task>` for every test
 * task, declares that directory as the task's output and empties it before the task runs. When the property is absent
 * (an IDE run), nothing is written. A file is written for a failed run too, with `"result": "fail"`. Two runs with the
 * same name in one test JVM would write the same file: the second write fails instead of overwriting the first.
 */
object SequenceCounts {
    /** System property naming the directory of the counts files. */
    const val SYSTEM_PROPERTY: String = "hms.pbt.countsDir"

    /** The `result` of a run that passed. */
    const val PASS: String = "pass"

    /** The `result` of a run that failed. */
    const val FAIL: String = "fail"

    private val unsafe = Regex("[^A-Za-z0-9._-]")

    /** Every counts file written by this JVM, by canonical path. */
    private val written: MutableSet<String> = ConcurrentHashMap.newKeySet()

    /** The counts file's name for a run called [name]: every character outside `[A-Za-z0-9._-]` becomes `_`. */
    fun fileName(name: String): String = unsafe.replace(name, "_") + ".json"

    /**
     * The counts as JSON, one key per line, in a fixed order: the keys of spec §3.3, then `result` ([PASS] or [FAIL]),
     * `master_seed`, `fired_per_transition` (by transition index), `check_applied` (by check name), and
     * `predicate_held` and `predicate_failed` (by predicate ordinal).
     */
    fun json(
        stats: RunStats,
        result: String,
    ): String =
        listOf(
            "name" to quote(stats.name),
            "machine" to quote(stats.machine),
            "budget" to stats.budget.toString(),
            "sequences" to stats.sequences.toString(),
            "steps" to stats.steps.toString(),
            "fired" to stats.fired.toString(),
            "refused" to stats.refused.toString(),
            "not_applicable" to stats.notApplicable.toString(),
            "ambiguous" to stats.ambiguous.toString(),
            "transitions_covered" to stats.transitionsCovered.toString(),
            "transitions_total" to stats.transitionsTotal.toString(),
            "result" to quote(result),
            "master_seed" to stats.masterSeed.toString(),
            "fired_per_transition" to array(stats.firedPerTransition),
            "check_applied" to stats.checkApplied.entries.joinToString(", ", "{", "}") { (name, count) -> "${quote(name)}: $count" },
            "predicate_held" to array(stats.predicateHeld),
            "predicate_failed" to array(stats.predicateFailed),
        ).joinToString(separator = ",\n", prefix = "{\n", postfix = "\n}\n") { (key, value) -> "  ${quote(key)}: $value" }

    /**
     * Writes the counts file when [SYSTEM_PROPERTY] is set; returns it, or null when nothing was written.
     *
     * @throws AssertionError when this JVM already wrote the same file: give each run its own name.
     */
    fun write(
        stats: RunStats,
        result: String,
    ): File? {
        val directory = System.getProperty(SYSTEM_PROPERTY)?.takeIf { it.isNotBlank() } ?: return null
        val file = File(directory, fileName(stats.name))
        if (!written.add(file.canonicalPath)) {
            throw AssertionError(
                "the counts file $file was already written in this test run by another sequence run named like " +
                    "'${stats.name}': give every runSequences and machineSequenceProperties call its own name (spec §3.3)",
            )
        }
        file.parentFile.mkdirs()
        file.writeText(json(stats, result), Charsets.UTF_8)
        return file
    }

    private fun array(values: List<Long>): String = values.joinToString(", ", "[", "]")

    /** A JSON string literal: quotes, backslashes and control characters escaped. */
    internal fun quote(text: String): String =
        buildString(text.length + 2) {
            append('"')
            for (character in text) {
                when {
                    character == '"' -> append("\\\"")
                    character == '\\' -> append("\\\\")
                    character == '\n' -> append("\\n")
                    character == '\r' -> append("\\r")
                    character == '\t' -> append("\\t")
                    character < ' ' -> append("\\u%04x".format(character.code))
                    else -> append(character)
                }
            }
            append('"')
        }
}
