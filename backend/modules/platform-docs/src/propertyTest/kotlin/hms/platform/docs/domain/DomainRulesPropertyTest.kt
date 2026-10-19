package hms.platform.docs.domain

import hms.kernel.testing.PropertyTestBudget
import hms.platform.docs.api.HalPrintOutcome
import hms.platform.docs.domain.barcode.BarcodePayload
import hms.platform.docs.domain.barcode.PayloadOutcome
import hms.platform.docs.domain.job.PrintJobLifecycle
import hms.platform.docs.domain.job.PrintJobState
import hms.platform.docs.domain.job.TransitionResult
import hms.platform.docs.domain.rules.TextChecks
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.choice
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.enum
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.map
import io.kotest.property.arbitrary.string
import io.kotest.property.checkAll

private val identifierChars = ('A'..'Z') + ('a'..'z') + ('0'..'9') + '-'

/** Longest generated identifier or free string. */
private const val MAX_FIELD_LENGTH = 20

/** Most HAL reports generated for one job. */
private const val MAX_REPORTS = 8

/** Printable ASCII, the payload's alphabet (spec §6.1): space to tilde. */
private const val FIRST_PRINTABLE_ASCII = 0x20
private const val LAST_PRINTABLE_ASCII = 0x7E
private val printableAscii = FIRST_PRINTABLE_ASCII..LAST_PRINTABLE_ASCII

private val identifiers = Arb.list(Arb.element(identifierChars), 1..MAX_FIELD_LENGTH).map { it.joinToString("") }

private val anyStrings = Arb.string(0..MAX_FIELD_LENGTH)

private val halOutcomes =
    Arb.choice(
        Arb.element(listOf(HalPrintOutcome.Sent, HalPrintOutcome.Completed)),
        Arb.boolean().map { HalPrintOutcome.Error("kind", "reason", it) },
    )

class DomainRulesPropertyTest :
    FunSpec({
        test("PropertyTest:barcode-payload-fields: identifiers in R4's alphabet round-trip through the payload") {
            checkAll(PropertyTestBudget.sequences(), identifiers, identifiers, identifiers) { mrn, encounter, serial ->
                val built = BarcodePayload.wristband(mrn, encounter, serial) as PayloadOutcome.Built
                built.payload.split("|") shouldBe listOf("HMS1", "M:$mrn", "E:$encounter", "B:$serial")
                built.payload.all { it.code in printableAscii } shouldBe true
            }
        }

        test("PropertyTest:barcode-payload-fields: a field with any character outside the alphabet is refused") {
            checkAll(PropertyTestBudget.sequences(), anyStrings) { field ->
                val valid = field.isNotEmpty() && field.codePoints().allMatch(TextChecks::isIdentifierCharacter)
                (BarcodePayload.specimenCode128(field) is PayloadOutcome.Built) shouldBe valid
                (BarcodePayload.wristband("SYN-1", field, "J-1") is PayloadOutcome.Built) shouldBe valid
            }
        }

        test("PropertyTest:print-job-lifecycle: no sequence of reports leaves a terminal state or returns to requested") {
            checkAll(PropertyTestBudget.sequences(), Arb.enum<PrintJobState>(), Arb.list(halOutcomes, 0..MAX_REPORTS)) { start, reports ->
                var state = start
                reports.forEach { outcome ->
                    when (val result = PrintJobLifecycle.onHalOutcome(state, outcome)) {
                        is TransitionResult.Accepted -> {
                            state.terminal shouldBe false
                            result.to shouldBe PrintJobLifecycle.stateFor(outcome)
                            state = result.to
                        }

                        is TransitionResult.LateOutcome -> {
                            state shouldBe PrintJobState.OUTCOME_UNKNOWN
                        }

                        is TransitionResult.Rejected -> {
                            Unit
                        }
                    }
                    (state == PrintJobState.REQUESTED && start != PrintJobState.REQUESTED) shouldBe false
                }
                if (start.terminal) state shouldBe start
            }
        }
    })
