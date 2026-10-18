// Static analysis for every backend project: detekt and ktlint (BUILD-PROMPT §4.1, §6.8, §19.1).
//
// detekt 1.23.8 runs as detekt-cli in a forked JVM through hms.buildlogic.DetektLauncher, because its
// embedded Kotlin 2.0.21 compiler cannot run inside a JVM whose version has four parts (25.0.4.1); see
// that class. The task is still called "detekt", is incremental and cacheable, and fails on any finding.

import hms.buildlogic.DetektArguments
import hms.buildlogic.DetektLauncher
import hms.buildlogic.HmsBuild
import org.jlleitschuh.gradle.ktlint.reporter.ReporterType

plugins {
    id("org.jlleitschuh.gradle.ktlint")
}

val libs = the<VersionCatalogsExtension>().named("libs")
val detektVersion: String = libs.findVersion("detekt").get().requiredVersion

val detektTool = configurations.dependencyScope("detektTool")
val detektToolClasspath =
    configurations.resolvable("detektToolClasspath") {
        extendsFrom(detektTool.get())
        // detekt embeds the Kotlin 2.0.21 compiler: pin Kotlin artefacts to that version in this
        // configuration only. The build itself compiles with the Kotlin version from the catalogue.
        val detektKotlin = libs.findVersion("detekt-kotlin").get().requiredVersion
        val reason = "detekt $detektVersion embeds Kotlin $detektKotlin"
        resolutionStrategy.eachDependency {
            if (requested.group == "org.jetbrains.kotlin") {
                useVersion(detektKotlin)
                because(reason)
            }
        }
    }

dependencies {
    "detektTool"(libs.findLibrary("detekt-cli").get())
}

val detektSourceRoots = HmsBuild.SOURCE_SETS.flatMap { listOf("src/$it/kotlin", "src/$it/java") }
val launcherClasses =
    files(
        DetektLauncher::class.java
            .protectionDomain
            .codeSource
            .location,
    )

tasks.register<JavaExec>("detekt") {
    group = "verification"
    description = "Runs detekt $detektVersion on the default rules plus config/detekt/detekt.yml (fast tier, §19.1)."
    classpath = launcherClasses + detektToolClasspath.get()
    mainClass = DetektLauncher::class.java.name
    jvmArgs("--add-opens", "java.base/java.lang=ALL-UNNAMED")
    val arguments =
        objects.newInstance<DetektArguments>().apply {
            sources.from(detektSourceRoots.map { fileTree(it) { include("**/*.kt", "**/*.kts", "**/*.java") } })
            sourceDirectories.from(detektSourceRoots)
            config = layout.settingsDirectory.file("config/detekt/detekt.yml")
            reportsDirectory = layout.buildDirectory.dir("reports/detekt")
            basePath = layout.projectDirectory
        }
    argumentProviders.add(arguments)
    outputs.cacheIf { true }
}

tasks.matching { it.name == "check" }.configureEach {
    dependsOn("detekt")
}

// ktlint-gradle keeps the previous run's findings to lint incrementally. After a run with --continue
// in which its work task came from the build cache, a deleted file's findings stayed in that state and
// failed every later run until the build directory was cleaned (seen on 2026-10-18). The lint work
// tasks therefore never reuse earlier state: they run on every build and lint every file (seconds).
tasks.matching { it.name.startsWith("runKtlintCheckOver") }.configureEach {
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("lint state must come from this run") { true }
}

ktlint {
    version = libs.findVersion("ktlint").get().requiredVersion
    ignoreFailures = false
    reporters {
        reporter(ReporterType.PLAIN)
        reporter(ReporterType.CHECKSTYLE)
    }
    // Generated sources under the build directory (later: jOOQ classes) are not linted.
    val generatedRoot =
        layout.buildDirectory
            .get()
            .asFile.absolutePath
    filter {
        exclude { element -> element.file.absolutePath.startsWith(generatedRoot) }
    }
}
