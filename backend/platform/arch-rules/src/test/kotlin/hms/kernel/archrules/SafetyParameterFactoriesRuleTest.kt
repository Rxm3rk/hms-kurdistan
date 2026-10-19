package hms.kernel.archrules

import hms.archfixtures.restricted.kernel.quantity.GovernedThreshold
import hms.archfixtures.restricted.kernel.time.EntryTimePolicy
import hms.archfixtures.restricted.orders.application.BuildsEntryTimePolicy
import hms.archfixtures.restricted.orders.application.BuildsGovernedThreshold
import hms.archfixtures.restricted.orders.application.JavaBuildsEntryTimePolicy
import hms.archfixtures.restricted.orders.application.JavaBuildsGovernedThreshold
import hms.archfixtures.restricted.orders.application.JavaReferencesEntryTimePolicy
import hms.archfixtures.restricted.platform.tasks.infrastructure.config.JavaTaskPolicyResolver
import hms.archfixtures.restricted.platform.tenancy.application.TenancyOutsideSettings
import hms.archfixtures.restricted.platform.tenancy.application.settings.EntryTimePolicyResolver
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** `ArchTest:safety-parameter-factories-only-in-resolvers` (platform-kernel.md §6.5, §11; D11). */
class SafetyParameterFactoriesRuleTest {
    private val rule = KernelArchitectureRules.safetyParameterFactoriesOnlyInResolvers(RestrictedFixtures.ROOT)

    @TestFactory
    fun `safety-parameter-factories-only-in-resolvers fails on callers outside the resolvers, from Kotlin and Java`(): List<DynamicTest> =
        RestrictedFixtures.violations(
            rule,
            listOf(
                BuildsEntryTimePolicy::class,
                BuildsGovernedThreshold::class,
                JavaBuildsEntryTimePolicy::class,
                JavaBuildsGovernedThreshold::class,
                JavaReferencesEntryTimePolicy::class,
                TenancyOutsideSettings::class,
            ),
        )

    @Test
    fun `safety-parameter-factories-only-in-resolvers passes on the tenancy and tasks resolvers and the declaring classes`() {
        RestrictedFixtures.assertCompliant(
            rule,
            listOf(
                EntryTimePolicyResolver::class,
                JavaTaskPolicyResolver::class,
                EntryTimePolicy::class,
                GovernedThreshold::class,
            ),
        )
    }
}
