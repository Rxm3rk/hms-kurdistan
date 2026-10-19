package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-13 (BUILD-PROMPT §2.1; HAZ-0013; planned as
 * `PropertyTest:SI-13-*`). Enforced in (§2.1): MAR; formulary.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-13, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-3.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI13PropertyTest :
    FunSpec({
        siInvariantTests("SI-13")
    })
