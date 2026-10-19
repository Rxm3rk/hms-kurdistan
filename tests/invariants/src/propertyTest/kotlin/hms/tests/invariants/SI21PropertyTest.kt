package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-21 (BUILD-PROMPT §2.1; HAZ-0021, HAZ-0022, HAZ-0023, HAZ-0024, HAZ-0025, HAZ-0026, HAZ-0027; planned as
 * `PropertyTest:SI-21-*`). Enforced in (§2.1): Trust Plane PEP; print and export services.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-21, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-0.4 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI21PropertyTest :
    FunSpec({
        siInvariantTests("SI-21")
    })
