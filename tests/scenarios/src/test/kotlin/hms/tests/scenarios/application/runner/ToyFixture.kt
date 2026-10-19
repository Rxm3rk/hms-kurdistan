package hms.tests.scenarios.application.runner

import hms.tests.scenarios.api.BoundPorts
import hms.tests.scenarios.api.PlannedScenario
import hms.tests.scenarios.api.Scenario
import hms.tests.scenarios.api.ScenarioNotBuiltException
import hms.tests.scenarios.api.ScenarioSuite
import hms.tests.scenarios.api.SimulatedClock
import hms.tests.scenarios.api.SuiteBinding
import hms.tests.scenarios.api.SyntheticPatients
import hms.tests.scenarios.api.WaitsOn
import hms.tests.scenarios.api.given
import hms.tests.scenarios.api.then
import hms.tests.scenarios.api.whenever
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

/**
 * A toy, non-clinical fixture for the runner's self-tests: a lamp that a synthetic patient may switch on. It stands
 * in for a domain port so that the runner, the matrix and the exit-code rule can be tested with PASS, FAIL and
 * NOT-BUILT results. It encodes no clinical rule.
 */
interface ToyLampPort {
    fun switchOn(
        patientId: String,
        at: Instant,
    )

    fun switchedOnBy(): String?

    fun switchedOnAt(): Instant?
}

/** The toy lamp's only implementation. */
class ToyLamp : ToyLampPort {
    private var by: String? = null
    private var at: Instant? = null

    override fun switchOn(
        patientId: String,
        at: Instant,
    ) {
        by = patientId
        this.at = at
    }

    override fun switchedOnBy(): String? = by

    override fun switchedOnAt(): Instant? = at
}

object ToyFixture {
    const val AREA: String = "toy-fixture"
    const val UNBOUND_AREA: String = "toy-unbound"
    val waitsOn: WaitsOn = WaitsOn(listOf("WP-0.5"), listOf("PLT-CORE-03"), "KA-064")
    val notBuiltWaitsOn: WaitsOn = WaitsOn(listOf("WP-9.9"), emptyList(), "KA-999", listOf("a toy gate [HUMAN]"))

    fun suite(
        area: String = AREA,
        mockKb: Boolean = false,
        titles: List<String> = listOf("lamp switches on", "lamp assertion fails", "lamp path not built", "lamp not implemented"),
    ): ScenarioSuite =
        ScenarioSuite(
            area = area,
            number = 0,
            title = "Toy fixture",
            hazards = listOf("HAZ-0001"),
            seededHazards = listOf("H1"),
            invariants = listOf("SI-01"),
            mockKb = mockKb,
            waitsOn = waitsOn,
            scenarios = PlannedScenario.numbered(area, titles),
        )

    /** Scenario 1 passes, 2 fails an assertion, 3 throws NOT-BUILT, 4 is catalogued but not implemented. */
    class Binding(
        override val suiteId: String = "SCN-$AREA",
        override val scenarios: List<Scenario> = defaultScenarios(),
    ) : SuiteBinding {
        override fun ports(
            clock: SimulatedClock,
            patients: SyntheticPatients,
        ): BoundPorts = BoundPorts.builder().bind(ToyLampPort::class, ToyLamp()).build()
    }

    fun defaultScenarios(): List<Scenario> =
        listOf(
            Scenario(
                Scenario.idOf(AREA, 1),
                "lamp switches on",
                listOf(
                    given("a synthetic patient") { it.patients.next() },
                    whenever("an hour passes and the patient switches the lamp on") { world ->
                        world.clock.advance(Duration.ofHours(1))
                        world.ports.get<ToyLampPort>().switchOn(
                            world.patients
                                .issued()
                                .single()
                                .id,
                            world.clock.instant(),
                        )
                    },
                    then("the lamp records the patient and the simulated time") { world ->
                        world.ports.get<ToyLampPort>().switchedOnBy() shouldBe "SYN-000001"
                        world.ports.get<ToyLampPort>().switchedOnAt() shouldBe SimulatedClock.DEFAULT_START.plus(Duration.ofHours(1))
                    },
                ),
            ),
            Scenario(
                Scenario.idOf(AREA, 2),
                "lamp assertion fails",
                listOf(
                    then("the lamp is on although nobody switched it on") { world ->
                        world.ports.get<ToyLampPort>().switchedOnBy() shouldBe "SYN-000001"
                    },
                ),
            ),
            Scenario(
                Scenario.idOf(AREA, 3),
                "lamp path not built",
                listOf(
                    given("a path that is not built") { throw ScenarioNotBuiltException(notBuiltWaitsOn, "toy path") },
                    then("never reached") { error("unreachable") },
                ),
            ),
        )
}
