// platform-docs: documents and printing (BUILD-PROMPT §5.2, §7 item 11, §12.8; WP-0.8).
// Package hms.platform.docs. Specification: docs/specs/modules/platform-docs.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    implementation(platform(libs.jackson.bom))
    implementation(libs.jackson.databind)
    implementation(libs.jackson.module.kotlin)
    implementation(libs.jackson.dataformat.yaml)
    implementation(libs.zxing.core)
}

// The print templates are content (§6.6, §19.4): the tests read every file under content/print-templates.
val printTemplatesDir = rootProject.layout.projectDirectory.dir("../content/print-templates")

tasks.withType<Test>().configureEach {
    systemProperty("hms.docs.templatesDir", printTemplatesDir.asFile.absolutePath)
    inputs.dir(printTemplatesDir).withPropertyName("printTemplates").optional()
    // Candidate golden images and fixtures are written here, never over the approved files (spec §10).
    systemProperty("hms.docs.candidatesDir", layout.buildDirectory.dir("golden-candidates").get().asFile.absolutePath)
    // Headless Java2D for shaping and rasterising (no display on CI hosts).
    systemProperty("java.awt.headless", "true")
}
