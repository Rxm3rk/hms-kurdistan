package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-06 (BUILD-PROMPT §2.1; HAZ-0006; planned as
 * `PropertyTest:SI-06-*`). Enforced in (§2.1): Clinical journal.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-06, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-0.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI06PropertyTest :
    FunSpec({
        siInvariantTests("SI-06")
    })
