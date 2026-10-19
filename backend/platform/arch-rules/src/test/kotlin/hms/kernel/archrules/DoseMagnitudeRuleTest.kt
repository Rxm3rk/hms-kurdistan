package hms.kernel.archrules

import hms.archfixtures.restricted.kernel.quantity.DoseComparisons
import hms.archfixtures.restricted.kernel.quantity.DoseQuantity
import hms.archfixtures.restricted.kernel.quantity.Quantity
import hms.archfixtures.restricted.orders.application.BuildsQuantityFromMagnitude
import hms.archfixtures.restricted.orders.application.JavaBuildsQuantity
import hms.archfixtures.restricted.orders.application.JavaReadsQuantityMagnitude
import hms.archfixtures.restricted.orders.application.ReadsDoseMagnitude
import hms.archfixtures.restricted.orders.application.ReadsQuantityMagnitude
import hms.archfixtures.restricted.orders.application.ReadsRateMagnitude
import hms.archfixtures.restricted.orders.infrastructure.InfrastructureReadsMagnitude
import hms.archfixtures.restricted.orders.infrastructure.persistence.JavaQuantityColumns
import hms.archfixtures.restricted.orders.infrastructure.persistence.QuantityColumns
import hms.archfixtures.restricted.reg.dose.domain.DoseCalculator
import hms.archfixtures.restrictedbyname.orders.application.ReadsUnannotatedMagnitude
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** `ArchTest:dose-and-quantity-operations-only-in-reg-dose`, the ArchUnit half of §6.8 #1 (platform-kernel.md §10.1, §11). */
class DoseMagnitudeRuleTest {
    private val rule = KernelArchitectureRules.doseAndQuantityOperationsOnlyInRegDose(RestrictedFixtures.ROOT)

    @TestFactory
    fun `dose-and-quantity-operations-only-in-reg-dose fails on magnitude accessors outside the allowed packages`(): List<DynamicTest> =
        RestrictedFixtures.violations(
            rule,
            listOf(
                ReadsQuantityMagnitude::class,
                ReadsDoseMagnitude::class,
                ReadsRateMagnitude::class,
                BuildsQuantityFromMagnitude::class,
                JavaBuildsQuantity::class,
                JavaReadsQuantityMagnitude::class,
                InfrastructureReadsMagnitude::class,
            ),
        )

    @Test
    fun `dose-and-quantity-operations-only-in-reg-dose passes in reg-dose, the quantity library and persistence mapping`() {
        RestrictedFixtures.assertCompliant(
            rule,
            listOf(
                DoseCalculator::class,
                QuantityColumns::class,
                JavaQuantityColumns::class,
                DoseComparisons::class,
                DoseQuantity::class,
                Quantity::class,
            ),
        )
    }

    @Test
    fun `dose-and-quantity-operations-only-in-reg-dose matches by owner and name when the marker is missing`() {
        val root = "hms.archfixtures.restrictedbyname"
        val rule = KernelArchitectureRules.doseAndQuantityOperationsOnlyInRegDose(root)
        assertRuleFails(rule, importFixturePackage(root), ReadsUnannotatedMagnitude::class)
    }
}
