// pdfa-verify: the PDF/A-2b checker for the golden step (docs/specs/modules/platform-docs.md §1, §7.5,
// §10; PdfaCheck:veraPDF-2b). Package hms.satellites.pdfaverify.
//
// BUILD-ONLY: this project is a build and CI tool. It is never packaged into an image, chart, bundle or
// any other artefact delivered to a site (BUILD-PROMPT §4.3, tools/licence/policy.yaml scope
// "build-only"). veraPDF is used under its MPL-2.0 option. Pins, licences and hashes: README.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    implementation(libs.verapdf.core)
    implementation(libs.verapdf.validation.model)
    constraints {
        // veraPDF's XML code (org.verapdf.core.XmlSerialiser) uses javax.xml.bind. The Spring Boot BOM
        // (applied by hms.kotlin-conventions) would raise these to the 4.x line, which implements only
        // jakarta.xml.bind; keep veraPDF's own pins.
        implementation(libs.verapdf.jaxb.impl) {
            version { strictly(libs.versions.verapdf.jaxb.impl.get()) }
            because("veraPDF 1.30.3 needs the javax.xml.bind JAXB 2.3 implementation")
        }
        implementation(libs.verapdf.jaxb.core) {
            version { strictly(libs.versions.verapdf.jaxb.core.get()) }
            because("veraPDF 1.30.3 needs the javax.xml.bind JAXB 2.3 implementation")
        }
    }
}

val pdfaVerifyMain = "hms.satellites.pdfaverify.PdfaVerifyCliKt"

// The golden step and a developer run the checker on a PDF, or on every PDF in a directory:
//   gradlew -p backend :satellites:pdfa-verify:verifyPdfa -PpdfaInput=<file-or-directory>
// The task fails when any file is not PDF/A-2b or cannot be read (fail closed).
tasks.register<JavaExec>("verifyPdfa") {
    group = "verification"
    description = "Validates -PpdfaInput=<file-or-directory> against PDF/A-2b with veraPDF (spec §10; fails closed)."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = pdfaVerifyMain
    val input = providers.gradleProperty("pdfaInput")
    // Resolve a relative path against the directory Gradle was started from, not the project directory.
    val startDirectory = gradle.startParameter.currentDir
    argumentProviders.add(
        CommandLineArgumentProvider {
            val raw =
                input.orNull?.takeIf { it.isNotBlank() }
                    ?: throw GradleException("verifyPdfa needs -PpdfaInput=<PDF file or directory>")
            listOf(startDirectory.resolve(raw).absolutePath)
        },
    )
}
