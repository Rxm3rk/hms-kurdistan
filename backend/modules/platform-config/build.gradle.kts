// platform-config: typed registry, change sets, signed bundles, promotion, three-way merge, flags and kill
// switches (BUILD-PROMPT §5.2, §6.6, §19.4; PLT-CFG-01; SI-19; ADR-020). Package hms.platform.config.
// Specification: docs/specs/modules/platform-config.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    api(project(":platform:ids"))
    api(project(":platform:time"))
    api(project(":platform:context"))
    api(project(":modules:platform-tenancy"))
    testImplementation(project(":platform:testing"))
}
