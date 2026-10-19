package hms.tests.scenarios.api

/**
 * Binds a catalogued suite to the domain (docs/specs/modules/state-machines-and-invariants.md §5). The work package
 * that builds a suite's domain implements this interface, registers it as a `java.util.ServiceLoader` provider
 * (`META-INF/services/hms.tests.scenarios.api.SuiteBinding`) and adds its project to `tests/scenarios`.
 *
 * A suite with no binding is NOT-BUILT. A bound suite runs [scenarios]; every catalogued scenario the binding
 * does not implement is still NOT-BUILT, so a registered scenario never disappears from the matrix.
 */
interface SuiteBinding {
    /** The [ScenarioSuite.id] this binding serves, `SCN-<area>`. */
    val suiteId: String

    /** The executable scenarios; each id is `SCN-<area>-nnn` of this suite. */
    val scenarios: List<Scenario>

    /** Binds the domain ports for one scenario, on that scenario's own clock and patient factory. */
    fun ports(
        clock: SimulatedClock,
        patients: SyntheticPatients,
    ): BoundPorts
}

/**
 * Thrown by a step whose path is not built yet. The runner reports the scenario as NOT-BUILT with [waitsOn], never as
 * a pass (BUILD-PROMPT §3.5: no silent stubs).
 */
class ScenarioNotBuiltException(
    val waitsOn: WaitsOn,
    reason: String,
) : IllegalStateException("NOT-BUILT: $reason; ${waitsOn.describe()}")
