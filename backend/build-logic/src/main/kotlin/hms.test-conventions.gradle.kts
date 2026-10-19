// Test tiers for every backend project (BUILD-PROMPT §18.2, §18.3, §19.1).
//
//   source set            task             what it runs                                     tier
//   src/test              test             unit tests, including each project's             fast
//                                          ArchitectureTest (§6.8 #3)
//   src/propertyTest      propertyTest     property-based tests, hms.pbt.sequences          fast (1,000 sequences);
//                                          sequences per property (-Phms.pbt.seed=N         nightly (10^6)
//                                          replays a sequence run)
//   src/integrationTest   integrationTest  integration tests with real infrastructure       merge (compiled in fast)
//                                          (Testcontainers)
//
// Each tier has its own source set, so a task runs exactly the tests of its tier and every JUnit XML
// report counts only tests that ran. Splitting one source set by test tags does not give that: Kotest
// reports tag-excluded tests as skipped, and the JUnit Platform tag filter leaves an empty placeholder
// test in the report, so the tier counts were wrong. The property and integration source sets see the
// main code, including internal declarations, and inherit the unit-test dependencies.

import hms.buildlogic.ArchitectureClassesArgument
import hms.buildlogic.HmsBuild
import hms.buildlogic.PbtCountsDirArgument
import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension

plugins {
    java
}

val libs = the<VersionCatalogsExtension>().named("libs")

val pbtSequences: Int =
    HmsBuild.parsePbtSequences(
        providers.gradleProperty(HmsBuild.PBT_SEQUENCES_PROPERTY).getOrElse(HmsBuild.DEFAULT_PBT_SEQUENCES.toString()),
    )

val sourceSets = the<SourceSetContainer>()
val mainSourceSet = sourceSets.getByName(SourceSet.MAIN_SOURCE_SET_NAME)

// The property and integration tiers: own sources, the unit-test dependencies, the main code.
val testImplementation = configurations.getByName(JavaPlugin.TEST_IMPLEMENTATION_CONFIGURATION_NAME)
val testRuntimeOnly = configurations.getByName(JavaPlugin.TEST_RUNTIME_ONLY_CONFIGURATION_NAME)
val tierSourceSets =
    listOf(HmsBuild.PROPERTY_TEST, HmsBuild.INTEGRATION_TEST).map { name ->
        val sourceSet =
            sourceSets.create(name) {
                compileClasspath += mainSourceSet.output
                runtimeClasspath += mainSourceSet.output
            }
        configurations.getByName(sourceSet.implementationConfigurationName).extendsFrom(testImplementation)
        configurations.getByName(sourceSet.runtimeOnlyConfigurationName).extendsFrom(testRuntimeOnly)
        sourceSet
    }

// Like src/test, the tier source sets may use the main code's internal declarations.
pluginManager.withPlugin("org.jetbrains.kotlin.jvm") {
    val compilations = the<KotlinJvmProjectExtension>().target.compilations
    val mainCompilation = compilations.getByName(SourceSet.MAIN_SOURCE_SET_NAME)
    val tierNames = tierSourceSets.map { it.name }.toSet()
    compilations.matching { it.name in tierNames }.configureEach {
        associateWith(mainCompilation)
    }
}

dependencies {
    "testImplementation"(platform(libs.findLibrary("junit-bom").get()))
    "testImplementation"(libs.findLibrary("junit-jupiter").get())
    "testRuntimeOnly"(libs.findLibrary("junit-platform-launcher").get())
    "testImplementation"(libs.findBundle("kotest").get())
    if (path != HmsBuild.ARCH_RULES_PROJECT) {
        "testImplementation"(project(HmsBuild.ARCH_RULES_PROJECT))
    }
    // Property tests take their sequence count from hms.kernel.testing.PropertyTestBudget.
    if (path != HmsBuild.TESTING_PROJECT) {
        "${HmsBuild.PROPERTY_TEST}Implementation"(project(HmsBuild.TESTING_PROJECT))
    }
}

// -Phms.pbt.seed=N fixes the master seed of every state-machine sequence run, to replay a failure exactly
// (docs/specs/modules/state-machines-and-invariants.md §3.3: "a failure prints the seed that reproduces it").
val pbtSeedProperty = "hms.pbt.seed"
val pbtSeed: Long? =
    providers.gradleProperty(pbtSeedProperty).orNull?.takeIf { it.isNotBlank() }?.let { raw ->
        raw.trim().toLongOrNull()
            ?: throw GradleException("-P$pbtSeedProperty must be a whole number (a master seed a failed run printed), got '$raw'")
    }

val mainClassesDirs = mainSourceSet.output.classesDirs

// The testFixtures classes (the <P>Arbs facts generators), checked by the ArchitectureTest template for system-clock
// reads and unseeded randomness (spec §3.1, §3.3). Empty for a project without the java-test-fixtures plugin.
val testFixturesClassesDirs = objects.fileCollection()
pluginManager.withPlugin("java-test-fixtures") {
    testFixturesClassesDirs.from(sourceSets.getByName(HmsBuild.TEST_FIXTURES).output.classesDirs)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    systemProperty(HmsBuild.PBT_SEQUENCES_PROPERTY, pbtSequences)
    if (pbtSeed != null) systemProperty(pbtSeedProperty, pbtSeed)
    // The harness prints a replay command naming this task.
    systemProperty("hms.pbt.testTask", path)
    jvmArgumentProviders.add(ArchitectureClassesArgument(files(mainClassesDirs)))

    // The sequence harness writes <name>.json here: the actual sequence counts of each run (§19.1). One directory per
    // test task, declared as the task's output (so a cached result restores it) and emptied before the task runs (so
    // no file of a renamed or removed test survives).
    val countsDir = layout.buildDirectory.dir("${HmsBuild.PBT_COUNTS_DIR}/$name")
    jvmArgumentProviders.add(PbtCountsDirArgument(countsDir))
    outputs.dir(countsDir).withPropertyName("pbtCounts")

    val fixturesDirs = testFixturesClassesDirs
    inputs
        .files(fixturesDirs)
        .withPropertyName("archTestFixturesClasses")
        .withNormalizer(ClasspathNormalizer::class.java)
    doFirst {
        countsDir.get().asFile.deleteRecursively()
        (this as Test).systemProperty("hms.arch.testFixturesClassesDirs", fixturesDirs.asPath)
    }

    reports {
        junitXml.required = true
        html.required = true
    }
    testLogging {
        events("failed")
        exceptionFormat = TestExceptionFormat.FULL
    }
}

val unitTest =
    tasks.named<Test>(JavaPlugin.TEST_TASK_NAME) {
        description = "Runs the unit and architecture tests in src/test (fast tier, §19.1)."
    }

val tierTests =
    tierSourceSets.map { sourceSet ->
        tasks.register<Test>(sourceSet.name) {
            group = "verification"
            testClassesDirs = sourceSet.output.classesDirs
            classpath = sourceSet.runtimeClasspath
            shouldRunAfter(unitTest)
        }
    }
val (propertyTest, integrationTest) = tierTests

propertyTest.configure {
    description =
        "Runs the property-based tests in src/${HmsBuild.PROPERTY_TEST} with $pbtSequences sequences each " +
        "(fast tier: 1,000; nightly: 10^6; §19.1)."
}

integrationTest.configure {
    description = "Runs the integration tests in src/${HmsBuild.INTEGRATION_TEST} (merge tier, §19.1; not in the fast tier)."
    shouldRunAfter(propertyTest)
}

tasks.named("check") {
    dependsOn(tierTests)
}

// Every project with production code must run an ArchitectureTest that applies the shared rules (§6.8 #3).
val testResultsDir = layout.buildDirectory.dir("test-results/${JavaPlugin.TEST_TASK_NAME}")
val mainKotlinSources = fileTree("src/main/kotlin") { include("**/*.kt") }
val owningProjectPath = path
tasks.register("verifyArchitectureTest") {
    group = "verification"
    description = "Fails unless this project's ArchitectureTest ran in the test task (§6.8 #3)."
    dependsOn(unitTest)
    val results = testResultsDir
    val sources = mainKotlinSources
    val projectPath = owningProjectPath
    doLast {
        if (sources.isEmpty) return@doLast
        val reports =
            results
                .get()
                .asFile
                .listFiles { file -> file.name.startsWith("TEST-") && file.name.endsWith(".ArchitectureTest.xml") }
                .orEmpty()
        val executed = reports.sumOf { report -> HmsBuild.junitTestCount(report.readText()) }
        if (executed == 0) {
            throw GradleException(
                "$projectPath has production code but no ArchitectureTest ran in :test. " +
                    "Add src/test/kotlin/.../ArchitectureTest.kt applying HmsArchitectureRules (BUILD-PROMPT §6.8).",
            )
        }
        logger.lifecycle("$projectPath: ArchitectureTest ran $executed rule checks")
    }
}
