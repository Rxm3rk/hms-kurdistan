package hms.kernel.testing.statemachine

import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition

// How transitions, outcomes and steps read in failure messages (docs/specs/modules/state-machines-and-invariants.md §3.3).

/** A transition: `transition 3 ([A, B] --Cmd [g1, g2]--> C)`. */
internal fun describe(transition: Transition<*, *, *, *>): String =
    "transition ${transition.index} (${transition.from} --${transition.on} ${transition.guard}--> ${transition.to})"

/** A step of a sequence: the command, the state, the outcome, the facts and the predicates that held. */
internal fun describe(step: Step<*, *, *, *, *>): String {
    val result =
        when (val outcome = step.outcome) {
            is Outcome.Fired -> "fired transition ${outcome.transition.index} to ${outcome.state}, effects ${outcome.effects}"
            is Outcome.Refused -> "refused: ${failedText(outcome.failed)}"
            is Outcome.NotApplicable -> "not applicable"
            is Outcome.Ambiguous -> "ambiguous: transitions ${outcome.matching.map { it.index }} all hold"
        }
    return "step ${step.index}: ${step.command} in ${step.from}: $result; facts ${step.facts}; holding ${step.holding}"
}

/** A refusal's candidates with their failed predicates. */
internal fun failedText(failed: List<Pair<Transition<*, *, *, *>, List<*>>>): String =
    failed.joinToString(prefix = "[", postfix = "]") { (transition, predicates) -> "transition ${transition.index} failed $predicates" }

/** The outcome's kind, in words. */
internal fun kind(outcome: Outcome<*, *, *, *>): String =
    when (outcome) {
        is Outcome.Fired -> "fired"
        is Outcome.Refused -> "refused"
        is Outcome.NotApplicable -> "not-applicable"
        is Outcome.Ambiguous -> "ambiguous"
    }
