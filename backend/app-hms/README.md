# app-hms

The modular-monolith Spring Boot application that assembles the application modules into one deployable, with Spring Modulith for module boundaries, events and verification (ADR-002, ADR-003; BUILD-PROMPT §5.2, §6.1). Orders, Medications (including the MAR), Results and Tasks share its transactional boundary, the Safety Kernel. It is created in WP-0.3, when the platform kernel needs a running application; Spring Modulith verification joins the fast tier then (§6.8 #3).
