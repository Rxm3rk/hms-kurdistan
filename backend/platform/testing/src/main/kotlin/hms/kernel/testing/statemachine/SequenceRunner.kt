package hms.kernel.testing.statemachine

import hms.kernel.statemachine.MachineSpec
import hms.kernel.statemachine.Outcome
import hms.kernel.testing.PropertyTestBudget
import io.kotest.core.spec.Spec
import io.kotest.property.Arb
import io.kotest.property.RandomSource
import java.util.EnumSet
import kotlin.random.Random

/**
 * Runs `config.budget` random command sequences of [spec] and checks properties P1 to P6 and every [checks] entry after
 * every step (docs/specs/modules/state-machines-and-invariants.md §3.3, §4; BUILD-PROMPT §8.4, §18.3, §19.1).
 *
 * Seeds are drawn from one master seed ([SequenceConfig.masterSeed]: `-Phms.pbt.seed`, or a fresh one). Each sequence
 * builds `RandomSource.seeded(seed)` and draws from it alone: its length (1 to `config.maxSteps`), and at each step a
 * command and fresh facts from [facts]. With probability `config.applicableBias` the command is one with a transition
 * from the current state (when there is one), otherwise any command of the machine. Every sequence starts in
 * `spec.initial`. The loop does not use Kotest's per-iteration machinery, so 10⁶ sequences stay fast.
 *
 * At each step the engine fires first, through [holds]. The harness then evaluates every predicate of the machine
 * once more with [holds] ([Step.holding]) and checks the outcome against that independent evaluation:
 *
 * - P1: the state is one of the machine's states, and the outcome is for the step's state and command;
 * - P2: a transition fired only if every predicate of its guard holds; a refusal names exactly the predicates that do
 *   not hold; a not-applicable command has no candidate;
 * - P3: at most one candidate's guard holds, and the outcome is not Ambiguous; checked with the step's facts for every
 *   (state, command) pair that has two or more candidates, not only the step's own;
 * - P4: a refused or not-applicable command leaves the state unchanged and produces no effect;
 * - P5: a transition that leaves a terminal state fired only with `privilegedAndAudited` holding;
 * - P6: the effects produced are exactly the fired transition's effects, and the state is its target.
 *
 * Against this engine P1's first clause, P4 and P6 hold by construction; see [StepProperties] for what each property
 * can and cannot catch. Each check runs only on the steps its [StepCheck.appliesTo] accepts.
 *
 * When `config.budget` is at least `config.coverageFromBudget` the run must also be evidence: it fails when no step
 * fired, or when a check applied to no step ("vacuous: <name> never applied"). P7 is not asserted here:
 * [machineSequenceProperties] asserts it; a property that needs particular transitions calls [RunStats.requireFired].
 *
 * A violation throws an [AssertionError] naming the run, the property, the master seed, the sequence's seed and the
 * step, the sequence up to the failing step, and the Gradle command that replays the run. Any other [Throwable] from
 * the facts generator, a predicate, the engine or a check, except a [VirtualMachineError], is wrapped the same way.
 * The counts file ([SequenceCounts]) is written whether the run passed or failed.
 */
@Suppress("LongParameterList") // The generated and hand-written property tests pass these by name.
fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> runSequences(
    name: String,
    spec: MachineSpec<S, C, P, E>,
    holds: (P, F) -> Boolean,
    facts: Arb<F>,
    config: SequenceConfig = SequenceConfig(),
    checks: List<StepCheck<S, C, P, E, F>> = emptyList(),
): RunStats = SequenceRun(name, spec, holds, facts, config, checks, callingTestClass()).complete(machineCoverage = false)

/** System property naming the Gradle test task (`:modules:adt:propertyTest`), set by `hms.test-conventions`. */
internal const val TEST_TASK_PROPERTY: String = "hms.pbt.testTask"

/** One run of [runSequences]: its master seed, its counters and the trace of the current sequence. */
@Suppress("LongParameterList", "TooManyFunctions") // The run's inputs; one function per stage of a step.
internal class SequenceRun<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F>(
    private val name: String,
    private val spec: MachineSpec<S, C, P, E>,
    private val holds: (P, F) -> Boolean,
    private val facts: Arb<F>,
    private val config: SequenceConfig,
    private val checks: List<StepCheck<S, C, P, E, F>>,
    private val testClass: String?,
) {
    /** The seed every sequence seed is drawn from; printed in every failure message. */
    val masterSeed: Long = config.masterSeed ?: Random.nextLong()

    private val predicates: List<P> = machinePredicates(spec)
    private val properties =
        StepProperties(spec, predicates.firstOrNull { it.name == StepProperties.PRIVILEGED_AND_AUDITED })
    private val applicable: Map<S, List<C>> =
        spec.states.associateWith { state -> spec.commands.filter { spec.candidates(state, it).isNotEmpty() } }
    private val firedPerTransition = LongArray(spec.transitions.size)
    private val checkApplied = LongArray(checks.size)
    private val predicateHeld = LongArray(predicates.size)
    private val predicateFailed = LongArray(predicates.size)
    private val trace = ArrayList<Step<S, C, P, E, F>>(config.maxSteps)
    private var sequences = 0
    private var steps = 0L
    private var fired = 0L
    private var refused = 0L
    private var notApplicable = 0L
    private var ambiguous = 0L

    init {
        val duplicates = checks.groupBy { it.name }.filterValues { it.size > 1 }.keys
        require(duplicates.isEmpty()) { "$name: every StepCheck needs its own name; $duplicates are used twice" }
    }

    /**
     * Runs every sequence and, from `coverageFromBudget` on, the end-of-run checks: in every run, that a step fired and
     * every check applied; with [machineCoverage], also P7 and that every predicate both held and failed. Writes the
     * counts file, passed or failed, and returns the counts.
     */
    fun complete(machineCoverage: Boolean): RunStats {
        val seeds = Random(masterSeed)
        val result =
            runCatching {
                repeat(config.budget) { sequence -> runSequence(sequence, seeds.nextLong()) }
                val stats = stats()
                if (config.budget >= config.coverageFromBudget) {
                    val gaps = vacuity(stats) + if (machineCoverage) coverage(stats) else emptyList()
                    if (gaps.isNotEmpty()) throw endOfRunFailure(stats, gaps)
                }
                stats
            }
        val error = result.exceptionOrNull()
        if (error == null) {
            val stats = result.getOrThrow()
            SequenceCounts.write(stats, SequenceCounts.PASS)
            println(
                "$name: ${stats.sequences} sequences, ${stats.steps} steps, ${stats.transitionsCovered} of " +
                    "${stats.transitionsTotal} transitions fired (master seed $masterSeed)",
            )
            return stats
        }
        if (error !is VirtualMachineError) {
            runCatching { SequenceCounts.write(stats(), SequenceCounts.FAIL) }.exceptionOrNull()?.let(error::addSuppressed)
        }
        throw error
    }

    private fun stats(): RunStats =
        RunStats(
            name = name,
            machine = spec.machine,
            budget = config.budget,
            sequences = sequences,
            steps = steps,
            fired = fired,
            refused = refused,
            notApplicable = notApplicable,
            ambiguous = ambiguous,
            transitionsCovered = firedPerTransition.count { it > 0 },
            transitionsTotal = firedPerTransition.size,
            firedPerTransition = firedPerTransition.toList(),
            checkApplied = checks.indices.associate { checks[it].name to checkApplied[it] },
            predicateHeld = predicateHeld.toList(),
            predicateFailed = predicateFailed.toList(),
            masterSeed = masterSeed,
        )

    /** Why a run of [runSequences] is not evidence: nothing fired, or a check never applied. */
    private fun vacuity(stats: RunStats): List<String> =
        buildList {
            if (stats.fired == 0L) add("vacuous: no step fired in ${stats.sequences} sequences (${stats.steps} steps)")
            checks.indices.filter { checkApplied[it] == 0L }.forEach { add("vacuous: ${checks[it].name} never applied") }
        }

    /** The machine-level coverage gaps: P7, and predicates that never failed or never held. */
    private fun coverage(stats: RunStats): List<String> =
        buildList {
            val neverFired = spec.transitions.filter { stats.firedPerTransition[it.index] == 0L }
            if (neverFired.isNotEmpty()) {
                add(
                    "P7 (every transition fires at least once) failed: ${neverFired.size} of ${stats.transitionsTotal} " +
                        "transitions never fired in ${stats.sequences} sequences:",
                )
                neverFired.forEach { add("  ${describe(it)}") }
            }
            val alwaysTrue = predicates.filter { predicateFailed[it.ordinal] == 0L }
            val alwaysFalse = predicates.filter { predicateHeld[it.ordinal] == 0L }
            if (alwaysTrue.isNotEmpty()) add("predicate coverage: $alwaysTrue held at every step (never false)")
            if (alwaysFalse.isNotEmpty()) add("predicate coverage: $alwaysFalse never held")
        }

    private fun endOfRunFailure(
        stats: RunStats,
        gaps: List<String>,
    ): AssertionError =
        AssertionError(
            buildString {
                appendLine(
                    "$name (machine ${spec.machine}): the run is not evidence: ${stats.sequences} sequences, ${stats.steps} steps " +
                        "(master seed $masterSeed; checked from ${config.coverageFromBudget} sequences):",
                )
                gaps.forEach { appendLine("  $it") }
                appendLine(
                    "  Bias the facts generator (<P>Arbs.facts) so that every guard and every check's antecedent holds often " +
                        "enough, and every predicate is sometimes false (spec §3.3).",
                )
                append("  ${replay()}")
            },
        )

    private fun runSequence(
        sequence: Int,
        seed: Long,
    ) {
        val source = RandomSource.seeded(seed)
        val length = source.random.nextInt(1, config.maxSteps + 1)
        trace.clear()
        var state = spec.initial
        for (index in 0 until length) {
            val step = draw(sequence, seed, index, state, source)
            trace += step
            count(step.outcome)
            verify(sequence, step)
            state = step.outcome.state
        }
        sequences += 1
    }

    private fun draw(
        sequence: Int,
        seed: Long,
        index: Int,
        state: S,
        source: RandomSource,
    ): Step<S, C, P, E, F> {
        val command = pickCommand(state, source.random)
        return attempt({
            val drawn = facts.sample(source).value
            val outcome = spec.fire(state, command) { holds(it, drawn) }
            Step(seed, index, state, command, drawn, outcome, holding(drawn))
        }) { error ->
            throw failure(sequence, seed, index, Failure("the step", "applying $command in $state threw $error", error))
        }
    }

    private fun pickCommand(
        state: S,
        random: Random,
    ): C {
        val choices = applicable[state].orEmpty()
        val pool = if (choices.isNotEmpty() && random.nextDouble() < config.applicableBias) choices else spec.commands
        return pool[random.nextInt(pool.size)]
    }

    private fun holding(drawn: F): Set<P> {
        if (predicates.isEmpty()) return emptySet()
        val holding = EnumSet.noneOf(predicates.first().declaringJavaClass)
        for (predicate in predicates) {
            if (holds(predicate, drawn)) {
                holding += predicate
                predicateHeld[predicate.ordinal] += 1
            } else {
                predicateFailed[predicate.ordinal] += 1
            }
        }
        return holding
    }

    private fun count(outcome: Outcome<S, C, P, E>) {
        steps += 1
        when (outcome) {
            is Outcome.Fired -> {
                fired += 1
                firedPerTransition[outcome.transition.index] += 1
            }

            is Outcome.Refused -> {
                refused += 1
            }

            is Outcome.NotApplicable -> {
                notApplicable += 1
            }

            is Outcome.Ambiguous -> {
                ambiguous += 1
            }
        }
    }

    private fun verify(
        sequence: Int,
        step: Step<S, C, P, E, F>,
    ) {
        properties.violation(step)?.let { (property, detail) ->
            throw failure(sequence, step.seed, step.index, Failure(property, detail, null))
        }
        checks.forEachIndexed { position, check -> runCheck(position, check, sequence, step) }
    }

    private fun runCheck(
        position: Int,
        check: StepCheck<S, C, P, E, F>,
        sequence: Int,
        step: Step<S, C, P, E, F>,
    ) {
        val label = "check '${check.name}'"
        val applies =
            attempt({ check.appliesTo(step) }) { error ->
                throw failure(sequence, step.seed, step.index, Failure(label, "its appliesTo threw $error", error))
            }
        if (!applies) return
        checkApplied[position] += 1
        attempt({ check.check(step) }) { error ->
            val detail = if (error is AssertionError) error.message.orEmpty() else "it threw $error"
            throw failure(sequence, step.seed, step.index, Failure(label, detail, error))
        }
    }

    private fun failure(
        sequence: Int,
        seed: Long,
        index: Int,
        failed: Failure,
    ): AssertionError {
        val message =
            buildString {
                appendLine(
                    "$name (machine ${spec.machine}): ${failed.property} failed at step $index of sequence $sequence " +
                        "(both 0-based; ${config.budget} sequences budgeted)",
                )
                appendLine("  sequence seed $seed, master seed $masterSeed: SequenceConfig(masterSeed = $masterSeed) replays the run")
                appendLine("  ${replay()}")
                appendLine("  ${failed.detail}")
                appendLine("  the sequence up to the failing step:")
                trace.forEach { appendLine("    ${describe(it)}") }
            }
        return AssertionError(message.trimEnd(), failed.cause)
    }

    /** The Gradle command (run from `backend/`) that replays this run: same test, master seed and budget. */
    private fun replay(): String {
        val task = System.getProperty(TEST_TASK_PROPERTY)?.takeIf { it.isNotBlank() } ?: "<project>:propertyTest"
        val tests = testClass ?: "<the test class>"
        return "replay (from backend/): ./gradlew $task --tests '$tests' -P${SequenceConfig.SEED_PROPERTY}=$masterSeed " +
            "-P${PropertyTestBudget.SYSTEM_PROPERTY}=${config.budget}"
    }

    /** What failed: a property or a check, the detail, and the error behind it, if any. */
    private data class Failure(
        val property: String,
        val detail: String,
        val cause: Throwable?,
    )
}

/**
 * Runs [block] and returns its value. Any [Throwable] it throws, except a [VirtualMachineError] (out of memory, stack
 * overflow, internal error), goes to [onError], which throws the failure that names the seed and the step (spec §3.3).
 */
private inline fun <T> attempt(
    block: () -> T,
    onError: (Throwable) -> Nothing,
): T {
    val result = runCatching(block)
    val error = result.exceptionOrNull() ?: return result.getOrThrow()
    if (error is VirtualMachineError) throw error
    onError(error)
}

/** Every predicate of the machine: the constants of its predicate enum, found through the guards (none without guards). */
private fun <P : Enum<P>> machinePredicates(spec: MachineSpec<*, *, P, *>): List<P> {
    val any = spec.transitions.firstNotNullOfOrNull { it.guard.firstOrNull() } ?: return emptyList()
    return any.declaringJavaClass.enumConstants.toList()
}

/** The Kotest spec class on the call stack (the test that called the harness), for the replay command; null if none. */
internal fun callingTestClass(): String? =
    StackWalker
        .getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE)
        .walk { frames ->
            frames
                .map { outermost(it.declaringClass) }
                .filter { Spec::class.java.isAssignableFrom(it) }
                .findFirst()
                .orElse(null)
        }?.name

private tailrec fun outermost(type: Class<*>): Class<*> {
    val enclosing = type.enclosingClass ?: return type
    return outermost(enclosing)
}
