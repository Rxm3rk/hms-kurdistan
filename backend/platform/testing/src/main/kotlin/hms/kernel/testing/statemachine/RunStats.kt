package hms.kernel.testing.statemachine

/**
 * The counts of one [runSequences] run (docs/specs/modules/state-machines-and-invariants.md §3.3; BUILD-PROMPT §19.1
 * "record the actual sequence counts"). The counts file holds the same numbers.
 *
 * @property name The run's name (the test's).
 * @property machine The machine's name.
 * @property budget The sequences asked for.
 * @property sequences The sequences run; equals [budget] for a completed run.
 * @property steps The steps run, over every sequence.
 * @property fired The steps whose outcome was Fired.
 * @property refused The steps whose outcome was Refused.
 * @property notApplicable The steps whose outcome was NotApplicable.
 * @property ambiguous The steps whose outcome was Ambiguous (a completed run has none: property P3).
 * @property transitionsCovered The transitions that fired at least once.
 * @property transitionsTotal The machine's transitions.
 * @property firedPerTransition How often each transition fired, by transition index.
 * @property checkApplied For each [StepCheck], by name: the steps it applied to (its `appliesTo` was true).
 * @property predicateHeld For each predicate of the machine, by the ordinal of its enum constant: the steps whose facts
 *   made it hold.
 * @property predicateFailed For each predicate, by ordinal: the steps whose facts made it fail.
 * @property masterSeed The seed every sequence seed was drawn from: `-Phms.pbt.seed=<masterSeed>` replays the run.
 */
data class RunStats(
    val name: String,
    val machine: String,
    val budget: Int,
    val sequences: Int,
    val steps: Long,
    val fired: Long,
    val refused: Long,
    val notApplicable: Long,
    val ambiguous: Long,
    val transitionsCovered: Int,
    val transitionsTotal: Int,
    val firedPerTransition: List<Long>,
    val checkApplied: Map<String, Long>,
    val predicateHeld: List<Long>,
    val predicateFailed: List<Long>,
    val masterSeed: Long,
) {
    /**
     * Asserts that each of [transitionIndexes] fired at least once in this run. A property test that needs certain
     * transitions to have happened (an SI property about the override path, say) calls it, so that it cannot pass
     * without them (spec §4). It asserts whatever the budget: call it in tests whose budget reaches those transitions.
     *
     * @throws AssertionError naming every listed transition that fired zero times, the run and its master seed.
     * @throws IllegalArgumentException when no index is given or an index is not one of the machine's transitions.
     */
    fun requireFired(vararg transitionIndexes: Int) {
        require(transitionIndexes.isNotEmpty()) { "$name: requireFired needs at least one transition index" }
        val unknown = transitionIndexes.filter { it !in firedPerTransition.indices }
        require(unknown.isEmpty()) {
            "$name (machine $machine): $unknown are not transition indexes (0 to ${firedPerTransition.size - 1})"
        }
        val neverFired = transitionIndexes.distinct().filter { firedPerTransition[it] == 0L }
        if (neverFired.isNotEmpty()) {
            throw AssertionError(
                "$name (machine $machine): ${neverFired.joinToString { "transition $it" }} never fired in $sequences " +
                    "sequences (master seed $masterSeed), so the property that needs them was not exercised",
            )
        }
    }
}
