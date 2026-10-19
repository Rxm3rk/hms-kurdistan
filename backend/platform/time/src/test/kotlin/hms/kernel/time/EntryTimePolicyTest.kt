package hms.kernel.time

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.Constructor
import java.lang.reflect.InvocationTargetException
import java.time.Duration

/** The governed SI-10 tolerances: built only from resolved settings, synthetic gate (platform-kernel.md §6.3, §6.5; D11). */
class EntryTimePolicyTest :
    FunSpec({
        val values = listOf(Duration.ofMinutes(5), Duration.ofMinutes(2), Duration.ofMinutes(15), Duration.ofHours(24))
        val keys = EntryTimePolicy.keys(TimeFixtures.VITAL_SIGN)

        test("the four keys of a timing class are platform.time.entry.<timing-class>.<tolerance>") {
            keys shouldBe
                listOf(
                    "platform.time.entry.vital-sign.contemporaneous-tolerance",
                    "platform.time.entry.vital-sign.future-tolerance",
                    "platform.time.entry.vital-sign.interface-lateness-tolerance",
                    "platform.time.entry.vital-sign.offline-capture-tolerance",
                )
        }

        test("a policy built from resolved values keeps the values and their sources") {
            val parameters = TimeFixtures.parameters(values)
            val policy = TimeFixtures.build(parameters).shouldBeInstanceOf<SafetyParameterResult.Built<EntryTimePolicy>>().parameter
            policy.timingClass shouldBe TimeFixtures.VITAL_SIGN
            listOf(policy.contemporaneousTolerance, policy.futureTolerance, policy.interfaceLatenessTolerance, policy.offlineCaptureTolerance) shouldBe
                values
            policy.sources shouldBe parameters
        }

        test("synthetic-safety-parameters-refused-in-train-and-prod: EntryTimePolicy.fromResolved refuses synthetic values in TRAIN and PROD") {
            listOf(EnvironmentClass.TRAIN, EnvironmentClass.PROD).forEach { environment ->
                withClue(environment) {
                    TimeFixtures.build(TimeFixtures.parameters(values), environment = environment) shouldBe
                        SafetyParameterResult.Refused(SafetyParameterRefusal.SYNTHETIC_IN_TRAIN_OR_PROD, keys[0])
                    // One synthetic value among approved ones is enough.
                    val mixed = TimeFixtures.parameters(values, provenance = ContentProvenance.APPROVED).toMutableList()
                    mixed[2] = TimeFixtures.parameter(keys[2], values[2], ContentProvenance.SYNTHETIC)
                    TimeFixtures.build(mixed, environment = environment) shouldBe
                        SafetyParameterResult.Refused(SafetyParameterRefusal.SYNTHETIC_IN_TRAIN_OR_PROD, keys[2])
                    (
                        TimeFixtures.build(
                            TimeFixtures.parameters(values, provenance = ContentProvenance.APPROVED),
                            environment = environment,
                        ) is SafetyParameterResult.Built
                    ) shouldBe true
                }
            }
        }

        test("synthetic-safety-parameters-refused-in-train-and-prod: synthetic values are accepted in BUILD, TEST and PLAY") {
            listOf(EnvironmentClass.BUILD, EnvironmentClass.TEST, EnvironmentClass.PLAY).forEach { environment ->
                withClue(environment) {
                    (TimeFixtures.build(TimeFixtures.parameters(values), environment = environment) is SafetyParameterResult.Built) shouldBe
                        true
                }
            }
        }

        test("safety-parameters-validated: negative durations are refused; zero is allowed") {
            keys.indices.forEach { index ->
                val negative = values.toMutableList().also { it[index] = Duration.ofNanos(-1000) }
                TimeFixtures.build(TimeFixtures.parameters(negative)) shouldBe
                    SafetyParameterResult.Refused(SafetyParameterRefusal.VALUE_OUT_OF_RANGE, keys[index])
            }
            (TimeFixtures.build(TimeFixtures.parameters(List(4) { Duration.ZERO })) is SafetyParameterResult.Built) shouldBe true
        }

        test("safety-parameters-validated: wrong keys are refused, also another timing class's keys and swapped keys") {
            val other = TimeFixtures.parameters(values, TimingClass("adt-event"))
            TimeFixtures.build(other) shouldBe SafetyParameterResult.Refused(SafetyParameterRefusal.KEY_MISMATCH, other[0].key)
            val swapped = TimeFixtures.parameters(values).let { listOf(it[1], it[0], it[2], it[3]) }
            TimeFixtures.build(swapped) shouldBe SafetyParameterResult.Refused(SafetyParameterRefusal.KEY_MISMATCH, keys[1])
            // A key mismatch is reported before the synthetic gate and the range check.
            val wrongAndNegative = TimeFixtures.parameters(values.map { it.negated() }, TimingClass("note"))
            TimeFixtures.build(wrongAndNegative, environment = EnvironmentClass.PROD).shouldBeInstanceOf<SafetyParameterResult.Refused>().reason shouldBe
                SafetyParameterRefusal.KEY_MISMATCH
        }

        test("safety-parameters-validated: reflective construction with invalid values throws") {
            @Suppress("UNCHECKED_CAST")
            val constructor =
                EntryTimePolicy::class.java.declaredConstructors
                    .single { it.parameterCount == 6 }
                    .apply { isAccessible = true } as Constructor<EntryTimePolicy>
            val valid = TimeFixtures.parameters(values)

            fun construct(
                tolerances: List<Duration>,
                sources: List<ResolvedParameter<Duration>>,
                timingClass: String = TimeFixtures.VITAL_SIGN.name,
            ) = constructor.newInstance(timingClass, tolerances[0], tolerances[1], tolerances[2], tolerances[3], sources)

            construct(values, valid).sources shouldBe valid
            val negative = values.map { it.negated() }
            listOf(
                { construct(negative, TimeFixtures.parameters(negative)) },
                { construct(values, TimeFixtures.parameters(values, TimingClass("note"))) },
                { construct(values, valid.take(3)) },
                { construct(values.reversed(), valid) },
            ).forEach { attempt -> shouldThrow<InvocationTargetException> { attempt() }.cause.shouldBeInstanceOf<IllegalArgumentException>() }
        }

        test("ResolvedParameter refuses a blank key or source") {
            shouldThrow<IllegalArgumentException> { ResolvedParameter(" ", Duration.ZERO, ContentProvenance.SYNTHETIC, "entry", null) }
            shouldThrow<IllegalArgumentException> { ResolvedParameter("k", Duration.ZERO, ContentProvenance.SYNTHETIC, "", null) }
        }
    })
