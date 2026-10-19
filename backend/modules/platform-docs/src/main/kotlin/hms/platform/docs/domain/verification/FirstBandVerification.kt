package hms.platform.docs.domain.verification

import hms.platform.docs.api.FirstBandResult
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PrinterProfile
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.job.PrintJobState

/**
 * What keys first-band verification (docs/specs/modules/platform-docs.md §6.3; DN-072): a change of any field is a
 * "template or printer change" (BUILD-PROMPT §12.8). The resident font hashes count for ZPL text mode only, where
 * the printer's own fonts draw the text.
 */
data class VerificationKey(
    val templateId: String,
    val templateVersion: Int,
    val templateHash: String,
    val printerSerial: String,
    val firmware: String,
    val mode: OutputMode,
    val dotsPerMm: Double,
    val mediaWidthMm: Double?,
    val mediaLengthMm: Double?,
    val residentFontSha256: Map<String, String>,
) {
    companion object {
        fun of(
            templateId: String,
            templateVersion: Int,
            templateHash: String,
            printer: PrinterProfile,
        ): VerificationKey =
            VerificationKey(
                templateId = templateId,
                templateVersion = templateVersion,
                templateHash = templateHash,
                printerSerial = printer.serial,
                firmware = printer.firmware,
                mode = printer.mode,
                dotsPerMm = printer.dotsPerMm,
                mediaWidthMm = printer.mediaWidthMm,
                mediaLengthMm = printer.mediaLengthMm,
                residentFontSha256 = if (printer.mode == OutputMode.ZPL_TEXT) printer.residentFontSha256 else emptyMap(),
            )
    }
}

/** The verification state of a key. A key never seen is [REQUIRED] (fail closed). */
enum class FirstBandState {
    /** The next wristband on the key is a first band and must be scan-verified. */
    REQUIRED,

    /** A first band was admitted and waits for verification; further wristbands are refused. */
    PENDING,

    VERIFIED,

    /** A first band did not match; wristbands are refused until the key is reset after the band was removed. */
    BLOCKED,
}

/** Whether a wristband may print on its key. */
sealed interface FirstBandAdmission {
    data class Admitted(
        /** True for a first band: the result says `scan-verification-required` (spec §12 `PrintResult.Rendered`). */
        val scanVerificationRequired: Boolean,
    ) : FirstBandAdmission

    data class Refused(
        val refusal: Refusal,
    ) : FirstBandAdmission
}

/** The outcome of a request that changes a key's state other than admission or verification. */
sealed interface FirstBandChange {
    /** The key changed; the next wristband on it is a first band again. */
    data object Released : FirstBandChange

    /** Nothing changed; [detail] says why (for the screen and the audit record). */
    data class Rejected(
        val detail: String,
    ) : FirstBandChange
}

/**
 * First-band scan verification as a pure in-memory state object (spec §6.3 as revised in the round-3 review;
 * DN-072; HAZ-0046; KA-077: persistence waits for the cell). One instance holds every key of one process.
 *
 * - [admit]: on a key in [FirstBandState.REQUIRED] the wristband is admitted as the first band and the key becomes
 *   pending; on a pending or blocked key it is refused (`print.refused.firstBandPending`); on a verified key it is
 *   admitted with no verification.
 * - [verify]: the scanned payload must equal the expected payload exactly (no trimming, no case folding) **and** the
 *   user must confirm the printed name forms, MRN and date of birth on screen; otherwise the band is unusable and the
 *   key blocked.
 * - [jobEnded]: a first job that ends refused or failed (nothing printed) releases the key; a first job whose outcome
 *   is unknown keeps it pending until the band is verified or the user declares that no band came out
 *   ([declareNoBandPrinted]).
 * - [reset]: a blocked key is released only when the user records that the mismatched band was removed from the
 *   patient, with a reason.
 */
class FirstBandVerification {
    private sealed interface Entry {
        data class Pending(
            val jobId: String,
            val expectedPayload: String,
            val outcomeUnknown: Boolean,
        ) : Entry

        data object Verified : Entry

        data class Blocked(
            val jobId: String,
        ) : Entry
    }

    private val entries = HashMap<VerificationKey, Entry>()
    private val keysByJob = HashMap<String, VerificationKey>()

    @Synchronized
    fun stateOf(key: VerificationKey): FirstBandState =
        when (entries[key]) {
            null -> FirstBandState.REQUIRED
            is Entry.Pending -> FirstBandState.PENDING
            Entry.Verified -> FirstBandState.VERIFIED
            is Entry.Blocked -> FirstBandState.BLOCKED
        }

    /** Admits or refuses wristband [jobId] on [key]; [expectedPayload] is the band's barcode payload. */
    @Synchronized
    fun admit(
        key: VerificationKey,
        jobId: String,
        expectedPayload: String,
    ): FirstBandAdmission =
        when (entries[key]) {
            null -> {
                entries[key] = Entry.Pending(jobId, expectedPayload, outcomeUnknown = false)
                keysByJob[jobId] = key
                FirstBandAdmission.Admitted(scanVerificationRequired = true)
            }

            Entry.Verified -> {
                FirstBandAdmission.Admitted(scanVerificationRequired = false)
            }

            is Entry.Pending -> {
                refused("the first band on this printer and template waits for scan verification")
            }

            is Entry.Blocked -> {
                refused("the first band did not match; remove it and reset before printing")
            }
        }

    /** Verifies the first band of [jobId] (`VerifyFirstBand`, spec §12). */
    @Synchronized
    fun verify(
        jobId: String,
        scannedPayload: String,
        visualMatchConfirmed: Boolean,
    ): FirstBandResult {
        val key = keysByJob[jobId]
        val pending = key?.let { entries[it] } as? Entry.Pending
        return when {
            key == null || pending == null || pending.jobId != jobId -> {
                FirstBandResult.NotPending
            }

            scannedPayload == pending.expectedPayload && visualMatchConfirmed -> {
                entries[key] = Entry.Verified
                FirstBandResult.Verified
            }

            else -> {
                entries[key] = Entry.Blocked(jobId)
                FirstBandResult.Mismatch(if (visualMatchConfirmed) "scanned payload differs" else "visual match not confirmed")
            }
        }
    }

    /**
     * Tells the key how its first job ended: [PrintJobState.REFUSED] or [PrintJobState.FAILED] release it (no band
     * came out); [PrintJobState.OUTCOME_UNKNOWN] keeps it pending and allows [declareNoBandPrinted]; other states
     * change nothing.
     */
    @Synchronized
    fun jobEnded(
        jobId: String,
        state: PrintJobState,
    ): FirstBandChange {
        val key = keysByJob[jobId]
        val pending = key?.let { entries[it] } as? Entry.Pending
        return when {
            key == null || pending == null || pending.jobId != jobId -> {
                FirstBandChange.Rejected("no first band pending for this job")
            }

            state == PrintJobState.REFUSED || state == PrintJobState.FAILED -> {
                release(key, jobId)
            }

            state == PrintJobState.OUTCOME_UNKNOWN -> {
                entries[key] = pending.copy(outcomeUnknown = true)
                FirstBandChange.Rejected("outcome unknown: the key stays pending until the band is verified or declared not printed")
            }

            else -> {
                FirstBandChange.Rejected("the job state ${state.name} does not release the key")
            }
        }
    }

    /** `DeclareNoBandPrinted`: only for a pending first job whose outcome is unknown. */
    @Synchronized
    fun declareNoBandPrinted(jobId: String): FirstBandChange {
        val key = keysByJob[jobId]
        val pending = key?.let { entries[it] } as? Entry.Pending
        return when {
            key == null || pending == null || pending.jobId != jobId -> FirstBandChange.Rejected("no first band pending for this job")
            !pending.outcomeUnknown -> FirstBandChange.Rejected("only a first job with an unknown outcome can be declared not printed")
            else -> release(key, jobId)
        }
    }

    /** `ResetFirstBandKey`: releases the key [jobId] blocked, once the mismatched band was removed, with a reason. */
    @Synchronized
    fun reset(
        jobId: String,
        mismatchedBandRemoved: Boolean,
        reason: String,
    ): FirstBandChange {
        val key = keysByJob[jobId]
        val blocked = key?.let { entries[it] } as? Entry.Blocked
        return when {
            key == null || blocked == null || blocked.jobId != jobId -> FirstBandChange.Rejected("no key blocked by this job")
            !mismatchedBandRemoved -> FirstBandChange.Rejected("the mismatched band must be removed from the patient first")
            reason.isBlank() -> FirstBandChange.Rejected("a reset needs a reason")
            else -> release(key, jobId)
        }
    }

    private fun release(
        key: VerificationKey,
        jobId: String,
    ): FirstBandChange {
        entries.remove(key)
        keysByJob.remove(jobId)
        return FirstBandChange.Released
    }

    private fun refused(detail: String): FirstBandAdmission =
        FirstBandAdmission.Refused(Refusal(RefusalReason.FIRST_BAND_PENDING, "firstBand", detail))
}
