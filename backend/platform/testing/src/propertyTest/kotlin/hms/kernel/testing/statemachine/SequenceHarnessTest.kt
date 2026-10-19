package hms.kernel.testing.statemachine

import hms.kernel.statemachine.MachineSpec
import hms.kernel.statemachine.Transition
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.longs.shouldBeGreaterThan
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bind
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.constant
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.map
import java.io.File
import java.nio.file.Files
import java.util.IdentityHashMap

// The harness's own tests (docs/specs/modules/state-machines-and-invariants.md §3.3). They test the harness, not a
// machine, so they use small explicit budgets and a fixed master seed; ToyDoorSequencePropertyTest runs the budget.

private const val SMALL_BUDGET = 300
private const val COVERAGE_BUDGET = 1000
private const val MASTER_SEED = 20_261_019L
private const val SHORT_SEQUENCES = 3

private enum class TinyState { A, B, C }

private enum class TinyCommand { Go, Back }

private enum class TinyPredicate { G, PRIVILEGED_AND_AUDITED }

private enum class TinyEffect { X }

/** A facts value with identity: each draw is a new object. */
private class Ticket(
    val number: Int,
) {
    override fun toString(): String = "Ticket($number)"
}

private val tickets: Arb<Ticket> = Arb.int().map { Ticket(it) }

private fun tiny(
    terminal: Set<TinyState>,
    vararg transitions: Triple<TinyState, TinyCommand, Pair<List<TinyPredicate>, TinyState>>,
): MachineSpec<TinyState, TinyCommand, TinyPredicate, TinyEffect> =
    MachineSpec(
        machine = "tiny",
        version = 1,
        states = TinyState.entries,
        initial = TinyState.A,
        terminal = terminal,
        createdBy = emptyList(),
        commands = TinyCommand.entries,
        transitions =
            transitions.mapIndexed { index, (from, on, rest) ->
                Transition(index, setOf(from), on, rest.first, rest.second, listOf(TinyEffect.X), proposed = false)
            },
    )

/** A predicate that is true only the first time it is asked about a facts value (or only after, when [firstAnswer] is false). */
private fun <F> flaky(firstAnswer: Boolean): (TinyPredicate, F) -> Boolean {
    val asked = IdentityHashMap<Any, MutableSet<TinyPredicate>>()
    return { predicate, facts ->
        val seen = asked.getOrPut(facts) { mutableSetOf() }
        if (seen.add(predicate)) firstAnswer else !firstAnswer
    }
}

/** The message of the [AssertionError] that [block] throws; fails when it throws nothing. */
private fun failureOf(block: () -> Unit): String {
    val error = runCatching(block).exceptionOrNull()
    return error.shouldBeInstanceOf<AssertionError>().message.shouldNotBeNull()
}

/** Runs [block] with the counts directory set to [directory] (cleared when null), restoring the previous value after. */
private fun <T> withCountsDir(
    directory: File?,
    block: () -> T,
): T {
    val previous = System.getProperty(SequenceCounts.SYSTEM_PROPERTY)
    if (directory == null) {
        System.clearProperty(SequenceCounts.SYSTEM_PROPERTY)
    } else {
        System.setProperty(SequenceCounts.SYSTEM_PROPERTY, directory.path)
    }
    try {
        return block()
    } finally {
        if (previous ==
            null
        ) {
            System.clearProperty(SequenceCounts.SYSTEM_PROPERTY)
        } else {
            System.setProperty(SequenceCounts.SYSTEM_PROPERTY, previous)
        }
    }
}

/** Runs [block] with the counts going to a fresh temporary directory, deleted after, so these runs never reach build/pbt-counts. */
private fun <T> withScratchCounts(block: (File) -> T): T {
    val directory = Files.createTempDirectory("hms-pbt-counts").toFile()
    try {
        return withCountsDir(directory) { block(directory) }
    } finally {
        directory.deleteRecursively()
    }
}

/** The sequence harness detects every defect it exists to catch, and records what it ran (spec §3.3). In src/propertyTest. */
class SequenceHarnessTest :
    FunSpec({
        val config = SequenceConfig(budget = SMALL_BUDGET, masterSeed = MASTER_SEED)

        test("the toy door holds P1-P7 at 1,000 sequences: every one of its ten transitions fires") {
            val stats =
                withScratchCounts {
                    checkMachineSequenceProperties(
                        "toy door coverage",
                        ToyDoor.spec,
                        ToyDoor::holds,
                        ToyDoor.facts,
                        config.copy(budget = COVERAGE_BUDGET),
                    )
                }
            stats.transitionsTotal shouldBe ToyDoor.transitions.size
            stats.transitionsCovered shouldBe ToyDoor.transitions.size
            stats.ambiguous shouldBe 0L
        }

        test("(f) a run executes exactly the budgeted number of sequences, and every step is counted once") {
            var sequencesSeen = 0
            var stepsSeen = 0L
            val counting =
                StepCheck<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>("counting") { step ->
                    if (step.index == 0) sequencesSeen += 1
                    stepsSeen += 1
                }
            val stats =
                withScratchCounts { runSequences("toy door count", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config, listOf(counting)) }
            stats.budget shouldBe SMALL_BUDGET
            stats.sequences shouldBe SMALL_BUDGET
            sequencesSeen shouldBe SMALL_BUDGET
            stepsSeen shouldBe stats.steps
            (stats.fired + stats.refused + stats.notApplicable + stats.ambiguous) shouldBe stats.steps
            stats.firedPerTransition.sum() shouldBe stats.fired
        }

        test("every sequence starts in the initial state, follows its outcomes and has 1 to maxSteps steps") {
            var previous: Step<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>? = null
            var longest = 0
            var shortest = Int.MAX_VALUE
            var length = 0
            val shape =
                StepCheck<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>("shape") { step ->
                    if (step.index == 0) {
                        if (previous != null) shortest = minOf(shortest, length)
                        step.from shouldBe ToyDoor.spec.initial
                        length = 0
                    } else {
                        step.from shouldBe previous.shouldNotBeNull().outcome.state
                        step.seed shouldBe previous.shouldNotBeNull().seed
                    }
                    length += 1
                    longest = maxOf(longest, length)
                    previous = step
                }
            withScratchCounts {
                runSequences(
                    "toy door shape",
                    ToyDoor.spec,
                    ToyDoor::holds,
                    ToyDoor.facts,
                    config.copy(maxSteps = SHORT_SEQUENCES),
                    listOf(shape),
                )
            }
            longest shouldBe SHORT_SEQUENCES
            shortest shouldBe 1
        }

        test("holding is every predicate whose implementation holds for the step's facts") {
            val holdingCheck =
                StepCheck<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>("holding") { step ->
                    step.holding shouldBe DoorPredicate.entries.filter { ToyDoor.holds(it, step.facts) }.toSet()
                }
            withScratchCounts {
                runSequences(
                    "toy door holding",
                    ToyDoor.spec,
                    ToyDoor::holds,
                    ToyDoor.facts,
                    config,
                    listOf(holdingCheck),
                )
            }
        }

        test("with applicableBias 1 every step picks a command that has a transition from the current state") {
            val stats =
                withScratchCounts {
                    runSequences("toy door bias 1", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config.copy(applicableBias = 1.0))
                }
            stats.notApplicable shouldBe 0L
        }

        test("with applicableBias 0 every command can be picked, the creation command included") {
            var installs = 0
            val creation =
                StepCheck<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>("creation") { step ->
                    if (step.command == DoorCommand.Install) installs += 1
                }
            val stats =
                withScratchCounts {
                    runSequences(
                        "toy door bias 0",
                        ToyDoor.spec,
                        ToyDoor::holds,
                        ToyDoor.facts,
                        config.copy(applicableBias = 0.0),
                        listOf(creation),
                    )
                }
            installs shouldBeGreaterThan 0
            stats.notApplicable shouldBeGreaterThan 0L
        }

        test("(a) a transition that fires although its guard does not hold, evaluated again, fails P2") {
            val spec = tiny(emptySet(), Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B))
            val message =
                failureOf {
                    withScratchCounts { runSequences("flaky after", spec, flaky<Ticket>(firstAnswer = true), tickets, config) }
                }
            message shouldContain "P2"
            message shouldContain "fired although [G] do not hold"
            message shouldContain "master seed $MASTER_SEED"
        }

        test("(a) a refusal that the independent evaluation contradicts fails P2") {
            val spec = tiny(emptySet(), Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B))
            val message =
                failureOf {
                    withScratchCounts { runSequences("flaky before", spec, flaky<Ticket>(firstAnswer = false), tickets, config) }
                }
            message shouldContain "P2"
            message shouldContain "the engine refused with [transition 0 failed [G]]"
        }

        test("(b) an ambiguous spec fails P3") {
            val spec =
                tiny(
                    emptySet(),
                    Triple(TinyState.A, TinyCommand.Go, emptyList<TinyPredicate>() to TinyState.B),
                    Triple(TinyState.A, TinyCommand.Go, emptyList<TinyPredicate>() to TinyState.C),
                )
            val message = failureOf { withScratchCounts { runSequences("ambiguous", spec, { _, _ -> true }, tickets, config) } }
            message shouldContain "P3"
            message shouldContain "transition 0"
            message shouldContain "transition 1"
            message shouldContain "ambiguous: transitions [0, 1] all hold"
        }

        test("a transition leaving a terminal state without privilegedAndAudited holding fails P5") {
            val spec =
                tiny(
                    setOf(TinyState.B),
                    Triple(TinyState.A, TinyCommand.Go, emptyList<TinyPredicate>() to TinyState.B),
                    Triple(TinyState.B, TinyCommand.Back, listOf(TinyPredicate.G) to TinyState.A),
                )
            val unprivileged: (TinyPredicate, Ticket) -> Boolean = { predicate, _ -> predicate != TinyPredicate.PRIVILEGED_AND_AUDITED }
            val message = failureOf { withScratchCounts { runSequences("terminal exit", spec, unprivileged, tickets, config) } }
            message shouldContain "P5"
            message shouldContain "left the terminal state B without PRIVILEGED_AND_AUDITED holding"
        }

        test("(c) a transition that never fires fails P7, and the message lists every transition that never fired") {
            val unprivileged = Arb.bind(Arb.boolean(), Arb.boolean(), Arb.boolean(), Arb.constant(false), Arb.boolean(), ::DoorFacts)
            val message =
                failureOf {
                    withScratchCounts {
                        checkMachineSequenceProperties(
                            "toy door gap",
                            ToyDoor.spec,
                            ToyDoor::holds,
                            unprivileged,
                            config.copy(budget = COVERAGE_BUDGET),
                        )
                    }
                }
            message shouldContain "P7"
            message shouldContain "2 of 10 transitions never fired in 1000 sequences (master seed $MASTER_SEED)"
            message shouldContain describe(ToyDoor.transitions.single { it.on == DoorCommand.Reinstate })
            message shouldContain describe(ToyDoor.transitions.single { it.on == DoorCommand.ForceOpen })
            message shouldNotContain describe(ToyDoor.transitions.single { it.on == DoorCommand.Unlock })
        }

        test("P7 is not asserted below coverageFromBudget") {
            val unprivileged = Arb.bind(Arb.boolean(), Arb.boolean(), Arb.boolean(), Arb.constant(false), Arb.boolean(), ::DoorFacts)
            val stats =
                withScratchCounts { checkMachineSequenceProperties("toy door small", ToyDoor.spec, ToyDoor::holds, unprivileged, config) }
            stats.transitionsCovered shouldBeLessThan stats.transitionsTotal
        }

        test("(d) a failing StepCheck names the check, the master seed, the sequence's seed and the step") {
            var failingSeed: Long? = null
            var failingIndex: Int? = null
            val neverLocks =
                StepCheck<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>("the door never locks") { step ->
                    failingSeed = step.seed
                    failingIndex = step.index
                    step.outcome.state shouldNotBe DoorState.LOCKED
                }
            val run = { runSequences("toy door never locks", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config, listOf(neverLocks)) }
            val message = failureOf { withScratchCounts { run() } }
            message shouldContain "check 'the door never locks' failed at step $failingIndex of sequence"
            message shouldContain "sequence seed $failingSeed, master seed $MASTER_SEED"
            message shouldContain "SequenceConfig(masterSeed = $MASTER_SEED) replays the run"
            message shouldContain "the sequence up to the failing step:"
            message shouldContain "step $failingIndex: "
            failureOf { withScratchCounts { run() } } shouldBe message
        }

        test("a failure inside a step still names the seeds and the step") {
            val spec = tiny(emptySet(), Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B))
            val throwing: (TinyPredicate, Ticket) -> Boolean = { _, _ -> error("predicate failed") }
            val message = failureOf { withScratchCounts { runSequences("throwing", spec, throwing, tickets, config) } }
            message shouldContain "master seed $MASTER_SEED"
            message shouldContain "predicate failed"
        }

        test("(e) the counts file holds the run's numbers under the keys of spec §3.3") {
            withScratchCounts { directory ->
                val stats = runSequences("toy door/counts", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config)
                val file = File(directory, "toy_door_counts.json")
                val entries =
                    Regex(""""([a-z_]+)": ("[^"]*"|\d+)""")
                        .findAll(file.readText())
                        .associate { it.groupValues[1] to it.groupValues[2].trim('"') }
                entries.keys.toList() shouldContainExactly
                    listOf(
                        "name",
                        "machine",
                        "budget",
                        "sequences",
                        "steps",
                        "fired",
                        "refused",
                        "not_applicable",
                        "ambiguous",
                        "transitions_covered",
                        "transitions_total",
                    )
                entries shouldBe
                    mapOf(
                        "name" to "toy door/counts",
                        "machine" to "toy-door",
                        "budget" to SMALL_BUDGET.toString(),
                        "sequences" to SMALL_BUDGET.toString(),
                        "steps" to stats.steps.toString(),
                        "fired" to stats.fired.toString(),
                        "refused" to stats.refused.toString(),
                        "not_applicable" to stats.notApplicable.toString(),
                        "ambiguous" to "0",
                        "transitions_covered" to stats.transitionsCovered.toString(),
                        "transitions_total" to ToyDoor.transitions.size.toString(),
                    )
                stats.steps shouldBeGreaterThan SMALL_BUDGET.toLong()
            }
        }

        test("(e) without hms.pbt.countsDir nothing is written") {
            val stats = withCountsDir(null) { runSequences("toy door no counts", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config) }
            withCountsDir(null) { SequenceCounts.write(stats) }.shouldBeNull()
        }

        test("the same master seed replays the same run") {
            val first = withScratchCounts { runSequences("toy door replay", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config) }
            val second = withScratchCounts { runSequences("toy door replay", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config) }
            second shouldBe first
        }

        test("the factory holds one test named after the run and its budget") {
            val factory = machineSequenceProperties("toy-door", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config)
            factory.tests.map { it.name.name } shouldContainExactly
                listOf("toy-door: P1-P7 hold over $SMALL_BUDGET random command sequences")
        }
    })
