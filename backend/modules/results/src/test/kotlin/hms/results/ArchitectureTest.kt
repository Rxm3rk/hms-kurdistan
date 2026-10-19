package hms.results

import com.tngtech.archunit.base.DescribedPredicate
import com.tngtech.archunit.core.domain.JavaAccess
import com.tngtech.archunit.core.domain.JavaCall
import com.tngtech.archunit.core.domain.JavaClass
import com.tngtech.archunit.core.domain.JavaClasses
import com.tngtech.archunit.core.importer.ClassFileImporter
import com.tngtech.archunit.lang.ArchRule
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses
import hms.kernel.archrules.HmsArchitectureRules
import hms.kernel.archrules.ProjectArchitecture
import io.kotest.core.spec.style.FunSpec
import java.io.File
import java.nio.file.Files
import java.nio.file.Path

/**
 * This project's production code obeys the shared HMS architecture rules (BUILD-PROMPT §6.8 #3), and its domain code is
 * deterministic: main domain code uses no randomness at all, and test-fixture domain code (the `<P>Arbs` facts
 * generators) reads no system clock and uses no unseeded randomness, so that a sequence seed replays a failure
 * (docs/specs/modules/state-machines-and-invariants.md §3.1 "pure function", §3.3 "sequences come from seeds").
 *
 * This file is the template: every backend project copies it to `src/test/kotlin/<its base package>/ArchitectureTest.kt`
 * and changes only the package line. `hms.test-conventions` passes the main class directories and the testFixtures
 * class directories (empty without the `java-test-fixtures` plugin) to the test JVM.
 */
class ArchitectureTest :
    FunSpec({
        val classes = ProjectArchitecture.importProductionClasses()

        (HmsArchitectureRules.all() + DomainDeterminism.noRandomness()).forEach { rule ->
            test(rule.description) { rule.check(classes) }
        }

        val fixtures = DomainDeterminism.importTestFixturesClasses()
        DomainDeterminism.testFixturesRules().forEach { rule ->
            test("test fixtures: ${rule.description}") { rule.check(fixtures) }
        }
    })

/**
 * The determinism rules of the template above (spec §3.1, §3.3; BUILD-PROMPT §6.2). Proposed for
 * `HmsArchitectureRules` as rules (e) and (f); until then each project's copy of this file carries them.
 */
internal object DomainDeterminism {
    /** Set by hms.test-conventions: the project's testFixtures class directories, empty when it has none. */
    const val TEST_FIXTURES_CLASSES_DIRS_PROPERTY: String = "hms.arch.testFixturesClassesDirs"

    private const val CONSTRUCTOR = "<init>"

    /** Types whose every use is randomness; a main domain class never depends on them. */
    private val randomTypes: Set<String> =
        setOf(
            "java.util.Random",
            "java.util.SplittableRandom",
            "java.util.concurrent.ThreadLocalRandom",
            "java.security.SecureRandom",
            "java.util.random.RandomGenerator",
        )

    /** Types that are random whatever the caller passes (no reproducible seed). */
    private val unseedableTypes: Set<String> = setOf("java.util.concurrent.ThreadLocalRandom", "java.security.SecureRandom")

    /** Types whose no-argument constructor seeds itself from the system. */
    private val selfSeedingConstructors: Set<String> = setOf("java.util.Random", "java.util.SplittableRandom")

    /** Methods that draw from a hidden, unseeded generator, by `owner#name`, with the parameter count of that overload. */
    private val unseededMethods: Map<String, Int> =
        mapOf(
            "java.lang.Math#random" to 0,
            "java.lang.StrictMath#random" to 0,
            "java.util.UUID#randomUUID" to 0,
            "java.util.Collections#shuffle" to 1,
            "kotlin.collections.CollectionsKt#shuffled" to 1,
            "kotlin.collections.ArraysKt#shuffle" to 1,
            "kotlin.sequences.SequencesKt#shuffled" to 1,
        )

    private val unseededAccess: DescribedPredicate<JavaAccess<*>> =
        DescribedPredicate.describe(
            "use unseeded randomness (kotlin.random.Random.Default, java.util.Random(), SplittableRandom(), Math.random, " +
                "ThreadLocalRandom, SecureRandom, UUID.randomUUID, shuffle without a Random)",
        ) { access -> isUnseeded(access) }

    private val randomType: DescribedPredicate<JavaClass> =
        DescribedPredicate.describe("are random generators (kotlin.random.., ${randomTypes.sorted()})") { type ->
            type.packageName == "kotlin.random" || type.fullName in randomTypes
        }

    /** (e) Main domain code uses no randomness: predicates and aggregates are pure functions of their inputs (§3.1). */
    fun noRandomness(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule =
        noClasses()
            .that()
            .resideInAPackage("$root..domain..")
            .should()
            .dependOnClassesThat(randomType)
            .orShould()
            .accessTargetWhere(unseededAccess)
            .because("domain predicates are pure functions of the facts (spec §3.1); identifiers and choices arrive as data")
            .allowEmptyShould(true)

    /** (f) Test-fixture domain code (facts generators) uses no unseeded randomness, so a seed replays a run (§3.3). */
    fun noUnseededRandomness(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule =
        noClasses()
            .that()
            .resideInAPackage("$root..domain..")
            .should()
            .accessTargetWhere(unseededAccess)
            .because("facts generators draw only from the RandomSource they are given, so a sequence seed replays a failure (spec §3.3)")
            .allowEmptyShould(true)

    /** The rules every testFixtures domain class obeys: no system clock (rule (d)) and no unseeded randomness. */
    fun testFixturesRules(root: String = HmsArchitectureRules.ROOT_PACKAGE): List<ArchRule> =
        listOf(HmsArchitectureRules.domainDoesNotReadTheSystemClock(root), noUnseededRandomness(root))

    /** Imports the classes of the directories in [raw]; fails when the property is absent (not run through Gradle). */
    fun importTestFixturesClasses(raw: String? = System.getProperty(TEST_FIXTURES_CLASSES_DIRS_PROPERTY)): JavaClasses {
        checkNotNull(raw) {
            "$TEST_FIXTURES_CLASSES_DIRS_PROPERTY is not set: run the architecture tests through Gradle (hms.test-conventions sets it)"
        }
        val directories =
            raw
                .split(File.pathSeparatorChar)
                .filter { it.isNotBlank() }
                .map { Path.of(it) }
                .filter { Files.isDirectory(it) }
        return ClassFileImporter().importPaths(directories)
    }

    private fun isUnseeded(access: JavaAccess<*>): Boolean {
        val target = access.target
        val owner = target.owner.fullName
        val parameters = (access as? JavaCall<*>)?.target?.rawParameterTypes?.size
        return when {
            owner == "kotlin.random.Random" && target.name == "Default" -> true
            owner == "kotlin.random.Random\$Default" -> true
            owner in unseedableTypes -> true
            target.name == CONSTRUCTOR && owner in selfSeedingConstructors -> parameters == 0
            else -> unseededMethods["$owner#${target.name}"]?.let { it == parameters } ?: false
        }
    }
}
