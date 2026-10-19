import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
def rep(a, b):
    global s
    assert a in s, a
    s = s.replace(a, b)
rep("""        internal companion object {
            fun afterRun(
                si: String,
                property: String,
                budget: Int,
                sequences: Int,
            ): Holds = Holds(si, property, budget, sequences)
        }""", """        /** The run behind [DomainRun.run]; the only place that constructs a Holds. */
        companion object {
            /**
             * Runs [property] for [budget] sequences (seeds `seedBase until seedBase + budget`). Holds only when every
             * sequence ran and none violated the SI; the first violation, or a property for another SI, is [Violated].
             */
            fun afterRunning(
                property: DomainProperty,
                si: String,
                budget: Int,
                seedBase: Long,
            ): Verdict {
                require(budget > 0) { "budget must be positive, got $budget" }
                val violation = if (property.si != si) "the domain property ${property.name} checks ${property.si}, not $si" else firstViolation(property, budget, seedBase)
                return if (violation == null) Holds(si, property.name, budget, budget) else Violated(si, violation)
            }

            private fun firstViolation(
                property: DomainProperty,
                budget: Int,
                seedBase: Long,
            ): String? {
                for (offset in 0 until budget) {
                    val seed = seedBase + offset
                    try {
                        property.runSequence(seed)
                    } catch (violation: AssertionError) {
                        return "${property.name} violated ${property.si} at seed $seed: ${violation.message}"
                    }
                }
                return null
            }
        }""")
rep("""    ): Verdict {
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
    }""", """    ): Verdict = Verdict.Holds.afterRunning(property, si, budget, seedBase)""")
rep("""    /**
     * Runs [property] for [budget] sequences (seeds `0 until budget` offset by [seedBase]). Holds only when every one
     * of them ran and none violated the SI; the first violation, or a property for another SI, is [Verdict.Violated].
     */""", """    /** Runs [property] for [budget] sequences; see [Verdict.Holds.afterRunning]. */""")
open(p, "w", encoding="utf-8", newline="\n").write(s)
