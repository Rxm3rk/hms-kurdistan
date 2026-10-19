// The clinical scenario-suite framework (BUILD-PROMPT §18.5; nightly release gates).
// docs/specs/modules/state-machines-and-invariants.md §5. Package hms.tests.scenarios.
//
//   task             what it runs                                                  tier
//   test             the framework's self-tests and its ArchitectureTest           fast (fastTier collects it)
//   scenarioSuites   every catalogued suite; writes build/reports/scenarios/       nightly (§19.1; not in fastTier)
//                    pass-matrix.json and pass-matrix.md, then fails unless every
//                    suite is bound and passes (fail closed: ten NOT-BUILT today)

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

// The self-tests check the catalogue against its sources: the hazard log, BUILD-PROMPT §18.5 and §21, and the
// backlog. Each file is an input of the test task and reaches the test JVM as a system property.
val catalogueSources =
    mapOf(
        "hazardLog" to "docs/safety/hazard-log.yaml",
        "buildPrompt" to "BUILD-PROMPT.md",
        "backlog" to "docs/program/backlog.yaml",
    ).mapValues { (_, path) -> layout.projectDirectory.file("../../$path") }
tasks.named<Test>("test") {
    catalogueSources.forEach { (name, file) ->
        inputs.file(file).withPathSensitivity(PathSensitivity.RELATIVE).withPropertyName(name)
        systemProperty("hms.scenarios.$name", file.asFile.canonicalPath)
    }
}

// The nightly step `scenario-suites` runs this task and reads the matrix (§19.1). It always runs: a matrix from an
// earlier run is never evidence for this one.
val mainRuntimeClasspath = the<SourceSetContainer>().named(SourceSet.MAIN_SOURCE_SET_NAME).map { it.runtimeClasspath }
tasks.register<JavaExec>("scenarioSuites") {
    group = "verification"
    description =
        "Runs every §18.5 scenario suite and writes the pass matrix linked to hazards (nightly tier, §19.1); " +
        "fails while any suite is NOT-BUILT or failing."
    classpath(mainRuntimeClasspath)
    mainClass = "hms.tests.scenarios.application.runner.ScenarioSuitesMain"
    // The console lines quote BUILD-PROMPT sections (§); Gradle reads the output as UTF-8.
    jvmArgs("-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8")
    val matrixDirectory = layout.buildDirectory.dir("reports/scenarios")
    outputs.dir(matrixDirectory).withPropertyName("passMatrix")
    outputs.upToDateWhen { false }
    argumentProviders.add(CommandLineArgumentProvider { listOf("--output", matrixDirectory.get().asFile.absolutePath) })
}
