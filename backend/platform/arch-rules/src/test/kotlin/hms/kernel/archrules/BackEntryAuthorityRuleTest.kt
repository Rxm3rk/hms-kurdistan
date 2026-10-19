package hms.kernel.archrules

import hms.archfixtures.restricted.kernel.context.BackEntryAuthority
import hms.archfixtures.restricted.kernel.time.BackEntryEpisode
import hms.archfixtures.restricted.orders.application.IssuesBackEntryAuthority
import hms.archfixtures.restricted.orders.application.JavaLoadsBackEntryEpisode
import hms.archfixtures.restricted.orders.application.LoadsBackEntryEpisode
import hms.archfixtures.restricted.orders.application.UsesBackEntryAuthority
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** `ArchTest:back-entry-authority-only-from-back-entry-tooling` (platform-kernel.md §7.2, §11; D10; CTRL-0010-5). */
class BackEntryAuthorityRuleTest {
    private val rule = KernelArchitectureRules.backEntryAuthorityOnlyFromBackEntryTooling(RestrictedFixtures.ROOT)

    @TestFactory
    fun `back-entry-authority-only-from-back-entry-tooling fails on any production call, the allow-lists being empty`(): List<DynamicTest> =
        RestrictedFixtures.violations(
            rule,
            listOf(IssuesBackEntryAuthority::class, LoadsBackEntryEpisode::class, JavaLoadsBackEntryEpisode::class),
        )

    @Test
    fun `back-entry-authority-only-from-back-entry-tooling passes on code that only holds an authority, and on the declaring classes`() {
        RestrictedFixtures.assertCompliant(
            rule,
            listOf(UsesBackEntryAuthority::class, BackEntryAuthority::class, BackEntryEpisode::class),
        )
    }
}
