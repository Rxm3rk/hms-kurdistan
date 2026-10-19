package hms.kernel.testing.statemachine

import hms.kernel.statemachine.MachineSpec
import hms.kernel.statemachine.Transition
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bind
import io.kotest.property.arbitrary.boolean

// A hand-written toy machine for the harness's own tests: a door, not a clinical machine (NOT FOR CLINICAL USE). It has
// ten transitions, alternatives with mutually exclusive guards (Open from CLOSED, Close from OPEN), a "*"-style
// transition (ForceOpen), a terminal state (RETIRED) left only with PRIVILEGED_AND_AUDITED, a self-loop and a creation
// command (Install) with no transition. Shaped like a generated model (docs/specs/modules/state-machines-and-invariants.md §2.3).

/** States of the toy door. */
enum class DoorState { CLOSED, OPEN, LOCKED, RETIRED }

/** Commands of the toy door; Install creates a door and has no transition. */
enum class DoorCommand { Install, Open, Close, Lock, Unlock, Retire, Reinstate, ForceOpen }

/** Guard predicates of the toy door. */
enum class DoorPredicate { KEY_PRESENT, ALARM_SILENT, ALARM_RAISED, NOT_OBSTRUCTED, OBSTRUCTED, PRIVILEGED_AND_AUDITED }

/** Effects of the toy door. */
enum class DoorEffect { LOG_ENTRY, NOTIFY_SECURITY }

/** The facts the toy door's predicates read. */
data class DoorFacts(
    val keyPresent: Boolean,
    val alarm: Boolean,
    val obstructed: Boolean,
    val privileged: Boolean,
    val audited: Boolean,
)

/** The toy door's spec, predicates and facts generator. */
object ToyDoor {
    private fun edge(
        from: Set<DoorState>,
        on: DoorCommand,
        guard: List<DoorPredicate>,
        to: DoorState,
        effects: List<DoorEffect> = emptyList(),
    ): (Int) -> Transition<DoorState, DoorCommand, DoorPredicate, DoorEffect> =
        { index -> Transition(index, from, on, guard, to, effects, proposed = false) }

    /** The ten transitions, in spec order (indexes 0 to 9). */
    val transitions: List<Transition<DoorState, DoorCommand, DoorPredicate, DoorEffect>> =
        listOf(
            edge(setOf(DoorState.CLOSED), DoorCommand.Open, listOf(DoorPredicate.ALARM_SILENT), DoorState.OPEN),
            edge(
                setOf(DoorState.CLOSED),
                DoorCommand.Open,
                listOf(DoorPredicate.ALARM_RAISED),
                DoorState.LOCKED,
                listOf(DoorEffect.NOTIFY_SECURITY),
            ),
            edge(setOf(DoorState.OPEN), DoorCommand.Close, listOf(DoorPredicate.NOT_OBSTRUCTED), DoorState.CLOSED),
            edge(setOf(DoorState.OPEN), DoorCommand.Close, listOf(DoorPredicate.OBSTRUCTED), DoorState.OPEN, listOf(DoorEffect.LOG_ENTRY)),
            edge(
                setOf(DoorState.CLOSED),
                DoorCommand.Lock,
                listOf(DoorPredicate.KEY_PRESENT),
                DoorState.LOCKED,
                listOf(DoorEffect.LOG_ENTRY),
            ),
            edge(
                setOf(DoorState.OPEN),
                DoorCommand.Lock,
                listOf(DoorPredicate.KEY_PRESENT, DoorPredicate.NOT_OBSTRUCTED),
                DoorState.LOCKED,
            ),
            edge(
                setOf(DoorState.LOCKED),
                DoorCommand.Unlock,
                listOf(DoorPredicate.KEY_PRESENT, DoorPredicate.ALARM_SILENT),
                DoorState.CLOSED,
                listOf(DoorEffect.LOG_ENTRY),
            ),
            edge(
                setOf(DoorState.CLOSED, DoorState.LOCKED),
                DoorCommand.Retire,
                listOf(DoorPredicate.KEY_PRESENT),
                DoorState.RETIRED,
                listOf(DoorEffect.LOG_ENTRY),
            ),
            edge(
                setOf(DoorState.RETIRED),
                DoorCommand.Reinstate,
                listOf(DoorPredicate.PRIVILEGED_AND_AUDITED),
                DoorState.CLOSED,
                listOf(DoorEffect.LOG_ENTRY, DoorEffect.NOTIFY_SECURITY),
            ),
            edge(
                setOf(DoorState.CLOSED, DoorState.LOCKED, DoorState.RETIRED),
                DoorCommand.ForceOpen,
                listOf(DoorPredicate.PRIVILEGED_AND_AUDITED),
                DoorState.OPEN,
                listOf(DoorEffect.NOTIFY_SECURITY),
            ),
        ).mapIndexed { index, build -> build(index) }

    /** The executable toy door. */
    val spec: MachineSpec<DoorState, DoorCommand, DoorPredicate, DoorEffect> =
        MachineSpec(
            machine = "toy-door",
            version = 1,
            states = DoorState.entries,
            initial = DoorState.CLOSED,
            terminal = setOf(DoorState.RETIRED),
            createdBy = listOf(DoorCommand.Install),
            commands = DoorCommand.entries,
            transitions = transitions,
        )

    /** The single implementation of the toy door's predicates. */
    fun holds(
        predicate: DoorPredicate,
        facts: DoorFacts,
    ): Boolean =
        when (predicate) {
            DoorPredicate.KEY_PRESENT -> facts.keyPresent
            DoorPredicate.ALARM_SILENT -> !facts.alarm
            DoorPredicate.ALARM_RAISED -> facts.alarm
            DoorPredicate.NOT_OBSTRUCTED -> !facts.obstructed
            DoorPredicate.OBSTRUCTED -> facts.obstructed
            DoorPredicate.PRIVILEGED_AND_AUDITED -> facts.privileged && facts.audited
        }

    /** Facts with every combination equally likely. */
    val facts: Arb<DoorFacts> = Arb.bind(Arb.boolean(), Arb.boolean(), Arb.boolean(), Arb.boolean(), Arb.boolean(), ::DoorFacts)
}
