package hms.tests.invariants

import hms.kernel.statemachine.MachineSpec
import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import io.kotest.property.Arb

/**
 * One specification-layer property of an SI on one machine (docs/specs/modules/state-machines-and-invariants.md §4).
 *
 * @property appliesTo The steps the property speaks about. The harness fails a run in which it applied to no step.
 * @property about The transitions the property is about; the run fails unless each of them fired.
 * @property check The assertion on each step it applies to; throws an [AssertionError] on a violation.
 */
internal class SpecLayerCheck<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F>(
    val appliesTo: (Step<S, C, P, E, F>) -> Boolean,
    val about: (Transition<S, C, P, E>) -> Boolean,
    val check: (Step<S, C, P, E, F>) -> Unit,
)

/**
 * The specification-layer properties one machine encodes, keyed by the test names the hazard log plans. [run] drives
 * the machine's generated model with its real predicate implementation over its facts generator for the property
 * budget of random command sequences (`hms.pbt.sequences`), asserts the property after every step it applies to and
 * returns the number of sequences run.
 */
internal class MachineSpecLayer<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F>(
    val spec: MachineSpec<S, C, P, E>,
    private val holds: (P, F) -> Boolean,
    private val facts: Arb<F>,
    private val properties: Map<String, SpecLayerCheck<S, C, P, E, F>>,
) {
    /** The machine's name. */
    val machine: String get() = spec.machine

    /** Runs [property] and returns the sequences run; fails on a violation, a vacuous check or a transition that never fired. */
    fun run(property: String): Int {
        val definition = properties[property] ?: throw IllegalArgumentException("$machine has no specification-layer property $property")
        val name = "$property ($machine)"
        val stats = runSequences(name, spec, holds, facts, checks = listOf(StepCheck(property, definition.appliesTo, definition.check)))
        val required = spec.transitions.filter(definition.about).map { it.index }
        check(required.isNotEmpty()) { "$name: no transition of $machine is one the property is about" }
        stats.requireFired(*required.toIntArray())
        return stats.sequences
    }
}

/** The transition a step fired, or null when the command was refused, not applicable or ambiguous. */
internal val <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> Step<S, C, P, E, F>.fired: Transition<S, C, P, E>?
    get() = (outcome as? Outcome.Fired<S, C, P, E>)?.transition

/** The states of [spec] from which a terminal state is reachable in the transition graph (guards aside). */
internal fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>> statesReachingTerminal(spec: MachineSpec<S, C, P, E>): Set<S> {
    val reaching = spec.terminal.toMutableSet()
    var grew = true
    while (grew) {
        val added = spec.transitions.filter { it.to in reaching }.flatMap { it.from }.filterNot { it in reaching }
        grew = reaching.addAll(added)
    }
    return reaching
}
