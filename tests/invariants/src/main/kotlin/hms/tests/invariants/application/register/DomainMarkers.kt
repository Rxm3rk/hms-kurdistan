package hms.tests.invariants.application.register

import java.nio.file.Files
import java.nio.file.Path

/**
 * The domain-marker trip (docs/specs/modules/state-machines-and-invariants.md §4 rule 3): while an entry says
 * NOT-BUILT, every watched path that exists and holds an entry its known list does not name is a sign that the domain
 * has arrived. A NOT-BUILT entry can therefore never outlive its domain unnoticed.
 */
object DomainMarkers {
    /** The message every trip carries (spec §4 rule 3). */
    const val TRIP_MESSAGE: String = "the domain exists: write the domain-layer test and remove the NOT-BUILT entry"

    /** The tripped watches of [entry], relative to [repositoryRoot]; empty when none trips or the entry is not NOT-BUILT. */
    fun tripped(
        entry: SiEntry,
        repositoryRoot: Path,
    ): List<String> {
        if (entry.domainLayer != DomainLayer.NOT_BUILT) return emptyList()
        return entry.domainWatch.mapNotNull { watch -> trip(watch, repositoryRoot) }
    }

    private fun trip(
        watch: DomainWatch,
        repositoryRoot: Path,
    ): String? {
        val path = repositoryRoot.resolve(watch.path)
        val unknown =
            when {
                !Files.exists(path) -> return null
                !Files.isDirectory(path) -> listOf(path.fileName.toString())
                else -> Files.list(path).use { children -> children.map { it.fileName.toString() }.toList() }.filterNot { it in watch.known }.sorted()
            }
        return when {
            watch.known.isEmpty() -> "${watch.path} exists: $TRIP_MESSAGE"
            unknown.isEmpty() -> null
            else -> "${watch.path} holds $unknown beyond the known ${watch.known}: $TRIP_MESSAGE"
        }
    }
}
