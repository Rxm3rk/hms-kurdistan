// UUIDv7 identifiers (RFC 9562) from an injected generator (BUILD-PROMPT §5.3, §8.3). Package hms.kernel.ids.
// Specification: docs/specs/modules/platform-kernel.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    testImplementation(project(":platform:testing"))
}
