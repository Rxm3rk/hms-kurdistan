// The medications module (BUILD-PROMPT §5.2): eMAR and BCMA among others. WP-0.5 adds only the
// medication-administration state-machine domain package (docs/specs/modules/state-machines-and-invariants.md §3.1, OQ-201).
// Package hms.medications.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
    // Test fixtures hold the machines' facts generators, shared by this module's property tests and the
    // SI scaffold in tests/invariants (state-machines-and-invariants.md §3.3).
    `java-test-fixtures`
}

dependencies {
    // The generated machine models expose MachineSpec and Outcome in their public types.
    api(project(":platform:state-machine"))
    testFixturesApi(libs.kotest.property)
}
