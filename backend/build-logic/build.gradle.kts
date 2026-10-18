// Precompiled Kotlin-DSL convention plugins for the backend (BUILD-PROMPT §6.1):
//   hms.kotlin-conventions   Kotlin on JDK 25, warnings as errors
//   hms.quality-conventions  detekt (forked detekt-cli) and ktlint
//   hms.test-conventions     JUnit Platform test tiers, one source set per tier

plugins {
    `kotlin-dsl`
    alias(libs.plugins.ktlint)
}

kotlin {
    compilerOptions {
        allWarningsAsErrors = true
    }
}

ktlint {
    version = libs.versions.ktlint.asProvider()
    // The Kotlin DSL accessors generated under build/ are not linted.
    val generatedRoot =
        layout.buildDirectory
            .get()
            .asFile.absolutePath
    filter {
        exclude { element -> element.file.absolutePath.startsWith(generatedRoot) }
    }
}

dependencies {
    implementation(libs.kotlin.gradle.plugin)
    implementation(libs.ktlint.gradle.plugin)
}
