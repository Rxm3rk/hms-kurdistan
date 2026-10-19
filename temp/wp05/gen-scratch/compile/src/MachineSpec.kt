package hms.kernel.statemachine

/**
 * An executable state machine: the states, commands and guarded transitions of one specification
 * (BUILD-PROMPT §8.4, Appendix B.3; docs/specs/modules/state-machines-and-invariants.md §3.2).
 *
 * The generator builds one per machine from `docs/specs/state-machines/<machine>.yaml` (spec §2.3). The constructor
 * validates the structure and throws [IllegalArgumentException] on the first defect. The checks of spec §2.1 that need
 * the whole file (reachability, static determinism, liveness, approvals) belong to `tools/hms statemachines check`.
 *
 * @property machine The kebab-case machine name.
 * @property version The spec's version, at least 1.
 * @property states Every state, in spec order, each once.
 * @property initial The state an instance is created in. One of [states].
 * @property terminal The states in which the lifecycle has ended. A subset of [states]; may be empty (the bed).
 * @property createdBy The commands that create an instance (§8.4 "(start)" rows). A subset of [commands].
 * @property commands Every command of the machine, each once, creation commands included.
 * @property transitions Every transition, [Transition.index] equal to its position.
 */
@Suppress("LongParameterList") // One parameter per key of the spec; the generated models pass them by name.
class MachineSpec<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>>(
    val machine: String,
    val version: Int,
    val states: List<S>,
    val initial: S,
    val terminal: Set<S>,
    val createdBy: List<C>,
    val commands: List<C>,
    val transitions: List<Transition<S, C, P, E>>,
) {
    private val commandSlots: Int
    private val table: Array<List<Transition<S, C, P, E>>>

    init {
        validateHeader()
        transitions.forEachIndexed { position, transition -> validate(position, transition) }
        commandSlots = commands.maxOf { it.ordinal } + 1
        val stateSlots = states.maxOf { it.ordinal } + 1
        val slots = Array(stateSlots * commandSlots) { mutableListOf<Transition<S, C, P, E>>() }
        for (transition in transitions) {
            for (state in transition.from) {
                slots[slot(state, transition.on)] += transition
            }
        }
        table = Array(slots.size) { slots[it].toList() }
    }

    /** The transitions that leave [state] on [command], in spec order. Empty when the command is not applicable there. */
    fun candidates(
        state: S,
        command: C,
    ): List<Transition<S, C, P, E>> {
        val index = slot(state, command)
        return if (command.ordinal < commandSlots && index < table.size) table[index] else emptyList()
    }

    /**
     * Applies [command] in [state], asking [holds] whether each guard predicate holds (spec §1.2, §3.2).
     *
     * Every predicate of every candidate is evaluated exactly once per candidate, with no short-circuit, so a refusal
     * names every predicate that failed. Exactly one candidate whose guard fully holds gives [Outcome.Fired]; more
     * than one gives [Outcome.Ambiguous]; candidates of which none holds give [Outcome.Refused]; no candidate gives
     * [Outcome.NotApplicable]. Only [Outcome.Fired] changes the state.
     */
    fun fire(
        state: S,
        command: C,
        holds: (P) -> Boolean,
    ): Outcome<S, C, P, E> {
        val candidates = candidates(state, command)
        if (candidates.isEmpty()) return Outcome.NotApplicable(state, command)
        val matching = ArrayList<Transition<S, C, P, E>>(1)
        val failed = ArrayList<Pair<Transition<S, C, P, E>, List<P>>>(candidates.size)
        for (candidate in candidates) {
            val failedPredicates = candidate.guard.filterNot(holds)
            if (failedPredicates.isEmpty()) matching += candidate else failed += candidate to failedPredicates
        }
        return when (matching.size) {
            0 -> Outcome.Refused(state, command, failed)
            1 -> Outcome.Fired(state, command, matching.single())
            else -> Outcome.Ambiguous(state, command, matching)
        }
    }

    /** The machine's name and version, for messages. */
    override fun toString(): String = "MachineSpec($machine, version $version)"

    private fun slot(
        state: S,
        command: C,
    ): Int = state.ordinal * commandSlots + command.ordinal

    private fun validateHeader() {
        require(machine.isNotBlank()) { "a machine needs a name" }
        require(version >= 1) { "machine '$machine': version must be at least 1, got $version" }
        require(states.isNotEmpty()) { "machine '$machine': no states" }
        require(states.toSet().size == states.size) { "machine '$machine': a state is listed twice in $states" }
        require(initial in states) { "machine '$machine': initial state $initial is not one of the states $states" }
        val unknownTerminal = terminal - states.toSet()
        require(unknownTerminal.isEmpty()) { "machine '$machine': terminal states $unknownTerminal are not states" }
        require(commands.isNotEmpty()) { "machine '$machine': no commands" }
        require(commands.toSet().size == commands.size) { "machine '$machine': a command is listed twice in $commands" }
        val unknownCreators = createdBy - commands.toSet()
        require(unknownCreators.isEmpty()) { "machine '$machine': creation commands $unknownCreators are not commands" }
    }

    private fun validate(
        position: Int,
        transition: Transition<S, C, P, E>,
    ) {
        val name = "machine '$machine': transition $position (${transition.from} --${transition.on}--> ${transition.to})"
        require(transition.index == position) { "$name has index ${transition.index}; indexes must be 0..n-1 in order" }
        require(transition.from.isNotEmpty()) { "$name leaves no state" }
        val unknownFrom = transition.from.filterNot { it in states }
        require(unknownFrom.isEmpty()) { "$name leaves $unknownFrom, which are not states" }
        require(transition.to in states) { "$name enters ${transition.to}, which is not a state" }
        require(transition.on in commands) { "$name is triggered by ${transition.on}, which is not a command" }
        require(transition.guard.toSet().size == transition.guard.size) { "$name names a guard predicate twice" }
        require(transition.effects.toSet().size == transition.effects.size) { "$name names an effect twice" }
    }
}
