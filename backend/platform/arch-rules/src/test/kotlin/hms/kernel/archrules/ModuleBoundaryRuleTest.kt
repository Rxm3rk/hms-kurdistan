package hms.kernel.archrules

import hms.archfixtures.modules.alpha.AlphaModule
import hms.archfixtures.modules.alpha.api.AlphaSummary
import hms.archfixtures.modules.alpha.domain.AlphaAggregate
import hms.archfixtures.modules.alpha.infrastructure.AlphaStore
import hms.archfixtures.modules.beta.application.BetaUsesAlphaApi
import hms.archfixtures.modules.beta.application.BetaUsesAlphaDomain
import hms.archfixtures.modules.beta.domain.BetaUsesAlphaModuleRoot
import hms.archfixtures.modules.beta.web.BetaUsesAlphaInfrastructure
import hms.archfixtures.modules.kernel.ids.FixtureId
import hms.archfixtures.modules.trust.identity.api.SessionView
import hms.archfixtures.modules.trust.identity.domain.Session
import hms.archfixtures.modules.trust.policy.application.PolicyUsesIdentityApi
import hms.archfixtures.modules.trust.policy.domain.PolicyUsesIdentityDomain
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** Rule (b): a module uses another module only through its api package (BUILD-PROMPT §5.2, §6.1). */
class ModuleBoundaryRuleTest {
    private val rule = HmsArchitectureRules.modulesUseOtherModulesOnlyThroughApi("hms.archfixtures.modules")

    @TestFactory
    fun `fails when a module reaches past another module's api`(): List<DynamicTest> =
        listOf(
            BetaUsesAlphaDomain::class,
            BetaUsesAlphaInfrastructure::class,
            BetaUsesAlphaModuleRoot::class,
            PolicyUsesIdentityDomain::class,
        ).map { fixture ->
            dynamicTest(fixture.java.simpleName) { assertRuleFails(rule, importFixtures(fixture), fixture) }
        }

    @Test
    fun `passes for api use across modules, use of the shared kernel and any use inside one module`() {
        val compliant =
            arrayOf(
                AlphaSummary::class,
                AlphaAggregate::class,
                AlphaStore::class,
                AlphaModule::class,
                FixtureId::class,
                BetaUsesAlphaApi::class,
                SessionView::class,
                Session::class,
                PolicyUsesIdentityApi::class,
            )
        assertRulePasses(rule, importFixtures(*compliant), *compliant)
    }
}
