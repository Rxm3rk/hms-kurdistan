package hms.kernel.statemachine

/**
 * One transition of a state machine, as written in its executable specification (BUILD-PROMPT §8.4, Appendix B.3).
 *
 * The generator writes one per entry of the spec's `transitions` list
 * (docs/specs/modules/state-machines-and-invariants.md §2.3, §3.2). [MachineSpec] validates it.
 *
 * @property index The position of the transition in the spec's `transitions` list, 0-based.
 * @property from The states it leaves. A `"*"` in the spec is already expanded: every state except [to] (spec §1.2).
 * @property on The command that triggers it.
 * @property guard The predicates that must all hold, in the spec's order. An empty guard always holds.
 * @property to The state it enters.
 * @property effects The obligations it places on the domain when it fires, in the spec's order (spec §1.1).
 * @property proposed True when its edge is listed in the spec's `proposed` list, awaiting panel approval (§8.4, A.20).
 */
data class Transition<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>>(
    val index: Int,
    val from: Set<S>,
    val on: C,
    val guard: List<P>,
    val to: S,
    val effects: List<E>,
    val proposed: Boolean,
)
