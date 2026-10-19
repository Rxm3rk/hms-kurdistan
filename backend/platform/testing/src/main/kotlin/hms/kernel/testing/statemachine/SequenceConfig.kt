package hms.kernel.testing.statemachine

import hms.kernel.testing.PropertyTestBudget

/**
 * How [runSequences] drives a machine (docs/specs/modules/state-machines-and-invariants.md §3.3; BUILD-PROMPT §18.3, §19.1).
 *
 * @property budget The number of random command sequences: [PropertyTestBudget.sequences] by default (1,000 in the fast
 *   tier, 10⁶ nightly). Property tests never hard-code it.
 * @property maxSteps The longest sequence. Each sequence has a random length from 1 to [maxSteps].
 * @property applicableBias The share of steps that pick a command with a transition from the current state (when the
 *   state has one). The other steps pick any command of the machine, creation commands included.
 * @property coverageFromBudget From this budget on, a run must also be evidence: P7 (every transition fired) and the
 *   predicate-coverage check in [machineSequenceProperties], and in [runSequences] at least one step fired and every
 *   [StepCheck] applied at least once.
 * @property masterSeed The seed from which every sequence's seed is drawn. By default the system property
 *   [SEED_PROPERTY] (`-Phms.pbt.seed=N` through Gradle's `hms.test-conventions`), or a fresh seed per run when it is
 *   absent. Every failure message prints the master seed in use and the Gradle command that replays the run.
 */
data class SequenceConfig(
    val budget: Int = PropertyTestBudget.sequences(),
    val maxSteps: Int = DEFAULT_MAX_STEPS,
    val applicableBias: Double = DEFAULT_APPLICABLE_BIAS,
    val coverageFromBudget: Int = DEFAULT_COVERAGE_FROM_BUDGET,
    val masterSeed: Long? = configuredMasterSeed(),
) {
    init {
        require(budget > 0) { "budget must be positive, got $budget" }
        require(maxSteps > 0) { "maxSteps must be positive, got $maxSteps" }
        require(applicableBias in 0.0..1.0) { "applicableBias must be between 0 and 1, got $applicableBias" }
        require(coverageFromBudget > 0) { "coverageFromBudget must be positive, got $coverageFromBudget" }
    }

    /** The defaults of spec §3.3 and the replay seed. */
    companion object {
        /** Sequences have 1 to 32 steps (spec §3.3). */
        const val DEFAULT_MAX_STEPS: Int = 32

        /** Most steps pick a command that has a transition from the current state (spec §3.3: "mostly"). */
        const val DEFAULT_APPLICABLE_BIAS: Double = 0.85

        /** P7 is asserted from 1,000 sequences, the fast-tier budget (spec §3.3). */
        const val DEFAULT_COVERAGE_FROM_BUDGET: Int = 1000

        /** System property (and Gradle property) fixing the master seed, to replay a failed run. */
        const val SEED_PROPERTY: String = "hms.pbt.seed"

        /** The master seed fixed by [SEED_PROPERTY], or null when it is absent or blank. */
        fun configuredMasterSeed(): Long? = parseSeed(System.getProperty(SEED_PROPERTY))

        /** Parses a seed value: absent or blank means none; anything but a whole number is an error. */
        fun parseSeed(raw: String?): Long? {
            if (raw.isNullOrBlank()) return null
            return requireNotNull(raw.trim().toLongOrNull()) { "$SEED_PROPERTY must be a whole number (a master seed), got '$raw'" }
        }
    }
}
