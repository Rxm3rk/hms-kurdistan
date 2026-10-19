package hms.kernel.archrules

import com.tngtech.archunit.base.DescribedPredicate
import com.tngtech.archunit.core.domain.JavaClass
import com.tngtech.archunit.core.domain.PackageMatcher

/**
 * Package sets that the kernel rules share (platform-kernel.md §1, §11; platform-journal.md §3).
 *
 * Every set is built from the root package, so a rule test can aim it at a fixture root. Entries that start
 * with `..` (such as `..infrastructure.persistence..`) match in any module and do not depend on the root.
 */
internal object KernelPackages {
    /** The kernel libraries of platform-kernel.md §1, as package names below `<root>.kernel`. */
    val LIBRARIES: List<String> = listOf("ids", "time", "context", "money", "quantity")

    /** ArchUnit patterns for the kernel libraries. */
    fun libraries(root: String): List<String> = LIBRARIES.map { "$root.kernel.$it.." }

    /** Resolves allow-list entries: a root-relative package becomes `<root>.<entry>..`; a `..` pattern stays. */
    fun resolve(
        root: String,
        entries: List<String>,
    ): List<String> = entries.map { if (it.startsWith("..")) it else "$root.$it.." }

    /** True when [packageName] matches one of the ArchUnit package [patterns]. */
    fun matchesAny(
        packageName: String,
        patterns: List<String>,
    ): Boolean = patterns.any { PackageMatcher.of(it).matches(packageName) }

    /** Classes in one of the ArchUnit package [patterns]. */
    fun resideInAny(patterns: List<String>): DescribedPredicate<JavaClass> =
        DescribedPredicate.describe("reside in any package $patterns") { type -> matchesAny(type.packageName, patterns) }

    /** The journal's pure model: `<root>.kernel.journal..` except `<root>.kernel.journal.infrastructure..` (journal §3). */
    fun isJournalModel(
        packageName: String,
        root: String,
    ): Boolean =
        ModuleLayout.isWithin(packageName, "$root.kernel.journal") &&
            !ModuleLayout.isWithin(packageName, "$root.kernel.journal.infrastructure")
}
