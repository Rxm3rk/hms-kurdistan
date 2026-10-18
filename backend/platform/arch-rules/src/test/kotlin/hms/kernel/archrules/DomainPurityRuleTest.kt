package hms.kernel.archrules

import hms.archfixtures.purity.compliant.domain.PureAggregate
import hms.archfixtures.purity.compliant.infrastructure.SpringBackedAdapter
import hms.archfixtures.purity.violating.domain.UsesJackson2Annotations
import hms.archfixtures.purity.violating.domain.UsesJackson3
import hms.archfixtures.purity.violating.domain.UsesJakarta
import hms.archfixtures.purity.violating.domain.UsesJavax
import hms.archfixtures.purity.violating.domain.UsesJooq
import hms.archfixtures.purity.violating.domain.UsesKafka
import hms.archfixtures.purity.violating.domain.UsesSpring
import hms.archfixtures.purity.violating.domain.UsesTemporal
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** Rule (a): domain packages depend on no framework type (BUILD-PROMPT §6.1, §6.8 #3). */
class DomainPurityRuleTest {
    private val violatingRoot = "hms.archfixtures.purity.violating"
    private val compliantRoot = "hms.archfixtures.purity.compliant"

    @TestFactory
    fun `fails on a domain class that uses each forbidden framework package`(): List<DynamicTest> =
        listOf(
            UsesSpring::class,
            UsesJakarta::class,
            UsesJavax::class,
            UsesJooq::class,
            UsesJackson2Annotations::class,
            UsesJackson3::class,
            UsesTemporal::class,
            UsesKafka::class,
        ).map { fixture ->
            dynamicTest(fixture.java.simpleName) {
                assertRuleFails(HmsArchitectureRules.domainIsFrameworkFree(violatingRoot), importFixtures(fixture), fixture)
            }
        }

    @Test
    fun `forbids exactly the framework packages of the WP-0_1 rule, so none can be dropped silently`() {
        assertEquals(
            listOf(
                "org.springframework..",
                "jakarta..",
                "javax..",
                "org.jooq..",
                "com.fasterxml.jackson..",
                "tools.jackson..",
                "io.temporal..",
                "org.apache.kafka..",
            ),
            HmsArchitectureRules.FRAMEWORK_PACKAGES,
        )
    }

    @Test
    fun `passes on pure domain code and on framework code outside the domain`() {
        assertRulePasses(
            HmsArchitectureRules.domainIsFrameworkFree(compliantRoot),
            importFixturePackage(compliantRoot),
            PureAggregate::class,
            SpringBackedAdapter::class,
        )
    }
}
