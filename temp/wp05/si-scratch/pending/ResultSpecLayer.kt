package hms.tests.invariants

import hms.kernel.testing.statemachine.Step
import hms.results.domain.result.RegisterStatus
import hms.results.domain.result.ResultArbs
import hms.results.domain.result.ResultCommand
import hms.results.domain.result.ResultEffect
import hms.results.domain.result.ResultEffect.RECORD_AUTOVERIFICATION_BASIS
import hms.results.domain.result.ResultEffect.ROUTE_TO_DISCHARGED_PATIENT_QUEUE
import hms.results.domain.result.ResultEffect.ROUTE_TO_PENDING_AT_DISCHARGE_QUEUE
import hms.results.domain.result.ResultEffect.ROUTE_TO_RESPONSIBLE_CLINICIAN
import hms.results.domain.result.ResultFacts
import hms.results.domain.result.ResultGuards
import hms.results.domain.result.ResultMachine
import hms.results.domain.result.ResultPredicate
import hms.results.domain.result.ResultPredicate.AUTOVERIFICATION_ACTIVE
import hms.results.domain.result.ResultPredicate.PATIENT_DISCHARGED
import hms.results.domain.result.ResultState
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe

private typealias ResultStep = Step<ResultState, ResultCommand, ResultPredicate, ResultEffect, ResultFacts>
private typealias ResultProperty = SpecLayerCheck<ResultState, ResultCommand, ResultPredicate, ResultEffect, ResultFacts>

/**
 * The specification-layer properties the result machine encodes (docs/specs/modules/state-machines-and-invariants.md
 * §4; docs/specs/state-machines/result.yaml), keyed by the test names the hazard log plans.
 */
internal object ResultSpecLayer {
    private val pending = setOf(ResultState.REGISTERED, ResultState.PRELIMINARY)
    private val permitted = setOf(RegisterStatus.CLEARED, RegisterStatus.NOT_REQUIRED)

    /** The properties, by hazard-log name. */
    val layer by lazy {
        MachineSpecLayer(
            spec = ResultMachine.spec,
            holds = { predicate, facts -> ResultMachine.holds(predicate, ResultGuards, facts) },
            facts = ResultArbs.facts,
            properties = properties,
        )
    }

    /** The step filed a version to the results inbox (every release, revision, amendment and correction). */
    private fun filed(step: ResultStep): Boolean = step.fired?.effects?.contains(ROUTE_TO_RESPONSIBLE_CLINICIAN) == true

    private fun autoverify(step: ResultStep): Boolean = step.command == ResultCommand.Autoverify

    private fun registerPermits(step: ResultStep): Boolean {
        val auto = step.facts.autoverification
        val entry = auto.registerEntry
        return entry != null &&
            entry.status in permitted &&
            entry.functionVersion == auto.runningFunctionVersion &&
            entry.jurisdiction == auto.tenantJurisdiction &&
            !entry.opinion?.documentRef.isNullOrBlank() &&
            entry.opinion?.expiresAt?.isAfter(step.facts.now) == true
    }

    private fun flagWithoutRegister(step: ResultStep): Boolean = step.facts.autoverification.tenantFlagOn && !registerPermits(step)

    private val properties: Map<String, ResultProperty> =
        mapOf(
            "PropertyTest:SI-17-pending-results-at-discharge-go-to-owned-queue" to
                ResultProperty(
                    { it.command == ResultCommand.RecordPatientDischarged && it.from in pending && PATIENT_DISCHARGED in it.holding },
                    { it.on == ResultCommand.RecordPatientDischarged },
                ) { step ->
                    withClue("SI-17 clause a: a result pending at discharge goes to the owned pending-at-discharge queue") {
                        (step.fired?.effects?.contains(ROUTE_TO_PENDING_AT_DISCHARGE_QUEUE) == true) shouldBe true
                    }
                },
            "PropertyTest:SI-17-result-for-discharged-patient-goes-to-owned-queue" to
                ResultProperty(
                    { filed(it) && PATIENT_DISCHARGED in it.holding },
                    { ROUTE_TO_DISCHARGED_PATIENT_QUEUE in it.effects },
                ) { step ->
                    withClue("SI-17 clause b: a result filed for a discharged patient also goes to the owned discharged-patient queue") {
                        (step.fired?.effects?.contains(ROUTE_TO_DISCHARGED_PATIENT_QUEUE) == true) shouldBe true
                    }
                },
            "PropertyTest:SI-18-activation-only-when-cleared-or-not-required" to
                ResultProperty({ autoverify(it) && it.fired != null }, { it.on == ResultCommand.Autoverify }) { step ->
                    withClue("SI-18 clause a: autoverification releases only under a cleared or not-required Register entry") {
                        (AUTOVERIFICATION_ACTIVE in step.holding) shouldBe true
                        registerPermits(step) shouldBe true
                        (step.fired?.effects?.contains(RECORD_AUTOVERIFICATION_BASIS) == true) shouldBe true
                    }
                },
            "PropertyTest:SI-18-configuration-toggle-cannot-override-register" to
                ResultProperty(
                    { autoverify(it) && it.from == ResultState.REGISTERED && flagWithoutRegister(it) },
                    { it.on == ResultCommand.Autoverify },
                ) { step ->
                    withClue("SI-18 clause d: the tenant flag alone never releases a result by autoverification") {
                        step.fired shouldBe null
                    }
                },
        )
}
