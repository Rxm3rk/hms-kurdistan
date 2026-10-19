package hms.satellites.pdfaverify

import org.verapdf.core.VeraPDFException
import org.verapdf.gf.foundry.VeraGreenfieldFoundryProvider
import org.verapdf.pdfa.Foundries
import org.verapdf.pdfa.flavours.PDFAFlavour
import org.verapdf.pdfa.results.TestAssertion
import org.verapdf.pdfa.results.ValidationResult
import org.verapdf.pdfa.validation.profiles.RuleId
import org.verapdf.processor.reports.enums.JobEndStatus
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

/**
 * Validates a PDF against PDF/A-2b (ISO 19005-2, level B) with the veraPDF validation library and its
 * PDFBox-free "greenfield" model (docs/specs/modules/platform-docs.md §7.5 "PDF/A conformance", §10;
 * the check `PdfaCheck:veraPDF-2b`).
 *
 * BUILD-ONLY: the golden step runs this on the renderer satellite's PDFs. It is never shipped to a site
 * (BUILD-PROMPT §4.3; veraPDF is used under its MPL-2.0 option, README.md).
 *
 * The flavour is forced to 2b, whatever the file declares in its XMP metadata, so a file that claims
 * another part or level (or none) is judged against 2b, not against its own claim. The verdict fails
 * closed: anything but a normal end of a 2b validation that veraPDF reports as compliant is
 * [PdfaVerdict.NonCompliant] or [PdfaVerdict.Unreadable], never [PdfaVerdict.Compliant].
 */
class PdfaVerifier {
    init {
        // Registers the greenfield foundry as veraPDF's default; repeated calls are harmless.
        VeraGreenfieldFoundryProvider.initialise()
    }

    /** The verdict on [file]. Never throws for a bad input file: an unreadable file is a verdict too. */
    fun verify(file: Path): PdfaVerdict {
        if (!Files.isRegularFile(file)) return PdfaVerdict.Unreadable(file, "not a regular file")
        return try {
            validate(file)
        } catch (e: VeraPDFException) {
            // Parse failures, encrypted files and validation failures (ModelParsingException,
            // EncryptedPdfException, ValidationException) all end here: the file is not shown to conform.
            PdfaVerdict.Unreadable(file, describe(e))
        } catch (e: IOException) {
            PdfaVerdict.Unreadable(file, describe(e))
        }
    }

    private fun validate(file: Path): PdfaVerdict {
        val foundry = Foundries.defaultInstance()
        return foundry.createParser(file.toFile(), FLAVOUR).use { parser ->
            foundry.createValidator(FLAVOUR, false).use { validator ->
                verdictOf(file, validator.validate(parser))
            }
        }
    }

    private fun verdictOf(
        file: Path,
        result: ValidationResult,
    ): PdfaVerdict {
        val status = result.jobEndStatus
        val flavour = result.pdfaFlavour
        return when {
            status != JobEndStatus.NORMAL -> PdfaVerdict.Unreadable(file, "validation did not finish: $status")
            flavour != FLAVOUR -> PdfaVerdict.Unreadable(file, "validated as ${flavour?.id}, not ${FLAVOUR.id}")
            result.isCompliant -> PdfaVerdict.Compliant(file, FLAVOUR.id, result.totalAssertions)
            else -> PdfaVerdict.NonCompliant(file, FLAVOUR.id, failedRules(result))
        }
    }

    /** One entry per failed rule, in clause and test order, with the number of failed checks of each. */
    private fun failedRules(result: ValidationResult): List<FailedRule> {
        val failedAssertions = result.testAssertions.filter { it.status == TestAssertion.Status.FAILED }
        val messages = failedAssertions.groupBy { it.ruleId.key() }.mapValues { (_, list) -> list.first().message }
        val counts = linkedMapOf<RuleKey, Int>()
        val ruleIds = linkedMapOf<RuleKey, RuleId>()
        failedAssertions.forEach { assertion ->
            val key = assertion.ruleId.key()
            ruleIds.putIfAbsent(key, assertion.ruleId)
            counts[key] = (counts[key] ?: 0) + 1
        }
        // veraPDF also counts failed checks per rule; prefer its count, which includes checks whose
        // assertions were not kept, and include a rule known only from the counts.
        result.failedChecks.orEmpty().forEach { (ruleId, count) ->
            val key = ruleId.key()
            ruleIds.putIfAbsent(key, ruleId)
            counts[key] = maxOf(counts[key] ?: 0, count)
        }
        val profile = result.validationProfile
        return ruleIds
            .map { (key, ruleId) ->
                val description =
                    profile?.getRuleByRuleId(ruleId)?.description
                        ?: messages[key]
                        ?: "no description in the validation profile"
                FailedRule(
                    specification = key.specification,
                    clause = key.clause,
                    testNumber = key.testNumber,
                    description = description.trim(),
                    failedChecks = counts[key] ?: 0,
                )
            }.sortedWith(compareBy<FailedRule>({ clauseOrder(it.clause) }, { it.clause }, { it.testNumber }))
    }

    private data class RuleKey(
        val specification: String,
        val clause: String,
        val testNumber: Int,
    )

    private fun RuleId.key(): RuleKey = RuleKey(specification?.id ?: "unknown", clause ?: "unknown", testNumber)

    private fun describe(e: Exception): String =
        listOfNotNull(e.javaClass.simpleName, e.message?.takeIf { it.isNotBlank() }).joinToString(": ")

    companion object {
        /** The only flavour this checker accepts (spec §7.5: PDF/A-2b). */
        val FLAVOUR: PDFAFlavour = PDFAFlavour.PDFA_2_B

        /** Orders clauses numerically ("6.2.10" after "6.2.9"); non-numeric parts sort as zero. */
        private fun clauseOrder(clause: String): String =
            clause.split('.').joinToString(".") { part -> (part.toIntOrNull() ?: 0).toString().padStart(CLAUSE_PART_WIDTH, '0') }

        private const val CLAUSE_PART_WIDTH = 4
    }
}

/** A verdict of [PdfaVerifier] on one file. */
sealed interface PdfaVerdict {
    /** The file judged. */
    val file: Path

    /** True only for [Compliant]. */
    val passed: Boolean get() = this is Compliant

    /** veraPDF found the file conforming to [flavour] after [checks] rule checks. */
    data class Compliant(
        override val file: Path,
        val flavour: String,
        val checks: Int,
    ) : PdfaVerdict

    /** veraPDF found the file not conforming to [flavour]; [failures] lists every failed rule. */
    data class NonCompliant(
        override val file: Path,
        val flavour: String,
        val failures: List<FailedRule>,
    ) : PdfaVerdict

    /** The file could not be read or validated to the end, so it is not shown to conform (fail closed). */
    data class Unreadable(
        override val file: Path,
        val reason: String,
    ) : PdfaVerdict
}

/**
 * A failed veraPDF rule: the specification (veraPDF writes `ISO 19005-2:2011`), the clause of ISO 19005-2
 * and the rule's test number within it, the rule's description from the validation profile, and how many
 * checks of the rule failed in the file.
 */
data class FailedRule(
    val specification: String,
    val clause: String,
    val testNumber: Int,
    val description: String,
    val failedChecks: Int,
)
