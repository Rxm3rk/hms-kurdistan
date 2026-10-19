// Domain-event contract and CloudEvents 1.0 envelope rules (BUILD-PROMPT §5.3, §8.5; ADR-009). Package hms.kernel.events.
// Specification: docs/specs/events/envelope.md and docs/specs/events/catalogue.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    api(project(":platform:ids"))
    api(project(":platform:time"))
    api(project(":platform:context"))
    testImplementation(project(":platform:testing"))
}
