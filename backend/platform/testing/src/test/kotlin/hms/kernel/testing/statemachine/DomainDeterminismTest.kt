package hms.kernel.testing.statemachine

import com.tngtech.archunit.core.importer.ClassFileImporter
import hms.kernel.testing.DomainDeterminism
import hms.kernel.testing.statemachine.archfixtures.domain.MathRandomFixture
import hms.kernel.testing.statemachine.archfixtures.domain.PureFixture
import hms.kernel.testing.statemachine.archfixtures.domain.RandomDefaultFixture
import hms.kernel.testing.statemachine.archfixtures.domain.RandomUuidFixture
import hms.kernel.testing.statemachine.archfixtures.domain.SeededRandomFixture
import hms.kernel.testing.statemachine.archfixtures.domain.ShuffleFixture
import hms.kernel.testing.statemachine.archfixtures.domain.SystemClockFixture
import hms.kernel.testing.statemachine.archfixtures.domain.ThreadLocalRandomFixture
import hms.kernel.testing.statemachine.archfixtures.domain.UnseededJavaRandomFixture
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import java.io.File

private const val ROOT = "hms.kernel.testing.statemachine.archfixtures"

private fun classesOf(vararg types: Class<*>) = ClassFileImporter().importClasses(*types)

/**
 * The determinism rules of the ArchitectureTest template fail on a defective class and pass on a sound one
 * (docs/specs/modules/state-machines-and-invariants.md §3.1, §3.3). In src/test.
 */
class DomainDeterminismTest :
    FunSpec({
        val unseeded =
            listOf(
                RandomDefaultFixture::class.java,
                UnseededJavaRandomFixture::class.java,
                MathRandomFixture::class.java,
                ThreadLocalRandomFixture::class.java,
                RandomUuidFixture::class.java,
                ShuffleFixture::class.java,
            )

        unseeded.forEach { type ->
            test("test fixtures: ${type.simpleName} fails the unseeded-randomness rule") {
                shouldThrow<AssertionError> { DomainDeterminism.noUnseededRandomness(ROOT).check(classesOf(type)) }
                    .message
                    .shouldNotBeNull()
                    .shouldContain(type.simpleName)
            }

            test("main domain: ${type.simpleName} fails the no-randomness rule") {
                shouldThrow<AssertionError> { DomainDeterminism.noRandomness(ROOT).check(classesOf(type)) }
            }
        }

        test("test fixtures may draw from seeded generators; main domain code may not") {
            val seeded = classesOf(SeededRandomFixture::class.java)
            DomainDeterminism.noUnseededRandomness(ROOT).check(seeded)
            shouldThrow<AssertionError> { DomainDeterminism.noRandomness(ROOT).check(seeded) }
                .message
                .shouldNotBeNull()
                .shouldContain("SeededRandomFixture")
        }

        test("a pure domain class passes every determinism rule") {
            val pure = classesOf(PureFixture::class.java)
            DomainDeterminism.noRandomness(ROOT).check(pure)
            DomainDeterminism.testFixturesRules(ROOT).forEach { it.check(pure) }
        }

        test("test fixtures: a class that reads the system clock fails the test-fixture rules") {
            val clock = classesOf(SystemClockFixture::class.java)
            val failures = DomainDeterminism.testFixturesRules(ROOT).mapNotNull { rule -> runCatching { rule.check(clock) }.exceptionOrNull() }
            failures.size shouldBe 1
        }

        test("the testFixtures classes come from the directories Gradle passes; without the property the template fails closed") {
            val testClassesRoot = File(PureFixture::class.java.protectionDomain.codeSource.location.toURI()).path
            val imported = DomainDeterminism.importTestFixturesClasses(testClassesRoot)
            imported.contain(MathRandomFixture::class.java).shouldBeTrue()
            shouldThrow<AssertionError> { DomainDeterminism.noUnseededRandomness(ROOT).check(imported) }
            DomainDeterminism.importTestFixturesClasses("").isEmpty.shouldBeTrue()
            shouldThrow<IllegalStateException> { DomainDeterminism.importTestFixturesClasses(null) }
        }

        test("Gradle passes the testFixtures class directories to every test JVM (empty here: no java-test-fixtures)") {
            System.getProperty(DomainDeterminism.TEST_FIXTURES_CLASSES_DIRS_PROPERTY).shouldNotBeNull()
        }
    })
