package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-02 (BUILD-PROMPT §2.1; HAZ-0002; planned as
 * `PropertyTest:SI-02-*`). Enforced in (§2.1): MAR aggregate.
 *
 * Specification layer (what the WP-0.5 machines encode; the register's `covers` says exactly what):
 * - `PropertyTest:SI-02-no-administration-without-active-verified-order-or-documented-override`
 *   on medication-administration (clauses a).
 * - `PropertyTest:SI-02-override-never-waives-SI-01-SI-12-SI-13-SI-15`
 *   on medication-administration (clauses a).
 * - `PropertyTest:SI-02-override-reason-never-defaulted`
 *   on medication-administration (clauses b).
 * - `PropertyTest:SI-02-every-override-reportable`
 *   on medication-administration (clauses c).
 * Domain layer: NOT-BUILT, waiting on WP-3.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI02PropertyTest :
    FunSpec({
        siInvariantTests("SI-02") {
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-02-no-administration-without-active-verified-order-or-documented-override",
            )
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-02-override-never-waives-SI-01-SI-12-SI-13-SI-15",
            )
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-02-override-reason-never-defaulted",
            )
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-02-every-override-reportable",
            )
        }
    })
