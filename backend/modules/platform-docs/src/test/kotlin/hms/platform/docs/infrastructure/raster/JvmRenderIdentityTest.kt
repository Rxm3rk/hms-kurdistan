package hms.platform.docs.infrastructure.raster

import hms.platform.docs.infrastructure.fonts.FontRegistry
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain

/** The JVM renderer identity (docs/specs/modules/platform-docs.md §10). */
class JvmRenderIdentityTest :
    FunSpec({
        val registry = FontRegistry.fromClasspath()

        test("the identity names the JDK vendor and runtime, the four font hashes and the rasteriser version, never the OS") {
            val props = mapOf("java.vendor" to "Eclipse Adoptium", "java.runtime.version" to "25.0.4.1+1-LTS", "os.name" to "Windows 11")
            val identity = JvmRenderIdentity.of(registry, props::get)
            identity shouldBe
                "jvm;vendor=Eclipse Adoptium;runtime=25.0.4.1+1-LTS;fonts=" +
                "NotoSansArabic-Regular.ttf:bdff3e5659d67e67def05b33f749683b9376ae819d65d3dd62ac4640b3aaef48," +
                "NotoSansArabic-Bold.ttf:4e5462d2e8be880317b9f49b5b2da109ddb6a3563d91cc604b67f3535832a555," +
                "NotoSans-Regular.ttf:478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823," +
                "NotoSans-Bold.ttf:1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913;" +
                "raster=${Java2dLayoutRasteriser.RASTERISER_VERSION}"
            identity shouldNotContain "Windows"
        }

        test("the identity of this JVM uses its system properties") {
            JvmRenderIdentity.of(registry) shouldContain "runtime=${System.getProperty("java.runtime.version")}"
        }
    })
