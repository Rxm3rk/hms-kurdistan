package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-09 (BUILD-PROMPT §2.1; HAZ-0009; planned as
 * `PropertyTest:SI-09-*`). Enforced in (§2.1): Med-rec aggregate.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-09, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-3.11 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI09PropertyTest :
    FunSpec({
        siInvariantTests("SI-09")
    })
