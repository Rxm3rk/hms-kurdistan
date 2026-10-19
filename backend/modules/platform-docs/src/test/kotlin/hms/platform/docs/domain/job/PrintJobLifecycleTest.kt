package hms.platform.docs.domain.job

import hms.platform.docs.api.HalPrintOutcome
import io.kotest.core.spec.style.FunSpec
import io.kotest.datatest.withTests
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

private val legal: Set<Pair<PrintJobState, PrintJobState>> =
    setOf(
        PrintJobState.REQUESTED to PrintJobState.REFUSED,
        PrintJobState.REQUESTED to PrintJobState.FAILED,
        PrintJobState.REQUESTED to PrintJobState.RENDERED,
        PrintJobState.RENDERED to PrintJobState.DISPATCHED,
        PrintJobState.RENDERED to PrintJobState.COMPLETED,
        PrintJobState.RENDERED to PrintJobState.FAILED,
        PrintJobState.RENDERED to PrintJobState.OUTCOME_UNKNOWN,
        PrintJobState.DISPATCHED to PrintJobState.COMPLETED,
        PrintJobState.DISPATCHED to PrintJobState.FAILED,
        PrintJobState.DISPATCHED to PrintJobState.OUTCOME_UNKNOWN,
    )

private val allPairs = PrintJobState.entries.flatMap { from -> PrintJobState.entries.map { to -> from to to } }

private val halOutcomes: List<HalPrintOutcome> =
    listOf(
        HalPrintOutcome.Sent,
        HalPrintOutcome.Completed,
        HalPrintOutcome.Error("device", "paper out", outcomeUnknown = false),
        HalPrintOutcome.Error("timeout", "no answer", outcomeUnknown = true),
    )

class PrintJobLifecycleTest :
    FunSpec({
        context("every legal transition is accepted (spec §8.1)") {
            withTests(nameFn = { "${it.first} -> ${it.second}" }, legal.toList()) { (from, to) ->
                PrintJobLifecycle.transition(from, to) shouldBe TransitionResult.Accepted(from, to)
            }
        }

        context("every other transition is rejected as a value, not an exception") {
            withTests(nameFn = { "${it.first} -> ${it.second}" }, allPairs.filterNot { it in legal }) { (from, to) ->
                PrintJobLifecycle.transition(from, to).shouldBeInstanceOf<TransitionResult.Rejected>().let {
                    it.from shouldBe from
                    it.attempted shouldBe to
                }
            }
        }

        test("terminal states accept nothing") {
            PrintJobState.entries.filter { it.terminal }.forEach { PrintJobLifecycle.allowedFrom(it) shouldBe emptySet() }
            PrintJobState.entries.filterNot { it.terminal }.forEach { (PrintJobLifecycle.allowedFrom(it).isNotEmpty()) shouldBe true }
        }

        test("HAL outcomes map to states") {
            PrintJobLifecycle.stateFor(HalPrintOutcome.Sent) shouldBe PrintJobState.DISPATCHED
            PrintJobLifecycle.stateFor(HalPrintOutcome.Completed) shouldBe PrintJobState.COMPLETED
            PrintJobLifecycle.stateFor(halOutcomes[2]) shouldBe PrintJobState.FAILED
            PrintJobLifecycle.stateFor(halOutcomes[3]) shouldBe PrintJobState.OUTCOME_UNKNOWN
        }

        test("HAL outcomes on a rendered and a dispatched job") {
            PrintJobLifecycle.onHalOutcome(PrintJobState.RENDERED, HalPrintOutcome.Sent) shouldBe
                TransitionResult.Accepted(PrintJobState.RENDERED, PrintJobState.DISPATCHED)
            PrintJobLifecycle.onHalOutcome(PrintJobState.DISPATCHED, HalPrintOutcome.Completed) shouldBe
                TransitionResult.Accepted(PrintJobState.DISPATCHED, PrintJobState.COMPLETED)
            PrintJobLifecycle.onHalOutcome(PrintJobState.DISPATCHED, halOutcomes[3]) shouldBe
                TransitionResult.Accepted(PrintJobState.DISPATCHED, PrintJobState.OUTCOME_UNKNOWN)
            PrintJobLifecycle.onHalOutcome(PrintJobState.DISPATCHED, HalPrintOutcome.Sent).shouldBeInstanceOf<TransitionResult.Rejected>()
        }

        test("a HAL outcome before rendering, or on a completed, failed or refused job, is rejected") {
            listOf(PrintJobState.REQUESTED, PrintJobState.COMPLETED, PrintJobState.FAILED, PrintJobState.REFUSED).forEach { state ->
                halOutcomes.forEach { PrintJobLifecycle.onHalOutcome(state, it).shouldBeInstanceOf<TransitionResult.Rejected>() }
            }
        }

        test("a HAL outcome on an outcome-unknown job is a late outcome: accepted for audit, state unchanged") {
            halOutcomes.forEach { outcome ->
                PrintJobLifecycle.onHalOutcome(PrintJobState.OUTCOME_UNKNOWN, outcome) shouldBe
                    TransitionResult.LateOutcome(PrintJobLifecycle.stateFor(outcome))
            }
        }

        test("a reprint cancels a rendered or dispatched job into outcome-unknown, nothing else") {
            PrintJobLifecycle.cancelledByReprint(PrintJobState.RENDERED) shouldBe
                TransitionResult.Accepted(PrintJobState.RENDERED, PrintJobState.OUTCOME_UNKNOWN)
            PrintJobLifecycle.cancelledByReprint(PrintJobState.DISPATCHED) shouldBe
                TransitionResult.Accepted(PrintJobState.DISPATCHED, PrintJobState.OUTCOME_UNKNOWN)
            PrintJobState.entries.filterNot { it == PrintJobState.RENDERED || it == PrintJobState.DISPATCHED }.forEach {
                PrintJobLifecycle.cancelledByReprint(it).shouldBeInstanceOf<TransitionResult.Rejected>()
            }
        }

        test("UnitTest:no-automatic-reprint: nothing leads back to requested, rendered or dispatched from a terminal state") {
            PrintJobState.entries.forEach { from ->
                (PrintJobState.REQUESTED in PrintJobLifecycle.allowedFrom(from)) shouldBe false
                if (from.terminal) {
                    listOf(PrintJobState.RENDERED, PrintJobState.DISPATCHED).forEach { to ->
                        PrintJobLifecycle.transition(from, to).shouldBeInstanceOf<TransitionResult.Rejected>()
                    }
                }
            }
            // A failed or unknown outcome is final: no HAL report turns it into a new attempt.
            halOutcomes.forEach { outcome ->
                PrintJobLifecycle.onHalOutcome(PrintJobState.FAILED, outcome).shouldBeInstanceOf<TransitionResult.Rejected>()
                (PrintJobLifecycle.onHalOutcome(PrintJobState.OUTCOME_UNKNOWN, outcome) is TransitionResult.Accepted) shouldBe false
            }
        }
    })
