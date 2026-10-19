package hms.tests.invariants.application

import hms.tests.invariants.api.DomainProbe
import hms.tests.invariants.api.DomainProperty
import hms.tests.invariants.api.Verdict
import hms.tests.invariants.application.register.DomainLayer
import hms.tests.invariants.application.register.DomainMarkers
import hms.tests.invariants.application.register.RegisterChecks
import hms.tests.invariants.application.register.SiEntry
import hms.tests.invariants.application.register.SiSources
import java.nio.file.Path

/** The domain-layer properties that exist, by SI. None yet: no SI's domain exists (KA-060). */
object DomainProperties {
    /** The registered domain-layer properties; the work package that builds an SI's domain adds its property here. */
    val all: Map<String, DomainProperty> = emptyMap()
}

/** The probe of an SI's domain layer (spec §4 rule 2): NOT-BUILT from its register entry, or the registered property. */
object DomainProbes {
    fun forEntry(
        entry: SiEntry,
        properties: Map<String, DomainProperty> = DomainProperties.all,
    ): DomainProbe =
        when (entry.domainLayer) {
            DomainLayer.NOT_BUILT -> {
                DomainProbe.NotBuilt(Verdict.NotBuilt(entry.si, entry.backlog, entry.hazards, entry.waitsOn, entry.knownAnomaly))
            }

            DomainLayer.BUILT -> {
                properties[entry.si]?.let { DomainProbe.Built(entry.si, it) } ?: DomainProbe.Missing(entry.si)
            }
        }
}

/**
 * The body of every SI's domain-layer test (docs/specs/modules/state-machines-and-invariants.md §4, rules 1 to 3).
 * A NOT-BUILT entry passes only when its probe returns [Verdict.NotBuilt] with the entry's backlog IDs, hazards, work
 * package and known anomaly, the entry is complete against its sources, no domain property is registered for it and no
 * watched domain path has appeared. A BUILT entry passes only when its domain property ran the whole budget without a
 * violation ([Verdict.Holds]). Anything else throws an [AssertionError] that lists every problem.
 */
object DomainLayerCheck {
    /** The outcome of a passing check: the verdict and whether a watched path tripped (always false when it passes). */
    fun verify(
        entry: SiEntry,
        sources: SiSources,
        repositoryRoot: Path,
        budget: Int,
        properties: Map<String, DomainProperty> = DomainProperties.all,
    ): Verdict {
        val verdict = DomainProbes.forEntry(entry, properties).verdict(budget)
        val problems =
            RegisterChecks.problems(entry, sources) +
                DomainMarkers.tripped(entry, repositoryRoot) +
                verdictProblems(entry, verdict, properties)
        if (problems.isNotEmpty()) {
            throw AssertionError("${entry.domainTestName}:\n" + problems.joinToString("\n") { "- $it" })
        }
        return verdict
    }

    private fun verdictProblems(
        entry: SiEntry,
        verdict: Verdict,
        properties: Map<String, DomainProperty>,
    ): List<String> =
        when (entry.domainLayer) {
            DomainLayer.NOT_BUILT -> {
                listOfNotNull(
                    "the probe returned $verdict, not NotBuilt".takeIf { verdict !is Verdict.NotBuilt },
                    "a domain-layer property is registered for ${entry.si} while the register says NOT-BUILT: run it and mark the entry BUILT"
                        .takeIf { entry.si in properties },
                )
            }

            DomainLayer.BUILT -> {
                listOfNotNull("the domain layer did not hold: $verdict".takeIf { verdict !is Verdict.Holds })
            }
        }
}
