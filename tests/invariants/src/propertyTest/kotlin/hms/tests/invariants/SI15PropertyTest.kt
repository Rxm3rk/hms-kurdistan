package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-15 (BUILD-PROMPT §2.1; HAZ-0015; planned as
 * `PropertyTest:SI-15-*`). Enforced in (§2.1): Offline matrix; command handler.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-15, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-3.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI15PropertyTest :
    FunSpec({
        siInvariantTests("SI-15")
    })
