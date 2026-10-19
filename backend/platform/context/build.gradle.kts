// The command context every command carries: tenant, facility, actor, on-behalf-of, device, purpose-of-use,
// clinical time, idempotency key, correlation and causation (BUILD-PROMPT §6.2), the change reason, and the
// transaction context that repositories share. Package hms.kernel.context. Specification: docs/specs/modules/platform-kernel.md.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    api(project(":platform:ids"))
    api(project(":platform:time"))
    testImplementation(project(":platform:testing"))
}
