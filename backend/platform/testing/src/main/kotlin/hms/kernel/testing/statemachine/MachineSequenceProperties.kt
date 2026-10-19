package hms.kernel.testing.statemachine

import hms.kernel.statemachine.MachineSpec
import io.kotest.core.factory.TestFactory
import io.kotest.core.spec.style.funSpec
import io.kotest.property.Arb

/**
 * A Kotest test factory with one test, "<name>: P1-P7 hold over <budget> random command sequences": the generic sequence
 * properties of a generated machine model (docs/specs/modules/state-machines-and-invariants.md §2.3, §3.3; BUILD-PROMPT
 * §8.4, §18.3).
 *
 * The test runs [runSequences] (P1 to P6 after every step, the counts file) and then asserts P7, every transition fired
 * at least once, when `config.budget` is at least `config.coverageFromBudget`. A P7 failure lists every transition
 * that never fired. Each machine's generated `<P>GeneratedPropertyTest` includes it.
 */
fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> machineSequenceProperties(
    name: String,
    spec: MachineSpec<S, C, P, E>,
    holds: (P, F) -> Boolean,
    facts: Arb<F>,
    config: SequenceConfig = SequenceConfig(),
): TestFactory =
    funSpec {
        test(propertiesTestName(name, config)) {
            checkMachineSequenceProperties(name, spec, holds, facts, config)
        }
    }

/** The name of the one test of [machineSequenceProperties]. */
internal fun propertiesTestName(
    name: String,
    config: SequenceConfig,
): String = "$name: P1-P7 hold over ${config.budget} random command sequences"

/** The body of the [machineSequenceProperties] test: P1 to P6 over the run, then P7 when the budget allows. */
internal fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> checkMachineSequenceProperties(
    name: String,
    spec: MachineSpec<S, C, P, E>,
    holds: (P, F) -> Boolean,
    facts: Arb<F>,
    config: SequenceConfig,
): RunStats {
    val run = SequenceRun(name, spec, holds, facts, config, emptyList())
    val stats = run.complete()
    if (config.budget < config.coverageFromBudget) {
        println("$name: P7 (coverage) not asserted: ${config.budget} sequences is below ${config.coverageFromBudget}")
        return stats
    }
    val neverFired = spec.transitions.filter { stats.firedPerTransition[it.index] == 0L }
    if (neverFired.isNotEmpty()) {
        throw AssertionError(
            buildString {
                appendLine(
                    "$name (machine ${spec.machine}): P7 (every transition fires at least once) failed: " +
                        "${neverFired.size} of ${stats.transitionsTotal} transitions never fired in ${stats.sequences} " +
                        "sequences (master seed ${run.masterSeed}):",
                )
                neverFired.forEach { appendLine("  ${describe(it)}") }
                append("Bias the facts generator (<P>Arbs.facts) so that each of these guards holds often enough (spec §3.3).")
            },
        )
    }
    return stats
}
