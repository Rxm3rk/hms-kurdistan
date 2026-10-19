package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-20 (BUILD-PROMPT §2.1; HAZ-0020; planned as
 * `PropertyTest:SI-20-*`). Enforced in (§2.1): Trust Plane; AI gateway; egress tests.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-20, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-0.4 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI20PropertyTest :
    FunSpec({
        siInvariantTests("SI-20")
    })
