package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * SI-15 (BUILD-PROMPT §2.1; HAZ-0015; planned as
 * `PropertyTest:SI-15-*`). Enforced in (§2.1): Offline matrix; command handler.
 *
 * Specification layer (what the WP-0.5 machines encode; the register's `covers` says exactly what):
 * - `PropertyTest:SI-15-offline-administration-only-against-orders-verified-before-outage`
 *   on medication-administration (clauses f).
 * Domain layer: NOT-BUILT, waiting on WP-3.3 (KA-060); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI15PropertyTest :
    FunSpec({
        siInvariantTests("SI-15") {
            on(
                MedicationAdministrationSpecLayer.layer,
                "PropertyTest:SI-15-offline-administration-only-against-orders-verified-before-outage",
            )
        }
    })
