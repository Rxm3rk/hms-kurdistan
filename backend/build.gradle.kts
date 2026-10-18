// Backend root build: the fast-tier aggregate (BUILD-PROMPT §19.1) and linting of the root scripts.

plugins {
    id("hms.quality-conventions")
}

// What every project contributes to the fast tier (§19.1): compilation of every source set (the
// integration tests are compiled here and run in the merge tier), detekt, ktlint, the unit tests (each
// project's ArchitectureTest runs among them, §6.8), the short property-based runs, and the check that
// the architecture tests actually ran.
val fastTierTaskNames =
    setOf(
        "classes",
        "testClasses",
        "propertyTestClasses",
        "integrationTestClasses",
        "detekt",
        "ktlintCheck",
        "test",
        "propertyTest",
        "verifyArchitectureTest",
    )

val requiredConventions = listOf("hms.kotlin-conventions", "hms.quality-conventions", "hms.test-conventions")

// A project with sources that skips the conventions would silently skip the fast tier: fail instead.
val projectsMissingConventions =
    provider {
        subprojects
            .filter { project -> project.file("src").isDirectory }
            .filterNot { project -> requiredConventions.all { project.pluginManager.hasPlugin(it) } }
            .map { it.path }
    }

val verifyProjectConventions =
    tasks.register("verifyProjectConventions") {
        group = "verification"
        description = "Fails if a backend project with sources does not apply ${requiredConventions.joinToString()}."
        val offenders = projectsMissingConventions
        doLast {
            val missing = offenders.get()
            if (missing.isNotEmpty()) {
                throw GradleException("Projects without the HMS conventions: ${missing.joinToString()}")
            }
        }
    }

tasks.register("fastTier") {
    group = "verification"
    description = "Backend fast tier (§19.1): compile, detekt, ktlint, unit, property and architecture tests of every project."
    dependsOn(verifyProjectConventions)
    allprojects.forEach { project ->
        dependsOn(project.tasks.matching { it.name in fastTierTaskNames })
    }
    dependsOn(gradle.includedBuild("build-logic").task(":ktlintCheck"))
}
