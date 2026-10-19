package hms.kernel.quantity

import hms.kernel.quantity.QuantityFixtures.dose
import hms.kernel.quantity.QuantityFixtures.quantity
import hms.kernel.quantity.QuantityFixtures.rate
import hms.kernel.quantity.QuantityFixtures.unit
import hms.kernel.time.ContentProvenance
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.math.BigDecimal

/**
 * `UnitTest:kernel-comparison-api-b-to-e` and `UnitTest:kernel-kb-check-returns-dose-check-unavailable`
 * (platform-kernel.md §10.5, §16, §17; BUILD-PROMPT §2.1 (b) to (e)). Thresholds are synthetic, never clinical values.
 */
class DoseComparisonsTest :
    FunSpec({
        val perDose = DoseBasis("synthetic-per-dose")
        val perDay = DoseBasis("synthetic-per-day")
        // Synthetic governed factor (§19.4).
        val threshold = QuantityFixtures.threshold("7")

        fun kb(
            result: KbDoseResult,
            ordered: DoseQuantity = dose("70", "mg"),
            basis: DoseBasis = perDose,
        ) = DoseComparisons.checkKbResult(result, ordered, basis, threshold)

        test("kernel-comparison-api-b-to-e: (b) matches only the same unit and a numerically equal value, no tolerance") {
            DoseComparisons.matchIndependentEntries(dose("0.5", "mg"), dose("0.50", "mg")).shouldBeInstanceOf<IndependentEntryMatch.Match>()
            DoseComparisons
                .matchIndependentEntries(dose("10", "mg"), dose("10.000", "mg"))
                .shouldBeInstanceOf<IndependentEntryMatch.Match>()
            DoseComparisons
                .matchIndependentEntries(dose("0.5", "mg"), dose("0.500000000000001", "mg"))
                .shouldBeInstanceOf<IndependentEntryMatch.Mismatch>()
                .reason shouldBe MismatchReason.VALUE_MISMATCH
            DoseComparisons
                .matchIndependentEntries(dose("5", "mg"), dose("50", "mg"))
                .shouldBeInstanceOf<IndependentEntryMatch.Mismatch>()
                .reason shouldBe MismatchReason.VALUE_MISMATCH
            DoseComparisons
                .matchIndependentEntries(dose("5", "mg"), dose("5", "mL"))
                .shouldBeInstanceOf<IndependentEntryMatch.Mismatch>()
                .reason shouldBe MismatchReason.UNIT_MISMATCH
            // Codes UCUM might treat as equivalent are still a unit mismatch.
            DoseComparisons
                .matchIndependentEntries(dose("5", "mL"), dose("5", "ml"))
                .shouldBeInstanceOf<IndependentEntryMatch.Mismatch>()
                .reason shouldBe MismatchReason.UNIT_MISMATCH
            // A unit mismatch wins over a value mismatch.
            DoseComparisons
                .matchIndependentEntries(dose("5", "mg"), dose("6", "mL"))
                .shouldBeInstanceOf<IndependentEntryMatch.Mismatch>()
                .reason shouldBe MismatchReason.UNIT_MISMATCH
        }

        test("kernel-comparison-api-b-to-e: (b) record holds both entries as entered and as displayed") {
            DoseComparisons.matchIndependentEntries(dose("0.50", "mg"), dose("0.5", "mg")).record shouldBe
                ComparisonRecord(
                    clause = Si05Clause.B,
                    apiVersion = DoseComparisons.API_VERSION,
                    inputsAsEntered = listOf("first 0.50 mg", "second 0.5 mg"),
                    inputsDisplayed = listOf("first 0.5 mg", "second 0.5 mg"),
                    kbVerbatim = null,
                    thresholdKey = null,
                    thresholdSource = null,
                    thresholdProvenance = null,
                    outcome = "Match",
                )
            DoseComparisons.matchIndependentEntries(dose("5", "mg"), dose("5", "mL")).record.outcome shouldBe "Mismatch(UNIT_MISMATCH)"
        }

        test("kernel-comparison-api-b-to-e: (c) a ratio decides ratio >= factor, the boundary inclusive") {
            kb(KbDoseResult.Ratio(BigDecimal("7"), perDose, "kb text")).shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            kb(KbDoseResult.Ratio(BigDecimal("7.00"), perDose, "kb text")).shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            kb(KbDoseResult.Ratio(BigDecimal("12.5"), perDose, "kb text")).shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            kb(KbDoseResult.Ratio(BigDecimal("6.999999999"), perDose, "kb text")).shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
            kb(KbDoseResult.Ratio(BigDecimal("0.01"), perDose, "kb text")).shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
        }

        test("kernel-comparison-api-b-to-e: (c) a maximum in the ordered unit decides ordered >= factor x maximum, inclusive") {
            val maximum = KbDoseResult.Maximum(dose("10", "mg"), perDose, "kb text")
            kb(maximum, ordered = dose("70", "mg")).shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            kb(maximum, ordered = dose("70.000", "mg")).shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            kb(maximum, ordered = dose("69.999", "mg")).shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
            kb(maximum, ordered = dose("700", "mg")).shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            kb(maximum, ordered = dose("10", "mg")).shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
            val fractional = QuantityFixtures.threshold("2.5")
            DoseComparisons
                .checkKbResult(KbDoseResult.Maximum(dose("0.4", "mg"), perDose, "kb"), dose("1", "mg"), perDose, fractional)
                .shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            DoseComparisons
                .checkKbResult(KbDoseResult.Maximum(dose("0.41", "mg"), perDose, "kb"), dose("1", "mg"), perDose, fractional)
                .shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
        }

        test("kernel-comparison-api-b-to-e: (c) a flag decides only through its declared multiple") {
            fun flag(
                raised: Boolean,
                multiple: String?,
            ) = kb(KbDoseResult.Flag(raised, multiple?.let(::BigDecimal), perDose, "kb flag text"))

            flag(raised = true, multiple = "7").shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            flag(raised = true, multiple = "9").shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
            flag(raised = false, multiple = "7").shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
            flag(raised = false, multiple = "3").shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
            // A flag raised below the governed factor, or not raised above it, proves nothing about the factor.
            flag(raised = true, multiple = "3").shouldBeInstanceOf<KbThresholdOutcome.DoseCheckUnavailable>().reason shouldBe
                UnavailableReason.KB_FLAG_NOT_COMPARABLE
            flag(raised = false, multiple = "9").shouldBeInstanceOf<KbThresholdOutcome.DoseCheckUnavailable>().reason shouldBe
                UnavailableReason.KB_FLAG_NOT_COMPARABLE
        }

        test("kernel-comparison-api-b-to-e: (c) record holds the inputs, the KB text verbatim and the threshold provenance") {
            val verbatim = "  Synthetic KB text: max 10 mg per dose  "
            val record = kb(KbDoseResult.Maximum(dose("10.0", "mg"), perDose, verbatim), ordered = dose("70.50", "mg")).record
            record shouldBe
                ComparisonRecord(
                    clause = Si05Clause.C,
                    apiVersion = DoseComparisons.API_VERSION,
                    inputsAsEntered =
                        listOf(
                            "ordered 70.50 mg basis synthetic-per-dose",
                            "kb maximum 10.0 mg basis synthetic-per-dose",
                            "threshold factor 7",
                        ),
                    inputsDisplayed =
                        listOf(
                            "ordered 70.5 mg basis synthetic-per-dose",
                            "kb maximum 10 mg basis synthetic-per-dose",
                            "threshold factor 7",
                        ),
                    kbVerbatim = verbatim,
                    thresholdKey = QuantityFixtures.THRESHOLD_KEY,
                    thresholdSource = "synthetic-entry-1",
                    thresholdProvenance = ContentProvenance.SYNTHETIC,
                    outcome = "AtOrAboveThreshold",
                )
            val ratioRecord = kb(KbDoseResult.Ratio(BigDecimal("1.50"), perDose, "r")).record
            ratioRecord.inputsAsEntered[1] shouldBe "kb ratio 1.50 basis synthetic-per-dose"
            ratioRecord.inputsDisplayed[1] shouldBe "kb ratio 1.5 basis synthetic-per-dose"
            kb(KbDoseResult.Flag(true, null, perDose, "f")).record.inputsAsEntered[1] shouldBe
                "kb flag raised at multiple unknown basis synthetic-per-dose"
            kb(KbDoseResult.Flag(false, BigDecimal("8.0"), perDose, "f")).record.inputsDisplayed[1] shouldBe
                "kb flag not raised at multiple 8 basis synthetic-per-dose"
            kb(KbDoseResult.NoneReturned).record.kbVerbatim shouldBe null
            kb(KbDoseResult.NoneReturned).record.outcome shouldBe "DoseCheckUnavailable(KB_RETURNED_NONE)"
        }

        test("kernel-kb-check-returns-dose-check-unavailable: every UnavailableReason") {
            val cases =
                mapOf(
                    UnavailableReason.KB_RETURNED_NONE to kb(KbDoseResult.NoneReturned),
                    UnavailableReason.KB_MAXIMUM_NOT_IN_THE_ORDERED_UNIT to
                        kb(KbDoseResult.Maximum(dose("10", "mL"), perDose, "kb"), ordered = dose("70", "mg")),
                    UnavailableReason.KB_BASIS_MISMATCH to kb(KbDoseResult.Ratio(BigDecimal("20"), perDay, "kb")),
                    UnavailableReason.KB_FLAG_THRESHOLD_UNKNOWN to kb(KbDoseResult.Flag(true, null, perDose, "kb")),
                    UnavailableReason.KB_FLAG_NOT_COMPARABLE to kb(KbDoseResult.Flag(true, BigDecimal("2"), perDose, "kb")),
                    UnavailableReason.KB_RESULT_INVALID to kb(KbDoseResult.Ratio(BigDecimal.ZERO, perDose, "kb")),
                )
            cases.keys shouldBe UnavailableReason.entries.toSet()
            cases.forEach { (reason, outcome) ->
                withClue(reason) {
                    outcome.shouldBeInstanceOf<KbThresholdOutcome.DoseCheckUnavailable>().reason shouldBe reason
                    outcome.record.outcome shouldBe "DoseCheckUnavailable($reason)"
                    outcome.record.clause shouldBe Si05Clause.C
                    outcome.record.thresholdKey shouldBe QuantityFixtures.THRESHOLD_KEY
                }
            }
        }

        test("kernel-kb-check-returns-dose-check-unavailable: basis mismatch on every KB result kind, a negative ratio or multiple") {
            listOf(
                KbDoseResult.Ratio(BigDecimal("100"), perDay, "kb"),
                KbDoseResult.Flag(true, BigDecimal("100"), perDay, "kb"),
                KbDoseResult.Flag(false, BigDecimal("1"), perDay, "kb"),
                KbDoseResult.Maximum(dose("1", "mg"), perDay, "kb"),
                // A basis code is compared exactly.
                KbDoseResult.Ratio(BigDecimal("100"), DoseBasis("Synthetic-Per-Dose"), "kb"),
            ).forEach { result ->
                withClue(result) {
                    kb(result).shouldBeInstanceOf<KbThresholdOutcome.DoseCheckUnavailable>().reason shouldBe
                        UnavailableReason.KB_BASIS_MISMATCH
                }
            }
            kb(KbDoseResult.Ratio(BigDecimal("-3"), perDose, "kb"))
                .shouldBeInstanceOf<KbThresholdOutcome.DoseCheckUnavailable>()
                .reason shouldBe UnavailableReason.KB_RESULT_INVALID
            listOf("0", "-7").forEach { multiple ->
                listOf(true, false).forEach { raised ->
                    withClue("$raised $multiple") {
                        kb(KbDoseResult.Flag(raised, BigDecimal(multiple), perDose, "kb"))
                            .shouldBeInstanceOf<KbThresholdOutcome.DoseCheckUnavailable>()
                            .reason shouldBe UnavailableReason.KB_RESULT_INVALID
                    }
                }
            }
            // A maximum in an equivalent-looking but different code is not the ordered unit.
            kb(KbDoseResult.Maximum(dose("1", "MG"), perDose, "kb"), ordered = dose("70", "mg"))
                .shouldBeInstanceOf<KbThresholdOutcome.DoseCheckUnavailable>()
                .reason shouldBe UnavailableReason.KB_MAXIMUM_NOT_IN_THE_ORDERED_UNIT
        }

        test("kernel-comparison-api-b-to-e: (d) inclusive bounds, a titration minimum of 0, unit mismatch and an inverted range") {
            fun check(
                entered: String,
                minimum: String,
                maximum: String,
                units: Triple<String, String, String> = Triple("mL/h", "mL/h", "mL/h"),
            ) = DoseComparisons.checkRateAgainstOrderedRange(
                rate(entered, units.first),
                rate(minimum, units.second),
                rate(maximum, units.third),
            )

            check("0", "0", "10").shouldBeInstanceOf<RateRangeOutcome.Within>()
            check("10", "0", "10").shouldBeInstanceOf<RateRangeOutcome.Within>()
            check("10.00", "0.0", "10").shouldBeInstanceOf<RateRangeOutcome.Within>()
            check("5", "5", "5").shouldBeInstanceOf<RateRangeOutcome.Within>()
            check("10.001", "0", "10").shouldBeInstanceOf<RateRangeOutcome.AboveMaximum>()
            check("1.999", "2", "10").shouldBeInstanceOf<RateRangeOutcome.BelowMinimum>()
            check("0", "0.1", "10").shouldBeInstanceOf<RateRangeOutcome.BelowMinimum>()
            check("5", "10", "2").shouldBeInstanceOf<RateRangeOutcome.InvalidOrderedRange>()
            check("5", "0", "10", Triple("mL/h", "mL", "mL/h")).shouldBeInstanceOf<RateRangeOutcome.UnitMismatch>()
            check("5", "0", "10", Triple("mL/h", "mL/h", "mL")).shouldBeInstanceOf<RateRangeOutcome.UnitMismatch>()
            check("5", "0", "10", Triple("mL", "mL/h", "mL/h")).shouldBeInstanceOf<RateRangeOutcome.UnitMismatch>()
            // A unit mismatch is reported before an inverted range.
            check("5", "10", "2", Triple("mL", "mL/h", "mL/h")).shouldBeInstanceOf<RateRangeOutcome.UnitMismatch>()
            check("2.50", "0", "10.0").record shouldBe
                ComparisonRecord(
                    clause = Si05Clause.D,
                    apiVersion = DoseComparisons.API_VERSION,
                    inputsAsEntered = listOf("entered 2.50 mL/h", "minimum 0 mL/h", "maximum 10.0 mL/h"),
                    inputsDisplayed = listOf("entered 2.5 mL/h", "minimum 0 mL/h", "maximum 10 mL/h"),
                    kbVerbatim = null,
                    thresholdKey = null,
                    thresholdSource = null,
                    thresholdProvenance = null,
                    outcome = "Within",
                )
        }

        test("kernel-comparison-api-b-to-e: (e) exact sums of measured and medication volumes, net may be negative") {
            val mL = unit("mL")
            val outcome =
                DoseComparisons.fluidBalance(
                    intake = listOf(FluidEntry.Measured(quantity("100.5", "mL")), FluidEntry.Medication(dose("0.25", "mL"))),
                    output = listOf(FluidEntry.Measured(quantity("150", "mL")), FluidEntry.Measured(quantity("0", "mL"))),
                    balanceUnit = mL,
                )
            val balance = outcome.shouldBeInstanceOf<FluidBalanceOutcome.Balance>()
            balance.intake shouldBe quantity("100.75", "mL")
            balance.output shouldBe quantity("150", "mL")
            balance.net shouldBe quantity("-49.25", "mL")
            balance.record shouldBe
                ComparisonRecord(
                    clause = Si05Clause.E,
                    apiVersion = DoseComparisons.API_VERSION,
                    inputsAsEntered =
                        listOf(
                            "intake[0] measured 100.5 mL",
                            "intake[1] medication 0.25 mL",
                            "output[0] measured 150 mL",
                            "output[1] measured 0 mL",
                            "balance unit mL",
                        ),
                    inputsDisplayed =
                        listOf(
                            "intake[0] measured 100.5 mL",
                            "intake[1] medication 0.25 mL",
                            "output[0] measured 150 mL",
                            "output[1] measured 0 mL",
                            "balance unit mL",
                        ),
                    kbVerbatim = null,
                    thresholdKey = null,
                    thresholdSource = null,
                    thresholdProvenance = null,
                    outcome = "Balance intake 100.75 mL output 150 mL net -49.25 mL",
                )
            val empty = DoseComparisons.fluidBalance(emptyList(), emptyList(), mL).shouldBeInstanceOf<FluidBalanceOutcome.Balance>()
            empty.net shouldBe quantity("0", "mL")
            // No rounding: the smallest step survives.
            DoseComparisons
                .fluidBalance(listOf(FluidEntry.Measured(quantity("0.000000000000001", "mL"))), emptyList(), mL)
                .shouldBeInstanceOf<FluidBalanceOutcome.Balance>()
                .net shouldBe quantity("0.000000000000001", "mL")
        }

        test("kernel-comparison-api-b-to-e: (e) any entry in another unit is UnitMismatch with no partial sums") {
            val outcome =
                DoseComparisons.fluidBalance(
                    intake = listOf(FluidEntry.Measured(quantity("100", "mL")), FluidEntry.Medication(dose("5", "mg"))),
                    output = listOf(FluidEntry.Measured(quantity("-1", "mL")), FluidEntry.Measured(quantity("50", "ml"))),
                    balanceUnit = unit("mL"),
                )
            val mismatch = outcome.shouldBeInstanceOf<FluidBalanceOutcome.UnitMismatch>()
            mismatch.unitsFound shouldBe setOf(unit("mL"), unit("mg"), unit("ml"))
            mismatch.record.outcome shouldBe "UnitMismatch [mL, mg, ml]"
            // Every entry in another unit than the balance unit, even all alike, is a mismatch.
            DoseComparisons
                .fluidBalance(listOf(FluidEntry.Measured(quantity("1", "L"))), emptyList(), unit("mL"))
                .shouldBeInstanceOf<FluidBalanceOutcome.UnitMismatch>()
                .unitsFound shouldBe setOf(unit("L"))
        }

        test("kernel-comparison-api-b-to-e: (e) a negative entry is InvalidEntry, intake before output") {
            val mL = unit("mL")
            DoseComparisons
                .fluidBalance(
                    listOf(FluidEntry.Measured(quantity("10", "mL")), FluidEntry.Measured(quantity("-0.1", "mL"))),
                    listOf(FluidEntry.Measured(quantity("-5", "mL"))),
                    mL,
                ).shouldBeInstanceOf<FluidBalanceOutcome.InvalidEntry>()
                .let {
                    it.side shouldBe FluidSide.INTAKE
                    it.index shouldBe 1
                    it.record.outcome shouldBe "InvalidEntry INTAKE[1]"
                }
            DoseComparisons
                .fluidBalance(
                    listOf(FluidEntry.Measured(quantity("10", "mL"))),
                    listOf(FluidEntry.Measured(quantity("5", "mL")), FluidEntry.Measured(quantity("-5", "mL"))),
                    mL,
                ).shouldBeInstanceOf<FluidBalanceOutcome.InvalidEntry>()
                .let {
                    it.side shouldBe FluidSide.OUTPUT
                    it.index shouldBe 1
                }
        }
    })
