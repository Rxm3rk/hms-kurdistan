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

// Application modules (packages hms.<module>, BUILD-PROMPT §5.2, §6.1).
include(":modules:platform-docs")

// Satellites (packages hms.satellites.<name>). pdfa-verify is a build-only tool and never ships
// (docs/specs/modules/platform-docs.md §1, §10).
include(":satellites:pdfa-verify")
