package hms.kernel.testing.statemachine

import hms.kernel.statemachine.MachineSpec
import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition

/**
 * Properties P1 to P6 of one step (docs/specs/modules/state-machines-and-invariants.md §3.3), checked against the
 * harness's own evaluation of the predicates ([Step.holding]) and the harness's own candidate table, built from
 * `spec.transitions` and not from the engine's [MachineSpec.candidates] lookup (spec §3.3 P2 "independently of the
 * engine").
 *
 * What each property can catch, against this engine (`hms.kernel.statemachine`), stated plainly:
 *
 * - P2 and P3 test the engine's decision against the independent evaluation, and P5 tests the spec. Each has a harness
 *   self-test in which it fails. P3 is checked for every (state, command) pair that has two or more candidates, at
 *   every step, with the step's facts: facts do not depend on the state, so facts that make two alternatives hold in a
 *   state the sequence did not visit are still a specification defect (spec §1.2 "for any facts").
 * - P1's first clause (the state is one of the machine's states), P4 and P6 hold by construction here: `Outcome.state`
 *   is `from` unless Fired, `Fired.state` is `transition.to`, `Outcome.effects` is empty unless Fired and
 *   `Fired.effects` is `transition.effects`, and the `MachineSpec` constructor checks that every `to` is a state. They
 *   cannot fail against this engine; they become meaningful when the observed state and effects of a real aggregate
 *   are compared with the model (the application-command layer, KA-062).
 * - P1's second clause (the outcome is for the step's state and command) and P2's not-applicable clause catch an
 *   engine defect only; the engine's unit tests already cover both.
 */
internal class StepProperties<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>>(
    private val spec: MachineSpec<S, C, P, E>,
    private val privilegedAndAudited: P?,
) {
    private val states: Set<S> = spec.states.toHashSet()

    /** The candidates of each (state, command), in spec order, worked out from the transitions alone. */
    private val candidates: Map<Pair<S, C>, List<Transition<S, C, P, E>>> =
        spec.transitions
            .flatMap { transition -> transition.from.map { state -> (state to transition.on) to transition } }
            .groupBy({ it.first }, { it.second })

    /** Every set of two or more alternatives (same `from` state, same command), with the states it applies in. */
    private val alternatives: List<Alternatives<S, C, P, E>> =
        candidates.entries
            .filter { it.value.size > 1 }
            .groupBy({ it.value }, { it.key })
            .map { (transitions, keys) -> Alternatives(keys.first().second, keys.map { it.first }, transitions) }

    /** The first property the step violates, as (property, detail), or null when P1 to P6 hold. */
    fun violation(step: Step<S, C, P, E, *>): Pair<String, String>? {
        val candidates = candidates[step.from to step.command].orEmpty()
        return p1(step) ?: p2(step, candidates) ?: p3(step, candidates) ?: p3Everywhere(step) ?: p4(step) ?: p5(step) ?: p6(step)
    }

    private fun p1(step: Step<S, C, P, E, *>): Pair<String, String>? {
        val outcome = step.outcome
        return when {
            outcome.state !in states -> {
                P1 to "the state after the step, ${outcome.state}, is not one of ${spec.states}"
            }

            outcome.from != step.from || outcome.command != step.command -> {
                P1 to "the outcome is for ${outcome.command} in ${outcome.from}, not ${step.command} in ${step.from}"
            }

            else -> {
                null
            }
        }
    }

    private fun p2(
        step: Step<S, C, P, E, *>,
        candidates: List<Transition<S, C, P, E>>,
    ): Pair<String, String>? =
        when (val outcome = step.outcome) {
            is Outcome.Fired -> {
                val transition = outcome.transition
                val failing = transition.guard.filterNot { it in step.holding }
                when {
                    transition !in candidates -> {
                        P2 to "${describe(transition)} fired but is not a candidate"
                    }

                    failing.isNotEmpty() -> {
                        P2 to "${describe(transition)} fired although $failing do not hold for the step's facts " +
                            "(evaluated again, independently of the engine)"
                    }

                    else -> {
                        null
                    }
                }
            }

            is Outcome.Refused -> {
                val independent = candidates.map { it to it.guard.filterNot { predicate -> predicate in step.holding } }
                if (outcome.failed == independent) {
                    null
                } else {
                    P2 to "the engine refused with ${failedText(outcome.failed)}, but the independent evaluation of the " +
                        "predicates gives ${failedText(independent)}"
                }
            }

            is Outcome.NotApplicable -> {
                if (candidates.isEmpty()) null else P2 to "not applicable although ${candidates.map { describe(it) }} leave the state"
            }

            is Outcome.Ambiguous -> {
                null
            }
        }

    private fun p3(
        step: Step<S, C, P, E, *>,
        candidates: List<Transition<S, C, P, E>>,
    ): Pair<String, String>? {
        val outcome = step.outcome
        val holding = candidates.filter { step.holding.containsAll(it.guard) }
        return when {
            outcome is Outcome.Ambiguous -> {
                P3 to "the engine found more than one holding candidate: ${outcome.matching.map { describe(it) }}"
            }

            holding.size > 1 -> {
                P3 to "more than one candidate's guard holds: ${holding.map { describe(it) }}"
            }

            else -> {
                null
            }
        }
    }

    private fun p3Everywhere(step: Step<S, C, P, E, *>): Pair<String, String>? {
        for (group in alternatives) {
            val holding = group.transitions.filter { step.holding.containsAll(it.guard) }
            if (holding.size > 1) {
                return P3 to "for the step's facts, more than one alternative for ${group.command} in ${group.states} holds: " +
                    "${holding.map { describe(it) }}. Facts do not depend on the state, so this is a specification " +
                    "defect wherever the sequence is (spec §1.2)"
            }
        }
        return null
    }

    private fun p4(step: Step<S, C, P, E, *>): Pair<String, String>? {
        val outcome = step.outcome
        return when {
            outcome is Outcome.Fired -> null
            outcome.state != step.from -> P4 to "a ${kind(outcome)} command moved the state from ${step.from} to ${outcome.state}"
            outcome.effects.isNotEmpty() -> P4 to "a ${kind(outcome)} command produced the effects ${outcome.effects}"
            else -> null
        }
    }

    private fun p5(step: Step<S, C, P, E, *>): Pair<String, String>? {
        val outcome = step.outcome
        if (outcome !is Outcome.Fired || step.from !in spec.terminal) return null
        val left = "${describe(outcome.transition)} left the terminal state ${step.from}"
        return when {
            privilegedAndAudited == null -> P5 to "$left, but the machine has no $PRIVILEGED_AND_AUDITED predicate"
            privilegedAndAudited !in step.holding -> P5 to "$left without $PRIVILEGED_AND_AUDITED holding"
            else -> null
        }
    }

    private fun p6(step: Step<S, C, P, E, *>): Pair<String, String>? {
        val outcome = step.outcome as? Outcome.Fired ?: return null
        val transition = outcome.transition
        return when {
            outcome.effects != transition.effects -> {
                P6 to "${describe(transition)} produced ${outcome.effects}, not its effects ${transition.effects}"
            }

            outcome.state != transition.to -> {
                P6 to "${describe(transition)} ended in ${outcome.state}, not ${transition.to}"
            }

            else -> {
                null
            }
        }
    }

    /** Two or more transitions that leave each of [states] on [command]: alternatives of which at most one may hold. */
    private data class Alternatives<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>>(
        val command: C,
        val states: List<S>,
        val transitions: List<Transition<S, C, P, E>>,
    )

    /** The property labels used in failure messages, and the name of the terminal-exit predicate. */
    companion object {
        /** The predicate every transition out of a terminal state carries (spec §1.2; Appendix B.3), as an enum constant. */
        const val PRIVILEGED_AND_AUDITED: String = "PRIVILEGED_AND_AUDITED"

        const val P1: String = "P1 (the state is one of the machine's states)"
        const val P2: String = "P2 (a transition fired only if every predicate of its guard holds)"
        const val P3: String = "P3 (at most one candidate's guard holds)"
        const val P4: String = "P4 (a refused or not-applicable command changes nothing)"
        const val P5: String = "P5 (a transition leaving a terminal state fired only with privilegedAndAudited holding)"
        const val P6: String = "P6 (the effects are exactly the fired transition's)"
    }
}
