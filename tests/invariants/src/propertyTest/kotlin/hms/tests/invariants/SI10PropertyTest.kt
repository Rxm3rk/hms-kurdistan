package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-10 (BUILD-PROMPT §2.1; HAZ-0010; planned as
 * `PropertyTest:SI-10-*`). Enforced in (§2.1): Bitemporal journal.
 *
 * Specification layer (what the WP-0.5 machines encode; the register's `covers` says exactly what):
 * - `PropertyTest:SI-10-clinical-time-distinct-from-system-time`
 *   on medication-administration (clauses a).
 * - `PropertyTest:SI-10-back-dating-is-privileged-and-audited`
 *   on medication-administration (clauses b).
 * - `PropertyTest:SI-10-back-entry-keeps-clinical-time-and-label`
 *   on medication-administration (clauses c).
 * Domain layer: NOT-BUILT, waiting on WP-0.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI10PropertyTest :
    FunSpec({
        siInvariantTests("SI-10") {
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-10-clinical-time-distinct-from-system-time",
            )
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-10-back-dating-is-privileged-and-audited",
            )
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-10-back-entry-keeps-clinical-time-and-label",
            )
        }
    })
