package hms.platform.docs.infrastructure.raster

import hms.platform.docs.infrastructure.fonts.FontRegistry

/**
 * The JVM renderer identity that keys the JVM golden images (docs/specs/modules/platform-docs.md §10):
 * the JDK's vendor and runtime version, the four print fonts' SHA-256s and the rasteriser version. The
 * operating system is deliberately left out, because the JDK is pinned on every host (KA-086): if a host
 * renders differently with the same identity, the golden comparison fails and shows it.
 *
 * Form: `jvm;vendor=<java.vendor>;runtime=<java.runtime.version>;fonts=<file>:<sha256>,...;raster=<version>`,
 * fonts in [hms.platform.docs.infrastructure.fonts.PrintFont] order.
 */
object JvmRenderIdentity {
    fun of(
        fonts: FontRegistry,
        property: (String) -> String? = System::getProperty,
    ): String {
        val vendor = property("java.vendor") ?: UNKNOWN
        val runtime = property("java.runtime.version") ?: UNKNOWN
        val fontHashes = fonts.all.joinToString(",") { "${it.printFont.fileName}:${it.sha256}" }
        return "jvm;vendor=$vendor;runtime=$runtime;fonts=$fontHashes;raster=${Java2dLayoutRasteriser.RASTERISER_VERSION}"
    }

    private const val UNKNOWN = "unknown"
}
