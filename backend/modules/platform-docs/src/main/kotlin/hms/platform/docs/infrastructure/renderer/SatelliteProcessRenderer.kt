package hms.platform.docs.infrastructure.renderer

import hms.platform.docs.api.RefusalReason
import hms.platform.docs.application.DocumentRendererPort
import hms.platform.docs.application.RenderOutcome
import hms.platform.docs.application.RenderRequest
import hms.platform.docs.infrastructure.fonts.FontRegistry
import tools.jackson.core.JacksonException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.time.Duration
import java.util.HexFormat
import java.util.concurrent.TimeUnit

/**
 * The [DocumentRendererPort] adapter that runs the renderer satellite's command line (docs/specs/modules/platform-docs.md
 * §7.5; `backend/satellites/document-renderer/README.md`): `<runtime python> -I -m hms_docrender render --request
 * <file> --out <file>`, one fresh process per document, with a clean environment (only what the interpreter needs on
 * the host, and an optional font directory override), no network listener and no shared state.
 *
 * - **Request:** contract version 1 (`contract/render-request.schema.json`): camelCase fields, `contractVersion: 1`,
 *   `pdfVariant: "pdf/a-2b"`, `templateContentHash`, written to a file (never through a pipe that could block).
 * - **Result:** the JSON object on the last line of standard output (`contract/render-result.schema.json`). A rendered
 *   PDF is accepted only when its SHA-256 equals the reported one and the font SHA-256s in the reported renderer
 *   identity equal this module's `fonts.json` (the satellite checks them too; spec §9: one font directory).
 * - **Refusals:** the satellite's R8 finding (`r8-eastern-digit`) maps to `EASTERN_DIGITS`; every other refusal or
 *   failure, a timeout, a missing runtime or an unreadable result maps to `RENDERER_UNAVAILABLE` (fail closed).
 * - **Nothing is logged**, and the satellite's `detail` is never kept: it names reason codes and counts, but a caller
 *   must not log it with patient context (README); a failure here carries only the status and the code.
 *
 * Production wiring has no satellite until the cell exists (KA-083); tests and the sample generator use this adapter
 * with the build-host runtime (`build/docrender-runtime`).
 */
class SatelliteProcessRenderer(
    private val command: List<String>,
    private val environment: Map<String, String>,
    private val fonts: FontRegistry,
    private val workDir: Path,
    private val timeout: Duration = DEFAULT_TIMEOUT,
) : DocumentRendererPort {
    override fun render(request: RenderRequest): RenderOutcome {
        Files.createDirectories(workDir)
        val dir = Files.createTempDirectory(workDir, "render-")
        return try {
            run(request, dir)
        } catch (ignored: IOException) {
            // The runtime is missing or the files cannot be written: no PDF (fail closed).
            RenderOutcome.Failed("renderer could not be run")
        } finally {
            dir.toFile().deleteRecursively()
        }
    }

    private fun run(
        request: RenderRequest,
        dir: Path,
    ): RenderOutcome {
        val requestFile = dir.resolve("request.json")
        val out = dir.resolve("out.pdf")
        val stdout = dir.resolve("result.json")
        Files.write(requestFile, requestJson(request))
        val builder =
            ProcessBuilder(command + listOf("--request", requestFile.toString(), "--out", out.toString()))
                .redirectOutput(stdout.toFile())
                .redirectError(ProcessBuilder.Redirect.DISCARD)
        builder.environment().clear()
        builder.environment().putAll(environment)
        val process = builder.start()
        process.outputStream.close()
        val finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)
        if (!finished) process.destroyForcibly()
        val lastLine =
            Files
                .readAllLines(stdout, Charsets.UTF_8)
                .lastOrNull { it.isNotBlank() }
        val pdf = if (Files.isRegularFile(out)) Files.readAllBytes(out) else null
        return if (finished) interpret(process.exitValue(), lastLine, pdf) else RenderOutcome.Failed("renderer timed out")
    }

    /** The outcome of one run: the exit code, the last line of standard output, and the PDF written, if any. */
    internal fun interpret(
        exitCode: Int,
        resultLine: String?,
        pdf: ByteArray?,
    ): RenderOutcome {
        val result = resultLine?.let { line -> parse(line) }
        val status = result?.get("status")?.takeIf { it.isString }?.asString()
        val code =
            result
                ?.get("code")
                ?.takeIf { it.isString }
                ?.asString()
                .orEmpty()
        return when {
            result == null -> {
                RenderOutcome.Failed("no result from the renderer (exit $exitCode)")
            }

            status == "rendered" && exitCode == 0 && pdf != null -> {
                rendered(result, pdf)
            }

            status == "refused" && code == UNRENDERABLE && R8 in result.get("detail")?.asString().orEmpty() -> {
                RenderOutcome.Failed("renderer refused: $UNRENDERABLE ($R8)", RefusalReason.EASTERN_DIGITS)
            }

            else -> {
                RenderOutcome.Failed("renderer ${status ?: "answered"}: ${code.ifEmpty { "no code" }} (exit $exitCode)")
            }
        }
    }

    private fun rendered(
        result: JsonNode,
        pdf: ByteArray,
    ): RenderOutcome {
        val reported = result.get("sha256")?.asString()
        val identity = result.get("rendererIdentity")?.asString().orEmpty()
        val pages = result.get("pageCount")?.takeIf { it.canConvertToInt() }?.intValue() ?: 0
        val identityFonts =
            identity
                .split(';')
                .filter { it.startsWith(FONT_PREFIX) && '=' in it }
                .associate { it.removePrefix(FONT_PREFIX).substringBefore('=') to it.substringAfter('=') }
        val fontsAgree = fonts.all.all { identityFonts[it.printFont.fileName] == it.sha256 }
        return when {
            sha256(pdf) != reported -> RenderOutcome.Failed("the PDF does not match the SHA-256 the renderer reported")
            !fontsAgree -> RenderOutcome.Failed("the renderer's font SHA-256s differ from fonts.json")
            pages < 1 -> RenderOutcome.Failed("the renderer reported no pages")
            else -> RenderOutcome.Rendered(pdf, sha256(pdf), pages, identity)
        }
    }

    private fun parse(line: String): JsonNode? =
        try {
            MAPPER.readTree(line)?.takeIf { it.isObject }
        } catch (ignored: JacksonException) {
            null
        }

    companion object {
        /** A render that takes longer than this is abandoned (the process is killed) and refused. */
        val DEFAULT_TIMEOUT: Duration = Duration.ofMinutes(2)

        /** The environment variables a Windows child process needs (as the satellite's own `env.subprocess_env`). */
        val WINDOWS_PASS: List<String> = listOf("SYSTEMDRIVE", "SYSTEMROOT", "WINDIR", "PROGRAMDATA")

        /** The satellite's font directory override (`HMS_DOCRENDER_FONT_DIR`). */
        const val FONT_DIR_ENV: String = "HMS_DOCRENDER_FONT_DIR"

        private const val FONT_PREFIX = "font:"
        private const val UNRENDERABLE = "unrenderable-text"
        private const val R8 = "r8-eastern-digit"
        private val MAPPER: JsonMapper = JsonMapper.builder().build()

        /**
         * The adapter for a runtime made by the satellite's `bootstrap.py` at [runtimeDir] (for example
         * `build/docrender-runtime`), writing scratch files under [workDir].
         */
        fun forRuntime(
            runtimeDir: Path,
            fonts: FontRegistry,
            workDir: Path,
            fontDir: Path? = null,
        ): SatelliteProcessRenderer {
            val windows = System.getProperty("os.name").orEmpty().startsWith("Windows")
            val python = if (windows) runtimeDir.resolve("Scripts").resolve("python.exe") else runtimeDir.resolve("bin").resolve("python")
            val environment =
                buildMap {
                    if (windows) {
                        WINDOWS_PASS.forEach { name -> System.getenv(name)?.let { put(name, it) } }
                    } else {
                        put("LANG", "C.UTF-8")
                    }
                    fontDir?.let { put(FONT_DIR_ENV, it.toString()) }
                }
            return SatelliteProcessRenderer(listOf(python.toString(), "-I", "-m", "hms_docrender", "render"), environment, fonts, workDir)
        }

        /** The request as contract version 1 JSON (UTF-8), fields in the schema's order. */
        fun requestJson(request: RenderRequest): ByteArray {
            val node =
                MAPPER.createObjectNode().apply {
                    put("contractVersion", 1)
                    put("html", request.html)
                    put("pdfVariant", "pdf/a-2b")
                    put("title", request.title)
                    put("templateId", request.templateId)
                    put("templateVersion", request.templateVersion)
                    put("templateContentHash", request.templateHash)
                    put("provenance", request.provenance)
                    put("language", request.language)
                    put("createdAt", request.createdAt)
                }
            return MAPPER.writeValueAsBytes(node)
        }

        private fun sha256(bytes: ByteArray): String = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))
    }
}
