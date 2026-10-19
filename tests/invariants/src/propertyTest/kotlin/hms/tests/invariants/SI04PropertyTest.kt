package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-04 (BUILD-PROMPT §2.1; HAZ-0004; planned as
 * `PropertyTest:SI-04-*`). Enforced in (§2.1): Critical-result service.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-04, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-1.7 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI04PropertyTest :
    FunSpec({
        siInvariantTests("SI-04")
    })
