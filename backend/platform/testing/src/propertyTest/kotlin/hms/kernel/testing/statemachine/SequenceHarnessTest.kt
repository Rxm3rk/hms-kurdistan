package hms.kernel.testing.statemachine

import hms.kernel.statemachine.MachineSpec
import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition
import io.kotest.assertions.throwables.shouldThrow
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

private typealias DoorCheck = StepCheck<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>

/** A check that applies to every step. */
private fun everyStep(
    name: String,
    check: (Step<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>) -> Unit,
): DoorCheck = StepCheck(name, appliesTo = { true }, check = check)

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
        if (previous == null) {
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

/** Toy-door facts in which no one is ever privileged: Reinstate and ForceOpen can never fire. */
private val unprivileged: Arb<DoorFacts> =
    Arb.bind(Arb.boolean(), Arb.boolean(), Arb.boolean(), Arb.constant(false), Arb.boolean(), ::DoorFacts)

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

        test("(f) a run executes exactly the budgeted number of sequences, and every step and predicate is counted once") {
            var sequencesSeen = 0
            var stepsSeen = 0L
            val counting =
                everyStep("counting") { step ->
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
            stats.checkApplied shouldBe mapOf("counting" to stats.steps)
            stats.masterSeed shouldBe MASTER_SEED
            stats.predicateHeld.size shouldBe DoorPredicate.entries.size
            DoorPredicate.entries.forEach { predicate ->
                (stats.predicateHeld[predicate.ordinal] + stats.predicateFailed[predicate.ordinal]) shouldBe stats.steps
            }
        }

        test("every sequence starts in the initial state, follows its outcomes and has 1 to maxSteps steps") {
            var previous: Step<DoorState, DoorCommand, DoorPredicate, DoorEffect, DoorFacts>? = null
            var longest = 0
            var shortest = Int.MAX_VALUE
            var length = 0
            val shape =
                everyStep("shape") { step ->
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
                everyStep("holding") { step ->
                    step.holding shouldBe DoorPredicate.entries.filter { ToyDoor.holds(it, step.facts) }.toSet()
                }
            withScratchCounts {
                runSequences("toy door holding", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config, listOf(holdingCheck))
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
            val creation = everyStep("creation") { step -> if (step.command == DoorCommand.Install) installs += 1 }
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

        test("(a) a transition that fires although its guard does not hold, evaluated again, fails P2; the counts say fail") {
            val spec = tiny(emptySet(), Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B))
            withScratchCounts { directory ->
                val message = failureOf { runSequences("flaky after", spec, flaky<Ticket>(firstAnswer = true), tickets, config) }
                message shouldContain "P2"
                message shouldContain "fired although [G] do not hold"
                message shouldContain "master seed $MASTER_SEED"
                val counts = File(directory, "flaky_after.json").readText()
                counts shouldContain "\"result\": \"fail\""
                counts shouldContain "\"master_seed\": $MASTER_SEED"
            }
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

        test("(b) an overlapping pair of alternatives on a state the sequences never reach fails P3 (kt-01)") {
            // C has no way in, so no step is ever in C; its two Back alternatives overlap when G and
            // PRIVILEGED_AND_AUDITED both hold (ticket numbers divisible by 6). Checking only the step's own
            // (state, command) would never see them.
            val spec =
                tiny(
                    emptySet(),
                    Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B),
                    Triple(TinyState.B, TinyCommand.Back, emptyList<TinyPredicate>() to TinyState.A),
                    Triple(TinyState.C, TinyCommand.Back, listOf(TinyPredicate.G) to TinyState.A),
                    Triple(TinyState.C, TinyCommand.Back, listOf(TinyPredicate.PRIVILEGED_AND_AUDITED) to TinyState.B),
                )
            val byNumber: (TinyPredicate, Ticket) -> Boolean = { predicate, ticket ->
                when (predicate) {
                    TinyPredicate.G -> ticket.number % 2 == 0
                    TinyPredicate.PRIVILEGED_AND_AUDITED -> ticket.number % 3 == 0
                }
            }
            var visitedC = false
            val inC =
                StepCheck<TinyState, TinyCommand, TinyPredicate, TinyEffect, Ticket>(
                    "in C",
                    appliesTo = { it.from == TinyState.C },
                    check = { visitedC = true },
                )
            val message =
                failureOf { withScratchCounts { runSequences("unreached overlap", spec, byNumber, tickets, config, listOf(inC)) } }
            visitedC shouldBe false
            message shouldContain "P3"
            message shouldContain "more than one alternative for Back in [C] holds"
            message shouldContain "transition 2"
            message shouldContain "transition 3"
        }

        test("a transition leaving a terminal state without privilegedAndAudited holding fails P5") {
            val spec =
                tiny(
                    setOf(TinyState.B),
                    Triple(TinyState.A, TinyCommand.Go, emptyList<TinyPredicate>() to TinyState.B),
                    Triple(TinyState.B, TinyCommand.Back, listOf(TinyPredicate.G) to TinyState.A),
                )
            val unprivilegedTiny: (TinyPredicate, Ticket) -> Boolean = { predicate, _ -> predicate != TinyPredicate.PRIVILEGED_AND_AUDITED }
            val message = failureOf { withScratchCounts { runSequences("terminal exit", spec, unprivilegedTiny, tickets, config) } }
            message shouldContain "P5"
            message shouldContain "left the terminal state B without PRIVILEGED_AND_AUDITED holding"
        }

        test("(c) a transition that never fires fails P7, the message lists every such transition, and a never-true predicate is named") {
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
            message shouldContain "master seed $MASTER_SEED"
            message shouldContain "P7 (every transition fires at least once) failed: 2 of 10 transitions never fired in 1000 sequences"
            message shouldContain describe(ToyDoor.transitions.single { it.on == DoorCommand.Reinstate })
            message shouldContain describe(ToyDoor.transitions.single { it.on == DoorCommand.ForceOpen })
            message shouldNotContain describe(ToyDoor.transitions.single { it.on == DoorCommand.Unlock })
            message shouldContain "predicate coverage: [PRIVILEGED_AND_AUDITED] never held"
        }

        test("(c) a predicate that holds at every step fails predicate coverage, although every transition fired (kt-01)") {
            val keyAlways = Arb.bind(Arb.constant(true), Arb.boolean(), Arb.boolean(), Arb.boolean(), Arb.boolean(), ::DoorFacts)
            val message =
                failureOf {
                    withScratchCounts {
                        checkMachineSequenceProperties(
                            "toy door key always",
                            ToyDoor.spec,
                            ToyDoor::holds,
                            keyAlways,
                            config.copy(budget = COVERAGE_BUDGET),
                        )
                    }
                }
            message shouldContain "predicate coverage: [KEY_PRESENT] held at every step (never false)"
            message shouldNotContain "P7"
        }

        test("P7 and predicate coverage are not asserted below coverageFromBudget") {
            val stats =
                withScratchCounts { checkMachineSequenceProperties("toy door small", ToyDoor.spec, ToyDoor::holds, unprivileged, config) }
            stats.transitionsCovered shouldBeLessThan stats.transitionsTotal
        }

        test("(g) a check that never applies fails the run from coverageFromBudget on: vacuous (kt-02)") {
            val neverAmbiguous =
                DoorCheck("no step is ambiguous", appliesTo = { it.outcome is Outcome.Ambiguous }, check = { error("never called") })
            val run = { budgetConfig: SequenceConfig ->
                runSequences("toy door vacuous", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, budgetConfig, listOf(neverAmbiguous))
            }
            val message = failureOf { withScratchCounts { run(config.copy(coverageFromBudget = SMALL_BUDGET)) } }
            message shouldContain "vacuous: no step is ambiguous never applied"
            message shouldContain "master seed $MASTER_SEED"
            withScratchCounts { run(config) }.checkApplied shouldBe mapOf("no step is ambiguous" to 0L)
        }

        test("(g) a run in which no step fired fails from coverageFromBudget on (kt-02)") {
            val spec = tiny(emptySet(), Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B))
            val message =
                failureOf {
                    withScratchCounts {
                        runSequences("nothing fires", spec, { _, _ -> false }, tickets, config.copy(coverageFromBudget = SMALL_BUDGET))
                    }
                }
            message shouldContain "vacuous: no step fired in $SMALL_BUDGET sequences"
        }

        test("(g) a check is called only on the steps it applies to, and those steps are counted") {
            var called = 0L
            val firedOnly =
                DoorCheck(
                    "fired steps change or keep the state as their transition says",
                    appliesTo = { it.outcome is Outcome.Fired },
                    check = { step ->
                        called += 1
                        step.outcome.shouldBeInstanceOf<Outcome.Fired<DoorState, DoorCommand, DoorPredicate, DoorEffect>>()
                    },
                )
            val stats =
                withScratchCounts {
                    runSequences(
                        "toy door fired only",
                        ToyDoor.spec,
                        ToyDoor::holds,
                        ToyDoor.facts,
                        config,
                        listOf(firedOnly),
                    )
                }
            called shouldBe stats.fired
            stats.checkApplied shouldBe mapOf(firedOnly.name to stats.fired)
        }

        test("two checks with the same name are rejected") {
            val one = everyStep("same") { }
            shouldThrow<IllegalArgumentException> {
                runSequences("toy door twice", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config, listOf(one, one))
            }
        }

        test("(g) requireFired names every listed transition that never fired (kt-02)") {
            val stats = withScratchCounts { runSequences("toy door require", ToyDoor.spec, ToyDoor::holds, unprivileged, config) }
            stats.requireFired(0, 2)
            val message = shouldThrow<AssertionError> { stats.requireFired(8, 9, 0) }.message.shouldNotBeNull()
            message shouldContain "transition 8, transition 9 never fired in $SMALL_BUDGET sequences (master seed $MASTER_SEED)"
            message shouldNotContain "transition 0"
            shouldThrow<IllegalArgumentException> { stats.requireFired() }
            shouldThrow<IllegalArgumentException> { stats.requireFired(ToyDoor.transitions.size) }
        }

        test("(d) a failing StepCheck names the check, the seeds, the step and the Gradle command that replays the run") {
            var failingSeed: Long? = null
            var failingIndex: Int? = null
            val neverLocks =
                everyStep("the door never locks") { step ->
                    failingSeed = step.seed
                    failingIndex = step.index
                    step.outcome.state shouldNotBe DoorState.LOCKED
                }
            val run = { runSequences("toy door never locks", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config, listOf(neverLocks)) }
            val message = failureOf { withScratchCounts { run() } }
            message shouldContain "check 'the door never locks' failed at step $failingIndex of sequence"
            message shouldContain "sequence seed $failingSeed, master seed $MASTER_SEED"
            message shouldContain "SequenceConfig(masterSeed = $MASTER_SEED) replays the run"
            message shouldContain "replay (from backend/): ./gradlew :platform:testing:propertyTest --tests '"
            message shouldContain "-Phms.pbt.seed=$MASTER_SEED -Phms.pbt.sequences=$SMALL_BUDGET"
            message shouldContain "the sequence up to the failing step:"
            message shouldContain "step $failingIndex: "
            failureOf { withScratchCounts { run() } } shouldBe message
        }

        test("the replay command names the calling test class") {
            callingTestClass() shouldBe SequenceHarnessTest::class.java.name
        }

        test("a failure inside a step still names the seeds and the step") {
            val spec = tiny(emptySet(), Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B))
            val throwing: (TinyPredicate, Ticket) -> Boolean = { _, _ -> error("predicate failed") }
            val message = failureOf { withScratchCounts { runSequences("throwing", spec, throwing, tickets, config) } }
            message shouldContain "master seed $MASTER_SEED"
            message shouldContain "predicate failed"
        }

        test("an Error that is not a VirtualMachineError (a guard still TODO, a check's LinkageError) is wrapped with the seeds (kt-10)") {
            val spec = tiny(emptySet(), Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B))
            val unwritten: (TinyPredicate, Ticket) -> Boolean = { _, _ -> TODO("guard not written") }
            val todo = failureOf { withScratchCounts { runSequences("todo guard", spec, unwritten, tickets, config) } }
            todo shouldContain "master seed $MASTER_SEED"
            todo shouldContain "guard not written"
            val linkage = everyStep("linkage") { throw LinkageError("check broke") }
            val broken =
                failureOf {
                    withScratchCounts { runSequences("linkage", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config, listOf(linkage)) }
                }
            broken shouldContain "check 'linkage' failed"
            broken shouldContain "check broke"
            broken shouldContain "master seed $MASTER_SEED"
        }

        test("a VirtualMachineError is not wrapped: it propagates as it is") {
            val spec = tiny(emptySet(), Triple(TinyState.A, TinyCommand.Go, listOf(TinyPredicate.G) to TinyState.B))
            val overflowing: (TinyPredicate, Ticket) -> Boolean = { _, _ -> throw StackOverflowError("synthetic") }
            val error = runCatching { withScratchCounts { runSequences("overflow", spec, overflowing, tickets, config) } }.exceptionOrNull()
            error.shouldBeInstanceOf<StackOverflowError>()
        }

        test("(e) the counts file holds the run's numbers under the keys of spec §3.3 and the added keys") {
            withScratchCounts { directory ->
                val stats = runSequences("toy door/counts", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config)
                val text = File(directory, "toy_door_counts.json").readText()
                Regex("""^ {2}"([a-z_]+)":""", RegexOption.MULTILINE).findAll(text).map { it.groupValues[1] }.toList() shouldContainExactly
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
                        "result",
                        "master_seed",
                        "fired_per_transition",
                        "check_applied",
                        "predicate_held",
                        "predicate_failed",
                    )
                text shouldBe SequenceCounts.json(stats, SequenceCounts.PASS)
                text shouldContain "\"name\": \"toy door/counts\""
                text shouldContain "\"steps\": ${stats.steps}"
                text shouldContain "\"master_seed\": $MASTER_SEED"
                text shouldContain "\"fired_per_transition\": ${stats.firedPerTransition.joinToString(", ", "[", "]")}"
                stats.steps shouldBeGreaterThan SMALL_BUDGET.toLong()
            }
        }

        test("(e) without hms.pbt.countsDir nothing is written") {
            val stats = withCountsDir(null) { runSequences("toy door no counts", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config) }
            withCountsDir(null) { SequenceCounts.write(stats, SequenceCounts.PASS) }.shouldBeNull()
        }

        test("(e) two runs with the same name in one test run fail instead of overwriting the counts file (kt-06)") {
            withScratchCounts {
                runSequences("toy door same name", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config)
                val message = failureOf { runSequences("toy door same name", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config) }
                message shouldContain "already written"
            }
        }

        test("the same master seed replays the same run") {
            val first = withScratchCounts { runSequences("toy door replay", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config) }
            val second = withScratchCounts { runSequences("toy door replay", ToyDoor.spec, ToyDoor::holds, ToyDoor.facts, config) }
            second shouldBe first
        }

        test("the factory's one test says P1-P7 only when the budget asserts P7, and P1-P6 with 'P7 not asserted' below it (kt-05)") {
            machineSequenceProperties(
                "toy-door",
                ToyDoor.spec,
                ToyDoor::holds,
                ToyDoor.facts,
                config,
            ).tests.map { it.name.name } shouldContainExactly
                listOf("toy-door: P1-P6 hold over $SMALL_BUDGET random command sequences (P7 not asserted below $COVERAGE_BUDGET)")
            val full = config.copy(budget = COVERAGE_BUDGET)
            machineSequenceProperties(
                "toy-door",
                ToyDoor.spec,
                ToyDoor::holds,
                ToyDoor.facts,
                full,
            ).tests.map { it.name.name } shouldContainExactly
                listOf("toy-door: P1-P7 hold over $COVERAGE_BUDGET random command sequences")
        }
    })
