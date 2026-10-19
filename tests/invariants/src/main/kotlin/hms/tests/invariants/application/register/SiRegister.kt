package hms.tests.invariants.application.register

import hms.tests.invariants.application.json.Json

/**
 * The SI register, `tests/invariants/si-register.json` (docs/specs/modules/state-machines-and-invariants.md §4): one
 * entry per safety invariant SI-01…SI-21 (BUILD-PROMPT §2.1), in order.
 */
data class SiRegister(
    val version: Long,
    val entries: List<SiEntry>,
) {
    /** The entry of [si] ("SI-02"); fails when the register has none. */
    fun entry(si: String): SiEntry = entries.singleOrNull { it.si == si } ?: throw IllegalArgumentException("the SI register has no entry for $si")

    companion object {
        /** The register format this scaffold reads. */
        const val VERSION: Long = 1

        /** The number of safety invariants in BUILD-PROMPT §2.1. */
        const val SI_COUNT: Int = 21

        /** SI-01 … SI-21. */
        val SI_IDS: List<String> = (1..SI_COUNT).map { "SI-%02d".format(it) }

        /** Reads a register document; an unknown, missing or mistyped key is an error, so a typo never passes silently. */
        fun parse(text: String): SiRegister {
            val document = Fields(Json.parse(text), "register")
            document.only("version", "description", "entries")
            val version = document.long("version")
            require(version == VERSION) { "register version $version is not $VERSION" }
            document.string("description")
            return SiRegister(version, document.objects("entries").mapIndexed { index, it -> SiEntry.parse(it, "entries[$index]") })
        }
    }
}

/** Whether an SI's domain layer exists (spec §4): only NOT-BUILT is reachable while no domain-layer test exists. */
enum class DomainLayer(
    val label: String,
) {
    NOT_BUILT("NOT-BUILT"),
    BUILT("BUILT"),
    ;

    companion object {
        fun of(label: String): DomainLayer =
            entries.singleOrNull { it.label == label } ?: throw IllegalArgumentException("domain_layer must be NOT-BUILT or BUILT, got '$label'")
    }
}

/**
 * One SI of the register.
 *
 * @property si "SI-nn".
 * @property title The invariant's text, verbatim from BUILD-PROMPT §2.1.
 * @property enforcedIn §2.1's "Enforced in" column, verbatim.
 * @property hazards The hazard-log entries whose `invariants` name this SI.
 * @property plannedTest The umbrella test name the hazard log plans (`PropertyTest:SI-nn-*`).
 * @property plannedTests Every `PropertyTest:` name the SI's hazard entries plan, qualifiers removed.
 * @property specLayer The specification-layer properties the scaffold runs for this SI (empty when no machine encodes it).
 * @property domainLayer NOT-BUILT while the domain that enforces the SI does not exist.
 * @property waitsOn The §21 work package (or §21 phase) that builds the domain.
 * @property backlog Backlog feature IDs of [waitsOn] that the SI's hazard entries list.
 * @property knownAnomaly The known anomaly that lists the not-built domain layers (KA-060).
 * @property domainMarker The domain package that will enforce the SI; equals the first [domainWatch] path.
 * @property domainWatch Paths that trip the domain-layer test while it says NOT-BUILT.
 */
data class SiEntry(
    val si: String,
    val title: String,
    val titleSource: String,
    val enforcedIn: String,
    val hazards: List<String>,
    val plannedTest: String,
    val plannedTests: List<String>,
    val specLayer: List<SpecLayerProperty>,
    val domainLayer: DomainLayer,
    val waitsOn: String,
    val waitsOnSource: String,
    val backlog: List<String>,
    val knownAnomaly: String,
    val domainMarker: String,
    val domainWatch: List<DomainWatch>,
) {
    /** The domain-layer test's name, which carries its status (spec §4 rule 1). */
    val domainTestName: String
        get() =
            when (domainLayer) {
                DomainLayer.NOT_BUILT -> "$si domain layer NOT-BUILT (waits on $waitsOn; $knownAnomaly)"
                DomainLayer.BUILT -> "$si domain layer BUILT"
            }

    internal companion object {
        private val KEYS =
            setOf(
                "si", "title", "title_source", "enforced_in", "hazards", "planned_test", "planned_tests", "spec_layer",
                "domain_layer", "waits_on", "waits_on_source", "backlog", "ka", "domain_marker", "domain_watch",
            )

        fun parse(
            raw: Map<String, Any?>,
            where: String,
        ): SiEntry {
            val fields = Fields(raw, where)
            fields.only(KEYS)
            return SiEntry(
                si = fields.string("si"),
                title = fields.string("title"),
                titleSource = fields.string("title_source"),
                enforcedIn = fields.string("enforced_in"),
                hazards = fields.strings("hazards"),
                plannedTest = fields.string("planned_test"),
                plannedTests = fields.strings("planned_tests"),
                specLayer = fields.objects("spec_layer").mapIndexed { index, it -> SpecLayerProperty.parse(it, "$where.spec_layer[$index]") },
                domainLayer = DomainLayer.of(fields.string("domain_layer")),
                waitsOn = fields.string("waits_on"),
                waitsOnSource = fields.string("waits_on_source"),
                backlog = fields.strings("backlog"),
                knownAnomaly = fields.string("ka"),
                domainMarker = fields.string("domain_marker"),
                domainWatch = fields.objects("domain_watch").mapIndexed { index, it -> DomainWatch.parse(it, "$where.domain_watch[$index]") },
            )
        }
    }
}

/**
 * A specification-layer property of an SI: a property over random command sequences of a WP-0.5 machine model (spec §4).
 *
 * @property machine The machine (`docs/specs/state-machines/<machine>.yaml`).
 * @property property The test name the hazard log plans for it (`PropertyTest:SI-nn-...`).
 * @property clauses The ids of the SI's hazard-log clauses (`invariant_clauses`) the property covers, at this layer only.
 * @property covers What the machine encodes of those clauses, in prose: the claim, and no more.
 */
data class SpecLayerProperty(
    val machine: String,
    val property: String,
    val clauses: List<String>,
    val covers: String,
) {
    internal companion object {
        fun parse(
            raw: Map<String, Any?>,
            where: String,
        ): SpecLayerProperty {
            val fields = Fields(raw, where)
            fields.only("machine", "property", "clauses", "covers")
            return SpecLayerProperty(fields.string("machine"), fields.string("property"), fields.strings("clauses"), fields.string("covers"))
        }
    }
}

/**
 * A watched path (repository-relative). It trips while the SI says NOT-BUILT when the path exists and holds an entry
 * that [known] does not name; with an empty [known] it trips as soon as it exists.
 */
data class DomainWatch(
    val path: String,
    val known: List<String>,
) {
    internal companion object {
        fun parse(
            raw: Map<String, Any?>,
            where: String,
        ): DomainWatch {
            val fields = Fields(raw, where)
            fields.only("path", "known")
            return DomainWatch(fields.string("path"), fields.strings("known"))
        }
    }
}

/** Typed access to one JSON object of the register; every error names where it is. */
private class Fields(
    raw: Any?,
    private val where: String,
) {
    private val map: Map<String, Any?> =
        (raw as? Map<*, *>)?.entries?.associate { (key, value) -> key as String to value }
            ?: throw IllegalArgumentException("$where: expected a JSON object")

    fun only(vararg keys: String) = only(keys.toSet())

    fun only(keys: Set<String>) {
        val unknown = map.keys - keys
        val missing = keys - map.keys - OPTIONAL
        require(unknown.isEmpty()) { "$where: unknown keys $unknown" }
        require(missing.isEmpty()) { "$where: missing keys $missing" }
    }

    fun string(key: String): String =
        (map[key] as? String)?.takeIf { it.isNotBlank() } ?: throw IllegalArgumentException("$where.$key: expected a non-empty string")

    fun long(key: String): Long = map[key] as? Long ?: throw IllegalArgumentException("$where.$key: expected an integer")

    fun strings(key: String): List<String> {
        val list = map[key] as? List<*> ?: throw IllegalArgumentException("$where.$key: expected a list of strings")
        return list.map { (it as? String)?.takeIf { value -> value.isNotBlank() } ?: throw IllegalArgumentException("$where.$key: expected non-empty strings") }
    }

    fun objects(key: String): List<Map<String, Any?>> {
        val list = map[key] as? List<*> ?: throw IllegalArgumentException("$where.$key: expected a list of objects")
        return list.map { item ->
            (item as? Map<*, *>)?.entries?.associate { (k, v) -> k as String to v } ?: throw IllegalArgumentException("$where.$key: expected objects")
        }
    }

    private companion object {
        val OPTIONAL = emptySet<String>()
    }
}
