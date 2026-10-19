package hms.platform.docs.domain.job

import hms.platform.docs.api.HalPrintOutcome

/** The result of asking the lifecycle for a transition: a value, never an exception (BUILD-PROMPT §6.2). */
sealed interface TransitionResult {
    data class Accepted(
        val from: PrintJobState,
        val to: PrintJobState,
    ) : TransitionResult

    /**
     * A HAL outcome reported for a job already outcome-unknown: accepted for the audit record
     * (`PrintOutcome.LATE_OUTCOME`), the state stays [PrintJobState.OUTCOME_UNKNOWN] (spec §8.1).
     */
    data class LateOutcome(
        val reported: PrintJobState,
    ) : TransitionResult

    data class Rejected(
        val from: PrintJobState,
        val attempted: PrintJobState,
        val detail: String,
    ) : TransitionResult
}

/**
 * The print-job lifecycle (docs/specs/modules/platform-docs.md §8.1; docs/specs/state-machines/print-job.yaml):
 *
 * - requested → refused | failed | rendered
 * - rendered → dispatched | completed | failed | outcome-unknown
 * - dispatched → completed | failed | outcome-unknown
 * - refused, failed, completed and outcome-unknown are terminal and accept nothing, except that a HAL outcome reported
 *   on an outcome-unknown job is a [TransitionResult.LateOutcome].
 *
 * There is no transition into requested, rendered or dispatched from a terminal state and no retry operation: a job
 * is never retried by itself (HAZ-0049); a reprint is a new job with `reprintOf` and a reason.
 */
object PrintJobLifecycle {
    private val transitions: Map<PrintJobState, Set<PrintJobState>> =
        mapOf(
            PrintJobState.REQUESTED to setOf(PrintJobState.REFUSED, PrintJobState.FAILED, PrintJobState.RENDERED),
            PrintJobState.RENDERED to
                setOf(PrintJobState.DISPATCHED, PrintJobState.COMPLETED, PrintJobState.FAILED, PrintJobState.OUTCOME_UNKNOWN),
            PrintJobState.DISPATCHED to setOf(PrintJobState.COMPLETED, PrintJobState.FAILED, PrintJobState.OUTCOME_UNKNOWN),
        )

    /** The states [from] may move to; empty for a terminal state. */
    fun allowedFrom(from: PrintJobState): Set<PrintJobState> = transitions[from].orEmpty()

    fun transition(
        from: PrintJobState,
        to: PrintJobState,
    ): TransitionResult =
        if (to in allowedFrom(from)) {
            TransitionResult.Accepted(from, to)
        } else {
            TransitionResult.Rejected(from, to, "${from.name} does not move to ${to.name}")
        }

    /**
     * The state a HAL outcome means: `sent` → dispatched, `completed` → completed, an error with `outcomeUnknown`
     * → outcome-unknown, any other error → failed.
     */
    fun stateFor(outcome: HalPrintOutcome): PrintJobState =
        when (outcome) {
            HalPrintOutcome.Sent -> PrintJobState.DISPATCHED
            HalPrintOutcome.Completed -> PrintJobState.COMPLETED
            is HalPrintOutcome.Error -> if (outcome.outcomeUnknown) PrintJobState.OUTCOME_UNKNOWN else PrintJobState.FAILED
        }

    /** `ReportPrintOutcome` (spec §12) on a job in [from]; only a rendered or dispatched job takes one. */
    fun onHalOutcome(
        from: PrintJobState,
        outcome: HalPrintOutcome,
    ): TransitionResult =
        when (from) {
            PrintJobState.OUTCOME_UNKNOWN -> TransitionResult.LateOutcome(stateFor(outcome))

            // Nothing was sent to the HAL before rendering, so no HAL report applies (a render error is not a HAL outcome).
            PrintJobState.REQUESTED -> TransitionResult.Rejected(from, stateFor(outcome), "a job not yet rendered has no HAL outcome")

            else -> transition(from, stateFor(outcome))
        }

    /**
     * A reprint after an unknown or pending outcome cancels formats still queued in the printer (`~JA`, spec §8.6):
     * the original job, if rendered or dispatched, becomes outcome-unknown (it may have printed).
     */
    fun cancelledByReprint(from: PrintJobState): TransitionResult =
        if (from == PrintJobState.RENDERED || from == PrintJobState.DISPATCHED) {
            TransitionResult.Accepted(from, PrintJobState.OUTCOME_UNKNOWN)
        } else {
            TransitionResult.Rejected(from, PrintJobState.OUTCOME_UNKNOWN, "only a rendered or dispatched job is cancelled by a reprint")
        }
}
