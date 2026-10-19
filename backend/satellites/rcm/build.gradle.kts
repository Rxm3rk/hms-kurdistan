// The rcm satellite (BUILD-PROMPT §5.2, ADR-003): accounts, ledger, credit contracts, pre-approvals and claims.
// WP-0.5 adds only the credit-claim state-machine domain package (docs/specs/modules/state-machines-and-invariants.md
// §3.1, OQ-201). Package hms.rcm.

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
