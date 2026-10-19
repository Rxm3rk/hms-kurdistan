package hms.kernel.testing.statemachine

import hms.kernel.statemachine.MachineSpec
import io.kotest.core.factory.TestFactory
import io.kotest.core.spec.style.funSpec
import io.kotest.property.Arb

/**
 * A Kotest test factory with one test: the generic sequence properties of a generated machine model
 * (docs/specs/modules/state-machines-and-invariants.md §2.3, §3.3; BUILD-PROMPT §8.4, §18.3). Each machine's generated
 * `<P>GeneratedPropertyTest` includes it.
 *
 * The test runs [runSequences] (P1 to P6 after every step, the counts file). When `config.budget` is at least
 * `config.coverageFromBudget` it is named "<name>: P1-P7 hold over <budget> random command sequences" and also fails
 * when a transition never fired (P7, listing every such transition), when a predicate held at every step or at none
 * (a predicate that never varies leaves P2, P3 or a guard untested), or when no step fired. Below that budget it is
 * named "<name>: P1-P6 hold over <budget> random command sequences (P7 not asserted below <coverageFromBudget>)", so a
 * green run never claims P7.
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
            checkMachineSequenceProperties(name, spec, holds, facts, config, testCase.spec::class.java.name)
        }
    }

/** The name of the one test of [machineSequenceProperties]: it says which properties the run asserts. */
internal fun propertiesTestName(
    name: String,
    config: SequenceConfig,
): String =
    if (config.budget >= config.coverageFromBudget) {
        "$name: P1-P7 hold over ${config.budget} random command sequences"
    } else {
        "$name: P1-P6 hold over ${config.budget} random command sequences (P7 not asserted below ${config.coverageFromBudget})"
    }

/** The body of the [machineSequenceProperties] test: P1 to P6 over the run, then P7 and predicate coverage when the budget allows. */
internal fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> checkMachineSequenceProperties(
    name: String,
    spec: MachineSpec<S, C, P, E>,
    holds: (P, F) -> Boolean,
    facts: Arb<F>,
    config: SequenceConfig,
    testClass: String? = callingTestClass(),
): RunStats {
    val stats = SequenceRun(name, spec, holds, facts, config, emptyList(), testClass).complete(machineCoverage = true)
    if (config.budget < config.coverageFromBudget) {
        println("$name: P7 (coverage) not asserted: ${config.budget} sequences is below ${config.coverageFromBudget}")
    }
    return stats
}
