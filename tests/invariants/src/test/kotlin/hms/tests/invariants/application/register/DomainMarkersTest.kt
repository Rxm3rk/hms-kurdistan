package hms.tests.invariants.application.register

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.string.shouldContain
import java.nio.file.Files
import java.nio.file.Path

/**
 * The domain-marker trip (docs/specs/modules/state-machines-and-invariants.md §4 rule 3) on a fixture repository: a
 * NOT-BUILT entry whose domain appears must fail.
 */
class DomainMarkersTest :
    FunSpec({
        fun entry(
            vararg watches: DomainWatch,
            layer: DomainLayer = DomainLayer.NOT_BUILT,
        ): SiEntry =
            SiEntry(
                si = "SI-99",
                title = "fixture",
                titleSource = "fixture",
                enforcedIn = "fixture",
                hazards = listOf("HAZ-9999"),
                plannedTest = "PropertyTest:SI-99-*",
                plannedTests = listOf("PropertyTest:SI-99-*"),
                specLayer = emptyList(),
                domainLayer = layer,
                waitsOn = "WP-9.9",
                waitsOnSource = "fixture",
                backlog = listOf("FIX-01"),
                knownAnomaly = "KA-060",
                domainMarker = watches.first().path,
                domainWatch = watches.toList(),
            )

        val roots = mutableListOf<Path>()

        fun repository(vararg directories: String): Path {
            val root = Files.createTempDirectory("si-markers").also { roots += it }
            directories.forEach { Files.createDirectories(root.resolve(it)) }
            return root
        }

        val domain = "backend/modules/fix/src/main/kotlin/hms/fix/domain"

        afterSpec { roots.forEach { it.toFile().deleteRecursively() } }

        test("an absent domain package does not trip") {
            DomainMarkers.tripped(entry(DomainWatch(domain, emptyList())), repository()).shouldBeEmpty()
        }

        test("a fake register entry whose marker exists trips, with the spec's message") {
            val tripped = DomainMarkers.tripped(entry(DomainWatch(domain, emptyList())), repository(domain))
            tripped shouldHaveSize 1
            tripped.single() shouldContain "the domain exists: write the domain-layer test and remove the NOT-BUILT entry"
        }

        test("a watched package holding only its known state-machine packages does not trip") {
            val watch = DomainWatch(domain, listOf("machine"))
            DomainMarkers.tripped(entry(watch), repository("$domain/machine")).shouldBeEmpty()
        }

        test("a watched package that gains anything beyond its known packages trips, naming it") {
            val watch = DomainWatch(domain, listOf("machine"))
            DomainMarkers.tripped(entry(watch), repository("$domain/machine", "$domain/aggregate")).single() shouldContain "[aggregate]"
        }

        test("a watched file trips as soon as it exists, and every tripped watch is reported") {
            val root = repository("frontend/ui")
            Files.writeString(root.resolve("frontend/ui/context.ts"), "export {}")
            val tripped = DomainMarkers.tripped(entry(DomainWatch("frontend/ui/context.ts", emptyList()), DomainWatch("frontend/ui", emptyList())), root)
            tripped shouldHaveSize 2
        }

        test("an entry that says BUILT is not tripped: its domain-layer test runs instead") {
            DomainMarkers.tripped(entry(DomainWatch(domain, emptyList()), layer = DomainLayer.BUILT), repository(domain)).shouldBeEmpty()
        }
    })
