package hms.tests.invariants.application.status

import hms.tests.invariants.application.json.Json
import hms.tests.invariants.application.register.SiRegister
import hms.tests.invariants.application.register.SourceFiles
import hms.tests.invariants.application.register.SpecLayerProperty
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.nio.file.Files

/**
 * The SI status file `build/si-status/SI-nn.json` (docs/specs/modules/state-machines-and-invariants.md §4 rule 4, §7):
 * the keys `sh tools/hms statemachines si-status` sums, and a specification layer that is HOLDS only when every listed
 * property ran and held.
 */
class SiStatusTest :
    FunSpec({
        val register = SiRegister.parse(Files.readString(SourceFiles.fromSystemProperties().register))
        val listed = SpecLayerProperty("medication-administration", "PropertyTest:SI-02-*", listOf("a"), "fixture")
        val entry = register.entry("SI-02").copy(specLayer = listOf(listed))
        val passed = PropertyResult(listed.machine, listed.property, passed = true, sequences = 1000, message = null)

        test("an SI with no specification-layer property is NONE, and its domain layer NOT-BUILT") {
            val recorder = SiStatusRecorder(register.entry("SI-20").copy(specLayer = emptyList()), budget = 1000)
            recorder.domainTest(passed = true, message = null)
            val document = recorder.document()
            document["si"] shouldBe "SI-20"
            document["spec_layer"] shouldBe "NONE"
            document["spec_layer_properties"] shouldBe 0
            document["domain_layer"] shouldBe "NOT-BUILT"
            document["sequences"] shouldBe 0L
            document["domain_test"] shouldBe "PASSED"
            document["domain_test_name"] shouldBe "SI-20 domain layer NOT-BUILT (waits on WP-0.4; KA-060)"
        }

        test("HOLDS only when every listed property ran and held") {
            SiStatusRecorder(entry, 1000).apply { property(passed) }.specLayer() shouldBe SpecLayerResult.HOLDS
            SiStatusRecorder(entry, 1000).specLayer() shouldBe SpecLayerResult.FAILED
            SiStatusRecorder(entry, 1000).apply { property(passed.copy(passed = false, sequences = 0)) }.specLayer() shouldBe SpecLayerResult.FAILED
        }

        test("a property the register does not list makes the layer FAILED, never NONE or HOLDS") {
            val unlisted = register.entry("SI-20").copy(specLayer = emptyList())
            SiStatusRecorder(unlisted, 1000).apply { property(passed) }.specLayer() shouldBe SpecLayerResult.FAILED
        }

        test("the file is written as SI-nn.json and reads back with the sequence count") {
            val directory = Files.createTempDirectory("si-status")
            try {
                val file = SiStatusRecorder(entry, 1000).apply { property(passed) }.write(directory.resolve("si-status"))
                file.fileName.toString() shouldBe "SI-02.json"
                val document = Json.parse(Files.readString(file)) as Map<*, *>
                document["spec_layer"] shouldBe "HOLDS"
                document["spec_layer_properties"] shouldBe 1L
                document["sequences"] shouldBe 1000L
            } finally {
                directory.toFile().deleteRecursively()
            }
        }
    })
