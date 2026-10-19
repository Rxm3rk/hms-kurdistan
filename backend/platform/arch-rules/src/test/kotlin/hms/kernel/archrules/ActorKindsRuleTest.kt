package hms.kernel.archrules

import hms.archfixtures.restricted.kernel.context.ActorRef
import hms.archfixtures.restricted.kernel.context.CaptureChannel
import hms.archfixtures.restricted.kernel.events.DeadLetterWriter
import hms.archfixtures.restricted.kernel.journal.JournalGapFill
import hms.archfixtures.restricted.orders.application.BuildsDeviceActor
import hms.archfixtures.restricted.orders.application.BuildsInterfaceActor
import hms.archfixtures.restricted.orders.application.BuildsMigrationActor
import hms.archfixtures.restricted.orders.application.BuildsOfflineCapture
import hms.archfixtures.restricted.orders.application.BuildsSystemActor
import hms.archfixtures.restricted.orders.application.BuildsUnlistedActor
import hms.archfixtures.restricted.orders.application.BuildsUserActor
import hms.archfixtures.restricted.platform.config.application.system.Reconciler
import hms.archfixtures.restricted.platform.tasks.application.system.OrphanScan
import hms.archfixtures.restricted.platform.workflow.application.RelayActsAsSystem
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** `ArchTest:actor-kinds-only-from-allowed-packages` (platform-kernel.md §7.2, §11; D10; CTRL-0010-4). */
class ActorKindsRuleTest {
    private val rule = KernelArchitectureRules.actorKindsOnlyFromAllowedPackages(RestrictedFixtures.ROOT)

    @TestFactory
    fun `actor-kinds-only-from-allowed-packages fails on non-user actors and offline capture outside the allow-lists`(): List<DynamicTest> =
        RestrictedFixtures.violations(
            rule,
            listOf(
                BuildsDeviceActor::class,
                BuildsInterfaceActor::class,
                BuildsMigrationActor::class,
                BuildsSystemActor::class,
                BuildsOfflineCapture::class,
                BuildsUnlistedActor::class,
                RelayActsAsSystem::class,
            ),
        )

    @Test
    fun `actor-kinds-only-from-allowed-packages passes on the SYSTEM_PROCESSES packages, user actors and the declaring classes`() {
        RestrictedFixtures.assertCompliant(
            rule,
            listOf(
                OrphanScan::class,
                JournalGapFill::class,
                DeadLetterWriter::class,
                Reconciler::class,
                BuildsUserActor::class,
                ActorRef::class,
                CaptureChannel.OfflineQueued::class,
            ),
        )
    }
}
