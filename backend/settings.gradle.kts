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
include(":platform:ids")
include(":platform:time")
include(":platform:context")
include(":platform:money")
include(":platform:quantity")
include(":platform:events")
include(":platform:journal")

// Application modules (packages hms.<module>, hyphens become dots; §5.2, §6.1).
include(":modules:platform-tenancy")
include(":modules:platform-config")
include(":modules:platform-tasks")
include(":modules:platform-workflow")

// The modular-monolith application: assembles the modules; Spring Modulith verification (§6.8 #3).
include(":app-hms")
