package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-17 (BUILD-PROMPT §2.1; HAZ-0017; planned as
 * `PropertyTest:SI-17-*`). Enforced in (§2.1): Results routing.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-17, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-3.11 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI17PropertyTest :
    FunSpec({
        siInvariantTests("SI-17")
    })
