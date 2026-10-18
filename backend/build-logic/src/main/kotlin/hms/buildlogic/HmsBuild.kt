package hms.buildlogic

import org.gradle.api.GradleException
import org.gradle.api.file.FileCollection
import org.gradle.api.tasks.Classpath
import org.gradle.process.CommandLineArgumentProvider

/** Names shared by the HMS convention plugins (BUILD-PROMPT §6.1, §19.1). */
object HmsBuild {
    /** The project holding the reusable ArchUnit rules (§6.8 #3). */
    const val ARCH_RULES_PROJECT = ":platform:arch-rules"

    /** Gradle property and test-JVM system property for the property-based test budget (§19.1). */
    const val PBT_SEQUENCES_PROPERTY = "hms.pbt.sequences"

    /** Fast-tier budget: about 1,000 sequences per property (§19.1). */
    const val DEFAULT_PBT_SEQUENCES = 1000

    /** Test-JVM system property naming this project's production class directories. */
    const val ARCH_CLASSES_DIRS_PROPERTY = "hms.arch.classesDirs"

    /** The project holding the shared test support, including the property-test budget. */
    const val TESTING_PROJECT = ":platform:testing"

    /** Source set and test task for property-based tests (fast tier; nightly with 10^6 sequences). */
    const val PROPERTY_TEST = "propertyTest"

    /** Source set and test task for integration tests (merge tier only). */
    const val INTEGRATION_TEST = "integrationTest"

    /** Every source set of a backend project; detekt and ktlint check all of them. */
    val SOURCE_SETS = listOf("main", "test", PROPERTY_TEST, INTEGRATION_TEST)

    private val testSuiteCount = Regex("""<testsuite [^>]*tests="(\d+)"""")

    /** Parses the property-test budget; anything but a positive integer fails the build. */
    fun parsePbtSequences(raw: String): Int =
        raw.trim().toIntOrNull()?.takeIf { it > 0 }
            ?: throw GradleException("$PBT_SEQUENCES_PROPERTY must be a positive integer, got '$raw'")

    /** The `tests` count of a JUnit XML report, or 0 when the report has none. */
    fun junitTestCount(xml: String): Int =
        testSuiteCount
            .find(xml)
            ?.groupValues
            ?.get(1)
            ?.toInt() ?: 0
}

/** Passes the production class directories to the architecture tests (§6.8 #3). */
class ArchitectureClassesArgument(
    @get:Classpath val classesDirs: FileCollection,
) : CommandLineArgumentProvider {
    override fun asArguments(): Iterable<String> = listOf("-D${HmsBuild.ARCH_CLASSES_DIRS_PROPERTY}=${classesDirs.asPath}")
}
