package hms.platform.docs.golden

import hms.platform.docs.api.FirstBandResult
import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.PatientIdentity
import hms.platform.docs.api.PrintCommand
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.PrintResult
import hms.platform.docs.api.PrinterProfile
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.api.VerifyFirstBand
import hms.platform.docs.application.payload
import hms.platform.docs.application.testing.CapturingRenderer
import hms.platform.docs.application.testing.PrintFixtures
import hms.platform.docs.application.testing.PrintFixtures.ADULT
import hms.platform.docs.application.testing.PrintFixtures.ADULT_LENGTH_MM
import hms.platform.docs.application.testing.PrintFixtures.BAND_WIDTH_MM
import hms.platform.docs.application.testing.PrintFixtures.DOCUMENT
import hms.platform.docs.application.testing.PrintFixtures.Harness
import hms.platform.docs.application.testing.PrintFixtures.LABEL_LENGTH_MM
import hms.platform.docs.application.testing.PrintFixtures.LABEL_WIDTH_MM
import hms.platform.docs.application.testing.PrintFixtures.NEWBORN
import hms.platform.docs.application.testing.PrintFixtures.NEWBORN_LENGTH_MM
import hms.platform.docs.application.testing.PrintFixtures.RECEIPT
import hms.platform.docs.application.testing.PrintFixtures.SPECIMEN_CODE128
import hms.platform.docs.application.testing.PrintFixtures.SPECIMEN_LABEL
import hms.platform.docs.application.testing.PrintFixtures.TOKEN
import hms.platform.docs.application.testing.PrintFixtures.command
import hms.platform.docs.infrastructure.raster.JvmRenderIdentity
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.types.shouldBeInstanceOf
import java.nio.file.Files

/**
 * The sample matrix and its approved artefacts (docs/specs/modules/platform-docs.md §10): every case is printed
 * through the print service (real templates, shaper, rasteriser and writers; test-only policy, MRN check, audit and
 * renderer), and its outputs are compared with approved files:
 *
 * - ZPL text bytes (`ByteFixture:zpl-text-*`, `ByteFixture:zpl-reprint-*`) with `src/test/resources/fixtures/zpl/`;
 * - the image decoded from our own `^GF` fields (`GoldenImage:wristband-*`, `GoldenImage:specimen-label-*`) and from our
 *   own `GS v 0` bands (`GoldenImage:receipt-escpos-*`, `GoldenImage:token-*`) with `src/test/resources/golden/<key>/`,
 *   where the key names the JVM renderer identity (the full identity is in `identity.txt` beside the manifest);
 * - the HTML sent to the renderer satellite (`ByteFixture:html-*`) with `src/test/resources/fixtures/html/`, which are
 *   the inputs of the PDF goldens (the satellite's `golden` command, the nightly `golden-image-print` step).
 *
 * Cases (all synthetic, §19.4): wristband, specimen label and receipt, each in en, ckb and ar, for a Sorani-, an
 * Arabic- and a Latin-script patient, a long four-part name that wraps, a newborn name at the edge of fitting, twins
 * whose names differ only in the final marker, an alias, an approximate date of birth, and a digit-only MRN under ckb
 * and ar; at 8 and 12 dots per millimetre (HTML at 8), one wristband at 24; the Code 128 specimen option, the newborn
 * band, tokens, reprints, and the A4 document (long allergy list, three name forms, reprint). A missing or different
 * approved file fails closed and writes a candidate to `build/golden-candidates/`; approving is copying reviewed
 * candidates (manifests say `human_script_review: requested`; a build-agent approval is regression evidence only,
 * KA-080).
 */
class SampleMatrixTest :
    FunSpec({
        val identity = JvmRenderIdentity.of(PrintFixtures.fonts)
        val key = "jvm-" + ApprovedSets.sha256(identity.toByteArray()).take(KEY_LENGTH)
        val candidates = ApprovedSets.candidatesDirFromSystemProperty()
        val goldens = GoldenImages()
        val zplFixtures =
            ByteFixtures(
                approved = { path -> ApprovedSets.classpath(path.replaceFirst("fixtures/", "fixtures/zpl/")) },
                candidatesDir = { candidates.resolve("samples-zpl") },
            )
        val htmlFixtures =
            ByteFixtures(
                approved = { path -> ApprovedSets.classpath(path.replaceFirst("fixtures/", "fixtures/html/")) },
                candidatesDir = { candidates.resolve("samples-html") },
            )

        beforeSpec {
            val dir = candidates.resolve("golden").resolve(key)
            Files.createDirectories(dir)
            Files.writeString(dir.resolve("identity.txt"), identity + "\n")
        }

        fun provenance(result: PrintResult.Rendered) = Provenance(result.templateId, result.templateVersion, result.templateHash)

        fun rendered(result: PrintResult): PrintResult.Rendered = result.shouldBeInstanceOf<PrintResult.Rendered>()

        fun dpi(dotsPerMm: Double) = DPI.getValue(dotsPerMm)

        /** Prints [cmd] in text mode and compares the ZPL bytes with the fixture [name]. */
        fun zplText(
            name: String,
            cmd: PrintCommand,
            harness: Harness = Harness(),
        ): String {
            val result = rendered(harness.service.print(cmd))
            val text = String(result.bytes, Charsets.UTF_8)
            text shouldContain "^A@"
            zplFixtures.assertMatches(name, result.bytes, provenance(result))
            return text
        }

        /** Prints [cmd] in raster mode and compares the image decoded from the `^GF` fields with the golden [name]. */
        fun zplRaster(
            name: String,
            cmd: PrintCommand,
            harness: Harness = Harness(),
        ) {
            val result = rendered(harness.service.print(cmd))
            goldens.assertMatches(key, name, ZplGraphicDecoder.decode(result.bytes).image, provenance(result))
        }

        fun escPos(
            name: String,
            cmd: PrintCommand,
            harness: Harness = Harness(),
        ) {
            val result = rendered(harness.service.print(cmd))
            goldens.assertMatches(key, name, EscPosDecoder.decode(result.bytes).image, provenance(result))
        }

        fun html(
            name: String,
            cmd: PrintCommand,
            harness: Harness = Harness(renderer = CapturingRenderer()),
        ) {
            val result = rendered(harness.service.print(cmd))
            val html = (harness.renderer as CapturingRenderer).requests.last().html
            htmlFixtures.assertMatches(name, html.toByteArray(Charsets.UTF_8), provenance(result))
        }

        val patients: List<Pair<String, PatientIdentity>> =
            listOf(
                "sorani" to PrintFixtures.sorani,
                "arabic" to PrintFixtures.arabic,
                "latin" to PrintFixtures.latin,
                "long4" to PrintFixtures.longFourPart,
                "newborn" to PrintFixtures.newborn,
                "twin-a" to PrintFixtures.twin("ئ"),
                "twin-b" to PrintFixtures.twin("ب"),
                "alias" to PrintFixtures.alias,
                "approx" to PrintFixtures.approximateDob,
            )

        /** Every (patient, language) case: the nine patients in each language, and the digit-only MRN under ckb and ar. */
        val cases: List<Triple<String, PatientIdentity, LabelLanguage>> =
            LabelLanguage.entries.flatMap { language -> patients.map { (name, patient) -> Triple(name, patient, language) } } +
                listOf(LabelLanguage.CKB, LabelLanguage.AR).map { Triple("digit-mrn", PrintFixtures.digitMrn, it) }

        /** The label kinds: file stem, template, content and the loaded media. */
        data class LabelKind(
            val stem: String,
            val templateId: String,
            val content: (PatientIdentity) -> PrintContent,
            val widthMm: Double,
            val lengthMm: Double,
        )

        val labelKinds =
            listOf(
                LabelKind("wristband", ADULT, PrintFixtures::wristband, BAND_WIDTH_MM, ADULT_LENGTH_MM),
                LabelKind("specimen-label", SPECIMEN_LABEL, PrintFixtures::specimen, LABEL_WIDTH_MM, LABEL_LENGTH_MM),
            )

        for (kind in labelKinds) {
            for ((patient, identity, language) in cases) {
                val base = "${kind.stem}-$patient-${language.tag}"
                for (dots in listOf(8.0, 12.0)) {
                    test("ByteFixture:zpl-text-$base-${dpi(dots)}") {
                        val printer = PrintFixtures.zplText(dots, kind.widthMm, kind.lengthMm)
                        zplText("zpl-text-$base-${dpi(dots)}.zpl", command(kind.templateId, kind.content(identity), printer, language))
                    }
                    test("GoldenImage:$base-${dpi(dots)}") {
                        val printer = PrintFixtures.zplRaster(dots, kind.widthMm, kind.lengthMm)
                        zplRaster("$base-${dpi(dots)}", command(kind.templateId, kind.content(identity), printer, language))
                    }
                }
                test("ByteFixture:html-$base") {
                    html("html-$base.html", command(kind.templateId, kind.content(identity), PrintFixtures.pdf(), language))
                }
            }
        }

        test("GoldenImage:wristband-sorani-en-600 and ByteFixture:zpl-text-wristband-sorani-en-600 (24 dots/mm)") {
            val cmd = { printer: PrinterProfile -> command(ADULT, PrintFixtures.wristband(), printer) }
            zplRaster("wristband-sorani-en-600", cmd(PrintFixtures.zplRaster(24.0, BAND_WIDTH_MM, ADULT_LENGTH_MM)))
            zplText("zpl-text-wristband-sorani-en-600.zpl", cmd(PrintFixtures.zplText(24.0, BAND_WIDTH_MM, ADULT_LENGTH_MM)))
        }

        for (language in LabelLanguage.entries) {
            val base = "specimen-label-code128-sorani-${language.tag}"
            for (dots in listOf(8.0, 12.0)) {
                test("ByteFixture:zpl-text-$base-${dpi(dots)} and GoldenImage:$base-${dpi(dots)}") {
                    val content = PrintFixtures.specimen()
                    val text = PrintFixtures.zplText(dots, LABEL_WIDTH_MM, LABEL_LENGTH_MM)
                    val raster = PrintFixtures.zplRaster(dots, LABEL_WIDTH_MM, LABEL_LENGTH_MM)
                    zplText("zpl-text-$base-${dpi(dots)}.zpl", command(SPECIMEN_CODE128, content, text, language))
                    zplRaster("$base-${dpi(dots)}", command(SPECIMEN_CODE128, content, raster, language))
                }
            }
            test("ByteFixture:html-$base") {
                html("html-$base.html", command(SPECIMEN_CODE128, PrintFixtures.specimen(), PrintFixtures.pdf(), language))
            }
            for ((patient, identity) in listOf("newborn" to PrintFixtures.newborn, "twin-b" to PrintFixtures.twin("ب"))) {
                val band = "wristband-newborn-band-$patient-${language.tag}"
                test("ByteFixture:zpl-text-$band-203 and GoldenImage:$band-203") {
                    val content = PrintFixtures.wristband(identity)
                    val text = PrintFixtures.zplText(8.0, BAND_WIDTH_MM, NEWBORN_LENGTH_MM)
                    val raster = PrintFixtures.zplRaster(8.0, BAND_WIDTH_MM, NEWBORN_LENGTH_MM)
                    zplText("zpl-text-$band-203.zpl", command(NEWBORN, content, text, language))
                    zplRaster("$band-203", command(NEWBORN, content, raster, language))
                }
            }
        }

        for ((patient, identity, language) in cases) {
            val base = "receipt-escpos-$patient-${language.tag}"
            for (dots in listOf(8.0, 12.0)) {
                test("GoldenImage:$base-${dpi(dots)}") {
                    escPos("$base-${dpi(dots)}", command(RECEIPT, PrintFixtures.receipt(identity), PrintFixtures.escPos(dots), language))
                }
            }
            test("ByteFixture:html-receipt-$patient-${language.tag}") {
                val pdf = command(RECEIPT, PrintFixtures.receipt(identity), PrintFixtures.pdf(), language)
                html("html-receipt-$patient-${language.tag}.html", pdf)
            }
        }

        for (dots in listOf(8.0, 12.0)) {
            test("GoldenImage:token-${dpi(dots)}") {
                escPos("token-${dpi(dots)}", command(TOKEN, PrintFixtures.token, PrintFixtures.escPos(dots)))
            }
        }

        context("reprints") {
            /** A band printed and verified on [printer], then its reprint command (a first band waits for its scan, §6.3). */
            fun bandReprint(
                harness: Harness,
                printer: PrinterProfile,
            ): PrintCommand {
                val first = rendered(harness.service.print(command(ADULT, PrintFixtures.wristband(), printer)))
                harness.service.verifyFirstBand(VerifyFirstBand(PrintFixtures.context(), first.jobId, payload(first), true)) shouldBe
                    FirstBandResult.Verified
                return command(ADULT, PrintFixtures.wristband(), printer, reprintOf = first.jobId, reprintReason = ReprintReason.DAMAGED)
            }

            test("ByteFixture:zpl-reprint-wristband-sorani-en-203") {
                val harness = Harness()
                val reprint = bandReprint(harness, PrintFixtures.zplText(8.0, BAND_WIDTH_MM, ADULT_LENGTH_MM))
                zplText("zpl-reprint-wristband-sorani-en-203.zpl", reprint, harness) shouldStartWith "~JA
^XA
"
            }

            test("GoldenImage:wristband-reprint-sorani-en-203") {
                val harness = Harness()
                val reprint = bandReprint(harness, PrintFixtures.zplRaster(8.0, BAND_WIDTH_MM, ADULT_LENGTH_MM))
                zplRaster("wristband-reprint-sorani-en-203", reprint, harness)
            }

            test("ByteFixture:zpl-reprint-specimen-label-sorani-ckb-203") {
                val printer = PrintFixtures.zplText(8.0, LABEL_WIDTH_MM, LABEL_LENGTH_MM)
                val harness = Harness()
                val first = rendered(harness.service.print(command(SPECIMEN_LABEL, PrintFixtures.specimen(), printer, LabelLanguage.CKB)))
                val reprint =
                    command(
                        SPECIMEN_LABEL,
                        PrintFixtures.specimen(),
                        printer,
                        LabelLanguage.CKB,
                        reprintOf = first.jobId,
                        reprintReason = ReprintReason.ILLEGIBLE,
                    )
                zplText("zpl-reprint-specimen-label-sorani-ckb-203.zpl", reprint, harness) shouldStartWith "~JA
^XA
"
            }

            test("GoldenImage:receipt-escpos-reprint-sorani-ar-203") {
                val reprint =
                    command(
                        RECEIPT,
                        PrintFixtures.receipt(),
                        PrintFixtures.escPos(8.0),
                        LabelLanguage.AR,
                        reprintOf = PrintFixtures.job(9),
                        reprintReason = ReprintReason.LOST,
                    )
                escPos("receipt-escpos-reprint-sorani-ar-203", reprint)
            }
        }

        context("the A4 document: long allergy list, three name forms, reprint") {
            for (language in LabelLanguage.entries) {
                test("ByteFixture:html-document-a4-${language.tag}") {
                    val cmd = command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf(), language)
                    html("html-document-a4-${language.tag}.html", cmd)
                }
            }
            test("ByteFixture:html-document-a4-reprint-en") {
                val reprint =
                    command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf(), reprintOf = JOB_9, reprintReason = ReprintReason.LOST)
                html("html-document-a4-reprint-en.html", reprint)
            }
        }
    }) {
    private companion object {
        const val KEY_LENGTH = 16
        val DPI: Map<Double, Int> = mapOf(8.0 to 203, 12.0 to 300, 24.0 to 600)
        val JOB_9: String = PrintFixtures.job(9)
    }
}
