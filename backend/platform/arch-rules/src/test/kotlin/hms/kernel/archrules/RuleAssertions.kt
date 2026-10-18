package hms.kernel.archrules

import com.tngtech.archunit.core.domain.JavaClasses
import com.tngtech.archunit.core.importer.ClassFileImporter
import com.tngtech.archunit.lang.ArchRule
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import kotlin.reflect.KClass

/** Imports exactly the given fixture classes. */
fun importFixtures(vararg fixtures: KClass<*>): JavaClasses = ClassFileImporter().importClasses(fixtures.map { it.java })

/** Imports every class in a fixture package and its sub-packages. */
fun importFixturePackage(packageName: String): JavaClasses = ClassFileImporter().importPackages(packageName)

/** Asserts that [rule] reports a violation naming [fixture] when it runs on [classes]. */
fun assertRuleFails(
    rule: ArchRule,
    classes: JavaClasses,
    fixture: KClass<*>,
) {
    assertTrue(classes.contain(fixture.java), "fixture ${fixture.qualifiedName} was not imported")
    val result = rule.evaluate(classes)
    assertTrue(result.hasViolation(), "expected a violation for ${fixture.qualifiedName}")
    val details = result.failureReport.details
    assertTrue(
        details.any { it.contains(fixture.java.name) },
        "the violation report does not name ${fixture.qualifiedName}: $details",
    )
}

/** Asserts that [rule] passes on [classes], and that the fixtures it should have checked were imported. */
fun assertRulePasses(
    rule: ArchRule,
    classes: JavaClasses,
    vararg expected: KClass<*>,
) {
    expected.forEach { assertTrue(classes.contain(it.java), "fixture ${it.qualifiedName} was not imported") }
    val result = rule.evaluate(classes)
    assertFalse(result.hasViolation(), result.failureReport.toString())
}
