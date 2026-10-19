package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-10 (BUILD-PROMPT §2.1; HAZ-0010; planned as
 * `PropertyTest:SI-10-*`). Enforced in (§2.1): Bitemporal journal.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-10, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-0.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI10PropertyTest :
    FunSpec({
        siInvariantTests("SI-10")
    })
