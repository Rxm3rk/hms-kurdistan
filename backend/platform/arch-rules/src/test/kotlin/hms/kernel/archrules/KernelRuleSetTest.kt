package hms.kernel.archrules

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * The kernel rule set and its allow-lists (platform-kernel.md §6.5, §7.2, §11). The lists are pinned: a change to
 * one is a spec revision with safety code-owner review, and this test makes the change visible.
 */
class KernelRuleSetTest {
    @Test
    fun `the allow-lists are exactly those of platform-kernel md sections 6_1, 6_5, 7_2 and 10_1`() {
        assertEquals(
            listOf("..infrastructure.persistence..", "kernel.journal.infrastructure", "kernel.journal.inmemory"),
            KernelAllowLists.PERSISTENCE_MAPPING,
        )
        assertEquals(
            listOf("platform.tenancy.application.settings", "platform.tasks.infrastructure.config"),
            KernelAllowLists.SAFETY_PARAMETER_RESOLVERS,
        )
        assertEquals(
            listOf("platform.tasks.application.system", "kernel.journal", "kernel.events", "platform.config.application.system"),
            KernelAllowLists.SYSTEM_PROCESSES,
        )
        assertEquals(listOf("reg.dose", "kernel.quantity", "..infrastructure.persistence.."), KernelAllowLists.DOSE_MAGNITUDE)
    }

    @Test
    fun `no WP-0_3 production package may select a privileged entry mode`() {
        listOf(
            KernelAllowLists.DEVICE_INBOUND,
            KernelAllowLists.INTERFACE_INBOUND,
            KernelAllowLists.MIGRATION_LOADER,
            KernelAllowLists.OFFLINE_SYNC_ENDPOINT,
            KernelAllowLists.BACK_ENTRY_TOOLING,
            KernelAllowLists.EPISODE_REGISTRY,
            KernelAllowLists.APP_HMS_DEV_WIRING,
        ).forEach { assertTrue(it.isEmpty(), "expected an empty allow-list, got $it") }
    }

    @Test
    fun `allow-list entries resolve below the root, and dot-dot patterns stay as written`() {
        assertEquals(
            listOf("..infrastructure.persistence..", "hms.kernel.journal.infrastructure..", "hms.kernel.journal.inmemory.."),
            KernelPackages.resolve("hms", KernelAllowLists.PERSISTENCE_MAPPING),
        )
    }

    @Test
    fun `every backend project applies rules (a) to (e) and the nine kernel rules through HmsArchitectureRules all`() {
        val descriptions = HmsArchitectureRules.all().map { it.description }
        val expected =
            listOf(
                HmsArchitectureRules.domainIsFrameworkFree(),
                HmsArchitectureRules.modulesUseOtherModulesOnlyThroughApi(),
                HmsArchitectureRules.temporalOnlyInWorkflowAdapter(),
                HmsArchitectureRules.domainDoesNotReadTheSystemClock(),
                HmsArchitectureRules.safetyKernelNeverUsesWorkflow(),
            ) + KernelArchitectureRules.all()
        assertEquals(expected.map { it.description }, descriptions)
        assertEquals(KERNEL_RULES, KernelArchitectureRules.all().size)
        assertEquals(descriptions.size, descriptions.toSet().size, "rule descriptions name the Kotest tests, so they must be unique")
    }

    private companion object {
        const val KERNEL_RULES = 9
    }
}
