package hms.kernel.statemachine

/**
 * The result of applying a command in a state (BUILD-PROMPT §8.4; docs/specs/modules/state-machines-and-invariants.md §1.2, §3.2).
 *
 * Only [Fired] changes the state or produces effects. [Refused], [NotApplicable] and [Ambiguous] leave the state as it
 * was and produce no effect.
 */
sealed interface Outcome<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>> {
    /** The state the command was applied in. */
    val from: S

    /** The command that was applied. */
    val command: C

    /** The state after the step. It equals [from] unless the outcome is [Fired]. */
    val state: S

    /** The effects the step produced. Empty unless the outcome is [Fired]. */
    val effects: List<E>

    /**
     * Exactly one candidate's guard held, and its transition fired.
     *
     * @property transition The transition that fired. It leaves [from] on [command].
     */
    data class Fired<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>>(
        override val from: S,
        override val command: C,
        val transition: Transition<S, C, P, E>,
    ) : Outcome<S, C, P, E> {
        init {
            require(transition.on == command && from in transition.from) {
                "transition ${transition.index} does not leave $from on $command"
            }
        }

        /** The transition's target state. */
        override val state: S get() = transition.to

        /** The transition's effects. */
        override val effects: List<E> get() = transition.effects
    }

    /**
     * The command has candidates in [from], but no candidate's guard fully held. Nothing changes.
     *
     * @property failed Every candidate, in spec order, with the predicates of its guard that did not hold, in guard order.
     */
    data class Refused<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>>(
        override val from: S,
        override val command: C,
        val failed: List<Pair<Transition<S, C, P, E>, List<P>>>,
    ) : Outcome<S, C, P, E> {
        init {
            require(failed.isNotEmpty() && failed.all { (_, predicates) -> predicates.isNotEmpty() }) {
                "a refusal names at least one candidate and, for each, at least one failed predicate"
            }
        }

        /** Unchanged: [from]. */
        override val state: S get() = from

        /** None. */
        override val effects: List<E> get() = emptyList()
    }

    /** The command has no transition from [from]. Nothing changes (spec §1.2). */
    data class NotApplicable<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>>(
        override val from: S,
        override val command: C,
    ) : Outcome<S, C, P, E> {
        /** Unchanged: [from]. */
        override val state: S get() = from

        /** None. */
        override val effects: List<E> get() = emptyList()
    }

    /**
     * More than one candidate's guard held: a specification defect (spec §1.2, property P3). Nothing changes.
     *
     * @property matching Every candidate whose guard held, in spec order (at least two).
     */
    data class Ambiguous<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>>(
        override val from: S,
        override val command: C,
        val matching: List<Transition<S, C, P, E>>,
    ) : Outcome<S, C, P, E> {
        init {
            require(matching.size >= 2) { "an ambiguous outcome needs at least two matching candidates" }
        }

        /** Unchanged: [from]. */
        override val state: S get() = from

        /** None. */
        override val effects: List<E> get() = emptyList()
    }
}
