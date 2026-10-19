package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-05 (BUILD-PROMPT §2.1; HAZ-0005; planned as
 * `PropertyTest:SI-05-*`). Enforced in (§2.1): Dose Engine or fallback control set; CI static analysis.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-05, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-3.2 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI05PropertyTest :
    FunSpec({
        siInvariantTests("SI-05")
    })
