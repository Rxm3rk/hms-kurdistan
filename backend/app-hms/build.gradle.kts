// app-hms: the modular-monolith application that assembles the application modules (ADR-002, ADR-003;
// BUILD-PROMPT §5.2, §6.1). In WP-0.3 it carries the Spring Modulith verification of the module structure
// (§6.8 #3); the Spring Boot application itself arrives with the first module that needs a running process.

plugins {
    id("hms.kotlin-conventions")
    id("hms.quality-conventions")
    id("hms.test-conventions")
}

dependencies {
    implementation(project(":platform:ids"))
    implementation(project(":platform:time"))
    implementation(project(":platform:context"))
    implementation(project(":platform:money"))
    implementation(project(":platform:quantity"))
    implementation(project(":platform:events"))
    implementation(project(":platform:journal"))
    implementation(project(":modules:platform-tenancy"))
    implementation(project(":modules:platform-config"))
    implementation(project(":modules:platform-tasks"))
    implementation(project(":modules:platform-workflow"))
    testImplementation(platform(libs.spring.modulith.bom))
    testImplementation(libs.spring.modulith.core)
}
