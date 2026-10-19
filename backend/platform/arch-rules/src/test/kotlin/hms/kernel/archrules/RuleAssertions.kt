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

/** The violation details of [rule] on [classes]; empty when it passes. */
fun violationDetails(
    rule: ArchRule,
    classes: JavaClasses,
): List<String> = rule.evaluate(classes).failureReport.details

/** True when a violation [detail] starts at [fixture]: its first `<...>` is the class or one of its members or nested classes. */
private fun startsAt(
    detail: String,
    fixture: KClass<*>,
): Boolean {
    val name = fixture.java.name
    val origin = detail.substringAfter('<').substringBefore('>')
    return origin == name || origin.startsWith("$name.") || origin.startsWith("$name$")
}

/** Asserts that one of [details] is a violation by [fixture]. */
fun assertViolationBy(
    details: List<String>,
    fixture: KClass<*>,
) {
    assertTrue(details.any { startsAt(it, fixture) }, "expected a violation by ${fixture.qualifiedName}: $details")
}

/** Asserts that none of [details] is a violation by [fixture]. */
fun assertNoViolationBy(
    details: List<String>,
    fixture: KClass<*>,
) {
    val own = details.filter { startsAt(it, fixture) }
    assertTrue(own.isEmpty(), "expected no violation by ${fixture.qualifiedName}: $own")
}
