# ADR-005: Canonical Model Versioning and a projection compiler
Status: accepted
Date: 2026-10-18   Source: K §7.2 (kept), §9, K-15; BP §7.2, §7.5 (C5); R06 §7.1; R08 §1 #6, §4.6, §13 #6, §14 #9; RL #2, #13; BUILD-PROMPT §2.2 rule 4, §6.3, §8.8, §12, §18.6 (C4–C6), §4.2

## Context

**The question.** Which FHIR version is the external contract, and how the product survives FHIR version churn without migrating stored data.

**The research.**
- FHIR is the external contract, not the internal transactional schema (R08 §1 #6, §4.6). Version churn (R4 → R6) and national profiles are absorbed in a generated mapping layer, so R6 and new profiles become configuration rather than a rewrite (R08 §14 #9; risk R08 §13 #6).
- RL #13: FHIR R6 6.0.0-ballot5 was the second full ballot (17 Jul 2026); the CI build is 6.0.0-snapshot1 (15 Oct 2026); another ballot is certain; publication is expected in 2027.
- RL #2: R6 moves ChargeItem, ChargeItemDefinition, Invoice, Contract, InsurancePlan, InventoryItem, InventoryReport, SupplyRequest and SupplyDelivery out of core. FHIR names for finance and supply are naming guidance or edge projections only; the charge master, tariffs, packages, ledger and inventory are internal aggregates.

**Sources.** K keeps BP's ADR-005 (K §7.2); K-15 adapts the trigger: no Kurdistan mandate sets an R6 date [L], so R6 comes when a partner or market needs it (BP's trigger was "a launch-market IG mandates R6 earlier"). Criteria C4 (FHIR read), C5 (R4 → R6 cost) and C6 (IPS and KRG bundles from the same facts) of the ADR-001 spike measure this decision. Not marked [P].

## Decision

**Canonical Model Versioning and a projection compiler:** FHIR R4 (4.0.1) now; R5 only via backports (Subscriptions); R6 as a second projection when a partner or market needs it, with no storage migration. Bounded FHIR writes (Appointment, QuestionnaireResponse, DocumentReference, device/patient Observation, Consent, Task) become domain commands. Finance, supply and formulary stay internal aggregates because those resources leave R6 core.

**Detail** (BUILD-PROMPT §8.8, §6.3, §12):
- The R4 contract now: IPA, SMART App Launch 2.2, Bulk `$export`, topic-based Subscriptions (backport), and IPS `$summary` from day one.
- Never build anything canonical on resources leaving R6 core (ChargeItem, ChargeItemDefinition, Invoice, InventoryItem, SupplyRequest, SupplyDelivery, DeviceUsage, FormularyItem, Contract, InsurancePlan, ClinicalImpression, MedicationKnowledge). They are edge projections at most.
- The domain model is the truth; FHIR, HL7 v2 and Kurdistan formats are generated projections (constitution rule 4).
- The FHIR R4 façade belongs to the Integration Hub (ADR-014), built on HAPI FHIR structures and the official validator, with a CapabilityStatement generated per tenant and pack (R08 §4.6).
- Writes through FHIR go through domain commands, so the invariants and policy below the API apply to them (constitution rule 7).

## Consequences (including safety and licence impact)

**Safety.**
- Because the projections are generated, a mapping defect could misrepresent clinical facts to a partner (H15) or misroute a result (H3). Round-trip and validator tests are the control.
- Bounded writes as domain commands mean no FHIR client can bypass SI-01…SI-21; the external API is a channel like any other (BUILD-PROMPT §2.1).
- Keeping formulary content internal avoids building medication logic on FormularyItem or MedicationKnowledge, which leave R6 core.

**Engineering.** Every resource needs a mapping, and that is the cost (R08 §4.6). In exchange, R6 is a second projection rather than a storage migration (target: C5 ≤15 engineer-days, no storage migration).

**Licence.** HAPI FHIR is Apache-2.0 (BUILD-PROMPT §4.1). FHIR implementation-guide packages are downloaded only from their official registries (BUILD-PROMPT §3.7).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Projection round-trip tests; FHIR validator.

**Where and when.**
- The projection compiler and the FHIR façade live in the Hub (`backend/hub/`). The first FHIR projections and validation are WP-1.12 exit evidence (`INT-FHIR-01` read, IPS `$summary`: "FHIR projections validate"). SMART, Bulk and Subscriptions follow in Phase 1.1.
- C4, C5 and C6 are measured in the ADR-001 harness (WP-0.6) on the dev cell (indicative).
- The FHIR validator runs in the merge tier's contract tests (BUILD-PROMPT §19.1).

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

A partner or market mandates R6.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
