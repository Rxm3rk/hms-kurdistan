# Backend platform libraries

Shared kernel libraries, one Gradle project each, in packages `hms.kernel.<lib>` (BUILD-PROMPT §6.1). Every module may use them; they depend on no application module.

- `arch-rules` (WP-0.1): the reusable ArchUnit rules for the §6.8 fitness functions that can be expressed now, each tested against violating and compliant fixtures. See `../README.md`.
- `testing` (WP-0.1): shared test support. `PropertyTestBudget` gives every property-based test its sequence count (`hms.pbt.sequences`: 1,000 in the fast tier, 10⁶ nightly).
- Next, in WP-0.3 (`PLT-CORE-01`, `PLT-CORE-02`, `PLT-CORE-04`, `PLT-CORE-07`, `PLT-CFG-01`): UUIDv7 identifiers, the injected `Clock` with clinical and recorded time, `Money`, `Quantity` with UCUM, the bitemporal journal-as-outbox, the configuration chain with locks, signed configuration bundles, flags and kill switches, the task engine and `WorkflowPort`. The Trust Plane SDK and PHI-safe logging follow in WP-0.4, i18n support with the client work.
