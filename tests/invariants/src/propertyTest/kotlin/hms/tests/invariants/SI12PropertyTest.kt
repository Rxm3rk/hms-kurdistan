package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-12 (BUILD-PROMPT §2.1; HAZ-0012; planned as
 * `PropertyTest:SI-12-*`). Enforced in (§2.1): RCM ↔ ADT/MAR boundary.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-12, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-2.1 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI12PropertyTest :
    FunSpec({
        siInvariantTests("SI-12")
    })
