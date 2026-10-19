package hms.satellites.pdfaverify

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.engine.spec.tempdir
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotBeBlank
import io.kotest.matchers.types.shouldBeInstanceOf
import java.nio.file.Files

/**
 * `PdfaCheck:veraPDF-2b` (docs/specs/modules/platform-docs.md §7.5, §10): the checker passes a PDF/A-2b
 * file and fails everything else, closed.
 */
class PdfaVerifierTest :
    FunSpec({
        val verifier = PdfaVerifier()
        val directory = tempdir().toPath()

        test("PdfaCheck:veraPDF-2b rejects a plain PDF 1.4 without XMP metadata or output intent") {
            val file = Files.write(directory.resolve("plain-1.4.pdf"), TestPdfs.plainPdf14())

            val verdict = verifier.verify(file)

            withClue(verdict.toString()) {
                verdict.shouldBeInstanceOf<PdfaVerdict.NonCompliant>()
                verdict.passed shouldBe false
                verdict.flavour shouldBe "2b"
                verdict.failures.shouldNotBeEmpty()
                verdict.failures.forEach { rule ->
                    rule.clause.shouldNotBeBlank()
                    rule.description.shouldNotBeBlank()
                    rule.failedChecks shouldBeGreaterThan 0
                }
                // ISO 19005-2 6.6.2.1: the catalog of a conforming file holds a Metadata stream.
                verdict.failures.map { it.clause }.contains("6.6.2.1") shouldBe true
            }
        }

        test("PdfaCheck:veraPDF-2b reports a file that is not a PDF as unreadable") {
            val file = Files.writeString(directory.resolve("not-a-pdf.pdf"), "SYN- NOT FOR CLINICAL USE: plain text, not a PDF\n")

            val verdict = verifier.verify(file)

            withClue(verdict.toString()) {
                verdict.shouldBeInstanceOf<PdfaVerdict.Unreadable>()
                verdict.passed shouldBe false
                verdict.reason.shouldNotBeBlank()
            }
        }

        test("PdfaCheck:veraPDF-2b reports a missing file as unreadable") {
            val verdict = verifier.verify(directory.resolve("absent.pdf"))

            verdict.shouldBeInstanceOf<PdfaVerdict.Unreadable>()
            verdict.passed shouldBe false
        }

        test("PdfaCheck:veraPDF-2b verdict on the WeasyPrint 70.0 PDF/A-2b spike sample") {
            val file = TestPdfs.copyResource(TestPdfs.WEASYPRINT_SAMPLE, directory)

            val verdict = verifier.verify(file)

            withClue(verdict.toString()) {
                verdict.shouldBeInstanceOf<PdfaVerdict.Compliant>()
                verdict.passed shouldBe true
                verdict.flavour shouldBe "2b"
                verdict.checks shouldBeGreaterThan 0
            }
        }
    })
