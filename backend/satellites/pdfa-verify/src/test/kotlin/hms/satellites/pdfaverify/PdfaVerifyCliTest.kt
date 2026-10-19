package hms.satellites.pdfaverify

import io.kotest.core.spec.style.FunSpec
import io.kotest.engine.spec.tempdir
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldEndWith
import io.kotest.matchers.string.shouldStartWith
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import java.nio.file.Files
import java.nio.file.Path

/** The `pdfa-verify` command line fails closed (docs/specs/modules/platform-docs.md §10, `PdfaCheck:veraPDF-2b`). */
class PdfaVerifyCliTest :
    FunSpec({
        val cli = PdfaVerifyCli(PdfaVerifier())
        val root = tempdir().toPath()

        data class Run(
            val exitCode: Int,
            val lines: List<String>,
            val err: String,
        )

        fun run(vararg arguments: String): Run {
            val out = ByteArrayOutputStream()
            val err = ByteArrayOutputStream()
            val code =
                PrintStream(out, true, Charsets.UTF_8).use { o ->
                    PrintStream(err, true, Charsets.UTF_8).use { e -> cli.run(arguments.toList(), o, e) }
                }
            val lines = out.toString(Charsets.UTF_8).lines().filter { it.isNotBlank() }
            return Run(code, lines, err.toString(Charsets.UTF_8))
        }

        fun newDirectory(name: String): Path = Files.createDirectories(root.resolve(name))

        test("no argument is a usage error (exit 2)") {
            run().exitCode shouldBe PdfaVerifyCli.EXIT_USAGE
        }

        test("PdfaCheck:veraPDF-2b a directory with a non-compliant PDF exits 1 with one JSON line per file") {
            val directory = newDirectory("plain")
            Files.write(directory.resolve("a-plain.pdf"), TestPdfs.plainPdf14())
            Files.writeString(directory.resolve("ignored.txt"), "not a PDF, not checked")

            val result = run(directory.toString())

            result.exitCode shouldBe PdfaVerifyCli.EXIT_FAILED
            result.lines shouldHaveSize 1
            result.lines[0] shouldStartWith "{\"file\":"
            result.lines[0] shouldContain "\"verdict\":\"non-compliant\""
            result.lines[0] shouldContain "\"clause\":\"6.6.2.1\""
            result.lines[0] shouldEndWith "]}"
        }

        test("PdfaCheck:veraPDF-2b a directory without any PDF fails closed (exit 1)") {
            val result = run(newDirectory("empty").toString())

            result.exitCode shouldBe PdfaVerifyCli.EXIT_FAILED
            result.lines shouldHaveSize 0
            result.err shouldContain "no PDF files"
        }

        test("PdfaCheck:veraPDF-2b a missing path is reported unreadable and fails (exit 1)") {
            val result = run(root.resolve("absent.pdf").toString())

            result.exitCode shouldBe PdfaVerifyCli.EXIT_FAILED
            result.lines shouldHaveSize 1
            result.lines[0] shouldContain "\"verdict\":\"unreadable\""
        }

        test("PdfaCheck:veraPDF-2b one bad file among several fails the run, and every file is still reported") {
            val directory = newDirectory("mixed")
            val sample = TestPdfs.copyResource(TestPdfs.WEASYPRINT_SAMPLE, directory)
            val plain = Files.write(directory.resolve("plain.pdf"), TestPdfs.plainPdf14())

            val result = run(sample.toString(), plain.toString())

            result.exitCode shouldBe PdfaVerifyCli.EXIT_FAILED
            result.lines shouldHaveSize 2
            result.lines[0] shouldContain "\"verdict\":\"compliant\""
            result.lines[1] shouldContain "\"verdict\":\"non-compliant\""
        }

        test("JSON strings escape quotes, backslashes and control characters") {
            PdfaVerdictJson.string("a\"b\\c\nd\u0001") shouldBe "\"a\\\"b\\\\c\\nd\\u0001\""
            PdfaVerdictJson.string("شیلان SYN-1") shouldBe "\"شیلان SYN-1\""
        }
    })
