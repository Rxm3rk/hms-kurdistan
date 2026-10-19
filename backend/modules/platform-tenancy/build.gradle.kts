// platform-tenancy: enterprise hierarchy, configuration chain and locks (BUILD-PROMPT §5.2, §6.6, §7 item 1;
// PLT-CORE-02). Package hms.platform.tenancy. Specification: docs/specs/modules/platform-tenancy.md.

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
