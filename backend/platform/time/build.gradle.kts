// The injected Clock, clinical (valid) time vs recorded time, valid periods and business calendars
// (BUILD-PROMPT §6.2, §8.1 P2 and P10, SI-10). Package hms.kernel.time. Specification: docs/specs/modules/platform-kernel.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    testImplementation(project(":platform:testing"))
}
