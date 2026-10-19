package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-12 (BUILD-PROMPT §2.1; HAZ-0012; planned as
 * `PropertyTest:SI-12-*`). Enforced in (§2.1): RCM ↔ ADT/MAR boundary.
 *
 * Specification layer (what the WP-0.5 machines encode; the register's `covers` says exactly what):
 * - `PropertyTest:SI-12-unverified-outside-medicine-cannot-be-scanned`
 *   on medication-administration (clauses e).
 * Domain layer: NOT-BUILT, waiting on WP-2.1 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI12PropertyTest :
    FunSpec({
        siInvariantTests("SI-12") {
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-12-unverified-outside-medicine-cannot-be-scanned",
            )
        }
    })
