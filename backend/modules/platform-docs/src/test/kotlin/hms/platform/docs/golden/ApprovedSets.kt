package hms.platform.docs.golden

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.databind.node.ObjectNode
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

/**
 * What the golden-image and byte-fixture harnesses share (docs/specs/modules/platform-docs.md §10):
 * where approved files come from, where candidates go, and the approved-set manifest.
 *
 * An approved set is a directory with a `manifest.json`:
 * ```json
 * {"identity": "<identity>", "files": [{"name": "…", "sha256": "…", "template_id": "…",
 *   "template_version": 1, "template_hash": "…"}], "human_script_review": "requested",
 *  "approved_by_agent_commit": null}
 * ```
 * The harness reads approved files from the test classpath (`src/test/resources`), never writes there, and
 * writes candidates, difference files and a candidate manifest to the directory in the system property
 * `hms.docs.candidatesDir` (Gradle sets `build/golden-candidates`). Approving means a human (or, as
 * regression evidence only, the build agent) copies reviewed candidates into `src/test/resources`.
 */
object ApprovedSets {
    const val CANDIDATES_PROPERTY: String = "hms.docs.candidatesDir"

    private val MAPPER: JsonMapper = JsonMapper.builder().build()

    /** Approved files from the test classpath, by path relative to the resources root. */
    val classpath: (String) -> ByteArray? = { path ->
        ApprovedSets::class.java.getResourceAsStream("/$path")?.use { it.readAllBytes() }
    }

    /** The candidates directory from [CANDIDATES_PROPERTY]; a run without it cannot report candidates and fails. */
    fun candidatesDirFromSystemProperty(): Path =
        Path.of(
            System.getProperty(CANDIDATES_PROPERTY)
                ?: throw AssertionError("system property $CANDIDATES_PROPERTY is not set; candidates cannot be written"),
        )

    /** Identity keys and file names become path segments: letters, digits, `.`, `_` and `-` only. */
    fun requireSafeSegment(
        kind: String,
        value: String,
    ) {
        require(
            value.isNotEmpty() &&
                value.all { (it.isLetterOrDigit() && it.code < ASCII_LIMIT) || it in "._-" } &&
                value != "." &&
                value != "..",
        ) {
            "$kind '$value' must use only ASCII letters, digits, '.', '_' and '-'"
        }
    }

    fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    /** The manifest entry for [name] in an approved manifest, or null. */
    fun approvedEntry(
        manifest: ByteArray,
        name: String,
    ): JsonNode? = MAPPER.readTree(manifest).path("files").firstOrNull { it.path("name").asString() == name }

    /**
     * Adds or replaces [name]'s entry in the candidate manifest of [dir] (entries sorted by name), so one run
     * that writes several candidates leaves one manifest describing them all.
     */
    @Synchronized
    fun recordCandidate(
        dir: Path,
        identity: String,
        name: String,
        sha256: String,
        provenance: Provenance,
    ) {
        Files.createDirectories(dir)
        val file = dir.resolve("manifest.json")
        val existing = if (Files.exists(file)) MAPPER.readTree(Files.readAllBytes(file)).path("files").toList() else emptyList()
        val entries = existing.filter { it.path("name").asString() != name }.map { it as ObjectNode }.toMutableList()
        entries +=
            MAPPER.createObjectNode().apply {
                put("name", name)
                put("sha256", sha256)
                put("template_id", provenance.templateId)
                put("template_version", provenance.templateVersion)
                put("template_hash", provenance.templateHash)
            }
        val root =
            MAPPER.createObjectNode().apply {
                put("identity", identity)
                putArray("files").apply { entries.sortedBy { it.path("name").asString() }.forEach { add(it) } }
                put("human_script_review", "requested")
                putNull("approved_by_agent_commit")
            }
        Files.writeString(file, MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(root) + "\n")
    }

    private const val ASCII_LIMIT = 128
}

/** The template a golden or fixture was produced from (spec §10: each approved file names it). */
data class Provenance(
    val templateId: String,
    val templateVersion: Int,
    val templateHash: String,
)
