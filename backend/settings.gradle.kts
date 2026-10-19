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
include(":platform:state-machine")

// Application modules (packages hms.<module>). WP-0.5 creates each owning module of a §8.4 state machine
// with only its state-machine domain packages; the work package that builds the module adds the rest
// (docs/specs/modules/state-machines-and-invariants.md §3.1, OQ-201).
include(":modules:adt")
include(":modules:lis")
include(":modules:medications")
include(":modules:orders")
include(":modules:results")
include(":modules:scheduling")

// Satellites (ADR-003): RCM holds the credit-claim machine's domain package.
include(":satellites:rcm")

// Cross-module tests at the repository root (BUILD-PROMPT §6.1, tests/README.md): the SI test scaffold and
// the scenario-suite framework (§18.5). They build in tests/<name>/build, outside backend/.
include(":tests:invariants")
include(":tests:scenarios")
project(":tests").projectDir = file("../tests")
project(":tests:invariants").projectDir = file("../tests/invariants")
project(":tests:scenarios").projectDir = file("../tests/scenarios")
