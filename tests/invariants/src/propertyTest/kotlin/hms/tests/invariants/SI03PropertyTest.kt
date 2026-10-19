package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-03 (BUILD-PROMPT §2.1; HAZ-0003; planned as
 * `PropertyTest:SI-03-*`). Enforced in (§2.1): Task engine.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-03, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-0.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI03PropertyTest :
    FunSpec({
        siInvariantTests("SI-03")
    })
