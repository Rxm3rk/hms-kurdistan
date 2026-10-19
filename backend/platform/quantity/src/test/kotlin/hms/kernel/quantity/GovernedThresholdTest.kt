package hms.kernel.quantity

import hms.kernel.time.ContentProvenance
import hms.kernel.time.EnvironmentClass
import hms.kernel.time.ResolvedParameter
import hms.kernel.time.SafetyParameterFactory
import hms.kernel.time.SafetyParameterRefusal
import hms.kernel.time.SafetyParameterResult
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.InvocationTargetException
import java.math.BigDecimal

/** The governed SI-05 threshold: only from a resolved setting, synthetic gate, factor > 0 (platform-kernel.md §10.5, §6.5). */
@OptIn(SafetyParameterFactory::class)
class GovernedThresholdTest :
    FunSpec({
        // Synthetic factors only (§19.4); never a clinical value.
        val factor = "7"

        test("a threshold built from a resolved setting keeps the factor and its source") {
            val parameter = QuantityFixtures.parameter(factor)
            val threshold =
                GovernedThreshold
                    .fromResolved(parameter, EnvironmentClass.TEST)
                    .shouldBeInstanceOf<SafetyParameterResult.Built<GovernedThreshold>>()
                    .parameter
            threshold.factor shouldBe BigDecimal(factor)
            threshold.source shouldBe parameter
            threshold shouldBe QuantityFixtures.threshold(factor)
        }

        test("synthetic-safety-parameters-refused-in-train-and-prod: GovernedThreshold refuses synthetic values in TRAIN and PROD") {
            listOf(EnvironmentClass.TRAIN, EnvironmentClass.PROD).forEach { environment ->
                withClue(environment) {
                    GovernedThreshold.fromResolved(QuantityFixtures.parameter(factor), environment) shouldBe
                        SafetyParameterResult.Refused(SafetyParameterRefusal.SYNTHETIC_IN_TRAIN_OR_PROD, QuantityFixtures.THRESHOLD_KEY)
                    GovernedThreshold
                        .fromResolved(QuantityFixtures.parameter(factor, ContentProvenance.APPROVED), environment)
                        .shouldBeInstanceOf<SafetyParameterResult.Built<GovernedThreshold>>()
                }
            }
        }

        test("synthetic-safety-parameters-refused-in-train-and-prod: synthetic values are accepted in BUILD, TEST and PLAY") {
            listOf(EnvironmentClass.BUILD, EnvironmentClass.TEST, EnvironmentClass.PLAY).forEach { environment ->
                withClue(environment) {
                    GovernedThreshold
                        .fromResolved(QuantityFixtures.parameter(factor), environment)
                        .shouldBeInstanceOf<SafetyParameterResult.Built<GovernedThreshold>>()
                }
            }
        }

        test("safety-parameters-validated: a factor of zero or less is refused; any factor above zero is built") {
            listOf("0", "0.000", "-1", "-0.5").forEach { value ->
                withClue(value) {
                    GovernedThreshold.fromResolved(QuantityFixtures.parameter(value), EnvironmentClass.TEST) shouldBe
                        SafetyParameterResult.Refused(SafetyParameterRefusal.VALUE_OUT_OF_RANGE, QuantityFixtures.THRESHOLD_KEY)
                }
            }
            listOf("0.001", "1", "2.5", "1000").forEach { value ->
                withClue(value) {
                    GovernedThreshold
                        .fromResolved(QuantityFixtures.parameter(value), EnvironmentClass.TEST)
                        .shouldBeInstanceOf<SafetyParameterResult.Built<GovernedThreshold>>()
                }
            }
            // The synthetic gate is reported before the range check.
            GovernedThreshold.fromResolved(QuantityFixtures.parameter("-1"), EnvironmentClass.PROD) shouldBe
                SafetyParameterResult.Refused(SafetyParameterRefusal.SYNTHETIC_IN_TRAIN_OR_PROD, QuantityFixtures.THRESHOLD_KEY)
        }

        test("safety-parameters-validated: reflective construction with invalid values throws") {
            val constructor =
                GovernedThreshold::class.java.declaredConstructors
                    .single { it.parameterCount == 2 }
                    .apply { isAccessible = true }
            val valid = QuantityFixtures.parameter(factor)
            constructor.newInstance(BigDecimal(factor), valid).shouldBeInstanceOf<GovernedThreshold>()
            listOf(
                BigDecimal.ZERO to QuantityFixtures.parameter("0"),
                BigDecimal("-1") to QuantityFixtures.parameter("-1"),
                BigDecimal("8") to valid,
            ).forEach { (value, source) ->
                withClue(value) {
                    shouldThrow<InvocationTargetException> { constructor.newInstance(value, source) }
                        .cause
                        .shouldBeInstanceOf<IllegalArgumentException>()
                }
            }
        }

        test("the source carries the key, provenance and entry for the comparison record") {
            val source = ResolvedParameter(QuantityFixtures.THRESHOLD_KEY, BigDecimal("3"), ContentProvenance.APPROVED, "entry-42", null)
            val threshold =
                GovernedThreshold
                    .fromResolved(source, EnvironmentClass.PROD)
                    .shouldBeInstanceOf<SafetyParameterResult.Built<GovernedThreshold>>()
                    .parameter
            threshold.source.key shouldBe QuantityFixtures.THRESHOLD_KEY
            threshold.source.sourceRef shouldBe "entry-42"
            threshold.source.provenance shouldBe ContentProvenance.APPROVED
        }
    })
