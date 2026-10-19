package hms.platform.docs.infrastructure.renderer

import tools.jackson.databind.json.JsonMapper
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.util.HexFormat

/**
 * A TEST-ONLY stand-in for the renderer satellite's command line (`python -I -m hms_docrender render --request <file>
 * --out <file>`, contract version 1), run in a child JVM by [SatelliteProcessRendererTest]. Modes: `render:<identity>`
 * writes a fake PDF holding the request's template id and a `rendered` result; `refuse-r8` writes the satellite's R8
 * refusal; `crash` exits with no result line; `hang` never ends.
 */
object FakeSatellite {
    @JvmStatic
    fun main(args: Array<String>) {
        val mode = args.first()
        val request = Path.of(args[args.indexOf("--request") + 1])
        val out = Path.of(args[args.indexOf("--out") + 1])
        when {
            mode.startsWith("render:") -> render(request, out, mode.removePrefix("render:"))
            mode == "refuse-r8" -> println(RESULT_R8)
            mode == "crash" -> Runtime.getRuntime().halt(1)
            else -> Thread.sleep(Long.MAX_VALUE)
        }
    }

    private fun render(
        request: Path,
        out: Path,
        identity: String,
    ) {
        val templateId = JsonMapper.builder().build().readTree(Files.readAllBytes(request)).get("templateId").asString()
        val pdf = "%PDF-1.7 fake $templateId".toByteArray()
        Files.write(out, pdf)
        val sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(pdf))
        println("progress line that is not the result")
        println("{\"contractVersion\":1,\"status\":\"rendered\",\"sha256\":\"$sha\",\"pageCount\":1,\"rendererIdentity\":\"$identity\"}")
    }

    private const val RESULT_R8 =
        "{\"contractVersion\":1,\"status\":\"refused\",\"code\":\"unrenderable-text\",\"detail\":\"layout: r8-eastern-digit=1\"}"
}
