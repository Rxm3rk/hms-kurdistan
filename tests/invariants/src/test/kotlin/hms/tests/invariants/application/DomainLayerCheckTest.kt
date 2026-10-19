package hms.tests.invariants.application

import hms.tests.invariants.api.DomainProbe
import hms.tests.invariants.api.DomainProperty
import hms.tests.invariants.api.DomainRun
import hms.tests.invariants.api.Verdict
import hms.tests.invariants.application.register.DomainLayer
import hms.tests.invariants.application.register.SiRegister
import hms.tests.invariants.application.register.SiSources
import hms.tests.invariants.application.register.SourceFiles
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.engine.spec.tempdir
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf
import java.nio.file.Files

/**
 * The domain-layer reporting rule (docs/specs/modules/state-machines-and-invariants.md §4): a probe can never return
 * Holds without a real domain property behind it, a NOT-BUILT entry passes only while it is complete and its domain is
 * absent, and a fake entry whose domain marker exists fails.
 */
class DomainLayerCheckTest :
    FunSpec({
        val files = SourceFiles.fromSystemProperties()
        val register = SiRegister.parse(Files.readString(files.register))
        val sources = SiSources.read(files)
        val si02 = register.entry("SI-02")

        fun property(
            si: String,
            violateAt: Long? = null,
        ): DomainProperty =
            object : DomainProperty {
                val seeds = mutableListOf<Long>()
                override val si = si
                override val name = "PropertyTest:$si-fixture"

                override fun runSequence(seed: Long) {
                    seeds += seed
                    if (seed == violateAt) throw AssertionError("fixture violation")
                }
            }

        test("Verdict.Holds has no public constructor: only a run of a domain property produces it") {
            Verdict.Holds::class.java.constructors.size shouldBe 0
        }

        test("every SI's probe returns NotBuilt with the entry's backlog IDs, hazards, work package and KA-060") {
            register.entries.forEach { entry ->
                withClue(entry.si) {
                    DomainProbes.forEntry(entry).verdict(budget = 1000) shouldBe
                        Verdict.NotBuilt(entry.si, entry.backlog, entry.hazards, entry.waitsOn, "KA-060")
                }
            }
        }

        test("no domain-layer property is registered yet (KA-060)") {
            DomainProperties.all.keys.shouldBeEmpty()
        }

        test("every SI's domain-layer check passes as NOT-BUILT on this repository and never as Holds") {
            register.entries.forEach { entry ->
                withClue(entry.si) {
                    DomainLayerCheck.verify(entry, sources, files.repositoryRoot, budget = 1000).shouldBeInstanceOf<Verdict.NotBuilt>()
                }
            }
        }

        test("a run holds only after every sequence of the budget ran without a violation") {
            val verdict = DomainRun.run(property("SI-02"), "SI-02", budget = 50)
            verdict.shouldBeInstanceOf<Verdict.Holds>()
            verdict.sequences shouldBe 50
        }

        test("a violation, or a property of another SI, is Violated, never Holds") {
            DomainRun.run(property("SI-02", violateAt = 7), "SI-02", budget = 50).shouldBeInstanceOf<Verdict.Violated>().reason shouldContain "seed 7"
            DomainRun.run(property("SI-13"), "SI-02", budget = 50).shouldBeInstanceOf<Verdict.Violated>()
            shouldThrow<IllegalArgumentException> { DomainRun.run(property("SI-02"), "SI-02", budget = 0) }
        }

        test("a register entry that says BUILT with no domain property fails closed") {
            DomainProbe.Missing("SI-02").verdict(1000).shouldBeInstanceOf<Verdict.Violated>()
            val built = si02.copy(domainLayer = DomainLayer.BUILT)
            shouldThrow<AssertionError> { DomainLayerCheck.verify(built, sources, files.repositoryRoot, budget = 10) }
                .message shouldContain "no domain-layer property exists"
        }

        test("a BUILT entry passes only with a holding domain property, and fails on a violation") {
            val built = si02.copy(domainLayer = DomainLayer.BUILT)
            DomainLayerCheck
                .verify(built, sources, files.repositoryRoot, budget = 10, properties = mapOf("SI-02" to property("SI-02")))
                .shouldBeInstanceOf<Verdict.Holds>()
            shouldThrow<AssertionError> {
                DomainLayerCheck.verify(built, sources, files.repositoryRoot, budget = 10, properties = mapOf("SI-02" to property("SI-02", 3)))
            }.message shouldContain "did not hold"
        }

        test("a NOT-BUILT entry with a registered domain property fails: it must be run and marked BUILT") {
            shouldThrow<AssertionError> {
                DomainLayerCheck.verify(si02, sources, files.repositoryRoot, budget = 10, properties = mapOf("SI-02" to property("SI-02")))
            }.message shouldContain "mark the entry BUILT"
        }

        test("a fake NOT-BUILT entry whose domain marker exists fails, naming the domain-layer test") {
            val root = tempdir().toPath()
            Files.createDirectories(root.resolve(si02.domainMarker).resolve("mar"))
            val failure = shouldThrow<AssertionError> { DomainLayerCheck.verify(si02, sources, root, budget = 10) }
            failure.message shouldContain "SI-02 domain layer NOT-BUILT (waits on WP-3.3; KA-060)"
            failure.message shouldContain "the domain exists: write the domain-layer test and remove the NOT-BUILT entry"
        }

        test("an incomplete NOT-BUILT entry fails even though its probe says NotBuilt") {
            shouldThrow<AssertionError> {
                DomainLayerCheck.verify(si02.copy(backlog = listOf("NO-SUCH-01")), sources, files.repositoryRoot, budget = 10)
            }.message shouldContain "NO-SUCH-01"
        }
    })
