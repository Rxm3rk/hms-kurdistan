@file:OptIn(DoseMagnitudeAccess::class)

package hms.kernel.quantity

import hms.kernel.testing.PropertyTestBudget
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.choice
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.long
import io.kotest.property.arbitrary.orNull
import io.kotest.property.checkAll
import java.math.BigDecimal

private const val MAX_FACTOR_UNSCALED = 2_000L
private const val MAX_SCALE = 3
private const val MAX_ENTRIES = 6
private const val MAX_VOLUME_UNSCALED = 1_000_000L
private const val NULL_SHARE = 0.2

/**
 * The comparison API (platform-kernel.md §10.5, §17): `PropertyTest:kernel-independent-entry-match-exact` and
 * `PropertyTest:kernel-kb-threshold-comparison`, plus exact fluid sums. Thresholds are synthetic, never clinical values.
 */
class DoseComparisonsPropertyTest :
    FunSpec({
        val budget = PropertyTestBudget.sequences()
        val units = Arb.element("mg", "mL", "ml", "xa")
        val doses =
            arbitrary {
                val quantity = Quantity.ofMagnitude(QuantityArbs.collidingPositives.bind(), QuantityFixtures.unit(units.bind()))
                (DoseQuantity.of(quantity) as DoseQuantityResult.Valid).dose
            }
        val positives = arbitrary { BigDecimal.valueOf(Arb.long(1L..MAX_FACTOR_UNSCALED).bind(), Arb.int(0..MAX_SCALE).bind()) }
        val thresholds = arbitrary { QuantityFixtures.threshold(positives.bind().toPlainString()) }
        val bases = Arb.element(DoseBasis("synthetic-a"), DoseBasis("synthetic-b"))

        test("kernel-independent-entry-match-exact: a match exactly when the units are equal and the values numerically equal") {
            checkAll(budget, doses, doses) { first, second ->
                val outcome = DoseComparisons.matchIndependentEntries(first, second)
                val sameUnit = first.unit.code == second.unit.code
                val sameValue = first.magnitude().compareTo(second.magnitude()) == 0
                when {
                    sameUnit && sameValue -> outcome.shouldBeInstanceOf<IndependentEntryMatch.Match>()
                    !sameUnit -> outcome.shouldBeInstanceOf<IndependentEntryMatch.Mismatch>().reason shouldBe MismatchReason.UNIT_MISMATCH
                    else -> outcome.shouldBeInstanceOf<IndependentEntryMatch.Mismatch>().reason shouldBe MismatchReason.VALUE_MISMATCH
                }
                outcome.record.inputsAsEntered shouldBe listOf("first ${first.asEntered()}", "second ${second.asEntered()}")
                // The comparison is symmetric.
                DoseComparisons.matchIndependentEntries(second, first)::class shouldBe outcome::class
            }
        }

        test("kernel-kb-threshold-comparison: a ratio is at or above exactly when ratio >= factor; zero or less is invalid") {
            val ratios = Arb.choice(positives, Arb.element(BigDecimal.ZERO, BigDecimal("-1"), BigDecimal("-0.001")))
            checkAll(budget, ratios, doses, thresholds, bases, bases) { ratio, ordered, threshold, kbBasis, orderedBasis ->
                val outcome = DoseComparisons.checkKbResult(KbDoseResult.Ratio(ratio, kbBasis, "kb"), ordered, orderedBasis, threshold)
                withClue("ratio $ratio factor ${threshold.factor} bases $kbBasis $orderedBasis") {
                    when {
                        kbBasis != orderedBasis -> outcome.unavailable() shouldBe UnavailableReason.KB_BASIS_MISMATCH
                        ratio.signum() <= 0 -> outcome.unavailable() shouldBe UnavailableReason.KB_RESULT_INVALID
                        ratio >= threshold.factor -> outcome.shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
                        else -> outcome.shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
                    }
                }
            }
        }

        test("kernel-kb-threshold-comparison: a maximum is at or above exactly when ordered >= factor x maximum, in the ordered unit") {
            checkAll(budget, doses, doses, thresholds, bases) { ordered, maximum, threshold, basis ->
                val outcome = DoseComparisons.checkKbResult(KbDoseResult.Maximum(maximum, basis, "kb"), ordered, basis, threshold)
                val product = threshold.factor.multiply(maximum.magnitude())
                withClue("ordered ${ordered.asEntered()} maximum ${maximum.asEntered()} factor ${threshold.factor}") {
                    when {
                        maximum.unit != ordered.unit -> outcome.unavailable() shouldBe UnavailableReason.KB_MAXIMUM_NOT_IN_THE_ORDERED_UNIT
                        ordered.magnitude() >= product -> outcome.shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
                        else -> outcome.shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
                    }
                }
            }
        }

        test("kernel-kb-threshold-comparison: a maximum exactly at factor x maximum is at or above, one step below is below") {
            checkAll(budget, doses, thresholds) { maximum, threshold ->
                val product = threshold.factor.multiply(maximum.magnitude())
                val at = QuantityFixtures.dose(product.toPlainString(), maximum.unit.code)
                val step = BigDecimal.ONE.movePointLeft(product.scale())
                DoseComparisons
                    .checkKbResult(KbDoseResult.Maximum(maximum, DoseBasis("b"), "kb"), at, DoseBasis("b"), threshold)
                    .shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
                val belowValue = product.subtract(step)
                if (belowValue.signum() > 0) {
                    val below = QuantityFixtures.dose(belowValue.toPlainString(), maximum.unit.code)
                    DoseComparisons
                        .checkKbResult(KbDoseResult.Maximum(maximum, DoseBasis("b"), "kb"), below, DoseBasis("b"), threshold)
                        .shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
                }
            }
        }

        test("kernel-kb-threshold-comparison: a flag follows the rule for every combination of raised, kbMultiple and factor") {
            val multiples: Arb<BigDecimal?> = Arb.choice(positives, Arb.element(BigDecimal.ZERO, BigDecimal("-2"))).orNull(NULL_SHARE)
            checkAll(budget, Arb.boolean(), multiples, thresholds, doses, Arb.boolean()) { raised, multiple, threshold, ordered, atFactor ->
                // A multiple equal to the factor is drawn often, so the inclusive boundary is covered.
                val kbMultiple = if (multiple != null && atFactor) threshold.factor else multiple
                val basis = DoseBasis("b")
                val outcome = DoseComparisons.checkKbResult(KbDoseResult.Flag(raised, kbMultiple, basis, "kb"), ordered, basis, threshold)
                withClue("raised $raised multiple $kbMultiple factor ${threshold.factor}") {
                    when {
                        kbMultiple == null -> outcome.unavailable() shouldBe UnavailableReason.KB_FLAG_THRESHOLD_UNKNOWN
                        kbMultiple.signum() <= 0 -> outcome.unavailable() shouldBe UnavailableReason.KB_RESULT_INVALID
                        raised && kbMultiple >= threshold.factor -> outcome.shouldBeInstanceOf<KbThresholdOutcome.AtOrAboveThreshold>()
                        !raised && kbMultiple <= threshold.factor -> outcome.shouldBeInstanceOf<KbThresholdOutcome.BelowThreshold>()
                        else -> outcome.unavailable() shouldBe UnavailableReason.KB_FLAG_NOT_COMPARABLE
                    }
                }
            }
        }

        test("kernel-kb-threshold-comparison: basis mismatch, a maximum in another unit and NoneReturned are dose check unavailable") {
            checkAll(budget, doses, thresholds) { ordered, threshold ->
                val other = DoseBasis("synthetic-other")
                val basis = DoseBasis("synthetic-ordered")
                listOf(
                    KbDoseResult.Ratio(BigDecimal.TEN, other, "kb"),
                    KbDoseResult.Flag(true, threshold.factor, other, "kb"),
                    KbDoseResult.Maximum(ordered, other, "kb"),
                ).forEach { kb ->
                    DoseComparisons.checkKbResult(kb, ordered, basis, threshold).unavailable() shouldBe UnavailableReason.KB_BASIS_MISMATCH
                }
                val otherUnit = if (ordered.unit.code == "mg") "mL" else "mg"
                DoseComparisons
                    .checkKbResult(KbDoseResult.Maximum(QuantityFixtures.dose("1", otherUnit), basis, "kb"), ordered, basis, threshold)
                    .unavailable() shouldBe UnavailableReason.KB_MAXIMUM_NOT_IN_THE_ORDERED_UNIT
                DoseComparisons.checkKbResult(KbDoseResult.NoneReturned, ordered, basis, threshold).unavailable() shouldBe
                    UnavailableReason.KB_RETURNED_NONE
            }
        }

        test("fluid balance sums exactly: intake and output are exact sums and net = intake - output") {
            val mL = QuantityFixtures.unit("mL")
            val volumes =
                arbitrary {
                    val value = BigDecimal.valueOf(Arb.long(0L..MAX_VOLUME_UNSCALED).bind(), Arb.int(0..MAX_SCALE).bind())
                    Quantity.ofMagnitude(value, mL)
                }
            val entries = Arb.list(volumes, 0..MAX_ENTRIES)
            checkAll(budget, entries, entries) { intake, output ->
                val outcome =
                    DoseComparisons
                        .fluidBalance(intake.map { FluidEntry.Measured(it) }, output.map { FluidEntry.Measured(it) }, mL)
                        .shouldBeInstanceOf<FluidBalanceOutcome.Balance>()
                val intakeSum = intake.fold(BigDecimal.ZERO) { sum, volume -> sum.add(volume.magnitude()) }
                val outputSum = output.fold(BigDecimal.ZERO) { sum, volume -> sum.add(volume.magnitude()) }
                outcome.intake.magnitude() shouldBe intakeSum
                outcome.output.magnitude() shouldBe outputSum
                outcome.net.magnitude() shouldBe intakeSum.subtract(outputSum)
            }
        }
    })

private fun KbThresholdOutcome.unavailable(): UnavailableReason = shouldBeInstanceOf<KbThresholdOutcome.DoseCheckUnavailable>().reason
