package hms.satellites.pdfaverify

import java.io.PrintStream
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.extension
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile
import kotlin.system.exitProcess

/**
 * The command line of the PDF/A checker (docs/specs/modules/platform-docs.md §1, §10):
 *
 *     pdfa-verify <dir-or-file>...
 *
 * A directory stands for every `*.pdf` file below it (any depth, sorted by path). For each file it
 * prints one JSON line on standard output (see [PdfaVerdictJson]) and exits with
 *
 * - 0 when every file is PDF/A-2b compliant;
 * - 1 when any file is non-compliant or unreadable, a named path does not exist, or a directory holds no
 *   PDF (fail closed: a golden step that checked nothing has not passed);
 * - 2 on a usage error (no argument).
 *
 * An unexpected runtime failure inside veraPDF is not caught: it ends the run with a stack trace and a
 * non-zero exit, which also fails closed. BUILD-ONLY tool; never shipped (README.md).
 */
fun main(args: Array<String>) {
    exitProcess(PdfaVerifyCli(PdfaVerifier()).run(args.toList(), System.out, System.err))
}

/** The testable body of [main]. */
class PdfaVerifyCli(
    private val verifier: PdfaVerifier,
) {
    /** Runs the checker on [arguments]; returns the process exit code. */
    fun run(
        arguments: List<String>,
        out: PrintStream,
        err: PrintStream,
    ): Int {
        if (arguments.isEmpty()) {
            err.println("usage: pdfa-verify <dir-or-file>...  (validates against PDF/A-2b with veraPDF)")
            return EXIT_USAGE
        }
        var failed = false
        for (argument in arguments) {
            val path = Path.of(argument).toAbsolutePath().normalize()
            val files =
                when {
                    path.isDirectory() -> pdfFilesUnder(path)
                    else -> listOf(path)
                }
            if (files.isEmpty()) {
                err.println("pdfa-verify: no PDF files under $path")
                failed = true
            }
            files.forEach { file ->
                val verdict = if (file.isRegularFile()) verifier.verify(file) else PdfaVerdict.Unreadable(file, "no such file")
                out.println(PdfaVerdictJson.line(verdict))
                if (!verdict.passed) failed = true
            }
        }
        out.flush()
        return if (failed) EXIT_FAILED else EXIT_OK
    }

    private fun pdfFilesUnder(directory: Path): List<Path> =
        Files.walk(directory).use { paths ->
            paths
                .filter { it.isRegularFile() && it.extension.equals("pdf", ignoreCase = true) }
                .sorted()
                .toList()
        }

    companion object {
        /** Every file is PDF/A-2b compliant. */
        const val EXIT_OK = 0

        /** A file failed, could not be read, or nothing was checked. */
        const val EXIT_FAILED = 1

        /** The command line was wrong. */
        const val EXIT_USAGE = 2
    }
}

/**
 * One JSON object per verdict, on one line, keys in a fixed order:
 *
 * - `{"file":…,"verdict":"compliant","flavour":"2b","checks":N}`
 * - `{"file":…,"verdict":"non-compliant","flavour":"2b","failures":[{"specification":…,"clause":…,"test":N,
 *   "description":…,"failedChecks":N},…]}`
 * - `{"file":…,"verdict":"unreadable","reason":…}`
 */
object PdfaVerdictJson {
    private const val FIRST_PRINTABLE = 0x20
    private const val HEX = 16
    private const val UNICODE_ESCAPE_DIGITS = 4

    /** The JSON line of [verdict]. */
    fun line(verdict: PdfaVerdict): String {
        val fields =
            mutableListOf(
                "file" to string(verdict.file.toString()),
            )
        when (verdict) {
            is PdfaVerdict.Compliant -> {
                fields += "verdict" to string("compliant")
                fields += "flavour" to string(verdict.flavour)
                fields += "checks" to verdict.checks.toString()
            }

            is PdfaVerdict.NonCompliant -> {
                fields += "verdict" to string("non-compliant")
                fields += "flavour" to string(verdict.flavour)
                fields += "failures" to verdict.failures.joinToString(",", "[", "]") { failure(it) }
            }

            is PdfaVerdict.Unreadable -> {
                fields += "verdict" to string("unreadable")
                fields += "reason" to string(verdict.reason)
            }
        }
        return obj(fields)
    }

    private fun failure(rule: FailedRule): String =
        obj(
            listOf(
                "specification" to string(rule.specification),
                "clause" to string(rule.clause),
                "test" to rule.testNumber.toString(),
                "description" to string(rule.description),
                "failedChecks" to rule.failedChecks.toString(),
            ),
        )

    private fun obj(fields: List<Pair<String, String>>): String =
        fields.joinToString(",", "{", "}") { (key, value) -> "${string(key)}:$value" }

    /** A JSON string literal (RFC 8259 §7): quotes, backslashes and control characters escaped. */
    fun string(value: String): String =
        buildString(value.length + 2) {
            append('"')
            for (c in value) {
                when {
                    c == '"' -> append("\\\"")
                    c == '\\' -> append("\\\\")
                    c == '\n' -> append("\\n")
                    c == '\r' -> append("\\r")
                    c == '\t' -> append("\\t")
                    c.code < FIRST_PRINTABLE -> append("\\u").append(c.code.toString(HEX).padStart(UNICODE_ESCAPE_DIGITS, '0'))
                    else -> append(c)
                }
            }
            append('"')
        }
}
