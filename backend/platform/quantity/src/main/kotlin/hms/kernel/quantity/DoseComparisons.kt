// The one audited comparison API reads magnitudes (platform-kernel.md §10.5, §11).
@file:OptIn(DoseMagnitudeAccess::class)

package hms.kernel.quantity

import hms.kernel.time.ContentProvenance
import java.math.BigDecimal

/** The SI-05 clause a comparison implements (BUILD-PROMPT §2.1 (b) to (e); platform-kernel.md §10.5). */
enum class Si05Clause { B, C, D, E }

/**
 * What a [DoseComparisons] outcome was decided on (platform-kernel.md §10.5; DN-KN2). The calling command stores it
 * with its journal row and audit event; the kernel writes nothing. Each input is a label followed by the value:
 * as entered (scale kept) in [inputsAsEntered], as [ClinicalNumberFormat] shows it in [inputsDisplayed].
 */
class ComparisonRecord(
    val clause: Si05Clause,
    val apiVersion: Int,
    /** What each person typed, scale kept. */
    val inputsAsEntered: List<String>,
    /** As [ClinicalNumberFormat] shows them. */
    val inputsDisplayed: List<String>,
    /** (c) only: the KB text verbatim. */
    val kbVerbatim: String?,
    /** (c) only. */
    val thresholdKey: String?,
    /** (c) only: the value entry id or "definition-default". */
    val thresholdSource: String?,
    /** (c) only. */
    val thresholdProvenance: ContentProvenance?,
    val outcome: String,
) {
    private fun fields(): List<Any?> =
        listOf(
            clause,
            apiVersion,
            inputsAsEntered,
            inputsDisplayed,
            kbVerbatim,
            thresholdKey,
            thresholdSource,
            thresholdProvenance,
            outcome,
        )

    override fun equals(other: Any?): Boolean = other is ComparisonRecord && fields() == other.fields()

    override fun hashCode(): Int = fields().hashCode()

    override fun toString(): String =
        "ComparisonRecord(clause=$clause, apiVersion=$apiVersion, inputsAsEntered=$inputsAsEntered, " +
            "inputsDisplayed=$inputsDisplayed, kbVerbatim=$kbVerbatim, thresholdKey=$thresholdKey, " +
            "thresholdSource=$thresholdSource, thresholdProvenance=$thresholdProvenance, outcome=$outcome)"
}

/** A KB dose basis code (vocabulary: the KB adapter and the medications specification); compared exactly. */
@JvmInline
value class DoseBasis(
    val code: String,
)

/** What the KB returned for a dose check (platform-kernel.md §10.5). */
sealed interface KbDoseResult {
    /** Ordered dose ÷ KB maximum on [basis], as a plain decimal multiple (1.5 means 150 %), never a percentage. */
    data class Ratio(
        val ratio: BigDecimal,
        val basis: DoseBasis,
        val verbatim: String,
    ) : KbDoseResult

    /** A KB flag raised at [kbMultiple] × the KB maximum on [basis]; null = unknown. */
    data class Flag(
        val raised: Boolean,
        val kbMultiple: BigDecimal?,
        val basis: DoseBasis,
        val verbatim: String,
    ) : KbDoseResult

    data class Maximum(
        val maximum: DoseQuantity,
        val basis: DoseBasis,
        val verbatim: String,
    ) : KbDoseResult

    data object NoneReturned : KbDoseResult
}

/** An intake or output entry for a fluid balance (platform-kernel.md §10.5 (e)). */
sealed interface FluidEntry {
    data class Measured(
        val volume: Quantity,
    ) : FluidEntry

    data class Medication(
        val volume: DoseQuantity,
    ) : FluidEntry
}

enum class FluidSide { INTAKE, OUTPUT }

/**
 * The one audited comparison API (platform-kernel.md §10.5; §6.8 #1; CTRL-0005-5). It implements exactly
 * BUILD-PROMPT §2.1 (b) to (e) and nothing else; (a) is display ([ClinicalNumberFormat]). Every outcome carries a
 * [ComparisonRecord]. Every comparison is exact ([BigDecimal.compareTo]); nothing is rounded, converted or returned
 * beyond what the outcome types hold. Safety code owners review every change to this object.
 */
object DoseComparisons {
    const val API_VERSION: Int = 2

    /**
     * §2.1 (b): the same unit code and numerically equal (`0.5` matches `0.50`), else `Mismatch(UNIT_MISMATCH)` or
     * `Mismatch(VALUE_MISMATCH)`; no tolerance. Record inputs: `first`, `second`.
     */
    fun matchIndependentEntries(
        first: DoseQuantity,
        second: DoseQuantity,
    ): IndependentEntryMatch {
        val reason =
            when {
                first.unit != second.unit -> MismatchReason.UNIT_MISMATCH
                first.magnitude().compareTo(second.magnitude()) != 0 -> MismatchReason.VALUE_MISMATCH
                else -> null
            }
        val inputs = listOf(ComparisonInput("first", first.asQuantity()), ComparisonInput("second", second.asQuantity()))
        val outcome = if (reason == null) "Match" else "Mismatch($reason)"
        val record = record(Si05Clause.B, inputs.map { it.asEntered() }, inputs.map { it.displayed() }, outcome)
        return if (reason == null) IndependentEntryMatch.Match(record) else IndependentEntryMatch.Mismatch(reason, record)
    }

    /**
     * §2.1 (c), by the rules of platform-kernel.md §10.5: a basis other than [orderedBasis] is
     * `KB_BASIS_MISMATCH`; a ratio decides `ratio >= factor` and must be greater than zero; a maximum must be in
     * exactly the ordered unit and decides `ordered >= factor × maximum` (computed here, never returned); a flag
     * decides only through its declared multiple; `NoneReturned` is `KB_RETURNED_NONE`. Record inputs: `ordered`,
     * `kb`, `threshold factor`.
     */
    fun checkKbResult(
        kb: KbDoseResult,
        ordered: DoseQuantity,
        orderedBasis: DoseBasis,
        threshold: GovernedThreshold,
    ): KbThresholdOutcome {
        val decision =
            when {
                kb is KbDoseResult.NoneReturned -> KbDecision.Unavailable(UnavailableReason.KB_RETURNED_NONE)
                kb.basis() != orderedBasis -> KbDecision.Unavailable(UnavailableReason.KB_BASIS_MISMATCH)
                else -> decide(kb, ordered, threshold.factor)
            }
        val outcome =
            when (decision) {
                KbDecision.AtOrAbove -> "AtOrAboveThreshold"
                KbDecision.Below -> "BelowThreshold"
                is KbDecision.Unavailable -> "DoseCheckUnavailable(${decision.reason})"
            }
        val factor = ClinicalNumberFormat.formatNumber(threshold.factor)
        val record =
            ComparisonRecord(
                clause = Si05Clause.C,
                apiVersion = API_VERSION,
                inputsAsEntered =
                    listOf(
                        "ordered ${ordered.asEntered()} basis ${orderedBasis.code}",
                        "kb ${kbInput(kb, displayed = false)}",
                        "threshold factor ${threshold.factor.toPlainString()}",
                    ),
                inputsDisplayed =
                    listOf(
                        "ordered ${ordered.display()} basis ${orderedBasis.code}",
                        "kb ${kbInput(kb, displayed = true)}",
                        "threshold factor $factor",
                    ),
                kbVerbatim = kb.verbatim(),
                thresholdKey = threshold.source.key,
                thresholdSource = threshold.source.sourceRef,
                thresholdProvenance = threshold.source.provenance,
                outcome = outcome,
            )
        return when (decision) {
            KbDecision.AtOrAbove -> KbThresholdOutcome.AtOrAboveThreshold(record)
            KbDecision.Below -> KbThresholdOutcome.BelowThreshold(record)
            is KbDecision.Unavailable -> KbThresholdOutcome.DoseCheckUnavailable(decision.reason, record)
        }
    }

    /**
     * §2.1 (d): all three rates in exactly the same unit, else `UnitMismatch`; a minimum above the maximum is
     * `InvalidOrderedRange`; inclusive bounds. Record inputs: `entered`, `minimum`, `maximum`.
     */
    fun checkRateAgainstOrderedRange(
        entered: DoseRate,
        orderedMinimum: DoseRate,
        orderedMaximum: DoseRate,
    ): RateRangeOutcome {
        val value = entered.magnitude()
        val minimum = orderedMinimum.magnitude()
        val maximum = orderedMaximum.magnitude()
        val decision =
            when {
                entered.unit != orderedMinimum.unit || entered.unit != orderedMaximum.unit -> RateDecision.UNIT_MISMATCH
                minimum > maximum -> RateDecision.INVALID_ORDERED_RANGE
                value < minimum -> RateDecision.BELOW_MINIMUM
                value > maximum -> RateDecision.ABOVE_MAXIMUM
                else -> RateDecision.WITHIN
            }
        val inputs =
            listOf(
                ComparisonInput("entered", entered.asQuantity()),
                ComparisonInput("minimum", orderedMinimum.asQuantity()),
                ComparisonInput("maximum", orderedMaximum.asQuantity()),
            )
        val record = record(Si05Clause.D, inputs.map { it.asEntered() }, inputs.map { it.displayed() }, decision.outcome)
        return when (decision) {
            RateDecision.UNIT_MISMATCH -> RateRangeOutcome.UnitMismatch(record)
            RateDecision.INVALID_ORDERED_RANGE -> RateRangeOutcome.InvalidOrderedRange(record)
            RateDecision.BELOW_MINIMUM -> RateRangeOutcome.BelowMinimum(record)
            RateDecision.ABOVE_MAXIMUM -> RateRangeOutcome.AboveMaximum(record)
            RateDecision.WITHIN -> RateRangeOutcome.Within(record)
        }
    }

    /**
     * §2.1 (e): every entry, measured or medication volume, exactly in [balanceUnit], else `UnitMismatch` with every
     * unit found and no partial sums; then a negative entry is `InvalidEntry` (the first one, intake before output);
     * else exact sums with no rounding, and `net = intake − output`, which may be negative. Record inputs:
     * `intake[i] measured|medication`, `output[i] ...`, then `balance unit`.
     */
    fun fluidBalance(
        intake: List<FluidEntry>,
        output: List<FluidEntry>,
        balanceUnit: UcumUnit,
    ): FluidBalanceOutcome {
        val intakeVolumes = intake.map { it.volume() }
        val outputVolumes = output.map { it.volume() }
        val all = intakeVolumes + outputVolumes
        val inputs =
            intake.mapIndexed { index, entry -> ComparisonInput("intake[$index] ${entry.kind()}", entry.volume()) } +
                output.mapIndexed { index, entry -> ComparisonInput("output[$index] ${entry.kind()}", entry.volume()) }

        fun recordOf(outcome: String) =
            record(
                Si05Clause.E,
                inputs.map { it.asEntered() } + "balance unit ${balanceUnit.code}",
                inputs.map { it.displayed() } + "balance unit ${balanceUnit.code}",
                outcome,
            )

        val negativeIntake = intakeVolumes.indexOfFirst { it.magnitude().signum() < 0 }
        val negativeOutput = outputVolumes.indexOfFirst { it.magnitude().signum() < 0 }
        return when {
            all.any { it.unit != balanceUnit } -> {
                val units = all.map { it.unit }.toCollection(LinkedHashSet())
                FluidBalanceOutcome.UnitMismatch(units, recordOf("UnitMismatch ${units.map { it.code }}"))
            }
            negativeIntake >= 0 ->
                FluidBalanceOutcome.InvalidEntry(FluidSide.INTAKE, negativeIntake, recordOf("InvalidEntry INTAKE[$negativeIntake]"))
            negativeOutput >= 0 ->
                FluidBalanceOutcome.InvalidEntry(FluidSide.OUTPUT, negativeOutput, recordOf("InvalidEntry OUTPUT[$negativeOutput]"))
            else -> {
                val intakeTotal = Quantity.ofMagnitude(sum(intakeVolumes), balanceUnit)
                val outputTotal = Quantity.ofMagnitude(sum(outputVolumes), balanceUnit)
                val net = Quantity.ofMagnitude(intakeTotal.magnitude().subtract(outputTotal.magnitude()), balanceUnit)
                val outcome = "Balance intake ${intakeTotal.asEntered()} output ${outputTotal.asEntered()} net ${net.asEntered()}"
                FluidBalanceOutcome.Balance(intakeTotal, outputTotal, net, recordOf(outcome))
            }
        }
    }

    private fun record(
        clause: Si05Clause,
        asEntered: List<String>,
        displayed: List<String>,
        outcome: String,
    ) = ComparisonRecord(clause, API_VERSION, asEntered, displayed, null, null, null, null, outcome)
}

/** The outcome of [DoseComparisons.matchIndependentEntries]. */
sealed interface IndependentEntryMatch {
    val record: ComparisonRecord

    class Match(
        override val record: ComparisonRecord,
    ) : IndependentEntryMatch

    class Mismatch(
        val reason: MismatchReason,
        override val record: ComparisonRecord,
    ) : IndependentEntryMatch
}

enum class MismatchReason { UNIT_MISMATCH, VALUE_MISMATCH }

/** The outcome of [DoseComparisons.checkKbResult]. */
sealed interface KbThresholdOutcome {
    val record: ComparisonRecord

    /** The Tier A hard stop of CTRL-0005-10. */
    class AtOrAboveThreshold(
        override val record: ComparisonRecord,
    ) : KbThresholdOutcome

    class BelowThreshold(
        override val record: ComparisonRecord,
    ) : KbThresholdOutcome

    /** "dose check unavailable": the order goes to pharmacist review. */
    class DoseCheckUnavailable(
        val reason: UnavailableReason,
        override val record: ComparisonRecord,
    ) : KbThresholdOutcome
}

enum class UnavailableReason {
    KB_RETURNED_NONE,
    KB_MAXIMUM_NOT_IN_THE_ORDERED_UNIT,
    KB_BASIS_MISMATCH,
    KB_FLAG_THRESHOLD_UNKNOWN,
    KB_FLAG_NOT_COMPARABLE,
    KB_RESULT_INVALID,
}

/** The outcome of [DoseComparisons.checkRateAgainstOrderedRange]. */
sealed interface RateRangeOutcome {
    val record: ComparisonRecord

    class Within(
        override val record: ComparisonRecord,
    ) : RateRangeOutcome

    class BelowMinimum(
        override val record: ComparisonRecord,
    ) : RateRangeOutcome

    class AboveMaximum(
        override val record: ComparisonRecord,
    ) : RateRangeOutcome

    class UnitMismatch(
        override val record: ComparisonRecord,
    ) : RateRangeOutcome

    class InvalidOrderedRange(
        override val record: ComparisonRecord,
    ) : RateRangeOutcome
}

/** The outcome of [DoseComparisons.fluidBalance]. */
sealed interface FluidBalanceOutcome {
    val record: ComparisonRecord

    class Balance(
        val intake: Quantity,
        val output: Quantity,
        val net: Quantity,
        override val record: ComparisonRecord,
    ) : FluidBalanceOutcome

    class UnitMismatch(
        val unitsFound: Set<UcumUnit>,
        override val record: ComparisonRecord,
    ) : FluidBalanceOutcome

    class InvalidEntry(
        val side: FluidSide,
        val index: Int,
        override val record: ComparisonRecord,
    ) : FluidBalanceOutcome
}
