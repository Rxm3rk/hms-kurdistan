package hms.platform.docs.infrastructure.template

import hms.platform.docs.application.TemplateRepository
import hms.platform.docs.domain.template.LegibilityPolicy
import hms.platform.docs.domain.template.Template
import hms.platform.docs.domain.template.TemplateLint
import tools.jackson.core.JacksonException
import tools.jackson.core.StreamReadFeature
import tools.jackson.dataformat.yaml.YAMLMapper
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.util.HexFormat
import kotlin.io.path.isRegularFile
import kotlin.io.path.name

/** The outcome of loading one template file. */
sealed interface TemplateLoad {
    data class Loaded(
        val template: Template,
    ) : TemplateLoad

    /** Refused, with every problem found (structure, then lint findings); templates hold no patient data. */
    data class Refused(
        val source: String,
        val problems: List<String>,
        /** The id the file claims, when it could be read: a refused file blocks its id (fail closed). */
        val templateId: String? = null,
    ) : TemplateLoad
}

/**
 * Every template of a directory: the usable ones and the refused files. A template id that appears in a refused
 * file (a lint finding, or a second file claiming an existing id and version with other content) is not usable in
 * any version: [YamlTemplateRepository] does not return it (fail closed).
 */
data class TemplateDirectory(
    val templates: List<Template>,
    val refusals: List<TemplateLoad.Refused>,
    val blockedIds: Set<String>,
)

/**
 * Loads print templates from `content/print-templates/*.yaml` (docs/specs/modules/platform-docs.md §4; §6.6
 * extension tier 1, §19.4).
 *
 * - **Parsing:** Jackson YAML into a tree with duplicate keys refused, then [TemplateYaml]: closed key sets at every
 *   level, so an unknown key is refused, never ignored (a misspelt `overflow` must not silently become the default).
 * - **Content hash** (spec §4.2): SHA-256 of the file bytes with CRLF normalised to LF, lower-case hex. With the id
 *   and version it travels with every job, event and audit record and keys first-band verification (§6.3).
 * - **One hash per (id, version):** a second file that claims an existing id and version with a different hash is
 *   refused and the id is blocked; the same bytes twice are one template. The bundle pipeline enforces the rule
 *   across bundles (WP-0.3, KA-082).
 * - **Lint:** [TemplateLint] runs on every template; any finding refuses it (spec §4.3, CTRL-0001-5).
 * - Files listed in [NON_TEMPLATE_FILES] (the worst-case identity corpus) share the directory and are skipped.
 */
class YamlTemplateLoader(
    private val legibility: LegibilityPolicy = LegibilityPolicy(),
) {
    private val mapper: YAMLMapper = YAMLMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build()

    /** Loads one template from [bytes]; [source] names it in problems (a file name, never content). */
    fun parse(
        bytes: ByteArray,
        source: String,
    ): TemplateLoad {
        val nodes = YamlNodes()
        val tree =
            try {
                mapper.readTree(bytes)
            } catch (e: JacksonException) {
                nodes.problem("", "not valid YAML (${e.javaClass.simpleName} at line ${e.location?.lineNr ?: "?"})")
                null
            }
        val template = tree?.let { TemplateYaml(nodes).template(it, contentHash(bytes)) }
        val findings =
            template
                ?.let { TemplateLint.lint(it, legibility) }
                .orEmpty()
                .map { "lint rule ${it.rule}${it.elementIndex?.let { i -> ", elements[$i]" }.orEmpty()}: ${it.message}" }
        return if (template != null && findings.isEmpty()) {
            TemplateLoad.Loaded(template)
        } else {
            val claimed = tree?.takeIf { it.isObject }?.get("id")?.takeIf { it.isString }?.asString()
            TemplateLoad.Refused(source, nodes.problems + findings, claimed)
        }
    }

    /** Loads every `*.yaml` file of [directory] (sorted by name, so the outcome never depends on the file system). */
    fun loadDirectory(directory: Path): TemplateDirectory {
        val files =
            Files.list(directory).use { stream ->
                stream.filter { it.isRegularFile() && it.name.endsWith(".yaml") && it.name !in NON_TEMPLATE_FILES }.toList()
            }
        return combine(files.sortedBy { it.name }.map { it.name to parse(Files.readAllBytes(it), it.name) })
    }

    /** Applies the one-hash-per-version rule to loaded files, in order. */
    internal fun combine(loads: List<Pair<String, TemplateLoad>>): TemplateDirectory {
        val byKey = LinkedHashMap<Pair<String, Int>, Template>()
        val refusals = mutableListOf<TemplateLoad.Refused>()
        val blocked = mutableSetOf<String>()
        for ((source, load) in loads) {
            when (load) {
                is TemplateLoad.Refused -> {
                    refusals += load
                    load.templateId?.let { blocked += it }
                }

                is TemplateLoad.Loaded -> {
                    val template = load.template
                    val existing = byKey.putIfAbsent(template.id to template.version, template)
                    if (existing != null && existing.contentHash != template.contentHash) {
                        refusals +=
                            TemplateLoad.Refused(
                                source,
                                listOf("id ${template.id} version ${template.version} already loaded with another content hash"),
                                template.id,
                            )
                        blocked += template.id
                    }
                }
            }
        }
        return TemplateDirectory(byKey.values.filter { it.id !in blocked }, refusals, blocked)
    }

    companion object {
        /** YAML files in the template directory that are not templates. */
        val NON_TEMPLATE_FILES: Set<String> = setOf("worst-case-identity-corpus.yaml")

        /** SHA-256 of [bytes] with every CR LF replaced by LF, lower-case hex (spec §4.2). */
        fun contentHash(bytes: ByteArray): String {
            val normalised = ByteArrayOutputStream(bytes.size)
            var i = 0
            while (i < bytes.size) {
                val crlf = bytes[i] == CR && i + 1 < bytes.size && bytes[i + 1] == LF
                if (!crlf) normalised.write(bytes[i].toInt())
                i++
            }
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalised.toByteArray()))
        }

        private const val CR: Byte = 0x0D
        private const val LF: Byte = 0x0A
    }
}

/**
 * The [TemplateRepository] adapter over a loaded directory: the highest version of each usable id. Blocked ids
 * (any refused file claimed them) are never returned, so a refused version cannot fall back to an older one.
 */
class YamlTemplateRepository(
    directory: TemplateDirectory,
) : TemplateRepository {
    private val latest: Map<String, Template> =
        directory.templates
            .filter { it.id !in directory.blockedIds }
            .groupBy { it.id }
            .mapValues { (_, versions) -> versions.maxBy { it.version } }

    override fun find(templateId: String): Template? = latest[templateId]

    /** Every usable template, by id. */
    fun all(): List<Template> = latest.values.sortedBy { it.id }

    companion object {
        fun fromDirectory(
            directory: Path,
            loader: YamlTemplateLoader = YamlTemplateLoader(),
        ): YamlTemplateRepository = YamlTemplateRepository(loader.loadDirectory(directory))
    }
}
