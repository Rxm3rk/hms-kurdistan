package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-11 (BUILD-PROMPT §2.1; HAZ-0011; planned as
 * `PropertyTest:SI-11-*`). Enforced in (§2.1): Transfusion verification (T2) or fallback.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-11, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-3.10 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI11PropertyTest :
    FunSpec({
        siInvariantTests("SI-11")
    })
