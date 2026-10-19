package hms.kernel.testing.statemachine

import hms.kernel.statemachine.MachineSpec
import hms.kernel.statemachine.Outcome
import io.kotest.property.Arb
import io.kotest.property.RandomSource
import java.util.EnumSet
import kotlin.random.Random

/**
 * Runs `config.budget` random command sequences of [spec] and checks properties P1 to P6 and every [checks] entry after
 * every step (docs/specs/modules/state-machines-and-invariants.md §3.3; BUILD-PROMPT §8.4, §18.3, §19.1).
 *
 * Seeds are drawn from one master seed ([SequenceConfig.masterSeed], or a fresh one). Each sequence builds
 * `RandomSource.seeded(seed)` and draws from it alone: its length (1 to `config.maxSteps`), and at each step a command
 * and fresh facts from [facts]. With probability `config.applicableBias` the command is one with a transition from the
 * current state (when there is one), otherwise any command of the machine. Every sequence starts in `spec.initial`.
 * The loop does not use Kotest's per-iteration machinery, so 10⁶ sequences stay fast.
 *
 * At each step the engine fires first, through [holds]. The harness then evaluates every predicate of the machine
 * once more with [holds] ([Step.holding]) and checks the outcome against that independent evaluation:
 *
 * - P1: the state is one of the machine's states, and the outcome is for the step's state and command;
 * - P2: a transition fired only if every predicate of its guard holds; a refusal names exactly the predicates that do
 *   not hold; a not-applicable command has no candidate;
 * - P3: at most one candidate's guard holds, and the outcome is not Ambiguous;
 * - P4: a refused or not-applicable command leaves the state unchanged and produces no effect;
 * - P5: a transition that leaves a terminal state fired only with `privilegedAndAudited` holding;
 * - P6: the effects produced are exactly the fired transition's effects, and the state is its target.
 *
 * P7 (coverage) is not asserted here: [machineSequenceProperties] asserts it. A violation throws an [AssertionError]
 * naming the run, the property, the master seed, the sequence's seed and the step, followed by the sequence up to the
 * failing step. A completed run writes the counts file ([SequenceCounts]) and returns the counts.
 */
@Suppress("LongParameterList") // The generated and hand-written property tests pass these by name.
fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> runSequences(
    name: String,
    spec: MachineSpec<S, C, P, E>,
    holds: (P, F) -> Boolean,
    facts: Arb<F>,
    config: SequenceConfig = SequenceConfig(),
    checks: List<StepCheck<S, C, P, E, F>> = emptyList(),
): RunStats = SequenceRun(name, spec, holds, facts, config, checks).complete()

/** One run of [runSequences]: its master seed, its counters and the trace of the current sequence. */
internal class SequenceRun<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F>(
    private val name: String,
    private val spec: MachineSpec<S, C, P, E>,
    private val holds: (P, F) -> Boolean,
    private val facts: Arb<F>,
    private val config: SequenceConfig,
    private val checks: List<StepCheck<S, C, P, E, F>>,
) {
    /** The seed every sequence seed is drawn from; printed in every failure message. */
    val masterSeed: Long = config.masterSeed ?: Random.nextLong()

    private val predicates: List<P> = machinePredicates(spec)
    private val properties =
        StepProperties(spec, predicates.firstOrNull { it.name == StepProperties.PRIVILEGED_AND_AUDITED })
    private val applicable: Map<S, List<C>> =
        spec.states.associateWith { state -> spec.commands.filter { spec.candidates(state, it).isNotEmpty() } }
    private val firedPerTransition = LongArray(spec.transitions.size)
    private val trace = ArrayList<Step<S, C, P, E, F>>(config.maxSteps)
    private var sequences = 0
    private var steps = 0L
    private var fired = 0L
    private var refused = 0L
    private var notApplicable = 0L
    private var ambiguous = 0L

    /** Runs every sequence, writes the counts file and returns the counts. */
    fun complete(): RunStats {
        val seeds = Random(masterSeed)
        repeat(config.budget) { sequence -> runSequence(sequence, seeds.nextLong()) }
        val stats =
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
            )
        SequenceCounts.write(stats)
        println(
            "$name: ${stats.sequences} sequences, ${stats.steps} steps, ${stats.transitionsCovered} of " +
                "${stats.transitionsTotal} transitions fired (master seed $masterSeed)",
        )
        return stats
    }

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

    // Any failure inside a step (an Arb, a predicate, the engine) must still name the seed and the step.
    @Suppress("TooGenericExceptionCaught")
    private fun draw(
        sequence: Int,
        seed: Long,
        index: Int,
        state: S,
        source: RandomSource,
    ): Step<S, C, P, E, F> {
        val command = pickCommand(state, source.random)
        try {
            val drawn = facts.sample(source).value
            val outcome = spec.fire(state, command) { holds(it, drawn) }
            return Step(seed, index, state, command, drawn, outcome, holding(drawn))
        } catch (error: RuntimeException) {
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
            if (holds(predicate, drawn)) holding += predicate
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
        val failed =
            properties.violation(step)?.let { (property, detail) -> Failure(property, detail, null) }
                ?: checks.firstNotNullOfOrNull { runCheck(it, step) }
        if (failed != null) throw failure(sequence, step.seed, step.index, failed)
    }

    // A failing check must name the seed and the step whatever it throws.
    @Suppress("TooGenericExceptionCaught")
    private fun runCheck(
        check: StepCheck<S, C, P, E, F>,
        step: Step<S, C, P, E, F>,
    ): Failure? =
        try {
            check.check(step)
            null
        } catch (error: AssertionError) {
            Failure("check '${check.name}'", error.message.orEmpty(), error)
        } catch (error: RuntimeException) {
            Failure("check '${check.name}'", "it threw $error", error)
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
                appendLine("  ${failed.detail}")
                appendLine("  the sequence up to the failing step:")
                trace.forEach { appendLine("    ${describe(it)}") }
            }
        return AssertionError(message.trimEnd(), failed.cause)
    }

    /** What failed: a property or a check, the detail, and the error behind it, if any. */
    private data class Failure(
        val property: String,
        val detail: String,
        val cause: Throwable?,
    )
}

/** Every predicate of the machine: the constants of its predicate enum, found through the guards (none without guards). */
private fun <P : Enum<P>> machinePredicates(spec: MachineSpec<*, *, P, *>): List<P> {
    val any = spec.transitions.firstNotNullOfOrNull { it.guard.firstOrNull() } ?: return emptyList()
    return any.declaringJavaClass.enumConstants.toList()
}
