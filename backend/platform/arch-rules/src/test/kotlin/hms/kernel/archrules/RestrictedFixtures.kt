package hms.kernel.archrules

import com.tngtech.archunit.core.domain.JavaClasses
import com.tngtech.archunit.lang.ArchRule
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import kotlin.reflect.KClass

/**
 * The fixture tree of the restricted-function rules (platform-kernel.md §11). The whole tree is imported once,
 * so calls from synthetic classes (lambdas, references) are checked too, and every rule test sees the same classes.
 */
object RestrictedFixtures {
    /** The fixture root: kernel fixture types under `<root>.kernel`, callers in module packages. */
    const val ROOT: String = "hms.archfixtures.restricted"

    /** Every class of the fixture tree, Kotlin and Java. */
    val classes: JavaClasses by lazy { importFixturePackage(ROOT) }

    /** One dynamic test per violating fixture, each asserting that [rule] reports a violation by it. */
    fun violations(
        rule: ArchRule,
        violating: List<KClass<*>>,
    ): List<DynamicTest> {
        val details = violationDetails(rule, classes)
        return violating.map { fixture ->
            dynamicTest(fixture.java.simpleName) {
                assertTrue(classes.contain(fixture.java), "fixture ${fixture.qualifiedName} was not imported")
                assertViolationBy(details, fixture)
            }
        }
    }

    /** Asserts that [rule] reports no violation by any of [compliant] (all of them imported). */
    fun assertCompliant(
        rule: ArchRule,
        compliant: List<KClass<*>>,
    ) {
        val details = violationDetails(rule, classes)
        compliant.forEach { fixture ->
            assertTrue(classes.contain(fixture.java), "fixture ${fixture.qualifiedName} was not imported")
            assertNoViolationBy(details, fixture)
        }
    }
}
