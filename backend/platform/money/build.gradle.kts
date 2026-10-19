// Money: BigDecimal plus an ISO 4217 currency, explicit rounding, never floating point (BUILD-PROMPT §6.2).
// Package hms.kernel.money. Specification: docs/specs/modules/platform-kernel.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    api(project(":platform:time"))
    testImplementation(project(":platform:testing"))
}
