package hms.kernel.archrules

import hms.archfixtures.restricted.kernel.journal.infrastructure.JournalRowMapper
import hms.archfixtures.restricted.kernel.journal.inmemory.InMemoryJournalRestore
import hms.archfixtures.restricted.kernel.time.RecordedTime
import hms.archfixtures.restricted.orders.application.CallsUnrelatedRestore
import hms.archfixtures.restricted.orders.application.RestoresByReference
import hms.archfixtures.restricted.orders.application.RestoresRecordedTime
import hms.archfixtures.restricted.orders.infrastructure.InfrastructureRestoresRecordedTime
import hms.archfixtures.restricted.orders.infrastructure.inbound.InboundAdapterRestoresRecordedTime
import hms.archfixtures.restricted.orders.infrastructure.persistence.RecordedTimeColumn
import hms.archfixtures.restrictedbyname.orders.application.RestoresUnannotated
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** `ArchTest:persistence-only-factories`: `@PersistenceOnly` functions only in persistence mapping (platform-kernel.md §11; SI-10). */
class PersistenceOnlyFactoriesRuleTest {
    private val rule = KernelArchitectureRules.persistenceOnlyFactories(RestrictedFixtures.ROOT)

    @TestFactory
    fun `persistence-only-factories fails on callers outside persistence mapping, including an inbound adapter`(): List<DynamicTest> =
        RestrictedFixtures.violations(
            rule,
            listOf(
                RestoresRecordedTime::class,
                RestoresByReference::class,
                InboundAdapterRestoresRecordedTime::class,
                InfrastructureRestoresRecordedTime::class,
            ),
        )

    @Test
    fun `persistence-only-factories passes on persistence mapping, the journal adapters and the declaring class`() {
        RestrictedFixtures.assertCompliant(
            rule,
            listOf(
                RecordedTimeColumn::class,
                JournalRowMapper::class,
                InMemoryJournalRestore::class,
                RecordedTime::class,
                CallsUnrelatedRestore::class,
            ),
        )
    }

    @Test
    fun `persistence-only-factories matches by owner and name when the marker is missing`() {
        val root = "hms.archfixtures.restrictedbyname"
        assertRuleFails(KernelArchitectureRules.persistenceOnlyFactories(root), importFixturePackage(root), RestoresUnannotated::class)
    }
}
