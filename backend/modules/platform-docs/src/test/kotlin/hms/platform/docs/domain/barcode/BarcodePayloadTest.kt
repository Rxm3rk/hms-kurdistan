package hms.platform.docs.domain.barcode

import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.testing.cp
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

class BarcodePayloadTest :
    FunSpec({
        test("wristband payload: HMS1|M:<MRN>|E:<encounter>|B:<band serial>") {
            BarcodePayload.wristband("SYN-0000123", "SYN-E-000042", "0192f3a4-7b1c") shouldBe
                PayloadOutcome.Built("HMS1|M:SYN-0000123|E:SYN-E-000042|B:0192f3a4-7b1c")
        }

        test("specimen DataMatrix (default): HMS1|S:<specimen id>|M:<MRN>") {
            BarcodePayload.specimenDataMatrix("SYN-S-0000077", "SYN-0000123") shouldBe
                PayloadOutcome.Built("HMS1|S:SYN-S-0000077|M:SYN-0000123")
        }

        test("specimen Code 128 (option): the specimen id alone") {
            BarcodePayload.specimenCode128("SYN-S-0000077") shouldBe PayloadOutcome.Built("SYN-S-0000077")
        }

        test("a field outside [A-Za-z0-9-] is refused, never escaped or dropped") {
            listOf(
                "SYN|0001",
                "SYN~0001",
                "SYN\\0001",
                "SYN^0001",
                "SYN 0001",
                "SYN:01",
                "SYN" + cp(0x0661),
                "SYN" + cp(0x202E),
                "",
            ).forEach { bad ->
                val mrn = BarcodePayload.wristband(bad, "SYN-E-1", "J-1").shouldBeInstanceOf<PayloadOutcome.Refused>().refusal
                mrn.reason shouldBe RefusalReason.IDENTIFIER_INVALID
                mrn.subject shouldBe "identity.mrn"
                BarcodePayload
                    .wristband("SYN-1", bad, "J-1")
                    .shouldBeInstanceOf<PayloadOutcome.Refused>()
                    .refusal.subject shouldBe
                    "encounter.id"
                BarcodePayload
                    .wristband("SYN-1", "SYN-E-1", bad)
                    .shouldBeInstanceOf<PayloadOutcome.Refused>()
                    .refusal.subject shouldBe
                    "barcode.wristband.serial"
                BarcodePayload
                    .specimenCode128(bad)
                    .shouldBeInstanceOf<PayloadOutcome.Refused>()
                    .refusal.subject shouldBe "specimen.id"
                BarcodePayload
                    .specimenDataMatrix("SYN-S-1", bad)
                    .shouldBeInstanceOf<PayloadOutcome.Refused>()
                    .refusal.subject shouldBe
                    "identity.mrn"
            }
        }

        test("a missing field is refused as missing") {
            BarcodePayload
                .wristband("SYN-1", null, "J-1")
                .shouldBeInstanceOf<PayloadOutcome.Refused>()
                .refusal.reason shouldBe
                RefusalReason.IDENTIFIER_MISSING
            BarcodePayload
                .specimenCode128(null)
                .shouldBeInstanceOf<PayloadOutcome.Refused>()
                .refusal.reason shouldBe
                RefusalReason.IDENTIFIER_MISSING
        }

        test("the refusal detail names a category, never the value") {
            val refusal = BarcodePayload.wristband("SYN|SECRET", "SYN-E-1", "J-1").shouldBeInstanceOf<PayloadOutcome.Refused>().refusal
            refusal.detail shouldBe "category=Sm outside [A-Za-z0-9-]"
        }
    })
