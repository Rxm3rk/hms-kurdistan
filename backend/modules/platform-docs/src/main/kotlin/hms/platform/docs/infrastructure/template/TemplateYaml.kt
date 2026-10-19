package hms.platform.docs.infrastructure.template

import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.Element
import hms.platform.docs.domain.template.FontChoice
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.template.Media
import hms.platform.docs.domain.template.MmBox
import hms.platform.docs.domain.template.Overflow
import hms.platform.docs.domain.template.Provenance
import hms.platform.docs.domain.template.SizeRange
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.Template
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.template.TextDirection
import tools.jackson.databind.JsonNode

/**
 * The template YAML format (docs/specs/modules/platform-docs.md §4.1) read into the domain [Template]. Closed key
 * sets at every level: an unknown key, a missing required key, a wrong type or a name outside a closed vocabulary
 * (a binding, a font, a kind) is a problem, never ignored and never defaulted. Optional keys and their defaults:
 * `media.min_dots_per_mm` (8), `weight` (regular), `max_lines` (1), `align` (start), `overflow` (refuse) and
 * `direction` (auto). The template linter runs after this (spec §4.3).
 */
internal class TemplateYaml(
    private val nodes: YamlNodes,
) {
    private val elementYaml = ElementYaml(nodes)

    /** The template, or null when any problem was found (the problems are in [nodes]). */
    fun template(
        root: JsonNode?,
        contentHash: String,
    ): Template? {
        val map = nodes.mapping(root, "", ROOT_KEYS) ?: return null
        val id = nodes.string(map, "", "id")?.takeIf { checkId(it) }
        val version = nodes.integer(map, "", "version")?.takeIf { checkVersion(it) }
        val provenance = nodes.choice(map, "", "provenance", Provenance.entries.associateBy { it.yamlName })
        val kind = nodes.choice(map, "", "kind", TemplateKind.entries.associateBy { it.yamlName })
        val media = media(map.get("media"))
        val captions = captions(map.get("captions"))
        val parsed = nodes.list(map, "", "elements")?.mapIndexed { i, node -> elementYaml.element(node, "elements[$i]") }
        val elements = parsed?.filterNotNull()?.takeIf { it.size == parsed.size }
        if (provenance == Provenance.SYNTHETIC && id != null && !id.startsWith(SYNTHETIC_PREFIX)) {
            nodes.problem("id", "a synthetic template's id starts with $SYNTHETIC_PREFIX (§19.4)")
        }
        val clean = nodes.problems.isEmpty() && elements != null
        val complete =
            clean && id != null && version != null && provenance != null && kind != null && media != null && captions != null
        return if (complete) {
            Template(id, version, contentHash, provenance, kind, media, captions, elements.orEmpty())
        } else {
            null
        }
    }

    private fun checkId(id: String): Boolean =
        ID_PATTERN.matches(id).also { valid -> if (!valid) nodes.problem("id", "must match ${ID_PATTERN.pattern}") }

    private fun checkVersion(version: Int): Boolean =
        (version >= 1).also { valid -> if (!valid) nodes.problem("version", "must be 1 or more") }

    private fun media(node: JsonNode?): Media? {
        val map = nodes.mapping(node, "media", MEDIA_KEYS) ?: return null
        val width = nodes.number(map, "media", "width_mm")
        val length = nodes.number(map, "media", "length_mm")
        val rotation = nodes.integer(map, "media", "rotation")
        val printable = nodes.box(map.get("printable"), "media.printable")
        val minDots =
            nodes.optional(map, "min_dots_per_mm", Media.DEFAULT_MIN_DOTS_PER_MM) { nodes.number(map, "media", "min_dots_per_mm") }
        val complete = width != null && length != null && rotation != null && printable != null && minDots != null
        return if (complete) {
            Media(width, length, rotation, printable, minDots)
        } else {
            null
        }
    }

    /** Caption key → text in each of `en`, `ckb` and `ar` (a missing language is a problem here and lint rule 8's too). */
    private fun captions(node: JsonNode?): Map<String, Map<LabelLanguage, String>>? {
        val map = nodes.mapping(node, "captions", node?.propertyNames()?.toSet().orEmpty()) ?: return null
        val languages = LabelLanguage.entries.map { it.tag }.toSet()
        val captions =
            map.propertyNames().sorted().associateWith { key ->
                val path = YamlNodes.childPath("captions", key)
                nodes.mapping(map.get(key), path, languages)?.let { texts ->
                    LabelLanguage.entries
                        .mapNotNull { language -> nodes.string(texts, path, language.tag)?.let { language to it } }
                        .toMap()
                }
            }
        val complete = captions.mapNotNull { (key, texts) -> texts?.let { key to it } }.toMap()
        return complete.takeIf { it.size == captions.size }
    }

    companion object {
        /** A synthetic template's id prefix (§19.4). */
        const val SYNTHETIC_PREFIX: String = "SYN-"

        /** The template id form the renderer contract accepts (`render-request.schema.json`, `templateId`). */
        val ID_PATTERN: Regex = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

        private val ROOT_KEYS = setOf("id", "version", "provenance", "kind", "media", "captions", "elements")
        private val MEDIA_KEYS = setOf("width_mm", "length_mm", "rotation", "printable", "min_dots_per_mm")
    }
}

/** The elements of a template (spec §4.1): `text`, `caption`, `rows`, `barcode` and `rule`, each with its closed key set. */
internal class ElementYaml(
    private val nodes: YamlNodes,
) {
    fun element(
        node: JsonNode,
        path: String,
    ): Element? {
        val type = if (node.isObject) node.get("type")?.takeIf { it.isString }?.asString() else null
        val keys = ELEMENT_KEYS[type]
        return if (keys == null) {
            nodes.problem("$path.type", "must be one of ${ELEMENT_KEYS.keys.sorted()}")
            null
        } else {
            nodes.mapping(node, path, keys)?.let { map ->
                when (type) {
                    "text" -> text(map, path)
                    "caption" -> caption(map, path)
                    "rows" -> rows(map, path)
                    "barcode" -> barcode(map, path)
                    else -> nodes.box(map.get("box"), "$path.box")?.let { Element.Rule(it) }
                }
            }
        }
    }

    private fun text(
        map: JsonNode,
        path: String,
    ): Element? {
        val common = common(map, path)
        val bind = binding(map, path)
        val maxLines = nodes.optional(map, "max_lines", 1) { nodes.integer(map, path, "max_lines") }
        val align = nodes.optional(map, "align", Align.START) { nodes.choice(map, path, "align", ALIGNS) }
        val overflow = nodes.optional(map, "overflow", Overflow.REFUSE) { nodes.choice(map, path, "overflow", OVERFLOWS) }
        val direction = nodes.optional(map, "direction", TextDirection.AUTO) { nodes.choice(map, path, "direction", DIRECTIONS) }
        val complete = common != null && bind != null && maxLines != null && align != null && overflow != null && direction != null
        return if (complete) {
            Element.Text(bind, common.box, common.font, common.weight, common.size, maxLines, align, overflow, direction)
        } else {
            null
        }
    }

    private fun caption(
        map: JsonNode,
        path: String,
    ): Element? {
        val common = common(map, path)
        val key = nodes.string(map, path, "key")
        val align = nodes.optional(map, "align", Align.START) { nodes.choice(map, path, "align", ALIGNS) }
        return if (common != null && key != null && align != null) {
            Element.Caption(key, common.box, common.font, common.weight, common.size, align)
        } else {
            null
        }
    }

    private fun rows(
        map: JsonNode,
        path: String,
    ): Element? {
        val common = common(map, path)
        val bind = binding(map, path)
        val description = nodes.number(map, path, "description_w_mm")
        val amount = nodes.number(map, path, "amount_w_mm")
        val complete = common != null && bind != null && description != null && amount != null
        return if (complete) {
            Element.Rows(bind, common.box, common.font, common.weight, common.size, description, amount)
        } else {
            null
        }
    }

    private fun barcode(
        map: JsonNode,
        path: String,
    ): Element? {
        val bind = binding(map, path)
        val box = nodes.box(map.get("box"), "$path.box")
        val symbology = nodes.choice(map, path, "symbology", Symbology.entries.associateBy { it.yamlName })
        val module = nodes.number(map, path, "module_mm")
        val complete = bind != null && box != null && symbology != null && module != null
        return if (complete) {
            Element.Barcode(bind, box, symbology, module)
        } else {
            null
        }
    }

    /** What text, caption and rows elements share: box, font, weight and size. */
    private data class Common(
        val box: MmBox,
        val font: FontChoice,
        val weight: FontWeight,
        val size: SizeRange,
    )

    private fun common(
        map: JsonNode,
        path: String,
    ): Common? {
        val box = nodes.box(map.get("box"), "$path.box")
        val font = nodes.choice(map, path, "font", FontChoice.entries.associateBy { it.yamlName })
        val weight = nodes.optional(map, "weight", FontWeight.REGULAR) { nodes.choice(map, path, "weight", WEIGHTS) }
        val size = size(map.get("size_pt"), "$path.size_pt")
        val complete = box != null && font != null && weight != null && size != null
        return if (complete) Common(box, font, weight, size) else null
    }

    /** A binding of the closed set (spec §4.1); a name outside it is a problem (lint rule 2's first half). */
    private fun binding(
        map: JsonNode,
        path: String,
    ): Binding? = nodes.choice(map, path, "bind", Binding.entries.associateBy { it.yamlName })

    private fun size(
        node: JsonNode?,
        path: String,
    ): SizeRange? {
        val map = nodes.mapping(node, path, setOf("max", "min")) ?: return null
        val max = nodes.number(map, path, "max")
        val min = nodes.number(map, path, "min")
        return if (max != null && min != null) SizeRange(max, min) else null
    }

    private companion object {
        val TEXT_STYLE = setOf("type", "box", "font", "weight", "size_pt")
        val ELEMENT_KEYS: Map<String, Set<String>> =
            mapOf(
                "text" to TEXT_STYLE + setOf("bind", "max_lines", "align", "overflow", "direction"),
                "caption" to TEXT_STYLE + setOf("key", "align"),
                "rows" to TEXT_STYLE + setOf("bind", "description_w_mm", "amount_w_mm"),
                "barcode" to setOf("type", "bind", "box", "symbology", "module_mm"),
                "rule" to setOf("type", "box"),
            )
        val ALIGNS = Align.entries.associateBy { it.yamlName }
        val OVERFLOWS = Overflow.entries.associateBy { it.yamlName }
        val DIRECTIONS = TextDirection.entries.associateBy { it.yamlName }
        val WEIGHTS = FontWeight.entries.associateBy { it.yamlName }
    }
}

/** A box in millimetres (`x_mm`, `y_mm`, `w_mm`, `h_mm`; spec §4.1). */
internal fun YamlNodes.box(
    node: JsonNode?,
    path: String,
): MmBox? {
    val map = mapping(node, path, setOf("x_mm", "y_mm", "w_mm", "h_mm")) ?: return null
    val x = number(map, path, "x_mm")
    val y = number(map, path, "y_mm")
    val w = number(map, path, "w_mm")
    val h = number(map, path, "h_mm")
    val complete = x != null && y != null && w != null && h != null
    return if (complete) MmBox(x, y, w, h) else null
}
