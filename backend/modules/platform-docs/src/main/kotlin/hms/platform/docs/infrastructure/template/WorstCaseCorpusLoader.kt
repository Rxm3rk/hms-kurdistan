package hms.platform.docs.infrastructure.template

import hms.platform.docs.api.BirthDate
import hms.platform.docs.api.DatePrecision
import hms.platform.docs.api.NameForm
import hms.platform.docs.application.CorpusIdentity
import hms.platform.docs.application.WorstCaseCorpus
import tools.jackson.core.JacksonException
import tools.jackson.core.StreamReadFeature
import tools.jackson.databind.JsonNode
import tools.jackson.dataformat.yaml.YAMLMapper

/** The corpus, or every problem that stopped it loading. */
sealed interface CorpusLoad {
    data class Loaded(
        val corpus: WorstCaseCorpus,
    ) : CorpusLoad

    data class Refused(
        val problems: List<String>,
    ) : CorpusLoad
}

/**
 * Loads `content/print-templates/worst-case-identity-corpus.yaml`, the governed worst-case identity corpus of the
 * template fit check (docs/specs/modules/platform-docs.md §4.3; OQ-244), as strictly as templates: closed keys,
 * duplicate keys refused, `provenance` required. A corpus with no identity, MRN, encounter or date of birth is refused
 * (an empty corpus would pass every template).
 */
object WorstCaseCorpusLoader {
    /** The corpus file name in the template directory. */
    const val FILE_NAME: String = "worst-case-identity-corpus.yaml"

    private val mapper: YAMLMapper = YAMLMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build()

    private val forms: Map<String, NameForm> =
        mapOf("ckb" to NameForm.CKB, "ar" to NameForm.AR, "ku_arab" to NameForm.KU_ARAB, "latin" to NameForm.LATIN)

    fun parse(bytes: ByteArray): CorpusLoad {
        val nodes = YamlNodes()
        val corpus =
            try {
                corpus(nodes, mapper.readTree(bytes))
            } catch (e: JacksonException) {
                nodes.problem("", "not valid YAML (${e.javaClass.simpleName})")
                null
            }
        return if (corpus != null && nodes.problems.isEmpty()) CorpusLoad.Loaded(corpus) else CorpusLoad.Refused(nodes.problems)
    }

    private fun corpus(
        nodes: YamlNodes,
        root: JsonNode?,
    ): WorstCaseCorpus? {
        val map = nodes.mapping(root, "", setOf("provenance", "identities", "mrns", "encounters", "birth_dates")) ?: return null
        nodes.choice(map, "", "provenance", mapOf("synthetic" to "synthetic", "approved" to "approved"))
        val identities = nodes.list(map, "", "identities")?.mapIndexedNotNull { i, node -> identity(nodes, node, "identities[$i]") }
        val mrns = strings(nodes, map, "mrns")
        val encounters = strings(nodes, map, "encounters")
        val birthDates = nodes.list(map, "", "birth_dates")?.mapIndexedNotNull { i, node -> birthDate(nodes, node, "birth_dates[$i]") }
        listOf("identities" to identities, "mrns" to mrns, "encounters" to encounters, "birth_dates" to birthDates)
            .filter { (_, values) -> values != null && values.isEmpty() }
            .forEach { (key, _) -> nodes.problem(key, "must not be empty") }
        val complete = identities != null && mrns != null && encounters != null && birthDates != null
        return if (complete) WorstCaseCorpus(identities, mrns, encounters, birthDates) else null
    }

    private fun strings(
        nodes: YamlNodes,
        map: JsonNode,
        key: String,
    ): List<String>? =
        nodes.list(map, "", key)?.mapIndexedNotNull { i, node ->
            node.takeIf { it.isString && it.asString().isNotBlank() }?.asString()
                ?: null.also { nodes.problem("$key[$i]", "must be a non-blank string") }
        }

    private fun identity(
        nodes: YamlNodes,
        node: JsonNode,
        path: String,
    ): CorpusIdentity? {
        val map = nodes.mapping(node, path, setOf("label", "own_form", "names", "newborn", "alias")) ?: return null
        val label = nodes.string(map, path, "label")
        val ownForm = nodes.choice(map, path, "own_form", forms)
        val namesNode = nodes.mapping(map.get("names"), "$path.names", forms.keys)
        val names =
            namesNode?.let { names ->
                names
                    .propertyNames()
                    .mapNotNull { key -> nodes.string(names, "$path.names", key)?.let { forms.getValue(key) to it } }
                    .toMap()
            }
        val newborn = flag(nodes, map, path, "newborn")
        val alias = flag(nodes, map, path, "alias")
        val complete = label != null && ownForm != null && names != null && newborn != null && alias != null
        return if (complete) CorpusIdentity(label, names, ownForm, newborn, alias) else null
    }

    private fun flag(
        nodes: YamlNodes,
        map: JsonNode,
        path: String,
        key: String,
    ): Boolean? =
        nodes.optional(map, key, false) {
            map.get(key).takeIf { it.isBoolean }?.booleanValue() ?: null.also { nodes.problem("$path.$key", "must be true or false") }
        }

    private fun birthDate(
        nodes: YamlNodes,
        node: JsonNode,
        path: String,
    ): BirthDate? {
        val map = nodes.mapping(node, path, setOf("value", "precision", "approximate")) ?: return null
        val value = nodes.string(map, path, "value")
        val precision = nodes.choice(map, path, "precision", DatePrecision.entries.associateBy { it.name.lowercase() })
        val approximate = flag(nodes, map, path, "approximate")
        val complete = value != null && precision != null && approximate != null
        return if (complete) BirthDate(value, precision, approximate) else null
    }
}
