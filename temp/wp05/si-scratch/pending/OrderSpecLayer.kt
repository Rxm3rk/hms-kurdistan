package hms.tests.invariants

import hms.kernel.testing.statemachine.Step
import hms.orders.domain.order.ConnectivityMode
import hms.orders.domain.order.DoseBasis
import hms.orders.domain.order.OrderArbs
import hms.orders.domain.order.OrderCommand
import hms.orders.domain.order.OrderEffect
import hms.orders.domain.order.OrderFacts
import hms.orders.domain.order.OrderGuards
import hms.orders.domain.order.OrderMachine
import hms.orders.domain.order.OrderPredicate
import hms.orders.domain.order.OrderPredicate.IDENTITY_REVERIFICATION_SATISFIED
import hms.orders.domain.order.OrderPredicate.NOT_OFFLINE_WITHOUT_FULL_CDS
import hms.orders.domain.order.OrderState
import hms.orders.domain.order.PrincipalKind
import hms.orders.domain.order.ReverificationOutcome
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe
import java.time.Duration

private typealias OrderStep = Step<OrderState, OrderCommand, OrderPredicate, OrderEffect, OrderFacts>
private typealias OrderProperty = SpecLayerCheck<OrderState, OrderCommand, OrderPredicate, OrderEffect, OrderFacts>

/**
 * The specification-layer properties the order machine encodes (docs/specs/modules/state-machines-and-invariants.md
 * §4; docs/specs/state-machines/order.yaml), keyed by the test names the hazard log plans. Each states its SI over the
 * outcome of every step, reading the facts where they carry the answer, so a transition added later that signs an
 * order without the SI's condition fails it.
 */
internal object OrderSpecLayer {
    /** SI-16's floor: the re-verification window is never read as less than 60 s (§2.1 SI-16; order.yaml). */
    private val minimumWindow: Duration = Duration.ofSeconds(60)

    private val onSiteCellReachable = setOf(ConnectivityMode.ONLINE, ConnectivityMode.INTERNET_LOST, ConnectivityMode.WAN_LOST)

    private val reachesTerminal by lazy { statesReachingTerminal(OrderMachine.spec) }

    /** The properties, by hazard-log name. */
    val layer by lazy {
        MachineSpecLayer(
            spec = OrderMachine.spec,
            holds = { predicate, facts -> OrderMachine.holds(predicate, OrderGuards, facts) },
            facts = OrderArbs.facts,
            properties = properties,
        )
    }

    private fun signed(step: OrderStep): Boolean = step.fired?.on == OrderCommand.Sign

    private val properties: Map<String, OrderProperty> =
        mapOf(
            "PropertyTest:SI-03-every-order-reaches-a-terminal-state" to
                OrderProperty({ true }, { it.to in OrderMachine.spec.terminal }) { step ->
                    withClue("SI-03 clause a: from every state an order reaches, completed, revoked or entered-in-error is reachable") {
                        (step.outcome.state in reachesTerminal) shouldBe true
                    }
                },
            "PropertyTest:SI-05-no-weight-based-medicine-signed-without-dated-weight" to
                OrderProperty(
                    { signed(it) && it.facts.order.doseBasis in setOf(DoseBasis.PER_BODY_WEIGHT, DoseBasis.PER_BODY_SURFACE_AREA) },
                    { it.on == OrderCommand.Sign },
                ) { step ->
                    val weight = step.facts.patient.dosingWeight
                    withClue("SI-05 clause a: a weight- or BSA-based order is signed only with a dated, sourced dosing weight") {
                        (weight?.recordedAt != null && weight.source != null) shouldBe true
                    }
                },
            "PropertyTest:SI-07-ai-never-signs-orders" to
                OrderProperty(::signed, { it.on == OrderCommand.Sign }) { step ->
                    withClue("SI-07 clause b: only an authenticated human signs an order") {
                        step.facts.issuer.kind shouldBe PrincipalKind.HUMAN
                        step.facts.issuer.authenticatedForThisCommand shouldBe true
                    }
                },
            "PropertyTest:SI-15-no-new-prescribing-without-full-cds-offline" to
                OrderProperty(::signed, { it.on == OrderCommand.Sign }) { step ->
                    val mode = step.facts.issuedInMode
                    withClue("SI-15 clause a: signed offline only with notOfflineWithoutFullCds; never in an unknown mode") {
                        (mode != null && (mode in onSiteCellReachable || NOT_OFFLINE_WITHOUT_FULL_CDS in step.holding)) shouldBe true
                    }
                },
            "PropertyTest:SI-16-re-verification-at-signing-after-recent-context-change" to
                OrderProperty({ signed(it) && recentChange(it) }, { it.on == OrderCommand.Sign }) { step ->
                    val change = step.facts.identity.lastChangeAt
                    val latest =
                        step.facts.identity.answers
                            .filter { answer -> if (change == null) answer.forThisCommand else answer.recordedAt?.isAfter(change) == true }
                            .lastOrNull()
                    withClue("SI-16 clause f: identity is re-verified at signing by the signer when the context changed within 60 s") {
                        (IDENTITY_REVERIFICATION_SATISFIED in step.holding) shouldBe true
                        latest?.outcome shouldBe ReverificationOutcome.CONFIRMED
                        latest?.userId shouldBe step.facts.issuer.userId
                    }
                },
        )

    /** The context changed within the window before the server's time, or the change time is unknown (fails closed). */
    private fun recentChange(step: OrderStep): Boolean {
        val change = step.facts.identity.lastChangeAt ?: return true
        val window = maxOf(step.facts.identity.tenantWindow ?: minimumWindow, minimumWindow)
        val elapsed = Duration.between(change, step.facts.serverTime)
        return elapsed.isNegative || elapsed <= window
    }
}
