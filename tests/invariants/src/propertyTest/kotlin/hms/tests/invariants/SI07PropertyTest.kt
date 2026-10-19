package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-07 (BUILD-PROMPT §2.1; HAZ-0007; planned as
 * `PropertyTest:SI-07-*`). Enforced in (§2.1): AI control plane.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-07, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on Phase 5 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI07PropertyTest :
    FunSpec({
        siInvariantTests("SI-07")
    })
