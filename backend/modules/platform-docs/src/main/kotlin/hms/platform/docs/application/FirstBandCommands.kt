package hms.platform.docs.application

import hms.platform.docs.api.DeclareNoBandPrinted
import hms.platform.docs.api.FirstBandResult
import hms.platform.docs.api.ResetFirstBandKey
import hms.platform.docs.api.VerifyFirstBand
import hms.platform.docs.domain.audit.PrintOutcome
import hms.platform.docs.domain.verification.FirstBandChange

/**
 * The first-band commands (docs/specs/modules/platform-docs.md §6.3; DN-072; HAZ-0046): `VerifyFirstBand`,
 * `DeclareNoBandPrinted` and `ResetFirstBandKey`. Each one that changes a key is audited first (outcomes
 * `FIRST_BAND_VERIFIED`, `FIRST_BAND_MISMATCH`, `FIRST_BAND_NONE_PRINTED`, `FIRST_BAND_KEY_RESET`); if the audit record
 * cannot be written nothing changes and the command may be repeated. A command that does not apply (no first band
 * pending, nothing blocked, no reason) changes nothing and is answered as rejected.
 *
 * Who may verify (a user allowed to print wristbands at that workstation) is the policy point's decision (WP-0.4);
 * until it exists the command context is recorded in the audit record and not checked.
 */
internal class FirstBandCommands(
    private val state: PrintState,
    private val recorder: PrintRecorder,
) {
    fun verify(command: VerifyFirstBand): FirstBandResult {
        val job = state.jobs[command.jobId]
        val first = job?.firstBand
        val pending = job?.firstBandStatus == FirstBandStatus.PENDING || job?.firstBandStatus == FirstBandStatus.PENDING_OUTCOME_UNKNOWN
        return if (job == null || first == null || !pending) {
            FirstBandResult.NotPending
        } else {
            // Exact comparison, no trimming or case folding; a match without the visual confirmation is a mismatch.
            val matches = command.scannedPayload == first.expectedPayload && command.visualMatchConfirmed
            val outcome = if (matches) PrintOutcome.FIRST_BAND_VERIFIED else PrintOutcome.FIRST_BAND_MISMATCH
            if (recorder.audit(command.context, job.facts, outcome)) {
                state.firstBands.verify(command.jobId, command.scannedPayload, command.visualMatchConfirmed).also { result ->
                    job.firstBandStatus = if (result == FirstBandResult.Verified) FirstBandStatus.VERIFIED else FirstBandStatus.BLOCKED
                }
            } else {
                FirstBandResult.AuditUnavailable
            }
        }
    }

    fun declareNoBandPrinted(command: DeclareNoBandPrinted): FirstBandKeyResult {
        val job = state.jobs[command.jobId]
        return when {
            job == null || job.firstBandStatus != FirstBandStatus.PENDING_OUTCOME_UNKNOWN -> {
                FirstBandKeyResult.Rejected("only a first band whose outcome is unknown can be declared not printed")
            }

            !recorder.audit(command.context, job.facts, PrintOutcome.FIRST_BAND_NONE_PRINTED) -> {
                FirstBandKeyResult.AuditUnavailable
            }

            else -> {
                released(job, state.firstBands.declareNoBandPrinted(command.jobId)).also {
                    // No band came out: the patient and encounter have no band from this job.
                    job.bandSubject?.let { subject -> state.issuedBands.withdraw(subject, command.jobId) }
                }
            }
        }
    }

    fun reset(command: ResetFirstBandKey): FirstBandKeyResult {
        val job = state.jobs[command.jobId]
        return when {
            job == null || job.firstBandStatus != FirstBandStatus.BLOCKED -> {
                FirstBandKeyResult.Rejected("no key is blocked by this job")
            }

            !command.mismatchedBandRemoved -> {
                FirstBandKeyResult.Rejected("the mismatched band must be removed from the patient first")
            }

            command.reason.isBlank() -> {
                FirstBandKeyResult.Rejected("a reset needs a reason")
            }

            !recorder.audit(command.context, job.facts, PrintOutcome.FIRST_BAND_KEY_RESET) -> {
                FirstBandKeyResult.AuditUnavailable
            }

            else -> {
                released(job, state.firstBands.reset(command.jobId, mismatchedBandRemoved = true, reason = command.reason))
            }
        }
    }

    private fun released(
        job: JobRecord,
        change: FirstBandChange,
    ): FirstBandKeyResult =
        when (change) {
            FirstBandChange.Released -> {
                job.firstBandStatus = FirstBandStatus.RELEASED
                FirstBandKeyResult.Released
            }

            is FirstBandChange.Rejected -> {
                FirstBandKeyResult.Rejected(change.detail)
            }
        }
}
