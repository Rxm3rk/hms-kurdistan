// Reusable ArchUnit rules for the fitness functions that can be expressed now
// (BUILD-PROMPT §6.8 #3, §5.2 dependency rules, §6.2 time, ADR-010). Package hms.kernel.archrules.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    api(libs.archunit)

    // Real framework types for the violating fixtures (test source set only, never shipped).
    testImplementation(libs.spring.core)
    testImplementation(libs.jakarta.inject.api)
    testImplementation(libs.jooq)
    testImplementation(libs.jackson.annotations)
    testImplementation(libs.jackson.core)
    testImplementation(libs.temporal.sdk)
    testImplementation(libs.kafka.clients)
}
