package hms.kernel.statemachine

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf

private enum class Lamp { OFF, ON, BROKEN, SCRAPPED, UNUSED }

private enum class Act { Install, SwitchOn, SwitchOff, Smash, Scrap, Repair, Toggle }

private enum class Cond { POWER, BULB, SWITCH_WORKS, PRIVILEGED_AND_AUDITED }

private enum class Fx { LOG, ALERT }

private typealias LampTransition = Transition<Lamp, Act, Cond, Fx>

private fun transition(
    index: Int,
    from: Set<Lamp>,
    on: Act,
    guard: List<Cond>,
    to: Lamp,
): LampTransition = Transition(index, from, on, guard, to, effects = emptyList(), proposed = false)

// A hand-built lamp. Transitions 2 and 3 are alternatives for SwitchOn from OFF with different guards.
private val lampTransitions: List<LampTransition> =
    listOf(
        transition(0, setOf(Lamp.ON), Act.SwitchOff, listOf(Cond.SWITCH_WORKS), Lamp.OFF),
        transition(1, setOf(Lamp.OFF, Lamp.ON), Act.Smash, emptyList(), Lamp.BROKEN).copy(effects = listOf(Fx.ALERT, Fx.LOG)),
        transition(
            2,
            setOf(Lamp.OFF),
            Act.SwitchOn,
            listOf(Cond.POWER, Cond.BULB, Cond.SWITCH_WORKS),
            Lamp.ON,
        ).copy(effects = listOf(Fx.LOG)),
        transition(3, setOf(Lamp.OFF), Act.SwitchOn, listOf(Cond.SWITCH_WORKS, Cond.PRIVILEGED_AND_AUDITED), Lamp.BROKEN),
        transition(4, setOf(Lamp.BROKEN), Act.Repair, listOf(Cond.BULB), Lamp.OFF),
        transition(5, setOf(Lamp.BROKEN), Act.Scrap, emptyList(), Lamp.SCRAPPED),
    )

private val lampStates = listOf(Lamp.OFF, Lamp.ON, Lamp.BROKEN, Lamp.SCRAPPED)

private fun lamp(
    states: List<Lamp> = lampStates,
    terminal: Set<Lamp> = setOf(Lamp.SCRAPPED),
    createdBy: List<Act> = listOf(Act.Install),
    commands: List<Act> = Act.entries,
    transitions: List<LampTransition> = lampTransitions,
): MachineSpec<Lamp, Act, Cond, Fx> = MachineSpec("lamp", 1, states, Lamp.OFF, terminal, createdBy, commands, transitions)

/** The lamp with one more transition, 6: Scrap from [from] to [to]. */
private fun lampWithScrap(
    from: Set<Lamp> = setOf(Lamp.ON),
    guard: List<Cond> = emptyList(),
    to: Lamp = Lamp.SCRAPPED,
    effects: List<Fx> = emptyList(),
): MachineSpec<Lamp, Act, Cond, Fx> =
    lamp(transitions = lampTransitions + transition(6, from, Act.Scrap, guard, to).copy(effects = effects))

/** Records every predicate evaluation, so a test can count them. */
private class Facts(
    private val holding: Set<Cond>,
) {
    val asked = mutableListOf<Cond>()

    fun holds(predicate: Cond): Boolean {
        asked += predicate
        return predicate in holding
    }
}

/** The engine (docs/specs/modules/state-machines-and-invariants.md §3.2; BUILD-PROMPT §8.4, Appendix B.3). In src/test. */
class MachineSpecTest :
    FunSpec({
        val spec = lamp()

        test("candidates are the transitions leaving the state on the command, in spec order") {
            spec.candidates(Lamp.OFF, Act.SwitchOn).map { it.index } shouldContainExactly listOf(2, 3)
            spec.candidates(Lamp.ON, Act.Smash).map { it.index } shouldContainExactly listOf(1)
            spec.candidates(Lamp.OFF, Act.Smash).map { it.index } shouldContainExactly listOf(1)
            spec.candidates(Lamp.SCRAPPED, Act.Repair).shouldBeEmpty()
            spec.candidates(Lamp.UNUSED, Act.SwitchOn).shouldBeEmpty()
        }

        test("a command with no transition from the state is not applicable and changes nothing") {
            val facts = Facts(Cond.entries.toSet())
            val outcome = spec.fire(Lamp.SCRAPPED, Act.Repair, facts::holds)
            outcome shouldBe Outcome.NotApplicable(Lamp.SCRAPPED, Act.Repair)
            outcome.state shouldBe Lamp.SCRAPPED
            outcome.effects.shouldBeEmpty()
            facts.asked.shouldBeEmpty()
        }

        test("a creation command has no transition: not applicable in every state") {
            lampStates.forEach { state ->
                spec.fire(state, Act.Install) { true }.shouldBeInstanceOf<Outcome.NotApplicable<Lamp, Act, Cond, Fx>>()
            }
        }

        test("a state outside the machine has no candidate") {
            spec.fire(Lamp.UNUSED, Act.Smash) { true }.shouldBeInstanceOf<Outcome.NotApplicable<Lamp, Act, Cond, Fx>>()
        }

        test("exactly one holding candidate fires: the target state and the effects come from its transition") {
            val outcome = spec.fire(Lamp.OFF, Act.SwitchOn, Facts(setOf(Cond.POWER, Cond.BULB, Cond.SWITCH_WORKS))::holds)
            val fired = outcome.shouldBeInstanceOf<Outcome.Fired<Lamp, Act, Cond, Fx>>()
            fired.transition shouldBe lampTransitions[2]
            outcome.from shouldBe Lamp.OFF
            outcome.command shouldBe Act.SwitchOn
            outcome.state shouldBe Lamp.ON
            outcome.effects shouldContainExactly listOf(Fx.LOG)
        }

        test("an empty guard always holds, and effects keep their spec order") {
            val outcome = spec.fire(Lamp.ON, Act.Smash) { false }
            outcome.shouldBeInstanceOf<Outcome.Fired<Lamp, Act, Cond, Fx>>().transition.index shouldBe 1
            outcome.state shouldBe Lamp.BROKEN
            outcome.effects shouldContainExactly listOf(Fx.ALERT, Fx.LOG)
        }

        test("a refusal lists every candidate with every failed predicate in guard order, and changes nothing") {
            val outcome = spec.fire(Lamp.OFF, Act.SwitchOn, Facts(setOf(Cond.BULB))::holds)
            val refused = outcome.shouldBeInstanceOf<Outcome.Refused<Lamp, Act, Cond, Fx>>()
            refused.failed shouldContainExactly
                listOf(
                    lampTransitions[2] to listOf(Cond.POWER, Cond.SWITCH_WORKS),
                    lampTransitions[3] to listOf(Cond.SWITCH_WORKS, Cond.PRIVILEGED_AND_AUDITED),
                )
            outcome.state shouldBe Lamp.OFF
            outcome.effects.shouldBeEmpty()
        }

        test("a refusal of a single candidate names only the predicates that failed") {
            val refused = spec.fire(Lamp.BROKEN, Act.Repair) { false }.shouldBeInstanceOf<Outcome.Refused<Lamp, Act, Cond, Fx>>()
            refused.failed shouldContainExactly listOf(lampTransitions[4] to listOf(Cond.BULB))
        }

        test("fire never short-circuits: every predicate of every candidate is evaluated exactly once per candidate") {
            val nothing = Facts(emptySet())
            spec.fire(Lamp.OFF, Act.SwitchOn, nothing::holds)
            nothing.asked shouldContainExactly
                listOf(Cond.POWER, Cond.BULB, Cond.SWITCH_WORKS, Cond.SWITCH_WORKS, Cond.PRIVILEGED_AND_AUDITED)

            val everything = Facts(Cond.entries.toSet())
            spec.fire(Lamp.OFF, Act.SwitchOn, everything::holds)
            everything.asked.size shouldBe 5

            val firing = Facts(setOf(Cond.POWER, Cond.BULB, Cond.SWITCH_WORKS))
            spec.fire(Lamp.OFF, Act.SwitchOn, firing::holds).shouldBeInstanceOf<Outcome.Fired<Lamp, Act, Cond, Fx>>()
            firing.asked.size shouldBe 5
        }

        test("a hand-built spec with an ambiguous pair: two holding candidates give Ambiguous and change nothing") {
            val outcome = spec.fire(Lamp.OFF, Act.SwitchOn) { true }
            val ambiguous = outcome.shouldBeInstanceOf<Outcome.Ambiguous<Lamp, Act, Cond, Fx>>()
            ambiguous.matching shouldContainExactly listOf(lampTransitions[2], lampTransitions[3])
            outcome.state shouldBe Lamp.OFF
            outcome.effects.shouldBeEmpty()
        }

        test("a self-loop fires and stays in its state") {
            val toggling =
                lamp(
                    transitions =
                        lampTransitions + transition(6, setOf(Lamp.ON), Act.Toggle, emptyList(), Lamp.ON).copy(effects = listOf(Fx.LOG)),
                )
            val outcome = toggling.fire(Lamp.ON, Act.Toggle) { true }
            outcome.shouldBeInstanceOf<Outcome.Fired<Lamp, Act, Cond, Fx>>()
            outcome.state shouldBe Lamp.ON
            outcome.effects shouldContainExactly listOf(Fx.LOG)
        }

        test("a machine with no transitions is valid and nothing is applicable") {
            lamp(transitions = emptyList()).fire(Lamp.OFF, Act.SwitchOn) { true } shouldBe
                Outcome.NotApplicable(Lamp.OFF, Act.SwitchOn)
        }

        test("the outcome types reject inconsistent contents") {
            shouldThrow<IllegalArgumentException> { Outcome.Fired(Lamp.ON, Act.SwitchOn, lampTransitions[2]) }
            shouldThrow<IllegalArgumentException> { Outcome.Fired(Lamp.OFF, Act.SwitchOff, lampTransitions[2]) }
            shouldThrow<IllegalArgumentException> { Outcome.Refused<Lamp, Act, Cond, Fx>(Lamp.OFF, Act.SwitchOn, emptyList()) }
            shouldThrow<IllegalArgumentException> { Outcome.Refused(Lamp.OFF, Act.SwitchOn, listOf(lampTransitions[2] to emptyList())) }
            shouldThrow<IllegalArgumentException> { Outcome.Ambiguous(Lamp.OFF, Act.SwitchOn, listOf(lampTransitions[2])) }
        }

        context("the constructor rejects an invalid spec with a message naming the defect") {
            val misordered = listOf(lampTransitions[1].copy(index = 0), lampTransitions[0].copy(index = 1), lampTransitions[3])
            val invalid: List<Pair<String, () -> Unit>> =
                listOf(
                    "an initial state that is not a state" to
                        { MachineSpec("lamp", 1, lampStates, Lamp.UNUSED, emptySet(), emptyList(), Act.entries, lampTransitions) },
                    "a terminal state that is not a state" to { lamp(terminal = setOf(Lamp.UNUSED)) },
                    "a from state that is not a state" to { lampWithScrap(from = setOf(Lamp.UNUSED)) },
                    "a to state that is not a state" to { lampWithScrap(to = Lamp.UNUSED) },
                    "an index out of order" to { lamp(transitions = misordered) },
                    "an index that does not start at 0" to { lamp(transitions = lampTransitions.drop(1)) },
                    "a transition that leaves no state" to { lampWithScrap(from = emptySet()) },
                    "a command that is not a command of the machine" to { lamp(commands = Act.entries - Act.Repair) },
                    "a creation command that is not a command" to { lamp(commands = Act.entries - Act.Install) },
                    "a transition triggered by a creation command" to
                        { lamp(transitions = lampTransitions + transition(6, setOf(Lamp.ON), Act.Install, emptyList(), Lamp.OFF)) },
                    "a state listed twice" to { lamp(states = lampStates + Lamp.OFF) },
                    "a command listed twice" to { lamp(commands = Act.entries + Act.Scrap) },
                    "no states" to { lamp(states = emptyList()) },
                    "no commands" to { lamp(commands = emptyList(), createdBy = emptyList(), transitions = emptyList()) },
                    "a version below 1" to
                        { MachineSpec("lamp", 0, lampStates, Lamp.OFF, emptySet(), emptyList(), Act.entries, lampTransitions) },
                    "a guard predicate named twice" to { lampWithScrap(guard = listOf(Cond.BULB, Cond.BULB)) },
                    "an effect named twice" to { lampWithScrap(effects = listOf(Fx.LOG, Fx.LOG)) },
                )
            invalid.forEach { (defect, build) ->
                test("rejects $defect") {
                    shouldThrow<IllegalArgumentException> { build() }
                        .message
                        .shouldNotBeNull()
                        .shouldContain("lamp")
                }
            }
            test("rejects a blank machine name") {
                shouldThrow<IllegalArgumentException> {
                    MachineSpec(" ", 1, lampStates, Lamp.OFF, emptySet(), emptyList(), Act.entries, lampTransitions)
                }
            }
        }

        test("a transition triggered by a creation command is rejected: creation commands have no transition (spec §1.1)") {
            shouldThrow<IllegalArgumentException> {
                lamp(transitions = lampTransitions + transition(6, setOf(Lamp.ON), Act.Install, emptyList(), Lamp.OFF))
            }.message shouldBe
                "machine 'lamp': transition 6 ([ON] --Install--> OFF) is triggered by the creation command Install; " +
                "creation commands have no transition, the model starts in OFF (spec §1.1 created_by)"
        }

        test("the validation message names the machine, the transition and the defect") {
            shouldThrow<IllegalArgumentException> {
                lampWithScrap(to = Lamp.UNUSED)
            }.message shouldBe "machine 'lamp': transition 6 ([ON] --Scrap--> UNUSED) enters UNUSED, which is not a state"
        }

        test("the spec keeps every value it was given") {
            spec.machine shouldBe "lamp"
            spec.version shouldBe 1
            spec.states shouldContainExactly lampStates
            spec.initial shouldBe Lamp.OFF
            spec.terminal shouldBe setOf(Lamp.SCRAPPED)
            spec.createdBy shouldContainExactly listOf(Act.Install)
            spec.commands shouldContainExactly Act.entries
            spec.transitions shouldContainExactly lampTransitions
            spec.toString() shouldBe "MachineSpec(lamp, version 1)"
        }
    })
