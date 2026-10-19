package hms.platform.docs.infrastructure.renderer

import hms.platform.docs.api.RefusalReason
import hms.platform.docs.application.RenderOutcome
import hms.platform.docs.application.RenderRequest
import hms.platform.docs.infrastructure.fonts.FontRegistry
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import tools.jackson.databind.json.JsonMapper
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.time.Duration
import java.util.HexFormat

/**
 * The renderer satellite's command-line adapter (docs/specs/modules/platform-docs.md §7.5; the satellite README's
 * contract version 1). The process tests run [FakeSatellite], a test-only stand-in for the satellite's command line,
 * in a child JVM; the real satellite runs in the PDF golden step.
 */
class SatelliteProcessRendererTest :
    FunSpec({
        val fonts = FontRegistry.fromClasspath()
        val work = Files.createTempDirectory("hms-render-test")
        val request =
            RenderRequest(
                html = "<!DOCTYPE html><html></html>",
                title = "SYN-DOCUMENT-A4",
                templateId = "SYN-DOCUMENT-A4",
                templateVersion = 1,
                templateHash = "ab".repeat(32),
                provenance = "synthetic",
                language = "ckb",
                createdAt = "2026-10-19T14:05:00+03:00",
            )
        val fontIdentity = fonts.all.joinToString(";") { "font:${it.printFont.fileName}=${it.sha256}" }
        val identity = "hms-docrender-identity/1;weasyprint=70.0;$fontIdentity"
        val pdf = "%PDF-1.7 synthetic".toByteArray()

        fun sha(bytes: ByteArray) = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))

        fun result(fields: String) = "{\"contractVersion\":1,$fields}"

        val adapter = SatelliteProcessRenderer(listOf("unused"), emptyMap(), fonts, work)

        test("the request is contract version 1: camelCase, pdf/a-2b and the template content hash") {
            val json = JsonMapper.builder().build().readTree(SatelliteProcessRenderer.requestJson(request))
            json.propertyNames().toList() shouldBe
                listOf(
                    "contractVersion",
                    "html",
                    "pdfVariant",
                    "title",
                    "templateId",
                    "templateVersion",
                    "templateContentHash",
                    "provenance",
                    "language",
                    "createdAt",
                )
            json.get("contractVersion").intValue() shouldBe 1
            json.get("pdfVariant").asString() shouldBe "pdf/a-2b"
            json.get("templateContentHash").asString() shouldBe "ab".repeat(32)
            json.get("language").asString() shouldBe "ckb"
        }

        test("a rendered result is accepted only with the reported SHA-256 and the module's font hashes") {
            val ok = result("\"status\":\"rendered\",\"sha256\":\"${sha(pdf)}\",\"pageCount\":1,\"rendererIdentity\":\"$identity\"")
            adapter.interpret(0, ok, pdf).shouldBeInstanceOf<RenderOutcome.Rendered>().pageCount shouldBe 1
            val wrongSha = ok.replace(sha(pdf), "0".repeat(64))
            adapter.interpret(0, wrongSha, pdf).shouldBeInstanceOf<RenderOutcome.Failed>().reason shouldBe
                RefusalReason.RENDERER_UNAVAILABLE
            val otherFont = ok.replace(fonts.all.first().sha256, "1".repeat(64))
            adapter.interpret(0, otherFont, pdf).shouldBeInstanceOf<RenderOutcome.Failed>().detail shouldContain "fonts.json"
            adapter.interpret(0, ok, null).shouldBeInstanceOf<RenderOutcome.Failed>()
        }

        test("the satellite's R8 refusal maps to easternDigits; any other refusal or failure to rendererUnavailable, without detail") {
            val r8 = result("\"status\":\"refused\",\"code\":\"unrenderable-text\",\"detail\":\"layout: r8-eastern-digit=2\"")
            adapter.interpret(4, r8, null).shouldBeInstanceOf<RenderOutcome.Failed>().reason shouldBe RefusalReason.EASTERN_DIGITS
            val r7 = result("\"status\":\"refused\",\"code\":\"unrenderable-text\",\"detail\":\"layout: r7-uncovered=1\"")
            adapter.interpret(4, r7, null).shouldBeInstanceOf<RenderOutcome.Failed>().let {
                it.reason shouldBe RefusalReason.RENDERER_UNAVAILABLE
                it.detail shouldNotContain "r7-uncovered"
            }
            val failed = result("\"status\":\"failed\",\"code\":\"render-error\",\"detail\":\"weasyprint: x\"")
            adapter.interpret(1, failed, null).shouldBeInstanceOf<RenderOutcome.Failed>().reason shouldBe RefusalReason.RENDERER_UNAVAILABLE
            adapter.interpret(1, null, null).shouldBeInstanceOf<RenderOutcome.Failed>()
            adapter.interpret(0, "not json", null).shouldBeInstanceOf<RenderOutcome.Failed>()
        }

        context("the process") {
            val java = ProcessHandle.current().info().command().orElseThrow()
            val classpath = System.getProperty("java.class.path")
            val environment = SatelliteProcessRenderer.WINDOWS_PASS.mapNotNull { name -> System.getenv(name)?.let { name to it } }.toMap()

            fun fake(mode: String) =
                SatelliteProcessRenderer(
                    listOf(java, "-Xmx64m", "-cp", classpath, FakeSatellite::class.java.name, mode),
                    environment,
                    fonts,
                    work,
                    Duration.ofSeconds(60),
                )

            test("runs the command line with --request and --out, reads the last line and the PDF, and leaves nothing behind") {
                val outcome = fake("render:$identity").render(request).shouldBeInstanceOf<RenderOutcome.Rendered>()
                String(outcome.pdf, Charsets.UTF_8) shouldContain "SYN-DOCUMENT-A4"
                Files.list(work).use { it.count() } shouldBe 0L
            }

            test("a refusal from the process, a crash, a missing runtime and a timeout are each refused") {
                fake("refuse-r8").render(request).shouldBeInstanceOf<RenderOutcome.Failed>().reason shouldBe RefusalReason.EASTERN_DIGITS
                fake("crash").render(request).shouldBeInstanceOf<RenderOutcome.Failed>().reason shouldBe RefusalReason.RENDERER_UNAVAILABLE
                SatelliteProcessRenderer
                    .forRuntime(Path.of("build", "no-such-runtime"), fonts, work)
                    .render(request)
                    .shouldBeInstanceOf<RenderOutcome.Failed>()
                    .detail shouldBe "renderer could not be run"
                val hang = listOf(java, "-cp", classpath, FakeSatellite::class.java.name, "hang")
                SatelliteProcessRenderer(hang, environment, fonts, work, Duration.ofSeconds(3))
                    .render(request)
                    .shouldBeInstanceOf<RenderOutcome.Failed>()
                    .detail shouldBe "renderer timed out"
            }
        }
    })
