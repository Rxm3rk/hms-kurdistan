package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-13 (BUILD-PROMPT §2.1; HAZ-0013; planned as
 * `PropertyTest:SI-13-*`). Enforced in (§2.1): MAR; formulary.
 *
 * Specification layer (what the WP-0.5 machines encode; the register's `covers` says exactly what):
 * - `PropertyTest:SI-13-high-alert-administration-needs-documented-independent-double-check`
 *   on medication-administration (clauses a).
 * - `PropertyTest:SI-13-double-check-needs-two-different-people`
 *   on medication-administration (clauses a).
 * Domain layer: NOT-BUILT, waiting on WP-3.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI13PropertyTest :
    FunSpec({
        siInvariantTests("SI-13") {
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-13-high-alert-administration-needs-documented-independent-double-check",
            )
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-13-double-check-needs-two-different-people",
            )
        }
    })
