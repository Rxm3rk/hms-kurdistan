// platform-workflow: WorkflowPort; the Temporal adapter waits for the cell (BUILD-PROMPT §5.2, §7 item 6; ADR-010).
// Package hms.platform.workflow. Specification: docs/specs/modules/platform-workflow.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    api(project(":platform:ids"))
    api(project(":platform:context"))
    testImplementation(project(":platform:testing"))
}
