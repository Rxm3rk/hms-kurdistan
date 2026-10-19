// Quantity with UCUM units, DoseQuantity and the one audited comparison API (BUILD-PROMPT §2.1 SI-05, §6.2, §6.8 #1).
// Package hms.kernel.quantity. Specification: docs/specs/modules/platform-kernel.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    testImplementation(project(":platform:testing"))
}
