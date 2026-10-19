package hms.kernel.testing.statemachine

import hms.kernel.statemachine.Outcome

/**
 * One step of a random command sequence, as [runSequences] saw it (docs/specs/modules/state-machines-and-invariants.md §3.3).
 *
 * @property seed The sequence's seed. It reproduces the whole sequence.
 * @property index The step's position in the sequence, 0-based.
 * @property from The state before the step.
 * @property command The command applied.
 * @property facts The facts drawn for the step.
 * @property outcome What the engine decided.
 * @property holding Every predicate of the machine that holds for [facts], evaluated by the harness independently of
 *   the engine.
 */
data class Step<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F>(
    val seed: Long,
    val index: Int,
    val from: S,
    val command: C,
    val facts: F,
    val outcome: Outcome<S, C, P, E>,
    val holding: Set<P>,
)

/**
 * A machine-level property checked after every step, beside P1 to P6 (spec §3.3: each machine's own `<P>PropertyTest`;
 * spec §4: the SI specification-layer properties).
 *
 * A property usually speaks about some steps only ("a dose that reaches `completed` ..."). [appliesTo] says which: it
 * is the property's antecedent. [check] is called only for the steps it applies to. The harness counts those steps
 * ([RunStats.checkApplied]) and fails a run of at least `coverageFromBudget` sequences in which the check never
 * applied, because such a check proved nothing ("vacuous: <name> never applied"). There is no default for
 * [appliesTo]: write `{ true }` only when the property really speaks about every step.
 *
 * @property name Names the property in failure messages and in the counts file. Unique within one run.
 * @property appliesTo True for the steps the property speaks about.
 * @property check Throws an [AssertionError] (a Kotest matcher failure) when a step it applies to violates the property.
 */
class StepCheck<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F>(
    val name: String,
    val appliesTo: (Step<S, C, P, E, F>) -> Boolean,
    val check: (Step<S, C, P, E, F>) -> Unit,
)
