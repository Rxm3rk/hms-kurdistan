package hms.platform.docs.domain.verification

import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReprintReason
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

private val subject = BandSubject("SYN-P-0001", "SYN-E-000042")

class IssuedBandsTest :
    FunSpec({
        context("UnitTest:second-band-is-a-reprint") {
            test("the first band for a patient and encounter is a first band") {
                IssuedBands().admit(subject, null, null) shouldBe BandAdmission.FirstBand
            }

            test("a second band while one is issued needs a reason") {
                val bands = IssuedBands()
                bands.recordIssued(subject, "J-1")
                val refusal = bands.admit(subject, null, null).shouldBeInstanceOf<BandAdmission.Refused>().refusal
                refusal.reason shouldBe RefusalReason.REPRINT_REASON_REQUIRED
            }

            test("with a reason it is a reprint of the issued band") {
                val bands = IssuedBands()
                bands.recordIssued(subject, "J-1")
                bands.admit(subject, null, ReprintReason.DAMAGED) shouldBe BandAdmission.Reprint("J-1", ReprintReason.DAMAGED)
            }

            test("another encounter or patient is a first band") {
                val bands = IssuedBands()
                bands.recordIssued(subject, "J-1")
                bands.admit(subject.copy(encounterId = "SYN-E-000043"), null, null) shouldBe BandAdmission.FirstBand
                bands.admit(subject.copy(patientRef = "SYN-P-0002"), null, null) shouldBe BandAdmission.FirstBand
            }

            test("the newest band supersedes; a withdrawn band no longer counts") {
                val bands = IssuedBands()
                bands.recordIssued(subject, "J-1")
                bands.recordIssued(subject, "J-2")
                bands.admit(subject, null, ReprintReason.LOST) shouldBe BandAdmission.Reprint("J-2", ReprintReason.LOST)
                bands.withdraw(subject, "J-1") shouldBe false
                bands.withdraw(subject, "J-2") shouldBe true
                bands.issuedJob(subject).shouldBeNull()
                bands.admit(subject, null, null) shouldBe BandAdmission.FirstBand
            }
        }

        context("UnitTest:reprint-requires-reason (wristbands)") {
            test("an explicit reprint without a reason is refused, issued band or not") {
                IssuedBands()
                    .admit(subject, "J-1", null)
                    .shouldBeInstanceOf<BandAdmission.Refused>()
                    .refusal.reason shouldBe
                    RefusalReason.REPRINT_REASON_REQUIRED
            }

            test("an explicit reprint with a reason is a reprint of the named job") {
                val bands = IssuedBands()
                bands.recordIssued(subject, "J-2")
                bands.admit(subject, "J-1", ReprintReason.ILLEGIBLE) shouldBe BandAdmission.Reprint("J-1", ReprintReason.ILLEGIBLE)
            }
        }
    })
