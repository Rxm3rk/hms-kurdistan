// Reusable ArchUnit rules for the fitness functions that can be expressed now
// (BUILD-PROMPT §6.8 #3, §5.2 dependency rules, §6.2 time, ADR-010), the kernel rules of
// docs/specs/modules/platform-kernel.md §11, and the fact-table migration linter (§6.8 #2,
// docs/specs/modules/platform-journal.md §9.3). Package hms.kernel.archrules.

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
    testImplementation(libs.cloudevents.core)
    // Debezium and Apicurio (D7's widened framework list) are not test dependencies: their artefacts pull large
    // trees. Their fixtures are stand-in types in io.debezium.archfixtures and io.apicurio.archfixtures; the
    // rules match packages by name.
}
