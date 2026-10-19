package hms.tests.invariants.api

/**
 * What an SI's domain-layer probe found (docs/specs/modules/state-machines-and-invariants.md §4; BUILD-PROMPT §3.5).
 *
 * [Holds] has no public constructor: the only way to obtain one is [DomainRun.run], which executes a real
 * [DomainProperty] once per sequence of the budget and counts the sequences itself. No probe, stub or test can return
 * Holds without that run.
 */
sealed interface Verdict {
    /** The SI the verdict is about ("SI-02"). */
    val si: String

    /**
     * The SI's domain does not exist; the test fails closed and names what it waits on (spec §4 rules 1 and 2).
     *
     * @property backlog Backlog IDs of the work that builds the domain.
     * @property hazards The hazard-log entries of the SI.
     * @property waitsOn The §21 work package (or phase) that builds the domain.
     * @property knownAnomaly The known anomaly that lists it (KA-060).
     */
    data class NotBuilt(
        override val si: String,
        val backlog: List<String>,
        val hazards: List<String>,
        val waitsOn: String,
        val knownAnomaly: String,
    ) : Verdict

    /** A domain property ran [sequences] sequences of a budget of [budget] with no violation. */
    class Holds private constructor(
        override val si: String,
        val property: String,
        val budget: Int,
        val sequences: Int,
    ) : Verdict {
        override fun toString(): String = "Holds(si=$si, property=$property, sequences=$sequences of $budget)"

        internal companion object {
            fun afterRun(
                si: String,
                property: String,
                budget: Int,
                sequences: Int,
            ): Holds = Holds(si, property, budget, sequences)
        }
    }

    /** The domain layer did not hold, or could not be shown to hold: [reason] says why. A failing verdict. */
    data class Violated(
        override val si: String,
        val reason: String,
    ) : Verdict
}

/**
 * A domain-layer property of an SI: one random command sequence, from [seed], through the real domain (spec §4,
 * BUILD-PROMPT §18.3). It throws an [AssertionError] when the SI is violated. The scaffold has none yet: every SI's
 * domain layer is NOT-BUILT (KA-060).
 */
interface DomainProperty {
    /** The SI it checks. */
    val si: String

    /** The hazard log's planned test name it implements. */
    val name: String

    /** Runs one sequence from [seed] and asserts the SI after every step. */
    fun runSequence(seed: Long)
}

/** The only producer of [Verdict.Holds]. */
object DomainRun {
    /**
     * Runs [property] for [budget] sequences (seeds `0 until budget` offset by [seedBase]). Holds only when every one
     * of them ran and none violated the SI; the first violation, or a property for another SI, is [Verdict.Violated].
     */
    fun run(
        property: DomainProperty,
        si: String,
        budget: Int,
        seedBase: Long = 0,
    ): Verdict {
        require(budget > 0) { "budget must be positive, got $budget" }
        if (property.si != si) return Verdict.Violated(si, "the domain property ${property.name} checks ${property.si}, not $si")
        var sequences = 0
        for (offset in 0 until budget) {
            val seed = seedBase + offset
            try {
                property.runSequence(seed)
            } catch (violation: AssertionError) {
                return Verdict.Violated(si, "${property.name} violated $si at seed $seed: ${violation.message}")
            }
            sequences++
        }
        check(sequences == budget) { "ran $sequences of $budget sequences" }
        return Verdict.Holds.afterRun(si, property.name, budget, sequences)
    }
}

/** How a domain-layer test finds its verdict (spec §4 rule 2). */
sealed interface DomainProbe {
    /** The verdict at [budget] sequences. */
    fun verdict(budget: Int): Verdict

    /** The domain does not exist: the probe returns [Verdict.NotBuilt] and nothing else. */
    data class NotBuilt(
        val notBuilt: Verdict.NotBuilt,
    ) : DomainProbe {
        override fun verdict(budget: Int): Verdict = notBuilt
    }

    /** The domain exists and [property] is its test: the verdict is whatever [DomainRun.run] finds. */
    class Built(
        private val si: String,
        private val property: DomainProperty,
    ) : DomainProbe {
        override fun verdict(budget: Int): Verdict = DomainRun.run(property, si, budget)
    }

    /** The register says the domain exists but no domain property is registered for it: fails closed. */
    data class Missing(
        val si: String,
    ) : DomainProbe {
        override fun verdict(budget: Int): Verdict =
            Verdict.Violated(si, "the register says the domain layer is BUILT, but no domain-layer property exists for $si")
    }
}
