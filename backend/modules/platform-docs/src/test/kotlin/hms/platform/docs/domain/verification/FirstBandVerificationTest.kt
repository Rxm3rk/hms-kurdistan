package hms.platform.docs.domain.verification

import hms.platform.docs.api.FirstBandResult
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PrinterProfile
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.job.PrintJobState
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf

private const val PAYLOAD = "HMS1|M:SYN-0000123|E:SYN-E-000042|B:J-1"

private val printer =
    PrinterProfile(
        printerId = "SYN-PRN-1",
        mode = OutputMode.ZPL_RASTER,
        dotsPerMm = 8.0,
        printheadWidthDots = 832,
        model = "ZD621",
        serial = "SYN-SER-1",
        firmware = "V93.21.26Z",
        mediaWidthMm = 25.4,
        mediaLengthMm = 279.4,
        residentFontSha256 = mapOf("E:NSARAB.TTF" to "f".repeat(64)),
    )

private val key = VerificationKey.of("SYN-WRISTBAND-ADULT", 1, "a".repeat(64), printer)

private fun FirstBandVerification.admitFirst(jobId: String = "J-1") {
    admit(key, jobId, PAYLOAD) shouldBe FirstBandAdmission.Admitted(scanVerificationRequired = true)
}

private fun FirstBandVerification.refusedNext(jobId: String = "J-2") =
    admit(key, jobId, PAYLOAD).shouldBeInstanceOf<FirstBandAdmission.Refused>().refusal

class FirstBandVerificationTest :
    FunSpec({
        context("the verification key (spec §6.3, DN-072)") {
            test("any change of template, printer, firmware, mode, resolution or media is a new key") {
                listOf(
                    VerificationKey.of("SYN-WRISTBAND-ADULT", 2, "a".repeat(64), printer),
                    VerificationKey.of("SYN-WRISTBAND-ADULT", 1, "b".repeat(64), printer),
                    VerificationKey.of("SYN-WRISTBAND-CHILD", 1, "a".repeat(64), printer),
                    VerificationKey.of("SYN-WRISTBAND-ADULT", 1, "a".repeat(64), printer.copy(serial = "SYN-SER-2")),
                    VerificationKey.of("SYN-WRISTBAND-ADULT", 1, "a".repeat(64), printer.copy(firmware = "V93.21.27Z")),
                    VerificationKey.of("SYN-WRISTBAND-ADULT", 1, "a".repeat(64), printer.copy(mode = OutputMode.ZPL_TEXT)),
                    VerificationKey.of("SYN-WRISTBAND-ADULT", 1, "a".repeat(64), printer.copy(dotsPerMm = 12.0)),
                    VerificationKey.of("SYN-WRISTBAND-ADULT", 1, "a".repeat(64), printer.copy(mediaWidthMm = 19.0)),
                ).forEach { it shouldNotBe key }
            }

            test("resident fonts count in ZPL text mode only") {
                VerificationKey.of("T", 1, "h", printer.copy(residentFontSha256 = emptyMap())) shouldBe
                    VerificationKey.of("T", 1, "h", printer)
                val text = printer.copy(mode = OutputMode.ZPL_TEXT)
                VerificationKey.of("T", 1, "h", text.copy(residentFontSha256 = emptyMap())) shouldNotBe
                    VerificationKey.of("T", 1, "h", text)
            }
        }

        context("UnitTest:first-band-blocks-until-verified") {
            test("an unknown key is 'required': the first band is admitted and marked scan-verification-required") {
                val state = FirstBandVerification()
                state.stateOf(key) shouldBe FirstBandState.REQUIRED
                state.admitFirst()
                state.stateOf(key) shouldBe FirstBandState.PENDING
            }

            test("further wristbands on a pending key are refused") {
                val state = FirstBandVerification()
                state.admitFirst()
                val refusal = state.refusedNext()
                refusal.reason shouldBe RefusalReason.FIRST_BAND_PENDING
                state.refusedNext("J-3").reason shouldBe RefusalReason.FIRST_BAND_PENDING
            }

            test("another key is independent") {
                val state = FirstBandVerification()
                state.admitFirst()
                val other = key.copy(printerSerial = "SYN-SER-2")
                state.admit(other, "J-9", PAYLOAD) shouldBe FirstBandAdmission.Admitted(scanVerificationRequired = true)
            }

            test("after verification bands print without verification") {
                val state = FirstBandVerification()
                state.admitFirst()
                state.verify("J-1", PAYLOAD, visualMatchConfirmed = true) shouldBe FirstBandResult.Verified
                state.admit(key, "J-2", PAYLOAD) shouldBe FirstBandAdmission.Admitted(scanVerificationRequired = false)
                state.stateOf(key) shouldBe FirstBandState.VERIFIED
            }
        }

        context("UnitTest:first-band-scan-verification") {
            test("the scanned payload must equal the expected payload exactly") {
                val wrongScans =
                    listOf(PAYLOAD.lowercase(), " $PAYLOAD", "$PAYLOAD\n", PAYLOAD.dropLast(1), PAYLOAD.replace("J-1", "J-2"), "")
                wrongScans.forEach { scanned ->
                    val state = FirstBandVerification()
                    state.admitFirst()
                    state.verify("J-1", scanned, visualMatchConfirmed = true) shouldBe FirstBandResult.Mismatch("scanned payload differs")
                    state.stateOf(key) shouldBe FirstBandState.BLOCKED
                }
            }

            test("without the user's visual confirmation it is a mismatch, even with the right payload") {
                val state = FirstBandVerification()
                state.admitFirst()
                state.verify("J-1", PAYLOAD, visualMatchConfirmed = false) shouldBe FirstBandResult.Mismatch("visual match not confirmed")
                state.stateOf(key) shouldBe FirstBandState.BLOCKED
            }

            test("a mismatch blocks the key: further wristbands are refused") {
                val state = FirstBandVerification()
                state.admitFirst()
                state.verify("J-1", "wrong", visualMatchConfirmed = true)
                state.refusedNext().reason shouldBe RefusalReason.FIRST_BAND_PENDING
            }

            test("a job that is not the pending first band is not pending") {
                val state = FirstBandVerification()
                state.verify("J-1", PAYLOAD, true) shouldBe FirstBandResult.NotPending
                state.admitFirst()
                state.verify("J-2", PAYLOAD, true) shouldBe FirstBandResult.NotPending
                state.verify("J-1", PAYLOAD, true) shouldBe FirstBandResult.Verified
                state.verify("J-1", PAYLOAD, true) shouldBe FirstBandResult.NotPending
            }
        }

        context("how the first job ended") {
            test("refused or failed: the key is released and the next band is a first band") {
                listOf(PrintJobState.REFUSED, PrintJobState.FAILED).forEach { ended ->
                    val state = FirstBandVerification()
                    state.admitFirst()
                    state.jobEnded("J-1", ended) shouldBe FirstBandChange.Released
                    state.stateOf(key) shouldBe FirstBandState.REQUIRED
                    state.admitFirst("J-2")
                }
            }

            test("unknown-outcome-keeps-pending: an unknown outcome keeps the key pending") {
                val state = FirstBandVerification()
                state.admitFirst()
                state.jobEnded("J-1", PrintJobState.OUTCOME_UNKNOWN).shouldBeInstanceOf<FirstBandChange.Rejected>()
                state.stateOf(key) shouldBe FirstBandState.PENDING
                state.refusedNext().reason shouldBe RefusalReason.FIRST_BAND_PENDING
                state.verify("J-1", PAYLOAD, true) shouldBe FirstBandResult.Verified
            }

            test("completed or dispatched does not release") {
                val state = FirstBandVerification()
                state.admitFirst()
                state.jobEnded("J-1", PrintJobState.COMPLETED).shouldBeInstanceOf<FirstBandChange.Rejected>()
                state.jobEnded("J-1", PrintJobState.DISPATCHED).shouldBeInstanceOf<FirstBandChange.Rejected>()
                state.stateOf(key) shouldBe FirstBandState.PENDING
            }

            test("declare-no-band-releases: after an unknown outcome the user may declare that no band came out") {
                val state = FirstBandVerification()
                state.admitFirst()
                state.jobEnded("J-1", PrintJobState.OUTCOME_UNKNOWN)
                state.declareNoBandPrinted("J-1") shouldBe FirstBandChange.Released
                state.stateOf(key) shouldBe FirstBandState.REQUIRED
                state.admitFirst("J-2")
            }

            test("declaring no band is rejected unless the first job's outcome is unknown") {
                val state = FirstBandVerification()
                state.declareNoBandPrinted("J-1").shouldBeInstanceOf<FirstBandChange.Rejected>()
                state.admitFirst()
                state.declareNoBandPrinted("J-1").shouldBeInstanceOf<FirstBandChange.Rejected>()
                state.stateOf(key) shouldBe FirstBandState.PENDING
            }
        }

        context("mismatch-reset-requires-removal") {
            fun blocked(): FirstBandVerification =
                FirstBandVerification().also {
                    it.admitFirst()
                    it.verify("J-1", "wrong", true)
                }

            test("without removal of the mismatched band the reset is rejected") {
                val state = blocked()
                state.reset("J-1", mismatchedBandRemoved = false, reason = "removed?") shouldBe
                    FirstBandChange.Rejected("the mismatched band must be removed from the patient first")
                state.stateOf(key) shouldBe FirstBandState.BLOCKED
            }

            test("without a reason the reset is rejected") {
                val state = blocked()
                state.reset("J-1", mismatchedBandRemoved = true, reason = "  ") shouldBe FirstBandChange.Rejected("a reset needs a reason")
                state.stateOf(key) shouldBe FirstBandState.BLOCKED
            }

            test("with removal and a reason the key is released and the next band is a first band again") {
                val state = blocked()
                state.reset("J-1", mismatchedBandRemoved = true, reason = "printer head cleaned, band removed") shouldBe
                    FirstBandChange.Released
                state.stateOf(key) shouldBe FirstBandState.REQUIRED
                state.admitFirst("J-2")
            }

            test("only the job that blocked the key can reset it; a pending or verified key cannot be reset") {
                val state = blocked()
                state.reset("J-9", true, "x").shouldBeInstanceOf<FirstBandChange.Rejected>()
                val pending = FirstBandVerification().also { it.admitFirst() }
                pending.reset("J-1", true, "x").shouldBeInstanceOf<FirstBandChange.Rejected>()
            }
        }
    })
