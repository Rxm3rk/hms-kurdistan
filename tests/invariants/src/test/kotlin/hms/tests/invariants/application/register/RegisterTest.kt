package hms.tests.invariants.application.register

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import java.nio.file.Files

/**
 * The register `tests/invariants/si-register.json` against its sources (docs/specs/modules/state-machines-and-invariants.md
 * §4 rule 2), and the checks themselves: each check must catch the defect it exists for.
 */
class RegisterTest :
    FunSpec({
        val files = SourceFiles.fromSystemProperties()
        val register = SiRegister.parse(Files.readString(files.register))
        val sources = SiSources.read(files)
        val si02 = register.entry("SI-02")

        fun problems(entry: SiEntry): List<String> = RegisterChecks.problems(entry, sources)

        test("the register holds SI-01…SI-21 in order, and every entry is complete against its sources") {
            register.entries.map { it.si } shouldContainExactly SiRegister.SI_IDS
            RegisterChecks.problems(register, sources).shouldBeEmpty()
        }

        test("every SI's domain layer is NOT-BUILT, tracked by KA-060, and its test name carries that status") {
            register.entries.forEach { entry ->
                withClue(entry.si) {
                    entry.domainLayer shouldBe DomainLayer.NOT_BUILT
                    entry.knownAnomaly shouldBe "KA-060"
                    entry.domainTestName shouldBe "${entry.si} domain layer NOT-BUILT (waits on ${entry.waitsOn}; KA-060)"
                }
            }
        }

        test("the sources read as expected: 21 §2.1 rows, §21 work packages and phases, hazards, backlog, KA-060 open") {
            sources.invariants.keys shouldContainExactly SiRegister.SI_IDS
            sources.workPackages.containsAll(listOf("WP-0.4", "WP-1.1b", "WP-3.3", "Phase 5")) shouldBe true
            sources.hazards.getValue("HAZ-0002").clauses shouldContainExactly listOf("a", "b", "c")
            sources.hazards
                .getValue("HAZ-0002")
                .plannedPropertyTests
                .shouldNotBeEmpty()
            sources.backlog.getValue("MED-MAR-01").workPackages shouldContainExactly listOf("WP-3.3")
            sources.knownAnomalies["KA-060"] shouldBe "open"
            sources.machines
                .getValue("medication-administration")
                .invariants
                .contains("SI-02") shouldBe true
        }

        context("each check catches its defect") {
            mapOf(
                "a title that is not §2.1's text" to si02.copy(title = si02.title + "."),
                "an enforced_in that is not §2.1's" to si02.copy(enforcedIn = "MAR"),
                "a hazard that does not exist" to si02.copy(hazards = listOf("HAZ-0002", "HAZ-9999")),
                "a hazard list that omits an entry naming the SI" to si02.copy(hazards = emptyList()),
                "a planned test the hazard log does not plan" to si02.copy(plannedTest = "PropertyTest:SI-02-invented"),
                "planned tests that differ from the hazard log" to si02.copy(plannedTests = si02.plannedTests.drop(1)),
                "a backlog ID that does not exist" to si02.copy(backlog = listOf("MED-XXX-99")),
                "a backlog ID of another work package" to si02.copy(backlog = listOf("PLT-CORE-07")),
                "no backlog ID" to si02.copy(backlog = emptyList()),
                "a work package that §21 does not hold" to si02.copy(waitsOn = "WP-9.9"),
                "a known anomaly that does not exist" to si02.copy(knownAnomaly = "KA-999"),
                "a known anomaly other than KA-060" to si02.copy(knownAnomaly = "KA-061"),
                "a domain marker that is not the first watched path" to si02.copy(domainMarker = "backend/modules/orders"),
                "a watched path that leaves the repository" to si02.copy(domainWatch = listOf(DomainWatch("../outside", emptyList()))),
                "a specification-layer machine that does not exist" to si02.withSpec("no-such-machine", "PropertyTest:SI-02-*", "a"),
                "a specification-layer machine that does not serve the SI" to si02.withSpec("result", "PropertyTest:SI-02-*", "a"),
                "a specification-layer property the hazard log does not plan" to
                    si02.withSpec("medication-administration", "PropertyTest:SI-02-x", "a"),
                "a clause the hazard entry does not have" to si02.withSpec("medication-administration", "PropertyTest:SI-02-*", "z"),
            ).forEach { (defect, entry) ->
                test(defect) { problems(entry).shouldNotBeEmpty() }
            }

            test("a register out of SI order") {
                val swapped = register.copy(entries = listOf(register.entries[1], register.entries[0]) + register.entries.drop(2))
                RegisterChecks.problems(swapped, sources).first() shouldContain "SI-01…SI-21"
            }
        }

        context("the reader refuses a malformed register") {
            val text = Files.readString(files.register)
            mapOf(
                "an unknown key" to text.replaceFirst("\"title_source\"", "\"title_sourse\""),
                "a domain layer other than NOT-BUILT or BUILT" to text.replaceFirst("\"NOT-BUILT\"", "\"PARTLY\""),
                "another register version" to text.replaceFirst("\"version\": 1", "\"version\": 2"),
                "a missing key" to text.replaceFirst("\"ka\": \"KA-060\",", ""),
                "an empty string" to text.replaceFirst("\"ka\": \"KA-060\"", "\"ka\": \"\""),
            ).forEach { (defect, malformed) ->
                test(defect) {
                    malformed shouldNotBeSameTextAs text
                    shouldThrow<IllegalArgumentException> { SiRegister.parse(malformed) }
                }
            }
        }
    })

private infix fun String.shouldNotBeSameTextAs(other: String) = (this == other) shouldBe false

private fun SiEntry.withSpec(
    machine: String,
    property: String,
    clause: String,
): SiEntry = copy(specLayer = listOf(SpecLayerProperty(machine, property, listOf(clause), "test fixture")))
