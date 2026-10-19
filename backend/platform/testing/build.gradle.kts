// Shared test support for every backend project (BUILD-PROMPT §18.2, §18.3, §19.1).
// Package hms.kernel.testing; the state-machine sequence harness in hms.kernel.testing.statemachine
// (docs/specs/modules/state-machines-and-invariants.md §3.3).

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    // The harness drives the engine and exposes its types (MachineSpec, Outcome) in its API.
    api(project(":platform:state-machine"))
    // Its API uses Kotest types: Arb and RandomSource (property), TestFactory and funSpec (framework engine).
    api(libs.kotest.property)
    api(libs.kotest.framework.engine)
}
