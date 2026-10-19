# WP-0.5 phase 2 report: order (`:modules:orders`, `hms.orders.domain.order`)

Status: IN PROGRESS. Code written; first verifying Gradle run queued. All results: Windows host, not evidence of record.

## Files (all new, in the worktree)
- backend/modules/orders/src/main/kotlin/hms/orders/domain/order/OrderFacts.kt
- backend/modules/orders/src/main/kotlin/hms/orders/domain/order/OrderGuards.kt
- backend/modules/orders/src/test/kotlin/hms/orders/domain/order/OrderGuardsTest.kt
- backend/modules/orders/src/test/kotlin/hms/orders/ArchitectureTest.kt (current platform template; only the package line changed)
- backend/modules/orders/src/testFixtures/kotlin/hms/orders/domain/order/OrderSamples.kt
- backend/modules/orders/src/testFixtures/kotlin/hms/orders/domain/order/OrderArbs.kt
- backend/modules/orders/src/propertyTest/kotlin/hms/orders/domain/order/OrderPropertyTest.kt
- Regenerated, not hand-edited: OrderMachine.kt, OrderGeneratedPropertyTest.kt

## Spec change (needs re-review)
`order.yaml` `prescriberResponseRecorded`: added "and is not the user who returned the order (the pharmacist cannot clear
their own return, DN-052 item 15; an unknown issuer or an unknown returning user fails)". `order.md` already stated this
rule, but the YAML did not, so a pharmacist with ordering privileges could have resubmitted their own return.
Regenerated with `sh tools/hms statemachines generate --machine order`.

## Readings taken in the Kotlin (each is the stricter one, or the literal one where the text decides)
1. `notReturned`: the YAML lists "pending or verified; absent for a non-medication order". So a medication order with no
   status counts as returned (fail closed: no Verify, Resubmit possible). `verificationReturned` is its literal negation.
2. SI-16: "recorded after the change" means strictly after. An answer with an unknown time never counts. "Latest" means
   last in the server's recording order. An unknown change time reads only answers recorded for this command.
3. Control set A: no Dose Engine fact is modelled, because reg-dose is P2, so the set always applies by the clinical
   criteria. "Since the last submission" means strictly after it. An unknown submission time counts every calculation.
   On equal times, the later entry in the list wins. Exact means BigDecimal compareTo (5 = 5.00) plus exact unit string
   and every bound. It is never a conversion.
4. Formulary flags are read only for medication orders. A medication order whose orderable has no formulary entry reads
   every flag as unknown, so as set. An unknown emergency-list flag never relaxes a check. An unknown priority is never
   STAT or ASAP.
5. `kbHardStopNotFired` treats an answer as usable only if it is covered, answered in time, and its reference unit equals
   the ordered dose's unit exactly. Every other case holds (critical fix SAF-ORD-01).
6. `localHardStopsSatisfied`: a runtime that gave no evaluation (null) counts as rules that could not run.
7. `verbalOrderDocumented`: the read-back must name the same source and receiver as the verbal record. An unknown co-sign
   limit fails. This can refuse verbal Signs while that configuration is missing (see OQ below).
8. `fulfilmentComplete` is computed from the fulfilling modules' facts. Diagnostic means laboratory and imaging. An empty
   or unknown result list fails. "Passed" means strictly after the server's time.
9. Stop privileges: "names nobody" is modelled as `StopPrivilege.grantedToAnyone = false`. Licence expiry is never read
   on a stop. A discontinue reason list that contains "replaced" is ignored for that code.
10. Review timers: a missing or non-positive tenant interval uses the vendor default, which the facts type refuses to be
    zero. An issuer-set hold review time applies only to the first review.
11. `coSignRuleSatisfied`: the governed rule's answer is modelled as a known Boolean. No unknown state was invented.

## Proposed for the integrator
- OQ (SI-07): `privilegedAndAudited` (Mark error) does not check the principal kind. An AI agent or system principal
  that the Trust Plane granted the entered-in-error privilege could correct an order. Options: (a) as written (default);
  (b) require a human for Mark error. The description says "a Trust Plane answer", so the Kotlin is literal.
- OQ (verbal orders): with no governed co-sign limit configured, every verbal Sign is refused (fail closed). Should a
  vendor default co-sign limit exist, like the review intervals? Content [HUMAN].
- DN-052 item 15 now carries the spec change above (the pharmacist cannot resubmit their own return).
