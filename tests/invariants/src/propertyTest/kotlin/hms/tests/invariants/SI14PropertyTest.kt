package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-14 (BUILD-PROMPT §2.1; HAZ-0014; planned as
 * `PropertyTest:SI-14-*`). Enforced in (§2.1): CDS registry.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-14, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-1.5 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI14PropertyTest :
    FunSpec({
        siInvariantTests("SI-14")
    })
