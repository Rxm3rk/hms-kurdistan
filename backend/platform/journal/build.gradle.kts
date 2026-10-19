// The bitemporal journal as transactional outbox (BUILD-PROMPT §5.3 C, §7 item 3; PLT-CORE-01; ADR-004, ADR-009).
// Package hms.kernel.journal. Specification: docs/specs/modules/platform-journal.md.

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
    // The repository adapter (infrastructure only; the domain stays framework-free, §6.8 #3).
    implementation(libs.jooq)
    // The migrations ship as resources; Flyway runs them in the application and in the integration tests.
    integrationTestImplementation(libs.flyway.core)
    integrationTestImplementation(libs.flyway.database.postgresql)
    integrationTestRuntimeOnly(libs.postgresql)
    integrationTestImplementation(platform(libs.testcontainers.bom))
    integrationTestImplementation(libs.testcontainers.postgresql)
    integrationTestImplementation(libs.testcontainers.junit.jupiter)
    testImplementation(project(":platform:testing"))
}
