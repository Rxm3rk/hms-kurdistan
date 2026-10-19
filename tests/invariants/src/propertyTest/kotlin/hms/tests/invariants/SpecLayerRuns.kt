package hms.tests.invariants

import hms.kernel.statemachine.MachineSpec
import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import io.kotest.property.Arb

/**
 * Runs one specification-layer property of an SI (docs/specs/modules/state-machines-and-invariants.md §4): the
 * machine's generated model, driven by its real predicate implementation over its facts generator, for the property
 * budget of random command sequences, with [check] asserted after every step it applies to. The harness fails the run
 * when the check applied to no step (a vacuous property) at the fast-tier budget or above; [requireFired] names the
 * transitions the property is about, and the run fails unless each fired. Returns the number of sequences run.
 */
internal fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> specLayerRun(
    name: String,
    spec: MachineSpec<S, C, P, E>,
    holds: (P, F) -> Boolean,
    facts: Arb<F>,
    check: StepCheck<S, C, P, E, F>,
    requireFired: (Transition<S, C, P, E>) -> Boolean,
): Int {
    val stats = runSequences(name = name, spec = spec, holds = holds, facts = facts, checks = listOf(check))
    val required = spec.transitions.filter(requireFired).map { it.index }
    check(required.isNotEmpty()) { "$name: no transition of ${spec.machine} matches the transitions the property is about" }
    stats.requireFired(*required.toIntArray())
    return stats.sequences
}

/** The transition a step fired, or null when the command was refused, not applicable or ambiguous. */
internal val <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> Step<S, C, P, E, F>.fired: Transition<S, C, P, E>?
    get() = (outcome as? Outcome.Fired<S, C, P, E>)?.transition
