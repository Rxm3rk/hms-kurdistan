package hms.kernel.archrules

/**
 * Maps a package name to its application module and layer (BUILD-PROMPT §5.2, §6.1).
 *
 * A module lives at `<root>.<module>`, where the module name is the module id with hyphens turned into
 * dots (`trust-identity` becomes `hms.trust.identity`, `reg-dose` becomes `hms.reg.dose`). Inside a module,
 * code sits in one of the [LAYERS] packages. The module of a package is the path between the root and
 * the first layer segment. A package with no layer segment is the module's root package, and it is not
 * part of the module's api. The shared kernel `<root>.kernel` is not a module.
 */
class ModuleLayout(
    val root: String = HmsArchitectureRules.ROOT_PACKAGE,
) {
    /** The shared kernel package; every module may use it. */
    val kernel: String = "$root.kernel"

    /** Returns the module that owns [packageName], or null for the kernel and for packages outside the root. */
    fun moduleOf(packageName: String): String? {
        if (!isWithin(packageName, root) || isWithin(packageName, kernel)) return null
        val segments = segmentsBelowRoot(packageName)
        val layerIndex = segments.indexOfFirst { it in LAYERS }
        return when {
            segments.isEmpty() || layerIndex == 0 -> null
            layerIndex > 0 -> segments.subList(0, layerIndex).joinToString(".")
            else -> segments.joinToString(".")
        }
    }

    /** Returns the layer of [packageName] inside its module, or null for a module root or a non-module package. */
    fun layerOf(packageName: String): String? {
        if (moduleOf(packageName) == null) return null
        return segmentsBelowRoot(packageName).firstOrNull { it in LAYERS }
    }

    private fun segmentsBelowRoot(packageName: String): List<String> = packageName.removePrefix(root).split('.').filter { it.isNotEmpty() }

    companion object {
        /** The only layer another module may use. */
        const val API: String = "api"

        /** The hexagonal layers inside every backend module (§6.1). */
        val LAYERS: Set<String> = setOf(API, "domain", "application", "infrastructure", "web", "events")

        /** True when [packageName] is [prefix] itself or one of its sub-packages. */
        fun isWithin(
            packageName: String,
            prefix: String,
        ): Boolean = packageName == prefix || packageName.startsWith("$prefix.")
    }
}
