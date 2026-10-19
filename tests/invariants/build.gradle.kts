// The SI test scaffold (BUILD-PROMPT §2.1, §3.5, §18.1, §18.3, §21 WP-0.5): one named test spec per SI-01 to SI-21.
// docs/specs/modules/state-machines-and-invariants.md §4. Package hms.tests.invariants.
//
//   source set     task           what it runs                                                     tier
//   src/test       test           the scaffold's self-tests (JSON, register checks, domain-marker  fast
//                                 trip, verdicts, status files) and its ArchitectureTest
//   src/property-  propertyTest   SI01PropertyTest … SI21PropertyTest: each SI's specification-     fast (1,000 sequences);
//   Test                          layer properties over the WP-0.5 machine models, at the           nightly (10^6, step
//                                 property budget, and its domain-layer test (NOT-BUILT today,      property-1e6)
//                                 KA-060); writes build/si-status/SI-nn.json for the CI record
//
// Both tasks read the register and its sources (below) and look for the domain packages on disk (the domain-marker
// trip, spec §4 rule 3), which no task input captures: they always run.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

// The register and the records it is checked against (spec §4 rule 2), each passed as hms.invariants.<name>.
val repositoryRoot = layout.projectDirectory.dir("../..")
val scaffoldSources =
    mapOf(
        "register" to layout.projectDirectory.file("si-register.json"),
        "buildPrompt" to repositoryRoot.file("BUILD-PROMPT.md"),
        "hazardLog" to repositoryRoot.file("docs/safety/hazard-log.yaml"),
        "backlog" to repositoryRoot.file("docs/program/backlog.yaml"),
        "knownAnomalies" to repositoryRoot.file("docs/program/KNOWN-ANOMALIES.md"),
    )
val stateMachines = repositoryRoot.dir("docs/specs/state-machines")
val siStatusDirectory = layout.buildDirectory.dir("si-status")

tasks.withType<Test>().configureEach {
    scaffoldSources.forEach { (name, file) ->
        inputs.file(file).withPathSensitivity(PathSensitivity.RELATIVE).withPropertyName(name)
        systemProperty("hms.invariants.$name", file.asFile.canonicalPath)
    }
    inputs.dir(stateMachines).withPathSensitivity(PathSensitivity.RELATIVE).withPropertyName("stateMachines")
    systemProperty("hms.invariants.stateMachines", stateMachines.asFile.canonicalPath)
    systemProperty("hms.invariants.repositoryRoot", repositoryRoot.asFile.canonicalPath)
    // The domain-marker trip reads the file system (spec §4 rule 3): never up to date.
    outputs.upToDateWhen { false }
}

// The SI status files are a record of this run only (spec §4 rule 4): cleared before the SI specs run, so a file from
// an earlier run is never counted.
tasks.named<Test>("propertyTest") {
    val directory = siStatusDirectory
    systemProperty("hms.invariants.statusDir", directory.get().asFile.absolutePath)
    doFirst { directory.get().asFile.deleteRecursively() }
}
