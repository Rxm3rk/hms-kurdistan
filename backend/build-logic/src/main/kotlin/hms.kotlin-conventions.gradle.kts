// Kotlin on the JVM for every backend project (BUILD-PROMPT §4.1, §6.2).

import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("org.jetbrains.kotlin.jvm")
}

val libs = the<VersionCatalogsExtension>().named("libs")

// Distinct coordinates per directory, so same-named projects in different groups never collide.
val parentPath = project.parent?.path ?: ":"
group = if (parentPath == ":") "hms.backend" else "hms.backend" + parentPath.replace(':', '.')

kotlin {
    jvmToolchain(
        libs
            .findVersion("java")
            .get()
            .requiredVersion
            .toInt(),
    )
    compilerOptions {
        jvmTarget = JvmTarget.JVM_25
        allWarningsAsErrors = true
        freeCompilerArgs.add("-Xjsr305=strict")
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.compilerArgs.addAll(listOf("-Xlint:all", "-Werror"))
}

dependencies {
    // One version set for every backend project: the Spring Boot BOM (§4.1).
    "implementation"(platform(libs.findLibrary("spring-boot-bom").get()))
}
