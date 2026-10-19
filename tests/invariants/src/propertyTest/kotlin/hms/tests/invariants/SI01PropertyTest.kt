package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-01 (BUILD-PROMPT §2.1; HAZ-0001; planned as
 * `PropertyTest:SI-01-*`). Enforced in (§2.1): Identity service; print templates.
 *
 * Specification layer (what the WP-0.5 machines encode; the register's `covers` says exactly what):
 * - `PropertyTest:SI-01-two-identifiers-on-every-patient-affecting-command`
 *   on medication-administration (clauses a, d).
 * - `PropertyTest:SI-01-location-never-an-identifier`
 *   on medication-administration (clauses b).
 * Domain layer: NOT-BUILT, waiting on WP-1.2 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI01PropertyTest :
    FunSpec({
        siInvariantTests("SI-01") {
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-01-two-identifiers-on-every-patient-affecting-command",
            )
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-01-location-never-an-identifier",
            )
        }
    })
