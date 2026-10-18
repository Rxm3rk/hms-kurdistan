package hms.kernel.archrules

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

/** How package names map to modules and layers (BUILD-PROMPT §5.2, §6.1). */
class ModuleLayoutTest {
    private val layout = ModuleLayout()

    @Test
    fun `module ids with hyphens become dotted package paths`() {
        assertEquals("trust.identity", layout.moduleOf("hms.trust.identity.domain"))
        assertEquals("platform.journal", layout.moduleOf("hms.platform.journal.application"))
        assertEquals("reg.dose", layout.moduleOf("hms.reg.dose.api"))
        assertEquals("empi", layout.moduleOf("hms.empi.infrastructure.jooq"))
    }

    @Test
    fun `the first layer segment ends the module name`() {
        assertEquals("orders", layout.moduleOf("hms.orders.domain.events"))
        assertEquals("domain", layout.layerOf("hms.orders.domain.events"))
        assertEquals("api", layout.layerOf("hms.orders.api.commands"))
    }

    @Test
    fun `a package without a layer segment is a module root outside the api`() {
        assertEquals("empi", layout.moduleOf("hms.empi"))
        assertNull(layout.layerOf("hms.empi"))
    }

    @Test
    fun `the shared kernel, the root package and foreign packages belong to no module`() {
        assertNull(layout.moduleOf("hms.kernel.time"))
        assertNull(layout.moduleOf("hms.kernel"))
        assertNull(layout.moduleOf("hms"))
        assertNull(layout.moduleOf("hmsx.orders.domain"))
        assertNull(layout.moduleOf("org.springframework.core"))
        assertNull(layout.moduleOf("hms.api"))
    }

    @Test
    fun `a custom root is honoured`() {
        val fixtures = ModuleLayout("hms.archfixtures.modules")
        assertEquals("alpha", fixtures.moduleOf("hms.archfixtures.modules.alpha.domain"))
        assertNull(fixtures.moduleOf("hms.archfixtures.modules.kernel.ids"))
    }
}
