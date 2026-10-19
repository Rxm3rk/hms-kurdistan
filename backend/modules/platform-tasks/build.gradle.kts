// platform-tasks (Safety Kernel): tasks, owners, SLA timers, escalation chains and TaskOrphaned (BUILD-PROMPT §5.2,
// §7 item 4; PLT-CORE-07; SI-03). Package hms.platform.tasks. Specification: docs/specs/modules/platform-tasks.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    api(project(":platform:ids"))
    api(project(":platform:time"))
    api(project(":platform:context"))
    api(project(":platform:events"))
    implementation(project(":platform:journal"))
    // Configuration and calendars through the tenancy api (decision D5; recorded as an open question).
    api(project(":modules:platform-tenancy"))
    testImplementation(project(":platform:testing"))
}
