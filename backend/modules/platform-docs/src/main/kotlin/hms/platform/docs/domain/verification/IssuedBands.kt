package hms.platform.docs.domain.verification

import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.domain.rules.ReprintRule

/** Whom a wristband is for: the patient (internal reference, never printed) and the encounter. */
data class BandSubject(
    val patientRef: String,
    val encounterId: String,
)

/** How a wristband request is treated. */
sealed interface BandAdmission {
    /** No band is issued for the patient and encounter: a first band. */
    data object FirstBand : BandAdmission

    /** A reprint of [reprintOf] for [reason]; either asked for, or a second band while one is issued. */
    data class Reprint(
        val reprintOf: String,
        val reason: ReprintReason,
    ) : BandAdmission

    data class Refused(
        val refusal: Refusal,
    ) : BandAdmission
}

/**
 * The bands issued per patient and encounter (docs/specs/modules/platform-docs.md §8.6; DN-071; HAZ-0049), as a pure
 * in-memory state object (KA-077: persistence waits for the cell). A second wristband request for the same patient
 * and encounter while a band is issued is treated as a reprint of the issued band and needs a reason
 * (`print.refused.reprintReasonRequired`); an explicit reprint follows the reprint rule ([ReprintRule]).
 */
class IssuedBands {
    private val issued = HashMap<BandSubject, String>()

    /** Classifies a wristband request; nothing is recorded until [recordIssued]. */
    @Synchronized
    fun admit(
        subject: BandSubject,
        reprintOf: String?,
        reason: ReprintReason?,
    ): BandAdmission {
        val current = issued[subject]
        val ruleRefusal = ReprintRule.check(reprintOf, reason)
        return when {
            ruleRefusal != null -> {
                BandAdmission.Refused(ruleRefusal)
            }

            reprintOf != null && reason != null -> {
                BandAdmission.Reprint(reprintOf, reason)
            }

            current == null -> {
                BandAdmission.FirstBand
            }

            reason == null -> {
                BandAdmission.Refused(
                    Refusal(
                        RefusalReason.REPRINT_REASON_REQUIRED,
                        "reprintReason",
                        "a band is already issued for this patient and encounter: a second band is a reprint",
                    ),
                )
            }

            else -> {
                BandAdmission.Reprint(current, reason)
            }
        }
    }

    /** Records [jobId] as the band issued for [subject] (it supersedes any earlier band). */
    @Synchronized
    fun recordIssued(
        subject: BandSubject,
        jobId: String,
    ) {
        issued[subject] = jobId
    }

    /** Withdraws [jobId] when it is the issued band (for example a job that failed with nothing printed). */
    @Synchronized
    fun withdraw(
        subject: BandSubject,
        jobId: String,
    ): Boolean = issued.remove(subject, jobId)

    @Synchronized
    fun issuedJob(subject: BandSubject): String? = issued[subject]
}
