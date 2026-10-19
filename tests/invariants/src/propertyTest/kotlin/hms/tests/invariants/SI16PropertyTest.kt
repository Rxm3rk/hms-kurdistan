package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-16 (BUILD-PROMPT §2.1; HAZ-0016; planned as
 * `PropertyTest:SI-16-*`). Enforced in (§2.1): Design-system shell.
 *
 * Specification layer: none. No WP-0.5 machine encodes SI-16, so the register lists no specification-layer property.
 * Domain layer: NOT-BUILT, waiting on WP-0.7 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI16PropertyTest :
    FunSpec({
        siInvariantTests("SI-16")
    })
