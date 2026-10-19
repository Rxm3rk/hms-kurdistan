# Medication administration (`medication-administration.yaml`)

One instance per scheduled dose: from the moment the dose falls due until it is given, started and finished as an infusion, stopped, recorded as not done, closed because its order ended, or marked entered in error (BUILD-PROMPT §8.4 "Medication administration, per scheduled dose"; §9.10 eMAR and BCMA; R11 §10.3). Appendix B.3 is the first draft of this machine; this file completes it against §8.4, the hazard log and the order machine (`order.yaml`). Owner: `medications` (Safety Kernel, §9.10). Predicates live in `backend/modules/medications`, package `hms.medications.domain.medicationadministration` (WP-0.5 spec §3.1). Approvers: pharmacist panel, nurse panel and CSO (§8.4); the approval request is **DN-053**, and every reading below that goes beyond an SI's text is a numbered item of DN-053. Hazards: HAZ-0001 (SI-01), HAZ-0002 (SI-02), HAZ-0003 (SI-03), HAZ-0005 (SI-05), HAZ-0010 (SI-10), HAZ-0012 (SI-12), HAZ-0013 (SI-13), HAZ-0015 (SI-15).

## States

- `scheduled`: created by `DoseFallsDue`. The order's MAR schedule is created in the order-sign transaction (§9.5; `order.yaml` `createMarSchedule`; ORD-Q2), so doses exist while the order is in `pending-verification`, and before verification a dose can be given only through the verification override. §9.10 says "schedules generated from verified orders"; the conflict is DN-053 item 1.
- `in-progress`: an infusion has started (R11 §10.3).
- `completed`, `not-done`, `stopped`, `entered-in-error`: terminal (B.3). Only `MarkEnteredInError` leaves `completed`, `not-done` or `stopped`, and it carries `privilegedAndAudited` (WP-0.5 spec §1.2, rule 7).

## Transitions

"Common" stands for `administeringUserPrivileged, clinicalTimeContemporaneous, highAlertCheckSatisfied, patientSuppliedCleared, offlineAllowed`. "Amount" stands for `notInfusionOrder, fixedDoseOrder, administeredAmountMatchesOrder` on a give and for `infusionOrder, infusionContentMatchesOrder` on an infusion start.

| From | Command | Guard (all must hold) | Effects | To | Status |
|---|---|---|---|---|---|
| scheduled | `Give` | common, activeVerifiedOrder, wristbandScanMatches, productIdentityMatches, amount | emitMedicationAdministered | completed | proposed edge (§8.4) |
| scheduled | `StartInfusion` | the same, infusion amount | emitMedicationAdministered | in-progress | R11 §10.3 |
| scheduled | `GiveWithOverride`, `StartInfusionWithOverride`: product scan | common, activeVerifiedOrder, wristbandScanMatches, **productNotIdentified**, amount, overrideReasonEntered, reasonOnScanOverrideList | reportOverride, emitMedicationAdministered | completed / in-progress | give: proposed edge |
| scheduled | the same commands: verification | common, **orderAwaitingVerification, emergencyOverrideListed, firstDoseOfOrder**, wristbandScanMatches, productIdentityMatches, amount, overrideReasonEntered, reasonOnVerificationOverrideList | reportOverride, createPharmacistReviewTask, emitMedicationAdministered | completed / in-progress | give: proposed edge |
| scheduled | the same commands: wristband failure | common, activeVerifiedOrder, **wristbandScanUnusable, manualTwoIdentifiersConfirmed**, productIdentityMatches, amount, overrideReasonEntered, reasonOnIdentityOverrideList | reportOverride, createWristbandReprintTask, emitMedicationAdministered | completed / in-progress | proposed transitions |
| scheduled | `RecordOfflineAdministration` | issuedOfflineAndSynced, administeringUserPrivileged, notInfusionOrder / infusionOrder | reportOverride, createAdministrationReviewTask, emitMedicationAdministered | completed / in-progress | proposed |
| scheduled | `BackEnterAdministration` | privilegedAndAudited, backEntryDocumented, manualTwoIdentifiersConfirmed | reportOverride, createAdministrationReviewTask, emitMedicationAdministered | completed | proposed |
| scheduled | `NotDone` | administeringUserPrivileged, notDoneReasonValid | emitMedicationNotGiven | not-done | proposed edge (§8.4) |
| in-progress | `NotDone` | the same | emitMedicationNotGiven | not-done | R11 §10.3 |
| in-progress | `Complete` | authenticatedClinicalUser | emitMedicationAdministered | completed | R11 §10.3 |
| in-progress | `Stop` | authenticatedClinicalUser | emitMedicationAdministered | stopped | R11 §10.3 |
| scheduled | `OrderEnded` | orderEnded | emitMedicationNotGiven (system reason `order-ended`) | not-done | proposed |
| in-progress | `OrderEnded` | orderEnded | createInfusionStopTask | in-progress | proposed |
| scheduled | `LateDoseWindowElapsed` | lateDoseWindowElapsed, orderAdministrable | flagLateDose | scheduled | proposed |
| scheduled | `LateDoseWindowElapsed` | lateDoseWindowElapsed, orderOnHold | emitMedicationNotGiven (system reason `order-on-hold`) | not-done | proposed |
| `*` | `MarkEnteredInError` | privilegedAndAudited, errorReasonEntered | — | entered-in-error | proposed (R11 draws it only from in-progress) |

**Proposed** (R11 §10.3 draws only "scheduled → in-progress → completed | not-done | stopped | entered-in-error"; §8.4; A.20 "Undrawn transitions"): the edges `scheduled→completed` and `scheduled→not-done` (named in §8.4), `scheduled→scheduled`, `in-progress→in-progress` and `*→entered-in-error`. Three new transitions sit on the drawn edge `scheduled→in-progress` and carry `proposed: true`: the wristband-failure infusion override and the offline infusion record. `NotDone` is two transitions, so that each one's proposed status is exact.

**Determinism.** Every pair of alternatives with the same state and command is disjoint for every fact value, not only statically. The order predicates read one order state and one verification status. `productIdentityMatches` and `productNotIdentified` read whether the command's product scan identified a product. `wristbandScanMatches` and `wristbandScanUnusable` read whether the command's wristband scan matched. `infusionOrder` and `notInfusionOrder` are exact complements, and so are `orderAdministrable` and `orderOnHold` over the order states a dose can see.

## The facts: whose knowledge, and when

- **Knowledge time (DN-053 item 9).** For an online command, every fact about the order, the patient, the formulary and the privileges is the server's state when it receives the command. For an offline command, it is the state the device or edge agent held when the user issued it, with the mode and the outage in which it was issued, all from the offline envelope (`order.yaml` reads its offline predicate the same way). An unknown value fails. What the server learns later never refuses a dose that happened: if the order was discontinued meanwhile, the sync handler raises an owned task to the prescriber and pharmacist (§9.10; CTRL-0015-9). An offline give that fails the server's revalidation is recorded through `RecordOfflineAdministration`, never dropped.
- **Clinical time (SI-10).** On the live paths the clinical time is the command's issue time, and it may not be later than the server's receipt plus a governed clock-skew allowance (`clinicalTimeContemporaneous`). A dose given earlier and documented now is a back-entry (`BackEnterAdministration`): privileged and audited, keeping the paper's clinical time, labelled (SI-10 clauses b and c; CTRL-0010-4, CTRL-0010-5).
- **The scan log.** The command handler journals every scan read for a dose, including the scans of refused commands. `productNotIdentified` and `wristbandScanUnusable` read it. That is how a refused wrong-product or wrong-patient scan blocks the override, and how §8.4's "else stop with reason" is recorded: the refusal, its failed predicates and the scans are facts of the dose. Follow-up is the nurse's next command (a matching scan, `NotDone`, or a pharmacist clearing the mismatch). A unit mismatch also makes the command handler raise an order-review task (§2.1 clause b).
- **Serialisation.** `firstDoseOfOrder` reads the other doses of the order under the order's schedule serialisation, so two nurses cannot both give a "first" dose before verification.
- **Channel-owned facts.** "Chosen by the user, never prefilled" (`overrideReasonEntered`, `notDoneReasonValid`, the amount in `administeredAmountMatchesOrder`) is a mark the channel adapter owns. A channel with no human chooser (API client, interface, migration loader, plugin, AI agent) supplies none, so those predicates fail on it. Other modules own the MRN check and current-MRN answer (identity service), privileges and authentication (Trust Plane), the offline mode (offline matrix), the order state (orders) and the formulary flags and governed lists (configuration).

## How the guards read the SIs (DN-053 items)

1. **Schedule at Sign** (above). Default: as `order.yaml` (ORD-Q2). Option: schedule at verification, which leaves the verification override with no dose to act on.
2. **Product identity, separated from quantity.** `productIdentityMatches` asks only whether the scanned product is this order's product: on its verified product line or a dispense record for this patient and order, or for an unverified order a product the brand master maps to its orderable. A different drug, form, route or strength identity, or a known expired lot, is a hard stop. An unknown expiry (a linear barcode with no lot) is shown and recorded, not a hard stop. Option: unknown expiry is a hard stop.
3. **Product-scan override covers the whole dose.** It applies only when the command's scan identified no product and the dose's scan log holds no uncleared identified mismatch. Without that, a nurse refused for the wrong drug could override without scanning (the classic workaround). Option: a governed attempt window instead of the whole dose.
4. **First dose before verification.** Default: `firstDoseOfOrder` counts every other dose of the order and its `replaces` chain that is in-progress, completed or stopped, or entered in error after being given. So a stop, a correction or a replacement never re-opens a "first" dose. Options:
   - (ii) For emergency-list orderables, repeat doses within a governed window before verification (adrenaline in an arrest, a repeat benzodiazepine in status epilepticus), each reported and reviewed.
   - (iii) Whether a replacement order inherits the first-dose history (default: yes).
5. **SI-01 on a failed wristband scan.** SI-01 asks for two identifiers, not a scan. B.3's `GiveWithOverride` guard and §8.4's example guard use `twoIdentifiersConfirmed` (scan or manual check). HAZ-0002 expects a wristband bypass to need a recorded reason. The first version required the scan on every path and misread B.3's comment. It would have left a time-critical dose for a patient with no wristband, a cut-off or damaged one, or a broken printer either delayed or given off the record. The default now keeps the scan on the normal path and adds a proposed wristband-failure override that replaces only the scan and keeps every other check. In that override the MRN is keyed (valid check digit, the patient's current MRN per the identity service), the DOB is keyed and matched (or the approximate-DOB flag confirmed), the banner and photo are shown, a reason is chosen, the override is reported, and a wristband reprint task is raised. A wrong-patient scan on the dose's scan log blocks it. Options:
   - (b) No manual path (the first version), with the hazard above.
   - (c) The override only for emergency-list orderables.
6. **Quantity without arithmetic (SI-05).** The user enters the amount given in an empty field. It is compared exactly with the ordered dose in the same UCUM unit (§2.1 clause b, two independently entered quantities); a unit mismatch is a mismatch. Infusions compare the product's labelled content exactly with the verified product line (or the ordered content); the rate is titration (clause d), outside this machine. Nothing multiplies a count by a strength or a volume by a concentration. Range doses (for example 2 to 4 mg) are refused by `fixedDoseOrder` until decided, because §2.1 allows a range comparison only for titration rates (clause d). Options:
   - (b) Allow the comparison of the entered amount with the ordered minimum and maximum in the same unit (an SI-05 ruling on clause d).
   - (c) Compare the number of unit scans with a unit count the pharmacist entered on the dispense record (a count comparison; an SI-05 ruling on clause b).
   - (d) Range orders refused at Sign instead, so the bedside never meets one.
7. **Verification override.** Default: the order is in `pending-verification` with status `pending`, never `returned` (returned to the prescriber for any reason). The orderable is on the governed emergency and first-dose list [HUMAN] and the dose passes `firstDoseOfOrder`. The override is never offline, and it creates the pharmacist review task due within 4 h (§10.3 A item 4; CTRL-0002-6, CTRL-0005-12).
8. **One override, one check.** Each override replaces exactly one check: the product scan, the verification or the wristband scan. No override waives SI-12, SI-13 or SI-15, and SI-01's two identifiers are always met (by scan or by the keyed check). Two failed checks at once are refused. Options:
   - (b) B.3's guard as written, which dropped both the verification and the product scan.
   - (c) A combined emergency override.
9. **Knowledge time** (above). Option: the server's state at the clinical time (bitemporal valid time), which reaches orders discontinued after the dose.
10. **SI-15.** Default: online, or the order was verified strictly before the outage in which the command was issued; unknown times fail. Losing the internet or the WAN leaves an on-site cell online (SI-15's last sentence).
11. **SI-12 supply binding.** The supply must be one of these:
    - a dispense record for this patient and order;
    - ward stock of a product of the orderable that the unit is configured to stock (a bare GTIN of a product the unit does not stock is not cleared);
    - a patient-supplied item, only through the scan of its own pharmacy relabel naming the patient.

    Patient-supplied items are therefore never given under the product-scan override: a failed relabel scan means relabelling. Option: allow a named patient-supplied record on the override.
12. **SI-13 independent double check.** Default: a second user, not the person giving the dose, authenticated by badge and PIN and privileged to double-check, records a check bound to this dose and to the product and lot scanned in this command (or to the named supply). The check is recorded after that scan and within a governed window [HUMAN] before the command, and the checker attests that patient, product and dose agree. An unknown high-alert flag counts as high-alert. Option: the checker also scans the product.
13. **Performer.** Every administering command and `NotDone` need an authenticated human with the administration privilege for the route and drug class (`administeringUserPrivileged`). `Complete` and `Stop` need only an authenticated clinical user, never a configurable privilege, so nothing configurable blocks stopping an infusion. Option: the same privilege on all.
14. **Late doses.** The window is fixed at creation from governed configuration (tighter for time-critical drugs) or a vendor default the CSO sets; it is never zero by omission. The window flags a dose and never blocks a give. Option: nothing in the machine (the task engine flags late doses).
15. **Held and ended orders.** `OrderEnded` closes a scheduled dose of a completed, discontinued, replaced or entered-in-error order to `not-done` with the system reason `order-ended`. It raises an owned stop-or-confirm task for a running infusion. A dose whose window elapses while its order is on hold closes with `order-on-hold` and raises no late-dose task; if the order resumes within the window, the dose can still be given. These system reasons are not user defaults, so SI-02 clause b does not apply. Options:
    - (b) Held doses stay `scheduled` with an owned review task.
    - (c) A separate `held` state.
16. **Records after the fact.** `RecordOfflineAdministration` (sync handler only) and `BackEnterAdministration` (privileged and audited) record doses that happened without the live checks. They are reported as overrides and raise a prescriber and pharmacist review task, so a dose is never lost or falsely recorded as missed. Option: no such paths, which means those doses cannot be recorded.

**SI-12 (money).** No guard reads a payment, deposit, bill, pre-authorisation or counter fact, and the facts carry none, so no money rule can refuse or delay any dose (SI-12 clause b; CTRL-0012-3). No not-done reason is financial.

**SI-02 clause c.** Every override and every record after the fact carries `reportOverride`, which names the kind and, for a product-scan override, the sub-cause (no scan, unreadable, not mapped) for scan-failure analytics (SAC-21; CTRL-0002-5).

## Properties this file supports (phase 2, `MedicationAdministrationPropertyTest`)

These run at the specification layer only (WP-0.5 spec §4); each is a property of the fired transition and its facts, or of the path:

- Every run that reaches `completed` or `in-progress` passed through a transition from `scheduled` whose guard holds `activeVerifiedOrder`, or holds `overrideReasonEntered` with exactly one replaced check, or is a reported record after the fact. Hazard-log test: SI-02-no-administration-without-active-verified-order-or-documented-override.
- Every override fired with `highAlertCheckSatisfied`, `patientSuppliedCleared` and `offlineAllowed` holding, and with `wristbandScanMatches` or `manualTwoIdentifiersConfirmed` holding. Hazard-log test: SI-02-override-never-waives-SI-01-SI-12-SI-13-SI-15.
- Every override and record after the fact emits `reportOverride` (SI-02-every-override-reportable).
- No dose whose scan log holds an uncleared identified-mismatch product scan reaches `completed` or `in-progress` through a product-scan override, and none with a wrong-patient wristband scan through a wristband-failure override.
- Every verification override creates the review task (SI-05-review-task-within-4h-of-dose-before-verification).
- A high-alert dose never fires with the checker equal to the administering user (SI-13-double-check-needs-two-different-people).
- Offline, no dose fires against an order verified at or after the outage start (SI-15-offline-administration-only-against-orders-verified-before-outage).
- No wristband scan from a location label satisfies the guard (SI-01-location-never-an-identifier).
- No guard of a give alternative reads `lateDoseWindowElapsed`.

## Not in this machine

- **Allergy, interaction and duplicate re-check at administration** (R11 §9 item 5: "re-checked at verification and administration"). `order.yaml` re-runs them at Verify; this machine does not re-run them at the bedside. They belong to `reg-screening` and the CDS registry, and enter later as a predicate that reads only a governed-list Tier A hit new since verification, where an unavailable service never refuses a dose. Proposed known anomaly and open question.
- PRN doses (the instance created when a nurse decides to give one) and the minimum-interval check against a double dose at shift change (§18.5 #3).
- Back-entry of an infusion, and an infusion overrun timer for an `in-progress` dose that is never completed.
- An event for an entered-in-error correction: §8.5 catalogues only `MedicationAdministered`, `MedicationNotGiven` and `MedicationAdministrationOverridden`. `MedicationAdministered` is emitted at infusion start, completion and stop with the status in the event.
- Rate changes and titration checks during an infusion (§2.1 clause d), pump association (MED-INF-01) and controlled-drug witnessed waste.

The file uses the B.3 keys plus `initial`, `created_by`, `effects`, `hazards`, `sources` and the per-transition `proposed` flag (DN-059). The key `on` is read as written (WP-0.5 spec §1.2).
