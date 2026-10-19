# WP-0.5 harness fixes (review plumbing-kotlin.md: kt-01 to kt-06, kt-08 to kt-11)

Windows host, not evidence of record. AI-written.

## 1. Exact final public API (package `hms.kernel.testing.statemachine`, `backend/platform/testing`)

```kotlin
data class SequenceConfig(
    val budget: Int = PropertyTestBudget.sequences(),
    val maxSteps: Int = DEFAULT_MAX_STEPS,                 // 32
    val applicableBias: Double = DEFAULT_APPLICABLE_BIAS,  // 0.85
    val coverageFromBudget: Int = DEFAULT_COVERAGE_FROM_BUDGET, // 1000
    val masterSeed: Long? = configuredMasterSeed(),        // system property hms.pbt.seed, else null (fresh seed)
) {
    companion object {
        const val DEFAULT_MAX_STEPS: Int = 32
        const val DEFAULT_APPLICABLE_BIAS: Double = 0.85
        const val DEFAULT_COVERAGE_FROM_BUDGET: Int = 1000
        const val SEED_PROPERTY: String = "hms.pbt.seed"
        fun configuredMasterSeed(): Long?
        fun parseSeed(raw: String?): Long?   // null/blank -> null; not a whole number -> IllegalArgumentException
    }
}

data class Step<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F>(   // unchanged
    val seed: Long, val index: Int, val from: S, val command: C, val facts: F,
    val outcome: Outcome<S, C, P, E>, val holding: Set<P>,
)

class StepCheck<S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F>(
    val name: String,                                  // unique within one run (duplicate -> IllegalArgumentException)
    val appliesTo: (Step<S, C, P, E, F>) -> Boolean,   // required, no default; the property's antecedent
    val check: (Step<S, C, P, E, F>) -> Unit,          // called only when appliesTo is true
)

data class RunStats(
    val name: String, val machine: String, val budget: Int, val sequences: Int, val steps: Long,
    val fired: Long, val refused: Long, val notApplicable: Long, val ambiguous: Long,
    val transitionsCovered: Int, val transitionsTotal: Int, val firedPerTransition: List<Long>,
    val checkApplied: Map<String, Long>,    // by check name: steps the check applied to
    val predicateHeld: List<Long>,          // by predicate ordinal
    val predicateFailed: List<Long>,        // by predicate ordinal
    val masterSeed: Long,                   // ADDED beyond the brief: the replay seed
) {
    fun requireFired(vararg transitionIndexes: Int)
    // AssertionError naming every listed transition that fired zero times ("transition 8, transition 9 never fired
    // in N sequences (master seed X) ..."); IllegalArgumentException for no index or an index out of range.
    // Asserts whatever the budget.
}

fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> runSequences(      // signature unchanged
    name: String, spec: MachineSpec<S, C, P, E>, holds: (P, F) -> Boolean, facts: Arb<F>,
    config: SequenceConfig = SequenceConfig(), checks: List<StepCheck<S, C, P, E, F>> = emptyList(),
): RunStats

fun <S : Enum<S>, C : Enum<C>, P : Enum<P>, E : Enum<E>, F> machineSequenceProperties(  // signature unchanged
    name: String, spec: MachineSpec<S, C, P, E>, holds: (P, F) -> Boolean, facts: Arb<F>,
    config: SequenceConfig = SequenceConfig(),
): TestFactory

object SequenceCounts {
    const val SYSTEM_PROPERTY: String = "hms.pbt.countsDir"
    const val PASS: String = "pass"
    const val FAIL: String = "fail"
    fun fileName(name: String): String
    fun json(stats: RunStats, result: String): String     // CHANGED: takes the result
    fun write(stats: RunStats, result: String): File?      // CHANGED: takes the result; AssertionError on a duplicate file
}
```

Behaviour (what callers must know):

- After every step: P1-P6 as before; P3 is now also checked, with the step's facts, for every (state, command) pair
  that has two or more candidates (kt-01). Candidates are worked out by the harness from `spec.transitions`, not from
  `MachineSpec.candidates` (kt-11).
- `runSequences`, when `budget >= coverageFromBudget`: fails when no step fired ("vacuous: no step fired in N
  sequences") or when any check applied to zero steps ("vacuous: <name> never applied"). All gaps in one message.
- `machineSequenceProperties`, when `budget >= coverageFromBudget`: additionally fails on P7 (lists every transition
  that never fired) and on any predicate that held at every step ("predicate coverage: [X] held at every step (never
  false)") or at none ("predicate coverage: [X] never held"). Test name: "<name>: P1-P7 hold over N random command
  sequences"; below the threshold "<name>: P1-P6 hold over N random command sequences (P7 not asserted below 1000)".
- Every failure message has: master seed, sequence seed, step, trace (step failures), and
  `replay (from backend/): ./gradlew <task> --tests '<spec class>' -Phms.pbt.seed=<master> -Phms.pbt.sequences=<budget>`.
  The task comes from the system property `hms.pbt.testTask` (set by `hms.test-conventions`); the class from the
  Kotest `testCase.spec` (factory) or the call stack (`runSequences`).
- Any Throwable from the Arb, a predicate, the engine, `appliesTo` or `check` is wrapped with seed/step context, except
  `VirtualMachineError` (which propagates unchanged, as briefed; note `StackOverflowError` is one).
- Counts file `<hms.pbt.countsDir>/<name>.json`, keys in order: name, machine, budget, sequences, steps, fired,
  refused, not_applicable, ambiguous, transitions_covered, transitions_total, result ("pass"/"fail"), master_seed,
  fired_per_transition (array by index), check_applied (object by name), predicate_held, predicate_failed (arrays by
  ordinal). Written for a failed run too. A second write of the same file in one JVM fails ("already written").
  `hms.pbt.countsDir` is now `<build>/pbt-counts/<test task name>` (one directory per Test task).

What machine agents must change: every `StepCheck(name) { ... }` becomes
`StepCheck(name, appliesTo = { <antecedent> }, check = { ... })`; give each `runSequences`/`machineSequenceProperties`
call in one test task a distinct `name` (the generated test uses the machine name, so a hand-written
`<P>PropertyTest` must NOT reuse `<P>Machine.MACHINE` as its name); copy the new `ArchitectureTest.kt` template (it now
also contains `internal object DomainDeterminism`); predicates must each be sometimes true and sometimes false in
`<P>Arbs.facts`; SI tests should call `stats.requireFired(...)` for the transitions their property needs.

Engine (`hms.kernel.statemachine`, kt-09): `MachineSpec` now throws `IllegalArgumentException` for a transition whose
`on` is in `createdBy` (spec §1.1 `created_by`: "They have no transition"; §1.2 says nothing otherwise). None of the
eight machine YAMLs has such a transition (checked with a script over `docs/specs/state-machines/*.yaml`).
