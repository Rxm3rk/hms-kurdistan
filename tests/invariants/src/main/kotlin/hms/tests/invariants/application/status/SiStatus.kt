package hms.tests.invariants.application.status

import hms.tests.invariants.application.json.Json
import hms.tests.invariants.application.register.SiEntry
import java.nio.file.Files
import java.nio.file.Path

/** The specification-layer result of an SI in one run (docs/specs/modules/state-machines-and-invariants.md §4 rule 4). */
enum class SpecLayerResult {
    /** Every specification-layer property the register lists ran and held. */
    HOLDS,

    /** No WP-0.5 machine encodes the SI: the register lists no specification-layer property. */
    NONE,

    /** A property failed, or not every listed property ran (a filtered run is never a pass). */
    FAILED,
}

/** One specification-layer property's result. */
data class PropertyResult(
    val machine: String,
    val property: String,
    val passed: Boolean,
    val sequences: Int,
    val message: String?,
)

/**
 * Collects one SI test spec's results and writes `build/si-status/SI-nn.json` (spec §4 rule 4, §7): the CI record sums
 * `spec_layer` = HOLDS into `si_spec_layer_holds` and `domain_layer` = NOT-BUILT into `si_domain_not_built`.
 */
class SiStatusRecorder(
    private val entry: SiEntry,
    private val budget: Int,
) {
    private val properties = mutableListOf<PropertyResult>()
    private var domainTest: Boolean? = null
    private var domainMessage: String? = null

    /** Records a specification-layer property's result. */
    fun property(result: PropertyResult) {
        properties += result
    }

    /** Records the domain-layer test's result. */
    fun domainTest(
        passed: Boolean,
        message: String?,
    ) {
        domainTest = passed
        domainMessage = message
    }

    /** The specification-layer result so far. */
    fun specLayer(): SpecLayerResult {
        val listed = entry.specLayer.map { it.machine to it.property }.toSet()
        val passed = properties.filter { it.passed }.map { it.machine to it.property }.toSet()
        return when {
            listed.isEmpty() && properties.isEmpty() -> SpecLayerResult.NONE
            properties.all { it.passed } && passed == listed -> SpecLayerResult.HOLDS
            else -> SpecLayerResult.FAILED
        }
    }

    /** The status document (keys agreed with `sh tools/hms statemachines si-status`). */
    fun document(): Map<String, Any?> =
        linkedMapOf(
            "si" to entry.si,
            "spec_layer" to specLayer().name,
            "spec_layer_properties" to properties.size,
            "domain_layer" to entry.domainLayer.label,
            "sequences" to properties.sumOf { it.sequences.toLong() },
            "budget" to budget,
            "domain_test" to
                when (domainTest) {
                    null -> "NOT-RUN"
                    true -> "PASSED"
                    false -> "FAILED"
                },
            "domain_test_message" to domainMessage,
            "domain_test_name" to entry.domainTestName,
            "waits_on" to entry.waitsOn,
            "ka" to entry.knownAnomaly,
            "properties" to
                properties.map {
                    linkedMapOf(
                        "machine" to it.machine,
                        "property" to it.property,
                        "result" to if (it.passed) "HOLDS" else "FAILED",
                        "sequences" to it.sequences,
                        "message" to it.message,
                    )
                },
        )

    /** Writes `<directory>/SI-nn.json`; returns the file. */
    fun write(directory: Path): Path {
        Files.createDirectories(directory)
        val file = directory.resolve("${entry.si}.json")
        Files.writeString(file, Json.render(document()))
        return file
    }

    companion object {
        /** System property naming the status directory; set by tests/invariants/build.gradle.kts. Absent: nothing is written. */
        const val DIRECTORY_PROPERTY: String = "hms.invariants.statusDir"

        /** The status directory of this run, or null in a run without Gradle (an IDE run writes no record). */
        fun directory(): Path? = System.getProperty(DIRECTORY_PROPERTY)?.let { Path.of(it) }
    }
}
