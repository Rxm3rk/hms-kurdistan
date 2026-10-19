package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-18 (BUILD-PROMPT §2.1; HAZ-0018; planned as
 * `PropertyTest:SI-18-*`). Enforced in (§2.1): Boundary Register service.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-18, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-0.9 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI18PropertyTest :
    FunSpec({
        siInvariantTests("SI-18")
    })
