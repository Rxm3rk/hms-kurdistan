// HMS Kurdistan backend: the Gradle root (BUILD-PROMPT §6.1).

pluginManagement {
    // Convention plugins: Kotlin, detekt, ktlint and the test tiers (§6.1, §19.1).
    includeBuild("build-logic")
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    // Official registries only (§3.7); projects may not add their own repositories.
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        mavenCentral()
    }
}

rootProject.name = "hms-backend"

// Shared kernel libraries (packages hms.kernel.<lib>).
include(":platform:arch-rules")
include(":platform:testing")
