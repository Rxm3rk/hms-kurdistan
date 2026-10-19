package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-08 (BUILD-PROMPT §2.1; HAZ-0008; planned as
 * `PropertyTest:SI-08-*`). Enforced in (§2.1): EMPI.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-08, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-1.2 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI08PropertyTest :
    FunSpec({
        siInvariantTests("SI-08")
    })
