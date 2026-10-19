package hms.tests.invariants

import hms.kernel.testing.PropertyTestBudget
import hms.tests.invariants.application.DomainLayerCheck
import hms.tests.invariants.application.register.SiEntry
import hms.tests.invariants.application.register.SiRegister
import hms.tests.invariants.application.register.SiSources
import hms.tests.invariants.application.register.SourceFiles
import hms.tests.invariants.application.status.PropertyResult
import hms.tests.invariants.application.status.SiStatusRecorder
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.nulls.shouldNotBeNull
import java.nio.file.Files

/** The register and its sources, read once per test JVM from the paths the Gradle task passes. */
object Scaffold {
    val files: SourceFiles by lazy { SourceFiles.fromSystemProperties() }
    val register: SiRegister by lazy { SiRegister.parse(Files.readString(files.register)) }
    val sources: SiSources by lazy { SiSources.read(files) }
}

/** The specification-layer properties an SI test spec declares (docs/specs/modules/state-machines-and-invariants.md §4). */
class SpecLayer {
    internal val declared = mutableListOf<Declared>()

    /**
     * Declares the property [property] (a hazard-log `PropertyTest:` name) on [machine]. [run] drives the machine's
     * generated model over random command sequences at the property budget, asserts the property after every step and
     * returns the number of sequences it ran.
     */
    fun property(
        machine: String,
        property: String,
        run: () -> Int,
    ) {
        declared += Declared(machine, property, run)
    }

    internal class Declared(
        val machine: String,
        val property: String,
        val run: () -> Int,
    )
}

/**
 * Registers an SI's tests (spec §4): one test per specification-layer property the register lists, a test that the
 * declared properties are exactly the register's, and the domain-layer test whose name carries its status
 * (`SI-20 domain layer NOT-BUILT (waits on WP-0.4; KA-060)`). After the spec it writes `build/si-status/SI-nn.json`.
 * Nothing here is skipped, disabled, quarantined or tagged out (spec §4 rule 1).
 */
fun FunSpec.siInvariantTests(
    si: String,
    specLayer: SpecLayer.() -> Unit = {},
) {
    val entry = Scaffold.register.entry(si)
    val budget = PropertyTestBudget.sequences()
    val recorder = SiStatusRecorder(entry, budget)
    val declared = SpecLayer().apply(specLayer).declared

    declared.forEach { property -> specLayerTest(entry, property, recorder) }

    val registerTest =
        "$si specification layer: the properties run are exactly the register's (${entry.plannedTest}; ${entry.hazards.joinToString()})"
    test(registerTest) {
        declared.map { it.machine to it.property } shouldContainExactlyInAnyOrder entry.specLayer.map { it.machine to it.property }
    }

    test(entry.domainTestName) {
        runCatching { DomainLayerCheck.verify(entry, Scaffold.sources, Scaffold.files.repositoryRoot, budget) }
            .onSuccess { recorder.domainTest(passed = true, message = null) }
            .onFailure { recorder.domainTest(passed = false, message = it.message) }
            .getOrThrow()
    }

    afterSpec { SiStatusRecorder.directory()?.let { recorder.write(it) } }
}

private fun FunSpec.specLayerTest(
    entry: SiEntry,
    property: SpecLayer.Declared,
    recorder: SiStatusRecorder,
) {
    val listed = entry.specLayer.singleOrNull { it.machine == property.machine && it.property == property.property }
    val clauses = listed?.clauses?.joinToString(prefix = "clauses ") ?: "not in the register"
    test("${entry.si} specification layer: ${property.property} on ${property.machine} ($clauses; ${entry.hazards.joinToString()})") {
        runCatching {
            withClue("the register must list ${property.property} on ${property.machine} under ${entry.si}") { listed.shouldNotBeNull() }
            property.run()
        }.onSuccess { sequences ->
            recorder.property(PropertyResult(property.machine, property.property, passed = true, sequences = sequences, message = null))
        }.onFailure { failure ->
            recorder.property(PropertyResult(property.machine, property.property, passed = false, sequences = 0, message = failure.message))
        }.getOrThrow()
    }
}
